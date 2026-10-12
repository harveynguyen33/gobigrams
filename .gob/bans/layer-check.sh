#!/usr/bin/env bash
# layer-check.sh — BN-05's detect. The boundary ban Dune actually mechanises.
#
# Reads the config's `layers:` list, each item "<from> <to>", and fails when a file under
# <from> imports across into <to>. The import test is a text probe for an import path that
# names <to>'s last path segment - so it catches `from '../main/db'` in a renderer, and it
# does NOT resolve module aliases or dynamic imports. Stated, not hidden (docs/LIMITS.md #27).
#
# Exit: 0 clean | 1 a crossing import (lines on stdout) | 2 could not run | 3 no layers declared.

set -uo pipefail
SELF_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
ROOT=$(cd "$SELF_DIR/../.." && pwd)          # .gob/bans/ -> repo root
CONFIG="$ROOT/AGENTS.md"
[ -f "$CONFIG" ] || { echo "layer-check: no $CONFIG" >&2; exit 2; }

# v2 config shape: the `layers:` flat key INSIDE the `<!-- gob:begin --> ... <!-- gob:end -->`
# marker block, one `[from1 to1, from2 to2]` array (each item a from/to pair). The block-bounded
# sed is the same reader g_agents_gates uses in goblin-lib.sh; a line outside the markers is
# prose and is never read.
block=$(sed -n "/^<!-- gob:begin/,/^<!-- gob:end/p" "$CONFIG" | sed '1d;$d')
layers=$(printf '%s\n' "$block" | sed -n 's/^layers:[[:space:]]*//p' | tr ',' '\n' \
  | sed 's/^[[:space:]]*//; s/[[:space:]]*$//; s/^\[//; s/\]$//' | grep -v '^$' || true)
[ -n "$layers" ] || { echo "no layers declared in $CONFIG - declare layers: in the gob block to turn BN-05 on"; exit 3; }

bad=""
while read -r from to; do
  [ -n "$from" ] && [ -n "$to" ] || continue
  [ -d "$ROOT/$from" ] || continue
  seg=${to##*/}
  hits=$(cd "$ROOT" && grep -rnE "from[[:space:]]+['\"][^'\"]*${seg}/" \
           --include='*.ts' --include='*.tsx' --include='*.js' --include='*.jsx' "$from" 2>/dev/null || true)
  [ -n "$hits" ] && bad="$bad$hits"$'\n'
done <<EOF
$layers
EOF

# A narrow, explicit exception (Dune rule 5) reaches this probe through the same environment the
# engine gives grep-ban.sh: GOBLIN_BANS_EXEMPT is a newline-separated list of path prefixes, and a
# hit whose FILE is under one of them does not count. Filtering here, before the exit code, is what
# makes the exception able to change a verdict (W5-1). BN-05's documented escape is `layers:` or a
# move, not the inline marker, so no BAN-OK is honoured here. A probe that ignores the variable
# keeps the old, fail-closed behaviour.
if [ -n "$bad" ] && [ -n "${GOBLIN_BANS_EXEMPT:-}" ]; then
  bad=$(GOBLIN_BANS_EXEMPT="$GOBLIN_BANS_EXEMPT" printf '%s' "$bad" | awk '
    BEGIN { n = split(ENVIRON["GOBLIN_BANS_EXEMPT"], ex, "\n") }
    {
      f = $0; sub(/:.*/, "", f)
      for (i = 1; i <= n; i++) {
        p = ex[i]
        if (p == "") continue
        if (f == p || index(f, p "/") == 1) next
      }
      print
    }')
fi

if [ -n "$bad" ]; then printf '%s' "$bad"; exit 1; fi
exit 0
