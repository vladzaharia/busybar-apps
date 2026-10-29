// Front nag "Ticket invaders": the clock switches off onto a slow starfield, where a row of little Jira-card invaders
// marches in. A cannon slides under each and files it (a zap, sparks, a green check). As the last one goes, a fresh
// wave marches in and "FILE THEM ALL!" types in, arcade-style. The picture fades out and dissolves onto the clock.

import {
  CANNON_SIZE,
  INVADER_SIZE,
  MOTION,
  capTop,
  clip,
  crt,
  dissolve,
  drawCannon,
  drawInvader,
  drawSparks,
  fade,
  font,
  hex,
  inCubic,
  inOutCubic,
  inkWidth,
  invaderFrame,
  layer,
  lerp,
  outCubic,
  readTime,
  seq,
  span,
  stampPalette,
  starfield,
  type Clip,
} from "@vladzaharia/bar-pixel";
import type { Nag } from "../../../src/presets.ts";
import { AMBER, BLACK, JIRA_LIGHT, WHITE } from "../look.ts";

const W = 72;
const H = 16;
const CYAN = hex("#62C7FF");
const ORANGE = hex("#FF7A33");
const GREEN = hex("#3DDC84");
const CHECK = ["....#", "...#.", "#.#..", ".#..."];
/** Five invaders, 12 px apart, marching side to side about the centre. */
const N = 5;
const SPACING = 12;
const STEP = 0.22;
const MARCH = [0, 2, 4, 6, 4, 2, 0, -2, -4, -6, -4, -2];
const FORMATION_X = Math.round((W - ((N - 1) * SPACING + INVADER_SIZE.width)) / 2);
const LINE = "FILE THEM ALL!";
/** Letters typed per second, as an arcade's attract screen does. */
const TYPE_CPS = 20;

export function invaders(_e: Nag): Clip {
  const CANNON_AT = 0.45;
  // The cannon files all five, one after another...
  const shots = [
    { at: 1.0, target: 1 },
    { at: 1.5, target: 3 },
    { at: 2.0, target: 0 },
    { at: 2.5, target: 4 },
    { at: 2.95, target: 2 },
  ];
  const BULLET = 0.14;
  // ...then sinks away as the next wave marches in, and the line types in under it.
  const WAVES = [0.15, 3.45];
  const SINK = 3.25;
  const TEXT_AT = 3.75;
  const END = TEXT_AT + LINE.length / TYPE_CPS + readTime(LINE) + 0.9;
  const FADE = 0.35;

  const formationX = (t: number) => FORMATION_X + MARCH[Math.floor(t / STEP) % MARCH.length]!;
  // A wave steps down into place from above the screen, a row at a time.
  const formationY = (t: number, at: number) => Math.min(1, -7 + Math.floor(span(t, at, at + 0.6) * 8));
  const invaderX = (k: number, t: number) => formationX(t) + k * SPACING;
  const muzzle = Math.floor(CANNON_SIZE.width / 2);
  const cannonX = (t: number) => {
    // Glides in, then to under each target just before firing at it.
    let x = lerp(-8, 30, outCubic(span(t, CANNON_AT, CANNON_AT + 0.4)));
    for (const s of shots) {
      const aim = invaderX(s.target, s.at) + INVADER_SIZE.width / 2 - muzzle;
      x = lerp(x, aim, inOutCubic(span(t, s.at - 0.3, s.at - 0.04)));
    }
    return Math.round(x);
  };

  const game = clip(END, (r, t) => {
    const frame = invaderFrame(t, STEP);
    WAVES.forEach((at, w) => {
      if (t < at) return;
      const fy = formationY(t, at);
      for (let k = 0; k < N; k++) {
        const x = invaderX(k, t);
        const shot = w === 0 ? shots.find((s) => s.target === k) : undefined;
        const hit = shot ? shot.at + BULLET : Infinity;
        if (t < hit) {
          drawInvader(r, x, fy, frame);
          continue;
        }
        // Filed: a flash, sparks, and a green check that floats up and fades.
        const p = span(t, hit, hit + 0.35);
        const cx = x + INVADER_SIZE.width / 2;
        drawSparks(r, cx, fy + 3, p, { color: AMBER, reach: 6 });
        if (p < 0.25) r.glow(cx, fy + 3, 5, 4, { ...WHITE, a: 1 - p * 4 }, 1.5);
        const check = span(t, hit + 0.1, hit + 0.8);
        if (check > 0 && check < 1) stampPalette(r, CHECK, Math.round(invaderX(k, hit)) + 2, fy + 1 - Math.round(check * 2), { "#": GREEN }, 1 - inCubic(check));
      }
    });
    // The cannon, and its shots.
    const cy = H - CANNON_SIZE.height + Math.round(inCubic(span(t, SINK, SINK + 0.3)) * 5);
    drawCannon(r, cannonX(t), cy, CYAN);
    for (const s of shots) {
      const p = span(t, s.at, s.at + BULLET);
      if (p <= 0 || p >= 1) continue;
      const bx = cannonX(s.at) + muzzle;
      const by = Math.round(lerp(H - CANNON_SIZE.height - 1, formationY(s.at, WAVES[0]!) + 5, p));
      r.fillRect(bx, by, 1, 2, WHITE);
      r.glow(bx + 0.5, by + 1, 1.5, 2, { ...CYAN, a: 0.8 }, 1.5);
    }
    // The line, typed in under the new wave; ALL! blinks amber and orange once it is all there.
    if (t >= TEXT_AT) {
      const small = font("small");
      const typed = Math.floor((t - TEXT_AT) * TYPE_CPS);
      const blink = t > TEXT_AT + LINE.length / TYPE_CPS + 0.4 && Math.floor(t * 4) % 2 === 1;
      let n = 0;
      r.text(LINE, small, Math.round((W - inkWidth(LINE, small)) / 2), capTop("small", 9), CYAN, () => ({
        hidden: n >= typed,
        color: n++ >= 10 ? (blink ? ORANGE : AMBER) : undefined,
      }));
    }
  });

  const body = layer(
    clip(END, (r) => r.fillRect(0, 0, W, H, BLACK)),
    starfield({ duration: END, speed: 0.1, stars: 45, color: { ...JIRA_LIGHT, a: 0.55 } }),
    game,
    { clip: fade({ duration: FADE, from: 0, to: 1 }), at: END - FADE },
  );
  return seq(crt({ mode: "cover", duration: MOTION.base }), body, dissolve({ mode: "reveal" }));
}
