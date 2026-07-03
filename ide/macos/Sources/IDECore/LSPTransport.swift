import Foundation

/// The byte pipe under the LSP client: a real child process in the app, a
/// mock in tests.
public protocol LSPTransport: AnyObject {
    var onReceive: ((Data) -> Void)? { get set }
    var onClose: ((Error?) -> Void)? { get set }
    func send(_ data: Data)
    func start() throws
    func stop()
}

/// Launches the ClearKrypt language server as a child process and exchanges
/// framed bytes over its stdin/stdout.
public final class ProcessTransport: LSPTransport {
    public var onReceive: ((Data) -> Void)?
    public var onClose: ((Error?) -> Void)?

    private let executable: String
    private let arguments: [String]
    private let workingDirectory: String?
    private var process: Process?
    private var stdinPipe: Pipe?

    public init(executable: String, arguments: [String], workingDirectory: String?) {
        self.executable = executable
        self.arguments = arguments
        self.workingDirectory = workingDirectory
    }

    public func start() throws {
        let process = Process()
        let stdin = Pipe()
        let stdout = Pipe()
        let stderr = Pipe()

        // Resolve bare command names through /usr/bin/env so PATH lookup
        // matches what a terminal would do.
        if executable.contains("/") {
            process.executableURL = URL(fileURLWithPath: executable)
            process.arguments = arguments
        } else {
            process.executableURL = URL(fileURLWithPath: "/usr/bin/env")
            process.arguments = [executable] + arguments
        }
        if let workingDirectory {
            process.currentDirectoryURL = URL(fileURLWithPath: workingDirectory)
        }
        process.standardInput = stdin
        process.standardOutput = stdout
        process.standardError = stderr

        stdout.fileHandleForReading.readabilityHandler = { [weak self] handle in
            let data = handle.availableData
            if !data.isEmpty {
                self?.onReceive?(data)
            }
        }
        process.terminationHandler = { [weak self] _ in
            self?.onClose?(nil)
        }

        try process.run()
        self.process = process
        self.stdinPipe = stdin
    }

    public func send(_ data: Data) {
        stdinPipe?.fileHandleForWriting.write(data)
    }

    public func stop() {
        process?.terminationHandler = nil
        process?.terminate()
        process = nil
        stdinPipe = nil
    }
}

/// Resolves the `clearkrypt` command per docs/21: explicit user setting,
/// then the CLEARKRYPT_SDK environment variable, then PATH.
public enum SdkResolver {
    public static func resolveCommand(
        userSetting: String?,
        environment: [String: String] = ProcessInfo.processInfo.environment
    ) -> String {
        if let userSetting, !userSetting.isEmpty {
            // Accept either the executable itself or an SDK directory.
            if FileManager.default.fileExists(atPath: userSetting + "/bin/clearkrypt") {
                return userSetting + "/bin/clearkrypt"
            }
            return userSetting
        }
        if let sdkDir = environment["CLEARKRYPT_SDK"], !sdkDir.isEmpty {
            let candidate = sdkDir + "/bin/clearkrypt"
            if FileManager.default.fileExists(atPath: candidate) {
                return candidate
            }
            return sdkDir
        }
        return "clearkrypt"
    }
}
