// App icons and the clock's calendar, drawn as pixel art.

import { Raster, hex, type Color } from "@vladzaharia/bar-pixel";

/** A ball split red over white by a dark band with a button in the middle. */
function ball(size: number, palette: { top: Color; bottom: Color; band: Color; button: Color; shine: Color }): Raster {
  const r = new Raster(size, size);
  const c = (size - 1) / 2;
  const radius = size / 2;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const d = Math.hypot(x - c, y - c);
      if (d > radius - 0.15) continue;
      const band = Math.abs(y - c) < size / 10 + 0.3;
      let color = band ? palette.band : y < c ? palette.top : palette.bottom;
      if (Math.hypot(x - c, y - c) < size / 6.5) color = palette.button;
      r.blend(x, y, color);
    }
  }
  r.blend(Math.round(c - radius * 0.45), Math.round(c - radius * 0.5), palette.shine);
  return r;
}

/** Front: 8×8 colour, shown in the Apps menu on the LEDs. */
export const frontIcon = () =>
  ball(8, { top: hex("#E8373E"), bottom: hex("#D8DDE6"), band: hex("#2A2F38"), button: hex("#FFFFFF"), shine: hex("#FF9DA0") });

/** Back: 11×11 greyscale for the OLED. */
export const backIcon = () =>
  ball(11, { top: hex("#9A9A9A"), bottom: hex("#F2F2F2"), band: hex("#202020"), button: hex("#FFFFFF"), shine: hex("#E0E0E0") });
