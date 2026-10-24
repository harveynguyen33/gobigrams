/* useUndoHistory.ts — ROUND BN PHASE A: the undo/redo cluster moved out of
 *  App() verbatim (past/future stacks, snapshot, pushHistory, the ROUND AN-5
 *  selection-preserving restore, undo/redo, canUndo/canRedo). Behaviour-neutral:
 *  bodies are byte-identical; only this wrapper, its parameter destructuring and
 *  the return object are new. The nodes/edges state itself STAYS in App (it is
 *  shared with every other cluster) and passes down explicitly — no context. */
import {useCallback, useRef, useState} from 'react';
import type * as React from 'react';
import type {Edge, Node, NodeChange} from '@xyflow/react';
import {MAX_HISTORY} from './boardConstants';

export type Snap = {nodes: Node[]; edges: Edge[]};

/* React Flow's setNodes/setEdges accept a value OR an updater; type them the
   way useNodesState/useEdgesState declare them. */
type SetNodes = React.Dispatch<React.SetStateAction<Node[]>>;
type SetEdges = React.Dispatch<React.SetStateAction<Edge[]>>;

/* Positional parameters, not an opts object: the bundle ratchet is raw bytes and
   object property names survive minification — see AGENTS.md's perf ratchet. */
export function useUndoHistory(
  nodesRef: React.MutableRefObject<Node[]>,
  edgesRef: React.MutableRefObject<Edge[]>,
  setNodes: SetNodes,
  setEdges: SetEdges,
  setSel: (id: string | null) => void,
  setSelCount: (n: number) => void,
  setSelEdgeId: (id: string | null) => void,
) {

  const past = useRef<Snap[]>([]);
  const future = useRef<Snap[]>([]);
  const [, bumpHist] = useState(0);

  const snapshot = useCallback((): Snap => ({
    nodes: nodesRef.current.map(n => ({
      ...n, position: {...n.position}, data: {...(n.data as any)}, selected: false,
    })),
    /* AUDIT-8 — copy edge `data` one level, matching the node branch above.
       Every current edge writer replaces `data` wholesale, so the alias was
       harmless; the copy makes that invariant ENFORCED rather than implicit —
       a future in-place patch of edge.data can no longer rewrite history. */
    edges: edgesRef.current.map(e => ({...e, data: {...(e.data as any)}, selected: false})),
  }), []);

  /** Record the current state before a mutation. Capped at MAX_HISTORY entries. */
  const pushHistory = useCallback(() => {
    past.current.push(snapshot());
    while (past.current.length > MAX_HISTORY) past.current.shift();
    future.current = [];
    bumpHist(v => v + 1);
  }, [snapshot]);

  /* ROUND AN, AN-5 — UNDO/REDO KEEP THE SELECTION. THIS IS A DEFECT FIX, NOT A
     PREFERENCE. Figma, draw.io and Excalidraw all leave the object selected after
     an undo, and they are right to: the SELECTION is UI state, the GRAPH is
     document state, and undo restores the document. The old code could not do
     that, because `snapshot()` normalises `selected: false` onto every node and
     edge and `undo()` restored that snapshot VERBATIM — so React Flow's
     controlled `onSelectionChange` then saw an empty selection and blanked
     `selEdgeId`, which closed the inspector the user was working in.

     THE SNAPSHOT STILL CARRIES `selected: false`, deliberately: history must
     never replay a STALE selection (an entry captured twenty edits ago). What
     survives is the LIVE selection, read from the tree at undo time, and it
     survives ONLY FOR ENTITIES THAT STILL EXIST in the restored graph — undoing
     a CREATE must clear the selection, because the thing selected is gone. The
     two helpers below are that rule, and they are also why `sel`/`selCount`/
     `selEdgeId` are DERIVED from what survived rather than written by hand: the
     inspector reads the same predicate the canvas rings are painted from, so the
     two cannot disagree. */
  const liveSelection = useCallback(() => ({
    nodes: nodesRef.current.filter(n => n.selected).map(n => n.id),
    edges: edgesRef.current.filter(e => e.selected).map(e => e.id),
  }), []);

  const applySelection = useCallback((nodes: Node[], edges: Edge[],
    live: {nodes: string[]; edges: string[]}) => {
    const nodeIds = new Set(nodes.map(n => n.id));
    const edgeIds = new Set(edges.map(e => e.id));
    const nKeep = new Set(live.nodes.filter(id => nodeIds.has(id)));
    const eKeep = new Set(live.edges.filter(id => edgeIds.has(id)));
    setNodes(nodes.map(n => ({...n, selected: nKeep.has(n.id)})));
    setEdges(edges.map(e => ({...e, selected: eKeep.has(e.id)})));
    /* The same SHAPE `onSelectionChange` uses (`s[0]`, and an edge only when
       exactly one is selected), so the callback fired by this very restore agrees
       with these values instead of overwriting them with an empty selection. */
    const keptNodes = nodes.filter(n => nKeep.has(n.id)).map(n => n.id);
    const keptEdges = edges.filter(e => eKeep.has(e.id)).map(e => e.id);
    setSel(keptNodes[0] ?? null);
    setSelCount(keptNodes.length);
    setSelEdgeId(keptEdges.length === 1 ? keptEdges[0] : null);
  }, [setNodes, setEdges, setSel, setSelCount, setSelEdgeId]);

  const undo = useCallback(() => {
    const prev = past.current.pop();
    if (!prev) return;
    /* captured BEFORE the restore, so it is the selection the user is looking at */
    const live = liveSelection();
    future.current.push(snapshot());
    applySelection(prev.nodes, prev.edges, live);
    bumpHist(v => v + 1);
  }, [snapshot, liveSelection, applySelection]);

  const redo = useCallback(() => {
    const next = future.current.pop();
    if (!next) return;
    const live = liveSelection();
    past.current.push(snapshot());
    while (past.current.length > MAX_HISTORY) past.current.shift();
    /* Redo gets the same rule, and the same edge case: a redo that brings back a
       node the user has selected does NOT resurrect a selection for it unless it
       was selected live — the `live` capture above is the only source. */
    applySelection(next.nodes, next.edges, live);
    bumpHist(v => v + 1);
  }, [snapshot, liveSelection, applySelection]);

  const canUndo = past.current.length > 0;
  const canRedo = future.current.length > 0;

  return {past, future, bumpHist, pushHistory, undo, redo, canUndo, canRedo};
}
