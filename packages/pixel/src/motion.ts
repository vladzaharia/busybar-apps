// Motion tokens: the durations every component defaults to, calibrated against the stock BUSY Bar animations so
// new screens move like the built-in ones. Use these instead of picking numbers; when something feels too fast or
// too slow, change it here (or pick the neighbouring token), not in one scene.
//
// Stock reference (firmware assets, 60 fps):
//   0.17 s  start-menu item swap, horizontal mask wipe (each direction)
//   0.35 s  radial flash transition
//   0.5 s   skip / done transitions, spinner revolution
//   0.67 s  turn-off, oval iris, pause transitions
//   1.0 s   app icon enter
//   1.1 s   select transition (bloom, then a slow fade)
//   1.5 s   power-on burst, before the "Hello" loop
//   3–10 s  ambient loops of the status signs (ON AIR, MEETING, ...)

export const MOTION = {
  /** A cursor step, a menu item swap: 0.15 s. */
  flick: 0.15,
  /** Quick swaps and wipes, a word rolling out: 0.25 s. */
  quick: 0.25,
  /** The standard transition: flashes, blooms, fades, slides: 0.4 s. */
  base: 0.4,
  /** Big, deliberate moves: switch-off, iris, collapse: 0.65 s. */
  slow: 0.65,
  /** A scene-level beat (an entrance, a logo landing): 1.1 s. */
  scene: 1.1,
  /** One revolution of a spinner: 0.6 s. */
  spin: 0.6,
  /** Ambient cycles (sheens, glows, breathing dots): 1.6 s. */
  ambient: 1.6,
  /** Glide speed for moving lines of text, px/s; ~39 keeps the big font readable on the LEDs. */
  glideSpeed: 39,
  /** Typing speed for dialogue, letters per second (a handheld RPG's "medium" text speed). */
  typeSpeed: 26,
  /** Rest after a transition before the next thing happens: 0.5 s. */
  rest: 0.5,
} as const;

/**
 * How long a short line should stay still to be read on the front display: half a second to notice it, plus about
 * 45 ms per letter. "DID YOU" → 0.8 s; "Did you file a / JIRA ticket yet?" → 1.9 s.
 */
export function readTime(text: string): number {
  return 0.5 + text.replace(/\s+/g, "").length * 0.045;
}
