// pnpm bar mac: Pkmn Life Remote, the Mac app in mac/, installed in /Applications (or ~/Applications when that isn't
// writable) and opened. From one of three places (--from):
//   ci       CI's newest build of main: the `mac` job's artifact (.github/workflows/ci.yml). The app as it is on main,
//            so it knows everything `pnpm bar install pkmn-life` puts on the bar. Signed ad hoc. Downloaded with the
//            GitHub CLI, signed in: GitHub hands out artifacts only to signed-in users, even a public repository's.
//   release  the latest GitHub Release's (release.yml): signed with Developer ID and notarized, and checked against the
//            release's SHA256SUMS.txt. Needs nothing but the network; can be older than main.
//   local    built from this checkout by build-app.sh, signed ad hoc. Needs Xcode 26 or later.
// What to decide is in plain functions (tested in test/mac.test.ts); installMac does it.

import { log } from "@clack/prompts";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { accessSync, constants, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { basename, dirname, join } from "node:path";
import { sh } from "./exec.ts";
import { UsageError } from "./plan.ts";

export const SOURCES = ["ci", "release", "local"] as const;
export type Source = (typeof SOURCES)[number];

/** What each source is, and what it needs: for the menu. */
export const SOURCE_SUMMARIES: Readonly<Record<Source, string>> = {
  ci: "CI's newest build of main; needs gh, signed in",
  release: "the latest release, notarized; can be older than main",
  local: "built from this checkout; needs Xcode 26 or later",
};

const SOURCE_NAMES: Readonly<Record<Source, string>> = {
  ci: "CI's newest build of main",
  release: "the latest release",
  local: "a build of this checkout",
};

/** The artifact CI's `mac` job uploads the zipped app as (.github/workflows/ci.yml). */
export const CI_ARTIFACT = "pkmn-life-remote";

export function parseSource(from: string | undefined): Source {
  if (from === undefined) return "ci";
  if ((SOURCES as readonly string[]).includes(from)) return from as Source;
  throw new UsageError(`--from is ci, release or local, not "${from}".`);
}

export interface MacApp {
  /** mac/PkmnLifeRemote: build-app.sh and Support/Info.plist. */
  readonly dir: string;
  /** The bundle is "<name>.app". */
  readonly name: string;
  /** The executable: the process to quit, and what the release's zip is named after (Tools/ci/package-mac.sh). */
  readonly executable: string;
  /** LSMinimumSystemVersion's major version. */
  readonly minimumMacOS: number;
}

function plistString(plist: string, key: string): string | undefined {
  return new RegExp(`<key>${key}</key>\\s*<string>([^<]*)</string>`).exec(plist)?.[1];
}

/** The Mac app, as its Info.plist describes it. */
export function readMacApp(root: string): MacApp {
  const dir = join(root, "mac", "PkmnLifeRemote");
  const path = join(dir, "Support", "Info.plist");
  if (!existsSync(path)) throw new Error(`There's no Mac app here: ${path} is missing.`);
  const plist = readFileSync(path, "utf8");
  const get = (key: string) => plistString(plist, key) || fail(`${path} has no ${key}.`);
  return {
    dir,
    name: get("CFBundleName"),
    executable: get("CFBundleExecutable"),
    minimumMacOS: Number.parseInt(get("LSMinimumSystemVersion"), 10),
  };
}

/** Why the app can't be installed on this machine from that source; undefined when it can. */
export function unsupported(app: MacApp, source: Source, here: { platform: string; arch: string; macOS?: string }): string | undefined {
  if (here.platform !== "darwin") return `${app.name} is a Mac app: run pnpm bar mac on a Mac.`;
  const major = Number.parseInt(here.macOS ?? "", 10);
  if (major < app.minimumMacOS) return `${app.name} needs macOS ${app.minimumMacOS} or later; this Mac has ${here.macOS}.`;
  if (source !== "local" && here.arch !== "arm64") {
    return `CI builds ${app.name} for Apple silicon only. Build it on this Mac instead: pnpm bar mac --from local.`;
  }
  return undefined;
}

/** "owner/repo" from a GitHub remote's URL (https or ssh). */
export function githubRepo(remote: string): string | undefined {
  return /github\.com[:/]([^/\s]+\/[^/\s]+?)(?:\.git)?\/?$/.exec(remote.trim())?.[1];
}

/** The release's zip of the app for this architecture (package-mac.sh: <executable>-<version>-macOS-<arch>.zip). */
export function releaseZip(names: readonly string[], app: MacApp, arch: string): string | undefined {
  return names.find((n) => n.startsWith(`${app.executable}-`) && n.endsWith(`-macOS-${arch}.zip`));
}

/** A file's SHA-256 from a SHA256SUMS.txt (`sha256sum` lines: hash, two spaces, name). */
export function checksumFor(sums: string, file: string): string | undefined {
  for (const line of sums.split("\n")) {
    const m = /^([0-9a-f]{64}) [ *](.+)$/.exec(line.trim());
    if (m && m[2] === file) return m[1];
  }
  return undefined;
}

function fail(message: string): never {
  throw new Error(message);
}

/** Runs a command for its output; its errors are shown. Throws, with `hint`, when it fails. */
function run(command: string, args: readonly string[], hint = ""): string {
  const r = spawnSync(command, args, { encoding: "utf8", stdio: ["ignore", "pipe", "inherit"] });
  if ((r.error as NodeJS.ErrnoException | undefined)?.code === "ENOENT") fail(`${command} isn't installed.${hint && ` ${hint}`}`);
  if (r.error) throw r.error;
  if (r.status !== 0) fail(`${command} ${args[0]} failed (exit ${r.status}).${hint && ` ${hint}`}`);
  return r.stdout;
}

/** Where the app goes: /Applications, or ~/Applications for a user who can't write there. */
function applicationsFolder(): string {
  try {
    accessSync("/Applications", constants.W_OK);
    return "/Applications";
  } catch {
    return join(homedir(), "Applications");
  }
}

interface Fetched {
  /** The .app, in a temporary folder or mac/PkmnLifeRemote/dist. */
  readonly app: string;
  /** Where it came from, for the summary. */
  readonly from: string;
}

const NO_GH = "Or without gh: pnpm bar mac --from release (the latest release), or --from local (builds it here).";

function fromCi(app: MacApp, repo: string, work: string): Fetched {
  const hint = `Signed in (gh auth status)? Artifacts last 90 days. ${NO_GH}`;
  const json = run("gh", ["run", "list", "-R", repo, "--workflow", "ci.yml", "--branch", "main", "--status", "success",
    "--limit", "1", "--json", "databaseId,headSha,createdAt"], `brew install gh, then gh auth login. ${NO_GH}`);
  const [last] = JSON.parse(json) as { databaseId: number; headSha: string; createdAt: string }[];
  if (!last) fail(`CI hasn't built main yet. ${NO_GH}`);
  const from = `CI's build of main at ${last.headSha.slice(0, 7)} (${last.createdAt.slice(0, 10)})`;
  log.step(`Downloading ${from}`);
  run("gh", ["run", "download", String(last.databaseId), "-R", repo, "--name", CI_ARTIFACT, "--dir", work], hint);
  const zip = readdirSync(work).find((f) => f.endsWith(".zip")) ?? fail(`CI's ${CI_ARTIFACT} artifact holds no zip.`);
  return { app: unzip(join(work, zip), work, app), from };
}

async function fromRelease(app: MacApp, repo: string, work: string, arch: string): Promise<Fetched> {
  const latest = await download(`https://api.github.com/repos/${repo}/releases/latest`);
  if (!latest) fail(`${repo} has no release yet: pnpm bar mac (CI's build of main) instead.`);
  const release = JSON.parse(latest.toString("utf8")) as { tag_name: string; assets: { name: string; browser_download_url: string }[] };
  const url = (name: string) => release.assets.find((a) => a.name === name)?.browser_download_url;
  const zipName = releaseZip(release.assets.map((a) => a.name), app, arch);
  if (!zipName) fail(`${release.tag_name} has no ${app.name} for ${arch}: pnpm bar mac (CI's build of main) instead.`);
  const sumsUrl = url("SHA256SUMS.txt") ?? fail(`${release.tag_name} has no SHA256SUMS.txt to check ${zipName} against.`);
  log.step(`Downloading ${zipName} (${release.tag_name})`);
  const zip = (await download(url(zipName)!)) ?? fail(`${zipName} wasn't there to download.`);
  const sums = (await download(sumsUrl)) ?? fail(`${release.tag_name}'s SHA256SUMS.txt wasn't there to download.`);
  const want = checksumFor(sums.toString("utf8"), zipName) ?? fail(`SHA256SUMS.txt doesn't list ${zipName}: not installing it unchecked.`);
  if (createHash("sha256").update(zip).digest("hex") !== want) fail(`${zipName} doesn't match SHA256SUMS.txt: not installing it.`);
  const path = join(work, zipName);
  writeFileSync(path, zip);
  return { app: unzip(path, work, app), from: `${release.tag_name}, notarized` };
}

/** A URL's body; undefined for a 404. */
async function download(url: string): Promise<Buffer | undefined> {
  const res = await fetch(url, { headers: { "user-agent": "busybar-apps-pnpm-bar" } });
  if (res.status === 404) return undefined;
  if (!res.ok) fail(`${url}: HTTP ${res.status}.`);
  return Buffer.from(await res.arrayBuffer());
}

function fromLocal(app: MacApp): Fetched {
  log.step("Building it: build-app.sh");
  const code = sh(join(app.dir, "build-app.sh"), [], app.dir);
  if (code !== 0) fail(`build-app.sh failed (exit ${code}).`);
  return { app: join(app.dir, "dist", `${app.name}.app`), from: "built from this checkout" };
}

/** `ditto`, as the zips were made: plain unzip can lose the signature. */
function unzip(zip: string, work: string, app: MacApp): string {
  const out = join(work, "unzipped");
  run("ditto", ["-x", "-k", zip, out]);
  const path = join(out, `${app.name}.app`);
  return existsSync(path) ? path : fail(`${basename(zip)} has no ${app.name}.app.`);
}

/** The running copy, quit so that `open` starts the new one (it would bring the old one forward otherwise). */
function quit(app: MacApp): void {
  const running = () => spawnSync("pgrep", ["-x", app.executable], { stdio: "ignore" }).status === 0;
  if (!running()) return;
  log.step(`Quitting the ${app.name} that's running`);
  spawnSync("pkill", ["-x", app.executable], { stdio: "ignore" });
  const nap = new Int32Array(new SharedArrayBuffer(4));
  for (let i = 0; i < 50 && running(); i++) Atomics.wait(nap, 0, 0, 100);
}

/** Copies the app into place, replacing the copy there only once the new one is whole, and opens it. */
function install(app: MacApp, built: string): string {
  run("codesign", ["--verify", "--deep", "--strict", built], "The app's signature doesn't check out: not installing it.");
  const folder = applicationsFolder();
  mkdirSync(folder, { recursive: true });
  const target = join(folder, `${app.name}.app`);
  const incoming = `${target}.incoming`;
  rmSync(incoming, { recursive: true, force: true });
  run("ditto", [built, incoming]);
  quit(app);
  rmSync(target, { recursive: true, force: true });
  renameSync(incoming, target);
  run("open", [target]);
  return target;
}

/** What `pnpm bar mac` would do, for --dry-run. */
export function describeInstall(app: MacApp, source: Source): string {
  return `Would install ${app.name} from ${SOURCE_NAMES[source]} in ${applicationsFolder()}, and open it.`;
}

/** Gets the app, installs it and opens it; returns what to say about it. */
export async function installMac(root: string, app: MacApp, source: Source): Promise<string> {
  const here = { platform: process.platform, arch: process.arch, macOS: macOSVersion() };
  const problem = unsupported(app, source, here);
  if (problem) fail(problem);
  const repo = () => {
    const remote = run("git", ["-C", root, "remote", "get-url", "origin"]);
    return githubRepo(remote) ?? fail(`origin (${remote.trim()}) isn't on GitHub: pnpm bar mac --from local builds the app here.`);
  };
  const work = mkdtempSync(join(tmpdir(), "pnpm-bar-mac-"));
  try {
    const fetched =
      source === "ci" ? fromCi(app, repo(), work) : source === "release" ? await fromRelease(app, repo(), work, here.arch) : fromLocal(app);
    const target = install(app, fetched.app);
    return `${app.name} is in ${dirname(target)}, and open: ${fetched.from}.`;
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
}

function macOSVersion(): string | undefined {
  if (process.platform !== "darwin") return undefined;
  return spawnSync("sw_vers", ["-productVersion"], { encoding: "utf8" }).stdout?.trim() || undefined;
}
