// Pointing hand: a big cartoon hand pokes in from the far side pointing their way, and the name drops in where it
// points, at the edge on their side, glinting. The hand pokes at it twice (the name hops at each poke), then a last
// big jab knocks the name off their way.
//
// The name is NAME_EDGE from their edge on its ink; the fingertip rests 4 px short of it, so a poke never touches it,
// and the cuff runs on off the far edge. A wide name leaves a shorter finger rather than a cropped hand.

import {
  MOTION,
  NAME_EDGE,
  Raster,
  HAND_SLEEVE,
  clip,
  drawPointingHand,
  fade,
  handWidth,
  hex,
  inCubic,
  inOutCubic,
  inQuad,
  lerp,
  mirrorX,
  outBack,
  outBounce,
  outQuad,
  seq,
  span,
  sparkles,
  wipe,
  type Clip,
} from "@vladzaharia/bar-pixel";
import type { Redirect } from "../../../src/presets.ts";
import { AMBER } from "../look.ts";
import { BIG_Y, BLACK, H, W, big, nameInk } from "./kit.ts";

/** How far a poke reaches, px; the fingertip rests this far plus 2 short of the name, so its ring stays clear. */
const POKE = 4;
/** The hand may start this far off the far edge (its cuff); any further and it shortens its finger instead. */
const CUFF_OFF = 3;

export function hand(e: Redirect): Clip {
  const IN = 0.5;
  const HOLD = 3.3;
  const OUT = 0.7;
  const total = IN + HOLD + OUT;
  const inkW = nameInk(e);
  // Rightward layout: the name at their edge, the hand pointing at it from the far side.
  const nameR = W - NAME_EDGE - inkW;
  // The fingertip (the hand's last column but one) rests POKE + 2 short of the name's ink.
  const tipGap = POKE + 2;
  let finger = 14;
  while (finger > 7 && nameR - tipGap - (handWidth(finger) - 2) < -CUFF_OFF) finger--;
  const hw = handWidth(finger);
  const restX = Math.min(0, nameR - tipGap - (hw - 2));
  const POKES = [0.45, 1.35, 2.25];
  const poke = (t: number) => {
    let d = 0;
    for (const p of POKES) {
      const k = t - IN - p;
      if (k >= 0 && k < 0.1) d = Math.max(d, POKE * outQuad(k / 0.1));
      else if (k >= 0.1 && k < 0.45) d = Math.max(d, POKE * (1 - inOutCubic((k - 0.1) / 0.35)));
    }
    return d;
  };
  const nameX = mirrorX(nameR, inkW, e.dir);
  // Glints round the name, never on it: kept off its ink and a pixel round it, the row it hops into included.
  const shine = sparkles({
    duration: total,
    count: 10,
    seed: 9,
    color: hex("#FFE7A6"),
    box: { x: mirrorX(nameR - 3, inkW + 6, e.dir), y: 0, width: inkW + 6, height: H },
    avoid: { x: nameX - 1, y: 1, width: inkW + 2, height: 13 },
  });
  const scene = clip(total, (r, t) => {
    r.fillRect(0, 0, W, H, BLACK);
    const outT = t - IN - HOLD;
    // In: from off-screen with a bounce. Out: a wind-up, a big jab, then away.
    let hx = restX;
    if (t < IN) hx = lerp(-hw - 2, restX, outBack(t / IN, 1.6));
    else if (outT < 0) hx = restX + poke(t);
    else if (outT < 0.18) hx = restX - 3 * outQuad(outT / 0.18);
    else if (outT < 0.3) hx = restX - 3 + 13 * outQuad((outT - 0.18) / 0.12);
    else hx = restX + 10 - (hw + 12) * inCubic(span(outT, 0.3, OUT));
    // The name lands as the hand arrives, hops at each poke, and is knocked away their way by the last jab.
    const land = span(t, IN * 0.6, IN * 0.6 + 0.35);
    let nx = nameR;
    let alpha = 1;
    if (outT >= 0.27) {
      const k = span(outT, 0.27, OUT);
      nx = nameR + (W - nameR + 4) * inQuad(k);
      alpha = 1 - span(k, 0.7, 1);
    }
    if (land > 0) {
      const s = new Raster(W, H);
      shine.draw(s, t);
      r.draw(s, 0, 0, Math.min(land, alpha));
      const hop = poke(t) >= POKE - 0.5 ? -1 : 0;
      r.text(e.name, big(), mirrorX(Math.round(nx), inkW, e.dir), BIG_Y + Math.round(lerp(-9, 0, outBounce(land))) + hop, AMBER, () => ({ alpha }));
    }
    const x = Math.round(hx);
    drawPointingHand(r, mirrorX(x, hw, e.dir), 0, e.dir, { finger });
    // The cuff runs on off the edge of the screen.
    if (x > 0) r.fillRect(e.dir > 0 ? 0 : W - x, 4, x, 9, HAND_SLEEVE);
  });
  return seq(fade({ from: 0, to: 1, duration: MOTION.base }), scene, wipe({ mode: "reveal", direction: e.dir, color: BLACK, edge: AMBER, duration: MOTION.base }));
}
