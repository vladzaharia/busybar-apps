// Front nag "Ticket buddy": blinds close over the clock, and the Jira ticket, with a face, hops in from the left and
// lands with a squash. It asks "FILE ME?" in a speech bubble, blinks, then "PLEASE?" with big eyes, and does a happy
// double hop before the picture squashes away and the clock switches back on.

import {
  BUBBLE_LIGHT,
  MOTION,
  TICKET_SIZE,
  blinds,
  clip,
  crt,
  drawStretched,
  hex,
  hopPose,
  layer,
  lerp,
  readTime,
  seq,
  speechBubble,
  squash,
  ticketFace,
  type Clip,
  type TicketEyes,
  type TicketMouth,
} from "@vladzaharia/bar-pixel";
import type { Nag } from "../../../src/presets.ts";
import { BLACK, asking } from "../look.ts";

const W = 72;
const H = 16;
/** The ticket's centre: it hops in from off the left edge to here. */
const FROM = -14;
const TO = 17;
const GROUND = 15;
/** The bubbles: their tails by the ticket's right edge, a row clear of the top. */
const BUBBLE = { x: 31, top: 1, dir: 1 as const };

export function buddy(_e: Nag): Clip {
  const AIR = 0.28;
  const LAND = 0.12;
  const HOPS = 3;
  const IN = 0.15;
  const ARRIVE = IN + HOPS * (AIR + LAND);
  const ASK = ARRIVE + 0.3;
  // Its "?" pulses like every nag's, in the deeper amber that stands out on the bubble.
  const color = asking(BUBBLE_LIGHT.ink);
  const ask = speechBubble({ ...BUBBLE, text: "FILE ME?", hold: readTime("FILE ME?") + 0.8, color });
  const PLEASE = ASK + ask.duration + 0.3;
  const please = speechBubble({ ...BUBBLE, text: "PLEASE?", hold: readTime("PLEASE?") + 0.4, color });
  const HAPPY = PLEASE + please.duration + 0.05;
  const END = HAPPY + 0.75;
  const OUT = MOTION.quick;
  const blinks = [ARRIVE + 0.1, ASK + 1.0, ASK + 1.25];
  // Low hops, so all of it stays on the screen: squash and stretch carry the bounce.
  const hops = [
    ...Array.from({ length: HOPS }, (_, k) => ({ at: IN + k * (AIR + LAND), air: AIR, height: 2, land: LAND })),
    { at: PLEASE + 0.05, air: 0.22, height: 2 },
    { at: HAPPY, air: 0.24, height: 2 },
    { at: HAPPY + 0.36, air: 0.24, height: 2 },
  ];

  const content = clip(END + OUT, (r, t) => {
    if (t < IN) return;
    const pose = hopPose(t, hops);
    // It moves forward only in the air: hop k carries it from k/HOPS to (k+1)/HOPS of the way.
    const hop = Math.floor((t - IN) / (AIR + LAND));
    const air = Math.min(1, (t - IN - hop * (AIR + LAND)) / AIR);
    const cx = t < ARRIVE ? lerp(FROM, TO, (hop + air) / HOPS) : TO;
    const talking = (at: number, d: number) => t > at + 0.2 && t < at + d && Math.floor((t - at) / 0.13) % 2 === 0;
    const blink = blinks.some((b) => t >= b && t < b + 0.1);
    const eyes: TicketEyes = t >= HAPPY ? "happy" : blink ? "shut" : t >= PLEASE ? "big" : "open";
    const mouth: TicketMouth = talking(ASK, 0.9) || talking(PLEASE, 0.75) ? "open" : "smile";
    // A soft shadow on the ground, shrinking as it leaves the ground.
    const sw = Math.round(18 * pose.sx * (1 - pose.lift / 9));
    r.fillRect(Math.round(cx - sw / 2), GROUND, sw, 1, hex("#2A3A56"));
    // Stretched tall in the air, but never past the top row: at the top of a hop the stretch gives way first.
    const bottom = GROUND - Math.round(pose.lift);
    drawStretched(r, ticketFace({ eyes, mouth }), cx, bottom, pose.sx, Math.min(pose.sy, bottom / TICKET_SIZE.height));
    if (t >= ASK && t < ASK + ask.duration) ask.draw(r, t - ASK);
    if (t >= PLEASE && t < PLEASE + please.duration) please.draw(r, t - PLEASE);
  });

  const body = layer(clip(content.duration, (r) => r.fillRect(0, 0, W, H, BLACK)), squash(content, { time: OUT }));
  return seq(blinds({ mode: "cover" }), body, crt({ mode: "reveal", duration: MOTION.base }));
}
