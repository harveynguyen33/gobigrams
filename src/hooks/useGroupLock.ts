/* GROUP-OBJECT + LOCK v1 (t_c5023f3b) — the App-facing seam.
 *
 * App.tsx is a hard size cap, so the three gestures live here and call the
 * pure modules in src/canvas/. Each gesture writes ONE history entry (one
 * undo reverses the whole gesture) and refuses through the same flash the
 * other handlers use. `menuState` derives the context menu's enabled/disabled
 * rows from the live selection so the menu can never drift from what the
 * keyboard allows.
 */
import {useCallback, useEffect, useMemo} from 'react';
import type {Node} from '@xyflow/react';
import {canGroup, canUngroup, createGroup, ungroup} from '../canvas/groupObject';
import {lockedIdSet, lockRow, toggleLock} from '../canvas/nodeLock';
import type {CtxMenuState} from '../ui/ContextMenu';
/* the ONE seam App reads the effective lock set AND the user-facing count
 * through (LOCK-COUNT t_b3079954: a count that includes the invisible
 * logical-group binder names a node the user cannot see) */
export {lockedIdSet, visibleSelected} from '../canvas/nodeLock';

export function useGroupLock(deps: {
  nodesRef: React.RefObject<Node[]>;
  nodes: Node[];
  setNodes: (f: (ns: Node[]) => Node[]) => void;
  pushHistory: () => void;
  flash: (msg: string) => void;
  nextId: () => number;
  readOnly?: boolean;
}) {
  const {nodesRef, nodes, setNodes, pushHistory, flash, nextId, readOnly} = deps;

  const groupSelection = useCallback(() => {
    const r = createGroup(nodesRef.current ?? [], `n${nextId()}`);
    if (!r.ok) { flash((r as any).reason as string); return; }
    pushHistory();
    setNodes(() => r.nodes);
  }, [nodesRef, nextId, flash, pushHistory, setNodes]);

  const ungroupSelection = useCallback(() => {
    const r = ungroup(nodesRef.current ?? []);
    if (!r.ok) { flash((r as any).reason as string); return; }
    pushHistory();
    setNodes(() => r.nodes);
  }, [nodesRef, flash, pushHistory, setNodes]);

  const toggleLockSelection = useCallback(() => {
    const r = toggleLock(nodesRef.current ?? []);
    if (!r.ok) { flash((r as any).reason as string); return; }
    pushHistory();
    setNodes(() => r.nodes);
    /* LOCK-COUNT: `count` is the VISIBLE half of the write — a 2-card logical
     * block writes 3 nodes (two cards + the invisible binder) and says 2. A
     * binder-only selection writes the flag without naming a card, so it says
     * what it actually did instead of "0 nodes". */
    flash(r.count
      ? `${r.locked ? 'Locked' : 'Unlocked'} ${r.count} node${r.count === 1 ? '' : 's'}`
      : `${r.locked ? 'Locked' : 'Unlocked'} the group container — no card was selected`);
  }, [nodesRef, flash, pushHistory, setNodes]);

  /* LOCK-CHROME d (t_63bd6f5d): a locked node refuses every drag SILENTLY — it
   * is draggable:false and carries `nopan`, so the pointer moves, nothing
   * happens, and the user reads it as a broken canvas. The gesture never
   * reaches React Flow (so onNodeDragStart cannot see it), which is why this
   * reads the POINTER: a press that TRAVELS >= 4px on an effectively-locked
   * node flashes the reason once per press. Read-only is skipped — the whole
   * canvas is locked there and the chrome is hidden too (arm f). */
  useEffect(() => {
    if (readOnly) return;
    let from: {id: string; x: number; y: number} | null = null;
    let said = false;
    const idAt = (t: EventTarget | null) => (t as Element | null)
      ?.closest?.('.react-flow__node')?.getAttribute('data-id') ?? null;
    const down = (e: PointerEvent) => {
      const id = e.button === 0 ? idAt(e.target) : null;
      from = id && lockedIdSet(nodesRef.current ?? []).has(id) ? {id, x: e.clientX, y: e.clientY} : null;
      said = false;
    };
    const move = (e: PointerEvent) => {
      if (!from || said) return;
      if (Math.hypot(e.clientX - from.x, e.clientY - from.y) < 4) return;
      said = true;
      const n = (nodesRef.current ?? []).find(m => m.id === from?.id);
      flash((n?.data as {locked?: boolean} | undefined)?.locked === true
        ? 'Locked — press Alt+L to unlock'
        : 'Locked by its group — unlock the group');
    };
    const up = () => { from = null; };
    document.addEventListener('pointerdown', down, true);
    document.addEventListener('pointermove', move, true);
    document.addEventListener('pointerup', up, true);
    return () => {
      document.removeEventListener('pointerdown', down, true);
      document.removeEventListener('pointermove', move, true);
      document.removeEventListener('pointerup', up, true);
    };
  }, [flash, nodesRef, readOnly]);

  /* MENU-STATES (t_8b56f71a): the ONE derivation. The menu reads this map and
   * nothing else, so a row can never offer what the keyboard would refuse. */
  const menuState = useMemo<CtxMenuState>(() => {
    const lock = lockRow(nodes);
    return {
      group: {disabled: !canGroup(nodes)},
      ungroup: {disabled: !canUngroup(nodes)},
      lock: {disabled: lock.disabled, label: lock.label, hint: lock.hint},
    };
  }, [nodes]);

  return {groupSelection, ungroupSelection, toggleLockSelection, menuState};
}
