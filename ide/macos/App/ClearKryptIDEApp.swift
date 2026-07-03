import IDECore
import SwiftUI

@main
struct ClearKryptIDEApp: App {
    @StateObject private var appModel = AppModel()

    var body: some Scene {
        WindowGroup {
            if let session = appModel.session {
                ContentView(session: session)
            } else {
                WelcomeView(appModel: appModel)
            }
        }
        Settings {
            SettingsView(settings: appModel.settings)
        }
    }
}

/// Top-level app state: which project is open, plus user settings.
@MainActor
final class AppModel: ObservableObject {
    @Published var session: ProjectSession?
    @Published var openError: String?

    let settings = SettingsStore()

    func openProject(at path: String) {
        do {
            let project = try ClearKryptProject.load(folder: path)
            settings.addRecentProject(path)
            openError = nil
            let session = ProjectSession(
                project: project, settings: settings,
                onOpenWorktree: { [weak self] worktreePath in self?.openProject(at: worktreePath) })
            self.session = session
            session.start()
        } catch {
            openError = String(describing: error)
        }
    }

    func closeProject() {
        session?.shutdown()
        session = nil
    }
}
