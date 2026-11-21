/* useSelectionBridge.ts — UNISURF-S6 (SPEC-UNIFIED-SURFACE §3/§5/§9 step 6,
 * 2026-11-08): the selection bridge's App half, split out of App.tsx for the
 * same reason as useCodeCommit — the god-file's line budget is hard-capped.
 *
 * WHAT IT OWNS (the two directions, spec §3):
 *   · pendKey  canvas → code — the lineOf key of the row ("id:colId") or node
 *     header ("id") the canvas last focused. The pane turns it into a
 *     `line N ↗` chip + a scroll and applies the caret ONLY when the user
 *     next focuses the pane (never steal focus from the canvas).
 *   · hlKey    code → canvas — the caret's line mapped back through the LAST
 *     VALID generation's lineOf: at most ONE highlighted row; a header line
 *     maps to the node, not a column, so it highlights NOTHING (H3's
 *     deliberate asymmetry). While stale the pane reports null (B5: the
 *     draft's line numbers must never highlight the frozen board's rows).
 *
 * The off-screen scroll reuses the ONE canvas helper there is (rf.fitView
 * with maxZoom pinned to the current zoom — it pans, never zooms); no scroll
 * library, and only when the row is actually outside the viewport.
 */
import {useCallback, useEffect, useState} from 'react';
import type {ReactFlowInstance} from '@xyflow/react';

export function useSelectionBridge(rf: ReactFlowInstance | null) {
  const [pendKey, setPendKey] = useState<string | null>(null);
  const [hlKey, setHlKey] = useState<string | null>(null);

  /** a row focus/mousedown reports its column (TableRowList's onPickColumn). */
  const pickColumn = useCallback(
    (id: string, c: {id: string}) => setPendKey(`${id}:${c.id}`), []);

  /* the highlighted row scrolls into view ONLY when off-screen (spec §3) */
  useEffect(() => {
    if (!hlKey || !rf) return;
    const id = hlKey.slice(0, hlKey.indexOf(':'));
    const el = document.querySelector(`.react-flow__node[data-id="${id}"]`);
    const wrapEl = el?.closest('.react-flow');
    if (!el || !wrapEl) return;
    const r = el.getBoundingClientRect();
    const w = wrapEl.getBoundingClientRect();
    const pad = 60;
    if (r.top < w.top + pad || r.bottom > w.bottom - pad ||
        r.left < w.left + pad || r.right > w.right - pad) {
      rf.fitView({nodes: [{id}], maxZoom: rf.getZoom(), duration: 300});
    }
  }, [hlKey, rf]);

  return [pendKey, hlKey, setPendKey, pickColumn, setHlKey] as const;
}
