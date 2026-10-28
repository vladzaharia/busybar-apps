#!/usr/bin/env bash
# Sets up a machine to build, test and run everything in this repository: a laptop, a CI runner, or a Claude Code
# cloud session (.claude/hooks/session-start.sh runs it). Safe to run again: it only does what is missing.
#
#   scripts/setup.sh              Node packages, and Swift for the Mac app's tests
#   scripts/setup.sh --no-swift   Node packages only
#
# Needs Node (version in .nvmrc; at least 22.18). Swift: on macOS, Xcode 26 (or its command-line tools) for the Mac
# app; on Linux, the script downloads Swift 6.2 into $SWIFT_HOME (default ~/.local/share/swift/6.2), enough to run the
# PkmnLifeRemoteKit tests (the app itself needs macOS).
set -euo pipefail

cd "$(dirname "$0")/.."
SWIFT_VERSION=6.2
SWIFT_HOME="${SWIFT_HOME:-$HOME/.local/share/swift/$SWIFT_VERSION}"
WITH_SWIFT=1
for arg in "$@"; do
  case "$arg" in
    --no-swift) WITH_SWIFT=0 ;;
    *) echo "Unknown option: $arg" >&2; exit 2 ;;
  esac
done

say() { printf '\n==> %s\n' "$*"; }

# --- Node and pnpm ------------------------------------------------------------------------------------------------

say "Node and pnpm"
if ! command -v node >/dev/null; then
  echo "Node isn't installed. Install Node $(cat .nvmrc) (for example with nvm: nvm install), then run this again." >&2
  exit 1
fi
node -e '
  const [maj, min] = process.versions.node.split(".").map(Number);
  if (maj < 22 || (maj === 22 && min < 18)) { console.error(`Node ${process.version} is too old: need 22.18 or later.`); process.exit(1); }
'
PNPM_VERSION="$(node -p 'require("./package.json").packageManager.split("@")[1]')"
if [ "$(pnpm --version 2>/dev/null)" != "$PNPM_VERSION" ]; then
  # Corepack ships with Node and fetches the pnpm version package.json names; fall back to npm.
  corepack enable pnpm 2>/dev/null && corepack prepare "pnpm@$PNPM_VERSION" --activate >/dev/null 2>&1 \
    || npm install -g "pnpm@$PNPM_VERSION" >/dev/null
fi
echo "node $(node --version), pnpm $(pnpm --version)"
# Not --frozen-lockfile: a session's container is cached after setup, and pnpm reuses what is already installed.
pnpm install --prefer-offline

# --- Swift --------------------------------------------------------------------------------------------------------

swift_ok() { "$1" --version 2>/dev/null | grep -Eq "Swift version (6\.[2-9]|[7-9]\.)"; }

if [ "$WITH_SWIFT" = 1 ]; then
  say "Swift"
  case "$(uname -s)" in
    Darwin)
      if command -v swift >/dev/null && swift_ok swift; then
        swift --version 2>/dev/null | head -1
      else
        echo "The Mac app needs Swift $SWIFT_VERSION or later: install Xcode 26 from the App Store, then run" >&2
        echo "  sudo xcode-select -s /Applications/Xcode.app" >&2
      fi
      ;;
    Linux)
      if command -v swift >/dev/null && swift_ok swift; then
        swift --version 2>/dev/null | head -1
      else
        if ! swift_ok "$SWIFT_HOME/usr/bin/swift"; then
          . /etc/os-release
          platform="${ID}${VERSION_ID}"
          case "$platform" in
            ubuntu24.04 | ubuntu22.04 | debian12) ;;
            *) echo "No Swift download set up for $platform; install Swift $SWIFT_VERSION yourself (https://www.swift.org/install)." >&2; exit 1 ;;
          esac
          suffix=""
          [ "$(uname -m)" = "aarch64" ] && suffix="-aarch64"
          dir="${platform//./}"
          name="swift-$SWIFT_VERSION-RELEASE-$platform$suffix"
          url="https://download.swift.org/swift-$SWIFT_VERSION-release/$dir$suffix/swift-$SWIFT_VERSION-RELEASE/$name.tar.gz"
          echo "Downloading $name (about 900 MB)..."
          tmp="$(mktemp -d)"
          curl -fsSL "$url" | tar xz -C "$tmp"
          rm -rf "$SWIFT_HOME"
          mkdir -p "$(dirname "$SWIFT_HOME")"
          mv "$tmp/$name" "$SWIFT_HOME"
          rmdir "$tmp"
        fi
        "$SWIFT_HOME/usr/bin/swift" --version 2>/dev/null | head -1
        echo "Swift is in $SWIFT_HOME/usr/bin. Add it to PATH:"
        echo "  export PATH=\"$SWIFT_HOME/usr/bin:\$PATH\""
        # In a Claude Code session, put it on PATH for the session's commands.
        if [ -n "${CLAUDE_ENV_FILE:-}" ]; then
          echo "export PATH=\"$SWIFT_HOME/usr/bin:\$PATH\"" >>"$CLAUDE_ENV_FILE"
        fi
      fi
      ;;
  esac
fi

say "Ready"
cat <<'EOF'
  pnpm typecheck && pnpm test                    every package and app
  cd apps/<slug> && pnpm sim                     an app in the simulator
  cd mac/PkmnLifeRemote && swift test            the Mac app's tests (Linux too)
  cd mac/PkmnLifeRemote && ./build-app.sh        the Mac app (macOS 26)
EOF
