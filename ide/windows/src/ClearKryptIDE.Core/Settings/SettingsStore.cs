using System.Text.Json;
using ClearKryptIDE.Core.Json;

namespace ClearKryptIDE.Core.Settings;

/// <summary>
/// Reads and writes <c>settings.json</c> under an injectable base path (the
/// app passes <c>%APPDATA%/ClearKryptIDE</c>; tests pass a temp directory).
/// </summary>
public sealed class SettingsStore
{
    private const int MaxRecentProjects = 10;

    private readonly string _settingsFilePath;

    public SettingsStore(string basePath)
    {
        Directory.CreateDirectory(basePath);
        _settingsFilePath = Path.Combine(basePath, "settings.json");
    }

    public IdeSettings Load()
    {
        if (!File.Exists(_settingsFilePath))
        {
            return new IdeSettings();
        }

        try
        {
            var json = File.ReadAllText(_settingsFilePath);
            return JsonSerializer.Deserialize<IdeSettings>(json, JsonOptions.Default) ?? new IdeSettings();
        }
        catch (JsonException)
        {
            return new IdeSettings();
        }
    }

    public void Save(IdeSettings settings)
    {
        var options = new JsonSerializerOptions(JsonOptions.Default) { WriteIndented = true };
        File.WriteAllText(_settingsFilePath, JsonSerializer.Serialize(settings, options));
    }

    /// <summary>Moves (or adds) <paramref name="projectPath"/> to the front of the recent-projects list and persists it.</summary>
    public IdeSettings AddRecentProject(string projectPath)
    {
        var settings = Load();
        settings.RecentProjects.RemoveAll(p => string.Equals(p, projectPath, StringComparison.OrdinalIgnoreCase));
        settings.RecentProjects.Insert(0, projectPath);
        if (settings.RecentProjects.Count > MaxRecentProjects)
        {
            settings.RecentProjects.RemoveRange(MaxRecentProjects, settings.RecentProjects.Count - MaxRecentProjects);
        }

        Save(settings);
        return settings;
    }
}
