// Front nag "Slot machine": stripes close over the clock onto a slot machine. Bulbs chase round it, the lever is
// pulled, and three reels of sevens, bugs and Jira marks spin and land one by one on Jira, Jira, Jira. Confetti, and
// "JACKPOT!" rolls in, then "FILE IT!". The picture fades to black and the stripes open onto the clock.

import {
  MOTION,
  Raster,
  capTop,
  clip,
  confetti,
  drawBug,
  drawJiraMark,
  drawReel,
  fade,
  font,
  hex,
  inOutCubic,
  inkWidth,
  layer,
  lerp,
  mix,
  readTime,
  reelOffset,
  reelSteps,
  roll,
  seq,
  sparkles,
  span,
  stripes,
  type Clip,
  type ReelSymbol,
} from "@vladzaharia/bar-pixel";
import type { Nag } from "../../../src/presets.ts";
import { AMBER, BLACK, JIRA_LIGHT, JIRA_MID, SOFT, WHITE } from "../look.ts";

const W = 72;
const H = 16;
const ORANGE = hex("#FF7A33");
const CYAN = hex("#62C7FF");

type Symbol = "mark" | "bug" | "seven";
const STRIP: Symbol[] = ["seven", "bug", "mark", "bug", "seven", "mark", "bug"];
/** Three 16 × 14 windows between the bulb rows, and the lever on the right. */
const REEL_X = [5, 24, 43];
const REEL = { y: 1, width: 16, height: 14 };
const GAP = 15;

const SYMBOLS: Record<Symbol, ReelSymbol> = {
  // The 11 px mark, by its optical centre: it sits a pixel right of the window's centre line and a row down.
  mark: (r, cx, top, alpha) => drawJiraMark(r, cx - 6, top + 1, 11, { poses: [0, 1, 2].map(() => ({ alpha })) }),
  bug: (r, cx, top, alpha) => drawBug(r, cx - 5, top, { alpha }),
  seven: (r, cx, top, alpha) => {
    const f = font("extra_large");
    r.text("7", f, Math.round(cx - inkWidth("7", f) / 2), capTop("extra_large", top + 1), ORANGE, () => ({ alpha }));
  },
};

export function slots(_e: Nag): Clip {
  const LIGHTS_ON = 0.3;
  const PULL = 0.35;
  const SPIN_AT = PULL + 0.2;
  const STOPS = [1.35, 1.85, 2.6];
  const WIN = STOPS[2]! + 0.1;
  const TEXT_AT = WIN + 0.75;
  const ROLL = 0.26;
  const words = [
    { text: "", font: "extra_large" as const, hold: ROLL },
    { text: "JACKPOT!", font: "extra_large" as const, hold: readTime("JACKPOT!") + MOTION.rest },
    { text: "FILE IT!", font: "extra_large" as const, hold: readTime("FILE IT!") + MOTION.rest },
  ];
  const END = TEXT_AT + words.reduce((d, w) => d + w.hold, 0);
  // JACKPOT! shimmers amber and white, all the way out; FILE IT! is white with IT! in Jira blue.
  const text = roll({
    words,
    box: { x: 0, width: W },
    rollTime: ROLL,
    color: (i, _ch, t, word) => (word === 1 ? mix(AMBER, WHITE, 0.5 + 0.5 * Math.sin(t * 10 - i * 0.8)) : i < 4 ? WHITE : JIRA_LIGHT),
  });
  // Each reel starts on its own symbol and turns whole symbols to land on a mark, the later ones further.
  const starts = [0, 1, 4];
  const steps = REEL_X.map((_, i) => reelSteps(STRIP, starts[i]!, (s) => s === "mark", 18 + i * 6));
  const offset = (i: number, t: number) => reelOffset(t, { at: SPIN_AT, stop: STOPS[i]!, steps: steps[i]!, gap: GAP });
  const strip = STRIP.map((s) => SYMBOLS[s]);

  const machine = clip(END, (r, t) => {
    const lift = Math.round(inOutCubic(span(t, TEXT_AT, TEXT_AT + ROLL)) * H);
    const won = t >= WIN;
    // Bulbs along the top and bottom edges, chasing; all flashing on a win.
    const lit = span(t, 0, LIGHTS_ON);
    for (let k = 0; k < 24; k++) {
      const x = 1 + k * 3;
      if (k / 24 > lit) continue;
      const on = won ? Math.floor(t * 8) % 2 === k % 2 : (k + Math.floor(t * 10)) % 3 === 0;
      const c = on ? AMBER : hex("#4A3008");
      r.blend(x, 0, c);
      r.blend(x, H - 1, c);
    }
    if (lift >= H) return;
    const l = new Raster(W, H);
    REEL_X.forEach((x, i) => {
      const p = offset(i, t);
      // A reel flashes as it stops; on the win they all glow blue together.
      const glow = won ? 0.5 + 0.5 * Math.sin((t - WIN) * 14) : t >= STOPS[i]! ? Math.max(0, 1 - (t - STOPS[i]!) / 0.3) : 0;
      drawReel(l, { x, ...REEL, strip, start: starts[i], offset: p, gap: GAP, speed: (offset(i, t + 1 / 60) - p) * 60, glow, glowColor: won ? JIRA_MID : WHITE });
    });
    // The lever: a knob on a stick, pulled down and springing back.
    const pull = Math.sin(span(t, PULL, PULL + 0.4) * Math.PI);
    const knob = Math.round(lerp(1, 8, pull));
    l.fillRect(65, knob + 2, 1, 12 - knob - 1, hex("#9AA7BA"));
    l.fillRect(63, 12, 5, 3, hex("#6B778C"));
    l.roundRect(64, knob, 3, 3, 1, ORANGE);
    r.draw(l, 0, -lift);
  });

  const FADE = MOTION.base;
  const body = layer(
    clip(END, (r) => r.fillRect(0, 0, W, H, BLACK)),
    machine,
    { clip: confetti({ duration: END - WIN, pieces: 46, colors: [AMBER, JIRA_MID, CYAN, ORANGE, SOFT] }), at: WIN },
    { clip: sparkles({ duration: END - TEXT_AT, count: 9, color: AMBER, box: { x: 4, y: 1, width: 64, height: 14 } }), at: TEXT_AT },
    { clip: text, at: TEXT_AT },
    // The machine fades up out of the stripes' black; once "FILE IT!" has been read, the picture fades back to it.
    fade({ duration: MOTION.quick, from: 1, to: 0 }),
    { clip: fade({ duration: FADE, from: 0, to: 1 }), at: END - FADE },
  );
  return seq(stripes({ mode: "cover" }), body, stripes({ mode: "reveal" }));
}
