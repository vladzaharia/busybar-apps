import AppKit
import SwiftUI

/// Command-line options, for screenshots and checks (Tools/screenshots.sh) and for trying the app without a bar
/// (Tools/mock-bar.py). Any saved preference can also be overridden for one run the usual way, e.g.
/// `-host 127.0.0.1:8787 -dockMode tucked`.
///
///   --appearance light|dark          force the appearance
///   --pin                            bring the panel out and keep it out
///   --peek                           act as if pointed at: the panel out, with the card under its buttons
///   --settings general|pkmn-life     open Settings on that tab
///   --snapshot <dir>                 after a moment, write each window's contents, and the panel as SwiftUI draws
///                                    it, to <dir> as PNG (see Snapshot), then quit
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
    /// Writes every visible window's contents to `directory` as "<name>.png", and the panel drawn by SwiftUI alone as
    /// "panel-render.png". This needs no Screen Recording permission and works with the screen locked, but leaves
    /// out effects that sample what is behind a window: the window snapshots lose Liquid Glass and some layers (the
    /// panel's symbols and fills), the render loses glass and draws the … menu as a placeholder. screencapture shows
    /// the real thing where it is allowed.
    static func write(to directory: URL) {
        try? FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
        if let panel = NSApp.windows.first(where: { $0 is FloatingPanel }), let root = panel.contentView?.subviews.first as? NSHostingView<RemotePanelView> {
            render(root.rootView, appearance: panel.effectiveAppearance, to: directory.appending(path: "panel-render.png"))
        }
        for (k, window) in NSApp.windows.enumerated() where window.isVisible {
            guard let view = window.contentView, let rep = view.bitmapImageRepForCachingDisplay(in: view.bounds) else { continue }
            // An opaque window's background first: in dark mode its light text is unreadable on a transparent PNG.
            if window.isOpaque, let context = NSGraphicsContext(bitmapImageRep: rep) {
                NSGraphicsContext.saveGraphicsState()
                NSGraphicsContext.current = context
                window.effectiveAppearance.performAsCurrentDrawingAppearance {
                    window.backgroundColor.setFill()
                    CGRect(origin: .zero, size: rep.size).fill()
                }
                NSGraphicsContext.restoreGraphicsState()
            }
            view.cacheDisplay(in: view.bounds, to: rep)
            let name = window is FloatingPanel ? "panel" : window.title.isEmpty ? "window-\(k)" : window.title.lowercased().replacingOccurrences(of: " ", with: "-")
            try? rep.representation(using: .png, properties: [:])?.write(to: directory.appending(path: "\(name).png"))
        }
    }

    /// `view` at 2x on the window background of `appearance`.
    private static func render(_ view: some View, appearance: NSAppearance, to url: URL) {
        let dark = appearance.bestMatch(from: [.aqua, .darkAqua]) == .darkAqua
        let renderer = ImageRenderer(content: view
            .background(Color(nsColor: .windowBackgroundColor))
            .environment(\.colorScheme, dark ? .dark : .light))
        renderer.scale = 2
        guard let image = renderer.cgImage else { return }
        try? NSBitmapImageRep(cgImage: image).representation(using: .png, properties: [:])?.write(to: url)
    }
}
