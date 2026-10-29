import PkmnLifeRemoteKit
import SwiftUI

/// The Settings window's General tab: where the bar is, how to get in, who the redirects send to, and where the panel
/// stays.
struct GeneralSettingsView: View {
    @Bindable var model: RemoteModel
    let panel: PanelController
    @State private var token = Keychain.read() ?? ""
    @State private var people = ""
    @State private var peopleValid = true

    var body: some View {
        Form {
            Section {
                Picker("Connection", selection: $model.connection) {
                    ForEach(BarConnection.allCases) { Text($0.title).tag($0) }
                }
                .pickerStyle(.segmented)
                .onChange(of: model.connection) { model.checkConnection() }
                if model.connection == .ip {
                    TextField("Address", text: $model.customHost, prompt: Text("192.168.1.42"))
                    SecureField("API password", text: $token, prompt: Text("If password protection is on"))
                } else {
                    LabeledContent("Address", value: model.connection.host(custom: model.customHost))
                }
                LabeledContent("Status") {
                    HStack(spacing: 6) {
                        StatusDot(model: model)
                        Text(model.status)
                            .lineLimit(2)
                    }
                }
                HStack {
                    Spacer()
                    Button("Save and Test") { model.saveToken(token) }
                        .keyboardShortcut(.defaultAction)
                }
            } header: {
                Text("BUSY Bar")
            } footer: {
                Text(model.connection.detail)
                    .foregroundStyle(.secondary)
            }

            Section {
                TextField("People", text: $people, prompt: Text("< Sam, Alex >"))
                    .onChange(of: people) { _, text in
                        // Applied as typed, whenever the list reads; an unfinished one waits.
                        let list = Person.list(text)
                        peopleValid = list != nil
                        if let list, list != model.people { model.people = list }
                    }
            } header: {
                Text("Redirects")
            } footer: {
                Text(peopleValid
                    ? "The same list as Pkmn Life's redirects.json on the bar: \"< Name\" sits to the left of the bar, \"Name >\" to the right, separated by commas. Each gets a button on the panel."
                    : "Write \"< Name\" for someone on the left of the bar and \"Name >\" for someone on the right, separated by commas.")
                    .foregroundStyle(peopleValid ? AnyShapeStyle(.secondary) : AnyShapeStyle(.red))
            }

            Section {
                Picker("Placement", selection: Binding(get: { panel.dockMode }, set: { panel.dockMode = $0 })) {
                    ForEach(DockMode.allCases) { Text($0.title).tag($0) }
                }
            } header: {
                Text("Panel")
            } footer: {
                Text(panel.dockMode.detail)
                    .foregroundStyle(.secondary)
            }
        }
        .formStyle(.grouped)
        .frame(width: 500, height: 540)
        .onAppear { people = Person.text(model.people) }
    }
}
