namespace ClearKryptIDE.Core.Git;

/// <summary>
/// One entry from <c>git worktree list --porcelain</c>: a checkout the IDE
/// can open as its own project window, alongside every other worktree of
/// the same repository.
/// </summary>
public sealed record GitWorktreeInfo(
    string Path,
    string CommitSha,
    string? Branch,
    bool IsBare,
    bool IsDetached,
    bool IsLocked,
    string? LockReason,
    bool IsPrunable)
{
    /// <summary>The branch name without the <c>refs/heads/</c> prefix, or null when detached.</summary>
    public string? ShortBranch => Branch is null ? null : Branch.Replace("refs/heads/", string.Empty);
}
