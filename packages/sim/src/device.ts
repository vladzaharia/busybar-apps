// The emulated device: the canvas service behind `POST/DELETE /api/display/draw`, animation players that follow the
// firmware's section rules, and the other endpoints an app may call. Mirrors `applications/services/canvas` and
// `lib/anim_file` in the firmware:
// - elements are kept by id; drawing an existing id updates it in place (type and display must match);
// - elements are drawn in z_index order; `timeout` removes an element after that many seconds;
// - an animation re-drawn with the same path keeps its player and switches section: at once, or, with
//   `await_previous_end`, when the current section reaches its last frame (one request can wait at a time; a newer
//   one replaces it); a section that ends without `loop` or a waiting request holds its last frame.

import { AnimReader } from "@vladzaharia/bar-pixel/anim";
import { Screen, fontMetrics, parseColor, textWidth, type RGBA } from "./screen.ts";

export type DisplayId = "front" | "back";
export const DISPLAY_SIZE: Record<DisplayId, { width: number; height: number }> = {
  front: { width: 72, height: 16 },
  back: { width: 148, height: 80 },
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Json = Record<string, any>;

interface Range {
  start: number;
  end: number;
  loop: boolean;
}

/** One `.anim` playing in an element. */
class AnimPlayer {
  path: string;
  reader: AnimReader;
  active: Range;
  pending: Range | null = null;
  frame: number;
  finished = false;
  private acc = 0;

  constructor(path: string, reader: AnimReader, section: Range) {
    this.path = path;
    this.reader = reader;
    this.active = section;
    this.frame = section.start;
  }

  /** Firmware rule: wait for the end only if asked to and not already on the last frame. */
  request(range: Range, awaitEnd: boolean): void {
    if (awaitEnd && !(this.frame === this.active.end)) {
      this.pending = range;
    } else {
      this.active = range;
      this.frame = range.start;
      this.pending = null;
      this.finished = false;
      this.acc = 0;
    }
  }

  advance(dt: number): void {
    this.acc += dt * this.reader.fps;
    while (this.acc >= 1) {
      this.acc -= 1;
      if (this.frame === this.active.end) {
        if (this.pending) {
          this.active = this.pending;
          this.pending = null;
          this.frame = this.active.start;
          this.finished = false;
        } else if (this.active.loop) {
          this.frame = this.active.start;
        } else {
          this.finished = true;
          this.acc = 0;
          return;
        }
      } else {
        this.frame++;
      }
    }
  }

  pixels(): Uint8Array {
    return this.reader.frame(this.frame);
  }
}

interface Element {
  id: string;
  type: string;
  display: DisplayId;
  spec: Json;
  z: number;
  expires: number | null;
  createdAt: number;
  player?: AnimPlayer;
}

export interface DeviceHooks {
  /** Fetches a file from the app's package (animations/, images/). */
  asset(path: string): Promise<Uint8Array>;
  /** Decodes a PNG to straight RGBA. */
  decodePng(bytes: Uint8Array): Promise<{ width: number; height: number; data: Uint8ClampedArray }>;
  /** The app's current settings values. */
  settings(): Json;
  /** Called for every API request, for the activity log. */
  log(line: string): void;
}

export class Device {
  readonly screens: Record<DisplayId, Screen> = { front: new Screen(72, 16), back: new Screen(148, 80) };
  private elements = new Map<string, Element>();
  private readers = new Map<string, Promise<Uint8Array>>();
  private images = new Map<string, { width: number; height: number; data: Uint8ClampedArray } | null>();
  private readonly hooks: DeviceHooks;
  private now = 0;

  constructor(hooks: DeviceHooks) {
    this.hooks = hooks;
  }

  /** Whether the app has anything on the back display (otherwise the firmware mirrors the front there). */
  hasBack(): boolean {
    for (const e of this.elements.values()) if (e.display === "back") return true;
    return false;
  }

  reset(): void {
    this.elements.clear();
  }

  // --- HTTP API ---------------------------------------------------------------------------------------------------

  /** Handles a request the app sent to http://localhost/api/... */
  async handle(method: string, path: string, body: string | null): Promise<{ status: number; json: unknown }> {
    const [route, query = ""] = path.split("?");
    const q = new URLSearchParams(query);
    try {
      if (route === "/display/draw" && method === "POST") return await this.draw(JSON.parse(body ?? "{}"));
      if (route === "/display/draw" && method === "DELETE") return this.clear(body ? JSON.parse(body) : {}, q.get("application_name"));
      if (route === "/apps/settings" && method === "GET") return { status: 200, json: { version: 1, values: this.hooks.settings() } };
      if (route === "/time" && method === "GET") return { status: 200, json: { timestamp: new Date().toISOString() } };
      if (route === "/display/brightness") return { status: 200, json: { front: "auto", back: "auto" } };
      if (route === "/audio/play" || route === "/audio/volume") return { status: 200, json: { result: "OK" } };
      if (route?.startsWith("/status") || route === "/version" || route === "/name" || route === "/wifi/status") {
        return { status: 200, json: { result: "OK", simulated: true } };
      }
      this.hooks.log(`${method} ${route} → 403 (not available to apps)`);
      return { status: 403, json: { error: "Not available to apps", code: 403 } };
    } catch (e) {
      this.hooks.log(`${method} ${route} → 400 ${(e as Error).message}`);
      return { status: 400, json: { error: (e as Error).message, code: 400 } };
    }
  }

  private async draw(req: Json): Promise<{ status: number; json: unknown }> {
    const list: Json[] = Array.isArray(req.elements) ? req.elements : [];
    if (!req.application_name) throw new Error("application_name is required");
    if (!list.length) throw new Error("elements must not be empty");
    // Load anything the elements need first, so the whole request applies at once, as on the device.
    for (const spec of list) {
      if (spec.type === "animation" && spec.path) await this.reader(spec.path);
      if (spec.type === "image" && spec.path) await this.image(spec.path);
    }
    for (const spec of list) this.apply(spec);
    if (this.elements.size > 100) throw new Error("too many elements (100 max)");
    this.hooks.log(`POST draw: ${list.map((e) => describe(e)).join(", ")}`);
    return { status: 200, json: { result: "OK" } };
  }

  private apply(spec: Json): void {
    const id = String(spec.id);
    const display: DisplayId = spec.display === "back" ? "back" : "front";
    const old = this.elements.get(id);
    if (old && (old.type !== spec.type || old.display !== display)) throw new Error(`element ${id} changed type or display`);
    // `timeout` 0 means no timeout; a `display_until` already in the past removes the element.
    const timeout = Number(spec.timeout ?? 0);
    const until = spec.display_until !== undefined ? Number(spec.display_until) * 1000 - Date.now() : null;
    if (until !== null && until <= 0) {
      this.elements.delete(id);
      return;
    }
    const life = timeout > 0 ? timeout * 1000 : (until ?? 0);
    const el: Element = old ?? { id, type: spec.type, display, spec, z: 0, expires: null, createdAt: this.now };
    el.spec = spec;
    el.z = Number(spec.z_index ?? 0);
    el.expires = life > 0 ? this.now + life / 1000 : old && spec.timeout === undefined ? old.expires : null;
    if (spec.type === "animation") this.applyAnimation(el, spec);
    if (!old) el.createdAt = this.now;
    this.elements.set(id, el);
  }

  private applyAnimation(el: Element, spec: Json): void {
    const path = String(spec.path ?? spec.stock_path);
    const bytes = this.loaded.get(path);
    if (!bytes) return;
    const name = spec.section ?? "default";
    if (!el.player || el.player.path !== path) {
      const reader = new AnimReader(bytes);
      const s = reader.section(name);
      if (!s) throw new Error(`${path}: no section "${name}"`);
      el.player = new AnimPlayer(path, reader, { start: s.start, end: s.end, loop: !!spec.loop });
      return;
    }
    const s = el.player.reader.section(name);
    if (!s) throw new Error(`${path}: no section "${name}"`);
    el.player.request({ start: s.start, end: s.end, loop: !!spec.loop }, !!spec.await_previous_end);
  }

  private clear(body: Json, app: string | null): { status: number; json: unknown } {
    const ids: string[] | undefined = body.element_ids;
    if (ids) {
      const missing = ids.filter((id) => !this.elements.has(id));
      if (missing.length) {
        this.hooks.log(`DELETE draw: no element ${missing.join(", ")} → 400`);
        return { status: 400, json: { error: `Nonexistent element id: ${missing.join(", ")}`, code: 400 } };
      }
      ids.forEach((id) => this.elements.delete(id));
      this.hooks.log(`DELETE draw: ${ids.join(", ")}`);
    } else {
      this.elements.clear();
      this.hooks.log(`DELETE draw: everything${app ? ` (${app})` : ""}`);
    }
    return { status: 200, json: { result: "OK" } };
  }

  // --- Assets -----------------------------------------------------------------------------------------------------

  private loaded = new Map<string, Uint8Array>();

  private async reader(path: string): Promise<void> {
    if (this.loaded.has(path)) return;
    let p = this.readers.get(path);
    if (!p) this.readers.set(path, (p = this.hooks.asset(path)));
    this.loaded.set(path, await p);
  }

  private async image(path: string): Promise<void> {
    if (this.images.has(path)) return;
    try {
      this.images.set(path, await this.hooks.decodePng(await this.hooks.asset(path)));
    } catch {
      this.images.set(path, null);
      this.hooks.log(`image ${path} could not be loaded`);
    }
  }

  // --- Frames -----------------------------------------------------------------------------------------------------

  /** Advances time by `dt` seconds and repaints both screens. */
  tick(dt: number): void {
    this.now += dt;
    for (const [id, el] of this.elements) {
      if (el.expires !== null && this.now >= el.expires) this.elements.delete(id);
      else el.player?.advance(dt);
    }
    for (const display of ["front", "back"] as const) {
      const screen = this.screens[display];
      screen.clear();
      const els = [...this.elements.values()].filter((e) => e.display === display).sort((a, b) => a.z - b.z);
      for (const el of els) this.paint(screen, el);
    }
  }

  private paint(screen: Screen, el: Element): void {
    const s = el.spec;
    if (el.type === "text" && s.text && s.font) {
      const tw = textWidth(String(s.text), s.font);
      const w = s.width ? Number(s.width) : tw;
      const h = fontMetrics(s.font).ascent - fontMetrics(s.font).descent;
      const [x, y] = anchor(s.align, Number(s.x ?? 0), Number(s.y ?? 0), w, h, screen.width, screen.height);
      const color = parseColor(s.color);
      if (s.width && tw > w && s.scroll_rate) {
        // Circular scroll: the text runs left and wraps round with a gap, after the start delay.
        const elapsed = Math.max(0, (this.now - el.createdAt) * 1000 - Number(s.scroll_start_delay ?? 0));
        const period = tw + 12;
        const offset = ((elapsed / 60000) * Number(s.scroll_rate)) % period;
        const clip = { x0: x, y0: 0, x1: x + w, y1: screen.height };
        screen.text(String(s.text), s.font, Math.round(x - offset), y, color, clip);
        screen.text(String(s.text), s.font, Math.round(x - offset + period), y, color, clip);
      } else {
        screen.text(String(s.text), s.font, x, y, color, s.width ? { x0: x, y0: 0, x1: x + w, y1: screen.height } : undefined);
      }
    } else if (el.type === "rectangle") {
      const w = Number(s.width);
      const h = Number(s.height);
      const [x, y] = anchor(s.align, Number(s.x ?? 0), Number(s.y ?? 0), w, h, screen.width, screen.height);
      const bw = Number(s.border_width ?? 1);
      const border = parseColor(s.border_color);
      const fill = s.fill ?? "none";
      const c0 = parseColor(s.fill_colors?.[0]);
      const c1 = parseColor(s.fill_colors?.[1], [0, 0, 0, 0]);
      screen.roundRect(x, y, w, h, Number(s.radius ?? 0), (lx, ly) => {
        if (bw > 0 && (lx < bw || ly < bw || lx >= w - bw || ly >= h - bw)) return border;
        if (fill === "solid") return c0;
        if (fill === "gradient_h") return mixColor(c0, c1, lx / Math.max(1, w - 1));
        if (fill === "gradient_v") return mixColor(c0, c1, ly / Math.max(1, h - 1));
        return null;
      });
    } else if (el.type === "image") {
      const img = this.images.get(String(s.path));
      if (!img) return;
      const [x, y] = anchor(s.align, Number(s.x ?? 0), Number(s.y ?? 0), img.width, img.height, screen.width, screen.height);
      screen.image(img.data, img.width, img.height, x, y, Number(s.opacity ?? 100) / 100);
    } else if (el.type === "animation" && el.player) {
      const r = el.player.reader;
      const [x, y] = anchor(s.align, Number(s.x ?? 0), Number(s.y ?? 0), r.width, r.height, screen.width, screen.height);
      screen.image(el.player.pixels(), r.width, r.height, x, y, Number(s.opacity ?? 100) / 100);
    }
  }
}

function mixColor(a: RGBA, b: RGBA, t: number): RGBA {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t, a[3] + (b[3] - a[3]) * t];
}

/** Top-left of a w×h element whose `align` point is at (x, y), as the canvas service anchors elements. */
function anchor(align: string | undefined, x: number, y: number, w: number, h: number, _sw: number, _sh: number): [number, number] {
  const a = align ?? "top_left";
  const fx = a.endsWith("left") ? 0 : a.endsWith("right") ? 1 : 0.5;
  const fy = a.startsWith("top") ? 0 : a.startsWith("bottom") ? 1 : 0.5;
  return [Math.round(x - w * fx), Math.round(y - h * fy)];
}

function describe(e: Json): string {
  if (e.type === "animation") return `${e.id} ▶ ${String(e.path).replace(/^animations\//, "")}${e.section && e.section !== "default" ? `#${e.section}` : ""}${e.await_previous_end ? " (queued)" : ""}${e.loop ? " ⟳" : ""}`;
  if (e.type === "text") return `${e.id} "${e.text}"`;
  return `${e.id} (${e.type})`;
}
