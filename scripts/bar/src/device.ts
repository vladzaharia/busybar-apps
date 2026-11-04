// Which bar to talk to. busy-cli takes --addr and --password on every call; here they can also live in the
// environment or in the repository's .env (git-ignored), so a bar on Wi-Fi is set up once:
//
//   BUSY_BAR_ADDR=192.168.1.42
//   BUSY_BAR_PASSWORD=...
//
// A flag wins over the environment, which wins over .env. With none, busy-cli uses the bar on USB (10.0.4.20).

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { parseEnv } from "node:util";

export const USB_ADDR = "10.0.4.20";

export interface Device {
  readonly addr?: string;
  readonly password?: string;
  /** Where the address came from, to say so. */
  readonly source: "flag" | "env" | ".env" | "usb";
}

export function readDotEnv(root: string): Record<string, string | undefined> {
  const path = join(root, ".env");
  return existsSync(path) ? parseEnv(readFileSync(path, "utf8")) : {};
}

export function resolveDevice(
  flags: { addr?: string; password?: string },
  env: Readonly<Record<string, string | undefined>>,
  dotEnv: Readonly<Record<string, string | undefined>>,
): Device {
  const pick = (flag: string | undefined, key: string) => flag || env[key] || dotEnv[key] || undefined;
  const addr = pick(flags.addr, "BUSY_BAR_ADDR");
  const password = pick(flags.password, "BUSY_BAR_PASSWORD");
  const source = flags.addr ? "flag" : env.BUSY_BAR_ADDR ? "env" : dotEnv.BUSY_BAR_ADDR ? ".env" : "usb";
  return { addr, password, source };
}

/** The arguments busy-cli takes for this bar. */
export function deviceArgs(device: Device): string[] {
  const args: string[] = [];
  if (device.addr) args.push("--addr", device.addr);
  if (device.password) args.push("--password", device.password);
  return args;
}

/** One line on which bar this is, without the password. */
export function describeDevice(device: Device): string {
  if (!device.addr) return `the bar on USB (${USB_ADDR})`;
  const from = device.source === "flag" ? "" : device.source === "env" ? " (from BUSY_BAR_ADDR)" : " (from .env)";
  return `the bar at ${device.addr}${from}${device.password ? ", with its password" : ""}`;
}
