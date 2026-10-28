import Foundation
import Observation
import PkmnLifeRemoteKit

/// Pkmn Life's own settings on the bar, for the Settings window's Pkmn Life tab. Changes are written to the bar
/// shortly after they're made, as other Mac settings apply at once; Pkmn Life picks them up within a second while
/// its "Mac remote" setting is on, else the next time it starts.
@Observable
final class BarSettingsModel {
    enum Phase: Equatable {
        case idle
        case loading
        case loaded
        case failed(String)
    }

    private(set) var phase = Phase.idle
    private(set) var values: [String: JSONValue] = [:]
    /// The outcome of the last write, for the footer.
    private(set) var note: String?

    @ObservationIgnored private let remote: RemoteModel
    @ObservationIgnored private var pending: [String: JSONValue] = [:]
    @ObservationIgnored private var saveTask: Task<Void, Never>?

    init(remote: RemoteModel) {
        self.remote = remote
    }

    func load() {
        saveTask?.cancel()
        pending = [:]
        phase = .loading
        let client = remote.client
        Task {
            do {
                values = PkmnSettings.values(in: try await client.settings())
                phase = .loaded
                note = nil
            } catch {
                phase = .failed(error.localizedDescription)
            }
        }
    }

    func value(_ field: SettingField) -> JSONValue { values[field.id] ?? field.defaultValue }

    func set(_ field: SettingField, to value: JSONValue) {
        guard PkmnSettings.accepts(field, value), values[field.id] != value else { return }
        values[field.id] = value
        pending[field.id] = value
        saveLater()
    }

    /// Waits for a pause in the changes (typing in Sprint changes, a run of clicks), then writes them all at once.
    private func saveLater() {
        saveTask?.cancel()
        saveTask = Task {
            try? await Task.sleep(for: .seconds(0.8))
            guard !Task.isCancelled else { return }
            let changes = pending
            pending = [:]
            do {
                try await remote.client.updateSettings(changes)
                note = "Saved to the bar."
            } catch {
                note = "Couldn't save: \(error.localizedDescription)"
            }
        }
    }
}
