# @vladzaharia/bar-core

Runtime library for on-device BUSY Bar JavaScript apps. Everything that talks to the bar goes through here.

- `createApp({ app, priority })`: the device client, timers and input in one place; `quit()` releases them in the
  order the runtime needs.
- `Device`: `draw`, `clear`, `settings`. One request in flight, in order; redraws tagged with `coalesce` replace a
  waiting one.
- `AnimPlayer`: plays `.anim` sections (`play` now, `then` queued for when the current one ends).
- Components: `label` (centred on the capitals and on its ink), `marquee` (firmware scrolling), `progressBar`, `toast` (removes
  itself).
- `clockFace`: the stock Clock app's layout (with 4 px after the calendar instead of 2). `readSettings`: typed settings with per-field fallback.
- `sprintAt(now, { number, start, weeks, changes })`: the running sprint and its work days left, following a
  regular cadence plus a list of changes (moved or longer sprints, a new cadence, days off; `parseSprintChanges`
  reads it). `sprintClockFace`: the clock
  with the sprint, as a bar of work days, a row of dots, or in short under the time with a thin drawn rule between ("S22 | 6 left").
- `LiveFace`: draws a set of elements whose make-up changes, clearing only ids it drew (the bar refuses a clear that
  names an unknown id). `shuffleBag`: random picks, every item once per round.
- `remoteInbox`: requests from outside the bar (such as a Mac app), written into a settings field over the HTTP API
  and checked once a second. Its `onValues` sees every read, so an app can apply settings changed while it runs.
- `textWidth`, `inkWidth` and `METRICS`: the firmware fonts' advance widths and the blank column after each glyph's
  ink (`inkWidth` is `textWidth` less the last one: centre and right-align on it; regenerate with `pnpm metrics`).
