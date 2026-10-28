import AppKit
import SwiftUI

/// The remote's panel, in the style of Control Center: a tile per entry (click plays it; right-click picks a version),
/// a tile for today's title card, a stop button and the connection status.
struct ControlCenterView: View {
    @ObservedObject var model: RemoteModel
    /// Shown in its own floating window rather than the menu bar.
    var floating = false
    @Environment(\.openWindow) private var openWindow

    private let columns = [GridItem(.flexible(), spacing: 10), GridItem(.flexible(), spacing: 10)]

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            LazyVGrid(columns: columns, spacing: 10) {
                ForEach(Catalog.entries) { entry in
                    EntryTile(model: model, entry: entry)
                }
                Button { model.titleCard() } label: {
                    TileLabel(title: "Title Card", subtitle: "Dawn of the day", symbol: "sunrise.fill", busy: model.sending == "card")
                }
                .buttonStyle(TileButtonStyle())
                .help("Today's \"Dawn of the Nth Day\" card")
            }

            Button { model.stop() } label: {
                Label("Stop", systemImage: "stop.fill")
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 6)
                    .background(RoundedRectangle(cornerRadius: 10).fill(.quaternary))
            }
            .buttonStyle(.plain)

            HStack(spacing: 6) {
                Circle()
                    .fill(model.connected ? Color.green : Color.secondary)
                    .frame(width: 7, height: 7)
                Text(model.status)
                    .font(.caption)
                    .foregroundStyle(.secondary)
                    .lineLimit(2)
                    .frame(maxWidth: .infinity, alignment: .leading)
                Menu {
                    Button("Start Pkmn Life on the Bar") { model.launchApp() }
                    Button("Check Connection") { model.checkConnection() }
                    Divider()
                    if !floating {
                        Button("Show Floating Panel") {
                            openWindow(id: "panel")
                            NSApp.activate(ignoringOtherApps: true)
                        }
                    }
                    Button("Settings...") {
                        NSApp.activate(ignoringOtherApps: true)
                        NSApp.sendAction(Selector(("showSettingsWindow:")), to: nil, from: nil)
                    }
                    Divider()
                    Button("Quit Pkmn Life Remote") { NSApp.terminate(nil) }
                } label: {
                    Image(systemName: "ellipsis.circle")
                }
                .menuStyle(.borderlessButton)
                .menuIndicator(.hidden)
                .fixedSize()
            }
        }
        .padding(12)
        .frame(width: 300)
        .onAppear { model.checkConnection() }
    }
}

/// An entry's tile: click plays it as chosen; right-click plays a particular version or changes what a click plays.
struct EntryTile: View {
    @ObservedObject var model: RemoteModel
    let entry: Entry

    var body: some View {
        let choice = model.clickChoice(for: entry)
        Button { model.play(entry) } label: {
            TileLabel(title: entry.title, subtitle: Catalog.choiceName(choice, in: entry), symbol: entry.symbol, busy: model.sending == entry.id)
        }
        .buttonStyle(TileButtonStyle())
        .help("Click to play. Right-click to choose a version.")
        .contextMenu {
            Section("Play Now As") {
                ForEach(entry.styles) { style in
                    Button(style.name) { model.play(entry, as: style.id) }
                }
                Button("Random") { model.play(entry, as: Catalog.randomChoice) }
            }
            Picker("Click Plays", selection: Binding(get: { model.clickChoice(for: entry) }, set: { model.setClickChoice($0, for: entry) })) {
                Text("The Bar's Setting").tag(Catalog.defaultChoice)
                Text("Random").tag(Catalog.randomChoice)
                Divider()
                ForEach(entry.styles) { style in
                    Text(style.name).tag(style.id)
                }
            }
        }
    }
}

/// A Control Center tile: a round icon over a title and what it will do.
struct TileLabel: View {
    let title: String
    let subtitle: String
    let symbol: String
    let busy: Bool

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            ZStack {
                Circle().fill(Color.accentColor)
                if busy {
                    ProgressView().controlSize(.small).tint(.white)
                } else {
                    Image(systemName: symbol)
                        .font(.system(size: 13, weight: .semibold))
                        .foregroundStyle(.white)
                }
            }
            .frame(width: 28, height: 28)
            VStack(alignment: .leading, spacing: 1) {
                Text(title).font(.system(size: 13, weight: .semibold))
                Text(subtitle).font(.caption).foregroundStyle(.secondary).lineLimit(1)
            }
        }
        .frame(maxWidth: .infinity, minHeight: 78, alignment: .topLeading)
        .padding(10)
        .background(RoundedRectangle(cornerRadius: 14).fill(.quaternary))
        .contentShape(RoundedRectangle(cornerRadius: 14))
    }
}

struct TileButtonStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .scaleEffect(configuration.isPressed ? 0.96 : 1)
            .animation(.easeOut(duration: 0.12), value: configuration.isPressed)
    }
}
