// Renders the component catalog into a browsable gallery: one sprite sheet per component and an index.html that
// plays them at device speed, the front as LEDs and the back as an OLED.
// Usage: pnpm --filter @vladzaharia/bar-pixel gallery [out-dir]

import { writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { CATALOG, hex, renderFrames, toGreyFrames, writePreview } from "../src/index.ts";

const out = resolve(process.argv[2] ?? "gallery");
const SIZE = { front: { width: 72, height: 16, fps: 60 }, back: { width: 148, height: 80, fps: 30 } };

const files = writePreview(out, {
  title: "BUSY Bar Components",
  eyebrow: "bar-pixel · component catalog",
  heading: "BUSY Bar components",
  lede: "Every pre-rendered effect in @vladzaharia/bar-pixel, playing at device resolution and speed: the front as 72 × 16 LEDs, the back as the 148 × 80 greyscale OLED. Each card shows the call that makes it. Click a display to pause it.",
  entries: CATALOG.map((e) => {
    const size = SIZE[e.display];
    const frames = renderFrames(e.demo, { ...size, background: hex("#000000") });
    return { ...e, frames: e.display === "back" ? toGreyFrames(frames) : frames, fps: size.fps };
  }),
});
writeFileSync(join(out, "files.json"), JSON.stringify(files, null, 2));
console.log(`wrote ${join(out, "index.html")} (${Object.keys(files).length} components)`);
