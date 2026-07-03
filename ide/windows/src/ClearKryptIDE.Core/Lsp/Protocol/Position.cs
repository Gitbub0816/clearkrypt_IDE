namespace ClearKryptIDE.Core.Lsp.Protocol;

/// <summary>Zero-based LSP position (docs/21: LSP is zero-based; the CLI is one-based).</summary>
public readonly record struct Position(int Line, int Character);
