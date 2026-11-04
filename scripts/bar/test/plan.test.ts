import assert from "node:assert/strict";
import { test } from "node:test";
import { resolveDevice } from "../src/device.ts";
import { UsageError, chooseApps, classify, describeStep, makePlan, parseCommandLine, type AppAction } from "../src/plan.ts";
import { findApps } from "../src/repo.ts";
import { fixture } from "./fixture.ts";

const apps = findApps(fixture());
const [alpha, beta] = apps as [(typeof apps)[0], (typeof apps)[0]];
const usb = resolveDevice({}, {}, {});
const wifi = resolveDevice({ addr: "192.168.1.42", password: "pw" }, {}, {});
const defaults = { build: true, run: false, port: undefined };

function picks(name: string, ...slugs: string[]): AppAction[] {
  const choice = chooseApps(apps, name, slugs.map((s) => apps.find((a) => a.slug === s)!), false);
  assert.equal(choice.kind, "apps");
  return choice.kind === "apps" ? choice.picks : [];
}

const steps = (plan: ReturnType<typeof makePlan>) => plan.tasks.map((t) => [t.title, t.steps.map(describeStep)]);

test("parseCommandLine: words, options, and what follows -- for the script", () => {
  const line = parseCommandLine(["install", "alpha", "--run", "--addr", "bar.local", "--", "--verbose"]);
  assert.deepEqual(line.words, ["install", "alpha"]);
  assert.equal(line.options.run, true);
  assert.equal(line.options.build, true);
  assert.equal(line.options.addr, "bar.local");
  assert.deepEqual(line.extra, ["--verbose"]);
  assert.equal(parseCommandLine(["install", "--no-build"]).options.build, false);
});

test("parseCommandLine: an unknown option is a usage error", () => {
  assert.throws(() => parseCommandLine(["sim", "--fast"]), UsageError);
});

test("classify: an action and apps, in either order; ids work as slugs", () => {
  assert.deepEqual(classify(["sim", "alpha", "beta"], apps), { kind: "action", action: "sim", apps: [alpha, beta], all: false });
  assert.deepEqual(classify(["alpha", "install"], apps), { kind: "action", action: "install", apps: [alpha], all: false });
  assert.deepEqual(classify(["app.test.beta"], apps), { kind: "action", action: undefined, apps: [beta], all: false });
  assert.deepEqual(classify(["sim", "all"], apps), { kind: "action", action: "sim", apps: [], all: true });
  assert.deepEqual(classify([], apps), { kind: "action", action: undefined, apps: [], all: false });
});

test("classify: the repository's commands", () => {
  assert.deepEqual(classify(["list", "alpha"], apps), { kind: "command", command: "list", words: ["alpha"] });
  assert.equal(classify(["check"], apps).kind, "command");
});

test("classify: two actions, or a word that is nothing, are usage errors with a suggestion", () => {
  assert.throws(() => classify(["sim", "build"], apps), /One action at a time/);
  assert.throws(() => classify(["instal", "alpha"], apps), /Did you mean "install"/);
  assert.throws(() => classify(["alhpa"], apps), /Did you mean "alpha"/);
  assert.throws(() => classify(["zzzzzz"], apps), (e: Error) => e instanceof UsageError && !/Did you mean/.test(e.message));
});

test("chooseApps: the only app that has it, without asking", () => {
  const choice = chooseApps(apps, "install", [], false);
  assert.equal(choice.kind, "apps");
  assert.deepEqual(choice.kind === "apps" && choice.picks.map((p) => p.app.slug), ["alpha"]);
});

test("chooseApps: several could be meant: ask, for one or many", () => {
  const choice = chooseApps(apps, "sim", [], false);
  assert.equal(choice.kind, "ask");
  assert.equal(choice.kind === "ask" && choice.many, true);
  assert.deepEqual(choice.kind === "ask" && choice.candidates.map((c) => c.app.slug), ["alpha", "beta"]);
});

test("chooseApps: --all is every app that has the action", () => {
  const choice = chooseApps(apps, "sim", [], true);
  assert.deepEqual(choice.kind === "apps" && choice.picks.map((p) => p.app.slug), ["alpha", "beta"]);
});

test("chooseApps: an app without the action is an error naming the ones that have it", () => {
  assert.throws(() => chooseApps(apps, "install", [beta], false), /beta has no "install" action. These apps do: alpha/);
});

test("chooseApps: stop needs no app", () => {
  const choice = chooseApps(apps, "stop", [], false);
  assert.deepEqual(choice.kind === "apps" && choice.picks.map((p) => p.app.slug), ["alpha"]);
});

test("makePlan: install builds first, then installs, with the bar's arguments", () => {
  const plan = makePlan(picks("install", "alpha"), defaults, wifi);
  assert.deepEqual(steps(plan), [
    ["alpha", ["pnpm run build", "pnpm run app:install --addr 192.168.1.42 --password ***"]],
  ]);
  assert.equal(plan.tasks[0]!.steps[1]!.args.at(-1), "pw");
});

test("makePlan: install --no-build --run", () => {
  const plan = makePlan(picks("install", "alpha"), { ...defaults, build: false, run: true }, usb);
  assert.deepEqual(steps(plan), [["alpha", ["pnpm run app:install", "pnpm run app:run"]]]);
});

test("makePlan: one task per app, in order; extra arguments go to the script", () => {
  const plan = makePlan(picks("sim", "beta", "alpha"), defaults, usb, ["--x"]);
  assert.deepEqual(steps(plan), [
    ["beta", ["pnpm run sim --x"]],
    ["alpha", ["pnpm run sim --x"]],
  ]);
});

test("makePlan: serve takes --port; bar arguments only go to bar scripts", () => {
  const plan = makePlan(picks("serve", "alpha"), { ...defaults, port: "3000" }, wifi);
  assert.deepEqual(steps(plan), [["alpha", ["pnpm run sim:serve --port 3000"]]]);
});

test("makePlan: stop is for the bar, not an app", () => {
  assert.deepEqual(steps(makePlan(picks("stop"), defaults, usb)), [["the bar", ["pnpm run app:stop"]]]);
});

test("makePlan: options that don't go with the action are usage errors", () => {
  assert.throws(() => makePlan(picks("sim", "alpha"), { ...defaults, run: true }, usb), /--run goes with install/);
  assert.throws(() => makePlan(picks("sim", "alpha"), { ...defaults, build: false }, usb), /--no-build goes with install/);
  assert.throws(() => makePlan(picks("sim", "alpha"), { ...defaults, port: "1" }, usb), /--port goes with serve/);
});

test("makePlan: --run launches one app", () => {
  const two = [...picks("install", "alpha"), ...picks("install", "alpha")];
  assert.throws(() => makePlan(two, { ...defaults, run: true }, usb), /--run launches one app/);
});

test("chooseApps: serve and run take one app", () => {
  const choice = chooseApps(apps, "serve", [], false);
  assert.equal(choice.kind, "apps"); // only alpha has it
  const many = findApps(fixture()).map((a) => ({ ...a, scripts: { ...a.scripts, "sim:serve": "x" } }));
  assert.throws(() => chooseApps(many, "serve", many, false), /"serve" takes one app/);
  const asked = chooseApps(many, "serve", [], false);
  assert.equal(asked.kind === "ask" && asked.many, false);
});

test("classify: a command after other words says it goes first", () => {
  assert.throws(() => classify(["alpha", "list"], apps), /"list" goes first: pnpm bar list/);
});

test("chooseApps: uninstall is never assumed: name the app", () => {
  const choice = chooseApps(apps, "uninstall", [], false);
  assert.equal(choice.kind, "ask");
  assert.equal(chooseApps(apps, "uninstall", [alpha], false).kind, "apps");
});

test("makePlan: one name behind different kinds of script is refused; bar arguments go only to bar scripts", () => {
  const withLogs = findApps(fixture()).map((a) => ({
    ...a,
    scripts: { ...a.scripts, ...(a.slug === "alpha" ? { "app:logs": "busy-cli app logs" } : { logs: "cat log.txt" }) },
  }));
  const choice = chooseApps(withLogs, "logs", withLogs, false);
  assert.equal(choice.kind, "apps");
  if (choice.kind !== "apps") return;
  assert.throws(() => makePlan(choice.picks, defaults, wifi), /alpha's app:logs but beta's logs/);
  // Each on its own: only the bar's script gets the address and password.
  assert.deepEqual(steps(makePlan(choice.picks.slice(0, 1), defaults, wifi)), [
    ["alpha", ["pnpm run app:logs --addr 192.168.1.42 --password ***"]],
  ]);
  assert.deepEqual(steps(makePlan(choice.picks.slice(1), defaults, wifi)), [["beta", ["pnpm run logs"]]]);
});
