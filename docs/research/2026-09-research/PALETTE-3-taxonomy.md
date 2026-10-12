# PALETTE-3 — Shape/component taxonomies (Mermaid · C4 · ISO 5807) and palette search

Cluster: **structured shape/category taxonomies + how a large palette is searched.**
Scope: research only, no code, no project edits. Output file: this one.

Sources are the tools' own docs/source where possible. Anything I could not confirm is marked
`[UNVERIFIED]`. The paid ISO text is the one authority I could not read end-to-end (see §3 note).

---

## 0. What the app has today (measured, so the proposal fits reality)

Read from `/home/harvey/projects/tech-goblin/lab/diagram-studio/src/`:

- `shapes.tsx` — `Shape` is a union of **19** ids: 9 architecture (`service, database, queue,
  external, actor, storage, gateway, group, note`) + 10 flowchart ids
  (`terminator, process, decision, io, document, subprocess, manual, delay, connector,
  preparation`). The brief says "9 ISO-5807 shapes"; the code contains 10 ISO-derived ids
  (the 10th is `preparation`, which `presets.ts` notes "adapts the gateway hexagon").
- `palette.ts` — `PALETTE` (architecture) is a **flat array of 10 `PaletteItem`s**, no category
  field at all. `PaletteItem = {label, hint, shape, colorKey, kind, size?, make()}`.
- `presets.ts` — per-preset palettes: architecture = the 10 base items; flowchart = 12
  (`FLOWCHART_PALETTE`, incl. `Lane` and `Note`); c4 = 11 C4 elements + `Note`; erd = `Table` +
  `Note`; custom = union (base 10 + 10 flowchart minus Lane/Note + first 6 C4 + Table).
  So today the largest palette is roughly **27 items**, and it is still one flat list.
- `SearchPalette.tsx` (the double-click insert palette) filters with:
  `p.label.includes(q) || p.hint.includes(q) || p.shape.includes(q)`, lowercased, **no ranking,
  source order preserved**, first match auto-highlighted, ↑/↓/Enter/Esc. That is the search
  behaviour that has to be replaced/upgraded once items reach 50–100.

Key structural implication: the app has **one shape union** and **presets select a subset of it**
("the 'no fork' rule", `presets.ts` header). A category taxonomy is therefore a *data* layer over
one union — it must not introduce a second shape registry.

---

## 1. The three vocabularies, as their owners define them

### 1.1 Mermaid — diagram-type taxonomy (the vocabulary that dominates this app)

Mermaid's own front page enumerates its diagram kinds with these headings: **Flowchart,
Sequence diagram, Use case diagram, Gantt diagram, Class diagram, Git graph, Entity Relationship
Diagram (marked `❗ experimental`), User Journey Diagram, Quadrant Chart, XY Chart**
(<https://mermaid.js.org/intro/>). The authoritative machine-readable list of *types the engine
knows* is the config schema's `required` key set, which is a superset:
`flowchart, sequence, gantt, journey, class, state, er, pie, quadrantChart, xyChart, requirement,
architecture, mindmap, kanban, gitGraph, c4, sankey, packet, block, treeView, look, eventmodeling,
radar, usecase, venn`
(<https://mermaid.js.org/schemas/config.schema.json>).

Only a few of those expose *shape* vocabularies that a palette can steal:

| Mermaid diagram kind | Vocabulary it contributes | Source |
|---|---|---|
| Flowchart | 30+ named node shapes with a `Semantic Name` + `Shape Name` + `Short Name` + `Alias` table (e.g. `Process`/Rectangle/`rect`/`proc`,`process`; `Decision`/Diamond/`diam`; `Terminal Point`/Stadium/`stadium`/`pill`,`terminal`) | <https://mermaid.js.org/syntax/flowchart.html> |
| Architecture (v11.1.0+) | building blocks named `group`, `service`, `edge`, `junction`; "services (nodes)"; icons named `cloud, database, disk, server` | <https://mermaid.js.org/syntax/architecture.html> |
| C4 | `Person`, `Person_Ext`, `System`, `SystemDb`, `SystemQueue`, `System_Ext`, `Boundary`, `Enterprise_Boundary`, `System_Boundary`, `Container`, `ContainerDb`, `ContainerQueue`, `Component`, `ComponentDb`, `ComponentQueue`, `Deployment_Node`/`Node`, plus `Rel`/`BiRel` | <https://mermaid.js.org/syntax/c4.html> |
| ER | `entity`, attribute `type`+`name`, and crow's-foot cardinality markers | <https://mermaid.js.org/syntax/entityRelationshipDiagram.html> |
| State | `state`, composite state, `[*]` start/stop pseudo-state | <https://mermaid.js.org/syntax/stateDiagram.html> |

Two Mermaid facts worth copying verbatim:

1. **The "Semantic Name" column exists in the docs itself.** Mermaid publishes each shape with a
   *semantic* name and a *geometric* name side by side (`Collate`/`Hourglass`, `Data Store`/`Data
   Store`, `Decision`/`Diamond`, `Delay`/`Half-Rounded Rectangle`). A palette row can carry both
   without inventing anything: semantic name as the label, geometry as the sub-label.
   (<https://mermaid.js.org/syntax/flowchart.html>)
2. **Aliases are first-class.** `cyl` has aliases `cylinder`, `database`, `db`; `diam` has
   `decision`, `diamond`, `question`; `notch-pent` has `loop-limit`, `notched-pentagon`. That is
   literally Mermaid shipping a synonym index for search — the exact input a palette search wants.
   (<https://mermaid.js.org/syntax/flowchart.html>)
3. Mermaid also has a **shape syntax by name** — `A@{ shape: rect, label: "..." }` — i.e. shapes
   are addressed by a stable short name, not by index
   (<https://mermaid.js.org/syntax/flowchart.html>).
4. Icons are pluggable: `mermaid.registerIconPacks([{name, loader}])`, packs published on
   icones.js.org; flowchart nodes can also carry FontAwesome `fa:fa-twitter` / custom `fak:` icons
   (<https://mermaid.js.org/config/icons.html>, <https://mermaid.js.org/syntax/flowchart.html>).
   Relevant to Harvey's "custom element" ask, though that is another cluster's brief.

### 1.2 C4 — the officially correct terms

From the model's own site (<https://c4model.com/>):

- The four core **abstractions** are, in the site's own words: **software systems, containers,
  components, and code** (<https://c4model.com/>). The defining sentence:
  "A **software system** is made up of one or more **containers** (applications and data stores),
  each of which contains one or more **components**, which in turn are implemented by one or more
  **code** elements (classes, interfaces, objects, functions, etc). And **people** (actors, roles,
  personas, named individuals, etc) use the software systems that we build."
  (<https://c4model.com/abstractions>)
- The four core **diagrams** are "(system) context, containers, components, and code" — the site
  labels them "1. System context diagram … 2. Container diagram … 3. Component diagram …
  4. Code diagram" (<https://c4model.com/diagrams>).
- Three **supporting** diagram types: **System landscape diagram, Dynamic diagram, Deployment
  diagram** (<https://c4model.com/diagrams>).
- The notation rules that name palette items (<https://c4model.com/diagrams/notation>):
  - "The type of every element should be explicitly specified (**Person, Software System,
    Container or Component**)." — capitalised, exactly those four words, plus Code element.
  - "Every container and component should have a technology explicitly specified."
  - "Every line should represent a **unidirectional** relationship."
  - "Every line should be labelled … ideally avoiding single words like, 'Uses'."
  - "Relationships between containers … should have a technology/protocol explicitly labelled."
  - "Every diagram should have a title describing the diagram type and scope" and "Every diagram
    should have a **key/legend**".
  - **Colours are explicitly not prescribed**: "Although you may see many example diagrams and
    tools that make use of blue and grey boxes, this **isn't** something that is dictated by the
    C4 model, and you are free to use whatever colours you like!"
- The C4 model is **notation independent**: "The C4 model is notation independent, and doesn't
  prescribe any particular notation." (<https://c4model.com/diagrams/notation>) — so no shape is
  mandated; shape is a *convention*, and the app is free to map C4 types onto its existing shapes
  (which `presets.ts` already does: 15 `C4Type`s → 6 existing shapes).
- Terminology traps for a C4 palette:
  - **"Container" ≠ Docker container.** c4model defines a container as "applications and data
    stores" (<https://c4model.com/abstractions>). Using "Containers" as a *category* heading in a
    C4 preset would collide with the Docker meaning.
  - **Boundary** is a legitimate C4 concept and appears in Mermaid/PlantUML as
    `Boundary`/`System_Boundary`/`Enterprise_Boundary`/`Container_Boundary`
    (<https://mermaid.js.org/syntax/c4.html>); c4model's own element set is the four types above,
    so "Boundary" is a *supporting* rather than a core element name — the site's notation page does
    not list Boundary among "Person, Software System, Container or Component"
    (<https://c4model.com/diagrams/notation>).
  - Mermaid's C4 element list is the PlantUML-compatible one and is marked **"experimental"** —
    "C4 Diagram: This is an experimental diagram for now. The syntax and properties can change in
    future releases." (<https://mermaid.js.org/syntax/c4.html>)

### 1.3 ISO 5807 — the correct names for the shapes the app already ships

The standard: **ISO 5807:1985**, "Information processing — Documentation symbols and conventions
for data, program and system flowcharts, program network charts and system resources charts",
Edition 1, published 1985-02, **25 pages, CHF 135**, "last reviewed and confirmed in 2019.
Therefore this version remains current", ICS 35.080 / 01.080.50
(<https://www.iso.org/standard/11955.html>). It "Defines symbols to be used in information
processing documentation and gives guidance on conventions for their use in data flowcharts,
program flowcharts, system flowcharts, program network charts, system resources charts"
(<https://www.iso.org/standard/11955.html>).

> **Note on verification.** The standard text is paywalled; I could not read the symbol table
> itself. The names below are from Wikipedia's ANSI/ISO table (which cites ISO 5807:1985 and
> IBM's *Flowcharting Techniques* GC20-8152-1) and from Mermaid's own semantic-name table. Treat
> the *name* column as verified-by-two-secondary-sources, not as the ISO wording.
> `[UNVERIFIED against ISO 5807:1985 §symbol table]`

Names, from the ANSI/ISO shape table (<https://en.wikipedia.org/wiki/Flowchart>, section
"Common symbols" / "Other symbols"):

| App shape id | Correct name (per ANSI/ISO table) | Notes from that table |
|---|---|---|
| `terminator` | **Terminal** | "Represented as a stadium, oval or rounded (fillet) rectangle"; holds "Start"/"End" |
| `process` | **Process** | rectangle; "Represents a set of operations that changes value, form, or location of data" |
| `decision` | **Decision** | diamond/rhombus; "a conditional operation that determines which one of the two paths the program will take" |
| `io` | **Input/output** | rhomboid/parallelogram |
| `subprocess` | **Predefined process** | "named process which is defined elsewhere … rectangle with double-struck vertical edges" |
| `connector` | **On-page connector** | "a small circle with a letter inside" |
| — (not shipped) | **Off-page connector** | home-plate-shaped pentagon |
| `document` | **Document** | "rectangle with a wavy base" |
| — (not shipped) | **Multiple documents** | "a stack of rectangles with wavy bases" |
| `manual` | **Manual operation** | "trapezoid with the longest parallel side at the top" |
| — (not shipped) | **Manual input** | "quadrilateral, with the top irregularly sloping up from left to right" |
| `preparation` | **Preparation or Initialization** | "elongated hexagon" |
| — (not shipped) | **Data File or Database** | cylinder (the app's `database` already covers this) |
| — (not shipped) | **Annotation (comment)** | open rectangle joined to the symbol by a dashed/solid line |
| — (not shipped) | **Flowline** | the arrow itself; "Arrowheads are added if the flow is not the standard top-to-bottom, left-to-right" |
| — (not shipped) | **Parallel Mode** (fork/join) | "two horizontal lines at the beginning or ending of simultaneous operations" |
| — (not shipped) | **Data** (Data Store / I/O etc., per Mermaid) | see Mermaid's table |

Also from that Wikipedia section: ANSI standardised flowchart symbols in the 1960s, ISO adopted
the ANSI symbols in 1970, "the current standard, **ISO 5807**, was published in 1985 and last
reviewed in 2019", and "flowcharts flow from top to bottom and left to right"
(<https://en.wikipedia.org/wiki/Flowchart>).

`delay` is not in Wikipedia's ANSI/ISO table; Mermaid names it **Delay / Half-Rounded Rectangle**
(`delay`, alias `half-rounded-rectangle`) (<https://mermaid.js.org/syntax/flowchart.html>), and
draw.io uses "Delay" for the D-shape. `[UNVERIFIED: ISO 5807's own name for the D-shape]`

**Naming gaps to fix in the app's palette today** (these are the biggest wins from this cluster):

| Current palette label | Corrected label | Why |
|---|---|---|
| `Start / End` | **Terminal** (hint: "Start / End") | ISO's term is Terminal; "Start / End" is the *content* convention, not the symbol name |
| `Subprocess` | **Predefined process** (hint: "Subprocess · defined elsewhere") | ISO term; Mermaid's alias set includes `subproc`,`subprocess`,`subroutine` |
| `Manual step` | **Manual operation** (hint: "done by a person") | ISO term — "Manual operation" is the trapezoid; "Manual input" is the sloped quadrilateral, and the app ships only the former |
| `Connector` | **On-page connector** | ISO distinguishes on-page vs off-page |
| `Preparation` | **Preparation** (hint: "Initialization · hexagon") | already correct; keep |
| `Process` | **Process** | already correct |
| `Decision` | **Decision** | already correct (Mermaid calls the semantic name Decision too) |
| `Input / Output` | **Input/output** | already correct |

---

## 2. Answer 1 — a proposed CATEGORY TAXONOMY for a generic diagram editor

Design constraints that fall out of the above:
- One union of shapes, categories are metadata over it (§0).
- Category names must be **the standard's own words** where a standard exists (§1.3, §1.2).
- A shape may legitimately appear in two categories (Terminal is "Basic" *and* "Flowchart"), but
  each shape has exactly **one home category** for the collapse/scroll default, and category
  membership is declarative data.

Recommended: **6 required categories + 2 optional**, 8 total. The six in bold map 1:1 onto the
coverage Harvey's brief demands.

| # | Category name | What belongs in it (standard name first, app id in backticks) | Source for the names |
|---|---|---|---|
| 1 | **Basic** | Rectangle (`rect`), Rounded rectangle (`rounded`/Event), Stadium (`stadium`), Circle (`circle`), Ellipse, Diamond (`diam`), Triangle (`tri`), Hexagon (`hex`), Parallelogram (`lean-r` / `lean-l`), Text | Mermaid short names + aliases: <https://mermaid.js.org/syntax/flowchart.html> |
| 2 | **Flowchart** | Terminal, Process, Decision, Input/output, Predefined process, Preparation, Manual operation, Manual input, Delay, Display, On-page connector, Off-page connector, Loop limit, Fork/Join (Parallel Mode) | ISO 5807 names: <https://en.wikipedia.org/wiki/Flowchart>; Mermaid adds Delay/Display/Loop limit/Fork-Join: <https://mermaid.js.org/syntax/flowchart.html> |
| 3 | **Data & storage** | Database (cylinder), Data store, Object storage (bucket), Internal storage (window pane), Disk storage (lined cylinder), Direct access storage (horizontal cylinder), Paper tape (flag), Stored data (bow-tie rectangle), Document, Multi-document | Mermaid semantic names: <https://mermaid.js.org/syntax/flowchart.html>; ISO "Data File or Database", "Document", "Multiple documents": <https://en.wikipedia.org/wiki/Flowchart> |
| 4 | **Architecture** | Service, Application, Gateway (API gateway / load balancer), Queue (message bus / topic), Storage, External system, Actor / Person, Database instance, plus cloud/infra additions (CDN, serverless function, network, firewall) | Mermaid names its equivalent "Architecture Diagrams" with building blocks `group`, `service`, `edge`, `junction` and icons `cloud, database, disk, server`: <https://mermaid.js.org/syntax/architecture.html> |
| 5 | **C4** | Person, Software System (internal / external), Container (application / database / queue / object store), Component, plus boundaries: Enterprise boundary, System boundary, Container boundary | <https://c4model.com/abstractions>, <https://c4model.com/diagrams/notation>, <https://mermaid.js.org/syntax/c4.html> |
| 6 | **Entities** (ERD) | Entity/Table, Entity view, Enumeration, Associative (join) table, Attribute row (PK/FK/NOT NULL/unique flags); cardinality lives on the *edge*, not in this category | Mermaid `entity`/attribute model: <https://mermaid.js.org/syntax/entityRelationshipDiagram.html> |
| 7 | **Groups & boundaries** (optional split) | Group, Boundary, Pool, Lane (swimlane), Frame, Deployment node | Mermaid `group` + `in {parent}`: <https://mermaid.js.org/syntax/architecture.html>; C4 boundaries: <https://mermaid.js.org/syntax/c4.html>; ISO 5807 "system flowcharts"/cross-functional lanes: <https://en.wikipedia.org/wiki/Flowchart> |
| 8 | **Annotations** (optional split) | Note, Text label, Comment (curly brace), Legend/key, Callout | Mermaid `Comment`/`Curly Brace`/`Text Block`: <https://mermaid.js.org/syntax/flowchart.html>; C4 "Every diagram should have a key/legend": <https://c4model.com/diagrams/notation> |

Category 7+8 can be a single **"Annotations & boundaries"** if Harvey prefers 7 headings over 8.
Categories 1–3 are the "geometry + ISO process" pair; 4–6 are the notation-specific trio.

**Cardinality belongs to connectors, not shapes.** In both standards the crow's-foot markers are
*relationship ends*: Mermaid ER "Relationships between entities are represented by lines with end
markers representing cardinality. Mermaid uses the most popular crow's foot notation"
(<https://mermaid.js.org/syntax/entityRelationshipDiagram.html>). Do not add
"one", "many", "zero-or-one" items to the Entities *shape* category — they are edge options.
The app already models this correctly (`crowStart`/`crowEnd` on `EdgeDefaults` in `presets.ts`).

---

## 3. Answer 2 — which categories are visible for which diagram type

The app's presets are `architecture | flowchart | c4 | erd | custom` (`presets.ts`). Mapping the
taxonomy onto them:

| Category | architecture | flowchart | c4 | erd | custom |
|---|---|---|---|---|---|
| Basic | ● visible (Diamond/Triangle/Hexagon only; the rest are in Architecture) | ● visible (Stadium, Diamond, Parallelogram, Hexagon are the canonical flow shapes) | ○ collapsed (C4 draws boxes+lines; geometry is not the point) | ○ collapsed | ● visible |
| Flowchart (ISO 5807) | ○ collapsed | ● visible, expanded by default | ✗ not offered | ✗ not offered | ● visible |
| Data & storage | ● visible (Database, Storage, Queue) | ○ collapsed (Database/Document appear here too) | ● visible as *C4* items, not as this category (Database shows up as "Container: database") | ● visible (Table is its own category) | ● visible |
| Architecture | ● visible, expanded by default | ✗ not offered | ○ collapsed (a Container maps onto Service/Database shapes — already true in `presets.ts`) | ✗ not offered | ● visible |
| C4 | ✗ not offered | ✗ not offered | ● visible, expanded by default | ✗ not offered | ● visible (first 6 only today) |
| Entities (ERD) | ✗ not offered | ✗ not offered | ✗ not offered | ● visible, expanded by default | ● visible |
| Groups & boundaries | ● visible (Group; Boundary for C4 only) | ● visible (Pool, Lane) | ● visible (Enterprise / System / Container boundary) | ○ collapsed | ● visible |
| Annotations | ● visible (Note, Text) | ● visible (Note, Annotation) | ● visible (Note; C4 *requires* a legend — see below) | ● visible (Note as enum) | ● visible |

Legend: ● visible · ○ collapsed-but-available · ✗ hidden for this preset.

Rules this table implies:

1. **The preset still decides visibility, the category decides order.** A category that is `✗` does
   not exist in that preset's palette at all (matches today's `presets.ts` behaviour: architecture
   has no decision diamond).
2. **One category is expanded by default per preset** — the one that names the preset
   (Flowchart→Flowchart, c4→C4, erd→Entities, architecture→Architecture). Everything else starts
   collapsed, which is what keeps the panel short after the taxonomy lands.
3. **C4 is a special case for Annotations + Groups:** c4model says "Every diagram should have a
   title describing the diagram type and scope" and "Every diagram should have a key/legend
   explaining the notation being used" (<https://c4model.com/diagrams/notation>). So the C4 preset
   should keep Note *and* Legend visible, and must keep the boundary items — that is why
   `Groups & boundaries` is a real category and not folded into Annotations.
4. **`custom`** = union (as today) with the preset's suggested theme only; it should show all eight
   categories, all collapsed except Basic.

---

## 4. Answer 3 — what a 50–100 item palette search should match on, and how it should rank

### 4.1 What to match on

Mermaid already ships the right *shape* of index for this: each node shape has a semantic name, a
geometric name, a short name, and **aliases** (`diam` ← `decision`, `diamond`, `question`; `cyl` ←
`cylinder`, `database`, `db`; `notch-pent` ← `loop-limit`, `notched-pentagon`)
(<https://mermaid.js.org/syntax/flowchart.html>). Two more implementations confirm the same
pattern:

- **fzf** matches on the line by default and lets you *scope* what is searched with
  `--nth=N[..]` — "Comma-separated list of field index expressions for limiting search scope",
  plus `--with-nth` to decide what is *presented* (and it explicitly does not search hidden fields)
  (<https://raw.githubusercontent.com/junegunn/fzf/master/man/man1/fzf.1>).
- **cmdk** (the de-facto React command-menu library) gives every item a `value` **plus a
  `keywords` prop**: "Keywords act as aliases for the item value, and can also affect the rank of
  the item. Keywords are trimmed." Its default item value "will be automatically inferred from the
  `.textContent`" (<https://github.com/pacocoursey/cmdk>).

So the searchable fields for a palette item `{label, hint, shape, category}` should be, in order of
weight:

| Field | Example for the app | Rank weight |
|---|---|---|
| `label` (the standard term) | "Predefined process" | highest |
| `aliases[]` (Mermaid's alias list + the ISO alternative names) | `subprocess`, `subroutine`, `subproc`, `fr-rect` | high (same tier as label for *matching*, lower for *ranking*) |
| `shortName` (Mermaid's short name) | `fr-rect` | high |
| `category` name | "Flowchart" | medium — lets "flow" narrow the list to a category |
| `hint` (geometry + intent) | "double-bar rect · defined elsewhere" | medium — "cylinder" and "diamond" must find Database/Decision |
| `geometry` word (parsed out of the hint) | `rect`, `cylinder`, `diamond`, `hexagon`, `stadium` | medium |

Consequences: put the *geometry* word in a separate field rather than only inside prose, and keep
the Mermaid alias arrays verbatim — they are already curated by Mermaid's maintainers.

### 4.2 How to rank

Three published algorithms agree on the shape of the answer, and they disagree in a way that
matters for a 50–100 item list:

**fzf** — "an interactive filter program for any kind of list … implements a 'fuzzy' matching
algorithm, so you can quickly type in patterns with omitted characters and still get the results
you want." Its scoring is explicit:

- `--algo=v2` is the **"Optimal scoring algorithm (quality)"**; `v1` is **"Faster but not
  guaranteed to find the optimal result (performance)"** — default is `v2`.
- `--scheme=` picks the scoring bias: `default` = "Generic scoring scheme designed to work well
  with any type of input"; `path` = "Additional bonus point is only given to the characters after
  path separator"; `history` = "No additional bonus points are given so that we give more weight to
  the chronological ordering".
- `--tiebreak=CRI[,..]` is applied **when scores are tied**, with these criteria: `length`
  ("Prefers line with shorter length"), `chunk` ("Prefers line with shorter matched chunk"),
  `pathname`, `begin` ("matched substring closer to the beginning"), `end`, `index` ("appeared
  earlier in the input stream"). "Default is `length` (or equivalently `length,index`)" and
  "`index` is implicitly appended to the list when not specified."
- Query side: `--smart-case` is the default ("case-insensitive by default, but it becomes
  case-sensitive if the query contains any uppercase letters"); extended-search syntax gives
  `'exact`, `^prefix`, `suffix$`, `!negation`, and an OR operator `|`.
  (<https://raw.githubusercontent.com/junegunn/fzf/master/man/man1/fzf.1>)

**fzy** — states its four ranking preferences in one sentence each: "It prefers consecutive
characters: `file` will match **file** over **fil**t**e**r. It prefers matching the beginning of
words: `amp` is likely to match **a**pp/**m**odels/**p**osts.rb. It prefers shorter matches: `abce`
matches **abc**d**e**f over **abc** d**e**. It prefers shorter candidates: `test` matches **test**s
over **test**ing." (<https://github.com/jhawthorn/fzy>) Its ALGORITHM.md also documents *why* the
choice of match matters: fzf "finds its match by the first match appearing in the candidate string …
but it isn't guaranteed to find the shortest match in the string", giving the worked example for
`abc`: `AXXBXXCxxabc` vs `xxxxxxxAXBXC` vs `xxxxxxxxxABC` — the third is the one the user meant
(<https://github.com/jhawthorn/fzy/blob/master/ALGORITHM.md>).

**VS Code** is the most informative because it is *published source*, not prose. In
`src/vs/base/common/filters.ts` (Microsoft, MIT):

- It exposes named, composable match kinds: `matchesStrictPrefix`, `matchesPrefix`,
  `matchesContiguousSubString`, `matchesBaseContiguousSubString`, `matchesSubString` (in-order
  non-contiguous), and camel-case matching with `nextAnchor` / `isPatternInWord`.
- The scorer `fuzzyScore(...)` returns `FuzzyScore = [score, wordStart, ...matches]` with
  `FuzzyScore.Default = [-100, 0]` meaning "no matches".
- Exact score components (comments in the file): common prefix `foobar <-> foobaz` → **7** (5 if
  case differs); hitting upper-case in camelCase `foo <-> forOthers` → **7**/**5**; hitting a word
  separator `.` → **5**; post-separator (`bar_foo`) → **5**; part of a contiguous match → **+1**;
  beginning of a new match after a gap → **+2** (0 at a gap location); first pattern char matching
  away from the word start → **−5** (−3 at a gap location); "a gap start" penalty **−5**; matching
  the last character of the word → **−5/−3** "to normalize things"; full-word match (`wordLen ===
  patternLen`) → **+2** boost; **"Add 1 penalty for each skipped character in the word"**; and for
  typo tolerance, `fuzzyScoreWithPermutations` swaps neighbouring pattern chars for up to 7
  permutations with a **−3 permutation penalty**.
- Word separators are enumerated explicitly: `'()[]{}<>`\`\\'"-/;:,.?!'` plus whitespace.

**cmdk** — the React-side contract: "You can provide a custom `filter` function that is called to
**rank** each item" returning a number (higher = better), with `keywords` folded into the value that
gets matched, and `group`s that "will not unmount from the DOM, rather the `hidden` attribute is
applied" (i.e. grouping and filtering are independent layers)
(<https://github.com/pacocoursey/cmdk>).

#### The ranking model I recommend (grounded in the above)

Stage 1 — **tiered matching** (VS Code's named filters, in this order; first tier that matches wins
the tier, score inside the tier from the scorer):

| Tier | Rule | Precedent |
|---|---|---|
| 0 | `label` equals the query (case-insensitive) | fzf `'exact` term; cmdk rank 1 |
| 1 | `label` starts with the query | `matchesPrefix`; fzf `^anchor` |
| 2 | any `alias` equals the query | cmdk `keywords`; Mermaid alias table |
| 3 | word-boundary hit inside `label` or `alias` (boundary = whitespace + `'()[]{}<>`\`\\'"-/;:,.?!'`) | `matchesCamelCase` / separator bonus 5–7, `nextAnchor` |
| 4 | contiguous substring anywhere in `label` / `alias` / `geometry` | `matchesContiguousSubString` |
| 5 | contiguous substring in `category` name, or in `hint` | fzf `--nth` field scoping |
| 6 | in-order non-contiguous subsequence over `label`+`aliases` | `matchesSubString`; fzf's core fuzzy mode |

Stage 2 — **score inside a tier**: copy VS Code's weights rather than inventing new ones
(prefix 7 / camel-case 7 / separator 5 / post-separator 5 / contiguous +1 / new-match +2 / gap
start −5 / skipped char −1 / full match +2 / permutation −3). This is a published, tested
heuristic.

Stage 3 — **ties**: `length` first, then `begin`, then **palette order within the active preset**
(the app's own `index` — fzf's implicit `index` tiebreak, "Prefers line that appeared earlier in
the input stream"). Palette order must be the final tiebreak so the same query is stable across
sessions and so curated order still means something.

Stage 4 — **presentation of results**: use cmdk's separation of concerns — keep the *category
groups* rendered and mark non-matching groups `hidden` rather than flattening everything into one
list. cmdk: "Groups will not unmount from the DOM, rather the `hidden` attribute is applied to hide
it from view." That keeps group identity visible when a query matches items in several categories,
which is the whole reason for the taxonomy.

Stage 5 — **matching case behaviour**: fzf's default `--smart-case` — case-insensitive unless the
query contains an uppercase letter. Cheap, and it is the documented default of the tool most
developers have used.

Two extra behaviours worth adopting because the sources state them explicitly:

- **Negative terms** (`!`) and **field scoping**: fzf's `!term` excludes, and `--nth` restricts
  search to fields. On a shape palette both are cheap wins for power users ("!c4 diamond").
- **Result-count feedback**: fzf shows "Info line (match counters)" in its default style; a palette
  with 100 items needs the same ("14 shapes" / "No shape matches …" — the app already has the
  empty-state string `No shape matches "{q}".` in `SearchPalette.tsx`).

What *not* to do: the current `.includes()` with source order is exactly fzy's "length of first
match" family, which ALGORITHM.md documents as the simplest-but-weakest option and the one whose
inconsistencies (the "Selecta" example) motivated fzy's scoring
(<https://github.com/jhawthorn/fzy/blob/master/ALGORITHM.md>). At 27 items that is invisible; at 80
it is the difference between typing `cyl` and finding Database.

---

## 5. Answer 4 — what makes a category name good vs bad for a technical audience

A good category name for a technical audience satisfies three tests:

1. **It is a term the standard already owns** — so the name carries the rules for free (ISO 5807
   for flow symbols; C4 for architecture abstractions; Mermaid for node-shape semantics).
2. **It does not collide with a name already used for something else in the same UI** — especially
   when the collision means a *different* thing (C4 "Container" vs Docker "container").
3. **It is a noun phrase that a user would type as a search term** — because the category name is a
   searchable field (§4.1), not just a heading.

Three good names, with reasoning:

| Good name | Reasoning | Source that makes it correct |
|---|---|---|
| **Flowchart** | It is the exact word both the standard's field and Mermaid use for this symbol family, it is the app's own preset label, and it is the word a user types. The bad alternative is "Process symbols" — "Process" is already the name of *one shape inside* this category (ISO's Process rectangle), so the heading would compete with its own content. | ISO 5807's scope covers "data flowcharts, program flowcharts, system flowcharts" (<https://www.iso.org/standard/11955.html>); Mermaid's diagram kind is "Flowchart" (<https://mermaid.js.org/intro/>); the app's preset label is already `Flowchart`. |
| **C4** (with items labelled by their bracketed types) | The model's own name for itself is literally "The C4 model for visualising software architecture" (<https://c4model.com/>). It is short, unambiguous, searchable, and it lets each row carry the officially correct element type — "[Person]", "[Software System]", "[Container]" — which is what c4model demands ("The type of every element should be explicitly specified (e.g. Person, Software System, Container or Component)"). The bad alternative is "Architecture" — which is *already another category in this taxonomy* (§2 #4) and would silently mix two different vocabularies in one panel; the second bad alternative is "System Design", which names nothing in the standard. | <https://c4model.com/>, <https://c4model.com/diagrams/notation> |
| **Data & storage** | It names the thing the shapes *represent* (a datastore, a document, a tape) rather than a shape, so it stays true across notations where the same meaning is drawn differently — and it deliberately avoids a second collision: in C4, "Container" means "applications and data stores", so a heading called "Containers" over database/queue/storage shapes would be technically defensible and practically confusing. "Data & storage" is the neutral umbrella; Mermaid's own semantic-name table groups these as Data Store / Stored Data / Internal Storage / Disk Storage / Direct Access Storage, so the vocabulary exists. | c4model container definition (<https://c4model.com/abstractions>); Mermaid shape table (<https://mermaid.js.org/syntax/flowchart.html>) |

The bad-name patterns, stated as rules:

- **Don't reuse a word that is already the name of a shape inside the category** ("Process
  symbols" containing "Process").
- **Don't reuse a word that means something else in a neighbouring category of the same palette**
  ("Containers" in a C4 preset = application/data store, not Docker).
- **Don't use mood/audience words** ("Essentials", "Advanced", "Common") — they are not
  searchable, not stable, and they encode a judgement that will be wrong for some diagrams.
- **Don't use vendor buckets** ("AWS", "Cloud & DevOps") in a *generic* editor — the project brief
  requires everything stay generic, and vendor names would also make the same shape appear under
  two headings as the palette grows.

---

## 6. Recommendation (this cluster only)

1. **Add a `category` field to `PaletteItem` and keep one shape union.** Categories are metadata:
   `{id, label, order, defaultExpandedFor: PresetId[]}`. Do not create per-preset shape registries
   — `presets.ts` already enforces "one union, presets select a subset", and the taxonomy must
   respect it.
2. **Use the eight categories in §2**, with the six marked ones as the minimum: Basic, Flowchart,
   Data & storage, Architecture, C4, Entities, Groups & boundaries, Annotations. Name shapes with
   the **ISO 5807 term** in the flowchart category and the **C4 element type** in the C4 category.
3. **Rename five existing items to their standard names** (§1.3 table): `Start / End` → Terminal,
   `Subprocess` → Predefined process, `Manual step` → Manual operation, `Connector` → On-page
   connector. Keep the old word in the `hint` so muscle memory and search still work
   ("Start / End", "defined elsewhere", "done by a person", "jump on page").
4. **Ship a real alias index per item**, seeded from Mermaid's alias column
   (`subproc`,`subroutine`,`fr-rect`,`pill`,`terminal`,`db`,`cylinder`,`question`,`diamond`, …)
   plus the retired labels from step 3. Mermaid already curates this list; copying it is free
   correctness.
5. **Replace `includes()` + source order with the 6-tier match / VS Code-weighted score /
   length→begin→palette-index tiebreak model in §4.2**, and keep groups rendered-and-hidden
   (cmdk's behaviour) instead of flattening results.
6. **Put the geometry word in its own searchable field.** Users search by *what the shape looks
   like* ("hexagon", "cylinder", "diamond") at least as often as by semantic name; today that word
   only exists buried in the hint prose.
7. **Category visibility stays preset-driven** (§3): `✗` categories are absent, one category is
   expanded by default per preset, everything else starts collapsed. This is what keeps a 50–100
   item palette from being a wall.
8. **Do not add cardinality to the Entities shape category** — crow's foot is edge data
   (already modelled as `crowStart`/`crowEnd`), and both Mermaid's and c4model's conventions put it
   on the line.

Open question for Harvey (not resolvable from sources): whether C4 boundary shapes live in
**Groups & boundaries** or inside **C4**. Mermaid's C4 puts them in the same element namespace;
c4model's notation page names only the four element types. Both are defensible; the sources do not
decide it.

---

## Sources

All URLs used in this report:

**Mermaid (official docs / schema)**
- <https://mermaid.js.org/intro/>
- <https://mermaid.js.org/intro/syntax-reference.html>
- <https://mermaid.js.org/syntax/flowchart.html>
- <https://mermaid.js.org/syntax/c4.html>
- <https://mermaid.js.org/syntax/architecture.html>
- <https://mermaid.js.org/syntax/entityRelationshipDiagram.html>
- <https://mermaid.js.org/syntax/stateDiagram.html>
- <https://mermaid.js.org/config/icons.html>
- <https://mermaid.js.org/schemas/config.schema.json>

**C4 model (official site, Simon Brown)**
- <https://c4model.com/>
- <https://c4model.com/abstractions>
- <https://c4model.com/diagrams>
- <https://c4model.com/diagrams/notation>
- <https://c4model.com/diagrams/system-context>
- <https://c4model.com/tooling>
- <https://c4model.com/faq>
- (PlantUML-compatible element list, referenced by Mermaid) <https://github.com/plantuml-stdlib/C4-PlantUML>

**ISO 5807**
- <https://www.iso.org/standard/11955.html>
- <https://en.wikipedia.org/wiki/Flowchart>

**Fuzzy search / command palette implementations**
- fzf manual (score/tiebreak/scheme/extended search, smart-case): <https://raw.githubusercontent.com/junegunn/fzf/master/man/man1/fzf.1>
- fzf README/site: <https://github.com/junegunn/fzf>, <https://junegunn.github.io/fzf/>
- fzy scoring preferences + algorithm comparison: <https://github.com/jhawthorn/fzy>, <https://github.com/jhawthorn/fzy/blob/master/ALGORITHM.md>
- VS Code fuzzy scorer and match kinds (MIT source): <https://raw.githubusercontent.com/microsoft/vscode/main/src/vs/base/common/filters.ts>
- VS Code Command Palette behaviour: <https://code.visualstudio.com/docs/getstarted/userinterface>
- cmdk (⌘K) filter/keywords/groups contract: <https://github.com/pacocoursey/cmdk>
