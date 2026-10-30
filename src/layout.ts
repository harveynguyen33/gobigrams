import {type Node, type Edge} from '@xyflow/react';
import {DEFAULT_NODE_H, DEFAULT_NODE_W, EDGE_LABEL_ROOM_PAD, MAX_LAYER_WIDTH} from './layoutConstants';
import {estimateEdgeLabelWidth} from './labelMetrics';

/**
 * Deterministic layered layout (F8) — a small hand-rolled longest-path layering
 * with a barycenter ordering sweep, so no extra dependency is needed.
 * Non-hierarchical / disconnected nodes keep their relative position, spread
 * out to the right of the widest layer.
 *
 * PACKAGE-L / L3a additions (all opt-in):
 *  - `direction`  — 'TB' (rows, the default) or 'LR' (columns). A flowchart
 *                   reads downward, so TB is what a caller that omits the
 *                   field gets (ROUND LAYOUT; every shipped caller passes it
 *                   explicitly, so old boards are unchanged).
 *  - `spacing`    — per-preset gaps.
 *  - `bandGroups` — top-level `group` nodes are pool/lane BANDS: they keep their
 *                   authored rectangle and are excluded from the layer
 *                   assignment. This is what makes swimlane templates work
 *                   without inventing a second layout engine.
 *
 * ROUND LAYOUT additions:
 *  - wide layers WRAP (`wrapLayer`, `MAX_LAYER_WIDTH` in layoutConstants.ts):
 *    a layer too wide for the viewport packs into rows inside its layer slot
 *    instead of smearing one row across three screens.
 *  - ISLANDS keep their relative offsets (`islandsOf`): connectivity splits
 *    the participants into islands; each island after the first is translated
 *    so its centroid keeps its pre-layout offset from the first island's.
 *
 * The old cycle handling — "anything unassigned lands on layer 0" — silently
 * flattened every flowchart loop-back. Layering now runs on the DAG left after
 * removing a feedback arc set (DFS back edges), so a retry loop is *placed*
 * (its nodes get their own layers) instead of collapsing.
 */

export type LayoutDirection = 'LR' | 'TB';
export type LayoutSpacing = {x: number; y: number};

export type LayoutOptions = {
  direction?: LayoutDirection;
  spacing?: LayoutSpacing;
  /** Treat top-level `group` nodes as fixed bands (pool / lane) — L3a. */
  bandGroups?: boolean;
};

export const isGroupNode = (n: Node) => (n.data as any)?.shape === 'group';

/** Pack `spreads` (the across-extents of one layer's nodes, in authored order)
 * into rows no wider than `max` — the ROUND LAYOUT wide-layer wrap. Returns
 * each node's {row, across} slot; a layer that fits stays one row with the
 * exact packed offsets (identical to the pre-round packing), and an over-wide
 * layer wraps into rows separated by `gap` worth of `along` space. Pure: no
 * DOM, no direction knowledge — the caller maps row/across back onto whichever
 * axis its direction uses. */
export function wrapLayer(spreads: number[], gap: number, max: number): {row: number; across: number}[] {
  const out: {row: number; across: number}[] = [];
  let row = 0, across = 0;
  for (const s of spreads) {
    if (across > 0 && across + s > max) { row += 1; across = 0; }
    out.push({row, across});
    across += s + gap;
  }
  return out;
}

/** Split participant node ids into connected components (islands) — the ROUND
 * LAYOUT grouping for keeping disconnected subgraphs where the author put
 * them. Edge direction is irrelevant (an undirected walk), feedback arcs
 * included. Order is stable: islands surface in first-encounter order, members
 * in participant order. */
export function islandsOf(nodes: Node[], edges: Edge[]): string[][] {
  const adj = new Map<string, Set<string>>();
  nodes.forEach(n => adj.set(n.id, new Set()));
  edges.forEach(e => {
    const s = adj.get(e.source), t = adj.get(e.target);
    if (s && t) { s.add(e.target); t.add(e.source); }
  });
  const seen = new Set<string>();
  const islands: string[][] = [];
  nodes.forEach(n => {
    if (seen.has(n.id)) return;
    const island: string[] = [];
    const queue = [n.id];
    seen.add(n.id);
    while (queue.length) {
      const id = queue.shift()!;
      island.push(id);
      for (const next of adj.get(id) ?? []) {
        if (!seen.has(next)) { seen.add(next); queue.push(next); }
      }
    }
    islands.push(island);
  });
  return islands;
}

/** DFS feedback arcs: an edge whose target is still on the current DFS stack. */
function feedbackArcs(ids: Set<string>, edges: Edge[]): Set<string> {
  const adj = new Map<string, string[]>();
  ids.forEach(id => adj.set(id, []));
  edges.forEach(e => {
    if (ids.has(e.source) && ids.has(e.target)) adj.get(e.source)!.push(e.target);
  });
  const state = new Map<string, 0 | 1 | 2>(); // 0 unseen · 1 on stack · 2 done
  const back = new Set<string>();
  ids.forEach(start => {
    if ((state.get(start) ?? 0) !== 0) return;
    state.set(start, 1);
    const stack: {id: string; i: number}[] = [{id: start, i: 0}];
    while (stack.length) {
      const top = stack[stack.length - 1];
      const list = adj.get(top.id) ?? [];
      if (top.i >= list.length) { state.set(top.id, 2); stack.pop(); continue; }
      const t = list[top.i++];
      const st = state.get(t) ?? 0;
      if (st === 1) back.add(`${top.id}->${t}`);
      else if (st === 0) { state.set(t, 1); stack.push({id: t, i: 0}); }
    }
  });
  return back;
}

export function layoutDiagram(nodes: Node[], edges: Edge[], opts: LayoutOptions = {}): Map<string, {x: number; y: number}> {
  const result = new Map<string, {x: number; y: number}>();
  if (!nodes.length) return result;

  const direction: LayoutDirection = opts.direction ?? 'TB';
  const spacing: LayoutSpacing = opts.spacing ?? {x: 70, y: 24};

  // Only layout participants are placed; everything else keeps its position.
  // Default (architecture): top-level nodes only — children of groups follow
  // their parent, exactly as before. With `bandGroups`, the pool / lane bands
  // are frozen too.
  const participants = nodes.filter(n =>
    !n.parentId && !(opts.bandGroups && isGroupNode(n)));
  if (!participants.length) return result;

  const ids = new Set(participants.map(n => n.id));
  const width = (n: Node) => (n.measured?.width ?? n.width ?? DEFAULT_NODE_W) as number;
  const height = (n: Node) => (n.measured?.height ?? n.height ?? DEFAULT_NODE_H) as number;
  /** Extent measured along the layer axis (LR: width, TB: height). */
  const thickness = (n: Node) => direction === 'LR' ? width(n) : height(n);
  /** Extent measured across the layer axis (within one layer). */
  const spread = (n: Node) => direction === 'LR' ? height(n) : width(n);
  const layerGap = direction === 'LR' ? spacing.x : spacing.y;
  const spreadGap = direction === 'LR' ? spacing.y : spacing.x;

  // ---- feedback arcs: layering runs on the remaining DAG ----
  const back = feedbackArcs(ids, edges);
  const forward = edges.filter(e => ids.has(e.source) && ids.has(e.target) && !back.has(`${e.source}->${e.target}`));

  const succ = new Map<string, string[]>();
  const indeg = new Map<string, number>();
  participants.forEach(n => { succ.set(n.id, []); indeg.set(n.id, 0); });
  forward.forEach(e => {
    succ.get(e.source)!.push(e.target);
    indeg.set(e.target, (indeg.get(e.target) ?? 0) + 1);
  });

  // ---- layer assignment: longest path from any source (Kahn-like) ----
  const layer = new Map<string, number>();
  participants.forEach(n => { if ((indeg.get(n.id) ?? 0) === 0) layer.set(n.id, 0); });
  const remaining = new Map<string, number>(indeg);
  let frontier = [...layer.keys()];
  while (frontier.length) {
    const next: string[] = [];
    for (const id of frontier) {
      for (const t of succ.get(id) ?? []) {
        const cand = (layer.get(id) ?? 0) + 1;
        if (cand > (layer.get(t) ?? -1)) layer.set(t, cand);
        const d = (remaining.get(t) ?? 1) - 1;
        remaining.set(t, d);
        if (d === 0) next.push(t);
      }
    }
    frontier = next;
  }
  // Safety net — with the feedback arcs removed the graph is a DAG, so every
  // node already has a layer. If an inconsistent edge set ever leaves one
  // unresolved, relax it against assigned neighbours rather than dropping it
  // onto layer 0 (which is the bug this replaced).
  if (layer.size < participants.length) {
    for (let pass = 0; pass < participants.length; pass++) {
      for (const n of participants) {
        if (layer.has(n.id)) continue;
        const preds = forward.filter(e => e.target === n.id).map(e => e.source).filter(s => layer.has(s));
        if (preds.length) layer.set(n.id, Math.max(...preds.map(s => layer.get(s)!)) + 1);
      }
    }
    const base = layer.size ? Math.max(...layer.values()) + 1 : 0;
    participants.forEach((n, i) => { if (!layer.has(n.id)) layer.set(n.id, base + i); });
  }

  // ---- order within layers: barycenter of connected neighbours, 4 sweeps ----
  const byLayer = new Map<number, string[]>();
  const maxLayer = Math.max(...participants.map(n => layer.get(n.id)!));
  for (let i = 0; i <= maxLayer; i++) byLayer.set(i, participants.filter(n => layer.get(n.id) === i).map(n => n.id));
  const orderOf = (id: string) => {
    for (let i = 0; i <= maxLayer; i++) {
      const idx = byLayer.get(i)!.indexOf(id);
      if (idx >= 0) return {l: i, idx};
    }
    return {l: 0, idx: 0};
  };
  for (let sweep = 0; sweep < 4; sweep++) {
    const down = sweep % 2 === 0;
    for (let i = down ? 1 : maxLayer - 1; down ? i <= maxLayer : i >= 0; down ? i++ : i--) {
      const rows = byLayer.get(i)!;
      const bary = new Map<string, number>();
      rows.forEach((id, idx) => {
        const nbrs = down
          ? edges.filter(e => ids.has(e.source) && e.target === id).map(e => e.source)
          : edges.filter(e => ids.has(e.target) && e.source === id).map(e => e.target);
        if (!nbrs.length) { bary.set(id, idx); return; }
        let sum = 0, cnt = 0;
        nbrs.forEach(s => { const o = orderOf(s); sum += o.idx + 0.5; cnt++; });
        bary.set(id, sum / cnt);
      });
      byLayer.set(i, [...rows].sort((a, b) => (bary.get(a)! - bary.get(b)!)));
    }
  }

  // ---- ROUND GOBI-LAYOUT: label room. A label paints centred on the cut
  // between its end layers, so the widest crossing label needs
  // `labelW + 2 * EDGE_LABEL_ROOM_PAD` of air or it lands on a node box
  // (measured: every label on a 4-node LR board overlapped one). The gap is
  // UNIFORM — raised to the widest cut's need — so the row stays even; per-cut
  // gaps would reintroduce the 60/60/70 unevenness this round removes.
  let labelGap = 0;
  for (const e of edges) {
    const a = layer.get(e.source), b = layer.get(e.target);
    const text = typeof e.label === 'string' ? e.label.trim() : '';
    if (text && a != null && b != null && a !== b)
      labelGap = Math.max(labelGap, estimateEdgeLabelWidth(text) + 2 * EDGE_LABEL_ROOM_PAD);
  }
  const gap = Math.max(layerGap, labelGap);

  // ---- coordinate assignment: pack each layer with a fixed gap, WRAPPING an
  // over-wide layer into rows inside its slot (ROUND LAYOUT). The along-axis
  // advance per wrapped row is the layer's own max thickness + gap, so a
  // wrapped layer reads as a block, not a diagonal. ----
  const pos = new Map<string, {x: number; y: number}>();
  let along = 0;
  for (let i = 0; i <= maxLayer; i++) {
    const rows = byLayer.get(i)!;
    if (!rows.length) { along += gap; continue; }
    const members = rows.map(id => participants.find(t => t.id === id)!);
    const slots = wrapLayer(members.map(spread), spreadGap, MAX_LAYER_WIDTH);
    const rowsInLayer = slots.reduce((a, s) => Math.max(a, s.row), 0) + 1;
    let thick = 0;
    for (let r = 0; r < rowsInLayer; r++) {
      thick = Math.max(thick, ...members.filter((_, k) => slots[k].row === r).map(thickness));
    }
    for (let r = 0; r < rowsInLayer; r++) {
      const rowAlong = along + r * (thick + gap);
      members.forEach((n, k) => {
        if (slots[k].row !== r) return;
        const {across} = slots[k];
        pos.set(n.id, direction === 'LR' ? {x: rowAlong, y: across} : {x: across, y: rowAlong});
      });
    }
    along += rowsInLayer * thick + (rowsInLayer - 1) * gap + gap;
  }

  // centre each layer on its own axis for a balanced look
  for (let i = 0; i <= maxLayer; i++) {
    const rows = byLayer.get(i)!;
    if (rows.length < 2) continue;
    const first = pos.get(rows[0])!;
    const lastN = participants.find(t => t.id === rows[rows.length - 1])!;
    const last = pos.get(rows[rows.length - 1])!;
    if (direction === 'LR') {
      const dy = (first.y + (last.y + height(lastN))) / 2;
      rows.forEach(id => { const p = pos.get(id)!; pos.set(id, {x: p.x, y: p.y - dy}); });
    } else {
      const dx = (first.x + (last.x + width(lastN))) / 2;
      rows.forEach(id => { const p = pos.get(id)!; pos.set(id, {x: p.x - dx, y: p.y}); });
    }
  }

  // disconnected nodes (no edges at all): park them after the last layer
  const connected = new Set<string>();
  edges.forEach(e => { if (ids.has(e.source)) connected.add(e.source); if (ids.has(e.target)) connected.add(e.target); });
  const orphans = participants.filter(n => !connected.has(n.id));
  if (orphans.length) {
    let across = 0;
    const start = along;
    orphans.forEach(n => { pos.set(n.id, direction === 'LR' ? {x: start, y: across} : {x: across, y: start}); across += spread(n) + spreadGap; });
    const d = across / 2;
    orphans.forEach(n => { const p = pos.get(n.id)!; pos.set(n.id, direction === 'LR' ? {x: p.x, y: p.y - d} : {x: p.x - d, y: p.y}); });
  }

  // ---- ROUND LAYOUT: islands keep their relative offsets. The shared grid
  // above places every island as if it were one board (that is what keeps
  // layer alignment honest); here each island AFTER THE FIRST is translated
  // so its centroid keeps its PRE-LAYOUT offset from the first island's
  // centroid — an island the author parked bottom-right stays bottom-right
  // instead of snapping into the column next to island zero. Singleton
  // islands are skipped: a lone node is an ORPHAN, deliberately parked after
  // the last layer (see above; that behaviour is pinned by package-templates).
  const islands = islandsOf(participants, edges).filter(is => is.length > 1);
  if (islands.length > 1) {
    const pre = islands.map(is => is.reduce(
      (a, id) => { const n = participants.find(t => t.id === id)!.position; return {x: a.x + n.x / is.length, y: a.y + n.y / is.length}; },
      {x: 0, y: 0}));
    const post = islands.map(is => is.reduce(
      (a, id) => { const p = pos.get(id) ?? {x: 0, y: 0}; return {x: a.x + p.x / is.length, y: a.y + p.y / is.length}; },
      {x: 0, y: 0}));
    islands.forEach((is, i) => {
      if (i === 0) return;
      const dx = (pre[i].x - pre[0].x) - (post[i].x - post[0].x);
      const dy = (pre[i].y - pre[0].y) - (post[i].y - post[0].y);
      is.forEach(id => { const p = pos.get(id); if (p) pos.set(id, {x: p.x + dx, y: p.y + dy}); });
    });
  }

  participants.forEach(n => { const p = pos.get(n.id); if (p) result.set(n.id, {x: Math.round(p.x), y: Math.round(p.y)}); });
  return result;
}

/**
 * L3a: a simple connectivity-first grid packer — the ERD preset's engine.
 * Tables are placed in columns of `cols`, most-connected first so the hub
 * tables sit top-left. No dependency, no edge crossing minimisation.
 */
export function gridLayout(nodes: Node[], edges: Edge[], opts: {cols?: number; gap?: LayoutSpacing} = {}): Map<string, {x: number; y: number}> {
  const result = new Map<string, {x: number; y: number}>();
  const tops = nodes.filter(n => !n.parentId);
  if (!tops.length) return result;
  const cols = Math.max(1, opts.cols ?? 2);
  const gap = opts.gap ?? {x: 120, y: 80};
  const width = (n: Node) => (n.measured?.width ?? n.width ?? DEFAULT_NODE_W) as number;
  const height = (n: Node) => (n.measured?.height ?? n.height ?? DEFAULT_NODE_H) as number;
  const degree = new Map<string, number>();
  tops.forEach(n => degree.set(n.id, 0));
  edges.forEach(e => {
    if (degree.has(e.source)) degree.set(e.source, degree.get(e.source)! + 1);
    if (degree.has(e.target)) degree.set(e.target, degree.get(e.target)! + 1);
  });
  const ordered = [...tops].sort((a, b) => (degree.get(b.id)! - degree.get(a.id)!) || a.id.localeCompare(b.id));
  const colW: number[] = [];
  const rowH: number[] = [];
  ordered.forEach((n, i) => {
    const c = i % cols, r = Math.floor(i / cols);
    colW[c] = Math.max(colW[c] ?? 0, width(n));
    rowH[r] = Math.max(rowH[r] ?? 0, height(n));
  });
  const xs: number[] = [];
  let x = 0;
  for (let c = 0; c < cols; c++) { xs[c] = x; x += (colW[c] ?? 0) + gap.x; }
  const ys: number[] = [];
  let y = 0;
  for (let r = 0; r < rowH.length; r++) { ys[r] = y; y += (rowH[r] ?? 0) + gap.y; }
  ordered.forEach((n, i) => {
    const c = i % cols, r = Math.floor(i / cols);
    result.set(n.id, {x: Math.round(xs[c]), y: Math.round(ys[r])});
  });
  return result;
}

