#!/usr/bin/env bash
# release.sh — promote develop -> main and publish. RUN ONLY WHEN HARVEY SAYS RELEASE.
#
# The release train (since 2026-10-25):
#   develop  = the workshop trunk. All agent/coder work lands here. NEVER deployed.
#   main     = the release branch. Only moves when Harvey approves a release.
#   public-main = the GitHub snapshot (allowlist), built from main.
#   Cloudflare Pages watches GitHub main -> auto-deploys ~1 min after publish.
#
# Usage:  .gob/release.sh [--dry]
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"

if [ -n "$(git status --porcelain)" ]; then
  echo "ERROR: working tree is dirty — commit or stash first." >&2
  exit 1
fi

git checkout develop
git fetch -q origin
if [ "$(git rev-parse develop)" != "$(git rev-parse origin/develop)" ]; then
  echo "ERROR: local develop != origin/develop — push/pull first." >&2
  exit 1
fi

echo "--- gates on develop..."
npx tsc --noEmit
node node_modules/vite/bin/vite.js build --logLevel warn >/dev/null
python3 - <<'PY'
import os
d = 'dist/assets'
t = sum(os.path.getsize(os.path.join(d, f)) for f in os.listdir(d) if f.endswith('.js'))
print(f'client_js_bytes={t}')
assert t <= 942000, f'OVER CEILING: {t} > 942000'
PY
.gob/bin/goblin-verify >/dev/null && echo "goblin-verify OK"

BEFORE=$(git rev-parse --short main)
git checkout main
git merge --ff-only develop
echo "--- main ${BEFORE} -> $(git rev-parse --short main) (fast-forward)"

if [ "${1:-}" = "--dry" ]; then
  echo "dry run — main NOT pushed, public NOT published."
  git checkout develop
  exit 0
fi

git push origin main
echo "--- publishing public snapshot..."
SRC_BRANCH=main .gob/publish-public.sh --push
git checkout develop
echo ""
echo "RELEASE DONE. Cloudflare Pages will deploy in ~1 minute."
echo "Verify: https://gobigrams.tech-goblin.com"
