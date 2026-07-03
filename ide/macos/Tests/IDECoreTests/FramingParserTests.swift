import XCTest
@testable import IDECore

final class FramingParserTests: XCTestCase {
    private func frame(_ json: String) -> Data {
        FramingParser.frame(Data(json.utf8))
    }

    func testParsesCompleteMessage() {
        let parser = FramingParser()
        let messages = parser.push(frame("{\"a\":1}"))
        XCTAssertEqual(messages.map { String(data: $0, encoding: .utf8) }, ["{\"a\":1}"])
    }

    func testHandlesMessageSplitAcrossChunks() {
        let parser = FramingParser()
        let framed = frame("{\"hello\":\"world\"}")
        let first = parser.push(framed.prefix(10))
        XCTAssertTrue(first.isEmpty)
        let second = parser.push(framed.dropFirst(10))
        XCTAssertEqual(second.map { String(data: $0, encoding: .utf8) }, ["{\"hello\":\"world\"}"])
    }

    func testHandlesTwoMessagesInOneChunk() {
        let parser = FramingParser()
        var combined = frame("{\"a\":1}")
        combined.append(frame("{\"b\":2}"))
        let messages = parser.push(combined)
        XCTAssertEqual(
            messages.map { String(data: $0, encoding: .utf8) },
            ["{\"a\":1}", "{\"b\":2}"])
    }

    func testHeaderNameIsCaseInsensitive() {
        let parser = FramingParser()
        let body = "{\"x\":1}"
        let raw = "content-length: \(body.utf8.count)\r\n\r\n" + body
        let messages = parser.push(Data(raw.utf8))
        XCTAssertEqual(messages.map { String(data: $0, encoding: .utf8) }, [body])
    }

    func testLengthIsMeasuredInBytes() {
        let parser = FramingParser()
        let body = "{\"s\":\"héllo\"}"
        let messages = parser.push(frame(body))
        XCTAssertEqual(messages.map { String(data: $0, encoding: .utf8) }, [body])
    }
}
