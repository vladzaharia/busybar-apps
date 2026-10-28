# Handoff

Where this repository stands, what has and hasn't been checked, and what to do next. Read this first when picking
the work up (person or agent), and update it when you finish something. Background and rules are in
[`AGENTS.md`](AGENTS.md); each package and app has its own README.

Last updated: 2026-10-28. Branch: `claude/busy-knuth-fqso2y` (no pull request yet).

## Getting going

```sh
scripts/setup.sh                       # once per machine; Claude Code cloud sessions run it on start
pnpm typecheck && pnpm test            # every package and app
cd apps/pkmn-life && pnpm sim          # Pkmn Life in the simulator: serve dist/ and open sim/index.html
cd mac/PkmnLifeRemote && swift test    # the Mac app's logic (Linux or macOS)
cd mac/PkmnLifeRemote && Tools/screenshots.sh   # the Mac app in every state (macOS 26 only)
```

## What exists

| Part | State |
| --- | --- |
| `packages/core`, `packages/pixel`, `packages/sim` | Done and tested: device client, lifecycle, settings, clocks and sprint clocks, `LiveFace`, `shuffleBag`, `remoteInbox` (with `onValues` for live settings); the `.anim` encoder/decoder (matches the firmware's decoder on every app animation), effects catalog, motion tokens; the browser simulator with `window.barSim`. |
| `apps/pkmn-life` | Done. Back: FILE A TICKET, ALEX, SAM on a handheld-RPG move menu; styles per entry, random by shuffle bag. Front: plain, sprint bar, sprint dots or Majora's Mask clock, with the title cards. Sprints are computed from `SPRINTS` in `presets.ts` plus the "Sprint changes" setting. Plays requests from the Mac app, and applies setting changes while running. |
| `mac/PkmnLifeRemote` | Written, **never compiled as an app** (see below). A Liquid Glass panel in the top-right corner (macOS 26, Swift 6.2): out all the time on an ultrawide display, otherwise tucked into the right edge and sliding out on hover; a tab pins it. Menu bar item. Settings window with General and Pkmn Life tabs; the latter edits the app's settings on the bar. `PkmnLifeRemoteKit` (no UI) is compiled and tested. |
| `scripts/setup.sh`, `.claude/hooks/session-start.sh` | Done and run from a cold start in a cloud session. |
| CI (`ci.yml`, `mac-visual.yml`) | Written. `ci.yml` runs on pushes to `main`, pull requests and by hand; `mac-visual.yml` by hand and on pull requests touching the Mac app. The only run so far (by hand) failed before any job started, with no runner assigned: an account-level GitHub Actions problem to look at in the repository's settings, not something in the workflow. |

## Checked, and not

Checked:

- Typecheck and tests: pixel 15, core 12, sim 5, PkmnLifeRemoteKit 16 (Swift 6.2 on Linux, Swift 6 language mode, no
  warnings). The Kit tests include checks that the Mac's entries and settings match `presets.ts` and
  `settings.json`.
- Pkmn Life in the simulator: every clock face, every entry and style, remote requests (play, random, default, stop,
  card, unknown entry, stale request), sprint changes, and settings changed while running (the clock switched to
  sprint dots and ALEX's header to WALKER within a second).
- The mock bar (`Tools/mock-bar.py`) answers as the app expects (checked with curl).

Not checked:

- **The Mac app target has never been built.** There was no Mac or macOS runner available. The SwiftUI/AppKit code
  was written for the macOS 26 SDK from documentation and reviewed by eye. Expect a round of compile fixes.
- Nothing has been run on a physical BUSY Bar from these sessions; the bar side rests on the simulator and the
  firmware's own decoder.
- No CI job has run yet (see above), so `macos-26` runner availability and `screencapture` permission on GitHub's
  runners are unknown.

## Next: the Mac app on a Mac

1. On macOS 26 with Xcode 26: `cd mac/PkmnLifeRemote && swift test && ./build-app.sh`. Fix compile errors.
2. `Tools/screenshots.sh` and look at every PNG in `screens/` (or run the **Mac visual check** workflow and download
   `mac-screens`). If `screencapture` is refused, grant Screen Recording to the terminal; the app's `--snapshot`
   PNGs (drawn without capture, glass may look flat) are written either way.
3. Things most likely to need adjusting, in rough order:
   - Panel sizing: `PanelController.layout` uses `NSHostingView.fittingSize` on a `.fixedSize()` root; check the
     panel isn't zero-sized or clipped.
   - Tucking: the window narrows to `DockTab.peek` (42 pt) with the content pinned left. Check only the tab shows,
     that hover opens it, that it tucks back after 1.2 s, and that it doesn't tuck while a context menu is open.
   - Liquid Glass in a borderless, transparent, non-activating `NSPanel`: check the glass samples the desktop
     behind it, and that clicks in the transparent margins fall through to the window below.
   - First click on a tile plays it without focusing the panel (`FirstClickHostingView`).
   - Settings: toolbar tabs (`NSTabViewController`, `.toolbar` style), tab sizes (500 x 420 and 500 x 600), the
     Pkmn Life tab's loading, error and loaded states against the mock bar, and that changes reach the mock
     (`requests.log` shows the PUTs).
   - The menu bar menu's placement picker and Show Panel.
4. Then with a real bar: play each entry from the panel, change a setting and watch the bar pick it up, turn off Mac
   remote and check the panel says so.
5. Update this file and the Mac README with anything learned.

## Open ideas (not asked for yet)

- Notarise the Mac app (it is signed ad hoc, so first launch needs right-click → Open).
- A Swift-side check that the panel's tiles fit when entries are added (the grid is two fixed columns).
- More entries: add to `presets.ts`, then `Catalog.swift` (the Kit tests fail until they match).

## Decisions to keep

- Never modify the BUSY Bar firmware; apps use only the endpoints JavaScript apps are allowed.
- No passwords or tokens in the repository. The Mac app keeps the bar's API password in the keychain.
- Calculated values are never settings: the sprint number and dates come from `SPRINTS` plus "Sprint changes"
  (moved or longer sprints, cadence changes, days off), never typed in.
- Clocks: 4 px between the calendar icon and the text on every face. The Majora's Mask face has no moon; its line
  under the time is the short sprint text ("S22 6 left").
- Random styles use a shuffle bag: every style once per round.
- The Mac app talks to the running bar app only through its settings (`remote` field, read by `remoteInbox`); it
  doesn't launch Pkmn Life on every click (that restarts it).
- Mac app placement: shown on an ultrawide display (aspect at least 2.1, or 3000 pt wide), otherwise tucked; the user
  can force either.
