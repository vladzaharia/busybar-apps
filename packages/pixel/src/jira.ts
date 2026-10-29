// The Jira mark as hand-placed pixel art. Scaled down from the SVG, the 3.8 px step between the chevrons lands
// between pixels, so each chevron snaps differently and the top one comes out a pixel larger. Here one chevron
// is drawn once per size and stamped three times at whole-pixel offsets, so all three are identical.

import { fileURLToPath } from "node:url";
import { lerp, outCubic, span } from "./ease.ts";
import { Mask } from "./mask.ts";
import { hex, Raster, type BlendMode, type Color } from "./raster.ts";
import { clip, type Clip } from "./timeline.ts";

export interface MarkSprite {
  /** Overall size of the square mark. */
  size: number;
  /** One chevron, row-major: "#" is lit. */
  chevron: string[];
  /** Top-left of each chevron within the mark: top, middle, bottom. */
  offsets: [number, number][];
}

/** Chevron: a bar along the top, rounded at its lower-left, turning down a column on the right that tapers out. */
export const MARK_SPRITES: Record<number, MarkSprite> = {
  16: {
    size: 16,
    chevron: [
      "########",
      "########",
      ".#######",
      ".....###",
      ".....###",
      ".....###",
      "......##",
      ".......#",
    ],
    offsets: [
      [8, 0],
      [4, 4],
      [0, 8],
    ],
  },
  12: {
    size: 12,
    chevron: [
      "######",
      ".#####",
      "....##",
      "....##",
      "....##",
      ".....#",
    ],
    offsets: [
      [6, 0],
      [3, 3],
      [0, 6],
    ],
  },
  11: {
    size: 11,
    chevron: [
      "#####",
      ".####",
      "...##",
      "...##",
      "....#",
    ],
    offsets: [
      [6, 0],
      [3, 3],
      [0, 6],
    ],
  },
};

// --- Optical centre ----------------------------------------------------------------------------------------------

/**
 * Where the mark's weight sits, in px from its top-left (a pixel's centre is at +0.5): the centroid of its lit pixels.
 * It is right of and above the box centre (each chevron has its bar on top and its column on the right), so a mark
 * centred by its box looks pushed up and to the right. Computed from `MARK_SPRITES`, so it follows any edit to them.
 */
export const MARK_OPTICAL_CENTRE: Record<11 | 12 | 16, { x: number; y: number }> = Object.fromEntries(
  ([11, 12, 16] as const).map((size) => {
    const sprite = MARK_SPRITES[size]!;
    let n = 0;
    let sx = 0;
    let sy = 0;
    for (const [ox, oy] of sprite.offsets) {
      sprite.chevron.forEach((row, ry) =>
        [...row].forEach((c, rx) => {
          if (c !== "#") return;
          n++;
          sx += ox + rx + 0.5;
          sy += oy + ry + 0.5;
        }),
      );
    }
    return [size, { x: sx / n, y: sy / n }];
  }),
) as Record<11 | 12 | 16, { x: number; y: number }>;

/**
 * Where to put the top-left of a `size` mark so that its optical centre is the centre of `box`, on whole pixels and at
 * least `pad` px from the box's edges (if the box is too small for that, the left and top padding win).
 */
export function jiraMarkIn(
  box: { x: number; y: number; width: number; height: number },
  size: 11 | 12 | 16,
  pad = 1,
): { x: number; y: number } {
  const at = MARK_OPTICAL_CENTRE[size];
  const fit = (start: number, extent: number, centre: number) =>
    Math.max(start + pad, Math.min(start + extent - size - pad, Math.round(start + extent / 2 - centre)));
  return { x: fit(box.x, box.width, at.x), y: fit(box.y, box.height, at.y) };
}

// --- Drawing -----------------------------------------------------------------------------------------------------

/** Jira's blues, one per chevron (top, middle, bottom). */
export const JIRA_TONES: Color[] = [hex("#4C9AFF"), hex("#2684FF"), hex("#0065FF")];
/** For drawing the mark on a blue panel. */
export const JIRA_TONES_WHITE: Color[] = [hex("#FFFFFF"), hex("#DCEBFF"), hex("#AFCFFF")];

let chevrons: Mask[] | null = null;
function masks(): Mask[] {
  chevrons ??= ["top", "mid", "bottom"].map((n) => Mask.load(fileURLToPath(new URL(`../logos/jira_chevron_${n}.png`, import.meta.url))));
  return chevrons;
}

/** Per-chevron placement, to animate the mark piece by piece. */
export interface ChevronPose {
  dx?: number;
  dy?: number;
  /** Scale about the mark's centre; anything but 1 draws the smooth vector shape instead of the sprite. */
  scale?: number;
  alpha?: number;
  color?: Color;
}

/** The Jira mark at (x, y) in a `size`² box: the pixel sprite at rest, the vector shape while scaling. */
export function drawJiraMark(
  r: Raster,
  x: number,
  y: number,
  size: number,
  o: { poses?: ChevronPose[]; tones?: Color[]; mode?: BlendMode } = {},
): void {
  const tones = o.tones ?? JIRA_TONES;
  const sprite = MARK_SPRITES[size];
  for (let i = 2; i >= 0; i--) {
    const p = o.poses?.[i] ?? {};
    const color = p.color ?? tones[i]!;
    if (sprite && (p.scale ?? 1) === 1) {
      const [ox, oy] = sprite.offsets[i]!;
      stamp(r, sprite.chevron, Math.round(x + ox + (p.dx ?? 0)), Math.round(y + oy + (p.dy ?? 0)), color, p.alpha ?? 1, o.mode);
      continue;
    }
    const s = size * (p.scale ?? 1);
    const cx = x + size / 2 + (p.dx ?? 0);
    const cy = y + size / 2 + (p.dy ?? 0);
    masks()[i]!.paint(r, cx - s / 2, cy - s / 2, s, { ...color, a: color.a * (p.alpha ?? 1) }, o.mode ?? "over", 3);
  }
}

/**
 * The mark's chevrons flying in one after another, from huge at `from` (the screen's centre by default) down to
 * the mark at rest, each landing with a flash. Then the mark stays; `hops` are times at which it does a little hop.
 */
export function jiraFlyIn(o: {
  x: number;
  y: number;
  size: number;
  duration: number;
  from?: { x: number; y: number };
  hops?: number[];
  tones?: Color[];
  flash?: Color;
}): Clip {
  return clip(o.duration, (r, t) => {
    const from = o.from ?? { x: r.width / 2, y: r.height / 2 };
    const poses: ChevronPose[] = [0, 1, 2].map((i) => {
      const p = span(t, 0.4 + i * 0.1, 0.85 + i * 0.1);
      const e = outCubic(p);
      let dy = lerp(from.y - (o.y + o.size / 2), 0, e);
      for (const at of o.hops ?? []) {
        const hop = span(t, at + i * 0.05, at + 0.35 + i * 0.05);
        if (hop > 0 && hop < 1) dy -= Math.sin(hop * Math.PI) * 2;
      }
      return { dx: lerp(from.x - (o.x + o.size / 2), 0, e), dy, scale: p >= 1 ? 1 : lerp(5, 1, e), alpha: p > 0 ? Math.min(1, p * 3) : 0 };
    });
    drawJiraMark(r, o.x, o.y, o.size, { poses, tones: o.tones });
    // The landing flash is centred on the mark's weight, not on its box.
    const centre = MARK_OPTICAL_CENTRE[o.size as 11 | 12 | 16] ?? { x: o.size / 2, y: o.size / 2 };
    for (let i = 0; i < 3; i++) {
      const land = span(t, 0.85 + i * 0.1, 1.1 + i * 0.1);
      if (land > 0 && land < 1) r.glow(o.x + centre.x, o.y + centre.y, 9, 7, { ...(o.flash ?? hex("#85B8FF")), a: 0.8 * (1 - land) }, 2);
    }
  });
}

/** The Jira ticket is 22 px wide and 13 tall. */
export const TICKET_SIZE = { width: 22, height: 13 } as const;

// An issue card as on a Jira board: room for the 11 px mark on the left, two summary lines level with the mark's top
// (rows 1 and 3, starting two columns clear of it), the Task type's checkbox under them with a row to spare above the
// shadow, and a shadow along the bottom. The tick stays inside the checkbox's frame.
const TICKET = [
  ".WWWWWWWWWWWWWWWWWWWW.",
  "WWWWWWWWWWWWWWgggggggW",
  "WWWWWWWWWWWWWWWWWWWWWW",
  "WWWWWWWWWWWWWWgggggWWW",
  "WWWWWWWWWWWWWWWWWWWWWW",
  "WWWWWWWWWWWWWWWWWWWWWW",
  "WWWWWWWWWWWWWWbbbbbWWW",
  "WWWWWWWWWWWWWWbbbwbWWW",
  "WWWWWWWWWWWWWWbwbwbWWW",
  "WWWWWWWWWWWWWWbbwbbWWW",
  "WWWWWWWWWWWWWWbbbbbWWW",
  "WWWWWWWWWWWWWWWWWWWWWW",
  ".ssssssssssssssssssss.",
];

const TICKET_PALETTE: Record<string, Color> = {
  // Softer than white: a block of white LEDs is glaring.
  W: hex("#DCE3EE"),
  s: hex("#9AA7BA"),
  g: hex("#6B778C"),
  b: hex("#4BADE8"),
  w: hex("#FFFFFF"),
};

/**
 * A Jira ticket: an issue card with the mark on it, summary lines and the Task checkbox, top-left at (x, y).
 * `sheen` 0..1 sweeps a diagonal shine across it, left to right.
 */
export function drawJiraTicket(r: Raster, x: number, y: number, o: { alpha?: number; sheen?: number } = {}): void {
  x = Math.round(x);
  y = Math.round(y);
  const alpha = o.alpha ?? 1;
  stampPalette(r, TICKET, x, y, TICKET_PALETTE, alpha);
  drawJiraMark(r, x + 1, y + 1, 11, { poses: [0, 1, 2].map(() => ({ alpha })) });
  if (o.sheen === undefined || o.sheen <= 0 || o.sheen >= 1) return;
  const at = lerp(-4, TICKET_SIZE.width + TICKET_SIZE.height + 4, o.sheen);
  TICKET.forEach((row, ry) =>
    [...row].forEach((c, rx) => {
      const d = Math.abs(rx + ry - at);
      if (c !== "." && d < 2.5) r.blend(x + rx, y + ry, hex("#FFFFFF"), (1 - d / 2.5) * 0.7 * alpha);
    }),
  );
}

// --- The ticket with a face ---------------------------------------------------------------------------------------

export type TicketEyes = "open" | "shut" | "big" | "happy";
export type TicketMouth = "smile" | "open";

const FACE = { card: hex("#DCE3EE"), ink: hex("#141820"), blush: hex("#FF8FA3"), glint: hex("#FFFFFF") };

/**
 * The Jira ticket as a character, as a 22 × 13 sprite: its mark, and a face where the summary lines and checkbox
 * were. Eyes open, shut (a blink), big (puppy eyes, with a glint) or happy (^ ^); a smile or an open mouth (talking);
 * blush either side. Draw it with `drawTicketFace`, or squash and stretch it with `drawStretched`.
 */
export function ticketFace(o: { eyes?: TicketEyes; mouth?: TicketMouth } = {}): Raster {
  const r = new Raster(TICKET_SIZE.width, TICKET_SIZE.height);
  drawJiraTicket(r, 0, 0);
  // The face covers the lines and checkbox: columns 13 to 20, rows 1 to 11 (inside the card's edge and shadow).
  r.fillRect(13, 1, 8, 11, FACE.card);
  const eyes = o.eyes ?? "open";
  for (const ex of [14, 18]) {
    if (eyes === "open") r.fillRect(ex, 3, 2, 3, FACE.ink);
    else if (eyes === "shut") r.fillRect(ex, 5, 2, 1, FACE.ink);
    else if (eyes === "big") {
      r.fillRect(ex, 2, 2, 4, FACE.ink);
      r.blend(ex, 3, FACE.glint);
    } else {
      const x = ex === 14 ? 13 : 18;
      r.blend(x, 5, FACE.ink);
      r.blend(x + 1, 4, FACE.ink);
      r.blend(x + 2, 5, FACE.ink);
    }
  }
  r.fillRect(13, 7, 2, 1, FACE.blush);
  r.fillRect(19, 7, 2, 1, FACE.blush);
  if ((o.mouth ?? "smile") === "smile") {
    r.blend(15, 8, FACE.ink);
    r.fillRect(16, 9, 2, 1, FACE.ink);
    r.blend(18, 8, FACE.ink);
  } else {
    r.fillRect(16, 8, 2, 1, FACE.ink);
    r.fillRect(16, 9, 2, 1, FACE.blush);
  }
  return r;
}

/** The ticket with a face (`ticketFace`), top-left at (x, y). */
export function drawTicketFace(r: Raster, x: number, y: number, o: { eyes?: TicketEyes; mouth?: TicketMouth; alpha?: number } = {}): void {
  r.draw(ticketFace(o), Math.round(x), Math.round(y), o.alpha ?? 1);
}

/** Stamps string pixel art ("#" lit, anything else empty) in one colour. */
export function stamp(r: Raster, art: string[], x: number, y: number, color: Color, alpha = 1, mode: BlendMode = "over"): void {
  art.forEach((row, ry) => [...row].forEach((c, rx) => c === "#" && r.blend(x + rx, y + ry, color, alpha, mode)));
}

/**
 * Stamps multi-colour pixel art: each character maps to a colour in `palette`; unmapped characters stay empty. `flip`
 * mirrors it left to right within its own width (the widest row), so art drawn facing right faces left.
 */
export function stampPalette(r: Raster, art: readonly string[], x: number, y: number, palette: Record<string, Color>, alpha = 1, flip = false): void {
  const w = flip ? Math.max(...art.map((row) => row.length)) : 0;
  art.forEach((row, ry) => [...row].forEach((c, rx) => palette[c] && r.blend(x + (flip ? w - 1 - rx : rx), y + ry, palette[c]!, alpha)));
}
