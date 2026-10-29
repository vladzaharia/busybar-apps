// Treasure map: a parchment unrolls their way over the clock, a dotted red trail walks off that way and an X stamps
// down at its end (the marks jolt with the thud); the name rises out of the ground beside it in gold, at the edge on
// their side, with a glint sweeping across it and sparkles round it; the map rolls up their way.
//
// The name is NAME_EDGE from their edge on its ink, the X just short of it, and the trail winds from the far edge to
// the X: a wide name leaves it less width, so it swings further up and down.

import {
  MOTION,
  NAME_EDGE,
  Raster,
  clip,
  drawTrail,
  drawTreasureX,
  hex,
  inOutCubic,
  lerp,
  mirrorX,
  mix,
  outBack,
  outCubic,
  rng,
  shake,
  span,
  sparkles,
  trailDashes,
  type Clip,
} from "@vladzaharia/bar-pixel";
import type { Redirect } from "../../../src/presets.ts";
import { BIG_Y, H, W, big, nameInk } from "./kit.ts";

// The parchment: dark enough not to glare as a whole screen, light enough that the LEDs show it.
const PARCH = hex("#4A3518");
const PARCH_LIGHT = hex("#6A4E26");
const PARCH_DARK = hex("#2E2010");
const GOLD = hex("#FFC23D");
const ROLL = [hex("#6A4E26"), hex("#B08850"), hex("#D8B47A"), hex("#8A6A3A")];

/** Brightens a raster's lit pixels towards `light` by `k(x, y)` (0..1), keeping their alpha: a glint across lettering. */
function sheen(s: Raster, k: (x: number, y: number) => number, light: { r: number; g: number; b: number }): void {
  for (let y = 0; y < s.height; y++) {
    for (let x = 0; x < s.width; x++) {
      const i = (y * s.width + x) * 4;
      const a = s.data[i + 3]!;
      const m = a > 0 ? k(x, y) : 0;
      if (m <= 0) continue;
      s.data[i] = lerp(s.data[i]!, light.r * a, m);
      s.data[i + 1] = lerp(s.data[i + 1]!, light.g * a, m);
      s.data[i + 2] = lerp(s.data[i + 2]!, light.b * a, m);
    }
  }
}

export function map(e: Redirect): Clip {
  const inkW = nameInk(e);
  // Rightward layout: the name at their edge, the X centred 6.5 px short of it, the trail from the far edge to the X.
  const nameR = W - NAME_EDGE - inkW;
  const xc = nameR - 6.5;
  const UNROLL = MOTION.slow;
  const TRAIL_T = 1.5;
  const STAMP = 0.2;
  const HOLD = 2.6;
  const ROLL_UP = MOTION.slow;
  const tTrail = UNROLL + 0.1;
  const tStamp = tTrail + TRAIL_T;
  const tName = tStamp + STAMP + 0.1;
  const tRoll = tName + HOLD;
  const total = tRoll + ROLL_UP;
  // A wandering path from the far edge to just short of the X; the narrower it has to be, the further it swings up
  // and down, so a wide name's trail still reads as a trail (rows 2..13).
  const endX = xc - 5;
  const width = endX - 1;
  const swing = 3.2 + Math.max(0, (24 - width) / 12) * 1.6;
  const dashes = trailDashes((s) => [lerp(1, endX, s), Math.max(2, Math.min(13, 9 + Math.sin(s * Math.PI * 1.7 + 0.4) * swing - s * 1.5))]);
  const rand = rng(17);
  const grain = Array.from({ length: W * H }, () => rand());
  const nameX = mirrorX(nameR, inkW, e.dir);
  const xAt = mirrorX(Math.round(xc - 3.5), 7, e.dir) + 3.5;
  // Glints round the name, never on it.
  const glint = sparkles({
    duration: total,
    count: 7,
    seed: 5,
    color: hex("#FFE9A8"),
    box: { x: mirrorX(nameR - 2, inkW + 5, e.dir), y: 0, width: inkW + 5, height: H },
    avoid: { x: nameX - 1, y: 2, width: inkW + 2, height: 12 },
  });
  // The marks on the map (trail, X and its dust), which jolt as the X lands; the parchment stays put.
  const marks = shake(
    clip(total, (r, t) => {
      drawTrail(r, dashes, { t, start: tTrail, duration: TRAIL_T, dir: e.dir, glint: tName });
      drawTreasureX(r, xAt, 7.5, { stamp: span(t, tStamp, tStamp + STAMP) });
      // A puff of dust where it hit.
      const k = span(t, tStamp + STAMP, tStamp + STAMP + 0.35);
      if (k > 0 && k < 1) {
        for (const [dx, dy] of [[-1, 0], [1, 0], [-0.7, 0.6], [0.7, 0.6], [-0.7, -0.6], [0.7, -0.6]] as const) {
          r.blend(xAt + dx * (5 + k * 4), 7.5 + dy * (4 + k * 3), hex("#C9A870"), 1 - k);
        }
      }
    }),
    { from: tStamp + STAMP, to: tStamp + STAMP + 0.3, amplitude: 1, vertical: true },
  );
  const drawContent = (r: Raster, t: number) => {
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const g = grain[y * W + x]!;
        const vign = Math.min(1, Math.min(y, H - 1 - y) / 3) * 0.6 + 0.4;
        r.blend(e.dir > 0 ? x : W - 1 - x, y, mix(PARCH_DARK, mix(PARCH, PARCH_LIGHT, g * 0.6), vign));
      }
    }
    marks.draw(r, t);
    // The name: dug up out of the ground (row 13), in gold, a letter at a time.
    const gold = new Raster(W, H);
    gold.clip = { x0: 0, y0: 0, x1: W, y1: 13 };
    gold.text(e.name, big(), nameX, BIG_Y, GOLD, (i) => {
      const k = span(t, tName + i * 0.08, tName + i * 0.08 + 0.4);
      return { hidden: k <= 0, dy: Math.round(lerp(11, 0, outBack(k, 1.6))) };
    });
    // A glint sweeping across the gold every so often, their way.
    const g = (t - tName - 0.7) % 1.6;
    if (t > tName + 0.7) {
      const from = e.dir > 0 ? nameX - 8 : nameX + inkW + 8;
      const to = e.dir > 0 ? nameX + inkW + 8 : nameX - 8;
      sheen(gold, (x, y) => Math.max(0, 1 - Math.abs(x - e.dir * y * 0.7 - lerp(from, to, g / 0.6)) / 2.5) * 0.85, hex("#FFF6DA"));
    }
    r.draw(gold, 0, 0);
    if (t > tName + 0.3) glint.draw(r, t);
  };
  /** The rolled-up edge of the map, a lighter cylinder, at rightward column `x`. */
  const drawRoll = (r: Raster, x: number) => {
    ROLL.forEach((c, k) => {
      const cx = Math.round(x) + k - 2;
      for (let y = 0; y < H; y++) r.blend(e.dir > 0 ? cx : W - 1 - cx, y, c);
    });
  };
  return clip(total, (r, t) => {
    if (t < UNROLL || t >= tRoll) {
      // Unrolling their way, or rolling up their way: the map behind the roll, the clock ahead of it (or behind it).
      const opening = t < UNROLL;
      const rx = opening ? lerp(-3, W + 3, outCubic(t / UNROLL)) : lerp(-3, W + 3, inOutCubic((t - tRoll) / ROLL_UP));
      const s = new Raster(W, H);
      drawContent(s, t);
      s.fade((x) => {
        const c = e.dir > 0 ? x : W - 1 - x;
        return opening ? (c < rx ? 1 : 0) : c > rx ? 1 : 0;
      });
      r.draw(s, 0, 0);
      drawRoll(r, rx);
      return;
    }
    drawContent(r, t);
  });
}
