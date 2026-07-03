import IDECore
import SwiftUI

struct DiagnosticsPanel: View {
    @ObservedObject var session: ProjectSession
    @State private var selection: DiagnosticRow.ID?

    var body: some View {
        Table(session.diagnosticRows, selection: $selection) {
            TableColumn("") { row in
                Text(row.severityIcon)
            }
            .width(24)
            TableColumn("Code") { row in
                Text(row.code)
                    .font(.system(.body, design: .monospaced))
            }
            .width(80)
            TableColumn("Message") { row in
                Text(row.message)
                    .lineLimit(1)
                    .help(row.message)
            }
            TableColumn("File") { row in
                Text(row.file)
                    .foregroundStyle(.secondary)
            }
            .width(180)
            TableColumn("Line") { row in
                Text("\(row.displayLine)")
                    .foregroundStyle(.secondary)
            }
            .width(50)
            TableColumn("Target") { row in
                Text(row.target ?? "")
                    .foregroundStyle(.secondary)
            }
            .width(60)
        }
        .onChange(of: selection) { _, newValue in
            guard let id = newValue,
                  let row = session.diagnosticRows.first(where: { $0.id == id }) else {
                return
            }
            navigate(to: row)
        }
    }

    private func navigate(to row: DiagnosticRow) {
        // Open the file if it is a known project file, then move the caret.
        if session.selectedDocument?.uri != row.uri {
            let relative = row.file
            if let file = session.project.files.first(where: { $0.relativePath == relative }) {
                session.openFile(file)
            }
        }
        NotificationCenter.default.post(
            name: .clearkryptNavigate,
            object: nil,
            userInfo: ["line": row.line, "character": row.character])
    }
}

struct BuildPanel: View {
    @ObservedObject var session: ProjectSession

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            if session.isBuildRunning {
                ProgressView()
                    .controlSize(.small)
                    .padding(6)
            }
            ScrollView {
                Text(session.buildOutput.isEmpty ? "Run Check or Build to see output here." : session.buildOutput)
                    .font(.system(.body, design: .monospaced))
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .textSelection(.enabled)
                    .padding(8)
            }
        }
    }
}

struct SettingsView: View {
    let settings: IDECoreSettingsProxy
    @State private var sdkPath: String = ""

    init(settings: IDECore.SettingsStore) {
        self.settings = IDECoreSettingsProxy(store: settings)
    }

    var body: some View {
        Form {
            Section("ClearKrypt SDK") {
                TextField("SDK path or clearkrypt executable", text: $sdkPath)
                    .onSubmit { save() }
                Text("Leave empty to use the CLEARKRYPT_SDK environment variable, then PATH.")
                    .font(.caption)
                    .foregroundStyle(.secondary)
                Button("Save") { save() }
            }
        }
        .padding(20)
        .frame(width: 480)
        .onAppear {
            sdkPath = settings.store.sdkPath ?? ""
        }
    }

    private func save() {
        settings.store.sdkPath = sdkPath.isEmpty ? nil : sdkPath
    }
}

/// Wraps the non-ObservableObject settings store for SwiftUI ownership.
struct IDECoreSettingsProxy {
    let store: IDECore.SettingsStore
}
