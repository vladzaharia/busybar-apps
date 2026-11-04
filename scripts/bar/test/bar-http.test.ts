import assert from "node:assert/strict";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { test } from "node:test";
import { barAnswers, barUrl, quitRunningApp } from "../src/bar-http.ts";
import { resolveDevice } from "../src/device.ts";

/** A stand-in bar: answers every request with `status`, and records what it was sent. */
async function fakeBar(status: () => number): Promise<{ server: Server; addr: string; seen: string[] }> {
  const seen: string[] = [];
  const server = createServer((req, res) => {
    seen.push(`${req.method} ${req.url} token=${req.headers["x-api-token"] ?? "-"}`);
    res.writeHead(status(), { "content-type": "application/json" }).end("{}");
  });
  await new Promise<void>((done) => server.listen(0, "127.0.0.1", done));
  return { server, addr: `127.0.0.1:${(server.address() as AddressInfo).port}`, seen };
}

test("barUrl: the address as busy-cli reads it, the bar on USB without one", () => {
  assert.equal(barUrl(resolveDevice({}, {}, {})), "http://10.0.4.20");
  assert.equal(barUrl(resolveDevice({ addr: "192.168.1.42" }, {}, {})), "http://192.168.1.42");
  assert.equal(barUrl(resolveDevice({ addr: "https://bar.local:8443/" }, {}, {})), "https://bar.local:8443");
});

test("quitRunningApp: quits what runs, with the password as busy-cli sends it; nothing running is fine", async () => {
  let status = 200;
  const bar = await fakeBar(() => status);
  try {
    const device = resolveDevice({ addr: bar.addr, password: "pw" }, {}, {});
    assert.deepEqual(await quitRunningApp(device), { kind: "quit" });
    status = 409;
    assert.deepEqual(await quitRunningApp(device), { kind: "none" });
    status = 503;
    assert.deepEqual(await quitRunningApp(device), { kind: "failed", reason: "the bar answered 503" });
    assert.deepEqual(bar.seen, Array(3).fill("POST /api/apps/quit token=pw"));
  } finally {
    bar.server.close();
  }
});

test("quitRunningApp and barAnswers: a bar that isn't there", async () => {
  const bar = await fakeBar(() => 200);
  const device = resolveDevice({ addr: bar.addr }, {}, {});
  assert.equal(await barAnswers(device), true);
  await new Promise((done) => bar.server.close(done));
  assert.equal(await barAnswers(device), false);
  assert.deepEqual(await quitRunningApp(device), { kind: "unreachable" });
});
