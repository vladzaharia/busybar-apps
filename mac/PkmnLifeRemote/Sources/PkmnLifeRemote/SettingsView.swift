import SwiftUI

/// Where the bar is and how to get in.
struct SettingsView: View {
    @ObservedObject var model: RemoteModel
    @State private var token = Keychain.read() ?? ""

    var body: some View {
        Form {
            Section {
                TextField("Bar address", text: $model.host, prompt: Text("10.0.4.20"))
                Text("10.0.4.20 when the bar is connected by USB; otherwise its Wi-Fi address, shown in the bar's web UI.")
                    .font(.caption)
                    .foregroundStyle(.secondary)
                SecureField("API password", text: $token)
                Text("The bar's HTTP API password (web UI: Network, HTTP API). Not needed over USB. Kept in your keychain.")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
            HStack {
                Button("Save and Test") { model.saveToken(token) }
                    .keyboardShortcut(.defaultAction)
                Text(model.status)
                    .font(.caption)
                    .foregroundStyle(model.connected ? Color.green : Color.secondary)
                    .lineLimit(2)
            }
        }
        .padding(20)
        .frame(width: 440)
    }
}
