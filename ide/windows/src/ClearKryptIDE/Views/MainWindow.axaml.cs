using Avalonia.Controls;
using Avalonia.Input;
using Avalonia.Interactivity;
using ClearKryptIDE.Services;
using ClearKryptIDE.ViewModels;

namespace ClearKryptIDE.Views;

public partial class MainWindow : Window
{
    private bool _closeRequested;

    public MainWindow()
    {
        InitializeComponent();
        Opened += OnOpened;
        Closing += OnClosing;
        DataContextChanged += OnDataContextChanged;
    }

    private MainWindowViewModel? ViewModel => DataContext as MainWindowViewModel;

    private void OnDataContextChanged(object? sender, EventArgs e)
    {
        if (ViewModel is { } vm)
        {
            vm.NavigationRequested += OnNavigationRequested;
        }
    }

    private async void OnOpened(object? sender, EventArgs e)
    {
        if (ViewModel is { } vm)
        {
            await vm.StartLanguageServerAsync();
        }
    }

    private async void OnClosing(object? sender, WindowClosingEventArgs e)
    {
        if (_closeRequested || ViewModel is not { } vm)
        {
            return;
        }
        e.Cancel = true;
        _closeRequested = true;
        await vm.ShutdownAsync();
        Close();
    }

    private async void OnProjectTreeDoubleTapped(object? sender, TappedEventArgs e)
    {
        if (ProjectTree.SelectedItem is ProjectNodeViewModel node && ViewModel is { } vm)
        {
            await vm.OpenFileAsync(node);
        }
    }

    private void OnCloseTabClicked(object? sender, RoutedEventArgs e)
    {
        if (sender is Button { DataContext: EditorDocumentViewModel document } && ViewModel is { } vm)
        {
            vm.CloseDocument(document);
        }
    }

    private void OnOutlineDoubleTapped(object? sender, TappedEventArgs e)
    {
        if (OutlineTree.SelectedItem is SymbolNodeViewModel symbol &&
            ViewModel?.SelectedDocument is { } document)
        {
            document.RequestNavigate(
                symbol.Symbol.SelectionRange.Start.Line,
                symbol.Symbol.SelectionRange.Start.Character);
        }
    }

    private void OnDiagnosticDoubleTapped(object? sender, TappedEventArgs e)
    {
        if (DiagnosticsList.SelectedItem is DiagnosticItemViewModel item)
        {
            _ = NavigateToDiagnosticAsync(item);
        }
    }

    private async Task NavigateToDiagnosticAsync(DiagnosticItemViewModel item)
    {
        if (ViewModel is not { } vm)
        {
            return;
        }
        // Find the tree node for the diagnostic's file and open it, then move the caret.
        var node = FindNodeByUri(vm.Root, item.Uri, vm.ProjectRootUri);
        if (node is not null)
        {
            await vm.OpenFileAsync(node);
        }
        vm.SelectedDocument?.RequestNavigate(item.Line, item.Character);
    }

    private void OnNavigationRequested(DiagnosticItemViewModel item) => _ = NavigateToDiagnosticAsync(item);

    private static ProjectNodeViewModel? FindNodeByUri(
        IEnumerable<ProjectNodeViewModel> nodes,
        string uri,
        string rootUri)
    {
        var relative = uri.StartsWith(rootUri, StringComparison.Ordinal)
            ? uri[rootUri.Length..].TrimStart('/')
            : uri;
        foreach (var node in nodes)
        {
            if (!node.IsDirectory && node.Node.RelativePath == relative)
            {
                return node;
            }
            var child = FindNodeByUri(node.Children, uri, rootUri);
            if (child is not null)
            {
                return child;
            }
        }
        return null;
    }

    private async void OnSettingsClicked(object? sender, RoutedEventArgs e)
    {
        var settings = new SettingsWindow(AppPaths.CreateSettingsStore());
        await settings.ShowDialog(this);
    }
}
