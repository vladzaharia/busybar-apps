# @vladzaharia/bar-pixel

Build-time toolkit for pre-rendered BUSY Bar animation.

- `.anim` encoder and decoder (`encodeAnim`, `AnimReader`, `decodeAnim`): raw, RLE and QOI frames, change masks,
  sections. Checked against the firmware's own code (see below).
- `Raster`, the firmware's fonts (`font`, `textWidth`), masks, PNG I/O, the Jira mark sprites.
- Timeline: `clip`, `seq`, `layer`, `buildAnim` (named parts → sections, with their lengths).
- Effects (`src/fx/`): transitions, backgrounds, text, HUD and modifiers. Every one is in `src/catalog.ts` with a
  demo; `pnpm gallery <out-dir>` renders the browsable gallery.
- `MOTION` and `readTime`: durations calibrated against the stock animations.
- `writePreview`, `drawElements`: preview pages and a draw-element emulator.

## Conformance with the firmware

`pnpm test` includes the firmware's RLE unit test (`rle_test.c`, ported) and golden outputs of its `rle_compress`.
The full check needs a checkout of the firmware repository, gcc, and a Python with Pillow and colorlog:

```sh
pnpm --filter @vladzaharia/bar-pixel conformance <firmware-checkout> [--python <python3>] [file.anim | folder ...]
```

It compiles the firmware's `lib/anim_file` decoder and `toolbox/rle_encode` for the host (`conformance/` has the
small stand-ins for `furi` and storage they need) and checks:

- RLE: the ported `rle_test.c` and `rle.py` tests, every block size 1..8, across our codec, the firmware's C code
  and its Python reference. Our compressor's output is the C `rle_compress` output byte for byte.
- QOI: byte for byte the output of `seq2anim.py`'s compressor.
- Whole files: frame sequences in all three colour formats through `seq2anim.py` and `encodeAnim` give the same
  header, sections and masks. Pixels differ in only two known places: `encodeAnim` also tries QOI on keyframes, and
  it uses the C RLE where `rle.py` differs. Both files decode to the source frames in the firmware's decoder.
- Every `.anim` given (by default each app's built animations) decodes, section by section, in the firmware's
  decoder exactly as `AnimReader` decodes it.

`rle.py` differs from the C encoder in one spot: a verbatim stretch that ends at a run of 5 or more keeps 4 blocks
of the run (its `verbatim_count += repeat_count` belongs in the loop's `else:`). The output is still valid, just
larger.
