using System.Text;

namespace ClearKryptIDE.Core.Toml;

/// <summary>
/// Hand-written parser for the minimal TOML subset ClearKrypt manifests use:
/// <c>[section]</c> headers plus <c>key = "string"</c> or <c>key = true|false</c>
/// assignments, blank lines, and <c>#</c> comments. No external TOML
/// dependency — the ClearKrypt manifest format is intentionally tiny.
/// </summary>
public static class TomlParser
{
    public static TomlDocument Parse(string text)
    {
        var sections = new Dictionary<string, Dictionary<string, object>>();
        var currentSectionKey = string.Empty;
        var current = new Dictionary<string, object>();
        sections[currentSectionKey] = current;

        var lines = text.Replace("\r\n", "\n").Split('\n');
        for (var i = 0; i < lines.Length; i++)
        {
            var lineNumber = i + 1;
            var line = StripComment(lines[i]).Trim();
            if (line.Length == 0)
            {
                continue;
            }

            if (line.StartsWith('[') )
            {
                if (!line.EndsWith(']'))
                {
                    throw new TomlParseException(lineNumber, $"unterminated section header: '{line}'");
                }

                var name = line[1..^1].Trim();
                if (name.Length == 0)
                {
                    throw new TomlParseException(lineNumber, "empty section name");
                }

                if (!sections.TryGetValue(name, out var table))
                {
                    table = new Dictionary<string, object>();
                    sections[name] = table;
                }

                currentSectionKey = name;
                current = table;
                continue;
            }

            var equalsIndex = line.IndexOf('=');
            if (equalsIndex < 0)
            {
                throw new TomlParseException(lineNumber, $"expected 'key = value', got '{line}'");
            }

            var key = line[..equalsIndex].Trim();
            var rawValue = line[(equalsIndex + 1)..].Trim();
            if (key.Length == 0)
            {
                throw new TomlParseException(lineNumber, "empty key");
            }

            current[key] = ParseValue(rawValue, lineNumber);
        }

        return new TomlDocument(sections);
    }

    private static object ParseValue(string rawValue, int lineNumber)
    {
        if (rawValue == "true")
        {
            return true;
        }

        if (rawValue == "false")
        {
            return false;
        }

        if (rawValue.Length >= 2 && rawValue[0] == '"' && rawValue[^1] == '"')
        {
            return UnescapeString(rawValue[1..^1]);
        }

        throw new TomlParseException(
            lineNumber,
            $"unsupported value '{rawValue}' (only \"strings\" and true/false are supported)");
    }

    private static string UnescapeString(string raw)
    {
        var builder = new StringBuilder(raw.Length);
        for (var i = 0; i < raw.Length; i++)
        {
            var c = raw[i];
            if (c == '\\' && i + 1 < raw.Length)
            {
                i++;
                builder.Append(raw[i] switch
                {
                    'n' => '\n',
                    't' => '\t',
                    'r' => '\r',
                    '"' => '"',
                    '\\' => '\\',
                    _ => raw[i],
                });
                continue;
            }

            builder.Append(c);
        }

        return builder.ToString();
    }

    private static string StripComment(string line)
    {
        var inString = false;
        for (var i = 0; i < line.Length; i++)
        {
            var c = line[i];
            if (c == '"' && (i == 0 || line[i - 1] != '\\'))
            {
                inString = !inString;
            }
            else if (c == '#' && !inString)
            {
                return line[..i];
            }
        }

        return line;
    }
}
