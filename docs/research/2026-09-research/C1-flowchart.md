# C1 — Flowchart / process-diagram cluster: what **Diagram Studio** must add to be a real FLOWCHART tool

**Cluster:** flowchart / process / business-process diagram tools in the React Flow showcase
**Target:** `/home/harvey/projects/tech-goblin/lab/diagram-studio` (9 architecture shapes, one
`GoblinEdge`, dark-only tokens, hand-rolled layered layout)
**Method:** live apps read in a real browser + targeted OSS source (Ameliorate sparse clone, 5.3 MB,
`/tmp/ame`, deleted after this report; raw GitHub file views for VisualFlow) — no large clones.
Every claim below carries a URL; code claims carry `file:line` from the clone or the raw blob.

---

## 0. Executive summary (read this if nothing else)

Diagram Studio today cannot draw a flowchart, and the reason is **not** the shape list. It is three
structural things:

1. **Every node has only Left (target) / Right (source) handles**
   (`src/DiagramNode.tsx:126–132, :143–153, :163–181` — `Position.Top` appears only inside a
   `NodeToolbar` at `:44`). A flowchart reads **top-to-bottom**; a diamond with one left and one
   right port physically cannot express "Yes ↓ / No →".
2. **The layout engine is left-to-right only and cycle-hostile in spirit**
   (`src/layout.ts:9–121`: longest-path layering, `GAP_X/GAP_Y` at `:82–83`, "cycle / safety:
   anything unassigned lands on layer 0" at `:49`). Flowcharts are full of back-edges (retry /
   loop-back) and merges; the current engine will silently flatten them to layer 0.
3. **The node body is an architecture card** — `kicker / title / sub / metric / unit` + icon
   (`src/DiagramNode.tsx:24–37`, styled mono/uppercase at `src/styles.css:252–275`). A flowchart
   node is *one centered sentence*, and the current body fights that.

The good news, and this is the honest headline of the whole study: **the hard, expensive machinery
is already there and is the right machinery.** Inline edge-label editing with a `center/start/end`
offset (`src/GoblinEdge.tsx:107, 241–270`), the container/child pattern with reparent-on-drop
(`src/App.tsx:787–830`), drop-on-edge-to-create-an-connected-node (`src/App.tsx:847–891`),
double-click-canvas shape search (`src/App.tsx:1764–1772` + `src/SearchPalette.tsx`), undoable
auto-layout with a CSS transition (`src/App.tsx:942–955`), and a `data.shape` dispatcher
(`src/shapes.tsx:25–27, 32`) — these are exactly the primitives a flowchart tool needs. What is
missing is a **flowchart preset that flips defaults** (vertical handles, vertical layout, cycles
allowed, label-only node body, 4 new shapes) — not a new editor.

Top 5 concrete recommendations are in §7.

---

## 1. The canonical flowchart SHAPE SET (ISO 5807 / de-facto conventions)

### 1.1 The standard itself

ISO 5807:1985 — *"Information processing — Documentation symbols and conventions for data, program
and system flowcharts, program network charts and system resources charts"* — is **still current**
("This publication was last reviewed and confirmed in 2019. Therefore this version remains
current"), 25 pages, published 1985-02, ICS 35.080 / 01.080.50.
Source: <https://www.iso.org/standard/11955.html> (verified live). It is a paid PDF (CHF 135); the
symbol semantics below are drawn from three independent implementations/guides that agree.

History for context: ANSI X3.5 (1963) → ISO adoption → ISO 5807 (1985), refreshed 1987;
<https://www.useworkspace.dk/en/blog/iso-5807-flowchart-symbols-guide>.

### 1.2 The shape table Diagram Studio is missing

`CORE` = needed by the vast majority of real flowcharts. `OPT` = present in the standard and in
draw.io/Mermaid/SmartDraw, but only occasionally used. "Current" column maps to
`src/shapes.tsx:9`.

| # | Symbol | Shape | Standard meaning | Class | Diagram Studio today |
|---|---|---|---|---|---|
| 1 | **Terminator** (start/end) | Oval / stadium / rounded pill | "Marks the beginning or end of a process… Every flowchart should have exactly one start symbol and at least one end symbol" | CORE | ✗ — `service` is a *rounded rect*, `external` is dashed; neither reads as a terminator |
| 2 | **Process** | Rectangle | "any processing operation, instruction, or action"; one logical operation, action verb | CORE | ✗ — `service` is the closest but carries kicker/sub/metric chrome |
| 3 | **Decision** | Diamond (rhombus) | "a conditional or branching point with two or more possible paths"; frame as a yes/no question; **label all output paths** | CORE | ✗ — nothing diamond-shaped |
| 4 | **Input/Output (data)** | Parallelogram | "data input or output operations… reading user input, displaying output, reading files"; distinguish from Document | CORE | ✗ — nothing skewed |
| 5 | **Document** | Rectangle with wavy bottom edge | "a physical or electronic document… generating reports, printing invoices" | CORE | ✗ |
| 6 | **Manual input** | Parallelogram/trapezoid with slanted top | "data manually entered by a user — keyboard input, form submissions" | OPT | ✗ |
| 7 | **Manual operation** | Trapezoid, base on top | a step performed by a human, not a system (Mermaid calls it `manual`, `trap-t`) | OPT | ✗ — `actor` is an ArchiMate actor badge, a different concept |
| 8 | **Delay** | Half-rounded rectangle (D-shape) | "a waiting period or intentional delay… always specify the duration" | OPT | ✗ |
| 9 | **Preparation** | Hexagon | "setup operations like loop initialization or parameter setting" | OPT | ⚠ partially — `gateway` is a hexagon, but it *means* API gateway/load balancer (`src/palette.ts:57–60`). Reusing it would collide meanings |
| 10 | **On-page connector** | Small circle | "connects flowchart sections on the same page… always label matching pairs with the same identifier (A, B, C or 1, 2, 3)" | CORE for anything > 1 screen | ✗ |
| 11 | **Off-page connector** | Pentagon ("home plate") | "the flow continues on another page"; include page number/document name | OPT | ✗ |
| 12 | **Predefined process / subroutine** | Rectangle with double vertical bars | "a named subprocess or routine defined elsewhere" | CORE (big diagrams) | ⚠ `group` is a *vpc/cluster boundary*, not a callable subroutine reference |
| 13 | **Database / stored data** | Cylinder | storage/retrieval; SmartDraw: "a list of information with a standard structure that allows searching and sorting" | CORE | ✅ already `database` |
| 14 | **Stored data (file)** | Parallelogram w/ curved right edge | non-DB storage: log files, CSV, cache | OPT | ⚠ `storage` (bucket) is a cloud-object-store concept |
| 15 | **Display** | Curved trapezoid / hexagon-ish | "output displayed on a screen" | OPT | ✗ |
| 16 | **Annotation / comment** | Bracket or open box | explanatory note not part of the flow | CORE-ish | ✅ already `note` + the `Text` label node (`src/palette.ts:68–71`) |
| 17 | **Merge** | Downward triangle | multiple branches converge into one path | OPT (usually just a line join) | ✗ |
| 18 | **Sort / Collate / Extract** | Specialised diamonds/triangles | ordered-set operations | OPT | ✗ — skip |
| 19 | **Cloud storage** | Cloud | cloud-service call | vendor-specific, not ISO | ✗ — and correctly so, since `external` covers "third party" |

Sources for rows 1–19: <https://www.useworkspace.dk/en/blog/iso-5807-flowchart-symbols-guide>
(per-symbol purpose / "when to use" / "common mistakes" / "best practice"),
<https://mockflow.com/blog/flowchart-meaning-and-symbols> (12-symbol cheat sheet with the
"On-page Connector = circle / Off-page Connector = pentagon" split),
<https://www.smartdraw.com/flowchart/flowchart-symbols.htm> (Start-End, Process, Document,
Decision, I/O, Manual Input, Preparation, Connector, Merge, Delay, Database, Display, Off-page),
<https://drawio-app.com/blog/flowchart-symbols-all-you-need-to-know/> (draw.io's own list:
"start shape, process shape, decision diamond, labeled connectors, document shape, multiple
documents shape, subprocess shape, manual input shape, data (I/O) shape, preparation shape, stored
data shape, manual operation shape, delay shape, display shape, and end shape").

### 1.3 Independent cross-check: Mermaid's machine-readable shape taxonomy

Mermaid v11.3+ ships a table of **semantic name → short name → alias**, which is the most useful
*implementation* reference because it is what a modern tool actually renders. Directly relevant
rows (verbatim from <https://mermaid.js.org/syntax/flowchart.html>, "Complete List of New Shapes"):

```
Data Input/Output  lean-r  in-out, lean-right      Decision        diam   decision, diamond, question
Data Input/Output  lean-l  out-in, lean-left       Delay           delay  half-rounded-rectangle
Document           doc     document                Display         curv-trap  curved-trapezoid, display
Manual Input       sl-rect manual-input, sloped-rectangle
Manual Operation   trap-t  inv-trapezoid, manual, trapezoid-top
Prepare Conditional hex    hexagon, prepare        Process         rect   proc, process, rectangle
Start              circle / sm-circ                 Stop            dbl-circ / fr-circ
Terminal Point     stadium pill, terminal          Subprocess      fr-rect subproc, subroutine
Data Store         datastore                          Database      cyl  cylinder, database, db
Text Block         text                                Multi-Document docs st-doc
```

Two notes worth carrying into the preset:

* Mermaid distinguishes **Start = circle / Stop = double circle** from **Terminal Point = stadium**.
  Practically, for a *generic* editor, offer the **stadium** (pill) and document "use double circle
  for a hard stop" — one shape, labelled honestly.
* Mermaid's default flowchart layout is **ELK**, not Dagre ("The default is ELK, which handles larger
  and more complex diagrams well"), with `layout: dagre` as the classic opt-out. This matters for §3.

---

## 2. How the studied tools handle branches, labels, swimlanes and terminals

### 2.1 Branch labels on decision outputs

**Ameliorate (OSS, read from source — the single most useful reference of the cluster).**
It is *not* a flowchart tool: its node types are an argument ontology
(`cause, problem, criterion, solutionComponent, benefit, effect, detriment, solution, obstacle,
mitigation, question, answer, fact, source, rootClaim, support, critique, custom` —
`src/common/node.ts:12–40`,
<https://github.com/amelioro/ameliorate/blob/main/src/common/node.ts>). But its **edge**
mechanics are exactly the branch-label mechanics a flowchart needs:

* Every edge always shows a label; the label defaults to the lower-cased relation name and is
  replaced by a user override: `const labelText = edge.data.customLabel ?? lowerCase(edge.type)`
  (`src/web/topic/components/Edge/DirectEdge.tsx:32`,
  <https://github.com/amelioro/ameliorate/blob/main/src/web/topic/components/Edge/DirectEdge.tsx>).
* The label is edited **in place** via `contentEditable` on the label `<Typography>`, committed on
  blur (`DirectEdge.tsx:36–48`). The label carries its own `bg-white leading-none` so edges never
  draw through it, and `nopan` so clicking the label does not pan the canvas (`DirectEdge.tsx:50–66`).
* **Labels are validated to be short**: `customLabel` is `max(30)` and must match
  `/^[a-z ]+$/i` — "customLabel should only contain letters and spaces"
  (`src/common/edge.ts:52–56`,
  <https://github.com/amelioro/ameliorate/blob/main/src/common/edge.ts>). **This is the single best
  idea in the cluster for flowchart branch labels**: branch labels ("Yes", "No", "Retry", "> 8")
  are short, and enforcing it prevents the classic flowchart failure of a paragraph floating mid-edge.
* The label is placed by the layout engine, not by string math: edges are handed to ELK with
  `labels: [{ text: edge.type, layoutOptions: {"edgeLabels.inline": "true"}, width:
  scalePxViaDefaultFontSize(labelWidthPx /* =115 */), height: 0 }]` and the comment explains the
  trick — giving labels **zero height** stops them inflating the layer gap while still letting ELK
  avoid horizontal overlap (`src/web/topic/utils/layout.ts:440–455`; `labelWidthPx` at `:63`).

**Typeform Logic Map** (showcase entry, `<https://reactflow.dev/showcase>` line 703) takes the
opposite, more literal approach: instead of free-text labels, a branch is a **rule object** attached
to an outgoing path — "Go to question 4 when question 2 is lower than 7", plus an explicit
**default branch** ("All other cases go to question 5"). Existing logic is surfaced by a branching
icon on the path itself, with Edit/Delete from the path
(<https://www.typeform.com/help/a/use-the-logic-map-to-add-logic-to-your-typeforms-5514792640916/>).
The transferable idea is the **default/else branch made explicit** — a flowchart decision with two
outgoing edges where neither says "otherwise" is the most common modelling bug.

**Stripe's docs flowchart** (showcase line 619; verified live in the DOM at
<https://docs.stripe.com/payments/checkout/how-checkout-works>) shows a third convention: it is a
sequence/flow hybrid where the **event name rides as a second line inside the action node**
(`Return Checkout Session` / `checkout.session.created`), and the four participants
(`Client, Server, Stripe API, Stripe Checkout`) are **narrow, 432-px-tall nodes** acting as lane
headers (measured in the live DOM: widths 29–70 px, height 432 px, evenly spaced ~150 px apart).
That is a cheap and effective way to fake swimlanes with plain nodes — see §2.2.

**Docugram** (<https://docugram.app/>, showcase line 259) is a text→flowchart generator with an
editor: "Offers several auto-layout options… Adjust the parameters by clicking and dragging", plus a
**"tidy" broom button** that "will align nodes along the same axis and generally improve the
appearance", and markdown in node bodies; nodes *and frames* (node groups) are dragged from the
sidebar (<https://docugram.app/help>). Sign-in is required to edit
(its `/editor` route redirects to `/sign-in` — verified in-browser), so I could not inspect its
decision labelling directly; **I am not claiming more than the help page states.**

### 2.2 Swimlanes / pools

Canonical definition: "A swimlane diagram is a type of flowchart that delineates who does what in a
process… horizontal or vertical 'swimlanes' of a particular employee, work group or department… also
known as a Rummler-Brache diagram or cross-functional diagram (swimlanes are sometimes called
functional bands)" (<https://lucid.co/diagram/swimlane/tutorial>). In **BPMN 2.0** the hierarchy is
stricter: a **pool** = one participant (organisation/system), a **lane** sits inside a pool and = a
role/department (<https://processmind.com/resources/docs/bpmn-building-blocks/pools-and-swimlanes>,
<https://www.crismo.io/blog/bpmn-lanes-vs-pools-guide>). Practical advice from Lucid: "horizontal
lanes are more practical given that desktop computer screens are wider than tall".

How the tools build them — and the two mechanically different answers:

* **draw.io / cross-functional flowcharts: lanes are *containers*.** "In draw.io, swimlanes use a
  **container shape** that organizes your process steps into labeled rows or columns. You can drag
  any flowchart shape into a lane, and the diagram will keep it grouped"
  (<https://drawio-app.com/blog/flowchart-symbols-all-you-need-to-know/>). Containers are
  *tables*: `Arrange → Insert Row Above / Insert Row After`, `Alt+Enter` duplicates a lane, the lane
  **auto-expands** when you drop a shape in, the target lane outlines in purple during the drag, and
  `Alt`/`Option`-drop *overlaps* a shape instead of parenting it. Selected lane + Delete deletes its
  contents (connectors survive, since they cross lanes)
  (<https://www.drawio.com/docs/diagram-types/swimlane-diagrams/>).
* **Stripe: lanes are *not* containers at all** — they are plain tall nodes used as column headers
  (measured above). Nothing is parented; the author just lines shapes up under the headers.

**The honest verdict for Diagram Studio:** it already has the container half —
`group` is a `parentId` container with `extent:'parent'`, and dragging a node inside a group's
absolute bounds reparents it, dragging it out releases it while preserving absolute position
(`src/App.tsx:787–830`). What is missing for lanes is (a) the group is a *free-floating* frame, not
a row in a shared **pool**, (b) it does not auto-grow to fit a dropped child, and (c) the layout
engine **excludes children of groups entirely** ("children of groups keep their parent-relative
position", `src/layout.ts:13`), so "Auto-arrange" would silently ignore the whole lane.

### 2.3 Terminal states

Across every source, terminals are the least controversial and most frequently *mistaken* symbol:
"Using multiple start points (creates ambiguity)", "Using rectangles instead of ovals"
(<https://www.useworkspace.dk/en/blog/iso-5807-flowchart-symbols-guide>), and draw.io's own
walkthrough colours its rounded-rect start green and end red *for legibility* while noting
"Rounded rectangle – a step in the process. Green to indicate the start, red to indicate the end"
(<https://drawio-app.com/blog/flowcharts/>). The convention worth encoding is therefore
**shape + colour + text**, all three: a stadium labelled "Start"/"End", green/red accent, and exactly
one start.

---

## 3. Interaction affordances worth taking

### 3.1 Quick-add next node ("add and connect in one step")

* **draw.io**: hover a shape → blue direction arrows appear → click one to add + connect a new shape;
  drag a shape from the library onto a hover arrow to do both in one gesture. "Most of the common
  flowchart shapes are available here" — i.e. the quick-add menu is *shape-aware*, not just "add a
  box" (<https://www.drawio.com/docs/manual/shapes/quick-add-shapes/> via
  <https://www.drawio.com/docs/diagram-types/swimlane-diagrams/>).
* **Ameliorate**: the same idea, but the quick-add buttons are **relation-aware**. Selecting a node
  reveals a button group above/below it (`src/web/topic/components/Node/FlowNode.tsx:170–180`), where
  the *common* relations are buttons and the rest hide behind an overflow menu — "Common add-node
  actions are shown as buttons, while uncommon ones stay in the overflow menu… to reduce clutter"
  (`src/web/topic/components/Node/AddNodeButtonGroup.tsx:183–230`). Each button's tooltip is
  generated from the relation itself: `Add Cause ('causes' this Problem)`, `Add Detriment (this
  Problem 'causes')` — verified live in the DOM of
  <https://ameliorate.app/playground> (`getDirectedRelationDescription`, `src/web/topic/utils/edge.ts:219–225`).
  The group also hosts a **fuzzy search over connectable nodes** (`fuzzysort.go`, with the matched
  characters bolded) so you can wire to an *existing* node from the same control
  (`AddNodeButtonGroup.tsx:31–130`).
* **Diagram Studio today**: `onConnectEnd` already creates-and-connects a node when you drop a
  connection on empty canvas (`src/App.tsx:847–891`) — but it always creates `PALETTE[0]`
  ("generic Service shape", `:871`), it is not undoable as one gesture (two separate
  `pushHistory()` calls, `:870` and `:882`), and the new node is deferred by a 30 ms
  `setTimeout` (`:880`) because it relies on the node existing in state. **Recommendation: turn this
  into a shape-picker popover at the drop point (the SearchPalette already exists and is already
  position-aware) and make the node+edge a single history entry.**

### 3.2 Branch-aware / flowchart-safe auto-layout

The layout landscape, stated plainly by React Flow itself
(<https://reactflow.dev/learn/layouting/layouting>):

| Library | Dynamic node sizes | Sub-flow layouting | **Edge routing** |
|---|---|---|---|
| Dagre | Yes | Yes¹ | No |
| D3-Hierarchy | No | No | No |
| D3-Force | Yes | No | No |
| **ELK** | Yes | Yes | **Yes** |

¹ Dagre has an open issue laying out sub-flows whose nodes connect outside the sub-flow.

For a **flowchart**, the row that matters is *edge routing*: a decision diamond with a No-branch that
loops back and merges later produces overlapping orthogonal runs, and only ELK routes edges
(`elk.edgeRouting`, plus `ports`). Ameliorate's production configuration is a good, working starting
point (`src/web/topic/utils/layout.ts:316–349`,
<https://github.com/amelioro/ameliorate/blob/main/src/web/topic/utils/layout.ts>):

```
"elk.direction": orientation              // "UP" in their case; "DOWN" for a flowchart
"elk.edgeRouting": "SPLINES"
"elk.layered.nodePlacement.strategy": "NETWORK_SIMPLEX"
"elk.layered.considerModelOrder.strategy": "PREFER_NODES"
"elk.layered.thoroughness": <n>
"elk.spacing.nodeNodeBetweenLayers" / "elk.spacing.nodeNode"  // separate X/Y per orientation
"elk.partitioning.activate": partition ? "true" : "false"     // partition by node type
"elk.separateConnectedComponents": ...                        // keep islands near or apart
```
…plus **fixed-order ports** so incoming and outgoing edges stay visually separated:
`portConstraints: "FIXED_ORDER"` with real `ElkPort`s declared `NORTH` (sources) and `SOUTH`
(targets) (`layout.ts:401–420, 489`). React Flow documents the same technique as "Elkjs Multiple
Handles": "configure elkjs to use specific handles (called 'ports' in elkjs)… the important things to
configure are unique ids for the handles / ports, the actual ports for elkjs with a correct side
property and `'org.eclipse.elk.portConstraints' : 'FIXED_ORDER'`"
(<https://reactflow.dev/examples/layout/elkjs-multiple-handles>).

Two more layout details worth stealing from Ameliorate:

* **New-node viewport follow**: after a node is added, `moveViewportToIncludeNode(newNode)` scrolls
  the canvas so the new node is visible (`src/web/topic/components/Diagram/Diagram.tsx:157, 235`).
  Diagram Studio's `onConnectEnd` drops a node wherever the pointer was and does *not* ensure it is
  on screen.
* **Focus/context**: selecting a node blurs everything that is not the node or its neighbours
  (`blur-[5px]` on `:not(:hover)` parts, `Diagram.tsx:277–293`). Diagram Studio has hover
  choreography (`src/choreography.ts`) but no "focus mode". For a 40-node flowchart this is the
  difference between usable and not.

**What Diagram Studio has instead:** a hand-rolled layered engine — longest-path layering from
source nodes, 4 barycenter ordering sweeps, fixed `GAP_X = 70 / GAP_Y = 24`, columns centred
vertically, orphans parked in a right-hand column
(`src/layout.ts:9–121`). It is impressively compact, but:
`src/layout.ts:49` — "cycle / safety: anything unassigned lands on layer 0" **is** the flowchart bug.
Every node inside a loop is "unassigned" by the Kahn-like sweep, so a retry loop collapses onto the
first layer. Also `src/App.tsx:921–924` can *block* cycles entirely (`noCycles` toggle), which for a
flowchart is wrong by default: loop-back is a legitimate, common flowchart construct.

### 3.3 Snapping ports, connection limits, hover-revealed handles

* **Handles that appear only when relevant**: Ameliorate keeps handles `invisible` at rest and shows
  them only on hover/select, or — the clever bit — while a connection is being dragged from the
  opposite side, detected with pure CSS instead of React state: "Show if an edge is being connected
  from a handle of the opposite type… reactflow's `useConnection` triggers thousands of selector
  checks because it checks on _every_ mouse move"
  (`src/web/topic/components/Node/NodeHandle.tsx:15–50`, using
  `visibleOnPartHoverSelectedClasses` from `src/web/topic/utils/styleUtils.ts:15`). Diagram Studio
  already does the hover half (`src/styles.css:289–305`: opacity 0 → 1 on
  `:hover / .selected / .connecting / .valid`), so only the "reveal the *matching* side while
  connecting" refinement is missing.
* **Connection limits per handle**: React Flow's `isConnectable` accepts "a boolean, a number (the
  number of max. connections the handle should have) or a callback"
  (<https://reactflow.dev/examples/nodes/connection-limit>). Useful for a flowchart where a diamond
  should have one incoming and 2–3 outgoing edges. Diagram Studio enforces an equivalent rule
  globally ("One input per node: ON — targets accept one incoming edge", `src/App.tsx:925–931,
  :1568–1572`) — but only as a *toggle with a Shift bypass*, which is the wrong granularity: it
  should be per-node-type (terminator: 1 in / 0 out; decision: 1 in / 2–3 out; connector: free).
* **Drop-on-edge insert** is already there (`src/App.tsx:847–891`), including "pick target: a node
  under the drop point, else a brand-new node" — that is the React Flow "Add Node On Edge Drop"
  pattern, documented at <https://reactflow.dev/examples/nodes/add-node-on-edge-drop>.
* **Duplicate-edge → ×N badge**: Diagram Studio bumps a `×N` count instead of adding a parallel edge
  (`src/App.tsx:896–916`). Worth keeping in a flowchart (two flows over the same pair of steps), but
  note it also **swallows genuine parallel branches** — a flowchart decision whose Yes and No both
  lead to the same next step needs either two distinguishable edges or two unambiguous labels.

### 3.4 Node body, text and annotation

* Mermaid supports markdown in node labels (`flowchart LR / markdown["\`This **is** _Markdown_\`"]`)
  and multi-line via `` `Line1\ Line 2` `` — a flowchart node often needs a second line
  (<https://mermaid.js.org/syntax/flowchart.html>).
* Ameliorate keeps node text short by convention, documented as a modelling rule: "Breakdown nodes
  should prefer being a single concept… exception: if multiple things would share the same exact
  relations… it's ok to list them in one node" (`docs-site/app/diagramming-tips/page.mdx`,
  <https://github.com/amelioro/ameliorate/blob/main/docs-site/app/diagramming-tips/page.mdx>).
* Typeform's Logic Map surfaces the branch rule *on the edge* with an icon and Edit/Delete, rather
  than requiring the user to hunt the form for the rule (link above).

### 3.5 Non-adoptions (honest SKIP list)

* **Docugram's AI text→flowchart** — the whole product is "paste text, get a flowchart"
  (<https://docugram.app/help>). It is a *generation* feature, not an editor feature; it needs an
  LLM endpoint and a schema. SKIP for a generic self-hosted editor (would also make the board
  non-deterministic and hard to test).
* **VisualFlow (GitHub Actions) node/edge model** — 3 node types (`workflow | job | step`) with a
  sidebar accordion that edits each node's fields (`name`, `on`, `runs-on`, `run`) and YAML export
  (`src/src/features/flow/components/menu/sidebar-menu.tsx`,
  <https://github.com/mitate-gengaku/VisualFlow>). Interesting as a *typed-hierarchy* example
  (workflow ⊃ job ⊃ step is a two-level containment), and its `create-node-button.tsx` is a one-line
  "Add" per type. But the shapes are domain-specific CI/CD cards and all edges are `type: "step"`
  with `animated: true` (`src/src/features/flow/config/initial/edge.ts`). ADAPT the sidebar-as-
  inspector idea only; SKIP the model.
* **VisualFlows** (<https://visualflows.io/, showcase line 744): a free whiteboard/sitemap-and-user-
  flow tool. I verified only two things reliably: it exposes a **light/dark switch through a URL
  parameter** — the share iframe is loaded as
  `https://prod.userflows.visualsitemaps.com/?lightMode=false` — and the board title bar reads
  `_SITEMAP / DARK`, i.e. **type and theme are both board-level metadata**. The canvas itself renders
  nodes only after interaction and its public bundle yields no shape vocabulary (my grep for
  `swimlane|diamond|parallelogram|terminator` in the JS bundle returned nothing usable). **I am not
  claiming anything about its shapes or lanes.** The board-level "type × theme" pairing is a
  genuinely useful data point for the preset system (see §4.2), and it corroborates what
  `C4-themes-presets.md §E.4` proposes.
* **Waldiez / Agentok / Flowise / Dify-class AI builders** — covered by the C3 cluster; from this
  cluster's viewpoint their node UX is a *workflow* model (typed ports, run status) not a flowchart
  model. Do not let their vocabulary leak into the flowchart preset.

---

## 4. Concrete proposal: the `flowchart` preset

### 4.1 Shapes to add (ADOPT / ADAPT / SKIP against the existing 9)

Add **4 new shapes** to the union and 4 more as cheap variations. All fit the existing
`ShapeFrame` contract exactly: normalised `viewBox="0 0 200 100"`,
`preserveAspectRatio="none"`, `vectorEffect="non-scaling-stroke"`, and colour from `--nc`
(`src/shapes.tsx:32–91`; `FILL` at `:30`; previews are a second 26×18 function at `:94`).

| Shape id | Geometry (200×100 frame) | Meaning / default label | Verdict |
|---|---|---|---|
| `terminator` | `<rect rx="50">` i.e. full pill (`y=1,h=98,rx=49`) | Start / End. Default fill tint, green for start, red for end | **ADOPT** |
| `decision` | `<path d="M100 2 L198 50 L100 98 L2 50 Z">` | Yes/No question; the diamond must be *taller* than a 190×60 node — set preset default node size 150×90 | **ADOPT** |
| `io` | `<path d="M36 2 H198 L164 98 H2 Z">` | Input / Output (parallelogram, leaning right) | **ADOPT** |
| `document` | rect + a wavy bottom edge (`M2 84 C 26 96, 50 72, 74 84 S 122 96, 146 74 S 182 92, 198 80`) | Document / report produced | **ADOPT** |
| `manual` | trapezoid, wide base on top: `M2 2 H198 L164 98 H36 Z` | Manual operation (human step) | **ADAPT** — reuse as both Manual input (inverted) and Manual operation via a `flip` flag, or ship two ids; the inverted trapezoid is also the standard *manual input/punch card* silhouette, so one shape with a note is defensible |
| `prep` | hexagon `M46 2 H154 L198 50 L154 98 H46 L2 50 Z` | Preparation / setup | **SKIP the new geometry, ADOPT as a relabel** — `gateway` is already this exact hexagon (`src/shapes.tsx:84–87`). Keeping two identical hexagons with different meanings is a trap; instead the flowchart preset *labels the palette row* "Preparation (hexagon)" pointing at `gateway`, or renames `gateway`→`hex` in the shape union with a preset-level display label. Do **not** ship two hexagons |
| `delay` | half-circle: `M2 2 H100 A 48 48 0 0 1 100 98 H2 Z` | Delay / wait — the ONLY shape that is not symmetric left/right, so its handles matter | **ADOPT (low priority)** |
| `connector` | `<circle cx="100" cy="50" r="46">` on a *shorter* node (default 64×54) | On-page connector, carries "A"/"B"/"1"/"2" | **ADOPT** — high value per line of code |
| `offpage` | pentagon `M2 2 H198 V72 L100 98 L2 72 Z` | Off-page connector / continue elsewhere | **ADAPT** — only if the board ever paginates; otherwise it is a connector with a note |
| `subprocess` | rect + two inner vertical rules (`M24 2 V98` and `M176 2 V98`) | Predefined process / named subprocess | **ADOPT** — cheap, and it is the correct answer to "this step is defined elsewhere" |
| `annotation` | reuses the existing `note` + free `Text` label node | Annotation / comment | **ADOPT as-is** (already present, `src/palette.ts:68–71`) |
| `database` | — | Storage / retrieval in the middle of a process | **ADOPT as-is** (already present) |
| `storedData` | rect with a curved right edge | file/log/cache | **SKIP** — overlaps `storage` and `database`; in a *flowchart* preset, if you need "data written somewhere", `database` + `document` cover ~95 % |
| `display`, `sort`, `collate`, `extract`, `merge` | — | Display output; ordered-set ops; convergent join | **SKIP** — the ISO set's tail. `display` is an I/O with a different picture; `merge` is normally just two edges joining a node. Adding them buys nothing and costs palette clutter |

**ADOPT/ADAPT/SKIP against the existing 9 shapes:**

* `service` → **ADAPT** as the flowchart **Process** body if a new `process` (plain rect) is not
  added. But the honest call is **ADOPT a plain `process` rect** and let `service` (rounded rect)
  stay architecture-only: a rounded rect and a pill (terminator) are too easy to confuse on a small
  screen, which is precisely the "Using rectangles instead of ovals" mistake the guides warn about.
* `database`, `note` → **ADOPT unchanged**.
* `actor` → **ADAPT**: in a flowchart, "who does this" belongs to a **lane**, not a shape. Keep
  `actor` for architecture; the flowchart preset should not put it in the palette.
* `gateway` → **ADAPT** (relabel as Preparation, per the table above) — never duplicate.
* `group` → **ADAPT** into the flowchart **lane**: keep the shape, change its defaults (see §4.3).
* `queue`, `storage`, `external` → **SKIP** in the flowchart palette (architecture vocabulary).

### 4.2 Preset definition (aligned with `C4-themes-presets.md §E.2` so the two merge cleanly)

```ts
// src/presets.ts — flowchart entry, in the DiagramPreset shape proposed by C4-themes-presets §E.2
{
  id: 'flowchart',
  label: 'Flowchart — process / decision',
  hint: 'ISO-5807 shapes, vertical flow, cycles allowed, one-sentence nodes',
  palette: [
    { label: 'Start / End', hint: 'stadium · terminator',        shape: 'terminator', colorKey: 'green'  },
    { label: 'Process',     hint: 'rect · action step',          shape: 'process',    colorKey: 'cyan'   },
    { label: 'Decision',    hint: 'diamond · yes / no',          shape: 'decision',   colorKey: 'amber'  },
    { label: 'Input / Output', hint: 'parallelogram · data',     shape: 'io',         colorKey: 'violet' },
    { label: 'Document',    hint: 'wavy base · produced doc',    shape: 'document',   colorKey: 'violet' },
    { label: 'Subprocess',  hint: 'double-bar rect · defined elsewhere', shape: 'subprocess', colorKey: 'cyan' },
    { label: 'Manual step', hint: 'trapezoid · done by a person', shape: 'manual',    colorKey: 'green'  },
    { label: 'Delay',       hint: 'D-shape · wait',              shape: 'delay',      colorKey: 'amber'  },
    { label: 'Connector',   hint: 'circle · jump on page',       shape: 'connector',  colorKey: 'slate'  },
    { label: 'Database',    hint: 'cylinder · read / write',     shape: 'database',   colorKey: 'violet' },
    { label: 'Lane',        hint: 'container · role / system',   shape: 'group',      colorKey: 'slate'  },
    { label: 'Note',        hint: 'plain annotation',            shape: 'note',       colorKey: 'slate'  },
  ],
  extraShapes: ['terminator','process','decision','io','document','subprocess','manual','delay','connector'],
  edges: {
    path: 'smoothstep',            // NOT bezier: orthogonal-ish reads as a process chart
    strokeKey: 'slate',
    dash: 'solid',
    markerStart: null,
    markerEnd: MarkerType.ArrowClosed,
    labelPresets: ['Yes', 'No', 'True', 'False', 'Retry', 'Timeout', 'Otherwise'],
    technField: false,             // no `techn` dim suffix here — flowcharts carry no technology
    flowAllowed: true,             // dots / dash / pulse stay available (message paths)
    maxLabelChars: 30,             // ← Ameliorate's rule (src/common/edge.ts:52–56)
  },
  layout: { engine: 'layered-tb', direction: 'TB', spacing: { x: 90, y: 70 } },
  nodes: { body: 'label-only', defaultSize: { w: 150, h: 60 }, decisionSize: { w: 150, h: 90 },
           handles: 'tb', allowCycles: true, connectionLimit: { terminator: {in: 1, out: 0} } },
  theme: { suggested: 'dark', canvas: 'dots' },
  caps: { subflow: true, proximityConnect: true, cyclePrevention: false, multiParent: false },
  templates: [ { id: 'approval', label: 'Approval request', nodes: [...], edges: [...] } ],
}
```

**Five switch points this preset must drive** (each maps to a real existing line of code):

| # | Switch | Current code | Change |
|---|---|---|---|
| 1 | Palette contents | `PALETTE` (`src/palette.ts:32–73`) hard-imported into the panel (`src/App.tsx:1474–1496`) | parameterise to `preset.palette` |
| 2 | Shapes offered | `SHAPES`/`ShapeFrame`/`ShapePreview` union (`src/shapes.tsx:9, 32, 94`) | append the 9 new `case`s; the preset shows a subset |
| 3 | **Handles: Left/Right → Top/Bottom** | `src/DiagramNode.tsx:126–132, 143–153, 163–181` (both handles hard-coded `Position.Left` / `Position.Right`) | make handle positions a per-node data field (`data.handles: 'lr' \| 'tb'`) rendered once in a shared `<NodeHandles/>`; keeps one node component (the C4 §E.1 "no fork" rule) |
| 4 | Edge defaults | the edge literal is repeated 4× (`src/App.tsx:57–58, 773, 886, 912`) | extract `makeEdge(source, target, preset)`; default `smoothstep` + `ArrowClosed` + `labelPresets` |
| 5 | Layout | `autoLayout` calls `layoutDiagram` directly (`src/App.tsx:942–955`); `layoutDiagram` is LR-only with fixed gaps (`src/layout.ts:82–83`) | add a `direction` parameter (swap axes + `GAP_X`/`GAP_Y`) at minimum; see §4.4 for the honest recommendation |

### 4.3 Lane defaults (the swimlane gap, concretely)

Reuse `group` — it already has a 44-px header banner with a title and sub-label
(`src/styles.css:962–986`, `.group-node` at `:318–334`) and it already parents on drop
(`src/App.tsx:787–830`). Flowchart mode needs three small changes:

1. **Pool parent.** Add an optional `pool` shape (or a `group` with `data.pool = true`) that holds
   lane groups and renders the role/participant label in the left gutter — the BPMN pool/lane split
   (<https://processmind.com/resources/docs/bpmn-building-blocks/pools-and-swimlanes>).
2. **Auto-grow.** A lane must expand when a child is dropped or moved inside it. React Flow's
   `expandParent` on children covers the drop case; the same flag keeps lanes from clipping children.
   draw.io's behaviour is the reference: "You'll see the outline of a swimlane turn purple - drop the
   shape, and the swimlane will automatically expand in size to include the new shape"
   (<https://www.drawio.com/docs/diagram-types/swimlane-diagrams/>).
3. **Layout must see lane children.** Today `src/layout.ts:13` drops every child of a group from the
   layout, and `src/App.tsx:949–953` skips any node not in the layout map ("children of a group are
   not in the layout and follow their parent"). In flowchart mode the layout must instead lay out
   **per lane** along the flow axis and pack lanes as bands. This is the one genuinely new piece of
   engineering in the whole proposal.

### 4.4 Starter template: "Approval request" (drop-in, existing schema)

Written in the exact current node/edge shape — `type:'goblin'`, `data:{shape,kicker,title,sub,
metric,metricUnit,icon,color}` (`src/DiagramNode.tsx:24–37`), edges as in `src/App.tsx:56–59`.
Under `nodes.body = 'label-only'` only `title` is rendered; `kicker/sub/metric` stay empty so the
same document round-trips through the architecture preset unchanged.

```ts
const flowchartApprovalStarter = {
  nodes: [
    // pool header (lane container), then two lanes
    { id:'pool', type:'group', position:{x:0,y:0},   style:{width:900,height:520},
      data:{shape:'group', title:'Purchase approval', sub:'pool · who does what', color:COLORS.slate} },

    { id:'laneMgr', type:'group', parentId:'pool', position:{x:20,y:60}, style:{width:860,height:150},
      data:{shape:'group', title:'Requester',  sub:'lane · role', color:COLORS.slate} },
    { id:'laneFin', type:'group', parentId:'pool', position:{x:20,y:230}, style:{width:860,height:150},
      data:{shape:'group', title:'Finance',    sub:'lane · role', color:COLORS.slate} },

    // flow — top to bottom
    { id:'n1', type:'goblin', parentId:'laneMgr', position:{x:60,y:40},
      data:{shape:'terminator', title:'Start',  kicker:'', sub:'', metric:'', icon:'', color:COLORS.green} },
    { id:'n2', type:'goblin', parentId:'laneMgr', position:{x:60,y:150},
      data:{shape:'process',    title:'Submit purchase request', color:COLORS.cyan} },
    { id:'n3', type:'goblin', parentId:'laneMgr', position:{x:240,y:150},
      data:{shape:'io',         title:'Attach quote',            color:COLORS.violet} },
    { id:'n4', type:'goblin', parentId:'laneMgr', position:{x:420,y:140},
      data:{shape:'decision',   title:'Amount > 1,000?',          color:COLORS.amber} },
    { id:'n5', type:'goblin', parentId:'laneFin', position:{x:600,y:40},
      data:{shape:'manual',     title:'Finance review',           color:COLORS.green} },
    { id:'n6', type:'goblin', parentId:'laneFin', position:{x:600,y:150},
      data:{shape:'decision',   title:'Approved?',                color:COLORS.amber} },
    { id:'n7', type:'goblin', parentId:'laneMgr', position:{x:780,y:150},
      data:{shape:'document',   title:'Issue purchase order',     color:COLORS.violet} },
    { id:'n8', type:'goblin', parentId:'laneMgr', position:{x:780,y:40},
      data:{shape:'terminator', title:'End — approved',           color:COLORS.green} },
    { id:'n9', type:'goblin', parentId:'laneMgr', position:{x:420,y:300},
      data:{shape:'note',       title:'Rejections must state a reason', color:COLORS.slate} },
    // connector pair: keeps the No-branch from crossing the lanes
    { id:'c1', type:'goblin', parentId:'laneMgr', position:{x:180,y:140},
      data:{shape:'connector', title:'A', color:COLORS.slate} },
    { id:'c2', type:'goblin', parentId:'laneMgr', position:{x:180,y:80},
      data:{shape:'connector', title:'A', color:COLORS.slate} },
  ],
  edges: [
    { id:'e1', type:'goblinEdge', source:'n1', target:'n2' },
    { id:'e2', type:'goblinEdge', source:'n2', target:'n3' },
    { id:'e3', type:'goblinEdge', source:'n3', target:'n4' },
    { id:'e4', type:'goblinEdge', source:'n4', target:'n5', label:'Yes', data:{shape:'smoothstep', offset:'start'} },
    { id:'e5', type:'goblinEdge', source:'n4', target:'n7', label:'No',  data:{shape:'smoothstep', offset:'end'} },
    { id:'e6', type:'goblinEdge', source:'n5', target:'n6' },
    { id:'e7', type:'goblinEdge', source:'n6', target:'n7', label:'Yes' },
    { id:'e8', type:'goblinEdge', source:'n6', target:'c1', label:'No' },
    { id:'e9', type:'goblinEdge', source:'c2', target:'n2' },     // ← the loop-back edge
    { id:'e10',type:'goblinEdge', source:'n7', target:'n8' },
  ],
  // every edge inherits: stroke COLORS.slate, markerEnd ArrowClosed 14×14, data.offset 'center'
};
```

Every element in that template is legal in today's format **except** the shapes (new) and
`parentId` on a lane inside a pool (already supported — `src/App.tsx:798–815` handles nesting one
level; a pool→lane→node two-level nest needs verifying, which is a concrete spike for the
implementer). The `Yes`/`No` labels use the existing inline label editor and `offset`
(`src/GoblinEdge.tsx:107, 241–270`), and `e9` is the loop-back edge that today's layout engine
mishandles — which is why this template is also the layout regression test.

### 4.5 Node-body change (the smallest high-impact edit)

`data.body: 'card' | 'label-only'`. In `label-only`, `DiagramNode` renders only
`<div className="node-title">` centred, with CSS
`justify-content:center; text-align:center; font-size:13.5px` and no kicker/sub/metric block
(`src/DiagramNode.tsx:166–179`; current card styles `src/styles.css:252–275`). Two reasons this
matters: (a) a flowchart step is a verb phrase, and a mono uppercase kicker above it reads as
machinery; (b) the `metric` line renders at 20px/700 in the node's accent colour
(`src/styles.css:271–275`) — in a flowchart there is no metric, and a user who never opens the
inspector would still see an empty slot.

### 4.6 Theme note (flowchart-specific, feeds the theming cluster)

C4-themes-presets covers tokens. Two flowchart-specific constraints: (1) the shape fill is
`color-mix(in srgb, var(--nc) 9%, transparent)` (`src/shapes.tsx:30`) — at 9 % a diamond and a
rounded rect are nearly the same silhouette in *light* mode, so the flowchart palette must use
**darker inks** in light mode and the decision must not be the only 9 %-filled shape on screen;
(2) terminal colour is *semantic*, not decorative — green start / red end (draw.io's own habit,
<https://drawio-app.com/blog/flowcharts/>), which means the flowchart preset should map
`terminator` to `--green` and *a red token that does not exist yet* in `src/styles.css:4–15`
(`--green: #4ade80` exists; there is no `--red`). Add one.

---

## 5. What is NOT worth adding (honest list)

* **ISO 5807's tail symbols** (sort, collate, extract, merge, display, multi-document, internal
  storage, paper tape, manual loop, loop limit). They are real, they are in every "19 symbols" list,
  and in 15 years of practice almost nobody draws them. Palette clutter is the enemy of a tool that
  wants to be usable by other people. Add them as an optional "ISO 5807 extended" shape group if
  ever, not in the core flowchart palette.
* **BPMN** (pools/lanes semantics, gateways, events, message flows). BPMN is a different, stricter
  standard with its own rules (<https://www.bpmn.org/>; lucid's BPMN element split: flow objects /
  connecting objects / artifacts). Mixing BPMN and ISO 5807 in one palette is explicitly warned
  against: "It's better to stick to one standard per diagram to avoid confusion"
  (<https://www.useworkspace.dk/en/blog/iso-5807-flowchart-symbols-guide>). The flowchart preset
  should implement *swimlanes as containers* and stay notation-agnostic.
* **AI text→flowchart generation** (the Docugram/VisualFlow premise). SKIP, reasons in §3.5.
* **Per-node shape-replacement-by-drag** (draw.io's "replace" arrow). Nice, but Diagram Studio's
  inspector already has a `shape` `<select>` over `SHAPES` (`src/App.tsx:2155–2160`) — that is
  enough for v1.

---

## 6. Verdict table (one line each, mapped to code)

| Finding | Source | Verdict |
|---|---|---|
| Add terminator / process / decision / io / document / subprocess / manual / delay / connector shapes | ISO 5807 + draw.io + Mermaid | **ADOPT** — 9 new `case`s in `ShapeFrame` + `ShapePreview` (`src/shapes.tsx:32, 94`), one `Shape` union entry each (`:9`) |
| Preparation hexagon | ISO 5807 | **ADAPT** — relabel the existing `gateway` hexagon (`src/shapes.tsx:84–87`); do not ship a second hexagon |
| Top/Bottom handles per node | every flowchart reads T→B; current code is L/R only (`src/DiagramNode.tsx:126–181`) | **ADOPT (blocker)** — parameterise handle Position by `data.handles` |
| Label-only node body | flowchart step = one verb phrase | **ADOPT** — `data.body` variant, reuses `.node-title` (`src/styles.css:256–260`) |
| Verdict: shape + colour + exactly one Start | `useworkspace.dk` common-mistakes, draw.io | **ADOPT as preset guidance** (`guidance.requireLabel`, one-start nudge) |
| Edge labels default to a short word, ≤30 chars, letters+spaces | Ameliorate `src/common/edge.ts:52–56` | **ADOPT** — validator on the existing inline editor (`src/GoblinEdge.tsx:241–270`) |
| `labelPresets` dropdown (Yes/No/True/False/Retry/Otherwise) | draw.io + Typeform default-branch | **ADOPT** — new field, no new component |
| Explicit default/else branch on a decision | Typeform Logic Map | **ADOPT as guidance** — palette hint + a template that models it (`e5` above) |
| Event/annotation as a second line inside the node | Stripe docs flowchart (live DOM) | **ADAPT** — allow a `sub` line in `label-only` mode |
| Quick-add shape picker at the drop point | draw.io quick-add, Ameliorate relation buttons, RF "Add Node On Edge Drop" | **ADOPT** — replace the hard-coded `PALETTE[0]` (`src/App.tsx:871`) with the existing `SearchPalette` at the drop position; single history entry |
| Hover-revealed matching handles while connecting | Ameliorate `NodeHandle.tsx:15–50` | **ADOPT (cheap)** — Diagram Studio already has the hover half (`src/styles.css:289–305`) |
| Per-node connection limits | RF `isConnectable` numbers | **ADOPT** — replace the global one-input toggle (`src/App.tsx:925–931`) with per-shape limits |
| Auto-grow lane containers + purple drop-target outline | draw.io swimlanes | **ADOPT** — `expandParent` on children + a highlight class on the group (`src/App.tsx:787–815`) |
| Layout must lay out lane children | this is the real gap (`src/layout.ts:13`; `src/App.tsx:949–953`) | **ADOPT + spike** — per-lane layout bands |
| ELK with real ports (`FIXED_ORDER`, NORTH/SOUTH) + edge labels with `edgeLabels.inline`, height 0 | Ameliorate `src/web/topic/utils/layout.ts:316–349, 401–420, 440–455, 489`; RF Elkjs Multiple Handles | **ADOPT** — replaces the hand-rolled engine for the flowchart preset only |
| Cycles must be allowed | ISO 5807 retry/loop patterns (`useworkspace.dk`); today: `noCycles` default off but the layout flattens loops (`src/layout.ts:49`) | **ADOPT** — preset sets `cyclePrevention: false` **and** the flowchart layout must place back-edges, not collapse them |
| `smoothstep` as the default edge path (not bezier) | draw.io/Ameliorate ortholinear process charts | **ADOPT** — one `preset.edges.path` value; both generators already exist (`src/GoblinEdge.tsx:88–100`) |
| "Tidy" / multiple auto-layout options | Docugram help | **ADAPT** — one "Auto-arrange" button today (`src/App.tsx:1558`); a TB/LR toggle is enough |
| AI generation from text | Docugram | **SKIP** — needs an LLM endpoint; non-deterministic |
| BPMN pools/gateways/events | bpmn.org | **SKIP** — different standard; mixing notations is a documented anti-pattern |
| Sort / collate / extract / merge / display symbols | ISO 5807 tail | **SKIP** — palette clutter |

---

## 7. Top recommendations (priority order)

1. **Vertical handles are the blocker.** Make `Position.Top`/`Position.Bottom` a per-node choice
   (`data.handles`) rendered in one shared handle block, and give the flowchart preset `'tb'`.
   Without this, no amount of new shapes produces a readable flowchart. (`src/DiagramNode.tsx:126–181`)
2. **Replace the hard-coded `PALETTE[0]` drop-create with a shape picker, and make node+edge one
   undo step.** The machinery already exists (`src/SearchPalette.tsx`, `App.tsx:847–891`,
   `:1764–1772`); this is the single biggest usability win per line changed.
3. **Ship the 9 flowchart shapes + a `label-only` node body + `smoothstep`/short-label edge defaults
   as one `flowchart` preset**, using the `DiagramPreset` type already specified in
   `C4-themes-presets.md §E.2` so the two clusters don't invent competing shapes.
4. **Fix loops before shipping the preset.** Either add a `direction`-aware path through
   `layoutDiagram` that does not collapse back-edges to layer 0 (`src/layout.ts:49`), or adopt ELK
   with fixed-order ports for the flowchart engine (Ameliorate's config is copy-ready). Ship the
   §4.4 approval template as the regression test — it contains a loop-back edge on purpose.
5. **Lanes = `group` + two additions** (`expandParent` auto-grow, and a layout that sees lane
   children), with the pool/lane split borrowed from BPMN's *containment* model only — not its
   notation. Note `src/layout.ts:13` currently excludes group children from layout, so "Auto-arrange"
   would silently skip a whole swimlane until this is addressed.

---

## 8. Cleanup note

Research artifacts: sparse clone `/tmp/ame` (ameliorate, 5.3 MB) and two downloaded JS bundles
(`/tmp/vf.js`, `/tmp/vf2.js`, 1.6 MB) — **~7 MB total, deleted after this report**; disk checked with
`df -h /` before and after (68 GB free → unchanged). No large repo was cloned; Dify / LangFlow /
n8n / Flowise were deliberately not touched (their node UX belongs to the C3 cluster anyway).
VisualFlow and Waldiez internals were read via raw GitHub file views, not clones.
