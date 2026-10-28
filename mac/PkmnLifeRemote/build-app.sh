#!/bin/sh
# Builds "Pkmn Life Remote.app" in ./dist: the release binary, Info.plist, and an ad-hoc signature so macOS runs it.
# Usage: ./build-app.sh            then open "dist/Pkmn Life Remote.app" (or drag it to /Applications)
set -eu
cd "$(dirname "$0")"
swift build -c release
BIN="$(swift build -c release --show-bin-path)/PkmnLifeRemote"
APP="dist/Pkmn Life Remote.app"
rm -rf "$APP"
mkdir -p "$APP/Contents/MacOS"
cp "$BIN" "$APP/Contents/MacOS/PkmnLifeRemote"
cp Support/Info.plist "$APP/Contents/Info.plist"
codesign --force --sign - "$APP"
echo "Built $APP"
