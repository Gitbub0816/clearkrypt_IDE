using System.Diagnostics;
using System.Text.Json;
using ClearKryptIDE.Core.Json;
using ClearKryptIDE.Core.Lsp.JsonRpc;
using ClearKryptIDE.Core.Lsp.Protocol;

namespace ClearKryptIDE.Core.Lsp;

/// <summary>
/// Manages the lifecycle of a <c>clearkrypt language-server --stdio</c>
/// process and exposes the docs/21-language-server.md method subset as
/// typed, awaitable calls. IDE shells drive this class; it does not
/// reimplement any language understanding itself (Constitution Document 7 §4).
/// </summary>
public sealed class LanguageServerClient : IAsyncDisposable
{
    private string _command = string.Empty;
    private IReadOnlyList<string> _arguments = Array.Empty<string>();
    private string? _workingDirectory;
    private string _workspaceRootUri = string.Empty;
    private bool _stoppingIntentionally;

    private Process? _process;
    private JsonRpcConnection? _connection;

    public LanguageServerState State { get; private set; } = LanguageServerState.NotStarted;

    public ServerInfo? ServerInfo { get; private set; }

    /// <summary>Raised for every <c>textDocument/publishDiagnostics</c> notification.</summary>
    public event EventHandler<PublishDiagnosticsParams>? DiagnosticsPublished;

    public event EventHandler<LanguageServerState>? StateChanged;

    /// <summary>Raised when the connection is lost without an intentional shutdown — the crash-and-restart-offer path.</summary>
    public event EventHandler<Exception?>? Crashed;

    public event Action<string>? StandardErrorReceived;

    /// <summary>Starts the server process and runs the initialize/initialized handshake.</summary>
    public Task StartAsync(
        string command,
        IReadOnlyList<string> arguments,
        string workspaceRootUri,
        string? workingDirectory = null,
        CancellationToken cancellationToken = default)
    {
        _command = command;
        _arguments = arguments;
        _workspaceRootUri = workspaceRootUri;
        _workingDirectory = workingDirectory;
        return LaunchAsync(cancellationToken);
    }

    /// <summary>Re-launches the server with the same command/arguments used in <see cref="StartAsync"/> — the restart offer.</summary>
    public Task RestartAsync(CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrEmpty(_command))
        {
            throw new InvalidOperationException("Cannot restart before the language server has been started once.");
        }

        return LaunchAsync(cancellationToken);
    }

    private async Task LaunchAsync(CancellationToken cancellationToken)
    {
        SetState(LanguageServerState.Starting);
        _stoppingIntentionally = false;

        var startInfo = new ProcessStartInfo(_command)
        {
            WorkingDirectory = _workingDirectory ?? Environment.CurrentDirectory,
            RedirectStandardInput = true,
            RedirectStandardOutput = true,
            RedirectStandardError = true,
            UseShellExecute = false,
            CreateNoWindow = true,
        };

        foreach (var argument in _arguments)
        {
            startInfo.ArgumentList.Add(argument);
        }

        var process = new Process { StartInfo = startInfo, EnableRaisingEvents = true };

        try
        {
            if (!process.Start())
            {
                SetState(LanguageServerState.Crashed);
                throw new InvalidOperationException($"Failed to start language server process '{_command}'.");
            }
        }
        catch (Exception ex) when (ex is not InvalidOperationException)
        {
            SetState(LanguageServerState.Crashed);
            throw new InvalidOperationException($"Failed to start language server process '{_command}'.", ex);
        }

        _process = process;
        _ = PumpStandardErrorAsync(process);

        var connection = new JsonRpcConnection(process.StandardOutput.BaseStream, process.StandardInput.BaseStream);
        connection.NotificationReceived += OnNotificationReceived;
        connection.Disconnected += OnDisconnected;
        _connection = connection;

        var initializeResult = await connection
            .SendRequestAsync("initialize", BuildInitializeParams(), cancellationToken)
            .ConfigureAwait(false);
        ServerInfo = ParseServerInfo(initializeResult);

        await connection.SendNotificationAsync("initialized", new { }).ConfigureAwait(false);

        SetState(LanguageServerState.Ready);
    }

    private object BuildInitializeParams() => new
    {
        processId = Environment.ProcessId,
        rootUri = _workspaceRootUri,
        capabilities = new
        {
            textDocument = new
            {
                synchronization = new { dynamicRegistration = false },
                publishDiagnostics = new { relatedInformation = false },
                documentSymbol = new { hierarchicalDocumentSymbolSupport = true },
                hover = new { },
                completion = new { },
                formatting = new { },
                semanticTokens = new
                {
                    requests = new { full = true },
                    tokenTypes = SemanticTokenLegend.TokenTypes,
                    tokenModifiers = SemanticTokenLegend.TokenModifiers,
                    formats = new[] { "relative" },
                },
            },
        },
    };

    public Task DidOpenAsync(string uri, string languageId, int version, string text)
    {
        EnsureConnected();
        return _connection!.SendNotificationAsync("textDocument/didOpen", new
        {
            textDocument = new { uri, languageId, version, text },
        });
    }

    /// <summary>Full-sync change notification (docs/21: TextDocumentSyncKind.Full; incremental is a later milestone).</summary>
    public Task DidChangeAsync(string uri, int version, string fullText)
    {
        EnsureConnected();
        return _connection!.SendNotificationAsync("textDocument/didChange", new
        {
            textDocument = new { uri, version },
            contentChanges = new object[] { new { text = fullText } },
        });
    }

    public Task DidCloseAsync(string uri)
    {
        EnsureConnected();
        return _connection!.SendNotificationAsync("textDocument/didClose", new { textDocument = new { uri } });
    }

    public Task DidSaveAsync(string uri)
    {
        EnsureConnected();
        return _connection!.SendNotificationAsync("textDocument/didSave", new { textDocument = new { uri } });
    }

    public async Task<IReadOnlyList<DocumentSymbol>> DocumentSymbolAsync(string uri, CancellationToken cancellationToken = default)
    {
        EnsureConnected();
        var result = await _connection!
            .SendRequestAsync("textDocument/documentSymbol", new { textDocument = new { uri } }, cancellationToken)
            .ConfigureAwait(false);
        return Deserialize<List<DocumentSymbol>>(result) ?? new List<DocumentSymbol>();
    }

    public async Task<Hover?> HoverAsync(string uri, Position position, CancellationToken cancellationToken = default)
    {
        EnsureConnected();
        var result = await _connection!
            .SendRequestAsync("textDocument/hover", new { textDocument = new { uri }, position }, cancellationToken)
            .ConfigureAwait(false);
        return result.ValueKind is JsonValueKind.Null or JsonValueKind.Undefined ? null : Deserialize<Hover>(result);
    }

    public async Task<IReadOnlyList<CompletionItem>> CompletionAsync(string uri, Position position, CancellationToken cancellationToken = default)
    {
        EnsureConnected();
        var result = await _connection!
            .SendRequestAsync("textDocument/completion", new { textDocument = new { uri }, position }, cancellationToken)
            .ConfigureAwait(false);

        if (result.ValueKind == JsonValueKind.Array)
        {
            return Deserialize<List<CompletionItem>>(result) ?? new List<CompletionItem>();
        }

        if (result.ValueKind == JsonValueKind.Object && result.TryGetProperty("items", out var items))
        {
            return Deserialize<List<CompletionItem>>(items) ?? new List<CompletionItem>();
        }

        return Array.Empty<CompletionItem>();
    }

    public async Task<IReadOnlyList<TextEdit>> FormattingAsync(string uri, CancellationToken cancellationToken = default)
    {
        EnsureConnected();
        var result = await _connection!
            .SendRequestAsync(
                "textDocument/formatting",
                new { textDocument = new { uri }, options = new { tabSize = 2, insertSpaces = true } },
                cancellationToken)
            .ConfigureAwait(false);
        return Deserialize<List<TextEdit>>(result) ?? new List<TextEdit>();
    }

    public async Task<SemanticTokens?> SemanticTokensFullAsync(string uri, CancellationToken cancellationToken = default)
    {
        EnsureConnected();
        var result = await _connection!
            .SendRequestAsync("textDocument/semanticTokens/full", new { textDocument = new { uri } }, cancellationToken)
            .ConfigureAwait(false);
        return result.ValueKind is JsonValueKind.Null or JsonValueKind.Undefined ? null : Deserialize<SemanticTokens>(result);
    }

    public async Task<ProjectInfo?> ProjectInfoAsync(CancellationToken cancellationToken = default)
    {
        EnsureConnected();
        var result = await _connection!.SendRequestAsync("clearkrypt/projectInfo", new { }, cancellationToken).ConfigureAwait(false);
        return Deserialize<ProjectInfo>(result);
    }

    public async Task<CheckResult> CheckAsync(CancellationToken cancellationToken = default)
    {
        EnsureConnected();
        var result = await _connection!.SendRequestAsync("clearkrypt/check", new { }, cancellationToken).ConfigureAwait(false);
        return Deserialize<CheckResult>(result) ?? new CheckResult(Array.Empty<CheckDiagnostic>());
    }

    public async Task<GeneratedMap> GeneratedMapAsync(CancellationToken cancellationToken = default)
    {
        EnsureConnected();
        var result = await _connection!.SendRequestAsync("clearkrypt/generatedMap", new { }, cancellationToken).ConfigureAwait(false);
        return Deserialize<GeneratedMap>(result) ?? new GeneratedMap(Array.Empty<GeneratedModule>());
    }

    /// <summary>Runs the shutdown/exit lifecycle. Marks the disconnect as intentional so it is not reported as a crash.</summary>
    public async Task ShutdownAndExitAsync(CancellationToken cancellationToken = default)
    {
        if (_connection is null)
        {
            return;
        }

        _stoppingIntentionally = true;
        SetState(LanguageServerState.ShuttingDown);

        try
        {
            await _connection.SendRequestAsync("shutdown", null, cancellationToken).ConfigureAwait(false);
        }
        catch
        {
            // Best-effort: proceed to exit even if shutdown failed or timed out.
        }

        await _connection.SendNotificationAsync("exit", null).ConfigureAwait(false);
        SetState(LanguageServerState.Stopped);
    }

    private void OnNotificationReceived(string method, JsonElement? paramsElement)
    {
        if (method != "textDocument/publishDiagnostics" || paramsElement is not { } element)
        {
            return;
        }

        var parsed = Deserialize<PublishDiagnosticsParams>(element);
        if (parsed is not null)
        {
            DiagnosticsPublished?.Invoke(this, parsed);
        }
    }

    private void OnDisconnected(Exception? failure)
    {
        if (_stoppingIntentionally)
        {
            SetState(LanguageServerState.Stopped);
            return;
        }

        SetState(LanguageServerState.Crashed);
        Crashed?.Invoke(this, failure);
    }

    private async Task PumpStandardErrorAsync(Process process)
    {
        try
        {
            string? line;
            while ((line = await process.StandardError.ReadLineAsync().ConfigureAwait(false)) is not null)
            {
                StandardErrorReceived?.Invoke(line);
            }
        }
        catch
        {
            // The process has most likely exited; OnDisconnected handles that path.
        }
    }

    private void SetState(LanguageServerState newState)
    {
        State = newState;
        StateChanged?.Invoke(this, newState);
    }

    private void EnsureConnected()
    {
        if (_connection is null)
        {
            throw new InvalidOperationException("The language server has not been started.");
        }
    }

    private static ServerInfo? ParseServerInfo(JsonElement result)
    {
        if (result.ValueKind != JsonValueKind.Object || !result.TryGetProperty("serverInfo", out var info) ||
            info.ValueKind != JsonValueKind.Object)
        {
            return null;
        }

        var name = info.TryGetProperty("name", out var n) ? n.GetString() : null;
        var version = info.TryGetProperty("version", out var v) ? v.GetString() : null;
        return new ServerInfo(name, version);
    }

    private static T? Deserialize<T>(JsonElement element)
    {
        return element.ValueKind == JsonValueKind.Undefined
            ? default
            : JsonSerializer.Deserialize<T>(element.GetRawText(), JsonOptions.Default);
    }

    public async ValueTask DisposeAsync()
    {
        _stoppingIntentionally = true;

        if (_connection is not null)
        {
            await _connection.DisposeAsync().ConfigureAwait(false);
        }

        if (_process is not null)
        {
            try
            {
                if (!_process.HasExited)
                {
                    _process.Kill(entireProcessTree: true);
                }
            }
            catch
            {
                // Process may have already exited between the check and Kill.
            }

            _process.Dispose();
        }
    }
}
