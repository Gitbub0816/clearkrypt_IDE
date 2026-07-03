import Foundation

/// One diagnostic from the CLI JSON contract (docs/21: one-based positions).
public struct CliDiagnosticRange: Codable, Equatable {
    public let startLine: Int
    public let startColumn: Int
    public let endLine: Int
    public let endColumn: Int
}

public struct CliDiagnostic: Codable, Equatable {
    public let code: String
    public let severity: String
    public let message: String
    public let file: String
    public let range: CliDiagnosticRange
    public let target: String?
}

/// The single JSON document `clearkrypt check --json` / `build --json` print.
public struct CliResult: Codable, Equatable {
    public let ok: Bool
    public let diagnostics: [CliDiagnostic]
    public let generatedFiles: [String]?
}

/// Outcome of one CLI invocation, exit-code semantics per docs/21.
public struct BuildOutcome {
    public let exitCode: Int
    public let result: CliResult?
    public let rawStdout: String
    public let rawStderr: String

    public var isSuccess: Bool { exitCode == 0 }
    public var hasDiagnosticErrors: Bool { exitCode == 1 }
    public var isUsageError: Bool { exitCode == 64 }
    public var isInternalError: Bool { exitCode == 70 }

    public static func parse(exitCode: Int, stdout: String, stderr: String) -> BuildOutcome {
        let result = try? JSONDecoder().decode(CliResult.self, from: Data(stdout.utf8))
        return BuildOutcome(exitCode: exitCode, result: result, rawStdout: stdout, rawStderr: stderr)
    }
}

/// Runs `clearkrypt check --json` / `build --json` as a child process.
/// Build actions go through the CLI; language intelligence goes through the
/// LSP client — deliberately separate (docs/04-native-ide-architecture.md).
public final class BuildRunner {
    private let command: String

    public init(command: String) {
        self.command = command
    }

    public func run(
        subcommand: String,
        projectDirectory: String,
        targets: [String],
        completion: @escaping (Result<BuildOutcome, Error>) -> Void
    ) {
        let process = Process()
        if command.contains("/") {
            process.executableURL = URL(fileURLWithPath: command)
            process.arguments = buildArguments(subcommand: subcommand, targets: targets)
        } else {
            process.executableURL = URL(fileURLWithPath: "/usr/bin/env")
            process.arguments = [command] + buildArguments(subcommand: subcommand, targets: targets)
        }
        process.currentDirectoryURL = URL(fileURLWithPath: projectDirectory)

        let stdout = Pipe()
        let stderr = Pipe()
        process.standardOutput = stdout
        process.standardError = stderr

        process.terminationHandler = { finished in
            let outData = stdout.fileHandleForReading.readDataToEndOfFile()
            let errData = stderr.fileHandleForReading.readDataToEndOfFile()
            let outcome = BuildOutcome.parse(
                exitCode: Int(finished.terminationStatus),
                stdout: String(data: outData, encoding: .utf8) ?? "",
                stderr: String(data: errData, encoding: .utf8) ?? "")
            completion(.success(outcome))
        }

        do {
            try process.run()
        } catch {
            completion(.failure(error))
        }
    }

    private func buildArguments(subcommand: String, targets: [String]) -> [String] {
        var arguments = [subcommand, "--json"]
        for target in targets {
            arguments.append("--target")
            arguments.append(target)
        }
        return arguments
    }
}
