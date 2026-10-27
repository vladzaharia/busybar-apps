// Icons every app needs: the clock's calendar, and simple monogram app icons for the Apps menu.

import { font, textWidth } from "./font.ts";
import { stampPalette } from "./jira.ts";
import { Raster, hex, mix, type Color } from "./raster.ts";

/** The 13×14 calendar bar-core's clockFace() expects: red header with binder rings, a page for the day number. */
export function calendarIcon(): Raster {
  const r = new Raster(13, 14);
  stampPalette(
    r,
    [
      "...o.....o...",
      ".RRoRRRRRoRR.",
      "RRRRRRRRRRRRR",
      "RRRRRRRRRRRRR",
      "rrrrrrrrrrrrr",
      "WWWWWWWWWWWWW",
      "WWWWWWWWWWWWW",
      "WWWWWWWWWWWWW",
      "WWWWWWWWWWWWW",
      "WWWWWWWWWWWWW",
      "WWWWWWWWWWWWW",
      "WWWWWWWWWWWWW",
      "WWWWWWWWWWWWW",
      ".wwwwwwwwwww.",
    ],
    0,
    0,
    { o: hex("#C9CED6"), R: hex("#EF4136"), r: hex("#B8241B"), W: hex("#F4F5F7"), w: hex("#C9CED6") },
  );
  return r;
}

/**
 * A monogram app icon: a letter on a rounded tile. Front icons are 8×8 colour; back icons 11×11 greyscale (pass a
 * grey). The letter uses the tiny font on the front and the small one on the back.
 */
export function monogramIcon(letter: string, size: 8 | 11, color: Color, ink: Color = hex("#FFFFFF")): Raster {
  const r = new Raster(size, size);
  r.roundRect(0, 0, size, size, size === 8 ? 2 : 3, (_x, _y, _u, v) => mix(color, hex("#000000"), v * 0.25));
  const f = font(size === 8 ? "tiny" : "small");
  const ch = letter.slice(0, 1).toUpperCase();
  const g = f.glyph(ch.charCodeAt(0));
  if (g) {
    const x = Math.floor((size - textWidth(ch, f)) / 2) + (size === 8 ? 1 : 0);
    const y = Math.floor((size - g.height) / 2) - (f.ascent - g.y - g.height);
    r.text(ch, f, x, y, ink);
  }
  return r;
}
