// swift-tools-version:5.10
import PackageDescription

// IDECore is the platform-neutral heart of the macOS IDE: manifest parsing,
// the LSP client, semantic-token decoding, build running, and the fallback
// syntax highlighter. It depends only on Foundation so `swift test` runs on
// macOS CI (and on Linux in principle). The SwiftUI app in App/ is built by
// the XcodeGen project (project.yml), not by this package.
let package = Package(
    name: "ClearKryptIDECore",
    platforms: [
        .macOS(.v14)
    ],
    products: [
        .library(name: "IDECore", targets: ["IDECore"])
    ],
    targets: [
        .target(
            name: "IDECore",
            path: "Sources/IDECore"
        ),
        .testTarget(
            name: "IDECoreTests",
            dependencies: ["IDECore"],
            path: "Tests/IDECoreTests"
        ),
    ]
)
