import AppKit
import PkmnLifeRemoteKit
import SwiftUI

@main
struct PkmnLifeRemoteApp: App {
    @NSApplicationDelegateAdaptor(AppDelegate.self) private var delegate

    var body: some Scene {
        // The panel at the top right is the remote; the menu bar item is a way back to everything when it's tucked.
        MenuBarExtra("Pkmn Life Remote", systemImage: "rectangle.3.group.fill") {
            MenuBarMenu(model: delegate.model, panel: delegate.panel)
        }
    }
}

final class AppDelegate: NSObject, NSApplicationDelegate {
    let model = RemoteModel()
    private(set) lazy var barSettings = BarSettingsModel(remote: model)
    private(set) lazy var settingsWindow = SettingsWindowController(model: model, barSettings: barSettings) { [unowned self] in panel }
    private(set) lazy var panel = PanelController(model: model) { [unowned self] in settingsWindow.show() }

    func applicationDidFinishLaunching(_ notification: Notification) {
        // A menu bar app: no Dock icon (Info.plist's LSUIElement does the same in the app bundle).
        NSApp.setActivationPolicy(.accessory)
        panel.show()
        model.checkConnection()
    }

    /// Opened again from Finder or Spotlight: bring the panel out.
    func applicationShouldHandleReopen(_ sender: NSApplication, hasVisibleWindows flag: Bool) -> Bool {
        panel.reveal()
        return false
    }
}

/// The menu bar item's menu: each entry (a click's choice, or a particular version), the panel's placement, settings.
struct MenuBarMenu: View {
    let model: RemoteModel
    let panel: PanelController

    var body: some View {
        ForEach(Catalog.entries) { entry in
            Menu(entry.title) {
                Button("Play (\(Catalog.choiceName(model.clickChoice(for: entry), in: entry)))") { model.play(entry) }
                Divider()
                Button("Random") { model.play(entry, as: Catalog.randomChoice) }
                ForEach(entry.styles) { style in
                    Button(style.name) { model.play(entry, as: style.id) }
                }
            }
        }
        Button("Title Card") { model.titleCard() }
        Button("Stop") { model.stop() }
        Divider()
        Button("Start Pkmn Life on the Bar") { model.launchApp() }
        Picker("Panel", selection: Binding(get: { panel.dockMode }, set: { panel.dockMode = $0 })) {
            ForEach(DockMode.allCases) { Text($0.title).tag($0) }
        }
        Button("Show Panel") { panel.reveal() }
        Divider()
        Button("Settings…") { panel.openSettings() }
            .keyboardShortcut(",")
        Button("Quit Pkmn Life Remote") { NSApp.terminate(nil) }
            .keyboardShortcut("q")
    }
}
