import Foundation
import IDECore

/// One open editor document.
@MainActor
final class OpenDocument: ObservableObject, Identifiable {
    let file: ProjectFile
    let uri: String
    let absolutePath: String
    @Published var text: String
    @Published var isDirty = false
    var version = 1

    init(file: ProjectFile, uri: String, absolutePath: String, text: String) {
        self.file = file
        self.uri = uri
        self.absolutePath = absolutePath
        self.text = text
    }

    var id: String { uri }
    var isClearKryptSource: Bool { file.relativePath.hasSuffix(".ck") }
    var tabTitle: String { isDirty ? file.name + " •" : file.name }
}

/// One row in the diagnostics panel.
struct DiagnosticRow: Identifiable {
    let id = UUID()
    let uri: String
    let file: String
    let severity: Int
    let code: String
    let message: String
    /// Zero-based, for navigation.
    let line: Int
    let character: Int
    let target: String?

    var severityIcon: String {
        switch severity {
        case 1: return "⛔"
        case 2: return "⚠️"
        case 3: return "ℹ️"
        default: return "•"
        }
    }

    var displayLine: Int { line + 1 }
}

/// Owns everything about the open project: the language-server client,
/// open documents, diagnostics, semantic tokens, and build state. All
/// mutation happens on the main actor; IDECore callbacks hop over.
@MainActor
final class ProjectSession: ObservableObject {
    let project: ClearKryptProject

    @Published var documents: [OpenDocument] = []
    @Published var selectedDocumentId: String?
    @Published var diagnosticsByUri: [String: [LSPDiagnostic]] = [:]
    @Published var cliDiagnostics: [DiagnosticRow] = []
    @Published var tokensByUri: [String: [TokenSpan]] = [:]
    @Published var outline: [DocumentSymbol] = []
    @Published var serverStatus = "starting"
    @Published var serverCrashed = false
    @Published var buildOutput = ""
    @Published var isBuildRunning = false
    @Published var targetSwift: Bool
    @Published var targetKotlin: Bool
    @Published var targetReact: Bool
    @Published var completionLabels: [String] = []

    private let settings: SettingsStore
    private var client: LSPClient?
    private var changeDebounce: [String: DispatchWorkItem] = [:]

    init(project: ClearKryptProject, settings: SettingsStore) {
        self.project = project
        self.settings = settings
        self.targetSwift = project.manifest.targets.swift
        self.targetKotlin = project.manifest.targets.kotlin
        self.targetReact = project.manifest.targets.react
    }

    var selectedDocument: OpenDocument? {
        documents.first { $0.id == selectedDocumentId }
    }

    var diagnosticRows: [DiagnosticRow] {
        var rows: [DiagnosticRow] = []
        for (uri, diagnostics) in diagnosticsByUri {
            let display = uri.hasPrefix(project.rootUri)
                ? String(uri.dropFirst(project.rootUri.count + 1))
                : uri
            for diagnostic in diagnostics {
                rows.append(DiagnosticRow(
                    uri: uri,
                    file: display,
                    severity: diagnostic.severity ?? 1,
                    code: diagnostic.code ?? "",
                    message: diagnostic.message,
                    line: diagnostic.range.start.line,
                    character: diagnostic.range.start.character,
                    target: nil))
            }
        }
        rows.append(contentsOf: cliDiagnostics)
        return rows.sorted { ($0.file, $0.line) < ($1.file, $1.line) }
    }

    // MARK: - Language server lifecycle

    func start() {
        let command = SdkResolver.resolveCommand(userSetting: settings.sdkPath)
        let transport = ProcessTransport(
            executable: command,
            arguments: ["language-server", "--stdio"],
            workingDirectory: project.rootPath)
        let client = LSPClient(transport: transport)
        self.client = client

        client.onStateChange = { [weak self] state in
            Task { @MainActor [weak self] in
                self?.applyServerState(state)
            }
        }
        client.onDiagnostics = { [weak self] published in
            Task { @MainActor [weak self] in
                self?.diagnosticsByUri[published.uri] = published.diagnostics
            }
        }
        client.start(rootUri: project.rootUri) { [weak self] result in
            Task { @MainActor [weak self] in
                if case .failure(let error) = result {
                    self?.serverStatus = "failed to start: \(error)"
                    self?.serverCrashed = true
                }
            }
        }
    }

    func restartServer() {
        client?.shutdownAndExit()
        client = nil
        diagnosticsByUri = [:]
        start()
        for document in documents where document.isClearKryptSource {
            client?.didOpen(uri: document.uri, text: document.text, version: document.version)
        }
    }

    func shutdown() {
        client?.shutdownAndExit()
        client = nil
    }

    private func applyServerState(_ state: LSPClientState) {
        switch state {
        case .notStarted: serverStatus = "not started"
        case .starting: serverStatus = "starting"
        case .ready:
            serverStatus = "ready"
            for document in documents where document.isClearKryptSource {
                client?.didOpen(uri: document.uri, text: document.text, version: document.version)
            }
            refreshCompletions()
        case .crashed: serverStatus = "crashed — restart to recover"
        case .stopped: serverStatus = "stopped"
        }
        serverCrashed = state == .crashed
    }

    // MARK: - Documents

    func openFile(_ file: ProjectFile) {
        let uri = project.uri(for: file)
        if documents.contains(where: { $0.uri == uri }) {
            selectedDocumentId = uri
            return
        }
        let absolutePath = project.absolutePath(for: file)
        guard let text = try? String(contentsOfFile: absolutePath, encoding: .utf8) else {
            return
        }
        let document = OpenDocument(file: file, uri: uri, absolutePath: absolutePath, text: text)
        documents.append(document)
        selectedDocumentId = uri
        if document.isClearKryptSource {
            client?.didOpen(uri: uri, text: text, version: document.version)
            refreshTokens(for: document)
            refreshOutline(for: document)
        }
    }

    func closeDocument(_ document: OpenDocument) {
        documents.removeAll { $0.id == document.id }
        if selectedDocumentId == document.id {
            selectedDocumentId = documents.last?.id
        }
        if document.isClearKryptSource {
            client?.didClose(uri: document.uri)
        }
    }

    /// Called by the editor on every keystroke; syncs to the server debounced.
    func documentTextChanged(_ document: OpenDocument) {
        document.isDirty = true
        guard document.isClearKryptSource else {
            return
        }
        changeDebounce[document.uri]?.cancel()
        let work = DispatchWorkItem { [weak self, weak document] in
            Task { @MainActor [weak self, weak document] in
                guard let self, let document else { return }
                document.version += 1
                self.client?.didChange(uri: document.uri, text: document.text, version: document.version)
                self.refreshTokens(for: document)
                self.refreshOutline(for: document)
                self.refreshCompletions()
            }
        }
        changeDebounce[document.uri] = work
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.3, execute: work)
    }

    func saveSelectedDocument() {
        guard let document = selectedDocument, !document.file.isReadOnly else {
            return
        }
        do {
            try document.text.write(toFile: document.absolutePath, atomically: true, encoding: .utf8)
            document.isDirty = false
        } catch {
            buildOutput += "Save failed: \(error)\n"
        }
    }

    // MARK: - Language features

    private func refreshTokens(for document: OpenDocument) {
        client?.semanticTokens(uri: document.uri) { [weak self] result in
            Task { @MainActor [weak self] in
                if case .success(let tokens) = result, let tokens {
                    self?.tokensByUri[document.uri] = SemanticTokenDecoder.decode(tokens.data)
                }
            }
        }
    }

    private func refreshOutline(for document: OpenDocument) {
        client?.documentSymbols(uri: document.uri) { [weak self] result in
            Task { @MainActor [weak self] in
                if case .success(let symbols) = result {
                    self?.outline = symbols
                }
            }
        }
    }

    private func refreshCompletions() {
        guard let document = selectedDocument, document.isClearKryptSource else {
            return
        }
        client?.completions(uri: document.uri, position: LSPPosition(line: 0, character: 0)) { [weak self] result in
            Task { @MainActor [weak self] in
                if case .success(let items) = result {
                    self?.completionLabels = items.map(\.label)
                }
            }
        }
    }

    // MARK: - Build

    func runBuild(check: Bool) {
        guard !isBuildRunning else {
            return
        }
        isBuildRunning = true
        buildOutput = check ? "Checking…\n" : "Building…\n"

        var targets: [String] = []
        if targetSwift { targets.append("swift") }
        if targetKotlin { targets.append("kotlin") }
        if targetReact { targets.append("react") }

        let command = SdkResolver.resolveCommand(userSetting: settings.sdkPath)
        let runner = BuildRunner(command: command)
        runner.run(
            subcommand: check ? "check" : "build",
            projectDirectory: project.rootPath,
            targets: check ? [] : targets
        ) { [weak self] result in
            Task { @MainActor [weak self] in
                guard let self else { return }
                self.isBuildRunning = false
                switch result {
                case .failure(let error):
                    self.buildOutput += "Failed to run clearkrypt: \(error)\n"
                    self.buildOutput += "Set the SDK path in Settings or add clearkrypt to PATH.\n"
                case .success(let outcome):
                    self.cliDiagnostics = (outcome.result?.diagnostics ?? []).map { diagnostic in
                        DiagnosticRow(
                            uri: self.project.rootUri + "/" + diagnostic.file,
                            file: diagnostic.file,
                            severity: diagnostic.severity == "error" ? 1 : 2,
                            code: diagnostic.code,
                            message: diagnostic.message,
                            line: max(0, diagnostic.range.startLine - 1),
                            character: max(0, diagnostic.range.startColumn - 1),
                            target: diagnostic.target)
                    }
                    let generatedCount = outcome.result?.generatedFiles?.count ?? 0
                    if outcome.isSuccess {
                        self.buildOutput += check
                            ? "Check passed. No problems found.\n"
                            : "Build succeeded. \(generatedCount) files generated.\n"
                    } else if outcome.hasDiagnosticErrors {
                        self.buildOutput += "Completed with errors — see the Diagnostics panel.\n"
                    } else {
                        self.buildOutput += "clearkrypt exited with code \(outcome.exitCode).\n"
                        self.buildOutput += outcome.rawStderr
                    }
                }
            }
        }
    }
}
