/* ROUND GOBI-FANOUT — the .gobi pipeline's PLACEMENT, ROUTING and LABEL
 * passes, as pure functions in their own module so the compiler file stays
 * the pipeline orchestrator and every rule here is executable by the FlowNode
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
import type {FlowNode, FlowEdge} from './model/flowTypes';
import {estimateEdgeLabelWidth} from './model/labelMetrics';
import {LABEL_HALF_H_PX} from './model/edgeLabel';

export type Box = {x: number; y: number; w: number; h: number};

/** Members ordered for the cross-axis pack: minimise the total span of the
 * group's INTERNAL edges (an internal edge between positions i and j crosses
 * every member between them), tie-broken by authored order so the result is
 * deterministic. Brute force up to 8 members (8! perms × few edges is
 * trivial); above that a greedy most-connected-to-the-placed-set chain. */
export function gobiMemberOrder(members: FlowNode[], edges: FlowEdge[]): FlowNode[] {
  if (members.length <= 2) return members;
  const ids = new Set(members.map((m) => m.id));
  const links: [string, string][] = [];
  for (const e of edges) {
    if (ids.has(e.source) && ids.has(e.target) && e.source !== e.target) links.push([e.source, e.target]);
  }
  if (!links.length) return members;
  const n = members.length;
  const spanCost = (order: FlowNode[]) => {
    const pos = new Map(order.map((m, i) => [m.id, i]));
    let c = 0;
    for (const [a, b] of links) c += Math.abs((pos.get(a) ?? 0) - (pos.get(b) ?? 0));
    return c;
  };
  if (n <= 8) {
    let best: FlowNode[] | null = null;
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
  const out: FlowNode[] = [];
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
  members: FlowNode[],
  sizeOf: (m: FlowNode) => {w: number; h: number},
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
export function routeEdgeHandles(edges: FlowEdge[], box: Map<string, Box>): void {
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
 * DETOUR — ROUND GOBI-LAYOUT-2 (R2): a stacked group's MEMBERS are obstacles
 * for every edge that does not END on them (GF3's own predicate — endpoints
 * and ancestor groups are exempt, a member never is). The dominant-axis pair
 * above clears them on the fixtures we can measure, but a shape the fixtures
 * do not cover (an outside node below the group reaching a middle member)
 * can still route through a sibling; when the CHOSEN pair's bezier crosses a
 * body, the detour searches the perimeter pairs (arc over/under the pack, in
 * through the far face) and adopts the first strictly better one. Boards
 * whose edges already run clean are untouched — byte-identical JSON.
 * =========================================================================== */
const DETOUR_PAIRS: ReadonlyArray<readonly [string, string]> = [
  ['bottom', 'bottom'], ['top', 'top'],
  ['bottom', 'right'], ['bottom', 'left'], ['top', 'right'], ['top', 'left'],
  ['right', 'right'], ['left', 'left'],
  ['right', 'bottom'], ['left', 'bottom'], ['right', 'top'], ['left', 'top'],
  ['bottom', 'top'], ['top', 'bottom'],
  ['left', 'right'], ['right', 'left'],
];

const DETOUR_SAMPLES = 240;

/** `bezNums` returns the bezier's 8 path numbers (M sx sy C c1 c1 c2 c2 tx ty)
 * for a handle pair — the SAME generator the canvas paints with, supplied by
 * the caller so this module stays free of renderer imports. */
export function detourEdgeHandles(
  nodes: FlowNode[],
  edges: FlowEdge[],
  box: Map<string, Box>,
  bezNums: (s: Box, t: Box, sh: string, th: string) => number[] | null,
): void {
  const par = new Map(nodes.map((n) => [n.id, n.parentId]));
  const anc = (id: string): Set<string> => {
    const out = new Set<string>();
    let cur = par.get(id);
    while (cur) { out.add(cur); cur = par.get(cur); }
    return out;
  };
  const inside = (p: {x: number; y: number}, b: Box) =>
    p.x > b.x + 0.5 && p.x < b.x + b.w - 0.5 && p.y > b.y + 0.5 && p.y < b.y + b.h - 0.5;
  const score = (s: Box, t: Box, sh: string, th: string, blockers: Box[]) => {
    const nums = bezNums(s, t, sh, th);
    if (!nums || nums.length !== 8) return null;
    let hits = 0, len = 0;
    let prev: {x: number; y: number} | null = null;
    for (let i = 0; i <= DETOUR_SAMPLES; i++) {
      const u = i / DETOUR_SAMPLES, v = 1 - u;
      const p = {
        x: v * v * v * nums[0] + 3 * v * v * u * nums[2] + 3 * v * u * u * nums[4] + u * u * u * nums[6],
        y: v * v * v * nums[1] + 3 * v * v * u * nums[3] + 3 * v * u * u * nums[5] + u * u * u * nums[7],
      };
      if (prev) len += Math.hypot(p.x - prev.x, p.y - prev.y);
      for (const b of blockers) if (inside(p, b)) { hits++; break; }
      prev = p;
    }
    return {hits, len};
  };
  for (const e of edges) {
    const s = box.get(e.source), t = box.get(e.target);
    if (!s || !t) continue;
    const exempt = new Set<string>([e.source, e.target, ...anc(e.source), ...anc(e.target)]);
    const blockers: Box[] = [];
    for (const [id, b] of box) if (!exempt.has(id)) blockers.push(b);
    if (!blockers.length) continue;
    const cur: [string, string] = [e.sourceHandle ?? 'right', e.targetHandle ?? 'left'];
    const curScore = score(s, t, cur[0], cur[1], blockers);
    if (!curScore || curScore.hits === 0) continue;   /* clean — write nothing */
    let best = {pair: cur, hits: curScore.hits, len: curScore.len};
    for (const [sh, th] of DETOUR_PAIRS) {
      if (sh === best.pair[0] && th === best.pair[1]) continue;
      const sc = score(s, t, sh, th, blockers);
      if (!sc) continue;
      if (sc.hits < best.hits || (sc.hits === best.hits && sc.len < best.len)) {
        best = {pair: [sh, th], hits: sc.hits, len: sc.len};
      }
    }
    if (best.pair[0] !== cur[0] || best.pair[1] !== cur[1]) {
      e.sourceHandle = best.pair[0];
      e.targetHandle = best.pair[1];
    }
  }
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
 *
 * EDGE-LABEL-BORDER (2026-11-03) — a group's BORDER LINE is an obstacle of
 * its own, and the node-box pass above could never see it: the group is an
 * ANCESTOR of the edge's endpoint, so it is rightly EXEMPT as a box (the
 * member lives inside it) — yet its dashed border still cut the label in two
 * (measured on the sys-pipeline template: 13 px of the "events" box outside
 * the boundary, 21 px inside, the line through the middle of the word). The
 * rule: a label box is either FULLY inside a group or fully outside it, and
 * never within GROUP_BORDER_CLEAR_PX of the border ink — a straddling label
 * reads as belonging to neither side.
 * =========================================================================== */
const hitsBox = (a: Box, b: Box) =>
  a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;

/** EDGE-LABEL-BORDER — the clearance a label box must keep from any group's
 *  border LINE (the 2 px dashed stroke the sheet paints on the group rect). */
export const GROUP_BORDER_CLEAR_PX = 8;
export const GROUP_BORDER_INK_PX = 2;
const BORDER_KEEP = GROUP_BORDER_CLEAR_PX + GROUP_BORDER_INK_PX / 2;

const inflateBox = (b: Box, k: number): Box => ({x: b.x - k, y: b.y - k, w: b.w + 2 * k, h: b.h + 2 * k});
const shrinkBox = (b: Box, k: number): Box | null =>
  b.w > 2 * k && b.h > 2 * k ? {x: b.x + k, y: b.y + k, w: b.w - 2 * k, h: b.h - 2 * k} : null;
const boxContains = (outer: Box, inner: Box) =>
  inner.x >= outer.x && inner.y >= outer.y &&
  inner.x + inner.w <= outer.x + outer.w && inner.y + inner.h <= outer.y + outer.h;

/** True when label box `L` is a legal position w.r.t. ONE group's border:
 *  fully outside the inflated rect (clear of the line), or fully inside the
 *  shrunk rect (also clear of the line). Crossing or hugging = false. */
export function labelClearsBorder(L: Box, g: Box): boolean {
  if (!hitsBox(L, inflateBox(g, BORDER_KEEP))) return true;
  const inner = shrinkBox(g, BORDER_KEEP);
  return inner != null && boxContains(inner, L);
}

/** The minimal SINGLE-AXIS translation that makes `L` legal vs `g` on one
 *  side — the "moves along the edge" remedy, axis picked by the border line
 *  being crossed — or null when that side cannot host the box at all (a
 *  group too small to hold it clear of its own border). Smallest push wins
 *  among the valid axes, so a label just inside the line nudges further in
 *  instead of jumping across the whole group. */
function borderPush(L: Box, g: Box, side: 'outside' | 'inside'): {x: number; y: number} | null {
  const target = side === 'outside' ? inflateBox(g, BORDER_KEEP) : shrinkBox(g, BORDER_KEEP);
  if (!target) return null;
  const legal = side === 'outside'
    ? (o: Box) => !hitsBox(o, target as Box)
    : (o: Box) => boxContains(target as Box, o);
  const cands = [
    {x: target.x - (L.x + L.w), y: 0}, {x: target.x + target.w - L.x, y: 0},
    {x: 0, y: target.y - (L.y + L.h)}, {x: 0, y: target.y + target.h - L.y},
  ];
  let best: {x: number; y: number} | null = null;
  for (const c of cands) {
    if (!legal({x: L.x + c.x, y: L.y + c.y, w: L.w, h: L.h})) continue;
    if (!best || Math.abs(c.x) + Math.abs(c.y) < Math.abs(best.x) + Math.abs(best.y)) best = c;
  }
  return best;
}

export function placeEdgeLabels(
  nodes: FlowNode[],
  edges: FlowEdge[],
  box: Map<string, Box>,
  anchorOf: (e: FlowEdge) => {x: number; y: number; vertical: boolean},
): void {
  const par = new Map(nodes.map((n) => [n.id, n.parentId]));
  const anc = (id: string): Set<string> => {
    const out = new Set<string>();
    let cur = par.get(id);
    while (cur) { out.add(cur); cur = par.get(cur); }
    return out;
  };
  /* EDGE-LABEL-BORDER: EVERY group's border rect is an obstacle, ancestor or
     not — the ancestor exemption above is about the group's BODY (members
     live inside it), never about its border line. */
  const groups: Box[] = [];
  for (const n of nodes) {
    if ((n.data as {shape?: unknown} | undefined)?.shape !== 'group') continue;
    const b = box.get(n.id);
    if (b) groups.push(b);
  }
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
    const at = (off: {x: number; y: number}): Box => ({x: a.x + off.x - w / 2, y: a.y + off.y - h / 2, w, h});
    const base = at({x: 0, y: 0});
    const borderOk = (L: Box) => groups.every((g) => labelClearsBorder(L, g));
    const open = (L: Box) => !blockers.some((b) => hitsBox(L, b)) && !placedLabels.some((b) => hitsBox(L, b));
    if (open(base) && borderOk(base)) {
      placedLabels.push(base);
      continue;
    }
    /* Cumulative along-the-line pushes for one side: apply the minimal push
       for the first violated group, re-check (a push can expose the next
       group in a nested chain), repeat — bounded, so an impossible side
       degrades to null instead of looping. */
    const pushes = (side: 'outside' | 'inside'): {x: number; y: number} | null => {
      let off = {x: 0, y: 0};
      for (let round = 0; round <= groups.length; round++) {
        const L = at(off);
        const bad = groups.find((g) => !labelClearsBorder(L, g));
        if (!bad) return off;
        const p = borderPush(L, bad, side) ?? borderPush(L, bad, side === 'inside' ? 'outside' : 'inside');
        if (!p) return null;
        off = {x: off.x + p.x, y: off.y + p.y};
      }
      return null;
    };
    /* the preferred side is the one the box already (mostly) sits on: a
       label that reads as "outside the group" stays outside. */
    const viol = groups.filter((g) => !labelClearsBorder(base, g));
    const cands: {x: number; y: number}[] = [];
    if (viol.length) {
      const g0 = viol[0];
      const ix = Math.max(0, Math.min(base.x + base.w, g0.x + g0.w) - Math.max(base.x, g0.x));
      const iy = Math.max(0, Math.min(base.y + base.h, g0.y + g0.h) - Math.max(base.y, g0.y));
      const pref = ix * iy > (base.w * base.h) / 2 ? 'inside' : 'outside';
      const first = pushes(pref);
      if (first) cands.push(first);
      const second = pushes(pref === 'inside' ? 'outside' : 'inside');
      if (second) cands.push(second);
    }
    /* perpendicular candidates: both sides, then stepping further out — the
       pre-border remedy, still first choice when no border is involved. */
    for (const k of [12, 34, 56]) {
      for (const sign of [1, -1]) {
        cands.push(a.vertical ? {x: sign * (w / 2 + k), y: 0} : {x: 0, y: sign * (h / 2 + k)});
      }
    }
    const write = (off: {x: number; y: number}) => {
      (e.data as Record<string, unknown>).labelOffset = off;
      (e.data as Record<string, unknown>).labelPinned = true;
      placedLabels.push(at(off));
    };
    let written = false;
    for (const off of cands) {
      const L = at(off);
      if (open(L) && borderOk(L)) { write(off); written = true; break; }
    }
    /* fallback — clearance from the border outranks every other rule (the
       card's own ordering): park it CLEAR of the line on the side with the
       shorter push, accepting an odd position over a cut word. */
    if (!written && viol.length) {
      const outs = pushes('outside'), ins = pushes('inside');
      const pick = outs && ins
        ? (Math.abs(outs.x) + Math.abs(outs.y) <= Math.abs(ins.x) + Math.abs(ins.y) ? outs : ins)
        : (outs ?? ins);
      if (pick) { write(pick); written = true; }
    }
    if (!written) placedLabels.push(base);
  }
}
