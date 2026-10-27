// High-resolution coverage masks (e.g. logo shapes rasterised from SVG), sampled down to device pixels by exact
// area averaging. Any scale and sub-pixel offset works, so a mask can zoom, slide and settle smoothly.

import { readPng } from "./png.ts";
import type { BlendMode, Color, Raster } from "./raster.ts";

export class Mask {
  readonly size: number;
  /** Summed-area table, (size + 1)² entries. */
  private readonly sat: Float64Array;

  private constructor(size: number, sat: Float64Array) {
    this.size = size;
    this.sat = sat;
  }

  /** Loads a square greyscale PNG; white is covered. */
  static load(path: string): Mask {
    const png = readPng(path);
    if (png.width !== png.height) throw new Error(`${path}: mask must be square`);
    const n = png.width;
    const sat = new Float64Array((n + 1) * (n + 1));
    for (let y = 0; y < n; y++) {
      let row = 0;
      for (let x = 0; x < n; x++) {
        row += png.data[(y * n + x) * 4]! / 255;
        sat[(y + 1) * (n + 1) + x + 1] = sat[y * (n + 1) + x + 1]! + row;
      }
    }
    return new Mask(n, sat);
  }

  /** Average coverage of the mask-space box [x0, x1) × [y0, y1), in mask pixels. */
  private area(x0: number, y0: number, x1: number, y1: number): number {
    const n = this.size;
    const cx0 = Math.max(0, Math.min(n, Math.round(x0)));
    const cy0 = Math.max(0, Math.min(n, Math.round(y0)));
    const cx1 = Math.max(0, Math.min(n, Math.round(x1)));
    const cy1 = Math.max(0, Math.min(n, Math.round(y1)));
    const full = Math.max(1, Math.round(x1) - Math.round(x0)) * Math.max(1, Math.round(y1) - Math.round(y0));
    if (cx1 <= cx0 || cy1 <= cy0) return 0;
    const w = n + 1;
    const s = this.sat;
    return (s[cy1 * w + cx1]! - s[cy0 * w + cx1]! - s[cy1 * w + cx0]! + s[cy0 * w + cx0]!) / full;
  }

  /**
   * Paints the mask into `target`, scaled to a `size`×`size` square whose top-left corner is at (x, y)
   * (fractional values allowed). `paint` colours each pixel; a Color fills flat.
   */
  paint(
    target: Raster,
    x: number,
    y: number,
    size: number,
    paint: Color | ((px: number, py: number, u: number, v: number) => Color),
    mode: BlendMode = "over",
    /** 1 keeps soft anti-aliased edges; higher values snap edges to the pixel grid (crisp pixel art). */
    contrast = 1,
  ): void {
    if (size <= 0) return;
    const k = this.size / size;
    const fn = typeof paint === "function" ? paint : () => paint;
    for (let py = Math.floor(y); py < Math.ceil(y + size); py++) {
      for (let px = Math.floor(x); px < Math.ceil(x + size); px++) {
        const raw = this.area((px - x) * k, (py - y) * k, (px + 1 - x) * k, (py + 1 - y) * k);
        const cov = contrast === 1 ? raw : Math.max(0, Math.min(1, (raw - 0.5) * contrast + 0.5));
        if (cov <= 0.02) continue;
        const u = (px + 0.5 - x) / size;
        const v = (py + 0.5 - y) / size;
        target.blend(px, py, fn(px, py, u, v), cov, mode);
      }
    }
  }
}
