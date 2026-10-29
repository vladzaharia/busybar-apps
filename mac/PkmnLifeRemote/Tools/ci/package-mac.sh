#!/bin/bash
# Packages the Developer ID signed app for a release: notarizes and staples it, then writes a ZIP and SHA256SUMS.txt.
#
#   Tools/ci/package-mac.sh --app "dist/Pkmn Life Remote.app" --version 1.2.0 --build 7 --output dist/release \
#                           [--notarize] [--wait 45m]
#
#   --version, --build   the app's Info.plist must carry these as CFBundleShortVersionString and CFBundleVersion, or
#                nothing is packaged
#   --notarize   check the app is Developer ID signed with the hardened runtime and a secure timestamp
#                (Tools/ci/check-app.sh, team $MAC_TEAM_ID), send it to Apple's notary service with the App Store
#                Connect API key (MAC_ASC_KEY_PATH, MAC_ASC_KEY_ID, MAC_ASC_ISSUER_ID, from Tools/ci/secrets.sh), wait,
#                staple the ticket, and check the stapled app as Gatekeeper would. Without it (a local check of the
#                packaging) the app is packaged as it is and nothing is sent to Apple.
#   --wait 45m   how long to wait for Apple (notarytool's --timeout). It usually takes minutes; this keeps the wait well
#                inside the job's time limit. If it runs out, the step fails and names the submission: re-running the
#                job builds and submits again (mac/RELEASE.md, Re-running).
#
# Submission IDs and results also go to $GITHUB_STEP_SUMMARY when it's set. Outputs in --output:
#   PkmnLifeRemote-<version>-macOS-<arch>.zip   the stapled app (ditto -c -k --keepParent, which keeps the signature
#                                               and the ticket); <arch> is arm64, x86_64, or universal
#   SHA256SUMS.txt                              `shasum -a 256 -c SHA256SUMS.txt` checks a download
set -euo pipefail

app=""
version=""
build=""
output=""
notarize=0
wait_for="45m"

usage() { sed -n '2,/^set -euo/p' "$0" | sed '$d' | sed -E 's/^# ?//'; }
fail() { echo "package-mac.sh: $*" >&2; exit 1; }

while (( $# )); do
    case "$1" in
        --app) app="${2-}"; shift ;;
        --version) version="${2-}"; shift ;;
        --build) build="${2-}"; shift ;;
        --output) output="${2-}"; shift ;;
        --notarize) notarize=1 ;;
        --wait) wait_for="${2-}"; shift ;;
        -h|--help) usage; exit 0 ;;
        *) usage >&2; fail "unknown option: $1" ;;
    esac
    shift
done
[[ -d "$app" && -n "$version" && -n "$build" && -n "$output" ]] \
    || { usage >&2; fail "--app (an existing app), --version, --build, and --output are required"; }
[[ "$wait_for" =~ ^[0-9]+[smh]$ ]] || fail "--wait takes a duration such as 45m"

here="$(cd "$(dirname "$0")" && pwd)"
info="$app/Contents/Info.plist"
short="$(plutil -extract CFBundleShortVersionString raw -o - "$info" 2>/dev/null || true)"
long="$(plutil -extract CFBundleVersion raw -o - "$info" 2>/dev/null || true)"
[[ "$short" == "$version" ]] || fail "$app is version '$short' (CFBundleShortVersionString), not $version"
[[ "$long" == "$build" ]] || fail "$app is build '$long' (CFBundleVersion), not $build"
echo "Version $short ($long)"

executable="$(plutil -extract CFBundleExecutable raw -o - "$info")"
archs="$(lipo -archs "$app/Contents/MacOS/$executable")"
case "$archs" in
    arm64|x86_64) arch="$archs" ;;
    *) arch=universal ;;
esac
name="PkmnLifeRemote-$version-macOS-$arch"
mkdir -p "$output"
output="$(cd "$output" && pwd)"
zip="$output/$name.zip"
work="$(mktemp -d)"
trap 'rm -rf "${work:?}"' EXIT

summary() { if [[ -n "${GITHUB_STEP_SUMMARY:-}" ]]; then printf '%s\n' "$*" >> "$GITHUB_STEP_SUMMARY"; fi; }
notarytool() {
    xcrun notarytool "$@" --key "$MAC_ASC_KEY_PATH" --key-id "$MAC_ASC_KEY_ID" --issuer "$MAC_ASC_ISSUER_ID"
}
json_field() { plutil -extract "$1" raw -o - - 2>/dev/null || true; }

if (( notarize )); then
    # (Explicit checks: under the EXIT trap above, bash 3.2 exits 0 when a "${NAME:?}" expansion fails.)
    [[ -n "${MAC_ASC_KEY_PATH:-}" && -n "${MAC_ASC_KEY_ID:-}" && -n "${MAC_ASC_ISSUER_ID:-}" ]] \
        || fail "--notarize needs the API key: run it inside Tools/ci/secrets.sh run, with the ASC_* secrets"
    "$here/check-app.sh" --app "$app" --kind developer-id --version "$version" --build "$build" \
        || fail "$app isn't the Developer ID build Apple notarizes"

    summary "### Notarization"
    ditto -c -k --keepParent "$app" "$work/submit.zip"
    result="$(notarytool submit "$work/submit.zip" --output-format json)" || { printf '%s\n' "$result" >&2; fail "couldn't submit $name"; }
    submission="$(printf '%s' "$result" | json_field id)"
    [[ -n "$submission" ]] || { printf '%s\n' "$result" >&2; fail "notarytool returned no submission ID"; }
    echo "Submitted $name for notarization: $submission"

    # The status decides, not wait's exit status: Invalid is an answer too, and a wait that runs out says nothing.
    status="$(notarytool wait "$submission" --timeout "$wait_for" --output-format json 2>/dev/null | json_field status)" || true
    case "$status" in
        Accepted|Invalid|Rejected) ;;
        *) status="$(notarytool info "$submission" --output-format json 2>/dev/null | json_field status)" || true ;;
    esac
    echo "Notarization: ${status:-no answer} (submission $submission)"
    summary "- Submission \`$submission\`: ${status:-no answer}"
    case "$status" in
        Accepted) ;;
        Invalid|Rejected)
            notarytool log "$submission" >&2 || true
            fail "notarization wasn't accepted (submission $submission); Apple's log is above"
            ;;
        *)
            echo "::error title=Notarization still in progress::Apple hasn't finished submission $submission within $wait_for. Re-run the failed job to build and submit again; xcrun notarytool info $submission shows how the old one ends." >&2
            exit 1
            ;;
    esac

    xcrun stapler staple "$app"
    xcrun stapler validate "$app"
    assessment="$(spctl --assess --type execute -vv "$app" 2>&1)" || { printf '%s\n' "$assessment" >&2; fail "Gatekeeper rejects $app"; }
    printf '%s\n' "$assessment"
    printf '%s\n' "$assessment" | grep -q '^source=Notarized Developer ID$' || fail "Gatekeeper doesn't see $app as notarized"
    codesign --verify --deep --strict --verbose=2 "$app"
fi

rm -f "${zip:?}"
ditto -c -k --keepParent "$app" "$zip"
# What a download unpacks to: the signature (and, notarized, the ticket) must survive the ZIP.
ditto -x -k "$zip" "$work/unzipped"
codesign --verify --deep --strict "$work/unzipped/$(basename "$app")"
if (( notarize )); then xcrun stapler validate "$work/unzipped/$(basename "$app")" >/dev/null; fi
echo "ZIP: $zip"
summary "- Packaged \`$name.zip\`"

(
    cd "$output"
    shasum -a 256 "$name.zip" > SHA256SUMS.txt
    cat SHA256SUMS.txt
)
