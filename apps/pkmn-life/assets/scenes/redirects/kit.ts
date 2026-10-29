// What the redirect scenes in this folder share: the screen, the name's font and where its capitals sit, and the
// name's measurements on the screen. Everything is laid out for someone on the right (dir 1) and mirrored with
// mirrorX for someone on the left; lettering is never mirrored, only moved.

import { capCentre, clip, font, hex, inkWidth, type Clip, type Font } from "@vladzaharia/bar-pixel";
import type { Redirect } from "../../../src/presets.ts";

export const W = 72;
export const H = 16;
export const BLACK = hex("#000000");
export const BIG = "extra_large" as const;
/** Top of an extra_large text element whose capitals sit on rows 3..12. */
export const BIG_Y = capCentre(BIG);

export const big = (): Font => font(BIG);
/** The name's ink width in the big font: what a layout is built from (never its advance width, a pixel wider). */
export const nameInk = (e: Redirect) => inkWidth(e.name, big());

/** A clip of `duration` s of black (behind a scene, over the clock). */
export const black = (duration: number): Clip => clip(duration, (r) => r.fillRect(0, 0, W, H, BLACK));

/**
 * Each letter of `text` set at `x` in `f`: where its pen starts and how far it advances, on the screen. Things that
 * happen as something passes a letter are worked out from these, so they hold for either direction.
 */
export function letterSpans(text: string, f: Font, x: number): { x: number; advance: number }[] {
  const out: { x: number; advance: number }[] = [];
  let pen = x;
  for (const ch of text) {
    const advance = f.glyph(ch.codePointAt(0)!)?.advance ?? 0;
    out.push({ x: pen, advance });
    pen += advance;
  }
  return out;
}
