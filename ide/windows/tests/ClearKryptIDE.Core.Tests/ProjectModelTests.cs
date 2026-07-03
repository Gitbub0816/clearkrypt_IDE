using ClearKryptIDE.Core.Project;
using Xunit;

namespace ClearKryptIDE.Core.Tests;

public sealed class ProjectModelTests
{
    /// <summary>Walks up from the test assembly to the repository root (marker: tests/fixtures).</summary>
    private static string RepoRoot()
    {
        var dir = new DirectoryInfo(AppContext.BaseDirectory);
        while (dir is not null && !Directory.Exists(Path.Combine(dir.FullName, "tests", "fixtures")))
        {
            dir = dir.Parent;
        }
        Assert.NotNull(dir);
        return dir!.FullName;
    }

    [Fact]
    public void LoadsTheHelloWorldFixture()
    {
        var project = ClearKryptProject.Load(
            Path.Combine(RepoRoot(), "tests", "fixtures", "projects", "hello-world"));

        Assert.Equal("hello-world", project.Name);
        Assert.True(project.Targets.Swift);
        Assert.True(project.Targets.Kotlin);
        Assert.True(project.Targets.React);
        Assert.Equal("generated", project.OutputDir);
        Assert.Contains("src/main.ck", project.SourceFiles);
    }

    [Fact]
    public void GroupsFilesByPurposeInTheTree()
    {
        var project = ClearKryptProject.Load(
            Path.Combine(RepoRoot(), "tests", "fixtures", "projects", "hello-world"));
        var tree = project.BuildFileTree();

        var groups = tree.Select(n => n.Group).ToList();
        Assert.Contains(ProjectFileGroup.Source, groups);
        Assert.Contains(ProjectFileGroup.Config, groups);

        var source = tree.First(n => n.Group == ProjectFileGroup.Source);
        var main = Flatten(source).FirstOrDefault(n => n.RelativePath == "src/main.ck");
        Assert.NotNull(main);
        Assert.False(main!.IsReadOnly);
    }

    [Fact]
    public void RejectsFoldersWithoutManifest()
    {
        var temp = Directory.CreateTempSubdirectory("ck-not-a-project");
        try
        {
            var ex = Assert.Throws<ClearKryptProjectException>(() => ClearKryptProject.Load(temp.FullName));
            Assert.Contains("clearkrypt.toml", ex.Message);
        }
        finally
        {
            temp.Delete(recursive: true);
        }
    }

    private static IEnumerable<ProjectFileNode> Flatten(ProjectFileNode node)
    {
        yield return node;
        foreach (var child in node.Children.SelectMany(Flatten))
        {
            yield return child;
        }
    }
}
