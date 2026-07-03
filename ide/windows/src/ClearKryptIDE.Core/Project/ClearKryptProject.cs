using ClearKryptIDE.Core.Toml;

namespace ClearKryptIDE.Core.Project;

/// <summary>
/// A loaded ClearKrypt project: the parsed <c>clearkrypt.toml</c> manifest
/// plus the file inventory the navigator groups into Source / Generated /
/// Native / Config (Constitution Document 7 §7).
/// </summary>
public sealed class ClearKryptProject
{
    public string RootPath { get; }

    public string Name { get; }

    public string Version { get; }

    public ProjectTargets Targets { get; }

    /// <summary>Output directory for generated code, relative to <see cref="RootPath"/> (default "generated").</summary>
    public string OutputDir { get; }

    /// <summary>ClearKrypt source files under src/**/*.ck, relative to <see cref="RootPath"/>.</summary>
    public IReadOnlyList<string> SourceFiles { get; }

    /// <summary>Generated files under the output directory, relative to <see cref="RootPath"/>.</summary>
    public IReadOnlyList<string> GeneratedFiles { get; }

    /// <summary>Handwritten native interop files under native/**, relative to <see cref="RootPath"/>.</summary>
    public IReadOnlyList<string> NativeFiles { get; }

    /// <summary>Project configuration files (clearkrypt.toml and other root-level manifest files).</summary>
    public IReadOnlyList<string> ConfigFiles { get; }

    private ClearKryptProject(
        string rootPath,
        string name,
        string version,
        ProjectTargets targets,
        string outputDir,
        IReadOnlyList<string> sourceFiles,
        IReadOnlyList<string> generatedFiles,
        IReadOnlyList<string> nativeFiles,
        IReadOnlyList<string> configFiles)
    {
        RootPath = rootPath;
        Name = name;
        Version = version;
        Targets = targets;
        OutputDir = outputDir;
        SourceFiles = sourceFiles;
        GeneratedFiles = generatedFiles;
        NativeFiles = nativeFiles;
        ConfigFiles = configFiles;
    }

    /// <summary>
    /// Loads a ClearKrypt project from <paramref name="folder"/>. Throws
    /// <see cref="ClearKryptProjectException"/> with a user-facing message
    /// when the folder is not a valid project.
    /// </summary>
    public static ClearKryptProject Load(string folder)
    {
        if (!Directory.Exists(folder))
        {
            throw new ClearKryptProjectException($"Folder not found: {folder}");
        }

        var manifestPath = Path.Combine(folder, "clearkrypt.toml");
        if (!File.Exists(manifestPath))
        {
            throw new ClearKryptProjectException(
                "This folder does not contain a clearkrypt.toml file. " +
                "Open a folder that contains a ClearKrypt project.");
        }

        TomlDocument document;
        try
        {
            document = TomlParser.Parse(File.ReadAllText(manifestPath));
        }
        catch (TomlParseException ex)
        {
            throw new ClearKryptProjectException($"clearkrypt.toml could not be parsed ({ex.Message}).", ex);
        }

        var name = document.GetString("project", "name");
        if (string.IsNullOrWhiteSpace(name))
        {
            throw new ClearKryptProjectException("clearkrypt.toml is missing a required [project] name.");
        }

        var version = document.GetString("project", "version") ?? "0.0.0";
        var targets = new ProjectTargets(
            document.GetBool("targets", "swift"),
            document.GetBool("targets", "kotlin"),
            document.GetBool("targets", "react"));
        var outputDir = document.GetString("output", "dir") ?? "generated";

        var sourceFiles = EnumerateRelative(folder, "src", "*.ck");
        var generatedFiles = EnumerateRelative(folder, outputDir, "*");
        var nativeFiles = EnumerateRelative(folder, "native", "*");
        var configFiles = EnumerateRootConfigFiles(folder);

        return new ClearKryptProject(
            folder, name, version, targets, outputDir,
            sourceFiles, generatedFiles, nativeFiles, configFiles);
    }

    /// <summary>
    /// Builds the four grouped roots (Source / Generated / Native / Config)
    /// the project navigator renders as a tree.
    /// </summary>
    public IReadOnlyList<ProjectFileNode> BuildFileTree()
    {
        var groups = new List<ProjectFileNode>
        {
            BuildGroupNode("Source", ProjectFileGroup.Source, SourceFiles),
            BuildGroupNode("Generated", ProjectFileGroup.Generated, GeneratedFiles),
            BuildGroupNode("Native", ProjectFileGroup.Native, NativeFiles),
            BuildGroupNode("Config", ProjectFileGroup.Config, ConfigFiles),
        };

        foreach (var group in groups)
        {
            group.SortChildrenRecursively();
        }

        return groups;
    }

    private static ProjectFileNode BuildGroupNode(string label, ProjectFileGroup group, IReadOnlyList<string> relativePaths)
    {
        var root = ProjectFileNode.CreateDirectory(label, string.Empty, group);
        foreach (var relativePath in relativePaths)
        {
            InsertPath(root, relativePath, group);
        }

        return root;
    }

    private static void InsertPath(ProjectFileNode parent, string relativePath, ProjectFileGroup group)
    {
        var segments = relativePath.Split('/');
        var current = parent;
        var accumulated = new List<string>(segments.Length);
        for (var i = 0; i < segments.Length; i++)
        {
            var segment = segments[i];
            accumulated.Add(segment);
            var isLeaf = i == segments.Length - 1;
            var childPath = string.Join('/', accumulated);

            var existing = current.Children.Find(c => c.Name == segment);
            if (existing is null)
            {
                existing = isLeaf
                    ? ProjectFileNode.CreateFile(segment, childPath, group)
                    : ProjectFileNode.CreateDirectory(segment, childPath, group);
                current.Children.Add(existing);
            }

            current = existing;
        }
    }

    private static IReadOnlyList<string> EnumerateRelative(string root, string subFolder, string searchPattern)
    {
        var dir = Path.Combine(root, subFolder);
        if (!Directory.Exists(dir))
        {
            return Array.Empty<string>();
        }

        return Directory.EnumerateFiles(dir, searchPattern, SearchOption.AllDirectories)
            .Select(path => ToRelative(root, path))
            .OrderBy(p => p, StringComparer.OrdinalIgnoreCase)
            .ToArray();
    }

    private static IReadOnlyList<string> EnumerateRootConfigFiles(string root)
    {
        return Directory.EnumerateFiles(root, "*", SearchOption.TopDirectoryOnly)
            .Select(path => ToRelative(root, path))
            .OrderBy(p => p, StringComparer.OrdinalIgnoreCase)
            .ToArray();
    }

    private static string ToRelative(string root, string fullPath)
    {
        var relative = Path.GetRelativePath(root, fullPath);
        return relative.Replace(Path.DirectorySeparatorChar, '/');
    }
}
