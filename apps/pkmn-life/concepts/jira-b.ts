// Unchosen concept for the "Did you file a JIRA ticket?" nag, set B: the hungry ticket pet. The others in this set
// (ticket buddy, slot machine, 8-ball, ticket invaders, forecast) were rebuilt as the buddy, slots, eightball,
// invaders and forecast styles in assets/scenes/nags and are gone from here. A throwaway prototype for the gallery
// (see types.ts). It opens from the clock into black and closes back onto the clock.

import {
  MOTION,
  Raster,
  dissolve,
  drawBar,
  fade,
  font,
  hex,
  inOutCubic,
  layer,
  lerp,
  outBounce,
  outCubic,
  pause,
  readTime,
  roll,
  seq,
  shake,
  span,
  stampPalette,
  clip,
  type Clip,
  type Color,
  type FontName,
} from "@vladzaharia/bar-pixel";
import type { Concept } from "./types.ts";

const BLACK = hex("#000000");
const WHITE = hex("#FFFFFF");
/** Box fill: softer than white, which glares on the LEDs. */
const SOFT = hex("#CFD8E6");
const INK = hex("#141820");
const JIRA = hex("#1D7AFC");
const JIRA_MID = hex("#579DFF");
const JIRA_LIGHT = hex("#85B8FF");
const AMBER = hex("#FFB020");
const CYAN = hex("#62C7FF");
const PINK = hex("#FF8FA3");

// --- Shared helpers -------------------------------------------------------------------------------------------------

/**
 * Over the clock: `cover` hides it, `body` plays on an opaque ground, `reveal` brings the clock back. Two clear frames
 * close it, so the last frame shows nothing of a reveal that has not quite finished.
 */
function framed(cover: Clip, body: Clip, reveal: Clip, ground: Color = BLACK): Clip {
  return seq(cover, layer(clip(body.duration, (r) => r.clear(ground)), body), reveal, pause(2 / 60));
}

/** Fades the last `time` seconds of `c` to `color`, so a reveal can start from it. */
function endIn(c: Clip, time: number, color: Color = BLACK): Clip {
  return layer(c, { clip: fade({ duration: time, from: 0, to: 1, color }), at: c.duration - time });
}

/** The top of a text element whose capitals start on row `capTop`. */
function capY(name: FontName, capTop: number): number {
  const f = font(name);
  return capTop - (f.ascent - (f.glyph(0x48)?.height ?? f.ascent - 2));
}

// --- Hungry pet -----------------------------------------------------------------------------------------------------

/** A ticket pet: a dog-eared page in Jira blues on two little feet, 10 x 12. Two step frames. */
const PET_FRAMES = [
  [
    "LLLLLLf...",
    "LLLLLLff..",
    "LLLLLLfff.",
    "LLLLLLLLLL",
    "LLLLLLLLLL",
    "LLLLLLLLLL",
    "LLLLLLLLLL",
    "LLLLLLLLLL",
    "LLLLLLLLLL",
    "MMMMMMMMMM",
    ".b.....b..",
    ".bb....bb.",
  ],
  [
    "LLLLLLf...",
    "LLLLLLff..",
    "LLLLLLfff.",
    "LLLLLLLLLL",
    "LLLLLLLLLL",
    "LLLLLLLLLL",
    "LLLLLLLLLL",
    "LLLLLLLLLL",
    "LLLLLLLLLL",
    "MMMMMMMMMM",
    "..b.....b.",
    "..bb....bb",
  ],
];
const PET_PALETTE: Record<string, Color> = { L: JIRA_LIGHT, f: JIRA_MID, M: JIRA_MID, b: JIRA };

type PetFace = { eyes: "open" | "shut" | "sad"; mouth: "shut" | "open" | "wobble"; tear?: number };

function drawPet(r: Raster, x: number, y: number, frame: 0 | 1, face: PetFace): void {
  x = Math.round(x);
  y = Math.round(y);
  stampPalette(r, PET_FRAMES[frame]!, x, y, PET_PALETTE);
  for (const ex of [2, 6]) {
    if (face.eyes === "open") r.fillRect(x + ex, y + 4, 1, 2, INK);
    else if (face.eyes === "shut") r.fillRect(x + ex, y + 5, 1, 1, INK);
    else {
      r.fillRect(x + ex, y + 5, 1, 1, INK);
      r.blend(x + ex + (ex === 2 ? -1 : 1), y + 4, INK);
    }
  }
  r.blend(x + 1, y + 6, PINK);
  r.blend(x + 8, y + 6, PINK);
  if (face.mouth === "shut") r.fillRect(x + 4, y + 7, 2, 1, INK);
  else if (face.mouth === "open") {
    r.fillRect(x + 3, y + 6, 4, 3, INK);
    r.fillRect(x + 4, y + 8, 2, 1, PINK);
  } else {
    r.blend(x + 3, y + 8, INK);
    r.fillRect(x + 4, y + 7, 2, 1, INK);
    r.blend(x + 6, y + 8, INK);
  }
  if (face.tear !== undefined && face.tear > 0 && face.tear < 1) r.blend(x + 2, y + 6 + Math.floor(face.tear * 4), CYAN);
}

function hungryPet(): Clip {
  const DROP = 0.5;
  const HUD_AT = 0.3;
  const DRAIN_AT = 0.7;
  const DRAIN = 0.6;
  const TEXT_AT = 1.2;
  const words = [
    { text: "", font: "normal" as const, hold: 0.26 },
    { text: "FEED ME", font: "normal" as const, hold: readTime("FEED ME") + 0.6 },
    { text: "A TICKET!", font: "normal" as const, hold: readTime("A TICKET!") + 0.9 },
  ];
  const FEED = TEXT_AT + 0.26;
  const ASK = FEED + words[1]!.hold;
  const END = TEXT_AT + words.reduce((d, w) => d + w.hold, 0);
  const RUMBLE = ASK + 0.15;
  // On the roll's own clock "A TICKET!" has rolled in at ASK - TEXT_AT; TICKET turns amber as it settles.
  const text = roll({
    words,
    box: { x: 20, width: 52, height: 9 },
    color: (i, ch, t) => (t >= ASK - TEXT_AT && i >= 2 && ch !== "!" ? AMBER : WHITE),
  });

  const pet = clip(END, (r, t) => {
    const y = lerp(-13, 3, outBounce(span(t, 0, DROP)));
    const step = Math.floor(t / 0.3);
    const x = 5 + (t > DROP ? [0, 1, 0, -1][step % 4]! : 0);
    const chomp = t > FEED && t < ASK && Math.floor(t / 0.15) % 2 === 0;
    const face: PetFace = {
      eyes: t > RUMBLE ? "sad" : Math.abs(t - (FEED - 0.15)) < 0.06 ? "shut" : "open",
      mouth: chomp ? "open" : t > RUMBLE ? "wobble" : "shut",
      tear: t > RUMBLE + 0.4 ? ((t - RUMBLE - 0.4) % 0.9) / 0.6 : undefined,
    };
    drawPet(r, x, y, (step % 2) as 0 | 1, face);
  });

  const hud = clip(END, (r, t) => {
    const slide = Math.round((1 - outCubic(span(t, HUD_AT, HUD_AT + MOTION.base))) * 52);
    const small = font("small");
    r.text("FOOD", small, 22 + slide, capY("small", 1), SOFT);
    const value = 0.3 * (1 - inOutCubic(span(t, DRAIN_AT, DRAIN_AT + DRAIN)));
    const empty = t > DRAIN_AT + DRAIN;
    const alarm = empty && Math.floor((t - DRAIN_AT - DRAIN) / 0.3) % 2 === 0;
    drawBar(r, { x: 44 + slide, y: 1, width: 26, height: 5, value, track: alarm ? hex("#6A2A10") : hex("#2A303B"), fill: AMBER });
    const l = new Raster(r.width, r.height);
    l.clip = { x0: 0, y0: 0, x1: r.width, y1: 9 };
    if (t >= TEXT_AT) text.draw(l, t - TEXT_AT);
    r.draw(l, 0, 7);
  });

  const body = endIn(layer(shake(pet, { from: RUMBLE, to: RUMBLE + 0.5, amplitude: 1, hz: 14 }), hud, clip(END + 0.4, () => {})), 0.4);
  return framed(dissolve({ mode: "cover" }), body, fade({ duration: 0.35, from: 1, to: 0 }));
}

export const CONCEPTS: Concept[] = [
  {
    id: "jira-pet",
    name: "Hungry pet",
    about: "A tiny ticket pet drops in and paces like a handheld pet while its FOOD bar drains to empty and blinks. It chomps at \"FEED ME\", then rumbles and tears up at \"A TICKET!\".",
    uses: "reuses drawBar, roll, shake, dissolve, fade · new: the ticket pet (a dog-eared page on two feet: step frames, chomp, sad face, tear)",
    clip: hungryPet(),
  },
];
