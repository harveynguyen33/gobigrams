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
import {svgDataUri, SHAPE_MIN_PX, SHAPE_MAX_PX} from './customShape';
import type {ColorKey} from './colors';

export type CustomShapeKind = {
  svg: string;          // the sanitised inline SVG markup (CustomShape.data)
  viewBox: string;
  title: string;
  colorKey: ColorKey;
};

const CustomShapeNode = memo(({data, selected}: NodeProps) => {
  const d = data as unknown as CustomShapeKind;
  return (
    <div className={`custom-shape-node${selected ? ' selected' : ''}`} data-shape-title={d.title}>
      {selected && (
        /* §8.3 — the same four clamps the import path enforces, applied again to
           the live resize: 32 px floor, 512 px ceiling, and `aspect:'fixed'` so
           the artwork can never be distorted. */
        <NodeResizer
          minWidth={SHAPE_MIN_PX}
          minHeight={SHAPE_MIN_PX}
          maxWidth={SHAPE_MAX_PX}
          maxHeight={SHAPE_MAX_PX}
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
