using System.Collections.ObjectModel;
using ClearKryptIDE.Core.Project;

namespace ClearKryptIDE.ViewModels;

/// <summary>
/// A navigator tree node wrapping a <see cref="ProjectFileNode"/>. Generated
/// files carry a badge and open read-only (Constitution Document 7 §10).
/// </summary>
public sealed class ProjectNodeViewModel : ViewModelBase
{
    public ProjectNodeViewModel(ProjectFileNode node)
    {
        Node = node;
        Children = new ObservableCollection<ProjectNodeViewModel>(node.Children.Select(c => new ProjectNodeViewModel(c)));
    }

    public ProjectFileNode Node { get; }

    public string Name => Node.Name;

    public bool IsDirectory => Node.IsDirectory;

    public bool IsReadOnly => Node.IsReadOnly;

    /// <summary>Short badge shown next to generated files/folders, e.g. "generated".</summary>
    public string? Badge => Node.Group == ProjectFileGroup.Generated && !string.IsNullOrEmpty(Node.RelativePath) ? "generated" : null;

    public ObservableCollection<ProjectNodeViewModel> Children { get; }

    public bool IsExpanded { get; set; } = true;
}
