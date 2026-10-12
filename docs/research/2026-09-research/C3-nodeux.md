# C3 — AI workflow builders & mindmap/knowledge tools: generic NODE-UX and TYPED-EDGE patterns for Diagram Studio

Research cluster: the React Flow showcase tools with the richest node UX — AI/workflow builders
(Dify, LangFlow, Flowise, Flow-Like, Dafthunk, Waldiez, Agentok, ToolJet, Datablocks, OneSignal
Journeys, Primer, n8n) plus the mindmap/knowledge ones (Heuristica, MindSnap, Traverse, Clay Read,
JSON Sea, Bit Cloud, Ideation Studio, Ameliorate).

Target: `/home/harvey/projects/tech-goblin/lab/diagram-studio` (React 19 + Vite 5 + `@xyflow/react` v12).
Shape list, tokens and existing features are per `SHARED-BRIEF.md`; every claim below is tagged
**ADOPT / ADAPT / SKIP** against them.

Method: docs sites, live apps, and *raw source reads* (GitHub raw/API). Shallow clones were made only
for small repos (`dafthunk` 28 MB, `waldiez` 61 MB, `ameliorate` 8 MB, `react-flow-mindmap-app` 0.4 MB,
`studio-client` 6.5 MB → combined `/tmp/c3` = 96 MB, well under GB scale; deleted — see cleanup note at
the end). No dify/langflow/n8n clones: their relevant files were read individually from
`raw.githubusercontent.com`.

---

## 0. Executive summary

| Pattern | Best source | Verdict |
|---|---|---|
| Typed/labelled ports with in-handle type icon | Dafthunk `TypeBadge` | **ADOPT** (opt-in via preset) |
| Port colour = data type | Langflow port colours | **ADOPT** |
| Connection validity feedback on the *dragging* line (green/red/neutral) | Dafthunk `WorkflowConnectionLine` | **ADOPT** |
| Type compatibility as one shared module + human-readable refusal text | Dafthunk `parameter-compatibility.ts` | **ADOPT** |
| Node status badges (running/success/error/skipped/idle) | Dify `NodeStatusIcon` + `NodeRunningStatus` | **ADOPT** |
| Status carried on node border *and* handles *and* edges (incl. gradient edge) | Dify `custom-edge.tsx`, `utils/edge.ts` | **ADOPT** (ADAPT: no runtime yet → manual) |
| Hover/select node toolbar with a run-this-step button | Dify `node-control.tsx` | **ADAPT** (replace "run" with "preview/export subtree") |
| Inline node configuration (widget inside the node body) | Dafthunk widget registry | **ADAPT** |
| Node run/preview of the last output | Langflow *Run component / Inspect*, Dify Variable Inspector | **SKIP** (no execution engine) |
| Collapsed vs expanded node bodies | Dify `_base` + Langflow `NodeDescription` | **ADOPT** (a "compact card" toggle) |
| Node-as-pill overview mode (second renderer of the same graph) | Dafthunk `WorkflowOverviewNode` | **ADOPT** |
| Grouping / frames (Ctrl+G, collapse, description, expand-all) | n8n Canvas Groups | **ADOPT** |
| Sticky notes behind nodes as soft grouping | n8n sticky notes, Flowise `StickyNote` | **ADOPT** |
| Comments/threads anchored to the canvas | Dify `comment/` | **ADOPT** (lightweight version) |
| Semantic arrow shapes per relation kind | Ameliorate `EdgeArrow` | **ADOPT** |
| Port-level add-menu ("+ on a free handle / mid-edge") | Dify `node-handle.tsx`, `custom-edge.tsx` | **ADAPT** |
| Keyboard-centric creation (Tab child, Enter sibling) | MindMup / Visio / Obsidian mindmap-editor | **ADOPT** |
| Radial/auto-grow layout for trees | React Flow mindmap tutorial + dagre/`d3-hierarchy` | **ADOPT** (via the planned diagram-type presets) |
| Collapse subtrees / focus+context (show node + neighbours, dim others) | Ameliorate `CompressedNode`, `showNodeAndNeighbors` | **ADOPT** |
| Flow State / variables / tool-calling / MCP / vector stores / LLM nodes | Dify, Flowise, Flow-Like | **SKIP** — domain-specific |
| Runtime execution, retries, logs, audit | all AI builders | **SKIP** — out of scope |

---

## 1. The richest GENERIC node-UX patterns

### 1.1 Typed handles / ports — colour-coded, labelled input/output/trigger

**Dafthunk** has the most complete *self-describing port* implementation of anything in this cluster.
Its `TypeBadge` renders the handle itself as a small type glyph: the `<Handle>` contains a lucide icon
chosen from the parameter's type (`string → Type`, `number → Hash`, `boolean → Check`, `blob → File`,
`json → Braces`, `secret → Lock`, `image/audio/video/document/gltf`, `database/dataset/queue/email`
and the integration types, `any → Asterisk`), and the label text sits next to it, monospaced.
Source: `apps/app/src/components/workflow/workflow-node.tsx` lines 118–270 (raw view:
`https://raw.githubusercontent.com/dafthunk-com/dafthunk/main/apps/app/src/components/workflow/workflow-node.tsx`).

Four states are encoded visually in that one badge:

- **has value or is connected** → handle background filled (`bg-neutral-200 dark:bg-neutral-700`),
  icon text in the primary colour;
- **required input, empty and unconnected** → icon turns red (`isRequiredAndEmpty`);
- **accepts multiple connections** (`parameter.repeated`) → an extra 20×20 px ring is painted behind
  the handle;
- **disabled / read-only flow** → `isConnectableStart={!disabled}` and the click handler early-returns.

**Langflow** is the canonical *colour = data type* reference, and it is documented as a product rule,
not an accident: "Component port colors indicate the data type ingested or emitted by the port" with a
published table — JSON red, Table pink, Embeddings emerald, LanguageModel fuchsia, Memory orange,
Message indigo, Tool cyan, unknown/multiple grey. Ports also support **dynamic ports** (typing
`{var}` into a Prompt Template field adds an input port) and **output type selection** (a component
with `group_outputs=False` lets the user pick which type the single output port emits).
Source: https://docs.langflow.org/concepts-components (§"Component ports", "Port colors",
"Dynamic ports", "Output type selection").
The React side paints a neon glow on the port when hovered/connecting —
`src/frontend/src/CustomNodes/GenericNode/components/handleRenderComponent/index.tsx`.

**Dify** splits handles by *role* rather than type: `NodeTargetHandle` / `NodeSourceHandle`
(`web/app/components/workflow/nodes/_base/components/node-handle.tsx`). Two ideas there are pure gold
and independent of AI:

1. the handle itself carries the run status as a background colour
   (`after:bg-workflow-link-line-success-handle` / `-error-handle` / `-failure-handle`), and
2. an **unconnected handle is a button**: clicking it opens the block selector pre-filtered to the
   node types that are legal *before* this node. The selector is rendered invisibly and fades in on
   node hover/selection (`group-hover:opacity-100`, `data.selected && 'opacity-100'`).
   The legality source is `useAvailableBlocks()` (`hooks/use-available-blocks.ts`), which returns
   `availablePrevBlocks` / `availableNextBlocks` and returns `[]` for the Start/Trigger nodes so those
   render **no** target/source handle at all (`(data.type === BlockEnum.Start || Trigger*) && 'opacity-0'`).

**Waldiez** shows the four-sided handle pattern worth knowing: every agent node gets a
`source`/`target` handle pair on each of Top/Bottom/Left/Right, offset from the midpoint so the two
roles don't overlap (Top: target at `left:75%`, source at `left:25%`; mirrored on Bottom; Left/Right
use `top`), and a "group_manager" node type gets **target handles only** — a role-restricted node.
`src/waldiez/containers/nodes/agent/handles.tsx`.

**Ameliorate** solves the "handles are visual noise" problem elegantly: handles are rendered
`invisible` and become visible only (a) on node hover/selection and (b) when a connection is being
dragged from the *opposite* side — implemented with CSS `:has()` on the nodes layer, deliberately
avoiding React Flow's `useConnection` because it "triggers thousands of selector checks".
`src/web/topic/components/Node/NodeHandle.tsx`. Also: they always render at least one handle per side
even when the layout engine produced no port, because "reactflow ports are currently needed in order
to create connections."

**Flowise** goes the other way — labels *outside* the handle with a red `*` for required inputs, and
anchors distributed evenly down the node's height by measuring the DOM
(`const spacing = clientHeight / (getAnchorOptions(options).length + 1)` then
`updateNodeInternals(data.id)`), which is the standard fix for dynamic handles drifting after a
re-render. `packages/ui/src/views/canvas/NodeInputHandler.jsx` (~line 851) and `NodeOutputHandler.jsx`
(anchor maths at the top of the file).

**Flow-Like** documents the typed-pin model as a first-class concept, and two details are worth
copying verbatim into a design vocabulary:
pins are **direction-bound** ("Two pins labeled `Message` are incompatible if both accept or both
produce a value"; Studio rejects self-connections), and **execution pins are drawn differently from
data pins** — currently diamond-shaped, "color and styling may change; the Execution type defines
their behavior". It also separates *pure* nodes (no execution pins, evaluated on demand) from impure
ones. Sources: https://book.flow-like.com/part-2/05-nodes-pins-wires-execution/ (§5.2–5.4).

> **ADOPT** — typed ports, but *opt-in*, driven by the diagram-type preset. Add an optional
> `port: {id, dir: 'in'|'out'|'trigger', type: string, label?: string, required?: boolean, repeated?: boolean}`
> to `NodeKind`, and render `Handle id=…` for each. Today `DiagramNode.tsx` hard-codes exactly one
> target-left and one source-right handle with no `id`, so a single generic node can keep those two
> as the default while a "flowchart"/"data pipeline" preset switches the node into multi-port mode.
> Type→colour must reuse the existing token set (`--acc #f54e00`, `--green #4ade80`, `--sel #3b82f6`,
> plus cyan/violet/amber/slate already in `COLORS` in `src/palette.ts`) rather than importing
> Langflow's 8-colour palette — that palette is designed for dark UI and would fight `--nc`.
> **ADOPT** the "handle as button when unconnected" idea: on a generic editor it becomes "click an
> empty handle → insert-palette opens filtered to shapes legal on that side" (the app already has a
> searchable insert palette, `D1`, and a cycle guard, `F7`).
> **ADOPT** the invisible-until-hover handle treatment for the *diagram types where handles are
> meaningless* (mindmap, ERD) — today's glow handles are a deliberate feature for architecture
> diagrams, so this must be scoped per preset, not global.

### 1.2 Node status badges (running / success / error / retrying / idle / skipped)

This is the most-reused idea across the whole cluster and the one with the cleanest generic core.

- **Dify** — `NodeRunningStatus` enum has ten values: `not-start, waiting, listening, running,
  succeeded, failed, exception, retry, stopped, paused`
  (`web/app/components/workflow/types.ts` line 386). `NodeStatusIcon` maps them to glyph+colour:
  succeeded → filled check (success), failed → warning triangle (warning), stopped/exception → filled
  alert (warning-secondary), running → **spinning** loader (`animate-spin`, accent).
  `nodes/_base/components/node-status-icon.tsx`.
  The status is then propagated to *three* surfaces:
  - **node border** — `_base/node.tsx` computes `showRunningBorder / showSuccessBorder /
    showFailedBorder / showExceptionBorder` and applies `border-state-accent-solid!`,
    `border-state-success-solid!`, `border-state-destructive-solid!`,
    `border-state-warning-solid!`; everything else gets `border-transparent`.
  - **edge stroke** — `utils/edge.ts::getEdgeColor(status, isFailBranch)`. When both endpoints have a
    terminal status, `custom-edge.tsx` switches the stroke to a **linear gradient** rendered by
    `custom-edge-linear-gradient-render.tsx` (start colour = source status, stop colour = target
    status) — you see "green → red" on a failed hop at a glance.
  - **edge opacity** — `opacity: data._dimmed ? 0.3 : data._waitingRun ? 0.7 : 1`, plus
    `strokeDasharray: '8 8'` for a temporary/tentative edge. `custom-edge.tsx`.

- **Dafthunk** — `NodeExecutionState = 'idle' | 'executing' | 'completed' | 'error' | 'skipped' |
  'pending'` (`workflow-types.ts`). Border **and** every port's border take the status colour
  (yellow-400 executing/pending, green-500 completed, red-500 error, blue-400 skipped, blue-500
  selected, border idle). Its `WorkflowOverviewNode` compresses all of that into a right-aligned
  verdict chip inside a 40 px pill: filled check = completed, X = error, minus = "unrun" (its comment:
  "a run that neither completed nor failed a node reads as 'not run'"). It keeps the real handles but
  collapses them to `opacity-0 pointer-events-none size-1` "because the edges reference handle ids and
  would vanish without them" — a genuinely useful trick.
  `workflow-overview-node.tsx`; `workflow-node.tsx` 477–735.

- **Langflow** — `BuildStatus { BUILDING, TO_BUILD, BUILT, INACTIVE, ERROR }`
  (`src/frontend/src/constants/enums.ts`). `getSpecificClassFromBuildStatus()` turns it into a border
  *plus* a ring (`border-foreground … ring-foreground` while building, `border-destructive …
  ring-destructive` on error/invalid) — a two-layer emphasis that survives a busy background.
  `CustomNodes/helpers/get-class-from-build-status.ts`. `NodeStatus/index.tsx` adds a separate
  "frozen" border and a hover-only icon.

- **n8n** (for contrast) has no node status language at all on the canvas beyond a running spinner —
  worth noting so we don't over-copy.

> **ADOPT** — a `status?: 'idle' | 'running' | 'success' | 'error' | 'skipped'` field on `NodeKind`
> plus a `StatusBadge` in the node's kicker row, reusing the existing tokens: `--green` for success,
> `--acc` for running (with the existing `--nc` glow animation technique, which already shows the
> codebase can do a keyframe driven by a CSS variable), and a new `--red` token for error (there is
> today `--green` but no error colour). **ADAPT** the "three surfaces" propagation: without a runtime
> the honest use is *manual/authoring* status — "draft / needs review / approved / blocked", which is
> exactly what a shared diagram needs. Keep the border+ring combination from Langflow; it reads
> better than a border alone on `--bg #0b0b0d`.
> **ADOPT** the gradient edge (source status → target status) as an optional edge style — the
> `GoblinEdge` component already renders `<BaseEdge>` with a computed `stroke`, so a
> `<linearGradient>` in the edge's SVG is a ~15-line change and no new dependency.
> **ADOPT** Dafthunk's "unrun = minus, not a failure colour" rule: three states must be visually
> distinct (never-run ≠ failed).
> **SKIP** `retry` / `paused` / `listening` as distinct *node* states; they belong to a runtime
> panel, not to a shape.

### 1.3 Inline node configuration

Two different answers in this cluster:

- **Inline widgets (Dafthunk).** Each node type can declare a widget rendered *inside* the node body,
  between the header and the ports: a text field, a number input, a slider, a boolean, a cron editor,
  a model picker dialog, and — most interestingly — **dynamic-input widgets** that add or remove
  *ports* at runtime. `DynamicInputsWidget` (`widgets/input/dynamic-inputs-widget.tsx`) appends an
  input cloned from the *last* dynamic input (with a comment explaining that cloning "whichever input
  happens to come first" gave new slots the wrong type and required flag), and on removal it
  **deletes every edge attached to that input before the port disappears**. `SwitchForkCasesWidget`
  does the same for a paired case-in/case-out port. A `WidgetRegistry` maps node type → component +
  which input field it owns; fields it manages are hidden from the generic parameter list.
  `widgets/registry.ts`. The node also exposes a `nodrag` class on the widget wrapper so dragging the
  slider doesn't drag the node (`className="px-0 py-0 nodrag border-b"`).

- **Side-panel inspection (Langflow, Dify, Flowise, Waldiez, ToolJet).** Selecting a node shows *all*
  parameters, including advanced ones, in a right-hand panel (Langflow "component inspection panel",
  `docs.langflow.org/concepts-components`); the node itself shows only required/common options. Dify
  routes the *node-level* actions (run this step, change node, more) into a hover dropdown
  (`node-control.tsx` + `node-actions-menu/`). Waldiez takes it further: the agent node body is a
  summary (model logos + tool icons, capped by available height) and all editing happens in a **modal
  with tabs** (`containers/nodes/agent/modal/tabs/*`).

Diagram Studio already has the right panel (Content / Metrics / Style / Align / Distribute / Color)
and already edits `kicker / title / sub / metric / metricUnit / icon / color / shape` there.

> **ADOPT (small)** — an inline-editable *title* on the node itself: double-click the title text to
> edit in place, `Enter` commits, `Esc` cancels. Diagram Studio has this pattern for **edges** already
> (`GoblinEdge` inline label edit) but not for nodes, and every mindmap tool in this cluster plus
> Langflow's `NodeName` (`CustomNodes/GenericNode/components/NodeName/index.tsx` — commit on Enter,
> revert on Escape, re-select after commit) treat it as table stakes for a node-centric editor.
> **ADAPT** the widget registry idea into a **field-visibility preset** rather than an embedded form:
> Dafthunk's inline widgets exist because each node type has machine-typed parameters. Diagram Studio
> shapes are generic (kicker/title/sub/metric), so an embedded form would be a form for its own sake.
> What *is* worth taking: a per-shape "which fields does this shape show" map (a `note` needs no
> metric; a `database` node in an ERD preset needs a field list). That is the same registry, pointed
> at the existing fields.
> **SKIP** inline code/model pickers, credential dialogs, schema-compose/exract widgets — pure
> AI-builder domain.

### 1.4 Node run / preview (and why we skip it)

- Langflow: "**Run component**" runs one component with `inputs_dict` from the visual editor and
  shows a **Last Run** value on success; "**Inspect**" shows that component's output and logs.
  Notably the docs call out that a single-component run does *not* execute upstream dependencies.
  https://docs.langflow.org/concepts-components
- Dify: the hover toolbar's play/stop button triggers `setPendingSingleRun({nodeId, action})`, and
  `NodeRunningStatus.Running` on a single node is tracked separately from the workflow's status.
- Dify's **Variable Inspector** is the good idea: after each node runs, its output variables appear in
  a bottom panel; you can *edit* a variable and re-run only the downstream node, or revert a single
  value / "Reset all". https://docs.dify.ai/en/guides/workflow/debug-and-preview/variable-inspect
- Dafthunk shows the same idea per-port: clicking an output with a value opens a dialog rendering the
  type-appropriate preview component (text, JSON, image, audio, video, glTF, GeoJSON, date, boolean,
  secret), and clicking a *free* input opens its editor dialog. `workflow-node.tsx` `handleInputClick`
  / `handleOutputClick`, plus `widgets/output/*`.
- Datablocks (built by the React Flow authors) advertises the passive version: "datablocks
  automatically chooses the right output view for your data" — no click needed. https://datablocks.pro/

> **SKIP** run/preview. There is no execution engine, no backend, and the brief forbids scope creep
> into one. The *shape* of the feature that survives in a static editor is the **per-port value
> tooltip**: hovering a handle shows "connected to: <node title>" and, for an in/out port, the last
> user-entered label. That is a 1-line affordance on top of the typed-port work, not a runtime.

### 1.5 Collapsed / expanded node bodies

- **Dify** has a `collapse/` primitive in `nodes/_base/components/` (a small Collapsible wrapper with
  Header / Actions / Trigger / Title / Indicator) plus `toggle-expand-btn.tsx`, and the node body uses
  it to fold parameter sections.
- **Langflow** puts the node's *description* behind an edit-name-description toggle
  (`NodeDescription`), so the collapsed node shows the label only.
- **Dafthunk** ships a whole second node renderer: `WorkflowOverviewNode`, described in its own source
  comment as "the editor's overview mode — the same picture the brief page's build canvas draws …
  deliberately shows none of the wiring detail (ports, widgets, fields)". The canvas swaps the
  renderer at render time (`type: 'workflowOverviewNode'`) so **stored nodes, positions, data and
  selection are untouched and toggling back is free** (`workflow-canvas.tsx`, `displayNodes` memo).
- **Ameliorate** takes the same idea in the other direction: `CompressedNode` is a minimal
  icon + text + score chip, used in the "hidden path" panel, and the graph itself supports
  hiding/showing subtrees (see §3).
- React Flow's own performance guide recommends exactly this for large trees: "modify the node's
  `hidden` property dynamically to toggle visibility." https://reactflow.dev/learn/advanced-use/performance

> **ADOPT** — a per-board (or per-board-type) **"compact cards"** toggle that swaps in a second node
> renderer showing only icon + title (+ status badge), plus a per-node **fold** for the `sub`/`metric`
> block. Dafthunk's "swap the renderer, don't mutate the model" trick maps perfectly onto Diagram
> Studio's single generic `DiagramNode` + `nodeTypes = {goblin, label}` registry — add
> `goblinCompact` and pass `displayNodes` through a memo. This is the single highest
> value-per-line-of-code change in this whole cluster for a diagram editor that has to render a
> 200-node architecture map.
> **ADAPT** Ameliorate's `CompressedNode` for the *hidden*-node case only (see §3 focus+context).

### 1.6 Node toolbar on hover / select

Diagram Studio already has this (`NodeToolbar`, F5) — so the useful research is *what else lives in
other people's toolbars*:

- **Dify** `node-control.tsx`: a pill "invisible absolute -top-7 right-0 … group-hover:visible,
  data.selected && 'visible'" containing **(a)** run-this-step / stop (icon flips while running) and
  **(b)** an actions dropdown. It sets `nodrag nopan nowheel` and stops propagation on mousedown/click
  so the toolbar never moves the node. The dropdown (`node-actions-menu/`) carries Change node,
  Duplicate, Delete, Copy, plus a help link. Also note the `has-data-popup-open:visible` class so the
  toolbar stays visible while its own menu is open — a real bug class.
- **Ameliorate** `NodeToolbar`: view-in-summary / view-in-diagram, view node details, and "node
  actions" (which opens the *context menu* at the mouse position, with a TODO admitting that's not
  ideal). Two lessons: cross-format navigation belongs in the toolbar; and opening a context menu from
  a toolbar is worth doing properly.
- **Flowise** puts the destructive action where the pointer already is: `ButtonEdge` renders a small
  circular **×** on the edge midpoint inside a `<foreignObject>` ("Edge with button" pattern).

> **ADOPT** — the Dify visibility rule (`selected` OR `hover` OR `own-menu-open`) is strictly better
> than the current selected-only behaviour, because a hover toolbar makes a node's affordances
> discoverable without a click. **ADOPT** `nodrag nopan nowheel` + stopPropagation if not already
> done; the existing toolbar is a React Flow `<NodeToolbar>` so most of this is free.
> **ADAPT** the mid-edge × button: Diagram Studio already has an edge context menu and
> `onEdgeClick` selection, but a hover-revealed × on the edge (styled from `--border-strong` /
> `--sel` on hover) is a better affordance than "right-click the arrow", especially for a tool meant
> for other users. Style it as a *hover-revealed* control only, so it does not compete with the
> existing animated flow payloads travelling along that same path.
> **SKIP** "Change node" in the toolbar — Diagram Studio already has `shape` in the inspector's Style
> section, and duplicating it in the toolbar creates two sources of truth.

### 1.7 Grouping / frames, sticky notes, annotations, comments

**Grouping**: Diagram Studio has subflows (`parentId`, `extent: 'parent'`, reparent-on-drop into the
`group` shape) — more than most tools here. What it lacks is the *management* layer. n8n's Canvas
Groups is the state of the art and is fully documented
(https://docs.n8n.io/build/understand-workflows/workflow-components/canvas-groups):

- `Ctrl/Cmd + G` group, `Ctrl/Cmd + Shift + G` ungroup, `Alt + G` expand all, `Shift + Alt + G`
  collapse all, `Space` rename — **the selection rules are the interesting part**: no trigger nodes
  in a group, the selection must form one connected chain, external nodes may only touch the group's
  first or last node, an AI node and its sub-nodes must move together, ≥2 nodes minimum, sticky notes
  may join. Invalid groups are auto-ungrouped on save with a warning.
- Groups take a **name** and an optional **≤145-character description** shown under the name when
  expanded and behind an info icon when collapsed; descriptions hide below ~2/3 zoom.
- Collapse state is a **per-user browser preference**, not saved in the workflow; descriptions *are*
  saved. Collapsed groups still respond to the right-click menu with actions applying to the hidden
  nodes inside.

**Sticky notes** (n8n docs + Flowise's `StickyNote.jsx`): n8n's are first-class canvas objects —
markdown body, 7 preset colours + custom hex picker that remembers the last 8, theme-aware borders,
resizable by dragging the edge, and explicitly **"drag sticky notes behind nodes — you can use this to
visually group nodes"**. Flowise's `StickyNote` is a node with no handles, a per-node colour that is
`lighten`/`darken`-ed for dark mode (`darken(nodeColor, 0.7)` selected, `0.8` otherwise), copy/delete
buttons, and `#FFE770` default.
Sources: https://docs.n8n.io/build/understand-workflows/workflow-components/add-notes-and-documentation,
`https://raw.githubusercontent.com/FlowiseAI/Flowise/main/packages/ui/src/views/canvas/StickyNote.jsx`.

**Comments**: Dify has a full canvas comment system — a `comment/` directory with `comment-icon`,
`comment-input`, `mention-input`, `comment-preview`, `thread`, `cursor`, plus a `comment-manager` —
and comments are **anchored to flow coordinates** (`flowToScreenPosition` in `comment-icon.tsx`), are
draggable, support keyboard movement, and carry an author avatar + thread. It has a dedicated
`workflow.comment-mode` shortcut (`C`) alongside pointer (`V`) and hand (`H`) modes
(`shortcuts/definitions.ts`). A `note-node` variant exists as a canvas object with a theme colour map
(`note-node/constants.ts` `THEME_MAP`), a markdown editor with toolbar, and a NodeResizer
(240×88 minimum).

> **ADOPT** — the grouping *management* layer: `Ctrl+G` / `Ctrl+Shift+G`, expand-all / collapse-all,
> and a per-group description. Diagram Studio's group reparenting is already there, so this is mostly
> keyboard + a header affordance on the existing `group` shape. **ADOPT** "collapse state = personal
> preference, description = saved in the board JSON" — that is exactly the right split for a tool
> whose boards are exported/imported as JSON (`boards.ts`).
> **ADOPT** the n8n group *validation rules* at least partially: "a group must be a connected chain"
> and "outside nodes connect only at the boundary" are meaningful in an architecture diagram too, but
> they are opinionated — implement as a warning (`flash()` already exists), not a hard block.
> **ADOPT (already half-built)** sticky notes. Diagram Studio has a `note` shape with post-it chrome
> and a free-text `label` node with no handles. n8n's contribution is: **colour presets**, **resize**,
> **markdown**, and **"send behind nodes"**. The last one is the missing piece — an explicit
> `zIndex`-based "Send to back / bring to front" for notes so a note can act as a soft frame. There is
> already a "Bring to front" node toolbar action, so the inverse is a small addition.
> **ADOPT (scoped)** comments. A full thread system with mentions is too much for a client-side-only
> editor. A single-anchored, authorless "comment pin" reusing the existing node/edge/pane context menu
> is the honest 10% that gets 80%: place pin → text → tooltip on hover → delete. If it can't be done
> without a backend, mark it as a later phase rather than shipping a half feature.
> **SKIP** n8n's "AI node and its sub-nodes must move together" rule and the trigger-node exclusion —
> both are workflow-engine concepts.

---

## 2. TYPED EDGES / typed connections

Flow-Like advertises "typed connections" on the React Flow showcase
(https://reactflow.dev/showcase, "Workflow builder for automation and AI with typed connections,
offline execution, and enterprise-ready governance"), and its developer book documents the semantics
more precisely than any other project in this cluster. Three separate mechanisms exist across the
tools, and they are complementary — take all three.

### 2.1 Compatibility is a shared, non-transitive function with human-readable refusals

Dafthunk's `packages/utils/src/parameter-compatibility.ts` is the single best artefact to copy from:

```
areTypesCompatible(sourceType, targetType):
  sourceType === targetType            → true
  either side === 'any'                → true            // wildcard both ways
  'blob' ↔ BLOB_COMPATIBLE_TYPES       → true            // image|audio|video|document|buffergeometry|gltf
  otherwise                            → false           // NO coercion
```

The file's header comment states the design reason outright: "Three copies of these rules existed
before this module; they would have drifted the first time someone added a `ParameterType`." The
runtime validator (`packages/runtime/src/validate-workflow.ts`), the editor's `isValidConnection`, and
the AI generator's repair hints all import it.

`explainIncompatibility()` returns a *sentence*, not a boolean — including the subtle cases: "`json`
cannot connect to `string`. Unlike `"any"`, `json` is not a wildcard — insert a `"to-string"` node
between them, or read a field out with `"json-extract-string"`", and "Both are blob flavours, but only
blob itself bridges them." The comment: "Keeping the wording here means the editor tooltip, the
validator message, and any generated repair hint cannot disagree about why an edge is invalid."

**Flow-Like** independently reaches the same conclusions and adds two rules worth noting:
- **direction matters**: "Two pins labeled `Message` are incompatible if both accept or both produce
  a value", and self-connections are rejected at authoring time.
- **value shape is part of the type**: `string`, `string[]`, `Struct`, `Struct[]` are distinct
  contracts, and "A node producing `Incident[]` needs a selector or iterator before a consumer
  expecting one `Incident`" — Studio *rejects the direct connection*.
- **schema-aware structs**: a named interface becomes a JSON Schema attached to the pin, and
  compatibility between two enforced concrete schemas "generally require[s] canonical equality …
  A three-field record cannot be assumed compatible with a two-field input." Known mismatch → rejected
  at authoring; unknown runtime violation → "fail at the first node that discovers it and make that
  node easy to find". The published compatibility table is worth reading in full:
  `https://book.flow-like.com/part-2/07-values-types-collections-interfaces/` §7.5.
- **generic pins specialise**: a generic formatter accepts several concrete types, but "once a wire
  resolves that generic, connected pins must remain compatible with the resolved contract."

`Flowise` in contrast does the cheap version: the type is encoded **inside the handle id string**
(`llmChain_0-output-llmChain-BaseChain` → last segment split on `|` gives the accepted types) and
compatibility is a string-intersection test, plus a per-target-handle "already connected and not a
list" check. `packages/ui/src/utils/genericHelper.js` functions `isValidConnection` /
`isValidConnectionAgentflowV2` (the V2 variant drops types entirely and only rejects self-connections
and cycles — a regression, not a pattern).

### 2.2 Where validation feedback appears

| Surface | Behaviour | Source |
|---|---|---|
| Dragging connection line | **green-600 while valid, red-400 while invalid, neutral-300 otherwise**, decided inside `isValidConnection` which *sets* `connectionValidationState` as a side effect | Dafthunk `workflow-edge.tsx` `WorkflowConnectionLine`, `use-graph-operations.ts` |
| Node handle | status-coloured fill; red icon when a required input is empty and unconnected | Dafthunk `TypeBadge` |
| Committed edge | red-400 when `data.isValid === false`, blue-500 when selected, else neutral-300; optional `animate-pulse` while active | Dafthunk `workflow-edge.tsx` `WorkflowEdge` |
| Edge endpoint decoration | Dify draws a 2×8 px **blue rect at the target** of the live connection line (`custom-connection-line.tsx`) — a cheap "this is where it will land" cue | Dify |
| Port hover tooltip | Langflow shows connection details on hover and lets you **click a port to Search for compatible components**; incompatible pairs get a tooltip saying so and the docs point at a Type Convert component | Langflow docs |
| Edge as gradient | status of source → status of target along the stroke | Dify |

### 2.3 Typed edges also carry *meaning*, not just types

**Ameliorate** (a flowchart/argument-mapping builder, https://ameliorate.app/playground, repo
`amelioro/ameliorate`) stores a **relation name** on every edge and derives everything from it:
- a table of legal `{source, name, target}` triples (`src/web/topic/utils/edge.ts`), e.g.
  `{source: 'answer', name: 'potentialAnswerTo', target: 'question'}`,
- **which add-buttons appear on a node** is computed from that table
  (`addableRelations` → `AddNodeButtonGroup`), so you can never draw an illegal relation,
- each relation gets a **semantic arrow shape** in `EdgeArrow.tsx`: buffer gate ▷ for
  causes/supports, AND gate for "has", a **not** gate (triangle + circle) for reduces/critiques, OR
  gate for misc/none — "Logic gates give us a way to convey roughly our edge types via symbol",
  behind a `useEnableSemanticArrowShapes` preference toggle,
- relations can also be **partitioned for layout** (`commonalityFrom: {source: 'uncommon'|'common',
  target: ...}`) so different relation families get placed in different bands,
- **parallel edges are offset** with a quartic-Bézier approximation to a cubic pair
  (`src/web/topic/components/Edge/svgPathDrawer.ts`, `parallelOffsetSpacing = 80`), so two edges
  between the same pair of nodes are both visible,
- the label is rendered through `EdgeLabelRenderer` on a measured container, and the arrow is
  positioned at the *border of the label* with a `getArrowTransformAtLabelBorder(path, x, y, w, h, 12)`
  helper — i.e. the arrow "enters" the label box rather than floating over it.

> **ADOPT** — `areTypesCompatible`-style rules with an `explainIncompatibility` companion, even
> before there is a type system: it is the same function shape as a *shape-to-shape* legality matrix
> (e.g. "an `actor` cannot connect to a `database` in an ERD preset"; "a `note` accepts no edges").
> The non-negotiable design choices to copy: (1) **one module** used by the connection guard, the
> renderer and the tooltip; (2) **no implicit coercion**; (3) refusals are **sentences with a fix**,
> surfaced through `flash()` — which Diagram Studio already has for its cycle block ("Blocked: this
> connection would create a cycle (A→B→A)").
> **ADOPT** the connection-line colour states (green-600 / red-400 / neutral-300 for *dark* UI the
> equivalent is `--green` / a new `--red` / `--border-strong`), wired through React Flow's
> `isValidConnection` callback. The app already computes `wouldCreateCycle()` (F7) inside a
> validation path, so this is plumbing the result into the line component.
> **ADOPT** edge `type`/`kind` as a first-class, *labelled* property with **per-kind arrow shapes and
> per-kind legality**. `GoblinEdge` today has `data.shape` (path curvature: bezier/smoothstep/step/
> straight), `data.offset`, `data.flow` and marker selection in the inspector — the missing dimension
> is a semantic kind (depends-on / sends-to / contains / implements / relates-to) that drives the
> marker, the dash pattern and the default colour together, instead of the user setting four things
> independently. This is the single most "diagram-native" idea in the cluster and it is what turns the
> edge inspector from a styling form into a semantic one.
> **ADAPT** the gradient-status edge (see §1.2) — adopt the mechanism, keep the payload manual.
> **ADAPT** Ameliorate's parallel-edge offset. Diagram Studio already supports `offset:
> 'center'|'start'|'end'` for the *label*, not the curve; a real parallel offset for duplicate edges
> would need edge-pair grouping. Worth it only if multi-edge pairs are common in practice — flag it,
> don't build it yet.
> **SKIP** Flowise's type-inside-the-handle-id trick. It is compact but stringly-typed and it broke
> the moment they shipped Agentflow V2 (they dropped type validation entirely). Dafthunk's explicit
> parameter objects are the right model for a codebase meant to be shared.
> **SKIP** schema/JSON-Schema propagation, `any` specialisation, collection-shape rules. Those are
> correct for a workflow engine and pure overhead for a drawing tool.

---

## 3. Mindmap-specific node UX

### 3.1 Keyboard-centric creation (Tab = child, Enter = sibling)

This convention is universal and stable across four independent implementations:

| Tool | Tab | Enter | Other |
|---|---|---|---|
| MindMup (https://www.mindmup.com/help/guides/keyboard/) | add child (horizontal layout) / sibling (vertical) | add sibling (horizontal) / child (vertical) | `Shift+Tab` insert parent, `Ctrl+D` new disconnected root, `/` or `F` collapse/expand, `Alt+F` hide one level, `Shift+F` expand one level, `0` root recentre, `{` select subtree, `[` select only subtree, arrow keys navigate |
| Visio (https://support.microsoft.com/en-us/visio/create-a-mind-map-in-visio) | create child (**`Shift+Tab` = child to the left of root**) | create sibling (not for root) | `Shift+Delete` delete only the node (children re-parent to grandparent), `Delete` deletes subtree, `Alt+Arrow` reorder siblings, `Shift+Enter` newline in text |
| Obsidian mindmap-editor plugin (https://community.obsidian.md/plugins/mindmap-editor) | add child | add sibling (a child on the root) | `F2` rename, `Shift+↑/↓` move among siblings |
| MindSnap (https://mindsnap.dev/) | "Custom keyboard shortcuts for each task" | | documented as a headline feature: "Drag, drop, rearrange structures, and edit content easily with a smooth, intuitive interface" |

Also note *where* the new node lands in the React Flow implementation of this: the official mindmap
tutorial creates the child by **dragging from a node's handle and dropping on the pane**
(`onConnectStart` records the node, `onConnectEnd` checks `event.target` has class
`react-flow__pane`, converts screen→flow coordinates via `screenToFlowPosition`, and subtracts the
parent's absolute position because children are positioned relative to their parent). It then:
- makes the **whole node a source handle** (`width:100%; height:100%` on `.react-flow__handle.source`)
  and hides the target handle with `opacity: 0; pointer-events: none`, restoring draggability via the
  node option `dragHandle: '.dragHandle'`;
- **focuses the new node's input on creation** (`setTimeout(… input.focus({preventScroll:true}), 1)`);
- sizes the node input by text length (`label.length * 8` px) in a `useLayoutEffect`;
- sets `nodeOrigin={[0.5, 0.5]}` so a node grows in all four directions;
- sets `parentId` on the child so **the whole subtree moves with the parent**.
Sources: https://reactflow.dev/learn/tutorials/mind-map-app-with-react-flow and
`https://github.com/xyflow/react-flow-mindmap-app` (`src/App/index.tsx`, `src/App/store.ts`
`addChildNode`).

### 3.2 Collapse subtrees, radial/auto-grow layout, focus + context

- **React Flow** ships an official Pro "Expand and Collapse" example using a reusable
  `useExpandCollapse` hook that "maintains the complete graph structure while only rendering the
  currently visible portions", tracks expanded/collapsed in node data, and recalcs layout with dagre
  after a toggle (https://reactflow.dev/examples/layout/expand-collapse). The free guidance is the
  same trick: flip `node.hidden` (https://reactflow.dev/learn/advanced-use/performance). The Pro
  "Auto Layout" example switches between **dagre, d3-hierarchy and elkjs** at runtime from one
  `useAutoLayout` hook (https://reactflow.dev/examples/layout/auto-layout) — i.e. "radial/tree" is a
  layout-engine choice, not a new renderer.
- **Ameliorate** implements a genuinely different and better *focus+context* model for a diagram that
  can't fit on screen. Instead of collapsing a subtree, it filters the graph:
  `showNodeAndNeighbors(nodeId, also)` sets `generalFilter.nodesToShow` to the node plus its
  neighbours, and there is a *flashlight mode* where clicking a node does this automatically
  (`FlowNode.tsx`: `if (getFlashlightMode()) showNodeAndNeighbors(node.id, true)`).
  Hidden nodes on a path are then not silently lost — they are represented by an **indirect edge**:
  `indirectEdges.ts` walks hidden paths between visible node pairs and synthesises an edge with
  `hiddenPath: MinimalEdge[]` and a `hiddenCount`, rendered by `IndirectEdge.tsx` with a badge, and
  `HiddenPathPanel.tsx` lists the skipped nodes as `CompressedNodeViaId` chips. It also has
  "Only show node and neighbors" vs "Also show node and neighbors" as *separate* context-menu items.
  Plus `Spotlight = 'primary' | 'secondary' | 'normal' | 'background'` computed from selection
  (edge selected → primary; an endpoint selected → secondary), which drives edge colour and node
  styling.
- **Heuristica** is the AI-flavoured version: right-click any node → **Expand with AI**, choosing
  *Topics* (subtopics), *Ideas* (new angles) or *Questions*; the root expansion gives a whole-subject
  overview. It also offers "switch to outline mode to reshape the whole map as plain text", and treats
  mind maps (tree) and concept maps (labelled network) as two formats over the same content.
  https://www.heuristi.ca/mind-map-maker — **ADOPT** the *outline mode* idea; **SKIP** the AI
  expansion.
- **Traverse** (https://traverse.link/) contributes the knowledge-tool angle: mindmap + notes +
  flashcards in one place, "Group notes and use color coding to form chunks of knowledge",
  "create **bidirectional links** directly from your notes", "Zoom in or do a quick search to find and
  pick up deep thinking threads exactly where you left off". Its own marketing names the pattern:
  *Create → Connect → Consolidate*.
- **Clay Read** (https://clayread.com/) is the accessibility reference in this cluster and its
  canvas is keyboard-operable by construction: the page itself documents "Press enter or space to
  select a node. You can then use the arrow keys to move the node around. Press delete to remove it and
  escape to cancel." and the same for edges. Its Bookgram edges are *typed and labelled* by
  relationship ("loves", "married to", "neighbor", "cousin", "friends") and it also offers an
  AI "Excerpt Chat" per book — domain-specific, but the keyboard-node-edges contract is generic and
  free to copy.
- **JSON Sea** (https://www.jsonsea.com/, OSS `altenull/json-sea`) is a JSON→graph viewer with a
  node-detail sidebar ("No selected node." as its empty state) — relevant only as a reminder that a
  selection-driven detail pane is the expected layout for a graph viewer.
- **Bit Cloud's** dependency graph (https://bit.cloud/products/graph) is the dependency-graph
  archetype (component deps by dep type: `?depTypes=dev,runtime,peer`) — bot-blocked for automated
  reads, so treat as a *reference for the ERD/dependency preset shape*, not a source of node UX.
- **MindSnap** (https://mindsnap.dev/) is only a source of two small UX facts: it advertises "Custom
  keyboard shortcuts for each task", multi-format export (PNG, SVG, JSON, XML) and dark/light themes
  in its **free** tier — i.e. these are table stakes, not differentiators.
- **Ideation Studio** (https://www.ideation-studio.dev/, OSS `afyqzarof/studio-client`) is a
  media+text inspiration board; its nodes are all `NodeResizer`-wrapped content nodes
  (`src/components/*Node/*.tsx`) with a thin `NodeWrapper` (`<article className="node-wrapper">`).
  Nothing to steal beyond the confirmation that every content node is resizable.

> **ADOPT** — `Tab` = create child, `Enter` = create sibling, as a **mindmap-preset-only** keyboard
> mode. This is the highest-leverage mindmap feature and it is cheap: Diagram Studio already has a
> global `keydown` handler (`onKey` in `App.tsx`) that is careful to bail on `isEditable(e.target)`,
> already creates nodes (`addNodeAt`, duplicate, paste) and already owns parent/child
> (`parentId`/`extent`). The mindmap-specific additions are: create the child *adjacent to the parent
> at a computed offset*, set `parentId` so the subtree drags together, **focus the new node's title
> input** (which requires the inline-title editing from §1.3 — the two features are the same feature),
> and keep `Tab`'s normal focus behaviour working inside any text field.
> **ADOPT** `F` / `/` (or `Space`) collapse on a node with a visible child-count badge, plus
> `Shift+Click`-free "collapse all / expand all". Implementation: flip `hidden` on descendants and
> recompute with the existing dagre call — no new layout engine needed for the first version.
> **ADOPT** `Alt+Arrow` sibling reorder and `Shift+Delete` "delete node only, re-parent children" —
> both are pure tree operations on data the app already models.
> **ADOPT** Ameliorate's focus+context as a *different* feature from collapse, and pick **"dim others"
> first**: Dify already proved the cheap version — a **`Shift`-hold** that dims everything outside the
> current selection (`'workflow.dim-other-nodes': { holdKey: 'Shift' }` in
> `shortcuts/definitions.ts`, with edges at `opacity: 0.3`). Diagram Studio has hover choreography
> already, so selection-scoped dimming is a small step and it is *the* feature that makes a dense
> diagram readable without hiding anything. Then, optionally, "show only this node and neighbours"
> with indirect-edge badges for the hidden hops (Ameliorate's `HiddenPathPanel` is the model).
> **ADOPT** "outline mode" (text tree side-by-side with the map) for the mindmap preset — it is the
> only way to bulk-edit a mind map without fighting a canvas, and it is pure rendering over the same
> node tree.
> **SKIP** radial layout as a *hand-authored* mode. Use the layout-engine switch instead (dagre for
> flowchart/architecture, a tree/hierarchical engine for mindmap) — React Flow's own Auto Layout
> example treats these as interchangeable engines behind one hook, and Diagram Studio already has
> dagre wired with a CSS re-layout transition.
> **SKIP** "expand with AI", flashcards, spaced repetition, note↔map bidirectional links — all
> domain-specific to the knowledge tools.

---

## 4. Generic vs domain-specific: the verdict

### 4.1 Generic enough — take it (in priority order)

1. **Typed, labelled, colour-coded ports** (Dafthunk `TypeBadge`, Langflow port colours,
   Waldiez four-sided role-split handles, Flow-Like direction rules). Opt-in per diagram-type preset.
2. **Connection-line validity feedback** (green/red/neutral + a target-end cap), driven by a single
   compatibility module with human-readable refusal text (Dafthunk, Dify).
3. **Node status: badge + border + ring**, with three-way distinction between idle / running /
   failed (and never-run ≠ failed). Dify + Langflow are the references.
4. **Second "compact/overview" node renderer** swapped at render time without touching stored data
   (Dafthunk `WorkflowOverviewNode`).
5. **Grouping management**: `Ctrl+G` / ungroup / expand-all / collapse-all / per-group description /
   collapse state as a personal preference (n8n Canvas Groups).
6. **Sticky notes as soft frames**: colour presets, resize, markdown, and an explicit
   "send behind nodes" (n8n; Flowise's dark-mode colour derivation is the implementation note).
7. **Keyboard-centric tree creation**: `Tab` child / `Enter` sibling / `Alt+Arrow` reorder / collapse,
   with auto-focus of the new node's label (MindMup, Visio, Obsidian plugin, React Flow tutorial).
8. **Inline node label editing** with Enter-commit/Esc-revert (Langflow `NodeName`; Diagram Studio
   already does this for edges).
9. **Hover-revealed node toolbar** (`selected || hover || own-menu-open`) and a hover-revealed
   mid-edge delete button (Dify `node-control`, Flowise `ButtonEdge`).
10. **Selection-scoped dimming** via a `Shift` hold, plus "show node + neighbours"
    (Dify `dim-other-nodes`; Ameliorate `showNodeAndNeighbors` + indirect edges).
11. **Anchored comment pins** (Dify) — adopt only if it can be done without a backend.
12. **Per-node fold** of the `sub`/`metric` block, and a compact-cards board toggle.

### 4.2 Too domain-specific — skip

- **Flow State / `$flow.state` / global variables / variable pickers** (Flowise Agentflow V2 docs;
  Dify Variable Inspector's edit-and-rerun). Only meaningful with an execution engine.
- **LLM/agent/tool/retriever/knowledge-base/MCP nodes, tool-mode, tool config panels** — the whole
  node catalogue of Dify, Langflow, Flowise, Dafthunk (`AI`, `Browser`, `Media`, `Integrations`
  categories: 470+ nodes), Waldiez (agent/model/tool nodes, group managers).
- **Run/retry/freeze/pause/inspect-log/single-step semantics** (Langflow "Freeze" and "Run component",
  Dify `NodeRunningStatus.Retry/Paused/Listening`, Flowise human-in-the-loop checkpoints).
- **Schema propagation, JSON-Schema pins, generic-pin specialisation, collection shapes** (Flow-Like
  §7.5) — correct engineering for a type-safe runtime, noise for a drawing tool.
- **Component versioning and "update available / breaking change will disconnect ports"** (Langflow)
  — a plugin-ecosystem concern.
- **Multi-file flow modules, Explorer trees, App Storage / tables** (Flow-Like's Flow page redesign:
  nested `.flow` documents, activity rail, Problems/Runs/Logs/Tests bottom panel). Excellent product
  design for an app platform; it is a whole second product for a diagram editor.
  One idea *does* survive: **docking surfaces into predictable edges instead of floating them over the
  canvas** ("The rail occupies its own column, so it cannot cover a node hiding at the edge of the
  graph") — relevant to Diagram Studio's left/right panel layout, already respected.
- **Node catalogues, node docs dialogs, marketplace/import-template dialogs** (Dafthunk
  `node-docs-dialog`, `import-template-dialog`; n8n templates).
- **Mindmap AI features**: expand-with-AI, flashcards, spaced repetition, quizzes, chat-with-document
  (Heuristica, MindSnap, Traverse).
- **Book/reading models** (Clay Read's excerpts, characters, page numbers) and **JSON-structure
  viewers** (JSON Sea) — domain content, though Clay Read's *keyboard-operable* canvas is generic and
  already counted above.
- **OneSignal Journeys / Primer** are closed-source SaaS: the case study confirms "decision trees and
  A/B split branching" and "wait periods, scheduling" as journey-builder concepts
  (https://reactflow.dev/pro/case-studies/onesignal-case-study) — that is *flowchart* content for
  Diagram Studio's template work, not node UX. No source available, so nothing to cite beyond the
  case study.

---

## 5. Top recommendations for Diagram Studio

Ordered by (value ÷ effort), each tied to what exists today.

1. **A second, compact node renderer + a board-level "compact" toggle.** Register `goblinCompact`
   alongside `goblin`/`label` in `nodeTypes`, map `displayNodes` in a memo (Dafthunk's exact trick:
   swap `type`, keep positions/data/selection). Render icon + title + optional status chip.
   *Why first:* no model change, immediately makes a large architecture map legible, and it is the
   substrate for §4's collapse/overview ideas.

2. **Typed ports as a preset-driven mode.** Add `ports?: Port[]` to `NodeKind` (`dir: in|out|trigger`,
   `type`, `label`, `required`, `repeated`). Keep the current single left/right handle pair as the
   default for architecture shapes, so nothing regresses. Type→colour from the existing
   `COLORS` set in `src/palette.ts`, *not* an imported palette. In-handle type glyph
   (Dafthunk) + colour (Langflow) + "unconnected handle is an insert button" (Dify).

3. **`graphRules.ts`: one compatibility module + sentences.** Same shape as Dafthunk's
   `parameter-compatibility.ts`: `areCompatible(source, target) → boolean` and
   `explainIncompatibility(source, target) → string | null`, imported by the connection guard, the
   connection-line renderer and the tooltip. Start with shape-to-shape rules per diagram type plus
   the existing cycle check; surface refusals through the existing `flash()`.

4. **Connection-line colour states + status-coloured edges.** Green/red/neutral on the dragging line
   (`isValidConnection`), an optional `<linearGradient>` edge from source status to target status,
   edge `opacity 0.3` when dimmed. All three are additions to components that already compute their
   own `stroke` (`GoblinEdge`) or already exist (`wouldCreateCycle`).

5. **Status on the node: badge + border + ring** (`idle | running | success | error | skipped`, and
   for a static editor the honest labels are draft/review/approved/blocked). Needs one new token
   (`--red`; there is `--green` but no error colour) and reuses the existing `--nc` keyframe technique
   for the running pulse.

6. **Semantic edge kinds** instead of four independent style controls: a `kind` (depends-on /
   sends-to / contains / implements / relates-to) that sets marker shape (Ameliorate's logic-gate
   arrows are the reference), dash pattern and default colour in one go, with only the user's
   explicit overrides on top. This is the change that makes the edge inspector feel like a *diagram*
   tool rather than a styling form.

7. **Grouping management + sticky notes as frames.** `Ctrl+G` / `Ctrl+Shift+G` on the existing
   subflow reparenting, `Alt+G` expand-all, per-group description saved in the board JSON, collapse
   state as a personal preference. Then a "Send to back" for `note`/`label` nodes so a note can act as
   a soft frame (the inverse of the existing "Bring to front").

8. **Keyboard-centric creation and tree editing for the mindmap preset.** `Tab` child / `Enter`
   sibling (with auto-focus of the new node's inline-editable title), `Alt+Arrow` reorder,
   collapse/expand with a child-count badge, `Shift+Delete` delete-node-only-re-parent-children,
   and an outline panel.

9. **Selection-scoped dimming on `Shift`** (Dify's hold-key pattern). Cheapest possible
   focus+context; the app already has the hover-choreography plumbing to reuse.

10. **Hover-revealed edge delete + node toolbar on hover** (`selected || hover || menu-open`), with
    `nodrag nopan nowheel` + stopped propagation on the toolbar, following Dify and Flowise.

**Two things the cluster says *not* to build**: an execution/runtime layer (run, pause, retry, logs,
variables) and a node *catalogue*. Every tool that has them is solving a different problem; Diagram
Studio's job is to draw, and its competitive edge is that it draws *many* diagram types well.

---

## 6. Cleanup note

Clones were made under `/tmp/c3` and have been deleted at the end of this run (see final command).
Peak combined size: **96 MB** (`dafthunk` 28 MB, `waldiez` 61 MB, `ameliorate` 8 MB,
`react-flow-mindmap-app` 0.4 MB, `studio-client` 6.5 MB), i.e. well below the GB-scale reporting
threshold, and `df -h /` was checked before and after each clone (root stayed at 31 % / 68 GB free).
Dify, Langflow, n8n and Flowise were **not** cloned; their relevant files were read individually from
GitHub raw / API views.
