// Throwaway prototypes of new front styles, to see and choose from (concepts/build.ts renders them into a gallery).
// Nothing here ships: a chosen concept is rebuilt properly as a scene in assets/scenes, its reusable parts in
// packages/pixel.

import type { Clip } from "@vladzaharia/bar-pixel";

export interface Concept {
  /** Unique, kebab-case: "jira-departure-board". */
  id: string;
  /** Short title for the card: "Departure board". */
  name: string;
  /** One or two sentences: what plays, beat by beat. */
  about: string;
  /** What it reuses from bar-pixel and what is new art: "reuses roll, crt · new: checkbox sprite". */
  uses: string;
  /** The front animation, 72 × 16 at 60 fps, 3–8 s, opening from and closing to black (it plays over the clock). */
  clip: Clip;
}

/** The front display. */
export const W = 72;
export const H = 16;

/** The sample person a redirect concept sends people to: ALEX, to the right of the bar. Mirror for dir -1. */
export const PERSON = { name: "ALEX", dir: 1 as 1 | -1 };
