using System.Diagnostics;
using System.Text.Json;
using ClearKryptIDE.Core.Json;

namespace ClearKryptIDE.Core.Cli;

/// <summary>
/// Runs <c>clearkrypt check --json</c> / <c>build --json</c> as a child
/// process and parses the CLI JSON contract from
/// docs/21-language-server.md. Build actions go through the CLI; language
/// intelligence goes through <see cref="Lsp.LanguageServerClient"/> — the two
/// are deliberately separate per docs/04-native-ide-architecture.md.
/// </summary>
public sealed class CliRunner
{
    private readonly string _clearkryptCommand;

    public CliRunner(string clearkryptCommand)
    {
        _clearkryptCommand = clearkryptCommand;
    }

    public Task<CliInvocationResult> CheckAsync(
        string projectDirectory,
        IEnumerable<string>? targets = null,
        CancellationToken cancellationToken = default) =>
        RunAsync("check", projectDirectory, targets, cancellationToken);

    public Task<CliInvocationResult> BuildAsync(
        string projectDirectory,
        IEnumerable<string>? targets = null,
        CancellationToken cancellationToken = default) =>
        RunAsync("build", projectDirectory, targets, cancellationToken);

    private async Task<CliInvocationResult> RunAsync(
        string subcommand,
        string projectDirectory,
        IEnumerable<string>? targets,
        CancellationToken cancellationToken)
    {
        var startInfo = new ProcessStartInfo(_clearkryptCommand)
        {
            WorkingDirectory = projectDirectory,
            RedirectStandardOutput = true,
            RedirectStandardError = true,
            UseShellExecute = false,
            CreateNoWindow = true,
        };

        startInfo.ArgumentList.Add(subcommand);
        startInfo.ArgumentList.Add("--json");
        foreach (var target in targets ?? Array.Empty<string>())
        {
            startInfo.ArgumentList.Add("--target");
            startInfo.ArgumentList.Add(target);
        }

        using var process = new Process { StartInfo = startInfo };
        process.Start();

        var stdoutTask = process.StandardOutput.ReadToEndAsync(cancellationToken);
        var stderrTask = process.StandardError.ReadToEndAsync(cancellationToken);
        await process.WaitForExitAsync(cancellationToken).ConfigureAwait(false);

        var stdout = await stdoutTask.ConfigureAwait(false);
        var stderr = await stderrTask.ConfigureAwait(false);

        var result = TryParse(stdout);
        return new CliInvocationResult(process.ExitCode, result, stdout, stderr);
    }

    private static CliResult? TryParse(string stdout)
    {
        if (string.IsNullOrWhiteSpace(stdout))
        {
            return null;
        }

        try
        {
            return JsonSerializer.Deserialize<CliResult>(stdout, JsonOptions.Default);
        }
        catch (JsonException)
        {
            return null;
        }
    }
}
