// What you can do with an app: one action per script in its package.json. The scripts this repository's apps share
// (the template's) get a short name, a summary and rules below; any other script an app adds is an action too,
// under its own name, so a new script needs no change here.

import type { App } from "./repo.ts";

/**
 * How many apps an action takes at once.
 * - each:   any number, one after the other (build, sim, install)
 * - one:    exactly one (the bar runs one app at a time; the simulator server takes one port)
 * - device: none: it acts on the bar, whichever app is on it (stop)
 */
export type Scope = "each" | "one" | "device";

export type Group = "bar" | "sim" | "dev" | "other";

export interface Action {
  /** What you type: `pnpm bar <name>`. */
  readonly name: string;
  /** The package.json script it runs. */
  readonly script: string;
  readonly summary: string;
  readonly group: Group;
  readonly scope: Scope;
  /** Talks to the bar, so it takes --addr and --password. */
  readonly device: boolean;
  /** Removes something: runs only for apps named (or picked), never for "the only app that has it". */
  readonly explicit?: boolean;
}

type Known = Omit<Action, "script">;

/** The template's scripts, in the order they are listed. Keyed by script. */
const KNOWN: Readonly<Record<string, Known>> = {
  "app:install": { name: "install", summary: "Build, then install on the bar", group: "bar", scope: "each", device: true },
  "app:run": { name: "run", summary: "Launch on the bar", group: "bar", scope: "one", device: true },
  "app:stop": { name: "stop", summary: "Quit the app running on the bar", group: "bar", scope: "device", device: true },
  "app:uninstall": {
    name: "uninstall",
    summary: "Remove from the bar (its settings stay)",
    group: "bar",
    scope: "each",
    device: true,
    explicit: true,
  },
  sim: { name: "sim", summary: "Build the simulator page (dist/sim/index.html)", group: "sim", scope: "each", device: false },
  "sim:serve": {
    name: "serve",
    summary: "Open in the simulator, served with the bar's HTTP API",
    group: "sim",
    scope: "one",
    device: false,
  },
  build: { name: "build", summary: "Build the package for the bar (dist/<id>.tgz)", group: "dev", scope: "each", device: false },
  assets: { name: "assets", summary: "Render the animations and images", group: "dev", scope: "each", device: false },
  typecheck: { name: "typecheck", summary: "Typecheck", group: "dev", scope: "each", device: false },
  test: { name: "test", summary: "Run the tests", group: "dev", scope: "each", device: false },
};

const KNOWN_ORDER = Object.keys(KNOWN);
const GROUP_ORDER: readonly Group[] = ["bar", "sim", "dev", "other"];

export const GROUP_TITLES: Readonly<Record<Group, string>> = {
  bar: "On the bar",
  sim: "In the simulator",
  dev: "Development",
  other: "The app's own scripts",
};

/** npm lifecycle hooks: they run around other scripts, never on their own. */
const LIFECYCLE = new Set(["prepare", "prepublishOnly", "prepack", "postpack", "preinstall", "install", "postinstall"]);

function isHook(script: string, scripts: Readonly<Record<string, string>>): boolean {
  if (LIFECYCLE.has(script)) return true;
  const m = /^(pre|post)(.+)$/.exec(script);
  return m !== null && m[2]! in scripts;
}

/** The action a script is: a known one, or the script under its own name (an `app:` prefix dropped). */
export function actionForScript(script: string, command = ""): Action {
  const known = KNOWN[script];
  if (known) return { ...known, script };
  const device = script.startsWith("app:");
  const name = device ? script.slice("app:".length) : script;
  return { name, script, summary: command ? `Runs: ${command}` : "", group: "other", scope: "each", device };
}

function order(a: Action, b: Action): number {
  const g = GROUP_ORDER.indexOf(a.group) - GROUP_ORDER.indexOf(b.group);
  if (g !== 0) return g;
  const ka = KNOWN_ORDER.indexOf(a.script);
  const kb = KNOWN_ORDER.indexOf(b.script);
  if (ka >= 0 && kb >= 0) return ka - kb;
  return a.name.localeCompare(b.name);
}

/** An app's actions, in display order. Where two scripts would share a name, the known one wins. */
export function appActions(app: App): Action[] {
  const byName = new Map<string, Action>();
  for (const [script, command] of Object.entries(app.scripts)) {
    if (isHook(script, app.scripts)) continue;
    const action = actionForScript(script, command);
    const held = byName.get(action.name);
    if (held && held.script in KNOWN) continue;
    byName.set(action.name, action);
  }
  return [...byName.values()].sort(order);
}

/** Every action any app has, once each, in display order. */
export function allActions(apps: readonly App[]): Action[] {
  const byName = new Map<string, Action>();
  for (const app of apps) {
    for (const action of appActions(app)) if (!byName.has(action.name)) byName.set(action.name, action);
  }
  return [...byName.values()].sort(order);
}

/** The apps that have an action, and that app's version of it (the script may differ). */
export function appsWith(apps: readonly App[], name: string): { app: App; action: Action }[] {
  const out: { app: App; action: Action }[] = [];
  for (const app of apps) {
    const action = appActions(app).find((a) => a.name === name);
    if (action) out.push({ app, action });
  }
  return out;
}
