// Little train: an engine chugs in from the far side pulling flatcars, one letter of the name on each, clickety-clack;
// it stops with the name in the middle, lets off steam, and chugs away their way.
//
// The engine leads, so the cars run in reading order behind it: for someone on the left the train is mirrored and the
// cars are listed back to front. The letters ride on a common baseline (caps on rows 1..10, a clear row above the
// decks on 12..13), and the steam stays over the engine, fading before it could drift over a letter.

import {
  ENGINE_SIZE,
  MOTION,
  capTop,
  clip,
  drawCoupling,
  drawEngine,
  drawFlatcar,
  drawPuff,
  drawRails,
  fade,
  hex,
  inQuad,
  lerp,
  mirrorX,
  outQuad,
  seq,
  span,
  wipe,
  type Clip,
} from "@vladzaharia/bar-pixel";
import type { Redirect } from "../../../src/presets.ts";
import { AMBER } from "../look.ts";
import { BIG, BLACK, H, W, big } from "./kit.ts";

/** The letters' caps sit on rows 1..10, the decks on 12..13, the wheels on 14 and the rail on 15. */
const LETTER_Y = capTop(BIG, 1);
const DECK_Y = 12;
const ORANGE = hex("#FF7A33");
/** The share of its average speed the train still has as it stops, and already has as it sets off. */
const CREEP = 0.6;

export function train(e: Redirect): Clip {
  const f = big();
  const letters = e.dir > 0 ? [...e.name] : [...e.name].reverse();
  // Each letter's ink: where it starts in its glyph box, and how wide.
  const ink = letters.map((ch) => {
    const g = f.glyph(ch.codePointAt(0)!)!;
    let x0 = g.width;
    let x1 = -1;
    for (let y = 0; y < g.height; y++) for (let x = 0; x < g.width; x++) if (g.bits[y * g.width + x]) [x0, x1] = [Math.min(x0, x), Math.max(x1, x)];
    return { offset: g.x + x0, width: x1 - x0 + 1 };
  });
  const EW = ENGINE_SIZE.width;
  // A pixel of deck either side of each letter if the whole train fits with them, else none.
  const roomy = ink.reduce((a, k) => a + k.width + 3, 0) + EW <= W - 4;
  const pad = roomy ? 1 : 0;
  const deck = ink.map((k) => k.width + 2 * pad + (roomy ? 0 : 1));
  const carX: number[] = [];
  let u = 0;
  for (const d of deck) {
    carX.push(u);
    u += d + 1;
  }
  const engineX = u;
  const L = engineX + EW;
  const X0 = Math.round((W - L) / 2);
  const ARRIVE = 2.4;
  const HOLD = 1.9;
  const DEPART = 1.8;
  const total = ARRIVE + HOLD + DEPART;
  // It brakes as it comes in, but stops from a walking pace rather than creeping its last pixels, and pulls away the
  // same way: part steady speed, part easing.
  const brake = (u: number) => lerp(u, outQuad(u), 1 - CREEP);
  const pull = (u: number) => lerp(u, inQuad(u), 1 - CREEP);
  /** The train's back end in the rightward layout. */
  const trainX = (t: number) => {
    if (t < ARRIVE) return lerp(-L - 1, X0, brake(t / ARRIVE));
    if (t < ARRIVE + HOLD) return X0;
    return lerp(X0, W + 2, pull((t - ARRIVE - HOLD) / DEPART));
  };
  const speed = (t: number) => Math.abs(trainX(t + 0.01) - trainX(t - 0.01)) / 0.02;
  // Puffs of steam off the chimney (rightward x 10.5 into the engine): one every so often while it moves, two big ones
  // when it stops. Each is left behind where it was let off.
  const puffs: { t: number; x: number; big: boolean }[] = [];
  for (let t = 0; t < total; t += 0.16) if (speed(t) > 6) puffs.push({ t, x: trainX(t) + engineX + 10.5, big: false });
  for (const dt of [0.25, 0.4]) puffs.push({ t: ARRIVE + dt, x: X0 + engineX + 10.5, big: true });
  /** Rightward x to the screen, for something `w` wide. */
  const sx = (x: number, w: number) => mirrorX(x, w, e.dir);

  const scene = clip(total, (r, t) => {
    r.fillRect(0, 0, W, H, BLACK);
    const X = trainX(t);
    const moving = speed(t) > 1;
    drawRails(r, 15);
    // Clickety-clack: the cars dip together as their wheels cross a rail joint, the letters with them.
    const dip = moving && (((Math.round(X) + 3) % 12) + 12) % 12 < 2 ? 1 : 0;
    letters.forEach((ch, i) => {
      const x = Math.round(X + carX[i]!);
      const d = deck[i]!;
      drawFlatcar(r, sx(x, d), DECK_Y + dip, d, X);
      if (i > 0) drawCoupling(r, sx(x - 1, 1), DECK_Y + 1 + dip);
      // The letter's ink centred on its deck.
      const left = x + Math.floor((d - ink[i]!.width) / 2);
      r.text(ch, f, sx(left, ink[i]!.width) - ink[i]!.offset, LETTER_Y + dip, AMBER);
    });
    const ex = Math.round(X + engineX);
    drawEngine(r, sx(ex, EW), 0, e.dir, X);
    // Steam: rising off the chimney and drifting back; it thins out before it reaches the engine's back.
    for (const p of puffs) {
      const life = p.big ? 1.4 : 1.0;
      const age = (t - p.t) / life;
      if (age < 0 || age > 1) continue;
      const px = p.x - (t - p.t) * (p.big ? 4 : 6);
      const rad = (p.big ? 2.2 : 1.5) + age * (p.big ? 1.6 : 1.2);
      const keep = span(px - rad, ex - 1, ex + 3);
      if (keep <= 0) continue;
      drawPuff(r, e.dir > 0 ? px : W - px, 0.6 - age * 1.4, age, p.big, keep);
    }
  });
  return seq(fade({ from: 0, to: 1, duration: MOTION.base }), scene, wipe({ mode: "reveal", direction: e.dir, color: BLACK, edge: ORANGE, duration: MOTION.base }));
}
