using System.Collections.ObjectModel;
using Avalonia.Threading;
using ClearKryptIDE.Core.Cli;
using ClearKryptIDE.Core.Lsp;
using ClearKryptIDE.Core.Lsp.Protocol;
using ClearKryptIDE.Core.Project;
using ClearKryptIDE.Core.Sdk;
using ClearKryptIDE.Core.Settings;

namespace ClearKryptIDE.ViewModels;

/// <summary>
/// Backs the main IDE window: project tree, editor tabs, diagnostics panel,
/// build panel, target selection, and the language-server lifecycle.
/// Language intelligence flows through the LSP client; build actions flow
/// through the CLI (docs/04-native-ide-architecture.md).
/// </summary>
public sealed class MainWindowViewModel : ViewModelBase
{
    private readonly SettingsStore _settingsStore;
    private readonly Dictionary<string, IReadOnlyList<DiagnosticItemViewModel>> _lspDiagnosticsByUri = new();
    private readonly Dictionary<string, CancellationTokenSource> _changeDebounces = new();
    private IReadOnlyList<DiagnosticItemViewModel> _cliDiagnostics = Array.Empty<DiagnosticItemViewModel>();
    private EditorDocumentViewModel? _selectedDocument;
    private string _serverStatus = "starting";
    private bool _serverCrashed;
    private bool _isBuildRunning;
    private string _buildOutput = string.Empty;
    private bool _targetSwift;
    private bool _targetKotlin;
    private bool _targetReact;

    public MainWindowViewModel(ClearKryptProject project, SettingsStore settingsStore)
    {
        Project = project;
        _settingsStore = settingsStore;
        _targetSwift = project.Targets.Swift;
        _targetKotlin = project.Targets.Kotlin;
        _targetReact = project.Targets.React;

        ProjectRootUri = ToUri(project.RootPath);
        Root = new ObservableCollection<ProjectNodeViewModel>(
            project.BuildFileTree().Select(n => new ProjectNodeViewModel(n)));

        LanguageServer = new LanguageServerClient();
        LanguageServer.DiagnosticsPublished += OnDiagnosticsPublished;
        LanguageServer.StateChanged += OnServerStateChanged;

        CheckCommand = new AsyncRelayCommand(() => RunCliAsync(build: false), () => !IsBuildRunning);
        BuildCommand = new AsyncRelayCommand(() => RunCliAsync(build: true), () => !IsBuildRunning);
        RestartServerCommand = new AsyncRelayCommand(RestartServerAsync);
        SaveCommand = new AsyncRelayCommand(SaveSelectedDocumentAsync);
    }

    public ClearKryptProject Project { get; }

    public string ProjectRootUri { get; }

    public string WindowTitle => $"{Project.Name} — ClearKrypt IDE";

    public ObservableCollection<ProjectNodeViewModel> Root { get; }

    public ObservableCollection<EditorDocumentViewModel> Documents { get; } = new();

    public ObservableCollection<DiagnosticItemViewModel> Diagnostics { get; } = new();

    public ObservableCollection<SymbolNodeViewModel> Outline { get; } = new();

    public LanguageServerClient LanguageServer { get; }

    public AsyncRelayCommand CheckCommand { get; }

    public AsyncRelayCommand BuildCommand { get; }

    public AsyncRelayCommand RestartServerCommand { get; }

    public AsyncRelayCommand SaveCommand { get; }

    /// <summary>Raised when diagnostics change for a uri so open editors can redraw underlines.</summary>
    public event Action<string>? DocumentDiagnosticsChanged;

    /// <summary>Raised when a diagnostics row is activated so the window can focus the span.</summary>
    public event Action<DiagnosticItemViewModel>? NavigationRequested;

    public EditorDocumentViewModel? SelectedDocument
    {
        get => _selectedDocument;
        set
        {
            if (SetField(ref _selectedDocument, value))
            {
                _ = RefreshOutlineAsync();
            }
        }
    }

    public string ServerStatus
    {
        get => _serverStatus;
        private set => SetField(ref _serverStatus, value);
    }

    public bool ServerCrashed
    {
        get => _serverCrashed;
        private set => SetField(ref _serverCrashed, value);
    }

    public bool IsBuildRunning
    {
        get => _isBuildRunning;
        private set
        {
            if (SetField(ref _isBuildRunning, value))
            {
                CheckCommand.RaiseCanExecuteChanged();
                BuildCommand.RaiseCanExecuteChanged();
            }
        }
    }

    public string BuildOutput
    {
        get => _buildOutput;
        private set => SetField(ref _buildOutput, value);
    }

    public bool TargetSwift
    {
        get => _targetSwift;
        set => SetField(ref _targetSwift, value);
    }

    public bool TargetKotlin
    {
        get => _targetKotlin;
        set => SetField(ref _targetKotlin, value);
    }

    public bool TargetReact
    {
        get => _targetReact;
        set => SetField(ref _targetReact, value);
    }

    // -- Lifecycle -----------------------------------------------------------

    public async Task StartLanguageServerAsync()
    {
        var command = ResolveSdkCommand();
        if (command is null)
        {
            ServerStatus = "SDK not found — set the path in Settings or add clearkrypt to PATH";
            ServerCrashed = true;
            return;
        }
        try
        {
            await LanguageServer.StartAsync(command, new[] { "language-server", "--stdio" }, ProjectRootUri, Project.RootPath);
        }
        catch (Exception ex)
        {
            ServerStatus = $"failed to start: {ex.Message}";
            ServerCrashed = true;
        }
    }

    private async Task RestartServerAsync()
    {
        try
        {
            await LanguageServer.RestartAsync();
            foreach (var document in Documents.Where(d => d.IsClearKryptSource))
            {
                await LanguageServer.DidOpenAsync(document.Uri, "clearkrypt", document.Version, document.Document.Text);
            }
        }
        catch (Exception ex)
        {
            ServerStatus = $"restart failed: {ex.Message}";
        }
    }

    private string? ResolveSdkCommand()
    {
        var settings = _settingsStore.Load();
        return new ClearKryptSdkResolver().Resolve(settings.ClearKryptSdkPath);
    }

    // -- Documents -----------------------------------------------------------

    public async Task OpenFileAsync(ProjectNodeViewModel node)
    {
        if (node.IsDirectory)
        {
            return;
        }
        var absolute = Path.Combine(Project.RootPath, node.Node.RelativePath.Replace('/', Path.DirectorySeparatorChar));
        var existing = Documents.FirstOrDefault(d => d.AbsolutePath == absolute);
        if (existing is not null)
        {
            SelectedDocument = existing;
            return;
        }
        string text;
        try
        {
            text = await File.ReadAllTextAsync(absolute);
        }
        catch (IOException)
        {
            return;
        }
        var document = new EditorDocumentViewModel(absolute, node.Node.RelativePath, ToUri(absolute), node.IsReadOnly, text);
        Documents.Add(document);
        SelectedDocument = document;
        if (document.IsClearKryptSource && LanguageServer.State == LanguageServerState.Ready)
        {
            await LanguageServer.DidOpenAsync(document.Uri, "clearkrypt", document.Version, text);
        }
    }

    public void CloseDocument(EditorDocumentViewModel document)
    {
        Documents.Remove(document);
        if (SelectedDocument == document)
        {
            SelectedDocument = Documents.LastOrDefault();
        }
        if (document.IsClearKryptSource && LanguageServer.State == LanguageServerState.Ready)
        {
            _ = LanguageServer.DidCloseAsync(document.Uri);
        }
    }

    /// <summary>Called by the editor host on every text change; debounced before didChange.</summary>
    public void NotifyDocumentChanged(EditorDocumentViewModel document)
    {
        document.IsDirty = true;
        if (!document.IsClearKryptSource)
        {
            return;
        }
        if (_changeDebounces.TryGetValue(document.Uri, out var previous))
        {
            previous.Cancel();
        }
        var cts = new CancellationTokenSource();
        _changeDebounces[document.Uri] = cts;
        _ = DebouncedDidChangeAsync(document, cts.Token);
    }

    private async Task DebouncedDidChangeAsync(EditorDocumentViewModel document, CancellationToken token)
    {
        try
        {
            await Task.Delay(300, token);
        }
        catch (TaskCanceledException)
        {
            return;
        }
        if (LanguageServer.State == LanguageServerState.Ready)
        {
            document.Version++;
            await LanguageServer.DidChangeAsync(document.Uri, document.Version, document.Document.Text);
            await RefreshOutlineAsync();
        }
    }

    private async Task SaveSelectedDocumentAsync()
    {
        var document = SelectedDocument;
        if (document is null || document.IsReadOnly)
        {
            return;
        }
        await File.WriteAllTextAsync(document.AbsolutePath, document.Document.Text);
        document.IsDirty = false;
        if (document.IsClearKryptSource && LanguageServer.State == LanguageServerState.Ready)
        {
            await LanguageServer.DidSaveAsync(document.Uri);
        }
    }

    // -- Diagnostics ----------------------------------------------------------

    private void OnDiagnosticsPublished(object? sender, PublishDiagnosticsParams published)
    {
        Dispatcher.UIThread.Post(() =>
        {
            var display = DisplayPathFor(published.Uri);
            _lspDiagnosticsByUri[published.Uri] = published.Diagnostics
                .Select(d => DiagnosticItemViewModel.FromLsp(published.Uri, display, d))
                .ToList();
            RebuildDiagnosticsList();
            DocumentDiagnosticsChanged?.Invoke(published.Uri);
        });
    }

    public IReadOnlyList<DiagnosticItemViewModel> DiagnosticsForUri(string uri) =>
        _lspDiagnosticsByUri.TryGetValue(uri, out var list) ? list : Array.Empty<DiagnosticItemViewModel>();

    public void RequestNavigation(DiagnosticItemViewModel item) => NavigationRequested?.Invoke(item);

    private void RebuildDiagnosticsList()
    {
        Diagnostics.Clear();
        foreach (var item in _lspDiagnosticsByUri.Values
                     .SelectMany(list => list)
                     .Concat(_cliDiagnostics)
                     .OrderBy(d => d.FileDisplayPath)
                     .ThenBy(d => d.Line))
        {
            Diagnostics.Add(item);
        }
    }

    private string DisplayPathFor(string uri)
    {
        return uri.StartsWith(ProjectRootUri, StringComparison.Ordinal)
            ? uri[ProjectRootUri.Length..].TrimStart('/')
            : uri;
    }

    // -- Build ----------------------------------------------------------------

    private async Task RunCliAsync(bool build)
    {
        var command = ResolveSdkCommand();
        if (command is null)
        {
            BuildOutput = "ClearKrypt SDK not found. Set the SDK path in Settings or add clearkrypt to PATH.";
            return;
        }
        IsBuildRunning = true;
        BuildOutput = build ? "Building…\n" : "Checking…\n";
        try
        {
            var runner = new CliRunner(command);
            runner.OutputLineReceived += line =>
                Dispatcher.UIThread.Post(() => BuildOutput += line.Text + "\n");

            var targets = SelectedTargets();
            var result = build
                ? await runner.BuildAsync(Project.RootPath, targets)
                : await runner.CheckAsync(Project.RootPath, targets);

            _cliDiagnostics = result.Result?.Diagnostics
                ?.Select(d => DiagnosticItemViewModel.FromCli(ProjectRootUri, d))
                .ToList() ?? (IReadOnlyList<DiagnosticItemViewModel>)Array.Empty<DiagnosticItemViewModel>();
            RebuildDiagnosticsList();

            var generated = result.Result?.GeneratedFiles?.Count ?? 0;
            BuildOutput += result.ExitCode switch
            {
                0 when build => $"Build succeeded. {generated} files generated.\n",
                0 => "Check passed. No problems found.\n",
                1 => "Completed with errors — see the Diagnostics panel.\n",
                64 => "Usage error:\n" + result.RawStderr,
                70 => "Internal compiler error:\n" + result.RawStderr,
                _ => $"Unexpected exit code {result.ExitCode}.\n" + result.RawStderr,
            };
            if (build && result.ExitCode == 0)
            {
                RefreshProjectTree();
            }
        }
        catch (Exception ex)
        {
            BuildOutput += $"Failed to run clearkrypt: {ex.Message}\n";
        }
        finally
        {
            IsBuildRunning = false;
        }
    }

    private IReadOnlyList<string> SelectedTargets()
    {
        var targets = new List<string>();
        if (TargetSwift) targets.Add("swift");
        if (TargetKotlin) targets.Add("kotlin");
        if (TargetReact) targets.Add("react");
        return targets;
    }

    private void RefreshProjectTree()
    {
        try
        {
            var reloaded = ClearKryptProject.Load(Project.RootPath);
            Root.Clear();
            foreach (var node in reloaded.BuildFileTree())
            {
                Root.Add(new ProjectNodeViewModel(node));
            }
        }
        catch (ClearKryptProjectException)
        {
            // The tree keeps its previous shape if the reload races a build.
        }
    }

    // -- Outline ----------------------------------------------------------------

    private async Task RefreshOutlineAsync()
    {
        var document = SelectedDocument;
        Outline.Clear();
        if (document is null || !document.IsClearKryptSource || LanguageServer.State != LanguageServerState.Ready)
        {
            return;
        }
        try
        {
            var symbols = await LanguageServer.DocumentSymbolAsync(document.Uri);
            Dispatcher.UIThread.Post(() =>
            {
                Outline.Clear();
                foreach (var symbol in symbols)
                {
                    Outline.Add(new SymbolNodeViewModel(symbol));
                }
            });
        }
        catch (Exception)
        {
            // Outline is best-effort; a crashed server already shows in the status bar.
        }
    }

    private void OnServerStateChanged(object? sender, LanguageServerState state)
    {
        Dispatcher.UIThread.Post(() =>
        {
            ServerStatus = state switch
            {
                LanguageServerState.NotStarted => "not started",
                LanguageServerState.Starting => "starting",
                LanguageServerState.Ready => "ready",
                LanguageServerState.Crashed => "crashed — Restart to recover",
                LanguageServerState.Stopped => "stopped",
                _ => state.ToString(),
            };
            ServerCrashed = state == LanguageServerState.Crashed;
            if (state == LanguageServerState.Ready)
            {
                foreach (var document in Documents.Where(d => d.IsClearKryptSource))
                {
                    _ = LanguageServer.DidOpenAsync(document.Uri, "clearkrypt", document.Version, document.Document.Text);
                }
            }
        });
    }

    public async Task ShutdownAsync()
    {
        try
        {
            await LanguageServer.ShutdownAndExitAsync();
        }
        catch (Exception)
        {
            // Closing anyway; the client disposes the process.
        }
        await LanguageServer.DisposeAsync();
    }

    private static string ToUri(string absolutePath) =>
        "file://" + absolutePath.Replace('\\', '/');
}
