#!/usr/bin/env bash
# publish-public.sh — rebuild the GitHub public snapshot from `main`.
#
# POLICY (Harvey, 2026-10-24): a public repo shows ONLY what a stranger needs to
# run the product. Anything that exists to feed the agent or the workshop stays
# private: round specs, handoff/agent notes, harnesses, research dumps, feature
# maps, forge/CI config for the private forge, and one-off dev scripts.
#
# This is an ALLOWLIST, deliberately. A denylist leaks the next new artifact
# someone invents; an allowlist only ever ships what is named here.
#
# Usage:  .gob/publish-public.sh [--push]
set -euo pipefail
cd "$(dirname "$0")/.."
ROOT=$(pwd)

if [ -n "$(git status --porcelain)" ]; then
  echo "ERROR: working tree is dirty — commit or stash first." >&2
  exit 1
fi

# ---- the allowlist: every path that is allowed to exist in the public tree ----
ALLOW=(
  .github                 # issue templates — how strangers report bugs
  .gitignore
  CONTRIBUTING.md
  LICENSE
  README.md
  SECURITY.md
  SUPPORT.md
  index.html
  package.json
  package-lock.json
  tsconfig.json
  vite.config.ts
  public                  # brand marks, favicons, manifest
  src                     # the application itself
)

git checkout public-main
git reset --hard public-main
git clean -qfd

# stage ONLY the allowlisted paths from main
git checkout main -- "${ALLOW[@]}"

# README: the public one is a purpose-built file, not the workshop README
if [ -f README-PUBLIC.md ]; then
  cp README-PUBLIC.md README.md
  git add README.md
fi

# ---- leak gate: refuse to publish if any internal identifier slipped through ----
LEAKS=$(git grep -lE '192\.168\.|/home/harvey|\.hermes|goblin-stack|\.gob/|ROUND-[A-Z]' --cached 2>/dev/null | head -20 || true)
if [ -n "$LEAKS" ]; then
  echo "ERROR: internal identifiers found in the staged public tree:" >&2
  echo "$LEAKS" >&2
  exit 1
fi

echo "--- staged public tree ($(git diff --cached --name-only | wc -l) files):"
cut -d/ -f1 <(git diff --cached --name-only) | sort -u | sed 's/^/    /'

if [ "${1:-}" = "--push" ]; then
  git commit -q -m "public: refresh snapshot from main" || echo "nothing to commit"
  git push github-mirror public-main:main --force
  echo "pushed -> github.com/harveynguyen33/goblin-diagrams"
else
  echo "dry run — inspect with: git diff --cached --stat"
fi
