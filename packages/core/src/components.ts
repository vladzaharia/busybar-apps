// Runtime components: small element builders for things a screen needs often. Each returns plain draw elements
// (send them with `device.draw`), so they mix freely with hand-placed ones. For motion beyond what elements can
// do on their own, pre-render it with @vladzaharia/bar-pixel's effects and play it with `AnimPlayer`.

import type { Device } from "./device.ts";
import { METRICS, sanitize, textWidth } from "./metrics.ts";
import type { AnimationElement, Color, Display, DisplayElement, Font, RectangleElement, TextElement } from "./types.ts";

const SIZE: Record<Display, { width: number; height: number }> = {
  front: { width: 72, height: 16 },
  // The status bar takes the right-hand 12 px of the back display.
  back: { width: 148, height: 80 },
};

/** Distance from a text element's top to the top of its capitals (every device font). */
export const CAP_TOP = 2;

/** Height of capitals in a font, i.e. what to centre on. */
export function capHeight(font: Font): number {
  return METRICS[font].ascent - CAP_TOP;
}

/**
 * Text centred in a box (the whole display by default), vertically on its capitals, which is how the stock screens
 * centre lettering.
 */
export function label(o: {
  id: string;
  text: string;
  font: Font;
  color?: Color;
  display?: Display;
  box?: { x: number; y: number; width: number; height: number };
  align?: "left" | "center" | "right";
}): TextElement {
  const display = o.display ?? "front";
  const box = o.box ?? { x: 0, y: 0, ...SIZE[display] };
  const text = sanitize(o.text);
  const w = textWidth(text, o.font);
  const x =
    o.align === "left" ? box.x : o.align === "right" ? box.x + box.width - w : box.x + Math.floor((box.width - w) / 2);
  const y = box.y + Math.floor((box.height - capHeight(o.font)) / 2) - CAP_TOP;
  return { type: "text", id: o.id, text, font: o.font, color: o.color ?? "#FFFFFFFF", x, y, display };
}

/**
 * Scrolling text, done by the firmware itself: smooth, needs no redraws, and works for text only known at
 * runtime. Text that fits is shown still.
 */
export function marquee(o: {
  id: string;
  text: string;
  font: Font;
  x: number;
  y: number;
  width: number;
  color?: Color;
  display?: Display;
  /** Pixels per second. */
  speed?: number;
  /** Pause before the first pass and between passes, in ms. */
  pause?: number;
}): TextElement {
  const text = sanitize(o.text);
  const el: TextElement = {
    type: "text",
    id: o.id,
    text,
    font: o.font,
    color: o.color ?? "#FFFFFFFF",
    x: o.x,
    y: o.y,
    width: o.width,
    display: o.display ?? "front",
  };
  if (textWidth(text, o.font) > o.width) {
    el.scroll_rate = Math.round((o.speed ?? 24) * 60);
    el.scroll_start_delay = o.pause ?? 800;
    el.scroll_repeat_delay = o.pause ?? 800;
  }
  return el;
}

/** A track and a fill; `value` is 0..1. Two elements: "<id>.track" and "<id>.fill". */
export function progressBar(o: {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  value: number;
  display?: Display;
  track?: Color;
  fill?: Color;
  radius?: number;
}): RectangleElement[] {
  const display = o.display ?? "front";
  const radius = o.radius ?? Math.floor(o.height / 2);
  const fillW = Math.round(o.width * Math.max(0, Math.min(1, o.value)));
  const rect = (id: string, width: number, color: Color, z: number): RectangleElement => ({
    type: "rectangle",
    id,
    x: o.x,
    y: o.y,
    width: Math.max(1, width),
    height: o.height,
    radius,
    fill: "solid",
    fill_colors: [color],
    border_width: 0,
    display,
    z_index: z,
  });
  const out = [rect(`${o.id}.track`, o.width, o.track ?? "#FFFFFF33", 1)];
  if (fillW > 0) out.push(rect(`${o.id}.fill`, fillW, o.fill ?? "#FFFFFFFF", 2));
  return out;
}

/**
 * A short message in a framed box that removes itself after `seconds` (the device times it out, no timer
 * needed). Drawn on top of everything else.
 */
export function toast(o: {
  id: string;
  text: string;
  display?: Display;
  seconds?: number;
  font?: Font;
  y?: number;
}): DisplayElement[] {
  const display = o.display ?? "back";
  const font = o.font ?? "small";
  const text = sanitize(o.text);
  const { width: screenW, height: screenH } = SIZE[display];
  const w = Math.min(screenW, textWidth(text, font) + 10);
  const h = capHeight(font) + 8;
  const x = Math.floor((screenW - w) / 2);
  const y = o.y ?? screenH - h - 2;
  const timeout = Math.max(1, Math.round(o.seconds ?? 2));
  return [
    {
      type: "rectangle",
      id: `${o.id}.box`,
      x,
      y,
      width: w,
      height: h,
      radius: 2,
      fill: "solid",
      fill_colors: ["#000000FF"],
      border_width: 1,
      border_color: "#FFFFFFFF",
      display,
      z_index: 90,
      timeout,
    },
    { ...label({ id: `${o.id}.text`, text, font, display, box: { x, y, width: w, height: h } }), z_index: 91, timeout },
  ];
}

/** Clips: what an app knows about each packaged animation, typically generated with the animation itself. */
export interface Clip {
  /** Path in the app's package, e.g. "animations/intro.anim". */
  path: string;
  fps: number;
  /** Section name → length in frames ("default" is the whole file). */
  sections: Record<string, number>;
}

/** Seconds a section takes to play once. */
export function sectionSeconds(clip: Clip, section = "default"): number {
  const frames = clip.sections[section];
  if (frames === undefined) throw new Error(`${clip.path}: no section "${section}"`);
  return frames / clip.fps;
}

/**
 * Plays `.anim` clips in one element. `play` switches section at once; `then` queues a section to start when the
 * current one ends, which the firmware does frame-exactly. The device holds one queued section at a time, so
 * queue at most one ahead: `play(a).then(b)`, and from a timer, later, the next.
 */
export class AnimPlayer {
  private readonly device: Device;
  private readonly base: Omit<AnimationElement, "path" | "section" | "loop" | "await_previous_end" | "stock_path">;
  private clip: Clip | null = null;

  constructor(device: Device, element: { id: string; x?: number; y?: number; display?: Display; z_index?: number }) {
    this.device = device;
    this.base = { type: "animation", x: 0, y: 0, display: "front", ...element };
  }

  /** Starts `section` of `clip` now. Returns its length in seconds. */
  play(clip: Clip, section = "default", options: { loop?: boolean } = {}): number {
    this.clip = clip;
    void this.device.draw([{ ...this.base, path: clip.path, section, loop: options.loop ?? false }]);
    return sectionSeconds(clip, section);
  }

  /** Queues `section` of the current clip to start when the playing one ends. */
  then(section: string, options: { loop?: boolean } = {}): number {
    const clip = this.clip;
    if (!clip) throw new Error("AnimPlayer.then: nothing is playing");
    void this.device.draw([{ ...this.base, path: clip.path, section, loop: options.loop ?? false, await_previous_end: true }]);
    return sectionSeconds(clip, section);
  }

  /** Removes the element. */
  stop(): Promise<void> {
    this.clip = null;
    return this.device.clear([this.base.id]);
  }
}

/**
 * A set of elements redrawn over time whose make-up can change, such as a clock face switching style. Each draw
 * clears the ids the previous draw had and this one doesn't. The bar refuses a clear that names an id it doesn't
 * have (and then clears nothing), so only ids drawn here are ever cleared.
 */
export class LiveFace {
  private readonly device: Device;
  private readonly coalesce: string | undefined;
  private ids = new Set<string>();

  constructor(device: Device, coalesce?: string) {
    this.device = device;
    this.coalesce = coalesce;
  }

  draw(elements: DisplayElement[]): void {
    const next = new Set(elements.map((e) => e.id));
    const stale = [...this.ids].filter((id) => !next.has(id));
    this.ids = next;
    if (stale.length) void this.device.clear(stale);
    void this.device.draw(elements, { coalesce: this.coalesce });
  }
}
