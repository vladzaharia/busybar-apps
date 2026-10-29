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

/// The side of the bar someone sits on, as someone facing the front display sees it.
public enum Side: String, Hashable, Sendable {
    case left
    case right
}

/// Someone Pkmn Life's redirects send people to. Written as in its redirects.json: "< Sam" sits to the left of the
/// bar, "Alex >" to the right. The names live only there and in this app's preferences, never in the repository.
public struct Person: Hashable, Sendable {
    public let name: String
    public let side: Side

    public init(name: String, side: Side) {
        self.name = name
        self.side = side
    }

    /// "< Sam" or "Alex >"; nil for anything else.
    public init?(_ text: String) {
        let t = text.trimmingCharacters(in: .whitespaces)
        let left = t.hasPrefix("<")
        guard left != t.hasSuffix(">") else { return nil }
        let name = (left ? t.dropFirst() : t.dropLast()).trimmingCharacters(in: .whitespaces)
        guard !name.isEmpty, !name.contains("<"), !name.contains(">") else { return nil }
        self.init(name: name, side: left ? .left : .right)
    }

    /// The entry id the bar app gives them (apps/pkmn-life/assets/redirects.ts): the name in lower case, letters
    /// and digits only.
    public var id: String {
        String(name.lowercased().unicodeScalars.filter { ("a"..."z").contains($0) || ("0"..."9").contains($0) })
    }

    public var text: String { side == .left ? "< \(name)" : "\(name) >" }

    /// A list written "< Sam, Alex >" (commas or new lines between people); nil if any part isn't a person.
    public static func list(_ text: String) -> [Person]? {
        var people: [Person] = []
        for part in text.split(whereSeparator: { $0 == "," || $0.isNewline }) where !part.allSatisfy(\.isWhitespace) {
            guard let person = Person(String(part)) else { return nil }
            people.append(person)
        }
        return people
    }

    public static func text(_ people: [Person]) -> String { people.map(\.text).joined(separator: ", ") }
}

/// A Pkmn Life entry: the ticket nag (presets.ts), or a redirect to one person (redirects.json). Styles must match
/// apps/pkmn-life/src/presets.ts.
public struct Entry: Identifiable, Hashable, Sendable {
    public enum Kind: Hashable, Sendable {
        case nag
        case redirect(Side)
    }

    public let id: String
    public let title: String
    /// The name under the panel's button, where the full title doesn't fit.
    public let shortTitle: String
    /// SF Symbol for the panel's button.
    public let symbol: String
    public let styles: [Style]
    public let kind: Kind

    public init(id: String, title: String, shortTitle: String? = nil, symbol: String, styles: [Style], kind: Kind) {
        self.id = id
        self.title = title
        self.shortTitle = shortTitle ?? title
        self.symbol = symbol
        self.styles = styles
        self.kind = kind
    }
}

public enum Catalog {
    /// The app's manifest id on the bar.
    public static let appID = "app.vlad.pkmn_life"

    public static let nagStyles = [
        Style(id: "encounter", name: "Wild Encounter"),
        Style(id: "ticker", name: "Burst Ticker"),
        Style(id: "board", name: "Departure Board"),
        Style(id: "progress", name: "Stuck Progress Bar"),
        Style(id: "notfound", name: "404"),
        Style(id: "squash", name: "Bug Squash"),
        Style(id: "buddy", name: "Ticket Buddy"),
        Style(id: "slots", name: "Slot Machine"),
        Style(id: "eightball", name: "Magic 8-Ball"),
        Style(id: "invaders", name: "Ticket Invaders"),
        Style(id: "forecast", name: "Forecast"),
    ]

    public static let redirectStyles = [
        Style(id: "runway", name: "Runway"),
        Style(id: "nudge", name: "Nudge"),
        Style(id: "sign", name: "Wayfinding Sign"),
        Style(id: "walker", name: "Walker"),
        Style(id: "trainer", name: "Trainer"),
        Style(id: "scroller", name: "Scroller"),
        Style(id: "motorway", name: "Motorway Sign"),
        Style(id: "exit", name: "Exit Sign"),
        Style(id: "parcel", name: "Parcel Van"),
        Style(id: "plane", name: "Paper Plane"),
        Style(id: "hand", name: "Pointing Hand"),
        Style(id: "train", name: "Little Train"),
        Style(id: "dog", name: "Growlithe"),
        Style(id: "shout", name: "Shout"),
        Style(id: "map", name: "Treasure Map"),
    ]

    public static let ticket = Entry(id: "ticket", title: "File a Ticket", shortTitle: "Ticket", symbol: "ticket.fill", styles: nagStyles, kind: .nag)

    public static func redirect(to person: Person) -> Entry {
        Entry(id: person.id, title: person.name, symbol: person.side == .left ? "arrow.left" : "arrow.right",
              styles: redirectStyles, kind: .redirect(person.side))
    }

    /// Every entry, in the bar's order: the ticket, then a redirect per person.
    public static func entries(_ people: [Person]) -> [Entry] { [ticket] + people.map(redirect(to:)) }

    /// Left to right as on the panel: the people to the left of the bar, the ticket, the people to the right.
    public static func row(_ people: [Person]) -> [Entry] {
        people.filter { $0.side == .left }.map(redirect(to:)) + [ticket] + people.filter { $0.side == .right }.map(redirect(to:))
    }

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
