using Avalonia.Controls;
using Avalonia.Interactivity;
using ClearKryptIDE.Core.Settings;

namespace ClearKryptIDE.Views;

public partial class SettingsWindow : Window
{
    private readonly SettingsStore _store;

    // Parameterless ctor keeps the XAML previewer happy.
    public SettingsWindow()
        : this(Services.AppPaths.CreateSettingsStore())
    {
    }

    public SettingsWindow(SettingsStore store)
    {
        InitializeComponent();
        _store = store;
        SdkPathBox.Text = store.Load().ClearKryptSdkPath ?? string.Empty;
    }

    private void OnCancelClicked(object? sender, RoutedEventArgs e) => Close();

    private void OnSaveClicked(object? sender, RoutedEventArgs e)
    {
        var settings = _store.Load();
        settings.ClearKryptSdkPath =
            string.IsNullOrWhiteSpace(SdkPathBox.Text) ? null : SdkPathBox.Text.Trim();
        _store.Save(settings);
        Close();
    }
}
