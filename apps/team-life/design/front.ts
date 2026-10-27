// Three directions for the front-display alert. Each is a pure function of time: (t seconds) → frame.
// Every demo runs clock → alert (~10 s) → clock, so the transitions in and out are part of the option.

import {
  Raster,
  font,
  hex,
  inCubic,
  inExpo,
  inOutCubic,
  inQuad,
  inRoundRect,
  lerp,
  mix,
  outBack,
  outBounce,
  outCubic,
  outExpo,
  outQuad,
  rng,
  span,
  textWidth,
  type Color,
} from "@busybar/pixel";
import { BEATS, BLACK, JIRA, MESSAGE, WHITE, clock, jiraMark, type Beat, type ChevronPose } from "./kit.ts";

export interface Demo {
  id: string;
  name: string;
  pitch: string;
  duration: number;
  frame(t: number): Raster;
}

const CLOCK_LEAD = 1.0;
const CLOCK_TAIL = 1.0;

const colonDim = (t: number) => Math.floor(t) % 2 === 1;

function clockFrame(t: number, alpha = 1): Raster {
  const r = new Raster(72, 16).clear(BLACK);
  clock(r, "14:27", "Oct, Tue", "27", colonDim(t), alpha);
  return r;
}

/** Where each beat starts, given the beat list and the gap between beats. */
function schedule(beats: Beat[], start: number) {
  const out: { beat: Beat; start: number; end: number }[] = [];
  let t = start;
  for (const beat of beats) {
    out.push({ beat, start: t, end: t + beat.hold });
    t += beat.hold;
  }
  return { slots: out, end: t };
}

/** Text x/y for a beat centred in [x0, x1]: bold beats sit on the 7 px cap line, extra_large on the 10 px one. */
function beatPlace(beat: Beat, x0: number, x1: number) {
  const f = font(beat.font);
  const w = textWidth(beat.text, f);
  return { f, x: Math.round(x0 + (x1 - x0 - w) / 2), y: beat.font === "extra_large" ? 1 : 2, w };
}

// ---------------------------------------------------------------------------------------------------------------
// A — "Status Sign": the stock status-sign look (MEETING, CODING) in Jira blue. A bevelled panel with the mark,
// words roll through it like a split-flap, a sheen sweeps across.

function signPanel(r: Raster, t: number, opts: { h?: number; w?: number; alpha?: number } = {}) {
  const w = Math.max(2, Math.round(opts.w ?? 72));
  const h = Math.max(2, Math.round(opts.h ?? 16));
  const x0 = Math.round((72 - w) / 2);
  const y0 = Math.round((16 - h) / 2);
  const rad = Math.min(3, Math.floor(h / 2));
  const sheen = ((t * 0.55) % 1.6) * 110 - 20;
  r.roundRect(x0, y0, w, h, rad, (x, y, _u, v) => {
    const lx = x - x0;
    const ly = y - y0;
    const border =
      !inRoundRect(lx - 1, ly, w, h, rad) ||
      !inRoundRect(lx + 1, ly, w, h, rad) ||
      !inRoundRect(lx, ly - 1, w, h, rad) ||
      !inRoundRect(lx, ly + 1, w, h, rad);
    let c: Color = border ? hex("#0A3B8F") : ly === 1 ? hex("#69A6FF") : mix(hex("#2B7BF5"), hex("#0B4FC0"), v);
    if (!border) {
      const d = Math.abs(x + y * 0.9 - sheen);
      if (d < 5) c = mix(c, WHITE, 0.32 * (1 - d / 5));
    }
    return { ...c, a: opts.alpha ?? 1 };
  });
}

const WHITE_TONES = [hex("#FFFFFF"), hex("#DCEBFF"), hex("#AFCFFF")];

function optionSign(): Demo {
  const introAt = CLOCK_LEAD;
  const beatsAt = introAt + 0.75;
  const { slots, end: beatsEnd } = schedule(BEATS, beatsAt);
  const recapAt = beatsEnd;
  const outroAt = recapAt + 2.3;
  const doneAt = outroAt + 0.65;
  const duration = doneAt + CLOCK_TAIL;
  const ROLL = 0.26;

  function frame(t: number): Raster {
    if (t < introAt) return clockFrame(t);
    if (t >= doneAt) return clockFrame(t, outQuad(span(t, doneAt, doneAt + 0.3)));

    const r = new Raster(72, 16).clear(BLACK);

    // Intro: a blue bloom from the centre (the stock select transition, in Jira blue) resolves into the panel.
    if (t < beatsAt) {
      const p = span(t, introAt, introAt + 0.3);
      if (p < 1) clock(r, "14:27", "Oct, Tue", "27", colonDim(t), 1 - p);
      const radius = outExpo(p) * 46;
      r.shade((x, y) => {
        const d = Math.hypot((x + 0.5 - 36) / 1.6, (y + 0.5 - 8) * 1.4);
        if (d > radius) return null;
        const ring = Math.max(0, 1 - Math.abs(d - radius + 2) / 3);
        return mix(JIRA.b600, WHITE, ring * (1 - p * 0.6));
      });
      const settle = span(t, introAt + 0.22, introAt + 0.5);
      if (settle > 0) signPanel(r, t, { alpha: settle });
    } else if (t < outroAt) {
      signPanel(r, t);
    }

    // Outro: the panel folds to a line, then to a point of light, and the clock comes back.
    if (t >= outroAt) {
      const p = span(t, outroAt, doneAt);
      const fold = span(p, 0, 0.45);
      const pinch = span(p, 0.45, 0.8);
      if (pinch <= 0) signPanel(r, t, { h: lerp(16, 2, inCubic(fold)) });
      else {
        const w = lerp(72, 2, inExpo(pinch));
        r.fillRect((72 - w) / 2, 7, w, 2, mix(JIRA.b400, WHITE, pinch));
      }
      const flare = span(p, 0.6, 1);
      if (flare > 0 && flare < 1) {
        r.glow(36, 8, lerp(18, 2, flare), lerp(6, 1, flare), { ...JIRA.b200, a: 1 - flare });
      }
      return r;
    }

    const inner = { x0: 1, y0: 1, x1: 71, y1: 15 };

    // The mark: chevrons drop in one by one, then hop on the accent beats.
    const logoIn = (i: number) => span(t, introAt + 0.35 + i * 0.07, introAt + 0.65 + i * 0.07);
    const poses: ChevronPose[] = [0, 1, 2].map((i) => {
      const pin = logoIn(i);
      let dy = lerp(-14, 0, outBack(pin));
      for (const s of slots) {
        if (!s.beat.accent) continue;
        const hop = span(t, s.start + 0.05 + i * 0.06, s.start + 0.4 + i * 0.06);
        if (hop > 0 && hop < 1) dy -= Math.sin(hop * Math.PI) * 2.5;
      }
      return { dy, alpha: pin > 0 ? 1 : 0 };
    });
    r.clip = inner;
    jiraMark(r, 2, 2, 12, { poses, tones: WHITE_TONES });

    // Beats roll through the text window like a split-flap: the outgoing and incoming words travel together,
    // 14 px apart, so they never overlap; the incoming one settles with a small hop.
    for (const [i, s] of slots.entries()) {
      const { f, x, y } = beatPlace(s.beat, 16, 71);
      const isLast = i === slots.length - 1;
      const pin = inOutCubic(span(t, s.start - ROLL, s.start));
      const pout = inOutCubic(isLast ? span(t, recapAt - ROLL, recapAt) : span(t, s.end - ROLL, s.end));
      if (pin <= 0 || pout >= 1) continue;
      const settle = span(t, s.start, s.start + 0.2);
      const hop = settle > 0 && settle < 1 ? -Math.sin(settle * Math.PI) * 1.5 : 0;
      const dy = (1 - pin) * 14 - pout * 14 + hop;
      const shaking = s.beat.text.endsWith("???") ? span(t, s.start + 0.55, s.start + 0.85) * (1 - span(t, s.start + 0.85, s.start + 1.05)) : 0;
      const shake = Math.round(Math.sin(t * 70) * shaking);
      r.text(s.beat.text, f, x + shake, y + Math.round(dy), WHITE, (gi, ch) => {
        if (ch !== "?") return undefined;
        const pop = span(t, s.start + 0.1 + (gi - 3) * 0.12, s.start + 0.4 + (gi - 3) * 0.12);
        return {
          dy: pop > 0 && pop < 1 ? -Math.sin(pop * Math.PI) * 3 : 0,
          color: mix(WHITE, JIRA.b200, 0.5 + 0.5 * Math.sin(t * 14 + gi)),
        };
      });
    }

    // Recap: the whole sentence, two lines in the small font, rolling up from below.
    if (t >= recapAt - ROLL) {
      const small = font("small");
      MESSAGE.forEach((line, li) => {
        const x = Math.round(16 + (55 - textWidth(line, small)) / 2);
        r.text(line, small, x, li === 0 ? 0 : 7, WHITE, (gi, ch) => {
          void gi;
          const p = inOutCubic(span(t, recapAt - ROLL, recapAt));
          const blink = ch === "?" ? 0.5 + 0.5 * Math.sin(t * 12) : 0;
          return { dy: Math.round((1 - p) * 14), hidden: p <= 0, color: mix(WHITE, JIRA.b200, blink) };
        });
      });
    }
    r.clip = null;
    return r;
  }

  return {
    id: "sign",
    name: "A · Status Sign",
    pitch:
      "The stock status-sign look (MEETING, CODING, ON AIR) in Jira blue. A bevelled panel blooms out of the clock, the mark's chevrons drop in, and the words roll through like a split-flap while a sheen sweeps the panel. Calm, polished, most like the built-in screens.",
    duration,
    frame,
  };
}

// ---------------------------------------------------------------------------------------------------------------
// B — "Logo Burst": the power-on hyperspace burst in Jira blue. The three chevrons fly in out of the burst,
// words drop in letter by letter over drifting blue particles.

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  b: number;
  tw: number;
  big: boolean;
}

function particles(seed: number, n: number): Particle[] {
  const rand = rng(seed);
  return Array.from({ length: n }, () => ({
    x: rand() * 80 - 4,
    y: rand() * 16,
    vx: -(1.5 + rand() * 5),
    vy: (rand() - 0.5) * 0.8,
    b: 0.25 + rand() * 0.75,
    tw: rand() * Math.PI * 2,
    big: rand() < 0.12,
  }));
}

function drawParticles(r: Raster, ps: Particle[], t: number, alpha: number) {
  for (const p of ps) {
    const x = (((p.x + p.vx * t) % 80) + 80) % 80 - 4;
    const y = (((p.y + p.vy * t) % 16) + 16) % 16;
    const tw = 0.55 + 0.45 * Math.sin(t * 3 + p.tw);
    const c = mix(JIRA.b700, JIRA.b300, p.b);
    if (p.big) r.glow(x, y, 2.2, 2.2, { ...c, a: 0.5 * tw * alpha }, 1.5);
    else r.blend(x, y, c, p.b * tw * alpha, "add");
  }
}

function burst(r: Raster, p: number, seed: number) {
  const rand = rng(seed);
  for (let i = 0; i < 46; i++) {
    const ang = rand() * Math.PI * 2;
    const speed = 0.6 + rand() * 0.8;
    const len = 6 + rand() * 18;
    const head = outExpo(p) * 70 * speed;
    const tail = Math.max(0, head - len);
    const c = mix(JIRA.b400, WHITE, rand());
    for (let d = tail; d < head; d += 0.5) {
      const k = (d - tail) / Math.max(1, head - tail);
      r.blend(36 + Math.cos(ang) * d * 1.8, 8 + Math.sin(ang) * d * 0.55, c, k * (1 - p) * 1.2, "add");
    }
  }
  r.glow(36, 8, 26 * (1 - p) + 6, 8 * (1 - p) + 2, { ...WHITE, a: 1 - p }, 1.2);
}

function optionBurst(): Demo {
  const introAt = CLOCK_LEAD;
  const beatsAt = introAt + 1.05;
  const { slots, end: beatsEnd } = schedule(BEATS, beatsAt);
  const recapAt = beatsEnd;
  const outroAt = recapAt + 2.2;
  const doneAt = outroAt + 0.7;
  const duration = doneAt + CLOCK_TAIL;
  const ps = particles(7, 34);

  function frame(t: number): Raster {
    if (t < introAt) return clockFrame(t);
    const r = new Raster(72, 16).clear(BLACK);

    // Clock squashes into a line of light (the stock turn-off flare, in reverse colours)…
    const squash = span(t, introAt, introAt + 0.22);
    if (squash < 1) {
      const c = clockFrame(t);
      const sy = 1 - inCubic(squash);
      for (let y = 0; y < 16; y++) {
        const src = Math.round(8 + (y + 0.5 - 8) / Math.max(0.01, sy) - 0.5);
        if (src < 0 || src >= 16) continue;
        for (let x = 0; x < 72; x++) {
          const i = (src * 72 + x) * 4;
          r.blend(x, y, { r: c.data[i]!, g: c.data[i + 1]!, b: c.data[i + 2]!, a: 1 }, 1);
        }
      }
      r.glow(36, 8, 40, 1.6 + squash * 2, { ...JIRA.b300, a: squash }, 1.5);
    }
    // …that bursts into hyperspace streaks.
    const bp = span(t, introAt + 0.18, introAt + 0.8);
    if (bp > 0 && bp < 1) burst(r, bp, 3);

    const bgIn = span(t, introAt + 0.5, introAt + 1.2);
    const bgOut = span(t, outroAt, outroAt + 0.25);
    if (bgIn > 0) drawParticles(r, ps, t, bgIn * (1 - bgOut));

    if (t >= outroAt) {
      // Collapse: everything pinches into a blue point that fades, the clock unsquashes back.
      const p = span(t, outroAt, doneAt);
      const w = lerp(72, 0, inExpo(span(p, 0.1, 0.6)));
      if (w > 0.5) r.fillRect((72 - w) / 2, 7.5, w, 1, mix(JIRA.b300, WHITE, p));
      r.glow(36, 8, lerp(30, 3, p), lerp(3, 1, p), { ...JIRA.b300, a: Math.sin(Math.PI * Math.min(1, p * 1.3)) }, 1.4);
      if (t >= doneAt - 0.15) {
        const back = span(t, doneAt - 0.15, doneAt + 0.15);
        const c = clockFrame(t);
        const sy = Math.max(0.01, outCubic(back));
        for (let y = 0; y < 16; y++) {
          const src = Math.round(8 + (y + 0.5 - 8) / sy - 0.5);
          if (src < 0 || src >= 16) continue;
          for (let x = 0; x < 72; x++) {
            const i = (src * 72 + x) * 4;
            r.blend(x, y, { r: c.data[i]!, g: c.data[i + 1]!, b: c.data[i + 2]!, a: 1 }, 1);
          }
        }
      }
      return r;
    }

    // Chevrons fly out of the burst: from huge and centred to the mark's resting place, one after another.
    const LOGO = { x: 1, y: 0.5, size: 15 };
    const poses: ChevronPose[] = [0, 1, 2].map((i) => {
      const p = span(t, introAt + 0.4 + i * 0.1, introAt + 0.85 + i * 0.1);
      const e = outCubic(p);
      const fromX = 36 - (LOGO.x + LOGO.size / 2);
      const fromY = 8 - (LOGO.y + LOGO.size / 2);
      let dy = lerp(fromY, 0, e);
      for (const s of slots) {
        if (!s.beat.accent) continue;
        const hop = span(t, s.start + i * 0.05, s.start + 0.35 + i * 0.05);
        if (hop > 0 && hop < 1) dy -= Math.sin(hop * Math.PI) * 2;
      }
      return {
        dx: lerp(fromX, 0, e),
        dy,
        scale: lerp(5, 1, e),
        alpha: p > 0 ? Math.min(1, p * 3) : 0,
      };
    });
    jiraMark(r, LOGO.x, LOGO.y, LOGO.size, { poses, contrast: 3 });
    for (let i = 0; i < 3; i++) {
      const land = span(t, introAt + 0.85 + i * 0.1, introAt + 1.1 + i * 0.1);
      if (land > 0 && land < 1) r.glow(LOGO.x + 8, LOGO.y + 8, 10, 7, { ...JIRA.b200, a: 0.8 * (1 - land) }, 2);
    }

    // Beats: letters drop in with a bounce, then fall away; accents flash.
    for (const [i, s] of slots.entries()) {
      const { f, x, y } = beatPlace(s.beat, 18, 72);
      const isLast = i === slots.length - 1;
      const outStart = isLast ? recapAt - 0.15 : s.end - 0.18;
      if (t < s.start - 0.05 || t > outStart + 0.45) continue;
      r.text(s.beat.text, f, x, y, WHITE, (gi, ch) => {
        const gin = span(t, s.start + gi * 0.035, s.start + 0.38 + gi * 0.035);
        const gout = span(t, outStart + gi * 0.025, outStart + 0.2 + gi * 0.025);
        let dy = lerp(-14, 0, outBounce(gin)) + lerp(0, 16, inQuad(gout));
        let color = s.beat.accent ? mix(WHITE, JIRA.b300, 0.5 + 0.5 * Math.sin(t * 6 - gi * 0.7)) : WHITE;
        if (ch === "?") {
          const pop = span(t, s.start + 0.45 + (gi - 3) * 0.14, s.start + 0.75 + (gi - 3) * 0.14);
          if (pop > 0 && pop < 1) dy -= Math.sin(pop * Math.PI) * 3;
          color = mix(JIRA.b300, WHITE, 0.5 + 0.5 * Math.sin(t * 16 + gi));
        }
        return { dy, color, hidden: gin <= 0, alpha: 1 - gout };
      });
      // A flash behind each accent word as it lands.
      if (s.beat.accent) {
        const fl = span(t, s.start + 0.2, s.start + 0.6);
        if (fl > 0 && fl < 1) r.glow(x + 14, 8, 26, 9, { ...JIRA.b500, a: 0.6 * (1 - fl) }, 2);
      }
    }

    // Recap: the full sentence cascades in, "JIRA" in blue.
    if (t >= recapAt) {
      const small = font("small");
      MESSAGE.forEach((line, li) => {
        const x = Math.round(17 + (55 - textWidth(line, small)) / 2);
        r.text(line, small, x, li === 0 ? 0 : 7, WHITE, (gi, ch) => {
          const p = span(t, recapAt + 0.2 + li * 0.25 + gi * 0.03, recapAt + 0.45 + li * 0.25 + gi * 0.03);
          const jira = li === 1 && gi < 4;
          const color = jira ? JIRA.b300 : ch === "?" ? mix(WHITE, JIRA.b300, 0.5 + 0.5 * Math.sin(t * 12)) : WHITE;
          return { color: mix(JIRA.b200, color, p), alpha: p, dy: lerp(-3, 0, outCubic(p)), hidden: p <= 0 };
        });
      });
    }
    return r;
  }

  return {
    id: "burst",
    name: "B · Logo Burst",
    pitch:
      "The power-on 'hyperspace' burst in Jira blue. The clock squashes into a line of light that explodes, the three Jira chevrons fly out of it one by one, and each word drops in letter by letter over drifting blue particles. Most energetic.",
    duration,
    frame,
  };
}

// ---------------------------------------------------------------------------------------------------------------
// C — "Ticker": a blue wipe swaps the clock for a news-ticker: the mark pinned left, breathing; the sentence types
// out in the big font with a cursor, then keeps rolling as a marquee.

function optionTicker(): Demo {
  const introAt = CLOCK_LEAD;
  const typeAt = introAt + 0.75;
  const CPS = 12;
  const text = "DID YOU FILE A JIRA TICKET YET???";
  const jiraAt = text.indexOf("JIRA");
  const f = font("extra_large");
  const advances = [...text].map((ch) => f.glyph(ch.codePointAt(0)!)!.advance);
  const typedAt = typeAt + text.length / CPS;
  const marqueeAt = typedAt + 0.9;
  const outroAt = introAt + 9.6;
  const duration = outroAt + 0.55 + CLOCK_TAIL;
  const TEXT_X0 = 18;
  const CURSOR_X = 64;
  const SPEED = 34;
  const total = advances.reduce((a, b) => a + b, 0);
  const GAP = 22;

  /** Strip scroll offset: keep the cursor in view while typing, then roll on as a marquee. */
  function scroll(t: number): number {
    const typed = Math.min(text.length, Math.max(0, (t - typeAt) * CPS));
    const whole = Math.floor(typed);
    let w = advances.slice(0, whole).reduce((a, b) => a + b, 0);
    if (whole < text.length) w += advances[whole]! * (typed - whole);
    const typing = Math.max(0, TEXT_X0 + w - CURSOR_X);
    const settled = Math.max(0, TEXT_X0 + total - CURSOR_X);
    if (t < marqueeAt) return typing;
    return settled + (t - marqueeAt) * SPEED;
  }

  function wipe(r: Raster, p: number, dir: 1 | -1) {
    // A soft-edged blue band, bright leading edge; p 0→1 covers, 1→2 uncovers.
    const edge = lerp(-12, 84, outCubic(Math.min(1, p)));
    const tail = p > 1 ? lerp(-12, 84, inCubic(p - 1)) : -999;
    r.shade((x) => {
      const xx = dir === 1 ? x : 71 - x;
      if (xx > edge || xx < tail) return null;
      const lead = Math.max(0, 1 - (edge - xx) / 8);
      const trail = tail > -999 ? Math.max(0, 1 - (xx - tail) / 8) : 0;
      return mix(JIRA.b700, WHITE, Math.max(lead * 0.85, trail * 0.6));
    });
  }

  function ticker(r: Raster, t: number) {
    // Mark, breathing: a brightness wave walks down the chevrons.
    const tones = [0, 1, 2].map((i) => {
      const w = 0.5 + 0.5 * Math.sin(t * 4 - i * 0.9);
      return mix([hex("#4C9AFF"), hex("#2684FF"), hex("#0065FF")][i]!, hex("#B3D4FF"), w * 0.45);
    });
    jiraMark(r, 0, 0.5, 15, { tones });

    const off = scroll(t);
    const typed = (t - typeAt) * CPS;
    const fade = (x: number) => Math.max(0, Math.min(1, (x - TEXT_X0 + 1) / 6));
    r.clip = { x0: TEXT_X0 - 1, y0: 0, x1: 72, y1: 16 };
    const drawStrip = (base: number, typing: boolean) => {
      let pen = base;
      [...text].forEach((ch, i) => {
        const age = typed - i;
        if (typing && age < 0) return;
        const flash = typing ? Math.max(0, 1 - age / 3) : 0;
        const inJira = i >= jiraAt && i < jiraAt + 4;
        const isQ = ch === "?";
        let color = inJira ? JIRA.b300 : WHITE;
        if (isQ && t > typedAt) color = mix(WHITE, JIRA.b300, 0.5 + 0.5 * Math.sin(t * 14 + i));
        color = mix(color, JIRA.b200, flash);
        const dy = typing ? -Math.round(Math.max(0, 1 - age * 2) * 3) : 0;
        r.text(ch, f, Math.round(pen), 1 + dy, color, () => ({ alpha: fade(pen + 3) }));
        pen += advances[i]!;
      });
      return pen;
    };
    const base = TEXT_X0 - off;
    if (t < marqueeAt) {
      const end = drawStrip(base, true);
      // Block cursor, blinking once the line is complete.
      const blink = t < typedAt || Math.floor(t * 3) % 2 === 0;
      if (blink) r.fillRect(Math.round(end) + 1, 3, 2, 10, JIRA.b400);
    } else {
      const period = total + GAP;
      const shift = ((base - TEXT_X0) % period) - period;
      for (let k = 0; k < 3; k++) drawStrip(TEXT_X0 + shift + k * period, false);
    }
    r.clip = null;
  }

  function frame(t: number): Raster {
    if (t < introAt) return clockFrame(t);
    if (t >= outroAt + 0.25) {
      const r = clockFrame(t);
      const p = span(t, outroAt + 0.25, outroAt + 0.55);
      if (p < 1) wipe(r, 1 + p, -1);
      return r;
    }
    const r = new Raster(72, 16).clear(BLACK);
    if (t < introAt + 0.32) {
      clock(r, "14:27", "Oct, Tue", "27", colonDim(t));
      wipe(r, span(t, introAt, introAt + 0.32), 1);
      return r;
    }
    if (t >= outroAt) {
      ticker(r, t);
      wipe(r, span(t, outroAt, outroAt + 0.25), -1);
      return r;
    }
    ticker(r, t);
    const uncover = span(t, introAt + 0.32, introAt + 0.62);
    if (uncover < 1) wipe(r, 1 + uncover, 1);
    return r;
  }

  return {
    id: "ticker",
    name: "C · Ticker",
    pitch:
      "A blue wipe sweeps the clock away into a news-ticker: the Jira mark pinned on the left with a slow 'breathing' shimmer, the whole sentence typed out in the big font with a blinking cursor, then rolling on as a marquee. Most readable: the full sentence is always in one line.",
    duration,
    frame,
  };
}

export const FRONT_OPTIONS: Demo[] = [optionSign(), optionBurst(), optionTicker()];
