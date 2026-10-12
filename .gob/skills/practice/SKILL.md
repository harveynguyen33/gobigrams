---
name: practice
description: The composition hook: read the referenced standard at the path pinned in the AGENTS.md gob block.
---

# practice

goblin-stack owns the **mechanism**: which rule is enforced by what, how it is installed, how
it is verified, which flow applies, which role runs it.

The **house style** — the HANDOFF shape and the stale-sentence rule, the SPEC lifecycle, the
harness house style and the pinned-commit REPLAY, the gate vocabulary, commit discipline, the
delegation tiers, data safety, the documentation duty, adopt-don't-replace — belongs to the
standard this repo references. goblin-stack carries **no copy of it**.

## Mandate

1. Read the `AGENTS.md` gob block and take `practice:`.
2. If that path exists, **read the standard before starting work** in this repo. Its hash is
   pinned in `practice_sha256:`; `goblin-verify` re-checks it, so a silently edited standard
   is visible rather than assumed. If the standard has been edited **deliberately**, re-record
   the pin deliberately: `goblin-install --target <repo> --re-pin` rewrites that one line and
   prints the old and new hash. Nothing re-pins on its own — not `goblin-verify`, not
   `--upgrade` (`docs/GUIDE.md`).
3. If the path is absent or unset, **say so** and continue with the goblin-stack rules alone.
   Absent is not an error: goblin-stack is portable, and another machine has no such file.

## Why it is a pointer and not a copy

Two living copies of the same rule with no equality check is the rot goblin-stack exists to
remove. One copy plus a recorded hash is not. Do not paste the standard's text into any file
here, and do not supersede it: split by kind, not by ownership.

## What this cannot see

Whether the standard itself is still right. That is a human's edit, and this skill can only
notice that it changed.
