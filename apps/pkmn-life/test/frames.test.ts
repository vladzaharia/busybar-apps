// The helpers the guard test reads frames with, checked on frames drawn here: so a failure of the guard test means a
// style, not the helper.

import assert from "node:assert/strict";
import { test } from "node:test";
import { Raster, font, hex, mix, textWidth, type Color } from "@vladzaharia/bar-pixel";
import { SCREEN, findName, inkBox, litPixels, luminance } from "./frames.ts";

const WHITE = hex("#FFFFFF");
const BLACK = hex("#000000");
const BIG = font("extra_large");

/** A frame with `name` drawn at (x, y) in `ink` on `ground` (a colour, a function of the row, or nothing: transparent). */
function frame(name: string, f = BIG, x = 3, y = 1, ink: Color = WHITE, ground?: Color | ((y: number) => Color), also?: (r: Raster) => void): Uint8Array {
  const r = new Raster(SCREEN.width, SCREEN.height);
  if (typeof ground === "function") r.shade((_x, py) => ground(py));
  else if (ground) r.clear(ground);
  r.text(name, f, x, y, ink);
  also?.(r);
  return r.toRGBA8();
}

test("findName finds the name where it was drawn, on any ground", () => {
  const gradient = (y: number) => mix(hex("#E6BA10"), hex("#C99A00"), y / 15);
  for (const name of ["SAM", "ALEX", "DAMIAN", "WWWWW"]) {
    for (const [x, y] of [[3, 1], [0, 0], [20, 3]] as const) {
      for (const ground of [BLACK, hex("#2F86FF"), gradient, undefined]) {
        const ink = ground === gradient ? hex("#111111") : WHITE;
        assert.deepEqual(findName(frame(name, BIG, x, y, ink, ground), name, BIG), { x, y }, `${name} at ${x},${y}`);
      }
    }
  }
  // Inside a line of dialogue (the trainer's "Go see ALEX!"), with the "!" right after it.
  const small = font("small");
  const ink = hex("#141820");
  const fill = hex("#9DA9BC");
  for (const line of ["Go see ALEX!", "TRAINER ALEX"]) {
    const x = 3 + textWidth(line.slice(0, line.indexOf("ALEX")), small);
    assert.deepEqual(findName(frame(line, small, 3, 0, ink, fill), "ALEX", small), { x, y: 0 }, line);
  }
});

test("findName does not find a name that is not whole, not clear, or not there", () => {
  assert.equal(findName(frame("ALEX"), "ALEXA", BIG), null, "a longer name is not there");
  assert.equal(findName(frame("ALE"), "ALEX", BIG), null, "a letter missing");
  assert.equal(findName(frame("ALEX"), "ALEX", font("small")), null, "another font");
  assert.equal(findName(new Raster(72, 16).toRGBA8(), "ALEX", BIG), null, "a clear frame");
  assert.equal(findName(new Raster(72, 16).clear(WHITE).toRGBA8(), "ALEX", BIG), null, "a flat frame");
  assert.equal(findName(frame("ALEX", BIG, 3, 1, WHITE, WHITE), "ALEX", BIG), null, "lettering the colour of the ground");
  // The name drawn off the screen is not whole.
  assert.equal(findName(frame("ALEX", BIG, -4, 1), "ALEX", BIG), null, "cut by the left edge");
  assert.equal(findName(frame("ALEX", BIG, 50, 1), "ALEX", BIG), null, "cut by the right edge");
  // A letter lit in another colour, or out of line.
  assert.equal(findName(frame("ALEX", BIG, 3, 1, WHITE, BLACK, (r) => r.text("A", BIG, 3, 1, hex("#FF0000"))), "ALEX", BIG), null, "a letter in another colour");
  const lowered = new Raster(72, 16).text("AL", BIG, 3, 1, WHITE).text("EX", BIG, 3 + 11 + 9, 2, WHITE).toRGBA8();
  assert.equal(findName(lowered, "ALEX", BIG), null, "letters out of line");
});

test("findName does not count a name that is faint, still fading, or too dim", () => {
  // Over a clear ground the straight RGB of a faded name stays white; it is the alpha that fades.
  for (const alpha of [0.02, 0.05, 0.1, 0.25, 0.5, 0.8]) {
    assert.equal(findName(frame("ALEX", BIG, 3, 1, hex("#FFFFFF", alpha)), "ALEX", BIG), null, `white at alpha ${alpha} on a clear ground`);
  }
  assert.deepEqual(findName(frame("ALEX", BIG, 3, 1, hex("#FFFFFF", 0.95)), "ALEX", BIG), { x: 3, y: 1 }, "alpha 0.95 is as good as lit");
  assert.deepEqual(findName(frame("ALEX", BIG, 3, 1, WHITE), "ALEX", BIG), { x: 3, y: 1 }, "opaque white on a clear ground");
  // On a lit ground it is the colour that fades: a quarter-bright name is too dim, a half-bright one is not.
  assert.equal(findName(frame("ALEX", BIG, 3, 1, hex("#404040"), BLACK), "ALEX", BIG), null, "#404040 on black");
  assert.equal(findName(frame("ALEX", BIG, 3, 1, hex("#FFFFFF", 0.25), BLACK), "ALEX", BIG), null, "a quarter-faded name on black");
  assert.deepEqual(findName(frame("ALEX", BIG, 3, 1, hex("#808080"), BLACK), "ALEX", BIG), { x: 3, y: 1 }, "#808080 on black");
  // Black lettering on a clear ground is no lettering at all (the clock shows through, and it is dark on the LEDs).
  assert.equal(findName(frame("ALEX", BIG, 3, 1, BLACK), "ALEX", BIG), null, "black on a clear ground");
});

test("findName needs a clear pixel of ground around the name, not more", () => {
  const at = { x: 3, y: 1 };
  const box = inkBox("ALEX", BIG, at);
  const block = (x: number) => (r: Raster) => r.fillRect(x, 4, 2, 4, hex("#FFB020"));
  // Touching the ink, or one clear pixel away on a plain ground: a chevron through the name, or hugging it.
  assert.equal(findName(frame("ALEX", BIG, 3, 1, WHITE, BLACK, block(box.x1 + 1)), "ALEX", BIG), null, "touching");
  // Two pixels away is clear: the margin is 1 px.
  assert.deepEqual(findName(frame("ALEX", BIG, 3, 1, WHITE, BLACK, block(box.x1 + 2)), "ALEX", BIG), at, "1 px clear");
  assert.equal(findName(frame("ALEX", BIG, 3, 1, WHITE, BLACK, (r) => r.fillRect(box.x0 + 3, box.y1 + 1, 4, 1, hex("#FFB020"))), "ALEX", BIG), null, "under the name");
  // Over the name.
  assert.equal(findName(frame("ALEX", BIG, 3, 1, WHITE, BLACK, (r) => r.fillRect(box.x0 + 12, 5, 3, 3, hex("#FFB020"))), "ALEX", BIG), null, "through the name");
  // A faint glow (a fifth of a colour) is part of the ground, a bright streak is not.
  assert.deepEqual(findName(frame("ALEX", BIG, 3, 1, WHITE, BLACK, (r) => r.fillRect(box.x1 + 1, 4, 3, 4, hex("#2F86FF", 0.12))), "ALEX", BIG), at, "a faint glow");
});

test("findName(spaced) finds letters on their own cars, in order", () => {
  const f = BIG;
  const cars = (letters: string, gap: number, skip = -1) => (r: Raster) => {
    let x = 2;
    [...letters].forEach((ch, i) => {
      r.fillRect(x - 2, 0, 14, 16, hex("#7A3B1E"));
      if (i !== skip) r.text(ch, f, x, 1, WHITE);
      x += 14 + gap;
    });
  };
  const draw = (letters: string, gap: number, skip = -1) => frame("", f, 0, 0, WHITE, BLACK, cars(letters, gap, skip));
  assert.deepEqual(findName(draw("SAM", 2), "SAM", f, true), { x: 2, y: 1 });
  assert.deepEqual(findName(draw("ALEX", 3), "ALEX", f, true), { x: 2, y: 1 });
  assert.equal(findName(draw("ALEX", 3), "ALEX", f, false), null, "the whole name is not set together");
  assert.equal(findName(draw("ALEX", 3, 2), "ALEX", f, true), null, "a letter missing");
  assert.equal(findName(draw("AXEL", 3), "ALEX", f, true), null, "letters in the wrong order");
});

test("luminance is the mean Rec. 709 luminance on black", () => {
  const flat = (c: Color) => new Raster(72, 16).clear(c).toRGBA8();
  assert.equal(luminance(flat(BLACK)), 0);
  assert.ok(Math.abs(luminance(flat(WHITE)) - 1) < 1e-9);
  assert.equal(luminance(new Raster(72, 16).toRGBA8()), 0, "transparent is dark");
  assert.ok(Math.abs(luminance(flat({ ...WHITE, a: 0.5 })) - 128 / 255) < 1e-9, "half-lit white");
  assert.ok(Math.abs(luminance(flat(hex("#00FF00"))) - 0.7152) < 1e-9, "green weighs most");
  assert.ok(Math.abs(luminance(new Raster(72, 16).fillRect(0, 0, 36, 16, WHITE).toRGBA8()) - 0.5) < 1e-9, "half the screen");
});

test("litPixels counts what is not transparent", () => {
  assert.equal(litPixels(new Raster(72, 16).toRGBA8()), 0);
  assert.equal(litPixels(new Raster(72, 16).fillRect(0, 0, 3, 2, hex("#000000")).toRGBA8()), 6, "black is lit");
  assert.equal(litPixels(new Raster(72, 16).fillRect(0, 0, 3, 2, hex("#FFFFFF", 0.01)).toRGBA8()), 6, "so is a trace");
});
