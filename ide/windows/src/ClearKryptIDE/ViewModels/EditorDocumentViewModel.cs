using AvaloniaEdit.Document;

namespace ClearKryptIDE.ViewModels;

/// <summary>
/// One open editor tab. Owns the AvaloniaEdit <see cref="TextDocument"/> so
/// the same document instance survives tab switches; the actual
/// <see cref="AvaloniaEdit.TextEditor"/> control is created by the view and
/// bound to <see cref="Document"/>.
/// </summary>
public sealed class EditorDocumentViewModel : ViewModelBase
{
    private bool _isDirty;

    public EditorDocumentViewModel(string absolutePath, string relativePath, string uri, bool isReadOnly, string initialText)
    {
        AbsolutePath = absolutePath;
        RelativePath = relativePath;
        Uri = uri;
        IsReadOnly = isReadOnly;
        Document = new TextDocument(initialText);
        IsClearKryptSource = absolutePath.EndsWith(".ck", StringComparison.OrdinalIgnoreCase);
    }

    public string AbsolutePath { get; }

    /// <summary>Path relative to the project root, shown as the tab header.</summary>
    public string RelativePath { get; }

    public string Uri { get; }

    public bool IsReadOnly { get; }

    public bool IsClearKryptSource { get; }

    public TextDocument Document { get; }

    /// <summary>LSP document version. Starts at 1 for the didOpen sync, incremented on every didChange.</summary>
    public int Version { get; set; } = 1;

    /// <summary>True once TextMate/semantic-token/diagnostics wiring has run for this tab's editor control (Loaded fires once per container reuse).</summary>
    public bool IsEditorInitialized { get; set; }

    public bool IsDirty
    {
        get => _isDirty;
        set
        {
            if (SetField(ref _isDirty, value))
            {
                OnPropertyChanged(nameof(TabHeader));
            }
        }
    }

    public string TabHeader => IsDirty ? RelativePath + " *" : RelativePath;

    /// <summary>Raised when the editor hosting this document should move the caret (0-based line/character).</summary>
    public event Action<int, int>? NavigateRequested;

    public void RequestNavigate(int line, int character) => NavigateRequested?.Invoke(line, character);
}
