// Front redirects: "go see ALEX" (someone to the right) or "go see SAM" (to the left). This file holds the six original
// looks (runway, nudge, sign, walker, trainer, scroller); the other nine are in scenes/redirects/. Each plays over the
// live clock: its opening covers the clock (a wipe, an arrow's sweep, a sign sliding over, a fade, stripes, the
// band's front) and its ending uncovers it again, so the clip is transparent at both ends.
//
// Directions are as someone facing the front display sees them; every look mirrors for the other side.

import {
  ARROW_SIZE,
  DIALOGUE_LIGHT,
  MOTION,
  NAME_EDGE,
  Raster,
  WALKER_SIZE,
  arrowNudge,
  capCentre,
  chase,
  chevronChase,
  chevronWidth,
  clip,
  dialogueRise,
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
  inkWidth,
  layer,
  lerp,
  mirrorX,
  mix,
  outBack,
  outCubic,
  readTime,
  scrollBand,
  scrollBandCentreLead,
  seq,
  span,
  speechBubble,
  stripes,
  walkFrame,
  wipe,
  wipeOut,
  type Clip,
  type WalkerPose,
} from "@vladzaharia/bar-pixel";
import type { Redirect } from "../../src/presets.ts";

const W = 72;
const H = 16;
const BLACK = hex("#000000");
const WHITE = hex("#FFFFFF");
const BIG = "extra_large" as const;
const BIG_Y = capCentre(BIG);
const HOLD = 4.4;

/** The name's ink width in the big font: what a layout is built from (never its advance width, a pixel wider). */
const nameInk = (e: Redirect) => inkWidth(e.name, font(BIG));
const black = (duration: number): Clip => clip(duration, (r) => r.fillRect(0, 0, W, H, BLACK));

/**
 * Runway: an amber wipe towards them, then chevrons chasing their way with the name opposite. The row is laid out from
 * the name: as many chevrons (2 to 4) as fit between 2 px past the name's ink and NAME_EDGE from the far edge, so a wide
 * name never has a chevron through its last letter. At the end the same wipe takes the whole picture away.
 */
export function runway(e: Redirect): Clip {
  const AMBER = hex("#FFB020");
  const inkW = nameInk(e);
  const cw = chevronWidth(11);
  const gap = 7;
  const rowW = (n: number) => (n - 1) * gap + cw;
  const start = (n: number) => W - NAME_EDGE - rowW(n);
  let count = 4;
  while (count > 2 && start(count) < NAME_EDGE + inkW + 2) count--;
  const main = layer(
    black(HOLD),
    chevronChase({ duration: HOLD, x: mirrorX(start(count), rowW(count), e.dir), y: 2, dir: e.dir, count, gap, lit: AMBER }),
    clip(HOLD, (r, t) => r.glow(e.dir > 0 ? W - 0.5 : -0.5, 7.5, 3, 9, { ...AMBER, a: 0.25 * (0.6 + 0.4 * Math.sin(t * 8)) }, 1.6)),
    { clip: dropIn({ text: e.name, font: BIG, x: mirrorX(NAME_EDGE, inkW, e.dir), y: BIG_Y, duration: HOLD - 0.15 }), at: 0.15 },
  );
  return seq(
    holdEnd(wipe({ mode: "cover", direction: e.dir, color: BLACK, edge: AMBER, duration: MOTION.base }), 0.02),
    main,
    wipeOut(main, { direction: e.dir, edge: AMBER, duration: MOTION.base }),
  );
}

/**
 * Nudge: a big arrow sweeps across, blacking out the clock behind it, settles pointing at them and keeps nudging. The
 * nudge's streak shortens, a dash at a time, before it would come within 2 px of the name's ink.
 */
export function nudge(e: Redirect): Clip {
  const BLUE = hex("#2F86FF");
  const LIGHT = hex("#9CC6FF");
  const IN = 0.55;
  const OUT = MOTION.base;
  const inkW = nameInk(e);
  const restR = W - NAME_EDGE - ARROW_SIZE;
  const restX = mirrorX(restR, ARROW_SIZE, e.dir);
  /** Screen left past the arrow when it rests. */
  const BEYOND = W - restR - ARROW_SIZE;
  const startX = e.dir > 0 ? -ARROW_SIZE - 1 : W + 1;
  // While it nudges the arrow is at least 2 px out (restR + 2), and dash k trails it by 3 k px.
  let streak = 3;
  while (streak > 0 && restR + 2 - 3 * streak < NAME_EDGE + inkW + 2) streak--;
  const name = dropIn({ text: e.name, font: BIG, x: mirrorX(NAME_EDGE, inkW, e.dir), y: BIG_Y, duration: HOLD + IN });
  const sweepX = (t: number) => lerp(startX, restX, outBack(t / IN, 1.4));
  const sweep = clip(IN, (r, t) => {
    const x = sweepX(t);
    // Everything the arrow has passed is black, and the screen beyond its rest too (its last 3 px): the overshoot must
    // not leave the clock showing there when the arrow settles back.
    const passed = e.dir > 0 ? x + ARROW_SIZE : W - x;
    const covered = Math.min(W, Math.max(0, Math.ceil(passed + BEYOND * Math.min(1, Math.max(0, passed) / ARROW_SIZE))));
    r.fillRect(e.dir > 0 ? 0 : W - covered, 0, covered, H, BLACK);
    // The streak trails it while it is moving (not as it settles), mirrored exactly about the arrow, and no dimmer than
    // 0.3 (below that an LED does not show it).
    if (Math.abs(x - sweepX(Math.max(0, t - 1 / 60))) > 1) {
      for (let k = 1; k <= 3; k++) r.fillRect(Math.round(x) - e.dir * k * 3 + (e.dir > 0 ? 0 : ARROW_SIZE - 2), 6, 2, 1, { ...BLUE, a: Math.max(0.3, 0.5 - k * 0.14) });
    }
    drawArrow(r, Math.round(x), 1, e.dir, BLUE, LIGHT);
    if (t > 0.3) name.draw(r, t - 0.3);
  });
  const hold = layer(black(HOLD), arrowNudge({ duration: HOLD, x: restX, y: 1, dir: e.dir, streak, body: BLUE, light: LIGHT }), {
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

/**
 * Wayfinding sign: an airport-style yellow sign slides in from their side over the clock, then back out. The yellow is
 * kept dark enough that a whole screen of it is not glaring.
 */
export function sign(e: Redirect): Clip {
  const Y1 = hex("#E6BA10");
  const Y2 = hex("#C99A00");
  const EDGE = hex("#7A5A00");
  const INK = hex("#111111");
  const IN = MOTION.slow;
  const OUT = MOTION.base;
  const BOX = 14;
  const inkW = nameInk(e);
  // The name's ink is centred in the room beside the arrow's box, set out for the rightward sign and mirrored from it.
  const space = W - BOX - 2;
  const nameX = mirrorX(1 + Math.round((space - inkW) / 2), inkW, e.dir);
  const drawSign = (r: Raster, off: number, t: number) => {
    const s = new Raster(W, H);
    const period = 2.2;
    const sheen = t > 0 ? ((t % period) / period) * (W + 50) - 25 : -99;
    s.roundRect(0, 0, W, H, 2, (x, y, _u, v) => {
      const border = x === 0 || x === W - 1 || y === 0 || y === H - 1;
      let c = border ? EDGE : mix(Y1, Y2, v);
      // The sheen runs towards them, whichever side that is.
      const d = Math.abs((e.dir > 0 ? x : W - 1 - x) + y * 0.9 - sheen);
      if (!border && d < 5) c = mix(c, WHITE, 0.45 * (1 - d / 5));
      return c;
    });
    const bx = mirrorX(W - 1 - BOX, BOX, e.dir);
    s.fillRect(bx, 1, BOX, BOX, INK);
    const nudge = t > 0 && t % 1.1 < 0.35 ? Math.round(Math.sin(((t % 1.1) / 0.35) * Math.PI)) : 0;
    drawSmallArrow(s, bx + 2 + e.dir * nudge, 4, e.dir, Y1);
    s.text(e.name, font(BIG), nameX, BIG_Y, INK);
    r.draw(s, Math.round(off), 0);
  };
  // It slides in without overshooting: past its resting place the clock would show behind it.
  return seq(
    clip(IN, (r, t) => drawSign(r, e.dir * W * (1 - outCubic(t / IN)), -1)),
    clip(HOLD, (r, t) => drawSign(r, 0, t)),
    clip(OUT, (r, t) => drawSign(r, e.dir * W * inCubic(t / OUT), HOLD + t)),
  );
}

/**
 * Walker: the clock fades, a little person walks in from the far side leaving the name behind them letter by letter,
 * waves, points the way with arrows blinking from their hand, walks over to that side and says "HI!" to them in a
 * speech bubble, then steps off the edge. They stand where the name ends (40 at the least), so a wide name is never
 * stood on, and the arrows and the bubble take what room is left; a wide name's bubble says "HI", a pixel narrower.
 */
export function walker(e: Redirect): Clip {
  const CH = hex("#62C7FF");
  const FADE = MOTION.base;
  const WALK_IN = 1.3;
  const WAVE = 0.7;
  const POINT = 1.6;
  const SPEED = 24;
  const f = font(BIG);
  const inkW = nameInk(e);
  const figW = WALKER_SIZE.width;
  // Laid out for the rightward walker (the name on the left, the figure and the arrows on the right), then mirrored.
  const standR = Math.max(40, NAME_EDGE + inkW + 1);
  const standX = mirrorX(standR, figW, e.dir);
  // Where they stop to say hi: at the edge on that side. There is no room for the bubble beyond them, so it sits on
  // the inner side, between the name and them, its tail slanting back to them.
  const stopR = 64;
  const stopX = mirrorX(stopR, figW, e.dir);
  const exitX = e.dir > 0 ? W + 1 : -8;
  const greeting = inkW > 40 ? "HI" : "HI!";
  const hello = speechBubble({ x: e.dir > 0 ? stopX - 3 : stopX + 9, top: 0, dir: e.dir > 0 ? -1 : 1, text: greeting });
  const tWave = WALK_IN;
  const tPoint = tWave + WAVE;
  const tOver = tPoint + POINT;
  const tHello = tOver + Math.abs(stopX - standX) / SPEED;
  const tExit = tHello + hello.duration;
  const total = tExit + Math.abs(exitX - stopX) / SPEED;
  const enterX = e.dir > 0 ? -8 : W + 1;
  const walkX = (t: number) => lerp(enterX, standX, inOutCubic(span(t, 0, tWave)) * 0.3 + span(t, 0, tWave) * 0.7);
  const nx = mirrorX(NAME_EDGE, inkW, e.dir);
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
      if (e.dir > 0 ? wx > lx + adv : wx + figW < lx) return t;
    }
    return tWave;
  });
  // The pointing arrows, 6 px apart from 10 px past where they stand, as many as fit short of the far edge.
  const chevW = chevronWidth(7);
  let arrows = 0;
  while (standR + 10 + arrows * 6 + chevW <= W - 2) arrows++;
  const scene = clip(total, (r, t) => {
    r.fillRect(0, 0, W, H, BLACK);
    let x: number;
    let pose: WalkerPose;
    if (t < tWave) [x, pose] = [walkX(t), walkFrame(t)];
    else if (t < tPoint) [x, pose] = [standX, "wave"];
    else if (t < tOver) [x, pose] = [standX, "point"];
    else if (t < tHello) [x, pose] = [standX + (t - tOver) * SPEED * e.dir, walkFrame(t - tOver)];
    else if (t < tExit) [x, pose] = [stopX, "wave"];
    else [x, pose] = [stopX + Math.min(Math.abs(exitX - stopX), (t - tExit) * SPEED) * e.dir, walkFrame(t - tExit)];
    // The arrows point the way until they get there; the bubble takes that space.
    if (t >= tPoint && t < tHello) {
      for (let k = 0; k < arrows; k++) drawChevron(r, mirrorX(standR + 10 + k * 6, chevW, e.dir), 4, 7, e.dir, mix(hex("#0B2A40"), CH, chase(t - tPoint, k, { period: 0.9, step: 0.15, decay: 0.22 })));
    }
    if (t >= tHello && t < tExit) hello.draw(r, t - tHello);
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
 * Trainer: Pkmn Life's battle stripes, the dialogue box rising, "TRAINER ALEX can help you!", then "Go see ALEX!" with
 * ▶ marching their way.
 */
export function trainer(e: Redirect): Clip {
  const CPS = MOTION.typeSpeed;
  const page1 = [`TRAINER ${e.name}`, "can help you!"];
  const page2 = [`Go see ${e.name}!`];
  const len1 = page1.join("").length / CPS;
  const len2 = page2.join("").length / CPS;
  // Each page stays up long enough to be read once it is typed.
  const P1 = len1 + readTime(page1.join(" "));
  const P2 = len2 + 2.6;
  const talk = clip(P1 + P2, (r, t) => {
    if (t < P1) return drawDialogue(r, { lines: page1, typed: Math.floor(t * CPS), t });
    drawDialogue(r, { lines: page2, typed: Math.floor((t - P1) * CPS), t: 0.5 });
    const tt = t - P1 - len2;
    // Six ▶ from 9 px in, so they are as far from the box's sides as from each other, clear of its bottom border.
    if (tt > 0) for (let k = 0; k < 6; k++) drawTriangle(r, mirrorX(9 + k * 10, 4, e.dir), 7, e.dir, DIALOGUE_LIGHT.arrow, chase(tt, k, { period: 0.8, step: 0.1, decay: 0.18, floor: 0.35 }));
  });
  const toBlack = clip(0.3, (r, t) => {
    talk.draw(r, talk.duration);
    fade({ duration: 0.3, from: 0, to: 1 }).draw(r, t);
  });
  // The box rises out of the black the stripes leave, instead of appearing in one frame.
  const rise = layer(black(0.18), dialogueRise());
  return seq(holdEnd(stripes({ mode: "cover" }), 0.02), rise, talk, toBlack, fade({ duration: 0.35, from: 1, to: 0 }));
}

/**
 * Scroller: chevron groups and the name stream towards them like a moving-walkway sign. The band's front wipes the
 * clock away as it arrives, slows to a stop with the first name centred for as long as it takes to read, and moves on;
 * at the end it speeds off and the clock is uncovered in the same direction.
 */
export function scroller(e: Redirect): Clip {
  const V = 30;
  const OUT = 0.6;
  const RAMP = 0.3;
  const PAUSE = readTime(e.name);
  // The band, `V` px/s, brakes to a halt with the first name centred (the speed falling linearly over RAMP), stays
  // for PAUSE, and accelerates back to speed; it ends up PAUSE + RAMP s behind where it would have been.
  const stopAt = scrollBandCentreLead(e.name);
  const brakeAt = (stopAt - (V * RAMP) / 2) / V;
  const travel = (t: number) => {
    if (t <= brakeAt) return V * t;
    const s = t - brakeAt;
    if (s <= RAMP) return V * brakeAt + V * (s - (s * s) / (2 * RAMP));
    if (s <= RAMP + PAUSE) return stopAt;
    const u = s - RAMP - PAUSE;
    if (u <= RAMP) return stopAt + (V * u * u) / (2 * RAMP);
    return stopAt + (V * RAMP) / 2 + V * (u - RAMP);
  };
  const outAt = HOLD + 0.6 + PAUSE + RAMP;
  const total = outAt + OUT;
  const lead = (t: number) => travel(t) + (t > outAt ? Math.pow((t - outAt) / OUT, 2) * 160 : 0);
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
