// A display's pixels: straight RGBA, with the drawing operations the canvas service uses for draw elements.

import { FONTS } from "./fonts.generated.ts";

export type RGBA = [number, number, number, number];

/** `#RRGGBBAA` or `#RRGGBB` → 0..255 channels. */
export function parseColor(hex: string | undefined, fallback: RGBA = [255, 255, 255, 255]): RGBA {
  if (!hex) return fallback;
  const v = hex.replace("#", "");
  const n = (i: number) => parseInt(v.slice(i, i + 2), 16);
  return [n(0), n(2), n(4), v.length >= 8 ? n(6) : 255];
}

interface Glyph {
  advance: number;
  x: number;
  y: number;
  w: number;
  h: number;
  bits: Uint8Array;
}

const glyphCache = new Map<string, Glyph>();

function glyph(font: string, code: number): Glyph | null {
  const f = FONTS[font];
  if (!f || code < 0x20 || code > 0x7e) return null;
  const key = `${font}:${code}`;
  let g = glyphCache.get(key);
  if (!g) {
    const [advance, x, y, w, h, hex] = f.glyphs[code - 0x20] as [number, number, number, number, number, string];
    const bits = new Uint8Array(w * h);
    for (let i = 0; i < bits.length; i++) bits[i] = (parseInt(hex[i >> 2] ?? "0", 16) >> (3 - (i & 3))) & 1;
    glyphCache.set(key, (g = { advance, x, y, w, h, bits }));
  }
  return g;
}

export function fontMetrics(font: string): { ascent: number; descent: number } {
  return FONTS[font] ?? { ascent: 7, descent: -2 };
}

export function textWidth(text: string, font: string): number {
  let w = 0;
  for (const ch of text) w += glyph(font, ch.charCodeAt(0))?.advance ?? 0;
  return w;
}

export interface Clip {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

export class Screen {
  readonly width: number;
  readonly height: number;
  readonly data: Uint8ClampedArray;

  constructor(width: number, height: number) {
    this.width = width;
    this.height = height;
    this.data = new Uint8ClampedArray(width * height * 4);
  }

  clear(): void {
    for (let i = 0; i < this.data.length; i += 4) {
      this.data[i] = this.data[i + 1] = this.data[i + 2] = 0;
      this.data[i + 3] = 255;
    }
  }

  blend(x: number, y: number, c: RGBA, alpha = 1, clip?: Clip): void {
    if (x < 0 || y < 0 || x >= this.width || y >= this.height) return;
    if (clip && (x < clip.x0 || y < clip.y0 || x >= clip.x1 || y >= clip.y1)) return;
    const a = (c[3] / 255) * alpha;
    if (a <= 0) return;
    const i = (y * this.width + x) * 4;
    const d = this.data;
    d[i] = d[i]! + (c[0] - d[i]!) * a;
    d[i + 1] = d[i + 1]! + (c[1] - d[i + 1]!) * a;
    d[i + 2] = d[i + 2]! + (c[2] - d[i + 2]!) * a;
  }

  /** Text with its element's top-left at (x, y): the baseline sits at y + ascent. */
  text(text: string, font: string, x: number, y: number, c: RGBA, clip?: Clip): void {
    const { ascent } = fontMetrics(font);
    let pen = x;
    for (const ch of text) {
      const g = glyph(font, ch.charCodeAt(0));
      if (!g) continue;
      const top = y + ascent - g.y - g.h;
      for (let gy = 0; gy < g.h; gy++) {
        for (let gx = 0; gx < g.w; gx++) if (g.bits[gy * g.w + gx]) this.blend(pen + g.x + gx, top + gy, c, 1, clip);
      }
      pen += g.advance;
    }
  }

  /** A rectangle with rounded corners cut on the pixel grid; `paint` picks each pixel's colour (or none). */
  roundRect(x: number, y: number, w: number, h: number, radius: number, paint: (lx: number, ly: number) => RGBA | null): void {
    const r = Math.min(radius, Math.floor(Math.min(w, h) / 2));
    for (let ly = 0; ly < h; ly++) {
      for (let lx = 0; lx < w; lx++) {
        const cx = lx < r ? r - lx - 0.5 : lx >= w - r ? lx - (w - r) + 0.5 : 0;
        const cy = ly < r ? r - ly - 0.5 : ly >= h - r ? ly - (h - r) + 0.5 : 0;
        if (cx * cx + cy * cy > r * r) continue;
        const c = paint(lx, ly);
        if (c) this.blend(x + lx, y + ly, c);
      }
    }
  }

  /** Composites straight RGBA pixels (an image, an animation frame) at (x, y). */
  image(rgba: ArrayLike<number>, w: number, h: number, x: number, y: number, opacity = 1): void {
    for (let py = 0; py < h; py++) {
      for (let px = 0; px < w; px++) {
        const i = (py * w + px) * 4;
        const a = rgba[i + 3]!;
        if (a) this.blend(x + px, y + py, [rgba[i]!, rgba[i + 1]!, rgba[i + 2]!, a], opacity);
      }
    }
  }
}
