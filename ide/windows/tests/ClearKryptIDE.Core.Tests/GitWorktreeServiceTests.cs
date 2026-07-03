using System.Diagnostics;
using ClearKryptIDE.Core.Git;
using Xunit;

namespace ClearKryptIDE.Core.Tests;

/// <summary>
/// Exercises <see cref="GitWorktreeService"/> against a real, throwaway git
/// repository created under the OS temp directory for each test — these are
/// integration tests, not mocks, so they prove the service's behavior
/// matches what the real <c>git</c> binary actually does.
/// </summary>
public sealed class GitWorktreeServiceTests : IDisposable
{
    private readonly string _repoPath;

    public GitWorktreeServiceTests()
    {
        _repoPath = Path.Combine(Path.GetTempPath(), "ck-worktree-tests-" + Guid.NewGuid().ToString("N"));
        Directory.CreateDirectory(_repoPath);
        RunGit(_repoPath, "init", "-q", "-b", "main");
        RunGit(_repoPath, "config", "user.email", "test@example.com");
        RunGit(_repoPath, "config", "user.name", "Test");
        File.WriteAllText(Path.Combine(_repoPath, "README.md"), "hello\n");
        RunGit(_repoPath, "add", "README.md");
        RunGit(_repoPath, "commit", "-q", "-m", "initial commit");
    }

    public void Dispose()
    {
        try
        {
            // Worktrees registered under other temp directories must be removed
            // (via git) before the main repo directory can be deleted cleanly.
            var service = new GitWorktreeService(_repoPath);
            foreach (var worktree in service.List().Where(w => !PathsEqual(w.Path, _repoPath)))
            {
                try { service.Remove(worktree.Path, force: true); } catch { /* best-effort cleanup */ }
            }
        }
        catch
        {
            // Ignore cleanup failures; the temp directory is still removed below.
        }
        finally
        {
            if (Directory.Exists(_repoPath))
            {
                Directory.Delete(_repoPath, recursive: true);
            }
        }
    }

    [Fact]
    public void IsGitRepositoryIsTrueForARealRepoAndFalseOutsideOne()
    {
        Assert.True(GitWorktreeService.IsGitRepository(_repoPath));
        Assert.False(GitWorktreeService.IsGitRepository(Path.GetTempPath()));
    }

    [Fact]
    public void ListIncludesTheMainWorktreeOnABrandNewRepo()
    {
        var service = new GitWorktreeService(_repoPath);
        var worktrees = service.List();

        Assert.Single(worktrees);
        Assert.True(PathsEqual(worktrees[0].Path, _repoPath));
        Assert.Equal("refs/heads/main", worktrees[0].Branch);
        Assert.Equal("main", worktrees[0].ShortBranch);
        Assert.False(worktrees[0].IsDetached);
    }

    [Fact]
    public void AddCreatesANewBranchAndWorktree()
    {
        var service = new GitWorktreeService(_repoPath);
        var worktreePath = Path.Combine(Path.GetTempPath(), "ck-worktree-out-" + Guid.NewGuid().ToString("N"));

        var created = service.Add(worktreePath, "feature/nested-functions");

        Assert.True(PathsEqual(created.Path, worktreePath));
        Assert.Equal("refs/heads/feature/nested-functions", created.Branch);
        Assert.True(Directory.Exists(worktreePath));
        Assert.True(File.Exists(Path.Combine(worktreePath, "README.md")));

        var all = service.List();
        Assert.Equal(2, all.Count);
        Assert.Contains(all, w => PathsEqual(w.Path, worktreePath));

        service.Remove(worktreePath);
        Assert.False(Directory.Exists(worktreePath));
        Assert.Single(service.List());
    }

    [Fact]
    public void EachWorktreeIsIndependentOfTheOthers()
    {
        var service = new GitWorktreeService(_repoPath);
        var worktreePath = Path.Combine(Path.GetTempPath(), "ck-worktree-independent-" + Guid.NewGuid().ToString("N"));
        service.Add(worktreePath, "feature/independent");

        // A change staged in the linked worktree must not appear in the main one.
        File.WriteAllText(Path.Combine(worktreePath, "only-here.txt"), "scoped to this worktree\n");
        Assert.True(File.Exists(Path.Combine(worktreePath, "only-here.txt")));
        Assert.False(File.Exists(Path.Combine(_repoPath, "only-here.txt")));

        service.Remove(worktreePath, force: true);
    }

    [Fact]
    public void RemoveOfAnUnknownPathThrowsAFriendlyException()
    {
        var service = new GitWorktreeService(_repoPath);
        var missingPath = Path.Combine(Path.GetTempPath(), "ck-worktree-does-not-exist-" + Guid.NewGuid().ToString("N"));

        var ex = Assert.Throws<GitWorktreeException>(() => service.Remove(missingPath));
        Assert.Contains("remove the worktree", ex.Message);
    }

    [Fact]
    public void AddingTheSameBranchTwiceThrowsAFriendlyException()
    {
        var service = new GitWorktreeService(_repoPath);
        var firstPath = Path.Combine(Path.GetTempPath(), "ck-worktree-dup-a-" + Guid.NewGuid().ToString("N"));
        var secondPath = Path.Combine(Path.GetTempPath(), "ck-worktree-dup-b-" + Guid.NewGuid().ToString("N"));
        service.Add(firstPath, "feature/duplicate");

        var ex = Assert.Throws<GitWorktreeException>(() => service.Add(secondPath, "feature/duplicate"));
        Assert.Contains("create the worktree", ex.Message);

        service.Remove(firstPath, force: true);
    }

    [Theory]
    [InlineData(
        "worktree /repo\nHEAD abc123\nbranch refs/heads/main\n",
        1)]
    [InlineData(
        "worktree /repo\nHEAD abc123\nbranch refs/heads/main\n\nworktree /repo-2\nHEAD def456\ndetached\n",
        2)]
    public void ParsePorcelainCountsEntriesSeparatedByBlankLines(string porcelain, int expectedCount)
    {
        var parsed = GitWorktreeService.ParsePorcelain(porcelain);
        Assert.Equal(expectedCount, parsed.Count);
    }

    [Fact]
    public void ParsePorcelainReadsLockedAndPrunableFlagsWithReasons()
    {
        const string porcelain =
            "worktree /repo\n" +
            "HEAD abc123\n" +
            "branch refs/heads/main\n" +
            "\n" +
            "worktree /repo-locked\n" +
            "HEAD def456\n" +
            "detached\n" +
            "locked machine is unmounted\n" +
            "prunable gitdir file points to non-existent location\n";

        var parsed = GitWorktreeService.ParsePorcelain(porcelain);

        var main = parsed.Single(w => w.Path == "/repo");
        Assert.Equal("refs/heads/main", main.Branch);
        Assert.False(main.IsLocked);

        var locked = parsed.Single(w => w.Path == "/repo-locked");
        Assert.True(locked.IsDetached);
        Assert.True(locked.IsLocked);
        Assert.Equal("machine is unmounted", locked.LockReason);
        Assert.True(locked.IsPrunable);
    }

    private static bool PathsEqual(string a, string b) =>
        string.Equals(
            Path.TrimEndingDirectorySeparator(Path.GetFullPath(a)),
            Path.TrimEndingDirectorySeparator(Path.GetFullPath(b)),
            StringComparison.OrdinalIgnoreCase);

    private static void RunGit(string workingDirectory, params string[] arguments)
    {
        var startInfo = new ProcessStartInfo("git")
        {
            WorkingDirectory = workingDirectory,
            RedirectStandardOutput = true,
            RedirectStandardError = true,
            UseShellExecute = false,
        };
        foreach (var argument in arguments) startInfo.ArgumentList.Add(argument);

        using var process = Process.Start(startInfo)!;
        process.WaitForExit();
        if (process.ExitCode != 0)
        {
            throw new InvalidOperationException(
                $"git {string.Join(' ', arguments)} failed: {process.StandardError.ReadToEnd()}");
        }
    }
}
