# @vladzaharia/bar-pixel

Build-time toolkit for pre-rendered BUSY Bar animation.

- `.anim` encoder and decoder (`encodeAnim`, `AnimReader`, `decodeAnim`): raw, RLE and QOI frames, change masks,
  sections. Verified against the firmware's own encoder and the stock app's animations.
- `Raster`, the firmware's fonts (`font`, `textWidth`), masks, PNG I/O, the Jira mark sprites.
- Timeline: `clip`, `seq`, `layer`, `buildAnim` (named parts → sections, with their lengths).
- Effects (`src/fx/`): transitions, backgrounds, text, HUD and modifiers. Every one is in `src/catalog.ts` with a
  demo; `pnpm gallery <out-dir>` renders the browsable gallery.
- `MOTION` and `readTime`: durations calibrated against the stock animations.
- `writePreview`, `drawElements`: preview pages and a draw-element emulator.
