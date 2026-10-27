// Backgrounds and ambient motion: fields, bursts, panels and light effects that sit behind content.

import { inRoundRect, hex, mix, type Color, type Raster } from "../raster.ts";
import { lerp, outExpo, rng } from "../ease.ts";
import { clip, type Clip } from "../timeline.ts";

const WHITE = hex("#FFFFFF");

/** Slowly drifting, twinkling motes with a few soft bokeh blobs (the power-on screen's ambience). */
export function particles(o: {
  duration: number;
  seed?: number;
  count?: number;
  dark?: Color;
  light?: Color;
  /** Pixels per second, leftwards (negative for rightwards). */
  speed?: number;
  /** Optional fade in/out at the clip's ends, seconds. */
  fadeIn?: number;
  fadeOut?: number;
}): Clip {
  const rand = rng(o.seed ?? 7);
  let motes: { x: number; y: number; vx: number; vy: number; b: number; tw: number; big: boolean }[] | null = null;
  return clip(o.duration, (r, t) => {
    motes ??= Array.from({ length: o.count ?? Math.round((r.width * r.height) / 34) }, () => ({
      x: rand() * (r.width + 8) - 4,
      y: rand() * r.height,
      vx: -(1.5 + rand() * 5) * ((o.speed ?? 3) / 3),
      vy: (rand() - 0.5) * 0.8,
      b: 0.25 + rand() * 0.75,
      tw: rand() * Math.PI * 2,
      big: rand() < 0.12,
    }));
    const fin = o.fadeIn ? Math.min(1, t / o.fadeIn) : 1;
    const fout = o.fadeOut ? Math.min(1, (o.duration - t) / o.fadeOut) : 1;
    const alpha = Math.max(0, Math.min(fin, fout));
    const W = r.width + 8;
    for (const m of motes) {
      const x = ((((m.x + m.vx * t) % W) + W) % W) - 4;
      const y = (((m.y + m.vy * t) % r.height) + r.height) % r.height;
      const tw = 0.55 + 0.45 * Math.sin(t * 3 + m.tw);
      const c = mix(o.dark ?? hex("#0055CC"), o.light ?? hex("#579DFF"), m.b);
      if (m.big) r.glow(x, y, 2.2, 2.2, { ...c, a: 0.5 * tw * alpha }, 1.5);
      else r.blend(x, y, c, m.b * tw * alpha, "add");
    }
  });
}

/** Hyperspace: streaks shooting out from the centre with a white core that fades (the power-on burst). */
export function burst(o: { duration: number; seed?: number; color?: Color; streaks?: number }): Clip {
  return clip(o.duration, (r, t) => {
    const p = t / o.duration;
    const rand = rng(o.seed ?? 3);
    const cx = r.width / 2;
    const cy = r.height / 2;
    const sx = r.width / 40;
    const sy = r.height / 29;
    for (let i = 0; i < (o.streaks ?? 46); i++) {
      const ang = rand() * Math.PI * 2;
      const speed = 0.6 + rand() * 0.8;
      const len = 6 + rand() * 18;
      const head = outExpo(p) * 70 * speed;
      const tail = Math.max(0, head - len);
      const c = mix(o.color ?? hex("#388BFF"), WHITE, rand());
      for (let d = tail; d < head; d += 0.5) {
        const k = (d - tail) / Math.max(1, head - tail);
        r.blend(cx + Math.cos(ang) * d * sx, cy + Math.sin(ang) * d * sy, c, k * (1 - p) * 1.2, "add");
      }
    }
    r.glow(cx, cy, r.width * 0.36 * (1 - p) + 6, r.height * 0.5 * (1 - p) + 2, { ...WHITE, a: 1 - p }, 1.2);
  });
}

/** A starfield rushing towards the viewer. */
export function starfield(o: { duration: number; seed?: number; stars?: number; speed?: number; color?: Color }): Clip {
  const rand = rng(o.seed ?? 21);
  const stars = Array.from({ length: o.stars ?? 60 }, () => ({ a: rand() * Math.PI * 2, z: rand(), s: 0.5 + rand() }));
  return clip(o.duration, (r, t) => {
    const cx = r.width / 2;
    const cy = r.height / 2;
    for (const s of stars) {
      const z = (s.z + t * (o.speed ?? 0.35) * s.s) % 1;
      const d = Math.pow(z, 2.2) * r.width * 0.75;
      const x = cx + Math.cos(s.a) * d;
      const y = cy + Math.sin(s.a) * d * (r.height / r.width) * 2.4;
      r.blend(x, y, o.color ?? WHITE, Math.min(1, z * 1.6), "add");
    }
  });
}

/** Confetti falling and tumbling (the stock "finished" celebration). */
export function confetti(o: { duration: number; seed?: number; pieces?: number; colors?: Color[] }): Clip {
  const rand = rng(o.seed ?? 5);
  const colors = o.colors ?? [hex("#FF4D6D"), hex("#FFD166"), hex("#579DFF"), hex("#3DDC84"), WHITE];
  const pieces = Array.from({ length: o.pieces ?? 40 }, () => ({
    x: rand(),
    delay: rand() * 0.6,
    speed: 6 + rand() * 10,
    sway: rand() * Math.PI * 2,
    c: colors[Math.floor(rand() * colors.length)]!,
  }));
  return clip(o.duration, (r, t) => {
    for (const p of pieces) {
      const tt = t - p.delay * o.duration * 0.5;
      if (tt < 0) continue;
      const y = -2 + tt * p.speed;
      if (y > r.height + 2) continue;
      const x = p.x * r.width + Math.sin(tt * 4 + p.sway) * 2;
      const flip = Math.abs(Math.sin(tt * 9 + p.sway));
      r.blend(x, y, p.c, 0.4 + 0.6 * flip);
      if (flip > 0.5) r.blend(x + 1, y, p.c, 0.6);
    }
  });
}

/** Twinkling four-point sparkles scattered over the screen (or a box). */
export function sparkles(o: { duration: number; seed?: number; count?: number; color?: Color; box?: { x: number; y: number; width: number; height: number } }): Clip {
  const rand = rng(o.seed ?? 13);
  const sparks = Array.from({ length: o.count ?? 8 }, () => ({ x: rand(), y: rand(), phase: rand(), rate: 0.6 + rand() * 0.8 }));
  return clip(o.duration, (r, t) => {
    const box = o.box ?? { x: 0, y: 0, width: r.width, height: r.height };
    for (const s of sparks) {
      const life = (t * s.rate + s.phase) % 1;
      const a = Math.sin(life * Math.PI);
      const x = Math.round(box.x + s.x * (box.width - 1));
      const y = Math.round(box.y + s.y * (box.height - 1));
      const c = o.color ?? WHITE;
      r.blend(x, y, c, a, "add");
      if (a > 0.5) {
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) r.blend(x + dx, y + dy, c, (a - 0.5) * 1.4, "add");
      }
    }
  });
}

/** Rings rippling out from a point (the stock "wave" invitation). */
export function ripple(o: { duration: number; x?: number; y?: number; rings?: number; color?: Color; speed?: number }): Clip {
  return clip(o.duration, (r, t) => {
    const cx = o.x ?? r.width / 2;
    const cy = o.y ?? r.height;
    const max = Math.hypot(r.width, r.height);
    const rings = o.rings ?? 3;
    for (let k = 0; k < rings; k++) {
      const radius = ((t * (o.speed ?? 30) + (k * max) / rings) % max);
      const a = 1 - radius / max;
      r.shade((x, y) => {
        const d = Math.hypot((x + 0.5 - cx) / 2, y + 0.5 - cy);
        const edge = 1 - Math.abs(d - radius / 2) / 2;
        return edge > 0 ? { ...(o.color ?? WHITE), a: edge * a * 0.7 } : null;
      }, "add");
    }
  });
}

/** A soft glow breathing in and out: behind a word, a logo, or the whole screen. */
export function pulse(o: { duration: number; x?: number; y?: number; rx?: number; ry?: number; color?: Color; period?: number; strength?: number }): Clip {
  return clip(o.duration, (r, t) => {
    const a = (0.5 - 0.5 * Math.cos((t / (o.period ?? 1.6)) * Math.PI * 2)) * (o.strength ?? 0.6);
    r.glow(o.x ?? r.width / 2, o.y ?? r.height / 2, o.rx ?? r.width / 2, o.ry ?? r.height / 2, { ...(o.color ?? hex("#1D7AFC")), a }, 2);
  });
}

export interface PanelStyle {
  top: Color;
  bottom: Color;
  border: Color;
  highlight: Color;
  shadow: Color;
}

/** Jira-blue sign panel, like the stock MEETING / CODING signs. */
export const PANEL_BLUE: PanelStyle = {
  top: hex("#2B7BF5"),
  bottom: hex("#0B4FC0"),
  border: hex("#0A3B8F"),
  highlight: hex("#69A6FF"),
  shadow: hex("#0A44A6"),
};

/**
 * A bevelled sign panel: border, a light top inner row and a dark bottom one (so content centres on the panel's
 * middle, as on the stock signs), a vertical gradient, and an optional diagonal sheen at `sheen` (x position).
 */
export function drawPanel(
  r: Raster,
  o: { x?: number; y?: number; width?: number; height?: number; radius?: number; style?: PanelStyle; sheen?: number; alpha?: number },
): void {
  const w = Math.max(2, Math.round(o.width ?? r.width));
  const h = Math.max(2, Math.round(o.height ?? r.height));
  const x0 = Math.round(o.x ?? (r.width - w) / 2);
  const y0 = Math.round(o.y ?? (r.height - h) / 2);
  const rad = Math.min(o.radius ?? 3, Math.floor(h / 2));
  const s = o.style ?? PANEL_BLUE;
  r.roundRect(x0, y0, w, h, rad, (x, y, _u, v) => {
    const lx = x - x0;
    const ly = y - y0;
    const border =
      !inRoundRect(lx - 1, ly, w, h, rad) || !inRoundRect(lx + 1, ly, w, h, rad) || !inRoundRect(lx, ly - 1, w, h, rad) || !inRoundRect(lx, ly + 1, w, h, rad);
    let c = border ? s.border : ly === 1 ? s.highlight : ly === h - 2 ? s.shadow : mix(s.top, s.bottom, v);
    if (!border && o.sheen !== undefined) {
      const d = Math.abs(x + y * 0.9 - o.sheen);
      if (d < 5) c = mix(c, WHITE, 0.32 * (1 - d / 5));
    }
    return { ...c, a: o.alpha ?? 1 };
  });
}

/** The panel as a clip, with its sheen sweeping across every `period` seconds. */
export function panel(o: { duration: number; style?: PanelStyle; period?: number; width?: number; height?: number }): Clip {
  return clip(o.duration, (r, t) => {
    const period = o.period ?? 2.9;
    const sheen = ((t % period) / period) * (r.width + 40) - 20;
    drawPanel(r, { style: o.style, sheen, width: o.width, height: o.height });
  });
}

/** A two-colour gradient across the screen that slowly shifts. */
export function gradient(o: { duration: number; from: Color; to: Color; angle?: number; drift?: number }): Clip {
  return clip(o.duration, (r, t) => {
    const ang = ((o.angle ?? 0) * Math.PI) / 180;
    r.shade((x, y) => {
      const u = ((x * Math.cos(ang) + y * Math.sin(ang)) / r.width + t * (o.drift ?? 0.1)) % 2;
      const k = u < 1 ? u : 2 - u;
      return mix(o.from, o.to, lerp(0, 1, k));
    });
  });
}
