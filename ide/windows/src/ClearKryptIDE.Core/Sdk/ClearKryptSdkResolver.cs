namespace ClearKryptIDE.Core.Sdk;

/// <summary>
/// Resolves the <c>clearkrypt</c> command per docs/21-language-server.md /
/// docs/04-native-ide-architecture.md: explicit user setting, then the
/// <c>CLEARKRYPT_SDK</c> environment variable, then <c>PATH</c>. All
/// dependencies are injectable so this is testable without touching the
/// real file system or environment.
/// </summary>
public sealed class ClearKryptSdkResolver
{
    private const string EnvironmentVariableName = "CLEARKRYPT_SDK";

    private readonly Func<string, bool> _fileExists;
    private readonly Func<string, string?> _getEnvironmentVariable;
    private readonly string _pathVariableValue;
    private readonly string _executableName;
    private readonly char _pathSeparator;

    public ClearKryptSdkResolver(
        Func<string, bool>? fileExists = null,
        Func<string, string?>? getEnvironmentVariable = null,
        string? pathVariableValue = null,
        string? executableName = null,
        char? pathSeparator = null)
    {
        _fileExists = fileExists ?? File.Exists;
        _getEnvironmentVariable = getEnvironmentVariable ?? Environment.GetEnvironmentVariable;
        _pathVariableValue = pathVariableValue ?? Environment.GetEnvironmentVariable("PATH") ?? string.Empty;
        _executableName = executableName ?? (OperatingSystem.IsWindows() ? "clearkrypt.exe" : "clearkrypt");
        _pathSeparator = pathSeparator ?? Path.PathSeparator;
    }

    /// <summary>
    /// Returns the resolved command path/name to launch, or null if no
    /// candidate could be found. <paramref name="userSettingPath"/> is the
    /// IDE's persisted SDK path override, if any.
    /// </summary>
    public string? Resolve(string? userSettingPath)
    {
        if (!string.IsNullOrWhiteSpace(userSettingPath))
        {
            var fromSetting = ResolveFromRoot(userSettingPath);
            if (fromSetting is not null)
            {
                return fromSetting;
            }
        }

        var envValue = _getEnvironmentVariable(EnvironmentVariableName);
        if (!string.IsNullOrWhiteSpace(envValue))
        {
            var fromEnv = ResolveFromRoot(envValue);
            if (fromEnv is not null)
            {
                return fromEnv;
            }
        }

        foreach (var directory in _pathVariableValue.Split(_pathSeparator, StringSplitOptions.RemoveEmptyEntries))
        {
            var candidate = Path.Combine(directory, _executableName);
            if (_fileExists(candidate))
            {
                return candidate;
            }
        }

        return null;
    }

    /// <summary>
    /// A setting or CLEARKRYPT_SDK value may point directly at the
    /// executable, or at an SDK root containing it (optionally under a
    /// "bin" directory). Try both interpretations.
    /// </summary>
    private string? ResolveFromRoot(string root)
    {
        if (_fileExists(root))
        {
            return root;
        }

        var direct = Path.Combine(root, _executableName);
        if (_fileExists(direct))
        {
            return direct;
        }

        var underBin = Path.Combine(root, "bin", _executableName);
        return _fileExists(underBin) ? underBin : null;
    }
}
