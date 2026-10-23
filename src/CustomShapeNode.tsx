/* PACKAGE-N §8.1–§8.3 pass 4b — THE CUSTOM-SHAPE NODE KIND.
 *
 * A user-imported SVG is a NODE KIND, not a shape. The `Shape` union stays at
 * 19 (`src/shapes.ts`); this file never adds a 20th member to it. React Flow
 * dispatches on `node.type`, so `customshape` is registered in `nodeTypes`
 * beside `goblin` / `label` / `table` and the node carries its own renderer.
 *
 * THE ONE-SENTENCE RULE — THE MARKUP IS NEVER HANDED TO THE DOM AS HTML.
 * There is no HTML-injection sink anywhere in this file: no element-property
 * assignment, no `dangerously*` React prop, no fragment parsing. The user's SVG
 * reaches the canvas ONLY as `<img src={svgDataUri(d.svg)}>`.
 * `src/customShape.ts` sanitises the markup (DOMPurify SVG profile + its own
 * scrub pass), and the `data:image/svg+xml,` context is the SECOND line of
 * defence: scripts are disabled and external resources cannot load there. Those
 * are two independent guards, so the markup is never injected as live DOM.
 * Anything that renders it as DOM throws both away at once.
 *
 * There is NO ShapeFrame here: the user's SVG *is* the artwork. Painting an app
 * shape behind it would show through any transparent area of the import.
 *
 * No connection handles — imported artwork is not a box to wire up.
 *
 * ITEM 2b (2026-09-18) — NO AUTO-SHOW ACTION STRIP ON THIS KIND EITHER. The
 * floating strip that used to appear above a selected import is gone, exactly as
 * `src/DiagramNode.tsx` documents it (that file carries the full reasoning and
 * the button-by-button mapping to the surviving hot keys / context-menu rows).
 * Its only reader here was the `__toolbar` slot, so the slot, the
 * `ToolbarActions` type it was derived from, the `LabelKind` import that fed the
 * derivation, the icon imports and the two unused React Flow imports all went
 * with it — and `App.tsx` no longer injects the value.
 */
import {memo} from 'react';
import {NodeResizer, type NodeProps} from '@xyflow/react';
import {svgDataUri, SHAPE_MIN_PX} from './customShape';
import {resolveColor} from './colors';
import type {ColorKey} from './colors';

export type CustomShapeKind = {
  svg: string;          // the sanitised inline SVG markup (CustomShape.data)
  viewBox: string;
  title: string;
  colorKey: ColorKey;
};

const CustomShapeNode = memo(({data, selected}: NodeProps) => {
  const d = data as unknown as CustomShapeKind;
  /* ROUND BF (2026-10-23) — `--nc` finally reaches this node kind: the ring
     rule in styles.css reads it, so the at-rest affordance (BF-1) themes with
     the node's own colourKey. Same wiring every other node kind already had. */
  const nc = resolveColor(d);
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
    </div>
  );
});

export default CustomShapeNode;
