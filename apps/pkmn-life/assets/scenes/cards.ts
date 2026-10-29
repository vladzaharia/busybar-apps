// Front title cards for the Majora's Mask clock animation, one for each part of a work day: "Dawn of / The Fifth Day"
// then "-6 Days Remain-" in the morning, "Meal of / The Fifth Day" at midday, "Dusk of / The Fifth Day" at the end of
// the day. A sprint has at most 20 work days (4 weeks), so every card is pre-rendered as its own section; the app
// plays the card for the day and part of the day, and after dawn queues the matching remain card. Every card fades in
// over the clock; the remain card, and the meal and dusk cards, fade back out to it.

import { MOTION, fade, fitFont, seq, titleCard, type Clip } from "@vladzaharia/bar-pixel";

export const MAX_DAYS = 20;

/** The parts of a work day, each with its card. The app names sections by these. */
export const DAY_PARTS = { dawn: "Dawn of", meal: "Meal of", dusk: "Dusk of" } as const;
type DayPart = keyof typeof DAY_PARTS;

const ORDINALS = [
  "First", "Second", "Third", "Fourth", "Fifth", "Sixth", "Seventh", "Eighth", "Ninth", "Tenth",
  "Eleventh", "Twelfth", "Thirteenth", "Fourteenth", "Fifteenth", "Sixteenth", "Seventeenth", "Eighteenth", "Nineteenth", "Twentieth",
];

/** "Dawn of / The Nth Day" (day is 1-based), or "The Final Day"; likewise "Meal of" and "Dusk of". */
function heading(part: DayPart, day: number | "final"): Clip {
  const text = day === "final" ? "The Final Day" : `The ${ORDINALS[day - 1]} Day`;
  const card = titleCard({ duration: 2.8, lines: [{ text: DAY_PARTS[part], font: "small", cap: 1 }, { text, font: fitFont(text, 70), cap: 8 }] });
  // Dawn hands over to its remain card; the others go back to the clock themselves.
  const fadeIn = fade({ from: 0, to: 1, duration: MOTION.base });
  return part === "dawn" ? seq(fadeIn, card) : seq(fadeIn, card, fade({ from: 1, to: 0, duration: 0.35 }));
}

/** "-N Days Remain-", or "-Final Hours-" on the last day. */
function remain(left: number): Clip {
  const text = left <= 1 ? "-Final Hours-" : `-${left} Days Remain-`;
  const f = fitFont(text, 70, ["normal", "small"]);
  const cap = f === "normal" ? 4 : 5;
  return seq(titleCard({ duration: 2.4, lines: [{ text, font: f, cap }] }), fade({ from: 1, to: 0, duration: 0.35 }));
}

/** Sections: dawn-1 .. dawn-20 and dawn-final, the same for meal and dusk, then remain-1 .. remain-20. */
export function cardParts(): [string, Clip][] {
  const parts: [string, Clip][] = [];
  for (const part of Object.keys(DAY_PARTS) as DayPart[]) {
    for (let d = 1; d <= MAX_DAYS; d++) parts.push([`${part}-${d}`, heading(part, d)]);
    parts.push([`${part}-final`, heading(part, "final")]);
  }
  for (let n = 1; n <= MAX_DAYS; n++) parts.push([`remain-${n}`, remain(n)]);
  return parts;
}
