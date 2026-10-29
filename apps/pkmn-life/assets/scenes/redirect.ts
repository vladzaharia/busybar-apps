// Front redirects: "go see ALEX" (someone to the right) or "go see SAM" (to the left), in six looks. Each plays over
// the live clock: its opening covers the clock (a wipe, an arrow's sweep, a sign sliding over, a fade, stripes, the
// band's front) and its ending uncovers it again, so the clip is transparent at both ends.
//
// Directions are as someone facing the front display sees them; every look mirrors for the other side.

import {
  DIALOGUE_LIGHT,
  MOTION,
  Raster,
  arrowNudge,
  capCentre,
  chase,
  chevronChase,
  chevronWidth,
  clip,
  drawArrow,
  drawChevron,
  drawDialogue,
  drawSmallArrow,
  drawTriangle,
  drawWalker,
  dropIn,
  fade,
  font,
  hex,
  holdEnd,
  inBack,
  inCubic,
  inOutCubic,
  layer,
  lerp,
  mix,
  outBack,
  outCubic,
  scrollBand,
  seq,
  span,
  speechBubble,
  stripes,
  textWidth,
  walkFrame,
  wipe,
  type Clip,
  type WalkerPose,
} from "@vladzaharia/bar-pixel";
import type { Redirect, RedirectStyle } from "../../src/presets.ts";

const W = 72;
const H = 16;
const BLACK = hex("#000000");
const WHITE = hex("#FFFFFF");
const BIG = "extra_large" as const;
const BIG_Y = capCentre(BIG);
const HOLD = 4.4;

/** x for something `w` wide at `x` in the rightward layout, mirrored for a leftward one. */
const mx = (e: Redirect, x: number, w: number) => (e.dir > 0 ? x : W - x - w);
const nameW = (e: Redirect) => textWidth(e.name, font(BIG));
const black = (duration: number): Clip => clip(duration, (r) => r.fillRect(0, 0, W, H, BLACK));

/** Runway: an amber wipe towards them, then chevrons chasing their way with the name opposite. */
function runway(e: Redirect): Clip {
  const AMBER = hex("#FFB020");
  const cw = chevronWidth(11);
  const count = 4;
  const gap = 7;
  const rowW = (count - 1) * gap + cw;
  const main = layer(
    black(HOLD),
    chevronChase({ duration: HOLD, x: mx(e, W - 3 - rowW, rowW), y: 2, dir: e.dir, count, gap, lit: AMBER }),
    clip(HOLD, (r, t) => r.glow(e.dir > 0 ? W - 0.5 : -0.5, 7.5, 3, 9, { ...AMBER, a: 0.25 * (0.6 + 0.4 * Math.sin(t * 8)) }, 1.6)),
    { clip: dropIn({ text: e.name, font: BIG, x: mx(e, 3, nameW(e)), y: BIG_Y, duration: HOLD - 0.15 }), at: 0.15 },
  );
  return seq(
    holdEnd(wipe({ mode: "cover", direction: e.dir, color: BLACK, edge: AMBER, duration: MOTION.base }), 0.02),
    main,
    wipe({ mode: "reveal", direction: e.dir, color: BLACK, edge: AMBER, duration: MOTION.base }),
  );
}

/** Nudge: a big arrow sweeps across, blacking out the clock behind it, settles pointing at them and keeps nudging. */
function nudge(e: Redirect): Clip {
  const BLUE = hex("#2F86FF");
  const LIGHT = hex("#9CC6FF");
  const IN = 0.55;
  const OUT = MOTION.base;
  const restX = mx(e, W - 16, 13);
  const startX = e.dir > 0 ? -14 : W + 1;
  const name = dropIn({ text: e.name, font: BIG, x: mx(e, 4, nameW(e)), y: BIG_Y, duration: HOLD + IN });
  const sweep = clip(IN, (r, t) => {
    const x = lerp(startX, restX, outBack(t / IN, 1.4));
    const head = e.dir > 0 ? x + 13 : x;
    // Everything the arrow has passed is black.
    if (e.dir > 0) r.fillRect(0, 0, Math.max(0, Math.ceil(head)), H, BLACK);
    else r.fillRect(Math.floor(head), 0, W - Math.floor(head), H, BLACK);
    for (let k = 1; k <= 3; k++) r.fillRect(Math.round(x) - e.dir * k * 3 + (e.dir > 0 ? 0 : 12), 6, 2, 1, { ...BLUE, a: 0.5 - k * 0.14 });
    drawArrow(r, Math.round(x), 1, e.dir, BLUE, LIGHT);
    if (t > 0.3) name.draw(r, t - 0.3);
  });
  const hold = layer(black(HOLD), arrowNudge({ duration: HOLD, x: restX, y: 1, dir: e.dir, body: BLUE, light: LIGHT }), {
    clip: clip(HOLD, (r, t) => name.draw(r, t + IN - 0.3)),
    at: 0,
  });
  const away = clip(OUT, (r, t) => {
    r.fillRect(0, 0, W, H, BLACK);
    const k = inBack(t / OUT, 1.2) * (W + 14) * e.dir;
    drawArrow(r, Math.round(restX + k), 1, e.dir, BLUE, LIGHT);
    const s = new Raster(W, H);
    name.draw(s, HOLD + IN);
    r.draw(s, Math.round(k), 0);
  });
  return seq(sweep, hold, away, wipe({ mode: "reveal", direction: e.dir, color: BLACK, edge: BLUE, duration: MOTION.quick }));
}

/** Wayfinding sign: an airport-style yellow sign slides in from their side over the clock, then back out. */
function sign(e: Redirect): Clip {
  const Y1 = hex("#FFD21F");
  const Y2 = hex("#F2B600");
  const EDGE = hex("#7A5A00");
  const INK = hex("#111111");
  const IN = MOTION.slow;
  const OUT = MOTION.base;
  const BOX = 14;
  const drawSign = (r: Raster, off: number, t: number) => {
    const s = new Raster(W, H);
    const period = 2.2;
    const sheen = t > 0 ? ((t % period) / period) * (W + 50) - 25 : -99;
    s.roundRect(0, 0, W, H, 2, (x, y, _u, v) => {
      const border = x === 0 || x === W - 1 || y === 0 || y === H - 1;
      let c = border ? EDGE : mix(Y1, Y2, v);
      const d = Math.abs(x + y * 0.9 - sheen);
      if (!border && d < 5) c = mix(c, WHITE, 0.45 * (1 - d / 5));
      return c;
    });
    const bx = mx(e, W - 1 - BOX, BOX);
    s.fillRect(bx, 1, BOX, BOX, INK);
    const nudge = t > 0 && t % 1.1 < 0.35 ? Math.round(Math.sin(((t % 1.1) / 0.35) * Math.PI)) : 0;
    drawSmallArrow(s, bx + 2 + e.dir * nudge, 4, e.dir, Y1);
    const space = W - BOX - 2;
    s.text(e.name, font(BIG), (e.dir > 0 ? 1 : BOX + 1) + Math.round((space - nameW(e)) / 2), BIG_Y, INK);
    r.draw(s, Math.round(off), 0);
  };
  return seq(
    clip(IN, (r, t) => drawSign(r, e.dir * W * (1 - outBack(t / IN, 1.1)), -1)),
    clip(HOLD, (r, t) => drawSign(r, 0, t)),
    clip(OUT, (r, t) => drawSign(r, e.dir * W * inCubic(t / OUT), HOLD + t)),
  );
}

/**
 * Walker: the clock fades, a little person walks in from the far side leaving the name behind them letter by letter,
 * waves and says "HI!" in a speech bubble, points the way with arrows blinking from their hand, then walks off
 * towards them.
 */
function walker(e: Redirect): Clip {
  const CH = hex("#62C7FF");
  const FADE = MOTION.base;
  const WALK_IN = 1.3;
  const POINT = 1.9;
  const WALK_OUT = 1.7;
  const standX = mx(e, 40, 7);
  // Beside their head on the side they face, its tail slanting back to them; gone before the arrows take that space.
  const hello = speechBubble({ x: e.dir > 0 ? standX + 9 : standX - 3, top: 0, dir: e.dir, text: "HI!" });
  const WAVE = Math.max(0.7, hello.duration);
  const tWave = WALK_IN;
  const tPoint = tWave + WAVE;
  const tOut = tPoint + POINT;
  const total = tOut + WALK_OUT;
  const enterX = e.dir > 0 ? -8 : W + 1;
  const SPEED = 24;
  const walkX = (t: number) => lerp(enterX, standX, inOutCubic(span(t, 0, tWave)) * 0.3 + span(t, 0, tWave) * 0.7);
  const f = font(BIG);
  const nx = mx(e, 3, nameW(e));
  const letterX: number[] = [];
  let pen = nx;
  for (const ch of e.name) {
    letterX.push(pen);
    pen += f.glyph(ch.codePointAt(0)!)!.advance;
  }
  // Each letter appears once the walker has passed it.
  const letterAt = letterX.map((lx, i) => {
    const adv = (letterX[i + 1] ?? pen) - lx;
    for (let t = 0; t < tWave; t += 1 / 240) {
      const wx = walkX(t);
      if (e.dir > 0 ? wx > lx + adv : wx + 7 < lx) return t;
    }
    return tWave;
  });
  const scene = clip(total, (r, t) => {
    r.fillRect(0, 0, W, H, BLACK);
    let x: number;
    let pose: WalkerPose;
    if (t < tWave) [x, pose] = [walkX(t), walkFrame(t)];
    else if (t < tPoint) [x, pose] = [standX, "wave"];
    else if (t < tOut) [x, pose] = [standX, "point"];
    else [x, pose] = [standX + Math.min(Math.abs((e.dir > 0 ? W + 1 : -8) - standX), (t - tOut) * SPEED) * e.dir, walkFrame(t - tOut)];
    if (t >= tPoint) {
      for (let k = 0; k < 3; k++) drawChevron(r, mx(e, 50 + k * 6, chevronWidth(7)), 4, 7, e.dir, mix(hex("#0B2A40"), CH, chase(t - tPoint, k, { period: 0.9, step: 0.15, decay: 0.22 })));
    }
    if (t >= tWave && t < tPoint) hello.draw(r, t - tWave);
    drawWalker(r, x, 1, e.dir, pose, WHITE, t);
    r.text(e.name, f, nx, BIG_Y, WHITE, (i) => {
      const q = span(t, letterAt[i]!, letterAt[i]! + 0.3);
      return { dy: Math.round(lerp(4, 0, outBack(q, 2.4))), hidden: q <= 0, alpha: Math.min(1, q * 3) };
    });
  });
  const fadeOut = clip(FADE, (r, t) => {
    const s = new Raster(W, H);
    scene.draw(s, total);
    r.fillRect(0, 0, W, H, BLACK).draw(s, 0, 0, 1 - t / FADE);
  });
  return seq(fade({ from: 0, to: 1, duration: FADE }), scene, fadeOut, fade({ from: 1, to: 0, duration: 0.35 }));
}

/**
 * Trainer: Pkmn Life's battle stripes, "TRAINER ALEX can help you!", then "Go see ALEX!" with ▶ marching their way.
 */
function trainer(e: Redirect): Clip {
  const CPS = MOTION.typeSpeed;
  const page1 = [`TRAINER ${e.name}`, "can help you!"];
  const page2 = [`Go see ${e.name}!`];
  const len1 = page1.join("").length / CPS;
  const len2 = page2.join("").length / CPS;
  const P1 = len1 + 1.2;
  const P2 = len2 + 2.6;
  const talk = clip(P1 + P2, (r, t) => {
    if (t < P1) return drawDialogue(r, { lines: page1, typed: Math.floor(t * CPS), t });
    drawDialogue(r, { lines: page2, typed: Math.floor((t - P1) * CPS), t: 0.5 });
    const tt = t - P1 - len2;
    if (tt > 0) for (let k = 0; k < 6; k++) drawTriangle(r, mx(e, 6 + k * 10, 4), 8, e.dir, DIALOGUE_LIGHT.arrow, chase(tt, k, { period: 0.8, step: 0.1, decay: 0.18, floor: 0.18 }));
  });
  const toBlack = clip(0.3, (r, t) => {
    talk.draw(r, talk.duration);
    fade({ duration: 0.3, from: 0, to: 1 }).draw(r, t);
  });
  return seq(holdEnd(stripes({ mode: "cover" }), 0.02), talk, toBlack, fade({ duration: 0.35, from: 1, to: 0 }));
}

/**
 * Scroller: chevron groups and the name stream towards them like a moving-walkway sign. The band's front wipes the
 * clock away as it arrives; at the end it speeds off and the clock is uncovered in the same direction.
 */
function scroller(e: Redirect): Clip {
  const V = 30;
  const OUT = 0.6;
  const total = HOLD + 0.6 + OUT;
  const outAt = HOLD + 0.6;
  const lead = (t: number) => t * V + (t > outAt ? Math.pow((t - outAt) / OUT, 2) * 160 : 0);
  const band = scrollBand({ duration: total, text: e.name, dir: e.dir, lead, alpha: (t) => 1 - span(t, outAt + OUT * 0.6, total) });
  const scene = clip(total, (r, t) => {
    const d = Math.ceil(lead(t));
    // Behind the band's front, the clock is covered.
    if (e.dir > 0) r.fillRect(0, 0, Math.min(W, d), H, BLACK);
    else r.fillRect(Math.max(0, W - d), 0, W, H, BLACK);
    band.draw(r, t);
  });
  return seq(scene, wipe({ mode: "reveal", direction: e.dir, color: BLACK, edge: hex("#2F86FF"), duration: MOTION.quick }));
}

export const REDIRECT_SCENES: Record<RedirectStyle, (e: Redirect) => Clip> = { runway, nudge, sign, walker, trainer, scroller };
