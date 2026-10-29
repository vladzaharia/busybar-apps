// What every nag shares, so the eleven of them read as one set: one lettering white, one emphasis for "?" (amber, on
// one pulse), soft fills instead of white, and how a scene closes over its last frame.

import { hex, holdEnd, layer, mix, type Clip, type Color } from "@vladzaharia/bar-pixel";

/** Lettering on a dark ground. */
export const WHITE = hex("#FFFFFF");
/** The emphasis: a "?" asking the room, and the punchline. */
export const AMBER = hex("#FFB020");
/** A card or a sprite's light parts: soft, never white (a block of white LEDs glares). Boxes behind text are darker
 *  still: the dialogue box's fill, #9DA9BC. */
export const SOFT = hex("#CFD8E6");

export const BLACK = hex("#000000");
export const JIRA = hex("#1D7AFC");
export const JIRA_MID = hex("#579DFF");
export const JIRA_LIGHT = hex("#85B8FF");

/** How lit a "?" is at time `t`: one sine pulse, about twice a second, the same in every nag. */
const askPulse = (t: number) => 0.5 + 0.5 * Math.sin(t * 12);

/** A "?" at time `t`: pulsing from the lettering's own colour to amber and back. */
export const ask = (base: Color, t: number): Color => mix(base, AMBER, askPulse(t));

/** Per-letter colour for a line in `base`: its "?" pulse (`ask`), every other letter is `base`. */
export const asking =
  (base: Color) =>
  (_i: number, ch: string, t: number): Color =>
    ch === "?" ? ask(base, t) : base;

/** `body`, then `cover` played over its last frame: how a scene closes behind a transition instead of cutting. */
export function closeWith(body: Clip, cover: Clip): Clip {
  return layer(holdEnd(body, cover.duration), { clip: cover, at: body.duration });
}
