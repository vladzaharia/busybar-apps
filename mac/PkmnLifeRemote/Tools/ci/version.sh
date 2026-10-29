#!/bin/bash
# Works out a Pkmn Life Remote release's version and build number.
#
#   Tools/ci/version.sh --ref refs/tags/remote-v1.2.0 --run-number 7
#   Tools/ci/version.sh --ref refs/heads/<default branch> --version 1.2.0 --run-number 8
#
# Prints key=value lines (append them to $GITHUB_OUTPUT):
#   version     X.Y.Z, from the tag remote-vX.Y.Z (or --version on a branch): the app's CFBundleShortVersionString
#   build       the release workflow's run number, e.g. 7: CFBundleVersion. mac-release.yml's counter only grows (a
#               re-run keeps its run's number), so later releases have higher builds. If the workflow is ever renamed or
#               recreated its counter restarts at 1; nothing depends on the build number but a person reading it.
#   tag         the tag name (remote-vX.Y.Z[-suffix]), or empty on a branch
#   is_tag      true or false
#   prerelease  true when the tag has a suffix (remote-v1.2.0-rc.1); the GitHub Release is marked so
#
# The repository also holds the BUSY Bar apps, so the Mac app's tags carry the "remote-" prefix: remote-vX.Y.Z with
# plain integers, optionally followed by -suffix. Exit status 2 means the input was rejected.
set -euo pipefail

ref=""
version=""
run_number=""

usage() { sed -n '2,/^set -euo/p' "$0" | sed '$d' | sed -E 's/^# ?//'; }
fail() { echo "version.sh: $*" >&2; exit 2; }

while (( $# )); do
    case "$1" in
        --ref) ref="${2-}"; shift ;;
        --version) version="${2-}"; shift ;;
        --run-number) run_number="${2-}"; shift ;;
        -h|--help) usage; exit 0 ;;
        *) usage >&2; fail "unknown option: $1" ;;
    esac
    shift
done

number='(0|[1-9][0-9]*)'
semver="^${number}\\.${number}\\.${number}\$"

[[ -n "$ref" ]] || fail "--ref is required (for example refs/tags/remote-v1.2.0 or refs/heads/<branch>)"
[[ "$run_number" =~ ^[1-9][0-9]{0,8}$ ]] || fail "--run-number must be a positive integer, got '${run_number}'"

tag=""
is_tag=false
prerelease=false
case "$ref" in
    refs/tags/*)
        tag="${ref#refs/tags/}"
        [[ "$tag" =~ ^remote-v([0-9]+\.[0-9]+\.[0-9]+)(-[0-9A-Za-z.-]+)?$ ]] \
            || fail "tag '$tag' isn't remote-vX.Y.Z or remote-vX.Y.Z-suffix"
        from_tag="${BASH_REMATCH[1]}"
        [[ -n "${BASH_REMATCH[2]}" ]] && prerelease=true
        [[ "$from_tag" =~ $semver ]] || fail "tag '$tag' has a component with a leading zero"
        if [[ -n "$version" && "$version" != "$from_tag" ]]; then
            fail "--version $version doesn't match tag $tag"
        fi
        version="$from_tag"
        is_tag=true
        ;;
    refs/heads/*)
        [[ -n "$version" ]] || fail "a branch build needs --version X.Y.Z (the workflow's version input)"
        [[ "$version" =~ $semver ]] || fail "version '$version' isn't X.Y.Z with plain integers"
        ;;
    *)
        fail "unsupported ref '$ref': use a tag refs/tags/remote-vX.Y.Z or a branch refs/heads/<name>"
        ;;
esac

echo "version=$version"
echo "build=$run_number"
echo "tag=$tag"
echo "is_tag=$is_tag"
echo "prerelease=$prerelease"
