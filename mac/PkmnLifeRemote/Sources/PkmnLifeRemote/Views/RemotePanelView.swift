import AppKit
import PkmnLifeRemoteKit
import SwiftUI

/// The floating remote: a status line, a tile per entry plus the title card, and Stop, as one cluster of Liquid Glass
/// (no glass behind glass), with the tab that pins or tucks it on the left.
struct RemotePanelView: View {
    let model: RemoteModel
    let controller: PanelController

    static let width: CGFloat = 260
    private let tile = GridItem(.fixed((RemotePanelView.width - 10) / 2), spacing: 10)

    var body: some View {
        let state = controller.state
        HStack(alignment: .top, spacing: 6) {
            // The tab's place is kept when the panel doesn't tuck, so the panel stays the same size; that strip is
            // transparent, and clicks there go to the window below.
            DockTab(state: state) { controller.togglePin() }
                .opacity(state.tucks ? 1 : 0)
                .allowsHitTesting(state.tucks)
                .accessibilityHidden(!state.tucks)

            GlassEffectContainer(spacing: 10) {
                VStack(spacing: 10) {
                    StatusHeader(model: model, controller: controller)
                    LazyVGrid(columns: [tile, tile], spacing: 10) {
                        ForEach(Catalog.entries) { entry in
                            EntryTile(entry: entry, model: model)
                        }
                        ActionTile(title: "Title Card", symbol: "calendar.badge.clock", caption: "Today's dawn", busy: model.sending == "card") {
                            model.titleCard()
                        }
                        .accessibilityHint("Plays today's Majora's Mask title card on the bar.")
                    }
                    Button { model.stop() } label: {
                        Label("Stop", systemImage: "stop.fill")
                            .frame(maxWidth: .infinity)
                    }
                    .buttonStyle(.glass)
                    .controlSize(.large)
                    .accessibilityHint("Stops whatever is playing on the bar.")
                }
                .frame(width: Self.width)
            }
        }
        .padding(12)
        .fixedSize()
        .onHover { controller.hover($0) }
    }
}

/// Whether the bar answers, the last result, and the … menu.
struct StatusHeader: View {
    let model: RemoteModel
    let controller: PanelController

    var body: some View {
        HStack(spacing: 8) {
            Circle()
                .fill(model.connected ? Color.green : Color.secondary)
                .frame(width: 8, height: 8)
                .accessibilityHidden(true)
            Text(model.status)
                .font(.callout)
                .lineLimit(1)
                .truncationMode(.tail)
                .frame(maxWidth: .infinity, alignment: .leading)
                .help(model.status)
            Menu {
                PanelMenu(model: model, controller: controller)
            } label: {
                Image(systemName: "ellipsis")
                    .accessibilityLabel("More")
            }
            .menuStyle(.borderlessButton)
            .menuIndicator(.hidden)
            .fixedSize()
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 8)
        .glassEffect(.regular, in: .capsule)
    }
}

/// The … menu: the bar, where the panel stays, settings.
struct PanelMenu: View {
    let model: RemoteModel
    let controller: PanelController

    var body: some View {
        Button("Start Pkmn Life on the Bar", systemImage: "play.rectangle") { model.launchApp() }
        Button("Check Connection", systemImage: "antenna.radiowaves.left.and.right") { model.checkConnection() }
        Divider()
        Picker("Placement", selection: Binding(get: { controller.dockMode }, set: { controller.dockMode = $0 })) {
            ForEach(DockMode.allCases) { Text($0.title).tag($0) }
        }
        Button("Settings…", systemImage: "gearshape") { controller.openSettings() }
        Divider()
        Button("Quit Pkmn Life Remote", systemImage: "power") { NSApp.terminate(nil) }
    }
}
