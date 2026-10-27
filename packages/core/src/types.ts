// Draw API element types, per the BUSY Bar HTTP API (`POST /api/display/draw`).

/** Draw API font names. */
export type Font = "tiny" | "small" | "normal" | "condensed" | "bold" | "large" | "extra_large" | "superscript";

export type Display = "front" | "back";

export type Align =
  | "top_left"
  | "top_mid"
  | "top_right"
  | "mid_left"
  | "center"
  | "mid_right"
  | "bottom_left"
  | "bottom_mid"
  | "bottom_right";

/** `#RRGGBBAA`. */
export type Color = string;

interface Base {
  /** Elements are replaced by id: drawing an existing id updates it in place. */
  id: string;
  x?: number;
  y?: number;
  display?: Display;
  align?: Align;
  /** Higher draws on top. */
  z_index?: number;
  /** Seconds until the device removes the element on its own. */
  timeout?: number;
}

export interface TextElement extends Base {
  type: "text";
  /** Printable ASCII only. */
  text: string;
  font: Font;
  color?: Color;
  width?: number;
  /** Pixels per minute; scrolls the text when it is wider than `width`. */
  scroll_rate?: number;
  scroll_start_delay?: number;
  scroll_repeat_delay?: number;
}

/** An image from the app's package (`path`, e.g. "images/icon.png") or the device's stock assets (`stock_path`). */
export type ImageElement = Base & { type: "image"; opacity?: number } & ({ path: string } | { stock_path: string });

/**
 * A `.anim` player. Re-drawing the same id with the same path keeps the player and switches section: at once,
 * or after the current section ends with `await_previous_end` (the device holds one such pending request).
 */
export type AnimationElement = Base & {
  type: "animation";
  /** Section to play; "default" is the whole file. */
  section?: string;
  loop?: boolean;
  await_previous_end?: boolean;
  opacity?: number;
} & ({ path: string } | { stock_path: string });

export interface RectangleElement extends Base {
  type: "rectangle";
  width: number;
  height: number;
  radius?: number;
  fill?: "none" | "solid" | "gradient_h" | "gradient_v";
  fill_colors?: [Color] | [Color, Color];
  border_width?: number;
  border_color?: Color;
}

export type DisplayElement = TextElement | ImageElement | AnimationElement | RectangleElement;

export interface InputEvent {
  key: "encoder" | "ok" | "start" | "back";
  action: "press" | "release" | "short" | "long" | "repeat" | "clockwise" | "counterclockwise";
  delta?: 1 | -1;
}
