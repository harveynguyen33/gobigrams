# E2 — Excalidraw: the linear-element `points` model and point editing

Cluster: SHARED-BRIEF sub-question 2 (Excalidraw arrows/linear elements and movable points).
Date: 2026-09-18. All code read from `excalidraw/excalidraw` **master** via `raw.githubusercontent.com`
(no clone; nothing written outside `/tmp/exc`). Legacy behaviour read from tag `v0.17.6`.

---

## 0. Scope + what I read

**Answer-in-one-paragraph.** Excalidraw does not have "waypoints attached to a connection".
It has a **free-form `points: readonly LocalPoint[]` array** stored on the element, where `points[0]`
is *always* `[0,0]` and the element's `x`/`y` is the origin of that local frame. There is **no
generator function** — the shape is the array. Reshaping is therefore "insert or move an entry in an
array", and the whole interaction model is built around that: a *selected* line shows draggable point
handles, and dragging the **middle of a 2-point line inserts a third point** rather than moving the
line. Endpoint binding to shapes (`startBinding`/`endBinding`) is a separate concern layered on top
of the first and last array entries. **Elbow arrows** (`elbowed: true`) are the exception: they are
fully re-routed by an A\* router every frame, their intermediate points are **not user-draggable**,
and the only user control is *fixing* a segment (`fixedSegments`) — which is a different mental model
from the simple/curved arrow. This architectural difference (data-array vs. path-generator) is the
single most important thing for a React Flow port.

**Files fetched and read** (all under `https://raw.githubusercontent.com/excalidraw/excalidraw/master/`):

| File | Evidence it gave |
|---|---|
| `packages/element/src/types.ts` | `ExcalidrawLinearElement`, `FixedPointBinding`, `PointsPositionUpdates`, `ExcalidrawElbowArrowElement`, `FixedSegment` |
| `packages/element/src/linearElementEditor.ts` | the whole editor class: `handlePointerDown/Move/Up`, `movePoints`, `addPoints`, `deletePoints`, `addMidpoint`, `shouldAddMidpoint`, `getEditorMidPoints`, `isPointHandle`, `POINT_HANDLE_SIZE`, `moveFixedSegment`, `deleteFixedSegment` |
| `packages/element/src/binding.ts` | `BindingStrategy`, `BASE_BINDING_GAP`, `getBindingGap`, `updateBoundPoint`, `getBindingStrategyForDraggingBindingElementEndpoints_*` |
| `packages/element/src/elbowArrow.ts` | `updateElbowArrowPoints` (point-array invariants), `getElbowArrowData`, `handleSegmentMove`, `handleEndpointDrag`, `handleSegmentRelease` |
| `packages/element/src/newElement.ts` | `newLinearElement` / `newArrowElement` defaults |
| `packages/element/src/bounds.ts` | `getElementPointsCoords`, `getElementAbsoluteCoords` |
| `packages/element/src/shape.ts` | `generateElbowArrowShape`, roundness → `generator.curve` vs sharp → `linearPath` |
| `packages/element/src/typeChecks.ts` | `isElbowArrow`, `isSimpleArrow`, `isLinearElementType` |
| `packages/element/src/arrowheads.ts`, `packages/element/src/arrows/focus.ts` | arrowhead normalisation; focus-point drag |
| `packages/math/src/types.ts` | `LocalPoint` vs `GlobalPoint` branding |
| `packages/common/src/constants.ts` | `DRAGGING_THRESHOLD = 10`, `ROUNDNESS`, `DEFAULT_GRID_SIZE` |
| `packages/excalidraw/components/App.tsx` | the canvas-level glue: threshold → `addMidpoint`, `moveFixedSegment`, `actionToggleLinearEditor` wiring, dbl-click handling |
| `packages/excalidraw/renderer/interactiveScene.ts` | `renderLinearPointHandles`, `renderSingleLinearPoint`, which handles are drawn |
| `packages/excalidraw/actions/actionLinearEditor.tsx` | the "Edit arrow / Edit line" action + its predicate |
| `packages/excalidraw/actions/actionDeleteSelected.tsx`, `actionDuplicateSelection.tsx` | Delete = remove selected points, Ctrl+D = duplicate points |
| `packages/excalidraw/components/HintViewer.tsx`, `packages/excalidraw/locales/en.json` | the user-facing hint strings (the documented modifiers) |
| `packages/excalidraw/types.ts` | `AppState.selectedLinearElement` shape |
| `packages/element/tests/linearElementEditor.test.tsx` | executable spec of the interaction (midpoint-threshold, rounding, 2-point drag) |
| `packages/element/tests/elbowArrow.test.tsx` | elbow segment move + double-click-to-release |
| tag `v0.17.6` `src/element/types.ts` + `src/element/binding.ts` | the **legacy** `{focus, gap}` binding model, replaced by `fixedPoint`/`mode` |

Plus GitHub issue/PR API records and the two official blog posts (sources list in §6).

---

## 1. The model (quoted from source)

### 1.1 `ExcalidrawLinearElement` — the `points` array

`packages/element/src/types.ts`:

```ts
export type ExcalidrawLinearElement = _ExcalidrawElementBase &
  Readonly<{
    type: "line" | "arrow";
    points: readonly LocalPoint[];
    startBinding: FixedPointBinding | null;
    endBinding: FixedPointBinding | null;
    startArrowhead: Arrowhead | null;
    endArrowhead: Arrowhead | null;
  }>;

export type ExcalidrawLineElement = ExcalidrawLinearElement &
  Readonly<{
    type: "line";
    polygon: boolean;
  }>;

export type ExcalidrawArrowElement = ExcalidrawLinearElement &
  Readonly<{
    type: "arrow";
    elbowed: boolean;
  }>;
```

So a "line" and an "arrow" share one model; `polygon` (line-only) and `elbowed` (arrow-only) are the
two subtype switches. `packages/element/src/types.ts` also enumerates the user-visible subtype list:

```ts
export type ExcalidrawLinearElementSubType =
  | "line"
  | "sharpArrow"
  | "curvedArrow"
  | "elbowArrow";
```

**`LocalPoint` is a branded tuple**, not an object — `packages/math/src/types.ts`:

```ts
export type GlobalPoint = [x: number, y: number] & { _brand: "excalimath__globalpoint" };
export type LocalPoint  = [x: number, y: number] & { _brand: "excalimath__localpoint" };
```

### 1.2 How `points` relates to `x`/`y` — the `[0,0]` invariant

This is the crux, and it is stated as a hard invariant in the constructor
(`packages/element/src/linearElementEditor.ts`):

```ts
if (!pointsEqual(element.points[0], pointFrom(0, 0))) {
  console.error("Linear element is not normalized", Error().stack);
  mutateElement(
    element,
    elementsMap,
    LinearElementEditor.getNormalizeElementPointsAndCoords(element),
  );
}
```

and the normalization helper in the same file:

```ts
/**
 * Normalizes line points so that the start point is at [0,0]. This is
 * expected in various parts of the codebase.
 */
const getNormalizedPoints = ({ points }) => {
  const offsetX = points[0][0];
  const offsetY = points[0][1];
  return {
    points: points.map((p) => pointFrom(p[0] - offsetX, p[1] - offsetY)),
    offsetX,
    offsetY,
  };
};
```

Consequently **`points[i]` are local coordinates; a global point is `element.x + points[i][0]`,
`element.y + points[i][1]`, then rotated about the element's bbox centre by `element.angle`**
(`linearElementEditor.ts`):

```ts
static getPointsGlobalCoordinates(element, elementsMap): GlobalPoint[] {
  const [x1, y1, x2, y2] = getElementAbsoluteCoords(element, elementsMap);
  const cx = (x1 + x2) / 2;
  const cy = (y1 + y2) / 2;
  return element.points.map((p) => {
    const { x, y } = element;
    return pointRotateRads(pointFrom(x + p[0], y + p[1]), pointFrom(cx, cy), element.angle);
  });
}
```

`width`/`height` are **derived, not authoritative** for a linear element: the bbox is computed from the
rendered path (`getElementPointsCoords` in `bounds.ts` runs the points through
`rough.generator().linearPath(...)` when `roundness == null` and `.curve(...)` when it is set, then
takes the min/max of the curve path ops). This matters for a React Flow port: in Excalidraw the array
*is* the geometry; the box is a projection of it.

### 1.3 `startBinding` / `endBinding` — current model

`packages/element/src/types.ts`:

```ts
export type FixedPoint = [number, number];

export type BindMode = "inside" | "orbit" | "skip";

export type FixedPointBinding = {
  elementId: ExcalidrawBindableElement["id"];

  // Represents the fixed point binding information in form of a vertical and
  // horizontal ratio (i.e. a percentage value in the 0.0-1.0 range). This ratio
  // gives the user selected fixed point by multiplying the bound element width
  // with fixedPoint[0] and the bound element height with fixedPoint[1] to get the
  // bound element-local point coordinate.
  fixedPoint: FixedPoint;

  // Determines whether the arrow remains outside the shape or is allowed to
  // go all the way inside the shape up to the exact fixed point.
  mode: BindMode;
};
```

Key architectural point: **the binding stores a ratio on the target shape, not a point on the arrow.**
`points[0]` / `points[last]` remain the actual drawn endpoints; `updateBoundPoint` **recomputes** them
from the binding (`binding.ts`):

```ts
export const updateBoundPoint = (
  arrow, startOrEnd, binding, bindableElement, elementsMap, dragging?,
): LocalPoint | null => {
  if (binding == null || (binding.elementId !== bindableElement.id && arrow.points.length > 2) || ...) {
    return null;
  }
  const focusPoint = getGlobalFixedPointForBindableElement(
    normalizeFixedPoint(binding.fixedPoint), bindableElement, elementsMap,
  );

  // 0. Short-circuit for inside binding as it doesn't require any
  // calculations and is not affected by other bindings
  if (binding.mode === "inside") {
    return LinearElementEditor.createPointAt(arrow, elementsMap, focusPoint[0], focusPoint[1], null);
  }
  ...
```

Note the `arrow.points.length > 2` guard: **endpoint maintenance only runs for 2-point arrows.** Once
a third point exists, the endpoint is no longer auto-projected from the binding on every frame
[UNVERIFIED whether that produces user-visible drift — it is the guard as written].

### 1.4 `focus` / `gap` — the LEGACY model (v0.17.6), replaced

`https://raw.githubusercontent.com/excalidraw/excalidraw/v0.17.6/src/element/types.ts`:

```ts
export type PointBinding = {
  elementId: ExcalidrawBindableElement["id"];
  focus: number;
  gap: number;
};
```

and `v0.17.6/src/element/binding.ts`:

```ts
const calculateFocusAndGap = (linearElement, hoveredElement, startOrEnd): { focus: number; gap: number } => {
  const direction = startOrEnd === "start" ? -1 : 1;
  const edgePointIndex = direction === -1 ? 0 : linearElement.points.length - 1;
  const adjacentPointIndex = edgePointIndex - direction;
  ...
  return {
    focus: determineFocusDistance(hoveredElement, adjacentPoint, edgePoint),
    gap: Math.max(1, distanceToBindableElement(hoveredElement, edgePoint)),
  };
};
```

…and in the same file, `gap` is used as the standoff and `focus` as a scalar along the diagonal —
`if (binding.gap === 0) { newEdgePoint = focusPointAbsolute; }`.

**So `focus`/`gap` are gone from master.** Master has a *constant* gap instead
(`packages/element/src/binding.ts`):

```ts
/**
 * gaps exclude element strokeWidth
 *
 * IMPORTANT: currently must be > 0 (this also applies to the computed gap)
 */
export const BASE_BINDING_GAP = 5;
export const BASE_BINDING_GAP_ELBOW = 5;
export const BASE_ARROW_MIN_LENGTH = 10;
export const FOCUS_POINT_SIZE = 10 / 1.5;

export const getBindingGap = (bindTarget, opts): number =>
  (opts.elbowed ? BASE_BINDING_GAP_ELBOW : BASE_BINDING_GAP) + bindTarget.strokeWidth / 2;
```

The *name* "focus point" survives in `mode: "orbit"` — the binding strategy carries a `focusPoint`
(the point the arrow is aimed *at*, inside the shape) and the drawn endpoint is the intersection of
the focus line with the shape outline, offset by the gap:

```ts
export type BindingStrategy =
  | { mode: BindMode; element: NonDeleted<ExcalidrawBindableElement>; focusPoint: GlobalPoint }
  | { mode: null; element?: undefined; focusPoint?: undefined }
  | { mode: undefined; element?: undefined; focusPoint?: undefined };
```

`mode: "orbit"` = arrow endpoint sits on the outline, gap away, aimed at `focusPoint`.
`mode: "inside"` = endpoint is placed at the fixed point inside the shape. `mode: "skip"` = binding
disabled. `focus.ts` explicitly excludes elbow arrows from focus-point editing: *"No focus point
management for elbow arrows, because elbow arrows always have their focus point at the arrow point
itself"*.

### 1.5 Elbow arrows add a second, overlapping structure

`packages/element/src/types.ts`:

```ts
export type FixedSegment = {
  start: LocalPoint;
  end: LocalPoint;
  index: Index;
};

export type ExcalidrawElbowArrowElement = Merge<
  ExcalidrawArrowElement,
  {
    elbowed: true;
    fixedSegments: readonly FixedSegment[] | null;
    startBinding: FixedPointBinding | null;
    endBinding: FixedPointBinding | null;
    /**
     * Marks that the 3rd point should be used as the 2nd point of the arrow in
     * order to temporarily hide the first segment of the arrow without losing
     * the data from the points array. ...
     */
    startIsSpecial: boolean | null;
    endIsSpecial: boolean | null;
  }
>;
```

An elbow arrow still *has* a `points` array — it is a full orthogonal polyline — but the array is an
**output of the router**, not user data. `newElement.ts` seeds it:

```ts
export const newArrowElement = (opts): ... => {
  if (opts.elbowed) {
    return {
      ..._newElementBase<ExcalidrawElbowArrowElement>(opts.type, opts),
      points: opts.points || [],
      startBinding: null,
      endBinding: null,
      startArrowhead: opts.startArrowhead || null,
      endArrowhead: opts.endArrowhead || null,
      elbowed: true,
      fixedSegments: opts.fixedSegments || [],
      startIsSpecial: false,
      endIsSpecial: false,
    } as NonDeleted<ExcalidrawElbowArrowElement>;
  }
  ...
```

The persisted JSON shape is documented by Excalidraw itself
(`plus.excalidraw.com/docs/api/scene-content-schema`): a line is
`"points": [[0,0],[80,20],[160,20],[260,60]]` with `startBinding: null`; an arrow is
`"points": [[0,0],[260,120]]` with `"roundness": {"type": 2}` and
`"startBinding": {"elementId": "...", "fixedPoint": [1, 0.5], "mode": "inside"}`; and for elbows
`"fixedSegments": [{"start":[0,0],"end":[120,0],"index":0}]`, documented as *"advanced routing
details. Most integrations should preserve them when editing an existing elbow arrow unless they
intentionally want to reroute it."*

### 1.6 Editor state (not element state)

`packages/excalidraw/types.ts` puts the transient editor into `AppState`:
`AppState["selectedLinearElement"]` is a `LinearElementEditor` with
`elementId`, `selectedPointsIndices`, `isDragging`, `lastUncommittedPoint`, `hoverPointIndex`,
`segmentMidPointHoveredCoords`, `hoveredFocusPointBinding`, `draggedFocusPointBinding`,
`customLineAngle`, `isEditing` and an `initialState` bag
(`packages/element/src/linearElementEditor.ts`). **The point selection is app state, never persisted**
— which is why a re-opened file shows no handles.

---

## 2. The interaction, step by step

### 2.1 Entering "edit points" mode

A selected linear element is not automatically editable. From the en locale
(`packages/excalidraw/locales/en.json`) the **user-visible hint strings** are the documentation:

```json
"lineEditor_info": "Hold {{shortcut_1}} and Double-click or press {{shortcut_2}} to edit points",
"lineEditor_line_info": "Double-click or press {{shortcut}} to edit points",
"lineEditor_pointSelected": "Press {{shortcut_1}} to remove point(s),\n{{shortcut_2}} to duplicate, or drag to move",
"lineEditor_nothingSelected": "Select a point to edit (hold {{shortcut_1}} to select multiple),\nor hold {{shortcut_2}} and click to add new points"
```

with the substitutions wired in `HintViewer.tsx`:

```tsx
? t("hints.lineEditor_pointSelected", {
    shortcut_1: getTaggedShortcutKey("Delete"),
    shortcut_2: getTaggedShortcutKey(["CtrlOrCmd", "D"]),
  })
: t("hints.lineEditor_nothingSelected", {
    shortcut_1: getTaggedShortcutKey("Shift"),
    shortcut_2: getTaggedShortcutKey("Alt"),
  });
...
? t("hints.lineEditor_line_info", { shortcut: getTaggedShortcutKey("Enter") })
: t("hints.lineEditor_info", {
    shortcut_1: getTaggedShortcutKey("CtrlOrCmd"),
    shortcut_2: getTaggedShortcutKey(["CtrlOrCmd", "Enter"]),
  });
```

So the documented entry points are:

| Element | Enter point editor |
|---|---|
| `line` | **double-click**, or press **Enter** (also Ctrl/Cmd+Enter) |
| `arrow` (simple) | **Ctrl/Cmd + double-click**, or **Ctrl/Cmd + Enter** |
| `arrow` (simple) | right-click → **"Edit arrow"** in the context menu |
| `line` | right-click → **"Edit line"** |
| `elbow arrow` | **not offered at all** (predicate excludes it) |

The predicate in `packages/excalidraw/actions/actionLinearEditor.tsx`:

```ts
predicate: (elements, appState, _, app) => {
  const selectedElements = app.scene.getSelectedElements(appState);
  if (
    !appState.selectedLinearElement?.isEditing &&
    selectedElements.length === 1 &&
    isLinearElement(selectedElements[0]) &&
    !isElbowArrow(selectedElements[0])
  ) {
    return true;
  }
  return false;
},
```

and the double-click route in `App.tsx` (`handleCanvasDoubleClick`):

```ts
if (selectedElements.length === 1 && isLinearElement(selectedElements[0])) {
  const selectedLinearElement: ExcalidrawLinearElement = selectedElements[0];

  if (
    ((event[KEYS.CTRL_OR_CMD] && isSimpleArrow(selectedLinearElement)) ||
      isLineElement(selectedLinearElement)) &&
    (!this.state.selectedLinearElement?.isEditing || ...)
  ) {
    // Use the proper action to ensure immediate history capture
    this.actionManager.executeAction(actionToggleLinearEditor);
    return;
  } else if (this.state.selectedLinearElement && isElbowArrow(selectedElements[0])) {
    // ... deleteFixedSegment(midPoint) — see §3
  }
}
```

The test file confirms the arrow/line asymmetry explicitly
(`packages/element/tests/linearElementEditor.test.tsx`):

- `"should enter line editor on dblclick (line)"` → `isEditing === true`
- `"should not enter line editor on dblclick (arrow)"` → `isEditing === false`, and it opens the text editor instead
- `"should enter line editor on ctrl+dblclick (simple arrow)"` → `isEditing === true`
- `"should enter line editor via enter (line)"` / `"via ctrl+enter (arrow)"`
- `"should allow entering and exiting line editor via context menu"` → clicks a context-menu item with text `"Edit line"` / `"Edit arrow"`

`actionToggleLinearEditor` is registered in the context menu in `App.tsx`, between the flip and
link actions:

```ts
actionFlipHorizontal,
actionFlipVertical,
CONTEXT_MENU_SEPARATOR,
actionToggleLinearEditor,
CONTEXT_MENU_SEPARATOR,
actionLink,
```

**This is the strongest known complaint driver** (§4): the canonical way to start bending an arrow is
a hidden right-click menu item.

### 2.2 Adding a point

Three distinct mechanisms, all in `LinearElementEditor`:

**(a) Drag the phantom midpoint knob of a 2-point line** — inserts a point at the cursor.
`App.tsx` `onPointerMoveFromPointerDownHandler` → `onPointerDown` path:

```ts
if (LinearElementEditor.shouldAddMidpoint(this.state.selectedLinearElement, pointerCoords, this.state, elementsMap)) {
  const ret = LinearElementEditor.addMidpoint(
    this.state.selectedLinearElement,
    pointerCoords,
    this,
    !event[KEYS.CTRL_OR_CMD],   // snapToGrid
    this.scene,
  );
  ...
  this.setState({ selectedLinearElement: { ...initialState: ret.pointerDownState, selectedPointsIndices: ret.selectedPointsIndices, isDragging: true } });
```

`shouldAddMidpoint` gates this on a drag threshold **outside** the editor
(`linearElementEditor.ts`):

```ts
if (!appState.selectedLinearElement?.isEditing &&
    dist < DRAGGING_THRESHOLD / appState.zoom.value) {
  return false;
}
```

with `DRAGGING_THRESHOLD = 10; // px` in `packages/common/src/constants.ts`.

`addMidpoint` splices the new point **at the segment index**:

```ts
const midpoint = LinearElementEditor.createPointAt(
  element, elementsMap, pointerCoords.x, pointerCoords.y,
  snapToGrid && !isElbowArrow(element) ? app.getEffectiveGridSize() : null,
);
const points = [
  ...element.points.slice(0, segmentMidpoint.index!),
  midpoint,
  ...element.points.slice(segmentMidpoint.index!),
];
scene.mutateElement(element, { points });
```

**(b) Alt + click, in edit mode** — appends a new point at the cursor and starts a free
"uncommitted point" drag. `handlePointerDown` (`linearElementEditor.ts`):

```ts
} else if (event.altKey && appState.selectedLinearElement?.isEditing) {
  if (linearElementEditor.lastUncommittedPoint == null) {
    scene.mutateElement(element, {
      points: [
        ...element.points,
        LinearElementEditor.createPointAt(
          element, elementsMap, scenePointer.x, scenePointer.y,
          event[KEYS.CTRL_OR_CMD] ? null : app.getEffectiveGridSize(),
        ),
      ],
    });
    ret.didAddPoint = true;
  }
  ...
  selectedPointsIndices: [element.points.length - 1],
  lastUncommittedPoint: null,
```

This is the action the hint string describes as *"hold Alt and click to add new points"*.

**(c) Keep Alt held and move** — `handlePointerMoveInEditMode` then appends/moves a chain of points
(the "draw extra points by hand" gesture):

```ts
if (!event.altKey) {
  if (lastPoint === lastUncommittedPoint) {
    LinearElementEditor.deletePoints(element, app, [points.length - 1]);
  }
  return appState.selectedLinearElement?.lastUncommittedPoint ? { ...lastUncommittedPoint: null } : ...;
}
...
if (lastPoint === lastUncommittedPoint) {
  LinearElementEditor.movePoints(element, app.scene, new Map([[points.length - 1, { point: newPoint, isDragging: true }]]));
} else {
  LinearElementEditor.addPoints(element, app.scene, [newPoint]);
}
...
lastUncommittedPoint: element.points[element.points.length - 1],
```

Note the **abandon-on-release** semantics: releasing Alt while the last point is still uncommitted
deletes it (`deletePoints(element, app, [points.length - 1])`, guarded by the `isUncommittedPoint`
check inside `deletePoints`).

### 2.3 Dragging a middle point

Selection then move, both in `linearElementEditor.ts`:

- `handlePointerDown` computes `pointIndexUnderCursor` and `isPointHandle`, and builds the selection:
  `clickedPointIndex > -1 || event.shiftKey ? (event.shiftKey || already-selected ? normalizeSelectedPoints([...]) : [clickedPointIndex]) : null`.
  So **click selects one point; Shift+click extends the selection** (that is the documented
  "hold Shift to select multiple").
- `handlePointDragging` requires `selectedPointsIndices` and an `initialState.lastClickedPoint`, then
  computes a delta and calls `movePoints`.
- Modifier semantics on the drag: **Shift** (`shouldRotateWithDiscreteAngle`) angle-locks the dragged
  point relative to its **adjacent** point (`const pivotPoint = element.points[lastClickedPoint === 0 ? 1 : lastClickedPoint - 1];`), and the grid snap is dropped from the position math
  (`event[KEYS.CTRL_OR_CMD] ? null : app.getEffectiveGridSize()`) while staying on for the raw cursor.
  **Ctrl/Cmd** disables grid snapping for the point.
- `movePoints` re-normalizes the array so `points[0]` stays `[0,0]` by translating `x`/`y`:

```ts
// in case we're moving start point, instead of modifying its position
// which would break the invariant of it being at [0,0], we move
// all the other points in the opposite direction by delta to
// offset it. We do the same with actual element.x/y position, so
// this hacks are completely transparent to the user.
```

- Multi-point moves: `getNormalizeElementPointsAndCoords` + the `_updatePoints` non-elbow branch
  recompute the bbox and shift `x`/`y` by the centre delta (`bounds.ts` `getElementPointsCoords` →
  `line 1866-1886`).

### 2.4 Dragging the MIDDLE of a 2-point arrow — **it ADDS a point**

This is the question the Diagram Studio brief cares about most, and the answer is unambiguous, with an
executable test as evidence. `packages/element/tests/linearElementEditor.test.tsx`:

```ts
it("should not drag line and add midpoint until dragged beyond a threshold", () => {
    createTwoPointerLinearElement("line");
    const line = h.elements[0] as ExcalidrawLinearElement;
    const originalX = line.x;
    const originalY = line.y;
    expect(line.points.length).toEqual(2);

    mouse.clickAt(midpoint[0], midpoint[1]);
    drag(midpoint, pointFrom(midpoint[0] + 1, midpoint[1] + 1));

    expect(line.points.length).toEqual(2);

    expect(line.x).toBe(originalX);
    expect(line.y).toBe(originalY);
    expect(line.points.length).toEqual(2);

    drag(midpoint, pointFrom(midpoint[0] + delta, midpoint[1] + delta));
    expect(line.x).toBe(originalX);
    expect(line.y).toBe(originalY);
    expect(line.points.length).toEqual(3);
  });
```

and the concrete resulting array:

```ts
it("should allow dragging line from midpoint in 2 pointer lines outside editor", async () => {
    ...
    // drag line from midpoint
    drag(midpoint, pointFrom(midpoint[0] + delta, midpoint[1] + delta));
    ...
    expect(line.points.length).toEqual(3);
    expect(line.points).toMatchInlineSnapshot(`
      [ [0, 0], [70, 50], [40, 0] ]
    `);
  });
```

and inside the editor (no threshold):

```ts
it("should not drag line and add midpoint when dragged irrespective of threshold", () => {
      ...
      mouse.clickAt(midpoint[0], midpoint[1]);
      expect(line.points.length).toEqual(2);

      drag(midpoint, pointFrom(midpoint[0] + 1, midpoint[1] + 1));
      expect(line.x).toBe(originalX);
      expect(line.y).toBe(originalY);
      expect(line.points.length).toEqual(3);
    });
```

**Precise behaviour table for "drag the middle of a 2-point arrow":**

| Conditions | Result |
|---|---|
| `line`/`arrow` is 2-point, selected, NOT in edit mode, drag < 10px (`DRAGGING_THRESHOLD`) | **nothing** — `shouldAddMidpoint` returns false |
| same, drag > 10px | **a third point is inserted at the cursor**; `x`/`y` unchanged; `points.length` 2→3 |
| 2-point, in edit mode (`isEditing`), any drag ≥ 1px | **a third point is inserted** (threshold bypassed) |
| 3+-point simple arrow, NOT in edit mode | **no midpoint knob exists at all** — `getEditorMidPoints` returns `[]`; dragging the line body moves the whole element |
| 3+-point simple arrow, IN edit mode | knobs exist on every segment; dragging one inserts a point on that segment (`points.length` grows) |
| any point count, drag on the line but not on a knob | the **whole element is dragged** (`hitElement` → `MOVE` cursor path) |
| **elbow arrow** | `shouldAddMidpoint` short-circuits: `// Elbow arrows don't allow midpoints` → `return false` |

The `getEditorMidPoints` gate that produces "no knob on a 3-point line outside the editor":

```ts
static getEditorMidPoints = (element, elementsMap, appState): (GlobalPoint | null)[] => {
  const boundText = getBoundTextElement(element, elementsMap);

  // Since its not needed outside editor unless 2 pointer lines or bound text
  if (
    !isElbowArrow(element) &&
    !appState.selectedLinearElement?.isEditing &&
    element.points.length > 2 &&
    !boundText
  ) {
    return [];
  }
  ...
```

…and the renderer only paints the phantom midpoint dots when editing **or** the line has exactly two
points (`interactiveScene.ts`):

```ts
midPoints.forEach((segmentMidPoint) => {
  if (appState.selectedLinearElement?.isEditing || points.length === 2) {
    renderSingleLinearPoint(context, appState, segmentMidPoint, POINT_HANDLE_SIZE / 2, false, true, false);
  }
});
```

Also note an **overlap guard**: `isSegmentTooShort` suppresses a knob when the segment is shorter than
~4 handle-widths (`distance * zoom.value < POINT_HANDLE_SIZE * 4`), so very short segments have no
grabbable midpoint.

### 2.5 Endpoint binding behaviour when dragged

Dragging an endpoint (index `0` or `last`) is a *different* code path from dragging a middle point.
`pointDraggingUpdates` (called from both `handlePointerMove` and `handlePointDragging`) delegates to
`binding.ts`:

```ts
const { start, end } = getBindingStrategyForDraggingBindingElementEndpoints(
  element, naiveDraggingPoints, scenePointerX, scenePointerY, elementsMap, elements, app.state,
  { newArrow: !!app.state.newElement, angleLocked, altKey, gridSize: app.getEffectiveGridSize() },
);
```

and that dispatches on a feature flag:

```ts
if (getFeatureFlag("COMPLEX_BINDINGS")) {
  return getBindingStrategyForDraggingBindingElementEndpoints_complex(...);
}
return getBindingStrategyForDraggingBindingElementEndpoints_simple(...);
```

The observed behaviour:

| Drag gesture on an endpoint | Result |
|---|---|
| Endpoint dragged over a bindable element | `mode: "inside"` or `"orbit"` binding created; the endpoint snaps onto/around the shape |
| Endpoint dragged away from any shape | `{ mode: null }` → binding is **broken** |
| **Alt** held while dragging over a shape | *"Handle special alt key case to inside bind no matter what"* → `mode: "inside"` (binds at the exact fixed point instead of orbiting the outline) — this is the documented *"hold Alt to bind at a fixed point"* |
| **Ctrl/Cmd** held | binding disabled entirely — documented as *"Hold Ctrl to disable binding"* (`hints.arrowBindModifiers`: `"Hold {{shortcut_1}} to disable binding, or {{shortcut_2}} to bind at a fixed point"`) |
| Dragging a **middle** point (not an endpoint) | No binding change; instead, if the arrow *is* bound, `updateBoundPoint` is called for both ends to keep the bound endpoints glued (see the `if (!startIsDragged && !endIsDragged)` branch, which does `positions.set(0, { point: startPoint, isDragging: true })`). This is why bending a bound arrow does not detach it. |
| Grid mode on | `snapBoundPointToGrid(...)` re-projects the bound endpoint to the grid |

There is also a dedicated **focus-point** sub-interaction (`arrows/focus.ts`, `handleFocusPointDrag`)
where a small extra handle lets the user drag the *aim point inside the shape* independently of the
endpoint — but it is explicitly disabled for elbows and for non-2-point arrows
(`arrow.points.length !== 2 → false` in `isFocusPointVisible`).

---

## 3. Per-line-type behaviour

| Line type (`__type` analogue) | Element fields | Storage of shape | Are intermediate points user-movable? | How a user reshapes it | Midpoint knob? |
|---|---|---|---|---|---|
| **`line` (sharp polyline)** | `type:"line"`, `roundness: null`, `polygon: false` | `points[]` straight segments; rendered as `{op:"move"}` + `{op:"lineTo"}` per point (`shape.ts`) | **Yes** — every point is draggable in edit mode | Enter editor (dbl-click / Enter / context menu), drag handles; Alt+click to append; drag a segment midpoint to insert | Yes (and on 2-point lines even while merely selected) |
| **`line` with `polygon: true`** (closed polyline) | `polygon: true` | same array, first & last point forced equal | Yes, but `movePoints`/`addPoints`/`deletePoints` keep the loop closed: `if (isLineElement(element) && element.polygon) { nextPoints[0] = pointFrom(nextPoints[nextPoints.length-1][0], ...) }` | same; toggled by `actionTogglePolygon` ("Convert to polygon" / "Break polygon"); loop auto-detected on pointer-up via `isPathALoop` | Yes |
| **`sharpArrow`** (simple straight arrow) | `type:"arrow"`, `elbowed:false`, `roundness:null` | `points[]` straight; same `linearPath` path | **Yes** | **must first enter edit mode** (Ctrl/Cmd+dbl-click, Ctrl/Cmd+Enter, or right-click → "Edit arrow") — plain double-click opens a *label* instead | Only while selected-and-2-point, or in edit mode |
| **`curvedArrow`** (roundness set) | `roundness: { type: 2 }` (PROPORTIONAL_RADIUS) | **still `points[]`** — the curve is *derived*: `generator.curve(points, options).sets[0].ops.slice(0, element.points.length)` → `bcurveTo` ops. Points are control points, not on-curve knots | **Yes**, same editor | same as sharpArrow; the rendered curve changes as control points move | Yes; `getSegmentMidPoint` uses `curvePointAtLength(segment, 0.5)` and `isSegmentTooShort` uses `curveLength(curves[index])` so the knob sits on the *curve*, not the chord |
| **`elbowArrow`** | `elbowed:true`, `points[]` (router output), `fixedSegments[]`, `startIsSpecial`, `endIsSpecial` | **A\* orthogonal router output**, re-computed every frame | **NO** — `isPointHandle` returns true only for `index === 0` or `index === points.length - 1`; the renderer skips intermediate handles (`if (_isElbowArrow && idx !== 0 && idx !== points.length - 1) return;`); `shouldAddMidpoint` returns false; `handlePointDragging` rewrites any selected intermediate index to the last point | **Fix a segment** (drag the small midpoint dot of a segment → that segment's orientation is pinned in `fixedSegments`); **un-fix** by double-clicking that midpoint | No midpoint *points*, but every non-short segment gets a small **fixed-segment toggle dot** rendered at `POINT_HANDLE_SIZE / 2` |
| **`freedraw`** (out of scope for edges) | separate `ExcalidrawFreeDrawElement` with `points` + `pressures` | — | n/a | — | n/a |

**The elbow-arrow router itself** — documented by Excalidraw's own engineers in two blog posts:

- Part 1 (`plus.excalidraw.com/blog/building-elbow-arrows-part-one`, 2025-10-06) states the design
  goals verbatim: *"1. **Shortest route** … 2. **Minimal segments** … 3. **Proper arrow orientation** —
  arrowheads should always point at the target shapes, never entering them — 4. **Shape avoidance**"*,
  and explains the motivation: *"Excalidraw users with heavy diagramming workflows already emulated
  this type of arrow by painstakingly adding points to simple arrows and dragging them into this
  90-degree configuration."* — i.e. **the elbow arrow type exists precisely because the free-form
  point model was painful.** That is a direct, citable admission for the Diagram Studio decision.
- Part 2 (2025-12-18) describes the final algorithm: A\* with `f(n) = g(n) + h(n)` where
  `g(n)` is bend count and `h(n)` is Manhattan distance, on a **non-uniform grid** whose nodes sit
  *"at shape corners, start and end point headings, and halfway between shapes to be avoided - with
  optional padding around shapes accounted for"*, plus heuristics for backward-visit prevention,
  segment-length preference, shape-side awareness, short-arrow handling and overlap management. It
  targets *"at least 120Hz smooth rendering with ~50 elbow arrows re-routing every frame"*.
- The invariants of the elbow `points` array are asserted in code
  (`packages/element/src/elbowArrow.ts`, `updateElbowArrowPoints`):

```ts
invariant(
  !updates.points || updates.points.length >= 2,
  "Updated point array length must match the arrow point length, contain " +
    "exactly the new start and end points or not be specified at all (i.e. " +
    "you can't add new points between start and end manually to elbow arrows)",
);
...
invariant(
  arrow.points
    .slice(1)
    .map((p, i) => p[0] === arrow.points[i][0] || p[1] === arrow.points[i][1]),
  "Elbow arrow segments must be either horizontal or vertical",
);
...
invariant(
  updates.fixedSegments?.find((segment) => segment.index === 1 && pointsEqual(segment.start, (updates.points ?? arrow.points)[0])) == null && ...,
  "The first and last segments cannot be fixed",
);
```

**"you can't add new points between start and end manually to elbow arrows"** is the single most
quotable line in the whole cluster: it is Excalidraw itself forbidding, at the type-assertion level,
exactly the operation this project wants to offer.

Rounded corners on an elbow are a *render-time* effect, not stored points —
`shape.ts` / `generateElbowArrowShape(points, 16)`: for each interior vertex it emits
`corner = Math.min(radius, pointDistance(points[i], next)/2, pointDistance(points[i], prev)/2)`
and then `L … Q corner, …` sub-paths.

---

## 4. Known limitations / complaints (real issues, real URLs)

All of these are the **actual issue bodies** retrieved from the GitHub API (state as of 2026-09-18):

**#8140 — "\[Feature request\] Lines / arrows: Remove control points" — CLOSED AS NOT PLANNED**
(`https://github.com/excalidraw/excalidraw/issues/8140`, 8 reactions):
> *"Once I add control points to a line or arrow, there seems to be no way to get that line or arrow
> straight again, other than 'undo'. However, 'undo' is not feasible if there were many wanted
> modifications after adding the control point. I'd like to have some intuitive way to remove control
> points - either one by one or all at once."*

→ **The "add a point and you can never cleanly undo it" complaint.** Master partially addresses it
(Delete removes selected points, `actionDeleteSelected`) but the issue was closed as *not planned*,
which is itself a signal about how much Excalidraw prioritises this area.

**#11751 — "\[feat-request\] Add a shortcut to create an arrow bend point at the cursor location" —
OPEN** (`https://github.com/excalidraw/excalidraw/issues/11751`):
> *"When an arrow is selected, the initial bend point appears only in the middle of the arrow. To add
> or edit additional bend points, the user must right-click the arrow and select Edit Arrow. **This
> interaction is not obvious and makes precise arrow editing slower.**"*

→ **The discoverability complaint, in the project's own words.** The requested fix is *"a keyboard
modifier or shortcut that lets users create a new bend point by clicking and dragging anywhere along
the arrow."*

**PR #11756 — "feat: add Alt+drag shortcut to create arrow bend point without enteri…" — OPEN,
unmerged** (`https://github.com/excalidraw/excalidraw/pull/11756`, opened 2026-07-24, 3 files,
`linearElementEditor.ts +13/-1`, `App.tsx +7/-0`, `bend-point-shortcut.patch`). Its body is the
clearest possible statement of the current friction:
> *"Adding a bend point via segment-midpoint drag **already works today, but only once the arrow's
> `isEditing` state is true.** Once an arrow already has 3+ points, `LinearElementEditor.getEditorMidPoints`
> and `getSegmentMidpointHitCoords` stop reporting any hittable midpoint unless `isEditing` is true, so
> all the drag/insert logic downstream never gets a chance to run."*

→ That is the exact `points.length > 2 && !isEditing → return []` gate quoted in §2.4, confirmed by a
contributor as a usability bug. **It has been open since July 2026 and is not merged.**

**#3126 — "Adding points to line or arrow on touch device" — OPEN**
(`https://github.com/excalidraw/excalidraw/issues/3126`):
> *"I am not able to create a point for a line or arrow on a touch device. On the computer I was able
> to do it by pressing alt. But is there any alternative for touch device…"*

→ **The Alt modifier is the only documented way to add a point in edit mode, and it does not exist on
touch.** Alt+click is a desktop-only affordance.

**#11283 — "\[FEATURE REQUEST\] Better Arrows" — OPEN, 4 reactions**
(`https://github.com/excalidraw/excalidraw/issues/11283`):
> *"I'm not a fan of their look as well as their functionality. Could you guys implement an arrow like
> tldraw? 1. **Notice how their arrows bend symmetrically by simply moving the middle part of the
> arrow.**"*

→ A user asking for **exactly the gesture Diagram Studio wants** (drag the middle to bend, without
entering a separate edit mode) and pointing at a competitor as the reference. This is the single most
relevant complaint in the cluster.

**#9812 — "Head of L-shaped arrow disappears" — OPEN** (`https://github.com/excalidraw/excalidraw/issues/9812`):
*"As I bend an elbow arrow into an L-shape, the head shrinks and eventually disappears."*

**#9980 — "Issue with fixed anchor points on both sides of the arrow" — OPEN, mobile**
(`https://github.com/excalidraw/excalidraw/issues/9980`):
*"When I drag one side of the arrow's anchor point, a serious issue seems to occur while the anchor is
selected. Sometimes, when dragging one side of the anchor, the anchor point on the opposite side of
the arrow experiences significant vertical offset."*

**#7038 — "\[Discussion\] What are the control points in the Bezier curved line/arrow" — OPEN**
(`https://github.com/excalidraw/excalidraw/issues/7038`): a user reading the source cannot tell what
the Bezier control points are, because *"the Bezier control points are not on the curve itself but
rather outside"*. → evidence that the curved-arrow model is opaque even to code readers.

**#8114 — "Straight Arrows shouldn't be Hold and Drag." — OPEN**
(`https://github.com/excalidraw/excalidraw/issues/8114`):
*"Straight arrows can be as simple as point and click and not creating more bending/creating multiple
points. this is driving me insane."*

**#9305 — "\[FR\] arrow snap to midpoint" — CLOSED** — *"Would it be possible to implement something
like AutoCAD where you can have the arrow snap to the midpoint?"*

**PR #11005 — "\[debug\] arrow control points" — OPEN, empty body** — a developer-side debug PR,
evidence that the point-handle system is still being instrumented [UNVERIFIED whether this indicates
in-flight refactoring].

**Searches that produced these** (GitHub Search API, `repo:excalidraw/excalidraw`):
`arrow+points+in:title` (15 results), `drag+middle+arrow` (28), `arrow+midpoint+in:title` (3),
`bend+arrow` (7). I did **not** find a credible Reddit thread specifically about Excalidraw arrow
bending — the general web searches returned only the product homepage and unrelated r/ObsidianMD
results, so **no Reddit source is cited** here.

---

## 5. What is directly portable to a React Flow app (the actionable part)

### 5.1 The architectural difference, stated plainly

| | **Excalidraw** | **React Flow (`@xyflow/react` v12)** |
|---|---|---|
| Where the shape lives | **On the edge**: `element.points: readonly LocalPoint[]`, `points[0] === [0,0]` | **In a function**: `getBezierPath(...)` / `getSmoothStepPath(...)` / `getStraightPath(...)` are *pure generators of `[path, labelX, labelY, offsetX, offsetY]`* |
| Who owns the geometry | the edge element | the generator + the source/target node positions + `sourceHandle`/`targetHandle` |
| Adding a bend | `points.splice(i, 0, p)` — trivially easy | **there is no "add a bend" API for bezier or straight**; you must author a path yourself |
| The one escape hatch | — | `GetSmoothStepPathParams` has `centerX?: number; centerY?: number;` |
| Consequence | free-form reshaping by construction | path *type* is a closed set of generators |

The escape hatch is real and I read it in React Flow's source
(`https://raw.githubusercontent.com/xyflow/xyflow/main/packages/system/src/utils/edges/smoothstep-edge.ts`):

```ts
export interface GetSmoothStepPathParams {
  ...
  centerX?: number;
  centerY?: number;
  ...
}
...
centerX = center.x ?? (sourceGapped.x + targetGapped.x) / 2;
centerY = center.y ?? sourceGapped.y + (targetGapped.y - sourceGapped.y) * stepPosition;
...
return [pathPoints, centerX, centerY, defaultOffsetX, defaultOffsetY];
```

and the function **returns the computed `centerX`/`centerY` as values 2 and 3**, i.e. the library is
telling you where the midpoint it chose is — so a custom edge can persist it back into
`edge.data` when the user drags it. That is the *single* generator with a supported, returned
midpoint. `getBezierPath` and `getStraightPath` have no such parameter (this matches what the brief
already measured; I did not re-derive their parameter lists from source in this pass —
`[UNVERIFIED for bezier/straight by source in this cluster, treat as the brief's prior measurement]`).

### 5.2 What transfers

1. **Store the bend as data on the edge, not in the path generator.** Excalidraw's decisive lesson is
   that reshaping works because `points` is *element data*. For Diagram Studio: keep the existing
   `edge.data = { shape, offset }` and add e.g. `edge.data.bend = { x, y }` (or a `waypoints: [{x,y}]`
   array) — then the custom edge component feeds it to the generator. Do **not** try to make
   `getBezierPath` accept it; feed the *offset* into your own path math.

2. **Insert-on-drag, threshold-gated, is the right gesture — and it is what users are asking for.**
   Both the Excalidraw issue #11283 (user wanting tldraw-like "move the middle part") and the
   structural gate at `points.length > 2 && !isEditing` point the same way. The Excalidraw numbers are
   directly reusable: **10px drag threshold** (`DRAGGING_THRESHOLD = 10`) before the gesture is
   interpreted as "bend" rather than "click", and a **handle hit radius of `POINT_HANDLE_SIZE + 1`**
   (`POINT_HANDLE_SIZE = 10`, "+1px to account for outline stroke"), both scaled by `1 / zoom`.

3. **A midpoint knob rendered at the geometric middle of the segment, not the straight chord.** For
   curved paths Excalidraw explicitly switches from `pointCenter(segment[0], segment[1])` to
   `curvePointAtLength(segment, 0.5)`, and measures the segment with `curveLength(...)` for the
   too-short test. If Diagram Studio shows a grab dot on a bezier, it must sit **on the curve**.

4. **Suppress the knob on short segments.** `isSegmentTooShort`: `distance * zoom.value < POINT_HANDLE_SIZE * 4`
   (simple) and `POINT_HANDLE_SIZE / 2` (elbow). Otherwise overlapping knobs on short edges become
   unclickable.

5. **Separate "move the whole element" from "bend it".** Excalidraw keeps both: a drag on a knob bends,
   a drag anywhere else on the line moves the element; and the cursor changes
   (`CURSOR_TYPE.POINTER` on a handle / `GRAB` on the label / `MOVE` on the body). In React Flow the
   body-drag equivalent is node dragging, so Diagram Studio only needs the knob path — but it must
   make sure the knob's pointerdown **stops propagation** or the node underneath will start dragging.

6. **Endpoint rebinding and mid-bending are different code paths, and that is correct.** Excalidraw
   routes endpoint drags through `binding.ts` (`BindingStrategy`) and routes middle-point drags
   through `updateBoundPoint` to *keep* the ends glued (the `if (!startIsDragged && !endIsDragged)`
   branch). The port: while dragging a bend, recompute the endpoints from the node handles, and
   **never** touch `source`/`target`. That preserves the "don't change which shapes it connects"
   requirement by construction.

7. **Modifier vocabulary worth copying** (it is discoverable and orthogonal):
   - **Shift** = angle-lock the dragged point relative to its adjacent point (`shouldRotateWithDiscreteAngle`, `pivotPoint = points[lastClickedPoint === 0 ? 1 : lastClickedPoint - 1]`).
   - **Ctrl/Cmd** = disable grid snapping for the point.
   - **Shift+click** = extend the point selection.
   - **Delete** = remove selected points.
   - **Ctrl/Cmd+D** = duplicate selected points (splits the segment at the midpoint of the next one).

8. **Delete-a-point must be a first-class, obvious action.** Issue #8140 ("no way to get that line
   straight again") is the failure mode to avoid. `actionDeleteSelected` is well designed and worth
   copying verbatim in spirit: *"case: no point selected → do nothing, as deleting the whole element is
   most likely a mistake"*; *"case: deleting all points"* → delete the element; otherwise remove the
   points and move the selection to the previous index.

9. **Do not copy the discoverability model.** Entering point-edit mode via Ctrl/Cmd+dbl-click or a
   right-click menu item is the thing issue #11751 complains about, and PR #11756 (the fix) has been
   unmerged since July 2026. Diagram Studio should make the midpoint knob appear **on selection** and
   bend on drag — i.e. adopt Excalidraw's "2-point line while merely selected" behaviour for **all**
   edges, not its `isEditing` gate.

### 5.3 What does NOT transfer

- **`points[0] === [0,0]` normalization + bbox-shifting `x`/`y`.** That invariant exists because an
  Excalidraw element has an authoring origin independent of its children. A React Flow edge's
  coordinates are always absolute node-space, so the port should store waypoints in the same space as
  the node positions and skip the normalization dance entirely.
- **`polygon`** (closed polylines) has no React Flow analogue.
- **The elbow A\* router.** Do not port it. It is a multi-year research effort (two blog posts, a
  non-uniform grid, five hand-tuned heuristics) whose *purpose* is to avoid the free-form point model
  because the free-form model was painful. For Diagram Studio's stated goal — "drag the middle to look
  nicer" — the `centerX`/`centerY` route for smoothstep plus one stored offset for bezier is the
  1% effort / 80% value version of the same idea.
- **`FixedPointBinding.fixedPoint` ratios.** They are the right design for a whiteboard where the shape
  can be moved and resized freely; for React Flow the node identity + handle already encodes this.
- **The `focus` / `gap` fields** are dead code in the sense that master replaced them with
  `fixedPoint` + `mode` + a constant `getBindingGap`. Only worth citing to avoid confusing a reader
  who finds an older blog post.

### 5.4 The one-line recommendation

Copy Excalidraw's **data model** (a list of draggable points on the edge, inserted by threshold-gated
midpoint drag) and its **handle/knob rendering + modifier vocabulary**; do **not** copy its
**entry gate** (a hidden Ctrl/Cmd+dbl-click or context-menu item) and do **not** copy its
**elbow router** (A\* on a non-uniform grid is a different feature, and Excalidraw's own changelog
says it was built *because* hand-bending points was too painful).

---

## 6. Sources (every URL actually fetched)

**Primary source code** (raw.githubusercontent.com, branch `master`, fetched 2026-09-18):

1. `https://raw.githubusercontent.com/excalidraw/excalidraw/master/packages/element/src/types.ts` — `ExcalidrawLinearElement`, `FixedPointBinding`, `BindMode`, `FixedSegment`, `ExcalidrawElbowArrowElement`, `ExcalidrawLinearElementSubType`
2. `.../packages/element/src/linearElementEditor.ts` — `LinearElementEditor` (constructor normalization check, `handlePointerDown`, `handlePointerMove`, `handlePointerUp`, `handlePointDragging`, `movePoints`, `addPoints`, `deletePoints`, `addMidpoint`, `shouldAddMidpoint`, `getEditorMidPoints`, `getSegmentMidpointHitCoords`, `getSegmentMidPoint`, `isSegmentTooShort`, `isPointHandle`, `getPointIndexUnderCursor`, `createPointAt`, `moveFixedSegment`, `deleteFixedSegment`, `duplicateSelectedPoints`, `POINT_HANDLE_SIZE`)
3. `.../packages/element/src/binding.ts` — `BindingStrategy`, `BASE_BINDING_GAP(_ELBOW)`, `getBindingGap`, `maxBindingDistance_simple`, `updateBoundPoint`, `getBindingStrategyForDraggingBindingElementEndpoints` (+ feature-flag dispatch)
4. `.../packages/element/src/elbowArrow.ts` — `updateElbowArrowPoints` invariants, `getElbowArrowData`, `moveFixedSegment` helpers, `handleSegmentMove`, `handleEndpointDrag`, `BASE_PADDING`
5. `.../packages/element/src/newElement.ts` — `newLinearElement`, `newArrowElement` (elbow defaults)
6. `.../packages/element/src/bounds.ts` — `getElementAbsoluteCoords`, `getElementPointsCoords`
7. `.../packages/element/src/shape.ts` — `case "line": case "arrow":` path generation, `generateElbowArrowShape`
8. `.../packages/element/src/typeChecks.ts` — `isLinearElement`, `isLineElement`, `isArrowElement`, `isElbowArrow`, `isSimpleArrow`, `isLinearElementType`
9. `.../packages/element/src/arrowheads.ts` — `normalizeArrowhead` (legacy crowfoot/dot aliases)
10. `.../packages/element/src/arrows/focus.ts` — `isFocusPointVisible`, `handleFocusPointDrag`
11. `.../packages/math/src/types.ts` — `LocalPoint` / `GlobalPoint`
12. `.../packages/common/src/constants.ts` — `DRAGGING_THRESHOLD = 10`, `ROUNDNESS`, `DEFAULT_GRID_SIZE`
13. `.../packages/excalidraw/components/App.tsx` — `handleCanvasDoubleClick`, the `shouldAddMidpoint`/`addMidpoint` call site, `moveFixedSegment` call site, `actionToggleLinearEditor` context-menu registration, cursor rules incl. "Elbow arrows can only be moved when unconnected"
14. `.../packages/excalidraw/renderer/interactiveScene.ts` — `renderLinearPointHandles`, `renderSingleLinearPoint`, the `isEditing || points.length === 2` knob gate, `highlightPoint`
15. `.../packages/excalidraw/actions/actionLinearEditor.tsx` — `actionToggleLinearEditor` (predicate excludes elbows), `actionTogglePolygon`
16. `.../packages/excalidraw/actions/actionDeleteSelected.tsx` — point-deletion semantics
17. `.../packages/excalidraw/actions/actionDuplicateSelection.tsx` — `duplicateSelectedPoints`
18. `.../packages/excalidraw/components/HintViewer.tsx` — which shortcut is substituted into each hint
19. `.../packages/excalidraw/locales/en.json` — the user-facing hint/label strings
20. `.../packages/excalidraw/types.ts` — `AppState` / `selectedLinearElement`
21. `.../packages/element/tests/linearElementEditor.test.tsx` — executable spec: threshold, midpoint insertion, editor entry per type, rounded-segment midpoints
22. `.../packages/element/tests/elbowArrow.test.tsx` — elbow segment move + double-click-to-release

**Primary source, legacy tag `v0.17.6`:**

23. `https://raw.githubusercontent.com/excalidraw/excalidraw/v0.17.6/src/element/types.ts` — `PointBinding { elementId, focus, gap }`
24. `https://raw.githubusercontent.com/excalidraw/excalidraw/v0.17.6/src/element/binding.ts` — `calculateFocusAndGap`, `gap === 0` branch

**Primary source, cross-reference (React Flow):**

25. `https://raw.githubusercontent.com/xyflow/xyflow/main/packages/system/src/utils/edges/smoothstep-edge.ts` — `GetSmoothStepPathParams.centerX/centerY` and the returned `centerX/centerY`

**Official docs / official blog:**

26. `https://plus.excalidraw.com/blog/building-elbow-arrows-part-one` — design goals, heading intuition, motivation ("users … already emulated this type of arrow by painstakingly adding points")
27. `https://plus.excalidraw.com/blog/building-elbow-arrows-part-two` — A\*, `f(n)=g(n)+h(n)`, non-uniform grid, heuristics, 120Hz/~50 arrows target
28. `https://plus.excalidraw.com/docs/api/scene-content-schema` — persisted JSON for `line`/`arrow`/elbow (`points`, `startBinding.fixedPoint/mode`, `fixedSegments`, `elbowed`)
29. `https://docs.excalidraw.com/docs/@excalidraw/excalidraw/api/props/` — `onChange`/`AppState` surface (supporting only)

**GitHub issues / PRs (API, `api.github.com/repos/excalidraw/excalidraw/...`):**

30. `https://github.com/excalidraw/excalidraw/issues/8140` — remove control points (closed as not planned)
31. `https://github.com/excalidraw/excalidraw/issues/11751` — bend-point shortcut request (open)
32. `https://github.com/excalidraw/excalidraw/pull/11756` — Alt+drag bend point (open, unmerged; body explains the `isEditing` gate)
33. `https://github.com/excalidraw/excalidraw/issues/3126` — add points on touch devices (open)
34. `https://github.com/excalidraw/excalidraw/issues/11283` — "Better Arrows" / tldraw comparison (open)
35. `https://github.com/excalidraw/excalidraw/issues/9812` — L-shaped arrow head disappears (open)
36. `https://github.com/excalidraw/excalidraw/issues/9980` — fixed anchor points offset bug (open)
37. `https://github.com/excalidraw/excalidraw/issues/7038` — Bezier control points discussion (open)
38. `https://github.com/excalidraw/excalidraw/issues/8114` — straight arrows shouldn't be hold-and-drag (open)
39. `https://github.com/excalidraw/excalidraw/issues/9305` — arrow snap to midpoint (closed)
40. `https://github.com/excalidraw/excalidraw/pull/11005` — `[debug] arrow control points` (open, empty body)
41. GitHub Search API queries: `repo:excalidraw/excalidraw arrow points in:title`, `… drag middle arrow`, `… arrow midpoint in:title`, `… bend arrow` — used to find 30–40
42. `https://api.github.com/repos/excalidraw/excalidraw/git/trees/master?recursive=1` — file discovery
43. `https://api.github.com/repos/excalidraw/excalidraw/releases?per_page=5` — version context (`v0.18.1`, 2026-04-21)

**Fetched and confirmed dead** (do not cite as evidence): `docs.excalidraw.com/docs/introduction/elbow-arrows`,
`plus.excalidraw.com/blog/elbow-arrows`, `plus.excalidraw.com/blog/building-elbow-arrows-part-three`,
`docs.excalidraw.com/docs/introduction/keyboard-shortcuts`, `packages/element/src/curve.ts`,
`packages/element/src/arrows/helpers.ts` (referenced by imports, not fetched — out of cluster scope).

No clone was performed, so no disk-cleanup was required for sources; only loose files under `/tmp/exc`.

---

## 7. Gaps / [UNVERIFIED]

- **[UNVERIFIED] Behaviour when a *bound* 2-point arrow gets a third point.** `updateBoundPoint`
  returns `null` when `arrow.points.length > 2`, suggesting the bound endpoint stops being
  re-projected from `fixedPoint` once the arrow has a middle point. I did not run Excalidraw to observe
  whether this produces visible drift on node/shape move. **Worth a 30-second manual test before
  copying the 2-point-only endpoint-update optimisation.**
- **[UNVERIFIED] `getStraightPath` / `getBezierPath` parameter lists in `@xyflow/react` v12.** I read
  `smoothstep-edge.ts` from the xyflow monorepo but did not fetch the bezier/straight sources in this
  pass; the brief's prior measurement (no `centerX`/`centerY` there) is taken as given.
- **[UNVERIFIED] Whether PR #11005 indicates an in-flight refactor** of the point-handle system. Its
  body is empty; the title is `[debug] arrow control points`.
- **[UNVERIFIED] Mobile/touch behaviour of segment-midpoint drags.** Issue #3126 says Alt+click is
  unavailable on touch, but I did not read the mobile pointer code path to see whether the *midpoint*
  drag works there (it should, since it needs no modifier — the issue only mentions *adding* points).
- **[UNVERIFIED] Exact `contextMenu` item ordering/rendering.** I confirmed `actionToggleLinearEditor`
  is registered in the context-menu action list in `App.tsx` and confirmed the label text
  `"Edit line"` / `"Edit arrow"` from `locales/en.json` + the test, but did not read the menu
  component that renders them (the `ContextMenu.tsx` file I fetched is 4 KB of styling, not the item
  list).
- **Not covered (deliberately out of cluster scope):** `packages/element/src/arrows/helpers.ts`,
  arrowhead geometry/`renderArrowhead`, label/text binding positioning, multi-element (freehand)
  arrow creation mode, and the `autoshape` tool.
