namespace ClearKryptIDE.Core.Lsp.Protocol;

/// <summary>
/// One diagnostic entry in a <c>clearkrypt/check</c> result. docs/21 describes
/// the result as diagnostics "grouped LSP-style with uri per file" — read here
/// as each flattened diagnostic carrying its own <see cref="Uri"/>, since the
/// document does not show a per-file grouping envelope. (Flagged as an
/// ambiguity to confirm with the language-server team.)
/// </summary>
public sealed record CheckDiagnostic(
    string Uri,
    Range Range,
    DiagnosticSeverity? Severity,
    string? Code,
    string? Source,
    string Message);

/// <summary>Result of the <c>clearkrypt/check</c> request.</summary>
public sealed record CheckResult(IReadOnlyList<CheckDiagnostic> Diagnostics);
