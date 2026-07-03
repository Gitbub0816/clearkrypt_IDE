using ClearKryptIDE.Core.Git;

namespace ClearKryptIDE.ViewModels;

/// <summary>One row in the worktrees panel.</summary>
public sealed class WorktreeItemViewModel : ViewModelBase
{
    public WorktreeItemViewModel(GitWorktreeInfo info, bool isCurrent)
    {
        Path = info.Path;
        BranchLabel = info.ShortBranch ?? $"detached @ {ShortSha(info.CommitSha)}";
        IsCurrent = isCurrent;
        IsLocked = info.IsLocked;
        LockReason = info.LockReason;
    }

    public string Path { get; }

    public string BranchLabel { get; }

    public bool IsCurrent { get; }

    public bool IsLocked { get; }

    public string? LockReason { get; }

    public string DisplayName => System.IO.Path.GetFileName(Path.TrimEnd('/', '\\'));

    private static string ShortSha(string sha) => sha.Length > 7 ? sha[..7] : sha;
}
