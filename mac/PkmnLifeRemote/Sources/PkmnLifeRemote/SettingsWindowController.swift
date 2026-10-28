import AppKit
import SwiftUI

/// The Settings window, with toolbar tabs like the system's: General (the bar, the panel) and Pkmn Life (the app's
/// own settings on the bar). Built in AppKit because the floating panel lives outside SwiftUI's scenes, where
/// SwiftUI's openSettings doesn't reach.
final class SettingsWindowController {
    private let model: RemoteModel
    private let barSettings: BarSettingsModel
    private let panel: () -> PanelController
    private var window: NSWindow?

    init(model: RemoteModel, barSettings: BarSettingsModel, panel: @escaping () -> PanelController) {
        self.model = model
        self.barSettings = barSettings
        self.panel = panel
    }

    func show() {
        if window == nil {
            let tabs = NSTabViewController()
            tabs.tabStyle = .toolbar
            tabs.addTabViewItem(tab("General", symbol: "gearshape", GeneralSettingsView(model: model, panel: panel())))
            tabs.addTabViewItem(tab("Pkmn Life", symbol: "rectangle.3.group", BarAppSettingsView(settings: barSettings)))
            let window = NSWindow(contentViewController: tabs)
            window.styleMask = [.titled, .closable]
            window.toolbarStyle = .preference
            window.isReleasedWhenClosed = false
            window.center()
            self.window = window
        }
        // Re-read the bar's settings each time, in case they were changed on the bar.
        if window?.isVisible != true { barSettings.load() }
        NSApp.activate()
        window?.makeKeyAndOrderFront(nil)
    }

    private func tab(_ label: String, symbol: String, _ view: some View) -> NSTabViewItem {
        let host = NSHostingController(rootView: view)
        host.sizingOptions = .preferredContentSize
        let item = NSTabViewItem(viewController: host)
        item.label = label
        item.image = NSImage(systemSymbolName: symbol, accessibilityDescription: label)
        return item
    }
}
