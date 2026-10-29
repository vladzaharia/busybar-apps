// Parcel tracking: "Out for delivery" types in over a tracking line that fills to the third stop, their house waiting
// at the last, on their side. A brown delivery van with the name on its cargo box drives in from the far side, shoving
// the tracker off ahead of it, parks with its indicator blinking, and pulls off towards them.
//
// The van is built round the name: the cargo box is the name's ink with 4 px of box either side, and caps on rows
// 3..12 leave a row of box above and below. DAMIAN's van is 65 px long.

import {
  MOTION,
  Raster,
  clip,
  drawVan,
  fade,
  font,
  hex,
  inBack,
  inkWidth,
  lerp,
  mirrorX,
  outCubic,
  readTime,
  seq,
  span,
  stampPalette,
  typewriter,
  vanWidth,
  type Clip,
} from "@vladzaharia/bar-pixel";
import type { Redirect } from "../../../src/presets.ts";
import { AMBER } from "../look.ts";
import { BIG_Y, BLACK, H, W, big, nameInk } from "./kit.ts";

/** A house, 5 x 5, with a door. */
const HOUSE = ["..#..", ".###.", "#####", ".#d#.", ".#d#."];
const LABEL = "Out for delivery";
const GREY = hex("#3A3F48");
const PUFF = hex("#8A93A3");

export function parcel(e: Redirect): Clip {
  const small = font("small");
  const typing = LABEL.length / MOTION.typeSpeed;
  const TRACK = typing + readTime(LABEL);
  const DRIVE_IN = 0.9;
  const PARK = 2.6;
  const DRIVE_OFF = 0.8;
  const inkW = nameInk(e);
  const cargo = inkW + 8;
  const vanW = vanWidth(cargo);
  const parkX = mirrorX(Math.round((W - vanW) / 2), vanW, e.dir);
  const labelX = Math.round((W - inkWidth(LABEL, small)) / 2);

  const tracking = clip(TRACK, (r, t) => {
    r.fillRect(0, 0, W, H, BLACK);
    typewriter({ lines: [LABEL], font: "small", x: labelX, ys: [0], duration: TRACK }).draw(r, t);
    // Four stops; the line fills their way to the third, out for delivery, which then pulses. The last is their house.
    const stops = [8, 26, 44, 62].map((x) => mirrorX(x, 3, e.dir));
    const fill = outCubic(span(t, 0.2, 1.2)) * (2 / 3);
    const x0 = Math.min(stops[0]!, stops[3]!) + 1;
    const len = Math.abs(stops[3]! - stops[0]!);
    r.fillRect(x0, 11, len + 1, 1, GREY);
    const fw = Math.round(len * fill);
    r.fillRect(e.dir > 0 ? x0 : x0 + len - fw, 11, fw + 1, 1, AMBER);
    stops.forEach((sx, i) => {
      if (i === 3) return stampPalette(r, HOUSE, sx - 1, 8, { "#": hex("#8A93A3"), d: BLACK });
      const reached = fill * 3 >= i - 0.01;
      r.fillRect(sx, 10, 3, 3, reached ? AMBER : GREY);
      if (i === 2 && reached) r.glow(sx + 1.5, 11.5, 3, 3, { ...AMBER, a: 0.4 + 0.3 * Math.sin(t * 8) }, 1.5);
    });
  });

  const startX = e.dir > 0 ? -vanW - 2 : W + 2;
  const endX = e.dir > 0 ? W + 2 : -vanW - 2;
  const drive = clip(DRIVE_IN + PARK + DRIVE_OFF, (r, t) => {
    r.fillRect(0, 0, W, H, BLACK);
    let x: number;
    let moving = true;
    let blink = false;
    if (t < DRIVE_IN) {
      // It slows to a stop where it parks, without rolling past it.
      x = lerp(startX, parkX, outCubic(t / DRIVE_IN));
      // The tracker is shoved off ahead of the van.
      const s = new Raster(W, H);
      tracking.draw(s, TRACK);
      const front = e.dir > 0 ? x + vanW : x;
      const push = e.dir > 0 ? Math.max(0, front - 4) : Math.max(0, W - 4 - front);
      r.draw(s, e.dir * push, 0, 1 - span(t, 0, DRIVE_IN * 0.8));
    } else if (t < DRIVE_IN + PARK) {
      x = parkX;
      moving = false;
      blink = (t - DRIVE_IN) % 0.7 < 0.35;
      // Exhaust puffs at the back.
      const pt = (t - DRIVE_IN) % 0.8;
      const bx = e.dir > 0 ? parkX - 2 - pt * 4 : parkX + vanW + 1 + pt * 4;
      r.glow(bx, 12 - pt * 3, 1.5, 1.5, { ...PUFF, a: 0.5 * (1 - pt / 0.8) }, 1.2);
    } else {
      const q = (t - DRIVE_IN - PARK) / DRIVE_OFF;
      x = parkX + (endX - parkX) * inBack(q, 1.4);
      // Speed lines behind it.
      if (q > 0.3) {
        for (let k = 0; k < 3; k++) {
          const len = 4 + k * 2;
          const lx = e.dir > 0 ? x - len - 2 - k * 3 : x + vanW + 2 + k * 3;
          r.fillRect(lx, 3 + k * 4, len, 1, { ...PUFF, a: 0.6 });
        }
      }
    }
    const side = drawVan(r, x, { cargo, dir: e.dir, t, moving, blink });
    r.text(e.name, big(), side.x + 4, BIG_Y, AMBER);
  });
  return seq(fade({ from: 0, to: 1, duration: MOTION.base }), tracking, drive, fade({ from: 1, to: 0, duration: MOTION.base }));
}
