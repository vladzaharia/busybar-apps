// EXIT sign: the clock fades and a lit green EXIT sign flickers on like a fluorescent tube: on their side the person
// themselves, sat at their desk with a monitor on it, chevrons pulsing their way, and the ISO figure, a visitor. As the
// tubes come up the visitor walks a few steps over to the desk and stops beside it; then the name's tube stutters on.
// The sign holds, and stutters off.
//
// Laid out from their edge inwards, for someone on the right, and mirrored for the left: the chevrons, the desk (the
// person looking across it at the visitor), where the visitor stops, then the name centred in what is left. A wide name
// takes the second chevron, then the smaller chevron and the gaps beside it, and lastly brings the visitor in front of
// the desk's near end. There is always a chevron. The visitor's first steps may cross where a long name will be: its
// tube is not lit until the visitor has arrived.

import {
  DESK_SIZE,
  EXIT_SIGN,
  MOTION,
  PICTO_SIZE,
  PICTO_STAND_INK,
  Raster,
  chase,
  chevronWidth,
  clip,
  drawChevron,
  drawExitPanel,
  drawPersonAtDesk,
  drawPictogram,
  exitFlickerOff,
  exitFlickerOn,
  exitInk,
  fade,
  lerp,
  mirrorX,
  mix,
  pictoStep,
  readTime,
  seq,
  span,
  type Clip,
  type PictoPose,
} from "@vladzaharia/bar-pixel";
import type { Redirect } from "../../../src/presets.ts";
import { BIG_Y, BLACK, H, W, big, nameInk } from "./kit.ts";

/** The first column a name may ink: one clear of the sign's rim (column 0). */
const NAME_MIN = 2;
/** How far the visitor walks: a few steps. */
const WALK_PX = 12;
/** Walking pace, px/s, and a step every STEP s. */
const SPEED = 10;
const STEP = 0.22;
/** At most this many columns of the desk's near end may stand behind the visitor (its monitor starts 5 in). */
const MAX_OVERLAP = 5;

/** The chevrons, roomiest first: how many, how tall, the clear column before the rim, and the gap before the desk. */
const CHEVRONS = [
  { n: 2, h: 9, margin: 1, gap: 2 },
  { n: 1, h: 9, margin: 1, gap: 2 },
  { n: 1, h: 7, margin: 1, gap: 1 },
  { n: 1, h: 7, margin: 0, gap: 0 },
] as const;

/** The sign's layout for a name `inkW` wide, in the rightward layout. */
function layout(inkW: number) {
  const nameEnd = NAME_MIN + inkW - 1;
  const fit = CHEVRONS.map((c) => {
    const chevW = chevronWidth(c.h) + (c.n - 1) * 5;
    const chevX = W - 1 - c.margin - chevW;
    const deskX = chevX - c.gap - DESK_SIZE.width;
    // The visitor stops beside the desk's near end, a column clear of it; a wide name brings them in front of it.
    const besideX = deskX - 2 - PICTO_STAND_INK.x1;
    const stopX = Math.max(besideX, nameEnd + 2 - PICTO_STAND_INK.x0);
    return { ...c, chevW, chevX, deskX, stopX, overlap: stopX - besideX };
  });
  const l = fit.find((f) => f.overlap <= 0) ?? fit.find((f) => f.overlap <= MAX_OVERLAP) ?? fit[fit.length - 1]!;
  // The name is centred on its ink in the room left of where the visitor stops, a column clear of it.
  const roomEnd = l.stopX + PICTO_STAND_INK.x0 - 2;
  const nameX = NAME_MIN + Math.max(0, Math.round((roomEnd - NAME_MIN + 1 - inkW) / 2));
  return { ...l, nameX, startX: l.stopX - WALK_PX };
}

export function exit(e: Redirect): Clip {
  const FLICK = 0.7;
  const NAME_FLICK = 0.45;
  const WALK = WALK_PX / SPEED;
  const HOLD = NAME_FLICK + readTime(e.name) + 1.4;
  const OFF = 0.45;
  // The visitor sets off as the tubes come up; the name's tube comes on once it has arrived.
  const tWalk = FLICK * 0.5;
  const tArrive = tWalk + WALK;
  const total = tArrive + HOLD;
  const f = big();
  const inkW = nameInk(e);
  const l = layout(inkW);
  const nameX = mirrorX(l.nameX, inkW, e.dir);
  const deskX = mirrorX(l.deskX, DESK_SIZE.width, e.dir);
  const chevX = mirrorX(l.chevX, l.chevW, e.dir);
  const chevY = Math.round((H - l.h) / 2);
  /** The visitor's box x on the screen at time `t`, and its pose. */
  const visitor = (t: number): { x: number; pose: PictoPose } => {
    const walking = t >= tWalk && t < tArrive;
    const xr = Math.round(lerp(l.startX, l.stopX, span(t, tWalk, tArrive)));
    return { x: mirrorX(xr, PICTO_SIZE.width, e.dir), pose: walking ? pictoStep(t - tWalk, STEP) : "stand" };
  };
  const drawSign = (r: Raster, t: number, light: number) => {
    if (light <= 0) return;
    drawExitPanel(r, light, t);
    // The name's tube glows faintly until it comes on.
    const own = t < tArrive ? 0.12 : exitFlickerOn(Math.min(t - tArrive, NAME_FLICK), NAME_FLICK);
    r.text(e.name, f, nameX, BIG_Y, exitInk(light * own));
    // The pictograms stay inside the rim, their knock-out rings included.
    r.clip = { x0: 0, y0: 1, x1: W, y1: H - 1 };
    drawPersonAtDesk(r, deskX, 3, e.dir > 0 ? -1 : 1, { ink: exitInk(light), dim: exitInk(0.55 * light), screen: exitInk(light, EXIT_SIGN.screen) });
    const v = visitor(t);
    drawPictogram(r, v.x, 2, e.dir, v.pose, { ink: exitInk(light), halo: mix(EXIT_SIGN.deep, EXIT_SIGN.lit, 0.92 * light) });
    r.clip = null;
    // Chevrons pulsing their way; at rest they stay light enough to see on the green.
    for (let k = 0; k < l.n; k++) {
      const b = chase(t, k, { period: 0.8, step: 0.18, decay: 0.25, floor: 0.55 });
      drawChevron(r, chevX + (e.dir > 0 ? k : l.n - 1 - k) * 5, chevY, l.h, e.dir, exitInk(light * b));
    }
  };
  return seq(
    fade({ from: 0, to: 1, duration: MOTION.base }),
    clip(total, (r, t) => {
      r.fillRect(0, 0, W, H, BLACK);
      drawSign(r, t, t < FLICK ? exitFlickerOn(t, FLICK) : 1);
    }),
    clip(OFF, (r, t) => {
      r.fillRect(0, 0, W, H, BLACK);
      drawSign(r, total + t, exitFlickerOff(t, OFF));
    }),
    fade({ from: 1, to: 0, duration: MOTION.base }),
  );
}
