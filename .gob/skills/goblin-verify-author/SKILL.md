---
name: goblin-verify-author
description: P6: author a project's gate set, harness and feature map, then execute them once end to end.
---

# goblin-verify-author (P6)

Use when a project has no live lane, or its gates have drifted from what it actually does.

1. **Read the repo, not the user, for entry points.** The declared gate must be a command the
   repo can actually run. One inferred command is wrong for a repo with no runner, a repo that
   cannot run its own typecheck read-only, and a repo whose runner lives elsewhere — all at
   once.
2. **Write the gate/check set into the harness dir**, in the house harness shape: a
   `failures` counter, an `assert(name, ok, detail)` printer, a non-zero exit on failure, and
   a REPLAY block at the bottom.
3. **Execute it once end to end.** A generated skill that was never executed is a draft, not
   a deliverable.
4. **Add the REPLAY block.** Run each assertion against the pinned pre-change commit and
   require it to be RED there. Pin the pre-change commit, never `HEAD`.
5. **Seed the feature map.** The harness needs a list of what there is to drive, and the map is
   that list (`goblin-feature-map`): one file per user-facing feature, each with its entry points
   and the exact command that drives it. Declare `feature_map:` and `source_root:` in
   the `AGENTS.md` gob block. An **empty `feature_map:` is the honest state of a project with no map
   yet** (`FM-01`/`FM-02` then skip with that reason); a declared path that names no map is a hole
   and is reported as one.
6. **Hand the generated skill to P12 before calling it verified.** goblin-stack installs
   agent-authored skills, and a generated skill accepted after a skim is a different proposition
   from a written one — the record P12 produces (`evals/<slug>/`) is what makes "verified" a
   measurement rather than a date. **`verified:` does not advance until that record exists.** The
   row that checks a record's shape is not shipped yet, so this is a stated requirement here and
   in `goblin-eval`, not a claim that a command enforces it.

## Verification

- The harness prints `PASS`/`FAIL` per assertion and exits non-zero on any failure.
- The REPLAY shows RED pre-change, with the commit named.
- The gate set is declared in the `AGENTS.md` gob block, never inferred.
- The map's index and four-H2 entry contract hold (`FM-01`), every declared entry path still
  resolves under `source_root:` and none changed after its `verified:` date (`FM-02`), and the
  declared `verify_doctor:` exits 0 (`VA-01`).
- A `verified:` date advances only for a feature that was actually driven, and only after the P12
  record for the generated skill itself exists.

## What this cannot see

Whether an assertion tests the right path rather than merely passing. That needs a human read
of the diff, and `goblin-verify` says so on every run. Neither does this skill know whether the
map lists **every** feature: `FM-01` checks the index against the files that exist, so a feature
nobody wrote down is invisible to it.
