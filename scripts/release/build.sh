#!/bin/bash
# Builds what a release ships besides the Mac app (release.yml's mac job makes that), all at one version: each BUSY
# Bar app's package and its simulator, and each shared package. Also lays out the GitHub Pages site: an index page,
# each app's simulator, and the effects gallery.
#
#   scripts/release/build.sh --version 1.2.0 [--out dist/release] [--site dist/site]
#
# In --out: <app>-X.Y.Z.tgz (busy-cli app install takes it), <app>-simulator-X.Y.Z.zip, each package's tarball as
# pnpm pack names it (vladzaharia-bar-core-X.Y.Z.tgz), and SHA256SUMS.txt. In --site: index.html, <app>/ and gallery/.
# Every package.json and app manifest takes the version first, in this checkout: commit nothing after running it.
# Needs pnpm install done, jq and zip.
set -euo pipefail

version=""
out="dist/release"
site="dist/site"

usage() { sed -n '2,/^set -euo/p' "$0" | sed '$d' | sed -E 's/^# ?//'; }
fail() { echo "build.sh: $*" >&2; exit 1; }

while (( $# )); do
    case "$1" in
        --version) version="${2-}"; shift ;;
        --out) out="${2-}"; shift ;;
        --site) site="${2-}"; shift ;;
        -h|--help) usage; exit 0 ;;
        *) usage >&2; echo "build.sh: unknown option: $1" >&2; exit 2 ;;
    esac
    shift
done
[[ "$version" =~ ^(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)$ ]] || fail "--version X.Y.Z is required"
for tool in jq zip pnpm; do command -v "$tool" >/dev/null || fail "needs $tool"; done

root="$(git rev-parse --show-toplevel)"
cd "$root"
mkdir -p "$out" "$site"
out="$(cd "$out" && pwd)"
site="$(cd "$site" && pwd)"
[[ -z "$(ls -A "$out")" ]] || fail "$out isn't empty"

sha256() { if command -v sha256sum >/dev/null; then sha256sum "$@"; else shasum -a 256 "$@"; fi; }
html() { sed -e 's/&/\&amp;/g' -e 's/</\&lt;/g' -e 's/>/\&gt;/g' -e 's/"/\&quot;/g' <<< "$1"; }
set_version() {
    jq --arg v "$version" '.version = $v' "$1" > "$1.tmp"
    mv "$1.tmp" "$1"
}

# 1. One version everywhere it is read: npm metadata, and the manifest the bar shows.
for file in packages/*/package.json apps/*/package.json apps/*/src/appmeta/manifest.json; do
    set_version "$file"
done
echo "build.sh: version $version"

# 2. Each app: its package for the bar, and its simulator (a zip, and a folder of the site).
links=""
for dir in apps/*/; do
    app="$(basename "$dir")"
    manifest="$dir/src/appmeta/manifest.json"
    [[ -f "$manifest" ]] || continue
    id="$(jq -r .id "$manifest")"
    (cd "$dir" && pnpm build)
    cp "$dir/dist/$id.tgz" "$out/$app-$version.tgz"
    (cd "$dir" && pnpm sim)
    staging="$(mktemp -d)"
    cp -R "$dir/dist/sim" "$staging/$app-simulator"
    (cd "$staging" && zip -qr "$out/$app-simulator-$version.zip" "$app-simulator")
    rm -rf "$staging"
    rm -rf "${site:?}/$app"
    cp -R "$dir/dist/sim" "$site/$app"
    links+="      <li><a href=\"$app/\">$(html "$(jq -r .name "$manifest")")</a> <span>$(html "$(jq -r '.description // ""' "$manifest")")</span></li>"$'\n'
done

# 3. Each package, as npm would install it (workspace dependencies become this version).
for dir in packages/*/; do
    (cd "$dir" && pnpm pack --pack-destination "$out" >/dev/null)
done

# 4. The effects gallery, and the site's index.
rm -rf "${site:?}/gallery"
pnpm --filter @vladzaharia/bar-pixel gallery "$site/gallery"
cat > "$site/index.html" <<EOF
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>busybar-apps $version</title>
  <link rel="icon" href="data:,">
  <style>
    :root { color-scheme: light dark; --ink: #121826; --muted: #5a6478; --bg: #eef1f6; --link: #0c66e4; }
    @media (prefers-color-scheme: dark) { :root { --ink: #e8ecf3; --muted: #9aa3b2; --bg: #0b0d12; --link: #579dff; } }
    body { margin: 0; padding: 48px 20px; background: var(--bg); color: var(--ink);
      font: 16px/1.5 system-ui, -apple-system, "Segoe UI", sans-serif; }
    main { max-width: 640px; margin: 0 auto; }
    h1 { font-size: 28px; margin: 0 0 4px; }
    h2 { font-size: 15px; text-transform: uppercase; letter-spacing: 0.06em; color: var(--muted); margin: 32px 0 8px; }
    p, span { color: var(--muted); }
    ul { list-style: none; padding: 0; margin: 0; }
    li { padding: 10px 0; border-top: 1px solid color-mix(in srgb, var(--muted) 30%, transparent); }
    li span { display: block; font-size: 14px; }
    a { color: var(--link); font-weight: 600; text-decoration: none; }
    a:hover { text-decoration: underline; }
  </style>
</head>
<body>
  <main>
    <h1>busybar-apps</h1>
    <p>Apps for the BUSY Bar, version $version. Each runs here in the simulator, the app's real build against an
      emulated bar: the keyboard works (S is START, the arrows turn the wheel, Enter is OK, Esc is BACK).</p>
    <h2>Apps</h2>
    <ul>
$links    </ul>
    <h2>Components</h2>
    <ul>
      <li><a href="gallery/">Effects gallery</a> <span>Every pre-rendered effect in bar-pixel, at the bar's resolution and speed.</span></li>
    </ul>
    <p><a href="https://github.com/vladzaharia/busybar-apps/releases/tag/v$version">Downloads for $version</a></p>
  </main>
</body>
</html>
EOF

# 5. Checksums for everything in --out.
(cd "$out" && sha256 -- *.tgz *.zip > SHA256SUMS.txt)
echo "build.sh: wrote $out:"
(cd "$out" && ls -l)
echo "build.sh: wrote the site to $site"
