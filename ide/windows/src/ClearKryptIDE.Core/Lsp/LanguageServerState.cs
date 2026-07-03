namespace ClearKryptIDE.Core.Lsp;

/// <summary>Language-server connection state, surfaced in the IDE status bar.</summary>
public enum LanguageServerState
{
    NotStarted,
    Starting,
    Ready,
    ShuttingDown,
    Stopped,
    Crashed,
}
