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
- `textWidth` and `METRICS`: the firmware fonts' advance widths (regenerate with `pnpm metrics`).
