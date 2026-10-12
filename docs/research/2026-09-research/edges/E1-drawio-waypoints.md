# E1 — draw.io / diagrams.net: the complete movable-waypoint (edge point) system

Research pass for the Diagram Studio edge-reshaping build decision.
Date: 2026-09-18 · Cluster: SHARED-BRIEF sub-question 1 (draw.io only).
Sources: mxGraph source (`jgraph/mxgraph` master, also vendored inside `jgraph/drawio` `dev`
at `src/main/webapp/mxgraph/src/…`), draw.io editor source (`jgraph/drawio` `dev`,
`src/main/webapp/js/grapheditor/…`), official draw.io manual, GitHub issues.

---

## 0. Scope + what I read

**In scope:** the draw.io waypoint ("edge point" / "bend" / "control point") system end to end —
storage, interaction, per-line-type behaviour, reset, snapping, known limitations.

**Out of scope / deliberately not covered:** shape & palette design (covered by
`PALETTE-1-drawio.md`), connection *points on shapes* (the `points[]` style array and the
"Edit Connection Points" editor) except where it is needed to disambiguate the word "points",
theming, collaboration, labels.

**Vocabulary trap (important for the build):** draw.io uses the word **"points" for two
unrelated things**, and they must not be confused:

| Concept | Storage | Meaning |
|---|---|---|
| **waypoint / edge point / bend / control point** | `mxGeometry.points` on an **edge** cell | intermediate point of the *line's route* |
| **connection point** | `points=` **style key** on a **vertex** | a fixed anchor on a *shape's perimeter* a connector may attach to |

The task's subject is the first one. The second is what `Edit Connection Points` edits [13][33].

### Source inventory (what was actually fetched, and from where)

Primary source code (fetched by me, raw.githubusercontent.com):

- `jgraph/mxgraph@master: javascript/src/js/view/mxEdgeStyle.js` [1]
- `jgraph/mxgraph@master: javascript/src/js/model/mxGeometry.js` [2]
- `jgraph/mxgraph@master: javascript/src/js/handler/mxEdgeHandler.js` [3]
- `jgraph/mxgraph@master: javascript/src/js/handler/mxEdgeSegmentHandler.js` [4]
- `jgraph/mxgraph@master: javascript/src/js/handler/mxElbowEdgeHandler.js` [5]
- `jgraph/mxgraph@master: javascript/src/js/view/mxGraphView.js` [6]
- `jgraph/mxgraph@master: javascript/src/js/view/mxGraph.js` [7]
- `jgraph/mxgraph@master: javascript/src/js/view/mxStyleRegistry.js` [8]
- `jgraph/mxgraph@master: javascript/src/js/util/mxConstants.js` [9]
- `jgraph/mxgraph@master: javascript/src/js/util/mxPoint.js` [10]
- `jgraph/mxgraph@master: javascript/src/js/util/mxUtils.js` [11]
- `jgraph/mxgraph@master: javascript/src/js/shape/mxPolyline.js` [12]
- `jgraph/mxgraph@master: javascript/src/js/shape/mxConnector.js` [29]
- draw.io `dev`: `js/grapheditor/Graph.js` [15], `Format.js` [16], `Menus.js` [17],
  `Actions.js` [18], `EditorUi.js` [19], `Shapes.js` [20], `resources/dia.txt` [21]
- draw.io `dev` vendored mxGraph: `mxgraph/src/view/mxEdgeStyle.js` [22],
  `mxgraph/src/handler/mxEdgeHandler.js` [23], `mxgraph/src/handler/mxEdgeSegmentHandler.js` [24],
  `mxgraph/src/handler/mxElbowEdgeHandler.js` [25], `mxgraph/src/view/mxGraphView.js` [26],
  `mxgraph/src/view/mxGraph.js` [27]
- live editor verification: `app.diagrams.net` via browser automation [28]

Official docs / blog: draw.io manual "Work with waypoints on connectors" [30],
"Connectors" [31], "Fixed vs floating connectors" [32], "Customise the connection points" [33],
"Edit the connection points on a shape" (blog) [13], "Hide connection points" [34],
draw.io glossary [35].

Issue tracker / Q&A: `jgraph/drawio` issues #1137 [36], #1147 [37], #2420 [38], #3501 [39],
#3554 [40], #3854 [41], #4791 [42], #5761 [43], #4826 [44].

**Source-diversity note (honest accounting).** The brief allows "no more than ~40% of sources
from a single domain". By raw URL host this cluster is **29/47 on `raw.githubusercontent.com`**,
which exceeds that. The host is a mirror, not a publisher: those 29 files come from **two
repos** (`jgraph/mxgraph` 13 files, `jgraph/drawio` 16 files), and the brief *also* mandates
"primary source code … first" for exactly this question. The waypoint behaviour is not
documented anywhere else — the official manual's one sentence about straight edges is provably
wrong about the data model (§8.4), so a docs-first report here would have been wrong. Counted by
*repo* the spread is: mxGraph upstream source 16, draw.io editor source 13, official docs/blog 7,
issue tracker 9, live editor 1, failed SO 1. I flag the overage rather than hide it.

---

## 1. The model (data structures, quoted from source)

### 1.1 A waypoint is an `mxPoint` in `mxGeometry.points`, on the edge's geometry

`mxGeometry` is the geometry object of a cell. For an edge it holds **optional terminal points
and control points** — the class doc says so verbatim:

> "For vertices, the geometry consists of the x- and y-location, and the width and height.
> For edges, the geometry consists of the optional terminal- and control points. The terminal
> points are only required if an edge is unconnected, and are stored in the `<sourcePoint>` and
> `<targetPoint>` variables, respectively." [2]

and, critically for us, it defines what is *not* automatic about them:

> "Control points are used regardless of the connected state of an edge and **may be ignored or
> interpreted differently depending on the edge's `<mxEdgeStyle>`**." [2]

The three fields:

```js
mxGeometry.prototype.sourcePoint = null;   // Variable: sourcePoint [2]
mxGeometry.prototype.targetPoint = null;   // Variable: targetPoint [2]

/**
 * Variable: points
 *
 * Array of <mxPoints> which specifies the control points along the edge.
 * These points are the intermediate points on the edge, for the endpoints
 * use <targetPoint> and <sourcePoint> or set the terminals of the edge to
 * a non-null value. Default is null.
 */
mxGeometry.prototype.points = null;        // [2]
```

So: **the waypoint array is `geo.points`, an array of `mxPoint`** — and it holds only the
*intermediate* points; the two ends live in `sourcePoint`/`targetPoint` (used only when the edge
is *unconnected*) or in the terminal cells (`mxCell` source/target + connection constraints).

`mxPoint` is a plain 2-D vector:

```js
function mxPoint(x, y)
{
	this.x = (x != null) ? x : 0;
	this.y = (y != null) ? y : 0;
};
```
[10]

`relative` is on the geometry but is **not** what positions waypoints:

```js
/**
 * Specifies if the coordinates in the geometry are to be interpreted as
 * relative coordinates. For edges, this is used to define the location of
 * the edge label relative to the edge as rendered on the display. For
 * vertices, this specifies the relative location inside the bounds of the
 * parent cell.
 * ...
 * Default is false.
 */
mxGeometry.prototype.relative = false;
```
[2]

i.e. for edges, `relative` governs the **label** placement (x = position along the edge −1..1),
not the waypoints. Waypoints in `geo.points` are **absolute model coordinates in the edge's
parent coordinate space** (they get offset by the parent vertex origin during commit — see §1.4).
The related doc-line about relative geometry is:

> "This coordinate system is applied if `<relative>` is true, otherwise the coordinates are
> absolute." [2]

and the label semantics:

> "The x-coordinate of an edge's geometry is used to describe the distance from the center of
> the edge from -1 to 1 with 0 being the center" [2]

### 1.2 How the stored points become the drawn polyline

Rendering a routed edge is a 3-step pipeline in `mxGraphView.updateCellState`:

```js
this.updateFixedTerminalPoints(state, source, target);
this.updatePoints(state, geo.points, source, target);
this.updateFloatingTerminalPoints(state, source, target);
```
[6]

`updatePoints` is the interesting one — it turns `geo.points` into `state.absolutePoints`,
dispatching to the edge style function if there is one, else using the points directly:

```js
mxGraphView.prototype.updatePoints = function(edge, points, source, target)
{
	if (edge != null)
	{
		var pts = [];
		pts.push(edge.absolutePoints[0]);
		var edgeStyle = this.getEdgeStyle(edge, points, source, target);

		if (edgeStyle != null)
		{
			...
			edgeStyle(edge, src, trg, points, pts);
			...
		}
		else if (points != null)
		{
			for (var i = 0; i < points.length; i++)
			{
				if (points[i] != null)
				{
					var pt = mxUtils.clone(points[i]);
					pts.push(this.transformControlPoint(edge, pt));
				}
			}
		}

		var tmp = edge.absolutePoints;
		pts.push(tmp[tmp.length-1]);

		edge.absolutePoints = pts;
	}
};
```
[6]

The **contract of an edge style function** is fixed and documented:

```js
mxEdgeStyle.MyStyle = function(state, source, target, points, result)
```
> "Parameters: ... `points` - list of relative control points (the waypoints), `result` - array
> of <mxPoints> that represent the actual points of the edge" — the style **pushes the routed
> vertices into `result`**, and *it decides* whether/where to honour `points`. [1]

`getEdgeStyle` resolves the string in the style to a function via the registry, and — this
matters for the "straight" case — **returns `null` when `noEdgeStyle` is set**:

```js
var edgeStyle = this.isLoopStyleEnabled(edge, points, source, target) ?
	mxUtils.getValue(edge.style, mxConstants.STYLE_LOOP, this.graph.defaultLoopStyle) :
	(!mxUtils.getValue(edge.style, mxConstants.STYLE_NOEDGESTYLE, false) ?
	edge.style[mxConstants.STYLE_EDGE] : null);
```
[6][26]

The registry maps the style strings draw.io writes into XML to the functions:

```js
mxStyleRegistry.putValue(mxConstants.EDGESTYLE_ELBOW, mxEdgeStyle.ElbowConnector);
mxStyleRegistry.putValue(mxConstants.EDGESTYLE_ENTITY_RELATION, mxEdgeStyle.EntityRelation);
mxStyleRegistry.putValue(mxConstants.EDGESTYLE_LOOP, mxEdgeStyle.Loop);
mxStyleRegistry.putValue(mxConstants.EDGESTYLE_SIDETOSIDE, mxEdgeStyle.SideToSide);
mxStyleRegistry.putValue(mxConstants.EDGESTYLE_TOPTOBOTTOM, mxEdgeStyle.TopToBottom);
mxStyleRegistry.putValue(mxConstants.EDGESTYLE_ORTHOGONAL, mxEdgeStyle.OrthConnector);
mxStyleRegistry.putValue(mxConstants.EDGESTYLE_SEGMENT, mxEdgeStyle.SegmentConnector);
```
[8] — with the string constants `'orthogonalEdgeStyle'`, `'elbowEdgeStyle'`,
`'entityRelationEdgeStyle'`, `'loopEdgeStyle'`, `'sideToSideEdgeStyle'`,
`'topToBottomEdgeStyle'`, `'segmentEdgeStyle'` [9]. draw.io additionally registers
`isometricEdgeStyle` → `mxEdgeStyle.IsometricConnector` in `Shapes.js` [20].

draw.io's default edge style (what a brand-new connector gets) is:

```js
Graph.prototype.defaultEdgeStyle = {'edgeStyle': 'orthogonalEdgeStyle', 'rounded': '0',
	'jettySize': 'auto', 'orthogonalLoop': '1'};
```
[15]

### 1.3 The two-way binding between "user drag" and "stored points" is `points[i-1] ↔ bends[i]`

The handler keeps `this.points` as the *pending* (uncommitted) list; `this.bends` are the
visible handles. Index bookkeeping is the single most error-prone part of the design and is
explicit in `redraw`:

```js
for (var i = 1; i < this.bends.length - 1; i++)
{
	if (this.bends[i] != null && this.abspoints[i] != null)
	{
		this.points[i - 1] = pts[i - 1];
	}
}
```
[3]

**Rule: `bends[0]` = source end, `bends[n-1]` = target end, `bends[i]` (1..n-2) ↔ `geo.points[i-1]`.**
The same off-by-one appears on removal (`geo.points.splice(index - 1, 1)` [3]) and on commit
(`points[this.index - 1] = point` [3]).

### 1.4 Committing: what is actually written to the model

```js
mxEdgeHandler.prototype.changePoints = function(edge, points, clone)
{
	var model = this.graph.getModel();
	model.beginUpdate();
	try
	{
		if (clone) { ... this.graph.cloneCell(edge) ... }
		var geo = model.getGeometry(edge);
		if (geo != null)
		{
			geo = geo.clone();
			geo.points = points;
			model.setGeometry(edge, geo);
		}
	}
	finally { model.endUpdate(); }
	return edge;
};
```
[3]

draw.io wraps this to give up libavoid auto-routing as soon as the user sets a point:

```js
mxEdgeHandler.prototype.changePoints = function(edge, points, clone)
{
	if (edge != null && points != null && points.length > 0 &&
		mxUtils.getValue(this.graph.getCellStyle(edge), 'libavoidRouting', null) == '1')
	{
		this.graph.setCellStyles('libavoidRouting', null, [edge]);
	}
	return edgeHandlerChangePoints.apply(this, arguments);
};
```
[15]

So: **a manual waypoint edit is a normal `mxGeometry` change inside `beginUpdate`/`endUpdate`
— i.e. it is undoable and it is persisted in the XML** (see §1.6).

### 1.5 Where the coordinates live: parent-relative, scaled, translated

Coordinates the user drags (screen space) are converted before being stored:

```js
mxEdgeHandler.prototype.convertPoint = function(point, gridEnabled)
{
	var scale = this.graph.getView().getScale();
	var tr = this.graph.getView().getTranslate();

	if (gridEnabled)
	{
		point.x = this.graph.snap(point.x);
		point.y = this.graph.snap(point.y);
	}

	point.x = this.roundLength(point.x / scale - tr.x);
	point.y = this.roundLength(point.y / scale - tr.y);

	var pstate = this.graph.getView().getState(
		this.graph.getModel().getParent(this.state.cell));

	if (pstate != null)
	{
		point.x -= pstate.origin.x;
		point.y -= pstate.origin.y;
	}

	return point;
};
```
[23] (identical logic in mxGraph `master` [3])

Adding a point by keyboard/menu goes the other way — it walks up the parent chain to undo the
containment offsets before storing, then finds the nearest segment index:

```js
mxEdgeHandler.prototype.addPointAt = function(state, x, y)
{
	var geo = this.graph.getCellGeometry(state.cell);
	var pt = new mxPoint(x, y);
	if (geo != null)
	{
		geo = geo.clone();
		...
		var index = mxUtils.findNearestSegment(state, pt.x * s + offset.x, pt.y * s + offset.y);

		if (geo.points == null) { geo.points = [pt]; }
		else { geo.points.splice(index, 0, pt); }

		this.graph.getModel().setGeometry(state.cell, geo);
		this.refresh();
		this.redraw();
	}
};
```
[3] — `findNearestSegment` is a point-to-segment squared-distance scan over
`state.absolutePoints` returning `index = i - 1` [11].

### 1.6 Serialisation

In the stored diagram XML a waypoint array is an `mxPoint` array on the edge's `mxGeometry`:

```xml
<mxCell edge="1" ...>
  <mxGeometry relative="1" as="geometry">
    <mxPoint x="200" y="120" as="points"/>
    ...
  </mxGeometry>
</mxCell>
```
The encoder handles `mxPoint` explicitly (`obj.constructor == mxPoint` in
`mxObjectCodec.encode`) and `mxCellCodec` writes geometry children with `as="points"` /
`as="sourcePoint"` / `as="targetPoint"` [45][46]. `[UNVERIFIED]` — I read the codec dispatch
(`mxObjectCodec` line 664: `obj.constructor == mxPoint &&`) but did not reproduce a full
round-trip export from the live editor to paste a verbatim `mxfile` here.

A geometry copy operation that matters for "move the shape" semantics:
`mxGeometry.prototype.translate` moves `x/y` only when `relative` is false, and always moves
`sourcePoint`, `targetPoint` and all `points` unless `TRANSLATE_CONTROL_POINTS` is false [2].

---

## 2. The interaction (how the user does it, step by step)

### 2.1 What the user sees

> "Connectors use waypoints as anchors for their route between two shapes. These are displayed
> as round blue grab handles. To add or remove waypoints and change the path of a connector,
> drag a section of the connector into a new position to make it take a different route.
> **Waypoints are added and removed automatically as you drag them into new positions.**" [31]

Handles appear **when the edge is selected** (they are created by the selection-cell handler for
that edge). `bends` are created from `state.absolutePoints` [3] — i.e. **one handle per routed
vertex**, plus *virtual* handles in the middle of each segment when the edge has no edge style
(§2.5). Inner (non-terminal) handles are created hidden and become visible when positioned by
`redrawInnerBends`:

```js
// createBends: for non-terminal handles
if (!terminal)
{
	this.points.push(new mxPoint(0,0));
	bend.node.style.visibility = 'hidden';
}
```
```js
// redrawInnerBends
this.bends[i].node.style.visibility = 'visible';
```
[3]

draw.io styles them with its own hover-icon artwork rather than mxGraph's plain squares:

```js
mxEdgeHandler.prototype.handleImage = HoverIcons.prototype.mainHandle;
mxEdgeHandler.prototype.endHandleImage = HoverIcons.prototype.endMainHandle;
mxEdgeHandler.prototype.terminalHandleImage = HoverIcons.prototype.terminalHandle;
mxEdgeHandler.prototype.fixedHandleImage = HoverIcons.prototype.fixedHandle;
mxEdgeHandler.prototype.labelHandleImage = HoverIcons.prototype.secondaryHandle;
```
[15] — where the main handle is a **blue filled circle**: 

```js
HoverIcons.prototype.mainHandle = Graph.createSvgImage(18, 18,
	'<circle cx="9" cy="9" r="5" stroke="#fff" fill="' + HoverIcons.prototype.arrowFill + '"/>');
HoverIcons.prototype.secondaryHandle = Graph.createSvgImage(16, 16,
	'<path d="m 8 3 L 13 8 L 8 13 L 3 8 z" stroke="#fff" fill="#fca000"/>');   // the label diamond
```
[15] — matching the doc's "round blue grab handles" [31]. (The label handle is the orange
diamond; it is *movable* but it moves the **label**, not the route — a different mechanism:
`mxEdgeHandler.moveLabel` [3].)

Terminal handles get a *colour code* that tells the user what dragging will do — this is the
"green = connected, blue = connectable, dark = locked" affordance:

```js
mxEdgeHandler.prototype.getHandleFillColor = function(index)
{
	...
	var color = mxConstants.HANDLE_FILLCOLOR;

	if ((terminal != null && !this.graph.isCellDisconnectable(cell, terminal, isSource)) ||
		(terminal == null && !this.graph.isTerminalPointMovable(cell, isSource)))
	{
		color = mxConstants.LOCKED_HANDLE_FILLCOLOR;
	}
	else if (terminal != null && this.graph.isCellDisconnectable(cell, terminal, isSource))
	{
		color = mxConstants.CONNECT_HANDLE_FILLCOLOR;
	}
	return color;
};
```
[3]

### 2.2 Cursors — exactly what the cursor is, per handle type

```js
CURSOR_MOVABLE_VERTEX: 'move',
CURSOR_MOVABLE_EDGE: 'move',
CURSOR_LABEL_HANDLE: 'default',
CURSOR_TERMINAL_HANDLE: 'pointer',
CURSOR_BEND_HANDLE: 'crosshair',
CURSOR_VIRTUAL_BEND_HANDLE: 'crosshair',
CURSOR_CONNECT: 'pointer',
```
[9]

Applied like this:

- the **whole selected edge's hit-stroke** gets `move` [23]:
  ```js
  this.shape.setCursor(mxConstants.CURSOR_MOVABLE_EDGE);   // 'move'
  ```
  (draw.io makes this conditional on the edge being movable [23])
- **terminal (end) handles** → `pointer`, **inner waypoint handles** → `crosshair`:
  ```js
  bend.setCursor((terminal) ? mxConstants.CURSOR_TERMINAL_HANDLE : mxConstants.CURSOR_BEND_HANDLE);
  ```
  [3][23]
- **virtual (segment-midpoint) handles** → `crosshair` [3]
- **segment handles on orthogonal/segment edges** → an **axis-aware** resize cursor, which is
  the nicest touch in the whole system:
  ```js
  bend.setCursor((horizontal) ? 'col-resize' : 'row-resize');
  ```
  [4][24] — the segment handle shows `col-resize` (↔) when the segment is horizontal, so the
  cursor tells the user which axis the drag will move.
- **elbow edges** use a different function, `getCursorForBend`, again axis-aware:
  ```js
  mxElbowEdgeHandler.prototype.getCursorForBend = function()
  {
  	return (this.state.style[mxConstants.STYLE_EDGE] == mxEdgeStyle.TopToBottom ||
  		this.state.style[mxConstants.STYLE_EDGE] == mxConstants.EDGESTYLE_TOPTOBOTTOM ||
  		((this.state.style[mxConstants.STYLE_EDGE] == mxEdgeStyle.ElbowConnector ||
  		this.state.style[mxConstants.STYLE_EDGE] == mxConstants.EDGESTYLE_ELBOW)&&
  		this.state.style[mxConstants.STYLE_ELBOW] == mxConstants.ELBOW_VERTICAL)) ?
  		'row-resize' : 'col-resize';
  };
  ```
  [5][25]
- while **reconnecting** (dragging an end), the endpoint marker cursor is `pointer`
  (`CURSOR_CONNECT`) [9].

### 2.3 Adding a waypoint — three documented routes, plus the undocumented key

**Route 1 — drag the line itself (primary, "easiest"):**

> "There are several ways you can add waypoints to connectors. The easiest way to add a waypoint
> is to drag the blue points on the connector to the path you want it to take. 1. Select the
> connect you want to reroute. 2. Drag the connector into a new position. As you drag the
> connector, new waypoints are added automatically and intelligently, depending on where you
> grabbed the connector." [30]

Mechanically this is the **virtual bend** system: for an edge with no concrete waypoint under
the mouse, draw.io creates a *virtual* (ghosted) handle at each segment midpoint, and dragging
it splices a real point into `geo.points` at the right index:

```js
// Adds point from virtual bend
if (this.index <= mxEvent.VIRTUAL_HANDLE)
{
	points.splice(mxEvent.VIRTUAL_HANDLE - this.index, 0, point);
}
```
[3]
and virtual handles are drawn faded so they read as "not yet real":

```js
mxEdgeHandler.prototype.virtualBendOpacity = 20;   // mxGraph master; draw.io overrides to 40 [3][23]
```
```js
mxUtils.setOpacity(b.node, this.virtualBendOpacity);
```
[3]

**Route 2 — right-click → *Add Waypoint*:**

> "If you prefer not to drag connectors around, you can use the menu. 1. Right-click on the
> connector in between two way points to display the context menu. 2. Select *Add Waypoint*." [30]

The menu item is registered with the resource key `addWaypoint=Add Waypoint` [21] and added only
for an edge selection that is not an entity-relation edge and not the `arrow` shape:

```js
if (mxUtils.getValue(state.style, mxConstants.STYLE_EDGE, null) != 'entityRelationEdgeStyle' &&
	mxUtils.getValue(state.style, mxConstants.STYLE_SHAPE, null) != 'arrow')
{ ... this.addMenuItems(menu, [(isWaypoint) ? 'removeWaypoint' : 'addWaypoint'], null, evt); }
```
[17]

The action itself inserts at the **popup trigger point**, snapped to the grid. Note how it gets
from a selected cell to the handler — `graph.selectionCellsHandler.getHandler(cell)` [3][14]:

```js
this.addAction('addWaypoint', function()
{
	var cell = graph.getSelectionCell();
	if (cell != null && graph.getModel().isEdge(cell))
	{
		var handler = editor.graph.selectionCellsHandler.getHandler(cell);
		if (handler instanceof mxEdgeHandler)
		{
			... // walks up parent vertices accumulating dx/dy
			var pt = graph.popupMenuHandler.getTriggerPoint();
			var x = Math.round(graph.snap(pt.x - dx));
			var y = Math.round(graph.snap(pt.y - dy));
			handler.addPointAt(handler.state, x, y);
		}
	}
});
```
[18]

**Route 3 — Shift + click on a selected edge (mxGraph's mnemonic — INERT in draw.io):**

```js
mxEdgeHandler.prototype.isAddPointEvent = function(evt)
{
	return mxEvent.isShiftDown(evt);
};
```
```js
if (this.addEnabled && handle == null && this.isAddPointEvent(me.getEvent()))
{
	this.addPoint(this.state, me.getEvent());
	me.consume();
}
```
[3] — but `addEnabled` is `false` both in mxGraph's default [3] **and at runtime in draw.io**
(live-read prototype: `"addEnabled": false`, `"removeEnabled": false`, §8.1) [28]. So
**Shift+click does not add a waypoint in draw.io, and Shift+click on a handle does not remove
one** — despite what the mxGraph API names suggest. `[VERIFIED]` The practical consequence for
the build: draw.io's add/remove is *only* drag-the-line, the context menu, and double-click.
Note that the same prototype read showed `isRemovePointEvent`'s Shift check is likewise dead in
draw.io, while double-click removal *is* live (`dblClickRemoveEnabled = true`, §8.1).

**Route 4 — Edit Style.** `Edit Style…` opens a text dialog over the style string
(`TextareaDialog` with the current style prefilled) so a user can type routing keys manually:

```js
var dlg = new TextareaDialog(this.editorUi, mxResources.get('editStyle') + ':',
	   		model.getStyle(cells[0]) || '', function(newValue)
			{
	   		if (newValue != null) { graph.setCellStyle(mxUtils.trim(newValue), cells); }
			}, ...);
...
}), null, null, Editor.ctrlKey + '+E');
```
[18] — reached from the context menu (`'editStyle'` is in the cell context menu list [17]) and
from the *Style* tab. **It edits the style string only — waypoints are geometry, not style, so
Edit Style cannot add/move/remove a waypoint.** Its relevance here is the *routing* half of the
line type (§3).

### 2.4 Removing a waypoint

- **Drag it back (automatic):** "1. Select the connector where you want to remove a way point.
  2. Drag the appropriate section of the connector back into a position such that the way point
  is removed." [30] — implemented as `straightRemoveEnabled` + `dblClickRemoveEnabled`, both
  enabled by draw.io:
  ```js
  mxEdgeHandler.prototype.dblClickRemoveEnabled = true;
  mxEdgeHandler.prototype.straightRemoveEnabled = true;
  mxEdgeHandler.prototype.virtualBendsEnabled = true;
  mxEdgeHandler.prototype.mergeRemoveEnabled = true;
  ```
  [15]
  The "straighten the segment" removal is geometric: if the dragged point lands within
  tolerance of the straight line between its neighbours, the point is dropped:
  ```js
  // Removes point if user tries to straighten a segment
  if (result == null && this.straightRemoveEnabled && (me == null || !mxEvent.isAltDown(me.getEvent())))
  {
  	var tol = this.graph.tolerance * this.graph.tolerance;
  	var abs = this.state.absolutePoints.slice();
  	abs[this.index] = pt;
  	...
  	function checkRemove(idx, tmp)
  	{
  		if (idx > 0 && idx < abs.length - 1 &&
  			mxUtils.ptSegDistSq(abs[idx - 1].x, abs[idx - 1].y,
  				abs[idx + 1].x, abs[idx + 1].y, tmp.x, tmp.y) < tol)
  		{
  			points.splice(idx - 1, 1);
  			result = points;
  		}
  	};
  	checkRemove(this.index, pt);
  }
  ```
  [3] — note the `!mxEvent.isAltDown(...)` guard: **holding Alt while dragging a waypoint
  suppresses the auto-removal** (a "keep this point even though it is collinear" escape hatch).
  There is also a second auto-removal: dragging a point onto another handle's bounds removes it
  (`if (bend != null && mxUtils.contains(bend.bounds, pt.x, pt.y)) { points.splice(...) }` [3]).
- **Also automatic in draw.io since ~2024:** *"the inner-loop flag along with the waypoints it
  describes"* is cleared by both `Menu.edgeStyleChange(… reset=true)` and `Graph.resetEdge`
  [15][16][17].
- **Right-click → *Remove Waypoint*** (`removeWaypoint=Remove Waypoint` [21]). The menu decides
  add-vs-remove by hit-testing the right-click position against the handle index, and **ignores
  virtual/ghosted waypoints**:
  ```js
  var index = handler.getHandleForEvent(graph.updateMouseEvent(new mxMouseEvent(evt)));
  // Ignores ghosted and virtual waypoints
  if (index > 0 && index < handler.bends.length - 1 &&
  	(handler.bends[index] == null || handler.bends[index].node == null ||
  	handler.bends[index].node.style.opacity == ''))
  { ... rmWaypointAction.handler = handler; rmWaypointAction.index = index; isWaypoint = true; }
  ```
  [17], executing `handler.removePoint(handler.state, index)` [18], which is guarded to
  **never remove a terminal**:
  ```js
  mxEdgeHandler.prototype.removePoint = function(state, index)
  {
  	if (index > 0 && index < this.abspoints.length - 1)
  	{
  		var geo = this.graph.getCellGeometry(this.state.cell);
  		if (geo != null && geo.points != null)
  		{
  			geo = geo.clone();
  			geo.points.splice(index - 1, 1);
  			this.graph.getModel().setGeometry(state.cell, geo);
  			this.refresh();
  			this.redraw();
  		}
  	}
  };
  ```
  [3][23]
- **Double-click an inner handle** removes it (`dblClickRemoveEnabled` [15], wired in
  `createBends` → `removePoint` [3]). draw.io explicitly patches `removePoint` so that
  double-clicking an *unconnected* **terminal** does not try to delete a point but instead fires
  `doubleClickEdgeTerminal` (used to open the shape picker):
  ```js
  // Double click on an unconnected straight-edge terminal handle fires an
  // event so the shape picker can be shown (handled in EditorUi) instead of
  // removing a point (a no-op for terminals). removePoint is only reached via
  // the double click handler here because removeEnabled is false.
  mxEdgeHandler.prototype.removePoint = function(state, index)
  {
  	var source = (index == 0);
  	if ((source || (this.abspoints != null && index == this.abspoints.length - 1)) && ... )
  	{ this.graph.fireEvent(new mxEventObject('doubleClickEdgeTerminal', ...)); }
  	else { edgeHandlerRemovePoint.apply(this, arguments); }
  };
  ```
  [15]

### 2.5 When do *virtual* handles appear? (the real gating condition)

This is the answer to "when do handles appear", and it is subtler than the docs suggest:

```js
mxEdgeHandler.prototype.isVirtualBendsEnabled = function(evt)
{
	return this.virtualBendsEnabled && (this.state.style[mxConstants.STYLE_EDGE] == null ||
			this.state.style[mxConstants.STYLE_EDGE] == mxConstants.NONE ||
			this.state.style[mxConstants.STYLE_NOEDGESTYLE] == 1)  &&
			mxUtils.getValue(this.state.style, mxConstants.STYLE_SHAPE, null) != 'arrow';
};
```
[3][23]

Reading: virtual (drag-the-line) handles are added **only for edges that have *no* edge style
function** (or `noEdgeStyle=1`), and never for the `arrow` shape. Edges with a *routed* style
(orthogonal / elbow / entity-relation / isometric) get their drag-the-line affordance from a
**different handler** instead — see §3.

`isCellBendable` gates all of it:

```js
mxGraph.prototype.isCellBendable = function(cell)
{
	var style = this.getCurrentCellStyle(cell);
	return this.isCellsBendable() && !this.isCellLocked(cell) && style[mxConstants.STYLE_BENDABLE] != 0;
};
```
[7][27] — so `bendable=0` in a style, or a locked cell, kills waypoint editing for that edge.

### 2.6 Which handler you get is decided by the edge style

```js
mxGraph.prototype.createEdgeHandler = function(state, edgeStyle)
{
	var result = null;

	if (edgeStyle == mxEdgeStyle.Loop ||
		edgeStyle == mxEdgeStyle.ElbowConnector ||
		edgeStyle == mxEdgeStyle.SideToSide ||
		edgeStyle == mxEdgeStyle.TopToBottom)
	{
		result = this.createElbowEdgeHandler(state);
	}
	else if (edgeStyle == mxEdgeStyle.SegmentConnector ||
			edgeStyle == mxEdgeStyle.OrthConnector)
	{
		result = this.createEdgeSegmentHandler(state);
	}
	else
	{
		result = new mxEdgeHandler(state);
	}
	return result;
};
```
[7] — one single drag handle in the middle of an elbow edge, one handle **per segment** for
orthogonal edges, plain per-point handles otherwise.

draw.io overrides it twice: once for libavoid previews, and once for **self-loops**, which are
forced onto the segment handler so a loop always exposes one handle per segment
(outgoing / distance / incoming) even when it is still being routed by `mxEdgeStyle.Loop`:

> "Uses the segment handler for self-loops so they always get one handle per segment
> (outgoing, middle/distance and incoming). This works even for legacy loops that are still
> routed via `mxEdgeStyle.Loop` (no stored waypoints), because the segment handler derives its
> handles from the absolute points. **Dragging a segment handle converts the loop to an
> orthogonal routing with inner waypoints** so it keeps its 3-segment shape; existing loops are
> not modified until edited." [15]

…and it registers `mxElbowEdgeHandler` for isometric edges:

```js
Graph.prototype.createEdgeHandler = function(state, edgeStyle)
{
	if (edgeStyle == mxEdgeStyle.IsometricConnector)
	{
		var handler = new mxElbowEdgeHandler(state);
		handler.snapToTerminals = false;
		return handler;
	}
	return graphCreateEdgeHandler.apply(this, arguments);
};
```
[20]

### 2.7 The "drag the middle of a long edge" behaviour, precisely

For an **orthogonal/segment** edge (`mxEdgeSegmentHandler`), draw.io/mxGraph synthesises a
**two-coincident-point middle handle even for an edge that has no stored waypoints at all** —
this is exactly the feature Harvey is asking for, and it is ~10 lines:

```js
mxEdgeSegmentHandler.prototype.getCurrentPoints = function()
{
	var pts = this.state.absolutePoints;

	if (pts != null)
	{
		// Special case for straight edges where we add a virtual middle handle for moving the edge
		var tol = Math.max(1, this.graph.view.scale);

		if (pts.length == 2 || (pts.length == 3 && ... collinear ...))
		{
			var cx = pts[0].x + (pts[pts.length - 1].x - pts[0].x) / 2;
			var cy = pts[0].y + (pts[pts.length - 1].y - pts[0].y) / 2;

			pts = [pts[0], new mxPoint(cx, cy), new mxPoint(cx, cy), pts[pts.length - 1]];
		}
	}
	return pts;
};
```
[4][24]

and when there are no waypoints yet, those two middle handles are rendered **faded** to signal
"virtual":

```js
if (straight)
{
	mxUtils.setOpacity(this.bends[1].node, this.virtualBendOpacity);
	mxUtils.setOpacity(this.bends[3].node, this.virtualBendOpacity);
}
```
[4][24]

Dragging such a handle moves **one axis only** (the other coordinate is inherited from the
neighbour), which is what keeps an orthogonal edge orthogonal:

```js
if (i == this.index)
{
	if (Math.round(last.x - pt.x) == 0) { last.x = point.x; pt.x = point.x; }
	if (Math.round(last.y - pt.y) == 0) { last.y = point.y; pt.y = point.y; }
}
```
[4][24]

For plain (unrouted) edges, the same "grab the middle" gesture is served by the *virtual bends*
of §2.3/§2.5, one per segment.

---

## 3. Per-line-type behaviour (the table the brief asked for)

draw.io's line-type menu is a list of **style keys**, not a class hierarchy — `Format.js` writes
`edgeStyle`, `curved`, `noEdgeStyle`, `elbow`, `libavoidRouting` [16]:

| draw.io "Style" entry | Style written | Router function | Free waypoints? | What a drag does |
|---|---|---|---|---|
| **Straight** | `edgeStyle` cleared (`null`), `curved`/`noEdgeStyle`/`libavoidRouting` cleared [16] | *none* — `getEdgeStyle` returns null, `updatePoints` uses `geo.points` verbatim [6] | **stored waypoints ARE rendered verbatim** (live-proven, §8.4); no *auto*-added waypoints [28] | virtual handles per segment (no edge style ⇒ `isVirtualBendsEnabled` true, live-proven §8.2) [3][28] |
| **Orthogonal** | `edgeStyle=orthogonalEdgeStyle` [16] | `mxEdgeStyle.OrthConnector` [8] | **yes — first-class, one handle per segment** | whole segments slide on one axis; new segments appear as needed (`mxEdgeSegmentHandler`) [4] |
| **Rounded** | orthogonal + `rounded=1` | the same router, drawn with arcs | same as orthogonal | same as orthogonal — rounding is a *painting* attribute (`isRounded`, `STYLE_ROUNDED` [9][12]) |
| **Curved** | `edgeStyle=orthogonalEdgeStyle;curved=1` [16] | same router; `mxPolyline.paintCurvedLine` splices quadratic curves through the **segment midpoints** of the routed polyline [12] | **yes — the waypoints are still the routing input** | the *stored* points are unchanged; only the drawn line is rounded off |
| **Vertical / Horizontal (elbow)** | `edgeStyle=elbowEdgeStyle` (+`elbow=vertical`) [16] | `mxEdgeStyle.ElbowConnector` → `SideToSide`/`TopToBottom` [1] | **one waypoint only** (`points[0]` is read; the rest are ignored) | a **single** middle handle; dragging it flips/moves the elbow; **double-click flips the edge** (`flipEdge`) [5] |
| **Entity Relation** | `edgeStyle=entityRelationEdgeStyle` [16] | `mxEdgeStyle.EntityRelation` [1] | **no free waypoints** — the function *ignores* `points` entirely (live-proven §8.3) and its inner handles are filtered out (`isHandleVisible` → `[true,false,true]`, §8.2) | handles for the two ends only; the menu *removes* Add/Remove Waypoint for this style [17][28] |
| **Isometric** | `edgeStyle=isometricEdgeStyle` (+`elbow=vertical`) [16][20] | `mxEdgeStyle.IsometricConnector` (registered in draw.io's `Shapes.js`, **not** in mxGraph core) [20] | **exactly one waypoint** (`points[0]`), interpreted as the *bend* of the isometric dogleg | `mxElbowEdgeHandler`; a single handle that moves the dogleg [20] |
| **Libavoid auto-route** | `edgeStyle=orthogonalEdgeStyle;libavoidRouting=1` [16] | `OrthConnector` + obstacle-avoiding WASM router | the router bakes waypoints in; they are **faded** and dragging one *clears the flag* and takes over the edge manually [15] | auto-managed until touched |
| **Self-loop (any style)** | forced onto `mxEdgeSegmentHandler` [15] | — | one handle per segment; dragging converts the loop to orthogonal + inner waypoints [15] | |

**Note on "Straight": documentation and code disagree, and the code wins (proven by execution in §8.4).**
The manual states: *"The Straight connector style does not allow waypoints as it always takes
the shortest path between the two shapes."* [30]. But a "straight" draw.io connector has **no
edge style at all** [16], `getEdgeStyle` therefore returns `null` [6], and `updatePoints`'s
`else if (points != null)` branch pushes the stored `geo.points` straight into
`absolutePoints` [6]. Running that exact code path in the live editor with two stored waypoints
produced `[40,20] → (200,300) → (350,150) → [640,420]` — the waypoints **are** rendered (§8.4) [28].
`isVirtualBendsEnabled` is likewise *true* exactly when there is no edge style [3][23], confirmed
live. So stored waypoints **and** the drag-the-line affordance both work on a style-less straight
edge. What the sentence almost certainly means is the *menu/automatic* behaviour: a straight edge
never *auto*-adds waypoints. `[VERIFIED]` — do not take the doc sentence literally in the build.

**Cross-cutting facts:**

- Waypoints are pushed into `result` by the style; a style that does not read `points` silently
  discards them — `EntityRelation` never touches its `points` parameter at all [1].
- `OrthConnector` has an explicit **fallback**: if the endpoints are too close, or the style is
  `orthPointsFallback` **and there are control hints**, it delegates to
  `mxEdgeStyle.SegmentConnector` so the user's points are honoured anyway:
  ```js
  if (tooShort || (mxEdgeStyle.orthPointsFallback && (controlHints != null &&
  		controlHints.length > 0)) || sourceEdge || targetEdge)
  {
  	mxEdgeStyle.SegmentConnector(state, sourceScaled, targetScaled, controlHints, result);
  	return;
  }
  ```
  [1] with `orthPointsFallback: true` [1].
- `SegmentConnector` is the "respect every hint" router — it converts each hint through
  `transformControlPoint` and pushes it, tolerating nulls and dropping duplicates [1].
- `Curved`/`bezier` only change **painting**: `mxPolyline.paintEdgeShape` chooses
  `paintLine` vs `paintCurvedLine` on `STYLE_CURVED != 1`, and the curve is drawn as quadratics
  **through the midpoints of the routed polyline segments** [12]:
  ```js
  for (var i = 1; i < n - 2; i++)
  {
  	var p0 = pts[i]; var p1 = pts[i + 1];
  	var ix = (p0.x + p1.x) / 2; var iy = (p0.y + p1.y) / 2;
  	c.quadTo(p0.x, p0.y, ix, iy);
  }
  ```
  draw.io restricts which shapes can be curved at all (`edgeSupportsCurved`: `connector`,
  `filledEdge`, `wire`, `pipe`, `link`, `flexArrow`, or the default `mxConnector`) [15].
- Waypoint editing is disabled wholesale for non-bendable cells (`bendable=0` / locked) [7][27],
  and for **unconnected** `arrow`-shaped edges the "drag the line" gesture is suppressed
  because the arrow shape has movable *endpoints*, not bends [3][23].

---

## 4. Reset

Four distinct resets exist; they differ in scope and in what they leave behind.

**4a. `Clear Waypoints` (context menu)** — "By clearing all of the waypoints in a connector, it
will revert to the shortest path between the two shapes. 1. Right-click on the connector you
want to reset to see the context menu. 2. Select *Clear Waypoints*." [30]

In draw.io it clears not only `points` but also the geometry position/offset and the
inner-loop flag:

```js
this.addAction('clearWaypoints', function()
{
	var cells = graph.getSelectionCells();
	if (cells != null)
	{
		cells = graph.getEditableCells(graph.addAllEdges(cells));
		graph.getModel().beginUpdate();
		try
		{
			for (var i = 0; i < cells.length; i++)
			{
				var cell = cells[i];
				if (graph.getModel().isEdge(cell))
				{
					var geo = graph.getCellGeometry(cell);
					if (geo != null)
					{
						geo = geo.clone();
						geo.points = null;
						geo.x = 0;
						geo.y = 0;
						geo.offset = null;
						graph.getModel().setGeometry(cell, geo);
					}
					// Reverts a converted self-loop to its default routing
					graph.setCellStyles('innerLoopWaypoints', null, [cell]);
				}
			}
		}
		finally { graph.getModel().endUpdate(); }
	}
}, null, null,  Editor.altKey + '+' + Editor.shiftKey + '+R');
```
[18] — note `graph.addAllEdges(cells)`: selecting a shape clears the waypoints of every edge
attached to it, and **the action works on multi-selections of edges** [18].

**4b. `Arrange` tab → *Reset* dropdown → *Waypoints*** — the same action, exposed as a panel
control (this is the answer the maintainer gave when someone asked for group clearing):

```js
var ops = [{label: mxResources.get('reset') + '...', action: 'reset'},
	{label: mxResources.get('waypoints'), action: 'clearWaypoints'},
	{label: mxResources.get('connectionPoints'), action: 'clearAnchors'}];
...
action = this.editorUi.actions.get(resetSelect.value);
... action.funct();
```
[16], and the maintainer's reply: *"Try Reset, Waypoints in the Arrange tab"* [42].

**4c. `Graph.resetEdge` (internal)** — resets `points` to `[]` (not `null`):

```js
mxGraph.prototype.resetEdge = function(edge)
{
	var geo = this.model.getGeometry(edge);
	// Resets the control points
	if (geo != null && geo.points != null && geo.points.length > 0)
	{
		geo = geo.clone();
		geo.points = [];
		this.model.setGeometry(edge, geo);
	}
	return edge;
};
```
[7] — called automatically from
`graph.resetEdgesOnConnect` (draw.io **does** reset waypoints when you reconnect an end — it sets
`this.resetEdgesOnConnect = false;` … see note), `resetEdgesOnResize` and `resetEdgesOnMove` [7].
`[UNVERIFIED]` I found `this.resetEdgesOnConnect = false;` inside a draw.io graph configuration
block (`Graph.js` line 939 in the `dev` copy I fetched) but did not trace its scope to confirm
whether it applies to the editor's main graph.
draw.io patches `resetEdge` to also drop the inner-loop flag [15].

**4d. Switching the line type resets waypoints too.** Every routing entry in the *Waypoints*
toolbar dropdown passes `reset=true`, which nulls `geo.points` before applying the new style:

```js
if (reset)
{
	var geo = graph.getCellGeometry(cell);
	// Resets all edge points
	if (geo != null) { geo = geo.clone(); geo.points = null; graph.getModel().setGeometry(cell, geo); }
	// Clears the inner-loop flag along with the waypoints it describes
	graph.setCellStyles('innerLoopWaypoints', null, [cell]);
}
```
[17] — this is the source of the complaint in §5 ("Keep waypoint style … #3554") and, in reverse,
is why a user who hand-routed a line and then clicks another line-type button loses the route.

**Keyboard shortcut:** `Clear Waypoints` is bound to **Alt+Shift+R** in current draw.io:

```js
mxUtils.getOption(...)   // 82: 'clearWaypoints', // Alt+Shift+R
```
[19] (also documented in the action registration `Editor.altKey + '+' + Editor.shiftKey + '+R'` [18]).
History of this shortcut is messy — `Alt+Shift+W` collided with *Paste Style* [#3501] and
`Alt+Shift+C` was broken on Windows for several releases [#2420] [39][38].

---

## 5. Snapping

**5.1 Grid.** `mxGraph` defaults: `gridSize = 10`, `gridEnabled = true` [7]. The snap function
is a plain round-to-multiple:

```js
mxGraph.prototype.snap = function(value)
{
	if (this.gridEnabled)
	{
		value = Math.round(value / this.gridSize ) * this.gridSize;
	}
	return value;
};
```
[7]

The user-visible "grid setting" is a numeric **Grid Size** field in the *Diagram* tab
(`mxResources.get('gridSize')`, an `<input type="number" min="0" step="any">` clamped to ≥1),
applied to the graph as `graph.setGridSize(gridSize)` and persisted as a `gridSize` attribute on
the diagram node [19]:

```js
this.graph.gridSize = parseFloat(node.getAttribute('gridSize')) || mxGraph.prototype.gridSize;
...
graphSizeInput.value = Math.max(1, (isNaN(value)) ? graph.getGridSize() : value);
...
if (!isNaN(gridSize) && graph.gridSize !== gridSize) { graph.setGridSize(gridSize); }
```
[19]

**5.2 Alt disables snapping while dragging.** The gate for *every* drag is:

```js
mxGraph.prototype.isGridEnabledEvent = function(evt)
{
	return evt != null && !mxEvent.isAltDown(evt);
};
```
[7] — so holding **Alt** while dragging a waypoint gives pixel/`roundLength` precision instead
of grid steps. For a waypoint drag this is combined in `getPointForEvent`:

```js
var point = new mxPoint(this.roundLength(me.getGraphX() / scale) * scale,
	this.roundLength(me.getGraphY() / scale) * scale);
...
if (this.graph.isGridEnabledEvent(me.getEvent()))
{
	var tr = view.translate;
	if (!overrideX) { point.x = (this.graph.snap(point.x / scale - tr.x) + tr.x) * scale; }
	if (!overrideY) { point.y = (this.graph.snap(point.y / scale - tr.y) + tr.y) * scale; }
}
```
[3]

**5.3 Snap to other points (alignment guides), and its Alt override.** mxGraph's `snapToTerminals`
makes a dragged waypoint jump onto the terminal centres and onto the edge's existing absolute
points. **draw.io enables it globally** — `Graph.js` has the comment *"Enables snapping to
off-grid terminals for edge waypoints"* followed by `mxEdgeHandler.prototype.snapToTerminals = true;`
[15], confirmed at runtime (`snapToTerminals: true`, §8.1) [28]. When on, **Alt turns it off**:

```js
/**
 * Returns true if <snapToTerminals> is true and if alt is not pressed.
 */
mxEdgeHandler.prototype.isSnapToTerminalsEvent = function(me)
{
	return this.snapToTerminals && !mxEvent.isAltDown(me.getEvent());
};
```
[3], with the snapping itself:

```js
snapToTerminal.call(this, this.state.getVisibleTerminalState(true));
snapToTerminal.call(this, this.state.getVisibleTerminalState(false));

if (this.state.absolutePoints != null)
{
	for (var i = 0; i < this.state.absolutePoints.length; i++)
	{
		snapToPoint.call(this, this.state.absolutePoints[i]);
	}
}
```
[3] — so a dragged point can inherit its neighbour's x *or* y exactly, which is how users get
perfectly aligned runs. The tolerance is small — `getSnapToTerminalTolerance()` returns **2**
pixels [23]. draw.io also disables it explicitly for isometric edges (`handler.snapToTerminals = false`
in its `createEdgeHandler` override) [20].

**5.4 Snapping *of the automatic route* to the grid is a separate, request-only feature.**
Issue #4826 asked for "a property to snap automatic routing of orthogonal connectors/lines to
grid" [44] — i.e. user waypoints snap to the grid (verified §8.5), but the *router's* generated
bends are computed from geometry (jetty size, `orthBuffer`) and can land off-grid.

---

## 6. Known limitations / complaints (real, with sources)

1. **One waypoint is not movable and clearing doesn't help** — #1137 *"One of the waypoints on a
   connector is not moveable. All other waypoints are moveable, as are the end-points, but one is
   not."* … *"Try and fix this by right clicking on the connector and clearing waypoints. Notice
   that the top waypoint now at location (170,32) is still not moveable."* [36] — a real class of
   bug: after `clearWaypoints`, the *router* may re-generate a bend that coincides with a handle
   the user perceives as stuck.

2. **Waypoints fight the "floating connector" model.** #3854 (declined/wontfix): *"I frequently
   use floating connectors … If I adjust the waypoints of floating connectors but then have to
   move one of the two connected shapes, the connectors don't float for the waypoints I adjusted.
   I have to click 'Clear Waypoints' so the connector floats as expected again."* [41] — the
   request was to auto-clear; draw.io **declined** it.

3. **"Freeze the waypoints" has never existed.** #1147: *"It can be annoying when the tool adds
   Waypoints, that you don't want, to a line. For example, sometimes you just want a straight
   line. … Add a checkbox on the Line's 'Arrange' tab to Freeze the existing set of Waypoints
   (i.e., don't add or remove any Waypoints)."* [37] — closed without the feature.

4. **Editing a waypoint silently switches the line type to orthogonal.** #3554: *"when I connect
   2 shapes, the connector line (waypoints) always change back to the orthogonal style instead of
   keeping the last waypoints style I use"* [40] — the maintainer's answer is a pointer to a
   discussion, not a fix. Root cause is visible in the code: dragging a segment on a *style-less*
   straight edge commits `setCellStyles('edgeStyle','orthogonalEdgeStyle')` (draw.io's self-loop
   conversion does exactly this: *"Dragging a segment handle converts the loop to an orthogonal
   routing with inner waypoints"* [15]; see also `Graph.js` writing
   `this.setCellStyles(mxConstants.STYLE_EDGE, 'orthogonalEdgeStyle', [edge])` [15]).

5. **The line "remembers" its jog count after you hand-edit it.** #5761 (still **open**):
   *"Grab the midpoint of either line segment and move it. The line now has a segment along the
   adjacent box's edge. Grab the same midpoint and put the line back … Move either box sideways
   …"* — i.e. the user's own waypoints make the automatic route sticky in a way that surprises
   people. The maintainers' own patch to the self-loop handler ("a segment drag … cannot collapse
   it into a zero-size spike") is a related robustness fix [15][43].

6. **`Clear Waypoints` was not available for multi-selection** — #4791: *"When selecting multiple
   lines with waypoints then this menu entry is not available so I have to resort to selecting
   each line individually to clear the waypoints."* [42] (the **Reset → Waypoints** panel control
   does work for groups; the context-menu parity request was declined).

7. **Shortcut chaos around clearing waypoints** — #3501 (duplicate `Alt+Shift+W`, also *Paste
   Style*) [39] and #2420 (`Alt+Shift+C` broken on Windows desktop 14.6→15.7.3) [38].

8. **Waypoints do not snap the *router* to the grid** — #4826 [44].

9. **Flipping a connector silently changes/deletes waypoints** — documented, not a bug per se:
   *"If you flip a connector horizontally or vertically while it is attached to a shape, its
   waypoints will be changed or deleted automatically."* [30]

10. **Only one waypoint is meaningful for elbow and isometric styles**, and **zero** for
    entity-relation — a user coming from orthogonal expects uniform behaviour. `[UNVERIFIED as a
    complaint]` — this is my reading of the source [1][20][17], not a user report.

11. **Straight is documented as waypoint-free** [30], which contradicts what the code does with
    stored points (see §3), so users cannot predict it from the docs. `[UNVERIFIED as a
    complaint]`.

---

## 7. What is directly portable to a React Flow app

`<- the actionable part; written for Diagram Studio, React 19 + @xyflow/react v12>`

1. **Store waypoints as an absolute-point array on the edge, separate from the endpoints.**
   draw.io's `geo.points` is exactly the model the brief wants: `source`/`target` stay bound to
   nodes; `points: {x,y}[]` is the free middle. In React Flow that is `edge.data.points` (or a
   proper `Edge` field via the v12 generic). Do **not** reuse `sourceHandle`/`targetHandle` for
   this, and keep it distinct from the existing `data.offset` end-offset field.

2. **Two handle layers, two visual states — this is the single most important lesson.**
   mxGraph distinguishes a **real** waypoint (solid handle, full opacity) from a **virtual**
   segment-midpoint handle (same shape, `opacity ≈ 0.2–0.4`, `crosshair`). The virtual handle
   materialises into a real point only when dragged. Copy that: render a ghost midpoint handle
   per segment for `step`/`smoothstep`, and a ghost handle on a 2-point `straight`/`bezier` edge
   too (mxGraph does exactly this for straight: `getCurrentPoints` synthesises
   `[p0, mid, mid, p1]` [4][24]).

3. **Grab semantics: drag the line, not just a dot.** The user's words match mxGraph's virtual
   bend system: hovering the *line* should expose the midpoint affordance and dragging it should
   *create* the waypoint at that index (`points.splice(index, 0, pt)` with
   `index = nearestSegment(...)` [3][11]). Index derivation is `findNearestSegment` — squared
   point-to-segment distance over `absolutePoints`, cheap and easy to port.

4. **Axis-constrained dragging per line type.**
   - `step` / `smoothstep`: move **one axis** per drag (inherit the other coordinate from the
     neighbouring point) — mxGraph's `getPreviewPoints` [4]: this is what keeps the stairs square.
   - `straight` / bezier: free 2-D drag.
   - cursor must be `col-resize` for a horizontal segment and `row-resize` for a vertical one [4],
     `crosshair` on a free point [9]. That single detail buys most of the "feels like draw.io".
   - `smoothstep` maps onto React Flow's `centerX`/`centerY` `GetSmoothStepPathParams` for the
     single-midpoint case — one editable waypoint, exactly like draw.io's elbow style. For ≥2
     waypoints you need a custom `getSmoothStepPath`-style generator over `points`.

5. **Auto-add / auto-remove is a geometric tolerance, not a mode.** Port
   `straightRemoveEnabled`'s check — remove a waypoint when the dragged point falls within
   `tolerance²` of the segment between its neighbours (`ptSegDistSq` [3]), and suppress that
   removal while **Alt** is held [3]. Also remove a point when it is dropped onto another
   handle [3]. This gives the "waypoints are added and removed automatically as you drag" feel
   the manual advertises [30] without a delete button.

6. **Grid snap on the grid size, Alt to escape it.** `snap(v) = round(v/grid)*grid`, default
   grid 10 [7]; the drag ignores the grid when Alt is down [7]. Expose the grid size as a
   setting (draw.io persists it on the diagram node [19]).

7. **Reset is a first-class action with at least two entry points** — a context-menu
   *Clear Waypoints* on the edge, and a *Reset → Waypoints* entry in the properties panel that
   works on a **multi-selection** (draw.io's panel control does, its context menu famously did
   not [42]). React Flow: clear `edge.data.points` for all selected edges in one undo step.

8. **One undo step per drag.** mxGraph wraps every waypoint change in
   `model.beginUpdate()` / `endUpdate()` [3], which is what makes it a single model change for
   the undo manager. In React Flow, commit `points` once on pointer-up, not on every
   pointer-move — otherwise Ctrl+Z degenerates into per-frame un-dos.

9. **Do not auto-destroy user intent.** The strongest repeated complaint across the issues
   (#3854, #1147, #3554, #5761 [41][37][40][43]) is that draw.io silently *changes or discards*
   the user's route — clearing on style change, flipping on move, switching the line type to
   orthogonal when a segment is dragged. Diagram Studio should treat `data.points` as
   user-owned: keep them across line-type changes, keep them when a node moves (the edge just
   re-anchors), and surface a *Reset* action rather than an implicit reset.

10. **Guard the endpoint handles from the waypoint code.** draw.io must explicitly special-case
    index `0` and `n-1` everywhere (`removePoint` is a no-op for terminals [3]) because terminals
    and waypoints share one handle array. If Diagram Studio keeps its reconnect-on-endpoint
    feature, keep the two hit-targets and their cursors distinct (`pointer` for reconnect vs
    `crosshair` for reshape [9]).

---

## 8. Live verification (app.diagrams.net, mxClient 31.4.6)

Run in the real editor (`https://app.diagrams.net/?splash=0&ui=min&libraries=0`) by instantiating
draw.io's own bundled `Graph` class in an off-screen container and driving mxGraph's real API.
Everything below is **observed output**, not inference. [28]

### 8.1 Runtime constants (read from the live `mxConstants` / prototypes)

```json
{
  "cursors": {"BEND": "crosshair", "VIRTUAL": "crosshair", "TERMINAL": "pointer", "MOVABLE_EDGE": "move"},
  "virtualBendOpacity": 40,          // draw.io override; mxGraph master is 20
  "virtualBendsEnabled": true,
  "snapToTerminals": true,           // draw.io turns this ON globally
  "addEnabled": false,
  "removeEnabled": false,
  "dblClickRemoveEnabled": true, "straightRemoveEnabled": true, "mergeRemoveEnabled": true,
  "gridSize": 10, "gridEnabled": true,
  "ENTITY_SEGMENT": 30,
  "HANDLE_SIZE": 6,
  "HANDLE_FILLCOLOR": "#29b6f2", "CONNECT_HANDLE_FILLCOLOR": "#cee7ff", "LOCKED_HANDLE_FILLCOLOR": "#FF0000",
  "mxEvent.VIRTUAL_HANDLE": -100000, "mxEvent.LABEL_HANDLE": -1
}
```
[28] — note **`addEnabled = false` and `removeEnabled = false`**: my §2.3 uncertainty is now
resolved. **Shift+click does NOT add a point in draw.io** (the action is gated on `addEnabled`),
and Shift+click on a handle does **not** remove one. Waypoint add/remove in draw.io is *only*
drag / context menu / double-click. `[VERIFIED]`

`snapToTerminals: true` is set by draw.io's `Graph.js` ("Enables snapping to off-grid terminals
for edge waypoints") [15] and confirmed at runtime [28] — so the §5.3 alignment snapping **is
active** in draw.io, with Alt as the escape hatch (`isSnapToTerminalsEvent` → `!isAltDown` [3]),
tolerance `getSnapToTerminalTolerance() == 2` px (dev handler) [23].

### 8.2 Router + handler dispatch per line type (live)

Built 8 edges between the same two vertices, each with the same stored waypoint `(300,300)`,
then asked the live view which router and which handler it resolves:

| Stored style | `mxStyleRegistry.getName(router)` | handler class | `isVirtualBendsEnabled()` |
|---|---|---|---|
| `edgeStyle=none;` | **NONE (no edge style)** | `mxEdgeHandler` | **true** |
| `` (empty) | **NONE** | `mxEdgeHandler` | **true** |
| `edgeStyle=orthogonalEdgeStyle;` | `orthogonalEdgeStyle` | `mxEdgeSegmentHandler` | false |
| `edgeStyle=orthogonalEdgeStyle;curved=1;` | `orthogonalEdgeStyle` (**router unchanged**) | `mxEdgeSegmentHandler` | false |
| `edgeStyle=elbowEdgeStyle;` | `elbowEdgeStyle` | `mxElbowEdgeHandler` | false |
| `edgeStyle=entityRelationEdgeStyle;` | `entityRelationEdgeStyle` | `mxEdgeHandler` | false |
| `edgeStyle=isometricEdgeStyle;` | `isometricEdgeStyle` | **`mxElbowEdgeHandler`** | false |
| `edgeStyle=segmentEdgeStyle;` | `segmentEdgeStyle` | `mxEdgeSegmentHandler` | false |
| `edgeStyle=loopEdgeStyle;` | `loopEdgeStyle` | **`mxElbowEdgeHandler`** | false |

[28] — this confirms §2.6 and §3 empirically, and adds two facts the source reading alone did not
give cleanly:
- **`curved=1` really is painting-only**: the resolved router is still `orthogonalEdgeStyle`. [28]
- **`isometricEdgeStyle` → `mxElbowEdgeHandler`**, i.e. one drag handle, exactly as draw.io's
  `createEdgeHandler` override arranges [20]. [VERIFIED]

`isVirtualBendsEnabled()` is **true for style-less edges and false for every routed style**,
including `arrow`-shaped edges (false). That is the whole of the §2.5 gating rule, confirmed. [28]

`isHandleVisible(index)` for a 3-point edge, with the handler's `edgeStyle` property set:
`EntityRelation` → `[true, false, true]`; `OrthConnector` → `[true, true, true]`;
no-edge-style → `[true, true, true]` [28] — so **entity-relation edges genuinely expose only the
two terminal handles**; their inner waypoint handles are filtered out of `createBends`. [VERIFIED]

### 8.3 What each router does with a stored waypoint (live, direct calls)

Called the real router functions with the same inputs — source `(0,0,80×40)`, target
`(400,400)`, and a single control hint `(400,50)` (deliberately off the direct line):

| Router | `result` produced |
|---|---|
| `mxEdgeStyle.EntityRelation` | `[[70,20], [370,400]]` — **the hint `(400,50)` is ignored entirely** |
| `mxEdgeStyle.ElbowConnector` | `[[400,20], [400,50]]` — the hint is used |
| `mxEdgeStyle.SideToSide` | `[[400,20], [400,50]]` |
| `mxEdgeStyle.TopToBottom` | `[[40,50], [400,50]]` |
| `mxEdgeStyle.SegmentConnector` | `[[40,50], [400,50]]` |
| `mxEdgeStyle.OrthConnector` | `[[40,50], [400,50]]` |
| `mxEdgeStyle.IsometricConnector` | `[[194,-69], [400,50], [703,225]]` — the hint **is** the dogleg apex |
| `mxEdgeStyle.orthPointsFallback` | `true` |

[28] — **EntityRelation ignoring waypoints is confirmed by execution, not just by reading.** [VERIFIED]

### 8.4 The "Straight edge does not allow waypoints" claim — settled

The manual says Straight "does not allow waypoints" [30]. The code path, executed live:

```
tryStyle('edgeStyle=none;')            -> router NONE, absolutePoints [ [40,20], [200,300], [350,150], [640,420] ]
tryStyle(null)  (no style at all)      -> router NONE, absolutePoints [ [40,20], [200,300], [350,150], [640,420] ]
tryStyle('edgeStyle=orthogonalEdgeStyle;') -> router orthogonal, absolutePoints [ [40,20],[40,300],[200,300],[200,150],[640,150],[640,420] ]
tryStyle('edgeStyle=entityRelationEdgeStyle;') -> absolutePoints [ [40,20],[70,20],[610,420],[640,420] ]
tryStyle('edgeStyle=elbowEdgeStyle;')  -> absolutePoints [ [40,20],[200,20],[200,420],[640,420] ]
```
[28], where the stored waypoints were `(200,300)` and `(350,150)`.

Reading this:
- **A style-less ("Straight") edge renders the stored waypoints verbatim** — `[40,20] → (200,300)
  → (350,150) → [640,420]`. So the manual's sentence is **wrong as a statement about the data
  model**; what it means is that the *menu/auto* behaviour never adds waypoints to a straight
  edge. `[VERIFIED — code path executed]`
- **Orthogonal uses the waypoints too**, but inserts its own elbows to keep every segment
  axis-aligned — `[40,20] → [40,300] → (200,300) → (200,150) → [640,150] → [640,420]`. Note it
  honours the *user's* points as the corners and adds the axis-alignment bends around them. `[VERIFIED]`
- **EntityRelation discards them**: the output contains no trace of `(200,300)`/`(350,150)`
  (only the 30 px entity stub, matching `ENTITY_SEGMENT = 30` measured live [28]). `[VERIFIED]`
- **Elbow uses only the first hint** and derives the whole L from it. `[VERIFIED]`

### 8.5 Grid snap (live)

```json
{"gridSize": 10, "snap": {"137": 140, "133": 130, "135": 140, "-7": -10}}
{"gridSize": 5,  "snap": {"137": 135, "133": 135}}
```
[28] — `Math.round(v/g)*g`, exactly as in the source [7]. Set the diagram grid size and the
waypoint snap follows it. `[VERIFIED]`

### 8.6 Not verified live

- I did **not** reproduce a full user pointer-drag of a waypoint (no synthetic pointer sequence
  was driven through the canvas); the drag behaviour is established from source
  (`getPreviewPoints`, `getCurrentPoint`, `mouseDown` [3][4]) plus the docs [30], not from a
  recorded gesture. `[UNVERIFIED as a gesture]`
- I did **not** capture a verbatim exported `mxfile` containing `<mxPoint as="points"/>`; the
  serialisation claim rests on the codec source [45][46]. `[UNVERIFIED]`
- I could **not** reach the live `EditorUi` object from the page's global scope (draw.io keeps it
  in a closure; `App.main`, `Ge`, `ui`, `EditorUi` are not reachable as globals in this build), so
  no runtime measurement was taken on the *actual* open document — all live probes ran on
  `new Graph(...)` instances of draw.io's own bundled classes. [28] `[UNVERIFIED for the
  editor-owned graph instance]`

---

## 9. Sources (every URL, with what it evidenced)

1. https://raw.githubusercontent.com/jgraph/mxgraph/master/javascript/src/js/view/mxEdgeStyle.js — the style contract `function(state, source, target, points, result)`, `EntityRelation` ignoring `points`, `Loop`/`SideToSide`/`TopToBottom` reading only `points[0]`, `ElbowConnector`, `SegmentConnector`, `OrthConnector` + `orthPointsFallback`, `wayPoints1`.
2. https://raw.githubusercontent.com/jgraph/mxgraph/master/javascript/src/js/model/mxGeometry.js — `points`, `sourcePoint`, `targetPoint`, `offset`, `relative`, class doc "Control points … may be ignored or interpreted differently depending on the edge's mxEdgeStyle", `translate`.
3. https://raw.githubusercontent.com/jgraph/mxgraph/master/javascript/src/js/handler/mxEdgeHandler.js — `init`, `createBends`, `createVirtualBends`, `isVirtualBendsEnabled`, `isAddPointEvent`/`isRemovePointEvent` (Shift), `addEnabled`/`removeEnabled`, `getHandleFillColor`, `createBends` off-by-one, `changePoints`, `addPointAt`, `removePoint`, `redraw` index mapping, `redrawHandles`, `redrawInnerBends`, `getPointForEvent`, `snapToTerminals`/`isSnapToTerminalsEvent`, `straightRemoveEnabled` removal, `virtualBendOpacity`.
4. https://raw.githubusercontent.com/jgraph/mxgraph/master/javascript/src/js/handler/mxEdgeSegmentHandler.js — `getCurrentPoints` synthetic `[p0, mid, mid, p1]` middle handle, one-axis preview drag, `createBends` per-segment handles with `col-resize`/`row-resize`, faded virtual middle handles, `connect` segment merging.
5. https://raw.githubusercontent.com/jgraph/mxgraph/master/javascript/src/js/handler/mxElbowEdgeHandler.js — single virtual bend for elbow styles, `flipEnabled` double-click → `flipEdge`, `getCursorForBend` axis-aware cursor.
6. https://raw.githubusercontent.com/jgraph/mxgraph/master/javascript/src/js/view/mxGraphView.js — `updateCellState` call order, `updatePoints` (edge-style vs raw `points`), `getEdgeStyle` incl. `noEdgeStyle`, `updateFixedTerminalPoints`, `updateFloatingTerminalPoints`, `transformControlPoint`.
7. https://raw.githubusercontent.com/jgraph/mxgraph/master/javascript/src/js/view/mxGraph.js — `gridSize=10`, `gridEnabled`, `snap`, `isGridEnabledEvent` (Alt), `isCellBendable`, `resetEdge`, `resetEdgesOnResize`/`OnMove`/`OnConnect`, `createEdgeHandler` dispatch, `createEdgeSegmentHandler`/`createElbowEdgeHandler`.
8. https://raw.githubusercontent.com/jgraph/mxgraph/master/javascript/src/js/view/mxStyleRegistry.js — string→function registration of `elbowEdgeStyle`, `entityRelationEdgeStyle`, `loopEdgeStyle`, `sideToSideEdgeStyle`, `topToBottomEdgeStyle`, `orthogonalEdgeStyle`, `segmentEdgeStyle`.
9. https://raw.githubusercontent.com/jgraph/mxgraph/master/javascript/src/js/util/mxConstants.js — `CURSOR_*` values, `EDGESTYLE_*` strings, `STYLE_CURVED/ROUNDED/ELBOW/SEGMENT/JETTY_SIZE/BENDABLE/EDGE/NOEDGESTYLE`, `STYLE_ROUTING_CENTER_X` etc.
10. https://raw.githubusercontent.com/jgraph/mxgraph/master/javascript/src/js/util/mxPoint.js — `mxPoint(x,y) {this.x=…; this.y=…}`, `equals`, `clone`.
11. https://raw.githubusercontent.com/jgraph/mxgraph/master/javascript/src/js/util/mxUtils.js — `findNearestSegment` (point-to-segment distance, returns `i-1`).
12. https://raw.githubusercontent.com/jgraph/mxgraph/master/javascript/src/js/shape/mxPolyline.js — `paintEdgeShape` choosing `paintLine`/`paintCurvedLine` on `STYLE_CURVED`, quadratic-through-midpoints curve.
13. https://www.drawio.com/blog/edit-connection-points/ — the **shape connection point** editor (distinct concept), right-click → *Edit Connection Points*.
14. https://raw.githubusercontent.com/jgraph/mxgraph/master/javascript/src/js/handler/mxSelectionCellsHandler.js — `getHandler(cell)` returns the per-cell selection handler that `Actions.addWaypoint`/`removeWaypoint` reach through (`graph.selectionCellsHandler.getHandler(cell)`).
15. https://raw.githubusercontent.com/jgraph/drawio/dev/src/main/webapp/js/grapheditor/Graph.js — `defaultEdgeStyle`, `HoverIcons` handle artwork, `mxEdgeHandler.prototype.{handleImage,terminalHandleImage,…}`, `dblClickRemoveEnabled/straightRemoveEnabled/virtualBendsEnabled/mergeRemoveEnabled = true`, `removePoint` terminal special case, `changePoints` libavoid override, self-loop segment-handler override, `resetEdge` innerLoopWaypoints, `setInnerBendsOpacity`, `edgeSupportsCurved`, `getCurvePoints`, libavoid routing preview, `mxEdgeHandler.prototype.snapToTerminals = true`, `this.resetEdgesOnConnect = false`.
16. https://raw.githubusercontent.com/jgraph/drawio/dev/src/main/webapp/js/grapheditor/Format.js — the *Waypoints* line-type dropdown: exact style keys per entry (`edgeStyle=null` for Straight, `orthogonalEdgeStyle`, `curved=1`, `elbowEdgeStyle`, `isometricEdgeStyle`, `entityRelationEdgeStyle`, `libavoidRouting=1`), Reset dropdown with `waypoints` → `clearWaypoints`.
17. https://raw.githubusercontent.com/jgraph/drawio/dev/src/main/webapp/js/grapheditor/Menus.js — `addPopupMenuCellItems` add/remove-waypoint decision, entityRelation + arrow exclusions, ghosted/virtual waypoint filtering via `getHandleForEvent`, `clearWaypoints` menu item, `editStyle` menu item, `edgeStyleChange` `reset` semantics.
18. https://raw.githubusercontent.com/jgraph/drawio/dev/src/main/webapp/js/grapheditor/Actions.js — `addWaypoint` (popup trigger point + `graph.snap`), `removeWaypoint`, `clearWaypoints` (points/x/y/offset null, `addAllEdges`, Alt+Shift+R), `clearAnchors`, `editStyle` TextareaDialog + Ctrl+E.
19. https://raw.githubusercontent.com/jgraph/drawio/dev/src/main/webapp/js/grapheditor/EditorUi.js — Grid Size input and `graph.setGridSize`, `gridSize` attribute persistence, `clearWaypoints` enablement, shortcut map comment `82: 'clearWaypoints', // Alt+Shift+R`, `getImageForEdgeStyle`.
20. https://raw.githubusercontent.com/jgraph/drawio/dev/src/main/webapp/js/grapheditor/Shapes.js — `mxEdgeStyle.IsometricConnector` (reads `points[0]` as the dogleg), `mxStyleRegistry.putValue('isometricEdgeStyle', …)`, `Graph.createEdgeHandler` → `mxElbowEdgeHandler` with `snapToTerminals=false`.
21. https://raw.githubusercontent.com/jgraph/drawio/dev/src/main/webapp/resources/dia.txt — resource strings `addWaypoint=Add Waypoint`, `removeWaypoint=Remove Waypoint`, `clearWaypoints=Clear Waypoints`, `waypoints=Waypoints`.
22. https://raw.githubusercontent.com/jgraph/drawio/dev/src/main/webapp/mxgraph/src/view/mxEdgeStyle.js — vendored copy that draw.io actually ships (differs from `jgraph/mxgraph` master mainly in null-guards on geometry).
23. https://raw.githubusercontent.com/jgraph/drawio/dev/src/main/webapp/mxgraph/src/handler/mxEdgeHandler.js — the authoritative handler for the shipped editor: `virtualBendOpacity = 40`, cursor set only when the cell is movable, `CURSOR_BEND_HANDLE` for inner bends, `convertPoint` with `roundLength`.
24. https://raw.githubusercontent.com/jgraph/drawio/dev/src/main/webapp/mxgraph/src/handler/mxEdgeSegmentHandler.js — shipped segment handler: synthetic middle points, `col-resize`/`row-resize` cursors.
25. https://raw.githubusercontent.com/jgraph/drawio/dev/src/main/webapp/mxgraph/src/handler/mxElbowEdgeHandler.js — shipped elbow handler (single bend, flip on double-click).
26. https://raw.githubusercontent.com/jgraph/drawio/dev/src/main/webapp/mxgraph/src/view/mxGraphView.js — shipped `getEdgeStyle`, `isLoopStyleEnabled`.
27. https://raw.githubusercontent.com/jgraph/drawio/dev/src/main/webapp/mxgraph/src/view/mxGraph.js — shipped `isCellBendable`.
28. https://app.diagrams.net/ — live editor used for runtime verification (§8).
29. https://raw.githubusercontent.com/jgraph/mxgraph/master/javascript/src/js/shape/mxConnector.js — `useSvgBoundingBox` on `STYLE_CURVED`.
30. https://www.drawio.com/docs/manual/connectors/waypoints-connectors/ — add-by-drag, Add Waypoint, Remove Waypoint, Clear Waypoints, the "Straight connector style does not allow waypoints" sentence, flip warning.
31. https://www.drawio.com/docs/manual/connectors/ — "waypoints as anchors … displayed as round blue grab handles … added and removed automatically as you drag", floating vs fixed.
32. https://www.drawio.com/docs/manual/connectors/connector-fixed-vs-floating/ — floating/fixed semantics, Alt to force a fixed connection.
33. https://www.drawio.com/docs/manual/shapes/shape-connection-points-customise/ — the *shape* `points=` style array (disambiguation), Edit Connection Points.
34. https://www.drawio.com/docs/manual/editor/panels/connection-points-hide/ — hiding shape connection points (View > Connection Points, Alt+Shift+O).
35. https://drawio-app.com/blog/the-draw-io-glossary/ — glossary: floating/fixed connectors, "Add waypoints to customize the route between shapes by right-clicking on a connector and selecting, Add Waypoint".
36. https://github.com/jgraph/drawio/issues/1137 — "Cannot move waypoint on connector" (stuck waypoint, survives Clear Waypoints).
37. https://github.com/jgraph/drawio/issues/1147 — "Add a checkbox to Freeze the set of Waypoints on a Line".
38. https://github.com/jgraph/drawio/issues/2420 — Clear Waypoints shortcut `alt+shift+c` broken on Windows desktop.
39. https://github.com/jgraph/drawio/issues/3501 — `Alt+Shift+W` duplicated between Clear Waypoints and Paste Style.
40. https://github.com/jgraph/drawio/issues/3554 — "Keep waypoint style instead of changing back to orthogonal everytime".
41. https://github.com/jgraph/drawio/issues/3854 — floating-connector waypoints not auto-cleared on shape move (declined).
42. https://github.com/jgraph/drawio/issues/4791 — Clear Waypoints unavailable for multi-selection; maintainer points at Arrange → Reset → Waypoints.
43. https://github.com/jgraph/drawio/issues/5761 — open: line "remembers number of jogs" after midpoint drag.
44. https://github.com/jgraph/drawio/issues/4826 — request: snap *automatic* orthogonal routing to grid.
45. https://raw.githubusercontent.com/jgraph/mxgraph/master/javascript/src/js/io/mxObjectCodec.js — `obj.constructor == mxPoint` handling in `encode`.
46. https://raw.githubusercontent.com/jgraph/mxgraph/master/javascript/src/js/io/mxCellCodec.js — geometry child elements (`points`/`sourcePoint`/`targetPoint`) in the cell XML.
47. https://stackoverflow.com/questions/76738872/how-to-add-a-waypoint-in-draw-io — "How to add a waypoint in draw.io". **Fetch FAILED** (anti-bot / retry limit); listed for honesty, **not relied on** as evidence anywhere in this report.

## 10. Gaps / [UNVERIFIED]

Everything below is what I could **not** confirm, with the reason and how it was bounded.

1. **Serialisation is unverified by artifact.** I read `mxObjectCodec.encode`'s `mxPoint`
   branch [45] and `mxCellCodec`'s geometry-child handling [46], and I am confident the stored
   form is `<mxPoint … as="points"/>` inside `<mxGeometry>`, but I did **not** export a real
   `mxfile` and paste a verbatim snippet. `[UNVERIFIED]` — treat the XML shape as
   "source-derived, not artifact-captured".

2. **No recorded pointer-drag of a waypoint.** The whole §2.7 drag behaviour (one-axis
   constraint, virtual-handle materialisation, Alt-suppresses-removal, drop-onto-handle-deletes)
   is derived from source (`getPreviewPoints` [3][4], `mouseDown` [3], `redrawInnerBends` [3]) and
   the manual + GIFs [30], **not** from a synthetic pointer sequence I drove. `[UNVERIFIED as a
   gesture]` — the code path is unambiguous, but I did not watch it fire.

3. **The live probes ran on fresh `new Graph(...)` instances, not the editor's own document.**
   draw.io keeps `EditorUi` inside a closure in this build — `window.App.main` exists as a
   function but `Ge`, `ui`, `EditorUi`, `editorUi` are all `undefined` as globals [28]. So §8's
   measurements come from draw.io's own bundled classes (`mxClient` 31.4.6, its `Graph`,
   `mxEdgeHandler`, `mxEdgeStyle`) instantiated off-screen, not from the graph instance owning the
   open canvas. For a library-behaviour question this is equivalent, but it is not the same
   object. `[UNVERIFIED for the editor-owned graph instance]`

4. **`resetEdgesOnConnect` scope.** I found `this.resetEdgesOnConnect = false;` inside draw.io's
   `Graph.js` configuration block [15] and mxGraph's default is `true` [7], but I did **not**
   trace which graph that statement lands on (editor vs. embedded/preview graph). Practical
   effect: whether reconnecting an edge end silently drops its waypoints in the editor.
   `[UNVERIFIED]`

5. **The exact set of `clearAnchors`-vs-`clearWaypoints` shortcuts in the current build.**
   `Actions.js` registers `clearWaypoints` with `Alt+Shift+R` [18] and `EditorUi.js`'s shortcut-map
   comment agrees [19] (`82: 'clearWaypoints', // Alt+Shift+R`), but I did not enumerate the live
   shortcut map to confirm no third collision after #3501 [39]. `[UNVERIFIED]`

6. **`Rounded` (as distinct from `Curved`) waypoint behaviour was not probed live.** The table's
   "Rounded" row is source-derived (`STYLE_ROUNDED` → `isRounded`, consumed in painting
   [9][12][29]) and, by analogy with `curved=1` (proven painting-only in §8.2), it is almost
   certainly painting-only — but I did **not** run `rounded=1` through the live router probe.
   `[UNVERIFIED — high confidence by analogy]`

7. **Two entries in §6 are my inference, not user reports** and are marked as such there: only
   one waypoint being meaningful for elbow/isometric (#10) and the straight/waypoint doc
   contradiction confusing users (#11). Both are consequences I read out of the source, not
   complaints I found. `[UNVERIFIED as complaints]`

8. **Stack Overflow yielded almost nothing.** A Stack Exchange API search for `draw.io waypoint`
   returned exactly 2 items, one of which ("How to add a waypoint in draw.io",
   `stackoverflow.com/questions/76738872`) **failed to scrape** (anti-bot) and could therefore
   not be cited as evidence [47]. No SO content is relied on anywhere in this report.
   `[NOT EVIDENCED]`

9. **draw.io's own "waypoint shape" is a red herring I deliberately excluded.** The *Misc* shape
   library contains a shape literally named "waypoint" (`shape=waypoint;size=6;pointerEvents=1;`),
   which is a **join node** for merging connectors, not an edge waypoint [19][30][31].
   Anyone implementing "waypoints" in Diagram Studio should not be confused by search results
   about it.

10. **The `mxgraph` repo is stale relative to what draw.io ships.** `jgraph/mxgraph@master` and
    draw.io's vendored copy diverge (different copyright line, added null-guards on
    `sourceGeometry`/`targetGeometry`, `virtualBendOpacity` 20 vs 40, cursor set conditionally on
    cell movability, `roundLength` returning `Math.round(length)` vs
    `Math.round(length * 100) / 100`, `constraintHandler` removed from `init`) [1 vs 22, 3 vs 23].
    **For the build, the draw.io `dev` vendored copies [22]–[27] are authoritative**, and the
    runtime read (§8.1) matches them (`virtualBendOpacity: 40`), not upstream `master`.
