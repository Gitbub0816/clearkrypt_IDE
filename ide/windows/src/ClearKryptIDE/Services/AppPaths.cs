using ClearKryptIDE.Core.Settings;

namespace ClearKryptIDE.Services;

/// <summary>Resolves where the IDE keeps its local, non-versioned user preferences (Constitution Document 7 §20).</summary>
public static class AppPaths
{
    public static string SettingsBasePath =>
        Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData), "ClearKryptIDE");

    public static SettingsStore CreateSettingsStore() => new(SettingsBasePath);
}
