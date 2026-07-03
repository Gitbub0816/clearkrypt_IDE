import XCTest
@testable import IDECore

final class ManifestParserTests: XCTestCase {
    func testParsesTheHelloWorldManifestShape() throws {
        let manifest = try Manifest.parse("""
            [project]
            name = "hello-world"
            version = "0.1.0"

            [targets]
            swift = true
            kotlin = true
            react = true

            [output]
            dir = "generated"
            """)
        XCTAssertEqual(manifest.name, "hello-world")
        XCTAssertEqual(manifest.version, "0.1.0")
        XCTAssertTrue(manifest.targets.swift)
        XCTAssertEqual(manifest.targets.selected, ["swift", "kotlin", "react"])
        XCTAssertEqual(manifest.outputDir, "generated")
    }

    func testDefaultsApplyWhenSectionsAreMissing() throws {
        let manifest = try Manifest.parse("[project]\nname = \"tiny\"\n")
        XCTAssertEqual(manifest.version, "0.1.0")
        XCTAssertTrue(manifest.targets.react)
        XCTAssertEqual(manifest.outputDir, "generated")
    }

    func testMissingNameIsAnError() {
        XCTAssertThrowsError(try Manifest.parse("[targets]\nswift = true\n"))
    }

    func testUnsupportedValueSyntaxIsAnError() {
        XCTAssertThrowsError(try Manifest.parse("[project]\nname = [1, 2]\n"))
    }

    func testLoadsTheRealFixtureWhenRepoRootIsProvided() throws {
        guard let repoRoot = ProcessInfo.processInfo.environment["CK_REPO_ROOT"] else {
            throw XCTSkip("CK_REPO_ROOT not set; fixture test runs in CI.")
        }
        let project = try ClearKryptProject.load(
            folder: repoRoot + "/tests/fixtures/projects/hello-world")
        XCTAssertEqual(project.name, "hello-world")
        XCTAssertEqual(project.files(in: .source).map(\.relativePath), ["src/main.ck"])
        XCTAssertEqual(project.files(in: .config).map(\.relativePath), ["clearkrypt.toml"])
    }
}
