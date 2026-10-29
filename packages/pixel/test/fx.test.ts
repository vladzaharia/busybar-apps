import assert from "node:assert/strict";
import { test } from "node:test";
import {
  CATALOG,
  DIALOGUE_LIGHT,
  MARK_OPTICAL_CENTRE,
  MARK_SPRITES,
  Raster,
  arrowNudge,
  buildAnim,
  clip,
  collapse,
  decodeAnim,
  dialogueRise,
  drawJiraMark,
  drawPanel,
  drawJiraTicket,
  flash,
  font,
  hex,
  inkWidth,
  jiraMarkIn,
  layer,
  mirrorX,
  pause,
  renderFrames,
  rng,
  seq,
  speechBubbleSize,
  spinner,
  starfield,
  textWidth,
  wipeOut,
  type Clip,
} from "../src/index.ts";

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

test("flash makes exactly `count` separate flashes", () => {
  for (const count of [1, 2, 3, 4]) {
    const c = flash({ count });
    let flashes = 0;
    let lit = false;
    for (let f = 0; f < Math.round(c.duration * 240); f++) {
      const r = new Raster(4, 4);
      c.draw(r, f / 240);
      const on = r.data[3]! > 0.5;
      if (on && !lit) flashes++;
      lit = on;
    }
    assert.equal(flashes, count);
  }
});

/** Pixel centres of everything lit (alpha above `min`) on `r`, as [x, y]. */
function lit(r: Raster, min = 0): [number, number][] {
  const out: [number, number][] = [];
  for (let y = 0; y < r.height; y++) for (let x = 0; x < r.width; x++) if (r.data[(y * r.width + x) * 4 + 3]! > min) out.push([x, y]);
  return out;
}

test("last frame is drawn at duration", () => {
  // Fills only once the clip has run its whole length: the last rendered frame is the only one that can.
  const c = clip(0.5, (r, t) => t >= 0.5 && r.fillRect(0, 0, r.width, r.height, hex("#FFFFFF")));
  const frames = renderFrames(c, { width: 2, height: 2, fps: 60 });
  assert.equal(frames.length, 30, "the frame count is unchanged");
  assert.equal(frames[frames.length - 1]![3], 255, "the last frame is lit");
  assert.equal(frames[frames.length - 2]![3], 0, "and only the last");
  // buildAnim renders through the same path, so the shipped section ends on it too.
  const built = buildAnim({ width: 2, height: 2, fps: 60, format: "argb8888", parts: [["a", c]] });
  assert.equal(built.sections.a, 30);
  assert.equal(decodeAnim(built.data).frames[29]![3], 255);
});

test("inkWidth drops the trailing bearing", () => {
  assert.equal(inkWidth("HI", font("tiny")), textWidth("HI", font("tiny")) - 1);
  // The period has a 2 px bearing, a space has no ink to trim, and an empty string has no width at all.
  assert.equal(inkWidth("A.", font("normal")), textWidth("A.", font("normal")) - 2);
  assert.equal(inkWidth("A ", font("normal")), textWidth("A ", font("normal")));
  assert.equal(inkWidth("", font("normal")), 0);
});

test("mirrorX mirrors", () => {
  assert.equal(mirrorX(3, 30, -1), 39);
  assert.equal(mirrorX(3, 30, 1), 3);
  assert.equal(mirrorX(3, 30, -1, 148), 115);
});

test("jira mark is optically centred", () => {
  for (const size of [11, 12, 16] as const) {
    const box = { x: 0, y: 0, width: size + 4, height: size + 4 };
    const at = jiraMarkIn(box, size);
    const r = new Raster(box.width, box.height);
    drawJiraMark(r, at.x, at.y, size);
    const px = lit(r);
    const cx = px.reduce((a, [x]) => a + x + 0.5, 0) / px.length;
    const cy = px.reduce((a, [, y]) => a + y + 0.5, 0) / px.length;
    assert.ok(Math.abs(cx - box.width / 2) <= 0.35, `size ${size}: centroid x ${cx} in a box centred on ${box.width / 2}`);
    assert.ok(Math.abs(cy - box.height / 2) <= 0.35, `size ${size}: centroid y ${cy} in a box centred on ${box.height / 2}`);
  }
});

test("jira mark's optical centre is computed from its sprites, and jiraMarkIn keeps its padding", () => {
  const expected = { 11: [6.21, 4.79], 12: [6.94, 5.06], 16: [9.01, 6.7] } as const;
  for (const size of [11, 12, 16] as const) {
    assert.ok(MARK_SPRITES[size]);
    assert.ok(Math.abs(MARK_OPTICAL_CENTRE[size].x - expected[size][0]) < 0.01, `size ${size} x`);
    assert.ok(Math.abs(MARK_OPTICAL_CENTRE[size].y - expected[size][1]) < 0.01, `size ${size} y`);
  }
  // The stock 16 px sign: a 12 px mark lands at (1, 3), and in a box with no room to spare it stays inside the padding.
  assert.deepEqual(jiraMarkIn({ x: 0, y: 0, width: 16, height: 16 }, 12), { x: 1, y: 3 });
  assert.deepEqual(jiraMarkIn({ x: 10, y: 20, width: 14, height: 14 }, 12), { x: 11, y: 21 });
  assert.deepEqual(jiraMarkIn({ x: 0, y: 0, width: 16, height: 16 }, 12, 2), { x: 2, y: 2 });
});

test("wipeOut ends transparent", () => {
  const src = clip(0.4, (r, t) => r.fillRect(0, 0, r.width, r.height, { r: t / 0.4, g: 0.5, b: 1, a: 1 }));
  for (const direction of [1, -1] as const) {
    const w = wipeOut(src, { duration: 0.25, direction });
    const first = new Raster(72, 16);
    w.draw(first, 0);
    const lastOfSource = new Raster(72, 16);
    src.draw(lastOfSource, src.duration);
    assert.deepEqual(first.data, lastOfSource.data, "starts on the source's last frame");
    const last = new Raster(72, 16);
    w.draw(last, w.duration);
    assert.equal(lit(last).length, 0, "ends with nothing left");
    // In between, it is going: more gone than at the start, less than at the end, and from the side it moves away from.
    const mid = new Raster(72, 16);
    w.draw(mid, w.duration * 0.6);
    const left = lit(mid).filter(([x]) => x < 36).length;
    const right = lit(mid).filter(([x]) => x >= 36).length;
    assert.ok(left + right > 0 && left + right < 72 * 16, "partly wiped");
    assert.ok(direction === 1 ? left < right : right < left, "from the side it starts at");
  }
});

test("rng starts spread", () => {
  assert.ok(Math.abs(rng(1)() - rng(2)()) > 0.1);
  const firsts = Array.from({ length: 32 }, (_, i) => rng(i + 1)());
  const mean = firsts.reduce((a, b) => a + b, 0) / firsts.length;
  assert.ok(mean >= 0.35 && mean <= 0.65, `mean of the first values ${mean}`);
  // Still reproducible, and a different seed gives a different stream.
  assert.equal(rng(7)(), rng(7)());
  const a = rng(7);
  const b = rng(8);
  assert.notEqual(a() + a() + a(), b() + b() + b());
});

test("spinner ring is round", () => {
  const c = spinner({ duration: 1, x: 10, y: 10 });
  for (const t of [0, 0.13, 0.37, 0.6]) {
    const r = new Raster(21, 21);
    c.draw(r, t);
    const offsets = lit(r).map(([x, y]) => `${x - 10},${y - 10}`);
    assert.equal(offsets.length, 8);
    for (const o of offsets) {
      const [dx, dy] = o.split(",").map(Number) as [number, number];
      assert.ok(offsets.includes(`${-dx},${-dy}`), `${o} has no opposite at t=${t}`);
    }
    // Every dot stays bright enough to show on the LEDs.
    for (const [x, y] of lit(r)) assert.ok(r.data[(y * 21 + x) * 4 + 3]! >= 0.3 - 1e-6, "alpha floor");
  }
});

test("flash peaks at 0.6, and the dialogue box fill is softer than before", () => {
  const c = flash({ count: 1 });
  let peak = 0;
  for (let f = 0; f <= 120; f++) {
    const fr = new Raster(2, 2);
    c.draw(fr, (f / 120) * c.duration);
    peak = Math.max(peak, fr.data[3]!);
  }
  assert.ok(Math.abs(peak - 0.6) < 0.01, `peak ${peak}`);
  assert.deepEqual(DIALOGUE_LIGHT.fill, hex("#9DA9BC"));
});

test("dialogueRise is the empty box rising, without text or arrow", () => {
  const c = dialogueRise({});
  assert.ok(Math.abs(c.duration - 0.18) < 1e-9);
  const start = new Raster(72, 16);
  c.draw(start, 0);
  assert.equal(lit(start).length, 0, "nothing on screen to begin with");
  const mid = new Raster(72, 16);
  c.draw(mid, c.duration / 2);
  const end = new Raster(72, 16);
  c.draw(end, c.duration);
  assert.ok(lit(mid).length > 0 && lit(mid).length < lit(end).length, "rising");
  assert.equal(lit(end).length, 72 * 16 - 4 * 1, "a full box (round corners aside) with nothing written in it");
  // Only fill and border colours: no ink, no arrow.
  const colours = new Set<string>();
  for (const [x, y] of lit(end)) colours.add([0, 1, 2].map((k) => Math.round(end.data[(y * 72 + x) * 4 + k]! * 255)).join(","));
  assert.equal(colours.size, 2);
});

test("collapse squashes its source's last frame onto the centre row before the line", () => {
  // The source is yellow (red 1); the line is light blue (blue 1, red low); the ground is black.
  const src = clip(0.5, (r, t) => r.fillRect(0, 0, r.width, r.height, { r: 1, g: t / 0.5, b: 0, a: 1 }));
  const c = collapse({ duration: 0.65, source: src });
  assert.equal(c.duration, 0.65);
  const column = (clipped: Clip, t: number, channel: number) => {
    const r = new Raster(72, 16);
    clipped.draw(r, t);
    return Array.from({ length: 16 }, (_, y) => y).filter((y) => r.data[(y * 72 + 36) * 4 + channel]! > 0.5);
  };
  // At the start it is still the source's last frame, whole; it thins towards the middle, and has gone by the 0.12 s
  // mark, with the line in its place.
  assert.equal(column(c, 0, 0).length, 16, "starts whole");
  const thinner = column(c, 0.06, 0).length;
  assert.ok(thinner < 16 && thinner > 2, `squashing: ${thinner} rows`);
  assert.equal(column(c, 0.12, 0).length, 0, "the picture has folded away");
  assert.deepEqual(column(c, 0.12, 2), [7, 8], "onto the centre line");
  // Without a source, it is the line from the first frame.
  assert.deepEqual(column(collapse({ duration: 0.65 }), 0, 2), [7, 8]);
});

test("drawPanel's sheen can run right to left, as the mirror of left to right", () => {
  const a = new Raster(72, 16);
  const b = new Raster(72, 16);
  drawPanel(a, { sheen: 20 });
  drawPanel(b, { sheen: 20, sheenDir: -1 });
  assert.notDeepEqual(a.data, b.data);
  for (let y = 0; y < 16; y++) {
    for (let x = 0; x < 72; x++) {
      for (let k = 0; k < 4; k++) {
        assert.ok(Math.abs(a.data[(y * 72 + x) * 4 + k]! - b.data[(y * 72 + (71 - x)) * 4 + k]!) < 1e-6, `(${x},${y}) channel ${k}`);
      }
    }
  }
});

test("arrowNudge's streak mirrors exactly, and is bright enough to light", () => {
  const draw = (dir: 1 | -1, x: number) => {
    const r = new Raster(72, 16);
    arrowNudge({ duration: 1, x, y: 1, dir }).draw(r, 0.21);
    return r;
  };
  // Mid-nudge, 13 px arrows: starting at x and 59 - x puts them mirror to mirror on a 72 px screen.
  const right = draw(1, 30);
  const left = draw(-1, 59 - 30);
  for (let y = 0; y < 16; y++) {
    for (let x = 0; x < 72; x++) {
      for (let k = 0; k < 4; k++) {
        assert.ok(Math.abs(left.data[(y * 72 + x) * 4 + k]! - right.data[(y * 72 + (71 - x)) * 4 + k]!) < 1e-6, `(${x},${y}) channel ${k}`);
      }
    }
  }
  const streak = lit(left).filter(([x, y]) => y === 6 && x > 39);
  assert.equal(streak.length, 6, "three 2 px dashes behind the arrow");
  for (const [x, y] of streak) assert.ok(left.data[(y * 72 + x) * 4 + 3]! >= 0.3 - 1e-6, "alpha floor");
});

test("starfield spreads evenly at any speed", () => {
  for (const speed of [0.05, 0.35, 1.2]) {
    let centre = 0;
    let outer = 0;
    for (const seed of [1, 2, 3]) {
      const c = starfield({ duration: 3, speed, stars: 400, seed });
      for (let t = 0; t < 3; t += 0.05) {
        const r = new Raster(72, 16);
        c.draw(r, t);
        for (const [x] of lit(r)) x >= 24 && x < 48 ? centre++ : outer++;
      }
    }
    // Per pixel: the centre third is 24 columns of 72, the rest 48.
    const ratio = centre / 24 / (outer / 48);
    assert.ok(ratio > 0.75 && ratio < 1.33, `speed ${speed}: centre third is ${ratio.toFixed(2)}x as dense`);
  }
});

test("speech bubble padding is even around the ink", () => {
  const f = font("tiny");
  assert.equal(speechBubbleSize("HI!").width, inkWidth("HI!", f) + 4);
});

test("the ticket's inner layout is tidy", () => {
  const r = new Raster(22, 13);
  drawJiraTicket(r, 0, 0);
  const rgb = (x: number, y: number) => [0, 1, 2].map((k) => Math.round(r.data[(y * 22 + x) * 4 + k]! * 255)).join(",");
  const grey = rgb(14, 1);
  // Summary lines on rows 1 and 3, starting at x 14.
  assert.equal(rgb(14, 1), rgb(20, 1));
  assert.equal(rgb(14, 3), grey);
  assert.notEqual(rgb(13, 1), grey);
  assert.notEqual(rgb(14, 2), grey);
  // The checkbox spans rows 6..10 with the shadow row left clear below it, and the tick stays inside its edge.
  const blue = rgb(14, 6);
  assert.equal(rgb(18, 10), blue);
  assert.notEqual(rgb(14, 11), blue);
  assert.equal(rgb(18, 7), blue, "the right edge is whole");
  assert.notEqual(rgb(17, 7), blue, "the tick's top pixel is inside it");
});
