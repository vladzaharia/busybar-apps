// Renders every design option to sprite sheets (one PNG per demo, frames stacked vertically) plus a manifest,
// for the options preview page. Usage: node design/render.ts <out-dir> [--sheets]

import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { Raster, sheet, writePng } from "@vladzaharia/bar-pixel";
import { BACK_OPTIONS } from "./back.ts";
import { FRONT_OPTIONS } from "./front.ts";
import { BLACK, FPS, toGray4 } from "./kit.ts";

const out = process.argv[2] ?? "design-out";
const contact = process.argv.includes("--sheets");
mkdirSync(out, { recursive: true });

interface Entry {
  id: string;
  name: string;
  pitch: string;
  display: "front" | "back";
  width: number;
  height: number;
  frames: number;
  fps: number;
  file: string;
}

const manifest: Entry[] = [];

function render(
  demo: { id: string; name: string; pitch: string; duration: number; frame(t: number): Raster },
  display: "front" | "back",
  step = 1,
) {
  const count = Math.round(demo.duration * FPS);
  const frames: Uint8Array[] = [];
  let w = 0;
  let h = 0;
  for (let i = 0; i < count; i += step) {
    let r = demo.frame(i / FPS);
    if (display === "back") r = toGray4(r);
    w = r.width;
    h = r.height;
    frames.push(r.toRGBA8(BLACK));
  }
  const file = `${display}-${demo.id}.png`;
  writePng(join(out, file), sheet(frames, w, h));
  manifest.push({ id: demo.id, name: demo.name, pitch: demo.pitch, display, width: w, height: h, frames: frames.length, fps: FPS / step, file });
  if (contact) contactSheet(frames, w, h, join(out, `contact-${display}-${demo.id}.png`), display === "back" ? 3 : 5);
  console.log(`${file}: ${frames.length} frames`);
}

/** Every ~0.25 s, enlarged, for reviewing a demo at a glance. */
function contactSheet(frames: Uint8Array[], w: number, h: number, path: string, scale: number) {
  const picks = frames.filter((_, i) => i % 15 === 0);
  const cols = w > 100 ? 4 : 6;
  const cw = w * scale + 4;
  const ch = h * scale + 4;
  const rows = Math.ceil(picks.length / cols);
  const data = new Uint8Array(cols * cw * rows * ch * 4).fill(48);
  picks.forEach((f, k) => {
    const ox = (k % cols) * cw;
    const oy = Math.floor(k / cols) * ch;
    for (let y = 0; y < h * scale; y++) {
      for (let x = 0; x < w * scale; x++) {
        const si = (Math.floor(y / scale) * w + Math.floor(x / scale)) * 4;
        const di = ((oy + y) * cols * cw + ox + x) * 4;
        data[di] = f[si]!;
        data[di + 1] = f[si + 1]!;
        data[di + 2] = f[si + 2]!;
        data[di + 3] = 255;
      }
    }
  });
  writePng(path, { width: cols * cw, height: rows * ch, data });
}

for (const demo of FRONT_OPTIONS) render(demo, "front");
for (const demo of BACK_OPTIONS) render(demo, "back", 2);
writeFileSync(join(out, "manifest.json"), JSON.stringify(manifest, null, 2));
