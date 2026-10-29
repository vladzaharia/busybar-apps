// A slot machine's reel: a window onto a strip of symbols that spins past, blurring at speed, and lands with a little
// overshoot on a whole symbol. The symbols are any drawing (a 7, a bug, the Jira mark), given as functions.

import { outBack, span } from "../ease.ts";
import { hex, mix, type Color, type Raster } from "../raster.ts";

/** Draws one symbol centred on column `cx`, its top at `top`, at `alpha`. */
export type ReelSymbol = (r: Raster, cx: number, top: number, alpha: number) => void;

/** The window's glass: deep blue in the middle, darker towards the top and bottom edges, as if the strip curved away. */
const GLASS = { mid: hex("#13284D"), edge: hex("#040A16") };

/**
 * A reel at (x, y), `width` × `height`: a rounded window onto `strip`, `gap` px from one symbol's top to the next.
 * `offset` is how far it has turned in px; symbol `start` of the strip shows at offset 0, and at `steps * gap` the
 * strip has moved on `steps` symbols, the one now showing being `start + steps`. Symbols move down as the reel turns.
 * `speed` (px/s) blurs them into streaks; `glow` 0..1 lights the window (a reel stopping, a win).
 */
export function drawReel(
  r: Raster,
  o: {
    x: number;
    y: number;
    width: number;
    height: number;
    strip: ReelSymbol[];
    offset: number;
    gap: number;
    start?: number;
    /** Row of a resting symbol's top, below the window's top. */
    inset?: number;
    speed?: number;
    glow?: number;
    glowColor?: Color;
  },
): void {
  const { x, y, width, height } = o;
  const mid = y + height / 2;
  r.roundRect(x, y, width, height, 2, (_x, py) => mix(GLASS.mid, GLASS.edge, Math.pow(Math.abs(py + 0.5 - mid) / (height / 2), 2)));
  const clipBefore = r.clip;
  r.clip = { x0: x, y0: y, x1: x + width, y1: y + height };
  const n = o.strip.length;
  const blur = Math.min(1, Math.abs(o.speed ?? 0) / 200);
  const first = Math.floor(o.offset / o.gap) - 1;
  for (let k = first; k <= first + 2; k++) {
    const top = y + (o.inset ?? 1) + o.offset - k * o.gap;
    const symbol = o.strip[((((o.start ?? 0) + k) % n) + n) % n]!;
    if (blur > 0.1) {
      // At speed: the symbol and two fainter copies trailing above it.
      for (const [dy, a] of [[0, 0.7], [-3, 0.35], [-6, 0.15]] as const) symbol(r, x + width / 2, Math.round(top + dy * blur), a);
    } else symbol(r, x + width / 2, Math.round(top), 1);
  }
  r.clip = clipBefore;
  if (o.glow && o.glow > 0) r.glow(x + width / 2, mid, width * 0.56, height * 0.57, { ...(o.glowColor ?? hex("#FFFFFF")), a: 0.55 * o.glow }, 2);
}

/**
 * How far a reel set spinning at `at` and stopping at `stop` has turned at `t`: `steps` whole symbols of `gap` px in
 * all, easing out with a small overshoot past the last one as it lands.
 */
export function reelOffset(t: number, o: { at: number; stop: number; steps: number; gap: number }): number {
  const u = span(t, o.at, o.stop);
  return o.steps * o.gap * (u >= 1 ? 1 : outBack(u, 0.9));
}

/**
 * How many symbols a reel starting on `start` must turn, at least `min`, to land on one that `wanted` accepts (so
 * every reel spins a good while and still stops where the scene needs it to).
 */
export function reelSteps<T>(strip: T[], start: number, wanted: (s: T) => boolean, min: number): number {
  for (let k = min; k < min + strip.length; k++) if (wanted(strip[(start + k) % strip.length]!)) return k;
  throw new Error("no symbol on the strip is wanted");
}
