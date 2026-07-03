using ClearKryptIDE.Core.Toml;
using Xunit;

namespace ClearKryptIDE.Core.Tests;

public sealed class TomlParserTests
{
    private const string Manifest = """
        [project]
        name = "hello-world"
        version = "0.1.0"

        # comment line
        [targets]
        swift = true
        kotlin = true
        react = false

        [output]
        dir = "generated"
        """;

    [Fact]
    public void ParsesSectionsStringsAndBooleans()
    {
        var doc = TomlParser.Parse(Manifest);
        Assert.Equal("hello-world", doc.GetString("project", "name"));
        Assert.Equal("0.1.0", doc.GetString("project", "version"));
        Assert.True(doc.GetBool("targets", "swift"));
        Assert.False(doc.GetBool("targets", "react"));
        Assert.Equal("generated", doc.GetString("output", "dir"));
    }

    [Fact]
    public void MissingKeysFallBackToDefaults()
    {
        var doc = TomlParser.Parse(Manifest);
        Assert.Null(doc.GetString("project", "license"));
        Assert.True(doc.GetBool("targets", "missing", defaultValue: true));
        Assert.False(doc.HasSection("dependencies"));
    }

    [Fact]
    public void RejectsUnsupportedValueSyntax()
    {
        Assert.Throws<TomlParseException>(() => TomlParser.Parse("[project]\nname = [1, 2]\n"));
    }

    [Fact]
    public void RejectsLinesWithoutKeyValueShape()
    {
        Assert.Throws<TomlParseException>(() => TomlParser.Parse("[project]\njust some words\n"));
    }
}
