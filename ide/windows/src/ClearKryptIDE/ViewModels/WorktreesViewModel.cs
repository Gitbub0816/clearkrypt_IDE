using System.Collections.ObjectModel;
using ClearKryptIDE.Core.Git;

namespace ClearKryptIDE.ViewModels;

/// <summary>
/// Backs the worktrees panel: lists every git worktree of the open
/// project's repository, and lets the developer create or remove one
/// without leaving the IDE. Opening a worktree hands its path back to
/// <see cref="MainWindowViewModel"/> (via <see cref="OpenRequested"/>) to
/// load in its own window, so each worktree keeps fully independent editor
/// and diagnostics state.
/// </summary>
public sealed class WorktreesViewModel : ViewModelBase
{
    private readonly GitWorktreeService _service;
    private readonly string _currentPath;
    private string _newBranchName = string.Empty;
    private string? _errorMessage;
    private bool _isBusy;

    public WorktreesViewModel(string repositoryPath, string currentWorktreePath)
    {
        _service = new GitWorktreeService(repositoryPath);
        _currentPath = currentWorktreePath;

        RefreshCommand = new RelayCommand(Refresh, () => !IsBusy);
        AddCommand = new RelayCommand(Add, () => !IsBusy && !string.IsNullOrWhiteSpace(NewBranchName));
        RemoveCommand = new RelayCommand(item => Remove(item as WorktreeItemViewModel), CanRemove);
        OpenCommand = new RelayCommand(item => Open(item as WorktreeItemViewModel), item => item is WorktreeItemViewModel);

        Refresh();
    }

    public ObservableCollection<WorktreeItemViewModel> Worktrees { get; } = new();

    public string NewBranchName
    {
        get => _newBranchName;
        set
        {
            if (SetField(ref _newBranchName, value))
            {
                AddCommand.RaiseCanExecuteChanged();
            }
        }
    }

    public string? ErrorMessage
    {
        get => _errorMessage;
        private set => SetField(ref _errorMessage, value);
    }

    public bool IsBusy
    {
        get => _isBusy;
        private set
        {
            if (SetField(ref _isBusy, value))
            {
                RefreshCommand.RaiseCanExecuteChanged();
                AddCommand.RaiseCanExecuteChanged();
            }
        }
    }

    public RelayCommand RefreshCommand { get; }

    public RelayCommand AddCommand { get; }

    public RelayCommand RemoveCommand { get; }

    public RelayCommand OpenCommand { get; }

    /// <summary>Raised with the absolute path of a worktree the user chose to open.</summary>
    public event Action<string>? OpenRequested;

    private bool CanRemove(object? parameter) =>
        !IsBusy && parameter is WorktreeItemViewModel item && !item.IsCurrent && !item.IsLocked;

    private void Refresh()
    {
        ErrorMessage = null;
        try
        {
            var worktrees = _service.List();
            Worktrees.Clear();
            foreach (var worktree in worktrees)
            {
                var isCurrent = string.Equals(
                    System.IO.Path.TrimEndingDirectorySeparator(System.IO.Path.GetFullPath(worktree.Path)),
                    System.IO.Path.TrimEndingDirectorySeparator(System.IO.Path.GetFullPath(_currentPath)),
                    StringComparison.OrdinalIgnoreCase);
                Worktrees.Add(new WorktreeItemViewModel(worktree, isCurrent));
            }
        }
        catch (GitWorktreeException ex)
        {
            ErrorMessage = ex.Message;
        }
    }

    private void Add()
    {
        var branch = NewBranchName.Trim();
        if (branch.Length == 0) return;

        IsBusy = true;
        ErrorMessage = null;
        try
        {
            var repoParent = System.IO.Path.GetDirectoryName(
                System.IO.Path.TrimEndingDirectorySeparator(_currentPath)) ?? _currentPath;
            var sanitizedFolderName = string.Join("-", branch.Split('/', '\\'));
            var worktreePath = System.IO.Path.Combine(
                repoParent, $"{System.IO.Path.GetFileName(_currentPath)}-{sanitizedFolderName}");

            _service.Add(worktreePath, branch);
            NewBranchName = string.Empty;
            Refresh();
        }
        catch (GitWorktreeException ex)
        {
            ErrorMessage = ex.Message;
        }
        finally
        {
            IsBusy = false;
        }
    }

    private void Remove(WorktreeItemViewModel? item)
    {
        if (item is null || item.IsCurrent) return;

        IsBusy = true;
        ErrorMessage = null;
        try
        {
            _service.Remove(item.Path, force: true);
            Refresh();
        }
        catch (GitWorktreeException ex)
        {
            ErrorMessage = ex.Message;
        }
        finally
        {
            IsBusy = false;
        }
    }

    private void Open(WorktreeItemViewModel? item)
    {
        if (item is null) return;
        OpenRequested?.Invoke(item.Path);
    }
}
