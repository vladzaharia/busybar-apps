// Pkmn Life: a clock on the front (plain, or with the sprint), a move menu on the back. Turn the wheel to pick an
// entry (FILE A TICKET, then a redirect per person), press START to play it on the front, OK to change how it plays
// (a fixed style, or random), hold START for today's Majora's Mask title card, BACK to stop what is playing or leave
// the app. The Pkmn Life Remote Mac app can do the same from a desk, and change the settings while the app runs (see
// remoteInbox below).
//
// All motion is pre-rendered (see assets/): this file only names animation sections and draws the clock, so the
// bar's web server sees a request per second for the clock and a few per button press.

import {
  AnimPlayer,
  LiveFace,
  clockFace,
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
import { ENTRIES, NAG_STYLES, REDIRECT_STYLES, SPRINTS, stylesFor, type Entry, type NagStyle, type RedirectStyle, type Style } from "./presets.ts";

type NagMode = "alternate" | "random" | NagStyle;
type RedirectMode = "random" | RedirectStyle;

const NAG_MODES: NagMode[] = ["alternate", "random", ...NAG_STYLES];
const REDIRECT_MODES: RedirectMode[] = ["random", ...REDIRECT_STYLES];
const CLOCK_STYLES: SprintStyle[] = ["plain", "bar", "dots", "majora"];
const STYLE_NAMES: Record<Style, string> = {
  encounter: "ENCOUNTER",
  ticker: "TICKER",
  runway: "RUNWAY",
  nudge: "NUDGE",
  sign: "SIGN",
  walker: "WALKER",
  trainer: "TRAINER",
  scroller: "SCROLLER",
};

const DEFAULTS = {
  nag_style: "alternate" as NagMode,
  redirect_style: "random" as RedirectMode,
  clock_style: "majora" as SprintStyle,
  title_cards: true,
  title_cards_time: "09:00",
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
  let cardShownOn = "";

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
    if (e.kind === "nag") nagMode = NAG_MODES[(NAG_MODES.indexOf(nagMode) + 1) % NAG_MODES.length]!;
    else redirectMode = REDIRECT_MODES[(REDIRECT_MODES.indexOf(redirectMode) + 1) % REDIRECT_MODES.length]!;
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
    const style = settings.clock_style;
    const face = style === "plain" ? clockFace(now, options) : sprintClockFace(now, sprint, { ...options, style });
    clock.draw(face);

    // The morning title card, once a work day at the set time.
    const at = minutesOf(settings.title_cards_time);
    const minute = now.getHours() * 60 + now.getMinutes();
    if (cardsOn() && sprint.workday && at !== null && minute === at && cardShownOn !== dayKey(now) && !showing) playCard();
  }

  const cardsOn = () => settings.clock_style === "majora" && settings.title_cards;

  /** Today's "Dawn of the Nth Day", then "-N Days Remain-". */
  function playCard(): void {
    const now = new Date();
    const sprint = sprintAt(now, sprintConfig());
    cardShownOn = dayKey(now);
    const day = Math.min(20, sprint.done + 1);
    const dawn = sprint.left <= 1 ? "dawn-final" : `dawn-${day}`;
    const remain = `remain-${Math.max(1, Math.min(20, sprint.left))}`;
    timers.cancel(carding ?? undefined);
    card.play(CARDS, dawn);
    card.then(remain);
    carding = timers.after((sectionSeconds(CARDS, dawn) + sectionSeconds(CARDS, remain)) * 1000 + 150, stopCard);
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
    if (played && ENTRIES[sel]!.kind === "nag" && nagMode === "alternate") nextNag = nextNag === "encounter" ? "ticker" : "encounter";
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
    const styles = stylesFor(entry);
    const style: Style =
      styleWord === "random" ? (entry.kind === "nag" ? randomNag() : randomRedirect()) : styles.includes(styleWord as Style) ? (styleWord as Style) : pickStyle(entry);
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
      clock_style: CLOCK_STYLES,
      title_cards: "boolean",
      title_cards_time: "string",
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
