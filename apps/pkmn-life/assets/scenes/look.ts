// What every nag shares, so the eleven of them read as one set: one lettering white, one emphasis for "?" (amber, on
// one pulse; a deeper amber in dark lettering on a light box), and soft fills instead of white. (A scene closes over
// its last frame with bar-pixel's closeWith.)

import { hex, mix, type Color } from "@vladzaharia/bar-pixel";

/** Lettering on a dark ground. */
export const WHITE = hex("#FFFFFF");
/** The emphasis: a "?" asking the room, and the punchline. */
export const AMBER = hex("#FFB020");
/** The emphasis in dark lettering on a light box (the dialogue box, a speech bubble): AMBER would wash into the box. */
export const AMBER_DEEP = hex("#B86E00");
/** A card or a sprite's light parts: soft, never white (a block of white LEDs glares). Boxes behind text are darker
 *  still: the dialogue box's fill, #9DA9BC. */
export const SOFT = hex("#CFD8E6");

export const BLACK = hex("#000000");
export const JIRA = hex("#1D7AFC");
export const JIRA_MID = hex("#579DFF");
export const JIRA_LIGHT = hex("#85B8FF");

/** How lit a "?" is at time `t`: one sine pulse, about twice a second, the same in every nag. */
const askPulse = (t: number) => 0.5 + 0.5 * Math.sin(t * 12);

/** Lettering darker than this (Rec. 709 luma, 0..1) is ink on a light box. */
const isInk = (c: Color) => 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b < 0.5;

/**
 * A "?" at time `t`: pulsing from the lettering's own colour to amber and back. Dark ink on a light box pulses to
 * AMBER_DEEP instead, so at its peak the "?" still stands out from the box.
 */
export const ask = (base: Color, t: number): Color => mix(base, isInk(base) ? AMBER_DEEP : AMBER, askPulse(t));

/** Per-letter colour for a line in `base`: its "?" pulse (`ask`), every other letter is `base`. */
export const asking =
  (base: Color) =>
  (_i: number, ch: string, t: number): Color =>
    ch === "?" ? ask(base, t) : base;
