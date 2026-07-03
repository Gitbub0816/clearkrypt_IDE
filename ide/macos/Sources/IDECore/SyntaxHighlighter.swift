import Foundation

/// What a highlighted span means; the app maps kinds to colors.
public enum HighlightKind: Equatable {
    case keyword
    case typeName
    case string
    case number
    case comment
    case declarationName
    case routePath
    case nativeTarget
}

/// One highlighted range in UTF-16 units (NSAttributedString-compatible).
public struct HighlightSpan: Equatable {
    public let range: NSRange
    public let kind: HighlightKind
}

/// The native fallback highlighter used before language-server semantic
/// tokens arrive. A line-based scanner with carried block-comment state;
/// keyword and type lists mirror editors/clearkrypt.tmLanguage.json so both
/// IDE shells highlight alike (Constitution Document 8 §19).
public struct SyntaxHighlighter {
    private static let keywords: Set<String> = [
        "module", "import", "model", "enum", "error", "capability", "fn",
        "screen", "component", "route", "native", "requires", "async",
        "throws", "let", "var", "if", "else", "for", "in", "while", "return",
        "try", "catch", "effect", "public", "private", "internal",
        "true", "false", "null", "state", "service", "protocol",
    ]

    private static let nativeTargets: Set<String> = ["swift", "kotlin", "typescript", "react"]

    private static let primitiveTypes: Set<String> = [
        "String", "Int", "Float", "Decimal", "Bool", "Date", "DateTime", "ID",
        "Email", "URL", "Data", "Void", "Never", "List", "Map", "Set",
    ]

    private static let declarationKeywords: Set<String> = [
        "model", "enum", "error", "screen", "component", "capability", "fn",
    ]

    public init() {}

    public func highlight(_ text: String) -> [HighlightSpan] {
        var spans: [HighlightSpan] = []
        var inBlockComment = false
        var lineStartUtf16 = 0

        for lineSubstring in text.split(separator: "\n", omittingEmptySubsequences: false) {
            let line = String(lineSubstring)
            highlightLine(
                line,
                lineStartUtf16: lineStartUtf16,
                inBlockComment: &inBlockComment,
                into: &spans)
            lineStartUtf16 += line.utf16.count + 1
        }
        return spans
    }

    private func highlightLine(
        _ line: String,
        lineStartUtf16: Int,
        inBlockComment: inout Bool,
        into spans: inout [HighlightSpan]
    ) {
        let characters = Array(line.utf16)
        var index = 0
        var previousWord = ""

        func emit(_ start: Int, _ length: Int, _ kind: HighlightKind) {
            spans.append(HighlightSpan(
                range: NSRange(location: lineStartUtf16 + start, length: length),
                kind: kind))
        }
        func isLetter(_ unit: UInt16) -> Bool {
            (unit >= 65 && unit <= 90) || (unit >= 97 && unit <= 122) || unit == 95
        }
        func isDigit(_ unit: UInt16) -> Bool {
            unit >= 48 && unit <= 57
        }

        while index < characters.count {
            if inBlockComment {
                // Scan for the terminator; the whole scanned run is a comment.
                let start = index
                while index < characters.count {
                    if characters[index] == 42, index + 1 < characters.count, characters[index + 1] == 47 {
                        index += 2
                        inBlockComment = false
                        break
                    }
                    index += 1
                }
                emit(start, index - start, .comment)
                continue
            }

            let unit = characters[index]

            // Line comment.
            if unit == 47, index + 1 < characters.count, characters[index + 1] == 47 {
                emit(index, characters.count - index, .comment)
                return
            }
            // Block comment start.
            if unit == 47, index + 1 < characters.count, characters[index + 1] == 42 {
                inBlockComment = true
                let start = index
                index += 2
                while index < characters.count {
                    if characters[index] == 42, index + 1 < characters.count, characters[index + 1] == 47 {
                        index += 2
                        inBlockComment = false
                        break
                    }
                    index += 1
                }
                emit(start, index - start, .comment)
                continue
            }
            // String literal with escapes.
            if unit == 34 {
                let start = index
                index += 1
                while index < characters.count {
                    if characters[index] == 92, index + 1 < characters.count {
                        index += 2
                        continue
                    }
                    if characters[index] == 34 {
                        index += 1
                        break
                    }
                    index += 1
                }
                emit(start, index - start, .string)
                continue
            }
            // Number.
            if isDigit(unit) {
                let start = index
                while index < characters.count, isDigit(characters[index]) || characters[index] == 46 {
                    index += 1
                }
                emit(start, index - start, .number)
                previousWord = ""
                continue
            }
            // Word: keyword, type, target, or declaration name.
            if isLetter(unit) {
                let start = index
                while index < characters.count, isLetter(characters[index]) || isDigit(characters[index]) {
                    index += 1
                }
                let word = String(utf16CodeUnits: Array(characters[start..<index]), count: index - start)
                if Self.nativeTargets.contains(word) && previousWord == "native" {
                    emit(start, word.utf16.count, .nativeTarget)
                } else if Self.keywords.contains(word) || Self.nativeTargets.contains(word) {
                    emit(start, word.utf16.count, .keyword)
                } else if Self.primitiveTypes.contains(word) {
                    emit(start, word.utf16.count, .typeName)
                } else if Self.declarationKeywords.contains(previousWord) {
                    emit(start, word.utf16.count, .declarationName)
                } else if let first = word.unicodeScalars.first,
                          CharacterSet.uppercaseLetters.contains(first) {
                    emit(start, word.utf16.count, .typeName)
                }
                previousWord = word
                continue
            }
            // Route path: '/segment' or '/:param' after the 'route' keyword.
            if unit == 47, previousWord == "route" || previousWord == "/segment" {
                let start = index
                while index < characters.count {
                    let c = characters[index]
                    if c == 47 || c == 58 || isLetter(c) || isDigit(c) {
                        index += 1
                    } else {
                        break
                    }
                }
                emit(start, index - start, .routePath)
                previousWord = "/segment"
                continue
            }
            index += 1
        }
    }
}
