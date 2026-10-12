# Edge reshaping — research synthesis and recommendation

Date: 2026-09-18 · Sources: 3 cluster reports, ~125 distinct URLs, orchestrator-verified where
load-bearing. Inputs: `E1-drawio-waypoints.md` (47 sources), `E2-excalidraw-points.md` (43),
`E3-reactflow-implementation.md` (66).

Harvey's ask: **drag the middle of a connection to move/bend it for looks — NOT to re-attach it to
another shape.** Reference tools named: draw.io first, then Excalidraw.

---

## What the two reference tools actually do

| | draw.io | Excalidraw |
|---|---|---|
| **Model** | waypoints = `mxGeometry.points[]` (mxPoint array) on the EDGE cell | `points: LocalPoint[]` on the linear element — the array **IS** the geometry |
| **Mid-line handle with no waypoint yet** | **YES — synthesised.** `mxEdgeSegmentHandler.getCurrentPoints` fabricates one for a 2-point edge | **YES — a phantom midpoint knob**; dragging >10px inserts a point (2→3) |
| **Drag constraint** | **one axis only** (inherits the other coordinate) — keeps the line square | free 2-D |
| **Add** | drag the line · right-click "Add Waypoint" · (Shift+click is INERT) | drag the phantom knob · Alt+click (chains) |
| **Remove** | drag it back within tolerance (Alt suppresses) · double-click · right-click "Clear Waypoints" | select point + Delete |
| **Entry** | click the edge to select (handles appear) | arrows need **Ctrl/Cmd+dbl-click** or right-click "Edit arrow" |
| **Per line type** | straight/orthogonal/segment/elbow/isometric honour them; **entityRelation DISCARDS them**; curved is painting-only over orthogonal | simple arrows: draggable points. **Elbow arrows: NOT user-draggable** (router output only) |
| **Snap** | grid (default 10), Alt bypasses; snap-to-terminals 2px | Ctrl/Cmd disables grid snap; Shift angle-locks |

**Both tools converge on the same core idea Harvey described**: a handle appears in the MIDDLE of the
line even when the edge has no stored waypoints, and dragging it creates one. draw.io's whole
implementation of that is ~10 lines (verified verbatim below).

## The verified draw.io mechanic (I read the source myself)

`mxEdgeSegmentHandler.prototype.getCurrentPoints` — quoted from
`jgraph/mxgraph:javascript/src/js/handler/mxEdgeSegmentHandler.js:29-37`:

```js
if (pts.length == 2 || (pts.length == 3 && (…collinear…))) {
  var cx = pts[0].x + (pts[pts.length - 1].x - pts[0].x) / 2;
  var cy = pts[0].y + (pts[pts.length - 1].y - pts[0].y) / 2;
  pts = [pts[0], new mxPoint(cx, cy), new mxPoint(cx, cy), pts[pts.length - 1]];
}
```

Two identical midpoint points are inserted, which makes the existing handler code produce **one handle
at the middle** with no special-casing. The handle is drawn faded (`virtualBendOpacity`) until dragged.

## The verified React Flow constraint (I read the installed source myself)

`@xyflow/system` `index.mjs:1263` — `centerX`/`centerY` are read **only** inside:

```js
// opposite handle positions, default case
if (sourceDir[dirAccessor] * targetDir[dirAccessor] === -1) {
```

Consequences, all measured by E3 under Node:

| | `step` / `smoothstep` | `bezier` | `straight` |
|---|---|---|---|
| Built-in movable midpoint? | **yes** (`centerX`/`centerY`) | **no** | **no** |
| Works with same-side handles (e.g. Right→Right)? | **no** — param silently ignored | — | — |
| Multiple waypoints? | **impossible** (one bend axis, no array) | — | — |
| Clamping? | **none** — `centerX:-100` honoured literally | — | — |

**So: the cheap path is step/smoothstep; bezier and straight need custom path math.**

---

## Recommendation: two small steps, not one big feature

### Step 1 (cheap, no drag maths) — a bend position control for step/smoothstep

`stepPosition` (0..1) is **already** in `GetSmoothStepPathParams` and already works for the opposite-handle
case. E3's estimate: ~10 lines — a control in the existing edge inspector writing `data.step`, passed into
`GoblinEdge`'s `getSmoothStepPath` call. Undo comes free via the existing `updateEdge` (it already calls
`pushHistory()`).

**Why this first:** it delivers "move the line for looks" with zero new interaction machinery, and it
tests whether Harvey actually wants this often. draw.io's own index contract and Excalidraw's complaint
history both show hand-bending is fiddly; a slider is not.

### Step 2 (the gesture he actually described) — a draggable midpoint handle

Do it **only on the selected edge**, copying the convergent pattern (identical across all four precedents
E3 read: tisoap/react-flow-smart-edge, aleph PR #20, React Flow's own `EdgeToolbar`):

1. Handle appears **only when the edge is selected** (never on hover — hover is already used by the
   electric-edge choreography, and draw.io/Excalidraw both use selection).
2. Render it in **`EdgeLabelRenderer`**, not as an SVG circle — `EdgeLabelRenderer` is a sibling of the
   edges SVG, so the handle sits **outside** the edge's own click handler. Required: `pointerEvents:'all'`
   (default is `none` — a visible dead handle otherwise) and counter-scale `scale(1/zoom)` so it does not
   shrink with zoom.
3. Pointer-drag with document-level listeners, converting via `screenToFlowPosition`.
4. Persist into **`edge.data`**, and call `pushHistory()` **once at pointerdown** (matching the existing
   `onNodeDragStart`/`onReconnect` convention) — not per move.
5. **One axis only**, like draw.io — that is what stops the line looking wrong.
6. Add the handle's class to `src/touch.ts`'s exclusion list (it already ignores `.react-flow__handle`) or
   a long-press will open the edge context menu.

**Scope discipline — evidence, not taste:** aleph's author built a *fuller* editor than this (segment
drag, click-to-add, double-click-to-remove) and **closed his own PR** with *"Big fail. Too complex. User
would have to micro manage every edge."* Keep it to **one movable midpoint on the selected edge.**

### What NOT to copy

- **Excalidraw's entry gate** (hidden Ctrl/Cmd+dbl-click / "Edit arrow" menu) — it is the subject of its
  own open complaint **#11751**: *"must right-click and select Edit Arrow. This interaction is not
  obvious."* draw.io's plain "click the edge, handles appear" is the better pattern.
- **Excalidraw's elbow A\* router** — its authors say it exists *because* hand-bending points was too
  painful. Not our problem to solve.
- **draw.io's Shift+click** — verified INERT (`addEnabled`/`removeEnabled` are both `false` at runtime);
  the manual implies otherwise. Don't implement a dead gesture.

## Two traps specific to THIS codebase (E3 found them)

1. **`GoblinEdge` rebases the label** onto a start/center/end fraction of the straight source→target line:
   `const lx = sourceX + (targetX - sourceX) * labelOffset + (labelX - (sourceX + targetX) / 2)`.
   Any new path generator's `labelX/labelY` gets shifted by that transform, so **the label will not sit at
   the bend** unless the rebasing is short-circuited.
2. **A waypoint stored against the old endpoints becomes nonsense after a reconnect.** `reconnectEdge`
   spreads `...rest` (data included) onto the new edge, so the stale midpoint survives silently —
   `onReconnect` must clear it explicitly.

## Open question for Harvey

The two-step split is a **sequencing** recommendation, not a cap. If he wants the drag gesture directly and
skips step 1, that is legitimate — step 1 is only cheaper, not a prerequisite.

## Gaps carried forward, not smoothed

- **Bezier/straight need a custom path string.** The quadratic control point for one waypoint is
  `C = 2W − (S+T)/2` and `labelX/labelY = (S + 2C + T)/4`; `labelX/labelY` are **mandatory** or the label
  vanishes silently (BaseEdge renders it only when both are numeric).
- **No precedent keeps a waypoint attached when its node moves** — both real libraries store absolute
  canvas coordinates and neither solves staleness. `[UNVERIFIED]` in E3.
- **Same-side handles ignore `centerX`/`centerY` entirely.** Needs a live check against Diagram Studio's
  actual handle config (`ConnectionMode.Loose`, 4 handles) — code-read only, not run.
- E1 flags its own source-diversity miss honestly: 29/47 URLs are from two repos'
  `raw.githubusercontent.com`, above the brief's 40%-per-domain guidance — but the brief also mandated
  primary source first, so the trade was deliberate and is disclosed rather than hidden.
- E1 could not capture a real exported `.mxfile` (serialisation rests on codec source, not an artifact) and
  could not drive a synthetic pointer drag; the gesture is source+docs derived, so **Harvey's real mouse
  test remains the confirmation.**
