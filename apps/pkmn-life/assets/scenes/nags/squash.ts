// Front nag "Bug squash": the clock dims out, a bug scuttles in and stops, nervous. A Jira ticket drops from above and
// flattens it (the screen shakes, dust puffs, its legs twitch), then NO TICKET, / NO FIX. drops in beside it. An iris
// closes on the ticket and opens again onto the clock.

import {
  BUG_SIZE,
  MOTION,
  Raster,
  TICKET_SIZE,
  bugFrame,
  capTop,
  clip,
  drawBug,
  drawJiraTicket,
  dropIn,
  fade,
  font,
  hex,
  inQuad,
  inkWidth,
  iris,
  layer,
  lerp,
  outCubic,
  readTime,
  seq,
  shake,
  span,
  squash as squashed,
  type Clip,
} from "@vladzaharia/bar-pixel";
import type { Nag } from "../../../src/presets.ts";
import { AMBER, BLACK, WHITE, closeWith } from "../look.ts";

const W = 72;
const H = 16;
/** The floor is the bottom edge. */
const FLOOR = H;
const BUG_Y = FLOOR - BUG_SIZE.height;
/** Where the bug stops, and the ticket centred over it. */
const STOP = 8;
const TX = STOP + Math.round(BUG_SIZE.width / 2) - Math.round(TICKET_SIZE.width / 2);
/** Squashed, the bug is 3 rows high and the ticket rests on it. */
const FLAT = 3;
const REST_Y = FLOOR - FLAT - TICKET_SIZE.height;
const LINES = ["NO TICKET,", "NO FIX."];
/** The two lines share a left edge, the group centred on its ink in the room right of the ticket. */
const ROOM = TX + TICKET_SIZE.width + 3;
const TEXT_X = ROOM + Math.round((W - ROOM - Math.max(...LINES.map((l) => inkWidth(l, font("small"))))) / 2);

export function squash(_e: Nag): Clip {
  const WALK = 1.3;
  const LOOK = 0.55;
  const FALL = 0.32;
  const HIT = WALK + LOOK + FALL;
  const TEXT_AT = HIT + 0.45;
  const LINE_GAP = 0.45;
  // Both lines are down by TEXT_AT + LINE_GAP + 0.4; then they hold to be read.
  const D = TEXT_AT + LINE_GAP + 0.4 + readTime(LINES.join(" ")) + MOTION.rest;

  let legs: 0 | 1 = 0;
  // The squash modifier squashes onto its raster's middle row; drawn on a raster twice the floor's height, that row
  // is the floor. Its clip runs 1 s and squashes over all of it, so time cbrt(1 - k) leaves the bug k of its height.
  const flat = squashed(clip(1, (r) => drawBug(r, STOP, BUG_Y, { frame: legs })), { time: 1 });
  const tall = new Raster(W, FLOOR * 2);
  // The words drop in too, the second line once the first has landed; each line falls only within its own band, so
  // the second never passes through the first.
  const words = LINES.map((text, li) => ({
    at: TEXT_AT + li * LINE_GAP,
    band: li ? { y0: 8, y1: H } : { y0: 0, y1: 8 },
    clip: dropIn({
      text,
      font: "small",
      x: TEXT_X,
      y: capTop("small", li ? 9 : 2),
      duration: D - TEXT_AT - li * LINE_GAP,
      stagger: 0.03,
      color: () => (li ? AMBER : WHITE),
    }),
  }));

  const scene = clip(D, (r, t) => {
    const ty = t < WALK + LOOK ? -TICKET_SIZE.height - 2 : lerp(-TICKET_SIZE.height - 2, REST_Y, inQuad(span(t, WALK + LOOK, HIT)));
    const k = Math.max(FLAT / BUG_SIZE.height, Math.min(1, (FLOOR - (ty + TICKET_SIZE.height)) / BUG_SIZE.height));
    // The bug scuttles in from the right, stops, and looks around (a nervous hop) before the ticket lands.
    const x = lerp(W + 2, STOP, outCubic(span(t, 0, WALK)));
    const hop = t > WALK && t < WALK + LOOK ? -Math.round(Math.abs(Math.sin(span(t, WALK, WALK + LOOK) * Math.PI * 2))) : 0;
    legs = t < WALK ? bugFrame(t) : t > HIT && t < HIT + 0.7 ? bugFrame(t * 1.5) : 0;
    if (k >= 1) drawBug(r, x, BUG_Y + hop, { frame: legs });
    else {
      tall.clear();
      flat.draw(tall, Math.cbrt(1 - k));
      r.draw(tall, 0, 0);
    }
    if (t > WALK + 0.1 && t < WALK + LOOK) r.text("!", font("tiny"), STOP + 5, capTop("tiny", 0), AMBER);
    drawJiraTicket(r, TX, ty, { sheen: span(t, HIT + 0.5, HIT + 0.5 + MOTION.slow) });
    // Dust puffs out from under it.
    const dust = span(t, HIT, HIT + 0.5);
    if (dust > 0 && dust < 1) {
      for (const side of [-1, 1]) {
        for (let j = 0; j < 4; j++) {
          const reach = outCubic(dust) * (3 + j * 2.5);
          const px = (side < 0 ? TX : TX + TICKET_SIZE.width - 1) + side * (1 + reach);
          const py = FLOOR - 1 - Math.round(outCubic(dust) * (j % 2 ? 2 : 1) * (1 + j * 0.5));
          r.fillRect(Math.round(px), py, j < 2 ? 2 : 1, 1, { ...hex("#9AA7BA"), a: 1 - dust });
        }
      }
    }
    for (const w of words) {
      if (t < w.at) continue;
      r.clip = { x0: 0, x1: W, ...w.band };
      w.clip.draw(r, t - w.at);
      r.clip = null;
    }
  });
  const body = layer(clip(D, (r) => r.fillRect(0, 0, W, H, BLACK)), shake(scene, { from: HIT, to: HIT + 0.35, amplitude: 2, vertical: true }));
  const centre = { x: TX + TICKET_SIZE.width / 2, y: REST_Y + TICKET_SIZE.height / 2 };

  return seq(fade({ duration: MOTION.base, from: 0, to: 1 }), closeWith(body, iris({ mode: "cover", ...centre })), iris({ mode: "reveal", ...centre }));
}
