namespace ClearKryptIDE.Core.Project;

/// <summary>
/// The compile targets declared in <c>clearkrypt.toml</c>'s <c>[targets]</c>
/// table, and the subset currently selected for check/build in the IDE.
/// </summary>
public readonly record struct ProjectTargets(bool Swift, bool Kotlin, bool React)
{
    public static readonly ProjectTargets None = new(false, false, false);

    public bool Any => Swift || Kotlin || React;

    /// <summary>
    /// CLI <c>--target</c> flag values for every enabled target, per the
    /// docs/21-language-server.md CLI JSON contract.
    /// </summary>
    public IEnumerable<string> ToCliFlags()
    {
        if (Swift)
        {
            yield return "swift";
        }

        if (Kotlin)
        {
            yield return "kotlin";
        }

        if (React)
        {
            yield return "react";
        }
    }
}
