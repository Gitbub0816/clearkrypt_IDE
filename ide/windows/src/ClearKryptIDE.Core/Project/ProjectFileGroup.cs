namespace ClearKryptIDE.Core.Project;

/// <summary>
/// The four navigator groups the project tree understands (Constitution
/// Document 7 §7): the tree must distinguish purpose, not show a raw folder
/// listing.
/// </summary>
public enum ProjectFileGroup
{
    Source,
    Generated,
    Native,
    Config,
}
