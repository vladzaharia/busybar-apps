#!/bin/bash
# Claude Code cloud sessions: install what the repository needs (scripts/setup.sh) before the session starts, so
# typecheck, tests, the simulator and the Mac app's Swift tests all work. Local sessions are left alone.
set -euo pipefail

if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

"$CLAUDE_PROJECT_DIR/scripts/setup.sh"
