#!/bin/bash
# Writes a Pkmn Life Remote release's notes, in Markdown: the annotated tag's message, if it has one, then the commits
# since the previous remote-v* tag that touch mac/ (the repository also holds the BUSY Bar apps, whose commits don't
# belong in the Mac app's notes).
#
#   Tools/ci/release-notes.sh [--ref refs/tags/remote-v1.2.0] [--limit 60]
#
# The previous tag is the newest remote-v* tag reachable from the ref's parent; with none, the history is listed from
# the start. Needs the full history and tags (actions/checkout with fetch-depth: 0).
set -euo pipefail

ref="HEAD"
limit=60

while (( $# )); do
    case "$1" in
        --ref) ref="${2-}"; shift ;;
        --limit) limit="${2-}"; shift ;;
        -h|--help) sed -n '2,/^set -euo/p' "$0" | sed '$d' | sed -E 's/^# ?//'; exit 0 ;;
        *) echo "release-notes.sh: unknown option: $1" >&2; exit 2 ;;
    esac
    shift
done
[[ "$limit" =~ ^[1-9][0-9]*$ ]] || { echo "release-notes.sh: --limit must be a positive integer" >&2; exit 2; }
# Paths below are the repository's, wherever this runs from.
cd "$(git rev-parse --show-toplevel)"

commit="$(git rev-parse --verify "$ref^{commit}")"
previous="$(git describe --tags --abbrev=0 --match 'remote-v[0-9]*' "$commit^" 2>/dev/null || true)"

# An annotated tag's message, without a signature block.
message=""
if [[ "$(git cat-file -t "$ref" 2>/dev/null || true)" == tag ]]; then
    message="$(git tag -l --format='%(contents)' "${ref#refs/tags/}" | sed -E '/-----BEGIN (PGP|SSH) SIGNATURE-----/,$d')"
fi

range="$commit"
[[ -n "$previous" ]] && range="$previous..$commit"
total="$(git rev-list --count --no-merges "$range" -- mac)"
commits="$(git log --no-merges --max-count="$limit" --format='- %s (%h)' "$range" -- mac)"

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
    printf -- '- No changes to the Mac app.\n'
fi
if (( total > limit )); then
    printf -- '- ...and %d more.\n' "$(( total - limit ))"
fi
# shellcheck disable=SC2016 # the backticks are Markdown
printf '\nSigned with Developer ID and notarized by Apple: unzip it and move **Pkmn Life Remote** to Applications. Check a download with `shasum -a 256 -c SHA256SUMS.txt`.\n'
