using ClearKryptIDE.Core.Lsp;
using Xunit;

namespace ClearKryptIDE.Core.Tests;

public sealed class SemanticTokenDecoderTests
{
    [Fact]
    public void DecodesDeltaEncodedTokensAgainstTheLegend()
    {
        // Hand-computed for:
        //   line 0: 'module' at char 0, length 6, keyword (index 9), no modifiers
        //   line 2: 'model' at char 0, length 5, keyword
        //   line 2: 'Greeting' at char 6, length 8, model (index 14), declaration (bit 0)
        var data = new[]
        {
            0, 0, 6, 9, 0,
            2, 0, 5, 9, 0,
            0, 6, 8, 14, 1,
        };

        var spans = SemanticTokenDecoder.Decode(data);

        Assert.Equal(3, spans.Count);
        Assert.Equal(new SemanticTokenSpan(0, 0, 6, "keyword", Array.Empty<string>()), spans[0] with { Modifiers = Array.Empty<string>() });
        Assert.Equal(0, spans[0].Line);
        Assert.Equal("keyword", spans[0].TokenType);

        Assert.Equal(2, spans[1].Line);
        Assert.Equal(0, spans[1].StartCharacter);

        Assert.Equal(2, spans[2].Line);
        Assert.Equal(6, spans[2].StartCharacter);
        Assert.Equal(8, spans[2].Length);
        Assert.Equal("model", spans[2].TokenType);
        Assert.Contains("declaration", spans[2].Modifiers);
    }

    [Fact]
    public void EmptyDataDecodesToNoTokens()
    {
        Assert.Empty(SemanticTokenDecoder.Decode(Array.Empty<int>()));
    }
}
