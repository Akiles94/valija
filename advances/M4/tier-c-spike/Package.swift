// swift-tools-version:5.9
import PackageDescription

// Throwaway package for the M4 Tier C compatibility spike (advances/M4/spike.md).
// Not a permanent dependency of this repo -- deleted once the spike's result is
// recorded (see advances/M4/refined.md D-L and plan.md's acceptance criteria:
// "the spike leaves no mobile toolchain, dependency, or CI job in this repo").
let package = Package(
    name: "ValijaTierCSpike",
    platforms: [.macOS(.v13)],
    dependencies: [
        // The official SQLCipher package, maintained by Zetetic (SQLCipher's own
        // authors) -- the exact dependency a real iOS app would declare via SPM.
        .package(url: "https://github.com/sqlcipher/SQLCipher.swift.git", from: "4.10.0")
    ],
    targets: [
        .executableTarget(
            name: "ValijaTierCSpike",
            dependencies: [
                .product(name: "SQLCipher", package: "SQLCipher.swift")
            ],
            // Matches SQLCipher.swift's own SQLCipherTests target exactly: without this,
            // sqlite3_key and the other codec-specific declarations are conditionally
            // compiled out of the imported header, and the build fails with
            // "cannot find 'sqlite3_key' in scope" -- confirmed by this spike's first run.
            cSettings: [.define("SQLITE_HAS_CODEC", to: nil)]
        )
    ]
)
