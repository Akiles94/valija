#!/usr/bin/env bash
# guard-review-writes.sh
# PreToolUse hook for the change-reviewer subagent (matcher: Write).
# The reviewer must be structurally unable to modify the code it is judging.
# Edit is already denied in frontmatter; this blocks Write to anything except
# the review.md verdict file. Exit code 2 blocks the tool call.

set -euo pipefail

INPUT=$(cat)
FILE_PATH=$(printf '%s' "$INPUT" | jq -r '.tool_input.file_path // empty')

# No path to inspect — nothing to block.
if [ -z "$FILE_PATH" ]; then
  exit 0
fi

# Allow only the review artifact; block writes to any source or config file.
case "$FILE_PATH" in
  */review.md|review.md)
    exit 0
    ;;
  *)
    echo "Blocked: change-reviewer may only write review.md, not $FILE_PATH." >&2
    exit 2
    ;;
esac
