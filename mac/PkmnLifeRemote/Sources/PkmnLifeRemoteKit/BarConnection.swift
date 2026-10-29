import Foundation

/// Where the remote finds Pkmn Life: in the simulator on this Mac, on the bar connected by USB, or on a bar at an
/// address on the network.
public enum BarConnection: String, CaseIterable, Identifiable, Sendable {
    case simulator
    case usb
    case ip

    public var id: String { rawValue }

    /// The simulator, served as a bar on this Mac by packages/sim/scripts/serve.ts (`pnpm sim:serve` in apps/pkmn-life).
    public static let simulatorHost = "127.0.0.1:2879"
    /// The bar's own address over USB.
    public static let usbHost = "10.0.4.20"

    public var title: String {
        switch self {
        case .simulator: "Simulator"
        case .usb: "USB"
        case .ip: "IP Address"
        }
    }

    /// One line on what it needs.
    public var detail: String {
        switch self {
        case .simulator:
            "Pkmn Life in the simulator on this Mac: run pnpm sim:serve in apps/pkmn-life, then open the page it prints and keep it open."
        case .usb:
            "The bar connected to this Mac by USB, at \(Self.usbHost). No password needed."
        case .ip:
            "The bar on your network, by its Wi-Fi address (shown in the bar's web UI). The API password is the bar's HTTP API password (web UI: Network, HTTP API), kept in your keychain."
        }
    }

    /// Whether the bar's HTTP API password applies.
    public var usesPassword: Bool { self == .ip }

    /// The address to reach: fixed for the simulator and USB, `custom` for an IP address.
    public func host(custom: String) -> String {
        switch self {
        case .simulator: Self.simulatorHost
        case .usb: Self.usbHost
        case .ip: custom.trimmingCharacters(in: .whitespaces)
        }
    }

    /// The saved choice. Before there was one, only an address was saved: none, or the USB one, means USB; any other
    /// address, IP.
    public static func saved(_ raw: String?, host: String?) -> BarConnection {
        if let raw, let connection = BarConnection(rawValue: raw) { return connection }
        guard let host = host?.trimmingCharacters(in: .whitespaces), !host.isEmpty, host != usbHost else { return .usb }
        return host == simulatorHost ? .simulator : .ip
    }
}
