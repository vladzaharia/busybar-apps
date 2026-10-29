// BUSY Bar device fonts, read from the firmware's LVGL binary font files (lv_font_conv --format bin, 1 bpp,
// uncompressed). Rendering from the same bitmaps the device uses keeps pre-rendered text pixel-identical to
// what a `text` draw element shows.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

/** Font names accepted by the draw API. */
export type FontName =
  | "tiny"
  | "small"
  | "normal"
  | "condensed"
  | "bold"
  | "large"
  | "extra_large"
  | "superscript";

/** Draw API font name → firmware font file (see `api_display.c` in the firmware). */
const FILES: Record<FontName, string> = {
  tiny: "busy_tiny",
  small: "busy_regular_5",
  normal: "busy_regular_7",
  condensed: "busy_condensed_7",
  bold: "busy_bold_7",
  large: "busy_regular_9",
  extra_large: "busy_bold_10",
  superscript: "busy_superscript_7",
};

export interface Glyph {
  advance: number;
  /** Left edge of the bitmap, relative to the pen position. */
  x: number;
  /** Bottom edge of the bitmap above the baseline (LVGL's ofs_y). */
  y: number;
  width: number;
  height: number;
  /** Row-major, one entry per pixel. */
  bits: Uint8Array;
}

export interface Font {
  name: FontName;
  /** Baseline offset from the top of a text element. */
  ascent: number;
  /** Negative: how far below the baseline the line box reaches. */
  descent: number;
  lineHeight: number;
  glyph(code: number): Glyph | undefined;
}

class BitReader {
  private bit = 0;
  private readonly buf: Buffer;
  private readonly start: number;

  constructor(buf: Buffer, start: number) {
    this.buf = buf;
    this.start = start;
  }

  read(count: number): number {
    let value = 0;
    for (let i = 0; i < count; i++) {
      const pos = this.start * 8 + this.bit++;
      value = (value << 1) | ((this.buf[pos >> 3]! >> (7 - (pos & 7))) & 1);
    }
    return value;
  }

  readSigned(count: number): number {
    const value = this.read(count);
    return count > 0 && value & (1 << (count - 1)) ? value - (1 << count) : value;
  }
}

/** Parses an lv_font_conv binary font. */
export function parseFont(name: FontName, buf: Buffer): Font {
  const tables = new Map<string, number>();
  for (let off = 0; off < buf.length; ) {
    const size = buf.readUInt32LE(off);
    tables.set(buf.toString("ascii", off + 4, off + 8), off);
    off += size;
  }

  const head = tables.get("head")!;
  const h = head + 8;
  const ascent = buf.readUInt16LE(h + 8);
  const descent = buf.readInt16LE(h + 10);
  const defaultAdvance = buf.readUInt16LE(h + 22);
  const locFormat = buf.readUInt8(h + 26);
  const advFormat = buf.readUInt8(h + 28);
  const bpp = buf.readUInt8(h + 29);
  const xyBits = buf.readUInt8(h + 30);
  const whBits = buf.readUInt8(h + 31);
  const advBits = buf.readUInt8(h + 32);
  const compression = buf.readUInt8(h + 33);
  if (bpp !== 1 || compression !== 0) {
    throw new Error(`${name}: only 1 bpp uncompressed fonts are supported`);
  }

  // Code point → glyph id.
  const glyphIds = new Map<number, number>();
  const cmap = tables.get("cmap")!;
  const subtables = buf.readUInt32LE(cmap + 8);
  for (let i = 0; i < subtables; i++) {
    const s = cmap + 12 + i * 16;
    const dataOffset = buf.readUInt32LE(s);
    const rangeStart = buf.readUInt32LE(s + 4);
    const rangeLength = buf.readUInt16LE(s + 8);
    const glyphStart = buf.readUInt16LE(s + 10);
    const entries = buf.readUInt16LE(s + 12);
    const format = buf.readUInt8(s + 14);
    const data = cmap + dataOffset;
    if (format === 0) {
      for (let c = 0; c < rangeLength; c++) {
        const delta = buf.readUInt8(data + c);
        if (delta) glyphIds.set(rangeStart + c, glyphStart + delta);
      }
    } else if (format === 2) {
      for (let c = 0; c < rangeLength; c++) glyphIds.set(rangeStart + c, glyphStart + c);
    } else if (format === 1 || format === 3) {
      for (let e = 0; e < entries; e++) {
        const code = rangeStart + buf.readUInt16LE(data + e * 2);
        const id = format === 3 ? glyphStart + e : glyphStart + buf.readUInt16LE(data + entries * 2 + e * 2);
        glyphIds.set(code, id);
      }
    }
  }

  const loca = tables.get("loca")!;
  const glyf = tables.get("glyf")!;
  const cache = new Map<number, Glyph>();

  function load(id: number): Glyph {
    const offset = locFormat === 0 ? buf.readUInt16LE(loca + 12 + id * 2) : buf.readUInt32LE(loca + 12 + id * 4);
    const r = new BitReader(buf, glyf + offset);
    let advance = advBits ? r.read(advBits) : defaultAdvance;
    if (advFormat === 1) advance = Math.round(advance / 16);
    const x = r.readSigned(xyBits);
    const y = r.readSigned(xyBits);
    const width = r.read(whBits);
    const height = r.read(whBits);
    const bits = new Uint8Array(width * height);
    for (let i = 0; i < bits.length; i++) bits[i] = r.read(1);
    return { advance, x, y, width, height, bits };
  }

  return {
    name,
    ascent,
    descent,
    lineHeight: ascent - descent,
    glyph(code) {
      const id = glyphIds.get(code);
      if (id === undefined) return undefined;
      let g = cache.get(id);
      if (!g) cache.set(id, (g = load(id)));
      return g;
    },
  };
}

const loaded = new Map<FontName, Font>();

/** Loads a device font by its draw API name. */
export function font(name: FontName): Font {
  let f = loaded.get(name);
  if (!f) {
    const path = fileURLToPath(new URL(`../fonts/${FILES[name]}.font`, import.meta.url));
    loaded.set(name, (f = parseFont(name, readFileSync(path))));
  }
  return f;
}

/** Advance width of `text`, as the device lays it out (no kerning in these fonts). */
export function textWidth(text: string, f: Font): number {
  let w = 0;
  for (const ch of text) w += f.glyph(ch.codePointAt(0)!)?.advance ?? 0;
  return w;
}

/**
 * Blank columns between a glyph's last lit pixel and its advance: 1 for nearly every glyph (2 for the period). A
 * glyph with nothing lit (a space) has none: it is all gap, and counts in full.
 */
export function trailingBearing(g: Glyph): number {
  for (let col = g.width - 1; col >= 0; col--) {
    for (let row = 0; row < g.height; row++) if (g.bits[row * g.width + col]) return Math.max(0, g.advance - (g.x + col + 1));
  }
  return 0;
}

/**
 * Width of `text` from its first pen position to the end of its last lit pixel: `textWidth` less the last glyph's
 * trailing bearing. Centre, mirror and right-align on this, not on `textWidth`, which sits a pixel wider than the ink.
 */
export function inkWidth(text: string, f: Font): number {
  const glyphs = [...text].map((ch) => f.glyph(ch.codePointAt(0)!)).filter((g) => g !== undefined);
  const last = glyphs[glyphs.length - 1];
  return textWidth(text, f) - (last ? trailingBearing(last) : 0);
}
