using Avalonia.Controls;
using Avalonia.Interactivity;
using Avalonia.Platform.Storage;
using ClearKryptIDE.ViewModels;

namespace ClearKryptIDE.Views;

public partial class WelcomeWindow : Window
{
    public WelcomeWindow()
    {
        InitializeComponent();
        DataContextChanged += OnDataContextChanged;
    }

    private WelcomeWindowViewModel? ViewModel => DataContext as WelcomeWindowViewModel;

    private void OnDataContextChanged(object? sender, EventArgs e)
    {
        if (ViewModel is { } vm)
        {
            vm.BrowseRequested += OnBrowseRequested;
        }
    }

    private async void OnBrowseRequested(object? sender, EventArgs e)
    {
        var folders = await StorageProvider.OpenFolderPickerAsync(new FolderPickerOpenOptions
        {
            Title = "Open ClearKrypt Project",
            AllowMultiple = false,
        });

        var folder = folders.Count > 0 ? folders[0].TryGetLocalPath() : null;
        if (folder is not null)
        {
            ViewModel?.TryOpenProject(folder);
        }
    }

    private void OnOpenRecentClicked(object? sender, RoutedEventArgs e)
    {
        if (RecentProjectsList.SelectedItem is string path)
        {
            ViewModel?.TryOpenProject(path);
        }
    }

    private void OnRecentProjectDoubleTapped(object? sender, Avalonia.Input.TappedEventArgs e)
    {
        if (RecentProjectsList.SelectedItem is string path)
        {
            ViewModel?.TryOpenProject(path);
        }
    }
}
