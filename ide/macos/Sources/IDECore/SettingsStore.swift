import Foundation

/// Local, non-versioned user preferences (Constitution Document 7 §20).
/// UserDefaults-backed with an injectable instance for tests.
public final class SettingsStore {
    private enum Keys {
        static let sdkPath = "clearkrypt.sdkPath"
        static let recentProjects = "clearkrypt.recentProjects"
    }

    private let defaults: UserDefaults

    public init(defaults: UserDefaults = .standard) {
        self.defaults = defaults
    }

    public var sdkPath: String? {
        get { defaults.string(forKey: Keys.sdkPath) }
        set { defaults.set(newValue, forKey: Keys.sdkPath) }
    }

    public var recentProjects: [String] {
        defaults.stringArray(forKey: Keys.recentProjects) ?? []
    }

    /// Most recent first, deduplicated, capped at ten.
    public func addRecentProject(_ path: String) {
        var recents = recentProjects.filter { $0 != path }
        recents.insert(path, at: 0)
        if recents.count > 10 {
            recents = Array(recents.prefix(10))
        }
        defaults.set(recents, forKey: Keys.recentProjects)
    }

    public func clearRecentProjects() {
        defaults.removeObject(forKey: Keys.recentProjects)
    }
}
