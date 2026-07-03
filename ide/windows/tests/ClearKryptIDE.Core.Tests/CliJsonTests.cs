using System.Text.Json;
using ClearKryptIDE.Core.Cli;
using ClearKryptIDE.Core.Json;
using Xunit;

namespace ClearKryptIDE.Core.Tests;

/// <summary>Round-trips the exact sample payload documented in docs/21-language-server.md.</summary>
public sealed class CliJsonTests
{
    private const string Docs21Sample = """
        {
          "ok": false,
          "diagnostics": [
            {
              "code": "CK0003",
              "severity": "error",
              "message": "Type mismatch",
              "file": "src/main.ck",
              "range": { "startLine": 4, "startColumn": 3, "endLine": 4, "endColumn": 9 },
              "target": "swift"
            }
          ],
          "generatedFiles": ["generated/swift/app/main/Greeting.swift"]
        }
        """;

    [Fact]
    public void ParsesTheDocumentedContract()
    {
        var result = JsonSerializer.Deserialize<CliResult>(Docs21Sample, JsonOptions.Default);

        Assert.NotNull(result);
        Assert.False(result!.Ok);
        var diagnostic = Assert.Single(result.Diagnostics);
        Assert.Equal("CK0003", diagnostic.Code);
        Assert.Equal("error", diagnostic.Severity);
        Assert.Equal("src/main.ck", diagnostic.File);
        Assert.Equal(4, diagnostic.Range.StartLine);
        Assert.Equal(3, diagnostic.Range.StartColumn);
        Assert.Equal("swift", diagnostic.Target);
        Assert.Equal(new[] { "generated/swift/app/main/Greeting.swift" }, result.GeneratedFiles);
    }

    [Fact]
    public void ToleratesAbsentOptionalFields()
    {
        var result = JsonSerializer.Deserialize<CliResult>(
            """{"ok":true,"diagnostics":[],"generatedFiles":[]}""",
            JsonOptions.Default);
        Assert.NotNull(result);
        Assert.True(result!.Ok);
        Assert.Empty(result.Diagnostics);
    }
}
