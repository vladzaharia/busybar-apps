// swift-tools-version:5.9
// Pkmn Life Remote: a menu bar app for macOS that plays Pkmn Life entries on a BUSY Bar.
// Build the app bundle with ./build-app.sh (see ../README.md).

import PackageDescription

let package = Package(
    name: "PkmnLifeRemote",
    platforms: [.macOS(.v13)],
    targets: [
        .executableTarget(name: "PkmnLifeRemote", path: "Sources/PkmnLifeRemote"),
    ]
)
