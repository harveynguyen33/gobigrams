# The ban list — forbidden must fail mechanically

`manifest/bans.tsv` is the table; `bin/goblin-bans` is the engine; this directory holds the
probes. Dune's rule 2, made a gate: **a ban without a mechanism is a wish.** A ban enters
`bans.tsv` only with a real command in its `detect` column, or it does not enter at all.

## How a ban is run

```
.gob/bin/goblin-bans              # every ban the config's `bans:` list turns on
.gob/bin/goblin-bans --only BN-01 # one ban
.gob/bin/goblin-bans --list       # the table
```

A `detect` command runs from the repo root and exits

| exit | meaning |
|---|---|
| 0 | the tree is clean |
| 1 | the ban is violated — the exit code alone is the signal; stdout, when any, names the offending lines |
| 2 | the check could not run — **fail closed**, never a silent pass |
| 3 | nothing to check (e.g. no `layers:` declared) — SKIP with that reason |

A ban the config does not name is SKIPPED with that reason; a ban whose `globs` match no file
is SKIPPED with that reason. An empty or missing table is **exit 2**.

## Narrow exceptions (Dune rule 5)

Two escape hatches ship, and both are filtered **before the exit code is chosen** — a filter
applied to a probe's stdout afterwards cannot change a verdict, so it would be decorative, and
every violation inside an exempted path would be a permanent RED with no remedy (that was
**W5-1**, measured `rc 0` at `72490f0` → `rc 1` at `7fec08f`).

```
bans_exempt:                 # in the AGENTS.md gob block — a path prefix, or a whole path
  - BN-03 src/legacy         # <ban id> <path prefix>: that ban, that path, nothing else
```

```
export const a: any = 1;    // BAN-OK(BN-01): the value is narrowed at the boundary
```

An inline escape clears **one line** for **that ban**; a non-empty reason after the colon is
required, so `BAN-OK(BN-01)` on its own is not an escape. Path exemption is segment-aligned and
compared as written: `src` exempts `src/a.ts` and `src/legacy/b.ts`, never `src2/c.ts`, and a
prefix carrying a trailing slash (`src/legacy/`) strips nothing, so it matches no file and exempts
nothing - write the prefix without one. Both shipped probes are controlled in
`tests/t-verify-red.sh` (AA1): the trailing-slash case is the LAYER probe's control (`BN-05`, AA1
§7-6), and the same rule holds for the ban probe - measured on `BN-01`: `- BN-01 src` PASSes,
`- BN-01 src/` FAILs, because it exempts nothing.

The engine passes both to the probe through its environment rather than editing stdout:

| variable | meaning |
|---|---|
| `GOBLIN_BANS_ID` | the ban being probed — what an inline `BAN-OK(<id>)` must name |
| `GOBLIN_BANS_EXEMPT` | newline-separated path prefixes this ban exempts |

`bans/grep-ban.sh` and `bans/layer-check.sh` honour both (the layer probe honours the path list
only — its documented escape is `layers:` or a move, not an inline marker). A project's **own**
probe that ignores the variables keeps the old behaviour: a violation inside an exempted path
stays RED. That is deliberate — the failure is **closed**, never open — and it is recorded in
`docs/LIMITS.md`.

## No npm, no AST

The engine uses `bash`/`grep`/`awk` only — the dependency contract in `docs/GUIDE.md`. So
these are **text probes**, not AST checks: a `: any` inside a string or a comment is reported,
and `Record<string, any>` (no leading `:`) is missed. The AST-grade form of the same bans needs
a parser the contract does not allow; that gap is `docs/LIMITS.md` #27, stated rather than
hidden. A text probe with a known false-positive set is still a gate — it goes red on the move
it forbids — which is what a ban is for.

## Turning a ban on

```yaml
bans: [BN-01, BN-02, BN-05]      # the bans this project turns on; an unlisted ban SKIPs
bans_exempt:                     # narrow, explicit, reviewed (Dune rule 5)
  - BN-03 src/legacy             # <ban id> <path prefix>
layers:                          # what BN-05 reads; "<from> <to>"
  - src/renderer src/main
```
