#!/usr/bin/env node
/**
 * ROUND S/T harness — the draw.io-style FREE 2-D midpoint drag.
 *
 * WHY A HARNESS AND NOT A BROWSER: this pass has no browser (the orchestrator
 * verifies live in its own). So every rule below is checked against the
 * INSTALLED generator — `@xyflow/system` — by RUNNING it, or by parsing the rule
 * out of its shipped source with the line number printed, never from memory.
 *
 * THE QUESTION THIS PASS EXISTS TO ANSWER: the midpoint dot could only move
 * LEFT/RIGHT. ROUND S picked the drag's axis from the split the generator
 * happens to use, and that split flips at 0.001px of stagger — so on every edge
 * that is not pixel-level the axis was `h` and up/down did nothing. The fix is
 * draw.io's model: NO stored waypoint → the generator unchanged; a stored
 * waypoint → OUR OWN orthogonal path (`freePath`) that reads BOTH coordinates.
 *
 * `renderLikeApp` is a faithful model of the branch `GoblinEdge` takes
 * (`needsCustom` → `freePath`, else the generator with `stepPosition`), so the
 * claims here are about the code that ships rather than about a parallel copy of
 * it. Node's own type-stripping loads `src/edgeBend.ts` directly.
 */
import {readFileSync, readdirSync} from 'node:fs';
import {getBezierPath, getSmoothStepPath, getStraightPath} from '@xyflow/system';
import {
  SIDE_OUT, OPPOSITE_SIDE, STEP_GAP_PX, BEND_SNAP_PX,
  applyDrag, bendAxisFor, dragAxis, dragPatch, dragPoint, drawnMid, freePath,
  isFreeBendKind, needsCustom, plainMidpoint, bezierPath, straightPath,
  bendDraggable4,
} from '../src/edgeBend.ts';

const ROOT = '/home/harvey/projects/tech-goblin/lab/diagram-studio';
const SYS_SRC = readFileSync(`${ROOT}/node_modules/@xyflow/system/dist/esm/index.mjs`, 'utf8');
const APP_SRC = readFileSync(`${ROOT}/src/App.tsx`, 'utf8');
const EDGE_SRC = readFileSync(`${ROOT}/src/GoblinEdge.tsx`, 'utf8');
const CSS_SRC = readFileSync(`${ROOT}/src/styles.css`, 'utf8');
const SYS_LINES = SYS_SRC.split('\n');

let failures = 0;
const ok = (cond, label, detail = '') => {
  if (!cond) failures++;
  console.log(`  ${cond ? 'PASS' : 'FAIL'}  ${label}${detail ? `  — ${detail}` : ''}`);
};
const head = t => console.log(`\n${t}`);
const lineOf = (src, needle) => {
  const i = src.split('\n').findIndex(l => l.includes(needle));
  return i < 0 ? null : i + 1;
};
const at = needle => `index.mjs:${lineOf(SYS_SRC, needle) ?? '??'}  ${needle}`;

/* ---------------------------------------------------------------- geometry */
const geo = (s, t, sp, tp) => ({s, t, sp, tp});
const SIDES = ['left', 'right', 'top', 'bottom'];
/** The M/L vertices, in order — the exact polyline of a path. */
function vertices(d) {
  const out = [];
  const re = /[ML]\s*(-?[\d.eE+]+)[ ,](-?[\d.eE+]+)/g;
  let m;
  while ((m = re.exec(d))) out.push([Number(m[1]), Number(m[2])]);
  return out;
}
/** Consecutive duplicates removed — "L130 0L130 0" draws the same line as
 *  "L130 0", and the generator emits such repeats. */
function dedup(pts) {
  const out = [];
  for (const p of pts) {
    const l = out[out.length - 1];
    if (!l || Math.abs(l[0] - p[0]) > 1e-9 || Math.abs(l[1] - p[1]) > 1e-9) out.push(p);
  }
  return out;
}
/** A vertex lying ON the segment between its neighbours adds no ink: `freePath`
 *  legitimately emits one where the waypoint sits on a run the generator draws
 *  as a single `L` (the waypoint is always a vertex by construction — see the
 *  module note). Removing those is a faithful polyline normalisation, and the
 *  number removed is reported so it can never hide a real difference. */
function reduceCollinear(pts) {
  const out = [];
  for (const p of pts) {
    out.push(p);
    while (out.length >= 3) {
      const a = out[out.length - 3], b = out[out.length - 2], c = out[out.length - 1];
      const cross = (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
      const between = (a[0] - b[0]) * (c[0] - b[0]) + (a[1] - b[1]) * (c[1] - b[1]) <= 0;
      if (Math.abs(cross) < 1e-9 && between) out.splice(out.length - 2, 1);
      else break;
    }
  }
  return out;
}
/** Max vertex deviation between two paths as POLYLINES, or Infinity when their
 *  vertex counts differ (a different shape). */
function samePolyline(a, b, reduce = false) {
  const A = reduce ? reduceCollinear(dedup(vertices(a))) : dedup(vertices(a));
  const B = reduce ? reduceCollinear(dedup(vertices(b))) : dedup(vertices(b));
  if (A.length !== B.length) return Infinity;
  let max = 0;
  for (let i = 0; i < A.length; i++) {
    max = Math.max(max, Math.abs(A[i][0] - B[i][0]), Math.abs(A[i][1] - B[i][1]));
  }
  return max;
}
const distToSeg = (p, a, b) => {
  const dx = b[0] - a[0], dy = b[1] - a[1];
  const L = dx * dx + dy * dy;
  let t = L ? ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / L : 0;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(p[0] - (a[0] + t * dx), p[1] - (a[1] + t * dy));
};
function distToPath(d, p) {
  const P = dedup(vertices(d));
  let best = Infinity;
  for (let i = 1; i < P.length; i++) best = Math.min(best, distToSeg(p, P[i - 1], P[i]));
  return best;
}
/** Symmetric maximum deviation between two paths as CURVES — every vertex of
 *  one measured against the other, both ways. Vertex-count-agnostic, so a
 *  half-pixel jog that lands one vertex earlier is reported as the sub-pixel
 *  distance it is instead of Infinity. */
function maxDev(a, b) {
  let worst = 0;
  for (const p of dedup(vertices(a))) worst = Math.max(worst, distToPath(b, p));
  for (const p of dedup(vertices(b))) worst = Math.max(worst, distToPath(a, p));
  return worst;
}
/** Today's rendering, verbatim: no centre and no stepPosition passed. */
const TODAY = (g, br) => getSmoothStepPath({
  sourceX: g.s.x, sourceY: g.s.y, sourcePosition: g.sp,
  targetX: g.t.x, targetY: g.t.y, targetPosition: g.tp, borderRadius: br,
})[0];
/** Today's rendering once an old board's stored `bend` fraction is passed. */
const TODAY_SLIDER = (g, br, stepPosition) => getSmoothStepPath({
  sourceX: g.s.x, sourceY: g.s.y, sourcePosition: g.sp,
  targetX: g.t.x, targetY: g.t.y, targetPosition: g.tp, borderRadius: br, stepPosition,
})[0];
/** The generator with an explicit centre — used only to MEASURE how much of the
 *  centre it actually reads. */
const centered = (g, W, br) => getSmoothStepPath({
  sourceX: g.s.x, sourceY: g.s.y, sourcePosition: g.sp,
  targetX: g.t.x, targetY: g.t.y, targetPosition: g.tp, borderRadius: br,
  centerX: W.x, centerY: W.y,
})[0];

/** THE BRANCH `GoblinEdge` TAKES, modelled exactly: a stored bend key →
 *  `freePath` (our own route, both coordinates); nothing stored → the generator
 *  with `stepPosition`, i.e. exactly the pre-ROUND-S path. */
function renderLikeApp(g, data, br) {
  if (needsCustom(g, data.bendX, data.bendY)) {
    return freePath(g, drawnMid(g, data.bendX, data.bendY, data.bend), br)[0];
  }
  return getSmoothStepPath({
    sourceX: g.s.x, sourceY: g.s.y, sourcePosition: g.sp,
    targetX: g.t.x, targetY: g.t.y, targetPosition: g.tp, borderRadius: br,
    stepPosition: data.bend,
  })[0];
}
const rndFrom = (seed0) => {
  let seed = seed0;
  return () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
};

/* ------------------------------------------------------------------ (0) SOURCE
   Every generator rule this file models, printed with its line, plus the two
   constants PARSE-checked (a dependency bump that changed them must fail here). */
head('(0) SOURCE — the rules this file models, with their line numbers');
console.log(`     read from ${ROOT}/node_modules/@xyflow/system/dist/esm/index.mjs`);
const sig = SYS_LINES.find(l => l.includes('function getSmoothStepPath({')) ?? '';
const offsetInSrc = /offset\s*=\s*(\d+(?:\.\d+)?)/.exec(sig);
const stepPosInSrc = /stepPosition\s*=\s*([\d.]+)/.exec(sig);
console.log(`     ${at('function getSmoothStepPath({')}  signature: offset=${offsetInSrc?.[1]}, stepPosition=${stepPosInSrc?.[1]}`);
ok(!!offsetInSrc && Number(offsetInSrc[1]) === STEP_GAP_PX, `STEP_GAP_PX === the installed offset default (${STEP_GAP_PX})`);
ok(!!stepPosInSrc && Number(stepPosInSrc[1]) === 0.5, 'the generator default stepPosition is 0.5 — the legacy fraction still renders as today');
for (const [side, d] of Object.entries(SIDE_OUT)) {
  const needle = `[Position.${side[0].toUpperCase() + side.slice(1)}]: { x: ${d.x}, y: ${d.y} }`;
  console.log(`     ${at(needle)}`);
  ok(lineOf(SYS_SRC, needle) !== null, `SIDE_OUT.${side} matches the installed handleDirections`, `{x:${d.x},y:${d.y}}`);
}
console.log(`     ${at('if (sourceDir[dirAccessor] * targetDir[dirAccessor] === -1)')}  the opposite-handle branch (the only place a centre is read)`);
console.log(`     ${at('centerX = center.x ?? sourceGapped.x')}  the split the generator READS — one coordinate only, measured below`);
console.log(`     ${at('return [pathPoints, centerX, centerY, defaultOffsetX, defaultOffsetY]')}  the label IS that centre`);
console.log(`     ${at('function getBend(a, b, c, size)')}  corner treatment replicated verbatim in freePath`);
console.log(`     ${at('centerX = (sourceGapPoint.x + targetGapPoint.x) / 2')}  the non-opposite branch OVERWRITES any centre`);
console.log('     OUR rules that ship, read from src/:');
for (const [f, needle] of [
  ['edgeBend.ts', 'export function freePath('],
  ['edgeBend.ts', 'export function straightPath('],
  ['edgeBend.ts', 'export function bezierPath('],
  ['edgeBend.ts', 'export function dragAxis('],
  ['edgeBend.ts', 'export function bendAxisFor('],
  ['edgeBend.ts', 'export function dragPoint('],
  ['edgeBend.ts', 'export function applyDrag<T extends BendData>('],
  ['edgeBend.ts', 'export function needsCustom('],
  ['edgeBend.ts', 'export const BEND_SNAP_PX'],
  ['GoblinEdge.tsx', 'const LOCK_PX'],
  ['GoblinEdge.tsx', 'if (!lockAxis.current) {'],
  ['GoblinEdge.tsx', 'lockAxis.current = bendAxisFor(kind, bGeo, dx, dy)'],
  /* ── RE-ANCHORED BY ROUND AK PASS 2 (Job A2). OLD claim: the FILE was
   *    `GoblinEdge.tsx`. The call was not DELETED, it MOVED: ROUND AK's AK-11
   *    factored the bend gesture's pointer machinery into the ONE shared hook
   *    that the label drag also uses, so one pointerdown can never start both
   *    gestures. `el.releasePointerCapture?.(ev.pointerId)` now lives in
   *    `src/useEdgeGesture.ts`, which is the file that OWNS the gesture. The
   *    assertion is unchanged in strength: it still fails if the release goes
   *    missing from whichever file owns the gesture. */
  ['useEdgeGesture.ts', 'el.releasePointerCapture?.(ev.pointerId)'],
  ['GoblinEdge.tsx', 'cursor: dragCursor'],
  ['GoblinEdge.tsx', 'if (custom) {'],
  ['GoblinEdge.tsx', '[path, labelX, labelY] = freePath(bGeo, W, 0)'],
  ['GoblinEdge.tsx', '[path, labelX, labelY] = straightPath(bGeo, W)'],
  ['GoblinEdge.tsx', '[path, labelX, labelY] = bezierPath(bGeo, W)'],
  ['App.tsx', "if (phase === 'start')"],
  ['App.tsx', 'const axis = bendAxisFor(e.type, geo, dx, dy)'],
  ['App.tsx', 'BEND_SNAP_PX'],
  ['App.tsx', 'delete out.bendX'],
]) {
  const src = readFileSync(`${ROOT}/src/${f}`, 'utf8');
  console.log(`     src/${f}:${lineOf(src, needle) ?? '??'}  ${needle}`);
  ok(lineOf(src, needle) !== null, `src/${f} carries \`${needle}\``);
}

/* --------------------------------------------------------------- (a) PARITY
   THE SPEC'S PARITY CLAIM, at its strongest form: an untouched board stores
   nothing, so the shipping branch must be BYTE-IDENTICAL to
   `getSmoothStepPath` — string equality, not a polyline comparison — because
   with no key the renderer calls the generator and nothing else.

   The second half is the MIDPOINT CONTROL, and it is the honest limit of this
   model: `freePath` puts the waypoint in as a CORNER, so at the generator's own
   midpoint it reproduces the generator's polyline exactly when that point is a
   collinear corner (the level pairs — Harvey's own edges) and otherwise routes a
   staircase of its own. A corner is what makes BOTH axes live on every geometry
   (section (b)); a waypoint that merely slides along the generator's split
   segment would be inert on one axis again, which is the defect being fixed.
   The count is REPORTED rather than asserted, and the level pairs are asserted
   by name. */
head('(a) PARITY — a board with no stored waypoint renders byte-identical');
{
  const rnd = rndFrom(1337);
  let n = 0, stringDiff = 0, first = '', stringDiffCase = '';
  let midExact = 0, midTotal = 0, levelExact = 0, levelTotal = 0;
  let extraVerts = 0;
  for (let i = 0; i < 240; i++) {
    const sp = SIDES[i % 4], tp = OPPOSITE_SIDE[sp];
    const mode = i % 5;
    const s = {x: Math.round(rnd() * 600 - 300), y: Math.round(rnd() * 600 - 300)};
    const t = {x: Math.round(rnd() * 600 - 300), y: Math.round(rnd() * 600 - 300)};
    const level = mode === 0;
    if (level) {
      // genuinely level ON THE DRAG AXIS for whichever axis the pair runs along
      if (sp === 'left' || sp === 'right') t.y = s.y; else t.x = s.x;
    }
    if (mode === 1 && (sp === 'left' || sp === 'right')) t.x = s.x - 180; // backwards
    if (mode === 2) { t.x = s.x; t.y = s.y; }                             // degenerate
    const g = geo(s, t, sp, tp);
    for (const br of [0, 12]) {
      // (a1) THE SHIPPING BRANCH, byte for byte
      const got = renderLikeApp(g, {}, br), want = getSmoothStepPath({
        sourceX: s.x, sourceY: s.y, sourcePosition: sp,
        targetX: t.x, targetY: t.y, targetPosition: tp, borderRadius: br,
        stepPosition: undefined,
      })[0];
      if (got !== want) { stringDiff++; if (!first) { first = got; stringDiffCase = `${sp}->${tp} br${br}`; } }
      // (a3) the midpoint control, as a curve
      const raw = freePath(g, plainMidpoint(g), br)[0];
      const verts = dedup(vertices(raw));
      extraVerts += verts.length - reduceCollinear(verts).length;
      const dev = maxDev(raw, TODAY(g, br));
      midTotal++;
      if (dev <= 0.01) midExact++;
      if (level) { levelTotal++; if (dev <= 0.01) levelExact++; }
      n++;
    }
  }
  console.log(`     ${n} geometries (all 4 opposite pairs × 2 border radii: level / staggered / backwards / degenerate)`);
  ok(n >= 200, 'sample size >= 200', `${n}`);
  ok(needsCustom(geo({x: 0, y: 0}, {x: 100, y: 40}, 'right', 'left'), undefined, undefined) === false,
    'nothing stored -> `needsCustom` is false, so the generator is used verbatim');
  ok(stringDiff === 0, 'no stored key -> the drawn path is BYTE-IDENTICAL to getSmoothStepPath',
    stringDiff ? `${stringDiff} differ, first ${stringDiffCase}: ${first}` : `${n}/${n}`);

  /* THE NAMED LEVEL CONTROLS — Harvey's own e1/e2 shapes. On these the generator's
     own midpoint IS a collinear corner, so freePath traces exactly the same line:
     the first drag on an untouched level edge cannot move the line sideways. */
  console.log('\n     named level controls (freePath at the plain midpoint vs the generator):');
  const ctrl = (label, g, tol = 0.01) => {
    const dev = maxDev(freePath(g, plainMidpoint(g), 0)[0], TODAY(g, 0));
    console.log(`       ${label}: ${dev.toFixed(4)}px  (tolerance ${tol}px)`);
    ok(dev <= tol, `${label} — within the split's own half-stagger of the generator's line`, `${dev.toFixed(4)}px`);
  };
  /* A pair level on the drag axis puts the generator's midpoint exactly on a
     vertex, so freePath is EXACT there (tol 0.01). A pair with a stagger `d` on
     the perpendicular axis has the split at the midpoint's offset d/2 from a
     vertex, so the corner-shaped waypoint jogs by exactly d/2 — the smallest
     price the model can pay, and the reason a sub-pixel stagger shows a
     quarter-pixel. The tolerance below is that bound, stated per case. */
  ctrl('A  level right->left 212px (his e1)', geo({x: 0, y: 0}, {x: 212, y: 0}, 'right', 'left'));
  ctrl('E  right->left, 0.5px stagger (his e2)', geo({x: 0, y: 0}, {x: 212, y: 0.5}, 'right', 'left'), 0.25);
  ctrl('E2 right->left, 3px stagger', geo({x: 0, y: 0}, {x: 212, y: 3}, 'right', 'left'), 1.5);
  ctrl('F  level bottom->top column', geo({x: 0, y: 240}, {x: 0, y: 0}, 'bottom', 'top'));
  ctrl('Fa level top->bottom column', geo({x: 0, y: 0}, {x: 0, y: 240}, 'top', 'bottom'));
  ctrl('G  level left->right', geo({x: 0, y: 0}, {x: 260, y: 0}, 'left', 'right'));
  console.log(`     across the whole sweep: ${midExact}/${midTotal} geometries are EXACT at the midpoint;`);
  console.log(`     of the ${levelTotal} level ones, ${levelExact} are. The staggered rest route this model's own staircase, and the`);
  console.log(`     level-on-one-axis / staggered-on-the-other class jogs by at most half its stagger (asserted by name above).`);
  console.log(`     A waypoint that is a real CORNER is what keeps both axes live on every geometry (see (b));`);
  console.log(`     ${extraVerts} vertex/vertices were removed as collinear in the comparisons above.`);
  ok(levelExact === levelTotal, 'every LEVEL pair is EXACT — the generator\'s own collapsed bar, and Harvey\'s edges', `${levelExact}/${levelTotal}`);
  ok(midExact >= midTotal * 0.2, 'and a substantial share of the staggered sweep is exact too', `${midExact}/${midTotal}`);
}

/* --------------------------------------------------- (a2) LEGACY `bend` KEY
   The fraction the deleted slider wrote must keep rendering byte-identically —
   the key is READ-ONLY legacy, never written. */
head('(a2) LEGACY FRACTION — an old board\'s stored `bend` renders unchanged');
{
  const rnd = rndFrom(808);
  let n = 0, diff = 0, moved = 0;
  for (let i = 0; i < 200; i++) {
    const sp = SIDES[i % 4], tp = OPPOSITE_SIDE[sp];
    const g = geo({x: rnd() * 400, y: rnd() * 400}, {x: rnd() * 400, y: rnd() * 400}, sp, tp);
    for (const f of [0.1, 0.35, 0.75]) {
      const want = TODAY_SLIDER(g, 12, f);
      if (renderLikeApp(g, {bend: f}, 12) !== want) diff++;
      if (samePolyline(want, TODAY_SLIDER(g, 12, 0.5)) > 0.5) moved++;
      n++;
    }
  }
  console.log(`     ${n} stored fractions across the 4 opposite pairs; ${moved} of them move the line on their geometry`);
  ok(diff === 0, 'a stored `bend` still renders through the generator byte-identically', `${n - diff}/${n}`);
  ok(needsCustom(geo({x: 0, y: 0}, {x: 100, y: 40}, 'right', 'left'), undefined, undefined) === false,
    'a fraction alone does NOT trigger freePath — it is not a waypoint');
}

/* ------------------------------------------------- (b) BOTH AXES REACHABLE
   THE CENTRAL ASSERTION OF THIS ROUND. With a stored 2-D waypoint, a delta on
   EITHER axis must move the line — 0 counterexamples. Before this fix the axis
   was read off the generator's split, so on any geometry with ≥0.001px of
   stagger up/down did nothing at all. */
head('(b) BOTH AXES REACHABLE — a stored waypoint bends up/down AND left/right');
{
  const rnd = rndFrom(99);
  let n = 0, ex = 0, ey = 0, firstX = null, firstY = null;
  for (let i = 0; i < 400; i++) {
    const sp = SIDES[i % 4], tp = OPPOSITE_SIDE[sp];
    const s = {x: Math.round(rnd() * 500), y: Math.round(rnd() * 500)};
    const t = {x: Math.round(rnd() * 500), y: Math.round(rnd() * 500)};
    if (i % 3 === 0) t.y = s.y;        // level (the generator's collapsed bar)
    if (i % 7 === 0) { t.x = s.x; t.y = s.y; }   // fully degenerate
    if (i % 11 === 0 && (sp === 'left' || sp === 'right')) t.x = s.x - 160; // backwards
    const g = geo(s, t, sp, tp);
    const pm = plainMidpoint(g);
    const W = {x: pm.x + 41, y: pm.y + 33};
    const dr = renderLikeApp(g, {bendX: W.x, bendY: W.y}, 0);
    const dxOnly = renderLikeApp(g, {bendX: W.x + 45, bendY: W.y}, 0);
    const dyOnly = renderLikeApp(g, {bendX: W.x, bendY: W.y + 45}, 0);
    if (samePolyline(dxOnly, dr) <= 0.5) { ex++; firstX ??= {sp, tp, g, W, dr, dxOnly}; }
    if (samePolyline(dyOnly, dr) <= 0.5) { ey++; firstY ??= {sp, tp, g, W, dr, dyOnly}; }
    n++;
  }
  console.log(`     ${n} opposite-side geometries with a stored 2-D waypoint, each nudged 45px on each axis`);
  ok(n >= 200, 'sample size >= 200', `${n}`);
  ok(ex === 0, '0 counterexamples: a HORIZONTAL delta moves the line', `${ex}/${n}${firstX ? ` first: ${JSON.stringify(firstX.g)}` : ''}`);
  ok(ey === 0, '0 counterexamples: a VERTICAL delta moves the line', `${ey}/${n}${firstY ? ` first: ${JSON.stringify(firstY.g)}` : ''}`);

  /* THE NAMED CONTROL — Harvey's live edge, 188px of vertical stagger on a
     right→left pair. On it the generator reads only `centerX`, so before this
     fix up/down was structurally impossible; after it, up/down works. */
  const e1 = geo({x: -176, y: 144}, {x: 870, y: 660}, 'right', 'left');
  const pm = plainMidpoint(e1);
  let gx = 0, gy = 0;
  for (const d of [60, -60, 120, -120, 300]) {
    gx = Math.max(gx, samePolyline(centered(e1, {x: pm.x + d, y: pm.y}, 0), centered(e1, pm, 0)));
    gy = Math.max(gy, samePolyline(centered(e1, {x: pm.x, y: pm.y + d}, 0), centered(e1, pm, 0)));
  }
  const W = {x: pm.x + 30, y: pm.y + 30};
  const freeMoveX = samePolyline(renderLikeApp(e1, {bendX: W.x + 45, bendY: W.y}, 0), renderLikeApp(e1, {bendX: W.x, bendY: W.y}, 0));
  const freeMoveY = samePolyline(renderLikeApp(e1, {bendX: W.x, bendY: W.y + 45}, 0), renderLikeApp(e1, {bendX: W.x, bendY: W.y}, 0));
  console.log(`\n     HARVEY'S e1 (right->left, 188px stagger): the GENERATOR moves ${gx.toFixed(1)}px for a centerX delta, ${gy.toFixed(1)}px for a centerY delta`);
  ok(gy <= 0.01, 'the generator reads ONE coordinate there — moving the other does nothing (the measured root cause)', `${gy}px`);
  ok(gx > 0.5, 'and the coordinate it DOES read does move the line (so the reading above is the right one)', `${gx}px`);
  ok(freeMoveY > 0.5, 'after the fix, up/down moves that same edge', `${freeMoveY}px`);
  ok(freeMoveX > 0.5, 'and left/right still does', `${freeMoveX}px`);
}

/* ------------------------------------------------------- (c) ONE AXIS PER DRAG
   One gesture owns ONE axis: a horizontal drag must not move the vertical
   placement and vice versa. The app writes the pointer on the owned axis and the
   draw.io base point on the other, so the drawn line stays square. */
head('(c) ONE AXIS PER DRAG — a horizontal drag does not move the line vertically');
{
  const rnd = rndFrom(4242);
  const xs = d => new Set(dedup(vertices(d)).map(p => Math.round(p[0] * 1e6) / 1e6));
  const ys = d => new Set(dedup(vertices(d)).map(p => Math.round(p[1] * 1e6) / 1e6));
  const subset = (a, b) => [...a].every(v => b.has(v));
  let n = 0, bad = [];
  for (let i = 0; i < 240; i++) {
    const sp = SIDES[i % 4], tp = OPPOSITE_SIDE[sp];
    const s = {x: Math.round(rnd() * 500), y: Math.round(rnd() * 500)};
    const t = {x: Math.round(rnd() * 500), y: Math.round(rnd() * 500)};
    if (i % 4 === 0) t.y = s.y;
    const g = geo(s, t, sp, tp);
    const base = plainMidpoint(g);
    // the app's own projection: `put` = pointer on the owned axis + base elsewhere
    const hDrag = (data => ({...data, ...dragPatch('h', {x: 190, y: base.y})}))({bendX: base.x, bendY: base.y});
    const vDrag = (data => ({...data, ...dragPatch('v', {x: base.x, y: 210})}))({bendX: base.x, bendY: base.y});
    const before = freePath(g, base, 0)[0];
    const afterH = freePath(g, drawnMid(g, hDrag.bendX, hDrag.bendY), 0)[0];
    const afterV = freePath(g, drawnMid(g, vDrag.bendX, vDrag.bendY), 0)[0];
    if (!subset(ys(afterH), ys(before))) bad.push({axis: 'h', sp, tp, g});
    if (!subset(xs(afterV), xs(before))) bad.push({axis: 'v', sp, tp, g});
    if (samePolyline(afterH, before, true) <= 0.5 && samePolyline(afterV, before, true) <= 0.5) {
      bad.push({axis: 'neither moved', sp, tp, g});
    }
    n++;
  }
  console.log(`     ${n} geometries dragged 100+px on each axis from the generator's own midpoint`);
  ok(bad.length === 0, 'the untouched axis keeps the SAME coordinate values (no diagonal drift)', bad.length ? JSON.stringify(bad[0]) : `${n}/${n}`);
}

/* -------------------------------------------------------------- (d) PRESERVE
   Both coordinates are meaningful now, so a drag must PRESERVE the other axis's
   stored key. (ROUND S deleted it; that is now wrong.) */
head('(d) PRESERVE — a drag keeps the other axis\'s stored key');
{
  let bad = [];
  for (const axis of ['h', 'v']) {
    const out = applyDrag({bendX: 111, bendY: 222, bend: 0.3, strokeKey: 'blue'}, axis, {x: 9, y: 8});
    const owned = axis === 'h' ? 'bendX' : 'bendY';
    const other = axis === 'h' ? 'bendY' : 'bendX';
    if (out[owned] !== (axis === 'h' ? 9 : 8)) bad.push({axis, owned: out[owned]});
    if (out[other] !== (axis === 'h' ? 222 : 111)) bad.push({axis, otherGone: out[other]});
    if (out.bend !== undefined) bad.push({axis, bendSurvived: out.bend});
    if (out.strokeKey !== 'blue') bad.push({axis, sibling: 'clobbered'});
    ok(applyDrag({}, axis, {x: 9, y: 8})[owned] === (axis === 'h' ? 9 : 8),
      `applyDrag('${axis}') writes exactly the owned key`, JSON.stringify(dragPatch(axis, {x: 9, y: 8})));
    ok(applyDrag({}, axis, {x: 9, y: 8})[other] === undefined,
      `applyDrag('${axis}') invents no key on the axis the pointer never moved`);
  }
  ok(bad.length === 0, 'a horizontal drag keeps `bendY`, a vertical drag keeps `bendX`, and `bend` is dropped',
    bad.length ? JSON.stringify(bad[0]) : 'both axes');
  console.log(`     BEND_SNAP_PX = ${BEND_SNAP_PX}px — the release threshold for the auto-remove below`);
}

/* ------------------------------------------------------------- (e) AUTO-REMOVE
   Released back on the generator's own point, the waypoint is DROPPED so the
   edge returns to a clean routed look. The same rule `App.onBend('end')` runs. */
head('(e) AUTO-REMOVE — releasing on the generator\'s own point drops the waypoint');
{
  const g = geo({x: 0, y: 0}, {x: 212, y: 188}, 'right', 'left');
  const pm = plainMidpoint(g);
  const near = (put) => Math.hypot(put.x - pm.x, put.y - pm.y) <= BEND_SNAP_PX;
  ok(near(pm) === true, 'exactly on the midpoint -> removed', '0px');
  ok(near({x: pm.x + 6, y: pm.y - 6}) === true, 'within the threshold -> removed', '8.5px');
  ok(near({x: pm.x + 40, y: pm.y}) === false, 'a deliberate bend -> kept', '40px');
  console.log('     src/App.tsx:' + (lineOf(APP_SRC, 'BEND_SNAP_PX') ?? '??') + '  the end-of-gesture check');
  ok(/phase === 'end'/.test(APP_SRC) && /plainMidpoint\(geo\)/.test(APP_SRC),
    'App.onBend implements it on the END phase (not per move)');
}

/* ------------------------------------------------------- (f) HANDLE ON THE LINE
   The handle is painted at the point `freePath` returns as its label, so the
   label must lie ON the drawn line. With `borderRadius: 0` — what the app draws
   for a `step` edge — that is exact; with 12 (a `smoothstep` edge) the corner is
   a quadratic arc and the label is its centre, exactly as the generator's own
   label sits off its arc. */
head('(f) HANDLE ON THE LINE — the label lies on the drawn path');
{
  const rnd = rndFrom(7);
  let n = 0, worst0 = 0, worst12 = 0, worstW = 0;
  for (let i = 0; i < 300; i++) {
    const sp = SIDES[i % 4], tp = OPPOSITE_SIDE[sp];
    const g = geo({x: rnd() * 500, y: rnd() * 500}, {x: rnd() * 500, y: rnd() * 500}, sp, tp);
    const pm = plainMidpoint(g);
    const W = {x: pm.x + Math.round(rnd() * 120 - 60), y: pm.y + Math.round(rnd() * 120 - 60)};
    for (const br of [0, 12]) {
      const [d, lx, ly] = freePath(g, W, br);
      const dev = distToPath(d, [lx, ly]);
      if (br === 0) worst0 = Math.max(worst0, dev); else worst12 = Math.max(worst12, dev);
      if (!Number.isFinite(dev)) console.log(`     !! non-finite deviation — ${sp}->${tp} br${br}`);
    }
    worstW = Math.max(worstW, Math.max(Math.abs(freePath(g, W, 0)[1] - W.x), Math.abs(freePath(g, W, 0)[2] - W.y)));
    n++;
  }
  console.log(`     ${n} stored-point geometries, both radii (step br0 / smoothstep br12)`);
  ok(n >= 100, 'sample size >= 100', `${n}`);
  ok(worst0 <= 0.01, 'at br0 (a `step` edge) the handle is EXACTLY on the line', `worst ${worst0}px`);
  ok(worst12 <= 12.01, 'at br12 the handle sits on the corner arc\'s centre, exactly as the generator\'s own label does', `worst ${worst12.toFixed(3)}px from the line (arc centre — same as the generator)`);
  ok(worstW <= 0.01, 'and the label IS the waypoint the pointer released on', `worst ${worstW}px`);
}

/* ------------------------------------------------------- (g) DEGENERATE SAFETY
   A waypoint that lands on an existing vertex, on both, or far outside the box
   must still produce a VALID path — never `NaN`, never an empty `d`. */
head('(g) DEGENERATE SAFETY — freePath never emits NaN or an empty path');
{
  let n = 0;
  const bad = [];
  const check = (g, W, tag) => {
    const [d, lx, ly] = freePath(g, W, 0);
    const P = reduceCollinear(dedup(vertices(d)));
    if (!d || !d.startsWith('M')) bad.push({tag, why: 'shape/did not start with M', d});
    else if (/NaN|Infinity|undefined|null/.test(d)) bad.push({tag, why: 'non-finite command', d});
    else if (P.length < 2) bad.push({tag, why: 'fewer than 2 distinct points', d});
    else if (!Number.isFinite(lx) || !Number.isFinite(ly)) bad.push({tag, why: 'non-finite label', lx, ly});
    else if (distToPath(d, [lx, ly]) > 0.01) bad.push({tag, why: 'label off the line', d, lx, ly});
    n++;
  };
  for (const sp of SIDES) for (const tp of SIDES) {
    for (const [dx, dy] of [[212, 0], [0, 212], [0, 0], [-150, 0], [260, 188]]) {
      const g = geo({x: 40, y: 40}, {x: 40 + dx, y: 40 + dy}, sp, tp);
      const pm = plainMidpoint(g);
      // W on sg.x / on sg.y / on both / far outside / NaN
      check(g, pm, 'pm');
      check(g, {x: pm.x, y: 9999}, 'W.y far outside');
      check(g, {x: 9999, y: pm.y}, 'W.x far outside');
      check(g, {x: -9999, y: -9999}, 'W both far outside');
      check(g, {x: 40, y: 40}, 'W on the source anchor');
      check(g, {x: 40 + dx, y: 40 + dy}, 'W on the target anchor');
      check(g, {x: dx === 0 ? pm.x : 40, y: dy === 0 ? pm.y : 40}, 'W on the source anchor axis');
      check(g, {x: NaN, y: pm.y}, 'W.x NaN');
      check(g, {x: pm.x, y: NaN}, 'W.y NaN');
    }
  }
  console.log(`     ${n} cases: every side pair × level / vertical / fully degenerate / backwards / stagger, W on both anchors, on each axis, far outside, and NaN`);
  ok(bad.length === 0, 'every emitted path is non-empty, NaN-free, starts with M, flattens to >= 2 distinct points, and keeps its label on the line',
    bad.length ? JSON.stringify(bad[0]) : `${n}/${n}`);
}

/* ------------------------------------------------------------------ (h) CLEAR
   A waypoint measured against the OLD endpoints is nonsense after a reconnect,
   so both keys must go. This reads the SHIPPED handler, not a model of it. */
head('(h) CLEAR — reconnect drops bendX and bendY');
{
  const i = lineOf(APP_SRC, 'const onReconnect = useCallback');
  console.log(`     src/App.tsx:${i}  the reconnect handler`);
  const body = APP_SRC.slice(APP_SRC.indexOf('const onReconnect = useCallback'), APP_SRC.indexOf('const onReconnect = useCallback') + 1400);
  ok(/reconnectEdge\(oldEdge/.test(body), 'it still routes through reconnectEdge (type, style, label survive)');
  for (const k of ['bend', 'bendX', 'bendY']) {
    ok(new RegExp(`delete data\\.${k}\\b`).test(body), `src/App.tsx deletes \`${k}\` on reconnect`);
  }
  ok(/edgesReconnectable=\{!readOnly\}/.test(APP_SRC), '`edgesReconnectable` is still driven by `!readOnly` (the CAPABILITY is untouched)');
  ok(!!/RECONNECT_RADIUS/.exec(APP_SRC), '`RECONNECT_RADIUS` survives — the silent hit area is unchanged');
}

/* ----------------------------------------------------------------- (i) NO SLIDER
   The bend-position control is GONE: not disabled, REMOVED. Comments are
   stripped first — prose about what was deleted is not a control, and the
   classes themselves must appear NOWHERE live. */
head('(i) NO SLIDER — the bend-position control is gone from the sources');
{
  const stripJs = s => s.split('\n').filter(l => !/^\s*(\/\/|\*|\/\*)/.test(l)).join('\n');
  const stripCss = s => s.replace(/\/\*[\s\S]*?\*\//g, '');
  const files = readdirSync(`${ROOT}/src`).filter(f => /\.(tsx?|css)$/.test(f));
  let rangeRow = 0, rangeInput = 0, bendLabel = 0, fieldNote = 0;
  const where = [];
  for (const f of files) {
    const raw = readFileSync(`${ROOT}/src/${f}`, 'utf8');
    const s = /\.css$/.test(f) ? stripCss(raw) : stripJs(raw);
    const c = re => (s.match(re) ?? []).length;
    const a = c(/range-row/g), b = c(/type\s*=\s*"range"/g), d = c(/bend position/g), e = c(/field-note/g);
    if (a || b || d || e) where.push(`${f}: range-row=${a} range=${b} label=${d} field-note=${e}`);
    rangeRow += a; rangeInput += b; bendLabel += d; fieldNote += e;
  }
  console.log(`     scanned ${files.length} files under src/ (comments stripped)`);
  ok(rangeRow === 0, '0 `.range-row` occurrences in live source', where.join('; ') || '0');
  ok(rangeInput === 0, '0 `type="range"` in live source — the app has no range input', '0');
  ok(bendLabel === 0, '0 `bend position` labels in live source', '0');
  ok(fieldNote === 0, '0 `.field-note` occurrences in live source', '0');
  ok(!/bendSupport|bendAxis\(|bendActive4|axisLive|collapsed4/.test(stripJs(APP_SRC) + stripJs(EDGE_SRC)),
    'no live occurrence of a deleted rule survives (bendSupport / bendAxis / bendActive4 / axisLive / collapsed4)');
  ok(/\bstepPosition\b/.test(EDGE_SRC) && /bend\?: number/.test(EDGE_SRC),
    'the legacy fraction is still READ (so an old board renders unchanged)');
}

/* ------------------------------------------------- (j) NO PAINTED GRABBER (ask 3)
   React Flow's `react-flow__edgeupdater` circle is the "hình tròn to". Its PAINT
   must be gone: `fill`/`stroke` none, invisible, and no rule may reveal it.
   Comments are stripped so the assertion is about DECLARATIONS. */
head('(j) NO PAINTED GRABBER — the endpoint circle paints nothing, ever');
{
  const css = CSS_SRC.replace(/\/\*[\s\S]*?\*\//g, '');
  const blocks = [];
  let i = -1;
  while ((i = css.indexOf('react-flow__edgeupdater', i + 1)) >= 0) {
    const open = css.indexOf('{', i);
    const close = css.indexOf('}', open);
    if (open < 0 || close < 0) continue;
    const selStart = css.lastIndexOf('}', i) + 1;
    const sel = css.slice(selStart, open).trim();
    if (!sel) continue;
    const line = css.slice(0, i).split('\n').length;
    blocks.push({line, sel: sel.replace(/\s+/g, ' '), decls: css.slice(open + 1, close).replace(/\s+/g, ' ').trim()});
  }
  console.log(`     ${blocks.length} rule(s) in src/styles.css declare on the circle:`);
  for (const b of blocks) console.log(`       src/styles.css:~${b.line}  ${b.sel}  {${b.decls}}`);
  ok(blocks.length >= 1, 'we still address the circle (so a stray RF default cannot re-point it)');
  const all = blocks.map(b => b.decls).join('\n');
  const paint = [...all.matchAll(/(?:^|[;{\s])(fill|stroke)\s*:\s*([^;}\n]+)/g)].map(m => m[2].trim());
  ok(paint.length >= 2, 'both `fill` and `stroke` are declared', paint.join(', '));
  ok(paint.every(v => v === 'none'), 'and BOTH are `none` — nothing is painted', paint.join(', '));
  ok(!/var\(--/.test(paint.join(' ')), 'no themed colour reaches the circle any more', paint.join(', '));
  const ops = [...all.matchAll(/(?:^|[;{\s])opacity\s*:\s*([^;}\n]+)/g)].map(m => m[1].trim());
  ok(ops.length >= 1 && ops.every(v => v === '0'), 'invisible unconditionally (`opacity: 0`)', ops.join(', '));
  ok(!/transition/.test(all), 'no transition is left (there is no reveal to animate)');
  ok(!/pointer-events/.test(all), 'our rules override neither pointer-events nor cursor — the silent hit area is untouched');
  /* EVERY rule whose selector mentions the circle, scanned for a non-zero
     opacity. (A lookahead regex on the raw sheet backtracks and matches a space
     — the declaration walk below is the honest check.) */
  const stray = [];
  {
    const ruleRe = /([^{}]+)\{([^{}]*)\}/g;
    let m;
    while ((m = ruleRe.exec(css))) {
      const sel = m[1].trim();
      if (!/react-flow__edgeupdater/.test(sel)) continue;
      for (const d of m[2].matchAll(/opacity\s*:\s*([^;}\n]+)/g)) {
        if (d[1].trim() !== '0') stray.push({sel: sel.replace(/\s+/g, ' '), opacity: d[1].trim()});
      }
    }
  }
  ok(stray.length === 0, 'no rule anywhere gives the circle a non-zero opacity', stray.length ? JSON.stringify(stray[0]) : 'every opacity is 0');
  ok(!/react-flow__edgeupdater:hover/.test(css), 'no `:hover` reveal rule survives');
  ok(!/react-flow__edge\.(updating|:hover)[^{}]*edgeupdater/.test(css), 'no edge-state reveal rule survives either');
}

/* ================================================================== ROUND U
   THE SAME AFFORDANCE ON EVERY EDGE KIND. `bezier` and `straight` are the FREE
   2-D kinds — draw.io's own rule (E1-drawio-waypoints.md:1222-1225) is one axis
   per drag for `step`/`smoothstep` and FREE 2-D for `straight`/bezier — so there
   is no axis lock to apply on the latter, on either axis, ever.

   `renderKind` is a faithful model of the branch `GoblinEdge` now takes for ALL
   FOUR kinds (`custom` → the kind's own path, else that kind's generator
   verbatim), and `appDrag` is the app's OWN chain (`bendAxisFor` → `dragPoint` →
   `applyDrag`), so every claim below is about the shipped code rather than a
   parallel copy of it. */

/** THE BRANCH `GoblinEdge` TAKES, per kind: a stored bend key routes through the
 *  KIND's own path (each reads `W` on BOTH axes); nothing stored calls that
 *  kind's generator with the arguments it always got. `stepPosition` is passed
 *  through only for the orthogonal kinds, exactly as the component does. */
function renderKind(kind, g, data = {}) {
  const custom = needsCustom(g, data.bendX, data.bendY);
  const W = drawnMid(g, data.bendX, data.bendY, data.bend);
  const opts = {
    sourceX: g.s.x, sourceY: g.s.y, sourcePosition: g.sp,
    targetX: g.t.x, targetY: g.t.y, targetPosition: g.tp,
  };
  if (kind === 'straight') return custom ? straightPath(g, W)[0] : getStraightPath(opts)[0];
  if (kind === 'step') {
    return custom ? freePath(g, W, 0)[0]
      : getSmoothStepPath({...opts, borderRadius: 0, stepPosition: data.bend})[0];
  }
  if (kind === 'smoothstep') {
    return custom ? freePath(g, W, 12)[0]
      : getSmoothStepPath({...opts, borderRadius: 12, stepPosition: data.bend})[0];
  }
  // bezier / goblinEdge / custom — the free curved kind.
  return custom ? bezierPath(g, W)[0] : getBezierPath(opts)[0];
}

/** The app's own drag chain, verbatim: the kind-aware axis, the projection
 *  (`dragPoint`) and the writer (`applyDrag`). */
function appDrag(kind, g, pointer, base, data = {}) {
  const dx = pointer.x - base.x, dy = pointer.y - base.y;
  const axis = bendAxisFor(kind, g, dx, dy);
  const put = dragPoint(axis, pointer, base);
  return {axis, put, data: applyDrag(data, axis, put)};
}

/** THE DRAWN INK of a path: every M/L vertex, and every Q curve sampled at 64
 *  points. `vertices()` only sees M/L, and a quadratic's shape lives in its
 *  `Q` command — so a claim about "the curve passes through W" has to be
 *  measured on the sampled geometry, not on the control points. */
function curvePoints(d) {
  const toks = d.match(/[MLQ]|-?\d*\.?\d+(?:e[+-]?\d+)?/gi) ?? [];
  const out = [];
  let cur = [0, 0], i = 0;
  while (i < toks.length) {
    const c = toks[i++].toUpperCase();
    if (c === 'M' || c === 'L') {
      cur = [Number(toks[i++]), Number(toks[i++])];
      out.push(cur.slice());
    } else if (c === 'Q') {
      const cx = Number(toks[i++]), cy = Number(toks[i++]);
      const tx = Number(toks[i++]), ty = Number(toks[i++]);
      for (let s = 1; s <= 64; s++) {
        const u = s / 64, v = 1 - u;
        out.push([v * v * cur[0] + 2 * v * u * cx + u * u * tx, v * v * cur[1] + 2 * v * u * cy + u * u * ty]);
      }
      cur = [tx, ty];
    }
  }
  return out;
}
const distToCurve = (d, p) => {
  const P = curvePoints(d);
  let best = Infinity;
  for (let i = 1; i < P.length; i++) best = Math.min(best, distToSeg(p, P[i - 1], P[i]));
  return best;
};
/** Symmetric max deviation between two paths as SAMPLED CURVES (Q included). */
function curveDev(a, b) {
  const A = curvePoints(a), B = curvePoints(b);
  let worst = 0;
  for (const p of A) worst = Math.max(worst, distToCurve(b, p));
  for (const p of B) worst = Math.max(worst, distToCurve(a, p));
  return worst;
}

/* ------------------------------------------------------- (k) BEZIER THROUGH
   The quadratic `M S Q C T` with `C = 2W − (S+T)/2` passes through W EXACTLY:
   its own midpoint is `(S + 2C + T)/4`, which is the label this route returns.
   Measured on the SAMPLED curve, and the label is asserted to BE W (not merely
   close to it). */
head('(k) BEZIER THROUGH THE POINT — the drawn quadratic passes through the stored W');
{
  const rnd = rndFrom(20250918);
  let n = 0, worstCurve = 0, worstLabel = 0, nan = 0, firstBad = null;
  for (let i = 0; i < 240; i++) {
    const sp = SIDES[i % 4], tp = SIDES[(i + 1 + (i % 3)) % 4];
    const s = {x: Math.round(rnd() * 600 - 300), y: Math.round(rnd() * 600 - 300)};
    const t = {x: Math.round(rnd() * 600 - 300), y: Math.round(rnd() * 600 - 300)};
    if (i % 5 === 0) t.y = s.y;
    if (i % 7 === 0) { t.x = s.x; t.y = s.y; }
    const g = geo(s, t, sp, tp);
    const pm = plainMidpoint(g);
    const W = {x: pm.x + Math.round(rnd() * 200 - 100), y: pm.y + Math.round(rnd() * 200 - 100)};
    const [d, lx, ly] = bezierPath(g, W);
    const dev = distToCurve(d, [W.x, W.y]);
    if (!Number.isFinite(dev) || /NaN|Infinity/.test(d)) nan++;
    if (dev > worstCurve) { worstCurve = dev; firstBad ??= {sp, tp, W, d}; }
    worstLabel = Math.max(worstLabel, Math.abs(lx - W.x), Math.abs(ly - W.y));
    n++;
  }
  console.log(`     ${n} geometries (all side pairs, level / degenerate / staggered), W up to 100px off the midpoint`);
  ok(n >= 200, 'sample size >= 200', `${n}`);
  ok(nan === 0, 'no NaN / Infinity in the emitted path', `${nan} bad`);
  ok(worstCurve <= 0.01, 'the drawn quadratic passes through W', `worst ${worstCurve}px`);
  ok(worstLabel <= 0.01, 'and the returned label IS W', `worst ${worstLabel}px`);
  // the analytic identity, asserted directly on a case with awkward numbers
  const g0 = geo({x: -176, y: 144}, {x: 870, y: 660}, 'right', 'left');
  const W0 = {x: 123.456, y: -78.9};
  const [, bx, by] = bezierPath(g0, W0);
  ok(bx === W0.x && by === W0.y, 'label === W to the last bit (the quadratic midpoint identity)', `(${bx}, ${by})`);
  const nanCase = bezierPath(g0, {x: NaN, y: 5});
  ok(!/NaN|Infinity/.test(nanCase[0]) && Number.isFinite(nanCase[1]) && Number.isFinite(nanCase[2]),
    'a non-finite W falls back to plainMidpoint (never NaN)',
    `label (${nanCase[1]}, ${nanCase[2]})`);
}

/* ------------------------------------------------------ (l) STRAIGHT THROUGH
   The corner path `M S L W L T`: W is a VERTEX, so the line is bent AT the
   waypoint, the label is W, and both coordinates of the drag are written. */
head('(l) STRAIGHT THROUGH THE POINT — the corner path honours W on both axes');
{
  const rnd = rndFrom(424242);
  let n = 0, worst = 0, worstLabel = 0, notVertex = 0;
  for (let i = 0; i < 240; i++) {
    const sp = SIDES[i % 4], tp = SIDES[(i + 2 + (i % 3)) % 4];
    const s = {x: Math.round(rnd() * 600 - 300), y: Math.round(rnd() * 600 - 300)};
    const t = {x: Math.round(rnd() * 600 - 300), y: Math.round(rnd() * 600 - 300)};
    if (i % 5 === 0) t.y = s.y;
    const g = geo(s, t, sp, tp);
    const pm = plainMidpoint(g);
    const W = {x: pm.x + Math.round(rnd() * 200 - 100), y: pm.y + Math.round(rnd() * 200 - 100)};
    const [d, lx, ly] = straightPath(g, W);
    const dev = distToCurve(d, [W.x, W.y]);
    const verts = dedup(vertices(d));
    // W must be an actual VERTEX of the polyline (not merely on it)
    if (!verts.some(p => Math.abs(p[0] - W.x) < 1e-9 && Math.abs(p[1] - W.y) < 1e-9)) notVertex++;
    worst = Math.max(worst, dev);
    worstLabel = Math.max(worstLabel, Math.abs(lx - W.x), Math.abs(ly - W.y));
    n++;
  }
  console.log(`     ${n} geometries (all side pairs, level / staggered), W up to 100px off the midpoint`);
  ok(n >= 200, 'sample size >= 200', `${n}`);
  ok(worst <= 0.01, 'the drawn corner path passes through W', `worst ${worst}px`);
  ok(notVertex === 0, 'and W is a real VERTEX of the polyline (the line is bent AT the waypoint)', `${notVertex} not a vertex`);
  ok(worstLabel <= 0.01, 'the returned label IS W', `worst ${worstLabel}px`);
  const nanCase = straightPath(geo({x: 0, y: 0}, {x: 100, y: 0}, 'right', 'left'), {x: 5, y: Infinity});
  ok(!/NaN|Infinity/.test(nanCase[0]), 'a non-finite W falls back to plainMidpoint (never NaN)');
  // a `'free'` drag writes BOTH keys
  const free = applyDrag({}, 'free', {x: 31.5, y: -12.25});
  ok(free.bendX === 31.5 && free.bendY === -12.25, 'a `\'free\'` drag writes BOTH `bendX` and `bendY`', JSON.stringify(free));
  const kept = applyDrag({bendX: 1, bendY: 2, bend: 0.3, strokeKey: 'blue'}, 'free', {x: 7, y: 8});
  ok(kept.bendX === 7 && kept.bendY === 8 && kept.bend === undefined && kept.strokeKey === 'blue',
    'and it overwrites both coordinates while dropping only the legacy fraction', JSON.stringify(kept));
  const put = dragPoint('free', {x: 9, y: 10}, {x: 999, y: 999});
  ok(put.x === 9 && put.y === 10, '`dragPoint(\'free\')` is the raw pointer — the base point is NOT projected in', JSON.stringify(put));
}

/* ---------------------------------------------------- (m) FREE 2-D ON THE NEW
   THE CENTRAL ASSERTION OF ROUND U. On `bezier`/`straight` the axis is `'free'`
   on EVERY delta (a horizontal one, a vertical one, a 45° one), the pointer is
   written on BOTH coordinates with no projection, and the drawn route passes
   THROUGH the pointer on both axes. Contrasted with `step`, where one axis is
   still held at the base point.

   THE ONE HONEST EXCEPTION, and it is geometric rather than a lock: a delta
   COLLINEAR with the segment moves the waypoint ALONG the line, where the drawn
   line is correctly unchanged (the orchestrator measured the same thing as its
   1/300). Those deltas are classified and reported separately — the "the line
   moved" assertion is made only on the non-collinear ones. */
head('(m) FREE 2-D ON THE NEW KINDS — no axis lock on bezier/straight, and step is unchanged');
{
  /** Perpendicular distance from `p` to the INFINITE line a→b. A drag whose
   *  perpendicular offset is ~0 barely changes the line whatever the route. */
  const linePerp = (p, a, b) => {
    const dx = b[0] - a[0], dy = b[1] - a[1];
    const L = Math.hypot(dx, dy);
    return L ? Math.abs((p[0] - a[0]) * dy - (p[1] - a[1]) * dx) / L : 0;
  };
  const rnd = rndFrom(555);
  const FREE_KINDS = ['bezier', 'straight', 'goblinEdge'];
  let axes = 0, notFree = 0, notMoved = 0, collinear = 0, offPointer = 0;
  let badFree = null;
  let stepAxes = 0, stepFree = 0, stepBoth = 0, notHeld = 0;
  let badStep = null;
  for (let i = 0; i < 240; i++) {
    const sp = SIDES[i % 4], tp = OPPOSITE_SIDE[sp];
    const s = {x: Math.round(rnd() * 500), y: Math.round(rnd() * 500)};
    const t = {x: Math.round(rnd() * 500), y: Math.round(rnd() * 500)};
    if (i % 4 === 0) t.y = s.y;                       // LEVEL — the axis-lock trap
    if (i % 9 === 0 && (sp === 'left' || sp === 'right')) t.x = s.x - 180;
    const g = geo(s, t, sp, tp);
    const base = drawnMid(g);
    for (const kind of FREE_KINDS) {
      for (const [dx, dy] of [[60, 7], [7, 60], [40, 40], [-60, -7], [-7, -60]]) {
        const pointer = {x: base.x + dx, y: base.y + dy};
        const {axis, data} = appDrag(kind, g, pointer, base);
        axes++;
        if (axis !== 'free') { notFree++; badFree ??= {kind, sp, tp, dx, dy, axis}; }
        // BOTH keys written from the pointer: this is what "no projection" means
        if (data.bendX !== pointer.x || data.bendY !== pointer.y) { offPointer++; badFree ??= {kind, data, pointer}; }
        const before = kind === 'straight' ? straightPath(g, base)[0] : bezierPath(g, base)[0];
        const after = kind === 'straight' ? straightPath(g, pointer)[0] : bezierPath(g, pointer)[0];
        // THE POINTER IS HONOURED ON BOTH AXES, measured on the drawn route: the
        // straight corner has W as a vertex, the bezier passes through it at u=½.
        // This is the claim an axis lock would break — and it holds on EVERY
        // delta, collinear ones included.
        if (!(distToCurve(after, [pointer.x, pointer.y]) <= 0.01)) { offPointer++; badFree ??= {kind, sp, tp, dx, dy, after}; }
        // ...and for a delta that actually leaves the line, the drawn line moves.
        if (linePerp([pointer.x, pointer.y], [s.x, s.y], [t.x, t.y]) <= 1) collinear++;
        else if (!(curveDev(after, before) > 0.5)) { notMoved++; badFree ??= {kind, sp, tp, dx, dy, pointer, base}; }
      }
    }
    // CONTRAST: `step` keeps draw.io's one-axis rule — a REAL axis, never 'free'
    for (const [dx, dy] of [[60, 7], [7, 60]]) {
      const pointer = {x: base.x + dx, y: base.y + dy};
      const {axis, put, data} = appDrag('step', g, pointer, base);
      stepAxes++;
      if (axis === 'free') { stepFree++; badStep ??= {axis}; }
      // exactly ONE key is written, and the un-owned axis is HELD at the base
      const keys = Object.keys(data).sort().join(',');
      if (keys !== 'bendX' && keys !== 'bendY') { stepBoth++; badStep ??= {keys}; }
      const wantX = axis === 'h' ? pointer.x : base.x;
      const wantY = axis === 'h' ? base.y : pointer.y;
      if (put.x === wantX && put.y === wantY) { /* held */ } else { notHeld++; badStep ??= {axis, put, wantX, wantY}; }
    }
  }
  console.log(`     ${axes} free-kind drags across 240 geometries × 3 free kinds × 5 deltas (60/7, 7/60, 40/40 and both negated)`);
  console.log(`     ${collinear} of them were effectively COLLINEAR with their segment (perpendicular offset <= 1px) — reported, not asserted on`);
  ok(axes >= 200, 'sample size >= 200', `${axes}`);
  ok(notFree === 0, 'the axis is `\'free\'` on EVERY bezier/straight delta — no axis lock, no projection', notFree ? JSON.stringify(badFree) : `${axes}/${axes}`);
  ok(offPointer === 0, 'and the drawn route passes THROUGH the pointer on both axes on every one of them (no cross-axis component discarded)', offPointer ? JSON.stringify(badFree) : `${axes}/${axes}`);
  ok(notMoved === 0, 'and a delta that leaves the line moves it — 0 counterexamples', notMoved ? JSON.stringify(badFree) : `${axes - collinear}/${axes - collinear}`);
  console.log(`\n     CONTRAST — the same deltas on a \`step\` edge (${stepAxes} drags):`);
  ok(stepFree === 0, '`step` never reports `\'free\'` — the KIND rule did not leak into it', `${stepAxes - stepFree}/${stepAxes}`);
  ok(stepBoth === 0, 'and it still writes exactly ONE key (the owned axis)', `${stepAxes - stepBoth}/${stepAxes}`);
  ok(notHeld === 0, 'the un-owned coordinate is held at the base point — one axis per drag, unchanged', notHeld ? JSON.stringify(badStep) : `${stepAxes}/${stepAxes}`);
  // the named control: a level step edge keeps its y, a level straight edge does not
  const level = geo({x: 0, y: 0}, {x: 212, y: 0}, 'right', 'left');
  const lb = drawnMid(level);
  const sH = appDrag('step', level, {x: lb.x + 60, y: lb.y + 7}, lb);
  const fH = appDrag('straight', level, {x: lb.x + 60, y: lb.y + 7}, lb);
  console.log(`     level right->left 212px, pointer at (+60, +7) from the midpoint:`);
  console.log(`       step     -> axis '${sH.axis}', stored point ${JSON.stringify(sH.put)}  (y held at the base)`);
  console.log(`       straight -> axis '${fH.axis}', stored point ${JSON.stringify(fH.put)}  (the pointer itself)`);
  ok(sH.put.y === lb.y && sH.axis === 'h', '`step` holds the un-owned axis (no diagonal drift)');
  ok(fH.put.y !== lb.y && fH.axis === 'free', '`straight` follows the pointer on both axes (free 2-D)');
  ok(distToCurve(straightPath(level, {x: 0, y: 60})[0], [0, 60]) <= 0.01 && distToCurve(bezierPath(level, {x: 0, y: 60})[0], [0, 60]) <= 0.01,
    'both free routes pass through their waypoint (the handle is ON the line on either kind)',
    `straight ${distToCurve(straightPath(level, {x: 0, y: 60})[0], [0, 60]).toFixed(4)}px, bezier ${distToCurve(bezierPath(level, {x: 0, y: 60})[0], [0, 60]).toFixed(4)}px`);
}

/* ------------------------------------------------------------- (n) PARITY
   NOTHING STORED → STILL THE GENERATOR, byte for byte, on the two kinds that
   gained the handle. This is where the bezier route's parity comes from: it can
   NOT come from matching React Flow's cubic, so it comes from never being
   called on an untouched board. */
head('(n) PARITY UNCHANGED — no stored key still renders byte-identical to the generator');
{
  const rnd = rndFrom(31);
  let n = 0, bz = 0, st = 0, ge = 0, firstBz = '', firstSt = '';
  for (let i = 0; i < 240; i++) {
    const sp = SIDES[i % 4], tp = OPPOSITE_SIDE[sp];
    const s = {x: Math.round(rnd() * 600 - 300), y: Math.round(rnd() * 600 - 300)};
    const t = {x: Math.round(rnd() * 600 - 300), y: Math.round(rnd() * 600 - 300)};
    if (i % 6 === 0) { t.x = s.x; t.y = s.y; }
    const g = geo(s, t, sp, tp);
    const opts = {
      sourceX: s.x, sourceY: s.y, sourcePosition: sp,
      targetX: t.x, targetY: t.y, targetPosition: tp,
    };
    const b = renderKind('bezier', g, {});
    const w1 = getBezierPath(opts)[0];
    if (b !== w1) { bz++; if (!firstBz) firstBz = `${sp}->${tp}: ${b} vs ${w1}`; }
    const c = renderKind('goblinEdge', g, {});
    if (c !== w1) ge++;
    const st2 = renderKind('straight', g, {});
    const w2 = getStraightPath(opts)[0];
    if (st2 !== w2) { st++; if (!firstSt) firstSt = `${sp}->${tp}: ${st2} vs ${w2}`; }
    n++;
  }
  console.log(`     ${n} geometries × {bezier, goblinEdge, straight}, no bend key stored`);
  ok(n >= 200, 'sample size >= 200', `${n}`);
  ok(bz === 0, '`bezier` with nothing stored === getBezierPath (string equality)', bz ? `${bz} differ, first ${firstBz}` : `${n}/${n}`);
  ok(ge === 0, '`goblinEdge` (the `custom` alias) likewise === getBezierPath', ge ? `${ge} differ` : `${n}/${n}`);
  ok(st === 0, '`straight` with nothing stored === getStraightPath (string equality)', st ? `${st} differ, first ${firstSt}` : `${n}/${n}`);
  ok(/[MQ]/.test(getBezierPath({sourceX: 0, sourceY: 0, sourcePosition: 'right', targetX: 100, targetY: 60, targetPosition: 'left'})[0]),
    'sanity: the generator\'s bezier is a real curve (so the equality above is not two empty strings)');
}

/* ------------------------------------------------------- (o) KIND SWITCH
   Switching an edge's type must not orphan a stored waypoint: every kind's own
   route reads the same two keys, so a stored point renders through the newly
   chosen kind — never a NaN, never silently dropped. */
head('(o) KIND SWITCH — a stored point survives step → bezier → straight');
{
  const KINDS = ['step', 'smoothstep', 'bezier', 'straight', 'goblinEdge'];
  const rnd = rndFrom(6060);
  let n = 0, bad = 0, dropped = 0, offPath = 0, labelOff = 0;
  let firstBad = null;
  for (let i = 0; i < 240; i++) {
    const sp = SIDES[i % 4], tp = SIDES[(i + 1 + (i % 3)) % 4];   // incl. same-side pairs
    const s = {x: Math.round(rnd() * 500), y: Math.round(rnd() * 500)};
    const t = {x: Math.round(rnd() * 500), y: Math.round(rnd() * 500)};
    if (i % 4 === 0) t.y = s.y;
    if (i % 8 === 0) { t.x = s.x; t.y = s.y; }
    const g = geo(s, t, sp, tp);
    const pm = plainMidpoint(g);
    const W = {x: pm.x + Math.round(rnd() * 160 - 80), y: pm.y + Math.round(rnd() * 160 - 80)};
    const data = {bendX: W.x, bendY: W.y};
    for (const kind of KINDS) {
      n++;
      // the point is never dropped: both keys survive the switch and `drawnMid` reads them back
      if (!needsCustom(g, data.bendX, data.bendY)) { dropped++; continue; }
      const back = drawnMid(g, data.bendX, data.bendY);
      if (back.x !== W.x || back.y !== W.y) { dropped++; firstBad ??= {kind, back, W}; }
      const d = renderKind(kind, g, data);
      if (!d || !d.startsWith('M') || /NaN|Infinity|undefined|null/.test(d)) { bad++; firstBad ??= {kind, sp, tp, d}; continue; }
      // the point is HONOURED — on the drawn path, for every kind
      const tol = kind === 'smoothstep' ? 12.01 : 0.01;   // a rounded corner cuts the vertex
      const dev = distToCurve(d, [W.x, W.y]);
      if (!(dev <= tol)) { offPath++; firstBad ??= {kind, dev, d, W}; }
      // and where the route returns a label, it IS the waypoint
      if (kind === 'straight') {
        const [dd, lx, ly] = straightPath(g, W);
        if (dd !== d || lx !== W.x || ly !== W.y) labelOff++;
      }
    }
  }
  console.log(`     ${n} (geometry × kind) cases across all four kinds + the \`goblinEdge\` alias (240 geometries)`);
  ok(n >= 200, 'sample size >= 200', `${n}`);
  ok(bad === 0, 'switching kinds never emits NaN / Infinity / an empty path', bad ? JSON.stringify(firstBad) : `${n}/${n}`);
  ok(dropped === 0, 'and never drops the point — both keys survive the switch and `drawnMid` reads them back', `${n - dropped}/${n}`);
  ok(offPath === 0, 'and every kind HONOURS it: the stored point is on the drawn path of the newly-chosen kind', offPath ? JSON.stringify(firstBad) : `${n}/${n}`);
  ok(labelOff === 0, '`straight` renders exactly the point it is handed (label === W)', `${labelOff} off`);
  // the switch sequence the task names, on one geometry, printed
  const g1 = geo({x: 0, y: 0}, {x: 240, y: 120}, 'right', 'left');
  const W1 = {x: 100, y: 60};
  console.log('\n     the same stored point (100, 60) on a 240×120 right->left edge, per kind:');
  for (const kind of ['step', 'bezier', 'straight', 'smoothstep']) {
    const d = renderKind(kind, g1, {bendX: W1.x, bendY: W1.y});
    console.log(`       ${kind.padEnd(10)} dev ${distToCurve(d, [W1.x, W1.y]).toFixed(3)}px   ${d.slice(0, 72)}`);
  }
}

console.log(`\n${failures === 0 ? 'ALL GREEN' : `${failures} FAILURE(S)`} — round-s-edge-bend\n`);
process.exit(failures === 0 ? 0 : 1);
