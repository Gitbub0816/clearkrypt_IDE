namespace ClearKryptIDE.Core.Project;

/// <summary>
/// A single node in the grouped project navigator tree: either a directory
/// (a group root or an intermediate folder) or a leaf file.
/// </summary>
public sealed class ProjectFileNode
{
    public string Name { get; }

    /// <summary>Path relative to the project root, using '/' separators. Empty for group roots.</summary>
    public string RelativePath { get; }

    public bool IsDirectory { get; }

    public ProjectFileGroup Group { get; }

    public List<ProjectFileNode> Children { get; } = new();

    /// <summary>
    /// True when the file must open read-only in the editor (Constitution
    /// Document 7 §10: generated files are inspectable but not editable).
    /// </summary>
    public bool IsReadOnly => Group == ProjectFileGroup.Generated && !IsDirectory;

    private ProjectFileNode(string name, string relativePath, bool isDirectory, ProjectFileGroup group)
    {
        Name = name;
        RelativePath = relativePath;
        IsDirectory = isDirectory;
        Group = group;
    }

    public static ProjectFileNode CreateDirectory(string name, string relativePath, ProjectFileGroup group) =>
        new(name, relativePath, isDirectory: true, group);

    public static ProjectFileNode CreateFile(string name, string relativePath, ProjectFileGroup group) =>
        new(name, relativePath, isDirectory: false, group);

    /// <summary>Sorts this node's children (directories first, then alphabetically) and recurses.</summary>
    public void SortChildrenRecursively()
    {
        Children.Sort((a, b) =>
        {
            if (a.IsDirectory != b.IsDirectory)
            {
                return a.IsDirectory ? -1 : 1;
            }

            return string.Compare(a.Name, b.Name, StringComparison.OrdinalIgnoreCase);
        });

        foreach (var child in Children)
        {
            child.SortChildrenRecursively();
        }
    }
}
