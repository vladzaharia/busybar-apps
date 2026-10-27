// Creates a new app in apps/<slug> from scripts/template: a clock, a pre-rendered scene on START, a toast on OK,
// wired to bar-core, bar-pixel and bar-sim.
// Usage: pnpm new-app <slug> --name "Display Name" [--id app.vlad.my_app] [--description "..."] [--author "..."]

import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const TEMPLATE = join(ROOT, "scripts", "template");

const args = process.argv.slice(2);
const flag = (name: string) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : undefined;
};
const slug = args.find((a, i) => !a.startsWith("--") && !args[i - 1]?.startsWith("--"));
if (!slug || !/^[a-z][a-z0-9-]*$/.test(slug)) {
  console.error('Usage: pnpm new-app <slug> --name "Display Name" [--id app.vlad.my_app] [--description "..."] [--author "..."]');
  console.error("The slug is the folder name: lowercase letters, digits and hyphens.");
  process.exit(1);
}
const name = flag("name") ?? slug.replace(/(^|-)(\w)/g, (_, s: string, c: string) => (s ? " " : "") + c.toUpperCase());
const id = flag("id") ?? `app.vlad.${slug.replace(/-/g, "_")}`;
// The firmware's rules for the id, which is also the package folder on the bar.
if (!/^[a-zA-Z0-9_-][a-zA-Z0-9_.-]{0,31}$/.test(id)) {
  console.error(`Invalid id "${id}": at most 32 characters, letters, digits, "_", "-" and ".", not starting with ".".`);
  process.exit(1);
}
if (!/^[\x20-\x7e]+$/.test(name)) {
  console.error("The name must be printable ASCII (the device fonts have nothing else).");
  process.exit(1);
}
const dest = join(ROOT, "apps", slug);
if (existsSync(dest)) {
  console.error(`apps/${slug} already exists.`);
  process.exit(1);
}

const values: Record<string, string> = {
  SLUG: slug,
  ID: id,
  NAME: name,
  NAME_UPPER: name.toUpperCase(),
  DESCRIPTION: flag("description") ?? `${name}, a BUSY Bar app.`,
  AUTHOR: flag("author") ?? "Vlad Zaharia",
};

function copy(from: string, to: string): void {
  for (const entry of readdirSync(from)) {
    const src = join(from, entry);
    // npm-style dotfiles do not survive packing, so the template keeps them without the dot.
    const target = join(to, entry === "gitignore" ? ".gitignore" : entry);
    if (statSync(src).isDirectory()) {
      copy(src, target);
      continue;
    }
    mkdirSync(dirname(target), { recursive: true });
    const text = readFileSync(src, "utf8").replace(/\{\{(\w+)\}\}/g, (m, k: string) => values[k] ?? m);
    writeFileSync(target, text);
  }
}

copy(TEMPLATE, dest);
console.log(`Created ${relative(ROOT, dest)} (${id}).`);
execFileSync("pnpm", ["install"], { cwd: ROOT, stdio: "inherit" });
console.log(`
Next:
  cd apps/${slug}
  pnpm sim        # build and open dist/sim/index.html in the simulator
  pnpm build      # dist/${id}.tgz, ready to install
  pnpm app:install && pnpm app:run   # with the bar on USB`);
