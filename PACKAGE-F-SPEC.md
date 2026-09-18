# Package F — React Flow ADVANCED features (all of them)

Harvey's ask (2026-09-13): "advance feature... làm hết tất cả, kiếm best practice, tự kiểm tra".

Research sources (reactflow.dev/examples, official):
- Context Menu — `onNodeContextMenu` + custom menu component, close on pane click
- Reconnect Edge — `onReconnect` + `reconnectEdge(oldEdge, newConnection, edges)`; `reconnectable` per-edge ('source'|'target'|true|false)
- Node Toolbar — `<NodeToolbar isVisible position align>` — content NOT scaled on zoom
- Sub Flows — `parentId` + `extent: 'parent'`; parent must appear BEFORE children in array; child position is relative to parent; `type:'group'` is the convenience container
- Helper Lines — ⚠️ PRO example (xyflow Pro License). DO NOT copy its code. Implement independently: anchors (left/center/right, top/middle/bottom), snap radius ~6px, render as 1px `--sel` guide lines, one line per orientation max, reset on drop. Respect zoom/pan transform.
- Add Node On Edge Drop, Connection Limit, Drag Handle, Easy Connect, Preventing Cycles, Proximity Connect, Temporary Edges, Floating Edges, Edge Routing, Dynamic Layouting (dagre/elk)

## F1 — Subflows / true grouping
- Palette `Group` shape becomes a real container: created nodes get `parentId` (parent listed first in array), `extent: 'parent'`, `expandParent` when dragging the group.
- Dropping a node INSIDE a group's bounds on drag-stop reparents it (add to group); dragging it out (beyond bounds) removes the parent.
- Group must render behind children (zIndex), keep its dashed boundary + label, be resizable (already has NodeResizer), and dragging the group moves children (React Flow default with parentId).
- Edges between a child and an outside node must keep working.

## F2 — Context menu (right-click)
- `onNodeContextMenu` on nodes and `onEdgeContextMenu` on edges and a pane menu (`onPaneContextMenu`).
- Node menu: Duplicate · Copy · Delete · Bring to front · Send to back · Add note here.
- Edge menu: Edit label (opens the inline editor) · Reverse direction (swap source/target) · Delete.
- Pane menu: Add node (opens search palette at cursor) · Paste · Select all · Fit view.
- Position it so it never leaves the viewport; close on pane click, Escape, or scroll. Style with existing tokens (`.ctx-menu`, `.ctx-item`, `.ctx-sep`, danger variant).

## F3 — Helper lines (alignment guides) — OWN implementation
- While dragging a node, show vertical/horizontal guides when its anchor is within ~6px of another node's anchor; snap the dragged node onto it.
- Anchors: left, horizontal-center, right / top, vertical-middle, bottom.
- Must work correctly under viewport zoom + pan. Max one guide per orientation. Clear on drop.
- Lines: 1px `--sel`, dashed, spanning the canvas.

## F4 — Edge reconnect
- Add `onReconnect` using the `reconnectEdge` helper; keep the custom `goblinEdge` type + all styling (marker/label/flow data) when reconnecting.
- Push history on reconnect (undoable).

## F5 — Node toolbar
- `<NodeToolbar>` above the selected node with compact icon buttons: Duplicate · Delete · Copy · Add connection hint · Bring to front. Not scaled by zoom; styled with existing tokens.

## F6 — Add node on edge drop
- When a connection is dropped on empty canvas, offer to insert a new node at that point wired between the source and the drop point (use `onConnectEnd` + `screenToFlowPosition`).

## F7 — Preventing cycles + connection rules
- Optional toggle: prevent creating a cycle (A→B→A) with a toast explaining why.
- Connection limit: max 1 incoming on target unless the user holds a modifier (configurable const).

## F8 — Dynamic auto-layout
- Add a "Layout" action (toolbar menu) that runs a simple layered layout (implement a small deterministic algorithm — no new dependency if avoidable; if a dependency is truly needed, prefer `@dagrejs/dagre`, MIT) to tidy a messy diagram.
- Must respect existing node sizes and animate positions (~300ms) so it is not jarring.

## F9 — Proximity connect (nice-to-have)
- While dragging a node near another, show a dashed candidate edge on the nearest handle; dropping connects. Keep it subtle and off by default in the toolbar.

## Order of work
F2 (context menu) → F3 (helper lines) → F5 (node toolbar) → F4 (reconnect) → F6 (add-on-edge) → F1 (subflows) → F7 (rules) → F8 (layout) → F9 (proximity).
Rationale: highest perceived value first, and F1 (subflows) is the most invasive (touches node creation + drag handlers) so it goes after the additive ones.

## Rules
- Dark theme, reuse tokens (--bg/#0b0b0d, --surface/#131316, --elevated/#1a1b1f, --border, --border-strong, --fg, --dim, --acc/#f54e00, --sel/#3b82f6).
- English UI. Do not break: undo/redo, box-select, align/distribute, resize, snap toggle, search palette, icon picker, edge inspector + flow animation, tooltips, boards (Package E), import/export.
- tsc exit 0 · vite build exit 0 · self-verify in browser (port 5200) with screenshots/DOM evidence per item.

## G (after F) — genericise before sharing
Two personal strings must become neutral (found 2026-09-13, in App.tsx):
1. `src/App.tsx` (~line 192): first-run seeds a board named **"Kafka rebalance"** → use a neutral name ("Untitled board" / "My first board").
2. `src/App.tsx` (~line 870): the panel header breadcrumb renders **`~/tech-goblin`** → replace with a neutral app tag (e.g. `diagrams`) or remove.
Plus: an empty-state hint on a brand-new board ("Drag a shape from the left, or double-click the canvas to insert one"), and confirm every control is discoverable without docs.

