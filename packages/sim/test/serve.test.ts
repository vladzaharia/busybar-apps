import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, before, test } from "node:test";
import { serve, type SimServer } from "../scripts/serve.ts";

// A built page as far as the server cares: index.html with the config build.ts inlines.
const APP = "app.test.sim";
const config = { id: APP, name: "Test", pack: "package.json", settings: { version: 7, fields: { mode: { type: "string", default: "a" } } } };
const html = `<meta charset="utf-8">\n<title>t</title>\n<script>window.__SIM__ = ${JSON.stringify(config)};</script>\n<script>/* runtime */</script>\n`;

let dir: string;
let s: SimServer;
before(async () => {
  dir = mkdtempSync(join(tmpdir(), "bar-sim-serve-"));
  writeFileSync(join(dir, "index.html"), html);
  writeFileSync(join(dir, "package.json"), "{}");
  s = await serve(dir, { port: 0, log: () => {} });
});
after(async () => {
  await s.close();
  rmSync(dir, { recursive: true, force: true });
});

const api = (path: string, init?: RequestInit) => fetch(`${s.url}api/${path}`, init);
const settings = `apps/settings?app_id=${APP}`;
const json = { "Content-Type": "application/json" };

function timeout<T>(p: Promise<T>, what: string, ms = 2000): Promise<T> {
  let t: ReturnType<typeof setTimeout>;
  return Promise.race([p, new Promise<T>((_, fail) => (t = setTimeout(() => fail(new Error(`timed out waiting for ${what}`)), ms)))]).finally(() =>
    clearTimeout(t),
  );
}

/** Acts as the simulator page: reads the event stream and posts its values, as src/bridge.ts does. */
async function openPage() {
  const res = await fetch(`${s.url}__sim/events`);
  assert.equal(res.status, 200);
  assert.equal(res.headers.get("content-type"), "text/event-stream");
  const reader = res.body!.pipeThrough(new TextDecoderStream()).getReader();
  let buf = "";
  const read = async (): Promise<{ event: string; data: unknown }> => {
    for (;;) {
      const end = buf.indexOf("\n\n");
      if (end >= 0) {
        const block = buf.slice(0, end);
        buf = buf.slice(end + 2);
        let event = "message";
        let data = "";
        for (const line of block.split("\n")) {
          if (line.startsWith("event: ")) event = line.slice(7);
          else if (line.startsWith("data: ")) data += line.slice(6);
        }
        if (data) return { event, data: JSON.parse(data) };
        continue; // a comment or the retry interval
      }
      const { value, done } = await reader.read();
      if (done) throw new Error("the event stream ended");
      buf += value;
    }
  };
  return {
    next: (what: string) => timeout(read(), what),
    post: (values: Record<string, unknown>) => fetch(`${s.url}__sim/state`, { method: "POST", headers: json, body: JSON.stringify({ values }) }),
    close: () => reader.cancel(),
  };
}

test("version answers 200 and says it's the simulator", async () => {
  const res = await api("version");
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { version: "bar-sim" });
});

test("the page is served with the bridge flag; other files as they are", async () => {
  for (const path of ["", "index.html"]) {
    const res = await fetch(s.url + path);
    assert.equal(res.status, 200);
    assert.match(res.headers.get("content-type")!, /^text\/html/);
    const body = await res.text();
    assert.ok(body.includes('<script>window.__SIM_BRIDGE__ = "/__sim";</script>'), "flag injected");
    assert.ok(body.indexOf("__SIM_BRIDGE__") < body.indexOf("window.__SIM__"), "before the page's scripts");
  }
  const pack = await fetch(`${s.url}package.json`);
  assert.equal(pack.status, 200);
  assert.equal(await pack.text(), "{}");
  assert.equal((await fetch(`${s.url}nope.txt`)).status, 404);
  assert.equal((await fetch(`${s.url}..%2f..%2fetc%2fpasswd`)).status, 404, "nothing outside the folder");
});

test("unknown API paths and other apps are 404s, like a bar without them", async () => {
  assert.equal((await api("display/draw", { method: "POST", body: "{}" })).status, 404);
  assert.equal((await api("apps/settings?app_id=some.other.app")).status, 404);
  assert.equal((await api("apps/settings")).status, 404);
  assert.equal((await api("apps/launch?app_id=some.other.app", { method: "POST" })).status, 404);
});

test("settings: 503 until a page is open; then reads, writes and launches reach the page", async () => {
  const closed = await api(settings);
  assert.equal(closed.status, 503);
  assert.match(((await closed.json()) as { error: string }).error, /open .*in a browser/);
  assert.equal((await api(`apps/launch?app_id=${APP}`, { method: "POST" })).status, 503);

  const page = await openPage();
  assert.equal((await page.post({ mode: "a", remote: "" })).status, 204);
  const read = await api(settings);
  assert.equal(read.status, 200);
  assert.deepEqual(await read.json(), { version: 7, values: { mode: "a", remote: "" } });

  // A companion's write: the whole document back, with a request in it.
  const doc = { version: 7, values: { mode: "a", remote: "1 1793210000 play ticket encounter" } };
  const put = await api(settings, { method: "PUT", headers: json, body: JSON.stringify(doc) });
  assert.equal(put.status, 200);
  assert.deepEqual(await page.next("the settings event"), { event: "settings", data: { values: doc.values } });
  assert.deepEqual(await (await api(settings)).json(), doc, "a read right after the write sees it");

  const bad = await api(settings, { method: "PUT", headers: json, body: "[1]" });
  assert.equal(bad.status, 400);

  assert.equal((await api(`apps/launch?app_id=${APP}`, { method: "POST" })).status, 200);
  assert.deepEqual(await page.next("the launch event"), { event: "launch", data: {} });

  // The page's own changes (the form, a script) are what later reads see.
  await page.post({ mode: "b", remote: "1 1793210000 play ticket encounter" });
  assert.deepEqual(((await (await api(settings)).json()) as { values: unknown }).values, { mode: "b", remote: "1 1793210000 play ticket encounter" });

  await page.close();
  let status = 0;
  for (let i = 0; i < 40 && status !== 503; i++) {
    await new Promise((r) => setTimeout(r, 25));
    status = (await api(settings)).status;
  }
  assert.equal(status, 503, "closing the page takes the API with it");
});

test("other web pages can't use it", async () => {
  const res = await api("version", { headers: { Origin: "http://example.com" } });
  assert.equal(res.status, 403);
});

test("a port in use fails with a message that names --port", async () => {
  await assert.rejects(serve(dir, { port: s.port, log: () => {} }), /already in use.*--port/);
});

test("a folder without a built page fails clearly", async () => {
  const empty = mkdtempSync(join(tmpdir(), "bar-sim-empty-"));
  try {
    await assert.rejects(serve(empty, { port: 0, log: () => {} }), /No simulator page/);
  } finally {
    rmSync(empty, { recursive: true, force: true });
  }
});
