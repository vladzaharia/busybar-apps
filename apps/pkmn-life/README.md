# Pkmn Life

Team screens for the BUSY Bar. The front shows a clock (laid out like the stock Clock app), optionally with the
current sprint. The back is a handheld-RPG move menu: pick an entry and press START to play it on the front.

| Entry | What the front shows | Styles |
| --- | --- | --- |
| FILE A TICKET | "Did you file a JIRA ticket yet???" | **Wild encounter**: the screen flashes and stripes away, a wild ISSUE slides in with its HP bar, and the message plays out in typed dialogue boxes. **Burst ticker**: the clock switches off into a burst, the Jira chevrons fly in, the message glides in letter by letter, then rolls up in full. |
| A person, e.g. ALEX | Sends people to Alex, on the right | **Runway** (amber chevrons chasing their way), **Nudge** (a big arrow pointing and nudging), **Wayfinding sign** (a yellow airport sign sliding in from their side), **Walker** (a little person walks in, points, and heads off their way), **Trainer** ("TRAINER ALEX can help you!"), **Scroller** (chevrons and the name streaming their way). Mirrored for someone on the left. |

"Right" and "left" are as someone facing the front display sees them.

## Who the redirects send to

The names aren't in the repository. Put them in `redirects.json` in this folder (git ignores it), one entry per
person with the side they sit on: `"< Name"` on the left, `"Name >"` on the right.

```json
["< Sam", "Alex >"]
```

Without the file, the build uses `redirects.example.json` (the two above). `pnpm assets` (part of `pnpm build`,
`pnpm sim` and `pnpm typecheck`) renders each person's animations and the back menu from it, so change the file and
build again. A name can be about five letters (it must fit the front in the large font beside Runway's chevrons;
the build says so if it doesn't), and up to six people fit the back menu. Each entry's id, which the Mac remote uses,
is its name in lower case without spaces or punctuation: `alex`. Give the [Mac app](../../mac) the same list.

## Controls

| Control | Back screen (menu) | While something plays |
| --- | --- | --- |
| Wheel | Choose an entry | |
| START | Play it on the front | |
| Hold START | Today's Majora's Mask title card (with that clock) | |
| OK (press the wheel) | Change how the selected entry plays: a style, or random | |
| BACK | Leave the app | Stop it |

The back header shows how the next START will play. FILE A TICKET cycles alternate → random → encounter → ticker
("alternate" switches style after each play). The redirects cycle random → each of the six looks. In random, each
START picks a style, every style coming up once per round in a fresh order.

## Clock

| Clock | |
| --- | --- |
| Plain | The stock clock. |
| Sprint bar | A segment per work day along the bottom edge: done, today (blinking), to go. The line under the time alternates the date and "Sprint 22". |
| Sprint dots | The date stays on the calendar; under the time, "S22" and a dot per work day. |
| Majora's Mask | The sprint and days left in short under the time ("S22 6 left", "S22 last day"). Each work day at the set time (and when the app starts) the title cards play: "Dawn of The Fifth Day", then "-6 Days Remain-". |

Sprints are worked out, never typed in: the team's cadence (Sprint 22 began on Thursday 22 October 2026, two-week
sprints) is in [`src/presets.ts`](src/presets.ts), and every later sprint follows from it. Anything irregular goes in
the **Sprint changes** setting, a comma-separated list you can fill in ahead of time:

| Entry | Meaning |
| --- | --- |
| `26=2026-12-17` | Sprint 26 starts that day; the sprint before it runs until then |
| `26=2026-12-17/3w` | ...and lasts 3 weeks |
| `26/3w` | Sprint 26 lasts 3 weeks, starting when it would anyway |
| `30+/3w` | Sprint 30 and every later sprint last 3 weeks |
| `off=2026-12-24..2027-01-01` | Days off (or `off=2026-12-25` for one day): not work days |

Sprints after a change follow on from it at the regular length; a sprint number can be skipped by starting the next
one (`28=...`). Work days are Monday to Friday, less days off; "days left" counts today, so the last day says 1
("last day"). Entries that can't be read are ignored.

## Settings

On the bar (Apps → Pkmn Life → Setup), in its web UI, or in the [Pkmn Life Remote](../../mac) Mac app's Settings. The
app reads them when it starts, and while **Mac remote** is on it also picks up changes within a second.

| Setting | |
| --- | --- |
| Ticket style | FILE A TICKET's starting style: alternate, random, wild encounter or burst ticker |
| Redirect style | The redirects' starting style: random or one of the six |
| Clock | Plain, sprint bar, sprint dots or Majora's Mask |
| Title cards, Title card time | The Majora's Mask cards each work day, and when |
| Sprint changes | Moved or longer sprints, a new cadence, days off (above) |
| Mac remote | Let the [Pkmn Life Remote](../../mac) Mac app play entries (the app then checks for its requests, and for changed settings, once a second) |
| Remote request | Written by the Mac app; leave it empty |
| Time format, Show date, Colon blink | As the stock clock |

## Adding an entry

Entries are in [`src/presets.ts`](src/presets.ts): a nag (a message, with the words the ticker highlights) or a
redirect (a name and the side the person sits on, as seen from the front). Every entry's animations are rendered at
build time, so run `pnpm build` (or `pnpm sim` to try it first) after editing. Keep text printable ASCII. Moving
someone to the other side is a change of their `dir`.

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
| `src/presets.ts` | The entries and their styles |
| `assets/scenes/encounter.ts`, `ticker.ts` | Front: the two nag styles |
| `assets/scenes/redirect.ts` | Front: the six redirect looks |
| `assets/scenes/cards.ts` | Front: the Majora's Mask title cards |
| `assets/scenes/menu.ts` | Back: the move menu and the "now on front" countdown |
| `assets/build.ts` | Renders everything into `src/` (animations, images, `generated/clips.ts`) |

The Jira mark belongs to Atlassian; this app is for internal use.
