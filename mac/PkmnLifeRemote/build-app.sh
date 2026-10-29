#!/bin/bash
# Builds "Pkmn Life Remote.app" in ./dist: the release binary and Info.plist, signed so macOS runs it.
#
#   ./build-app.sh                  signed ad hoc, with no certificate: runs on this Mac, and on another after
#                                   right-click > Open. CI's ordinary build is this.
#   ./build-app.sh --developer-id   signed with your Developer ID Application identity from the keychain, with the
#                                   hardened runtime and a secure timestamp (what notarization needs). Then
#                                   open "dist/Pkmn Life Remote.app", or drag it to /Applications.
#   ./build-app.sh --developer-id --notarize PROFILE
#                                   also send it to Apple's notary service with a notarytool keychain profile (made
#                                   once: xcrun notarytool store-credentials PROFILE), staple the ticket, check it as
#                                   Gatekeeper would, and zip the stapled app as dist/PkmnLifeRemote.zip
#
# Options:
#   --version X.Y.Z   the built app's CFBundleShortVersionString, and --build N its CFBundleVersion (default: those in
#   --build N         Support/Info.plist). Only the copy in dist/ changes. The release workflow sets both.
#   --team-id ID      sign with this team's Developer ID identity (default $MAC_TEAM_ID); needed only when the
#                     keychain has more than one
#   --identity ID     sign with this identity: its SHA-1 hash or full name (implies --developer-id)
#   --sign-only       don't build: sign the app already in dist/. The release workflow builds in one step and signs in
#                     the next, the only one that has the certificate.
#
# Ends by printing the signature's authority, team, timestamp and flags. ../RELEASE.md covers signed releases.
set -euo pipefail
script="$(cd "$(dirname "$0")" && pwd)/$(basename "$0")"
cd "$(dirname "$script")"

app="dist/Pkmn Life Remote.app"
developer_id=0
notary_profile=""
version=""
build=""
team_id="${MAC_TEAM_ID:-}"
identity=""
sign_only=0

usage() { sed -n '2,/^set -euo/p' "$script" | sed '$d' | sed -E 's/^# ?//'; }
fail() { echo "build-app.sh: $*" >&2; exit 1; }

while (( $# )); do
    case "$1" in
        --developer-id) developer_id=1 ;;
        --notarize) notary_profile="${2-}"; shift ;;
        --version) version="${2-}"; shift ;;
        --build) build="${2-}"; shift ;;
        --team-id) team_id="${2-}"; shift ;;
        --identity) identity="${2-}"; developer_id=1; shift ;;
        --sign-only) sign_only=1 ;;
        -h|--help) usage; exit 0 ;;
        *) usage >&2; fail "unknown option: $1" ;;
    esac
    shift
done

[[ -z "$version" || "$version" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]] || fail "--version is X.Y.Z, not '$version'"
[[ -z "$build" || "$build" =~ ^[0-9]+(\.[0-9]+){0,2}$ ]] || fail "--build is a number such as 42, not '$build'"
[[ -z "$team_id" || "$team_id" =~ ^[A-Z0-9]{10}$ ]] || fail "--team-id is the 10-character team ID, not '$team_id'"
if (( sign_only )) && [[ -n "$version$build" ]]; then
    fail "--version and --build are set when building; drop --sign-only"
fi
if [[ -n "$notary_profile" ]] && (( ! developer_id )); then
    fail "--notarize needs --developer-id: Apple notarizes only Developer ID signed apps"
fi

if (( sign_only )); then
    [[ -d "$app" ]] || fail "no $app to sign: build it first"
else
    swift build -c release
    bin="$(swift build -c release --show-bin-path)/PkmnLifeRemote"
    rm -rf "$app"
    mkdir -p "$app/Contents/MacOS"
    cp "$bin" "$app/Contents/MacOS/PkmnLifeRemote"
    cp Support/Info.plist "$app/Contents/Info.plist"
    if [[ -n "$version" ]]; then
        /usr/libexec/PlistBuddy -c "Set :CFBundleShortVersionString $version" "$app/Contents/Info.plist"
    fi
    if [[ -n "$build" ]]; then
        /usr/libexec/PlistBuddy -c "Set :CFBundleVersion $build" "$app/Contents/Info.plist"
    fi
fi

if (( developer_id )); then
    if [[ -z "$identity" ]]; then
        # The valid Developer ID Application identities on the keychain search list (the login keychain on a desk
        # Mac; in the release workflow, the temporary keychain Tools/ci/secrets.sh adds), as "<SHA-1> <name>", one per
        # certificate even when it's in two keychains.
        found="$(security find-identity -v -p codesigning \
            | sed -n -E 's/^ *[0-9]+\) ([0-9A-F]{40}) "(Developer ID Application: .*)"$/\1 \2/p' | sort -u)"
        if [[ -n "$team_id" ]]; then found="$(printf '%s\n' "$found" | grep -F "($team_id)" || true)"; fi
        count="$(printf '%s\n' "$found" | grep -c . || true)"
        if (( count == 0 )); then
            fail "no valid Developer ID Application identity${team_id:+ for team $team_id} in the keychain (security find-identity -v -p codesigning)"
        elif (( count > 1 )); then
            printf '%s\n' "$found" >&2
            fail "more than one Developer ID Application identity: choose one with --team-id or --identity"
        fi
        identity="${found%% *}"
        echo "Signing as ${found#* } ($identity)"
    fi
    # The hardened runtime and a secure timestamp (from Apple's server, so this needs the network): both required for
    # notarization. The app needs no entitlements (../RELEASE.md, Signing).
    codesign --force --options runtime --timestamp --sign "$identity" "$app"
else
    codesign --force --sign - "$app"
fi
codesign --verify --deep --strict --verbose=2 "$app"

if [[ -n "$notary_profile" ]]; then
    zip="dist/PkmnLifeRemote.zip"
    rm -f "$zip"
    ditto -c -k --keepParent "$app" "$zip"
    echo "Sending $zip to Apple's notary service (profile $notary_profile); this usually takes a few minutes"
    # The JSON result decides, not the exit status: an Invalid submission is still an answer.
    result="$(xcrun notarytool submit "$zip" --keychain-profile "$notary_profile" --wait --output-format json)" || true
    id="$(printf '%s' "$result" | plutil -extract id raw -o - - 2>/dev/null || true)"
    status="$(printf '%s' "$result" | plutil -extract status raw -o - - 2>/dev/null || true)"
    [[ -n "$id" ]] || { printf '%s\n' "$result" >&2; fail "couldn't submit $zip (is the profile $notary_profile there?)"; }
    echo "Notarization: ${status:-no answer} (submission $id)"
    if [[ "$status" != Accepted ]]; then
        xcrun notarytool log "$id" --keychain-profile "$notary_profile" >&2 || true
        fail "notarization wasn't accepted; Apple's log is above"
    fi
    xcrun stapler staple "$app"
    xcrun stapler validate "$app"
    spctl --assess --type execute --verbose=2 "$app"
    # Again, now with the ticket inside.
    rm -f "$zip"
    ditto -c -k --keepParent "$app" "$zip"
    echo "Notarized and stapled: $zip"
fi

codesign -dv --verbose=2 "$app" 2>&1 | grep -E '^(Identifier|Authority|TeamIdentifier|Timestamp|Signature)=|^CodeDirectory' || true
echo "Built $app"
