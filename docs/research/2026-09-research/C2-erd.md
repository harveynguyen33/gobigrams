# C2 — Database / ER diagram cluster

**Cluster:** database / ERD / data-model / schema visualisers in the React Flow showcase.
**Target:** Diagram Studio — `/home/harvey/projects/tech-goblin/lab/diagram-studio`
(React 19 + Vite 5 + `@xyflow/react` v12, 9 architecture shapes, one generic `GoblinEdge`, dark tokens only).
**Tools studied (live app + raw GitHub source, no big clones):**
[ChartDB](https://chartdb.io/) · [Liam ERD](https://liambx.com/) · [DBDraw](https://dbdraw.vercel.app/) ·
[Prismaliser](https://prismaliser.app/) · [TSdiagram](http://tsdiagram.com/) ·
[drawDB](https://drawdb.app/) · [Hubql](https://www.hubql.com/) · [Datadef](https://datadef.io/) ·
[Datascale](https://getdatascale.com/) · [OpenMetadata](https://github.com/open-metadata/OpenMetadata).

> **Clone budget note (policy (b) check):** total cloned/downloaded material = **7.5 MB** across
> `/tmp/drawdb` (5.5 MB, sparse clone of `drawdb-io/drawdb`), `/tmp/tsdiagram` (1.2 MB, sparse clone of
> `3rd/tsdiagram`), `/tmp/dbdraw` (828 KB, small repo `mrudulkolambe/dbdraw`) and ~1.2 MB of GitHub
> tree JSON. `df -h /` before: **96 G, 29 G used, 68 G avail (31%)**; after: **67 G avail (31%)**. Far
> below GB scale; all four clones were deleted when the report was finished (see end of file).
> Everything else was read from `raw.githubusercontent.com` and docs sites.

---

## 1. What a database / ER diagram needs that Diagram Studio lacks today

### 1.1 The TABLE node (the single biggest gap)

Diagram Studio's `DiagramNode.tsx` renders one fixed frame: `kicker / title / sub / metric / icon`
inside a `<ShapeFrame>` (`src/DiagramNode.tsx:159-184`). That is a *card*, not a *table*. Every ERD tool
in the cluster instead renders a **variable-height node with a header row and one row per column**:

| Tool | Node structure | Source |
| --- | --- | --- |
| Liam ERD | `TableNode` = `TableHeader` + `TableColumnList`; each `TableColumn` is a `<li>` with icon + name + type, and the type is right-aligned in mono font | [`TableNode.tsx`](https://github.com/liam-hq/liam/blob/main/frontend/packages/erd-core/src/features/erd/components/ERDContent/components/TableNode/TableNode.tsx), [`TableColumn.tsx`](https://github.com/liam-hq/liam/blob/main/frontend/packages/erd-core/src/features/erd/components/ERDContent/components/TableNode/TableColumnList/TableColumn/TableColumn.tsx), [`TableColumn.module.css`](https://github.com/liam-hq/liam/blob/main/frontend/packages/erd-core/src/features/erd/components/ERDContent/components/TableNode/TableColumnList/TableColumn/TableColumn.module.css) |
| ChartDB | `TableNode` = colour strip + 36 px header (`Table2`/`View` glyph + name) + field rows; `TableNodeField` = 32 px row with handles, FK-highlight, key icon, type | [`table-node.tsx`](https://github.com/chartdb/chartdb/blob/main/src/pages/editor-page/canvas/table-node/table-node.tsx), [`table-node-field.tsx`](https://github.com/chartdb/chartdb/blob/main/src/pages/editor-page/canvas/table-node/table-node-field.tsx) |
| drawDB | `Table.jsx` uses `<foreignObject>` (its canvas is raw SVG, not React Flow) — 40 px header + 36 px field rows; collapse button hides *unlinked* columns only | [`Table.jsx`](https://github.com/drawdb-io/drawdb/blob/main/src/components/EditorCanvas/Table.jsx), [`utils.js getVisibleFieldEntries`](https://github.com/drawdb-io/drawdb/blob/main/src/utils/utils.js) |
| Prismaliser | an actual HTML `<table>`: `thead` = model name (+ `dbName`), `tbody` rows = column name / display type / default | [`ModelNode.tsx`](https://github.com/Ovyerus/prismaliser/blob/main/src/components/ModelNode.tsx) |

**Per-column badges** — the four attributes every tool shows, and how:

- **PK**: Liam uses a `KeyRound` icon ([`TableColumn.tsx`](https://github.com/liam-hq/liam/blob/main/frontend/packages/erd-core/src/features/erd/components/ERDContent/components/TableNode/TableColumnList/TableColumn/TableColumn.tsx)); ChartDB uses a 14 px `KeyRound` on the right of the row ([`table-node-field.tsx`](https://github.com/chartdb/chartdb/blob/main/src/pages/editor-page/canvas/table-node/table-node-field.tsx)); drawDB uses `IconKeyStroked` ([`Table.jsx`](https://github.com/drawdb-io/drawdb/blob/main/src/components/EditorCanvas/Table.jsx)).
- **FK**: ChartDB has no icon — it colours the *column name* `text-blue-600` when `isForeignKey` and the field is not a diff ([`table-node-field.tsx`](https://github.com/chartdb/chartdb/blob/main/src/pages/editor-page/canvas/table-node/table-node-field.tsx)). Liam uses a `Link` icon.
- **NOT NULL**: Liam uses a *filled vs hollow diamond* (`DiamondFillIcon` / `DiamondIcon`) — a quiet, elegant convention ([`TableColumn.tsx`](https://github.com/liam-hq/liam/blob/main/frontend/packages/erd-core/src/features/erd/components/ERDContent/components/TableNode/TableColumnList/TableColumn/TableColumn.tsx)). drawDB prints a literal `?` for nullable ([`Table.jsx`](https://github.com/drawdb-io/drawdb/blob/main/src/components/EditorCanvas/Table.jsx)).
- **Type**: right-aligned, monospace, low-contrast — Liam even fades it to `opacity: 0` until the table is hovered/highlighted (`TableColumn.module.css` `.columnType`). drawDB gates the whole type column behind a `showDataTypes` setting (`SettingsContext.jsx`).

**Collapsibility** is table-aware, not generic:
- ChartDB: `TABLE_MINIMIZED_FIELDS = 10`; the field list has `max-height` animated between
  `10 * 2rem` and `fields.length * 2rem`, and the header has a `ChevronsRightLeft`/`ChevronsLeftRight`
  button that snaps the node width between `MIN_TABLE_SIZE = 224` and `MAX_TABLE_SIZE = 450`
  ([`db-table.ts`](https://github.com/chartdb/chartdb/blob/main/src/lib/domain/db-table.ts), `table-node.tsx`).
- drawDB: `collapsed` hides **only columns not touched by a relationship** — the FK columns stay visible
  so the diagram still reads ([`utils.js::getVisibleFieldEntries`](https://github.com/drawdb-io/drawdb/blob/main/src/utils/utils.js)).

**Table-level attributes the column list implies** — ChartDB's `DBTable`/`DBField` domain model is the
best-scoped reference here: `DBField` = `{name, type, primaryKey, unique, nullable, increment, isArray,
characterMaximumLength, precision, scale, default, collation, comments, check}`
([`db-field.ts`](https://github.com/chartdb/chartdb/blob/main/src/lib/domain/db-field.ts));
`DBTable` = `{name, schema, x, y, fields, indexes, checkConstraints, color, isView, isMaterializedView,
width, comments, order, expanded, parentAreaId}`
([`db-table.ts`](https://github.com/chartdb/chartdb/blob/main/src/lib/domain/db-table.ts)).

### 1.2 FK edges drawn column-to-column

This is *the* thing generic node editors get wrong. Diagram Studio's `GoblinEdge` attaches to the node's
single left/right `Handle` (`src/DiagramNode.tsx:163,181`) — every edge leaves the node's vertical centre.
ERD tools attach a handle **per column row**:

- **Liam**: the `TableColumn` renders a source `Handle` on `Position.Right` and a target `Handle` on
  `Position.Left`, both `opacity: 0` at rest, positioned `right: -17px` / `left: -20px`
  (`TableColumn.module.css` `.handle`, `.handle[data-handlepos='right']`). The handle id is
  `columnHandleId(tableName, columnName)`. In `TABLE_NAME` show-mode the handle moves up to the table
  header instead (`TableHeader.tsx`).
- **ChartDB**: handles are generated *per field per edge count* — `right_rel_<fieldId>`,
  `left_rel_<fieldId>`, and `target_rel_<index>_<fieldId>` repeated `numberOfEdgesToField` times so that
  N incoming FKs to the same column get N distinct target handles (no overlap)
  ([`table-node-field.tsx`](https://github.com/chartdb/chartdb/blob/main/src/pages/editor-page/canvas/table-node/table-node-field.tsx)).
  The `DBRelationship` model stores exactly the endpoints: `{sourceTableId, sourceFieldId,
  sourceCardinality, targetTableId, targetFieldId, targetCardinality, name}`
  ([`db-relationship.ts`](https://github.com/chartdb/chartdb/blob/main/src/lib/domain/db-relationship.ts)).
- **drawDB**: computes the Y of the row itself (`getFieldOffsetY(fields, index, width, showComments) +
  tableHeaderHeight + tableFieldHeight / 2`) and builds an SVG path with a rounded corner — see
  [`calcPath.js`](https://github.com/drawdb-io/drawdb/blob/main/src/utils/calcPath.js). It even has a
  `calcCompositePath` for composite (multi-column) FKs.
- **Prismaliser**: handle ids are `relationEdgeSourceHandleId(model, relationName, column)` /
  `relationEdgeTargetHandleId(...)`, which is what lets a *named* Prisma relation map to a specific column pair ([`prismaToFlow.ts`](https://github.com/Ovyerus/prismaliser/blob/main/src/util/prismaToFlow.ts)).

**Practical note for Diagram Studio:** because our edges are already custom (`GoblinEdge`) and already
carry `data`, column-to-column attachment only needs (a) per-row `<Handle>`s in a new table node and
(b) a `sourceHandle`/`targetHandle` on the edge — no change to `GoblinEdge` itself. ChartDB's
"one invisible target handle per incoming edge" trick is worth copying, otherwise multiple FKs into
`users.id` stack on one point.

### 1.3 Crow's-foot notation (one / many / zero-or-one)

Three different levels of fidelity exist in the cluster, and the top-end one is surprisingly cheap:

| Tool | Marker rendering | Verdict |
| --- | --- | --- |
| **Liam ERD** | *True crow's foot*. Three hand-drawn SVG `<marker>`s: `CardinalityZeroOrOneLeftMarker` (ring + bar), `CardinalityZeroOrOneRightMarker`, `CardinalityZeroOrManyLeftMarker` (crow's foot + ring). Each has a `isHighlighted` variant that additionally draws the `1` / `n` glyph. Registered as `markerStart`/`markerEnd` on a plain `getBezierPath` edge | [`CardinalityMarkers.tsx`](https://github.com/liam-hq/liam/blob/main/frontend/packages/erd-core/src/features/erd/components/ERDRenderer/CardinalityMarkers/CardinalityMarkers.tsx), [`markers/`](https://github.com/liam-hq/liam/tree/main/frontend/packages/ui/src/markers), [`RelationshipEdge.tsx`](https://github.com/liam-hq/liam/blob/main/frontend/packages/erd-core/src/features/erd/components/ERDContent/components/RelationshipEdge/RelationshipEdge.tsx) |
| **Prismaliser** | *Minimal crow's foot*: one marker is a single `polyline` bar (`one`), the other a 3-point `polyline` (crow's foot, `many`). Mapped `m-n` / `1-n` / `1-1` → `[markerStart, markerEnd]` | [`RelationEdge.tsx`](https://github.com/Ovyerus/prismaliser/blob/main/src/components/RelationEdge.tsx), [`FlowView.tsx`](https://github.com/Ovyerus/prismaliser/blob/main/src/components/FlowView.tsx) |
| **ChartDB** | *Not crow's foot*: circle markers containing the literal text `1` or `N`, toggled by a "Show Cardinality" view setting; markers come in `selected`/`not selected` × `left`/`right` variants and are coloured pink when selected | [`marker-definitions.tsx`](https://github.com/chartdb/chartdb/blob/main/src/pages/editor-page/canvas/marker-definitions.tsx), [`canvas-utils.ts`](https://github.com/chartdb/chartdb/blob/main/src/pages/editor-page/canvas/canvas-utils.ts) |
| **drawDB** | *Not crow's foot*: a rounded-rect pill with `1` / `n` text placed 28 px along the path from each end | [`Relationship.jsx`](https://github.com/drawdb-io/drawdb/blob/main/src/components/EditorCanvas/Relationship.jsx) |

ChartDB's cardinality *data model* is the useful part regardless of rendering: it stores two
independent `'one' | 'many'` values and derives the 4 relationship types
(`one_to_one | one_to_many | many_to_one | many_to_many`) — and it normalises `many:one` to `one:many`
by swapping the endpoints, so "many" always sits on the target side
([`db-relationship.ts`](https://github.com/chartdb/chartdb/blob/main/src/lib/domain/db-relationship.ts),
`relationship-edge.tsx::handleCardinalityChange`). drawDB additionally has `Constraint` values
(`No action / Restrict / Cascade / Set null / Set default`) — i.e. `ON DELETE` / `ON UPDATE` actions
([`constants.js`](https://github.com/drawdb-io/drawdb/blob/main/src/data/constants.js)).

### 1.4 Relationship labels (1:N etc.)

- drawDB: a `<text>` at the path midpoint, `fontSize: 16`, `group-hover:fill-sky-600`, gated by
  `settings.showRelationshipLabels` — and its `manyLabel` is user-overridable (you can label the "many"
  end `n`, `N`, `*`, …) ([`Relationship.jsx`](https://github.com/drawdb-io/drawdb/blob/main/src/components/EditorCanvas/Relationship.jsx),
  [`SettingsContext.jsx`](https://github.com/drawdb-io/drawdb/blob/main/src/context/SettingsContext.jsx)).
- ChartDB: the relationship's `name` (= the real FK constraint name from the DB) is rendered in the
  edit popover; cardinality is shown as markers, not as a `1:N` label.
- Liam: no textual `1:N` label at all — the crow's feet *are* the notation.
- Prismaliser: the Prisma relation name as `EdgeText` at the path centre.

Diagram Studio already has inline edge-label editing (`src/GoblinEdge.tsx:240-271`), so the label half of
this is done. What is missing is the *default* — a new ERD edge should default to the FK constraint name
(`orders_user_id_fkey`) rather than empty.

### 1.5 Enums, notes, indexes

- **Enums**: Prismaliser renders enums as a *separate node type* (`EnumNode`) attached to the column that
  uses it via a dedicated target handle (`enumEdgeTargetHandleId`) — the first-class-entity approach
  (`FlowView.tsx::nodeTypes`, `ModelNode.tsx`). drawDB keeps enums as per-field `values[]` and raises a
  validation issue when `type === ENUM` and `values` is empty
  ([`issues.js`](https://github.com/drawdb-io/drawdb/blob/main/src/utils/issues.js)). ChartDB models
  types via `DBCustomType` + `DBCustomTypeKind` with a highlighted-custom-type colour in the node
  (`table-node-field.tsx` `isCustomTypeHighlighted` → `bg-yellow-100 dark:bg-yellow-900`).
- **Notes / annotations**: ChartDB has both a `note-node` and an `area-node` (a named, resizable
  *subject area* container) — the area is the ERD equivalent of Diagram Studio's `group` shape but
  semantically meaningful (`area-node.tsx`, `canvas-filter/types.ts` `GroupingMode = 'schema' | 'area'`).
- **Indexes**: ChartDB is the only one in the cluster that models them explicitly:
  `DBIndex = {name, unique, fieldIds[], type?: btree|hash|gin|gist|spgist|brin|clustered|nonclustered|…,
  isPrimaryKey, comments}` ([`db-index.ts`](https://github.com/chartdb/chartdb/blob/main/src/lib/domain/db-index.ts)).
  **Honest take:** showing index badges on the canvas is not worth it for Diagram Studio — indexing is a
  *physical* concern (see §2) and belongs in the inspector, or in the exported DDL, not on the node.

---

## 2. Notations: Chen vs crow's foot (IE) vs UML class — which to build

The cluster (and the field) has converged, and the standard reference is explicit about the vocabulary:

- **Chen** (Peter Chen, 1976): entities = rectangles, relationships = **diamonds**, attributes =
  **ellipses** attached by lines; cardinality written as `1`, `N`, `M` at the line ends. Wikipedia's own
  example is an MMORPG entity-attribute-relationship diagram in Chen notation
  ([Entity–relationship model § Chen's notation / Components](https://en.wikipedia.org/wiki/Entity%E2%80%93relationship_model)).
  Chen is the *teaching* notation — it is good at explaining what an ERB model *is*, and bad at drawing
  a real 40-table schema (diamonds eat canvas).
- **Crow's foot / IE (Information Engineering, a.k.a. Martin / Barker)**: entities = boxes with a
  **column list inside**, relationships = lines whose **end glyphs** encode cardinality. Wikipedia spells
  out the three glyphs and the four combinations precisely: *ring* = zero, *dash* = one, *crow's foot* =
  many; inner glyph = minimum, outer = maximum → `ring+dash` (zero-or-one), `dash+dash` (exactly one),
  `ring+crow's foot` (zero-or-many), `dash+crow's foot` (one-or-many)
  ([Entity–relationship model § Crow's foot notation](https://en.wikipedia.org/wiki/Entity%E2%80%93relationship_model#Crow's_foot_notation)).
  Note the caveat that page also states: **crow's-foot relationships cannot carry attributes** — if you
  need attributes on a relationship you promote it to an entity (associative table). That is *exactly*
  what `order_items` is.
- **UML class**: box with three compartments (name / attributes with visibility and *types* / methods);
  cardinality as `1`, `0..1`, `*` at line ends; association names and roles; generalization arrows.
  Right for OO/domain modelling (TSdiagram's territory: `interfaces`, `classes`, `extends`, `implements`
  — [`layout.ts` `LayoutEdgeKind`](https://github.com/3rd/tsdiagram/blob/main/src/components/Renderer/layout.ts)),
  wrong for a physical DB schema (methods are noise, and `0..*` conflicts with the crow's-foot glyphs).

**Most practical for Diagram Studio: crow's foot / IE, as the default, with a Chen *lighter* mode.**
Reasoning, grounded in what the tools actually shipped:

1. Every *schema* tool in the cluster is a crow's-foot-family tool (column list in the box, cardinality
   on the line): ChartDB, Liam, drawDB, Prismaliser. Only Liam draws true crow's feet, and Liam is the
   one explicitly marketed as "beautiful and easy-to-read ER diagrams from your database"
   ([liambx.com](https://liambx.com/), [README](https://github.com/liam-hq/liam/blob/main/README.md)).
2. Crow's foot composes with what Diagram Studio already has: the entity box is the existing
   rounded-rect shape vocabulary, and the cardinality glyphs are SVG `<marker>`s on the existing
   `BaseEdge` (`src/GoblinEdge.tsx:206-213` already passes `markerStart`/`markerEnd` through).
3. Chen mode should be **a rendering toggle on the same data**, not a second editor: same
   `tables[]`/`relationships[]`, but entity = rounded rect with the name only, relationship = a diamond
   node rendered at the edge midpoint (or an edge that renders a diamond at its centre), attributes =
   child nodes. That gives Harvey the "teaching diagram" look without a second data model. It is a
   *later* phase — do crow's foot first.
4. UML class should be **SKIP** for the ERD preset (it belongs to a separate "UML" preset: three
   compartments + visibility prefixes + `extends`/`implements` arrows, which is TSdiagram's design).

---

## 3. How these tools handle large schemas

Liam's README claims "High Performance: … easily handling 100+ tables" ([README](https://github.com/liam-hq/liam/blob/main/README.md)),
and the live demos back it: `Langfuse` = **41 tables**, `Mastodon` = **99 tables** rendered from a
GitHub-hosted schema file ([liambx.com](https://liambx.com/)).

### 3.1 Layout

- **Liam — elkjs, in the main thread, `layered` algorithm**, with deliberately chosen options:
  `'elk.algorithm': 'layered'`, `spacing.baseValue: 40`, `spacing.componentComponent: 80`,
  `layered.spacing.edgeNodeBetweenLayers: 120`, `crossingMinimization.forceNodeModelOrder: true`,
  `mergeEdges: true`, `nodePlacement.strategy: 'INTERACTIVE'`, `layering.strategy: 'INTERACTIVE'`
  ([`getElkLayout.ts`](https://github.com/liam-hq/liam/blob/main/frontend/packages/erd-core/src/features/erd/utils/computeAutoLayout/getElkLayout.ts)).
  It runs once on init (`useInitialAutoLayout`), after which the user can drag freely; a "Tidy Up" button
  re-runs it ([docs](https://liambx.com/docs/ui-features/browsing-your-schema)). `INTERACTIVE` placement
  is the key choice — it **preserves the user's mental map** instead of scrambling it.
- **TSdiagram — elkjs in a *Web Worker*** (`elk.worker.ts`, `workerFactory`), plus an
  incremental-layout policy: layout only re-runs when node count changes by >25 % or node overlap
  exceeds 0.7, and nodes the user moved manually are excluded from re-layout
  (`LAYOUT_RESET_NODE_COUNT_CHANGE_THRESHOLD`, `LAYOUT_RESET_NODE_OVERLAP_THRESHOLD`,
  `manuallyMovedNodesSet` in [`layout.ts`](https://github.com/3rd/tsdiagram/blob/main/src/components/Renderer/layout.ts)).
  It also has a second worker for edge routing (`edge-routing.worker.ts`).
- **drawDB — `@dagrejs/dagre`**, `rankdir: 'LR'`, `nodesep: 60`, `ranksep: 110`, with connected vs
  isolated nodes split so orphans get parked after the graph
  ([`autoArrange.js`](https://github.com/drawdb-io/drawdb/blob/main/src/utils/autoArrange.js)).
  Note: **dagre is not a dependency** — drawDB's diagram is plain SVG (`src/components/EditorCanvas/`),
  it does not use React Flow at all.
- **ChartDB — a hand-rolled algorithm, no dagre/elk at all** (confirmed: neither library is in
  [`package.json`](https://github.com/chartdb/chartdb/blob/main/package.json)). `adjustTablePositions` does
  a connectivity-based placement, with a `mode: 'all' | 'perSchema'` flag, area-aware grouping (tables
  geometrically inside an `area` are laid out in a grid inside it, and tables already inside keep their
  position), and connected/isolated splitting
  ([`db-table.ts`](https://github.com/chartdb/chartdb/blob/main/src/lib/domain/db-table.ts)).
- **Prismaliser — elkjs** (`getLayout` in `src/util/layout.ts`), re-runnable from a Controls button
  ("Disperse nodes"), and node positions are captured/restored so a saved diagram keeps its layout
  ([`FlowView.tsx`](https://github.com/Ovyerus/prismaliser/blob/main/src/components/FlowView.tsx)).

**Reality check for Diagram Studio:** we already hand-rolled a longest-path + barycenter layout in
`src/layout.ts` — no dependency, ~120 lines. That is the same *philosophy* as ChartDB. The one thing it
cannot do is respect a *user's* arrangement or a *group's* bounds. TSdiagram's **overlap-threshold +
manual-node-exclusion** policy is the cheapest high-value addition and needs no new dependency.

### 3.2 Search / filter

- **Liam Command Palette**: `Cmd/Ctrl+K`, fuzzy search via **Fuse.js**, real-time preview pane of the
  table's structure, `↑`/`↓` navigate, `Enter` navigate, `Cmd+Enter` open in new tab, and the URL is
  updated with the selection (shareable links) ([docs](https://liambx.com/docs/ui-features/command-palette),
  [`CommandPalette.tsx`](https://github.com/liam-hq/liam/tree/main/frontend/packages/erd-core/src/features/erd/components/ERDRenderer/CommandPalette)).
- **Liam filtering**: select a table → "related tables view" shows only tables related to it; individual
  tables can be shown/hidden from the left panel; the hidden set is compressed into a `hidden` URL param
  (`pako` is a dependency, i.e. the param is deflated), along with `active` (selected table) and
  `showMode` (`ALL_FIELDS` / `TABLE_NAME` / `KEY_ONLY`)
  ([docs](https://liambx.com/docs/ui-features/browsing-your-schema),
  [sharing & query params](https://liambx.com/docs/ui-features/sharing-and-query-params)).

  **`showMode` is the single best large-schema idea in this cluster**: `TABLE_NAME` collapses every
  table to a header-only box (handles move to the header, `TableHeader.tsx`), `KEY_ONLY` shows only PK +
  FK columns (`TableColumnList.tsx::shouldDisplayColumn`). One boolean-ish setting gives you
  "bird's-eye map" ↔ "detail" transitions that scale to 100+ tables without any layout change.
- **ChartDB filtering**: a sidebar filter (`Cmd+F`) plus a *canvas* filter with a **tree view grouped by
  schema or by area**, where each group shows a `visibleCount/total` suffix and non-visible entries are
  dimmed to `opacity-50` (`canvas-filter/utils.ts` `generateTreeDataByAreas`, `canvas-filter/types.ts`).
  Note the honest caveat in ChartDB's own docs: "**Filtering in ChartDB currently only affects the table
  list in the sidebar. It does not filter tables directly on the canvas diagram**"
  ([docs](https://docs.chartdb.io/docs/diagrams/layouts-colors-filters)) — the older behaviour. The
  canvas filter above is the newer one.
- **ChartDB "lost in canvas" detection**: a dedicated `use-is-lost-in-canvas` hook + `show-all-button.tsx`
  plus **overlap highlighting** that only appears when ≥2 tables overlap, and jumps you to the overlap
  ([canvas/](https://github.com/chartdb/chartdb/tree/main/src/pages/editor-page/canvas),
  [docs](https://docs.chartdb.io/docs/diagrams/layouts-colors-filters)).

### 3.3 Focus mode / highlighting

- **Liam**: hover or click a table → related relations are highlighted by colour; the table node gets
  `border: 1px solid var(--primary-accent)` + a green glow, and the *active* table gets
  `border: 2px solid` (`.wrapperHighlighted` / `.wrapperActive` in `TableNode.module.css`). Related
  *columns* get `background-color: var(--primary-overlay-10)` (`.highlightRelatedColumn`). Non-related
  tables are gathered into a `NonRelatedTableGroupNode`.
- **ChartDB**: selecting/hovering an edge highlights the exact two columns it connects
  (`table-node.tsx` computes `highlightedFieldIds` from `selectedRelEdges` → `bg-pink-100 dark:bg-pink-900`)
  and highlights the counterpart custom *type* in yellow.
- **Diagram Studio already does node/edge hover choreography** (`src/choreography.ts`) — this is
  arguably our strongest existing feature and it maps 1:1. What we lack is the ERD-specific extension:
  highlight the *column rows*, not just the node.

### 3.4 Minimap, grouping by schema

- Diagram Studio already renders `<MiniMap>` (`src/App.tsx:1825`), `<Controls>` and `<Background>` —
  parity with every tool here.
- **Grouping by schema** is the main ERD-specific structure:
  - ChartDB: tables carry `schema`, the sidebar groups by schema, `adjustTablePositions(mode:
    'perSchema')` lays out per schema, and a table's `parentAreaId` ties it to an `Area`
    ([`db-table.ts`](https://github.com/chartdb/chartdb/blob/main/src/lib/domain/db-table.ts),
    [docs](https://docs.chartdb.io/docs/diagrams/tables-fields) — "Schemas act like folders").
  - drawDB has the same concept under the name **subject area** ("Add tables, subject areas, and
    notes", [drawdb.app](https://drawdb.app/)) with `AreasContext.jsx`.
  - ChartDB's `area-node` is a resizable, named container: a direct analogue of our existing `group`
    shape, so we can reuse `group` + subflow (parent/child) rather than invent an `area` node.

---

## 4. DDL import / export feasibility

### 4.1 ChartDB's "single query" import — the headline mechanism

The marketing line is "**Run a single query to instantly retrieve your database schema as JSON** …
whether for documentation, team discussions, or simply understanding your data better", with "**No
Database password required**" and "**All without database access**"
([README](https://github.com/chartdb/chartdb/blob/main/README.md), [chartdb.io](https://chartdb.io/)).

The actual mechanism, read from source and docs:

1. **You run one read-only query in *your own* DB client.** ChartDB ships a per-dialect SQL script
   (`src/lib/data/import-metadata/scripts/{postgres,mysql,mariadb,sqlite,sqlserver,clickhouse,
   cockroachdb,oracle}-script.ts`) and a per-client variation (psql / pgAdmin / DBeaver / SSMS / Supabase
   SQL editor) selected in a `SmartQueryInstructions` component
   ([`smart-query-instructions.tsx`](https://github.com/chartdb/chartdb/blob/main/src/dialogs/common/import-database/instructions-section/instructions/smart-query-instructions.tsx),
   [scripts/](https://github.com/chartdb/chartdb/tree/main/src/lib/data/import-metadata/scripts)).
2. **The query returns one JSON blob.** For PostgreSQL it is a `WITH … SELECT CONCAT('[', …)` that
   assembles nested arrays of `fk_info`, `pk_info`, `columns`, `indexes`, `tables`, `views`, `config`,
   and a `database_name` / `version` envelope — built by `array_to_string(array_agg(CONCAT('{"schema":"', …)))`
   over `pg_constraint`, `information_schema.columns`, `pg_index`, `pg_views`
   ([docs.chartdb.io import/postgresql](https://docs.chartdb.io/docs/import/postgresql)).
   The docs emphasise it "only retrieves schema metadata" — no rows.
3. **You paste the JSON back into ChartDB.** It is validated by Zod against `DatabaseMetadataSchema`
   (`{fk_info, pk_info, columns, indexes, tables, views, check_constraints?, custom_types?,
   database_name, version}`) via `isDatabaseMetadata` / `loadDatabaseMetadata`
   ([`database-metadata.ts`](https://github.com/chartdb/chartdb/blob/main/src/lib/data/import-metadata/metadata-types/database-metadata.ts)).
4. **The metadata is projected into the diagram domain model.** `loadFromDatabaseMetadata` calls
   `createTablesFromMetadata`, `createRelationshipsFromMetadata`, `createDependenciesFromMetadata`
   (view→table dependencies), `createCustomTypesFromMetadata`, then `adjustTablePositions(mode:
   'perSchema')`, then sorts tables-before-views alphabetically
   ([`import/index.ts`](https://github.com/chartdb/chartdb/blob/main/src/lib/data/import-metadata/import/index.ts)).
5. **Cardinality is inferred, not asked for.** `determineCardinality(field, isTablePKComplex)` returns
   `'one'` when the field is `unique` or is the table's sole PK, else `'many'`; then for each FK the
   *referenced* (PK) side and the *referencing* (FK) side are swapped so `source` = PK table
   ([`import/relationships.ts`](https://github.com/chartdb/chartdb/blob/main/src/lib/data/import-metadata/import/relationships.ts)).

The JSON shape is therefore worth copying as a *format*, not just as a query: it is a flat,
relation-agnostic, dialect-neutral metadata envelope. (ChartDB's **diagram** JSON — the "Export Diagram"
round-trip — is explicitly a **different** format, and its docs warn not to mix the two:
[docs/export/json](https://docs.chartdb.io/docs/export/json), [docs/import/json](https://docs.chartdb.io/docs/import/json).)

### 4.2 The other import routes (all much cheaper to build)

- **Paste DDL itself.** ChartDB parses raw DDL with `node-sql-parser` (plus an Oracle parser) and has
  dedicated importers per dialect, including a `isPgDumpFormat()` heuristic that sniffs
  `SET statement_timeout` / `ALTER TABLE ONLY` / `COPY … FROM stdin` before choosing the pg_dump
  code path ([`sql-import/index.ts`](https://github.com/chartdb/chartdb/blob/main/src/lib/data/sql-import/index.ts)).
  drawDB does the same, one module per dialect (`src/utils/importSQL/{postgres,mysql,sqlite,mariadb,
  mssql,oraclesql}.js`, dispatched by `importSQL(ast, toDb, diagramDb)`) and then `arrangeTables(diagram)`.
- **DBML.** ChartDB has a full DBML importer (`@dbml/core` `Parser`) with a preprocessor that handles
  array fields, field-level and table-level check constraints, and multi-schema relationships
  ([`dbml-import.ts`](https://github.com/chartdb/chartdb/blob/main/src/lib/dbml/dbml-import/dbml-import.ts)),
  plus a DBML *export* (currently a paid Cloud feature,
  [docs](https://docs.chartdb.io/docs/export/dbml)). drawDB imports/exports DBML too
  (`src/utils/dbml/parse.js`, `src/utils/exportAs/dbml.js`).
- **ORM schema files.** Liam parses `.sql` (via `pg-query-emscripten`), Rails `schema.rb`, **Prisma**,
  **Drizzle**, and `tbls` JSON; format is auto-detected by filename (`schema.rb` → schemarb, `.sql` →
  postgresql) and overridable with `?format=` / `--format`
  ([supported formats](https://liambx.com/docs/parser/supported-formats),
  [detectFormat.ts](https://github.com/liam-hq/liam/blob/main/frontend/packages/schema/src/parser/supportedFormat/detectFormat.ts)).
  Prismaliser goes the other way — it parses Prisma in the browser via Prisma's **WASM** module, entirely
  client-side ("parsing and rendering all happen in your browser via Prisma's schema WASM module",
  [README](https://github.com/Ovyerus/prismaliser/blob/main/README.md)).
- **AI / agent.** ChartDB has an AI DDL exporter (dialect conversion, `VITE_OPENAI_API_KEY`), Datadef and
  Datascale are AI-native with MCP servers
  ([chartdb README](https://github.com/chartdb/chartdb/blob/main/README.md), [datadef.io](https://datadef.io/),
  [getdatascale.com](https://getdatascale.com/)). Interesting strategically but out of scope for a
  client-only editor with no backend.

### 4.3 Export

- **ChartDB**: DDL export per dialect — Generic SQL for everyone, PostgreSQL/MySQL/SQL Server/MariaDB/
  SQLite for signed-in users — rendered in a modal with a Copy button, and explicitly labelled
  "schema definitions based on your diagram … not meant for data migration or direct execution on
  production databases without review" ([docs/export/sql](https://docs.chartdb.io/docs/export/sql)).
  It also has a cross-dialect converter (`sql-export/cross-dialect/postgresql/to-mysql.ts`,
  `type-mappings.ts`, `unsupported-features.ts`).
- **drawDB**: DDL export per dialect, plus **DBML, JSON, image, Mermaid, and a "documentation"
  exporter**, plus migration generation driven by a per-dialect diff (`utils/migrations/diffToSQL.js`,
  `utils/exportSQL/*`) — a notably complete export matrix for a no-backend tool
  ([drawdb.app](https://drawdb.app/), source tree).
- **Liam**: SVG/PNG from the viewer; its docs are built around showing the diagram, not emitting DDL.
- **Diagram Studio today**: PNG / SVG / JSON-out + JSON-in (`src/App.tsx` `exportJson`, `exportPng`/
  `exportSvg`, import JSON), and the JSON is `{name, nodes, edges}`
  (`src/App.tsx:1262-1271`, `src/boards.ts`).

---

## 5. Proposed "Database / ERD preset" for Diagram Studio

Design constraints from the existing app: keep it generic; reuse `--bg/--surface/--elevated/--border/
--fg/--dim/--acc/--sel/--green`; do not bake use-cases into shapes; one accent (`--acc #f54e00`), one
selection colour (`--sel #3b82f6`).

### 5.1 Table node (new node type, not a new `Shape`)

Do **not** overload the existing `goblin` node (its `ShapeFrame` viewBox `0 0 200 100` with
`preserveAspectRatio="none"` would stretch a variable-height table). Add a second node type, `table`,
registered next to `goblin`/`label` in `nodeTypes`.

```
┌──────────────────────────────────────────┐
│ ▎ public.orders                     ⌄ ⌗  │  ← 4px --nc colour strip (reuse ChartDB's 8px idea, narrowed)
│   orders                        ⋯        │  ← 34px header: schema-qualified name, right-side collapse + expand
├──────────────────────────────────────────┤
│ 🔑 id              bigint   PK  NN  U    │
│ 🔗 user_id         bigint        NN      │  ← FK: name in --sel blue, link icon
│    status          order_status       ?  │  ← enum type: tinted chip, nullable '?'
│    total_cents     integer       NN      │
│  ⋯ 4 more   (click to expand)            │  ← "N more" tail when collapsed
└──────────────────────────────────────────┘
```

- Header: shape **rounded rect**, 1 px `--border` border, `--surface` background, `--nc` strip on top.
  Name in the existing `.node-title` typography so it sits in the same visual family as the architecture
  shapes. Table icon (`Table2` in lucide, already available via `src/lucideIcons.ts`) + optional view
  badge.
- Row: 28 px, `border-top: 1px solid var(--border)` between rows (exactly Liam's
  `.wrapper:not(:last-child)` pattern), monospace type right-aligned in `--dim` — Liam's *fade the type
  until hover* trick (`opacity: 0 → 1` on table highlight) is worth ADAPTing: keep it visible at normal
  zoom (our diagrams are smaller than Liam's 100-table schemas) but dim it.
- Badges (all three on the same row, ordered so the eye reads key → name → type):
  - `KeyRound` in `--acc` for PK (one accent, already the brand colour — no new colour introduced)
  - `Link` in `--sel` for FK **plus** the column name in `--sel`, matching ChartDB's colour-only FK cue
  - filled/hollow diamond for NOT NULL / nullable (Liam's convention) — **ADOPT verbatim**, it is the
    least noisy nullable cue in the cluster
  - `UNIQUE` as a small `U` chip only when set (drawDB shows it only in the hover popover; on-canvas is
    better for a design tool)
- Collapse: two independent controls, both from the cluster —
  1. **field-list collapse** (ChartDB `TABLE_MINIMIZED_FIELDS = 10`): after 10 rows show `⋯ N more`,
     clicking expands; the node's height animates.
  2. **key-only collapse** (Liam `KEY_ONLY`): hide non-PK/non-FK columns; **and** drawDB's variant —
     when collapsed, always keep columns touched by a relationship visible
     (`getVisibleFieldEntries`). ADAPT the drawDB variant as the default: it keeps the diagram legible.
  3. **width snap** (ChartDB `MIN 224 / MID 337 / MAX 450`): reuse our existing `NodeResizer` and
     additionally snap the node width to two presets so columns don't truncate.
- Row hover → highlight the row and (via existing choreography) the FK partner's row on the other table.

### 5.2 Edge defaults for the ERD preset

- New edge defaults when the active preset is `database`:
  - `type: 'smoothstep'` with `borderRadius: 14` (ChartDB's ERD path style; our `GoblinEdge` already
    supports `smoothstep` with `borderRadius: 12` at `src/GoblinEdge.tsx:97-99` — ADAPT to 14)
  - `markerEnd: {type: crowFootMany|…}` and matching `markerStart`, i.e. **crow's-foot markers**
  - `style.stroke: 'var(--border-strong)'` at 1.5 px — ERD lines should be quieter than architecture
    flows; keep `--acc` for the *selected* relationship only
  - `label:` the FK constraint name (`orders_user_id_fkey`) or `user_id → id`
  - **no flow animation by default** (`flow: 'none'`) — ADAPT: keep the flow modes available as an
    opt-in, they are genuinely useful for "read-path" ERDs but wrong as a default
- **Crow's-foot marker set** — build 6 minimal SVG markers (three glyphs × two orientations), modelled
  on Liam's `markers/` and Prismaliser's polylines but simplified to the two glyphs Liam's *unhighlighted*
  variants use:
  - `one` = single perpendicular bar (`dash`)
  - `many` = three-line crow's foot
  - `zero` = ring, composed as `one+zero` / `many+zero` for optional ends
  Data model: store `sourceCardinality: 'one'|'many'` and `targetCardinality: 'one'|'many'` **plus**
  an optional `sourceOptional` / `targetOptional: boolean` (ChartDB's model has only `one|many`, which
  cannot express "zero-or-one" — a real limitation worth exceeding). Derive the `1:N` text label from
  the pair. This is a ~120-line addition to `GoblinEdge` and needs no new dependency.
- Column-to-column attachment: add per-row `<Handle>`s in the table node. Because React Flow requires
  unique ids, use ChartDB's scheme: `left_rel_<fieldId>`, `right_rel_<fieldId>`, and
  `target_rel_<n>_<fieldId>` for the n-th incoming FK.

### 5.3 Starter template (users/orders/order_items)

Seed the preset with a 3-table commerce schema — the canonical "one-to-many plus associative table"
example, and the exact structure that motivates crow's foot over Chen (attributes on a relationship →
promote to an entity):

```
users                         orders                        order_items
──────────────────            ──────────────────            ──────────────────────
🔑 id            bigint        🔑 id            bigint        🔑 id          bigint
   email         varchar  U       user_id      bigint  →──┐     order_id    bigint  →──┐
   name          varchar           status       order_status  │     product_id  bigint  │
   created_at    timestamptz  NN   total_cents  integer   NN  │     quantity    integer │
                                   placed_at    timestamptz NN│     unit_cents integer │
                                                             └──   PRIMARY KEY (id)    │
                                                                  FOREIGN KEY (order_id) ─┘
```

Relationships drawn:
- `orders.user_id → users.id`, **one-to-many (mandatory many)**: `markerStart` = `one`
  (users side), `markerEnd` = `many` (orders side), label `users.id → orders.user_id`
- `order_items.order_id → orders.id`, one-to-many
- `order_items.product_id → products.id` — either include a 4th small `products` table, or omit it to
  keep the template to 3 tables and demonstrate a FK to a *missing* table (which the validation panel
  can flag — see §5.4).

Deliberately chosen so the template *teaches*:
1. an `order_status` enum (demonstrates the enum chip + the "type in a different colour" affordance);
2. an associative table (demonstrates why crow's foot beats Chen's diamonds);
3. a nullable column vs a `NOT NULL` column (demonstrates the diamond badges);
4. a `UNIQUE` column (`users.email`).

Layout: reuse `layoutDiagram()`'s layered pass, but for the ERD preset prefer `rankdir: 'LR'` with the
*PK table on the left* (drawDB's dagre config: `rankdir: 'LR', nodesep: 60, ranksep: 110`) and park the
enum as a small node near its user. Set the starting zoom to fit.

### 5.4 Preset plumbing (what "a preset" means in this app)

A preset = `{id: 'architecture' | 'database' | 'flowchart' | …, palette: PaletteItem[], nodeDefaults,
edgeDefaults, starter: () => {nodes, edges}, inspectorSections[]}`. Concretely for `database`:
- palette becomes: `Table`, `View`, `Enum`, `Note`, `Group/Area` (schema boundary), plus a "Custom type"
  note shape. Reuse `group` for the schema/area container (ChartDB's `area-node`) — no new shape needed.
- inspector gains an ERD section: column editor (name / type dropdown / PK / FK / NULL / UNIQUE /
  default / comment) reusing the existing right-panel `.field`/`.field-row` markup, plus a relationship
  editor (cardinality pair + optionality + ON DELETE/ON UPDATE action from drawDB's `Constraint` set).
- checklist gets ERD-specific steps: "add a table", "link two columns", "set cardinality",
  "export DDL" (mirrors the existing `Checklist.tsx` task shape).
- **Validation panel** ADAPT from drawDB's `getIssues()`: empty table name, duplicate table name,
  empty field name, empty field type, `ENUM` with no values, default that doesn't match the type,
  NOT NULL with a literal `null` default, no primary key. This is cheap, deterministic, and it is what
  makes a schema editor feel professional rather than like a drawing tool.

### 5.5 ADOPT / ADAPT / SKIP table

| Finding | Verdict | One-line reason |
| --- | --- | --- |
| Variable-height table node with per-column rows | **ADOPT** | The defining ERD feature; our `goblin` node is a fixed card and cannot express a column list. |
| PK `KeyRound` badge in `--acc` | **ADOPT** | Reuses the existing single CTA accent; no new colour. |
| FK cue = name in `--sel` blue + `Link` icon | **ADOPT** | Matches ChartDB exactly, and `--sel` is already our selection colour. |
| NOT NULL = filled vs hollow diamond | **ADOPT verbatim (Liam)** | Quietest nullable indicator in the cluster; 0 new colour, 2 tiny SVGs. |
| `TABLE_MINIMIZED_FIELDS = 10` + "N more" tail | **ADOPT** | Cheap collapse that keeps big tables readable. |
| drawDB "collapsed hides only unlinked columns" | **ADAPT** | Better default than a plain collapse for ERDs; keep key columns visible. |
| ChartDB width presets 224 / 337 / 450 | **ADAPT** | We already have `NodeResizer`; add width snapping instead of hard-coded sizes. |
| Per-row `<Handle>`s (`left_rel_/right_rel_/target_rel_n_`) | **ADOPT** | The only way to attach column-to-column; `GoblinEdge` needs no change. |
| True crow's-foot SVG markers (Liam) | **ADOPT** | ~6 hand-authored `<marker>`s; `GoblinEdge` already forwards `markerStart/markerEnd`. |
| ChartDB `sourceCardinality/targetCardinality: 'one'|'many'` | **ADAPT** | Add explicit optionality — ChartDB cannot express "zero-or-one". |
| drawDB `Constraint` (ON DELETE/UPDATE actions) | **ADOPT** | 5 enum values, needed for a truthful DDL export. |
| FK constraint name as the default edge label | **ADOPT** | We already have inline label editing; only the default is missing. |
| `showMode: ALL_FIELDS / TABLE_NAME / KEY_ONLY` (Liam) | **ADOPT** | One setting, whole-schema ↔ detail; the best large-schema lever found. |
| Fuzzy command palette with live table preview (Liam, Fuse.js) | **ADOPT** | We already have `SearchPalette.tsx`; extend it to search tables/columns. |
| Minimap | **SKIP (already have it)** | `<MiniMap>` is already rendered in `src/App.tsx:1825`. |
| dagre auto-layout | **SKIP** | Our hand-rolled `src/layout.ts` is dependency-free and already equivalent in philosophy to ChartDB's. |
| elkjs `layered` + `INTERACTIVE` placement (Liam) | **SKIP for now / ADAPT if needed** | Adds a ~1 MB dependency; our layout already does longest-path + barycenter. Revisit only if users report bad ERDs. |
| `manuallyMovedNodesSet` + overlap-threshold re-layout (TSdiagram) | **ADAPT** | Pure logic, no dependency; protects the user's mental map. |
| ChartDB "lost in canvas" / overlap highlighting | **ADAPT** | Small, and it directly addresses big-schema disorientation. |
| Schema/area grouping | **ADOPT via existing `group`** | Our `group` shape + subflow already does this; only the semantics ("schema") and the layout-respect need adding. |
| DBML import/export | **ADAPT (phase 2)** | `@dbml/core` is a real dependency; start with DDL + our own JSON. |
| DDL import via `node-sql-parser` (ChartDB/drawDB) | **ADOPT (phase 2)** | One dependency, one module per dialect; this is the single most valuable import path. |
| ChartDB "single query" JSON import | **ADAPT (phase 3)** | Needs no DB access from us — but also needs 7 SQL scripts and a Zod schema; high effort, high payoff. |
| Prismaliser "AT Protocol public immutable snapshot" sharing | **SKIP** | Exotic protocol, needs a server identity; nothing to do with our local-first board JSON. |
| Prismaliser enum-as-node with a dedicated handle | **ADOPT** | Correct modelling of enums; makes the enum visible instead of a hidden string. |
| ChartDB `DBIndex` (btree/gin/…, `fieldIds[]`) | **ADAPT → inspector only** | Indexes are physical; showing them on the canvas adds noise. Model them, don't draw them. |
| Datadef/Datascale AI + MCP generation, column-level lineage | **SKIP** | We are a client-only editor with no backend; AI generation is a different product. |
| Datascale "auto-detect PK/FK from implicit JOINs" | **SKIP** | Statistical SQL analysis; needs a SQL corpus we don't have. Out of scope. |
| drawDB templates gallery + custom templates | **ADOPT** | Directly matches Harvey's "chọn type mẫu sẵn" ask; the ERD starter is step one. |
| drawDB validation panel (`getIssues`) | **ADOPT** | Makes the ERD a *design* tool, not a drawing tool. |
| drawDB Mermaid export | **ADAPT** | Cheap (`||--||`, `}o--||`, `||--o{`), and gives ERD diagrams a text form for git diffs. |
| OpenMetadata ERD | **SKIP** | The showcase entry is a *catalogue*; its ERD view was only requested in Jan 2026 ([issue #25302](https://github.com/open-metadata/OpenMetadata/issues/25302)). Nothing to learn. |

---

## 6. Top recommendations (ordered by value ÷ effort)

1. **Ship a `table` node type + column-to-column handles + crow's-foot markers.** This is the whole ERD
   thesis in three pieces, needs zero new dependencies, and every other item depends on it. The markers
   are ~6 SVGs; the node is one component; the edge change is a `data` field.
2. **Ship the `database` preset with the `users / orders / order_items` starter.** Harvey's explicit ask
   is "chọn type mẫu sẵn cho từng loại diagrams" — a preset that is genuinely usable in 10 seconds is
   worth more than three more shapes.
3. **Add Liam's `showMode` (`ALL_FIELDS` / `TABLE_NAME` / `KEY_ONLY`).** One enum, whole-schema ↔ detail.
   It is the cheapest large-schema feature in the entire cluster and it is what makes 40+ table schemas
   navigable.
4. **Extend `SearchPalette` to fuzzy-search tables *and* columns**, with a small table preview (Fuse.js
   or ~30 lines of scoring — do not add a dependency for this).
5. **Add the validation panel** (drawDB's `getIssues` list). Cheap, deterministic, and it converts the
   ERD from a picture into a design check.
6. **Then DDL import/export** — one dependency (`node-sql-parser`), dialect modules modelled on
   `sql-import/index.ts` + a per-dialect DDL exporter. Only after the node/edge model is stable,
   because the importer's output shape is exactly the node/edge model.
7. **Defer ChartDB's "single query" JSON-import path.** It is excellent, but it is 7 SQL scripts, a
   Zod-validated metadata envelope, and per-dialect metadata→domain projections. Worth it only once
   DDL import has proven people actually import schemas.

**Explicitly not recommended:** elkjs, DBML, AT Protocol sharing, AI generation, index badges on canvas,
and Chen notation as a *first-class* editor mode. Chen should arrive later as a rendering toggle over the
same table/relationship data, because that is the only way it stays cheap.

---

*Clones deleted after writing this report: `/tmp/drawdb`, `/tmp/tsdiagram`, `/tmp/dbdraw`,
`/tmp/liam-tree.json`, `/tmp/cd-tree.json`. `df -h /` re-checked afterwards.*
