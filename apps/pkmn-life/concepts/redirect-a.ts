// Unchosen redirect concepts, set A: "go see ALEX" as the original EXIT sign (a running figure and a door), a sat-nav
// and a call transfer. The others in this set (motorway sign, parcel tracking) were rebuilt as the motorway and parcel
// styles in assets/scenes/redirects and are gone from here. Throwaway prototypes for the gallery (concepts/build.ts);
// each is built from { name, dir } so it mirrors for someone on the left, and opens from black over the clock and
// closes back to it.

import {
  MOTION,
  Raster,
  capCentre,
  chase,
  clip,
  drawBar,
  drawChevron,
  fade,
  font,
  hex,
  inBack,
  inRoundRect,
  inCubic,
  inOutCubic,
  lerp,
  mix,
  outCubic,
  readTime,
  roll,
  seq,
  span,
  textWidth,
  typewriter,
  type Clip,
  type Color,
} from "@vladzaharia/bar-pixel";
import { H, PERSON, W, type Concept } from "./types.ts";

type Dir = 1 | -1;
interface Who {
  name: string;
  dir: Dir;
}

const BIG = "extra_large" as const;
const BIG_Y = capCentre(BIG);
const BLACK = hex("#000000");

/** x for something `w` wide at `x` in the rightward layout, mirrored for a leftward one. */
const mx = (dir: Dir, x: number, w: number) => (dir > 0 ? x : W - x - w);
const nameW = (p: Who) => textWidth(p.name, font(BIG));

/**
 * Pixel art from rows of characters (drawn facing right), one colour per character; mirrored when `dir` is -1.
 */
function art(r: Raster, rows: string[], x: number, y: number, pal: Record<string, Color>, dir: Dir = 1, alpha = 1): void {
  const w = Math.max(...rows.map((row) => row.length));
  rows.forEach((row, ry) =>
    [...row].forEach((ch, rx) => {
      const c = pal[ch];
      if (c) r.blend(Math.round(x) + (dir > 0 ? rx : w - 1 - rx), Math.round(y) + ry, c, alpha);
    }),
  );
}
const artW = (rows: string[]) => Math.max(...rows.map((row) => row.length));

/** A 1 px outline of a pixel-art rounded rectangle. */
function outline(r: Raster, x: number, y: number, w: number, h: number, rad: number, c: Color): void {
  r.roundRect(x, y, w, h, rad, (px, py) => {
    const lx = px - x;
    const ly = py - y;
    const inside = (a: number, b: number) => inRoundRect(a, b, w, h, rad);
    return inside(lx - 1, ly) && inside(lx + 1, ly) && inside(lx, ly - 1) && inside(lx, ly + 1) ? null : c;
  });
}

/** Draws into a fresh layer, then composites it at an offset. */
function offset(r: Raster, dx: number, dy: number, draw: (s: Raster) => void): void {
  const s = new Raster(W, H);
  draw(s);
  r.draw(s, Math.round(dx), Math.round(dy));
}

/** Fades the clock out to black. */
const toBlack = (duration: number = MOTION.base) => fade({ from: 0, to: 1, duration });
/** Fades black away, uncovering the clock. */
const fromBlack = (duration: number = MOTION.base) => fade({ from: 1, to: 0, duration });
/** Fades the last frame of `c` to black. */
function fadeOutLast(c: Clip, duration: number): Clip {
  return clip(duration, (r, t) => {
    const s = new Raster(W, H);
    c.draw(s, c.duration);
    r.fillRect(0, 0, W, H, BLACK).draw(s, 0, 0, 1 - inOutCubic(t / duration));
  });
}

// --- EXIT sign ------------------------------------------------------------------------------------------------------

/** The ISO running figure, 12 × 13, facing right: a stride, passing, the other stride, passing. */
const RUNNER = [
  [
    ".........##.",
    "........####",
    "........####",
    ".........##.",
    ".......###..",
    ".....#####..",
    "...##.####.#",
    "..#...###.#.",
    ".....###....",
    "....##.##...",
    "...##...##..",
    "..##.....#..",
    ".##......##.",
  ],
  [
    ".........##.",
    "........####",
    "........####",
    ".........##.",
    ".......##...",
    "......####.#",
    ".....#####.#",
    "....#.###.#.",
    "......###...",
    "......####..",
    ".....##..#..",
    "....##...#..",
    "....#....##.",
  ],
  [
    ".........##.",
    "........####",
    "........####",
    ".........##.",
    ".......###..",
    ".....#####..",
    "....#.####.#",
    "...#..###.#.",
    ".....###....",
    "....##.##...",
    "...##...##..",
    "..##.....#..",
    ".##......##.",
  ],
  [
    ".........##.",
    "........####",
    "........####",
    ".........##.",
    ".......##...",
    "......####..",
    ".....######.",
    "....#.###..#",
    "......###...",
    ".....####...",
    ".....#..##..",
    "....##...#..",
    ".........#..",
  ],
];

/**
 * EXIT sign: the clock fades out and an illuminated green EXIT sign flickers on: the name, the ISO running figure
 * dashing for a doorway on their side, and an arrow. The figure runs on the spot, then bolts out of the sign their
 * way, and the sign flickers off.
 */
function exitSign(p: Who): Clip {
  const LIT = hex("#00A050");
  const DEEP = hex("#006E36");
  const INK = hex("#F0FFF4");
  const FLICK = 0.7;
  const HOLD = 3.8;
  const BOLT = 0.7;
  const OFF = 0.45;
  const f = font(BIG);
  const runW = artW(RUNNER[0]!);
  // From their edge inwards: chevrons, the doorway, the runner entering it, then the name centred in what is left.
  // A wide name gets fewer chevrons.
  const layout = (n: number) => {
    const chevW = n ? n * 5 + 1 : 0; // 9-row chevrons, 6 wide, nested 5 apart
    const doorAt = W - 1 - (n ? chevW + 3 : 0) - 6;
    const runAt = doorAt - runW + 2; // the runner's leading hand is through the doorway
    return { chevW, doorAt, runAt, room: runAt - 4 };
  };
  const chevrons = [2, 1, 0].find((n) => layout(n).room >= nameW(p)) ?? 0;
  const { chevW, doorAt, runAt, room } = layout(chevrons);
  const doorX = mx(p.dir, doorAt, 6);
  const runX = mx(p.dir, runAt, runW);
  const nx = mx(p.dir, 2 + Math.round((room - nameW(p)) / 2), nameW(p));
  const arrowX = mx(p.dir, W - 1 - chevW, chevW);
  const drawBox = (s: Raster, t: number, light: number, runnerAt: number | null) => {
    if (light <= 0) return;
    s.roundRect(0, 0, W, H, 2, (x, y) => mix(DEEP, LIT, light * (0.85 + 0.15 * Math.sin((x + y * 2) * 0.2 + t * 3))));
    outline(s, 0, 0, W, H, 2, mix(DEEP, hex("#003A1C"), 0.5));
    const ink = mix(DEEP, INK, light);
    s.text(p.name, f, nx, BIG_Y, ink);
    // The doorway: a frame on their side of the runner.
    outline(s, doorX, 1, 6, 14, 0, ink);
    if (runnerAt !== null) {
      // A ring of panel green around the figure keeps it apart from the doorway, as on the ISO sign.
      const frame = RUNNER[Math.floor(t * 10) % 4]!;
      const halo = mix(DEEP, LIT, light * 0.92);
      s.clip = { x0: 0, y0: 1, x1: W, y1: H - 1 };
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) art(s, frame, runnerAt + dx, 2 + dy, { "#": halo }, p.dir);
      s.clip = null;
      art(s, frame, runnerAt, 2, { "#": ink }, p.dir);
    }
    // Chevrons pulsing their way.
    for (let k = 0; k < chevrons; k++) {
      const b = chase(t, k, { period: 0.8, step: 0.18, decay: 0.25, floor: 0.35 });
      drawChevron(s, arrowX + (p.dir > 0 ? k * 5 : (chevrons - 1 - k) * 5), 4, 9, p.dir, mix(DEEP, ink, b));
    }
  };
  // Fluorescent start: a couple of stutters, then on.
  const flick = (t: number) => (t < 0.08 ? 0.7 : t < 0.18 ? 0 : t < 0.24 ? 0.5 : t < 0.36 ? 0 : outCubic(span(t, 0.36, FLICK)));
  return seq(
    toBlack(MOTION.base),
    clip(FLICK, (r, t) => {
      r.fillRect(0, 0, W, H, BLACK);
      drawBox(r, t, flick(t), runX);
    }),
    clip(HOLD, (r, t) => drawBox(r, FLICK + t, 1, runX)),
    clip(BOLT, (r, t) => {
      const x = runX + p.dir * inCubic(t / BOLT) * (W - 30);
      drawBox(r, FLICK + HOLD + t, 1, x);
    }),
    clip(OFF, (r, t) => {
      r.fillRect(0, 0, W, H, BLACK);
      // Off: a last stutter, then the tubes die away.
      const light = t < 0.1 ? 0.4 : t < 0.16 ? 1 : Math.pow(1 - span(t, 0.16, OFF), 2);
      drawBox(r, FLICK + HOLD + BOLT + t, light, null);
    }),
    fromBlack(0.3),
  );
}

// --- Sat-nav --------------------------------------------------------------------------------------------------------

/** A sat-nav turn arrow (↱), 12 × 12: up, then a turn to the right. */
const TURN_ARROW = [
  ".......#....",
  ".......##...",
  ".......###..",
  ".##########.",
  "############",
  "###########.",
  "###....###..",
  "###....##...",
  "###....#....",
  "###.........",
  "###.........",
  "###.........",
];

/** A chequered flag on a pole, 10 × 12, facing `dir`, its cloth rippling with `t`. */
function drawFlag(r: Raster, x: number, y: number, dir: Dir, t: number): void {
  const POLE = hex("#C9D2E0");
  const put = (cx: number, cy: number, c: Color) => r.blend(x + (dir > 0 ? cx : 9 - cx), y + cy, c);
  for (let cy = 0; cy < 12; cy++) put(0, cy, POLE);
  put(1, 11, POLE);
  for (let cx = 1; cx <= 8; cx++) {
    const ripple = Math.round(Math.sin(t * 7 - cx * 0.8) * 0.6);
    for (let cy = 0; cy < 4; cy++) put(cx, 1 + cy + ripple, (cx + cy) % 2 ? hex("#FFFFFF") : hex("#202020"));
  }
}

/**
 * Sat-nav: the name as the street to turn into, the distance counting down in a split-flap roll (3 m, 2 m, 1 m) and a
 * green turn tile pointing their way. At 0 the tile's arrow rolls away for a chequered flag, the green floods the whole
 * screen, and the name rolls over to ARRIVED and back, centred on the banner.
 */
function satnav(p: Who): Clip {
  const TILE = hex("#1A8F4A");
  const TILE_DARK = hex("#0E5C2E");
  const CYAN = hex("#62C7FF");
  const WHITE = hex("#FFFFFF");
  const f = font(BIG);
  const small = font("small");
  const FIRST = 1.2;
  const STEP = 0.9;
  const ROLL = 0.26;
  const SAY = 0.25; // after arriving, before the name rolls over
  const ARRIVED = readTime("ARRIVED") + 0.1;
  const LAST = 1.2;
  const TW = 16;
  const tileX = mx(p.dir, W - TW, TW);
  const nx = mx(p.dir, 2, nameW(p));
  // The distance (a big digit and a small unit) centres in the gap between the name and the tile.
  const digitW = textWidth("3", f);
  const unitW = textWidth("m", small);
  const distW = digitW + 1 + unitW;
  const gapX = p.dir > 0 ? 2 + nameW(p) : TW;
  const gapW = W - TW - 2 - nameW(p);
  const distX = gapX + Math.round((gapW - distW) / 2);
  const arriveAt = FIRST + STEP * 2;
  const dist = roll({
    words: [...["3", "2", "1"].map((text, i) => ({ text, font: BIG, hold: i === 0 ? FIRST : STEP })), { text: "", font: BIG, hold: 0.1 }],
    box: { x: distX, width: digitW },
    rollTime: ROLL,
    color: () => CYAN,
  });
  // On the banner: the name, then ARRIVED, then the name again, each centred beside the tile.
  const banner = { x: p.dir > 0 ? 0 : TW, width: W - TW };
  const sayAt = arriveAt + SAY;
  const say = roll({
    words: [
      { text: "ARRIVED", font: BIG, hold: ARRIVED },
      { text: p.name, font: BIG, hold: LAST },
    ],
    box: banner,
    rollTime: ROLL,
  });
  const total = sayAt + ROLL + say.duration;
  const scene = clip(total, (r, t) => {
    r.fillRect(0, 0, W, H, BLACK);
    // Arrived: the tile's green floods across.
    const flood = outCubic(span(t, arriveAt, arriveAt + 0.35));
    if (flood > 0) {
      const fw = Math.round(TW + (W - TW) * flood);
      r.roundRect(p.dir > 0 ? W - fw : 0, 0, fw, H, 3, (_x, y) => mix(TILE, TILE_DARK, y / 15));
    }
    // The name rolls up and out as ARRIVED rolls in.
    const out = inOutCubic(span(t, sayAt, sayAt + ROLL));
    if (out < 1) r.text(p.name, f, nx, BIG_Y - Math.round(out * H), WHITE);
    if (t > sayAt + ROLL) say.draw(r, t - sayAt - ROLL);
    else if (out > 0) offset(r, 0, Math.round((1 - out) * H), (l) => say.draw(l, 0));
    if (t < arriveAt + 0.1) {
      dist.draw(r, t);
      // The unit rolls out with the last digit.
      const unitOut = inOutCubic(span(t, arriveAt - ROLL, arriveAt));
      r.text("m", small, distX + digitW + 1, BIG_Y + f.ascent - small.ascent - Math.round(unitOut * H), CYAN);
    }
    r.roundRect(tileX, 0, TW, H, 3, (_x, y) => mix(TILE, TILE_DARK, y / 15));
    // The turn arrow nudges their way on every new distance, then rolls up and out as the flag rolls in.
    const swap = inOutCubic(span(t, arriveAt - ROLL, arriveAt));
    const since = t < FIRST ? t : (t - FIRST) % STEP;
    const nudge = t < arriveAt && since < 0.3 ? Math.round(Math.sin((since / 0.3) * Math.PI)) : 0;
    const tile = new Raster(W, H);
    art(tile, TURN_ARROW, tileX + 2 + p.dir * nudge, 2 - Math.round(swap * H), { "#": WHITE }, p.dir);
    drawFlag(tile, tileX + 3, 2 + Math.round((1 - swap) * H), p.dir, t);
    tile.fade((x) => (x >= tileX && x < tileX + TW ? 1 : 0));
    r.draw(tile, 0, 0);
    if (t > arriveAt) r.glow(tileX + TW / 2, 8, 10, 9, { ...WHITE, a: 0.45 * (1 - span(t, arriveAt, arriveAt + 0.5)) }, 1.6);
  });
  return seq(toBlack(MOTION.base), scene, fadeOutLast(scene, MOTION.base), fromBlack(0.3));
}

// --- Call transfer --------------------------------------------------------------------------------------------------

/** A desk telephone, 11 × 10: the handset (rows 0-3, so it can jump when it rings) on its base (rows 3-9). */
const PHONE_HANDSET = [
  "..#######..",
  ".#########.",
  "###.....###",
  "##.......##",
];
const PHONE_BASE = [
  "....###....",
  "...#####...",
  "..#######..",
  ".##.#.#.##.",
  ".#########.",
  ".##.#.#.##.",
  ".#########.",
];

/** A desk phone at (x, y); `lift` raises the handset off the cradle by that many pixels. */
function drawPhone(r: Raster, x: number, y: number, c: Color, lift = 0): void {
  art(r, PHONE_BASE, x, y + 3, { "#": c });
  art(r, PHONE_HANDSET, x, y - Math.round(lift), { "#": c });
}

/**
 * Call transfer: a phone display types "Transferring you to..." beside a desk phone; it rolls on to the name, and a
 * hold bar fills towards their side, hold music drifting up, until the phone on their side rings (the handset jumping
 * on its cradle) and is picked up.
 */
function transfer(p: Who): Clip {
  const AMBER = hex("#FFB020");
  const CYAN = hex("#62C7FF");
  const GREY = hex("#8A93A3");
  const lines = ["Transferring", "you to..."];
  const TYPE = lines.join("").length / MOTION.typeSpeed;
  const P1 = TYPE + 0.8;
  const ROLL = 0.3;
  const FILL = 2.2;
  const RING = 1.4;
  const PICK = 0.45;
  const f = font(BIG);
  const PW = 11;
  const phoneX = mx(p.dir, W - 3 - PW, PW);
  const nx = mx(p.dir, 2, nameW(p));
  const barW = W - 22 - nameW(p);
  const barX = mx(p.dir, 5 + nameW(p), barW);
  const type = typewriter({ lines, font: "small", x: mx(p.dir, 3, textWidth(lines[0]!, font("small"))), ys: [0, 7], duration: P1 });
  // Ring, ring... ring, ring: two short bursts, as a phone rings.
  const ringing = (t: number) => {
    const k = t % 1.2;
    return k < 0.35 || (k > 0.5 && k < 0.85);
  };
  const page2 = (r: Raster, t: number) => {
    r.text(p.name, f, nx, BIG_Y, hex("#FFFFFF"));
    const v = outCubic(span(t, 0.15, FILL));
    const done = span(t, FILL - 0.15, FILL);
    barTo(r, barX, 6, barW, 4, v, p.dir, hex("#2A303B"), mix(AMBER, CYAN, done));
    // Hold music: notes drifting up off the filled part of the bar.
    if (t < FILL) for (let k = 0; k < 3; k++) {
      const life = (t * 0.8 + k / 3) % 1;
      const along = ((k * 0.37 + 0.15) % 1) * v;
      const x = p.dir > 0 ? barX + Math.round(along * barW) : barX + barW - 3 - Math.round(along * barW);
      drawNote(r, x, Math.round(lerp(4, -5, life)), { ...AMBER, a: Math.sin(life * Math.PI) * 0.85 * (1 - done) });
    }
    const rt = t - FILL;
    if (rt < 0) return drawPhone(r, phoneX, 3, GREY);
    if (rt < RING) {
      const on = ringing(rt);
      drawPhone(r, phoneX, 3, CYAN, on ? (Math.floor(rt * 28) % 2) + 1 : 0);
      if (on) {
        // Ring marks either side of the handset.
        r.fillRect(phoneX - 2, 1, 1, 2, CYAN).fillRect(phoneX + PW + 1, 1, 1, 2, CYAN);
        r.fillRect(phoneX - 3, 4, 1, 1, CYAN).fillRect(phoneX + PW + 2, 4, 1, 1, CYAN);
      }
      return;
    }
    // Picked up: the handset lifts off and away.
    const q = span(rt - RING, 0, PICK);
    drawPhone(r, phoneX, 3, CYAN, inBack(q, 1.6) * 14);
  };
  const total = P1 + ROLL + FILL + RING + PICK;
  const scene = clip(total, (r, t) => {
    r.fillRect(0, 0, W, H, BLACK);
    if (t < P1 + ROLL) {
      const k = inOutCubic(span(t, P1, P1 + ROLL));
      offset(r, 0, -k * H, (s) => {
        type.draw(s, Math.min(t, P1));
        drawPhone(s, phoneX, 3, GREY);
      });
      if (k > 0) offset(r, 0, (1 - k) * H, (s) => page2(s, 0));
      return;
    }
    page2(r, t - P1 - ROLL);
  });
  return seq(toBlack(MOTION.base), scene, fadeOutLast(scene, MOTION.base), fromBlack(0.3));
}

/** A rounded bar filling towards `dir`. */
function barTo(r: Raster, x: number, y: number, w: number, h: number, value: number, dir: Dir, track: Color, fill: Color): void {
  if (dir > 0) return drawBar(r, { x, y, width: w, height: h, value, track, fill });
  r.roundRect(x, y, w, h, Math.floor(h / 2), track);
  const fw = Math.round(w * Math.max(0, Math.min(1, value)));
  if (fw > 0) r.roundRect(x + w - fw, y, fw, h, Math.floor(h / 2), fill);
}

/** A quaver, 3 × 5. */
function drawNote(r: Raster, x: number, y: number, c: Color): void {
  art(r, [".##", ".#.", ".#.", "##.", "##."], x, y, { "#": c });
}

// --- The concepts ---------------------------------------------------------------------------------------------------

/** Every concept in this set, built for one person. */
export function redirectA(p: Who): Concept[] {
  return [
    {
      id: "redirect-exit-sign",
      name: "Exit sign",
      group: "Unchosen concepts",
      about: "The clock fades and a lit green EXIT sign flickers on like a fluorescent tube: the name, the ISO running figure dashing into a doorway on their side, and chevrons pulsing their way. The figure runs on the spot, then bolts through the door and off the sign, and the sign stutters off.",
      uses: "reuses drawChevron + chase (the pulsing chevrons), fade, MOTION · new: ISO running figure (4 frames, 12 x 13, with a green knock-out ring), doorway, fluorescent flicker on and off",
      clip: exitSign(p),
    },
    {
      id: "redirect-satnav",
      name: "Sat-nav",
      group: "Unchosen concepts",
      about: "A sat-nav instruction: the name as the street, the distance rolling down 3 m, 2 m, 1 m beside a green turn tile pointing their way. At 0 the arrow rolls away for a waving chequered flag, the green floods the screen and the name rolls over to ARRIVED, then back.",
      uses: "reuses roll (the countdown and the ARRIVED swap), fade, readTime, MOTION · new: sat-nav turn arrow, waving chequered flag, turn tile, green flood",
      clip: satnav(p),
    },
    {
      id: "redirect-transfer",
      name: "Call transfer",
      group: "Unchosen concepts",
      about: "A phone display types \"Transferring you to...\" beside a desk phone, then rolls on to the name. A hold bar fills their way with hold-music notes drifting up, the phone on their side rings (the handset jumping on its cradle), and the handset is picked up.",
      uses: "reuses typewriter, drawBar (the progress bar; mirrored fill for the left), fade, MOTION · new: desk phone with liftable handset, ring marks, music notes",
      clip: transfer(p),
    },
  ];
}

export const CONCEPTS: Concept[] = redirectA(PERSON);
