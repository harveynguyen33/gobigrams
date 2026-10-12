# Diagram Studio — synthesis: what to ADD / CHANGE / REMOVE

**Date:** 2026-09-14 · **Sources:** the four cluster reports in this directory (`C1-flowchart.md`,
`C2-erd.md`, `C3-nodeux.md`, `C4-themes-presets.md`), each evidence-based and cited. Every
code-critical claim below was re-verified by the orchestrator against the current source, not taken
from the subagents' word. **No code has been changed.**

**Harvey's goal (verbatim):** draw more than architecture — flowchart, DB diagrams, etc.; either
support all types or offer ready-made type presets per diagram kind; flexible; include dark **and
light** mode (and other interesting modes).

## The headline

1. **The preset system IS the answer to the whole request.** One `BoardDoc.preset` field that switches
   the palette, the shape defaults, the edge defaults, the layout engine *and* the theme — without
   forking the app. React Flow ships **no** diagram-type presets at all (67 official examples, zero
   ERD/mindmap/sequence presets), so this is a differentiator, not catch-up.
2. **Light mode is blocked by ONE non-obvious thing:** node/edge **colours are stored as data**
   (`data.color: "#f54e00"`, `style.stroke: "#94a3b8"` — verified in a real saved board). No theme can
   recolour a hex string saved in the document. So light mode needs a **symbolic-colour refactor**
   (`ColorKey` + `resolveColor()` + a legacy-hex migration on load), not just CSS tokens. This is the
   single most important change of the whole programme.
3. **C4 is the cheapest high-value win:** Diagram Studio already has 8 of the 9 C4 primitives
   (`external` = dashed rect, `database`/`storage`/`queue` = C4 Db/Blob/Queue, `group` = boundary with
   reparent-on-drop). C4 needs **zero new shapes** — only conventions (`c4Type`, intent-label presets,
   a legend, two starter templates).
4. **Four real bugs surfaced during the audit** and should be fixed regardless of any feature work
   (see Phase 0).
5. **Honest limit:** "all diagram types" is not achievable, and chasing it would mean forking React
   Flow's free-form editing model. Four families get an explicit **SKIP** with reasons (see below).

## The plan, in build order

### Phase 0 — bug fixes found by the audit (do first; low risk, no design needed)
| # | Bug | Location | Evidence |
|---|---|---|---|
| 0.1 | `.react-flow__edge-textbg` double-declared — the `:315` rule is silently lost to `:490` | `src/styles.css:315` vs `:490` | verified |
| 0.2 | `ds-node-pulse` hard-codes `rgba(59,130,246,…)` instead of `var(--sel)` | `src/styles.css:857–861` | verified |
| 0.3 | `--card` is used but **never declared** (falls back to `--bg`) | `src/GoblinEdge.tsx:155` | verified |
| 0.4 | `opacity: 1.6` is out of range (clamps to 1 — likely meant something else) | `src/styles.css:621` | verified |

### Phase 1 — theme foundation (makes light mode actually work)
- Layer-1 tokens + `[data-theme="…"]` blocks; `color-scheme`; `applyTheme()` + `colorMode={isDark?'dark':'light'}`.
- **Symbolic colours (the crux):** `ColorKey` + `resolveColor()` + `LEGACY_HEX` migration on board load
  + key swatches in the inspector + `<markerEnd.color>` from the key. `--nc` then cascades the theme
  through all 9 shapes with **zero edits to `shapes.tsx`**.
- Theme-aware exports (`App.tsx:1241, 1245-1247, 1292`).
- Ship **light** + keep **dark byte-identical**. Then `paper` / `midnight` / `contrast` cost ~20 lines each.
- Note: React Flow's own `colorMode` only themes ~24 `--xy-*` vars (dots/minimap/controls/default
  handles) — it will **not** recolour our arrows, because our edges always pass an explicit
  `markerEnd.color`. We must drive our own tokens ourselves.

### Phase 2 — the preset spine
- `BoardDoc.preset` (board metadata, survives the existing boards API + JSON round-trip unchanged) +
  the `DiagramPreset` type + 5 switch points.
- Ship `architecture` (behaviour-identical default) + `custom`. This proves the mechanism with no
  visual change.

### Phase 3 — the first three real presets (each proves a different axis)
- **`flowchart`** — vertical handles (`data.handles` Top/Bottom), **9 new shapes** (ISO 5807:
  terminator, process, decision, io, document, subprocess, manual, delay, connector), a `label-only`
  node body, `smoothstep`/short-label edge defaults, and a **layout fix for back-edges** (today
  `src/layout.ts:49` collapses every loop/retry node onto layer 0). Ships with the "Approval request"
  starter template.
- **`c4`** — no new shapes; `c4Type`, intent-label presets ("uses"/"reads-writes"/"sends events to"),
  dashed unidirectional edge defaults, a legend panel, two templates (Context + Container), and
  linked-board drill-down (L3/L4 = empty templates).
- **`erd`** — the one genuinely new node type: a **`table` node** (columns with name/type/PK/FK/NOT NULL
  badges, collapsible), **column-to-column handles**, crow's-foot markers (zero/one/many, hand-drawn
  SVG), and Liam's `showMode` (`ALL_FIELDS`/`TABLE_NAME`/`KEY_ONLY`). Starter: `users/orders/order_items`.

### Phase 4 — generic node-UX upgrades (apply across all presets)
Compact node renderer + board "compact" toggle · typed ports (opt-in) · one `graphRules` compatibility
module with human-readable refusals · connection-line validity colours (green/red/neutral) · node
status (badge + border + ring) · semantic edge kinds (depends-on / sends-to / contains / relates-to) ·
grouping management + sticky notes as frames · keyboard-centric creation for mindmap (Tab child /
Enter sibling) · Shift-hold focus+context dimming · hover-revealed toolbars.

### Later, if wanted
`mindmap` (radial layout — cheap) → `network` (decide icon pack first: `react-icons@5.7` dropped
`SiAmazonwebservices`/`SiMicrosoftazure`; `aws-icons@3.3.0` MIT is the fallback, no maintained Azure
package) → `roadmap` / `logic`.

## REMOVE / explicit non-goals (honest)
- **Diagram families:** `sequence` (needs a constrained layout that fights React Flow's free-form
  model), `UML` class/state (no custom-marker primitives), `BPMN` (`bpmn-js`'s licence *requires*
  keeping its watermark), `Kanban` (not a graph). Each is a fork, which the design rules out.
- **The entire runtime layer:** run/pause/retry/logs/variables, node catalogues, LLM/agent/tool/MCP
  nodes, Flow State, JSON-Schema pin propagation, component versioning, AI expand/flashcards. Every
  tool with these is solving a different problem; Diagram Studio's job is to *draw*, and its edge is
  drawing *many types* well.
- **Not now:** elkjs, DBML, AT-Protocol sharing, AI generation, index badges on canvas, Chen notation
  as a first-class mode (arrive later as a rendering toggle over the same data), ChartDB's
  "single-query" import path (defer until DDL import proves people import schemas).
- **Reconciliations I made between clusters:** C1 correctly counts **9** new flowchart shapes (C4's
  summary said "two"); follow **C1** for flowchart. For the `preparation` hexagon: **ADAPT the existing
  `gateway` hexagon's geometry but do not ship a second hexagon** (C1) — the meaning differs, so it
  becomes a `preparation` case in the shape map, not a reuse of `gateway`.

## Recommended decision
Do **Phase 0 + Phase 1 + Phase 2 + Phase 3(C4, flowchart, erd)** as the first coherent release —
that is exactly "flexible multi-type tool with ready-made presets and light/dark", and C4 is nearly
free. Phase 4 is the polish layer and can follow incrementally.
