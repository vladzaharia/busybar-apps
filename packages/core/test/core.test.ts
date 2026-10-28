import assert from "node:assert/strict";
import { test } from "node:test";
import { font, textWidth as deviceWidth } from "@vladzaharia/bar-pixel";

// device.ts reads the build-time address when it loads.
(globalThis as { __BUSY_ADDR__?: string }).__BUSY_ADDR__ = "localhost";
const core = await import("../src/index.ts");

test("metrics match the firmware fonts", () => {
  for (const name of ["small", "bold", "extra_large", "superscript"] as const) {
    for (const s of ["Did you file a JIRA ticket yet???", "14:27", "Oct, Tue", "27"]) {
      assert.equal(core.textWidth(s, name), deviceWidth(s, font(name)), `${name}: ${s}`);
    }
  }
});

test("label centres on the capitals", () => {
  const l = core.label({ id: "t", text: "DID YOU", font: "extra_large" });
  // extra_large capitals are 10 px tall: rows 3..12 of 16, so the element's top is 1.
  assert.equal(l.y, 1);
  assert.equal(l.x, Math.floor((72 - core.textWidth("DID YOU", "extra_large")) / 2));
});

test("clock face matches the stock clock layout", () => {
  const els = core.clockFace(new Date(2026, 9, 27, 14, 27, 1), {
    timeFormat: "24h",
    showDate: true,
    blinkColons: true,
    icon: "images/calendar.png",
  });
  const byId = Object.fromEntries(els.map((e) => [e.id, e]));
  // The stock Clock app's arithmetic for 14:27 on Tue 27 Oct: "14:27" is 30 px in bold, "Oct, Tue" 28 px in small,
  // plus 13 + 2 px for the icon, so 45 px centred in 72 starts at x = 13 and the time at 28.
  assert.deepEqual([byId["clock.icon"]!.x, byId["clock.icon"]!.y], [13, 1]);
  assert.deepEqual([byId["clock.day"]!.x, byId["clock.day"]!.y], [16, 6]);
  assert.deepEqual([byId["clock.time0"]!.x, byId["clock.time0"]!.y], [28, -1]);
  assert.deepEqual([byId["clock.time1"]!.x, byId["clock.time1"]!.y], [44, -1]);
  assert.equal((byId["clock.colon1"] as { color: string }).color, "#FFFFFF66");
  assert.deepEqual([byId["clock.sub"]!.x, byId["clock.sub"]!.y], [28, 8]);
});

test("settings fall back field by field", () => {
  const s = core.readSettings(
    { mode: "nope", count: 3, on: "yes" },
    { mode: "a" as "a" | "b", count: 1, on: true },
    { mode: ["a", "b"], count: "integer", on: "boolean" },
  );
  assert.deepEqual(s, { mode: "a", count: 3, on: true });
});

test("device sends in order and coalesces waiting redraws", async () => {
  const sent: string[] = [];
  let release: (() => void) | null = null;
  globalThis.fetch = (async (_url: string, init: RequestInit) => {
    sent.push(String(init.body));
    await new Promise<void>((r) => (release = r));
    return new Response("{}", { status: 200 });
  }) as typeof fetch;
  const device = new core.Device({ app: "test", onError: () => {} });
  const el = (text: string) => [{ type: "text" as const, id: "t", text, font: "small" as const }];
  void device.draw(el("first"));
  void device.draw(el("tick1"), { coalesce: "tick" });
  void device.draw(el("tick2"), { coalesce: "tick" });
  void device.draw(el("anim"));
  for (let i = 0; i < 3; i++) {
    await new Promise((r) => setTimeout(r, 0));
    release!();
  }
  await device.settled();
  assert.deepEqual(
    sent.map((b) => JSON.parse(b).elements[0].text),
    ["first", "tick2", "anim"],
  );
});

test("progress bar and toast build valid elements", () => {
  const bar = core.progressBar({ id: "p", x: 10, y: 50, width: 100, height: 5, value: 0.25 });
  assert.equal(bar[1]!.width, 25);
  const t = core.toast({ id: "s", text: "STYLE: TICKER", seconds: 2 });
  assert.ok(t.every((e) => e.timeout === 2 && e.display === "back"));
});

test("shuffleBag gives every item once per round, in varying orders", () => {
  let seed = 7;
  const random = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x80000000);
  const next = core.shuffleBag(["a", "b", "c"], random);
  const orders = new Set<string>();
  for (let round = 0; round < 20; round++) {
    const got = [next(), next(), next()];
    assert.deepEqual([...got].sort(), ["a", "b", "c"]);
    orders.add(got.join(""));
  }
  assert.ok(orders.size > 1, "rounds should not all come out in the same order");
});
