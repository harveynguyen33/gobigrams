/* useGapDrag.ts — GROUP-GAP-DRAG (t_10563e73): the gesture WRITER behind the
 * selected block's drag surface (components/GroupGapDrag.tsx).
 *
 * WHY A WRITER SEPARATE FROM THE COMPONENT: the component owns the POINTER
 * (capture, the travel threshold, stopPropagation — the pane's click would
 * otherwise clear the selection); this file owns the STATE. Every board
 * write here arrives as a bare callback handed in from App as a prop (the
 * UNISURF-LOCK-SEAM rule — a canvas write never lives in a paint-side
 * component, and A17 rejects every member-style write name, so the deps are
 * destructured and the call sites stay bare).
 *
 * THE WRITE IS CONTAINER-ONLY: React Flow's own multi-selection drag moves a
 * selected parent and the children ride (measured in @xyflow/system —
 * getDragItems skips children whose parent is selected), so moving the
 * logical container ALONE is exactly what a member drag already does. One
 * write per move frame touches the container; the members' stored
 * (parent-relative) positions are untouched and their absolute motion is
 * derived by RF's parent transform — the block moves as ONE object.
 *
 * HISTORY: ONE pushHistory at 'start' (the onNodeDragStart convention), so a
 * whole gap drag is ONE undo entry that restores the container and, with it,
 * every member's absolute position. 'cancel' restores the gesture snapshot
 * in place (a sub-threshold release never reached 'start', so it is a no-op).
 * Snap mirrors RF's snap-to-grid (the reference-item semantics: the
 * container's resulting position rounds to the grid, the whole block keeps
 * one uniform delta).
 */
import {useCallback, useRef} from 'react';
import type {Node} from '@xyflow/react';

export type GapDragPhase =
  | 'start'   /* threshold crossed — push history, snapshot */
  | 'delta'   /* total flow-space delta from the grab point */
  | 'end'     /* pointer released after a real drag */
  | 'cancel'  /* pointercancel, or a release below the threshold (no-op) */
  | 'refused';/* the block is locked — the component refuses, App explains */

type Deps = {
  /** the App nodes state (current as of the last render — 'start' runs in a
   *  sync pointerdown, after React has committed the selection). */
  nodes: Node[];
  setNodes: (updater: (ns: Node[]) => Node[]) => void;
  pushHistory: () => void;
  startInteraction: () => void;
  endInteraction: () => void;
  flash: (msg: string) => void;
  snap: boolean;
  gridSize: number;
};

export function useGapDragGesture(deps: Deps) {
  const grab = useRef<{gid: string; x: number; y: number} | null>(null);
  const live = useRef(false);
  /* bare names at every call site — A17 rejects member-style write names */
  const {nodes, setNodes, pushHistory, startInteraction, endInteraction, flash,
         snap: snapGrid, gridSize} = deps;

  return useCallback((phase: GapDragPhase, gid: string, dx = 0, dy = 0) => {
    if (phase === 'refused') {
      /* The same words the lock grammar already teaches (useGroupLock's
         single-card refusal): the selection is still the block, Alt+L frees it. */
      flash('Locked — press Alt+L to unlock');
      return;
    }
    if (phase === 'start') {
      const c = nodes.find((n) => n.id === gid);
      if (!c) return; /* the block vanished mid-press — nothing to move */
      grab.current = {gid, x: c.position.x, y: c.position.y};
      live.current = true;
      startInteraction();
      pushHistory();
      return;
    }
    if (phase === 'delta') {
      const g = grab.current;
      if (!live.current || !g || g.gid !== gid) return;
      let nx = g.x + dx;
      let ny = g.y + dy;
      if (snapGrid && gridSize > 0) {
        nx = Math.round(nx / gridSize) * gridSize;
        ny = Math.round(ny / gridSize) * gridSize;
      }
      setNodes((ns) => ns.map((n) =>
        n.id === gid ? {...n, position: {x: nx, y: ny}} : n));
      return;
    }
    if (phase === 'cancel') {
      const g = grab.current;
      if (!live.current || !g) return; /* a sub-threshold release: no gesture ever started */
      live.current = false;
      grab.current = null;
      setNodes((ns) => ns.map((n) =>
        n.id === g.gid ? {...n, position: {x: g.x, y: g.y}} : n));
      endInteraction();
      return;
    }
    /* 'end' */
    if (!live.current) return;
    live.current = false;
    grab.current = null;
    endInteraction();
  }, [nodes, setNodes, pushHistory, startInteraction, endInteraction, flash,
      snapGrid, gridSize]);
}
