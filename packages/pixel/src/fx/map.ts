// A treasure map's marks: a dotted trail that draws itself along any path, and the X that marks the spot. Laid out
// for the rightward direction and mirrored for `dir` -1, like every wayfinding piece.

import { inQuad, lerp, span } from "../ease.ts";
import { stampPalette } from "../jira.ts";
import { fillPolygon, hex, mix, type Color, type Raster } from "../raster.ts";
import type { Direction } from "./arrows.ts";

/** A point on the screen (x, y), in px. */
export type Point = [number, number];

/**
 * The dashes of a dotted trail along `path` (s 0..1 to a point, in the rightward layout): `dash` px drawn, `gap` px
 * left out, walked by arc length so the dashes are even however the path winds. Each dash is its pixels, in order.
 */
export function trailDashes(path: (s: number) => Point, o: { dash?: number; gap?: number } = {}): Point[][] {
  const dash = o.dash ?? 2;
  const period = dash + (o.gap ?? 2);
  const dashes: Point[][] = [];
  let cur: Point[] = [];
  let walked = 0;
  let prev = path(0);
  for (let s = 0; s <= 1; s += 0.002) {
    const p = path(s);
    walked += Math.hypot(p[0] - prev[0], p[1] - prev[1]);
    prev = p;
    if (walked % period < dash) {
      const px: Point = [Math.floor(p[0]), Math.floor(p[1])];
      if (!cur.some((q) => q[0] === px[0] && q[1] === px[1])) cur.push(px);
    } else if (cur.length) {
      dashes.push(cur);
      cur = [];
    }
  }
  if (cur.length) dashes.push(cur);
  return dashes;
}

/**
 * A dotted trail drawing itself: dash k of `dashes` appears (over 0.12 s) at `start + k / n * duration`, at time `t`.
 * After `glint` seconds (if given) a light runs along it, again and again, towards its end. Mirrored for `dir` -1 on a
 * screen `r.width` wide.
 */
export function drawTrail(
  r: Raster,
  dashes: Point[][],
  o: { t: number; start: number; duration: number; dir: Direction; color?: Color; light?: Color; glint?: number },
): void {
  const color = o.color ?? hex("#FF5A4A");
  const light = o.light ?? hex("#FFD0C0");
  dashes.forEach((d, k) => {
    const appear = o.start + (k / dashes.length) * o.duration;
    const a = span(o.t, appear, appear + 0.12);
    if (a <= 0) return;
    const run = o.glint !== undefined && o.t > o.glint ? Math.exp(-((((((o.t - o.glint) * 14 - k) % 18) + 18) % 18) / 2.2)) : 0;
    for (const [x, y] of d) r.blend(o.dir > 0 ? x : r.width - 1 - x, y, mix(color, light, run * 0.7), a);
  });
}

const X_ART = ["X.....X", "XX...XX", ".XX.XX.", "..XXX..", ".XX.XX.", "XX...XX", "X.....X"];
/** The X is 7 x 7 at rest. */
export const TREASURE_X_SIZE = 7;

/**
 * The X that marks the spot, centred on (cx, cy) (screen coordinates). `stamp` 0..1 brings it down from nearly three
 * times its size, fading in, as if stamped on; at 1 it rests as pixel art with a dark drop shadow.
 */
export function drawTreasureX(r: Raster, cx: number, cy: number, o: { stamp?: number; color?: Color; shadow?: Color } = {}): void {
  const q = o.stamp ?? 1;
  if (q <= 0) return;
  const color = o.color ?? hex("#FF3B30");
  if (q < 1) {
    const s = lerp(2.8, 1, inQuad(q));
    const arm = (ax: number, ay: number): Point[] => {
      const L = 3.6 * s;
      const T = 0.95 * s;
      return [
        [cx + ax * L - ay * T, cy + ay * L + ax * T],
        [cx + ax * L + ay * T, cy + ay * L - ax * T],
        [cx - ax * L + ay * T, cy - ay * L - ax * T],
        [cx - ax * L - ay * T, cy - ay * L + ax * T],
      ];
    };
    const d = Math.SQRT1_2;
    fillPolygon(r, arm(d, d), color, q);
    fillPolygon(r, arm(d, -d), color, q);
    return;
  }
  const x = Math.round(cx - 3.5);
  const y = Math.round(cy - 3.5);
  stampPalette(r, X_ART, x + 1, y + 1, { X: o.shadow ?? hex("#5A140C") });
  stampPalette(r, X_ART, x, y, { X: color });
}
