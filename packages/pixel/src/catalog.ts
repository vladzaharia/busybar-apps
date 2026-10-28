// The component catalog: every effect with a short demo. The gallery page is generated from this list, so a new
// component becomes browsable by adding one entry here. Keep demos short (2–4 s) and on the display the component
// is meant for.

import * as fx from "./fx/index.ts";
import { capCentre } from "./fx/text.ts";
import { drawJiraMark, jiraFlyIn, JIRA_TONES_WHITE } from "./jira.ts";
import { moonIcon } from "./icons.ts";
import { font, textWidth } from "./font.ts";
import { hex, mix, type Raster } from "./raster.ts";
import { MOTION, readTime } from "./motion.ts";
import { clip, layer, pause, seq, type Clip } from "./timeline.ts";

export interface CatalogEntry {
  id: string;
  name: string;
  group: "Transitions" | "Backgrounds" | "Text" | "HUD" | "Wayfinding" | "Logo" | "Modifiers";
  /** What it does and how to use it, one or two sentences. */
  about: string;
  /** The call that makes it, as you would write it in a scene. */
  usage: string;
  display: "front" | "back";
  demo: Clip;
}

const W = hex("#FFFFFF");
const BLUE = hex("#579DFF");

/** A stand-in for "whatever is on screen" under a transition: a dimmed checker with a label. */
function screen(r: Raster, label = "14:27"): void {
  r.shade((x, y) => ((x >> 2) + (y >> 2)) % 2 ? hex("#1B2333") : hex("#101722"));
  const f = font("bold");
  r.text(label, f, Math.round((r.width - textWidth(label, f)) / 2), capCentre("bold", r.height), W);
}

const under = (c: Clip, label?: string): Clip => layer(clip(c.duration, (r) => screen(r, label)), c);
/** Screen at rest, cover, hold covered, reveal, rest: so the loop shows before, during and after. */
const coverThenReveal = (cover: Clip, reveal: Clip) =>
  under(seq(pause(MOTION.rest), fx.holdEnd(cover, MOTION.rest), reveal, pause(MOTION.rest)));

export const CATALOG: CatalogEntry[] = [
  // Transitions ---------------------------------------------------------------------------------------------------
  {
    id: "flash",
    name: "Flash",
    group: "Transitions",
    about: "Whole-screen pulses of a colour. Three quick white ones make a handheld RPG's encounter flash.",
    usage: "flash({ count: 3 })  // 0.6 s; MOTION.base × 1.5",
    display: "front",
    demo: under(seq(pause(MOTION.rest), fx.flash({ count: 3 }), pause(MOTION.rest * 2))),
  },
  {
    id: "stripes",
    name: "Stripes",
    group: "Transitions",
    about: "Bands slide in from alternating sides until the screen is covered, then back out. The battle-start wipe.",
    usage: 'stripes({ mode: "cover" })  // 0.4 s',
    display: "front",
    demo: coverThenReveal(fx.stripes({ mode: "cover" }), fx.stripes({ mode: "reveal" })),
  },
  {
    id: "blinds",
    name: "Blinds",
    group: "Transitions",
    about: "Vertical slats closing across the screen, left to right, then opening again.",
    usage: 'blinds({ mode: "cover", slats: 9 })  // 0.4 s',
    display: "front",
    demo: coverThenReveal(fx.blinds({ mode: "cover" }), fx.blinds({ mode: "reveal" })),
  },
  {
    id: "crt",
    name: "CRT off / on",
    group: "Transitions",
    about: "The screen squeezes onto a glowing line like an old TV switching off; reveal opens it back out from the centre.",
    usage: 'crt({ mode: "cover" })  // 0.65 s, like the stock turn-off',
    display: "front",
    demo: coverThenReveal(fx.crt({ mode: "cover" }), fx.crt({ mode: "reveal" })),
  },
  {
    id: "wipe",
    name: "Soft wipe",
    group: "Transitions",
    about: "A coloured band with a bright soft edge sweeps across, then sweeps off. Either direction.",
    usage: 'wipe({ mode: "cover", color: hex("#0055CC") })  // 0.25 s',
    display: "front",
    demo: coverThenReveal(fx.wipe({ mode: "cover" }), fx.wipe({ mode: "reveal" })),
  },
  {
    id: "iris",
    name: "Iris",
    group: "Transitions",
    about: "A circle closes onto a point (any point) and opens again: the cartoon ending.",
    usage: 'iris({ mode: "cover", x: 36, y: 8 })  // 0.65 s, like the stock oval',
    display: "front",
    demo: coverThenReveal(fx.iris({ mode: "cover" }), fx.iris({ mode: "reveal" })),
  },
  {
    id: "dissolve",
    name: "Dissolve",
    group: "Transitions",
    about: "Pixels switch over in random order. Works on both displays; on the OLED it reads as a fine grain.",
    usage: 'dissolve({ mode: "cover" })  // 0.5 s',
    display: "front",
    demo: coverThenReveal(fx.dissolve({ mode: "cover" }), fx.dissolve({ mode: "reveal" })),
  },
  {
    id: "bloom",
    name: "Bloom",
    group: "Transitions",
    about: "A colour blooms out from the centre with a bright ring at its edge until it fills the screen.",
    usage: 'bloom({ color: hex("#0C66E4") })  // 0.4 s',
    display: "front",
    demo: under(seq(pause(MOTION.rest), fx.holdEnd(fx.bloom({}), MOTION.rest * 2))),
  },
  {
    id: "collapse",
    name: "Collapse",
    group: "Transitions",
    about: "Everything pinches into a line, then a point of light that fades. A good way to end a scene.",
    usage: "collapse({})  // 0.65 s",
    display: "front",
    demo: seq(fx.panel({ duration: 1 }), fx.collapse({}), pause(MOTION.rest)),
  },
  {
    id: "fade",
    name: "Fade",
    group: "Transitions",
    about: "An overlay fading to a colour, or a covered screen fading away.",
    usage: "fade({ from: 0, to: 1 })  // 0.4 s",
    display: "front",
    demo: under(seq(pause(MOTION.rest), fx.holdEnd(fx.fade({ from: 0, to: 1 }), MOTION.rest), fx.fade({ from: 1, to: 0 }), pause(MOTION.rest))),
  },

  // Backgrounds ---------------------------------------------------------------------------------------------------
  {
    id: "panel",
    name: "Sign panel",
    group: "Backgrounds",
    about: "A bevelled panel like the stock MEETING and CODING signs, with a sheen sweeping across. Content centres on it.",
    usage: "panel({ duration, style: PANEL_BLUE })  ·  drawPanel(r, { sheen })",
    display: "front",
    demo: layer(fx.panel({ duration: 3, period: 1.5 }), clip(3, (r) => {
      drawJiraMark(r, 2, 2, 12, { tones: JIRA_TONES_WHITE });
      const f = font("extra_large");
      r.text("MEETING", f, 18, capCentre("extra_large"), W);
    })),
  },
  {
    id: "particles",
    name: "Particles",
    group: "Backgrounds",
    about: "Slowly drifting, twinkling motes with a few soft blobs: the power-on screen's ambience, in any colours.",
    usage: "particles({ duration, dark, light, speed: 3 })",
    display: "front",
    demo: fx.particles({ duration: 3 }),
  },
  {
    id: "burst",
    name: "Hyperspace burst",
    group: "Backgrounds",
    about: "Streaks shoot out from the centre around a white core that fades. The power-on explosion.",
    usage: "burst({ duration: 0.6 })",
    display: "front",
    demo: seq(fx.burst({ duration: 0.8 }), pause(MOTION.rest * 2)),
  },
  {
    id: "starfield",
    name: "Starfield",
    group: "Backgrounds",
    about: "Stars rushing towards you from the centre.",
    usage: "starfield({ duration, speed: 0.35 })",
    display: "front",
    demo: fx.starfield({ duration: 3 }),
  },
  {
    id: "confetti",
    name: "Confetti",
    group: "Backgrounds",
    about: "Confetti falling and tumbling: for wins, launches, birthdays.",
    usage: "confetti({ duration: 3, colors })",
    display: "front",
    demo: fx.confetti({ duration: 3 }),
  },
  {
    id: "sparkles",
    name: "Sparkles",
    group: "Backgrounds",
    about: "Twinkling four-point sparkles over the screen or a box, e.g. around a word.",
    usage: "sparkles({ duration, count: 8, box })",
    display: "front",
    demo: layer(clip(3, (r) => r.text("SHINY", font("extra_large"), 15, capCentre("extra_large"), hex("#FFD166"))), fx.sparkles({ duration: 3, count: 10 })),
  },
  {
    id: "ripple",
    name: "Ripple",
    group: "Backgrounds",
    about: "Rings rippling out from a point: the stock 'wave' invitation.",
    usage: "ripple({ duration, x, y, rings: 3 })",
    display: "front",
    demo: fx.ripple({ duration: 3 }),
  },
  {
    id: "pulse",
    name: "Pulse glow",
    group: "Backgrounds",
    about: "A soft glow breathing in and out behind something.",
    usage: "pulse({ duration, x, y, rx, ry, color })",
    display: "front",
    demo: layer(fx.pulse({ duration: 3.2, rx: 30, ry: 10 }), clip(3.2, (r) => r.text("LIVE", font("extra_large"), 22, capCentre("extra_large"), W))),
  },
  {
    id: "gradient",
    name: "Gradient",
    group: "Backgrounds",
    about: "Two colours blended across the screen, slowly drifting.",
    usage: "gradient({ duration, from, to, angle, drift })",
    display: "front",
    demo: fx.gradient({ duration: 3, from: hex("#0C66E4"), to: hex("#7F5FFF"), drift: 0.3 }),
  },

  // Text ----------------------------------------------------------------------------------------------------------
  {
    id: "drop-in",
    name: "Drop-in letters",
    group: "Text",
    about: "Letters drop into place one by one and land with a bounce; optionally fall away at the end.",
    usage: 'dropIn({ text, font: "extra_large", x, y, duration, exit: 0.3 })',
    display: "front",
    demo: fx.dropIn({ text: "DID YOU", font: "extra_large", x: 11, y: capCentre("extra_large"), duration: 2.6, exit: 0.4 }),
  },
  {
    id: "typewriter",
    name: "Typewriter",
    group: "Text",
    about: "Lines typed out letter by letter at a set speed.",
    usage: 'typewriter({ lines, font: "small", x, ys: [0, 7], cps: 26, duration })',
    display: "front",
    demo: fx.typewriter({ lines: ["Did you file a", "JIRA ticket yet?"], font: "small", x: 8, ys: [0, 7], duration: 3.2 }),
  },
  {
    id: "glide",
    name: "Glide marquee",
    group: "Text",
    about: "One line gliding in from the right and easing to a stop, each letter bouncing in as it enters; it rests on whole words. Accent words shimmer.",
    usage: 'glide({ text, font: "extra_large", y, endX, duration, fadeX, color: accentWords(text, ["JIRA"], white, blue) })',
    display: "front",
    demo: fx.glide({
      text: "FILE A JIRA TICKET",
      font: "extra_large",
      y: capCentre("extra_large"),
      // Ends with the last word centred: its offset in the line, subtracted from where it should sit.
      endX: Math.round((72 - textWidth("TICKET", font("extra_large"))) / 2) - textWidth("FILE A JIRA ", font("extra_large")),
      duration: 3.6,
      travel: 2.6,
      color: fx.accentWords("FILE A JIRA TICKET", ["JIRA"], W, BLUE),
    }),
  },
  {
    id: "title-card",
    name: "Title card",
    group: "Text",
    about: "Lines of white text fading in one after another on black, then out together: a game's chapter card. fitFont() picks the biggest font that fits.",
    usage: 'titleCard({ duration, lines: [{ text: "Dawn of", font: "small", cap: 1 }, { text: "The First Day", font: "normal", cap: 8 }] })',
    display: "front",
    demo: fx.titleCard({ duration: 3.4, lines: [{ text: "Dawn of", font: "small", cap: 1 }, { text: "The First Day", font: fx.fitFont("The First Day", 70), cap: 8 }] }),
  },
  {
    id: "roll",
    name: "Split-flap roll",
    group: "Text",
    about: "Words roll through a window like a split-flap board; old and new travel together and never overlap.",
    usage: "roll({ words: [{ text, font, hold }], box: { x, width } })",
    display: "front",
    demo: fx.roll({ words: ["DID YOU", "FILE A", "TICKET?"].map((text) => ({ text, font: "extra_large" as const, hold: readTime(text) + 0.3 })), box: { x: 0, width: 72 } }),
  },
  {
    id: "wave",
    name: "Wave",
    group: "Text",
    about: "A line of text bobbing on a sine wave.",
    usage: "wave({ text, font, x, y, duration, amplitude: 1.5 })",
    display: "front",
    demo: fx.wave({ text: "HELLO!", font: "extra_large", x: 13, y: capCentre("extra_large"), duration: 3, color: (i) => mix(W, BLUE, (i % 2) * 0.6) }),
  },

  // HUD -----------------------------------------------------------------------------------------------------------
  {
    id: "dialogue",
    name: "Dialogue box",
    group: "HUD",
    about: "A handheld-RPG text box: two lines typed in, the ▼ blinking when a page is done. paginate() splits long text.",
    usage: 'dialogue({ pages: paginate("A wild ISSUE appeared!"), cps: 26 })',
    display: "front",
    demo: fx.dialogue({ pages: [{ lines: ["A wild ISSUE", "appeared!"], hold: 1 }, { lines: ["What will", "you do?"], hold: 1 }] }),
  },
  {
    id: "hp-box",
    name: "HP box",
    group: "HUD",
    about: "Name, level and an HP bar that changes colour as it drops, in an L-shaped frame.",
    usage: 'drawHpBox(r, { name: "ISSUE", hp })',
    display: "front",
    demo: clip(3, (r, t) => fx.drawHpBox(r, { name: "ISSUE", hp: Math.max(0.05, 1 - t / 2.8) })),
  },
  {
    id: "bar",
    name: "Progress bar",
    group: "HUD",
    about: "A rounded bar; barFill() animates it filling. For live values use bar-core's progressBar() instead.",
    usage: "barFill({ duration, x, y, width, height })",
    display: "back",
    demo: layer(fx.barFill({ duration: 2.5, x: 14, y: 36, width: 120, height: 7 }), clip(2.5, (r) => r.text("Uploading", font("normal"), 14, 22, W))),
  },
  {
    id: "spinner",
    name: "Spinner",
    group: "HUD",
    about: "A ring of dots chasing round.",
    usage: "spinner({ duration, x, y, radius: 3 })",
    display: "front",
    demo: layer(fx.spinner({ duration: 2.7, x: 10, y: 8 }), clip(2.7, (r) => r.text("Loading", font("small"), 20, capCentre("small"), W))),
  },
  {
    id: "live-dot",
    name: "Live dot",
    group: "HUD",
    about: "A solid dot with a breathing halo: on air, recording, now showing.",
    usage: "liveDot({ duration, x, y, color })",
    display: "front",
    demo: layer(fx.liveDot({ duration: 2, x: 6, y: 6 }), clip(2, (r) => r.text("ON AIR", font("bold"), 16, capCentre("bold"), W))),
  },
  {
    id: "moon",
    name: "Moon",
    group: "HUD",
    about: "A glowering moon, 7 to 16 px: grow it as a deadline nears (moonIcon(size) gives each size as an image).",
    usage: "images[`moon${size}`] = moonIcon(size)  // pick the size from time left",
    display: "front",
    demo: clip(3, (r, t) => {
      const size = Math.min(15, 7 + Math.floor(t * 3.2));
      r.draw(moonIcon(size), Math.round(8 - size / 2), Math.round(8 - size / 2));
      const left = Math.max(1, 10 - Math.floor(t * 3.2));
      r.text(left === 1 ? "1 Day Remains" : `${left} Days Remain`, font("small"), 18, 5, hex("#BFBFBF"));
    }),
  },
  {
    id: "pkmn-symbol",
    name: "PKMN symbol",
    group: "HUD",
    about: "The handheld games' one-character PKMN (PK over MN), 10 × 8 px, to set in small-font text.",
    usage: 'drawPkmn(r, x, capTop - 2, color); r.text("LIFE", font("small"), x + PKMN_SIZE.width + 3, capTop - 2, color)',
    display: "back",
    demo: clip(2.5, (r, t) => {
      const small = font("small");
      const g = hex("#EBEBEB");
      fx.drawPkmn(r, 6, 28, g);
      r.text("LIFE", small, 6 + fx.PKMN_SIZE.width + 3, 28, g);
      const typed = Math.floor(Math.max(0, t - 0.3) * 30);
      if (typed >= 1) fx.drawPkmn(r, 6, 44, g);
      let n = 1;
      r.text("LIFE used FILE A TICKET!", small, 6 + fx.PKMN_SIZE.width + 3, 44, g, () => ({ hidden: n++ >= typed }));
    }),
  },
  {
    id: "ball-shake",
    name: "Capture ball",
    group: "HUD",
    about: "A capture ball rocking one way, then the other, then settling, every few seconds, its button blinking on each rock: something is in progress.",
    usage: "ballShake({ duration, x, y, size: 9, every: MOTION.ambient })",
    display: "back",
    demo: layer(fx.ballShake({ duration: 3.2, x: 10, y: 5 }), clip(3.2, (r) => r.text("NOW ON FRONT", font("small"), 17, 1, hex("#E6E6E6")))),
  },

  // Wayfinding ----------------------------------------------------------------------------------------------------
  {
    id: "chevron-chase",
    name: "Chevron chase",
    group: "Wayfinding",
    about: "Chevrons lighting up one after another towards a side, over and over, like sequenced runway lights: this way.",
    usage: "chevronChase({ duration, x, y: 2, dir: 1, count: 4, lit: amber })",
    display: "front",
    demo: layer(fx.chevronChase({ duration: 3, x: 40, y: 2, dir: 1 }), clip(3, (r) => r.text("ALEX", font("extra_large"), 3, capCentre("extra_large"), W))),
  },
  {
    id: "arrow-nudge",
    name: "Nudging arrow",
    group: "Wayfinding",
    about: "A solid 13 px arrow that nudges towards a side once a second with a short streak: someone pointing over there.",
    usage: "arrowNudge({ duration, x, y: 1, dir: -1 })",
    display: "front",
    demo: layer(fx.arrowNudge({ duration: 3, x: 4, y: 1, dir: -1 }), clip(3, (r) => r.text("SAM", font("extra_large"), 34, capCentre("extra_large"), W))),
  },
  {
    id: "scroll-band",
    name: "Scrolling band",
    group: "Wayfinding",
    about: "Chevron groups and a word streaming towards a side like a moving-walkway sign, with a shimmer through the chevrons and speed lines on the edges.",
    usage: 'scrollBand({ duration, text: "ALEX", dir: 1, speed: 30 })',
    display: "front",
    demo: fx.scrollBand({ duration: 4, text: "ALEX", dir: 1 }),
  },
  {
    id: "walker",
    name: "Walker",
    group: "Wayfinding",
    about: "A 7 × 13 stick figure that walks, stands, waves and points: walkFrame(t) gives the step.",
    usage: 'drawWalker(r, x, y, dir, walkFrame(t))  // or "stand", "wave", "point"',
    display: "front",
    demo: clip(3.5, (r, t) => {
      const x = Math.min(32, -8 + t * 24);
      const pose = t < 1.7 ? fx.walkFrame(t) : t < 2.4 ? "wave" : "point";
      fx.drawWalker(r, x, 1, 1, pose, W, t);
      if (t >= 2.4) for (let k = 0; k < 3; k++) fx.drawChevron(r, 42 + k * 6, 4, 7, 1, mix(hex("#0B2A40"), hex("#62C7FF"), fx.chase(t, k, { period: 0.9, step: 0.15, decay: 0.22 })));
    }),
  },

  // Logo ----------------------------------------------------------------------------------------------------------
  {
    id: "jira-fly-in",
    name: "Jira fly-in",
    group: "Logo",
    about: "The Jira chevrons fly in from huge, one after another, each landing with a flash. Sprites at 16, 12 and 11 px.",
    usage: "jiraFlyIn({ x: 1, y: 2, size: 12, duration })  ·  drawJiraMark(r, x, y, 12)",
    display: "front",
    demo: layer(seq(fx.burst({ duration: 0.7 }), pause(1.6)), { clip: jiraFlyIn({ x: 30, y: 2, size: 12, duration: 2.3 }), at: 0 }),
  },

  // Modifiers -----------------------------------------------------------------------------------------------------
  {
    id: "shake",
    name: "Shake",
    group: "Modifiers",
    about: "Wraps any clip and shakes it sideways for a while: impacts, alarms, punchlines.",
    usage: "shake(clip, { from: 0.5, to: 0.9, amplitude: 2 })",
    display: "front",
    demo: fx.shake(clip(2.2, (r) => r.text("YET???", font("extra_large"), 14, capCentre("extra_large"), W)), { from: 0.6, to: 1.2 }),
  },
  {
    id: "slide",
    name: "Slide",
    group: "Modifiers",
    about: "Slides any clip in from a side, and out again at the end.",
    usage: 'slide(clip, { from: "bottom", time: 0.3, out: true })',
    display: "front",
    demo: fx.slide(clip(2.4, (r) => r.text("HELLO", font("extra_large"), 16, capCentre("extra_large"), W)), { from: "bottom", out: true }),
  },
  {
    id: "glitch",
    name: "Glitch",
    group: "Modifiers",
    about: "Bursts of rows shifting sideways with split colour channels.",
    usage: "glitch(clip, { intensity: 3, every: 1.2 })",
    display: "front",
    demo: fx.glitch(layer(fx.panel({ duration: 3 }), clip(3, (r) => r.text("ERROR", font("extra_large"), 15, capCentre("extra_large"), W))), { every: 0.9, burst: 0.25 }),
  },
  {
    id: "squash",
    name: "Squash",
    group: "Modifiers",
    about: "Squashes any clip onto its centre line as it ends (or stretches it out as it starts).",
    usage: 'squash(clip, { time: 0.22, at: "end" })',
    display: "front",
    demo: seq(fx.squash(clip(1.5, (r) => screen(r)), { time: MOTION.quick }), pause(MOTION.rest)),
  },
];
