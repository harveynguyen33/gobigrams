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
 *      from its `onEnd`. Those changes reach our change handler, which
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
import type {Node, NodeChange} from '@xyflow/react';

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

/* ---------------------------------------------------------------------------
 * TABLE-GRIP (t_ef4b3f8a) — A TABLE'S SIZE IS DERIVED, SO ITS GRIPS DRIVE THE
 * SCALE AND NOTHING ELSE.
 *
 * Harvey (2026-11-09): "tại sao k cho scale như các hình shapes khác??" — every
 * other node resizes by its corner grips, the table could not. The table got the
 * same `<NodeResizer>`; what it may NOT get is the same DIMENSION WRITE. Its box
 * is MEASURED by the core (`tableNaturalWidth(content, style, density, scale)`),
 * and `applyChanges` writes `width`/`height` onto the node whenever the change
 * carries `setAttributes` — a stored card size that silently diverges from the
 * core's measure is the 250-vs-278 defect this repo already paid for once.
 *
 * So the gesture's change is CONVERTED, never applied: its width becomes one rung
 * of the ladder the inspector offers (a 0.75 floor in 5% steps — the SAME
 * numbers as `TABLE_SCALE_MIN/STEP` in the core; the harness pins them) and is
 * written to the node's `scale`. NO CEILING (TABLE-SCALE-NOMAX, t_7f37db5b): a
 * far drag keeps landing on rungs (2.0, 4.0 …) — the old 1.5 cap refused every
 * bigger table. The MIN-side clamp stays (RAIL-COVER-2 / TABLE-GRIP-Z). The
 * change is then DROPPED, together with the
 * `position` change React Flow emits beside it for a top/left grip — dropping the
 * dimensions but keeping the position would SLIDE the card while it is resized.
 *
 * `naturalWidth` is INJECTED (App passes the core's `tableNaturalWidth`) so this
 * module keeps importing nothing but types and `checks/` can execute it directly.
 * The end-of-gesture frame (`resizing: false`) is dropped without a write: it
 * carries no dimension the frames did not already convert, and a mere click on a
 * grip must not stamp a `scale` onto a table that never moved.
 * ------------------------------------------------------------------------- */
export const TABLE_GRIP_MIN = 0.75, TABLE_GRIP_STEP = 0.05;

export function tableGripChanges(
  changes: readonly NodeChange[],
  nodes: readonly Node[],
  setNodes: (u: (ns: Node[]) => Node[]) => void,
  style: unknown,
  density: unknown,
  naturalWidth: (data: unknown, style: unknown, density: unknown, scale: number) => number,
): NodeChange[] {
  /* ONLY a gesture frame carries `resizing` — React Flow emits a plain
     `{type:'dimensions', dimensions}` change for its OWN measurement pass, and
     dropping THAT would leave the node unmeasured (invisible, unclickable). */
  const dims = changes.filter((c): c is Extract<NodeChange, {type: 'dimensions'}> =>
    c.type === 'dimensions' && typeof c.resizing === 'boolean');
  if (!dims.length) return changes as NodeChange[];
  const grip = new Set(dims.filter(c => nodes.some(n => n.id === c.id && n.type === 'table')).map(c => c.id));
  if (!grip.size) return changes as NodeChange[];
  const scale = new Map<string, number>();
  for (const c of dims) {
    const w = c.dimensions?.width;
    const n = grip.has(c.id) ? nodes.find(m => m.id === c.id) : undefined;
    if (!n || !w || c.resizing === false) continue;
    const one = naturalWidth(n.data, style, density, 1);
    const rung = Math.round(w / one / TABLE_GRIP_STEP) * TABLE_GRIP_STEP;
    /* whole PERCENT: 0.05 steps float (0.8500000000000001 measured), and the
       core's resolveTableScale snaps in whole percent for the same reason. NO
       MAX: the rung itself is the value, however far the drag went. */
    scale.set(c.id, Math.round(Math.max(TABLE_GRIP_MIN, rung) * 100) / 100);
  }
  if (scale.size) setNodes(ns => ns.map(n => scale.has(n.id)
    ? {...n, data: {...(n.data as Record<string, unknown>), scale: scale.get(n.id)}}
    : n));
  return changes.filter(c => {
    if (c.type === 'add') return true;
    if (!grip.has(c.id)) return true;
    /* the paired position change would SLIDE the card while it is resized */
    if (c.type === 'position') return false;
    /* a measurement frame in the same batch is not ours to drop */
    return !(c.type === 'dimensions' && typeof c.resizing === 'boolean');
  });
}
