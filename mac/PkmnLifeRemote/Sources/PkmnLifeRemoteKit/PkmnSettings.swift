import Foundation

/// One of Pkmn Life's settings on the bar, as apps/pkmn-life/src/appmeta/settings.json declares it. The tests check
/// this list against that file, so the two can't drift apart.
public struct SettingField: Identifiable, Sendable {
    public struct Option: Hashable, Sendable {
        public let value: String
        public let label: String
    }

    public enum Kind: Sendable, Equatable {
        case choice([Option])
        case toggle
        /// "HH:MM".
        case time
        case text(maxLength: Int)
    }

    public let id: String
    public let label: String
    public let kind: Kind
    public let defaultValue: JSONValue
    /// The group it shows in, in the Mac app's settings.
    public let group: String
    public let help: String?

    init(_ id: String, _ label: String, _ kind: Kind, _ defaultValue: JSONValue, group: String, help: String? = nil) {
        self.id = id
        self.label = label
        self.kind = kind
        self.defaultValue = defaultValue
        self.group = group
        self.help = help
    }
}

public enum PkmnSettings {
    private static func options(_ pairs: [(String, String)]) -> SettingField.Kind {
        .choice(pairs.map { SettingField.Option(value: $0.0, label: $0.1) })
    }

    public static let fields: [SettingField] = [
        SettingField("nag_style", "Ticket style", options([("alternate", "Alternate"), ("random", "Random"), ("encounter", "Wild encounter"), ("ticker", "Burst ticker")]),
                     .string("alternate"), group: "Entries", help: "How FILE A TICKET plays when started on the bar. OK on the back changes it until the next change here."),
        SettingField("redirect_style", "Redirect style",
                     options([("random", "Random"), ("runway", "Runway"), ("nudge", "Nudge"), ("sign", "Wayfinding sign"), ("walker", "Walker"), ("trainer", "Trainer"), ("scroller", "Scroller")]),
                     .string("random"), group: "Entries", help: "How ALEX and SAM play when started on the bar."),
        SettingField("clock_style", "Clock", options([("plain", "Plain clock"), ("bar", "Sprint bar"), ("dots", "Sprint dots"), ("majora", "Majora's Mask")]),
                     .string("majora"), group: "Clock"),
        SettingField("time_format", "Time format", options([("24h", "24-hour"), ("12h", "12-hour")]), .string("24h"), group: "Clock"),
        SettingField("show_date", "Show date", .toggle, .bool(true), group: "Clock", help: "The calendar, and the date line on the plain and sprint bar clocks."),
        SettingField("blink_colons", "Colon blink", .toggle, .bool(true), group: "Clock"),
        SettingField("title_cards", "Title cards", .toggle, .bool(true), group: "Sprint",
                     help: "With the Majora's Mask clock: \"Dawn of the Nth Day\" each work day, and when the app starts."),
        SettingField("title_cards_time", "Title card time", .time, .string("09:00"), group: "Sprint"),
        SettingField("sprint_changes", "Sprint changes", .text(maxLength: 500), .string(""), group: "Sprint",
                     help: "Exceptions to the two-week sprints, separated by commas: 26=2026-12-17 moves sprint 26's start (add /3w to make it 3 weeks), 26/3w changes only its length, 30+/3w makes sprint 30 and every later one 3 weeks, off=2026-12-24..2027-01-01 marks days off."),
        SettingField("remote_control", "Mac remote", .toggle, .bool(true), group: "Remote",
                     help: "Lets this app play entries and change these settings while Pkmn Life runs. Turned off, changes here apply when Pkmn Life next starts."),
    ]

    /// Fields the bar has that aren't for people to set: the remote's request channel.
    public static let internalFields: Set<String> = ["remote"]

    /// The groups, in order.
    public static var groups: [String] {
        fields.reduce(into: [String]()) { if !$0.contains($1.group) { $0.append($1.group) } }
    }

    /// Each field's value in a settings document, or its default when missing or of the wrong kind.
    public static func values(in doc: [String: JSONValue]) -> [String: JSONValue] {
        var stored: [String: JSONValue] = [:]
        if case .object(let v)? = doc["values"] { stored = v }
        var out: [String: JSONValue] = [:]
        for field in fields {
            if let v = stored[field.id], accepts(field, v) {
                out[field.id] = v
            } else {
                out[field.id] = field.defaultValue
            }
        }
        return out
    }

    /// Whether `value` is valid for `field`, as the bar app reads it.
    public static func accepts(_ field: SettingField, _ value: JSONValue) -> Bool {
        switch (field.kind, value) {
        case (.choice(let options), .string(let s)): options.contains { $0.value == s }
        case (.toggle, .bool): true
        case (.time, .string(let s)): minutes(s) != nil
        case (.text(let max), .string(let s)): s.count <= max
        default: false
        }
    }

    /// The document with `changes` written over its values. Everything else, the remote's request included, is kept.
    public static func merge(_ changes: [String: JSONValue], into doc: [String: JSONValue]) -> [String: JSONValue] {
        var values: [String: JSONValue] = [:]
        if case .object(let v)? = doc["values"] { values = v }
        for (key, value) in changes where !internalFields.contains(key) { values[key] = value }
        var out = doc
        out["values"] = .object(values)
        return out
    }

    /// Minutes after midnight for "HH:MM"; nil if it isn't a time.
    public static func minutes(_ s: String) -> Int? {
        let parts = s.split(separator: ":")
        guard parts.count >= 2, let h = Int(parts[0]), let m = Int(parts[1]), (0..<24).contains(h), (0..<60).contains(m) else { return nil }
        return h * 60 + m
    }

    /// "09:05" for 545 minutes.
    public static func timeText(minutes: Int) -> String {
        let m = ((minutes % 1440) + 1440) % 1440
        return String(format: "%02d:%02d", m / 60, m % 60)
    }
}

extension BarClient {
    /// Writes `changes` into Pkmn Life's settings, on a fresh read so nothing written since is lost.
    public func updateSettings(_ changes: [String: JSONValue]) async throws {
        try await saveSettings(PkmnSettings.merge(changes, into: try await settings()))
    }
}
