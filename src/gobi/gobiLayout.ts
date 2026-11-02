/* ROUND GOBI-FANOUT — the .gobi pipeline's PLACEMENT, ROUTING and LABEL
 * passes, as pure functions in their own module so the compiler file stays
 * the pipeline orchestrator and every rule here is executable by the Node
 * harnesses (no DOM, same convention as src/edgeLabel.ts).
 *
 * WHY THIS MODULE EXISTS. The compiler used to EXCLUDE a member-holding
 * group from the layout pass (its rect "is derived in step 5b") — but the
 * derivation packed members from the group's own un-placed (0,0) placeholder,
 * so the group box landed on top of the fan-out source and every edge left
 * the one shared handle into a knot through the children (task t_acfa0284,
 * measured: topic vs grp = 42,050 px2 of overlap). The fix is structural:
 * the group PARTICIPATES in the layered layout as one entity sized by its
 * packed members, and members are stamped inside wherever the layer engine
 * puts the group. This file owns the three pure pieces of that:
 *
 *   gobiMemberOrder — members ordered so internally-connected ones sit
 *                     ADJACENT on the cross axis (an edge between stacked
 *                     members then crosses only the gap between them).
 *   packGroup       — cross-axis pack: a COLUMN in LR, a ROW in TB, so every
 *                     member's layer-axis face is reachable from outside the
 *                     group box without passing over a sibling.
 *   (routing + label passes live further down in this file.)
 */
import type {Node, Edge} from '@xyflow/react';
import {estimateEdgeLabelWidth} from '../labelMetrics';
import {LABEL_HALF_H_PX} from '../edgeLabel';

export type Box = {x: number; y: number; w: number; h: number};

/** Members ordered for the cross-axis pack: minimise the total span of the
 * group's INTERNAL edges (an internal edge between positions i and j crosses
 * every member between them), tie-broken by authored order so the result is
 * deterministic. Brute force up to 8 members (8! perms × few edges is
 * trivial); above that a greedy most-connected-to-the-placed-set chain. */
export function gobiMemberOrder(members: Node[], edges: Edge[]): Node[] {
  if (members.length <= 2) return members;
  const ids = new Set(members.map((m) => m.id));
  const links: [string, string][] = [];
  for (const e of edges) {
    if (ids.has(e.source) && ids.has(e.target) && e.source !== e.target) links.push([e.source, e.target]);
  }
  if (!links.length) return members;
  const n = members.length;
  const spanCost = (order: Node[]) => {
    const pos = new Map(order.map((m, i) => [m.id, i]));
    let c = 0;
    for (const [a, b] of links) c += Math.abs((pos.get(a) ?? 0) - (pos.get(b) ?? 0));
    return c;
  };
  if (n <= 8) {
    let best: Node[] | null = null;
    let bestCost = Infinity;
    const perm = [...members];
    for (;;) {
      const c = spanCost(perm);
      if (c < bestCost) { bestCost = c; best = [...perm]; }
      // next lexicographic permutation of the array slots
      let i = n - 2;
      while (i >= 0 && perm[i].id > perm[i + 1].id) i--;
      if (i < 0) break;
      let j = n - 1;
      while (perm[j].id < perm[i].id) j--;
      [perm[i], perm[j]] = [perm[j], perm[i]];
      for (let a = i + 1, b = n - 1; a < b; a++, b--) [perm[a], perm[b]] = [perm[b], perm[a]];
    }
    return best ?? members;
  }
  // greedy: seed the most internally-connected member, then repeatedly append
  // the member with the most links into the placed set (authored order ties).
  const deg = new Map(members.map((m) => [m.id, 0]));
  for (const [a, b] of links) { deg.set(a, (deg.get(a) ?? 0) + 1); deg.set(b, (deg.get(b) ?? 0) + 1); }
  const rest = [...members];
  const out: Node[] = [];
  while (rest.length) {
    let pick = 0;
    rest.forEach((m, i) => {
      const into = links.filter(([a, b]) =>
        (a === m.id && out.some((p) => p.id === b)) || (b === m.id && out.some((p) => p.id === a))).length;
      const pickInto = links.filter(([a, b]) =>
        (a === rest[pick].id && out.some((p) => p.id === b)) || (b === rest[pick].id && out.some((p) => p.id === a))).length;
      if (into > pickInto || (into === pickInto && (deg.get(m.id) ?? 0) > (deg.get(rest[pick].id) ?? 0))) pick = i;
    });
    out.push(rest.splice(pick, 1)[0]);
  }
  return out;
}

/** Cross-axis pack of one group's ordered members into LOCAL coordinates
 * (member boxes supplied by the caller — a nested group contributes its own
 * already-packed outer size). Returns the packed extent WITHOUT the group
 * padding; the caller adds 2 * PAD. */
export function packGroup(
  members: Node[],
  sizeOf: (m: Node) => {w: number; h: number},
  direction: 'LR' | 'TB',
  gap: number,
): {w: number; h: number; slots: Map<string, {x: number; y: number}>} {
  const slots = new Map<string, {x: number; y: number}>();
  let w = 0, h = 0, along = 0;
  for (const m of members) {
    const s = sizeOf(m);
    slots.set(m.id, direction === 'LR' ? {x: 0, y: along} : {x: along, y: 0});
    along += (direction === 'LR' ? s.h : s.w) + gap;
    w = Math.max(w, s.w);
    h = Math.max(h, s.h);
  }
  const total = members.length ? along - gap : 0;
  return direction === 'LR' ? {w, h: total, slots} : {w: total, h, slots};
}

/* ===========================================================================
 * ROUTING — the handle pair each edge leaves/enters by, chosen from the
 * endpoints' actual relative geometry AFTER placement. The old fixed pair
 * (right/left in LR) sent an edge to a member stacked BELOW the source
 * sideways through the siblings above it; the chooser picks the dominant axis
 * so an edge between stacked members enters through top/bottom and an edge
 * between layers keeps left/right. Forward layer-to-layer edges resolve to
 * exactly the old pair, so existing boards do not move.
 * =========================================================================== */
export function routeEdgeHandles(edges: Edge[], box: Map<string, Box>): void {
  for (const e of edges) {
    const s = box.get(e.source), t = box.get(e.target);
    if (!s || !t) continue;
    const dx = (t.x + t.w / 2) - (s.x + s.w / 2);
    const dy = (t.y + t.h / 2) - (s.y + s.h / 2);
    if (Math.abs(dx) >= Math.abs(dy)) {
      e.sourceHandle = dx > 0 ? 'right' : 'left';
      e.targetHandle = dx > 0 ? 'left' : 'right';
    } else {
      e.sourceHandle = dy > 0 ? 'bottom' : 'top';
      e.targetHandle = dy > 0 ? 'top' : 'bottom';
    }
  }
}

/** The centre of a node's handle dot on the given side — the point React
 * Flow hands the path generator (the dot is centred ON the border). */
export function handlePoint(b: Box, side?: string): {x: number; y: number} {
  if (side === 'left') return {x: b.x, y: b.y + b.h / 2};
  if (side === 'top') return {x: b.x + b.w / 2, y: b.y};
  if (side === 'bottom') return {x: b.x + b.w / 2, y: b.y + b.h};
  return {x: b.x + b.w, y: b.y + b.h / 2};   /* right (and the historical default) */
}

/* ===========================================================================
 * LABELS — an edge label whose auto-centred box would land on a node box (or
 * on an already-placed label) is offset PERPENDICULAR to the edge, the task's
 * stated remedy ("a label that is unreadable is worse than no label"). The
 * offset is written as the SAME stored pair a manual drag writes
 * (data.labelOffset + labelPinned), so the canvas treats it as a user-pinned
 * label: it renders through the one anchor path (edgeLabel.ts labelAnchor)
 * and stays draggable/resettable. Only labels that NEED it are written — a
 * board whose labels already sit in air compiles to byte-identical JSON.
 * =========================================================================== */
const hitsBox = (a: Box, b: Box) =>
  a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;

export function placeEdgeLabels(
  nodes: Node[],
  edges: Edge[],
  box: Map<string, Box>,
  anchorOf: (e: Edge) => {x: number; y: number; vertical: boolean},
): void {
  const par = new Map(nodes.map((n) => [n.id, n.parentId]));
  const anc = (id: string): Set<string> => {
    const out = new Set<string>();
    let cur = par.get(id);
    while (cur) { out.add(cur); cur = par.get(cur); }
    return out;
  };
  const placedLabels: Box[] = [];
  for (const e of edges) {
    const label = typeof e.label === 'string' ? e.label.trim() : '';
    if (!label) continue;
    const a = anchorOf(e);
    const w = estimateEdgeLabelWidth(label);
    const h = 2 * LABEL_HALF_H_PX;
    const exempt = new Set<string>([...anc(e.source), ...anc(e.target)]);
    const blockers: Box[] = [];
    for (const [id, b] of box) if (!exempt.has(id)) blockers.push(b);
    const base: Box = {x: a.x - w / 2, y: a.y - h / 2, w, h};
    if (!blockers.some((b) => hitsBox(base, b)) && !placedLabels.some((b) => hitsBox(base, b))) {
      placedLabels.push(base);
      continue;
    }
    /* perpendicular candidates: both sides, then stepping further out. */
    let written = false;
    for (const k of [12, 34, 56]) {
      for (const sign of [1, -1]) {
        const off = a.vertical ? {x: sign * (w / 2 + k), y: 0} : {x: 0, y: sign * (h / 2 + k)};
        const cand: Box = {x: a.x + off.x - w / 2, y: a.y + off.y - h / 2, w, h};
        if (!blockers.some((b) => hitsBox(cand, b)) && !placedLabels.some((b) => hitsBox(cand, b))) {
          (e.data as Record<string, unknown>).labelOffset = off;
          (e.data as Record<string, unknown>).labelPinned = true;
          placedLabels.push(cand);
          written = true;
          break;
        }
      }
      if (written) break;
    }
    if (!written) placedLabels.push(base);
  }
}
