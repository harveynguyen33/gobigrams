#!/usr/bin/env node
/**
 * ROUND S harness — the draw.io-style MIDPOINT DRAG, modelled in plain Node.
 *
 * WHY A HARNESS AND NOT A BROWSER: this pass has no browser (the orchestrator
 * verifies live in its own). So every rule below is checked against the
 * INSTALLED generator — `@xyflow/system` — by RUNNING it, or by parsing the rule
 * out of its shipped source with the line number printed, never from memory.
 *
 * THE QUESTION THIS PASS EXISTS TO ANSWER: the bend slider is inert on a level
 * pair of nodes. The drag must not be. So the central controls below are a LEVEL
 * right→left pair 212px apart — Harvey's own `e1` — plus a `right`→`right`
 * same-side pair, and each asserts the direction the drag owns MOVES the line.
 *
 * `renderLikeApp` is a faithful model of the branch `GoblinEdge` takes, so the
 * claims here are about the code that ships rather than about a parallel copy of
 * it: the gate decides between the generator (with `stepPosition`) and the
 * bend renderer, exactly as the component does.
 *
 * Node's own type-stripping loads `src/edgeBend.ts` directly, so the maths under
 * test is the maths that ships.
 */
import {readFileSync} from 'node:fs';
import {getSmoothStepPath} from '@xyflow/system';
import {
  SIDE_OUT, OPPOSITE_SIDE, STEP_GAP_PX,
  applyDrag, bendActive4, bendAxis, bendDraggable4, bendGate, bendRender,
  collapsed4, drawnMid, needsCustom, plainMidpoint, stepMidpoint, stepPath,
  customStepPath, dragPatch,
} from '../src/edgeBend.ts';

const ROOT = '/home/harvey/projects/tech-goblin/lab/diagram-studio';
const SYS_SRC = readFileSync(`${ROOT}/node_modules/@xyflow/system/dist/esm/index.mjs`, 'utf8');
const APP_SRC = readFileSync(`${ROOT}/src/App.tsx`, 'utf8');
const SYS_LINES = SYS_SRC.split('\n');

let failures = 0;
const ok = (cond, label, detail = '') => {
  if (!cond) failures++;
  console.log(`  ${cond ? 'PASS' : 'FAIL'}  ${label}${detail ? `  — ${detail}` : ''}`);
};
const head = t => console.log(`\n${t}`);
const lineOf = needle => {
  const i = SYS_LINES.findIndex(l => l.includes(needle));
  return i < 0 ? null : i + 1;
};
const at = needle => `index.mjs:${lineOf(needle) ?? '??'}  ${needle}`;

/* ---------------------------------------------------------------- geometry */
const geo = (s, t, sp, tp) => ({s, t, sp, tp});
const SIDES = ['left', 'right', 'top', 'bottom'];
/** The M/L vertices, in order — the exact polyline of a `borderRadius: 0` path. */
function vertices(d) {
  const out = [];
  const re = /[ML]\s*(-?[\d.]+)[ ,](-?[\d.]+)/g;
  let m;
  while ((m = re.exec(d))) out.push([Number(m[1]), Number(m[2])]);
  return out;
}
/** Consecutive duplicates removed — "L130 0L130 0" draws the same line as
 *  "L130 0", and the generator emits such repeats; a copy of a line must not
 *  read as a difference. */
function dedup(pts) {
  const out = [];
  for (const p of pts) {
    const l = out[out.length - 1];
    if (!l || Math.abs(l[0] - p[0]) > 1e-9 || Math.abs(l[1] - p[1]) > 1e-9) out.push(p);
  }
  return out;
}
/** Max vertex deviation between two paths as POLYLINES, or Infinity when their
 *  vertex counts differ (a different shape). */
function samePolyline(a, b) {
  const A = dedup(vertices(a)), B = dedup(vertices(b));
  if (A.length !== B.length) return Infinity;
  let max = 0;
  for (let i = 0; i < A.length; i++) {
    max = Math.max(max, Math.abs(A[i][0] - B[i][0]), Math.abs(A[i][1] - B[i][1]));
  }
  return max;
}
function distToSeg(p, a, b) {
  const dx = b[0] - a[0], dy = b[1] - a[1];
  const L = dx * dx + dy * dy;
  let t = L ? ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / L : 0;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(p[0] - (a[0] + t * dx), p[1] - (a[1] + t * dy));
}
function distToPath(d, p) {
  const P = dedup(vertices(d));
  let best = Infinity;
  for (let i = 1; i < P.length; i++) best = Math.min(best, distToSeg(p, P[i - 1], P[i]));
  return best;
}
/** Today's rendering, verbatim: no centre and no stepPosition passed. */
const TODAY = (g, br) => getSmoothStepPath({
  sourceX: g.s.x, sourceY: g.s.y, sourcePosition: g.sp,
  targetX: g.t.x, targetY: g.t.y, targetPosition: g.tp, borderRadius: br,
})[0];
/** Today's rendering once the SLIDER has written a fraction. */
const TODAY_SLIDER = (g, br, stepPosition) => getSmoothStepPath({
  sourceX: g.s.x, sourceY: g.s.y, sourcePosition: g.sp,
  targetX: g.t.x, targetY: g.t.y, targetPosition: g.tp, borderRadius: br, stepPosition,
})[0];
const centered = (g, W, br) => getSmoothStepPath({
  sourceX: g.s.x, sourceY: g.s.y, sourcePosition: g.sp,
  targetX: g.t.x, targetY: g.t.y, targetPosition: g.tp, borderRadius: br,
  centerX: W.x, centerY: W.y,
});

/** THE BRANCH `GoblinEdge` TAKES, modelled: gate off → the generator with
 *  `stepPosition` (exactly the pre-ROUND-S path); gate on → the bend renderer,
 *  which chooses the hand-built route only where the generator cannot draw. */
function renderLikeApp(g, data, br) {
  if (!bendGate(g).active) {
    return getSmoothStepPath({
      sourceX: g.s.x, sourceY: g.s.y, sourcePosition: g.sp,
      targetX: g.t.x, targetY: g.t.y, targetPosition: g.tp, borderRadius: br,
      stepPosition: data.bend,
    })[0];
  }
  const W = drawnMid(g, data.bendX, data.bendY, data.bend);
  return bendRender(g, W, br, needsCustom(g, data.bendX, data.bendY)).path;
}
/** What the app stores for a drag to `W`. */
const dragTo = (g, W) => applyDrag({}, bendAxis(g), W);

/* ------------------------------------------------------------------ (0) SOURCE
   Every generator rule this file models, printed with its line, so the model can
   be checked against the shipped sheet by eye — plus the two constants PARSE-
   checked, because a dependency bump that changed them must fail here rather
   than make a geometry test pass for the wrong reason. */
head('(0) SOURCE — the rules this file models, with their line numbers');
console.log(`     read from ${ROOT}/node_modules/@xyflow/system/dist/esm/index.mjs`);
const sig = SYS_LINES.find(l => l.includes('function getSmoothStepPath({')) ?? '';
const offsetInSrc = /offset\s*=\s*(\d+(?:\.\d+)?)/.exec(sig);
const stepPosInSrc = /stepPosition\s*=\s*([\d.]+)/.exec(sig);
console.log(`     ${at('function getSmoothStepPath({')}  signature: offset=${offsetInSrc?.[1]}, stepPosition=${stepPosInSrc?.[1]}`);
ok(!!offsetInSrc && Number(offsetInSrc[1]) === STEP_GAP_PX, `STEP_GAP_PX === the installed offset default (${STEP_GAP_PX})`);
ok(!!stepPosInSrc && Number(stepPosInSrc[1]) === 0.5, 'the generator default stepPosition is 0.5 — "absent" renders as today');
for (const [side, d] of Object.entries(SIDE_OUT)) {
  const needle = `[Position.${side[0].toUpperCase() + side.slice(1)}]: { x: ${d.x}, y: ${d.y} }`;
  console.log(`     ${at(needle)}`);
  ok(lineOf(needle) !== null, `SIDE_OUT.${side} matches the installed handleDirections`, `{x:${d.x},y:${d.y}}`);
}
console.log(`     ${at("const dirAccessor = dir.x !== 0 ? 'x' : 'y'")}  primary axis comes from the SOURCE handle`);
console.log(`     ${at('if (sourceDir[dirAccessor] * targetDir[dirAccessor] === -1)')}  the opposite-handle branch`);
console.log(`     ${at('centerX = center.x ?? sourceGapped.x')}  VERTICAL split — reads centerX`);
console.log(`     ${at('centerY = center.y ?? sourceGapped.y')}  VERTICAL split — reads centerY (used only by the split's ends)`);
console.log(`     ${at('const horizontalSplit = [')}  HORIZONTAL split = {x: sg.x, y: centerY} / {x: tg.x, y: centerY} (:1289-1290)`);
console.log(`     ${at('if (sourceDir[dirAccessor] === currDir)')}  verticalSplit when the source handle points ALONG the run`);
console.log(`     ${at('return [pathPoints, centerX, centerY, defaultOffsetX, defaultOffsetY]')}  labelX/labelY ARE the centre computed above`);
console.log(`     ${at('centerX = (sourceGapPoint.x + targetGapPoint.x) / 2')}  non-opposite branch OVERWRITES any centre`);
console.log(`     ${at('function getBend(a, b, c, size)')}  corner treatment replicated verbatim in customStepPath`);

/* --------------------------------------------------------------- (a) PARITY
   An untouched board stores nothing, so `renderLikeApp` must produce today's
   path within 0.01px — the "nothing on screen moves" gate for the whole feature. */
head('(a) PARITY — a board with no stored bend renders as today');
{
  let seed = 1337;
  const rnd = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
  let n = 0, worst = 0, worstCase = '', worstPoly = 0, worstCasePoly = '';
  const pairs = [];
  for (const sp of SIDES) for (const tp of SIDES) pairs.push([sp, tp]);
  while (n < 240) {
    const [sp, tp] = pairs[n % pairs.length];
    const mode = n % 5;
    const s = {x: Math.round(rnd() * 600 - 300), y: Math.round(rnd() * 600 - 300)};
    const t = {x: Math.round(rnd() * 600 - 300), y: Math.round(rnd() * 600 - 300)};
    if (mode === 0 && (sp === 'left' || sp === 'right')) t.y = s.y;       // level on the drag axis
    if (mode === 1 && (sp === 'left' || sp === 'right')) t.x = s.x - 180; // backwards
    if (mode === 2) { t.x = s.x; t.y = s.y; }                             // degenerate
    const g = geo(s, t, sp, tp);
    for (const br of [0, 12]) {
      // the shipping branch (as the component takes it)
      const dev = samePolyline(renderLikeApp(g, {}, br), TODAY(g, br));
      if (dev > worst) { worst = dev; worstCase = `${sp}->${tp} br${br} ${JSON.stringify(g)}`; }
      // and the maths directly, so a regression is attributable
      const dev2 = samePolyline(stepPath(g, drawnMid(g), br)[0], TODAY(g, br));
      if (dev2 > worstPoly) { worstPoly = dev2; worstCasePoly = `${sp}->${tp} br${br}`; }
      n++;
    }
  }
  console.log(`     ${n} geometries (all 16 side pairs × 2 border radii: level / staggered / backwards / degenerate)`);
  ok(n >= 200, `sample size >= 200`, `${n}`);
  ok(worst <= 0.01, "the shipping branch renders today's path", `worst ${worst}px${worst ? ` (${worstCase})` : ''}`);
  ok(worstPoly <= 0.01, 'stepPath at the plain midpoint traces the same line', `worst ${worstPoly}px${worstPoly ? ` (${worstCasePoly})` : ''}`);
}

/* ------------------------------------------------------------ (a2) SLIDER
   The step-position slider already shipped and must keep working. The fraction
   writes the same coordinate the generator's vertical split reads, so a stored
   `bend` must render identically through the new branch — otherwise the first
   drag would silently move a line the user had positioned with the slider. */
head('(a2) SLIDER PARITY — a stored `bend` renders unchanged through the new branch');
{
  let seed = 808, n = 0, worst = 0, moved = 0;
  const rnd = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
  for (let i = 0; i < 200; i++) {
    const sp = SIDES[i % 4], tp = OPPOSITE_SIDE[sp];
    const g = geo({x: rnd() * 400, y: rnd() * 400}, {x: rnd() * 400, y: rnd() * 400}, sp, tp);
    for (const f of [0.1, 0.35, 0.75]) {
      const br = 12;
      const want = TODAY_SLIDER(g, br, f);
      const dev = samePolyline(renderLikeApp(g, {bend: f}, br), want);
      if (dev > worst) worst = dev;
      if (samePolyline(want, TODAY_SLIDER(g, br, 0.5)) > 0.5) moved++;
      n++;
    }
  }
  console.log(`     ${n} slider values across the 4 opposite pairs; ${moved} of them actually move the line`);
  ok(worst <= 0.01, 'a stored `bend` renders through the new branch unchanged', `worst ${worst}px`);
  ok(moved > 0, 'the slider is still live where it is live (it is not being disabled)', `${moved}/${n}`);
}

/* ------------------------------------------------------------ (b) ONE AXIS
   A drag writes ONE key; the other coordinate is inherited, so it must be the
   generator's own midpoint and not the pointer. That is what keeps the line
   square — and it is also what keeps the label (which the generator reports as
   the passed centre) from leaving the bar when a node later moves. */
head('(b) ONE AXIS — the drag writes one key, and the other coordinate is the midpoint');
{
  let seed = 99, n = 0, bad = [];
  const rnd = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
  for (let i = 0; i < 200; i++) {
    const sp = SIDES[i % 4], tp = OPPOSITE_SIDE[sp];
    const g = geo({x: rnd() * 400, y: rnd() * 400}, {x: rnd() * 400, y: rnd() * 400}, sp, tp);
    const axis = bendAxis(g), pm = plainMidpoint(g);
    // the app projects the pointer onto the owned axis before writing
    const W = axis === 'h' ? {x: pm.x + 300, y: pm.y} : {x: pm.x, y: pm.y - 300};
    const data = applyDrag({bend: 0.3, strokeKey: 'blue'}, axis, W);   // the writer `App.onBend` uses
    const want = axis === 'h' ? 'bendX' : 'bendY';
    const other = axis === 'h' ? 'bendY' : 'bendX';
    if (!(want in data)) bad.push({axis, missing: want});
    if (other in data) bad.push({axis, stale: other});
    if (data.bend !== undefined) bad.push({axis, bendSurvived: data.bend});
    if (data.strokeKey !== 'blue') bad.push({axis, siblingData: 'clobbered'});
    // the coordinate the drag does not own resolves to the midpoint, not the finger
    const drawn = drawnMid(g, data.bendX, data.bendY, data.bend);
    const got = axis === 'h' ? drawn.y : drawn.x;
    const expect = axis === 'h' ? pm.y : pm.x;
    if (Math.abs(got - expect) > 1e-9) bad.push({axis, otherNotMid: {got, expect}});
    // and the owned coordinate must move the line wherever the handle is offered
    const moved = samePolyline(renderLikeApp(g, data, 0), renderLikeApp(g, {}, 0));
    if (bendGate(g).active && moved <= 0.5) bad.push({axis, didNotMove: true, g});
    n++;
  }
  console.log(`     ${n} drags over the 4 opposite pairs, written via applyDrag`);
  ok(bad.length === 0, 'one key written, `bend` + the stale axis dropped, siblings intact, other coordinate = midpoint',
    bad.length ? JSON.stringify(bad[0]) : `${n}/${n}`);
}

/* ----------------------------------------------------------- (c) PREDICATE
   THE CENTRAL CLAIM, and the one this round exists for: the handle appears
   exactly when dragging it moves the line. Both directions are checked — a
   handle that does nothing is the defect the slider shipped with, and a missing
   handle on Harvey's level pair is the complaint that started this round. */
head('(c) PREDICATE — the gate is on exactly when a drag moves the line');
{
  let seed = 4242, on = 0, off = 0, counter = [];
  const rnd = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
  const cases = [];
  for (const sp of SIDES) for (const tp of SIDES) cases.push([sp, tp]);
  for (let i = 0; i < 320; i++) {
    const [sp, tp] = cases[i % cases.length];
    const s = {x: Math.round(rnd() * 400), y: Math.round(rnd() * 400)};
    const t = {x: Math.round(rnd() * 400), y: Math.round(rnd() * 400)};
    if (i % 3 === 0) t.x = s.x;                                            // exactly vertical
    if (i % 4 === 0) t.x = s.x + (i % 8 === 0 ? 0 : 220);
    if (i % 5 === 0 && (sp === 'left' || sp === 'right')) t.y = s.y;        // level horizontal
    if (i % 7 === 0 && (sp === 'left' || sp === 'right')) t.x = s.x - 150;  // backwards
    const g = geo(s, t, sp, tp);
    const axis = bendAxis(g), pm = plainMidpoint(g), br = 0;
    const W = axis === 'h' ? {x: pm.x + 400, y: pm.y} : {x: pm.x, y: pm.y - 400};
    const dragged = dragTo(g, W);
    const moved = samePolyline(renderLikeApp(g, dragged, br), renderLikeApp(g, {}, br)) > 0.5;
    const gate = bendGate(g);
    if (gate.active !== moved || (moved && gate.axis !== axis) || (!moved && gate.axis !== null)) {
      counter.push({sp, tp, axis, gate, moved, collapsed: collapsed4(g), g});
    }
    if (moved) on++; else off++;
  }
  console.log(`     ${on + off} geometries; ${on} gate ON, ${off} gate OFF; every one dragged 400px along its own axis`);
  ok(counter.length === 0, '0 counterexamples: gate.active === "a drag moves the line"',
    counter.length ? `${counter.length}: ${JSON.stringify(counter[0])}` : `${on + off}/${on + off}`);
  ok(on > 0 && off > 0, 'both directions of the claim are actually exercised', `${on} on / ${off} off`);

  /* The named controls, printed rather than merely counted. */
  console.log('\n     named controls:');
  const ctrl = (label, g, expectActive) => {
    const axis = bendAxis(g), pm = plainMidpoint(g), br = 0;
    const W = axis === 'h' ? {x: pm.x + 220, y: pm.y} : {x: pm.x, y: pm.y - 220};
    const movedPx = samePolyline(renderLikeApp(g, dragTo(g, W), br), renderLikeApp(g, {}, br));
    const gate = bendGate(g);
    const px = Number.isFinite(movedPx) ? `${movedPx.toFixed(1)}px` : 'a different shape (moved)';
    ok(gate.active === expectActive, `${label}: gate.active === ${expectActive}`,
      `axis=${gate.axis}, generatorRoute=${bendActive4(g)}, collapsed=${collapsed4(g)}`);
    ok((movedPx > 0.5) === expectActive, `${label}: a drag ${expectActive ? 'moves' : 'cannot move'} the line`, px);
    if (expectActive) ok(movedPx > 50 || !Number.isFinite(movedPx), `${label}: and moves it a LOT`, px);
  };
  // Harvey's e1: right → left, same y, and the generator's own centre is inert
  // there (0.000px across the whole sweep) — the case the drag must fix.
  ctrl('A level right->left, 212px apart (his e1)', geo({x: 0, y: 0}, {x: 212, y: 0}, 'right', 'left'), true);
  ctrl('E right->left, 0.5px stagger (his e2)', geo({x: 0, y: 0}, {x: 212, y: 0.5}, 'right', 'left'), true);
  ctrl('F level bottom->top column', geo({x: 0, y: 240}, {x: 0, y: 0}, 'bottom', 'top'), true);
  ctrl('G diagonal right->left (the slider\'s real case)', geo({x: 0, y: 0}, {x: 260, y: 220}, 'right', 'left'), true);
  ctrl('B same side right->right', geo({x: 0, y: 0}, {x: 240, y: 120}, 'right', 'right'), false);
  ctrl('C non-opposite right->bottom', geo({x: 0, y: 0}, {x: 240, y: 120}, 'right', 'bottom'), false);
  ctrl('D backwards right->left', geo({x: 240, y: 0}, {x: 0, y: 120}, 'right', 'left'), true);

  /* The negative control that matters most: on the level pair the generator's
     OWN centre — the thing the slider moves — reaches nothing, so the drag is
     the only control that can work there. This is the measured root cause. */
  const e1 = geo({x: 0, y: 0}, {x: 212, y: 0}, 'right', 'left');
  const pm = plainMidpoint(e1);
  let genMax = 0;
  for (const cy of [-400, -120, -1, 1, 120, 400]) {
    genMax = Math.max(genMax, samePolyline(centered(e1, {x: pm.x, y: pm.y + cy}, 0), TODAY(e1, 0)));
  }
  console.log(`\n     measured on his e1: the generator's own centre moves the drawn line by ${genMax}px`);
  ok(genMax <= 0.01, 'the slider is genuinely inert there — the complaint, re-measured', `${genMax}px`);
  ok(samePolyline(customStepPath(e1, {x: pm.x, y: pm.y + 120}, 0), TODAY(e1, 0)) > 50,
    'and the hand-built route DOES move it', 'the drag works where the slider cannot');
}

/* --------------------------------------------------------------- (d) CLEAR
   A waypoint measured against the OLD endpoints is nonsense after a reconnect,
   so all three keys must go. This reads the SHIPPED handler, not a model of it. */
head('(d) CLEAR — reconnect drops bend / bendX / bendY');
{
  const i = APP_SRC.split('\n').findIndex(l => l.includes('const onReconnect = useCallback'));
  console.log(`     src/App.tsx:${i + 1}  the reconnect handler`);
  const body = APP_SRC.slice(APP_SRC.indexOf('const onReconnect = useCallback'), APP_SRC.indexOf('const onReconnect = useCallback') + 1400);
  ok(/reconnectEdge\(oldEdge/.test(body), 'it still routes through reconnectEdge (type, style, label survive)');
  for (const k of ['bend', 'bendX', 'bendY']) {
    ok(new RegExp(`delete data\\.${k}\\b`).test(body), `src/App.tsx deletes \`${k}\` on reconnect`);
  }
  // and the drag writer's own deletion, exercised for real
  for (const axis of ['h', 'v']) {
    const out = applyDrag({bend: 0.3, strokeKey: 'blue'}, axis, {x: 111, y: 222});
    ok(out.bend === undefined, `applyDrag('${axis}') deletes the superseded fraction`);
    ok(out.strokeKey === 'blue', `applyDrag('${axis}') leaves sibling data alone`);
    ok(axis === 'h' ? out.bendX === 111 && out.bendY === undefined : out.bendY === 222 && out.bendX === undefined,
      `applyDrag('${axis}') writes exactly one key`, JSON.stringify(dragPatch(axis, {x: 111, y: 222})));
  }
}

/* --------------------------------------------------- (e) ANCHOR ON THE LINE
   The handle is drawn at the path's own `labelX`/`labelY` — the point the
   generator (or the hand-built route) reports as the path's middle. Two things
   must hold, and both are the difference between a draw.io-like feel and a
   floating disc: the anchor must lie ON the drawn line, and its coordinate on
   the axis the drag owns must be exactly where the user released the pointer.
   The W is built the way the app builds it (one key stored, the other the
   midpoint), so this is a statement about the shipping branch. */
head('(e) ANCHOR — the handle sits on the line, under the pointer');
{
  let seed = 7, n = 0, worstOnPath = 0, worstOffset = 0, nc = 0, worstCustomOnPath = 0;
  const rnd = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
  for (let i = 0; i < 400; i++) {
    const sp = SIDES[i % 4], tp = OPPOSITE_SIDE[sp];
    const g = geo({x: rnd() * 500, y: rnd() * 500}, {x: rnd() * 500, y: rnd() * 500}, sp, tp);
    if (!bendGate(g).active) continue;
    const axis = bendAxis(g), pm = plainMidpoint(g);
    const delta = rnd() * 200 - 100;
    const W = axis === 'h' ? {x: pm.x + delta, y: pm.y} : {x: pm.x, y: pm.y + delta};
    const data = applyDrag({}, axis, W);                        // exactly what onBend stores
    const custom = needsCustom(g, data.bendX, data.bendY);
    const drawn = drawnMid(g, data.bendX, data.bendY, data.bend);
    const r = bendRender(g, drawn, 0, custom);
    const anchor = {x: r.labelX, y: r.labelY};
    // `distToPath` takes a point as `[x, y]`
    const dev = distToPath(r.path, [anchor.x, anchor.y]);
    const off = Math.abs(axis === 'h' ? anchor.x - W.x : anchor.y - W.y);
    if (!Number.isFinite(dev)) {
      console.log(`     !! non-finite anchor deviation — ${sp}->${tp} axis=${axis} custom=${custom}`);
      console.log(`        g=${JSON.stringify(g)}`);
      console.log(`        data=${JSON.stringify(data)} drawn=${JSON.stringify(drawn)}`);
      console.log(`        path=${r.path}`);
      console.log(`        label=(${r.labelX},${r.labelY})`);
    }
    if (custom) { nc++; worstCustomOnPath = Math.max(worstCustomOnPath, dev); }
    else { worstOnPath = Math.max(worstOnPath, dev); }
    worstOffset = Math.max(worstOffset, off);
    n++;
  }
  console.log(`     ${n} gate-on geometries (${nc} of them the hand-built route); W built as the app builds it`);
  ok(n >= 100, `sample size >= 100`, `${n}`);
  ok(Math.max(worstOnPath, worstCustomOnPath) <= 0.01, 'the handle lies exactly ON the drawn path',
    `worst ${Math.max(worstOnPath, worstCustomOnPath)}px (generator ${worstOnPath}px, custom ${worstCustomOnPath}px)`);
  ok(worstOffset <= 0.01, 'and its dragged coordinate is exactly where the pointer was released',
    `worst ${worstOffset}px`);

  /* THE COLLAPSED BAR, BY NAME. Random coordinates never produce two exactly
     equal values, so the case Harvey's own board is in has to be constructed:
     the two ends level on the perpendicular axis, which is where the generator
     cannot draw the point at all and `customStepPath` takes over. Both the
     handle's position and its correspondence to the pointer are checked here. */
  let cn = 0, cOnPath = 0, cOffset = 0;
  for (const [sp, tp] of [['right', 'left'], ['left', 'right'], ['bottom', 'top'], ['top', 'bottom']]) {
    for (const [dx, dy] of [[212, 0], [0, 212], [-150, 0], [0, -150], [260, 0]]) {
      const g = geo(
        {x: 40, y: 40},
        {x: 40 + (sp === 'left' || sp === 'right' ? dx : dy), y: 40 + (sp === 'left' || sp === 'right' ? dy : dx)},
        sp, tp,
      );
      if (!collapsed4(g)) continue;
      const axis = bendAxis(g), pm = plainMidpoint(g);
      for (const delta of [-120, -35, 0, 60, 175]) {
        const W = axis === 'h' ? {x: pm.x + delta, y: pm.y} : {x: pm.x, y: pm.y + delta};
        const data = applyDrag({}, axis, W);
        const custom = needsCustom(g, data.bendX, data.bendY);
        const r = bendRender(g, drawnMid(g, data.bendX, data.bendY, data.bend), 0, custom);
        cOnPath = Math.max(cOnPath, distToPath(r.path, [r.labelX, r.labelY]));
        cOffset = Math.max(cOffset, Math.abs(axis === 'h' ? r.labelX - W.x : r.labelY - W.y));
        cn++;
        if (!custom && delta !== 0) console.log(`     !! collapsed geometry not routed to customStepPath — ${sp}->${tp} axis=${axis}`);
      }
    }
  }
  console.log(`     ${cn} COLLAPSED-bar drags (level pairs, incl. 0 offset and both directions)`);
  ok(cn >= 20, 'the collapsed case is covered by name, not left to chance', `${cn}`);
  ok(cOnPath <= 0.01, 'on the hand-built route the handle is still exactly ON the line', `worst ${cOnPath}px`);
  ok(cOffset <= 0.01, 'and still exactly under the pointer', `worst ${cOffset}px`);

  /* The untouched state, spelled out: on his own board the handle must appear at
     the middle of the line with nothing stored, and the label must be there too. */
  const e1 = geo({x: 0, y: 0}, {x: 212, y: 0}, 'right', 'left');
  const W = drawnMid(e1);
  const r = bendRender(e1, W, 0, needsCustom(e1));
  console.log(`     his e1 untouched: drawn W={${W.x},${W.y}}, label=(${r.labelX},${r.labelY}) — the line runs y=0, x 0→212`);
  ok(Math.abs(r.labelX - 106) < 1e-9 && Math.abs(r.labelY) < 1e-9,
    'an untouched level edge offers its handle at the middle of the line',
    `(${r.labelX},${r.labelY})`);
}

console.log(`\n${failures === 0 ? 'ALL GREEN' : `${failures} FAILURE(S)`} — round-s-edge-bend\n`);
process.exit(failures === 0 ? 0 : 1);
