// Front nag "Forecast": a weather report. A wipe covers the clock in night sky; a cloud drifts in raining little
// tickets while the forecast rolls through beside it: "TODAY'S FORECAST", "100%" (with a flash of lightning), "CHANCE
// OF TICKETS", "FILE ONE!". The sky fades out and a wipe sweeps back to the clock.

import {
  CLOUD_SIZE,
  MOTION,
  Raster,
  capTop,
  clip,
  drawCloud,
  drawRain,
  fade,
  font,
  hex,
  inOutCubic,
  inkWidth,
  layer,
  lerp,
  mix,
  outCubic,
  particles,
  readTime,
  seq,
  span,
  wipe,
  type Clip,
  type Color,
  type FontName,
} from "@vladzaharia/bar-pixel";
import type { Nag } from "../../../src/presets.ts";
import { AMBER, JIRA_LIGHT, JIRA_MID, SOFT, WHITE } from "../look.ts";

const W = 72;
const H = 16;
const SKY = hex("#07142A");
const CYAN = hex("#62C7FF");
/** The cloud, a pixel in from the top-left corner; the forecast is centred in the room right of it. */
const CLOUD = { x: 1, y: 1 };
const BOX = { x: CLOUD.x + CLOUD_SIZE.width, width: W - CLOUD.x - CLOUD_SIZE.width };
/** A tiny falling ticket, 4 × 3, and the same tipped on its side. */
const DROP = { frames: [["BWWW", "BWWW", "WWWW"], ["BBW", "WWW", "WWW", "WWW"]], palette: { B: JIRA_MID, W: SOFT } as Record<string, Color> };

interface Line {
  text: string;
  font: FontName;
  /** Row of the capitals' top; two lines sit on rows 1 to 5 and 8 to 14, a row clear of each edge. */
  cap: number;
  color: Color;
}

export function forecast(_e: Nag): Clip {
  const CLOUD_IN = 0.55;
  const RAIN_AT = 0.45;
  const PAGE_AT = 0.5;
  const ROLL = 0.26;
  const page = (lines: Line[], extra = 0) => ({ lines, hold: readTime(lines.map((l) => l.text).join(" ")) + extra });
  const pages = [
    page([
      { text: "TODAY'S", font: "small", cap: 1, color: WHITE },
      { text: "FORECAST", font: "normal", cap: 8, color: WHITE },
    ]),
    // A single line is centred on its capitals: rows 3 to 12 here, 4 to 10 for FILE ONE!.
    page([{ text: "100%", font: "extra_large", cap: 3, color: AMBER }], 0.25),
    page(
      [
        { text: "CHANCE OF", font: "small", cap: 1, color: WHITE },
        { text: "TICKETS", font: "bold", cap: 8, color: JIRA_LIGHT },
      ],
      0.25,
    ),
    page([{ text: "FILE ONE!", font: "normal", cap: 4, color: WHITE }], 0.35),
  ];
  const pageAt: number[] = [];
  let at = PAGE_AT;
  for (const p of pages) {
    pageAt.push(at);
    at += ROLL + p.hold;
  }
  const FADE = MOTION.base;
  const END = at + FADE;
  const BOLT = pageAt[1]! + ROLL;
  const drizzle = particles({ duration: END, dark: hex("#0B2A4A"), light: hex("#2F5F96"), speed: 4, count: 20, fadeIn: 0.6 });

  const scene = clip(END, (r, t) => {
    r.shade((_x, y) => mix(SKY, hex("#030912"), y / (H - 1)));
    drizzle.draw(r, t);
    // The cloud drifts in from the left; tickets rain from under it, and it flashes white as the 100% lands.
    const cx = Math.round(lerp(CLOUD.x - CLOUD_SIZE.width - 1, CLOUD.x, outCubic(span(t, 0, CLOUD_IN))));
    drawRain(r, { x: cx, y: CLOUD.y + 6, t, start: RAIN_AT, drop: DROP });
    const bolt = t > BOLT ? Math.max(0, 1 - (t - BOLT) / 0.25) * (Math.floor((t - BOLT) * 30) % 2 === 0 ? 1 : 0.4) : 0;
    drawCloud(r, cx, CLOUD.y, { flash: bolt });
    // The forecast: pages rolling up through the box right of the cloud.
    const box = new Raster(W, H);
    box.clip = { x0: BOX.x, y0: 0, x1: W, y1: H };
    pages.forEach((p, k) => {
      const s = pageAt[k]!;
      const pin = inOutCubic(span(t, s, s + ROLL));
      const next = pageAt[k + 1];
      const pout = next === undefined ? 0 : inOutCubic(span(t, next, next + ROLL));
      if (pin <= 0 || pout >= 1) return;
      const dy = Math.round((1 - pin) * H - pout * H);
      for (const l of p.lines) {
        // The 100% lands with a little hop.
        const hop = l.text === "100%" ? Math.round(-Math.sin(span(t, s + ROLL, s + ROLL + 0.3) * Math.PI) * 1.5) : 0;
        const f = font(l.font);
        box.text(l.text, f, Math.round(BOX.x + (BOX.width - inkWidth(l.text, f)) / 2), capTop(l.font, l.cap) + dy + hop, l.color);
      }
    });
    r.draw(box, 0, 0);
  });

  const cover = (mode: "cover" | "reveal") => wipe({ mode, color: SKY, edge: CYAN, duration: MOTION.base });
  // Once "FILE ONE!" has been read, the sky fades out to its own colour, for the wipe to sweep away.
  const body = layer(scene, { clip: fade({ duration: FADE, from: 0, to: 1, color: SKY }), at: END - FADE });
  return seq(cover("cover"), body, cover("reveal"));
}
