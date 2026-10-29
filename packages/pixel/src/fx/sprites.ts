// Tiny characters for the LED matrix.

import { lerp, span } from "../ease.ts";
import { stampPalette } from "../jira.ts";
import { hex, mix, type Color, type Raster } from "../raster.ts";
import type { Direction } from "./arrows.ts";

/** The bug is 11 px wide and 12 tall. */
export const BUG_SIZE = { width: 11, height: 12 } as const;

// Two frames, legs and feelers in one position, then the other. Dark parts are dark red, not black: black LEDs are off.
const BUG_FRAMES = [
  [
    ".a.......a.",
    "..a.....a..",
    "...hhhhh...",
    "..hhehehh..",
    "l..hhhhh..l",
    ".lBRRsrrrl.",
    "..RRRsrrr..",
    "llRRRsrrrll",
    "..RRRsrrr..",
    ".lRRRsrrrl.",
    "l..RRsrr..l",
    "....RsR....",
  ],
  [
    "a.........a",
    ".a.......a.",
    "..ahhhhha..",
    "..hhehehh..",
    "...hhhhh...",
    "llBRRsrrrll",
    "..RRRsrrr..",
    ".lRRRsrrrl.",
    "l.RRRsrrr.l",
    "..RRRsrrr..",
    ".l.RRsrr.l.",
    "l...RsR...l",
  ],
];

const BUG_PALETTE: Record<string, Color> = {
  a: hex("#8A93A3"),
  l: hex("#8A93A3"),
  h: hex("#7A2A22"),
  e: hex("#FFFFFF"),
  B: hex("#FF8A7A"),
  R: hex("#E5493A"),
  r: hex("#B8372B"),
  s: hex("#5A1A14"),
};

/** The bug frame at time `t`: its legs scuttle every 1/8 s. */
export const bugFrame = (t: number) => (Math.floor(t * 8) % 2) as 0 | 1;

/**
 * An issue as a creature: an 11 × 12 red bug, top-left at (x, y), on leg frame 0 or 1 (`bugFrame(t)`). `color` draws
 * it as a one-colour silhouette instead (lay a white one over it to make it glow).
 */
export function drawBug(r: Raster, x: number, y: number, o: { frame?: 0 | 1; alpha?: number; color?: Color } = {}): void {
  const palette = o.color ? Object.fromEntries(Object.keys(BUG_PALETTE).map((k) => [k, o.color!])) : BUG_PALETTE;
  stampPalette(r, BUG_FRAMES[o.frame ?? 0]!, Math.round(x), Math.round(y), palette, o.alpha ?? 1);
}

/** A walker's pose: walking frames 0..3, standing, waving or pointing the way it faces. */
export type WalkerPose = 0 | 1 | 2 | 3 | "stand" | "wave" | "point";

/** The walker is 7 px wide and 13 tall. */
export const WALKER_SIZE = { width: 7, height: 13 } as const;

/** The walking frame at time `t`: a step every 1/8 s. */
export const walkFrame = (t: number) => (Math.floor(t * 8) % 4) as 0 | 1 | 2 | 3;

/** A stick-figure person, 7 × 13, facing `dir`, top-left at (x, y). Waving uses `t` to flap the hand. */
export function drawWalker(r: Raster, x: number, y: number, dir: Direction, pose: WalkerPose, c: Color = hex("#FFFFFF"), t = 0): void {
  const px = (cx: number, cy: number) => r.blend(Math.round(x + (dir > 0 ? cx : 6 - cx)), Math.round(y + cy), c);
  const line = (x0: number, y0: number, x1: number, y1: number) => {
    const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0));
    for (let i = 0; i <= n; i++) px(Math.round(lerp(x0, x1, n ? i / n : 0)), Math.round(lerp(y0, y1, n ? i / n : 0)));
  };
  // Head: a ring with a filled middle.
  for (const [hx, hy] of [[2, 0], [3, 0], [4, 0], [2, 1], [3, 1], [4, 1], [2, 2], [3, 2], [4, 2]] as const) px(hx, hy);
  line(3, 3, 3, 7);
  const stride: Record<string, [number, number]> = { 0: [1, 5], 1: [2, 4], 2: [5, 1], 3: [4, 2] };
  const [l1, l2] = typeof pose === "number" ? stride[pose]! : [2, 4];
  line(3, 8, l1, 12);
  line(3, 8, l2, 12);
  if (typeof pose === "number") {
    const swing = [[1, 7, 5, 6], [2, 7, 4, 7], [5, 6, 1, 7], [4, 7, 2, 7]][pose]!;
    line(3, 4, swing[0]!, swing[1]!);
    line(3, 4, swing[2]!, swing[3]!);
  } else if (pose === "point") {
    line(3, 4, 6, 4);
    px(7, 4);
    line(3, 4, 2, 7);
  } else if (pose === "wave") {
    const up = Math.floor(t * 6) % 2 === 0;
    line(3, 4, up ? 5 : 6, up ? 1 : 2);
    line(3, 4, 2, 7);
  } else {
    line(3, 4, 2, 7);
    line(3, 4, 4, 7);
  }
}

// --- Hops: squash and stretch for any sprite ---------------------------------------------------------------------

/** A sprite's pose in a hop: how high it is, and how it squashes or stretches (1 is its own size). */
export interface HopPose {
  lift: number;
  sx: number;
  sy: number;
}

/** One hop: it leaves the ground at `at`, is in the air for `air` seconds, `height` px at the top, then lands. */
export interface Hop {
  at: number;
  air: number;
  height: number;
  /** Seconds of landing squash (default 0.12). */
  land?: number;
}

/** The pose at `t` in a run of hops: stretched tall in the air, squashed wide as it lands, itself in between. */
export function hopPose(t: number, hops: Hop[]): HopPose {
  for (const h of hops) {
    const land = h.land ?? 0.12;
    if (t < h.at || t > h.at + h.air + land) continue;
    const local = t - h.at;
    if (local < h.air) {
      const s = Math.sin((local / h.air) * Math.PI);
      return { lift: s * h.height, sx: 1 - 0.06 * s, sy: 1 + 0.08 * s };
    }
    const q = Math.sin(span(local, h.air, h.air + land) * Math.PI);
    return { lift: 0, sx: 1 + 0.14 * q, sy: 1 - 0.2 * q };
  }
  return { lift: 0, sx: 1, sy: 1 };
}

/** Draws `src` scaled by (sx, sy) about its bottom centre at (cx, bottom): a sprite squashing and stretching. */
export function drawStretched(r: Raster, src: Raster, cx: number, bottom: number, sx: number, sy: number, alpha = 1): void {
  const x0 = Math.round(cx - (src.width * sx) / 2);
  const x1 = Math.round(cx + (src.width * sx) / 2);
  const y0 = Math.round(bottom - src.height * sy);
  const y1 = Math.round(bottom);
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      const u = Math.min(src.width - 1, Math.floor(((x - x0 + 0.5) / (x1 - x0)) * src.width));
      const v = Math.min(src.height - 1, Math.floor(((y - y0 + 0.5) / (y1 - y0)) * src.height));
      const i = (v * src.width + u) * 4;
      const a = src.data[i + 3]!;
      if (a > 0) r.blend(x, y, { r: src.data[i]! / a, g: src.data[i + 1]! / a, b: src.data[i + 2]! / a, a }, alpha);
    }
  }
}

// --- Magic 8-ball ------------------------------------------------------------------------------------------------

/**
 * A magic 8-ball centred on (cx, cy): slate lit from the top left with a blue rim of light on the lower right (black
 * LEDs are off, so even its darkest side stays above what an LED shows), and a glint. `face` below 0.5 shows the
 * white 8; from 0.5 its window: dark ink with the answer die's tip. Below a 5 px radius it is a plain ball.
 */
export function drawEightBall(r: Raster, cx: number, cy: number, radius: number, face = 0): void {
  r.shade((x, y) => {
    const dx = x + 0.5 - cx;
    const dy = y + 0.5 - cy;
    const d = Math.hypot(dx, dy);
    // A soft edge, so the circle reads round on the grid.
    const edge = Math.min(1, radius + 0.5 - d);
    if (edge <= 0) return null;
    const k = Math.max(0, Math.min(1, 0.45 + (dx + dy) / (radius * 2.4)));
    let c = mix(hex("#5E6A82"), hex("#2E3542"), k);
    if (d > radius - 1.4 && dx + dy > 2) c = mix(c, hex("#3A5A8C"), 0.8);
    return { ...c, a: edge };
  });
  r.blend(Math.round(cx - radius * 0.5), Math.round(cy - radius * 0.62), hex("#B8C4D6"));
  if (radius < 5) return;
  const fx = cx;
  const fy = cy - 0.5;
  const fr = 3.6;
  r.shade((x, y) => {
    const d = Math.hypot(x + 0.5 - fx, y + 0.5 - fy);
    const edge = Math.min(1, fr + 0.5 - d);
    if (edge <= 0) return null;
    return { ...(face < 0.5 ? hex("#CFD8E6") : d > fr - 1 ? hex("#1D3A6A") : hex("#08142C")), a: edge };
  });
  if (face < 0.5) stampPalette(r, EIGHT, Math.round(fx - 1.5), Math.round(fy - 2.5), { "#": hex("#141820") });
  else {
    r.fillRect(Math.round(fx - 1.5), Math.round(fy - 1), 3, 1, hex("#1D7AFC"));
    r.blend(Math.round(fx - 0.5), Math.round(fy), hex("#1D7AFC"));
  }
}

const EIGHT = ["###", "#.#", "###", "#.#", "###"];

// --- Ticket invaders ---------------------------------------------------------------------------------------------

/** A ticket invader is 10 px wide and 6 tall; the cannon that files them 7 × 4. */
export const INVADER_SIZE = { width: 10, height: 6 } as const;
export const CANNON_SIZE = { width: 7, height: 4 } as const;

// A little Jira card (the mark's diagonal, a summary line) with eyes; arms up, then down.
const INVADER = [
  ["a........a", "aWWWWWWWWa", ".WbBWeWWe.", ".WBWWeWWe.", ".WWWWggggW", "..l....l.."],
  ["..........", ".WWWWWWWW.", "aWbBWeWWea", "aWBWWeWWea", ".WWWWggggW", ".l......l."],
];
const INVADER_PALETTE: Record<string, Color> = {
  a: hex("#85B8FF"),
  B: hex("#1D7AFC"),
  b: hex("#579DFF"),
  // The card is soft, not white: a row of them would glare.
  W: hex("#CFD8E6"),
  e: hex("#141820"),
  g: hex("#6B778C"),
  l: hex("#85B8FF"),
};
const CANNON = ["...#...", "..###..", "#######", "#######"];

/** The invader's frame at time `t`: it steps (arms up, arms down) every `step` seconds, as the formation marches. */
export const invaderFrame = (t: number, step = 0.22) => (Math.floor(t / step) % 2) as 0 | 1;

/** A ticket invader, top-left at (x, y), on frame 0 or 1. */
export function drawInvader(r: Raster, x: number, y: number, frame: 0 | 1 = 0, alpha = 1): void {
  stampPalette(r, INVADER[frame]!, Math.round(x), Math.round(y), INVADER_PALETTE, alpha);
}

/** The cannon at the bottom of an invaders screen, top-left at (x, y); its muzzle is at x + 3. */
export function drawCannon(r: Raster, x: number, y: number, color: Color = hex("#62C7FF")): void {
  stampPalette(r, CANNON, Math.round(x), Math.round(y), { "#": color });
}

// --- Rain cloud --------------------------------------------------------------------------------------------------

/** The cloud is 20 px wide and 8 tall. */
export const CLOUD_SIZE = { width: 20, height: 8 } as const;

/** A cloud of three overlapping puffs on a flat base, top-left at (x, y), lit from above. `flash` 0..1 lights it up. */
export function drawCloud(r: Raster, x: number, y: number, o: { flash?: number; alpha?: number } = {}): void {
  const puffs = [
    [5, 5.2, 3.3],
    [10, 3.9, 4.1],
    [15, 5.1, 3.3],
  ] as const;
  for (let py = 0; py < CLOUD_SIZE.height; py++) {
    for (let px = 0; px < CLOUD_SIZE.width; px++) {
      const round = puffs.some(([cx, cy, rad]) => Math.hypot(px + 0.5 - cx, (py + 0.5 - cy) * 1.1) <= rad);
      const base = py >= 5 && px >= 2 && px <= 17;
      if (!round && !base) continue;
      const c = mix(mix(hex("#B4BFD0"), hex("#5E6B82"), py / 7), hex("#FFFFFF"), (o.flash ?? 0) * 0.8);
      r.blend(Math.round(x) + px, Math.round(y) + py, c, o.alpha ?? 1);
    }
  }
}

/** A raindrop; pass your own drops (tiny tickets, say, with a frame for each way up) to `drawRain`. */
const RAINDROP = [["#", "#"]];
const RAINDROP_PALETTE: Record<string, Color> = { "#": hex("#62C7FF") };

/**
 * Rain from under a cloud whose left edge is at `x` and base at row `y`: one lane per entry of `lanes` (px from the
 * cloud's left), each dropping one every `period` seconds, out of step with the others, from `start` (seconds). Drops
 * fall `speed` px/s, fading in as they leave the cloud, and tumble between the frames of `drop`.
 */
export function drawRain(
  r: Raster,
  o: {
    x: number;
    y: number;
    t: number;
    start?: number;
    lanes?: number[];
    period?: number;
    speed?: number;
    drop?: { frames: string[][]; palette: Record<string, Color> };
  },
): void {
  const lanes = o.lanes ?? [1, 6, 11, 16];
  const period = o.period ?? 0.6;
  const speed = o.speed ?? 15;
  const start = o.start ?? 0;
  const drop = o.drop ?? { frames: RAINDROP, palette: RAINDROP_PALETTE };
  if (o.t < start) return;
  lanes.forEach((lx, i) => {
    // Each lane has its own phase; the drops of the last few periods are the ones still falling.
    const phase = ((i * 0.37) % 1) * period;
    for (let n = -Math.ceil(r.height / (speed * period)) - 1; n <= 0; n++) {
      const born = start + phase + (Math.floor((o.t - start) / period) + n) * period;
      if (born < start || o.t < born) continue;
      const dy = (o.t - born) * speed;
      if (o.y + dy > r.height) continue;
      const tip = Math.floor((o.t - born) / 0.18 + i) % drop.frames.length;
      stampPalette(r, drop.frames[tip]!, Math.round(o.x) + lx + tip, Math.round(o.y + dy), drop.palette, Math.min(1, dy / 2));
    }
  });
}

// --- Pointing hand -----------------------------------------------------------------------------------------------

// A cartoon hand pointing right out of a blue cuff: the index finger out (rows 3..7, from the palm at column 15 to its
// tip at 28), the other fingers curled under the thumb (out to column 19). The finger's middle (columns 20..26, on its
// rows only) is what `pointingHand` shortens.
const HAND = [
  "..............................",
  ".........oooo.................",
  ".......ooSSSSoo...............",
  "......oSSSSSSSSoooooooooooo...",
  "CCCww.oSSSSSSSSSSSSSSSSSSSSo..",
  "CCCwwoSSSSSSSSSSSSSSSSSSSSSSo.",
  "CCCwwoSSSSSSSSSdddddddddddddo.",
  "CCCwwoSSSSSSSSSoooooooooooo...",
  "CCCwwoSSSSSSSSSSSSSo..........",
  "CCCwwoSSSSSSSSSddddo..........",
  "CCCwwoSSSSSSSSSoooo...........",
  "CCCwwoSSSSSSSSSSSSo...........",
  "CCCww.oSSSSSSSSdddo...........",
  "......ooSSSSSoooo.............",
  "........oooo..................",
];
const HAND_PALETTE: Record<string, Color> = { C: hex("#1D7AFC"), w: hex("#CFE3F5"), S: hex("#FFC892"), d: hex("#E0904F"), o: hex("#A0521C") };
/** The hand's sleeve colour, to run the cuff on off the edge of the screen. */
export const HAND_SLEEVE = HAND_PALETTE.C!;

/** The pointing hand is 15 rows tall (its first row empty) and `handWidth(finger)` wide. */
export const HAND_HEIGHT = 15;
/**
 * The shortest index finger the hand is drawn with: 10 px out of the palm, so it still reaches 5 px past the curled
 * fingers and reads as pointing (shorter, it reads as a fist).
 */
export const HAND_MIN_FINGER = 10;
const fingerOf = (finger: number) => Math.max(HAND_MIN_FINGER, Math.min(14, Math.round(finger)));
/** The hand's width, cuff to fingertip and a clear column, with the index finger `finger` px out of the palm (10..14). */
export const handWidth = (finger = 14) => 30 - (14 - fingerOf(finger));

/** The hand's rows with the index finger `finger` px long: a wide name leaves a shorter finger, not a cropped hand. */
function pointingHand(finger = 14): string[] {
  const cut = 14 - fingerOf(finger);
  return HAND.map((row) => row.slice(0, 20) + row.slice(20 + cut));
}

/**
 * A big cartoon hand pointing towards `dir` out of a blue cuff, top-left at (x, y); its cuff is the 5 columns on the
 * side away from `dir` (rows y + 4..y + 12) and its fingertip the column `handWidth(finger) - 2` in from there.
 * `finger` (10..14, clamped) is the index finger's length out of the palm; it reaches `finger - 5` px past the curled
 * fingers.
 */
export function drawPointingHand(r: Raster, x: number, y: number, dir: Direction, o: { finger?: number; alpha?: number } = {}): void {
  stampPalette(r, pointingHand(o.finger), Math.round(x), Math.round(y), HAND_PALETTE, o.alpha ?? 1, dir < 0);
}

// --- Growlithe ---------------------------------------------------------------------------------------------------

// Growlithe facing right, 18 x 13: a big orange head with a cream tuft on top and a shiny eye, a cream bib under it,
// black stripes slanting across its back, and a bushy cream tail. Stripes are near black: on the LEDs they read as
// gaps in the orange, as on the real thing.
const PUP_BASE = [
  "..........CCC.....",
  "........oCCCCC....",
  ".CC.....ooCCCOO...",
  "CCCC...OOOOOOOOO..",
  "CCCCC..OOOOOOEwOO.",
  "CCCCC..OOOOOOEEOOO",
  ".CCCc..OOOOOOOOOOn",
  "..CcOKOOKOcCCOOOO.",
  "...OOKOOKOCCCC....",
  "...OKOOKOOCCCc....",
  "...OOOOOOOOCc.....",
  "...oO.....oO......",
  "...oO.....oO......",
];
/** Rows replaced from PUP_BASE for each pose. */
const PUP_POSES: Record<GrowlithePose, Record<number, string>> = {
  stand: {},
  // The tail swung up over its back.
  wag: {
    0: "..CC......CCC.....",
    1: ".CCCC...oCCCCC....",
    2: ".CCCC...ooCCCOO...",
    3: "..CCCc.OOOOOOOOO..",
    4: "..CCCc.OOOOOOEwOO.",
    5: "...CCc.OOOOOOEEOOO",
    6: "...Cc..OOOOOOOOOOn",
    7: "...cOKOOKOcCCOOOO.",
  },
  // The jaw dropped open.
  bark: { 5: "CCCCC..OOOOOOEEOO.", 6: ".CCCc..OOOOOOOOmmn", 7: "..CcOKOOKOcCCOOOOO" },
  // Legs stretched fore and aft.
  leap: { 11: ".oO.........oO....", 12: "oO...........oO..." },
  // Legs tucked under.
  gather: { 11: ".....oO.oO........", 12: "......oOo........." },
};
const PUP_PALETTE: Record<string, Color> = {
  O: hex("#FF7A1E"),
  o: hex("#C8501A"),
  K: hex("#1E0C04"),
  C: hex("#FFE6A8"),
  c: hex("#D9B070"),
  E: hex("#140804"),
  w: hex("#FFFFFF"),
  n: hex("#2A160A"),
  m: hex("#7A1E08"),
};

/** Growlithe's poses: standing, wagging (its tail up), barking, mid-leap and landing. */
export type GrowlithePose = "stand" | "wag" | "bark" | "leap" | "gather";

/** Growlithe is 18 px wide and 13 tall; its nose is the far column on the side it faces, on row 5 or 6. */
export const GROWLITHE_SIZE = { width: 18, height: 13 } as const;

/** Growlithe, top-left at (x, y), facing `dir`, in `pose`. */
export function drawGrowlithe(r: Raster, x: number, y: number, dir: Direction, pose: GrowlithePose = "stand", alpha = 1): void {
  const rows = PUP_BASE.map((row, i) => PUP_POSES[pose][i] ?? row);
  stampPalette(r, rows, Math.round(x), Math.round(y), PUP_PALETTE, alpha, dir < 0);
}

/**
 * A small puff of embers out of a fire type's mouth at (x, y), towards `dir`, at `p` 0..1 of its life (none at 0 or
 * 1): a few sparks drifting forward and up, yellow to red as they cool, fading out.
 */
export function drawEmberPuff(r: Raster, x: number, y: number, dir: Direction, p: number): void {
  if (p <= 0 || p >= 1) return;
  const sparks = [
    [1.0, -0.15, 0],
    [0.8, -0.55, 0.12],
    [1.2, 0.2, 0.2],
    [0.6, -0.9, 0.3],
  ] as const;
  for (const [reach, rise, lag] of sparks) {
    const q = (p - lag) / (1 - lag);
    if (q <= 0) continue;
    const sx = x + dir * reach * q * 6;
    const sy = y + rise * q * 4 - q * q * 1.5;
    // Hot and bright as they leave, cooling to orange; they fade out late, so they read as sparks, not smoke.
    const c = mix(hex("#FFF0B0"), hex("#FF7A1E"), q);
    const a = 1 - q * q;
    r.glow(sx, sy, 1.6, 1.6, { ...hex("#FF9A1F"), a: a * 0.7 }, 1.2);
    r.blend(sx, sy, c, a);
  }
}

// --- Megaphone ---------------------------------------------------------------------------------------------------

// A megaphone pointing right, 12 x 11: a mouthpiece at the back, the orange cone flaring to a cream bell rim with the
// dark inside of the bell showing through it, and a grey handle under the cone.
const MEGAPHONE = [
  "........WW..",
  "......ooWiW.",
  "....oooOWiW.",
  "hh.ooooOWiW.",
  "hhoooooOWiW.",
  "hhoooooOWiW.",
  "hh.ooooOWiW.",
  "....oooOWiW.",
  "....gg.oWiW.",
  "....gg..WW..",
  ".....gg.....",
];
const MEGAPHONE_PALETTE: Record<string, Color> = {
  h: hex("#5A616E"),
  o: hex("#FF7A33"),
  O: hex("#FFA36E"),
  W: hex("#FFE3C8"),
  i: hex("#8A3A14"),
  g: hex("#8A93A3"),
};

/** The megaphone is 12 x 11; its bell's mouth is the column 10 px in from its back, centred 5 rows down. */
export const MEGAPHONE_SIZE = { width: 12, height: 11, mouth: 10, mouthY: 5 } as const;

/** A megaphone pointing towards `dir`, top-left at (x, y). */
export function drawMegaphone(r: Raster, x: number, y: number, dir: Direction, alpha = 1): void {
  stampPalette(r, MEGAPHONE, Math.round(x), Math.round(y), MEGAPHONE_PALETTE, alpha, dir < 0);
}

/**
 * Sound coming out of a megaphone: up to three arcs ")))" leaving the point (x, cy) towards `dir`, at `p` 0..1 of a
 * shout (none at 0 or 1). They spread `reach` px and fade as they go; nothing is drawn past column `stop` (where a word
 * starts), so a shout never touches its words.
 */
export function drawSoundArcs(r: Raster, x: number, cy: number, dir: Direction, p: number, o: { reach?: number; color?: Color; stop?: number } = {}): void {
  if (p <= 0 || p >= 1) return;
  const reach = o.reach ?? 12;
  const color = o.color ?? hex("#FFB020");
  for (let k = 0; k < 3; k++) {
    const q = p * 1.5 - k * 0.25;
    if (q <= 0 || q >= 1) continue;
    const rad = 2 + q * reach;
    const a = 1 - q;
    r.shade((px, py) => {
      const dx = (px + 0.5 - x) * dir;
      const dy = (py + 0.5 - cy) * 0.75;
      if (dx <= 0 || Math.abs(Math.atan2(dy, dx)) > 0.9) return null;
      if (o.stop !== undefined && (dir > 0 ? px >= o.stop : px <= o.stop)) return null;
      const k2 = 1 - Math.abs(Math.hypot(dx, dy) - rad) * 1.4;
      return k2 > 0 ? { ...color, a: k2 * a } : null;
    });
  }
}
