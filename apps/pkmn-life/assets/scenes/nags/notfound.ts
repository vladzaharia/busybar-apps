// Front nag "404": the clock tears into black. "404 | TICKET NOT FOUND" flickers in through heavy glitching, slams
// into place with a shake, glitches now and then while it holds, and tears apart on the way out; the black then fades
// off the clock.

import {
  MOTION,
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
  const flicker = (t: number, keep: number) => chance(31_000 + Math.floor(t * 30)) < keep;
  const flickering = clip(D, (r, t) => {
    if (t < IN) {
      if (flicker(t, 0.25 + (t / IN) * 0.75)) heavy.draw(r, t);
    } else if (t < IN + HOLD) light.draw(r, t - IN);
    else {
      const p = span(t, IN + HOLD, D);
      if (p < 0.85 && flicker(t, 1 - p * 0.8)) heavy.draw(r, t);
    }
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
