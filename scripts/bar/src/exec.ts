// Running a plan: each step is the app's own package.json script, run in the app's folder, its output shown as it
// comes. A failed step ends its app's task; the other apps still run, and the summary says which failed.

import { log } from "@clack/prompts";
import { spawnSync } from "node:child_process";
import { quitRunningApp } from "./bar-http.ts";
import type { Device } from "./device.ts";
import type { Plan, Step, Task } from "./plan.ts";

export interface Outcome {
  readonly task: Task;
  /** The step that failed, and how; none when every step passed. */
  readonly failed?: { readonly step: Step; readonly code: number };
}

/**
 * Runs a command with the terminal, returning its exit code. Ctrl+C reaches the child and this process alike; when
 * the child dies of it, so does the whole run, instead of carrying on with the next app.
 */
export function sh(command: string, args: readonly string[], cwd: string): number {
  const r = spawnSync(command, args, { cwd, stdio: "inherit" });
  if (r.error) throw r.error;
  if (r.signal === "SIGINT" || r.signal === "SIGTERM") process.exit(130);
  return r.status ?? 1;
}

/**
 * `pnpm --silent run`: pnpm otherwise echoes the script's command line, arguments and all, and one of them can be
 * the bar's password.
 */
export function runScript(step: Step, cwd: string): number {
  return sh("pnpm", ["--silent", "run", step.script, ...step.args], cwd);
}

/** Quits whatever app is running, so the install can replace its files; never fails the install by itself. */
async function quitFirst(device: Device): Promise<void> {
  const quit = await quitRunningApp(device);
  if (quit.kind === "quit") log.step("Quit the app running on the bar, so the install can replace it");
  else if (quit.kind === "failed") log.warn(`Couldn't quit the app running on the bar (${quit.reason}); installing anyway.`);
}

export async function runPlan(plan: Plan): Promise<Outcome[]> {
  const outcomes: Outcome[] = [];
  for (const task of plan.tasks) {
    let failed: Outcome["failed"];
    for (const step of task.steps) {
      if (step.own === "quit") {
        await quitFirst(plan.device);
        continue;
      }
      log.step(`${task.title}: ${step.script === plan.action.script ? plan.action.name : step.script}`);
      const code = runScript(step, task.app.dir);
      if (code !== 0) {
        failed = { step, code };
        break;
      }
    }
    outcomes.push({ task, failed });
  }
  return outcomes;
}
