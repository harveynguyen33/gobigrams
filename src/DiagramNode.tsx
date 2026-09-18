import {memo} from 'react';
import {Handle, NodeResizer, Position, type NodeProps} from '@xyflow/react';
import {lucideByName} from './lucideIcons';
import {asShape, ShapeFrame, type Shape as NodeShape} from './shapes';
import {resolveColor, type ColorKey} from './colors';

/** Shapes that are resizable — I5: every shape in SHAPES can be resized in
 *  both directions; the .node body fills the RF wrapper, so any width/height
 *  set by the resizer is honoured. L3a adds the ISO 5807 set. */
export const RESIZABLE = new Set<NodeShape>([
  'service', 'database', 'queue', 'external', 'actor', 'storage', 'gateway', 'group', 'note',
  'terminator', 'process', 'decision', 'io', 'document', 'subprocess', 'preparation', 'manual', 'delay', 'connector',
]);

/** K5: only these shapes get the "post-it" surface (rotation, gradient,
 *  folded corner, icon watermark). A rotated gradient card on service /
 *  database / queue / gateway would fight the architecture-diagram language. */
const POSTIT = new Set<NodeShape>(['actor', 'note']);

/** L3a: handle orientation. A flowchart reads top-to-bottom, and a diamond with
 *  only left/right ports physically cannot express "Yes ↓ / No →". */
export type HandleMode = 'lr' | 'tb';

export type NodeKind = {
  kicker: string;
  title: string;
  sub?: string;
  metric?: string;
  metricUnit?: string;
  /** kebab-case lucide icon name ("server") or a raw unicode glyph ("◆"). */
  icon?: string;
  /** Symbolic accent key — resolved per theme at render time (L1). */
  colorKey?: ColorKey;
  /** Literal user-typed hex (the "custom…" escape hatch). Keys win. */
  color?: string;
  /** Architectural shape — generic notation, not a use case. */
  shape?: string;
  /** L3a: 'tb' renders Top(target)/Bottom(source) ports instead of Left/Right. */
  handles?: HandleMode;
  /** L3a: 'label-only' renders one centered sentence, no kicker/sub/metric. */
  body?: 'card' | 'label-only';
  /** L3b: C4 element type — drives kicker/colour on the preset palette. */
  c4Type?: string;
  /** L3b: C4 relationship technology, rendered dim after the edge label. */
  techn?: string;
};

/* ITEM 2 (2026-09-17) — THE AUTO-SHOW NODE TOOLBAR IS GONE.

   Harvey: "và tool tip khi chọn các element hiển thị, tôi nghĩ k cần hiện tại. vì
   các cái đó đều có hot key làm được" — the strip that appears when you select an
   element is not needed, because those actions all have hot keys.

   WHAT USED TO BE HERE: `NodeToolbarActions` (onDuplicate / onDelete / onCopy /
   onNote / onFront), injected into every node's `data` as `__toolbar` by App's
   `rfNodes` memo and rendered as a floating `<NodeToolbar>` strip above a
   selected node by `<Toolbar>`. Removed across all three node kinds.

   NO CAPABILITY WAS LOST — every one of the six buttons already had a second
   route, verified against the real handlers:

     toolbar button          non-toolbar route
     ----------------------  ------------------------------------------------
     Duplicate  (Copy)       ⌘/Ctrl+D — App.tsx:2420 `duplicateSelection()`
                             ALSO the node context menu → "Duplicate"
     Copy (ClipboardCopy)    ⌘/Ctrl+C — App.tsx:2418 `copySelection()`
                             ALSO the node context menu → "Copy"
     Add note   (StickyNote) node context menu → "Add note here"
     Bring to front          node context menu → "Bring to front"
                             (and "Send to back", which the toolbar never had)
     Connection hint (Link2) DEAD BUTTON — it called `actions.onNote(id)`, i.e.
                             literally the same handler as the note button beside
                             it. Not a capability, so nothing to preserve; the
                             connection hint is what you get from the note.
     Delete     (Trash2)     Del / Backspace — App.tsx:3568 `deleteKeyCode`
                             ALSO the node context menu → "Delete" (danger)

   The context menu (`ContextMenu.tsx`, opened by right-click / long-press) is
   the documented home for the four that needed one, and it already listed all of
   them before this pass — nothing had to be added to it. */

/**
 * One generic node. `data.shape` selects the notation
 * (service / database / … / terminator / process / decision / …),
 * and every shape takes its outline, icon, metric and glow from the node's
 * accent — a symbolic key, resolved to `var(--c-*)` here so the theme cascades.
 */
export function IconGlyph({icon, size = 17}: {icon?: string; size?: number}) {
  const Ico = lucideByName(icon);
  if (Ico) return <Ico size={size} />;
  return <span className="glyph">{icon}</span>;
}

/**
 * G — the 4-point connection scheme. Every node exposes the four EDGE
 * MIDPOINTS only, and every one of them is a SOURCE handle.
 *
 * Why source-only. React Flow resolves the drag ORIGIN with
 * getHandleType(undefined, handleBelow), which reads the source / target CLASS
 * of the handle under the pointer, then builds the connection as
 *   source: isTarget ? handleNodeId : fromNodeId
 *   target: isTarget ? fromNodeId : handleNodeId
 * so landing on a target-classed handle makes the node the user dragged FROM
 * the edge's TARGET and the arrowhead stays behind on it. With a source handle
 * at every site the origin is always a source, so the edge is always built in
 * the direction the user drew it. App.tsx's onConnect carries a second guard.
 *
 * Four points, not eight. The four corner sites (and the four duplicated
 * mirror handles) are gone: a corner was reachable only through CSS offsets,
 * it doubled the dot count, and the four midpoints are what Harvey asked for.
 * A board that still stores a corner id in sourceHandle / targetHandle is
 * re-aimed onto the nearest surviving side by migrateEdge in App.tsx, not by a
 * handle that still exists here.
 *
 * B1 compatibility. The ids, positions and DOM order are exactly what B1 and
 * B2 already wrote into stored boards — left / right / top / bottom — so an
 * existing edge resolves to the pixel it always did. Under ConnectionMode.Loose
 * (App.tsx) a source handle serves BOTH ends of an edge, so a stored
 * `targetHandle: 'left'` still resolves: React Flow looks the target endpoint
 * up against the target bounds concatenated with the source bounds.
 *
 * All four are the SAME 12px dot; size, reveal and z-index are unchanged.
 */
function NodeHandles() {
  return (
    <>
      {/* The four edge midpoints — every one a SOURCE handle (see above). */}
      <Handle type="source" id="left" position={Position.Left} />
      <Handle type="source" id="right" position={Position.Right} />
      <Handle type="source" id="top" position={Position.Top} />
      <Handle type="source" id="bottom" position={Position.Bottom} />
    </>
  );
}

const Node = memo(({id, data, selected}: NodeProps) => {
  const d = data as unknown as NodeKind;
  const shape = asShape(d.shape);
  const nc = resolveColor(d);

  // Container shapes get React Flow's resize affordance when selected (C3).
  // React Flow writes width/height back into node.style, so the size persists.
  const resizer = selected && RESIZABLE.has(shape) ? (
    <NodeResizer
      minWidth={140}
      minHeight={80}
      lineClassName="resize-line"
      handleClassName="resize-handle"
    />
  ) : null;

  // K5 — post-it chrome, applied ONLY to actor / note.
  const postit = POSTIT.has(shape) ? (
    <>
      <span className="ds-postit-fold" aria-hidden="true" />
      {d.icon && (
        <span className="ds-postit-mark" aria-hidden="true">
          <IconGlyph icon={d.icon} size={30} />
        </span>
      )}
    </>
  ) : null;

  if (shape === 'note') {
    return (
      <div
        className={`note-node${selected ? ' selected' : ''}`}
        style={{'--nc': nc} as React.CSSProperties}
      >
        {resizer}
        <NodeHandles />
        {postit}
        {d.kicker && <div className="node-kicker">{d.kicker}</div>}
        {d.title && <div className="note-title">{d.title}</div>}
        {d.sub && <div className="node-sub">{d.sub}</div>}
      </div>
    );
  }

  if (shape === 'group') {
    // K5: 44px header banner + a 32px circular icon badge overlapping above it.
    return (
      <div className={`group-node${selected ? ' selected' : ''}${d.icon ? ' has-badge' : ''}`} style={{'--nc': nc} as React.CSSProperties}>
        {resizer}
        <NodeHandles />
        <div className="group-head" aria-hidden="true" />
        {d.icon && (
          <span className="group-badge" aria-hidden="true"><IconGlyph icon={d.icon} size={16} /></span>
        )}
        <div className="group-label">
          <span>{d.title}</span>
          {d.sub && <small>{d.sub}</small>}
        </div>
      </div>
    );
  }

  // L3a: label-only body — one centered sentence, no kicker / sub / metric.
  if (d.body === 'label-only') {
    return (
      <div
        className={`node shape-${shape} label-only${selected ? ' selected' : ''}`}
        style={{'--nc': nc} as React.CSSProperties}
      >
        {resizer}
        <NodeHandles />
        <ShapeFrame shape={shape} />
        {postit}
        <div className="node-body lo-body">
          <div className="lo-title">
            {d.icon && <span className="node-ico"><IconGlyph icon={d.icon} /></span>}
            <span>{d.title}</span>
          </div>
          {d.sub && <div className="lo-sub">{d.sub}</div>}
        </div>
      </div>
    );
  }

  return (
    <div className={`node shape-${shape}${selected ? ' selected' : ''}`} style={{'--nc': nc} as React.CSSProperties}>
      {resizer}
      <NodeHandles />
      <ShapeFrame shape={shape} />
      {postit}
      <div className="node-body">
        {d.kicker && <div className="node-kicker">{d.kicker}</div>}
        <div className="node-title">
          {d.icon && <span className="node-ico"><IconGlyph icon={d.icon} /></span>}
          <span>{d.title}</span>
        </div>
        {d.sub && <div className="node-sub">{d.sub}</div>}
        {d.metric && (
          <div className="node-metric">
            {d.metric}
            {d.metricUnit && <small>{d.metricUnit}</small>}
          </div>
        )}
      </div>
    </div>
  );
});

export default Node;
