// Helpers for the guard test: reading rendered 72 x 16 frames (straight RGBA bytes, as `renderFrames` returns them).

import { Raster, hex, textWidth, type Font } from "@vladzaharia/bar-pixel";

export const SCREEN = { width: 72, height: 16 } as const;

/** How far apart (largest difference on any of R, G, B, A, 0..255) two pixels may be and still count as one colour. */
const SAME = 12;
/** A smooth ground (the sign's gradient) is one colour too, within this much of its first pixel. A chevron, a bubble, a
 *  neighbouring letter or a sprite on the ground is far beyond it. */
const GROUND = 48;
/** The lettering must differ from the ground by at least this much, or there is nothing to read. */
const CONTRAST = 64;

/** The lit pixels of some text: its ink box (so `ox`, `oy` are the box's offset from where the text is drawn). */
interface Mask {
  w: number;
  h: number;
  ox: number;
  oy: number;
  /** 1 where a glyph is lit, row-major over the ink box. */
  lit: Uint8Array;
  /** Index into `lit` of the first lit pixel. */
  first: number;
}

const masks = new Map<string, Mask | null>();

/** The mask of `text` in `f`, found by drawing it with the raster itself, so it is exactly what a scene draws. */
function maskOf(text: string, f: Font): Mask | null {
  const key = `${f.name}\0${text}`;
  if (masks.has(key)) return masks.get(key)!;
  const pad = 4;
  const rw = textWidth(text, f) + 2 * pad;
  const rh = f.lineHeight + 2 * pad;
  const px = new Raster(rw, rh).text(text, f, pad, pad, hex("#FFFFFF")).toRGBA8();
  let x0 = rw;
  let x1 = -1;
  let y0 = rh;
  let y1 = -1;
  for (let y = 0; y < rh; y++) {
    for (let x = 0; x < rw; x++) {
      if (px[(y * rw + x) * 4 + 3]! === 0) continue;
      x0 = Math.min(x0, x);
      x1 = Math.max(x1, x);
      y0 = Math.min(y0, y);
      y1 = Math.max(y1, y);
    }
  }
  let mask: Mask | null = null;
  if (x1 >= 0) {
    const w = x1 - x0 + 1;
    const h = y1 - y0 + 1;
    const lit = new Uint8Array(w * h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) lit[y * w + x] = px[((y0 + y) * rw + x0 + x) * 4 + 3]! > 0 ? 1 : 0;
    mask = { w, h, ox: x0 - pad, oy: y0 - pad, lit, first: lit.indexOf(1) };
  }
  masks.set(key, mask);
  return mask;
}

const distance = (frame: Uint8Array, i: number, ref: Uint8Array, j: number): number => {
  let d = 0;
  for (let k = 0; k < 4; k++) d = Math.max(d, Math.abs(frame[i + k]! - ref[j + k]!));
  return d;
};

/** Is the whole of `m`, with its ink box at (bx, by), on the screen as lettering: one colour, on one other colour? */
function matches(frame: Uint8Array, m: Mask, bx: number, by: number): boolean {
  const { width, height } = SCREEN;
  const x0 = Math.max(0, bx - 1);
  const x1 = Math.min(width - 1, bx + m.w);
  const y0 = Math.max(0, by - 1);
  const y1 = Math.min(height - 1, by + m.h);
  const isLit = (x: number, y: number) => x >= bx && x < bx + m.w && y >= by && y < by + m.h && m.lit[(y - by) * m.w + (x - bx)] === 1;

  // A reference pixel of each kind. Most places fail the contrast test at once, which keeps the search quick.
  const glyph = ((by + Math.floor(m.first / m.w)) * width + bx + (m.first % m.w)) * 4;
  let ground = -1;
  for (let y = y0; y <= y1 && ground < 0; y++) for (let x = x0; x <= x1; x++) if (!isLit(x, y)) { ground = (y * width + x) * 4; break; }
  if (ground < 0 || distance(frame, glyph, frame, ground) < CONTRAST) return false;
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const i = (y * width + x) * 4;
      if (isLit(x, y) ? distance(frame, i, frame, glyph) > SAME : distance(frame, i, frame, ground) > GROUND) return false;
    }
  }
  return true;
}

/**
 * Where `name` is shown whole in `frame`, as the (x, y) a scene would draw it at, or null. The name's glyph mask is lit
 * in one colour, and every other pixel of its ink box (plus 1 px each way, up to the screen's edge) is one other
 * colour (a smooth gradient counts as one): so a letter missing, a letter out of place, or a chevron, bubble, sprite
 * or neighbouring text touching the name all make it "not found". `spaced` matches the letters one at a time, left to
 * right, each on its own (a name carried on separate train cars).
 */
export function findName(frame: Uint8Array, name: string, f: Font, spaced = false): { x: number; y: number } | null {
  const { width, height } = SCREEN;
  if (!spaced) {
    const m = maskOf(name, f);
    if (!m) return null;
    for (let by = 0; by + m.h <= height; by++) for (let bx = 0; bx + m.w <= width; bx++) if (matches(frame, m, bx, by)) return { x: bx - m.ox, y: by - m.oy };
    return null;
  }
  let at: { x: number; y: number } | null = null;
  let from = 0;
  for (const ch of name) {
    const m = maskOf(ch, f);
    if (!m) continue;
    let hit: { bx: number; by: number } | null = null;
    for (let bx = from; bx + m.w <= width && !hit; bx++) for (let by = 0; by + m.h <= height; by++) if (matches(frame, m, bx, by)) { hit = { bx, by }; break; }
    if (!hit) return null;
    at ??= { x: hit.bx - m.ox, y: hit.by - m.oy };
    from = hit.bx + m.w;
  }
  return at;
}

/** The screen pixels `name` inks when drawn at `at` (as `findName` returns it): first and last column and row. */
export function inkBox(name: string, f: Font, at: { x: number; y: number }): { x0: number; x1: number; y0: number; y1: number } {
  const m = maskOf(name, f);
  if (!m) throw new Error(`${JSON.stringify(name)} has no ink in ${f.name}`);
  return { x0: at.x + m.ox, x1: at.x + m.ox + m.w - 1, y0: at.y + m.oy, y1: at.y + m.oy + m.h - 1 };
}

/** Mean Rec. 709 luminance, 0..1, of the frame composited on black (the bar's LEDs are dark where nothing is lit). */
export function luminance(frame: Uint8Array): number {
  let sum = 0;
  for (let i = 0; i < frame.length; i += 4) {
    const a = frame[i + 3]! / 255;
    sum += (0.2126 * frame[i]! + 0.7152 * frame[i + 1]! + 0.0722 * frame[i + 2]!) * a;
  }
  return sum / 255 / (frame.length / 4);
}

/** How many pixels of the frame are not fully transparent. */
export function litPixels(frame: Uint8Array): number {
  let n = 0;
  for (let i = 3; i < frame.length; i += 4) if (frame[i]! !== 0) n++;
  return n;
}
