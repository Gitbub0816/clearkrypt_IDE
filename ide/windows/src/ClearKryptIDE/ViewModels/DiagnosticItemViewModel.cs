using ClearKryptIDE.Core.Cli;
using LspDiagnostic = ClearKryptIDE.Core.Lsp.Protocol.Diagnostic;
using LspSeverity = ClearKryptIDE.Core.Lsp.Protocol.DiagnosticSeverity;

namespace ClearKryptIDE.ViewModels;

/// <summary>Severity normalized to the LSP's four-level scale regardless of source (CLI JSON or LSP diagnostic).</summary>
public enum DiagnosticSeverityLevel
{
    Error = 1,
    Warning = 2,
    Information = 3,
    Hint = 4,
}

/// <summary>
/// One row in the Diagnostics panel. Diagnostics arrive from two docs/21
/// sources — <c>clearkrypt/check</c> / CLI <c>--json</c> for the panel, and
/// <c>textDocument/publishDiagnostics</c> for live per-document updates — so
/// this type normalizes both into one shape keyed by file uri for merging.
/// </summary>
public sealed class DiagnosticItemViewModel
{
    public required string Uri { get; init; }

    public required string FileDisplayPath { get; init; }

    public required DiagnosticSeverityLevel Severity { get; init; }

    public required string Code { get; init; }

    public required string Message { get; init; }

    /// <summary>0-based line for editor navigation.</summary>
    public required int Line { get; init; }

    /// <summary>0-based character for editor navigation.</summary>
    public required int Character { get; init; }

    /// <summary>1-based line for display, matching how developers talk about source lines.</summary>
    public int DisplayLine => Line + 1;

    public string? Target { get; init; }

    public string SeverityIcon => Severity switch
    {
        DiagnosticSeverityLevel.Error => "⛔",
        DiagnosticSeverityLevel.Warning => "⚠",
        DiagnosticSeverityLevel.Information => "ℹ",
        DiagnosticSeverityLevel.Hint => "💡",
        _ => "•",
    };

    public static DiagnosticItemViewModel FromLsp(string uri, string fileDisplayPath, LspDiagnostic diagnostic) => new()
    {
        Uri = uri,
        FileDisplayPath = fileDisplayPath,
        Severity = diagnostic.Severity switch
        {
            LspSeverity.Error => DiagnosticSeverityLevel.Error,
            LspSeverity.Warning => DiagnosticSeverityLevel.Warning,
            LspSeverity.Information => DiagnosticSeverityLevel.Information,
            LspSeverity.Hint => DiagnosticSeverityLevel.Hint,
            _ => DiagnosticSeverityLevel.Error,
        },
        Code = diagnostic.Code ?? string.Empty,
        Message = diagnostic.Message,
        Line = diagnostic.Range.Start.Line,
        Character = diagnostic.Range.Start.Character,
        Target = null,
    };

    /// <summary>The CLI JSON contract is one-based (docs/21); convert to zero-based for editor navigation.</summary>
    public static DiagnosticItemViewModel FromCli(string projectRootUri, CliDiagnostic diagnostic) => new()
    {
        Uri = CombineUri(projectRootUri, diagnostic.File),
        FileDisplayPath = diagnostic.File,
        Severity = diagnostic.Severity.ToLowerInvariant() switch
        {
            "error" => DiagnosticSeverityLevel.Error,
            "warning" => DiagnosticSeverityLevel.Warning,
            "information" or "info" => DiagnosticSeverityLevel.Information,
            "hint" => DiagnosticSeverityLevel.Hint,
            _ => DiagnosticSeverityLevel.Error,
        },
        Code = diagnostic.Code,
        Message = diagnostic.Message,
        Line = Math.Max(0, diagnostic.Range.StartLine - 1),
        Character = Math.Max(0, diagnostic.Range.StartColumn - 1),
        Target = diagnostic.Target,
    };

    private static string CombineUri(string projectRootUri, string relativeFile)
    {
        var normalized = relativeFile.Replace('\\', '/').TrimStart('/');
        return projectRootUri.TrimEnd('/') + "/" + normalized;
    }
}
