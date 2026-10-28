// Arrows and wayfinding: chevrons, solid arrows and triangles drawn on the pixel grid, and clips that point the way
// (a chase of chevrons, a nudging arrow, a band of chevrons and a word streaming past).

import { font, textWidth, type FontName } from "../font.ts";
import { hex, mix, type Color, type Raster } from "../raster.ts";
import { clip, type Clip } from "../timeline.ts";
import { capCentre } from "./text.ts";

/** Which way an arrow points: 1 to the right, -1 to the left. */
export type Direction = 1 | -1;

const WHITE = hex("#FFFFFF");

/** Width of a chevron `h` rows tall. */
export const chevronWidth = (h: number) => Math.ceil((h - 1) / 2) + 2;

/** A chevron (> or <), `h` rows tall and 2 px thick, pointing towards `dir`; (x, y) is its top-left. */
export function drawChevron(r: Raster, x: number, y: number, h: number, dir: Direction, c: Color, alpha = 1): void {
  const half = (h - 1) / 2;
  const w = chevronWidth(h);
  for (let i = 0; i < h; i++) {
    const off = Math.round(half - Math.abs(i - half));
    for (let k = 0; k < 2; k++) r.blend(x + (dir > 0 ? off + k : w - 1 - off - k), y + i, c, alpha);
  }
}

/** The solid arrow is 13 px square. */
export const ARROW_SIZE = 13;

/** A solid arrow, 13 px square: a 5-row shaft into a 7-column head, with a lighter top edge. */
export function drawArrow(r: Raster, x: number, y: number, dir: Direction, body: Color, light: Color = body, alpha = 1): void {
  const put = (cx: number, cy: number, c: Color) => r.blend(x + (dir > 0 ? cx : 12 - cx), y + cy, c, alpha);
  for (let cx = 0; cx < 6; cx++) for (let cy = 4; cy <= 8; cy++) put(cx, cy, cy === 4 ? light : body);
  for (let c = 0; c < 7; c++) for (let cy = c; cy <= 12 - c; cy++) put(6 + c, cy, cy === c ? light : body);
}

/** A small arrow, 10 wide and 9 tall, for inside a sign or a box. */
export function drawSmallArrow(r: Raster, x: number, y: number, dir: Direction, c: Color, alpha = 1): void {
  const put = (cx: number, cy: number) => r.blend(x + (dir > 0 ? cx : 9 - cx), y + cy, c, alpha);
  for (let cx = 0; cx < 4; cx++) for (let cy = 3; cy <= 5; cy++) put(cx, cy);
  for (let k = 0; k < 5; k++) for (let cy = k; cy <= 8 - k; cy++) put(4 + k, cy);
}

/** A solid triangle (▶ or ◀), 4 wide and 7 tall. */
export function drawTriangle(r: Raster, x: number, y: number, dir: Direction, c: Color, alpha = 1): void {
  for (let col = 0; col < 4; col++) for (let cy = col; cy <= 6 - col; cy++) r.blend(x + (dir > 0 ? col : 3 - col), y + cy, c, alpha);
}

/**
 * Brightness 0..1 of item `k` in a chase running from item 0 to the last, `period` seconds a lap: each lights in
 * turn and fades as the light moves on, like sequenced runway lights. `floor` keeps unlit items faintly visible.
 */
export function chase(t: number, k: number, o: { period?: number; step?: number; decay?: number; floor?: number } = {}): number {
  const period = o.period ?? 0.72;
  const age = (((t - k * (o.step ?? 0.13)) % period) + period) % period;
  return Math.max(o.floor ?? 0.15, Math.exp(-age / (o.decay ?? 0.16)));
}

/**
 * Chevrons lighting up one after another towards `dir`, over and over: the "this way" of runway lights and
 * motorway signs. (x, y) is the top-left of the row; `count` chevrons `height` tall, `gap` px apart.
 */
export function chevronChase(o: {
  duration: number;
  x: number;
  y: number;
  dir: Direction;
  count?: number;
  height?: number;
  gap?: number;
  lit?: Color;
  dim?: Color;
  glow?: boolean;
}): Clip {
  const count = o.count ?? 4;
  const h = o.height ?? 11;
  const cw = chevronWidth(h);
  const gap = o.gap ?? 7;
  const lit = o.lit ?? hex("#FFB020");
  const dim = o.dim ?? mix(hex("#000000"), lit, 0.25);
  return clip(o.duration, (r, t) => {
    for (let k = 0; k < count; k++) {
      const b = chase(t, k);
      // k = 0 is the first to light: the one farthest from where the chevrons point.
      const x = o.dir > 0 ? o.x + k * gap : o.x + (count - 1 - k) * gap;
      drawChevron(r, x, o.y, h, o.dir, mix(dim, lit, b));
      if (o.glow !== false && b > 0.4) r.glow(x + cw / 2, o.y + h / 2, 3, 4, { ...lit, a: 0.35 * b }, 1.4);
    }
  });
}

/** A solid arrow at (x, y) that nudges `distance` px towards `dir` every `every` seconds, like pointing "over there". */
export function arrowNudge(o: { duration: number; x: number; y: number; dir: Direction; every?: number; distance?: number; body?: Color; light?: Color }): Clip {
  const body = o.body ?? hex("#2F86FF");
  const light = o.light ?? hex("#9CC6FF");
  return clip(o.duration, (r, t) => {
    const q = (t % (o.every ?? 1)) / 0.42;
    const dx = q < 1 ? o.dir * (o.distance ?? 3) * Math.sin(q * Math.PI) : 0;
    const ax = Math.round(o.x + dx);
    // A short streak behind it while it moves.
    if (Math.abs(dx) > 1.5) for (let k = 1; k <= 3; k++) r.fillRect(ax - o.dir * k * 3 + (o.dir > 0 ? 0 : 12), o.y + 5, 2, 1, { ...body, a: 0.5 - k * 0.14 });
    drawArrow(r, ax, o.y, o.dir, body, light);
  });
}

/**
 * A band streaming towards `dir`: groups of chevrons alternating with `text`, repeating, like a moving-walkway sign.
 * Each group brightens towards its tip with a shimmer running through, and speed lines race along the top and bottom
 * rows. `lead(t)` is how far the band's front has travelled onto the screen, in px (default: `speed` px/s from 0),
 * so a scene can push something off ahead of it or speed it away.
 */
export function scrollBand(o: {
  duration: number;
  text: string;
  dir: Direction;
  font?: FontName;
  y?: number;
  speed?: number;
  lead?: (t: number) => number;
  ramp?: [Color, Color, Color];
  color?: Color;
  lines?: Color;
  alpha?: (t: number) => number;
}): Clip {
  const f = font(o.font ?? "extra_large");
  const ramp = o.ramp ?? [hex("#123A78"), hex("#2F86FF"), hex("#A9D0FF")];
  const H_CH = 11;
  const cw = chevronWidth(H_CH);
  const STEP = 6;
  const groupW = cw + STEP * 2;
  const nw = textWidth(o.text, f);
  const GAP = 7;
  const unit = nw + GAP + groupW + GAP;
  const lead = o.lead ?? ((t: number) => t * (o.speed ?? 30));
  return clip(o.duration, (r, t) => {
    const W = r.width;
    const d = lead(t);
    const a = o.alpha?.(t) ?? 1;
    // Band coordinate u (px behind the front) to screen x.
    const at = (u: number) => (o.dir > 0 ? d - u : W - d + u);
    const y = o.y ?? 2;
    for (let k = Math.max(0, Math.floor((d - W) / unit) - 1); k * unit <= d + unit; k++) {
      const groupLead = k * unit + GAP;
      for (let i = 0; i < 3; i++) {
        const tip = groupLead + i * STEP; // i = 0: the frontmost chevron
        const x = o.dir > 0 ? at(tip) - cw : at(tip);
        const shimmer = Math.exp(-(((((t * 2.2 - i * 0.18 - k * 0.3) % 1) + 1) % 1) / 0.12));
        drawChevron(r, Math.round(x), y, H_CH, o.dir, mix(ramp[2 - i]!, WHITE, 0.6 * shimmer), a);
      }
      const nameLead = groupLead + groupW + GAP;
      const nx = o.dir > 0 ? at(nameLead) - nw : at(nameLead);
      if (nx > -nw && nx < W) r.text(o.text, f, Math.round(nx), capCentre(o.font ?? "extra_large", r.height), o.color ?? WHITE, () => ({ alpha: a }));
    }
    // Speed lines on the edge rows, twice as fast, only where the band has arrived.
    const lines = o.lines ?? ramp[1];
    for (let k = 0; k < 9; k++) {
      for (const row of [0, r.height - 1]) {
        const len = 3 + ((k * 7 + row) % 4);
        const u = ((d * 2 + k * 23 + row * 11) % (W + 20)) - 10;
        const x = o.dir > 0 ? u : W - u - len;
        if (o.dir > 0 ? x < d : x + len > W - d) r.fillRect(Math.round(x), row, len, 1, { ...lines, a: 0.45 * a });
      }
    }
  });
}
