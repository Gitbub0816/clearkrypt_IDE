namespace ClearKryptIDE.Core.Lsp.Protocol;

/// <summary>
/// The fixed semantic token legend from docs/21-language-server.md. Order
/// matters: token type indices in <c>semanticTokens/full</c> responses are
/// positions into <see cref="TokenTypes"/>, and modifier bitsets index into
/// <see cref="TokenModifiers"/>. The first fourteen token types are standard
/// LSP types; the final seven are ClearKrypt-specific (Constitution Document
/// 8 §8). Copied verbatim — do not reorder.
/// </summary>
public static class SemanticTokenLegend
{
    public static readonly IReadOnlyList<string> TokenTypes = new[]
    {
        "namespace",
        "type",
        "enum",
        "enumMember",
        "struct",
        "parameter",
        "variable",
        "property",
        "function",
        "keyword",
        "string",
        "number",
        "comment",
        "operator",
        "model",
        "screen",
        "component",
        "route",
        "capability",
        "errorType",
        "nativeTarget",
    };

    public static readonly IReadOnlyList<string> TokenModifiers = new[]
    {
        "declaration",
        "defaultLibrary",
        "generated",
        "inferred",
        "targetSpecific",
    };
}
