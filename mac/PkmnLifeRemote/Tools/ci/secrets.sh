#!/bin/bash
# Turns the release secrets into short-lived files on the runner, and removes them afterwards.
#
#   Tools/ci/secrets.sh run -- COMMAND [ARGUMENTS...]
#                              set up as below, run COMMAND with the outputs in its environment, then clean up,
#                              whatever COMMAND's outcome (also on SIGINT/SIGTERM). mac-release.yml wraps each step
#                              that needs a secret in this, so the key file and the keychain exist only while that
#                              step runs.
#   Tools/ci/secrets.sh setup  the same set-up on its own (outputs go to $GITHUB_ENV when it's set, otherwise printed)
#   Tools/ci/secrets.sh cleanup
#                              delete the keychain (restoring the keychain search list) and the files; safe to run more
#                              than once, and when setup never ran
#
# Inputs (environment; in mac-release.yml these come from the `release` environment's secrets). Each step gets only
# the ones it needs, and setup handles whichever are there (at least one):
#   ASC_KEY_ID, ASC_ISSUER_ID     App Store Connect API key ID and issuer ID      } notarization
#   ASC_KEY_P8_BASE64             the AuthKey_<id>.p8 file, base64-encoded        } (raw PEM is accepted too)
#   DEVELOPER_ID_P12_BASE64       the Developer ID Application certificate and    } signing
#   DEVELOPER_ID_P12_PASSWORD       private key exported as .p12, base64-encoded, and its password
#   MAC_TEAM_ID                   optional: the imported identity must be this team's
#   MAC_SECRETS_DIR               where the files go (default $RUNNER_TEMP/mac-release-secrets)
#
# Outputs:
#   MAC_ASC_KEY_PATH, MAC_ASC_KEY_ID, MAC_ASC_ISSUER_ID   with the API key; read by package-mac.sh
#   MAC_SIGNING_KEYCHAIN          with the .p12: the temporary keychain, which is also put on the keychain search
#                                 list, so codesign (build-app.sh --developer-id) finds the identity
#
# The directory is mode 700 and every file 600. The .p12 is deleted as soon as it's imported; the keychain's random
# password exists only in this process and the keychain itself. Passwords reach `security` on its standard input
# (`security -i`), never on a command line, where `ps` would show them.
set -euo pipefail

dir="${MAC_SECRETS_DIR:-${RUNNER_TEMP:-${TMPDIR:-/tmp}}/mac-release-secrets}"
keychain="$dir/mac-signing.keychain-db"
search_list="$dir/keychain-search-list"
# Apple's Developer ID intermediate (G2). Certificates issued since 2021 chain through it, and macOS ships only the
# older one, so codesign can't build the chain without it.
g2_url="https://www.apple.com/certificateauthority/DeveloperIDG2CA.cer"
g2_sha256="f16cd3c54c7f83cea4bf1a3e6a0819c8aaa8e4a1528fd144715f350643d2df3a"

fail() { echo "secrets.sh: $*" >&2; exit 1; }
note() { echo "secrets.sh: $*" >&2; }

in_process=0
export_env() {
    if (( in_process )); then
        export "$1=$2"
    elif [[ -n "${GITHUB_ENV:-}" ]]; then
        printf '%s=%s\n' "$1" "$2" >> "$GITHUB_ENV"
    else
        printf 'export %s=%q\n' "$1" "$2"
    fi
}

# sec_arg VALUE: VALUE quoted as one argument for `security -i`, which splits its input like a shell: inside double
# quotes, \\ and \" stand for \ and ".
sec_arg() {
    [[ "$1" != *$'\n'* ]] || fail "a keychain argument can't contain a line break"
    printf '"%s"' "$(printf '%s' "$1" | sed -e 's/\\/\\\\/g' -e 's/"/\\"/g')"
}

# security_stdin COMMAND: runs one `security` command read from standard input. `security -i` exits 0 even when the
# command fails, so its "<command>: returned <status>" line decides.
security_stdin() {
    local output
    if ! output="$(printf '%s\n' "$1" | security -i 2>&1)" \
        || printf '%s\n' "$output" | grep -qE ': returned -?[0-9]+$'; then
        printf '%s\n' "$output" >&2
        return 1
    fi
    if [[ -n "$output" ]]; then printf '%s\n' "$output"; fi
}

decode_to() {
    # decode_to FILE VALUE: base64 (or PEM text, for the API key) into FILE.
    local file="$1" value="$2"
    if [[ "$value" == -----BEGIN* ]]; then
        printf '%s\n' "$value" > "$file"
    else
        printf '%s' "$value" | tr -d ' \n\r\t' | base64 -d > "$file" 2>/dev/null \
            || fail "couldn't base64-decode the secret for $(basename "$file")"
    fi
    chmod 600 "$file"
}

# require NAME...: fails unless each variable is set and not empty. (Not `: "${NAME:?}"`: under an EXIT trap, bash 3.2,
# macOS's /bin/bash, exits 0 when that expansion fails, so `run` would skip its command and report success.)
require() {
    local name
    for name in "$@"; do
        [[ -n "${!name:-}" ]] || fail "$name is required (a secret in the release environment)"
    done
}

setup_api_key() {
    require ASC_KEY_ID ASC_ISSUER_ID
    [[ "$ASC_KEY_ID" =~ ^[A-Z0-9]{10}$ ]] || fail "ASC_KEY_ID should be the 10-character key ID"

    # notarytool looks for AuthKey_<id>.p8 by that name in some code paths; keep it.
    local key="$dir/AuthKey_$ASC_KEY_ID.p8"
    decode_to "$key" "$ASC_KEY_P8_BASE64"
    grep -q -- '-----BEGIN PRIVATE KEY-----' "$key" || fail "ASC_KEY_P8_BASE64 isn't a .p8 private key"
    openssl pkey -in "$key" -noout 2>/dev/null || fail "ASC_KEY_P8_BASE64 doesn't parse as a private key"
    export_env MAC_ASC_KEY_PATH "$key"
    export_env MAC_ASC_KEY_ID "$ASC_KEY_ID"
    export_env MAC_ASC_ISSUER_ID "$ASC_ISSUER_ID"
    note "App Store Connect API key $ASC_KEY_ID written to $key"
}

setup_keychain() {
    [[ "$(uname)" == Darwin ]] || fail "a keychain needs macOS"
    require DEVELOPER_ID_P12_PASSWORD
    [[ "$DEVELOPER_ID_P12_PASSWORD" != *$'\n'* ]] || fail "DEVELOPER_ID_P12_PASSWORD can't contain a line break"

    local p12="$dir/developer-id.p12" password
    decode_to "$p12" "$DEVELOPER_ID_P12_BASE64"
    password="$(openssl rand -hex 24)"

    security list-keychains -d user | sed -E 's/^[[:space:]]*"?//; s/"?[[:space:]]*$//' > "$search_list"
    security delete-keychain "$keychain" 2>/dev/null || true
    security_stdin "create-keychain -p $(sec_arg "$password") $(sec_arg "$keychain")" \
        || fail "couldn't create the keychain"
    # Lock after an hour of inactivity, longer than any step that uses it; `run` deletes it sooner.
    security set-keychain-settings -ut 3600 "$keychain"
    security_stdin "unlock-keychain -p $(sec_arg "$password") $(sec_arg "$keychain")" \
        || fail "couldn't unlock the keychain"
    local current=() line
    while IFS= read -r line; do [[ -n "$line" ]] && current+=("$line"); done < "$search_list"
    # (bash 3.2 treats an empty array as unset under `set -u`, hence the ${a[@]+...} form)
    security list-keychains -d user -s "$keychain" ${current[@]+"${current[@]}"}

    if ! security_stdin "import $(sec_arg "$p12") -k $(sec_arg "$keychain") -f pkcs12 -P $(sec_arg "$DEVELOPER_ID_P12_PASSWORD") -T /usr/bin/codesign -T /usr/bin/security" >/dev/null; then
        rm -f "${p12:?}"
        fail "couldn't import the .p12 (is DEVELOPER_ID_P12_PASSWORD its password?)"
    fi
    rm -f "${p12:?}"
    # Let codesign use the key without a prompt.
    security_stdin "set-key-partition-list -S apple-tool:,apple:,codesign: -s -k $(sec_arg "$password") $(sec_arg "$keychain")" >/dev/null \
        || fail "couldn't allow codesign to use the key"

    local g2="$dir/DeveloperIDG2CA.cer"
    if curl -fsSL --retry 3 -o "$g2" "$g2_url" \
        && [[ "$(shasum -a 256 "$g2" | awk '{print $1}')" == "$g2_sha256" ]]; then
        security import "$g2" -k "$keychain" >/dev/null 2>&1 || true
    else
        note "warning: couldn't fetch Apple's Developer ID G2 intermediate; signing works only if the certificate chains through the older one"
    fi
    rm -f "${g2:?}"

    local identities wanted='"Developer ID Application: '
    identities="$(security find-identity -v -p codesigning "$keychain")"
    printf '%s\n' "$identities" | grep -q "$wanted" \
        || fail "the .p12 has no valid Developer ID Application identity: $identities"
    if [[ -n "${MAC_TEAM_ID:-}" ]]; then
        printf '%s\n' "$identities" | grep "$wanted" | grep -qF "($MAC_TEAM_ID)\"" \
            || fail "the .p12's Developer ID Application identity isn't team $MAC_TEAM_ID's: $identities"
    fi
    export_env MAC_SIGNING_KEYCHAIN "$keychain"
    note "imported into $keychain:"
    printf '%s\n' "$identities" | grep "$wanted" >&2
}

setup() {
    [[ -n "${ASC_KEY_P8_BASE64:-}" || -n "${DEVELOPER_ID_P12_BASE64:-}" ]] \
        || fail "nothing to set up: give it ASC_KEY_P8_BASE64 (notarization) or DEVELOPER_ID_P12_BASE64 (signing), secrets in the release environment"
    umask 077
    mkdir -p "$dir"
    chmod 700 "$dir"
    if [[ -n "${ASC_KEY_P8_BASE64:-}" ]]; then setup_api_key; fi
    if [[ -n "${DEVELOPER_ID_P12_BASE64:-}" ]]; then setup_keychain; fi
}

cleanup() {
    if [[ -f "$keychain" || -f "$search_list" ]] && command -v security >/dev/null; then
        if [[ -s "$search_list" ]]; then
            local previous=() line
            while IFS= read -r line; do [[ -n "$line" ]] && previous+=("$line"); done < "$search_list"
            security list-keychains -d user -s ${previous[@]+"${previous[@]}"} || true
        fi
        security delete-keychain "$keychain" 2>/dev/null || true
        note "deleted the temporary keychain"
    fi
    if [[ -d "$dir" ]]; then
        rm -rf "${dir:?}"
        note "removed $dir"
    fi
}

run() {
    [[ "${1-}" == -- ]] && shift
    (( $# )) || { echo "usage: $0 run -- COMMAND [ARGUMENTS...]" >&2; exit 2; }
    in_process=1
    # Leftovers of a step that was killed before it could clean up.
    cleanup 2>/dev/null
    trap 'cleanup' EXIT
    trap 'exit 130' INT
    trap 'exit 143' TERM
    setup
    local status=0
    "$@" || status=$?
    exit "$status"
}

case "${1-}" in
    run) shift; run "$@" ;;
    setup) setup ;;
    cleanup) cleanup ;;
    *) echo "usage: $0 run -- COMMAND... | setup | cleanup" >&2; exit 2 ;;
esac
