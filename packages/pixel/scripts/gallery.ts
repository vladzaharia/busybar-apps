// Renders the component catalog into a browsable gallery: one sprite sheet per component and an index.html that
// plays them at device speed, the front as LEDs and the back as an OLED.
// Usage: pnpm --filter @vladzaharia/bar-pixel gallery [out-dir]

import { mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { CATALOG, hex, renderFrames, sheet, writePng } from "../src/index.ts";

const out = resolve(process.argv[2] ?? "gallery");
mkdirSync(join(out, "frames"), { recursive: true });

const SIZE = { front: { width: 72, height: 16, fps: 60 }, back: { width: 148, height: 80, fps: 30 } };

/** The back OLED shows 16 grey levels. */
function grey(frame: Uint8Array): Uint8Array {
  const g = frame.slice();
  for (let i = 0; i < g.length; i += 4) {
    const l = Math.min(15, Math.round(((0.299 * g[i]! + 0.587 * g[i + 1]! + 0.114 * g[i + 2]!) / 255) * 15)) * 17;
    g[i] = g[i + 1] = g[i + 2] = l;
  }
  return g;
}

const entries = CATALOG.map((e) => {
  const size = SIZE[e.display];
  let frames = renderFrames(e.demo, { ...size, background: hex("#000000") });
  if (e.display === "back") frames = frames.map(grey);
  const file = `frames/${e.id}.png`;
  writePng(join(out, file), sheet(frames, size.width, size.height));
  console.log(`${e.id}: ${frames.length} frames`);
  return { id: e.id, name: e.name, group: e.group, about: e.about, usage: e.usage, display: e.display, frames: frames.length, fps: size.fps, file };
});

const html = `<title>BUSY Bar Components</title>
<meta name="claude:viewport-fit-sides" content="cover">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Archivo:wdth,wght@75..100,500..800&family=IBM+Plex+Mono:wght@400;500&family=IBM+Plex+Sans:wght@400;500&display=swap">
<style>
  /* Layout: a catalogue, grouped; each component is a card with its device preview on top and its call below. */
  :root {
    --bg: #eef1f6; --surface: #ffffff; --ink: #121826; --muted: #5a6478; --line: #d5dbe6;
    --accent: #0c66e4; --accent-ink: #ffffff; --chip: #e3ecfb; --device: #0b0d12; --device-edge: #262a33;
    --display: "Archivo", "Arial Narrow", system-ui, sans-serif;
    --body: "IBM Plex Sans", system-ui, -apple-system, "Segoe UI", sans-serif;
    --mono: "IBM Plex Mono", ui-monospace, "SFMono-Regular", Menlo, monospace;
  }
  @media (prefers-color-scheme: dark) {
    :root:not([data-theme="light"]) { --bg: #0c1018; --surface: #141a25; --ink: #e6ebf5; --muted: #95a1b8; --line: #263045; --accent: #579dff; --accent-ink: #08121f; --chip: #18243a; --device: #05070a; --device-edge: #2a303c; color-scheme: dark; }
  }
  :root[data-theme="dark"] { --bg: #0c1018; --surface: #141a25; --ink: #e6ebf5; --muted: #95a1b8; --line: #263045; --accent: #579dff; --accent-ink: #08121f; --chip: #18243a; --device: #05070a; --device-edge: #2a303c; color-scheme: dark; }
  body { background: var(--bg); color: var(--ink); font-family: var(--body); font-size: 15px; line-height: 1.5; }
  .wrap { max-width: 1120px; margin: 0 auto; padding-left: max(16px, env(safe-area-inset-left, 0px)); padding-right: max(16px, env(safe-area-inset-right, 0px)); padding-block: 40px 64px; display: grid; gap: 36px; }
  header { display: grid; gap: 10px; max-width: 70ch; }
  .eyebrow { font-family: var(--mono); font-size: 12px; letter-spacing: .08em; text-transform: uppercase; color: var(--accent); }
  h1 { font-family: var(--display); font-stretch: 80%; font-weight: 800; font-size: clamp(32px, 5.5vw, 48px); line-height: 1; margin: 0; text-wrap: balance; }
  h2 { font-family: var(--display); font-stretch: 85%; font-weight: 700; font-size: 24px; margin: 0; }
  h3 { font-family: var(--display); font-stretch: 90%; font-weight: 700; font-size: 18px; margin: 0; }
  p { margin: 0; }
  .lede { color: var(--muted); }
  nav { display: flex; flex-wrap: wrap; gap: 8px; }
  nav a { font-family: var(--mono); font-size: 13px; color: var(--ink); text-decoration: none; border: 1px solid var(--line); background: var(--surface); padding: 4px 10px; border-radius: 999px; }
  nav a:focus-visible, button:focus-visible, canvas:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
  section { display: grid; gap: 14px; }
  .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(min(100%, 320px), 1fr)); gap: 16px; }
  .card { background: var(--surface); border: 1px solid var(--line); border-radius: 12px; padding: 14px; display: grid; gap: 10px; align-content: start; min-width: 0; }
  .device { background: linear-gradient(180deg, var(--device-edge), var(--device) 30%); border-radius: 10px; padding: 10px; }
  .device canvas { display: block; width: 100%; height: auto; border-radius: 3px; background: #000; cursor: pointer; }
  .card p { color: var(--muted); font-size: 14px; }
  code { font-family: var(--mono); font-size: 12px; background: var(--chip); padding: 6px 8px; border-radius: 6px; color: var(--ink); display: block; overflow-x: auto; white-space: pre; }
  .tag { font-family: var(--mono); font-size: 11px; color: var(--muted); }
</style>

<div class="wrap">
  <header>
    <div class="eyebrow">bar-pixel · component catalog</div>
    <h1>BUSY Bar components</h1>
    <p class="lede">Every pre-rendered effect in <strong>@vladzaharia/bar-pixel</strong>, playing at device resolution and speed: the front as 72 × 16 LEDs, the back as the 148 × 80 greyscale OLED. Each card shows the call that makes it. Click a display to pause it.</p>
    <nav id="nav" aria-label="Groups"></nav>
  </header>
  <div id="groups"></div>
</div>

<script>
const ENTRIES = ${JSON.stringify(entries)};
const SIZES = { front: [72, 16, 8], back: [148, 80, 3] };
const groups = [...new Set(ENTRIES.map((e) => e.group))];
const el = (tag, attrs = {}, kids = []) => { const e = document.createElement(tag); for (const [k, v] of Object.entries(attrs)) k === "text" ? (e.textContent = v) : e.setAttribute(k, v); e.append(...kids); return e; };
const nav = document.getElementById("nav");
const root = document.getElementById("groups");
root.style.display = "grid"; root.style.gap = "36px";
for (const g of groups) {
  const id = g.toLowerCase();
  nav.append(el("a", { href: "#" + id, text: g }));
  const grid = el("div", { class: "grid" });
  root.append(el("section", { id, "aria-labelledby": id + "-h" }, [el("h2", { id: id + "-h", text: g }), grid]));
  for (const e of ENTRIES.filter((x) => x.group === g)) grid.append(card(e));
}
function card(e) {
  const [w, h, s] = SIZES[e.display];
  const canvas = el("canvas", { width: w * s, height: h * s, role: "img", tabindex: "0", "aria-label": e.name + " preview. Click to pause." });
  const node = el("article", { class: "card" }, [
    el("div", { class: "device" }, [canvas]),
    el("div", { class: "tag", text: e.display + " · " + (e.frames / e.fps).toFixed(1) + " s" }),
    el("h3", { text: e.name }), el("p", { text: e.about }), el("code", { text: e.usage }),
  ]);
  play(e, canvas, w, h, s);
  return node;
}
function play(e, canvas, w, h, s) {
  const ctx = canvas.getContext("2d");
  const src = document.createElement("canvas"); src.width = w; src.height = h;
  const sctx = src.getContext("2d", { willReadFrequently: true });
  const img = new Image(); img.src = e.file;
  let t = 0, last = null, paused = false, visible = true;
  canvas.addEventListener("click", () => (paused = !paused));
  canvas.addEventListener("keydown", (k) => { if (k.key === " " || k.key === "Enter") { k.preventDefault(); paused = !paused; } });
  new IntersectionObserver(([x]) => (visible = x.isIntersecting)).observe(canvas);
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  function draw(f) {
    sctx.clearRect(0, 0, w, h);
    sctx.drawImage(img, 0, f * h, w, h, 0, 0, w, h);
    ctx.fillStyle = "#000"; ctx.fillRect(0, 0, canvas.width, canvas.height);
    if (e.display === "back") {
      ctx.imageSmoothingEnabled = false; ctx.drawImage(src, 0, 0, w * s, h * s);
      ctx.fillStyle = "rgba(0,0,0,0.35)";
      for (let x = 1; x < w; x++) ctx.fillRect(x * s - 1, 0, 1, h * s);
      for (let y = 1; y < h; y++) ctx.fillRect(0, y * s - 1, w * s, 1);
      return;
    }
    const px = sctx.getImageData(0, 0, w, h).data;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      ctx.beginPath(); ctx.arc(x * s + s / 2, y * s + s / 2, s * 0.4, 0, Math.PI * 2);
      ctx.fillStyle = px[i] + px[i + 1] + px[i + 2] < 6 ? "#0d0f13" : "rgb(" + px[i] + "," + px[i + 1] + "," + px[i + 2] + ")";
      ctx.fill();
    }
  }
  function frame(now) {
    if (last === null) last = now;
    const dt = Math.min(0.1, (now - last) / 1000); last = now;
    if (img.complete && img.naturalWidth && visible) {
      if (!paused && !reduce) t = (t + dt) % (e.frames / e.fps);
      draw(Math.min(e.frames - 1, Math.floor(reduce ? e.frames * 0.6 : t * e.fps)));
    }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}
</script>
`;
writeFileSync(join(out, "index.html"), html);
console.log(`wrote ${join(out, "index.html")}`);


