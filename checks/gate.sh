#!/usr/bin/env bash
# checks/gate.sh — run the declared gate set and print ONE line of measured numbers.
# Convenience wrapper around the same declarations goblin-verify uses (GT-02/GT-05).
# Rename or replace it; it is a starting point, not a requirement.
set -uo pipefail
ROOT=$(git rev-parse --show-toplevel 2>/dev/null || pwd)
# shellcheck source=/dev/null
. "$ROOT/.gob/bin/goblin-lib.sh"
CONFIG="$ROOT/AGENTS.md"

line=""
bad=0
while IFS=$'\t' read -r name cmd; do
  [ -n "$name" ] || continue
  ( cd "$ROOT" && bash -c "$cmd" ) >/dev/null 2>&1
  rc=$?
  line="$line $name=$rc"
  [ "$rc" -eq 0 ] || bad=1
done < <(g_agents_gates "$CONFIG")

rname=$(g_agents_read "$CONFIG" ratchet.name)
rcmd=$(g_agents_read "$CONFIG" ratchet.cmd)
if [ -n "$rname" ] && [ -n "$rcmd" ]; then
  rval=$( cd "$ROOT" && bash -c "$rcmd" 2>/dev/null | tr -d '[:space:]' )
  line="$line · $rname $rval (ceiling $(g_agents_read "$CONFIG" ratchet.ceiling))"
fi

printf '%s · measured %s\n' "${line# }" "$(date +%F)"
exit $bad
