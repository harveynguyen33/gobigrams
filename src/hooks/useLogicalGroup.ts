/* useLogicalGroup.ts — GROUP-LOGICAL (t_eb8fab7e): the App-facing grammar
 * for RF logical groups, the three-behaviour Miro model:
 *   click a member        -> the WHOLE block selects (pure expansion in
 *                            src/canvas/groupLogical.ts; React Flow already
 *                            selects a child alone, so only the missing
 *                            half is implemented here);
 *   double-click a member -> ENTER: inside, clicks select individual
 *                            members (expansion suspended);
 *   Escape                -> LEAVE: selection returns to the group.
 * The inside state is TRANSIENT UI state — NEVER in the board doc. It is
 * DERIVED from the block's own selection (blockHasSelection), so it exists
 * exactly while the block is the CONTEXT — every exit route ends it by
 * construction — Escape, a pane click, a click on a node outside, a marquee,
 * a member delete, undo, a board switch (GROUP-INSIDE-CLEAR t_7b68a96e).
 * A double-click on a member's TITLE still opens the inline rename editor
 * (the title element owns its dblclick — the guard below keeps rename from
 * entering the group).
 */
import {useCallback, useEffect, useRef, useState} from 'react';
import type {Node} from '@xyflow/react';
import {blockHasSelection, blockSelection, groupOnlySelection, logicalGroupOf} from '../canvas/groupLogical';

export function useLogicalGroup(deps: {
  nodesRef: {current: Node[] | null};
  nodes: Node[];
  setNodes: (f: (ns: Node[]) => Node[]) => void;
  setPendKey: (id: string) => void;
}) {
  const {nodesRef, nodes, setNodes, setPendKey} = deps;
  const [insideId, setInsideId] = useState<string | null>(null);

  /* GROUP-INSIDE-CLEAR (t_7b68a96e): `insideId` is CONTEXT, never a mode.
   * Entering a block is justified by a SELECTION, so the inside state lives
   * exactly as long as the block holds the selection: `inside` is DERIVED
   * from the nodes (blockHasSelection) and the one effect below only
   * garbage-collects the raw state. That covers EVERY exit route by
   * construction — a pane click, a click on a node outside, a marquee, a
   * member delete, undo, a board switch — and enumerating them with
   * "if (paneClick) setInsideId(null)" would be the same defect plus one
   * more path to forget. Escape still owns the LEAVE half (see escapeGroup).
   * The owner's defect this fixes: the boundary outlived the selection that
   * justified it and stayed painted with NOTHING selected. */
  const inside = blockHasSelection(nodes, insideId) ? insideId : null;
  useEffect(() => {
    if (!inside) setInsideId(null); /* no-op when already null */
  }, [inside]);

  const onLogicalClick = useCallback((ev: unknown, n: Node) => {
    setPendKey(n.id); /* UNISURF-S6: the code rail still follows the clicked node */
    if (inside) return; /* inside: individual member selection */
    const e = ev as {shiftKey?: boolean; metaKey?: boolean; ctrlKey?: boolean} | undefined;
    if (e && (e.shiftKey || e.metaKey || e.ctrlKey)) return; /* additive picks stay individual */
    const next = blockSelection(nodesRef.current ?? [], n.id);
    if (next) setNodes(() => next);
  }, [inside, nodesRef, setNodes, setPendKey]);

  const onLogicalDblClick = useCallback((ev: React.MouseEvent, n: Node) => {
    const t = ev?.target as HTMLElement | null;
    /* the title owns its double-click (inline rename, INLINE-TITLE round) */
    if (t && t.closest('.node-title, .note-title, .lo-title, .title-edit')) return;
    if (inside) return;
    const byId = new Map((nodesRef.current ?? []).map((m) => [m.id, m]));
    const g = logicalGroupOf(n, byId);
    if (!g) return;
    setInsideId(g.id);
    setNodes((ns) => ns.map((m) => ({...m, selected: m.id === n.id})));
  }, [inside, nodesRef, setNodes]);

  /* THE EXPANSION MUST LAND AT MOUSEDOWN, NOT CLICK. Measured in the
   * @xyflow source (v12): the wrapper attaches selection to onClick
   * (onSelectNodeHandler — mouseup), while XYDrag.startDrag computes its
   * drag items at the first move PAST nodeDragThreshold. A press that
   * becomes a drag therefore sees the grabbed member UNSELECTED and takes
   * RF's onlyDragNode path — the member drags SOLO and App's drop-release
   * detaches it from the block before the click event ever fires. A
   * document-level CAPTURE listener beats the node wrapper and d3, so by
   * startDrag the whole block (container included) is selected and RF drags
   * the container, carrying every member. */
  useEffect(() => {
    const onCaptureMouseDown = (e: MouseEvent) => {
      holdRef.current = null;
      if (inside || e.button !== 0 || e.shiftKey || e.metaKey || e.ctrlKey) return;
      const el = (e.target as HTMLElement | null)?.closest?.('.react-flow__node[data-id]');
      const id = el?.getAttribute('data-id');
      if (!id) return;
      const cur = nodesRef.current ?? [];
      const next = blockSelection(cur, id);
      if (!next) return;
      const changed = next.some((n, i) => !!n.selected !== !!cur[i]?.selected);
      if (changed) setNodes(() => next);
    };
    const onCaptureKeyDown = (e: KeyboardEvent) => {
      holdRef.current = e.key === 'Escape' ? insideId : null;
    };
    document.addEventListener('mousedown', onCaptureMouseDown, true);
    window.addEventListener('keydown', onCaptureKeyDown, true);
    return () => {
      document.removeEventListener('mousedown', onCaptureMouseDown, true);
      window.removeEventListener('keydown', onCaptureKeyDown, true);
    };
  }, [inside, insideId, nodesRef, setNodes]);

  /* The LEAVE half reads the RAW state, not the derived value. Measured: a
   * CLICK focuses the node wrapper, and React Flow's own a11y handler turns
   * the next Escape into "unselect this node" (`NodeWrapper.onKeyDown` ->
   * `elementSelectionKeys` -> `handleNodeClick({unselect: true})`). That
   * discrete update is flushed BEFORE the app's window keydown listener
   * runs, so the derived context is already null by the time escapeGroup()
   * is called and Escape would fall through to the plain deselect. The raw
   * state is only garbage-collected one effect flush later, so it is still
   * there for this press — which is exactly what the grammar needs. A ref
   * also keeps the callback stable: it is handed to the app's global keydown
   * effect, which binds once per state change (cf. nodesRef / overlayRef). */
  /* a held Escape: the capture listener stashes the RAW context this press is
   * about and escapeGroup consumes it; every other press clears it, so it can
   * never revive a context the user already left. */
  const holdRef = useRef<string | null>(null);

  const escapeGroup = useCallback((): boolean => {
    const gid = holdRef.current;
    if (!gid) return false;
    setInsideId(null);
    setNodes((ns) => groupOnlySelection(ns, gid));
    return true;
  }, [setNodes]);

  /* `insideId` is the DERIVED context (null the moment the block stops being
   * selected) — never the raw state, or a consumer could paint a boundary the
   * nodes no longer justify. */
  return {insideId: inside, onLogicalClick, onLogicalDblClick, escapeGroup};
}
