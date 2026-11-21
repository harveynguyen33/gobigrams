/* useRailReveal.ts — RAIL-COVER (task t_e3dbadf4, 2026-11-10).
 *
 * THE DEFECT: RAIL-CONTEXT opens the code pane the moment a TABLE is selected,
 * and the pane takes its width OUT of the canvas (measured 1080 -> 700 at a
 * 1600px viewport). React Flow does not move its viewport when its container
 * shrinks, so a table that sat near the right edge keeps its screen position and
 * ends up UNDER the pane: its right resize grip is visible, but
 * `document.elementFromPoint()` at that grip answers `cp-code` (the textarea)
 * and a drag there scales nothing. The grips are the only way to scale a table
 * besides the inspector slider, so that is a closed door.
 *
 * THE RULE (the card's five clauses, one per assertion in
 * `checks/unisurf-rail-context.mjs` C1-C5):
 *   1. PAN ONLY — the zoom is never touched (transform[0] identical);
 *   2. a node that already fits is left ALONE (byte-identical transform);
 *   3. ONCE per closed -> open transition, never per render, so a pan the user
 *      performs afterwards is theirs and stays;
 *   4. idempotent — a second open measures again and finds it already fits;
 *   5. a node wider than the canvas aligns to the LEFT margin and stops: the
 *      delta is computed once from the measured boxes, so there is no loop.
 */
import {useEffect, useRef} from 'react';
import type {Node, ReactFlowInstance} from '@xyflow/react';

/** screen px kept between the node's box and the canvas edge. */
export const REVEAL_MARGIN = 8;

/** How far (screen px) the viewport must PAN to bring `box` inside `canvas`.
 *  Both rects are measured on the live DOM, so the delta is already in viewport
 *  units — React Flow's transform sits on top of them, not under. Right/bottom
 *  are resolved first, then left/top: when the node is wider than the canvas the
 *  left rule wins and the node parks against the left margin. One step, bounded
 *  by construction — that is what makes clause 5 terminate. */
export function revealDelta(box: DOMRect, canvas: DOMRect, margin = REVEAL_MARGIN) {
  const dx0 = Math.min(0, (canvas.right - margin) - box.right);
  const dy0 = Math.min(0, (canvas.bottom - margin) - box.bottom);
  return {
    dx: dx0 + Math.max(0, (canvas.left + margin) - (box.left + dx0)),
    dy: dy0 + Math.max(0, (canvas.top + margin) - (box.top + dy0)),
  };
}

/** Pan the selected node fully into the canvas when the rail opens, and at
 *  every RESIZE GESTURE END. `tick` is the caller's discrete gesture counter:
 *  App bumps it ONCE on the `dimensions`/`resizing:false` frame (the same
 *  boundary the Ctrl+Z step uses) and on an inspector scale write.
 *  RAIL-COVER-2 (t_ee38cf69) — the defect that second trigger closes: growing
 *  the card with its own grip pushed its right edge back under the pane, so the
 *  very grip the user was holding became ungrabbable (elementFromPoint answered
 *  `cp-code`). Same bounded pan, same five clauses, one more trigger. */
export function useRailReveal(
  rf: ReactFlowInstance | null, open: boolean, node: Node | null | undefined, tick = 0) {
  const wasOpen = useRef(open);
  const lastTick = useRef(tick);
  const id = node?.id ?? null;
  useEffect(() => {
    const was = wasOpen.current;
    const ticked = lastTick.current !== tick;
    wasOpen.current = open;
    lastTick.current = tick;
    /* clause 3: the transition (or a bumped tick) is the trigger — not the
     * render, not a frame of the drag itself. */
    if (!open || !rf || !id || (was && !ticked)) return;
    /* one turn of the loop: the pane mounts in this same commit and the width it
     * steals must be in the boxes we measure. */
    const t = setTimeout(() => {
      const box = document.querySelector(`.react-flow__node[data-id="${CSS.escape(id)}"]`)?.getBoundingClientRect();
      const canvas = document.querySelector('.react-flow')?.getBoundingClientRect();
      if (!box || !canvas) return;
      const {dx, dy} = revealDelta(box, canvas);
      if (!dx && !dy) return;                    /* clause 2: already fits */
      const v = rf.getViewport();
      void rf.setViewport({x: v.x + dx, y: v.y + dy, zoom: v.zoom});
    }, 50);
    return () => clearTimeout(t);
  }, [open, id, rf, tick]);

  /* CODE-RAIL-WIDTH (t_b3986041) — the canvas can also change width while the rail
   * STAYS open: the inspector's transient hide/reopen (380px in and out) and the
   * splitter itself. React Flow does not move its viewport when its container
   * resizes, so the same defect returns by a different door: reopen the inspector
   * and the selected node slides back under the pane. Same bounded pan, one step
   * per real width change, guarded by a pixel comparison so a settled layout never
   * re-pans (clauses 2/5 of the header). */
  useEffect(() => {
    if (!open || !rf) return;
    const el = document.querySelector('.react-flow');
    if (!el || typeof ResizeObserver === 'undefined') return;
    let last = el.getBoundingClientRect().width;
    const ro = new ResizeObserver(() => {
      const canvas = el.getBoundingClientRect();
      if (!canvas.width || Math.abs(canvas.width - last) < 1) return;
      last = canvas.width;
      const box = id
        ? document.querySelector(`.react-flow__node[data-id="${CSS.escape(id)}"]`)?.getBoundingClientRect()
        : null;
      if (!box) return;
      const {dx, dy} = revealDelta(box, canvas);
      if (!dx && !dy) return;
      const v = rf.getViewport();
      void rf.setViewport({x: v.x + dx, y: v.y + dy, zoom: v.zoom});
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [open, id, rf]);
}
