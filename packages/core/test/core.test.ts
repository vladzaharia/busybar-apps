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

test("clock face follows the stock clock layout, with a wider gap after the icon", () => {
  const els = core.clockFace(new Date(2026, 9, 27, 14, 27, 1), {
    timeFormat: "24h",
    showDate: true,
    blinkColons: true,
    icon: "images/calendar.png",
  });
  const byId = Object.fromEntries(els.map((e) => [e.id, e]));
  // The stock Clock app's arithmetic for 14:27 on Tue 27 Oct, with 4 px after the icon instead of its 2: "14:27" is
  // 30 px in bold, "Oct, Tue" 28 px in small, plus 13 + 4 px for the icon, so 47 px centred in 72 starts at x = 12
  // and the time at 29.
  assert.deepEqual([byId["clock.icon"]!.x, byId["clock.icon"]!.y], [12, 1]);
  assert.deepEqual([byId["clock.day"]!.x, byId["clock.day"]!.y], [15, 6]);
  assert.deepEqual([byId["clock.time0"]!.x, byId["clock.time0"]!.y], [29, -1]);
  assert.deepEqual([byId["clock.time1"]!.x, byId["clock.time1"]!.y], [45, -1]);
  assert.equal((byId["clock.colon1"] as { color: string }).color, "#FFFFFF66");
  assert.deepEqual([byId["clock.sub"]!.x, byId["clock.sub"]!.y], [29, 8]);
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

test("sprintAt: Sprint 22 from Thursday 22 October 2026, two weeks", () => {
  const cfg = { number: 22, start: "2026-10-22", weeks: 2 };
  const at = (y: number, m: number, d: number) => core.sprintAt(new Date(y, m - 1, d, 14, 27), cfg);
  const wed = at(2026, 10, 28);
  assert.deepEqual([wed.number, wed.days, wed.done, wed.left, wed.workday], [22, 10, 4, 6, true]);
  assert.equal(wed.end.getDate(), 4); // Wednesday 4 November
  const lastDay = at(2026, 11, 4);
  assert.deepEqual([lastDay.number, lastDay.left], [22, 1]);
  const saturday = at(2026, 10, 31);
  assert.deepEqual([saturday.done, saturday.left, saturday.workday], [7, 3, false]);
  const next = at(2026, 11, 5);
  assert.deepEqual([next.number, next.done, next.left], [23, 0, 10]);
  const before = at(2026, 10, 21);
  assert.deepEqual([before.number, before.left], [21, 1]);
  const threeWeeks = core.sprintAt(new Date(2026, 9, 28), { ...cfg, weeks: 3 });
  assert.deepEqual([threeWeeks.days, threeWeeks.left], [15, 11]);
  // A bad start date falls back to today rather than failing.
  assert.equal(core.sprintAt(new Date(2026, 9, 28), { ...cfg, start: "soon" }).number, 22);
});

test("sprint clock faces", () => {
  const now = new Date(2026, 9, 28, 14, 27, 0);
  const sprint = core.sprintAt(now, { number: 22, start: "2026-10-22", weeks: 2 });
  const base = { timeFormat: "24h" as const, showDate: true, blinkColons: false, icon: "images/calendar.png" };
  const bar = core.sprintClockFace(now, sprint, { ...base, style: "bar" });
  const segs = bar.filter((e) => e.id.startsWith("clock.seg"));
  assert.equal(segs.length, 10);
  for (const s of segs) assert.equal(s.y, 15);
  const dots = core.sprintClockFace(now, sprint, { ...base, style: "dots" });
  assert.equal(dots.filter((e) => e.id.startsWith("clock.dot")).length, 10);
  assert.equal((dots.find((e) => e.id === "clock.sub") as { text: string }).text, "S22");
  const majora = core.sprintClockFace(now, sprint, { ...base, style: "majora" });
  assert.equal((majora.find((e) => e.id === "clock.icon") as { path: string }).path, "images/calendar.png");
  assert.equal((majora.find((e) => e.id === "clock.sub") as { text: string }).text, "S22 6 left");
  assert.ok(majora.some((e) => e.id === "clock.day"));
  // Every element lies on the screen.
  for (const e of [...bar, ...dots, ...majora]) assert.ok((e.x ?? 0) >= 0 && (e.x ?? 0) < 72 && (e.y ?? 0) >= -2 && (e.y ?? 0) < 16, e.id);
});

test("LiveFace clears only ids it drew before and no longer draws", async () => {
  const calls: string[] = [];
  const device = {
    draw: async (els: { id: string }[]) => void calls.push(`draw ${els.map((e) => e.id).join(",")}`),
    clear: async (ids: string[]) => void calls.push(`clear ${ids.join(",")}`),
  };
  const face = new core.LiveFace(device as never, "clock");
  const el = (id: string) => ({ type: "text", id, text: id, font: "small", x: 0, y: 0 }) as never;
  face.draw([el("a"), el("b")]);
  face.draw([el("a"), el("c")]);
  face.draw([el("a"), el("c")]);
  assert.deepEqual(calls, ["draw a,b", "clear b", "draw a,c", "draw a,c"]);
});

test("sprint changes: moved starts, lengths, days off", () => {
  const base = { number: 22, start: "2026-10-22", weeks: 2 };
  const at = (date: string, changes: string) => core.sprintAt(new Date(`${date}T12:00:00`), { ...base, changes });
  const fmt = (s: ReturnType<typeof core.sprintAt>) => `${s.number} ${s.start.toDateString()} - ${s.end.toDateString()} ${s.done}+${s.left}/${s.days}`;

  // No changes: regular cadence, far ahead too.
  assert.equal(fmt(at("2027-03-04", "")), "31 Thu Feb 25 2027 - Wed Mar 10 2027 5+5/10");

  // Sprint 26 moved a week later and made 3 weeks long; sprint 25 runs until it, later sprints follow on.
  const moved = "26=2026-12-24/3w";
  assert.equal(fmt(at("2026-12-21", moved)), "25 Thu Dec 03 2026 - Wed Dec 23 2026 12+3/15");
  assert.equal(fmt(at("2026-12-28", moved)), "26 Thu Dec 24 2026 - Wed Jan 13 2027 2+13/15");
  assert.equal(at("2027-01-14", moved).number, 27);

  // Only a length: sprint 23 is 1 week, 24 starts right after.
  assert.equal(fmt(at("2026-11-12", "23/1w")), "24 Thu Nov 12 2026 - Wed Nov 25 2026 0+10/10");

  // A change of cadence: from sprint 30 on, three weeks (29 starts Jan 28 as usual; 30 Feb 11; 31 Mar 4).
  const three = "30+/3w";
  assert.equal(fmt(at("2027-03-03", three)), "30 Thu Feb 11 2027 - Wed Mar 03 2027 14+1/15");
  assert.equal(at("2027-03-04", three).number, 31);
  assert.equal(at("2027-03-24", three).number, 31);
  assert.equal(at("2027-03-25", three).number, 32);

  // Days off are not work days.
  const off = at("2026-10-28", "off=2026-10-30, off=2026-11-02..2026-11-03");
  assert.deepEqual([off.days, off.done, off.left], [7, 4, 3]);
  assert.equal(at("2026-10-30", "off=2026-10-30").workday, false);

  // A renumbering: sprint 28 starts after 26 (27 skipped).
  assert.equal(at("2027-01-14", "28=2027-01-14").number, 28);

  // Bad entries are reported and ignored.
  const parsed = core.parseSprintChanges("26=2026-13-01, banana, 27/0w, off=2026-12-25");
  assert.deepEqual(parsed.bad, ["26=2026-13-01", "banana", "27/0w"]);
  assert.equal(parsed.off.length, 1);
});
