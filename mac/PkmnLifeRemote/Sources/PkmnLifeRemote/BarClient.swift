import Foundation

struct BarError: LocalizedError {
    let message: String
    var errorDescription: String? { message }
}

/// The BUSY Bar's HTTP API, as far as the remote needs it: read and write Pkmn Life's settings, and launch it.
struct BarClient {
    /// "10.0.4.20" over USB, or the bar's Wi-Fi address; may carry a port ("192.168.1.42:80").
    var host: String
    /// The bar's HTTP API password or an access token; not needed over USB.
    var token: String?

    private func url(_ path: String, query: [URLQueryItem]) throws -> URL {
        let trimmed = host.trimmingCharacters(in: .whitespaces)
        var parts = URLComponents()
        parts.scheme = "http"
        let hostAndPort = trimmed.split(separator: ":", maxSplits: 1)
        parts.host = hostAndPort.first.map(String.init)
        if hostAndPort.count == 2, let port = Int(hostAndPort[1]) { parts.port = port }
        parts.path = "/api/" + path
        parts.queryItems = query.isEmpty ? nil : query
        guard !trimmed.isEmpty, let url = parts.url else { throw BarError(message: "Set the bar's address in Settings.") }
        return url
    }

    private func request(_ method: String, _ path: String, query: [URLQueryItem] = [], body: Data? = nil) async throws -> Data {
        var req = URLRequest(url: try url(path, query: query), timeoutInterval: 5)
        req.httpMethod = method
        if let token, !token.isEmpty { req.setValue(token, forHTTPHeaderField: "X-API-Token") }
        if let body {
            req.httpBody = body
            req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        }
        let result: (Data, URLResponse)
        do {
            result = try await URLSession.shared.data(for: req)
        } catch {
            throw BarError(message: "Can't reach the bar at \(host).")
        }
        let (data, response) = result
        let status = (response as? HTTPURLResponse)?.statusCode ?? 0
        switch status {
        case 200..<300: return data
        case 401, 403: throw BarError(message: "The bar refused the request. Check the API password, and that HTTP API access is on.")
        case 404: throw BarError(message: "Pkmn Life isn't installed on the bar.")
        case 409: throw BarError(message: "Another app on the bar can't be interrupted right now.")
        default: throw BarError(message: "The bar answered with an error (\(status)).")
        }
    }

    private var app: [URLQueryItem] { [URLQueryItem(name: "app_id", value: Catalog.appID)] }

    /// Whether the bar answers at all.
    func ping() async throws {
        _ = try await request("GET", "version")
    }

    /// Pkmn Life's settings document: {"version": n, "values": {...}}.
    func settings() async throws -> [String: Any] {
        let data = try await request("GET", "apps/settings", query: app)
        guard let doc = try? JSONSerialization.jsonObject(with: data) as? [String: Any] else {
            throw BarError(message: "The bar sent settings the remote couldn't read.")
        }
        return doc
    }

    func saveSettings(_ doc: [String: Any]) async throws {
        let body = try JSONSerialization.data(withJSONObject: doc)
        _ = try await request("PUT", "apps/settings", query: app, body: body)
    }

    /// Starts Pkmn Life on the bar, in place of whatever app is showing.
    func launch() async throws {
        _ = try await request("POST", "apps/launch", query: app)
    }
}
