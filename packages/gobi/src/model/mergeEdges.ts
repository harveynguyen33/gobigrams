/* CODE-KEEP-EDGES (t_8926135b, 2026-11-15) — the EDGE half of the merge
 * (mergeGobi.ts calls this; the module is split out to keep mergeGobi under
 * its budget). Before this module a compiled edge REPLACED the canvas edge
 * wholesale, and the compiled edge arrives through the ONE adapter with the
 * PRESET's defaults — CUSTOM_PRESET colour, CUSTOM_PRESET path type,
 * handles chosen by detourEdgeHandles for the compiler's own (discarded)
 * layout, no bends, no label pin. A text edit that touched only a node's
 * title therefore scrambled every edge carrying a canvas-only fact (the
 * owner's "connection bị đổi tùm lum").
 *
 * THE CONTRACT: for a compiled edge whose (source, target) pair also exists
 * on the canvas, the CANVAS edge is the base — id, handles, path type,
 * style, markers, and every unspoken data fact (strokeKey, colour, bends,
 * label pin) — and the text overlays EXACTLY the facts it authors:
 *   · label — the grammar authors it (edgeLine's quoted string);
 *   · techn / flow / flowIcon / flowCount — set when spoken, removed when
 *     the edit unspoke them;
 *   · dash — only when the text's dash WORD differs from the canvas edge's
 *     own (DASH_WORD, the same EDGE_DASH inversion the serialiser uses);
 *     the applied pattern rides ON the canvas's stroke colour;
 *   · cardinality markers — only when the text's crow words differ from the
 *     canvas edge's own (crowOf, the same GOBI_CARD_TOKENS inversion); the
 *     fresh markers are repainted with the canvas edge's stroke so the
 *     edge keeps its colour through a card change.
 * A pair change (rewire / add / delete) never reaches this module: those
 * pairs simply do not match, so the compiled edge (or its absence) wins.
 *
 * PURE: reads both edges, returns a new one, mutates nothing.
 */

import type {FlowEdge} from './flowTypes';
import {crowOf, DASH_WORD} from './adapterText';

/** The data keys the grammar authors on an edge (edgeLine's attribute set).
 * Everything else in data is a canvas fact and is carried verbatim. */
const SPOKEN_DATA = ['techn', 'flow', 'flowIcon', 'flowCount'] as const;

type EdgeData = NonNullable<FlowEdge['data']>;
type EdgeStyle = NonNullable<FlowEdge['style']>;
type Marker = FlowEdge['markerEnd'];

const mergeData = (cur: EdgeData, fresh: EdgeData, labelChanged: boolean): EdgeData => {
  const out: Record<string, unknown> = {...cur};
  for (const k of SPOKEN_DATA) {
    const v = (fresh as Record<string, unknown>)[k];
    if (v === undefined) delete out[k];
    else out[k] = v;
  }
  /* A label pin survives only while the text keeps the same label: the pin
     is anchored to the OLD string. A new label loses the pin (the compile
     may pin its own; a changed label with no compile pin re-centres). */
  if (labelChanged) {
    if ((fresh as Record<string, unknown>).labelOffset !== undefined) {
      out.labelOffset = (fresh as Record<string, unknown>).labelOffset;
    } else delete out.labelOffset;
    if ((fresh as Record<string, unknown>).labelPinned !== undefined) {
      out.labelPinned = (fresh as Record<string, unknown>).labelPinned;
    } else delete out.labelPinned;
  }
  return out as EdgeData;
};

const mergeStyle = (cur: EdgeStyle | undefined, fresh: EdgeStyle | undefined): EdgeStyle | undefined => {
  if (!cur) return fresh;
  /* Dash words agree → the canvas style verbatim (its stroke colour rides
     with it); the text changed the dash → the new pattern onto the canvas
     colour. The words are the serialiser's own inversion, so a dash the
     canvas holds but the grammar cannot speak never reads as a change. */
  const curWord = DASH_WORD[cur.strokeDasharray ?? ''] ?? 'solid';
  const freshWord = DASH_WORD[fresh?.strokeDasharray ?? ''] ?? 'solid';
  if (curWord === freshWord) return cur;
  const out: EdgeStyle = {...cur};
  if (fresh?.strokeDasharray) out.strokeDasharray = fresh.strokeDasharray;
  else delete out.strokeDasharray;
  return out;
};

/** The text changed the cardinality → take the fresh markers, repainted
 * with the canvas edge's own stroke (the preset colour would recolour the
 * edge's arrowheads behind its line). Unchanged words → canvas verbatim. */
const mergeMarkers = (cur: FlowEdge, fresh: FlowEdge) => {
  const same =
    crowOf(cur.markerStart) === crowOf(fresh.markerStart) &&
    crowOf(cur.markerEnd) === crowOf(fresh.markerEnd);
  if (same) return {markerStart: cur.markerStart, markerEnd: cur.markerEnd};
  const stroke = cur.style?.stroke;
  const paint = (m: Marker): Marker =>
    m !== null && typeof m === 'object' && typeof stroke === 'string'
      ? {...m, color: stroke}
      : m;
  return {markerStart: paint(fresh.markerStart), markerEnd: paint(fresh.markerEnd)};
};

/** One matched edge: the canvas edge with the text's spoken facts overlaid. */
export function mergeEdge(cur: FlowEdge, fresh: FlowEdge): FlowEdge {
  const labelChanged = (cur.label ?? null) !== (fresh.label ?? null);
  const markers = mergeMarkers(cur, fresh);
  return {
    ...cur,
    label: fresh.label,
    data: mergeData((cur.data ?? {}) as EdgeData, (fresh.data ?? {}) as EdgeData, labelChanged),
    style: mergeStyle(cur.style, fresh.style),
    markerStart: markers.markerStart,
    markerEnd: markers.markerEnd,
  };
}

/* THE MERGE (t_8926135b) — reconciled by (source,target) pair, NOT rebuilt.
 * A compiled edge arrives with the PRESET's defaults, so the old wholesale
 * rebuild reset every canvas-only fact the grammar does not speak (colour
 * key, path type, handles, bends, label pin). Per pair: mergeEdge above.
 * Unmatched compiled edges are new; a pair the text no longer declares
 * dies; edges touching an unspeakable node pass through. A new/pass-through
 * id that collides with one already placed is suffixed until free
 * (deterministic — the loop re-runs to a stable fixpoint on re-apply). */
export function reconcileEdges(
  currentEdges: FlowEdge[], freshEdges: FlowEdge[], spoken: Set<string>,
): FlowEdge[] {
  const candidate = new Map<string, FlowEdge[]>();
  for (const e of currentEdges) {
    if (!(spoken.has(e.source) && spoken.has(e.target))) continue;
    const k = `${e.source}->${e.target}`;
    (candidate.get(k) ?? candidate.set(k, []).get(k)).push(e);
  }
  const edges: FlowEdge[] = [];
  const taken = new Set<string>();
  const suffixFree = (f: FlowEdge): FlowEdge => {
    let id = f.id;
    while (taken.has(id)) id = `${id}-m`;
    taken.add(id);
    return id === f.id ? f : {...f, id};
  };
  const freshOnly: FlowEdge[] = [];
  for (const f of freshEdges) {
    const cur = candidate.get(`${f.source}->${f.target}`)?.shift();
    if (!cur) { freshOnly.push(f); continue; }
    taken.add(cur.id);
    edges.push(mergeEdge(cur, f));
  }
  for (const f of freshOnly) edges.push(suffixFree(f));
  for (const e of currentEdges) {
    if (spoken.has(e.source) && spoken.has(e.target)) continue; /* reconciled above */
    edges.push(suffixFree(e));
  }
  return edges;
}

