# Pkmn Life

Team screens for the BUSY Bar. The front shows a clock (laid out like the stock Clock app), optionally with the
current sprint. The back is a handheld-RPG move menu: pick an entry and press START to play it on the front.

| Entry | What the front shows | Styles |
| --- | --- | --- |
| FILE A TICKET | "Did you file a JIRA ticket yet???" | **Wild encounter**: the screen flashes and stripes away, a wild ISSUE slides in with its HP bar, and the message plays out in typed dialogue boxes. **Burst ticker**: the clock switches off into a burst, the Jira chevrons fly in, the message glides in letter by letter, then rolls up in full. |
| ALEX | Sends people to Alex, on the right | **Runway** (amber chevrons chasing his way), **Nudge** (a big arrow pointing and nudging), **Wayfinding sign** (a yellow airport sign sliding in from his side), **Walker** (a little person walks in, points, and heads off his way), **Trainer** ("TRAINER ALEX can help you!"), **Scroller** (chevrons and his name streaming his way). |
| SAM | The same, to Sam on the left | As ALEX, mirrored. |

"Right" and "left" are as someone facing the front display sees them.

## Controls

| Control | Back screen (menu) | While something plays |
| --- | --- | --- |
| Wheel | Choose an entry | |
| START | Play it on the front | |
| Hold START | Today's Majora's Mask title card (with that clock) | |
| OK (press the wheel) | Change how the selected entry plays: a style, or random | |
| BACK | Leave the app | Stop it |

The back header shows how the next START will play. FILE A TICKET cycles alternate → random → encounter → ticker
("alternate" switches style after each play). ALEX and SAM cycle random → each of the six looks. In random, each
START picks a style, every style coming up once per round in a fresh order.

## Clock

| Clock | |
| --- | --- |
| Plain | The stock clock. |
| Sprint bar | A segment per work day along the bottom edge: done, today (blinking), to go. The line under the time alternates the date and "Sprint 22". |
| Sprint dots | The date stays on the calendar; under the time, "S22" and a dot per work day. |
| Majora's Mask | A moon in place of the calendar that grows as the sprint runs out, with "6 Days Remain" under the time. Each work day at the set time (and when the app starts) the title cards play: "Dawn of The Fifth Day", then "-6 Days Remain-". |

Sprints repeat every `Sprint length` weeks from the sprint you give in settings (number and first day). Work days
are Monday to Friday; "days left" counts today, so the last day says 1 ("Final Day"). Holidays are not known.

## Settings

On the bar (Apps → Pkmn Life → Setup) or in its web UI. The app reads them when it starts.

| Setting | |
| --- | --- |
| Ticket style | FILE A TICKET's starting style: alternate, random, wild encounter or burst ticker |
| Redirect style | ALEX and SAM's starting style: random or one of the six |
| Clock | Plain, sprint bar, sprint dots or Majora's Mask |
| Title cards, Title card time | The Majora's Mask cards each work day, and when |
| Sprint number, Sprint start, Sprint length | Any sprint's number and first day (YYYY-MM-DD), and weeks per sprint |
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
