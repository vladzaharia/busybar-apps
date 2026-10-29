# More front styles, and a visual pass over all of them: implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Pkmn Life gains 9 Jira nag styles and 9 redirect styles. Every style, old and new, passes the visual audit's
rules. The library carries the shared fixes and pieces. Then a release, v0.3.0.

**Architecture:** shared fixes and reusable pieces go into `packages/pixel` (with catalog entries) and core. A guard
test in the app pins the audit's rules for every style. Today's eight styles are fixed against it. The 18 prototypes in
`apps/pkmn-life/concepts/` are then ported into `assets/scenes/` behind two registries (`NAG_SCENES`,
`REDIRECT_SCENES`), and the settings, the Mac app and the docs follow.

**Tech Stack:** TypeScript on Node 22–26 (type stripping, `node:test`), pnpm workspaces, bar-pixel's timeline and
`.anim` encoder, Swift 6 (the Mac app's Kit and its tests), GitHub Actions.

**Spec:** `docs/superpowers/specs/2026-10-29-front-styles-design.md`, with its audit appendix
`docs/superpowers/specs/2026-10-29-front-styles-audit.md`. Read both. The appendix holds every finding with its
location and fix; tasks cite it as "audit".

## Global Constraints

- **Display:** the front is 72 × 16; `.anim` is `argb8888` at 60 fps; clips play over the live clock. The first and
  last frames the bar shows are fully transparent, and nothing cuts from content to black in one frame.
- **Names:** up to 46 px in `extra_large` ("DAMIAN" is exactly 46). An edge-anchored name sits **3 px from its edge,
  measured on ink**. Caps sit on **rows 3–12** unless the name rides an object (train, trainer). Text is never
  mirrored.
- **Layout from width:** layouts follow the name's ink width. Decorations shrink or drop before they overlap a name,
  and the direction cue never disappears.
- **Timing:** holds where text is read last at least `readTime(text)`; readable text never creeps 1 px at a time.
  Durations use the `MOTION` tokens.
- **Light:** no full-screen light fills. Nothing important is darker than #262C38.
- **Text:** printable ASCII only.
- **Library:** reusable pieces go into `packages/pixel`, each with a `CATALOG` entry (a 2–6 s demo and a usage line).
- **Names in code:** no names of real people anywhere. Tests and examples use SAM, ALEX, DAMIAN and WWWWW.
- **Platform:** no firmware changes, and only the endpoints JavaScript apps are allowed.
- **Style ids** (they end up in saved settings):
  - nags `encounter, ticker, board, progress, notfound, squash, buddy, slots, eightball, invaders, forecast`;
  - redirects `runway, nudge, sign, walker, trainer, scroller, motorway, exit, parcel, plane, hand, train, dog, shout, map`.

## Review Focus

1. **An upgraded bar with saved settings** (`nag_style: "alternate"` or an old style value) keeps working, and
   "alternate" now goes through all eleven nags in turn. Pinned in Task 6.
2. **A Mac remote request for a style this bar build doesn't know** (an older bar, a newer Mac) plays the entry's usual
   style instead of nothing. Pinned in Task 6.
3. **Someone on the left with the widest name, in every redirect:** the name is intact and the cue still points their
   way. Pinned in Task 2 for all fifteen.
4. **Pressing OK on the back past the last style** wraps to the first (Random) without skipping any style, and the
   header label fits in its 72 px box for every style. Pinned in Task 6.
5. **A package too big for the bar:** the asset build prints the total, and Task 8 installs it on the real bar before
   release.

---

### Task 1: Library fixes in `packages/pixel` and core

**Files:**
- Modify: `packages/pixel/src/timeline.ts`, `src/font.ts`, `src/fx/text.ts`, `src/jira.ts`, `src/fx/transitions.ts`,
  `src/fx/hud.ts`, `src/fx/backgrounds.ts`, `src/fx/arrows.ts`, `src/ease.ts`, `src/catalog.ts`;
  `packages/core/src/components.ts`; `apps/pkmn-life/assets/scenes/menu.ts`, `assets/scenes/ticker.ts` (mark call
  sites only)
- Test: `packages/pixel/test/fx.test.ts`, `packages/pixel/test/anim.test.ts`, `packages/core/test/core.test.ts`

**Interfaces (produces):**
- `renderFrames(c, o)`, same signature: the last frame is drawn at `t = c.duration`. `buildAnim` gets this through
  `renderFrames`.
- `inkWidth(text: string, f: Font): number` in `font.ts`: `textWidth` less the last glyph's trailing bearing.
- In `fx/text.ts`:
  - `mirrorX(x: number, width: number, dir: 1 | -1, screen = 72): number` returns `x` for dir 1 and
    `screen − x − width` for dir −1. It replaces the copied `mx` helpers.
  - `NAME_EDGE = 3`.
- In `jira.ts`:
  - `MARK_OPTICAL_CENTRE: Record<11 | 12 | 16, { x: number; y: number }>`, computed from `MARK_SPRITES` at load.
  - `jiraMarkIn(box: { x: number; y: number; width: number; height: number }, size: 11 | 12 | 16, pad = 1): { x: number; y: number }`.
- In `fx/transitions.ts`:
  - `wipeOut(c: Clip, o: { duration?: number; direction?: 1 | -1; edge?: Color; soft?: number }): Clip` wipes away
    `c`'s last frame to transparency.
  - `collapse(o & { source?: Clip })` squashes the source's last frame onto the centre row (0.12 s), then the line.
  - `flash`'s default `peak` becomes 0.6.
- In `fx/hud.ts`:
  - `DIALOGUE_LIGHT.fill` becomes `hex("#9DA9BC")`;
  - `dialogueRise(o: { duration?: number; style?: DialogueStyle }): Clip` is the empty box rising over 0.18 s;
  - `spinner` rounds its dot positions and has an alpha floor of 0.3;
  - `speechBubbleSize` uses `inkWidth`, for even padding.
- `drawPanel(…, { sheenDir?: 1 | -1 })`.
- `arrowNudge`: the dir −1 streak is fixed (`+12` becomes `+11`), with an alpha floor of 0.3.
- `starfield`: stars spread evenly at every speed.
- `rng(seed)`: the seed is mixed (splitmix32), so a small seed doesn't start near zero.
- Core's `label` centres on ink width.

- [ ] **Step 1: Write the failing tests** in `packages/pixel/test/fx.test.ts`:
  - `last frame is drawn at duration`: a 0.5 s clip that fills only when `t >= duration` lights its last rendered
    frame.
  - `inkWidth drops the trailing bearing`: `inkWidth("HI", font("tiny")) === textWidth("HI", font("tiny")) - 1`.
  - `mirrorX mirrors`: `mirrorX(3, 30, -1) === 39`.
  - `jira mark is optically centred`: for each size, the silhouette centroid of the mark drawn at
    `jiraMarkIn({ x: 0, y: 0, width: 16, height: 16 }, size)` is within 0.35 px of (8, 8).
  - `wipeOut ends transparent`: its last frame has alpha 0 everywhere, and its first frame equals the source's last.
  - `rng starts spread`: `rng(1)()`, `rng(2)()` and `rng(3)()` are each above 0.05.
  - `spinner ring is round`: at radius 3, the dots' offsets from centre are symmetric to within 0 px.

  In `packages/core/test/core.test.ts`: `label centres on ink`. For an even-width word, the left and right ink
  margins in its box differ by at most 1.

- [ ] **Step 2: Run** `pnpm --filter @vladzaharia/bar-pixel test && pnpm --filter @vladzaharia/bar-core test`.
  Expected: the new tests FAIL.
- [ ] **Step 3: Implement the interfaces above.**
  - Move the mark's call sites to `jiraMarkIn` (audit, library 3): the `jiraFlyIn` glow, `ticker.ts` `MARK.y` 2→3,
    and the catalog demos at y 3. In `menu.ts`, the header mark goes to y 1, aligned on the LIFE caps.
  - Fix the ticket sprite's inner layout (audit, library 4).
  - Add catalog entries or update demos for `wipeOut` and `dialogueRise`.
- [ ] **Step 4: Run** `pnpm typecheck && pnpm test` from the root. Expected: all pass. Then
  `pnpm --filter @vladzaharia/bar-pixel gallery design-out/gallery` renders.
- [ ] **Step 5: Commit** "bar-pixel: last frames, ink width, the Jira mark's optical centre, and audit fixes".

### Task 2: The guard test (fails on today's styles until Task 3)

**Files:**
- Create: `apps/pkmn-life/test/styles.test.ts`, `apps/pkmn-life/test/frames.ts` (helpers)
- Create: `apps/pkmn-life/assets/scenes/registry.ts`, exporting
  `NAG_SCENES: Record<NagStyle, (e: Nag) => Clip>` and `REDIRECT_SCENES: Record<RedirectStyle, (e: Redirect) => Clip>`.
  Today's eight move behind them; `assets/build.ts` uses the registries.
- Modify: `apps/pkmn-life/package.json`: `"test": "node assets/redirects.ts && node --test test/*.test.ts"`.

**Interfaces (produces):**
- `findName(frame: Uint8Array, name: string, f: Font, spaced?: boolean): { x: number; y: number } | null` (in
  `test/frames.ts`): the name's glyph mask is lit in one colour, and every other pixel of its ink box (plus 1 px) is
  one other colour. `spaced` matches the letters one at a time, left to right.
- `luminance(frame): number`, the mean Rec. 709 luminance of the frame composited on black.

- [ ] **Step 1: Write `styles.test.ts`.** Each case renders with
  `renderFrames(scene, { width: 72, height: 16, fps: 60 })`, without a background.
  - `every style opens and closes transparent`: for all 26 styles, and every name and direction for redirects,
    `frames[0]` and the last frame have alpha 0 everywhere.
  - `every redirect shows the whole name long enough`: for each redirect, each name in `["SAM", "ALEX", "DAMIAN", "WWWWW"]`
    and each dir in `[1, -1]`, the longest run of consecutive frames where `findName` succeeds lasts at least
    `readTime(name)`. The name font is `small` for trainer, and `spaced` is true for train.
  - `edge-anchored names sit 3 px from their edge`: for runway, walker, nudge, dog, hand, map and shout (ALEX, both
    directions), the ink margin to the name's edge is 3.
  - `no glare`: for every style, no 1 s window has a mean `luminance` above 0.62.
- [ ] **Step 2: Run** `pnpm --filter pkmn-life test`. Expected: FAIL. It lists runway, walker, motorway, shout, dog,
  trainer and the others named in the audit (until the new styles exist, their cases are skipped with
  `test.todo`).
- [ ] **Step 3: Commit** "Pkmn Life: style registries and a guard test from the audit (failing)".

### Task 3: Today's eight styles pass the guard test

**Files:** `apps/pkmn-life/assets/scenes/encounter.ts`, `ticker.ts`, `redirect.ts`.

- [ ] **Step 1: Apply the audit's findings** for encounter, ticker, runway, nudge, sign, walker, trainer and scroller
  (audit, "Jira nag styles" and "Redirect styles": every high and medium item, and the low items it lists with a
  fix).
  - Use `mirrorX`, `inkWidth`, `NAME_EDGE`, `wipeOut` and `dialogueRise`.
  - Lay runway's chevron row from ink width: `start = 3 + inkW + 2`, 2–4 chevrons.
  - Walker: `standX = max(40, 3 + inkW + 1)`, mirrored; "HI" when `inkW > 40`.
  - Scroller pauses with the first name centred, for `readTime`.
  - The sign's yellows darken to #E6BA10 → #C99A00.
- [ ] **Step 2: Run** `pnpm --filter pkmn-life test`. Expected: every case for today's eight passes.
- [ ] **Step 3: Commit** "Pkmn Life: today's styles fixed against the audit".

### Task 4: Nine new Jira styles

**Files:**
- Create: `apps/pkmn-life/assets/scenes/nags/{board,progress,notfound,squash,buddy,slots,eightball,invaders,forecast}.ts`,
  each exporting `export function <id>(e: Nag): Clip`, registered in `NAG_SCENES`.
- Library pieces, with catalog entries: `fx/flap.ts` (split-flap tile and board), a `tear` modifier, slot reel,
  eight-ball, ticket face (in `jira.ts`), invader, rain cloud. Promote others only if a second scene could use them.

- [ ] **Step 1: Port each prototype from `apps/pkmn-life/concepts/`** (spec, styles table) with the audit's findings
  for it. The departure board's logo flap uses `jiraMarkIn`. The slot reels use an 11 px mark at (cx−6, top+1). One
  "?" emphasis (amber) and one lettering white across all nags.
- [ ] **Step 2: Turn the nag cases in `styles.test.ts`** from `test.todo` into tests, and run
  `pnpm --filter pkmn-life test`. Expected: PASS.
- [ ] **Step 3: Commit** "Pkmn Life: nine new Jira styles".

### Task 5: Nine new redirect styles

**Files:**
- Create: `apps/pkmn-life/assets/scenes/redirects/{motorway,exit,parcel,plane,hand,train,dog,shout,map}.ts`, each
  exporting `export function <id>(e: Redirect): Clip`, registered in `REDIRECT_SCENES`.
- Library pieces, with catalog entries: road sign, exit pictogram, van, paper plane, pointing hand, train, Growlithe,
  megaphone with sound arcs, map trail.

- [ ] **Step 1: Port each prototype** with the owner's changes:
  - **motorway:** the tab says "GO!".
  - **exit:** the person sits at their own table on their side (seated figure, desk, monitor), and the pictogram
    visitor **walks** a few steps to them and stops beside the table. Keep at least one chevron for every name.
  - **dog:** a Growlithe with a better sprite (big head; cream mane on head and chest; cream tail tuft; black stripes
    on orange). It says "GROWL!", or "GRR!" when the bubble doesn't fit, not "ARF!". Optionally a small ember puff.
  - **shout:** the megaphone reads as a megaphone (bell rim and handle), pointing their way.
  - **plane:** the name holds still.
  - Plus every audit finding for these nine. Letters that pop as something passes use screen positions, as walker does.
- [ ] **Step 2: Turn the redirect cases** from `test.todo` into tests, and run `pnpm --filter pkmn-life test`.
  Expected: PASS for all fifteen redirects × four names × two directions.
- [ ] **Step 3: Commit** "Pkmn Life: nine new redirect styles".

### Task 6: Settings, the back menu, the Mac app

**Files:**
- `apps/pkmn-life/src/presets.ts`: `NAG_STYLES` and `REDIRECT_STYLES` are the lists in Global Constraints.
- `apps/pkmn-life/src/main.ts`:
  - `STYLE_NAMES` gains the header labels BOARD, PROGRESS, 404, SQUASH, BUDDY, SLOTS, 8-BALL, INVADERS, FORECAST;
    MOTORWAY, EXIT, PARCEL, PLANE, HAND, TRAIN, GROWLITHE, SHOUT, MAP.
  - "alternate" sets `nextNag` to the next of `NAG_STYLES` after each play.
  - A remote request with an unknown style plays `pickStyle(entry)`.
- `apps/pkmn-life/src/appmeta/settings.json`:
  - `version` 7;
  - the `nag_style` option `alternate` gets the label "Each in turn";
  - new options with labels Departure board, Stuck progress bar, 404, Bug squash, Ticket buddy, Slot machine,
    Magic 8-ball, Ticket invaders, Forecast;
  - and Motorway sign, Exit sign, Parcel van, Paper plane, Pointing hand, Little train, Growlithe, Shout,
    Treasure map.
- `mac/PkmnLifeRemote/Sources/PkmnLifeRemoteKit/Catalog.swift` (`nagStyles`, `redirectStyles`) and
  `PkmnSettings.swift` (the same options and labels).
- Test: `apps/pkmn-life/test/menu.test.ts`, and the existing Kit tests.

- [ ] **Step 1: Write `menu.test.ts`:**
  - `every header label fits`: `textWidth("ALT: " + label, font("small")) <= 72` for every nag label, and
    `textWidth(label, font("small")) <= 72` for every redirect label.
  - `alternate goes through every nag in turn and wraps`: extract the stepping as an exported pure function
    `nextInTurn(style: NagStyle): NagStyle` in `src/styles.ts` and test it.
  - `cycling with OK visits every mode once and wraps`: export `nextMode(mode, modes)` the same way.
  - `an unknown requested style falls back`: export `requestedStyle(entry, word, fallback): Style`.
- [ ] **Step 2: Run** `pnpm --filter pkmn-life test`. Expected: FAIL until implemented. Then implement and run again:
  PASS.
- [ ] **Step 3: Run** `cd mac/PkmnLifeRemote && swift test`. Expected: PASS, including `settingsMatchSettingsJSON`
  and `catalogMatchesPresets` with the new lists.
- [ ] **Step 4: Commit** "Pkmn Life: the new styles in settings, the back menu and the Mac app".

### Task 7: Mid-way review gallery and docs

**Files:**
- `apps/pkmn-life/concepts/build.ts` builds the gallery from `NAG_SCENES` and `REDIRECT_SCENES` (the real styles,
  ALEX right and SAM left), plus a "Review" group with the debated items listed in the spec's "Reviews with the
  owner". Delete the ported prototypes; keep the harness and the unchosen ones.
- Docs:
  - `apps/pkmn-life/README.md`: the styles table and settings;
  - `mac/README.md`;
  - `packages/pixel/README.md`, if it lists effects;
  - root `README.md`.

- [ ] **Step 1: Build the gallery** (`node concepts/build.ts`), serve `design-out/concepts/`, and ask the owner to
  review the debated items (non-blocking: carry on with Task 8 meanwhile).
- [ ] **Step 2: Commit** "Pkmn Life: gallery of the real styles; docs".

### Task 8: Storage, the bar, the simulator

- [ ] **Step 1: Run** `cd apps/pkmn-life && pnpm build`. Expected: the asset build prints a total of about 4.1 MB
  with the owner's two people. Add the total line to `assets/build.ts` if it doesn't print one.
- [ ] **Step 2: Run** `pnpm sim:serve`, open the page, and play every new style from the back menu and through the API.
  Expected: no console errors.
- [ ] **Step 3: If the bar answers** at 10.0.4.20 (`curl -s http://10.0.4.20/api/version`), run `pnpm app:install`.
  Expected: it installs, and the owner sees the new styles play. If it fails for size, stop and report the numbers
  (spec, Storage).

### Task 9: Full pass and release

- [ ] **Step 1: Full review.**
  - All 26 styles in the gallery, both directions, short and wide names.
  - A fresh reviewer subagent re-runs the audit rubric on the final styles; fix what it finds.
- [ ] **Step 2: Run** `pnpm typecheck && pnpm test && (cd mac/PkmnLifeRemote && swift test)`. Expected: PASS. Push,
  and CI is green on `main`.
- [ ] **Step 3: Release.**
  - Tag `v0.3.0` on `main` and push the tag.
  - The owner approves the Mac job.
  - Verify the release: checksums, the notarised app (`spctl`: Notarized Developer ID), and Pages.
