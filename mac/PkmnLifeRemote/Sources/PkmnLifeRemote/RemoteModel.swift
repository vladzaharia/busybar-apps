import Foundation
import Observation
import PkmnLifeRemoteKit

/// The remote's state, and what its buttons do. Requests go to the bar by writing Pkmn Life's "remote" setting
/// (see RemoteRequest), which the app on the bar checks once a second.
@Observable
final class RemoteModel {
    private(set) var status = "Not connected yet"
    private(set) var connected = false
    /// The address answered as the simulator (packages/sim's server) rather than a bar.
    private(set) var simulator = false
    /// The button whose request is on its way, if any.
    private(set) var sending: String?

    /// Saved only when it changes, so `-host` on the command line (Tools/screenshots.sh) stays a one-run override even
    /// when a text field writes back the same value.
    var host: String {
        didSet { if host != oldValue { UserDefaults.standard.set(host, forKey: "host") } }
    }

    /// Who Pkmn Life's redirects send people to, the same list as its redirects.json. The names stay in this Mac's
    /// preferences.
    var people: [Person] {
        didSet { if people != oldValue { UserDefaults.standard.set(Person.text(people), forKey: "people") } }
    }

    /// Every entry the bar plays, in its order.
    var entries: [Entry] { Catalog.entries(people) }

    /// What a click on each entry plays (entry id to choice), as picked from the tile's context menu.
    private var clickChoices: [String: String] {
        didSet { UserDefaults.standard.set(clickChoices, forKey: "clickChoices") }
    }

    init() {
        host = UserDefaults.standard.string(forKey: "host") ?? "10.0.4.20"
        people = Person.list(UserDefaults.standard.string(forKey: "people") ?? "") ?? []
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
                let version = try await client.ping()
                _ = try await client.settings()
                connected = true
                simulator = BarClient.isSimulator(version: version)
                status = "Connected to the \(simulator ? "simulator" : "bar") at \(client.host)"
            } catch {
                connected = false
                simulator = false
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
