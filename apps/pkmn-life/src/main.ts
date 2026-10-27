// Pkmn Life: the stock-style clock on the front, a move menu of nags on the back. Turn the wheel to pick a nag,
// press START to play it on the front, OK to switch the nag's style, BACK to stop a nag or leave the app.
//
// All motion is pre-rendered (see assets/): this file only names animation sections and draws the clock, so the
// bar's web server sees a request per second for the clock and a few per button press.

import { AnimPlayer, clockFace, createApp, label, readSettings, type InputEvent } from "@vladzaharia/bar-core";
import manifest from "./appmeta/manifest.json";
import { BACK, CALENDAR, NAGS } from "./generated/clips.ts";
import { PRESETS, type NagStyle } from "./presets.ts";

type Mode = "alternate" | NagStyle;

const DEFAULTS = {
  nag_style: "alternate" as Mode,
  time_format: "24h" as "24h" | "12h",
  show_date: true,
  blink_colons: true,
};

const MODES: Mode[] = ["alternate", "encounter", "ticker"];
const STYLE_NAMES: Record<NagStyle, string> = { encounter: "ENCOUNTER", ticker: "TICKER" };

/** Entry point, called at the end of the file: the device runs this script top to bottom and starts nothing itself. */
function main(): void {
  const app = createApp({ app: manifest.id, priority: 50 });
  const { device, timers } = app;
  const menu = new AnimPlayer(device, { id: "menu", display: "back", z_index: 1 });
  const nag = new AnimPlayer(device, { id: "nag", display: "front", z_index: 50 });

  let settings = DEFAULTS;
  let mode: Mode = DEFAULTS.nag_style;
  let nextStyle: NagStyle = "encounter";
  let sel = 0;
  let showing: ReturnType<typeof setTimeout> | null = null;

  const style = (): NagStyle => (mode === "alternate" ? nextStyle : mode);

  // --- Front: the clock ---------------------------------------------------------------------------------------

  function drawClock(): void {
    const options = {
      timeFormat: settings.time_format,
      showDate: settings.show_date,
      blinkColons: settings.blink_colons,
      icon: CALENDAR,
    };
    void device.draw(clockFace(new Date(), options), { coalesce: "clock" });
  }

  // --- Back: the menu ---------------------------------------------------------------------------------------------

  /** The style the next START will play, in the header between the title and the counter. */
  function drawStyleLabel(): void {
    const text = mode === "alternate" ? `ALT: ${STYLE_NAMES[style()]}` : STYLE_NAMES[style()];
    void device.draw([{ ...label({ id: "style", text, font: "small", display: "back", color: "#8C8C8CFF", box: { x: 56, y: 0, width: 72, height: 9 } }), z_index: 2 }]);
  }

  function showMenu(): void {
    menu.play(BACK, `enter-${sel}`);
    menu.then(`idle-${sel}`, { loop: true });
    drawStyleLabel();
  }

  function select(next: number): void {
    if (next === sel || next < 0 || next >= PRESETS.length) return;
    menu.play(BACK, `go-${sel}-${next}`);
    menu.then(`idle-${next}`, { loop: true });
    sel = next;
  }

  // --- The nag ----------------------------------------------------------------------------------------------------

  function start(): void {
    const s = style();
    const seconds = nag.play(NAGS[s][sel]!);
    menu.play(BACK, `use-${sel}`);
    menu.then(`show-${sel}-${s}`);
    void device.clear(["style"]);
    // The front clip ends on a transparent frame over the clock; remove it just after.
    showing = timers.after(seconds * 1000 + 150, () => finish(true));
  }

  function finish(played: boolean): void {
    timers.cancel(showing ?? undefined);
    showing = null;
    void nag.stop();
    if (played && mode === "alternate") nextStyle = nextStyle === "encounter" ? "ticker" : "encounter";
    showMenu();
  }

  // --- Input ------------------------------------------------------------------------------------------------------

  app.onInput((event: InputEvent) => {
    if (event.key === "encoder") {
      if (!showing) select(sel + (event.delta ?? 0));
      return;
    }
    if (event.action !== "short") return;
    if (event.key === "start" && !showing) start();
    else if (event.key === "ok" && !showing) {
      mode = MODES[(MODES.indexOf(mode) + 1) % MODES.length]!;
      drawStyleLabel();
    } else if (event.key === "back") {
      if (showing) finish(false);
      else app.quit();
    }
  });

  // --- Start ------------------------------------------------------------------------------------------------------

  showMenu();
  drawClock();
  timers.every(1000, drawClock);

  void device.settings().then((values) => {
    if (app.quitting) return;
    settings = readSettings(values, DEFAULTS, {
      nag_style: MODES,
      time_format: ["24h", "12h"],
      show_date: "boolean",
      blink_colons: "boolean",
    });
    mode = settings.nag_style;
    drawClock();
    if (!showing) drawStyleLabel();
  });
}

main();
