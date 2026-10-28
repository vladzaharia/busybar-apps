# @vladzaharia/bar-core

Runtime library for on-device BUSY Bar JavaScript apps. Everything that talks to the bar goes through here.

- `createApp({ app, priority })`: the device client, timers and input in one place; `quit()` releases them in the
  order the runtime needs.
- `Device`: `draw`, `clear`, `settings`. One request in flight, in order; redraws tagged with `coalesce` replace a
  waiting one.
- `AnimPlayer`: plays `.anim` sections (`play` now, `then` queued for when the current one ends).
- Components: `label` (centred on the capitals), `marquee` (firmware scrolling), `progressBar`, `toast` (removes
  itself).
- `clockFace`: the stock Clock app's layout. `readSettings`: typed settings with per-field fallback.
- `sprintAt(now, { number, start, weeks, changes })`: the running sprint and its work days left, following a
  regular cadence plus a list of changes (moved or longer sprints, a new cadence, days off; `parseSprintChanges`
  reads it). `sprintClockFace`: the clock
  with the sprint, as a bar of work days, a row of dots, or a growing moon ("majora").
- `LiveFace`: draws a set of elements whose make-up changes, clearing only ids it drew (the bar refuses a clear that
  names an unknown id). `shuffleBag`: random picks, every item once per round.
- `textWidth` and `METRICS`: the firmware fonts' advance widths (regenerate with `pnpm metrics`).
