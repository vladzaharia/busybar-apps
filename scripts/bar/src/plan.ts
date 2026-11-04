// From a command line to what to run: which action, for which apps, as which scripts with which arguments. No I/O
// here, so all of it is tested (test/plan.test.ts); main.ts asks for anything missing and runs the result.

import { parseArgs } from "node:util";
import { allActions, appsWith, type Action } from "./actions.ts";
import { deviceArgs, type Device } from "./device.ts";
import { findApp, type App } from "./repo.ts";

/** A mistake on the command line: printed with a hint, exit code 2. */
export class UsageError extends Error {}

/** Commands about the repository rather than an app. They take precedence over an app script of the same name. */
export const COMMANDS = ["help", "list", "new", "check", "gallery", "mac"] as const;
export type Command = (typeof COMMANDS)[number];

export interface Options {
  readonly all: boolean;
  readonly run: boolean;
  readonly build: boolean;
  readonly json: boolean;
  readonly help: boolean;
  /** Say what would run, and run nothing. */
  readonly "dry-run": boolean;
  readonly addr?: string;
  readonly password?: string;
  readonly port?: string;
  /** mac: where the Mac app comes from (mac.ts). */
  readonly from?: string;
}

export interface CommandLine {
  readonly words: string[];
  readonly options: Options;
  /** Everything after `--`, handed on to the app's script. */
  readonly extra: string[];
}

export function parseCommandLine(argv: readonly string[]): CommandLine {
  const cut = argv.indexOf("--");
  const own = cut >= 0 ? argv.slice(0, cut) : [...argv];
  const extra = cut >= 0 ? argv.slice(cut + 1) : [];
  try {
    const { values, positionals } = parseArgs({
      args: own,
      allowPositionals: true,
      allowNegative: true,
      strict: true,
      options: {
        all: { type: "boolean", default: false },
        run: { type: "boolean", default: false },
        build: { type: "boolean", default: true },
        json: { type: "boolean", default: false },
        help: { type: "boolean", short: "h", default: false },
        "dry-run": { type: "boolean", default: false },
        addr: { type: "string" },
        password: { type: "string" },
        port: { type: "string" },
        from: { type: "string" },
      },
    });
    return { words: positionals, options: values as Options, extra };
  } catch (e) {
    // parseArgs says what was wrong and how to pass it on; keep the first sentence.
    throw new UsageError((e as Error).message.split(". ")[0]!.replace(/\.$/, "") + ".");
  }
}

export type Target =
  | { readonly kind: "command"; readonly command: Command; readonly words: string[] }
  | { readonly kind: "action"; readonly action?: string; readonly apps: App[]; readonly all: boolean };

/** Sorts the words of a command line into a command, or an action and the apps it is for (in any order). */
export function classify(words: readonly string[], apps: readonly App[]): Target {
  const first = words[0];
  if (first && (COMMANDS as readonly string[]).includes(first)) {
    return { kind: "command", command: first as Command, words: words.slice(1) };
  }
  const actionNames = new Set(allActions(apps).map((a) => a.name));
  let action: string | undefined;
  const picked: App[] = [];
  let all = false;
  for (const word of words) {
    const app = findApp(apps, word);
    if (!action && actionNames.has(word)) action = word;
    else if (app) picked.includes(app) || picked.push(app);
    else if (word === "all") all = true;
    else if (actionNames.has(word)) throw new UsageError(`One action at a time: "${action}" and "${word}" were both given.`);
    else if ((COMMANDS as readonly string[]).includes(word)) throw new UsageError(`"${word}" goes first: pnpm bar ${word} ...`);
    else throw new UsageError(unknownWord(word, [...actionNames, ...apps.map((a) => a.slug), ...COMMANDS]));
  }
  return { kind: "action", action, apps: picked, all };
}

function unknownWord(word: string, known: readonly string[]): string {
  const near = known
    .map((k) => ({ k, d: distance(word, k) }))
    .filter(({ k, d }) => d <= Math.max(1, Math.floor(k.length / 3)))
    .sort((a, b) => a.d - b.d)[0];
  return `"${word}" isn't an app, an action or a command.${near ? ` Did you mean "${near.k}"?` : ""}`;
}

/** Edit distance, for "did you mean", counting two swapped letters ("alhpa") as one edit. */
function distance(a: string, b: string): number {
  const d = Array.from({ length: a.length + 1 }, (_, i) => Array.from({ length: b.length + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0)));
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      let best = Math.min(d[i - 1]![j]! + 1, d[i]![j - 1]! + 1, d[i - 1]![j - 1]! + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) best = Math.min(best, d[i - 2]![j - 2]! + 1);
      d[i]![j] = best;
    }
  }
  return d[a.length]![b.length]!;
}

export interface AppAction {
  readonly app: App;
  readonly action: Action;
}

export type Choice =
  /** Run for these. */
  | { readonly kind: "apps"; readonly picks: AppAction[] }
  /** More than one app could be meant: ask (at a terminal), or say to name them. */
  | { readonly kind: "ask"; readonly candidates: AppAction[]; readonly many: boolean };

/** Which apps an action runs for, from the apps named (or `all`), checking each one has it. */
export function chooseApps(apps: readonly App[], name: string, named: readonly App[], all: boolean): Choice {
  const candidates = appsWith(apps, name);
  const scope = candidates[0]?.action.scope;
  if (!scope) throw new UsageError(`No app has a "${name}" action.`);
  const list = (picks: readonly AppAction[]) => picks.map((p) => p.app.slug).join(", ");

  if (scope === "device") return { kind: "apps", picks: candidates.slice(0, 1) };

  let picks: AppAction[];
  if (all) picks = candidates;
  else if (named.length > 0) {
    picks = named.map((app) => {
      const found = candidates.find((c) => c.app === app);
      if (!found) throw new UsageError(`${app.slug} has no "${name}" action. These apps do: ${list(candidates)}.`);
      return found;
    });
  } else if (candidates.length === 1 && !candidates[0]!.action.explicit) picks = candidates;
  else return { kind: "ask", candidates, many: scope === "each" };

  if (scope === "one" && picks.length > 1) {
    throw new UsageError(`"${name}" takes one app at a time: name one of ${list(picks)}.`);
  }
  return { kind: "apps", picks };
}

export interface Step {
  /** The package.json script it runs; for a step of pnpm bar's own, its name. */
  readonly script: string;
  readonly args: readonly string[];
  /** Not a script: pnpm bar quits the app running on the bar itself (bar-http.ts), so an install can replace it. */
  readonly own?: "quit";
}

/** Before an install: the bar can't replace an app while it runs (bar-http.ts, quitRunningApp). */
const QUIT: Step = { script: "quit", args: [], own: "quit" };

export interface Task {
  /** What the task is for: an app's slug, or "the bar" for an action on whatever app is on it. */
  readonly title: string;
  readonly app: App;
  /** Run in order; a failure skips the rest of this task, not the other tasks. */
  readonly steps: readonly Step[];
}

export interface Plan {
  readonly action: Action;
  readonly tasks: readonly Task[];
  /** The bar the steps talk to, for pnpm bar's own steps. */
  readonly device: Device;
}

export function makePlan(
  picks: readonly AppAction[],
  options: Pick<Options, "build" | "run" | "port" | "from">,
  device: Device,
  extra: readonly string[] = [],
): Plan {
  const action = picks[0]?.action;
  if (!action) throw new UsageError("Nothing to run.");
  // An action is a name: two apps' scripts behind it could follow different rules. Each task uses its own script's.
  const mixed = picks.find((p) => p.action.scope !== action.scope || p.action.device !== action.device);
  if (mixed) {
    throw new UsageError(
      `"${action.name}" is ${picks[0]!.app.slug}'s ${action.script} but ${mixed.app.slug}'s ${mixed.action.script}: run them one at a time.`,
    );
  }
  const installing = action.script === "app:install";
  if (options.run && !installing) throw new UsageError("--run goes with install: pnpm bar install <app> --run.");
  if (!options.build && !installing) throw new UsageError("--no-build goes with install.");
  if (options.port !== undefined && action.script !== "sim:serve") throw new UsageError("--port goes with serve.");
  if (options.from !== undefined) throw new UsageError("--from goes with mac: pnpm bar mac --from release.");
  if (options.run && picks.length > 1) {
    throw new UsageError("--run launches one app (the bar runs one at a time): install them, then pnpm bar run <app>.");
  }

  const tasks = picks.map(({ app, action: own }): Task => {
    const bar = own.device ? deviceArgs(device) : [];
    const steps: Step[] = [];
    // busy-cli installs what is in dist/ and builds nothing itself: an install without a build ships a stale package.
    if (installing && options.build && "build" in app.scripts) steps.push({ script: "build", args: [] });
    // After the build, so the bar shows the running app until the new one is ready to go on.
    if (installing) steps.push(QUIT);
    const port = own.script === "sim:serve" && options.port !== undefined ? ["--port", options.port] : [];
    steps.push({ script: own.script, args: [...bar, ...port, ...extra] });
    if (options.run) {
      if (!("app:run" in app.scripts)) throw new UsageError(`${app.slug} has no "run" action.`);
      steps.push({ script: "app:run", args: deviceArgs(device) });
    }
    return { title: action.scope === "device" ? "the bar" : app.slug, app, steps };
  });
  return { action, tasks, device };
}

/** A step as it would be typed, with any password hidden: for logs. */
export function describeStep(step: Step): string {
  if (step.own === "quit") return "quit the app running on the bar";
  const args = step.args.map((a, i) => (step.args[i - 1] === "--password" ? "***" : a));
  return ["pnpm", "run", step.script, ...args].join(" ");
}
