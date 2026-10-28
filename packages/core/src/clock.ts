// A clock face laid out like the stock Clock app: calendar icon with the day, the time in bold, and the month and
// weekday dimmed underneath. Apps that show the time between their own screens use this, so the bar looks the
// same as it does in the built-in clock.

import { METRICS, textWidth } from "./metrics.ts";
import type { DisplayElement, Font, TextElement } from "./types.ts";

export interface ClockOptions {
  timeFormat: "24h" | "12h";
  showDate: boolean;
  /** Dim the colons on odd seconds. Needs a redraw every second. */
  blinkColons: boolean;
  /** The 13×14 calendar icon in the app's package, e.g. "images/calendar.png". */
  icon: string;
  /** Element id prefix, so the face can live beside the app's other elements. */
  prefix?: string;
  /** Text for the line under the time instead of the date (shown even when `showDate` is off). */
  sub?: string;
  /** Lay out as if the line under the time were this wide, so a changing line never shifts the clock. */
  reserve?: number;
  /** Rows to move the whole face down (negative: up). */
  dy?: number;
  /** The number on the calendar icon instead of the day of the month; null leaves the page blank. */
  iconLabel?: string | null;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const SCREEN_W = 72;
const SCREEN_H = 16;
const ICON = { width: 13, height: 14 };
/** Distance from an element's top to the top of its capitals. */
const CAP_TOP = 2;
const TIME_H = METRICS.bold.ascent - CAP_TOP;
const SUB_H = METRICS.small.ascent - CAP_TOP;
const SUFFIX_GAP = 1;
/** Space between the calendar and the time; wider than the stock clock's 2 px, for breathing room. */
const ICON_GAP = 4;
const LINE_GAP = 2;
const DAY_OFFSET = { dx: 1, dy: 7 };

const WHITE = "#FFFFFFFF";
const DIMMED = "#FFFFFF7F";
const BLINKED = "#FFFFFF66";
const DAY_COLOR = "#323232FF";

const pad = (n: number) => String(n).padStart(2, "0");
const center = (size: number, space: number) => Math.max(0, Math.floor((space - size) / 2));

/** The stock date line: "Oct, Wed". */
export const dateLine = (d: Date) => `${MONTHS[d.getMonth()]}, ${DAYS[d.getDay()]}`;

/** The time as digits and colons, plus a separate AM/PM suffix in 12-hour format. */
export function formatTime(d: Date, format: ClockOptions["timeFormat"]): { time: string; suffix: string } {
  if (format === "12h") {
    const h = d.getHours() % 12 || 12;
    return { time: `${h}:${pad(d.getMinutes())}`, suffix: d.getHours() < 12 ? "AM" : "PM" };
  }
  return { time: `${pad(d.getHours())}:${pad(d.getMinutes())}`, suffix: "" };
}

/** Elements for the clock face at `now`, for the front display. Every id is stable, so redraws update in place. */
export function clockFace(now: Date, o: ClockOptions): DisplayElement[] {
  const p = o.prefix ?? "clock.";
  const text = (id: string, value: string, font: Font, color: string, x: number, y: number): TextElement => ({
    type: "text",
    id: p + id,
    text: value,
    font,
    color,
    x,
    y,
    display: "front",
  });

  const { time, suffix } = formatTime(now, o.timeFormat);
  const sub = o.sub ?? (o.showDate ? dateLine(now) : "");
  const dim = o.blinkColons && now.getSeconds() % 2 === 1;

  const timeW = textWidth(time, "bold") + (suffix ? SUFFIX_GAP + textWidth(suffix, "small") : 0);
  const width = Math.max(timeW, textWidth(sub, "small"), o.reserve ?? 0);
  const height = sub ? TIME_H + LINE_GAP + SUB_H : TIME_H;
  const iconSpace = o.showDate ? ICON.width + ICON_GAP : 0;
  const left = center(iconSpace + width, SCREEN_W);
  const top = center(height, SCREEN_H) + (o.dy ?? 0);
  let x = left + iconSpace;

  const out: DisplayElement[] = [];
  if (o.showDate) {
    const iconY = center(ICON.height, SCREEN_H) + (o.dy ?? 0);
    const day = o.iconLabel === undefined ? String(now.getDate()) : o.iconLabel;
    out.push({ type: "image", id: `${p}icon`, path: o.icon, x: left, y: iconY, display: "front" });
    if (day !== null) {
      const dayX = left + center(textWidth(day, "superscript"), ICON.width) + DAY_OFFSET.dx;
      out.push(text("day", day, "superscript", DAY_COLOR, dayX, iconY + DAY_OFFSET.dy - CAP_TOP));
    }
  }

  // Digits and colons are separate elements, so a colon can blink without the digits moving.
  const parts = time.split(":");
  parts.forEach((part, i) => {
    if (i > 0) {
      out.push(text(`colon${i}`, ":", "bold", dim ? BLINKED : WHITE, x, top - CAP_TOP));
      x += textWidth(":", "bold");
    }
    out.push(text(`time${i}`, part, "bold", WHITE, x, top - CAP_TOP));
    x += textWidth(part, "bold");
  });
  if (suffix) {
    out.push(text("suffix", suffix, "small", WHITE, x + SUFFIX_GAP, top - CAP_TOP + METRICS.bold.ascent - METRICS.small.ascent));
  }
  if (sub) out.push(text("sub", sub, "small", DIMMED, left + iconSpace, top + TIME_H + LINE_GAP - CAP_TOP));
  return out;
}

/** Every id `clockFace` can produce, for clearing the face or the parts a new layout no longer uses. */
export function clockIds(prefix = "clock."): string[] {
  return ["icon", "day", "time0", "colon1", "time1", "suffix", "sub"].map((id) => prefix + id);
}
