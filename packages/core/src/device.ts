// Client for the on-device HTTP API, as JavaScript apps reach it: `fetch` on http://localhost/api.
//
// Requests go out one at a time, in order. The bar's web server shares the CPU with everything else, and the
// order matters for animations (a section switch, then the one queued after it). A draw tagged with a
// `coalesce` key replaces any not-yet-sent draw with the same key, so a periodic redraw never piles up.

import type { DisplayElement } from "./types.ts";

export interface DeviceOptions {
  /** The app's id: draws are made, and cleared, under this name. */
  app: string;
  /** 1–100. Draws at or above the running system app's priority take the screen. 50 is the usual. */
  priority?: number;
  /** Where failed requests are reported. Defaults to console.error. */
  onError?: (error: Error) => void;
}

interface Op {
  path: string;
  init: RequestInit;
  coalesce?: string;
  resolve: (res: Response | null) => void;
}

const BASE = (() => {
  const addr = __BUSY_ADDR__;
  return `${/^https?:\/\//i.test(addr) ? addr : `http://${addr}`}/api`;
})();

export class Device {
  readonly app: string;
  readonly priority: number;
  private readonly onError: (error: Error) => void;
  private readonly queue: Op[] = [];
  private busy = false;
  private idle: (() => void)[] = [];

  constructor(options: DeviceOptions) {
    this.app = options.app;
    this.priority = options.priority ?? 50;
    this.onError = options.onError ?? ((e) => console.error(`${this.app}: ${e.message}`));
  }

  /** Draws or updates elements. Resolves once the device has answered (errors are reported, not thrown). */
  draw(elements: DisplayElement[], options: { coalesce?: string } = {}): Promise<void> {
    if (!elements.length) return Promise.resolve();
    const body = JSON.stringify({ application_name: this.app, priority: this.priority, elements });
    return this.send(
      "/display/draw",
      { method: "POST", headers: { "Content-Type": "application/json" }, body },
      options.coalesce,
    ).then(() => undefined);
  }

  /** Removes the given elements, or all of the app's elements. */
  clear(ids?: string[]): Promise<void> {
    const body = JSON.stringify(ids ? { application_name: this.app, element_ids: ids } : { application_name: this.app });
    return this.send(`/display/draw?application_name=${encodeURIComponent(this.app)}`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body,
    }).then(() => undefined);
  }

  /** The app's stored settings values (field id → value), or null if they could not be read. */
  async settings(): Promise<Record<string, unknown> | null> {
    const res = await this.send(`/apps/settings?app_id=${encodeURIComponent(this.app)}`, { method: "GET" });
    if (!res) return null;
    try {
      const doc = (await res.json()) as { values?: Record<string, unknown> };
      return doc.values ?? null;
    } catch (e) {
      this.onError(e instanceof Error ? e : new Error(String(e)));
      return null;
    }
  }

  /** Resolves once every queued request has settled. */
  settled(): Promise<void> {
    if (!this.busy && !this.queue.length) return Promise.resolve();
    return new Promise((resolve) => this.idle.push(resolve));
  }

  private send(path: string, init: RequestInit, coalesce?: string): Promise<Response | null> {
    return new Promise((resolve) => {
      if (coalesce) {
        const pending = this.queue.find((op) => op.coalesce === coalesce);
        if (pending) {
          // The newer frame supersedes the one still waiting; both callers learn when it lands.
          const previous = pending.resolve;
          pending.init = init;
          pending.resolve = (res) => {
            previous(res);
            resolve(res);
          };
          return;
        }
      }
      this.queue.push({ path, init, coalesce, resolve });
      this.pump();
    });
  }

  private pump(): void {
    if (this.busy) return;
    const op = this.queue.shift();
    if (!op) {
      const waiting = this.idle;
      this.idle = [];
      waiting.forEach((r) => r());
      return;
    }
    this.busy = true;
    fetch(`${BASE}${op.path}`, op.init)
      .then(async (res) => {
        if (!res.ok) {
          this.onError(new Error(`${op.init.method} ${op.path}: HTTP ${res.status} ${await res.text()}`));
          op.resolve(null);
        } else {
          op.resolve(res);
        }
      })
      .catch((e: unknown) => {
        this.onError(e instanceof Error ? e : new Error(String(e)));
        op.resolve(null);
      })
      .then(() => {
        this.busy = false;
        this.pump();
      });
  }
}
