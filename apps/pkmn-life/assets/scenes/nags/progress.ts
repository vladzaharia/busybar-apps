// Front nag "Stuck progress bar": "Filing ticket..." with a spinner and a bar that jumps ahead in smaller and smaller
// chunks to 99% and stalls. The spinner winds down and its dots drop onto the bar, which turns amber; then it all rolls
// away for "...you didn't, / did you?". The clock dims out at the start and back in at the end.

import {
  MOTION,
  Raster,
  capTop,
  clip,
  drawBar,
  fade,
  font,
  hex,
  inOutCubic,
  inQuad,
  inkWidth,
  layer,
  lerp,
  mix,
  outCubic,
  readTime,
  seq,
  span,
  spinner,
  type Clip,
} from "@vladzaharia/bar-pixel";
import type { Nag } from "../../../src/presets.ts";
import { AMBER, BLACK, JIRA, WHITE, asking, closeWith } from "../look.ts";

const W = 72;
const H = 16;
/** The spinner's centre is level with the middle of the caps beside it (rows 1 to 5). */
const SPIN = { x: 5, y: 3, radius: 3 };
const DOTS = 8;
const TX = 11;
const TEXT_CAP = 1;
/** The percentage is in the normal font (the small font's % reads as an X), right-aligned on its ink 2 px in. */
const PCT_RIGHT = W - 2;
const PCT_X = PCT_RIGHT - inkWidth("99%", font("normal"));
const BAR = { x: 2, y: 9, width: PCT_X - 5, height: 5 };
/** The percentage's caps (rows 8 to 14) are centred on the bar (rows 9 to 13). */
const PCT_CAP = 8;
// Progress jumps in chunks, slower and smaller each time, and stops one short.
const STEPS: [number, number][] = [
  [0.3, 0.21],
  [0.6, 0.4],
  [0.85, 0.55],
  [1.15, 0.68],
  [1.45, 0.8],
  [1.75, 0.88],
  [2.1, 0.94],
  [2.45, 0.97],
  [2.8, 0.98],
  [3.2, 0.99],
];
const PUNCH = ["...you didn't,", "did you?"];
/** Rounded away from zero, as the spinner places its dots, so the dots it drops start where they were. */
const off = (v: number) => Math.sign(v) * Math.round(Math.abs(v));

export function progress(_e: Nag): Clip {
  const small = font("small");
  const normal = font("normal");
  const STALL = 3.2;
  const SLOW = 0.7;
  const DROP = 0.5;
  const PUNCH_AT = STALL + SLOW + DROP + 0.4;
  const ROLL = 0.26;
  const D = PUNCH_AT + ROLL + readTime(PUNCH.join(" ")) + MOTION.rest;
  const spin = spinner({ duration: D, ...SPIN, dots: DOTS, color: WHITE });

  const value = (t: number) => {
    let v = 0;
    for (const [i, [at, to]] of STEPS.entries()) {
      const from = i ? STEPS[i - 1]![1] : 0;
      if (t >= at) v = lerp(from, to, outCubic(span(t, at, at + 0.14)));
    }
    return v;
  };
  // The spinner's own clock: it runs at full speed, winds down and stops.
  const phase = (t: number) => {
    if (t < STALL) return t;
    const u = Math.min(SLOW, t - STALL);
    return STALL + u - (u * u) / (2 * SLOW);
  };

  const scene = (r: Raster, t: number) => {
    const dots = t < STALL ? 1 + (Math.floor(t / 0.3) % 3) : 3;
    r.text("Filing ticket" + ".".repeat(dots), small, TX, capTop("small", TEXT_CAP), WHITE);
    if (t < STALL + SLOW) spin.draw(r, phase(t));
    else {
      // Given up: its dots drop onto the bar one after another, the faintest first.
      const head = (phase(t) / MOTION.spin) * DOTS;
      for (let i = 0; i < DOTS; i++) {
        const ang = (i / DOTS) * Math.PI * 2 - Math.PI / 2;
        const age = (((head - i) % DOTS) + DOTS) % DOTS;
        const x = SPIN.x + off(Math.cos(ang) * SPIN.radius);
        const y0 = SPIN.y + off(Math.sin(ang) * SPIN.radius);
        const at = STALL + SLOW + (7 - Math.round(age)) * 0.05;
        const fall = inQuad(span(t, at, at + 0.28));
        const bounce = Math.sin(span(t, at + 0.28, at + 0.42) * Math.PI);
        const y = Math.round(lerp(y0, BAR.y - 1, fall) - bounce);
        r.blend(x, y, WHITE, Math.max(0.35, 1 - age / DOTS));
      }
    }
    const v = value(t);
    const stuck = span(t, STALL + SLOW, STALL + SLOW + 0.12);
    drawBar(r, { ...BAR, value: v, track: hex("#2A303B"), fill: mix(JIRA, AMBER, stuck) });
    const pct = `${Math.round(v * 100)}%`;
    r.text(pct, normal, PCT_RIGHT - inkWidth(pct, normal), capTop("normal", PCT_CAP), mix(WHITE, AMBER, stuck));
  };

  const body = clip(D, (r, t) => {
    r.fillRect(0, 0, W, H, BLACK);
    // The whole picture rolls up and away as the punchline rolls in under it.
    const p = inOutCubic(span(t, PUNCH_AT, PUNCH_AT + ROLL));
    if (p < 1) {
      const l = new Raster(W, H);
      scene(l, t);
      r.draw(l, 0, -Math.round(p * H));
    }
    if (p > 0) {
      const dy = Math.round((1 - p) * H);
      const color = asking(WHITE);
      PUNCH.forEach((line, li) =>
        r.text(line, small, Math.round((W - inkWidth(line, small)) / 2), capTop("small", li ? 9 : 2) + dy, WHITE, (gi, ch) => ({ color: color(gi, ch, t) })),
      );
    }
  });

  // The clock dims to black and the screen fades up from it; at the end, the reverse.
  const dim = () => fade({ duration: MOTION.base, from: 0, to: 1 });
  const unveil = (duration: number) => fade({ duration, from: 1, to: 0 });
  return seq(dim(), closeWith(layer(body, unveil(MOTION.quick)), dim()), unveil(MOTION.base));
}
