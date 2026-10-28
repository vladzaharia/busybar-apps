// Sprints: which one is running and how many work days it has left, and clock faces that show it.
//
// A sprint is `weeks` long and starts on the same weekday as the reference sprint; work days are Monday to Friday.
// "Days left" counts today while it is a work day, so the last day of a sprint says 1.

import { clockFace, dateLine, type ClockOptions } from "./clock.ts";
import { textWidth } from "./metrics.ts";
import type { DisplayElement, RectangleElement, TextElement } from "./types.ts";

export interface SprintConfig {
  /** A known sprint's number... */
  number: number;
  /** ...and its first day, "YYYY-MM-DD". */
  start: string;
  /** Weeks per sprint. */
  weeks: number;
}

export interface Sprint {
  number: number;
  /** First and last calendar day (midnight). */
  start: Date;
  end: Date;
  /** Work days in the sprint. */
  days: number;
  /** Work days already finished before today. */
  done: number;
  /** Work days left, counting today if it is one. */
  left: number;
  /** Whether today is a work day. */
  workday: boolean;
}

const DAY = 864e5;
const midnight = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const isWorkday = (d: Date) => d.getDay() >= 1 && d.getDay() <= 5;

/** "2026-10-22" as local midnight, or null if it isn't a real date. */
export function parseDate(s: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s.trim());
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return d.getMonth() === Number(m[2]) - 1 && d.getDate() === Number(m[3]) ? d : null;
}

/** Whole days from a to b, counted on calendar dates (so daylight-saving changes don't matter). */
const daysBetween = (a: Date, b: Date) => Math.round((Date.UTC(b.getFullYear(), b.getMonth(), b.getDate()) - Date.UTC(a.getFullYear(), a.getMonth(), a.getDate())) / DAY);
const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);

/** The sprint running on `now`'s date. Before the reference sprint, counts back. */
export function sprintAt(now: Date, cfg: SprintConfig): Sprint {
  const base = parseDate(cfg.start) ?? midnight(now);
  const length = Math.max(1, Math.round(cfg.weeks)) * 7;
  const index = Math.floor(daysBetween(base, now) / length);
  const start = addDays(base, index * length);
  const today = midnight(now).getTime();
  let days = 0;
  let done = 0;
  for (let i = 0; i < length; i++) {
    const d = addDays(start, i);
    if (!isWorkday(d)) continue;
    days++;
    if (d.getTime() < today) done++;
  }
  return { number: cfg.number + index, start, end: addDays(start, length - 1), days, done, left: days - done, workday: isWorkday(now) };
}

/** "6 days left", "1 day left". */
export const daysLeftText = (s: Sprint) => (s.left === 1 ? "1 day left" : `${s.left} days left`);

// --- Clock faces -------------------------------------------------------------------------------------------------

export type SprintStyle = "plain" | "bar" | "dots" | "majora";

export interface SprintClockOptions extends ClockOptions {
  style: SprintStyle;
  /** For "majora": the path of the moon image at each size, 7 to 15 px (e.g. s => `images/moon${s}.png`). */
  moon?: (size: number) => string;
}

const WHITE = "#FFFFFFFF";
const DONE_BAR = "#1A3C70FF";
const TO_GO = "#2F86FFFF";
const DONE_DOT = "#FFFFFF33";
const TODAY_DIM = "#FFFFFF55";
/** The small font's capitals start this far below an element's top, as clockFace places the line under the time. */
const CAP_TOP = 2;

/** The moon grows from 7 px at the start of a sprint to 15 px on its last day. */
export const moonSize = (s: Sprint) => Math.round(7 + (s.days > 1 ? (s.done / (s.days - 1)) * 8 : 8));

const rect = (id: string, x: number, y: number, width: number, height: number, color: string): RectangleElement => ({
  type: "rectangle",
  id,
  x,
  y,
  width,
  height,
  radius: 0,
  fill: "solid",
  fill_colors: [color],
  border_width: 0,
  display: "front",
});

/**
 * The clock with the sprint, at `now`. Redraw it once a second, as the plain clock: the line under the time changes
 * every 4 s in "bar", and today's segment or dot blinks.
 *   plain  — the stock clock.
 *   bar    — a segment per work day along the bottom edge (done, today blinking, to go); the line under the time
 *            alternates the date and "Sprint N".
 *   dots   — the date stays on the calendar; under the time, "SN" and a dot per work day.
 *   majora — a moon in place of the calendar, growing as the sprint runs out; "N Days Remain" under the time.
 */
export function sprintClockFace(now: Date, sprint: Sprint, o: SprintClockOptions): DisplayElement[] {
  const p = o.prefix ?? "clock.";
  const blink = now.getSeconds() % 2 === 0;
  if (o.style === "bar") {
    const lines = [dateLine(now), `Sprint ${sprint.number}`];
    const which = Math.floor(now.getTime() / 4000) % 2;
    const out = clockFace(now, { ...o, sub: lines[which], reserve: Math.max(...lines.map((l) => textWidth(l, "small"))), dy: -1 });
    const seg = Math.max(1, Math.floor((72 + 1) / sprint.days) - 1);
    const x0 = Math.floor((72 - (sprint.days * (seg + 1) - 1)) / 2);
    for (let i = 0; i < sprint.days; i++) {
      const today = sprint.workday && i === sprint.done;
      const c = i < sprint.done ? DONE_BAR : today ? (blink ? WHITE : TO_GO) : TO_GO;
      out.push(rect(`${p}seg${i}`, x0 + i * (seg + 1), 15, seg, 1, c));
    }
    return out;
  }
  if (o.style === "dots") {
    const label = `S${sprint.number}`;
    const dotsW = sprint.days * 3 - 1;
    const out = clockFace(now, { ...o, sub: label, reserve: textWidth(label, "small") + 3 + dotsW });
    const sub = out.find((e) => e.id === `${p}sub`) as TextElement;
    const x0 = (sub.x ?? 0) + textWidth(label, "small") + 3;
    const cap = (sub.y ?? 0) + CAP_TOP;
    for (let i = 0; i < sprint.days; i++) {
      const today = sprint.workday && i === sprint.done;
      const c = i < sprint.done ? DONE_DOT : today ? (blink ? WHITE : TODAY_DIM) : TO_GO;
      out.push(rect(`${p}dot${i}`, x0 + i * 3, cap + 2, 2, 2, c));
    }
    return out;
  }
  if (o.style === "majora") {
    const size = moonSize(sprint);
    const sub = sprint.left <= 1 ? "Final Day" : `${sprint.left} Days Remain`;
    const out = clockFace(now, { ...o, showDate: true, sub, iconLabel: null });
    const icon = out.find((e) => e.id === `${p}icon`);
    if (icon && icon.type === "image" && o.moon) {
      // Centre the moon where the calendar was (13 x 14 at its x, y).
      Object.assign(icon, { path: o.moon(size), x: (icon.x ?? 0) + Math.round((13 - size) / 2), y: (icon.y ?? 0) + Math.round((14 - size) / 2) });
    }
    return out;
  }
  return clockFace(now, o);
}
