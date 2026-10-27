// HUD pieces: dialogue boxes, bars and indicators in the style of handheld games and the stock screens.

import { lerp, outCubic } from "../ease.ts";
import { font, textWidth } from "../font.ts";
import { hex, type Color, type Raster } from "../raster.ts";
import { clip, type Clip } from "../timeline.ts";

export interface DialogueStyle {
  fill: Color;
  border: Color;
  ink: Color;
  arrow: Color;
}

/** Light box, Jira-blue frame, dark ink. */
export const DIALOGUE_LIGHT: DialogueStyle = {
  fill: hex("#EEF2F8"),
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
  const cps = o.cps ?? 26;
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
    const head = (t / (o.period ?? 0.9)) * dots;
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
    const k = 0.5 + 0.5 * Math.sin(t * 6);
    r.glow(o.x + 1.5, o.y + 1.5, 3.5, 3.5, { ...c, a: k }, 1.2);
    r.fillRect(o.x, o.y, 3, 3, c);
  });
}

