#!/usr/bin/env bash
# sweep-run.sh — run the full harness sweep (checks/*.mjs except assert/measure-flows),
# each with a 90s timeout, and write PASS/FAIL lines to the given log file.
set -u
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
LOG="$1"
: > "$LOG"
cd "$ROOT"
for f in checks/*.mjs; do
  case "$f" in
    checks/assert.mjs|checks/measure-flows.mjs) continue ;;
  esac
  timeout 90 node "$f" >/dev/null 2>&1
  rc=$?
  if [ "$rc" -eq 0 ]; then
    echo "PASS $f" >> "$LOG"
  elif [ "$rc" -eq 124 ]; then
    echo "TIMEOUT $f" >> "$LOG"
  else
    echo "FAIL($rc) $f" >> "$LOG"
  fi
done
echo "DONE $(grep -c . "$LOG") total, $(grep -c '^PASS' "$LOG") pass, $(grep -vc '^PASS' "$LOG") not-pass" >> "$LOG"
