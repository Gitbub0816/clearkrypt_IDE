namespace ClearKryptIDE.Core.Lsp.Protocol;

/// <summary>
/// Hierarchical symbol from <c>textDocument/documentSymbol</c>: module,
/// models, fields, enums, cases, errors, functions, screens, components,
/// routes, natives, and capabilities per docs/21-language-server.md.
/// </summary>
public sealed record DocumentSymbol(
    string Name,
    string? Detail,
    SymbolKind Kind,
    Range Range,
    Range SelectionRange,
    IReadOnlyList<DocumentSymbol>? Children);
