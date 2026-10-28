// Front title cards for the Majora's Mask sprint clock: "Dawn of / The Fifth Day", then "-6 Days Remain-". A
// sprint has at most 20 work days (4 weeks), so every card is pre-rendered as its own section; the app plays the
// day's dawn card and queues the matching remain card after it. The dawn card fades in over the clock and the
// remain card fades back out to it.

import { MOTION, fade, fitFont, seq, titleCard, type Clip } from "@vladzaharia/bar-pixel";

export const MAX_DAYS = 20;

const ORDINALS = [
  "First", "Second", "Third", "Fourth", "Fifth", "Sixth", "Seventh", "Eighth", "Ninth", "Tenth",
  "Eleventh", "Twelfth", "Thirteenth", "Fourteenth", "Fifteenth", "Sixteenth", "Seventeenth", "Eighteenth", "Nineteenth", "Twentieth",
];

/** "Dawn of / The Nth Day" (day is 1-based), or "The Final Day". */
function dawn(day: number | "final"): Clip {
  const text = day === "final" ? "The Final Day" : `The ${ORDINALS[day - 1]} Day`;
  return seq(
    fade({ from: 0, to: 1, duration: MOTION.base }),
    titleCard({ duration: 2.8, lines: [{ text: "Dawn of", font: "small", cap: 1 }, { text, font: fitFont(text, 70), cap: 8 }] }),
  );
}

/** "-N Days Remain-", or "-Final Hours-" on the last day. */
function remain(left: number): Clip {
  const text = left <= 1 ? "-Final Hours-" : `-${left} Days Remain-`;
  const f = fitFont(text, 70, ["normal", "small"]);
  const cap = f === "normal" ? 4 : 5;
  return seq(titleCard({ duration: 2.4, lines: [{ text, font: f, cap }] }), fade({ from: 1, to: 0, duration: 0.35 }));
}

/** Sections: dawn-1 .. dawn-20, dawn-final, remain-1 .. remain-20. */
export function cardParts(): [string, Clip][] {
  const parts: [string, Clip][] = [];
  for (let d = 1; d <= MAX_DAYS; d++) parts.push([`dawn-${d}`, dawn(d)]);
  parts.push(["dawn-final", dawn("final")]);
  for (let n = 1; n <= MAX_DAYS; n++) parts.push([`remain-${n}`, remain(n)]);
  return parts;
}
