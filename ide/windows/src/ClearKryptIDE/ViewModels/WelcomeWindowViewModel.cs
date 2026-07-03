using System.Collections.ObjectModel;
using ClearKryptIDE.Core.Project;
using ClearKryptIDE.Core.Settings;

namespace ClearKryptIDE.ViewModels;

/// <summary>
/// Backs the Welcome window: recent projects plus an Open Project folder
/// picker. Folder browsing itself is IO owned by the view (code-behind);
/// this view model only validates the chosen folder as a ClearKrypt project
/// (docs/04-native-ide-architecture.md MVP: "Open a ClearKrypt project").
/// </summary>
public sealed class WelcomeWindowViewModel : ViewModelBase
{
    private readonly SettingsStore _settingsStore;
    private string? _errorMessage;

    public WelcomeWindowViewModel(SettingsStore settingsStore)
    {
        _settingsStore = settingsStore;

        RecentProjects = new ObservableCollection<string>(settingsStore.Load().RecentProjects);
        BrowseCommand = new RelayCommand(RequestBrowse);
        OpenRecentCommand = new RelayCommand(path => TryOpenProject((string)path!));
    }

    public ObservableCollection<string> RecentProjects { get; }

    public string? ErrorMessage
    {
        get => _errorMessage;
        private set => SetField(ref _errorMessage, value);
    }

    public RelayCommand BrowseCommand { get; }

    public RelayCommand OpenRecentCommand { get; }

    /// <summary>Raised when the view should show a native folder picker; the view then calls <see cref="TryOpenProject"/>.</summary>
    public event EventHandler? BrowseRequested;

    /// <summary>Raised once a folder has been validated as a ClearKrypt project and should replace this window with the main IDE window.</summary>
    public event EventHandler<ClearKryptProject>? ProjectOpened;

    private void RequestBrowse() => BrowseRequested?.Invoke(this, EventArgs.Empty);

    public void TryOpenProject(string folderPath)
    {
        try
        {
            var project = ClearKryptProject.Load(folderPath);
            ErrorMessage = null;
            _settingsStore.AddRecentProject(folderPath);
            ProjectOpened?.Invoke(this, project);
        }
        catch (ClearKryptProjectException ex)
        {
            ErrorMessage = ex.Message;
        }
    }
}
