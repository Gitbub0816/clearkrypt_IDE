using ClearKryptIDE.Core.Lsp;
using ClearKryptIDE.Core.Lsp.Protocol;
using Xunit;

namespace ClearKryptIDE.Core.Tests;

/// <summary>
/// True end-to-end: the C# LSP client from this IDE talking to the REAL
/// ClearKrypt language server from this repository over stdio — the exact
/// wire path the shipped IDE uses. Requires node and the built toolchain
/// (CI runs `npm ci &amp;&amp; npm run build` first); skipped when unavailable.
/// </summary>
public sealed class LanguageServerEndToEndTests : IAsyncLifetime
{
    private string? _projectDir;
    private string? _cliBin;

    public Task InitializeAsync()
    {
        var dir = new DirectoryInfo(AppContext.BaseDirectory);
        while (dir is not null && !Directory.Exists(Path.Combine(dir.FullName, "tests", "fixtures")))
        {
            dir = dir.Parent;
        }
        if (dir is null)
        {
            return Task.CompletedTask;
        }
        var cliBin = Path.Combine(dir.FullName, "packages", "cli", "bin", "clearkrypt.js");
        var cliDist = Path.Combine(dir.FullName, "packages", "cli", "dist", "index.js");
        if (!File.Exists(cliBin) || !File.Exists(cliDist))
        {
            return Task.CompletedTask; // Toolchain not built; tests will skip.
        }
        _cliBin = cliBin;

        _projectDir = Path.Combine(Path.GetTempPath(), "ck-ide-e2e-" + Guid.NewGuid().ToString("N"));
        CopyDirectory(Path.Combine(dir.FullName, "tests", "fixtures", "projects", "hello-world"), _projectDir);
        return Task.CompletedTask;
    }

    public Task DisposeAsync()
    {
        if (_projectDir is not null && Directory.Exists(_projectDir))
        {
            Directory.Delete(_projectDir, recursive: true);
        }
        return Task.CompletedTask;
    }

    [SkippableFact]
    public async Task HandshakesOpensAndReceivesDiagnosticsFromTheRealServer()
    {
        Skip.If(_cliBin is null || _projectDir is null, "ClearKrypt toolchain not built in this environment.");

        await using var client = new LanguageServerClient();
        var published = new TaskCompletionSource<PublishDiagnosticsParams>(
            TaskCreationOptions.RunContinuationsAsynchronously);
        client.DiagnosticsPublished += (_, p) =>
        {
            if (p.Diagnostics.Count > 0)
            {
                published.TrySetResult(p);
            }
        };

        var rootUri = "file://" + _projectDir!.Replace('\\', '/');
        await client.StartAsync("node", new[] { _cliBin!, "language-server", "--stdio" }, rootUri, _projectDir);
        Assert.Equal(LanguageServerState.Ready, client.State);
        Assert.Equal("clearkrypt-language-server", client.ServerInfo?.Name);

        // Open a broken document; the server must push a CK0003 diagnostic.
        var uri = rootUri + "/src/main.ck";
        await client.DidOpenAsync(uri, "clearkrypt", 1,
            "module app.main\n\nfn f() -> String {\n  return 42\n}\n");

        var diagnostics = await published.Task.WaitAsync(TimeSpan.FromSeconds(15));
        Assert.Contains(diagnostics.Diagnostics, d => d.Code == "CK0003");

        // Symbols, project info, and the generated map per docs/21.
        await client.DidChangeAsync(uri, 2,
            "module app.main\n\nmodel Greeting {\n  id: ID\n  message: String\n}\n");
        var symbols = await client.DocumentSymbolAsync(uri);
        Assert.Contains(symbols, s => s.Name == "Greeting");

        var info = await client.ProjectInfoAsync();
        Assert.Equal("hello-world", info?.Name);

        var map = await client.GeneratedMapAsync();
        Assert.Contains(map.Modules, m => m.Module == "app.main");

        await client.ShutdownAndExitAsync();
    }

    private static void CopyDirectory(string source, string target)
    {
        Directory.CreateDirectory(target);
        foreach (var file in Directory.GetFiles(source, "*", SearchOption.AllDirectories))
        {
            var relative = Path.GetRelativePath(source, file);
            var destination = Path.Combine(target, relative);
            Directory.CreateDirectory(Path.GetDirectoryName(destination)!);
            File.Copy(file, destination);
        }
    }
}
