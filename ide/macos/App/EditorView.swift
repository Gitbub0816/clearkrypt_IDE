import AppKit
import IDECore
import SwiftUI

/// The .ck source editor: NSTextView with the IDECore fallback highlighter,
/// language-server semantic tokens layered on top when available, and
/// dotted diagnostic underlines. Completion uses the native NSTextView
/// completion popup (Esc / F5) fed by the language server.
struct EditorView: NSViewRepresentable {
    @ObservedObject var session: ProjectSession
    @ObservedObject var document: OpenDocument

    func makeCoordinator() -> Coordinator {
        Coordinator(session: session, document: document)
    }

    func makeNSView(context: Context) -> NSScrollView {
        let scrollView = NSTextView.scrollableTextView()
        guard let textView = scrollView.documentView as? NSTextView else {
            return scrollView
        }
        textView.isRichText = false
        textView.font = NSFont.monospacedSystemFont(ofSize: 13, weight: .regular)
        textView.isAutomaticQuoteSubstitutionEnabled = false
        textView.isAutomaticDashSubstitutionEnabled = false
        textView.isAutomaticTextReplacementEnabled = false
        textView.isAutomaticSpellingCorrectionEnabled = false
        textView.allowsUndo = true
        textView.isEditable = !document.file.isReadOnly
        textView.delegate = context.coordinator
        textView.string = document.text
        context.coordinator.textView = textView
        context.coordinator.applyHighlighting()
        context.coordinator.observeNavigation()
        return scrollView
    }

    func updateNSView(_ scrollView: NSScrollView, context: Context) {
        // Diagnostics or semantic tokens may have changed; reapply styling.
        context.coordinator.applyHighlighting()
    }

    @MainActor
    final class Coordinator: NSObject, NSTextViewDelegate {
        private let session: ProjectSession
        private let document: OpenDocument
        weak var textView: NSTextView?
        private var navigationObserver: NSObjectProtocol?

        init(session: ProjectSession, document: OpenDocument) {
            self.session = session
            self.document = document
        }

        deinit {
            if let navigationObserver {
                NotificationCenter.default.removeObserver(navigationObserver)
            }
        }

        func observeNavigation() {
            navigationObserver = NotificationCenter.default.addObserver(
                forName: .clearkryptNavigate,
                object: nil,
                queue: .main
            ) { [weak self] notification in
                guard let line = notification.userInfo?["line"] as? Int,
                      let character = notification.userInfo?["character"] as? Int else {
                    return
                }
                Task { @MainActor [weak self] in
                    self?.moveCaret(line: line, character: character)
                }
            }
        }

        // MARK: NSTextViewDelegate

        func textDidChange(_ notification: Notification) {
            guard let textView else {
                return
            }
            document.text = textView.string
            session.documentTextChanged(document)
            applyHighlighting()
        }

        func textView(
            _ textView: NSTextView,
            completions words: [String],
            forPartialWordRange charRange: NSRange,
            indexOfSelectedItem index: UnsafeMutablePointer<Int>?
        ) -> [String] {
            let prefix = (textView.string as NSString).substring(with: charRange)
            let fromServer = session.completionLabels.filter { $0.hasPrefix(prefix) }
            return fromServer.isEmpty ? words : fromServer
        }

        // MARK: Styling

        func applyHighlighting() {
            guard let textView, let storage = textView.textStorage else {
                return
            }
            let fullText = textView.string
            let fullRange = NSRange(location: 0, length: (fullText as NSString).length)
            guard document.isClearKryptSource else {
                return
            }

            storage.beginEditing()
            storage.setAttributes(
                [
                    .font: NSFont.monospacedSystemFont(ofSize: 13, weight: .regular),
                    .foregroundColor: NSColor.labelColor,
                ],
                range: fullRange)

            let tokens = session.tokensByUri[document.uri] ?? []
            if tokens.isEmpty {
                for span in SyntaxHighlighter().highlight(fullText) {
                    applyColor(EditorTheme.color(for: span.kind), in: span.range, of: storage, limit: fullRange)
                }
            } else {
                let lineStarts = EditorView.lineStartOffsets(of: fullText)
                for token in tokens where token.line < lineStarts.count {
                    let range = NSRange(location: lineStarts[token.line] + token.startCharacter, length: token.length)
                    applyColor(EditorTheme.color(forTokenType: token.typeName), in: range, of: storage, limit: fullRange)
                }
            }

            for diagnostic in session.diagnosticsByUri[document.uri] ?? [] {
                let lineStarts = EditorView.lineStartOffsets(of: fullText)
                guard diagnostic.range.start.line < lineStarts.count else {
                    continue
                }
                let start = lineStarts[diagnostic.range.start.line] + diagnostic.range.start.character
                let length = max(1, diagnosticLength(diagnostic, lineStarts: lineStarts))
                let range = NSRange(location: start, length: length)
                if range.location >= 0, NSMaxRange(range) <= fullRange.length {
                    let color: NSColor = diagnostic.severity == 1 ? .systemRed : .systemYellow
                    storage.addAttributes(
                        [
                            .underlineStyle: NSUnderlineStyle.single.rawValue | NSUnderlineStyle.patternDot.rawValue,
                            .underlineColor: color,
                        ],
                        range: range)
                }
            }
            storage.endEditing()
        }

        private func applyColor(_ color: NSColor?, in range: NSRange, of storage: NSTextStorage, limit: NSRange) {
            guard let color, range.location >= 0, NSMaxRange(range) <= limit.length else {
                return
            }
            storage.addAttribute(.foregroundColor, value: color, range: range)
        }

        private func diagnosticLength(_ diagnostic: LSPDiagnostic, lineStarts: [Int]) -> Int {
            guard diagnostic.range.end.line < lineStarts.count else {
                return 1
            }
            let start = lineStarts[diagnostic.range.start.line] + diagnostic.range.start.character
            let end = lineStarts[diagnostic.range.end.line] + diagnostic.range.end.character
            return end - start
        }

        private func moveCaret(line: Int, character: Int) {
            guard let textView else {
                return
            }
            let lineStarts = EditorView.lineStartOffsets(of: textView.string)
            guard line < lineStarts.count else {
                return
            }
            let offset = lineStarts[line] + character
            let limit = (textView.string as NSString).length
            let location = min(max(0, offset), limit)
            textView.setSelectedRange(NSRange(location: location, length: 0))
            textView.scrollRangeToVisible(NSRange(location: location, length: 0))
            textView.window?.makeFirstResponder(textView)
        }
    }

    /// UTF-16 offsets of each line start.
    static func lineStartOffsets(of text: String) -> [Int] {
        var starts = [0]
        let nsText = text as NSString
        var index = 0
        while index < nsText.length {
            if nsText.character(at: index) == 10 {
                starts.append(index + 1)
            }
            index += 1
        }
        return starts
    }
}

/// Kind/token-type → color mapping shared by fallback and semantic styling.
enum EditorTheme {
    static func color(for kind: HighlightKind) -> NSColor {
        switch kind {
        case .keyword: return .systemBlue
        case .typeName: return .systemTeal
        case .string: return .systemOrange
        case .number: return .systemGreen
        case .comment: return .systemGray
        case .declarationName: return .systemCyan
        case .routePath: return .systemIndigo
        case .nativeTarget: return .systemYellow
        }
    }

    static func color(forTokenType type: String) -> NSColor? {
        switch type {
        case "keyword": return .systemBlue
        case "string": return .systemOrange
        case "number": return .systemGreen
        case "comment": return .systemGray
        case "type", "model", "enum", "struct": return .systemTeal
        case "enumMember", "property", "variable", "parameter", "namespace": return .systemCyan
        case "errorType": return .systemRed
        case "function": return .systemPurple
        case "screen", "component", "route": return .systemIndigo
        case "capability": return .systemPink
        case "nativeTarget": return .systemYellow
        case "operator": return .labelColor
        default: return nil
        }
    }
}
