import Foundation

/// One way an entry can play on the bar.
struct Style: Identifiable, Hashable {
    let id: String
    let name: String
}

/// A Pkmn Life entry. Ids and styles must match apps/pkmn-life/src/presets.ts.
struct Entry: Identifiable, Hashable {
    let id: String
    let title: String
    /// SF Symbol for the tile.
    let symbol: String
    let styles: [Style]
}

enum Catalog {
    /// The app's manifest id on the bar.
    static let appID = "app.vlad.pkmn_life"

    static let nagStyles = [
        Style(id: "encounter", name: "Wild Encounter"),
        Style(id: "ticker", name: "Burst Ticker"),
    ]

    static let redirectStyles = [
        Style(id: "runway", name: "Runway"),
        Style(id: "nudge", name: "Nudge"),
        Style(id: "sign", name: "Wayfinding Sign"),
        Style(id: "walker", name: "Walker"),
        Style(id: "trainer", name: "Trainer"),
        Style(id: "scroller", name: "Scroller"),
    ]

    static let entries = [
        Entry(id: "ticket", title: "File a Ticket", symbol: "ticket.fill", styles: nagStyles),
        Entry(id: "alex", title: "Alex", symbol: "arrow.right", styles: redirectStyles),
        Entry(id: "sam", title: "Sam", symbol: "arrow.left", styles: redirectStyles),
    ]

    /// What a click plays: the bar's own setting for that entry, a random style, or one style.
    static let defaultChoice = "default"
    static let randomChoice = "random"

    static func choiceName(_ choice: String, in entry: Entry) -> String {
        switch choice {
        case defaultChoice: return "Bar's setting"
        case randomChoice: return "Random"
        default: return entry.styles.first { $0.id == choice }?.name ?? choice
        }
    }
}
