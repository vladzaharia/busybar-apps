# Pkmn Life

Team screens for the BUSY Bar. The front shows a clock (laid out like the stock Clock app), optionally with the
current sprint. The back is a handheld-RPG move menu: pick an entry and press START to play it on the front.

| Entry | What the front shows | Styles |
| --- | --- | --- |
| FILE A TICKET | "Did you file a JIRA ticket yet???" | Eleven looks, from a wild encounter to a slot machine ([the table below](#the-jira-nag)) |
| A person, e.g. ALEX | Sends people to Alex, on the right | Fifteen looks, from chevrons to a paper plane ([below](#the-redirects)); each mirrors for someone on the left |

## The styles

Every style is pre-rendered at build time, for every name, and plays over the live clock: it opens by covering the
clock and ends by uncovering it. The Jira mark is placed by its optical centre, the lettering is one white, and a "?"
that is asked of the room (the encounter's, the ticker's, the 8-ball's, the progress bar's) pulses from white to
amber, the same way everywhere. [The gallery](#the-gallery) plays them all.

### The Jira nag

| Style | What plays |
| --- | --- |
| **Wild encounter** | The screen flashes and stripes away, a wild ISSUE (a bug) scuttles in with its HP bar, and the message plays out in typed dialogue boxes. Then TRAINER uses FILE JIRA TICKET: the Jira mark flies at the bug, its HP drains, it's super effective, and the bug turns into a Jira ticket. |
| **Burst ticker** | The clock switches off into a burst, the Jira chevrons fly in, the message glides in letter by letter over drifting particles, then rolls up in full. |
| **Departure board** | Blinds close onto a split-flap board: every flap clatters and stops on FILE A / TICKET?, then the airline flap turns through other logos and lands on Jira. |
| **Stuck progress bar** | "Filing ticket..." with a spinner and a bar that creeps to 99% and stalls, turns amber, and rolls away for "...you didn't, did you?". |
| **404** | The clock tears into black; "404 \| TICKET NOT FOUND" flickers in through heavy glitching, slams into place and tears apart on the way out. |
| **Bug squash** | A bug scuttles in; a Jira ticket drops from above and flattens it (the screen shakes, dust puffs), then NO TICKET, / NO FIX. |
| **Ticket buddy** | The Jira ticket, with a face, hops in and asks "FILE ME?", then "PLEASE?" with big eyes, and does a happy double hop. |
| **Slot machine** | Bulbs chase round a slot machine, the lever is pulled, three reels land on Jira, Jira, Jira; confetti, "JACKPOT!", then "FILE IT!". |
| **Magic 8-ball** | "WHAT DO I NEED NOW?" types beside an 8-ball. It shakes, and the view irises into its window, where "SIGNS POINT TO", then "A TICKET", float up out of the ink. |
| **Ticket invaders** | Over a starfield, little Jira-card invaders march in and a cannon files each one (a zap, a green check); the next wave comes and "FILE THEM ALL!" types in. |
| **Forecast** | A cloud rains little tickets while the forecast rolls through beside it: "TODAY'S FORECAST", "100%" (with lightning), "CHANCE OF TICKETS", "FILE ONE!". |

### The redirects

For someone on the right; each is mirrored for someone on the left (the layout flips, the lettering does not). A wide
name (the limit is [46 px](#who-the-redirects-send-to), e.g. DAMIAN) gets fewer decorations, never less of the name.

| Style | What plays |
| --- | --- |
| **Runway** | An amber wipe, then amber chevrons chasing their way with the name opposite: as many chevrons (two to four) as fit beside the name. |
| **Nudge** | A big arrow sweeps across, settles pointing their way and keeps nudging. |
| **Wayfinding sign** | A dark-yellow airport sign with the name and an arrow slides in from their side, and out again. |
| **Walker** | A little person walks in leaving the name behind them letter by letter, waves, points their way, walks over and says "HI!" in a speech bubble ("HI" when the name is wide), then steps off. |
| **Trainer** | Battle stripes, then a dialogue box: "TRAINER ALEX can help you!", "Go see ALEX!". |
| **Scroller** | Chevrons and the name stream their way like a moving-walkway sign, slow to a stop with the name centred for as long as it takes to read, and speed off. |
| **Motorway sign** | A green gantry sign drops in with the name in white and a GO! tab and exit arrow on their side; the sheen runs across and the arrow nudges. It slides off their way. |
| **Exit sign** | A green EXIT sign flickers on. The person sits at their own table on their side, chevrons pulse their way, and the pictogram figure, a visitor, walks over to the table; then the name lights. |
| **Parcel van** | "Out for delivery" over a tracking line that ends at their house; a delivery van with the name on its box drives in, parks with its indicator blinking, and pulls off their way. |
| **Paper plane** | A paper plane loops the loop, then tows the name in on a banner, holds it still while it is read, and pulls it off their way. |
| **Pointing hand** | A big cartoon hand pokes in pointing their way; the name drops in where it points, gets two pokes, and a last jab knocks it off. |
| **Little train** | An engine chugs in pulling flatcars, one letter of the name on each, stops, lets off steam and chugs away their way. |
| **Growlithe** | Growlithe bounds in with the name popping up behind it, barks their way (a puff of embers, the letters hop), and bounds off; its cry, "GROWL!" ("GRR!" when the name is wide), comes from over there. |
| **Shout** | A megaphone shouts "HEY!" at them, then blasts out the name; the letters fly off their way. |
| **Treasure map** | A parchment unrolls their way, a dotted red trail walks off and an X stamps down; the name rises out of the ground in gold, and the map rolls up. |

"Right" and "left" are as someone facing the front display sees them.

## Who the redirects send to

The names aren't in the repository. Put them in `redirects.json` in this folder (git ignores it), one entry per
person with the side they sit on: `"< Name"` on the left, `"Name >"` on the right.

```json
["< Sam", "Alex >"]
```

Without the file, the build uses `redirects.example.json` (the two above). `pnpm assets` (part of `pnpm build`,
`pnpm sim` and `pnpm typecheck`) renders each person's animations and the back menu from it, so change the file and
build again. A name can be up to 46 px wide on the front in the large font (about five letters; DAMIAN is exactly
46, WWWWW is 45), and the build says so if it is wider. Up to six people fit the back menu. Each entry's id, which
the Mac remote uses,
is its name in lower case without spaces or punctuation: `alex`. Give the [Mac app](../../mac) the same list.

## Controls

| Control | Back screen (menu) | While something plays |
| --- | --- | --- |
| Wheel | Choose an entry | |
| START | Play it on the front | |
| Hold START | The Majora's Mask title card for now: dawn, meal or dusk (when that is the clock animation) | |
| OK (press the wheel) | Change how the selected entry plays: a style, or random | |
| BACK | Leave the app | Stop it |

The back header shows how the next START will play: the style's name (ENCOUNTER, 404, GROWLITHE ...), RANDOM, or
for FILE A TICKET on **Each in turn**, ALT: and the style it plays next. OK on FILE A TICKET cycles each in turn →
random → the eleven styles in the order of [the table](#the-jira-nag) (encounter, ticker, board, progress, 404,
squash, buddy, slots, 8-ball, invaders, forecast). Each in turn plays the nags in that same order, the next one after
every play, and starts over after the last. OK on a redirect cycles random → the fifteen looks (runway, nudge, sign,
walker, trainer, scroller, motorway, exit, parcel, plane, hand, train, Growlithe, shout, map). In random, each START
picks a style, every style coming up once per round in a fresh order.

## Clock

The front clock is laid out like the stock one. Two settings change it, each on its own: how it shows the sprint, and
what plays over it each work day.

| Sprint | |
| --- | --- |
| Not shown | The stock clock. |
| Sprint bar | A segment per work day along the bottom edge: done, today (blinking), to go. The line under the time alternates the date and "Sprint 22". |
| Sprint dots | The date stays on the calendar; under the time, "S22" and a dot per work day. |
| Days left | The sprint and days left in short under the time, a thin rule between them ("S22 \| 6 left", "S22 \| last day"). |

| Clock animation | |
| --- | --- |
| None | Nothing plays over the clock. |
| Majora's Mask: dawn | Each work day at the dawn time the title cards play: "Dawn of The Fifth Day", then "-6 Days Remain-", counting through the sprint. |
| Majora's Mask: all day | As dawn, and also "Meal of The Fifth Day" at the meal time and "Dusk of The Fifth Day" at the dusk time. On the last day of the sprint, "The Final Day". |

When the app starts on a work day, and when you hold START, the card for the part of the day it is plays.

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
| Ticket style | FILE A TICKET's starting style: each in turn (the default), random, or one of the eleven styles |
| Redirect style | The redirects' starting style: random (the default) or one of the fifteen styles |
| Sprint | How the clock shows the sprint: not shown, sprint bar, sprint dots or days left |
| Clock animation; Dawn, Meal, Dusk time | None, or the Majora's Mask title cards on work days, at dawn or all day; and when |
| Sprint changes | Moved or longer sprints, a new cadence, days off (above) |
| Mac remote | Let the [Pkmn Life Remote](../../mac) Mac app play entries (the app then checks for its requests, and for changed settings, once a second) |
| Remote request | Written by the Mac app; leave it empty |
| Time format, Show date, Colon blink | As the stock clock |

## Adding an entry

Entries are in [`src/presets.ts`](src/presets.ts): a nag (a message, with the words the ticker highlights) or a
redirect (a name and the side the person sits on, as seen from the front). Every entry's animations are rendered at
build time, so run `pnpm build` (or `pnpm sim` to try it first) after editing. Keep text printable ASCII. Moving
someone to the other side is a change of their `dir`.

## The gallery

`concepts/` renders every front style, as LEDs at device resolution and speed, into one page, to look at them side by
side and decide about them. Run it from this folder (`pnpm assets` first on a fresh checkout: it builds from
`src/presets.ts`):

```sh
node concepts/build.ts    # writes design-out/concepts/index.html at the repository root (git ignores it)
```

The page has five groups: **Review** (the items that are in debate, such as the Jira mark's centring, the glare fixes,
the exit sign's visit to the table, Growlithe's cry, and every wide name in both directions; each card says what to
look at), **Jira** (all eleven nags), **Redirect · ALEX, right** and **Redirect · SAM, left** (all fifteen
redirects each), and **Unchosen concepts** (prototypes that were not built: a terminal, a notification, a checkbox, a
hungry pet, a sat-nav, a call transfer, the first EXIT sign with a door, an office-cubicle EXIT sign, a UFO, bowling
and a brown dog). Click a display to pause it. The redirects are shown for SAM, ALEX and DAMIAN, never the names in
`redirects.json`.

The styles come from `assets/scenes/registry.ts`, so a new one only needs its card text in `NAG_ABOUT` or
`REDIRECT_ABOUT` in `concepts/build.ts` (the typecheck below says which is missing). A new prototype is a module
that exports `CONCEPTS` (see `concepts/types.ts`) and is added to `build.ts`; `node concepts/sheet.ts
concepts/<module>.ts <out-dir>` renders a contact sheet of each concept in a module, for checking by eye. The
harness has its own typecheck:

```sh
npx tsc --noEmit -p concepts
```

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
| `assets/scenes/encounter.ts`, `ticker.ts`, `nags/` | Front: the nag styles (one file each under `nags/`) |
| `assets/scenes/look.ts` | What the nags share: the lettering white, the amber "?" pulse, soft box fills |
| `assets/scenes/redirect.ts` | Front: the first six redirect looks |
| `assets/scenes/redirects/` | Front: the other nine (motorway sign, exit sign, parcel van, paper plane, pointing hand, little train, Growlithe, shout, treasure map), one file each; `kit.ts` holds what they share |
| `assets/scenes/registry.ts` | Every front style by id (`NAG_SCENES`, `REDIRECT_SCENES`): what the build renders and the guard test checks |
| `test/styles.test.ts`, `frames.ts` | The guard test: every style, in every name and direction, against the visual audit (`pnpm test`) |
| `assets/scenes/cards.ts` | Front: the Majora's Mask title cards (dawn, meal, dusk, days remaining) |
| `assets/scenes/menu.ts` | Back: the move menu and the "now on front" countdown |
| `assets/build.ts` | Renders everything into `src/` (animations, images, `generated/clips.ts`) |
| `concepts/` | The gallery of every style (`build.ts`), and the prototypes that were not chosen ([below](#the-gallery)) |

The Jira mark belongs to Atlassian; this app is for internal use.
