// The few requests pnpm bar makes to the bar itself, around busy-cli's: quitting the running app before an install,
// and checking whether the bar answers at all. Same address and password as busy-cli's (`X-API-Token`).

import { USB_ADDR, type Device } from "./device.ts";

const TIMEOUT_MS = 3000;

/** The bar's HTTP API, as busy-cli addresses it: http:// unless the address names a scheme. */
export function barUrl(device: Device): string {
  const addr = device.addr ?? USB_ADDR;
  return new URL(/^https?:\/\//.test(addr) ? addr : `http://${addr}`).origin;
}

async function call(device: Device, method: string, path: string): Promise<Response> {
  return fetch(`${barUrl(device)}${path}`, {
    method,
    headers: device.password ? { "X-API-Token": device.password } : {},
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
}

export type QuitResult =
  | { readonly kind: "quit" }
  | { readonly kind: "none" }
  /** No answer: the install that follows says so, in busy-cli's words. */
  | { readonly kind: "unreachable" }
  | { readonly kind: "failed"; readonly reason: string };

/**
 * Quits the app running on the bar, whichever it is (the bar can't say which). The bar can't replace an app while it
 * runs: deleting the old copy stops at its first open file (an animation that's playing), and the install answers
 * 400, having deleted part of it. The firmware's uninstall quits the app first; its install doesn't.
 */
export async function quitRunningApp(device: Device): Promise<QuitResult> {
  try {
    const res = await call(device, "POST", "/api/apps/quit");
    if (res.ok) return { kind: "quit" };
    // 409: nothing was running.
    if (res.status === 409) return { kind: "none" };
    return { kind: "failed", reason: `the bar answered ${res.status}` };
  } catch {
    return { kind: "unreachable" };
  }
}

/** Whether the bar answers HTTP at all: any answer, even a refusal, means it's there. */
export async function barAnswers(device: Device): Promise<boolean> {
  try {
    await call(device, "GET", "/api/version");
    return true;
  } catch {
    return false;
  }
}
