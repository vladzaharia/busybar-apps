// Contact sheets for checking a concepts module by eye: 12 evenly spaced frames of each concept, 6x, one PNG per
// concept in <out-dir>/<id>.png (3 rows of 4, left to right, top to bottom).
// Usage: node concepts/sheet.ts concepts/<module>.ts <out-dir>

import { mkdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { hex, renderFrames, writePng } from "@vladzaharia/bar-pixel";
import { H, W, type Concept } from "./types.ts";

const [modulePath, outArg] = process.argv.slice(2);
if (!modulePath || !outArg) throw new Error("usage: node concepts/sheet.ts concepts/<module>.ts <out-dir>");
const { CONCEPTS } = (await import(pathToFileURL(resolve(modulePath)).href)) as { CONCEPTS: Concept[] };
const out = resolve(outArg);
mkdirSync(out, { recursive: true });

const S = 6;
const COLS = 4;
const ROWS = 3;
const GAP = 2;
for (const c of CONCEPTS) {
  const frames = renderFrames(c.clip, { width: W, height: H, fps: 60, background: hex("#000000") });
  const cw = W * S + GAP * S;
  const ch = H * S + GAP * S;
  const data = new Uint8Array(COLS * cw * ROWS * ch * 4);
  for (let k = 0; k < COLS * ROWS; k++) {
    const f = frames[Math.min(frames.length - 1, Math.round((k / (COLS * ROWS - 1)) * (frames.length - 1)))]!;
    const ox = (k % COLS) * cw;
    const oy = Math.floor(k / COLS) * ch;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const s = (y * W + x) * 4;
      for (let dy = 0; dy < S - 1; dy++) for (let dx = 0; dx < S - 1; dx++) {
        const o = ((oy + y * S + dy) * COLS * cw + ox + x * S + dx) * 4;
        data.set(frames.length ? f.subarray(s, s + 4) : [0, 0, 0, 255], o);
      }
    }
  }
  writePng(join(out, `${c.id}.png`), { width: COLS * cw, height: ROWS * ch, data });
  console.log(`${c.id}: ${(frames.length / 60).toFixed(2)} s, ${frames.length} frames -> ${join(out, `${c.id}.png`)}`);
}
