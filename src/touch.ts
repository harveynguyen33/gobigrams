/**
 * PACKAGE-M3 / Step 3 — coarse-pointer (touch) hardening.
 *
 * One module for every "this was designed for a mouse" assumption on the
 * canvas: the 500 ms long press that stands in for right-click, the drag
 * thresholds that absorb real-hand tremor (fine pointer) and finger wobble
 * (coarse pointer), and the handle metrics that make a 14px dot reachable with
 * a fingertip.
 *
 * Why a module and not inline props: the app is a SHARED, generic tool. These
 * numbers are the same numbers Excalidraw and tldraw ship (cited below), and
 * they should be readable in one place rather than hunted for across a
 * 2,900-line `App.tsx`.
 */
import {useEffect, useRef} from 'react';

/**
 * 500 ms — the long-press timeout both reference editors use:
 *   - Excalidraw: `TOUCH_CTX_MENU_TIMEOUT = 500` (packages/excalidraw/constants.ts)
 *   - tldraw:     `longPressDurationMs = 500` (packages/editor/src/lib/constants.ts)
 * Both open the context menu on a press-and-hold with a coarse pointer, which
 * is the only way to reach a context menu on a device with no right button.
 */
export const LONG_PRESS_MS = 500;

/** Movement (CSS px) that turns a press into a drag and cancels the long press.
 *  A "hold" that slides is a pan or a drag — never a menu. */
export const LONG_PRESS_MOVE_TOLERANCE_PX = 10;

/** React Flow's `nodeDragThreshold` / `connectionDragThreshold` default to 1px
 *  (see `@xyflow/react` store defaults) — but 1px sits INSIDE the tremor band
 *  of a human click, so a nudge of the hand turned an ordinary press into a
 *  DRAG. A threshold alone does NOT fix that: the click is suppressed by a
 *  DIFFERENT number (`nodeClickDistance`), and the gap between the two is a
 *  dead band. Read the block below before changing either constant.
 *
 *  FINE = 4 — the smallest value above the 1–3px a real hand moves during a
 *  click, so a press stays a click unless the pointer is actually travelling
 *  (4px is under one frame of movement at normal speed, i.e. still immediate).
 *  tldraw ships 4 for fine pointers and raises it 4 -> 6 for coarse ones; the
 *  same split is taken here.
 *
 *  COARSE = 6 — unchanged. A fingertip rolls 5–10px during a tap, so the coarse
 *  path keeps the raised threshold; 6 is tldraw's touch value and stays below
 *  `LONG_PRESS_MOVE_TOLERANCE_PX` (10).
 */
export const FINE_DRAG_THRESHOLD_PX = 4;
export const COARSE_DRAG_THRESHOLD_PX = 6;

/**
 * ============================================================================
 * THE CLICK / DRAG DEAD BAND — read this before touching either number above.
 * ============================================================================
 *
 * A raised `nodeDragThreshold` on its own does NOT protect a click, because
 * TWO INDEPENDENT GATES read TWO DIFFERENT NUMBERS. Any gap between them is a
 * region of pointer travel where a press does NOTHING AT ALL — the cursor
 * reacts to the press and the click "doesn't take".
 *
 *   GATE 1 — the CLICK. d3-drag's `clickDistance`, wired by `useDrag` in
 *     `@xyflow/system` as `.clickDistance(nodeClickDistance)` (see
 *     `node_modules/@xyflow/system/dist/esm/index.js`, ~line 2272). d3-drag
 *     latches `mousemoving` once the pointer travels MORE than this distance
 *     (`d3-drag/src/drag.js`: `dx*dx + dy*dy > clickDistance2`), and `mouseupped`
 *     then calls `yesdrag(view, mousemoving)`, which installs a one-tick
 *     `click` handler that swallows the trailing click
 *     (`d3-drag/src/nodrag.js`). React Flow's default for this prop is **0**,
 *     so ANY movement suppresses the click.
 *
 *   GATE 2 — the DRAG. `nodeDragThreshold`. The drag only STARTS once the
 *     pointer travels MORE than this one (`@xyflow/system`: `if (distance >
 *     nodeDragThreshold) startDrag(event)`).
 *
 * With React Flow's default `nodeClickDistance` of 0 and a drag threshold of 4,
 * travel in `(clickDistance, nodeDragThreshold]` = `(0, 4]` has the click
 * suppressed by GATE 1 while GATE 2 has not started a drag yet: a DEAD BAND.
 * Measured on this app before the fix — 0px selected the node, 1 / 2 / 3 / 4px
 * did NOTHING, 6px+ dragged and selected. Raising the drag threshold alone had
 * only WIDENED the band from ~1px to ~4px of hand tremor.
 *
 * THE RULE: `nodeClickDistance` MUST EQUAL `nodeDragThreshold`, per pointer
 * class. Equal values hand off cleanly because BOTH gates compare strictly
 * (`>`): travel <= the threshold keeps the click and starts no drag, travel
 * above it starts the drag and suppresses the click — no gap, no overlap.
 *
 *   - LOWER `nodeClickDistance` -> reopens the `(clickDistance, threshold]`
 *     dead band: the click dies before the drag is allowed to start.
 *   - HIGHER `nodeClickDistance` -> the gates OVERLAP instead: a short drag
 *     moves the node and the trailing click fires as well, so a node is
 *     selected (or its click handler runs) after a drag already happened.
 *
 * The two constants below are therefore DERIVED from the drag thresholds rather
 * than spelled out a second time: there is one number to change per pointer
 * class, so the pair cannot drift apart. The invariant is machine-checked by
 * `checks/node-click-distance.harness.mjs`.
 */
export const FINE_NODE_CLICK_DISTANCE_PX = FINE_DRAG_THRESHOLD_PX;
export const COARSE_NODE_CLICK_DISTANCE_PX = COARSE_DRAG_THRESHOLD_PX;

/** Connection drags keep React Flow's 1px default even on a fine pointer. That
 *  press starts ON a handle (an explicit drag affordance — there is no click to
 *  swallow), so the threshold only decides how soon the rubber-band line
 *  appears. Deliberately NOT raised with `FINE_DRAG_THRESHOLD_PX`, which exists
 *  solely to protect a CLICK on a node body.
 *
 *  NO CLICK/DRAG MISMATCH EXISTS ON THIS PATH — verified, not assumed. The
 *  connection gesture does not go through d3-drag at all: it is plain
 *  `mousemove`/`mouseup` listeners on the document (`@xyflow/system`,
 *  `XYHandle.onPointerDown`), gated only by `dragThreshold`
 *  (`dx*dx + dy*dy > dragThreshold * dragThreshold` -> `startConnection()`).
 *  There is no `clickDistance` counterpart, so nothing can suppress a click
 *  that this threshold delays. The handle's own `click` is a separate
 *  click-to-connect gesture (`Handle` renders with a `nodrag` class, so d3-drag
 *  never claims it — see the `.filter` in `XYDrag.update`), and that path is
 *  untouched by these numbers. */
export const FINE_CONNECTION_DRAG_THRESHOLD_PX = 1;

/* --- NOTE: the pane's own click gate needs NO alignment with the ones above ---
 *
 * `paneClickDistance` was investigated and deliberately left alone. It has no
 * second gate to fall out of step with:
 *
 *  1. IT IS A SINGLE GATE. It is wired to d3-ZOOM's `clickDistance`
 *     (`@xyflow/system`, `XYPanZoom.update`: `d3ZoomInstance.clickDistance(...)`),
 *     NOT to d3-drag's. The node's partner number (`nodeDragThreshold`) has no
 *     counterpart here, so there is no interval between two gates and therefore
 *     no dead band to open.
 *
 *  2. IN EDIT MODE IT IS NOT EVEN IN PLAY. That same call reads
 *     `selectionOnDrag ? Infinity : ...`, and this app sets
 *     `selectionOnDrag={!readOnly}` with `panOnDrag={[1, 2]}` (an array, so
 *     `panOnDrag !== true`). Editing therefore always takes the `Infinity`
 *     branch: the pane gate is effectively disabled, and clicking empty canvas
 *     to deselect runs through a completely separate path — `Pane`'s
 *     `onPointerUp` -> `onClick` -> `resetSelectedElements()`, with no distance
 *     test at all.
 *
 * In REVIEW mode `elementsSelectable` is false, so the 1px gate does apply —
 * but there is no selection to clear and `panOnDrag` is `true`, i.e. a 2-4px
 * travel on empty canvas simply pans the viewport. Nothing is swallowed that
 * the user could observe.
 *
 * Raising it to match the node threshold would therefore be harmful rather than
 * symmetric: it would not close any gap (there is none) and would only make the
 * pane's own click gate stricter than React Flow's tested default. So it is
 * left at the library default and NO constant is exported for it.
 */

/** Handle diameter. 14px is the mouse default in `styles.css`; React Flow's own
 *  touch example renders handles at 20px. */
export const HANDLE_SIZE_FINE_PX = 14;
export const HANDLE_SIZE_COARSE_PX = 20;

/** Transparent hit margin painted around a coarse handle with `::after`, so a
 *  20px dot still presents a 30x30 tap target — WCAG 2.2 SC 2.5.8 asks for
 *  24x24 minimum. Keep in sync with `.react-flow__handle::after` in
 *  `styles.css`. */
export const HANDLE_HIT_MARGIN_PX = 5;

/**
 * What a long press resolved to. Structurally identical to `CtxTarget` in
 * `ContextMenu.tsx` — deliberately, so `setCtx` accepts it directly and the
 * app keeps ONE context-menu state instead of two rival ones.
 */
export type LongPressTarget =
  | {kind: 'node'; id: string; x: number; y: number}
  | {kind: 'edge'; id: string; x: number; y: number}
  | {kind: 'pane'; x: number; y: number};

export type UseLongPressOptions = {
  /** Only arm the gesture for coarse pointers. A mouse keeps right-click. */
  enabled: boolean;
  /** The editor host (`.app`) — one delegated listener set for the whole canvas. */
  container: React.RefObject<HTMLElement | null>;
  /** Receives the SAME shape the `onNodeContextMenu` handlers pass to `setCtx`. */
  onLongPress: (target: LongPressTarget) => void;
  durationMs?: number;
  moveTolerance?: number;
};

type Pending = {
  pointerId: number;
  startX: number;
  startY: number;
  target: LongPressTarget;
  timer: number;
};

/**
 * Resolve a pointer position to a canvas target, using the DOM classes React
 * Flow already renders (`data-id` on the node/edge wrapper).
 *
 * A press that STARTS ON A HANDLE resolves to nothing: the handle owns the
 * tap-to-connect gesture (see 3.4), and a menu opening out of a connection
 * affordance would be ambiguous.
 */
function resolveTarget(e: PointerEvent): LongPressTarget | null {
  const el = e.target as HTMLElement | null;
  if (!el || typeof el.closest !== 'function') return null;
  if (el.closest('.react-flow__handle')) return null;

  const nodeEl = el.closest('.react-flow__node') as HTMLElement | null;
  if (nodeEl) {
    const id = nodeEl.getAttribute('data-id');
    return id ? {kind: 'node', id, x: e.clientX, y: e.clientY} : null;
  }

  const edgeEl = el.closest('.react-flow__edge') as HTMLElement | null;
  if (edgeEl) {
    const id = edgeEl.getAttribute('data-id');
    return id ? {kind: 'edge', id, x: e.clientX, y: e.clientY} : null;
  }

  if (el.closest('.react-flow__pane')) return {kind: 'pane', x: e.clientX, y: e.clientY};
  return null;
}

/**
 * Long press → context menu, for touch only.
 *
 * Cancellation rules (each one is a real gesture that must NOT end in a menu):
 *   - a SECOND pointer lands (two fingers = pinch, and a menu mid-pinch is a bug)
 *   - the finger moves further than `moveTolerance` (that is a pan/drag)
 *   - pointerup or pointercancel before the timer fires
 *
 * The click that follows a fired long press is swallowed once, capture-phase on
 * `window`, so the menu is not immediately closed by the pane-click handler.
 */
export function useLongPress({
  enabled,
  container,
  onLongPress,
  durationMs = LONG_PRESS_MS,
  moveTolerance = LONG_PRESS_MOVE_TOLERANCE_PX,
}: UseLongPressOptions): void {
  // Keep the callback fresh without re-binding the listeners every render.
  const handlerRef = useRef(onLongPress);
  useEffect(() => {
    handlerRef.current = onLongPress;
  }, [onLongPress]);

  useEffect(() => {
    const el = container.current;
    if (!enabled || !el) return;

    let pending: Pending | null = null;
    /** Every touch pointer currently down on the container. */
    const activePointers = new Set<number>();
    /** Timestamp until which a follow-up click is swallowed. */
    let suppressClickUntil = 0;

    const cancel = () => {
      if (!pending) return;
      window.clearTimeout(pending.timer);
      pending = null;
    };

    const onPointerDown = (e: PointerEvent) => {
      // Fine pointers keep the right-click path untouched.
      if (e.pointerType !== 'touch') return;
      activePointers.add(e.pointerId);
      // A second finger disarms the gesture COMPLETELY — not just the pending
      // timer. Cancelling the timer alone is not enough: the finger that is
      // still down would re-arm on its next event, so a pinch could still end
      // in a menu. While more than one pointer is down nothing may be armed.
      if (activePointers.size > 1 || !e.isPrimary) {
        cancel();
        return;
      }
      const target = resolveTarget(e);
      if (!target) return;

      const press: Pending = {
        pointerId: e.pointerId,
        startX: e.clientX,
        startY: e.clientY,
        target,
        timer: 0,
      };
      press.timer = window.setTimeout(() => {
        if (pending !== press) return;
        pending = null;
        suppressClickUntil = Date.now() + 500;
        handlerRef.current(press.target);
      }, durationMs);
      pending = press;
    };

    const onPointerMove = (e: PointerEvent) => {
      if (!pending || e.pointerId !== pending.pointerId) return;
      const dx = e.clientX - pending.startX;
      const dy = e.clientY - pending.startY;
      if (Math.hypot(dx, dy) > moveTolerance) cancel();
    };

    const onPointerUp = (e: PointerEvent) => {
      activePointers.delete(e.pointerId);
      if (!pending || e.pointerId !== pending.pointerId) return;
      cancel();
    };

    const onClickCapture = (e: MouseEvent) => {
      if (Date.now() > suppressClickUntil) return;
      suppressClickUntil = 0;
      e.stopPropagation();
      e.preventDefault();
    };

    el.addEventListener('pointerdown', onPointerDown, {passive: true});
    el.addEventListener('pointermove', onPointerMove, {passive: true});
    el.addEventListener('pointerup', onPointerUp, {passive: true});
    el.addEventListener('pointercancel', onPointerUp, {passive: true});
    // Capture on window runs before React's root-container listener, so the
    // app's own pane-click handlers never see the trailing click.
    window.addEventListener('click', onClickCapture, true);

    return () => {
      cancel();
      el.removeEventListener('pointerdown', onPointerDown);
      el.removeEventListener('pointermove', onPointerMove);
      el.removeEventListener('pointerup', onPointerUp);
      el.removeEventListener('pointercancel', onPointerUp);
      window.removeEventListener('click', onClickCapture, true);
    };
  }, [enabled, container, durationMs, moveTolerance]);
}
