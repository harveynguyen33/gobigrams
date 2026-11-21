/* GOBI-CONNECT (task t_c911fabb) — THE HEADLESS ROUTE.
 *
 * WHY THIS FILE EXISTS. `exportScene` routes an edge through the live clone's
 * own SVG path when a DOM element is present (`measurer.edgePath`), and fell to
 * `stubEdgePath` otherwise — literally centre-to-centre. The headless doors
 * (`scripts/gobi-render.mjs`, the blog fence, the /embed route, any export with
 * no mounted canvas) have no element, so EVERY edge there was a segment from
 * one box centre to the other: the arrowhead landed in the middle of the target
 * and the line ran across both boxes' text. Measured on the sample document:
 * `M 95,47.5 L 435,47.5` where the boxes are `0..190` and `340..530`.
 *
 * So the fallback now derives the REAL route from geometry the board already
 * carries — each edge's `sourceHandle`/`targetHandle` (the four midpoint ids the
 * canvas ships) and each node's absolute box — and hands it to the path
 * generators `GoblinEdge` uses (`getBezierPath` / `getSmoothStepPath` /
 * `getStraightPath`). CORE-STEP1: those now come from `src/gobi/paths.ts`, the
 * local attributed copy of @xyflow/system's generators — byte-identical output
 * to the library is PROVEN (round-gobi-core-decouple P2, >= 1000 randomized
 * cases, max deviation <= 0.001 px), so there is still no second curve
 * implementation here: the generator that paints the canvas and the generator
 * that paints the file emit the same `d` for the same geometry.
 *
 * WHAT IT DELIBERATELY DOES NOT DO. A dragged bend (`data.bendX`/`bendY`) is
 * not replayed: the bend routes live in `edgeBend.ts`, they need both
 * coordinates AND `App`'s axis decision, and a bend only exists after a pointer
 * gesture on a mounted canvas — a board that carries one is exported from that
 * canvas, where the measurer reads the painted path. Unknown/compound handle
 * ids (the ERD column handles `right_rel_o_id`…) return null, and the caller
 * keeps its own stub: a wrong guess would be worse than the honest fallback.
 */

import {getBezierPath, getSmoothStepPath, getStraightPath, Position} from '../../paths';
import {isSide4, type Side4} from '../edgeBend';

export type RouteBox = {x: number; y: number; w: number; h: number};

export type RoutedPath = {
  d: string;
  /** The anchors themselves, in the path's own coordinate space — the caller
   *  derives the edge label from them, exactly as it does from a measured
   *  route's endpoints. */
  start: {x: number; y: number};
  end: {x: number; y: number};
  /** ERD-CARDINALITY — a self-loop's label point. The start/end midpoint is
   *  INSIDE the node box; a loop routes the label to a clear rail instead. */
  label?: {x: number; y: number};
};

/** The edge fields the route reads (a structural subset of `ExportEdge`, so
 *  this module stays independent of the emitter's own types). */
export type RouteEdge = {
  type?: string;
  sourceHandle?: string | null;
  targetHandle?: string | null;
  data?: Record<string, unknown> | null;
};

const POSITION: Record<Side4, Position> = {
  left: Position.Left,
  right: Position.Right,
  top: Position.Top,
  bottom: Position.Bottom,
};

/** The point a connector leaves the box from: the MIDDLE of that side, ON the
 *  border. This is the anchor the canvas paints its handle at, and React Flow's
 *  own `getHandlePosition` measures to the same border. */
export function handleAnchor(b: RouteBox, side: Side4): {x: number; y: number} {
  switch (side) {
    case 'right': return {x: b.x + b.w, y: b.y + b.h / 2};
    case 'left': return {x: b.x, y: b.y + b.h / 2};
    case 'top': return {x: b.x + b.w / 2, y: b.y};
    case 'bottom': return {x: b.x + b.w / 2, y: b.y + b.h};
  }
}

/** The kind selector `GoblinEdge` applies: the stored `data.shape` first (that
 *  is what the inspector writes), the edge's own `type` as the legacy fallback,
 *  and `goblinEdge` IS the bezier kind (`makeEdge` maps path 'bezier' → it). */
function kindOf(e: RouteEdge): string {
  const shape = e.data ? e.data.shape : undefined;
  const kind = typeof shape === 'string' && shape ? shape : e.type;
  /* `goblinEdge` is `makeEdge`'s id for path 'bezier', and `custom` is the
     legacy alias the inspector still maps to it — both are the curved kind. */
  if (!kind || kind === 'goblinEdge' || kind === 'custom') return 'bezier';
  return kind;
}

/**
 * The route the canvas would draw for this edge, from model geometry alone.
 * Returns null when either handle is missing or not one of the four midpoint
 * ids — the caller then keeps its own stub.
 */
export function edgeRoute(e: RouteEdge, src: RouteBox, tgt: RouteBox): RoutedPath | null {
  const sh = e.sourceHandle, th = e.targetHandle;
  if (!isSide4(sh) || !isSide4(th)) return null;
  const start = handleAnchor(src, sh);
  const end = handleAnchor(tgt, th);
  const opts = {
    sourceX: start.x, sourceY: start.y, sourcePosition: POSITION[sh],
    targetX: end.x, targetY: end.y, targetPosition: POSITION[th],
  };
  const kind = kindOf(e);
  /* The two radii are GoblinEdge's own (0 for the sharp `step`, 12 for
     `smoothstep`); `stepPosition` stays undefined so the generator's own 0.5
     applies exactly as it does on the canvas. */
  let d: string;
  if (kind === 'straight') {
    [d] = getStraightPath(opts);
  } else if (kind === 'step') {
    [d] = getSmoothStepPath({...opts, borderRadius: 0});
  } else if (kind === 'smoothstep') {
    [d] = getSmoothStepPath({...opts, borderRadius: 12});
  } else {
    [d] = getBezierPath(opts);
  }
  return {d, start, end};
}

/* ------------------------------------------------- ERD-CARDINALITY (self) */

/** The side a handle id names, including the table node's compound ids
 *  (`left_rel_c2`, `right_rel_c1`, `target_rel_0_c3`). A table renders no
 *  generic side handles, so the adapter translates BEFORE this reads one. */
export function sideOfHandle(h: string | null | undefined): Side4 | null {
  if (['left', 'right', 'top', 'bottom'].includes(h!)) return h as Side4;
  return h && h.startsWith('left_rel_') ? 'left' : h && h.startsWith('right_rel_') ? 'right' : null;
}

/** The marker kind an edge end declares (a CrowFoot word, or the RF arrow
 *  sentinels). Shared by the scene builder and the emitted glyph picker. */
export function markerKindOf(m: unknown): string | undefined {
  const t = m && typeof m === 'object' ? (m as {type?: unknown}).type : undefined;
  return typeof t === 'string' && t ? t : undefined;
}

const n2 = (v: number) => Math.round(v * 100) / 100;
const LOOP_GAP = 36;

/**
 * A self-edge's route: a rectangular detour OUTSIDE the node box, never a
 * line through it. `variant` 0/1 picks the two bow directions (up/down for a
 * left/right anchor pair, right/left for a top/bottom pair), so two self-edges
 * between the same node are two distinct visible loops. The label rides the
 * outer rail, clear of the box, and is returned on `label` because the
 * start/end midpoint would sit inside it.
 */
export function selfLoopRoute(
  b: RouteBox, sh: string | null | undefined, th: string | null | undefined, variant = 0,
): RoutedPath | null {
  const ss = sideOfHandle(sh), ts = sideOfHandle(th);
  if (!ss || !ts) return null;
  const A = handleAnchor(b, ss), B = handleAnchor(b, ts);
  const first = variant % 2 === 0;
  const p: {x: number; y: number}[] = [A];
  let label: {x: number; y: number};
  if (ss === 'left' || ss === 'right') {
    const xa = A.x + (ss === 'right' ? LOOP_GAP : -LOOP_GAP);
    const xb = B.x + (ts === 'right' ? LOOP_GAP : ts === 'left' ? -LOOP_GAP : 0);
    const railY = first ? b.y - LOOP_GAP : b.y + b.h + LOOP_GAP;
    p.push({x: xa, y: A.y}, {x: xa, y: railY}, {x: xb, y: railY}, {x: xb, y: B.y});
    label = {x: (xa + xb) / 2, y: railY};
  } else {
    const ya = A.y + (ss === 'bottom' ? LOOP_GAP : -LOOP_GAP);
    const yb = B.y + (ts === 'bottom' ? LOOP_GAP : ts === 'top' ? -LOOP_GAP : 0);
    const railX = first ? b.x + b.w + LOOP_GAP : b.x - LOOP_GAP;
    p.push({x: A.x, y: ya}, {x: railX, y: ya}, {x: railX, y: yb}, {x: B.x, y: yb});
    label = {x: railX, y: (ya + yb) / 2};
  }
  p.push(B);
  const d = p.map((q, i) => `${i ? 'L' : 'M'} ${n2(q.x)},${n2(q.y)}`).join(' ');
  return {d, start: A, end: B, label};
}
