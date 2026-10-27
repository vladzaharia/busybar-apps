import { readFileSync, writeFileSync } from "node:fs";
import { PNG } from "pngjs";

export interface Bitmap {
  width: number;
  height: number;
  /** Straight RGBA bytes. */
  data: Uint8Array;
}

export function readPng(path: string): Bitmap {
  const png = PNG.sync.read(readFileSync(path));
  return { width: png.width, height: png.height, data: new Uint8Array(png.data) };
}

export function writePng(path: string, bitmap: Bitmap): void {
  const png = new PNG({ width: bitmap.width, height: bitmap.height });
  png.data = Buffer.from(bitmap.data);
  writeFileSync(path, PNG.sync.write(png));
}

/** Stacks equally sized frames vertically into one sprite sheet. */
export function sheet(frames: Uint8Array[], width: number, height: number): Bitmap {
  const data = new Uint8Array(width * height * 4 * frames.length);
  frames.forEach((f, i) => data.set(f, i * width * height * 4));
  return { width, height: height * frames.length, data };
}
