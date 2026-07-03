namespace ClearKryptIDE.Core.Project;

/// <summary>
/// Thrown when a folder cannot be opened as a ClearKrypt project. The
/// message is written to be shown directly to the user in the Open Project
/// flow (Constitution Document 7 mandates friendly, actionable diagnostics).
/// </summary>
public sealed class ClearKryptProjectException : Exception
{
    public ClearKryptProjectException(string message)
        : base(message)
    {
    }

    public ClearKryptProjectException(string message, Exception innerException)
        : base(message, innerException)
    {
    }
}
