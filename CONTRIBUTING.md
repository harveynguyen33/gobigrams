# Contributing to Gobigrams

Thanks for wanting to help! Gobigrams is a diagram tool with strong opinions
about lines, bytes and honesty in its own test harness. A few house rules.

## Issues welcome

Bug reports and feature ideas both go through the
[issue templates](https://github.com/harveynguyen33/goblin-diagrams/issues) —
short answers are fine. Questions are faster in
[Discussions](https://github.com/harveynguyen33/goblin-diagrams/discussions).

## Before you open a PR

1. **Run the sweep.** Every check under `checks/` (skipping `*assert.mjs` and
   `*measure-flows.mjs`) must pass:
   ```sh
   for f in checks/*.mjs; do case "$f" in *assert*|*measure-flows*) continue;; esac; timeout 90 node "$f" || exit 1; done
   ```
2. **Run the gates.** `npx tsc --noEmit` and
   `node node_modules/vite/bin/vite.js build` must both exit 0, and the
   client JS total (`find dist/assets -name '*.js' -exec cat {} + | wc -c`)
   must stay under the `client_js_bytes` ceiling in `AGENTS.md`.
3. **New behaviour needs a harness, and the harness must be RED first.**
   Write `checks/<round>-<slug>.mjs` asserting the behaviour, prove it fails
   on the commit *before* your change, then make it pass. A check that was
   green on both trees proves nothing — this repo takes that literally.

## House rules

- **No new dependencies.** None. The bundle has a byte ceiling for a reason.
- **Artifacts are in English.** Code, comments, commit messages, issues and
  PRs included.
- **`boards/` is user data.** Don't touch it.
- **Styles use tokens, not hex.** New CSS uses the sheet's `var(--*)` tokens;
  the harness counts hex literals and won't let the number grow.

## Receiving contributions

Maintainers may re-anchor harnesses when the UI they enumerate changes — that
is normal here, not a rejection of your work.
