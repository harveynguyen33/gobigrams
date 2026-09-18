/**
 * ROUND S — the maths of a draw.io-style midpoint drag.
 *
 * WHY THIS FILE EXISTS, and why it is pure (no React, no DOM):
 *
 * The bend SLIDER shipped in 2644477 is geometrically INERT on a level pair of
 * nodes. `getSmoothStepPath`'s `stepPosition` slides the step's cross-bar along
 * the split axis, and between two nodes level on the perpendicular axis that bar
 * has zero length — so the parameter is discarded and the drawn line is
 * identical at 0, 0.5 and 1. Harvey's board is exactly that (`e1`: a level
 * right→left pair, 212px apart, 0.000px across the whole sweep), which is why
 * the control reads as a lie. The slider keeps its UI and its behaviour — that is
 * what it is for.
 *
 * draw.io does something better: ONE draggable midpoint on the selected edge.
 * Its reference (`mxEdgeSegmentHandler.getCurrentPoints`) synthesises a point for
 * a 2-point edge, so ANY line is immediately draggable, and THE DRAG MOVES ALONG
 * ONE AXIS ONLY — the other coordinate is inherited. That single-axis rule is
 * the whole reason draw.io's control feels square.
 *
 * ---------------------------------------------------------------------------
 * THE FOUR GENERATOR FACTS THIS FILE IS BUILT ON, all read out of the installed
 * `@xyflow/system` and re-checked by `checks/round-s-edge-bend.mjs`:
 *
 * 1. THE CENTRE IS READ ONLY IN THE OPPOSITE-HANDLE BRANCH (:1263). The other
 *    branch recomputes it outright (:1341), so a stored point there is a place
 *    the line never goes — hence `bendActive4`/`bendDraggable4` and
 *    `effectiveMid`.
 * 2. WHICH COORDINATE IS READ DEPENDS ON THE HANDLE AXIS. The bar is the
 *    VERTICAL split (reads `centerX`) when `sourceDir[dirAccessor] === currDir`
 *    (:1292), else the HORIZONTAL one (reads `centerY`, :1288-1291) — and
 *    `dirAccessor` comes from the SOURCE handle (:1250). So the same "do the
 *    handles point the same way" answer means opposite coordinates for a
 *    top/bottom pair and a left/right pair. Reading it off `agree` alone (the
 *    first attempt at this file) makes the drag write a coordinate the generator
 *    reads for something else, and the line just sits there. `bendAxis` derives
 *    it from the split actually used, and the harness is the proof.
 * 3. A COLLAPSED BAR CANNOT BE BENT BY THE GENERATOR AT ALL. When the bar's two
 *    ends coincide, any centre slides a zero-length segment: `getSmoothStepPath`
 *    is structurally unable to draw the detour. `customStepPath` draws it by
 *    hand from the same gapped points, with `getBend` replicated verbatim
 *    (:1363-1379) so the corners round the same way as every other edge.
 * 4. THE PATH'S LABEL IS THE PASSED CENTRE. `getPoints` returns `centerX`/
 *    `centerY` (:1361) and `centeredPath` passes both coordinates, so the label —
 *    and therefore the handle, which sits on it — is exactly the point handed
 *    over. That is what makes the handle stay on the line AND on the label: one
 *    point, computed once. `applyDrag` clears the coordinate the drag does NOT
 *    own, so that point is always on the bar and never drifts off the line when
 *    a node moves and the split choice changes under a stored value.
 * ---------------------------------------------------------------------------
 */
import {getSmoothStepPath, Position} from '@xyflow/system';

export type Pt = {x: number; y: number};
export type Side4 = 'left' | 'right' | 'top' | 'bottom';
/** The coordinate the drag owns. `'h'` = it writes `centerX`, `'v'` = `centerY`
 *  (see `bendAxis`, which derives this from the split the generator uses). */
export type BendAxis = 'h' | 'v';
export type BendPhase = 'start' | 'move';
export type BendGeo = {s: Pt; t: Pt; sp: Side4; tp: Side4};

/** The generator's own `handleDirections` table (index.mjs:1223). */
export const SIDE_OUT: Record<Side4, Pt> = {
  left: {x: -1, y: 0}, right: {x: 1, y: 0}, top: {x: 0, y: -1}, bottom: {x: 0, y: 1},
};
export const OPPOSITE_SIDE: Record<Side4, Side4> = {
  left: 'right', right: 'left', top: 'bottom', bottom: 'top',
};
/** React Flow's own `offset` default in `getSmoothStepPath` (index.mjs:1411). */
export const STEP_GAP_PX = 20;

export const isSide4 = (v: unknown): v is Side4 =>
  v === 'left' || v === 'right' || v === 'top' || v === 'bottom';

/** The two gapped endpoints — source/target pushed out along their own handle
 *  direction by `offset` (index.mjs:1243-1244). */
const gapped = (geo: BendGeo, gap = STEP_GAP_PX) => {
  const sd = SIDE_OUT[geo.sp];
  const td = SIDE_OUT[geo.tp];
  return {
    sg: {x: geo.s.x + sd.x * gap, y: geo.s.y + sd.y * gap},
    tg: {x: geo.t.x + td.x * gap, y: geo.t.y + td.y * gap},
  };
};

/** The generator's `distance` helper (index.mjs:1235). */
const distance = (a: Pt, b: Pt) => Math.sqrt((b.x - a.x) ** 2 + (b.y - a.y) ** 2);

/** The generator's own routing decision (index.mjs:1245-1251, :1263, :1292-1297).
 *
 *  `usedVertical` is the split the path is actually built from — `agree` XOR
 *  `dirAccessor === 'x'`, per facts 2 above. `bar` is that split's two ends: the
 *  segment the centre slides. `barLen === 0` means the bar is a point and the
 *  centre cannot move the line (fact 3). */
function splitInfo(geo: BendGeo) {
  const {sg, tg} = gapped(geo);
  const dirAccessor: 'x' | 'y' = geo.sp === 'left' || geo.sp === 'right' ? 'x' : 'y';
  const currDir = dirAccessor === 'x'
    ? (sg.x < tg.x ? 1 : -1)
    : (sg.y < tg.y ? 1 : -1);
  const agree = SIDE_OUT[geo.sp][dirAccessor] === currDir;
  const usedVertical = agree === (dirAccessor === 'x');
  const bar: [Pt, Pt] = usedVertical
    ? [{x: 0, y: sg.y}, {x: 0, y: tg.y}]
    : [{x: sg.x, y: 0}, {x: tg.x, y: 0}];
  return {sg, tg, dirAccessor, currDir, agree, usedVertical, bar, barLen: distance(bar[0], bar[1])};
}

/** Does a bend position reach the path at all? The existing `bendActive`
 *  predicate, generalised onto the geometry: the opposite-handle case only
 *  (fact 1), and the source handle must point along the run on BOTH readings —
 *  `getDirection`'s overall direction (`:1229`) and the split selector
 *  (`:1292`) — or the generator discards the fraction. This is the SLIDER's
 *  gate: a fraction only ever writes the PRIMARY coordinate, which is narrower
 *  than "a drag can move it" (see `bendDraggable4`). */
export function bendActive4(geo: BendGeo): boolean {
  if (OPPOSITE_SIDE[geo.sp] !== geo.tp) return false;
  const {sg, tg, dirAccessor, currDir} = splitInfo(geo);
  const od = SIDE_OUT[geo.sp];
  const overall = dirAccessor === 'x'
    ? (sg.x < tg.x ? {x: 1, y: 0} : {x: -1, y: 0})
    : (sg.y < tg.y ? {x: 0, y: 1} : {x: 0, y: -1});
  const axis = overall.x !== 0 ? 'x' : 'y';
  return od[axis] === overall[axis] && od[dirAccessor] === currDir;
}

/** Can the midpoint drag move this line at all? Every OPPOSITE-side geometry —
 *  the whole set of shapes where the generator consults a centre at all
 *  (fact 1). Within it, either the bar is a real segment and the generator's own
 *  centre moves the line, or the bar has collapsed and `customStepPath` draws the
 *  detour. This is the HANDLE's gate, and `bendAxis` names the coordinate. */
export function bendDraggable4(geo: BendGeo): boolean {
  return OPPOSITE_SIDE[geo.sp] === geo.tp;
}

/** The shape `getSmoothStepPath` cannot bend: the bar it uses has both ends in
 *  the same place, so the centre slides a zero-length segment (fact 3). */
export function collapsed4(geo: BendGeo): boolean {
  return splitInfo(geo).barLen === 0;
}

/** Can the generator DRAW the point the drag writes — i.e. is the bar a real
 *  segment? False only on a collapsed bar, which takes the hand-built route. */
export function axisLive(geo: BendGeo): boolean {
  return splitInfo(geo).barLen > 0;
}

/** The coordinate the drag owns: the one the used split reads (`:1279-1291`),
 *  or — on a collapsed bar — the PERPENDICULAR one, the only coordinate left
 *  that can bend the line. `'h'` = writes `centerX`, `'v'` = writes `centerY`. */
export function bendAxis(geo: BendGeo): BendAxis {
  const {usedVertical, barLen, dirAccessor} = splitInfo(geo);
  if (barLen > 0) return usedVertical ? 'h' : 'v';
  return dirAccessor === 'x' ? 'v' : 'h';
}

/** THE GATE, for a caller that already holds the geometry — the edge renderer,
 *  which is handed both anchors and both handle sides as props. `App.bendSupport`
 *  is the same rule expressed for an `Edge` plus the board's nodes, so the drag
 *  handle and the inspector's slider are enabled together. */
export function bendGate(geo: BendGeo): {active: boolean; axis: BendAxis | null} {
  return bendDraggable4(geo) ? {active: true, axis: bendAxis(geo)} : {active: false, axis: null};
}

/** The plain coordinate midpoint of the gapped endpoints — EXACTLY what the
 *  generator computes for `stepPosition: 0.5` (:1266 / :1272). This is the point
 *  a board with no stored bend must hand over, so that adding this feature
 *  changes no existing path by a fraction of a pixel. */
export function plainMidpoint(geo: BendGeo): Pt {
  const {sg, tg} = gapped(geo);
  return {x: (sg.x + tg.x) / 2, y: (sg.y + tg.y) / 2};
}

/** The drawn W for an edge: the stored coordinate for the axis the drag owns,
 *  the fraction `stepPosition` would have produced for the axis it does NOT, and
 *  the generator's own midpoint otherwise. Keeping the fraction here is what
 *  makes the step-position slider keep working through this renderer (harness
 *  (a2)) and what keeps an untouched board byte-identical. */
export function drawnMid(geo: BendGeo, bendX?: number, bendY?: number, bend?: number): Pt {
  const {sg, tg, dirAccessor} = splitInfo(geo);
  const f = bend ?? 0.5;
  return {
    x: bendX ?? (dirAccessor === 'x' ? sg.x + (tg.x - sg.x) * f : (sg.x + tg.x) / 2),
    y: bendY ?? (dirAccessor === 'y' ? sg.y + (tg.y - sg.y) * f : (sg.y + tg.y) / 2),
  };
}

/** The W the path actually draws through: the free point where a centre is
 *  consulted, the generator's own midpoint where it is not (fact 1 — a stored
 *  point there would be a place the line never goes). */
export function effectiveMid(geo: BendGeo, W: Pt): Pt {
  return bendDraggable4(geo) ? W : plainMidpoint(geo);
}

/** The centre of the bar for a given W — which is also the point the generator
 *  reports as the label when the bar is the coordinate it reads. On an untouched
 *  edge this IS the plain midpoint: the synthesised handle draw.io starts the
 *  user from, in the middle of the line, with nothing stored. */
export function stepMidpoint(geo: BendGeo, W: Pt): Pt {
  const {sg, tg} = gapped(geo);
  return bendAxis(geo) === 'h'
    ? {x: W.x, y: (sg.y + tg.y) / 2}
    : {x: (sg.x + tg.x) / 2, y: W.y};
}

/** The exact object a drag writes: the owned key ONLY. Modelled here rather than
 *  inline in `onBend` so the harness exercises the real writer — a patch that
 *  carried the other coordinate too would let a drag leak into a coordinate the
 *  generator reads for its own purposes. */
export function dragPatch(axis: BendAxis, W: Pt): {bendX?: number; bendY?: number} {
  return axis === 'h' ? {bendX: W.x} : {bendY: W.y};
}

/** The bend keys an edge's data may carry. */
export type BendData = {bend?: number; bendX?: number; bendY?: number};

/** An edge's data after a drag: the owned key written, and BOTH stale keys
 *  dropped — the `stepPosition` fraction, and the coordinate for the axis this
 *  drag does not own.
 *
 *  The fraction goes because once an absolute point is stored the generator
 *  stops reading it (`:1266` / `:1272` short-circuit on the passed centre), and a
 *  value nothing reads is the dead control this round exists to remove. The
 *  OTHER axis's key goes because a drag writes one coordinate and the other is
 *  inherited: leaving a stale per-axis coordinate behind would let a node move
 *  change which split the generator uses, promote that stale value into the one
 *  it reads, and throw the label off the bar and the handle off the line.
 *
 *  (The step-position SLIDER is untouched: it still writes `bend`, and `drawnMid`
 *  still honours it — only a DRAG supersedes it.) */
export function applyDrag<T extends BendData>(data: T, axis: BendAxis, W: Pt): T {
  const out = {...data, ...dragPatch(axis, W)} as T;
  delete out.bend;
  if (axis === 'h') delete out.bendY; else delete out.bendX;
  return out;
}

/** `getBend` replicated from the installed generator (index.mjs:1363-1379)
 *  VERBATIM, so the hand-built path below rounds its corners exactly like every
 *  other edge on the board — including the collinear early return. */
function getBend(a: Pt, b: Pt, c: Pt, size: number): string {
  const bendSize = Math.min(distance(a, b) / 2, distance(b, c) / 2, size);
  const {x, y} = b;
  if ((a.x === x && x === c.x) || (a.y === y && y === c.y)) return `L${x} ${y}`;
  if (a.y === y) {
    const xDir = a.x < c.x ? -1 : 1;
    const yDir = a.y < c.y ? 1 : -1;
    return `L ${x + bendSize * xDir},${y}Q ${x},${y} ${x},${y + bendSize * yDir}`;
  }
  const xDir = a.x < c.x ? 1 : -1;
  const yDir = a.y < c.y ? -1 : 1;
  return `L ${x},${y + bendSize * yDir}Q ${x},${y} ${x + bendSize * xDir},${y}`;
}

/** The step path for the geometry the generator cannot express (fact 3): the
 *  detour is placed at the free coordinate, between the same gapped points and
 *  with the same corner treatment, so the line looks like the generator drew it.
 *  Its label is the bar's centre, which is on that detour by construction. With
 *  W at the midpoint every point is collinear, `getBend` returns the straight
 *  `L`, and the result traces the same line the generator draws (harness (a)). */
export function customStepPath(geo: BendGeo, W: Pt, borderRadius: number): [string, number, number] {
  const {sg, tg, usedVertical} = splitInfo(geo);
  const free = usedVertical ? W.y : W.x;
  const a = usedVertical ? {x: sg.x, y: free} : {x: free, y: sg.y};
  const b = usedVertical ? {x: tg.x, y: free} : {x: free, y: tg.y};
  const pts: Pt[] = [];
  for (const p of [geo.s, sg, a, b, tg, geo.t]) {
    const last = pts[pts.length - 1];
    if (!last || last.x !== p.x || last.y !== p.y) pts.push(p);
  }
  let path = `M${pts[0].x} ${pts[0].y}`;
  for (let i = 1; i < pts.length - 1; i++) path += getBend(pts[i - 1], pts[i], pts[i + 1], borderRadius);
  path += `L${pts[pts.length - 1].x} ${pts[pts.length - 1].y}`;
  const anchor = stepMidpoint(geo, W);
  return [path, anchor.x, anchor.y];
}

/** True when a stored point exists on the axis the generator cannot draw, so the
 *  hand-built route is required. Everything else — including a stored point the
 *  generator's used split reads — stays on the generator. */
export function needsCustom(geo: BendGeo, bendX?: number, bendY?: number): boolean {
  if (axisLive(geo)) return false;
  return bendAxis(geo) === 'h' ? bendX !== undefined : bendY !== undefined;
}

/** `getSmoothStepPath` with an explicit centre and NO fraction. Both coordinates
 *  are handed over, so the generator's own label (`:1361`) is exactly this point
 *  — which is why the handle, drawn at the label, is always on the line. */
export function centeredPath(geo: BendGeo, W: Pt, borderRadius: number): [string, number, number] {
  const [path, labelX, labelY] = getSmoothStepPath({
    sourceX: geo.s.x, sourceY: geo.s.y, sourcePosition: geo.sp as Position,
    targetX: geo.t.x, targetY: geo.t.y, targetPosition: geo.tp as Position,
    borderRadius,
    centerX: W.x, centerY: W.y,
  });
  return [path, labelX, labelY];
}

/** The path through the INSTALLED generator with an explicit centre, so a bent
 *  line and an unbent one come out of exactly the same code. */
export function stepPath(geo: BendGeo, W: Pt, borderRadius: number): [string, number, number] {
  return centeredPath(geo, effectiveMid(geo, W), borderRadius);
}

/** Everything a renderer needs for one bend-capable edge, from ONE call, so the
 *  path, the label and the handle cannot be derived from different points:
 *  `labelX`/`labelY` ARE the synthesised midpoint (draw.io's handle in the middle
 *  of the line) and the handle is drawn there — the spec's `mx`/`my`. `custom`
 *  selects the hand-built route (`needsCustom` decides). */
export function bendRender(
  geo: BendGeo, W: Pt, borderRadius: number, custom = false,
): {path: string; labelX: number; labelY: number} {
  const E = effectiveMid(geo, W);
  const [path, labelX, labelY] = custom
    ? customStepPath(geo, E, borderRadius)
    : centeredPath(geo, E, borderRadius);
  return {path, labelX, labelY};
}
