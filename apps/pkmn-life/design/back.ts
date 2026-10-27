// Two directions for the back-display message picker (148×80 drawable, 16 grey levels).
// Both demos: scroll through presets with the wheel, press START, then the "now showing" state with a countdown.

import { Raster, font, hex, lerp, mix, outBack, outCubic, outQuad, span, textWidth, type Color, type Font } from "@busybar/pixel";
import { BLACK, MOVES, PRESETS, WHITE, jiraMark } from "./kit.ts";
import type { Demo } from "./front.ts";

const W = 148;
const H = 80;
const grey = (v: number, a = 1): Color => ({ r: v, g: v, b: v, a });

/** Scripted wheel turns and the START press for both demos. */
const TURNS: { at: number; to: number }[] = [
  { at: 1.0, to: 1 },
  { at: 1.7, to: 2 },
  { at: 2.4, to: 3 },
  { at: 3.3, to: 2 },
  { at: 3.6, to: 1 },
  { at: 3.9, to: 0 },
];
const START_AT = 4.9;
const DURATION = 9.0;
const SHOW_SECONDS = 10;

/** Continuous selection index at time t: each turn eases from the previous index. */
function selection(t: number, ease: (p: number) => number, dur: number): number {
  let sel = 0;
  for (const turn of TURNS) {
    if (t < turn.at) break;
    sel = lerp(sel, turn.to, ease(span(t, turn.at, turn.at + dur)));
  }
  return sel;
}

/** The turn in progress (for arrow flashes), if any. */
function activeTurn(t: number, dur: number) {
  let prev = 0;
  for (const turn of TURNS) {
    if (t >= turn.at && t < turn.at + dur) return { dir: Math.sign(turn.to - prev), p: span(t, turn.at, turn.at + dur) };
    prev = turn.to;
  }
  return null;
}

export function wrap(text: string, f: Font, width: number): string[] {
  const lines: string[] = [];
  let line = "";
  for (const word of text.split(" ")) {
    const next = line ? `${line} ${word}` : word;
    if (textWidth(next, f) <= width || !line) line = next;
    else {
      lines.push(line);
      line = word;
    }
  }
  if (line) lines.push(line);
  return lines;
}

const GREY_TONES = [grey(1), grey(0.8), grey(0.58)];

function header(r: Raster, sel: number) {
  jiraMark(r, 2, 0, 11, { tones: GREY_TONES });
  const small = font("small");
  r.text("PKMN LIFE", small, 15, 1, grey(0.9));
  const idx = `${Math.round(sel) + 1}/${PRESETS.length}`;
  r.text(idx, small, W - 2 - textWidth(idx, small), 1, grey(0.55));
}

/** "[START] to show it" with the key-cap outlined, breathing. */
function hint(r: Raster, t: number, y: number) {
  const tiny = font("small");
  const a = 0.8 + 0.2 * Math.sin(t * 3);
  const key = "START";
  const rest = "show on front";
  const kw = textWidth(key, tiny) + 5;
  const total = kw + 4 + textWidth(rest, tiny);
  const x = Math.round((W - total) / 2);
  r.roundRect(x, y, kw, 9, 2, (px, py, u, v) => {
    const edge = px === x || px === x + kw - 1 || py === y || py === y + 8;
    return edge ? grey(0.85 * a) : grey(0.15);
  });
  r.text(key, tiny, x + 3, y, grey(a));
  r.text(rest, tiny, x + kw + 4, y, grey(0.6));
}

/** The shared "now showing" state, with the countdown bar. */
function showing(r: Raster, t: number, sel: number, alpha: number) {
  const small = font("small");
  const normal = font("normal");
  const elapsed = t - START_AT;
  const live = 0.5 + 0.5 * Math.sin(t * 6);
  r.glow(9.5, 5.5, 3.5, 3.5, grey(live * alpha), 1.2);
  r.fillRect(8, 4, 3, 3, grey(alpha));
  r.text("NOW ON FRONT", small, 15, 1, grey(0.9, alpha));
  const msg = PRESETS[Math.round(sel)]!;
  const lines = wrap(msg, normal, 132);
  const top = 30 - (lines.length * 11) / 2;
  lines.forEach((line, i) => {
    const x = Math.round((W - textWidth(line, normal)) / 2);
    r.text(line, normal, x, Math.round(top + i * 11), WHITE, (gi) => {
      const p = span(t, START_AT + 0.25 + i * 0.1 + gi * 0.012, START_AT + 0.5 + i * 0.1 + gi * 0.012);
      return { alpha: p * alpha, dy: lerp(4, 0, outCubic(p)) };
    });
  });
  const left = Math.max(0, 1 - elapsed / SHOW_SECONDS);
  const barIn = outCubic(span(t, START_AT + 0.3, START_AT + 0.7));
  const bw = Math.round(120 * barIn);
  const bx = Math.round((W - bw) / 2);
  r.roundRect(bx, 56, bw, 5, 2, grey(0.2, alpha));
  r.roundRect(bx, 56, Math.max(1, Math.round(bw * left)), 5, 2, grey(0.95, alpha));
  const secs = `${Math.ceil(left * SHOW_SECONDS)}s`;
  r.text(secs, small, Math.round((W - textWidth(secs, small)) / 2), 63, grey(0.6, alpha * barIn));
  r.text("BACK to stop", small, Math.round((W - textWidth("BACK to stop", small)) / 2), 71, grey(0.35, alpha));
}

// ---------------------------------------------------------------------------------------------------------------
// 1 — Cards: one message per card, neighbours peeking at the edges; the wheel slides the deck.

function optionCards(): Demo {
  const CARD = { x: 16, y: 14, w: 116, h: 42, gap: 8 };
  const SLIDE = 0.32;

  function card(r: Raster, x: number, text: string, focus: number) {
    const normal = font("normal");
    r.roundRect(Math.round(x), CARD.y, CARD.w, CARD.h, 4, (px, py, _u, v) => {
      const lx = px - Math.round(x);
      const ly = py - CARD.y;
      const edge = lx === 0 || ly === 0 || lx === CARD.w - 1 || ly === CARD.h - 1;
      if (edge) return grey(lerp(0.3, 0.75, focus));
      // A faint top-lit fill, like the device's own cards.
      return grey(lerp(0.06, 0.13, focus) * (1 - v * 0.5));
    });
    const lines = wrap(text, normal, CARD.w - 12);
    const top = CARD.y + CARD.h / 2 - (lines.length * 11) / 2;
    lines.forEach((line, i) => {
      const lx = Math.round(x + (CARD.w - textWidth(line, normal)) / 2);
      r.text(line, normal, lx, Math.round(top + i * 11), grey(lerp(0.35, 1, focus)));
    });
  }

  function frame(t: number): Raster {
    const r = new Raster(W, H).clear(BLACK);
    const sel = selection(t, outCubic, SLIDE);
    const pressed = span(t, START_AT, START_AT + 0.45);

    if (pressed < 1) {
      const a = 1 - outQuad(pressed);
      header(r, sel);
      const pitch = CARD.w + CARD.gap;
      PRESETS.forEach((text, k) => {
        const x = CARD.x + (k - sel) * pitch;
        if (x < -CARD.w || x > W) return;
        const focus = Math.max(0, 1 - Math.abs(k - sel));
        card(r, x, text, focus);
      });
      // Press: the focused card flashes and lifts away.
      if (pressed > 0) {
        r.roundRect(CARD.x, CARD.y, CARD.w, CARD.h, 4, grey(1, (1 - pressed) * 0.9));
        r.fade((x, y) => (y < 12 || y > 58 ? a : 1 - pressed));
      }
      // Pager: dots, with a pill that slides to the selection.
      const dotsW = PRESETS.length * 6 + 4;
      const dx = Math.round((W - dotsW) / 2);
      PRESETS.forEach((_, k) => r.fillRect(dx + k * 6 + (k > sel ? 4 : 0), 61, 3, 3, grey(0.35, a)));
      const pillX = dx + sel * 6;
      r.roundRect(Math.round(pillX), 61, 7, 3, 1, grey(1, a));
      hint(r, t, 69);
      if (pressed > 0) r.fade((_x, y) => (y >= 66 ? a : 1));
    }
    if (pressed > 0.4) showing(r, t, sel, span(pressed, 0.4, 1));
    return r;
  }

  return {
    id: "cards",
    name: "1 · Cards",
    pitch:
      "One message per card, with the neighbours peeking in at the edges. Turning the wheel slides the deck (arrows nudge, the pager pill glides). START flashes the card and switches to a 'Now on front' view with a draining 10-second bar.",
    duration: DURATION,
    frame,
  };
}

// ---------------------------------------------------------------------------------------------------------------
// 2 — Wheel: a vertical picker; rows glide through a fixed highlight bar and invert as they pass through it.

function optionWheel(): Demo {
  const ROW = 13;
  const MID = 38;
  const SLIDE = 0.34;
  const BAR = { x: 3, w: W - 8, h: 13 };

  function list(r: Raster, sel: number, color: (d: number) => Color, t: number) {
    const small = font("small");
    PRESETS.forEach((text, k) => {
      const d = k - sel;
      const y = Math.round(MID + d * ROW - 6);
      if (y < 4 || y > 64) return;
      const x = Math.round((W - 4 - textWidth(text, small)) / 2);
      r.text(text, small, x, y + 2, color(Math.abs(d)));
    });
    void t;
  }

  function frame(t: number): Raster {
    const r = new Raster(W, H).clear(BLACK);
    const sel = selection(t, (p) => outBack(p, 1.4), SLIDE);
    const pressed = span(t, START_AT, START_AT + 0.45);

    if (pressed < 1) {
      const a = 1 - outQuad(pressed);
      // Rows outside the bar: dimmer the further they are.
      r.clip = { x0: 0, y0: 13, x1: W, y1: 66 };
      list(r, sel, (d) => grey(Math.max(0.12, 0.75 - d * 0.28)), t);
      // The bar, then the same rows clipped to it in black: they invert as they glide through.
      const by = MID - 7;
      r.roundRect(BAR.x, by, BAR.w, BAR.h, 3, (_x, _y, _u, v) => grey(0.95 - v * 0.15));
      r.clip = { x0: BAR.x, y0: by, x1: BAR.x + BAR.w, y1: by + BAR.h };
      list(r, sel, () => BLACK, t);
      r.clip = null;
      // Top and bottom fades under the header and above the hint.
      r.fade((_x, y) => (y < 13 || y >= 66 ? 1 : Math.min(1, (y - 12) / 9, (66 - y) / 9)));
      // Scrollbar.
      const track = { x: W - 3, y: 15, h: 48 };
      r.fillRect(track.x, track.y, 1, track.h, grey(0.2));
      const th = track.h / PRESETS.length;
      r.fillRect(track.x - 1, Math.round(track.y + sel * th), 2, Math.round(th), grey(0.8));
      header(r, sel);
      hint(r, t, 69);
      if (pressed > 0) {
        r.roundRect(BAR.x, by, BAR.w, BAR.h, 3, grey(1, (1 - pressed) * 0.8));
        r.fade(a);
      }
    }
    if (pressed > 0.4) showing(r, t, sel, span(pressed, 0.4, 1));
    return r;
  }

  return {
    id: "wheel",
    name: "2 · Wheel",
    pitch:
      "A vertical picker matched to the scroll wheel: messages glide through a fixed highlight bar (with a little overshoot) and invert as they pass through it. Shows more options at once; the selected one is always in the same place.",
    duration: DURATION,
    frame,
  };
}

// ---------------------------------------------------------------------------------------------------------------
// 3 — Battle Menu: the presets as a move list with a ▶ cursor in a double-ruled box; the text box below shows the
// whole message. START "uses the move", and the countdown is an HP bar.

/** Double-ruled box, as in handheld RPG menus. */
function ruledBox(r: Raster, x: number, y: number, w: number, h: number, alpha = 1) {
  r.roundRect(x, y, w, h, 2, (px, py) => {
    const lx = px - x;
    const ly = py - y;
    const outer = lx === 0 || ly === 0 || lx === w - 1 || ly === h - 1;
    const inner = lx === 2 || ly === 2 || lx === w - 3 || ly === h - 3;
    const inside = lx > 2 && ly > 2 && lx < w - 3 && ly < h - 3;
    if (outer) return grey(0.85, alpha);
    if (inner) return grey(0.55, alpha);
    return inside || lx === 1 || ly === 1 || lx === w - 2 || ly === h - 2 ? grey(0.04, alpha) : null;
  });
}

function cursor(r: Raster, x: number, y: number, c: Color) {
  for (let i = 0; i < 4; i++) r.fillRect(x + i, y + i, 1, 7 - i * 2, c);
}

function optionBattle(): Demo {
  const ROW = 9;
  const LIST = { x: 0, y: 11, w: W, h: 50 };
  const STEP = 0.12;

  function frame(t: number): Raster {
    const r = new Raster(W, H).clear(BLACK);
    const sel = selection(t, outCubic, STEP);
    const pressed = span(t, START_AT, START_AT + 0.45);
    const small = font("small");

    if (t < START_AT + 0.25) {
      header(r, sel);
      ruledBox(r, LIST.x, LIST.y, LIST.w, LIST.h);
      MOVES.forEach((move, k) => {
        const y = LIST.y + 5 + k * ROW;
        const on = Math.abs(k - sel) < 0.5;
        r.text(move, small, 14, y - 2, grey(on ? 1 : 0.6));
        const pp = "PP 10/10";
        if (on) r.text(pp, small, W - 8 - textWidth(pp, small), y - 2, grey(0.5));
      });
      // The cursor glides between rows, with a little idle nudge like a waiting menu.
      const nudge = Math.floor(t * 2.5) % 2 === 0 ? 0 : 1;
      cursor(r, 5 + nudge, LIST.y + 5 + sel * ROW, WHITE);
      // Text box: the whole message for the highlighted move, typed afresh on every move.
      ruledBox(r, 0, 62, W, 18);
      const k = Math.round(sel);
      const last = [...TURNS].reverse().find((turn) => t >= turn.at);
      const since = t - (last ? last.at : 0);
      const msg = PRESETS[k]!;
      let shown = 0;
      const typed = Math.floor(since * 45);
      r.text(msg, small, 6, 64, grey(0.92), () => ({ hidden: shown++ >= typed }));
      if (pressed > 0) {
        // The move is chosen: the row blinks and everything wipes away in bands.
        const blink = Math.floor(t * 20) % 2 === 0;
        if (blink) r.fillRect(12, LIST.y + 3 + sel * ROW, 120, 8, grey(1, 0.35));
        for (let band = 0; band < 10; band++) {
          const w = Math.round(W * outQuad(span(pressed, band * 0.03, band * 0.03 + 0.5)));
          r.fillRect(band % 2 === 0 ? 0 : W - w, band * 8, w, 8, BLACK);
        }
      }
      return r;
    }

    // "Now on front", battle style.
    const a = span(pressed, 0.5, 1);
    const elapsed = t - START_AT;
    const left = Math.max(0, 1 - elapsed / SHOW_SECONDS);
    const live = 0.5 + 0.5 * Math.sin(t * 6);
    r.glow(9.5, 5.5, 3.5, 3.5, grey(live * a), 1.2);
    r.fillRect(8, 4, 3, 3, grey(a));
    r.text("NOW ON FRONT", small, 15, 1, grey(0.9, a));
    const k = Math.round(sel);
    const normal = font("normal");
    const move = MOVES[k]!;
    r.text(move, normal, Math.round((W - textWidth(move, normal)) / 2), 14, grey(1, a));
    // HP-style countdown.
    r.text("HP", font("tiny"), 14, 33, grey(0.8, a));
    r.fillRect(26, 32, 108, 7, grey(0.3, a));
    r.fillRect(27, 33, Math.round(106 * left), 5, grey(0.95, a));
    const secs = `${Math.ceil(left * SHOW_SECONDS)}/${SHOW_SECONDS}`;
    r.text(secs, small, 134 - textWidth(secs, small), 40, grey(0.6, a));
    ruledBox(r, 0, 54, W, 26, a);
    const used = `PKMN LIFE used ${move}!`;
    let shown = 0;
    const typed = Math.floor((t - START_AT - 0.55) * 40);
    r.text(used, small, 6, 57, grey(0.92, a), () => ({ hidden: shown++ >= typed }));
    const tail = "BACK to run away";
    r.text(tail, small, 6, 66, grey(0.45, a));
    return r;
  }

  return {
    id: "battle",
    name: "3 · Battle Menu",
    pitch:
      "The presets as a move list in a double-ruled box, with a ▶ cursor that glides between rows and 'PP 10/10' on the highlighted move. The text box underneath types out the full message. START uses the move and the 10-second countdown becomes an HP bar.",
    duration: DURATION,
    frame,
  };
}

export const BACK_OPTIONS: Demo[] = [optionCards(), optionWheel(), optionBattle()];

void hex;
void mix;
