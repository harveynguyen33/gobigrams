/* UNISURF-S2 (SPEC-UNIFIED-SURFACE §1/§9 step 2, 2026-11-08) — the MERGE:
 * applyGobiDoc(current, compiled) folds a freshly compiled .gobi document
 * back into the live BoardDoc after a text edit. It is the second half of
 * "two views of one model": the serialiser (adapterText) projects the board
 * to text, the compiler parses the author's edit, and THIS module decides
 * what the text is allowed to change on the canvas.
 *
 * RULES (each one an assertion in checks/unisurf-merge.mjs):
 *   · CONTENT comes from the text — a surviving id's data (title, attrs,
 *     columns), its RF type and its group membership are the compile's.
 *   · GEOMETRY comes from the canvas — a surviving id keeps its position,
 *     rotation (data.rotation, where ROUND ROTATE stores it), width/height,
 *     style and zIndex from `current` (§1 line 70: "Positions of surviving
 *     nodes are NOT lost"). New ids take the compiler's layout position.
 *   · DELETION is conservative — an id dies only when the serialiser WOULD
 *     have emitted it (emittableNodeIds, the ONE vocabulary classifier) and
 *     the new compile no longer declares it. A node the text cannot express
 *     (customshape, a hidden sequence piece) passes through UNTOUCHED, and
 *     so do its edges — an edge to an undeclared id is unserialisable, so
 *     deleting it would destroy canvas state the text edit never touched
 *     (the card's title rule, applied to the edge that hangs off the node).
 *   · EDGES between spoken nodes are RECONCILED by (source,target) pair
 *     (mergeEdges.ts, t_8926135b): the canvas edge is the base — id,
 *     handles, path type, style, markers, every unspoken data fact — and
 *     the text overlays exactly the facts it authors (label, techn, flow*,
 *     dash/cardinality only when the text CHANGES them). A wholesale
 *     rebuild reset every edge the grammar does not speak — the owner's
 *     "connection bị đổi tùm lum". Id churn is gone for surviving pairs;
 *     new pairs still get compiler-minted ids.
 *   · TABLE COLUMN IDS survive a rename-free edit: a compiled column whose
 *     NAME exists on the current table inherits the author's col.id, so
 *     `right_rel_<colId>` handles (TableNode's per-column handles) stay
 *     stable across a text edit; a renamed column takes the compiler's id.
 *
 * PURE: no React, no store writes, no pushHistory, no I/O — not even a
 * clock. Board identity (id/updatedAt/preset) is a SURFACE concern and is
 * carried over from `current` untouched; the caller re-stamps updatedAt
 * when it commits. The name follows the text (the grammar authors it). */

import type {BoardDoc} from './boardDoc';
import type {FlowEdge, FlowNode} from './flowTypes';
import type {GobiDocument} from '../gobiTypes';
import {toBoardDoc} from './adapterCanvas';
import {emittableNodeIds} from './adapterText';
import {reconcileEdges} from './mergeEdges';
import {resolveDensity, resolveTableStyle} from './tableStyle';

/* Columns as the merge reads them (same looseness adapterText uses). */
type Columnish = {id?: string; name?: string};

/** One surviving node: the compile's content on the canvas's geometry. */
const mergeNode = (cur: FlowNode, fresh: FlowNode): FlowNode => {
  const out: FlowNode = {...fresh, position: {x: cur.position.x, y: cur.position.y}};
  if (cur.width !== undefined) out.width = cur.width;
  if (cur.height !== undefined) out.height = cur.height;
  if (cur.style !== undefined) out.style = cur.style;
  if (cur.zIndex !== undefined) out.zIndex = cur.zIndex;

  const data: Record<string, unknown> = {...(fresh.data ?? {})};
  /* rotation is unserialisable (the grammar has no rotation word) and lives
     in data, which the compile just replaced — carry it across by hand.
     TABLE-SCALE's `scale` is the same kind of fact: a per-table multiplier the
     text language deliberately does not speak (P5), so a commit would silently
     reset a hero table to 100% if it were not carried here. DESC-1's `desc` is
     the third member of this list: a paragraph the grammar cannot express, so
     a text edit would silently strip a shape's definition without this.
     DA-3's `descPaint` is the fourth: the description panel's own colours,
     the same surface-only fact — the grammar has no token for a colour that
     is not the shape's own, so a text edit must not strip it either. */
  const rot = (cur.data as {rotation?: unknown} | undefined)?.rotation;
  if (typeof rot === 'number') data.rotation = rot;
  const sc = (cur.data as {scale?: unknown} | undefined)?.scale;
  if (typeof sc === 'number') data.scale = sc;
  const de = (cur.data as {desc?: unknown} | undefined)?.desc;
  if (typeof de === 'string') data.desc = de;
  const dp = (cur.data as {descPaint?: unknown} | undefined)?.descPaint;
  if (dp && typeof dp === 'object') data.descPaint = dp;

  if (fresh.type === 'table' && cur.type === 'table') {
    const curCols: Columnish[] = Array.isArray((cur.data as {columns?: unknown}).columns)
      ? (cur.data as {columns: Columnish[]}).columns : [];
    const used = new Set<string>();
    const nameMatch = (name: unknown): Columnish | undefined => {
      if (typeof name !== 'string') return undefined;
      for (const c of curCols) {
        if (c.name === name && typeof c.id === 'string' && !used.has(c.id)) return c;
      }
      return undefined;
    };
    const freshCols = Array.isArray((fresh.data as {columns?: unknown}).columns)
      ? (fresh.data as {columns: Columnish[]}).columns : [];
    data.columns = freshCols.map((c) => {
      const m = nameMatch(c.name);
      if (!m) return c; /* renamed (or new): the compiler's id */
      used.add(m.id!);
      return {...c, id: m.id};
    });
  }
  out.data = data as FlowNode['data'];
  return out;
};

export function applyGobiDoc(current: BoardDoc, compiled: GobiDocument): BoardDoc {
  /* The compile's own board — the ONE adapter, so node data/edges arrive
     exactly as every other door (insert, export) would build them.
     LAYOUT-FOLLOWS-WIDTH: the board's own look rides along, so a table the
     text ADDS is compiled at the width the card really paints. */
  const fresh = toBoardDoc(compiled, {
    now: current.updatedAt, id: current.id,
    style: resolveTableStyle(current.style), density: resolveDensity(current.density),
  });
  const spoken = emittableNodeIds(current);
  const freshById = new Map(fresh.nodes.map((n) => [n.id, n]));

  /* NODES — current order for everything that survives or passes through
     (deterministic + idempotent), new ids appended in compile order. */
  const nodes: FlowNode[] = [];
  const kept = new Set<string>();
  for (const cur of current.nodes) {
    if (!spoken.has(cur.id)) { nodes.push(cur); kept.add(cur.id); continue; } /* untouched */
    const f = freshById.get(cur.id);
    if (!f) continue; /* present in the previous generated text, absent now: deleted */
    nodes.push(mergeNode(cur, f));
    kept.add(cur.id);
  }
  for (const f of fresh.nodes) if (!kept.has(f.id)) nodes.push(f);

  /* EDGES — reconciled in mergeEdges.ts by (source,target) pair (t_8926135b,
     CODE-KEEP-EDGES): the canvas edge is the base, the text overlays exactly
     what it authors. Wholesale rebuild abolished. */
  const edges = reconcileEdges(current.edges, fresh.edges, spoken);

  return {...current, name: compiled.name, nodes, edges};
}
