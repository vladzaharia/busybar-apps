#!/bin/sh
# Builds Pkmn Life Remote and captures it in each state against a mock bar, for checking how it looks without
# clicking through it by hand. macOS 26 only. Used by the "Mac visual check" workflow; works on a desk Mac too.
#
#   Tools/screenshots.sh [out-dir]       default: screens/
#
# For each state it writes <state>.png (the whole screen, as screencapture sees it: real Liquid Glass, but it needs
# Screen Recording permission for the terminal or runner) and <state>-corner.png (the top-right corner, where the
# panel lives). The app's own --snapshot also writes <state>/<window>.png, drawn without screen capture. requests.log
# lists what the app asked the mock bar.
set -eu
cd "$(dirname "$0")/.."
OUT="${1:-screens}"
rm -rf "$OUT"
mkdir -p "$OUT"
OUT="$(cd "$OUT" && pwd)"

./build-app.sh
BIN="$PWD/dist/Pkmn Life Remote.app/Contents/MacOS/PkmnLifeRemote"

# A free port: the mock's default, 8787, is often taken (it is wrangler dev's), and the app would talk to whatever
# holds it.
PORT=$(python3 -c 'import socket; s = socket.socket(); s.bind(("127.0.0.1", 0)); print(s.getsockname()[1])')
python3 Tools/mock-bar.py --port "$PORT" --log "$OUT/requests.log" >"$OUT/mock.log" 2>&1 &
MOCK=$!
trap 'kill $MOCK 2>/dev/null || true' EXIT
# Wait until the mock itself answers, then forget that request so the log holds only the app's.
for _ in $(seq 50); do
  curl -sf "http://127.0.0.1:$PORT/api/version" 2>/dev/null | grep -q mock && break
  sleep 0.1
done
if ! curl -sf "http://127.0.0.1:$PORT/api/version" 2>/dev/null | grep -q mock; then
  echo "The mock bar didn't start:" >&2
  cat "$OUT/mock.log" >&2
  exit 1
fi
: >"$OUT/requests.log"

# The screen's size in pixels, for the corner crop.
WIDTH=0
HEIGHT=0

shoot() {
  state="$1"
  shift
  echo "--- $state: $*"
  # -host and -dockMode override the saved preferences for this run only.
  "$BIN" -host "127.0.0.1:$PORT" --snapshot "$OUT/$state" "$@" &
  APP=$!
  sleep 2.5
  if screencapture -x "$OUT/$state.png" 2>/dev/null; then
    WIDTH=$(sips -g pixelWidth "$OUT/$state.png" | awk '/pixelWidth/ {print $2}')
    HEIGHT=$(sips -g pixelHeight "$OUT/$state.png" | awk '/pixelHeight/ {print $2}')
    # The top-right 900 x 900 pixels: the panel, from the menu bar down.
    sips --cropOffset 0 $((WIDTH > 900 ? WIDTH - 900 : 0)) -c $((HEIGHT < 900 ? HEIGHT : 900)) $((WIDTH < 900 ? WIDTH : 900)) \
      "$OUT/$state.png" --out "$OUT/$state-corner.png" >/dev/null
  else
    echo "    screencapture failed (Screen Recording permission?): only the app's own snapshot"
  fi
  # --snapshot quits the app a moment later; make sure it has.
  wait $APP 2>/dev/null || kill $APP 2>/dev/null || true
}

for look in light dark; do
  shoot "shown-$look" -dockMode alwaysShown --appearance "$look"
  shoot "hover-$look" -dockMode alwaysShown --peek --appearance "$look"
  shoot "tucked-$look" -dockMode tucked --appearance "$look"
  shoot "peeking-$look" -dockMode tucked --peek --appearance "$look"
  shoot "pinned-$look" -dockMode tucked --pin --appearance "$look"
  shoot "settings-general-$look" -dockMode alwaysShown --settings general --appearance "$look"
  shoot "settings-pkmn-life-$look" -dockMode alwaysShown --settings pkmn-life --appearance "$look"
done

echo
echo "Requests the app made:"
cat "$OUT/requests.log" 2>/dev/null || echo "(none)"
if ! grep -q "GET /api/version" "$OUT/requests.log" 2>/dev/null; then
  echo "The app never reached the mock bar." >&2
  exit 1
fi
echo
echo "Screens in $OUT (screen ${WIDTH}x${HEIGHT}):"
ls "$OUT"
