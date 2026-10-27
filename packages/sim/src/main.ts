// Simulator entry: reads the app embedded in the page, wires the emulated device, the host and the controls, and
// runs the paint loop.

import { Device } from "./device.ts";
import { AppHost, type AppFn } from "./host.ts";
import { Buttons, LedPainter, OledPainter, bindButton, bindKeyboard, bindWheel, logger, settingsForm, showState, type SettingField } from "./ui.ts";

interface SimConfig {
  id: string;
  name: string;
  /** URL of the packed package files: { "animations/x.anim": base64, ... }. */
  pack: string;
  settings: { fields: Record<string, SettingField> } | null;
}

declare global {
  interface Window {
    __SIM__: SimConfig;
    __barApp: AppFn;
  }
}

function start(): void {
  const cfg = window.__SIM__;
  const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
  const log = logger($("log"));

  // Settings: defaults from settings.json, overridden by what was chosen here before.
  const storeKey = `bar-sim:${cfg.id}:settings`;
  const values: Record<string, unknown> = {};
  for (const [id, f] of Object.entries(cfg.settings?.fields ?? {})) values[id] = f.default;
  try {
    Object.assign(values, JSON.parse(localStorage.getItem(storeKey) ?? "{}"));
  } catch {
    /* storage unavailable: defaults it is */
  }

  let packed: Promise<Record<string, string>> | undefined;
  const device = new Device({
    asset: async (path) => {
      const files = await (packed ??= fetch(cfg.pack).then((r) => {
        if (!r.ok) throw new Error(`${cfg.pack}: HTTP ${r.status}`);
        return r.json() as Promise<Record<string, string>>;
      }));
      const b64 = files[path];
      if (b64 === undefined) throw new Error(`${path} is not in the app's package`);
      return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
    },
    decodePng: async (bytes) => {
      const bmp = await createImageBitmap(new Blob([bytes as BlobPart], { type: "image/png" }));
      const c = document.createElement("canvas");
      c.width = bmp.width;
      c.height = bmp.height;
      const ctx = c.getContext("2d")!;
      ctx.drawImage(bmp, 0, 0);
      return { width: bmp.width, height: bmp.height, data: ctx.getImageData(0, 0, bmp.width, bmp.height).data };
    },
    settings: () => ({ ...values }),
    log,
  });

  const host = new AppHost({
    device,
    app: window.__barApp,
    log,
    onState: (s, why) => showState($("state"), $("state-note"), s, why),
  });

  const buttons = new Buttons(host, () => {
    log("BACK held: the firmware force-quits the app");
    host.stop("Force-quit with a long press of BACK, as on the bar.");
  });
  bindButton($("btn-start"), "start", buttons);
  bindButton($("btn-back"), "back", buttons);
  bindButton($("pad-ok"), "ok", buttons);
  bindButton($("pad-start"), "start", buttons);
  bindButton($("pad-back"), "back", buttons);
  const wheel = $("wheel");
  bindWheel(wheel, buttons);
  $("pad-left").addEventListener("click", () => buttons.turn(-1));
  $("pad-right").addEventListener("click", () => buttons.turn(1));
  bindKeyboard(buttons, wheel);
  $("restart").addEventListener("click", () => host.start());

  if (cfg.settings) {
    settingsForm($("settings"), cfg.settings.fields, values, () => {
      try {
        localStorage.setItem(storeKey, JSON.stringify(values));
      } catch {
        /* not saved, still applied */
      }
      log("settings changed: restarting the app so it reads them");
      host.start();
    });
  }

  const led = new LedPainter($("led"));
  const oled = new OledPainter($("oled"));
  let last: number | null = null;
  const frame = (now: number) => {
    const dt = last === null ? 0 : Math.min(0.1, (now - last) / 1000);
    last = now;
    device.tick(dt);
    led.paint(device.screens.front);
    oled.paint(device.screens.back, device.screens.front, host.state === "running" && !device.hasBack());
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
  host.start();

  // For automated tests: drive the device without the mouse.
  (window as unknown as { barSim: unknown }).barSim = { host, device, buttons };
}

start();
