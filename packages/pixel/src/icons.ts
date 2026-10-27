// Icons every app needs: the clock's calendar, simple monogram app icons for the Apps menu, and a capture ball.

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

export interface BallPalette {
  top: Color;
  bottom: Color;
  band: Color;
  button: Color;
  shine: Color;
}

/** Greys for the OLED: a mid-grey top over a white bottom, a dark band and a white button. */
export const BALL_GREY: BallPalette = {
  top: hex("#8C8C8C"),
  bottom: hex("#F2F2F2"),
  band: hex("#1A1A1A"),
  button: hex("#FFFFFF"),
  shine: hex("#D9D9D9"),
};

/** The colour ball for the LEDs: red over white. */
export const BALL_RED: BallPalette = {
  top: hex("#E8373E"),
  bottom: hex("#D8DDE6"),
  band: hex("#2A2F38"),
  button: hex("#FFFFFF"),
  shine: hex("#FF9DA0"),
};

/** A capture ball `size` px across: top over bottom, split by a band with a button in the middle. */
export function ballIcon(size: number, palette: BallPalette = BALL_GREY): Raster {
  const r = new Raster(size, size);
  const c = (size - 1) / 2;
  const radius = size / 2;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const d = Math.hypot(x - c, y - c);
      if (d > radius - 0.15) continue;
      const band = Math.abs(y - c) < size / 10 + 0.3;
      let color = band ? palette.band : y < c ? palette.top : palette.bottom;
      if (d < size / 6.5) color = palette.button;
      r.blend(x, y, color);
    }
  }
  r.blend(Math.round(c - radius * 0.45), Math.round(c - radius * 0.5), palette.shine);
  return r;
}
