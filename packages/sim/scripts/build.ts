#!/usr/bin/env node
// Builds a simulator page for an app: its real build (busy-cli, bundled into one script) running against the
// emulated device, in a page showing the bar's front and back with working buttons and wheel.
// Usage: node packages/sim/scripts/build.ts <app-dir> [--out <dir>]
// The output folder is static: open index.html through any web server, or publish it.

import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "vite";

const args = process.argv.slice(2);
const appDir = resolve(args.find((a) => !a.startsWith("--")) ?? ".");
const outIdx = args.indexOf("--out");
const out = resolve(outIdx >= 0 ? args[outIdx + 1]! : join(appDir, "dist", "sim"));
const SIM = fileURLToPath(new URL("..", import.meta.url));

// 1. The app, built the official way into a single script (assets first, if the app has an asset step).
const pkg = JSON.parse(readFileSync(join(appDir, "package.json"), "utf8")) as { scripts?: Record<string, string> };
if (pkg.scripts?.assets) execFileSync("pnpm", ["run", "assets"], { cwd: appDir, stdio: "inherit" });
const tmp = mkdtempSync(join(tmpdir(), "bar-sim-"));
execFileSync("npx", ["busy-cli", "build", "--bundle", "--emit", "dir", "--out", tmp], { cwd: appDir, stdio: "inherit" });
const id = readdirSync(tmp)[0]!;
const pkgDir = join(tmp, id);
const manifest = JSON.parse(readFileSync(join(pkgDir, "appmeta", "manifest.json"), "utf8")) as Record<string, string>;
const settingsPath = join(pkgDir, "appmeta", "settings.json");
const settings = existsSync(settingsPath) ? JSON.parse(readFileSync(settingsPath, "utf8")) : null;
const appScript = readFileSync(join(pkgDir, "scripts", "main.js"), "utf8");

// 2. The simulator runtime, as one script.
const result = await build({
  configFile: false,
  logLevel: "warn",
  root: SIM,
  build: {
    write: false,
    minify: true,
    lib: { entry: join(SIM, "src", "main.ts"), formats: ["iife"], name: "BarSim", fileName: () => "sim.js" },
  },
});
const output = (Array.isArray(result) ? result[0]! : result) as { output: { code?: string }[] };
const runtime = output.output[0]!.code!;

// 3. The page, with the package's files beside it, packed into one JSON file (base64): a single request, and
// served by any static host (some, like artifact hosting, serve only common web types, not .anim).
rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });
const pack: Record<string, string> = {};
for (const dir of ["animations", "images", "sounds"]) {
  const src = join(pkgDir, dir);
  if (!existsSync(src)) continue;
  for (const f of readdirSync(src)) pack[`${dir}/${f}`] = readFileSync(join(src, f)).toString("base64");
}
writeFileSync(join(out, "package.json"), JSON.stringify(pack));
const files: Record<string, string> = { "package.json": join(out, "package.json") };

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
// Inline scripts must not contain a closing script tag.
const inline = (code: string) => code.replace(/<\/script/gi, "<\\/script");
const config = { id, name: manifest.name, pack: "package.json", settings };
const template = readFileSync(join(SIM, "src", "page.html"), "utf8");
const html = template
  .replaceAll("{{TITLE}}", esc(`${manifest.name} Simulator`))
  .replaceAll("{{NAME}}", esc(manifest.name ?? id))
  .replaceAll("{{ID}}", esc(`${id} v${manifest.version}`))
  .replaceAll("{{DESCRIPTION}}", esc(manifest.description ?? ""))
  .replace("{{CONFIG}}", () => inline(JSON.stringify(config)))
  .replace("{{APP}}", () => inline(appScript))
  .replace("{{RUNTIME}}", () => inline(runtime));
writeFileSync(join(out, "index.html"), html);
writeFileSync(join(out, "files.json"), JSON.stringify(files, null, 2));
rmSync(tmp, { recursive: true, force: true });
console.log(`simulator → ${relative(process.cwd(), join(out, "index.html")) || join(out, "index.html")} (${Object.keys(pack).length} package files)`);
