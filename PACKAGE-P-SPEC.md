# PACKAGE-P — Inspector rebuild: per-type sections, icon pickers, progressive disclosure

**Status:** SPEC (design only, no code). Awaiting Harvey's review before any coder session.
**Sources of truth:**
- Research (grounded, upstream-verified): `/home/harvey/diagram-studio-research/excalidraw/` — `SYNTHESIS.md`, `X2-right-panel.md`, `X3-panel-by-type.md`, `X1-text-editor.md`, `ORCH-FINDINGS-icons-and-collapse.md`
- Pinned upstream: `github.com/excalidraw/excalidraw` @ `c0ad61c6743aef7623e641cd1460d757cc6cacf3`
- This app's source: `src/App.tsx` (inspector body ~4100–4603), `src/shapes.tsx`, `src/DiagramNode.tsx`, `src/LabelNode.tsx`, `src/IconPicker.tsx`, `src/panelCollapse.ts`, `src/styles.css`.

---

## 0. The three upstream facts this spec is built on (read these first)

1. **Excalidraw's panel has zero `<select>`.** Every control is an icon button / `trigger + popover` (`FontPicker*`: `FontPickerTrigger.tsx:37`, `FontPicker.tsx:105`, `FontPickerList.tsx:308`). We are *behind*, not *ahead*: our 12 bare `<select>`s are a regression against the reference. Copy the *pattern*; the exact icons are ours to choose.
2. **There is no accordion upstream.** `ls components/ | grep -iE "accordion|collapse|disclosur"` → empty. The frequency-driven mechanism is `CompactShapeActions` (`Actions.tsx:608-612`): same actions, two densities, rare controls folded behind popover triggers. "Rarely changed ⇒ behind a trigger" is the mechanism we reuse. Any collapse/disclosure we add is **OUR choice**, stated as such, not attributed to Excalidraw.
3. **Nothing renders beside the text while editing.** The panel stays live because *editing counts as a selection target* (`showSelectedShapeActions.ts:11-22`, `getTargetElements` in `selection.ts:215-231`). "Controls while typing" = keep the panel mounted, target the editing node, suppress blur-commit, hide duplicate/delete while editing. It is **not** a new floating toolbar.

Also note (from `SYNTHESIS.md §0.1`): Excalidraw's panel is **top-left**, not right. Our right-hand inspector is a **deliberate divergence**. We copy the *control vocabulary* and the *predicate architecture*; we do not copy the placement or the fixed section order.

---

## A. The per-type section map — the core deliverable

### A.1 The decision function

One pure function, mirroring `shapeActionPredicates.ts:88` (`getShapeActionPredicates()`). No React, no JSX, no conditionals scattered in render code.

**New file `src/inspector.ts`:**

```ts
import type { Shape } from './shapes';

/** The discriminated selection the inspector must render for. */
export type InspectorTarget =
  | { kind: 'edge' }
  | { kind: 'table' }
  | { kind: 'label' }
  | { kind: 'goblin'; shape: Shape; body: 'card' | 'label-only' };

export type SectionId =
  | 'content' | 'text' | 'style'          // goblin + label
  | 'label' | 'line' | 'markers' | 'cardinality' | 'flow'   // edge
  | 'columns' | 'showMode';              // table

export type InspectorSection = {
  id: SectionId;
  /** Whether the section starts folded behind a trigger (our choice — see §C). */
  collapsedDefault: boolean;
};

/** The single dispatch point. Returns the ordered section list for a target. */
export function getInspectorSections(target: InspectorTarget): InspectorSection[];
```

### A.2 The field-level predicates (the `comparisons.ts` equivalent)

The per-shape truth is **not** "all 19 shapes show the same Content panel" — that is precisely the gap. `src/DiagramNode.tsx` renders different fields per shape, and the inspector must match it:

| field | renders for | source |
|---|---|---|
| `kicker` | card + actor + note (NOT `group`, NOT `label-only`) | `DiagramNode.tsx:252, 307` |
| `title` | every goblin | `:253, 271, 292, 308` |
| `sub` | every goblin | `:254, 272, 294, 312` |
| `metric` / `metricUnit` | card + actor only (NOT `note`, NOT `group`, NOT `label-only`) | `:313-318` (note branch `:239-258` has no metric; group `:260-276` has none) |
| `icon` | card + actor + group + label-only (NOT `note`) | `:267, 291, 309`; note branch has no `IconGlyph` |

```ts
const hasKicker = (t: InspectorTarget) =>
  t.kind === 'goblin' && t.shape !== 'group' && t.body !== 'label-only';
const hasMetric = (t: InspectorTarget) =>
  t.kind === 'goblin' && t.shape !== 'group' && t.shape !== 'note' && t.body !== 'label-only';
const hasIcon = (t: InspectorTarget) =>
  t.kind === 'goblin' && t.shape !== 'note';
```

The render layer consumes these as `hasKicker(t) && <Field name="kicker" />` — the same shape as upstream's `predicates.x && renderAction(x)`.

### A.3 The truth table

Columns: **section** · **shown for which kinds** · **condition (code terms)** · **control type** · **collapsed by default?**

| Section | Shown for | Condition (code) | Control type | Collapsed default |
|---|---|---|---|---|
| **Content** | every goblin | `target.kind === 'goblin'` | text inputs, subset by predicates above | no |
| **Text** (NEW) | every goblin + label | `kind ∈ {goblin, label}` | icon pickers (size/weight/color/align) — §E | no |
| **Style** | every goblin | `kind === 'goblin'` | shape popover + body toggle + icon + color swatches | no (body toggle folded — §C) |
| **Table** | table | `kind === 'table'` | name/schema inputs | no |
| **Columns** | table | `kind === 'table'` | column editor rows | no |
| **Show mode** | table | `kind === 'table'` | 3-way segmented (already buttons) | no |
| **Label** | edge | `kind === 'edge'` | label input + position picker | no |
| **Line** | edge | `kind === 'edge'` | color swatches + width/style/curvature pickers | no |
| **Markers** | edge | `kind === 'edge'` | arrow head/start pickers | no |
| **Cardinality** | edge, ERD preset only | `kind === 'edge' && preset.id === 'erd'` | crow's-foot end pickers + derived readout | **yes** |
| **Flow animation** | edge | `kind === 'edge'` | flow buttons (already icon) + count/speed | **yes** |

The edge branch today is gated by `preset.id === 'erd'` for cardinality (`App.tsx:4307`); that gate stays, but the section additionally folds by default (§C).

---

## B. Every control's form — the icon-picker conversions

All 12 `<select>`s, each with a decision and a reason. The target is **zero bare `<select>`** in the panel.

| # | `<select>` (App.tsx line) | Decision | Reason | Exact icon per option |
|---|---|---|---|---|
| 1 | label position `4145` | **segmented icon picker** (3 buttons) | visual vocabulary: where the label sits along the edge | `Center` / `AlignStart` / `AlignEnd` (lucide) |
| 2 | stroke width `4162` | **icon picker** (5 options) | visual: line thickness | 5 `<line>`/`Minus`-based glyphs at increasing strokeWidth, or a single `Minus` with a width label |
| 3 | line style `4175` | **icon picker** (3) | visual: solid/dashed/dotted | `Minus` · dashed `Minus` · dotted `Minus` (3 `svg` line patterns) |
| 4 | curvature `4187` | **icon picker** (4) | visual: path shape | 4 mini path previews (bezier curve / smoothstep / step / straight) — `src/edgeBend.ts` already draws each |
| 5 | arrow head `4210` | **icon picker** (3) | visual: arrowhead | `none` (bare line) / closed triangle / open chevron — reuse `markerFor` (`App.tsx:470`) |
| 6 | head start `4219` | **icon picker** (3) | same as #5, mirrored | same, flipped |
| 7 | flow count `4261` | **stepper** (1–6) | numeric ordinal, no icon vocabulary; a `-`/`+` stepper beats a 6-item select | n/a |
| 8 | flow speed `4270` | **segmented row** (4) | ordinal words, short enough for inline buttons; not worth a popover | slow / normal / fast / very fast |
| 9 | crow's-foot source `4313` | **icon picker** (6) | visual: cardinality glyphs are the vocabulary | none · one (bar) · zero-or-one (ring+bar) · many (foot) · zero-or-many (ring+foot) · arrow |
| 10 | crow's-foot target `4332` | **icon picker** (6) | same as #9 | same, mirrored |
| 11 | node `shape` `4571` | **searchable popover** (19) | open list of 19 shapes with silhouettes — a live preview, not a bare select | each option = `ShapePreview` (`src/shapes.tsx:195`) + `label` + `hint` |
| 12 | node `body` `4580` | **2-button segmented toggle** | only 2 options (`card` / `label-only`, `App.tsx:4584-4585`) | "card" / "label only" |

**The conversion pattern to copy** is already in the codebase: `src/IconPicker.tsx` is a searchable popover with a trigger button, an icon grid, a "none" cell, and a raw-glyph fallback — the exact `FontPickerTrigger` + `Popover` shape from upstream. The `shape` picker (§11) reuses `ShapePreview` as its item art; the small option sets (§1–§10) are `trigger + popover` with **icon + label** items, per `FontPickerList.tsx:308`.

**Two existing controls already match the target and stay as-is:** edge *flow animation* (`App.tsx:4229-4255`, already 6 buttons), *flow icon* (`4286-4304`), *table column flags* (`4462-4474`), and *show mode* (`4497-4503`). Do not re-wrap these.

---

## C. Collapse / disclosure policy

**We do not build an accordion.** Upstream has none, and a home-made `<details>` accordion is more machinery than the ask needs. We follow the `CompactShapeActions` density idea instead:

- **Two sections fold by default** (the "rarely changed" set): edge **Cardinality** and edge **Flow animation** (§A.3, collapsed-default column).
- **One control folds, not a section:** the goblin `body` toggle sits behind the **Style** section's trigger rather than occupying a full row — it is a rarely-changed 2-way switch.
- **Expansion affordance:** a folded section renders as a single labelled trigger row (e.g. `▸ Flow animation`) that expands inline on click. Expanding is **not** a popover — it is a persistent inline reveal, so a user who needs cardinality can see it while also editing other fields. (This is the one place we deliberately diverge from upstream's popover-only compact mode, because a crow's-foot *picker with a derived readout* (`App.tsx:4350-4352`) wants more room than a popover gives. Stated here as our choice.)
- **State persists.** Expansion/collapse of each section is remembered under a new namespaced key **`diagram-studio:inspector-sections`** — a sibling of `diagram-studio:panels` (`src/panelCollapse.ts:33`). Stored as a JSON map `{ [sectionId]: boolean }`, tolerant-parse like `parsePanelState` (`panelCollapse.ts:48-65`), `try/catch` on write. The **default** (absent key) is the collapsed-default column in §A.3 — a fresh board shows Flow animation and Cardinality folded, Content/Text/Style/Line/Markers open.

Rationale for the split: Content, Text, Style, Line, and Markers are touched on nearly every edit session (architecture/flowchart/C4/ERD all rename nodes, re-style lines, set arrowheads constantly). Flow animation and crow's-foot cardinality are set once when a diagram is laid out and rarely revisited — exactly the "ít khi đổi" the user called out.

---

## D. Ordering by usage

Excalidraw's order is fixed (`Actions.tsx:167-224`) and its panel is top-left; ours is right-hand and driven by what a *solution architect* does on this board. Ordering is **our decision**, justified per kind:

**Edge** (top to bottom): **Label → Line → Markers → Cardinality → Flow animation.**
Justification: naming an edge (label) is the first thing anyone does after drawing it; line style/colour/width/curvature are the next-most-touched; arrowheads are set once per edge type; cardinality and flow animation are the least-touched and therefore sink to the bottom *and* fold.

**Goblin node**: **Content → Text → Style.**
Content (kicker/title/sub/metric) is the reason a node exists and is edited constantly. Text style (option B) is second — sizing/weighting/colouring titles is a frequent formatting pass. Style (shape/body/icon/colour) is third — the shape is picked at creation and rarely changed thereafter, but colour is frequent, so Style stays *open* while its `body` sub-control folds.

Within **Content**, keep the field order `kicker → title → sub → metric/unit` — it mirrors the node's visual render (`DiagramNode.tsx:307-318`) and the existing panel (`App.tsx:4542-4566`); re-ordering fields buys nothing and would churn muscle memory.

**Label node**: **Text → Text style.** (There is no Style section — a label has no shape/icon/colour beyond text colour, which lives in Text.)

**Table node**: **Table → Columns → Show mode.** (Unchanged from today; a table's name is primary, columns are its body, show-mode is a view toggle.)

---

## E. The Text section (option B) + editing behaviour

### E.1 Where it lives and what it controls

A new **Text** section, present for `goblin` and `label` targets (§A.3). It styles the node's *text-bearing fields*, confirmed from source:
- goblin: `kicker` / `title` / `sub` / `metric` (`src/DiagramNode.tsx:100-104`)
- label: `text` (`src/LabelNode.tsx:59`)

**Controls — final set:**

| Control | In / Out | Form | Notes |
|---|---|---|---|
| Size | **IN** | 4-step segmented (S/M/L/XL like upstream `FONT_SIZES` 16/20/28/36 — *our* scale, node text is smaller, pick a node-appropriate ladder) | applies to the whole node's text block |
| Weight | **IN** | 2-button toggle (regular / bold) | node title is already 700 (`styles.css:967`); bold applies to title+kicker |
| Colour | **IN** | reuses the existing colour swatch row (`swatchRow`, `App.tsx:3025`) — **colour keys, not hex** | text colour, distinct from the node outline `--nc` |
| Align | **IN** | 3-button segmented (left/center/right) | horizontal only; nodes are not vertically-aligned text containers |
| Font family | **OUT** | — | deliberate: the node already uses `--mono` for title/metric and `--sans` for kicker/sub (`styles.css:952, 967`). A single family control would be a lie; and the app ships only `--sans` / `--mono` (`styles.css:61-62`). A future sans/mono *per-field* toggle is possible but is not part of this spec. |
| Opacity / sloppiness / fill | **OUT** | — | no DOM/SVG analogue (`X3 §5`); not requested |

### E.2 Text values are style, not content — persistence

- Text style is **not** a new node type and **not** content. It persists in `node.data` under a single key, e.g. `data.textStyle = { size?, weight?, colorKey?, align? }`.
- **Theme-default inheritance:** a node with **no** `textStyle` (or missing fields) renders the theme default — no explicit style is stored, and the inspector shows the inherited value as "default" rather than writing anything. This is the same lazy-write pattern the app already uses for colour (`colorKey` vs derived `color`, `App.tsx:3030-3037`).
- **Nothing reads a section's presence** (§G confirms) — textStyle is additive data, an old board simply has none and renders as today.

### E.3 The §D editing behaviour — what changes vs what already works

The app **already has** the two hard parts. State them, don't rebuild them:

**Already works:**
1. `isEditable()` (`App.tsx:350-355`) bails the global key handler out of any `INPUT`/`TEXTAREA`/`SELECT`/`contentEditable` — so typing in the panel inputs and the label's in-place editor never triggers shortcuts. This is the `isWritableElement` equivalent (`X1 §2.4`).
2. The label node already has an **in-place `<textarea>` editor** (`LabelNode.tsx:106-191`) with `onBlur` commit, `⌘/Ctrl+Enter` commit, `Escape` cancel, and `nodrag` so selection inside the textarea isn't read as a node drag.

**What must change (the §D gap):**
1. **Panel stays mounted while editing.** Today the label's in-place editor runs *inside the node* while the panel's own `<textarea rows=4>` (`App.tsx:4523`) also edits the same `text` — **two writers for one field**. Remove the panel's label `<textarea>` and replace it with the Text section (size/weight/colour/align), which operates on the *editing* node. The panel's target is already `selected` (the double-clicked label *is* selected), so it stays mounted; confirm the panel does not unmount when the in-place editor sets `editing=true` (it does not today — `editing` is `LabelNode`-local state, invisible to the panel's `selected` read).
2. **Suppress blur-commit around panel clicks.** When a user clicks a Text-section control while the in-place editor is focused, the editor's `onBlur` would fire and commit. Copy upstream's `temporarilyDisableSubmit` (`X1 §2.5.4`): on pointer-down inside the inspector, hold the commit; on leaving it, restore. This is the single behavioural addition that makes "click the bold button while typing" feel right. (`saveCaretPosition`/`restoreCaretPosition` are the same trick, ~40 lines.)
3. **Hide duplicate/delete while editing.** See §H.6 — in this codebase single-node selection has no duplicate/delete in the panel at all (they exist only in the multi-select branch, `App.tsx:4377-4378`, which never co-occurs with in-place editing). So this rule is **largely a no-op here**; the spec keeps it as a guard on the multi-select branch only, not as new UI.

**Deliberately NOT changing:** the existing `Escape` = **cancel** / `⌘+Enter` = commit contract in `LabelNode.tsx:177-178`. This **diverges** from Excalidraw (where Escape *commits*, `X1 §5.3`), but it is already shipped and users rely on it; changing it is out of scope (flagged §H.1).

---

## F. Acceptance criteria (numbered, measurable)

Each is a harness probe in `checks/*.mjs` or a live-DOM measurement, following the house style in `checks/round-s-edge-bend.mjs` / `checks/package-o-metrics.mjs`.

1. **Zero bare `<select>` where a picker was specified.** A DOM probe on a selected edge asserts `document.querySelectorAll('.panel-body select').length === 0` after the rebuild; a static probe greps `src/App.tsx` for `<select` and asserts the only remaining `<select>`s (if any) are the two deliberately-kept ordinal controls (§B #7/#8) — and that those two are *not* inside a section §B marks as an icon picker. (Gate: the 12 enumerated selects are all converted per §B.)
2. **Per-shape section correctness.** For each of the four goblin shapes `note`, `group`, `actor` (card), and a `card` shape with `body:'label-only'`, assert the Content fields rendered match §A.2's predicates: `group` shows **no** kicker and **no** metric; `note` shows **no** metric and **no** icon; `actor` shows metric+icon; `label-only` shows **no** kicker and **no** metric. Probe: select each shape, count the rendered `.field label` names.
3. **Per-kind section presence.** Selecting an edge renders Label/Line/Markers/Cardinality/Flow (in that order); selecting a table renders Table/Columns/Show mode; selecting a label renders Text/Text-style and **no** Style; selecting any goblin renders Content/Text/Style. Probe asserts the ordered `[data-section]` attribute list per target.
4. **Collapsed-by-default assertion.** On a fresh profile (no `diagram-studio:inspector-sections` key), a selected edge renders Cardinality and Flow animation **folded** (their bodies absent, their trigger rows present); Content/Text/Style/Line/Markers are **open**. Probe toggles and asserts the `data-collapsed` state per section.
5. **Collapse persistence.** Expanding Cardinality, reloading, and re-selecting the edge restores the expanded state (read `diagram-studio:inspector-sections` from localStorage). Probe asserts the JSON round-trip.
6. **The editing panel survives typing.** Double-click a label node (opens the in-place editor), then click the Text-section "bold" button: assert (a) the editor does **not** blur-commit (the caret/draft survives), (b) the panel remains mounted and its target is still the editing node, (c) the bold value lands on the *editing* node's `data.textStyle`. This is the one probe that exercises the §E.3.2 suppression.
7. **No colour-literal regression.** The stylesheet's hex-literal count stays **≤ 127** (the current gate). New CSS uses existing tokens only (`var(--nc)`, `var(--sel)`, `var(--c-*)`, `var(--sans)`, `var(--mono)`, `--dim`, `--dim2`). Probe greps `src/styles.css` for `#[0-9a-fA-F]{3,8}` and asserts the count did not rise.
8. **Type/build gates stay green.** `npx tsc --noEmit` = 0 errors, `npx vite build` = 0.

---

## G. Migration + risk

### Migration (an existing board)
- **The panel is UI only — nothing reads a section's presence.** The new `data.textStyle` is additive; an old board has no `textStyle` and renders the theme default (§E.2). No schema migration, no board rewrite. Confirmed: the board JSON is produced by `presets.ts` (`make:` at `:375, 420`) and `boards.ts` (`:58`) with no knowledge of inspector sections.
- **No new npm dependency.** `lucide-react` and `ShapePreview` already exist for picker art; the popover pattern is copied from `IconPicker.tsx`, not a new library.

### Files that change
| File | Change |
|---|---|
| `src/inspector.ts` | **new** — `InspectorTarget`, `getInspectorSections`, the §A.2 predicates |
| `src/App.tsx` | replace the ~500-line inspector body (`:4100-4603`) with `getInspectorSections(selected)` → ordered render; delete the 12 `<select>`s; remove the label `<textarea>` (`:4523`); add the Text section; add §E.3.2 blur-commit suppression |
| `src/styles.css` | picker/popover/section styles, **tokens only** (no new hex) |
| `src/inspectorState.ts` | **new** (or fold into `panelCollapse.ts`) — `diagram-studio:inspector-sections` load/save, tolerant-parse |
| `checks/package-p-*.mjs` | **new** — the §F harnesses |

### Known fragile areas (do not regress)
- **The inspector is ~500 lines inside a 4,600-line `App.tsx`.** Extract to `src/inspector.ts` *as pure logic first* (§A.1 is React-free), keep the render in `App.tsx` but driven by the ordered section list — do not inline new conditionals.
- **`data.bendX`/`bendY` and the edge drag are recent and delicate** (`src/edgeBend.ts`, `App.tsx:360-378` documents the ROUND T removal of the bend slider). The curvature picker (§B #4) touches the same `type`/`PATH_TYPES` path as the old slider — do not reintroduce a `bend` write; the picker only sets `edge.type` and calls `rememberEdgePath` (`App.tsx:4197`), exactly as the current select does.
- **`checks/package-q-reconnect-endpoints.mjs` is known-stale.** Do not treat it as a live gate for this package; run it, but record its result rather than blocking on it.
- **Two editors must not both write `text`.** Removing the panel's label `<textarea>` (§E.3.1) is what closes the double-writer; if it is left in place while the Text section is added, the label branch has three writers for one field.

---

## H. Decisions I had to make, and conflicts

1. **Escape semantics conflict — RESOLVED BY THE ORCHESTRATOR: keep Escape = cancel.**
   This codebase's label editor cancels on `Escape` (`LabelNode.tsx:178`), whereas Excalidraw commits on Escape
   (`X1 §5.3`). The task's fact 3 said "suppress blur-commit" and was silent on Escape. **Decision: leave
   Escape = cancel, unchanged.** Reasons: (a) it is shipped behaviour with a written rationale in the source
   (`LabelNode.tsx:103` — the deliberate divergence from the single-line edge editor); (b) Harvey asked for
   Excalidraw's *controls-while-typing*, not for its *key contract*; (c) changing Escape would alter a shipped
   gesture nobody complained about. **Do NOT re-open this in implementation.** If Harvey later wants
   commit-on-Escape, it is a one-line change here and a note in the ? sheet.
2. **The task's premise that `body` is a long list is wrong.** `body` is **2 options** — `card` / `label-only` (`App.tsx:4584-4585`), not 19. I treated it as a 2-button toggle, not a searchable popover. The *19-shape* picker is `shape` (`4571`), which I did treat as a searchable popover.
3. **The task's branch table vs the actual source.** The task lists the edge branch as "Label · Line · Markers · Cardinality · **Align · Distribute · Color · Delete**". The source (`App.tsx:4105-4371`) shows **no** Align/Distribute and **no** Delete in the edge branch — those live only in the multi-select branch (`:4383-4396`), and stroke colour is *inside* the Line section (`:4156`), not a separate Color section. I wrote the spec against the **source**, and my §D ordering folds colour into Line.
4. **Disclosure mechanism divergence.** Fact 2 says prefer popover density over a home-made accordion. I followed it (no accordion, folds-by-default), but chose an **inline persistent expand** for Cardinality rather than a popover, because a crow's-foot picker carries a derived readout (`App.tsx:4350-4352`) that wants room. This is our choice, flagged explicitly.
5. **Font-family is OUT, and it's more than "only two families".** The node mixes `--mono` (title/metric) and `--sans` (kicker/sub) *within one node*, so even a 2-way family toggle is semantically wrong today. Confirmed OUT rather than offered as a sans/mono switch.
6. **"Hide duplicate/delete while editing" is nearly a no-op here.** Single-node and edge selections have **no** duplicate/delete controls in the panel today (only multi-select does, `App.tsx:4377-4378`), and multi-select never co-occurs with in-place text editing. So fact 3's third clause translates to "keep the multi-select branch from ever rendering during an edit", not "add a hidden control". Flagged so the coder doesn't invent UI that doesn't exist.
7. **Two independent label editors already exist** (panel `<textarea>` at `App.tsx:4523` *and* the in-place editor in `LabelNode.tsx`). The spec resolves this by removing the panel textarea (§E.3.1). This is a removal the task didn't call out but the "editing panel survives typing" requirement forces.

---

## Notes for the implementing session

- Read this file, then `SYNTHESIS.md` (the 3 corrections in §0 matter most), then the §A–§E sections of `X3` and `X1` for the exact upstream line numbers.
- The `shape` popover reuses `ShapePreview` (`shapes.tsx:195`) — do **not** draw new silhouettes.
- The Text section's colour picker reuses `swatchRow` (`App.tsx:3025`) — colour keys, never hex.
- Dev server `http://192.168.33.200:5200/` (Harvey is on a Mac remote client; never say "localhost").
- Restore the demo board "Kafka rebalance" before testing: 3 nodes / 2 edges, preset `architecture`, no `theme` key, both edges `data.flow = "dots"`.
- Harvey verifies last — self-verify (`tsc` + `build` + the §F harnesses + a live browser pass) before handoff.
