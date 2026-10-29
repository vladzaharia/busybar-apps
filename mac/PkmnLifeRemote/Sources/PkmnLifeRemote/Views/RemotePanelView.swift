import AppKit
import PkmnLifeRemoteKit
import SwiftUI

/// The floating remote: a glass card of round buttons (Sam, the ticket, Alex), and under it, while the pointer is on
/// the panel, a second card with the status, Title Card, Stop, Settings and the … menu. The tab that pins or tucks
/// the panel is on the left.
struct RemotePanelView: View {
    let model: RemoteModel
    let controller: PanelController

    static let width: CGFloat = 272

    /// Left to right as the redirects point: Sam to the left, the ticket, Alex to the right. Entries without a
    /// place here go at the end.
    static let row: [Entry] = {
        let order = ["sam", "ticket", "alex"]
        return Catalog.entries.sorted { (order.firstIndex(of: $0.id) ?? order.count) < (order.firstIndex(of: $1.id) ?? order.count) }
    }()

    var body: some View {
        let state = controller.state
        VStack(alignment: .trailing, spacing: 10) {
            HStack(spacing: 6) {
                // The tab's place is kept when the panel doesn't tuck, so the panel stays the same size; that strip
                // is transparent, and clicks there go to the window below.
                DockTab(state: state) { controller.togglePin() }
                    .frame(maxHeight: .infinity)
                    .opacity(state.tucks ? 1 : 0)
                    .allowsHitTesting(state.tucks)
                    .accessibilityHidden(!state.tucks)
                    .onHover { controller.hover(.tab, $0) }

                HStack(spacing: 4) {
                    ForEach(Self.row) { entry in
                        EntryButton(entry: entry, model: model)
                    }
                }
                .padding(.horizontal, 10)
                .padding(.vertical, 14)
                .frame(width: Self.width)
                .glassEffect(.regular, in: .rect(cornerRadius: 28))
                .onHover { controller.hover(.buttons, $0) }
            }
            .fixedSize(horizontal: false, vertical: true)

            // The window keeps room for the card whether it shows or not, so it never resizes under the pointer;
            // while the card is hidden that room is transparent, and clicks there go to the window below.
            ZStack(alignment: .top) {
                DetailsCard(model: model, controller: controller)
                    .hidden()
                    .accessibilityHidden(true)
                if state.details {
                    DetailsCard(model: model, controller: controller)
                        .glassEffect(.regular, in: .rect(cornerRadius: 22))
                        .glassEffectTransition(.materialize)
                        .transition(.opacity.combined(with: .offset(y: -6)))
                        .onHover { controller.hover(.details, $0) }
                }
            }
            .frame(width: Self.width)
        }
        .padding(12)
        .fixedSize()
    }
}

/// The card that shows while the pointer is on the panel: whether the bar answers and the last result, Title Card,
/// Stop, Settings, and the … menu.
struct DetailsCard: View {
    let model: RemoteModel
    let controller: PanelController

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack(alignment: .top, spacing: 6) {
                HStack(alignment: .firstTextBaseline, spacing: 8) {
                    Image(systemName: "circle.fill")
                        .font(.system(size: 8))
                        .foregroundStyle(model.connected ? Color.green : Color.secondary)
                        .accessibilityHidden(true)
                    // Two lines' room either way, so the card keeps its size as the status changes.
                    Text(model.status)
                        .font(.callout)
                        .lineLimit(2, reservesSpace: true)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .help(model.status)
                }
                .padding(.top, 5)
                IconButton(symbol: "gearshape", label: "Settings") { controller.openSettings() }
                PanelMenuButton(model: model, controller: controller)
            }
            HStack(spacing: 8) {
                PillButton(title: "Title Card", symbol: "calendar.badge.clock", busy: model.sending == "card") {
                    model.titleCard()
                }
                .help("Plays today's Majora's Mask title card")
                .accessibilityHint("Plays today's Majora's Mask title card on the bar.")
                PillButton(title: "Stop", symbol: "stop.fill", busy: model.sending == "stop") {
                    model.stop()
                }
                .accessibilityHint("Stops whatever is playing on the bar.")
            }
        }
        .padding(14)
    }
}

/// The … button and its menu: the bar, where the panel stays, Quit.
private struct PanelMenuButton: View {
    let model: RemoteModel
    let controller: PanelController

    @State private var hovering = false

    var body: some View {
        Menu {
            Button("Start Pkmn Life on the Bar", systemImage: "play.rectangle") { model.launchApp() }
            Button("Check Connection", systemImage: "antenna.radiowaves.left.and.right") { model.checkConnection() }
            Divider()
            Picker("Placement", selection: Binding(get: { controller.dockMode }, set: { controller.dockMode = $0 })) {
                ForEach(DockMode.allCases) { Text($0.title).tag($0) }
            }
            Divider()
            Button("Quit Pkmn Life Remote", systemImage: "power") { NSApp.terminate(nil) }
        } label: {
            Image(systemName: "ellipsis")
                .iconButtonFace(hovering: hovering)
        }
        .menuStyle(.button)
        .buttonStyle(.plain)
        .menuIndicator(.hidden)
        .fixedSize()
        .onHover { hovering = $0 }
        .help("More")
        .accessibilityLabel("More")
    }
}
