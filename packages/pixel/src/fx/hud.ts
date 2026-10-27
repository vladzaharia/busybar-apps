// HUD pieces: dialogue boxes, bars and indicators in the style of handheld games and the stock screens.

import { lerp, outCubic } from "../ease.ts";
import { font, textWidth } from "../font.ts";
import { BALL_GREY, ballIcon, type BallPalette } from "../icons.ts";
import { hex, Raster, type Color } from "../raster.ts";
import { MOTION } from "../motion.ts";
import { clip, type Clip } from "../timeline.ts";

export interface DialogueStyle {
  fill: Color;
  border: Color;
  ink: Color;
  arrow: Color;
}

/** Light box, Jira-blue frame, dark ink. */
export const DIALOGUE_LIGHT: DialogueStyle = {
  // Softer than white: a full screen of white LEDs is glaring.
  fill: hex("#CFD8E6"),
  border: hex("#1D7AFC"),
  ink: hex("#141820"),
  arrow: hex("#0C66E4"),
};

/**
 * A full-width dialogue box with up to two lines of small text typed in at `cps`, and the blinking ▼ once the page
 * is complete. `rise` 0..1 slides the box up from the bottom edge. `emphasis` recolours letters (e.g. "???").
 */
export function drawDialogue(
  r: Raster,
  o: {
    lines: string[];
    typed: number;
    t: number;
    rise?: number;
    style?: DialogueStyle;
    emphasis?: (index: number, ch: string) => Color | undefined;
  },
): void {
  const s = o.style ?? DIALOGUE_LIGHT;
  const top = Math.round(lerp(r.height, 0, o.rise ?? 1));
  r.roundRect(0, top, r.width, r.height, 2, (x, y) => {
    const edge = x === 0 || x === r.width - 1 || y - top === 0 || y - top === r.height - 1;
    return edge ? s.border : s.fill;
  });
  if ((o.rise ?? 1) < 1) return;
  const small = font("small");
  let n = 0;
  o.lines.forEach((line, li) => {
    r.text(line, small, 3, li === 0 ? 0 : 7, s.ink, (gi, ch) => ({ hidden: n++ >= o.typed, color: o.emphasis?.(gi, ch) }));
  });
  const total = o.lines.reduce((k, l) => k + l.length, 0);
  if (o.typed >= total && Math.floor(o.t * 2.5) % 2 === 0) {
    r.fillRect(r.width - 5, r.height - 4, 3, 1, s.arrow);
    r.fillRect(r.width - 4, r.height - 3, 1, 1, s.arrow);
  }
}

/** Pages of a dialogue, typed one after another; each page holds for its `hold` once typed. */
export function dialogue(o: {
  pages: { lines: string[]; hold: number }[];
  cps?: number;
  style?: DialogueStyle;
  emphasis?: (index: number, ch: string, t: number) => Color | undefined;
}): Clip {
  const cps = o.cps ?? MOTION.typeSpeed;
  const starts: number[] = [];
  let total = 0;
  for (const p of o.pages) {
    starts.push(total);
    total += p.lines.reduce((k, l) => k + l.length, 0) / cps + p.hold;
  }
  return clip(total, (r, t) => {
    let i = starts.length - 1;
    while (i > 0 && t < starts[i]!) i--;
    const page = o.pages[i]!;
    drawDialogue(r, {
      lines: page.lines,
      typed: Math.floor((t - starts[i]!) * cps),
      t,
      style: o.style,
      emphasis: o.emphasis ? (gi, ch) => o.emphasis!(gi, ch, t) : undefined,
    });
  });
}

/** Splits text into dialogue pages of two lines, wrapping on words to fit the box. */
export function paginate(text: string, width = 66, hold = 1): { lines: string[]; hold: number }[] {
  const small = font("small");
  const lines: string[] = [];
  let line = "";
  for (const word of text.split(" ")) {
    const next = line ? `${line} ${word}` : word;
    if (textWidth(next, small) <= width || !line) line = next;
    else {
      lines.push(line);
      line = word;
    }
  }
  if (line) lines.push(line);
  const pages: { lines: string[]; hold: number }[] = [];
  for (let i = 0; i < lines.length; i += 2) pages.push({ lines: lines.slice(i, i + 2), hold });
  return pages;
}

/** Name, level and an HP bar in an L-shaped frame, as for an opponent in a battle. `hp` 0..1. */
export function drawHpBox(r: Raster, o: { name: string; level?: string; hp: number; alpha?: number; x?: number; y?: number }): void {
  const a = o.alpha ?? 1;
  if (a <= 0) return;
  const x = o.x ?? 0;
  const y = o.y ?? 0;
  const small = font("small");
  const tiny = font("tiny");
  const line = { ...hex("#9AA3B2"), a };
  r.text(o.name, small, x + 2, y - 1, { ...hex("#FFFFFF"), a });
  r.text(o.level ?? ":L99", small, x + 4 + textWidth(o.name, small), y - 1, { ...hex("#C9D2E0"), a });
  r.text("HP", tiny, x + 3, y + 8, { ...hex("#F2C14E"), a });
  r.fillRect(x + 12, y + 8, 32, 5, { ...hex("#2A303B"), a });
  const fill = o.hp > 0.5 ? hex("#3DDC84") : o.hp > 0.2 ? hex("#F2C14E") : hex("#F25555");
  r.fillRect(x + 13, y + 9, Math.round(30 * Math.max(0, Math.min(1, o.hp))), 3, { ...fill, a });
  r.fillRect(x, y + 7, 1, 8, line);
  r.fillRect(x, y + 14, 47, 1, line);
  r.fillRect(x + 47, y + 13, 1, 1, line);
}

/** A rounded progress bar; `value` 0..1. */
export function drawBar(r: Raster, o: { x: number; y: number; width: number; height: number; value: number; track?: Color; fill?: Color }): void {
  r.roundRect(o.x, o.y, o.width, o.height, Math.floor(o.height / 2), o.track ?? hex("#2A303B"));
  const w = Math.round(o.width * Math.max(0, Math.min(1, o.value)));
  if (w > 0) r.roundRect(o.x, o.y, w, o.height, Math.floor(o.height / 2), o.fill ?? hex("#FFFFFF"));
}

/** A bar filling from empty to `to` over the clip, easing out (an HP bar filling as it appears, say). */
export function barFill(o: { duration: number; x: number; y: number; width: number; height: number; to?: number; fill?: Color }): Clip {
  return clip(o.duration, (r, t) => drawBar(r, { ...o, value: (o.to ?? 1) * outCubic(t / o.duration) }));
}

/** A ring of dots chasing round: the "working on it" spinner. */
export function spinner(o: { duration: number; x: number; y: number; radius?: number; dots?: number; color?: Color; period?: number }): Clip {
  return clip(o.duration, (r, t) => {
    const dots = o.dots ?? 8;
    const radius = o.radius ?? 3;
    const head = (t / (o.period ?? MOTION.spin)) * dots;
    for (let i = 0; i < dots; i++) {
      const ang = (i / dots) * Math.PI * 2 - Math.PI / 2;
      const age = (((head - i) % dots) + dots) % dots;
      r.blend(o.x + Math.cos(ang) * radius, o.y + Math.sin(ang) * radius, o.color ?? hex("#FFFFFF"), Math.max(0.12, 1 - age / dots));
    }
  });
}

/** A live "recording" dot: a solid dot with a breathing halo. */
export function liveDot(o: { duration: number; x: number; y: number; color?: Color }): Clip {
  return clip(o.duration, (r, t) => {
    const c = o.color ?? hex("#FF4D6D");
    const k = 0.5 - 0.5 * Math.cos((t / MOTION.ambient) * Math.PI * 2 * 1.5);
    r.glow(o.x + 1.5, o.y + 1.5, 3.5, 3.5, { ...c, a: k }, 1.2);
    r.fillRect(o.x, o.y, 3, 3, c);
  });
}


// --- Handheld-RPG glyphs -----------------------------------------------------------------------------------------

/** The PKMN symbol is 10 px wide and 8 tall. */
export const PKMN_SIZE = { width: 10, height: 8 } as const;

/**
 * The handheld games' one-character "PKMN": PK stacked over MN in the tiny font, 8 rows tall. `y` is its top row;
 * beside small-font text, start it two rows above the capitals (`capTop - 2`) so it ends one row under them.
 */
export function drawPkmn(r: Raster, x: number, y: number, color: Color = hex("#FFFFFF"), alpha = 1): void {
  const tiny = font("tiny");
  const top = y - (tiny.ascent - 4);
  r.text("PK", tiny, x + 1, top, color, () => ({ alpha }));
  r.text("MN", tiny, x, top + 4, color, () => ({ alpha }));
}

/** Draws a capture ball centred on (cx, cy), tilted by `angle` radians about its base, as when it rocks. */
export function drawBall(r: Raster, cx: number, cy: number, size: number, o: { angle?: number; palette?: BallPalette; alpha?: number } = {}): void {
  const sprite = ballIcon(size, o.palette ?? BALL_GREY);
  const angle = o.angle ?? 0;
  const half = (size - 1) / 2;
  // Pivot on the bottom of the ball, so it rocks rather than spins.
  const px = cx;
  const py = cy + half;
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const reach = Math.ceil(size * 1.2);
  for (let y = Math.floor(cy - reach); y <= cy + reach; y++) {
    for (let x = Math.floor(cx - reach); x <= cx + reach; x++) {
      // Inverse-rotate the destination pixel into the sprite.
      const dx = x - px;
      const dy = y - py;
      const sx = Math.round(cos * dx + sin * dy + half);
      const sy = Math.round(-sin * dx + cos * dy + half + half);
      if (sx < 0 || sy < 0 || sx >= size || sy >= size) continue;
      const i = (sy * size + sx) * 4;
      const a = sprite.data[i + 3]!;
      if (a <= 0) continue;
      r.blend(x, y, { r: sprite.data[i]! / a, g: sprite.data[i + 1]! / a, b: sprite.data[i + 2]! / a, a }, o.alpha ?? 1);
    }
  }
}

/**
 * A capture ball rocking like one that has just caught something: a tilt one way, then the other, settling, every
 * `every` seconds. Its button blinks on each rock.
 */
export function ballShake(o: {
  duration: number;
  x: number;
  y: number;
  size?: number;
  every?: number;
  palette?: BallPalette;
  tilt?: number;
  /** Seconds to fade in from nothing. */
  fadeIn?: number;
}): Clip {
  const size = o.size ?? 9;
  const every = o.every ?? MOTION.ambient;
  const rock = MOTION.slow;
  return clip(o.duration, (r, t) => {
    const p = (t % every) / rock;
    const angle = p < 1 ? (o.tilt ?? 0.42) * Math.sin(p * Math.PI * 2) * (1 - p * 0.5) : 0;
    const alpha = o.fadeIn ? Math.min(1, t / o.fadeIn) : 1;
    drawBall(r, o.x, o.y, size, { angle, palette: o.palette, alpha });
    if (p < 1 && Math.floor(p * 4) % 2 === 1) r.glow(o.x, o.y, 1.6, 1.6, { ...hex("#FFFFFF"), a: alpha }, 1);
  });
}
