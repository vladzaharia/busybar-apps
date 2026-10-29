# Releasing Pkmn Life Remote

Releases of the Mac app are signed with Developer ID, notarized by Apple and stapled, so they open with a double-click
on any Mac with macOS 26 or later, with no right-click → Open. GitHub Actions makes them: push a `remote-vX.Y.Z` tag and
the **Mac release** workflow (`.github/workflows/mac-release.yml`) builds the app, signs it, notarizes it, and attaches
it to a GitHub Release.

It is modelled on Daybook's release pipeline (`vladzaharia/daybook`, `docs/release.md`), less what a SwiftPM app with
no App Store side doesn't need: no Xcode project or XcodeGen, no iPhone or TestFlight, and no cloud-managed signing
(the Developer ID certificate always comes from a `.p12`, Daybook's fallback). Also left out: a DMG (it needs a second
notarization, for an app that installs as well from a ZIP) and resuming a notarization an earlier attempt left pending
(this app's notarization takes minutes; a re-run simply submits again).

## Pipeline

| Workflow | Job | Runner | What it does |
| --- | --- | --- | --- |
| CI (`ci.yml`) | `mac` | `xcode-27` | `swift test`, `./build-app.sh` (signed ad hoc), `Tools/ci/check-app.sh --kind adhoc`, the `pkmn-life-remote` artifact |
| CI | `mac-kit` | `ubuntu-latest` | `swift test` on Linux (PkmnLifeRemoteKit only) |
| CI | `lint` | `ubuntu-24.04` | actionlint 1.7.12 (pinned, checksum-verified; it runs shellcheck on every `run:` block) and shellcheck on the scripts |
| Mac visual check (`mac-visual.yml`) | `screens` | `xcode-27` | `Tools/screenshots.sh` |
| Mac release (`mac-release.yml`) | `prepare` | `ubuntu-24.04` | checks the ref (`check-ref.sh`), works out the version (`version.sh`), writes the notes (`release-notes.sh`) |
| Mac release | `mac` | `xcode-27`, environment `release` | `swift test`; build; sign with Developer ID; notarize, staple, check, zip (`package-mac.sh`); attest (public repositories); the `mac-release` artifact |
| Mac release | `release` | `ubuntu-24.04` | tags only: a draft GitHub Release with the ZIP and `SHA256SUMS.txt`, then published (`github-release.sh`) |

The scripts are in `PkmnLifeRemote/Tools/ci/`, next to the app they build, so the Mac visual check (which runs on
pull requests touching `mac/`) runs when they change. Each prints its usage with `--help`.

## Runner and Xcode

- Every Mac job runs on `runs-on: xcode-27`, the Xcode 27 image (a public preview,
  [actions/runner-images#14404](https://github.com/actions/runner-images/issues/14404)), the same label Daybook uses.
- `Tools/ci/select-xcode.sh` selects `/Applications/Xcode_27.1.app` (27.1, build 27A9275; `Xcode.app` on that image is
  27.0) by setting `DEVELOPER_DIR` for the later steps, and fails if the version isn't 27.1 or a 27.1.x patch. It
  writes the Xcode and Swift versions to the run summary. The app is developed with the same Xcode (27.1, 27A9275,
  Swift 6.4).
- The release also requires the exact build: the `MAC_RELEASE_XCODE_BUILD` repository variable, `27A9275` when unset.
  When the image moves to a new build, the release fails (CI doesn't) until someone has seen CI pass with it and set
  the variable.
- If the image drops `Xcode_27.1.app`, change the default at the top of `select-xcode.sh` (one place for every job).

## Signing

The app is signed with the **Developer ID Application** identity of team `48H7CLBV8Y`, with the hardened runtime and a
secure timestamp from Apple: `codesign --force --options runtime --timestamp --sign <identity>`. Scripts never name the
identity: `build-app.sh --developer-id` takes the one valid Developer ID Application identity on the keychain search
list, narrowed to the team in `MAC_TEAM_ID` (or `--team-id`), and signs with its SHA-1 hash.

The app needs **no entitlements**, and isn't sandboxed (checked against the sources, 2026-10-28):

- It talks to the bar with `URLSession` (`BarClient`), plain HTTP on the local network. That needs the App Transport
  Security exceptions and `NSLocalNetworkUsageDescription` in `Support/Info.plist`, not an entitlement.
- It keeps the bar's API password as a generic password in the login keychain through Security.framework
  (`Keychain.swift`). The file-based keychain needs no keychain access group.
- It links only system frameworks and the Swift libraries in `/usr/lib/swift` (`otool -L`), so the hardened runtime's
  library validation passes. No JIT, unsigned memory, Apple Events, camera or microphone.

`Tools/ci/check-app.sh` fails a build that carries any entitlement, so adding one is a deliberate change: an
entitlements file passed to codesign in `build-app.sh`, and the check loosened to match.

A Developer ID build keeps the same identity from version to version. The first time it runs on a Mac that had an ad
hoc build, macOS asks once to let it read the saved bar password from the keychain (choose **Always Allow**), and may
ask again for local network access. Ad hoc builds change identity with every build; Developer ID builds don't, so
updates don't ask.

### Secrets on the runner

The signing material exists only in the steps that use it. Each such step gets its secrets in its environment and runs
its command inside `Tools/ci/secrets.sh run -- …`, which writes them for that command and deletes them when it ends,
however it ends:

| Step | API key | Developer ID `.p12` | Compiles code |
| --- | --- | --- | --- |
| Test, Build | | | yes |
| Sign with Developer ID | | yes: a temporary keychain | |
| Notarize, staple, and package | yes: `AuthKey_<id>.p8` | | |

- The `.p12` becomes a keychain with a random password, put on the search list for the signing step only; the `.p12`
  file is deleted once imported. Both passwords reach `security` on its standard input, never a command line. Apple's
  Developer ID G2 intermediate is added (downloaded, SHA-256 pinned), since the runner's macOS ships only the older
  one. Then it checks the keychain holds a valid Developer ID Application identity for `MAC_TEAM_ID`.
- The API key is written as a file (directory 700, file 600) for notarytool.
- Nothing reaches `$GITHUB_ENV`. A last `if: always()` step runs `secrets.sh cleanup` as a backstop, for a step that
  was killed before it could clean up.
- The job's first step checks that every secret and `MAC_TEAM_ID` are set (it sees only whether each is set, not its
  value), so a missing one fails before anything builds.

### Notarization

`package-mac.sh --notarize` checks the signature (`check-app.sh --kind developer-id`: Developer ID Application of team
`MAC_TEAM_ID`, hardened runtime, secure timestamp, no entitlements, the version and build), zips the app with
`ditto -c -k --keepParent`, and sends it with `xcrun notarytool submit --key … --key-id … --issuer …`. It waits up to
45 minutes (`notarytool wait --timeout`), writing the submission ID and the result to the run summary. Then:

- Accepted: `xcrun stapler staple`, `stapler validate`, `spctl -a -vv -t exec` (must say `source=Notarized Developer
  ID`), and `codesign --verify --deep --strict`. The stapled app is zipped again, the ZIP is unpacked into a temporary
  folder and checked the same way (signature and ticket intact), and `SHA256SUMS.txt` is written.
- Invalid or rejected: Apple's log is printed (it names each file and problem) and the job fails.
- Still in progress when the wait runs out: the job fails with the submission ID. Re-run it (below).

Any team key role can notarize (Admin, App Manager or Developer).

## Secrets and variables

Environment **`release`** secrets (the same names as Daybook's):

| Secret | Value |
| --- | --- |
| `ASC_KEY_ID` | the App Store Connect API key's 10-character Key ID |
| `ASC_ISSUER_ID` | the Issuer ID (a UUID, at the top of App Store Connect › Users and Access › Integrations › App Store Connect API) |
| `ASC_KEY_P8_BASE64` | `base64` of `AuthKey_<KeyID>.p8` (downloadable once, when the key is created) |
| `DEVELOPER_ID_P12_BASE64` | `base64` of the Developer ID Application certificate and its private key, exported as `.p12` |
| `DEVELOPER_ID_P12_PASSWORD` | the `.p12` password |

Repository **variables**:

| Variable | Value |
| --- | --- |
| `MAC_TEAM_ID` | `48H7CLBV8Y` (not a secret): the team whose Developer ID identity signs |
| `MAC_RELEASE_XCODE_BUILD` | optional: the exact Xcode build releases must use; unset means `27A9275` |

The `release` environment allows deployments only from the default branch and `remote-v*` tags. On a public
repository it also has required reviewers (the owner), so each release run waits for approval.

## One-time setup

By the owner, in order:

1. **GitHub Actions billing.** The only run in this repository so far was refused before any job started: "recent
   account payments have failed or your spending limit needs to be increased". Fix the payment method or the Actions
   spending limit in the account's Settings › Billing and plans. Nothing runs until then, CI included.
2. **Public or private.** What GitHub allows depends on it:

   | | Public (as Daybook) | Private, GitHub Pro or Team | Private, GitHub Free |
   | --- | --- | --- | --- |
   | Environment secrets and branch and tag policies | yes | yes | no: no `release` environment |
   | Required reviewers on the environment | yes | no (Enterprise only) | no |
   | Build provenance attestation | yes | no (Enterprise Cloud only): the step is skipped | no |
   | Tag ruleset (`--protect-tags`) | yes | yes | no |
   | macOS runner minutes | free | billed (a macOS minute costs about ten Linux ones) | billed |

   On a private repository the release still works (with Pro or Team): the branch and tag policies keep the secrets to
   runs from the default branch and `remote-v*` tags, and `prepare` refuses a tag that isn't on the default branch.
   The `xcode-27` image is a preview; whether private repositories get it is unverified.
3. **The App Store Connect API key.** App Store Connect › Users and Access › Integrations › App Store Connect API ›
   Team Keys: generate a key named e.g. "busybar-apps notarization" with **Developer** access (enough to notarize; a
   key of its own, so revoking Daybook's doesn't stop this one). Download `AuthKey_<KeyID>.p8` (only once) and note
   the Key ID and the Issuer ID.
4. **The Developer ID `.p12`.** In Keychain Access on this Mac, under My Certificates, select **Developer ID
   Application: Vlad Zaharia (48H7CLBV8Y)** (the certificate row, with its key under it) › Export, as `.p12`, with a
   strong password. The file is about 3 KB. On 2026-10-28 that Mac had one such certificate, issued through Apple's
   G2 intermediate and valid until June 2031, which is likely the one Daybook's `.p12` holds too.
5. **GitHub.** From the repository root, with `gh` logged in as the owner:

   ```sh
   mac/PkmnLifeRemote/Tools/ci/setup-github.sh --asc-key ~/Downloads/AuthKey_ABC123DEFG.p8 \
       --asc-issuer-id 69a6de70-0000-0000-0000-000000000000 \
       --developer-id-p12 ~/Downloads/developer-id.p12 --protect-tags     # prints the plan; changes nothing
   DEVELOPER_ID_P12_PASSWORD='…' mac/PkmnLifeRemote/Tools/ci/setup-github.sh … --apply
   ```

   It sets a read-only default `GITHUB_TOKEN` for workflows (every job here asks for what it needs), creates the
   `release` environment with its deployment policies (the current default branch, read from GitHub, and `remote-v*`
   tags) and, on a public repository, required reviewers; stores the five secrets (values go to `gh` on standard
   input, never on a command line); sets `MAC_TEAM_ID`; and with `--protect-tags` adds a ruleset so only admins
   create, move or delete `remote-v*` tags. Before storing anything it checks the `.p12`'s password and that it holds
   a Developer ID Application certificate for the team. Delete the local `.p8` and `.p12` afterwards, or keep them
   only in a password manager.

   If the default branch is renamed (to `main`, say), run it again: it adds the new branch's policy. Remove the old
   one under Settings › Environments › `release`.

## Cutting a release

From a commit on the default branch that has been pushed and whose CI passed. The tag must point at a commit on the
default branch: `prepare` checks it (`git merge-base --is-ancestor`) and refuses anything else.

```sh
git tag -a remote-v0.2.0 -m "Pkmn Life Remote 0.2.0: the round buttons"
git push origin remote-v0.2.0
```

- On a public repository, approve the run: Actions › Mac release › Review deployments › `release` › Approve.
- The tag's message opens the release notes, followed by the commits since the previous `remote-v*` tag that touch
  `mac/`.
- The GitHub Release is created as a draft with `PkmnLifeRemote-0.2.0-macOS-arm64.zip` and `SHA256SUMS.txt`, then
  published, and becomes "Latest" unless it is a prerelease. A tag such as `remote-v0.2.0-rc.1` releases version
  0.2.0 as a prerelease.
- The BUSY Bar apps' tags (anything not `remote-v*`) don't start this workflow.

By hand, for a notarized build without a release (the files are on the run's page, in the `mac-release` artifact):

```sh
gh workflow run mac-release.yml --ref claude/busy-knuth-fqso2y -f version=0.2.0   # from the default branch
gh workflow run mac-release.yml --ref remote-v0.2.0                               # a tag: the full release
```

### Versions

- `CFBundleShortVersionString` comes from the tag: `remote-vX.Y.Z` gives `X.Y.Z` (from the default branch, the
  `version` input). `CFBundleVersion` is the Mac release workflow's run number, which only grows.
- Both are set with PlistBuddy in the built bundle (`build-app.sh --version --build`); `Support/Info.plist` in git
  keeps its own (0.1.0, build 1), which local builds use.
- The build is `arm64` only (the runner's architecture), hence `-macOS-arm64` in the file name.

### Re-running

- **Re-run failed jobs** re-runs the failed jobs and the ones after them (after approval, on a public repository).
  The version and build number stay the run's.
- A `mac` job whose notarization was still in progress builds, signs and submits again; the earlier submission
  finishes on Apple's side unused. `xcrun notarytool info <id>` (with the key) says how it ended.
- The `release` job updates its own draft (title, notes, prerelease flag, files; stale files are deleted). A published
  release is never changed: the job fails rather than swap files people may have downloaded. Ship a fix as a new
  version, or unpublish first (`gh release edit remote-v0.2.0 --draft=true`) and re-run.

### Verifying a download

```sh
shasum -a 256 -c SHA256SUMS.txt
ditto -x -k PkmnLifeRemote-0.2.0-macOS-arm64.zip .                # or double-click it
spctl -a -vv -t exec "Pkmn Life Remote.app"       # accepted, source=Notarized Developer ID
xcrun stapler validate "Pkmn Life Remote.app"
codesign --verify --deep --strict "Pkmn Life Remote.app"
gh attestation verify PkmnLifeRemote-0.2.0-macOS-arm64.zip --repo vladzaharia/busybar-apps \
    --signer-workflow vladzaharia/busybar-apps/.github/workflows/mac-release.yml   # public repository only
```

## Signing on your own Mac

`build-app.sh` signs ad hoc unless told otherwise, so it works without a certificate (and CI's ordinary build stays
ad hoc). With the Developer ID identity in your login keychain:

```sh
cd mac/PkmnLifeRemote
./build-app.sh --developer-id                             # hardened runtime, secure timestamp (needs the network)
./build-app.sh --developer-id --version 0.2.0 --build 7   # with a version and build in the bundle
```

To notarize locally too, store a notarytool profile once (an App Store Connect API key, or an Apple ID with an
app-specific password), then pass its name:

```sh
xcrun notarytool store-credentials pkmn-life-remote --key AuthKey_ABC123DEFG.p8 --key-id ABC123DEFG --issuer <uuid>
./build-app.sh --developer-id --notarize pkmn-life-remote   # also writes dist/PkmnLifeRemote.zip, stapled
```

macOS may ask once whether codesign can use the key in your keychain; choose Always Allow.

## Troubleshooting

| Symptom | Cause and fix |
| --- | --- |
| No job starts; "recent account payments have failed or your spending limit needs to be increased" | Account billing (One-time setup, step 1). |
| Jobs on `xcode-27` wait in the queue for a long time | The image is a preview with limited capacity. Wait, or re-run later. |
| `Xcode_27.1.app isn't installed on this runner`, or `expected Xcode 27.1` | The image changed. Update the default in `select-xcode.sh`. |
| Release: "Xcode 27.1 … is build 27A…, not 27A9275" | The image moved to another build. Once CI has passed with it, set `MAC_RELEASE_XCODE_BUILD`, and re-run. |
| "Set the … secret in the release environment" or "Set the MAC_TEAM_ID repository variable" | Run `setup-github.sh` (One-time setup, step 5). On a private repository on GitHub Free there are no environment secrets (step 2). |
| `secrets.sh`: "the .p12 has no valid Developer ID Application identity", or "isn't team …'s" | The `.p12` lacks the certificate or its key, or is another team's. Export the certificate row from My Certificates (about 3 KB). |
| `secrets.sh`: "couldn't import the .p12" | `DEVELOPER_ID_P12_PASSWORD` isn't its password. |
| `build-app.sh`: "more than one Developer ID Application identity" | Pick one with `--team-id` or `--identity <SHA-1>`. |
| codesign: "The timestamp service is not available" | Apple's timestamp server didn't answer. Re-run. |
| Notarization `Invalid` | The log printed above the error names each problem (unsigned code, no hardened runtime, no secure timestamp). |
| "Notarization still in progress" | Apple took longer than 45 minutes. Re-run the failed job ([Re-running](#re-running)). |
| `prepare`: "remote-v… points at …, which isn't on <branch>" | The tag is on a commit that isn't on the default branch (not merged, or not pushed). Delete the tag, merge and push, tag the merged commit. |
| `release`: "… is already published" | See [Re-running](#re-running). |
| "Attest build provenance" skipped | The repository is private (One-time setup, step 2). |

## Checking the pipeline locally

None of these needs a secret, or sends anything to Apple or GitHub:

```sh
actionlint                                                     # uses .github/actionlint.yaml
shellcheck mac/PkmnLifeRemote/build-app.sh mac/PkmnLifeRemote/Tools/*.sh mac/PkmnLifeRemote/Tools/ci/*.sh
cd mac/PkmnLifeRemote
Tools/ci/version.sh --ref refs/tags/remote-v1.2.3 --run-number 42
./build-app.sh --version 1.2.3 --build 42 && Tools/ci/check-app.sh --app "dist/Pkmn Life Remote.app" --kind adhoc
./build-app.sh --sign-only --developer-id                      # as the release's signing step, from your keychain
Tools/ci/check-app.sh --app "dist/Pkmn Life Remote.app" --kind developer-id --team-id 48H7CLBV8Y --version 1.2.3 --build 42
Tools/ci/package-mac.sh --app "dist/Pkmn Life Remote.app" --version 1.2.3 --build 42 --output /tmp/pkmn-release
Tools/ci/setup-github.sh --asc-key AuthKey_ABC123DEFG.p8 --asc-issuer-id <uuid> --developer-id-p12 developer-id.p12
```

`package-mac.sh` without `--notarize` packages the app as it is; `setup-github.sh` without `--apply` only prints its
plan (it reads the default branch and visibility).
