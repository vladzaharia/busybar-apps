// Front scene D, "Wild Encounter": a handheld-RPG battle. Rendered for one preset message.
//
// The clip is transparent wherever the live clock should show: the flashes and stripes play over the real clock,
// and at the end a black veil fades away to reveal it again. Everything in between is opaque.

import {
  clip,
  dialogue,
  drawDialogue,
  drawHpBox,
  drawJiraMark,
  fade,
  flash,
  hex,
  holdEnd,
  lerp,
  mix,
  outCubic,
  paginate,
  seq,
  span,
  stripes,
  type Clip,
  type Color,
  type Raster,
} from "@vladzaharia/bar-pixel";
import type { Preset } from "../../src/presets.ts";

const BLACK = hex("#000000");
const INK = hex("#141820");
const BLUE = hex("#1D7AFC");
const GRASS = hex("#2F6B45");
const MARK = { x: 57, y: 2, size: 12 };

/** The battle: the issue on its grass platform, with its HP box. */
function battle(r: Raster, o: { markX: number; hop?: number; hud: number; hp: number; lunge?: number }): void {
  r.clear(BLACK);
  const x = o.markX + (o.lunge ?? 0);
  r.shade((px, py) => {
    const dx = (px + 0.5 - (o.markX + MARK.size / 2)) / 9;
    const dy = (py + 0.5 - 14.5) / 1.8;
    return dx * dx + dy * dy <= 1 ? GRASS : null;
  });
  drawJiraMark(r, x, MARK.y + (o.hop ?? 0), MARK.size);
  drawHpBox(r, { name: "ISSUE", hp: o.hp, alpha: o.hud });
}

/** "???" and other question marks pulse blue on the dark ink. */
const emphasis = (_i: number, ch: string, t: number): Color | undefined =>
  ch === "?" ? mix(INK, BLUE, 0.5 + 0.5 * Math.sin(t * 12)) : undefined;

export function encounter(preset: Preset): Clip {
  // 1. The encounter: three flashes over the clock, then the stripes close.
  const intro = seq(flash({ count: 3 }), holdEnd(stripes({ mode: "cover" }), 0.02));

  // 2. The issue slides in on its platform; its HP box appears and fills; it hops.
  const SLIDE = 0.6;
  const HUD = 0.3;
  const CRY = 0.3;
  const arrive = clip(SLIDE + HUD + CRY, (r, t) => {
    const markX = lerp(-18, MARK.x, Math.min(1, t / SLIDE));
    const hud = span(t, SLIDE, SLIDE + HUD);
    const cry = span(t, SLIDE + HUD, SLIDE + HUD + CRY);
    const hop = cry > 0 && cry < 1 ? -Math.abs(Math.sin(cry * Math.PI * 2)) * 2 : 0;
    battle(r, { markX, hop: Math.round(hop), hud, hp: outCubic(span(t, SLIDE + 0.1, SLIDE + HUD + 0.15)) });
  });

  // 3. The dialogue box rises over the scene, then the talking.
  const rise = clip(0.18, (r, t) => {
    battle(r, { markX: MARK.x, hud: 1, hp: 1 });
    drawDialogue(r, { lines: [], typed: 0, t, rise: outCubic(t / 0.18) });
  });
  const talk = dialogue({
    pages: [{ lines: ["A wild ISSUE", "appeared!"], hold: 0.8 }, ...paginate(preset.message, 66, 1.5), { lines: ["ISSUE used", "GUILT TRIP!"], hold: 0.45 }],
    cps: 26,
    emphasis,
  });

  // 4. The attack: the box drops, the issue lunges, the screen flashes and shakes, sparks fly.
  const attack = clip(0.7, (r, t) => {
    const p = t / 0.7;
    const lunge = p < 0.35 ? -Math.sin(span(p, 0, 0.35) * Math.PI) * 10 : 0;
    const shake = p > 0.3 && p < 0.75 ? Math.round(Math.sin(t * 90) * 2) : 0;
    const scene = r.clone().clear();
    battle(scene, { markX: MARK.x, hud: 1, hp: 1, lunge });
    r.clear(BLACK).draw(scene, shake, 0);
    const flashA = p > 0.3 && p < 0.7 ? Math.max(0, Math.sin(span(p, 0.3, 0.7) * Math.PI * 2)) : 0;
    if (flashA > 0) r.fillRect(0, 0, r.width, r.height, { ...hex("#FFFFFF"), a: flashA });
    const spark = span(p, 0.35, 0.8);
    if (spark > 0 && spark < 1) {
      for (let k = 0; k < 6; k++) {
        const ang = (k / 6) * Math.PI * 2 + 0.4;
        r.glow(24 + Math.cos(ang) * spark * 22, 8 + Math.sin(ang) * spark * 7, 2.2, 2.2, { ...hex("#85B8FF"), a: 1 - spark }, 1.4);
      }
    }
  });

  // 5. "It's super effective!", then fade to black, then the black fades away off the clock.
  const finale = dialogue({ pages: [{ lines: ["It's super", "effective!"], hold: 0.9 }], cps: 26 });
  const toBlack = clip(0.3, (r, t) => {
    finale.draw(r, finale.duration);
    fade({ duration: 0.3, from: 0, to: 1 }).draw(r, t);
  });
  const reveal = fade({ duration: 0.35, from: 1, to: 0 });

  return seq(intro, arrive, rise, talk, attack, finale, toBlack, reveal);
}
