import AppKit
import PkmnLifeRemoteKit
import SwiftUI

/// The floating remote: a glass card of round buttons (the people to the left of the bar, the ticket, the people to
/// the right), and under it, while the pointer is on the panel, a second card with the status, Title Card, Stop,
/// Settings and the … menu. The tab that pins or tucks the panel is on the left.
struct RemotePanelView: View {
    let model: RemoteModel
    let controller: PanelController

    /// Both cards' width: room for three buttons, and more as people are added.
    static func width(buttons: Int) -> CGFloat { max(272, 20 + CGFloat(buttons) * 81 + CGFloat(buttons - 1) * 4) }

    var body: some View {
        let state = controller.state
        let row = Catalog.row(model.people)
        let width = Self.width(buttons: row.count)
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
                    ForEach(row) { entry in
                        EntryButton(entry: entry, model: model)
                    }
                }
                .padding(.horizontal, 10)
                .padding(.vertical, 14)
                .frame(width: width)
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
            .frame(width: width)
        }
        .padding(12)
        .fixedSize()
        // A person added or removed changes the panel's size: place the window again once the view has it.
        .onChange(of: model.people) { controller.layout(animated: false) }
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
                    StatusDot(model: model)
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
                PillButton(title: "Title Card", symbol: "calendar.badge.clock", color: Palette.busy, busy: model.sending == "card") {
                    model.titleCard()
                }
                .help("Plays today's Majora's Mask title card")
                .accessibilityHint("Plays today's Majora's Mask title card on the bar.")
                PillButton(title: "Stop", symbol: "stop.fill", color: Palette.stop, busy: model.sending == "stop") {
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

/// Green while the bar answers, the BUSY orange while the simulator does, grey otherwise.
struct StatusDot: View {
    let model: RemoteModel

    var body: some View {
        Image(systemName: "circle.fill")
            .font(.system(size: 8))
            .foregroundStyle(!model.connected ? Color.secondary : model.simulator ? Palette.busy : Color.green)
            .accessibilityHidden(true)
    }
}
