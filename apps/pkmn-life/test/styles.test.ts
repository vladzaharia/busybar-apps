// The guard test: the visual audit's rules, pinned for every front style (docs/superpowers/specs/
// 2026-10-29-front-styles-audit.md). It iterates NAG_STYLES and REDIRECT_STYLES, so a style added to src/presets.ts and
// assets/scenes/registry.ts is covered at once. Every redirect is rendered for SAM, ALEX, DAMIAN (46 px, the widest a
// name can be) and WWWWW (45 px), on both sides.
//
// Each clip is rendered and read once, and the tests share what was read. A failing case lists every style, name
// and direction that breaks it, with the measurement, so one run is a to-do list.

import assert from "node:assert/strict";
import { test } from "node:test";
import { NAME_EDGE, font, readTime, renderFrames, type Clip } from "@vladzaharia/bar-pixel";
import { NAG_SCENES, REDIRECT_SCENES } from "../assets/scenes/registry.ts";
import { ENTRIES, NAG_STYLES, REDIRECT_STYLES, type Nag, type Redirect } from "../src/presets.ts";
import { SCREEN, brightShare, findName, inkBox, litPixels, luminance } from "./frames.ts";

const FPS = 60;
/** SAM is short, ALEX is the usual, DAMIAN and WWWWW are the widest names that fit (the audit's stress cases). */
const NAMES = ["SAM", "ALEX", "DAMIAN", "WWWWW"] as const;
const DIRS = [1, -1] as const;
/** The brightest second of a style, on average over the LEDs (Rec. 709, 0..1), before it is glaring across the room. */
const GLARE = 0.62;
/** No single frame may light more than this share of the LEDs above BRIGHT luminance: a flash across the screen. */
const BRIGHT_SHARE = 0.5;
const BRIGHT = 0.7;
const far = (names: readonly string[] = NAMES) => ({ side: "far" as const, names });
const near = (names: readonly string[] = NAMES) => ({ side: "near" as const, names });
/**
 * Redirect styles that set the name against a screen edge, which edge, and for which names; their ink sits NAME_EDGE px
 * from it. "far" is the edge away from the person (the name left behind, the cue on their side), "near" is theirs. The
 * exit sign centres a short name between its rim and the visitor; the widest fill that room, from the far edge.
 */
const EDGE_ANCHORED: Record<string, { side: "far" | "near"; names: readonly string[] }> = {
  runway: far(),
  walker: far(),
  nudge: far(),
  dog: far(),
  hand: near(),
  map: near(),
  shout: near(),
  exit: far(["DAMIAN", "WWWWW"]),
};

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
  /** The share of LEDs above BRIGHT in each frame. */
  bright: number[];
  /** Redirects: the longest stretch of consecutive frames with the whole name on screen and still, and where it is. */
  run: { frames: number; at: Pos | null };
}

/**
 * The longest stretch of consecutive frames in which the whole name was found at one and the same place, and that
 * place: the name has to hold still to be read, not just stay whole while it moves.
 */
function longestStill(found: (Pos | null)[]): Reading["run"] {
  let best: Reading["run"] = { frames: 0, at: null };
  let start = 0;
  for (let i = 1; i <= found.length; i++) {
    const from = found[start];
    const here = found[i];
    if (from && here && here.x === from.x && here.y === from.y) continue;
    if (from && i - start > best.frames) best = { frames: i - start, at: from };
    start = i;
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
    bright: frames.map((frame) => brightShare(frame, BRIGHT)),
    run: c.name ? longestStill(frames.map((frame) => findName(frame, c.name!, f, isSpaced(c.style)))) : { frames: 0, at: null },
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

test("every redirect holds the whole name still long enough", () => {
  const failures: string[] = [];
  for (const c of REDIRECT_CASES) {
    const shown = read(c).run.frames / FPS;
    const needed = readTime(c.name!);
    // A frame is 1/60 s; a run of n frames is n / 60 s.
    if (shown < needed) failures.push(`${c.label}: whole and still for ${shown.toFixed(3)} s at most, needs ${needed.toFixed(3)} s`);
  }
  expectNone("the name must be read", failures);
});

test("edge-anchored names sit 3 px from their edge, on the right side", () => {
  const styles = Object.keys(EDGE_ANCHORED).filter((s) => (REDIRECT_STYLES as readonly string[]).includes(s));
  assert.ok(styles.length > 0, "no edge-anchored style is registered");
  const failures: string[] = [];
  for (const style of styles) {
    const { side, names } = EDGE_ANCHORED[style]!;
    for (const name of names) {
      for (const dir of DIRS) {
        const c = REDIRECT_CASES.find((k) => k.style === style && k.name === name && k.dir === dir)!;
        const { at } = read(c).run;
        if (!at) {
          failures.push(`${c.label}: the whole name is never on screen`);
          continue;
        }
        // Someone on the right (dir 1): their edge is the right one, the far edge the left.
        const fromLeft = (side === "far") === (dir > 0);
        const box = inkBox(name, nameFont(style), at);
        const margin = fromLeft ? box.x0 : SCREEN.width - 1 - box.x1;
        if (margin !== NAME_EDGE) failures.push(`${c.label}: ink is ${margin} px from the ${fromLeft ? "left" : "right"} (${side}) edge (ink x ${box.x0}..${box.x1}), wants ${NAME_EDGE}`);
      }
    }
  }
  expectNone("an edge-anchored name keeps NAME_EDGE from its edge", failures);
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

test("no frame lights most of the screen", () => {
  const failures: string[] = [];
  for (const c of CASES) {
    const bright = read(c).bright;
    const i = bright.indexOf(Math.max(...bright));
    if (bright[i]! > BRIGHT_SHARE) failures.push(`${c.label}: ${(bright[i]! * 100).toFixed(0)}% of the LEDs above ${BRIGHT} at ${(i / FPS).toFixed(2)} s, limit ${BRIGHT_SHARE * 100}%`);
  }
  expectNone("no single frame may glare across the screen", failures);
});
