#!/bin/bash
# Checks a built "Pkmn Life Remote.app" against what its kind of build must be. Reads the signature, so it checks what
# was signed, not the source files.
#
#   Tools/ci/check-app.sh --app "dist/Pkmn Life Remote.app" --kind adhoc|developer-id [--team-id ID]
#                         [--version X.Y.Z] [--build N]
#
#   adhoc          signed ad hoc (./build-app.sh, CI's ordinary build)
#   developer-id   signed with a Developer ID Application certificate (--team-id's, default $MAC_TEAM_ID), with the
#                  hardened runtime and a secure timestamp: what notarization needs
#
# Both kinds: a valid, strict signature over the whole bundle; the bundle ID of Support/Info.plist (it must never
# change: the keychain item, the local network permission and the signature's designated requirement hang on it); an
# executable that's there; no entitlements at all (the app isn't sandboxed and needs none, see mac/RELEASE.md); and,
# when given, the version (CFBundleShortVersionString) and build (CFBundleVersion). Exits 1 with every problem listed.
set -euo pipefail

app=""
kind=""
team="${MAC_TEAM_ID:-}"
version=""
build=""
while (( $# )); do
    case "$1" in
        --app) app="${2-}"; shift ;;
        --kind) kind="${2-}"; shift ;;
        --team-id) team="${2-}"; shift ;;
        --version) version="${2-}"; shift ;;
        --build) build="${2-}"; shift ;;
        -h|--help) sed -n '2,/^set -euo/p' "$0" | sed '$d' | sed -E 's/^# ?//'; exit 0 ;;
        *) echo "check-app.sh: unknown option: $1" >&2; exit 2 ;;
    esac
    shift
done
case "$kind" in
    adhoc|developer-id) ;;
    *) echo "check-app.sh: --kind is adhoc or developer-id" >&2; exit 2 ;;
esac
[[ -d "$app" ]] || { echo "check-app.sh: no app at '$app'" >&2; exit 2; }

problems=0
problem() {
    if [[ -n "${GITHUB_ACTIONS:-}" ]]; then echo "::error::$1" >&2; else echo "check-app.sh: $1" >&2; fi
    problems=$(( problems + 1 ))
}

# Values from the built bundle's Info.plist, and from the one in the source tree.
info="$app/Contents/Info.plist"
key() { plutil -extract "$1" raw -o - "$info" 2>/dev/null || true; }
source_plist="$(cd "$(dirname "$0")/../.." && pwd)/Support/Info.plist"
expected_id="$(plutil -extract CFBundleIdentifier raw -o - "$source_plist")"
bundle_id="$(key CFBundleIdentifier)"
executable="$(key CFBundleExecutable)"
short="$(key CFBundleShortVersionString)"
long="$(key CFBundleVersion)"

[[ "$bundle_id" == "$expected_id" ]] || problem "bundle ID is '$bundle_id', not $expected_id (Support/Info.plist)"
[[ -n "$executable" && -x "$app/Contents/MacOS/$executable" ]] || problem "no executable Contents/MacOS/$executable"
[[ -z "$version" || "$short" == "$version" ]] || problem "version (CFBundleShortVersionString) is '$short', not $version"
[[ -z "$build" || "$long" == "$build" ]] || problem "build (CFBundleVersion) is '$long', not $build"

if ! codesign --verify --deep --strict --verbose=2 "$app" 2>&1; then
    problem "the signature doesn't verify (codesign --verify --deep --strict)"
fi
signature="$(codesign -dv --verbose=4 "$app" 2>&1 || true)"
entitlements="$(codesign -d --entitlements - --xml "$app" 2>/dev/null || true)"
# An empty dictionary counts as none.
if [[ -n "$entitlements" ]] && ! printf '%s' "$entitlements" | plutil -convert json -o - - 2>/dev/null | grep -qx '{}'; then
    problem "the app carries entitlements, and needs none: $entitlements"
fi

field() { printf '%s\n' "$signature" | sed -n "s/^$1=//p"; }
case "$kind" in
    adhoc)
        [[ "$(field Signature)" == adhoc ]] || problem "not signed ad hoc"
        ;;
    developer-id)
        authority="$(field Authority | head -1)"
        [[ "$authority" == "Developer ID Application: "* ]] || problem "signed by '${authority:-nobody}', not a Developer ID Application certificate"
        if [[ -n "$team" ]]; then
            [[ "$(field TeamIdentifier)" == "$team" ]] || problem "team is '$(field TeamIdentifier)', not $team"
        fi
        # flags=0x10000(runtime): the hardened runtime, which notarization requires.
        printf '%s\n' "$signature" | grep -qE '^CodeDirectory .*flags=0x[0-9a-f]+\([^)]*runtime' \
            || problem "no hardened runtime (sign with --options runtime)"
        # A secure timestamp from Apple shows as Timestamp=; without one, codesign records only "Signed Time".
        [[ -n "$(field Timestamp)" ]] || problem "no secure timestamp (sign with --timestamp)"
        ;;
esac

if (( problems )); then
    echo "$app: $problems problem(s) for a build of kind $kind" >&2
    exit 1
fi
archs="$(lipo -archs "$app/Contents/MacOS/$executable" 2>/dev/null || echo unknown)"
signer="$(field Authority | head -1)"
echo "$app: as expected for $kind ($bundle_id $short ($long), $archs, signed ${signer:-ad hoc}, no entitlements)"
