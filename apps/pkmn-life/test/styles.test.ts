// The guard test: the visual audit's rules, pinned for every front style (docs/superpowers/specs/
// 2026-10-29-front-styles-audit.md). It iterates NAG_STYLES and REDIRECT_STYLES, so a style added to src/presets.ts and
// assets/scenes/registry.ts is covered at once. Every redirect is rendered for SAM, ALEX, DAMIAN (46 px, the widest a
// name can be) and WWWWW (45 px), on both sides.
//
// Each clip is rendered and read once, and the four cases share what was read. A failing case lists every style, name
// and direction that breaks it, with the measurement, so one run is a to-do list.

import assert from "node:assert/strict";
import { test } from "node:test";
import { NAME_EDGE, font, readTime, renderFrames, type Clip } from "@vladzaharia/bar-pixel";
import { NAG_SCENES, REDIRECT_SCENES } from "../assets/scenes/registry.ts";
import { ENTRIES, NAG_STYLES, REDIRECT_STYLES, type Nag, type Redirect } from "../src/presets.ts";
import { SCREEN, findName, inkBox, litPixels, luminance } from "./frames.ts";

const FPS = 60;
/** SAM is short, ALEX is the usual, DAMIAN and WWWWW are the widest names that fit (the audit's stress cases). */
const NAMES = ["SAM", "ALEX", "DAMIAN", "WWWWW"] as const;
const DIRS = [1, -1] as const;
/** The brightest second of a style, on average over the LEDs (Rec. 709, 0..1), before it is glaring across the room. */
const GLARE = 0.62;
/** Redirect styles that set the name against a screen edge; their ink sits NAME_EDGE px from it (dog, hand, map and shout arrive with their styles). */
const EDGE_ANCHORED = ["runway", "walker", "nudge", "dog", "hand", "map", "shout"];

/** The name's lettering: `trainer` types it in the small font, everything else sets it in the big one. */
const nameFont = (style: string) => font(style === "trainer" ? "small" : "extra_large");
/** `train` carries one letter per car, so its letters are found one at a time. */
const isSpaced = (style: string) => style === "train";

interface Case {
  /** "runway DAMIAN dir -1", "encounter". */
  label: string;
  style: string;
  /** Redirects only. */
  name?: string;
  dir?: 1 | -1;
  scene(): Clip;
}

const nag = ENTRIES.find((e): e is Nag => e.kind === "nag")!;
const person = (name: string, dir: 1 | -1): Redirect => ({ kind: "redirect", id: name.toLowerCase(), move: name, name, dir, message: "" });

const NAG_CASES: Case[] = NAG_STYLES.map((style) => ({ label: style, style, scene: () => NAG_SCENES[style](nag) }));
const REDIRECT_CASES: Case[] = REDIRECT_STYLES.flatMap((style) =>
  NAMES.flatMap((name) =>
    DIRS.map((dir): Case => ({ label: `${style} ${name} dir ${dir}`, style, name, dir, scene: () => REDIRECT_SCENES[style](person(name, dir)) })),
  ),
);
const CASES = [...NAG_CASES, ...REDIRECT_CASES];

type Pos = { x: number; y: number };

interface Reading {
  /** Lit (not fully transparent) pixels in the first and the last frame. */
  firstLit: number;
  lastLit: number;
  /** Mean luminance of each frame. */
  brightness: number[];
  /** Redirects: the longest stretch of consecutive frames with the whole name on screen, and where the name is in its middle. */
  run: { frames: number; at: Pos | null };
}

/** The longest stretch of consecutive frames in which the name was found, and where it was in the stretch's middle frame. */
function longestRun(found: (Pos | null)[]): Reading["run"] {
  let best: Reading["run"] = { frames: 0, at: null };
  let start = 0;
  for (let i = 0; i <= found.length; i++) {
    if (i < found.length && found[i]) continue;
    if (i - start > best.frames) best = { frames: i - start, at: found[start + Math.floor((i - start) / 2)]! };
    start = i + 1;
  }
  return best;
}

const readings = new Map<Case, Reading>();

function read(c: Case): Reading {
  const known = readings.get(c);
  if (known) return known;
  const frames = renderFrames(c.scene(), { width: SCREEN.width, height: SCREEN.height, fps: FPS });
  const f = nameFont(c.style);
  const reading: Reading = {
    firstLit: litPixels(frames[0]!),
    lastLit: litPixels(frames[frames.length - 1]!),
    brightness: frames.map(luminance),
    run: c.name ? longestRun(frames.map((frame) => findName(frame, c.name!, f, isSpaced(c.style)))) : { frames: 0, at: null },
  };
  readings.set(c, reading);
  return reading;
}

/** Fails with every line in `failures`, so one run shows everything that is wrong. */
function expectNone(what: string, failures: string[]): void {
  assert.equal(failures.length, 0, `${what}: ${failures.length} failing\n  ${failures.join("\n  ")}\n`);
}

test("every style opens and closes transparent", () => {
  const failures: string[] = [];
  for (const c of CASES) {
    const r = read(c);
    if (r.firstLit) failures.push(`${c.label}: the first frame has ${r.firstLit} lit pixels`);
    if (r.lastLit) failures.push(`${c.label}: the last frame has ${r.lastLit} lit pixels`);
  }
  expectNone("a style must start and end clear, to show the clock", failures);
});

test("every redirect shows the whole name long enough", () => {
  const failures: string[] = [];
  for (const c of REDIRECT_CASES) {
    const shown = read(c).run.frames / FPS;
    const needed = readTime(c.name!);
    // A frame is 1/60 s; a run of n frames is n / 60 s.
    if (shown < needed) failures.push(`${c.label}: whole for ${shown.toFixed(3)} s at most, needs ${needed.toFixed(3)} s`);
  }
  expectNone("the name must be read", failures);
});

test("edge-anchored names sit 3 px from their edge", () => {
  const styles = EDGE_ANCHORED.filter((s) => (REDIRECT_STYLES as readonly string[]).includes(s));
  assert.ok(styles.length > 0, "no edge-anchored style is registered");
  const failures: string[] = [];
  for (const style of styles) {
    for (const dir of DIRS) {
      const c = REDIRECT_CASES.find((k) => k.style === style && k.name === "ALEX" && k.dir === dir)!;
      const { at } = read(c).run;
      if (!at) {
        failures.push(`${c.label}: the whole name is never on screen`);
        continue;
      }
      const box = inkBox("ALEX", nameFont(style), at);
      const left = box.x0;
      const right = SCREEN.width - 1 - box.x1;
      const margin = Math.min(left, right);
      if (margin !== NAME_EDGE) failures.push(`${c.label}: ink is ${margin} px from the ${left < right ? "left" : "right"} edge (left ${left}, right ${right}), wants ${NAME_EDGE}`);
    }
  }
  expectNone("an edge-anchored name keeps NAME_EDGE", failures);
});

test("no glare", () => {
  const failures: string[] = [];
  for (const style of [...NAG_STYLES, ...REDIRECT_STYLES]) {
    // The brightest second of the style, over every name and side it is rendered for.
    let worst = { mean: 0, at: 0, label: "" };
    for (const c of CASES.filter((k) => k.style === style)) {
      const b = read(c).brightness;
      const n = Math.min(FPS, b.length);
      let sum = b.slice(0, n).reduce((a, v) => a + v, 0);
      for (let i = 0; ; i++) {
        if (sum / n > worst.mean) worst = { mean: sum / n, at: i / FPS, label: c.label };
        if (i + n >= b.length) break;
        sum += b[i + n]! - b[i]!;
      }
    }
    if (worst.mean > GLARE) failures.push(`${worst.label}: mean luminance ${worst.mean.toFixed(2)} over the second from ${worst.at.toFixed(2)} s, limit ${GLARE}`);
  }
  expectNone("no second of a style may be glaring", failures);
});
