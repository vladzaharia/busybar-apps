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

/** Keeps printable ASCII only (the device fonts are bitmap ASCII), turning anything else into a space. */
export function sanitize(text: string): string {
  return text.replace(/[^\x20-\x7e]/g, " ");
}
