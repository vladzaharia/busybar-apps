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
| `apps/pkmn-life` | Done. Back: FILE A TICKET and a redirect per person (from a local `redirects.json`, see its README) on a handheld-RPG move menu; styles per entry, random by shuffle bag. Front: plain, sprint bar, sprint dots or Majora's Mask clock, with the title cards. Sprints are computed from `SPRINTS` in `presets.ts` plus the "Sprint changes" setting. Plays requests from the Mac app, and applies setting changes while running. |
| `mac/PkmnLifeRemote` | Builds and runs (first built 2026-10-28 on macOS 27 with Xcode 27.1, Swift 6.4; no warnings). A Liquid Glass panel in the top-right corner: one card of round buttons (people on the left, Ticket, people on the right; coloured like their animations on the bar), and under it, while the pointer is on the panel, a card with the status, Title Card, Stop, Settings and the … menu. Out all the time on an ultrawide display, otherwise tucked into the right edge and sliding out on hover; a tab pins it. Menu bar item. Settings window with General and Pkmn Life tabs; the latter edits the app's settings on the bar. |
| `scripts/setup.sh`, `.claude/hooks/session-start.sh` | Done and run from a cold start in a cloud session. |
| CI (`ci.yml`, `mac-visual.yml`) | Written. `ci.yml` runs on pushes to `main`, pull requests and by hand; `mac-visual.yml` by hand and on pull requests touching the Mac app. The only run so far (by hand) failed before any job started, with no runner assigned: an account-level GitHub Actions problem to look at in the repository's settings, not something in the workflow. |

## Checked, and not

Checked:

- Typecheck and tests: pixel 15 (and one skipped unless `STOCK_ANIM_DIR` is set), core 12, sim 5, PkmnLifeRemoteKit
  16 (Swift 6.2 on Linux and 6.4 on macOS 27, Swift 6 language mode, no warnings). Node 22 to 26. The Kit tests
  include checks that the Mac's entries and settings match `presets.ts` and `settings.json`.
- Pkmn Life in the simulator: every clock face, every entry and style, remote requests (play, random, default, stop,
  card, unknown entry, stale request), sprint changes, and settings changed while running (the clock switched to
  sprint dots and a redirect's header to WALKER within a second).
- The mock bar (`Tools/mock-bar.py`) answers as the app expects (checked with curl).
- The Mac app on macOS 27 (2026-10-28): builds with no warnings, `swift test` passes, and against the mock it
  connects, reads settings, and draws every state. Seen as real screen captures (old tile layout, before the
  redesign): the panel in the top-right corner, its glass over other windows, the tab tucked and peeking.
  Seen through `--snapshot` (the new layout, screen locked): the row of round buttons, the hover card, the window
  at 328 x 244 pt (42 pt wide tucked), both Settings tabs in light and dark, the Pkmn Life tab loaded from the mock,
  and the window title following the tab.
- Pkmn Life in the simulator again: a remote request (`play <person> walker`) and START play, no console errors.

Not checked:

- **The new panel layout on a real screen.** The screen was locked for that part of the session, and macOS gives
  screen captures nothing then (not even `screencapture -l` of one window). Window frame animations don't run
  while locked either, so tucked `--peek` captures taken then show the panel still tucked.
- Clicks in the panel's transparent parts (the tab's strip when it doesn't tuck, the room kept for the hover card)
  falling through to the window below; the first click on a button playing without focusing the panel; the hover
  card's fade in and out; the … menu as a real AppKit menu; the menu bar menu.
- Nothing has been run on a physical BUSY Bar from these sessions; the bar side rests on the simulator and the
  firmware's own decoder.
- No CI job has run yet (see above), so `macos-26` runner availability and `screencapture` permission on GitHub's
  runners are unknown.

## Next: look at the Mac app on an unlocked screen

1. `cd mac/PkmnLifeRemote && Tools/screenshots.sh` with the screen unlocked, and look at every PNG in `screens/`,
   above all `hover-*`, `peeking-*` and `pinned-*`. With the screen locked or without Screen Recording permission,
   look at `<state>/panel-render.png` instead (SwiftUI's own drawing: stand-in glass, otherwise faithful).
2. Things to check by hand, in rough order:
   - The round buttons' fill on real glass, light and dark (`panelFill` in `EntryButton.swift`: 9% of the label
     colour, 16% under the pointer). In the light render it is faint.
   - The hover card: it comes out when the pointer reaches the buttons or the tab, stays while moving between the
     two cards, goes 0.5 s after the pointer leaves, and stays while a context menu or the … menu is open.
   - Clicks below the buttons card fall through to the window below while the hover card is hidden.
   - Settings opens in front of the app in use (it now orders itself front even when macOS declines to activate a
     menu bar app), with its toolbar tabs.
3. Then with a real bar: play each entry from the panel, change a setting and watch the bar pick it up, turn off Mac
   remote and check the panel says so.
4. Update this file and the Mac README with anything learned.

Learned building on macOS 27 (Swift 6.4), in case they come up again: Foundation no longer brings in CGRect's
`Equatable` conformance (import CoreGraphics where it's needed; on Linux it comes with Foundation), and two `lazy var`s
whose initialisers refer to each other need explicit types.

## Open ideas (not asked for yet)

- Notarise the Mac app (it is signed ad hoc, so first launch needs right-click → Open).
- A Swift-side check that the panel's buttons fit when entries are added (one row in a 272 pt card: three fit, a
  fourth would squeeze them).
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
- Mac panel layout (asked for 2026-10-28): one card of round buttons, the people on the left of the bar first and
  those on the right last, as their arrows point, the ticket between; everything else (status, Title Card, Stop,
  Settings, …) on a card that shows on hover. The buttons draw their own fills on the glass (no glass on glass, and no
  system control styles, which dim in a panel that is never key). The window keeps the hover card's room so it never
  resizes under the pointer. Colours come from the bar's animations: Jira blue for the ticket, Runway's amber for the
  redirects, the bar's orange for the title card, the tab, and a simulator answering.
- No names of real people in the repository (asked for 2026-10-28, before making it public). The redirects' people
  are a local, git-ignored `apps/pkmn-life/redirects.json` (`["< Name", "Name >"]`, any number, about five letters
  each), rendered into the animations at build time; the bar can't draw them live without losing the animations.
  The Mac app keeps the same list in its preferences. Examples and tests use Sam and Alex.
