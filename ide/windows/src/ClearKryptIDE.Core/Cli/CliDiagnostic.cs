namespace ClearKryptIDE.Core.Cli;

/// <summary>One-based range, matching the CLI JSON contract (docs/21: "Lines/columns are one-based").</summary>
public sealed record CliDiagnosticRange(int StartLine, int StartColumn, int EndLine, int EndColumn);

/// <summary>A single diagnostic from <c>clearkrypt check --json</c> / <c>build --json</c> output.</summary>
public sealed record CliDiagnostic(
    string Code,
    string Severity,
    string Message,
    string File,
    CliDiagnosticRange Range,
    string? Target);

/// <summary>The single JSON document <c>clearkrypt check --json</c> / <c>build --json</c> print to stdout.</summary>
public sealed record CliResult(
    bool Ok,
    IReadOnlyList<CliDiagnostic> Diagnostics,
    IReadOnlyList<string>? GeneratedFiles);
