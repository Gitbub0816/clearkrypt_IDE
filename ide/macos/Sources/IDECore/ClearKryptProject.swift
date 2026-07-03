import Foundation

/// Purpose groups for the project navigator (Constitution Document 7 §7:
/// the navigator understands ClearKrypt project structure, not raw blobs).
public enum FileGroup: String, CaseIterable {
    case source = "Source"
    case generated = "Generated"
    case native = "Native"
    case config = "Config"
}

/// One file in the project, with its purpose group.
public struct ProjectFile: Equatable, Identifiable {
    public let relativePath: String
    public let group: FileGroup

    public var id: String { relativePath }
    public var name: String { (relativePath as NSString).lastPathComponent }
    /// Generated files open read-only (Constitution Document 7 §10).
    public var isReadOnly: Bool { group == .generated }
}

/// A loaded ClearKrypt project: manifest plus grouped file listings.
public struct ClearKryptProject {
    public let rootPath: String
    public let manifest: Manifest
    public let files: [ProjectFile]

    public var name: String { manifest.name }

    public static func load(folder: String) throws -> ClearKryptProject {
        let fileManager = FileManager.default
        var isDirectory: ObjCBool = false
        guard fileManager.fileExists(atPath: folder, isDirectory: &isDirectory), isDirectory.boolValue else {
            throw ProjectError.folderNotFound(folder)
        }
        let manifestPath = (folder as NSString).appendingPathComponent("clearkrypt.toml")
        guard fileManager.fileExists(atPath: manifestPath) else {
            throw ProjectError.manifestNotFound(folder)
        }
        let manifestText = try String(contentsOfFile: manifestPath, encoding: .utf8)
        let manifest = try Manifest.parse(manifestText)

        var files: [ProjectFile] = [ProjectFile(relativePath: "clearkrypt.toml", group: .config)]
        files.append(contentsOf: listFiles(root: folder, subdirectory: "src", group: .source))
        files.append(contentsOf: listFiles(root: folder, subdirectory: manifest.outputDir, group: .generated))
        files.append(contentsOf: listFiles(root: folder, subdirectory: "native", group: .native))
        return ClearKryptProject(rootPath: folder, manifest: manifest, files: files)
    }

    /// Files of one group, sorted by path for a stable navigator.
    public func files(in group: FileGroup) -> [ProjectFile] {
        files.filter { $0.group == group }.sorted { $0.relativePath < $1.relativePath }
    }

    public func absolutePath(for file: ProjectFile) -> String {
        (rootPath as NSString).appendingPathComponent(file.relativePath)
    }

    public var rootUri: String {
        "file://" + rootPath
    }

    public func uri(for file: ProjectFile) -> String {
        "file://" + absolutePath(for: file)
    }

    private static func listFiles(root: String, subdirectory: String, group: FileGroup) -> [ProjectFile] {
        let base = (root as NSString).appendingPathComponent(subdirectory)
        guard let enumerator = FileManager.default.enumerator(atPath: base) else {
            return []
        }
        var result: [ProjectFile] = []
        while let entry = enumerator.nextObject() as? String {
            var entryIsDirectory: ObjCBool = false
            let fullPath = (base as NSString).appendingPathComponent(entry)
            if FileManager.default.fileExists(atPath: fullPath, isDirectory: &entryIsDirectory),
               !entryIsDirectory.boolValue {
                result.append(ProjectFile(relativePath: subdirectory + "/" + entry, group: group))
            }
        }
        return result.sorted { $0.relativePath < $1.relativePath }
    }
}
