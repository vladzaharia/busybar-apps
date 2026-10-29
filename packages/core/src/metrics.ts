import { METRICS } from "./metrics.generated.ts";
import type { Font } from "./types.ts";

export { METRICS };

/** Width of `text` in pixels as the device lays it out. Characters outside printable ASCII count as 0. */
export function textWidth(text: string, font: Font): number {
  const advances = METRICS[font].advances;
  let w = 0;
  for (let i = 0; i < text.length; i++) w += advances[text.charCodeAt(i) - 0x20] ?? 0;
  return w;
}

/**
 * Width of `text` from its first pen position to the end of its last lit pixel: `textWidth` less the blank column
 * after the last character's ink (a pixel for nearly every glyph, so `textWidth` is a pixel wider than what shows).
 * Centre and right-align on this. Characters outside printable ASCII count as 0.
 */
export function inkWidth(text: string, font: Font): number {
  const { trailing } = METRICS[font];
  for (let i = text.length - 1; i >= 0; i--) {
    const k = text.charCodeAt(i) - 0x20;
    if (trailing[k] !== undefined) return textWidth(text, font) - trailing[k]!;
  }
  return 0;
}

/** Keeps printable ASCII only (the device fonts are bitmap ASCII), turning anything else into a space. */
export function sanitize(text: string): string {
  return text.replace(/[^\x20-\x7e]/g, " ");
}
