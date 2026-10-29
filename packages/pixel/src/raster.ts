// A small floating-point RGBA canvas for building animation frames at device resolution.
// Pixels are stored premultiplied, so "over" and additive light compose without fringes.

import { textWidth, type Font } from "./font.ts";

/** Straight (not premultiplied) colour, every channel 0..1. */
export interface Color {
  r: number;
  g: number;
  b: number;
  a: number;
}

export type BlendMode = "over" | "add" | "screen";

/** `#RRGGBB` or `#RRGGBBAA` → Color, with an optional extra alpha multiplier. */
export function hex(value: string, alpha = 1): Color {
  const v = value.replace("#", "");
  const n = (i: number) => parseInt(v.slice(i, i + 2), 16) / 255;
  return { r: n(0), g: n(2), b: n(4), a: (v.length >= 8 ? n(6) : 1) * alpha };
}

export function mix(a: Color, b: Color, t: number): Color {
  return {
    r: a.r + (b.r - a.r) * t,
    g: a.g + (b.g - a.g) * t,
    b: a.b + (b.b - a.b) * t,
    a: a.a + (b.a - a.a) * t,
  };
}

export function withAlpha(c: Color, a: number): Color {
  return { r: c.r, g: c.g, b: c.b, a: c.a * a };
}

/** Per-glyph styling for kinetic text: offsets, colour and opacity per character. */
export interface GlyphStyle {
  dx?: number;
  dy?: number;
  color?: Color;
  alpha?: number;
  hidden?: boolean;
}

export class Raster {
  readonly width: number;
  readonly height: number;
  /** Premultiplied RGBA. */
  readonly data: Float32Array;
  /** Optional clip rectangle applied to every write. */
  clip: { x0: number; y0: number; x1: number; y1: number } | null = null;

  constructor(width: number, height: number) {
    this.width = width;
    this.height = height;
    this.data = new Float32Array(width * height * 4);
  }

  /** Wraps straight RGBA bytes (e.g. a decoded PNG). */
  static from(bitmap: { width: number; height: number; data: Uint8Array }): Raster {
    const r = new Raster(bitmap.width, bitmap.height);
    for (let i = 0; i < bitmap.data.length; i += 4) {
      const a = bitmap.data[i + 3]! / 255;
      r.data[i] = (bitmap.data[i]! / 255) * a;
      r.data[i + 1] = (bitmap.data[i + 1]! / 255) * a;
      r.data[i + 2] = (bitmap.data[i + 2]! / 255) * a;
      r.data[i + 3] = a;
    }
    return r;
  }

  clone(): Raster {
    const r = new Raster(this.width, this.height);
    r.data.set(this.data);
    return r;
  }

  clear(color?: Color): this {
    if (!color) {
      this.data.fill(0);
      return this;
    }
    for (let i = 0; i < this.data.length; i += 4) {
      this.data[i] = color.r * color.a;
      this.data[i + 1] = color.g * color.a;
      this.data[i + 2] = color.b * color.a;
      this.data[i + 3] = color.a;
    }
    return this;
  }

  private inside(x: number, y: number): boolean {
    if (x < 0 || y < 0 || x >= this.width || y >= this.height) return false;
    const c = this.clip;
    return !c || (x >= c.x0 && y >= c.y0 && x < c.x1 && y < c.y1);
  }

  /** Blends one pixel. `coverage` scales the colour's alpha (anti-aliasing, masks). */
  blend(x: number, y: number, c: Color, coverage = 1, mode: BlendMode = "over"): void {
    x = Math.floor(x);
    y = Math.floor(y);
    if (!this.inside(x, y)) return;
    const a = Math.max(0, Math.min(1, c.a * coverage));
    if (a <= 0) return;
    const i = (y * this.width + x) * 4;
    const d = this.data;
    const sr = c.r * a;
    const sg = c.g * a;
    const sb = c.b * a;
    if (mode === "over") {
      const k = 1 - a;
      d[i] = sr + d[i]! * k;
      d[i + 1] = sg + d[i + 1]! * k;
      d[i + 2] = sb + d[i + 2]! * k;
      d[i + 3] = a + d[i + 3]! * k;
    } else if (mode === "add") {
      d[i] = Math.min(1, d[i]! + sr);
      d[i + 1] = Math.min(1, d[i + 1]! + sg);
      d[i + 2] = Math.min(1, d[i + 2]! + sb);
      d[i + 3] = Math.min(1, d[i + 3]! + a);
    } else {
      d[i] = d[i]! + sr - d[i]! * sr;
      d[i + 1] = d[i + 1]! + sg - d[i + 1]! * sg;
      d[i + 2] = d[i + 2]! + sb - d[i + 2]! * sb;
      d[i + 3] = d[i + 3]! + a - d[i + 3]! * a;
    }
  }

  /** Runs `fn` for every pixel centre; a returned colour is blended in. */
  shade(fn: (x: number, y: number) => Color | null | undefined, mode: BlendMode = "over"): this {
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        const c = fn(x, y);
        if (c) this.blend(x, y, c, 1, mode);
      }
    }
    return this;
  }

  fillRect(x: number, y: number, w: number, h: number, c: Color, mode: BlendMode = "over"): this {
    for (let yy = Math.max(0, Math.floor(y)); yy < Math.min(this.height, Math.ceil(y + h)); yy++) {
      for (let xx = Math.max(0, Math.floor(x)); xx < Math.min(this.width, Math.ceil(x + w)); xx++) {
        this.blend(xx, yy, c, 1, mode);
      }
    }
    return this;
  }

  /**
   * Pixel-art rounded rectangle: corners are cut on the pixel grid, like the device's own panels.
   * `paint` picks the colour per pixel (gradients, sheens); a Color fills flat.
   */
  roundRect(
    x: number,
    y: number,
    w: number,
    h: number,
    radius: number,
    paint: Color | ((x: number, y: number, u: number, v: number) => Color | null),
    mode: BlendMode = "over",
  ): this {
    const fn = typeof paint === "function" ? paint : () => paint;
    for (let yy = 0; yy < h; yy++) {
      for (let xx = 0; xx < w; xx++) {
        if (!inRoundRect(xx, yy, w, h, radius)) continue;
        const c = fn(x + xx, y + yy, xx / Math.max(1, w - 1), yy / Math.max(1, h - 1));
        if (c) this.blend(x + xx, y + yy, c, 1, mode);
      }
    }
    return this;
  }

  /** Additive elliptical glow with a smooth falloff; the device's flares and light blooms. */
  glow(cx: number, cy: number, rx: number, ry: number, c: Color, falloff = 2): this {
    const x0 = Math.floor(cx - rx);
    const x1 = Math.ceil(cx + rx);
    const y0 = Math.floor(cy - ry);
    const y1 = Math.ceil(cy + ry);
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const dx = (x + 0.5 - cx) / rx;
        const dy = (y + 0.5 - cy) / ry;
        const d = Math.sqrt(dx * dx + dy * dy);
        if (d >= 1) continue;
        this.blend(x, y, c, Math.pow(1 - d, falloff), "add");
      }
    }
    return this;
  }

  /**
   * Draws `text` with a device font. `y` is the element's top, as in a draw API text element, so the baseline
   * sits at `y + font.ascent`. `style` can move, colour or hide each glyph for kinetic typography.
   */
  text(
    text: string,
    f: Font,
    x: number,
    y: number,
    color: Color,
    style?: (index: number, ch: string) => GlyphStyle | undefined,
    mode: BlendMode = "over",
  ): this {
    let pen = x;
    let i = 0;
    for (const ch of text) {
      const g = f.glyph(ch.codePointAt(0)!);
      if (!g) continue;
      const s = style?.(i, ch) ?? {};
      if (!s.hidden) {
        const c = s.color ?? color;
        const left = Math.round(pen + g.x + (s.dx ?? 0));
        const top = Math.round(y + f.ascent - g.y - g.height + (s.dy ?? 0));
        for (let gy = 0; gy < g.height; gy++) {
          for (let gx = 0; gx < g.width; gx++) {
            if (g.bits[gy * g.width + gx]) this.blend(left + gx, top + gy, c, s.alpha ?? 1, mode);
          }
        }
      }
      pen += g.advance;
      i++;
    }
    return this;
  }

  /** Composites another raster at an integer offset. */
  draw(src: Raster, dx: number, dy: number, alpha = 1, mode: BlendMode = "over"): this {
    dx = Math.round(dx);
    dy = Math.round(dy);
    for (let y = 0; y < src.height; y++) {
      for (let x = 0; x < src.width; x++) {
        const i = (y * src.width + x) * 4;
        const a = src.data[i + 3]!;
        if (a <= 0) continue;
        this.blend(
          dx + x,
          dy + y,
          { r: src.data[i]! / a, g: src.data[i + 1]! / a, b: src.data[i + 2]! / a, a },
          alpha,
          mode,
        );
      }
    }
    return this;
  }

  /** Multiplies every pixel's alpha (fades, masks). `fn` returns the factor per pixel. */
  fade(fn: number | ((x: number, y: number) => number)): this {
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        const k = Math.max(0, Math.min(1, typeof fn === "number" ? fn : fn(x, y)));
        const i = (y * this.width + x) * 4;
        for (let j = 0; j < 4; j++) this.data[i + j] = this.data[i + j]! * k;
      }
    }
    return this;
  }

  /** Straight-alpha RGBA bytes, optionally flattened onto an opaque background. */
  toRGBA8(background?: Color): Uint8Array {
    const out = new Uint8Array(this.width * this.height * 4);
    for (let i = 0; i < out.length; i += 4) {
      let r = this.data[i]!;
      let g = this.data[i + 1]!;
      let b = this.data[i + 2]!;
      let a = this.data[i + 3]!;
      if (background) {
        const k = 1 - a;
        r += background.r * k;
        g += background.g * k;
        b += background.b * k;
        a = 1;
      } else if (a > 0) {
        r /= a;
        g /= a;
        b /= a;
      }
      out[i] = to8(r);
      out[i + 1] = to8(g);
      out[i + 2] = to8(b);
      out[i + 3] = to8(a);
    }
    return out;
  }
}

function to8(v: number): number {
  return Math.max(0, Math.min(255, Math.round(v * 255)));
}

/** Whether (x, y) is inside the polygon `pts` (even-odd rule). */
function inPolygon(pts: readonly (readonly [number, number])[], x: number, y: number): boolean {
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, yi] = pts[i]!;
    const [xj, yj] = pts[j]!;
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/**
 * A filled polygon (screen coordinates, any shape), anti-aliased by 4 x 4 supersampling. Coverage is sharpened a
 * little (below 15% is dropped, above 75% is solid) so small shapes that turn, a paper plane, keep their edges.
 */
export function fillPolygon(r: Raster, pts: readonly (readonly [number, number])[], c: Color, alpha = 1): void {
  const SS = 4;
  const xs = pts.map((p) => p[0]);
  const ys = pts.map((p) => p[1]);
  for (let y = Math.floor(Math.min(...ys)); y <= Math.ceil(Math.max(...ys)); y++) {
    for (let x = Math.floor(Math.min(...xs)); x <= Math.ceil(Math.max(...xs)); x++) {
      let n = 0;
      for (let sy = 0; sy < SS; sy++) for (let sx = 0; sx < SS; sx++) if (inPolygon(pts, x + (sx + 0.5) / SS, y + (sy + 0.5) / SS)) n++;
      const k = Math.max(0, Math.min(1, (n / (SS * SS) - 0.15) / 0.6));
      if (k > 0) r.blend(x, y, c, alpha * k);
    }
  }
}

/** Whether a pixel lies inside a rounded rectangle whose corners are cut on the pixel grid. */
export function inRoundRect(x: number, y: number, w: number, h: number, r: number): boolean {
  if (x < 0 || y < 0 || x >= w || y >= h) return false;
  const cx = x < r ? r - x - 0.5 : x >= w - r ? x - (w - r) + 0.5 : 0;
  const cy = y < r ? r - y - 0.5 : y >= h - r ? y - (h - r) + 0.5 : 0;
  return cx * cx + cy * cy <= r * r;
}

export { textWidth };
