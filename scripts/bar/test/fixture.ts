// A repository to test against, in a temporary folder: two apps and a folder that isn't one.

import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

/** The template's scripts (scripts/template/package.json), as a new app gets them. */
export const TEMPLATE_SCRIPTS = {
  assets: "node assets/build.ts",
  typecheck: "pnpm assets && tsc",
  build: "pnpm assets && busy-cli build --emit both",
  sim: "node ../../packages/sim/scripts/build.ts . --out dist/sim",
  "sim:serve": "node ../../packages/sim/scripts/build.ts . --out dist/sim --serve",
  "app:install": "busy-cli app install",
  "app:uninstall": "busy-cli app uninstall",
  "app:run": "busy-cli app run",
  "app:stop": "busy-cli app stop",
};

function app(root: string, slug: string, scripts: Record<string, string>, manifest?: Record<string, string>): void {
  const dir = join(root, "apps", slug);
  mkdirSync(join(dir, "src", "appmeta"), { recursive: true });
  writeFileSync(join(dir, "package.json"), JSON.stringify({ name: slug, scripts }));
  if (manifest) writeFileSync(join(dir, "src", "appmeta", "manifest.json"), JSON.stringify(manifest));
}

export function fixture(): string {
  const root = mkdtempSync(join(tmpdir(), "bar-cli-"));
  app(root, "alpha", { ...TEMPLATE_SCRIPTS, test: "node --test" }, {
    id: "app.test.alpha",
    name: "Alpha",
    version: "1.2.3",
    description: "The first app.",
  });
  // An app without the bar scripts, with one of its own and a hook that must not show as an action.
  app(root, "beta", { sim: TEMPLATE_SCRIPTS.sim, build: "busy-cli build", prebuild: "echo pre", preview: "vite preview" }, {
    id: "app.test.beta",
    name: "Beta",
    version: "0.1.0",
  });
  app(root, "not-an-app", { build: "true" });
  writeFileSync(join(root, "apps", "README.md"), "not a folder");
  return root;
}
