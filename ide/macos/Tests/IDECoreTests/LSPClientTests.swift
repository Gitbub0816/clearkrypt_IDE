import XCTest
@testable import IDECore

/// A transport the test controls: captures outgoing frames, feeds canned
/// server responses back through the parser path.
final class MockTransport: LSPTransport {
    var onReceive: ((Data) -> Void)?
    var onClose: ((Error?) -> Void)?
    private(set) var sentBodies: [String] = []
    private let parser = FramingParser()

    func start() throws {}

    func stop() {}

    func send(_ data: Data) {
        for body in parser.push(data) {
            sentBodies.append(String(data: body, encoding: .utf8) ?? "")
        }
    }

    func respond(_ json: String) {
        onReceive?(FramingParser.frame(Data(json.utf8)))
    }
}

final class LSPClientTests: XCTestCase {
    func testInitializeHandshakeReachesReady() {
        let transport = MockTransport()
        let client = LSPClient(transport: transport)

        let started = expectation(description: "initialize completes")
        client.start(rootUri: "file:///tmp/project") { result in
            if case .success(let info) = result {
                XCTAssertEqual(info?.name, "clearkrypt-language-server")
            } else {
                XCTFail("initialize failed")
            }
            started.fulfill()
        }

        // Give the client's queue a beat to register the pending request.
        waitForSend(transport, containing: "\"method\":\"initialize\"")
        transport.respond(
            "{\"jsonrpc\":\"2.0\",\"id\":1,\"result\":{\"capabilities\":{},\"serverInfo\":{\"name\":\"clearkrypt-language-server\",\"version\":\"0.1.0\"}}}")

        wait(for: [started], timeout: 5)
        XCTAssertEqual(client.state, .ready)
    }

    func testPublishDiagnosticsNotificationIsDispatched() {
        let transport = MockTransport()
        let client = LSPClient(transport: transport)

        let received = expectation(description: "diagnostics received")
        client.onDiagnostics = { published in
            XCTAssertEqual(published.uri, "file:///tmp/project/src/main.ck")
            XCTAssertEqual(published.diagnostics.first?.code, "CK0003")
            received.fulfill()
        }

        transport.respond(
            "{\"jsonrpc\":\"2.0\",\"method\":\"textDocument/publishDiagnostics\",\"params\":{\"uri\":\"file:///tmp/project/src/main.ck\",\"diagnostics\":[{\"range\":{\"start\":{\"line\":3,\"character\":2},\"end\":{\"line\":3,\"character\":8}},\"severity\":1,\"code\":\"CK0003\",\"source\":\"clearkrypt\",\"message\":\"Type mismatch\"}]}}")

        wait(for: [received], timeout: 5)
    }

    func testRequestCorrelationAndErrorHandling() {
        let transport = MockTransport()
        let client = LSPClient(transport: transport)

        let succeeded = expectation(description: "symbols decoded")
        client.documentSymbols(uri: "file:///x.ck") { result in
            if case .success(let symbols) = result {
                XCTAssertEqual(symbols.first?.name, "Greeting")
            } else {
                XCTFail("expected success")
            }
            succeeded.fulfill()
        }
        waitForSend(transport, containing: "\"method\":\"textDocument\\/documentSymbol\"", orContaining: "textDocument/documentSymbol")
        transport.respond(
            "{\"jsonrpc\":\"2.0\",\"id\":1,\"result\":[{\"name\":\"Greeting\",\"kind\":23,\"range\":{\"start\":{\"line\":2,\"character\":0},\"end\":{\"line\":5,\"character\":1}},\"selectionRange\":{\"start\":{\"line\":2,\"character\":6},\"end\":{\"line\":2,\"character\":14}}}]}")
        wait(for: [succeeded], timeout: 5)

        let failed = expectation(description: "server error surfaced")
        client.hover(uri: "file:///x.ck", position: LSPPosition(line: 0, character: 0)) { result in
            if case .failure = result {
                failed.fulfill()
            } else {
                XCTFail("expected failure")
            }
        }
        waitForSend(transport, containing: "hover")
        transport.respond("{\"jsonrpc\":\"2.0\",\"id\":2,\"error\":{\"code\":-32603,\"message\":\"boom\"}}")
        wait(for: [failed], timeout: 5)
    }

    /// Polls until the mock transport has seen a frame containing the text.
    private func waitForSend(_ transport: MockTransport, containing text: String, orContaining alternative: String? = nil) {
        let deadline = Date().addingTimeInterval(5)
        while Date() < deadline {
            let bodies = transport.sentBodies
            if bodies.contains(where: { $0.contains(text) || (alternative.map { alt in $0.contains(alt) } ?? false) }) {
                return
            }
            RunLoop.current.run(until: Date().addingTimeInterval(0.02))
        }
        XCTFail("timed out waiting for outgoing frame containing \(text)")
    }
}
