import assert from "node:assert/strict";
import { test } from "node:test";
import { buildAnim, clip } from "@vladzaharia/bar-pixel";
import { Device } from "../src/device.ts";

// Three 10-frame sections at 10 fps; each frame's red channel encodes (section index * 10 + frame).
const parts: [string, ReturnType<typeof clip>][] = ["a", "b", "c"].map((name, si) => [
  name,
  clip(1, (r, t) => r.fillRect(0, 0, r.width, r.height, { r: (si * 10 + Math.round(t * 10)) / 255, g: 0, b: 0, a: 1 })),
]);
const anim = buildAnim({ width: 2, height: 2, fps: 10, format: "rgb888", parts }).data;

function device() {
  const lines: string[] = [];
  const d = new Device({
    asset: async () => anim,
    decodePng: async () => ({ width: 1, height: 1, data: new Uint8ClampedArray(4) }),
    settings: () => ({ mode: "x" }),
    log: (l) => lines.push(l),
  });
  return { d, lines };
}
const draw = (d: Device, el: Record<string, unknown>) =>
  d.handle("POST", "/display/draw", JSON.stringify({ application_name: "t", elements: [{ id: "m", type: "animation", path: "animations/x.anim", ...el }] }));
/** The red value of the animation's top-left pixel on the front screen = which frame is showing. */
const shown = (d: Device) => d.screens.front.data[0]!;
const step = (d: Device, frames: number) => {
  for (let i = 0; i < frames; i++) d.tick(0.1);
};

test("a queued section starts when the current one ends, and loops", async () => {
  const { d } = device();
  await draw(d, { section: "a" });
  await draw(d, { section: "b", await_previous_end: true, loop: true });
  d.tick(0);
  assert.equal(shown(d), 0);
  step(d, 9);
  assert.equal(shown(d), 9, "still in a");
  step(d, 1);
  assert.equal(shown(d), 10, "b starts after a's last frame");
  step(d, 10);
  assert.equal(shown(d), 10, "b loops");
});

test("a newer queued request replaces the waiting one (one slot), and play-now overrides", async () => {
  const { d } = device();
  await draw(d, { section: "a" });
  await draw(d, { section: "b", await_previous_end: true });
  await draw(d, { section: "c", await_previous_end: true });
  step(d, 10);
  assert.equal(shown(d), 20, "c, not b");
  await draw(d, { section: "a" });
  d.tick(0);
  assert.equal(shown(d), 0, "play-now switches at once");
});

test("a section that ends without loop holds its last frame", async () => {
  const { d } = device();
  await draw(d, { section: "b" });
  step(d, 25);
  assert.equal(shown(d), 19);
});

test("timeouts remove elements; z order decides what is on top; clear checks ids", async () => {
  const { d } = device();
  await d.handle("POST", "/display/draw", JSON.stringify({ application_name: "t", elements: [
    { id: "low", type: "rectangle", width: 72, height: 16, fill: "solid", fill_colors: ["#FF0000FF"], border_width: 0, z_index: 1 },
    { id: "high", type: "rectangle", width: 72, height: 16, fill: "solid", fill_colors: ["#0000FFFF"], border_width: 0, z_index: 2, timeout: 1 },
  ] }));
  d.tick(0.5);
  assert.deepEqual([...d.screens.front.data.slice(0, 3)], [0, 0, 255]);
  d.tick(0.6);
  assert.deepEqual([...d.screens.front.data.slice(0, 3)], [255, 0, 0], "the timed-out one is gone");
  const bad = await d.handle("DELETE", "/display/draw", JSON.stringify({ element_ids: ["nope"] }));
  assert.equal(bad.status, 400);
  const ok = await d.handle("DELETE", "/display/draw", JSON.stringify({ element_ids: ["low"] }));
  assert.equal(ok.status, 200);
});

test("apps can read settings but not reach endpoints closed to them", async () => {
  const { d } = device();
  assert.deepEqual((await d.handle("GET", "/apps/settings?app_id=t", null)).json, { version: 1, values: { mode: "x" } });
  assert.equal((await d.handle("POST", "/storage/write?path=/x", "hi")).status, 403);
});
