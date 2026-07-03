using Avalonia;
using Avalonia.Controls.ApplicationLifetimes;
using Avalonia.Markup.Xaml;
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
            var settingsStore = AppPaths.CreateSettingsStore();
            var welcomeViewModel = new WelcomeWindowViewModel(settingsStore);
            var welcomeWindow = new WelcomeWindow { DataContext = welcomeViewModel };

            welcomeViewModel.ProjectOpened += (_, project) =>
            {
                var mainViewModel = new MainWindowViewModel(project, settingsStore);
                var mainWindow = new MainWindow { DataContext = mainViewModel };
                desktop.MainWindow = mainWindow;
                mainWindow.Show();
                welcomeWindow.Close();
            };

            desktop.MainWindow = welcomeWindow;
        }

        base.OnFrameworkInitializationCompleted();
    }
}
