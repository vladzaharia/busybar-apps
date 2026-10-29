// Front nag "Departure board": blinds close over the clock onto a split-flap board. Every flap clatters through its
// drum and stops, letter by letter, on FILE A / TICKET?; then the airline flap on the left turns through other
// "airlines" and lands on Jira. Blinds close over the board and open again onto the clock.

import {
  MARK_OPTICAL_CENTRE,
  MOTION,
  blinds,
  clip,
  closeWith,
  drawJiraMark,
  flapBoard,
  flapFaces,
  hex,
  jiraMarkIn,
  readTime,
  seq,
  span,
  type Clip,
  type Raster,
} from "@vladzaharia/bar-pixel";
import type { Nag } from "../../../src/presets.ts";
import { BLACK, JIRA_LIGHT } from "../look.ts";

/** The logo flap, a pixel in from the left edge; the letter tiles start past it and end a pixel in from the right. */
const LOGO = { x: 1, y: 0, size: 15 };
const X0 = 18;
const ROWS = [0, 8];
const COLS = 9;
const LINES = ["FILE A", "TICKET?"];
/** The Jira mark on its flap, placed by its optical centre (its weight sits up and to the right of its box). */
const MARK = jiraMarkIn({ x: 0, y: 0, width: LOGO.size, height: LOGO.size }, 12);
const LOGO_FLIP = 0.09;

/** The logo flap's faces: blank, then stand-in "airlines" (all centred on the flap), then Jira. */
const FACES: ((r: Raster) => void)[] = [
  () => {},
  (r) => r.shade((x, y) => (Math.hypot(x - 7, y - 7) < 4.6 ? hex("#E5493A") : null)),
  (r) => r.shade((x, y) => (x > 2 && x < 12 && y > 2 && y < 12 && (x + y) % 4 < 2 ? hex("#3DDC84") : null)),
  (r) => r.shade((x, y) => (y >= 3 && y <= 11 && Math.abs(x - 7) <= (y - 3) * 0.6 ? hex("#FF7A33") : null)),
  (r) => r.shade((x, y) => (Math.abs(Math.hypot(x - 7, y - 7) - 4) < 1 ? hex("#9F8FEF") : null)),
  (r) => r.shade((x, y) => (y >= 5 && y <= 9 && x >= 2 && x <= 12 && Math.abs(x - 7) + Math.abs(y - 7) * 2 < 7 ? hex("#62C7FF") : null)),
  (r) => drawJiraMark(r, MARK.x, MARK.y, 12),
];

export function board(_e: Nag): Clip {
  const letters = flapBoard({ lines: LINES, x: X0, rows: ROWS, cols: COLS });
  // Once the letters have stopped and been read, the logo flap turns, and lands on Jira.
  const LOGO_AT = letters.settled + readTime(LINES.join(" "));
  const LAND = LOGO_AT + (FACES.length - 1) * LOGO_FLIP;
  const BODY = LAND + MOTION.scene + MOTION.base;
  const logo = flapFaces({ ...LOGO, width: LOGO.size, height: LOGO.size, faces: FACES, at: LOGO_AT, flip: LOGO_FLIP, duration: BODY });
  const centre = MARK_OPTICAL_CENTRE[12];

  const body = clip(BODY, (r, t) => {
    r.fillRect(0, 0, r.width, r.height, BLACK);
    logo.draw(r, t);
    // A glow swells from the mark's weight as it lands, and fades.
    const land = span(t, LAND, LAND + 0.45);
    if (land > 0 && land < 1) r.glow(LOGO.x + MARK.x + centre.x, LOGO.y + MARK.y + centre.y, 11, 8, { ...JIRA_LIGHT, a: 0.75 * (1 - land) }, 2);
    letters.draw(r, t);
  });

  return seq(blinds({ mode: "cover" }), closeWith(body, blinds({ mode: "cover" })), blinds({ mode: "reveal" }));
}
