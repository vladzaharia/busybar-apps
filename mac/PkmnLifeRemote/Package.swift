// swift-tools-version: 6.2
// Pkmn Life Remote: a menu bar app for macOS that plays Pkmn Life entries on a BUSY Bar.
// Build the app bundle with ./build-app.sh; run the tests with `swift test` (see ../README.md).

import PackageDescription

let package = Package(
    name: "PkmnLifeRemote",
    platforms: [.macOS(.v26)],
    targets: [
        // Logic with no UI: the bar's API, the request format, where the panel goes. Tested.
        .target(name: "PkmnLifeRemoteKit"),
        // The app: menu bar item, the glass panel, settings. Everything runs on the main actor unless it says not to.
        .executableTarget(
            name: "PkmnLifeRemote",
            dependencies: ["PkmnLifeRemoteKit"],
            swiftSettings: [.defaultIsolation(MainActor.self)]
        ),
        .testTarget(name: "PkmnLifeRemoteKitTests", dependencies: ["PkmnLifeRemoteKit"]),
    ]
)
