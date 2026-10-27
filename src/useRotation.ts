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
import type {UpdateInternals} from './components/RotateInternalsBridge';
import {
  newRotateGuard, recordRotateGesture, rotateMembersAround, norm180,
  type RotateGuard,
} from './rotation';

type SetNodes = React.Dispatch<React.SetStateAction<Node[]>>;

export function useRotation(
  nodesRef: React.MutableRefObject<Node[]>,
  setNodes: SetNodes,
  pushHistory: () => void,
  /** ROTATE-FIX — the updater from RotateInternalsBridge: the hook needs a
   *  ReactFlowProvider ancestor and this hook is called ABOVE `<ReactFlow>`,
   *  so App owns the ref and the bridge (a `<ReactFlow>` child) fills it. */
  internals: React.MutableRefObject<UpdateInternals | null>,
) {
  const guard = useRef<RotateGuard>(newRotateGuard());
  /** gesture-start geometry per node id (rotation + position for cancel). */
  const start = useRef<Map<string, {rotation: number; x: number; y: number}>>(new Map());
  /** GROUP gesture start geometry (ROUND GROUP-ROTATE): rotation + box per
   *  member, so delta frames orbit the same mean-of-centres centroid the
   *  chord writer's group path uses (rotateMembersAround, Figma's rule). */
  const gstart = useRef<Map<string, {rotation: number; x: number; y: number; w: number; h: number}>>(new Map());
  /* ROTATE-FIX — EDGES FOLLOW THE SHAPE. A rotation is a `data` change, and a
   * data change does NOT re-measure a node's handle bounds: React Flow keeps
   * the old `handleBounds` and every edge keeps its old endpoint coordinates.
   * The store only rewrites them through updateNodeInternals({force:true}),
   * reached via the bridge's hook (it measures inside a requestAnimationFrame,
   * i.e. AFTER React has painted the new transform, so calling it right after
   * the state write is the correct order). One call, one policy: every write
   * below goes through here. */
  const updateNodeInternals = (ids: string | string[]) => internals.current?.(ids);

  /** Write one node's rotation; 0 DELETES the field so untouched boards stay
   *  byte-identical (no `rotation: 0` in saved JSON). */
  const writeRotation = (id: string, rotation: number) => {
    setNodes(ns => ns.map(n => n.id === id
      ? {...n, data: {...(n.data as Record<string, unknown>), rotation: rotation || undefined}}
      : n));
    updateNodeInternals(id);
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
     * entry stays — same contract as a cancelled resize); both re-arm.
     * ROTATE-FIX — the per-frame re-measure races the React commit of the
     * LAST delta (the rAF can run before the final transform is painted), so
     * the gesture measured the final frame again here: a fresh rAF scheduled
     * from pointerup lands after that commit. Measured live: without this the
     * edges stopped ~9° short of a 57° drag. */
    if (phase === 'cancel') {
      setNodes(ns => ns.map(n => n.id === id
        ? {...n, position: {x: s0.x, y: s0.y},
           data: {...(n.data as Record<string, unknown>), rotation: s0.rotation || undefined}}
        : n));
    }
    updateNodeInternals(id);
    recordRotateGesture(guard.current, {end: true});
  }, [nodesRef, setNodes, pushHistory, internals]);

  /** ROUND GROUP-ROTATE — the SHARED grip's gesture writer: the same phase
   *  contract as the per-node one, but the unit is the WHOLE selection and
   *  the angle orbits the selection CENTROID (rotateMembersAround, the pure
   *  function — one setNodes write per frame, ONE undo entry per gesture,
   *  updateNodeInternals once per member at end/cancel). */
  const onGroupRotateGesture = useCallback((phase: 'start' | 'delta' | 'end' | 'cancel', delta: number) => {
    const snap = () => {
      gstart.current.clear();
      for (const n of nodesRef.current) {
        if (!n.selected || n.parentId) continue;
        gstart.current.set(n.id, {
          rotation: ((n.data as Record<string, unknown>).rotation as number | undefined) ?? 0,
          x: n.position.x, y: n.position.y,
          w: n.measured?.width ?? 190, h: n.measured?.height ?? 100,
        });
      }
    };
    if (phase === 'start') {
      if (recordRotateGesture(guard.current, {start: true})) pushHistory();
      snap();
      return;
    }
    if (!gstart.current.size) return;
    if (phase === 'delta') {
      const sized = [...gstart.current].map(([id, g]) => ({
        id, x: g.x, y: g.y, w: g.w, h: g.h, rotation: g.rotation,
      }));
      /* the pure function orbits the GROUP centroid — the same
         mean-of-member-centres rule the chord writer's group path uses. */
      const next = rotateMembersAround(sized, delta);
      const byId = new Map(next.map(m => [m.id, m]));
      setNodes(ns => ns.map(n => {
        const m = byId.get(n.id);
        if (!m) return n;
        return {...n, position: {x: m.x, y: m.y},
          data: {...(n.data as Record<string, unknown>), rotation: m.rotation || undefined}};
      }));
      return;
    }
    /* end | cancel: cancel restores every member's snapshot geometry; both
       re-measure once per member and re-arm the one-entry latch. */
    if (phase === 'cancel') {
      setNodes(ns => ns.map(n => {
        const g0 = gstart.current.get(n.id);
        if (!g0) return n;
        return {...n, position: {x: g0.x, y: g0.y},
          data: {...(n.data as Record<string, unknown>), rotation: g0.rotation || undefined}};
      }));
    }
    updateNodeInternals([...gstart.current.keys()]);
    gstart.current.clear();
    recordRotateGesture(guard.current, {end: true});
  }, [nodesRef, setNodes, pushHistory, internals]);

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
    /* ROTATE-FIX — once per MEMBER: every rotated node's handle bounds moved,
       so every edge touching one of them must re-resolve. */
    updateNodeInternals(next.map(m => m.id));
  }, [nodesRef, setNodes, pushHistory, internals]);

  return [onRotateGesture, onGroupRotateGesture, rotateSelection] as const;
}
