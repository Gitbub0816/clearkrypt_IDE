namespace ClearKryptIDE.Core.Cli;

/// <summary>
/// The outcome of running the ClearKrypt CLI once, combining the process
/// exit code with the parsed JSON document (docs/21 exit codes: 0 success,
/// 1 diagnostics with errors, 64 usage error, 70 internal error).
/// </summary>
public sealed record CliInvocationResult(int ExitCode, CliResult? Result, string RawStdout, string RawStderr)
{
    public bool IsSuccess => ExitCode == 0;

    public bool HasDiagnosticsWithErrors => ExitCode == 1;

    public bool IsUsageError => ExitCode == 64;

    public bool IsInternalError => ExitCode == 70;

    /// <summary>True when the exit code is outside the documented set (0/1/64/70).</summary>
    public bool IsUnexpectedExitCode => ExitCode is not (0 or 1 or 64 or 70);
}
