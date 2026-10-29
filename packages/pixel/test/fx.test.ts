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
  drawSpeechBubble,
  flash,
  font,
  hex,
  inkWidth,
  iris,
  jiraMarkIn,
  layer,
  mirrorX,
  pause,
  renderFrames,
  rng,
  roadSignLayout,
  roll,
  scrollBand,
  scrollBandCentreLead,
  seq,
  speechBubbleSize,
  spinner,
  starfield,
  textWidth,
  titleCard,
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

test("layer keeps a placed clip on its own last frame despite rounding", () => {
  // `t - at` can come out a hair past the clip's duration (1.1 - 0.8 > 0.3); the clip must still draw there.
  let dropped = 0;
  for (const at of [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9]) {
    for (const d of [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7]) {
      let drawnAt = -1;
      const c = layer({ clip: clip(d, (_r, t) => (drawnAt = t)), at });
      c.draw(new Raster(1, 1), c.duration);
      if (Math.abs(drawnAt - d) > 1e-9) dropped++;
    }
  }
  assert.equal(dropped, 0);
  // Still nothing outside its window.
  let drawn = false;
  const c = layer(pause(1), { clip: clip(0.3, () => (drawn = true)), at: 0.2 });
  c.draw(new Raster(1, 1), 0.6);
  c.draw(new Raster(1, 1), 0.1);
  assert.equal(drawn, false);
});

test("buildAnim makes one section per part, with exact frame ranges", () => {
  const solid = (v: number) => clip(0.5, (r) => r.fillRect(0, 0, r.width, r.height, { r: v, g: v, b: v, a: 1 }));
  const built = buildAnim({ width: 8, height: 4, fps: 30, format: "rgb888", parts: [["one", solid(0.2)], ["two", solid(0.8)]] });
  assert.deepEqual(built.sections, { default: 32, one: 16, two: 16 });
  const d = decodeAnim(built.data);
  assert.deepEqual(d.sections.map((s) => [s.name, s.start, s.end]), [["default", 0, 31], ["one", 0, 15], ["two", 16, 31]]);
  assert.equal(d.frames[16]![0], Math.round(0.8 * 255));
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
  assert.equal(frames.length, 31, "a frame at every 1/60 s from 0 through 0.5");
  assert.equal(frames[frames.length - 1]![3], 255, "the last frame is lit");
  assert.equal(frames[frames.length - 2]![3], 0, "and only the last");
  // buildAnim renders through the same path, so the shipped section ends on it too.
  const built = buildAnim({ width: 2, height: 2, fps: 60, format: "argb8888", parts: [["a", c]] });
  assert.equal(built.sections.a, 31);
  assert.equal(decodeAnim(built.data).frames[30]![3], 255);
});

test("every step of a clip lasts one frame, the last too", () => {
  // A dot one column further along every 1/60 s: frame i shows it in column i, up to the end.
  const c = clip(0.5, (r, t) => r.fillRect(Math.round(t * 60), 0, 1, 1, hex("#FFFFFF")));
  const frames = renderFrames(c, { width: 31, height: 1, fps: 60 });
  frames.forEach((f, i) => assert.equal((f.findIndex((v, k) => k % 4 === 3 && v > 0) - 3) / 4, i, `frame ${i}`));
});

test("a loop ends a frame short, so its seam is not drawn twice", () => {
  const c = clip(0.5, (r, t) => r.fillRect(Math.round(t * 60) % 30, 0, 1, 1, hex("#FFFFFF")));
  const frames = renderFrames(c, { width: 30, height: 1, fps: 60, loop: true });
  assert.equal(frames.length, 30);
  frames.forEach((f, i) => assert.equal((f.findIndex((v, k) => k % 4 === 3 && v > 0) - 3) / 4, i, `frame ${i}`));
  const built = buildAnim({ width: 30, height: 1, fps: 60, format: "argb8888", parts: [["once", c], ["loop", c, { loop: true }]] });
  assert.deepEqual(built.sections, { default: 61, once: 31, loop: 30 });
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

test("starfield spreads evenly at any speed, and shows in the middle", () => {
  for (const speed of [0.05, 0.35, 1.2]) {
    let centre = 0;
    let outer = 0;
    // The default star count, counting only what an LED can show (alpha 0.3 and up).
    for (const seed of [1, 2, 3, 4, 5, 6, 7, 8]) {
      const c = starfield({ duration: 3, speed, seed });
      for (let t = 0; t < 3; t += 0.05) {
        const r = new Raster(72, 16);
        c.draw(r, t);
        for (const [x] of lit(r, 0.3 - 1e-6)) x >= 24 && x < 48 ? centre++ : outer++;
      }
    }
    // Per column: the centre third is 24 columns of 72, the rest 48.
    const ratio = centre / 24 / (outer / 48);
    assert.ok(centre > 0, `speed ${speed}: nothing visible in the centre third`);
    assert.ok(ratio > 0.5 && ratio < 2, `speed ${speed}: centre third is ${ratio.toFixed(2)}x as dense as the outer thirds`);
  }
});

test("speech bubble padding is even around the ink", () => {
  const f = font("tiny");
  assert.equal(speechBubbleSize("HI!").width, inkWidth("HI!", f) + 4);
  assert.equal(speechBubbleSize("HI!", "small").width, inkWidth("HI!", font("small")) + 4);
});

test("a speech bubble colours letters one by one", () => {
  const r = new Raster(20, 12);
  const RED = hex("#FF0000");
  drawSpeechBubble(r, { x: 2, top: 1, dir: 1, text: "HI?", font: "small", color: (_i, ch) => (ch === "?" ? RED : DIALOGUE_LIGHT.ink) });
  const px = r.toRGBA8();
  const red = (i: number) => px[i]! === 255 && px[i + 1]! === 0 && px[i + 3]! === 255;
  assert.ok(px.some((_, i) => i % 4 === 0 && red(i)), "the ? is red");
});

test("an iris can settle round its point before it shuts", () => {
  const c = iris({ mode: "cover", x: 36, y: 8, duration: 0.6, settle: { radius: 5, hold: 0.3 } });
  assert.ok(Math.abs(c.duration - 0.9) < 1e-9, "it lasts its duration and the hold");
  // Holding: clear well inside the circle, covered well outside it.
  for (const t of [0.45, 0.6]) {
    const r = new Raster(72, 16);
    c.draw(r, t);
    const a = (x: number, y: number) => r.data[(y * 72 + x) * 4 + 3]!;
    assert.equal(a(36, 8), 0, `${t}: the point shows`);
    assert.equal(a(33, 8), 0, `${t}: 3 px from it shows`);
    assert.equal(a(29, 8), 1, `${t}: 7 px from it is covered`);
  }
  const end = new Raster(72, 16);
  c.draw(end, c.duration);
  assert.equal(end.data[(8 * 72 + 36) * 4 + 3], 1, "and it ends shut");
});

test("wipeOut draws what it wipes once", () => {
  let draws = 0;
  const src = clip(1, (r) => (draws++, r.fillRect(0, 0, r.width, r.height, hex("#FFFFFF"))));
  renderFrames(wipeOut(src), { width: 8, height: 2, fps: 60 });
  assert.equal(draws, 1);
});

test("roll tells its colour which word a letter is in", () => {
  const words: number[] = [];
  const c = roll({ words: ["AB", "CD"].map((text) => ({ text, font: "small" as const, hold: 0.5 })), box: { x: 0, width: 30 }, rollTime: 0.2, color: (_i, _ch, _t, word) => (words.push(word), hex("#FFFFFF")) });
  c.draw(new Raster(30, 16), 0.4);
  assert.deepEqual([...new Set(words)].sort(), [0, 1], "both words while one rolls into the other");
});

test("a road sign's tab letters G with a bar, a column wider than the font's", () => {
  assert.equal(roadSignLayout({ tab: "GO!", dir: 1 }).tab.width, inkWidth("GO!", font("tiny")) + 1 + 4);
  assert.equal(roadSignLayout({ tab: "OK", dir: 1 }).tab.width, inkWidth("OK", font("tiny")) + 4);
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

test("the title card and the words roll centre on the ink", () => {
  const inkMargins = (r: Raster) => {
    const cols = lit(r, 0.5).map(([x]) => x);
    return { left: Math.min(...cols), right: r.width - 1 - Math.max(...cols) };
  };
  for (const [name, f] of [["extra_large", font("extra_large")], ["small", font("small")]] as const) {
    // Words whose ink is an even number of columns wide, which centring on the advance width left 2 px off.
    const words = ["HI", "NO", "WAIT", "DONE", "OK", "DID YOU"].filter((w) => inkWidth(w, f) % 2 === 0);
    assert.ok(words.length >= 2, `${name}: the sample has even-width words`);
    for (const text of words) {
      const card = new Raster(72, 16);
      titleCard({ lines: [{ text, font: name, cap: 3 }], duration: 3 }).draw(card, 1.5);
      // The title card's ground is black; the lettering is white.
      const white = new Raster(72, 16);
      for (let i = 0; i < card.data.length; i += 4) white.data[i + 3] = card.data[i]! > 0.5 ? 1 : 0;
      const t = inkMargins(white);
      assert.ok(Math.abs(t.left - t.right) <= 1, `title card ${name} ${text}: margins ${t.left} / ${t.right}`);

      const rolled = new Raster(72, 16);
      roll({ words: [{ text, font: name, hold: 1 }], box: { x: 0, width: 72 } }).draw(rolled, 0.5);
      const w = inkMargins(rolled);
      assert.ok(Math.abs(w.left - w.right) <= 1, `roll ${name} ${text}: margins ${w.left} / ${w.right}`);
    }
  }
});

test("arrowNudge draws as many streak dashes as asked", () => {
  const dashes = (streak?: number) => {
    const r = new Raster(72, 16);
    arrowNudge({ duration: 1, x: 30, y: 1, dir: 1, streak }).draw(r, 0.21);
    return lit(r).filter(([x, y]) => y === 6 && x < 33).length;
  };
  assert.equal(dashes(), 6, "three 2 px dashes by default");
  assert.equal(dashes(2), 4);
  assert.equal(dashes(0), 0);
});

test("scrollBand mirrors exactly, and its first name is centred at scrollBandCentreLead", () => {
  const RED = hex("#FF0000");
  const isName = (r: Raster, x: number, y: number) => r.data[(y * 72 + x) * 4]! > 0.99 && r.data[(y * 72 + x) * 4 + 1]! < 0.01;
  /** The columns the name's ink covers (pure red: no chevron or line is). */
  const nameCols = (r: Raster) => {
    const cols = new Set<number>();
    for (let y = 0; y < 16; y++) for (let x = 0; x < 72; x++) if (isName(r, x, y)) cols.add(x);
    return cols.size ? { x0: Math.min(...cols), x1: Math.max(...cols) } : null;
  };
  for (const text of ["SAM", "ALEX", "DAMIAN"]) {
    const draw = (dir: 1 | -1, lead: number) => {
      const r = new Raster(72, 16);
      scrollBand({ duration: 5, text, dir, lead: () => lead, color: RED }).draw(r, 0.4);
      return r;
    };
    const centre = scrollBandCentreLead(text);
    // Whole and half pixels alike: apart from the lettering (which is never flipped), the left band is the right band
    // flipped, and the name's ink sits mirrored.
    for (const lead of [40, 77, 91, 91.5, 100.5, 133, centre - 2.5, centre, centre + 3.5]) {
      const right = draw(1, lead);
      const left = draw(-1, lead);
      for (let y = 0; y < 16; y++) {
        for (let x = 0; x < 72; x++) {
          if (isName(left, x, y) || isName(right, 71 - x, y)) continue;
          for (let k = 0; k < 4; k++) {
            assert.ok(Math.abs(left.data[(y * 72 + x) * 4 + k]! - right.data[(y * 72 + (71 - x)) * 4 + k]!) < 1e-6, `${text} lead ${lead}: (${x},${y}) channel ${k}`);
          }
        }
      }
      const a = nameCols(right);
      const b = nameCols(left);
      if (a && b && a.x0 > 0 && a.x1 < 71) assert.deepEqual({ x0: 71 - b.x1, x1: 71 - b.x0 }, a, `${text} lead ${lead}: the name's ink is mirrored`);
    }
    // At the centre lead the first name's ink is centred, to the half pixel, and whole.
    for (const dir of [1, -1] as const) {
      const cols = nameCols(draw(dir, centre))!;
      assert.ok(cols, `${text}: the name is on screen`);
      assert.equal(cols.x1 - cols.x0 + 1, inkWidth(text, font("extra_large")), `${text}: the ink is whole`);
      assert.ok(Math.abs(cols.x0 - (71 - cols.x1)) <= 1, `${text} dir ${dir}: margins ${cols.x0} / ${71 - cols.x1}`);
    }
  }
});

// --- Pieces from the Jira nags (flap board, tear, slot reel, sprites) ----------------------------------------------

test("capTop puts the capitals' top on the row asked for", async () => {
  const { capTop } = await import("../src/index.ts");
  for (const name of ["tiny", "small", "normal", "extra_large"] as const) {
    const r = new Raster(72, 16);
    r.text("H", font(name), 0, capTop(name, 3), hex("#FFFFFF"));
    assert.equal(Math.min(...lit(r).map(([, y]) => y)), 3, name);
  }
});

test("a flap board comes on left to right and stops on its letters", async () => {
  const { flapBoard, capTop: top } = await import("../src/index.ts");
  const board = flapBoard({ lines: ["AB"], x: 10, rows: [4], cols: 3 });
  const blank = new Raster(72, 16);
  board.draw(blank, 0);
  assert.equal(lit(blank).length, 0, "nothing before the tiles come on");
  const done = new Raster(72, 16);
  board.draw(done, board.settled + 0.05);
  // Each letter rests centred on its ink in its 5 x 7 tile, its caps centred in the tile's height.
  for (const [col, ch] of [[0, "A"], [1, "B"]] as const) {
    const want = new Raster(72, 16);
    const f = font("small");
    want.text(ch, f, 10 + col * 6 + Math.round((5 - inkWidth(ch, f)) / 2), 4 + top("small", 1), hex("#FFFFFF"));
    const amber = (r: Raster, x: number, y: number) => r.data[(y * 72 + x) * 4]! > 0.9 && r.data[(y * 72 + x) * 4 + 2]! < 0.3;
    for (const [x, y] of lit(want)) assert.ok(amber(done, x, y), `${ch}: (${x},${y}) is lit`);
  }
});

test("tear leaves a clip alone at no amount, and slips the parts either side of its line", async () => {
  const { tear } = await import("../src/index.ts");
  const column = clip(1, (r) => r.fillRect(30, 0, 1, 16, hex("#FFFFFF")));
  const still = new Raster(72, 16);
  tear(column, { amount: 0 }).draw(still, 0.5);
  assert.deepEqual(lit(still).map(([x]) => x), Array(16).fill(30));
  const torn = new Raster(72, 16);
  tear(column, { amount: 6, seam: hex("#000000", 0) }).draw(torn, 0.5);
  const xs = new Set(lit(torn).map(([x]) => x));
  assert.deepEqual([...xs].sort((a, b) => a - b), [28, 36], "above the line 6 px one way, below it 2 px back");
});

test("a reel spun reelSteps symbols lands on the wanted one, centred in its window", async () => {
  const { drawReel, reelOffset, reelSteps } = await import("../src/index.ts");
  const strip = ["a", "b", "c", "b", "a"];
  const steps = reelSteps(strip, 1, (s) => s === "c", 7);
  assert.ok(steps >= 7);
  assert.equal(strip[(1 + steps) % strip.length], "c");
  const at = { at: 0, stop: 1, steps, gap: 15 };
  assert.equal(reelOffset(1, at), steps * 15);
  assert.ok(Math.abs(reelOffset(0, at)) < 1e-9);
  // At rest the landed symbol is the only one in the window, its top a row below the window's.
  const drawn: [string, number][] = [];
  const symbols = strip.map((s) => (_r: Raster, _cx: number, top: number) => void drawn.push([s, top]));
  drawReel(new Raster(72, 16), { x: 0, y: 1, width: 16, height: 14, strip: symbols, start: 1, offset: reelOffset(1, at), gap: 15 });
  assert.deepEqual(drawn.filter(([, top]) => top > -13 && top < 15), [["c", 2]]);
});

test("the 8-ball's body stays bright enough to light, and the ticket's face covers its lines", async () => {
  const { drawEightBall, ticketFace } = await import("../src/index.ts");
  const lum = (r: Raster, i: number) => 0.2126 * r.data[i]! + 0.7152 * r.data[i + 1]! + 0.0722 * r.data[i + 2]!;
  const floor = 0.2126 * 0x26 / 255 + 0.7152 * 0x2c / 255 + 0.0722 * 0x38 / 255;
  const ball = new Raster(24, 16);
  drawEightBall(ball, 11.5, 8, 7.6, 0);
  let body = 0;
  for (const [x, y] of lit(ball, 0.99)) {
    // The window (with its dark 8) is a circle of radius 4 about (11.5, 7.5); the rest is the ball's body.
    if (Math.hypot(x + 0.5 - 11.5, y + 0.5 - 7.5) <= 4.2) continue;
    body++;
    assert.ok(lum(ball, (y * 24 + x) * 4) >= floor, `(${x},${y}) is below what an LED shows`);
  }
  assert.ok(body > 100);
  const face = ticketFace({ eyes: "open" });
  const grey = hex("#6B778C");
  for (let y = 1; y <= 11; y++) {
    for (let x = 13; x <= 20; x++) {
      const i = (y * 22 + x) * 4;
      assert.ok(Math.abs(face.data[i]! - grey.r) > 0.02 || Math.abs(face.data[i + 2]! - grey.b) > 0.02, `summary line left at (${x},${y})`);
    }
  }
});

test("rain starts when asked and falls from under the cloud", async () => {
  const { drawRain } = await import("../src/index.ts");
  const before = new Raster(72, 16);
  drawRain(before, { x: 10, y: 6, t: 0.3, start: 0.4 });
  assert.equal(lit(before).length, 0);
  const rows = new Set<number>();
  for (let t = 0.4; t < 2; t += 0.05) {
    const r = new Raster(72, 16);
    drawRain(r, { x: 10, y: 6, t, start: 0.4 });
    for (const [x, y] of lit(r)) {
      assert.ok(x >= 10 && x < 30, `x ${x} under the cloud`);
      rows.add(y);
    }
  }
  assert.ok(Math.min(...rows) >= 6 && Math.max(...rows) === 15, "from the cloud's base to the bottom edge");
});

test("closeWith plays the cover over the body's held last frame", async () => {
  const { closeWith } = await import("../src/index.ts");
  const body = clip(1, (r, t) => r.fillRect(0, 0, Math.round(t * 10), 1, hex("#FFFFFF")));
  const cover = clip(0.5, (r, t) => r.fillRect(20, 0, 1, 1, hex("#FF0000", t / 0.5)));
  const c = closeWith(body, cover);
  assert.equal(c.duration, 1.5);
  const at = (t: number) => {
    const r = new Raster(24, 1);
    c.draw(r, t);
    return lit(r).map(([x]) => x);
  };
  assert.deepEqual(at(0.5), [0, 1, 2, 3, 4], "the body on its own");
  // Under the cover the body stays on its last frame, all ten pixels, and the cover is drawn on top.
  assert.deepEqual(at(1.25), [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 20]);
  assert.deepEqual(at(1.5), [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 20]);
});


// --- Pieces from the redirects (signs, vehicles, sprites, the map) -------------------------------------------------

test("stampPalette's flip mirrors art within its own width", async () => {
  const { stampPalette } = await import("../src/index.ts");
  const art = ["#..", "##."];
  const r = new Raster(8, 2);
  stampPalette(r, art, 2, 0, { "#": hex("#FFFFFF") }, 1, true);
  assert.deepEqual(lit(r), [[4, 0], [3, 1], [4, 1]]);
});

test("sparkles keep off the rectangle they are told to avoid, arms included", async () => {
  const { sparkles } = await import("../src/index.ts");
  const avoid = { x: 20, y: 2, width: 30, height: 12 };
  const s = sparkles({ duration: 2, count: 12, seed: 4, box: { x: 15, y: 0, width: 40, height: 16 }, avoid });
  for (let t = 0; t < 2; t += 0.05) {
    const r = new Raster(72, 16);
    s.draw(r, t);
    for (const [x, y] of lit(r)) assert.ok(x < avoid.x || x >= avoid.x + avoid.width || y < avoid.y || y >= avoid.y + avoid.height, `(${x},${y}) at ${t}`);
  }
});

test("a road sign leaves its room 3 px clear of the rim and the tab, mirrored for the left", async () => {
  const { roadSignLayout } = await import("../src/index.ts");
  const right = roadSignLayout({ tab: "GO!", dir: 1 });
  assert.equal(right.room.x0, 5, "the rim is column 1");
  assert.equal(right.tab.x - right.room.x1, 4);
  assert.ok(right.room.x1 - right.room.x0 + 1 >= inkWidth("DAMIAN", font("extra_large")), "the widest name fits");
  const left = roadSignLayout({ tab: "GO!", dir: -1 });
  assert.deepEqual(left.room, { x0: 71 - right.room.x1, x1: 71 - right.room.x0 });
  assert.equal(left.tab.x, 72 - right.tab.x - right.tab.width);
});

test("the van's cargo side is where its lettering goes, either way it faces", async () => {
  const { drawVan, vanWidth } = await import("../src/index.ts");
  for (const dir of [1, -1] as const) {
    const r = new Raster(72, 16);
    const side = drawVan(r, 5, { cargo: 40, dir });
    assert.deepEqual([side.width, side.y, side.height], [40, 1, 13]);
    assert.equal(side.x, dir > 0 ? 5 : 5 + vanWidth(40) - 40);
    // The box is solid brown across rows 2..13, under the lettering and a row round it.
    for (let y = 2; y <= 13; y++) for (let x = side.x + 2; x < side.x + side.width - 2; x++) assert.ok(r.data[(y * 72 + x) * 4 + 3]! > 0.99, `(${x},${y})`);
  }
});

test("the pointing hand's finger shortens instead of the hand, and always points", async () => {
  const { drawPointingHand, handWidth, HAND_MIN_FINGER } = await import("../src/index.ts");
  assert.equal(handWidth(14), 30);
  assert.equal(handWidth(HAND_MIN_FINGER), 26);
  assert.equal(handWidth(3), 26, "no shorter than HAND_MIN_FINGER");
  for (const finger of [14, 12, HAND_MIN_FINGER]) {
    const r = new Raster(72, 16);
    drawPointingHand(r, 0, 0, 1, { finger });
    const xs = lit(r).map(([x]) => x);
    const ys = lit(r).map(([, y]) => y);
    assert.equal(Math.max(...xs), handWidth(finger) - 2, "the fingertip");
    assert.ok(Math.min(...ys) >= 1 && Math.max(...ys) <= 14, "rows 1..14, clear of the edges");
    // The curled fingers (rows 8..12) end at column 19; the index finger reaches finger - 5 past them, 5 at the least.
    const curled = Math.max(...lit(r).filter(([, y]) => y >= 8 && y <= 12).map(([x]) => x));
    assert.equal(curled, 19);
    assert.ok(Math.max(...xs) - curled >= 5, `finger ${finger}: ${Math.max(...xs) - curled} px past the curled fingers`);
  }
});

test("Growlithe and the megaphone mirror exactly", async () => {
  const { drawGrowlithe, drawMegaphone, GROWLITHE_SIZE, MEGAPHONE_SIZE } = await import("../src/index.ts");
  const mirrored = (draw: (r: Raster, x: number, dir: 1 | -1) => void, w: number) => {
    const a = new Raster(72, 16);
    const b = new Raster(72, 16);
    draw(a, 10, 1);
    draw(b, 72 - 10 - w, -1);
    const flip = lit(b).map(([x, y]) => `${71 - x},${y}`).sort();
    assert.deepEqual(lit(a).map(([x, y]) => `${x},${y}`).sort(), flip);
  };
  for (const pose of ["stand", "wag", "bark", "leap", "gather"] as const) mirrored((r, x, dir) => drawGrowlithe(r, x, 2, dir, pose), GROWLITHE_SIZE.width);
  mirrored((r, x, dir) => drawMegaphone(r, x, 3, dir), MEGAPHONE_SIZE.width);
});

test("sound arcs go only their way, and stop short of a word", async () => {
  const { drawSoundArcs } = await import("../src/index.ts");
  for (const dir of [1, -1] as const) {
    for (let p = 0.05; p < 1; p += 0.1) {
      const r = new Raster(72, 16);
      const x = dir > 0 ? 12 : 60;
      drawSoundArcs(r, x, 8, dir, p, { reach: 14, stop: dir > 0 ? 22 : 50 });
      for (const [px] of lit(r)) assert.ok(dir > 0 ? px >= x && px < 22 : px <= x && px > 50, `dir ${dir} p ${p.toFixed(2)}: x ${px}`);
    }
  }
});

test("a trail's dashes are even along a winding path, and the X lands where asked", async () => {
  const { trailDashes, drawTreasureX } = await import("../src/index.ts");
  const dashes = trailDashes((s) => [2 + s * 40, 8 + Math.sin(s * 9) * 4], { dash: 2, gap: 2 });
  // About 50 px of path in 4 px periods; a 2 px dash on a slant covers up to 4 pixels.
  assert.ok(dashes.length >= 11 && dashes.length <= 13, `${dashes.length} dashes`);
  for (const d of dashes) assert.ok(d.length >= 2 && d.length <= 4, `a dash of ${d.length}`);
  const r = new Raster(72, 16);
  drawTreasureX(r, 30.5, 7.5);
  const xs = lit(r).map(([x]) => x);
  const ys = lit(r).map(([, y]) => y);
  assert.deepEqual([Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)], [27, 34, 4, 11], "7 x 7 and its shadow");
});

test("the exit sign never drops from lit to black in one frame, coming on or going off", async () => {
  const { drawExitPanel, drawPictogram, exitFlickerOn, exitFlickerOff, exitInk, EXIT_SIGN } = await import("../src/index.ts");
  const ON = 0.7;
  const OFF = 0.45;
  /** The sign as a scene draws it at `light`, over black: the panel, a figure in its ink and ring, a dim part. */
  const frame = (light: number, t: number) => {
    const r = new Raster(72, 16).clear(hex("#000000"));
    drawExitPanel(r, light, t);
    drawPictogram(r, 30, 2, 1, "stand", { ink: exitInk(light), halo: exitInk(0.92 * light, EXIT_SIGN.lit, light) });
    r.fillRect(50, 4, 6, 8, exitInk(0.55 * light, EXIT_SIGN.ink, light));
    return r;
  };
  const lum = (r: Raster, i: number) => 0.2126 * r.data[i]! + 0.7152 * r.data[i + 1]! + 0.0722 * r.data[i + 2]!;
  // Coming on, held lit, going off: frame by frame at 60 fps.
  const lights: number[] = [];
  for (let k = 0; k <= Math.round(ON * 60); k++) lights.push(exitFlickerOn(k / 60, ON));
  for (let k = 0; k < 10; k++) lights.push(1);
  for (let k = 0; k <= Math.round(OFF * 60); k++) lights.push(exitFlickerOff(k / 60, OFF));
  assert.equal(lights[lights.length - 1], 0, "it ends off");
  let prev = frame(lights[0]!, 0);
  for (let k = 1; k < lights.length; k++) {
    const cur = frame(lights[k]!, k / 60);
    let gone = 0;
    let before = 0;
    let after = 0;
    for (let i = 0; i < cur.data.length; i += 4) {
      if (lum(prev, i) > 0.1 && lum(cur, i) < 0.02) gone++;
      before += lum(prev, i);
      after += lum(cur, i);
    }
    const pixels = 72 * 16;
    assert.ok(gone < pixels * 0.05, `frame ${k}: ${gone} pixels went from lit to black (light ${lights[k - 1]!.toFixed(2)} -> ${lights[k]!.toFixed(2)})`);
    assert.ok((before - after) / pixels < 0.2, `frame ${k}: the screen dims by ${((before - after) / pixels).toFixed(2)} at once`);
    prev = cur;
  }
});
