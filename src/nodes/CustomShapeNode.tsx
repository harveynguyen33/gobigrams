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
import {memo} from 'react';
import {Handle, NodeResizer, Position, type NodeProps} from '@xyflow/react';
import {svgDataUri, SHAPE_MIN_PX} from './customShape';
import {resolveColor} from '../colors';
import type {ColorKey} from '../colors';

export type CustomShapeKind = {
  svg: string;          // the sanitised inline SVG markup (CustomShape.data)
  viewBox: string;
  title: string;
  colorKey: ColorKey;
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
      style={{'--nc': nc} as React.CSSProperties}
    >
      {selected && (
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
           the box). */
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
