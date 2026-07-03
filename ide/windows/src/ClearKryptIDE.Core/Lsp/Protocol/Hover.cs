namespace ClearKryptIDE.Core.Lsp.Protocol;

public sealed record MarkupContent(string Kind, string Value);

public sealed record Hover(MarkupContent Contents, Range? Range);
