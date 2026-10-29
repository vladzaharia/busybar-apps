#!/usr/bin/env node
// Serves a built simulator page and answers the bar's HTTP API for it, so anything that talks to a BUSY Bar over
// HTTP (the Pkmn Life Remote Mac app, curl) can drive the simulator as if it were a bar.
// Usage: node packages/sim/scripts/serve.ts <sim-dir> [--port N]   (or build.ts <app-dir> --serve [--port N])
//
// The page owns the settings, as the bar does; the server relays. API requests go to the open page as Server-Sent
// Events (/__sim/events), and the page posts its current settings to /__sim/state whenever they change, so the server
// can answer reads. The bar's API, as far as a companion app needs it:
//   GET  /api/version                     {"version": "bar-sim"}
//   GET  /api/apps/settings?app_id=<id>   {"version": n, "values": {...}}: the page's current values
//   PUT  /api/apps/settings?app_id=<id>   the whole document; the page applies it without a restart
//   POST /api/apps/launch?app_id=<id>     restarts the app on the page
// Another app_id is a 404 (a bar without that app); with no page open, 503. Node built-ins only.

import { realpathSync } from "node:fs";
import { readFile, stat } from "node:fs/promises";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { extname, join, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";

/** BUSY on a phone keypad. */
export const DEFAULT_PORT = 2879;
/** Where the page finds the relay; the server tells the page by injecting it into index.html. */
export const BRIDGE = "/__sim";

const TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".json": "application/json",
  ".js": "text/javascript",
  ".css": "text/css",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".txt": "text/plain; charset=utf-8",
};

type Values = Record<string, unknown>;

export interface SimServer {
  readonly port: number;
  /** The simulated app's id: the app_id the API answers for. */
  readonly appId: string;
  /** The page: http://127.0.0.1:<port>/ */
  readonly url: string;
  /** What to type into a companion app as the bar's address: 127.0.0.1:<port>. */
  readonly address: string;
  close(): Promise<void>;
}

export async function serve(dir: string, o: { port?: number; log?: (line: string) => void } = {}): Promise<SimServer> {
  const root = resolve(dir);
  const index = join(root, "index.html");
  const log = o.log ?? ((line: string) => console.log(line));

  // The built page, re-read when it changes (a rebuild while serving).
  let cached: { mtime: number; html: string; id: string; version: number } | null = null;
  const page = async () => {
    const mtime = (await stat(index).catch(() => null))?.mtimeMs;
    if (mtime === undefined) throw new Error(`No simulator page at ${index}: build it first (build.ts <app-dir> --out <dir>).`);
    if (cached?.mtime === mtime) return cached;
    const html = await readFile(index, "utf8");
    // build.ts inlines the config as one line of JSON, with any "</script" escaped.
    const m = /window\.__SIM__ = (\{.*?\});\s*<\/script>/s.exec(html);
    const cfg = m ? (JSON.parse(m[1]!) as { id?: unknown; settings?: { version?: unknown } | null }) : null;
    if (typeof cfg?.id !== "string") throw new Error(`${index} isn't a simulator page (no window.__SIM__ config).`);
    const version = typeof cfg.settings?.version === "number" ? cfg.settings.version : 1;
    return (cached = { mtime, html, id: cfg.id, version });
  };
  const { id } = await page();

  // The open pages (one per tab), and the settings the last one posted.
  const pages = new Set<ServerResponse>();
  let values: Values | null = null;
  const send = (event: string, data: unknown) => {
    const msg = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
    for (const p of pages) p.write(msg);
  };
  // Comments keep idle connections from being dropped along the way.
  const heartbeat = setInterval(() => pages.forEach((p) => p.write(": ping\n\n")), 15_000);
  heartbeat.unref();

  let base = "";
  /** Answers a request to /api/...; returns the status, and adds anything worth printing to `notes`. */
  const api = async (req: IncomingMessage, res: ServerResponse, url: URL, notes: string[]): Promise<number> => {
    const method = req.method ?? "GET";
    const route = url.pathname.slice("/api".length);
    if (route === "/version") return method === "GET" ? reply(res, 200, { version: "bar-sim" }) : notAllowed(res, ["GET"]);
    if (route !== "/apps/settings" && route !== "/apps/launch") return reply(res, 404, { error: "Not found", code: 404 });
    const app = url.searchParams.get("app_id") ?? "";
    const { id, version } = await page();
    if (app !== id) return reply(res, 404, { error: `No app "${app}" on this simulator: it runs ${id}.`, code: 404 });
    const methods = route === "/apps/launch" ? ["POST"] : ["GET", "PUT"];
    if (!methods.includes(method)) return notAllowed(res, methods);
    if (!pages.size || !values) {
      return reply(res, 503, { error: `No simulator page is open: open ${base} in a browser.`, code: 503 });
    }
    if (route === "/apps/launch") {
      send("launch", {});
      return reply(res, 200, { result: "OK" });
    }
    if (method === "GET") return reply(res, 200, { version, values });
    const doc = await readJson(req).catch(() => null);
    if (!isObject(doc) || !isObject(doc.values)) {
      return reply(res, 400, { error: 'Expected the settings document: {"version": n, "values": {...}}.', code: 400 });
    }
    const before = values;
    const changed = Object.entries(doc.values).filter(([k, v]) => JSON.stringify(before[k]) !== JSON.stringify(v));
    if (changed.length) notes.push(changed.map(([k, v]) => `${k} = ${JSON.stringify(v)}`).join(", "));
    // Current at once, so a read right after the write (the next request a companion sends) sees it.
    values = { ...values, ...doc.values };
    send("settings", { values: doc.values });
    return reply(res, 200, { result: "OK" });
  };

  const events = (req: IncomingMessage, res: ServerResponse) => {
    if (req.method !== "GET") return notAllowed(res, ["GET"]);
    res.writeHead(200, { "Content-Type": "text/event-stream", "Cache-Control": "no-store", Connection: "keep-alive" });
    // Reconnect within a second if the server restarts.
    res.write("retry: 1000\n\n");
    pages.add(res);
    log(`page connected (${pages.size} open)`);
    const gone = () => {
      if (pages.delete(res)) log(`page closed (${pages.size} open)`);
    };
    res.on("close", gone);
    res.on("error", gone);
  };

  const state = async (req: IncomingMessage, res: ServerResponse) => {
    if (req.method !== "POST") return notAllowed(res, ["POST"]);
    const body = await readJson(req).catch(() => null);
    if (!isObject(body) || !isObject(body.values)) return reply(res, 400, { error: 'Expected {"values": {...}}.', code: 400 });
    values = body.values;
    return reply(res, 204);
  };

  const file = async (req: IncomingMessage, res: ServerResponse, url: URL) => {
    if (req.method !== "GET" && req.method !== "HEAD") return notAllowed(res, ["GET", "HEAD"]);
    let path: string;
    try {
      path = resolve(root, `.${decodeURIComponent(url.pathname)}`);
    } catch {
      return reply(res, 400, { error: "Bad path" });
    }
    if (path !== root && !path.startsWith(root + sep)) return reply(res, 404, { error: "Not found" });
    if ((await stat(path).catch(() => null))?.isDirectory()) path = join(path, "index.html");
    let body: Buffer | string;
    if (path === index) {
      // Tell the page the relay is here; served by any other static server, the page never tries to connect.
      const html = (await page()).html;
      const flag = `<script>window.__SIM_BRIDGE__ = ${JSON.stringify(BRIDGE)};</script>\n`;
      const at = html.indexOf("<script");
      body = at < 0 ? html + flag : html.slice(0, at) + flag + html.slice(at);
    } else {
      const data = await readFile(path).catch(() => null);
      if (!data) return reply(res, 404, { error: "Not found" });
      body = data;
    }
    res.writeHead(200, {
      "Content-Type": TYPES[extname(path).toLowerCase()] ?? "application/octet-stream",
      "Content-Length": Buffer.byteLength(body),
      // Always the latest build.
      "Cache-Control": "no-store",
    });
    res.end(req.method === "HEAD" ? undefined : body);
  };

  const server = createServer((req, res) => {
    const url = new URL(req.url ?? "/", "http://localhost");
    const handle = async () => {
      // Only this machine, and no other web page: a browser sends Origin with a cross-site request, and a rebound DNS
      // name shows in Host. Companion apps and curl send no Origin.
      const host = req.headers.host ?? "";
      const origin = req.headers.origin;
      if (!/^(127\.0\.0\.1|localhost|\[::1\])(:\d+)?$/i.test(host) || (origin && origin !== `http://${host}`)) {
        return reply(res, 403, { error: "Only pages served here, and apps on this machine, may use the simulator.", code: 403 });
      }
      if (url.pathname === "/api" || url.pathname.startsWith("/api/")) {
        const notes: string[] = [];
        const status = await api(req, res, url, notes);
        log([`${req.method} ${url.pathname}${url.search} → ${status}`, ...notes].join("  "));
        return;
      }
      if (url.pathname === `${BRIDGE}/events`) return events(req, res);
      if (url.pathname === `${BRIDGE}/state`) return state(req, res);
      return file(req, res, url);
    };
    handle().catch((e: unknown) => {
      log(`${req.method} ${url.pathname} → 500 ${(e as Error).message}`);
      if (!res.headersSent) reply(res, 500, { error: (e as Error).message, code: 500 });
      else res.destroy();
    });
  });

  const wanted = o.port ?? DEFAULT_PORT;
  const port = await new Promise<number>((done, fail) => {
    server.once("error", (e: NodeJS.ErrnoException) =>
      fail(e.code === "EADDRINUSE" ? new Error(`Port ${wanted} is already in use: pick another with --port <n>.`) : e),
    );
    server.listen(wanted, "127.0.0.1", () => {
      const a = server.address();
      done(typeof a === "object" && a ? a.port : wanted);
    });
  });
  base = `http://127.0.0.1:${port}/`;

  return {
    port,
    appId: id,
    url: base,
    address: `127.0.0.1:${port}`,
    close: () =>
      new Promise<void>((done) => {
        clearInterval(heartbeat);
        server.close(() => done());
        server.closeAllConnections();
      }),
  };
}

function reply(res: ServerResponse, status: number, body?: unknown, headers: Record<string, string> = {}): number {
  const data = body === undefined ? "" : JSON.stringify(body);
  res.writeHead(status, { ...(data ? { "Content-Type": "application/json" } : {}), "Content-Length": Buffer.byteLength(data), ...headers });
  res.end(data);
  return status;
}

function notAllowed(res: ServerResponse, methods: string[]): number {
  return reply(res, 405, { error: "Method not allowed", code: 405 }, { Allow: methods.join(", ") });
}

function isObject(v: unknown): v is Values {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

async function readJson(req: IncomingMessage, limit = 1 << 20): Promise<unknown> {
  let size = 0;
  const chunks: Buffer[] = [];
  for await (const chunk of req as AsyncIterable<Buffer>) {
    size += chunk.length;
    if (size > limit) throw new Error("Body too large");
    chunks.push(chunk);
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

/** Serves `dir` for a person at a terminal: prints where to look, or why it couldn't start (and exits). */
export async function serveFromCli(dir: string, port?: string): Promise<SimServer> {
  const n = port === undefined ? DEFAULT_PORT : Number(port);
  if (!Number.isInteger(n) || n < 0 || n > 65535) {
    console.error(`--port needs a port number (0-65535), not "${port}".`);
    process.exit(2);
  }
  try {
    const s = await serve(dir, { port: n });
    console.log(`
Simulator:        ${s.url}   (open it in a browser; the API needs the page open)
Mac app address:  ${s.address}
Bar HTTP API:     ${s.url}api/  version, apps/settings and apps/launch for app_id=${s.appId}
Ctrl+C stops it.
`);
    return s;
  } catch (e) {
    console.error((e as Error).message);
    process.exit(1);
  }
}

if (process.argv[1] && realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { values: opts, positionals } = parseArgs({ allowPositionals: true, options: { port: { type: "string" } } });
  if (!positionals[0]) {
    console.error("Usage: node packages/sim/scripts/serve.ts <sim-dir> [--port N]");
    process.exit(2);
  }
  await serveFromCli(positionals[0], opts.port);
}
