#!/usr/bin/env bash
# guard-git-ops.sh
# PreToolUse hook for the git-ops subagent (matcher: Bash).
# Blocks `git push` and `git merge` unless the current advance's review.md
# begins with "Verdict: PASS". Lets diff/status/add/commit through so local,
# reversible work isn't obstructed. Exit code 2 blocks the tool call and feeds
# the message back to the agent.

set -euo pipefail

INPUT=$(cat)
COMMAND=$(printf '%s' "$INPUT" | jq -r '.tool_input.command // empty')

# Only gate the irreversible-to-main operations.
if ! printf '%s' "$COMMAND" | grep -qiE '\bgit[[:space:]]+(push|merge)\b'; then
  exit 0
fi

# Locate the review artifact for the advance under review.
# Prefer an explicit advance id from the environment (e.g. `export VALIJA_ADVANCE=A07`);
# otherwise fall back to the most recently modified review.md under advances/.
if [ -n "${VALIJA_ADVANCE:-}" ]; then
  REVIEW="advances/${VALIJA_ADVANCE}/review.md"
else
  REVIEW=$(ls -t advances/*/review.md 2>/dev/null | head -n1 || true)
fi

if [ -z "${REVIEW:-}" ] || [ ! -f "$REVIEW" ]; then
  echo "Blocked: no review.md found. Run the change-reviewer subagent before push/merge." >&2
  exit 2
fi

# Require the machine-checkable verdict line at the start of a line.
if ! grep -qiE '^verdict:[[:space:]]*pass\b' "$REVIEW"; then
  echo "Blocked: $REVIEW is not 'Verdict: PASS'. push/merge denied until it passes review." >&2
  exit 2
fi

exit 0
