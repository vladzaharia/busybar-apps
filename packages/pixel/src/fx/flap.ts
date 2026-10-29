// Split-flap displays, as on a station's departure board: dark tiles split across by their hinge, letters that
// clatter through the drum in order and stop on theirs, and a picture flap (an airline's logo) that turns through
// faces. The tiles come on left to right as the board switches on.

import { inOutCubic, rng, span } from "../ease.ts";
import type { FontName } from "../font.ts";
import { hex, Raster, type Color } from "../raster.ts";
import { MOTION } from "../motion.ts";
import { clip, type Clip } from "../timeline.ts";
import { roll } from "./text.ts";

/** A tile: as bright as a progress bar's track, so it still shows on the LEDs. */
export const FLAP_TILE = hex("#262C38");
/** The hinge across the middle of a tile. */
export const FLAP_HINGE = hex("#0A0C10");
/** The board's letters: amber, like the boards in stations. */
export const FLAP_LETTER = hex("#FFB020");
/** What a letter flap turns through, in order: it passes every one between where it was and where it stops. */
export const FLAP_DRUM = " ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789?!.,";

/** Seconds each tile takes to come on as the board switches on. */
const TILE_ON = 0.12;

/**
 * How far a tile whose left edge is at `x` has come on at `t`: the tiles light up left to right across `width` px,
 * all of them within `sweep` seconds.
 */
export function flapTileOn(t: number, x: number, width = 72, sweep: number = MOTION.base): number {
  const at = (Math.max(0, x) / width) * (sweep - TILE_ON);
  return span(t, at, at + TILE_ON);
}

/** A tile at (x, y), `w` × `h`, with its hinge across the middle. `alpha` fades it in. */
export function drawFlapTile(r: Raster, x: number, y: number, w: number, h: number, alpha = 1): void {
  if (alpha <= 0) return;
  r.fillRect(x, y, w, h, { ...FLAP_TILE, a: alpha });
  r.fillRect(x, y + Math.floor(h / 2), w, 1, { ...FLAP_HINGE, a: alpha });
}

/** A board, with `settled`: when its last letter stops. */
export interface FlapBoard extends Clip {
  readonly settled: number;
}

/**
 * A board of letter flaps: `lines[i]` on the row whose top is `rows[i]`, one letter per tile, `cols` tiles from `x`.
 * The tiles come on left to right, then from `start` every flap turns through the drum: the letters stop one after
 * another in reading order, `flip` seconds apart; the blank flaps stop at random in between. Lasts `duration`
 * (default: until a second after the last letter stops).
 */
export function flapBoard(o: {
  lines: string[];
  x: number;
  rows: number[];
  cols: number;
  /** Tile size; the default suits the small font. */
  cell?: { width: number; height: number };
  /** Left edge to left edge. */
  pitch?: number;
  font?: FontName;
  color?: Color;
  start?: number;
  flip?: number;
  seed?: number;
  duration?: number;
}): FlapBoard {
  const cell = o.cell ?? { width: 5, height: 7 };
  const pitch = o.pitch ?? cell.width + 1;
  const name = o.font ?? "small";
  const color = o.color ?? FLAP_LETTER;
  const start = o.start ?? MOTION.base;
  const flip = o.flip ?? 0.07;
  const rand = rng(o.seed ?? 9);
  let k = 0;
  let last = start;
  const cells = o.rows.flatMap((y, row) =>
    Array.from({ length: o.cols }, (_, col) => {
      const ch = o.lines[row]?.[col] ?? " ";
      // A letter stops in turn; a blank stops whenever, but not before the first letters have started turning.
      const settle = ch === " " ? start + 0.2 + rand() * 0.9 : start + 0.35 + k++ * flip;
      last = Math.max(last, settle);
      const n = Math.max(2, Math.round((settle - start) / flip));
      const target = Math.max(0, FLAP_DRUM.indexOf(ch));
      const words: { text: string; font: FontName; hold: number }[] = [{ text: " ", font: name, hold: Math.max(0, settle - n * flip) }];
      for (let j = 0; j < n; j++) words.push({ text: FLAP_DRUM[(target - n + j + FLAP_DRUM.length * 8) % FLAP_DRUM.length]!, font: name, hold: flip });
      words.push({ text: ch, font: name, hold: 3600 });
      return { x: o.x + col * pitch, y, roll: roll({ words, box: { x: 0, width: cell.width, height: cell.height }, rollTime: flip * 0.7, color: () => color }) };
    }),
  );
  // The last flap stops at `last` and settles with a little hop.
  const settled = last + 0.2;
  const board = clip(o.duration ?? settled + 1, (r, t) => {
    for (const c of cells) {
      const on = flapTileOn(t, c.x, r.width);
      if (on <= 0) continue;
      drawFlapTile(r, c.x, c.y, cell.width, cell.height, on);
      const l = new Raster(cell.width, cell.height);
      c.roll.draw(l, Math.min(t, c.roll.duration));
      r.draw(l, c.x, c.y, on);
    }
  });
  return { ...board, settled };
}

/** A picture flap, with `landed`: when it stops on its last face. */
export interface FlapFaces extends Clip {
  readonly landed: number;
}

/**
 * A picture flap: a `width` × `height` tile at (x, y) that comes on with the board, then from `at` turns through
 * `faces` one after another, `flip` seconds each (the old face leaving upward as the new one rises), and stops on the
 * last. Each face is drawn on its own `width` × `height` raster.
 */
export function flapFaces(o: {
  x: number;
  y: number;
  width: number;
  height: number;
  faces: ((r: Raster) => void)[];
  at: number;
  flip?: number;
  duration: number;
}): FlapFaces {
  const flip = o.flip ?? 0.09;
  const landed = o.at + (o.faces.length - 1) * flip;
  const face = (i: number) => {
    const l = new Raster(o.width, o.height);
    o.faces[i]!(l);
    return l;
  };
  const faces = clip(o.duration, (r, t) => {
    const on = flapTileOn(t, o.x, r.width);
    if (on <= 0) return;
    drawFlapTile(r, o.x, o.y, o.width, o.height, on);
    const into = t - o.at;
    const step = into < 0 ? 0 : Math.min(o.faces.length - 1, Math.floor(into / flip) + 1);
    const p = into < 0 || t >= landed ? 1 : inOutCubic(span(into % flip, 0, flip * 0.8));
    const l = new Raster(r.width, r.height);
    l.clip = { x0: o.x, y0: o.y, x1: o.x + o.width, y1: o.y + o.height };
    if (step > 0 && p < 1) l.draw(face(step - 1), o.x, o.y - Math.round(p * o.height));
    l.draw(face(step), o.x, o.y + Math.round((1 - p) * o.height));
    r.draw(l, 0, 0, on);
  });
  return { ...faces, landed };
}
