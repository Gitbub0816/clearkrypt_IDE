namespace ClearKryptIDE.Core.Lsp.Protocol;

/// <summary>
/// An LSP diagnostic. Per docs/21-language-server.md, <see cref="Code"/> is
/// the stable CKxxxx code and <see cref="Source"/> is always "clearkrypt".
/// </summary>
public sealed record Diagnostic(
    Range Range,
    DiagnosticSeverity? Severity,
    string? Code,
    string? Source,
    string Message);

/// <summary>Params of a <c>textDocument/publishDiagnostics</c> notification.</summary>
public sealed record PublishDiagnosticsParams(
    string Uri,
    int? Version,
    IReadOnlyList<Diagnostic> Diagnostics);
