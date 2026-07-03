namespace ClearKryptIDE.Core.Lsp.Protocol;

/// <summary>One source module's generated files per target, keyed by target name ("swift", "kotlin", "react").</summary>
public sealed record GeneratedModule(
    string Module,
    string SourceFile,
    IReadOnlyDictionary<string, IReadOnlyList<string>> Targets);

/// <summary>Result of the <c>clearkrypt/generatedMap</c> request.</summary>
public sealed record GeneratedMap(IReadOnlyList<GeneratedModule> Modules);
