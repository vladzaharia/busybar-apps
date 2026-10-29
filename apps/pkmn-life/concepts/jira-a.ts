// Unchosen concepts for the "Did you file a JIRA ticket?" nag, set A: a terminal, a notification and a checkbox that
// unticks itself. The others in this set (departure board, stuck progress bar, 404, bug squash) were rebuilt as the
// board, progress and notfound/squash styles in assets/scenes/nags and are gone from here. Throwaway prototypes for
// the gallery: see types.ts.
//
// Each opens from the clock to black and ends by handing the screen back to the clock, like the scenes in
// assets/scenes: an opening transition, the body on a black ground, a closing transition, a reveal.

import {
  JIRA_TONES_WHITE,
  MOTION,
  Raster,
  clip,
  crt,
  drawJiraMark,
  drawPanel,
  fade,
  font,
  hex,
  inCubic,
  inOutCubic,
  layer,
  lerp,
  mix,
  outBack,
  seq,
  slide,
  span,
  stampPalette,
  textWidth,
  typewriter,
  type Clip,
  type Color,
  type FontName,
  type PanelStyle,
} from "@vladzaharia/bar-pixel";
import { H, W, type Concept } from "./types.ts";

// --- Shared ---------------------------------------------------------------------------------------------------------

const BLACK = hex("#000000");
/** Soft white for lettering and fills: full white LEDs glare. */
const INK = hex("#DCE3EE");
const JIRA = hex("#1D7AFC");
const JIRA_MID = hex("#579DFF");
const JIRA_LIGHT = hex("#85B8FF");
const AMBER = hex("#FFB020");

/** The black ground a scene plays on once the clock is covered. */
function ground(r: Raster): void {
  r.fillRect(0, 0, W, H, BLACK);
}

const blackFor = (duration: number): Clip => clip(duration, ground);

/** The clock fades to black. */
const dim = (duration = 0.3): Clip => fade({ duration, from: 0, to: 1 });

/** The black fades off the clock. */
const unveil = (duration = 0.35): Clip => fade({ duration, from: 1, to: 0 });

/** `cover` played over the last frame of `body`: how a scene closes. */
function over(body: Clip, cover: Clip): Clip {
  return clip(cover.duration, (r, t) => {
    body.draw(r, body.duration);
    cover.draw(r, t);
  });
}

/** `cover` played over the first frame of `body`: how a scene opens out of black. */
function under(body: Clip, cover: Clip): Clip {
  return clip(cover.duration, (r, t) => {
    body.draw(r, 0);
    cover.draw(r, t);
  });
}

/** Top of a text element whose capitals start on row `cap`. */
function capTop(name: FontName, cap: number): number {
  const f = font(name);
  return cap - (f.ascent - (f.glyph(0x48)?.height ?? f.ascent));
}

// --- Terminal -------------------------------------------------------------------------------------------------------

function terminal(): Concept {
  const small = font("small");
  const PHOSPHOR = hex("#4BE38A");
  const DIM = hex("#23874C");
  const BRIGHT = hex("#B6FFD2");
  const X = 2;
  const YS = [-1, 7] as const;
  const PROMPT = "$ ";
  const CMD = "jira create";
  const ASK = "ticket? [y/N] ";
  const CPS = 12;
  const IDLE = 0.6;
  const TYPE = CMD.length / CPS;
  const ENTER = 0.25;
  const OUT = 0.15;
  const WAIT = 1.9;
  const D = IDLE + TYPE + ENTER + OUT + WAIT;
  const cmdX = X + textWidth(PROMPT, small);
  const typeCmd = typewriter({ lines: [CMD], font: "small", x: cmdX, ys: [YS[0]], cps: CPS, duration: TYPE, color: () => PHOSPHOR });
  const typeAsk = typewriter({
    lines: [ASK],
    font: "small",
    x: X,
    ys: [YS[1]],
    cps: ASK.length / OUT,
    duration: OUT,
    color: (_i, ch) => (ch === "N" ? BRIGHT : "[/]".includes(ch) ? DIM : PHOSPHOR),
  });
  const blink = (t: number) => Math.floor(t / 0.32) % 2 === 0;

  const screen = clip(D, (r, t) => {
    ground(r);
    r.text(PROMPT, small, X, YS[0], DIM);
    const tc = t - IDLE;
    if (tc > 0) typeCmd.draw(r, Math.min(TYPE, tc));
    const ta = tc - TYPE - ENTER;
    if (ta > 0) typeAsk.draw(r, Math.min(OUT, ta));
    // The block cursor: solid while typing, blinking while it waits.
    let cx = cmdX;
    let row: number = YS[0];
    let on = blink(t);
    if (ta > 0) {
      cx = X + textWidth(ASK.slice(0, Math.min(ASK.length, Math.floor((ta / OUT) * ASK.length))), small);
      row = YS[1];
      on = ta < OUT || blink(ta - OUT);
    } else if (tc > 0) {
      cx = cmdX + textWidth(CMD.slice(0, Math.min(CMD.length, Math.floor(tc * CPS))), small);
      on = tc < TYPE || blink(tc - TYPE);
    }
    if (on) r.fillRect(cx, row + 2, 3, 5, PHOSPHOR);
  });

  return {
    id: "jira-terminal",
    name: "Terminal",
    about:
      "The clock goes dark and a green terminal switches on. Someone types $ jira create; it asks ticket? [y/N] and the cursor blinks, waiting. Nobody answers, and the screen switches off like an old CRT.",
    uses: "reuses typewriter, crt (on and off), fade · new: block cursor",
    clip: seq(
      dim(),
      under(screen, crt({ duration: MOTION.base, mode: "reveal", glow: BRIGHT })),
      screen,
      over(screen, crt({ mode: "cover", glow: BRIGHT })),
      unveil(),
    ),
  };
}

// --- Notification ---------------------------------------------------------------------------------------------------

function notification(): Concept {
  const small = font("small");
  const tiny = font("tiny");
  const CARD: PanelStyle = {
    top: hex("#313A4C"),
    bottom: hex("#1E2431"),
    border: hex("#4E5A73"),
    highlight: hex("#465269"),
    shadow: hex("#181D27"),
  };
  const ICON = { x: 2, y: 1, size: 13 };
  const TX = 17;
  const SHOW = 3.8;
  const BADGE_AT = 0.55;
  const banner = clip(SHOW, (r, t) => {
    drawPanel(r, { style: CARD, radius: 3, sheen: lerp(-20, 110, span(t, 1.0, 2.0)) });
    // The app icon, a Jira-blue rounded square, hops as the badge pops on its corner.
    const hop = Math.round(-Math.sin(span(t, BADGE_AT, BADGE_AT + MOTION.quick) * Math.PI) * 1);
    r.roundRect(ICON.x, ICON.y + hop, ICON.size, ICON.size, 3, JIRA);
    drawJiraMark(r, ICON.x + 1, ICON.y + 1 + hop, 11, { tones: JIRA_TONES_WHITE });
    // The badge: a red dot (a digit doesn't fit in it at this size; the "1" is in the message).
    const pop = outBack(span(t, BADGE_AT, BADGE_AT + MOTION.quick), 2.4);
    if (pop > 0.2) {
      const s = Math.max(2, Math.round(5 * pop));
      const c = { x: ICON.x + ICON.size - 1, y: 2 };
      r.roundRect(Math.round(c.x - s / 2), Math.round(c.y - s / 2), s, s, 2, hex("#F04438"));
    }
    r.text("Jira", small, TX, capTop("small", 2), hex("#FFFFFF"));
    r.text("now", tiny, 69 - textWidth("now", tiny), capTop("tiny", 3), hex("#8A93A3"));
    r.text("1 ticket missing", small, TX, capTop("small", 9), INK);
  });

  return {
    id: "jira-notification",
    name: "Notification",
    about:
      "The clock dims and a macOS-style banner slides down from the top: the Jira app icon, a red 1 popping on its corner, and \"1 ticket missing\". A shine crosses it, then it slides back up.",
    uses: "reuses slide, drawPanel (a dark notification style), drawJiraMark · new: the app icon square and badge",
    clip: seq(dim(), layer(blackFor(SHOW), slide(banner, { from: "top", time: MOTION.base, out: true })), unveil()),
  };
}

// --- Checkbox -------------------------------------------------------------------------------------------------------

/** A mouse pointer, 7 × 11: soft white with a grey edge (so it shows over lettering). Its tip is the top-left. */
const POINTER = [
  "o......",
  "oo.....",
  "owo....",
  "owwo...",
  "owwwo..",
  "owwwwo.",
  "owwwwwo",
  "owwoooo",
  "owo.ow.",
  "oo..ow.",
  "o....o.",
];
const POINTER_PALETTE: Record<string, Color> = { o: hex("#5A6478"), w: hex("#E6EBF2") };

function checkbox(): Concept {
  const small = font("small");
  const LABEL = "I filed a ticket";
  const BOX = 9;
  const GAP = 4;
  const total = BOX + GAP + textWidth(LABEL, small);
  const BX = Math.round((W - total) / 2);
  const BY = 3;
  const LX = BX + BOX + GAP;
  const target = { x: BX + 4, y: BY + 4 };
  const APPEAR = 0.3;
  const MOVE_AT = 0.7;
  const MOVE = 0.9;
  const CLICK = MOVE_AT + MOVE + 0.15;
  const LEAVE = CLICK + 0.35;
  const FADE_AT = CLICK + 1.6;
  const FADE = 1.0;
  const DOUBT = FADE_AT + FADE + 0.2;
  const D = DOUBT + 1.3;
  const TICK: [number, number][] = [[2, 4], [2, 5], [3, 5], [3, 6], [4, 6], [4, 7], [5, 5], [5, 6], [6, 4], [6, 5], [7, 3], [7, 4]];

  const body = clip(D, (r, t) => {
    ground(r);
    const a = span(t, 0, APPEAR);
    const checked = span(t, CLICK, CLICK + 0.12) * (1 - span(t, FADE_AT, FADE_AT + FADE));
    // The box: a light-blue outline that fills Jira blue when ticked, a tick drawn in stroke by stroke.
    r.roundRect(BX, BY, BOX, BOX, 2, (x, y) => {
      const edge = x === BX || y === BY || x === BX + BOX - 1 || y === BY + BOX - 1;
      return edge ? { ...JIRA_LIGHT, a } : { ...mix(hex("#10151D"), JIRA, checked), a };
    });
    const drawn = span(t, CLICK, CLICK + 0.15) * TICK.length;
    TICK.forEach(([x, y], i) => i < drawn && r.blend(BX + x, BY + y, INK, checked));
    // A ring where it was clicked.
    const ring = span(t, CLICK, CLICK + 0.35);
    if (ring > 0 && ring < 1) {
      r.shade((x, y) => {
        const d = Math.hypot(x + 0.5 - target.x - 0.5, y + 0.5 - target.y - 0.5);
        return Math.abs(d - (4 + ring * 7)) < 0.7 ? { ...JIRA_MID, a: 0.8 * (1 - ring) } : null;
      });
    }
    // The label; once the tick has gone, it starts to doubt itself.
    r.text(LABEL, small, LX, capTop("small", BY + 2), { ...INK, a });
    const doubt = span(t, DOUBT, DOUBT + MOTION.quick);
    if (doubt > 0) {
      const hop = Math.round(-Math.sin(doubt * Math.PI) * 2);
      r.text("?", small, LX + textWidth(LABEL, small), capTop("small", BY + 2) + hop, AMBER);
    }
    // The pointer glides in from the bottom right, clicks (dipping a pixel), and drifts away.
    let px: number;
    let py: number;
    if (t < LEAVE) {
      const p = inOutCubic(span(t, MOVE_AT, MOVE_AT + MOVE));
      px = lerp(W + 4, target.x, p) + Math.sin(p * Math.PI) * 6;
      py = lerp(H + 2, target.y, p) - Math.sin(p * Math.PI) * 3;
      if (t > CLICK - 0.05 && t < CLICK + 0.1) py += 1;
    } else {
      const p = inCubic(span(t, LEAVE, LEAVE + 0.7));
      px = lerp(target.x, W + 6, p);
      py = lerp(target.y, H + 4, p * 0.8);
    }
    stampPalette(r, POINTER, Math.round(px), Math.round(py), POINTER_PALETTE);
  });

  return {
    id: "jira-checkbox",
    name: "Checkbox",
    about:
      "\"[ ] I filed a ticket\". A pointer glides in and clicks the box, which fills blue with a tick; the pointer leaves. A pause, then the tick quietly fades back out, and a ? pops onto the end of the line.",
    uses: "reuses fade, motion tokens · new: checkbox and pointer sprites, click ring",
    clip: seq(dim(), body, over(body, dim()), unveil()),
  };
}

export const CONCEPTS: Concept[] = [terminal(), notification(), checkbox()];
