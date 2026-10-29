// Front nag "Magic 8-ball": the clock irises shut onto an 8-ball, and "WHAT DO I / NEED NOW?" types beside it. It
// shakes, turns its window to us, and the view irises into the window: the blue die grows to fill the screen, and
// "SIGNS POINT TO", then "A TICKET", float up out of the ink. An iris closes, and the black fades off the clock.

import {
  MOTION,
  Raster,
  capCentre,
  clip,
  drawEightBall,
  fade,
  font,
  hex,
  inCubic,
  inkWidth,
  iris,
  layer,
  lerp,
  mix,
  outBack,
  outCubic,
  readTime,
  rng,
  seq,
  shake,
  span,
  typewriter,
  typingTime,
  type Clip,
  type FontName,
} from "@vladzaharia/bar-pixel";
import type { Nag } from "../../../src/presets.ts";
import { BLACK, JIRA, JIRA_MID, WHITE, asking } from "../look.ts";

const W = 72;
const H = 16;
const BALL = { x: 11.5, y: 8, radius: 7.6 };
/** The question beside the ball: two small lines, caps on rows 2 and 9. */
const QUESTION = ["WHAT DO I", "NEED NOW?"];
const QUESTION_X = 26;

export function eightball(_e: Nag): Clip {
  const POP = 0.35;
  const ASK_AT = 0.3;
  const typed = typingTime(QUESTION, MOTION.typeSpeed);
  // Once typed, the question holds still to be read (the ball shaking beside it), then fades as the ball turns.
  const READ = ASK_AT + typed + readTime(QUESTION.join(" "));
  const TURN = READ + 0.2;
  const SHAKE = 0.7;
  const SHAKE_AT = TURN - 0.05 - SHAKE;
  const ZOOM = TURN + 0.2;
  const ZOOM_T = 0.55;
  // The answer, each page centred on its capitals; it floats up out of the ink, holds still to be read, and sinks.
  const pages = [
    { text: "SIGNS POINT TO", font: "small" as FontName, hold: readTime("SIGNS POINT TO") },
    { text: "A TICKET", font: "extra_large" as FontName, hold: readTime("A TICKET") + 0.6 },
  ];
  const FLOAT = 0.5;
  const SINK = 0.25;
  const pageAt: number[] = [];
  let at = ZOOM + ZOOM_T * 0.6;
  for (const p of pages) {
    pageAt.push(at);
    at += FLOAT + p.hold + SINK - 0.1;
  }
  const CLOSE = at - SINK + 0.1;
  const IRIS = 0.5;
  const END = CLOSE + IRIS;

  const ball = clip(END, (r, t) => {
    const radius = BALL.radius * outBack(span(t, 0, POP), 2);
    if (radius <= 0.5) return;
    drawEightBall(r, BALL.x, BALL.y, radius, t > TURN ? 1 : 0);
  });
  // The question stays up through the shake, fading as the ball turns; its "?" pulses amber.
  const ask = typewriter({ lines: QUESTION, font: "small", x: QUESTION_X, ys: [0, 7], duration: TURN + 0.1 - ASK_AT, color: asking(WHITE) });
  const front = layer(shake(ball, { from: SHAKE_AT, to: SHAKE_AT + SHAKE, amplitude: 2, vertical: true, hz: 9 }), {
    clip: clip(ask.duration, (r, t) => {
      const l = new Raster(W, H);
      ask.draw(l, t);
      r.draw(l, 0, 0, 1 - span(t, ask.duration - 0.3, ask.duration));
    }),
    at: ASK_AT,
  });

  // Inside the window: dark blue ink around the die (a big faint triangle), a few bubbles, and the answer floating up
  // out of it. `open` 0..1 is the zoom: the ink and the die grow out of the ball's window to fill the screen.
  const rand = rng(31);
  const bubbles = Array.from({ length: 9 }, () => ({ x: rand() * W, phase: rand(), speed: 3 + rand() * 4 }));
  const inside = (r: Raster, t: number, open: number) => {
    const e = outCubic(open);
    const cx = lerp(BALL.x, W / 2, e);
    const cy = lerp(BALL.y - 0.5, H / 2, e);
    r.shade((x, y) => mix(hex("#12336E"), hex("#02060E"), Math.min(1, Math.hypot((x + 0.5 - cx) / lerp(6, 40, e), (y + 0.5 - cy) / lerp(4, 11, e)))));
    // The die: a triangle pointing down, from the window's 3 px one to most of the screen.
    const half = lerp(1.5, 27, e);
    const top = lerp(cy - 1, 0, e);
    const height = lerp(2, H, e);
    r.shade((x, y) => {
      const v = (y + 0.5 - top) / height;
      if (v < 0 || v > 1) return null;
      const w = half * (1 - v);
      const d = w - Math.abs(x + 0.5 - cx);
      if (d < 0) return null;
      return { ...(d < 1 || v < 1 / height ? JIRA_MID : JIRA), a: lerp(1, d < 1 ? 0.45 : 0.28, e) };
    });
    for (const b of bubbles) {
      const y = H - ((t * b.speed + b.phase * H) % 18);
      r.blend(b.x + Math.sin(t * 2 + b.phase * 6), y, hex("#3A6AB0"), 0.6 * e);
    }
    pages.forEach((p, k) => {
      const s = pageAt[k]!;
      const end = s + FLOAT + p.hold;
      if (t < s || t > end + SINK) return;
      const rise = outCubic(span(t, s, s + FLOAT));
      const sink = inCubic(span(t, end, end + SINK));
      // Still while it holds: it only moves rising and sinking.
      const dy = Math.round((1 - rise) * 7 + sink * 5);
      const a = rise * (1 - sink);
      const f = font(p.font);
      r.glow(W / 2, H / 2 + dy, 30, 6, { ...JIRA, a: 0.35 * a }, 1.5);
      r.text(p.text, f, Math.round((W - inkWidth(p.text, f)) / 2), capCentre(p.font) + dy, WHITE, () => ({ alpha: a }));
    });
  };

  const scene = clip(END, (r, t) => {
    r.fillRect(0, 0, W, H, BLACK);
    if (t < ZOOM) return front.draw(r, t);
    const tt = t - ZOOM;
    const win = new Raster(W, H);
    inside(win, t, Math.min(1, tt / ZOOM_T));
    if (tt < ZOOM_T) {
      // The window opens out of the ball: the iris, used as a mask between the ball and the inside, with a lit rim.
      front.draw(r, t);
      const m = new Raster(W, H);
      iris({ mode: "reveal", x: BALL.x, y: BALL.y - 0.5, duration: ZOOM_T }).draw(m, tt);
      win.fade((x, y) => 1 - m.data[(y * W + x) * 4 + 3]!);
      r.draw(win, 0, 0);
      const radius = outCubic(tt / ZOOM_T) * (Math.hypot(W - BALL.x, 8.5) + 1);
      r.shade((x, y) => {
        const d = Math.abs(Math.hypot(x + 0.5 - BALL.x, y + 0.5 - BALL.y + 0.5) - radius);
        return d < 1.2 ? { ...JIRA_MID, a: (1 - d / 1.2) * 0.9 } : null;
      });
    } else r.draw(win, 0, 0);
    if (t > CLOSE) iris({ mode: "cover", duration: IRIS }).draw(r, t - CLOSE);
  });

  return seq(iris({ mode: "cover", x: BALL.x, y: BALL.y, duration: IRIS }), scene, fade({ duration: MOTION.base, from: 1, to: 0 }));
}
