/**
 * ROUND T — the maths of a FREE 2-D midpoint waypoint, draw.io's model.
 * ROUND U — the same afforance on EVERY edge kind: `bezier` and `straight` are
 * the free 2-D kinds (no axis lock at all — both coordinates move together,
 * always), `step`/`smoothstep` keep ROUND T's one-axis rule untouched.
 *
 * WHY THIS FILE EXISTS, and why it is pure (no React, no DOM): the rules below
 * are the whole of the drag's geometry, so `checks/round-s-edge-bend.mjs` can run
 * them in plain Node against the INSTALLED generator and nothing here can be
 * wrong in a way the app hides.
 *
 * ---------------------------------------------------------------------------
 * THE MEASURED ROOT CAUSE OF THE OLD ONE-AXIS MODEL (ROUND S, deleted here).
 *
 * ROUND S decided the drag's axis from the split `getSmoothStepPath` happens to
 * use. Measured on the installed generator (`@xyflow/system`), dragging 90px:
 *
 *   e1  level right→left, 212px      barLen 0    axis 'v'  up/down 90.0px, left/right 0.0px
 *   e2  right→left, 0.5px stagger    barLen >0   axis 'h'  up/down  0.0px, left/right 0.5px
 *   any stagger ≥ 0.001px            barLen >0   axis 'h'  up/down  0.0px, left/right works
 *
 * The axis FLIPS at 0.001px of stagger: on every edge that is not pixel-level
 * the dot could only move left/right — exactly the user's complaint, on a board
 * whose live edge (`e1`) has 188px of vertical stagger.
 *
 * AND THE GENERATOR CANNOT BE MADE TO GIVE BOTH DIRECTIONS. A 600-geometry
 * sweep that flipped `centerX` by 60 and then `centerY` by 60, watching which
 * move changes the drawn path:
 *
 *   both coordinates move the line :   0  (0.0%)
 *   only centerX moves it          : 290
 *   only centerY moves it          : 309
 *   neither (collapsed bar)        :   1
 *
 * `getSmoothStepPath` reads exactly ONE of the two coordinates, never both. So
 * "store both coordinates and let the generator draw it" cannot work on ANY
 * geometry, and the one-axis rule was a consequence of the generator's shape
 * rather than of what the user wants.
 *
 * ---------------------------------------------------------------------------
 * THE MODEL THAT REPLACES IT, and it is simpler:
 *
 *   NO stored bend point → the GENERATOR (unchanged, byte-identical).
 *   A stored bend point  → OUR OWN route, which reads BOTH coordinates:
 *                          `freePath` for the orthogonal kinds (a staircase),
 *                          `straightPath` / `bezierPath` (ROUND U) for the free
 *                          kinds.
 *
 * Parity is guaranteed by construction — an untouched board never leaves the
 * generator — and it is the only way both directions can work.
 *
 * `getBend` below is replicated VERBATIM from the installed generator
 * (index.mjs:1363-1379) so a hand-routed line rounds its corners exactly like
 * every other edge on the board. The only `edgeBend` rules that survived ROUND S
 * are the ones with a LIVE reader: `drawnMid` (the drag's base point),
 * `plainMidpoint` (the generator's own default), `bendGate` (where a handle is
 * offered at all) and `applyDrag` (the writer).
 * ---------------------------------------------------------------------------
 */
export type Pt = {x: number; y: number};
export type Side4 = 'left' | 'right' | 'top' | 'bottom';
/** The coordinate a single drag owns. `'h'` = it writes `bendX`, `'v'` = `bendY`
 *  — decided from the POINTER delta (`dragAxis`), never from the routing.
 *
 *  ROUND U adds `'free'`: the axis is IRRELEVANT on the free 2-D kinds
 *  (`bezier`/`straight`), where draw.io moves both coordinates together. There
 *  is no projection on those kinds — `applyDrag` writes BOTH keys — and no axis
 *  cursor either, because there is no axis to advertise. */
export type BendAxis = 'h' | 'v' | 'free';
export type BendPhase = 'start' | 'move' | 'end';
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

/** ROUND U — is this edge kind the FREE 2-D model (no axis lock)? `bezier` and
 *  `straight` move both coordinates on every drag, so their drag writes both
 *  keys and their path reads both; `step`/`smoothstep` keep the one-axis rule
 *  (ROUND T) and are the ONLY kinds `bendDraggable4` has an opinion about.
 *
 *  ONE reader, shared by the renderer (`GoblinEdge`) and the writer (`App`), so
 *  the axis the drag projects onto and the axis the path is drawn from can never
 *  disagree. `custom` is the legacy alias the inspector still maps to
 *  `goblinEdge`, so it resolves to the same free model. */
export const isFreeBendKind = (kind?: string): boolean =>
  kind === 'bezier' || kind === 'goblinEdge' || kind === 'straight';

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

/** The generator's own routing facts, kept ONLY for `drawnMid`'s "what the
 *  generator would have drawn" default. `dirAccessor` is the axis the SOURCE
 *  handle points along (index.mjs:1250), which is what the generator's
 *  `stepPosition` fraction slides along; `sg`/`tg` are the gapped endpoints. */
function splitInfo(geo: BendGeo) {
  const {sg, tg} = gapped(geo);
  const dirAccessor: 'x' | 'y' = geo.sp === 'left' || geo.sp === 'right' ? 'x' : 'y';
  return {sg, tg, dirAccessor};
}

/** The plain coordinate midpoint of the gapped endpoints — EXACTLY what the
 *  generator computes for `stepPosition: 0.5` (:1266 / :1272). This is the point
 *  an edge with nothing stored is drawn through, so it is also the coordinate
 *  `freePath` invents for an axis the user has not dragged yet — a drag on one
 *  axis must not move the other.
 *
 *  ROUND U: it is ALSO the auto-remove reference for the free kinds — the
 *  "geometric midpoint of the endpoints" is a kind-independent idea, so
 *  `App.onBend('end')` needs no branch. */
export function plainMidpoint(geo: BendGeo): Pt {
  const {sg, tg} = gapped(geo);
  return {x: (sg.x + tg.x) / 2, y: (sg.y + tg.y) / 2};
}

/** Is a midpoint handle offered on this geometry at all? Every OPPOSITE-side
 *  pair — the set of shapes where a waypoint reads as a bend of the line rather
 *  than as a second elbow on the same side. The drag itself is 2-D everywhere,
 *  so this is the ONLY condition left; the old axis model's collapsed-bar
 *  special-casing is gone with the axis model that needed it.
 *
 *  THIS GATE IS ABOUT THE ORTHOGONAL SPLIT, so it only applies to the kinds the
 *  split exists for (`step`/`smoothstep`). The free kinds (`bezier`/`straight`)
 *  never consult it: they have no split to collapse, so they are always
 *  draggable — see `GoblinEdge`'s `bendActive`.
 *
 *  NOTE this is the HANDLE's gate, not the renderer's: the renderer routes
 *  through our own path whenever a bend key is STORED (`needsCustom`), including
 *  a key an older board stored on a geometry that would not offer a handle
 *  today. */
export function bendDraggable4(geo: BendGeo): boolean {
  return OPPOSITE_SIDE[geo.sp] === geo.tp;
}

/** `bendDraggable4` as the renderer/reporting shape (a caller that wants the
 *  boolean directly uses `bendDraggable4`). */
export function bendGate(geo: BendGeo): {active: boolean} {
  return {active: bendDraggable4(geo)};
}

/** The drawn W for an edge: the stored coordinate per axis, the fraction
 *  `stepPosition` would have produced for an axis with nothing stored, and the
 *  generator's own midpoint otherwise.
 *
 *  TWO live readers, and they are the two that must agree:
 *   * the DRAG's base point — where the handle sits when the gesture starts;
 *   * an edge an older board stored a `bend` FRACTION on but never a point: that
 *     fraction still renders through the generator (`stepPosition`), so the drag
 *     must start from where the line is, not from the plain midpoint. */
export function drawnMid(geo: BendGeo, bendX?: number, bendY?: number, bend?: number): Pt {
  const {sg, tg, dirAccessor} = splitInfo(geo);
  const f = bend ?? 0.5;
  return {
    x: bendX ?? (dirAccessor === 'x' ? sg.x + (tg.x - sg.x) * f : (sg.x + tg.x) / 2),
    y: bendY ?? (dirAccessor === 'y' ? sg.y + (tg.y - sg.y) * f : (sg.y + tg.y) / 2),
  };
}

/** The bend keys an edge's data may carry. `bend` is READ-ONLY legacy: nothing
 *  writes it any more (the slider that owned it is gone), but an old board's
 *  fraction must keep rendering exactly as it did. */
export type BendData = {bend?: number; bendX?: number; bendY?: number};

/** The exact object a drag writes. Modelled here rather than inline in `onBend`
 *  so the harness exercises the real writer.
 *
 *  `'h'`/`'v'` write the owned key ONLY — a drag must never leak into the axis
 *  the pointer did not move along (the ROUND T projection).
 *  `'free'` (ROUND U, the free 2-D kinds) writes BOTH keys: on `bezier`/
 *  `straight` the pointer position IS the waypoint, on both axes, always. */
export function dragPatch(axis: BendAxis, W: Pt): {bendX?: number; bendY?: number} {
  if (axis === 'h') return {bendX: W.x};
  if (axis === 'v') return {bendY: W.y};
  return {bendX: W.x, bendY: W.y};
}

/** The point a drag writes: the pointer on the axis the gesture owns, the base
 *  point (`drawnMid`) on the axis it does not — and the raw pointer on BOTH axes
 *  for `'free'`.
 *
 *  ONE reader, shared by `App.onBend` and the harness, so the projection the app
 *  performs is the projection that is measured. `'h'`/`'v'` are bit-identical to
 *  the ROUND T inline expression. */
export function dragPoint(axis: BendAxis, W: Pt, base: Pt): Pt {
  if (axis === 'h') return {x: W.x, y: base.y};
  if (axis === 'v') return {x: base.x, y: W.y};
  return {x: W.x, y: W.y};
}

/** An edge's data after a drag: the owned key written, the OTHER axis's key
 *  PRESERVED, and the legacy fraction dropped.
 *
 *  Both coordinates are meaningful now — the custom routes read `W.x` AND `W.y`
 *  — so a drag must not clear the key it does not own: clearing it would snap
 *  the other axis back to the generator's default mid-drag. (ROUND S deleted it,
 *  and ROUND S was wrong to.)
 *
 *  `bend` goes because the slider that wrote it is gone and an absolute point
 *  supersedes it; `drawnMid` still honours a stored fraction for an old board,
 *  so this is the only place the key is ever removed besides a reconnect. */
export function applyDrag<T extends BendData>(data: T, axis: BendAxis, W: Pt): T {
  const out = {...data, ...dragPatch(axis, W)} as T;
  delete out.bend;
  return out;
}

/** draw.io's axis rule for the ORTHOGONAL kinds: the axis the POINTER is moving
 *  along wins, decided from the delta alone. `Math.abs(dx) >= Math.abs(dy)`
 *  makes a 45° drag horizontal and a mostly-vertical one vertical, which is what
 *  a user means by "I pulled it up".
 *
 *  The geometry is deliberately NOT consulted — that was the ROUND S bug. The
 *  parameter stays in the signature so every call site reads the same shape
 *  (geometry, delta) and a future rule can use it without a call-site churn.
 *
 *  ROUND U: this is NOT called for the free kinds. `bendAxisFor` below is the
 *  single decision point, and it returns `'free'` there — running `dragAxis` on a
 *  `bezier`/`straight` edge would project a free 2-D drag onto one axis, which is
 *  exactly the lie this round removes. */
export function dragAxis(_geo: BendGeo, dx: number, dy: number): BendAxis {
  return Math.abs(dx) >= Math.abs(dy) ? 'h' : 'v';
}

/** ROUND U — the axis a gesture owns, kind-aware and decided in ONE place:
 *  `'free'` on the free 2-D kinds (`bezier`/`straight`), otherwise draw.io's
 *  pointer rule. `App.onBend` (the writer) and `GoblinEdge` (the cursor) both
 *  call this, so the axis written and the axis advertised cannot disagree. */
export function bendAxisFor(kind: string | undefined, geo: BendGeo, dx: number, dy: number): BendAxis {
  return isFreeBendKind(kind) ? 'free' : dragAxis(geo, dx, dy);
}

/** ROUND T — the auto-remove threshold (px, FLOW units). `App.onBend('end')`
 *  deletes BOTH stored keys when the released waypoint is within this distance
 *  of `plainMidpoint` — the generator's own default point — so a user can put an
 *  edge back to a clean routed look instead of leaving a point that bends
 *  nothing. 10px is far below any deliberate bend and above pointer noise. */
export const BEND_SNAP_PX = 10;

/** `getBend` replicated from the installed generator (index.mjs:1363-1379)
 *  VERBATIM, so `freePath` rounds its corners exactly like every other edge on
 *  the board — including the collinear early return. */
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

/** A finite waypoint or the generator's own midpoint. The SAME guard in every
 *  route below (`freePath`, `straightPath`, `bezierPath`): a non-finite stored
 *  coordinate must never reach an `M`/`L`/`Q` command as `NaN`. */
const finiteMid = (geo: BendGeo, W: Pt): Pt =>
  Number.isFinite(W.x) && Number.isFinite(W.y) ? W : plainMidpoint(geo);

/** THE FREE ROUTE (orthogonal kinds) — an orthogonal staircase through the
 *  waypoint, using BOTH of `W.x` and `W.y`. This is what makes up/down AND
 *  left/right reachable on the same edge, which `getSmoothStepPath` can never do
 *  (one coordinate only, see the sweep at the top of this file).
 *
 *  Routed by the SOURCE handle's own axis, so the line leaves the handle in the
 *  direction the handle points:
 *    left / right (horizontal): s → sg → (W.x, sg.y) → (W.x, W.y) → (tg.x, W.y) → tg → t
 *    top / bottom (vertical)  : s → sg → (sg.x, W.y) → (W.x, W.y) → (W.x, tg.y) → tg → t
 *
 *  Consecutive duplicate points are dropped (so a waypoint that lands on an
 *  existing vertex, or on the gapped endpoint's own line, collapses cleanly),
 *  which is also what keeps the degenerate cases a VALID path rather than a
 *  `NaN`: every emitted point comes from `geo` or from a finite `W`. A
 *  non-finite `W` is replaced by the generator's own midpoint rather than
 *  written into an `M`/`L` command.
 *
 *  The label is `W` itself: `W` is a vertex of the staircase by construction
 *  (the only point that can drop out is one that coincides with a neighbour, and
 *  then it lies on the segment that replaced it), so the handle painted on the
 *  label stays on the line. With `borderRadius: 0` — what the app draws for a
 *  `step` edge — the corner is exact to the last bit. */
export function freePath(geo: BendGeo, W: Pt, borderRadius: number): [string, number, number] {
  const {sg, tg} = gapped(geo);
  const w = finiteMid(geo, W);
  const horizontal = geo.sp === 'left' || geo.sp === 'right';
  const raw: Pt[] = horizontal
    ? [geo.s, sg, {x: w.x, y: sg.y}, {x: w.x, y: w.y}, {x: tg.x, y: w.y}, tg, geo.t]
    : [geo.s, sg, {x: sg.x, y: w.y}, {x: w.x, y: w.y}, {x: w.x, y: tg.y}, tg, geo.t];
  const pts: Pt[] = [];
  for (const p of raw) {
    const last = pts[pts.length - 1];
    if (!last || last.x !== p.x || last.y !== p.y) pts.push(p);
  }
  let path = `M${pts[0].x} ${pts[0].y}`;
  for (let i = 1; i < pts.length - 1; i++) path += getBend(pts[i - 1], pts[i], pts[i + 1], borderRadius);
  path += `L${pts[pts.length - 1].x} ${pts[pts.length - 1].y}`;
  return [path, w.x, w.y];
}

/** ROUND U — THE STRAIGHT ROUTE: `M s L W L t`, the line bent AT the waypoint.
 *  draw.io's own model for a straight edge: the waypoint is a VERTEX, both
 *  coordinates move together (free 2-D), and the label — and therefore the
 *  handle — is the waypoint itself, so the handle sits exactly where the corner
 *  is. A non-finite `W` falls back to `plainMidpoint` (never `NaN`).
 *
 *  MEASURED (300 geometries, orchestrator): a horizontal delta moves the drawn
 *  line 299/300 and a vertical delta 300/300 — the 1/300 is a delta collinear
 *  with the segment, where the line is straight either way. */
export function straightPath(geo: BendGeo, W: Pt): [string, number, number] {
  const w = finiteMid(geo, W);
  const {s, t} = geo;
  return [`M ${s.x},${s.y} L ${w.x},${w.y} L ${t.x},${t.y}`, w.x, w.y];
}

/** ROUND U — THE BEZIER ROUTE: the quadratic through W.
 *
 *  A quadratic `M S Q C T` passes through its own midpoint control point
 *  `(S + 2C + T)/4`, so solving that for `C` gives `C = 2W − (S+T)/2` — and the
 *  curve then passes through the stored waypoint EXACTLY (measured: 0.0000px
 *  deviation on 300/300 geometries). The label is that same identity, returned as
 *  `w` ITSELF rather than re-evaluated from `c`: the two agree algebraically but
 *  NOT bit-for-bit in IEEE754 doubles (the two-step arithmetic drifts by ~1e-14
 *  px, e.g. 123.456 → 123.45599999999998), and the label is the handle's anchor,
 *  so it must BE the stored point, exactly. `getBezierPath`'s own label
 *  convention (the midpoint of the source/target line) is what this reduces to
 *  when `W` is the plain midpoint.
 *
 *  NOTE it is NOT React Flow's cubic bezier in general — parity can NOT come from
 *  matching its shape. It comes from "nothing stored → the generator", as
 *  everywhere else in this file: an untouched bezier edge calls
 *  `getBezierPath` verbatim.
 *
 *  A non-finite `W` falls back to `plainMidpoint` (never `NaN`). */
export function bezierPath(geo: BendGeo, W: Pt): [string, number, number] {
  const w = finiteMid(geo, W);
  const {s, t} = geo;
  const c = {x: 2 * w.x - (s.x + t.x) / 2, y: 2 * w.y - (s.y + t.y) / 2};
  return [`M ${s.x},${s.y} Q ${c.x},${c.y} ${t.x},${t.y}`, w.x, w.y];
}

/** Does this edge need OUR route rather than the generator's? A stored bend key
 *  and nothing else — an untouched board (and an old board that only carries the
 *  legacy `bend` fraction) stays on the generator, so nothing already on a
 *  canvas moves by a pixel. The geometry is not consulted: a stored waypoint is
 *  drawn by the kind's own route on ANY geometry, which is the only rule that
 *  keeps the path and the handle on the same point. */
export function needsCustom(_geo: BendGeo, bendX?: number, bendY?: number): boolean {
  return bendX !== undefined || bendY !== undefined;
}
