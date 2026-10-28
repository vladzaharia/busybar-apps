import AppKit
import SwiftUI

/// A borderless, non-activating panel that floats above other windows on every Space, like a system palette: clicking
/// it doesn't take focus from the app you're in. The SwiftUI content draws its own Liquid Glass.
final class FloatingPanel: NSPanel {
    static func make() -> FloatingPanel {
        FloatingPanel(contentRect: .zero, styleMask: [.borderless, .nonactivatingPanel], backing: .buffered, defer: false)
    }

    override init(contentRect: NSRect, styleMask style: NSWindow.StyleMask, backing backingStoreType: NSWindow.BackingStoreType, defer flag: Bool) {
        super.init(contentRect: contentRect, styleMask: style, backing: backingStoreType, defer: flag)
        isFloatingPanel = true
        level = .floating
        collectionBehavior = [.canJoinAllSpaces, .stationary, .fullScreenAuxiliary, .ignoresCycle]
        isOpaque = false
        backgroundColor = .clear
        hasShadow = false
        hidesOnDeactivate = false
        becomesKeyOnlyIfNeeded = true
        isMovable = false
        animationBehavior = .utilityWindow
    }

    override var canBecomeKey: Bool { true }
    override var canBecomeMain: Bool { false }
}

/// Takes the first click even though the panel isn't key, so a tile plays on the first press.
final class FirstClickHostingView<Content: View>: NSHostingView<Content> {
    override func acceptsFirstMouse(for event: NSEvent?) -> Bool { true }
}
