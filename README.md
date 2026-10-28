# BUSY Bar apps

On-device JavaScript apps for the [BUSY Bar](https://busy.app), and the libraries they share: a runtime library
around the bar's APIs, a pixel toolkit with an effects library for pre-rendered animation, and a browser simulator
that runs the real app builds.

| | |
| --- | --- |
| [`apps/pkmn-life`](apps/pkmn-life) | **Pkmn Life**: Team screens. A sprint clock (Majora's Mask moon, bar or dots), a Jira-ticket nag, and "go see Alex / Sam" redirects, picked from a handheld-RPG menu on the back. |
| [`packages/core`](packages/core) | `@vladzaharia/bar-core`: device client, app lifecycle, settings, the stock-style clock and sprint clocks, runtime components. |
| [`packages/pixel`](packages/pixel) | `@vladzaharia/bar-pixel`: `.anim` encoder, device fonts, timeline, effects library and catalog, motion tokens. |
| [`packages/sim`](packages/sim) | `@vladzaharia/bar-sim`: the interactive simulator. |
| [`mac/`](mac) | **Pkmn Life Remote**: a macOS Liquid Glass panel that plays Pkmn Life entries on the bar and edits its settings. |

## Setup

Node 22.18+ (24 recommended, see `.nvmrc`) and pnpm.

```sh
pnpm install
pnpm typecheck && pnpm test
```

## Run an app

```sh
cd apps/pkmn-life
pnpm sim                  # simulator: open dist/sim/index.html through any local web server
pnpm build                # dist/app.vlad.pkmn_life.tgz
pnpm app:install          # install on a bar connected over USB (10.0.4.20)
pnpm app:run              # launch it
```

Over Wi-Fi, add the bar's address and its HTTP API password:
`pnpm app:install --addr 192.168.1.42 --password <password>`. Enable Wi-Fi access first in the bar's web UI
(Network → HTTP API). The app also appears in the bar's **Apps** menu.

## Make a new app

```sh
pnpm new-app my-screen --name "My Screen"
cd apps/my-screen && pnpm sim
```

The template shows the clock, plays a pre-rendered scene on START and a toast on OK. Build from there with the
components: see [AGENTS.md](AGENTS.md) for how screens are put together and how the component library grows.

## How it works

The bar's front is a 72 × 16 RGB LED matrix and its back a 160 × 80 greyscale OLED (148 × 80 for apps; the system
status bar takes the rest). Apps draw through the bar's HTTP API (`display/draw`) from the on-device JavaScript
runtime. Smooth motion comes from pre-rendered `.anim` files, the format the stock screens use, which the firmware
plays at 60 fps; apps only switch between named sections. `@vladzaharia/bar-pixel` renders those animations with the
firmware's own fonts, and its encoder is verified against the firmware's encoder and the stock app's animations.
