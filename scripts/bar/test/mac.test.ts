import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { CI_ARTIFACT, checksumFor, githubRepo, parseSource, readMacApp, releaseZip, unsupported } from "../src/mac.ts";
import { UsageError, makePlan, parseCommandLine } from "../src/plan.ts";
import { ROOT } from "../src/repo.ts";
import { resolveDevice } from "../src/device.ts";

const app = readMacApp(ROOT);
const mac = { platform: "darwin", arch: "arm64", macOS: "26.1" };

test("readMacApp: the app as its Info.plist has it", () => {
  assert.equal(app.name, "Pkmn Life Remote");
  assert.equal(app.executable, "PkmnLifeRemote");
  assert.equal(app.minimumMacOS, 26);
});

test("the names pnpm bar mac relies on are the ones the build, CI and the release use", () => {
  const read = (...p: string[]) => readFileSync(join(ROOT, ...p), "utf8");
  assert.match(read("mac", "PkmnLifeRemote", "build-app.sh"), new RegExp(`^app="dist/${app.name}\\.app"$`, "m"));
  assert.match(read(".github", "workflows", "ci.yml"), new RegExp(`^\\s+name: ${CI_ARTIFACT}$`, "m"));
  // package-mac.sh names the release's zip <executable>-<version>-macOS-<arch>.zip.
  assert.match(read("mac", "PkmnLifeRemote", "Tools", "ci", "package-mac.sh"), /^name="PkmnLifeRemote-\$version-macOS-\$arch"$/m);
});

test("parseSource: CI's build by default; anything else named is a usage error", () => {
  assert.equal(parseSource(undefined), "ci");
  assert.equal(parseSource("release"), "release");
  assert.equal(parseSource("local"), "local");
  assert.throws(() => parseSource("main"), (e: Error) => e instanceof UsageError && /ci, release or local/.test(e.message));
});

test("unsupported: a Mac with macOS 26, and Apple silicon for the builds CI makes", () => {
  assert.equal(unsupported(app, "ci", mac), undefined);
  assert.match(unsupported(app, "ci", { ...mac, platform: "linux" })!, /is a Mac app/);
  assert.match(unsupported(app, "release", { ...mac, macOS: "15.6" })!, /needs macOS 26 or later; this Mac has 15\.6/);
  assert.match(unsupported(app, "release", { ...mac, arch: "x64" })!, /--from local/);
  assert.equal(unsupported(app, "local", { ...mac, arch: "x64" }), undefined);
});

test("githubRepo: https and ssh remotes", () => {
  assert.equal(githubRepo("https://github.com/vladzaharia/busybar-apps"), "vladzaharia/busybar-apps");
  assert.equal(githubRepo("https://github.com/vladzaharia/busybar-apps.git\n"), "vladzaharia/busybar-apps");
  assert.equal(githubRepo("git@github.com:vladzaharia/busybar-apps.git"), "vladzaharia/busybar-apps");
  assert.equal(githubRepo("https://gitlab.com/someone/busybar-apps"), undefined);
});

test("releaseZip: the app's zip for this architecture, among the release's files", () => {
  const names = ["pkmn-life-0.2.0.tgz", "PkmnLifeRemote-0.2.0-macOS-arm64.zip", "pkmn-life-simulator-0.2.0.zip", "SHA256SUMS.txt"];
  assert.equal(releaseZip(names, app, "arm64"), "PkmnLifeRemote-0.2.0-macOS-arm64.zip");
  assert.equal(releaseZip(names, app, "x64"), undefined);
});

test("checksumFor: a file's line in SHA256SUMS.txt, in text or binary mode", () => {
  const a = "a".repeat(64);
  const b = "b".repeat(64);
  const sums = `${a}  pkmn-life-0.2.0.tgz\n${b} *PkmnLifeRemote-0.2.0-macOS-arm64.zip\n`;
  assert.equal(checksumFor(sums, "PkmnLifeRemote-0.2.0-macOS-arm64.zip"), b);
  assert.equal(checksumFor(sums, "pkmn-life-0.2.0.tgz"), a);
  assert.equal(checksumFor(sums, "missing.zip"), undefined);
});

test("--from goes with mac only", () => {
  assert.equal(parseCommandLine(["mac", "--from", "release"]).options.from, "release");
  const options = { build: true, run: false, port: undefined, from: "release" };
  const install = { app: { slug: "x", dir: "", id: "x", name: "X", version: "", description: "", scripts: {} },
    action: { name: "sim", script: "sim", summary: "", group: "sim" as const, scope: "each" as const, device: false } };
  assert.throws(() => makePlan([install], options, resolveDevice({}, {}, {})), /--from goes with mac/);
});
