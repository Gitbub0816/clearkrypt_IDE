namespace ClearKryptIDE.Core.Settings;

/// <summary>
/// Local user preferences: not committed to the project, per Constitution
/// Document 7 §20 (build-critical settings live in clearkrypt.toml; UI/tool
/// preferences are local-only).
/// </summary>
public sealed class IdeSettings
{
    /// <summary>Explicit override for the ClearKrypt SDK/CLI location. Highest-priority in <see cref="Sdk.ClearKryptSdkResolver"/>.</summary>
    public string? ClearKryptSdkPath { get; set; }

    /// <summary>Most-recently-opened project folders, most recent first.</summary>
    public List<string> RecentProjects { get; set; } = new();
}
