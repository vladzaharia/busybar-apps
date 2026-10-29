// Vehicles: a delivery van with a cargo box to letter, a little train (an engine pulling flatcars on a rail), and a
// paper plane that can tow a banner. Each is drawn facing right and mirrored for `dir` -1; lettering on them is the
// caller's, never mirrored.

import { lerp } from "../ease.ts";
import { stampPalette } from "../jira.ts";
import { fillPolygon, hex, mix, Raster, type Color } from "../raster.ts";
import type { Direction } from "./arrows.ts";

// --- Delivery van ------------------------------------------------------------------------------------------------

/** The van's cab is 11 px long; the van is cargo + 1 + 11 long and 16 tall. */
export const VAN_CAB = 11;
export const vanWidth = (cargo: number) => cargo + 1 + VAN_CAB;

/** The van's colours: a brown body with a gold trim, blue glass, grey tyres. */
export const VAN_COLORS = {
  body: hex("#6B4423"),
  dark: hex("#4A2E16"),
  trim: hex("#7E5528"),
  glass: hex("#62C7FF"),
  tyre: hex("#555B66"),
  hub: hex("#C9D2E0"),
  headlight: hex("#FFF2C0"),
  indicator: hex("#FF9A1F"),
  tail: hex("#FF3B30"),
} as const;

/**
 * A delivery van, `vanWidth(cargo)` long and 16 tall, its left edge at `x`, driving towards `dir`. The cargo box is
 * rows 1..13 (a trim on row 1), the wheels show under it on rows 14..15, turning when `moving` (`t` turns them), and
 * `blink` lights the indicator. Returns the cargo box's side, where the caller letters it (caps on rows 3..12 sit with a
 * row of box above and below).
 */
export function drawVan(
  r: Raster,
  x: number,
  o: { cargo: number; dir: Direction; t?: number; moving?: boolean; blink?: boolean; y?: number },
): { x: number; y: number; width: number; height: number } {
  const c = VAN_COLORS;
  const box = o.cargo;
  const w = vanWidth(box);
  const H = 16;
  const s = new Raster(w, H);
  const t = o.t ?? 0;
  const wheel = (wx: number) => {
    s.roundRect(wx, 13, 4, 3, 1, c.tyre);
    const spin = o.moving ? Math.floor(t * 12) % 2 : 0;
    s.fillRect(wx + 1 + spin, 14, 1, 1, c.hub);
    s.fillRect(wx + 2 - spin, 14, 1, 1, c.hub);
  };
  // Wheels first: the body sits down over their top row.
  wheel(2);
  wheel(box - 6);
  wheel(box + 1 + VAN_CAB - 6);
  s.roundRect(0, 1, box, 13, 1, (_x, y) => (y === 1 ? c.trim : y === 13 ? mix(c.body, c.dark, 0.5) : c.body));
  // The cab: a slanted windscreen at the front, joined to the box.
  const cab = box + 1;
  s.fillRect(box, 4, 1, 10, c.dark);
  for (let y = 4; y <= 13; y++) {
    const slant = y < 8 ? 8 - y : 0;
    for (let k = 0; k < VAN_CAB - slant; k++) s.blend(cab + k, y, y === 4 ? c.trim : y === 13 ? c.dark : c.body);
  }
  for (let y = 5; y <= 7; y++) for (let k = 4; k < VAN_CAB - (8 - y) - 1; k++) s.blend(cab + k, y, c.glass);
  s.fillRect(cab + VAN_CAB - 1, 9, 1, 2, c.headlight);
  if (o.blink) s.fillRect(cab + VAN_CAB - 1, 11, 1, 1, c.indicator).glow(cab + VAN_CAB - 0.5, 11.5, 2.5, 2, { ...c.indicator, a: 0.6 }, 1.4);
  s.fillRect(0, 10, 1, 2, c.tail);
  // Facing left, the van is mirrored as a whole.
  const out = o.dir > 0 ? s : flipped(s);
  const left = Math.round(x);
  const top = Math.round(o.y ?? 0);
  r.draw(out, left, top);
  return { x: o.dir > 0 ? left : left + w - box, y: top + 1, width: box, height: 13 };
}

/** A raster mirrored left to right. */
function flipped(s: Raster): Raster {
  const out = new Raster(s.width, s.height);
  for (let y = 0; y < s.height; y++) {
    for (let x = 0; x < s.width; x++) {
      const i = (y * s.width + x) * 4;
      const j = (y * s.width + (s.width - 1 - x)) * 4;
      for (let k = 0; k < 4; k++) out.data[j + k] = s.data[i + k]!;
    }
  }
  return out;
}

// --- Little train ------------------------------------------------------------------------------------------------

// The engine, facing right: the cab at the back, the boiler and chimney, a cowcatcher; its wheels are drawn on top.
const ENGINE = [
  ".........kkkk..",
  "RRRRRRR...kk...",
  ".OOOOO....kk...",
  ".OcccO....kk...",
  ".OcccO..dd.....",
  ".OcccOBBBBBBBB.",
  ".OOOOObbbbbbbbf",
  ".OOOOOBBrBBrBBy",
  ".OOOOOBBrBBrBBf",
  ".OOOOOBBrBBrBBf",
  ".OOOOOBBBBBBBBfg",
  "FFFFFFFFFFFFFFgg",
];
const ENGINE_PAL: Record<string, Color> = {
  k: hex("#8A93A3"),
  R: hex("#A8461A"),
  O: hex("#FF7A33"),
  c: hex("#62C7FF"),
  d: hex("#FFD166"),
  B: hex("#E5602A"),
  b: hex("#FFB27F"),
  r: hex("#B84A16"),
  y: hex("#FFE08A"),
  f: hex("#A8461A"),
  g: hex("#8A93A3"),
  F: hex("#4A505A"),
};
const WHEEL = hex("#8A93A3");
const WHEEL_DARK = hex("#3A3F48");

/** The engine is 16 px long and 15 tall (its wheels on rows 12..14 under it); its chimney top is at x + 9..12. */
export const ENGINE_SIZE = { width: 16, height: 15 } as const;

/**
 * The engine, top-left at (x, y), facing `dir`. `travel` (px it has come) turns the drive wheels, with a spoke going
 * round and the coupling rod between them.
 */
export function drawEngine(r: Raster, x: number, y: number, dir: Direction, travel = 0): void {
  const X = Math.round(x);
  const Y = Math.round(y);
  const W = ENGINE_SIZE.width;
  stampPalette(r, ENGINE, X, Y, ENGINE_PAL, 1, dir < 0);
  /** Column `cx` of the engine (facing right), on screen. */
  const col = (cx: number) => (dir > 0 ? X + cx : X + W - 1 - cx);
  const ang = (travel / 1.5) % (Math.PI * 2);
  for (const wx of [1, 6]) {
    for (let dy = 0; dy < 3; dy++) for (let dx = 0; dx < 3; dx++) r.blend(col(wx + dx), Y + 12 + dy, dx === 1 && dy === 1 ? WHEEL_DARK : WHEEL);
    r.blend(col(wx + 1 + Math.round(Math.cos(ang))), Y + 13 + Math.round(Math.sin(ang)), hex("#E6EAF0"));
  }
  r.blend(col(11), Y + 13, WHEEL);
  r.blend(col(12), Y + 13, WHEEL);
  r.blend(col(11), Y + 14, WHEEL_DARK);
  r.blend(col(12), Y + 14, WHEEL);
  const rod = Math.round(Math.sin(travel / 1.5));
  for (let k = 2; k <= 7; k++) r.blend(col(k), Y + 13 + rod, hex("#B8C2D0"));
}

/** The flatcars' deck colours: a light top and a darker side. */
export const FLATCAR = { top: hex("#579DFF"), side: hex("#1D7AFC") } as const;

/**
 * A flatcar `width` long, its deck on rows y and y + 1 and two wheels under it on row y + 2, its left edge at `x`.
 * `travel` turns the wheels. A letter it carries sits on the deck with a clear row between (caps ending at y - 2).
 */
export function drawFlatcar(r: Raster, x: number, y: number, width: number, travel = 0): void {
  const X = Math.round(x);
  r.fillRect(X, y, width, 1, FLATCAR.top);
  r.fillRect(X, y + 1, width, 1, FLATCAR.side);
  const spin = Math.floor((travel + 1000) / 1.5) % 2;
  for (const wx of [X + 1, X + width - 3]) {
    r.blend(wx, y + 2, spin ? WHEEL : WHEEL_DARK);
    r.blend(wx + 1, y + 2, spin ? WHEEL_DARK : WHEEL);
  }
}

/** A coupling between two cars: one dark pixel at (x, y). */
export const drawCoupling = (r: Raster, x: number, y: number) => r.blend(Math.round(x), y, WHEEL_DARK);

/** The rail along row `y`, with sleepers every 4 px that slide past as the train moves (`offset`, px). */
export function drawRails(r: Raster, y: number, offset = 0): void {
  for (let x = 0; x < r.width; x++) r.blend(x, y, (((x - Math.round(offset)) % 4) + 4) % 4 === 0 ? hex("#7A6650") : hex("#4A3F33"));
}

/**
 * A puff of steam centred on (cx, cy) at `age` 0..1 of its life: round, growing and thinning out; `big` for the one
 * an engine lets off when it stops. `alpha` thins it further (steam that has drifted back over the cab).
 */
export function drawPuff(r: Raster, cx: number, cy: number, age: number, big = false, alpha = 1): void {
  if (age < 0 || age > 1) return;
  const rad = (big ? 2.2 : 1.5) + age * (big ? 1.6 : 1.2);
  for (let y = Math.floor(cy - rad); y <= Math.ceil(cy + rad); y++) {
    for (let x = Math.floor(cx - rad); x <= Math.ceil(cx + rad); x++) {
      const d = Math.hypot(x + 0.5 - cx, (y + 0.5 - cy) * 1.2);
      if (d < rad) r.blend(x, y, hex("#D8E0EA"), alpha * (1 - age) * (big ? 0.95 : 0.85) * Math.max(0, Math.min(1, rad - d + 0.3)));
    }
  }
}

// --- Paper plane -------------------------------------------------------------------------------------------------

/** A paper plane's colours: the near wing's paper, and the far wing folded under it, darker. */
export const PAPER = { paper: hex("#E4ECF6"), fold: hex("#7F95B3") } as const;

/** The plane, nose along +x, around its middle: the near wing over the far one. About 11 x 7. */
const PLANE_NEAR: [number, number][] = [[5.5, 0], [-5, -3.5], [-2, 0.6]];
const PLANE_FAR: [number, number][] = [[5.5, 0], [-2, 0.6], [-4, 3]];
/** How far the plane's nose and tail are from its middle. */
export const PLANE_REACH = { nose: 5.5, tail: 5 } as const;

/**
 * A paper plane centred on (x, y), heading `angle` radians from flying towards `dir` (positive turns it nose down, as
 * the screen's y grows downwards; mirrored with it). Drawn as a shape, so it turns smoothly through a loop.
 */
export function drawPaperPlane(r: Raster, x: number, y: number, angle: number, dir: Direction, alpha = 1): void {
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const place = (pts: [number, number][]) => pts.map(([px, py]): [number, number] => [x + dir * (px * cos - py * sin), y + px * sin + py * cos]);
  fillPolygon(r, place(PLANE_FAR), PAPER.fold, alpha);
  fillPolygon(r, place(PLANE_NEAR), PAPER.paper, alpha);
}

/** A towed banner's cloth: amber with a lighter top hem and a darker bottom one. */
export const BANNER = { cloth: hex("#FFB020"), fold: hex("#C98400"), hem: hex("#FFD27A"), edge: hex("#8A5A00") } as const;

/**
 * A cloth banner towed towards `dir`, spanning columns `left`..`right` of the rightward layout (mirrored for `dir` -1)
 * on rows `top`..`top + height - 1`. Its free end is cut in a swallow-tail that flaps, a soft ripple of shade runs down
 * it at time `t`, and its leading edge is a dark pole. Letter it inside 1 px of hem top and bottom, 4 px from the tail.
 */
export function drawBanner(r: Raster, o: { left: number; right: number; top: number; height: number; dir: Direction; t: number }): void {
  if (o.right <= o.left + 0.5) return;
  const mid = o.top + o.height / 2 - 0.5;
  const flap = Math.sin(o.t * 11) > 0 ? 1 : 0;
  const x0 = Math.floor(o.left);
  const x1 = Math.ceil(o.right);
  for (let x = x0; x < x1; x++) {
    const fromTail = x - x0;
    const wave = Math.sin(o.t * 9 - x * 0.55);
    for (let y = o.top; y < o.top + o.height; y++) {
      const depth = Math.max(0, 2 + flap - Math.floor(Math.abs(y - mid)));
      if (fromTail < depth) continue;
      let c = mix(BANNER.cloth, BANNER.fold, 0.1 + 0.1 * wave);
      if (y === o.top) c = mix(c, BANNER.hem, 0.5);
      if (y === o.top + o.height - 1) c = mix(c, BANNER.edge, 0.5);
      if (x === x1 - 1) c = BANNER.edge;
      r.blend(o.dir > 0 ? x : r.width - 1 - x, y, c);
    }
  }
}

/** A thin line between two points (a tow rope, a trail). */
export function drawLine(r: Raster, x0: number, y0: number, x1: number, y1: number, c: Color, alpha = 1): void {
  const n = Math.max(1, Math.ceil(Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0))));
  for (let i = 0; i <= n; i++) r.blend(lerp(x0, x1, i / n), lerp(y0, y1, i / n), c, alpha);
}
