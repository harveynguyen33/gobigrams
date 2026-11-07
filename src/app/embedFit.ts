/* embedFit.ts — the /embed fit's GEOMETRY, as pure functions (no React, no
 * React Flow, no DOM). EMBED-FIT-TIEBREAK extracted it so the box arithmetic
 * can be reasoned about — and harnessed — without a browser, and so
 * `embed.tsx` stays inside its file-size budget.
 *
 * WHY THE BOX COMES FROM THE DOC: measured on 0911c57, a fit whose bounds
 * came only from the store's LIVE nodes wrote nothing at all in a frame the
 * host had not composited (`translate(0px, 0px) scale(1)` — six cards painted
 * outside an 800x450 frame), because a node contributes to the union only once
 * React Flow has MEASURED it. The reader's first viewport must not depend on
 * when the frame composited, so it is computed from the document's own
 * positions and sizes: the size the board carries, or — where a node has none
 * (a legacy board, a band with no box) — the palette's default for that kind
 * from `src/layout/nodeSizes.ts`. No number is invented here; when the store's
 * measured sizes arrive the caller refines with them (never the reverse). */
import {CARD_SIZE, SIZE_EXCEPTIONS} from '../layout/nodeSizes';

export type DocBox = {x: number; y: number; width: number; height: number};

/** The node fields the fit reads: the DOC's (position/width/height/style/
 *  parentId/type/data) and the STORE's (`measured` + `internals`). One shape
 *  covers both so the doc box and the live box cannot drift apart. */
export type SizedNode = {
  id?: string;
  type?: string;
  data?: unknown;
  position?: {x: number; y: number};
  parentId?: string | null;
  measured?: {width?: unknown; height?: unknown};
  width?: unknown;
  height?: unknown;
  style?: {width?: unknown; height?: unknown} | null;
  internals?: {positionAbsolute?: {x: number; y: number}};
  hidden?: boolean;
};

export const num = (v: unknown): number => {
  if (typeof v === 'number' && v > 0) return v;
  /* A persisted size can legitimately be the CSS spelling ("290px"): React
     Flow's resizer writes px strings into `style`, and a board saved from that
     path keeps them. Without this a SIZED node would read as unsized and fall
     out of the union — the partial-set clip this module exists to prevent. */
  if (typeof v === 'string') {
    const n = parseFloat(v);
    if (Number.isFinite(n) && n > 0) return n;
  }
  return 0;
};

/** The ONE size table (`src/layout/nodeSizes.ts`) — the same numbers the
 *  palette stamps at insert. */
const SHAPE_SIZE: Record<string, {width: number; height: number}> = {
  connector: SIZE_EXCEPTIONS.connector.size,
  lifeline: SIZE_EXCEPTIONS.lifeline.size,
  activation: SIZE_EXCEPTIONS.activation.size,
  fragment: SIZE_EXCEPTIONS.fragment.size,
  group: SIZE_EXCEPTIONS.group.size,
  note: SIZE_EXCEPTIONS.note.size,
};

/** The palette's default box for a node kind that carries no size of its own. */
export const defaultSize = (n: SizedNode): {width: number; height: number} => {
  const shape = (n.data as {shape?: string} | undefined)?.shape;
  if (shape && SHAPE_SIZE[shape]) return SHAPE_SIZE[shape];
  if (n.type === 'table') return SIZE_EXCEPTIONS.table.size;
  if (n.type === 'label') return SIZE_EXCEPTIONS.label.size;
  return CARD_SIZE; // every card kind in the library
};

/** A node's box: persisted size, else the kind default. NEVER zero, so no node
 *  can fall out of a union. `measured` is only consulted for LIVE store nodes —
 *  the document's copy of it describes another machine's layout. */
export const sizeOf = (n: SizedNode, measured = false): {width: number; height: number} => {
  if (measured) {
    const mw = num(n.measured?.width);
    const mh = num(n.measured?.height);
    if (mw && mh) return {width: mw, height: mh};
  }
  const w = num(n.width) || num(n.style?.width);
  const h = num(n.height) || num(n.style?.height);
  if (w && h) return {width: w, height: h};
  const d = defaultSize(n);
  return {width: w || d.width, height: h || d.height};
};

/** Union box over `nodes`, positioned by `absOf`. Null only when the list is
 *  empty — a node can no longer be skipped for being unsized. */
const unionBox = (
  nodes: SizedNode[],
  absOf: (n: SizedNode) => {x: number; y: number},
  measured: boolean,
): DocBox | null => {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity, any = false;
  for (const n of nodes) {
    if (n.hidden) continue;
    const {width, height} = sizeOf(n, measured);
    const p = absOf(n);
    x0 = Math.min(x0, p.x); y0 = Math.min(y0, p.y);
    x1 = Math.max(x1, p.x + width); y1 = Math.max(y1, p.y + height);
    any = true;
  }
  return any ? {x: x0, y: y0, width: x1 - x0, height: y1 - y0} : null;
};

/** The DOCUMENT's own geometry — the box the first viewport is decided from,
 *  before React Flow has adopted or measured anything. A `parentId` child is
 *  stored parent-relative, so the chain is walked (with a cycle guard). */
export const docBox = (nodes: SizedNode[]): DocBox | null => {
  const byId = new Map<string, SizedNode>();
  for (const n of nodes) if (n.id) byId.set(n.id, n);
  const abs = (n: SizedNode, seen: Set<string>): {x: number; y: number} => {
    const p = n.position ?? {x: 0, y: 0};
    const pid = n.parentId;
    if (!pid || seen.has(pid)) return p;
    const parent = byId.get(pid);
    if (!parent) return p;
    const pp = abs(parent, new Set([...seen, pid]));
    return {x: pp.x + p.x, y: pp.y + p.y};
  };
  return unionBox(nodes, (n) => abs(n, new Set(n.id ? [n.id] : [])), false);
};

/** The STORE's live geometry — the REFINEMENT: measured first, then persisted,
 *  then the kind default. Positions use React Flow's absolute resolution
 *  (`internals.positionAbsolute`) so parent-relative children need no
 *  re-derivation. */
export const liveBox = (nodes: SizedNode[]): DocBox | null =>
  unionBox(nodes, (n) => n.internals?.positionAbsolute ?? n.position ?? {x: 0, y: 0}, true);
