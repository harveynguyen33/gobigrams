import {memo} from 'react';
import {Handle, NodeResizer, Position, type NodeProps} from '@xyflow/react';
import {lucideByName} from './lucideIcons';
import {asShape, ShapeFrame, type Shape as NodeShape} from './shapes';
import {resolveColor, type ColorKey} from './colors';
import {textStyleVars, alignForBody, type TextStyle} from './textStyle';

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

/* ROUND S (2026-09-18) — THE RESIZER FLOORS ARE RAISED TO THE CONTENT FLOOR.

   THE DEFECT: this file's resizer said `minWidth={140} minHeight={80}` while
   `styles.css` gives `.node` a `min-width: 190px`. The two floors DISAGREED, so
   a node could be dragged to 140x80 while its own `.node` refused to shrink past
   190 wide — and `.node` and `.node-body` BOTH carry `overflow: visible`, so the
   text simply painted OUTSIDE the node's border.

   MEASURED on the running app (local px, zoom-independent — the wrapper size and
   the min-width floor stripped, layout settled, then read after a frame wait,
   because a synchronous read of a ResizeObserver-updated box is STALE):

     shape      natural content      spill at a smaller wrapper
     ---------  ------------------  ------------------------------------------
     external   168 x 114           wrapper 124 vs inner 139  -> +15px H
     queue      199 x 131           wrapper 102x96 vs 139x107 -> +37px H, +11px V
     service    183 x 114           wrapper 139x83 vs 139x83  -> none

   At a narrow width the text DOES wrap (no horizontal spill at 139), so the
   acute half of the defect is VERTICAL: `queue` needs ~131px and the old floor
   allowed 80.

   THE FIX (Harvey's option 1.a): raise the floors. `min-width: 190px` STAYS. No
   ellipsis, no clipping.

   THE INVARIANT THIS FILE NOW HOLDS TO — the resizer floor must NEVER be smaller
   than the CSS content floor. `NODE_MIN_W` is therefore DERIVED FROM
   `CSS_CONTENT_MIN_W`, which is the number `.node { min-width }` declares in
   `src/styles.css`, instead of a third number invented here; the harness reads
   BOTH sides and fails if they drift apart.

     HORIZONTAL — CSS_CONTENT_MIN_W (190) + the 10px slack below = 200.
     The slack is not decoration: the tallest natural CONTENT measured across the
     shapes that share this resizer is `queue` at 199px, i.e. 9px WIDER than the
     CSS floor, so the CSS floor ALONE would still clip it. 200 is the first value
     that clears both sources — 10px above the CSS floor, 1px above the worst
     measured content, and above the other two (168, 183).

     VERTICAL — there is no vertical CSS content floor to derive from (`.node`
     declares only `min-height: 100%`, a FILL rule, not a content floor), so the
     floor comes from the worst-case measured CONTENT: `queue` at 131px, which is
     the `.node.shape-queue .node-body` padding (30px top + 16px bottom) plus its
     kicker + title + sub. 131 + the same 10px slack = 141. Every other measured
     shape is shorter and so covered: 114, 114.

   WHY THE SPILL IS NOW UNREACHABLE, IN ONE SENTENCE: React Flow's resizer computes
   `getSizeClamp(newWidth, minWidth, …) = max(0, minWidth - newWidth, …)` and folds
   it into the drag delta, so the width it writes back can never be under 200 (and
   likewise 141 vertically) — at or above every shape's natural content size AND
   above `.node`'s own 190px CSS floor, which therefore can never bind.

   WHAT THIS FLOOR DOES NOT COVER — `note` and `group`, the other two shapes in
   RESIZABLE. The measurement above covers `external` / `queue` / `service`; the
   floor is the worst of those three and is applied to the whole shared resizer.
   A separate floor for `group` (its `.group-head` banner is 44px and the class
   itself declares NO min-height, so it can still be dragged to a 10px wrapper)
   and for `note` would need per-shape values that were not measured here — so it
   is left as the honest residue rather than a second invented number. `note`'s
   CSS `min-width: 120px` (styles.css) still floors its WIDTH; `addNodeByLabel`'s
   90px default height is only reachable at insert time and is not a drag. */
/** `.node { min-width }` as declared in `src/styles.css`. Mirrored here for one
 *  reason: so the floor below can be EXPRESSED FROM it rather than invented
 *  beside it. `checks/round-r-label-resize.mjs` reads both and asserts they
 *  agree, which is what stops the two numbers drifting apart again. */
export const CSS_CONTENT_MIN_W = 190;
/** Worst-case natural content height measured across the shapes sharing this
 *  resizer — `queue` at 131px (see the header). */
const CONTENT_MIN_H = 131;
/** 10px of slack above the binding floor of each axis, for the reasons in the
 *  header: on W it is what lifts 190 clear of the 199px queue content. */
const FLOOR_SLACK_PX = 10;
/** The resizer floors. 200x141 — see the header for each number's derivation. */
export const NODE_MIN_W = CSS_CONTENT_MIN_W + FLOOR_SLACK_PX;
export const NODE_MIN_H = CONTENT_MIN_H + FLOOR_SLACK_PX;

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
  /** PACKAGE-P §E.2 — the Text section's stored style. OPTIONAL and every field
   *  optional: a board that predates the section has none, and `textStyleVars`
   *  returns `{}` for it, so such a node renders byte-for-byte as it always
   *  did. Nothing here is a size in px — see `src/textStyle.ts` for why `size`
   *  is a SCALE. */
  textStyle?: TextStyle;
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
  /* PACKAGE-P §E.2 — the Text section's custom properties, on the node ROOT.
     ONE object spread covers kicker, title, sub and metric (they all read
     `var(--ts-*)`), and an untouched node contributes no key at all, so the
     sheet's own fallbacks apply and nothing is repainted. Same object literal
     that already carries `--nc`, so no second style attribute is introduced.

     The SECOND argument is the target's own align default: a `label-only`
     node renders `text-align: center` by design, so `center` — not `left` — is
     the value that renders anyway there. `alignForBody` is the single answer
     both this renderer and the panel use, so `mergeTextStyle` can never store a
     choice this function then refuses to paint. */
  const tsVars = textStyleVars(d.textStyle, alignForBody(d.body));

  // Container shapes get React Flow's resize affordance when selected (C3).
  // React Flow writes width/height back into node.style, so the size persists.
  const resizer = selected && RESIZABLE.has(shape) ? (
    <NodeResizer
      minWidth={NODE_MIN_W}
      minHeight={NODE_MIN_H}
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
        style={{'--nc': nc, ...tsVars} as React.CSSProperties}
      >
        {resizer}
        <NodeHandles />
        {postit}
        {/* ROUND V — the text lives in its own box so the root's border can stay
            unclipped: the four connect dots and, when selected, the four resize
            grips are centred ON that border. */}
        <div className="note-body">
          {d.kicker && <div className="node-kicker">{d.kicker}</div>}
          {d.title && <div className="note-title">{d.title}</div>}
          {d.sub && <div className="node-sub">{d.sub}</div>}
        </div>
      </div>
    );
  }

  if (shape === 'group') {
    // K5: 44px header banner + a 32px circular icon badge overlapping above it.
    return (
      <div className={`group-node${selected ? ' selected' : ''}${d.icon ? ' has-badge' : ''}`} style={{'--nc': nc, ...tsVars} as React.CSSProperties}>
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
        style={{'--nc': nc, ...tsVars} as React.CSSProperties}
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
    <div className={`node shape-${shape}${selected ? ' selected' : ''}`} style={{'--nc': nc, ...tsVars} as React.CSSProperties}>
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
