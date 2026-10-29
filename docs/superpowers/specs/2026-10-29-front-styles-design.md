# Pkmn Life: more front styles, and a visual pass over all of them

Status: for the owner's approval. Date: 2026-10-29. Audit findings: [the appendix](2026-10-29-front-styles-audit.md).

## Why

Pkmn Life's front display (72 × 16 LEDs) plays two kinds of moments: the Jira nag ("Did you file a JIRA ticket?",
two styles today) and the redirects ("go see NAME", six styles today, one per person configured in the local
`redirects.json`). The owner wants many more ways to show both, picked from 26 throwaway prototypes in the concepts
gallery (`apps/pkmn-life/concepts/`, rendered with `node concepts/build.ts`). They also want every style, old and new,
to look right: nothing off-centre, nothing clipped. Their example: the Jira mark is not visually centred, because its
weight sits top-right.

## Goals

1. Ship the 18 chosen styles as real Pkmn Life styles (table below), each working for every allowed name (up to 46 px
   in `extra_large`, e.g. DAMIAN) and for someone on either side.
2. Fix every high and medium finding of the audit, for today's eight styles and the eighteen new ones. Fix the low
   ones where the fix is small; the appendix marks the few that may stay.
3. Make the fixes that cause trouble in many places once, in `packages/pixel`, rather than per scene.
4. Add checks that keep it that way (see Verification).

## Non-goals

- The prototypes not chosen (terminal, notification, checkbox, hungry pet, sat-nav, call transfer, UFO, bowling).
  They can stay in the concepts gallery for later.
- Names drawn at run time. Names stay in `redirects.json` and are rendered into the animations at build time.
- A setting for which styles are in rotation. Random keeps using the shuffle bag over all of an entry's styles.
  (The settings schema has no multi-select. A comma-list setting edited by the Mac app is a possible follow-up.)
- Redesigning the back menu, the title cards or the clocks. Only the back menu's style labels change, and the Jira
  mark in its header gets the optical-centre fix.
- Any firmware change.

## Anti-goals (failure even if it "works")

- A style that breaks with a wide name or for someone on the left.
- A real person's name in the repository, the release, a test or a screenshot.
- Prototype code copied in without the audit's fixes, or without its reusable parts moved into the library.
- Large areas of bright white or yellow that glare across the room.

## The styles

The prototype for each is in `apps/pkmn-life/concepts/` under the given id. It is the reference for look and beats,
not code to keep as-is.

**Jira nag (9 new; today's two are `encounter` and `ticker`):**

| id | label | prototype |
| --- | --- | --- |
| `board` | Departure board | `jira-departure-board` |
| `progress` | Stuck progress bar | `jira-progress` |
| `notfound` | 404 | `jira-404` |
| `squash` | Bug squash | `jira-bug-squash` |
| `buddy` | Ticket buddy | `jira-buddy` |
| `slots` | Slot machine | `jira-slots` |
| `eightball` | Magic 8-ball | `jira-8-ball` |
| `invaders` | Ticket invaders | `jira-invaders` |
| `forecast` | Forecast | `jira-forecast` |

**Redirects (9 new; today's six are `runway`, `nudge`, `sign`, `walker`, `trainer`, `scroller`):**

| id | label | prototype |
| --- | --- | --- |
| `motorway` | Motorway sign | `redirect-motorway-go`: the tab says **GO!** (owner) |
| `exit` | Exit sign | `redirect-exit-table`, changed (owner): the person sits at **their own table** on their side (a seated figure at a desk with a monitor), and the pictogram figure is a **visitor** who **walks** a few steps over to them (a short walk, not running on the spot and dashing) and stops beside the table, rather than sitting down at a desk of their own |
| `parcel` | Parcel van | `redirect-parcel` |
| `plane` | Paper plane | `redirect-plane` |
| `hand` | Pointing hand | `redirect-hand` |
| `train` | Little train | `redirect-train` |
| `dog` | Growlithe | `redirect-growlithe`, beats as the prototype, with two changes (owner). **A better sprite**: unmistakably Growlithe, not a striped fox: the big head, the cream mane over the head and chest, the cream tail tuft, black stripes on orange. **No "ARF!"**: Growlithe says its own cry, e.g. "GROWL!" (or "GRR!" where a wide name leaves less room), possibly with a small ember puff (it's a fire type). Both are in the mid-way review |
| `shout` | Shout | `redirect-shout` |
| `map` | Treasure map | `redirect-map` |

The ids and labels are my call. Each style also needs a short label for the back screen's header, where today's read
e.g. "ALT: ENCOUNTER". The builder picks those to fit the header (menu.ts).

## Rules every style follows (from the audit)

- **Opens and closes transparent.** The first frame is fully transparent and so is the last frame the bar shows.
  Scenes never cut from content to black in one frame: content leaves (wipes, slides, fades) over the clip.
- **Names:** an edge-anchored name sits **3 px from its edge, measured on ink**. A name inside a panel or object is
  centred on ink in that space. Caps sit on **rows 3–12** unless the name rides an object (train, trainer's dialogue).
  Text is never mirrored; layouts are.
- **Wide names:** every style is laid out from the name's ink width, not from fixed x positions. When something no
  longer fits, it gets smaller or drops a decoration (fewer chevrons, "HI" for "HI!", "EXIT" for "EXIT 1"). The name
  is never overlapped, and the direction cue never disappears.
- **Optical centring:** the Jira mark is placed by its optical centre (library, below), everywhere.
- **Reading time:** every hold where text must be read lasts at least `readTime(text)`. Text that should be read
  doesn't creep 1 px at a time; it holds still or moves clearly.
- **Brightness:** no full-screen light fills; the dialogue box's fill and the yellow sign get darker (appendix M3).
  Nothing important is drawn in colours too dark to light an LED (below about #262C38).
- **Consistency:** one emphasis colour for "?" across the nags (amber, steady or one shared pulse), one lettering
  white (#FFFFFF or #DCE3EE, the builder picks one), and the shared entrance and exit timings from the `MOTION`
  tokens.

## Library work (`packages/pixel`)

Each fixes several places at once (appendix, "Library-level"):

1. `renderFrames` draws the last frame at `t = duration`; drop the `pause(2/60)` workarounds.
2. `inkWidth(text, font)` (advance width minus the trailing bearing). Use it to centre, mirror and right-align, in the
   speech bubble's size, and in core's `label`. Move the copied mirroring helpers into one shared helper.
3. The Jira mark's optical centre: `MARK_OPTICAL_CENTRE` per size and `jiraMarkIn(box, size)`. Every call site moves
   (the appendix table lists them), and the `jiraFlyIn` glow centres on it. The ticket sprite's inner layout is fixed too.
4. A way to wipe or reveal over a held last frame, so scenes stop cutting to black. `collapse` squashes its source
   instead of cutting to a line.
5. `spinner` rounds its dot positions and raises its alpha floor. `flash` peaks lower. `starfield` stops bunching at
   the centre. `drawPanel`'s sheen follows a direction. `arrowNudge`'s streak is fixed for the left. The rng's seeds
   are mixed, so a small seed doesn't start near zero. The dialogue box has a darker default fill and an entrance
   that rises.
6. Every new reusable piece from the prototypes moves into the library with a `CATALOG` entry, a 2–6 s demo and a
   usage line (AGENTS.md). Examples: split-flap tile, slot reel, glitch tear, ticket face, invader, rain cloud, road
   sign, exit pictogram, van, paper plane, pointing hand, train, dog/Growlithe, megaphone, map trail. What stays
   scene-specific is the builder's call; the rule is "a second scene could use it".

## Fitting it into the app

- `src/presets.ts`: `NAG_STYLES` and `REDIRECT_STYLES` gain the new ids. `assets/build.ts` renders them as today.
- `src/appmeta/settings.json`: the "Ticket style" and "Redirect style" enums gain the new options. The Mac app's
  `PkmnSettings.swift` and `Catalog.swift` style lists match (the Kit tests check it). The simulator's form follows
  settings.json by itself.
- **The "Alternate" ticket mode** today switches between the two nag styles after each play. With eleven it becomes
  "each in turn": the next style in order after each play. The value stays `alternate` so saved settings keep
  working, and the label changes to fit. This is my call.
- OK on the back cycles through every style as today. With 15 redirect styles that's a long cycle; it's accepted for
  now (see Non-goals).
- READMEs (the app's styles table, the Mac app's list of what a click can play) describe the new styles.

## Storage

Measured by encoding the prototypes: the nine new nags add about **0.55 MB** once. The nine new redirects add about
**0.56 MB per person** with one exit sign and one dog (0.86 MB with every variant). The back screen's `back.anim` grows
too: it holds one countdown section per entry and style, as long as that front clip (about 95 bytes per frame at
30 fps). That adds about 0.15 MB for the nags plus 0.15 MB per person. With the owner's two people, the app grows from
**1.9 MB to about 4.1 MB**. With the six people `redirects.json` allows, it reaches about 8.5 MB.

The bar's storage limit isn't documented anywhere we have (busy-cli declares none).

- **What must fit (my call):** the owner's own list. The asset build prints the package's total size.
- **Install early:** install the package on the real bar before the polish work, and check that it installs and plays.
- **If the owner's list doesn't fit:** stop and bring the numbers back to the owner. That's a design question (fewer
  styles, a lower frame rate for some), not one to settle silently.
- **If six people don't fit but two do:** lower the people limit in `assets/redirects.ts` to what fits, rather than
  dropping styles.

## Verification

- `pnpm typecheck`, `pnpm test`, the Mac app's `swift test`, and CI green.
- New tests in the app or in bar-pixel:
  - every style renders for "SAM", "ALEX", "DAMIAN" (46 px) and "WWWWW" in both directions;
  - the name's ink is intact and unoverlapped during its hold;
  - the first and last frames have alpha 0;
  - the hold is at least `readTime`;
  - no frame is lit above a brightness budget across most of the screen.
- The concepts gallery (or the bar-pixel gallery for library pieces) rebuilt for the two owner reviews (below).
- Pkmn Life in the simulator: each new style plays from the back menu and from the Mac app.
- On the real bar: the package installs, the new styles play, and nothing stutters.

## Left to the builder

- File layout: one file per style or per family, under `assets/scenes/`.
- Exact pixel art, timings within the rules, and the back-screen labels.
- The order of the work. Suggested: library fixes and tests first (they change today's styles), then the new
  styles family by family.
- What to do with `apps/pkmn-life/concepts/`: keep the harness (types, sheet, build) as the place for future
  prototypes; drop the prototypes once ported.

## Reviews with the owner

The owner reviews twice:

1. **Mid-way: what changed or is in debate.** Once the library fixes and a first version of each family exist, the
   owner reviews, in the concepts gallery at device speed:
   - the Jira mark's optical centring and the reworked ticket sprite (they show in many styles);
   - the glare fixes to today's styles: the darker dialogue fill (trainer, encounter), the softer flashes, the darker
     wayfinding-sign yellow;
   - the set-wide choices: one lettering white, the "?" emphasis (colour and pulse), the shared entrance and exit
     timings;
   - the debatable redesigns: the exit sign's visit to the person's table, the Growlithe's sprite and cry, the
     shout's megaphone, the walker's "HI" for wide names, the scroller pausing on the name, the plane's name holding
     still;
   - how today's styles look with wide names after their fixes (runway, walker, motorway);
   - the back-screen labels and "each in turn".
2. **At the end: a full pass.** All 26 styles, both directions, short and wide names, in the gallery and in the
   simulator, and on the bar.

Installing on the real bar needs the bar on USB or its address: ask the owner when the build gets there (the storage
check), and wait for their go-ahead before installing.
