namespace ClearKryptIDE.Core.Lsp;

/// <summary>
/// One decoded semantic token: an absolute line/character span with its
/// resolved token type name and modifier names (legend already applied).
/// </summary>
public sealed record SemanticTokenSpan(
    int Line,
    int StartCharacter,
    int Length,
    string TokenType,
    IReadOnlyList<string> Modifiers);
