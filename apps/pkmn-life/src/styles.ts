// What the back menu decides about styles, apart from drawing and playing (main.ts does those): the header's labels,
// how OK and "alternate" step through them, when "alternate" moves on, and which style a remote request plays. Pure,
// so test/menu.test.ts can check them, and it imports nothing from the bar.

import { NAG_STYLES, REDIRECT_STYLES, stylesFor, type Entry, type NagStyle, type RedirectStyle, type Style } from "./presets.ts";

/** What a nag's style can be set to: one style, "alternate" (each in turn) or "random". */
export type NagMode = "alternate" | "random" | NagStyle;
/** What a redirect's style can be set to: one style, or "random". */
export type RedirectMode = "random" | RedirectStyle;

/** The modes OK on the back cycles through, and the values the `nag_style` setting accepts (see settings.json). */
export const NAG_MODES: readonly NagMode[] = ["alternate", "random", ...NAG_STYLES];
export const REDIRECT_MODES: readonly RedirectMode[] = ["random", ...REDIRECT_STYLES];

/** The width of the back header's style label, px: its box runs from x 56 to 127 of the 148 px back. */
export const HEADER_WIDTH = 72;

/**
 * The header's names for the styles, in capitals. A nag's must fit the HEADER_WIDTH px header after "ALT: " and a
 * redirect's on its own, in the small font (test/menu.test.ts checks every one).
 */
export const STYLE_NAMES: Record<Style, string> = {
  encounter: "ENCOUNTER",
  ticker: "TICKER",
  board: "BOARD",
  progress: "PROGRESS",
  notfound: "404",
  squash: "SQUASH",
  buddy: "BUDDY",
  slots: "SLOTS",
  eightball: "8-BALL",
  invaders: "INVADERS",
  forecast: "FORECAST",
  runway: "RUNWAY",
  nudge: "NUDGE",
  sign: "SIGN",
  walker: "WALKER",
  trainer: "TRAINER",
  scroller: "SCROLLER",
  motorway: "MOTORWAY",
  exit: "EXIT",
  parcel: "PARCEL",
  plane: "PLANE",
  hand: "HAND",
  train: "TRAIN",
  dog: "GROWLITHE",
  shout: "SHOUT",
  map: "MAP",
};

/** The nag "alternate" plays after `style`: the next of NAG_STYLES, and the first again after the last. */
export function nextInTurn(style: NagStyle): NagStyle {
  return NAG_STYLES[(NAG_STYLES.indexOf(style) + 1) % NAG_STYLES.length]!;
}

/**
 * Where "alternate" stands after a play to the end: `due` is the nag it announced ("ALT: BOARD"), `played` the style
 * that played and `mode` the nag mode it was started in. It moves on only when the announced nag played in that mode;
 * a remote request for another style, or a switch to "alternate" while something else played, leaves it due.
 */
export function turnAfter(due: NagStyle, played: Style, mode: NagMode): NagStyle {
  return mode === "alternate" && played === due ? nextInTurn(due) : due;
}

/** The mode after `mode` in `modes`, wrapping; a mode that isn't in the list (an old saved value) goes to the first. */
export function nextMode<T extends string>(mode: T, modes: readonly T[]): T {
  return modes[(modes.indexOf(mode) + 1) % modes.length]!;
}

/**
 * The style a remote request plays: the one it names if `entry` has it, else whatever `fallback` draws (the Mac's
 * "default", a style the bar doesn't know, a redirect's style asked of the ticket). `fallback` is a function so it is
 * only drawn when needed: drawing from a random bag moves the bag on.
 */
export function requestedStyle(entry: Entry, word: string | undefined, fallback: () => Style): Style {
  const styles: readonly string[] = stylesFor(entry);
  return word !== undefined && styles.includes(word) ? (word as Style) : fallback();
}
