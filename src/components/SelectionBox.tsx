/* SelectionBox.tsx — ROUND SELBOX: the app's ROTATION-AWARE selection box.
 *
 * WHOSE BOX IS THIS. React Flow paints the multi-selection's dashed box
 * itself (`.react-flow__nodesselection-rect`, NodesSelection in the vendor
 * dist): its selector unions `getInternalNodesBounds` over the selected
 * nodes — their UNROTATED `position` + `measured` internals. There is no
 * prop to feed it different geometry, so after a group rotation the dashed
 * box LAGS the shapes (a 100×50 card at 45° paints a ~106×106 footprint and
 * its corners poke out of the box). SELBOX therefore takes the box away
 * from RF (hidden via CSS, dated comment in styles.css) and paints the
 * app's own in the SAME visual vocabulary — the `--xy-selection-*` tokens
 * RF's rect painted from (`--sel-soft` fill, 1px dotted `--sel`), set in
 * this file from the app's own tokens so the box is indistinguishable at
 * 0°, and correct at every angle.
 *
 * THE MATH: the box is the union of the selected nodes' ROTATED extents —
 * `rotatedExtent` from src/rotation.ts, the same pure function the export
 * bounds path uses (ONE definition, no second corner-math copy). Exactly
 * RF's union at 0°, so an unrotated board paints pixel-identically.
 *
 * THE FRAME: flow coordinates, no viewport math — the box is a
 * `ViewportPortal` child (HelperLinesView's pattern), so React Flow's own
 * transform carries it under zoom/pan. PAINT-ONLY: `pointer-events: none`
 * on the box itself; RF's rect owned the group drag, and that behaviour is
 * untouched (drag still works — RF's rect keeps its hit target, only its
 * PAINT is hidden; see styles.css).
 */
import {useStore} from '@xyflow/react';
import {ViewportPortal} from '@xyflow/react';
import {rotatedExtent} from '../rotation';

export function SelectionBox() {
  /* ONE comparable string per concern (the RotateInternalsBridge pattern):
     the selected nodes' geometry INCLUDING rotation, so a live rotate drag
     (the angle changing every frame) moves the box with the true union. */
  const sig = useStore(s => s.nodes
    .filter(n => n.selected && !n.parentId)
    .map(n => `${n.id}:${n.position.x},${n.position.y},${n.measured?.width ?? 190},${n.measured?.height ?? 100},${(n.data as {rotation?: number}).rotation ?? 0}`)
    .join('|'));

  if (!sig) return null;
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const part of sig.split('|')) {
    const at = part.indexOf(':');
    const [x, y, w, h, deg] = part.slice(at + 1).split(',').map(Number);
    /* the rotated extent — the union of the node's four rotated corners */
    const e = rotatedExtent(x, y, w, h, deg);
    minX = Math.min(minX, e.x); minY = Math.min(minY, e.y);
    maxX = Math.max(maxX, e.x + e.w); maxY = Math.max(maxY, e.y + e.h);
  }
  if (!Number.isFinite(minX)) return null;

  return (
    <ViewportPortal>
      {/* RF's own vocabulary: --sel-soft fill + 1px dotted --sel, the exact
          pair styles.css feeds RF's --xy-selection-* tokens, so the app's
          box is visually the box RF painted — but rotation-aware. */}
      <div
        className="ds-selection-box"
        style={{left: minX, top: minY, width: maxX - minX, height: maxY - minY}}
      />
    </ViewportPortal>
  );
}
