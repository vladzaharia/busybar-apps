import Foundation

/// One way an entry can play on the bar.
public struct Style: Identifiable, Hashable, Sendable {
    public let id: String
    public let name: String

    public init(id: String, name: String) {
        self.id = id
        self.name = name
    }
}

/// A Pkmn Life entry. Ids and styles must match apps/pkmn-life/src/presets.ts.
public struct Entry: Identifiable, Hashable, Sendable {
    public let id: String
    public let title: String
    /// The name under the panel's button, where the full title doesn't fit.
    public let shortTitle: String
    /// SF Symbol for the panel's button.
    public let symbol: String
    public let styles: [Style]

    public init(id: String, title: String, shortTitle: String? = nil, symbol: String, styles: [Style]) {
        self.id = id
        self.title = title
        self.shortTitle = shortTitle ?? title
        self.symbol = symbol
        self.styles = styles
    }
}

public enum Catalog {
    /// The app's manifest id on the bar.
    public static let appID = "app.vlad.pkmn_life"

    public static let nagStyles = [
        Style(id: "encounter", name: "Wild Encounter"),
        Style(id: "ticker", name: "Burst Ticker"),
    ]

    public static let redirectStyles = [
        Style(id: "runway", name: "Runway"),
        Style(id: "nudge", name: "Nudge"),
        Style(id: "sign", name: "Wayfinding Sign"),
        Style(id: "walker", name: "Walker"),
        Style(id: "trainer", name: "Trainer"),
        Style(id: "scroller", name: "Scroller"),
    ]

    public static let entries = [
        Entry(id: "ticket", title: "File a Ticket", shortTitle: "Ticket", symbol: "ticket.fill", styles: nagStyles),
        Entry(id: "alex", title: "Alex", symbol: "arrow.right", styles: redirectStyles),
        Entry(id: "sam", title: "Sam", symbol: "arrow.left", styles: redirectStyles),
    ]

    /// What a click plays: the bar's own setting for that entry, a random style, or one style.
    public static let defaultChoice = "default"
    public static let randomChoice = "random"

    public static func choiceName(_ choice: String, in entry: Entry) -> String {
        switch choice {
        case defaultChoice: "Bar's setting"
        case randomChoice: "Random"
        default: entry.styles.first { $0.id == choice }?.name ?? choice
        }
    }
}
