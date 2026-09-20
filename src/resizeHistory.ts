/**
 * ROUND 5 — A RESIZE IS ONE UNDOABLE STEP, EXACTLY LIKE A DRAG.
 *
 * THE REPORTED DEFECT (Harvey, verbatim):
 *   "nếu khi shape ko có liên kết với ai, và tôi kéo nó dài ra hay ngắn đi.
 *    Thì nó k đc tính là 1 history move."
 * Dragging a node to MOVE it is undoable; RESIZING one is not — Ctrl+Z after a
 * resize left the new size in place.
 *
 * WHY IT HAPPENED, READ OUT OF THE TWO LIBRARIES RATHER THAN GUESSED:
 *
 *   1. A MOVE is covered at the GESTURE level. `onNodeDragStart` is wired on
 *      the canvas and calls `pushHistory()` once, before the node moves.
 *      A RESIZE has no equivalent: `NodeResizer` was rendered with geometry
 *      props only (`minWidth` / `minHeight` / the two class names), so the
 *      gesture-callback route was never taken. Nothing pushed.
 *   2. `@xyflow/react`'s `ResizeControl` DOES tell us, on every frame, that a
 *      resize is in flight — it pushes a node change object carrying
 *      `{type: 'dimensions', resizing: true, setAttributes, dimensions}` from
 *      its `onChange`, and one final `{type: 'dimensions', resizing: false}`
 *      from its `onEnd`. Those changes reach our `handleNodesChange`, which
 *      only looked at `type === 'remove'`. The resize fell straight through.
 *   3. The size PERSISTS because React Flow's own `applyChanges` writes the
 *      change into the node: `measured` becomes the new dimensions and
 *      `width` / `height` are set when `setAttributes` allows it. So the node
 *      really is 300x200 afterwards — there is simply no history entry that
 *      remembers it was 200x141.
 *
 * WHY THE CHANGE-LEVEL FIELD AND NOT `onResizeStart`:
 *   `onResizeStart` fires when d3-drag STARTS, which includes a mere CLICK on a
 *   grip that never moves a pixel (`XYResizer`'s drag `on('start')` runs before
 *   any dimension is compared; its `on('end')` early-returns when nothing was
 *   resized). Hooking that would put a step on the undo stack for a click that
 *   changed nothing. The `resizing: true` flag only exists on frames where a
 *   dimension ACTUALLY changed, so it is the honest signal for "the user is
 *   resizing". It is also the field this repo was told to key off.
 *
 * WHY A GUARD AND NOT A PUSH PER FRAME:
 *   One continuous drag of a grip emits `resizing: true` on EVERY frame.
 *   Pushing per frame would bury the user's real history under hundreds of
 *   steps — a worse bug than the one being fixed. The guard collapses the whole
 *   gesture to exactly ONE entry, and `resizing: false` at the end re-arms it so
 *   the NEXT resize is undoable too.
 *
 * The entry itself is the state BEFORE the resize: `pushHistory()` snapshots
 * `nodesRef.current`, which at the first resizing frame is still the
 * pre-gesture size. Nothing here changes what a snapshot contains.
 *
 * This module is deliberately pure and React-free so `checks/` can import and
 * EXECUTE the shipped decision function instead of restating it. The geometry,
 * the floors (`NODE_MIN_W` / `NODE_MIN_H`) and the gesture feel are untouched by
 * this round.
 */
import type {NodeChange} from '@xyflow/react';

/**
 * Per-gesture latch. One instance lives in `App.tsx` inside a `useRef`, so it
 * survives re-renders for the length of a gesture.
 */
export type ResizeGuard = {active: boolean};

export const newResizeGuard = (): ResizeGuard => ({active: false});

/**
 * Decide whether this batch of node changes should leave a history entry.
 *
 * Returns `true` for the FIRST batch of a resize gesture and `false` for every
 * later frame of the same gesture, so one continuous drag of a grip pushes
 * exactly one entry. `resizing: false` (React Flow's end-of-gesture change)
 * clears the latch.
 *
 * MUTATES `guard` — the latch is the function's own state, not the caller's.
 *
 * Position changes are deliberately NOT recorded here. A node move already
 * pushes at the gesture level (`onNodeDragStart`), and React Flow emits a
 * `position` change per frame of that drag; recording it here as well would
 * double-push every move. Removals are also out: they belong to `noteRemove`,
 * which merges the node and edge callbacks of one Del press into one entry.
 */
export function recordResizeGesture(guard: ResizeGuard, changes: readonly NodeChange[]): boolean {
  let resizing = false;
  let ended = false;

  for (const c of changes) {
    if (c.type !== 'dimensions') continue;
    if (c.resizing === true) resizing = true;
    else if (c.resizing === false) ended = true;
  }

  if (resizing) {
    if (guard.active) return false;
    guard.active = true;
    return true;
  }

  // End of gesture (or a batch with no resize at all): re-arm the latch.
  if (ended) guard.active = false;
  return false;
}
