namespace ClearKryptIDE.Core.Lsp.Protocol;

/// <summary>Raw response of <c>textDocument/semanticTokens/full</c>: a delta-encoded flat integer array.</summary>
public sealed record SemanticTokens(string? ResultId, IReadOnlyList<int> Data);
