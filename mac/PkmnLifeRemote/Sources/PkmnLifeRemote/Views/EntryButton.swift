import PkmnLifeRemoteKit
import SwiftUI

/// An entry's round button, as in Control Center: its symbol in a circle, its name underneath. A click plays it as
/// "Click Plays" in its context menu says; the context menu also plays a particular version now.
struct EntryButton: View {
    let entry: Entry
    let model: RemoteModel

    static let diameter: CGFloat = 56
    @State private var hovering = false

    var body: some View {
        let busy = model.sending == entry.id
        let choice = Catalog.choiceName(model.clickChoice(for: entry), in: entry)
        Button { model.play(entry) } label: {
            VStack(spacing: 6) {
                Image(systemName: entry.symbol)
                    .font(.title2.weight(.semibold))
                    .symbolEffect(.pulse, isActive: busy)
                    .frame(width: Self.diameter, height: Self.diameter)
                    .panelFill(Circle(), hovering: hovering, busy: busy)
                Text(entry.shortTitle)
                    .font(.callout.weight(.medium))
                    .lineLimit(1)
            }
            .frame(maxWidth: .infinity)
            .contentShape(.rect)
        }
        .buttonStyle(PressStyle())
        .onHover { hovering = $0 }
        .help("\(entry.title). Click plays: \(choice)")
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
        .accessibilityLabel(entry.title)
        .accessibilityValue(choice)
        .accessibilityHint("Plays on the bar. Open the context menu to choose a version.")
    }
}

/// A capsule button with a symbol and a title, for the card under the entries.
struct PillButton: View {
    let title: String
    let symbol: String
    let busy: Bool
    let action: () -> Void

    @State private var hovering = false

    var body: some View {
        Button(action: action) {
            Label(title, systemImage: symbol)
                .font(.callout.weight(.medium))
                .symbolEffect(.pulse, isActive: busy)
                .lineLimit(1)
                .frame(maxWidth: .infinity)
                .padding(.vertical, 7)
                .panelFill(Capsule(), hovering: hovering, busy: busy)
                .contentShape(.capsule)
        }
        .buttonStyle(PressStyle())
        .onHover { hovering = $0 }
    }
}

/// A small round button holding only a symbol.
struct IconButton: View {
    let symbol: String
    let label: String
    let action: () -> Void

    @State private var hovering = false

    var body: some View {
        Button(action: action) {
            Image(systemName: symbol)
                .iconButtonFace(hovering: hovering)
        }
        .buttonStyle(PressStyle())
        .onHover { hovering = $0 }
        .help(label)
        .accessibilityLabel(label)
    }
}

/// Sinks a little while pressed. The panel's buttons draw their own fill rather than use the system's control
/// styles, which dim in a window that isn't key, and the panel never is.
struct PressStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .scaleEffect(configuration.isPressed ? 0.94 : 1)
            .animation(.snappy(duration: 0.15), value: configuration.isPressed)
    }
}

extension View {
    /// The panel buttons' face: a light wash on the glass, stronger under the pointer, and the accent colour while
    /// its request is on its way.
    func panelFill(_ shape: some Shape, hovering: Bool, busy: Bool = false) -> some View {
        foregroundStyle(busy ? AnyShapeStyle(.white) : AnyShapeStyle(.primary))
            .background(busy ? AnyShapeStyle(Color.accentColor) : AnyShapeStyle(.primary.opacity(hovering ? 0.16 : 0.09)), in: shape)
            .animation(.easeOut(duration: 0.12), value: hovering)
    }

    /// A symbol in a small circle, for IconButton and the … menu.
    func iconButtonFace(hovering: Bool) -> some View {
        font(.body.weight(.medium))
            .frame(width: 28, height: 28)
            .panelFill(Circle(), hovering: hovering)
            .contentShape(.circle)
    }
}
