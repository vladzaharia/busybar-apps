import assert from "node:assert/strict";
import { test } from "node:test";
import { actionForScript, allActions, appActions, appsWith } from "../src/actions.ts";
import { describeDevice, deviceArgs, resolveDevice } from "../src/device.ts";
import { ROOT, findApp, findApps } from "../src/repo.ts";
import { fixture } from "./fixture.ts";

test("findApps: every folder with a package.json and a manifest, by slug", () => {
  const apps = findApps(fixture());
  assert.deepEqual(
    apps.map((a) => [a.slug, a.id, a.name, a.version]),
    [
      ["alpha", "app.test.alpha", "Alpha", "1.2.3"],
      ["beta", "app.test.beta", "Beta", "0.1.0"],
    ],
  );
  assert.equal(apps[0]!.description, "The first app.");
});

test("findApps: this repository's apps", () => {
  const apps = findApps(ROOT);
  assert.ok(apps.some((a) => a.slug === "pkmn-life" && a.id === "app.vlad.pkmn_life"));
});

test("findApp: by slug or manifest id", () => {
  const apps = findApps(fixture());
  assert.equal(findApp(apps, "alpha")?.slug, "alpha");
  assert.equal(findApp(apps, "app.test.beta")?.slug, "beta");
  assert.equal(findApp(apps, "gamma"), undefined);
});

test("actions: the template's scripts, by their short names, bar first", () => {
  const [alpha] = findApps(fixture());
  assert.deepEqual(
    appActions(alpha!).map((a) => a.name),
    ["install", "run", "stop", "uninstall", "sim", "serve", "build", "assets", "typecheck", "test"],
  );
});

test("actions: an app's own scripts are actions too; pre/post hooks are not", () => {
  const [, beta] = findApps(fixture());
  const actions = appActions(beta!);
  assert.deepEqual(
    actions.map((a) => a.name),
    ["sim", "build", "preview"],
  );
  const preview = actions.find((a) => a.name === "preview")!;
  assert.equal(preview.group, "other");
  assert.equal(preview.summary, "Runs: vite preview");
});

test("actions: an unknown app: script drops its prefix and talks to the bar", () => {
  const a = actionForScript("app:logs", "busy-cli app logs");
  assert.equal(a.name, "logs");
  assert.equal(a.device, true);
});

test("allActions: each action once, across the apps", () => {
  const names = allActions(findApps(fixture())).map((a) => a.name);
  assert.equal(new Set(names).size, names.length);
  assert.ok(names.includes("preview") && names.includes("install"));
});

test("appsWith: the apps that have an action", () => {
  const apps = findApps(fixture());
  assert.deepEqual(appsWith(apps, "install").map((p) => p.app.slug), ["alpha"]);
  assert.deepEqual(appsWith(apps, "sim").map((p) => p.app.slug), ["alpha", "beta"]);
});

test("device: a flag wins over the environment, which wins over .env", () => {
  const env = { BUSY_BAR_ADDR: "10.0.0.2", BUSY_BAR_PASSWORD: "env-pw" };
  const dotEnv = { BUSY_BAR_ADDR: "10.0.0.3", BUSY_BAR_PASSWORD: "file-pw" };
  assert.deepEqual(resolveDevice({ addr: "10.0.0.1" }, env, dotEnv), {
    addr: "10.0.0.1",
    password: "env-pw",
    source: "flag",
  });
  assert.deepEqual(resolveDevice({}, {}, dotEnv), { addr: "10.0.0.3", password: "file-pw", source: ".env" });
  assert.deepEqual(resolveDevice({}, {}, {}), { addr: undefined, password: undefined, source: "usb" });
});

test("device: busy-cli's arguments, and a description without the password", () => {
  const device = resolveDevice({ addr: "bar.local", password: "s3cret" }, {}, {});
  assert.deepEqual(deviceArgs(device), ["--addr", "bar.local", "--password", "s3cret"]);
  assert.doesNotMatch(describeDevice(device), /s3cret/);
  assert.deepEqual(deviceArgs(resolveDevice({}, {}, {})), []);
  assert.match(describeDevice(resolveDevice({}, {}, {})), /USB/);
});
