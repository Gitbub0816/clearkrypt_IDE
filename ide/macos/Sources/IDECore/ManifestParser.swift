import Foundation

/// Errors thrown while loading a ClearKrypt project.
public enum ProjectError: Error, Equatable, CustomStringConvertible {
    case folderNotFound(String)
    case manifestNotFound(String)
    case manifestInvalid(String)

    public var description: String {
        switch self {
        case .folderNotFound(let path):
            return "Folder not found: \(path)"
        case .manifestNotFound(let path):
            return "No clearkrypt.toml found in \(path). Open a folder that contains a ClearKrypt project."
        case .manifestInvalid(let message):
            return "clearkrypt.toml is invalid: \(message)"
        }
    }
}

/// Which build targets a project enables.
public struct ProjectTargets: Equatable {
    public var swift: Bool
    public var kotlin: Bool
    public var react: Bool

    public init(swift: Bool, kotlin: Bool, react: Bool) {
        self.swift = swift
        self.kotlin = kotlin
        self.react = react
    }

    public var selected: [String] {
        var names: [String] = []
        if swift { names.append("swift") }
        if kotlin { names.append("kotlin") }
        if react { names.append("react") }
        return names
    }
}

/// Parsed contents of `clearkrypt.toml`.
///
/// The parser covers the same deliberate TOML subset the toolchain uses:
/// `[section]` headers, quoted-string and boolean values, `#` comments, and
/// blank lines. Anything else is an error rather than a silent guess.
public struct Manifest: Equatable {
    public let name: String
    public let version: String
    public let targets: ProjectTargets
    public let outputDir: String

    public static func parse(_ text: String) throws -> Manifest {
        var values: [String: String] = [:]
        var section = ""
        for rawLine in text.split(separator: "\n", omittingEmptySubsequences: false) {
            let line = rawLine.trimmingCharacters(in: .whitespaces)
            if line.isEmpty || line.hasPrefix("#") {
                continue
            }
            if line.hasPrefix("[") && line.hasSuffix("]") {
                section = String(line.dropFirst().dropLast()).trimmingCharacters(in: .whitespaces)
                continue
            }
            guard let equalsIndex = line.firstIndex(of: "=") else {
                throw ProjectError.manifestInvalid("expected 'key = value' but found '\(line)'")
            }
            let key = line[line.startIndex..<equalsIndex].trimmingCharacters(in: .whitespaces)
            let rawValue = line[line.index(after: equalsIndex)...].trimmingCharacters(in: .whitespaces)
            let value: String
            if rawValue == "true" || rawValue == "false" {
                value = rawValue
            } else if rawValue.hasPrefix("\"") && rawValue.hasSuffix("\"") && rawValue.count >= 2 {
                value = String(rawValue.dropFirst().dropLast())
            } else {
                throw ProjectError.manifestInvalid(
                    "unsupported value '\(rawValue)' — this version supports quoted strings and true/false")
            }
            values[section.isEmpty ? key : "\(section).\(key)"] = value
        }

        guard let name = values["project.name"], !name.isEmpty else {
            throw ProjectError.manifestInvalid("missing [project] name")
        }
        func boolValue(_ key: String, default defaultValue: Bool) -> Bool {
            switch values[key] {
            case "true": return true
            case "false": return false
            default: return defaultValue
            }
        }
        return Manifest(
            name: name,
            version: values["project.version"] ?? "0.1.0",
            targets: ProjectTargets(
                swift: boolValue("targets.swift", default: true),
                kotlin: boolValue("targets.kotlin", default: true),
                react: boolValue("targets.react", default: true)
            ),
            outputDir: values["output.dir"] ?? "generated"
        )
    }
}
