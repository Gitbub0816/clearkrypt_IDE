using Avalonia;
using Avalonia.Controls;
using Avalonia.Controls.ApplicationLifetimes;
using Avalonia.Markup.Xaml;
using ClearKryptIDE.Core.Project;
using ClearKryptIDE.Services;
using ClearKryptIDE.ViewModels;
using ClearKryptIDE.Views;

namespace ClearKryptIDE;

public sealed class App : Application
{
    public override void Initialize()
    {
        AvaloniaXamlLoader.Load(this);
    }

    public override void OnFrameworkInitializationCompleted()
    {
        if (ApplicationLifetime is IClassicDesktopStyleApplicationLifetime desktop)
        {
            // Multiple worktrees can each have their own open window now; the
            // app should exit when the last one closes, not whichever one
            // happened to be first (the default OnMainWindowClose).
            desktop.ShutdownMode = ShutdownMode.OnLastWindowClose;

            var settingsStore = AppPaths.CreateSettingsStore();
            var welcomeViewModel = new WelcomeWindowViewModel(settingsStore);
            var welcomeWindow = new WelcomeWindow { DataContext = welcomeViewModel };

            welcomeViewModel.ProjectOpened += (_, project) =>
            {
                OpenProjectWindow(project, settingsStore);
                welcomeWindow.Close();
            };

            desktop.MainWindow = welcomeWindow;
        }

        base.OnFrameworkInitializationCompleted();
    }

    /// <summary>
    /// Opens one window per project root. Each git worktree of a repository
    /// is just another root on disk, so switching to one is opening another
    /// window here — every worktree keeps fully independent editor,
    /// diagnostics, and language-server state, with none of them blocked on
    /// the others.
    /// </summary>
    private static void OpenProjectWindow(ClearKryptProject project, Core.Settings.SettingsStore settingsStore)
    {
        var mainViewModel = new MainWindowViewModel(project, settingsStore);
        var mainWindow = new MainWindow { DataContext = mainViewModel };
        mainViewModel.WorktreeOpenRequested += path =>
        {
            var worktreeProject = ClearKryptProject.Load(path);
            OpenProjectWindow(worktreeProject, settingsStore);
        };
        mainWindow.Show();
    }
}
