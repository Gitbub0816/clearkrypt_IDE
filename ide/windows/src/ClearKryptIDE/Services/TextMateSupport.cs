using System.Reflection;
using TextMateSharp.Internal.Grammars.Reader;
using TextMateSharp.Internal.Themes.Reader;
using TextMateSharp.Internal.Types;
using TextMateSharp.Registry;
using TextMateSharp.Themes;

namespace ClearKryptIDE.Services;

/// <summary>
/// TextMate registry backed by embedded resources: the shared ClearKrypt
/// grammar from /editors (identical across IDE shells, docs/04) plus the
/// dark/light editor themes. Semantic tokens from the language server layer
/// on top of this fallback highlighting once available.
/// </summary>
public sealed class ClearKryptRegistryOptions : IRegistryOptions
{
    public const string ClearKryptScope = "source.clearkrypt";

    private readonly IRawTheme _theme;
    private readonly IRawGrammar _grammar;

    public ClearKryptRegistryOptions(bool darkTheme)
    {
        _grammar = ReadResource("ClearKryptIDE.Resources.clearkrypt.tmLanguage.json", GrammarReader.ReadGrammarSync);
        _theme = ReadResource(
            darkTheme
                ? "ClearKryptIDE.Resources.clearkrypt-dark-theme.json"
                : "ClearKryptIDE.Resources.clearkrypt-light-theme.json",
            ThemeReader.ReadThemeSync);
    }

    public IRawTheme GetDefaultTheme() => _theme;

    public IRawGrammar GetGrammar(string scopeName) => _grammar;

    public ICollection<string> GetInjections(string scopeName) => Array.Empty<string>();

    public IRawTheme GetTheme(string scopeName) => _theme;

    private static T ReadResource<T>(string logicalName, Func<StreamReader, T> read)
    {
        using var stream = Assembly.GetExecutingAssembly().GetManifestResourceStream(logicalName)
            ?? throw new InvalidOperationException($"Missing embedded resource '{logicalName}'.");
        using var reader = new StreamReader(stream);
        return read(reader);
    }
}
