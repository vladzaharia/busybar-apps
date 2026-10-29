// Signs: a motorway guide sign (green panel, inset white rim, a lettered corner tab and a diagonal exit arrow), and an
// illuminated EXIT sign with its pictograms: an ISO-style figure who walks and stands, and a person sat at their desk.
// Everything is drawn facing right and mirrored for `dir` -1; lettering is never mirrored, only placed.

import { font, inkWidth } from "../font.ts";
import { span, outCubic } from "../ease.ts";
import { stamp, stampPalette } from "../jira.ts";
import { hex, inRoundRect, mix, type Color, type Raster } from "../raster.ts";
import { drawPanel, type PanelStyle } from "./backgrounds.ts";
import type { Direction } from "./arrows.ts";
import { mirrorX } from "./text.ts";

// --- Motorway sign -----------------------------------------------------------------------------------------------

/** A motorway guide sign's green, with the panel's bevel in its own greens: deep enough that a whole screen of it does
 *  not glare. */
export const ROAD_GREEN: PanelStyle = {
  top: hex("#1A7E50"),
  bottom: hex("#005A38"),
  border: hex("#003A24"),
  highlight: hex("#1A7E50"),
  shadow: hex("#005A38"),
};

/** A road sign's lettering and rim: white, a touch soft. */
export const ROAD_INK = hex("#E4ECE6");

/** A diagonal exit arrow, 6 x 6, pointing up and over to the right. */
const EXIT_ARROW = [".#####", "...###", "..####", ".###.#", "###...", "##...."];
export const EXIT_ARROW_SIZE = 6;

/** The diagonal exit arrow, top-left at (x, y), pointing up and towards `dir`. */
export function drawExitArrow(r: Raster, x: number, y: number, dir: Direction, c: Color = ROAD_INK, alpha = 1): void {
  stampPalette(r, EXIT_ARROW, Math.round(x), Math.round(y), { "#": c }, alpha, dir < 0);
}

/** A 1 px outline of a pixel-art rounded rectangle (the same corners as `roundRect`). */
export function drawOutline(r: Raster, x: number, y: number, w: number, h: number, radius: number, c: Color): void {
  r.roundRect(x, y, w, h, radius, (px, py) => {
    const lx = px - x;
    const ly = py - y;
    const inside = (a: number, b: number) => inRoundRect(a, b, w, h, radius);
    return inside(lx - 1, ly) && inside(lx + 1, ly) && inside(lx, ly - 1) && inside(lx, ly + 1) ? null : c;
  });
}

/**
 * The tiny font's G is its O with one pixel missing, and from across a room a "GO!" tab read "OO!". Tabs letter G as
 * this one instead: a top bar out to the right, the side open below it, and a bar in. On the tiny capitals' 4 rows.
 */
const TAB_G = [".###", "#...", "#.##", ".###"];

/** A tab's lettering, in the tiny font with TAB_G for G: each letter's pen x from `x`, and the ink width of the whole. */
function tabLetters(text: string, x = 0): { letters: { ch: string; x: number }[]; ink: number } {
  const tiny = font("tiny");
  const letters: { ch: string; x: number }[] = [];
  let pen = x;
  for (const ch of text) {
    letters.push({ ch, x: pen });
    pen += ch === "G" ? TAB_G[0]!.length + 1 : (tiny.glyph(ch.codePointAt(0)!)?.advance ?? 0);
  }
  // TAB_G is a column wider than the font's G, with the same column after it.
  return { letters, ink: inkWidth(text, tiny) + [...text].filter((ch) => ch === "G").length };
}

/** Where a road sign's parts go on a `width` x 16 screen, for a sign pointing `dir`. */
export interface RoadSignLayout {
  /** The lettered tab in the top corner on the `dir` side. */
  tab: { x: number; y: number; width: number; height: number };
  /** The exit arrow's top-left, under the tab. */
  arrow: { x: number; y: number };
  /** The columns a name may ink, first and last: 3 px clear of the rim and of the tab. Centre a name in them. */
  room: { x0: number; x1: number };
}

/** A road sign's layout (see `drawRoadSign`): measure the name against `room` before placing it. */
export function roadSignLayout(o: { tab: string; dir: Direction; width?: number }): RoadSignLayout {
  const W = o.width ?? 72;
  const tabW = tabLetters(o.tab).ink + 4;
  const tabR = W - 2 - tabW;
  const arrowR = W - 3 - EXIT_ARROW_SIZE - 2;
  // The rim is the inset outline at column 1 (and W - 2); a name keeps 3 px clear of it and of the tab.
  const x0 = 1 + 1 + 3;
  const x1 = tabR - 4;
  const room = o.dir > 0 ? { x0, x1 } : { x0: W - 1 - x1, x1: W - 1 - x0 };
  return { tab: { x: mirrorX(tabR, tabW, o.dir, W), y: 1, width: tabW, height: 6 }, arrow: { x: mirrorX(arrowR, EXIT_ARROW_SIZE, o.dir, W), y: 8 }, room };
}

/**
 * A motorway guide sign filling the screen: the green panel with its sheen running towards `dir` (at `sheen`, an x
 * position; omit for none), an inset rim, a lettered tab in the top corner on the `dir` side and the exit arrow under
 * it, nudged `nudge` px up and over. The name is the caller's: centre it on its ink in `roadSignLayout(...).room`.
 */
export function drawRoadSign(r: Raster, o: { tab: string; dir: Direction; sheen?: number; nudge?: number; style?: PanelStyle; ink?: Color }): void {
  const W = r.width;
  const ink = o.ink ?? ROAD_INK;
  const style = o.style ?? ROAD_GREEN;
  const l = roadSignLayout({ tab: o.tab, dir: o.dir, width: W });
  drawPanel(r, { style, radius: 2, sheen: o.sheen, sheenDir: o.dir });
  drawOutline(r, 1, 1, W - 2, r.height - 2, 2, ink);
  r.fillRect(l.tab.x, l.tab.y, l.tab.width, l.tab.height, ink);
  const tiny = font("tiny");
  // TAB_G on the tiny capitals' rows, which start a row below the top of their text element.
  const capY = l.tab.y + 1;
  for (const { ch, x } of tabLetters(o.tab, l.tab.x + 2).letters) {
    if (ch === "G") stamp(r, TAB_G, x, capY, style.bottom);
    else r.text(ch, tiny, x, l.tab.y, style.bottom);
  }
  const n = Math.round(o.nudge ?? 0);
  drawExitArrow(r, l.arrow.x + o.dir * n, l.arrow.y - n, o.dir, ink);
}

// --- EXIT sign ---------------------------------------------------------------------------------------------------

/** An illuminated EXIT sign's colours: lit and unlit green (lit, not glaring as a whole screen), the pictograms'
 *  white, the rim's shade, a monitor's glow. */
export const EXIT_SIGN = {
  lit: hex("#008E47"),
  deep: hex("#006E36"),
  ink: hex("#F0FFF4"),
  shade: hex("#003A1C"),
  screen: hex("#8FE3FF"),
} as const;

/** Below this much light the tubes are going out: the sign darkens towards black with them (see `exitInk`). */
const EXIT_OUT = 0.25;
const BLACK = hex("#000000");

/** `c` on a sign whose tubes give `power` light: itself from EXIT_OUT up, darkening to black below it. */
const powered = (c: Color, power: number): Color => (power >= EXIT_OUT ? c : mix(BLACK, c, Math.max(0, power) / EXIT_OUT));

/**
 * The EXIT sign's lit box over (x, y, width, height), at `light` 0..1 (0 draws nothing): green with a slow shimmer
 * moving through it at time `t`, and a dark rim. Down to EXIT_OUT it is the unlit sign's green; below that it darkens
 * to black with the light, so a sign going out fades over its last frames instead of dropping from green to black.
 */
export function drawExitPanel(r: Raster, light: number, t: number, o: { x?: number; y?: number; width?: number; height?: number } = {}): void {
  if (light <= 0) return;
  const x = o.x ?? 0;
  const y = o.y ?? 0;
  const w = o.width ?? r.width;
  const h = o.height ?? r.height;
  const { lit, deep, shade } = EXIT_SIGN;
  r.roundRect(x, y, w, h, 2, (px, py) => powered(mix(deep, lit, light * (0.85 + 0.15 * Math.sin((px + py * 2) * 0.2 + t * 3))), light));
  drawOutline(r, x, y, w, h, 2, powered(mix(deep, shade, 0.5), light));
}

/**
 * A colour on the EXIT sign: `c` at `level` 0..1, back to the unlit green at 0, on a sign whose tubes give `power`
 * light (by default `level`; pass the sign's light when `level` is a part of it, a dim chair or a resting chevron).
 * Like the panel, it darkens to black as the power goes out.
 */
export const exitInk = (level: number, c: Color = EXIT_SIGN.ink, power = level) => powered(mix(EXIT_SIGN.deep, c, level), power);

/**
 * A fluorescent tube coming on over `duration` s: a couple of stutters, then up. 0..1 at time `t`. Between stutters
 * the sign is unlit (EXIT_OUT: its unlit green) rather than out: it never drops from lit to nothing in one frame.
 */
export function exitFlickerOn(t: number, duration = 0.7): number {
  const k = t / duration;
  const glow = EXIT_OUT;
  if (k < 0.11) return 0.7;
  if (k < 0.26) return glow;
  if (k < 0.34) return 0.5;
  if (k < 0.51) return glow;
  return glow + (1 - glow) * outCubic(span(k, 0.51, 1));
}

/** The tubes going off over `duration` s: a last stutter, then dying away. 1..0 at time `t`. */
export function exitFlickerOff(t: number, duration = 0.45): number {
  const k = t / duration;
  if (k < 0.22) return 0.4;
  if (k < 0.36) return 1;
  return Math.pow(1 - span(k, 0.36, 1), 2);
}

// --- Pictograms --------------------------------------------------------------------------------------------------

/** A pictogram figure is 10 px wide (its stride; it stands 6 wide) and 13 tall. */
export const PICTO_SIZE = { width: 10, height: 13 } as const;

// The ISO figure walking, facing right: a step, passing, the other step, passing.
const PICTO_WALK = [
  ["......##..", ".....####.", ".....####.", "......##..", ".....###..", "....#####.", "...#.###.#", "...#.###..", ".....###..", "....##.##.", "....#...#.", "...##...##", "...#......"],
  ["......##..", ".....####.", ".....####.", "......##..", ".....###..", ".....####.", "....#####.", ".....###..", ".....###..", ".....###..", ".....##...", ".....#.#..", ".....#.##."],
  ["......##..", ".....####.", ".....####.", "......##..", ".....###..", "....#####.", "...#.###.#", "...#.###..", ".....###..", "....##.##.", "...##...#.", "...#....##", "..##......"],
  ["......##..", ".....####.", ".....####.", "......##..", ".....###..", ".....####.", "....#####.", ".....###..", ".....###..", ".....####.", ".....#.#..", "....##.#..", ".......##."],
];
// Standing, arms at its sides; its ink is columns 4..8.
const PICTO_STAND = ["......##..", ".....####.", ".....####.", "......##..", ".....###..", "....#####.", "....#####.", "....#.###.", "....#.###.", ".....###..", ".....#.#..", ".....#.#..", ".....#.##."];

/** A pictogram figure's pose: a walking frame 0..3, or standing. */
export type PictoPose = 0 | 1 | 2 | 3 | "stand";

/** The walking frame at time `t`, a step every `step` seconds (a walk, not a run: 0.2 s and up). */
export const pictoStep = (t: number, step = 0.22) => (Math.floor(t / step) % 4) as 0 | 1 | 2 | 3;

/** Columns of the figure's 10 px box its ink covers when it stands: first and last. */
export const PICTO_STAND_INK = { x0: 4, x1: 8 } as const;

/**
 * Draws pixel art in one colour (`#`) with an optional knock-out `halo`: the sign's own colour in a ring round it, as
 * the ISO signs keep a figure apart from what it overlaps. `d` pixels take `dim`, `m` take `screen`.
 */
function drawSignArt(r: Raster, art: readonly string[], x: number, y: number, flip: boolean, o: { ink: Color; dim?: Color; screen?: Color; halo?: Color }): void {
  const ink = { "#": o.ink, d: o.dim ?? o.ink, m: o.screen ?? o.ink };
  if (o.halo) {
    const ring = { "#": o.halo, d: o.halo, m: o.halo };
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) stampPalette(r, art, x + dx, y + dy, ring, 1, flip);
  }
  stampPalette(r, art, x, y, ink, 1, flip);
}

/** The ISO figure, top-left of its 10 x 13 box at (x, y), facing `dir`, walking or standing. */
export function drawPictogram(r: Raster, x: number, y: number, dir: Direction, pose: PictoPose, o: { ink: Color; halo?: Color }): void {
  drawSignArt(r, pose === "stand" ? PICTO_STAND : PICTO_WALK[pose]!, Math.round(x), Math.round(y), dir < 0, o);
}

/** The person at their desk is 17 px wide and 12 tall. */
export const DESK_SIZE = { width: 17, height: 12 } as const;

// Facing left: the desk's near end bare over a pedestal of drawers, the monitor at its far end (screen `m`), and the
// person sat behind it on an office chair (`d`, dimmer), looking across the desk at whoever comes to it.
const PERSON_AT_DESK = [
  "............##...",
  ".....#####.####..",
  ".....#mmm#.####..",
  ".....#mmm#..##..d",
  ".....#####.###..d",
  ".......#.##.####d",
  "###########.###.d",
  ".####....#######d",
  ".#..#....##.ddd..",
  ".####....##...d..",
  ".#..#....##...d..",
  ".####...###.ddddd",
];

/**
 * Someone sat at their desk with a monitor on it, 17 x 12, top-left at (x, y), looking towards `facing` across the
 * desk (the desk is on that side of them). `screen` lights the monitor; `dim` is the chair.
 */
export function drawPersonAtDesk(r: Raster, x: number, y: number, facing: Direction, o: { ink: Color; dim?: Color; screen?: Color; halo?: Color }): void {
  drawSignArt(r, PERSON_AT_DESK, Math.round(x), Math.round(y), facing > 0, o);
}
