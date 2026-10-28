import PkmnLifeRemoteKit
import SwiftUI

/// The Settings window's Pkmn Life tab: the app's own settings on the bar, the same ones as on the bar (Apps →
/// Pkmn Life → Setup) and in its web UI.
struct BarAppSettingsView: View {
    let settings: BarSettingsModel

    var body: some View {
        Group {
            switch settings.phase {
            case .idle, .loading:
                ProgressView("Reading Pkmn Life's settings…")
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
            case .failed(let message):
                ContentUnavailableView {
                    Label("Can't Read Pkmn Life's Settings", systemImage: "exclamationmark.triangle")
                } description: {
                    Text(message)
                } actions: {
                    Button("Try Again") { settings.load() }
                }
            case .loaded:
                Form {
                    ForEach(PkmnSettings.groups, id: \.self) { group in
                        Section(group) {
                            ForEach(PkmnSettings.fields.filter { $0.group == group }) { field in
                                SettingRow(field: field, settings: settings)
                            }
                        }
                    }
                    Section {
                        HStack {
                            Text(settings.note ?? "Changes go to the bar as you make them.")
                                .foregroundStyle(.secondary)
                            Spacer()
                            Button("Reload", systemImage: "arrow.clockwise") { settings.load() }
                        }
                    }
                }
                .formStyle(.grouped)
            }
        }
        .frame(width: 500, height: 600)
        .task { if settings.phase == .idle { settings.load() } }
    }
}

/// One setting, with the control its kind calls for and its explanation underneath.
private struct SettingRow: View {
    let field: SettingField
    let settings: BarSettingsModel

    var body: some View {
        switch field.kind {
        case .choice(let options):
            Picker(selection: string) {
                ForEach(options, id: \.value) { Text($0.label).tag($0.value) }
            } label: {
                title
            }
        case .toggle:
            Toggle(isOn: bool) { title }
        case .time:
            DatePicker(selection: time, displayedComponents: .hourAndMinute) { title }
        case .text(let maxLength):
            VStack(alignment: .leading, spacing: 6) {
                title
                TextField(field.label, text: string, prompt: Text("None"), axis: .vertical)
                    .labelsHidden()
                    .lineLimit(2...5)
                    .font(.body.monospaced())
                    .onChange(of: string.wrappedValue) { _, new in
                        if new.count > maxLength { string.wrappedValue = String(new.prefix(maxLength)) }
                    }
            }
        }
    }

    @ViewBuilder private var title: some View {
        Text(field.label)
        if let help = field.help { Text(help) }
    }

    private var string: Binding<String> {
        Binding {
            if case .string(let s) = settings.value(field) { s } else { "" }
        } set: {
            settings.set(field, to: .string($0))
        }
    }

    private var bool: Binding<Bool> {
        Binding {
            settings.value(field) == .bool(true)
        } set: {
            settings.set(field, to: .bool($0))
        }
    }

    /// "HH:MM" as today's date at that time, for the time picker.
    private var time: Binding<Date> {
        Binding {
            let text = if case .string(let s) = settings.value(field) { s } else { "" }
            let minutes = PkmnSettings.minutes(text) ?? 0
            return Calendar.current.startOfDay(for: .now).addingTimeInterval(TimeInterval(minutes * 60))
        } set: {
            let parts = Calendar.current.dateComponents([.hour, .minute], from: $0)
            settings.set(field, to: .string(PkmnSettings.timeText(minutes: (parts.hour ?? 0) * 60 + (parts.minute ?? 0))))
        }
    }
}
