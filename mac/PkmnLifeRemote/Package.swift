// swift-tools-version: 6.2
// Pkmn Life Remote: a Mac app that plays Pkmn Life entries on a BUSY Bar and edits its settings.
// Build the app bundle with ./build-app.sh; run the tests with `swift test` (see ../README.md). On Linux there is
// no AppKit or SwiftUI, so only PkmnLifeRemoteKit and its tests are built: `swift test` works there too.

import PackageDescription

var targets: [Target] = [
    // Logic with no UI: the bar's API, the request format, Pkmn Life's entries and settings, where the panel goes.
    .target(name: "PkmnLifeRemoteKit"),
    .testTarget(name: "PkmnLifeRemoteKitTests", dependencies: ["PkmnLifeRemoteKit"]),
]

#if os(macOS)
// The app: menu bar item, the glass panel, settings. Everything runs on the main actor unless it says not to.
targets.append(
    .executableTarget(
        name: "PkmnLifeRemote",
        dependencies: ["PkmnLifeRemoteKit"],
        swiftSettings: [.defaultIsolation(MainActor.self)]
    )
)
#endif

let package = Package(
    name: "PkmnLifeRemote",
    platforms: [.macOS(.v26)],
    targets: targets
)
