---
name: goblin-bootstrap
description: P8: adopt goblin-stack in a repo - install, verify, then the first round.
---

# goblin-bootstrap (P8)

Use when adopting goblin-stack in a repo, or starting one.

1. **`goblin-install --target <dir>`** — the default install is a NEUTRAL harness:
   no agent skills. Vendor the Hermes project tier with `--skills yes` if you want them installed.
2. **`goblin-verify`** — a default install (core procedure tier vendored under `.gob/skills/`)
   verifies green:
   `17 passed, 0 failed, 0 advisory, 10 skipped`, exit 0, once `HANDOFF.md` names a commit that
   exists; before that edit the
   scaffold's `0000000` placeholder is `HP-05`'s one expected day-one red (`16 passed, 1 failed`).
   Ten rows skip with a reason, and the reason matters: `SK-01`, `SK-02` and `SK-04` **run** (the
   core procedure tier is vendored on every install, so the product no longer disables its own
   rows);
   `BN-01`/`BN-02`/`BN-03`/`BN-05` (this fresh repo has no `.ts` file for a ban's `applies_when`
   glob, so each reports *not applicable*) and the four electron bans `BN-06`..`BN-09` (selected by
   the `dep:electron` predicate, so with no `package.json` they too report *not applicable*);
   and `FM-01`/`FM-02` (no feature map yet). Each is a *not yet*, not a pass. The other 32 target
   rows are held in the **library** (`gob verify --library`), off by default — the rows that are
   not right for every repo. The round-shaped rows (a first review, a real gate) are library rows
   now; the first-step list is a list of work, not a defect.
4. **Fix `.gitignore` BEFORE any `git init`.** A credentials file already in the tree is
   committed by the first `git add -A` and is then in history forever.
5. **First HANDOFF, first SPEC, first check script** — in that order, each independently
   useful.
6. **Record the first perf number, and the commit you measured it on.** Run `ratchet.cmd` on a
   pinned commit, write the value into `ratchet.ceiling` and the same number into
   `perf.baseline_value`/`perf.baseline_commit`/`perf.measured`. Until you do, `PF-01` skips with
   "no perf baseline recorded yet" — a green run that proves nothing about the number you ship.

## Verification

- `goblin-verify` exit 0, and the created-file list matches `.gob/installed.json`.
- A repo with no gate declares one and records its first measured numbers.
- `.gitignore` is verified before the first commit, not after.
- The perf baseline exists, and it names a commit that exists (`PF-01`), rather than the ratchet
  ceiling having been raised by hand.

## What this cannot see

Whether the parts you left on match how the project actually ships. Switch a part off with
`--opt-out <part>` when it does not; the installer records it in `disabled:`.
