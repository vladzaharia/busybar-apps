import PkmnLifeRemoteKit
import SwiftUI

/// The Settings window's General tab: where the bar is, how to get in, and where the panel stays.
struct GeneralSettingsView: View {
    @Bindable var model: RemoteModel
    let panel: PanelController
    @State private var token = Keychain.read() ?? ""

    var body: some View {
        Form {
            Section {
                TextField("Address", text: $model.host, prompt: Text("10.0.4.20"))
                SecureField("API password", text: $token, prompt: Text("Not needed over USB"))
                LabeledContent("Status") {
                    HStack(spacing: 6) {
                        Circle()
                            .fill(model.connected ? Color.green : Color.secondary)
                            .frame(width: 8, height: 8)
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
                Text("10.0.4.20 when the bar is connected by USB; otherwise its Wi-Fi address, shown in the bar's web UI. The API password is the bar's HTTP API password (web UI: Network, HTTP API), kept in your keychain.")
                    .foregroundStyle(.secondary)
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
        .frame(width: 500, height: 420)
    }
}
