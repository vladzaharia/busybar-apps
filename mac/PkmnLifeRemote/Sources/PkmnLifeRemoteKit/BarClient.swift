import Foundation
#if canImport(FoundationNetworking)
import FoundationNetworking
#endif

public struct BarError: LocalizedError, Sendable, Equatable {
    public let message: String

    public init(_ message: String) {
        self.message = message
    }

    public var errorDescription: String? { message }

    /// What an HTTP status from the bar means for the remote; nil for success.
    public static func status(_ code: Int) -> BarError? {
        switch code {
        case 200..<300: nil
        case 401, 403: BarError("The bar refused the request. Check the API password, and that HTTP API access is on.")
        case 404: BarError("Pkmn Life isn't installed on the bar.")
        case 409: BarError("Another app on the bar can't be interrupted right now.")
        default: BarError("The bar answered with an error (\(code)).")
        }
    }
}

/// The BUSY Bar's HTTP API, as far as the remote needs it: read and write Pkmn Life's settings, and launch it.
public struct BarClient: Sendable {
    /// "10.0.4.20" over USB, or the bar's Wi-Fi address; may carry a port ("192.168.1.42:80").
    public var host: String
    /// The bar's HTTP API password or an access token; not needed over USB.
    public var token: String?
    public var appID: String

    public init(host: String, token: String?, appID: String = Catalog.appID) {
        self.host = host
        self.token = token
        self.appID = appID
    }

    public enum SendResult: Sendable {
        case sent
        /// Pkmn Life's "Mac remote" setting is off, so the request wasn't written.
        case remoteOff
    }

    /// Whether the bar answers at all, and the version it gives, if any.
    @discardableResult
    public func ping() async throws -> String? {
        let data: Data
        do {
            data = try await request("GET", "version")
        } catch let error as BarError where error == BarError.status(404) {
            // Every BUSY Bar has /api/version: this is some other web server.
            throw BarError("Something at \(host) answered, but it isn't a BUSY Bar.")
        }
        guard case .string(let version)? = (try? JSONDecoder().decode([String: JSONValue].self, from: data))?["version"] else { return nil }
        return version
    }

    /// Whether a version from `ping` is the simulator's (packages/sim serves the bar's API as "bar-sim").
    public static func isSimulator(version: String?) -> Bool { version?.lowercased().contains("sim") == true }

    /// Pkmn Life's settings document: {"version": n, "values": {...}}.
    public func settings() async throws -> [String: JSONValue] {
        let data = try await request("GET", "apps/settings", query: app)
        guard let doc = try? JSONDecoder().decode([String: JSONValue].self, from: data) else {
            throw BarError("The bar sent settings the remote couldn't read.")
        }
        return doc
    }

    public func saveSettings(_ doc: [String: JSONValue]) async throws {
        _ = try await request("PUT", "apps/settings", query: app, body: try JSONEncoder().encode(doc))
    }

    /// Writes a request (see RemoteRequest) into Pkmn Life's settings, for the running app to pick up.
    public func send(_ words: String, at date: Date = .now) async throws -> SendResult {
        guard let doc = RemoteRequest.apply(words, at: date, to: try await settings()) else { return .remoteOff }
        try await saveSettings(doc)
        return .sent
    }

    /// Starts Pkmn Life on the bar, in place of whatever app is showing.
    public func launch() async throws {
        _ = try await request("POST", "apps/launch", query: app)
    }

    // --- HTTP ------------------------------------------------------------------------------------------------------

    private var app: [URLQueryItem] { [URLQueryItem(name: "app_id", value: appID)] }

    func url(_ path: String, query: [URLQueryItem] = []) throws -> URL {
        let trimmed = host.trimmingCharacters(in: .whitespaces)
        var parts = URLComponents()
        parts.scheme = "http"
        let hostAndPort = trimmed.split(separator: ":", maxSplits: 1)
        parts.host = hostAndPort.first.map(String.init)
        if hostAndPort.count == 2, let port = Int(hostAndPort[1]) { parts.port = port }
        parts.path = "/api/" + path
        parts.queryItems = query.isEmpty ? nil : query
        guard !trimmed.isEmpty, let url = parts.url else { throw BarError("Set the bar's address in Settings.") }
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
        let data: Data
        let response: URLResponse
        do {
            (data, response) = try await URLSession.shared.data(for: req)
        } catch {
            throw BarError("Can't reach the bar at \(host).")
        }
        if let error = BarError.status((response as? HTTPURLResponse)?.statusCode ?? 0) { throw error }
        return data
    }
}
