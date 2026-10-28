import AppKit

/// Command-line options, for screenshots and checks (Tools/screenshots.sh) and for trying the app without a bar
/// (Tools/mock-bar.py). Any saved preference can also be overridden for one run the usual way, e.g.
/// `-host 127.0.0.1:8787 -dockMode tucked`.
///
///   --appearance light|dark          force the appearance
///   --pin                            bring the panel out and keep it out
///   --peek                           bring the panel out as if pointed at
///   --settings general|pkmn-life     open Settings on that tab
///   --snapshot <dir>                 after a moment, write each window's contents to <dir> as PNG, then quit
struct LaunchOptions {
    var appearance: NSAppearance.Name?
    var pin = false
    var peek = false
    var settingsTab: SettingsWindowController.Tab?
    var snapshotDirectory: URL?

    static let current = LaunchOptions(arguments: ProcessInfo.processInfo.arguments)

    init(arguments: [String]) {
        var rest = arguments.dropFirst()[...]
        while let arg = rest.popFirst() {
            switch arg {
            case "--appearance":
                appearance = rest.popFirst() == "dark" ? .darkAqua : .aqua
            case "--pin":
                pin = true
            case "--peek":
                peek = true
            case "--settings":
                settingsTab = rest.popFirst().flatMap(SettingsWindowController.Tab.init(rawValue:)) ?? .general
            case "--snapshot":
                snapshotDirectory = rest.popFirst().map { URL(fileURLWithPath: $0, isDirectory: true) }
            default:
                break
            }
        }
    }
}

enum Snapshot {
    /// Writes every visible window's contents to `directory` as "<name>.png". This draws the views themselves, so it
    /// needs no Screen Recording permission, but effects that sample what is behind a window (Liquid Glass) may come
    /// out flat: screencapture shows the real thing where it is allowed.
    static func write(to directory: URL) {
        try? FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
        for (k, window) in NSApp.windows.enumerated() where window.isVisible {
            guard let view = window.contentView, let rep = view.bitmapImageRepForCachingDisplay(in: view.bounds) else { continue }
            view.cacheDisplay(in: view.bounds, to: rep)
            let name = window is FloatingPanel ? "panel" : window.title.isEmpty ? "window-\(k)" : window.title.lowercased().replacingOccurrences(of: " ", with: "-")
            try? rep.representation(using: .png, properties: [:])?.write(to: directory.appending(path: "\(name).png"))
        }
    }
}
