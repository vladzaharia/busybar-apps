# BUSY Bar apps

On-device JavaScript apps for the [BUSY Bar](https://busy.app), and the libraries they share: a runtime library
around the bar's APIs, a pixel toolkit with an effects library for pre-rendered animation, and a browser simulator
that runs the real app builds.

| | |
| --- | --- |
| [`apps/pkmn-life`](apps/pkmn-life) | **Pkmn Life**: team screens. A sprint clock (bar, dots or days left, with or without Majora's Mask title cards), a Jira-ticket nag in eleven looks, and "go see them" redirects to people on either side in fifteen, picked from a handheld-RPG menu on the back. |
| [`packages/core`](packages/core) | `@vladzaharia/bar-core`: device client, app lifecycle, settings, the stock-style clock and sprint clocks, runtime components. |
| [`packages/pixel`](packages/pixel) | `@vladzaharia/bar-pixel`: `.anim` encoder, device fonts, timeline, effects library and catalog, motion tokens. |
| [`packages/sim`](packages/sim) | `@vladzaharia/bar-sim`: the interactive simulator. |
| [`mac/`](mac) | **Pkmn Life Remote**: a macOS Liquid Glass panel that plays Pkmn Life entries on the bar and edits its settings. |

## Setup

Needs Node 22.18+ (24 recommended, see `.nvmrc`). One script sets up any machine, and is safe to run again:

```sh
scripts/setup.sh          # pnpm and the packages; Swift for the Mac app's tests (Xcode 26 on a Mac, a download on Linux)
pnpm typecheck && pnpm test
```

Claude Code cloud sessions run it on start (`.claude/hooks/session-start.sh`), so a new session can typecheck, test,
run the simulator and run the Mac app's Swift tests straight away.

## Run an app

One command does it, from the repository's root. It finds the apps under `apps/` and what each one can do (its
`package.json` scripts), so a new app or a new script needs no setup:

```sh
pnpm bar                            # choose what to do, step by step
pnpm bar list                       # the apps, and what each can do
pnpm bar serve pkmn-life            # the simulator, at http://127.0.0.1:2879 (with the bar's HTTP API)
pnpm bar install pkmn-life --run    # build, install on a bar connected over USB (10.0.4.20), and launch it
pnpm bar install --all              # build and install every app
pnpm bar sim pkmn-life other-app    # an action for several apps, one after the other
pnpm bar help                       # every action, command and option
```

Over Wi-Fi, enable access first in the bar's web UI (Network → HTTP API), then give its address once, in a git-ignored
`.env` (see [`.env.example`](.env.example)):

```sh
BUSY_BAR_ADDR=192.168.1.42
BUSY_BAR_PASSWORD=...       # only with password protection on
```

or on the command line: `pnpm bar install pkmn-life --addr 192.168.1.42 --password <password>` (pnpm prints the
command line, so the password is better kept in `.env`). The app also appears
in the bar's **Apps** menu. Each action is the app's own script, so `cd apps/pkmn-life && pnpm sim` (or `pnpm build`,
`pnpm app:install`, ...) still works the same.

## Releases

One version covers everything: push a `vX.Y.Z` tag and the **Release** workflow puts every app (for the bar, and in
the simulator), the packages and the Mac app in one [GitHub Release](https://github.com/vladzaharia/busybar-apps/releases),
and the simulators and the effects gallery on [GitHub Pages](https://vladzaharia.github.io/busybar-apps/).
[`RELEASE.md`](RELEASE.md) says how.

## Make a new app

```sh
pnpm bar new                        # asks for its folder and name; or: pnpm bar new my-screen --name "My Screen"
pnpm bar serve my-screen
```

The template shows the clock, plays a pre-rendered scene on START and a toast on OK. Build from there with the
components: see [AGENTS.md](AGENTS.md) for how screens are put together and how the component library grows.

## How it works

The bar's front is a 72 × 16 RGB LED matrix and its back a 160 × 80 greyscale OLED (148 × 80 for apps; the system
status bar takes the rest). Apps draw through the bar's HTTP API (`display/draw`) from the on-device JavaScript
runtime. Smooth motion comes from pre-rendered `.anim` files, the format the stock screens use, which the firmware
plays at 60 fps; apps only switch between named sections. `@vladzaharia/bar-pixel` renders those animations with the
firmware's own fonts, and its encoder is verified against the firmware's encoder and the stock app's animations.
