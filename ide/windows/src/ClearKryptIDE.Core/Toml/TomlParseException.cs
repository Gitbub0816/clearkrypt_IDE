namespace ClearKryptIDE.Core.Toml;

/// <summary>
/// Thrown when the minimal TOML subset parser encounters syntax it does not
/// understand. Carries the 1-based source line for actionable error messages.
/// </summary>
public sealed class TomlParseException : Exception
{
    public int Line { get; }

    public TomlParseException(int line, string message)
        : base($"line {line}: {message}")
    {
        Line = line;
    }
}
