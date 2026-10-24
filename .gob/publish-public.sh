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

ROOT=$(git rev-parse --show-toplevel)
cd "$ROOT"

# .gob/ does not exist on the snapshot branch, so switching branches would delete
# this file while bash is still reading it. Re-exec from the git dir (never checked
# out of the snapshot, never cleaned) so the run cannot be cut in half.
if [ -z "${PUBLISH_REEXEC:-}" ]; then
  cp "$0" "$ROOT/.git/publish-public.run.sh"
  PUBLISH_REEXEC=1 exec bash "$ROOT/.git/publish-public.run.sh" "$@"
fi

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

# ---- the other half of an allowlist: DELETE everything tracked that is not allowed ----
# (the snapshot inherits whatever an earlier publish left behind, so without this a
#  once-published artifact stays public forever)
allowed() { local p="$1" a; for a in "${ALLOW[@]}"; do case "$p" in "$a"|"$a"/*) return 0;; esac; done; return 1; }
leaving=()
while IFS= read -r p; do
  allowed "$p" || leaving+=("$p")
done < <(git ls-tree -r --name-only HEAD)
if [ "${#leaving[@]}" -gt 0 ]; then
  echo "--- removing ${#leaving[@]} path(s) that are no longer public:"
  printf '    %s\n' "${leaving[@]}" | head -12
  git rm -rq --cached --ignore-unmatch -- "${leaving[@]}" 2>/dev/null || true
fi

# README: the public one is purpose-built, not the workshop README.
# It lives on `main` only, so it must be read from there — the working tree on
# this branch does not have the file (that silently shipped the stale one once).
if git cat-file -e main:README-PUBLIC.md 2>/dev/null; then
  git show main:README-PUBLIC.md > README.md
  git add README.md
else
  echo "WARNING: README-PUBLIC.md is missing on main — shipping the workshop README" >&2
fi

# ---- leak gate: refuse to publish if infrastructure identifiers slipped through ----
# NOTE the argument order: `git grep --cached -l -E '<re>'`. Putting --cached after
# the pattern is a fatal error, and with `|| true` around it that made this gate a
# silent no-op that always passed (found 2026-10-24 after 6 hits shipped).
# The pattern targets INFRASTRUCTURE (IPs, personal paths, agent dirs), not internal
# round IDs — round breadcrumbs live in source comments by design.
LEAKS=$(git grep --cached -l -E '192\.168\.|/home/[a-z]+/|/Users/[A-Za-z]+/|\.hermes|goblin-stack' 2>/dev/null | head -20 || true)
if [ -n "$LEAKS" ]; then
  echo "ERROR: internal identifiers found in the staged public tree:" >&2
  echo "$LEAKS" >&2
  exit 1
fi
echo "--- leak gate: clean"

echo "--- staged public tree ($(git diff --cached --name-only | wc -l) files):"
cut -d/ -f1 <(git diff --cached --name-only) | sort -u | sed 's/^/    /'

if [ "${1:-}" = "--push" ]; then
  git commit -q -m "public: refresh snapshot from main" || echo "nothing to commit"
  git push github-mirror public-main:main --force
  echo "pushed -> github.com/harveynguyen33/gobigrams"
else
  echo "dry run — inspect with: git diff --cached --stat"
  exit 0
fi

# never leave the workshop checked out on the snapshot branch
git checkout -f main >/dev/null 2>&1 || true
echo "back on main: $(git rev-parse --abbrev-ref HEAD) @ $(git rev-parse --short HEAD)"
