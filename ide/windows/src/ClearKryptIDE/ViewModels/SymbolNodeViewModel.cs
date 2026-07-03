using System.Collections.ObjectModel;
using ClearKryptIDE.Core.Lsp.Protocol;

namespace ClearKryptIDE.ViewModels;

/// <summary>One node in the document outline, from <c>textDocument/documentSymbol</c>.</summary>
public sealed class SymbolNodeViewModel
{
    public SymbolNodeViewModel(DocumentSymbol symbol)
    {
        Symbol = symbol;
        Children = new ObservableCollection<SymbolNodeViewModel>((symbol.Children ?? Array.Empty<DocumentSymbol>()).Select(c => new SymbolNodeViewModel(c)));
    }

    public DocumentSymbol Symbol { get; }

    public string Name => Symbol.Name;

    public string KindLabel => Symbol.Kind.ToString();

    public ObservableCollection<SymbolNodeViewModel> Children { get; }
}
