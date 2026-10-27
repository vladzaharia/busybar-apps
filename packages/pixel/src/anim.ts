// Encoder and reference decoder for the BUSY Bar `.anim` format ("bicycle1"), written from the format description
// in the firmware (`lib/anim_file/anim_file_format.h`, `documentation/File Formats.dox.md`).
//
// Layout: header, sections chunk, then one file frame per display frame. Each frame stores a mask of the pixels
// that changed since the previous frame, followed by just those pixels. Section starts are always keyframes, so
// the player can jump to any section. The decoder mirrors the firmware's pipeline and exists for tests and
// previews.

export type AnimColorFormat = "rgb888" | "gray4" | "argb8888";

export interface AnimSection {
  name: string;
  /** First display frame, inclusive. */
  start: number;
  /** Last display frame, inclusive. */
  end: number;
}

export interface AnimInput {
  width: number;
  height: number;
  fps: number;
  format: AnimColorFormat;
  /** Straight-alpha RGBA bytes, `width * height * 4` each. */
  frames: Uint8Array[];
  /** Named ranges, besides the implicit "default" section covering every frame. */
  sections?: AnimSection[];
}

const SIGNATURE = "bicycle1";
const HEADER_SIZE = 34;
const FRAME_HEADER_SIZE = 5;
const FORMAT_ID: Record<AnimColorFormat, number> = { rgb888: 0, gray4: 1, argb8888: 2 };
const FORMAT_NAME: AnimColorFormat[] = ["rgb888", "gray4", "argb8888"];
const BLOCK: Record<AnimColorFormat, number> = { rgb888: 3, gray4: 1, argb8888: 4 };

const Mask = { FullyBlack: 0, FullyWhite: 1, RleFirstBlack: 2, RleFirstWhite: 3, Bitmap: 4 } as const;
type Mask = (typeof Mask)[keyof typeof Mask];

const Pixels = { Raw: 0, Rle: 1, Qoi: 2 } as const;

const SHORT_RUN_BITS = 3;
const LONG_RUN_BITS = 8;
const LONG_RUN_MARKER = (1 << SHORT_RUN_BITS) - 1;
const LONG_RUN_MAX = (1 << LONG_RUN_BITS) - 1;
const RLE_MAX_BLOCKS = 127;
const RLE_THRESHOLD = 3;

// --- Bit packing, most significant bit first --------------------------------------------------------------------

class BitWriter {
  private readonly bytes: number[] = [];
  private acc = 0;
  private used = 0;
  bits = 0;

  push(value: number, count: number): void {
    for (let i = count - 1; i >= 0; i--) {
      this.acc = (this.acc << 1) | ((value >> i) & 1);
      this.used++;
      this.bits++;
      if (this.used === 8) {
        this.bytes.push(this.acc);
        this.acc = 0;
        this.used = 0;
      }
    }
  }

  finish(): Uint8Array {
    if (this.used > 0) this.bytes.push(this.acc << (8 - this.used));
    return Uint8Array.from(this.bytes);
  }
}

class BitReader {
  private pos = 0;
  private readonly data: Uint8Array;
  private readonly bits: number;

  constructor(data: Uint8Array, bits: number) {
    this.data = data;
    this.bits = bits;
  }

  get done(): boolean {
    return this.pos >= this.bits;
  }

  read(count: number): number {
    let v = 0;
    for (let i = 0; i < count && this.pos < this.bits; i++, this.pos++) {
      v = (v << 1) | ((this.data[this.pos >> 3]! >> (7 - (this.pos & 7))) & 1);
    }
    return v;
  }
}

// --- Run-length coding of pixel bytes (the firmware's `toolbox/rle_encode`) -------------------------------------

function sameBlock(a: Uint8Array, i: number, j: number, blk: number): boolean {
  for (let k = 0; k < blk; k++) if (a[i + k] !== a[j + k]) return false;
  return true;
}

/**
 * Control byte `n` repeats the next block n times; `0x80 | n` copies the next n blocks verbatim.
 *
 * Byte for byte the output of the firmware's `rle_compress`: a run of 3 or more blocks is encoded as a repeat, and
 * a verbatim stretch absorbs shorter runs, ending only where a run of 5 or more starts. `src` must be whole blocks
 * (the firmware's encoder reads past the end otherwise; this one drops the partial block).
 */
export function rleCompress(src: Uint8Array, blk: number): Uint8Array {
  const out: number[] = [];
  const blocks = Math.floor(src.length / blk);
  // Block b equals block c; a block past the end equals nothing.
  const same = (b: number, c: number) => c < blocks && sameBlock(src, b * blk, c * blk, blk);
  let i = 0;
  while (i < blocks) {
    let repeat = 1;
    while (repeat < RLE_MAX_BLOCKS && same(i, i + repeat)) repeat++;
    if (repeat >= RLE_THRESHOLD) {
      out.push(repeat);
      for (let k = 0; k < blk; k++) out.push(src[i * blk + k]!);
      i += repeat;
      continue;
    }
    let count = 0;
    let run = 0;
    for (let j = i; ; ) {
      if (same(j, j + 1)) {
        if (++run > RLE_THRESHOLD) break;
      } else {
        count += 1 + run;
        run = 0;
        if (count >= RLE_MAX_BLOCKS) {
          count = RLE_MAX_BLOCKS;
          break;
        }
      }
      if (++j >= blocks) {
        count += run;
        break;
      }
    }
    out.push(0x80 | count);
    for (let k = 0; k < count * blk; k++) out.push(src[i * blk + k]!);
    i += count;
  }
  return Uint8Array.from(out);
}

export function rleDecompress(src: Uint8Array, blk: number): Uint8Array {
  const out: number[] = [];
  let i = 0;
  while (i < src.length) {
    const op = src[i++]!;
    const n = op & 0x7f;
    if (op & 0x80) {
      for (let k = 0; k < n * blk; k++) out.push(src[i + k]!);
      i += n * blk;
    } else {
      for (let r = 0; r < n; r++) for (let k = 0; k < blk; k++) out.push(src[i + k]!);
      i += blk;
    }
  }
  return Uint8Array.from(out);
}

// --- QOI-like coding (headerless; the firmware's AnimFilePixelEncodingQoiLike) -----------------------------------
// Operates on RGBA pixels with a 64-entry colour cache, small deltas from the previous pixel, and runs. Strong on
// gradients and glows, where plain RLE finds no runs.

const QOI_RGB = 0xfe;
const QOI_RGBA = 0xff;
const qoiHash = (r: number, g: number, b: number, a: number) => (r * 3 + g * 5 + b * 7 + a * 11) % 64;

/** `rgba` holds the selected pixels, 4 bytes each (R, G, B, A). */
export function qoiCompress(rgba: Uint8Array): Uint8Array {
  const out: number[] = [];
  const lut = new Uint32Array(64);
  let [lr, lg, lb, la] = [0, 0, 0, 255];
  let lastWasRun = false;
  for (let i = 0; i < rgba.length; i += 4) {
    const r = rgba[i]!;
    const g = rgba[i + 1]!;
    const b = rgba[i + 2]!;
    const a = rgba[i + 3]!;
    const packed = ((r << 24) | (g << 16) | (b << 8) | a) >>> 0;
    const h = qoiHash(r, g, b, a);
    if (r === lr && g === lg && b === lb && a === la) {
      // Extend the previous run byte while its payload stays below the RGB/RGBA tags.
      if (lastWasRun && out[out.length - 1]! + 1 < QOI_RGB) out[out.length - 1]!++;
      else out.push(0xc0);
      lut[h] = packed;
      lastWasRun = true;
      continue;
    }
    lastWasRun = false;
    if (lut[h] === packed) {
      out.push(h);
    } else {
      const dr = r - lr;
      const dg = g - lg;
      const db = b - lb;
      if (a === la && dr >= -2 && dr <= 1 && dg >= -2 && dg <= 1 && db >= -2 && db <= 1) {
        out.push(0x40 | ((dr + 2) << 4) | ((dg + 2) << 2) | (db + 2));
      } else if (a === la && dg >= -32 && dg <= 31 && dr - dg >= -8 && dr - dg <= 7 && db - dg >= -8 && db - dg <= 7) {
        out.push(0x80 | (dg + 32), ((dr - dg + 8) << 4) | (db - dg + 8));
      } else if (a === la) {
        out.push(QOI_RGB, r, g, b);
      } else {
        out.push(QOI_RGBA, r, g, b, a);
      }
      lut[h] = packed;
    }
    [lr, lg, lb, la] = [r, g, b, a];
  }
  return Uint8Array.from(out);
}

/** Decodes to BGRA, as the firmware does (its pixels are little-endian 0xAARRGGBB words). */
export function qoiDecompress(src: Uint8Array): Uint8Array {
  const out: number[] = [];
  const lut: [number, number, number, number][] = Array.from({ length: 64 }, () => [0, 0, 0, 0]);
  let px: [number, number, number, number] = [0, 0, 0, 255];
  const emit = (p: [number, number, number, number]) => {
    px = p;
    lut[qoiHash(p[0], p[1], p[2], p[3])] = p;
    out.push(p[2], p[1], p[0], p[3]);
  };
  for (let i = 0; i < src.length; i++) {
    const tag = src[i]!;
    const payload = tag & 0x3f;
    if (tag === QOI_RGB) {
      emit([src[i + 1]!, src[i + 2]!, src[i + 3]!, px[3]]);
      i += 3;
    } else if (tag === QOI_RGBA) {
      emit([src[i + 1]!, src[i + 2]!, src[i + 3]!, src[i + 4]!]);
      i += 4;
    } else if ((tag & 0xc0) === 0x00) {
      emit([...lut[payload]!]);
    } else if ((tag & 0xc0) === 0x40) {
      emit([(px[0] + ((payload >> 4) & 3) - 2) & 0xff, (px[1] + ((payload >> 2) & 3) - 2) & 0xff, (px[2] + (payload & 3) - 2) & 0xff, px[3]]);
    } else if ((tag & 0xc0) === 0x80) {
      const dg = payload - 32;
      const next = src[++i]!;
      emit([(px[0] + dg + ((next >> 4) & 0xf) - 8) & 0xff, (px[1] + dg) & 0xff, (px[2] + dg + (next & 0xf) - 8) & 0xff, px[3]]);
    } else {
      for (let k = 0; k <= payload; k++) emit([...px]);
    }
  }
  return Uint8Array.from(out);
}

// --- Masks -------------------------------------------------------------------------------------------------------

function encodeMask(mask: boolean[]): { encoding: Mask; data: Uint8Array; bits: number } {
  const runs: number[] = [];
  let value = mask[0]!;
  let run = 0;
  for (const m of mask) {
    if (m === value) run++;
    else {
      runs.push(run);
      value = m;
      run = 1;
    }
  }
  runs.push(run);
  if (runs.length === 1) {
    return { encoding: mask[0] ? Mask.FullyWhite : Mask.FullyBlack, data: new Uint8Array(0), bits: 0 };
  }

  const rle = new BitWriter();
  for (let length of runs) {
    if (length < LONG_RUN_MARKER) {
      rle.push(length, SHORT_RUN_BITS);
      continue;
    }
    // Runs longer than 255 are split with a zero-length run of the other colour in between.
    while (length >= LONG_RUN_MAX) {
      rle.push(LONG_RUN_MARKER, SHORT_RUN_BITS);
      rle.push(LONG_RUN_MAX, LONG_RUN_BITS);
      length -= LONG_RUN_MAX;
      rle.push(0, SHORT_RUN_BITS);
    }
    rle.push(LONG_RUN_MARKER, SHORT_RUN_BITS);
    rle.push(length, LONG_RUN_BITS);
  }
  if (rle.bits <= mask.length * 0.75) {
    return { encoding: mask[0] ? Mask.RleFirstWhite : Mask.RleFirstBlack, data: rle.finish(), bits: rle.bits };
  }

  const bitmap = new BitWriter();
  for (const m of mask) bitmap.push(m ? 1 : 0, 1);
  return { encoding: Mask.Bitmap, data: bitmap.finish(), bits: bitmap.bits };
}

/** Calls `fn` with each covered pixel index, in order, as the firmware's mask iterator does. */
function forEachMasked(encoding: Mask, data: Uint8Array, bits: number, total: number, fn: (i: number) => void): void {
  if (encoding === Mask.FullyBlack) return;
  if (encoding === Mask.FullyWhite) {
    for (let i = 0; i < total; i++) fn(i);
    return;
  }
  const r = new BitReader(data, bits);
  if (encoding === Mask.Bitmap) {
    for (let i = 0; !r.done; i++) if (r.read(1) && i < total) fn(i);
    return;
  }
  let white = encoding === Mask.RleFirstWhite;
  let idx = 0;
  while (!r.done) {
    let run = r.read(SHORT_RUN_BITS);
    if (run === LONG_RUN_MARKER) run = r.read(LONG_RUN_BITS);
    if (white) for (let k = 0; k < run; k++) if (idx + k < total) fn(idx + k);
    idx += run;
    white = !white;
  }
}

// --- Pixel formats -----------------------------------------------------------------------------------------------

/** Quantises a straight RGBA frame to what the format can store; comparisons for the mask happen on this. */
function reduce(frame: Uint8Array, format: AnimColorFormat): Uint8Array {
  const out = new Uint8Array(frame.length);
  for (let i = 0; i < frame.length; i += 4) {
    const a = frame[i + 3]!;
    if (format === "argb8888") {
      // Fully transparent pixels are all the same pixel.
      if (a === 0) continue;
      out.set(frame.subarray(i, i + 4), i);
    } else {
      // Flatten onto black.
      const k = a / 255;
      const r = Math.round(frame[i]! * k);
      const g = Math.round(frame[i + 1]! * k);
      const b = Math.round(frame[i + 2]! * k);
      if (format === "gray4") {
        const level = Math.min(15, Math.round(((0.299 * r + 0.587 * g + 0.114 * b) / 255) * 15));
        const v = level * 17;
        out[i] = out[i + 1] = out[i + 2] = v;
      } else {
        out[i] = r;
        out[i + 1] = g;
        out[i + 2] = b;
      }
      out[i + 3] = 255;
    }
  }
  return out;
}

/** Packs the selected pixels: BGR, BGRA, or two 4-bit greys per byte (earlier pixel in the high nibble). */
function pack(frame: Uint8Array, indices: number[], format: AnimColorFormat): Uint8Array {
  if (format === "gray4") {
    const out = new Uint8Array(Math.ceil(indices.length / 2));
    indices.forEach((p, n) => {
      const level = frame[p * 4]! >> 4;
      out[n >> 1]! |= n % 2 === 0 ? level << 4 : level;
    });
    return out;
  }
  const bpp = format === "rgb888" ? 3 : 4;
  const out = new Uint8Array(indices.length * bpp);
  indices.forEach((p, n) => {
    const s = p * 4;
    out[n * bpp] = frame[s + 2]!;
    out[n * bpp + 1] = frame[s + 1]!;
    out[n * bpp + 2] = frame[s]!;
    if (bpp === 4) out[n * bpp + 3] = frame[s + 3]!;
  });
  return out;
}

// --- Encoder -----------------------------------------------------------------------------------------------------

export interface AnimStats {
  bytes: number;
  frames: number;
  /** Share of pixels skipped because they did not change. */
  skipped: number;
}

export function encodeAnim(input: AnimInput): { data: Uint8Array; stats: AnimStats } {
  const { width, height, fps, format, frames } = input;
  if (!frames.length) throw new Error("anim: no frames");
  if (width < 1 || width > 255 || height < 1 || height > 255) throw new Error("anim: width and height must be 1..255");
  if (fps < 1 || fps > 255) throw new Error("anim: fps must be 1..255");
  const total = width * height;
  for (const [i, f] of frames.entries()) {
    if (f.length !== total * 4) throw new Error(`anim: frame ${i} has the wrong size`);
  }

  const sections: AnimSection[] = [{ name: "default", start: 0, end: frames.length - 1 }, ...(input.sections ?? [])];
  for (const [i, s] of sections.entries()) {
    if (i > 0 && s.name === "default") throw new Error('anim: section name "default" is reserved');
    if (s.start < 0 || s.end >= frames.length || s.start > s.end) throw new Error(`anim: section "${s.name}" is out of range`);
    if (!/^[\x20-\x7e]+$/.test(s.name)) throw new Error(`anim: section "${s.name}" must be printable ASCII`);
  }
  const keyframes = new Set(sections.map((s) => s.start));

  const encoded: { header: Uint8Array; mask: Uint8Array; pixels: Uint8Array }[] = [];
  let previous: Uint8Array | null = null;
  let maxMask = 0;
  let maxPixels = 0;
  let kept = 0;

  frames.forEach((frame, fi) => {
    const reduced = reduce(frame, format);
    const changed: boolean[] = new Array(total);
    const indices: number[] = [];
    for (let p = 0; p < total; p++) {
      let diff = !previous || keyframes.has(fi);
      if (!diff) {
        const o = p * 4;
        diff =
          reduced[o] !== previous![o] ||
          reduced[o + 1] !== previous![o + 1] ||
          reduced[o + 2] !== previous![o + 2] ||
          reduced[o + 3] !== previous![o + 3];
      }
      changed[p] = diff;
      if (diff) indices.push(p);
    }
    kept += indices.length;

    const raw = pack(reduced, indices, format);
    let pixels = raw;
    let encoding: number = Pixels.Raw;
    const rle = rleCompress(raw, BLOCK[format]);
    if (rle.length < pixels.length) [pixels, encoding] = [rle, Pixels.Rle];
    if (format !== "gray4" && indices.length) {
      const rgba = new Uint8Array(indices.length * 4);
      indices.forEach((p, n) => rgba.set(reduced.subarray(p * 4, p * 4 + 4), n * 4));
      const qoi = qoiCompress(rgba);
      if (qoi.length < pixels.length) [pixels, encoding] = [qoi, Pixels.Qoi];
    }
    const mask = encodeMask(changed);

    const header = new Uint8Array(FRAME_HEADER_SIZE);
    const view = new DataView(header.buffer);
    view.setUint8(0, encoding | (mask.encoding << 4));
    view.setUint16(1, mask.bits, true);
    view.setUint16(3, pixels.length, true);
    if (mask.bits > 0xffff || pixels.length > 0xffff) throw new Error(`anim: frame ${fi} is too large`);

    encoded.push({ header, mask: mask.data, pixels });
    maxMask = Math.max(maxMask, mask.bits);
    maxPixels = Math.max(maxPixels, pixels.length);
    previous = reduced;
  });

  // Sections carry the file offset of their first frame, known once every frame's size is.
  const names = sections.map((s) => new TextEncoder().encode(s.name));
  const sectionsLength = sections.reduce((n, _, i) => n + 12 + names[i]!.length + 1, 0);
  const offsets: number[] = [];
  let offset = HEADER_SIZE + sectionsLength;
  for (const f of encoded) {
    offsets.push(offset);
    offset += f.header.length + f.mask.length + f.pixels.length;
  }
  const framesLength = offset - HEADER_SIZE - sectionsLength;

  const out = new Uint8Array(offset);
  const view = new DataView(out.buffer);
  out.set(new TextEncoder().encode(SIGNATURE), 0);
  view.setUint8(8, 0);
  view.setUint8(9, width);
  view.setUint8(10, height);
  view.setUint8(11, FORMAT_ID[format]);
  view.setUint16(12, maxMask, true);
  view.setUint16(14, maxPixels, true);
  view.setUint8(16, fps);
  view.setUint8(17, 0);
  view.setUint32(18, sectionsLength, true);
  view.setUint32(22, framesLength, true);
  view.setUint32(26, sections.length, true);
  view.setUint32(30, frames.length, true);

  let pos = HEADER_SIZE;
  sections.forEach((s, i) => {
    view.setUint32(pos, s.start, true);
    view.setUint32(pos + 4, s.end, true);
    view.setUint32(pos + 8, offsets[s.start]!, true);
    out.set(names[i]!, pos + 12);
    out[pos + 12 + names[i]!.length] = 0;
    pos += 12 + names[i]!.length + 1;
  });
  for (const f of encoded) {
    out.set(f.header, pos);
    out.set(f.mask, pos + f.header.length);
    out.set(f.pixels, pos + f.header.length + f.mask.length);
    pos += f.header.length + f.mask.length + f.pixels.length;
  }

  return { data: out, stats: { bytes: out.length, frames: frames.length, skipped: 1 - kept / (total * frames.length) } };
}

// --- Decoder ------------------------------------------------------------------------------------------------------

export interface DecodedSection extends AnimSection {
  /** File offset of the section's first frame. */
  offset: number;
}

/**
 * Decodes a .anim one frame at a time into a persistent canvas, as the firmware's player does: frames only carry
 * the pixels that changed, so they must be decoded in order, except at section starts, which are keyframes and
 * can be jumped to. Validates the file the way the firmware's loader does.
 */
export class AnimReader {
  readonly width: number;
  readonly height: number;
  readonly fps: number;
  readonly format: AnimColorFormat;
  readonly frameCount: number;
  readonly sections: DecodedSection[];
  /** Straight RGBA, the current frame. */
  readonly canvas: Uint8Array;
  private readonly data: Uint8Array;
  private readonly view: DataView;
  private readonly offsets: number[];
  private readonly maxMask: number;
  private readonly maxPixels: number;
  private current = -1;

  constructor(data: Uint8Array) {
    this.data = data;
    const view = (this.view = new DataView(data.buffer, data.byteOffset, data.byteLength));
    if (new TextDecoder().decode(data.subarray(0, 8)) !== SIGNATURE) throw new Error("anim: bad signature");
    this.width = view.getUint8(9);
    this.height = view.getUint8(10);
    const format = FORMAT_NAME[view.getUint8(11)];
    if (!format) throw new Error("anim: bad colour format");
    this.format = format;
    this.maxMask = view.getUint16(12, true);
    this.maxPixels = view.getUint16(14, true);
    this.fps = view.getUint8(16);
    const sectionsLength = view.getUint32(18, true);
    const framesLength = view.getUint32(22, true);
    const sectionCount = view.getUint32(26, true);
    this.frameCount = view.getUint32(30, true);
    if (!sectionCount || !this.frameCount) throw new Error("anim: empty");
    if (data.length !== HEADER_SIZE + sectionsLength + framesLength) throw new Error("anim: size mismatch");
    if (data[HEADER_SIZE + sectionsLength - 1] !== 0) throw new Error("anim: bad sections chunk termination");

    this.sections = [];
    let pos = HEADER_SIZE;
    while (pos < HEADER_SIZE + sectionsLength) {
      const start = view.getUint32(pos, true);
      const end = view.getUint32(pos + 4, true);
      const offset = view.getUint32(pos + 8, true);
      let z = pos + 12;
      while (data[z] !== 0) z++;
      this.sections.push({ name: new TextDecoder().decode(data.subarray(pos + 12, z)), start, end, offset });
      pos = z + 1;
    }
    if (this.sections.length !== sectionCount) throw new Error("anim: section count mismatch");
    const first = this.sections[0]!;
    if (first.name !== "default" || first.start !== 0 || first.end !== this.frameCount - 1 || first.offset !== HEADER_SIZE + sectionsLength) {
      throw new Error("anim: invalid default section");
    }

    // Index every frame's offset once.
    this.offsets = [];
    pos = HEADER_SIZE + sectionsLength;
    for (let f = 0; f < this.frameCount; f++) {
      this.offsets.push(pos);
      pos += FRAME_HEADER_SIZE + Math.ceil(view.getUint16(pos + 1, true) / 8) + view.getUint16(pos + 3, true);
    }
    if (pos !== data.length) throw new Error("anim: frames do not fill the frames chunk");
    for (const s of this.sections) {
      if (s.end >= this.frameCount || s.start > s.end) throw new Error(`anim: section "${s.name}" is out of range`);
      if (s.offset !== this.offsets[s.start]) throw new Error(`anim: section "${s.name}" offset does not match its first frame`);
    }
    this.canvas = new Uint8Array(this.width * this.height * 4);
  }

  section(name: string): DecodedSection | undefined {
    return this.sections.find((s) => s.name === name);
  }

  /** Decodes frame `f` into `canvas` and returns it. Out-of-order frames must be keyframes (section starts). */
  frame(f: number): Uint8Array {
    if (f === this.current) return this.canvas;
    const { view, data, format } = this;
    const total = this.width * this.height;
    const pos = this.offsets[f];
    if (pos === undefined) throw new Error(`anim: no frame ${f}`);
    const joint = view.getUint8(pos);
    const maskBits = view.getUint16(pos + 1, true);
    const pixelBytes = view.getUint16(pos + 3, true);
    const maskEnc = (joint >> 4) as Mask;
    const pxEnc = joint & 0xf;
    if (maskEnc > Mask.Bitmap || pxEnc > Pixels.Qoi) throw new Error(`anim: frame ${f} has an unsupported encoding`);
    if (maskEnc >= Mask.RleFirstBlack ? maskBits > this.maxMask : maskBits !== 0) throw new Error(`anim: frame ${f} mask length invalid`);
    if (pxEnc !== Pixels.Raw && pixelBytes > this.maxPixels) throw new Error(`anim: frame ${f} pixel length invalid`);
    const maskData = data.subarray(pos + FRAME_HEADER_SIZE, pos + FRAME_HEADER_SIZE + Math.ceil(maskBits / 8));
    const pxStart = pos + FRAME_HEADER_SIZE + Math.ceil(maskBits / 8);
    let packed = data.subarray(pxStart, pxStart + pixelBytes);
    if (pxEnc === Pixels.Rle) packed = rleDecompress(packed, BLOCK[format]);

    // Unpack to BGRA (QOI already decodes to it), then disperse into the canvas along the mask.
    let bgra: Uint8Array;
    if (pxEnc === Pixels.Qoi) {
      bgra = qoiDecompress(packed);
    } else if (format === "gray4") {
      bgra = new Uint8Array(packed.length * 8);
      packed.forEach((byte, i) => {
        const hi = byte & 0xf0;
        const lo = (byte << 4) & 0xf0;
        bgra.set([hi, hi, hi, 255, lo, lo, lo, 255], i * 8);
      });
    } else if (format === "rgb888") {
      bgra = new Uint8Array((packed.length / 3) * 4);
      for (let i = 0, o = 0; i < packed.length; i += 3, o += 4) bgra.set([packed[i]!, packed[i + 1]!, packed[i + 2]!, 255], o);
    } else {
      bgra = packed;
    }
    const canvas = this.canvas;
    let n = 0;
    forEachMasked(maskEnc, maskData, maskBits, total, (p) => {
      if (n * 4 >= bgra.length) throw new Error(`anim: frame ${f} has too few pixels`);
      canvas[p * 4] = bgra[n * 4 + 2]!;
      canvas[p * 4 + 1] = bgra[n * 4 + 1]!;
      canvas[p * 4 + 2] = bgra[n * 4]!;
      canvas[p * 4 + 3] = bgra[n * 4 + 3]!;
      n++;
    });
    const leftover = bgra.length / 4 - n;
    if (leftover > (format === "gray4" ? 1 : 0)) throw new Error(`anim: frame ${f} has ${leftover} leftover pixels`);
    this.current = f;
    return canvas;
  }
}

export interface DecodedAnim {
  width: number;
  height: number;
  fps: number;
  format: AnimColorFormat;
  sections: DecodedSection[];
  /** Straight RGBA bytes per display frame, as the player would show them played from the start. */
  frames: Uint8Array[];
}

/** Decodes every frame of a file (for tests and small files; use AnimReader to play big ones). */
export function decodeAnim(data: Uint8Array): DecodedAnim {
  const reader = new AnimReader(data);
  const frames: Uint8Array[] = [];
  for (let f = 0; f < reader.frameCount; f++) frames.push(reader.frame(f).slice());
  return { width: reader.width, height: reader.height, fps: reader.fps, format: reader.format, sections: reader.sections, frames };
}
