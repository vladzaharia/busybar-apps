import Foundation
import Observation
import PkmnLifeRemoteKit

/// The remote's state, and what its buttons do. Requests go to the bar by writing Pkmn Life's "remote" setting
/// (see RemoteRequest), which the app on the bar checks once a second.
@Observable
final class RemoteModel {
    private(set) var status = "Not connected yet"
    private(set) var connected = false
    /// The tile whose request is on its way, if any.
    private(set) var sending: String?

    var host: String {
        didSet { UserDefaults.standard.set(host, forKey: "host") }
    }

    /// What a click on each entry plays (entry id to choice), as picked from the tile's context menu.
    private var clickChoices: [String: String] {
        didSet { UserDefaults.standard.set(clickChoices, forKey: "clickChoices") }
    }

    init() {
        host = UserDefaults.standard.string(forKey: "host") ?? "10.0.4.20"
        clickChoices = UserDefaults.standard.dictionary(forKey: "clickChoices") as? [String: String] ?? [:]
    }

    var client: BarClient { BarClient(host: host, token: Keychain.read()) }

    func clickChoice(for entry: Entry) -> String { clickChoices[entry.id] ?? Catalog.defaultChoice }

    func setClickChoice(_ choice: String, for entry: Entry) { clickChoices[entry.id] = choice }

    // --- Requests --------------------------------------------------------------------------------------------------

    /// Plays `entry` on the bar: as `choice` if given, else as a click plays it.
    func play(_ entry: Entry, as choice: String? = nil) {
        let style = choice ?? clickChoice(for: entry)
        send("play \(entry.id) \(style)", tile: entry.id, done: "Playing \(entry.title) (\(Catalog.choiceName(style, in: entry)))")
    }

    func titleCard() { send("card", tile: "card", done: "Playing today's title card") }

    func stop() { send("stop", tile: "stop", done: "Stopped") }

    private func send(_ words: String, tile: String, done: String) {
        sending = tile
        let client = self.client
        Task {
            defer { sending = nil }
            do {
                switch try await client.send(words) {
                case .sent:
                    status = done
                case .remoteOff:
                    status = "Turn on \"Mac remote\" in Pkmn Life's settings on the bar."
                }
                connected = true
            } catch {
                connected = false
                status = error.localizedDescription
            }
        }
    }

    // --- The bar ---------------------------------------------------------------------------------------------------

    func checkConnection() {
        let client = self.client
        Task {
            do {
                try await client.ping()
                _ = try await client.settings()
                connected = true
                status = "Connected to the bar at \(client.host)"
            } catch {
                connected = false
                status = error.localizedDescription
            }
        }
    }

    /// Starts Pkmn Life on the bar. A request sent in the 15 s before still plays once it is up.
    func launchApp() {
        let client = self.client
        Task {
            do {
                try await client.launch()
                connected = true
                status = "Started Pkmn Life on the bar"
            } catch {
                status = error.localizedDescription
            }
        }
    }

    func saveToken(_ token: String) {
        Keychain.write(token.trimmingCharacters(in: .whitespacesAndNewlines))
        checkConnection()
    }
}
