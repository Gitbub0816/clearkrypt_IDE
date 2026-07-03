namespace ClearKryptIDE.Core.Lsp.Protocol;

public sealed record ServerInfo(string? Name, string? Version);

/// <summary>
/// Minimal slice of the <c>initialize</c> response the IDE actually consumes.
/// Capabilities are intentionally not modeled in full: the client drives
/// behavior from docs/21-language-server.md's fixed method list rather than
/// negotiating capabilities dynamically.
/// </summary>
public sealed record InitializeResult(ServerInfo? ServerInfo);
