# Pkmn Life

Team screens for the BUSY Bar. The front shows the clock (laid out like the stock Clock app). Press START and it
asks the room whether they filed a Jira ticket, in one of two styles:

- **Wild encounter**: the screen flashes and stripes away, a wild ISSUE slides in with its HP bar, and the message
  plays out in typed dialogue boxes. ISSUE uses GUILT TRIP. It's super effective.
- **Burst ticker**: the clock switches off into a line of light that bursts, the Jira chevrons fly in, and the
  message glides in letter by letter over drifting particles.

About ten seconds later the clock comes back.

## Controls

| Control | Back screen (menu) | While a nag plays |
| --- | --- | --- |
| Wheel | Choose the message | |
| START | Play it on the front | |
| OK (press the wheel) | Cycle the style: alternate → encounter → ticker | |
| BACK | Leave the app | Stop the nag |

The style the next START will play is shown in the back screen's header. In "alternate" it switches after each nag.

## Settings

On the bar (Apps → Pkmn Life → Setup) or in its web UI: **Nag style** (the default for OK's cycle), **Time format**,
**Show date**, **Colon blink**. The app reads them when it starts.

## Messages

The list is in [`src/presets.ts`](src/presets.ts): a short move name for the menu, the message, and the words the
ticker highlights. Every message's animations are rendered at build time, so after editing the list run
`pnpm build` (or `pnpm sim` to try it first). Keep messages printable ASCII.

## Install

```sh
pnpm build                     # renders the animations, then dist/app.vlad.pkmn_life.tgz
pnpm app:install && pnpm app:run   # bar on USB
```

Over Wi-Fi: `pnpm app:install --addr <bar-ip> --password <http-api-password>`.

## Layout

| Path | |
| --- | --- |
| `src/main.ts` | The app: clock, menu, input, which animation section plays when |
| `src/presets.ts` | The messages |
| `assets/scenes/encounter.ts` | Front scene: wild encounter |
| `assets/scenes/ticker.ts` | Front scene: burst ticker |
| `assets/scenes/menu.ts` | Back screen: the move menu and the "now on front" countdown |
| `assets/build.ts` | Renders everything into `src/` (animations, images, `generated/clips.ts`) |

The Jira mark belongs to Atlassian; this app is for internal use.
