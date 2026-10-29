// What Pkmn Life can show, shared by the asset build (which renders every entry's animations) and the app (which
// lists them on the back). The people the redirects send to come from redirects.json (see the README), so no names
// live in the repository. Add a nag here, or a person there, and run `pnpm build`. Text is printable ASCII: the
// device fonts have nothing else.

import { PEOPLE } from "./generated/redirects.ts";

/** The styles a nag can be shown in. */
export const NAG_STYLES = ["encounter", "ticker", "board", "progress", "notfound", "squash", "buddy", "slots", "eightball", "invaders", "forecast"] as const;
export type NagStyle = (typeof NAG_STYLES)[number];

/** The styles a redirect can be shown in. */
export const REDIRECT_STYLES = ["runway", "nudge", "sign", "walker", "trainer", "scroller", "motorway", "exit", "parcel", "plane", "hand", "train", "dog", "shout", "map"] as const;
export type RedirectStyle = (typeof REDIRECT_STYLES)[number];

export type Style = NagStyle | RedirectStyle;

interface Base {
  /** A stable id, for the Mac remote and anything else that names entries ("ticket", "alex"). Lowercase. */
  id: string;
  /** Short, move-style name for the back-screen menu (small font, up to ~110 px). */
  move: string;
  /** The text box line on the back while the entry is highlighted. */
  message: string;
}

/** A nag: a message the front asks the room. */
export interface Nag extends Base {
  kind: "nag";
  /** Words the ticker highlights in blue (they must appear in the upper-cased message). */
  accent: string[];
}

/** A redirect: sends people to someone sitting to one side of the bar. */
export interface Redirect extends Base {
  kind: "redirect";
  /** The name the front shows, in capitals. */
  name: string;
  /** Where they sit, as someone facing the front display sees it: 1 to the right, -1 to the left. */
  dir: 1 | -1;
}

export type Entry = Nag | Redirect;

export const ENTRIES: Entry[] = [
  { kind: "nag", id: "ticket", move: "FILE A TICKET", message: "Did you file a JIRA ticket yet???", accent: ["JIRA"] },
  ...PEOPLE.map(({ id, name, dir }): Redirect => ({
    kind: "redirect",
    id,
    move: name,
    name,
    dir,
    message: `Send them ${dir > 0 ? "right" : "left"}, to ${name}.`,
  })),
];

/** The styles an entry can be shown in. */
export const stylesFor = (e: Entry): readonly Style[] => (e.kind === "nag" ? NAG_STYLES : REDIRECT_STYLES);

/**
 * The team's sprint cadence: Sprint 22 began on Thursday 22 October 2026, and sprints last two weeks. Every other
 * sprint is worked out from this. Exceptions (a moved or longer sprint, days off, a new cadence) go in the app's
 * "Sprint changes" setting, not here.
 */
export const SPRINTS = { number: 22, start: "2026-10-22", weeks: 2 };
