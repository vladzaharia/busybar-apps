// Front scene E, "Burst Ticker": the clock switches off into a line of light that bursts, the Jira chevrons fly in,
// and the message glides in as one line over drifting particles, each letter dropping into place as it enters. It
// comes to rest on its end, then rolls away for the whole message in two small lines, so it can be read in full.
// Everything then collapses to a point and the clock switches back on.
//
// Transparent where the live clock shows (the CRT switch-off and switch-on act on the real clock).

import {
  MOTION,
  Raster,
  accentWords,
  burst,
  capCentre,
  clip,
  collapse,
  crt,
  drawJiraMark,
  font,
  glide,
  hex,
  inBack,
  inOutCubic,
  jiraFlyIn,
  jiraMarkIn,
  layer,
  mix,
  paginate,
  particles,
  popChars,
  pulse,
  readTime,
  span,
  textWidth,
  type Clip,
} from "@vladzaharia/bar-pixel";
import type { Nag } from "../../src/presets.ts";

const WHITE = hex("#FFFFFF");
const BLUE = hex("#579DFF");
/** Where the text's room begins: just past the mark's 16 px square (x 3 to 18). */
const TEXT_X0 = 19;
// The 12 px mark in that square, by its optical centre: (4, 3), which leaves 4 px before it, the lockup's 8 px gap
// (ink to text) and 6 px after the resting text.
const MARK = { ...jiraMarkIn({ x: 3, y: 0, width: 16, height: 16 }, 12), size: 12 as const };
const ROLL = 0.26;

export function ticker(preset: Nag): Clip {
  const text = preset.message.toUpperCase();
  const f = font("extra_large");
  const total = textWidth(text, f);
  // Rest with as many whole words from the end as fit beside the mark, centred there ("YOUR PR!"); a last word too
  // wide for that rests flush right instead, so the end of the line is always on screen.
  const space = 72 - TEXT_X0;
  const words = text.split(" ");
  let tail = words[words.length - 1]!;
  for (let i = words.length - 2; i >= 0 && textWidth(words.slice(i).join(" "), f) <= space - 2; i--) tail = words.slice(i).join(" ");
  const tailW = textWidth(tail, f);
  const fits = tailW <= space - 2;
  const endX = fits ? TEXT_X0 + Math.round((space - tailW) / 2) - (total - tailW) : 71 - total;

  const SWITCH_OFF = 0.3;
  const GLIDE_AT = 0.85;
  // Every message glides at about the same speed.
  const TRAVEL = Math.max(3.5, (72 - endX) / MOTION.glideSpeed);
  // Rest on words that fit; a last word that cannot fit beside the mark goes straight on to the recap.
  const REST = fits ? 0.9 : 0.2;
  const recapAt = GLIDE_AT + TRAVEL + REST;

  // The recap: the whole message across the full width, two small lines at a time, each page held to be read.
  const pages = paginate(preset.message, 70).map((p) => ({ lines: p.lines, hold: readTime(p.lines.join(" ")) }));
  const pageAt: number[] = [];
  let recapLen = 0;
  for (const p of pages) {
    pageAt.push(recapLen);
    recapLen += ROLL + p.hold;
  }
  const outroAt = recapAt + recapLen;
  const COLLAPSE = 0.7;
  const SWITCH_ON = 0.3;

  const color = (i: number, ch: string, t: number) =>
    ch === "?" && t > TRAVEL ? hex(Math.sin(t * 16 + i) > 0 ? "#FFFFFF" : "#579DFF") : accentWords(text, preset.accent, WHITE, BLUE)(i, ch, t);
  const line = glide({
    text,
    font: "extra_large",
    y: capCentre("extra_large"),
    endX,
    duration: TRAVEL + REST + ROLL,
    travel: TRAVEL,
    fadeX: TEXT_X0,
    color,
    hop: popChars(text, TRAVEL + 0.1),
  });

  const black = (from: number, to: number): Clip => clip(to, (r, t) => t >= from && r.fillRect(0, 0, r.width, r.height, hex("#000000")));
  const flyIn = jiraFlyIn({ ...MARK, duration: recapAt, hops: [GLIDE_AT + TRAVEL * 0.45, GLIDE_AT + TRAVEL] });

  const body = layer(
    // The clock switches off; from then on the ground is black.
    crt({ duration: SWITCH_OFF, mode: "cover" }),
    black(SWITCH_OFF, outroAt),
    { clip: burst({ duration: 0.62 }), at: 0.18 },
    { clip: particles({ duration: outroAt - 0.5, fadeIn: 0.7, fadeOut: 0.25 }), at: 0.5 },
    // The mark: flies in, then slides off to the left to make room for the recap.
    clip(outroAt, (r, t) => {
      if (t < recapAt) return flyIn.draw(r, t);
      const p = span(t, recapAt, recapAt + ROLL);
      if (p < 1) drawJiraMark(r, MARK.x, MARK.y, MARK.size, { poses: [0, 1, 2].map(() => ({ dx: -Math.round(inBack(p) * 16) })) });
    }),
    // The line, gliding in; it rises away as the recap rolls in.
    {
      clip: clip(TRAVEL + REST + ROLL, (r, t) => {
        const lift = Math.round(inOutCubic(span(t, TRAVEL + REST, TRAVEL + REST + ROLL)) * 16);
        const l = new Raster(r.width, r.height);
        l.clip = { x0: TEXT_X0 - 1, y0: 0, x1: r.width, y1: r.height };
        line.draw(l, t);
        r.draw(l, 0, -lift);
      }),
      at: GLIDE_AT,
    },
    // A glow swells behind the end of the line as it comes to rest.
    { clip: pulse({ duration: 0.6, x: 45, y: 8, rx: 26, ry: 9, period: 1.2, strength: 0.55 }), at: GLIDE_AT + TRAVEL },
    // The recap pages, each rolling up from below as the previous one leaves.
    {
      clip: clip(recapLen, (r, t) => {
        const small = font("small");
        pages.forEach((page, k) => {
          const start = pageAt[k]!;
          const pin = inOutCubic(span(t, start, start + ROLL));
          const next = pageAt[k + 1];
          const pout = next === undefined ? 0 : inOutCubic(span(t, next, next + ROLL));
          if (pin <= 0 || pout >= 1) return;
          const dy = Math.round((1 - pin) * 16 - pout * 16);
          page.lines.forEach((l, li) => {
            const x = Math.round((72 - textWidth(l, small)) / 2);
            const accent = accentWords(l.toUpperCase(), preset.accent, WHITE, BLUE);
            r.text(l, small, x, (li === 0 ? (page.lines.length === 1 ? 4 : 0) : 7) + dy, WHITE, (gi, ch) => ({
              color: ch === "?" ? mix(WHITE, BLUE, 0.5 + 0.5 * Math.sin(t * 12 + gi)) : accent(gi, ch, t),
            }));
          });
        });
      }),
      at: recapAt,
      // The last page stays up to the end of the body, which is what the collapse takes as its picture (`outroAt -
      // recapAt` can come out a rounding error longer than `recapLen`, and the page would be missing).
      hold: true,
    },
  );

  return clip(outroAt + COLLAPSE + SWITCH_ON, (r, t) => {
    if (t < outroAt) return body.draw(r, t);
    if (t < outroAt + COLLAPSE) return collapse({ duration: COLLAPSE, source: body }).draw(r, t - outroAt);
    crt({ duration: SWITCH_ON, mode: "reveal" }).draw(r, t - outroAt - COLLAPSE);
  });
}
