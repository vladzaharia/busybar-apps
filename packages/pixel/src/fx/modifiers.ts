// Modifiers: wrap any clip to move, shake, fade or distort it. They render the clip on its own layer first, then
// composite that layer transformed.

import { inCubic, outCubic, rng, span } from "../ease.ts";
import { Raster } from "../raster.ts";
import { MOTION } from "../motion.ts";
import { clip, type Clip } from "../timeline.ts";

function layerOf(r: Raster, c: Clip, t: number): Raster {
  const l = new Raster(r.width, r.height);
  c.draw(l, t);
  return l;
}

/** Shakes the clip between `from` and `to` seconds, `amplitude` pixels sideways (and a little vertically). */
export function shake(c: Clip, o: { from?: number; to?: number; amplitude?: number; vertical?: boolean; hz?: number } = {}): Clip {
  return clip(c.duration, (r, t) => {
    const from = o.from ?? 0;
    const to = o.to ?? c.duration;
    const on = t >= from && t <= to;
    // Strongest at the hit, settling to nothing by `to`.
    const a = (o.amplitude ?? 2) * (on ? 1 - span(t, from, to) : 0);
    const w = (o.hz ?? 10) * Math.PI * 2;
    const dx = Math.round(Math.sin((t - from) * w) * a);
    const dy = o.vertical ? Math.round(Math.cos((t - from) * w * 0.8) * a * 0.5) : 0;
    r.draw(layerOf(r, c, t), dx, dy);
  });
}

/** Slides the clip in from a side over `time` seconds (and out again over the last `time`, if `out`). */
export function slide(c: Clip, o: { from: "left" | "right" | "top" | "bottom"; time?: number; out?: boolean }): Clip {
  return clip(c.duration, (r, t) => {
    const time = o.time ?? MOTION.base;
    const pin = outCubic(span(t, 0, time));
    const pout = o.out ? inCubic(span(t, c.duration - time, c.duration)) : 0;
    const k = 1 - pin + pout;
    const dist = o.from === "left" || o.from === "right" ? r.width : r.height;
    const sign = o.from === "left" || o.from === "top" ? -1 : 1;
    const d = Math.round(sign * dist * k);
    r.draw(layerOf(r, c, t), o.from === "left" || o.from === "right" ? d : 0, o.from === "top" || o.from === "bottom" ? d : 0);
  });
}

/** Fades the clip in at the start and out at the end. */
export function fadeInOut(c: Clip, o: { fadeIn?: number; fadeOut?: number }): Clip {
  return clip(c.duration, (r, t) => {
    const a = Math.min(o.fadeIn ? span(t, 0, o.fadeIn) : 1, o.fadeOut ? 1 - span(t, c.duration - o.fadeOut, c.duration) : 1);
    if (a > 0) r.draw(layerOf(r, c, t), 0, 0, a);
  });
}

/** Digital glitch: random rows shifted sideways and split into colour channels, in bursts. */
export function glitch(c: Clip, o: { seed?: number; intensity?: number; every?: number; burst?: number } = {}): Clip {
  return clip(c.duration, (r, t) => {
    const src = layerOf(r, c, t);
    const every = o.every ?? 1.2;
    const burst = o.burst ?? 0.18;
    const phase = t % every;
    if (phase > burst) {
      r.draw(src, 0, 0);
      return;
    }
    const rand = rng((o.seed ?? 3) + Math.floor(t / every) * 97 + Math.floor(phase * 30));
    const intensity = o.intensity ?? 3;
    for (let y = 0; y < r.height; y++) {
      const shift = rand() < 0.3 ? Math.round((rand() - 0.5) * 2 * intensity) : 0;
      for (let x = 0; x < r.width; x++) {
        const read = (xx: number, ch: number) => {
          const sx = Math.max(0, Math.min(r.width - 1, xx));
          return src.data[(y * r.width + sx) * 4 + ch]!;
        };
        const R = read(x - shift - 1, 0);
        const G = read(x - shift, 1);
        const B = read(x - shift + 1, 2);
        const A = Math.max(read(x - shift - 1, 3), read(x - shift, 3), read(x - shift + 1, 3));
        if (A <= 0) continue;
        r.blend(x, y, { r: R / A, g: G / A, b: B / A, a: A });
      }
    }
  });
}

/** Squashes the clip vertically onto its centre line as it ends (or stretches it out as it starts). */
export function squash(c: Clip, o: { time?: number; at?: "start" | "end" } = {}): Clip {
  return clip(c.duration, (r, t) => {
    const time = o.time ?? 0.22;
    const k = o.at === "start" ? outCubic(span(t, 0, time)) : 1 - inCubic(span(t, c.duration - time, c.duration));
    const src = layerOf(r, c, t);
    const mid = r.height / 2;
    for (let y = 0; y < r.height; y++) {
      const from = Math.round(mid + (y + 0.5 - mid) / Math.max(0.01, k) - 0.5);
      if (from < 0 || from >= r.height) continue;
      for (let x = 0; x < r.width; x++) {
        const i = (from * r.width + x) * 4;
        const a = src.data[i + 3]!;
        if (a > 0) r.blend(x, y, { r: src.data[i]! / a, g: src.data[i + 1]! / a, b: src.data[i + 2]! / a, a });
      }
    }
  });
}

/** Plays a clip faster or slower (it keeps its look, its duration changes). */
export function speed(c: Clip, factor: number): Clip {
  return clip(c.duration / factor, (r, t) => c.draw(r, Math.min(c.duration, t * factor)));
}

/** Holds a clip on its last frame for `extra` seconds. */
export function holdEnd(c: Clip, extra: number): Clip {
  return clip(c.duration + extra, (r, t) => c.draw(r, Math.min(c.duration, t)));
}

