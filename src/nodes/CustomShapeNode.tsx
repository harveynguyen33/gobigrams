/* PACKAGE-N §8.1–§8.3 pass 4b — THE CUSTOM-SHAPE NODE KIND.
 *
 * A user-imported SVG is a NODE KIND, not a shape. The `Shape` union stays at
 * 19 (`src/nodes/shapes.ts`); this file never adds a 20th member to it. React Flow
 * dispatches on `node.type`, so `customshape` is registered in `nodeTypes`
 * beside `goblin` / `label` / `table` and the node carries its own renderer.
 *
 * THE ONE-SENTENCE RULE — THE MARKUP IS NEVER HANDED TO THE DOM AS HTML.
 * There is no HTML-injection sink anywhere in this file: no element-property
 * assignment, no `dangerously*` React prop, no fragment parsing. The user's SVG
 * reaches the canvas ONLY as `<img src={svgDataUri(d.svg)}>`.
 * `src/nodes/customShape.ts` sanitises the markup (DOMPurify SVG profile + its own
 * scrub pass), and the `data:image/svg+xml,` context is the SECOND line of
 * defence: scripts are disabled and external resources cannot load there. Those
 * are two independent guards, so the markup is never injected as live DOM.
 * Anything that renders it as DOM throws both away at once.
 *
 * * No ShapeFrame here: the user's SVG *is* the artwork. Painting an app
 * shape behind it would show through any transparent area of the import.
 *
 * ROUND BG, item B (2026-10-24) — REVERSED: custom shapes DO get connection
 * handles now. Harvey: "custom shapes đang không có mối nối, thêm vào". The
 * original "imported artwork is not a box to wire up" reasoning is recorded
 * here as history: the node IS a box on the canvas (it resizes like one,
 * exports as one), so the four midpoints are exactly as wireable as a
 * goblin node's. This file now mirrors `NodeHandles` (src/nodes/DiagramNode.tsx)
 * — the same four ids ('left'/'right'/'top'/'bottom'), the same
 * all-SOURCE scheme (so App.tsx's GOBLIN_HANDLE_IDS direction guard and the
 * `gobi:handle-connect` dblclick auto-connect apply to custom shapes too),
 * the same `.react-flow__handle` styling hooks (styles.css styles every
 * handle through the class — hover reveal, 12px dot, z-index 5 above
 * NodeResizer's grips). The handles sit on the BOX edge (the node box), not
 * the letterboxed art — same geometry a goblin node's handles paint at.
 * Handles are app chrome: the SVG exporter never rendered them for goblin
 * nodes and does not for custom nodes either (checked: exportSvg.ts's
 * customshape branch inlines rawSvg only).
 *
 * ITEM 2b (2026-09-18) — NO AUTO-SHOW ACTION STRIP ON THIS KIND EITHER. The
 * floating strip that used to appear above a selected import is gone, exactly as
 * `src/nodes/DiagramNode.tsx` documents it (that file carries the full reasoning and
 * the button-by-button mapping to the surviving hot keys / context-menu rows).
 * Its only reader here was the `__toolbar` slot, so the slot, the
 * `ToolbarActions` type it was derived from, the `LabelKind` import that fed the
 * derivation, the icon imports and the two unused React Flow imports all went
 * with it — and `App.tsx` no longer injects the value.
 */
import {memo, useEffect, useState} from 'react';
import {Handle, NodeResizer, Position, type NodeProps} from '@xyflow/react';
import {paintRotation, rotateTransform} from '../canvas/rotation';
import {InlineTitle} from '../components/InlineTitle';
import {svgDataUri, SHAPE_MIN_PX} from './customShape';
import {resolveColor} from '../theme/colors';
import type {ColorKey} from '../theme/colors';

export type CustomShapeKind = {
  svg: string;          // the sanitised inline SVG markup (CustomShape.data)
  viewBox: string;
  title: string;
  colorKey: ColorKey;
  /** ROUND ROTATE — geometry rotation (absent = 0). CHROME-ABOVE
   *  (t_31a9bec9): the grip writer tokens are gone — the grip renders in
   *  App's NodeChrome and calls the rotation writer directly. */
  rotation?: number;
};

/* The goblin node's scheme, verbatim (DiagramNode's handleDblClick +
   NodeHandles): every handle is a SOURCE, so a drag builds the edge the way
   the user drew it and App.tsx's GOBLIN_HANDLE_IDS direction guard covers
   this kind too. Same ids, so dblclick auto-connect works from an imported
   shape as well. */
function handleDblClick(nodeId: string) {
  return (handleId: string) => (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    window.dispatchEvent(new CustomEvent('gobi:handle-connect', {detail: {nodeId, handleId}}));
  };
}

const CustomShapeNode = memo(({id, data, selected}: NodeProps) => {
  const d = data as unknown as CustomShapeKind;
  /* INLINE-TITLE (t_cb9335df) — an imported shape's TITLE is edited in place
     too. Unlike a goblin card there is no title element to host the handler —
     the import paints only the <img> — so the gesture sits on the ROOT, and
     the root's children include the four HANDLES: the target carve-out below
     is what keeps a handle double-click on its auto-connect meaning (and the
     grips, if selected, their resize meaning). The editor overlays the whole
     box; the img sits under it. F2 arrives the same way as on a goblin, via
     App's render-injected `__editTitle` token. */
  const [editTitle, setEditTitle] = useState(false);
  useEffect(() => { if ((d as any).__editTitle) setEditTitle(true); }, [(d as any).__editTitle]);
  const openTitleEdit = (e: React.MouseEvent) => {
    /* NEVER swallow a handle / resize-grip double-click (the card's A6).
       CHROME-ABOVE (t_31a9bec9): the rotate grip and desc badge are no
       longer descendants of this root (they render in the top layer), so
       the carve-out covers the in-node surfaces only. */
    if (e.target instanceof Element
      && e.target.closest('.react-flow__handle, .react-flow__resize-control')) return;
    e.stopPropagation();
    /* Review/stale lock, incl. the unselected-node case — see DiagramNode. */
    if ((d as any).readOnly || e.currentTarget.closest('.ds-read-only')) return;
    setEditTitle(true);
  };
  /* ROUND BF (2026-10-23) — `--nc` reaches this node kind (wired then for
     BF-1's at-rest ring). ROUND BF-2 (2026-10-24) INVERTED the ring: the
     at-rest outline is gone and `.custom-shape-node.selected` now paints the
     box-shadow ring in var(--sel) instead (see styles.css), so the selected
     import reads as a selected box like every other shape. The --nc wiring
     STAYS: the connect-handle hover emphasis and the node-ico tokens still
     theme with the node's own colourKey. */
  const nc = resolveColor(d);
  const onHandleDblClick = handleDblClick(id);
  return (
    <div
      className={`custom-shape-node${selected ? ' selected' : ''}`}
      data-shape-title={d.title}
      onDoubleClick={openTitleEdit}
      style={{'--nc': nc, ...(rotateTransform(paintRotation(d as {rotation?: number})) ? {transform: rotateTransform(paintRotation(d as {rotation?: number}))!} as React.CSSProperties : {})} as React.CSSProperties}
    >
      {editTitle && (
        <InlineTitle
          key={String((d as any).__editTitle ?? 'dbl')}
          value={d.title ?? ''}
          onCommit={v => { setEditTitle(false); if (v.trim()) (d as any).onCommitTitle?.(id, v); }}
          onCancel={() => setEditTitle(false)}
        />
      )}
      {/* CHROME-ABOVE (t_31a9bec9): the rotate grip renders in App's
          NodeChrome (top layer), not in the card's stacking context. */}
      {selected && !(d as {__review?: boolean}).__review && !(d as any).__locked && (
        /* §8.3 — the live resize carries the same 32px floor the import path
           enforces, and NO ceiling: ROUND BE (2026-10-23, Harvey: resize
           should behave like normal shapes) removed maxWidth/maxHeight so the
           custom kind matches DiagramNode / LabelNode, whose NodeResizer
           mounts without a cap. The 512 import window stays only in the
           IMPORT path's clampShapeSize (customShape.ts) as a sanity default
           for the freshly dropped box — it is not a live bound any more, and
           this file must not reference it (asserted by round-5 7d). AUDIT-15
           correction still holds: the resizer carries NO aspect lock — the
           node box can take any ratio. The artwork itself cannot distort
           (the <img> below is object-fit: contain, so it letterboxes inside
           the box). BADGE-ON-SELECT (t_e1ad9237): `readOnly` gates the
           handles off in review mode, which now allows sole selection. */
        <NodeResizer
          minWidth={SHAPE_MIN_PX}
          minHeight={SHAPE_MIN_PX}
          lineClassName="resize-line"
          handleClassName="resize-handle"
        />
      )}
      {/* The ONLY render path for imported markup — an <img>, never DOM. */}
      <img
        src={svgDataUri(d.svg)}
        alt={d.title}
        draggable={false}
        style={{width: '100%', height: '100%', objectFit: 'contain', pointerEvents: 'none'}}
      />
      {/* ROUND BG, item B — the four midpoints of the BOX (the node box, not
          the letterboxed art), the goblin node's scheme verbatim: same ids,
          all SOURCE, same class styling (hover reveal, 12px dot, z-index 5
          above the resizer grips). App.tsx's direction guard keys on these
          ids via GOBLIN_HANDLE_IDS, so a custom-shape drag is normalised the
          same way a goblin drag is. */}
      <Handle type="source" id="left" position={Position.Left} onDoubleClick={onHandleDblClick('left')} />
      <Handle type="source" id="right" position={Position.Right} onDoubleClick={onHandleDblClick('right')} />
      <Handle type="source" id="top" position={Position.Top} onDoubleClick={onHandleDblClick('top')} />
      <Handle type="source" id="bottom" position={Position.Bottom} onDoubleClick={onHandleDblClick('bottom')} />
    </div>
  );
});

export default CustomShapeNode;
