import {ViewportPortal} from '@xyflow/react';
import {HelperGuides} from './helperLines';

/**
 * F3 — Renders the active alignment guides ON the canvas.
 *
 * COORDINATE FRAME (this is the part that was wrong). The guides are computed
 * in FLOW coordinates — absolute positions in the node space. That only lands
 * on the right pixels if the element is a child of the div React Flow
 * transforms; otherwise flow numbers are read as un-panned, un-zoomed CSS
 * offsets and the guide is painted nowhere near its nodes.
 *
 * `HelperLinesView` used to be rendered as a bare child of `<ReactFlow>`, which
 * put it OUTSIDE `Viewport`. `.react-flow__viewport` carries no `position` of
 * its own (only `transform-origin: 0 0`), so an absolutely positioned
 * `.helper-line` resolved its containing block against the nearest positioned
 * ancestor instead — the `<Panel>` box React Flow pins to the canvas. At the
 * default bottom-left `Panel` and a default viewport that is close to
 * `(0, 0, 1)`, so a guide whose stored `top` is a flow value of a few hundred
 * appears to "fly around at the top" of the canvas and never tracks its nodes
 * under pan or zoom.
 *
 * `ViewportPortal` is React Flow's own escape hatch for exactly this: it
 * portals children into `.react-flow__viewport-portal`, which IS inside the
 * transformed viewport (`position:absolute`, inset 0, full size). Flow
 * coordinates then need no manual zoom/pan compensation — the transform does it
 * — which is what the original comment claimed and the code did not do.
 *
 * The span is already correct: `computeHelperSnap` only emits a guide whose
 * partners are within `PROXIMITY_GAP_PX` on the span axis, so the segment is a
 * short rule between nearby nodes (draw.io/Miro style), never a canvas-wide
 * line. `pointer-events: none` (see `.helper-line`) keeps it out of hit testing.
 */
export default function HelperLinesView({guides}: {guides: HelperGuides}) {
  if (!guides.vertical && !guides.horizontal) return null;
  return (
    <ViewportPortal>
      {guides.vertical && (
        <div
          className="helper-line helper-v"
          style={{left: guides.vertical.x, top: guides.vertical.y1, height: Math.max(1, guides.vertical.y2 - guides.vertical.y1)}}
        />
      )}
      {guides.horizontal && (
        <div
          className="helper-line helper-h"
          style={{top: guides.horizontal.y, left: guides.horizontal.x1, width: Math.max(1, guides.horizontal.x2 - guides.horizontal.x1)}}
        />
      )}
    </ViewportPortal>
  );
}
