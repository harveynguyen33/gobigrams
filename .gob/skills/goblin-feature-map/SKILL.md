---
name: goblin-feature-map
description: The feature map - a per-project inventory of every user-facing feature, its entry points and the exact command that drives each one. Use when a project needs a map an agent can read cold, when a map's index or entry paths have drifted from the app, or when a verification skill must state which features it covers (P6 authors the map; FM-01/FM-02 keep it honest).
---

# goblin-feature-map

A **feature map** is a directory of small files, one per user-facing feature, written for the
next agent rather than for a human: it is read cold, mid-task, by an agent that has never seen
the app. It answers "how do I reach this behaviour, with what command, and what should I see" —
without re-deriving entry points from source every session.

**It is an inventory, not a proof.** A complete map with every feature driven proves the features
behave *as described*; it proves nothing about whether the app is correct.

## Where it lives, and who declares it

The map's location is **declared, never inferred**: the `AGENTS.md` gob block holds

```
feature_map: <path to the map README, relative to the repo>   # empty -> FM-01/FM-02 SKIP
source_root: .                                                # entry paths resolve against this
verify_doctor: ""                                             # empty -> VA-01 SKIP
```

An **empty `feature_map:` is the honest state of a project with no map yet** — `FM-01` and
`FM-02` then SKIP with that reason instead of failing a fresh install. Declaring a path and not
writing the map is a hole, and is reported as one.

## The README — the index

`features/README.md`, four H2 sections, in this order, and no more:

```
## Baseline preconditions     how to launch, isolate, seed, health-check
## Driving conventions         stable-handle rule, literal-command rule, restore rule
## Proof and skip reporting    what counts as proof; how a skip is reported
## Features                    one line per feature file: - [Name](./<slug>.md) covers ...
```

The `## Features` list is the index. **Every `features/*.md` file must appear in it, in the
`](./<slug>.md)` form, and every relative link must resolve** (`FM-01`). The README's own
sections are prose: no check reads them, so nothing here pretends they are enforced.

## Each feature file — the entry contract

`features/<slug>.md`: frontmatter, then **exactly four H2s, in this order**.

```
---
feature: <slug>            # must equal the filename stem
entry_paths:               # >=1 single-token strings; each must still occur under source_root
  - <route-or-path-token>
verified: <YYYY-MM-DD>     # the date a human or an audit last drove this feature
---
# <Feature name>
<one paragraph, user-visible behaviour, no implementation detail>

## Sub-features
- `<id>` <one line>

## How to get to it (user POV)
- one bullet per entry point

## Driving it with <harness>
Preconditions: <what must be true first>
**<action>.** Run `<exact command>`. <observable result>

## Gotchas
- traps that waste or invalidate a run
```

`<harness>` is this project's own — a browser driver, a CLI, a test runner. Keep an entry path a
**single token** (a route, a file path, a CLI flag) that occurs verbatim under `source_root`,
because that is what `FM-02` greps for. Pair every user action with an **exact command** and an
**observable result**, or the entry is not drivable and belongs in `## Gotchas`.

## What makes it rot, and what keeps it honest

| rot | what it looks like | what catches it |
|---|---|---|
| index rot | a feature file added or deleted, README not updated | `FM-01`: every feature file linked, every link resolves |
| contract rot | a section renamed, a fifth H2 added, the four reordered | `FM-01`: the four H2s, in order, exactly |
| entry-point rot | a route renamed, a flag changed — the recipe drives a dead path | `FM-02`: every `entry_paths:` token still occurs under `source_root:` |
| staleness | the app changed after the map was written; the recipe "works" by luck | `FM-02`: no entry path's file may have a commit newer than the feature's `verified:` date |
| coverage rot | a proof drives one convenient entry point while the map lists three | **not mechanically checkable** — see "what this cannot see" |
| implementation creep | the map freezes internals meant to be runtime discoveries | contract only; resist it in review |

**`FM-02` is a tripwire, not a proof.** `git log` sees a *file* change, not a *behaviour* change:
a refactor touching the file without changing the route reports stale-and-wrong, and a behaviour
change in a file the token does not appear in is missed. It can be RED-when-stale; it can never
mean "verified fresh". A `verified:` date is a **claim**, and nothing distinguishes "driven
yesterday" from "dated yesterday".

## Upkeep — the pass that keeps a map alive

A map rots the moment the app changes, so it needs a periodic pass, not a one-time write. One
person (or one agent) per pass, in this order, with an edit scope limited to the map's own
directory:

1. **Index hygiene.** Run `goblin-verify --only FM-01` and fix the index and the four-H2
   contract.
2. **Source wave.** One read-only subagent (or one focused read) per feature file, launched
   concurrently: it reads the app and reports what the file now gets wrong. **Children never
   drive and never edit.**
3. **Reconcile.** Apply only the corrections the source wave proved; a correction the subagent
   could not evidence is left alone and named.
4. **Live pass.** Drive every feature at least once, with the command in the file. Run the
   project's declared doctor (`verify_doctor:`, enforced by `VA-01`) before the first drive and
   after any failed one. A feature that cannot be reached is *verified-unreachable* only with the
   concrete prerequisite and the route attempted — never reported as verified through another
   path.
5. **Triage.** Sort findings into **doc drift** (the map was wrong), **harness gap** (the map was
   right and the check did not exist) and **product gap** (the app is wrong). Doc drift and
   harness gaps ship; a product gap is reported and kept out of the map's change.
6. **One pull request of proven corrections**, re-reading every changed file first, and advance
   `verified:` only for features actually driven. The outcome is one of `clean` / `changed` /
   `blocked`, stated in writing.

## The commands

```
goblin-verify --only FM-01     # the index and the four-H2 entry contract
goblin-verify --only FM-02     # every entry path still resolves; no entry path changed after verified:
goblin-verify --only VA-01     # the declared verify_doctor: exits 0
```

## What this cannot see

- **A feature nobody listed.** The map is a list; whether the list is complete needs semantic
  judgement over the app, and no command in this repo answers it. That is why it is a note here
  and not a row.
- **Whether a recipe drives the *right* path rather than a convenient one.** The map lists entry
  points; the driver still chooses.
- **Whether a `verified:` date means anything.** The row proves the entry path still exists; it
  cannot tell a feature driven yesterday from a date typed yesterday.
- **A defect the project's own assertions do not cover.** That is the mutation pass's job, not the
  map's.
- **Behaviour changes that leave the file alone.** `FM-02` watches files, and a behaviour can
  change without one.
