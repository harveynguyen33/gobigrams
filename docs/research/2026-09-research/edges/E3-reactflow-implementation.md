# E3 — React Flow implementation of movable edge midpoints / waypoints

Cluster: **SHARED-BRIEF sub-question 3** — how real React Flow apps/libraries implement movable
midpoints or waypoints, and what Diagram Studio can copy.

Status: **complete**. Read-only research: nothing in
`/home/harvey/projects/tech-goblin/lab/diagram-studio` was modified.

Verified versions (read from `node_modules`, not from memory):

| package | version | source of the number |
| --- | --- | --- |
| `@xyflow/react` | **12.11.6** | `node_modules/@xyflow/react/package.json` |
| `@xyflow/system` | **0.0.82** | `node_modules/@xyflow/system/package.json` |

## 0. Scope + what I read

**Primary sources (read as code, quoted below):**

- Installed library, the authoritative artefact:
  `node_modules/@xyflow/system/dist/esm/` (`index.mjs`, `index.d.ts`,
  `utils/edges/{smoothstep,bezier,straight}-edge.d.ts`, `utils/edges/general.d.ts`,
  `types/edges.d.ts`) and `node_modules/@xyflow/react/dist/esm/`
  (`index.mjs`, `index.d.ts`, `components/Edges/EdgeAnchor.d.ts`,
  `additional-components/EdgeToolbar/EdgeToolbar.d.ts`, `types/edges.d.ts`) plus
  `node_modules/@xyflow/react/dist/style.css`.
- Upstream TypeScript, to confirm the dist is not a build artefact oddity:
  `packages/system/src/utils/edges/smoothstep-edge.ts` and `bezier-edge.ts` from
  `xyflow/xyflow@main`; `packages/react/src/components/EdgeLabelRenderer/index.tsx`.
- Diagram Studio's own files, for the integration constraints: `src/GoblinEdge.tsx`,
  `src/touch.ts`, `src/App.tsx`, `src/styles.css`.
- Behaviour was **executed**, not inferred: the exported generators were called under Node
  against the installed `@xyflow/system` (see §3 for the actual outputs).

**Secondary sources (real third-party implementations):** `tisoap/react-flow-smart-edge`
(editable waypoints), `rolamCodes/aleph` PR #20 (waypoints in `EdgeLabelRenderer`), `n8n`
(`CanvasEdge.vue`), `langflow` (`CustomEdges/index.tsx`), the archived `Jalez` fork, and the
upstream issue/PR trail.

Terminology used throughout: a **waypoint** is a stored point the edge is routed *through*;
a **movable midpoint** is a UI affordance on the middle of the line that the user drags.

---

## 1. The model — what the OSS core does and does NOT provide

### 1.1 The headline: there is no waypoint UI in the OSS core

Grepping the *installed* React Flow distribution for the concept returns nothing but a doc
comment:

```
$ grep -rin "waypoint\|midpoint\|controlpoint" node_modules/@xyflow/react/dist/esm/
(no matches)
$ grep -rin "waypoint\|midpoint\|controlpoint" node_modules/@xyflow/system/dist/esm/
./utils/edges/smoothstep-edge.d.ts:29:  * 0 = at source, 1 = at target, 0.5 = midpoint
```

The single hit is a *prose* mention of `stepPosition` in a JSDoc block. **React Flow 12.11.6
ships no waypoint type, no waypoint component, no waypoint UI, and no waypoint state.** The
only movable-midpoint affordance it ships is the end-drag **reconnect anchor**, which is a
different feature.

The upstream maintainers said the same thing twice, on the record:

> "Nope. This is possible by implementing a custom edge type. We are exporting several helpers
> so that you don't need to start from scratch" — `moklick`, closing
> [xyflow/xyflow#741 "Editable / adjustable edge midpoints"](https://github.com/xyflow/xyflow/issues/741) (2020-12-01)

> "This is not planned as a built-in feature for the library but we might publish it as a pro
> example at some point." — `moklick`, on
> [#4766](https://github.com/xyflow/xyflow/issues/4766) (2025)

The "pro example" did get published: **Editable Edge** is listed on
[reactflow.dev/pro/content](https://reactflow.dev/pro/content) as *"Implement a custom edge
with draggable control points to change the path of an edge"*, and its page
`https://reactflow.dev/examples/edges/editable-edge` states:

> "This example explains how to implement a routable and editable edge with draggable control
> points to change the path of an edge. … **This is a Pro example.**"

So the feature exists **only** behind the xyflow Pro licence (source not public; the demo HTML
at `https://example-apps.xyflow.com/react/pro/editable-edge/` is a 1.6 kB loader that mounts a
bundled app — the source is not obtainable). Every OSS implementation below is a
reimplementation of the same idea.

### 1.2 `EdgeBase` — there is no place to put a waypoint

`node_modules/@xyflow/system/dist/esm/types/edges.d.ts`:

```ts
export type EdgeBase<EdgeData extends Record<string, unknown> = Record<string, unknown>, EdgeType extends string | undefined = string | undefined> = {
    /** Unique id of an edge. */
    id: string;
    /** Type of edge defined in `edgeTypes`. */
    type?: EdgeType;
    /** Id of source node. */
    source: string;
    /** Id of target node. */
    target: string;
    /** Id of source handle, only needed if there are multiple handles per node. */
    sourceHandle?: string | null;
    /** Id of target handle, only needed if there are multiple handles per node. */
    targetHandle?: string | null;
    animated?: boolean;
    hidden?: boolean;
    deletable?: boolean;
    selectable?: boolean;
    /** Arbitrary data passed to an edge. */
    data?: EdgeData;
    selected?: boolean;
    …
    interactionWidth?: number;
};
```

No `points`, no `waypoints`, no `centerX`. The only extension point is the deliberately opaque
`data?: EdgeData`. Confirmed by the docs page
[api-reference/types/edge](https://reactflow.dev/api-reference/types/edge), whose full field
table lists nothing geometry-shaped either — `pathOptions` exists, but only as
`{ offset?, borderRadius? }` (smoothstep) or `{ curvature? }` (bezier).

**Consequence for Diagram Studio:** a waypoint must live in `edge.data`, which is exactly where
Diagram Studio already keeps `shape`/`offset` and where the existing end-drag reconnect keeps
the edge's identity (`reconnectEdge` copies `...rest`, so `data` survives an end-drag — see
§5.4).

### 1.3 The end-drag anchor — the one built-in midpoint-ish control (and why it is not one)

`node_modules/@xyflow/react/dist/esm/components/Edges/EdgeAnchor.d.ts`:

```ts
export interface EdgeAnchorProps extends SVGAttributes<SVGGElement> {
    position: Position;
    centerX: number;
    centerY: number;
    radius?: number;
    onMouseDown: (event: ReactMouseEvent<SVGGElement, MouseEvent>) => void;
    onMouseEnter: (event: ReactMouseEvent<SVGGElement, MouseEvent>) => void;
    onMouseOut: (event: ReactMouseEvent<SVGGElement, MouseEvent>) => void;
    type: string;
}
/** @internal */
export declare function EdgeAnchor(…): JSX.Element;
```

Note `@internal` — it is **not** part of the public API surface (`index.d.ts` does not export
it). Its implementation is an invisible circle at a handle position
(`@xyflow/react/dist/esm/index.mjs`, `function EdgeAnchor`, ~L2869):

```js
function EdgeAnchor({ position, centerX, centerY, radius = 10, onMouseDown, onMouseEnter, onMouseOut, type, }) {
    return (jsx("circle", { onMouseDown: onMouseDown, onMouseEnter: onMouseEnter, onMouseOut: onMouseOut,
        className: cc([EdgeUpdaterClassName, `${EdgeUpdaterClassName}-${type}`]),
        cx: shiftX(centerX, radius, position), cy: shiftY(centerY, radius, position),
        r: radius, stroke: "transparent", fill: "transparent" }));
}
```

…where `EdgeUpdaterClassName = 'react-flow__edgeupdater'` and `style.css` gives it the hit
behaviour:

```css
.react-flow__edgeupdater { cursor: move; pointer-events: all; }
```

`EdgeUpdateAnchors` renders two of these — at `(sourceX, sourceY)` and `(targetX, targetY)` —
**inside the edge's own `<svg>` element**, as a sibling of the user's edge component
(`EdgeWrapper`, `@xyflow/react/dist/esm/index.mjs` L3043):

```js
children: [
  !reconnecting && (jsx(EdgeComponent, { id, source, target, …, targetPosition, data: edge.data, … })),
  isReconnectable && (jsx(EdgeUpdateAnchors, { edge, isReconnectable, reconnectRadius, …, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, setUpdateHover, setReconnecting }))
]
```

and it only renders at all when

```js
const isReconnectable = typeof onReconnect !== 'undefined' &&
    (edge.reconnectable || (edgesReconnectable && typeof edge.reconnectable === 'undefined'));
```

**This is Diagram Studio's existing "2 dots to drag the connection" that Harvey said are
unnecessary.** Three properties matter for the new feature:

1. It is *always* at a handle position — dragging it re-attaches the end to a different node
   (`XYHandle.onPointerDown` with `edgeUpdaterType`), i.e. it is reconnect, not reshape.
2. The dot is a **filled-transparent** circle whose radius is `reconnectRadius` (React Flow
   default 10; Diagram Studio passes `RECONNECT_RADIUS`).
3. Because it lives inside the edge `<svg>` — which `style.css` gives
   `pointer-events: none` with `.react-flow__edge { pointer-events: visibleStroke }` — the
   click target is the circle's *fill*, not the stroke, and the enclosing `.react-flow__edge`
   group's `onClick` (`onEdgeClick` → `addSelectedEdges([id])`) sits in the same event path.
   Hit-test competition between a new midpoint handle and edge selection is therefore real (see
   §6).

### 1.4 `EdgeLabelRenderer` — the sanctioned DOM escape hatch

`@xyflow/react/dist/esm/index.mjs` (L3841) and upstream
`packages/react/src/components/EdgeLabelRenderer/index.tsx`:

```js
const selector$6 = (s) => s.domNode?.querySelector('.react-flow__edgelabel-renderer');
function EdgeLabelRenderer({ children }) {
    const edgeLabelRenderer = useStore(selector$6);
    if (!edgeLabelRenderer) { return null; }
    return createPortal(children, edgeLabelRenderer);
}
```

The portal target is a plain div rendered as a **sibling of the edges SVG**, inside the
transformed viewport (`Viewport` in `GraphViewComponent`, L3273):

```js
jsx(EdgeRenderer, { … }),
jsx(ConnectionLineWrapper, { … }),
jsx("div", { className: "react-flow__edgelabel-renderer" }),
jsx(NodeRenderer, { … }),
jsx("div", { className: "react-flow__viewport-portal" })
```

`dist/style.css`:

```css
.react-flow__edgelabel-renderer {
  position: absolute;
  width: 100%;
  height: 100%;
  pointer-events: none;
  user-select: none;
  left: 0; top: 0;
}
```

Because it is inside `.react-flow__viewport` (`transform-origin: 0 0`), child coordinates are
**flow coordinates** and the container inherits pan/zoom. `pointer-events: none` on the
container means an interactive handle must set **`pointerEvents: 'all'`** itself, and the class
must carry **`nopan`** (and `nodrag` if inside a node) — both stated in the component's own
JSDoc:

> "@remarks The `<EdgeLabelRenderer />` has no pointer events by default. If you want to add
> mouse interactions you need to set the style `pointerEvents: all` and add the `nopan` class
> on the label or the element you want to interact with."

Also relevant: `ViewportPortal` (L3875) portals into `.react-flow__viewport-portal`, the other
view-relative DOM layer — same coordinate system, but it is **not** the edge-label layer, so an
edge-owned handle belongs in `EdgeLabelRenderer`.

### 1.5 `EdgeToolbar` — the OSS precedent for a *screen-constant* edge control

`@xyflow/react/dist/esm/additional-components/EdgeToolbar/EdgeToolbar.d.ts` is public API and
takes an explicit position:

```ts
export declare function EdgeToolbar({ edgeId, x, y, children, className, style, isVisible, alignX, alignY, ...rest }: EdgeToolbarProps): JSX.Element | null;
```

Its implementation (`index.mjs` L5159) is the exact template a midpoint control should copy —
portal into `EdgeLabelRenderer`, `pointerEvents: 'all'`, counter-scaled by zoom:

```js
const transform = getEdgeToolbarTransform(x, y, zoom, alignX, alignY);
return (jsx(EdgeLabelRenderer, { children: jsx("div", { style: {
    position: 'absolute', transform, zIndex, pointerEvents: 'all', transformOrigin: '0 0', ...style
}, className: cc(['react-flow__edge-toolbar', className]), "data-id": edge?.id ?? '', ...rest, children }) }));
```

and `@xyflow/system/dist/esm/index.mjs` L1598:

```js
function getEdgeToolbarTransform(x, y, zoom, alignX = 'center', alignY = 'center') {
    return `translate(${x}px, ${y}px) scale(${1 / zoom}) translate(${-(alignXToPercent[alignX] ?? 50)}%, ${-(alignYToPercent[alignY] ?? 50)}%)`;
}
```

`EdgeToolbar` auto-hides unless `isVisible` or `edge.selected`:
`const isActive = typeof isVisible === 'boolean' ? isVisible : edge?.selected;`

**This is the single most directly reusable precedent in the whole report**: it solves
"render a screen-constant, interactive control at a flow coordinate on an edge" and it is OSS,
in the installed package, with the transform arithmetic done for you.

---

## 2. The interaction model that the precedents converge on

Every real implementation I found does the same four things:

1. **Reveal on selection.** Handles only exist while the edge (or one of its nodes) is
   selected — `EdgeToolbar`'s `isActive`, `tisoap`'s `showControlPoints={Boolean(edgeProps.selected) || endpointsSelected}`,
   aleph's "Show segment hits and waypoint handles only on the selected edge".
2. **Two handle states: active (persisted) and inactive (insert).** `tisoap`'s `ControlPoint`
   distinguishes them by fill:
   ```tsx
   cx={x} cy={y} r={active ? 4 : 3}
   strokeOpacity={active ? 1 : 0.3}
   stroke={color} fill={active ? color : "white"}
   ```
   A hollow dot at a segment midpoint *adds* a waypoint when clicked; a filled dot *moves* one.
3. **Pointer drag with document-level listeners, converting screen → flow.**
   `tisoap` `ControlPoint.tsx`:
   ```tsx
   const container = useStore((store) => store.domNode);
   const { screenToFlowPosition } = useReactFlow();
   …
   const onPointerMove = (event: PointerEvent) => {
       updatePosition(screenToFlowPosition({ x: event.clientX, y: event.clientY }));
   };
   container.addEventListener("pointermove", onPointerMove);
   container.addEventListener("pointerup", onPointerUp, { once: true });
   container.addEventListener("pointerleave", onPointerUp, { once: true });
   ```
   The handle itself is `className={`nopan nodrag${active ? " active" : ""}`}` with
   `style={{ pointerEvents: "all", cursor: "pointer" }}` and `onPointerDown` gated on
   `if (event.button === 2) return;`.
4. **Persist every move into `edge.data`, through React Flow's own setter.** `tisoap`
   `renderDecision.tsx`:
   ```tsx
   const setControlPoints = useCallback<SetControlPoints>(
     (update) => { setEdges((edges) => applyControlPointsUpdate(edges, id, update)); },
     [id, setEdges],
   );
   ```
   with
   ```ts
   export const applyControlPointsUpdate = (edges, edgeId, update) =>
     edges.map((edge) => {
       if (edge.id !== edgeId) return edge;
       const points = readControlPoints(edge.data);
       return { ...edge, data: { ...edge.data, points: update(points) } };
     });
   ```

Removal / keyboard affordances found: right-click the handle, or `Delete`/`Backspace` while the
handle is focused; arrow keys nudge by `NUDGE = 5` flow units. `tisoap`'s handles are
`tabIndex={0}` so they are reachable — worth copying for accessibility parity with Diagram
Studio's existing focusable nodes/edges.

Diagram Studio already has the two prerequisites this pattern needs:
`screenToFlowPosition` (via `useReactFlow()`) and controlled edges
(`useEdgesState<Edge>([])` + `handleEdgesChange` in `src/App.tsx:423`).

---

## 3. `GetSmoothStepPathParams` — the ONLY built-in movable midpoint

### 3.1 The type, verbatim

`node_modules/@xyflow/system/dist/esm/utils/edges/smoothstep-edge.d.ts`:

```ts
import { Position } from '../../types';
export interface GetSmoothStepPathParams {
    /** The `x` position of the source handle. */
    sourceX: number;
    /** The `y` position of the source handle. */
    sourceY: number;
    /**
     * The position of the source handle.
     * @default Position.Bottom
     */
    sourcePosition?: Position;
    /** The `x` position of the target handle. */
    targetX: number;
    /** The `y` position of the target handle. */
    targetY: number;
    /**
     * The position of the target handle.
     * @default Position.Top
     */
    targetPosition?: Position;
    /** @default 5 */
    borderRadius?: number;
    centerX?: number;
    centerY?: number;
    /** @default 20 */
    offset?: number;
    /**
     * Controls where the bend occurs along the path.
     * 0 = at source, 1 = at target, 0.5 = midpoint
     * @default 0.5
     */
    stepPosition?: number;
}
export declare function getSmoothStepPath({ … }: GetSmoothStepPathParams): [path: string, labelX: number, labelY: number, offsetX: number, offsetY: number];
```

Note that `centerX`/`centerY` are the **only** parameters in the whole signature with **no
JSDoc at all**. They are undocumented in the type and appear in the docs table
([api-reference/utils/get-smooth-step-path](https://reactflow.dev/api-reference/utils/get-smooth-step-path))
with an empty description and no default. An undocumented parameter with subtle semantics is
the single largest trap in this report.

### 3.2 The implementation, verbatim

`@xyflow/system/dist/esm/index.mjs` L1411 (identical to upstream
`packages/system/src/utils/edges/smoothstep-edge.ts` L266):

```js
function getSmoothStepPath({ sourceX, sourceY, sourcePosition = Position.Bottom, targetX, targetY, targetPosition = Position.Top, borderRadius = 5, centerX, centerY, offset = 20, stepPosition = 0.5, }) {
    const [points, labelX, labelY, offsetX, offsetY] = getPoints({
        source: { x: sourceX, y: sourceY },
        sourcePosition,
        target: { x: targetX, y: targetY },
        targetPosition,
        center: { x: centerX, y: centerY },
        offset,
        stepPosition,
    });
    let path = `M${points[0].x} ${points[0].y}`;
    for (let i = 1; i < points.length - 1; i++) {
        path += getBend(points[i - 1], points[i], points[i + 1], borderRadius);
    }
    path += `L${points[points.length - 1].x} ${points[points.length - 1].y}`;
    return [path, labelX, labelY, offsetX, offsetY];
}
```

`getPoints` (L1240), the part that actually consumes `center`:

```js
function getPoints({ source, sourcePosition = Position.Bottom, target, targetPosition = Position.Top, center, offset, stepPosition, }) {
    const sourceDir = handleDirections[sourcePosition];
    const targetDir = handleDirections[targetPosition];
    const sourceGapped = { x: source.x + sourceDir.x * offset, y: source.y + sourceDir.y * offset };
    const targetGapped = { x: target.x + targetDir.x * offset, y: target.y + targetDir.y * offset };
    const dir = getDirection({ source: sourceGapped, sourcePosition, target: targetGapped });
    const dirAccessor = dir.x !== 0 ? 'x' : 'y';
    const currDir = dir[dirAccessor];
    let points = [];
    let centerX, centerY;
    …
    // opposite handle positions, default case
    if (sourceDir[dirAccessor] * targetDir[dirAccessor] === -1) {
        if (dirAccessor === 'x') {
            // Primary direction is horizontal, so stepPosition affects X coordinate
            centerX = center.x ?? sourceGapped.x + (targetGapped.x - sourceGapped.x) * stepPosition;
            centerY = center.y ?? (sourceGapped.y + targetGapped.y) / 2;
        } else {
            // Primary direction is vertical, so stepPosition affects Y coordinate
            centerX = center.x ?? (sourceGapped.x + targetGapped.x) / 2;
            centerY = center.y ?? sourceGapped.y + (targetGapped.y - sourceGapped.y) * stepPosition;
        }
        /*
         *    --->
         *    |
         * >---
         */
        const verticalSplit = [
            { x: centerX, y: sourceGapped.y },
            { x: centerX, y: targetGapped.y },
        ];
        /*
         *    |
         *  ---
         *  |
         */
        const horizontalSplit = [
            { x: sourceGapped.x, y: centerY },
            { x: targetGapped.x, y: centerY },
        ];
        if (sourceDir[dirAccessor] === currDir) {
            points = dirAccessor === 'x' ? verticalSplit : horizontalSplit;
        } else {
            points = dirAccessor === 'x' ? horizontalSplit : verticalSplit;
        }
    }
    else { … /* non-default branches NEVER read center */ }
```

### 3.3 What each parameter actually does (measured, not read)

I called the installed `@xyflow/system` under Node (v22.23.1) and printed the real path strings.
Horizontal edge: source `(0,0)` at `Position.Right`, target `(200,100)` at `Position.Left`.

| call | returned path | label |
| --- | --- | --- |
| default | `M0 0L20 0L 95,0Q 100,0 100,5L 100,95Q 100,100 105,100L180 100L200 100` | `100, 50` |
| `centerX: 50` | `M0 0L20 0L 45,0Q 50,0 50,5L 50,95Q 50,100 55,100L180 100L200 100` | `50, 50` |
| `centerY: 99` | *identical to default* | `100, 99` |
| `centerX: 50, centerY: 99` | bends at `x=50` | `50, 99` |
| `stepPosition: 0.1` | `M0 0L20 0L 31,0Q 36,0 36,5L 36,95Q 36,100 41,100L180 100L200 100` | `36, 50` |
| `offset: 80` | `M0 0L80 0L 95,0Q 100,0 100,5L 100,95Q 100,100 105,100L120 100L200 100` | `100, 50` |
| `centerX: 300` (beyond target) | `…L 295,0Q 300,0 300,5L 300,95Q 300,100 295,100L180 100…` | `300, 50` |
| `centerX: -100` | `…L -95,0Q -100,0 -100,5L -100,95…` | `-100, 50` |

Vertical edge: source `(0,0)` `Position.Bottom`, target `(100,200)` `Position.Top`:

| call | returned path | label |
| --- | --- | --- |
| default | `M0 0L0 20L 0,95Q 0,100 5,100L 95,100Q 100,100 100,105L100 180L100 200` | `50, 100` |
| `centerY: 50` | `M0 0L0 20L 0,45Q 0,50 5,50L 95,50Q 100,50 100,55L100 180L100 200` | `50, 50` |
| `centerX: 50` | *identical to default* | `50, 100` |
| `stepPosition: 0.1` | `M0 0L0 20L 0,31Q 0,36 5,36L 95,36Q 100,36 100,41L100 180L100 200` | — |

Same-position handles (Right → Right, `(0,0)` → `(50,100)`) and mixed handles
(Right → Bottom, `(0,0)` → `(100,200)`), with `centerX: 999, centerY: 999`:

| call | result |
| --- | --- |
| `R→R` default | `M0 0L20 0L 65,0Q 70,0 70,5L 70,95Q 70,100 65,100L50 100` |
| `R→R` with `centerX:999, centerY:999` | **byte-identical to default** — `center` is silently ignored |
| `R→B` with `centerX:999, centerY:999` | **byte-identical to default** — silently ignored |
| `R→R` with `stepPosition: 0.1` | **byte-identical to default** — `stepPosition` also ignored here |

**Conclusions, each backed by the code and the run:**

- **`centerX`/`centerY` only work in the "opposite handle positions" branch**
  (`sourceDir[dirAccessor] * targetDir[dirAccessor] === -1`). For same-side handles
  (Right→Right) or mixed handles (Right→Bottom) they are **silently discarded** — no warning,
  no error, just the default path. That is the non-default `else` branch, which never assigns
  the local `centerX`/`centerY` from `center`.
- **Only ONE axis matters for geometry.** `verticalSplit` reads only `centerX`;
  `horizontalSplit` reads only `centerY`. The *other* coordinate flows into the label only.
  So on a horizontal edge `centerX` bends the line and `centerY` merely slides the label
  (measured: `centerY: 99` → identical path, label `100, 99`); on a vertical edge the reverse.
- **There is exactly one bend axis, hence exactly one movable midpoint.** The path is
  `source → gappedSource → split[0] → split[1] → gappedTarget → target`: a fixed 3-segment
  Z/S. There is **no array of waypoints and no way to ask for a second**. Two simultaneous
  midpoints are impossible with `getSmoothStepPath` alone.
- **No clamping.** `centerX: -100` and `centerX: 300` are honoured literally — the path is
  drawn outside the source/target span and self-overlaps. Any drag-handle implementation must
  clamp itself if it wants the line to stay sane.
- **`offset` (default 20)** is the stub length the edge runs *straight out of each handle*
  before turning: `sourceGapped = source + sourceDir * offset`. It is what makes `L20 0`
  appear at the start. It does **not** affect where the bend is; it changes how far the bend
  must be from the handles. Setting it small collapses the stub.
- **`stepPosition` (0..1)** moves the bend along the *primary* axis, but only the same
  opposite-handles branch; measured on the horizontal edge, `0.1` put the bend at `x=36`
  (between `sourceGapped.x=20` and `targetGapped.x=180`, i.e. `20 + 160*0.1`).
  `centerX/centerY` **win over** `stepPosition` whenever supplied (`center.x ?? …`).
  `stepPosition` only became correct (primary-axis-only) after review; the PR thread is
  explicit that the first version moved the label diagonally:
  > "the current implementation applies `stepPosition` as a linear interpolation between
  > source and target for both X and Y coordinates, which causes the bend point (and
  > consequently the label) to move diagonally" — `kennyjwilli`,
  > [xyflow/xyflow#5376](https://github.com/xyflow/xyflow/pull/5376)
  and `moklick` merged it with the caveat *"The `stepPosition` now only affects the default case
  (opposite handle positions) but I think that's fine."* Released in **12.8.2**.
- **`borderRadius` (default 5)** is a *maximum*, not a radius: `getBend` clamps it —
  ```js
  const bendSize = Math.min(distance(a, b) / 2, distance(b, c) / 2, size);
  ```
  and short-circuits to a plain `L` when the corner is collinear:
  ```js
  if ((a.x === x && x === c.x) || (a.y === y && y === c.y)) { return `L${x} ${y}`; }
  ```
  `borderRadius: 0` produces the hard-cornered step path — which is exactly what
  `src/GoblinEdge.tsx` does for `kind === 'step'`.
- **`labelX`/`labelY` come out of `getPoints`, not out of the path**, and are the only
  "where is the middle" signal. `getPoints` returns the `defaultOffsetX/Y` from `getEdgeCenter`
  (computed from raw source/target, **not** from the gapped points) as the last two tuple slots,
  and returns `centerX`/`centerY` — which, on the opposite-handles path, are exactly the values
  fed into the split. So for smoothstep `labelX === center.x` and `labelY === center.y` when
  supplied. On the *non-default* branches, `centerX`/`centerY` are recomputed to the midpoint of
  the longest segment instead (see the `maxXDistance >= maxYDistance` block, L184–194).

### 3.4 The practical upshot for Diagram Studio's `smoothstep` / `step` edges

`getSmoothStepPath` gives a **real, zero-cost single movable midpoint for `step` and
`smoothstep` edges, but only when the two handles are on opposite sides** — which, in Diagram
Studio, is not guaranteed: nodes carry a source AND target handle at each of 8 points
(`NodeHandles` in `DiagramNode.tsx`) with `connectionMode={ConnectionMode.Loose}`, so
"Right → Right" and "Right → Bottom" are ordinary, reachable states. A drag handle built on
`centerX` will therefore work on some edges and silently do nothing on others.

That is an acceptable **cheap first step** (persist `data.mid = {x,y}`, pass `centerX`/`centerY`
for the primary axis, fall back to the current rendering when the branch does not apply), but it
cannot be the whole feature: `straight` and bezier have nothing, and multi-waypoint is out of
reach.

---

## 4. `getBezierPath` and `getStraightPath` — confirmed, no waypoint parameter

### 4.1 The types

`@xyflow/system/dist/esm/utils/edges/bezier-edge.d.ts`:

```ts
export type GetBezierPathParams = {
    sourceX: number; sourceY: number;
    sourcePosition?: Position;      // @default Position.Bottom
    targetX: number; targetY: number;
    targetPosition?: Position;      // @default Position.Top
    /**
     * The curvature of the bezier edge.
     * @default 0.25
     */
    curvature?: number;
};
```

`straight-edge.d.ts`:

```ts
export type GetStraightPathParams = {
    sourceX: number; sourceY: number;
    targetX: number; targetY: number;
};
```

Four numbers. Nothing else. **Confirmed: neither accepts a waypoint, a midpoint, an offset
point, or a control point.** Both return the same 5-tuple
`[path, labelX, labelY, offsetX, offsetY]`.

### 4.2 How the tuple is derived (this is what a custom path must reproduce)

`getStraightPath` — `@xyflow/system/dist/esm/index.mjs` L1213, delegating entirely to
`getEdgeCenter` (L1055):

```js
function getStraightPath({ sourceX, sourceY, targetX, targetY, }) {
    const [labelX, labelY, offsetX, offsetY] = getEdgeCenter({ sourceX, sourceY, targetX, targetY });
    return [`M ${sourceX},${sourceY}L ${targetX},${targetY}`, labelX, labelY, offsetX, offsetY];
}
// this is used for straight edges and simple smoothstep edges (LTR, RTL, BTT, TTB)
function getEdgeCenter({ sourceX, sourceY, targetX, targetY, }) {
    const xOffset = Math.abs(targetX - sourceX) / 2;
    const centerX = targetX < sourceX ? targetX + xOffset : targetX - xOffset;
    const yOffset = Math.abs(targetY - sourceY) / 2;
    const centerY = targetY < sourceY ? targetY + yOffset : targetY - yOffset;
    return [centerX, centerY, xOffset, yOffset];
}
```

So `offsetX`/`offsetY` are **unsigned half-extents**, not signed deltas, despite the name.
`getEdgeCenter` is **public API** (`@xyflow/react/dist/esm/index.d.ts` L40 re-exports
`getEdgeCenter`), so a custom straight path with a waypoint can compute its own label as the
midpoint of the first leg, or simply call `getEdgeCenter` on two sub-segments.

`getBezierPath` — L1018:

```js
function getBezierPath({ sourceX, sourceY, sourcePosition = Position.Bottom, targetX, targetY, targetPosition = Position.Top, curvature = 0.25, }) {
    const [sourceControlX, sourceControlY] = getControlWithCurvature({ pos: sourcePosition, x1: sourceX, y1: sourceY, x2: targetX, y2: targetY, c: curvature });
    const [targetControlX, targetControlY] = getControlWithCurvature({ pos: targetPosition, x1: targetX, y1: targetY, x2: sourceX, y2: sourceY, c: curvature });
    const [labelX, labelY, offsetX, offsetY] = getBezierEdgeCenter({ sourceX, sourceY, targetX, targetY, sourceControlX, sourceControlY, targetControlX, targetControlY });
    return [
        `M${sourceX},${sourceY} C${sourceControlX},${sourceControlY} ${targetControlX},${targetControlY} ${targetX},${targetY}`,
        labelX, labelY, offsetX, offsetY,
    ];
}
```

with the control-point rule (L969–986):

```js
function calculateControlOffset(distance, curvature) {
    if (distance >= 0) { return 0.5 * distance; }
    return curvature * 25 * Math.sqrt(-distance);
}
function getControlWithCurvature({ pos, x1, y1, x2, y2, c }) {
    switch (pos) {
        case Position.Left:   return [x1 - calculateControlOffset(x1 - x2, c), y1];
        case Position.Right:  return [x1 + calculateControlOffset(x2 - x1, c), y1];
        case Position.Top:    return [x1, y1 - calculateControlOffset(y1 - y2, c)];
        case Position.Bottom: return [x1, y1 + calculateControlOffset(y2 - y1, c)];
    }
}
```

and the label rule (L958) — note the comment, which is the exact reason `labelX/labelY` is
**not** the visual middle of the curve:

```js
function getBezierEdgeCenter({ sourceX, sourceY, targetX, targetY, sourceControlX, sourceControlY, targetControlX, targetControlY, }) {
    /*
     * cubic bezier t=0.5 mid point, not the actual mid point, but easy to calculate
     * https://stackoverflow.com/questions/67516101/how-to-find-distance-mid-point-of-bezier-curve
     */
    const centerX = sourceX * 0.125 + sourceControlX * 0.375 + targetControlX * 0.375 + targetX * 0.125;
    const centerY = sourceY * 0.125 + sourceControlY * 0.375 + targetControlY * 0.375 + targetY * 0.125;
    const offsetX = Math.abs(centerX - sourceX);
    const offsetY = Math.abs(centerY - sourceY);
    return [centerX, centerY, offsetX, offsetY];
}
```

`getBezierEdgeCenter` is also **public** (`index.d.ts` L40). A cubic Bézier's `t=0.5` point is
`(P0 + 3·P1 + 3·P2 + P3)/8` — hence the 0.125/0.375/0.375/0.125 weights. It is *not* the point
at half arc length, so a label placed there drifts off the visual middle on strongly curved
edges; that is upstream's own acknowledged trade-off, quoted above.

**Measured sanity check** (`@xyflow/system` under Node, `Right → Left`, `(0,0) → (200,100)`):

```
getBezierPath(H)  → [ 'M0,0 C100,0 100,100 200,100', 100, 50, 100, 50 ]
getStraightPath   → [ 'M 0,0L 200,100',             100, 50, 100, 50 ]
```

Both control points are `(100,0)` and `(100,100)`: each is offset from its own handle by
`0.5 * (targetX - sourceX) = 100` along the handle's own axis. That is the only knob
`curvature` scales, and it is why a single scalar cannot express "bend through this point".

### 4.3 What a custom implementation must therefore do

To make bezier (or straight) respect a waypoint, **you write the path string yourself** and
recompute the label. Nothing in the library will do it. The realistic recipe:

- **Straight + one waypoint.** A polyline through the waypoint:
  `` `M ${sx},${sy} L ${wx},${wy} L ${tx},${ty}` ``. Label: the midpoint of the *longer*
  segment (which is what `tisoap`'s `pointAlongPolyline(segment, 0.5)` generalises), or
  `getEdgeCenter` on the first leg.
- **Bezier + one waypoint.** A **quadratic** through the waypoint, i.e.
  `M sx,sy Q cx,cy tx,ty`, where the control point is solved so the curve passes through `W`
  at `t=0.5`: `Q(0.5) = 0.25·S + 0.5·C + 0.25·T`, hence `C = 2W − (S+T)/2`. This is the
  standard "one-handle" bend and it keeps the tangent sensible. Alternative: keep the cubic and
  split it into two cubics meeting at `W` (a "two-segment" bend) — more code, smoother joins,
  and it is what a multi-waypoint version needs anyway.
- **Label for a custom curve.** You must supply `labelX`/`labelY` yourself, because
  `<BaseEdge>` only renders its built-in label when they are numeric:
  ```js
  label && isNumeric(labelX) && isNumeric(labelY) ? (jsx(EdgeText, { x: labelX, y: labelY, … })) : null
  ```
  (`@xyflow/react/dist/esm/index.mjs`, `BaseEdge`, L2587). If you pass no label coordinates,
  **the edge label silently disappears** — this is the single most likely way to break
  Diagram Studio, whose `GoblinEdge` renders its own label in `EdgeLabelRenderer` from
  `labelX`/`labelY` but also feeds them into the flow-animation `labelOffset` maths.
  For a quadratic the exact `t=0.5` point is `(S + 2C + T)/4`; for a polyline use the
  arc-length half point.
- **`offsetX`/`offsetY`.** Used by `<BaseEdge>`'s default `EdgeText` background sizing and by
  anything that positions a label relative to the source. For a custom path, derive them as
  `Math.abs(labelX - sourceX)` / `Math.abs(labelY - sourceY)` — that is precisely the rule
  `getBezierEdgeCenter` and `getEdgeCenter` both implement.

**Diagram Studio caveat (measured):** `src/GoblinEdge.tsx` recomputes its own label position
from `labelX`/`labelY`:

```tsx
const labelOffset = {center: 0.5, start: 0.25, end: 0.75}[d.offset ?? 'center'];
const lx = sourceX + (targetX - sourceX) * labelOffset + (labelX - (sourceX + targetX) / 2);
const ly = sourceY + (targetY - sourceY) * labelOffset + (labelY - (sourceY + targetY) / 2);
```

That is `labelX/labelY` *rebased* onto a `start/center/end` fraction of the straight source→target
line. **Any custom label coordinate a new path generator returns will be shifted by this same
transformation.** A waypoint-dragging implementation that wants the label to travel with the
bend must either (a) feed a `labelX/labelY` that survives the rebasing, or (b) short-circuit the
rebasing for edges that carry a waypoint. `labelX`/`labelY` are **not** simply "where the label
goes" in this app.

---

## 5. The realistic implementation patterns

### 5.1 Pattern A — DOM handle in `EdgeLabelRenderer` (recommended)

This is what `tisoap` uses for the *segment* affordances and what `aleph` PR #20 explicitly
switched to, with the reason stated in the commit message:

> "Render draggable waypoints in `EdgeLabelRenderer` for reliable hit targets" —
> commit `a28c68d`, [rolamCodes/aleph#20](https://github.com/rolamCodes/aleph/pull/20)

and what React Flow's own `EdgeToolbar` does. Structure inside the custom edge:

```tsx
<>
  <BaseEdge id={id} path={path} … />
  {selected && (
    <EdgeLabelRenderer>
      <div
        className="mid-handle nopan nodrag"           // nopan is required; nodrag is free
        style={{
          position: 'absolute',
          transform: `translate(-50%, -50%) translate(${mx}px, ${my}px)`,
          pointerEvents: 'all',                        // the container is pointer-events:none
        }}
        onPointerDown={onDown}
      />
    </EdgeLabelRenderer>
  )}
</>
```

Why this beats an SVG circle inside the edge:

- The container is a **plain div layer** above the edges SVG (`.react-flow__edgelabel-renderer`
  is a sibling of `.react-flow__edges` inside `.react-flow__viewport`), so the handle is not
  inside `.react-flow__edge` and therefore **not in the event path of `onEdgeClick`** →
  no `addSelectedEdges`/deselect ambiguity, and no `pointer-events: visibleStroke` weirdness
  from the SVG.
- A div can be given a real hit area (`width/height`) rather than a transparent-stroke circle;
  it can be sized in screen pixels and counter-scaled with
  `scale(${1 / zoom})` exactly like `getEdgeToolbarTransform` does, so a 12px handle stays a
  12px handle at every zoom level — whereas an SVG circle inside the viewport **scales with the
  zoom**.
- Flow coordinates are free: the portal sits inside the transformed viewport, so
  `translate(mx px, my px)` uses flow units directly.

**Keeping out of the edge label's way.** In Diagram Studio the label is *also* in
`EdgeLabelRenderer`, at `(lx, ly)`, with `pointer-events: all` (`src/styles.css` `.edge-label`).
Two concrete mitigations, both cheap:

1. **Offset the handle from the label along the path normal by ≥ (label half-height + handle
   radius)**, i.e. place the midpoint handle on a different point of the path than the label.
   For the smoothstep case, the split point *is* the label point, so an offset is mandatory.
2. **Prefer the label as the drag target when the label exists** (make the existing
   `.edge-label` div draggable when the edge is selected) and show a separate dot only on edges
   with no label. `aleph` chose the opposite trade-off — always a separate dot — and its own
   author then rejected the whole design (see §5.5).

**Drag mechanics.** Copy the `tisoap`/`ControlPoint` shape: `onPointerDown` sets dragging and
captures nothing (so text selection and clicks elsewhere are unaffected), then
`pointermove`/`pointerup`/`pointerleave` listeners on `store.domNode` (React Flow's own root)
convert `clientX/clientY` with `screenToFlowPosition`:

```js
screenToFlowPosition: (clientPosition, options = {}) => {
    const { transform, snapGrid, snapToGrid, domNode } = store.getState();
    if (!domNode) { return clientPosition; }
    const { x: domX, y: domY } = domNode.getBoundingClientRect();
    const correctedPosition = { x: clientPosition.x - domX, y: clientPosition.y - domY };
    const _snapGrid = options.snapGrid ?? snapGrid;
    const _snapToGrid = options.snapToGrid ?? snapToGrid;
    return pointToRendererPoint(correctedPosition, transform, _snapToGrid, _snapGrid);
},
```

(`@xyflow/react/dist/esm/index.mjs` L559; `pointToRendererPoint` is
`{x:(x-tx)/scale, y:(y-ty)/scale}` with optional `snapPosition`, `@xyflow/system` L611.)

Note `screenToFlowPosition` **honours `snapToGrid` by default**. Diagram Studio passes
`snapToGrid={snap}` and `snapGrid={[gridSize, gridSize]}` (`src/App.tsx:3777`), so a waypoint
drag would snap when the grid toggle is on, with no extra code — and would need
`{snapToGrid: false}` to opt out. That is a free win and a free surprise.

### 5.2 Pattern B — SVG element inside the custom edge

`tisoap`'s shipped `ControlPoint` is Pattern B: a `<circle>` rendered as a sibling of
`BaseEdge`, inside the edge's own `<g>`:

```tsx
<circle
  ref={ref}
  tabIndex={0}
  data-testid="smart-edge-control-point"
  className={`nopan nodrag${active ? " active" : ""}`}
  cx={x} cy={y}
  r={active ? 4 : 3}
  strokeWidth={1}
  strokeOpacity={active ? 1 : 0.3}
  stroke={color}
  fill={active ? color : "white"}
  style={{ pointerEvents: "all", cursor: "pointer" }}
  onContextMenu={(event) => { event.preventDefault(); if (active) { deletePoint(); } }}
  onPointerDown={(event) => {
      if (event.button === 2) return;
      updatePosition({ x, y });
      if (active) { setDragging(true); }
  }}
  onKeyDown={handleKeyDown}
  onPointerUp={() => { setDragging(false); }}
/>
```

Pros: no portal, exact flow coordinates, no zoom counter-scaling needed if you *want* the dot
to scale. Cons, all real:

- The handle scales with zoom (a 4-flow-unit dot is 2 px at 0.5× — effectively unclickable at
  the min zoom Diagram Studio allows).
- It sits inside `.react-flow__edge`, whose CSS is
  `.react-flow__edge { pointer-events: visibleStroke; }`, so the circle needs
  `pointer-events: all` explicitly (it has it) and any click on it can also reach
  `onEdgeClick`.
- The edge `<svg>` gets `overflow: visible` (`.react-flow .react-flow__edges svg`), so the
  handle will still paint outside the SVG box — but it is clipped by nothing, which also means
  it can land under nodes.
- It cannot be given a CSS-positioned hit box wider than its own geometry, which is the exact
  complaint `aleph`'s commit message reports ("for reliable hit targets").

### 5.3 Pattern C — split into sub-segments (n8n's approach; not a waypoint system)

n8n, which uses `@vue-flow/core` (the same system package, Vue bindings), does **not** have
waypoints. It solves the overlapping-backwards-connection problem by generating the path as
**two smoothstep segments** and rendering one `<BaseEdge>` per segment
(`packages/frontend/editor-ui/src/features/workflows/canvas/components/elements/edges/utils/getEdgeRenderData.ts`):

```ts
// Connection is backwards and the source is on the right side
// -> We need to avoid overlapping the source node
const firstSegmentTargetX = (sourceX + targetX) / 2;
const firstSegmentTargetY = sourceY + EDGE_PADDING_BOTTOM;
const firstSegment = getSmoothStepPath({
    sourceX, sourceY,
    targetX: firstSegmentTargetX, targetY: firstSegmentTargetY,
    sourcePosition, targetPosition: Position.Right,
    borderRadius: EDGE_BORDER_RADIUS, offset: EDGE_PADDING_X,
});
const secondSegment = getSmoothStepPath({
    sourceX: firstSegmentTargetX, sourceY: firstSegmentTargetY,
    targetX, targetY,
    sourcePosition: Position.Left, targetPosition,
    borderRadius: EDGE_BORDER_RADIUS, offset: EDGE_PADDING_X,
});
return { segments: [firstSegment, secondSegment], labelPosition: [firstSegmentTargetX, firstSegmentTargetY], isConnectorStraight };
```

and `CanvasEdge.vue` renders the array:

```vue
<BaseEdge
    v-for="(segment, index) in segments"
    :id="`${id}-${index}`"
    :key="segment[0]"
    :path="segment[0]"
    :marker-end="isMainConnection ? markerEnd : undefined"
    :interaction-width="40"
/>
```

The waypoint value here is the **technique**: chaining generators across a synthetic intermediate
node is exactly how a multi-waypoint edge is built on top of a library that only knows two
points. The cost is that each sub-path is a separate `<path>` (two `interactionWidth` hit paths,
two `L` joins that can leave a visible seam at the joint if the tangent directions disagree).
n8n's `EDGE_PADDING_BOTTOM = 130 / EDGE_PADDING_X = 40 / EDGE_BORDER_RADIUS = 16` are hard-coded
constants — there is no user-facing waypoint in n8n at all.

LangFlow is a negative result: `src/frontend/src/CustomEdges/index.tsx` renders one `BaseEdge`
plus an invisible `react-flow__edge-interaction` path wrapped in a context menu, and carries no
waypoint concept — its one piece of custom geometry is a hand-built cubic for output-type
handles: `` `M ${sx} ${sy} C ${sx + distance} ${sy + sourceDistanceY}, ${tx - distance} ${ty + distanceY}, ${tx} ${ty}` ``.

### 5.4 Where to store the offset, and how it interacts with React Flow's state

**Store it in `edge.data`.** That is what both real implementations do:

- `tisoap`: `edge.data.points` as `ControlPointData[]` = `{ id, x, y, active? }`
  (`smartEdgeData.ts`), read defensively:
  ```ts
  export const readControlPoints = (data: unknown): ControlPointData[] => {
    if (isRecord(data) && "points" in data && isControlPointArray(data["points"])) { return data["points"]; }
    return [];
  };
  ```
  and documented as *"Waypoints are stored on `edge.data.points` as `ControlPointData`
  (`{ id, x, y, active }`). Your flow must let React Flow own the edges (`useEdgesState`,
  `defaultEdges`, or controlled `edges`/`onEdgesChange`)."*
- `aleph` PR #20: *"Waypoints persist in `edge.data.points` via the existing graph save path
  (legacy `bend` values upgrade on next save)."*

**Two storage shapes are in play and Diagram Studio should pick one deliberately:**

| shape | meaning | survives a node move? |
| --- | --- | --- |
| **absolute flow coords** (`{x, y}`, what both precedents store) | the waypoint is pinned to the canvas | No — the line no longer passes through it sensibly when nodes move; the user must re-drag |
| **relative / normalised** `{t, d}` (fraction along source→target, perpendicular distance) | the bend travels with the edge | Yes |

Both precedents store **absolute** coordinates. That is the honest default for a
draw.io-style tool (draw.io also stores absolute `mxPoint`s in `mxGeometry.points`) and it is
what Harvey's request describes ("kéo cái connection line đó ra vị trí khác cho đẹp"). But it has
a real consequence: dragging a node afterwards leaves the waypoint behind, and the path can
become ugly or self-crossing. `[UNVERIFIED]` — I found no React Flow library that solves this;
the mitigation is either recomputing the waypoint as a delta on node drag or normalising it.
This is the strongest argument for storing **both** (absolute for render, plus the source/target
positions it was authored against, so a node move can translate it).

**Interaction with React Flow's own edge state:**

- `data` is passed straight through to the custom edge as `EdgeProps['data']`
  (`EdgeWrapper` → `data: edge.data`), so the render path reads `data.mid` with no extra
  plumbing — exactly how `__type` and `shape` already work in `src/GoblinEdge.tsx`.
- **Do not mutate.** React Flow only re-renders an edge when the `data` object identity changes;
  write with `setEdges(es => es.map(e => e.id === id ? {...e, data: {...e.data, mid}} : e))`
  (or `updateEdgeData` from `useReactFlow()` — `@xyflow/react/dist/esm/types/instance.d.ts`
  L178 exposes `updateEdgeData: (id, dataUpdate, options?: {replace?: boolean})`). The installed
  implementation is `@xyflow/react/dist/esm/index.mjs` L1088:
  ```js
  const updateEdge = (id, edgeUpdate, options = { replace: false }) => {
      setEdges((prevEdges) => prevEdges.map((edge) => {
          if (edge.id === id) {
              const nextEdge = typeof edgeUpdate === 'function' ? edgeUpdate(edge) : edgeUpdate;
              return options.replace && isEdge(nextEdge) ? nextEdge : { ...edge, ...nextEdge };
          }
          return edge;
      }));
  };
  ```
- **Edge identity is the id, and the id is derived from the endpoints.** `getEdgeId`
  (`@xyflow/system` general.d.ts) is `(source, sourceHandle, target, targetHandle)` — so a
  waypoint stored in `data` is safe across an end-drag **only because** `reconnectEdge` keeps
  the old edge's `rest`:
  ```js
  const reconnectEdge = (oldEdge, newConnection, edges, options = { shouldReplaceId: true }) => {
      const { id: oldEdgeId, ...rest } = oldEdge;
      …
      const edge = { ...rest, id: options.shouldReplaceId ? edgeIdGenerator(newConnection) : oldEdgeId,
          source: newConnection.source, target: newConnection.target,
          sourceHandle: newConnection.sourceHandle, targetHandle: newConnection.targetHandle };
      return edges.filter((e) => e.id !== oldEdgeId).concat(edge);
  };
  ```
  `rest` includes `data`, so **the waypoint survives a reconnect but may now be nonsense**
  (it was authored against the old endpoints). If Diagram Studio's `onReconnect` should clear
  `data.mid`, that must be done explicitly in
  `src/App.tsx:1540`'s `onReconnect` callback — React Flow will not do it.
- **Undo.** Diagram Studio's history is a whole-array snapshot:
  ```tsx
  const snapshot = useCallback((): Snap => ({
      nodes: nodesRef.current.map(n => ({ ...n, position: {...n.position}, data: {...(n.data as any)}, selected: false })),
      edges: edgesRef.current.map(e => ({...e, selected: false})),
  }), []);
  const pushHistory = useCallback(() => { past.current.push(snapshot()); … }, [snapshot]);
  ```
  (`src/App.tsx:1144`). Because it copies the whole `edges` array, **a waypoint move is
  undoable for free** — *provided* the waypoint lives on the edge object and the code calls
  `pushHistory()` exactly once per gesture. The existing precedent in the app is
  `onNodeDragStart` → `pushHistory()` (`src/App.tsx:1536`) and the reconnect handler
  (`src/App.tsx:1541`): **one push at gesture start, not per move.** A midpoint drag must follow
  the same rule, otherwise a 40-pointermove drag leaves 40 undo steps. Note also that
  `pushHistory` is currently a no-argument callback closed over `nodesRef`/`edgesRef`, so it can
  be called from anywhere without prop drilling.
- **Persistence / export.** `data` is serialised with the rest of the graph by whatever writes
  the board JSON, so a waypoint in `data` needs no new persistence code — and
  `copySelection`/`pasteClipboard` copy edges with `{...e}` (shallow), so a nested `data.mid`
  object would be **shared by reference between the original and the pasted edge**
  (`src/App.tsx:1190`/`1208`). Copying a waypointed edge and dragging the copy's midpoint would
  mutate the original's data. Either deep-copy `data` on paste or store `mid` as two numbers
  (`data.midX`, `data.midY`) so the shallow spread is sufficient.

### 5.5 Precedents — repos, files, and what each one proves

| precedent | URL (fetched) | files read | what it establishes |
| --- | --- | --- | --- |
| **`tisoap/react-flow-smart-edge`** (360★, MIT, RF12) | https://github.com/tisoap/react-flow-smart-edge | `src/SmartEdge/ControlPoint.tsx`, `src/SmartEdge/controlPointGeometry.ts`, `src/SmartEdge/smartEdgeData.ts`, `src/SmartEdge/renderDecision.tsx`, `src/SmartEdge/index.tsx`, `src/createSmartEdge/index.tsx`, `src/SmartEditableEdge/index.tsx` | The most complete OSS waypoint implementation found: handle component, interleaved active/inactive control points, insert-on-click, delete-on-right-click/Delete, arrow-key nudge, persistence to `edge.data.points`, reveal-on-select |
| `tisoap` docs | https://tisoap.github.io/react-flow-smart-edge/docs/guides/editable-edges , …/options/editable , …/api/get-smart-edge-waypoints , …/options/checkpoints | — | Interaction contract in prose; `{ id, x, y, active }` data shape; the "click a hollow point to add a waypoint" idiom |
| **`rolamCodes/aleph` PR #20** | https://github.com/rolamCodes/aleph/pull/20 | `src/InteractionEdge.tsx`, `src/edgePath.ts`, `src/types.ts` | Confirms the `EdgeLabelRenderer`-for-reliable-hit-targets choice; confirms the "select edge to enter edit mode; drag segment to translate; click segment to add a waypoint; double-click waypoint to remove" interaction set; **and its own rejection** |
| React Flow Pro **Editable Edge** | https://reactflow.dev/examples/edges/editable-edge , https://reactflow.dev/pro/content | — | The reference implementation of this exact feature exists but is **Pro-only**, source not public |
| **n8n** | https://github.com/n8n-io/n8n (`master`) | `packages/frontend/editor-ui/src/features/workflows/canvas/components/elements/edges/CanvasEdge.vue`, `…/utils/getEdgeRenderData.ts` | A large production node editor on the same `@xyflow/system` core has **no waypoints**; it routes backwards edges by chaining two `getSmoothStepPath` calls and rendering `segments[]` |
| **LangFlow** | https://github.com/langflow-ai/langflow (`main`) | `src/frontend/src/CustomEdges/index.tsx` | No waypoints; only a hand-written cubic string for its output-type handles |
| `Jalez/react-flow-smart-edge` | https://github.com/Jalez/react-flow-smart-edge (README) | — | Tells you the upstream package was `reactflow`-era and had to be forked for `@xyflow/react` v12 — a warning about pinning to the wrong major |
| upstream issue trail | [#741](https://github.com/xyflow/xyflow/issues/741), [#1623](https://github.com/xyflow/xyflow/issues/1623), [#4581](https://github.com/xyflow/xyflow/issues/4581), [#4766](https://github.com/xyflow/xyflow/issues/4766), [#5376](https://github.com/xyflow/xyflow/pull/5376) | — | Maintainer's explicit "implement a custom edge type"; `stepPosition` provenance and its known limitation; a real bug in the Pro example |

#### The `tisoap` waypoint geometry (worth copying)

`controlPointGeometry.ts` is the piece that answers "where do the dots go and what is
clicked":

```ts
/** Returns the point at the given fraction (0..1) of a polyline's arc length. */
export const pointAlongPolyline = (polyline: number[][], fraction: number): XYPosition => { … };

/** Index of the polyline vertex closest to `point`, searching from `from` (exclusive of the endpoints) onward. */
export const closestVertexIndex = (polyline: number[][], point: ControlPointData, from: number): number => { … };

/** Splits the routed polyline into one sub-polyline per segment, cutting at the vertex nearest each waypoint. */
export const splitPolylineAtWaypoints = (polyline: number[][], waypoints: ControlPointData[]): number[][][] => { … };

/**
 * Builds the interleaved control point list `[inactive, active, inactive, ...]`
 * from the active waypoints plus an inactive "insert" point at the midpoint of
 * each routed segment.
 */
export const buildControlPoints = (source, target, activePoints, routedInterior): ControlPointData[] => {
  const polyline = [[source.x, source.y], ...routedInterior, [target.x, target.y]];
  const segments = splitPolylineAtWaypoints(polyline, activePoints);
  const result: ControlPointData[] = [];
  segments.forEach((segment, segmentIndex) => {
    const midpoint = pointAlongPolyline(segment, 0.5);
    result.push({ id: `__inactive-${String(segmentIndex)}`, x: midpoint.x, y: midpoint.y, active: false });
    if (segmentIndex < activePoints.length) { result.push(activePoints[segmentIndex]); }
  });
  return result;
};
```

The **interleaving invariant** is the clever bit and is documented in `ControlPoint.tsx`:

```tsx
// Promote an inactive (insert) point to a new active waypoint with a
// fresh id. Inactive points sit at even visual indices, active points
// at odd indices, so the active-list insertion index is `index/2 - 1`.
if (index !== 0) {
  const insertAfter = index * 0.5 - 1;
  return points.flatMap((point, pointIndex) =>
    pointIndex === insertAfter ? [point, newPoint] : [point],
  );
}
```

This gives "click the hollow dot at the middle of a leg to add a bend" — which is exactly
Harvey's request — without a separate insertion mode. Also note how it is *revealed*:

```tsx
showControlPoints={Boolean(edgeProps.selected) || endpointsSelected}
```

i.e. **selecting either endpoint node also reveals the edge's waypoints** — a nice touch given
Diagram Studio already has a node/edge selection concept.

#### The cautionary precedent: `aleph` PR #20 was closed rejected

Same repo, same problem, same library, and the author's verdict after building it:

> **"Big fail. Too complex. User would have to micro manage every edge."** — `rolamCodes`,
> closing his own PR, 2025-09-17

and before that, in the PR body: *"Replaces the rejected single stretch grip and endpoint
reconnect with MIT-licensed editable edges."* The feature set he shipped (select an edge →
segment hits + waypoint handles appear; drag a waypoint; drag a segment to translate it, which
on a straight edge inserts two offset waypoints; click a segment to add a waypoint; double-click
a waypoint to remove it) is *more* capable than what Harvey asked for, and it was judged worse.

**The design lesson, which this report should carry forward: reveal waypoints only on the
selected edge, and prefer the smallest possible affordance.** Harvey's framing is deliberately
minimal — "1 vài dot ở giữa để kéo cái connection line ra vị trí khác cho đẹp". A single
movable midpoint on the selected edge is closer to his intent than a fully editable waypoint
polyline, and the `aleph` outcome is evidence for that.

---

## 6. Limitations / gotchas — what breaks

Each item below is grounded in a specific line of the installed source.

1. **`centerX`/`centerY` are silently discarded on non-opposite handles.** The `else` branch of
   `getPoints` never reads `center`; measured `R→R` and `R→B` returned byte-identical default
   paths with `centerX:999, centerY:999`. Diagram Studio runs `connectionMode={ConnectionMode.Loose}`
   with 8 bidirectional handle points per node, so **same-side connections are routine** and a
   `centerX`-based handle will appear to work on some edges and do nothing on others, with no
   error. Any implementation must detect the branch (or, better, not depend on it).

2. **`centerY` on a horizontal edge moves the label, not the line.** Measured: path unchanged,
   `labelY` became 99. A drag handle that writes both coordinates from the pointer will move
   the label to the cursor while the line stays put — a confusing half-working feel.

3. **`centerX`/`centerY` are not persisted by anything.** They are per-call parameters. React
   Flow never stores them, never re-supplies them, and `EdgeBase` has no field for them. If you
   do not write them into `edge.data` yourself, the bend vanishes on the next render — and it
   *will* re-render, because `EdgeWrapper` recomputes `sourceX/sourceY/targetX/targetY` from
   `nodeLookup` on every node move (`useStore(useCallback(store => { … getEdgePosition({…}) … }))`).

4. **`stepPosition` is also branch-limited and was shipped with that caveat.** `moklick` on
   PR #5376: *"The `stepPosition` now only affects the default case (opposite handle positions)
   but I think that's fine."* Measured: identical path for `R→R`.

5. **"Handle is screen-constant vs node-local" is a real fork in the road.** An SVG circle
   inside the viewport scales with zoom (unusable at `minZoom = 0.5`, which Diagram Studio
   allows via React Flow's default); a DOM handle in `EdgeLabelRenderer` does not, **provided**
   you counter-scale. React Flow ships the arithmetic: `getEdgeToolbarTransform(x, y, zoom)`
   → `` `translate(${x}px, ${y}px) scale(${1 / zoom}) translate(-50%, -50%)` ``.
   Diagram Studio already counter-scales its own edge label
   (`.edge-label { transform: scale(var(--canvas-zoom-compensation-factor, 1)) … }` in the n8n
   module CSS is the sibling idea; Diagram Studio's `.edge-label` does **not** counter-scale,
   which is why its labels shrink on zoom-out — a decision to keep consistent, not fix here).

6. **Edge-click selection competes with the handle hit-test.** `.react-flow__edge` is
   `pointer-events: visibleStroke` and carries `onClick: onEdgeClick`, which calls
   `store.getState().addSelectedEdges([id])` (or toggles it off under `multiSelectionActive`).
   A handle inside the edge group inherits that event path. `EdgeLabelRenderer` avoids the
   problem entirely because it is a sibling of the edges SVG — this is the single strongest
   technical argument for Pattern A.

7. **`EdgeLabelRenderer` starts at `pointer-events: none`.** Forgetting
   `style={{ pointerEvents: 'all' }}` produces a perfectly visible, perfectly dead handle.
   Forgetting `nopan` produces a handle that pans the viewport when dragged. Both are stated in
   the component JSDoc and repeated on the docs page.

8. **`nodrag` is irrelevant in `EdgeLabelRenderer` but harmless** — d3-drag only inspects nodes
   (`.filter` in `XYDrag.update` excludes `nodrag` inside a node's drag handle), and
   `noPanClassName` filtering is via `createFilter`'s `isWrappedWithClass(event, noPanClassName)`.
   Adding both classes is the safe, conventional choice (`EdgeToolbar` adds neither, and relies
   on `pointerEvents: 'all'` alone — `[UNVERIFIED]` whether panning can start from an
   `EdgeToolbar` drag).

9. **`nodeDragThreshold` / `nodeClickDistance` do not gate a DOM handle.** They are d3-drag
   wiring for *nodes* and for `XYHandle` connection drags:
   `dragThreshold: store.getState().connectionDragThreshold` appears in both `EdgeUpdateAnchors`
   (L2914) and the Handle component (L1916), and `useDrag({ …, nodeClickDistance })` at L1678.
   A pointer-driven `EdgeLabelRenderer` handle is outside both systems, so it needs its own
   drag threshold if tremor matters. **Diagram Studio has already solved the general problem
   once** and documented it in `src/touch.ts` — the click/drag dead band (GATE 1 =
   `nodeClickDistance` via d3-drag's `clickDistance`, GATE 2 = `nodeDragThreshold`), with the
   rule *"`nodeClickDistance` MUST EQUAL `nodeDragThreshold`, per pointer class"*, and
   `FINE_DRAG_THRESHOLD_PX = 4` / `COARSE_DRAG_THRESHOLD_PX = 6`. A midpoint handle should
   reuse those two constants as its own threshold so the canvas has **one** drag feel. Note
   also that Diagram Studio's long-press handler resolves a press to an edge via
   `el.closest('.react-flow__edge')` and explicitly **ignores presses on
   `.react-flow__handle`** — a new handle class must be added to that exclusion list, or a
   long-press on the midpoint dot opens the edge context menu (`src/touch.ts` `resolveTarget`).

10. **Multiple waypoints are impossible with `getSmoothStepPath`.** It produces a fixed
    3-interior-point Z/S. For N waypoints you must either chain generators (n8n's
    `segments[]` technique) or write the path string yourself. `[UNVERIFIED]` — I did not
    benchmark the chained-segment approach in Diagram Studio.

11. **A custom path string silently drops the label if you forget `labelX`/`labelY`.**
    `<BaseEdge>` renders its built-in label only when
    `label && isNumeric(labelX) && isNumeric(labelY)`. Diagram Studio's `GoblinEdge` computes
    `labelX`/`labelY` from the generator tuple, so a hand-built path must still return
    coordinates — and they are then **rebased onto `d.offset`'s
    `start/center/end` fraction** (`src/App.tsx`-adjacent maths in `GoblinEdge.tsx` lines
    125–127), so the label will not sit at the bend unless that rebasing is bypassed.

12. **The Pro example itself had a waypoint-id bug.** [xyflow/xyflow#4581](https://github.com/xyflow/xyflow/issues/4581):
    *"create a control point / remove it / create the same control point again / remove it /
    now an unwanted control point will be stuck in the screen"* — reported against
    `reactflow.dev/examples/edges/editable-edge`, fixed 2024-09-04 by
    `hayleigh-dot-dev`: *"it was some funkiness with the hook used to assign ids to the
    temporary control points."* **Waypoint ids must be stable and unique per point**; `tisoap`
    uses `crypto.randomUUID()` for promoted points and deterministic `__inactive-${i}` ids for
    the ephemeral ones, which sidesteps the class of bug. Do not index by array position.

13. **Absolute waypoint coordinates go stale when nodes move.** Neither precedent solves this;
    both store canvas coordinates. With Diagram Studio's undo snapshot restoring *whole
    positions*, moving a node after placing a waypoint leaves the waypoint where the node used
    to be. `[UNVERIFIED]` — no library found that handles it; the options are to translate the
    waypoint by the node's delta on drag, or to normalise it against the source→target vector.

14. **A shallow edge copy shares the nested `data` object.**
    `copySelection` stores `edges: …filter(…).map(e => ({...e}))` and `pasteClipboard` re-uses
    `data` by reference (`src/App.tsx:1190`, `1208`). A `data.mid = {x,y}` object would be
    shared between original and paste; two flat numbers would not.

---

## 7. What is directly portable to Diagram Studio — the actionable part

Ordered cheapest-first, each keyed to the source evidence above.

**Step 1 — free win, no new UI: move the midpoint from the *panel*, not the canvas.**
`stepPosition` (0..1) and `offset` already exist in `GetSmoothStepPathParams` and already work
for `step`/`smoothstep` with opposite handles. A slider in the existing edge inspector that
writes `data.step` and passes `stepPosition: d.step` in `src/GoblinEdge.tsx`'s
`getSmoothStepPath({...pathOpts, borderRadius: 12})` call is ~10 lines, needs no drag maths, and
is undo-able for free (the existing `updateEdge` already calls `pushHistory()`).
Caveat to surface in the UI: it does nothing on same-side handles (gotcha 1/4).
`stepPosition` was added in **12.8.2**; the installed **12.11.6** has it.

**Step 2 — the single movable midpoint, `smoothstep`/`step` only.** Persist
`data.mid = {x, y}` (two flat numbers, or a nested object with a deep copy on paste), pass
`centerX`/`centerY` on the primary axis, and render the handle as a DOM element in
`EdgeLabelRenderer` when `selected` — copying `EdgeToolbar`'s structure and
`getEdgeToolbarTransform`'s counter-scaling, and `ControlPoint`'s pointer plumbing
(`screenToFlowPosition`, listeners on `store.domNode`, `pointerup`/`pointerleave` with
`{ once: true }`). Guard: only render/pass `centerX`/`centerY` when the two handle positions are
opposite (compare `sourcePosition`/`targetPosition`), so the handle is never offered where the
parameter is ignored. Push history once, on `pointerdown`.

**Step 3 — `straight` and bezier.** Requires a custom path string. For one waypoint:
quadratic through the point, `C = 2W − (S+T)/2`, path `` `M${sx},${sy} Q${cx},${cy} ${tx},${ty}` ``,
label at `(S + 2C + T)/4`. For a `straight` edge, a polyline `M…L…L…` with the label at the
arc-length midpoint of the longer leg (`pointAlongPolyline(…, 0.5)` from `tisoap`
`controlPointGeometry.ts` is 20 lines and directly reusable). In both cases supply
`labelX`/`labelY`, and **decide what `data.offset`'s rebasing should do** for a waypointed edge.

**Step 4 — multiple waypoints (only if Harvey asks).** Store `data.points` as
`{id, x, y, active?}[]` exactly as `tisoap` does, and either chain generators per segment (n8n)
or build the path string. Reuse the interleaved active/inactive control-point list and the
"click the hollow dot to insert" idiom. **Reveal only on the selected edge** — the `aleph`
rejection is the evidence that a full waypoint editor is the wrong default here.

**Things to copy verbatim, and from where:**
- The `EdgeLabelRenderer` + `pointerEvents:'all'` + `nopan` + `scale(1/zoom)` pattern:
  `@xyflow/react` `EdgeToolbar` / `getEdgeToolbarTransform`.
- The pointer-drag-with-`screenToFlowPosition` pattern and the `{ once: true }` listener
  cleanup: `tisoap` `ControlPoint.tsx`.
- The id discipline (`crypto.randomUUID()` for real points, deterministic ids for ephemeral
  ones): `tisoap` `ControlPoint.tsx`, motivated by upstream bug #4581.
- The "one `pushHistory()` at gesture start" rule: already established in `src/App.tsx`
  (`onNodeDragStart`, `onReconnect`) and in `src/touch.ts`'s threshold constants.
- The `readControlPoints(data)` defensive parse: `tisoap` `smartEdgeData.ts` — worth copying so
  boards saved before the feature existed do not crash the edge.

**What NOT to copy:** `EdgeAnchor`/`EdgeUpdateAnchors` (that is the existing reconnect feature
Harvey wants to keep, not replace); anything that renders the handle inside the edge `<svg>` if
screen-constant sizing is wanted.

---

## 8. Sources (every URL fetched, with what it evidenced)

**Installed library (primary; local paths, no URL):**
1. `node_modules/@xyflow/system/package.json` — version `0.0.82`.
2. `node_modules/@xyflow/react/package.json` — version `12.11.6`.
3. `@xyflow/system/dist/esm/utils/edges/smoothstep-edge.d.ts` — `GetSmoothStepPathParams` full definition incl. `centerX`/`centerY`/`offset`/`stepPosition`.
4. `@xyflow/system/dist/esm/index.mjs` — `getSmoothStepPath` (L1411), `getPoints` (L1240), `getBend` (L1363), `getBezierPath` (L1018), `getBezierEdgeCenter` (L958), `getControlWithCurvature` (L975), `calculateControlOffset` (L969), `getStraightPath` (L1213), `getEdgeCenter` (L1055), `reconnectEdge` (L1160), `getEdgeToolbarTransform` (L1598), `pointToRendererPoint`/`rendererPointToPoint` (L611/618), `getEdgePosition` (L1434).
5. `@xyflow/system/dist/esm/utils/edges/bezier-edge.d.ts` — `GetBezierPathParams` has no waypoint field.
6. `@xyflow/system/dist/esm/utils/edges/straight-edge.d.ts` — `GetStraightPathParams` is 4 numbers.
7. `@xyflow/system/dist/esm/types/edges.d.ts` — `EdgeBase`, `SmoothStepPathOptions`, `StepPathOptions`, `BezierPathOptions`, `EdgePosition`.
8. `@xyflow/system/dist/esm/utils/edges/general.d.ts` — `getEdgeId`, `addEdge`, `reconnectEdge`, `ReconnectEdgeOptions`.
9. `@xyflow/react/dist/esm/index.mjs` — `EdgeWrapper` (L2925) and its render tree (L3043), `EdgeAnchor` (L2869), `EdgeUpdateAnchors` (L2873), `EdgeLabelRenderer` (L3841), `EdgeToolbar` (L5159), `BaseEdge` (L2587), `screenToFlowPosition` (L559), `updateEdge`/`updateEdgeData` (L1088), `createSmoothStepEdge` (L2663), `Viewport`/`GraphViewComponent` (L3065/3267).
10. `@xyflow/react/dist/esm/index.d.ts` — the public export list (`getEdgeCenter`, `getBezierEdgeCenter`, `getBezierPath`, `EdgeLabelRenderer`, `EdgeToolbar`, `reconnectEdge`, …); `EdgeAnchor` absent.
11. `@xyflow/react/dist/esm/components/Edges/EdgeAnchor.d.ts` — `EdgeAnchorProps`, `@internal`.
12. `@xyflow/react/dist/esm/additional-components/EdgeToolbar/EdgeToolbar.d.ts` — public screen-constant edge control.
13. `@xyflow/react/dist/esm/types/edges.d.ts` — `Edge`, `EdgeProps`, `BaseEdgeProps`.
14. `@xyflow/react/dist/esm/types/instance.d.ts` — `updateEdge`/`updateEdgeData` signatures.
15. `@xyflow/react/dist/style.css` — `.react-flow__edge { pointer-events: visibleStroke }`, `.react-flow__edgeupdater`, `.react-flow__edgelabel-renderer { pointer-events: none }`, `.react-flow__viewport { transform-origin: 0 0; z-index: 2 }`.
16. `@xyflow/system/dist/esm/xypanzoom/filter.d.ts` — `createFilter` / `noPanClassName`.

**Diagram Studio's own files (integration constraints, read-only):**
17. `src/GoblinEdge.tsx` — the four generators, the label rebasing (`lx`/`ly`), the `EdgeLabelRenderer` label.
18. `src/touch.ts` — the click/drag dead band, `FINE_DRAG_THRESHOLD_PX = 4` / `COARSE_DRAG_THRESHOLD_PX = 6`, `resolveTarget` and its `.react-flow__handle` exclusion.
19. `src/App.tsx` — `useEdgesState` (L423), `pushHistory`/`snapshot` (L1144–1157), `updateEdge` (L1689), `onReconnect` (L1540), `copySelection`/`pasteClipboard` (L1184–1214), `edgesReconnectable`/`reconnectRadius` (L3729), `nodeDragThreshold` (L3876), `snapToGrid`/`snapGrid` (L3777).
20. `src/styles.css` — `.edge-label` / `.edge-label.selected` / `.edge-label-input`, the EdgeLabelRenderer sibling-comment (L2091).

**Upstream source + docs:**
21. https://raw.githubusercontent.com/xyflow/xyflow/main/packages/system/src/utils/edges/smoothstep-edge.ts — confirms the dist matches source; `centerX` only in the opposite-handle branch.
22. https://raw.githubusercontent.com/xyflow/xyflow/main/packages/system/src/utils/edges/bezier-edge.ts — `GetBezierPathParams`, `getBezierEdgeCenter`.
23. https://raw.githubusercontent.com/xyflow/xyflow/main/packages/react/src/components/EdgeLabelRenderer/index.tsx — portal implementation.
24. https://raw.githubusercontent.com/xyflow/xyflow/main/packages/react/CHANGELOG.md — `stepPosition` release entry (#5376, 12.8.2).
25. https://reactflow.dev/api-reference/utils/get-smooth-step-path — the parameter table (`centerX`/`centerY` undocumented, defaults for `borderRadius` 5 / `offset` 20 / `stepPosition` 0.5).
26. https://reactflow.dev/api-reference/utils/get-bezier-path — parameter list, no waypoint.
27. https://reactflow.dev/api-reference/utils/get-straight-path — 4 parameters.
28. https://reactflow.dev/api-reference/components/edge-label-renderer — "has no pointer events by default … set `pointerEvents: 'all'` and add the `nopan` class".
29. https://reactflow.dev/learn/customization/custom-edges — custom edges are path strings; "you will have to make the edge path yourself".
30. https://reactflow.dev/learn/customization/edge-labels — `labelX`/`labelY` are the sanctioned label coordinates; `nodrag nopan` guidance.
31. https://reactflow.dev/examples/edges/edge-label-renderer — the portal example.
32. https://reactflow.dev/examples/edges/editable-edge — **Pro-only**; "draggable control points to change the path of an edge".
33. https://reactflow.dev/pro/content — Editable Edge listed as a Pro example ("Implement a custom edge with draggable control points…").
34. https://reactflow.dev/api-reference/types/edge — the full `Edge` field table; `pathOptions` only.
35. https://reactflow.dev/api-reference/react-flow — `nodeDragThreshold` default 1, `nodeClickDistance` default 0, `snapToGrid`/`snapGrid`, `noPanClassName`.
36. https://reactflow.dev/examples/edges — Custom Edges overview.
37. https://github.com/xyflow/xyflow/issues/741 — "Editable / adjustable edge midpoints"; moklick: implement a custom edge type.
38. https://github.com/xyflow/xyflow/issues/1623 — "[Feature Requests] Add Edges with Midpoint Support"; moved to discussions.
39. https://github.com/xyflow/xyflow/issues/4581 — control point stuck on screen in the Pro editable-edge example; fixed.
40. https://github.com/xyflow/xyflow/issues/4766 — "Feature Request for Orthogonal Edge Routing"; moklick: not planned, maybe a pro example.
41. https://github.com/xyflow/xyflow/pull/5376 — `bendPosition`→`stepPosition`; the diagonal-label bug; merged, released 12.8.2.
42. https://github.com/xyflow/xyflow/discussions/2806 — "Edge type that avoids collision with nodes"; moklick: "We will probably not provide an edge algorithm"; points at smart-edge.
43. https://raw.githubusercontent.com/xyflow/awesome-node-based-uis/main/README.md — no waypoint/editable-edge entry.

**Third-party implementations:**
44. https://github.com/tisoap/react-flow-smart-edge — README (A* routing, draggable waypoints).
45. https://raw.githubusercontent.com/tisoap/react-flow-smart-edge/main/src/SmartEdge/ControlPoint.tsx — the handle component; active/inactive; UUIDs; keyboard nudge; `container` listeners.
46. https://raw.githubusercontent.com/tisoap/react-flow-smart-edge/main/src/SmartEdge/controlPointGeometry.ts — `pointAlongPolyline`, `closestVertexIndex`, `splitPolylineAtWaypoints`, `buildControlPoints` (interleaved).
47. https://raw.githubusercontent.com/tisoap/react-flow-smart-edge/main/src/SmartEdge/smartEdgeData.ts — `readControlPoints`, `readCheckpoints`; the `edge.data.points` shape.
48. https://raw.githubusercontent.com/tisoap/react-flow-smart-edge/main/src/SmartEdge/renderDecision.tsx — `applyControlPointsUpdate`, `setControlPoints` via `useReactFlow().setEdges`, `showControlPoints`.
49. https://raw.githubusercontent.com/tisoap/react-flow-smart-edge/main/src/SmartEdge/index.tsx — `SmartEdgeOptions.editable/checkpoints/controlPointColor/hops`, `SmartEditableEdgeData`, reveal-on-selection.
50. https://raw.githubusercontent.com/tisoap/react-flow-smart-edge/main/src/SmartEditableEdge/index.tsx — `createSmartEdge("bezier", { editable: true })`.
51. https://raw.githubusercontent.com/tisoap/react-flow-smart-edge/main/src/createSmartEdge/index.tsx — preset wiring.
52. https://raw.githubusercontent.com/tisoap/react-flow-smart-edge/main/website/docs/guides/editable-edges.mdx — interaction contract + persistence requirement.
53. https://raw.githubusercontent.com/tisoap/react-flow-smart-edge/main/website/docs/options/editable.mdx — `editable` option.
54. https://raw.githubusercontent.com/tisoap/react-flow-smart-edge/main/website/docs/options/checkpoints.mdx — fixed waypoints without UI.
55. https://raw.githubusercontent.com/tisoap/react-flow-smart-edge/main/website/docs/api/get-smart-edge-waypoints.mdx — `getSmartEdgeWaypoints` stitches per-segment routes.
56. https://tisoap.github.io/react-flow-smart-edge/docs/guides/editable-edges — same content, rendered.
57. https://github.com/rolamCodes/aleph/pull/20 — waypoints in `EdgeLabelRenderer` "for reliable hit targets"; the full interaction set; **closed by its author as "Too complex"**.
58. https://raw.githubusercontent.com/rolamCodes/aleph/main/src/InteractionEdge.tsx — `EdgeLabelRenderer` usage in a real custom edge.
59. https://raw.githubusercontent.com/rolamCodes/aleph/main/src/edgePath.ts — a real `getSmoothStepPath({..., offset, centerY})` call with a computed `centerY` and a `lane` mechanism.
60. https://raw.githubusercontent.com/rolamCodes/aleph/main/src/types.ts — `InteractionEdgeData`.
61. https://raw.githubusercontent.com/n8n-io/n8n/master/packages/frontend/editor-ui/src/features/workflows/canvas/components/elements/edges/utils/getEdgeRenderData.ts — two chained `getSmoothStepPath` calls, `segments[]`.
62. https://raw.githubusercontent.com/n8n-io/n8n/master/packages/frontend/editor-ui/src/features/workflows/canvas/components/elements/edges/CanvasEdge.vue — `v-for` over segments, `EdgeLabelRenderer` toolbar, `interaction-width=40`.
63. https://raw.githubusercontent.com/langflow-ai/langflow/main/src/frontend/src/CustomEdges/index.tsx — no waypoints; hand-built cubic string.
64. https://raw.githubusercontent.com/Jalez/react-flow-smart-edge/main/README.md — the v12 fork; original archived.
65. https://example-apps.xyflow.com/react/pro/editable-edge/ — the Pro demo shell (source not public).
66. https://api.github.com/orgs/xyflow/repos — the xyflow org repo list, checked to confirm there
    is no public `react-flow-pro-examples` repository (it 404s), i.e. the Pro editable-edge
    source is genuinely unavailable to OSS readers.

Searches run that produced no usable primary source (recorded for honesty):
`github.com/search/repositories?q=reactflow+waypoints|react-flow+waypoint|xyflow+waypoint` → 0 results;
`api.github.com/search/issues?q=repo:xyflow/xyflow+waypoint` → 0 results;
Stack Overflow `77831116` and `77238760` are Cloudflare-gated and **could not be fetched**
(no content was read from them; the search snippet for `77238760` is not treated as evidence).

---

## 9. Gaps / `[UNVERIFIED]`

- `[UNVERIFIED]` The React Flow Pro **Editable Edge** source. Its demo is a bundler stub; the
  code is licence-gated. Everything said about it here is from its public description page and
  the upstream bug report (#4581).
- `[UNVERIFIED]` Whether `EdgeToolbar` can be panned from. It sets `pointerEvents: 'all'` and
  no `nopan`, and I did not exercise it in a browser.
- `[UNVERIFIED]` Performance of the chained-generator (n8n-style `segments[]`) approach for
  multi-waypoint edges in Diagram Studio, and any seam artefacts where two sub-paths join.
- `[UNVERIFIED]` Whether `screenToFlowPosition`'s grid snapping is desirable for a waypoint; I
  confirmed the snapping code path (`pointToRendererPoint(..., _snapToGrid, _snapGrid)`) but not
  the resulting feel.
- `[UNVERIFIED]` No React Flow library found that keeps a waypoint attached when its source or
  target node moves; both precedents store absolute canvas coordinates.
- `[UNVERIFIED]` Behaviour of `centerX`/`centerY` under `ConnectionMode.Loose` when the *target*
  handle resolves to a `source`-typed handle (`getEdgePosition` concatenates target+source bounds
  under Loose) — I read the code but did not run a Loose-mode graph.
- Not attempted (out of scope for this cluster): draw.io and Excalidraw models — those are
  sub-questions 1 and 2, in the sibling files.
