// Clips: a duration and a function that draws the clip at a time. Effects are clips; scenes are clips composed
// from them with `seq` (one after another) and `layer` (on top of each other); `buildAnim` renders named clips into
// one .anim, one section each, and reports the section lengths the app needs to sequence them.

import { encodeAnim, type AnimColorFormat, type AnimSection } from "./anim.ts";
import { Raster, type Color } from "./raster.ts";

export interface Clip {
  /** Seconds. */
  readonly duration: number;
  /** Draws the clip at local time `t` (0 ≤ t ≤ duration) onto `r`. */
  draw(r: Raster, t: number): void;
}

export function clip(duration: number, draw: (r: Raster, t: number) => void): Clip {
  return { duration, draw };
}

/** Nothing, for a while (a pause). */
export function pause(duration: number): Clip {
  return clip(duration, () => {});
}

/** Clips back to back. */
export function seq(...clips: Clip[]): Clip {
  const duration = clips.reduce((d, c) => d + c.duration, 0);
  return clip(duration, (r, t) => {
    let start = 0;
    for (const [i, c] of clips.entries()) {
      const last = i === clips.length - 1;
      if (t < start + c.duration || last) {
        c.draw(r, Math.min(c.duration, Math.max(0, t - start)));
        return;
      }
      start += c.duration;
    }
  });
}

export interface Placed {
  clip: Clip;
  /** Start time within the layer, seconds. */
  at?: number;
  /** Keep drawing the clip's last frame after it ends (and its first before it starts). */
  hold?: boolean;
}

/** Clips drawn on top of each other, in order, each from its own start time. */
export function layer(...items: (Clip | Placed)[]): Clip {
  const placed = items.map((i) => ("draw" in i ? { clip: i } : i));
  const duration = placed.reduce((d, p) => Math.max(d, (p.at ?? 0) + p.clip.duration), 0);
  return clip(duration, (r, t) => {
    for (const p of placed) {
      const local = t - (p.at ?? 0);
      if (local < 0 && !p.hold) continue;
      if (local > p.clip.duration && !p.hold) continue;
      p.clip.draw(r, Math.min(p.clip.duration, Math.max(0, local)));
    }
  });
}

/** Stretches or squeezes a clip to a new duration. */
export function retime(c: Clip, duration: number): Clip {
  return clip(duration, (r, t) => c.draw(r, (t / duration) * c.duration));
}

/** Renders a clip to straight-RGBA frames at `fps`. */
export function renderFrames(
  c: Clip,
  o: { width: number; height: number; fps: number; background?: Color },
): Uint8Array[] {
  const count = Math.max(1, Math.round(c.duration * o.fps));
  const frames: Uint8Array[] = [];
  for (let i = 0; i < count; i++) {
    const r = new Raster(o.width, o.height);
    if (o.background) r.clear(o.background);
    c.draw(r, Math.min(c.duration, i / o.fps));
    frames.push(r.toRGBA8());
  }
  return frames;
}

export interface BuiltAnim {
  data: Uint8Array;
  fps: number;
  /** Section name → frames, including "default". */
  sections: Record<string, number>;
}

/**
 * Renders named clips one after another into a single .anim, one section per clip. Each part is rendered on its
 * own, so section boundaries fall exactly on part boundaries.
 */
export function buildAnim(o: {
  width: number;
  height: number;
  fps: number;
  format: AnimColorFormat;
  parts: [name: string, clip: Clip][];
  background?: Color;
}): BuiltAnim {
  const frames: Uint8Array[] = [];
  const sections: AnimSection[] = [];
  for (const [name, c] of o.parts) {
    const part = renderFrames(c, o);
    sections.push({ name, start: frames.length, end: frames.length + part.length - 1 });
    frames.push(...part);
  }
  const named = o.parts.length === 1 && o.parts[0]![0] === "default" ? [] : sections;
  const { data } = encodeAnim({ width: o.width, height: o.height, fps: o.fps, format: o.format, frames, sections: named });
  const lengths: Record<string, number> = { default: frames.length };
  for (const s of sections) lengths[s.name] = s.end - s.start + 1;
  return { data, fps: o.fps, sections: lengths };
}
