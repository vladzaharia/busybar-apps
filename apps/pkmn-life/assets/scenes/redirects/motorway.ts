// Motorway sign: a green guide sign drops in over the clock like a gantry sign coming into view, with the name in
// white and a "GO!" tab in the corner on their side over a diagonal exit arrow. The sheen runs their way and the arrow
// nudges their way while it holds, then the sign slides off towards them.

import { MOTION, Raster, clip, drawRoadSign, inCubic, mirrorX, outBack, roadSignLayout, seq, type Clip } from "@vladzaharia/bar-pixel";
import type { Redirect } from "../../../src/presets.ts";
import { WHITE } from "../look.ts";
import { BIG_Y, H, W, big, nameInk } from "./kit.ts";

const TAB = "GO!";

export function motorway(e: Redirect): Clip {
  const IN = MOTION.slow;
  const HOLD = 4.4;
  const OUT = MOTION.base;
  const inkW = nameInk(e);
  // The name centred on its ink in the room the sign leaves it (3 px clear of the rim and the tab), laid out for the
  // rightward sign and mirrored from it, so both sides are exact mirror images. DAMIAN, the widest, leaves 3 px over.
  const { room } = roadSignLayout({ tab: TAB, dir: 1 });
  const nameX = mirrorX(room.x0 + Math.max(0, Math.round((room.x1 - room.x0 + 1 - inkW) / 2)), inkW, e.dir);
  const drawSign = (r: Raster, t: number) => {
    const period = 2.2;
    const sheen = t > 0 ? ((t % period) / period) * (W + 50) - 25 : undefined;
    const nudge = t > 0 && t % 1.1 < 0.4 ? Math.round(Math.sin(((t % 1.1) / 0.4) * Math.PI)) : 0;
    drawRoadSign(r, { tab: TAB, dir: e.dir, sheen, nudge });
    r.text(e.name, big(), nameX, BIG_Y, WHITE);
  };
  /** The sign `dy` rows down from its place: when it bounces past it, its top edge is drawn taller, so no clock shows. */
  const dropped = (r: Raster, dy: number) => {
    const s = new Raster(W, H);
    drawSign(s, -1);
    r.draw(s, 0, dy);
    for (let y = 0; y < dy; y++) for (let x = 0; x < W; x++) {
      const i = x * 4;
      const a = s.data[i + 3]!;
      if (a > 0) r.blend(x, y, { r: s.data[i]! / a, g: s.data[i + 1]! / a, b: s.data[i + 2]! / a, a });
    }
  };
  return seq(
    clip(IN, (r, t) => dropped(r, Math.round(-(H + 1) * (1 - outBack(t / IN, 1.2))))),
    clip(HOLD, (r, t) => drawSign(r, t)),
    // Off towards them, without winding up the other way first (that would show the clock on their side).
    clip(OUT, (r, t) => {
      const s = new Raster(W, H);
      drawSign(s, HOLD + t);
      r.draw(s, Math.round(e.dir * (W + 2) * inCubic(t / OUT)), 0);
    }),
  );
}
