// Front scene E, "Burst Ticker": the clock switches off into a line of light that bursts, the Jira chevrons fly in,
// and the message glides in as one line over drifting particles, each letter dropping into place as it enters. It
// comes to rest on its last word, then everything collapses to a point and the clock switches back on.
//
// Transparent where the live clock shows (the CRT switch-off and switch-on act on the real clock).

import {
  accentWords,
  burst,
  capCentre,
  clip,
  collapse,
  crt,
  font,
  glide,
  hex,
  jiraFlyIn,
  layer,
  particles,
  popChars,
  pulse,
  textWidth,
  type Clip,
} from "@vladzaharia/bar-pixel";
import type { Preset } from "../../src/presets.ts";

const WHITE = hex("#FFFFFF");
const BLUE = hex("#579DFF");
const TEXT_X0 = 16;
const MARK = { x: 1, y: 2, size: 12 };

export function ticker(preset: Preset): Clip {
  const text = preset.message.toUpperCase();
  const f = font("extra_large");
  const words = text.split(" ");
  const last = words[words.length - 1]!;
  // Rest with the last word centred in the space beside the mark.
  const lastAt = textWidth(text.slice(0, text.length - last.length), f);
  const endX = TEXT_X0 + Math.round((72 - TEXT_X0 - textWidth(last, f)) / 2) - lastAt;

  const SWITCH_OFF = 0.3;
  const GLIDE_AT = 0.85;
  // Long lines take a little longer, so every message glides at roughly the same speed (~39 px/s).
  const TRAVEL = Math.max(3.5, (72 - endX) / 39);
  const REST = 1.4;
  const outroAt = GLIDE_AT + TRAVEL + REST;
  const COLLAPSE = 0.7;
  const SWITCH_ON = 0.3;

  const color = (i: number, ch: string, t: number) =>
    ch === "?" && t > TRAVEL ? hex(Math.sin(t * 16 + i) > 0 ? "#FFFFFF" : "#579DFF") : accentWords(text, preset.accent, WHITE, BLUE)(i, ch, t);
  const hop = popChars(text, TRAVEL + 0.1);

  const black = (from: number, to: number): Clip => clip(to, (r, t) => t >= from && r.fillRect(0, 0, r.width, r.height, hex("#000000")));

  const body = layer(
    // The clock switches off; from then on the ground is black.
    crt({ duration: SWITCH_OFF, mode: "cover" }),
    black(SWITCH_OFF, outroAt),
    { clip: burst({ duration: 0.62 }), at: 0.18 },
    { clip: particles({ duration: outroAt - 0.5, fadeIn: 0.7, fadeOut: 0.25 }), at: 0.5 },
    { clip: jiraFlyIn({ ...MARK, duration: outroAt, hops: [GLIDE_AT + TRAVEL * 0.45, GLIDE_AT + TRAVEL] }), at: 0 },
    {
      clip: clip(TRAVEL + REST, (r, t) => {
        r.clip = { x0: TEXT_X0 - 1, y0: 0, x1: r.width, y1: r.height };
        glide({ text, font: "extra_large", y: capCentre("extra_large"), endX, duration: TRAVEL + REST, travel: TRAVEL, fadeX: TEXT_X0, color, hop }).draw(r, t);
        r.clip = null;
      }),
      at: GLIDE_AT,
    },
    // A glow swells behind the last word as the line comes to rest.
    { clip: clip(0.6, (r, t) => pulse({ duration: 0.6, x: 45, y: 8, rx: 26, ry: 9, period: 1.2, strength: 0.55 }).draw(r, t)), at: GLIDE_AT + TRAVEL },
  );

  return clip(outroAt + COLLAPSE + SWITCH_ON, (r, t) => {
    if (t < outroAt) return body.draw(r, t);
    if (t < outroAt + COLLAPSE) return collapse({ duration: COLLAPSE }).draw(r, t - outroAt);
    crt({ duration: SWITCH_ON, mode: "reveal" }).draw(r, t - outroAt - COLLAPSE);
  });
}
