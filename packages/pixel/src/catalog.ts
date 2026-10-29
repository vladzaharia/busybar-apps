// The component catalog: every effect with a short demo. The gallery page is generated from this list, so a new
// component becomes browsable by adding one entry here. Keep demos short (2–4 s) and on the display the component
// is meant for.

import * as fx from "./fx/index.ts";
import { capCentre } from "./fx/text.ts";
import { drawJiraMark, drawJiraTicket, drawTicketFace, jiraFlyIn, jiraMarkIn, JIRA_TONES_WHITE, TICKET_SIZE, ticketFace } from "./jira.ts";
import { moonIcon } from "./icons.ts";
import { font, inkWidth, textWidth } from "./font.ts";
import { hex, mix, Raster } from "./raster.ts";
import { MOTION, readTime } from "./motion.ts";
import { lerp, outBack, outCubic, span } from "./ease.ts";
import { clip, layer, pause, seq, type Clip } from "./timeline.ts";

export interface CatalogEntry {
  id: string;
  name: string;
  group: "Transitions" | "Backgrounds" | "Text" | "HUD" | "Wayfinding" | "Sprites" | "Logo" | "Modifiers";
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
  r.text(label, f, Math.round((r.width - inkWidth(label, f)) / 2), capCentre("bold", r.height), W);
}

const under = (c: Clip, label?: string): Clip => layer(clip(c.duration, (r) => screen(r, label)), c);
/** Screen at rest, cover, hold covered, reveal, rest: so the loop shows before, during and after. */
const coverThenReveal = (cover: Clip, reveal: Clip) =>
  under(seq(pause(MOTION.rest), fx.holdEnd(cover, MOTION.rest), reveal, pause(MOTION.rest)));

/** A stand-in for a front sign: the panel with a word centred on its ink, for the transitions that take one away. */
const SIGN = layer(
  fx.panel({ duration: 1.2 }),
  clip(1.2, (r) => {
    const f = font("extra_large");
    r.text("MEETING", f, Math.floor((r.width - inkWidth("MEETING", f)) / 2), capCentre("extra_large"), W);
  }),
);

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
    id: "wipe-out",
    name: "Wipe away",
    group: "Transitions",
    about: "Takes the last frame of a clip away to transparency with a soft edge sweeping across, so a sign leaves in a sweep instead of cutting out. Follow a clip with it, over whatever should show through.",
    usage: 'wipeOut(sign, { direction: 1, edge: hex("#FFFFFF") })  // 0.25 s',
    display: "front",
    demo: under(seq(SIGN, fx.wipeOut(SIGN, { direction: 1 }), pause(MOTION.rest * 2))),
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
    about: "Everything pinches into a line, then a point of light that fades. A good way to end a scene: give it the clip it follows as `source` and that clip's last frame squashes onto the line first, instead of cutting to it.",
    usage: "collapse({ source: scene })  // 0.65 s",
    display: "front",
    demo: seq(SIGN, fx.collapse({ source: SIGN }), pause(MOTION.rest)),
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
    usage: "panel({ duration, style: PANEL_BLUE, sheenDir: 1 })  ·  drawPanel(r, { sheen, sheenDir })",
    display: "front",
    demo: layer(fx.panel({ duration: 3, period: 1.5 }), clip(3, (r) => {
      drawJiraMark(r, 2, 3, 12, { tones: JIRA_TONES_WHITE });
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
  {
    id: "sparks",
    name: "Spark burst",
    group: "Backgrounds",
    about: "Sparks flying out from a point and fading: a hit, a pop, something filed. Draw it with the burst's progress, 0 to 1.",
    usage: 'drawSparks(r, cx, cy, span(t, hit, hit + 0.35), { color: hex("#FFB020"), reach: 7 })',
    display: "front",
    demo: clip(2.4, (r, t) => {
      const k = Math.floor(t / 0.8);
      fx.drawSparks(r, [18, 36, 54][k] ?? 54, 8, ((t % 0.8) / 0.5), { color: [hex("#FFB020"), hex("#62C7FF"), hex("#3DDC84")][k] });
    }),
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
      // Ends with the last word centred on its ink: its pen offset in the line (an advance width) is subtracted from where it should sit.
      endX: Math.round((72 - inkWidth("TICKET", font("extra_large"))) / 2) - textWidth("FILE A JIRA ", font("extra_large")),
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
  {
    id: "flap-board",
    name: "Split-flap board",
    group: "Text",
    about: "A departure board: dark tiles split by their hinge come on left to right, then every flap clatters through the drum and stops, letter by letter, in reading order; blanks stop at random. `settled` says when the last one has.",
    usage: 'flapBoard({ lines: ["FILE A", "TICKET?"], x: 18, rows: [0, 8], cols: 9 })  // .settled',
    display: "front",
    demo: fx.flapBoard({ lines: ["DID YOU", "FILE ONE?"], x: 4, rows: [0, 8], cols: 11, duration: 3.6 }),
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
    id: "dialogue-rise",
    name: "Dialogue box rising",
    group: "HUD",
    about: "The empty dialogue box rising from the bottom edge in 0.18 s, so it arrives on its own before the first words are typed into it.",
    usage: "seq(dialogueRise({}), dialogue({ pages }))",
    display: "front",
    demo: seq(pause(MOTION.rest), fx.dialogueRise({}), fx.dialogue({ pages: [{ lines: ["A wild ISSUE", "appeared!"], hold: 1 }] })),
  },
  {
    id: "speech-bubble",
    name: "Speech bubble",
    group: "HUD",
    about: "A comic speech bubble beside whoever is talking: tiny text in a rounded box, its tail slanting back to them; it pops out of the tail, holds for readTime, and shrinks away.",
    usage: 'speechBubble({ x: standX + 9, top: 0, dir: 1, text: "HI!" })  // or drawSpeechBubble(r, { ..., pop })',
    display: "front",
    demo: (() => {
      const hello = fx.speechBubble({ x: 39, top: 0, dir: 1, text: "HI!" });
      const arrive = 38 / 24;
      return clip(arrive + hello.duration + 0.5, (r, t) => {
        fx.drawWalker(r, Math.min(30, -8 + t * 24), 1, 1, t < arrive ? fx.walkFrame(t) : "wave", W, t);
        if (t >= arrive) hello.draw(r, t - arrive);
      });
    })(),
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
    id: "bug",
    name: "Bug",
    group: "HUD",
    about: "An issue as a creature: an 11 × 12 red bug whose legs scuttle on bugFrame(t). The wild ISSUE in a battle.",
    usage: "drawBug(r, x, y, { frame: bugFrame(t) })",
    display: "front",
    demo: clip(3, (r, t) => {
      const x = Math.min(10, -12 + t * 18);
      fx.drawBug(r, x, 2, { frame: x < 10 ? fx.bugFrame(t) : 0 });
      if (x >= 10) r.text("A wild ISSUE!", font("small"), 26, capCentre("small"), W);
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
  {
    id: "slot-reel",
    name: "Slot reel",
    group: "HUD",
    about: "A slot machine's reel: a window onto a strip of symbols (any drawings) that spins past, blurring at speed, and lands with a small overshoot on a whole symbol. reelSteps() finds a spin that lands where you want.",
    usage: "drawReel(r, { x, y: 1, width: 16, height: 14, strip, offset: reelOffset(t, { at, stop, steps, gap: 15 }), gap: 15, speed })",
    display: "front",
    demo: (() => {
      const seven: fx.ReelSymbol = (r, cx, top, alpha) => {
        const f = font("extra_large");
        r.text("7", f, Math.round(cx - inkWidth("7", f) / 2), fx.capTop("extra_large", top + 1), hex("#FF7A33"), () => ({ alpha }));
      };
      const bug: fx.ReelSymbol = (r, cx, top, alpha) => fx.drawBug(r, cx - 5, top, { alpha });
      const mark: fx.ReelSymbol = (r, cx, top, alpha) => drawJiraMark(r, cx - 6, top + 1, 11, { poses: [0, 1, 2].map(() => ({ alpha })) });
      const strip = [seven, bug, mark, bug, seven, mark];
      const steps = [0, 1, 2].map((i) => fx.reelSteps(strip, i, (s) => s === mark, 12 + i * 4));
      const offset = (i: number, t: number) => fx.reelOffset(t, { at: 0.3, stop: 1.1 + i * 0.45, steps: steps[i]!, gap: 15 });
      return clip(3, (r, t) => {
        [10, 28, 46].forEach((x, i) => {
          const o = offset(i, t);
          fx.drawReel(r, { x, y: 1, width: 16, height: 14, strip, start: i, offset: o, gap: 15, speed: (offset(i, t + 1 / 60) - o) * 60 });
        });
      });
    })(),
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


  // Sprites -------------------------------------------------------------------------------------------------------
  {
    id: "hop",
    name: "Hop",
    group: "Sprites",
    about: "Squash and stretch for any sprite: hopPose() gives the lift and scale at a time in a run of hops (tall in the air, wide as it lands) and drawStretched() draws a raster scaled about its bottom centre.",
    usage: "const p = hopPose(t, hops); drawStretched(r, sprite, cx, ground - p.lift, p.sx, p.sy)",
    display: "front",
    demo: (() => {
      const bug = new Raster(fx.BUG_SIZE.width, fx.BUG_SIZE.height);
      fx.drawBug(bug, 0, 0);
      const hops = [0, 1, 2, 3].map((k) => ({ at: 0.2 + k * 0.5, air: 0.32, height: 4 }));
      return clip(2.8, (r, t) => {
        const p = fx.hopPose(t, hops);
        const k = Math.max(0, Math.min(4, (t - 0.2) / 0.5));
        const air = Math.min(1, ((t - 0.2) % 0.5) / 0.32);
        const cx = lerp(10, 62, (t < 0.2 ? 0 : k >= 4 ? 4 : Math.floor(k) + air) / 4);
        fx.drawStretched(r, bug, cx, 16 - Math.round(p.lift), p.sx, p.sy);
      });
    })(),
  },
  {
    id: "eight-ball",
    name: "Magic 8-ball",
    group: "Sprites",
    about: "A magic 8-ball, lit from the top left with a rim of blue light; even its dark side stays bright enough to show. face 0 shows the 8, face 1 the window with the answer die's tip. Shake it before it answers.",
    usage: "drawEightBall(r, cx, cy, radius, face)  // radius 7.6 fills the height",
    display: "front",
    demo: clip(3, (r, t) => {
      const radius = 7.6 * outBack(span(t, 0, 0.35), 2);
      const shake = t > 0.9 && t < 1.7 ? Math.round(Math.sin(t * 56) * 2 * (1.7 - t)) : 0;
      if (radius > 0.5) fx.drawEightBall(r, 36 + shake, 8, radius, t > 1.8 ? 1 : 0);
    }),
  },
  {
    id: "invader",
    name: "Ticket invader",
    group: "Sprites",
    about: "A 10 × 6 invader made of a little Jira card, arms up and down as it marches (invaderFrame), and the 7 × 4 cannon that files them.",
    usage: "drawInvader(r, x, y, invaderFrame(t))  ·  drawCannon(r, x, 12)",
    display: "front",
    demo: clip(3, (r, t) => {
      const march = [0, 2, 4, 2, 0, -2, -4, -2][Math.floor(t / 0.22) % 8]!;
      for (let k = 0; k < 5; k++) fx.drawInvader(r, 7 + march + k * 12, 1, fx.invaderFrame(t));
      fx.drawCannon(r, Math.round(lerp(4, 61, 0.5 - 0.5 * Math.cos(t * 2.1))), 12);
    }),
  },
  {
    id: "rain-cloud",
    name: "Rain cloud",
    group: "Sprites",
    about: "A 20 × 8 cloud lit from above, raining from under it in lanes, out of step; flash lights it up for lightning. The drops can be any pixel art (tiny tickets, say).",
    usage: "drawRain(r, { x, y: y + 6, t, start }); drawCloud(r, x, y, { flash })",
    display: "front",
    demo: clip(3.2, (r, t) => {
      const x = Math.round(lerp(-21, 26, outCubic(span(t, 0, 0.6))));
      fx.drawRain(r, { x, y: 7, t, start: 0.4 });
      const bolt = t > 2 ? Math.max(0, 1 - (t - 2) / 0.25) * (Math.floor((t - 2) * 30) % 2 === 0 ? 1 : 0.4) : 0;
      fx.drawCloud(r, x, 1, { flash: bolt });
    }),
  },
  // Logo ----------------------------------------------------------------------------------------------------------
  {
    id: "jira-fly-in",
    name: "Jira fly-in",
    group: "Logo",
    about: "The Jira chevrons fly in from huge, one after another, each landing with a flash. Sprites at 16, 12 and 11 px. The mark's weight sits up and to the right of its box, so jiraMarkIn() places it by its optical centre (y 3 on the 16 px display).",
    usage: "jiraFlyIn({ x: 1, y: 3, size: 12, duration })  ·  drawJiraMark(r, x, y, 12)  ·  jiraMarkIn(box, 12) for x, y",
    display: "front",
    demo: layer(seq(fx.burst({ duration: 0.7 }), pause(1.6)), { clip: jiraFlyIn({ x: 30, y: 3, size: 12, duration: 2.3 }), at: 0 }),
  },
  {
    id: "jira-ticket",
    name: "Jira ticket",
    group: "Logo",
    about: "A Jira issue as a 22 × 13 card: the mark, two summary lines and the Task checkbox. sheen runs a shine across it.",
    usage: "drawJiraTicket(r, x, y, { sheen })  // sheen 0..1",
    display: "front",
    demo: clip(3, (r, t) => drawJiraTicket(r, Math.round((r.width - TICKET_SIZE.width) / 2), 1, { sheen: (t % 1.5) / MOTION.slow })),
  },
  {
    id: "flap-faces",
    name: "Split-flap logo",
    group: "Logo",
    about: "A picture flap from a departure board: a tile that turns through faces (each a drawing on its own raster), the old one leaving upward as the next rises, and stops on the last, an airline's logo. `landed` says when.",
    usage: "flapFaces({ x: 1, y: 0, width: 15, height: 15, faces, at, duration })  // .landed",
    display: "front",
    demo: (() => {
      const mark = jiraMarkIn({ x: 0, y: 0, width: 15, height: 15 }, 12);
      const faces: ((r: Raster) => void)[] = [
        () => {},
        (r) => r.shade((x, y) => (Math.hypot(x - 7, y - 7) < 4.6 ? hex("#E5493A") : null)),
        (r) => r.shade((x, y) => (Math.abs(Math.hypot(x - 7, y - 7) - 4) < 1 ? hex("#9F8FEF") : null)),
        (r) => r.shade((x, y) => (y >= 3 && y <= 11 && Math.abs(x - 7) <= (y - 3) * 0.6 ? hex("#FF7A33") : null)),
        (r) => drawJiraMark(r, mark.x, mark.y, 12),
      ];
      return fx.flapFaces({ x: 28, y: 0, width: 15, height: 15, faces, at: 0.9, flip: 0.12, duration: 2.6 });
    })(),
  },
  {
    id: "ticket-buddy",
    name: "Ticket buddy",
    group: "Logo",
    about: "The Jira ticket as a character: a face where its summary lines and checkbox were. Eyes open, shut, big (puppy eyes) or happy, a smile or an open mouth, and blush. ticketFace() gives it as a sprite, to hop with hopPose().",
    usage: 'drawTicketFace(r, x, y, { eyes: "big", mouth: "open" })  ·  ticketFace({ eyes, mouth })',
    display: "front",
    demo: (() => {
      const hops = [{ at: 2.0, air: 0.24, height: 3 }, { at: 2.36, air: 0.24, height: 3 }];
      return clip(3, (r, t) => {
        const eyes = t >= 2 ? "happy" : (t > 0.6 && t < 0.7) || (t > 1.1 && t < 1.2) ? "shut" : t >= 1.3 ? "big" : "open";
        const mouth = t > 0.2 && t < 1 && Math.floor(t / 0.13) % 2 === 0 ? "open" : "smile";
        const p = fx.hopPose(t, hops);
        if (p.sx === 1 && p.sy === 1 && p.lift === 0) drawTicketFace(r, 25, 2, { eyes, mouth });
        else fx.drawStretched(r, ticketFace({ eyes, mouth }), 36, 15 - Math.round(p.lift), p.sx, p.sy);
      });
    })(),
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
  {
    id: "tear",
    name: "Tear",
    group: "Modifiers",
    about: "Screen tearing: everything above a jumping line slips sideways, everything below slips back a third as far, with a faint seam along the line. The amount can follow time, so a picture tears in, settles, and tears apart.",
    usage: "tear(clip, { amount: (t) => (t < 0.5 ? (1 - t / 0.5) * 10 : 0) })",
    display: "front",
    demo: fx.tear(layer(fx.panel({ duration: 3 }), clip(3, (r) => r.text("ERROR", font("extra_large"), 15, capCentre("extra_large"), W))), {
      amount: (t) => (t < 0.6 ? (1 - t / 0.6) * 10 : t > 2.2 ? span(t, 2.2, 3) * 18 : 0),
    }),
  },
];
