import Foundation

/// A display, in AppKit's global coordinates (origin at the bottom left of the main display, y up).
public struct ScreenInfo: Sendable, Equatable {
    public var frame: CGRect
    /// The frame less the menu bar and the Dock.
    public var visibleFrame: CGRect

    public init(frame: CGRect, visibleFrame: CGRect) {
        self.frame = frame
        self.visibleFrame = visibleFrame
    }
}

/// Where the remote's panel stays.
public enum DockMode: String, CaseIterable, Identifiable, Sendable {
    /// Shown while an ultrawide display is connected, tucked to the side otherwise.
    case automatic
    case alwaysShown
    case tucked

    public var id: String { rawValue }

    public var title: String {
        switch self {
        case .automatic: "Automatic"
        case .alwaysShown: "Always Shown"
        case .tucked: "Tucked to the Side"
        }
    }

    public var detail: String {
        switch self {
        case .automatic:
            "Always shown at the top right of an ultrawide display while one is connected. Otherwise it tucks into the right edge and slides out when you point at it."
        case .alwaysShown: "Always shown at the top right of the screen."
        case .tucked: "Tucked into the right edge; it slides out when you point at it."
        }
    }
}

public enum ScreenLayout {
    /// Ultrawide (21:9, 32:9) or simply very wide: room to keep the panel out all the time.
    public static func isUltrawide(_ screen: ScreenInfo) -> Bool {
        let w = screen.frame.width
        let h = screen.frame.height
        guard w > 0, h > 0 else { return false }
        return w / h >= 2.1 || w >= 3000
    }

    /// The display the panel goes on, and whether it stays out. `screens` comes main display first (NSScreen.screens):
    /// the panel goes on the first ultrawide, else on the main display.
    public static func choose(screens: [ScreenInfo], mode: DockMode) -> (screen: ScreenInfo, shown: Bool)? {
        guard let main = screens.first else { return nil }
        let wide = screens.first(where: isUltrawide)
        let screen = wide ?? main
        switch mode {
        case .automatic: return (screen, wide != nil)
        case .alwaysShown: return (screen, true)
        case .tucked: return (screen, false)
        }
    }

    /// The panel out, in the top-right corner of the visible frame (its content brings its own margin).
    public static func openFrame(size: CGSize, on screen: ScreenInfo) -> CGRect {
        let v = screen.visibleFrame
        return CGRect(x: v.maxX - size.width, y: v.maxY - size.height, width: size.width, height: size.height)
    }

    /// The panel tucked away: only its leftmost `peek` points (the tab) left in the top-right corner. The window
    /// narrows rather than sliding off the edge, so nothing shows on a display to the right.
    public static func tuckedFrame(size: CGSize, on screen: ScreenInfo, peek: CGFloat) -> CGRect {
        let v = screen.visibleFrame
        let width = min(peek, size.width)
        return CGRect(x: v.maxX - width, y: v.maxY - size.height, width: width, height: size.height)
    }
}
