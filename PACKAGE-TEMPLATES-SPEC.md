# PACKAGE-TEMPLATES — Template catalog + the Flowchart template family (Diagram Studio)

**Status:** SPEC — for orchestrator review, then implementation
**Input:** Harvey's brief (verbatim, 2026-09-20) + the live code (`src/presets.ts`, `src/BoardDialog.tsx`,
`src/App.tsx` ~1216, `src/palette.ts`, `src/layout.ts`, `checks/*.mjs`) + a bounded evidence check on how
mature tools present template galleries (§2.3).
**Scope:** this spec only. No implementation code, no edits under `src/`, no edit to `vite.config.ts`,
no commit, no server.

---

## 1. Context

### 1.1 The ask

Harvey (verbatim, 2026-09-20):

> Sau khi flowchart shapes đã ok. Tôi muốn tạo ra 1 thứ gọi là các template mẫu. Cái mẫu đầu tiên sẽ là Flowchart.
> Yêu cầu với template này là sẽ dùng 1 domain dễ hiểu và có thể chia ra làm 3 mức độ:
> 1. Flowchart cơ bản phù hợp với dùng hằng ngày với các shapes/elements phổ biến
> 2. Flowchart advance với flow phức tạp hơn và dùng nhiều shapes/elements ít dùng
> 3. Flowchart complex với flow dùng hết tất cả các elements có thể trong flowcharts
> Yêu cầu thiết kế cho tôi nên để ở đâu ra sao. Sau này nó sẽ có thêm 1 số của các kiểu Diagrams khác.

Two deliverables: **(a)** a placement recommendation (`nên để ở đâu ra sao`), **(b)** the content of three
flowchart templates on one easy-to-understand domain, at three depths. Later families (Data model / C4 /
Architecture) must slot in **without a rewrite**.

### 1.2 Measured plumbing (verified — do not re-derive; re-measured for this spec by bundling the real
module: `./node_modules/.bin/esbuild <entry> --bundle --platform=node --format=esm --external:react
--external:react-dom --external:react/jsx-runtime --external:@xyflow/react` then `node <out.mjs>`)

| Fact | Measured value |
|---|---|
| `TemplateSpec` | `{id, label, hint?, nodes: Node[], edges: Edge[]}` (`src/presets.ts` ~59) — **no family, no level** |
| `DiagramPreset.templates?` | `TemplateSpec[]` (`presets.ts` ~86) |
| Templates shipping TODAY | `flowchart` → 1 (`approval`, 14n/10e, hint `two lanes · decision · Yes/No · loop-back`); `c4` → 2 (`c4-context` 5n/4e, `c4-container` 11n/9e); `erd` → 1 (`commerce` 4n/2e); `architecture`, `custom` → 0. **Total 4 templates.** |
| The only template surface | `src/BoardDialog.tsx` — a module-scope `const TEMPLATES` filled by two `for` loops over `PRESETS`, rendered as ONE flat `role="radiogroup"` whose first row is "start empty" |
| Dialog return contract | `{kind:'create'; name: string; seed: {preset: PresetId; templateId: string} \| null}` |
| `.bd-list` | `max-height: 210px; overflow-y: auto` (`src/styles.css` ~2148) — already scrolls |
| Flowchart palette | 16 ISO 5807 flow ids + `Lane` (groups) + `Note` (annotations) = 18 rows, in this order: `terminator, process, decision, io, document, subprocess, preparation, manual, delay, connector, offpage, manualinput, display, storeddata, looplimit, internalstorage` (+`group`,`note`) |
| Flowchart node size | `FLOWCHART_NODE_SIZE = {width: 290, height: 145}` — ONE size for all 16 (ratio 2.0, the frame's own ratio) |
| Helpers available to templates | `flowNode(id, shape, title, colorKey, x, y, size)`, `lane(id, title, sub, x, y, w, h)`, `makeEdge(from, to, FLOWCHART_EDGES, id, {label, sourceHandle, targetHandle})` |
| Flowchart edges / layout / guidance | `smoothstep · slate · solid`, `ArrowClosed`, `labelPresets ['Yes','No','True','False','Retry','Timeout','Otherwise','revise']`, `flowAllowed`; layout `layered-tb` TB `{x:90, y:70}` `bandGroups:true`; guidance `requireLabel`, `maxLabelChars:30`; `theme` dark / plain / no legend |
| `approval` back-edge | a genuine loop through a connector pair (`a9 → a10 → a2`) — it is the flowchart **layout regression test** |
| `LAYOUTS['layered-tb']` | `layoutDiagram(..., {direction:'TB', spacing, bandGroups})`; feedback arcs (DFS back edges) are removed before layering, then placed; `bandGroups` freezes top-level `group` nodes and only re-places top-level non-group nodes |
| `Shape` union | 19 ids (`src/shapes.tsx`) — a new capability is a new node KIND, never a 20th shape id |

### 1.3 The constraint that shapes §2: the type picker is GONE

The "Diagram type" picker was deliberately removed from all three entry points (`.preset-bar` chip row,
the New-board prompt, the "Diagram type…" boards-menu item). `BoardDoc.preset` survives as DATA ONLY and
still drives seven behaviours (edge defaults ×4, auto-layout, the ERD table node, flowchart default ports,
the C4 badge, legend/note, edge `labelPresets`). **Therefore the template list is the ONLY discovery
surface for a starter document.** This spec must not reinstate the type picker, and must not make the
template list depend on the user knowing what a preset is.

Corollary that drives §2: today a user can only ever *see* a template by opening the New-board dialog,
and cannot re-open it without creating a board. There is no browse surface. That is the gap Harvey's
request exposes.

---

## 2. The placement recommendation (`nên để ở đâu ra sao`)

### 2.1 Option A — extend the existing BoardDialog create flow only

Add the three flowchart templates to `FLOWCHART_PRESET.templates`, group the existing flat radiogroup
with non-focusable header rows (family → level), and stop there.

* **For:** zero new surface; the dialog already has roving tabindex, a focus trap, Escape, focus restore
  and the `.bd-list/.bd-opt/.bd-opt-name/.bd-opt-hint` CSS; the list is derived from `PRESETS`, so a new
  template appears with no dialog edit; `.bd-list` already scrolls.
* **Against:** the dialog is a *name-first* modal — the name field is the first tab stop and the whole
  point is "get me to a board fast". It has no room for a preview: a row is one line of name + one line of
  hint in a 210 px scrolling box. Difficulty levels are exactly the thing a user needs *explained*
  ("advanced" vs "complex" is meaningless as a chip alone). And there is still NO way to browse templates
  without creating a board, which is the discovery gap Harvey's "sau này nó sẽ có thêm 1 số của các kiểu
  Diagrams khác" makes worse: at 4 families × 3 levels the flat list is ~13 rows inside a create dialog.

### 2.2 Option B — a standalone Templates GALLERY (its own modal)

A dedicated surface reachable from the **boards menu** (`Templates…` row next to New board / Rename /
Duplicate / Delete) — boards menu ONLY (D2, §8.1): a toolbar entry is deferred, not part of this round.

* **For:** room for the two things a level-based catalog actually needs — a **preview** and **structure**
  (a family rail: Flowchart → Basic / Advanced / Complex; later Data model, C4, Architecture). Reachable
  at any time, not only at creation. Keeps the create dialog fast (it stays one name field + a short list,
  or even drops its list entirely and points at the gallery).
* **Against:** a second modal to build and keep consistent; and it needs a preview — there are no
  thumbnail assets in this project and adding one (html-to-image capture, or a bitmap per template) would
  be a new cost and a new failure mode.
* **Mitigation (this spec's design):** the preview is **rendered from the template's own data**, not from a
  bitmap — a card shows the shape set as small `.shape-frame` glyphs (the components already exist and
  already paint at any size) plus `n nodes · m edges` and the level chip. Zero new assets, zero new
  dependency, and it cannot drift from the template because it IS the template.

### 2.3 Option C — both: create dialog *links into* the gallery

The dialog keeps a short "start from" list (its current 1 + N rows, grouped), and gains ONE extra row at
the end: **"Browse all templates…"**, which closes the dialog and opens the gallery with the same
catalog. The gallery's own action opens the create dialog **pre-selected** on the chosen template.

* **For:** one board-creation path (the gallery never creates a board itself → no duplicated
  `flushSave`/`createBoard`/`pushHistory` logic, which is Harvey's "simplest single-owner flow"); the fast
  path stays fast; the deep path exists. Both surfaces read ONE catalog selector, so they cannot disagree.
* **Against:** two surfaces whose *selection* state must agree — mitigated by the pre-selected-dialog
  design above (state is never copied, it is handed over once).

### 2.4 Second axis — CREATE A NEW BOARD only, or also INSERT INTO THE CURRENT BOARD?

**SETTLED BY HARVEY (2026-09-20, verbatim: "tạm thời template chỉ chèn board mới ok") — v1 is
CREATE-A-NEW-BOARD ONLY. The create path is the sole owner of board creation; there is NO
insert-into-current-board path in this round.** The analysis below is kept as the reasoning that shows
WHY this is the honest v1 (and as the record of what a later round would have to solve), not as an
open choice.

This is the axis that decides more than the placement does.

* **Evidence:** the mature tools do both. draw.io's template library dialog appears when you create a new
  diagram AND is reopened for an existing one via `Arrange > Insert > Template` (also the `+` toolbar
  button in the Sketch theme), with `Insert` (existing diagram) vs `Create` (new diagram) as the two verbs.
  Miro's template picker is on the **toolbar of an existing board** ("To add a template to your existing
  board … choose the Templates icon on the toolbar") and the dashboard path creates a new board. Whimsical
  offers a browsable template gallery of pages, each of which creates/opens a document.
* **The blocker in THIS codebase:** a template BELONGS to a preset. Templates are looked up as
  `getPreset(presetId).templates.find(...)`, and `BoardDoc.preset` is a **per-board** field — there is no
  per-node notation. Seeding a C4 template into a Mixed board would give it C4 nodes under Mixed's edge
  defaults and no C4 legend: the exact defect the create path already guards against (noted at
  `App.tsx` ~1226). `INSERT INTO THE CURRENT BOARD` therefore cannot be implemented honestly without
  deciding what happens to a board whose preset differs from the template's.
* **Recommendation:** **v1 = create-a-new-board only.** The gallery's primary action is *Use template*
  (which creates a board via the one existing create path). **Insert-into-current-board is DEFERRED**, and
  when it lands it is enabled only when `currentBoard.preset === template.preset` — otherwise the button is
  disabled with the reason shown inline ("This template is a C4 template; this board is Mixed"). Never
  silently change a board's preset as a side effect of an insert.

### 2.5 RECOMMENDATION

**Adopt Option C, in two passes, with the gallery as the end state.**

* **Pass 1 (data + create dialog, no new surface):** `TemplateSpec.level` (§3), the three flowchart
  templates (§4), `BoardDialog` grouping with family/level header rows, and the "Browse all templates…"
  row present but opening Pass 2's surface. Ship and let Harvey review.
* **Pass 2 (the gallery):** `src/TemplatesGallery.tsx` — a modal opened from the boards menu, reading the
  same catalog. Cards, not a list; create-only action; phone/tablet layouts by the existing tier rules
  (§2.6).

**Why this over A and B alone:** A cannot show a level-based catalog honestly (no preview, no room, and it
is the wrong moment — a user browsing templates is not naming a board yet); B alone leaves the create flow
with a stale list and two places that pick templates; C gives the fast path and the deep path from one
catalog, and keeps board creation single-owner.

**Why the boards menu, not the toolbar, as the primary entry (Pass 2):** the boards menu is already the
"documents" surface and already contains New board; a toolbar entry would be a 6th chip competing at the
phone tier, where the toolbar already has tier rules (`.app[data-form-factor="phone"] .toolbar`). **DECIDED
by Harvey (D2, §8.1): the gallery is reachable from the boards menu ONLY** — `Templates…` beside New
board — and a toolbar entry is **deferred**, not forbidden: it is cheap to add later with no data change
(no new field, no new key, one more trigger calling the same modal). The toolbar is therefore no longer
part of the recommendation as an open choice; it is a recorded deferral.

### 2.6 Phone / tablet behaviour (no second breakpoint number)

The app resolves form factor on `.app[data-form-factor]` / `.app[data-orientation]` (written by
`src/useEditorInterface.ts`; thresholds live there and in `styles.css` only). The gallery **must not**
introduce a second breakpoint number, a new prop, or a new state flag. Concretely:

* Reuse the modal vocabulary verbatim: `.sp-overlay` scrim + `.sp-card` (as `BoardDialog` does with
  `.bd-overlay` / `.bd-card`), `FOCUSABLE` imported from `Settings.tsx` for the trap.
* **Desktop (≥ the existing 1229 threshold, i.e. `[data-form-factor="desktop"]`):** two panes — a left
  family/level rail, a right card grid (`auto-fill, minmax(240px, 1fr)`).
* **Tablet:** the rail becomes a horizontal, scrolling strip above the grid (`flex-direction: row;
  overflow-x: auto; min-width: 0`) — the pattern already proven by
  `.app[data-form-factor="tablet"][data-orientation="portrait"] .settings-nav-list`. Portrait and
  landscape use the same rule (the tier attributes already encode orientation if a variant is ever needed).
* **Phone (either orientation):** full-bleed sheet — `.app[data-form-factor="phone"] .tg-card { width:
  100%; height: 100%; border-radius: 0; border: none }`, one column, the rail as a scrollable strip; card
  previews drop the glyph strip to at most 4 glyphs plus "+N".
* **No persisted UI state in v1** (no "last family opened" key). If one is ever added it gets its own
  `diagram-studio:*` key and Harvey's standing rule applies: when a change makes persisted state no longer
  appropriate, **clear it rather than migrate it**.

---

## 3. Data model

### 3.1 The level field — exact TypeScript

In `src/presets.ts`, next to `TemplateSpec`:

```ts
/** Difficulty depth WITHIN a template family, in Harvey's own vocabulary
 *  (cơ bản / advance / complex). OPTIONAL on purpose: the four templates that
 *  ship today carry no level and must stay reachable with zero edits. */
export type TemplateLevel = 'basic' | 'advanced' | 'complex';

/** Display label + one-line meaning, in ONE place, so the dialog, the gallery and
 *  any future surface cannot word the levels differently. */
export const TEMPLATE_LEVELS: Record<TemplateLevel, {label: string; blurb: string}> = {
  basic:    {label: 'Basic',    blurb: 'everyday flow · common shapes only'},
  advanced: {label: 'Advanced', blurb: 'more branches · the less common symbols'},
  complex:  {label: 'Complex',  blurb: 'full notation · every flowchart shape'},
};

export type TemplateSpec = {
  id: string;
  label: string;
  hint?: string;
  /** NEW — the difficulty level inside this template's family. */
  level?: TemplateLevel;
  /** NEW — display order inside the family when levels tie (lower first). */
  order?: number;
  nodes: Node[];
  edges: Edge[];
};
```

**There is deliberately NO `family` field.** The family **is** the preset that owns the template: a
template already belongs to a preset (the dialog returns a `(preset, templateId)` pair and `App.tsx`
resolves the template *within* that preset), so the preset id/label/hint already carry the family's
identity. A second `family` string would be a second source of truth that can drift from `PRESETS` — the
exact class of bug `ROUND AD` removed from the shape lists ("three lists that can disagree").

### 3.2 Grouping key and the catalog selector (new file `src/templateCatalog.ts`)

```ts
import {PRESETS, TEMPLATE_LEVELS, type PresetId, type TemplateSpec, type TemplateLevel} from './presets';

export type TemplateEntry = {
  preset: PresetId;
  presetLabel: string;
  presetHint: string;
  t: TemplateSpec;
  /** null = the template declares no level (the four legacy ones). */
  level: TemplateLevel | null;
};
export type TemplateGroup = {
  level: TemplateLevel | null;
  label: string;              // TEMPLATE_LEVELS[level].label, or the preset label for the null group
  entries: TemplateEntry[];
};
export type TemplateFamily = {
  preset: PresetId;
  label: string;
  hint: string;
  /** Levels in fixed order: basic → advanced → complex → (null group LAST). */
  groups: TemplateGroup[];
};

/** THE ONE catalog. Every surface (dialog today, gallery tomorrow) reads this,
 *  so a new template or a new family appears everywhere with no UI edit. */
export function templateCatalog(): TemplateFamily[];
```

Rules the selector implements, each measurable:

1. It iterates `Object.keys(PRESETS)` and `PRESETS[id].templates ?? []` — the same two loops the dialog
   uses today. A preset with no templates contributes **no family** (so `architecture` and `custom` are
   absent today, and both appear the day they gain a template, with no gallery edit).
2. Level order is fixed `['basic','advanced','complex']`; entries inside a level sort by `order ?? 0`,
   then by `id` (deterministic, so the catalog is stable across reloads and probes).
3. **The `null` group is always emitted LAST** and is labelled with the preset's own `label`
   (e.g. "Flowchart — Approval request"). This is what keeps the four legacy templates reachable.

### 3.3 Backwards compatibility — proof

* `level` and `order` are **optional**. No existing `TemplateSpec` literal needs an edit to compile: `tsc
  --noEmit` stays 0 with the four templates untouched.
* The catalog's total entry count is **exactly** `Σ PRESETS[id].templates.length`. Today 4; after this
  round 7 (`flowchart` 4, `c4` 2, `erd` 1).
* Every id reachable today stays reachable: `approval`, `c4-context`, `c4-container`, `commerce` all appear
  in the catalog, the first three under their preset's `null` group (or under a level if §3.4's
  recommendation is adopted).
* `optKey(preset, templateId) = \`${preset}:${templateId}\`` is unchanged, so every key the dialog can
  return still resolves through `getPreset(pid).templates?.find(...)`.

### 3.4 Do the legacy templates get a level? — recommendation

**Yes, one:** tag `approval` with `level: 'advanced'`. It is a genuine flowchart with lanes, a decision and
a loop-back, and leaving it unlevelled would place a stray row *after* the three levelled ones inside the
same family, which reads as "unclassified" rather than "legacy". The change is **metadata only**: its
`nodes` and `edges` arrays are not touched (see AC 6). `c4-context`/`c4-container`/`commerce` stay
unlevelled — they are the only members of their families, so a level chip there would be noise. When C4
later gains beginner/advanced variants, they get levels then.

### 3.5 Is the level a LABEL only, or also a FILTER control?

**SETTLED BY HARVEY (2026-09-20, verbatim: "nhãn trước") — LABEL + grouping header only. No filter
control.** The reasoning below is the measurement that supports his call, not a substitute for it.

**Label + grouping header only. No filter control. Justification is a row count, not a taste call:**

| After this round | rows |
|---|---|
| "start empty" | 1 |
| Flowchart · Basic | 1 |
| Flowchart · Advanced | 2 (`approval` + the new advanced one) |
| Flowchart · Complex | 1 |
| C4 (unlevelled group) | 2 |
| Data model (unlevelled group) | 1 |
| **Total** | **8 in the dialog list, 7 in the gallery** |

At 7 cards / 8 rows a filter control would cost more attention than it saves, and — measurably — **there
is no level whose rows would ever be hidden by the only alternative selection**: every family has ≤2 rows
per level. A filter becomes worth building when a single family passes ~5 templates per level and the
catalog passes ~15 rows (i.e. after the Data model and Architecture families land). Recorded here so the
decision is re-openable on a number, not on taste. If it is ever added, it is a **segmented control over
`TEMPLATE_LEVELS` + the "All" option**, styled from `.settings-*`/`.bd-*` vocabulary, not a new widget.

Level chips are **text**, never colour-only (a11y), and use no new token: the chip is
`.tg-chip`/`.bd-level` with `--border-strong` border, `--dim` text and `--elevated` background — i.e.
existing tokens only, no new hex (§6 AC 12).

---

## 4. The three Flowchart templates

### 4.1 The domain: how the candidates were weighed

Harvey's constraints: one easy-to-understand domain, split into three depths, universally understandable,
no domain training, generic for a shared tool, and **not a purchase/approval workflow** (`approval`
already covers that). The domain below is a **settled decision** (§8.1, D1) — the table is kept as the
record of how it was reached, not as an open choice.

| Candidate | Case for | Case against |
|---|---|---|
| **A. A load of laundry / wash day** | daily, understood by anyone (no training), long enough to have a genuine multi-phase process, and **every one of the 16 ISO 5807 symbols has an honest home in it** | **the previous pick, set aside by Harvey after the mockup (D1)** — its `offpage`, `display` and both storage symbols need a reading, and its lanes had to be phases rather than roles. Kept on record as the RUNNER-UP: it is a genuinely viable domain and the only reason it lost is that B is funnier and fits the symbols more directly |
| **B. Flat-pack furniture assembly** — self-assembly furniture from a flat box | daily, understood by anyone (no training, no domain vocabulary), long enough for a genuine multi-phase process, and **all 16 ISO 5807 symbols have an honest home in it** — and for the three symbols A only reaches by convention, an OBJECT rather than a metaphor: `offpage` is page 2 of the printed instruction sheet, `storeddata` is the bag of leftover screws kept forever, `internalstorage` is the loose parts held in the box during the job | none material. It is a household chore like A, so no brand, company, person or locale is needed (and none is used) |
| **C. Cat into carrier** | short, universal, funny | **rejected:** it FAKES three symbols — `storeddata` and `internalstorage` have no honest object in a two-minute procedure, and `offpage` would be borrowed for a one-page flow |
| **D. Out-the-door-on-time** | universal, genuinely multi-phase | **rejected:** it FAKES two symbols — `offpage` (again a one-page flow) and `storeddata` (nothing in it persists between sessions) |

**COMMITTED DOMAIN: B — "flat-pack furniture assembly" (self-assembly furniture from a flat box).**
Harvey's call (verbatim: *"với tôi B rất ok"*), and it is the honest one: it beats A because the three
symbols A only reaches by convention get a concrete object instead — **page 2 of the printed instruction
sheet** (`offpage`, the literally correct use of the home plate, not a convention borrowed for the
occasion), **the bag of leftover screws kept forever** (`storeddata`, a store that persists between
sessions and is both read and written), and **the loose parts held in the box during assembly**
(`internalstorage` — held only during the job, gone when it ends, which is the honest contrast pair with
`storeddata`). `display` is the **step diagram you keep re-reading**, a readout of data back to the
operator; `delay` is **waiting for the wood glue to set**; `manual` is **the step that needs a second
person**; `manualinput` is **a value written onto the box or label by hand**; `subprocess` is a
**pre-built sub-assembly** ("build the drawer box — a procedure defined elsewhere"); `looplimit` is the
loop's own start marker ("for each of the 8 cam locks"); `connector` is an **on-page jump back to an
earlier step** ("wrong hole — back to step 3"); `preparation` is **laying out the parts and the allen key
before starting**; `decision` is real branches (does this step need two people? are there screws left
over? is it square?); `document` is **the printed instruction page itself**; `io` is the **parts checklist
compared against the box contents**; `terminator` is start / done. It contains no purchase, no approval,
no company, no brand, no person, no locale, no URL and no email — flat-pack furniture reads the same to
every user.

**The one convention-dependent symbol stays `offpage`** (as in the set-aside candidate): even here it is a
**page-break convention** — a reader has to accept that a printed sheet has two sides/pages — rather than
an object with a shape in the room. It is the *most* honest use of the symbol of any candidate (the
procedure really does continue on page 2 of the sheet, and the board really is a two-page board), but it
is still a reading, so §4.5 keeps the **pre-written 3-line fallback** for it and C3 lists it as a live
conflict.

### 4.2 The level ladder is the palette's own order (the measurable rule)

The three levels are NOT "3, 8 and 16 shapes picked by feel". They are **three contiguous bands of the
flowchart palette, which Harvey already curated in increasing difficulty** — the last six are literally the
`ROUND AD` additions:

| Level | Shape ids | = palette rows |
|---|---|---|
| **Basic** | `terminator, process, decision, io, document` | 0–4 (the five first rows) |
| **Advanced** | the above + `subprocess, preparation, manual, delay, connector` | 0–9 |
| **Complex** | the above + `offpage, manualinput, display, storeddata, looplimit, internalstorage` | 0–15 (all 16) |

This makes §6's shape ACs one-line probes (`palette.slice(0,5).map(p => p.shape)`) and makes the difficulty
claim honest: a level's difficulty IS how far down the curated palette it goes. **The ladder is independent
of the domain** — it is a rule over the palette's own row order, so swapping the domain (D1: wash day →
flat-pack furniture) changed *no* shape set and therefore **costs no acceptance criterion**: AC 5/6/7/8
still measure exactly the same three sets, sizes 5/10/16, strictly nested. `Lane` and `Note` sit outside
the 16 (they are `group`/`note` shapes); this round adds `Note` once at Advanced and once at Complex, and
**no `Lane` at any level** (D3, §8.1) — `Lane` usage is deferred to a separate future round.

**Why "common" = those five and not just `process`/`decision`:** the cut must produce a *useful* flow, not
a toy. The five are exactly the symbols that appear in almost every real-world process sketch — a start/end
stadium, an action box, a diamond, a data in/out parallelogram, and a produced document — and they are the
first five rows of the app's own panel, so a user who has only ever used Basic has already met every shape
in it. `subprocess/preparation/manual/delay/connector` are genuinely rarer: each one appears in the panel
below the fold, and each one answers a question a beginner rarely asks (defined elsewhere / setup / by hand
/ wait / jump).

### 4.3 LEVEL 1 — BASIC (`flow-basic`, label "Flat-pack assembly", hint "basic · 5 common shapes · one tighten-and-recheck loop")

Shapes used: **`terminator, process, decision, io, document`** (5 of 16). **No** Lane, **no** Note, **no
annotation nodes of any kind** — per D3 (§8.1) this board carries no `group`/Lane bands, and per D4
(§8.1) it carries NO phase-heading annotation either. The point of Basic is that nothing needs explaining.

Nodes (10, all flow; size `FLOWCHART_NODE_SIZE` 290×145 on every node; `handles:'tb'`,
`body:'label-only'` via `flowNode`):

| id | kind / shape | title / text | colorKey | x | y | size |
|---|---|---|---|---|---|---|
| `b1` | `terminator` | Start — open the flat box | green | 380 | 60 | 290×145 |
| `b2` | `io` | Count the parts against the checklist | violet | 380 | 275 | 290×145 |
| `b3` | `process` | Lay out the panels and the fittings | cyan | 380 | 490 | 290×145 |
| `b4` | `decision` | All parts present? | amber | 380 | 705 | 290×145 |
| `b5` | `process` | Keep the spare fittings in the box | cyan | 0 | 920 | 290×145 |
| `b6` | `process` | Fit the dowels and the cam locks | cyan | 380 | 920 | 290×145 |
| `b7` | `document` | Follow the printed step sheet | violet | 380 | 1135 | 290×145 |
| `b8` | `decision` | Frame square and steady? | amber | 380 | 1350 | 290×145 |
| `b9` | `process` | Tighten every cam a quarter turn | cyan | 0 | 1565 | 290×145 |
| `b10` | `terminator` | End — unit assembled | green | 380 | 1565 | 290×145 |

Edges (11, all `makeEdge(..., FLOWCHART_EDGES, ...)`):

| # | from → to | label |
|---|---|---|
| 1 | `b1 → b2` | — |
| 2 | `b2 → b3` | — |
| 3 | `b3 → b4` | — |
| 4 | `b4 → b6` | `Yes` |
| 5 | `b4 → b5` | `No` |
| 6 | `b5 → b6` | — |
| 7 | `b6 → b7` | — |
| 8 | `b7 → b8` | — |
| 9 | `b8 → b10` | `Yes` |
| 10 | `b8 → b9` | `No — not square` |
| 11 | `b9 → b7` | `tighten and recheck` |

Colour keys stay inside the flowchart preset's own legend (green terminal, cyan process, amber decision,
violet document/io, slate connector/lane) — **no new key, no new token**.

**Target counts:** 10 nodes (all flow), 11 edges, 5 distinct flow shapes, 1 genuine back-edge
(`b9 → b7`).

**Auto-layout (`layered-tb`, bandGroups true, x90/y70, no `group` nodes → nothing frozen, no annotation
nodes → no orphan row):** feedback arc
`b9→b7` is removed (it is the only *genuine* back-edge — `b8→b9→b7` re-enters `b7`, which is upstream of
`b9`), then the DAG layers `b1`=0, `b2`=1, `b3`=2, `b4`=3, {`b5`,`b6`}=4, `b7`=5, `b8`=6, `b9`=7,
`b10`=8 → **9 flow layers**, laid top-to-bottom with 145 px node heights and 70 px layer gaps (≈1.2k px
tall), each layer centred on the vertical axis. Every node is edge-connected, so the engine's orphan path
is never reached and all 10 participants land in the flow. Expected result: a clean single-column
spine with the "keep the spare fittings" branch hanging to the left and the recheck back-edge drawn upward
from `b9` to `b7` — i.e. the engine must NOT collapse the loop onto layer 0.

### 4.4 LEVEL 2 — ADVANCED (`flow-advanced`, label "Flat-pack assembly + glue", hint "advanced · adds subprocess, preparation, manual, delay, connector · no lanes")

Shapes used: **the Basic five + `subprocess, preparation, manual, delay, connector`** (10 of 16). The
connector is present as a **pair** (`c11`/`c12`, "A") so the redo step is an on-page jump rather than a
long edge. Extras: **`Note` ×1** and **NO phase headings** — per D3 (§8.1) no `group`/Lane bands (the
layout engine freezes them at their authored coordinates while re-placing every other node), and per D4
(§8.1) no phase-heading annotation either: an isolated annotation node is treated as an ORPHAN and parked
after the last layer, which would fling a heading to the bottom of the board.

Nodes (15 = 14 flow + 1 note; every flow node 290×145):

| id | kind / shape | title / text | colorKey | x | y | size |
|---|---|---|---|---|---|---|
| `c1` | `terminator` | Start — open the flat box | green | 380 | 60 | 290×145 |
| `c2` | `io` | Compare the box contents with the parts checklist | violet | 380 | 275 | 290×145 |
| `c3` | `preparation` | Lay out the panels, the fittings and the allen key | cyan | 380 | 490 | 290×145 |
| `c4` | `decision` | Needs a second pair of hands? | amber | 380 | 705 | 290×145 |
| `c5` | `manual` | Ask a second person to hold the side panel | green | 0 | 920 | 290×145 |
| `c6` | `subprocess` | Build the drawer box (set out on its own sheet) | cyan | 380 | 920 | 290×145 |
| `c7` | `delay` | Wait 30 minutes for the wood glue to set | amber | 380 | 1135 | 290×145 |
| `c8` | `process` | Fit the shelf and tighten the cam locks | cyan | 380 | 1350 | 290×145 |
| `c9` | `document` | Check the frame against the printed drawing | violet | 380 | 1565 | 290×145 |
| `c10` | `decision` | Frame square and level? | amber | 380 | 1780 | 290×145 |
| `c11` | `connector` | A | slate | 760 | 1780 | 290×145 |
| `c12` | `connector` | A | slate | 760 | 1995 | 290×145 |
| `c13` | `process` | Wipe the unit down and move it into place | cyan | 380 | 1995 | 290×145 |
| `c14` | `terminator` | End — unit assembled | green | 380 | 2210 | 290×145 |
| `cNote` | `note` | The drawer box is a sub-assembly: build it on its own sheet before the shelf goes in. | slate | 760 | 60 | 400×200 |

Edges (15):

| # | from → to | label |
|---|---|---|
| 1 | `c1 → c2` | — |
| 2 | `c2 → c3` | — |
| 3 | `c3 → c4` | — |
| 4 | `c4 → c5` | `Yes` |
| 5 | `c4 → c6` | `No` |
| 6 | `c5 → c6` | — |
| 7 | `c6 → c7` | — |
| 8 | `c7 → c8` | — |
| 9 | `c8 → c9` | — |
| 10 | `c9 → c10` | — |
| 11 | `c10 → c13` | `Yes` |
| 12 | `c10 → c11` | `No — not square` |
| 13 | `c11 → c12` | — |
| 14 | `c12 → c8` | `wrong hole — back to the fittings` |
| 15 | `c13 → c14` | — |

**Target counts:** 14 flow nodes + 1 note = **15 nodes / 15 edges**, **10 distinct flow
shapes**, and a **genuine back-edge through a connector pair** (`c11 → c12 → c8`, where `c12` is upstream
of `c11` and re-enters `c8`, which is several layers above it) — this template therefore joins `approval`
as a second layout-regression case rather than adding a third regression that only the old code would
have failed.

**Auto-layout:** with no `group` nodes nothing is frozen and every EDGE-CONNECTED node lands in the flow.
Feedback arc `c12→c8` removed → layers `c1`=0, `c2`=1, `c3`=2, `c4`=3, {`c5`,`c6`}=4, `c7`=5, `c8`=6,
`c9`=7, `c10`=8, {`c11`,`c13`}=9, {`c12`,`c14`}=10 → **11 flow layers** (≈1.7k px tall), up to **7
distinct x positions** at the widest row. The isolated `cNote` is an ORPHAN (no edges) so the engine parks
it in a trailing row BELOW the flow — which is exactly where a footnote belongs, and is why a `note` is
safe here while a phase heading is not (D4).
**KNOWN BEHAVIOUR, and why D3 chose labels over lanes:** `LAYOUTS['layered-tb']` places only the
non-`group` nodes and leaves `group` nodes exactly where they were authored. Measured on the live engine
over the existing `approval` template: **11 of its 14 nodes get a position** (the 3 lane bands are skipped),
the bands stay frozen at y = 0 / 70 / 320 while the laid-out flow runs y 0 → 780, and consequently **only
6 of the 10 flow nodes stay inside a lane band** (and just 3 of 10 inside a band in *both* axes). On a
17-node board that mismatch would be worse — and a phase heading made of `label` nodes would NOT save it
either: the engine parks an edge-less annotation in a trailing ORPHAN row (measured on the LIVE engine —
an isolated `label` authored at `x 60, y 40` came out at `x -140, y 2150`, below a flow that ended at
y 1935). Removing the phase headings entirely (D4) removes the problem: the board is then flow nodes plus
one footnote, and the footnote's trailing row is where it belongs. Lane usage moves to a separate future
round (§8 Q2).

### 4.5 LEVEL 3 — COMPLEX (`flow-complex`, label "Flat-pack assembly — full notation", hint "complex · all 16 flowchart shapes · two pages")

**HARD ACCEPTANCE CRITERION, MET:** the level-3 flow uses **all 16 flowchart shape ids** — `terminator,
process, decision, io, document, subprocess, preparation, manual, delay, connector, offpage, manualinput,
display, storeddata, looplimit, internalstorage` — and each has an honest job in the process. Per D3 (§8.1) and
D4 (§8.1) this board uses **NO `group`/Lane bands and NO phase-heading annotations at all** — only flow
nodes plus the single explanatory `Note`. Coverage
table:

| shape id | node(s) | why it is the RIGHT symbol, not a bolted-on one |
|---|---|---|
| `terminator` | `d1` Start, `d24` End | the job has one start (open the box) and one end (unit in place) |
| `io` | `d2` | data comes in: the box contents checked against the printed parts checklist |
| `document` | `d3` "Read the printed instruction sheet" | a printed document is read (`hint: in or out`) |
| `manualinput` | `d4` "Write the unit number on the box label by hand" | a value a person writes on the box by hand, not typed |
| `preparation` | `d5` "Lay out the panels, the fittings and the allen key" | the setup the palette's hexagon means: parts laid out before the action |
| `decision` | `d6` needs a second pair?, `d13` cam locks left?, `d16` square and level?, `d23` flush against the wall? | four real branches, each with a genuine Yes/No |
| `manual` | `d7` "Ask a second person to hold the side panel" | the step that needs an extra pair of hands |
| `subprocess` | `d8` "Build the drawer box (set out on its own sheet)" | a procedure defined elsewhere — the instruction sheet says "see sheet 2" |
| `display` | `d9` "Step diagram — the page you keep re-reading" | a readout of data back to the operator: the diagram the assembler keeps looking at |
| `internalstorage` | `d10` "Loose fittings held in the box during the job" | work in progress held only for the duration of the job, gone when it ends (the honest contrast with `storeddata`) |
| `looplimit` | `d11` "Loop: for each of the 8 cam locks" | the loop's own start marker, with a back-edge running into it |
| `process` | `d12` push the next cam lock home, `d15` fit the shelf and the drawer box, `d22` lift the unit into place | the three real actions |
| `delay` | `d14` "Wait 30 minutes for the wood glue to set" | a real wait — the glue must cure before the fitting is loaded |
| `connector` | `d17`/`d18` (pair "A") | an on-page jump: "wrong hole — back to the fittings" returns to `d11`, several layers up |
| `storeddata` | `d19` "Leftover screws — kept in the box" | a store that is read and written AND persists between sessions: the bag of spare screws everyone keeps |
| `offpage` | `d20` "To page 2 — fix the unit to the wall", `d21` "From page 1 — unit assembled" | the procedure genuinely continues on page 2 of the instruction sheet; the pair marks the page break |

Nodes (25 = 24 flow + 1 note; every flow node 290×145; no `group` nodes and no `label` nodes at all):

| id | kind / shape | title / text | colorKey | x | y | size |
|---|---|---|---|---|---|---|
| `d1` | `terminator` | Start — flat box on the floor | green | 380 | 70 | 290×145 |
| `d2` | `io` | Compare the box contents with the parts checklist | violet | 380 | 285 | 290×145 |
| `d3` | `document` | Read the printed instruction sheet | violet | 380 | 500 | 290×145 |
| `d4` | `manualinput` | Write the unit number on the box label by hand | green | 380 | 715 | 290×145 |
| `d5` | `preparation` | Lay out the panels, the fittings and the allen key | cyan | 380 | 930 | 290×145 |
| `d6` | `decision` | Needs a second pair of hands? | amber | 380 | 1145 | 290×145 |
| `d7` | `manual` | Ask a second person to hold the side panel | green | 0 | 1360 | 290×145 |
| `d8` | `subprocess` | Build the drawer box (set out on its own sheet) | cyan | 760 | 1360 | 290×145 |
| `d9` | `display` | Step diagram — the page you keep re-reading | violet | 380 | 1575 | 290×145 |
| `d10` | `internalstorage` | Loose fittings held in the box during the job | violet | 380 | 1790 | 290×145 |
| `d11` | `looplimit` | Loop: for each of the 8 cam locks | amber | 380 | 2005 | 290×145 |
| `d12` | `process` | Push the next cam lock home | cyan | 380 | 2220 | 290×145 |
| `d13` | `decision` | Cam locks left to fit? | amber | 380 | 2435 | 290×145 |
| `d14` | `delay` | Wait 30 minutes for the wood glue to set | amber | 380 | 2650 | 290×145 |
| `d15` | `process` | Fit the shelf and the drawer box | cyan | 380 | 2865 | 290×145 |
| `d16` | `decision` | Frame square and level? | amber | 380 | 3080 | 290×145 |
| `d17` | `connector` | A | slate | 760 | 3080 | 290×145 |
| `d18` | `connector` | A | slate | 1140 | 3080 | 290×145 |
| `d19` | `storeddata` | Leftover screws — kept in the box | violet | 380 | 3295 | 290×145 |
| `d20` | `offpage` | To page 2 — fix the unit to the wall | slate | 380 | 3510 | 290×145 |
| `d21` | `offpage` | From page 1 — unit assembled | slate | 380 | 3725 | 290×145 |
| `d22` | `process` | Lift the unit into place | cyan | 380 | 3940 | 290×145 |
| `d23` | `decision` | Sits flush against the wall? | amber | 380 | 4155 | 290×145 |
| `d24` | `terminator` | End — unit assembled and in place | green | 380 | 4370 | 290×145 |
| `dNote` | `note` | Two pages: page 1 assembles the frame, page 2 fixes the unit to the wall. The off-page connectors mark the page break. | slate | 760 | 70 | 400×200 |

Edges (27):

| # | from → to | label |
|---|---|---|
| 1 | `d1 → d2` | — |
| 2 | `d2 → d3` | — |
| 3 | `d3 → d4` | — |
| 4 | `d4 → d5` | — |
| 5 | `d5 → d6` | — |
| 6 | `d6 → d7` | `Yes` |
| 7 | `d6 → d8` | `No` |
| 8 | `d7 → d9` | — |
| 9 | `d8 → d9` | — |
| 10 | `d9 → d10` | — |
| 11 | `d10 → d11` | — |
| 12 | `d11 → d12` | — |
| 13 | `d12 → d13` | — |
| 14 | `d13 → d12` | `Yes — next lock` |
| 15 | `d13 → d14` | `No — all fitted` |
| 16 | `d14 → d15` | — |
| 17 | `d15 → d16` | — |
| 18 | `d16 → d17` | `No — not square` |
| 19 | `d17 → d18` | — |
| 20 | `d18 → d11` | `wrong hole — back to the fittings` |
| 21 | `d16 → d19` | `Yes` |
| 22 | `d19 → d20` | — |
| 23 | `d20 → d21` | `page 2` |
| 24 | `d21 → d22` | — |
| 25 | `d22 → d23` | — |
| 26 | `d23 → d24` | `Yes` |
| 27 | `d23 → d22` | `No — not flush` |

**Target counts:** 24 flow nodes + 4 labels + 1 note = **29 nodes / 27 edges**, **16 distinct flow
shapes**, **three genuine back-edges** (`d13→d12`, `d18→d11` through the connector pair, `d23→d22`), plus
the `d20→d21` page hand-off. Measured on the live engine: all 29 participants placed, 29 distinct
coordinates, **22 layers** (21 flow rows + the trailing annotations row), y 0 → 2730.

**Is the shape set believable and readable, or 16 symbols bolted together?** Every symbol answers a
question the process genuinely asks, and no node exists only to carry a shape: remove any one of them and
the story breaks (no step diagram ⇒ the assembler has nothing to re-read mid-job; no box-of-loose-parts
symbol ⇒ the cam-lock loop has nowhere to hold its work-in-progress; no leftover-screws store ⇒ the
"are there screws left over?" branch has nothing to record into; no off-page pair ⇒ the board claims to be
one page while the printed procedure obviously is two). The **one** element that requires a reading is
`offpage`: it is used exactly as the notation intends (the assembly procedure continues on page 2 of the
instruction sheet), and the single `Note` on the board says so in words, so a user meeting the home-plate
symbol for the first time is told what it means without leaving the board. There are **no phase headings** (D4): an edge-less annotation node is parked by the engine in a trailing
orphan row, so a heading would fling itself to the bottom of the board while a footnote belongs there.

**Honest alternative if Harvey rejects the two-page reading (offered, not assumed):** replace `d20`/`d21`
and the `d20→d21` edge with **one `offpage` node carrying no edges**, explicitly labelled
`Off-page connector — used when a procedure continues on another page`, sitting beside the `Note`. It then
teaches the symbol as a labelled legend entry instead of pretending a one-page document has a page break.
The spec's shape-coverage AC holds either way (both variants carry `offpage`); the coherent-flow AC names
the variant used.

**Auto-layout (`layered-tb`):** feedback arcs `d13→d12`, `d18→d11`, `d23→d22` are removed; the remaining
DAG is one long spine, so the engine produces **21 flow layers** (`d1` … `d24` marching down, with the
`d16→d17→d18` connector branch beside it) plus a trailing orphan row holding the note →
**22 layers** total, i.e. ≈2.9k px tall, and up to **9 distinct x positions** across the rows (the widest
row is the branch, not a full 9-wide grid). Nothing is frozen (there are no `group` nodes at all), so every
one of the 29 nodes is re-placed. A **probe must assert the layer count and that no two participants land
on the same coordinate** (AC 9), because a 24-flow-node graph with three back-edges is the case most likely
to expose a layering bug.

---

## 5. Extensibility — how a later family lands with no gallery edit

### 5.1 Adding a family (Data model / C4 / Architecture)

1. Add `templates: [...]` to that preset in `src/presets.ts`, each entry carrying `level?: TemplateLevel`.
2. Nothing else. `templateCatalog()` iterates `PRESETS`, the dialog and the gallery both render whatever
   it returns, and `TEMPLATE_LEVELS` already names the three levels.

That is the whole change: **a new family is a data edit in one file.** No gallery file is touched, no new
CSS class beyond the ones defined once (§2.6), no new preset field. (`Architecture` has no templates today,
so its family simply does not appear until it has one.)

### 5.2 What a later family must NOT need

* No new `family` field, no per-family registry, no hard-coded list of families in the UI.
* No new breakpoint number, prop or state flag for layout (§2.6).
* No new npm dependency: the card preview is built from `SHAPES`/`ShapePreview`/`shape-frame`, which
  already exist.
* No new colour: level chips and cards use existing tokens (`--border-strong`, `--dim`, `--elevated`,
  `--acc`, `--surface`).

### 5.3 The four templates that ship today — migration

| template | action |
|---|---|
| `flowchart/approval` | keep nodes/edges byte-identical; add `level: 'advanced'` (metadata only) — §3.4 |
| `c4/c4-context` | untouched (stays in C4's `null` group) |
| `c4/c4-container` | untouched |
| `erd/commerce` | untouched |

No board on disk is affected: boards store `{preset, nodes, edges}`, never a template id, so seeding is a
copy-out and no persisted document references a template. Nothing to migrate, nothing to clear — and per
Harvey's standing rule, if a future template change ever makes persisted state inappropriate, it is CLEARED,
not migrated.

### 5.4 Files touched

**Modified:**
* `src/presets.ts` — `TemplateLevel`, `TEMPLATE_LEVELS`, two optional fields on `TemplateSpec`, the three
  new template literals (§4), `level: 'advanced'` on `approval`.
* `src/BoardDialog.tsx` — the two flattening loops keep their exact text and gain `level: t.level ?? null`
  in the `push` (§6 AC 3 — see the harness constraint in §7.1); family/level header rows in `.bd-list`; the
  trailing "Browse all templates…" row; an optional `initialPick?: {preset: PresetId; templateId: string}`
  prop so the gallery hands a choice to the dialog instead of creating a board itself.
* `src/styles.css` — `.bd-grouphead`, `.bd-level`, `.tg-*` (gallery), plus the tier rules of §2.6. Tokens
  only, no new hex.
**New:**
* `src/templateCatalog.ts` — `templateCatalog()` (§3.2), the ONE catalog.
* `src/TemplatesGallery.tsx` — the modal (§2.5 Pass 2).
* `checks/package-templates.mjs` — the probe harness for §6 (runs by path, like the other 25).

---

## 6. Acceptance criteria (numbered, measurable — each names its probe)

Every probe below is either (a) EXECUTED against the real `src/presets.ts` bundled with the project's own
esbuild (the technique `checks/round-ad-flowchart.mjs` and `checks/package-o-board-dialog.harness.mjs`
already use), (b) a TEXT/structural read of a source file with comments blanked first, or (c) `tsc`/`build`.

1. **Level field + grouping.** `templateCatalog()` returns families in `PRESETS` key order, each with
   groups in the fixed order `basic, advanced, complex, null-last`; entries inside a group sort by
   `order ?? 0` then `id`. *Probe:* `checks/package-templates.mjs` bundles `src/templateCatalog.ts`, walks
   the returned structure and asserts the order arrays literally.
2. **Nothing is lost and nothing is invented.** The catalog's total entry count **====** the sum of
   `Object.values(PRESETS).flatMap(p => p.templates ?? []).length` (measured today: 4 → after this round:
   **7**), and the set of `(preset, templateId)` pairs is exactly that same set. *Probe:* same bundle,
   two sets compared; a mismatch prints both.
3. **The existing dialog list still builds itself from PRESETS.** `BoardDialog.tsx` still contains the two
   loops `/for \(const id of Object\.keys\(PRESETS\) as PresetId\[\]\)/` and
   `/for \(const t of PRESETS\[id\]\.templates \?\? \[\]\)/`, still declares a `const TEMPLATES` block
   liftable by `checks/package-o-board-dialog.harness.mjs`'s `/const TEMPLATES[\s\S]*?\n}\n/` regex, and
   that harness still reports 10/10. *Probe:* `node checks/package-o-board-dialog.harness.mjs` exit 0.
4. **The four legacy templates are reachable.** The catalog contains `flowchart:approval`, `c4:c4-context`,
   `c4:c4-container`, `erd:commerce`, and each resolves exactly as `App.tsx` resolves it
   (`getPreset(pid).templates?.find(x => x.id === templateId)`). *Probe:* catalog probe + the existing
   `6b.App-resolves-the-pair-within-the-chosen-preset` assertion.
5. **Level-1 shape set === the first 5 palette rows.** With the shared predicate `L(n) := n.type === 'label'
   ? skip : (n.data.shape !== 'group' && n.data.shape !== 'note' ? n.data.shape : skip)` — i.e. labels,
   `group` and `note` are excluded, exactly as AC 7 already does —
   `new Set(flow-basic.nodes.filter(isFlowShape).map(n => n.data.shape))` deep-equals
   `FLOWCHART_PRESET.palette.slice(0, 5).map(p => p.shape)` — i.e.
   `{terminator, process, decision, io, document}`, size 5. *Probe:* executed over the bundled module.
6. **Level-2 shape set === the first 10 palette rows.** As above with `slice(0, 10)`, size **10**, and the
   sets are strictly nested (`basic ⊂ advanced`). *Probe:* same.
7. **Level-3 shape set === ALL 16 flowchart shape ids.** The same predicate as AC 5/6 —
   `new Set(flow-complex.nodes.filter(n => n.data.shape !== 'group' && n.data.shape !== 'note'
   && n.type !== 'label').map(n => n.data.shape))` has **size 16** and deep-equals the palette rows `0..15`
   (`terminator, process, decision, io, document, subprocess, preparation, manual, delay, connector,
   offpage, manualinput, display, storeddata, looplimit, internalstorage`). Printed as a set-difference so
   a miss names the missing id. *Probe:* executed over the bundled module. (This is the HARD criterion.)
   **The exclusion is not a weakening:** `label`/`group`/`note` are canvas annotations, not flowchart shape
   ids, and the three templates carry `label` nodes (D3) and a `note` — without the exclusion the
   unfiltered expression would count `undefined` as a 6th/11th/17th "shape" and silently pass at the wrong
   size. The criterion still demands exactly 5 / 10 / 16 real shape ids.
8. **Nesting is exact, not approximate:** `L1 ⊂ L2 ⊂ L3`, `|L3| === 16`, `|L2| === 10`, `|L1| === 5`,
   where `L1`/`L2`/`L3` are the sets AC 5/6/7 build with the shared predicate. *Probe:* same bundle,
   subset asserts.
9. **Every new template lays out, and nothing can move wrongly.** Running
   `LAYOUTS['layered-tb'](t.nodes, t.edges, FLOWCHART_PRESET.layout)` over each new template returns a
   position for **every** node, with **no two nodes sharing a coordinate**, and `flow-complex` produces
   ≥ 18 distinct layers (its three back-edges are the risky case).
   **Plus the D4 invariant, asserted on the DATA:** none of the three templates contains a `label` node or
   a `group` node, so no annotation can be parked in the engine's trailing ORPHAN row; the only edge-less
   node anywhere is the single `note` at Advanced and Complex, and a note below the flow is intended.
   *Probe:* executed — import `LAYOUTS` from the bundle, run it, assert cardinality + uniqueness + layer
   count, then assert `t.nodes.filter(n => n.type === 'label' || n.data?.shape === 'group').length === 0`
   for all three. (Measured expectations after D4: `flow-basic` **10** nodes, `flow-advanced` **15**
   (14 flow + 1 note), `flow-complex` **25** (24 flow + 1 note); the note is the only node with no edges
   and it is the only one the engine parks in the trailing row.)
10. **The approval template is untouched where it matters.** `approval`'s `nodes` and `edges` are
    **byte-identical** after the change (JSON.stringify of both arrays compared against the pre-change
    capture, which the probe stores beside the expectation); only `level` is added.
    *Probe:* bundled module + a stored fixture hash of the two arrays.
11. **The three new templates are generic.** No node/edge string in the new templates matches a
    person/company/brand/email/URL pattern (`/@[a-z0-9.-]+\./i`, a small denylist of brand words kept in
    the probe, and the absence of any `www.`/`http`). *Probe:* text scan of the bundled template strings.
12. **No new colour.** The hex-literal count in `src/styles.css` is **≤ 160** (measured today: 142) and
    **unchanged from the pre-change value**; no `rgba(`/`#` literal appears in `src/TemplatesGallery.tsx`,
    `src/templateCatalog.ts` or the new CSS blocks. *Probe:* the same count `round-ad-flowchart.mjs` runs,
    plus a literal scan of the two new files.
13. **`Shape` union stays at 19 ids** and `FLOWCHART_NODE_SIZE` is `{290, 145}` on every flow node of all
    three templates (so seed-from-template and drag-from-panel agree, the invariant
    `checks/round-ad-flowchart.mjs` holds). *Probe:* `round-ad-flowchart.mjs` still passes; plus an
    assertion that every new flow node's `style.width/height` equals the constant.
14. **`tsc --noEmit` = 0** and `node ./node_modules/vite/bin/vite.js build` = 0. *Probe:* both commands.
15. **All 25 existing harnesses still pass** (by path, exit 0), with `package-o-board-dialog.harness.mjs`
    reporting 10/10 and `round-ad-flowchart.mjs` green. *Probe:* run each file in `checks/*.mjs`.
16. **The dialog's keyboard contract is unchanged**: one `role="radiogroup"`, exactly one row with
    `tabindex=0`, Arrow/Home/End move the choice AND the focus, header rows are not focusable and not in
    the option array, Escape closes, focus returns to the trigger. *Probe:* a DOM-level check in the
    browser pass (the existing harness cannot see the DOM and says so), plus a source assertion that the
    roving index still walks the `opts` array.
17. **The gallery adds no breakpoint, no prop-for-layout, no state flag:** `src/TemplatesGallery.tsx`
    contains **zero** numeric width literals in `@media`-like contexts and zero new `data-*` attributes;
    its tier rules live entirely in `styles.css` scoped on
    `.app[data-form-factor=…]` / `[data-orientation=…]`, and `dockedSidebarBreakpoint` (1229) is the only
    breakpoint number involved. *Probe:* text scan of both files + a grep that the string `1229` appears
    once in `src/useEditorInterface.ts` and nowhere new.
18. **One board-creation path.** The gallery contains no call to `createBoard`, `saveBoard`, `flushSave` or
    `pushHistory`; its primary action opens `BoardDialog` with `initialPick`. *Probe:* text scan.
19. **`boards/` is not read by any new probe** (the app regenerates its own first-run board; the old
    demo-board invariant was superseded). *Probe:* the new harness never references the `boards/` path.
20. **Docs/state honesty:** the harness prints, for each of the three templates, `nodes`, `edges`, distinct
    shape count and the level — so a future reader sees the measured numbers rather than a claim.

---

## 7. Decisions I made that were undefined

1. **The flattening loop STAYS in `BoardDialog.tsx`.**
   `checks/package-o-board-dialog.harness.mjs` does two things this spec must not break: it asserts the two
   literal `for` loops exist in `BoardDialog.tsx`, and it **lifts the `const TEMPLATES … }` block out of
   the file text and executes it** with the real `PRESETS` injected. Moving the flattening into a new
   module would break both, and the file is one of the 25 green harnesses. So the loop stays, extended
   additively (`level: t.level ?? null`), and the gallery reads `templateCatalog()` — with AC 2 proving the
   two can never diverge because both derive from `PRESETS`.
2. **No `family` field — the family is the preset.** A second identity string could drift from `PRESETS`;
   the preset already owns label, hint and the templates themselves (§3.1).
3. **Phase headings are REMOVED from all three levels (D4, §8.1), and no Lane bands are used (D3).** The palette hint
   says `Lane` is a "container · role"; the earlier draft used three Lane bands as PHASE bands. Harvey's
   decision removes lanes from this round entirely, and the measurement behind it is in §8 Q2: the layout
   engine freezes `group` nodes at their authored coordinates while re-placing everything else, which on
   the existing `approval` template already leaves only 6 of 10 flow nodes inside a lane band. Plain
   phase headings are **removed entirely (D4)** rather than moved onto `label` nodes: an edge-less
   annotation is parked by the engine in a trailing ORPHAN row, so a heading would fling itself to the
   bottom of the board (measured: an isolated `label` authored at `x 60, y 40` came out at
   `x -140, y 2150`, below a flow ending at y 1935). Lane usage moves to a separate future round.
4. **`offpage` is justified as a real two-page procedure, and a legend alternative is pre-written**
   (§4.5). The brief allows an honest fallback; this spec offers the exact edit rather than faking a second
   page inside a one-page document. **This is the one symbol the domain swap did not fix:** even in
   flat-pack furniture, `offpage` is the page-break convention rather than an object, so it stays the
   single reading a user must accept and stays the subject of conflict C3.
5. **`internalstorage` vs `storeddata` mapped by PERSISTENCE, not by "memory".** `internalstorage` is
   software's in-memory store; here it is **the loose parts held in the box during the job** — work held
   only while the assembly runs, gone when it ends. `storeddata` is **the bag of leftover screws** — read
   and written and kept between sessions. That contrast is the only reading that gives both symbols a
   truthful job in this domain.
6. **`approval` gets `level: 'advanced'`** (§3.4) — metadata only; nodes/edges untouched.
7. **Level is a label + grouping header, not a filter** (§3.5), with the row-count justification and the
   re-open condition (~15 rows / ~5 per level).
8. **v1 templates create a NEW board only; insert-into-board deferred with a preset-equality gate** (§2.4).
9. **The gallery's preview is data-rendered, not a bitmap or an html-to-image capture** (§2.2): no new
   dependency, no asset pipeline, and the preview cannot drift from the template.
10. **No persisted UI state for the gallery in v1** (§2.6) — avoids the clear-vs-migrate question entirely;
    Harvey's rule (clear, don't migrate) is recorded for whenever a `diagram-studio:*` key is added.
11. **Template ids/labels/hints** follow the existing conventions (`id` kebab-case and unique inside its
    preset; `hint` = `<level> · <what it adds> · <extras>`, ≤ the existing hints' length so the dialog's
    one-line ellipsis stays meaningful). Chosen ids: `flow-basic`, `flow-advanced`, `flow-complex` — stable
    enough that a later rename of the domain does not invalidate a saved reference in a probe or a doc (and
    that is exactly what made the D1 domain swap a content-only edit: the ids did not change).
12. **Colour keys for the new nodes reuse the flowchart legend's five keys only** (green/cyan/amber/violet/
    slate) so no legend row and no token is added.

---

## 8. Conflicts / open questions for Harvey

### 8.1 Settled by Harvey (2026-09-20)

Recorded FIRST so a later reader meets the decisions before the analysis that supports them. Each entry
quotes Harvey's own words verbatim (Vietnamese); everything else in this file is English.

**D1 — THE DOMAIN. Wash day is REPLACED by flat-pack furniture assembly (self-assembly furniture from a
flat box).**
Harvey, verbatim: *"với tôi B rất ok"* — where **B** was the mockup's candidate B, flat-pack furniture.
His reason for preferring it: it is funnier, equally universal / everyday, and — per the mockup's coverage
analysis — it also hosts all 16 ISO 5807 symbols honestly.
**Consequences:** the domain for ALL THREE new templates is flat-pack furniture assembly. Wash day is kept
on record as the RUNNER-UP, not as an alternative implementation (§4.1). The three symbols wash day only
reached by convention now get an object: `offpage` = **page 2 of the printed instruction sheet**,
`storeddata` = **the bag of leftover screws kept forever**, `internalstorage` = **the loose parts held in
the box during assembly** (the honest contrast pair with `storeddata`). `offpage` remains the one
convention-dependent symbol (a page break), so §4.5's pre-written 3-line fallback stays. The template IDS
are unchanged (`flow-basic`/`flow-advanced`/`flow-complex`), so this is a content-only edit.

**D2 — THE GALLERY GETS NO TOOLBAR ENTRY. Boards menu ONLY.**
Harvey, verbatim: *"trc mặt là menu Boards đi"* ('for now, the Boards menu').
**Consequences:** §2.2/§2.5's toolbar was listed as undecided (old open question Q1); it is DECIDED as
boards-menu-only. A toolbar entry is **deferred, not forbidden** — it is cheap to add later and requires no
data change (no new field, no new key, one more trigger calling the same modal). Q1 is therefore no longer
an open question.

**D3 — THE THREE NEW TEMPLATES USE NO LANE NODES.**
**Consequences:** all three templates contain **zero `group` nodes**. `Note` is still used once at Advanced
and once at Complex. Lane usage moves to a **separate future round**.
The measurement that justified it is recorded under Q2 below: on the existing `approval` template the
engine places only **11 of 14** nodes (the 3 lane bands are skipped), the bands stay frozen at y = 0 / 70 /
320 while the laid-out flow runs y 0 → 780, and only **6 of 10** flow nodes stay inside a lane band (3 of
10 inside a band in both axes).

**D4 — NO PHASE-HEADING ANNOTATION EITHER; THE THREE TEMPLATES CARRY NO `label` NODES AT ALL.**
Harvey, verbatim: *"ok"* — agreeing to the orchestrator's recommendation after it MEASURED that the
`label` substitute was not safe either.
**The measurement that forced it:** an annotation node with no edges is an ORPHAN to
`LAYOUTS['layered-tb']`, and the engine parks every orphan in a trailing row **after the last layer**.
Measured on the live engine over an L1-shaped board (10 chained flow nodes + 1 heading label): all 11
nodes were given a position, and the heading authored at `x 60, y 40` came out at **`x -140, y 2150`** —
below a flow that ended at y 1935. So pressing Auto-arrange would fling every phase heading to the bottom
of the board. (A `note` has the same orphan behaviour — measured: a note authored at y 70 came out at
y 5215 below a flow ending at y 5000 — but **a footnote below the flow is correct**, whereas a heading
below the flow is wrong, which is why the `Note` stays and the headings go.)
**Consequences:** the three templates carry **zero `label` nodes and zero `group` nodes** — only flow
nodes plus (at Advanced and Complex) one `note`. Node counts become **10 / 15 / 25**. Nothing on any of
the three boards can move wrongly on Auto-arrange, which is Harvey's own standing requirement
(*"không phá layout là chính"*).

---

**Conflicts between this brief and the real code (reported, not silently chosen):**

**C1 — "the 25 existing harnesses still pass" constrains HOW the data model is added.**
`checks/package-o-board-dialog.harness.mjs` lifts the `const TEMPLATES` block **out of `BoardDialog.tsx`'s
source text** and executes it with the real `PRESETS` injected, and separately regex-asserts that the two
`for` loops are present in that file. The natural refactor (move the flattening to a new
`templateCatalog.ts` and call it from the dialog) breaks that harness. §7.1 therefore keeps the loop in
place. *Recommendation: keep the loop (as specified).* The alternative — refactor and update the harness —
is a harness change, which this brief's guardrails place outside this spec's scope.

**C2 — the brief says the only surface is `BoardDialog`, but the dialog is not reachable without creating a
board.** So "browse templates" has no home today; that is why §2.5 recommends a gallery rather than a bigger
list. *Recommendation: two passes, gallery in Pass 2.*

**C3 — "all 16 shapes in one coherent flow" is met, but one symbol (`offpage`) is a convention rather than
an object.** Handled honestly (§4.5) with a pre-written fallback. *Recommendation: keep the two-page
reading, and let Harvey decide after seeing the seeded board; the fallback is a 3-line edit.* The D1 domain
swap improved this — the procedure now genuinely continues on page 2 of a printed sheet — but it did not
remove the convention, so C3 stays open as a conflict.

---

**Q1 — SETTLED (was: does the gallery also get a toolbar entry, or only the boards menu?).**
**DECIDED by Harvey — boards menu only (D2, §8.1), toolbar entry deferred.** The original reasoning is kept
as the record: the toolbar already carries tier rules at the phone tier and a 6th chip costs room there,
while a toolbar entry can be added later with no data change. Nothing here is open.

**Q2 — RECORDED MEASUREMENT + DECISION (was: auto-arrange re-places the flow from the origin and leaves the
frozen lane bands behind).**

*The measurement (taken on the live layout engine, `LAYOUTS['layered-tb']` with the flowchart preset's own
layout spec — `direction:'TB'`, `spacing {x:90,y:70}`, `bandGroups:true` — over the EXISTING `approval`
template, not a hypothetical):*

| what was measured | value |
|---|---|
| nodes in `approval` | 14 (10 flow + 3 lane bands + 1 label) |
| nodes the engine returns a position for | **11** — the 3 `group` bands are skipped |
| frozen bands | `pool` y 0, `laneReq` y 70, `laneFin` y 320 — unchanged by layout |
| laid-out flow's y range | **0 → 780** |
| flow nodes staying inside a lane band (y-axis) | **6 of 10** (`a1`–`a6`) |
| flow nodes fully inside a band (both axes) | **3 of 10** (`a2`, `a3`, `a4`) |

Cause: `bandGroups` freezes top-level `group` nodes and only re-places top-level non-`group` nodes, while
the lanes keep the coordinates they were authored at. The mismatch is mild on `approval` and would be far
worse on any larger multi-lane board (the set-aside draft's 31-node / 3-lane design was the case that made
it obvious).

*The decision:* **the three new templates use NO Lane nodes (D3).** Phase headings are plain `label` nodes,
which are ordinary layout participants — no band rectangle to fall out of. No layout-engine change in this
round. **Lane usage moves to a separate future round**, and when it returns the choice is still between
(a) lane-relative layout for the flow nodes (`parentId` to the lane) and (b) a `bandGroups` option that
offsets the layers into the authored bands. That is a real design choice and must not be smuggled into a
template round.

**Q3 — MOOT: settled.** This asked whether "wash day" was the right domain for a shared tool. D1 (§8.1)
settled the domain — flat-pack furniture assembly replaces wash day, and the new domain is generic by
construction (no brand, company, person, locale, URL or email). Nothing to decide here. The old fallback
suggestion ("posting and receiving a parcel") is dropped: it drifts toward the order/approval shape
`approval` already covers, and the chosen domain does not need it.
