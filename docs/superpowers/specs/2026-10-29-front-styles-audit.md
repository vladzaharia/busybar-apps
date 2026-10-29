# Visual audit of Pkmn Life's front styles (2026-10-29)

Appendix to [the design](2026-10-29-front-styles-design.md). Two audits rendered every kept style (today's 8 and
the 18 prototypes chosen) at 72 × 16 and 60 fps and measured them: ink boxes, margins, centroids, alpha on the
first and last frames, holds against `readTime`, one-frame cuts, and brightness. Redirects were rendered for SAM, ALEX,
DAMIAN (46 px, the widest a name can be) and WWWWW (45 px), in both directions. File and line references are as of
commit `0a018d2` and the uncommitted prototypes in `apps/pkmn-life/concepts/`. Severity: high = obvious to anyone
watching; medium = a designer would notice; low = polish.

## Library-level (fix once, in `packages/pixel` or core)

1. **Last frame never drawn** (`timeline.ts:72-77`): `renderFrames` renders `t = i/fps` for `i < round(d·fps)`, never
   `t = duration`. Slide-outs and reveal wipes end around 88% done. Five redirects (sign, motorway, nudge, scroller,
   runway) and the departure board leave a sliver over the clock, which `main.ts:220` holds 150 ms then pops. Fix:
   draw the last frame at `c.duration`; then remove the `pause(2/60)` workarounds.
2. **Ink width** (`font.ts:178`): every glyph has a 1 px trailing bearing, so `textWidth` = ink + 1. Mirrored names
   sit 1 px further from their edge (runway 3/4, walker 3/4, nudge 4/5, dog 2/3, plane 7/8, hand 4/3, map 4/3,
   shout 2/1). Right alignment and the speech bubble's padding (L2 R3, T2 B3: `hud.ts:244-246`) are 1 px off too.
   Core's `label` (`packages/core/src/components.ts:39-41`) floors advance width, so even-width ink lands 1 px left.
   Fix: `inkWidth()`, a shared mirroring helper replacing the copies (`redirect.ts:57`, concepts `redirect-a.ts:49`,
   `redirect-b.ts:63-67`), and use it everywhere text is centred, mirrored or right-aligned.
3. **Jira mark optical centre** (`jira.ts`). The silhouette centroid sits right of and above the box centre, in px:

   | size | silhouette | luminance (JIRA_TONES) |
   | --- | --- | --- |
   | 11 | +0.71, −0.71 | +1.17, −1.17 |
   | 12 | +0.94, −0.94 | +1.40, −1.40 |
   | 16 | +1.01, −1.30 | +1.62, −1.91 |

   It's in the logo's shape, not a sprite bug: each chevron's bar sits on top with its column on the right. Moving
   the mark by (−1, +1) leaves residuals of 0.29 / 0.06 / 0.30. Add `MARK_OPTICAL_CENTRE` (computed from
   `MARK_SPRITES`: 11 → (6.21, 4.79), 12 → (6.94, 5.06), 16 → (9.01, 6.70)) and
   `jiraMarkIn(box, size, pad = 1)`, which centres the optical centre in the box and clamps to the padding. Centre the
   `jiraFlyIn` glow on it (`jira.ts:151`). Call sites:

   | site | now | proposed |
   | --- | --- | --- |
   | departure board logo flap, 15×15 | (2,1) | (1,2) |
   | slot reels, 16×14 window | 12 at (cx−6, top) | 11 at (cx−6, top+1) |
   | ticker MARK beside extra_large caps (`ticker.ts:40`) | y 2 | y 3 |
   | catalog panel demo, jiraFlyIn usage and demo (`catalog.ts:143, 452, 454`) | y 2 | y 3 |
   | back menu header (`menu.ts:70`) | (2,0) | (2,1), if aligned on the LIFE caps |
   | ticket's own mark, the notification icon, the thrown mark | | unchanged (no room, or moving) |

4. **Ticket sprite inner layout** (`jira.ts:161-175`): the summary lines start 1 px lower than the mark; the mark and
   checkbox sit on the shadow row (bottom padding 0 against 1 at the top); the mark is 1 px from the lines; the
   tick's top pixel breaks the checkbox's edge. Fix: lines on rows 1 and 3, checkbox on rows 6–10, lines from x14,
   tick pixel (17,8)→(16,8). The buddy's face fill follows.
5. **Cuts to black:** `seq(scene, wipe(reveal))` starts on a black frame, so runway (4.817→4.833 s) and the dog
   (5.90→5.91 s) cut the name out in one frame. Fix: a wipe or reveal that runs over the held last frame
   (e.g. `wipeOut(clip, { direction, edge })`), or content that leaves first.
6. **`collapse`** (`transitions.ts:156`) paints its own ground and starts at full width: in the ticker the recap
   becomes a line in one frame (9.433 s). Fix: squash the source onto the centre row (`squash`), then the line.
7. **`spinner`** (`hud.ts:149`) floors dot positions (lopsided ring: 3 px from the centre one way, 2 px the other)
   and fades its tail to 12%, below what LEDs show. Round positions; alpha floor about 0.3.
8. **`flash`** peaks at 0.95 white (`transitions.ts:22`): glare (encounter's intro averages 239/255 over all LEDs).
   Lower the peak to about 0.6.
9. **`starfield`** (`backgrounds.ts:85`): at low speed the centre third has 7.7× the star density.
10. **`drawPanel`'s sheen** always runs left to right (sign `redirect.ts:127-133`, motorway). Take a direction.
11. **`arrowNudge` streak** (`arrows.ts:101`): the left version is 1 px off (`+12` → `+11`); its alphas (0.22, 0.08)
    are too dark to light.
12. **Dialogue box** (`hud.ts:21`): the fill #CFD8E6 puts 72–85% of the LEDs above 0.7 luminance (trainer, encounter).
    Use about #9DA9BC. Also give the box a rising entrance callers can't skip (the trainer flashes in from black in
    one frame, 0.417→0.433 s).
13. **rng seeds:** small seeds give a near-zero first value (found by the 404 prototype). Mix the seed (`ease.ts`).

## Jira nag styles

High:
- **departure board:** the Jira mark in the logo flap is off by +1.44, −1.44 px (luminance 1.90). The only
  off-centre face on the board. Fix with `jiraMarkIn` (above).
- **encounter:** the dialogue box cuts out and back in one frame. At 8.317 s it vanishes for the attack, and at
  9.867 s it reappears for "It's super effective!". Entrances elsewhere rise over 0.18 s. The page "TRAINER used /
  FILE JIRA TICKET!" holds 0.45 s against a readTime of 1.67 s. Fix: rise and drop around the attack (the rise drawn
  with hp 0), and a hold of at least 0.9 s.

Medium:
- **ticker:** the collapse is a cut (library 6).
- **ticker:** the rest lockup sits 3 px left of centre, with margins L1 against R7 and a 10 px gap. The mark reads
  1 px high (centroid row 7.06 against the caps' 8.0). Fix: `MARK = { x: 4, y: 3, size: 12 }`, `TEXT_X0 = 19`, for
  L4 R6, a gap of 8 and centroid row 8.06.
- **slots:** all three reels' marks lean up-right (library 3).
- **encounter:** the ticket stands 2.5 px left of its platform's centre, overhanging the grass by 4 px. The platform
  touches the right edge. Fix: `ISSUE = { x: 55, y: 2 }`.
- **encounter:** glare from the flashes and the dialogue fill (library 8, 12). The mean luminance is above 150/255
  for 8.1 of 14.1 s.
- **progress:** "99%" touches the bottom edge (rows 9–15) and is right-aligned by advance width. Fix:
  `BAR.y = 9`, `capTop("normal", 8)`, align on ink.
- **progress:** the spinner (library 7). Use `SPIN = { x: 5, y: 3, radius: 3 }` so its centre lines up with the caps
  beside it.

Low:
- **departure board:** the last frame isn't clear (library 1). The board's ink sits at L0 R2; use `LOGO.x = 1` and
  `X0 = 18` for L1 R1.
- **404:** the group sits at L1 R3 (fix: `X404 = 2`), and frame 0 already shows 43 lit streak pixels.
- **buddy:** the bubbles sit flush with the top edge, and the text padding is uneven (library 2). "FILE ME?" sits
  1 px right of centre and "PLEASE?" 1.5 px left.
- **8-ball:** the page text bobs 1 px while it holds (`round(sin·0.6)`), and "SIGNS POINT TO" sits 1 px below
  capCentre. 17% of the ball is below the LED floor, so it shows as a crescent.
- **invaders:** the starfield bunches behind the text (library 9).
- **forecast:** "FILE ONE!" sits 1 px low. The first page holds 0.93 s against a readTime of 1.13 s.
- **encounter:**
  - the thrown mark's arc peaks at y −1, so it's clipped and crosses "ISSUE"; use a 4 px arc;
  - the ticket's hop reaches y −1; use a 1 px hop;
  - the bug slides in linearly and stops dead; use `outCubic`.
- **consistency:**
  - the "?" emphasis is blue in some styles and amber in others, a blink in one and a pulse elsewhere;
  - lettering is #FFFFFF in some and #DCE3EE in others;
  - seven of the eleven put text or panels flush with an edge.

Checked and fine: the split-flap letters, the ticker recap, the progress punchline, the slot 7 and bug, the
bug-squash layout, the invaders and forecast text, and the bug sprite.

## Redirect styles

High:
- **Last frame not transparent** in sign, motorway, nudge, scroller and runway (library 1).
- **runway, names ≥ 41 px:** the first chevron runs through the last letter (DAMIAN's N, for the whole hold). The
  row starts at x41, not x50 as the comment in `assets/redirects.ts:11` says. Fix: size the row from the name:
  `start = 3 + inkW + 2`, 2–4 chevrons. ALEX keeps 4, MARIA gets 3, DAMIAN gets 2, 7 px clear.
- **walker, names over about 39 px:** the figure (x41–47) stands on the last letter. DAMIAN's full name is readable
  for 2.35 s against 4.85 s for ALEX. The "HI!" bubble then touches the name (dir 1) or overlaps it (dir −1). Fix:
  `standX = max(40, 3 + inkW + 1)` mirrored, chevrons from `standX + 10` (as many as fit), and "HI" when
  `inkW > 40`.
- **motorway, names over 39 px:** the name runs into the inset border and the tab. DAMIAN covers the rim on one side
  and overlaps the tab on the other. With the GO! tab there's more room. Still lay the name out from ink width with
  a minimum 3 px clearance, and clamp.
- **shout, dir −1:** the exit piles the letters up; at 4.83 s "LEX!" is still mid-screen, then cuts. The letters
  leave in rightward order with rightward distances. Fix: order and distance from the mirrored layout.
- **dog (and the Growlithe), dir −1:** letters pop ahead of the dog, and the dog then runs across them; the pop times
  are computed for the rightward layout. Fix: compute from screen positions, as the walker does.

Medium:
- **runway and dog:** the name cuts to black in one frame (library 5).
- **trainer:** the box flashes in from black in one frame (library 12).
- **glare:** the trainer's box (85% of the screen above 0.7 for 5.3–5.5 s), and the sign's yellow (57% of the screen
  for 5.1 s; darken to about #E6BA10→#C99A00). Mean hold luminance: trainer 0.70, motorway 0.55, exit 0.53,
  sign 0.51. The dark-ground styles are 0.14–0.28.
- **plane:** the name creeps 1 px every 0.35 s during its hold, for names up to about 39 px. Hold it still, or move
  it at 15 px/s or more.
- **shout:** the megaphone is a solid triangle pointing away from the person and reads as "◀". Draw a bell rim and
  handle, or lead with chevrons; keep the ripples out of the text box.
- **mirrored names 1 px further from their edge** (library 2).
- **inconsistent edge margins** (2, 3, 4 or 7 px), shout cramped at 1–2 px. Fix: a 3 px ink margin for every
  edge-anchored name: nudge 4→3, dog 2→3, hand, map and shout `W − 3 − ink`.
- **scroller, names over 36 px:** the whole name is on screen for only about 1 s (DAMIAN 1.08 s; SAM 3.12 s). Pause
  the band while the first name is centred for `readTime`, or allow two passes.
- **exit sign, names ≥ 39 px:** the layout drops every chevron and the direction cue goes. Keep at least one. The
  resting chevron colour barely shows on the green (raise its contrast).
- **parcel:** the name fills the cargo box with no vertical padding and sits 1 px high (caps on rows 2–11). Fix: box
  rows 1–13, text at `BIG_Y`, wheels 3 rows at 13–15.

Low:
- **entrance overshoot shows the clock:** the sign's `outBack(1.1)` goes 3 px past rest, motorway 1 row, nudge's
  sweep 2 columns. Draw the panel wider than the overshoot, or use `outCubic`.
- **hand:** the sprite touches the bottom edge (use `y = 0`); for names ≥ 37 px it crops the sleeve and palm.
- **trainer:**
  - page 1 holds 1.2 s against a readTime of about 1.5 s;
  - the ▶ triangles touch the bottom border, sit at margins 6/12, and barely show at their 0.18 floor;
  - fix: `y = 7`, start at x9.
- **sheens** run left to right in both directions (library 10).
- **nudge streak** (library 11).
- **dog:** the "ARF!" bubble only fits names up to 31 px; wider names get bark lines, so the beat changes with the
  name. Acceptable, or shrink the dog for wide names.
- **exit sign, wide names:** the doorway is flush against the rim.
- **plane, DAMIAN:** the nose touches the edge.
- **map:**
  - with wide names the trail shrinks to x1–11;
  - the parchment colours barely light.
- **train:**
  - the caps are on rows 1–10 (justified by the cars);
  - the rails (#2C2620) barely light.
- **entrance and exit durations vary:** fades of 0.30 or 0.35 s, wipes of 0.40 or 0.25 s. Use the `MOTION` tokens
  consistently.

Checked and fine:
- every first frame is transparent;
- runway, walker, the exit sign and the dog mirror exactly (apart from the bugs above);
- holds exceed `readTime`, except the scroller and the plane.

Where each style puts the name today (ALEX; ink margin from its edge, dir 1 / dir −1):

| style | where | margin | caps rows |
| --- | --- | --- | --- |
| runway, walker | far edge | 3 / 4 | 3–12 |
| nudge | far edge | 4 / 5 | 3–12 |
| dog | far edge | 2 / 3 | 3–12 |
| plane | in a banner | 7 / 8 | 3–12 |
| hand, map | near edge | 4 / 3 | 3–12 |
| shout | near edge ("HEY NAME!") | 2 / 1 | 3–12 |
| sign, motorway, exit | centred in a panel | (panel) | 3–12 |
| parcel | on the van | (centred van) | 2–11 |
| train | on the cars | 10 / 10 | 1–10 |
| trainer | in "Go see NAME!", small font | — | 2–6 |

**Proposed test:** render every redirect style with "DAMIAN" (46 px) and "WWWWW" (45 px) in both directions. Assert
that the name is intact and unoverlapped during its hold, and that the last frame has alpha 0. That test would have
caught every high finding above.
