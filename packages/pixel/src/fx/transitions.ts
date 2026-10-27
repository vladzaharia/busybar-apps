// Transitions: clips that cover or uncover whatever is underneath. Drawn into an argb8888 .anim on top of live
// elements (a clock, say), they act on the real screen: transparent where the screen should show through.
// "cover"/"close" modes end fully covered; "reveal"/"open" modes start fully covered and end clear.

import { inCubic, inExpo, inOutCubic, lerp, outCubic, outExpo, outQuad, rng, span } from "../ease.ts";
import { hex, mix, type Color } from "../raster.ts";
import { MOTION } from "../motion.ts";
import { clip, type Clip } from "../timeline.ts";

const BLACK = hex("#000000");
const WHITE = hex("#FFFFFF");

export type CoverMode = "cover" | "reveal";

/** Whole-screen flashes: `count` pulses of `color`, as in a handheld RPG's encounter. */
export function flash(o: { duration?: number; count?: number; color?: Color; peak?: number }): Clip {
  const duration = o.duration ?? MOTION.base * 1.5;
  const count = o.count ?? 3;
  return clip(duration, (r, t) => {
    // `count` separate flashes: each takes an equal slot, lit for its first 60%, then dark before the next.
    const local = ((t / duration) * count) % 1;
    const a = local < 0.6 ? Math.sin((local / 0.6) * Math.PI) * (o.peak ?? 0.95) : 0;
    if (a > 0) r.fillRect(0, 0, r.width, r.height, { ...(o.color ?? WHITE), a });
  });
}

/** An overlay of `color` whose opacity goes from `from` to `to`: fades to black, or fades a black screen away. */
export function fade(o: { duration?: number; from: number; to: number; color?: Color }): Clip {
  const duration = o.duration ?? MOTION.base;
  return clip(duration, (r, t) => {
    const a = lerp(o.from, o.to, inOutCubic(t / duration));
    if (a > 0) r.fillRect(0, 0, r.width, r.height, { ...(o.color ?? BLACK), a });
  });
}

/** Horizontal bands sliding in from alternating sides until the screen is covered (or back out to reveal). */
export function stripes(o: { duration?: number; mode: CoverMode; bands?: number; color?: Color }): Clip {
  const duration = o.duration ?? MOTION.base;
  const bands = o.bands ?? 8;
  return clip(duration, (r, t) => {
    const p = o.mode === "cover" ? t / duration : 1 - t / duration;
    for (let band = 0; band < bands; band++) {
      const y0 = Math.round((band * r.height) / bands);
      const y1 = Math.round(((band + 1) * r.height) / bands);
      const w = Math.round(r.width * outQuad(span(p, band * 0.04, band * 0.04 + 0.68)));
      r.fillRect(band % 2 === 0 ? 0 : r.width - w, y0, w, y1 - y0, o.color ?? BLACK);
    }
  });
}

/** Venetian blinds: vertical slats that close (cover) or open (reveal). */
export function blinds(o: { duration?: number; mode: CoverMode; slats?: number; color?: Color }): Clip {
  const duration = o.duration ?? MOTION.base;
  const slats = o.slats ?? 9;
  return clip(duration, (r, t) => {
    const p = o.mode === "cover" ? t / duration : 1 - t / duration;
    const sw = r.width / slats;
    for (let s = 0; s < slats; s++) {
      const local = outCubic(span(p, (s / slats) * 0.35, (s / slats) * 0.35 + 0.65));
      r.fillRect(Math.floor(s * sw), 0, Math.ceil(sw * local), r.height, o.color ?? BLACK);
    }
  });
}

/**
 * An old TV switching off ("cover"): bars close in from top and bottom onto a bright line, which shrinks away. Or
 * switching on ("reveal"): the picture opens out from the centre line.
 */
export function crt(o: { duration?: number; mode: CoverMode; color?: Color; glow?: Color }): Clip {
  const duration = o.duration ?? MOTION.slow;
  return clip(duration, (r, t) => {
    const p = o.mode === "cover" ? t / duration : 1 - t / duration;
    const mid = r.height / 2;
    const open = (1 - inCubic(Math.min(1, p * 1.25))) * mid;
    for (let y = 0; y < r.height; y++) {
      if (Math.abs(y + 0.5 - mid) > open) r.fillRect(0, y, r.width, 1, o.color ?? BLACK);
    }
    if (p > 0.5) {
      const line = span(p, 0.55, 1);
      const glow = o.glow ?? hex("#85B8FF");
      r.glow(r.width / 2, mid, lerp(r.width * 0.6, 2, inExpo(line)), 1.6 + line * 2, { ...glow, a: Math.sin(Math.PI * Math.min(1, span(p, 0.5, 1) * 1.2)) }, 1.5);
    }
  });
}

/** A soft-edged band sweeping across, with a bright leading edge. */
export function wipe(o: { duration?: number; mode: CoverMode; direction?: 1 | -1; color?: Color; edge?: Color; soft?: number }): Clip {
  const duration = o.duration ?? MOTION.quick;
  const soft = o.soft ?? 8;
  return clip(duration, (r, t) => {
    const p = t / duration;
    const reach = r.width + soft * 1.5;
    const color = o.color ?? hex("#0055CC");
    const edge = o.edge ?? WHITE;
    r.shade((x) => {
      const xx = (o.direction ?? 1) === 1 ? x : r.width - 1 - x;
      if (o.mode === "cover") {
        const front = lerp(-soft, reach, outCubic(p));
        return xx > front ? null : mix(color, edge, Math.max(0, 1 - (front - xx) / soft) * 0.85);
      }
      const tail = lerp(-soft, reach, inCubic(p));
      return xx < tail ? null : mix(color, edge, Math.max(0, 1 - (xx - tail) / soft) * 0.6);
    });
  });
}

/** A circle closing on (cover) or opening from (reveal) a point, like the end of an old cartoon. */
export function iris(o: { duration?: number; mode: CoverMode; x?: number; y?: number; color?: Color }): Clip {
  const duration = o.duration ?? MOTION.slow;
  return clip(duration, (r, t) => {
    const cx = o.x ?? r.width / 2;
    const cy = o.y ?? r.height / 2;
    const max = Math.hypot(Math.max(cx, r.width - cx), Math.max(cy, r.height - cy)) + 1;
    const p = o.mode === "cover" ? inCubic(t / duration) : 1 - outCubic(t / duration);
    const radius = (1 - p) * max;
    r.shade((x, y) => {
      const d = Math.hypot(x + 0.5 - cx, y + 0.5 - cy);
      if (d <= radius - 0.5) return null;
      return { ...(o.color ?? BLACK), a: Math.min(1, d - radius + 0.5) };
    });
  });
}

/** Pixels switching on in random order until covered (or off again to reveal): a dissolve. */
export function dissolve(o: { duration?: number; mode: CoverMode; color?: Color; seed?: number }): Clip {
  const duration = o.duration ?? MOTION.base * 1.25;
  let order: Float32Array | null = null;
  return clip(duration, (r, t) => {
    if (!order || order.length !== r.width * r.height) {
      const rand = rng(o.seed ?? 11);
      order = Float32Array.from({ length: r.width * r.height }, () => rand());
    }
    const p = o.mode === "cover" ? t / duration : 1 - t / duration;
    for (let i = 0; i < order.length; i++) {
      if (order[i]! < p) r.fillRect(i % r.width, Math.floor(i / r.width), 1, 1, o.color ?? BLACK);
    }
  });
}

/** A coloured bloom growing from the centre, a bright ring at its edge, until it fills the screen. */
export function bloom(o: { duration?: number; color?: Color; ring?: Color }): Clip {
  const duration = o.duration ?? MOTION.base;
  return clip(duration, (r, t) => {
    const p = t / duration;
    const radius = outExpo(p) * Math.hypot(r.width / 3.2, r.height * 1.4) * 1.1;
    r.shade((x, y) => {
      const d = Math.hypot((x + 0.5 - r.width / 2) / 1.6, (y + 0.5 - r.height / 2) * 1.4);
      if (d > radius) return null;
      const ring = Math.max(0, 1 - Math.abs(d - radius + 2) / 3);
      return mix(o.color ?? hex("#0C66E4"), o.ring ?? WHITE, ring * (1 - p * 0.6));
    });
  });
}

/** Everything pinches into a line, then a point of light that fades out: on an opaque `color` ground. */
export function collapse(o: { duration?: number; color?: Color; light?: Color }): Clip {
  const duration = o.duration ?? MOTION.slow;
  return clip(duration, (r, t) => {
    const p = t / duration;
    r.fillRect(0, 0, r.width, r.height, o.color ?? BLACK);
    const light = o.light ?? hex("#579DFF");
    const w = lerp(r.width, 0, inExpo(span(p, 0.1, 0.6)));
    if (w > 0.5) r.fillRect((r.width - w) / 2, r.height / 2 - 0.5, w, 1, mix(light, WHITE, p));
    r.glow(r.width / 2, r.height / 2, lerp(30, 3, p), lerp(3, 1, p), { ...light, a: Math.sin(Math.PI * Math.min(1, p * 1.3)) }, 1.4);
  });
}
