import Foundation

/// One entry from `git worktree list --porcelain`: a checkout the IDE can
/// open as its own project session, alongside every other worktree of the
/// same repository.
public struct GitWorktreeInfo: Equatable, Identifiable {
    public let path: String
    public let commitSha: String
    public let branch: String?
    public let isBare: Bool
    public let isDetached: Bool
    public let isLocked: Bool
    public let lockReason: String?
    public let isPrunable: Bool

    public var id: String { path }

    /// The branch name without the `refs/heads/` prefix, or nil when detached.
    public var shortBranch: String? {
        branch?.replacingOccurrences(of: "refs/heads/", with: "")
    }

    public init(
        path: String,
        commitSha: String,
        branch: String?,
        isBare: Bool,
        isDetached: Bool,
        isLocked: Bool,
        lockReason: String?,
        isPrunable: Bool
    ) {
        self.path = path
        self.commitSha = commitSha
        self.branch = branch
        self.isBare = isBare
        self.isDetached = isDetached
        self.isLocked = isLocked
        self.lockReason = lockReason
        self.isPrunable = isPrunable
    }
}

/// Thrown when a git worktree operation fails; the message wraps git's own
/// stderr so the IDE can show it directly to the user.
public struct GitWorktreeError: Error, CustomStringConvertible {
    public let message: String
    public var description: String { message }
}

/// Lists, creates, and removes git worktrees for a repository, so the IDE
/// can let a developer work on several branches of the same ClearKrypt
/// project side by side, each with its own project session. A thin wrapper
/// over the real `git` CLI — no libgit2 binding, no parallel implementation
/// of git's own logic.
public final class GitWorktreeService {
    private let repositoryPath: String
    private let gitExecutable: String

    public init(repositoryPath: String, gitExecutable: String = "/usr/bin/git") {
        self.repositoryPath = repositoryPath
        self.gitExecutable = gitExecutable
    }

    /// True when `path` is inside a git working tree at all.
    public static func isGitRepository(_ path: String, gitExecutable: String = "/usr/bin/git") -> Bool {
        guard let result = try? Self.runGit(
            executable: gitExecutable, workingDirectory: path,
            arguments: ["rev-parse", "--is-inside-work-tree"]
        ) else {
            return false
        }
        return result.exitCode == 0 && result.stdout.trimmingCharacters(in: .whitespacesAndNewlines) == "true"
    }

    /// Lists every worktree registered for this repository, main checkout included.
    public func list() throws -> [GitWorktreeInfo] {
        let result = try Self.runGit(
            executable: gitExecutable, workingDirectory: repositoryPath,
            arguments: ["worktree", "list", "--porcelain"])
        guard result.exitCode == 0 else {
            throw GitWorktreeError(message: Self.friendlyFailure("list worktrees", result.stderr))
        }
        return Self.parsePorcelain(result.stdout)
    }

    /// Creates a new worktree at `worktreePath`. When `createBranch` is
    /// true, `branch` is created (from `startPoint`, defaulting to HEAD);
    /// otherwise `branch` must already exist and is simply checked out into
    /// the new worktree.
    @discardableResult
    public func add(
        worktreePath: String, branch: String, startPoint: String? = nil, createBranch: Bool = true
    ) throws -> GitWorktreeInfo {
        var arguments = ["worktree", "add"]
        if createBranch {
            arguments.append(contentsOf: ["-b", branch, worktreePath])
            if let startPoint, !startPoint.isEmpty {
                arguments.append(startPoint)
            }
        } else {
            arguments.append(contentsOf: [worktreePath, branch])
        }

        let result = try Self.runGit(executable: gitExecutable, workingDirectory: repositoryPath, arguments: arguments)
        guard result.exitCode == 0 else {
            throw GitWorktreeError(message: Self.friendlyFailure("create the worktree at '\(worktreePath)'", result.stderr))
        }

        let all = try list()
        guard let created = all.first(where: { Self.pathsMatch($0.path, worktreePath) }) else {
            throw GitWorktreeError(message: "git created the worktree at '\(worktreePath)' but it did not appear in 'git worktree list'.")
        }
        return created
    }

    /// Removes a worktree. `force` discards uncommitted changes in it.
    public func remove(worktreePath: String, force: Bool = false) throws {
        var arguments = ["worktree", "remove"]
        if force { arguments.append("--force") }
        arguments.append(worktreePath)

        let result = try Self.runGit(executable: gitExecutable, workingDirectory: repositoryPath, arguments: arguments)
        guard result.exitCode == 0 else {
            throw GitWorktreeError(message: Self.friendlyFailure("remove the worktree at '\(worktreePath)'", result.stderr))
        }
    }

    /// Prunes administrative files for worktrees whose directory was deleted manually.
    public func prune() throws {
        let result = try Self.runGit(executable: gitExecutable, workingDirectory: repositoryPath, arguments: ["worktree", "prune"])
        guard result.exitCode == 0 else {
            throw GitWorktreeError(message: Self.friendlyFailure("prune stale worktrees", result.stderr))
        }
    }

    private static func pathsMatch(_ a: String, _ b: String) -> Bool {
        let urlA = URL(fileURLWithPath: a).standardizedFileURL.path
        let urlB = URL(fileURLWithPath: b).standardizedFileURL.path
        return urlA == urlB
    }

    private static func friendlyFailure(_ action: String, _ stderr: String) -> String {
        let detail = stderr.trimmingCharacters(in: .whitespacesAndNewlines)
        return detail.isEmpty ? "git could not \(action)." : "git could not \(action): \(detail)"
    }

    /// Parses `git worktree list --porcelain` output.
    public static func parsePorcelain(_ porcelain: String) -> [GitWorktreeInfo] {
        var result: [GitWorktreeInfo] = []
        var path: String?
        var commit = ""
        var branch: String?
        var isBare = false
        var isDetached = false
        var isLocked = false
        var lockReason: String?
        var isPrunable = false

        func flush() {
            guard let currentPath = path else { return }
            result.append(GitWorktreeInfo(
                path: currentPath, commitSha: commit, branch: branch, isBare: isBare,
                isDetached: isDetached, isLocked: isLocked, lockReason: lockReason, isPrunable: isPrunable))
            path = nil
            commit = ""
            branch = nil
            isBare = false
            isDetached = false
            isLocked = false
            lockReason = nil
            isPrunable = false
        }

        for rawLine in porcelain.split(separator: "\n", omittingEmptySubsequences: false) {
            let line = rawLine.trimmingCharacters(in: CharacterSet(charactersIn: "\r"))
            if line.isEmpty {
                flush()
                continue
            }
            let parts = line.split(separator: " ", maxSplits: 1, omittingEmptySubsequences: false)
            let key = String(parts[0])
            let value = parts.count > 1 ? String(parts[1]) : ""

            switch key {
            case "worktree": path = value
            case "HEAD": commit = value
            case "branch": branch = value
            case "bare": isBare = true
            case "detached": isDetached = true
            case "locked":
                isLocked = true
                lockReason = value.isEmpty ? nil : value
            case "prunable": isPrunable = true
            default: break
            }
        }
        flush()

        return result
    }

    private struct ProcessResult {
        let exitCode: Int32
        let stdout: String
        let stderr: String
    }

    private static func runGit(executable: String, workingDirectory: String, arguments: [String]) throws -> ProcessResult {
        let process = Process()
        process.executableURL = URL(fileURLWithPath: executable)
        process.arguments = arguments
        process.currentDirectoryURL = URL(fileURLWithPath: workingDirectory)

        let stdoutPipe = Pipe()
        let stderrPipe = Pipe()
        process.standardOutput = stdoutPipe
        process.standardError = stderrPipe

        try process.run()
        let stdoutData = stdoutPipe.fileHandleForReading.readDataToEndOfFile()
        let stderrData = stderrPipe.fileHandleForReading.readDataToEndOfFile()
        process.waitUntilExit()

        return ProcessResult(
            exitCode: process.terminationStatus,
            stdout: String(data: stdoutData, encoding: .utf8) ?? "",
            stderr: String(data: stderrData, encoding: .utf8) ?? "")
    }
}
