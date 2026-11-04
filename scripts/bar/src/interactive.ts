// The questions pnpm bar asks at a terminal, for whatever the command line left out. Never asked when stdin or stdout
// isn't a terminal (CI, scripts, agents): there a missing app is an error that says what to type.

import { cancel, confirm, isCancel, multiselect, select, text } from "@clack/prompts";
import { allActions, appActions } from "./actions.ts";
import { SOURCES, SOURCE_SUMMARIES, type MacApp, type Source } from "./mac.ts";
import type { AppAction, Command } from "./plan.ts";
import type { App } from "./repo.ts";
import { REPO_COMMANDS } from "./ui.ts";

export function isInteractive(): boolean {
  return Boolean(process.stdin.isTTY && process.stdout.isTTY && !process.env.CI);
}

/** A prompt's answer; Esc or Ctrl+C at a prompt ends the run, having done nothing. */
function answer<T>(value: T): Exclude<T, symbol> {
  if (isCancel(value)) {
    cancel("Nothing done.");
    process.exit(0);
  }
  return value as Exclude<T, symbol>;
}

export type What = { readonly kind: "action"; readonly name: string } | { readonly kind: "command"; readonly command: Command };

/** What to do: an action (of `only`, when apps were named) or one of the repository's commands. */
export async function askWhat(apps: readonly App[], only: readonly App[]): Promise<What> {
  const actions = only.length === 1 ? appActions(only[0]!) : allActions(only.length > 0 ? only : apps);
  const options = [
    ...actions.map((a) => ({ value: `action:${a.name}`, label: a.name, hint: a.summary })),
    ...(only.length > 0 ? [] : REPO_COMMANDS.map((c) => ({ value: `command:${c.name}`, label: c.name, hint: c.summary }))),
  ];
  const value = answer(
    await select({
      message: only.length === 1 ? `What should ${only[0]!.name} do?` : "What do you want to do?",
      options,
      maxItems: 14,
    }),
  );
  const [kind, name] = value.split(/:(.*)/) as ["action" | "command", string];
  return kind === "action" ? { kind, name } : { kind, command: name as Command };
}

/** Which apps to run an action for: several at once where the action allows it. */
export async function askApps(action: string, candidates: readonly AppAction[], many: boolean): Promise<AppAction[]> {
  const options = candidates.map((c, i) => ({ value: i, label: c.app.slug, hint: c.app.name }));
  if (many) {
    const picked = answer(
      await multiselect({ message: `${action}: which apps?`, options, required: true }),
    );
    return picked.map((i) => candidates[i]!);
  }
  return [candidates[answer(await select({ message: `${action}: which app?`, options }))]!];
}

export async function askRunAfterInstall(app: App): Promise<boolean> {
  return answer(await confirm({ message: `Launch ${app.name} on the bar once it is installed?`, initialValue: true }));
}

export async function askMacSource(app: MacApp): Promise<Source> {
  const options = SOURCES.map((s) => ({ value: s, label: s, hint: SOURCE_SUMMARIES[s] }));
  return answer(await select<Source>({ message: `Which ${app.name}?`, options, initialValue: "ci" }));
}

/** The same rules scripts/new-app.ts enforces, asked up front so a typo is caught at the prompt. */
const SLUG = /^[a-z][a-z0-9-]*$/;

export async function askNewApp(apps: readonly App[]): Promise<{ slug: string; name: string }> {
  const slug = answer(
    await text({
      message: "Folder name for the new app (apps/<slug>)",
      placeholder: "my-screen",
      validate: (v) =>
        !v || !SLUG.test(v)
          ? "Lowercase letters, digits and hyphens, starting with a letter."
          : apps.some((a) => a.slug === v)
            ? `apps/${v} already exists.`
            : undefined,
    }),
  );
  const suggested = slug.replace(/(^|-)(\w)/g, (_, s: string, c: string) => (s ? " " : "") + c.toUpperCase());
  const name = answer(
    await text({
      message: "Its name, as the bar shows it",
      placeholder: suggested,
      defaultValue: suggested,
      validate: (v) => (v && !/^[\x20-\x7e]+$/.test(v) ? "Printable ASCII only: the bar's fonts have nothing else." : undefined),
    }),
  );
  return { slug, name };
}
