namespace ClearKryptIDE.Core.Toml;

/// <summary>
/// A parsed TOML document restricted to the ClearKrypt manifest subset:
/// <c>[section]</c> headers and <c>key = "string"</c> / <c>key = true|false</c>
/// assignments. See <see cref="TomlParser"/>.
/// </summary>
public sealed class TomlDocument
{
    private readonly Dictionary<string, Dictionary<string, object>> _sections;

    internal TomlDocument(Dictionary<string, Dictionary<string, object>> sections)
    {
        _sections = sections;
    }

    public bool HasSection(string name) => _sections.ContainsKey(name);

    public IReadOnlyCollection<string> SectionNames => _sections.Keys;

    public string? GetString(string section, string key, string? defaultValue = null)
    {
        if (_sections.TryGetValue(section, out var table) &&
            table.TryGetValue(key, out var value) &&
            value is string s)
        {
            return s;
        }

        return defaultValue;
    }

    public bool GetBool(string section, string key, bool defaultValue = false)
    {
        if (_sections.TryGetValue(section, out var table) &&
            table.TryGetValue(key, out var value) &&
            value is bool b)
        {
            return b;
        }

        return defaultValue;
    }

    public IReadOnlyDictionary<string, object>? GetTable(string section)
    {
        return _sections.TryGetValue(section, out var table) ? table : null;
    }
}
