/* GROUP-OBJECT v1 (t_c5023f3b) — pure group/ungroup maths.
 *
 * A group is a container NODE (shape 'group', the same node the palette
 * drops); Cmd+G wraps a selection in one. Everything here is PURE: it takes
 * the current nodes array and returns the next array (or a refusal reason),
 * so the harness can execute it and App only wires pushHistory + setNodes.
 *
 * v1 limitations (recorded in the task, deliberate):
 *  - resizing a group does NOT scale its children (needs a per-child
 *    transform rewrite incl. rotation — v2);
 *  - group-in-group nesting is not added: a node already inside a group is
 *    refused, with a flash naming the reason.
 */
import type {Node} from '@xyflow/react';

export const GROUP_PAD = 16;

/* Context-menu enabled state, derived from the same rules as createGroup so
 * the menu can never offer a grouping the keyboard would refuse. */
export const canGroup = (nodes: Node[]): boolean => selectReason(nodes) === null;
export const canUngroup = (nodes: Node[]): boolean =>
  nodes.some((n) => n.selected && (n.parentId != null || (n.data as any)?.shape === 'group' || n.type === 'group'));

export type GroupResult =
  | {ok: true; nodes: Node[]; groupId: string; memberIds: string[]}
  | {ok: false; reason: string};

/* A groupable node is a movable top-level content node: NOT a label kind,
 * NOT itself a group (the palette frame OR the RF logical group), and NOT
 * already a member of another group. */
export function groupable(n: Node): boolean {
  if (n.type === 'label' || n.type === 'group' || n.parentId) return false;
  return (n.data as any)?.shape !== 'group';
}

const selectReason = (nodes: Node[]): string | null => {
  const picked = nodes.filter((n) => n.selected);
  if (picked.length < 2) return 'Select at least two nodes to group';
  const child = picked.find((n) => n.parentId);
  if (child) return `“${(child.data as any)?.title ?? child.id}” is already inside a group`;
  const label = picked.find((n) => n.type === 'label');
  if (label) return 'Labels cannot be grouped';
  const grp = picked.find((n) => (n.data as any)?.shape === 'group' || n.type === 'group');
  if (grp) return `“${(grp.data as any)?.title ?? grp.id}” is already a group`;
  return null;
};

/* Wrap the selection in ONE group node whose bounds are the selection bbox
 * + GROUP_PAD on every side. Members keep their z-order; the group is
 * inserted just before the first member so children never paint above it.
 * Returns the NEW array; never mutates the input (undo restores the old
 * array verbatim — one history entry removes the group again). */
export function createGroup(nodes: Node[], groupId: string): GroupResult {
  const reason = selectReason(nodes);
  if (reason) return {ok: false, reason};
  const members = nodes.filter((n) => n.selected);
  const minX = Math.min(...members.map((n) => n.position.x));
  const minY = Math.min(...members.map((n) => n.position.y));
  const maxX = Math.max(...members.map((n) => n.position.x + ((n.measured?.width ?? (n.style?.width as number)) || 190)));
  const maxY = Math.max(...members.map((n) => n.position.y + ((n.measured?.height ?? (n.style?.height as number)) || 95)));
  const gx = minX - GROUP_PAD;
  const gy = minY - GROUP_PAD;
  const gw = maxX - minX + GROUP_PAD * 2;
  const gh = maxY - minY + GROUP_PAD * 2;
  const firstIdx = nodes.findIndex((n) => n.selected);
  /* GROUP-LOGICAL (t_eb8fab7e): Cmd+G makes an INVISIBLE RF logical group (v12's builtin GroupNode renders null) — members act as one block, nothing painted; the palette's shape:'group' FRAME stays a different object. */
  const group: Node = {
    id: groupId,
    type: 'group',
    position: {x: gx, y: gy},
    data: {},
    /* GROUP-SELECTION (t_d2a66b62, defect b): the fresh group STAYS selected
       — Miro keeps what you just created selected, and the box paints from
       that state. Members keep their selection too (the line below no longer
       clears it); ONE history entry, pushed by the caller. */
    style: {width: gw, height: gh}, selected: true,
  };
  const rel = new Map(members.map((m) => [m.id, {x: m.position.x - gx, y: m.position.y - gy}]));
  const next: Node[] = [];
  for (const n of nodes) {
    if (n.id === members[0].id) next.push(group); /* z-order: group precedes its members */
    const r = rel.get(n.id);
    next.push(r ? {...n, parentId: groupId, position: {x: r.x, y: r.y}} : n);
  }
  return {ok: true, nodes: next, groupId, memberIds: members.map((m) => m.id)};
}

/* Absolute (flow-space) position of a node, resolving the parentId chain. */
export function absPos(n: Node, byId: Map<string, Node>): {x: number; y: number} {
  let x = n.position.x;
  let y = n.position.y;
  let p = n.parentId ? byId.get(n.parentId) : undefined;
  while (p) {
    x += p.position.x;
    y += p.position.y;
    p = p.parentId ? byId.get(p.parentId) : undefined;
  }
  return {x, y};
}

/* Cmd+Shift+G: the selection may be a GROUP (restore every child to absolute
 * coordinates and delete the group) or a CHILD (detach it from its group
 * keeping its on-screen position). ONE history entry each — callers wrap. */
export function ungroup(nodes: Node[]): GroupResult {
  const picked = nodes.filter((n) => n.selected);
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const groups = picked.filter((n) => (n.data as any)?.shape === 'group' || n.type === 'group');
  const children = picked.filter((n) => n.parentId && (n.data as any)?.shape !== 'group');
  if (!groups.length && !children.length) {
    return {ok: false, reason: 'Select a group or a member of one to ungroup'};
  }
  const remove = new Set(groups.map((g) => g.id));
  const detach = new Set<string>();
  for (const g of groups) {
    for (const c of nodes) if (c.parentId === g.id) detach.add(c.id);
  }
  for (const c of children) detach.add(c.id);
  const next: Node[] = [];
  for (const n of nodes) {
    if (remove.has(n.id)) {
      /* the group's children are re-inserted at its index, in board order */
      for (const c of nodes) {
        if (c.parentId === n.id && !c.selected) {
          const a = absPos(c, byId);
          next.push({...c, parentId: undefined, position: {x: a.x, y: a.y}});
        }
      }
      continue;
    }
    if (detach.has(n.id)) {
      const a = absPos(n, byId);
      next.push({...n, selected: false, parentId: undefined, position: {x: a.x, y: a.y}});
      continue;
    }
    next.push(n);
  }
  return {ok: true, nodes: next, groupId: groups[0]?.id ?? '', memberIds: [...detach]};
}
