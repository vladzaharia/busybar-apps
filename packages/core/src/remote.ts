// Requests from outside the bar. A running app can't be sent messages, but it can read its own settings, which
// anything with the bar's HTTP API can write. So a companion (a Mac app, a script) writes a request into a settings
// field, "<seq> <unix seconds> <words...>", and the app checks the field every second.

import type { Device } from "./device.ts";
import type { Timers } from "./timers.ts";

export interface RemoteRequest {
  /** Increases with every request, so the same one is never acted on twice. */
  seq: number;
  /** When it was sent, in Unix seconds. */
  time: number;
  /** What to do, e.g. ["play", "alex", "random"]. */
  words: string[];
}

/** "17 1793210000 play alex random" as a request; null if the field holds nothing usable. */
export function parseRemote(text: unknown): RemoteRequest | null {
  if (typeof text !== "string") return null;
  const [seq, time, ...words] = text.trim().split(/\s+/);
  if (!seq || !time || !words.length || !/^\d+$/.test(seq) || !/^\d+$/.test(time)) return null;
  return { seq: Number(seq), time: Number(time), words: words.map((w) => w.toLowerCase()) };
}

/**
 * Checks settings field `field` every `every` ms and calls `onRequest` for each new request that is at most
 * `maxAge` seconds old (so a request written just before the app starts still plays, and an old one never replays).
 * `enabled` can switch the checking off without stopping it. Returns a function that stops it.
 */
export function remoteInbox(o: {
  device: Device;
  timers: Timers;
  field: string;
  onRequest: (r: RemoteRequest) => void;
  every?: number;
  maxAge?: number;
  enabled?: () => boolean;
  now?: () => number;
}): () => void {
  let lastSeq: number | null = null;
  let busy = false;
  const now = o.now ?? (() => Date.now());
  const check = () => {
    if (busy || (o.enabled && !o.enabled())) return;
    busy = true;
    o.device
      .settings()
      .then((values) => {
        const r = parseRemote(values?.[o.field]);
        if (!r || r.seq === lastSeq) return;
        lastSeq = r.seq;
        if (Math.abs(now() / 1000 - r.time) <= (o.maxAge ?? 15)) o.onRequest(r);
      })
      .catch(() => {})
      .then(() => {
        busy = false;
      });
  };
  const h = o.timers.every(o.every ?? 1000, check);
  check();
  return () => o.timers.cancel(h);
}
