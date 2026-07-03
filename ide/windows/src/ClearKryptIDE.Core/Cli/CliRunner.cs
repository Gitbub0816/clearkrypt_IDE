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

    /// <summary>
    /// Raised for each line of stdout/stderr as the process produces it, so an
    /// IDE build panel can stream progress instead of waiting for exit. Purely
    /// additive: the final <see cref="CliInvocationResult"/> is unaffected and
    /// still carries the complete buffered text.
    /// </summary>
    public event Action<CliOutputLine>? OutputLineReceived;

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

        var stdoutTask = PumpAsync(process.StandardOutput, CliOutputStream.StandardOutput, cancellationToken);
        var stderrTask = PumpAsync(process.StandardError, CliOutputStream.StandardError, cancellationToken);
        await process.WaitForExitAsync(cancellationToken).ConfigureAwait(false);

        var stdout = await stdoutTask.ConfigureAwait(false);
        var stderr = await stderrTask.ConfigureAwait(false);

        var result = TryParse(stdout);
        return new CliInvocationResult(process.ExitCode, result, stdout, stderr);
    }

    /// <summary>Reads a process stream line-by-line, raising <see cref="OutputLineReceived"/> per line while also buffering the full text.</summary>
    private async Task<string> PumpAsync(StreamReader reader, CliOutputStream stream, CancellationToken cancellationToken)
    {
        var buffer = new System.Text.StringBuilder();
        string? line;
        var isFirstLine = true;
        while ((line = await reader.ReadLineAsync(cancellationToken).ConfigureAwait(false)) is not null)
        {
            if (!isFirstLine)
            {
                buffer.Append('\n');
            }

            isFirstLine = false;
            buffer.Append(line);
            OutputLineReceived?.Invoke(new CliOutputLine(stream, line));
        }

        return buffer.ToString();
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
