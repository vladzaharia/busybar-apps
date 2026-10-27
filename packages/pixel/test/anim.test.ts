import assert from "node:assert/strict";
import { readdirSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { decodeAnim, encodeAnim, rleCompress, rleDecompress, type AnimColorFormat } from "../src/anim.ts";
import { readPng } from "../src/png.ts";

function rand(seed: number) {
  let s = seed;
  return () => ((s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
}

/** Frames with mostly-static content plus a moving block, so masks, runs and keyframes all get exercised. */
function frames(w: number, h: number, n: number, seed: number, alpha = false): Uint8Array[] {
  const r = rand(seed);
  const base = new Uint8Array(w * h * 4);
  for (let i = 0; i < base.length; i += 4) {
    base[i] = (i / 4) % 7 === 0 ? 255 : 0;
    base[i + 1] = Math.floor(r() * 3) * 100;
    base[i + 2] = 40;
    base[i + 3] = alpha ? (r() < 0.3 ? 0 : Math.floor(r() * 256)) : 255;
  }
  return Array.from({ length: n }, (_, f) => {
    const fr = base.slice();
    for (let y = 2; y < Math.min(h, 8); y++) {
      for (let x = f; x < Math.min(w, f + 9); x++) {
        const i = (y * w + x) * 4;
        fr[i] = 200;
        fr[i + 1] = 10 * f;
        fr[i + 2] = 255;
        fr[i + 3] = 255;
      }
    }
    if (f % 5 === 3) fr.set(base); // A frame identical to... a non-neighbour, and one identical to its predecessor below.
    return fr;
  });
}

/** What the format can represent: flattened onto black, and greys quantised to 16 levels. */
function expected(frame: Uint8Array, format: AnimColorFormat): Uint8Array {
  const out = new Uint8Array(frame.length);
  for (let i = 0; i < frame.length; i += 4) {
    const a = frame[i + 3]!;
    if (format === "argb8888") {
      if (a) out.set(frame.subarray(i, i + 4), i);
      continue;
    }
    const k = a / 255;
    const [r, g, b] = [0, 1, 2].map((c) => Math.round(frame[i + c]! * k)) as [number, number, number];
    if (format === "gray4") {
      const v = Math.min(15, Math.round(((0.299 * r + 0.587 * g + 0.114 * b) / 255) * 15)) * 17 & 0xf0;
      out[i] = out[i + 1] = out[i + 2] = v;
    } else {
      out[i] = r;
      out[i + 1] = g;
      out[i + 2] = b;
    }
    out[i + 3] = 255;
  }
  return out;
}

test("RLE round-trips for every block size", () => {
  const r = rand(1);
  for (const blk of [1, 3, 4]) {
    for (let n = 0; n < 50; n++) {
      const len = Math.floor(r() * 400) * blk;
      const src = new Uint8Array(len);
      for (let i = 0; i < len; i++) src[i] = r() < 0.6 ? 7 : Math.floor(r() * 4);
      assert.deepEqual(rleDecompress(rleCompress(src, blk), blk), src);
    }
  }
});

for (const format of ["rgb888", "argb8888", "gray4"] as const) {
  test(`${format}: frames survive an encode/decode round trip`, () => {
    const w = format === "gray4" ? 37 : 72; // odd width: an odd pixel count per gray4 frame
    const h = 16;
    const input = frames(w, h, 24, 5, format === "argb8888");
    input[10] = input[9]!.slice(); // an unchanged frame (fully black mask)
    const { data } = encodeAnim({ width: w, height: h, fps: 60, format, frames: input, sections: [{ name: "mid", start: 7, end: 15 }] });
    const decoded = decodeAnim(data);
    assert.equal(decoded.frames.length, input.length);
    assert.deepEqual(decoded.sections.map((s) => [s.name, s.start, s.end]), [["default", 0, 23], ["mid", 7, 15]]);
    decoded.frames.forEach((f, i) => assert.deepEqual(f, expected(input[i]!, format), `frame ${i}`));
  });
}

test("section starts are keyframes, so a section decodes on its own", () => {
  const input = frames(72, 16, 20, 9);
  const { data } = encodeAnim({ width: 72, height: 16, fps: 30, format: "rgb888", frames: input, sections: [{ name: "late", start: 12, end: 19 }] });
  const view = new DataView(data.buffer);
  const late = decodeAnim(data).sections[1]!;
  // The first frame of the section stores every pixel: fully white mask.
  assert.equal(view.getUint8(late.offset) >> 4, 1);
});

test("long mask runs split correctly (runs over 255 pixels)", () => {
  const w = 148;
  const h = 80;
  const a = new Uint8Array(w * h * 4).fill(255);
  const b = a.slice();
  for (const p of [3, 600, 601, 5000, 11839]) b[p * 4] = 0;
  const { data } = encodeAnim({ width: w, height: h, fps: 30, format: "gray4", frames: [a, b, a] });
  const d = decodeAnim(data);
  assert.deepEqual(d.frames[1], expected(b, "gray4"));
  assert.deepEqual(d.frames[2], expected(a, "gray4"));
});

test("re-encodes a stock firmware animation pixel-exactly", (t) => {
  const dir = process.env.STOCK_ANIM_DIR;
  if (!dir) return t.skip("set STOCK_ANIM_DIR to a folder of numbered PNG frames");
  const files = readdirSync(dir).filter((f) => f.endsWith(".png")).sort();
  const pngs = files.map((f) => readPng(join(dir, f)));
  const { width, height } = pngs[0]!;
  const input = pngs.map((p) => p.data);
  const { data, stats } = encodeAnim({ width, height, fps: 60, format: "rgb888", frames: input });
  const decoded = decodeAnim(data);
  decoded.frames.forEach((f, i) => assert.deepEqual(f, expected(input[i]!, "rgb888"), `frame ${i}`));
  t.diagnostic(`${files.length} frames → ${stats.bytes} bytes`);
});

test("soft gradients use QOI and still round-trip", () => {
  const w = 72;
  const h = 16;
  const input = Array.from({ length: 12 }, (_, f) => {
    const fr = new Uint8Array(w * h * 4);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = (y * w + x) * 4;
        const d = Math.hypot(x - 20 - f * 3, (y - 8) * 3);
        fr[i] = Math.max(0, 255 - d * 6);
        fr[i + 1] = Math.max(0, 180 - d * 4);
        fr[i + 2] = 255;
        fr[i + 3] = Math.max(0, Math.min(255, 255 - d * 5));
      }
    }
    return fr;
  });
  const { data } = encodeAnim({ width: w, height: h, fps: 60, format: "argb8888", frames: input });
  const decoded = decodeAnim(data);
  // At least one frame should have picked QOI (pixel encoding 2) over raw and RLE.
  const view = new DataView(data.buffer);
  let pos = 34 + view.getUint32(18, true);
  let qoiFrames = 0;
  for (let f = 0; f < input.length; f++) {
    if ((view.getUint8(pos) & 0xf) === 2) qoiFrames++;
    pos += 5 + Math.ceil(view.getUint16(pos + 1, true) / 8) + view.getUint16(pos + 3, true);
  }
  assert.ok(qoiFrames > 0, "expected QOI to be chosen for a gradient");
  decoded.frames.forEach((f, i) => assert.deepEqual(f, expected(input[i]!, "argb8888"), `frame ${i}`));
});
