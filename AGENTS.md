# AGENTS.md

Instructions for coding agents (and people) working in this repository: on-device JavaScript apps for the BUSY Bar,
built on shared libraries that grow with every app.

## Layout

| Path | What | Runs |
| ---- | ---- | ---- |
| `apps/<slug>/` | One app each. `src/` is the app (busy-cli layout), `assets/` renders its animations and images. | On the bar |
| `packages/core` | `@vladzaharia/bar-core`: everything that wraps the bar's APIs. Device client, app lifecycle, timers, settings, font metrics, the stock-style clock face, sprints and sprint clock faces, random choice (`shuffleBag`), runtime components (label, marquee, progress bar, toast, `AnimPlayer`, `LiveFace`). | On the bar |
| `packages/pixel` | `@vladzaharia/bar-pixel`: build-time pixel toolkit. Raster, device fonts, the `.anim` encoder/decoder, the timeline (`seq`, `layer`, `buildAnim`), the effects library, the component catalog, previews, motion tokens. | Node, at build time |
| `packages/sim` | `@vladzaharia/bar-sim`: the simulator. Runs an app's real build in the browser against an emulated bar. | Browser |
| `scripts/` | `bar/`: `pnpm bar`, one command for every app (it reads `apps/*` and their scripts; see the README), `setup.sh` (sets up a machine or session; the SessionStart hook runs it), `new-app.ts` and the app template, and `release/`: the release's scripts ([`RELEASE.md`](RELEASE.md)). | Node |
| `mac/` | Pkmn Life Remote, a SwiftUI panel (macOS 26) that sends Pkmn Life requests and settings through the bar's HTTP API (`remoteInbox`). `PkmnLifeRemoteKit` holds the testable part; its tests check the Mac's copy of the entries and settings against `apps/pkmn-life`. Built by CI on macOS; `pnpm bar mac` installs it. | macOS |

## Ground rules

- **Never modify the BUSY Bar firmware.** Apps run on stock firmware. If something needs a firmware change, stop and
  say so.
- Apps only reach the endpoints JavaScript apps are allowed (`display/draw`, `apps/settings` GET, `audio/*`,
  `display/brightness`, `busy`, `time`, `status/*`, `name`, `version`, `wifi/status`, `access`, `transport`). The
  simulator returns 403 for the rest, like the bar.
- To control a running app from outside the bar, write a request into one of its settings over the HTTP API and read
  it with `remoteInbox` (apps can't be sent messages directly).
- Go through `@vladzaharia/bar-core` for anything that talks to the bar. If an app needs a new kind of call, add it to
  core, not to the app.
- No passwords or tokens in the repository, and no names of real people: the repository is public. The people
  Pkmn Life's redirects send to live in a git-ignored `apps/pkmn-life/redirects.json` (see its README); examples and
  tests use Sam and Alex.

## Build screens from components

1. **Look in the catalog first.** `packages/pixel/src/catalog.ts` lists every pre-rendered effect with a demo; the
   gallery (`pnpm bar gallery`) plays them all. Runtime pieces are in
   `packages/core/src/components.ts`.
2. **Compose scenes** in the app's `assets/` from those clips with `seq` and `layer`, render with `buildAnim`, and
   generate the section lengths into `src/generated/clips.ts` (see `apps/pkmn-life/assets/build.ts`).
3. **Anything new and reusable goes into the library**, not the app: a generic effect into `packages/pixel/src/fx/`,
   a runtime element builder into `packages/core/src/components.ts`. Give every new effect a `CATALOG` entry with a
   short demo (2–6 s) and a usage line, so it shows in the gallery. Keep the app-specific part (its copy, its layout)
   in the app.
4. **Use the motion tokens** (`MOTION`, `readTime` in `packages/pixel/src/motion.ts`) for durations. They are
   calibrated against the stock animations; if something feels too fast or slow everywhere, fix the token.

## How apps move

- All motion is pre-rendered into `.anim` files and played by the firmware at full frame rate. The app only names
  sections: `AnimPlayer.play(clip, section)` switches at once; `.then(section)` queues one to start when the current
  one ends (the firmware holds one queued request; a newer one replaces it).
- Front animations that play over live elements (the clock) are `argb8888` and transparent where the screen should
  show through. Back animations are `gray4` (16 grey levels) at 30 fps; front ones 60 fps.
- Give every element a `z_index`. The bar puts an element without one at 0, 10, 20, ... in the order of its draw
  request, so a live face's later elements land over animations (Pkmn Life's "last day" at 70, over its title cards
  at 60). The clock face sits on layers 0 and 1 (`CLOCK_Z`); play animations over it well above that.
- Redraw live elements on human time scales (the clock: once a second, coalesced). Never per frame.
- The bar refuses a clear that names an id it doesn't have, and then clears nothing: clear only ids you drew. For a
  set of elements whose make-up changes, draw through `LiveFace`.
- Centre lettering on its capitals (`capCentre`, `label`), as the stock screens do.

## App rules (from the firmware's JavaScript runtime)

- `src/main.ts` runs top to bottom and must not export anything; it calls `main()` at the end.
- The app lives while an input listener, a timer or a fetch is pending. `createApp().quit()` releases everything in
  the safe order. Never unbind input from inside the input handler synchronously.
- Buttons react on `short`; `long`/`repeat` for holds. A long BACK is the firmware's force quit; the app never sees it.
- The bar can't install over a running app: deleting the old copy stops at its first open file (a playing animation),
  having deleted the rest, and the install answers 400. `pnpm bar install` quits the running app first (busy-cli's
  `app:install` doesn't); an install that failed this way leaves a half-deleted app, which a reinstall repairs.
- The manifest `id` is the package folder on the bar: at most 32 characters of letters, digits, `_`, `-`, `.`.
- Text is printable ASCII only.
- `appmeta/settings.json` must pass the firmware's check, or the bar shows and stores no settings at all (its web UI
  says "Application settings schema is invalid"): a string's `max_length` is 255 at most (64 when unset), an enum has
  1 to 32 options. The simulator build makes the same check (`packages/sim/src/settings-schema.ts`) and refuses the
  file with the bar's message.

## Checking your work

A fresh machine needs `scripts/setup.sh` first (cloud sessions run it automatically).

```sh
pnpm bar help             # every app action (sim, serve, build, install, ...) and repo command, from the apps there are
pnpm bar check            # typecheck and test, as below
pnpm typecheck            # every package and app (apps render their assets first)
pnpm test                 # encoder, timeline, catalog, core, simulator rules, pnpm bar, and Pkmn Life's guard test (renders every style)
pnpm bar sim <slug>       # the app in the simulator: dist/sim/index.html (or cd apps/<slug> && pnpm sim)
pnpm bar serve <slug>     # the same, served on 127.0.0.1:2879 with the bar's HTTP API (point the Mac app there)
pnpm bar install <slug> --run --dry-run   # what an install would run, without a bar
cd mac/PkmnLifeRemote && swift test                  # the Mac app's logic (works on Linux)
cd mac/PkmnLifeRemote && Tools/screenshots.sh        # the Mac app in every state, as PNGs (macOS 26)
```

Drive the simulator to check behaviour: it exposes `window.barSim` (`host`, `device`, `buttons`, and `settings`, whose changes the app sees on its next read,
as with a write over the HTTP API) for scripts, and the
keyboard works (S = START, arrows = wheel, Enter = OK, Esc = BACK). Look at the screens, not just the logs.

Before finishing: typecheck and tests pass, the simulator runs the app without errors, new components are in the
catalog, and the README of anything you changed is still true.
