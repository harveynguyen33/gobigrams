/* GroupGapDrag.tsx — GROUP-GAP-DRAG (t_10563e73): the selected logical
 * block's OWN drag surface.
 *
 * THE OWNER'S DEFECT: with a logical block SELECTED, pressing a member and
 * dragging moved the block, but pressing the EMPTY GAP between the members
 * did nothing and DROPPED the selection. Once the block is selected, its
 * whole painted frame is the object's surface — a drag there must move the
 * block, and a click there must keep the selection.
 *
 * MEASURED ROOT CAUSE (the class, not an instance): RF's own multi-selection
 * drag target, `.react-flow__nodesselection-rect`, has been
 * `visibility: hidden` in styles.css since ROUND SELBOX — and
 * visibility:hidden removes an element from HIT-TESTING, so the rect has
 * owned nothing since 2026-10-27 (the "rect keeps its hit target" belief in
 * the SELBOX comments was never re-measured). The logical group's wrapper is
 * separately pointer-events:none (the D1 quiet-boundary rule — correct while
 * the block is UNSELECTED: the container must not eat clicks meant for the
 * canvas). A gap press therefore fell through to the pane, and the pane's
 * click cleared the selection.
 *
 * THE D1 AMENDMENT, STATED ONCE HERE: for a logical group, the interior of
 * the painted frame is INERT while the block is unselected (the GROUP-SELECTION
 * arm "clicking the empty interior must not select the group" is re-anchored
 * for that half, never deleted — L7a/L7b still pin it), and IS the block's
 * own drag surface while the block is selected. This layer exists ONLY in the
 * selected state (`selectedLogicalBlock` gates the render), so the group body
 * is never made selectable in the ordinary RF sense and D1 stays closed for
 * every other state.
 *
 * THE HIT SURFACE IS THE FRAME THE EYE SEES: this component consumes the
 * SAME frameOf(sig, painted) union (painted extents + BOUNDARY_PAD) that
 * SelectionBox paints and GroupRotateGrip anchors to — the layer is
 * pixel-identical to the painted frame by construction, so a press 1px
 * outside it is genuinely outside the object (the pane clears the selection,
 * as always) and a press just inside it belongs to the block. Both Z-ORDER
 * halves are deliberate: the layer renders in RF's ViewportPortal with
 * z-index:-1 — BELOW every node wrapper (a member press still hits the
 * member; nothing about members changes) but ABOVE the pane (a gap press is
 * OURS, and stopPropagation keeps the pane from starting a marquee, panning,
 * or firing the selection-clearing pane click).
 *
 * THE GESTURE: pointer capture + the project's drag threshold (the same
 * number RF's own nodeDragThreshold takes: FINE_DRAG_THRESHOLD_PX, or the
 * COARSE one on touch) — below it the press is a CLICK: nothing moves, the
 * selection survives because the click never reaches the pane. Above it the
 * gesture writer (useGapDragGesture) moves the container ONCE per frame and
 * the members ride. Double-click is swallowed too: the object's own surface
 * must not open the canvas insert palette. Locked blocks refuse at
 * pointerdown with the lock grammar's flash and never start a drag.
 */
import {useRef} from 'react';
import {useReactFlow, useStore, ViewportPortal} from '@xyflow/react';
import {unionMembers, selectedLogicalBlock} from '../canvas/groupLogical';
import {memberSig, paintSig, frameOf} from '../canvas/selectionFrame';
import {lockedIdSet} from '../canvas/nodeLock';
import {usePaintedCardRects} from '../hooks/usePaintedCardRects';
import type {GapDragPhase} from '../hooks/useGapDrag';

type Props = {
  /** the gesture writer (useGapDragGesture) — App owns all writes. */
  onGesture: (phase: GapDragPhase, gid: string, dx?: number, dy?: number) => void;
  /** screen-px travel before a press becomes a drag (RF's nodeDragThreshold
   *  value: FINE_DRAG_THRESHOLD_PX, COARSE on touch). Below it: a click. */
  threshold: number;
};

export function GroupGapDrag({onGesture, threshold}: Props) {
  const rf = useReactFlow();
  /* the SelectionBox read side, verbatim — one comparable string per concern
     so the layer can never disagree with the painted box it mirrors. */
  const sig = useStore(s => memberSig(unionMembers(s.nodes)));
  const paintKey = useStore(s => paintSig(unionMembers(s.nodes)));
  const gid = useStore(s => selectedLogicalBlock(s.nodes));
  const locked = useStore(s => {
    const g = selectedLogicalBlock(s.nodes);
    return g ? lockedIdSet(s.nodes).has(g) : false;
  });
  const painted = usePaintedCardRects(paintKey, useStore(s => s.transform[2]));
  const frame = frameOf(sig, painted);
  const live = useRef(false);

  /* No block exactly selected (or nothing painted yet): no surface at all —
     the D1 half keeps the gap inert by ABSENCE, not by a listener. */
  if (!frame || !gid) return null;

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return; /* right/middle keep the pane's own verbs */
    e.stopPropagation();
    e.preventDefault();
    if (locked) {
      onGesture('refused', gid); /* flash once per press; nothing moves */
      return;
    }
    const el = e.currentTarget;
    el.setPointerCapture(e.pointerId);
    const sx = e.clientX;
    const sy = e.clientY;
    const p0 = rf.screenToFlowPosition({x: sx, y: sy});
    let started = false;

    const onMove = (ev: PointerEvent) => {
      if (!started) {
        /* SCREEN travel below the threshold is a click, not a drag. */
        if (Math.hypot(ev.clientX - sx, ev.clientY - sy) < threshold) return;
        started = true;
        live.current = true;
        onGesture('start', gid);
      }
      const p = rf.screenToFlowPosition({x: ev.clientX, y: ev.clientY});
      onGesture('delta', gid, p.x - p0.x, p.y - p0.y);
    };
    const finish = (cancelled: boolean) => {
      el.releasePointerCapture(e.pointerId);
      el.removeEventListener('pointermove', onMove);
      el.removeEventListener('pointerup', onUp);
      el.removeEventListener('pointercancel', onCancel);
      live.current = false;
      onGesture(cancelled || !started ? 'cancel' : 'end', gid);
    };
    const onUp = () => finish(false);
    const onCancel = () => finish(true);
    el.addEventListener('pointermove', onMove);
    el.addEventListener('pointerup', onUp);
    el.addEventListener('pointercancel', onCancel);
  };

  /* The pane's click handler resets the selection — this press is INSIDE the
     selected object (the owner's half of the grammar); the pane's dblclick
     opens the insert palette — not on the object's surface. */
  const swallow = (e: React.MouseEvent) => e.stopPropagation();

  return (
    <ViewportPortal>
      <div
        className="ds-group-gap-hit"
        data-gap-for={gid}
        aria-hidden="true"
        style={{left: frame.x, top: frame.y, width: frame.w, height: frame.h}}
        onPointerDown={onPointerDown}
        onClick={swallow}
        onDoubleClick={swallow}
      />
    </ViewportPortal>
  );
}
