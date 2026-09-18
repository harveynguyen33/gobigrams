# PACKAGE-N — Palette / shape-library redesign (Diagram Studio)

**Status:** SPEC — for orchestrator review, then implementation
**Input:** `/home/harvey/diagram-studio-research/PALETTE-SYNTHESIS.md` (primary) + the four cluster reports it cites + the live code.
**This spec only.** No implementation code, no edits to `src/` / `vite.config.ts`.

---

## 0. Context

**Revision 2 — UNIFIED-LIBRARY model.** This revision **supersedes** the per-preset palette model
from Revision 1. The change: there is **one** shape library; the diagram type is a **filter / view**
over it, not a separate list per type. (Harvey 2026-09-16, verbatim intent: "tối k muốn phân loại theo
từng cái, mà là gom vô chung phần duy nhất… Nó cảm giác bị trùng lặp ở 1 số" — one shared library,
diagram type is a filter.)

The Revision 1 duplication was measured and is **real**: 36 palette slots across the 4 presets; `Note`
appeared 4× as 4 separate entries; 8 shapes were split into different-named items. Revision 2 makes
every element appear **exactly once**; a diagram type shows a *filtered view* of the one library, and
the multi-type membership of a shared element is surfaced only as a **badge**, never as a duplicate
entry.

The left panel today is ONE flat list of `PaletteItem`s, no grouping, no search, no personal
library. Harvey wants (settled, do not re-open):

1. Palette organised **draw.io-style** — categorised into collapsible groups (take a better design
   where one exists).
2. A **scratchpad that is a favourites/library** ("a place to keep the shapes the user LIKES") — NOT
   draw.io's drag-here holding pen.
3. A **custom element** feature: import user-supplied SVG/icons, reusable across boards.
4. Custom material must **not break the layout** ("không phá layout là chính").
5. Everything **local** (no backend).

The design that satisfies all of these decisions is in synthesis §2. This spec pins it down against
the actual code and the project's invariants.

> **Naming note (both revisions):** "library" is used for TWO distinct things. (1) The **shape
> library** — the 33 built-in palette elements defined in code (`src/palette.ts`), referred to below
> as `LIBRARY`. (2) The **user library** — the persisted favourites + custom-shape document served by
> `/api/library` (§7), a JSON file. They are unrelated; this revision touches the first, §7 is
> unchanged.

---

## 1. `PaletteItem` gains `category` + `types[]` (+ alias index + geometry word)

### 1.1 Type change (exact)

In `src/palette.ts`, extend the existing type. **One `Shape` union stays** — `category` and `types`
are metadata on `PaletteItem`, never a second shape registry (the codebase already enforces "one
union, presets select a subset"). The panel renders ONE list and *filters* it by diagram type (§2.6,
§5).

```ts
/** The four real diagram types. `custom` (Mixed) is deliberately ABSENT —
 *  it is a separate SET selector (§2.7), not a filter over `types[]`.
 *  These are the persisted preset ids minus `custom`. */
export type DiagramType = 'architecture' | 'flowchart' | 'c4' | 'erd';

export type PaletteCategory =
  | 'basic' | 'flowchart' | 'data-storage' | 'architecture'
  | 'c4' | 'entities' | 'groups' | 'annotations';

export type PaletteItem = {
  label: string;
  hint: string;
  shape: Shape;
  colorKey: ColorKey;
  kind: PalKind;
  size?: {width: number; height: number};
  /** Home category — an item lands in exactly one. (Required.) */
  category: PaletteCategory;
  /** NEW (v2) — REQUIRED, non-empty. Which diagram types show this item.
   *  An element can belong to several types; the panel still lists it ONCE (§2.6). */
  types: DiagramType[];
  /** NEW — searchable alias/synonym index (Mermaid's curated list + retired labels). */
  aliases?: string[];
  /** NEW — geometry word in its own searchable field ("cylinder","diamond","hexagon",…). */
  geometry?: string;
  make: () => NodeKind | LabelKind;
};
```

`category` and `types` are **both required** (no default), so the compiler forces every literal to
state a home and its diagram-type membership. This is deliberate: a missing `category` would strand
an item from every collapse/visibility rule, and a missing/empty `types` would silently hide it from
every diagram type.

- `category` = **where** the item sits in the list (the 8 sections, §2) — exactly one per element.
- `types` = **which** diagram types show it — one or more per element.
- An element can be in exactly one category and in several types. (e.g. `Note` is in `annotations`
  and in all four types.)

### 1.2 Every file that consumes `PaletteItem` (all must change)

| File | Why it changes |
|---|---|
| `src/palette.ts` | the type + `PALETTE` (10 items) — add `category`/`types`/`aliases`/`geometry` per item; apply the renames (§3); becomes the home of the single `LIBRARY` (§2) |
| `src/presets.ts` | `fc()` factory, `FLOWCHART_PALETTE`, `TABLE_PALETTE_ITEM`, the `C4_PRESET.palette` `.map()` output, the two `Note` literals (C4 + ERD), `CUSTOM_PRESET` — add the same fields to every literal; **stop hand-listing per-preset palettes** and derive them from the one `LIBRARY` via the `libraryFor(id)` selector (§2.6–§2.7); apply the two preset-label renames (§3.2) |
| `src/App.tsx` | the left-panel render (§5) — reads `p.label`/`p.hint`/`p.shape`/`p.colorKey`/`p.kind`, consumes the new fields, renders the diagram-type filter + the `types` badges |
| `src/SearchPalette.tsx` | the reused search (§9) — extend its filter to `aliases` + `geometry` |

`makeFromPalette` (presets.ts:690) and the drag-by-index mechanism are unchanged in shape; the
category and types travel on the item, not the index.

---

## 2. The 8 categories + the ONE library (34 elements)

Category ids and display labels. The **id** `groups` replaces Revision 1's `groups-boundaries`
(cosmetic only — `category` is a brand-new field, nothing persists it; the brief's element table and
the v2 mockup both use the short `groups`). Content and order are unchanged.

| id | display label |
|---|---|
| `basic` | Basic |
| `flowchart` | Flowchart |
| `data-storage` | Data & storage |
| `architecture` | Architecture |
| `c4` | C4 |
| `entities` | Entities |
| `groups` | Groups & boundaries |
| `annotations` | Annotations |

### 2.1 The ONE library — element → types → category (verbatim, 34 elements)

Every element appears **exactly once**. `types` says which diagram types show it; `category` says
where it sits. (The `shape`/`colorKey`/`kind`/`make()` for each element come from its existing
definition in `palette.ts`/`presets.ts`, with the §3 renames applied — this table only adds the two new
fields.)

| Element (label) | types | category | note |
|---|---|---|---|
| `Process` | flowchart | `basic` |  |
| `Decision` | flowchart | `basic` |  |
| `Text` | architecture | `basic` | free label, `kind:'label'` |
| `Terminal` | flowchart | `flowchart` | renamed from Start / End |
| `Input / Output` | flowchart | `flowchart` |  |
| `Document` | flowchart | `flowchart` |  |
| `Predefined process` | flowchart | `flowchart` | renamed from Subprocess |
| `Preparation` | flowchart | `flowchart` |  |
| `Manual operation` | flowchart | `flowchart` | renamed from Manual step |
| `Delay` | flowchart | `flowchart` |  |
| `On-page connector` | flowchart | `flowchart` | renamed from Connector |
| `Database` | architecture | `data-storage` |  |
| `Storage` | architecture | `data-storage` |  |
| `Service` | architecture | `architecture` |  |
| `Queue` | architecture | `architecture` |  |
| `External` | architecture | `architecture` |  |
| `Actor` | architecture | `architecture` |  |
| `Gateway` | architecture | `architecture` |  |
| `Person` | c4 | `c4` |  |
| `Person, External` | c4 | `c4` |  |
| `Software System` | c4 | `c4` |  |
| `Software System, External` | c4 | `c4` |  |
| `Container: application` | c4 | `c4` |  |
| `Container: database` | c4 | `c4` |  |
| `Container: queue` | c4 | `c4` |  |
| `Container: object store` | c4 | `c4` |  |
| `Component` | c4 | `c4` |  |
| `System boundary` | c4 | `c4` |  |
| `Container boundary` | c4 | `c4` |  |
| `Table` | erd | `entities` | `kind:'erg-table'` |
| `Group` | architecture | `groups` |  |
| `Lane` | flowchart | `groups` | swimlane |
| `Note` | architecture/flowchart/c4 | `annotations` | shared generic annotation — **exactly one entry**; the two `make()` bodies found in the code (architecture's `sub:'annotation'` vs flowchart/C4's `sub:''`) are normalised to **one** definition (`sub:''`), see §12.7 |
| `Note (enum)` | erd | `annotations` | **distinct** — `kicker:'enum'`, `title:'status'`, amber; see §12.7 |

### 2.2 Category membership (derived from §2.1 — full enumeration, nothing is lost)

| Category | Items (label) | count |
|---|---|---|
| **Basic** | Process, Decision, Text | 3 |
| **Flowchart** | Terminal, Input/output, Document, Predefined process, Preparation, Manual operation, Delay, On-page connector | 8 |
| **Data & storage** | Database, Storage | 2 |
| **Architecture** | Service, Queue, External, Actor, Gateway | 5 |
| **C4** | Person, Person (external), Software System, Software System (external), Container: application, Container: database, Container: queue, Container: object store, Component, System boundary, Container boundary | 11 |
| **Entities** | Table | 1 |
| **Groups & boundaries** | Group, Lane | 2 |
| **Annotations** | Note | 1 |

Total = 3 + 8 + 2 + 5 + 11 + 1 + 2 + 1 = **33**. Every element lands in exactly one category.

### 2.3 Shapes that "do not fit" — called out (carried from Revision 1, still valid)

- **`process` and `decision`** are the only items placed in `basic` rather than `flowchart`. Both are
  ISO 5807 flowchart symbols *and* Mermaid's two canonical generic-geometry shapes (`rect` / `diam`).
  Home = **Basic** (they are the universal primitives); the 8 remaining ISO shapes stay in
  **Flowchart**.
- **`preparation`** (hexagon) is ISO "Preparation / Initialization" first; home = **Flowchart**. Same
  for `terminator` (stadium) and `io` (parallelogram).
- **`note`** is a "plain text annotation" shape; home = **`annotations`**, shared across all four
  types (§2.6). See §12 conflict 2 for the ERD enum-note distinction.
- **`group`** is used by architecture `Group`, flowchart `Lane`, and the three C4 boundaries. As
  distinct items they get homes `groups` (Group, Lane) and `c4` (the boundaries) — per §2.5.

### 2.4 C4 boundaries → the `C4` category (settled, unchanged)

All boundary items (`boundarySystem`, `boundaryContainer`, `boundaryEnterprise`) carry
`category:'c4'`, NOT `groups`. Rationale (Harvey 2026-09-16): keep the C4 vocabulary together rather
than splitting boundaries into a generic group. The architecture `Group` and flowchart `Lane` remain
in `groups`.

### 2.5 C4 keeps its OWN elements (settled, do not re-open)

C4's 11 elements stay **distinct `PaletteItem`s** from the architecture shapes, even where they share
a `shape` id (`Container: database` ≠ `Database`; `Component`/`Container: application`/`Software
System` ≠ `Service`). Rationale (Harvey): C4 will be customised further later. Do NOT flatten them
into the architecture shapes. A `service`-shaped C4 `Container: application` has `category:'c4'`,
`types:['c4']`; the architecture `Service` has `category:'architecture'`, `types:['architecture']`.
The same `shape` id may appear in two categories **as different palette items** — that is the point of
`category`+`types` as metadata (§1.1).

### 2.6 The diagram-type FILTER (counts) — MODEL ONLY, no chip UI (Revision 3)

`custom` (Mixed) is **not** a filter over `types[]` — it is its own set (§2.7). The four real types
are filters. `All` is a view-only filter (not a persisted preset) that shows the whole library with
badges.

| Diagram type | Count | Derivation |
|---|---|---|
| All | **34** | the entire `LIBRARY` — no filter |
| Architecture | **10** | `types.includes('architecture')` → 5 arch + 2 data-storage + 1 group + 1 text + 1 note |
| Flowchart | **12** | `types.includes('flowchart')` → 8 flowchart + process + decision + lane + note |
| C4 | **12** | `types.includes('c4')` → 11 C4 **+ the shared `Note`** |
| Data model (erd) | **2** | `types.includes('erd')` → `Table` + `Note (enum)` (the ERD palette has NO generic note) |
| Mixed (custom) | **27** | its own set (§2.7), not a `types[]` filter |

The `custom` count is **not** the union of the four `types[]` filters (that would be 34). It is a
strictly smaller, curated set — see §2.7.

### 2.7 The Mixed set (`custom`) — its own selector

From `presets.ts` (read verbatim), `CUSTOM_PRESET.palette` is:

```
PALETTE + FLOWCHART_PALETTE(−Lane, −Note) + C4_PRESET.palette.slice(0,6) + TABLE  =  27
```

Encoded against the unified library, Mixed = the union of:

1. **all `architecture`-type elements** (10): Service, Database, Queue, External, Actor, Storage,
   Gateway, Group, Note, Text;
2. **all `flowchart`-type elements EXCEPT `Lane` and `Note`** (10): Terminal, Process, Decision,
   Input/output, Document, Predefined process, Preparation, Manual operation, Delay, On-page
   connector;
3. **the first six C4 elements in `C4_TYPES` order** (6): Person, Person (external), Software System,
   Software System (external), Container: application, Container: database;
4. **`Table`** (1).

= 27. `Note` appears once (via set 1); `Lane` is excluded; `Container: queue`, `Container: object
store`, `Component`, `System boundary`, `Container boundary` are excluded.

**Encode this as its own selector** — a set of element identities, **not** a `types[]` filter and
**not** a label string match (labels change under §3 renames). Key it on the stable element identity
(the `shape`+`kind` pair, or a dedicated stable `id` field if one is introduced). This is the one
place "Mixed" diverges from "everything".

---

## 3. Renames (element + preset-label)

### 3.1 The 5 element renames (carried from Revision 1, unchanged)

The old word is preserved in `hint` so muscle memory and search still work. Applied to both the
`PaletteItem.label/hint` AND the matching `SHAPES[i].label` in `src/shapes.tsx`, so the insert palette
(`SearchPalette`) and the left panel agree.

| # | Old label | New label | New hint (old word retained) | shape id |
|---|---|---|---|---|
| 1 | Start / End | **Terminal** | "Start / End · stadium · terminator" | `terminator` |
| 2 | Subprocess | **Predefined process** | "Subprocess · double-bar rect · defined elsewhere" | `subprocess` |
| 3 | Manual step | **Manual operation** | "Manual step · trapezoid · done by a person" | `manual` |
| 4 | Connector | **On-page connector** | "Connector · circle · jump on page" | `connector` |
| 5 | Preparation | **Preparation** (label unchanged) | "Preparation · Initialization · hexagon · setup / init" | `preparation` |

> **FLAGGED — the "fifth" rename.** The synthesis §2.2 header says "Rename **5** items" but its body
> lists only **4** arrows; the 5th is **Preparation**, whose change is *hint-only* (gain the ISO
> alternative name "Initialization"), not a label change. Harvey approved this reading
> ("5 = 4 label changes + 1 hint enrichment"). Row 5 above stands.

### 3.2 The 2 preset-label renames (NEW in v2 — display only, boards safe)

| Preset id | Old label | New label | Why it is safe |
|---|---|---|---|
| `erd` | Database / ERD | **Data model** | id `erd` unchanged |
| `custom` | Custom / Blank | **Mixed** | id `custom` unchanged |
| `architecture` | Architecture | (unchanged) | standard's own name |
| `flowchart` | Flowchart | (unchanged) | standard's own name |
| `c4` | C4 | (unchanged) | standard's own name |

A board stores `preset: "erd"` (the id); the UI shows `getPreset(id).label`. Renaming only the label
changes display, never the persisted id — **old boards are safe**. Verified against code:
`ERD_PRESET.label = 'Database / ERD'` and `CUSTOM_PRESET.label = 'Custom / Blank'` in `presets.ts`;
`getPreset(id)` returns the preset and `BoardDoc.preset` stores the id. Only the two label strings
change.

---

## 4. Left-panel layout

### 4.1 Three sections in ONE scroll container (top → bottom)

1. **Search field** (omnibox) — pinned at the top. Searches the WHOLE library (independent of any
   filter), matching `label` + `hint` + `aliases` + `geometry`; a hit inside a COLLAPSED category is
   shown **dimmed, never hidden**.
2. **Favourites** — the personal library (§6). Flat grid, NOT categorised.
3. **Categories** — the 8 collapsible sections of the one shape library (§2), in canonical order.

> **REVISION 3 — the type CHIPS and the per-row `types` BADGES were REMOVED (Harvey, 2026-09-16).**
> Measured reason: of the 34 elements, **33 belong to exactly ONE type** — so the badge merely
> restated the row's own category, and the chip filter returned close to what the category already
> contained. A 6-chip row cost **77px / 3 wrapped rows** permanently for that. Only `Note` is
> multi-type. The `types[]` field **STAYS in the data** (it drives nothing visible any more but is the
> model's source of truth, and a future feature may want it) — it is simply not rendered.
> Consequences for §2.6/§5 below: the counts there describe the DERIVED sets (kept as documentation of
> the model), but no chip UI renders them and no badge renders per row.

Explicitly do **NOT** copy draw.io's `+ More Shapes` 66-entry 5-group dialog (cluster 1's own
"do not copy" list) — over-engineered for a 33-element app.

### 4.2 Collapse state — persistence key + shape (decided)

Persist **only** `collapsedLibraries` — a map `{[categoryId]: boolean}` where `true` = collapsed —
under a new namespaced key **`diagram-studio:categories`**. Value shape:

```json
{ "collapsed": { "data-storage": true, "flowchart": false, "c4": true, "..." } }
```

- **Justification for `collapsedLibraries` only, no `libraryOrder`:** draw.io persists two small objects
  (`collapsedLibraries` + `libraryOrder`). `libraryOrder` exists solely to remember user drag-reorder of
  section titles. Category *reordering* is NOT in this pass's scope (synthesis §3); the order is the
  fixed canonical order in §2. YAGNI — add `libraryOrder` only if/when reordering ships. A second key
  (`diagram-studio:categories`), not a new field under `diagram-studio:panels`, keeps the two concerns
  independent (see §4.3).
- **Interaction with the EXISTING `diagram-studio:panels` key:** orthogonal. `diagram-studio:panels`
  answers "is the left/right *panel* docked or hidden" (panel-level, `PanelState`); the new key answers
  "which *category sections inside the left panel* are folded". Collapsing a category must not collapse
  the panel, and collapsing the panel must not reset category state. Implement as a sibling module to
  `src/panelCollapse.ts` with the same conventions: one namespaced key, tolerant parse (never throw on a
  hand-edited value), every access in `try/catch`, `collapsed` map keyed by `PaletteCategory`, defaults
  to "only the filter's default-expanded category is open" when absent. The default-expanded category
  per view: `architecture→architecture`, `flowchart→flowchart`, `c4→c4`, `erd→entities`, `custom→basic`
  (Mixed), and **`all→basic`** (All has no namesake, so the first canonical section is used).
  **Multiple categories may be open at once — this is NOT an exclusive accordion** (verified live:
  Basic and Data & storage both open, and the state survives a reload).

### 4.3 Phone / tablet tiers

At the tablet-portrait (drawer) and phone (bottom-sheet) tiers the left panel is already rendered inside
the existing overlay (`src/App.tsx` §M3/S4+S5). **The panel body is unchanged** — the same
search → favourites → filter → collapsible-categories tree renders inside the sheet/drawer. Categories do nothing
special there: they are the same collapsible sections, and the persisted `collapsed` map is **global**
(not tier-scoped) — a category folded on desktop stays folded in the sheet. No tier-specific category
state is added; the drawer/sheet just wraps the same body.

---

## 5. Left-panel render (Revision 3: NO chips, NO badges, + panel search)

Replace the flat `preset.palette.map(...)` block (currently lines ~2093–2118) with:

1. **Search input** — pinned at the top of the panel body. Matches `label` + `hint` + `aliases` +
   `geometry` over the WHOLE library; while it holds text, the category accordion is replaced by a flat
   result list grouped by category, and a hit whose category is COLLAPSED renders **dimmed** (spec §9).
   Clearing the field restores the normal category view.
2. **Favourites section** (§6) — rendered above the categories, flat grid, only when non-empty (plus the
   pending `+` affordance when a selection exists, §6.4).
3. **NO type filter chips (Revision 3).**
4. **Category sections** — for each `PaletteCategory` in canonical order, render a collapsible header +
   grid of the items **that survive the current type filter** (§2.6 — a category with zero surviving
   items is omitted entirely). The filter's default-expanded category renders open; the rest read their
   `collapsed[cat]` state.
5. **NO per-row `types` badges (Revision 3).** Each row is glyph + label + hint only, exactly like the
   pre-N panel. `types[]` is not rendered; it remains the data model's membership field. The Revision 1
   "duplication" fix is achieved structurally instead: every element has ONE entry in `LIBRARY`, so
   `Note` is a single row in `Annotations` (not four rows across four per-type palettes).

Each item keeps its existing drag (`dataTransfer.setData('palette', idx)`) + double-click-to-add
behaviour, plus gains the star/pin control (§6.3). The `.hint` block (currently ~2119–2125) stays as the
panel footer.

---

## 6. Favourites = a REFERENCE list (not a snapshot)

This is where Harvey's ask diverges from draw.io, and the divergence must be documented in code:
draw.io's scratchpad stores *styled cell snapshots that only exist after placement on canvas*. A
Diagram Studio favourite stores the **palette identity** instead.

### 6.1 Stored item shape (exact)

```ts
export type Favourite = {
  id: string;                 // generated, e.g. `fav_<nanoid>` — NOT a board/node id
  name?: string;              // optional on add (synthesis §4.2: naming optional, required only on export)
  created: number;            // epoch ms
  nodes: FavouriteNode[];     // plain node payloads (data from `make()`, NOT a live Node with position)
  edges: FavouriteEdge[];     // empty for a single palette item; populated by "add from selection"
};
```

A `FavouriteNode` is the **output of `make()`** (i.e. node `data` with `colorKey`, never hex) plus the
recoverable palette identity `{shape, colorKey, kind, size}`. `make()` itself is a function and is NOT
serialisable — the favourite stores its **result**, and re-insertion (§6.5) re-derives ids/geometry
from that result. Because the stored node carries `colorKey` (symbolic), a theme change recolours a
favourite exactly as it recolours a board — the requirement, satisfied structurally.

### 6.2 Why palette identity, not a styled snapshot

- A snapshot bakes the theme's current hex → cannot recolour under a theme switch. The app's invariant
  is "boards store colour KEYS, never hex"; favourites extend it: **favourites store colour keys too**.
- A snapshot is canvas-first (draw.io's limitation): you must place a shape before you can favourite it.
  Storing identity lets a favourite be starred **from the palette itself** (§6.3), no round-trip.
- No new node type/renderer: the favourite renders through the existing `ShapePreview` / node component
  using the existing `--c-*` token rules (cluster 2's #1 lesson).

### 6.3 The star/pin affordance (the part draw.io lacks)

A star/pin control on each palette item. Toggling it adds/removes a favourite whose `nodes[0]` is that
item's `make()` output. "Add from palette" flow = one click, no canvas round-trip.

### 6.4 The pending `+` affordance (Excalidraw's pattern)

A pulsing `+` tile at the top of the Favourites section, shown **only while a canvas selection exists**.
Clicking it = "add from selection": deep-copy the selected `nodes` + `edges` (preserving `colorKey`,
dropping `position`/`selected`/`measured`), assign a fresh `id`, prepend to the list. Zero menus, one
button.

### 6.5 Insert re-derives geometry (never trust stored coordinates)

Inserting a favourite (click or drag onto canvas) must, in order:
1. re-centre on the drop point / cursor;
2. snap to the grid (`gridSize`);
3. **re-generate ids** (never reuse stored ids — they may collide with the board);
4. select the inserted nodes.

This satisfies "không phá layout" *structurally* (synthesis §2.9, cluster 2 §5 #4) rather than by
validation rules. Reuse the existing `addNode` insertion path where possible; a favourite insert adds a
multi-node variant.

---

## 7. `/api/library` — persistence (one JSON file via the dev-server route)

Mirror the existing `/api/boards` middleware in `vite.config.ts`. The library is a **singleton**
document (no id segment).

### 7.1 Route + document envelope

```
GET  /api/library   → 200 {type,version,source,updatedAt,favourites,shapes} | 200 empty if none
PUT  /api/library   → validate → atomic write + .bak → 200
```

```json
{
  "type": "diagram-studio-library",
  "version": 1,
  "source": "diagram-studio",
  "updatedAt": 1789000000000,
  "favourites": [ /* Favourite[] from §6.1 */ ],
  "shapes": [ /* CustomShape[] from §8.1 */ ]
}
```

> **Decision — one file holds both.** The synthesis discusses favourites persistence (§2.5) and custom
> shapes (§2.6) separately but never names two files, and cluster 4 §6.1 says "ONE plain JSON file".
> One `library.json` with one `version` and one atomic write serves both `favourites` and `shapes`. This
> is the single shared, mutable, portable document — exactly what survives "clear browsing data" and can
> be exported/imported.

### 7.2 Four requirements on the store (numbered)

1. **Atomic write.** Temp file + `fs.renameSync`, serialised per file. `rename(2)` atomically replaces
   the target; no reader ever observes a missing/truncated file (cluster 4 §6.1, cited).
2. **One `.bak` generation.** Before replacing `library.json`, rename the existing file to
   `library.json.bak`. A bad client write (endpoint is unauthenticated, no merge) must not destroy the
   whole library in one request.
3. **Explicit `version` + migration on read.** Follow this project's own PACKAGE-M pattern: *read* the
   legacy key/shape, *never write it back*; upgrade in memory; write only the current version. Follow
   Excalidraw's default-on-missing-fields convention (never trust absent fields).
4. **Surface write failures.** Never fail silently — a library has no server copy. On PUT failure return
   the error and, on the client, show Excalidraw's intent: *"Couldn't save the library. Export it to a
   file so you don't lose changes."*

### 7.3 Existing `writeFileSync` truncate-first bug in the boards writer (own item)

`vite.config.ts:170` does `fs.writeFileSync(file, JSON.stringify(out, null, 2))` — truncate-first. A
crash/disk-full mid-write leaves a truncated `boards/<id>.json`, and a concurrent GET can read a
half-written file. **Fix in the same pass:** apply the same temp + `renameSync` sequence to the boards
`PUT` path (and `POST` create). This is an existing data-loss bug independent of the palette work; the
synthesis (§2.5) explicitly flags it "worth fixing in the same pass". No behaviour change — same
validation, same document, atomic write only.

---

## 8. Custom-shape import

### 8.1 Versioned envelope + entry

Follow Excalidraw's envelope (plain JSON `type`+`version`+`source`, §7.1) with draw.io's image-entry
payload. Entry fields:

```ts
export type CustomShape = {
  title: string;          // palette label + tooltip (draw.io `title`)
  tags: string;           // space-separated, sidebar search (draw.io `tags`)
  data: string;           // the sanitised SVG MARKUP, inline (NOT base64, NOT a data URI)
  w: number;              // REQUIRED — quantised + clamped already (layout safety)
  h: number;              // REQUIRED
  aspect: 'fixed';        // always fixed — prevents distortion
  colorKey: ColorKey;     // app invariant: never hex
  viewBox: string;        // first-class, kept out of markup so layout checks read it without parsing
  sanitizer: string;      // provenance, e.g. "dompurify/svg-profile"
  sanitizedAt: number;
  created: number;
};
```

`data` holds the **inline sanitised SVG** (cluster 4 §6.2: base64 adds 4/3 and makes the file unreadable
and undiffable; raw markup works directly as `data:image/svg+xml,`+`encodeURIComponent(svg)`).

### 8.2 Sanitisation rule list (exact — all of cluster 4 §1.4)

1. Parse as **XML** (`application/xml`/`image/svg+xml`), reject non-parsing input.
2. Require a **single root `<svg>`** with a numeric, positive `viewBox`; reject otherwise.
3. Sanitise with **`DOMPurify.sanitize(svg, { USE_PROFILES: { svg: true }, RETURN_DOM_FRAGMENT: true })`**,
   then serialise the fragment yourself.
4. **Strip explicitly**: `<style>` elements and every `style="…"` attr (`FORBID_TAGS:['style']`,
   `FORBID_ATTR:['style']`); `<foreignObject>`; `<use>`; any `href`/`xlink:href` that is not a
   same-document `#id` fragment; any `href`/`src` on `<image>/<a>/<filter>/<pattern>` whose scheme is
   not `data:` and not `image/*`; `<animate>`/`<animatetransform>`/`<animatemotion>`/`<set>`;
   `<script>` and every `on*` attr (regression guard); processing instructions and DOCTYPE/internal
   entity declarations (XXE / billion-laughs).
5. **Rewrite the root**: drop `width`/`height`/`x`/`y` from `<svg>`, keep `viewBox`, add
   `preserveAspectRatio="xMidYMid meet"`.
6. **Render as an image**, never `innerHTML`/`dangerouslySetInnerHTML`: `<img
   src="data:image/svg+xml,<encodeURIComponent(svg)>">` (or CSS `background-image`) — the MDN-documented
   context where JS is disabled and external resources cannot load.
7. **Cap input size before parsing** (linear-time check; the boards `MAX_BODY` 5 MiB is the backstop).
8. **Treat the stored shape as untrusted on read** — re-sanitise/validate on read, matching OWASP's
   client-storage rule.

**Sanitise on import AND re-apply on read** (a hand-edited or imported library file is untrusted). Never
post-process the sanitised string, and never widen the allow-list.

### 8.3 Layout clamps — four constants, four failures

```ts
const SHAPE_MIN_PX   = 32;   // smallest legible box; ≈2 grid units at pitch 16
const SHAPE_MAX_PX   = 512;  // ≈4× the largest default container (group 320×200)
const SHAPE_MIN_UNITS = 2;   // grid units, so it stays ≥32 at pitch 8
const SHAPE_MAX_UNITS = 32;  // grid units, so it stays ≤512 at pitch 64
// grid pitch = 16 (default); offered set [8,16,20,32,64] (GRID_SIZES in Settings.tsx)
```

| # | Failure prevented | Clamp |
|---|---|---|
| 1 | zero / invisible size (no click target, no handles, `fitView` ignores) | **min 32 px**; reject missing/0/negative/non-finite declared size |
| 2 | enormous size (wrecks `fitView`/MiniMap, freezes render) | **max 512 px** (Excalidraw's `MAX_LINEAR_PX` precedent), enforced at import AND at `<NodeResizer maxWidth={512} maxHeight={512}>` |
| 3 | off-grid / fractional size (snap drift, broken alignment) | quantise to pitch: `w = clamp(round(w/gridSize), SHAPE_MIN_UNITS, SHAPE_MAX_UNITS) * gridSize` |
| 4 | distortion / unbounded aspect | `aspect:'fixed'` from the viewBox ratio; default box `w=64, h=round(64*vbH/vbW)` quantised to pitch |

Quantise at **both** the store and the resizer so the two cannot drift (synthesis §2.8). The four
clamps are the named constants above with the synthesis's exact values (32–512 px, pitch 16, offered
`[8,16,20,32,64]`).

#### ⚠️ AMENDMENT 2026-09-17 (pass 4a) — §8.3's literal unit formula contradicted its own table

§8.3 row 3 states the quantiser as `w = clamp(round(w/grid), SHAPE_MIN_UNITS, SHAPE_MAX_UNITS) * grid`.
Taken literally, that formula satisfies the 32–512 px bounds in rows 1–2 **only at the default pitch 16** —
it was written as if the pitch were always 16. Measured (orchestrator-verified, both formulas evaluated at
every offered pitch):

| pitch | literal formula floor → ceiling | honours 32–512? | implemented floor → ceiling |
|---|---|---|---|
| 8  | 16 → 256   | ❌ floor **16 px** is below the 32 px minimum | 32 → 256 ✅ |
| 16 | 32 → 512   | ✅ (the default, and the only pitch the spec text is correct for) | 32 → 512 ✅ |
| 20 | 40 → 640   | ❌ ceiling **640 px** is above the 512 px maximum | 40 → 500 ✅ |
| 32 | 64 → 1024  | ❌ ceiling **1024 px** | 64 → 512 ✅ |
| 64 | 128 → 2048 | ❌ ceiling **2048 px** | 128 → 512 ✅ |

**Resolution (adopted):** the unit window is the **intersection** of `[SHAPE_MIN_UNITS, SHAPE_MAX_UNITS]`
grid units with each pitch's own equivalent of `[SHAPE_MIN_PX, SHAPE_MAX_PX]` px. This reduces to the
literal §8.3 formula exactly at pitch 16, and additionally holds the px floor and ceiling at every offered
pitch. Rows 1–2 of the table are the requirement; row 3's formula is a special case of the default pitch
and is NOT the general rule. `SHAPE_MIN_UNITS`/`SHAPE_MAX_UNITS` remain the named constants — they are the
window at pitch 16.

---

## 9. Search

Reuse the existing `SearchPalette` (`src/SearchPalette.tsx`, `.sp-overlay`) — do NOT build a second
search UI (synthesis §2.10, cluster 2 §5). Extend its filter from
`label || hint || shape` to also match `aliases[]` and `geometry`.

- **Alias index** seeded from Mermaid's curated list (`subproc`/`subroutine`/`fr-rect`,
  `diam`/`decision`/`diamond`/`question`, `cyl`/`cylinder`/`database`/`db`, `pill`/`terminal`, …) plus
  the retired labels from §3. Copying Mermaid's list is free correctness.
- **Geometry word** in its own searchable field (`geometry`) — users search "hexagon"/"cylinder"/
  "diamond" as often as semantic names.
- **Search across collapsed groups and render hits dimmed.** Keep groups rendered-and-hidden (cmdk's
  behaviour) rather than flattening; a category the user collapsed still contributes hits, rendered at
  reduced opacity (draw.io's `searchClosedLibraries` + `closedLibraryOpacity` — cluster 1's "single best
  palette idea").
- **Search runs over the WHOLE library**, independent of the active type filter (the v2 mockup's
  behaviour) — a hit for a shape outside the current type still appears, badged with its own types.

### 9.1 The ranked-search ladder is DEFERRED

The 6-tier match ladder + VS Code weights + `length→begin→palette-index` tiebreak (cluster 3 §4.2) is
**out of scope for this pass**. Ship plain alias matching first (the current `.includes()` extended to
the new fields), ranking second. State plainly in code: no scorer, no Soundex, no negative terms.

---

## 10. Scope boundary (carried from synthesis §3, updated for v2)

**In this pass:**
- `PaletteItem.category` + `PaletteItem.types[]` metadata, the 8 categories, the ONE `LIBRARY` (§1, §2).
- The diagram-type **filter** + the `types` badges (§5).
- The Mixed (`custom`) set selector (§2.7).
- Collapsible sections with persisted collapse state (§4).
- The 4 element renames + 1 hint enrichment + the 2 preset-label renames (§3).
- The alias/geometry search fields (§9).
- The Favourites section as a reference list with the pending `+` (§6).
- `/api/library` with atomic write + `.bak` + version (§7).
- Custom-shape import with sanitise + clamps (§8).
- The boards-writer atomic-write fix (§7.3).

**Deferred (must NOT creep into this pass):**
- The full ranked-search ladder (plain alias matching ships first).
- C4 custom icons.
- Any taxonomy refinement (beyond the settled `groups` id).
- Category reordering (`libraryOrder`).
- Export/import-as-file UI for the user library (persistence only; file-portability is enabled by the format,
  not surfaced as a button yet).

---

## 11. Files to be touched

**Modified:**
- `src/palette.ts` — `PaletteCategory`, `DiagramType`, `PaletteItem` gains `category`/`types`/`aliases`/`geometry`; `PALETTE` literals + renames; export the single `LIBRARY` (§2).
- `src/presets.ts` — add the fields to every literal (`fc`, `FLOWCHART_PALETTE`, `TABLE_PALETTE_ITEM`, C4 `.map()`, the `Note`s, `CUSTOM_PRESET`); derive per-preset palettes via the `libraryFor(id)` selector (§2.6–§2.7); the two preset-label renames (§3.2).
- `src/shapes.tsx` — `SHAPES[].label` renames to match §3.1 (Terminal / Predefined process / Manual operation / On-page connector).
- `src/App.tsx` — left-panel render (§5: filter + badges), favourites UI (§6), category collapse wiring, `.hint` footer.
- `src/SearchPalette.tsx` — extend filter to `aliases` + `geometry`; dim collapsed-group hits; search over the whole library.
- `src/boards.ts` — add `getLibrary` / `saveLibrary` client functions (or move to a new `src/library.ts`).
- `vite.config.ts` — `/api/library` middleware (§7.1–7.2); atomic-write fix for boards (§7.3).
- `src/styles.css` — category headers, filter pills, `types` badges, favourites grid, star/pin, pulsing `+`, dimmed search hits (tokens only, no literal hex/rgba).
- `package.json` — **add `dompurify`** (see §12).

**New:**
- `src/categoryState.ts` — collapse-state persistence, sibling of `panelCollapse.ts` (§4.2).
- `src/favourites.ts` — `Favourite` type + add/remove/insert-from-selection helpers (§6).
- `src/customShape.ts` — `CustomShape` type, sanitise pipeline, the four clamp constants (§8).
- `src/library.ts` — the user-library document client + version migration (if not folded into `boards.ts`). *(Distinct from the shape `LIBRARY` in `palette.ts` — see the §0 naming note.)*

---

## 12. Open questions / conflicts

**RESOLVED by Harvey (2026-09-16):**
1. **`dompurify` is a new runtime dependency** → **APPROVED.** Add it. Harvey confirmed. Rationale on
   record: cluster 4 explicitly warns against a hand-rolled allow-list (easy to under-strip), and the
   library is the documented, maintained implementation of exactly this rule set.
2. **The "fifth" rename** → resolved as **4 label changes + 1 hint enrichment** (Preparation keeps its
   label, gains "Initialization" in the hint). Harvey approved this reading. §3.1 row 5 stands.
3. **"Basic" is thin** → **KEEP `Basic` with its 3 items** (`Process`, `Decision`, `Text`). Orchestrator
   decision, delegated by Harvey ("tuỳ bạn"): a newcomer looks for "a rectangle" or "a diamond" before
   they know any notation, and those two are Mermaid's canonical generic primitives (`rect`/`diam`).
   Dropping Basic would bury the two most-used shapes inside Flowchart and make them harder to find. 8
   categories stand.
4. **Custom-shape node rendering** → **APPROVED as framed**: a new node `kind` carrying
   `{svg, viewBox, w, h, aspect, colorKey}`, rendered via `<img>`; the `Shape` union stays at **19** — no
   20th id. Harvey approved ("ok thử").
5. **`process`/`decision` home = `Basic`** (the architect's sign-off request) → **APPROVED.** They are the
   universal primitives; the other 8 ISO 5807 symbols stay in `Flowchart`. §2.1 and §2.3 stand unchanged.

**CONFLICTS found while revising to v2 (report, do not silently resolve):**

6. **The v2 mockup's explanatory text block is STALE — FIXED** (orchestrator). The stale HTML table
   (`C4 = 20`, `C4 ⊇ architecture's shapes`) has been corrected in `mockup-palette-v2.html` to match
   the settled model (C4 = 12). Original text follows for the record: The mockup's HTML
   "spec" panel (`mockup-palette-v2.html`, the table around "v2 model") still describes the *rejected*
   superset idea: it lists C4 = 20 ("11 C4-specific + the 9 shared architecture shapes"), Flowchart =
   13, Database/ERD = 3, and asserts "C4 ⊇ architecture's shapes". That contradicts (a) the mockup's OWN
   JavaScript `ELEMENTS` array (which tags C4 items `types:['c4']` only, giving C4 = 12) and (b) this
   brief's settled 33-element table + counts (C4 = 12, "C4 keeps its OWN elements", no flattening).
   **This spec follows the brief + the mockup's JS** (C4 = 12 = 11 C4 + shared Note). The stale HTML
   block should be corrected if the mockup is ever re-shown.

7. **The ERD enum-note — RESOLVED: kept DISTINCT** (orchestrator decision). The ERD preset's "Note" is
   genuinely different (`kicker:'enum'`, `title:'status'`, `sub:'pending · paid · shipped'`, amber) and
   collapsing it would silently change what the ERD palette produces. It becomes its own element
   **`Note (enum)`**, `types:['erd']`, `category:'annotations'` — so the generic `Note` is now
   `types:[architecture, flowchart, c4]` and the counts are **All 34 · Data model 3**. The original
   (unresolved) text follows for the record: In `presets.ts`, the ERD preset's "Note" is
   NOT the same as the other three: it is `{label:'Note', hint:'enum / annotation', shape:'note',
   colorKey:'amber', make:()=>({kicker:'enum', title:'status', sub:'pending · paid · shipped',
   colorKey:'amber'})}` — an **enum annotation**, distinct from the generic slate note. The brief's
   single-`Note` table (and the "Note appeared 4×" duplication claim) treats all four as one element,
   which would **lose the amber enum-note behaviour** from the ERD palette (the enum annotation survives
   only inside `erdTemplate`'s hard-coded `note_enum` node, not as a palette item). This spec implements
   the single generic `Note` as briefed, but **Harvey should confirm**: (a) collapse the ERD enum-note
   into the generic Note (accept the behaviour change), or (b) keep the enum annotation as a distinct
   element with its own label (e.g. `Note (enum)`, `types:['erd']`, `category:'annotations'`). If (b),
   the "Note = 1 entry" AC and the ERD filter count (2 → 3) change.

8. **`groups-boundaries` → `groups` — CONFIRMED.** The spec adopts `groups`, matching the brief and
   the mockup. `category` is a brand-new field so there is no persistence risk; recorded so the coder
   does not carry the Revision 1 id. Original text follows for the record: Revision 1 used `groups-boundaries` as the `PaletteCategory` id;
   this brief's verbatim element table and the v2 mockup both use the short `groups`. This spec adopts
   `groups` (§2). Zero persistence risk (`category` is a brand-new field), but it is a rename from v1 and
   is flagged here so the coder does not silently carry the old id.

7b. **The `Note` label had TWO different `make()` bodies** (found by bundling the real module and grouping by
   `label|String(make)` — not visible in any table): `architecture`'s built via
   `node('note','Note','note','annotation',…)` with `sub:'annotation'`, while `flowchart`/`C4` used the bare
   literal with `sub:''`. That made the honest distinct count **35**, not 34, and would have printed `Note`
   TWICE in the panel — the exact duplication Harvey set out to remove.
   **RESOLVED (harvey chose (a), 2026-09-16): collapse to ONE `Note`.** Chosen definition = the `sub:''` form
   (it is the one 2 of the 3 sites already used, so fewer node subtitles change). All three sites
   (`palette.ts` PALETTE, `presets.ts` FLOWCHART_PALETTE, `presets.ts` C4 palette) reference one definition;
   `palette.ts` keeps using the `node()` helper with `sub:''` for consistency with its neighbours.
   Consequence: the architecture palette's `Note` loses its subtitle (`'annotation'`) — accepted.
   Counts stay **All 34 · Architecture 10 · Flowchart 12 · C4 12 · Data model 2 · Mixed 27**.

## 13. Acceptance criteria (numbered, measurable)

**The one library + filter (v2 — new/updated):**

1. The single `LIBRARY` holds **34** elements, each with a non-empty `types: DiagramType[]` and a
   `category: PaletteCategory`; no element appears twice (the `All` view shows exactly 34 rows, the
   generic `Note` = **1** entry and `Note (enum)` is a separate `erd` element. *(Revision 3: asserted on
   the DATA via a bundled probe, since nothing renders it any more.)*
2. *(Revision 3: no chip UI — assert on the DATA.)* The derived set sizes are exactly **All 34 · Architecture 10 · Flowchart 12 · C4 12 · Data model 2 ·
   Mixed 27**; C4's 12 = its own 11 + the shared `Note`; Data model's 2 = `Table` + `Note (enum)`
   (the ERD palette has no generic note, verified in `presets.ts`); Mixed's 27 matches §2.7.
3. *(Revision 3 — REPLACED.)* **No row renders a type badge and no chip row exists**: the DOM has
   **0** `.tb` elements and **0** `.lib-chip` elements in any state. Each row is glyph + label + hint,
   exactly like the pre-N panel. `types[]` is asserted on the DATA (tests #1/#2), never on the DOM.
4. `custom` (Mixed) is its own set selector, not a `types[]` filter — switching to `Mixed` shows exactly
   the 27 §2.7 elements regardless of `types[]`.
5. `npx tsc --noEmit` = 0 with `category` AND `types` both **required** on `PaletteItem`.

**Preset labels + element renames (v2 §3):**

6. `getPreset('erd').label === 'Data model'` and `getPreset('custom').label === 'Mixed'`, while the
   ids `erd`/`custom` and every persisted `BoardDoc.preset` value are unchanged (a board with
   `preset:'erd'` still opens, now titled "Data model").
7. The 4 element renames render as their new labels (Terminal, Predefined process, Manual operation,
   On-page connector), and the old word is present in each `hint` (Start / End, Subprocess, Manual step,
   Connector); Preparation gains "Initialization" in its hint with its label unchanged.

**Categories + collapse (carried from v1):**

8. *(Revision 3: no filter.)* All **8** category sections are present in canonical order (each with its
   full count) — none is ever absent, because nothing filters the library any more.
9. *(Revision 3: no filter.)* Exactly **one** category is expanded on a fresh profile: `Basic`… — no;
   the default-open category follows the BOARD's preset: architecture→Architecture, flowchart→Flowchart,
   c4→C4, erd→Entities, custom→Basic. All others start collapsed, and **multiple categories may be open
   at once** (not an exclusive accordion).
10. Collapse state survives a reload: toggle `flowchart` collapsed, reload, value
    `diagram-studio:categories` = `{"collapsed":{"flowchart":true}}`, and the section renders collapsed.
11. A hand-corrupted `diagram-studio:categories` value (e.g. `"{oops"`) parses to the default without
    throwing.
12. The panel-collapse flag and the category-collapse flag are independent: collapsing a category does
    not change `diagram-studio:panels`, and collapsing the panel does not reset `diagram-studio:categories`.

**Search (carried from v1, extended to whole-library):**

13. Typing "subproc" or "subroutine" finds "Predefined process"; typing "cylinder" finds "Database";
    typing "diamond" finds "Decision" (alias + geometry fields both hit).
14. Searching for a shape that lives in a **collapsed** category returns it, rendered at reduced opacity
    (dimmed, not hidden, not removed); search matches the whole library regardless of the active type
    filter.

**Favourites (carried from v1):**

15. Starring a palette item adds a favourite whose stored node carries a `colorKey` and **zero hex**;
    changing theme recolours the favourite's swatch to the new theme's token value.
16. A favourite added from a 2-node selection stores `nodes.length == 2` with no
    `position`/`measured`/`selected` fields and fresh ids distinct from the source board's.
17. Inserting a favourite re-derives geometry: the inserted node ids differ from the stored ids, and
    positions snap to the grid at the drop point.

**Persistence + custom shapes (carried from v1):**

18. `GET /api/library` returns the versioned envelope (`type`=="diagram-studio-library", `version`==1) or
    an empty 200 when absent; `PUT` then `GET` round-trips `favourites` and `shapes` byte-for-byte.
19. `PUT /api/library` produces a `library.json.bak` on the second write, and the first write leaves no
    temp file behind.
20. The boards `PUT` writes atomically: after the fix, no `.tmp`/partial `boards/<id>.json` is
    observable, and a concurrent `GET` during a `PUT` returns the full old or full new document (never
    truncated).
21. *(AMENDED 2026-09-17, pass 4a — see §8.3 amendment.)* An imported SVG with
    `width="4096" height="4096"` **stores the DEFAULT box, not the declared size**: `w`/`h` = the
    64 px long edge scaled by the viewBox ratio, quantised to the 16 px grid — i.e. **64×64** for a
    square viewBox. The 512 px ceiling is enforced on the CLAMP paths, verified separately: an entry
    read from disk carrying `w`/`h` of 4096 comes back as **512** through `parseCustomShapeEntry`, and
    the resizer carries `maxWidth`/`maxHeight` of 512.
    *Original text, for the record:* "An imported SVG with `width="4096" height="4096"` is clamped to a
    stored `w`/`h` of **512 px** (max), quantised to the 16px grid." — that contradicted §8.3 row 4
    ("**default box** `w=64, h=round(64*vbH/vbW)`"), which is where the stored import size comes from.
    The declared size is a VALIDITY gate (§8.3 rows 1–2), never the stored geometry. Measured: a
    square-viewBox 4096×4096 import stores **64×64**, and `clampShapeSize(4096,4096,16)` = 512×512.
22. An imported SVG declaring `width="0"` (or omitting `w`/`h`) is **rejected**, not stored.
23. An imported SVG containing `<script>`, an `onload=` handler, a `<foreignObject>`, an external
    `<image href="http://…">`, or a `<style>` block is stored with all of those removed; a remote `href`
    is gone and only same-document `#id` fragments survive.
24. A custom shape is rendered via an `<img src="data:image/svg+xml,…">` (or CSS `background-image`) — the
    sanitised SVG never reaches `innerHTML`/`dangerouslySetInnerHTML`.

**Build + invariants (carried from v1):**

25. `npx tsc --noEmit` = 0 and `npx vite build` = 0 after the pass.
26. **Demo-board invariant** — `boards/mu01q1ue3a854b81.json` is unchanged: 3 nodes / 2 edges, positions
    `-53,298` · `324,290` · `704,290`, `preset:"architecture"`, no `theme` key, both edges
    `strokeKey:"slate"` (no hex).
27. No literal hex/rgba is introduced; all new colours are CSS tokens (`var(--c-*)`).
28. The tool stays generic: no personal/company content anywhere in the new code or the default library.

---

## 14. Decisions I made that the synthesis left undefined (for orchestrator review)

1. **One file holds favourites + custom shapes** (synthesis §2.5 vs §2.6 never names two files; cluster 4 §6.1 says "ONE plain JSON file"). → single `library.json`, single `version`, single atomic write.
2. **Persistence key** `diagram-studio:categories` with `{collapsed:{[cat]:bool}}` only; **`libraryOrder` omitted** (no reordering in scope, YAGNI).
3. **Category home for `process`/`decision` = Basic**, the other 8 ISO shapes = Flowchart (cluster 3 §2 dual-lists them; one home required).
4. **The "fifth" rename = Preparation hint-enrichment** ("Initialization"), not a new label.
5. **Custom-shape rendering = a new node kind carrying the svg, NOT a 20th `Shape` id** (keeps the union at 19).
6. **Category collapse is global across tiers** (not tier-scoped); the sheet/drawer wraps the same body.
7. **`source: "diagram-studio"`** as the envelope's source value (Excalidraw's `source` convention, overridable on re-import).
8. **v2 — the diagram type is a filter over one `LIBRARY`**; per-preset `palette` arrays are replaced by the `libraryFor(id)` selector; `custom` (Mixed) is its own set (§2.7).
9. **v2 — `types[]` uses only the four real diagram types** (`architecture`/`flowchart`/`c4`/`erd`); `custom` is excluded from the union and handled by the Mixed selector.
10. **v2 — the category id `groups`** replaces v1's `groups-boundaries` (to match the brief's verbatim table and the mockup; flagged in §12 conflict 8).
