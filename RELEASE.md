# Releasing

Everything in the repository is released together, under one version. Push a `vX.Y.Z` tag and the **Release**
workflow (`.github/workflows/release.yml`) builds every BUSY Bar app, its simulator, the shared packages and the Mac
app; puts them in one GitHub Release; and publishes the simulators and the effects gallery on GitHub Pages.

## What a release holds

| File | What it is |
| --- | --- |
| `pkmn-life-X.Y.Z.tgz` | Pkmn Life for the BUSY Bar (one per app in `apps/`): `npx -p @busy-app/cli busy-cli app install pkmn-life-X.Y.Z.tgz` with the bar on USB |
| `pkmn-life-simulator-X.Y.Z.zip` | The app in the simulator: unzip it and serve the folder with any web server |
| `vladzaharia-bar-core-X.Y.Z.tgz`, `-pixel-`, `-sim-` | The packages, as npm would install them (`npm install ./vladzaharia-bar-core-X.Y.Z.tgz`); TypeScript source, for Node 22.18+ or a bundler |
| `PkmnLifeRemote-X.Y.Z-macOS-arm64.zip` | The Mac app, signed and notarized, once its signing is set up ([mac/RELEASE.md](mac/RELEASE.md)) |
| `SHA256SUMS.txt` | Checksums of every file |

The apps are built from the repository alone, with no local files, so their personal settings are the examples: Pkmn
Life's redirects go to the people in `redirects.example.json`. To use your own, build the app yourself (its README).

Every `package.json` and app manifest takes the tag's version in the build; git keeps them at whatever they say
(`scripts/release/build.sh` changes only the checkout it runs in).

## Pipeline

| Job | Runner | What it does |
| --- | --- | --- |
| `prepare` | `ubuntu-24.04` | checks the ref (`check-ref.sh`), works out the version (`version.sh`), writes the notes (`release-notes.sh`) |
| `build` | `ubuntu-24.04` | typecheck and tests, then the apps, simulators and packages (`build.sh`); attests their provenance; the `release-files` artifact and the Pages site |
| `mac` | `xcode-27`, environment `release` | the Mac app, signed and notarized ([mac/RELEASE.md](mac/RELEASE.md)); skipped until `MAC_TEAM_ID` is set |
| `release` | `ubuntu-24.04` | tags only: a draft GitHub Release with every file and one `SHA256SUMS.txt`, then published (`github-release.sh`) |
| `pages` | `ubuntu-24.04` | tags only, not prereleases, while GitHub Pages is on: deploys the site |

The scripts are in `scripts/release/` (the Mac app's own in `mac/PkmnLifeRemote/Tools/ci/`); each prints its usage
with `--help`. CI holds them to every shellcheck rule.

## Cutting a release

From a commit on `main` that has been pushed and whose CI passed. The tag must point at a commit on the default branch:
`prepare` checks it and refuses anything else.

```sh
git tag -a v0.2.0 -m "0.2.0: the wild encounter ends in a Jira ticket"
git push origin v0.2.0
```

- The tag's message opens the release notes, followed by the commits since the previous `v*` tag and what to
  download.
- The release becomes "Latest" unless it is a prerelease: a tag such as `v0.2.0-rc.1` releases version 0.2.0 as a
  prerelease (and leaves GitHub Pages alone).
- Once the Mac app's signing is set up, its job waits for approval on a public repository: Actions › Release ›
  Review deployments › `release` › Approve.

By hand: `gh workflow run release.yml --ref main -f version=0.2.0` builds everything and leaves the files on the
run's page, with no release; `gh workflow run release.yml --ref v0.2.0` makes a tag's full release.

## Re-running

- **Re-run failed jobs** re-runs the failed jobs and the ones after them. The version and build number stay the run's.
- The `release` job updates its own draft (title, notes, prerelease flag, files; stale files are deleted). A published
  release is never changed: the job fails rather than swap files people may have downloaded. Ship a fix as a new
  version, or unpublish first (`gh release edit v0.2.0 --draft=true`) and re-run.

## Verifying a download

```sh
shasum -a 256 -c SHA256SUMS.txt
gh attestation verify pkmn-life-0.2.0.tgz --repo vladzaharia/busybar-apps \
    --signer-workflow vladzaharia/busybar-apps/.github/workflows/release.yml
```

The Mac app has its own checks too ([mac/RELEASE.md](mac/RELEASE.md#verifying-a-download)).

## Setup

- **GitHub Pages** is on (since 2026-10-28), at <https://vladzaharia.github.io/busybar-apps/>: Settings › Pages ›
  Build and deployment › Source: **GitHub Actions**, and Settings › Environments › `github-pages` › Deployment branches
  and tags lists `main` and a tag rule, `v*` (releases deploy from their tag; the environment starts out allowing only
  the default branch). With Pages off, releases skip the `pages` job and their notes don't link the simulators.
- **The Mac app**: [mac/RELEASE.md](mac/RELEASE.md#one-time-setup). Until then, releases go out without it.
