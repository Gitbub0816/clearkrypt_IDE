namespace ClearKryptIDE.Core.Cli;

/// <summary>Which process stream a streamed <see cref="CliRunner.OutputLineReceived"/> line came from.</summary>
public enum CliOutputStream
{
    StandardOutput,
    StandardError,
}

/// <summary>One line of live output from a running CLI invocation (see <see cref="CliRunner.OutputLineReceived"/>).</summary>
public sealed record CliOutputLine(CliOutputStream Stream, string Text);
