namespace ClearKryptIDE.Core.Lsp.Protocol;

public sealed record TextEdit(Range Range, string NewText);
