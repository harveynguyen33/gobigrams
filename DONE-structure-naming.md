# DONE — Structure & Naming Convention Round (shipped 2026-10-25)

Status: **COMPLETE** 2026-10-25 19:2x. Executed as NS-1…NS-4 on `develop`, one green
commit per item. The plan as approved is kept verbatim below this header — it is the
record of what was asked; this block is the record of what happened.

## Completion record

| Item | Commit | What landed |
| --- | --- | --- |
| NS-1 | `c4284fd` | `checks/naming-convention.mjs`, AST-based, wired into the sweep — **RED by design**: 9 violations at HEAD `0f08d17` (sweep 79/80) |
| NS-2 | `13a42a5` | the nine renames, import specifiers re-resolved, harness anchors + budget keys re-pointed |
| NS-3 | `2f3c579` | `src/export/`, `src/nodes/`, `src/dialogs/` (20 moves, no renames, no logic change) |
| NS-4 | this commit | docs re-pointed (features/README coverage note, README-PUBLIC layout table) + this file renamed from PLAN- to DONE- |

**Violations: 9 → 0.** The plan estimated "~20" before measuring; the codified rule
found 9 real breakages, and every example the plan named is among them: `EdgeData.ts`,
`crowfoot.tsx`, `pickers/art.tsx` (plus rows/section/stepperFlow, settings/controls,
settings/panes and `pickers/popover.tsx` — a `.tsx` that renders no JSX). The three
ambiguous modules the plan wanted kept are pinned in the harness allowlist WITH reasons
(InspectorPickers re-export shell, boardUtils shared kernel, shapes registry), and a
stale allowlist entry fails the harness, so the list cannot rot.

**src/ root: 75 loose files → 55** (20 moved into family dirs; hooks, the composition
root and the shared kernel stay, by design).

**Gates at the final commit:** `npx tsc --noEmit` 0 · `vite build` 0 · sweep **80/80**
(79 harnesses + the new naming check) · `goblin-verify` **22 passed, 0 failed** ·
`checks/file-size-gate.mjs` PASS (98 files, 2 hard caps) · client JS **934,675 bytes**,
identical to the pre-round build · `dist/` still emits `exportSvg` as its OWN async
chunk · dev server 200 and the canvas mounts.

**Deviations from the plan, with reasons:**

1. The plan's item 4 also said "naming rule added to AGENTS.md". Not done: this round is
   barred from touching AGENTS.md. The rule lives in the harness (which fails builds) and
   in `features/README.md`; AGENTS.md can cite it in a later, separately-approved edit.
2. `FeedbackDialog.tsx` stays at `src/` root (the plan hedged with a "?"). It is
   feature-pinned by `features/feedback.md` and the BG harnesses; moving it would re-anchor
   a pinned surface for no structural gain.
3. The plan's item-3 "manualChunks paths updated" was a no-op: `vite.config.ts` has no
   `manualChunks` entry, chunk naming follows the module basename, and the post-move build
   produced byte-identical chunk names — the separate lazy chunk is verified, not assumed.

---

# PLAN (as approved, verbatim) — Structure & Naming Convention Round

Status: PROPOSED (2026-10-25). No file has been touched. Execute ONLY after Harvey
approves — ideally AFTER the CF Pages deploy is live (this round is invisible to users
but touches ~80 files; do it when the release train is already proven, not before).

## Research summary (industry practice)

Three conventions dominate; the winner for this codebase is the **pragmatic React
mainstream** (Next.js, Vite templates, Shopify Polaris,大多数 production apps):

1. **File naming — ONE rule, no exceptions:**
   - `.ts/.tsx` non-component modules → **camelCase** (`useUndoHistory.ts`, `edgeLabel.ts`)
   - `.tsx` files whose primary export is a React component → **PascalCase**
     (`DiagramNode.tsx`, `Toolbar.tsx`)
   - Directories → **camelCase or single lowercase word** (`edges/`, `presets/`, `pickers/`)
   - (Full-kebab `components/user-profile/` à la Bulletproof React is also valid but
     requires renaming EVERYTHING — 97 files — for zero functional gain. Rejected.)

2. **Folder layout — type-sliced with family dirs (already ours):**
   `hooks stay at src/ root (use* prefix self-documents), families get dirs
   (edges/, presets/, settings/, pickers/, components/), App.tsx = composition root.
   This is the Vite/Next mainstream shape; feature-folders only pay off at team scale.

3. **Enforcement — a lint-ish harness, not discipline:**
   New `checks/naming-convention.mjs` (RED first: 20 violations today → green after
   renames; added to the sweep so regressions are impossible).

## Current state (measured, not guessed)

- 97 src files: 72 camelCase, 25 PascalCase — but **20 rule violations**:
  - 11 PascalCase files that are NOT components (EdgeData.ts, Settings.tsx shell …)
  - ~9 camelCase .tsx that ARE components (crowfoot.tsx, pickers/art.tsx …)
- 75 loose files at src/ root — the real readability cost is not case, it's that
  root is a junk drawer: export cluster, node renderers, dialogs, pure utils all mixed.
- 73 checks/ files reference `src/…` paths — every rename must re-anchor harnesses
  (the BN rounds' union-reader pattern applies).

## The moves (4 sequential items, one green commit each)

1. **naming-convention.mjs harness (RED)** — codifies the rule above; 20 failures
   prove it measures something. Commit with the plan link.
2. **Fix the 20 violations** — rename only the rule-breakers:
   - `edges/EdgeData.ts` → `edgeData.ts`; `InspectorPickers.tsx` (11-line shell) stays
     PascalCase-adjacent? NO — it re-exports components, so it keeps PascalCase. Actual
     renames: EdgeData→edgeData, crowfoot.tsx→Crowfoot.tsx (component), pickers/art.tsx
   → pickers/Art.tsx (component), … full list generated by the harness output.
   - Every rename: update import sites + `git grep` harness/checks anchors + touch
     importers (Vite stale-transform trap).
3. **Relocate loose files into family dirs** (imports only, no renames users see):
   - `src/export/` ← exportSvg.ts, exportScene.ts, exportPng.ts, printView.ts,
     textOutline*.ts, fontFiles (lazy chunk intact — manualChunks paths updated)
   - `src/nodes/` ← DiagramNode, CustomShapeNode, TableNode, LabelNode, shapes.tsx,
     crowfoot, customShape, flowIcons, checklist(?)
   - `src/dialogs/` ← BoardDialog, FeedbackDialog(?), ExportModal, TemplatesGallery, Tour
   - pure utils stay at root (palette.ts, layout.ts, colors.ts …) — they are the
     "shared kernel", root is their correct home.
4. **Feature map + README layout table + file-size-gate budget keys** re-pointed;
   naming rule added to AGENTS.md (the AI-authored write gate stays; orchestrator
   proposes, Harvey approves per the standing rule).

## Budgets & risks

- ~80 files touched, but ~60 are one-line import-path edits. Estimate: 2 coder rounds
  (BN-style delegate), not one giant pass.
- Risks: (a) Vite stale transform after moves — touch importers (known trap);
  (b) esbuild case-collision (feedbackDialog precedent) — rename checks in the harness;
  (c) lazy chunk paths in vite.config manualChunks — build gate catches.
- Gates per commit: tsc 0 · build 0 · sweep 79/79 (re-anchored) · bytes ≤ 934,461
  (renames add zero bytes) · naming harness green.

## What this does NOT do (deliberately)

- No full-kebab conversion (97 renames, zero gain).
- No feature-folder restructure (type-slicing is correct at solo scale).
- No changes to boards/, storage keys, or anything user-visible.
