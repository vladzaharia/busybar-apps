// Text effects, rendered with the device's own fonts so they match `text` elements exactly. Each takes a
// `color` function for per-letter colour (shimmers, accent words, blinking question marks).

import { inCubic, inOutCubic, inQuad, lerp, outBack, outBounce, span } from "../ease.ts";
import { font, textWidth, type FontName } from "../font.ts";
import { hex, mix, type Color } from "../raster.ts";
import { clip, type Clip } from "../timeline.ts";

const WHITE = hex("#FFFFFF");

/** Per-letter colour: index in the text, the character, and the clip's time. */
export type LetterColor = (index: number, ch: string, t: number) => Color;

/** Highlights whole words (e.g. "JIRA") in `accent`, gently shimmering; everything else in `base`. */
export function accentWords(text: string, words: string[], base: Color, accent: Color): LetterColor {
  const marked = new Set<number>();
  for (const w of words) {
    for (let i = text.indexOf(w); i >= 0; i = text.indexOf(w, i + 1)) for (let k = 0; k < w.length; k++) marked.add(i + k);
  }
  return (i, _ch, t) => (marked.has(i) ? mix(base, accent, 0.55 + 0.45 * Math.sin(t * 6 - i * 0.7)) : base);
}

/** Where to put the top of a text element so its capitals are centred in `height` (the stock signs' centring). */
export function capCentre(name: FontName, height = 16): number {
  const f = font(name);
  const cap = f.glyph(0x48)?.height ?? f.ascent - 2;
  return Math.floor((height - cap) / 2) - (f.ascent - cap);
}

/** Letters dropping in from above, one after another, landing with a bounce; optionally falling away at the end. */
export function dropIn(o: {
  text: string;
  font: FontName;
  x: number;
  y: number;
  duration: number;
  color?: LetterColor;
  stagger?: number;
  /** Seconds before the end to start letting the letters fall away; omit to stay. */
  exit?: number;
}): Clip {
  const f = font(o.font);
  return clip(o.duration, (r, t) => {
    const stagger = o.stagger ?? 0.035;
    const outAt = o.exit !== undefined ? o.duration - o.exit : null;
    r.text(o.text, f, o.x, o.y, WHITE, (gi, ch) => {
      const gin = span(t, gi * stagger, 0.38 + gi * stagger);
      const gout = outAt === null ? 0 : span(t, outAt + gi * 0.025, outAt + 0.2 + gi * 0.025);
      return {
        dy: Math.round(lerp(-14, 0, outBounce(gin)) + lerp(0, 16, inQuad(gout))),
        color: o.color?.(gi, ch, t),
        alpha: 1 - gout,
        hidden: gin <= 0,
      };
    });
  });
}

/** Text typed out letter by letter over several lines, as in a dialogue box. */
export function typewriter(o: {
  lines: string[];
  font: FontName;
  x: number;
  /** Top of each line. */
  ys: number[];
  /** Letters per second. */
  cps?: number;
  duration: number;
  color?: LetterColor;
}): Clip {
  const f = font(o.font);
  return clip(o.duration, (r, t) => {
    const typed = Math.floor(t * (o.cps ?? 26));
    let n = 0;
    o.lines.forEach((line, li) => {
      r.text(line, f, o.x, o.ys[li] ?? 0, WHITE, (gi, ch) => {
        const k = n++;
        return { hidden: k >= typed, color: o.color?.(gi, ch, t) };
      });
    });
  });
}

/** Seconds `typewriter` needs to type `lines` at `cps`. */
export function typingTime(lines: string[], cps = 26): number {
  return lines.reduce((n, l) => n + l.length, 0) / cps;
}

/**
 * One line gliding in from the right edge and easing to a stop at `endX`, each letter dropping into place as it
 * enters. Letters fade out past `fadeX` (e.g. under a logo on the left).
 */
export function glide(o: {
  text: string;
  font: FontName;
  y: number;
  endX: number;
  duration: number;
  startX?: number;
  fadeX?: number;
  color?: LetterColor;
  /** Drop letters in as they enter (default true). */
  drop?: boolean;
  /** Seconds of movement; the line then rests at `endX` for the rest of `duration`. Defaults to `duration`. */
  travel?: number;
  /** Extra vertical offset per letter (e.g. popChars for punchlines). */
  hop?: (index: number, t: number) => number;
}): Clip {
  const f = font(o.font);
  const travelTime = o.travel ?? o.duration;
  const advances = [...o.text].map((ch) => f.glyph(ch.codePointAt(0)!)?.advance ?? 0);
  const offsets = advances.map((_, i) => advances.slice(0, i).reduce((a, b) => a + b, 0));
  let entered: number[] | null = null;
  return clip(o.duration, (r, t) => {
    const startX = o.startX ?? r.width;
    const travel = (p: number) => 0.55 * p + 0.45 * inOutCubic(p);
    const at = (tt: number) => lerp(startX, o.endX, travel(Math.min(1, tt / travelTime)));
    // When each letter crosses the right edge, found once by stepping through the glide.
    entered ??= offsets.map((off) => {
      for (let tt = 0; tt <= travelTime; tt += 1 / 240) if (at(tt) + off < r.width - 2) return tt;
      return travelTime;
    });
    const base = at(t);
    const fadeX = o.fadeX ?? -999;
    r.text(o.text, f, Math.round(base), o.y, WHITE, (gi, ch) => {
      const x = base + offsets[gi]!;
      if (x > r.width || x + advances[gi]! < fadeX - 6) return { hidden: true };
      const e = entered![gi]!;
      const drop = o.drop === false ? 1 : span(t, e, e + 0.42);
      return {
        dy: Math.round(lerp(-14, 0, outBounce(drop))) + (o.hop?.(gi, t) ?? 0),
        color: o.color?.(gi, ch, t),
        alpha: Math.max(0, Math.min(1, (x - fadeX + 2) / 6)),
        hidden: drop <= 0,
      };
    });
  });
}

/** A line of text bobbing on a sine wave, letter by letter. */
export function wave(o: { text: string; font: FontName; x: number; y: number; duration: number; amplitude?: number; speed?: number; color?: LetterColor }): Clip {
  const f = font(o.font);
  return clip(o.duration, (r, t) => {
    r.text(o.text, f, o.x, o.y, WHITE, (gi, ch) => ({
      dy: Math.round(Math.sin(t * (o.speed ?? 6) - gi * 0.6) * (o.amplitude ?? 1.5)),
      color: o.color?.(gi, ch, t),
    }));
  });
}

/**
 * Words rolling through a window like a split-flap board: each new word rises in from below as the old one leaves
 * upward, travelling together so they never overlap; the new one settles with a small hop.
 */
export function roll(o: {
  words: { text: string; font: FontName; hold: number }[];
  /** Window the words roll through; each word is centred in it. */
  box: { x: number; width: number; height?: number };
  rollTime?: number;
  color?: LetterColor;
}): Clip {
  const ROLL = o.rollTime ?? 0.26;
  const starts: number[] = [];
  let total = 0;
  for (const w of o.words) {
    starts.push(total);
    total += w.hold;
  }
  const height = o.box.height ?? 16;
  return clip(total, (r, t) => {
    o.words.forEach((w, i) => {
      const f = font(w.font);
      const start = starts[i]!;
      const end = start + w.hold;
      const pin = i === 0 ? 1 : inOutCubic(span(t, start - ROLL, start));
      const pout = i === o.words.length - 1 ? 0 : inOutCubic(span(t, end - ROLL, end));
      if (pin <= 0 || pout >= 1 || t < start - ROLL) return;
      const settle = span(t, start, start + 0.2);
      const hop = i > 0 && settle > 0 && settle < 1 ? -Math.sin(settle * Math.PI) * 1.5 : 0;
      const x = Math.round(o.box.x + (o.box.width - textWidth(w.text, f)) / 2);
      const y = capCentre(w.font, height) + Math.round((1 - pin) * height - pout * height + hop);
      r.text(w.text, f, x, y, WHITE, (gi, ch) => ({ color: o.color?.(gi, ch, t) }));
    });
  });
}

/** Seconds a `roll` of these words takes. */
export function rollTime(words: { hold: number }[]): number {
  return words.reduce((d, w) => d + w.hold, 0);
}

/** Pops each "?" (or `chars`) in turn with a little hop: for punchlines. Returns a dy per letter. */
export function popChars(text: string, at: number, chars = "?", step = 0.14): (gi: number, t: number) => number {
  const order: number[] = [];
  [...text].forEach((ch, i) => chars.includes(ch) && order.push(i));
  return (gi, t) => {
    const k = order.indexOf(gi);
    if (k < 0) return 0;
    const p = span(t, at + k * step, at + 0.3 + k * step);
    return p > 0 && p < 1 ? -Math.round(Math.sin(p * Math.PI) * 3) : 0;
  };
}

/** Eases a value in with an overshoot; exported for scenes that hand-place text. */
export const settle = (t: number) => outBack(t, 2.2);
export const leave = inCubic;
