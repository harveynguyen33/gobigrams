# C1 — diagrams.net / draw.io connection-line (edge) behaviour

Child C1 of the "edge utilities" research pass. Date: 2026-09-21.
Output file: `/home/harvey/diagram-studio-research/edge-utilities/C1-drawio.md` (only file written).

**Method.** Two independent evidence streams, both primary:

1. **Shipped source**, read from `jgraph/drawio` `dev` branch via raw.githubusercontent.com (the
   editor UI is `src/main/webapp/js/grapheditor/*.js`; the graph engine is
   `src/main/webapp/mxgraph/src/**`). Line numbers quoted are from the `dev` revision fetched on
   2026-09-21 and may drift.
2. **Live app**, `https://app.diagrams.net`, driven through a real browser. Test diagrams were built
   as compressed `#R<base64>` XML payloads and their rendered SVG/DOM was inspected directly (path
   `stroke`, `stroke-dasharray`, `animation`; label `getComputedStyle().backgroundColor`; panel
   control tags). Every "live" claim below is a measured value, not an inference.

Where the shipped source and the live app both exist, they agree; disagreements and gaps are flagged.

---

## 1. DATA MODEL — what an edge and its label actually ARE

### 1.1 An edge is a cell with a style string, not typed fields

draw.io stores everything in a `{key=value;key=value;}` **style string** on the cell, parsed by
`mxUtils.getValue(style, key, default)`. There is no typed property bag; the Format panel is a
generic read/write view over that string. The editor's own doc says so:

> "Use `key=value` pairs to define the connector (edge) style … Right click on a connector, then
> select *Edit Style*."
> — https://www.drawio.com/docs/manual/styles/connector-styles/

The edge keys the live panel exposed in its **Property/Value** table (measured, classic theme, one
edge selected) were: `Arc Size`, `Source Constraint`, `Target Constraint`, `Jetty Size`,
`Fill Opacity`, `Stroke Opacity`, `Start Fill`, `Start Fill Color`, `End Fill`, `End Fill Color`,
`Terminal Spacing`, `Anchor Direction`, `Snap to Point`, `Dash Pattern`, `Fixed Dash`, `Editable`,
`Edit Dialog`, `Background Outline`, `Bendable`, `Movable`, `Cloneable`, `Deletable`, `No Jumps`,
`Ignore Edge`, `Loop Routing`, `Orthogonal`, `Enumerate`, `Comic`, `Line Cap`, `Line Join`,
`Miter Limit`. These are the raw style keys, untyped, edited as text.

The canonical key constants live in
`mxgraph/src/util/mxConstants.js` (`STYLE_ENDARROW: 'endArrow'`, `STYLE_STARTSIZE: 'startSize'`,
`STYLE_SOURCE_PERIMETER_SPACING`, `STYLE_LABEL_BACKGROUNDCOLOR: 'labelBackgroundColor'`,
`STYLE_LABEL_PADDING: 'labelPadding'`, …) —
https://github.com/jgraph/drawio/blob/dev/src/main/webapp/mxgraph/src/util/mxConstants.js

### 1.2 An edge label is a SEPARATE CHILD CELL (a vertex!), not a string on the edge

This is the single most important structural fact for our decision, and it is the mechanism behind
Harvey's ask #1 and #4.

`Graph.prototype.addText` (the routine that runs when you double-click an edge and type) creates a
new cell, sets `label.vertex = true`, and parents it to the edge:

```js
Graph.prototype.addText = function(x, y, state) {
  // Creates a new edge label with a predefined text
  var label = new mxCell();
  label.value = 'Text';
  label.geometry = new mxGeometry(0, 0, 0, 0);
  label.vertex = true;
  var style = 'html=1;align=center;verticalAlign=middle;resizable=0;points=[];';
  if (state != null && this.model.isEdge(state.cell)) {
    label.style = 'edgeLabel;' + this.appendFontSize(style, this.edgeFontSize);
    label.geometry.relative = true;
    label.connectable = false;
    // Resets the relative location stored inside the geometry
    var pt2 = this.view.getRelativePoint(state, x, y);
    label.geometry.x = Math.round(pt2.x * 10000) / 10000;
    label.geometry.y = Math.round(pt2.y);
    ...
  }
```
— https://github.com/jgraph/drawio/blob/dev/src/main/webapp/js/grapheditor/Graph.js

So a stored label looks like this (this is literally what draw.io writes; the `MID` label in my test
diagram round-tripped through this shape):

```xml
<mxCell id="5" value="LBL" style="edgeLabel;html=1;align=center;verticalAlign=middle;
        resizable=0;points=[];labelBackgroundColor=none;" vertex="1" connectable="0" parent="4">
  <mxGeometry x="0.25" y="-22" relative="1" as="geometry"><mxPoint as="offset"/></mxGeometry>
</mxCell>
```

| field | meaning | source |
|---|---|---|
| `parent="4"` | the label is a **child of the edge cell** | `Graph.addText`, same URL |
| `vertex="1"` | it is a vertex, not a special text field | `Graph.addText` |
| `style="edgeLabel;…"` | the marker style that makes it an edge label | `Graph.addText` |
| `geometry.relative = true` | position is expressed relative to the edge path | `Graph.addText` |
| `geometry.x` ∈ [0,1] **roughly** | fraction along the edge; **not clamped** — the "3 fixed slots" only come from where you double-clicked, and the value is a float set from the click point | `Graph.addText`: `label.geometry.x = Math.round(pt2.x * 10000) / 10000` |
| `geometry.y` | perpendicular offset in px | `Graph.addText` |
| `geometry.offset` | px nudge added on top, for fine drag | `mxEdgeHandler.moveLabel` |

**Consequence for our build:** "the label fights the drag handle" (#1) is not an accident of
Diagram Studio's design — draw.io has the *same* collision and solves it **in the code, not the UI**:
`mxEdgeHandler.prototype.manageLabelHandle` is enabled in the editor and moves the label's grab
handle out of the way when it intersects a terminal handle:

```js
mxEdgeHandler.prototype.checkLabelHandle = function(b) {
  if (this.labelShape != null) {
    var b2 = this.labelShape.bounds;
    if (mxUtils.intersects(b, b2)) {
      if (b.getCenterY() < b2.getCenterY()) { b2.y = b.y + b.height; }
      else { b2.y = b.y - b2.height; }
    }
  }
};
...
mxEdgeHandler.prototype.manageLabelHandle = true;   // Graph.js, editor bootstrap
```
— https://github.com/jgraph/drawio/blob/dev/src/main/webapp/mxgraph/src/handler/mxEdgeHandler.js
and https://github.com/jgraph/drawio/blob/dev/src/main/webapp/js/grapheditor/Graph.js
(`mxEdgeHandler.prototype.labelHandleImage = HoverIcons.prototype.secondaryHandle;`,
`mxEdgeHandler.prototype.manageLabelHandle = true;`)
The handle artwork is a 16×16 diamond: `HoverIcons.secondaryHandle = Graph.createSvgImage(16, 16,
'<path d="m 8 3 L 13 8 L 8 13 L 3 8 z" stroke="#fff" fill="#fca000"/>')` (Graph.js).

### 1.3 There are three labels per edge — by convention, not by a limit

draw.io's docs state the convention plainly:

> "Connectors can have **three labels** - one in the middle, and at either end."
> — https://www.drawio.com/docs/manual/connectors/connector-labels/

and the same on the label page:

> "You can add three labels to a connector - one at the source end, one at the target end, and one
> in the middle."
> — https://www.drawio.com/docs/manual/text/labels-add/

**But** I found **no code-level cap**: `Graph.addText` creates a label at *any* point you
double-click, and nothing checks `getChildCount() >= 3`. The "three" is the documented ergonomic
convention; the data model allows an arbitrary number of child label cells. The default x-slot when
the editor *re-lays-out* labels (in the link-preview code) is `-0.8 / 0 / 0.8` for start/middle/end
(`Graph.js` ~3066-3095), which is what makes them *look* like three slots. **[UNVERIFIED]** whether a
4th label added by double-click is preserved through arbitrary operations; I did not exhaustively
test it, and the docs only commit to three.

### 1.4 Where the label position is read/written when you drag it

Dragging goes through `mxEdgeHandler.moveLabel`, which is also what writes the file:

```js
mxEdgeHandler.prototype.moveLabel = function(edgeState, x, y) {
  var geometry = model.getGeometry(edgeState.cell);
  if (geometry.relative) {
    var pt = this.graph.getView().getRelativePoint(edgeState, x, y);
    geometry.x = Math.round(pt.x * 10000) / 10000;   // fraction along the edge
    geometry.y = Math.round(pt.y);                    // perpendicular offset
    geometry.offset = new mxPoint(0, 0);
    var pt = this.graph.view.getPoint(edgeState, geometry);
    geometry.offset = new mxPoint(Math.round((x - pt.x) / scale), Math.round((y - pt.y) / scale));
  }
  ...
```
— https://github.com/jgraph/drawio/blob/dev/src/main/webapp/mxgraph/src/handler/mxEdgeHandler.js

`getRelativePoint` (`mxgraph/src/view/mxGraphView.js`) projects the drop point onto the nearest
**path segment** and returns `x = ((totalLength/2 - length - projlen) / totalLength) * -2` and
`y = yDistance / scale`. That is exactly the "free drag with sensible anchoring" model: the
along-the-line coordinate is a length fraction (so it survives the edge being re-routed), and the
perpendicular component is a signed pixel offset (so the label can sit beside the line).
**There is no snap-to-slot in the drag path.** Any snapping is a *visual guide* only.

**Live check:** I loaded an edge with a `relative` child label at `x=0.25, y=-22` and confirmed the
label renders at 25 % along the path and 22 px above it — i.e. arbitrary float positions are honoured
and round-trip.

---

## 2. (a) EDGE LABELS — creation, movement, background, transparency

### 2.1 Creating a label: double-click on the edge ✓ (this is exactly Harvey's ask #4)

> "Double click on the connector at the location where you want to add a label."
> — https://www.drawio.com/docs/manual/connectors/connector-labels/

> "Double click on the connector at the position you want to add a text label."
> — https://www.drawio.com/docs/manual/text/labels-add/

**The double-click point is the label's initial position.** Source path: `mxGraph.dblClick` →
`Graph.insertTextForEvent` → `Graph.addText(pt.x, pt.y, state)`. `insertTextForEvent` explicitly
excludes the case where you double-clicked *on the existing label text*:

```js
if ((this.firstClickState == state && this.firstClickSource == src) &&
    (state == null || (state.text == null || state.text.node == null ||
     state.text.boundingBox == null || (!mxUtils.contains(state.text.boundingBox, pt.x, pt.y) &&
     ...)))) {
  cell = this.addText(pt.x, pt.y, state);   // double-click on the LINE body creates a label
}
```
— https://github.com/jgraph/drawio/blob/dev/src/main/webapp/js/grapheditor/Graph.js
(also `Graph.prototype.dblClick` calling `this.insertTextForEvent(evt, cell)`)

So draw.io already implements **"double-click anywhere on the line where there is no label → create
one there"**. This is a direct, citable precedent for ask #4, *and* it explains why the label lands
where you clicked rather than at the midpoint — which also dissolves half of the ask #1 complaint.
Double-clicking *on* an existing label edits it instead (`mxGraph.dblClick` →
`startEditingAtCell`), so the two gestures do not conflict.

**Touch:** the same gesture is documented for touch screens — "Double tap on the shape or connector
to open the on-screen keyboard. Type the label and tap away to deselect." —
https://www.drawio.com/docs/tutorials/touch-screen-diagrams/

### 2.2 Moving a label: free drag via a diamond handle ✓

> "These labels will move with the connector as you move the shapes around on the drawing canvas, but
> you can also drag them to another location. To manually change a label's position, select the label
> by clicking on it, then drag the diamond grab handle to a new position."
> — https://www.drawio.com/docs/manual/connectors/connector-labels/

Key mechanics, all from the shipped source:

- The handle is a **16×16 diamond**, `#fff` stroke on `#fca000` fill
  (`HoverIcons.secondaryHandle`, Graph.js).
- The handle is placed at `state.absoluteOffset` — i.e. **at the label's anchor point**, and its
  bounds are centred on that point (`this.labelShape.bounds = new mxRectangle(Math.round(this.label.x
  - b.width/2), Math.round(this.label.y - b.height/2), …)`, mxEdgeHandler.js ~2260).
- It is only *visible* when `graph.getLabel(cell)` is non-empty **and** the cell is editable **and**
  `graph.isLabelMovable(cell)` **and** handles are visible
  (`this.labelShape.visible = lab != null && lab.length > 0 && …`, mxEdgeHandler.js ~2266).
  **So: no label → no handle. The handle exists only where a label already is.**
- `manageLabelHandle = true` shifts the handle off an intersecting terminal handle (see §1.2).
- Rotation is a second, separate handle: "Select the label on a connector, and use the rotate grab
  handle to rotate the text." (connector-labels page, same URL.)

**Live check of the collision claim.** In my test edge the label was at the path midpoint and the
edge's *terminal* handles sit at the two endpoints; the label's own diamond sits on the label
(`x=645..661, y=150..166` on screen, i.e. a 16 px box centred on the label's anchor). The
`edge-bend-handle` collision Harvey describes is draw.io's `checkLabelHandle` case, and draw.io
answers it by **displacement of the handle**, not by removing the drag.

### 2.3 "Label position" — draw.io DOES ship a preset dropdown, but it is NOT a label-position control

This is the trap in Harvey's ask #6, and it matters. draw.io's Format panel has a `Position`
dropdown in the **Text** tab with nine values `topLeft, top, topRight, left, center, right,
bottomLeft, bottom, bottomRight`:

```js
var directions = ['topLeft','top','topRight','left','center','right','bottomLeft','bottom','bottomRight'];
var lset = {'topLeft': [ALIGN_LEFT, ALIGN_TOP, ALIGN_RIGHT, ALIGN_BOTTOM], ...};
...
graph.setCellStyles(mxConstants.STYLE_LABEL_POSITION, vals[0], ss.cells);
graph.setCellStyles(mxConstants.STYLE_VERTICAL_LABEL_POSITION, vals[1], ss.cells);
graph.setCellStyles(mxConstants.STYLE_ALIGN, vals[2], ss.cells);
graph.setCellStyles(mxConstants.STYLE_VERTICAL_ALIGN, vals[3], ss.cells);
```
— https://github.com/jgraph/drawio/blob/dev/src/main/webapp/js/grapheditor/Format.js (~4105-4220)

It writes `labelPosition` / `verticalLabelPosition` / `align` / `verticalAlign`. **But the renderer
ignores `labelPosition`/`verticalLabelPosition` for edges**: `updateVertexLabelOffset` — the only
consumer — is a *vertex* function (`mxGraphView.js` ~1187), and `mxCellRenderer.createLabelBounds`
even guards the shape hook with `if (hpos == ALIGN_CENTER && vpos == ALIGN_MIDDLE)`
(`mxgraph/src/view/mxCellRenderer.js` ~1188). draw.io's own manual admits what it really does:

> "**Note:** Connector labels **aren't realigned to the connector itself**, but to the anchor diamond
> where the label is attached to the connector."
> — https://www.drawio.com/docs/manual/text/text-alignment/

So: draw.io exposes a 9-way preset for edges that only nudges the text *within the label's own box*
and around its diamond anchor — it is **not** a "which of 3 slots on the line" control. It is a
different axis entirely from the free drag.

**→ This is the strongest evidence for Harvey's ask #6.** A shared tool should not ship a
"Label position" field and a free drag at the same time, because draw.io demonstrates the confusion
that results. Free drag (2.2) is the primary mechanism; the 9-way preset is decorative text
alignment, and draw.io itself documents that it does not reposition the label along the line.

### 2.4 Label background: adjustable, and **fully transparent is the default** ✓ (ask #2)

The key is `labelBackgroundColor` (`mxConstants.STYLE_LABEL_BACKGROUNDCOLOR`, mxConstants.js ~1293),
with `labelBorderColor` alongside it. The control is a **colour option with a checkbox** in the
Text tab ("Background Color", "Border Color"), built by
`createCellColorOption(label, mxConstants.STYLE_LABEL_BACKGROUNDCOLOR, 'default', …)` — Format.js ~4324.
Deselecting the checkbox writes `none`:

```js
} else if (ignoreGraphStyle) {
  graph.updateCellStyles({'labelBackgroundColor': mxConstants.NONE}, [cells[i]]);
}
```
— Format.js ~7898

**Live measurements** (four diagrams, same edge, only `labelBackgroundColor` varied; value read from
`getComputedStyle` of the rendered label div and from the inline `style` draw.io generated):

| `labelBackgroundColor` | rendered `background-color` | inline style draw.io emitted |
|---|---|---|
| absent (default) | `rgba(0, 0, 0, 0)` | none |
| `none` | `rgba(0, 0, 0, 0)` | none |
| `#ffffffe0` | `rgba(255, 255, 255, 0.88)` | `background-color: #ffffffe0;` |
| `#ffffff` | `rgb(255, 255, 255)` | `background-color: #ffffff;` |
| `#ffff88` | `rgb(255, 255, 136)` | `background-color: #ffff88;` |

**So draw.io's default edge-label background is TRANSPARENT, not white.** A white box appears only
when something sets `labelBackgroundColor`. Note also that the value is an **8-digit hex** —
`#ffffffe0` = white at 88 % — which is how draw.io expresses "adjustable including partly
transparent". Two more findings:

- **Padding only exists when there is a background.** `labelPadding` (a 1-4 value CSS shorthand) is
  hidden unless a background or border is set:
  `labelPaddingPanel.style.display = (getValue(style, STYLE_LABEL_BACKGROUNDCOLOR, NONE) != NONE ||
  getValue(style, STYLE_LABEL_BORDERCOLOR, NONE) != NONE) ? '' : 'none';` (Format.js ~5357).
  draw.io's reasoning (its own comment, Format.js ~4763): *"the padding is not painted otherwise."*
- `labelBorderColor` gives the label an outline box independent of the fill — a third state beyond
  "box" and "nothing".

The renderer writes the colour into an inline background on the label's wrapper div
(`mxText.js` ~944-975: `css += 'background-color:' + mxUtils.htmlEntities(bg) + ';'`, and
`var bg = (this.background != null && this.background != mxConstants.NONE) ? this.background : null;`).
— https://github.com/jgraph/drawio/blob/dev/src/main/webapp/mxgraph/src/shape/mxText.js

### 2.5 Editing, and what happens when the edge moves

- Double-click the label text to edit it; select-and-type replaces the text.
  (connector-labels + labels-add, URLs above.)
- Labels "move intelligently with the connector" but a manual move may need updating after a
  re-route: *"If you reroute the connector, you may need to update any labels you had manually
  positioned, but usually the label will move intelligently with the connector."*
  — https://www.drawio.com/docs/manual/text/labels-add/
  Mechanically that is the `relative` geometry + `offset` split from §1.4: the fraction survives,
  the pixel offset may not land where you meant.
- Reversing an edge ("Arrange tab → *Reverse*") also swaps the two end labels' positions:
  *"Your connector ends and their labels will be swapped, but the path of the connector will not be
  changed."* — https://www.drawio.com/docs/manual/connectors/connector-reverse/

---

## 3. (b) THE FORMAT PANEL — grouping, and which controls are buttons vs dropdowns

### 3.1 Panel structure

Tabs, measured live on a selected edge in the classic theme: **`Style` · `Text` · `Arrange`**
(`document.querySelectorAll('.geFormatTitle')` → `["Style","Text","Arrange"]`).

The **Style** tab for an edge is assembled in `StyleFormatPanel.prototype.init` (Format.js ~5720)
as a stack of *collapsible sections*:

```js
var strokeSec = this.createCollapsibleSection(mxResources.get('line'), false);
strokeSec.contentDiv.appendChild(this.addStroke(this.createPanel()));
this.container.appendChild(strokeSec.wrapper);
var lineJumpsPanel = this.addLineJumps(this.createPanel());
var jumpsSec = this.createCollapsibleSection(mxResources.get('lineJumps'), true);
...
var effectsSec = this.createCollapsibleSection(mxResources.get('effects'), true);
effectsSec.contentDiv.appendChild(this.addEffects(this.createPanel()));
```
Section titles measured live, in order: **`Line`**, **`Line Jumps`**, **`Opacity`**, **`Effects`**
(containing `Sketch` / `Flow Animation` / `Shadow`), then **`Edit`** (a 8-9 item action dropdown),
then the raw **`Property | Value`** table.

### 3.2 The control taxonomy — draw.io is mostly a DROPDOWN/INPUT tool, not a button-row tool

Measured live, every control in the Style tab with its HTML tag (this is the honest answer to "which
are button/segment rows vs dropdowns" — **almost none are segmented rows**):

| control | element | detail |
|---|---|---|
| Line colour | `INPUT[type=color]` + a checkbox (`title="Line"`) | swatch + on/off |
| **Line style** (Sharp/Rounded/Curved) | **`SELECT`**, 3 options | a real `<select>` dropdown |
| **Linewidth** | `INPUT` + stepper, **duplicated** in the DOM (two `title="Linewidth"` inputs) | numeric, pt |
| **Line Start / Line End** | a **menu button with an icon grid** (`toolbar.addMenu`) | see §4 |
| Arrow **Size / Spacing** | 4 numeric `INPUT`s with `title="Line Start"` / `"Line End"` | `startSize`, `sourcePerimeterSpacing`, `endSize`, `targetPerimeterSpacing`; each is a `<select>`-less numeric entry |
| **Line Jumps** | **`SELECT`**, 5 options `None/Arc/Gap/Sharp/Line` | a real dropdown |
| Jump `Size` | `INPUT`, default 6 pt | `Graph.defaultJumpSize = 6` |
| **Opacity** | `INPUT`, `%` | `STYLE_OPACITY` |
| **Sketch / Flow Animation / Shadow** | checkboxes in a 2-column table (`geFullWidthElement`) | booleans |
| **Edit** | `SELECT` with 8-9 items (`Edit, Copy as Text, Edit Link, Edit Data, Copy Data, Edit Tooltip, Edit Note, Edit Style, Open Library`) | action menu |
| Properties | `TABLE` (`geProperties`) | raw key/value text |

The **Text** tab holds: font family (`toolbar.addMenu`), font size, bold/italic/underline
(added via `ui.toolbar.addItems(['bold','italic','underline'], …)` — these *are* button rows),
a `Vertical` toggle button, alignment buttons, a **`Position` `<select>`** with 9 values (see §2.3),
a **`Writing Direction` `<select>`**, colour options, and a **Spacing** group of 5 numeric inputs
(`Top, Global, Left, Bottom, Right` — measured live as a 5-cell table).

**Panel widths (button-row geometry).** draw.io builds its icon rows at a fixed 216 px content width
(`addUnitInput`: `input.style.left = (216 - right - width) + 'px'`), and sets explicit per-button
widths in the connector row: `edgeShape/altPattern/edgeStyle/lineStart/lineEnd` each
`style.width = '67px'; style.marginRight = '2px'` and `pattern.style.width = '142px'`
(Format.js ~7085-7100). **A 67 px + 2 px rhythm for five equal buttons** is a concrete, citable
"balanced width" precedent — directly relevant to Harvey's ask #8/#9.

### 3.3 No hint text anywhere

I found no explanatory/help subtitle text in draw.io's Format panel rows — the panel is labels +
controls only. Rows carry `title` attributes (tooltips) but no visible prose. Live panel text for a
selected edge contained no sentence-length strings. **This supports ask #3** (remove hint text): the
most mature tool in the category ships zero in-panel tutorial prose.

---

## 4. (c) THE MARKER / ARROWHEAD MODEL — and what the two ends are NAMED

### 4.1 The names: **"Line Start" / "Line End"** — Harvey's instinct is right

From the shipped resource bundle `src/main/webapp/resources/dia.txt`:

```
lineend=Line End
linestart=Line Start
```
— https://github.com/jgraph/drawio/blob/dev/src/main/webapp/resources/dia.txt (lines 569, 571)

These exact strings are used as (a) the visible row labels under the numeric inputs and (b) the
`title` attributes of the arrow menus:

```js
this.addLabel(arrowPanel, mxResources.get('linestart'), 82, 62).style.fontSize = '10px';
this.addLabel(arrowPanel, mxResources.get('lineend'), 16, 62).style.fontSize = '10px';
...
startSize.setAttribute('title', mxResources.get('linestart'));
endSize.setAttribute('title', mxResources.get('lineend'));
startSpacing.setAttribute('title', mxResources.get('linestart'));
endSpacing.setAttribute('title', mxResources.get('lineend'));
```
— Format.js ~7165-7185

**Live confirmation** (classic theme, edge selected): the four numeric inputs carried
`title="Line Start"`, `title="Line End"`, `title="Line Start"`, `title="Line End"` — i.e. the
**Size** row and the **Spacing** row are each labelled with the Line Start / Line End pair.

Also in the **Arrange** tab, the raw start/end point coordinates of a dangling edge are labelled
`linestart` / `lineend` (Format.js ~3686, 3712, 3726).

What draw.io **does not** call them: "head start", "head end", "arrow head", "source", "target" in
the UI. The internal style keys are `startArrow` / `endArrow` / `startSize` / `endSize`, and the doc
page prose uses "Start" and "End":

> "Click on the drop-down list for the **Start** and **End** of the connector and choose a different
> connector arrow from the long list."
> — https://www.drawio.com/docs/manual/connectors/change-connector-arrows/

and for the bidirectional case, the doc calls it "the middle drop down on the second row"
(same URL) — i.e. draw.io's own prose gets *worse* than its UI, describing arrow controls by
grid position rather than by name. The UI word is consistently **Line Start / Line End**.

### 4.2 Are they button rows? No — they are **two icon-menu buttons whose contents are a large grid**

The arrowheads are `ui.toolbar.addMenu(...)` — buttons that open a popup menu of icon items — not
segmented button rows:

```js
var lineStart = ui.toolbar.addMenu(new Menu(... ), '', null, stylePanel2);
...
lineStart.style.width = '67px';
lineStart.style.marginRight = '2px';
lineEnd.style.width  = '67px';
lineEnd.style.marginRight = '2px';
this.addArrow(lineStart);   // adds the small ▼ chevron (class "geAdaptiveAsset geArrow")
this.addArrow(lineEnd);
```
— Format.js ~6837 (`lineStart`), ~6953 (`lineEnd`), ~7085-7100 (widths / chevrons)

Each menu is a **long list** — the doc says so and warns about overflow:

> "choose a different connector arrow from the **long list**. If you don't see all of these arrows
> and connector symbols, you may need to make your browser window larger."
> — https://www.drawio.com/docs/manual/connectors/change-connector-arrows/

The items live in a wide grid (`menu.div.style.width = '40px'`, then `mxUtils.fit(menu.div)`),
and each item writes two style keys at once — the arrow **and** its fill:

```js
Format.processMenuIcon(this.editorUi.menus.edgeStyleChange(menu, '',
  [mxConstants.STYLE_STARTARROW, 'startFill'], ['async', 0], …))
```
— Format.js ~6890-6935 (start side), ~6974-7040 (end side, mirrored with `scaleX(-1)`)

**Live confirmation:** the Style panel rendered the two arrow controls as an `<img>` inside a
`SELECT`-less container with classes `geAdaptiveAsset geArrow` — the menu-button pattern, distinct
from the genuine `<select>` elements used for Line style and Line jumps.

**Named marker values** observed in the menus: `none`, `classic`, `classicThin`, `block`,
`blockThin`, `open`, `openThin`, `oval`, `diamond`, `diamondThin`, plus `async`, `openAsync`,
`circle`, `circlePlus`, `cross`, `dash`, `baseDash`, `box`, `halfCircle`, `doubleBlock` (0/1),
`ERone`, `ERmandOne`, `ERmany`, `ERoneToMany`, `ERzeroToOne`, `ERzeroToMany`. The mxGraph-level
constants are `ARROW_CLASSIC/CLASSIC_THIN/BLOCK/BLOCK_THIN/OPEN/OPEN_THIN/OVAL/DIAMOND/DIAMOND_THIN`
(mxConstants.js ~2269-2325), and `mxMarker.js` registers `classic, classicThin, block, blockThin,
open, openThin, oval, diamond, diamondThin, baseDash, doubleBlock, manyOptional`.
— https://github.com/jgraph/drawio/blob/dev/src/main/webapp/mxgraph/src/shape/mxMarker.js

### 4.3 Separate fill / size / spacing controls

- **Fill is a separate axis from shape**: `Start Fill` / `End Fill` booleans, plus `Start Fill Color`
  / `End Fill Color` (measured live in the Property table). Doc: "Open the *Properties* section, and
  enable or disable the *Start Fill* and *End Fill* checkboxes." (change-connector-arrows URL.)
  Renderer: `c.setFillColor(mxUtils.getValue(this.style, mxConstants.STYLE_STARTFILLCOLOR,
  this.stroke))` (mxConnector.js).
- **Arrow size is proportional to line width** by default: *"To change the size of an arrow or symbol
  on a connector, change the thickness of the connector. The arrow/symbol will be resized in
  proportion to the line width."* (change-connector-arrows URL.) But an explicit
  `startSize`/`endSize` overrides it — the live panel showed `Line Start 6 pt`, `Line End 6 pt`
  (`DEFAULT_MARKERSIZE`) editable independently.
- **"Spacing" = distance from the shape outline**, and it accepts negatives that pull the arrow
  *inside* the shape: *"Set the size of the arrow head or symbol, and the space between it and the
  shape outline. Negative values for spacing will position the end of the connector inside the shape
  boundary."* (connector-styles URL.) Keys: `sourcePerimeterSpacing` / `targetPerimeterSpacing`
  (Format.js ~7352-7356). Live values 0 pt.
- There is a third, shape-independent `Perimeter` numeric for whole-shape outlines
  (`STYLE_PERIMETER_SPACING`).

**→ For ask #9: draw.io names them "Line Start" / "Line End", shows them as two icon-menu buttons at
67 px + 2 px, and keeps *shape*, *fill*, *size*, and *spacing* as four separate controls.** That is
the mature-tool answer to "should the two ends be named head start / head end": no mature tool I
could verify uses "head"; the vocabulary is **Line Start / Line End** (a "start/end" pair, not a
"head" pair).

---

## 5. (d) SELECTION vs AUTHORED COLOUR — **draw.io never tints the line body**

This is the direct answer to Harvey's bug #7, and it is the most decision-relevant finding in this
report.

**Mechanism (source).** The edge's authored colour is painted from the style. Selection is drawn as a
**second, separate shape on the overlay pane**, dashed, in a fixed selection colour:

```js
mxEdgeHandler.prototype.createSelectionShape = function(points) {
  var shape = new this.state.shape.constructor();
  shape.outline = true;
  shape.apply(this.state);
  shape.isDashed = this.isSelectionDashed();     // default TRUE
  shape.stroke = this.getSelectionColor();       // default '#00a8ff' in the editor
  shape.isShadow = false;
  return shape;
};
```
— https://github.com/jgraph/drawio/blob/dev/src/main/webapp/mxgraph/src/handler/mxEdgeHandler.js
(`EDGE_SELECTION_DASHED: true`, `EDGE_SELECTION_COLOR: '#00FF00'` are the mxGraph defaults at
mxConstants.js ~396-441; the **editor overrides them** to `mxConstants.EDGE_SELECTION_COLOR =
'#00a8ff'` in `Graph.js` ~17434, alongside `HANDLE_FILLCOLOR = '#29b6f2'`.)

**Live measurement — this is the proof.** With one red (`#ff0000`, width 3) edge selected, the SVG
contained **five** stroked paths:

```
white   sw=11   (hit-tolerance clone)   d="M 1444 571 L 1704 571 L 1704 710.9"
#ff0000 sw=3    (the AUTHORED line)     d="M 1444 571 L 1704 571 L 1704 710.9"
#ff0000 sw=3    (the AUTHORED arrowhead)
#00a8ff dash="3 3"  (the SELECTION overlay)
#00a8ff dash="3 3"  (the SELECTION overlay, arrowhead)
```

Then, **while the edge was still selected**, I drove the colour input to `#00cc00`:

```
white  (hit clone)
#00cc00  <- authored body followed the new colour IMMEDIATELY
#00cc00  <- arrowhead followed too
#00a8ff dash="3 3"  <- selection overlay unchanged
```

**draw.io's authored stroke stays authored while selected.** Selection is a *dashed outline drawn on
top of it* in `#00a8ff`, so the user always sees the real colour. There is no `!important`-style
override of the authored stroke — the two are different DOM elements on different layers.

This is precisely what Diagram Studio's `styles.css:1217`
(`.react-flow__edge.selected .react-flow__edge-path { stroke: var(--sel) !important; }`) gets wrong:
it *replaces* the authored stroke instead of *overlaying* a separate selection mark. **Cited
alternative that fixes #7 without touching the colour pipeline: a second path on top, dashed, in the
selection colour.** Note also that draw.io's selection mark is *dashed* — which additionally keeps it
visible over dashed edges, and (unlike a solid tint) does not pretend to be the edge.

---

## 6. (e) THE REST OF THE EDGE FORMAT PANEL — what else a connection line should have

Everything below is a genuine shipped edge control in draw.io's Style tab, with its data-model cost.

### 6.1 Line jumps (crossing bridges) — `jumpStyle` + `jumpSize`

Doc: *"Choose how overlapping connectors should be displayed. Choose between the default `overlapped`
(none), with an `arc`, a `gap` or a `sharp` bend."*
— https://www.drawio.com/docs/manual/styles/connector-styles/

Source: 5 values in a `<select>` — `['none','arc','gap','sharp','line']` — writing `jumpStyle`, with a
companion `jumpSize` numeric (`Graph.defaultJumpSize = 6`):

```js
var styles = ['none', 'arc', 'gap', 'sharp', 'line'];
graph.setCellStyles('jumpStyle', styleSelect.value, ss.cells);
...
jumpSizeUpdate = this.installInputHandler(jumpSize, 'jumpSize', Graph.defaultJumpSize, …);
```
— Format.js ~7376-7466, `Graph.lineJumpsEnabled = true` / `Graph.defaultJumpSize = 6` at Graph.js
1603/1608

The section is a **collapsible section** (`mxResources.get('lineJumps')` → `dia.txt: lineJumps=Line
Jumps`) that is auto-hidden when the selection has no edges, and it also has a per-edge opt-out key
`noJump` (measured in the Property table as `No Jumps`).

Rationale a shared tool can state plainly: without jumps, two crossing connectors read as a
junction. This is the cheapest "professional" signal on the whole list.

### 6.2 Flow animation — and draw.io's answer to ask #10's "is anything duplicated?"

Doc: *"Select the connectors you wish to animate … In the Style tab of the format panel, enable Flow
Animation. The connectors will now appear as if they have dashes moving from the source connection
point to the target connection point."*
— https://www.drawio.com/docs/manual/connectors/connector-animate/

**Data model:** one boolean `flowAnimation` (`0`/`1`) — `addOption(mxResources.get('flowAnimation'),
'flowAnimation', 0)` (Format.js ~7561, in `addEffects`), plus style keys `flowDuration`, `flowTiming`,
`flowDirection` under Properties. Defaults per the docs: `Flow Duration 500`, `Flow Timing Linear`,
`Flow Direction Normal` (source→target), others `Reverse / Alternate / Alternate-Reverse`.
— https://www.drawio.com/docs/manual/styles/connector-animation-styles/

**Does flow animation duplicate `dashPattern`? This is the crux of ask #10, and the answer is NO —
they are orthogonal.** The animation is a CSS animation applied to the path; the dash pattern is an
independent stroke attribute. Live measurement of one edge with `flowAnimation=1;dashPattern=8 8`:

```
{ stroke: "#ff0000", dash: "8 8",  anim: "500ms linear 0s infinite norma…" }
{ stroke: "#ff0000", dash: null,   anim: ""         }   <- arrowhead, not animated
{ stroke: "white",   dash: null,   anim: ""         }   <- hit clone
```

So the same edge carried **both** a static `8 8` dash pattern *and* a 500 ms flow animation, and only
the line body was animated (the arrowhead was not). Confirmation from the source: `isFlowAnimationEnabled`
requires `getValue(style,'flowAnimation','0') == '1'` and takes the *first visible line stroke*
(`mxShape.prototype.getFlowAnimationPath`, Graph.js ~16478-16690).

**But there IS a real duplication adjacent to it, and it is exactly the kind Harvey should fix.**
draw.io exposes **two different dash controls** in the same panel: `Pattern` (the `dashPattern` /
`dashed` pair) in the line row, and — per its own animation doc — *"Change the animation pattern by
selecting a different one from the **Pattern** drop down list"* on an animated connector. The doc lists
"Flow Animation" and "Animation Pattern" as two separate knobs describing what looks like one thing
(disabled-animations page, URL below). The clean model, which draw.io's *source* actually implements,
is: **one dash-pattern control** (values `solid, dashed, 8 8, 12 12, 8 4 1 4, dotted, 1 2, 1 4`, plus
`Custom…`) **+ one animation boolean** (`flowAnimation`) **+ 3 animation properties** (duration /
timing / direction). Format.js ~6659-6683 is the authoritative pattern list.

**Also worth copying — a global animation kill-switch that does not lose the style.** *"Select View >
Animations … **Note:** This does not disable the flow animation style on the connectors, only the
visual effect in your browser window."* — the doc even argues the UX case: *"Animations also consume
additional device resources and if there are many in a diagram, they may slow down the editor."*
— https://www.drawio.com/docs/manual/styles/disable-animations/ — **directly relevant to the
tablet/phone constraint: it is how you keep a shared diagram usable on a phone without editing the
document.**

### 6.3 What the panel calls the path — three orthogonal axes, not one

`Line style` (Sharp / Rounded / Curved) is **corner treatment**; `Waypoints` (in the doc) /
`Connection` (in the toolbar) is **routing**:

| control | keys written | values |
|---|---|---|
| **Line style** | `rounded`, `curved` | `sharp` (default) · `rounded` (`rounded=1;curved=0`) · `curved` (`rounded=0;curved=1`) |
| **Waypoints** | `edgeStyle`, `elbow`, `curved`, `noEdgeStyle`, `libavoidRouting` | `straight` (none) · `orthogonal` (`orthogonalEdgeStyle`) · `libavoid` (auto obstacle-avoiding) · `elbow` (horizontal/vertical) · `isometric` · `curved` (`orthogonalEdgeStyle;curved=1`) · `entityRelation` |
| **Connection** (shape) | `shape`, `startSize`, `endSize`, `dashed`, `width` | `line` (default) · `link` (double line, no arrows) · `flexArrow` · `arrow` ("simple arrow" — straight, no waypoints) · `filledEdge` · `pipe` · `wire` (dashed) |

Sources: Format.js ~6528-6660 (`addStroke`, `styles = ['sharp','rounded','curved']` on a `<select>`),
Format.js ~6791-6830 (`edgeStyle` menu; the libavoid entry is guarded by
`if (typeof LibavoidRouting !== 'undefined')` and writes `libavoidRouting=1` and calls
`LibavoidRouting.autoReroute`), Format.js ~6685-6705 (`edgeShape` menu), and
https://www.drawio.com/docs/manual/styles/connector-styles/ for the prose names.

The toolbar exposes `curved` as a **separate boolean action** alongside `rounded`:
`this.actions.get('curved').setEnabled(ss.edges.length > 0)` (EditorUi.js ~6060). Rounded and curved
are **mutually exclusive in the UI** and are written as a pair in one `beginUpdate`
(`keys = [STYLE_ROUNDED, STYLE_CURVED]; values = ['0','0'] | ['1','0'] | ['0','1']`, Format.js ~6555-6578).

**→ Directly relevant to asks #8 and #6.** draw.io separates "how do the corners look" (3 values,
one `<select>`) from "where does the line go" (7 routing options in a menu). Diagram Studio currently
fuses four path types (`straight/step/smoothstep/bezier`) into one `shape` — that is *routing and
corner treatment in one field*, which is the same conflation that makes Harvey's asks 5 and 6 feel
redundant. draw.io's split is the defensible model.

### 6.4 Other edge controls draw.io ships

| utility | key(s) | control | doc / source |
|---|---|---|---|
| **Opacity** | `opacity` | `%` input | connector-styles URL; live `INPUT title="Opacity" value="100 %"` |
| **Shadow** | `shadow` | checkbox | connector-styles URL |
| **Sketch / rough** | `sketch`, `curveFitting`, `jiggle`, `comicStyle` | checkbox + `Sketch Style: Comic` property | https://www.drawio.com/docs/manual/styles/connector-styles/ and .../styles/rough-style/ |
| **Copy Style / Paste Style** | — | two buttons in the Style tab | connector-styles URL |
| **Set as Default Style** | — | button, `ss.cells.length == 1` | `StyleFormatPanel.prototype.addStyleOps` (Format.js ~7575); https://www.drawio.com/docs/reference/shortcuts/double-click-shortcut/ |
| **Reverse** | swaps terminals | button in **Arrange** tab | https://www.drawio.com/docs/manual/connectors/connector-reverse/ |
| **Flip H / V** | — | Arrange tab | https://www.drawio.com/docs/manual/connectors/connector-flip/ |
| **Clear Waypoints** | clears `points` | context menu + action | https://www.drawio.com/docs/manual/connectors/waypoints-connectors/ |
| **Waypoint shape** | a real *shape* for junctions | Misc library | https://www.drawio.com/docs/manual/shapes/waypoint-shape/ |
| **Connection Arrows** | diagram-level toggle | Diagram tab checkbox | https://www.drawio.com/docs/manual/editor/panels/connection-arrows-hide/ |
| **Line Cap / Line Join / Miter Limit** | same names | Property table | measured live |
| **Bendable / Movable / Cloneable / Deletable / Editable / No Jumps / Ignore Edge / Loop Routing / Orthogonal / Enumerate / Snap to Point / Anchor Direction / Edit Dialog** | same names | Property table (raw text) | measured live |

Default edge style for reference (what a fresh connector is):
`{'edgeStyle': 'orthogonalEdgeStyle', 'rounded': '0', 'jettySize': 'auto', 'orthogonalLoop': '1'}`
(Graph.js ~17591), over the mxGraph default `endArrow=classic, strokeColor=#6482B9,
fontColor=#446299, verticalAlign=middle, align=center`
(`mxStylesheet.prototype.createDefaultEdgeStyle`, mxStylesheet.js ~98).

---

## 7. TOUCH / TABLET BEHAVIOUR (hard constraint)

This is a real risk area, and draw.io has an explicit finding worth copying *and* one to avoid.

- draw.io ships touch support as a first-class story: *"While almost all features work just as well
  with a finger or pen as they do with a mouse, there are a few gesture shortcuts specific to touch
  screens."* — https://www.drawio.com/docs/tutorials/touch-screen-diagrams/
- **Label creation on touch is documented as double-TAP**: *"Double tap on the shape or connector to
  open the on-screen keyboard."* (same URL). Ask #4 therefore maps cleanly to touch — but note
  draw.io's own warning that the gestures conflict: *"Tap on a shape or connector to select it, pause
  briefly, then tap again to open the context menu. If you tap twice too quickly (double tap), you'll
  start editing the label instead."* (same URL.) **A shared tool must pick one meaning for the double
  gesture on an edge and not overload it for both "edit existing label" and "open context menu".**
- Double-tap detection is implemented in mxGraph with an explicit tolerance and timeout:
  `this.doubleTapTimeout`, `this.doubleTapTolerance`, and the branch is gated on
  `this.doubleTapEnabled && mxClient.IS_TOUCH && (isTouchEvent || isPenEvent)` (mxGraph.js ~13605-13680).
  It fires `dblClick` on `MOUSE_UP` of the second tap when `me.getCell() == this.lastTouchCell`.
- **Pitfall to avoid — draw.io disables pointer events on the bend/label handles under touch.**
  `initBend` ends with:
  ```js
  if (mxClient.IS_TOUCH) { bend.node.setAttribute('pointer-events', 'none'); }
  ```
  (mxEdgeHandler.js ~796.) The label diamond and waypoint handles are the things you *most* want to
  drag on a tablet, and draw.io makes them non-hit-testable there — so the drag-to-move-label path is
  **not** the touch path in draw.io. This directly supports the brief's warning: **a
  hover/selection-dependent drag handle is a desktop affordance. On touch the label must be movable
  by dragging the label itself, or a touch-drag on the edge body must be unambiguous.**
- draw.io also forces touch-aware sizing: `EditorUi.prototype.splitSize = (mxClient.IS_TOUCH ||
  mxClient.IS_POINTER) ? 12 : 8` (EditorUi.js ~1175), and ships a `touch=1` URL flag to force the
  touch interface (https://www.drawio.com/docs/reference/supported-url-parameters/).

---

## 8. WHERE THE TOOLS/CLAIMS DISAGREE — what the owner must decide

1. **"Label on the line" — free drag vs preset.** draw.io's *interaction* is free drag (§2.2) but its
   *panel* offers a 9-way `Position` preset (§2.3) that **does not move the label along the line** and
   is documented as anchoring to the diamond, not the connector. Shipping both is the confusion
   Harvey is reacting to. **Decision: free drag as the mechanism; no along-the-line preset list.**
2. **Label background default.** The naive expectation is "white box". draw.io's measured default is
   `rgba(0,0,0,0)` — transparent (§2.4). If Diagram Studio's `.edge-label` paints
   `background: var(--surface)`, that is a *departure from the mature default*, and the transparent
   option is not a special case but the baseline.
3. **Selection colour.** Harvey's bug #7 is a `!important` override. draw.io proves the opposite
   design: authored colour untouched, selection = separate dashed `#00a8ff` overlay (§5). *But* note
   draw.io also has a *hard-coded* selection hex (`Graph.js` 17434) — so copying its design does not
   mean copying a hex; Diagram Studio should use a token, per its 160-hex ceiling.
4. **"Head start / head end" vs "Line Start / Line End".** No verified mature tool uses "head".
   draw.io's shipped UI string is **Line Start / Line End** (§4.1). This is a naming decision the
   owner should make deliberately, not by intuition.
5. **Buttons vs dropdowns.** Harvey wants button rows for stroke width / line style / curvature /
   markers (asks #8, #9). **draw.io is the counter-example**: Line style and Line jumps are
   `<select>` dropdowns; arrows are icon-menu buttons; only bold/italic/underline and vertical are true
   button rows. So "mature tools use button rows" is **only true for the marker menus** — the
   defensible argument for button rows in Diagram Studio is *discoverability for first-time users*
   (per the shared-tool constraint), not "draw.io does it". Cite the 67 px + 2 px rhythm (§3.2) for
   the balanced widths.
6. **"Flow Animation" duplication (ask #10).** Confirmed NOT a duplicate of dash pattern — they
   compose and were measured together on one edge (§6.2). The real duplication is draw.io's *own* two
   Pattern controls (line-pattern vs animation-pattern). The clean model is one dash control + one
   animation boolean + 3 animation properties.

---

## 9. UNVERIFIED / NOT TESTED

- **[UNVERIFIED — not exercised]** The live drag of the label's diamond handle. I located the handle
  (16 px, `HoverIcons.secondaryHandle`) and read its placement code
  (`labelShape.bounds` centred on `state.absoluteOffset`) and its drag handler (`moveLabel`), but CDP
  synthetic mouse injection timed out in the harness before I completed the drag. The free-drag claim
  therefore rests entirely on primary sources: draw.io's own manual (connector-labels, labels-add) plus
  `mxEdgeHandler.moveLabel` / `mxGraphView.getRelativePoint` / `mxGraph.isLabelMovable`
  (`edgeLabelsMovable = true` by default, mxGraph.js ~1162).
- **[UNVERIFIED — not exhausted]** Whether more than three labels on one edge survive arbitrary
  operations. No cap exists in `Graph.addText`; the docs only commit to three; the re-layout code uses
  three slots (−0.8 / 0 / 0.8).
- **[UNVERIFIED — no snap]** I found **no** snap-to-slot logic in the label drag path. Whether a
  *visual guide* appears when a label passes 25/50/75 % is a rendering detail I did not isolate. The
  position values are floats, unclamped.
- **[UNVERIFIED — source only]** `flowDuration` / `flowTiming` / `flowDirection` are documented
  (connector-animation-styles) and visible in draw.io's own screenshots, but I did **not** find these
  three keys in the `dev` branch source files I fetched (`Format.js`, `Graph.js`, `Actions.js`,
  `Menus.js`, `dia.txt` do not contain the strings). They are therefore documented-but-not-source-
  confirmed at this revision. `flowAnimation` itself **is** source- and live-confirmed.
- **[UNVERIFIED — search backend]** The configured web search returned unrelated results (Microsoft
  Edge, pizza delivery) for every query, so **all** evidence here came from direct HTTP fetches of
  drawio.com's sitemap → docs pages, `raw.githubusercontent.com`, and the live app. No secondary
  write-ups were used, and none are cited.
- **[NOT RE-RESEARCHED]** Diagram Studio's own `GoblinEdge.tsx`, `styles.css`, `inspector.ts` per the
  brief §2 — I did not open `src/`.

---

## RECOMMENDATIONS

Ordered by evidence strength × fit to the shared-tool constraint (touch-safe, no new npm dep, no new
hard-coded hex). Each item: **{utility — evidence — interaction — data-model cost — confidence}**.

1. **Selection must be an overlay, never a stroke override (fixes ask #7).**
   *Evidence:* live measurement on app.diagrams.net — a selected red edge rendered five paths
   (`white` hit clone, authored `#ff0000`, authored arrowhead, and a *separate* `#00a8ff`
   `stroke-dasharray="3 3"` overlay ×2); driven to `#00cc00` while selected, the authored body and
   arrowhead both followed immediately and the `#00a8ff` overlay stayed put. Mechanism:
   `mxEdgeHandler.createSelectionShape` sets `shape.stroke = this.getSelectionColor()` on a
   *separate* shape on the overlay pane —
   https://github.com/jgraph/drawio/blob/dev/src/main/webapp/mxgraph/src/handler/mxEdgeHandler.js
   (also `EDGE_SELECTION_DASHED: true`, mxConstants.js ~441).
   *Interaction:* none changes — the point is that nothing changes visually except an added dashed
   outline, on any device, selected or not. No hover needed.
   *Data-model cost:* **zero.** Delete the `!important` stroke rule at `styles.css:1217` and instead
   render the existing edge path a second time (dashed, selection token) when `selected`, or add a
   sibling `<path>` inside `GoblinEdge`. No new field, no new hex — use an existing token.
   *Confidence:* **high** — source + live measurement agree.

2. **Double-click on the line body (not on an existing label) creates a label *at that point* (ask #4).**
   *Evidence:* draw.io docs — "Double click on the connector at the position you want to add a text
   label" (https://www.drawio.com/docs/manual/text/labels-add/); source `Graph.insertTextForEvent`
   explicitly excludes the case where the click was inside `state.text.boundingBox` before calling
   `addText(pt.x, pt.y, state)`
   (https://github.com/jgraph/drawio/blob/dev/src/main/webapp/js/grapheditor/Graph.js).
   *Interaction:* double-tap on touch is the documented equivalent
   (https://www.drawio.com/docs/tutorials/touch-screen-diagrams/) — so this works on phone/tablet
   without hover.
   *Data-model cost:* **low.** Add `labelOffset?: number` (0..1 along the path) to edge data; set it
   from the double-click hit position on the path. Default when set elsewhere: `0.5`.
   *Confidence:* **high** — this is draw.io's shipped behaviour, documented twice.

3. **Free-drag the label with a real grab handle; do not offer an along-the-line position preset (asks #1, #6).**
   *Evidence:* draw.io docs — "select the label by clicking on it, then drag the **diamond grab
   handle** to a new position" (https://www.drawio.com/docs/manual/connectors/connector-labels/);
   source `mxEdgeHandler.moveLabel` writes `geometry.x` (fraction along the path) + `geometry.y`
   (perpendicular px) + `geometry.offset`, via `mxGraphView.getRelativePoint` which projects onto the
   nearest path segment. The 9-value `Position` dropdown that draw.io *does* ship writes
   `labelPosition`/`verticalLabelPosition`, which the renderer **ignores for edges**
   (`updateVertexLabelOffset` is vertex-only) — draw.io's own manual concedes it: "Connector labels
   aren't realigned to the connector itself, but to the anchor diamond"
   (https://www.drawio.com/docs/manual/text/text-alignment/).
   *Interaction:* drag the label (or its handle) anywhere; no snapping, no slots, no hover required —
   but the tablet constraint applies: **on touch, the drag target must be the label itself**, because
   draw.io's own `initBend` sets `pointer-events: none` on the handle under touch
   (mxEdgeHandler.js ~796). Flagged: a handle-only drag is desktop-only.
   *Data-model cost:* **low.** `labelOffsetX` (0..1) + `labelOffsetY` (px) replace the existing
   `offset: 'center'|'start'|'end'`. Persisted floats; survives re-routing the same way draw.io's do.
   *Confidence:* **high** on the mechanism and on "no preset needed"; the live drag itself is
   [UNVERIFIED] (CDP timeout) — see §9.

4. **Label background: default transparent, adjustable, with an explicit "none" (ask #2).**
   *Evidence:* draw.io docs — a `Background Color` colour option with a checkbox in the Text tab
   (https://www.drawio.com/docs/manual/styles/text-styles/); live measurement — absent ⇒
   `rgba(0,0,0,0)`, `labelBackgroundColor=none` ⇒ `rgba(0,0,0,0)`, `#ffffffe0` ⇒
   `rgba(255,255,255,0.88)`, `#ffff88` ⇒ `rgb(255,255,136)`. `labelBackgroundColor` /
   `labelBorderColor` / `labelPadding`, with padding auto-hidden when neither background nor border is
   set (Format.js ~5357).
   *Interaction:* a swatch + an on/off checkbox, i.e. exactly the existing `swatchRow`/`ToggleRow`
   kit — no new control type. Transparent is one click (uncheck), and it is also the default.
   *Data-model cost:* **very low.** `labelBg?: 'none' | <token>`; absent = transparent. If a partly
   transparent white is wanted, express it with `color-mix(in srgb, var(--surface) 88%, transparent)`
   rather than a new hex.
   *Confidence:* **high** — measured, and the default differs from Diagram Studio's current
   `background: var(--surface)`.

5. **Make "Flow Animation" a single boolean, and keep the dash pattern as a *separate* control (ask #10).**
   *Evidence:* live measurement — one edge with `flowAnimation=1;dashPattern=8 8` rendered
   `{stroke:"#ff0000", dash:"8 8", anim:"500ms linear 0s infinite norma…"}` on the line body and
   `anim:""` on the arrowhead: the two compose, they are not alternatives.
   `isFlowAnimationEnabled` only checks `flowAnimation == '1'`
   (https://github.com/jgraph/drawio/blob/dev/src/main/webapp/js/grapheditor/Graph.js ~16478).
   Docs: https://www.drawio.com/docs/manual/connectors/connector-animate/ and
   https://www.drawio.com/docs/manual/styles/connector-animation-styles/.
   *Interaction:* one toggle. draw.io's *docs* additionally offer an "Animation Pattern" dropdown
   beside it (https://www.drawio.com/docs/manual/styles/disable-animations/) — **do not ship that**;
   it is the duplication to avoid. One dash-pattern row, one animation toggle, and (optionally)
   duration/timing/direction as three properties.
   *Data-model cost:* **zero.** Diagram Studio already has `flow`, `flowIcon`, `flowCount`,
   `flowDuration`. The deduplication is a deletion, not an addition.
   *Confidence:* **high** — measured; and the "which is duplicated" answer is settled empirically.

6. **Add a global "Animations off" switch that does not touch the document.**
   *Evidence:* draw.io docs — "Select View > Animations … **This does not disable the flow animation
   style on the connectors, only the visual effect in your browser window**", with the stated reason
   "Animations also consume additional device resources and if there are many in a diagram, they may
   slow down the editor" (https://www.drawio.com/docs/manual/styles/disable-animations/).
   *Interaction:* a setting, not a per-edge control.
   *Data-model cost:* **zero** — a UI/editor setting. On a phone this is the difference between a
   shared diagram being usable and not.
   *Confidence:* **high** — documented; this is the strongest answer to the touch constraint on the
   animation axis.

7. **Name the two arrowhead controls "Line Start" / "Line End" — not "head start / head end" (ask #9).**
   *Evidence:* draw.io's shipped resource bundle, verbatim: `linestart=Line Start`,
   `lineend=Line End` (https://github.com/jgraph/drawio/blob/dev/src/main/webapp/resources/dia.txt
   lines 569/571), used as both the visible row labels and the input titles
   (Format.js ~7165-7185); live confirmation — four inputs carried `title="Line Start"` /
   `title="Line End"` under a `Size` row and a `Spacing` row. No mature tool I could verify uses
   "head".
   *Interaction:* two labelled controls above/below the numeric rows — a pure string change.
   *Data-model cost:* **zero** — labels only.
   *Confidence:* **high** — verbatim primary string, live-confirmed.

8. **Ship the arrowheads as two icon-menu buttons at a fixed width rhythm (asks #8, #9).**
   *Evidence:* draw.io builds them with `ui.toolbar.addMenu` (a button + `geAdaptiveAsset geArrow`
   chevron + an icon grid), sized `style.width = '67px'; style.marginRight = '2px'` for all five
   connector-row buttons, with `pattern` at `142px` (Format.js ~6837, ~6953, ~7085-7100). Each menu
   item writes arrow **and** fill together (`[STYLE_STARTARROW, 'startFill']`) — Format.js ~6890-7040.
   The whole-row content width is a constant 216 px (`addUnitInput`).
   *Interaction:* button opens a menu of large icon targets — good on touch, no hover needed. Buttons
   for bold/italic/underline/vertical prove draw.io *does* use segmented button rows for booleans —
   so this is a real precedent, just not for style values.
   *Data-model cost:* **low** — reuse `IconPickerRow`, no new field; the cost is layout CSS using
   `calc()` against the panel width, i.e. no new hex.
   *Confidence:* **medium-high** on the pattern (source + live); **explicitly NOT evidence-based** is
   the general claim "mature tools use button rows for line style" — draw.io uses `<select>` there
   (§3.2, §8.5). Justify buttons on first-time-user discoverability, not on draw.io.

9. **Separate "corner treatment" (3 values) from "routing" (7 values), instead of one `shape` field (asks #5, #6, #8).**
   *Evidence:* draw.io `Line style` is exactly `['sharp','rounded','curved']` writing the mutually
   exclusive pair `rounded`/`curved` in one model update (Format.js ~6528-6580); routing is a
   separate `Waypoints` menu writing `edgeStyle` + `elbow` + `curved` + `noEdgeStyle` (+ optional
   `libavoidRouting`), with `straight / orthogonal / libavoid / horizontal-elbow / vertical-elbow /
   isometric / curved / entityRelation` (Format.js ~6791-6830). Docs describe them as two different
   things (https://www.drawio.com/docs/manual/styles/connector-styles/, and Waypoints at
   .../connectors/waypoints-connectors/).
   *Interaction:* one 3-way button row (or `<select>`) for corners, one picker for routing. These are
   the two axes behind "Intent label" and "Label position" feeling redundant (asks #5, #6): the
   conflation, not the field names, is the problem.
   *Data-model cost:* **medium** — `GoblinEdge`'s `shape` splits into `routing` + `corners` (and the
   four RF generators map as `straight→routing:straight`, `step→routing:step, corners:sharp`,
   `smoothstep→routing:step, corners:rounded`, `bezier→routing:curved`). Migration is mechanical but
   touches `GoblinEdge.tsx` and any persisted diagrams.
   *Confidence:* **medium-high** on the model; **medium** on whether the split is worth the migration
   right now.

10. **Ship a "Reverse line direction" action.**
    *Evidence:* draw.io ships it as a button in the **Arrange** tab — "Your connector ends and their
    labels will be swapped, but the path of the connector will not be changed"
    (https://www.drawio.com/docs/manual/connectors/connector-reverse/).
    *Interaction:* one button; no drag, no hover.
    *Data-model cost:* **very low** — swap `source`/`target` in `updateEdge`; the label's
    `labelOffset` must be mirrored (`o → 1 - o`) to keep "your labels swap with the ends" true.
    *Confidence:* **high** — documented, and it is a one-line data operation.

11. **Consider line jumps (`jumpStyle`) last — the highest-value "missing utility", but the priciest.**
    *Evidence:* draw.io ships `jumpStyle` as a 5-value `<select>`
    (`none / arc / gap / sharp / line`) plus a `jumpSize` numeric defaulting to 6, behind a
    collapsible "Line Jumps" section, with a per-edge `noJump` opt-out and a global
    `Graph.lineJumpsEnabled` (Format.js ~7376-7466; Graph.js 1603/1608; docs
    https://www.drawio.com/docs/manual/styles/connector-styles/). Rationale it is worth having: two
    crossing connectors otherwise read as a junction.
    *Interaction:* one dropdown — the easiest control on this whole list for a first-time user, and
    touch-safe.
    *Data-model cost:* **high.** `jumpStyle` is cheap to *store* (`jumpStyle?: 'none'|'arc'|'gap'|
    'sharp'`), but React Flow has no jump rendering: `GoblinEdge` would have to split its own path at
    crossings and emit arcs/gaps — real geometry work against every other edge's path, with no library
    support. **Recommendation: store the value now, render later**; do not let it block items 1-10.
    *Confidence:* **high** on the requirement (documented + source); **medium** on effort — I did not
    prototype the path-splitting.

12. **Do not add hint text (ask #3); do add tooltips.**
    *Evidence:* the live Format panel for a selected edge contained **no sentence-length strings** —
    only control labels. draw.io conveys the extra information via `title` attributes on the row and
    the control (e.g. `startSize.setAttribute('title', mxResources.get('linestart'))`, Format.js
    ~7180) and via a one-line `**Tip:**` in its *docs*, never in the panel.
    *Interaction:* hover tooltips on desktop; on touch, the label itself must be self-explanatory —
    which is the argument for item 7's explicit wording.
    *Data-model cost:* **zero** — deletion.
    *Confidence:* **high** — measured absence of prose in the panel.

13. **Use an 8-digit-hex-style token for partial transparency instead of `opacity` on the label.**
    *Evidence:* draw.io expresses "white box, slightly see-through" as `labelBackgroundColor=#ffffffe0`
    (measured → `rgba(255,255,255,0.88)`) and separately keeps a `textOpacity` / `Stroke Opacity` /
    `Fill Opacity` family (measured in the Property table; `textOpacity=100` appears in draw.io's own
    generated link-preview styles, Graph.js ~3066). The background stays a *colour* value; the
    element's opacity stays a *separate, whole-element* value.
    *Interaction:* one control (the label-background swatch), not two.
    *Data-model cost:* **zero** extra field if the background is already a token —
    `color-mix(in srgb, var(--surface) 88%, transparent)` satisfies the 160-hex ceiling in
    `src/styles.css`.
    *Confidence:* **medium-high** — measured values, but the "colour, not opacity" split is an
    inference from draw.io's two parallel mechanisms rather than a single citable rule.

---

### Files written

- `/home/harvey/diagram-studio-research/edge-utilities/C1-drawio.md` (this file). Nothing under `src/`
  was touched. All scratch working files (fetched draw.io sources, `dia.txt`, test-diagram URL
  payloads) live in `/home/harvey/.hermes/cache/scratch/c1/` and totalled **2.6 MB**; no repository was
  cloned (`curl` of individual raw files only).
