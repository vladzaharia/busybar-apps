// The simulator page: paints the two screens, wires the physical controls (BACK, START, the wheel and its OK
// press, plus keys), and shows the app's settings and an activity log.

import { DISPLAY_SIZE } from "./device.ts";
import type { AppHost, HostState, InputEventLike } from "./host.ts";
import type { Screen } from "./screen.ts";

const LONG_MS = 500;
const REPEAT_MS = 150;

// --- Painters --------------------------------------------------------------------------------------------------

/** The front: round LEDs with a soft glow, unlit LEDs faintly visible. */
export class LedPainter {
  private readonly ctx: CanvasRenderingContext2D;
  private readonly glow: HTMLCanvasElement;
  private readonly gctx: CanvasRenderingContext2D;
  private readonly base: HTMLCanvasElement;
  private readonly s: number;

  constructor(canvas: HTMLCanvasElement) {
    const { width, height } = DISPLAY_SIZE.front;
    this.s = canvas.width / width;
    this.ctx = canvas.getContext("2d")!;
    this.glow = document.createElement("canvas");
    this.glow.width = width;
    this.glow.height = height;
    this.gctx = this.glow.getContext("2d")!;
    // Unlit LEDs, drawn once.
    this.base = document.createElement("canvas");
    this.base.width = canvas.width;
    this.base.height = canvas.height;
    const b = this.base.getContext("2d")!;
    b.fillStyle = "#050506";
    b.fillRect(0, 0, canvas.width, canvas.height);
    b.fillStyle = "#121318";
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        b.beginPath();
        b.arc(x * this.s + this.s / 2, y * this.s + this.s / 2, this.s * 0.38, 0, Math.PI * 2);
        b.fill();
      }
    }
  }

  paint(screen: Screen): void {
    const { ctx, s } = this;
    const { width, height } = screen;
    ctx.drawImage(this.base, 0, 0);
    const img = new ImageData(new Uint8ClampedArray(screen.data), width, height);
    this.gctx.putImageData(img, 0, 0);
    // Bloom first, then the crisp dots on top.
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    ctx.globalAlpha = 0.5;
    ctx.filter = `blur(${s * 0.7}px)`;
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(this.glow, 0, 0, width * s, height * s);
    ctx.restore();
    const d = screen.data;
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const i = (y * width + x) * 4;
        if (d[i]! + d[i + 1]! + d[i + 2]! < 8) continue;
        ctx.fillStyle = `rgb(${d[i]},${d[i + 1]},${d[i + 2]})`;
        ctx.beginPath();
        ctx.arc(x * s + s / 2, y * s + s / 2, s * 0.4, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }
}

/** The back: square OLED pixels in a fine grid, the app's 148 px plus the system's 12 px status bar. */
export class OledPainter {
  private readonly ctx: CanvasRenderingContext2D;
  private readonly frame: HTMLCanvasElement;
  private readonly fctx: CanvasRenderingContext2D;
  private readonly grid: HTMLCanvasElement;
  private readonly s: number;
  static readonly WIDTH = 160;

  constructor(canvas: HTMLCanvasElement) {
    this.s = canvas.width / OledPainter.WIDTH;
    this.ctx = canvas.getContext("2d")!;
    this.frame = document.createElement("canvas");
    this.frame.width = OledPainter.WIDTH;
    this.frame.height = 80;
    this.fctx = this.frame.getContext("2d")!;
    this.grid = document.createElement("canvas");
    this.grid.width = canvas.width;
    this.grid.height = canvas.height;
    const g = this.grid.getContext("2d")!;
    g.fillStyle = "rgba(0,0,0,0.38)";
    for (let x = 1; x < OledPainter.WIDTH; x++) g.fillRect(x * this.s - 1, 0, 1, canvas.height);
    for (let y = 1; y < 80; y++) g.fillRect(0, y * this.s - 1, canvas.width, 1);
  }

  paint(back: Screen, front: Screen, mirror: boolean): void {
    const f = this.fctx;
    f.fillStyle = "#000";
    f.fillRect(0, 0, OledPainter.WIDTH, 80);
    if (mirror) {
      // With nothing of its own on the back, the firmware mirrors the front in an "ACTIVE" card.
      f.fillStyle = "#9a9a9a";
      f.font = "5px monospace";
      f.fillText("ACTIVE", 6, 22);
      const img = new ImageData(greyscale(front.data), front.width, front.height);
      const tmp = document.createElement("canvas");
      tmp.width = front.width;
      tmp.height = front.height;
      tmp.getContext("2d")!.putImageData(img, 0, 0);
      f.imageSmoothingEnabled = false;
      f.strokeStyle = "#5a5a5a";
      f.strokeRect(1.5, 25.5, 145, 35);
      f.drawImage(tmp, 2, 26, 144, 32);
    } else {
      f.putImageData(new ImageData(greyscale(back.data), back.width, back.height), 0, 0);
    }
    statusBar(f);
    const { ctx, s } = this;
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(this.frame, 0, 0, OledPainter.WIDTH * s, 80 * s);
    ctx.drawImage(this.grid, 0, 0);
  }
}

/** The OLED is greyscale: 16 levels of white. */
function greyscale(src: Uint8ClampedArray): Uint8ClampedArray<ArrayBuffer> {
  const out = new Uint8ClampedArray(new ArrayBuffer(src.length));
  for (let i = 0; i < src.length; i += 4) {
    const l = Math.round(((0.299 * src[i]! + 0.587 * src[i + 1]! + 0.114 * src[i + 2]!) / 255) * 15) * 17;
    out[i] = out[i + 1] = out[i + 2] = l;
    out[i + 3] = 255;
  }
  return out;
}

/** The system's status column on the right: Wi-Fi, volume and battery, as plain glyphs. */
function statusBar(f: CanvasRenderingContext2D): void {
  const x = 150;
  f.fillStyle = "#8a8a8a";
  // Wi-Fi: three arcs.
  for (const [w, y] of [[7, 3], [5, 5], [3, 7]] as const) f.fillRect(x + (8 - w) / 2, y, w, 1);
  f.fillRect(x + 3.5, 9, 1, 1);
  // Volume: a speaker.
  f.fillRect(x + 1, 15, 2, 3);
  f.fillRect(x + 3, 14, 1, 5);
  f.fillRect(x + 5, 15, 1, 3);
  // Battery.
  f.fillRect(x + 1, 70, 7, 4);
  f.fillStyle = "#000";
  f.fillRect(x + 2, 71, 2, 2);
  f.fillStyle = "#8a8a8a";
  f.fillRect(x + 8, 71, 1, 2);
}

// --- Controls --------------------------------------------------------------------------------------------------

type ButtonKey = "start" | "ok" | "back";

/** Press/release with the firmware's gestures: `short` on a quick release, `long` then `repeat` while held. */
export class Buttons {
  private readonly host: AppHost;
  private held = new Map<ButtonKey, { long: boolean; timers: number[] }>();
  private readonly onForceQuit: () => void;

  constructor(host: AppHost, onForceQuit: () => void) {
    this.host = host;
    this.onForceQuit = onForceQuit;
  }

  down(key: ButtonKey): void {
    if (this.held.has(key)) return;
    const state = { long: false, timers: [] as number[] };
    this.held.set(key, state);
    this.send({ key, action: "press" });
    state.timers.push(
      window.setTimeout(() => {
        state.long = true;
        // A long Back is the firmware's force quit; the app never sees it.
        if (key === "back") {
          this.onForceQuit();
          return;
        }
        this.send({ key, action: "long" });
        state.timers.push(window.setInterval(() => this.send({ key, action: "repeat" }), REPEAT_MS));
      }, LONG_MS),
    );
  }

  up(key: ButtonKey): void {
    const state = this.held.get(key);
    if (!state) return;
    state.timers.forEach((t) => (window.clearTimeout(t), window.clearInterval(t)));
    this.held.delete(key);
    this.send({ key, action: "release" });
    if (!state.long) this.send({ key, action: "short" });
  }

  turn(delta: 1 | -1): void {
    this.send({ key: "encoder", action: delta > 0 ? "clockwise" : "counterclockwise", delta });
  }

  private send(e: InputEventLike): void {
    this.host.input(e);
  }
}

/** Wires a button element so mouse, touch and keyboard all press it. */
export function bindButton(el: HTMLElement, key: ButtonKey, buttons: Buttons): void {
  el.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    el.setPointerCapture(e.pointerId);
    el.classList.add("pressed");
    buttons.down(key);
  });
  const up = () => {
    el.classList.remove("pressed");
    buttons.up(key);
  };
  el.addEventListener("pointerup", up);
  el.addEventListener("pointercancel", up);
  el.addEventListener("keydown", (e) => {
    if ((e.key === " " || e.key === "Enter") && !e.repeat) {
      e.preventDefault();
      el.classList.add("pressed");
      buttons.down(key);
    }
  });
  el.addEventListener("keyup", (e) => {
    if (e.key === " " || e.key === "Enter") up();
  });
}

/**
 * The scroll wheel: turn it with the mouse wheel, by dragging up and down, or with the arrow keys; press it (click,
 * Enter) for OK. It rotates as it turns.
 */
export function bindWheel(el: HTMLElement, buttons: Buttons): void {
  let angle = 0;
  const turn = (d: 1 | -1) => {
    angle += d;
    // The ridges roll by a fraction of their spacing per click.
    el.style.setProperty("--shift", `${angle * 2}px`);
    el.setAttribute("aria-valuenow", String(angle));
    buttons.turn(d);
  };
  let acc = 0;
  el.addEventListener(
    "wheel",
    (e) => {
      e.preventDefault();
      acc += e.deltaY;
      while (Math.abs(acc) >= 40) {
        turn(acc > 0 ? 1 : -1);
        acc -= Math.sign(acc) * 40;
      }
    },
    { passive: false },
  );
  let startY: number | null = null;
  let moved = false;
  el.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    el.setPointerCapture(e.pointerId);
    startY = e.clientY;
    moved = false;
  });
  el.addEventListener("pointermove", (e) => {
    if (startY === null) return;
    while (Math.abs(e.clientY - startY) >= 14) {
      moved = true;
      const d = e.clientY > startY ? 1 : -1;
      turn(d);
      startY += d * 14;
    }
  });
  el.addEventListener("pointerup", () => {
    if (startY !== null && !moved) {
      el.classList.add("pressed");
      buttons.down("ok");
      setTimeout(() => {
        el.classList.remove("pressed");
        buttons.up("ok");
      }, 90);
    }
    startY = null;
  });
  el.addEventListener("keydown", (e) => {
    if (e.key === "ArrowDown" || e.key === "ArrowRight") (e.preventDefault(), turn(1));
    else if (e.key === "ArrowUp" || e.key === "ArrowLeft") (e.preventDefault(), turn(-1));
    else if ((e.key === "Enter" || e.key === " ") && !e.repeat) (e.preventDefault(), buttons.down("ok"));
  });
  el.addEventListener("keyup", (e) => {
    if (e.key === "Enter" || e.key === " ") buttons.up("ok");
  });
}

/** Keys anywhere on the page: S = START, Enter = OK, arrows = wheel, Esc/Backspace = BACK. */
export function bindKeyboard(buttons: Buttons, wheel: HTMLElement): void {
  const map: Record<string, ButtonKey> = { s: "start", S: "start", Escape: "back", Backspace: "back" };
  window.addEventListener("keydown", (e) => {
    const t = e.target as HTMLElement;
    if (t.closest("input, select, textarea, button, [role=slider]")) return;
    if (map[e.key] && !e.repeat) (e.preventDefault(), buttons.down(map[e.key]!));
    else if (e.key === "Enter" && !e.repeat) (e.preventDefault(), buttons.down("ok"));
    else if (e.key.startsWith("Arrow")) {
      e.preventDefault();
      wheel.dispatchEvent(new KeyboardEvent("keydown", { key: e.key }));
    }
  });
  window.addEventListener("keyup", (e) => {
    const t = e.target as HTMLElement;
    if (t.closest("input, select, textarea, button, [role=slider]")) return;
    if (map[e.key]) buttons.up(map[e.key]!);
    else if (e.key === "Enter") buttons.up("ok");
  });
}

// --- Status, settings, activity ---------------------------------------------------------------------------------

export function showState(el: HTMLElement, note: HTMLElement, s: HostState, why?: string): void {
  const text: Record<HostState, string> = { running: "Running", exited: "Exited", stopped: "Stopped", crashed: "Crashed" };
  el.textContent = text[s];
  el.dataset.state = s;
  note.textContent = s === "running" ? "" : (why ?? "");
}

export interface SettingField {
  label: string;
  type: string;
  default: unknown;
  description?: string;
  options?: { value: string; label: string }[];
  min?: number;
  max?: number;
}

/** A form for the app's settings.json; values persist in this browser. */
export function settingsForm(root: HTMLElement, fields: Record<string, SettingField>, values: Record<string, unknown>, onChange: () => void): void {
  for (const [id, f] of Object.entries(fields)) {
    if (f.type === "group") continue;
    const row = document.createElement("label");
    row.className = "field";
    const name = document.createElement("span");
    name.textContent = f.label;
    let input: HTMLInputElement | HTMLSelectElement;
    if (f.type === "enum") {
      input = document.createElement("select");
      for (const o of f.options ?? []) input.append(new Option(o.label, o.value));
      input.value = String(values[id]);
      input.addEventListener("change", () => ((values[id] = input.value), onChange()));
    } else if (f.type === "boolean") {
      input = document.createElement("input");
      input.type = "checkbox";
      input.checked = !!values[id];
      input.addEventListener("change", () => ((values[id] = (input as HTMLInputElement).checked), onChange()));
      row.classList.add("check");
    } else {
      input = document.createElement("input");
      input.type = f.type === "integer" ? "number" : f.type === "color" ? "color" : f.type === "time" ? "time" : "text";
      input.value = String(values[id]);
      input.addEventListener("change", () => ((values[id] = f.type === "integer" ? Number(input.value) : input.value), onChange()));
    }
    input.id = `setting-${id}`;
    row.append(name, input);
    if (f.description) {
      const d = document.createElement("small");
      d.textContent = f.description;
      row.append(d);
    }
    root.append(row);
  }
}

export function logger(list: HTMLElement): (line: string) => void {
  return (line) => {
    const li = document.createElement("li");
    const t = new Date();
    li.innerHTML = `<time>${t.toLocaleTimeString([], { hour12: false })}</time>`;
    li.append(document.createTextNode(line));
    list.prepend(li);
    while (list.children.length > 60) list.lastElementChild?.remove();
  };
}
