// The back screen: the presets as a move list in a double-ruled box, a ▶ cursor, and a text box typing out the
// highlighted message. START "uses the move": the screen wipes to a "Now on front" view whose HP-style bar counts
// down while the front plays, with a capture ball rocking in the corner. "PKMN" is the handheld games' symbol.
//
// Every state is a section of one animation, so the app only has to name sections and the firmware chains them
// frame-exactly:
//   enter-K       typing message K, cursor on K             → then idle-K
//   idle-K        cursor nudging, message shown (loops)
//   go-J-K        cursor gliding J → K, then typing K       → then idle-K
//   use-K         row blinks, bands wipe the screen
//   show-K-STYLE  "Now on front" with the countdown, as long as that nag

import {
  ballShake,
  clip,
  drawJiraMark,
  drawPkmn,
  font,
  hex,
  outCubic,
  outQuad,
  PKMN_SIZE,
  span,
  textWidth,
  type Clip,
  type Color,
  type Raster,
} from "@vladzaharia/bar-pixel";
import { PRESETS, type NagStyle } from "../../src/presets.ts";

const W = 148;
const H = 80;
// Header rows 0-10, a blank row, the list box, a blank row, the text box. Inside each box the lettering sits with
// equal space above and below (3 rows in the list, centred in the text box).
const ROW = 8;
const LIST = { x: 0, y: 12, w: W, h: 49 };
const BOX = { y: 62, h: 18 };
/** Top row of item i's capitals. */
const itemTop = (i: number) => LIST.y + 6 + i * ROW;
const CPS = 45;
const GLIDE = 0.12;

const grey = (v: number, a = 1): Color => ({ r: v, g: v, b: v, a });
const GREY_TONES = [grey(1), grey(0.8), grey(0.58)];

/** Seconds to type a message into the text box. */
export const typeTime = (k: number) => PRESETS[k]!.message.length / CPS + 0.15;

function ruledBox(r: Raster, x: number, y: number, w: number, h: number, alpha = 1): void {
  r.roundRect(x, y, w, h, 2, (px, py) => {
    const lx = px - x;
    const ly = py - y;
    if (lx === 0 || ly === 0 || lx === w - 1 || ly === h - 1) return grey(0.85, alpha);
    if (lx === 2 || ly === 2 || lx === w - 3 || ly === h - 3) return grey(0.55, alpha);
    return grey(0.04, alpha);
  });
}

/** A ▶ as tall as the capitals it points at (5 rows from `y`). */
function cursor(r: Raster, x: number, y: number): void {
  for (let i = 0; i < 3; i++) r.fillRect(x + i, y + i, 1, 5 - i * 2, grey(1));
}

/** The menu at a selection (fractional while gliding), with `typed` letters of message `k` in the text box. */
function menu(r: Raster, o: { sel: number; k: number; typed: number; nudge: boolean }): void {
  r.clear(hex("#000000"));
  const small = font("small");
  drawJiraMark(r, 2, 0, 11, { tones: GREY_TONES });
  // "PKMN LIFE", with the handheld games' PKMN symbol.
  drawPkmn(r, 15, 1, grey(0.9));
  r.text("LIFE", small, 15 + PKMN_SIZE.width + 3, 1, grey(0.9));
  const idx = `${o.k + 1}/${PRESETS.length}`;
  r.text(idx, small, W - 2 - textWidth(idx, small), 1, grey(0.55));
  ruledBox(r, LIST.x, LIST.y, LIST.w, LIST.h);
  PRESETS.forEach((p, i) => {
    const on = Math.abs(i - o.sel) < 0.5;
    r.text(p.move, small, 14, itemTop(i) - 2, grey(on ? 1 : 0.6));
  });
  cursor(r, 5 + (o.nudge ? 1 : 0), Math.round(itemTop(o.sel)));
  ruledBox(r, 0, BOX.y, W, BOX.h);
  let n = 0;
  r.text(PRESETS[o.k]!.message, small, 6, BOX.y + 4, grey(0.92), () => ({ hidden: n++ >= o.typed }));
}

const enter = (k: number): Clip => clip(typeTime(k), (r, t) => menu(r, { sel: k, k, typed: Math.floor(t * CPS), nudge: false }));

/** One idle loop: the cursor nudges right and back, like a menu waiting for input. */
const idle = (k: number): Clip => clip(0.8, (r, t) => menu(r, { sel: k, k, typed: 999, nudge: t >= 0.4 }));

const go = (j: number, k: number): Clip =>
  clip(GLIDE + typeTime(k), (r, t) => {
    const sel = j + (k - j) * outCubic(Math.min(1, t / GLIDE));
    const typing = t - GLIDE;
    menu(r, { sel, k, typed: typing < 0 ? 0 : Math.floor(typing * CPS), nudge: false });
  });

const use = (k: number): Clip =>
  clip(0.45, (r, t) => {
    menu(r, { sel: k, k, typed: 999, nudge: false });
    if (Math.floor(t * 20) % 2 === 0) r.fillRect(12, itemTop(k) - 2, 120, 9, grey(1, 0.35));
    const p = t / 0.45;
    for (let band = 0; band < 10; band++) {
      const w = Math.ceil(W * outQuad(span(p, band * 0.03, band * 0.03 + 0.5)));
      r.fillRect(band % 2 === 0 ? 0 : W - w, band * 8, w, 8, hex("#000000"));
    }
  });

/** "Now on front": the move, an HP bar draining over `seconds`, and the battle text. */
const show = (k: number, seconds: number): Clip =>
  clip(seconds, (r, t) => {
    r.clear(hex("#000000"));
    const small = font("small");
    const normal = font("normal");
    const a = span(t, 0, 0.3);
    // A capture ball rocking while the move plays out on the front.
    ballShake({ duration: seconds, x: 10, y: 5, fadeIn: 0.3 }).draw(r, t);
    r.text("NOW ON FRONT", small, 17, 1, grey(0.9, a));
    const move = PRESETS[k]!.move;
    r.text(move, normal, Math.round((W - textWidth(move, normal)) / 2), 14, grey(1, a));
    const left = Math.max(0, 1 - t / seconds);
    r.text("HP", font("tiny"), 14, 33, grey(0.8, a));
    r.fillRect(26, 32, 108, 7, grey(0.3, a));
    r.fillRect(27, 33, Math.round(106 * left), 5, grey(0.95, a));
    const secs = `${Math.ceil(left * seconds)}/${Math.ceil(seconds)}`;
    r.text(secs, small, 134 - textWidth(secs, small), 40, grey(0.6, a));
    ruledBox(r, 0, 54, W, 26, a);
    // "PKMN LIFE used MOVE!", typed out with the PKMN symbol as its first character.
    const typed = Math.floor((t - 0.25) * 40);
    if (typed >= 1) drawPkmn(r, 6, 59, grey(0.92), a);
    let n = 1;
    r.text(`LIFE used ${move}!`, small, 6 + PKMN_SIZE.width + 3, 59, grey(0.92, a), () => ({ hidden: n++ >= typed }));
    r.text("BACK to run away", small, 6, 67, grey(0.45, a));
  });

/** Every section of the back screen, given how long each front nag runs. */
export function backParts(nagSeconds: Record<NagStyle, number[]>): [string, Clip][] {
  const parts: [string, Clip][] = [];
  PRESETS.forEach((_, k) => {
    parts.push([`enter-${k}`, enter(k)], [`idle-${k}`, idle(k)], [`use-${k}`, use(k)]);
    for (const style of ["encounter", "ticker"] as const) parts.push([`show-${k}-${style}`, show(k, nagSeconds[style][k]!)]);
    if (k > 0) parts.push([`go-${k - 1}-${k}`, go(k - 1, k)]);
    if (k < PRESETS.length - 1) parts.push([`go-${k + 1}-${k}`, go(k + 1, k)]);
  });
  return parts;
}

export { W as BACK_WIDTH, H as BACK_HEIGHT };
