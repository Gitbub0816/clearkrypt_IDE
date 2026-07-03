using System.Text.Json;
using System.Text.Json.Serialization;

namespace ClearKryptIDE.Core.Json;

/// <summary>
/// The single <see cref="JsonSerializerOptions"/> instance shared by the LSP
/// client and CLI JSON parser: camelCase on the wire (LSP and the
/// docs/21-language-server.md CLI contract both use camelCase), tolerant of
/// case on the way in.
/// </summary>
public static class JsonOptions
{
    public static readonly JsonSerializerOptions Default = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        PropertyNameCaseInsensitive = true,
        DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull,
        NumberHandling = JsonNumberHandling.AllowReadingFromString,
    };
}
