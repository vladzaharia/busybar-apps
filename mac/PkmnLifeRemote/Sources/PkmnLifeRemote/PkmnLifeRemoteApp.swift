import AppKit
import SwiftUI

final class AppDelegate: NSObject, NSApplicationDelegate {
    func applicationDidFinishLaunching(_ notification: Notification) {
        // A menu bar app: no Dock icon (Info.plist's LSUIElement does the same in the app bundle).
        NSApp.setActivationPolicy(.accessory)
    }
}

@main
struct PkmnLifeRemoteApp: App {
    @NSApplicationDelegateAdaptor(AppDelegate.self) private var delegate
    @StateObject private var model = RemoteModel()

    var body: some Scene {
        MenuBarExtra("Pkmn Life", systemImage: "rectangle.3.group.fill") {
            ControlCenterView(model: model)
        }
        .menuBarExtraStyle(.window)

        Window("Pkmn Life Remote", id: "panel") {
            ControlCenterView(model: model, floating: true)
                .background(FloatingWindow())
        }
        .windowResizability(.contentSize)

        Settings {
            SettingsView(model: model)
        }
    }
}

/// Keeps the panel's window above other windows and on every Space, like a palette.
struct FloatingWindow: NSViewRepresentable {
    func makeNSView(context: Context) -> NSView {
        let view = NSView()
        DispatchQueue.main.async {
            guard let window = view.window else { return }
            window.level = .floating
            window.collectionBehavior.insert(.canJoinAllSpaces)
            window.isMovableByWindowBackground = true
        }
        return view
    }

    func updateNSView(_ nsView: NSView, context: Context) {}
}
