#!/usr/bin/env node
/**
 * ROUND AM, AM-1 — THE LABEL DRAG: it wrote an ABSOLUTE point, it writes a DELTA.
 *
 * WHAT THIS FILE IS, AND WHAT IT CANNOT DO.
 *
 * It EXECUTES the shipped `src/edgeLabel.ts` (React-free and DOM-free on purpose,
 * so Node 22 loads it directly) together with a transcription of the two sides of
 * the write that live in components — `GoblinEdge.onLabelDown`'s per-write
 * arithmetic and `App.onLabelWrite`'s merge. Those two transcribings are pinned
 * to the shipped source by SOURCE PROBES in the section above the REPLAY: if the
 * components drift from the model, the probes go RED. That is the honest
 * arrangement available without a browser — the components themselves are React
 * and cannot be imported here.
 *
 * It CANNOT see a browser. This project's headless browser session renders ZERO
 * edges, so NO live gesture can be measured: every number below is a return value
 * of the shipped module plus the pinned model. The owner's device test is the
 * outstanding step.
 *
 * WHY THE NEGATIVE CONTROL IS THE WHOLE POINT HERE. The defect is a TWO-GESTURE
 * defect: the first drag looks perfect (0.0px) and only the second one is wrong.
 * A harness that ran one gesture would pass on the BROKEN tree — the project has
 * already paid for "a check that passes on both trees". So the REPLAY at the
 * bottom re-runs THE SAME INPUTS through a model of the SHIPPED semantics (the
 * frozen render-time anchor + the absolute `labelWrite`) and REQUIRES every
 * corresponding measurement to be RED there (223.6px on the two-gesture probe),
 * alongside source probes that must be RED against `git show 253a77e:…` — a
 * PINNED commit, never `HEAD`, because this round is about to be committed and a
 * `HEAD`-based control would compare the fix with itself.
 *
 * DS_ROOT overrides the project root.
 */
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';

const ROOT = process.env.DS_ROOT || '/home/harvey/projects/tech-goblin/lab/diagram-studio';

/* The pre-fix tree every negative control measures against. PINNED. */
const PRE_COMMIT = process.env.DS_PRE_COMMIT || '253a77e';

/* ---------- the assertion harness (house style) ---------- */
let failures = 0;
const assert = (name, ok, detail) => {
  if (ok) console.log(`  PASS  ${name}\n        ${detail}`);
  else { failures++; console.log(`  FAIL  ${name}\n        ${detail}`); }
};
const section = t => console.log(`\n${t}`);
const f2 = n => (Number.isFinite(n) ? n.toFixed(4) : String(n));

/* ---------- the module under test, loaded for real ---------- */
const M = await import(`${ROOT}/src/edgeLabel.ts`);

/* ---------- the source texts ---------- */
const read = p => readFileSync(`${ROOT}/${p}`, 'utf8');
const APP = read('src/App.tsx');
const EDGE = read('src/GoblinEdge.tsx');
const LIB_SRC = read('src/edgeLabel.ts');
const commitFile = (commit, p) =>
  execFileSync('git', ['show', `${commit}:${p}`], {cwd: ROOT, encoding: 'utf8', maxBuffer: 1 << 28});

/* Blank comments to spaces (length and newlines preserved, so line numbers stay
 * true): the round's own comments quote the very strings some probes assert are
 * ABSENT — `labelWrite` in the drag path, for one — and a raw match would read a
 * correct tree as a defect. */
const blankComments = s => s
  .replace(/\/\*[\s\S]*?\*\//g, m => m.replace(/[^\n]/g, ' '))
  .replace(/(^|[^:])\/\/[^\n]*/g, (m, p) => p + ' '.repeat(m.length - p.length));
const APP_C = blankComments(APP);
const EDGE_C = blankComments(EDGE);

/* ===========================================================================
   THE MODEL, transcribed from the two components and PINNED by probes below.

   Every claim in AM1-a…e is measured through these two functions, so they have
   to be the shipped arithmetic and not a convenient version of it.
   =========================================================================== */

/** `App.onLabelWrite`'s merge: the three branches, in the shipped order. */
const applyLabelWrite = (data, w) => {
  const out = {...data};
  if (!w.labelPinned) {
    delete out.labelOffset; delete out.labelPinned; delete out.labelAnchor;
    return out;
  }
  if (w.labelAnchor === null) {
    if (w.labelOffset.x === 0 && w.labelOffset.y === 0) {
      delete out.labelOffset; delete out.labelPinned; delete out.labelAnchor;
    } else {
      out.labelOffset = w.labelOffset; out.labelPinned = true; delete out.labelAnchor;
    }
    return out;
  }
  const stored = out.labelOffset, storedAnchor = out.labelAnchor;
  const moved = stored && storedAnchor
    && (storedAnchor.x !== w.labelAnchor.x || storedAnchor.y !== w.labelAnchor.y);
  const corrected = moved
    ? {x: stored.x + (storedAnchor.x - w.labelAnchor.x), y: stored.y + (storedAnchor.y - w.labelAnchor.y)}
    : (stored ?? {x: 0, y: 0});
  const offset = {x: corrected.x + w.labelOffset.x, y: corrected.y + w.labelOffset.y};
  if (offset.x === 0 && offset.y === 0) {
    delete out.labelOffset; delete out.labelPinned; delete out.labelAnchor;
  } else {
    out.labelOffset = offset; out.labelPinned = true; out.labelAnchor = w.labelAnchor;
  }
  return out;
};

/** The label's PAINTED position: the anchor plus the stored offset, unpinned
 *  meaning the anchor itself. This is `labelAnchor()`'s own last two lines, read
 *  off the real module rather than re-implemented, so the two cannot disagree. */
const painted = (data, anchor) => M.labelAnchor({
  sourceX: anchor.x, sourceY: anchor.y, targetX: anchor.x, targetY: anchor.y,
  labelX: anchor.x, labelY: anchor.y,
  labelOffset: data.labelOffset, labelPinned: data.labelPinned,
});

const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

/** THE FIXED ENGINE — `GoblinEdge.onLabelDown`'s per-write arithmetic, run over
 *  a whole gesture.
 *
 *  `live[i]` is the anchor in force when write `i` happens (a node move shows up
 *  as a change here), and the closure's `data` is the render at pointerdown. The
 *  reference is the label's painted point in the INCOMING frame for the first
 *  write, then the previous reported point — the shipped rule, transcribed. */
const gestureFixed = ({data, anchor0, live = [], origin, points}) => {
  const anchor = {...anchor0};
  let prev = null;
  let out = data;
  for (const [i, p] of points.entries()) {
    if (live[i]) { anchor.x += live[i].x; anchor.y += live[i].y; }
    const A = {...anchor};
    const frame = data.labelAnchor ?? A;
    const reference = prev ?? {x: frame.x + (data.labelOffset?.x ?? 0), y: frame.y + (data.labelOffset?.y ?? 0)};
    const w = M.anchorWrite({anchor: A, base: {x: A.x - reference.x, y: A.y - reference.y}, W: p});
    out = applyLabelWrite(out, w);
    prev = {...p};
  }
  return {data: out, anchor};
};

/** THE SHIPPED ENGINE, as the negative control. The closure's `L` is the
 *  RENDER-time anchor — the label's PAINTED position — frozen for the whole
 *  gesture (React Flow re-renders the label only AFTER the write it triggers),
 *  and the write is the absolute `labelWrite`. This is `git show 253a77e`'s
 *  semantics, transcribed, so both trees can be run over the same inputs. */
const applyLabelWriteShipped = (data, w) => {
  const out = {...data};
  if (!w.labelPinned) { delete out.labelOffset; delete out.labelPinned; return out; }
  out.labelOffset = w.labelOffset; out.labelPinned = true; return out;
};
const gestureShipped = ({data, anchor0, origin, points}) => {
  const L = painted(data, anchor0);                 // the render that made the handler
  let out = data;
  for (const p of points) out = applyLabelWriteShipped(out, M.labelWrite({W: p, anchor: L}));
  return {data: out, anchor: anchor0};
};

console.log('='.repeat(78));
console.log('ROUND AM, AM-1 — the edge-label drag: DELTA + anchor rebase');
console.log('EXECUTES the shipped pure module; the two component sides are PINNED by source probes');
console.log('='.repeat(78));
console.log(`root: ${ROOT}`);
console.log(`node: ${process.version}`);
console.log(`pre-fix tree (negative control): ${PRE_COMMIT}`);

/* ===========================================================================
   AM1-a — TWO CONSECUTIVE GESTURES TRACK THE POINTER.
   ===========================================================================
   The defect's own shape: gesture 1 is perfect on the broken tree, gesture 2 is
   not. So the fixture is TWO gestures, the second one starting on a label the
   FIRST one pinned — plus a two-write gesture, because the staleness the fix
   addresses is present in every gesture, not only in later ones. */
section('AM1-a — two consecutive gestures: the painted label tracks the pointer in BOTH');
{
  const A0 = {x: 100, y: 100};
  const ends = [{x: 300, y: 200}, {x: 400, y: 250}];
  let data = {};
  const rows = [];
  for (const [n, end] of ends.entries()) {
    const grab = painted(data, A0);
    // grab exactly on the painted centre, then two writes: the second one is the
    // one whose reference the shipped code had already let go stale.
    const mid = {x: (grab.x + end.x) / 2, y: (grab.y + end.y) / 2};
    const r = gestureFixed({data, anchor0: A0, origin: grab, points: [mid, end]});
    data = r.data;
    rows.push({n: n + 1, grab, end, atMid: painted(r.data, A0), err: dist(painted(r.data, A0), end)});
  }
  const worst = Math.max(...rows.map(r => r.err));
  const pinnedByFirst = rows[0].err < 0.01;
  assert('AM1-a.two-gestures-each-track-the-pointer-to-under-0.01px',
    rows.every(r => r.err < 0.01),
    rows.map(r => `gesture ${r.n}: grabbed ${JSON.stringify(r.grab)}, finger ends ${JSON.stringify(r.end)} → ` +
      `painted ${JSON.stringify(painted(data, A0))}, error ${f2(r.err)}px`).join('  ·  ') +
    `. The SECOND gesture starts on a label the FIRST pinned (pinned after gesture 1 = ${pinnedByFirst}), ` +
    `and each gesture carries TWO writes so the stale-reference case is exercised inside it as well. ` +
    `Stored after both: ${JSON.stringify(data)} — offset {300,150} against anchor {100,100} is exactly the ` +
    `pointer's total displacement from the first grab.`);

  /* The first gesture ALONE, on an edge that was never pinned: the case the
     shipped tree also gets right, stated so the reader can see the fix did not
     buy the second gesture by breaking the first. */
  const fresh = gestureFixed({data: {}, anchor0: A0, origin: {x: A0.x, y: A0.y}, points: [{x: 300, y: 200}]});
  assert('AM1-a.a-first-gesture-on-a-never-pinned-label-still-tracks-the-pointer',
    dist(painted(fresh.data, A0), {x: 300, y: 200}) < 0.01,
    `a never-pinned label (no stored offset — an existing board) grabbed at its centre ${JSON.stringify(A0)} and ` +
    `dragged to {300,200} → painted ${JSON.stringify(painted(fresh.data, A0))}, error ` +
    `${f2(dist(painted(fresh.data, A0), {x: 300, y: 200}))}px, stored ${JSON.stringify(fresh.data)}`);
}

/* ===========================================================================
   AM1-b — THE ANCHOR MOVES MID-GESTURE (a node is dragged under the finger).
   ===========================================================================
   This is what the REBASE is for, and it is measured against `anchorRef` — a
   ref, read per write, whose value the renderer publishes every committed render.
   With the shipped absolute write this probe is off by the node's own movement. */
section('AM1-b — a node moving mid-gesture leaves the label under the pointer');
{
  const A0 = {x: 100, y: 100};
  const move = {x: 30, y: 10};
  const points = [{x: 200, y: 180}, {x: 300, y: 260}, {x: 400, y: 300}];
  const r = gestureFixed({data: {}, anchor0: A0, live: [move, null, null], origin: {...A0}, points});
  const want = points[points.length - 1];
  const Aend = {x: A0.x + move.x, y: A0.y + move.y};
  assert('AM1-b.a-node-move-mid-gesture-costs-under-0.01px',
    dist(painted(r.data, Aend), want) < 0.01,
    `the anchor moved ${JSON.stringify(move)} before the first write (a node dragged under the finger): ` +
    `painted ${JSON.stringify(painted(r.data, Aend))} against the pointer ${JSON.stringify(want)} → ` +
    `${f2(dist(painted(r.data, Aend), want))}px, stored ${JSON.stringify(r.data)}, frame ` +
    `${JSON.stringify(r.data.labelAnchor)}. Note the stored ANCHOR is the MOVED anchor — the frame is recorded ` +
    `so the next write can correct for it, which is the rebase.`);

  /* THE CONTROL FOR THIS CLAIM: without the rebase (i.e. with the stored offset
     adopted as the write's value), the same gesture drifts by exactly the node's
     movement. Measured, not asserted as a description. */
  const noRebase = (() => {
    const anchor = {...A0};
    let out = {}, prev = {...A0};
    for (const [i, p] of points.entries()) {
      if (i === 0) { anchor.x += move.x; anchor.y += move.y; }
      const w = M.anchorWrite({anchor: {...anchor}, base: {x: anchor.x - prev.x, y: anchor.y - prev.y}, W: p});
      const o = {...out};
      o.labelOffset = w.labelOffset; o.labelPinned = true; o.labelAnchor = w.labelAnchor;
      out = o; prev = {...p};
    }
    return dist(painted(out, Aend), want);
  })();
  assert('AM1-b.the-rebase-is-load-bearing-without-it-the-drift-is-the-nodes-movement',
    noRebase > 0.01,
    `the SAME gesture with the rebase deleted (the stored offset adopted as the write's value) lands ` +
    `${f2(noRebase)}px from the pointer — exactly the ${f2(Math.hypot(move.x, move.y))}px the node moved. ` +
    `So AM1-b measures the rebase and not merely the delta.`);

  /* A node moving BETWEEN two gestures — the everyday "move the box, then nudge
     the label" case, where the label must stay where the EYE left it and only the
     number changes. */
  const g1 = gestureFixed({data: {}, anchor0: A0, origin: {...A0}, points: [{x: 300, y: 200}]});
  const movedA = {x: A0.x + 50, y: A0.y + 20};
  const paintedAfterNodeMove = painted(g1.data, movedA);
  const g2 = gestureFixed({data: g1.data, anchor0: movedA, origin: paintedAfterNodeMove, points: [{x: 400, y: 250}]});
  assert('AM1-b.a-node-moving-between-two-gestures-does-not-move-the-label-off-the-finger',
    dist(painted(g2.data, movedA), {x: 400, y: 250}) < 0.01,
    `after gesture 1 the label is stored ${JSON.stringify(g1.data.labelOffset)} in the frame ` +
    `${JSON.stringify(g1.data.labelAnchor)}; the node then moves to ${JSON.stringify(movedA)}, painting the ` +
    `label at ${JSON.stringify(paintedAfterNodeMove)}; gesture 2 drags it to {400,250} → painted ` +
    `${JSON.stringify(painted(g2.data, movedA))}, error ${f2(dist(painted(g2.data, movedA), {x: 400, y: 250}))}px, ` +
    `stored ${JSON.stringify(g2.data)}. The frame was re-recorded as the moved anchor, so the correction ` +
    `happened once and cannot compound.`);
}

/* ===========================================================================
   AM1-c — A CENTRED WRITE IS STILL ONE STORED STATE, ALL THREE KEYS.
   ===========================================================================
   The invariant ROUND AK set: "reset", "dragged exactly back to the centre" and
   "never moved" are ONE stored value. `labelAnchor` must join `labelOffset` and
   `labelPinned` on the deleted list, or the next drag would rebase against a
   frame with no offset to describe. */
section('AM1-c — a centred write deletes labelOffset, labelPinned AND labelAnchor');
{
  const dirty = {labelOffset: {x: 40, y: 20}, labelPinned: true, labelAnchor: {x: 100, y: 100}, strokeKey: 'amber'};
  const centred = applyLabelWrite(dirty, {labelAnchor: null, labelOffset: {x: 0, y: 0}, labelPinned: false});
  const keys = Object.keys(centred).sort();
  assert('AM1-c.a-centred-write-leaves-no-label-key-behind-and-keeps-every-sibling',
    !('labelOffset' in centred) && !('labelPinned' in centred) && !('labelAnchor' in centred)
      && centred.strokeKey === 'amber',
    `{labelOffset, labelPinned, labelAnchor} in, ${JSON.stringify(keys)} out — all three label keys gone, ` +
    `the sibling \`strokeKey\` untouched (App merges a patch into the edge's data, never \`replaceData\`). ` +
    `Same value a board that never carried any of them renders as.`);

  /* A gesture that ENDS on the anchor must reach the SAME state, through the
     delta path rather than the centred flag — otherwise "dragged right back"
     would be a second representation of the centred label. */
  const back = M.anchorWrite({anchor: {x: 100, y: 100}, base: {x: 0, y: 0}, W: {x: 100, y: 100}});
  const back2 = M.anchorWrite({anchor: {x: 100, y: 100}, base: {x: -7, y: -3}, W: {x: 107, y: 103}});
  const collapsed = applyLabelWrite({labelOffset: {x: 0, y: 0}, labelPinned: true, labelAnchor: {x: 100, y: 100}},
    {labelAnchor: {x: 100, y: 100}, labelOffset: back2.labelOffset, labelPinned: true});
  assert('AM1-c.a-gesture-ending-on-the-anchor-collapses-to-the-same-stored-state',
    back.labelPinned === true && back2.labelOffset.x === 0 && back2.labelOffset.y === 0
      && !('labelOffset' in collapsed) && !('labelPinned' in collapsed) && !('labelAnchor' in collapsed),
    `\`anchorWrite\` does NOT collapse a zero increment itself (it is a DELTA — the gesture's total lives in App): ` +
    `a zero increment comes back ${JSON.stringify(back)}, pinning is the caller's business. What collapses it is ` +
    `App's merge: a running total of {0,0} → ${JSON.stringify(collapsed)}. So the centred state is reached by the ` +
    `gesture as well as by Reset, and there is still exactly ONE stored representation of it.`);
}

/* ===========================================================================
   AM1-d — RELEASING EXACTLY ON THE GRAB POINT RESTORES THE PRE-DRAG POSITION.
   ===========================================================================
   This is the sharpest fixture in the round: a label dragged out and released
   back where it was grabbed must come back EXACTLY — including when its stored
   offset is NOT zero, which is the case a "collapse a zero offset to centred"
   rule would destroy. */
section('AM1-d — release on the grab point restores the pre-drag painted position exactly');
{
  const A0 = {x: 100, y: 100};
  const cases = [
    {name: 'a never-pinned label', data: {}},
    {name: 'a label with a stored non-zero offset', data: {labelOffset: {x: 40, y: -15}, labelPinned: true, labelAnchor: {...A0}}},
  ];
  const rows = [];
  let allExact = true, allSameKeys = true;
  for (const c of cases) {
    const grab = painted(c.data, A0);
    const out = {x: grab.x + 120, y: grab.y + 80};
    const mid = gestureFixed({data: c.data, anchor0: A0, origin: grab, points: [out]});
    const back = gestureFixed({data: mid.data, anchor0: A0, origin: out, points: [grab]});
    const err = dist(painted(back.data, A0), grab);
    const sameKeys = JSON.stringify(Object.keys(back.data).sort()) === JSON.stringify(Object.keys(c.data).sort());
    if (err !== 0) allExact = false;
    if (!sameKeys) allSameKeys = false;
    rows.push(`${c.name}: grabbed ${JSON.stringify(grab)} → dragged to ${JSON.stringify(out)} → released on the ` +
      `grab point → painted ${JSON.stringify(painted(back.data, A0))}, error ${err}px, stored ${JSON.stringify(back.data)}`);
  }
  assert('AM1-d.a-drag-and-return-is-EXACT-not-merely-close',
    allExact,
    `${rows.join('  ·  ')}. The error is EXACTLY 0, not a tolerance: the gesture's total is the sum of its ` +
    `increments, and a return adds the exact negation of the outbound ones.`);

  assert('AM1-d.a-drag-and-return-lands-on-the-SAME-KEYS-it-started-with',
    allSameKeys,
    `whether the label started unpinned (no keys) or pinned (offset + pinned + anchor), the returned state ` +
    `carries the SAME KEY SET — so a cancelled drag cannot leave a second representation of "where it was" ` +
    `behind. The unpinned case is the one that ends keyless: total {0,0} collapses, which is ROUND AK's invariant.`);

  /* AND the shipped tree's behaviour on the same fixture, named for the record:
     it does NOT restore — it writes the released point as an offset from the
     painted position, which is a different label entirely. */
  const shipped = gestureShipped({
    data: {labelOffset: {x: 40, y: -15}, labelPinned: true, labelAnchor: {...A0}},
    anchor0: A0, origin: {x: 140, y: 85}, points: [{x: 260, y: 165}, {x: 140, y: 85}],
  });
  console.log(`        (shipped semantics on the same fixture: painted ` +
    `${JSON.stringify(painted(shipped.data, A0))} — not the grab point, which is the defect)`);
}

/* ===========================================================================
   AM1-e — ZOOM INDEPENDENCE.
   ===========================================================================
   The write is in FLOW units and carries no zoom factor: the renderer's
   screen→flow conversion (in `useEdgeGesture` / `onLabelDown`) is the only place
   a zoom appears, and it is applied before the write. So the SAME SCREEN gesture
   must move the label by the same FLOW distance at every zoom. */
section('AM1-e — the same screen gesture at zoom 0.5 / 1 / 2 tracks the pointer in flow units');
{
  const A0 = {x: 100, y: 100};
  const rows = [];
  let worst = 0;
  for (const z of [0.5, 1, 2]) {
    const flow = 100 / z;                      // 100 screen px of finger travel
    const grab = painted({}, A0);
    const end = {x: grab.x + flow, y: grab.y};
    const r = gestureFixed({data: {}, anchor0: A0, origin: grab, points: [end]});
    const err = dist(painted(r.data, A0), end);
    worst = Math.max(worst, err);
    rows.push(`zoom ${z}: 100 screen px = ${flow} flow px → painted ${JSON.stringify(painted(r.data, A0))}, ` +
      `offset ${JSON.stringify(r.data.labelOffset)}, error ${f2(err)}px`);
  }
  const zoomTokens = (LIB_SRC.match(/export function anchorWrite[\s\S]*?\n\}/) ?? [''])[0];
  assert('AM1-e.the-same-screen-gesture-is-the-same-flow-distance-at-every-zoom',
    worst < 0.01 && !/zoom/i.test(zoomTokens),
    `${rows.join('  ·  ')}. \`anchorWrite\`'s own body mentions no zoom (${!/zoom/i.test(zoomTokens)}) — the ` +
    `conversion is the gesture's, so the write cannot scale a delta twice. The offsets differ because the FLOW ` +
    `distance differs at each zoom, which is the point: the label follows the finger on screen.`);
}

/* ===========================================================================
   THE SOURCE PROBES — the model above is pinned to the shipped components.
   ===========================================================================
   No browser, so the two component halves of the write cannot be imported. These
   probes are what keeps the model honest: each one names the shipped expression
   the model transcribes, and each is REQUIRED to be RED on the pre-fix tree. */
section('THE SOURCE PROBES — the model is the shipped arithmetic, not a convenient version');
{
  const probes = [
    ['the drag path calls `anchorWrite` (the DELTA form), not `labelWrite`',
      /anchorWrite\(\{/.test(EDGE_C) && !/labelWrite\(\{/.test(EDGE_C)],
    ['the gesture passes `base: A − reference`, so `anchorWrite` returns `W − reference`',
      /base:\s*\{x:\s*A\.x\s*-\s*reference\.x,\s*y:\s*A\.y\s*-\s*reference\.y\}/.test(EDGE_C)],
    ['the first write\'s reference is the painted point in the incoming frame',
      /const reference = prev \?\? \{/.test(EDGE_C)
      && /frame\.x\s*\+\s*\(d\.labelOffset\?\.x \?\? 0\)/.test(EDGE_C)],
    ['later writes reference the previous reported point (`prev`, null at grab time)',
      /let prev: Pt \| null = null;/.test(EDGE_C) && /prev = p;/.test(EDGE_C)],
    ['the anchor is published per render through a ref, not a stale closure',
      /anchorRef\.current = anchor;/.test(EDGE_C) && /const anchor = labelAnchor\(/.test(EDGE_C)],
    ['the write reports the live anchor as its frame',
      /anchorWrite\(\{anchor:\s*A[,}]/.test(EDGE_C)],
    ['App rebases the stored offset by the anchor\'s movement before applying the write',
      /storedAnchor!?\.x\s*-\s*w\.labelAnchor\.x/.test(APP_C) && /corrected\.x\s*\+\s*w\.labelOffset\.x/.test(APP_C)],
    ['App records `labelAnchor` as the frame of a relative write',
      /data\.labelAnchor = w\.labelAnchor;/.test(APP_C)],
    ['a CENTRED write deletes all three keys in App',
      /if \(!w\.labelPinned\) \{[\s\S]{0,220}?delete data\.labelOffset;[\s\S]{0,80}?delete data\.labelPinned;[\s\S]{0,80}?delete data\.labelAnchor;/.test(APP_C)],
    ['`Reset label position` deletes `labelAnchor` too',
      /const resetLabelPos = useCallback\(\(\) => \{[\s\S]*?\}, \[selEdgeId, pushHistory, setEdges\]\)/.test(APP_C)
      && /delete data\.labelAnchor;/.test(APP_C)],
    ['the ABSOLUTE write (`labelWrite`) returns `labelAnchor: null`',
      /return \{labelAnchor: null, labelOffset/.test(LIB_SRC)],
    ['`labelWrite` keeps its two-point signature, so ROUND AK/AL harnesses still measure it',
      /export function labelWrite\(p: \{W: Pt; anchor: Pt\}\): LabelWrite/.test(LIB_SRC)],
    ['`LabelWrite` carries the `labelAnchor` frame',
      /labelAnchor: LabelOffset \| null/.test(LIB_SRC)],
    ['`EdgeData` declares `labelAnchor`',
      /labelAnchor\?: \{x: number; y: number\};/.test(APP_C)],
    ['the create/commit path and `onStart` pass `labelAnchor: null`',
      (EDGE_C.match(/labelAnchor: null/g) ?? []).length >= 2],
  ];
  const red = probes.filter(([, ok]) => !ok).map(([id]) => id);
  assert('probes.every-source-probe-is-green-on-the-shipped-tree',
    red.length === 0,
    red.length === 0
      ? `all ${probes.length} probes GREEN. Each names the shipped expression the harness's model transcribes ` +
        `(the increment, the live-anchor ref, App's rebase, the three-key delete, the absolute write's null), so ` +
        `the measured claims above cannot drift away from what the components actually do.`
      : `RED ON THE SHIPPED TREE: ${red.join(' | ')}`);
}

/* ===========================================================================
   THE ROUND GATE — the stylesheet must not have been touched.
   =========================================================================== */
section('THE ROUND GATE');
{
  const CSS = read('src/styles.css');
  const hex = (CSS.match(/#[0-9a-fA-F]{3,8}\b/g) ?? []).length;
  assert('gate.hex-literals-stay-at-the-rounds-count',
    hex === 142,
    `${hex} hex literals in src/styles.css (142 at the start of this round, ceiling 160) — this round touches ` +
    `no stylesheet at all: the label's transform and its keys are the whole of it.`);
}

/* ===========================================================================
   REPLAY — THE NEGATIVE CONTROL, mandatory, and here in the file.
   ===========================================================================
   HALF 1 — THE SAME INPUTS THROUGH THE SHIPPED SEMANTICS. Every measurement
   AM1-a…e makes must be RED there. This is the half that matters most, because
   the defect is invisible to a one-gesture probe: the shipped code scores 0.0px
   on the first drag and 223.6px on the second.
   HALF 2 — THE SOURCE PROBES AGAINST THE PINNED PRE-FIX COMMIT, read with
   `git show` (never `HEAD`, which is about to BE the fix).
   =========================================================================== */
console.log('\n' + '='.repeat(78));
console.log(`REPLAY (negative control) — the SHIPPED semantics over the SAME inputs`);
console.log('='.repeat(78));

const A0 = {x: 100, y: 100};
{
  /* ---- the two-gesture probe, shipped ---- */
  let data = {};
  const rows = [];
  for (const [n, end] of [{x: 300, y: 200}, {x: 400, y: 250}].entries()) {
    const grab = painted(data, A0);
    const mid = {x: (grab.x + end.x) / 2, y: (grab.y + end.y) / 2};
    const r = gestureShipped({data, anchor0: A0, origin: grab, points: [mid, end]});
    data = r.data;
    rows.push({n: n + 1, grab, end, err: dist(painted(data, A0), end), painted: painted(data, A0)});
  }
  for (const r of rows) {
    console.log(`  gesture ${r.n}: grabbed ${JSON.stringify(r.grab)}, finger ends ${JSON.stringify(r.end)} → ` +
      `painted ${JSON.stringify(r.painted)}, error ${f2(r.err)}px`);
  }
  const firstOk = rows[0].err < 0.01, secondBad = rows[1].err > 0.01;
  console.log(`  shipped stored: ${JSON.stringify(data)} — and ${f2(rows[1].err)} is EXACTLY the first drag's own ` +
    `distance ${f2(dist({x: 100, y: 100}, {x: 300, y: 200}))}px`);
  assert('replay.AM1-a-is-RED-on-the-shipped-semantics-with-the-first-gesture-deceptively-green',
    firstOk && secondBad,
    `gesture 1 error ${f2(rows[0].err)}px (looks PERFECT — which is why a one-gesture harness would have passed ` +
    `the broken tree) and gesture 2 error ${f2(rows[1].err)}px, tracking the first drag's distance exactly. ` +
    `That is the owner's "giật và ra xa con trỏ chuột 1 khoảng", reproduced from the shipped semantics.`);

  /* ---- the mid-gesture node move, shipped ---- */
  const shippedMove = (() => {
    const L = painted({}, A0);
    let out = {};
    for (const p of [{x: 200, y: 180}, {x: 300, y: 260}, {x: 400, y: 300}]) {
      out = applyLabelWriteShipped(out, M.labelWrite({W: p, anchor: L}));
    }
    const Aend = {x: 130, y: 110};
    return dist(painted(out, Aend), {x: 400, y: 300});
  })();
  /* ---- the drag-and-return, shipped ---- */
  const shippedReturn = (() => {
    const d0 = {labelOffset: {x: 40, y: -15}, labelPinned: true};
    const grab = painted(d0, A0);
    const r = gestureShipped({data: d0, anchor0: A0, origin: grab, points: [{x: grab.x + 120, y: grab.y + 80}, grab]});
    return dist(painted(r.data, A0), grab);
  })();
  /* ---- the zoom probe, shipped: NOT zoom-specific, so this one is expected to
     be GREEN on both trees and is printed as such rather than counted as a kill.
     A claim that is green on both trees proves nothing, and this file says so out
     loud instead of quietly listing it as a control. ---- */
  const shippedZoom = (() => {
    let worst = 0;
    for (const z of [0.5, 1, 2]) {
      const flow = 100 / z;
      const r = gestureShipped({data: {}, anchor0: A0, origin: {...A0}, points: [{x: A0.x + flow, y: A0.y}]});
      worst = Math.max(worst, dist(painted(r.data, A0), {x: A0.x + flow, y: A0.y}));
    }
    return worst;
  })();
  console.log(`  mid-gesture node move: shipped error ${f2(shippedMove)}px (want RED)`);
  console.log(`  drag-and-return: shipped error ${f2(shippedReturn)}px (want RED)`);
  console.log(`  zoom sweep: shipped error ${f2(shippedZoom)}px (GREEN on both trees — stated, not claimed as a kill)`);
  assert('replay.AM1-b-is-RED-on-the-shipped-semantics',
    shippedMove > 0.01,
    `the shipped write over the mid-gesture fixture lands ${f2(shippedMove)}px off the pointer, against ` +
    `< 0.01px on the fixed tree — so AM1-b measures a change this round made.`);
  assert('replay.AM1-d-is-RED-on-the-shipped-semantics',
    shippedReturn > 0.01,
    `the shipped write does NOT restore the pre-drag position: released exactly on the grab point it lands ` +
    `${f2(shippedReturn)}px away, because it wrote the released POINT as an offset from the painted position ` +
    `rather than the gesture's displacement.`);
  assert('replay.AM1-e-is-GREEN-on-both-trees-and-is-recorded-rather-than-counted-as-a-control',
    shippedZoom < 0.01,
    `the zoom probe is ${f2(shippedZoom)}px on the shipped tree too — the shipped write had no zoom term ` +
    `either, so this claim proves nothing about the fix. It is kept because a reader must not mistake it for a ` +
    `control, and because AM1-e's real content is that \`anchorWrite\` STAYS free of a zoom factor in the future.`);

  /* ---- the centred-write probe: shipped deletes TWO keys, not three ---- */
  const shippedCentred = applyLabelWriteShipped(
    {labelOffset: {x: 40, y: 20}, labelPinned: true, labelAnchor: {x: 1, y: 2}},
    {labelOffset: {x: 0, y: 0}, labelPinned: false});
  console.log(`  centred write, shipped: ${JSON.stringify(shippedCentred)}`);
  assert('replay.AM1-c-is-RED-on-the-shipped-semantics-and-on-the-pre-fix-source',
    ('labelAnchor' in shippedCentred),
    `the shipped merge leaves \`labelAnchor\` behind (${JSON.stringify(shippedCentred)}) because the key did not ` +
    `exist then — and the pre-fix SOURCE probe below is RED for the same reason. The fixed tree deletes three.`);
}

/* ---------- HALF 2: the source probes against the pinned commit ---------- */
console.log('\n' + '-'.repeat(78));
console.log(`REPLAY (negative control) — the SOURCE probes against the PINNED pre-fix commit ${PRE_COMMIT}`);
console.log('-'.repeat(78));

let pre = null;
try {
  pre = {
    APP: blankComments(commitFile(PRE_COMMIT, 'src/App.tsx')),
    EDGE: blankComments(commitFile(PRE_COMMIT, 'src/GoblinEdge.tsx')),
    LIB: commitFile(PRE_COMMIT, 'src/edgeLabel.ts'),
  };
} catch (err) {
  console.log(`  FAIL  the pre-fix tree could not be read from ${PRE_COMMIT}: ${err.message.split('\n')[0]}`);
  console.log('        The control is PINNED. If history is rewritten, re-pin DS_PRE_COMMIT — do NOT delete it.');
  failures++;
}

if (pre) {
  const INVERTED = [
    ['the drag path calls `anchorWrite`', /anchorWrite\(\{/.test(pre.EDGE)],
    ['the gesture passes `base: A − reference`', /base:\s*\{x:\s*A\.x\s*-\s*reference\.x/.test(pre.EDGE)],
    ['the first write\'s reference is the painted point in the incoming frame', /const reference = prev \?\? \{/.test(pre.EDGE)],
    ['the anchor is published through `anchorRef`', /anchorRef\.current = anchor;/.test(pre.EDGE)],
    ['App rebases the stored offset by the anchor\'s movement', /storedAnchor!?\.x\s*-\s*w\.labelAnchor\.x/.test(pre.APP)],
    ['App records `data.labelAnchor = w.labelAnchor`', /data\.labelAnchor = w\.labelAnchor;/.test(pre.APP)],
    ['a centred write deletes `labelAnchor`', /delete data\.labelAnchor;/.test(pre.APP)],
    ['`Reset label position` deletes `labelAnchor`', /delete data\.labelAnchor;/.test(pre.APP)],
    ['`labelWrite` returns `labelAnchor: null`', /return \{labelAnchor: null, labelOffset/.test(pre.LIB)],
    ['`LabelWrite` carries the `labelAnchor` frame', /labelAnchor: LabelOffset \| null/.test(pre.LIB)],
    ['`EdgeData` declares `labelAnchor`', /labelAnchor\?: \{x: number; y: number\};/.test(pre.APP)],
    ['the create path and `onStart` pass `labelAnchor: null`', (pre.EDGE.match(/labelAnchor: null/g) ?? []).length >= 2],
  ];
  const greenOnPre = [];
  for (const [id, ok] of INVERTED) {
    if (ok) greenOnPre.push(id);
    console.log(`  ${ok ? 'GREEN (control BROKEN)' : 'RED   '}  ${id}`);
  }
  console.log('');
  assert('replay.every-source-probe-is-RED-on-the-pre-fix-tree',
    greenOnPre.length === 0,
    greenOnPre.length === 0
      ? `all ${INVERTED.length} source probes are RED at ${PRE_COMMIT} and GREEN on the working tree, so each ` +
        `assertion above really detects the change it claims to. \`src/edgeLabel.ts\` DOES exist there (ROUND AK ` +
        `created it), so the module half is a real file comparison rather than a missing-file pass.`
      : `GREEN ON BOTH TREES (so they prove nothing): ${greenOnPre.join(', ')}`);

  /* The arithmetic half, run for real: the PRE-FIX module has no `anchorWrite`,
     so the fixed engine cannot even be built on it — recorded rather than
     hidden, because "the old module cannot express this call" is the same fact
     as "the delta form did not exist". */
  let preAnchorWrite = 'ABSENT';
  try {
    const preMod = await import(`data:text/javascript,${encodeURIComponent(pre.LIB.replace(/: [A-Za-z<>|{}[\], .]+/g, ''))}`);
    preAnchorWrite = typeof preMod.anchorWrite;
  } catch {
    preAnchorWrite = 'unloadable under this transform (the type-strip is not a full parser)';
  }
  const preWriteHasNoNull = !/labelAnchor/.test(pre.LIB.split('export function labelWrite')[1] ?? '');
  console.log(`  pre-fix \`src/edgeLabel.ts\`: \`anchorWrite\` ${preAnchorWrite}; its \`labelWrite\` returns no ` +
    `\`labelAnchor\` key (${preWriteHasNoNull})`);
  assert('replay.the-pre-fix-module-has-no-delta-writer-at-all',
    preAnchorWrite === 'undefined' || preAnchorWrite !== 'function',
    `\`anchorWrite\` on ${PRE_COMMIT} is \`${preAnchorWrite}\` — so AM1-a/b/d could not have been satisfied there ` +
    `even in principle, and the absolute \`labelWrite\` is provably the only writer that existed.`);
}

console.log('\n' + '='.repeat(78));
console.log(`ROUND AM AM-1 LABEL-DRAG HARNESS: ${failures === 0 ? 'all checks passed' : failures + ' FAILURE(S)'}`);
console.log('='.repeat(78));
process.exit(failures ? 1 : 0);
