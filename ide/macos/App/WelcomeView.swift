import AppKit
import SwiftUI

struct WelcomeView: View {
    @ObservedObject var appModel: AppModel

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("ClearKrypt IDE")
                .font(.largeTitle.bold())
            Text("Open a folder that contains a clearkrypt.toml project.")
                .foregroundStyle(.secondary)

            GroupBox("Recent projects") {
                let recents = appModel.settings.recentProjects
                if recents.isEmpty {
                    Text("No recent projects yet.")
                        .foregroundStyle(.secondary)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .padding(4)
                } else {
                    VStack(alignment: .leading, spacing: 4) {
                        ForEach(recents, id: \.self) { path in
                            Button(path) {
                                appModel.openProject(at: path)
                            }
                            .buttonStyle(.link)
                            .lineLimit(1)
                            .truncationMode(.middle)
                        }
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(4)
                }
            }

            if let error = appModel.openError {
                Text(error)
                    .foregroundStyle(.red)
                    .textSelection(.enabled)
            }

            HStack {
                Spacer()
                Button("Open Project Folder…") {
                    browse()
                }
                .keyboardShortcut("o")
                .buttonStyle(.borderedProminent)
            }
        }
        .padding(24)
        .frame(minWidth: 520, minHeight: 380)
    }

    private func browse() {
        let panel = NSOpenPanel()
        panel.title = "Open ClearKrypt Project"
        panel.canChooseFiles = false
        panel.canChooseDirectories = true
        panel.allowsMultipleSelection = false
        if panel.runModal() == .OK, let url = panel.url {
            appModel.openProject(at: url.path)
        }
    }
}
