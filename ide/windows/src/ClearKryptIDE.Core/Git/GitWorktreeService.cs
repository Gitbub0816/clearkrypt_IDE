using System.Diagnostics;

namespace ClearKryptIDE.Core.Git;

/// <summary>
/// Lists, creates, and removes git worktrees for a repository, so the IDE
/// can let a developer work on several branches of the same ClearKrypt
/// project side by side, each in its own window with its own editor and
/// diagnostics state (docs: "work tree" separation).
///
/// This is a thin, testable wrapper over the real <c>git</c> CLI — no
/// libgit2 binding, no parallel implementation of git's own logic. Every
/// operation shells out to the same <c>git</c> a developer would type by
/// hand (via <see cref="ProcessStartInfo.ArgumentList"/>, so paths and
/// branch names never need manual shell-quoting), so its behavior —
/// including failure messages — matches what git itself would do.
/// </summary>
public sealed class GitWorktreeService
{
    private readonly string _repositoryPath;
    private readonly string _gitExecutable;

    public GitWorktreeService(string repositoryPath, string gitExecutable = "git")
    {
        _repositoryPath = repositoryPath;
        _gitExecutable = gitExecutable;
    }

    /// <summary>True when <paramref name="path"/> is inside a git working tree at all.</summary>
    public static bool IsGitRepository(string path, string gitExecutable = "git")
    {
        try
        {
            var (exitCode, stdout, _) = RunGit(gitExecutable, path, "rev-parse", "--is-inside-work-tree");
            return exitCode == 0 && stdout.Trim() == "true";
        }
        catch (System.ComponentModel.Win32Exception)
        {
            return false;
        }
    }

    /// <summary>Lists every worktree registered for this repository, main checkout included.</summary>
    public IReadOnlyList<GitWorktreeInfo> List()
    {
        var (exitCode, stdout, stderr) = RunGit(_gitExecutable, _repositoryPath, "worktree", "list", "--porcelain");
        if (exitCode != 0)
        {
            throw new GitWorktreeException(FriendlyFailure("list worktrees", stderr));
        }

        return ParsePorcelain(stdout);
    }

    /// <summary>
    /// Creates a new worktree at <paramref name="worktreePath"/>. When
    /// <paramref name="createBranch"/> is true, <paramref name="branch"/> is
    /// created (from <paramref name="startPoint"/>, defaulting to HEAD);
    /// otherwise <paramref name="branch"/> must already exist and is simply
    /// checked out into the new worktree.
    /// </summary>
    public GitWorktreeInfo Add(string worktreePath, string branch, string? startPoint = null, bool createBranch = true)
    {
        var arguments = new List<string> { "worktree", "add" };
        if (createBranch)
        {
            arguments.Add("-b");
            arguments.Add(branch);
            arguments.Add(worktreePath);
            if (!string.IsNullOrEmpty(startPoint))
            {
                arguments.Add(startPoint);
            }
        }
        else
        {
            arguments.Add(worktreePath);
            arguments.Add(branch);
        }

        var (exitCode, _, stderr) = RunGit(_gitExecutable, _repositoryPath, arguments.ToArray());
        if (exitCode != 0)
        {
            throw new GitWorktreeException(FriendlyFailure($"create the worktree at '{worktreePath}'", stderr));
        }

        return List().First(w => PathsMatch(w.Path, worktreePath));
    }

    /// <summary>Removes a worktree. <paramref name="force"/> discards uncommitted changes in it.</summary>
    public void Remove(string worktreePath, bool force = false)
    {
        var arguments = force
            ? new[] { "worktree", "remove", "--force", worktreePath }
            : new[] { "worktree", "remove", worktreePath };
        var (exitCode, _, stderr) = RunGit(_gitExecutable, _repositoryPath, arguments);
        if (exitCode != 0)
        {
            throw new GitWorktreeException(FriendlyFailure($"remove the worktree at '{worktreePath}'", stderr));
        }
    }

    /// <summary>Prunes administrative files for worktrees whose directory has been deleted manually.</summary>
    public void Prune()
    {
        var (exitCode, _, stderr) = RunGit(_gitExecutable, _repositoryPath, "worktree", "prune");
        if (exitCode != 0)
        {
            throw new GitWorktreeException(FriendlyFailure("prune stale worktrees", stderr));
        }
    }

    private static bool PathsMatch(string a, string b) =>
        string.Equals(
            Path.TrimEndingDirectorySeparator(Path.GetFullPath(a)),
            Path.TrimEndingDirectorySeparator(Path.GetFullPath(b)),
            StringComparison.OrdinalIgnoreCase);

    private static string FriendlyFailure(string action, string stderr)
    {
        var detail = stderr.Trim();
        return string.IsNullOrEmpty(detail)
            ? $"git could not {action}."
            : $"git could not {action}: {detail}";
    }

    /// <summary>Parses <c>git worktree list --porcelain</c> output.</summary>
    public static IReadOnlyList<GitWorktreeInfo> ParsePorcelain(string porcelain)
    {
        var result = new List<GitWorktreeInfo>();
        string? path = null;
        var commit = string.Empty;
        string? branch = null;
        var isBare = false;
        var isDetached = false;
        var isLocked = false;
        string? lockReason = null;
        var isPrunable = false;

        void Flush()
        {
            if (path is null) return;
            result.Add(new GitWorktreeInfo(path, commit, branch, isBare, isDetached, isLocked, lockReason, isPrunable));
            path = null;
            commit = string.Empty;
            branch = null;
            isBare = false;
            isDetached = false;
            isLocked = false;
            lockReason = null;
            isPrunable = false;
        }

        foreach (var rawLine in porcelain.Split('\n'))
        {
            var line = rawLine.TrimEnd('\r');
            if (line.Length == 0)
            {
                Flush();
                continue;
            }

            var spaceIndex = line.IndexOf(' ');
            var key = spaceIndex < 0 ? line : line[..spaceIndex];
            var value = spaceIndex < 0 ? string.Empty : line[(spaceIndex + 1)..];

            switch (key)
            {
                case "worktree":
                    path = value;
                    break;
                case "HEAD":
                    commit = value;
                    break;
                case "branch":
                    branch = value;
                    break;
                case "bare":
                    isBare = true;
                    break;
                case "detached":
                    isDetached = true;
                    break;
                case "locked":
                    isLocked = true;
                    lockReason = value.Length > 0 ? value : null;
                    break;
                case "prunable":
                    isPrunable = true;
                    break;
            }
        }
        Flush();

        return result;
    }

    private static (int ExitCode, string Stdout, string Stderr) RunGit(
        string executable, string workingDirectory, params string[] arguments)
    {
        var startInfo = new ProcessStartInfo(executable)
        {
            WorkingDirectory = workingDirectory,
            RedirectStandardOutput = true,
            RedirectStandardError = true,
            UseShellExecute = false,
            CreateNoWindow = true,
        };
        foreach (var argument in arguments)
        {
            startInfo.ArgumentList.Add(argument);
        }

        using var process = Process.Start(startInfo)
            ?? throw new InvalidOperationException($"Could not start '{executable}'.");
        var stdout = process.StandardOutput.ReadToEnd();
        var stderr = process.StandardError.ReadToEnd();
        process.WaitForExit();
        return (process.ExitCode, stdout, stderr);
    }
}
