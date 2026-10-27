/* GroupRotateGrip.tsx — ROUND GROUP-ROTATE: the ONE shared rotate grip.
 *
 * THE UX BUG it kills (Harvey, device test): in a multi-selection EVERY
 * selected node rendered its own rotate grip — noisy, and each one rotated
 * just its own node while the user expects the GROUP ("nên hiện 1 icon xoay
 * chung đúng ko?").
 *
 * THE SHAPE: this grip lives at APP level (rendered as a direct child of
 * <ReactFlow>, a sibling of the canvas chrome) because it needs ALL selected
 * nodes, not one node's data. It anchors ABOVE-CENTRE of the selection's
 * union bounding box in SCREEN space and drives the existing GROUP path
 * (useRotation's selection gesture writer → rotateMembersAround, ONE undo
 * entry, updateNodeInternals for every member — never a per-node write).
 *
 * THE MATH: the centre-first pure gesture, same as RotateGrip — the CENTRE is
 * the selection CENTROID in flow coords (an argument to beginRotate, never a
 * stored field), the pointer converts client → flow with RF's own
 * screenToFlowPosition, and rotateDelta reports the TOTAL wrapped angle.
 * Shift snaps to 15° (snapRotation/ROTATE_SNAP_DEG), arrow keys nudge ±1°
 * (±15° with Shift), and Escape cancels a live drag back to the snapshot.
 *
 * THE ANCHOR TRACKS THE VIEWPORT: two `useStore` string signatures (the
 * bridge's pattern — comparable primitives, so no re-render storm): the
 * selected nodes' union geometry and the live zoom/pan transform. Styling
 * reuses RotateGrip's own vocabulary (.ds-group-rotate-grip, 18px disc +
 * glyph, tokens only).
 */
import {useRef} from 'react';
import {useReactFlow, useStore} from '@xyflow/react';
import {beginRotate, rotateDelta, snapRotation, ROTATE_SNAP_DEG} from '../rotation';
import type {RotateBegin} from '../rotation';

type Props = {
  /** The GROUP gesture writer (useRotation): `delta` is the TOTAL angle
   *  since gesture start, around the selection centroid. */
  onGesture: (phase: 'start' | 'delta' | 'end' | 'cancel', delta: number) => void;
};

export function GroupRotateGrip({onGesture}: Props) {
  const rf = useReactFlow();
  /* ROTATE-FIX shape — a NULLABLE anchor, never a zero-filled one: the centre
     is computed fresh from the union box and passed to beginRotate as an
     argument, so the first frame is exactly 0°. */
  const live = useRef<{begin: RotateBegin; moved: boolean} | null>(null);

  /* ONE comparable string per concern (the RotateInternalsBridge pattern):
     the union geometry of the selected nodes, and the viewport transform. */
  const sig = useStore(s => s.nodes
    .filter(n => n.selected && !n.parentId)
    .map(n => `${n.id}:${n.position.x},${n.position.y},${n.measured?.width ?? 190},${n.measured?.height ?? 100}`)
    .join('|'));
  const view = useStore(s => s.transform.join(','));

  const boxes = sig ? sig.split('|').map(p => {
    const at = p.indexOf(':');
    const [x, y, w, h] = p.slice(at + 1).split(',').map(Number);
    return {x, y, w, h};
  }) : [];
  if (boxes.length < 2) return null; /* App gates on selCount >= 2; the store is the truth */

  const left = Math.min(...boxes.map(b => b.x));
  const right = Math.max(...boxes.map(b => b.x + b.w));
  const top = Math.min(...boxes.map(b => b.y));
  const bottom = Math.max(...boxes.map(b => b.y + b.h));
  /* the CENTRE-first contract: the selection CENTROID, in FLOW coords */
  const cx = (left + right) / 2;
  const cy = (top + bottom) / 2;
  /* the anchor: union-box top-centre in SCREEN space (inside the renderer) */
  const [tx, ty, tz] = view.split(',').map(Number);
  const sx = tx + cx * tz;
  const sy = ty + top * tz - 30; /* 30px above the box, the per-node grip's offset */

  const flowPoint = (clientX: number, clientY: number) =>
    rf.screenToFlowPosition({x: clientX, y: clientY});

  const onPointerDown = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    e.preventDefault();
    const el = e.currentTarget;
    el.setPointerCapture(e.pointerId);
    /* CENTRE first (the centroid, an argument), then the grab bearing. */
    const p = flowPoint(e.clientX, e.clientY);
    live.current = {begin: beginRotate(cx, cy, p.x, p.y), moved: false};
    onGesture('start', 0);

    const onMove = (ev: PointerEvent) => {
      const g = live.current;
      if (!g) return;
      const q = flowPoint(ev.clientX, ev.clientY);
      g.moved = true;
      onGesture('delta', snapRotation(rotateDelta(g.begin, q.x, q.y), ev.shiftKey, ROTATE_SNAP_DEG));
    };
    const finish = (cancelled: boolean) => {
      el.releasePointerCapture(e.pointerId);
      el.removeEventListener('pointermove', onMove);
      el.removeEventListener('pointerup', onUp);
      el.removeEventListener('pointercancel', onCancel);
      const moved = live.current?.moved ?? false;
      live.current = null;
      if (cancelled || !moved) onGesture('cancel', 0);
      else onGesture('end', 0);
    };
    const onUp = () => finish(false);
    const onCancel = () => finish(true);
    el.addEventListener('pointermove', onMove);
    el.addEventListener('pointerup', onUp);
    el.addEventListener('pointercancel', onCancel);
  };

  /* Keyboard parity with the per-node grip, plus Escape: ArrowLeft/Down =
     -1°, ArrowRight/Up = +1°; Shift = ±15°; each press is its own one-entry
     gesture. Escape cancels a LIVE drag back to the gesture snapshot. */
  const onKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>) => {
    if (e.key === 'Escape' && live.current) {
      e.preventDefault();
      live.current = null; /* a later pointerup finds no gesture: a no-op cancel */
      onGesture('cancel', 0);
      return;
    }
    const step = e.shiftKey ? ROTATE_SNAP_DEG : 1;
    if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') {
      e.preventDefault();
      onGesture('start', 0); onGesture('delta', -step); onGesture('end', 0);
    } else if (e.key === 'ArrowRight' || e.key === 'ArrowUp') {
      e.preventDefault();
      onGesture('start', 0); onGesture('delta', step); onGesture('end', 0);
    }
  };

  return (
    <button
      type="button"
      className="ds-group-rotate-grip"
      aria-label={`Rotate selection (arrow keys nudge, Shift snaps ${ROTATE_SNAP_DEG} degrees, Escape cancels)`}
      title="Rotate selection — drag; Shift snaps 15°; arrow keys nudge; Escape cancels"
      style={{left: sx, top: sy}}
      onPointerDown={onPointerDown}
      onKeyDown={onKeyDown}
    >
      <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true">
        <path d="M8.2 5a3.2 3.2 0 1 1-1-2.3" fill="none" stroke="var(--sel)" strokeWidth="1.4" strokeLinecap="round" />
        <path d="M8.4 1.2v1.8h-1.8" fill="none" stroke="var(--sel)" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </button>
  );
}
