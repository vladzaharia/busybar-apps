import Foundation

/// A request for Pkmn Life, as the app on the bar reads it from its "remote" setting (remoteInbox in bar-core):
/// "<seq> <unix seconds> <words>". The sequence number is the time in milliseconds, so every request is new; the app
/// acts on each one once, and only within 15 seconds of the time it carries.
public enum RemoteRequest {
    /// Words: "play <entry> <default|random|style>", "card" or "stop".
    public static func text(_ words: String, at date: Date) -> String {
        let t = date.timeIntervalSince1970
        return "\(Int64(t * 1000)) \(Int64(t)) \(words)"
    }

    /// Pkmn Life's settings document with the request written in, or nil when its "Mac remote" setting is off.
    /// Every other value is kept as it was: the bar saves the whole document.
    public static func apply(_ words: String, at date: Date, to doc: [String: JSONValue]) -> [String: JSONValue]? {
        var values: [String: JSONValue] = [:]
        if case .object(let v)? = doc["values"] { values = v }
        if values["remote_control"] == .bool(false) { return nil }
        values["remote"] = .string(text(words, at: date))
        var out = doc
        out["values"] = .object(values)
        return out
    }
}
