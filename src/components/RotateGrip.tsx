/* RotateGrip.tsx — ROUND ROTATE item 3: the grip ABOVE the top resize grip.
 *
 * Tokens only (an 18px disc + a rotation glyph, the resize grips' own
 * vocabulary: --sel border on --surface, the documented z ladder: 3, above
 * the resizer's 2, below the connect points' 5). It is a child of the node's
 * ROTATED root, positioned at the box's top-centre (-30px: above the top
 * resize grip, never overlapping a Top connect point) and COUNTER-rotated so
 * the glyph stays upright while the node turns under it — the grip tracks
 * the node's own top edge, exactly like the resize grips beside it.
 *
 * KEYBOARD: the grip is a <button> (tabbable, focus-visible ring); focused
 * arrow keys = ±1° (±15° with Shift) — each press is a complete one-entry
 * gesture. Pointer: Shift snaps to 15° steps (snapRotation/ROTATE_SNAP_DEG).
 *
 * The gesture maths is the useEdgeGesture shape: capture the pointer, convert
 * client → flow with RF's own screenToFlowPosition, report the TOTAL angle
 * delta around the node centre. The WRITER (history/undo) lives in App via
 * useRotation and arrives as the onGesture prop; this component only
 * converts pointer motion to an angle.
 */
import {useRef} from 'react';
import {useReactFlow} from '@xyflow/react';
import {beginRotate, rotateDelta, snapRotation, ROTATE_SNAP_DEG} from '../rotation';
import type {RotateBegin} from '../rotation';

type Props = {
  nodeId: string;
  /** The node's live geometry rotation (degrees), for the counter-rotation. */
  rotation: number;
  /** Gesture reporter; `delta` is the TOTAL angle since start (deg). */
  onGesture: (phase: 'start' | 'delta' | 'end' | 'cancel', delta: number) => void;
};

export function RotateGrip({nodeId, rotation, onGesture}: Props) {
  const rf = useReactFlow();
  /* ROTATE-FIX — a NULLABLE anchor, never a zero-filled one: the pre-fix ref
     started as {startAngle: 0, cx: 0, cy: 0} and its first gesture measured the
     grab angle around the canvas ORIGIN (see the object-literal trap in the
     gesture comment below). */
  const live = useRef<{begin: RotateBegin; moved: boolean} | null>(null);

  const centre = () => {
    const n = rf.getNodes().find(m => m.id === nodeId);
    if (!n) return null;
    const w = n.measured?.width ?? 190, h = n.measured?.height ?? 100;
    return {cx: n.position.x + w / 2, cy: n.position.y + h / 2};
  };

  const flowPoint = (clientX: number, clientY: number) =>
    rf.screenToFlowPosition({x: clientX, y: clientY});

  const onPointerDown = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    e.preventDefault();
    const c = centre();
    if (!c) return;
    const el = e.currentTarget;
    el.setPointerCapture(e.pointerId);
    /* ROTATE-FIX — the CENTRE first, then the grab bearing, and the centre is
       an ARGUMENT to beginRotate: the literal-ordering bug (a `bearing()` call
       inside the assignment's own object literal, reading the PREVIOUS ref)
       can no longer be written. The first frame is therefore exactly 0°. */
    const p = flowPoint(e.clientX, e.clientY);
    live.current = {begin: beginRotate(c.cx, c.cy, p.x, p.y), moved: false};
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

  /* Keyboard: ArrowLeft/Down = -1°, ArrowRight/Up = +1°; Shift = ±15°; each
     press is its own one-entry gesture (start+delta+end in one tick). */
  const onKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>) => {
    const step = e.shiftKey ? ROTATE_SNAP_DEG : 1;
    if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') {
      e.preventDefault();
      onGesture('start', 0); onGesture('delta', -step); onGesture('end', 0);
    } else if (e.key === 'ArrowRight' || e.key === 'ArrowUp') {
      e.preventDefault();
      onGesture('start', 0); onGesture('delta', step); onGesture('end', 0);
    }
  };

  /* counter-rotate the glyph upright while the node turns under it */
  return (
    <button
      type="button"
      className="ds-rotate-grip"
      aria-label={`Rotate (arrow keys nudge, Shift snaps ${ROTATE_SNAP_DEG} degrees)`}
      title="Rotate — drag; Shift snaps 15°; arrow keys nudge"
      style={{transform: `translate(-50%, 0) rotate(${-rotation}deg)`}}
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
