# ROUND-AQ-SPEC — type scale + spacing scale consolidation

Base: `4920b0b6` line (PACKAGE-S head). The two deferred rounds from ROUND AP,
merged into one because they touch the same sheet and the same risk class:
every change moves real pixels that pinned harnesses measure.

## Measured today (recon 2026-10-12)

**Type — 16 distinct sizes** (uses in parens):
9(3) · 9.5(12) · 10(22) · 10.5(30) · 11(30) · 11.5(16) · 12(21) · 12.5(11) ·
13(10) · 13.5(1) · 14(3) · 14.5(2) · 15(4) · 16(1) · 20(1) · 26(1)

**Space — ~30 distinct px values** in padding/margin/gap/offsets; the long tail
(2.5, 13, 15, 21, 26, 30, 32, 34, 38, 40, 44) is where the drift lives.

## AQ-1 — the type scale (8 steps)

New tokens at the top of styles.css (a `--ts-*` block under the existing token
layer — zero new hex, this is a value refactor):

| token | value | absorbs |
|---|---|---|
| `--ts-2xs` | 9px | 9 |
| `--ts-xs` | 10px | 9.5, 10 |
| `--ts-sm` | 11px | 10.5, 11 |
| `--ts-md` | 12px | 11.5, 12, 12.5 |
| `--ts-lg` | 13px | 13, 13.5 |
| `--ts-xl` | 14px | 14, 14.5, 15 |
| `--ts-2xl` | 16px | 16 |
| `--ts-display` | 26px | 20, 26 |

Mapping rules (conservative, no size jumps):
- 9.5→10, 10.5→11, 11.5→12, 12.5→12 (down-half-steps collapse to the step below
  for 12.5 — 13 would grow every inspector row), 13.5→13, 14.5→14, 15→14,
  20→16 (the single 20px is a pane heading; 26 would balloon it).
- `26px` stays 26 (`--ts-display`); the single 16px stays 16.
- Every `font-size: Npx` in styles.css becomes `font-size: var(--ts-*)`.
- The 11.5px table-card font (round-aj pins `11.5px`) goes to 12 — harness
  re-anchored in the same commit (house rule: re-anchor + RED replay).
- package-p-inspector's width arithmetic (10.5px labels) re-measured: 10.5→11
  adds ~5% to those label widths; its slack assertions have 6px headroom —
  re-run, re-anchor if the slack line moves.

## AQ-2 — the spacing scale (no new tokens; a value map)

Keep raw px (spacing tokens would touch 700+ declarations for no runtime gain) —
the deliverable is a REDUCED VALUE SET, enforced by a new ratchet harness:

Allowed: 1 · 2 · 3 · 4 · 6 · 8 · 10 · 12 · 14 · 16 · 18 · 20 · 24 · 32 · 40
(kills: 2.5, 5→4 or 6, 7→6 or 8, 9→8 or 10, 11→10 or 12, 13→12 or 14, 15→14 or
16, 21→20, 22→24, 26→24, 30→32, 34→32, 38→40, 44→40)

- Positioning offsets (top/right/bottom/left used for absolute placement) are
  OUT of the map's scope — they are geometry, not rhythm; consolidating them
  moves real hit targets. Padding/margin/gap only.
- New harness `checks/round-aq-scales.mjs`: parses styles.css, asserts every
  padding/margin/gap px value is in the allowed set (RED replay on the pre-AQ
  tree), and asserts every font-size is a `var(--ts-*)` (zero raw px font-size
  outside the token block).

## What this round deliberately does NOT do

- No visual redesign: every mapping is ±0.5–1px on micro-typography or a
  long-tail spacing value. Harvey reviews the result on device; any "this got
  worse" is a per-site revert, not a scale change.
- No component refactors, no React Flow internals.

## Gates

tsc 0 · build 0 · gob-verify 22/0/5 · hex 144 ·
re-run by hand: package-p-inspector, round-aj-table-handles, round-aa (10.5px
label), round-ai-body-valign, round-v-overflow, package-o-metrics, round-r-label-resize
— each re-anchored in its own commit if its pins moved, with the reason.
`boards/` byte-identical.
