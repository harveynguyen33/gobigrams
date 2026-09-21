/* ROUND AK, PASS 2 — the ONE pointer gesture every canvas affordance on an edge
   starts from, so a single pointerdown can never begin two of them.

   WHY THIS FILE EXISTS. `GoblinEdge.onBendDown` (ROUND S/T/U) already owned a
   complete, correct gesture: capture the pointer, listen on `document` (the
   element is re-rendered by every write the drag itself triggers), convert
   client → flow coordinates against the PANE's rect and React Flow's own
   `[x, y, zoom]`, lock the gesture's axis once, and report `start` / `move` /
   `end` to a writer that lives in `App`. Pass 2 has to give the LABEL the same
   gesture — "make the label itself the drag target", the Sirius Web model — and
   a second, parallel copy of that machinery is precisely how two affordances
   end up BOTH responding to one pointerdown.

   So the machinery moved here, ONCE, as a hook. The bend handle and the label
   are now two CALLERS of it, which makes the mutual exclusion structural rather
   than a matter of two handlers each remembering to call `stopPropagation`:
   both `onPointerDown`s run on the same element subtree during the same bubble,
   and `gestureClaimed` closes the window before the second one is reached.

   WHAT IT DELIBERATELY IS NOT. It is not a general drag library. It does not
   own the axis decision (`edgeBend.bendAxisFor` does, from the kind), it does
   not own the writer (`App.onBend` / `App.onLabelDrag` do), and it stores no
   data of its own. It converts coordinates, guards the click-vs-drag threshold,
   and reports.

   NO HOVER IS REQUIRED ANYWHERE IN IT. Pointer events only, `setPointerCapture`
   so a fast drag survives leaving the element, and `touch-action: none` in the
   sheet on both callers — so the same code runs for a finger. */

import {useRef} from 'react';
import type {Pt} from './edgeBend';

export type GestureArgs = {
  /** The element the gesture started on — pointer capture is taken here. */
  el: Element;
  /** The pane this edge is drawn in. Its rect is the origin the coordinate
   *  conversion measures against, because RF's `transform` maps flow space into
   *  the pane, not into the page. */
  pane: HTMLElement | null;
  /** React Flow's live `transform` — the same `[x, y, zoom]` its own
   *  `screenToFlowPosition` reads. Read through a ref, so a pan mid-gesture
   *  cannot make the closure stale. */
  transform: [number, number, number];
  pointerId: number;
  clientX: number;
  clientY: number;
  /** Report a real movement. `dx`/`dy` are the TOTAL delta from the gesture's
   *  origin, in flow units. Called only once `lock` has been passed. */
  onMove: (p: Pt, dx: number, dy: number) => void;
  /** The gesture ended after at least one reported move. Never called for a
   *  click. */
  onEnd: (p: Pt) => void;
  /** How far the pointer must travel before the gesture counts as a DRAG.
   *  `0` is Sirius Web's own click-vs-drag guard (any non-zero delta); the bend
   *  handle passes `LOCK_PX`, this project's pre-existing 3px jitter threshold.
   *  One predicate (`edgeLabel.movedBy`), so the two callers cannot disagree
   *  about what a drag is. */
  lock?: number;
};

/** WHAT A `claim`ed POINTERDOWN HANDLER RECEIVES — the EVENT, described by the
 *  six members this module and its callers actually read.
 *
 *  WHY NOT `React.PointerEvent`. This module is deliberately React-type-free (it
 *  is shared machinery, and a caller might hand it a plain DOM listener), and
 *  naming React's event here would drag that dependency into it.
 *
 *  WHY NOT `GestureArgs`. The gesture's own arguments are not what a handler is
 *  GIVEN: `pointerId`, `clientX` and `clientY` are the event's own members, and
 *  `el` is its `currentTarget`. The rest of `GestureArgs` (`pane`, `transform`,
 *  `onMove`, `onEnd`) is what the CALLER passes ON to `beginGesture`, from
 *  closure state — not something the event could carry. So the handler's
 *  parameter is the event, described by the members that matter, and `claim`
 *  adds nothing: the wrapper's whole job is the mutual-exclusion latch.
 *
 *  It is an intersection-free object type on purpose, because React's own
 *  `PointerEventHandler<HTMLDivElement>` has to be assignable to it at the JSX
 *  call site — `React.PointerEvent<T>` carries all six members, so that holds —
 *  while a full `React.PointerEvent` is what the ORIGINAL signature declared and
 *  is exactly what `GestureArgs` could never be. */
export type GestureDown = {
  pointerId: number;
  clientX: number;
  clientY: number;
  currentTarget: EventTarget & Element;
  stopPropagation: () => void;
  preventDefault: () => void;
};

export function useEdgeGesture() {
  /** Open for the duration of one pointerdown, and closed by whichever caller
   *  claims it. A module-level latch would leak across edges; this one is per
   *  component instance, which is per edge, which is the scope that matters —
   *  two affordances of the SAME edge. */
  const claimed = useRef(false);

  return {
    /** Wrap a pointerdown handler. `run` is called only if the gesture was
     *  claimed, so the claim and the work can never come apart. */
    claim(run: (e: GestureDown) => void) {
      return (e: GestureDown) => {
        if (claimed.current) return;
        claimed.current = true;
        // Released on the next macrotask: every pointerdown handler for this
        // event has run by then, and a later gesture is a later event.
        window.setTimeout(() => { claimed.current = false; }, 0);
        run(e);
      };
    },
    /** Is a gesture of this edge already open? Read by the handlers that want to
     *  stay out of the way rather than claim. */
    isClaimed: () => claimed.current,
  };
}

/** The gesture body: capture, convert, threshold, report, clean up.
 *
 *  `onStart` is called ONCE, synchronously, BEFORE any movement — that is where
 *  the single history entry goes (`App` pushes it there), which is the
 *  convention this project already paid for: a per-frame push buries the user's
 *  older undo steps (`src/resizeHistory.ts`). */
export function beginGesture(args: {
  el: Element;
  pane: HTMLElement | null;
  transform: [number, number, number];
  pointerId: number;
  clientX: number;
  clientY: number;
  lock: number;
  onStart: () => void;
  onMove: (p: Pt, dx: number, dy: number) => void;
  onEnd: (p: Pt) => void;
}) {
  const {el, pane, transform, pointerId, lock, onStart, onMove, onEnd} = args;
  el.setPointerCapture?.(pointerId);
  onStart();

  /** Client → flow coordinates. The DOM rect is the PANE's and RF's own
   *  `transform` is exactly the `[x, y, zoom]` that maps flow coords into it, so
   *  this is RF's own `screenToFlowPosition` arithmetic without needing the
   *  instance — `getBoundingClientRect` for the pane rather than for
   *  `.react-flow`, which differ by the pane's own offset in a layout that wraps
   *  it. */
  const toFlow = (ev: {clientX: number; clientY: number}): Pt | null => {
    const b = pane?.getBoundingClientRect();
    if (!b) return null;
    const t = transform;
    return {x: (ev.clientX - b.left - t[0]) / t[2], y: (ev.clientY - b.top - t[1]) / t[2]};
  };

  const origin = toFlow(args);
  let last: Pt | null = origin;
  let moved = false;

  const move = (ev: PointerEvent) => {
    const p = toFlow(ev);
    if (!p) return;
    last = p;
    const dx = origin ? p.x - origin.x : 0;
    const dy = origin ? p.y - origin.y : 0;
    // BELOW THE THRESHOLD NOTHING IS REPORTED: a sub-threshold move is the
    // jitter of a click, and a click must still select the edge and a
    // double-click must still open the editor.
    if (!moved) {
      if (Math.hypot(dx, dy) <= lock) return;
      moved = true;
    }
    onMove(p, dx, dy);
  };

  const up = (ev: PointerEvent) => {
    document.removeEventListener('pointermove', move);
    document.removeEventListener('pointerup', up);
    document.removeEventListener('pointercancel', up);
    el.releasePointerCapture?.(ev.pointerId);
    // A CLICK REPORTS NOTHING AT ALL — not even an end. `moved` is the
    // click-vs-drag guard: it is false when the pointer never left the
    // threshold, and `onEnd` is what runs the gesture's own auto-remove /
    // snap-back logic, which a plain click has no business triggering.
    if (moved && last) onEnd(last);
  };

  document.addEventListener('pointermove', move);
  document.addEventListener('pointerup', up);
  document.addEventListener('pointercancel', up);
}
