// Checks the clean-room `.anim` codec against the firmware's own code, from a checkout of the firmware repository:
//
//   node scripts/conformance.ts <firmware-checkout> [--python <python3>] [file.anim | folder ...]
//
// 1. The firmware's RLE unit tests (applications/debug/unit_tests/rle_test/rle_test.c and scripts/flipper/rle.py's
//    test_rle), ported: random data with inserted runs, every block size 1..8, round-tripped through our codec and
//    across to the firmware's C `toolbox/rle_encode` (compiled here) and the Python reference. Our compressor must
//    produce the C compressor's output byte for byte.
// 2. QOI: our compressor against seq2anim's `qoi_headerless_compress`, byte for byte.
// 3. Whole files: synthetic frame sequences in every colour format through seq2anim.py and through `encodeAnim`,
//    compared frame by frame (header, sections, masks and pixels), and both decoded by the firmware's decoder.
// 4. Every given `.anim` (by default each app's built animations) decoded section by section by the firmware's
//    `lib/anim_file`, compiled for the host, and compared with `AnimReader` pixel for pixel.
//
// Needs gcc, and for 1 (Python part), 2 and 3 a Python with Pillow and colorlog (the firmware tools' imports).

import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { AnimReader, encodeAnim, qoiCompress, rleCompress, rleDecompress, type AnimColorFormat, type AnimSection } from "../src/anim.ts";
import { writePng } from "../src/png.ts";

const here = dirname(fileURLToPath(import.meta.url));
const harness = join(here, "../conformance");
const repo = resolve(here, "../../..");

const args = process.argv.slice(2);
const fw = args.shift();
if (!fw || !existsSync(join(fw, "lib/anim_file"))) {
  console.error("usage: node scripts/conformance.ts <firmware-checkout> [--python <python3>] [file.anim | folder ...]");
  process.exit(2);
}
let python = "python3";
const inputs: string[] = [];
for (let i = 0; i < args.length; i++) {
  if (args[i] === "--python") python = args[++i]!;
  else inputs.push(args[i]!);
}

const work = mkdtempSync(join(tmpdir(), "anim-conformance-"));
process.on("exit", () => rmSync(work, { recursive: true, force: true }));

// --- Reporting ----------------------------------------------------------------------------------------------------

let failures = 0;
function report(name: string, passed: number, total: number, note = ""): void {
  const ok = passed === total;
  if (!ok) failures++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}: ${passed}/${total}${note ? `  (${note})` : ""}`);
}
const equal = (a: Uint8Array, b: Uint8Array) => a.length === b.length && a.every((v, i) => v === b[i]);
const hex = (b: Uint8Array) => Buffer.from(b).toString("hex");
const unhex = (s: string) => new Uint8Array(Buffer.from(s, "hex"));

function rand(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
}
const randint = (r: () => number, lo: number, hi: number) => lo + Math.floor(r() * (hi - lo + 1));

// --- Build the firmware harnesses ------------------------------------------------------------------------------

const lib = join(fw, "lib");
const cflags = ["-std=gnu2x", "-O1", "-w", "-I", join(harness, "host"), "-I", lib, "-I", join(lib, "anim_file"), "-I", join(lib, "anim_file/components")];
function gcc(out: string, sources: string[]): string {
  const bin = join(work, out);
  const r = spawnSync("gcc", [...cflags, "-o", bin, ...sources, "-lm"], { encoding: "utf8" });
  if (r.status !== 0) {
    console.error(r.stderr || r.error?.message);
    process.exit(2);
  }
  return bin;
}
const rleBin = gcc("rle", [join(harness, "rle.c"), join(lib, "toolbox/rle_encode.c")]);
const decodeBin = gcc("decode", [
  join(harness, "decode.c"),
  join(lib, "anim_file/anim_file.c"),
  ...readdirSync(join(lib, "anim_file/components")).filter((f) => f.endsWith(".c")).map((f) => join(lib, "anim_file/components", f)),
  join(lib, "toolbox/rle_encode.c"),
  join(lib, "toolbox/bit_queue.c"),
  join(harness, "host/dsp.c"),
]);

/** Runs records through the firmware's C rle_compress / rle_decompress. */
function cRle(records: { op: "c" | "d"; blk: number; data: Uint8Array }[]): (Uint8Array | null)[] {
  const parts: Buffer[] = [];
  for (const { op, blk, data } of records) {
    const head = Buffer.alloc(9);
    head.write(op, 0);
    head.writeUInt32LE(blk, 1);
    head.writeUInt32LE(data.length, 5);
    parts.push(head, Buffer.from(data));
  }
  const r = spawnSync(rleBin, { input: Buffer.concat(parts), maxBuffer: 1 << 28 });
  if (r.status !== 0) throw new Error("rle harness failed");
  const out: (Uint8Array | null)[] = [];
  let pos = 0;
  const buf = r.stdout;
  for (let i = 0; i < records.length; i++) {
    const ok = buf[pos]!;
    const len = buf.readUInt32LE(pos + 1);
    out.push(ok ? new Uint8Array(buf.subarray(pos + 5, pos + 5 + len)) : null);
    pos += 5 + len;
  }
  return out;
}

/** Runs requests through the firmware's Python tools; null when Python or its packages are missing. */
function py(requests: object[]): string[] | null {
  const r = spawnSync(python, ["-I", join(harness, "reference.py"), fw!], {
    input: requests.map((q) => JSON.stringify(q)).join("\n") + "\n",
    encoding: "utf8",
    maxBuffer: 1 << 28,
  });
  if (r.status !== 0) {
    if (!pyWarned) console.log(`SKIP  Python reference unavailable (${(r.stderr || r.error?.message || "").trim().split("\n").pop()})`);
    pyWarned = true;
    return null;
  }
  return r.stdout.trim().split("\n").map((l) => JSON.parse(l).out as string);
}
let pyWarned = false;

/** Decodes sections through the firmware's lib/anim_file; one BGRA buffer per frame shown. */
function fwDecode(file: string, sections: string[], frameBytes: number): Uint8Array[] | string {
  const out = join(work, "frames.bin");
  const r = spawnSync(decodeBin, [file, out, ...sections], { encoding: "utf8" });
  if (r.status !== 0) return (r.stderr || `exit ${r.status}`).trim();
  const data = readFileSync(out);
  const frames: Uint8Array[] = [];
  for (let p = 0; p < data.length; p += frameBytes) frames.push(new Uint8Array(data.subarray(p, p + frameBytes)));
  return frames;
}

// --- 1. RLE: the firmware's unit tests, ported --------------------------------------------------------------------

/** rle_test.c: 512 bytes of rand() % 255, three runs of 5..14 blocks of the pattern 0, 1, .., blk-1. */
function rleTestC(blk: number, r: () => number): Uint8Array {
  const data = new Uint8Array(512 - (512 % blk));
  for (let i = 0; i < data.length; i++) data[i] = Math.floor(r() * 255);
  for (let k = 0; k < 3; k++) {
    const bytes = randint(r, 5, 14) * blk;
    const at = Math.floor(r() * (data.length - bytes));
    for (let j = 0; j < bytes; j++) data[at + j] = j % blk;
  }
  return data;
}

/** rle.py test_rle_single: random bytes, three runs of 5..10 blocks. */
function rleTestPy(blk: number, r: () => number): Uint8Array {
  const data = new Uint8Array(512 - (512 % blk));
  for (let i = 0; i < data.length; i++) data[i] = Math.floor(r() * 256);
  for (let k = 0; k < 3; k++) {
    const bytes = randint(r, 5, 10) * blk;
    const at = randint(r, 0, data.length - bytes - 1);
    for (let j = 0; j < bytes; j++) data[at + j] = j % blk;
  }
  return data;
}

/** Boundary cases: run and verbatim lengths around 3, 5 and 127, runs at the very end, tiny inputs. */
function rleEdges(blk: number): Uint8Array[] {
  const block = (v: number) => Array.from({ length: blk }, (_, k) => (v * 31 + k * 7) & 0xff);
  const make = (...parts: [value: number | "distinct", count: number][]) => {
    let next = 1000;
    const out: number[] = [];
    for (const [v, n] of parts) for (let i = 0; i < n; i++) out.push(...block(v === "distinct" ? next++ : v));
    return Uint8Array.from(out);
  };
  const cases: Uint8Array[] = [new Uint8Array(0), make([1, 1])];
  for (const n of [2, 3, 4, 5, 6, 126, 127, 128, 129, 254, 255, 256, 400]) {
    cases.push(make([1, n]), make(["distinct", n]), make(["distinct", 3], [1, n]), make([1, n], ["distinct", 2]));
  }
  for (const run of [2, 3, 4, 5]) {
    cases.push(make(["distinct", 4], [7, run], ["distinct", 4]), make(["distinct", 125], [7, run]), make(["distinct", 126], [7, run], ["distinct", 3]));
  }
  cases.push(make([1, 2], [2, 2], [3, 2], [4, 2], [5, 2]), make(["distinct", 200], [9, 4], ["distinct", 1], [9, 5]));
  return cases;
}

const BLOCKS = [1, 2, 3, 4, 5, 6, 7, 8];
const SEEDS = 100;
{
  const r = rand(0xc0ffee);
  const vectors: { blk: number; data: Uint8Array; kind: "c" | "py" | "edge" }[] = [];
  for (const blk of BLOCKS) {
    for (let s = 0; s < SEEDS; s++) vectors.push({ blk, data: rleTestC(blk, r), kind: "c" });
    for (let s = 0; s < SEEDS; s++) vectors.push({ blk, data: rleTestPy(blk, r), kind: "py" });
    for (const data of rleEdges(blk)) vectors.push({ blk, data, kind: "edge" });
  }
  const ours = vectors.map((v) => rleCompress(v.data, v.blk));
  const theirs = cRle(vectors.map((v) => ({ op: "c", blk: v.blk, data: v.data })));
  const fwOfOurs = cRle(vectors.map((v, i) => ({ op: "d", blk: v.blk, data: ours[i]! })));

  for (const kind of ["c", "py", "edge"] as const) {
    const idx = vectors.flatMap((v, i) => (v.kind === kind ? [i] : []));
    const label = { c: "rle_test.c", py: "rle.py test_rle", edge: "RLE edge cases" }[kind];
    report(`${label}: our compress -> our decompress`, idx.filter((i) => equal(rleDecompress(ours[i]!, vectors[i]!.blk), vectors[i]!.data)).length, idx.length);
    report(`${label}: our compress -> firmware rle_decompress`, idx.filter((i) => fwOfOurs[i] && equal(fwOfOurs[i]!, vectors[i]!.data)).length, idx.length);
    report(`${label}: our compress == firmware rle_compress, byte for byte`, idx.filter((i) => theirs[i] && equal(theirs[i]!, ours[i]!)).length, idx.length);
    report(`${label}: firmware rle_compress -> our decompress`, idx.filter((i) => theirs[i] && equal(rleDecompress(theirs[i]!, vectors[i]!.blk), vectors[i]!.data)).length, idx.length);
  }

  // The Python reference: decodes ours, and ours decodes its output.
  const answers = py([
    ...vectors.map((v, i) => ({ op: "rle_decompress", blk: v.blk, data: hex(ours[i]!) })),
    ...vectors.map((v) => ({ op: "rle_compress", blk: v.blk, data: hex(v.data) })),
  ]);
  if (answers) {
    const n = vectors.length;
    const pyOfOurs = answers.slice(0, n).map(unhex);
    const pyOut = answers.slice(n).map(unhex);
    report("rle.py decompress <- our compress", vectors.filter((v, i) => equal(pyOfOurs[i]!, v.data)).length, n);
    report("rle.py compress -> our decompress", vectors.filter((v, i) => equal(rleDecompress(pyOut[i]!, v.blk), v.data)).length, n);
    const same = vectors.filter((_, i) => equal(pyOut[i]!, theirs[i]!)).length;
    console.log(`INFO  rle.py compress == firmware rle_compress on ${same}/${n}; it differs when a verbatim stretch ends at a run of 5+ (it keeps 4 of the run in the verbatim)`);
  }
}

// --- 2. QOI against seq2anim ----------------------------------------------------------------------------------------

function qoiVectors(): Uint8Array[] {
  const r = rand(7);
  const out: Uint8Array[] = [];
  const px = (n: number, f: (i: number) => [number, number, number, number]) => {
    const a = new Uint8Array(n * 4);
    for (let i = 0; i < n; i++) a.set(f(i), i * 4);
    return a;
  };
  out.push(px(1, () => [0, 0, 0, 255]), px(1, () => [0, 0, 0, 0]), px(400, () => [9, 9, 9, 255]), px(130, () => [1, 2, 3, 4]));
  for (let s = 0; s < 40; s++) {
    const step = randint(r, 0, 40);
    const alpha = s % 3;
    out.push(
      px(randint(r, 1, 1500), (i) => {
        const v = (Math.floor(i / randint(r, 1, 4)) * step) & 0xff;
        const a = alpha === 0 ? 255 : alpha === 1 ? (r() < 0.2 ? 0 : 255) : Math.floor(r() * 256);
        return r() < 0.1 ? [Math.floor(r() * 256), Math.floor(r() * 256), Math.floor(r() * 256), a] : [v, (v + step) & 0xff, (v * 2) & 0xff, a];
      }),
    );
  }
  return out;
}
{
  const vectors = qoiVectors();
  const answers = py(vectors.map((v) => ({ op: "qoi", data: hex(v) })));
  if (answers) report("QOI: our compress == seq2anim qoi_headerless_compress, byte for byte", vectors.filter((v, i) => equal(qoiCompress(v), unhex(answers[i]!))).length, vectors.length);
}

// --- 3. Whole files against seq2anim --------------------------------------------------------------------------------

interface ParsedFrame {
  joint: number;
  maskBits: number;
  mask: Uint8Array;
  pixels: Uint8Array;
}
function parse(data: Uint8Array) {
  const v = new DataView(data.buffer, data.byteOffset, data.byteLength);
  const sectionsLength = v.getUint32(18, true);
  const sections: { start: number; end: number; name: string }[] = [];
  for (let p = 34; p < 34 + sectionsLength; ) {
    const end = data.indexOf(0, p + 12);
    sections.push({ start: v.getUint32(p, true), end: v.getUint32(p + 4, true), name: Buffer.from(data.subarray(p + 12, end)).toString() });
    p = end + 1;
  }
  const frames: ParsedFrame[] = [];
  for (let p = 34 + sectionsLength; p < data.length; ) {
    const maskBits = v.getUint16(p + 1, true);
    const maskBytes = Math.ceil(maskBits / 8);
    const pxLen = v.getUint16(p + 3, true);
    frames.push({ joint: data[p]!, maskBits, mask: data.subarray(p + 5, p + 5 + maskBytes), pixels: data.subarray(p + 5 + maskBytes, p + 5 + maskBytes + pxLen) });
    p += 5 + maskBytes + pxLen;
  }
  return { flags: data[8]!, width: data[9]!, height: data[10]!, format: data[11]!, fps: data[16]!, sections, frames };
}

/** Frames whose content both encoders read the same way: opaque for rgb888, 16 exact greys, (0,0,0,0) for clear. */
function sequence(format: AnimColorFormat, w: number, h: number, n: number, seed: number): Uint8Array[] {
  const r = rand(seed);
  const noise = Array.from({ length: w * h }, () => [r(), r(), r(), r()]);
  return Array.from({ length: n }, (_, f) => {
    const fr = new Uint8Array(w * h * 4);
    const scene = Math.floor(f / 6) % 4; // flat, gradient, noise, sprite: each favours a different pixel encoding
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = (y * w + x) * 4;
        const nz = noise[y * w + x]!;
        let c: [number, number, number, number];
        if (scene === 0) c = x < (f * 5) % w ? [40, 90, 250, 255] : [0, 0, 0, 255];
        else if (scene === 1) {
          const d = Math.hypot(x - ((f * 4) % w), (y - h / 2) * 2);
          c = [Math.max(0, 255 - d * 5), Math.max(0, 200 - d * 3), 255, Math.max(0, Math.min(255, 300 - d * 7))];
        } else if (scene === 2) c = nz[0]! < 0.5 + ((f % 6) - 3) / 10 ? [nz[1]! * 255, nz[2]! * 255, nz[3]! * 255, nz[0]! * 510] : [0, 0, 0, 0];
        else {
          const inside = Math.abs(x - ((f * 3) % w)) < 6 && Math.abs(y - h / 2) < 4;
          c = inside ? [255, 255, 255, 255] : [20, 20, 30, (x + y + f) % 9 === 0 ? 255 : 0];
        }
        c = c.map((v) => Math.round(Math.min(255, Math.max(0, v)))) as typeof c;
        if (format === "rgb888") c[3] = 255;
        if (format === "gray4") {
          const g = Math.round((c[0] / 255) * 15) * 17;
          c = [g, g, g, 255];
        }
        if (format === "argb8888" && c[3] === 0) c = [0, 0, 0, 0];
        fr.set(c, i);
      }
    }
    return fr;
  });
}

/** What both decoders should show for a frame: BGRA, greys as 4-bit levels. */
function expectedBgra(frame: Uint8Array, format: AnimColorFormat): Uint8Array {
  const out = new Uint8Array(frame.length);
  for (let i = 0; i < frame.length; i += 4) {
    const g = format === "gray4" ? frame[i]! & 0xf0 : 0;
    out.set(format === "gray4" ? [g, g, g, 255] : [frame[i + 2]!, frame[i + 1]!, frame[i]!, format === "rgb888" ? 255 : frame[i + 3]!], i);
  }
  return out;
}

{
  const cases: { format: AnimColorFormat; w: number; h: number; fps: number; sections: AnimSection[] }[] = [
    { format: "rgb888", w: 72, h: 16, fps: 60, sections: [{ name: "b", start: 7, end: 20 }, { name: "c", start: 30, end: 47 }] },
    { format: "argb8888", w: 72, h: 16, fps: 60, sections: [{ name: "b", start: 7, end: 20 }, { name: "c", start: 30, end: 47 }] },
    { format: "gray4", w: 148, h: 80, fps: 30, sections: [{ name: "b", start: 5, end: 29 }] },
    { format: "gray4", w: 37, h: 9, fps: 30, sections: [{ name: "odd", start: 3, end: 40 }] },
  ];
  const requests: object[] = [];
  const built = cases.map((c, k) => {
    const frames = sequence(c.format, c.w, c.h, 48, 100 + k);
    const dir = join(work, `seq${k}`);
    mkdirSync(dir);
    frames.forEach((data, f) => writePng(join(dir, `frame_${f}.png`), { width: c.w, height: c.h, data }));
    writeFileSync(join(dir, "meta.json"), JSON.stringify({ fps: c.fps, color_mode: c.format, sections: c.sections }));
    const out = join(work, `seq${k}.anim`);
    requests.push({ op: "convert", dir, out });
    const ours = join(work, `ours${k}.anim`);
    writeFileSync(ours, encodeAnim({ width: c.w, height: c.h, fps: c.fps, format: c.format, frames, sections: c.sections }).data);
    return { ...c, frames, theirs: out, ours };
  });

  if (py(requests)) {
    let frames = 0;
    let identical = 0;
    let explained = 0;
    let headerOk = 0;
    let decodedOk = 0;
    const notes: Record<string, number> = {};
    for (const c of built) {
      const a = parse(new Uint8Array(readFileSync(c.theirs)));
      const b = parse(new Uint8Array(readFileSync(c.ours)));
      if (a.flags === b.flags && a.width === b.width && a.height === b.height && a.format === b.format && a.fps === b.fps && JSON.stringify(a.sections) === JSON.stringify(b.sections)) headerOk++;
      const keyframes = new Set(a.sections.map((s) => s.start));
      a.frames.forEach((fa, f) => {
        const fb = b.frames[f]!;
        frames++;
        const maskSame = fa.joint >> 4 === fb.joint >> 4 && fa.maskBits === fb.maskBits && equal(fa.mask, fb.mask);
        if (maskSame && fa.joint === fb.joint && equal(fa.pixels, fb.pixels)) return void identical++;
        // A different pixel encoding is fine only for the two known reasons.
        let why = "";
        const encA = fa.joint & 0xf;
        const encB = fb.joint & 0xf;
        if (maskSame && encB === 2 && encA !== 2 && keyframes.has(f) && fb.pixels.length < fa.pixels.length) why = "QOI on a keyframe (seq2anim only tries QOI between keyframes)";
        else if (maskSame && encA !== 2 && encB !== 2) {
          const blk = { 0: 3, 1: 1, 2: 4 }[a.format]!;
          const raw = encA === 1 ? rleDecompress(fa.pixels, blk) : fa.pixels;
          const rawB = encB === 1 ? rleDecompress(fb.pixels, blk) : fb.pixels;
          if (equal(raw, rawB) && (encB === 0 || equal(fb.pixels, rleCompress(raw, blk))) && fb.pixels.length <= fa.pixels.length) why = "rle.py output, where it differs from the firmware's rle_compress";
        }
        if (why) {
          explained++;
          notes[why] = (notes[why] ?? 0) + 1;
        } else console.log(`      ${c.format} ${c.w}x${c.h} frame ${f}: unexplained difference (joint ${fa.joint} vs ${fb.joint})`);
      });
      // Both files through the firmware's decoder, every section.
      const names = a.sections.map((s) => s.name);
      const bytes = c.w * c.h * 4;
      const da = fwDecode(c.theirs, names, bytes);
      const db = fwDecode(c.ours, names, bytes);
      const want = a.sections.flatMap((s) => c.frames.slice(s.start, s.end + 1).map((fr) => expectedBgra(fr, c.format)));
      if (typeof db === "string") console.log(`      ours ${c.format}: ${db}`);
      if (typeof da !== "string" && typeof db !== "string" && da.length === want.length && db.length === want.length && want.every((w, i) => equal(w, da[i]!) && equal(w, db[i]!))) decodedOk++;
    }
    report("seq2anim vs encodeAnim: header and sections", headerOk, built.length);
    report("seq2anim vs encodeAnim: frames identical or differing only as known", identical + explained, frames, `${identical} identical; ${Object.entries(notes).map(([k, v]) => `${v}: ${k}`).join("; ") || "no others"}`);
    report("seq2anim and encodeAnim files decode to the source frames in the firmware decoder", decodedOk, built.length);
  }
}

// --- 4. The firmware's decoder on our files ---------------------------------------------------------------------

function animFiles(paths: string[]): string[] {
  return paths.flatMap((p) => (statSync(p).isDirectory() ? readdirSync(p).flatMap((f) => animFiles([join(p, f)])) : p.endsWith(".anim") ? [p] : []));
}
{
  const defaults = readdirSync(join(repo, "apps"))
    .map((a) => join(repo, "apps", a, "src/animations"))
    .filter((d) => existsSync(d));
  const files = animFiles(inputs.length ? inputs : defaults);
  if (!files.length) console.log("SKIP  no .anim files given or built (run `pnpm build` in an app first)");
  let ok = 0;
  let frames = 0;
  for (const file of files) {
    const reader = new AnimReader(new Uint8Array(readFileSync(file)));
    const bytes = reader.width * reader.height * 4;
    const got = fwDecode(file, reader.sections.map((s) => s.name), bytes);
    let bad = typeof got === "string" ? got : "";
    let n = 0;
    if (typeof got !== "string") {
      for (const s of reader.sections) {
        for (let f = s.start; f <= s.end && !bad; f++, n++) {
          const rgba = reader.frame(f);
          const fwFrame = got[n];
          if (!fwFrame) bad = `section "${s.name}" ends early`;
          else if (!fwFrame.every((v, i) => v === rgba[(i & ~3) | [2, 1, 0, 3][i & 3]!])) bad = `section "${s.name}" frame ${f} differs`;
        }
      }
      if (!bad && n !== got.length) bad = `firmware showed ${got.length} frames, expected ${n}`;
    }
    frames += n;
    if (bad) console.log(`      ${file}: ${bad}`);
    else ok++;
  }
  if (files.length) report("firmware lib/anim_file decodes .anim files exactly as AnimReader does", ok, files.length, `${frames} frames over every section`);
}

console.log(failures ? `\n${failures} check(s) failed` : "\nAll checks passed");
process.exit(failures ? 1 : 0);
