// App lifecycle. A JavaScript app lives exactly as long as something keeps it alive: an input listener, a timer,
// or a fetch in flight. `createApp` bundles the device client, the timers and the input listener, and `quit()`
// releases them in a safe order: stop the timers, clear the screen, wait for the device to answer, then detach
// input on the next tick (detaching from inside the input handler itself would end the app mid-callback).

import { Device, type DeviceOptions } from "./device.ts";
import { Timers } from "./timers.ts";
import type { InputEvent } from "./types.ts";

export interface App {
  readonly id: string;
  readonly device: Device;
  readonly timers: Timers;
  /** Replaces the input handler. */
  onInput(handler: (event: InputEvent) => void): void;
  /** Leaves the app: timers stop, the app's elements are cleared, input is released. Safe to call twice. */
  quit(): void;
  readonly quitting: boolean;
}

export function createApp(options: DeviceOptions & { onQuit?: () => void }): App {
  const device = new Device(options);
  const timers = new Timers();
  let handler: ((event: InputEvent) => void) | null = null;
  let quitting = false;

  // One listener for the app's whole life; the handler behind it can change.
  const unbind = listen("input", (event) => {
    if (quitting || !handler) return;
    try {
      handler(event);
    } catch (e) {
      console.error(`${options.app}: ${e instanceof Error ? e.message : String(e)}`);
    }
  });

  return {
    id: options.app,
    device,
    timers,
    get quitting() {
      return quitting;
    },
    onInput(h) {
      handler = h;
    },
    quit() {
      if (quitting) return;
      quitting = true;
      timers.clearAll();
      options.onQuit?.();
      void device
        .clear()
        .then(() => device.settled())
        .then(() => setTimeout(unbind, 0));
    },
  };
}
