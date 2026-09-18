# PACKAGE-L — Multi-diagram-type: theme foundation, preset spine, flowchart / C4 / ERD

**Sources (read these — they carry the evidence, citations and exact code anchors):**
- `SYNTHESIS.md` — the reconciled plan (ADD / CHANGE / REMOVE).
- `/home/harvey/diagram-studio-research/C4-themes-presets.md` — theming mechanism, token tables,
  the `DiagramPreset` type (§E.2), the five switch points (§E.3), C4 data shape (§D.5 + templates §D.6).
- `/home/harvey/diagram-studio-research/C1-flowchart.md` — ISO 5807 shape table, vertical handles,
  branch labels, the layout/back-edge bug, the "Approval request" template (§4.4).
- `/home/harvey/diagram-studio-research/C2-erd.md` — table node, crow's-foot markers, `showMode`, the
  `users/orders/order_items` template.
- `/home/harvey/diagram-studio-research/C3-nodeux.md` — typed ports, compatibility module, status.

**Goal:** make Diagram Studio able to draw architecture **and** flowchart / C4 / ERD from ready-made
type presets, with light + dark (+ extra) themes — without forking the app. Keep everything generic
(this tool will be shared). English artifacts. No new dependency unless this spec names one.

**Do NOT regress:** undo/redo, box-select, align/distribute, resize, snap, search palette, icon picker,
edge inspector + all six flow modes, tooltips (H/T/I/J/K work), boards CRUD + autosave, PNG/SVG/JSON
export + JSON import, hover choreography + perf guard, glow handles, post-it (actor/note).

---

## SCOPE ORDER — implement L0 → L3 in this order, verifying each before the next.

### L0 — The four audit bug fixes (already applied by the orchestrator — verify only)
Already done in `src/styles.css`:
1. `.react-flow__edge-textbg` duplicate declaration removed (single rule now at the C6 block).
2. `.react-flow__edge-textbg` uses `var(--elevated)` instead of a hard hex.
3. `--card` is now declared in `:root` (was used but undeclared).
4. `@keyframes ds-node-pulse` uses `color-mix(… var(--sel) …)` instead of a hard `rgba(...)`.
**Task:** confirm `tsc`/`build` = 0 and that the edge label capsule + node pulse still render.

### L1 — Theme foundation (light + dark + more)
1. **Two-layer tokens** in `src/styles.css`: keep the current `:root` values as the **dark** layer
   (byte-identical, no visual change), move them into `[data-theme="dark"]`, and add `[data-theme="light"]`,
   `[data-theme="paper"]`, `[data-theme="midnight"]`, `[data-theme="contrast"]` blocks with the token
   tables from `C4-themes-presets.md §A.4`. Add `color-scheme` per theme.
2. **Symbolic colours (the crux).** Node/edge colours are stored as literal hex in the board JSON
   (`data.color`, `style.stroke`, `markerEnd.color`). Add a `ColorKey` union (the 6 accents + slate
   etc.) and `resolveColor(key)` reading the live theme's CSS variables; migrate legacy hex on board
   load via a `LEGACY_HEX` map. The inspector's colour swatches switch from raw hex to keys.
   `<markerEnd.color>` must derive from the key. **This must not touch `shapes.tsx`'s 9 shapes** —
   `--nc` already cascades the node accent; only the *stored* colour becomes symbolic.
3. **Theme controller + React Flow `colorMode`**: `applyTheme(name)` sets `document.documentElement`
   `data-theme` (+ persists in localStorage), and `<ReactFlow colorMode={isDark ? 'dark' : 'light'}>`.
   RF's `colorMode` only themes its own `--xy-*` vars — our tokens do the rest.
4. **Theme-aware exports** (`App.tsx` export paths around ~1241/1245-1247/1292) so PNG/SVG use the
   live theme.
5. **Theme picker UI** (small, in the existing options/panel area): dark / light / system / paper /
   midnight / contrast. `system` resolves via `matchMedia`.
**Verify:** toggle each theme; measure a node's computed accent + `document.documentElement` dataset;
confirm a legacy board (hex colours) still renders correctly after the migration.

### L2 — The preset spine
1. **`src/presets.ts`** — the `DiagramPreset` type exactly as specified in `C4-themes-presets.md §E.2`
   (`palette, extraShapes, edges, layout, theme, guidance, templates, caps`), plus `LAYOUTS` registry.
2. **`BoardDoc` gains `preset?: PresetId`, `theme?: ThemeName`, `legend?: boolean`** (`src/boards.ts`).
   No backend change (the boards API stores arbitrary JSON; old boards default to `architecture`).
3. **Five switch points** wired per `§E.3`: palette (parameterise the `PALETTE` import), shape union
   (additive), edge defaults (one `makeEdge(source,target,preset)` factory replacing the 4 ad-hoc edge
   objects), layout (`LAYOUTS[preset.layout.engine]` — keep the K3 CSS transition wrapper), theme
   (suggest, never force).
4. **Preset picker** (three entry points per `§E.5`): New-board choice, board-menu "Diagram type…"
   (with the keep-existing warning), and a preset badge in the board list.
5. Ship `architecture` (behaviour-identical) + `custom`/`blank` (palette = union of everything, for
   blending) first. **Nothing may visually change** with `architecture`.

### L3 — The three real presets
**3a. `flowchart`** — the smallest real preset, proves the whole mechanism.
- **Vertical handles:** add `data.handles?: 'lr' | 'tb'` rendered in the shared handle block
  (`DiagramNode.tsx`); flowchart default `'tb'` (Top target / Bottom source). Without this no flowchart
  is readable.
- **9 new shapes** (ISO 5807) added to the `Shape` union + `ShapeFrame` + `ShapePreview` + `RESIZABLE`:
  `terminator` (stadium), `process` (rect), `decision` (diamond), `io` (parallelogram), `document`
  (wavy bottom), `subprocess` (double-bar rect), `manual` (trapezoid), `delay` (D-shape),
  `connector` (small circle). `preparation` = ADAPT the existing `gateway` hexagon geometry as its own
  case (do not ship a second hexagon).
- **`label-only` node body** variant (one centered sentence, no kicker/sub/metric) for flowchart nodes.
- **Layout fix:** `src/layout.ts:49` collapses every back-edge/unassigned node onto layer 0 — a
  retry loop breaks the diagram. Either make the layering direction-aware and place back-edges, or use
  an ELK-style layered engine with fixed-order ports (Ameliorate's config is in `C1 §3.2`). Keep it
  dependency-free if possible.
- **Starter template:** the "Approval request" template from `C1 §4.4` (pools, 2 lanes, a decision with
  Yes/No, a connector pair, and a deliberate loop-back) — it doubles as the layout regression test.

**3b. `c4`** — needs **zero new shapes**.
- `c4Type` table (`§D.5`) mapping each C4 element type to `{level, shape, colorKey, kicker}`.
- Edge defaults: dashed unidirectional, `smoothstep`, marker arrow, intent-label presets
  ("uses" / "reads-writes" / "sends events to").
- Two templates: **C4 Context** and **C4 Container** (`§D.6`, canonical verbatim labels).
- A legend panel (`legend` in BoardDoc) + a `techn` dim field after the label.
- Drill-down = linked boards + breadcrumb (sub-flows already work); L3/L4 = empty templates only.

**3c. `erd`** — the one genuinely new node type.
- **`table` node** (new `nodeTypes` entry, not a `Shape`): table name + collapsible column list;
  each column = name + mono type + badges (PK via `KeyRound` in the accent; FK name-coloured;
  NOT NULL = filled vs hollow dot); right-aligned mono type faded until hover.
- **Column-to-column handles** (`left_rel_/right_rel_<fieldId>` per row) so FK edges attach to the
  column, not the card.
- **Crow's-foot markers** (3 hand-drawn SVG markers: ring=zero, bar=one, foot=many) as new marker
  types; relationship labels `1:N` etc. Extend the cardinality model to express **zero-or-one**
  (ChartDB can't — beat it).
- **`showMode`** (`ALL_FIELDS` / `TABLE_NAME` / `KEY_ONLY`) — the cheapest large-schema feature found.
- Starter template: `users / orders / order_items` (deliberately teaches enum, associative table,
  nullable, unique).
- **Defer** DDL import/export and ChartDB's single-query path to a later package.

---

## Verification (measured, not vibes) — required before reporting
1. `npx tsc --noEmit` = 0 · `npx vite build` = 0.
2. **L1:** each theme toggles `document.documentElement.dataset.theme`; a node's computed accent changes
   accordingly; a legacy-hex board loads and renders correctly (print the resolved colours).
3. **L2:** with `preset='architecture'` the app is byte-identical in behaviour (palette, edge defaults,
   layout all unchanged); switching to `custom` shows the union palette; switching preset does NOT
   rewrite existing nodes.
4. **L3:** create a flowchart board from the template → vertical handles present (`data-handlepos`),
   the decision node has Top/Bottom ports, the loop-back edge lays out without collapsing to layer 0;
   C4 preset renders both templates; ERD preset renders the table node with column badges + a
   crow's-foot FK edge.
5. No regression on H/T/I/J/K features; leave the demo board `Kafka rebalance` clean (3n/2e) and delete
   any board you create while testing.
6. Report a table per scope item (L1–L3) with the measured evidence + any deviation and why. Say
   explicitly what could NOT be verified headlessly.
