// A small emulator for the draw API: renders `text`, `image` and `rectangle` elements onto a raster the way the
// firmware lays them out (anchor point plus `align`, device fonts, z order). Previews use it to show runtime
// elements, such as a live clock, together with decoded animation frames.

import { font, textWidth, type FontName } from "./font.ts";
import { Raster, hex, type Color } from "./raster.ts";

/** The subset of draw elements the emulator understands (structurally compatible with bar-core's types). */
export interface EmulatedElement {
  id: string;
  type: string;
  x?: number;
  y?: number;
  display?: "front" | "back";
  align?: string;
  z_index?: number;
  text?: string;
  font?: string;
  color?: string;
  width?: number;
  height?: number;
  radius?: number;
  fill?: string;
  fill_colors?: string[];
  border_width?: number;
  border_color?: string;
  path?: string;
}

function color(v: string | undefined, fallback: string): Color {
  return hex(v ?? fallback);
}

/** Top-left of an element of size w×h whose `align` point sits at (x, y). */
function anchor(align: string | undefined, x: number, y: number, w: number, h: number): [number, number] {
  const a = align ?? "top_left";
  const ax = a.endsWith("left") ? 0 : a.endsWith("right") ? w : a === "center" || a.endsWith("mid") ? Math.floor(w / 2) : 0;
  const ay = a.startsWith("top") ? 0 : a.startsWith("bottom") ? h : a === "center" || a.startsWith("mid") ? Math.floor(h / 2) : 0;
  return [x - ax, y - ay];
}

/** Draws `elements` for one display onto `r`, in z order. `images` maps package paths to rasters. */
export function drawElements(
  r: Raster,
  elements: EmulatedElement[],
  o: { display: "front" | "back"; images?: Record<string, Raster> },
): void {
  const mine = elements.filter((e) => (e.display ?? "front") === o.display).sort((a, b) => (a.z_index ?? 0) - (b.z_index ?? 0));
  for (const e of mine) {
    if (e.type === "text" && e.text && e.font) {
      const f = font(e.font as FontName);
      const w = e.width ?? textWidth(e.text, f);
      const [x, y] = anchor(e.align, e.x ?? 0, e.y ?? 0, w, f.lineHeight);
      const prev = r.clip;
      if (e.width) r.clip = { x0: x, y0: -999, x1: x + e.width, y1: 999 };
      r.text(e.text, f, x, y, color(e.color, "#FFFFFFFF"));
      r.clip = prev;
    } else if (e.type === "image" && e.path && o.images?.[e.path]) {
      const img = o.images[e.path]!;
      const [x, y] = anchor(e.align, e.x ?? 0, e.y ?? 0, img.width, img.height);
      r.draw(img, x, y);
    } else if (e.type === "rectangle" && e.width && e.height) {
      const [x, y] = anchor(e.align, e.x ?? 0, e.y ?? 0, e.width, e.height);
      const fill = e.fill && e.fill !== "none" ? color(e.fill_colors?.[0], "#FFFFFFFF") : null;
      const bw = e.border_width ?? 1;
      const border = color(e.border_color, "#FFFFFFFF");
      r.roundRect(x, y, e.width, e.height, e.radius ?? 0, (px, py) => {
        const lx = px - x;
        const ly = py - y;
        if (bw > 0 && (lx < bw || ly < bw || lx >= e.width! - bw || ly >= e.height! - bw)) return border;
        return fill;
      });
    }
  }
}

/** Composites straight-RGBA bytes (a decoded animation frame) at (x, y). */
export function drawRGBA(r: Raster, rgba: Uint8Array, width: number, height: number, x = 0, y = 0): void {
  for (let py = 0; py < height; py++) {
    for (let px = 0; px < width; px++) {
      const i = (py * width + px) * 4;
      const a = rgba[i + 3]! / 255;
      if (a > 0) r.blend(x + px, y + py, { r: rgba[i]! / 255, g: rgba[i + 1]! / 255, b: rgba[i + 2]! / 255, a });
    }
  }
}
