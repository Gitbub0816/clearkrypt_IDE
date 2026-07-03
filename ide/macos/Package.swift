// swift-tools-version:5.10
import PackageDescription

let package = Package(
    name: "ClearKryptIDECore",
    platforms: [
        .macOS(.v13)
    ],
    products: [
        .library(
            name: "IDECore",
            targets: ["IDECore"]
        )
    ],
    targets: [
        .target(
            name: "IDECore",
            dependencies: [],
            path: "Sources/IDECore"
        ),
        .testTarget(
            name: "IDECoreTests",
            dependencies: ["IDECore"],
            path: "Tests/IDECoreTests"
        )
    ]
)
