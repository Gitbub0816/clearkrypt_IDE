import Foundation

/// LSP structures for the docs/21-language-server.md subset. Small explicit
/// Codable structs — no dynamic JSON gymnastics.

public struct LSPPosition: Codable, Equatable {
    public let line: Int
    public let character: Int

    public init(line: Int, character: Int) {
        self.line = line
        self.character = character
    }
}

public struct LSPRange: Codable, Equatable {
    public let start: LSPPosition
    public let end: LSPPosition

    public init(start: LSPPosition, end: LSPPosition) {
        self.start = start
        self.end = end
    }
}

public struct LSPDiagnostic: Codable, Equatable {
    public let range: LSPRange
    public let severity: Int?
    public let code: String?
    public let source: String?
    public let message: String
}

public struct PublishDiagnosticsParams: Codable, Equatable {
    public let uri: String
    public let diagnostics: [LSPDiagnostic]
}

public struct DocumentSymbol: Codable, Equatable {
    public let name: String
    public let detail: String?
    public let kind: Int
    public let range: LSPRange
    public let selectionRange: LSPRange
    public let children: [DocumentSymbol]?
}

public struct MarkupContent: Codable, Equatable {
    public let kind: String
    public let value: String
}

public struct HoverResult: Codable, Equatable {
    public let contents: MarkupContent
    public let range: LSPRange?
}

public struct CompletionItem: Codable, Equatable {
    public let label: String
    public let kind: Int?
    public let detail: String?
}

public struct TextEdit: Codable, Equatable {
    public let range: LSPRange
    public let newText: String
}

public struct SemanticTokensResult: Codable, Equatable {
    public let data: [Int]
}

public struct ServerInfo: Codable, Equatable {
    public let name: String?
    public let version: String?
}

public struct InitializeResult: Codable {
    public let serverInfo: ServerInfo?
}

// MARK: - clearkrypt/* extensions (docs/21)

public struct ProjectInfoTargets: Codable, Equatable {
    public let swift: Bool
    public let kotlin: Bool
    public let react: Bool
}

public struct ProjectInfo: Codable, Equatable {
    public let name: String
    public let version: String
    public let targets: ProjectInfoTargets
    public let outputDir: String
    public let sourceFiles: [String]
}

public struct FileDiagnostics: Codable, Equatable {
    public let uri: String
    public let diagnostics: [LSPDiagnostic]
}

public struct CheckResult: Codable, Equatable {
    public let diagnostics: [FileDiagnostics]
}

public struct GeneratedModule: Codable, Equatable {
    public let module: String
    public let sourceFile: String
    public let targets: [String: [String]]
}

public struct GeneratedMap: Codable, Equatable {
    public let modules: [GeneratedModule]
}

// MARK: - Request params

public struct TextDocumentIdentifier: Codable {
    public let uri: String

    public init(uri: String) {
        self.uri = uri
    }
}

public struct DocumentRequestParams: Codable {
    public let textDocument: TextDocumentIdentifier

    public init(uri: String) {
        self.textDocument = TextDocumentIdentifier(uri: uri)
    }
}

public struct PositionRequestParams: Codable {
    public let textDocument: TextDocumentIdentifier
    public let position: LSPPosition

    public init(uri: String, position: LSPPosition) {
        self.textDocument = TextDocumentIdentifier(uri: uri)
        self.position = position
    }
}

struct InitializeParams: Codable {
    let rootUri: String
    let capabilities: EmptyObject

    struct EmptyObject: Codable {}
}

struct DidOpenParams: Codable {
    let textDocument: TextDocumentItem

    struct TextDocumentItem: Codable {
        let uri: String
        let languageId: String
        let version: Int
        let text: String
    }
}

struct DidChangeParams: Codable {
    let textDocument: VersionedIdentifier
    let contentChanges: [ContentChange]

    struct VersionedIdentifier: Codable {
        let uri: String
        let version: Int
    }

    struct ContentChange: Codable {
        let text: String
    }
}

struct EmptyParams: Codable {
    init() {}
}
