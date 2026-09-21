#!/usr/bin/env node
/**
 * ROUND AK, PASS 2 — the connection LABEL: the drag, the plate, the rails.
 *
 * WHAT THIS FILE IS. Unlike the pass-1 harness (a source-text probe), this one
 * EXECUTES the shipped pure functions. `src/edgeLabel.ts` was written React-free
 * and DOM-free for exactly this reason: Node can load it directly (Node 22 strips
 * the type annotations), so every claim below is a measured RETURN VALUE rather
 * than a substring that happens to be present. The few source-text assertions
 * that remain are the ones a return value cannot express — that a control exists,
 * that a class is declared in the sheet, that a rule was deleted.
 *
 * WHY THAT MATTERS HERE SPECIFICALLY. AK-14's snap/clamp/guard and AK-15's
 * mirror are arithmetic with edge cases (a path shorter than its own clearances,
 * a gesture of exactly the threshold, a fraction of `center`). A grep cannot tell
 * a correct `clampToRange` from one that inverts its range, and the previous pass
 * on this project has already paid for a "check that passes on both trees".
 *
 * THE NEGATIVE CONTROL IS MANDATORY AND IT IS IN THE FILE (the REPLAY at the
 * bottom). The project's rule: a check that passes on both trees proves nothing.
 * It is run two ways, because the two halves of this pass live in different
 * places:
 *   · the SOURCE half is replayed against the pinned pre-ROUND-AK commit
 *     (`DS_PRE_COMMIT`), read with `git show`;
 *   · the MODULE half cannot be — `src/edgeLabel.ts` did not exist at that
 *     commit at all, and a module that is absent is not a module that fails. So
 *     it is replayed against a deliberately BROKEN copy of the shipped module
 *     (built in a temp dir from the real one, with named mutations), which is a
 *     STRONGER control: it shows each assertion detecting the specific change it
 *     claims to, not merely the file's absence.
 *
 * WHAT IT CANNOT DO: it cannot see a browser. It cannot prove the label paints,
 * that a pointer drag feels right, or that the plate reads on a dark canvas —
 * those are the orchestrator's live pass. This file asserts the RULES and the
 * SOURCE.
 *
 * DS_ROOT overrides the project root.
 */
import {readFileSync, mkdtempSync, writeFileSync, rmSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {tmpdir} from 'node:os';
import {join} from 'node:path';

const ROOT = process.env.DS_ROOT || '/home/harvey/projects/tech-goblin/lab/diagram-studio';

/* The commit ROUND AK was built on — the tree the SOURCE half's negative control
 * measures against. PINNED, not `HEAD`: once this round is committed, `HEAD` IS
 * the fixed tree and a `HEAD`-based control would compare the fix with itself. */
const PRE_COMMIT = process.env.DS_PRE_COMMIT || '90edd6c22d76b185d09d01c7643ade3b9a191e79';

/* ---------- the assertion harness (house style) ---------- */
let failures = 0;
const assert = (name, ok, detail) => {
  if (ok) console.log(`  PASS  ${name}\n        ${detail}`);
  else { failures++; console.log(`  FAIL  ${name}\n        ${detail}`); }
};
const section = t => console.log(`\n${t}`);

/* ---------- the module under test, loaded for real ---------- */
/* The SHIPPED file, by path — no copy, no transform. Node 22's type-stripping
 * loads it as ESM (`package.json` is `"type": "module"`), so what runs here is
 * byte-for-byte what the app bundles. */
const M = await import(`${ROOT}/src/edgeLabel.ts`);

/* ---------- the source texts a few assertions need ---------- */
const read = p => readFileSync(`${ROOT}/${p}`, 'utf8');
const APP = read('src/App.tsx');
const EDGE = read('src/GoblinEdge.tsx');
const HOOK = read('src/useEdgeGesture.ts');
const CSS = read('src/styles.css');
const commitFile = (commit, p) =>
  execFileSync('git', ['show', `${commit}:${p}`], {cwd: ROOT, encoding: 'utf8', maxBuffer: 1 << 28});

/* Blank comments to spaces (length and newlines preserved, so line numbers stay
 * true). The pass leaves an explanatory comment where it deletes a control, and
 * those comments quote the very strings the checks below assert are gone — a raw
 * count would read a correct tree as a defect. */
const blankComments = s => s
  .replace(/\/\*[\s\S]*?\*\//g, m => m.replace(/[^\n]/g, ' '))
  .replace(/(^|[^:])\/\/[^\n]*/g, (m, p) => p + ' '.repeat(m.length - p.length));
const APP_C = blankComments(APP);
const EDGE_C = blankComments(EDGE);
const HOOK_C = blankComments(HOOK);
const CSS_C = blankComments(CSS);

/* ---------- the stylesheet, as rules ---------- */
const rulesOf = css => [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)]
  .map(m => ({sel: m[1].trim().replace(/\s+/g, ' '), body: m[2]}));
const declsOf = body => body.split(';').map(s => s.trim()).filter(Boolean).map(d => {
  const i = d.indexOf(':');
  return i < 0 ? {prop: d.toLowerCase(), value: ''} : {prop: d.slice(0, i).trim().toLowerCase(), value: d.slice(i + 1).trim()};
});
const rulesWhere = (css, parts) => rulesOf(css).filter(r => parts.every(p => r.sel.includes(p)));

/* ---------- the JSX slice for one inspector section ---------- */
/** The JSX literal handed to `secBody('<name>', …)` — from the marker to the NEXT
 *  `secBody(` call. Read from the comment-blanked source, so the slice is code
 *  and not the note beside it. */
const secBodyOf = (appCode, name) => {
  const i = appCode.indexOf(`secBody('${name}'`);
  const j = appCode.indexOf('secBody(', i + 10);
  return i < 0 ? '' : appCode.slice(i, j < 0 ? undefined : j);
};

console.log('='.repeat(78));
console.log('ROUND AK PASS 2 — the edge label: drag, plate, rails (AK-10 … AK-15)');
console.log('EXECUTES the shipped pure functions; a few source/stylesheet reads');
console.log('='.repeat(78));
console.log(`root: ${ROOT}`);
console.log(`node: ${process.version}`);

/* ===========================================================================
   AK-12 — the plate: three STORED states, and the class each renders as.
   =========================================================================== */
section('AK-12 — the label plate is THREE stored states, and each maps to a declared class');
{
  const vals = M.LABEL_BG_VALUES;
  assert('ak12.the-three-values-are-none-surface-outline-and-the-default-is-surface',
    Array.isArray(vals) && vals.length === 3
      && vals[0] === 'none' && vals[1] === 'surface' && vals[2] === 'outline'
      && M.LABEL_BG_DEFAULT === 'surface',
    `LABEL_BG_VALUES = ${JSON.stringify(vals)}, LABEL_BG_DEFAULT = ${JSON.stringify(M.LABEL_BG_DEFAULT)} — ` +
    `\`None\` is a GENUINE STORED VALUE (decision D2), not the absence of one, so it is listed`);

  /* The tolerant read: anything unrecognised must resolve to the DEFAULT, never
     to a class the sheet does not declare (that would be an unstyled plate). */
  const unknown = [undefined, null, '', 'nope', 0, {}, 'SURFACE', 'None'];
  const badUnknown = unknown.filter(v => M.labelBgOf(v) !== 'surface');
  assert('ak12.an-unknown-value-resolves-to-the-default-never-to-an-unstyled-plate',
    badUnknown.length === 0,
    `${unknown.length} unrecognised inputs (` +
    `${unknown.map(v => JSON.stringify(v)).join(', ')}) → ` +
    `every one resolves to \`surface\`; the resolver is ` +
    `${unknown.map(v => M.labelBgOf(v)).join('/')}`);

  /* The mapping, and the trap AK-12 names: a CLASS, not an SVG fill. */
  const map = vals.map(v => `${JSON.stringify(v)} → ${M.labelBgClass(v)}`);
  assert('ak12.every-value-maps-to-its-own-lb-class',
    vals.every(v => M.labelBgClass(v) === `lb-${v}`)
      && M.labelBgClass(undefined) === 'lb-surface'
      && M.labelBgClass('bogus') === 'lb-surface',
    `${map.join('  ·  ')}; unknown → ${M.labelBgClass('bogus')} — the CLASS is the mechanism ` +
    `(React Flow's \`labelBgStyle\` is EdgeText's SVG-<rect> API and this label is a DOM <div>)`);

  /* The check is not vacuous: the sheet must DECLARE all three classes, and the
     renderer must WRITE the class onto the element. */
  const declared = vals.filter(v => rulesWhere(CSS_C, [`.edge-label.lb-${v}`]).length > 0);
  const rendererWrites = /labelBgClass\(d\.labelBg\)/.test(EDGE_C);
  assert('ak12.all-three-classes-are-declared-in-the-sheet-and-the-renderer-writes-one',
    declared.length === 3 && rendererWrites,
    `${declared.length}/3 declared in src/styles.css (${declared.map(v => `.lb-${v}`).join(', ')}), ` +
    `renderer writes \`labelBgClass(d.labelBg)\` = ${rendererWrites}. ` +
    `Declarations: ${vals.map(v => {
      const r = rulesWhere(CSS_C, [`.edge-label.lb-${v}`])[0];
      return r ? `${r.sel} { ${declsOf(r.body).map(d => `${d.prop}: ${d.value}`).join('; ')} }` : `.lb-${v}: ABSENT`;
    }).join('  |  ')}`);

  /* No new hex in any of the three declarations — the round's hard rule. */
  const bgHex = vals.map(v => rulesWhere(CSS_C, [`.edge-label.lb-${v}`])[0])
    .filter(Boolean).flatMap(r => declsOf(r.body).filter(d => /#[0-9a-fA-F]{3,8}\b/.test(d.value)));
  assert('ak12.no-hex-enters-the-three-plate-declarations',
    bgHex.length === 0,
    bgHex.length === 0
      ? 'the three rules use only `transparent` (a keyword) and the existing `--surface` / `--border-strong` tokens'
      : `HEX FOUND: ${bgHex.map(d => `${d.prop}: ${d.value}`).join(', ')}`);
}

/* ===========================================================================
   AK-10 — the {0,0} guard, and the control that replaced the deleted preset.
   =========================================================================== */
section('AK-10 — the click-vs-drag guard, and ONE gesture for both affordances');
{
  assert('ak10.a-gesture-of-exactly-zero-delta-is-NOT-a-drag',
    M.movedBy(0, 0) === false,
    `movedBy(0, 0) = ${M.movedBy(0, 0)} — Sirius Web's own guard, which is what keeps a plain ` +
    `CLICK selecting the edge and a DOUBLE-click opening the editor`);

  const tiny = [[0, 0.5], [0.5, 0], [0.3, 0.3]];
  const real = [[1, 0], [0, 1], [3, 4], [-2, -2]];
  assert('ak10.any-non-zero-delta-is-a-drag-and-the-threshold-still-works',
    tiny.every(([x, y]) => M.movedBy(x, y) === true)
      && real.every(([x, y]) => M.movedBy(x, y) === true)
      && M.movedBy(3, 4, 3) === true && M.movedBy(1, 1, 3) === false
      && M.movedBy(3, 4, 5) === false,
    `lock=0 → every non-zero delta is a drag (${tiny.length + real.length} cases); ` +
    `lock=3 (the bend handle's own jitter threshold) → hypot(3,4)=5 > 3 is a drag and ` +
    `hypot(1,1)=1.41 is not, so the TWO affordances share one predicate and cannot disagree`);

  /* THE STRUCTURAL INVARIANT, read from the source: one claim latch, and BOTH
     handlers go through it. This is AK-11's first requirement, and it is the
     half of it a return value cannot express. */
  const claimUses = (HOOK_C.match(/claimed\.current/g) ?? []).length;
  const bends = (EDGE_C.match(/gestures\.claim\(/g) ?? []).length;
  const bothWrapped = /const onBendDown = gestures\.claim\(/.test(EDGE_C)
    && /const onLabelDown = gestures\.claim\(/.test(EDGE_C);
  assert('ak10-one-claim-latch-and-BOTH-handlers-go-through-it',
    claimUses >= 3 && bends === 2 && bothWrapped,
    `\`gestures.claim(\` wraps ${bends} handlers in GoblinEdge (onBendDown=${/const onBendDown = gestures\.claim\(/.test(EDGE_C)}, ` +
    `onLabelDown=${/const onLabelDown = gestures\.claim\(/.test(EDGE_C)}), and the latch is read/written ${claimUses}× in ` +
    `useEdgeGesture. The latch is per-COMPONENT-INSTANCE (per edge, which is the scope that matters) and is ` +
    `released on the next macrotask, after every pointerdown handler for that event has run. The two affordances ` +
    `are SEPARATE elements, so "only one fires" is not a free property of the DOM — this latch is what provides it.`);

  /* The label really is the drag target, and the label carries the writer. */
  const dragTarget = /onPointerDown=\{onLabelDown\}/.test(EDGE_C);
  const writerWired = /__onLabelWrite: onLabelWrite/.test(APP_C);
  assert('ak10.the-LABEL-element-is-the-drag-target-and-its-writer-is-threaded-per-edge',
    dragTarget && writerWired,
    `\`onPointerDown={onLabelDown}\` on the \`.edge-label\` div (${dragTarget}) — the Sirius Web model, ` +
    `"make the label itself the drag target", so the drag target and the text are ONE object and nothing ` +
    `can collide with the label's anchor. The writer reaches it through per-edge data like \`__onBend\` ` +
    `(\`__onLabelWrite\` threaded in rfEdges: ${writerWired}).`);
}

/* ===========================================================================
   AK-14.2 — snap to centre, and what "screen pixels" means under zoom.
   =========================================================================== */
section('AK-14.2 — snap-back-to-centre, in SCREEN px scaled by the zoom');
{
  const centre = {x: 100, y: 100};
  const z1 = M.snapToCentre({x: 109, y: 100}, centre, 1);
  const z1out = M.snapToCentre({x: 111, y: 100}, centre, 1);
  assert('ak14-snap.within-10-screen-px-of-centre-snaps-EXACTLY-to-centre',
    z1.x === 100 && z1.y === 100 && z1out.x === 111,
    `at zoom 1: a point 9px away → ${JSON.stringify(z1)} (snapped), 11px away → ${JSON.stringify(z1out)} ` +
    `(left alone). The threshold is tldraw's own \`labelCenterSnapDistance = 10\`, which is a SCREEN ` +
    `distance — see the zoom cases next.`);

  /* The threshold is SCREEN px, so the FLOW distance it tolerates SHRINKS as the
     zoom grows: 10px on screen is 5 flow px at zoom 2. This is the arithmetic
     tldraw's own `Vec.DistMin(next, def, snap / zoom)` performs, and getting it
     backwards would make the snap unusable when zoomed IN. */
  const at2 = M.snapToCentre({x: 104, y: 100}, centre, 2);
  const at2out = M.snapToCentre({x: 106, y: 100}, centre, 2);
  const at05 = M.snapToCentre({x: 119, y: 100}, centre, 0.5);
  assert('ak14-snap.the-threshold-is-SCREEN-px-so-it-shrinks-in-flow-units-as-zoom-grows',
    at2.x === 100 && at2out.x === 106 && at05.x === 100,
    `zoom 2: 4 flow px (8 screen) → ${JSON.stringify(at2)} snapped; 6 flow px (12 screen) → ` +
    `${JSON.stringify(at2out)} not snapped. zoom 0.5: 19 flow px (9.5 screen) → ${JSON.stringify(at05)} ` +
    `snapped — which is the case a flow-space-only threshold would get wrong.`);

  /* A degenerate zoom must not divide by zero or disable the rail. */
  assert('ak14-snap.a-non-positive-zoom-still-yields-a-usable-rail',
    M.snapToCentre({x: 100, y: 100}, centre, 0).x === 100
      && M.snapToCentre({x: 200, y: 200}, centre, 0).x === 200,
    `zoom 0 is treated as zoom 1 (\`${M.screenToFlowPx(10, 0)}\` flow px) rather than producing NaN — ` +
    `an unmeasured transform must not be able to destroy the snap`);
}

/* ===========================================================================
   AK-14.3 — the clamp: along the INK, and never under an arrowhead.
   =========================================================================== */
section('AK-14.3 — the clamp runs along the path and reserves the glyph ends');
{
  /* A 100px horizontal line, clearances of 30 at each end: the usable range is
     [30, 70].

     EVERY EXPECTED VALUE BELOW IS MEASURED (`node` probe against the shipped
     module), not derived: the first draft of this section asserted what the
     clamp "should" do and was wrong on the beyond-the-end cases. */
  const line = [{x: 0, y: 0}, {x: 100, y: 0}];
  const cases = [
    [[10, 0], 30],   // projects INSIDE the path, before the range → slides in
    [[0, 0], 30],    // exactly the start → slides in
    [[95, 0], 70],   // projects inside, after the range → slides back
    [[50, 0], 50],   // already inside the range → returned UNCHANGED
    [[35, 0], 35],
  ];
  const got = cases.map(([W]) => M.clampToRange({x: W[0], y: W[1]}, line, 30, 30));
  const ok = got.every((p, i) => Math.abs(p.x - cases[i][1]) < 1e-9);
  assert('ak14-clamp.a-point-outside-the-range-slides-IN-ALONG-the-line',
    ok,
    got.map((p, i) => `W=(${cases[i][0]})→x=${p.x}`).join('  ') +
    ` — the range is [start, L−end] = [30, 70] on a 100px path, and a point ALREADY inside it ` +
    `(50, 35) is returned unchanged (a clamp that always moved the label would be worse than none)`);

  /* THE PERPENDICULAR SURVIVES. This is the whole point of a FREE 2-D drag: a
     label moved OFF the line must STAY off it while the clamp slides it along.
     Both directions are covered — one pulled in from before the range, one from
     after it. */
  const offLow = M.clampToRange({x: 10, y: 40}, line, 30, 30);
  const offHigh = M.clampToRange({x: 95, y: 40}, line, 30, 30);
  assert('ak14-clamp.a-label-moved-OFF-the-line-keeps-its-perpendicular-while-being-slid',
    Math.abs(offLow.x - 30) < 1e-9 && Math.abs(offLow.y - 40) < 1e-9
      && Math.abs(offHigh.x - 70) < 1e-9 && Math.abs(offHigh.y - 40) < 1e-9,
    `W=(10,40) → ${JSON.stringify(offLow)} and W=(95,40) → ${JSON.stringify(offHigh)}: x is clamped ` +
    `to the range in both directions while y is held at 40. The clamp is therefore a move ALONG the ` +
    `line only — it can never pull a deliberately offset label back onto the ink.`);

  /* ALONG THE INK, NOT THE CHORD: a bent path's arc length is longer than the
     straight distance between its ends, so a clamp that measured the chord would
     let the label run past the real end of the drawn line. */
  const bent = [{x: 0, y: 0}, {x: 0, y: 100}, {x: 100, y: 100}];
  const bentLen = M.pathLength(bent);
  const nearEnd = M.clampToRange({x: 90, y: 90}, bent, 30, 30);
  assert('ak14-clamp.the-range-is-measured-along-the-DRAWN-path-not-the-chord',
    Math.abs(bentLen - 200) < 1e-9
      && Math.abs(nearEnd.x - 70) < 1e-9 && Math.abs(nearEnd.y - 90) < 1e-9,
    `an L-shaped path is ${bentLen}px of ink but only 141.4px end-to-end; clamping (90, 90) gives ` +
    `${JSON.stringify(nearEnd)} — the arc-length position is pulled from 190 to ${bentLen - 30} (the ` +
    `range's far end) and the point's own 10px of perpendicular is carried through, so it lands at ` +
    `(70, 90) rather than at the corner. A chord-based range would have allowed ${bentLen - 141.4}px ` +
    `more travel.`);

  /* A path SHORTER than its own clearances must collapse to its midpoint rather
     than invert the range (which would send the label off the far end). */
  const short = [{x: 0, y: 0}, {x: 20, y: 0}];
  const collapsed = M.clampToRange({x: 19, y: 0}, short, 30, 30);
  const collapsed2 = M.clampToRange({x: 1, y: 0}, short, 30, 30);
  assert('ak14-clamp.a-path-shorter-than-its-own-clearances-collapses-to-its-midpoint',
    Math.abs(collapsed.x - 10) < 1e-9 && Math.abs(collapsed2.x - 10) < 1e-9,
    `a 20px path with 30px of clearance at each end has NO usable range, so 30+30 >= 20 collapses to ` +
    `L/2: (19,0) → ${JSON.stringify(collapsed)}, (1,0) → ${JSON.stringify(collapsed2)}. Inverting the ` +
    `range instead would clamp 30+30 down to an EMPTY interval (\`Math.min(L−end, len)\` goes negative) ` +
    `and emit an end-of-path point.`);

  /* A degenerate path must be returned untouched, never NaN. */
  const degenerate = M.clampToRange({x: 5, y: 5}, [], 30, 30);
  const onePoint = M.clampToRange({x: 5, y: 5}, [{x: 9, y: 9}], 30, 30);
  const zeroLen = M.clampToRange({x: 5, y: 5}, [{x: 1, y: 1}, {x: 1, y: 1}], 30, 30);
  assert('ak14-clamp.a-degenerate-path-is-returned-untouched-and-never-NaN',
    JSON.stringify(degenerate) === '{"x":5,"y":5}'
      && JSON.stringify(onePoint) === '{"x":5,"y":5}'
      && JSON.stringify(zeroLen) === '{"x":5,"y":5}',
    `0 points → ${JSON.stringify(degenerate)}, 1 point → ${JSON.stringify(onePoint)}, ` +
    `coincident points (0 length) → ${JSON.stringify(zeroLen)} — all returned unchanged, ` +
    `so a path the parser could not read cannot inject NaN into the stored offset`);

  /* THE BEYOND-THE-END CASE, CHARACTERISED HONESTLY.

     The docblock promises the label "may never sit under an arrowhead and may
     never run off an end". Measured: that holds for any `W` whose projection
     lands ON the polyline — which is every case a drag produces ON or NEAR the
     line. It does NOT hold for a `W` dragged beyond an end: `nearestOnPath`
     clamps the projection to the segment, so the whole overhang comes back as
     `perp` and is re-added to the clamped point.

       W=(200,0) → (170,0)   [30 → the range's end 70, plus the 100px overhang]

     This is a property of the SHIPPED module (its decomposition cannot separate
     "along" from "across" for a point that lies on the line's own axis), the
     round is a WIRING round, and the formula was frozen by the brief — so it is
     RECORDED here rather than silently repaired. It is stated as the behaviour
     it is, not as a wish. */
  const beyond = M.clampToRange({x: 200, y: 0}, line, 30, 30);
  const beyondNear = M.clampToRange({x: 130, y: 0}, line, 30, 30);
  assert('ak14-clamp.a-point-BEYOND-the-path-end-keeps-its-overhang-(known-limitation)',
    Math.abs(beyondNear.x - 100) < 1e-9 && Math.abs(beyond.x - 170) < 1e-9,
    `W=(130,0) → ${JSON.stringify(beyondNear)} and W=(200,0) → ${JSON.stringify(beyond)}. ` +
    `The clamp pulls the ARC-LENGTH position to the range's end (70) in both cases, but the vector from ` +
    `the clamped projection point back to W is restored as the perpendicular, so a point dragged past ` +
    `the end by d still lands d past it. The arrowhead clearance the range buys is therefore fully ` +
    `effective for any label on the ink (the drag's normal case) and degrades for an overhang. ` +
    `FLAGGED, not silently fixed: repairing it means changing a formula this round froze.`);

  /* `labelClearance` is tldraw's rule: padding on a glyph end, ZERO on a bare one.
     The mapping matters: the caller passes `hasEndGlyph` for the START clearance
     and `hasHeadGlyph` for the END one (AK-5 renamed the controls, the storage
     keys did not move). */
  assert('ak14-clearance.a-glyph-end-reserves-padding-and-a-bare-end-reserves-NONE',
    M.labelClearance(true) === M.LABEL_TO_ARROW_PADDING
      && M.labelClearance(false) === 0
      && M.LABEL_TO_ARROW_PADDING === 20,
    `labelClearance(true) = ${M.labelClearance(true)}, labelClearance(false) = ${M.labelClearance(false)} — ` +
    `tldraw's own rule (\`hasStartArrowhead ? range.start : 0\`), at tldraw's own constant. ` +
    `It is NOT stroke-scaled, and that is checkable: every marker here is a fixed size.`);

  /* The box's own half-extent ALONG the line — the clamp reserves the BOX, not
     the label's centre, so the edge of the text clears the arrowhead. */
  const alongHoriz = M.labelHalfAlong(line, {x: 50, y: 0}, 30, 8);
  const alongVert = M.labelHalfAlong([{x: 0, y: 0}, {x: 0, y: 100}], {x: 0, y: 50}, 30, 8);
  const alongDiag = M.labelHalfAlong([{x: 0, y: 0}, {x: 100, y: 100}], {x: 50, y: 50}, 30, 8);
  assert('ak14-clearance.the-label-BOX-is-projected-onto-the-heading-it-sits-on',
    Math.abs(alongHoriz - 30) < 1e-9
      && Math.abs(alongVert - 8) < 1e-9
      && Math.abs(alongDiag - 38 / Math.SQRT2) < 1e-9,
    `a 60×16 box (halfW 30, halfH 8) on a HORIZONTAL heading → ${alongHoriz.toFixed(3)} (the half-WIDTH); ` +
    `on a VERTICAL heading → ${alongVert.toFixed(3)} (the half-HEIGHT); on a 45° heading → ` +
    `${alongDiag.toFixed(3)} (the support function |cos|·hw + |sin|·hh = ${(38 / Math.SQRT2).toFixed(3)}). ` +
    `One number could not have stood for both extents, which is why the renderer measures a BOX.`);
}

/* ===========================================================================
   AK-10 — labelWrite: the ONE function a drag goes through. Snap FIRST, clamp
   SECOND, and "centred" is a state rather than a pair of zeros.
   =========================================================================== */
section('AK-10/AK-14 — `labelWrite` is the one writer, and it returns a STATE not a point');
{
  const line = [{x: 0, y: 0}, {x: 100, y: 0}];
  const anchor = {x: 50, y: 0};
  const w = (W, zoom = 1, start = 30, end = 30) =>
    M.labelWrite({W, anchor, pts: line, zoom, start, end});

  const centred = w({x: 52, y: 3});   // 3.6px from the anchor, inside the 10px screen snap
  assert('ak10-write.a-point-inside-the-snap-radius-stores-the-CENTRED-state',
    centred.labelPinned === false
      && centred.labelOffset.x === 0 && centred.labelOffset.y === 0,
    `W=(52,3) (3.6px from the anchor, inside the 10px snap) → ${JSON.stringify(centred)}. ` +
    `\`pinned: false\` + a zero offset is the state a board that NEVER carried the keys renders, ` +
    `so "snapped back", "Reset label position" and "never moved" are ONE stored state.`);

  const moved = w({x: 70, y: 25});
  assert('ak10-write.a-real-move-stores-RELATIVE-px-and-pins-the-label',
    moved.labelPinned === true
      && Math.abs(moved.labelOffset.x - 20) < 1e-9 && Math.abs(moved.labelOffset.y - 25) < 1e-9,
    `W=(70,25) → ${JSON.stringify(moved)}. RELATIVE to the anchor (which the renderer derives), ` +
    `not absolute: that is the only shape that survives a node move, a re-route or a resize.`);

  const clamped = w({x: 96, y: 40});
  assert('ak10-write.the-clamp-is-applied-BEFORE-anything-is-stored',
    clamped.labelPinned === true
      && Math.abs(clamped.labelOffset.x - 20) < 1e-9
      && Math.abs(clamped.labelOffset.y - 40) < 1e-9,
    `W=(96,40) → ${JSON.stringify(clamped)}: x clamped 96→70 (the range's far end) then expressed as ` +
    `a +20 offset, y held at 40. What is STORED is therefore always inside the usable range — the ` +
    `clamp is a write-time rail, and the spec's "zero new fields" holds because it needs no state.`);

  /* THE ORDER: snap then clamp. This needs a point that is SIMULTANEOUSLY inside
     the snap radius and outside the usable range, which on the default fixtures
     is impossible — the anchor is the range's centre and the snap radius (10) is
     far smaller than the range's half-width (20). So the fixture is tightened:
     with 45px of clearance at each end the range is [45, 55], and W=(44,1) is
     6.08 from the anchor (50,0) — inside the snap — while sitting 1px BELOW the
     range. Measured, and it is the only shape of input that can tell the two
     orders apart. */
  const both = M.labelWrite({
    W: {x: 44, y: 1}, anchor: {x: 50, y: 0}, pts: line, zoom: 1, start: 45, end: 45,
  });
  assert('ak10-write.SNAP-wins-over-CLAMP-when-both-apply',
    both.labelPinned === false
      && both.labelOffset.x === 0 && both.labelOffset.y === 0,
    `range [45,55], snap radius 10 screen px, anchor (50,0). W=(44,1) is 6.08 from the anchor ` +
    `(INSIDE the snap) and 44 < 45 (OUTSIDE the range). Stored: ${JSON.stringify(both)}. ` +
    `If the clamp ran FIRST, x would be pulled to 45 and stored as a pinned −5 offset — the snap ` +
    `would LOSE exactly where it is most wanted. Snap-first is therefore load-bearing rather than ` +
    `stylistic, and this is the case that measures it.`);

  /* A CENTRED label is bit-identical to an unpinned one at the anchor. */
  assert('ak10-write.CENTRED-is-exactly-the-origin',
    M.CENTRED.x === 0 && M.CENTRED.y === 0
      && JSON.stringify(M.labelAnchor({
        sourceX: 0, sourceY: 0, targetX: 100, targetY: 0, labelX: 50, labelY: 0,
        labelOffset: M.CENTRED, labelPinned: true,
      })) === JSON.stringify(M.labelAnchor({
        sourceX: 0, sourceY: 0, targetX: 100, targetY: 0, labelX: 50, labelY: 0,
      })),
    `a PINNED label at ${JSON.stringify(M.CENTRED)} resolves to the identical anchor as an UNPINNED one ` +
    `— so the two states can never render differently, which is what lets the writer collapse them`);
}

/* ===========================================================================
   AK-10 — labelAnchor parity: an untouched board must not move by a pixel.
   =========================================================================== */
section('AK-10 — `labelAnchor` reproduces the shipped expression operation for operation');
{
  /* The shipped expression, quoted from the pre-change renderer, re-implemented
     here as the reference the new function must match EXACTLY (not closely).

       const f = {center: 0.5, start: 0.25, end: 0.75}[d.offset ?? 'center'];
       const lx = sourceX + (targetX - sourceX) * f + (labelX - (sourceX + targetX) / 2);
       const ly = sourceY + (targetY - sourceY) * f + (labelY - (sourceY + targetY) / 2); */
  const PRE_OFFSETS = {center: 0.5, start: 0.25, end: 0.75};
  const reference = ({sourceX, sourceY, targetX, targetY, labelX, labelY, offset}) => {
    const f = PRE_OFFSETS[offset ?? 'center'];
    return {
      x: sourceX + (targetX - sourceX) * f + (labelX - (sourceX + targetX) / 2),
      y: sourceY + (targetY - sourceY) * f + (labelY - (sourceY + targetY) / 2),
    };
  };
  const cases = [
    {sourceX: 0, sourceY: 0, targetX: 100, targetY: 100, labelX: 50, labelY: 50},
    {sourceX: 12.5, sourceY: -3.25, targetX: 187.75, targetY: 96.125, labelX: 100.25, labelY: 46.4375},
    {sourceX: 1, sourceY: 2, targetX: 3, targetY: 4, labelX: 7, labelY: 9},
  ];
  const offsets = [undefined, 'center', 'start', 'end'];
  let worst = 0, worstCase = null;
  for (const c of cases) {
    for (const offset of offsets) {
      const want = reference({...c, offset});
      const got = M.labelAnchor({...c, offset});
      /* BIT-FOR-BIT, not a tolerance: the claim is "the identical number", and a
         tolerance would pass a re-associated expression that drifts at the ulp. */
      const d = Math.abs(got.x - want.x) + Math.abs(got.y - want.y);
      if (d > worst) { worst = d; worstCase = {c, offset, want, got}; }
    }
  }
  assert('ak10-anchor.an-untouched-label-resolves-to-the-BIT-IDENTICAL-point',
    worst === 0,
    `${cases.length} geometries × ${offsets.length} offset values (including an ABSENT one) all ` +
    `reproduce the shipped expression exactly — worst disagreement ${worst}` +
    (worst === 0 ? ` (bit-for-bit, so no board on disk moves by a pixel)` : `: ${JSON.stringify(worstCase)}`));

  /* And the ONLY new term is the offset, reachable only once pinned. */
  const pinned = M.labelAnchor({
    sourceX: 0, sourceY: 0, targetX: 100, targetY: 100, labelX: 50, labelY: 50,
    labelOffset: {x: 7, y: -3}, labelPinned: true,
  });
  const unpinnedSame = M.labelAnchor({
    sourceX: 0, sourceY: 0, targetX: 100, targetY: 100, labelX: 50, labelY: 50,
    labelOffset: {x: 7, y: -3}, labelPinned: false,
  });
  assert('ak10-anchor.the-offset-is-applied-only-once-PINNED',
    pinned.x === 57 && pinned.y === 47 && unpinnedSame.x === 50 && unpinnedSame.y === 50,
    `a stored {7,−3} with \`labelPinned: true\` → ${JSON.stringify(pinned)}; the SAME offset with ` +
    `\`labelPinned: false\` → ${JSON.stringify(unpinnedSame)}. \`labelPinned\` is therefore load-bearing ` +
    `rather than decorative — it is what keeps an auto-centred label centred`);
}

/* ===========================================================================
   AK-14.3 — the handle is nudged clear, and the nudge is honest about failure.
   =========================================================================== */
section('AK-14.3/AK-11 — `nudgeAlongPath` moves the handle off the label');
{
  const line = [{x: 0, y: 0}, {x: 100, y: 0}];
  const out = M.nudgeAlongPath({x: 50, y: 0}, line, 20);
  assert('ak14-nudge.the-handle-moves-ALONG-the-line-by-the-requested-amount',
    Math.abs(out.x - 70) < 1e-9 && Math.abs(out.y) < 1e-9,
    `the anchor (50,0) nudged by 20 → ${JSON.stringify(out)} — toward the TARGET end first, because ` +
    `the path is stored source→target, which is why the sign is positive rather than arbitrary`);

  /* At the far end there is no room forward, so it walks BACKWARD — the fallback
     is what keeps the handle on the line near a short edge's end. */
  const back = M.nudgeAlongPath({x: 95, y: 0}, line, 20);
  assert('ak14-nudge.at-the-far-end-it-falls-BACK-toward-the-source',
    Math.abs(back.x - 75) < 1e-9,
    `(95,0) nudged by 20: 100−95 = 5 < 20 has no room forward, so it walks back to ${back.x}`);

  /* No room in EITHER direction: return W unchanged rather than emitting a
     bogus point off the end. The label's own hit region, painted above, then
     keeps the priority — see the AK-11 note in the component. */
  const tight = M.nudgeAlongPath({x: 10, y: 0}, [{x: 0, y: 0}, {x: 15, y: 0}], 20);
  assert('ak14-nudge.a-path-with-no-room-in-either-direction-returns-W-unchanged',
    Math.abs(tight.x - 10) < 1e-9 && Math.abs(tight.y) < 1e-9,
    `a 15px path, a 20px nudge → ${JSON.stringify(tight)}: unchanged. The nudge is a CONVENIENCE ` +
    `(it separates the two tap rings); the correctness guarantee is the claim latch, not this.`);

  assert('ak14-nudge.a-non-positive-nudge-or-degenerate-path-is-a-no-op',
    JSON.stringify(M.nudgeAlongPath({x: 5, y: 5}, line, 0)) === '{"x":5,"y":5}'
      && JSON.stringify(M.nudgeAlongPath({x: 5, y: 5}, [], 20)) === '{"x":5,"y":5}',
    `by=0 and an empty path both return W unchanged, so the handle can never be displaced by ` +
    `a degenerate input`);
}

/* ===========================================================================
   AK-15 — reverse: ends and labels swap, the path does not.
   =========================================================================== */
section('AK-15 — `reverseEdgePatch` swaps the ends, the handles, and mirrors the fraction');
{
  const full = M.reverseEdgePatch({
    source: 'a', target: 'b', sourceHandle: 'right', targetHandle: 'left',
    data: {offset: 'start'},
  });
  assert('ak15.the-patch-swaps-both-ends-and-their-handles',
    full.source === 'b' && full.target === 'a'
      && full.sourceHandle === 'left' && full.targetHandle === 'right',
    `${JSON.stringify(full)} — the handles travel with their nodes, so swapping the ends WITHOUT them ` +
    `would attach the line to the wrong face of each box (an ERD handle names a COLUMN)`);

  /* `o → 1 − o` is expressed as a MIRROR of the stored word: start ↔ end, and
     centre is its own inverse. This is the claim "your labels swap with the
     ends" — a label a quarter of the way along stays a quarter of the way along. */
  const mirror = ['start', 'end', 'center', undefined]
    .map(o => `${JSON.stringify(o)} → ${JSON.stringify(M.mirrorOffset(o))}`);
  assert('ak15.the-label-fraction-is-mirrored-o-1-o-and-centre-is-its-own-inverse',
    M.mirrorOffset('start') === 'end' && M.mirrorOffset('end') === 'start'
      && M.mirrorOffset('center') === 'center' && M.mirrorOffset(undefined) === undefined
      && M.reverseEdgePatch({source: 'a', target: 'b', data: {offset: 'start'}}).data.offset === 'end'
      && M.reverseEdgePatch({source: 'a', target: 'b', data: {offset: 'end'}}).data.offset === 'start'
      && M.reverseEdgePatch({source: 'a', target: 'b', data: {offset: 'center'}}).data.offset === 'center',
    `${mirror.join('  ·  ')} — written as a mirror of the stored WORD, not arithmetic on 0.25/0.75, ` +
    `because \`OFFSET_FRACTION\` is the only place the two representations may meet`);

  /* An absent value stays absent: reversing must not ADD a key to a document. */
  const absent = M.reverseEdgePatch({source: 'a', target: 'b'});
  const noHandle = M.reverseEdgePatch({source: 'a', target: 'b', data: {offset: undefined}});
  assert('ak15.reversing-an-edge-that-carried-no-fraction-does-not-ADD-one',
    absent.data === undefined && noHandle.data === undefined
      && JSON.stringify(Object.keys(absent).sort()) === '["source","target"]',
    `an edge with no \`data.offset\` produces ${JSON.stringify(absent)} — only the two ends. ` +
    `Reversing therefore cannot grow a document that never used the legacy field.`);

  /* The patch returns ONLY the keys it owns — the merge contract `App` relies on
     (and the reason `replaceData` must stay false). */
  const withSiblings = M.reverseEdgePatch({
    source: 'a', target: 'b',
    data: {offset: 'start', strokeKey: 'amber', bendX: 12, bendY: 34, labelBg: 'outline', flow: 'dots'},
  });
  assert('ak15.the-patch-carries-ONLY-the-keys-it-owns-so-a-merge-cannot-drop-a-sibling',
    JSON.stringify(Object.keys(withSiblings.data)) === '["offset"]',
    `given data with ${5} unrelated keys, the patch's data half is ${JSON.stringify(withSiblings.data)} — ` +
    `just \`offset\`. \`App\` merges it (\`{...e.data, ...patch.data}\`), so strokeKey / bendX / bendY / ` +
    `labelBg / flow survive by CONSTRUCTION rather than by a copy that could drift.`);

  /* The wiring: the panel calls it, and the merge is an explicit spread — never
     `replaceData`. */
  const wired = /\breverseEdgeDir\b/.test(APP_C)
    && /reverseEdgePatch\(cur as any\)/.test(APP_C)
    && /out\.data = \{\.\.\.\(\(e\.data \?\? \{\}\) as EdgeData\), \.\.\.data\}/.test(APP_C);
  assert('ak15.App-carries-the-handler-and-merges-the-data-half-explicitly',
    wired,
    `\`reverseEdgeDir\` exists and calls \`reverseEdgePatch\`; the data half is merged with a spread ` +
    `(${wired}) — NOT \`replaceData\`, which this project has already measured wiping the \`flow\` key ` +
    `when the count/speed controls used it`);
}

/* ===========================================================================
   THE PANEL — the three controls exist, and the deleted affordances stay gone.
   =========================================================================== */
section('AK-12/AK-14.1/AK-15 — the three controls are in the panel, in the right sections');
{
  const labelSec = secBodyOf(APP_C, 'label');
  const lineSec = secBodyOf(APP_C, 'line');

  const bgRow = /<label>background<\/label>/.test(labelSec)
    && /options=\{LABEL_BG_OPTS\}/.test(labelSec)
    && /data: \{labelBg: v/.test(labelSec);
  const resetBtn = /Reset label position/.test(labelSec) && /onClick=\{resetLabelPos\}/.test(labelSec);
  const reverseBtn = /Reverse line direction/.test(lineSec) && /onClick=\{\(\) => reverseEdgeDir\(/.test(lineSec);
  assert('ak12-14-15.the-background-row-the-reset-and-the-reverse-are-each-present-once',
    bgRow && resetBtn && reverseBtn,
    `\`background\` row with \`options={LABEL_BG_OPTS}\` in the LABEL section = ${bgRow}; ` +
    `\`Reset label position\` → \`resetLabelPos\` in LABEL = ${resetBtn}; ` +
    `\`Reverse line direction\` → \`reverseEdgeDir\` in LINE = ${reverseBtn}. ` +
    `The reset sits with the label (it moves the label) and the reverse with the line (it re-points the path) — ` +
    `which is also where draw.io ships it, in Arrange.`);

  /* The control KIT, not a new control: still `ToggleRow`, and still zero native
   * selects anywhere in the panel region. */
  const usesKit = /<ToggleRow/.test(labelSec) && !/<select/.test(labelSec);
  assert('ak12.the-plate-row-uses-the-existing-control-kit',
    usesKit,
    `the \`background\` row is carried by \`<ToggleRow/>\` (the existing segmented row) and the LABEL ` +
    `section renders no native \`<select>\` — the plate control invents nothing`);

  /* The label table's entries really are the canonical list, so the button text
     cannot drift from the stored value. */
  assert('ak12.the-option-table-is-built-from-the-canonical-value-list',
    /const LABEL_BG_OPTS: PickerOption\[\] = LABEL_BG_VALUES\.map/.test(APP_C),
    `\`LABEL_BG_OPTS\` is \`LABEL_BG_VALUES.map(…)\` — the SAME list \`labelBgClass\` resolves against, ` +
    `so a fourth state could not be added to one and forgotten in the other`);

  /* AK-14.1: exactly ONE history step, at the top of the handler. */
  const resetBody = (/const resetLabelPos = useCallback\(\(\) => \{[\s\S]*?\}, \[/.exec(APP_C) ?? [''])[0];
  const pushes = (resetBody.match(/pushHistory\(\)/g) ?? []).length;
  const deletesBoth = /delete data\.labelOffset/.test(resetBody) && /delete data\.labelPinned/.test(resetBody);
  assert('ak14-1.the-reset-is-ONE-history-step-and-clears-BOTH-keys',
    pushes === 1 && deletesBoth,
    `\`resetLabelPos\` pushes history ${pushes}× and deletes both \`labelOffset\` and \`labelPinned\` ` +
    `(${deletesBoth}) — ONE undo step, landing on the same state the snap-to-centre rail reaches`);

  /* AK-10: ONE history entry per gesture, at the START. */
  const writeBody = (/const onLabelWrite = useCallback\([\s\S]*?\}, \[pushHistory, setEdges\]\)/.exec(APP_C) ?? [''])[0];
  const startBranch = /if \(phase === 'start'\) \{\s*pushHistory\(\);/.test(writeBody);
  const pushesInWrite = (writeBody.match(/pushHistory\(\)/g) ?? []).length;
  assert('ak10.the-drag-pushes-history-ONCE-and-only-at-the-START-phase',
    startBranch && pushesInWrite === 1,
    `\`onLabelWrite\` pushes history ${pushesInWrite}× and it is inside the \`'start'\` branch ` +
    `(${startBranch}) — the convention every gesture in this file documents, and the mistake this ` +
    `project already paid for with the resize latch`);

  /* A CENTRED write DELETES the keys rather than storing zeros — which is what
     makes reset / snap / never-moved one state. */
  const collapses = /if \(!w\.labelPinned\) \{[\s\S]*?delete data\.labelOffset;[\s\S]*?delete data\.labelPinned;/.test(writeBody);
  assert('ak10.a-CENTRED-write-DELETES-the-keys-instead-of-storing-zeros',
    collapses,
    `the merge branch is mode-dependent (${collapses}): \`labelPinned: false\` removes both keys, so a ` +
    `board cannot accumulate a \`{0,0}\` offset that means nothing and three states stay one`);

  /* AK-13: the double-click on the path is wired, and it is React Flow's own
     group handler — the hit-test the spec asks for, owned by the library. */
  const dblWired = /onEdgeDoubleClick=\{onEdgeDoubleClick\}/.test(APP_C);
  const dblSignal = /__editAt: \{at, t: Date.now\(\)\}/.test(APP_C);
  const roNoOp = /const onEdgeDoubleClick = useCallback\(\(e: React\.MouseEvent, edge: Edge\) => \{\s*if \(readOnly/.test(APP_C);
  assert('ak13.a-double-click-on-the-edge-creates-a-label-at-that-point-and-is-a-no-op-in-review',
    dblWired && dblSignal && roNoOp,
    `\`<ReactFlow onEdgeDoubleClick={onEdgeDoubleClick}>\` = ${dblWired} (React Flow owns the edge GROUP, ` +
    `so the hit-test is its own \`pointer-events: visibleStroke\` — the rule the spec asks for, not a ` +
    `second copy of it); the signal is \`__editAt: {at, t: Date.now()}\` = ${dblSignal}; review mode ` +
    `returns before it = ${roNoOp}. The label's own double-click is caught FIRST, because the label is ` +
    `portalled into a sibling layer — that is draw.io's "not inside an existing label" exclusion, done by the DOM.`);

  /* The renderer opens the editor from the signal and stores the position on an
     empty commit. */
  const opensAt = /useEffect\(\(\) => \{\s*if \(!createAt \|\| ro\) return;/.test(EDGE_C)
    && /setPendingCreate\(createAt\.at\)/.test(EDGE_C);
  const commitsAt = /if \(pendingCreate\) \{[\s\S]*?labelWrite\(\{[\s\S]*?\}\), 'end'\)/.test(EDGE_C);
  assert('ak13.the-renderer-opens-the-editor-from-the-signal-and-stores-the-position-on-an-empty-commit',
    opensAt && commitsAt,
    `the renderer opens the editor from \`__editAt\` (${opensAt}) and, when the created label is left ` +
    `EMPTY, commits its position through the SAME \`labelWrite\` the drag uses (${commitsAt}) — so a ` +
    `created label and a dragged one cannot land in two different states`);
}

/* ===========================================================================
   THE TOUCH RULE — no hover is required by any of it.
   =========================================================================== */
section('AK-10/AK-12 — every new affordance works without :hover');
{
  const hoverLabel = rulesWhere(CSS_C, ['.edge-label:hover']);
  assert('ak.there-is-no-hover-only-rule-on-the-label',
    hoverLabel.length === 0,
    hoverLabel.length === 0
      ? `no \`.edge-label:hover\` rule survives in the sheet — the affordance is the \`:active\` state ` +
        `(driven by the POINTER BEING DOWN, which a finger produces) plus the \`title\`, and the drag ` +
        `target is the label's own \`::after\` ring`
      : `STILL PRESENT: ${hoverLabel.map(r => `${r.sel} { ${r.body.trim()} }`).join(' | ')}`);

  const rule = /\.edge-label \{([^}]*)\}/.exec(CSS_C);
  const touchAction = rule
    ? declsOf(rule[1]).some(d => d.prop === 'touch-action' && d.value === 'none')
    : false;
  const baseRuleDecls = rule ? declsOf(rule[1]) : [];
  const grabCursor = baseRuleDecls.some(d => d.prop === 'cursor' && d.value === 'grab');
  const tapRing = /\.edge-label::after \{/.test(CSS_C);
  const activeCursor = rulesWhere(CSS_C, ['.edge-label:active']).length > 0;
  assert('ak.the-label-carries-touch-action-none-a-tap-ring-and-an-ACTIVE-cursor',
    touchAction && grabCursor && tapRing && activeCursor,
    `in the BASE \`.edge-label\` rule: \`touch-action: none\` = ${touchAction} (without it the browser's ` +
    `own pan wins the pointer on a touch device and the drag never starts) and \`cursor: grab\` = ` +
    `${grabCursor}; an \`::after\` ring = ${tapRing} (the \`.edge-bend-handle\` technique, so a finger ` +
    `has a target); an \`:active\` cursor = ${activeCursor} (pointer-down, not hover). The base rule is ` +
    `read by FIRST MATCH, and it must be the one that carries both — the state classes below it are ` +
    `(0,2,0) and could not supply a resting cursor. NONE of the four needs a hovering pointer.`);
}

/* ===========================================================================
   THE ROUND GATE.
   =========================================================================== */
section('THE ROUND GATE');
{
  const hex = (CSS.match(/#[0-9a-fA-F]{3,8}\b/g) ?? []).length;
  assert('gate.hex-literals-stay-within-the-rounds-ceiling',
    hex <= 160,
    `${hex} hex literals in src/styles.css against the round's ceiling of 160 (142 at the start of ` +
    `the round) — this pass adds none: the plate uses \`transparent\` and two existing tokens`);
}

/* ===========================================================================
   REPLAY — THE NEGATIVE CONTROL, mandatory, and here in the file.
   ===========================================================================
   Two halves, because this pass's claims live in two places:

     1. THE SOURCE HALF is replayed against the pinned pre-ROUND-AK commit. Each
        source-text probe below must be RED there.
     2. THE MODULE HALF cannot be replayed that way — `src/edgeLabel.ts` did not
        exist at that commit, and ABSENT is not RED. So the same `labelWrite` /
        `clampToRange` / `reverseEdgePatch` assertions are re-run against a
        deliberately BROKEN copy of the SHIPPED module, built in a temp dir with
        named single-line mutations. That is a stronger control than the commit
        replay: it shows each assertion detecting the specific change it claims
        to, rather than merely the file's absence.
   =========================================================================== */
console.log('\n' + '='.repeat(78));
console.log(`REPLAY (negative control) — over the PRE-CHANGE tree ${PRE_COMMIT}`);
console.log('='.repeat(78));

let pre = null;
try {
  pre = {
    APP: blankComments(commitFile(PRE_COMMIT, 'src/App.tsx')),
    EDGE: blankComments(commitFile(PRE_COMMIT, 'src/GoblinEdge.tsx')),
    CSS: blankComments(commitFile(PRE_COMMIT, 'src/styles.css')),
  };
} catch (err) {
  console.log(`  FAIL  the pre-change tree could not be read from ${PRE_COMMIT}: ${err.message}`);
  console.log('        The control is PINNED to the commit this round was built on. If history');
  console.log('        has been rewritten, re-pin DS_PRE_COMMIT — do NOT delete this section.');
  failures++;
}

if (pre) {
  const labelSecPre = secBodyOf(pre.APP, 'label');
  const lineSecPre = secBodyOf(pre.APP, 'line');

  /* Every probe must be FALSE (RED) on the pre-change tree. */
  const INVERTED = [
    ['the `background` plate row exists', () => /<label>background<\/label>/.test(labelSecPre) && /LABEL_BG_OPTS/.test(pre.APP)],
    ['`Reset label position` exists', () => /Reset label position/.test(labelSecPre)],
    ['`Reverse line direction` exists', () => /Reverse line direction/.test(lineSecPre)],
    ['the label is wired as a drag target', () => /onPointerDown=\{onLabelDown\}/.test(pre.EDGE)],
    ['the plate classes are declared in the sheet', () => /\.edge-label\.lb-/.test(pre.CSS)],
    ['the label carries touch-action', () => /\.edge-label \{[^}]*touch-action/.test(pre.CSS)],
    ['a double-click on the edge group is wired', () => /onEdgeDoubleClick=\{onEdgeDoubleClick\}/.test(pre.APP)],
    ['`reverseEdgePatch` is used by App', () => /\breverseEdgeDir\b/.test(pre.APP)],
    ['the label writer is threaded per-edge', () => /__onLabelWrite: onLabelWrite/.test(pre.APP)],
  ];
  const greenOnPre = [];
  for (const [id, probe] of INVERTED) {
    const ok = probe();
    if (ok) greenOnPre.push(id);
    console.log(`  ${ok ? 'GREEN (control BROKEN)' : 'RED   '}  ${id}`);
  }
  console.log('');
  assert('replay.every-source-probe-is-RED-on-the-pre-change-tree',
    greenOnPre.length === 0,
    greenOnPre.length === 0
      ? `all ${INVERTED.length} source probes are RED at ${PRE_COMMIT} and GREEN on the working tree — ` +
        `each assertion really detects the change it claims to`
      : `GREEN ON BOTH TREES (so it proves nothing): ${greenOnPre.join(', ')}`);

  /* And the module ABSENCE, named rather than implied, so the reader can see why
     the module half needed a different control. */
  let moduleAbsent = false;
  try { commitFile(PRE_COMMIT, 'src/edgeLabel.ts'); } catch { moduleAbsent = true; }
  console.log(`\n  src/edgeLabel.ts at ${PRE_COMMIT}: ${moduleAbsent ? 'ABSENT (the module half is replayed by MUTATION below, not by the commit)' : 'present'}`);
}

/* ---------- the mutation control for the MODULE half ---------- */
console.log('\n' + '-'.repeat(78));
console.log('REPLAY (negative control) — the MODULE half, by MUTATION of the shipped file');
console.log('-'.repeat(78));

const MODULE_SRC = readFileSync(`${ROOT}/src/edgeLabel.ts`, 'utf8');
/** Build a mutated copy of the module in a temp dir and load it. A `null`
 *  mutation list yields the UNMUTATED file, which is the paired GREEN. */
const loadMutant = async (name, mutations) => {
  const dir = mkdtempSync(join(tmpdir(), `ak2-${name}-`));
  let src = MODULE_SRC;
  for (const [from, to] of mutations) {
    if (!src.includes(from)) throw new Error(`mutation ${name} did not apply: ${from}`);
    src = src.replace(from, to);
  }
  const file = join(dir, 'edgeLabel.ts');
  writeFileSync(file, src);
  const mod = await import(`${file}?t=${Date.now()}`);
  return {mod, dir};
};

/** The probe set: each is (module) => boolean — TRUE means "this module obeys
 *  the rule". Written against a module so the SAME function runs over the shipped
 *  file and each mutant. */
const MODULE_PROBES = {
  'clamp: a point past the end slides back in':
    /* W=(95,0) projects INSIDE the path, at arc length 95, which is past the
       range's end (70) → pulled to 70. A mutant that ignores `end` leaves it at
       95. (The beyond-the-end case, W=(200,0)→(170,0), is deliberately NOT used
       here: it is a documented limitation of the shipped decomposition, not a
       rule.) */
    m => Math.abs(m.clampToRange({x: 95, y: 0}, [{x: 0, y: 0}, {x: 100, y: 0}], 30, 30).x - 70) < 1e-9,
  'clamp: a point before the range slides in':
    m => Math.abs(m.clampToRange({x: 10, y: 0}, [{x: 0, y: 0}, {x: 100, y: 0}], 30, 30).x - 30) < 1e-9,
  'clamp: the perpendicular survives':
    m => Math.abs(m.clampToRange({x: 95, y: 40}, [{x: 0, y: 0}, {x: 100, y: 0}], 30, 30).y - 40) < 1e-9,
  'clamp: a too-short path collapses to its midpoint':
    m => Math.abs(m.clampToRange({x: 19, y: 0}, [{x: 0, y: 0}, {x: 20, y: 0}], 30, 30).x - 10) < 1e-9,
  'snap: within 10 SCREEN px snaps exactly to centre':
    /* d is EXACTLY the threshold: 10 screen px at zoom 1, and 5 flow px at
       zoom 2. `<=` snaps; a `<` mutant leaves it alone. Measured, not assumed —
       a d=9 case is the same under both and would let the mutant through. */
    m => m.snapToCentre({x: 110, y: 100}, {x: 100, y: 100}, 1).x === 100
      && m.snapToCentre({x: 105, y: 100}, {x: 100, y: 100}, 2).x === 100,
  'snap: the threshold is scaled by the zoom':
    m => m.snapToCentre({x: 104, y: 100}, {x: 100, y: 100}, 2).x === 100
      && m.snapToCentre({x: 106, y: 100}, {x: 100, y: 100}, 2).x === 106,
  'guard: exactly {0,0} is not a drag':
    m => m.movedBy(0, 0) === false && m.movedBy(0.1, 0) === true,
  'anchor: an unpinned label is bit-identical to the shipped expression':
    /* Two geometries. The FIRST is an ordinary canvas and passes under any
       algebraically-equivalent spelling. The SECOND spans 1e-8…1e8, which is
       where floating-point REASSOCIATION actually bites: the shipped
       operation order yields 12345.678899995983 and the reassociated one
       12345.67889999255. Including it is what makes this probe able to detect a
       re-spelled expression at all — the claim is operation-for-operation
       parity, and only the wide case measures it. */
    m => {
      const cases = [
        {sourceX: 12.5, sourceY: -3.25, targetX: 187.75, targetY: 96.125, labelX: 100.25, labelY: 46.4375},
        {sourceX: 1e-8, sourceY: 0, targetX: 1e8, targetY: 0, labelX: 12345.6789, labelY: 0},
      ];
      return cases.every(p => {
        const f = 0.5;
        return m.labelAnchor(p).x === p.sourceX + (p.targetX - p.sourceX) * f + (p.labelX - (p.sourceX + p.targetX) / 2)
          && m.labelAnchor(p).y === p.sourceY + (p.targetY - p.sourceY) * f + (p.labelY - (p.sourceY + p.targetY) / 2);
      });
    },
  'write: a centred result DELETES the pin (pinned false)':
    m => m.labelWrite({
      W: {x: 52, y: 3}, anchor: {x: 50, y: 0}, pts: [{x: 0, y: 0}, {x: 100, y: 0}],
      zoom: 1, start: 30, end: 30,
    }).labelPinned === false,
  'write: a real move stores RELATIVE px':
    m => {
      const w = m.labelWrite({
        W: {x: 70, y: 25}, anchor: {x: 50, y: 0}, pts: [{x: 0, y: 0}, {x: 100, y: 0}],
        zoom: 1, start: 30, end: 30,
      });
      return w.labelPinned === true && Math.abs(w.labelOffset.x - 20) < 1e-9;
    },
  'clearance: a glyph end reserves padding, a bare end reserves none':
    m => m.labelClearance(true) === 20 && m.labelClearance(false) === 0,
  'half-along: the box is projected onto the heading':
    m => Math.abs(m.labelHalfAlong([{x: 0, y: 0}, {x: 0, y: 100}], {x: 0, y: 50}, 30, 8) - 8) < 1e-9,
  'plate: an unknown value resolves to the default':
    m => m.labelBgOf('bogus') === 'surface' && m.labelBgClass('bogus') === 'lb-surface'
      && m.labelBgClass('outline') === 'lb-outline',
  'reverse: the ends and handles swap, the fraction mirrors':
    m => {
      const p = m.reverseEdgePatch({source: 'a', target: 'b', sourceHandle: 'r', targetHandle: 'l', data: {offset: 'start'}});
      return p.source === 'b' && p.target === 'a' && p.sourceHandle === 'l'
        && p.targetHandle === 'r' && p.data.offset === 'end';
    },
};

/** A mutant per mutation, chosen so it breaks ONE specific assertion — and the
 *  probe that must go RED for it is named, so a mutation that happens to break
 *  nothing cannot pass as a control. Every `from` string is quoted VERBATIM from
 *  the shipped `src/edgeLabel.ts`; `loadMutant` throws if one does not apply, and
 *  that throw is itself reported (never swallowed) as a broken control. */
const MUTANTS = [
  {name: 'clamp-ignores-end',
    m: [['const s = start + end >= L ? L / 2 : Math.max(start, Math.min(L - end, len));',
         'const s = start + end >= L ? L / 2 : Math.max(start, len);']],
    kills: 'clamp: a point past the end slides back in'},
  {name: 'clamp-ignores-start',
    m: [['const s = start + end >= L ? L / 2 : Math.max(start, Math.min(L - end, len));',
         'const s = start + end >= L ? L / 2 : Math.min(L - end, len);']],
    kills: 'clamp: a point before the range slides in'},
  {name: 'clamp-drops-perp',
    m: [['return {x: p.x + perp.x, y: p.y + perp.y};',
         'return {x: p.x, y: p.y};']],
    kills: 'clamp: the perpendicular survives'},
  {name: 'clamp-inverts-range',
    m: [['const s = start + end >= L ? L / 2 : Math.max(start, Math.min(L - end, len));',
         'const s = Math.max(start, Math.min(L - end, len));']],
    kills: 'clamp: a too-short path collapses to its midpoint'},
  {name: 'snap-flow-px-only',
    m: [['Math.hypot(W.x - centre.x, W.y - centre.y) * z <= LABEL_SNAP_PX',
         'Math.hypot(W.x - centre.x, W.y - centre.y) <= LABEL_SNAP_PX']],
    kills: 'snap: the threshold is scaled by the zoom'},
  {name: 'snap-off-by-one-side',
    m: [['* z <= LABEL_SNAP_PX', '* z < LABEL_SNAP_PX']],
    kills: 'snap: within 10 SCREEN px snaps exactly to centre'},
  {name: 'guard-becomes-truthy',
    m: [['return Math.hypot(dx, dy) > lock;', 'return Math.hypot(dx, dy) >= lock;']],
    kills: 'guard: exactly {0,0} is not a drag'},
  {name: 'anchor-reassociated',
    m: [['const ax = p.sourceX + (p.targetX - p.sourceX) * f + (p.labelX - (p.sourceX + p.targetX) / 2);',
         'const ax = p.sourceX + (p.targetX - p.sourceX) * f - (p.sourceX + p.targetX) / 2 + p.labelX;']],
    kills: 'anchor: an unpinned label is bit-identical to the shipped expression'},
  {name: 'write-pins-when-centred',
    m: [['return {labelOffset: {...CENTRED}, labelPinned: false};',
         'return {labelOffset: {...CENTRED}, labelPinned: true};']],
    kills: 'write: a centred result DELETES the pin (pinned false)'},
  {name: 'write-absolute-not-relative',
    m: [['return {labelOffset: {x: W.x - p.anchor.x, y: W.y - p.anchor.y}, labelPinned: true};',
         'return {labelOffset: {x: W.x, y: W.y}, labelPinned: true};']],
    kills: 'write: a real move stores RELATIVE px'},
  {name: 'clearance-always-pads',
    m: [['return hasGlyph ? LABEL_TO_ARROW_PADDING : 0;', 'return LABEL_TO_ARROW_PADDING;']],
    kills: 'clearance: a glyph end reserves padding, a bare end reserves none'},
  {name: 'half-along-uses-width',
    m: [['return Math.abs(dir.x) * halfW + Math.abs(dir.y) * halfH;', 'return halfW;']],
    kills: 'half-along: the box is projected onto the heading'},
  {name: 'plate-not-tolerant',
    m: [["return v === 'none' || v === 'outline' ? v : 'surface';", 'return v;']],
    kills: 'plate: an unknown value resolves to the default'},
  {name: 'reverse-skips-handles',
    m: [['out.sourceHandle = e.targetHandle ?? null;', 'out.sourceHandle = e.sourceHandle ?? null;']],
    kills: 'reverse: the ends and handles swap, the fraction mirrors'},
  {name: 'reverse-ignores-fraction',
    m: [['const m = mirrorOffset(d.offset);', 'const m = d.offset;']],
    kills: 'reverse: the ends and handles swap, the fraction mirrors'},
];

/* The paired GREEN first: the UNMUTATED shipped module must pass every probe. */
const shipped = await loadMutant('shipped', []);
const shippedFails = Object.entries(MODULE_PROBES).filter(([, p]) => !p(shipped.mod)).map(([k]) => k);
assert('replay.the-shipped-module-passes-every-probe',
  shippedFails.length === 0,
  `${Object.keys(MODULE_PROBES).length} probes run against the SHIPPED src/edgeLabel.ts — ` +
  (shippedFails.length === 0 ? 'all GREEN, so a RED below is the mutation and not the harness'
    : `FAILING ON THE SHIPPED FILE: ${shippedFails.join(', ')}`));

/* Then each mutant must kill exactly the probe it names. */
let controlBroken = [];
for (const mut of MUTANTS) {
  let mod;
  try {
    ({mod} = await loadMutant(mut.name, mut.m));
  } catch (err) {
    controlBroken.push(`${mut.name} (mutation did not apply: ${err.message})`);
    continue;
  }
  const killed = !MODULE_PROBES[mut.kills](mod);
  console.log(`  ${killed ? 'RED   ' : 'GREEN (control BROKEN)'}  ${mut.name.padEnd(26)} kills: ${mut.kills}`);
  if (!killed) controlBroken.push(mut.name);
}
console.log('');
assert('replay.every-mutation-turns-the-assertion-it-names-RED',
  controlBroken.length === 0,
  controlBroken.length === 0
    ? `all ${MUTANTS.length} single-line mutations of the shipped module make their named probe FAIL while ` +
      `the unmutated file passes — so each assertion above detects the specific behaviour it claims, not ` +
      `merely the presence of the function`
    : `MUTATIONS THAT PROVED NOTHING: ${controlBroken.join(', ')}`);

/* The temp dirs are build artefacts — reported, not left behind silently. */
rmSync(shipped.dir, {recursive: true, force: true});
console.log(`\n  temp mutant dirs: ${MUTANTS.length + 1} created under ${tmpdir()}, ${shipped.dir.split('/').pop()} and siblings removed`);

console.log('\n' + '='.repeat(78));
console.log(`ROUND AK PASS 2 LABEL HARNESS: ${failures === 0 ? 'all checks passed' : failures + ' FAILURE(S)'}`);
console.log('='.repeat(78));
process.exit(failures ? 1 : 0);
