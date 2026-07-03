namespace ClearKryptIDE.Core.Lsp.Protocol;

/// <summary>Keywords, primitive types, and project symbols (MVP scope per docs/21).</summary>
public sealed record CompletionItem(
    string Label,
    int? Kind,
    string? Detail,
    string? InsertText,
    string? Documentation);
