// Unchosen redirect variant: the EXIT sign (from redirect-a) with the running figure ducking into an office cubicle on
// their side instead of running through a door. The other variants (the motorway sign with a GO! tab, the figure sitting
// down at a desk, the dog as a Growlithe) were rebuilt as the motorway, exit and dog styles in assets/scenes/redirects
// and are gone from here. A throwaway prototype: it is built from { name, dir } so it mirrors for someone on the left,
// opens from black over the clock and closes back to it.
//
// Everything is laid out for someone on the right (dir 1) and mirrored when drawn; text is never mirrored, only moved.

import {
  MOTION,
  Raster,
  capCentre,
  chase,
  clip,
  drawChevron,
  fade,
  font,
  hex,
  inCubic,
  inOutCubic,
  inRoundRect,
  lerp,
  mix,
  outBack,
  outCubic,
  seq,
  span,
  textWidth,
  type Clip,
  type Color,
} from "@vladzaharia/bar-pixel";
import { H, PERSON, W, type Concept } from "./types.ts";

type Dir = 1 | -1;
/** Who to send people to, and which side of the bar they sit (as someone facing the front sees it). */
export interface Who {
  name: string;
  dir: Dir;
}
type Palette = Record<string, Color>;

const BIG = "extra_large" as const;
/** Top of an extra_large text element whose capitals sit on rows 3..12. */
const BIG_Y = capCentre(BIG);
const BLACK = hex("#000000");

/** x for something `w` wide at `x` in the rightward layout, mirrored for a leftward one. */
const mx = (dir: Dir, x: number, w: number) => (dir > 0 ? x : W - x - w);
/** A pixel column in the rightward layout, mirrored. */
const col = (dir: Dir, x: number) => (dir > 0 ? x : W - 1 - x);
const nameW = (p: Who) => textWidth(p.name, font(BIG));
const artW = (rows: readonly string[]) => Math.max(...rows.map((row) => row.length));

/** Pixel art from rows of characters (drawn facing right), one colour per character; mirrored when `dir` is -1. */
function art(r: Raster, rows: readonly string[], x: number, y: number, pal: Palette, dir: Dir = 1, alpha = 1): void {
  const w = artW(rows);
  rows.forEach((row, ry) =>
    [...row].forEach((ch, rx) => {
      const c = pal[ch];
      if (c) r.blend(Math.round(x) + (dir > 0 ? rx : w - 1 - rx), Math.round(y) + ry, c, alpha);
    }),
  );
}

/** Pixel art placed at `x` in the rightward layout, facing their way. */
const artFor = (p: Who, r: Raster, rows: readonly string[], x: number, y: number, pal: Palette, alpha = 1) =>
  art(r, rows, mx(p.dir, Math.round(x), artW(rows)), y, pal, p.dir, alpha);

/** A 1 px outline of a pixel-art rounded rectangle. */
function outline(r: Raster, x: number, y: number, w: number, h: number, rad: number, c: Color): void {
  r.roundRect(x, y, w, h, rad, (px, py) => {
    const lx = px - x;
    const ly = py - y;
    const inside = (a: number, b: number) => inRoundRect(a, b, w, h, rad);
    return inside(lx - 1, ly) && inside(lx + 1, ly) && inside(lx, ly - 1) && inside(lx, ly + 1) ? null : c;
  });
}

/** Fades the clock out to black. */
const toBlack = (duration: number = MOTION.base) => fade({ from: 0, to: 1, duration });
/** Fades black away, uncovering the clock. */
const fromBlack = (duration: number = MOTION.base) => fade({ from: 1, to: 0, duration });

// --- EXIT sign: into a cubicle -------------------------------------------------------------------------------------

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

/** The figure's head and shoulders, 6 × 6, to bob up over a partition (the rest is hidden behind it). */
const PEEK = ["..##..", ".####.", ".####.", "..##..", "..##..", ".####."];

/** The cubicle: a front partition `CUBE_W` wide from row `CUBE_RAIL` down, its walls `CUBE_D` deep (up and away). */
const CUBE_W = 12;
const CUBE_RAIL = 8;
const CUBE_D = 4;

/**
 * An office cubicle seen from the aisle, at `x0` in the rightward layout. "back" is what is behind whoever goes in:
 * the back wall's top rail and the monitor on the desk against it. "front" is in front of them: the outer side wall,
 * seen in perspective, and the front partition, opaque, so it hides everyone inside up to its rail. The side towards
 * the name is open: the way in.
 */
function drawCube(
  s: Raster,
  dir: Dir,
  x0: number,
  part: "back" | "front",
  c: { ink: Color; dim: Color; fabric: Color; sideFabric: Color; inside: Color; side: Color; screen: Color; note: Color },
): void {
  const put = (x: number, y: number, k: Color) => s.blend(col(dir, x0 + x), y, k);
  const top = CUBE_RAIL - CUBE_D;
  const right = CUBE_W - 1;
  if (part === "back") {
    // The back wall, in shadow, where it shows over the partition.
    for (let y = top + 1; y < CUBE_RAIL; y++) for (let x = CUBE_D; x <= right + (CUBE_RAIL - y); x++) put(x, y, c.inside);
    for (let x = CUBE_D; x <= right + CUBE_D; x++) put(x, top, c.dim);
    for (let y = top + 1; y < CUBE_RAIL; y++) put(CUBE_D, y, c.dim);
    // The monitor, against the back wall: a frame round a screen.
    for (let y = top; y < CUBE_RAIL; y++) for (let x = 7; x <= 11; x++) {
      const edge = y === top || y === CUBE_RAIL - 1 || x === 7 || x === 11;
      put(x, y, edge ? c.ink : c.screen);
    }
    return;
  }
  // The outer side wall: a parallelogram running up and away from the partition's far edge.
  for (let k = 1; k <= CUBE_D; k++) {
    for (let y = CUBE_RAIL - k; y <= H - 2 - k; y++) put(right + k, y, y === CUBE_RAIL - k || y === H - 2 - k || k === CUBE_D ? c.side : c.sideFabric);
  }
  // The front partition, opaque, with a bright top rail, and a sticky note pinned to it.
  for (let y = CUBE_RAIL; y <= H - 2; y++) for (let x = 0; x <= right; x++) {
    const edge = y === CUBE_RAIL || y === H - 2 || x === 0 || x === right;
    put(x, y, edge ? c.ink : c.fabric);
  }
  for (const [x, y] of [[8, 10], [9, 10], [8, 11], [9, 11]] as const) put(x, y, c.note);
}
const CUBE_SPAN = CUBE_W + CUBE_D;

/**
 * The EXIT sign from redirect-a, but the running figure is going somewhere: into an office cubicle on their side (it
 * runs in behind the partition, ducks down, the monitor inside comes on and its head bobs back up over the wall).
 */
function exitCube(p: Who): Clip {
  const LIT = hex("#00A050");
  const DEEP = hex("#006E36");
  const INK = hex("#F0FFF4");
  const SCREEN = hex("#8FE3FF");
  const FLICK = 0.7;
  const HOLD = 2.6;
  const DASH = 0.45;
  const SETTLE = 1.7;
  const OFF = 0.45;
  const f = font(BIG);
  // From their edge inwards: chevrons, the destination, the runner on the spot, then the name centred in what is
  // left. A wide name gets fewer chevrons, then a shorter dash.
  const destW = CUBE_SPAN;
  const layout = (n: number, dash: number) => {
    const chevW = n ? n * 5 + 1 : 0; // 9-row chevrons, 6 wide, nested 5 apart
    const destAt = W - 1 - (n ? chevW + 2 : 0) - destW;
    // Where the figure ends up: behind the partition.
    const endAt = destAt - 2;
    const runAt = endAt - dash;
    return { chevW, destAt, endAt, runAt, room: runAt - 3 };
  };
  const fits = (n: number, dash: number) => layout(n, dash).room >= nameW(p);
  const longDash = 12;
  const chevrons = [2, 1, 0].find((n) => fits(n, longDash)) ?? 0;
  let dash = longDash;
  while (dash > 2 && !fits(chevrons, dash)) dash--;
  const { chevW, destAt, endAt, runAt, room } = layout(chevrons, dash);
  const nx = mx(p.dir, 2 + Math.round((room - nameW(p)) / 2), nameW(p));
  const arrowX = mx(p.dir, W - 1 - chevW, chevW);
  const tDash = FLICK + HOLD;
  const tEnd = tDash + DASH;
  // When the monitor comes on, after they are in.
  const tOn = tEnd + 0.45;

  /** The figure at time `t`: its art, x in the rightward layout, and y. */
  const figure = (t: number): { rows: readonly string[]; x: number; y: number } => {
    const run = RUNNER[Math.floor(t * (t < tDash ? 10 : 16)) % 4]!;
    if (t < tDash) return { rows: run, x: runAt, y: 2 };
    if (t < tEnd) return { rows: run, x: lerp(runAt, endAt, inOutCubic(span(t, tDash, tEnd))), y: 2 };
    const s = t - tEnd;
    // Ducks right down behind the partition; once the monitor is on, its head bobs up over it by the open side.
    const down = Math.round(9 * inCubic(span(s, 0, 0.16)));
    const up = Math.round(8 * outBack(span(t, tOn + 0.3, tOn + 0.55), 2));
    const peekAt = destAt + (up > 0 ? 0 : 5);
    return { rows: PEEK, x: peekAt, y: 2 + down - up };
  };

  const drawBox = (s: Raster, t: number, light: number) => {
    if (light <= 0) return;
    s.roundRect(0, 0, W, H, 2, (x, y) => mix(DEEP, LIT, light * (0.85 + 0.15 * Math.sin((x + y * 2) * 0.2 + t * 3))));
    outline(s, 0, 0, W, H, 2, mix(DEEP, hex("#003A1C"), 0.5));
    const ink = mix(DEEP, INK, light);
    const dim = mix(DEEP, INK, light * 0.55);
    const panel = mix(DEEP, LIT, light * 0.92);
    s.text(p.name, f, nx, BIG_Y, ink);
    const on = outCubic(span(t, tOn, tOn + 0.3));
    const screen = mix(mix(DEEP, hex("#003A1C"), 0.6 * light), mix(DEEP, SCREEN, light), on);
    const fig = figure(t);
    // A ring of panel green around the figure keeps it apart from what it overlaps, as on the ISO sign.
    const halo = () => {
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) artFor(p, s, fig.rows, fig.x + dx, fig.y + dy, { "#": panel });
    };
    const body = () => artFor(p, s, fig.rows, fig.x, fig.y, { "#": ink });
    s.clip = { x0: 0, y0: 1, x1: W, y1: H - 1 };
    const SHADE = hex("#003A1C");
    const c = {
      ink,
      dim,
      fabric: mix(DEEP, SHADE, 0.35 * light),
      sideFabric: mix(DEEP, SHADE, 0.6 * light),
      inside: mix(DEEP, SHADE, 0.8 * light),
      side: mix(DEEP, INK, light * 0.75),
      screen,
      note: mix(DEEP, hex("#FFE04A"), light),
    };
    drawCube(s, p.dir, destAt, "back", c);
    if (on > 0) s.glow(col(p.dir, destAt + 9), 5.5, 4, 2.5, { ...SCREEN, a: 0.3 * on * light }, 1.6);
    halo();
    body();
    drawCube(s, p.dir, destAt, "front", c);
    s.clip = null;
    // Chevrons pulsing their way.
    for (let k = 0; k < chevrons; k++) {
      const b = chase(t, k, { period: 0.8, step: 0.18, decay: 0.25, floor: 0.35 });
      drawChevron(s, arrowX + (p.dir > 0 ? k * 5 : (chevrons - 1 - k) * 5), 4, 9, p.dir, mix(DEEP, ink, b));
    }
  };
  // Fluorescent start: a couple of stutters, then on.
  const flick = (t: number) => (t < 0.08 ? 0.7 : t < 0.18 ? 0 : t < 0.24 ? 0.5 : t < 0.36 ? 0 : outCubic(span(t, 0.36, FLICK)));
  const total = FLICK + HOLD + DASH + SETTLE;
  return seq(
    toBlack(MOTION.base),
    clip(total, (r, t) => {
      r.fillRect(0, 0, W, H, BLACK);
      drawBox(r, t, t < FLICK ? flick(t) : 1);
    }),
    clip(OFF, (r, t) => {
      r.fillRect(0, 0, W, H, BLACK);
      // Off: a last stutter, then the tubes die away.
      const light = t < 0.1 ? 0.4 : t < 0.16 ? 1 : Math.pow(1 - span(t, 0.16, OFF), 2);
      drawBox(r, total + t, light);
    }),
    fromBlack(0.3),
  );
}

// --- The concepts -----------------------------------------------------------------------------------------------

/** Every variant that was not chosen, built for one person. */
export function variants(p: Who): Concept[] {
  return [
    {
      id: "redirect-exit-cube",
      name: "Exit sign (cube)",
      about: "The EXIT sign flickers on with the name, the running figure and chevrons pulsing their way, but on their side there is an office cubicle instead of a doorway. The figure dashes behind its partition and ducks down out of sight; the monitor inside lights up and its head bobs back up over the wall. The sign stutters off.",
      uses: "as redirect-exit-sign (drawChevron + chase, the runner and its knock-out ring, the flicker) · new: cubicle in perspective (shaded back wall with a monitor, side wall, fabric front partition with a sticky note, which hides the figure), the figure ducking in and its head bobbing up",
      clip: exitCube(p),
    },
  ];
}

export const CONCEPTS: Concept[] = variants(PERSON);
