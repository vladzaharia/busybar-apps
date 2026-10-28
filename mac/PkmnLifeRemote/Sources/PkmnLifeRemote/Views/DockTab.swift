import SwiftUI

/// The handle on the panel's left. Tucked, it is all that shows at the screen edge; point at it and the panel slides
/// out. Click it to keep the panel out, and again to let it tuck away.
struct DockTab: View {
    let state: PanelState
    let action: () -> Void

    static let width: CGFloat = 26
    /// How much of the panel stays on screen when tucked: its leading padding, the tab, and a sliver of space.
    static let peek: CGFloat = 12 + width + 4

    var body: some View {
        Button(action: action) {
            Image(systemName: symbol)
                .font(.body.weight(.semibold))
                .contentTransition(.symbolEffect(.replace))
                .frame(width: Self.width, height: 72)
                .contentShape(.capsule)
        }
        .buttonStyle(.plain)
        .glassEffect(.regular.interactive(), in: .capsule)
        .help(state.pinned ? "Let the remote tuck away" : "Keep the remote out")
        .accessibilityLabel(state.pinned ? "Unpin Remote" : "Pin Remote")
    }

    private var symbol: String {
        if state.pinned { return "pin.fill" }
        return state.open ? "pin" : "chevron.compact.left"
    }
}
