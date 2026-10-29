import AppKit
import PkmnLifeRemoteKit
import SwiftUI

/// The panel's few colours, taken from Pkmn Life's animations on the bar so a button looks like what it plays. Each
/// has a darker shade for the light appearance, where the bright one would be hard to read on the glass.
enum Palette {
    /// The ticket: the Jira blue of its wild encounter and burst ticker.
    static let ticket = PanelTint(color: Color(light: 0x0C66E4, dark: 0x579DFF), ink: .white)
    /// The redirects: the amber of Runway's chevrons.
    static let redirect = PanelTint(color: Color(light: 0xA86400, dark: 0xFFB020), ink: Color(white: 0.1))
    /// The BUSY Bar's own orange (its START button): the title card's dawn, the tab, and a simulator answering.
    static let busy = Color(light: 0xD9530C, dark: 0xFF7A33)
    static let stop = Color.red
}

/// A panel button's colour: its symbol and the wash behind it, and the symbol's colour on the solid fill while its
/// request is on its way.
struct PanelTint {
    let color: Color
    let ink: Color
}

extension Entry {
    var tint: PanelTint {
        switch kind {
        case .nag: Palette.ticket
        case .redirect: Palette.redirect
        }
    }
}

extension Color {
    /// A colour given as 0xRRGGBB for the light appearance and for the dark one.
    init(light: UInt32, dark: UInt32) {
        func rgb(_ v: UInt32) -> NSColor {
            NSColor(srgbRed: CGFloat(v >> 16 & 0xFF) / 255, green: CGFloat(v >> 8 & 0xFF) / 255, blue: CGFloat(v & 0xFF) / 255, alpha: 1)
        }
        self.init(nsColor: NSColor(name: nil) { appearance in
            appearance.bestMatch(from: [.aqua, .darkAqua]) == .darkAqua ? rgb(dark) : rgb(light)
        })
    }
}
