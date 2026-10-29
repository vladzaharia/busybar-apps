// Unchosen redirect concepts, set B: a brown dog that barks "ARF!", a UFO and bowling, as ways of saying "go see ALEX,
// over there". The others in this set (paper plane, pointing hand, little train, shout, treasure map) were rebuilt as
// the plane, hand, train, shout and map styles in assets/scenes/redirects (and the dog as Growlithe) and are gone from
// here. Throwaway prototypes for the gallery (concepts/build.ts). Each look is a function of { name, dir } so it
// mirrors for someone on the left; CONCEPTS holds the clips made for PERSON. Each opens from black over the clock and
// closes back to it.
//
// Everything is laid out for someone on the right (dir 1) and mirrored when drawn: `mx` for a box, `mp` for a point,
// `col` for a pixel column. Text is never mirrored, only moved.

import {
  MOTION,
  Raster,
  capCentre,
  clip,
  drawWalker,
  fade,
  font,
  hex,
  inOutCubic,
  inQuad,
  lerp,
  mix,
  outBack,
  outBounce,
  outCubic,
  pause,
  seq,
  shake,
  span,
  speechBubble,
  squash,
  starfield,
  textWidth,
  wipe,
  type Clip,
  type Color,
} from "@vladzaharia/bar-pixel";
import { H, PERSON, W, type Concept } from "./types.ts";

/** Who to send people to, and which side of the bar they sit (as someone facing the front sees it). */
export interface Who {
  name: string;
  dir: 1 | -1;
}

const BLACK = hex("#000000");
const AMBER = hex("#FFB020");
const BIG = "extra_large" as const;
/** Top of an extra_large text element whose capitals sit on rows 3..12. */
const BIG_Y = capCentre(BIG);

const big = () => font(BIG);
const nameW = (who: Who) => textWidth(who.name, big());
/** Left x of something `w` wide at `x` in the rightward layout, mirrored for a leftward one. */
const mx = (who: Who, x: number, w: number) => (who.dir > 0 ? x : W - x - w);
/** A point's x (a centre, a vertex) in the rightward layout, mirrored. */
const mp = (who: Who, x: number) => (who.dir > 0 ? x : W - x);
/** A pixel column in the rightward layout, mirrored. */
const col = (who: Who, x: number) => (who.dir > 0 ? x : W - 1 - x);
const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
/** Coverage to alpha, a little crisper than linear so small shapes keep their edges on the LEDs. */
const crisp = (cov: number) => clamp01((cov - 0.15) / 0.6);

// Openings and closings ----------------------------------------------------------------------------------------------

const blackIn = (d: number = MOTION.base) => fade({ from: 0, to: 1, duration: d });
const blackOut = () => fade({ from: 1, to: 0, duration: 0.35 });
/** The black screen swept away towards them, uncovering the clock. */
const revealTo = (who: Who, edge: Color) => wipe({ mode: "reveal", direction: who.dir, color: BLACK, edge, duration: MOTION.base });
/** A scene's last frame fading to black. */
function toBlack(scene: Clip, d: number = MOTION.base): Clip {
  return clip(d, (r, t) => {
    const s = new Raster(W, H);
    scene.draw(s, scene.duration);
    r.fillRect(0, 0, W, H, BLACK).draw(s, 0, 0, 1 - t / d);
  });
}
const bg = (r: Raster) => r.fillRect(0, 0, W, H, BLACK);

// Drawing helpers ----------------------------------------------------------------------------------------------------

type Palette = Record<string, Color>;

/** Width of a piece of pixel art. */
const artW = (art: readonly string[]) => Math.max(...art.map((row) => row.length));

/** Stamps pixel art (one character a pixel; characters not in the palette are clear), flipped left-right if asked. */
function stamp(r: Raster, art: readonly string[], x: number, y: number, pal: Palette, flip = false, alpha = 1): void {
  const w = artW(art);
  const x0 = Math.round(x);
  const y0 = Math.round(y);
  art.forEach((row, ry) =>
    [...row].forEach((ch, rx) => {
      const c = pal[ch];
      if (c) r.blend(x0 + (flip ? w - 1 - rx : rx), y0 + ry, c, alpha);
    }),
  );
}

/** Pixel art placed at `x` in the rightward layout, facing their way. */
const stampFor = (who: Who, r: Raster, art: readonly string[], x: number, y: number, pal: Palette, alpha = 1) =>
  stamp(r, art, mx(who, Math.round(x), artW(art)), y, pal, who.dir < 0, alpha);

type Pt = [number, number];

/**
 * One extra_large glyph tipped over about a bottom corner: `angle` 0 stands it up, π/2 lays it flat on its side,
 * falling towards `fall` (1 right, -1 left). (left, top) is where the text element would be.
 */
function drawTippedGlyph(r: Raster, ch: string, left: number, top: number, angle: number, fall: 1 | -1, c: Color): void {
  const f = big();
  const g = f.glyph(ch.codePointAt(0)!);
  if (!g) return;
  const gx0 = Math.round(left) + g.x;
  const gy0 = Math.round(top) + f.ascent - g.y - g.height;
  const px = fall > 0 ? gx0 + g.width : gx0;
  const py = gy0 + g.height;
  const a = fall > 0 ? angle : -angle;
  const cos = Math.cos(a);
  const sin = Math.sin(a);
  const reach = Math.ceil(Math.hypot(g.width, g.height)) + 1;
  const SS = 3;
  for (let y = py - reach; y <= py + 1; y++) {
    for (let x = px - reach; x <= px + reach; x++) {
      let n = 0;
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const ox = x + (sx + 0.5) / SS - px;
          const oy = y + (sy + 0.5) / SS - py;
          const bx = Math.floor(ox * cos + oy * sin + (px - gx0));
          const by = Math.floor(-ox * sin + oy * cos + g.height);
          if (bx >= 0 && by >= 0 && bx < g.width && by < g.height && g.bits[by * g.width + bx]) n++;
        }
      }
      if (n) r.blend(x, y, c, crisp(n / (SS * SS)));
    }
  }
}

/** Where each letter of `text` starts, relative to the text's x. */
function letterOffsets(text: string): number[] {
  const f = big();
  const out: number[] = [];
  let pen = 0;
  for (const ch of text) {
    out.push(pen);
    pen += f.glyph(ch.codePointAt(0)!)?.advance ?? 0;
  }
  return out;
}

// Dog -------------------------------------------------------------------------------------------------------------

// A brown pup facing right, 16 x 11: mid-leap (legs stretched), landing (legs gathered), standing (two tail frames),
// and barking.
const DOG_LEAP = [
  "...........EE...",
  "..........EHHH..",
  "T.........HHKHH.",
  ".T........HHHHSN",
  "..TBBBBBBBBHHSS.",
  "...BBBBBBBBCg...",
  "...BBBBBBBBB....",
  "..LbbbbbbbbbL...",
  ".LL.........LL..",
  "LL...........LL.",
  "................",
];
const DOG_GATHER = [
  "................",
  "...........EE...",
  "T.........EHHH..",
  ".T........HHKHH.",
  "..T.......HHHHSN",
  "..TBBBBBBBBHHSS.",
  "...BBBBBBBBCg...",
  "...BBBBBBBBB....",
  "...bbbbbbbbb....",
  "....LL..LL......",
  "...LL..LL.......",
];
const DOG_STAND = [
  "...........EE...",
  "..T.......EHHH..",
  "..T.......HHKHH.",
  "..T.......HHHHSN",
  "...T......HHHSS.",
  "...BBBBBBBBCg...",
  "...BBBBBBBBB....",
  "...bbbbbbbbb....",
  "...L.L....L.L...",
  "...L.L....L.L...",
  "...L.L....L.L...",
];
const DOG_STAND_2 = DOG_STAND.map((row, i) => (i < 5 ? row.replace(/T/g, ".") : row)).map((row, i) =>
  i === 1 ? "T" + row.slice(1) : i === 2 ? ".T" + row.slice(2) : i === 3 ? "..T" + row.slice(3) : i === 4 ? "...T" + row.slice(4) : row,
);
const DOG_BARK = DOG_STAND.map((row, i) => (i === 3 ? "..T.......HHHHS." : i === 4 ? "...T......HHHSSN" : row));
const DOG_PAL: Palette = {
  E: hex("#5C3518"),
  H: hex("#B8743A"),
  K: hex("#1A0E05"),
  S: hex("#F0C89A"),
  N: hex("#2A1608"),
  B: hex("#B8743A"),
  b: hex("#8A5428"),
  T: hex("#B8743A"),
  L: hex("#8A5428"),
  C: hex("#E5493A"),
  g: hex("#FFD166"),
};

/**
 * Dog: a pup bounds in from the far side and the name pops up behind it as it passes; it stops, wags its tail and
 * barks "ARF!" their way, the letters hop to it, and it bounds off that way.
 */
function dog(who: Who): Clip {
  const DW = artW(DOG_STAND);
  const nw = nameW(who);
  const nameX = 2;
  const stopX = nameX + nw + 2;
  const startX = -DW - 2;
  const HOP = 0.32;
  const HOP_LEN = 11;
  const hopsIn = Math.ceil((stopX - startX) / HOP_LEN);
  const tStop = hopsIn * HOP;
  const BARK1 = tStop + 0.35;
  // The bubble goes ahead of its nose (its tail in the two columns before it), if it fits on the screen.
  const bubbleX = stopX + DW + 2;
  const bubble = speechBubble({ x: bubbleX, top: 0, dir: 1, text: "ARF!" });
  const roomy = bubbleX + textWidth("ARF!", font("tiny")) + 4 <= W - 1;
  const tLeave = BARK1 + bubble.duration + 0.5;
  const hopsOut = Math.ceil((W + 2 - stopX) / HOP_LEN);
  const tGone = tLeave + hopsOut * HOP;
  const total = tGone + 0.7;
  const offs = letterOffsets(who.name);
  // The dog's x and hop phase (0..1 within a hop; -1 standing).
  const at = (t: number): [number, number] => {
    if (t < tStop) {
      const k = t / HOP;
      return [lerp(startX, stopX, t / tStop), k % 1];
    }
    if (t < tLeave) return [stopX, -1];
    const k = (t - tLeave) / HOP;
    return [stopX + (t - tLeave) * (HOP_LEN / HOP), k % 1];
  };
  // Each letter pops up once the dog has gone past it.
  const letterAt = offs.map((_, i) => {
    const right = nameX + (offs[i + 1] ?? nw);
    for (let t = 0; t < tStop; t += 1 / 120) if (at(t)[0] + 4 > right) return t;
    return tStop;
  });
  const scene = clip(total, (r, t) => {
    bg(r);
    // The name, each letter hopping up behind the dog; at the bark they all hop its way in a wave.
    r.text(who.name, big(), mx(who, nameX, nw), BIG_Y, AMBER, (i) => {
      const q = span(t, letterAt[i]!, letterAt[i]! + 0.3);
      const k = who.dir > 0 ? i : who.name.length - 1 - i;
      const wave = span(t, BARK1 + 0.1 + k * 0.07, BARK1 + 0.35 + k * 0.07);
      const hop = wave > 0 && wave < 1 ? -Math.round(Math.sin(wave * Math.PI) * 2) : 0;
      return { hidden: q <= 0, dy: Math.round(lerp(5, 0, outBack(q, 2.4))) + hop, alpha: Math.min(1, q * 3) };
    });
    const [x, phase] = at(t);
    if (x > W + 2) return;
    let art = DOG_STAND;
    let y = 5;
    if (phase >= 0) {
      const air = phase > 0.15 && phase < 0.85;
      art = air ? DOG_LEAP : DOG_GATHER;
      y = 5 - Math.round(Math.sin(phase * Math.PI) * 3);
    } else {
      const barking = (t >= BARK1 && t < BARK1 + 0.18) || (t >= BARK1 + 0.3 && t < BARK1 + 0.45);
      art = barking ? DOG_BARK : Math.floor(t * 9) % 2 ? DOG_STAND : DOG_STAND_2;
    }
    stampFor(who, r, art, x, y, DOG_PAL);
    // With no room for the bubble, each bark is a few lines out of its mouth, their way.
    for (const b of [BARK1, BARK1 + 0.3]) {
      const k = (t - b) / 0.25;
      if (k < 0 || k > 1 || roomy) continue;
      for (const dy of [-2, 0, 2]) r.blend(col(who, Math.round(stopX + DW + 1 + k * 3)), 9 + dy * (0.6 + k * 0.5), AMBER, 1 - k);
    }
    if (roomy && t >= BARK1 && t < BARK1 + bubble.duration) {
      // For someone on the left the bubble is mirrored as a box, never its letters.
      (who.dir > 0 ? bubble : speechBubble({ x: W - 1 - bubbleX, top: 0, dir: -1, text: "ARF!" })).draw(r, t - BARK1);
    }
  });
  return seq(blackIn(), scene, revealTo(who, AMBER));
}

// UFO -------------------------------------------------------------------------------------------------------------

const UFO = [
  ".....cCc.....",
  "....ccccc....",
  "hHHHHHHHHHHHh",
  ".dLddLddLddL.",
];
const UFO_PAL: Palette = { c: hex("#3FA9F5"), C: hex("#C8ECFF"), H: hex("#C3CCD8"), h: hex("#8A94A6"), d: hex("#4A5262"), L: hex("#8A5A10") };
const BEAM = hex("#8CFFC0");

/**
 * UFO: under the stars a saucer comes down over the little walker and beams them up, flies their way dropping the
 * name's letters as it goes, beams the walker down beside the name, and zips away; the walker waves.
 */
function ufo(who: Who): Clip {
  const UW = artW(UFO);
  const nw = nameW(who);
  const pickX = 3;
  const dropX = W - 10;
  const nameX = dropX - 4 - nw;
  const FLY_IN = 0.8;
  const BEAM_ON = 0.2;
  const LIFT = 0.7;
  const TRANSIT = 1.5;
  const DROP = 0.65;
  const AWAY = 0.6;
  const WAVE = 1.8;
  const t1 = FLY_IN;
  const t2 = t1 + BEAM_ON;
  const t3 = t2 + LIFT;
  const t4 = t3 + BEAM_ON;
  const t5 = t4 + TRANSIT;
  const t6 = t5 + BEAM_ON;
  const t7 = t6 + DROP;
  const t8 = t7 + BEAM_ON;
  const total = t8 + Math.max(AWAY, WAVE);
  const pickC = pickX + 3.5;
  const dropC = dropX + 3.5;
  const ufoAt = (t: number): Pt => {
    if (t < t1) {
      const k = outCubic(t / t1);
      return [lerp(-UW, pickC, k), lerp(-4, 0, k)];
    }
    if (t < t4) return [pickC, 0];
    if (t < t5) {
      const k = inOutCubic((t - t4) / TRANSIT);
      return [lerp(pickC, dropC, k), -Math.round(Math.sin(k * Math.PI) * 0.6)];
    }
    if (t < t8) return [dropC, 0];
    const k = inQuad(span(t, t8, t8 + AWAY));
    return [dropC + k * 30, -k * 8];
  };
  const offs = letterOffsets(who.name);
  // Each letter falls out of the saucer as it passes over.
  const letterAt = offs.map((o, i) => {
    const c = nameX + (o + (offs[i + 1] ?? nw)) / 2;
    for (let t = t4; t < t5; t += 1 / 120) if (ufoAt(t)[0] >= c) return t;
    return t5;
  });
  const stars = starfield({ duration: total, speed: 0.05, stars: 46, seed: 4, color: hex("#8C9CC0") });
  const drawBeam = (r: Raster, cx: number, k: number, t: number, up: boolean) => {
    if (k <= 0) return;
    for (let y = 4; y < H; y++) {
      const half = lerp(3.5, 6.5, (y - 4) / 11);
      const scan = (((y + (up ? 1 : -1) * t * 18) % 4) + 4) % 4 < 1 ? 0.3 : 0;
      for (let x = Math.floor(cx - half); x < Math.ceil(cx + half); x++) {
        const edge = Math.min(x + 0.5 - (cx - half), cx + half - (x + 0.5));
        r.blend(col(who, x), y, BEAM, k * (0.4 + scan) * clamp01(edge) * (edge < 1.2 ? 1.5 : 1), "add");
      }
    }
  };
  const scene = clip(total, (r, t) => {
    bg(r);
    stars.draw(r, t);
    const [ux, uy] = ufoAt(t);
    // Beams: up at the pick-up, down at the drop-off, flickering on and off.
    const flick = (a: number, b: number) => (t < a || t > b ? 0 : Math.min(1, (t - a) / 0.12, (b - t) / 0.12) * (Math.floor(t * 30) % 3 ? 1 : 0.7));
    drawBeam(r, pickC, flick(t1, t4), t, true);
    drawBeam(r, dropC, flick(t5, t8), t, false);
    // The letters, dropped from the saucer.
    r.text(who.name, big(), mx(who, nameX, nw), BIG_Y, AMBER, (i) => {
      const q = span(t, letterAt[i]!, letterAt[i]! + 0.45);
      return { hidden: q <= 0, dy: Math.round(lerp(-10, 0, outBounce(q))) };
    });
    // The walker: picked up, carried (inside the saucer, unseen), set down, then waving.
    let wy = 3;
    let wx = pickX;
    let visible = true;
    let pose: "stand" | "wave" | 0 | 1 | 2 | 3 = "stand";
    if (t >= t2 && t < t3) [wy, pose] = [lerp(3, -11, inQuad((t - t2) / LIFT)), "wave"];
    else if (t >= t3 && t < t6) visible = false;
    else if (t >= t6 && t < t7) [wx, wy, pose] = [dropX, lerp(-11, 3, outCubic((t - t6) / DROP)), "stand"];
    else if (t >= t7) [wx, pose] = [dropX, t > t8 + 0.2 ? "wave" : "stand"];
    if (t < t2) pose = t > t1 - 0.2 ? "wave" : "stand";
    if (visible) {
      r.clip = { x0: 0, y0: 3, x1: W, y1: H };
      drawWalker(r, mx(who, wx, 7), Math.round(wy), who.dir, pose, hex("#FFFFFF"), t);
      r.clip = null;
    }
    stampFor(who, r, UFO, Math.round(ux - UW / 2), Math.round(uy), UFO_PAL);
    // Its lights chase round; the walker rides in the dome on the way over.
    const lit = Math.floor(t * 10) % 4;
    const ul = Math.round(ux - UW / 2);
    for (let k = 0; k < 4; k++) r.blend(col(who, ul + 2 + k * 3), Math.round(uy) + 3, k === lit ? hex("#FFE9A8") : AMBER, k === lit ? 1 : 0.7);
    if (t >= t3 && t < t6) r.blend(col(who, ul + 6), Math.round(uy) + 1, hex("#FFFFFF"));
  });
  return seq(blackIn(), scene, toBlack(scene), blackOut());
}

// Bowling ---------------------------------------------------------------------------------------------------------

const BALL = hex("#1D7AFC");
const BALL_LIGHT = hex("#7DB4FF");
const BALL_DARK = hex("#0B3E8F");
const HOLE = hex("#04173A");
const LANE = hex("#5A3A1A");
const LANE_DARK = hex("#2E1C0A");

/**
 * Bowling: the name stands like pins on a lane; a ball rolls in from the far side, knocks the letters down their way
 * (STRIKE!), rolls off that way, and the letters spring back up. It opens and closes like an old TV.
 */
function bowling(who: Who): Clip {
  const nw = nameW(who);
  const nameX = W - 4 - nw;
  const NAME_Y = BIG_Y + 1;
  const offs = letterOffsets(who.name);
  const RAD = 4.5;
  const CY = 9.5;
  const V = 42;
  const startX = -RAD - 2;
  // In the rightward layout, the ball reaches the first letter at tHit.
  const tHit = (nameX - (startX + RAD)) / V;
  const fallAt = offs.map((o) => tHit + Math.max(0, nameX + o - (nameX + offs[0]!)) / (V * 0.8));
  const FALL = 0.32;
  const tUp = fallAt[fallAt.length - 1]! + FALL + 1.1;
  const UP = 0.42;
  const tRest = tUp + (offs.length - 1) * 0.1 + UP;
  const HOLD = 1.4;
  const total = tRest + HOLD;
  const ballX = (t: number) => (t < tHit ? startX + V * t : startX + V * tHit + (V * 0.8) * (t - tHit));
  const strike = { from: fallAt[0]! + 0.1, to: tUp - 0.15 };
  const angleOf = (i: number, t: number) => {
    const k = t - fallAt[i]!;
    if (k < 0) return 0;
    let a: number;
    if (k < FALL) a = (Math.PI / 2) * inQuad(k / FALL);
    else a = Math.PI / 2 - 0.22 * Math.exp(-(k - FALL) * 9) * Math.abs(Math.sin((k - FALL) * 20));
    const up = span(t, tUp + i * 0.1, tUp + i * 0.1 + UP);
    if (up > 0) a = (Math.PI / 2) * (1 - outBack(up, 2.2));
    return a;
  };
  const scene = clip(total, (r, t) => {
    bg(r);
    // The lane: boards, with arrows pointing their way.
    for (let x = 0; x < W; x++) {
      r.blend(x, 14, x % 9 === 0 ? LANE_DARK : LANE);
      r.blend(x, 15, LANE_DARK);
    }
    for (const ax of [6, 13, 20]) {
      r.blend(col(who, ax), 14, hex("#C98A3A"));
      r.blend(col(who, ax + 1), 14, hex("#C98A3A"));
      r.blend(col(who, ax + 2), 14, hex("#E8B060"));
    }
    // The letters, standing like pins, tipping over their way when hit.
    [...who.name].forEach((ch, i) => {
      const lx = mx(who, nameX, nw) + offs[i]!;
      drawTippedGlyph(r, ch, lx, NAME_Y, angleOf(i, t), who.dir, hex("#FFFFFF"));
    });
    // Bits flying where the ball hits.
    const hk = (t - tHit) / 0.35;
    if (hk >= 0 && hk < 1) {
      for (const [dx, dy] of [[1, -1], [0.6, -1.4], [1.4, -0.5], [0.2, -1.6]] as const) r.blend(mp(who, nameX + dx * hk * 9), CY + dy * hk * 6, AMBER, 1 - hk);
    }
    // "STRIKE!" while they lie there.
    if (t > strike.from && t < strike.to) {
      const tiny = font("tiny");
      const sw = textWidth("STRIKE!", tiny);
      const blink = Math.floor((t - strike.from) * 6) % 2 === 0 ? 1 : 0.55;
      r.text("STRIKE!", tiny, mx(who, Math.round(nameX + (nw - sw) / 2), sw), 0, AMBER, () => ({ alpha: blink }));
    }
    // The ball, rolling: its finger holes turn with it.
    const bx = ballX(t);
    if (bx - RAD < W + 1) {
      const ang = bx / RAD;
      for (let y = Math.floor(CY - RAD); y <= Math.ceil(CY + RAD); y++) {
        for (let x = Math.floor(bx - RAD); x <= Math.ceil(bx + RAD); x++) {
          const dx = x + 0.5 - bx;
          const dy = y + 0.5 - CY;
          const d = Math.hypot(dx, dy);
          if (d > RAD) continue;
          const light = clamp01(1 - Math.hypot(dx + 1.6, dy + 1.6) / 3.2);
          const c = mix(mix(BALL_DARK, BALL, clamp01(1.2 - d / RAD)), BALL_LIGHT, light * 0.8);
          r.blend(col(who, x), y, c, clamp01(RAD + 0.5 - d));
        }
      }
      for (const [hr, ha] of [[2.2, 0], [2.2, 0.55], [1.2, 1.9]] as const) {
        const a = ang + ha;
        const hx = bx + Math.cos(a) * hr;
        const hy = CY + Math.sin(a) * hr;
        r.blend(col(who, Math.floor(hx)), Math.floor(hy), HOLE);
      }
    }
  });
  const shaken = shake(scene, { from: tHit, to: tHit + 0.4, amplitude: 1.5, vertical: true });
  return seq(squash(squash(shaken, { at: "start", time: 0.3 }), { at: "end", time: 0.3 }), pause(1 / 30));
}

// --------------------------------------------------------------------------------------------------------------------


export const CONCEPTS: Concept[] = [
  {
    id: "redirect-dog",
    name: "Dog",
    about: "A brown pup bounds in and the name pops up behind it as it passes; it stops, wags and barks \"ARF!\" their way, the letters hop towards it, and it bounds off that way.",
    uses: "reuses speechBubble, wipe, fade · new: pup (leap, land, stand, wag, bark)",
    clip: dog(PERSON),
  },
  {
    id: "redirect-ufo",
    name: "UFO",
    about: "Under the stars a saucer beams up the little walker, flies their way dropping the name's letters as it goes, beams the walker down beside the name and zips off; the walker waves.",
    uses: "reuses drawWalker, starfield, fade · new: saucer with chasing lights and a passenger in the dome, tractor beam",
    clip: ufo(PERSON),
  },
  {
    id: "redirect-bowling",
    name: "Bowling",
    about: "The name stands like pins on a lane; a ball rolls in from the far side and knocks the letters down their way (STRIKE!), rolls off, and the letters spring back up.",
    uses: "reuses squash, shake · new: bowling ball with turning finger holes, lane, letters that tip over",
    clip: bowling(PERSON),
  },
];
