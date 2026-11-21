/* GROUP-LOGICAL (t_eb8fab7e) — pure helpers for the LOGICAL group.
 *
 * Cmd+G binds a selection into ONE block: a React Flow `type: 'group'` node
 * (v12's builtin GroupNode renders null, so nothing is painted). This is a
 * DIFFERENT object from the palette's `shape: 'group'` FRAME (the dashed
 * container with a banner) — every helper here keys on the RF type so the
 * two can never be confused.
 *
 * The grammar is Miro's, and only the MISSING half lives here (measured in
 * @xyflow source, 2026-11-16): clicking a child selects the child ALONE
 * (no bubbling), so click-expansion to the whole block is ours; dragging a
 * selected block is already the library's (getDragItems moves the selected
 * parent and children ride along); deleting a parent takes its children
 * (getElementsToRemove).
 */
import type {Node} from '@xyflow/react';
import {absPos} from './groupObject';

export const isLogicalGroup = (n: Node): boolean => n.type === 'group';

/* The node's nearest logical-group ancestor, or null when it is not part
 * of a logical block (frame children keep their individual behaviour). */
export function logicalGroupOf(n: Node, byId: Map<string, Node>): Node | null {
  let p = n.parentId ? byId.get(n.parentId) : undefined;
  while (p) {
    if (isLogicalGroup(p)) return p;
    p = p.parentId ? byId.get(p.parentId) : undefined;
  }
  return null;
}

/* The grammar's click: a plain click on any part of a logical block selects
 * the WHOLE block (container + every member). Returns the next array, or
 * null when the click is not part of a logical block — then React Flow's
 * individual selection stands untouched. Pure; never mutates the input. */
export function blockSelection(nodes: Node[], clickedId: string): Node[] | null {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const clicked = byId.get(clickedId);
  if (!clicked) return null;
  const g = isLogicalGroup(clicked) ? clicked : logicalGroupOf(clicked, byId);
  if (!g) return null;
  const ids = new Set([g.id]);
  for (const n of nodes) if (n.parentId === g.id) ids.add(n.id);
  return nodes.map((n) => ({...n, selected: ids.has(n.id)}));
}

/* GROUP-INSIDE-CLEAR (t_7b68a96e): is the block still the CONTEXT? Entering
 * a logical group is a context, not a mode — its only paint is the quiet
 * boundary, so the state that draws it may live exactly as long as the block
 * holds the selection. True while the container itself OR any direct member
 * is selected, and FALSE when the group is gone (member delete, undo of the
 * group, board switch). One derivation therefore covers every exit route:
 * Escape, a pane click, a click on a node outside, a marquee elsewhere, a
 * member delete, and any future gesture nobody has written yet. */
export function blockHasSelection(nodes: Node[], groupId: string | null): boolean {
  const g = nodes.find((n) => n.id === groupId);
  if (!g || !isLogicalGroup(g)) return false;
  return !!g.selected || nodes.some((n) => n.parentId === groupId && n.selected);
}

/* Escape inside the grammar: selection returns to the group container
 * alone (the LEAVE half — the enter half is the hook's transient state). */
export function groupOnlySelection(nodes: Node[], groupId: string): Node[] {
  return nodes.map((n) => ({...n, selected: n.id === groupId}));
}

/* GROUP-SELECTION (t_d2a66b62): the union MEMBERSHIP shared by the dashed
 * selection box and the rotate grip. A selected node joins the union when it
 * is NOT the logical container itself (it paints nothing, and its rect is
 * the unrotated bbox + GROUP_PAD — unioning it compressed and offset the
 * box, the owner's defect a) and it is either top-level or a member of a
 * logical block, reported at its ABSOLUTE position (members store
 * parent-relative positions after Cmd+G — feeding a relative coordinate
 * into the union was the same defect). Frame children stay excluded, so the
 * palette FRAME's own selection box is unchanged. */
export function unionMembers(nodes: Node[]): {n: Node; ax: number; ay: number}[] {
  const byId = new Map(nodes.map((m) => [m.id, m]));
  const out: {n: Node; ax: number; ay: number}[] = [];
  for (const n of nodes) {
    if (!n.selected || isLogicalGroup(n)) continue;
    if (n.parentId && !logicalGroupOf(n, byId)) continue;
    const a = absPos(n, byId);
    out.push({n, ax: a.x, ay: a.y});
  }
  return out;
}

/* GROUP-BOUNDARY-INSIDE (t_42fb2888): the MEMBERS of ONE logical group —
 * the quiet inside-boundary's union set. Direct children only (the grammar
 * is one level: blockSelection parents direct children and createGroup
 * refuses nesting), the container never joins (it paints nothing), every
 * member reported at its ABSOLUTE position exactly like unionMembers.
 * A non-logical groupId (a palette FRAME) returns nothing, so the boundary
 * can never be painted over a frame's own dashed border. */
export function groupMembers(nodes: Node[], groupId: string): {n: Node; ax: number; ay: number}[] {
  const byId = new Map(nodes.map((m) => [m.id, m]));
  const g = byId.get(groupId);
  if (!g || !isLogicalGroup(g)) return [];
  const out: {n: Node; ax: number; ay: number}[] = [];
  for (const n of nodes) {
    if (n.parentId !== groupId) continue;
    const a = absPos(n, byId);
    out.push({n, ax: a.x, ay: a.y});
  }
  return out;
}

/* GROUP-GAP-DRAG (t_10563e73): is the selection EXACTLY one logical block?
 * Returns the container's id when (and only when) the container is selected,
 * EVERY direct member is selected, and NOTHING outside the block is — the
 * one state in which the block's painted frame is the object's own surface.
 * This is the D1 AMENDMENT's activation predicate: the interior of the frame
 * stays inert while the block is unselected (the unselected arm of the
 * grammar is untouched — nothing selects through the gap), and becomes the
 * block's drag surface only in this exactly-selected state, so a mixed
 * selection (block + loose nodes) never grows a second drag surface and the
 * RF `type: 'group'` body is never made selectable in the ordinary sense.
 * Pure; returns null for every other selection shape. */
export function selectedLogicalBlock(nodes: Node[]): string | null {
  let gid: string | null = null;
  for (const n of nodes) {
    if (n.selected && isLogicalGroup(n)) {
      if (gid) return null; /* two containers selected — not one block */
      gid = n.id;
    }
  }
  if (!gid) return null;
  let members = 0;
  for (const n of nodes) {
    if (n.id === gid) continue; /* the container itself IS the block's body */
    if (n.parentId !== gid) {
      if (n.selected) return null; /* something outside the block rides along */
      continue;
    }
    if (!n.selected) return null; /* a member left out is not "the block" */
    members++;
  }
  return members > 0 ? gid : null;
}
