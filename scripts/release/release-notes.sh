#!/bin/bash
# Writes a release's notes, in Markdown: the annotated tag's message, if it has one, then the commits since the previous
# v* tag, then what to download: each BUSY Bar app and its simulator, each package, and the Mac app when it's built.
#
#   scripts/release/release-notes.sh --version 1.2.0 [--ref refs/tags/v1.2.0] [--mac] [--site-url URL] [--limit 60]
#
# --version names the files (as scripts/release/build.sh and the Mac job make them); --mac lists the Mac app (its job
# runs only once its signing is set up); --site-url links the simulators on GitHub Pages. The previous tag is the newest
# v* tag reachable from the ref's parent; with none, the history is listed from the start. Needs the full history and
# tags (actions/checkout with fetch-depth: 0), and jq.
set -euo pipefail

ref="HEAD"
version=""
mac=false
site_url=""
limit=60

while (( $# )); do
    case "$1" in
        --ref) ref="${2-}"; shift ;;
        --version) version="${2-}"; shift ;;
        --mac) mac=true ;;
        --site-url) site_url="${2-}"; shift ;;
        --limit) limit="${2-}"; shift ;;
        -h|--help) sed -n '2,/^set -euo/p' "$0" | sed '$d' | sed -E 's/^# ?//'; exit 0 ;;
        *) echo "release-notes.sh: unknown option: $1" >&2; exit 2 ;;
    esac
    shift
done
[[ "$version" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]] || { echo "release-notes.sh: --version X.Y.Z is required" >&2; exit 2; }
[[ "$limit" =~ ^[1-9][0-9]*$ ]] || { echo "release-notes.sh: --limit must be a positive integer" >&2; exit 2; }
# Paths below are the repository's, wherever this runs from.
cd "$(git rev-parse --show-toplevel)"

commit="$(git rev-parse --verify "$ref^{commit}")"
previous="$(git describe --tags --abbrev=0 --match 'v[0-9]*' "$commit^" 2>/dev/null || true)"

# An annotated tag's message, without a signature block.
message=""
if [[ "$(git cat-file -t "$ref" 2>/dev/null || true)" == tag ]]; then
    message="$(git tag -l --format='%(contents)' "${ref#refs/tags/}" | sed -E '/-----BEGIN (PGP|SSH) SIGNATURE-----/,$d')"
fi

range="$commit"
[[ -n "$previous" ]] && range="$previous..$commit"
total="$(git rev-list --count --no-merges "$range")"
commits="$(git log --no-merges --max-count="$limit" --format='- %s (%h)' "$range")"

if [[ -n "$message" ]]; then
    printf '%s\n\n' "$message"
fi
if [[ -n "$previous" ]]; then
    printf '## Changes since %s\n\n' "$previous"
else
    printf '## Changes\n\n'
fi
if [[ -n "$commits" ]]; then
    printf '%s\n' "$commits"
else
    printf -- '- No changes.\n'
fi
if (( total > limit )); then
    printf -- '- ...and %d more.\n' "$(( total - limit ))"
fi

# shellcheck disable=SC2016 # the backticks are Markdown
{
    printf '\n## Downloads\n\n'
    printf '| File | What it is |\n| --- | --- |\n'
    if [[ "$mac" == true ]]; then
        printf '| `PkmnLifeRemote-%s-macOS-arm64.zip` | Pkmn Life Remote, the Mac app (macOS 26 or later), signed with Developer ID and notarized: unzip it and move it to Applications |\n' "$version"
    fi
    for manifest in apps/*/src/appmeta/manifest.json; do
        app="$(basename "$(dirname "$(dirname "$(dirname "$manifest")")")")"
        name="$(jq -r .name "$manifest")"
        printf '| `%s-%s.tgz` | %s for the BUSY Bar: `npx -p @busy-app/cli busy-cli app install %s-%s.tgz` with the bar on USB |\n' \
            "$app" "$version" "$name" "$app" "$version"
        simulator="unzip it and serve the folder with any web server"
        [[ -n "$site_url" ]] && simulator+=", or [open it online](${site_url%/}/$app/)"
        printf '| `%s-simulator-%s.zip` | %s in the simulator, in a browser: %s |\n' "$app" "$version" "$name" "$simulator"
    done
    for package in packages/*/package.json; do
        name="$(jq -r .name "$package")"
        file="$(printf '%s' "${name#@}" | tr '/' '-')-$version.tgz"
        printf '| `%s` | `%s`: %s |\n' "$file" "$name" "$(jq -r '.description // ""' "$package")"
    done
    printf '| `SHA256SUMS.txt` | Checksums: `shasum -a 256 -c SHA256SUMS.txt` |\n'
    printf '\nThe apps are built from the repository alone, with no local files: '
    printf 'their people and other personal settings are the examples (for Pkmn Life, `redirects.example.json`). '
    printf 'Build an app yourself to use your own (its README says how).\n'
}
