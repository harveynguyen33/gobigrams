/* LOCK v1 (t_c5023f3b part B) — pure node-lock maths.
 *
 * A lock rides the board JSON as `data.locked` on the node. Effect (derived
 * at render time, never stored on children): draggable / deletable /
 * connectable false, resize grips hidden — but the node stays SELECTABLE
 * (otherwise it could never be unlocked) and stays a valid align-guide
 * neighbour. A locked GROUP locks its children BY INHERITANCE: `lockedIdSet`
 * walks the parentId chain, so a child of a locked group is locked even
 * though its own data carries nothing.
 *
 * The .gobi text format IGNORES lock at v1 (named limitation); SVG export is
 * UNCHANGED — locking is an editor concept (round-lock A3 pins it byte-identically).
 */
import type {Node} from '@xyflow/react';
import {isLogicalGroup} from './groupLogical';

export type LockResult =
  | {ok: true; nodes: Node[]; locked: boolean; count: number; written: number}
  | {ok: false; reason: string};

/* LOCK-COUNT (t_b3079954) — the count that faces the USER, derived ONCE.
 *
 * Cmd+G binds a selection into a `type: 'group'` node that PAINTS NOTHING but
 * stays an ordinary React Flow selection member, so a 2-card block arrives here
 * as THREE selected nodes. A count that includes the binder names a node the
 * user cannot see: the lock flash read "Locked 3 nodes" over two cards, and the
 * toolbar badge printed 3. The WRITE is untouched — the binder must keep taking
 * the flag (a block's effective lock is derived from it, which is what stops a
 * member being dragged out of its block) — so `toggleLock` reports the visible
 * count while still writing every node whose own flag flipped (`written`).
 * Anything else that counts a selection for the user reads this, not `.length`.
 */
export const visibleSelected = (nodes: Node[]): Node[] =>
  nodes.filter((n) => n.selected && !isLogicalGroup(n));

export const visibleSelectedCount = (nodes: Node[]): number => visibleSelected(nodes).length;

/* The set of ids that are EFFECTIVELY locked: every node carrying
 * data.locked, plus every descendant of such a node (inheritance). */
export function lockedIdSet(nodes: Node[]): Set<string> {
  const direct = new Set<string>();
  for (const n of nodes) if ((n.data as any)?.locked) direct.add(n.id);
  const all = new Set(direct);
  const byId = new Map(nodes.map((n) => [n.id, n]));
  for (const n of nodes) {
    let p = n.parentId ? byId.get(n.parentId) : undefined;
    while (p) {
      if (direct.has(p.id)) {
        all.add(n.id);
        break;
      }
      p = p.parentId ? byId.get(p.parentId) : undefined;
    }
  }
  /* GROUP-LOGICAL (t_eb8fab7e): a locked member ANCHORS its logical block — the
   * RF container is effectively locked too, so no drag of the block can carry
   * the locked member out (a child always follows a moving parent). Derived. */
  for (const g of nodes) if (g.type === 'group' && !all.has(g.id) &&
      nodes.some((c) => c.parentId === g.id && all.has(c.id))) all.add(g.id);
  return all;
}

/* The context menu's Lock-Unlock row, derived ONCE for every surface.
 *
 * MENU-STATES (t_8b56f71a) rule. The row is a single FLIP control, so "Lock
 * is disabled while everything is locked" is expressed by the row reading
 * Unlock; it is disabled only when the action could not change anything:
 *   - nothing selected -> Lock, disabled;
 *   - the effective lock is INHERITED (no selected node carries data.locked
 *     itself), e.g. a child of a locked group -> Unlock, DISABLED, with the
 *     reason: writing `locked:false` on the child would not unlock it, the
 *     GROUP owns the flag. Selecting the group enables the row;
 *   - a mixed selection -> Unlock (the convergent rule — a single effective lock
 *     means unlock-all), enabled because a write is possible.
 */
export type LockRow = {label: 'Lock' | 'Unlock'; disabled: boolean; hint?: string};

export function lockRow(nodes: Node[]): LockRow {
  const picked = nodes.filter((n) => n.selected);
  if (!picked.length) return {label: 'Lock', disabled: true};
  const locked = lockedIdSet(nodes);
  if (!picked.some((n) => locked.has(n.id))) return {label: 'Lock', disabled: false};
  if (picked.some((n) => (n.data as any)?.locked === true)) return {label: 'Unlock', disabled: false};
  return {label: 'Unlock', disabled: true, hint: 'locked by its group'};
}

/* Alt+L / the context menu's Lock-Unlock row: the toggle is a SET decision —
 * any effectively-locked member of the selection means UNLOCK all selected,
 * otherwise LOCK all selected. Lock is written ONLY on the selected nodes
 * themselves; children keep inheriting from their group (derived, never
 * written). Returns the NEW array; never mutates the input. */
export function toggleLock(nodes: Node[]): LockResult {
  const picked = nodes.filter((n) => n.selected);
  if (!picked.length) return {ok: false, reason: 'Select a node to lock'};
  const locked = lockedIdSet(nodes);
  const unlock = picked.some((n) => locked.has(n.id));
  /* Only a node carrying its OWN flag can be written: a member locked by its
   * group would take `locked:false` and stay locked, so a no-op is never
   * counted as a success (MENU-STATES, t_8b56f71a). */
  let written = 0; /* every node whose OWN flag flipped — the binder included */
  let count = 0; /* of those, only the ones the user can SEE */
  const out = nodes.map((n) => {
    if (!n.selected) return n;
    if (((n.data as any)?.locked === true) === !unlock) return n;
    written++;
    if (!isLogicalGroup(n)) count++;
    return {...n, data: {...(n.data as any), locked: !unlock}};
  });
  /* The refusal keys on what was actually WRITTEN, never on the visible count:
   * a binder-only selection writes the flag, so it is a real unlock even though
   * it names zero visible nodes. */
  if (unlock && written === 0) return {ok: false, reason: 'Locked by its group — unlock the group'};
  return {ok: true, nodes: out, locked: !unlock, count, written};
}
