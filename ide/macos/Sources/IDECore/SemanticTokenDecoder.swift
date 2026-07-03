import Foundation

/// One decoded semantic token: absolute position plus resolved names.
public struct TokenSpan: Equatable {
    public let line: Int
    public let startCharacter: Int
    public let length: Int
    public let typeName: String
    public let modifiers: [String]
}

/// Decodes the LSP delta-encoded semantic token array using the exact
/// legend from docs/21-language-server.md. Order is protocol; never reorder.
public enum SemanticTokenDecoder {
    public static let tokenTypes: [String] = [
        "namespace", "type", "enum", "enumMember", "struct", "parameter",
        "variable", "property", "function", "keyword", "string", "number",
        "comment", "operator",
        "model", "screen", "component", "route", "capability", "errorType",
        "nativeTarget",
    ]

    public static let tokenModifiers: [String] = [
        "declaration", "defaultLibrary", "generated", "inferred", "targetSpecific",
    ]

    public static func decode(_ data: [Int]) -> [TokenSpan] {
        var spans: [TokenSpan] = []
        var line = 0
        var character = 0
        var index = 0
        while index + 5 <= data.count {
            let deltaLine = data[index]
            let deltaChar = data[index + 1]
            let length = data[index + 2]
            let typeIndex = data[index + 3]
            let modifierBits = data[index + 4]
            index += 5

            if deltaLine > 0 {
                line += deltaLine
                character = deltaChar
            } else {
                character += deltaChar
            }
            let typeName = typeIndex >= 0 && typeIndex < tokenTypes.count
                ? tokenTypes[typeIndex]
                : "unknown"
            var modifiers: [String] = []
            for (bit, name) in tokenModifiers.enumerated() where (modifierBits & (1 << bit)) != 0 {
                modifiers.append(name)
            }
            spans.append(TokenSpan(
                line: line,
                startCharacter: character,
                length: length,
                typeName: typeName,
                modifiers: modifiers))
        }
        return spans
    }
}
