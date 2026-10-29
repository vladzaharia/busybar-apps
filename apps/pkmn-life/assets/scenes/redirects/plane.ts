// Paper plane: a paper plane flies in from the far side and loops the loop, its contrail drawing the circle, then
// glides their way unfurling the name behind it on an amber banner. It tows the banner into place and holds there,
// bobbing, the banner and the name still while they are read, then pulls the banner, name and all, off-screen their
// way.
//
// The banner is the name's ink with room for its swallow-tail and its pole; the banner, the rope and the plane are
// centred together, so DAMIAN's plane keeps its nose 2 px off the edge.

import {
  MOTION,
  PLANE_REACH,
  clip,
  drawBanner,
  drawLine,
  drawPaperPlane,
  fade,
  hex,
  inOutCubic,
  lerp,
  mirrorX,
  seq,
  span,
  wipe,
  type Clip,
} from "@vladzaharia/bar-pixel";
import type { Redirect } from "../../../src/presets.ts";
import { AMBER } from "../look.ts";
import { BIG_Y, BLACK, W, big, letterSpans, nameInk } from "./kit.ts";

const CONTRAIL = hex("#9CC6FF");
const INK = hex("#2A1700");
const ROPE = hex("#8A94A6");

/** Cubic Hermite from 0 to 1 with start slope m0 and end slope m1 (to join a move onto the one before it). */
function hermite(u: number, m0: number, m1: number): number {
  const u2 = u * u;
  const u3 = u2 * u;
  return (u3 - 2 * u2 + u) * m0 + (-2 * u3 + 3 * u2) + (u3 - u2) * m1;
}

export function plane(e: Redirect): Clip {
  const R = 4.5;
  const CX = 12;
  const CY = 8;
  const APPROACH = 0.75;
  const LOOP = 0.95;
  const UNFURL = 1.4;
  const HOLD = 2.1;
  const EXIT = 0.8;
  const tL = APPROACH;
  const tU = tL + LOOP;
  const tH = tU + UNFURL;
  const tE = tH + HOLD;
  const total = tE + EXIT;
  const v = (R * 2 * Math.PI) / LOOP;
  const inkW = nameInk(e);
  // Rightward layout: the banner (the tail's notch, 4 px to the name, the name, 2 px, the pole), TOW px of rope to the
  // plane's middle, and its nose; all of it centred.
  const BW = inkW + 7;
  const TOW = 10;
  const TOP = 1;
  const BH = 14;
  const CRUISE = 7.5;
  const LEFT = Math.max(1, Math.round((W - (BW + TOW + PLANE_REACH.nose + 0.5)) / 2));
  const xRest = LEFT + BW + TOW;
  const D = xRest - CX;
  const pos = (t: number): [number, number] => {
    if (t < tL) return [CX - v * (tL - t), CY + R];
    if (t < tU) {
      const th = (2 * Math.PI * (t - tL)) / LOOP;
      return [CX + R * Math.sin(th), CY + R * Math.cos(th)];
    }
    // Out of the loop into a glide that comes to rest at xRest (no creeping on once there).
    if (t < tH) {
      const u = (t - tU) / UNFURL;
      return [CX + D * hermite(u, (v * UNFURL) / D, 0), lerp(CY + R, CRUISE, inOutCubic(span(u, 0, 0.7)))];
    }
    if (t < tE) return [xRest, CRUISE + Math.sin((t - tH) * 4) * 0.6];
    const p = (t - tE) / EXIT;
    return [xRest + 150 * Math.pow(p, 2.2), CRUISE + Math.sin(HOLD * 4) * 0.6 * (1 - p) - 2 * p];
  };
  const heading = (t: number) => {
    if (t >= tL && t < tU) return (-2 * Math.PI * (t - tL)) / LOOP;
    if (t >= tH && t < tE) return 0.16 * Math.cos((t - tH) * 4);
    const [x0, y0] = pos(t - 0.02);
    const [x1, y1] = pos(t + 0.02);
    return Math.max(-0.35, Math.min(0.35, Math.atan2(y1 - y0, x1 - x0)));
  };
  /** A point's x in the rightward layout, on the screen. */
  const sx = (x: number) => (e.dir > 0 ? x : W - x);

  const scene = clip(total, (r, t) => {
    r.fillRect(0, 0, W, 16, BLACK);
    // The contrail: the loop's path, fading behind the plane.
    for (let age = 1 / 60; age < 0.7; age += 1 / 60) {
      const ts = t - age;
      if (ts < tL - 0.15 || ts > tU + 0.1) continue;
      const [x, y] = pos(ts);
      const a = heading(ts);
      r.blend(sx(x - 4.5 * Math.cos(a)), y - 4.5 * Math.sin(a), CONTRAIL, 0.55 * (1 - age / 0.7), "add");
    }
    const [x, y] = pos(t);
    const a = heading(t);
    if (t >= tU) {
      const right = x - TOW;
      const left = Math.max(LEFT, right - BW);
      // The rope, from the plane's tail to the middle of the banner's leading edge.
      drawLine(r, sx(x - 4.5 * Math.cos(a)), y - 4.5 * Math.sin(a), sx(right), TOP + BH / 2, ROPE);
      drawBanner(r, { left, right, top: TOP, height: BH, dir: e.dir, t });
      // The name is lettered on the cloth, 4 px from its tail: still while the banner unrolls (its tail stays at LEFT)
      // and holds, and pulled off with it at the end. It shows letter by letter as the banner unrolls under it (worked
      // out on the screen, so it holds both ways round).
      const nameX = mirrorX(Math.floor(left) + 4, inkW, e.dir);
      const letters = letterSpans(e.name, big(), nameX);
      const [open0, open1] = e.dir > 0 ? [left, right - 1] : [W - right + 1, W - left];
      r.text(e.name, big(), nameX, BIG_Y, INK, (i) => {
        const s = letters[i]!;
        return { hidden: s.x < open0 || s.x + s.advance > open1 };
      });
    }
    drawPaperPlane(r, sx(x), y, a, e.dir);
  });
  return seq(fade({ from: 0, to: 1, duration: MOTION.base }), scene, wipe({ mode: "reveal", direction: e.dir, color: BLACK, edge: AMBER, duration: MOTION.base }));
}
