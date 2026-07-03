import Foundation
import IDECore

/// Backs the worktrees panel: lists every git worktree of the open
/// project's repository, and lets the developer create or remove one
/// without leaving the IDE. Opening a worktree calls `onOpenWorktree` with
/// its path so the app can load it as its own project session, keeping
/// each worktree's editor and diagnostics state fully independent.
@MainActor
final class WorktreesModel: ObservableObject {
    @Published var worktrees: [GitWorktreeInfo] = []
    @Published var newBranchName: String = ""
    @Published var errorMessage: String?
    @Published var isBusy = false

    private let service: GitWorktreeService
    private let currentPath: String
    let onOpenWorktree: (String) -> Void

    init(repositoryPath: String, currentWorktreePath: String, onOpenWorktree: @escaping (String) -> Void) {
        self.service = GitWorktreeService(repositoryPath: repositoryPath)
        self.currentPath = currentWorktreePath
        self.onOpenWorktree = onOpenWorktree
        refresh()
    }

    func isCurrent(_ worktree: GitWorktreeInfo) -> Bool {
        URL(fileURLWithPath: worktree.path).standardizedFileURL.path
            == URL(fileURLWithPath: currentPath).standardizedFileURL.path
    }

    func refresh() {
        errorMessage = nil
        do {
            worktrees = try service.list()
        } catch {
            errorMessage = String(describing: error)
        }
    }

    func add() {
        let branch = newBranchName.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !branch.isEmpty else { return }

        isBusy = true
        errorMessage = nil
        defer { isBusy = false }

        let repoParent = (currentPath as NSString).deletingLastPathComponent
        let repoName = (currentPath as NSString).lastPathComponent
        let sanitizedBranch = branch.replacingOccurrences(of: "/", with: "-")
        let worktreePath = (repoParent as NSString).appendingPathComponent("\(repoName)-\(sanitizedBranch)")

        do {
            _ = try service.add(worktreePath: worktreePath, branch: branch)
            newBranchName = ""
            refresh()
        } catch {
            errorMessage = String(describing: error)
        }
    }

    func remove(_ worktree: GitWorktreeInfo) {
        guard !isCurrent(worktree) else { return }

        isBusy = true
        errorMessage = nil
        defer { isBusy = false }

        do {
            try service.remove(worktreePath: worktree.path, force: true)
            refresh()
        } catch {
            errorMessage = String(describing: error)
        }
    }

    func open(_ worktree: GitWorktreeInfo) {
        onOpenWorktree(worktree.path)
    }
}
