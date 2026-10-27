// Shared pieces for the design mockups: palette, the Jira mark, the stock-style clock, message beats.

import { fileURLToPath } from "node:url";
import { MARK_SPRITES, Mask, Raster, font, hex, mix, readPng, textWidth, type Color, type FontName } from "@vladzaharia/bar-pixel";

export const FPS = 60;
export const FRONT = { width: 72, height: 16 };
export const BACK = { width: 148, height: 80 };

/** Atlassian / Jira blues. */
export const JIRA = {
  b50: hex("#E9F2FF"),
  b100: hex("#CCE0FF"),
  b200: hex("#85B8FF"),
  b300: hex("#579DFF"),
  b400: hex("#388BFF"),
  b500: hex("#1D7AFC"),
  b600: hex("#0C66E4"),
  b700: hex("#0055CC"),
  b800: hex("#09326C"),
  b900: hex("#092957"),
  logoLight: hex("#2684FF"),
  logoDark: hex("#0052CC"),
};
export const WHITE = hex("#FFFFFF");
export const BLACK = hex("#000000");

const logos = (name: string) => fileURLToPath(new URL(`../../../packages/pixel/logos/${name}.png`, import.meta.url));
export const CHEVRONS = ["top", "mid", "bottom"].map((n) => Mask.load(logos(`jira_chevron_${n}`)));

/** Per-chevron placement for animating the mark piece by piece. */
export interface ChevronPose {
  dx?: number;
  dy?: number;
  /** Scale about the mark's centre. */
  scale?: number;
  alpha?: number;
  color?: Color;
}

/**
 * The Jira mark at (x, y) in a `size`² box. Settled, it renders crisp, one tone per chevron, which reads far better
 * on the LED matrix than the logo's soft gradient. `poses` move each chevron on its own.
 */
export function jiraMark(
  r: Raster,
  x: number,
  y: number,
  size: number,
  opts: { poses?: ChevronPose[]; tones?: Color[]; contrast?: number; mode?: "over" | "add" } = {},
): void {
  const tones = opts.tones ?? [hex("#4C9AFF"), hex("#2684FF"), hex("#0065FF")];
  const sprite = MARK_SPRITES[size];
  // Bottom chevron first: the upper ones overlap it, as in the logo.
  for (let i = 2; i >= 0; i--) {
    const p = opts.poses?.[i] ?? {};
    // At rest, stamp the hand-drawn sprite so all three chevrons are identical; scale only while zooming.
    if (sprite && (p.scale ?? 1) === 1) {
      const color = p.color ?? tones[i]!;
      const [ox, oy] = sprite.offsets[i]!;
      const left = Math.round(x + ox + (p.dx ?? 0));
      const top = Math.round(y + oy + (p.dy ?? 0));
      sprite.chevron.forEach((row, ry) =>
        [...row].forEach((c, rx) => {
          if (c === "#") r.blend(left + rx, top + ry, color, p.alpha ?? 1, opts.mode ?? "over");
        }),
      );
      continue;
    }
    const s = size * (p.scale ?? 1);
    const cx = x + size / 2 + (p.dx ?? 0);
    const cy = y + size / 2 + (p.dy ?? 0);
    const color = p.color ?? tones[i]!;
    CHEVRONS[i]!.paint(
      r,
      cx - s / 2,
      cy - s / 2,
      s,
      { ...color, a: color.a * (p.alpha ?? 1) },
      opts.mode ?? "over",
      opts.contrast ?? 6,
    );
  }
}

const calendar = Raster.from(readPng(fileURLToPath(new URL("./calendar.png", import.meta.url))));

/** The stock clock app's layout (calendar icon, bold time, dimmed date), for before/after the alert. */
export function clock(r: Raster, time = "14:27", sub = "Oct, Tue", day = "27", colonDim = false, alpha = 1): void {
  const bold = font("bold");
  const small = font("small");
  const sup = font("superscript");
  const timeW = textWidth(time, bold);
  const width = Math.max(timeW, textWidth(sub, small));
  const iconSpace = 13 + 2;
  const left = Math.floor((72 - (iconSpace + width)) / 2);
  const x = left + iconSpace;
  const height = 7 + 2 + 5;
  const top = Math.floor((16 - height) / 2);
  r.draw(calendar, left, 1, alpha);
  const dayX = left + Math.floor((13 - textWidth(day, sup)) / 2) + 1;
  r.text(day, sup, dayX, 1 + 7 - 2, withA(hex("#323232"), alpha));
  let pen = x;
  for (const part of time.split(/(:)/)) {
    const c = part === ":" && colonDim ? hex("#FFFFFF66") : WHITE;
    r.text(part, bold, pen, top - 2, withA(c, alpha));
    pen += textWidth(part, bold);
  }
  r.text(sub, small, x, top + 7 + 2 - 2, withA(hex("#FFFFFF7F"), alpha));
}

function withA(c: Color, a: number): Color {
  return { ...c, a: c.a * a };
}

/** The default message, split into kinetic beats that each fit beside the mark. */
export interface Beat {
  text: string;
  font: FontName;
  /** Seconds on screen. */
  hold: number;
  accent?: boolean;
}

export const BEATS: Beat[] = [
  { text: "DID YOU", font: "extra_large", hold: 0.9 },
  { text: "FILE A", font: "extra_large", hold: 0.8 },
  { text: "JIRA", font: "extra_large", hold: 1.1, accent: true },
  { text: "TICKET", font: "extra_large", hold: 0.9 },
  { text: "YET???", font: "extra_large", hold: 1.6, accent: true },
];

/** The recap: both lines fit beside the mark in the small font. */
export const MESSAGE = ["Did you file a", "JIRA ticket yet?"];

export const PRESETS = [
  "Did you file a JIRA ticket yet???",
  "Is there a ticket for that?",
  "No ticket, no work!",
  "Move your ticket to In Progress!",
  "Link the ticket in your PR!",
];

/** Short, move-style names for the presets (the battle-menu picker lists these). */
export const MOVES = ["FILE A TICKET", "TICKET CHECK", "NO TICKET NO WORK", "IN PROGRESS", "LINK THE PR"];

/** Vertical gradient between two colours. */
export function vgrad(top: Color, bottom: Color, v: number): Color {
  return mix(top, bottom, v);
}

/** Converts a frame to the back OLED's 16 grey levels (what a gray4 .anim stores). */
export function toGray4(r: Raster): Raster {
  const out = new Raster(r.width, r.height);
  for (let i = 0; i < r.data.length; i += 4) {
    const l = 0.299 * r.data[i]! + 0.587 * r.data[i + 1]! + 0.114 * r.data[i + 2]!;
    const q = Math.round(Math.min(1, l) * 15) / 15;
    out.data[i] = out.data[i + 1] = out.data[i + 2] = q;
    out.data[i + 3] = 1;
  }
  return out;
}
