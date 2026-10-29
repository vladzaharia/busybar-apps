// Front nag "404": the clock tears into black. "404 | TICKET NOT FOUND" flickers in through heavy glitching (it shows
// faintly, drops out, comes back brighter, drops out, and comes up for good), slams into place with a shake, glitches
// now and then while it holds, and tears apart on the way out (dropping out twice and coming back fainter each time);
// the black then fades off the clock.

import {
  MOTION,
  Raster,
  capCentre,
  capTop,
  clip,
  fade,
  font,
  glitch,
  hex,
  inkWidth,
  layer,
  readTime,
  rng,
  seq,
  shake,
  span,
  tear,
  type Clip,
} from "@vladzaharia/bar-pixel";
import type { Nag } from "../../../src/presets.ts";
import { BLACK, JIRA_LIGHT, WHITE } from "../look.ts";

const W = 72;
const H = 16;
const ORANGE = hex("#FF7A33");
/** The group sits 2 px from either edge: "404", 2 px, the rule, 2 px, the two lines (NOT FOUND ends 2 px in). */
const X404 = 2;
const SEP = X404 + inkWidth("404", font("extra_large")) + 2;
const TX = SEP + 3;

/** A number in [0, 1) for an integer, the same every render. */
const chance = (n: number) => rng(n)();

/** How the picture flickers in, from black: when it shows (seconds into the flicker, from and to) and how brightly. */
const FLICKER_IN: [number, number, number][] = [
  [0.06, 0.16, 0.25],
  [0.24, 0.34, 0.5],
  [0.42, Infinity, 1],
];
/** And out: on, dropping out, back at half, out, back at a quarter, gone. */
const FLICKER_OUT: [number, number, number][] = [
  [0, 0.08, 1],
  [0.15, 0.24, 0.5],
  [0.31, 0.38, 0.25],
];
/** Each re-appearance fades up over this long, rather than strobing on: a glitch, not a flashing light. */
const FADE_UP = 0.06;

/** How much of the picture shows `t` s into a flicker: 0 between its beats. */
function flickerLevel(t: number, beats: [number, number, number][]): number {
  for (const [from, to, level] of beats) if (t >= from && t < to) return level * (from > 0 ? Math.min(1, (t - from) / FADE_UP) : 1);
  return 0;
}

export function notfound(_e: Nag): Clip {
  const xl = font("extra_large");
  const small = font("small");
  const NOISE = 0.45;
  const IN = 0.55;
  const HOLD = readTime("404 TICKET NOT FOUND") + MOTION.scene;
  const OUT = 0.45;
  const D = IN + HOLD + OUT;
  const still = clip(D, (r) => {
    r.text("404", xl, X404, capCentre("extra_large"), ORANGE);
    r.fillRect(SEP, 3, 1, 10, hex("#4E5A73"));
    r.text("TICKET", small, TX, capTop("small", 2), JIRA_LIGHT);
    r.text("NOT FOUND", small, TX, capTop("small", 9), WHITE);
  });

  // Before it settles and as it goes, the whole picture flickers in and out through heavy glitching; while it holds,
  // a light glitch now and then. Over all of it, the screen tears.
  const heavy = glitch(still, { intensity: 9, every: 0.1, burst: 0.09, seed: 5 });
  const light = glitch(still, { intensity: 3, every: 0.9, burst: 0.14, seed: 8 });
  const flickering = clip(D, (r, t) => {
    if (t >= IN && t < IN + HOLD) return light.draw(r, t - IN);
    const level = t < IN ? flickerLevel(t, FLICKER_IN) : flickerLevel(t - IN - HOLD, FLICKER_OUT);
    if (level <= 0) return;
    const l = new Raster(W, H);
    heavy.draw(l, t);
    r.draw(l, 0, 0, level);
  });
  const torn = tear(flickering, { amount: (t) => (t < IN ? (1 - t / IN) * 10 : t > IN + HOLD ? span(t, IN + HOLD, D) * 18 : 0) });

  // Over the clock: torn rows of black and streaks of colour, until the screen is black. Nothing on the first frame.
  const noise = clip(NOISE, (r, t) => {
    const p = t / NOISE;
    const rand = rng(17_000 + Math.floor(t * 30));
    for (let y = 0; y < H; y++) {
      if (chance(101 + y) < p * 1.3) {
        const gap = Math.max(0, Math.round((1 - p) * rand() * 40));
        r.fillRect(rand() < 0.5 ? 0 : gap, y, W - gap, 1, BLACK);
      }
      if (rand() < 0.18 * (1 - p * 0.5) * Math.min(1, p * 8)) {
        const x = Math.floor(rand() * W);
        r.fillRect(x, y, 4 + Math.floor(rand() * 20), 1, { ...(rand() < 0.5 ? hex("#62C7FF") : hex("#FF4D9A")), a: 0.7 });
      }
    }
    if (p > 0.85) r.fillRect(0, 0, W, H, { ...BLACK, a: span(p, 0.85, 1) });
  });

  const body = layer(
    clip(D, (r) => r.fillRect(0, 0, W, H, BLACK)),
    shake(torn, { from: IN, to: IN + 0.45, amplitude: 3 }),
  );
  return seq(noise, body, fade({ duration: MOTION.base, from: 1, to: 0 }));
}
