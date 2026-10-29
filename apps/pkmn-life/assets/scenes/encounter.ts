// Front scene D, "Wild Encounter": a handheld-RPG battle. Rendered for one preset message.
//
// The clip is transparent wherever the live clock should show: the flashes and stripes play over the real clock,
// and at the end a black veil fades away to reveal it again. Everything in between is opaque.

import {
  BUG_SIZE,
  DIALOGUE_RISE,
  bugFrame,
  clip,
  dialogue,
  dialogueRise,
  drawBug,
  drawDialogue,
  drawHpBox,
  drawJiraMark,
  drawJiraTicket,
  fade,
  flash,
  hex,
  holdEnd,
  inCubic,
  inQuad,
  layer,
  lerp,
  MOTION,
  outCubic,
  paginate,
  seq,
  span,
  stripes,
  TICKET_SIZE,
  type Clip,
  type Color,
  type Raster,
} from "@vladzaharia/bar-pixel";
import type { Nag } from "../../src/presets.ts";
import { ask } from "./look.ts";

const BLACK = hex("#000000");
const INK = hex("#141820");
const GRASS = hex("#2F6B45");
/** The hit's sparks: a light Jira blue that stays bright on black. */
const SPARK = hex("#85B8FF");
const WHITE = hex("#FFFFFF");
/** Where the issue stands; its platform is centred under it. */
const ISSUE = { x: 55, y: 2 };
/** Where the ticket it turns into stands: centred on the same platform (to the half pixel), a pixel in from the screen's edge. */
const TICKET = { x: 72 - TICKET_SIZE.width - 1, y: 1 };
/** The thrown Jira mark's size (one of its hand-placed sprites). */
const MARK = 11;

/** The battle: the issue on its grass platform, with its HP box. `glow` 0..1 turns the issue white. */
function battle(r: Raster, o: { issueX: number; hop?: number; hud: number; hp: number; t: number; hidden?: boolean; glow?: number }): void {
  r.clear(BLACK);
  r.shade((px, py) => {
    const dx = (px + 0.5 - (o.issueX + BUG_SIZE.width / 2)) / 9;
    const dy = (py + 0.5 - 14.5) / 1.8;
    return dx * dx + dy * dy <= 1 ? GRASS : null;
  });
  if (!o.hidden) {
    const y = ISSUE.y + (o.hop ?? 0);
    drawBug(r, o.issueX, y, { frame: bugFrame(o.t) });
    if (o.glow) drawBug(r, o.issueX, y, { frame: bugFrame(o.t), color: WHITE, alpha: o.glow });
  }
  drawHpBox(r, { name: "ISSUE", hp: o.hp, alpha: o.hud });
}

/** Six sparks flying out from the issue, `p` 0..1 (none at 1). */
function sparks(r: Raster, p: number): void {
  if (p >= 1) return;
  const cx = ISSUE.x + BUG_SIZE.width / 2;
  for (let k = 0; k < 6; k++) {
    const ang = (k / 6) * Math.PI * 2 + 0.4;
    const sx = cx + Math.cos(ang) * p * 12;
    const sy = 8 + Math.sin(ang) * p * 7;
    r.glow(sx, sy, 2.4, 2.4, { ...SPARK, a: 1 - p }, 1.4);
    r.blend(sx, sy, WHITE, 1 - p);
  }
}

/** The dialogue box dropping away from the bottom edge over the battle (as `dialogueRise` raises it). */
function dialogueDrop(hp: number): Clip {
  return clip(DIALOGUE_RISE, (r, t) => {
    battle(r, { issueX: ISSUE.x, hud: 1, hp, t });
    drawDialogue(r, { lines: [], typed: -1, t, rise: 1 - inCubic(t / DIALOGUE_RISE) });
  });
}

/** The empty dialogue box rising over the battle, the issue at `hp`. */
function dialogueRaise(hp: number): Clip {
  return layer(clip(DIALOGUE_RISE, (r, t) => battle(r, { issueX: ISSUE.x, hud: 1, hp, t })), dialogueRise());
}

/** "???" and other question marks pulse from the ink to amber, as every nag's "?" does. */
const emphasis = (_i: number, ch: string, t: number): Color | undefined => (ch === "?" ? ask(INK, t) : undefined);

export function encounter(preset: Nag): Clip {
  // 1. The encounter: three flashes over the clock, then the stripes close.
  const intro = seq(flash({ count: 3 }), holdEnd(stripes({ mode: "cover" }), 0.02));

  // 2. The issue scuttles in on its platform; its HP box appears and fills; it hops.
  const SLIDE = 0.6;
  const HUD = 0.3;
  const CRY = 0.3;
  const arrive = clip(SLIDE + HUD + CRY, (r, t) => {
    const issueX = lerp(-18, ISSUE.x, outCubic(Math.min(1, t / SLIDE)));
    const hud = span(t, SLIDE, SLIDE + HUD);
    const cry = span(t, SLIDE + HUD, SLIDE + HUD + CRY);
    const hop = cry > 0 && cry < 1 ? -Math.abs(Math.sin(cry * Math.PI * 2)) * 2 : 0;
    battle(r, { issueX, hop: Math.round(hop), hud, hp: outCubic(span(t, SLIDE + 0.1, SLIDE + HUD + 0.15)), t });
  });

  // 3. The dialogue box rises over the scene, then the talking.
  const rise = dialogueRaise(1);
  const talk = dialogue({
    pages: [
      { lines: ["A wild ISSUE", "appeared!"], hold: 0.9 },
      ...paginate(preset.message, 66, 1.5),
      { lines: ["TRAINER used", "FILE JIRA TICKET!"], hold: 0.9 },
    ],
    cps: 26,
    emphasis,
  });

  // 4. The box drops away, and the attack: the Jira mark is thrown in from the trainer's side, the screen flashes and
  // shakes, sparks fly, the issue blinks, and its HP drains away.
  const lower = dialogueDrop(1);
  const THROW = MOTION.base;
  const DRAIN = MOTION.slow;
  const HIT = THROW + MOTION.quick;
  const attack = clip(HIT + DRAIN + MOTION.quick, (r, t) => {
    const hit = t - THROW;
    const shake = hit > 0 && hit < 0.35 ? Math.round(Math.sin(t * 90) * 2) : 0;
    const scene = r.clone().clear();
    battle(scene, {
      issueX: ISSUE.x,
      hud: 1,
      hp: 1 - span(t, HIT, HIT + DRAIN),
      t,
      hidden: hit > 0 && hit < 0.5 && Math.floor(hit * 12) % 2 === 1,
    });
    r.clear(BLACK).draw(scene, shake, 0);
    // The mark arcs over, a fading trail behind it.
    for (const [lag, alpha] of [[0.12, 0.2], [0.06, 0.45], [0, 1]] as const) {
      const p = span(t - lag, 0, THROW);
      if (p <= 0 || p >= 1) continue;
      const x = lerp(-MARK, ISSUE.x, p);
      const y = lerp(5, ISSUE.y + 1, p) - Math.sin(p * Math.PI) * 4;
      drawJiraMark(r, x, y, MARK, { poses: [0, 1, 2].map(() => ({ alpha })) });
    }
    if (hit > 0) {
      const flashA = Math.max(0, Math.sin(span(hit, 0, 0.2) * Math.PI));
      if (flashA > 0) r.fillRect(0, 0, r.width, r.height, { ...WHITE, a: flashA * 0.6 });
      sparks(r, span(hit, 0.05, 0.5));
    }
  });

  // 5. The box rises again over the emptied HP bar for "It's super effective!", and drops away.
  const raise = dialogueRaise(0);
  const finale = dialogue({ pages: [{ lines: ["It's super", "effective!"], hold: 0.9 }], cps: 26 });
  const drop = dialogueDrop(0);

  // 6. The issue glows white and bursts into a Jira ticket, which opens from its middle and hops; the HP box fades
  // away and a shine runs across the ticket.
  const GLOW = MOTION.base;
  const OPEN = 0.15;
  const turn = clip(GLOW + MOTION.scene + MOTION.quick, (r, t) => {
    const after = t - GLOW;
    if (after <= 0) {
      battle(r, { issueX: ISSUE.x, hud: 1, hp: 0, t, glow: inQuad(span(t, 0, GLOW)) });
      return;
    }
    battle(r, { issueX: ISSUE.x, hud: 1 - span(after, 0, MOTION.quick), hp: 0, t, hidden: true });
    const half = (TICKET_SIZE.height / 2) * outCubic(span(after, 0, OPEN));
    const hop = Math.round(-Math.sin(span(after, OPEN, OPEN + MOTION.quick) * Math.PI));
    const mid = TICKET.y + TICKET_SIZE.height / 2 + hop;
    r.clip = { x0: 0, y0: Math.floor(mid - half), x1: r.width, y1: Math.ceil(mid + half) };
    drawJiraTicket(r, TICKET.x, TICKET.y + hop, { sheen: span(after, 0.5, 0.5 + MOTION.slow) });
    r.clip = null;
    const burst = span(after, 0, MOTION.base);
    if (burst < 1) {
      r.glow(ISSUE.x + BUG_SIZE.width / 2, 7, 10, 7, { ...WHITE, a: 0.9 * (1 - burst) }, 2);
      sparks(r, burst);
    }
  });

  // 7. The ticket fades to black, then the black fades away off the clock.
  const toBlack = clip(MOTION.base, (r, t) => {
    battle(r, { issueX: ISSUE.x, hud: 0, hp: 0, t, hidden: true });
    drawJiraTicket(r, TICKET.x, TICKET.y);
    fade({ duration: MOTION.base, from: 0, to: 1 }).draw(r, t);
  });
  const reveal = fade({ duration: MOTION.base, from: 1, to: 0 });

  return seq(intro, arrive, rise, talk, lower, attack, raise, finale, drop, turn, toBlack, reveal);
}
