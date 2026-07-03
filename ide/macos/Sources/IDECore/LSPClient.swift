import Foundation

/// Language-server lifecycle states surfaced in the IDE status bar.
public enum LSPClientState: Equatable {
    case notStarted
    case starting
    case ready
    case crashed
    case stopped
}

/// JSON-RPC 2.0 LSP client for the docs/21 subset. Callback-based with a
/// serial queue for internal state; the app layer hops to the main actor.
public final class LSPClient {
    public private(set) var state: LSPClientState = .notStarted
    public private(set) var serverInfo: ServerInfo?

    public var onDiagnostics: ((PublishDiagnosticsParams) -> Void)?
    public var onStateChange: ((LSPClientState) -> Void)?

    private let transport: LSPTransport
    private let framing = FramingParser()
    private let queue = DispatchQueue(label: "clearkrypt.lsp.client")
    private var nextId = 0
    private var pending: [Int: (Result<Data, Error>) -> Void] = [:]
    private let encoder = JSONEncoder()
    private let decoder = JSONDecoder()

    public init(transport: LSPTransport) {
        self.transport = transport
        transport.onReceive = { [weak self] data in
            self?.receive(data)
        }
        transport.onClose = { [weak self] _ in
            self?.handleClose()
        }
    }

    // MARK: - Lifecycle

    public func start(rootUri: String, completion: @escaping (Result<ServerInfo?, Error>) -> Void) {
        setState(.starting)
        do {
            try transport.start()
        } catch {
            setState(.crashed)
            completion(.failure(error))
            return
        }
        request(method: "initialize", params: InitializeParams(rootUri: rootUri, capabilities: .init())) {
            [weak self] (result: Result<InitializeResult, Error>) in
            guard let self else { return }
            switch result {
            case .success(let initialized):
                self.serverInfo = initialized.serverInfo
                self.notify(method: "initialized", params: EmptyParams())
                self.setState(.ready)
                completion(.success(initialized.serverInfo))
            case .failure(let error):
                self.setState(.crashed)
                completion(.failure(error))
            }
        }
    }

    public func shutdownAndExit() {
        request(method: "shutdown", params: EmptyParams()) { (_: Result<OptionalNull, Error>) in }
        notify(method: "exit", params: EmptyParams())
        setState(.stopped)
        transport.stop()
    }

    // MARK: - Document sync

    public func didOpen(uri: String, text: String, version: Int) {
        notify(
            method: "textDocument/didOpen",
            params: DidOpenParams(textDocument: .init(uri: uri, languageId: "clearkrypt", version: version, text: text)))
    }

    public func didChange(uri: String, text: String, version: Int) {
        notify(
            method: "textDocument/didChange",
            params: DidChangeParams(
                textDocument: .init(uri: uri, version: version),
                contentChanges: [.init(text: text)]))
    }

    public func didClose(uri: String) {
        notify(method: "textDocument/didClose", params: DocumentRequestParams(uri: uri))
    }

    // MARK: - Requests

    public func documentSymbols(uri: String, completion: @escaping (Result<[DocumentSymbol], Error>) -> Void) {
        request(method: "textDocument/documentSymbol", params: DocumentRequestParams(uri: uri), completion: completion)
    }

    public func hover(uri: String, position: LSPPosition, completion: @escaping (Result<HoverResult?, Error>) -> Void) {
        requestOptional(method: "textDocument/hover", params: PositionRequestParams(uri: uri, position: position), completion: completion)
    }

    public func completions(uri: String, position: LSPPosition, completion: @escaping (Result<[CompletionItem], Error>) -> Void) {
        request(method: "textDocument/completion", params: PositionRequestParams(uri: uri, position: position), completion: completion)
    }

    public func formatting(uri: String, completion: @escaping (Result<[TextEdit], Error>) -> Void) {
        request(method: "textDocument/formatting", params: DocumentRequestParams(uri: uri), completion: completion)
    }

    public func semanticTokens(uri: String, completion: @escaping (Result<SemanticTokensResult?, Error>) -> Void) {
        requestOptional(method: "textDocument/semanticTokens/full", params: DocumentRequestParams(uri: uri), completion: completion)
    }

    public func projectInfo(completion: @escaping (Result<ProjectInfo, Error>) -> Void) {
        request(method: "clearkrypt/projectInfo", params: EmptyParams(), completion: completion)
    }

    public func checkProject(completion: @escaping (Result<CheckResult, Error>) -> Void) {
        request(method: "clearkrypt/check", params: EmptyParams(), completion: completion)
    }

    public func generatedMap(completion: @escaping (Result<GeneratedMap, Error>) -> Void) {
        request(method: "clearkrypt/generatedMap", params: EmptyParams(), completion: completion)
    }

    // MARK: - Wire plumbing

    public enum ClientError: Error, CustomStringConvertible {
        case serverError(code: Int, message: String)
        case connectionClosed
        case malformedResponse

        public var description: String {
            switch self {
            case .serverError(let code, let message):
                return "Language server error \(code): \(message)"
            case .connectionClosed:
                return "The language server connection closed."
            case .malformedResponse:
                return "The language server sent a malformed response."
            }
        }
    }

    /// A response `result` that may legitimately be JSON null.
    private struct OptionalNull: Decodable {}

    private func request<Params: Encodable, Response: Decodable>(
        method: String,
        params: Params,
        completion: @escaping (Result<Response, Error>) -> Void
    ) {
        queue.async { [weak self] in
            guard let self else { return }
            self.nextId += 1
            let id = self.nextId
            self.pending[id] = { result in
                switch result {
                case .success(let data):
                    do {
                        let envelope = try self.decoder.decode(ResultEnvelope<Response>.self, from: data)
                        if let error = envelope.error {
                            completion(.failure(ClientError.serverError(code: error.code, message: error.message)))
                        } else if let value = envelope.result {
                            completion(.success(value))
                        } else {
                            completion(.failure(ClientError.malformedResponse))
                        }
                    } catch {
                        completion(.failure(error))
                    }
                case .failure(let error):
                    completion(.failure(error))
                }
            }
            self.sendEnvelope(RequestEnvelope(jsonrpc: "2.0", id: id, method: method, params: params))
        }
    }

    /// Like `request`, but treats a JSON-null result as `nil` (hover, tokens).
    private func requestOptional<Params: Encodable, Response: Decodable>(
        method: String,
        params: Params,
        completion: @escaping (Result<Response?, Error>) -> Void
    ) {
        queue.async { [weak self] in
            guard let self else { return }
            self.nextId += 1
            let id = self.nextId
            self.pending[id] = { result in
                switch result {
                case .success(let data):
                    do {
                        let envelope = try self.decoder.decode(ResultEnvelope<Response>.self, from: data)
                        if let error = envelope.error {
                            completion(.failure(ClientError.serverError(code: error.code, message: error.message)))
                        } else {
                            completion(.success(envelope.result))
                        }
                    } catch {
                        completion(.failure(error))
                    }
                case .failure(let error):
                    completion(.failure(error))
                }
            }
            self.sendEnvelope(RequestEnvelope(jsonrpc: "2.0", id: id, method: method, params: params))
        }
    }

    private func notify<Params: Encodable>(method: String, params: Params) {
        queue.async { [weak self] in
            guard let self else { return }
            self.sendEnvelope(NotificationEnvelope(jsonrpc: "2.0", method: method, params: params))
        }
    }

    private func sendEnvelope<Envelope: Encodable>(_ envelope: Envelope) {
        guard let body = try? encoder.encode(envelope) else {
            return
        }
        transport.send(FramingParser.frame(body))
    }

    private func receive(_ chunk: Data) {
        queue.async { [weak self] in
            guard let self else { return }
            for body in self.framing.push(chunk) {
                self.dispatch(body)
            }
        }
    }

    private func dispatch(_ body: Data) {
        guard let probe = try? decoder.decode(MessageProbe.self, from: body) else {
            return
        }
        if let id = probe.id, let handler = pending.removeValue(forKey: id) {
            handler(.success(body))
            return
        }
        if probe.method == "textDocument/publishDiagnostics",
           let notification = try? decoder.decode(ParamsEnvelope<PublishDiagnosticsParams>.self, from: body) {
            onDiagnostics?(notification.params)
        }
    }

    private func handleClose() {
        queue.async { [weak self] in
            guard let self else { return }
            if self.state != .stopped {
                self.setState(.crashed)
            }
            let waiting = self.pending
            self.pending.removeAll()
            for handler in waiting.values {
                handler(.failure(ClientError.connectionClosed))
            }
        }
    }

    private func setState(_ newState: LSPClientState) {
        state = newState
        onStateChange?(newState)
    }
}

// MARK: - Envelopes

private struct RequestEnvelope<Params: Encodable>: Encodable {
    let jsonrpc: String
    let id: Int
    let method: String
    let params: Params
}

private struct NotificationEnvelope<Params: Encodable>: Encodable {
    let jsonrpc: String
    let method: String
    let params: Params
}

private struct MessageProbe: Decodable {
    let id: Int?
    let method: String?
}

private struct ResultEnvelope<Value: Decodable>: Decodable {
    let result: Value?
    let error: ResponseError?
}

private struct ResponseError: Decodable {
    let code: Int
    let message: String
}

private struct ParamsEnvelope<Params: Decodable>: Decodable {
    let params: Params
}
