// Shout: a megaphone on the far side, pointing their way, shouts twice. "HEY!" blasts out of its bell, letter by
// letter, and lands at the edge on their side, shaking, with sound arcs rolling out of the bell; the second shout blows
// "HEY!" off that way and blasts the name out to the same edge. The name shakes, settles, holds, and its letters fly
// off their way, the nearest the edge first; the megaphone slides back out.
//
// The words land NAME_EDGE from their edge on their ink (the name is edge-anchored, so "HEY" comes first in time, not
// beside it). The arcs stop two columns short of the words, so they never touch them.

import {
  MEGAPHONE_SIZE,
  MOTION,
  NAME_EDGE,
  clip,
  drawMegaphone,
  drawSoundArcs,
  fade,
  inCubic,
  inQuad,
  inkWidth,
  layer,
  lerp,
  mirrorX,
  outBack,
  readTime,
  rng,
  seq,
  shake,
  span,
  wipe,
  type Clip,
} from "@vladzaharia/bar-pixel";
import type { Redirect } from "../../../src/presets.ts";
import { AMBER, WHITE } from "../look.ts";
import { BIG_Y, BLACK, W, big, black, letterSpans } from "./kit.ts";

const HEY = "HEY!";

export function shout(e: Redirect): Clip {
  const f = big();
  const MW = MEGAPHONE_SIZE.width;
  const IN = 0.3;
  const BLAST = 0.35;
  const STAGGER = 0.045;
  const OUT = 0.65;
  const megaY = 3;
  const cy = megaY + MEGAPHONE_SIZE.mouthY + 0.5;
  // The megaphone at the far edge (rightward x 1), the words at their edge.
  const words = [HEY, e.name].map((text, w) => {
    const ink = inkWidth(text, f);
    const x = mirrorX(W - NAME_EDGE - ink, ink, e.dir);
    return { text, ink, x, letters: letterSpans(text, f, x), color: w === 0 ? WHITE : AMBER };
  });
  const [hey, name] = words as [(typeof words)[0], (typeof words)[0]];
  // Shout 1 at IN: HEY! lands, shakes, and is read. Shout 2 blows it off and blasts the name out.
  const heyLanded = IN + BLAST + (HEY.length - 1) * STAGGER;
  const SHOUT2 = heyLanded + 0.3 + readTime(HEY);
  const nameFrom = SHOUT2 + 0.2;
  const nameLanded = nameFrom + BLAST + (e.name.length - 1) * STAGGER;
  const tOut = nameLanded + 0.5 + readTime(e.name) + 0.8;
  const total = tOut + OUT;
  /** The megaphone's x in the rightward layout: popping in, kicking back at each shout, sliding back out. */
  const megaX = (t: number) => {
    if (t < IN) return lerp(-MW - 1, 1, outBack(t / IN, 1.4));
    const kick = (p: number) => (t >= p && t < p + 0.25 ? -Math.round(Math.sin(((t - p) / 0.25) * Math.PI) * 2) : 0);
    if (t < tOut) return 1 + kick(IN) + kick(SHOUT2);
    return lerp(1, -MW - 2, inCubic(span(t, tOut + 0.25, total)));
  };
  /** The mouth's column on the screen when the megaphone is at rightward x `mx`. */
  const mouthAt = (mx: number) => (e.dir > 0 ? mx + MEGAPHONE_SIZE.mouth : W - 1 - mx - MEGAPHONE_SIZE.mouth);
  const jitter = (i: number, t: number, strength: number): [number, number] => {
    if (strength <= 0) return [0, 0];
    const rand = rng(7 + i * 131 + Math.floor(t * 24) * 7919);
    const a = strength * 1.4;
    return [Math.round((rand() - 0.5) * 2 * a), Math.round((rand() - 0.5) * 2 * a)];
  };
  /**
   * Draws one of the words at time `t`: each letter shot out of the mouth to its place from `from`, the one going
   * farthest first, shaking hardest just after; and from `leave` flying off their way, the letter nearest the edge
   * first, each by its own distance from the edge.
   */
  const drawWord = (r: Parameters<Clip["draw"]>[0], word: (typeof words)[0], t: number, from: number, leave: number, leaveTime: number) => {
    const n = word.text.length;
    const strength = Math.min(1, Math.exp(-(t - from - BLAST) * 3)) * (t > from ? 1 : 0) - 0.12;
    const mouth = mouthAt(1);
    r.text(word.text, f, word.x, BIG_Y, word.color, (i) => {
      // The letter going farthest (nearest the edge) leaves the bell first, so none overtakes another.
      const order = e.dir > 0 ? n - 1 - i : i;
      const q = span(t, from + order * STAGGER, from + order * STAGGER + BLAST);
      if (q <= 0) return { hidden: true };
      const s = word.letters[i]!;
      // On the screen: from the mouth to the letter's place.
      let lx = lerp(mouth - e.dir * 4, s.x, outBack(q, 1.2));
      const k = span(t, leave + order * 0.03, leave + order * 0.03 + leaveTime);
      const away = e.dir > 0 ? W + 8 - s.x : s.x + s.advance + 8;
      lx += e.dir * inQuad(k) * away;
      if (k >= 1) return { hidden: true };
      const [jx, jy] = jitter(i, t, strength);
      return { dx: Math.round(lx - s.x) + jx, dy: jy, alpha: q < 0.25 ? q * 4 : 1 };
    });
  };
  // Everything but the black behind it, which stays put while the shouts shake the rest (or the clock would show at
  // the edges).
  const scene = clip(total, (r, t) => {
    const mx = Math.round(megaX(t));
    // Sound out of the bell at each shout, stopping two columns short of whichever words are there.
    const stop = (word: (typeof words)[0]) => (e.dir > 0 ? word.x - 2 : word.x + word.ink + 1);
    drawSoundArcs(r, mouthAt(mx) + e.dir * 1.5, cy, e.dir, span(t, IN, IN + 0.6), { reach: 12, stop: stop(hey) });
    drawSoundArcs(r, mouthAt(mx) + e.dir * 1.5, cy, e.dir, span(t, SHOUT2, SHOUT2 + 0.6), { reach: 12, stop: stop(name) });
    drawWord(r, hey, t, IN, SHOUT2, 0.25);
    drawWord(r, name, t, nameFrom, tOut, 0.35);
    drawMegaphone(r, mirrorX(mx, MW, e.dir), megaY, e.dir);
  });
  const shaken = shake(shake(scene, { from: IN + 0.05, to: IN + 0.45, amplitude: 1.5, vertical: true }), { from: SHOUT2 + 0.2, to: SHOUT2 + 0.6, amplitude: 1.5, vertical: true });
  return seq(fade({ from: 0, to: 1, duration: MOTION.base }), layer(black(total), shaken), wipe({ mode: "reveal", direction: e.dir, color: BLACK, edge: AMBER, duration: MOTION.base }));
}
