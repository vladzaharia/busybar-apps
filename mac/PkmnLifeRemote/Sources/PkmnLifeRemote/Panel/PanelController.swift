import AppKit
import Observation
import PkmnLifeRemoteKit
import QuartzCore
import SwiftUI

/// What the panel's view needs to know about where it is.
@Observable
final class PanelState {
    /// Whether the panel tucks into the screen edge (no ultrawide, or the placement says so).
    var tucks = false
    /// Out while tucking: pointed at, or pinned open from its tab.
    var open = false
    var pinned = false
    /// The card under the buttons (status, Title Card, Stop, Settings): out while the pointer is on the panel.
    var details = false
    var dockMode: DockMode {
        didSet { if dockMode != oldValue { UserDefaults.standard.set(dockMode.rawValue, forKey: "dockMode") } }
    }

    init() {
        dockMode = UserDefaults.standard.string(forKey: "dockMode").flatMap(DockMode.init(rawValue:)) ?? .automatic
    }

    var isOut: Bool { !tucks || open || pinned }
}

/// Keeps the remote's panel in the top-right corner: out all the time on an ultrawide display, otherwise tucked into
/// the right edge with only its tab showing, sliding out while the pointer is on it.
final class PanelController {
    /// The parts of the panel the pointer can be on. It is on the panel while it is on any of them; the gaps between
    /// them are transparent and belong to the window below.
    enum Part {
        case tab
        case buttons
        case details
    }

    let state = PanelState()
    /// Opens the Settings window (the app delegate's).
    let openSettings: () -> Void
    private let model: RemoteModel
    private let panel = FloatingPanel.make()
    private var hosting: FirstClickHostingView<RemotePanelView>!
    private var pointedAt: Set<Part> = []
    private var hovering: Bool { !pointedAt.isEmpty }
    private var menuTracking = false
    private var tuckTask: Task<Void, Never>?
    private var detailsTask: Task<Void, Never>?
    private var observers: [NSObjectProtocol] = []

    init(model: RemoteModel, openSettings: @escaping () -> Void) {
        self.model = model
        self.openSettings = openSettings
        hosting = FirstClickHostingView(rootView: RemotePanelView(model: model, controller: self))
        let container = NSView()
        container.addSubview(hosting)
        // Pinned to the left: when the window narrows to tuck, the content keeps its size and the right part is cut
        // off, as if it slid behind the screen edge.
        hosting.autoresizingMask = [.maxXMargin]
        panel.contentView = container

        let center = NotificationCenter.default
        observers = [
            // Displays connected, disconnected, rearranged, or a resolution change: place the panel again.
            center.addObserver(forName: NSApplication.didChangeScreenParametersNotification, object: nil, queue: .main) { [weak self] _ in
                MainActor.assumeIsolated { self?.layout(animated: false) }
            },
            // A tile's context menu or the … menu is open: don't tuck from under it.
            center.addObserver(forName: NSMenu.didBeginTrackingNotification, object: nil, queue: .main) { [weak self] _ in
                MainActor.assumeIsolated { self?.menuTracking = true }
            },
            center.addObserver(forName: NSMenu.didEndTrackingNotification, object: nil, queue: .main) { [weak self] _ in
                MainActor.assumeIsolated {
                    guard let self else { return }
                    self.menuTracking = false
                    if !self.hovering {
                        self.hideDetailsLater()
                        self.tuckLater()
                    }
                }
            },
        ]
    }

    var dockMode: DockMode {
        get { state.dockMode }
        set {
            state.dockMode = newValue
            state.pinned = false
            state.open = false
            layout(animated: true)
        }
    }

    func show() {
        layout(animated: false)
        panel.orderFrontRegardless()
    }

    /// Brings the panel out and keeps it out, as when the app is opened again from Finder.
    func reveal() {
        state.pinned = true
        show()
    }

    // --- From the view ---------------------------------------------------------------------------------------------

    /// The pointer came onto or left a part of the panel: bring out the card under the buttons (and the panel, if it
    /// is tucked), or put them away a moment after it has left.
    func hover(_ part: Part, _ inside: Bool) {
        // The tab's strip is empty while the panel doesn't tuck.
        if part == .tab && inside && !state.tucks { return }
        if inside { pointedAt.insert(part) } else { pointedAt.remove(part) }
        if hovering {
            tuckTask?.cancel()
            detailsTask?.cancel()
            showDetails(true)
            if state.tucks && !state.open {
                state.open = true
                layout(animated: true)
            }
        } else {
            hideDetailsLater()
            tuckLater()
        }
    }

    /// The tab: pins the panel out, or lets a pinned one tuck away.
    func togglePin() {
        tuckTask?.cancel()
        if state.pinned {
            state.pinned = false
            state.open = false
        } else {
            state.pinned = true
            state.open = true
        }
        layout(animated: true)
    }

    // --- The card under the buttons -------------------------------------------------------------------------------

    private func hideDetailsLater(after seconds: Double = 0.5) {
        detailsTask?.cancel()
        guard state.details else { return }
        detailsTask = Task { [weak self] in
            try? await Task.sleep(for: .seconds(seconds))
            guard !Task.isCancelled, let self, !self.hovering, !self.menuTracking else { return }
            // Wait for a request on its way, so Title Card's or Stop's progress stays in view.
            if self.model.sending != nil {
                self.hideDetailsLater()
                return
            }
            self.showDetails(false)
        }
    }

    private func showDetails(_ shown: Bool) {
        guard state.details != shown else { return }
        if NSWorkspace.shared.accessibilityDisplayShouldReduceMotion {
            state.details = shown
        } else {
            withAnimation(.smooth(duration: 0.25)) { state.details = shown }
        }
    }

    // --- Placement -------------------------------------------------------------------------------------------------

    private func tuckLater(after seconds: Double = 1.2) {
        tuckTask?.cancel()
        guard state.tucks, state.open, !state.pinned else { return }
        tuckTask = Task { [weak self] in
            try? await Task.sleep(for: .seconds(seconds))
            guard !Task.isCancelled, let self, !self.hovering, !self.menuTracking else { return }
            // Wait for a request on its way, so its tile's progress stays in view.
            if self.model.sending != nil {
                self.tuckLater(after: 0.5)
                return
            }
            self.state.open = false
            self.layout(animated: true)
        }
    }

    func layout(animated: Bool) {
        let screens = NSScreen.screens.map { ScreenInfo(frame: $0.frame, visibleFrame: $0.visibleFrame) }
        guard let choice = ScreenLayout.choose(screens: screens, mode: state.dockMode) else { return }
        if state.tucks == choice.shown {
            state.tucks = !choice.shown
            state.open = false
            state.pinned = false
        }

        hosting.layoutSubtreeIfNeeded()
        let size = hosting.fittingSize
        hosting.frame = CGRect(origin: .zero, size: size)
        let frame = state.isOut
            ? ScreenLayout.openFrame(size: size, on: choice.screen)
            : ScreenLayout.tuckedFrame(size: size, on: choice.screen, peek: DockTab.peek)

        if animated && !NSWorkspace.shared.accessibilityDisplayShouldReduceMotion {
            NSAnimationContext.runAnimationGroup { context in
                context.duration = 0.3
                context.timingFunction = CAMediaTimingFunction(name: .easeInEaseOut)
                context.allowsImplicitAnimation = true
                self.panel.animator().setFrame(frame, display: true)
            }
        } else {
            panel.setFrame(frame, display: true)
        }
    }
}
