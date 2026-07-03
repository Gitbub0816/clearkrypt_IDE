import XCTest
@testable import IDECore

/// Exercises `GitWorktreeService` against a real, throwaway git repository
/// created under the OS temp directory for each test — these are
/// integration tests, not mocks, so they prove the service's behavior
/// matches what the real `git` binary actually does.
final class GitWorktreeServiceTests: XCTestCase {
    private var repoPath: String!

    override func setUpWithError() throws {
        repoPath = (NSTemporaryDirectory() as NSString).appendingPathComponent(
            "ck-worktree-tests-\(UUID().uuidString)")
        try FileManager.default.createDirectory(atPath: repoPath, withIntermediateDirectories: true)
        try runGit(in: repoPath, ["init", "-q", "-b", "main"])
        try runGit(in: repoPath, ["config", "user.email", "test@example.com"])
        try runGit(in: repoPath, ["config", "user.name", "Test"])
        try "hello\n".write(toFile: (repoPath as NSString).appendingPathComponent("README.md"), atomically: true, encoding: .utf8)
        try runGit(in: repoPath, ["add", "README.md"])
        try runGit(in: repoPath, ["commit", "-q", "-m", "initial commit"])
    }

    override func tearDownWithError() throws {
        let service = GitWorktreeService(repositoryPath: repoPath)
        if let worktrees = try? service.list() {
            for worktree in worktrees where !pathsEqual(worktree.path, repoPath) {
                try? service.remove(worktreePath: worktree.path, force: true)
            }
        }
        try? FileManager.default.removeItem(atPath: repoPath)
    }

    func testIsGitRepositoryIsTrueForARealRepoAndFalseOutsideOne() {
        XCTAssertTrue(GitWorktreeService.isGitRepository(repoPath))
        XCTAssertFalse(GitWorktreeService.isGitRepository(NSTemporaryDirectory()))
    }

    func testListIncludesTheMainWorktreeOnABrandNewRepo() throws {
        let service = GitWorktreeService(repositoryPath: repoPath)
        let worktrees = try service.list()

        XCTAssertEqual(worktrees.count, 1)
        XCTAssertTrue(pathsEqual(worktrees[0].path, repoPath))
        XCTAssertEqual(worktrees[0].branch, "refs/heads/main")
        XCTAssertEqual(worktrees[0].shortBranch, "main")
        XCTAssertFalse(worktrees[0].isDetached)
    }

    func testAddCreatesANewBranchAndWorktree() throws {
        let service = GitWorktreeService(repositoryPath: repoPath)
        let worktreePath = (NSTemporaryDirectory() as NSString).appendingPathComponent(
            "ck-worktree-out-\(UUID().uuidString)")

        let created = try service.add(worktreePath: worktreePath, branch: "feature/nested-functions")

        XCTAssertTrue(pathsEqual(created.path, worktreePath))
        XCTAssertEqual(created.branch, "refs/heads/feature/nested-functions")
        XCTAssertTrue(FileManager.default.fileExists(atPath: worktreePath))
        XCTAssertTrue(FileManager.default.fileExists(atPath: (worktreePath as NSString).appendingPathComponent("README.md")))

        let all = try service.list()
        XCTAssertEqual(all.count, 2)
        XCTAssertTrue(all.contains { pathsEqual($0.path, worktreePath) })

        try service.remove(worktreePath: worktreePath)
        XCTAssertFalse(FileManager.default.fileExists(atPath: worktreePath))
        XCTAssertEqual(try service.list().count, 1)
    }

    func testEachWorktreeIsIndependentOfTheOthers() throws {
        let service = GitWorktreeService(repositoryPath: repoPath)
        let worktreePath = (NSTemporaryDirectory() as NSString).appendingPathComponent(
            "ck-worktree-independent-\(UUID().uuidString)")
        _ = try service.add(worktreePath: worktreePath, branch: "feature/independent")

        let onlyHerePath = (worktreePath as NSString).appendingPathComponent("only-here.txt")
        try "scoped to this worktree\n".write(toFile: onlyHerePath, atomically: true, encoding: .utf8)
        XCTAssertTrue(FileManager.default.fileExists(atPath: onlyHerePath))
        XCTAssertFalse(FileManager.default.fileExists(
            atPath: (repoPath as NSString).appendingPathComponent("only-here.txt")))

        try service.remove(worktreePath: worktreePath, force: true)
    }

    func testRemoveOfAnUnknownPathThrowsAFriendlyError() {
        let service = GitWorktreeService(repositoryPath: repoPath)
        let missingPath = (NSTemporaryDirectory() as NSString).appendingPathComponent(
            "ck-worktree-does-not-exist-\(UUID().uuidString)")

        XCTAssertThrowsError(try service.remove(worktreePath: missingPath)) { error in
            guard let worktreeError = error as? GitWorktreeError else {
                return XCTFail("expected GitWorktreeError, got \(error)")
            }
            XCTAssertTrue(worktreeError.message.contains("remove the worktree"))
        }
    }

    func testAddingTheSameBranchTwiceThrowsAFriendlyError() throws {
        let service = GitWorktreeService(repositoryPath: repoPath)
        let firstPath = (NSTemporaryDirectory() as NSString).appendingPathComponent("ck-worktree-dup-a-\(UUID().uuidString)")
        let secondPath = (NSTemporaryDirectory() as NSString).appendingPathComponent("ck-worktree-dup-b-\(UUID().uuidString)")
        _ = try service.add(worktreePath: firstPath, branch: "feature/duplicate")

        XCTAssertThrowsError(try service.add(worktreePath: secondPath, branch: "feature/duplicate")) { error in
            guard let worktreeError = error as? GitWorktreeError else {
                return XCTFail("expected GitWorktreeError, got \(error)")
            }
            XCTAssertTrue(worktreeError.message.contains("create the worktree"))
        }

        try service.remove(worktreePath: firstPath, force: true)
    }

    func testParsePorcelainCountsEntriesSeparatedByBlankLines() {
        let single = "worktree /repo\nHEAD abc123\nbranch refs/heads/main\n"
        XCTAssertEqual(GitWorktreeService.parsePorcelain(single).count, 1)

        let double = "worktree /repo\nHEAD abc123\nbranch refs/heads/main\n\nworktree /repo-2\nHEAD def456\ndetached\n"
        XCTAssertEqual(GitWorktreeService.parsePorcelain(double).count, 2)
    }

    func testParsePorcelainReadsLockedAndPrunableFlagsWithReasons() {
        let porcelain = """
        worktree /repo
        HEAD abc123
        branch refs/heads/main

        worktree /repo-locked
        HEAD def456
        detached
        locked machine is unmounted
        prunable gitdir file points to non-existent location

        """

        let parsed = GitWorktreeService.parsePorcelain(porcelain)

        let main = parsed.first { $0.path == "/repo" }
        XCTAssertEqual(main?.branch, "refs/heads/main")
        XCTAssertEqual(main?.isLocked, false)

        let locked = parsed.first { $0.path == "/repo-locked" }
        XCTAssertEqual(locked?.isDetached, true)
        XCTAssertEqual(locked?.isLocked, true)
        XCTAssertEqual(locked?.lockReason, "machine is unmounted")
        XCTAssertEqual(locked?.isPrunable, true)
    }

    private func pathsEqual(_ a: String, _ b: String) -> Bool {
        URL(fileURLWithPath: a).standardizedFileURL.path == URL(fileURLWithPath: b).standardizedFileURL.path
    }

    @discardableResult
    private func runGit(in directory: String, _ arguments: [String]) throws -> String {
        let process = Process()
        process.executableURL = URL(fileURLWithPath: "/usr/bin/git")
        process.arguments = arguments
        process.currentDirectoryURL = URL(fileURLWithPath: directory)
        let stdout = Pipe()
        let stderr = Pipe()
        process.standardOutput = stdout
        process.standardError = stderr
        try process.run()
        let outData = stdout.fileHandleForReading.readDataToEndOfFile()
        let errData = stderr.fileHandleForReading.readDataToEndOfFile()
        process.waitUntilExit()
        if process.terminationStatus != 0 {
            throw NSError(domain: "git", code: Int(process.terminationStatus), userInfo: [
                NSLocalizedDescriptionKey: String(data: errData, encoding: .utf8) ?? "git command failed",
            ])
        }
        return String(data: outData, encoding: .utf8) ?? ""
    }
}
