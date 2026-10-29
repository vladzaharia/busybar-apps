// Pkmn Life: a clock on the front (with or without the sprint, and the Majora's Mask title cards each work day if
// they are on), a move menu on the back. Turn the wheel to pick an entry (FILE A TICKET, then a redirect per person),
// press START to play it on the front, OK to change how it plays (a fixed style, or random), hold START for today's
// title card, BACK to stop what is playing or leave the app. The Pkmn Life Remote Mac app can do the same from a
// desk, and change the settings while the app runs (see remoteInbox below).
//
// All motion is pre-rendered (see assets/): this file only names animation sections and draws the clock, so the
// bar's web server sees a request per second for the clock and a few per button press.

import {
  AnimPlayer,
  LiveFace,
  createApp,
  label,
  readSettings,
  remoteInbox,
  sectionSeconds,
  shuffleBag,
  sprintAt,
  sprintClockFace,
  type InputEvent,
  type RemoteRequest,
  type SprintStyle,
} from "@vladzaharia/bar-core";
import manifest from "./appmeta/manifest.json";
import { BACK, CALENDAR, CARDS, FRONT } from "./generated/clips.ts";
import { ENTRIES, NAG_STYLES, REDIRECT_STYLES, SPRINTS, type Entry, type NagStyle, type Style } from "./presets.ts";
import { NAG_MODES, REDIRECT_MODES, STYLE_NAMES, nextInTurn, nextMode, requestedStyle, type NagMode, type RedirectMode } from "./styles.ts";

const SPRINT_DISPLAYS: SprintStyle[] = ["none", "bar", "dots", "short"];
/**
 * What plays over the clock on work days, independent of how it shows the sprint: nothing, the Majora's Mask dawn card,
 * or its cards for each part of the day.
 */
const CLOCK_ANIMATIONS = ["none", "majora", "majora_day"] as const;
type ClockAnimation = (typeof CLOCK_ANIMATIONS)[number];
/** The parts of a work day with a title card (assets/scenes/cards.ts names their sections). */
type DayPart = "dawn" | "meal" | "dusk";

const DEFAULTS = {
  nag_style: "alternate" as NagMode,
  redirect_style: "random" as RedirectMode,
  sprint_display: "short" as SprintStyle,
  clock_animation: "majora_day" as ClockAnimation,
  dawn_time: "09:00",
  meal_time: "12:00",
  dusk_time: "17:00",
  sprint_changes: "",
  remote_control: true,
  time_format: "24h" as "24h" | "12h",
  show_date: true,
  blink_colons: true,
};

/** Minutes after midnight for "HH:MM" or "HH:MM:SS"; null if it isn't a time. */
function minutesOf(s: string): number | null {
  const m = /^(\d{1,2}):(\d{2})/.exec(s);
  return m && Number(m[1]) < 24 && Number(m[2]) < 60 ? Number(m[1]) * 60 + Number(m[2]) : null;
}

/** Entry point, called at the end of the file: the device runs this script top to bottom and starts nothing itself. */
function main(): void {
  const app = createApp({ app: manifest.id, priority: 50 });
  const { device, timers } = app;
  const menu = new AnimPlayer(device, { id: "menu", display: "back", z_index: 1 });
  const front = new AnimPlayer(device, { id: "front", display: "front", z_index: 50 });
  const card = new AnimPlayer(device, { id: "card", display: "front", z_index: 60 });
  // The clock's elements change with its style (and the sprint's length); the face clears what a draw drops.
  const clock = new LiveFace(device, "clock");

  let settings = DEFAULTS;
  let nagMode: NagMode = DEFAULTS.nag_style;
  let redirectMode: RedirectMode = DEFAULTS.redirect_style;
  let nextNag: NagStyle = "encounter";
  // Random: every style once per round, in a fresh order each round.
  const randomNag = shuffleBag(NAG_STYLES);
  const randomRedirect = shuffleBag(REDIRECT_STYLES);
  let sel = 0;
  let showing: ReturnType<typeof setTimeout> | null = null;
  let carding: ReturnType<typeof setTimeout> | null = null;
  /** The day each part of the day's card last played on its own, so it plays once a day. */
  const cardShownOn: Record<DayPart, string> = { dawn: "", meal: "", dusk: "" };

  // The cadence is the team's (presets.ts); only its exceptions are a setting.
  const sprintConfig = () => ({ ...SPRINTS, changes: settings.sprint_changes });
  const dayKey = (d: Date) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;

  // --- Styles ---------------------------------------------------------------------------------------------------

  /** What the header shows for the selected entry: the style the next START plays, or RANDOM. */
  function styleLabel(e: Entry): string {
    if (e.kind === "nag") {
      if (nagMode === "random") return "RANDOM";
      return nagMode === "alternate" ? `ALT: ${STYLE_NAMES[nextNag]}` : STYLE_NAMES[nagMode];
    }
    return redirectMode === "random" ? "RANDOM" : STYLE_NAMES[redirectMode];
  }

  /** The style to play now; random draws from its bag only here, once per START. */
  function pickStyle(e: Entry): Style {
    if (e.kind === "nag") return nagMode === "alternate" ? nextNag : nagMode === "random" ? randomNag() : nagMode;
    return redirectMode === "random" ? randomRedirect() : redirectMode;
  }

  /** OK: the next style for the selected entry's kind. */
  function cycleStyle(e: Entry): void {
    if (e.kind === "nag") nagMode = nextMode(nagMode, NAG_MODES);
    else redirectMode = nextMode(redirectMode, REDIRECT_MODES);
  }

  // --- Front: the clock and the title cards ---------------------------------------------------------------------

  function drawClock(): void {
    const now = new Date();
    const sprint = sprintAt(now, sprintConfig());
    const options = {
      timeFormat: settings.time_format,
      showDate: settings.show_date,
      blinkColons: settings.blink_colons,
      icon: CALENDAR,
    };
    clock.draw(sprintClockFace(now, sprint, { ...options, style: settings.sprint_display }));

    // Each part of the day's title card, once a work day at its time.
    const minute = now.getHours() * 60 + now.getMinutes();
    const due = dayParts().find((p) => p.at === minute && cardShownOn[p.part] !== dayKey(now));
    if (due && sprint.workday && !showing) playCard(due.part);
  }

  const cardsOn = () => settings.clock_animation !== "none";

  /** The parts of the day whose cards play, with their times in minutes after midnight (null if unreadable). */
  function dayParts(): { part: DayPart; at: number | null }[] {
    if (settings.clock_animation === "none") return [];
    const dawn = { part: "dawn" as const, at: minutesOf(settings.dawn_time) };
    if (settings.clock_animation === "majora") return [dawn];
    return [dawn, { part: "meal", at: minutesOf(settings.meal_time) }, { part: "dusk", at: minutesOf(settings.dusk_time) }];
  }

  /** The part of the day it is: the latest whose time has come, or dawn before any has. */
  function partNow(now: Date): DayPart {
    const minute = now.getHours() * 60 + now.getMinutes();
    let latest: { part: DayPart; at: number } | undefined;
    for (const { part, at } of dayParts()) if (at !== null && at <= minute && (!latest || at >= latest.at)) latest = { part, at };
    return latest?.part ?? "dawn";
  }

  /** Today's card for `part` of the day: "Dawn of the Nth Day" then "-N Days Remain-", "Meal of ..." or "Dusk of ...". */
  function playCard(part: DayPart = partNow(new Date())): void {
    const now = new Date();
    const sprint = sprintAt(now, sprintConfig());
    cardShownOn[part] = dayKey(now);
    const title = sprint.left <= 1 ? `${part}-final` : `${part}-${Math.min(20, sprint.done + 1)}`;
    timers.cancel(carding ?? undefined);
    card.play(CARDS, title);
    let seconds = sectionSeconds(CARDS, title);
    if (part === "dawn") {
      const remain = `remain-${Math.max(1, Math.min(20, sprint.left))}`;
      card.then(remain);
      seconds += sectionSeconds(CARDS, remain);
    }
    carding = timers.after(seconds * 1000 + 150, stopCard);
  }

  function stopCard(): void {
    timers.cancel(carding ?? undefined);
    carding = null;
    void card.stop();
  }

  // --- Back: the menu ---------------------------------------------------------------------------------------------

  // Whether the header's style label is on screen: the bar refuses to clear an element it doesn't have.
  let labelShown = false;

  function drawStyleLabel(): void {
    labelShown = true;
    const text = styleLabel(ENTRIES[sel]!);
    void device.draw([{ ...label({ id: "style", text, font: "small", display: "back", color: "#8C8C8CFF", box: { x: 56, y: 0, width: 72, height: 11 } }), z_index: 2 }]);
  }

  function showMenu(): void {
    menu.play(BACK, `enter-${sel}`);
    menu.then(`idle-${sel}`, { loop: true });
    drawStyleLabel();
  }

  function select(next: number): void {
    if (next === sel || next < 0 || next >= ENTRIES.length) return;
    menu.play(BACK, `go-${sel}-${next}`);
    menu.then(`idle-${next}`, { loop: true });
    sel = next;
    drawStyleLabel();
  }

  // --- Playing an entry -------------------------------------------------------------------------------------------

  /** Plays the selected entry: in `style` if given, else as its mode says. */
  function start(style: Style = pickStyle(ENTRIES[sel]!)): void {
    if (carding) stopCard();
    const seconds = front.play(FRONT[sel]![style]!);
    menu.play(BACK, `use-${sel}`);
    menu.then(`show-${sel}-${style}`);
    if (labelShown) void device.clear(["style"]);
    labelShown = false;
    // The front clip ends on a transparent frame over the clock; remove it just after.
    showing = timers.after(seconds * 1000 + 150, () => finish(true));
  }

  function finish(played: boolean): void {
    timers.cancel(showing ?? undefined);
    showing = null;
    void front.stop();
    // "Each in turn": the next nag in NAG_STYLES after every play, the first again after the last.
    if (played && ENTRIES[sel]!.kind === "nag" && nagMode === "alternate") nextNag = nextInTurn(nextNag);
    showMenu();
  }

  // --- Remote: the Pkmn Life Remote Mac app ----------------------------------------------------------------------
  // It writes "<seq> <unix time> play <entry id> <default|random|style>", "... card" or "... stop" into the "remote"
  // setting; the app checks it once a second (while "Mac remote" is on) and acts on each new request once.

  function onRemote(r: RemoteRequest): void {
    const [action, id, styleWord] = r.words;
    if (action === "stop") {
      if (showing) finish(false);
      if (carding) stopCard();
      return;
    }
    if (action === "card") {
      if (showing) finish(false);
      playCard();
      return;
    }
    if (action !== "play") return;
    const k = ENTRIES.findIndex((e) => e.id === id);
    if (k < 0) return;
    const entry = ENTRIES[k]!;
    // "random" draws from the entry's bag; a style the entry has plays as asked; anything else ("default", a style
    // this version doesn't know) plays as the bar's own setting says.
    const style: Style =
      styleWord === "random" ? (entry.kind === "nag" ? randomNag() : randomRedirect()) : requestedStyle(entry, styleWord, () => pickStyle(entry));
    // Whatever is playing gives way.
    if (showing) {
      timers.cancel(showing);
      showing = null;
    }
    sel = k;
    start(style);
  }

  // --- Input ------------------------------------------------------------------------------------------------------

  app.onInput((event: InputEvent) => {
    if (event.key === "encoder") {
      if (!showing) select(sel + (event.delta ?? 0));
      return;
    }
    if (event.key === "start" && event.action === "long" && !showing) {
      if (cardsOn()) playCard();
      return;
    }
    if (event.action !== "short") return;
    if (event.key === "start" && !showing) start();
    else if (event.key === "ok" && !showing) {
      cycleStyle(ENTRIES[sel]!);
      drawStyleLabel();
    } else if (event.key === "back") {
      if (showing) finish(false);
      else if (carding) stopCard();
      else app.quit();
    }
  });

  // --- Settings -------------------------------------------------------------------------------------------------
  // Read when the app starts, and again whenever they change while it runs (the Mac app's Settings write them over
  // the HTTP API; remoteInbox reads them once a second while "Mac remote" is on).

  let settingsKey = "";

  function applySettings(values: Record<string, unknown> | null, starting: boolean): void {
    if (app.quitting) return;
    const { remote: _request, ...rest } = values ?? {};
    const key = JSON.stringify(rest);
    if (!starting && key === settingsKey) return;
    settingsKey = key;
    const before = settings;
    settings = readSettings(values, DEFAULTS, {
      nag_style: NAG_MODES,
      redirect_style: REDIRECT_MODES,
      sprint_display: SPRINT_DISPLAYS,
      clock_animation: CLOCK_ANIMATIONS,
      dawn_time: "string",
      meal_time: "string",
      dusk_time: "string",
      sprint_changes: "string",
      remote_control: "boolean",
      time_format: ["24h", "12h"],
      show_date: "boolean",
      blink_colons: "boolean",
    });
    // A style picked with OK on the back stays, unless the setting itself changed.
    if (starting || settings.nag_style !== before.nag_style) nagMode = settings.nag_style;
    if (starting || settings.redirect_style !== before.redirect_style) redirectMode = settings.redirect_style;
    drawClock();
    if (!showing) drawStyleLabel();
    if (carding && !cardsOn()) stopCard();
    if (starting && cardsOn() && sprintAt(new Date(), sprintConfig()).workday && !showing) playCard();
  }

  // --- Start ------------------------------------------------------------------------------------------------------

  showMenu();
  drawClock();
  timers.every(1000, drawClock);
  void device
    .settings()
    .catch(() => null)
    .then((values) => {
      applySettings(values, true);
      remoteInbox({ device, timers, field: "remote", onRequest: onRemote, onValues: (v) => applySettings(v, false), enabled: () => settings.remote_control });
    });
}

main();
