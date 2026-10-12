# C3 — React Flow (`@xyflow/react` v12) edge-label / edge-style capabilities, how real React Flow apps implement free-dragged edge labels, and the connection-line properties of Miro / Lucidchart / Whimsical / FigJam

Date: 2026-09-21 · Child C3 · Output of the cluster defined in `SHARED-BRIEF.md` §5.
Everything below is in English. Every claim carries a URL.

**Evidence tiers used in this file**

- `[PRIMARY — installed package]` — read directly out of
  `/home/harvey/projects/tech-goblin/lab/diagram-studio/node_modules/@xyflow/`,
  version **`@xyflow/react` 12.11.6 / `@xyflow/system` 0.0.82**
  (verified from `@xyflow/react/package.json` in the repo's own `node_modules`, not from npm).
  This is the exact code Diagram Studio links against, so it outranks the docs when the two differ.
- `[PRIMARY — vendor source]` — the shipped source of a third-party React Flow app on GitHub.
- `[PRIMARY — vendor docs]` — the vendor's own help centre / API reference.
- `[SECONDARY]` — a write-up that is not the vendor's own.
- `[UNVERIFIED]` / `[UNVERIFIED — gated]` — could not be confirmed; what was tried is stated.

---

## 1. React Flow / `@xyflow/react` v12 — what the library actually ships

React Flow's edge model is **SVG for the path, and either SVG or a DOM portal for the label**.
There are exactly two label mechanisms in the library, and neither of them knows how to *drag*.
That is the single most important finding of this half of the report, so it is stated first.

### 1.1 The label prop surface: `EdgeLabelOptions`

Source: `node_modules/@xyflow/react/dist/esm/types/edges.d.ts` lines 7–21 `[PRIMARY — installed package]`,
mirrored verbatim in the published source at
<https://github.com/xyflow/xyflow/blob/main/packages/react/src/types/edges.ts> and documented at
<https://reactflow.dev/api-reference/types/edge> `[PRIMARY — vendor docs]`.

```ts
export type EdgeLabelOptions = {
  label?: ReactNode;
  labelStyle?: CSSProperties;
  labelShowBg?: boolean;
  labelBgStyle?: CSSProperties;
  labelBgPadding?: [number, number];
  labelBgBorderRadius?: number;
};
```

`EdgeLabelOptions` is *mixed into* the public `Edge` type
(`dist/esm/types/edges.d.ts` line 27: `type Edge<…> = EdgeBase<…> & EdgeLabelOptions & { … }`),
so every one of these six fields is a first-class, serialisable property on any edge object.

Concrete answers to C3's questions:

| Question | Answer | Evidence |
|---|---|---|
| Is there a built-in edge-label **background** prop? | Yes — three of them: `labelShowBg` (boolean, default **`true`**), `labelBgStyle` (`CSSProperties`), `labelBgPadding` (`[number, number]`, default **`[2, 4]`**), `labelBgBorderRadius` (`number`, default **`2`**). | `dist/esm/index.mjs` line 2511: `function EdgeTextComponent({ x, y, label, labelStyle, labelShowBg = true, labelBgStyle, labelBgPadding = [2, 4], labelBgBorderRadius = 2, … })` `[PRIMARY — installed package]` |
| Is there a `labelStyle`? | Yes — `CSSProperties`, applied to the `<text>` element (the *glyphs*, not the box). | same line 2511; docs <https://reactflow.dev/api-reference/components/edge-text> |
| Can the label background be **fully transparent**? | Yes, two independent ways. (a) `labelShowBg={false}` — the `<rect>` is not rendered at all (`labelShowBg && jsx("rect", …)`, line 2529). (b) `labelBgStyle={{ fill: 'transparent' }}` — the rect renders but paints nothing. xyflow's own example uses exactly this: `labelBgStyle={{ fill: 'transparent' }}` at <https://github.com/xyflow/xyflow/blob/main/examples/react/src/examples/Edges/CustomEdge3.tsx> `[PRIMARY — vendor source]`. | `dist/esm/index.mjs` lines 2511, 2529 |
| Is `labelBgStyle` SVG (`fill`) or CSS (`background`)? | **SVG.** The background is an SVG `<rect>`, so the property is `fill`, not `background`. | line 2529: `jsx("rect", { …, className: "react-flow__edge-textbg", style: labelBgStyle, rx: labelBgBorderRadius, ry: labelBgBorderRadius })` |
| What is the default background colour? | A CSS variable, not a literal in JS: `.react-flow__edge-textbg { fill: var(--xy-edge-label-background-color, var(--xy-edge-label-background-color-default)); }`, with `--xy-edge-label-background-color-default: #ffffff` (light) / `#141414` (`.react-flow.dark`). Text colour: `--xy-edge-label-color`. | `@xyflow/react/dist/style.css` lines 6, 54, 181–197 `[PRIMARY — installed package]` |

**Note for Diagram Studio:** diagram-studio already binds these two variables to its own tokens —
`src/styles.css` lines 288–289 declare `--xy-edge-label-background-color: var(--surface)` and
`--xy-edge-label-color: var(--fg)`. So the *SVG* path is already token-driven; it just isn't the path
`GoblinEdge.tsx` uses (see §1.4).

### 1.2 `BaseEdge`, `EdgeText`, and where `labelX`/`labelY` come from

- `<BaseEdge />` props include `labelX?: number`, `labelY?: number` (`dist/esm/types/edges.d.ts` lines 118–121 `[PRIMARY — installed package]`; docs <https://reactflow.dev/api-reference/components/base-edge>).
  It renders `path` → invisible `interactionWidth` path (default **20**) → `label && isNumeric(labelX) && isNumeric(labelY) ? <EdgeText …/> : null` (`dist/esm/index.mjs` line 2588).
  **So the built-in label is only drawn if the edge component hands it BOTH coordinates.**
- `labelX`/`labelY` are produced by the path generators, which all return the same 5-tuple:
  `getBezierPath` → `[path, labelX, labelY, offsetX, offsetY]`
  (`dist/esm/utils/…`; `@xyflow/system/dist/esm/index.mjs` line 1045, docs <https://reactflow.dev/api-reference/utils/get-bezier-path>),
  `getStraightPath` → line 1220, `getSmoothStepPath` → line 1426 `[PRIMARY — installed package]`.
- Those coordinates are **computed, never stored**. There is no `labelX` on the `Edge` type, no
  `labelPosition` field anywhere in `@xyflow/react/dist/esm/types/` or `@xyflow/system/dist/esm/types/`
  (checked by grep over both type trees: zero hits) `[PRIMARY — installed package]`.
- `getBezierPath`'s default `curvature = 0.25` and `getSmoothStepPath`'s defaults
  `borderRadius = 5, offset = 20, stepPosition = 0.5` are visible at `@xyflow/system/dist/esm/index.mjs`
  lines 1018 and 1411. These are the knobs behind `pathOptions`.

### 1.3 `pathOptions` — the only per-edge *path* control the library exposes

From `@xyflow/system/dist/esm/types/edges.d.ts` `[PRIMARY — installed package]`:

```ts
export type SmoothStepPathOptions = { offset?: number; borderRadius?: number; stepPosition?: number };
export type StepPathOptions       = { offset?: number };
export type BezierPathOptions     = { curvature?: number };
```

and the union wiring at `@xyflow/react/dist/esm/types/edges.d.ts` lines 47–57: `smoothstep` gets
`SmoothStepPathOptions`, `default` (bezier) gets `BezierPathOptions`, `step` gets `StepPathOptions`,
`straight` gets **none** (line 56 — `StraightEdge` is `Edge<EdgeData,'straight'>` with no `pathOptions`).
Documented at <https://reactflow.dev/api-reference/types/edge>.
`EdgeProps.pathOptions?: any` is typed loosely with an explicit `// @TODO: how can we get better types`
in the shipped source `[PRIMARY — vendor source]`, so a custom edge receives it untyped — Diagram Studio
would read it and narrow it itself.

**Gap relevant to Diagram Studio:** `stepPosition` is the one field that moves the *label anchor* on a
step/smoothstep path (it is fed into `getPoints`, line 1412) without touching the geometry of anything
else. Diagram Studio's four shapes are dispatched through `getSmoothStepPath({borderRadius:0})` /
`({borderRadius:12})` / `getBezierPath` / `getStraightPath`; `pathOptions.curvature` is therefore the
correct home for Harvey's "Curvature" ask (#8) and `borderRadius` the correct home for rounded-step.

### 1.4 `EdgeLabelRenderer` — the escape hatch, and its exact contract

Doc comment and implementation read from the installed package
(`dist/esm/components/EdgeLabelRenderer/index.d.ts`, and the real source at
<https://github.com/xyflow/xyflow/blob/main/packages/react/src/components/EdgeLabelRenderer/index.tsx>)
`[PRIMARY — installed package]` + `[PRIMARY — vendor source]`:

```tsx
const selector = (s: ReactFlowState) => s.domNode?.querySelector('.react-flow__edgelabel-renderer');
export function EdgeLabelRenderer({ children }) {
  const edgeLabelRenderer = useStore(selector);
  if (!edgeLabelRenderer) return null;
  return createPortal(children, edgeLabelRenderer);
}
```

Facts that matter for a build:

1. It is a **`createPortal` into one shared container div** — `.react-flow__edgelabel-renderer` —
   rendered as a sibling of the edge SVG layer and the connection line
   (`dist/esm/index.mjs` line 3273: `jsx("div", { className: "react-flow__edgelabel-renderer" })` comes
   *after* `EdgeRenderer` and *before* `NodeRenderer`) `[PRIMARY — installed package]`.
2. That container is **inside the viewport** (it is a child of `Viewport`), so children live in flow
   coordinates and are zoomed/panned by the same transform as the nodes
   (`toTransformString` = `translate(x,y) scale(z)`, line 3064).
3. The container's own CSS is `position:absolute; width:100%; height:100%; pointer-events:none; left:0; top:0`
   (`dist/style.css`) — so **the label must set `pointerEvents: 'all'` itself** to be interactive.
   Documented as a warning: *"The `<EdgeLabelRenderer />` has no pointer events by default… you need to set
   the style `pointerEvents: all` and add the `nopan` class"*
   (<https://reactflow.dev/api-reference/components/edge-label-renderer>,
   <https://reactflow.dev/learn/customization/edge-labels>).
4. Because the container is not transformed *per label*, every label must place itself, e.g.
   `transform: translate(-50%,-50%) translate(${labelX}px,${labelY}px)` — the pattern in every example
   on the site, e.g. <https://reactflow.dev/examples/edges/edge-label-renderer>.
5. There is **no** auto-counter-scale. Anything rendered through the portal is scaled by the viewport
   zoom and must undo it with `scale(${1/zoom})` if it should stay a constant screen size. The library
   itself does exactly this for `EdgeToolbar` (§1.7) and `NodeToolbar`, but **not** for `EdgeLabelRenderer`.

### 1.5 Markers: the whole model is two shapes and a colour

- `MarkerType` is an enum with exactly two members: `Arrow = 'arrow'`, `ArrowClosed = 'arrowclosed'`
  (`@xyflow/system/dist/esm/types/edges.d.ts` lines 95–98; docs <https://reactflow.dev/api-reference/types/marker-type>)
  `[PRIMARY — installed package]`. There is **no** diamond / oval / ERD-cardinality marker in the library.
- `EdgeMarker` is the object form: `{ type, color?, width?, height?, markerUnits?, orient?, strokeWidth? }`
  (same file, lines 79–87; docs <https://reactflow.dev/api-reference/types/edge-marker>). `EdgeMarkerType = string | EdgeMarker`.
- The rendered `<marker>` element: `markerWidth/Height` default **12.5**, `markerUnits` default
  **`'strokeWidth'`**, `orient` default **`'auto-start-reverse'`**, `viewBox="-10 -10 20 20"`, `refX=0 refY=0`
  (`@xyflow/react/dist/esm/index.mjs` line 2479). `markerUnits: 'strokeWidth'` is why a thicker line grows
  its arrowhead — which is exactly the behaviour Miro documents for its own arrowheads (§3.1).
- Markers are **deduped into `<defs>` and shared**, keyed by a sorted string of their own properties:
  `getMarkerId` → `` `${idPrefix}${Object.keys(marker).sort().map(k => `${k}=${marker[k]}`).join('&')}` ``
  (`@xyflow/system/dist/esm/index.mjs` line 1516) `[PRIMARY — installed package]`. Consequence for a build:
  **you cannot have per-edge marker ids that differ only in colour by accident — colour is part of the key,
  so two edges with different marker colours correctly get two `<defs>` entries.**
- **Naming.** React Flow names the two ends `markerStart` / `markerEnd` on the `Edge` type
  (`EdgeBase`, `@xyflow/system/dist/esm/types/edges.d.ts` lines 22–31) and, in a custom edge's props,
  `markerStart?: string; markerEnd?: string` (`@xyflow/react/dist/esm/types/edges.d.ts` lines 101–102),
  arriving **already resolved to `url(#…)`** by `EdgeWrapper`
  (`dist/esm/index.mjs` line 3043 passes `markerStart: markerStartUrl, markerEnd: markerEndUrl`)
  `[PRIMARY — installed package]`. The library never uses the words "head start" or "head end".
  Harvey's #9 preference ("head start / head end") is therefore a **Diagram Studio labelling decision,
  not a React Flow alignment decision** — but see §3 for what the mature tools call those ends
  (Miro: "The line start" and a matching end; Lucidchart: "Endpoint" left/right; FigJam: "start and end point style").
- **The `defs` live in a sibling `<svg class="react-flow__marker">`** rendered by `MarkerDefinitions`
  inside `.react-flow__edges` (line 3057), *not* in the same SVG as the paths. The `url(#id)` still
  resolves because they share the document.

### 1.6 The selection-tint rule is React Flow's own default, not Diagram Studio's invention

`node_modules/@xyflow/react/dist/style.css` `[PRIMARY — installed package]`:

```css
.react-flow__edge-path { stroke: var(--xy-edge-stroke, var(--xy-edge-stroke-default));
                         stroke-width: var(--xy-edge-stroke-width, var(--xy-edge-stroke-width-default)); fill: none; }
.react-flow__edge.selected .react-flow__edge-path,
.react-flow__edge.selectable:focus .react-flow__edge-path,
.react-flow__edge.selectable:focus-visible .react-flow__edge-path {
  stroke: var(--xy-edge-stroke-selected, var(--xy-edge-stroke-selected-default));
}
```

with `--xy-edge-stroke-selected-default: #555` (light) / `#727272` (dark), and
`--xy-edge-stroke-default: #b1b1b7` / `#3e3e3e`.

So: **upstream React Flow already tints a selected edge's body to a fixed selection colour** via a rule of
the same shape as Diagram Studio's `src/styles.css` line 1217 (which adds `!important` and `var(--sel)`,
causing Harvey's bug #7). Two consequences worth telling the synthesis:

- The behaviour is *idiomatic* — but upstream's version loses to an inline `stroke` only if specificity
  allows, hence Diagram Studio's `!important` was needed to force it. The *correct* upstream-shaped fix is
  to tint **only when the authored stroke is not overridden**, i.e. either move the selection tint to a
  non-stroke channel (dash-offset marching ants, a halo `<path>` underneath, or `filter: drop-shadow`) or
  keep the `!important` and also route the *authored colour* into `--xy-edge-stroke-selected` for the
  selected edge. Evidence that the second option is what other React Flow apps do: Eclipse Sirius Web
  overrides the style **in JS, per render**, and — critically — also **swaps the marker id** when selected
  so the arrowhead matches: `markerEnd={selected ? `${markerEnd?.slice(0, markerEnd.length - 2)}--selected')` : markerEnd}`
  (<https://github.com/eclipse-sirius/sirius-web/blob/master/packages/diagrams/frontend/sirius-components-diagrams/src/renderer/edge/MultiLabelEdge.tsx>) `[PRIMARY — vendor source]`.
  That is the same class of bug Harvey hit (body vs. arrow disagreeing) and the same class of fix.
- `--xy-edge-stroke` / `--xy-edge-stroke-width` are the **tokenised** hooks. Diagram Studio can move its
  authored colour into `--xy-edge-stroke` (set per-edge via a wrapper style or a CSS custom property on the
  edge group) and leave the `stroke:` declaration to React Flow, which removes the inline/`!important`
  conflict entirely. No new hex is required — the value is an existing `var(--…)`.

### 1.7 `EdgeToolbar` — a first-class "controls on the line" primitive (12.11.6 has it)

Added by <https://github.com/xyflow/xyflow/pull/5544> (visible in `packages/react/CHANGELOG.md` line 254
of the published source) `[PRIMARY — vendor source]`. Present in the installed 12.11.6:
`dist/esm/additional-components/EdgeToolbar/` exists and `dist/esm/additional-components/index.d.ts`
exports it; the barrel `dist/esm/index.d.ts` line 35 is `export * from './additional-components'`, so
`import { EdgeToolbar } from '@xyflow/react'` works `[PRIMARY — installed package]`.

Props (from `dist/esm/additional-components/EdgeToolbar/types.d.ts` + `@xyflow/system`'s
`EdgeToolbarBaseProps`, and docs <https://reactflow.dev/api-reference/components/edge-toolbar>):
`edgeId: string` (required), `x`, `y`, `isVisible` (default follows `edge.selected`),
`alignX: 'left'|'center'|'right'` (default `center`), `alignY: 'top'|'center'|'bottom'` (default `center`),
plus any `HTMLAttributes<HTMLDivElement>`.

The two behaviours that matter:

- It sets `pointerEvents: 'all'` for you (`dist/esm/index.mjs` line ~5169: the portalled div style is
  `{ position:'absolute', transform, zIndex, pointerEvents:'all', transformOrigin:'0 0', …style }`).
- **It counter-scales**: `getEdgeToolbarTransform(x, y, zoom, alignX, alignY)` returns
  `` `translate(${x}px, ${y}px) scale(${1 / zoom}) translate(${…}%, ${…}%)` ``
  (`@xyflow/system/dist/esm/index.mjs` lines 1598–1600) `[PRIMARY — installed package]`. This is the
  ready-made answer to "controls that stay finger-sized at every zoom" — which is the touch requirement
  in the brief's §7.

### 1.8 What does NOT exist — stated explicitly because it is the crux

1. **Dragging an edge label is not supported by the library, at all.** There is no prop, no handler, no
   example, and no exported helper. Evidence: (a) `EdgeLabelOptions` (§1.1) has no position field;
   (b) `labelX`/`labelY` exist only as *render-time arguments on `BaseEdge`*, never on `Edge`;
   (c) a grep for `labelPosition` across `@xyflow/react/dist/esm/types/` and
   `@xyflow/system/dist/esm/types/` returns **zero** hits `[PRIMARY — installed package]`;
   (d) GitHub issue search on `xyflow/xyflow` for `draggable label in:title` → **0 results**, and for
   `edge label position in:title` → 6 results, all closed refactors/bug reports about *computed* label
   positions (#3644, #3463, #3305, #2449, #1796, #939), none adding a user-draggable label
   (<https://github.com/xyflow/xyflow/issues/3644> etc.) `[PRIMARY — vendor tracker]`.
2. **No label-position presets either** — no `'start'|'center'|'end'`. The only way to move a label is to
   move the point you pass as `labelX`/`labelY`, or to translate the portal `<div>` yourself.
3. **Two arrowhead *shapes* only** (§1.5). ERD cardinality (crow's-foot, one, zero-or-one) is **not** in
   the library; Diagram Studio's `cardinality` section must be drawing its own glyphs (its `ArtCardinality`
   art component), and any *marker*-based cardinality must be a custom SVG `<marker>` passed as
   `markerStart`/`markerEnd` with `url(#…)` — which the library supports because `EdgeMarkerType` accepts a
   plain string and the example explicitly documents custom markers
   (<https://reactflow.dev/examples/edges/markers>) `[PRIMARY — vendor docs]`.
4. **No jump-over / line-jump primitive.** Nothing in `Edge`, `BaseEdge`, or the path utils implements a
   crossing gap. Eclipse Sirius Web hand-rolls it, and its data model is instructive:
   `EdgeCrossingGap { startRatio: number; endRatio: number }` — *"Normalized start coordinate (0..1) along
   the rendered SVG path where the fade should begin"* — turned into a `strokeDasharray` by
   `buildCrossingDashArray(svgPathString, data.crossingGaps)`
   (<https://github.com/eclipse-sirius/sirius-web/blob/master/packages/diagrams/frontend/sirius-components-diagrams/src/renderer/edge/MultiLabelEdge.tsx> and `…/crossings/buildCrossingDashArray.ts`) `[PRIMARY — vendor source]`.
5. **No label-background-per-edge *token*** other than the two CSS custom properties in §1.1 — a per-edge
   background must go through `labelBgStyle` (SVG `fill`) or through the portal div's own CSS.
6. `animated` is a single boolean, rendered as `.react-flow__edge.animated path { stroke-dasharray: 5;
   animation: dashdraw 0.5s linear infinite }` with the `@keyframes dashdraw` at `dist/base.css` line 285
   `[PRIMARY — installed package]`. There is **one** built-in speed and **one** built-in dash pattern.
   Anything else (speed, direction, a moving payload) is a custom edge — the library's own guidance is
   `<animateMotion>` or the Web Animations API
   (<https://reactflow.dev/examples/edges/animating-edges>) `[PRIMARY — vendor docs]`.

---

## 2. How real React Flow apps implement a freely dragged edge label

Sourcegraph code search (`sourcegraph.com/.api/search/stream`, query strings recorded in-line below) over
public TypeScript/TSX was used to find shipped implementations, then each candidate's source was read from
its own repository. Three real answers were found, of which **one is the full recipe**.

### 2.1 Eclipse Sirius Web — the complete, production free-drag label implementation

Repository: <https://github.com/eclipse-sirius/sirius-web> — 131 stars, **EPL-2.0**
(fetched from `api.github.com/repos/eclipse-sirius/sirius-web`) `[PRIMARY — vendor source]`.
Found by Sourcegraph query `DraggableEdgeLabels` — 6 hits, all inside this repo, no other project on the
index implements an equivalent. The three files that matter:

**(a) `packages/diagrams/frontend/sirius-components-diagrams/src/renderer/edge/DraggableEdgeLabels.tsx`**

- Renders **three** labels per edge through `EdgeLabelRenderer`: `beginLabel`, `label` (centre), `endLabel`.
- Each is a `<DraggableResizableLabel>` positioned with
  `position={{ x: label.position.x, y: label.position.y }}` plus a `positionOffset` — for the centre label
  that offset is `edgeCenterOffset - labelCenterOffset`, for begin/end it is the *handle* coordinate
  (`{x: sourceX, y: sourceY}` / `{x: targetX, y: targetY}`).
- It reads zoom from the store — `useStore(state => state.panZoom?.getViewport().zoom || 1)` — and passes it
  as the drag `scale`, so drag distance in screen pixels maps to document pixels correctly.
- `onDragStop` calls `onEdgeLabelMoveStop(eventData, id, 'center'|'begin'|'end', offset)`.
- A `labelCenterOffset` is applied **only while `!data.label.movedByUser`** — i.e. a label snaps to the
  path centre until the user has moved it once, and after that the stored position wins:
  `if (data.label?.width && edgeCenterSegmentDirection === 'x' && !data.label?.movedByUser) labelCenterOffset.x = data.label.width / 2;`

**(b) `…/renderer/edge/DraggableResizableLabel.tsx`** — the actual drag wiring

- Uses **`react-draggable`**'s `<Draggable>` — `import Draggable, { DraggableData } from 'react-draggable'` —
  with `position`, `positionOffset`, `scale={zoom}`, `nodeRef`, `disabled={readOnly}`,
  `cancel={'.react-resizable-handle'}`.
- Outer `<div ref={nodeRef} style={{ position:'absolute', zIndex:1001 }}>`; the label box gets
  `pointerEvents: 'all'` and, when selected and non-empty,
  `borderWidth:1px; borderColor: theme.palette.selected; borderStyle:'dashed'` — **selection is shown as a
  dashed border around the label, not by recolouring the text.**
- A deliberate *click-vs-drag* guard: `if (eventData.x !== 0 && eventData.y !== 0) onDragStop(...)` —
  "Prevent a simple click on the label to trigger the dragStop event".
- Resizing is a separate concern via `react-resizable`, with `resizeHandles={resizable ? [resizeHandlePosition] : []}`.

**(c) `…/renderer/move/useLabelMove.ts`** — the data model

This is the part Diagram Studio should copy most closely. On drag **stop** only (not per move):

```ts
case 'center':
  if (edge && edge.data?.label) {
    edge.data.label.position = { x: eventData.x - offset.x, y: eventData.y - offset.y };
    edge.data.label.movedByUser = true;
  }
```

and then the whole diagram is committed through a layout-sync call:
`synchronizeLayoutData(crypto.randomUUID(), 'layout', finalDiagram, 'UNCHANGED')`.
Types at `…/renderer/edge/MultiLabelEdge.types.ts`:
`interface MultiLabelEdgeData extends EdgeData { beginLabel?: EdgeLabel; endLabel?: EdgeLabel; crossingGaps?: EdgeCrossingGap[] }`.
`DraggableEdgeLabels.types.ts` confirms the props the edge hands down:
`{ id, data, selected, sourcePosition, targetPosition, sourceX, sourceY, targetX, targetY, edgeCenterPosition, edgeCenterSegmentDirection: 'x'|'y'|null }`.
**`movedByUser: boolean` is the flag that makes "auto-centre until the user objects" work**, and it is
exactly the semantic Harvey asked for in ask #1 ("drag the label anywhere, don't force me into 3 slots").

Cost of adopting this pattern: `react-draggable` **4.7.2, MIT**, dependencies `clsx` + `prop-types`
(npm registry) `[PRIMARY — npm registry]`, plus `react-resizable` **4.0.2, MIT** if resize is wanted.
Neither is in Diagram Studio's `package.json` today (checked: `node_modules` has no `react-draggable`).
**Both are optional** — see §5, R1, where the same behaviour is achievable with zero new dependencies
using the pointer-capture pattern Diagram Studio *already ships* for `.edge-bend-handle`.

### 2.2 Aleph (OCCRP) — the "label position is a point that bends the line" model

Repository: <https://github.com/alephdata/aleph> — 2,435 stars, **MIT** (api.github.com) `[PRIMARY — vendor source]`.
Found by Sourcegraph query `DraggableEdgeLabel`/`type:file EdgeLabelRenderer`. Not React Flow — Aleph's
`NetworkDiagram` is its own SVG graph — but its **data model is the cleanest statement of the behaviour**,
and the brief asks for the interaction and the data model, so it is worth recording:

- `.../NetworkDiagram/layout/Edge.ts`: `IEdgeData { …, labelPosition?: IPointData }` and
  `setLabelPosition(labelPosition?: Point)` / `getLabelPosition()`. **One optional 2-D point, `undefined`
  meaning "auto".** Serialised via `labelPosition.toJSON()`.
- `.../layout/GraphLayout.ts`: `dragEdge(edge, offset, initialPosition)` updates that point; `dragSelection`
  routes both vertices and edges through it.
- `.../renderer/EdgeRenderer.tsx` — **and here is the consequence to copy**: when `edge.labelPosition`
  exists, the edge is no longer a straight line. It becomes a **quadratic Bézier whose control point is the
  label position**, via `bezier-js`'s `Bezier.quadraticFromPoints(vertex1, gridToPixel(edge.labelPosition), vertex2, 0.5)`.
  When it does not exist, the edge is a plain `M…L…` and the label sits at the pixel midpoint.
  That is the "label drag = line bend" idiom Harvey is already halfway to with his bend handle.
- `.../renderer/EdgeLabelRenderer.tsx`: drag via `react-draggable`'s `<DraggableCore handle=".edge-handle">`,
  the label is a translated `<g>` inside the parent SVG, with an `outline` `<rect fill="white">` whose
  size is measured from `text.getBBox()` — i.e. **the label's background is a measured rect, and its
  "transparent" variant is simply `outline = null`** (the `fill="white"` is a literal in the outline only).
- Selection colouring: two stacked `<path>`s — a `stroke="rgba(0,0,0,0)" strokeWidth="4"` hit path with
  `cursor:'pointer'`, and a painted path whose `stroke` is `EDGE_COLOR` when highlighted or
  `UNSELECTED_COLOR` otherwise. **The painted stroke follows the highlight state; the hit area is invisible
  and separate.** That is a second viable cure for bug #7: split "hit path" from "painted path", and let the
  painted one keep the authored colour.

### 2.3 Apps that store label offsets but do NOT drag — and what that tells us

These were found with Sourcegraph (`labelBgStyle`, `labelOffsetX`/`labelOffsetY`, `data.labelOffset`, then
reading each hit's source) `[PRIMARY — vendor source]`:

- **xmlui** (<https://github.com/xmlui-org/xmlui>, 214★, MIT): `ReactFlowCanvasRender.tsx` computes
  `labelPosition` as **a percentage along the path** (`const labelPct = data?.labelPosition ?? 50;`), then
  resolves it to pixels with SVG's own geometry API: `pathRef.current.getTotalLength()` and
  `pathRef.current.getPointAtLength(totalLen * labelPct / 100)`. **This is the single best zero-dependency
  primitive for "move the label along the line"** — it is 6 lines, needs no maths, and works for every path
  shape including bezier. Falls back to the generator's `defaultLabelX/Y` when `labelPct === 50` (i.e. the
  default costs nothing).
- **flock** (<https://github.com/whiteducksoftware/flock>, 120★, MIT):
  `TransformEdgeData { …, labelOffset?: number // "Vertical offset to prevent label overlap" }` and
  `translate(-50%, -50%) translate(${labelX}px, ${labelY + labelOffset}px)`. Confirms the *nudge* model
  (one scalar, not a point) is enough for the commonest real need: two edges between the same pair.
- **whiteducksoftware `flock`, `OpenMetadata`** and others store the whole background in edge data:
  `labelBgStyle` as a serialised `Record<string, unknown>`
  (<https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/src/utils/WorkflowSerializer.ts>,
  `labelBgStyle = { fill: backgroundColor, fillOpacity: 1, stroke: …labelBorder, strokeWidth: 2, rx: 5, ry: 5 }`,
  plus `labelBgPadding: [4, 8]`) `[PRIMARY — vendor source]`. **This is the proof that `labelBgStyle`
  survives a round-trip through persisted JSON** — i.e. it can be a stored per-edge setting rather than a
  render-time constant.
- **simstudio/sim** serialises it too: `labelBgStyle: edge.labelBgStyle as Record<string, unknown> | undefined`
  (`apps/sim/lib/workflows/operations/export-workflow.ts`) `[PRIMARY — vendor source]`.
- **draw.io-inspired precedent for transparency as a named state:** xyflow's own example
  `labelBgStyle={{ fill: 'transparent' }}` (§1.1) and Aleph's `outline = null` (§2.2) both show the
  "no box" state is a first-class, toggleable thing in shipped code.

---

## 3. The remaining major tools — Miro, Lucidchart, Whimsical, FigJam

### 3.1 Miro — "Connection lines"

Primary source: <https://help.miro.com/hc/en-us/articles/360017730733-Connection-lines>
`[PRIMARY — vendor docs]`. **Retrieval note:** `help.miro.com` is behind Cloudflare and refused the tool's
own browser and the plain fetcher (documented in the brief as a known wall); the article text was obtained
through a text-extraction relay (`r.jina.ai`) which returned the full article body, and the article *exists*
at that canonical URL. Anything the article does not state is marked unverified below rather than inferred.

| Property | What Miro ships | Verbatim evidence |
|---|---|---|
| Create | toolbar "connection line" or hotkey **L**; or drag a blue dot on an object | "To create a line, select **connection line** on the toolbar or use the hotkey **L**." |
| Path shapes | **three**: straight, orthogonal, curved — *"the line type (straight, orthogonal, curved)"*. API enum confirms the same three: `shape: straight \| elbowed \| curved`, default **`curved`** | article + <https://developers.miro.com/reference/create-connector-1> `[PRIMARY — vendor docs]` |
| Where the controls live | a **context menu** on the selected line, not a side panel: *"Change arrowheads, the line type…, thickness, color, etc. on the context menu."* Thickness is under the **Type** icon | article |
| Label creation | **Double-click any connection line**, or click **+T** in the context menu | "Double-click any connection line or click **+T** in the context menu to start entering the text." |
| Label movement | **Free drag along the line**: *"Move the text along the line by dragging it."* **Multiple labels per line** are supported. The article's own tip generalises it: *"Create a timeline by adding multiple text labels and changing their positions on the line by dragging."* | article |
| Label typography | text size and colour on the context menu; can be **fixed horizontal or follow the curve**; **font and alignment cannot be changed** — *"Can I change the font and alignment of the text label on a line? No, this isn't possible at the moment."* | article |
| Label background / transparency | **Not documented** `[UNVERIFIED]` — the article never mentions a label background, box, pill, or fill. Tried: the article text, the API reference (schema has no background field for captions), and the connector style schema. |
| Arrowhead ends, naming | The context menu offers **None** plus arrowheads; the FAQ "How to create a connection line with arrowheads on both ends?" answers *"Select the line, choose **None** on the context menu, and add the arrowhead"*, with a figure captioned **"The line start"**. The API names the two ends `startStrokeCap` (default **`none`**) and `endStrokeCap` (default **`stealth`**) | article + <https://developers.miro.com/reference/create-connector-1> |
| Arrowhead shapes | API enum, 17 values: `none, stealth, rounded_stealth, diamond, filled_diamond, oval, filled_oval, arrow, triangle, filled_triangle, erd_one, erd_many, erd_only_one, erd_zero_or_one, erd_one_or_many, erd_zero_or_many, unknown` | same |
| Arrowhead size | **Derived, not settable**: *"The size of the arrowheads is changed when you change the thickness of your connection line."* | article |
| Line jumps | **Yes** — *"Line jumps help clarify which object each line refers to when lines intersect"*, toggled via Type → **Line jumps**. **Constrained**: *"Line jumps work with straight and orthogonal lines only."* | article |
| Stroke width / style | thickness on the context menu; API: `strokeWidth` string, **1–24 dp, default 1.0**; `strokeStyle`: `normal \| dotted \| dashed` (default normal); `strokeColor` hex default `#000000` | article + API |
| Style copy | **Copy/paste style** exists: *"copy a style of the line. Then select all objects… filter connection lines, and choose **Paste style**"* | article |
| Locking | locked lines: *"You can't edit the line type, color, thickness, etc., but you can still move objects to which the line is attached."* | article |
| Line-level extras a shared tool might copy | **Insert shape** onto a line (an object *between* two shapes); **multiple captions per connector** (API: `captions` array, **0–20 items**); caption **position is a percentage**: *"The relative position of the text on the connector, in percentage, minimum 0%, maximum 100%. With 50% value, the text will be placed in the middle of the connector line. Default: 50%"* with `textAlignVertical: top \| middle \| bottom`; caption **orientation**: `textOrientation: horizontal \| aligned` (default aligned); caption font size 10–288 dp default 14 | article + API |
| Tablet | The article's scope line is explicit: *"**Available on:** browser version, Desktop app, **Tablet app**, **Mobile app** (limited functionality)"* — and one instruction is written for touch: *"double-click the white bullet points (**use double tap on tablet**)"* | article |

Two more Miro data-model facts worth having, because they are *primary* and unambiguous
(<https://developers.miro.com/docs/work-with-connectors>): **a connector cannot attach to empty canvas** —
*"connectors that do not connect two items are not supported… You cannot use a connector to connect from an
item to a random point on the board"*, and the official workaround is to create two 5×5 px circles as
invisible anchors. Also, "connectors that do not connect two items" are only partially readable:
the API's `isSupported` field warns that for unsupported connectors *"we might not return all data about the
connector, such as intermediate points and connection points to the canvas."*

### 3.2 Lucidchart / Lucidspark (Lucid)

Primary source: <https://help.lucid.co/hc/en-us/articles/16157138194836-Add-and-style-lines-in-Lucidchart>
`[PRIMARY — vendor docs]` — retrieved in full by the extractor.
Note: Lucid's help centre is **not** Cloudflare-gated for this article (the plain fetcher got it; a later
text-relay attempt got a 403, so the extractor is the source). Lucidspark companion article:
<https://help.lucid.co/hc/en-us/articles/14560101705364-Add-and-style-lines-in-Lucidspark>.

| Property | Lucidchart | Lucidspark |
|---|---|---|
| Create | four documented ways: *"Manually click and drag from an object; Quick-add a line and shape from an object; Drag the line shape from the Shape menu; Right-click and add directly to the canvas"* | Line tool in the Primary Toolbar, or press **L** |
| Path shapes | **four**: *"Straight, Curved, Elbow, **Two way connections**"* — **default is Elbow** (*"The default setting for line shape in a new document is Elbow"*). Elbow angles can be **rounded** with a pixel stepper (*"toggling the pixels up and down arrows in the 'rounded' box"*) | **three**: straight, curved, elbow — **default is Curved** |
| Label creation | **Double-click a line** → *"Type in the 'Text' box that appears."* | *"double click the line where you'd like the text box to be added"* |
| Label movement | **Free drag, in 2-D**: *"Click and drag the text box to move the text to another place on the line, including directly above or below it."* | *"you can click and drag to position the text box adjacent to or on top of the line"* |
| Label background | A named style called **"TEXT PILL"**: *"If there is text on a line, you can select 'TEXT PILL' to create a pill around the text."* Whether the pill fill can be set to **none/transparent** is **not stated** `[UNVERIFIED]` — tried: this article (no mention of a fill/transparency control for the pill) and the Lucidspark article (no text-box fill control at all). |
| Mid-line marker | **"MARKER"**: *"select 'MARKER' to add a circle in the middle of your line which can be labelled with text above it"* — a third label-ish affordance beyond plain text | — |
| Arrowhead ends, naming | Two independent **"Endpoint" drop-downs**, explicitly *"the left or right 'Endpoint' drop-down in the formatting toolbar"*, with a **swap** button: *"To swap the endpoints of a selected line, click the double arrow icon next to the endpoint drop-down menus"*. Default: *"a solid, one-sided arrow"*. The list is extensible: Endpoint → **More** → checkboxes → **Apply**. **Size** is adjustable: *"You can adjust the size of line endpoints using the Line style options."* | One **"Arrow"** drop-down: *"Choose from a variety of arrowheads for one or both ends"*, plus **"Endpoint size"** with an **"Auto"** toggle: *"toggle on 'Auto' to have the endpoint size adjusted automatically depending on the size of the line"* |
| Stroke width | *"Lucidchart allows line thicknesses ranging from 0.5 to 10 px, and rounds inputted measurements to the nearest tenth of a pixel."* Control = **up/down arrows** (a stepper) | **Width** dropdown, pixel sizes |
| Line style | **"Line Style"** box → preview-on-hover list; **custom dash pattern**: *"To the right of 'Custom', enter your dash and gap size separated by a comma — Example: '5, 5'"*. Plus **"DOUBLE"** (two parallel lines) and **"JUMP"** (crossing jump) | **Style** dropdown: solid or dashed |
| Line jumps | **"JUMP"** is a line-style option: *"you can make it jump over the other line by selecting 'JUMP'"* — **not restricted to orthogonal lines**, unlike Miro | not documented |
| Path editing | Anchor points: *"A node will appear in the center of each section of the selected line… If you hover your cursor over a section of a selected line, an additional node will appear at the quarter mark of that section."* Per-point reset (*"right-click and select **Remove joint**"*) and whole-line reset (*"right-click on the line and select **Reset line**"*) | identical wording and identical affordances |
| Selection vs authored colour | **Not stated** `[UNVERIFIED]` — neither article describes a selection tint on the stroke. |
| Conditional formatting | Lines can be coloured by rule: *"customize conditional formatting rules to set lines associated with the value 'Yes' to appear in green and those with the value 'No' in red"* | — |
| Line connections toggle | Global, per-document: *"Create a line that moves independently from a shape by toggling off 'line connections' in document settings"* — and the caveat that **existing** connected lines stay connected | — |
| Smart lines | Auto-re-routing: *"A smart line will automatically adjust its connection points to form the most efficient path between two objects"* (hover-hold on the target border until highlight, then release) | auto-attach: *"Move an independent line close to a shape, and it will automatically attach to the shape's border"* |

### 3.3 Whimsical

Primary source: <https://whimsical.com/learn/boards/connectors> `[PRIMARY — vendor docs]`
(note: the `help.whimsical.com` host 404s for these paths; the canonical host is `whimsical.com/learn/…`).

- **Endpoints — the one place a tool publishes a hard number**: *"You can choose from **eight** different
  types of endpoints or none. You can also customize each end of the connector independently"* (illustrated
  by a 1258×394 image showing the endpoint picker). Whimsical is the only one of the four that states both
  a count and per-end independence in one sentence.
- **Path shape is a toggle, not a dropdown**: *"Connectors can either have elbows or curves - it's up to
  you! Use this icon to control how the connector bends"* — i.e. a **two-state button row**.
- **Per-connector settings**: *"You can have different settings for each connector on a board."*
- **Label creation**: *"When you first draw a connector, you'll see the option to add text. **Double-click to
  edit the text at any time**."*
- **Label movement**: **free drag along the connector** — *"Click and drag your text, to reposition it along
  the connector"* — and drag is **restricted to along the connector**, not a free 2-D offset (contrast
  Lucidchart and Miro).
- **Label background**: a **toggle, and only white**: *"Additionally, you can add a **white background** to
  the text in connectors from the toolbar."* No colour choice and **no transparent option is documented**
  as a separate state — the toggle's off-state *is* the transparent state `[UNVERIFIED — the article does
  not say the word "transparent"; the inference is from "add a white background… from the toolbar"]`.
- **Label colour is separate** from the connector colour: *"you can change the color of the connectors, and
  you can also change the color of the text in a connector. Just double-click the text to access the color
  options."*
- **Extra**: a navigation affordance worth stealing outright — *"Press `Command` (Mac) or `Control` (PC) and
  click on one end of a connector. You'll be taken to the other end!"*
- Moving a connector: *"click and drag anywhere along its length **except** the shape handles."*
- Whimsical also documents `L` for a straight line and `S` for Diagram shapes, and notes the *Line* element
  **cannot** be curved: *"The line element cannot be curved, it is only straight. Use a connector if you need
  a curved line."*

### 3.4 FigJam (Figma)

Primary source: <https://help.figma.com/hc/en-us/articles/1500004414542-Create-diagrams-and-flows-with-connectors-in-FigJam>
`[PRIMARY — vendor docs]` — retrieved in full.

- **Types**: *"Bent connectors… Curved connectors… Straight lines"* — three; shortcuts `X` or `⇧ Shift L`
  for bent, `L` for straight.
- **Endpoint re-attachment**: *"click and drag a connector's start or end point to another object, or another
  side of the same object"*, with **snap override**: *"hold down ⌘ Command (Mac) or Ctrl (Windows) while
  moving the line"* to land the endpoint anywhere on the object.
- **Path customisation**: *"Select a connector. Drag the path handle for the portion you want to move. For the
  start and end portions of a connector, dragging can add an extra portion to the path."*
- **Label creation**: *"Click in the connector's toolbar. Add text."* — via the object toolbar, not
  double-click.
- **Label movement — free along the path, with an explicit limit**: *"**Drag the text label anywhere along
  the connector's path** to make it easier for your team to see. **This is only possible if the connector is
  long enough to move the label.**"* The length caveat is a real interaction constraint Diagram Studio
  should expect to hit too.
- **Label background — a documented toggle with a documented default**: *"you can toggle its background on or
  off… **By default, the background is toggled off.**"* And a documented **limitation**:
  *"The text background color matches the connector's color. There isn't a way to give the connector and text
  background different colors."* That is the cleanest published statement in this whole survey that
  **"no background" is a real, default state** in a mature tool.
- Text editing limits: multi-row with Return/Enter; *"You can only bold or strikethrough text in a
  connector."*
- **Endpoints, naming**: *"**Start and end point style** — Connectors have **five** types of point styles…
  **None** … **Solid** and **Line** arrows give the point a solid or lined triangle pointing outwards …
  **Triangle** gives the point a solid triangle pointing **inward** … **Diamond** gives the point, well, a
  diamond."* The section title itself — *"start and end point style"* — is Figma's own vocabulary for the two
  ends, and it is the closest thing in this survey to Harvey's proposed "head start / head end".
  **Bulk editing**: *"Select multiple connector using ⇧ Shift Click to edit their styling in bulk."*
- **Stroke**: solid/dashed; *"two different stroke weights: thick and thin… By default, the weight is set to
  **thin**."*
- **Style memory**: *"FigJam remembers any styles last used for a connector during your recent work in a file."*
  (Miro has the explicit copy/paste-style variant; Lucidchart has document-level defaults set by
  deselecting: *"To set a document's default line settings, ensure you have no lines selected."*)
- **No flow animation is documented for FigJam connectors** `[UNVERIFIED]` — the article lists colour,
  style/stroke, text, background, and endpoints; nothing about an animated/marching-ants connector.

---

## 4. Where the tools DISAGREE — the places the owner must decide

These are genuine, evidenced conflicts. Stating them is the point of the brief's §6.

1. **Is the label dragged *along the line* or *freely in 2-D*?**
   - Along the line only: **Whimsical** ("reposition it along the connector"), **FigJam** ("anywhere along
     the connector's path"), **Miro** ("Move the text along the line by dragging it").
   - Freely, including off the line: **Lucidchart** ("to another place on the line, **including directly
     above or below it**"), **Lucidspark** ("adjacent to or on top of the line"), **Sirius Web** (arbitrary
     `{x,y}` stored per label), **Aleph** (arbitrary point, and the line *bends toward it*).
   Harvey's ask #1 is expressed as "adjust the text *around* the line as I want", which reads as the
   Lucidchart/Sirius camp — but three of the four consumer tools chose the cheaper "along the line" model,
   so this is a real fork and the recommendation (§5 R1) proposes the strict superset.
2. **Is "no label background" the default, an option, or impossible?**
   - Default = **no background**: FigJam (*"By default, the background is toggled off"*).
   - Default = **a box**: React Flow (`labelShowBg = true`).
   - Option, never default: Whimsical (a white-background toggle in the toolbar), xyflow's own example
     (`fill: 'transparent'`), Diagram Studio today (transparent until hover, `src/styles.css` line 1283).
   - Not documented at all: Miro `[UNVERIFIED]`, Lucidchart pill fill `[UNVERIFIED]`.
3. **Is the label background allowed a colour independent of the line?**
   - **No** — FigJam is explicit: *"The text background color matches the connector's color. There isn't a
     way to give the connector and text background different colors."*
   - **Yes** — OpenMetadata's serialised `labelBgStyle` sets `fill` and `stroke` independently of the edge's
     `style.stroke`; Miro's API has a separate `style.color` for *captions* and `style.strokeColor` for the
     *line*; Lucidchart has a separate text colour from line colour.
   Harvey's ask #2 wants a selectable/adjustable background, so **FigJam is the outlier he must not copy.**
4. **Button rows vs dropdowns for the shape/width/style/marker controls** (Harvey's asks #8 and #9).
   - **Dropdowns**: Lucidchart ("Line Options" icon → list; "Line Style" box; left/right "Endpoint"
     drop-downs; Elbow rounding is a pixel *stepper*), Lucidspark ("Shape", "Width", "Style", "Arrow"
     dropdowns), Miro (context menu with a Type icon), React Flow (`markerStart`/`markerEnd` are data
     fields with no UI at all).
   - **Button rows / toggles**: Whimsical (a single elbows-or-curves *icon*), FigJam (solid/dashed and
     thick/thin are two-state toolbar buttons; the five point styles are a picker; "Start and end point
     style" is set from the connector's toolbar).
   So both idioms are defensible; **the mature tools split by cardinality** — 2–3 options → button row,
   4+ → dropdown/picker. Diagram Studio's own `ToggleRow` / `SegRow` / `IconPickerRow` kit maps onto this
   exactly: 3 shapes, 3 widths, 3 line styles = `SegRow`; markers = a picker (Miro ships **17**, FigJam 5).
5. **Are line jumps available, and are they constrained?**
   - Miro: yes, but **only for straight and orthogonal** lines.
   - Lucidchart: yes, as a per-line style, no stated restriction.
   - Whimsical, FigJam: not documented `[UNVERIFIED]`.
   - React Flow: **not built in**; must be hand-rolled (Sirius Web's `crossingGaps` / `buildCrossingDashArray`).
6. **Does selecting an edge change its authored colour?**
   - React Flow: **yes, by default** — `.react-flow__edge.selected .react-flow__edge-path { stroke: var(--xy-edge-stroke-selected…) }`.
   - Sirius Web: yes, in JS, **and the arrowhead marker is swapped to match** — the only shipped example found
     that keeps body and head consistent, which is precisely the failure mode of Harvey's bug #7.
   - Aleph: yes, but via a **separate invisible hit path** — the painted path takes `EDGE_COLOR` vs
     `UNSELECTED_COLOR`, so the author's colour is a *state*, not something that gets overwritten.
   - Miro / Lucidchart / FigJam: **not documented** `[UNVERIFIED]`.
7. **Arrowhead size: settable, or derived?**
   - Derived from stroke width: **Miro** (*"The size of the arrowheads is changed when you change the
     thickness"*) — which is also React Flow's `markerUnits: 'strokeWidth'` default.
   - Independently settable: **Lucidchart** ("Line style options" for endpoint size), **Lucidspark** (an
     "Endpoint size" control with an **Auto** toggle — i.e. it offers *both*), **React Flow** API
     (`EdgeMarker.width` / `height`, default 12.5) though with no UI.
   Lucidspark's "Auto" toggle is the best of both and is directly copyable as a `ToggleRow`.

---

## RECOMMENDATIONS

Each item: **{utility · evidence · interaction · data-model cost · confidence}**.
Constraints from the brief's §7 are applied: touch-first (no hover-only state), no new hex in
`src/styles.css` (ceiling 160 / currently 142), no new npm dependency unless the cost and licence are stated.

---

**R1 — Free-drag the label, as a 2-D offset stored on the edge, with an explicit `movedByUser` flag.**
· **Evidence:** Sirius Web's complete implementation,
<https://github.com/eclipse-sirius/sirius-web/blob/master/packages/diagrams/frontend/sirius-components-diagrams/src/renderer/edge/DraggableEdgeLabels.tsx>
+ `…/DraggableResizableLabel.tsx` + `…/move/useLabelMove.ts` (`[PRIMARY — vendor source]`, EPL-2.0);
Lucidchart's free 2-D text drag
<https://help.lucid.co/hc/en-us/articles/16157138194836-Add-and-style-lines-in-Lucidchart>
(`[PRIMARY — vendor docs]`); Aleph's `labelPosition?: IPointData` + `movedByUser`-equivalent auto fallback
<https://github.com/alephdata/aleph/blob/main/ui/src/react-ftm/components/NetworkDiagram/layout/Edge.ts>
(`[PRIMARY — vendor source]`, MIT); FigJam's length caveat
<https://help.figma.com/hc/en-us/articles/1500004414542> (`[PRIMARY — vendor docs]`).
· **Interaction:** the label is picked up by **pointerdown on the label itself** (not on a separate handle —
this is what dissolves Harvey's complaint #1: the drag target and the text become the same object, so nothing
can collide); `setPointerCapture` keeps the gesture alive past a fast drag; **one** history entry at
pointerdown, positions written on pointerup only. Double-click still opens the inline text editor
(disambiguated with Sirius Web's own guard: ignore a drag whose delta is `{0,0}`). Reset to auto-centre must
be reachable — Lucidchart's *"right-click… **Reset line**"* and draw.io's double-click-the-point idiom are
the precedents; the touch-safe form is a "Reset label" button in the sidebar `label` section, **not** a hover
affordance. **Touch-safe: yes** — pointer events, and the same invisible `::after` ring technique
Diagram Studio already uses on `.edge-bend-handle` gives a ~32 px tap target without a hover state.
· **Data-model cost:** the smallest change that satisfies the ask is `data.labelOffset?: {x:number;y:number}`
**plus** `data.labelPinned?: boolean` (Sirius Web calls it `movedByUser`). Keep the existing
`data.offset: 'center'|'start'|'end'` as the *initial* position; when `labelPinned` is true, `labelOffset`
wins and `offset` is ignored. The render line at `GoblinEdge.tsx` ~line 383 becomes
`lx + (d.labelOffset?.x ?? 0)`, `ly + (d.labelOffset?.y ?? 0)` — a two-term additive change, no new maths.
· **Cost of the alternative route:** Sirius Web does it with `react-draggable` (4.7.2, **MIT**, deps `clsx`
+ `prop-types`, npm registry) — but **a new dependency is avoidable**: Diagram Studio already ships the exact
`pointerdown` + `document.pointermove` + `pointercapture`/`pointercancel` pattern for `.edge-bend-handle`
(`src/GoblinEdge.tsx` ~lines 301–386). Reusing that pattern costs **0 dependencies**; `react-draggable`
would additionally buy bounds/axis/grid but brings a second drag system into a codebase that already has one.
**Recommendation: 0 dependencies.** *(If the free-drag is built by reusing the bend-handle pattern, R1 and the
existing bend handle should share one gesture hook — see R6.)*
· **Confidence: HIGH** that this is the correct interaction (four independent shipped tools do it, two with
source read line-by-line); **MEDIUM-HIGH** on the exact `{x,y}`-offset-vs-absolute-point shape — Sirius Web
and Aleph store **absolute** label positions and re-derive the centre offset at render time, whereas a
relative offset is immune to the edge moving. Relative offset is the recommendation because Diagram Studio's
label anchor is already derived, not stored.

**R2 — Make the label background a stored per-edge style with an explicit "none" state.**
· **Evidence:** React Flow's `labelShowBg` / `labelBgStyle` / `labelBgPadding` / `labelBgBorderRadius`
(`dist/esm/types/edges.d.ts` lines 7–21 `[PRIMARY — installed package]`); the transparent form used in
xyflow's own example, `labelBgStyle={{ fill: 'transparent' }}`
<https://github.com/xyflow/xyflow/blob/main/examples/react/src/examples/Edges/CustomEdge3.tsx>
(`[PRIMARY — vendor source]`); FigJam's documented **off-by-default** toggle and its documented limitation
<https://help.figma.com/hc/en-us/articles/1500004414542> (`[PRIMARY — vendor docs]`); Whimsical's
white-background toggle <https://whimsical.com/learn/boards/connectors> (`[PRIMARY — vendor docs]`);
round-trip proof that `labelBgStyle` survives persisted JSON —
<https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/src/utils/WorkflowSerializer.ts>
and <https://github.com/simstudioai/sim/blob/main/apps/sim/lib/workflows/operations/export-workflow.ts>
(`[PRIMARY — vendor source]`).
· **Interaction:** a three-state `SegRow` in the `label` section — **None / Surface / Outline** (FigJam ships
exactly this two-state toggle; Whimsical ships the one-state version) — where "None" is a genuine stored
value, not the absence of a value. Padding and radius stay as the existing CSS (`.edge-label` already has
`padding: 1px 6px; border-radius: 5px`), so no new control is needed for them. **Touch-safe: yes** — it is a
button row, and it is currently a *hover* state (`styles.css` line 1290 `.edge-label:hover`) which must be
**deleted**, because hover does not exist on touch.
· **Data-model cost:** `data.labelBg?: 'none' | 'surface' | 'outline'` (string enum, default `'surface'` to
match today's look). Rendered as a class on `.edge-label` (`edge-label--none` / `--outline`), **not** as an
inline `fill`, because GoblinEdge renders the label as a DOM div through `EdgeLabelRenderer` — so the
background is CSS `background`, not SVG `fill`. **This is the one place where copying React Flow's API
verbatim would be wrong**: `labelBgStyle` is an SVG-rect API and Diagram Studio's label is not in SVG.
· **No new hex required:** `.edge-label` already paints `background: var(--surface)`; the transparent state
is `background: transparent` and the outline state is `transparent` + `border-color: var(--border-strong)` —
both are existing tokens or the `transparent` keyword, so the 142/160 ceiling is untouched.
· **Confidence: HIGH.** This is the least contentious item in the report — every tool surveyed either ships
the toggle or ships "none" as a state.

**R3 — Move the label *along* the path with the DOM's own geometry API, for a second, zero-state way to place it.**
· **Evidence:** xmlui, <https://github.com/xmlui-org/xmlui/blob/main/packages/xmlui-react-flow/src/ReactFlowCanvasRender.tsx>
(`[PRIMARY — vendor source]`, MIT) — `pathRef.current.getTotalLength()` +
`getPointAtLength(totalLen * labelPct / 100)`, with `data.labelPosition` as a **0–100 percentage** defaulting
to **50**; Miro's caption API uses the identical model in its data model, *"The relative position of the text
on the connector, in percentage, minimum 0%, maximum 100%… Default: 50%"*
<https://developers.miro.com/reference/create-connector-1> (`[PRIMARY — vendor docs]`).
· **Interaction:** in the `label` section, replace the current **"Label position" `ToggleRow` (center/start/end)**
— which Harvey asks to delete (#6) — with a **3-stop `SegRow`: Near source / Middle / Near target**, or
simply drop the control entirely and let R1's drag be the only way to move a label. Either way the *stored*
field becomes a position, which is what makes the middle stop non-authoritative. **Touch-safe: yes** (button
row); and the `getPointAtLength` technique is inherently touch-neutral.
· **Data-model cost:** either keep `data.offset` as a 3-value preset *that is only consulted when
`labelOffset` is unset*, or upgrade it to `data.labelPct?: number` (0–100, default 50) replacing
`'center'|'start'|'end'`. **The upgrade is the honest one** — it is the same field name Miro's API uses, it
makes a label draggable *along a curved bezier correctly* (the current arithmetic at `GoblinEdge.tsx` lines
383–385 lerps between the endpoints and adds the midpoint delta, so it is exact only for straight edges),
and it costs no new dependency. Note that `getPointAtLength` needs a live `<path>` element ref, which a
custom React Flow edge can hold — the edge already returns `<BaseEdge>`.
· **Confidence: MEDIUM-HIGH.** The technique is proven twice (xmlui's code, Miro's API). The *recommendation*
is medium-confidence only because it changes a field name, which is a migration cost the owner may not want
while the drag (R1) alone already satisfies ask #1. **These two are complementary, not alternatives:** R1
gives free 2-D placement, R3 gives *correct* placement on curved paths and a cheap "reset".

**R4 — Marker ends: two independent button rows, labelled in the user's terms, with size handled as an explicit Auto-or-fixed choice.**
· **Evidence:** Whimsical — *"You can choose from eight different types of endpoints or none. You can also
customize each end of the connector independently"* <https://whimsical.com/learn/boards/connectors>
(`[PRIMARY — vendor docs]`); FigJam — the section is titled **"Start and end point style"**, five styles
(`None / Solid / Line / Triangle / Diamond`), set *"for the its start and end points individually"*, with
**bulk edit** via ⇧-click <https://help.figma.com/hc/en-us/articles/1500004414542> (`[PRIMARY — vendor docs]`);
Lucidchart — **left and right "Endpoint" drop-downs** plus a **swap** button, and *"You can adjust the size of
line endpoints using the Line style options"*
<https://help.lucid.co/hc/en-us/articles/16157138194836-Add-and-style-lines-in-Lucidchart> (`[PRIMARY — vendor docs]`);
Lucidspark — **"Endpoint size" with an "Auto" toggle** <https://help.lucid.co/hc/en-us/articles/14560101705364-Add-and-style-lines-in-Lucidspark>
(`[PRIMARY — vendor docs]`); Miro — the API's two ends are `startStrokeCap` (default `none`) and
`endStrokeCap` (default `stealth`), from a **17-value** enum including `erd_one`/`erd_many`/`erd_zero_or_one`/…,
and arrowhead **size is derived from stroke width, not settable**
<https://help.miro.com/hc/en-us/articles/360017730733-Connection-lines> + <https://developers.miro.com/reference/create-connector-1>
(`[PRIMARY — vendor docs]`); React Flow — `markerStart`/`markerEnd` are `EdgeMarkerType`, the enum is only
`arrow | arrowclosed`, defaults `width/height = 12.5`, `markerUnits = 'strokeWidth'`, `orient = 'auto-start-reverse'`
(`dist/esm/types/edges.d.ts` lines 95–98, `dist/esm/index.mjs` line 2479 `[PRIMARY — installed package]`).
· **Interaction:** two `IconPickerRow`s (one per end) — **not** dropdowns — because the surveyed tools that
have ≤5 shapes use pickers/buttons (FigJam) and the one that has 8+ uses a picker too (Whimsical); only
Lucidchart's *extensible* list is a dropdown, and that is because it is user-configurable. Keep two separate
rows (FigJam, Lucidchart, Whimsical all set the ends independently; none of them has one "arrow" control).
Harvey's #9 naming preference ("head start" / "head end") is a **Diagram Studio choice with no contradiction
from any surveyed tool** — FigJam's own section title is "Start and end point style", Miro's figures are
captioned "The line start", Lucidchart says "left/right Endpoint". "Start / End" is therefore the
lowest-friction pair for a first-time user, and it is what three of the four tools imply; if "head" is kept,
the least ambiguous form is **"Head (start)" / "Head (end)"**.
· **Data-model cost:** **zero** — `markerStart`/`markerEnd` already exist on Diagram Studio's edge model and
already accept the `EdgeMarker` object form. The only real addition is the **marker colour**: React Flow
resolves `url(#id)` from a `<defs>` whose ids are a sorted string of the marker's own properties
(`getMarkerId`, `@xyflow/system/dist/esm/index.mjs` ~line 1520) `[PRIMARY — installed package]`, so
**changing a marker's `color` correctly produces a new `<defs>` entry automatically** — no bookkeeping
needed. **This is the mechanism that fixes bug #7's "only the arrow changed colour":** the day the body stops
being force-tinted, the arrowhead will already be correct, because it is the same marker object.
· **Confidence: HIGH** on the control type and the independence of the two ends; **MEDIUM** on adding marker
*size* as a control — Miro deliberately derives it from stroke width (which is React Flow's default too), so
adding a size control is a divergence from the largest tool surveyed. Lucidspark's **"Auto"** toggle is the
compromise if the owner wants it.

**R5 — Replace the `!important` selection tint with a tint that cannot disagree with the authored colour (fixes ask #7).**
· **Evidence:** React Flow's own rule, `dist/style.css`: `.react-flow__edge.selected .react-flow__edge-path
{ stroke: var(--xy-edge-stroke-selected, var(--xy-edge-stroke-selected-default)) }` with defaults `#555` / `#727272`,
against `--xy-edge-stroke` / `--xy-edge-stroke-width` as the **tokenised** hooks
(`[PRIMARY — installed package]`); Sirius Web's JS tint that **also swaps the marker** —
`markerEnd={selected ? \`${markerEnd?.slice(0, markerEnd.length - 2)}--selected')\` : markerEnd}`
<https://github.com/eclipse-sirius/sirius-web/blob/master/packages/diagrams/frontend/sirius-components-diagrams/src/renderer/edge/MultiLabelEdge.tsx>
(`[PRIMARY — vendor source]`); Aleph's **separate invisible hit path** with the painted path taking
`highlighted ? EDGE_COLOR : UNSELECTED_COLOR`
<https://github.com/alephdata/aleph/blob/master/ui/src/react-ftm/components/NetworkDiagram/renderer/EdgeRenderer.tsx>
(`[PRIMARY — vendor source]`).
· **Interaction:** **no user-visible interaction changes.** This is a rendering fix, and it is the one item
whose "interaction" is *removing* a wrong affordance: today, selecting an edge makes it lie about its colour.
· **Data-model cost:** **zero new fields.** Two viable routes, both token-only.
  (a) *Keep the tint, make it honest*: when an edge is selected, set `--xy-edge-stroke-selected` **on that
  edge's group** to the edge's authored colour, so the body keeps its colour and selection is communicated by
  the existing `.edge-label.selected` border and a **non-stroke** channel (a halo `<path>` underneath, or
  `filter: drop-shadow`) — the Aleph shape. This needs `GoblinEdge` to emit a second `<path>`/style when
  `selected`.
  (b) *Drop the tint for authored edges*: narrow the selector so it only applies when the edge has **no**
  authored stroke — which is literally what upstream does, since `--xy-edge-stroke-selected` has a default.
  The `!important` at `src/styles.css` line 1217 then disappears, and the authored inline `stroke` simply wins
  as CSS intended.
  Route (a) is recommended because it preserves a selection signal on edges that have *no* authored colour,
  which route (b) loses.
· **Constraint check:** no new hex — `--sel`, `--surface`, `--border-strong` et al. already exist, and
  `color-mix()` is available if a tint is wanted. If route (a) is taken, **verify on a phone**: a halo that
  only appears on `:hover` fails the brief's touch rule.
· **Confidence: HIGH** that the root cause is the `!important`/inline conflict (the brief already measured it:
`src/styles.css` line 1217) and **HIGH** that the arrowhead already follows the authored colour
(`createMarkerIds` in `@xyflow/system/dist/esm/index.mjs` line 1537 sets `color: marker.color || defaultColor`
and the `<marker>`'s id encodes it) — so the bug is exactly "body forced, marker free".

**R6 — Unify the label drag and the existing bend handle into ONE gesture system on the edge, and let one of them be the primary grab.**
· **Evidence:** the collision itself is Diagram Studio's own code — `handleAt = {x: labelX, y: labelY}`
(`src/GoblinEdge.tsx` line 299) is **the same point** as the label's auto anchor (`labelX/labelY`, lines
383–385), and both render inside the one `EdgeLabelRenderer` block (~lines 519–552); the mature-tool
precedent for "the text *is* the drag target" is Sirius Web's `DraggableResizableLabel` wrapping the label
itself (`[PRIMARY — vendor source]`), while the precedent for a *separate* midpoint handle is draw.io's
round handle (C1's cluster) which Diagram Studio's comments already cite; Lucidchart solves the same problem
by making the **path node** a distinct affordance from the **text box** — *"A node will appear in the center
of each section of the selected line… **Click and drag the text box to move the text** to another place on
the line"* <https://help.lucid.co/hc/en-us/articles/16157138194836-Add-and-style-lines-in-Lucidchart>
(`[PRIMARY — vendor docs]`).
· **Interaction:** make the **label** the drag target for *label placement* (R1) and the **existing round
handle** the drag target for *line bending* — and separate them in space instead of in z-order. Lucidchart's
mechanic is the one to copy: the bend handle appears **on the line's centre** and the text box is dragged
**independently**, so neither can ever eat the other's pointerdown. Concretely: keep `.edge-bend-handle` at
`labelX/labelY` (the path midpoint — where it belongs, and where Lucidchart puts its node), and let the
label, once it has any `labelOffset`, sit where the user put it. **Before R1 exists, the collision must still
be fixed**: the minimum change is to render the bend handle **only when the label is empty or
`labelOffset` is set**, and to give the label `touch-action: none` + a larger `::after` ring so it wins the
pointerdown it currently loses.
· **Data-model cost:** zero new fields — this is a rendering/behaviour rule over R1's fields. The one
implementation cost is that **two gestures now share the document-level pointermove/pointerup listeners**
already written for `onBendDown` (`src/GoblinEdge.tsx` ~lines 301–386); they should be factored into one hook
so a single pointerdown can never start both.
· **Confidence: HIGH** that the collision is real and measured (the brief states the brief's own source lines);
**MEDIUM** on the exact spatial separation — this is the item most likely to need a two-minute look at the
running app, because the right answer depends on how close `labelX/labelY` sits to the label at various edge
lengths (FigJam documents exactly this class of limit: *"This is only possible if the connector is long
enough to move the label"*).

**R7 — Add "Reset label position" as a sidebar button (and nothing on the edge itself).**
· **Evidence:** Lucidchart's per-point *"right-click and select **Remove joint**"* and whole-line
*"right-click on the line and select **Reset line**"*; Lucidspark repeats both verbatim
(<https://help.lucid.co/hc/en-us/articles/14560101705364-Add-and-style-lines-in-Lucidspark>)
(`[PRIMARY — vendor docs]`); Miro's equivalent is *"double-click the **white** bullet points (use double tap
on tablet)"* to *"remove extra bends and turns and reset a line"*
<https://help.miro.com/hc/en-us/articles/360017730733-Connection-lines> (`[PRIMARY — vendor docs]`) — note
Miro had to add the touch variant explicitly, which is the tell that the desktop idiom does not travel.
· **Interaction:** a plain button in the sidebar `label` section — **not** a right-click and **not** a
double-tap-on-the-handle, because Diagram Studio is a shared tablet/phone tool and the brief forbids
hover-dependent affordances; double-tap also collides with the existing double-click-to-edit-label gesture
(ask #4). One button, always visible when the `label` section is open.
· **Data-model cost:** zero — it clears `data.labelOffset` and `data.labelPinned`. It is also the natural
undo anchor: Lucidchart's resets are single history steps, and Diagram Studio's `onBend` already takes *"ONE
history entry at the START of the gesture"* (`src/GoblinEdge.tsx` ~line 303), so the same convention applies.
· **Confidence: HIGH.** This is the smallest, least risky recommendation in the report and it is the one that
makes R1 safe to ship: a free drag with no reset is the thing users fear.

**R8 — Flow animation: keep it a single, named, non-overlapping choice, with a direction and a duration; do NOT copy React Flow's `animated` boolean as the only state.**
· **Evidence:** React Flow's built-in `animated` is one boolean producing one dash pattern at one speed —
`.react-flow__edge.animated path { stroke-dasharray: 5; animation: dashdraw 0.5s linear infinite }`,
`@keyframes dashdraw` at `dist/base.css` line 285 (`[PRIMARY — installed package]`), and the docs' own answer
to "more than this" is a custom edge with `<animateMotion>` or the Web Animations API
<https://reactflow.dev/examples/edges/animating-edges> (`[PRIMARY — vendor docs]`); the brief records that
Diagram Studio already has `flow`, `flowIcon`, `flowCount`, `flowDuration` — i.e. it has **already moved past
React Flow's boolean**; **no tool in this survey documents a connector-wide marching-ants animation at all** —
Miro (no), Lucidchart (no), Whimsical (no), FigJam (not documented, `[UNVERIFIED]`) — so **there is no
mature-tool precedent to align to, and therefore no defensible reason for two overlapping animation controls.**
· **Interaction:** exactly one `ToggleRow` for on/off, one duration `Stepper`, and one direction control if
direction is offered — inside the existing `flow` section, with any second animation-adjacent field that
duplicates on/off or speed **removed**. Harvey's #10 (*"check for duplication, avoid confusing options"*) is
answered by the fact that the surveyed tools ship **zero or one** animation affordance; Diagram Studio's
`flow` + `flowIcon` + `flowCount` + `flowDuration` is already four. The safe rule for a shared tool: **one
switch, one speed, and the icon/count as *decorations on the payload* rather than as a second animation mode.**
· **Data-model cost:** keep the existing fields; the recommendation is **subtraction**, so the cost is the
migration of any edge that relied on a removed field, plus the decision of whether `flowIcon`/`flowCount`
survive as payload decoration (cheap — they render inside `.ds-animated-payload`, `src/GoblinEdge.tsx` ~line 517)
or become a separate "payload" concept.
· **Constraint check:** no new dependency — the existing `payloads` render path already exists. **Touch-safe:
yes** — a toggle row, and the animation is a passive state.
· **Confidence: MEDIUM.** The *evidence* that no mature tool ships a rich flow-animation control set is solid
(four tools checked, zero documented features); the *recommendation* is medium because the owner's #10 is about
design taste and duplication, and the correct number of animation controls for this tool is a product call, not
an evidenceable fact. **Flagged as a genuine disagreement/decision point** — this is the item where I can tell
the owner the tools offer nothing and the decision is his.

**R9 — Add "Jump over crossing lines" as a per-edge style, and expect to hand-roll it.**
· **Evidence:** Miro ships it, with a documented limitation — *"Line jumps help clarify which object each line
refers to when lines intersect… **Line jumps work with straight and orthogonal lines only.**"*, toggled via
Type → Line jumps <https://help.miro.com/hc/en-us/articles/360017730733-Connection-lines> (`[PRIMARY — vendor docs]`);
Lucidchart ships it as a line style — *"If a selected line crosses another line on the canvas, you can make it
jump over the other line by selecting **'JUMP'**"*
<https://help.lucid.co/hc/en-us/articles/16157138194836-Add-and-style-lines-in-Lucidchart> (`[PRIMARY — vendor docs]`);
**React Flow has no primitive for it** (§1.8 item 4), and the only shipped React Flow implementation found is
Sirius Web's `EdgeCrossingGap { startRatio, endRatio }` + `buildCrossingDashArray(svgPathString, gaps)`
rendered as a `strokeDasharray` with `strokeLinecap: 'round'`
<https://github.com/eclipse-sirius/sirius-web/blob/master/packages/diagrams/frontend/sirius-components-diagrams/src/renderer/edge/MultiLabelEdge.tsx>
(`[PRIMARY — vendor source]`).
· **Interaction:** a toggle in the `line` section (it is a *line* property, and both tools that ship it put it
with the line properties), applied automatically at intersections rather than per-crossing — both Miro and
Lucidchart do it automatically (*"they appear automatically on intersecting lines"*).
· **Data-model cost:** **the highest in this report, and it is why this is last.** Sirius Web computes
crossing ratios server/geometry-side and stores them on the edge (`crossingGaps`), which means a real
**intersection-detection pass** over the path geometry and every other path — plus re-computation whenever a
node moves. Siribus's own data shows the shape (`startRatio`/`endRatio` normalised 0..1 along the rendered
path) but not a cheap way to compute it. There is **no** zero-dependency shortcut in `@xyflow/react`
(§1.8 item 4). A conservative version is possible — compute gaps only among *visible* edges, only for
`straight`/`step`/`smoothstep`, and only on gesture end — but it is still a new subsystem.
· **Confidence: MEDIUM** on the utility (Miro and Lucidchart both ship it, so it is a real mature-tool
feature) and **LOW-MEDIUM** on the cost estimate, because I did not read Sirius Web's gap-computation code
(only its rendering and its stored type). **Recommendation: report it as "exists in mature tools, expensive
here, defer unless crossing lines are a real user pain" — and be explicit that Miro restricts it to straight
and orthogonal lines, which would make it cheap-ish for Diagram Studio's `straight`/`step` shapes and
inapplicable to its `bezier`.**

---

### Two things I could NOT confirm, stated plainly

1. **Miro's label background / transparency**: the Connection-lines article never mentions a label
   background, box, or fill, and the connector API schema has no caption-background field
   (`Caption` has only `content`, `position`, `textAlignVertical`).
   Marked `[UNVERIFIED]` **on the article's silence, not on a blocked page.**
2. **Lucidchart's "TEXT PILL" fill**: the Lucidchart article **was retrieved in full** (see §3.2) and it
   names the pill and shows it — *"If there is text on a line, you can select 'TEXT PILL' to create a pill
   around the text"* — but **never says whether the pill's fill can be set to none**, and the article has no
   text-box fill/colour control at all. So this is `[UNVERIFIED]` **on the article's silence**, not on a
   blocked page. Separately, and importantly: `help.lucid.co` **is** behind Cloudflare — a raw `curl` returns
   **HTTP 403 ("Just a moment…", Ray ID logged and visible in the response title)**, and the tool's own
   headless browser sat on the same interstitial for 60 s without clearing it. Only the extractor tool
   reached the article body. So: **the Lucidchart/Lucidspark claims quoted in §3.2 are confirmed against the
   articles' own full text; any *other* Lucid help-centre URL should be assumed gated until fetched.**
   Marked `[UNVERIFIED — gated]` for content beyond the retrieved article text.
3. **Miro's help centre as a whole is Cloudflare-gated** for both the tool's browser and plain fetchers
   (reproduced: a "Performing security verification / Ray ID" interstitial from `help.miro.com`, and HTTP
   403 from `curl`). The *one* article this report depends on was obtained via a text relay; **every Miro
   claim above is drawn from that article's own words plus the public Miro API reference at
   `developers.miro.com`, which was reachable directly.** Any Miro help-centre URL referenced here should be
   treated as `[UNVERIFIED — gated]` for *content beyond what is quoted*.
