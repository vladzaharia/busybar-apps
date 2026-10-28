// Tiny characters for the LED matrix.

import { lerp } from "../ease.ts";
import { hex, type Color, type Raster } from "../raster.ts";
import type { Direction } from "./arrows.ts";

/** A walker's pose: walking frames 0..3, standing, waving or pointing the way it faces. */
export type WalkerPose = 0 | 1 | 2 | 3 | "stand" | "wave" | "point";

/** The walker is 7 px wide and 13 tall. */
export const WALKER_SIZE = { width: 7, height: 13 } as const;

/** The walking frame at time `t`: a step every 1/8 s. */
export const walkFrame = (t: number) => (Math.floor(t * 8) % 4) as 0 | 1 | 2 | 3;

/** A stick-figure person, 7 × 13, facing `dir`, top-left at (x, y). Waving uses `t` to flap the hand. */
export function drawWalker(r: Raster, x: number, y: number, dir: Direction, pose: WalkerPose, c: Color = hex("#FFFFFF"), t = 0): void {
  const px = (cx: number, cy: number) => r.blend(Math.round(x + (dir > 0 ? cx : 6 - cx)), Math.round(y + cy), c);
  const line = (x0: number, y0: number, x1: number, y1: number) => {
    const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0));
    for (let i = 0; i <= n; i++) px(Math.round(lerp(x0, x1, n ? i / n : 0)), Math.round(lerp(y0, y1, n ? i / n : 0)));
  };
  // Head: a ring with a filled middle.
  for (const [hx, hy] of [[2, 0], [3, 0], [4, 0], [2, 1], [3, 1], [4, 1], [2, 2], [3, 2], [4, 2]] as const) px(hx, hy);
  line(3, 3, 3, 7);
  const stride: Record<string, [number, number]> = { 0: [1, 5], 1: [2, 4], 2: [5, 1], 3: [4, 2] };
  const [l1, l2] = typeof pose === "number" ? stride[pose]! : [2, 4];
  line(3, 8, l1, 12);
  line(3, 8, l2, 12);
  if (typeof pose === "number") {
    const swing = [[1, 7, 5, 6], [2, 7, 4, 7], [5, 6, 1, 7], [4, 7, 2, 7]][pose]!;
    line(3, 4, swing[0]!, swing[1]!);
    line(3, 4, swing[2]!, swing[3]!);
  } else if (pose === "point") {
    line(3, 4, 6, 4);
    px(7, 4);
    line(3, 4, 2, 7);
  } else if (pose === "wave") {
    const up = Math.floor(t * 6) % 2 === 0;
    line(3, 4, up ? 5 : 6, up ? 1 : 2);
    line(3, 4, 2, 7);
  } else {
    line(3, 4, 2, 7);
    line(3, 4, 4, 7);
  }
}
