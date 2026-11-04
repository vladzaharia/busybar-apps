// What pnpm bar prints about the repository: the help (built from the apps that are there) and the list of apps.

import { styleText } from "node:util";
import { GROUP_TITLES, allActions, appActions, appsWith, type Action, type Group } from "./actions.ts";
import { USB_ADDR } from "./device.ts";
import type { App } from "./repo.ts";

export const bold = (s: string) => styleText("bold", s);
export const dim = (s: string) => styleText("dim", s);
export const cyan = (s: string) => styleText("cyan", s);

const pad = (s: string, n: number) => s + " ".repeat(Math.max(1, n - s.length));

const SCOPE_NOTE: Readonly<Record<Action["scope"], string>> = { each: "", one: "one app", device: "no app needed" };

/** The repository's own commands, for the help and the menu. */
export const REPO_COMMANDS: readonly { name: string; usage: string; summary: string }[] = [
  { name: "list", usage: "list", summary: "The apps, and what each can do" },
  { name: "new", usage: "new <slug>", summary: "Make a new app from the template" },
  { name: "check", usage: "check", summary: "Typecheck and test everything (as CI does)" },
  { name: "gallery", usage: "gallery", summary: "Build the effects gallery (dist/gallery/index.html)" },
  { name: "mac", usage: "mac", summary: "Install Pkmn Life Remote, the Mac app, and open it" },
];

export function helpText(apps: readonly App[]): string {
  const lines: string[] = [];
  const row = (left: string, right: string) => lines.push(`  ${cyan(pad(left, 26))}${right}`);
  lines.push(`${bold("pnpm bar")}: every app in this repository, on the bar and in the simulator`, "");
  row("pnpm bar", "choose what to do, step by step");
  row("pnpm bar <action> <app>", "run an action for one or more apps (--all: every app that has it)");
  row("pnpm bar <app>", "what that app can do");

  const actions = allActions(apps);
  let group: Group | undefined;
  for (const action of actions) {
    if (action.group !== group) {
      group = action.group;
      lines.push("", bold(GROUP_TITLES[group]));
    }
    const having = appsWith(apps, action.name).map((p) => p.app.slug);
    const notes = [SCOPE_NOTE[action.scope], having.length < apps.length ? `only ${having.join(", ")}` : ""].filter(Boolean);
    row(action.name, action.summary + (notes.length ? dim(` (${notes.join("; ")})`) : ""));
  }

  lines.push("", bold("Repository"));
  for (const c of REPO_COMMANDS) row(c.usage, c.summary);

  lines.push("", bold("Apps"));
  if (apps.length === 0) lines.push(`  none yet: ${cyan("pnpm bar new <slug>")} makes one`);
  for (const app of apps) row(app.slug, `${app.name} ${dim(app.version)}`);

  lines.push("", bold("Options"));
  row("--all", "every app that has the action");
  row("--run", "install: launch the app once it is installed");
  row("--no-build", "install: install the package already in dist/, unbuilt");
  row("--port <n>", "serve: the port (default 2879)");
  row("--addr <host>", `the bar's address (default ${USB_ADDR}, over USB; or BUSY_BAR_ADDR in .env)`);
  row("--password <pw>", "its HTTP API password, over Wi-Fi; better as BUSY_BAR_PASSWORD in .env, as pnpm prints the command line");
  row("--from <where>", "mac: ci (CI's newest build of main; the default), release (the latest, notarized), local (build it)");
  row("--dry-run", "say what would run, and run nothing");
  row("--json", "list: as JSON (pnpm -s bar list --json: -s keeps pnpm's own lines out of it)");
  row("-- <args>", "passed on to the app's script");

  const example = apps[0]?.slug ?? "my-app";
  lines.push("", bold("Examples"));
  for (const e of [
    `pnpm bar install ${example} --run`,
    "pnpm bar sim --all",
    `pnpm bar serve ${example}`,
    "pnpm bar install --all --addr 192.168.1.42",
    "pnpm bar mac",
  ]) {
    lines.push(`  ${cyan(e)}`);
  }
  return lines.join("\n");
}

function actionLine(actions: readonly Action[]): string {
  const groups: string[] = [];
  let group: Group | undefined;
  for (const a of actions) {
    if (a.group !== group) groups.push("");
    group = a.group;
    groups[groups.length - 1] += (groups[groups.length - 1] ? " " : "") + a.name;
  }
  return groups.join(dim(" · "));
}

export function listText(apps: readonly App[]): string {
  if (apps.length === 0) return `No apps yet. Make one: ${cyan("pnpm bar new <slug>")}`;
  const width = Math.max(...apps.map((a) => a.slug.length)) + 3;
  return apps
    .map((app) =>
      [
        `${bold(pad(app.slug, width))}${app.name} ${dim(`${app.version}  ${app.id}`)}`,
        app.description ? `${" ".repeat(width)}${dim(app.description)}` : "",
        `${" ".repeat(width)}${actionLine(appActions(app))}`,
      ]
        .filter(Boolean)
        .join("\n"),
    )
    .join("\n\n");
}

export function listJson(apps: readonly App[]): string {
  return JSON.stringify(
    apps.map((app) => ({
      slug: app.slug,
      id: app.id,
      name: app.name,
      version: app.version,
      description: app.description,
      dir: app.dir,
      actions: appActions(app).map(({ name, script, summary, scope, device }) => ({ name, script, summary, scope, device })),
    })),
    null,
    2,
  );
}
