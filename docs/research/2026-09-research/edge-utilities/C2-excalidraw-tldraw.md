# C2 — Excalidraw and tldraw: connection-line (arrow/line) behaviour

Date: 2026-09-21 · Author: child C2 · Status: v1
Brief: `SHARED-BRIEF.md` in this directory. Output for the Diagram Studio edge-utilities pass.

**Primary sources used — exact revisions**

| Tool | Revision read | How |
|---|---|---|
| Excalidraw | commit `97c68dd371e13c017a8dcca49f8b3995ba7890a8` (2026-09-19), `packages/excalidraw` v0.18.0 | `git clone --depth 1 --filter=blob:none --sparse` of `github.com/excalidraw/excalidraw`, sparse paths `packages/{common,element,excalidraw}`; plus `docs.excalidraw.com`; plus live `excalidraw.com` via CDP |
| tldraw | commit `05ba06d341d4fc7212812c30cb80309c011d428a` (2026-09-18), `tldraw` v5.4.2 (npm `latest` confirms 5.4.2) | sparse clone of `github.com/tldraw/tldraw`, sparse paths `packages/{editor,tldraw,tlschema}` + `packages/tldraw/src/lib`; plus `tldraw.dev`; plus live `tldraw.com` via CDP |

Both clones were deleted after reading (55 MB total, disk checked before and after: 58 G free, unchanged).

All file-line citations below are permalinked to the pinned commits, e.g.
`https://github.com/excalidraw/excalidraw/blob/97c68dd371e13c017a8dcca49f8b3995ba7890a8/<path>#L<n>` —
I verified every permalink returns HTTP 200. Abbreviated in the text as `EXC:<path>#L<n>` and `TLD:<path>#L<n>`.

---

## 1. EXCALIDRAW

### 1.1 (a) How an arrow label is created and moved — and the data model

**The label is NOT a property of the arrow.** It is a separate `text` element that points at the arrow.

Arrow element shape (`EXC:packages/element/src/types.ts#L369-L377`):

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
```
`ExcalidrawArrowElement` adds `elbowed: boolean` (`#L391-L395`); `ExcalidrawElbowArrowElement` adds
`fixedSegments: readonly FixedSegment[] | null` and `startIsSpecial` / `endIsSpecial` (`#L397-L421`).

The label side — the field that matters for Diagram Studio (`EXC:packages/element/src/types.ts#L285-L290`):

```ts
    /**
     * Position of text bound to a linear element (such as an arrow),
     * expressed as a normalized arc-length parameter (0–1) along the
     * container's whole path. Independent of how the path is segmented,
     * so it survives midpoint insertion and other geometry changes.
     * */
    labelPosition?: number | null;
```

So: **`labelPosition` is a single normalized arc-length parameter on the *text* element**, on the `text`
element's own record, not on the arrow. Default `DEFAULT_BOUND_TEXT_LABEL_POSITION = 0.5`
(`EXC:packages/element/src/textElement.ts#L588`), written at creation time in `App.startTextEditing`
(`EXC:packages/excalidraw/components/App.tsx#L7078-L7084`).

The arrow holds a back-reference, not a forward pointer: `boundElements: [{ type: "text", id }]`, read via
`getBoundTextElementId` → `getBoundTextElement` (`EXC:packages/element/src/textElement.ts#L326-L353`).
This is a two-way link (arrow→text via `boundElements`, text→arrow via `containerId`) and both sides are
maintained by separate code paths — a real cost item for anyone copying it.

**Creation.** Double-click on the canvas goes through `handleCanvasDoubleClick`
(`EXC:packages/excalidraw/components/App.tsx#L7340-L7390`) → `getTextBindableContainerAtPosition(sceneX, sceneY)`
(`EXC:packages/excalidraw/components/App.tsx#L6829-L6872`). An arrow *is* a text container —
`isTextBindableContainer` returns true for `isArrowElement(element)` (`EXC:packages/element/src/typeChecks.ts#L240-L253`).

**But creation is gated by a 30-px snap, which matters directly for ask #4.**
`TEXT_TO_CENTER_SNAP_THRESHOLD = 30` (`EXC:packages/common/src/constants.ts#L26`).
`getTextWysiwygSnappedToCenterPosition` (`EXC:packages/excalidraw/components/App.tsx#L13792-L13820`) returns a
position only when `distanceToCenter < TEXT_TO_CENTER_SNAP_THRESHOLD`. Excalidraw's own code documents the
consequence (`EXC:packages/excalidraw/components/App.arrowText.ts#L163-L178`):

> `getTextBindableContainerAtPosition` resolves an arrow anywhere in its bounding box, but a click only becomes
> a *label* when it also snaps to the arrow's center — off-center clicks drop a free-floating text instead.

**Live confirmation** (excalidraw.com, CDP): drew an arrow with the arrow tool, switched to selection,
double-clicked the arrow mid-body → `document.querySelectorAll('textarea').length === 1`, and the panel
switched to `Selected shape actions / Stroke / Font family / Font size / Opacity / Layers` with the canvas
hint `Press Esc or Ctrl + Enter to finish editing`. Typing then Esc produced a bound label. Double-clicking
*off* the arrow centre produced free text instead — the 30-px rule above is the reason.

**Movement: free drag, but projected onto the arrow's path and clamped to [0,1].**
`LinearElementEditor.handleBoundTextDragging`
(`EXC:packages/element/src/linearElementEditor.ts#L1967-L2030`) walks the polyline segments, calls
`pathSegmentClosestParameter` per segment, keeps the nearest, then:

```ts
    const labelPosition = clamp(
      (prefixSums[bestSegmentIndex] + lengthWithinSegment) / totalLength,
      0,
      1,
    );
    const pathPoint = LinearElementEditor.getPointAtPathParameter(element, labelPosition, elementsMap);
    scene.mutateElement(boundTextElement, {
      labelPosition,
      x: pathPoint[0] - boundTextElement.width / 2,
      y: pathPoint[1] - boundTextElement.height / 2,
    });
```

So the pointer may move in 2-D, but the stored value is 1-D (arc-length fraction) and the rendered position
is always *on* the line. There are no fixed slots — the whole path is addressable.

**The "handle vs label" collision (Harvey's #1) — how Excalidraw resolves it.** Not by moving either; by
**hit priority**. `LinearElementEditor.handlePointerDown` returns a `hitBoundText` flag, and the segment
midpoint knob is checked first — the source comment is explicit
(`EXC:packages/element/src/linearElementEditor.ts#L1150-L1157`):

> the segment midpoint knob keeps precedence over the label sitting on top of it, so a labeled arrow can still
> be bent at its middle

and, one line later:

> when the label grab wins (possible over a non-interactive elbow route point), the click must not double as a
> point click

The label grab is also explicitly excluded from endpoint rebinding: `hitBoundText` is threaded through
`actionFinalize` and checked as `!data.hitBoundText` before any rebinding (`EXC:packages/excalidraw/actions/actionFinalize.tsx#L88-L94`):

> a label drag along the arrow moves no endpoint, so it must not rebind either of them

Grab eligibility itself is `App.arrowText.isBoundTextGrabbable` and the pointer-down computes
`boundTextGrabOffset` from the label's *centre*
(`EXC:packages/element/src/linearElementEditor.ts#L1149-L1180`).

**Bonus, distinct feature: endpoint-anchored labels.** `EXC:packages/element/src/arrowEndpointText.ts` (new in
this revision) implements text bound to *one end* of an arrow, positioned by a binding with a
`getBindingGap`-derived offset so the arrow itself never moves. `App.startTextEditing` takes an
`arrowEndpoint?: ArrowEndpoint` parameter and comments (`EXC:packages/excalidraw/components/App.tsx#L6920-L6926`):

> an arrow endpoint is not a text container — the text is a sibling the arrow binds to, not a label inside it

That gives Excalidraw **two** label anchors: mid-path (`labelPosition`, bound by `containerId`) and
end-anchored (`arrowEndpointText`, bound by a fixed-point binding). Two different mechanisms for "text on an
arrow" in one app is itself a signal: the mid-path one is the mature/cheap one.

### 1.2 (b) Label background — there is no such property; the line is *erased* under the label

`text` is **not** in `hasBackground(type)` (`EXC:packages/element/src/comparisons.ts#L3-L14`) but it **is** in
`hasStrokeColor(type)` (`#L19-L30`). The text render path only ever calls `fillText` — no `fillRect` backdrop
(`EXC:packages/element/src/renderElement.ts#L625-L675`). There is therefore no label-background field, no
background colour picker for a label, and nothing to make transparent.

What Excalidraw does instead, in all three renderers:

- **Cached-bitmap path** — `evenodd` clip removing a padded rect around the label
  (`EXC:packages/element/src/renderElement.ts#L780-L820`).
- **Vector path** — same clip, with an explicit source comment
  (`EXC:packages/element/src/renderElement.ts#L1138-L1180`):
  > Draw arrow directly as vector (no temp-canvas bitmap blit which introduces resampling blur). The label
  > "hole" is cut by clipping the arrow's own strokes out of the label rect (even-odd clip) so that elements
  > rendered beneath the arrow keep showing through the gap.
- **SVG export** — the same padded rect as an SVG `<mask>` (`EXC:packages/excalidraw/renderer/staticSvgScene.ts#L405-L470`).

Padding constant: `BOUND_TEXT_PADDING = 5` (`EXC:packages/common/src/constants.ts#L404`), used as
`holeWidth = boundText.width + BOUND_TEXT_PADDING * 2`.

**Net effect: the label's backdrop is always transparent, by erasing the line, with no user control.** The
label's *ink* is the text element's `strokeColor` (changed by the ordinary "Stroke" colour picker).
`DEFAULT_ELEMENT_PROPS.backgroundColor = COLOR_PALETTE.transparent` overall
(`EXC:packages/common/src/constants.ts#L506-L515`) — i.e. "transparent" is Excalidraw's default everywhere,
not a label-specific decision.

This is the strongest available evidence for ask #2: a mature tool solved "the line must not run through the
text" **without** a background box at all.

### 1.3 (c) What the arrow panel exposes, and as what control type

Verified live at excalidraw.com (arrow selected) — panel `innerText`, in order:

```
Selected shape actions
Stroke / Stroke width / Stroke style / Sloppiness / Arrow type / Arrowheads / Opacity / Layers
```

Verified from DOM: the panel is `fieldset` + `legend` per row, inside `div.selected-shape-actions`.
Control types (source + live DOM):

| Row | Control | Evidence |
|---|---|---|
| Stroke | colour picker popover (swatches + custom/hex) | `EXC:packages/excalidraw/actions/actionProperties.tsx#L358-L430` |
| Stroke width | **`RadioSelection` button row** — thin / medium / bold | `#L708-L775` |
| Stroke style | **`RadioSelection` button row** — solid / dashed / dotted | `#L922` |
| Sloppiness | **`RadioSelection` button row** — architect / artist / cartoonist | `#L778+` |
| Arrow type ("Edges") | **`RadioSelection` button row** — sharp / round / elbow | `actionChangeArrowType`, `#L2244-L2280`; i18n `arrowtype_sharp`="Sharp arrow", `arrowtype_round`="Curved arrow", `arrowtype_elbowed`="Elbow arrow" (`EXC:packages/excalidraw/locales/en.json#L71-L73`) |
| Arrowheads | **two trigger buttons in one row, each opening a popover** | `#L1825-L1960`; live DOM: `<button aria-haspopup="dialog" aria-label="arrowhead_start">`, `<button aria-haspopup="dialog" aria-label="arrowhead_end">` |
| Opacity | **`Range` slider** 0–100 step 10 | `#L956-L1000` |

Key structural fact: `actionChangeArrowProperties` renders only two children — the arrowhead picker and the
arrow-type picker (`#L2038-L2046`), i.e. the panel itself is composed of named sub-actions, which is exactly
the shape Diagram Studio's `inspector.ts` section vocabulary already has.

**The arrowhead picker in detail.** Each of the two triggers opens a popover built by
`getArrowheadOptions(flip)` (`EXC:packages/excalidraw/actions/actionProperties.tsx#L1825-L1908`) split into:

- `visibleSections.default.options` (shown inline, 4): `null`→"None", `arrow`→"Arrow", `triangle`→"Triangle",
  `triangle_outline`→"Triangle (outline)". Each carries a `keyBinding` (`q`,`w`,`e`,`r`).
- `hiddenSections.default.options` (behind "More options", 5): `circle`, `circle_outline`, `diamond`,
  `diamond_outline`, `bar` (`a`,`s`,`d`,`f`,`z`).
- `hiddenSections[1]` named `t("labels.cardinality")` = **"Cardinality"** (6): `cardinality_one`,
  `cardinality_many`, `cardinality_one_or_many`, `cardinality_exactly_one`, `cardinality_zero_or_one`,
  `cardinality_zero_or_many`.

Full value list (`EXC:packages/element/src/types.ts#L356-L365`):
`arrow | bar | circle | circle_outline | triangle | triangle_outline | diamond | diamond_outline | CardinalityArrowhead`.

Two things worth stealing here:

1. **No user-visible names for the two ends.** The legend is just "Arrowheads"
   (`EXC:packages/excalidraw/locales/en.json#L49`); the ends are only identified programmatically as
   `arrowhead_start` / `arrowhead_end` (aria-label + `actionChangeArrowhead`'s `position: "start" | "end"`).
   The data model uses `startArrowhead` / `endArrowhead`. Excalidraw's live DOM exposes the two buttons with
   **icon-only previews whose stroke opacity encodes selected/unselected** (`opacity="0.3"` on the start
   icon, none on the end icon) — no text label at all.
2. **Legacy marker migration**: `normalizeArrowhead` / `getArrowheadForPicker`
   (`EXC:packages/element/src/arrowheads.ts#L1-L34`) maps `dot`→`circle`, `crowfoot_one`→`cardinality_one`,
   `crowfoot_many`→`cardinality_many`, `crowfoot_one_or_many`→`cardinality_one_or_many`. That is how they
   renamed an 8-value marker enum in shipped files without breaking old scenes.

**Arrow type → storage is 3 UI options onto 2 fields.** `actionChangeArrowType.perform` writes both
`roundness: value === "round" ? { type: ROUNDNESS.PROPORTIONAL_RADIUS } : null` **and**
`elbowed: value === ARROW_TYPE.elbow` (`EXC:packages/excalidraw/actions/actionProperties.tsx#L2070-L2085`), and
the read-back is a 3-way ternary (`#L2247-L2260`):

```ts
                if (isArrowElement(element)) {
                  return element.elbowed ? ARROW_TYPE.elbow
                    : element.roundness ? ARROW_TYPE.round
                    : ARROW_TYPE.sharp;
                }
```

So a clean 3-way button row can sit on top of two storage fields — directly relevant to ask #8 (Line style /
Curvature as button rows): the *UI* can be one row even where storage is two fields.

### 1.4 (d) Selection vs authored colour — Excalidraw never tints the body

The authored `strokeColor` is baked into each element's own cached bitmap.
`generateElementCanvas` → `drawElementOnCanvas` → `ShapeCache.generateElementShape`
(`EXC:packages/element/src/renderElement.ts#L271-L325`, `#L431-L470`) and the rough option is
`stroke: applyDarkModeFilter(element.strokeColor, isDarkMode)` (`EXC:packages/element/src/shape.ts#L195-L235`).
Nothing in that path reads `selectedElementIds`.

Selection chrome lives on the separate **interactive** canvas and uses its own colour:
`--color-selection: #6965db` in light, `#b4b0ff` in dark
(`EXC:packages/excalidraw/css/theme.scss#L83`, `#L229`), read at runtime with a
`DEFAULT_SELECTION_COLOR = "#6965db"` fallback (`EXC:packages/excalidraw/renderer/helpers.ts#L6-L16`).
`renderConfig.selectionColor` is used for the bounding box, transform handles
(`EXC:packages/excalidraw/renderer/interactiveScene.ts#L1425-L1465`), the point handles
(`#L1154-L1215`) and the text-edit box (`#L1568-L1590`). For a single selected linear element, Excalidraw draws
**point handles along the line**, not a recoloured line
(`EXC:packages/excalidraw/renderer/interactiveScene.ts#L1843-L1866`):

> `const isSingleLinearElementSelected = selectedElements.length === 1 && isLinearElement(selectedElements[0]);`
> … `renderLinearPointHandles(context, appState, selectedElements[0] as …)`

Two further consequences worth copying:

- **A selected element's hit area becomes its bounding box.** `App.hitElement`
  (`EXC:packages/excalidraw/components/App.tsx#L6785-L6805`):
  > if the element is selected, then hit test is done against its bounding box
  combined with `hasBoundingBox([element], this.state, this.editorInterface)`. So once selected, a thin edge is
  grabbable anywhere in its box — a cheap, no-UI way to make thin lines touch-friendly.
- Hit tolerance on an unselected line is stroke-derived and zoom-compensated — the code even warns against
  lowering it (`EXC:packages/excalidraw/components/App.tsx#L6772-L6780`):
  ```ts
    return Math.max(
      element.strokeWidth / 2 + 0.1,
      // NOTE: Here be dragons. Do not go under the 0.63 multiplier unless you're
      // willing to test extensively. …
      0.85 * (DEFAULT_COLLISION_THRESHOLD / this.state.zoom.value),
    );
  ```

**Conclusion for bug #7: Excalidraw's model is exactly the fix — authored colour on the element's own cached
draw, selection colour only on an overlay that is never merged into the stroke.** There is no
`!important`-equivalent anywhere: the two are different draw passes.

### 1.5 (e) Flow / animation — absent

No element has an `animated` property, and no edge animation exists. Grep of `packages/` for
`marching|dashoffset|animateFlow|flowAnimation` returns only: the laser-pointer trail
(`EXC:packages/excalidraw/animatedTrail.ts#L51-L53`, `<animate attributeName="stroke-dashoffset">`), the
collaborator cursor, the loading `Spinner.scss`, the colour-picker drop-target hint, and two unrelated
`context.lineDashOffset` uses in `interactiveScene.ts` (`#L836` progress bar, `#L1052` remote-selection
dashes). `AnimationController` (`EXC:packages/excalidraw/renderer/animation.ts`) is a generic
`requestAnimationFrame` helper whose only consumer is the laser trail.

So: **Excalidraw ships no flow animation on connection lines at all.** Diagram Studio's Flow Animation is
ahead of both tools in this cluster.

### 1.6 (f) Bonus Excalidraw things a shared tool should copy

- **Hole-punch instead of a background box** for the label (`§1.2`). Zero new fields, works in canvas *and*
  SVG (via `<mask>`), and honours the element layer beneath.
- **Path parameter, not x/y** for label placement, with an explicit rationale comment about surviving geometry
  changes (`EXC:packages/element/src/types.ts#L285-L289`).
- **Grab priority documented in code**, not in a tooltip (`EXC:packages/element/src/linearElementEditor.ts#L1150-L1157`).
- **Cardinality markers folded into the arrowhead picker** as a separate popover section, rather than a
  separate panel section — relevant because Diagram Studio has an ERD-only `cardinality` section; Excalidraw
  needs no ERD mode to offer them.
- **Legacy-enum migration on read** (`normalizeArrowhead`) so a marker rename is a data-migration, not a
  breaking change.
- **End-anchored labels** as a second, binding-based anchor (`arrowEndpointText.ts`).

---

## 2. TLDRAW

### 2.1 (a) How an arrow label is created and moved — and the data model

**The label is inside the arrow.** `TLArrowShapeProps`
(`TLD:packages/tlschema/src/shapes/TLArrowShape.ts#L148-L180`):

```ts
export interface TLArrowShapeProps {
	kind: TLArrowShapeKind          // 'arc' | 'elbow'
	labelColor: TLDefaultColorStyle
	color: TLDefaultColorStyle
	fill: TLDefaultFillStyle
	dash: TLDefaultDashStyle
	size: TLDefaultSizeStyle
	arrowheadStart: TLArrowShapeArrowheadStyle
	arrowheadEnd: TLArrowShapeArrowheadStyle
	font: TLDefaultFontStyle
	start: VecModel
	end: VecModel
	bend: number
	richText: TLRichText
	labelPosition: number
	scale: number
	elbowMidPoint: number
}
```

Validator: `labelPosition: T.number` — a plain unconstrained number in the schema
(`TLD:packages/tlschema/src/shapes/TLArrowShape.ts#L251`); default `labelPosition: 0.5`
(`TLD:packages/tldraw/src/lib/shapes/arrow/ArrowShapeUtil.tsx#L244-L259`). The label text is `richText`,
stored directly on the shape — **no second element, no container/bound pair**.

The label is also part of the shape's **hit-test geometry** (`TLD:packages/tldraw/src/lib/shapes/arrow/ArrowShapeUtil.tsx#L262-L304`):

```ts
		let labelGeom
		if (info.isValid && (isEditing || !isEmptyRichText(shape.props.richText))) {
			const labelPosition = getArrowLabelPosition(this.editor, shape, isEditing)
			labelGeom = new Rectangle2d({
				x: labelPosition.box.x, y: labelPosition.box.y,
				width: labelPosition.box.w, height: labelPosition.box.h,
				isFilled: true,
				isLabel: true,
			})
		}
		return new Group2d({ children: [...(labelGeom ? [bodyGeom, labelGeom] : [bodyGeom]), ...debugGeom] })
```

`isLabel: true` makes it excluded by the default filter — `Geometry2d.isExcludedByFilter` returns true when
`this.isLabel && !filters.includeLabels` (`TLD:packages/editor/src/lib/primitives/geometry/Geometry2d.ts#L88-L94`),
and `Group2d.hitTestPoint` / `hitTestLineSegment` skip excluded children
(`TLD:packages/editor/src/lib/primitives/geometry/Group2d.ts#L91-L115`). So the label is a *first-class* hit
region that is *off by default* and turned on only where it is wanted. Label lookup is by index:
`isOverArrowLabel` uses `editor.getShapeGeometry<Group2d>(shape).children[1]` + `pointInPolygon`
(`TLD:packages/tldraw/src/lib/shapes/arrow/arrowLabel.ts#L308-L324`).

**Movement: continuous drag along the path, with a snap back to the default position.**
Entry point — a drag that starts over the label becomes a label drag, *before* the shape is translated
(`TLD:packages/tldraw/src/lib/tools/SelectTool/childStates/PointingShape.ts#L227-L247`):

```ts
		if (this.editor.inputs.getIsDragging()) {
			…
			if (isOverArrowLabel(this.editor, this.hitShape)) {
				// We're moving the label on a shape.
				this.parent.transition('pointing_arrow_label', { ...info, shape: this.hitShape })
				return
			}
			…
				this.startTranslating(info)
```

The drag state itself — `TLD:packages/tldraw/src/lib/tools/SelectTool/childStates/PointingArrowLabel.ts#L96-L141`:

```ts
		const pointInShapeSpace = this.editor
			.getPointInShapeSpace(shape, this.editor.inputs.getCurrentPagePoint())
			.add(this._labelDragOffset)
		const defaultLabelPosition = getArrowLabelDefaultPosition(this.editor, shape)
		let nextLabelPosition = geometry.uninterpolateAlongEdge(pointInShapeSpace)
		if (isNaN(nextLabelPosition)) { nextLabelPosition = defaultLabelPosition }
		const nextLabelPoint = transform.applyToPoint(geometry.interpolateAlongEdge(nextLabelPosition))
		const labelDefaultPoint = transform.applyToPoint(geometry.interpolateAlongEdge(defaultLabelPosition))
		if (Vec.DistMin(nextLabelPoint, labelDefaultPoint,
				options.labelCenterSnapDistance / this.editor.getZoomLevel())) {
			nextLabelPosition = defaultLabelPosition
		}
		this.didDrag = true
		this.editor.updateShape({ id: shape.id, type: shape.type, props: { labelPosition: nextLabelPosition } })
```

Same shape as Excalidraw (2-D pointer → `uninterpolateAlongEdge` → 1-D fraction), plus a **snap-to-default**
when within `labelCenterSnapDistance` — `10` screen pixels
(`TLD:packages/tldraw/src/lib/shapes/arrow/ArrowShapeUtil.tsx#L152`; documented at
`tldraw.dev/sdk-features/default-shapes`, options table: "`labelCenterSnapDistance` … Default `10` … Screen
pixels at which arrow labels snap to the arrow's center when dragged"). That is the "I don't like it here,
put it back" gesture with **no extra UI**.

`_labelDragOffset` is computed on entry from the label geometry's centre
(`TLD:…/PointingArrowLabel.ts#L55-L63`) so the label doesn't jump under the finger. A history stopping point
is marked on entry.

**The label is clamped to a usable range, which is the part Diagram Studio's 3 slots do not do.**
`getClampedPosition` (`TLD:packages/tldraw/src/lib/shapes/arrow/arrowLabel.ts#L263-L278`):

```ts
	const clampedPosition = clamp(
		shape.props.labelPosition,
		hasStartArrowhead || hasStartBinding ? range.start : 0,
		hasEndArrowhead || hasEndBinding ? range.end : 1
	)
```

with `range` from `getArrowLabelRange` (`TLD:packages/tldraw/src/lib/shapes/arrow/arrowLabel.ts#L153-L224`),
which places the label box at the start/end of the body geometry, intersects it with the body, and derives the
usable fraction from where it stops intersecting. Padding comes from `getLabelToArrowPadding`
(`#L139-L151`) built on `LABEL_TO_ARROW_PADDING = 20`
(`TLD:packages/tldraw/src/lib/shapes/shared/default-shape-constants.ts#L43-L48`), adjusted per stroke width and
scale. Net: **you cannot push the label under an arrowhead or off the end of the line** — enforced in geometry,
with no UI.

**Creation / editing.**
- Double-click on the arrow shape → `Idle.onDoubleClick`, `case 'shape'` → `util.onDoubleClick` (arrow has
  none) → `canEditShape(shape)` → `startEditingShape(shape, info, true /* select all */)`
  (`TLD:packages/tldraw/src/lib/tools/SelectTool/childStates/Idle.ts#L409-L470`). So **double-click anywhere on
  the arrow edits/creates the label** — no centre-snap gate, unlike Excalidraw.
- A click on the label of an already-selected arrow starts editing
  (`TLD:…/PointingArrowLabel.ts#L144-L154`):
  ```ts
  		if (shape && !this.didDrag && this.wasAlreadySelected && this.editor.canEditShape(shape)) {
  			startEditingShapeWithRichText(this.editor, shape.id)
  			return
  		}
  ```
  i.e. drag = move, click-when-already-selected = edit. One gesture, two meanings, disambiguated by whether a
  drag happened (`didDrag`) — a concrete pattern for ask #4.
- `onEditStart` seeds the position when the label was empty
  (`TLD:packages/tldraw/src/lib/shapes/arrow/ArrowShapeUtil.tsx#L985-L998`).
- Default position is type-dependent: `0.5` for straight/arc; for elbow, the midpoint handle's interpolated
  position (`TLD:packages/tldraw/src/lib/shapes/arrow/arrowLabel.ts#L288-L306`).

**On the handle collision (Harvey's #1).** tldraw resolves it the same way Excalidraw does — **priority, not
displacement**: `isOverArrowLabel` is tested and routed to the label-drag state before `startTranslating`
(`PointingShape.ts` above). Additionally, for arc arrows there is no mid-line handle painted at the label's
anchor at all; only elbow arrows get a midpoint handle
(`TLD:packages/tldraw/src/lib/shapes/arrow/ArrowShapeUtil.tsx#L305-L340`, handles = Start, End, plus a
`type: 'virtual'` Middle only when `shape.props.kind === 'arc'`). **Two mature tools, two different
resolutions of the same collision, and neither one moves the label or the handle away from the line.**

### 2.2 (b) Label background — there is no box; there is a text outline

There is **no label-background property**: nothing in `TLArrowShapeProps` (`TLD:…/TLArrowShape.ts#L148-L180`),
and no `background-color` is ever set on the label wrapper. `.tl-text-wrapper` carries no background; the only
rule that mentions one is for the editing state (`TLD:packages/editor/editor.css#L709-L712`):

```css
.tl-text-label[data-isediting='true'] {
	background-color: transparent;
	min-height: auto;
}
```

What tldraw uses instead is a **text outline in the canvas colour**, on by default. Option
(`TLD:packages/tldraw/src/lib/shapes/arrow/ArrowShapeUtil.tsx#L176`, `ArrowShapeUtil` options — `showTextOutline: true`),
documented as (`TLD:packages/tldraw/src/lib/shapes/arrow/arrow-types.ts#L119-L123`):

> Whether to show the outline of the arrow shape's label (using the same color as the canvas). This helps with
> overlapping shapes. It does not show up on Safari, where text outline is a performance issues.

Exposed publicly in the options table at `tldraw.dev/sdk-features/default-shapes`
("`showTextOutline` | `boolean` | `true` | Whether to show a text outline on arrow labels for readability").

CSS (`TLD:packages/editor/editor.css#L144-L153` and `#L888-L894`):

```css
	--tl-text-outline-a: calc(min(0.5, 1 / var(--tl-zoom)) * 2px);
	--tl-text-outline-b: calc(min(0.5, 1 / var(--tl-zoom)) * -2px);
	--tl-text-outline-reference:
		0 var(--tl-text-outline-b) 0 var(--tl-color-background),
		0 var(--tl-text-outline-a) 0 var(--tl-color-background),
		var(--tl-text-outline-b) var(--tl-text-outline-b) 0 var(--tl-color-background),
		… ;
	--tl-text-outline: var(--tl-text-outline-reference);
…
.tl-text__outline { text-shadow: var(--tl-text-outline); }
.tl-text__no-outline { text-shadow: none; }
```

Note the outline is **zoom-compensated** (`min(0.5, 1 / var(--tl-zoom))`) so it stays a constant screen-space
weight — a detail Diagram Studio will need if it adopts an outline instead of a box.

The line is still cut under the label, via an SVG `clipPath` using the nonzero winding rule — outer rect
clockwise, label rect counter-clockwise, arrowheads appended
(`ArrowClipPath`, `TLD:packages/tldraw/src/lib/shapes/arrow/ArrowShapeUtil.tsx#L1203-L1258`), consumed by
`ArrowSvg`'s `<clipPath>` (`#L1105-L1128`).

`labelColor` **is** a real style prop, separate from the stroke colour
(`TLD:packages/tlschema/src/styles/TLColorStyle.ts#L47-L50`):

```ts
export const DefaultLabelColorStyle = StyleProp.defineEnum('tldraw:labelColor', {
	defaultValue: 'black',
	values: defaultColorNames,
})
```

resolved to `labelColor: getColorValue(colors, labelColor, 'solid')`
(`TLD:…/ArrowShapeUtil.tsx#L169-L183`) — **but there is no UI control for it.** Grep of
`packages/tldraw/src/lib/ui` for `labelColor` returns **0** hits, and `STYLES` in
`TLD:packages/tldraw/src/lib/styles.tsx#L96-L190` has no `labelColor` list. So a tldraw arrow's label colour is
API-only; the panel's single "Color" row drives `color` (the arrow).

**So: neither tool gives the label a configurable background, and tldraw's answer to ask #2 is a third option
Harvey hasn't mentioned — no box, plus an outline in the canvas colour.**

### 2.3 (c) What the arrow panel exposes, and as what control type

Panel composition, verbatim (`TLD:packages/tldraw/src/lib/ui/components/StylePanel/DefaultStylePanelContent.tsx#L39-L64`):

```tsx
export function DefaultStylePanelContent() {
	return (
		<>
			<StylePanelSection>
				<StylePanelColorPicker />
				<StylePanelOpacityPicker />
			</StylePanelSection>
			<StylePanelSection>
				<StylePanelFillPicker />
				<StylePanelDashPicker />
				<StylePanelSizePicker />
			</StylePanelSection>
			<StylePanelSection>
				<StylePanelFontPicker />
				<StylePanelTextAlignPicker />
				<StylePanelLabelAlignPicker />
			</StylePanelSection>
			<StylePanelSection>
				<StylePanelGeoShapePicker />
				<StylePanelArrowKindPicker />
				<StylePanelArrowheadPicker />
				<StylePanelSplinePicker />
			</StylePanelSection>
		</>
	)
}
```
Each picker returns `null` when `styles.get(<StyleProp>)` is `undefined`, i.e. the row is shown only if the
selected shape declares that style prop. That is the mechanism behind the panel changing shape per selection.

**Live confirmation** (tldraw.com, CDP, arrow selected): the style panel rendered exactly
`"Line\nArrows"` as its text, with `data-testid`s present: `style.color*` (13), `style.opacity`,
`style.fill*`, `style.fill-extra`, `style.dash*`, `style.size*`, `style.font*`, **`style.arrow-kind`**,
**`style.arrowheadStart`**, **`style.arrowheadEnd`**.

| Row | Control type | Evidence |
|---|---|---|
| Color | `StylePanelButtonPicker` — 13-icon **button row** | `DefaultStylePanelContent.tsx#L77-L98`; `STYLES` colours via `getColorStyleItems` |
| Opacity | **slider**, 5 discrete steps `[0.1, 0.25, 0.5, 0.75, 1]` | `#L100-L144`, `tldrawSupportedOpacities` |
| Fill | **button row** (none/semi/solid) + overflow **dropdown** (pattern/lined-fill/fill) | `#L146-L181`, `StylePanelButtonPickerInline` + `StylePanelDropdownPickerInline isOverflow` |
| Dash | **button row** (draw/dashed/dotted/solid) | `#L184-L198`, `STYLES.dash` |
| Size | **button row** (s/m/l/xl) | `#L200-L221`, `STYLES.size` |
| Font | **button row** (draw/sans/serif/mono) | `#L222-L242`, `STYLES.font` |
| Text align | **button row** + dropdown for vertical align | `#L245-L280` |
| Label align | **button row** (`style-panel.label-align` = "Label align") + dropdown | `#L282-L330`; i18n `defaultTranslation.ts#L419` |
| Shape (geo) | **dropdown** (`type="menu"`) | `#L331-L360` |
| **Line (arrow kind)** | **dropdown** — items `[{value:'arc'},{value:'elbow'}]` | `#L362-L381`; `STYLES.arrowKind` at `styles.tsx#L142-L145`; label `style-panel.arrow-kind` = **"Line"** (`defaultTranslation.ts#L425`) |
| **Arrows (arrowheads)** | **double dropdown** — two triggers in one row, each opening a popover | `#L383-L408` |
| Spline | **dropdown** — `line`/`cubic`, `line` shape only | `#L410-L422` |

**Arrowheads in detail** (`DefaultStylePanelContent.tsx#L383-L408`):

```tsx
	return (
		<StylePanelDoubleDropdownPicker<TLArrowShapeArrowheadStyle>
			label="style-panel.arrowheads"
			uiTypeA="arrowheadStart"  styleA={ArrowShapeArrowheadStartStyle}
			itemsA={STYLES.arrowheadStart} valueA={arrowheadStart}
			uiTypeB="arrowheadEnd"    styleB={ArrowShapeArrowheadEndStyle}
			itemsB={STYLES.arrowheadEnd}   valueB={arrowheadEnd}
			labelA="style-panel.arrowhead-start"
			labelB="style-panel.arrowhead-end"
		/>
	)
```
i18n (`TLD:packages/tldraw/src/lib/ui/hooks/useTranslation/defaultTranslation.ts#L422-L424`):
`style-panel.arrowheads` = **"Arrows"**, `style-panel.arrowhead-start` = **"Start"**,
`style-panel.arrowhead-end` = **"End"**.

Live DOM of the two triggers:
```html
<button … data-testid="style.arrowheadStart" aria-haspopup="dialog" aria-expanded="false"
        aria-label="Start — None"  class="tlui-button tlui-button__icon">
<button … data-testid="style.arrowheadEnd"   aria-haspopup="dialog" aria-expanded="false"
        aria-label="End — Arrow"   class="tlui-button tlui-button__icon">
```
and the arrow-kind trigger:
```html
<button … data-testid="style.arrow-kind" data-direction="left" aria-haspopup="dialog"
        aria-label="Line — Arc" class="tlui-button tlui-button__menu">
```
Opening the end picker in a live session exposed items
`style.arrowheadEnd.{none, arrow, triangle, square, dot, diamond, inverted, bar}` — 8 values.

Value lists (`TLD:packages/tldraw/src/lib/styles.tsx#L146-L176`) are identical for start and end: `none`,
`arrow`, `triangle`, `square`, `dot`, `diamond`, `inverted`, `bar`. The schema enum is wider — `arrowheadTypes`
also contains `'pipe'` (`TLD:packages/tlschema/src/shapes/TLArrowShape.ts#L63-L73`) and i18n has
`arrowheadStart-style.pipe` / `arrowheadEnd-style.pipe` = "Pipe"
(`defaultTranslation.ts#L217`, `#L226`), but `STYLES.arrowheadStart/End` never list it. So **tldraw's schema
accepts a marker its panel cannot select** — worth knowing if Diagram Studio ever imports a tldraw file.
Defaults: `ArrowShapeArrowheadStartStyle` = `'none'`, `ArrowShapeArrowheadEndStyle` = `'arrow'`
(`TLD:…/TLArrowShape.ts#L96-L124`).

Layout inside a picker is width-driven: `const Layout = items.length > 4 ? TldrawUiGrid : TldrawUiRow`
(`TLD:packages/tldraw/src/lib/ui/components/StylePanel/StylePanelButtonPicker.tsx#L152`). So tldraw's own rule
is: **≤ 4 options → one row; > 4 → grid**. That is the most transferable single fact in this section for
asks #8 and #9.

Also note `StylePanelButtonPicker` supports **scrub-drag across buttons** (pointerdown then drag across
siblings applies each in turn — `handleButtonPointerEnter` / `handleButtonPointerDown` / `handleButtonPointerUp`,
`TLD:…/StylePanelButtonPicker.tsx#L87-L152`), with an explicit bug-fix comment about a scrub that starts in
another section. So a "button row" in tldraw is not a plain radio group; it is a live-scrubbable control.

### 2.4 (d) Selection vs authored colour — tldraw never tints the shape

Same architecture as Excalidraw. `ShapeIndicatorOverlayUtil.render`
(`TLD:packages/tldraw/src/lib/overlays/ShapeIndicatorOverlayUtil.ts#L115-L132`):

```ts
		ctx.strokeStyle = editor.getCurrentTheme().colors[editor.getColorMode()].selectionStroke
		ctx.lineWidth = this.options.lineWidth / zoom
		strokeShapeIndicators(editor, ctx, idsToDisplay)
```
with `options = { zIndex: 50, lineWidth: 1.5, hintedLineWidth: 2.5 }` (`#L34`) and
`selectionStroke: 'hsl(214, 84%, 56%)'` in both light and dark themes
(`TLD:packages/editor/src/lib/editor/managers/ThemeManager/defaultThemes.ts#L140`, `#L362`).

The indicator shape comes from the shape util's `getIndicatorPath` — for arrows that is the body path, clipped
around the label and around any non-`arrow` arrowhead so the indicator does not cross the label gap
(`TLD:packages/tldraw/src/lib/shapes/arrow/ArrowShapeUtil.tsx#L884-L975`; consumed by
`strokeShapeIndicators` in `TLD:packages/editor/src/lib/editor/overlays/strokeShapeIndicators.ts#L28-L80`,
which batches all plain indicators into one `ctx.stroke` and falls back to a per-shape
`save/clip/stroke/restore` for the clipped arrow case).

`isSelected` inside `ArrowShapeUtil.component` is used **only** for `RichTextLabel`'s `data-isselected`
attribute — which gates the transparent text-input overlay, not any colour
(`ArrowShapeUtil.tsx#L826-L880` → `RichTextLabel.tsx#L138-L144`, `#L738-L741` in `editor.css`).

Two extra notes:

- **Hover also uses the indicator overlay**, and it is explicitly disabled for coarse pointers
  (`ShapeIndicatorOverlayUtil.ts#L63-L88`):
  ```ts
  			if (isIdleOrEditing && isHoveringCanvas && !isCoarsePointer) {
  				const hovered = editor.getHoveredShapeId()
  				…
  ```
  So tldraw's hover affordance is touch-safe by omission — there is no hover state on touch, and nothing
  depends on it.
- **Hit tolerance grows for touch.** `hitTestMargin: 3` vs `coarseHitTestMargin: 4`
  (`TLD:packages/editor/src/lib/options.ts#L316-L317`), resolved as
  `margin / this.getZoomLevel()` in `Editor.getHitTestMargin`
  (`TLD:packages/editor/src/lib/editor/Editor.ts#L5853-L5857`), using
  `this.getInstanceState().isCoarsePointer`.

**Conclusion for bug #7: both tools treat selection as a separate overlay in a theme colour, never as a
restroke of the element.** Diagram Studio's `!important` selection stroke is the only place in this comparison
where selection overwrites authored colour, and neither tool does it.

### 2.5 (e) Flow / animation — a *reduce-motion* preference, not an edge feature

tldraw's `animationSpeed` is a **user preference**, not a shape/edge property
(`TLD:packages/editor/src/lib/config/TLUserPreferences.ts#L20`, validator `#L51`):

```ts
	// N.B. These are duplicated in TLdrawAppUser.
	animationSpeed?: number | null
```
default (`#L173`): `animationSpeed: userPrefersReducedMotion() ? 0 : 1`, and the resolved getter follows the
live OS setting until the user overrides (`TLD:packages/editor/src/lib/editor/managers/UserPreferencesManager/UserPreferencesManager.ts#L92-L100`):

```ts
	@computed getAnimationSpeed() {
		// Until the user explicitly sets a speed, follow the OS reduce-motion setting live rather
		// than the value `defaultUserPreferences` captured at module load.
		return (
			this.user.userPreferences.get().animationSpeed ??
			(this.systemPrefersReducedMotion.get() ? 0 : 1)
		)
	}
```

Its consumers are all **navigation**, never an edge: camera moves and follow-the-user
(`TLD:packages/editor/src/lib/editor/Editor.ts#L4002`, `#L4070`, `#L4583`), plus one shape-side hook
`usePrefersReducedMotion` (`TLD:packages/tldraw/src/lib/shapes/shared/usePrefersReducedMotion.tsx#L5-L10`). It
is surfaced to the user as a checkbox, "Toggle reduce motion"
(`TLD:packages/tldraw/src/lib/ui/context/actions.tsx#L1312-L1324`:
`animationSpeed: editor.user.getAnimationSpeed() === 0 ? 1 : 0`; menu item
`ToggleReduceMotionItem` in `TLD:packages/tldraw/src/lib/ui/components/menu-items.tsx#L660-L672`).

Grep of `packages/tldraw/src/lib/shapes/` for `animationSpeed` hits only that hook and a note-cloning test.
**There is no per-arrow flow/marching-ants animation in tldraw.**

This is direct evidence for ask #10: **`animationSpeed` and a "Flow Animation" edge option are different
axes.** One is an accessibility gate that switches motion *off* globally; the other is an authored decorative
property of one edge. Merging them (or placing them in the same panel section) would be the "confusion"
Harvey is worried about, and neither tool gives a precedent for mixing them.

### 2.6 (f) Bonus tldraw things a shared tool should copy

- **`labelCenterSnapDistance`** (10 screen px): drag the label near the middle and it snaps back to default.
  A reset gesture with zero UI. Publicly documented and configurable
  (`tldraw.dev/sdk-features/default-shapes`).
- **`getClampedPosition`**: the label can never overlap an arrowhead or leave the line, enforced in geometry
  (`arrowLabel.ts#L263-L278`). Diagram Studio's 3 fixed slots have no such guard, and neither would a naive
  free-drag.
- **Label as an opt-in hit region** (`isLabel` + `Geometry2dFilters.EXCLUDE_LABELS`): the label does not enlarge
  the shape's hit area for other tools, but `isOverArrowLabel` can still test for it exactly. This is a cleaner
  answer than a separate invisible overlay element.
- **One gesture, two meanings**: on an already-selected arrow, pointerdown on the label + drag = move, + no
  drag = edit (`PointingArrowLabel.ts#L144-L154`). Solves ask #4 without a second affordance.
- **`ArrowShapeUtil.configure({...})`**: every interaction constant (snap distances, hover timeouts,
  `showTextOutline`, `shouldBeExact`) is a typed, documented option — the pattern for making Diagram Studio's
  magic numbers defensible and overridable (`tldraw.dev/sdk-features/default-shapes`).
- **Fill vs outline markers come from `fill`, not from the marker enum**: `ArrowSvg` fills an arrowhead only
  when `shape.props.fill !== 'none'` (and special-cases `'pattern'`)
  (`ArrowShapeUtil.tsx#L1140-L1192`). Excalidraw instead bakes outline-ness into the marker value
  (`triangle` vs `triangle_outline`). Two different designs; see §4.

---

## 3. WHERE THE TWO TOOLS DISAGREE (the owner must decide)

| # | Question | Excalidraw | tldraw | Consequence for Diagram Studio |
|---|---|---|---|---|
| D1 | Where the label lives | separate `text` element, `containerId` ↔ `boundElements` two-way link | `richText` + `labelPosition` inside the arrow's props | Diagram Studio is React-Flow-shaped (edge `data`/`label`), i.e. tldraw's camp. Copying Excalidraw's two-element model means two records to keep in sync per edge. |
| D2 | Label placement value | `labelPosition` arc-length fraction on the *text* element | `labelPosition` fraction on the *arrow* | Both 1-D fractions, so the *value* is agreed; only the *owner record* differs. Neither uses x/y. |
| D3 | Label vs handle collision | knob wins, documented as priority | label route checked before translating | Both: priority, not displacement. |
| D4 | Label background | always erased-hole, never any box | no box at all; text outline in canvas colour | Neither offers a fill. Ask #2 has **no mature-tool precedent for a colour picker**; tldraw is the only evidence for a third option (outline). |
| D5 | Off-centre double-click on a line | **free text, not a label** (30-px snap gate) | **label** (no gate) | Ask #4 ("double-click anywhere on a line creates one") is supported by tldraw, contradicted by Excalidraw. |
| D6 | Arrowhead control type | two popover triggers, 4 inline options each + "More options" | two dropdown triggers, 8 in a grid | Neither uses a flat button row for the full marker set. tldraw's own `> 4 → grid` rule (`StylePanelButtonPicker.tsx#L152`) is the explicit threshold. |
| D7 | Arrowhead end names | **no visible end names**; legend "Arrowheads", aria `arrowhead_start`/`arrowhead_end` | **"Start" / "End"** inside a section titled **"Arrows"** | Ask #9's "head start / head end" is supported by **neither**. "Start"/"End" has tldraw support; "Start"/"End" in a section named "Markers" would match tldraw's split. |
| D8 | Line style / curvature | 3-way **button row**: sharp / round / elbow, on 2 storage fields | 2-way **dropdown**: arc / elbow | Excalidraw supports ask #8 (button row for curvature); tldraw contradicts it but puts routing in the same control. |
| D9 | Opacity | slider 0–100, step 10 | slider, 5 discrete steps | Agreed: slider, not a button row. |
| D10 | Marker fill vs outline | separate marker values (`triangle` vs `triangle_outline`) | arrow's `fill` style decides | Diagram Studio has neither; picking one is a data-model decision. |
| D11 | Flow animation | **absent** | only a global reduce-motion preference | Neither supports a flow animation. Diagram Studio's feature is ahead; the risk is confusing it with motion settings (ask #10). |
| D12 | Selection colour | overlay only, `--color-selection` | overlay only, theme `selectionStroke` | **Agreed, strongly.** No precedent anywhere for restroking a selected element. |
| D13 | Arrowhead vocabulary | 9 marker values incl. 6 cardinality, `pipe` absent | 8 in UI, `pipe` in schema, `square`/`dot`/`inverted` naming | Overlap: none/arrow/triangle/diamond/bar. tldraw-only: square, dot, inverted. Excalidraw-only: circle, circle_outline, triangle_outline, diamond_outline, cardinality×6. Diagram Studio already has ERD cardinality as a separate section — Excalidraw folds cardinality into the marker picker, which is an option. |
| D14 | Label ink | text element's `strokeColor` (single "Stroke" picker) | `labelColor` prop, **no UI control** | Divergence: Excalidraw makes label ink part of the normal colour control; tldraw gives it a separate field and hides it. Ask #2 is the same question; see §4. |

---

## 4. WHAT THIS MEANS FOR HARVEY'S ASKS (evidence-backed only)

- **#1 (drag the label anywhere, not 3 slots).** Both tools agree the *value* is a continuous normalized
  parameter along the line, and neither allows off-line placement. The achievable upgrade with precedent is
  **free drag along the line, addressed by arc-length fraction**, plus tldraw's snap-back-to-default. Free 2-D
  label placement has **no precedent in either tool** — flag this to the owner rather than designing it.
- **#2 (label background adjustable, including fully transparent).** Neither tool has a label-background
  control. Excalidraw's backdrop is *always* transparent (line erased); tldraw has no backdrop and uses a
  zoom-compensated `text-shadow` outline in the canvas colour instead. **If Diagram Studio builds a background
  picker it will be ahead of both tools** — the defensible design is "None (outline in surface colour) /
  transparent / filled", where the first two have precedent and the third does not.
- **#4 (double-click anywhere on a line creates a label).** tldraw does exactly this. Excalidraw deliberately
  does not (30-px centre snap → free text otherwise). tldraw's extra trick: on an already-selected arrow, drag
  on the label = move, no-drag = edit.
- **#7 (selection tint hides the authored colour).** Both tools resolve this by keeping authored colour on the
  element's own draw and selection on a separate overlay (a theme colour). Diagram Studio's `!important`
  selection rule is unique to it. **Highest-confidence fix in this report.**
- **#8 / #9 (button rows, balanced widths).** Excalidraw uses flat button rows for 3–4-option sets (stroke
  width, stroke style, arrow type) and popover triggers only for the 9-marker set. tldraw uses flat rows for
  ≤ 4 items and a grid above 4 (`StylePanelButtonPicker.tsx#L152`). **Two independent tools, same threshold.**
  Marker sets must not be flat rows.
- **#9 (naming).** tldraw: "Start" / "End" in a section titled "Arrows". Excalidraw: no visible names.
  "head start" / "head end" has no support.
- **#10 (flow animation design review).** Neither tool has an edge flow animation; tldraw has only a global
  reduce-motion toggle (`animationSpeed`, exposed as "Toggle reduce motion"). Keep them separate axes; do not
  merge a decorative edge animation with a motion/accessibility setting.

---

## RECOMMENDATIONS

Each item: **{utility · evidence (tool + URL) · the interaction · data-model cost · confidence}**.
Constraints from the brief are respected: no new npm dependency is proposed anywhere; no hard-coded hex is
introduced (all colour values cited are CSS variables or theme tokens the tools already own); every interaction
below works on touch (see the touch audit at the end).

1. **Selection must never restroke the edge body.**
   *Evidence:* Excalidraw — authored colour is baked into the element's cached bitmap
   (`…/packages/element/src/shape.ts#L195-L235`) while selection chrome is a separate interactive-canvas pass
   using `--color-selection` (`…/packages/excalidraw/renderer/interactiveScene.ts#L1425-L1465`,
   `…/packages/excalidraw/css/theme.scss#L83`). tldraw — `ShapeIndicatorOverlayUtil.render` strokes an
   indicator path in `theme.colors[mode].selectionStroke`
   (`…/packages/tldraw/src/lib/overlays/ShapeIndicatorOverlayUtil.ts#L123`).
   *Interaction:* Unchanged from today except that the authored colour is visible *while selected*; selection
   reads as an offset outline, not a recolour. Selected hit area may widen to the edge's bounds for touch.
   *Data-model cost:* **zero new fields.** Three rules in the project's own stylesheet do the recolouring and all
   three go: `.react-flow__edge.selected .react-flow__edge-path { stroke: var(--sel) !important }`
   (`src/styles.css:1217`), `.ds-electric .react-flow__edge-path { stroke: var(--sel) !important; stroke-width: 4 !important }`
   (`:2655-L2656` — the hover "electric edge" — which is the same defect one interaction earlier), and
   `.react-flow__edge.selected .react-flow__edge-text { fill: var(--sel) }` (`:1221`, same recolour applied to
   the label). Replace with an over-stroke of the same path in `var(--sel)` (React Flow already renders
   `react-flow__edge-interaction` as a separate path, so a third, indicator path is available without touching
   the authored one). *Confidence:* **high** (both primary sources agree; this is the one place the two tools
   are unanimous; all three project line numbers verified).

2. **Store the label's position as one normalized arc-length fraction (0–1), not as offsets or slots.**
   *Evidence:* Excalidraw `labelPosition` on the text element, documented as "normalized arc-length parameter
   (0–1) along the container's whole path … survives midpoint insertion"
   (`…/packages/element/src/types.ts#L285-L290`); drag math at
   `…/packages/element/src/linearElementEditor.ts#L1967-L2030`. tldraw `labelPosition: T.number`, default 0.5
   (`…/packages/tlschema/src/shapes/TLArrowShape.ts#L148-L180`, `#L251`;
   `…/packages/tldraw/src/lib/shapes/arrow/ArrowShapeUtil.tsx#L257`); drag at
   `…/packages/tldraw/src/lib/tools/SelectTool/childStates/PointingArrowLabel.ts#L96-L141`.
   *Interaction:* Drag the label along the line; the pointer's 2-D position is projected onto the path and
   clamped to `[0, 1]`. Replace Diagram Studio's `data.offset: 'center'|'start'|'end'`
   (`src/GoblinEdge.tsx:102`) + the `labelX/labelY` arithmetic
   (`const labelOffset = {center: 0.5, start: 0.25, end: 0.75}[d.offset ?? 'center']`, `src/GoblinEdge.tsx:383`)
   with one `labelPosition: number | null` (null = centre). This also removes the collision at that line by
   construction.
   *Data-model cost:* one number replaces `offset` (an enum) and the derived `labelX/labelY`; a migration must
   map `start/end/center` → `0.25/0.75/0.5` (Excalidraw's own former projection values, per the brief).
   *Confidence:* **high** (both tools, identical value semantics).

3. **Clamp the label to a usable range so it can never sit under an arrowhead or run off the end.**
   *Evidence:* tldraw `getClampedPosition` + `getArrowLabelRange`, accounting for arrowheads and bindings and a
   `LABEL_TO_ARROW_PADDING = 20` (stroke-width- and scale-adjusted) —
   `…/packages/tldraw/src/lib/shapes/arrow/arrowLabel.ts#L153-L278`,
   `…/packages/tldraw/src/lib/shapes/shared/default-shape-constants.ts#L43-L48`; documented as the geometry of
   `labelPosition` at `https://tldraw.dev/sdk-features/default-shapes`.
   *Interaction:* The label slides along the line but stops short of each arrowhead; no UI, no message.
   *Data-model cost:* zero fields — a pure function of `labelPosition` + the resolved path + marker presence.
   *Confidence:* **high** for tldraw; **medium** for the exact padding numbers (they are tldraw's taste; the
   *invariant* is the transferable part).

4. **Add tldraw's snap-back-to-default gesture to the label drag.**
   *Evidence:* `labelCenterSnapDistance: 10` screen px, applied as
   `Vec.DistMin(nextLabelPoint, labelDefaultPoint, options.labelCenterSnapDistance / zoom)` →
   `nextLabelPosition = defaultLabelPosition`
   (`…/packages/tldraw/src/lib/tools/SelectTool/childStates/PointingArrowLabel.ts#L125-L135`;
   `…/packages/tldraw/src/lib/shapes/arrow/ArrowShapeUtil.tsx#L152`; documented default `10` at
   `https://tldraw.dev/sdk-features/default-shapes`).
   *Interaction:* Drag the label near the middle and it snaps to exactly centred — a "put it back" that needs
   no reset button, i.e. it replaces the removal of the "Label position" field (ask #6) without losing the
   ability to restore centre.
   *Data-model cost:* zero fields. *Confidence:* **high** for the gesture; **medium** for the exact 10 px
   (screen-space, so scale it by zoom).

5. **Double-click anywhere on a line edits or creates its label.**
   *Evidence:* tldraw — `Idle.onDoubleClick` `case 'shape'` → `canEditShape` → `startEditingShape`
   (`…/packages/tldraw/src/lib/tools/SelectTool/childStates/Idle.ts#L409-L470`). Excalidraw does **not** do this
   by default and gates on a 30-px centre snap
   (`…/packages/common/src/constants.ts#L26`,
   `…/packages/excalidraw/components/App.arrowText.ts#L163-L178`) —
   and the live app confirms off-centre double-click yields free text.
   *Interaction:* Double-click on the edge (anywhere along it) starts label editing in place; an empty label
   commits at the default position.
   *Data-model cost:* zero fields; one new hit test using `labelPosition` + the edge's resolved path.
   *Confidence:* **high** that tldraw does it; **high** that Excalidraw deliberately does not. Present both.

6. **On an already-selected edge, make one gesture do two things: drag on the label moves it, no-drag starts
   editing.**
   *Evidence:* tldraw `PointingArrowLabel.onPointerUp` —
   `if (shape && !this.didDrag && this.wasAlreadySelected && this.editor.canEditShape(shape)) startEditingShapeWithRichText(...)`
   (`…/packages/tldraw/src/lib/tools/SelectTool/childStates/PointingArrowLabel.ts#L144-L154`), plus a history
   stopping point marked on entry (`#L61-L63`) so the move is one undo step.
   *Interaction:* Removes the need for a visible edit affordance colliding with ask #1's handle.
   *Data-model cost:* zero fields. *Confidence:* **high**.

7. **Make the label an opt-in hit region, not part of the edge's general hitbox.**
   *Evidence:* tldraw `getGeometry` returns `Group2d([bodyGeom, labelGeom{ isLabel: true }])`
   (`…/packages/tldraw/src/lib/shapes/arrow/ArrowShapeUtil.tsx#L262-L304`), and `isLabel` children are excluded
   unless `Geometry2dFilters.includeLabels`
   (`…/packages/editor/src/lib/primitives/geometry/Geometry2d.ts#L88-L94`,
   `…/packages/editor/src/lib/primitives/geometry/Group2d.ts#L91-L115`); the label is then found explicitly by
   `isOverArrowLabel` (`…/packages/tldraw/src/lib/shapes/arrow/arrowLabel.ts#L308-L324`).
   *Interaction:* Dragging the line does not become ambiguous near the label, but grabbing the label is exact.
   *Data-model cost:* zero fields; a second, label-only hit region in `GoblinEdge.tsx`.
   *Confidence:* **high**.

8. **Resolve the handle/label collision by documented hit priority, not by moving either.**
   *Evidence:* Excalidraw — "the segment midpoint knob keeps precedence over the label sitting on top of it, so
   a labeled arrow can still be bent at its middle", and "when the label grab wins … the click must not double as
   a point click" (`…/packages/element/src/linearElementEditor.ts#L1150-L1157`); the label grab also suppresses
   endpoint rebinding via `hitBoundText` in `actionFinalize`
   (`…/packages/excalidraw/actions/actionFinalize.tsx#L88-L94`). tldraw — `isOverArrowLabel` is tested and
   routed to the label-drag state *before* `startTranslating`
   (`…/packages/tldraw/src/lib/tools/SelectTool/childStates/PointingShape.ts#L227-L247`).
   *Interaction:* The bend handle wins when both are under the pointer; the label wins where they don't
   overlap; a label drag never rebinds the edge.
   *Data-model cost:* zero fields — this is the fix for ask #1's actual complaint (the collision), independent
   of whether free positioning is adopted. *Confidence:* **high** (both tools).

9. **Do not restroke the arrowhead separately from the body — set the marker `color` from the same token as
   the stroke.**
   *Evidence:* tldraw draws the arrow body and its arrowheads as one SVG group sharing the shape's own stroke
   colour (`ArrowSvg`, `…/packages/tldraw/src/lib/shapes/arrow/ArrowShapeUtil.tsx#L1140-L1192`); Excalidraw
   generates each element's shape (body and markers together) from that element's own `strokeColor`
   (`…/packages/element/src/shape.ts#L195-L235`), and its SVG export sets the marker colour from the element's
   rough options (`…/packages/excalidraw/renderer/staticSvgScene.ts#L405-L500`).
   *Interaction:* Authoring a colour changes body and markers together, always.
   *Data-model cost:* zero fields — this is the second half of bug #7 (today only the `<marker>` follows
   `eStroke`). *Confidence:* **high**.

10. **Adopt the "≤ 4 options → button row, more → one trigger that opens a popover/grid" rule.**
    *Evidence:* tldraw makes the threshold explicit in code — `const Layout = items.length > 4 ? TldrawUiGrid : TldrawUiRow`
    (`…/packages/tldraw/src/lib/ui/components/StylePanel/StylePanelButtonPicker.tsx#L152`) — and then applies it:
    flat rows for colour/dash/size/font/align; **dropdowns** for arrow kind (2), arrowheads (8), geo (20),
    spline (≥2) (`…/packages/tldraw/src/lib/ui/components/StylePanel/DefaultStylePanelContent.tsx#L39-L422`).
    Excalidraw behaves identically in effect: `RadioSelection` button rows for 3–4-option sets (stroke width,
    stroke style, sloppiness, arrow type) and a two-trigger popover for the 9-marker arrowhead set
    (`…/packages/excalidraw/actions/actionProperties.tsx#L708-L775`, `#L922`, `#L2038-L2060`, `#L1825-L1908`).
    *Interaction:* Ask #8's button rows are correct for stroke width, line style and curvature; ask #9's
    button rows are **not** achievable for a 9-marker set without a 9-wide row.
    *Data-model cost:* zero fields; it constrains the control kit only. *Confidence:* **high** (two independent
    tools, one of them with the threshold in source).

11. **Balance the button rows by icon count, not by hand — and note the "scrub across the row" behaviour both
    toolkits give button rows.**
    *Evidence:* tldraw's `StylePanelButtonPicker` implements pointerdown-then-drag-across-siblings, applying each
    button as the pointer enters it
    (`…/packages/tldraw/src/lib/ui/components/StylePanel/StylePanelButtonPicker.tsx#L87-L152`), with a
    section-crossover guard. Excalidraw's `RadioSelection` rows sit in `div.buttonList`
    (`…/packages/excalidraw/actions/actionProperties.tsx#L725-L731`).
    *Interaction:* Equal-width buttons; press and drag across a row to preview widths/styles.
    *Data-model cost:* zero fields; CSS only — no new hex (use existing tokens / `color-mix()`).
    *Confidence:* **medium** for the scrub behaviour being desirable in Diagram Studio (it is a desktop pointer
    idiom, though it degrades to taps on touch); **high** that both toolkits have it.

12. **Name the two marker ends "Start" and "End", in a section that is not called "Arrow head".**
    *Evidence:* tldraw: `style-panel.arrowheads` = "Arrows", `style-panel.arrowhead-start` = "Start",
    `style-panel.arrowhead-end` = "End" (`…/packages/tldraw/src/lib/ui/hooks/useTranslation/defaultTranslation.ts#L422-L424`),
    rendered as two trigger buttons with `aria-label="Start — None"` / `"End — Arrow"` (live DOM, tldraw.com).
    Excalidraw has no visible end names at all; the ends exist only as `arrowhead_start` / `arrowhead_end`
    aria-labels and `startArrowhead` / `endArrowhead` in the data model
    (`…/packages/excalidraw/actions/actionProperties.tsx#L1998-L2036`, `…/packages/element/src/types.ts#L369-L377`).
    *Interaction:* Pure labelling change; the control stays a two-trigger row that opens the marker set.
    *Data-model cost:* zero fields. Optionally rename `markerStart`/`markerEnd` labels only (RF's own keys can
    stay). *Confidence:* **high** that "Start"/"End" is the mature-tool vocabulary; **high** that
    "head start"/"head end" appears in neither tool.

13. **Keep the marker set small and rename the shared subset to the tools' shared vocabulary.**
    *Evidence:* intersection of both tools' marker lists — `none`, `arrow`, `triangle`, `diamond`, `bar`
    (`…/packages/element/src/types.ts#L356-L365`; `…/packages/tldraw/src/lib/styles.tsx#L146-L176`).
    tldraw-only: `square`, `dot`, `inverted` (plus `pipe`, schema-only — i18n exists at
    `defaultTranslation.ts#L217`/`#L226` but `STYLES` never lists it, so the panel cannot select it).
    Excalidraw-only: `circle`, `circle_outline`, `triangle_outline`, `diamond_outline`, and six cardinality
    values (`…/packages/excalidraw/locales/en.json#L50-L67`).
    *Interaction:* Rename Diagram Studio's marker glyphs to the shared names so a user coming from either tool
    recognises them; drop or rename anything unique to one tool.
    *Data-model cost:* zero new fields; only value names change. *Confidence:* **medium** (the intersection is
    objective; which extras to keep is taste).

14. **Keep ERD cardinality markers in the same picker as the other markers, in a separately-labelled group —
    do not require an ERD mode.**
    *Evidence:* Excalidraw puts the six cardinality markers in `hiddenSections` under
    `t("labels.cardinality")` = "Cardinality", inside the same two-trigger arrowhead fieldset as
    `none/arrow/triangle/…` (`…/packages/excalidraw/actions/actionProperties.tsx#L1825-L1908`,
    `…/packages/excalidraw/locales/en.json#L62-L69`); it also migrates legacy `crowfoot_*` values to
    `cardinality_*` on read (`…/packages/element/src/arrowheads.ts#L1-L34`).
    *Interaction:* One marker control for every diagram type; cardinality is a labelled group inside it.
    *Data-model cost:* zero new fields if Diagram Studio's existing cardinality values already live on the
    same marker props; if they live in a separate ERD-only section, this is a UI regroup, not a migration.
    *Confidence:* **high** for Excalidraw's design; **medium** that regrouping is better for Diagram Studio
    (its `cardinality` section is ERD-only today, which may be a deliberate simplification).

15. **Let a small marker/style set be a flat button row even when storage is two fields.**
    *Evidence:* Excalidraw's "Arrow type" is a 3-way `RadioSelection` row (sharp / round / elbow) that writes
    **two** fields — `roundness` and `elbowed` — and reads back as a 3-way ternary
    (`…/packages/excalidraw/actions/actionProperties.tsx#L2070-L2085`, `#L2247-L2260`); i18n
    `arrowtype_sharp`/`arrowtype_round`/`arrowtype_elbowed` (`…/packages/excalidraw/locales/en.json#L71-L73`).
    *Interaction:* Line style / curvature becomes one button row for the user regardless of how many fields
    back it.
    *Data-model cost:* zero new fields (it *avoids* exposing storage); the mapping function is the only code.
    *Confidence:* **high** as a technique; **medium** that Diagram Studio's four path types
    (straight/step/smoothstep/bezier) collapse cleanly to three row options — that mapping needs a decision.

16. **Do not merge Flow Animation with any motion/accessibility setting.**
    *Evidence:* tldraw has no edge animation; its only related control is a global `animationSpeed` user
    preference (`…/packages/editor/src/lib/config/TLUserPreferences.ts#L20`, `#L173`;
    `…/packages/editor/src/lib/editor/managers/UserPreferencesManager/UserPreferencesManager.ts#L92-L100`)
    surfaced as the checkbox "Toggle reduce motion" (`…/packages/tldraw/src/lib/ui/context/actions.tsx#L1312-L1324`)
    and consumed only by camera/navigation (`…/packages/editor/src/lib/editor/Editor.ts#L4002`, `#L4070`, `#L4583`).
    Excalidraw has no element-level animation at all — its only `stroke-dashoffset` animation is the laser
    pointer trail (`…/packages/excalidraw/animatedTrail.ts#L51-L53`).
    *Interaction:* Keep the edge's Flow Animation in the edge's own section; if a reduce-motion preference is
    ever added, it must be a global setting, and it must be able to switch the edge animation off — but it is
    a different control.
    *Data-model cost:* zero new fields; a separation rule. *Confidence:* **high** that both axes exist and
    differ; **high** that merging them is exactly the "trùng lặp / confuse" risk in ask #10.

17. **Offer "no box, outline in the surface colour" as the default label treatment, and treat a background
    fill as an extra option rather than the only option.**
    *Evidence:* tldraw — no label background property at all; instead `showTextOutline: true` by default,
    rendered as a six-direction `text-shadow` of `var(--tl-color-background)` with a
    `min(0.5, 1 / var(--tl-zoom))` zoom compensation
    (`…/packages/tldraw/src/lib/shapes/arrow/ArrowShapeUtil.tsx#L176`,
    `…/packages/tldraw/src/lib/shapes/arrow/arrow-types.ts#L119-L123`,
    `…/packages/editor/editor.css#L144-L153`, `#L888-L894`), documented at
    `https://tldraw.dev/sdk-features/default-shapes`. Excalidraw's backdrop is always the
    erased hole, never a fill (`…/packages/element/src/renderElement.ts#L1138-L1180`,
    `…/packages/excalidraw/renderer/staticSvgScene.ts#L405-L470`), and `text` is not in `hasBackground`
    (`…/packages/element/src/comparisons.ts#L3-L14`).
    *Interaction:* Default = text with a surface-coloured outline, so the line is hidden behind the glyphs and
    nothing else shows through; ask #2's "fully transparent" is satisfied by removing the outline; a filled box
    remains available as the third state.
    *Data-model cost:* one enum/small object on the edge (`none | outline | fill`) plus the existing fill colour
    source — no new hex, the outline colour is `var(--surface)`/`color-mix()`.
    *Confidence:* **high** that both tools hide the line without a box; **medium** that an outline fits Diagram
    Studio's 5 themes equally well (the outline must be the *surface* colour, which is a token, not a literal).

18. **Cut the collision in Diagram Studio's own geometry: stop painting `.edge-bend-handle` at the label's
    anchor point.**
    *Evidence:* neither tool pins a bend handle to the label anchor — tldraw's only mid-line handle is a
    `type: 'virtual'` Middle that exists solely for `kind === 'arc'`
    (`…/packages/tldraw/src/lib/shapes/arrow/ArrowShapeUtil.tsx#L305-L340`) and the label is hit-tested first
    (`…/packages/tldraw/src/lib/tools/SelectTool/childStates/PointingShape.ts#L227-L247`); Excalidraw's
    midpoint knob is a *path* midpoint, and the label is separately grabbable with explicit priority
    (`…/packages/element/src/linearElementEditor.ts#L1150-L1157`). The project's own handle is painted at
    `const handleAt = {x: labelX, y: labelY}` (`src/GoblinEdge.tsx:299`) with `.edge-bend-handle` styled at
    `src/styles.css:3627` — verified: the handle's position *is* the label's anchor, so at the default
    `offset: 'center'` the two are coincident by construction, not by accident.
    *Interaction:* The bend handle moves off the label's anchor (or is only shown while the label is *not*
    under the pointer), so the two stop competing visually — this is the visual half of Harvey's ask #1, and
    the hit-priority fix (item 8) is the behavioural half.
    *Data-model cost:* zero fields; a CSS/position change plus the priority check. *Confidence:* **medium**
    (the tools prove the collision is real and resolved by priority; neither proves where the handle *should*
    be drawn — that is a design decision for the owner).

19. **Adopt tldraw's coarse-pointer hit tolerance instead of a hover-only affordance.**
    *Evidence:* `hitTestMargin: 3` vs `coarseHitTestMargin: 4`, resolved as `margin / zoom` off
    `isCoarsePointer` (`…/packages/editor/src/lib/options.ts#L316-L317`,
    `…/packages/editor/src/lib/editor/Editor.ts#L5853-L5857`); and the hover indicator is explicitly skipped on
    coarse pointers (`…/packages/tldraw/src/lib/overlays/ShapeIndicatorOverlayUtil.ts#L63-L88`). Excalidraw
    instead makes a **selected** element's hit area its bounding box
    (`…/packages/excalidraw/components/App.tsx#L6785-L6805`) — the same effect without hover.
    *Interaction:* Thin edges are grabbable by finger once selected/with a small extra tolerance; nothing
    depends on hover.
    *Data-model cost:* zero fields. *Confidence:* **high** that both tools are touch-safe here; **high** that
    Diagram Studio should not introduce a hover-dependent affordance for any of items 1–18.

20. **Add a "reset label to centre" via the drag gesture, and delete the "Label position" field (ask #6).**
    *Evidence:* item 4's snap (`labelCenterSnapDistance`, tldraw) and Excalidraw's default
    `DEFAULT_BOUND_TEXT_LABEL_POSITION = 0.5` written on label creation and on first edit
    (`…/packages/element/src/textElement.ts#L588`;
    `…/packages/tldraw/src/lib/shapes/arrow/ArrowShapeUtil.tsx#L985-L998`)
    *Interaction:* The `start | center | end` dropdown disappears; centre is reachable by drag, and restored by
    dragging near the middle. Ask #5 (remove "Intent label") is independent and needs no replacement.
    *Data-model cost:* removes a field (see item 2's migration). *Confidence:* **high**.

### Touch audit (brief §7 constraint)

Every recommendation above is pointer-type agnostic. The two tools' own mechanisms are touch-safe:

- Label drag: pointerdown-on-label → pointermove, started from an explicit hit test — no hover needed
  (`TLD:…/PointingArrowLabel.ts#L43-L141`; `EXC:…/linearElementEditor.ts#L1149-L1180`).
- Hit tolerance grows on coarse pointers (`TLD:packages/editor/src/lib/options.ts#L316-L317`) or is
  stroke/zoom-derived (`EXC:packages/excalidraw/components/App.tsx#L6772-L6780`) or expands to the bounding box
  once selected (`EXC:packages/excalidraw/components/App.tsx#L6785-L6805`).
- Hover indicators are explicitly disabled on coarse pointers (`TLD:…/ShapeIndicatorOverlayUtil.ts#L63-L88`).

**One touch caveat to flag:** tldraw has `PointingShape.onLongPress` → `startTranslating`
(`TLD:packages/tldraw/src/lib/tools/SelectTool/childStates/PointingShape.ts#L250-L272`). A long-press that
starts on the *label* therefore translates the whole arrow, not the label. If Diagram Studio adds both a label
drag and a long-press translate, the same conflict appears — the tools give no precedent for resolving it.
`[UNVERIFIED — design gap]`; I did not confirm it on a touch device (only CDP mouse events were available in
this session).

### Items with no mature-tool precedent (flag to the owner before building)

- **Free 2-D label placement** off the line (ask #1 read literally): **neither** tool supports it; both store a
  1-D path fraction. `[no precedent]`
- **A configurable label background fill** (ask #2): **neither** tool has a label-background control.
  `[no precedent for the fill]`; tldraw gives precedent for the *outline* alternative.
- **An edge-level flow/marching-ants animation**: neither tool has one; tldraw has only a global reduce-motion
  preference. `[no precedent]`
- **"head start" / "head end" naming** (ask #9): appears in neither tool. `[no precedent]`

### `[UNVERIFIED]` list — what I tried and could not confirm

- **Excalidraw arrowhead popover contents on the live site.** I confirmed the two trigger buttons exist and
  carry `aria-label="arrowhead_start"` / `"arrowhead_end"`, but clicking the end trigger in the live session
  opened the colour picker dialog instead (the DOM query returned `["#1e1e1e", …, "Stroke"]`), so the visible
  vs "More options" split is taken from **source only**
  (`…/packages/excalidraw/actions/actionProperties.tsx#L1825-L1908`) and not from the live app. The option
  *counts* and *names* are source-verified; the *rendered grouping* is not.
- **tldraw's "Pipe" arrowhead in the panel.** `pipe` is in the schema enum and in i18n, but absent from
  `STYLES.arrowheadStart/End`. I could not select it in the live style panel (the opened popover listed
  `…arrowheadEnd.{none,arrow,triangle,square,dot,diamond,inverted,bar}` — 8 items, no `pipe`). So: schema
  accepts it, panel cannot produce it. Whether a hand-authored file renders it correctly is
  `[UNVERIFIED]`.
- **tldraw's label drag on a real touch device.** The long-press conflict in the touch audit above was reasoned
  from source (`PointingShape.ts#L250-L272`), not observed. `[UNVERIFIED]`
- **`tldraw.dev` documentation pages for the arrow shape specifically.** `https://tldraw.dev/sdk-features/arrow-shape`
  and `https://tldraw.dev/sdk-features/arrow` both return the site's 404 page (verified in the browser). The
  arrow's documented surface I used is therefore: `https://tldraw.dev/sdk-features/default-shapes`,
  `https://tldraw.dev/sdk-features/bindings`, `https://tldraw.dev/reference/tlschema/TLArrowShape`,
  `https://tldraw.dev/reference/editor/Editor`.
- **`docs.excalidraw.com` has no page describing arrow labels' interaction or data model.** I fetched
  `…/docs/codebase/json-schema` (generic element array only), `…/docs/@excalidraw/excalidraw/api/props/`,
  `…/api/props/ui-options`, `…/api/utils/export`, `…/api/utils/bounds` (404), `…/docs/codebase/attributes` (404),
  `…/docs/codebase/faq` (404), `…/docs/introduction/get-started` (404). All arrow-label evidence for Excalidraw
  is therefore **source + live app**, not their docs.
