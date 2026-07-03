using ClearKryptIDE.Core.Lsp.Protocol;

namespace ClearKryptIDE.Core.Lsp;

/// <summary>
/// Decodes the delta-encoded <c>semanticTokens/full</c> integer array (LSP
/// 3.17 §3.17.6) into absolute per-line token spans using the ClearKrypt
/// legend (<see cref="SemanticTokenLegend"/>).
///
/// Wire format: repeated 5-tuples
/// <c>[deltaLine, deltaStartChar, length, tokenTypeIndex, tokenModifierBits]</c>.
/// <c>deltaLine</c> is relative to the previous token's line (0 means same
/// line). <c>deltaStartChar</c> is relative to the previous token's start
/// character when on the same line, otherwise absolute from the start of the
/// new line.
/// </summary>
public static class SemanticTokenDecoder
{
    public static IReadOnlyList<SemanticTokenSpan> Decode(IReadOnlyList<int> data) =>
        Decode(data, SemanticTokenLegend.TokenTypes, SemanticTokenLegend.TokenModifiers);

    public static IReadOnlyList<SemanticTokenSpan> Decode(
        IReadOnlyList<int> data,
        IReadOnlyList<string> tokenTypes,
        IReadOnlyList<string> tokenModifiers)
    {
        var result = new List<SemanticTokenSpan>(data.Count / 5);
        var line = 0;
        var character = 0;

        for (var i = 0; i + 5 <= data.Count; i += 5)
        {
            var deltaLine = data[i];
            var deltaStartChar = data[i + 1];
            var length = data[i + 2];
            var typeIndex = data[i + 3];
            var modifierBits = data[i + 4];

            if (deltaLine > 0)
            {
                line += deltaLine;
                character = deltaStartChar;
            }
            else
            {
                character += deltaStartChar;
            }

            var tokenType = typeIndex >= 0 && typeIndex < tokenTypes.Count
                ? tokenTypes[typeIndex]
                : "unresolved";

            result.Add(new SemanticTokenSpan(line, character, length, tokenType, DecodeModifiers(modifierBits, tokenModifiers)));
        }

        return result;
    }

    private static IReadOnlyList<string> DecodeModifiers(int bits, IReadOnlyList<string> tokenModifiers)
    {
        if (bits == 0)
        {
            return Array.Empty<string>();
        }

        var modifiers = new List<string>();
        for (var bitIndex = 0; bitIndex < tokenModifiers.Count; bitIndex++)
        {
            if ((bits & (1 << bitIndex)) != 0)
            {
                modifiers.Add(tokenModifiers[bitIndex]);
            }
        }

        return modifiers;
    }
}
