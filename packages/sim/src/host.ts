// Runs an app's real build against the emulated device. The app's bundled script is wrapped in a function whose
// parameters shadow the globals it uses (timers, fetch, listen), so the host can see everything that keeps the app
// alive, stop it cleanly, and run it again. Like the JavaScript runtime on the bar, the app ends once no input
// handler, timer or request remains.

import type { Device } from "./device.ts";

export type AppFn = (
  setTimeout: (fn: () => void, ms?: number) => number,
  setInterval: (fn: () => void, ms?: number) => number,
  clearTimeout: (h?: number) => void,
  clearInterval: (h?: number) => void,
  fetch: (url: string, init?: RequestInit) => Promise<Response>,
  listen: (type: string, handler: (e: InputEventLike) => void) => () => void,
) => void;

export interface InputEventLike {
  key: "encoder" | "ok" | "start" | "back";
  action: string;
  delta?: 1 | -1;
}

export type HostState = "running" | "exited" | "stopped" | "crashed";

export class AppHost {
  state: HostState = "stopped";
  private readonly device: Device;
  private readonly app: AppFn;
  private readonly onState: (s: HostState, why?: string) => void;
  private readonly log: (line: string) => void;
  private generation = 0;
  private handler: ((e: InputEventLike) => void) | null = null;
  private timers = new Map<number, "timeout" | "interval">();
  private inflight = 0;

  constructor(o: { device: Device; app: AppFn; onState: (s: HostState, why?: string) => void; log: (line: string) => void }) {
    this.device = o.device;
    this.app = o.app;
    this.onState = o.onState;
    this.log = o.log;
  }

  start(): void {
    this.stop();
    const gen = ++this.generation;
    this.device.reset();
    this.setState("running");
    const alive = () => gen === this.generation;
    const guard = (fn: () => void) => () => {
      if (!alive()) return;
      try {
        fn();
      } catch (e) {
        this.crash(e);
      }
    };

    const setT = (fn: () => void, ms = 0) => {
      const h = window.setTimeout(() => {
        this.timers.delete(h);
        guard(fn)();
        this.checkExit(gen);
      }, ms);
      this.timers.set(h, "timeout");
      return h;
    };
    const setI = (fn: () => void, ms = 0) => {
      const h = window.setInterval(guard(fn), Math.max(ms, 4));
      this.timers.set(h, "interval");
      return h;
    };
    const clear = (h?: number) => {
      if (h === undefined || !this.timers.has(h)) return;
      if (this.timers.get(h) === "interval") window.clearInterval(h);
      else window.clearTimeout(h);
      this.timers.delete(h);
      queueMicrotask(() => this.checkExit(gen));
    };

    const fetchShim = async (url: string, init: RequestInit = {}): Promise<Response> => {
      const m = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?\/api(\/[^#]*)$/i.exec(String(url));
      this.inflight++;
      try {
        if (!m) return await window.fetch(url, init);
        const res = await this.device.handle((init.method ?? "GET").toUpperCase(), m[3]!, typeof init.body === "string" ? init.body : null);
        return new Response(JSON.stringify(res.json), { status: res.status, headers: { "Content-Type": "application/json" } });
      } finally {
        this.inflight--;
        queueMicrotask(() => this.checkExit(gen));
      }
    };

    const listen = (type: string, handler: (e: InputEventLike) => void) => {
      if (type !== "input") throw new TypeError(`listen: unknown event type "${type}"`);
      if (this.handler) throw new TypeError("listen: a handler is already attached");
      this.handler = handler;
      return () => {
        if (!alive() || this.handler !== handler) return;
        this.handler = null;
        queueMicrotask(() => this.checkExit(gen));
      };
    };

    try {
      this.app(setT, setI, clear, clear, fetchShim, listen);
      this.log("app started");
    } catch (e) {
      this.crash(e);
      return;
    }
    queueMicrotask(() => this.checkExit(gen));
  }

  /** Stops the app as the firmware would on a force quit: drops its timers and handler, clears its elements. */
  stop(why?: string): void {
    for (const [h, kind] of this.timers) kind === "interval" ? window.clearInterval(h) : window.clearTimeout(h);
    this.timers.clear();
    this.handler = null;
    this.generation++;
    if (this.state === "running") {
      this.device.reset();
      this.setState("stopped", why);
    }
  }

  input(e: InputEventLike): void {
    if (this.state !== "running") return;
    this.log(`input: ${e.key} ${e.action}${e.delta ? ` (${e.delta > 0 ? "+1" : "-1"})` : ""}`);
    if (!this.handler) return;
    try {
      this.handler(e);
    } catch (err) {
      this.crash(err);
    }
  }

  private checkExit(gen: number): void {
    if (gen !== this.generation || this.state !== "running") return;
    if (!this.handler && this.timers.size === 0 && this.inflight === 0) {
      this.generation++;
      this.device.reset();
      this.setState("exited", "Nothing kept the app alive, so it ended (as on the bar).");
    }
  }

  private crash(e: unknown): void {
    const msg = e instanceof Error ? e.message : String(e);
    this.log(`error: ${msg}`);
    this.stop();
    this.setState("crashed", msg);
  }

  private setState(s: HostState, why?: string): void {
    this.state = s;
    this.onState(s, why);
  }
}
