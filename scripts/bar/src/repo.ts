// What the repository holds, read fresh on every run: each app under apps/, its manifest, and its package.json
// scripts. Nothing here is a list to keep up to date: a new app (pnpm bar new) shows up as soon as its folder exists.

import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

/** The repository's root, which holds scripts/bar/src. */
export const ROOT = fileURLToPath(new URL("../../..", import.meta.url));

export interface App {
  /** The folder under apps/, which is also what you type: `pnpm bar sim pkmn-life`. */
  readonly slug: string;
  readonly dir: string;
  /** The manifest id, the package's folder on the bar. Accepted wherever a slug is. */
  readonly id: string;
  readonly name: string;
  readonly version: string;
  readonly description: string;
  /** The app's package.json scripts: the actions it supports (see actions.ts). */
  readonly scripts: Readonly<Record<string, string>>;
}

interface PackageJson {
  scripts?: Record<string, string>;
}

interface Manifest {
  id?: string;
  name?: string;
  version?: string;
  description?: string;
}

function readJson<T>(path: string): T | null {
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, "utf8")) as T;
  } catch (e) {
    throw new Error(`${path} isn't valid JSON: ${(e as Error).message}`);
  }
}

/**
 * The apps under `<root>/apps`, by slug. An app is a folder with a package.json and a busy-cli manifest
 * (src/appmeta/manifest.json), the same test the release build uses; anything else there is skipped.
 */
export function findApps(root: string = ROOT): App[] {
  const appsDir = join(root, "apps");
  if (!existsSync(appsDir)) return [];
  const apps: App[] = [];
  for (const entry of readdirSync(appsDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const dir = join(appsDir, entry.name);
    const pkg = readJson<PackageJson>(join(dir, "package.json"));
    const manifest = readJson<Manifest>(join(dir, "src", "appmeta", "manifest.json"));
    if (!pkg || !manifest) continue;
    apps.push({
      slug: entry.name,
      dir,
      id: manifest.id ?? entry.name,
      name: manifest.name ?? entry.name,
      version: manifest.version ?? "",
      description: manifest.description ?? "",
      scripts: pkg.scripts ?? {},
    });
  }
  return apps.sort((a, b) => a.slug.localeCompare(b.slug));
}

/** The app a word names, by slug or by manifest id. */
export function findApp(apps: readonly App[], word: string): App | undefined {
  return apps.find((a) => a.slug === word || a.id === word);
}
