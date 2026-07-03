import XCTest
@testable import IDECore

final class BuildRunnerTests: XCTestCase {
    /// The exact sample payload documented in docs/21-language-server.md.
    private let docs21Sample = """
        {
          "ok": false,
          "diagnostics": [
            {
              "code": "CK0003",
              "severity": "error",
              "message": "Type mismatch",
              "file": "src/main.ck",
              "range": { "startLine": 4, "startColumn": 3, "endLine": 4, "endColumn": 9 },
              "target": "swift"
            }
          ],
          "generatedFiles": ["generated/swift/app/main/Greeting.swift"]
        }
        """

    func testParsesTheDocumentedContract() {
        let outcome = BuildOutcome.parse(exitCode: 1, stdout: docs21Sample, stderr: "")
        XCTAssertTrue(outcome.hasDiagnosticErrors)
        let result = outcome.result
        XCTAssertNotNil(result)
        XCTAssertEqual(result?.ok, false)
        XCTAssertEqual(result?.diagnostics.count, 1)
        XCTAssertEqual(result?.diagnostics.first?.code, "CK0003")
        XCTAssertEqual(result?.diagnostics.first?.range.startLine, 4)
        XCTAssertEqual(result?.diagnostics.first?.target, "swift")
        XCTAssertEqual(result?.generatedFiles, ["generated/swift/app/main/Greeting.swift"])
    }

    func testExitCodeSemantics() {
        XCTAssertTrue(BuildOutcome.parse(exitCode: 0, stdout: "{}", stderr: "").isSuccess)
        XCTAssertTrue(BuildOutcome.parse(exitCode: 64, stdout: "", stderr: "usage").isUsageError)
        XCTAssertTrue(BuildOutcome.parse(exitCode: 70, stdout: "", stderr: "boom").isInternalError)
    }

    func testMalformedStdoutYieldsNilResultNotACrash() {
        let outcome = BuildOutcome.parse(exitCode: 0, stdout: "not json", stderr: "")
        XCTAssertNil(outcome.result)
        XCTAssertEqual(outcome.rawStdout, "not json")
    }
}
