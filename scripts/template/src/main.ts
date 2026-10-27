// {{NAME}}: the stock-style clock on the front; START plays the "hello" scene over it; OK shows a toast on the
// back; BACK leaves. A starting point: replace the scene in assets/build.ts and the handlers below.

import { AnimPlayer, clockFace, createApp, label, readSettings, toast } from "@vladzaharia/bar-core";
import manifest from "./appmeta/manifest.json";
import { CALENDAR, HELLO } from "./generated/clips.ts";

const DEFAULTS = { time_format: "24h" as "24h" | "12h", show_date: true, blink_colons: true };

/** Entry point, called at the end of the file: the device runs this script top to bottom and starts nothing itself. */
function main(): void {
  const app = createApp({ app: manifest.id, priority: 50 });
  const { device, timers } = app;
  const scene = new AnimPlayer(device, { id: "scene", display: "front", z_index: 50 });
  let settings = DEFAULTS;
  let playing: ReturnType<typeof setTimeout> | null = null;

  const drawClock = () =>
    void device.draw(
      clockFace(new Date(), { timeFormat: settings.time_format, showDate: settings.show_date, blinkColons: settings.blink_colons, icon: CALENDAR }),
      { coalesce: "clock" },
    );

  void device.draw([
    label({ id: "title", text: manifest.name.toUpperCase(), font: "large", display: "back", box: { x: 0, y: 18, width: 148, height: 14 } }),
    label({ id: "hint", text: "START: hello   OK: toast", font: "small", display: "back", color: "#8C8C8CFF", box: { x: 0, y: 44, width: 148, height: 10 } }),
  ]);
  drawClock();
  timers.every(1000, drawClock);

  app.onInput((event) => {
    if (event.action !== "short") return;
    if (event.key === "start" && !playing) {
      const seconds = scene.play(HELLO);
      playing = timers.after(seconds * 1000 + 150, () => {
        playing = null;
        void scene.stop();
      });
    } else if (event.key === "ok") {
      void device.draw(toast({ id: "toast", text: "Hello from the back!", seconds: 2 }));
    } else if (event.key === "back") {
      app.quit();
    }
  });

  void device.settings().then((values) => {
    settings = readSettings(values, DEFAULTS, { time_format: ["24h", "12h"], show_date: "boolean", blink_colons: "boolean" });
    drawClock();
  });
}

main();
