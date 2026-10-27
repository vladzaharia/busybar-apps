import assert from "node:assert/strict";
import { test } from "node:test";
import { CATALOG, Raster, buildAnim, clip, decodeAnim, layer, pause, seq } from "../src/index.ts";

test("every catalog demo renders at its display's size without throwing", () => {
  const ids = new Set<string>();
  for (const e of CATALOG) {
    assert.ok(!ids.has(e.id), `duplicate id ${e.id}`);
    ids.add(e.id);
    const [w, h] = e.display === "front" ? [72, 16] : [148, 80];
    for (const k of [0, 0.5, 1]) e.demo.draw(new Raster(w, h), e.demo.duration * k);
    assert.ok(e.demo.duration > 0.3 && e.demo.duration < 6, `${e.id}: demo should be short`);
  }
});

test("seq and layer place clips in time", () => {
  const seen: string[] = [];
  const mark = (name: string, d: number) => clip(d, (_r, t) => seen.push(`${name}@${t.toFixed(2)}`));
  const c = layer(seq(mark("a", 1), pause(0.5), mark("b", 1)), { clip: mark("c", 0.5), at: 2 });
  assert.equal(c.duration, 2.5);
  c.draw(new Raster(1, 1), 2.25);
  assert.deepEqual(seen, ["b@0.75", "c@0.25"]);
});

test("buildAnim makes one section per part, with exact frame ranges", () => {
  const solid = (v: number) => clip(0.5, (r) => r.fillRect(0, 0, r.width, r.height, { r: v, g: v, b: v, a: 1 }));
  const built = buildAnim({ width: 8, height: 4, fps: 30, format: "rgb888", parts: [["one", solid(0.2)], ["two", solid(0.8)]] });
  assert.deepEqual(built.sections, { default: 30, one: 15, two: 15 });
  const d = decodeAnim(built.data);
  assert.deepEqual(d.sections.map((s) => [s.name, s.start, s.end]), [["default", 0, 29], ["one", 0, 14], ["two", 15, 29]]);
  assert.equal(d.frames[15]![0], Math.round(0.8 * 255));
});

test("text effects draw with only their required options (no NaN from unset ones)", async () => {
  const { dropIn, glide, typewriter, wave, roll, capCentre } = await import("../src/index.ts");
  const clips = [
    dropIn({ text: "HELLO", font: "extra_large", x: 4, y: capCentre("extra_large"), duration: 2 }),
    glide({ text: "HELLO THERE", font: "extra_large", y: 1, endX: 0, duration: 2 }),
    typewriter({ lines: ["Hello", "there"], font: "small", x: 2, ys: [0, 7], duration: 2 }),
    wave({ text: "HELLO", font: "bold", x: 2, y: 2, duration: 2 }),
    roll({ words: [{ text: "HI", font: "bold", hold: 1 }], box: { x: 0, width: 72 } }),
  ];
  for (const c of clips) {
    const r = new Raster(72, 16);
    c.draw(r, c.duration * 0.9);
    assert.ok(!r.data.some(Number.isNaN), "no NaN pixels");
    assert.ok(r.data.some((v, i) => i % 4 === 3 && v > 0), "something is drawn");
  }
});
