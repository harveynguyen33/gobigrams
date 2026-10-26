/* useRotation.ts — ROUND ROTATE item 3: the rotation WRITE cluster.
 *
 * Lives outside App.tsx for the same reason useUndoHistory and
 * useEdgeGesture do: App is at its hard size cap and this is a self-contained
 * cluster — one GRIP gesture writer (continuous, ONE undo entry), one CHORD
 * writer (discrete ±15°, Alt+R / Alt+Shift+R, also the multi-selection
 * centroid rotate), and nothing else. Nodes/edges state stays in App and
 * passes down explicitly.
 *
 * ONE UNDO ENTRY PER GESTURE (the round's invariant (3)): the grip calls
 * ('start', 0) once at pointerdown; recordRotateGesture latches so the
 * per-frame ('delta', d) writes never push again; ('end'|'cancel', 0)
 * re-arms. A discrete chord press is the same lifecycle compressed into one
 * tick — start, delta, end — so it is exactly one entry too.
 *
 * The K5 tilt is NEVER written: `rotation` stores the geometry angle only;
 * paintRotation adds the tilt at paint time (canvas root + export emitter
 * share it), so undo restores geometry and the tilt rides along.
 */
import {useCallback, useRef} from 'react';
import type * as React from 'react';
import type {Node} from '@xyflow/react';
import {
  newRotateGuard, recordRotateGesture, rotateMembersAround, norm180,
  type RotateGuard,
} from './rotation';

type SetNodes = React.Dispatch<React.SetStateAction<Node[]>>;

export function useRotation(
  nodesRef: React.MutableRefObject<Node[]>,
  setNodes: SetNodes,
  pushHistory: () => void,
) {
  const guard = useRef<RotateGuard>(newRotateGuard());
  /** gesture-start geometry per node id (rotation + position for cancel). */
  const start = useRef<Map<string, {rotation: number; x: number; y: number}>>(new Map());

  /** Write one node's rotation; 0 DELETES the field so untouched boards stay
   *  byte-identical (no `rotation: 0` in saved JSON). */
  const writeRotation = (id: string, rotation: number) => {
    setNodes(ns => ns.map(n => n.id === id
      ? {...n, data: {...(n.data as Record<string, unknown>), rotation: rotation || undefined}}
      : n));
  };

  /** The GRIP gesture writer. `delta` is the TOTAL angle since gesture
   *  start (the grip owns the pointer math and the Shift-snap). */
  const onRotateGesture = useCallback((id: string, phase: 'start' | 'delta' | 'end' | 'cancel', delta: number) => {
    if (phase === 'start') {
      if (recordRotateGesture(guard.current, {start: true})) pushHistory();
      const n = nodesRef.current.find(m => m.id === id);
      if (n) start.current.set(id, {
        rotation: ((n.data as Record<string, unknown>).rotation as number | undefined) ?? 0,
        x: n.position.x, y: n.position.y,
      });
      return;
    }
    const s0 = start.current.get(id);
    if (!s0) return;
    if (phase === 'delta') {
      writeRotation(id, norm180(s0.rotation + delta));
      return;
    }
    /* end | cancel: cancel restores the pre-gesture geometry (the history
     * entry stays — same contract as a cancelled resize); both re-arm. */
    if (phase === 'cancel') {
      setNodes(ns => ns.map(n => n.id === id
        ? {...n, position: {x: s0.x, y: s0.y},
           data: {...(n.data as Record<string, unknown>), rotation: s0.rotation || undefined}}
        : n));
    }
    recordRotateGesture(guard.current, {end: true});
  }, [nodesRef, setNodes, pushHistory]);

  /** The CHORD writer: ±`deg` on the selection. ONE node = its own rotation
   *  delta; MANY = each member keeps its own rotation delta while its centre
   *  orbits the selection centroid (rotateMembersAround, the pure function —
   *  one setNodes write, so ONE undo entry for the whole gesture). */
  const rotateSelection = useCallback((deg: number) => {
    const sel = nodesRef.current.filter(n => n.selected && !n.parentId);
    if (!sel.length) return;
    pushHistory();
    if (sel.length === 1) {
      const n = sel[0];
      writeRotation(n.id, norm180((((n.data as Record<string, unknown>).rotation as number | undefined) ?? 0) + deg));
      return;
    }
    const sized = sel.map(n => ({
      id: n.id, x: n.position.x, y: n.position.y,
      w: n.measured?.width ?? 190, h: n.measured?.height ?? 100,
      rotation: ((n.data as Record<string, unknown>).rotation as number | undefined) ?? 0,
    }));
    const next = rotateMembersAround(sized, deg);
    const byId = new Map(next.map(m => [m.id, m]));
    setNodes(ns => ns.map(n => {
      const m = byId.get(n.id);
      if (!m) return n;
      return {...n, position: {x: m.x, y: m.y},
        data: {...(n.data as Record<string, unknown>), rotation: m.rotation || undefined}};
    }));
  }, [nodesRef, setNodes, pushHistory]);

  return [onRotateGesture, rotateSelection] as const;
}
