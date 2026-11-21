/* useChecklist.ts — ONBOARD-P4 (2026-10-31): the getting-started checklist's TWO
 *  facts (which tasks are ticked, whether the panel was dismissed) and their ONE
 *  write path, lifted out of App() like every other domain hook here — App.tsx
 *  is a hard-capped file (checks/file-size-gate.mjs) and this cluster carries no
 *  JSX at all.
 *
 *  WHY ONE OWNER AND NOT PANEL STATE: the `?` sheet can now RE-OPEN the panel
 *  (a dismissed checklist used to be gone for good). A copy of `dismissed`
 *  inside Checklist could not see that write, so the row would clear the key and
 *  the panel would stay hidden — the exact reconciliation bug this panel already
 *  paid for once, when its "board" task was keyed on a COUNT of boards instead
 *  of an act (renaming the only board never ticked it).
 *
 *  Every tick is idempotent and persistence is handed the NEXT set the reducer
 *  computed — the write never re-reads a ref, so an async caller cannot persist
 *  a stale list. */
import {useCallback, useState} from 'react';
import {
  type ChecklistTaskId, readChecklistDone, persistChecklistDone,
  readChecklistDismissed, writeChecklistDismissed,
} from '../nodes/Checklist';
import {trackFirstAction, type FirstAction} from '../app/analytics';

/** ONBOARD-P6 — the checklist's six tasks mapped onto the analytics event's six
 *  actions. `move` has NO counterpart: moving a node is housekeeping, not an
 *  activation step, so it is deliberately not reported. `template` has no
 *  checklist task — it fires from the template pick itself (useBoardsMenu).
 *  Reporting HERE means every tick that lands, from any of the tickTask call
 *  sites, is counted once and in the checklist's own vocabulary. */
const FIRST_ACTION: Partial<Record<ChecklistTaskId, FirstAction>> = {
  node: 'node', edge: 'edge', label: 'label', export: 'export', board: 'board',
};

/** `done` is the ticked set; `tick` completes one task; `dismissed` +
 *  `dismiss`/`restore` are the panel's visibility. */
export function useChecklist() {
  const [done, setDone] = useState<Set<ChecklistTaskId>>(() => readChecklistDone());
  const tick = useCallback((id: ChecklistTaskId) => {
    const action = FIRST_ACTION[id];
    if (action) trackFirstAction(action);
    setDone(prev => {
      if (prev.has(id)) return prev;
      const next = new Set(prev);
      next.add(id);
      persistChecklistDone(next);
      return next;
    });
  }, []);

  const [dismissed, setDismissed] = useState(() => readChecklistDismissed());
  const dismiss = useCallback(() => {
    setDismissed(true);
    writeChecklistDismissed(true);
  }, []);
  /** Clearing the stored dismissal re-shows the panel at whatever progress it
   *  holds — it never resets the ticks. */
  const restore = useCallback(() => {
    setDismissed(false);
    writeChecklistDismissed(false);
  }, []);

  return [done, tick, dismissed, dismiss, restore] as const;
}
