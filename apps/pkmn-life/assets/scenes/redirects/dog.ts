// Growlithe: it bounds in from the far side and the name pops up behind it, letter by letter, as it passes; it stops,
// wags its cream tail and barks their way (its jaw drops, a puff of embers, and the letters hop towards it in a wave),
// then bounds off that way. From over there, where it went, comes its cry: "GROWL!", or "GRR!" when a wide name leaves
// less room for the bubble.
//
// The name is NAME_EDGE from the far edge on its ink and Growlithe stops a clear column past it. Letters pop from where
// it is on the screen, so the same holds for someone on the left. At the end the name is wiped away their way.

import {
  GROWLITHE_SIZE,
  MOTION,
  NAME_EDGE,
  clip,
  drawEmberPuff,
  drawGrowlithe,
  fade,
  lerp,
  mirrorX,
  outBack,
  seq,
  span,
  speechBubble,
  speechBubbleSize,
  wipeOut,
  type Clip,
  type GrowlithePose,
} from "@vladzaharia/bar-pixel";
import type { Redirect } from "../../../src/presets.ts";
import { AMBER } from "../look.ts";
import { BIG_Y, BLACK, H, W, big, letterSpans, nameInk } from "./kit.ts";

/** Its cries, the longest that fits first. */
const CRIES = ["GROWL!", "GRR!"];
/** The bubble's edge nearest the speaker, who has gone off the edge on their side (its tail reaches the edge). */
const BUBBLE_EDGE = W - 3;

export function dog(e: Redirect): Clip {
  const DW = GROWLITHE_SIZE.width;
  const inkW = nameInk(e);
  // Rightward layout: the name at the far edge, Growlithe stopping a clear column past it.
  const nameR = NAME_EDGE;
  const stopX = nameR + inkW + 1;
  const startX = -DW - 2;
  const HOP = 0.32;
  const HOP_LEN = 11;
  const hopsIn = Math.ceil((stopX - startX) / HOP_LEN);
  const tStop = hopsIn * HOP;
  const BARK = tStop + 0.35;
  const tLeave = BARK + 0.9;
  const SPEED = HOP_LEN / HOP;
  // The bubble pops up as it bounds off the edge, at their side, clear of the name.
  const cry = CRIES.find((c) => BUBBLE_EDGE - speechBubbleSize(c).width + 1 >= nameR + inkW + 1) ?? CRIES[CRIES.length - 1]!;
  const bubble = speechBubble({ x: e.dir > 0 ? BUBBLE_EDGE : W - 1 - BUBBLE_EDGE, top: 0, dir: e.dir > 0 ? -1 : 1, text: cry });
  const tCry = tLeave + (W - stopX) / SPEED;
  const total = tCry + bubble.duration + 0.4;
  /** Its x in the rightward layout and its hop phase (0..1 within a hop; -1 standing). */
  const at = (t: number): [number, number] => {
    if (t < tStop) return [lerp(startX, stopX, t / tStop), (t / HOP) % 1];
    if (t < tLeave) return [stopX, -1];
    return [stopX + (t - tLeave) * SPEED, ((t - tLeave) / HOP) % 1];
  };
  const nameX = mirrorX(nameR, inkW, e.dir);
  const letters = letterSpans(e.name, big(), nameX);
  // Each letter pops up once Growlithe, on the screen, is all the way past it.
  const popAt = letters.map((s) => {
    for (let t = 0; t < tStop; t += 1 / 240) {
      const x = mirrorX(at(t)[0], DW, e.dir);
      if (e.dir > 0 ? x > s.x + s.advance : x + DW < s.x - 1) return t;
    }
    return tStop;
  });
  const scene = clip(total, (r, t) => {
    r.fillRect(0, 0, W, H, BLACK);
    // The name, each letter hopping up behind it; at the bark they hop its way in a wave.
    const n = e.name.length;
    r.text(e.name, big(), nameX, BIG_Y, AMBER, (i) => {
      const q = span(t, popAt[i]!, popAt[i]! + 0.3);
      const k = e.dir > 0 ? i : n - 1 - i;
      const wave = span(t, BARK + 0.1 + k * 0.07, BARK + 0.35 + k * 0.07);
      const hop = wave > 0 && wave < 1 ? -Math.round(Math.sin(wave * Math.PI) * 2) : 0;
      return { hidden: q <= 0, dy: Math.round(lerp(5, 0, outBack(q, 2.4))) + hop, alpha: Math.min(1, q * 3) };
    });
    const [xr, phase] = at(t);
    if (xr < W + 2) {
      let pose: GrowlithePose;
      let y = 3;
      if (phase >= 0) {
        pose = phase > 0.15 && phase < 0.85 ? "leap" : "gather";
        y = 3 - Math.round(Math.sin(phase * Math.PI) * 3);
      } else {
        const barking = (t >= BARK && t < BARK + 0.18) || (t >= BARK + 0.3 && t < BARK + 0.45);
        pose = barking ? "bark" : Math.floor(t * 9) % 2 ? "stand" : "wag";
      }
      drawGrowlithe(r, mirrorX(Math.round(xr), DW, e.dir), y, e.dir, pose);
    }
    // A puff of embers with the bark, out of its mouth their way.
    const nose = mirrorX(stopX + DW, 1, e.dir);
    drawEmberPuff(r, nose + 0.5, 9.5, e.dir, span(t, BARK, BARK + 0.6));
    if (t >= tCry) bubble.draw(r, Math.min(bubble.duration, t - tCry));
  });
  return seq(fade({ from: 0, to: 1, duration: MOTION.base }), scene, wipeOut(scene, { direction: e.dir, edge: AMBER, duration: MOTION.base }));
}
