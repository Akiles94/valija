#!/bin/bash
# Filters verbose vitest output from `npm run test` / `npm test` / `vitest run`
# down to failure context plus the trailing summary, so a large all-passing
# run costs far fewer tokens while a failing run still shows enough to debug.
# Never rewrites anything else — in particular, watch-mode commands
# (`npm run test:watch`, bare `vitest`) are deliberately excluded, since
# piping a process that never exits through `head` would hang the tool call.

command -v jq >/dev/null 2>&1 || { echo '{}'; exit 0; }

input=$(cat)
cmd=$(echo "$input" | jq -r '.tool_input.command // empty')

# Safety net first: the checks below are a plain text scan, not a real shell
# parse, so a command carrying a heredoc, command substitution, or a newline
# could contain the phrase "npm run test" as prose (e.g. a commit message)
# rather than as an actual invocation. Any of those shapes is excluded
# outright, even if a test-runner pattern also matches somewhere in it —
# false-negative (missing an optimization) is fine; false-positive (mangling
# an unrelated command) is not.
if [[ "$cmd" == *$'\n'* || "$cmd" == *'<<'* || "$cmd" == *'$('* || "$cmd" == *'`'* ]]; then
  echo '{}'
  exit 0
fi

is_test_cmd=0
if [[ "$cmd" =~ (^|[\&\;\|[:space:]])npm[[:space:]]+run[[:space:]]+test([[:space:]]|$) ]]; then
  is_test_cmd=1
elif [[ "$cmd" =~ (^|[\&\;\|[:space:]])npm[[:space:]]+test([[:space:]]|$) ]]; then
  is_test_cmd=1
elif [[ "$cmd" =~ (^|[\&\;\|[:space:]])(npx[[:space:]]+)?vitest[[:space:]]+run([[:space:]]|$) ]]; then
  is_test_cmd=1
fi

if [[ "$is_test_cmd" -eq 0 || -z "$cmd" ]]; then
  echo '{}'
  exit 0
fi

tmp_log=$(mktemp /tmp/valija-test-output.XXXXXX)

new_cmd=$(printf '{ %s ; } 2>&1 | tee %q | grep -E -A 5 %q | head -100; status=${PIPESTATUS[0]}; echo %q; tail -n 15 %q; rm -f %q; exit $status' \
  "$cmd" \
  "$tmp_log" \
  '(FAIL|ERROR|error:|✗|✕)' \
  '--- tail of full output ---' \
  "$tmp_log" \
  "$tmp_log")

jq -n --arg cmd "$new_cmd" '{hookSpecificOutput: {hookEventName: "PreToolUse", permissionDecision: "allow", updatedInput: {command: $cmd}}}'
