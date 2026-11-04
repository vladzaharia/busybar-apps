#!/usr/bin/env node
// pnpm bar: one command for every app in this repository. `pnpm bar help` says what it does; the README has more.
//
//   pnpm bar                          choose, step by step (at a terminal)
//   pnpm bar <action> <app>...        sim, serve, build, install, run, stop, uninstall, ...: whatever scripts the
//                                     apps have (actions.ts)
//   pnpm bar list | new | check | gallery | mac | help

import { intro, log, outro } from "@clack/prompts";
import { parseArgs } from "node:util";
import { join, relative } from "node:path";
import { appsWith, type Action } from "./actions.ts";
import { barAnswers } from "./bar-http.ts";
import { describeDevice, readDotEnv, resolveDevice, type Device } from "./device.ts";
import { runPlan, sh, type Outcome } from "./exec.ts";
import { askApps, askMacSource, askNewApp, askRunAfterInstall, askWhat, isInteractive } from "./interactive.ts";
import { describeInstall, installMac, parseSource, readMacApp } from "./mac.ts";
import {
  UsageError,
  chooseApps,
  classify,
  describeStep,
  makePlan,
  parseCommandLine,
  type AppAction,
  type Command,
  type CommandLine,
} from "./plan.ts";
import { ROOT, findApp, findApps, type App } from "./repo.ts";
import { cyan, dim, helpText, listJson, listText } from "./ui.ts";

async function main(argv: readonly string[]): Promise<number> {
  const apps = findApps();
  // `new` takes new-app.ts's own options (--name, --id, ...), so it parses its own command line.
  if (argv[0] === "new") return newApp(apps, argv.slice(1), false);

  const line = parseCommandLine(argv);
  if (line.options.help) return print(helpText(apps));
  const interactive = isInteractive();
  let target = classify(line.words, apps);
  let asked = false;

  if (target.kind === "action" && !target.action) {
    if (!interactive) return print(target.apps.length > 0 ? listText(target.apps) : helpText(apps));
    intro("BUSY Bar apps");
    const what = await askWhat(apps, target.apps);
    asked = true;
    target = what.kind === "command" ? { kind: "command", command: what.command, words: [] } : { ...target, action: what.name };
  }
  if (target.kind === "command") return command(target.command, target.words, line, apps, asked);

  const name = target.action!;
  const choice = chooseApps(apps, name, target.apps, target.all || line.options.all);
  let picks: AppAction[];
  if (choice.kind === "apps") picks = choice.picks;
  else if (interactive) {
    if (!asked) intro("BUSY Bar apps");
    asked = true;
    picks = await askApps(name, choice.candidates, choice.many);
  } else {
    const slugs = choice.candidates.map((c) => c.app.slug).join(", ");
    throw new UsageError(`Which app${choice.many ? "s" : ""}? Name ${choice.many ? "one or more" : "one"} of: ${slugs}${choice.many ? ", or pass --all" : ""}.`);
  }

  let options = line.options;
  // Asked only on the way through the menu: a command line that says what to do is taken as it is.
  const [only] = picks;
  if (asked && !options.run && only && picks.length === 1 && only.action.script === "app:install" && "app:run" in only.app.scripts) {
    options = { ...options, run: await askRunAfterInstall(only.app) };
  }

  const device = resolveDevice(line.options, process.env, readDotEnv(ROOT));
  const plan = makePlan(picks, options, device, line.extra);
  if (!asked) intro(`pnpm bar ${plan.action.name}`);
  if (plan.action.device) log.info(`Using ${describeDevice(device)}.`);
  if (line.options.password) {
    log.warn("pnpm bar prints its command line, password included: BUSY_BAR_PASSWORD in .env keeps it off the screen.");
  }
  if (asked) log.info(`The same in one go, next time: ${cyan(shortcut(plan.action, picks, apps, options.run))}`);
  if (line.options["dry-run"]) {
    for (const t of plan.tasks) for (const s of t.steps) log.message(`${relative(ROOT, t.app.dir)}: ${describeStep(s)}`);
    outro("Dry run: nothing was run.");
    return 0;
  }
  return summarise(plan.action, await runPlan(plan), options.run, device);
}

/** The command line for what was chosen through the menu, so the menu teaches the shortcut. */
function shortcut(action: Action, picks: readonly AppAction[], apps: readonly App[], run: boolean): string {
  const every = picks.length > 1 && picks.length === appsWith(apps, action.name).length;
  const which = action.scope === "device" ? [] : every ? ["--all"] : picks.map((p) => p.app.slug);
  return ["pnpm bar", action.name, ...which, ...(run ? ["--run"] : [])].join(" ");
}

async function summarise(action: Action, outcomes: readonly Outcome[], launched: boolean, device: Device): Promise<number> {
  const failed = outcomes.filter((o) => o.failed);
  if (outcomes.length > 1) {
    for (const o of outcomes) {
      if (o.failed) log.error(`${o.task.title}: ${o.failed.step.script} failed (exit ${o.failed.code})`);
      else log.success(o.task.title);
    }
  }
  // Only when the bar doesn't answer: one that answered and refused has said why (busy-cli prints it).
  if (failed.some((o) => o.failed!.step.script.startsWith("app:")) && !(await barAnswers(device))) {
    log.warn(
      "Can't reach the bar? Over USB it is 10.0.4.20. Over Wi-Fi, turn on HTTP API access in its web UI and set " +
        "BUSY_BAR_ADDR (and BUSY_BAR_PASSWORD, with password protection) in .env, or pass --addr and --password.",
    );
  }
  const done = outcomes.filter((o) => !o.failed).map((o) => o.task);
  const hints = nextSteps(action, done.map((t) => t.app), launched);
  if (hints) log.info(hints);
  if (failed.length === 0) outro(outcomes.length > 1 ? `${action.name}: all ${outcomes.length} done.` : `${action.name}: done.`);
  else outro(`${action.name}: ${failed.length} of ${outcomes.length} failed.`);
  return failed.length === 0 ? 0 : 1;
}

/** What to do next, after an action worked. */
function nextSteps(action: Action, apps: readonly App[], launched: boolean): string {
  if (apps.length === 0) return "";
  const which = apps.length === 1 ? apps[0]!.slug : "<app>";
  switch (action.script) {
    case "sim":
      return `Open it in a browser: ${cyan(`pnpm bar serve ${which}`)}`;
    case "build":
      return apps.map((a) => relative(ROOT, join(a.dir, "dist", `${a.id}.tgz`))).join("\n");
    case "app:install":
      return launched ? "" : `Launch it: ${cyan(`pnpm bar run ${which}`)} (or install with --run next time)`;
    default:
      return "";
  }
}

async function command(cmd: Command, words: readonly string[], line: CommandLine, apps: readonly App[], asked: boolean): Promise<number> {
  switch (cmd) {
    case "help":
      return print(helpText(apps));
    case "list": {
      const only = words.length > 0 ? words.map((w) => findApp(apps, w) ?? unknownApp(w)) : apps;
      if (asked) {
        log.message(listText(only));
        outro(`Run one: ${cyan("pnpm bar <action> <app>")}`);
        return 0;
      }
      return print(line.options.json ? listJson(only) : listText(only));
    }
    case "new":
      return newApp(apps, words, asked);
    case "check": {
      if (!asked) intro("pnpm bar check");
      for (const script of ["typecheck", "test"]) {
        log.step(script);
        const code = sh("pnpm", [script], ROOT);
        if (code !== 0) {
          outro(`check: ${script} failed.`);
          return code;
        }
      }
      outro("check: typecheck and tests pass.");
      return 0;
    }
    case "gallery": {
      if (!asked) intro("pnpm bar gallery");
      const out = join(ROOT, "dist", "gallery");
      const code = sh("pnpm", ["--silent", "--filter", "@vladzaharia/bar-pixel", "gallery", out], ROOT);
      if (code === 0) outro(`Open ${relative(process.cwd(), join(out, "index.html")) || "index.html"} in a browser.`);
      return code;
    }
    case "mac": {
      if (words.length > 0) throw new UsageError("mac takes no app: pnpm bar mac [--from ci|release|local].");
      const app = readMacApp(ROOT);
      const source = asked && line.options.from === undefined ? await askMacSource(app) : parseSource(line.options.from);
      if (!asked) intro("pnpm bar mac");
      else log.info(`The same in one go, next time: ${cyan(`pnpm bar mac${source === "ci" ? "" : ` --from ${source}`}`)}`);
      if (line.options["dry-run"]) {
        log.message(describeInstall(app, source));
        outro("Dry run: nothing was run.");
        return 0;
      }
      outro(await installMac(ROOT, app, source));
      return 0;
    }
  }
}

const NEW_USAGE =
  'pnpm bar new [<slug>] [--name "Display Name"] [--id app.vlad.my_app] [--description "..."] [--author "..."]\n' +
  "Makes apps/<slug> from the template. Without a slug, at a terminal, it asks.";

async function newApp(apps: readonly App[], argv: readonly string[], asked: boolean): Promise<number> {
  const { values, positionals } = (() => {
    try {
      return parseArgs({
        args: [...argv],
        allowPositionals: true,
        options: {
          name: { type: "string" },
          id: { type: "string" },
          description: { type: "string" },
          author: { type: "string" },
          help: { type: "boolean", short: "h" },
        },
      });
    } catch (e) {
      throw new UsageError((e as Error).message.split(". ")[0] + ".");
    }
  })();
  const { help, ...flags } = values;
  if (help) return print(NEW_USAGE);
  if (positionals.length > 1) throw new UsageError(`new makes one app at a time, not ${positionals.join(", ")}.`);
  let slug = positionals[0];
  if (slug === undefined) {
    if (!isInteractive()) throw new UsageError('new needs a folder name: pnpm bar new my-screen --name "My Screen".');
    if (!asked) intro("New app");
    const answers = await askNewApp(apps);
    slug = answers.slug;
    flags.name ??= answers.name;
  }
  // new-app.ts reads "--name value" pairs only, so it gets the options as parsed here (--name=x included).
  const args = [slug, ...Object.entries(flags).flatMap(([k, v]) => [`--${k}`, v])];
  // new-app.ts says what to do next.
  const code = sh("node", [join(ROOT, "scripts", "new-app.ts"), ...args], ROOT);
  if (asked || positionals.length === 0) outro(code === 0 ? `apps/${slug} is ready.` : "The app wasn't made.");
  return code;
}

function unknownApp(word: string): never {
  throw new UsageError(`"${word}" isn't an app. pnpm bar list shows them.`);
}

function print(text: string): number {
  console.log(text);
  return 0;
}

try {
  process.exitCode = await main(process.argv.slice(2));
} catch (e) {
  if (e instanceof UsageError) {
    console.error(`${e.message}\n${dim("pnpm bar help lists the actions, apps and options.")}`);
    process.exitCode = 2;
  } else {
    console.error((e as Error).message);
    process.exitCode = 1;
  }
}
