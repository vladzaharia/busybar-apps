# AGENTS.md

Instructions for coding agents (and people) working in this repository: on-device JavaScript apps for the BUSY Bar,
built on shared libraries that grow with every app.

## Layout

| Path | What | Runs |
| ---- | ---- | ---- |
| `apps/<slug>/` | One app each. `src/` is the app (busy-cli layout), `assets/` renders its animations and images. | On the bar |
| `packages/core` | `@vladzaharia/bar-core`: everything that wraps the bar's APIs. Device client, app lifecycle, timers, settings, font metrics, the stock-style clock face, runtime components (label, marquee, progress bar, toast, `AnimPlayer`). | On the bar |
| `packages/pixel` | `@vladzaharia/bar-pixel`: build-time pixel toolkit. Raster, device fonts, the `.anim` encoder/decoder, the timeline (`seq`, `layer`, `buildAnim`), the effects library, the component catalog, previews, motion tokens. | Node, at build time |
| `packages/sim` | `@vladzaharia/bar-sim`: the simulator. Runs an app's real build in the browser against an emulated bar. | Browser |
| `scripts/` | `new-app.ts` and the app template. | Node |

## Ground rules

- **Never modify the BUSY Bar firmware.** Apps run on stock firmware. If something needs a firmware change, stop and
  say so.
- Apps only reach the endpoints JavaScript apps are allowed (`display/draw`, `apps/settings` GET, `audio/*`,
  `display/brightness`, `busy`, `time`, `status/*`, `name`, `version`, `wifi/status`, `access`, `transport`). The
  simulator returns 403 for the rest, like the bar.
- Go through `@vladzaharia/bar-core` for anything that talks to the bar. If an app needs a new kind of call, add it to
  core, not to the app.
- No passwords or tokens in the repository.

## Build screens from components

1. **Look in the catalog first.** `packages/pixel/src/catalog.ts` lists every pre-rendered effect with a demo; the
   gallery (`pnpm --filter @vladzaharia/bar-pixel gallery <out>`) plays them all. Runtime pieces are in
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
- Redraw live elements on human time scales (the clock: once a second, coalesced). Never per frame.
- Centre lettering on its capitals (`capCentre`, `label`), as the stock screens do.

## App rules (from the firmware's JavaScript runtime)

- `src/main.ts` runs top to bottom and must not export anything; it calls `main()` at the end.
- The app lives while an input listener, a timer or a fetch is pending. `createApp().quit()` releases everything in
  the safe order. Never unbind input from inside the input handler synchronously.
- Buttons react on `short`; `long`/`repeat` for holds. A long BACK is the firmware's force quit; the app never sees it.
- The manifest `id` is the package folder on the bar: at most 32 characters of letters, digits, `_`, `-`, `.`.
- Text is printable ASCII only.

## Checking your work

```sh
pnpm typecheck            # every package and app (apps render their assets first)
pnpm test                 # encoder, timeline, catalog, core, simulator rules
cd apps/<slug> && pnpm sim    # the app in the simulator: dist/sim/index.html
```

Drive the simulator to check behaviour: it exposes `window.barSim` (`host`, `device`, `buttons`) for scripts, and the
keyboard works (S = START, arrows = wheel, Enter = OK, Esc = BACK). Look at the screens, not just the logs.

Before finishing: typecheck and tests pass, the simulator runs the app without errors, new components are in the
catalog, and the README of anything you changed is still true.
