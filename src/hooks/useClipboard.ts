/* HEADROOM (t_a21adb78) — the clipboard slice, moved VERBATIM out of App.tsx
 * (the file sits at its hard cap): the clipboard + paste-cursor refs, the
 * native pointer tracker, and copy / paste / duplicate / nudge / delete.
 * Same refs, same callbacks, same one-history-write semantics — only the
 * module boundary moved. App keeps the call site. Positional deps (the
 * useExportActions style — no per-call deps object to allocate).
 */
import {useCallback, useEffect, useRef} from 'react';
import {type Edge, type Node, type ReactFlowInstance, type XYPosition} from '@xyflow/react';
import {pastePositions, trackCanvasPointer} from '../canvas/pasteAt';
import {lockedIdSet} from './useGroupLock';
import type {Snap} from './useUndoHistory';

export function useClipboard(
  nodesRef: React.RefObject<Node[]>,
  edgesRef: React.RefObject<Edge[]>,
  wrap: React.RefObject<HTMLDivElement | null>,
  rf: ReactFlowInstance,
  pushHistory: () => void,
  nextId: () => number,
  setNodes: (f: (ns: Node[]) => Node[]) => void,
  setEdges: (f: (es: Edge[]) => Edge[]) => void,
  tickTask: (t: string) => void,
  flash: (msg: string) => void,
  snap: boolean,
  gridSize: number,
) {
  const clipboard = useRef<Snap | null>(null), pasteCursor = useRef<XYPosition | null>(null);
  /* PASTE-AT-CURSOR — native tracker on the canvas root; see canvas/pasteAt.ts */
  useEffect(() => trackCanvasPointer(wrap.current?.querySelector('.react-flow'), rf, p => { pasteCursor.current = p; }), [rf]);
  const copySelection = useCallback(() => {
    const selNodes = nodesRef.current.filter(n => n.selected);
    if (!selNodes.length) return;
    const ids = new Set(selNodes.map(n => n.id));
    clipboard.current = {
      nodes: selNodes.map(n => ({...n, position: {...n.position}, data: {...(n.data as any)}, selected: false})),
      edges: edgesRef.current.filter(e => ids.has(e.source) && ids.has(e.target)).map(e => ({...e})),
    };
  }, []);

  /* PASTE-AT-CURSOR — maths live in canvas/pasteAt.ts: `atCursor` puts the clipboard bbox CENTRE at the tracked pointer (the double-click contract; the grid snap quantises the resulting TOP-LEFT); the legacy +40 nudge stays for duplicate / no-pointer. */
  const pasteClipboard = useCallback((offset = 40, atCursor = false) => {
    const cb = clipboard.current;
    if (!cb || !cb.nodes.length) return;
    pushHistory();
    const idMap = new Map<string, string>();
    const moved = pastePositions(cb.nodes, atCursor ? pasteCursor.current : null, offset, atCursor && snap && pasteCursor.current ? gridSize : null);
    const newNodes: Node[] = cb.nodes.map(n => {
      const id = `n${nextId()}`;
      idMap.set(n.id, id);
      return {
        ...n, id, selected: true,
        position: moved.get(n.id) ?? n.position,
        data: {...(n.data as any)},
      };
    });
    /* AUDIT-1 — parentId is an ID reference: remap through idMap; a child whose group was NOT pasted drops out (parentId/extent deleted). */
    for (const nn of newNodes) {
      const pid = (nn as any).parentId as string | undefined;
      if (pid) {
        const mapped = idMap.get(pid);
        if (mapped) (nn as any).parentId = mapped;
        else { delete (nn as any).parentId; delete (nn as any).extent; }
      }
    }
    const newEdges: Edge[] = cb.edges.map(e => ({
      ...e, id: `e${nextId()}`, source: idMap.get(e.source)!, target: idMap.get(e.target)!, selected: false,
    }));
    setNodes(ns => [...ns.map(n => (n.selected ? {...n, selected: false} : n)), ...newNodes]);
    setEdges(es => [...es, ...newEdges]);
    tickTask('node');
  }, [tickTask, pushHistory, setNodes, setEdges, snap, gridSize]);

  const duplicateSelection = useCallback(() => {
    copySelection();
    pasteClipboard(40);
  }, [copySelection, pasteClipboard]);

  /** Nudge every selected node by (dx, dy). Used by the arrow keys. */
  const nudge = useCallback((dx: number, dy: number) => {
    const ids = new Set(nodesRef.current.filter(n => n.selected).map(n => n.id));
    if (!ids.size) return;
    tickTask('move');   // CHECKLIST-EDGE — the arrows ARE a move gesture
    setNodes(ns => ns.map(n => ids.has(n.id)
      ? {...n, position: {x: n.position.x + dx, y: n.position.y + dy}}
      : n));
  }, [setNodes, tickTask]);

  /** Delete every selected node (and its attached edges). */
  const deleteSelection = useCallback(() => {
    const ids = new Set(nodesRef.current.filter(n => n.selected).map(n => n.id));
    if (!ids.size) return;
    /* LOCK v1 — locked nodes refuse deletion here too (the keyboard path is RF's `deletable:false`). */
    const lockIds = lockedIdSet(nodesRef.current);
    if ([...ids].some(id => lockIds.has(id))) { flash('Unlock before deleting'); return; }
    pushHistory();
    setNodes(ns => ns.filter(n => !ids.has(n.id)));
    setEdges(es => es.filter(e => !ids.has(e.source) && !ids.has(e.target)));
  }, [pushHistory, setNodes, setEdges, flash]);

  // Return TUPLE, not an object (see useCanvasPrefs): positions minify, keys do not.
  // Order: [clipboard, pasteCursor, copySelection, pasteClipboard,
  //         duplicateSelection, nudge, deleteSelection]
  return [clipboard, pasteCursor, copySelection, pasteClipboard, duplicateSelection, nudge, deleteSelection] as const;
}
