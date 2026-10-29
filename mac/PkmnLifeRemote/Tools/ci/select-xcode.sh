#!/bin/bash
# Selects the Xcode a CI job builds Pkmn Life Remote with, and checks it's the one expected. Every Mac job (ci.yml,
# mac-visual.yml, mac-release.yml) runs on the `xcode-27` runner image and calls this first, so they all build with
# one toolchain.
#
#   Tools/ci/select-xcode.sh [--xcode /Applications/Xcode_27.1.app] [--expect 27.1] [--expect-build 27A9275]
#
#   --xcode         the Xcode app (default $MAC_XCODE, then /Applications/Xcode_27.1.app). On the `xcode-27` image
#                   Xcode_27.1.app is the 27.1 install (27A9275); Xcode.app is 27.0.
#   --expect        fail unless `xcodebuild -version` is Xcode <this> or a patch release of it (27.1, 27.1.1; not
#                   27.10). Default 27.1.
#   --expect-build  also fail unless the build is exactly this. mac-release.yml passes the MAC_RELEASE_XCODE_BUILD
#                   repository variable (default 27A9275), so a release never ships from an Xcode build CI hasn't used.
#
# Exports DEVELOPER_DIR through $GITHUB_ENV (no sudo xcode-select needed), so every later step, `swift` included,
# uses this Xcode. Writes the Xcode version and build to $GITHUB_STEP_SUMMARY when it's set.
set -euo pipefail

xcode="${MAC_XCODE:-/Applications/Xcode_27.1.app}"
expect="27.1"
expect_build=""

usage() { sed -n '2,/^set -euo/p' "$0" | sed '$d' | sed -E 's/^# ?//'; }
fail() { echo "select-xcode.sh: $*" >&2; exit 1; }

while (( $# )); do
    case "$1" in
        --xcode) xcode="${2-}"; shift ;;
        --expect) expect="${2-}"; shift ;;
        --expect-build) expect_build="${2-}"; shift ;;
        -h|--help) usage; exit 0 ;;
        *) usage >&2; fail "unknown option: $1" ;;
    esac
    shift
done

developer_dir="$xcode/Contents/Developer"
if [[ ! -d "$developer_dir" ]]; then
    echo "Installed Xcodes:" >&2
    ls -d /Applications/Xcode*.app >&2 || true
    fail "$xcode isn't installed on this runner. The runner image may have changed: see mac/RELEASE.md, Runner and Xcode."
fi
export DEVELOPER_DIR="$developer_dir"
if [[ -n "${GITHUB_ENV:-}" ]]; then echo "DEVELOPER_DIR=$developer_dir" >> "$GITHUB_ENV"; fi

summary() { if [[ -n "${GITHUB_STEP_SUMMARY:-}" ]]; then printf '%s\n' "$*" >> "$GITHUB_STEP_SUMMARY"; fi; }

version="$(xcodebuild -version)"
echo "$version"
first="$(printf '%s\n' "$version" | head -1)"
[[ "$first" == "Xcode $expect" || "$first" == "Xcode $expect."* ]] || fail "expected Xcode $expect at $xcode, found $first"
build="$(printf '%s\n' "$version" | sed -n 's/^Build version //p')"
if [[ -n "$expect_build" && "$build" != "$expect_build" ]]; then
    fail "$first at $xcode is build $build, not $expect_build. The runner image changed: once CI has passed with it, set the MAC_RELEASE_XCODE_BUILD repository variable (mac/RELEASE.md, Runner and Xcode)."
fi
swift --version 2>&1 | head -1
summary "### Toolchain"
summary "- $first ($build) at \`$xcode\`${expect_build:+, the release build}"
summary "- $(swift --version 2>&1 | head -1)"
