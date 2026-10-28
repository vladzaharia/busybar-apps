import PkmnLifeRemoteKit
import SwiftUI

/// An entry's tile. A click plays it the way its caption says; the context menu plays a particular version now, or
/// changes what a click plays.
struct EntryTile: View {
    let entry: Entry
    let model: RemoteModel

    var body: some View {
        let choice = model.clickChoice(for: entry)
        ActionTile(title: entry.title, symbol: entry.symbol, caption: Catalog.choiceName(choice, in: entry), busy: model.sending == entry.id) {
            model.play(entry)
        }
        .contextMenu {
            Section("Play Now As") {
                Button("Random", systemImage: "shuffle") { model.play(entry, as: Catalog.randomChoice) }
                ForEach(entry.styles) { style in
                    Button(style.name) { model.play(entry, as: style.id) }
                }
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
        .accessibilityHint("Plays on the bar. Open the context menu to choose a version.")
    }
}

/// A square glass button: a symbol, a title and a caption. Tinted while its request is on its way.
struct ActionTile: View {
    let title: String
    let symbol: String
    let caption: String
    let busy: Bool
    let action: () -> Void

    private let shape = RoundedRectangle(cornerRadius: 20, style: .continuous)

    var body: some View {
        Button(action: action) {
            VStack(alignment: .leading, spacing: 2) {
                Image(systemName: symbol)
                    .font(.title2)
                    .symbolRenderingMode(.hierarchical)
                    .symbolEffect(.pulse, isActive: busy)
                    .frame(height: 30, alignment: .topLeading)
                    .padding(.bottom, 10)
                Text(title)
                    .font(.headline)
                    .lineLimit(1)
                Text(caption)
                    .font(.caption)
                    .foregroundStyle(.secondary)
                    .lineLimit(1)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(12)
            .contentShape(shape)
        }
        .buttonStyle(.plain)
        .glassEffect(busy ? Glass.regular.tint(.accentColor.opacity(0.4)).interactive() : Glass.regular.interactive(), in: shape)
        .accessibilityElement(children: .combine)
        .accessibilityAddTraits(.isButton)
    }
}
