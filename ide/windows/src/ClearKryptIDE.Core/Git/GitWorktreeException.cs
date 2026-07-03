namespace ClearKryptIDE.Core.Git;

/// <summary>
/// Thrown when a git worktree operation fails. The message wraps git's own
/// stderr output so the IDE can show it directly to the user (Constitution
/// Document 7: friendly, actionable diagnostics apply to every IDE surface,
/// not just compiler ones).
/// </summary>
public sealed class GitWorktreeException : Exception
{
    public GitWorktreeException(string message)
        : base(message)
    {
    }

    public GitWorktreeException(string message, Exception innerException)
        : base(message, innerException)
    {
    }
}
