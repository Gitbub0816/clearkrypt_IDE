namespace ClearKryptIDE.Core.Lsp.Protocol;

/// <summary>Result of the <c>clearkrypt/projectInfo</c> request.</summary>
public sealed record ProjectInfoTargets(bool Swift, bool Kotlin, bool React);

public sealed record ProjectInfo(
    string Name,
    string Version,
    ProjectInfoTargets Targets,
    string OutputDir,
    IReadOnlyList<string> SourceFiles);
