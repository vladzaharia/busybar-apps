#!/bin/bash
# Configures GitHub for the release workflow's Mac job (release.yml): the `release` environment (deployments from the
# default branch and v* tags only; required reviewers when GitHub allows them), its secrets, the
# MAC_TEAM_ID repository variable, a read-only default workflow token, and optionally a ruleset for the release tags.
# Prints the plan and changes nothing unless --apply is given.
#
#   mac/PkmnLifeRemote/Tools/ci/setup-github.sh --asc-key ~/keys/AuthKey_ABC123DEFG.p8 --asc-issuer-id <uuid> \
#       --developer-id-p12 ~/keys/developer-id.p12 [--reviewer vladzaharia] [--protect-tags] [--apply]
#
# Options:
#   --repo OWNER/NAME          default vladzaharia/busybar-apps
#   --asc-key FILE             the App Store Connect API key (.p8), downloaded once from App Store Connect
#   --asc-key-id ID            default: from the file name AuthKey_<ID>.p8
#   --asc-issuer-id UUID       App Store Connect > Users and Access > Integrations > Team Keys, "Issuer ID"
#   --developer-id-p12 FILE    the Developer ID Application certificate and its private key, exported from Keychain
#                              Access (mac/RELEASE.md, One-time setup). Its password comes from
#                              $DEVELOPER_ID_P12_PASSWORD, or a prompt with --apply.
#   --team-id ID               default 48H7CLBV8Y
#   --reviewer LOGIN           who approves release runs (repeatable; default the repository owner). GitHub allows
#                              required reviewers on a private repository only on GitHub Enterprise, so on a private
#                              repository they are left out (with a note) unless --force-reviewers is given.
#   --force-reviewers          ask for required reviewers even on a private repository
#   --protect-tags             also add a tag ruleset: only admins create, move, or delete v* (release) tags
#   --apply                    make the changes. Without it, nothing is sent to GitHub but two reads (the default
#                              branch and the visibility).
#
# Needs gh, authenticated as a repository admin (`gh auth status`). Secret values go to gh on stdin, never on a command
# line, and are never printed. Re-running it is safe: it sets everything again and adds only missing policies.
set -euo pipefail

repo="vladzaharia/busybar-apps"
asc_key=""
asc_key_id=""
asc_issuer_id=""
p12=""
team_id="48H7CLBV8Y"
reviewers=()
force_reviewers=0
protect_tags=0
apply=0
environment="release"
tag_pattern="v*"

usage() { sed -n '2,/^set -euo/p' "$0" | sed '$d' | sed -E 's/^# ?//'; }
fail() { echo "setup-github.sh: $*" >&2; exit 1; }

while (( $# )); do
    case "$1" in
        --repo) repo="${2-}"; shift ;;
        --asc-key) asc_key="${2-}"; shift ;;
        --asc-key-id) asc_key_id="${2-}"; shift ;;
        --asc-issuer-id) asc_issuer_id="${2-}"; shift ;;
        --developer-id-p12) p12="${2-}"; shift ;;
        --team-id) team_id="${2-}"; shift ;;
        --reviewer) reviewers+=("${2-}"); shift ;;
        --force-reviewers) force_reviewers=1 ;;
        --protect-tags) protect_tags=1 ;;
        --apply) apply=1 ;;
        -h|--help) usage; exit 0 ;;
        *) usage >&2; fail "unknown option: $1" ;;
    esac
    shift
done

# --- Validate local inputs (nothing leaves this Mac here) ----------------------------------------------------------
[[ "$repo" =~ ^[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+$ ]] || fail "--repo must be OWNER/NAME"
[[ -n "$asc_key" && -n "$p12" ]] || { usage >&2; fail "--asc-key and --developer-id-p12 are required"; }
[[ -r "$asc_key" ]] || fail "can't read $asc_key"
grep -q -- '-----BEGIN PRIVATE KEY-----' "$asc_key" || fail "$asc_key isn't an App Store Connect .p8 key"
openssl pkey -in "$asc_key" -noout 2>/dev/null || fail "$asc_key doesn't parse as a private key"
if [[ -z "$asc_key_id" ]]; then
    base="$(basename "$asc_key")"
    [[ "$base" =~ ^AuthKey_([A-Z0-9]{10})\.p8$ ]] && asc_key_id="${BASH_REMATCH[1]}"
fi
[[ "$asc_key_id" =~ ^[A-Z0-9]{10}$ ]] || fail "pass --asc-key-id (the 10-character key ID)"
[[ "$asc_issuer_id" =~ ^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$ ]] \
    || fail "--asc-issuer-id must be the issuer UUID"
[[ "$team_id" =~ ^[A-Z0-9]{10}$ ]] || fail "--team-id must be the 10-character team ID"
[[ -r "$p12" ]] || fail "can't read $p12"
(( ${#reviewers[@]} )) || reviewers=("${repo%%/*}")

# --- Plan and execution helpers ------------------------------------------------------------------------------------
step=0
say() { step=$(( step + 1 )); printf '\n%d. %s\n' "$step" "$*"; }
show() { printf '   $'; printf ' %q' "$@"; printf '\n'; }
# run CMD...: print it, and run it with --apply.
run() { show "$@"; if (( apply )); then "$@"; fi; }
# secret NAME DESCRIPTION: the value is read from the function `value_<NAME>` and piped to gh.
secret() {
    local name="$1" description="$2"
    printf '   $ <%s> | gh secret set %s --env %s --repo %s\n' "$description" "$name" "$environment" "$repo"
    if (( apply )); then
        "value_$name" | gh secret set "$name" --env "$environment" --repo "$repo"
    fi
}
value_ASC_KEY_ID() { printf '%s' "$asc_key_id"; }
value_ASC_ISSUER_ID() { printf '%s' "$asc_issuer_id"; }
value_ASC_KEY_P8_BASE64() { base64 < "$asc_key" | tr -d '\n'; }
value_DEVELOPER_ID_P12_BASE64() { base64 < "$p12" | tr -d '\n'; }
value_DEVELOPER_ID_P12_PASSWORD() { printf '%s' "$p12_password"; }

# Two reads, also in a dry run, so the plan names the real branch: the default branch and the visibility.
default_branch="<default branch>"
visibility="<visibility>"
if command -v gh >/dev/null && gh auth status >/dev/null 2>&1; then
    default_branch="$(gh repo view "$repo" --json defaultBranchRef --jq .defaultBranchRef.name)"
    visibility="$(gh repo view "$repo" --json visibility --jq .visibility)"
elif (( apply )); then
    fail "gh is required and must be logged in: brew install gh && gh auth login"
fi

p12_password=""
if (( apply )); then
    p12_password="${DEVELOPER_ID_P12_PASSWORD:-}"
    if [[ -z "$p12_password" ]]; then
        read -r -s -p "Password for $p12: " p12_password
        echo
    fi
    [[ -n "$p12_password" ]] || fail "the .p12 needs its password"
    # Check the password, and that there is a Developer ID Application certificate, before storing anything (this
    # reads the file locally only). Keychain Access exports use ciphers OpenSSL 3 calls legacy; LibreSSL reads them
    # without the flag.
    export DEVELOPER_ID_P12_PASSWORD="$p12_password"
    certificates="$(openssl pkcs12 -in "$p12" -passin env:DEVELOPER_ID_P12_PASSWORD -nokeys 2>/dev/null \
        || openssl pkcs12 -legacy -in "$p12" -passin env:DEVELOPER_ID_P12_PASSWORD -nokeys 2>/dev/null)" \
        || fail "the password doesn't open $p12"
    printf '%s\n' "$certificates" | grep -q "Developer ID Application: .*($team_id)" \
        || fail "$p12 holds no Developer ID Application certificate for team $team_id"
    echo "Applying to $repo (default branch $default_branch, $visibility)."
else
    echo "Dry run for $repo (default branch $default_branch, $visibility): printing the plan; nothing is changed."
fi

# --- 1. Actions -----------------------------------------------------------------------------------------------------
say "Actions: workflows get a read-only GITHUB_TOKEN by default and can't approve pull requests (each job asks for more)"
run gh api -X PUT "repos/$repo/actions/permissions/workflow" \
    -f default_workflow_permissions=read -F can_approve_pull_request_reviews=false

# --- 2. The release environment ------------------------------------------------------------------------------------
reviewer_json=""
if [[ "$visibility" == PUBLIC || "$force_reviewers" == 1 ]]; then
    say "Environment '$environment': required reviewers (${reviewers[*]}); deployments only from $default_branch and $tag_pattern tags"
    for login in "${reviewers[@]}"; do
        show gh api "users/$login" --jq .id
        if (( apply )); then
            id="$(gh api "users/$login" --jq .id)"
        else
            id="<id of $login>"
        fi
        reviewer_json+="${reviewer_json:+,}{\"type\":\"User\",\"id\":${id}}"
    done
else
    say "Environment '$environment': deployments only from $default_branch and $tag_pattern tags"
    echo "   (no required reviewers: on a $visibility repository GitHub allows them only on GitHub Enterprise; make it"
    echo "   public, or pass --force-reviewers if the plan allows it. The branch and tag policies still apply.)"
fi
environment_body="{\"wait_timer\":0,\"prevent_self_review\":false,\"reviewers\":[${reviewer_json}],\"deployment_branch_policy\":{\"protected_branches\":false,\"custom_branch_policies\":true}}"
printf "   \$ echo '%s' | gh api -X PUT repos/%s/environments/%s --input -\n" "$environment_body" "$repo" "$environment"
if (( apply )); then
    printf '%s' "$environment_body" | gh api -X PUT "repos/$repo/environments/$environment" --input - >/dev/null
fi

existing=""
show gh api "repos/$repo/environments/$environment/deployment-branch-policies" --jq '.branch_policies[] | "\(.type):\(.name)"'
if (( apply )); then
    existing="$(gh api "repos/$repo/environments/$environment/deployment-branch-policies" --jq '.branch_policies[] | "\(.type):\(.name)"')"
fi
for policy in "branch:$default_branch" "tag:$tag_pattern"; do
    if printf '%s\n' "$existing" | grep -qxF "$policy"; then
        echo "   (policy $policy already exists)"
        continue
    fi
    run gh api -X POST "repos/$repo/environments/$environment/deployment-branch-policies" \
        -f name="${policy#*:}" -f type="${policy%%:*}" --silent
done

# --- 3. Secrets (environment-scoped: only jobs in the release environment can read them) ---------------------------
say "Secrets in '$environment': the App Store Connect API key (notarization)"
secret ASC_KEY_ID "$asc_key_id"
secret ASC_ISSUER_ID "issuer ID $asc_issuer_id"
secret ASC_KEY_P8_BASE64 "base64 of $asc_key"
say "Secrets in '$environment': the Developer ID Application identity (signing)"
secret DEVELOPER_ID_P12_BASE64 "base64 of $p12"
secret DEVELOPER_ID_P12_PASSWORD "its password, from \$DEVELOPER_ID_P12_PASSWORD or a prompt"

# --- 4. Variables --------------------------------------------------------------------------------------------------
say "Repository variable: the team whose Developer ID identity signs releases"
run gh variable set MAC_TEAM_ID --body "$team_id" --repo "$repo"

# --- 5. Optional tag protection ------------------------------------------------------------------------------------
if (( protect_tags )); then
    say "Tag ruleset: only repository admins create, move, or delete $tag_pattern tags"
    ruleset="{\"name\":\"Release tags\",\"target\":\"tag\",\"enforcement\":\"active\",\"conditions\":{\"ref_name\":{\"include\":[\"refs/tags/$tag_pattern\"],\"exclude\":[]}},\"rules\":[{\"type\":\"creation\"},{\"type\":\"update\"},{\"type\":\"deletion\"}],\"bypass_actors\":[{\"actor_id\":5,\"actor_type\":\"RepositoryRole\",\"bypass_mode\":\"always\"}]}"
    printf "   \$ echo '%s' | gh api -X POST repos/%s/rulesets --input -\n" "$ruleset" "$repo"
    if (( apply )); then
        if gh api "repos/$repo/rulesets" --jq '.[].name' | grep -qxF "Release tags"; then
            echo "   (ruleset 'Release tags' already exists)"
        else
            printf '%s' "$ruleset" | gh api -X POST "repos/$repo/rulesets" --input - --silent
        fi
    fi
fi

echo
if (( apply )); then
    echo "Done. Check Settings > Environments > $environment, then cut a release (mac/RELEASE.md)."
else
    echo "Nothing was changed. Re-run with --apply to make these changes."
fi
