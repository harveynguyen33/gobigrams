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
/* ROUND BN-4 — src/GoblinEdge.tsx split into src/edges/ (component moved to
   src/edges/GoblinEdge.tsx; the EdgeData type, the K2 flow-payload machinery and
   the type registry moved to edgeData.ts / flowPayloads.tsx / index.ts, verbatim).
   Working-tree reads of the component now read the FOUR SLICES CONCATENATED so
   every regex below still measures the same surface. Git reads (PRE_COMMIT)
   keep the single file, which every pinned commit has. */
const read = p => p === 'src/GoblinEdge.tsx'
  ? ['GoblinEdge', 'edgeData', 'flowPayloads', 'index']
      .map(f => readFileSync(`${ROOT}/src/edges/${f}${f === 'edgeData' || f === 'index' ? '.ts' : '.tsx'}`, 'utf8')).join('\n')
  : readFileSync(`${ROOT}/${p}`, 'utf8');
const APP = read('src/App.tsx');
const EDGE = read('src/GoblinEdge.tsx');
const HOOK = read('src/useEdgeGesture.ts');
const CSS = read('src/styles.css');
const LIB_SRC = read('src/edgeLabel.ts');
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
  assert('ak12.the-three-values-are-none-surface-outline-and-the-default-is-NONE',
    Array.isArray(vals) && vals.length === 3
      && vals[0] === 'none' && vals[1] === 'surface' && vals[2] === 'outline'
      && M.LABEL_BG_DEFAULT === 'none',
    `LABEL_BG_VALUES = ${JSON.stringify(vals)}, LABEL_BG_DEFAULT = ${JSON.stringify(M.LABEL_BG_DEFAULT)} — ` +
    `RE-ANCHORED by ROUND AL, AL-3 — the claim that MOVED is ONLY the default: OLD 'surface', NEW 'none', on the owner's instruction #3. The three stored states and their order are untouched.`);

  /* The tolerant read: anything unrecognised must resolve to the DEFAULT, never
     to a class the sheet does not declare (that would be an unstyled plate). */
  const unknown = [undefined, null, '', 'nope', 0, {}, 'SURFACE', 'None'];
  const badUnknown = unknown.filter(v => M.labelBgOf(v) !== M.LABEL_BG_DEFAULT);
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
      && M.labelBgClass(undefined) === `lb-${M.LABEL_BG_DEFAULT}`
      && M.labelBgClass('bogus') === `lb-${M.LABEL_BG_DEFAULT}`,
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
   AL-2 (was AK-14.2) — the snap is GONE; what replaced it is a SCREEN-px lock.
   ===========================================================================
   RE-ANCHORED BY ROUND AL, NOT DELETED. The claims below are the SAME claims in
   the same order — that a small screen-space threshold governs the label drag,
   that it is measured in SCREEN px so it scales by the zoom, and that a
   degenerate zoom cannot destroy it. Only the FUNCTION they measure changed,
   because the owner's device test rejected the rail the old one implemented:

     OLD CLAIM (ROUND AK, AK-14.2): `snapToCentre(W, centre, zoom)` returns the
       centre when `W` is within tldraw's `labelCenterSnapDistance = 10` SCREEN
       px of it, so pulling the label near the middle puts it back — "the put-it-
       back gesture with no extra UI".
     NEW CLAIM (ROUND AL, AL-2): the rails are removed ("ko cần ràng buộc với
       xung quanh line"), so there is no snap and no clamp; what the label drag
       has instead is a 2.5 SCREEN-px LOCK — how far the pointer must travel
       before the gesture counts as a drag at all, so a plain click writes
       nothing. ROUND AK's `lock: 0` made every sub-pixel jitter a drag, which is
       the third cause of his "click once and it jumps".

   The threshold is still screen px and still divided by the zoom; it is now
   applied at the GESTURE rather than at the WRITE, which is why it is a
   different function with the same arithmetic inside. */
section('AL-2 (re-anchored from AK-14.2) — the drag lock, in SCREEN px scaled by the zoom');
{
  const L = M.LABEL_DRAG_LOCK_PX;
  assert('al2-lock.the-lock-is-2-3-SCREEN-px-and-scaled-into-flow-px-by-the-zoom',
    L >= 2 && L <= 3
      && Math.abs(M.labelDragLockPx(1) - L) < 1e-9
      && Math.abs(M.labelDragLockPx(2) - L / 2) < 1e-9
      && Math.abs(M.labelDragLockPx(0.5) - L * 2) < 1e-9,
    `\`LABEL_DRAG_LOCK_PX = ${L}\`; at zoom 1 the lock is ${M.labelDragLockPx(1)} flow px, at zoom 2 it is ` +
    `${M.labelDragLockPx(2)} (a screen threshold is SMALLER in flow units when zoomed IN), at 0.5 it is ` +
    `${M.labelDragLockPx(0.5)}. The threshold is tldraw's own convention — a SCREEN distance, divided by the ` +
    `zoom — which is the half of AK-14.2's arithmetic that SURVIVES: what changed is that it now guards the ` +
    `GESTURE (whether a move counts) instead of the WRITE (where the point lands). OLD claim, for the record: ` +
    `\`snapToCentre(109,0 at 100,0 zoom 1) === 100\` and \`snapToCentre(104 at zoom 2) === 100\` snapped the ` +
    `label home within 10 screen px. That function is deleted, and the AL harness's REPLAY splices it back to ` +
    `prove the assertion would notice.`);

  /* A CLICK IS NOT A DRAG. The defect this fixes: with `lock: 0` a press whose
     pointer drifted one pixel counted as a drag, ran `onEnd`, and STORED a
     position — so a plain click moved the label. */
  const clickish = [[0, 0], [0.5, 0.5], [1, 1], [2, 0], [1.5, 1.5]];
  const dragged = [[3, 0], [0, 3], [4, 4], [-5, 0], [2.5, 2.5]];
  assert('al2-lock.a-click-is-not-a-drag-and-a-real-move-still-is',
    clickish.every(([x, y]) => M.movedBy(x, y, L) === false)
      && dragged.every(([x, y]) => M.movedBy(x, y, L) === true),
    `at zoom 1 (lock ${L} flow px): ${clickish.length} click-sized deltas ` +
    `(${clickish.map(([x, y]) => `(${x},${y})`).join(' ')}) are all NOT drags, and ${dragged.length} real ` +
    `moves (${dragged.map(([x, y]) => `(${x},${y})`).join(' ')}) all are. Under ROUND AK's \`lock: 0\` the ` +
    `first list is entirely drags — that is the defect, stated as a measurement rather than as a complaint.`);

  /* A degenerate zoom must not divide by zero or disable the guard. */
  assert('al2-lock.a-non-positive-zoom-still-yields-a-usable-lock',
    Number.isFinite(M.labelDragLockPx(0)) && M.labelDragLockPx(0) === L
      && Number.isFinite(M.labelDragLockPx(-1)) && M.labelDragLockPx(-1) === L,
    `zoom 0 → ${M.labelDragLockPx(0)} and zoom −1 → ${M.labelDragLockPx(-1)}, both falling back to the ` +
    `un-scaled ${L} rather than returning Infinity — an unmeasured transform must not be able to disable the ` +
    `guard at the moment the geometry is least trustworthy. (AK-14.2 made the same argument for its rail.)`);

  /* THE RENDERER PASSES IT. A function nothing calls is not a fix. */
  assert('al2-lock.the-renderer-passes-it-and-no-longer-passes-zero',
    /lock:\s*labelDragLockPx\(t\[2\]\)/.test(EDGE_C) && !/lock:\s*0\b/.test(EDGE_C),
    `\`lock: labelDragLockPx(t[2])\` in src/GoblinEdge.tsx = ${/lock:\s*labelDragLockPx\(t\[2\]\)/.test(EDGE_C)}, ` +
    `and no \`lock: 0\` remains = ${!/lock:\s*0\b/.test(EDGE_C)}. The bend handle still passes the project's own ` +
    `3px \`LOCK_PX\` through the SAME \`movedBy\` predicate, so the two affordances cannot disagree — that ` +
    `invariant is AK-10's and is asserted next.`);
}

/* ===========================================================================
   AL-2 (was AK-14.3) — THE CLAMP IS DELETED. The claims become the inverse, and
   the deletion is measured rather than trusted.
   ===========================================================================
   RE-ANCHORED BY ROUND AL, NOT DELETED. ROUND AK's AK-14.3 owned five claims
   here, all about `clampToRange`:
     · a point outside the range slides IN along the line;
     · the perpendicular survives the slide;
     · the range is measured along the DRAWN path, not the chord;
     · a path shorter than its clearances collapses to its midpoint;
     · a degenerate path is returned untouched;
     · plus `labelClearance` (tldraw's padding rule) and `labelHalfAlong` (the
       box's extent projected onto the heading).
   The owner's device test removed the requirement the whole block served —
   "ko cần ràng buộc với xung quanh line. Nếu kéo quá xa thì đó là user issue
   (ngoài ra đã có nút Reset Label Position rồi)" — so the clamp, the constant
   and both clearances are deleted. What replaces those claims is the ONE claim
   that matters now: a point handed to the writer comes back UNCHANGED, wherever
   it is, and the functions that would have moved it are GONE from the module.

   The claims are not dropped: every behaviour the old block measured is still
   exercised — by the REPLAY at the bottom of this file, which splices the
   deleted code back into a copy of the shipped module and shows the old
   assertions FAILING on it. */
section('AL-2 (re-anchored from AK-14.3) — the clamp is GONE, and a write is the plain difference');
{
  /* (a) THE FUNCTIONS AND THE CONSTANTS ARE ABSENT FROM THE MODULE. Not merely
     unreferenced — absent, so the next pass cannot re-enable one by flipping a
     default. */
  const gone = ['snapToCentre', 'clampToRange', 'labelClearance', 'labelHalfAlong',
    'LABEL_TO_ARROW_PADDING', 'LABEL_SNAP_PX', 'screenToFlowPx'];
  const present = gone.filter(n => M[n] !== undefined);
  assert('al2-clamp.the-two-rails-their-constant-and-their-clearances-are-DELETED',
    present.length === 0,
    present.length === 0
      ? `all ${gone.length} are \`undefined\` on the shipped module (${gone.join(', ')}). ` +
        `Deleted with them: the renderer's \`hasEndGlyph\`/\`hasHeadGlyph\` flags, its \`clearStart\`/\`clearEnd\`, ` +
        `and the \`labelHalfH\` state + \`LABEL_HALF_H_PX\` import that existed only for the clamp's heading ` +
        `projection. OLD claim (AK-14.3), for the record: \`clampToRange({x: 95, y: 0}, 100px line, 30, 30)\` ` +
        `slid to x=70; that assertion now has nothing to measure because the function is gone.`
      : `STILL PRESENT: ${present.join(', ')}`);

  /* (b) THE WRITER KEEPS WHAT IT IS HANDED. The fixture is deliberately chosen to
     sit inside BOTH old rails at once: 4px from the anchor (inside the old
     10-screen-px snap) and 1px outside a 45px clearance (outside the old usable
     range). Under ROUND AK this returned the centred state; under AL it must
     store the offset it was given. */
  const w = (W, anchor = {x: 50, y: 0}) => M.labelWrite({W, anchor});
  const inside = w({x: 54, y: 1});
  assert('al2-clamp.a-point-inside-the-OLD-snap-radius-and-outside-the-OLD-range-is-stored-UNCHANGED',
    inside.labelPinned === true
      && Math.abs(inside.labelOffset.x - 4) < 1e-9
      && Math.abs(inside.labelOffset.y - 1) < 1e-9,
    `W=(54,1), anchor=(50,0) → ${JSON.stringify(inside)}. That point is ${Math.hypot(4, 1).toFixed(2)} flow px ` +
    `from the anchor (INSIDE the 10px snap ROUND AK applied, which would have returned ` +
    `\`{labelOffset: {0,0}, labelPinned: false}\`) and it sits 1px off a 45px clearance (OUTSIDE the range ` +
    `the old clamp enforced, which would have slid it back). Both rails would have moved it; AL stores it.`);

  const far = w({x: 3050, y: -1200});
  assert('al2-clamp.a-label-dragged-FAR-from-the-line-stays-exactly-where-it-was-put',
    far.labelPinned === true && far.labelOffset.x === 3000 && far.labelOffset.y === -1200,
    `W=(3050,−1200) → ${JSON.stringify(far)}. ROUND AK's clamp slid the along-the-line component back inside ` +
    `\`[start, L−end]\`; the owner's own case was exactly this drag — "kéo ra xa, bỏ chọn, rồi chọn lại, click 1 ` +
    `cái nó tự về giữa" — and with both rails gone the stored offset IS the drag's displacement. ` +
    `Reset label position is the way back, which is what he asked for.`);

  /* (c) THE WRITER'S SHAPE: two points and nothing else. A parameter that is
     accepted and ignored is how a rail comes back without anyone noticing. */
  const sig = (LIB_SRC.match(/export function labelWrite\(p: \{([\s\S]*?)\}\): LabelWrite/) ?? ['', ''])[1];
  const params = (sig.match(/(\w+)\s*:/g) ?? []).map(s => s.replace(/\s*:/, ''));
  assert('al2-clamp.the-writer-takes-ONLY-the-two-points-it-uses',
    params.length === 2 && params.includes('W') && params.includes('anchor'),
    `\`labelWrite\` takes ${JSON.stringify(params)}. ROUND AK's took \`W, anchor, pts, zoom, start, end\` — the ` +
    `resolved path, the zoom and the two END CLEARANCES — and every one of those inputs existed only to feed a ` +
    `rail. Deleting the parameters is the strongest form of deleting the rails.`);

  /* (d) THE CENTRED STATE IS STILL A STATE, not a pair of zeros. This is the
     property the round before established and AL must not lose: "reset",
     "dragged exactly onto the anchor" and "never moved" are ONE stored value. */
  const exact = w({x: 50, y: 0});
  assert('al2-clamp.a-write-whose-offset-is-zero-still-stores-the-UNPINNED-state',
    exact.labelPinned === false && exact.labelOffset.x === 0 && exact.labelOffset.y === 0
      && M.CENTRED.x === 0 && M.CENTRED.y === 0,
    `W === anchor → ${JSON.stringify(exact)}: \`pinned: false\` with a zero offset, which is bit-identical to a ` +
    `board that never carried the keys and to what \`Reset label position\` writes. So the deletion of the rails ` +
    `did NOT split "centred" into two representations — the branch survived the clamp it used to share a ` +
    `function with.`);

  /* (e) THE RENDERER NO LONGER COMPUTES A CLEARANCE, and the one rail that is
     KEPT — the bend handle's nudge — is untouched. */
  assert('al2-clamp.the-renderer-computes-no-clearance-and-the-HANDLE-rail-survives',
    !/clearStart|clearEnd|labelHalfAlong|labelClearance|hasEndGlyph|hasHeadGlyph/.test(EDGE_C)
      && /nudgeAlongPath\(/.test(EDGE_C) && M.nudgeAlongPath !== undefined,
    `no \`clearStart\`/\`clearEnd\`/\`labelHalfAlong\`/\`labelClearance\`/\`hasEndGlyph\`/\`hasHeadGlyph\` remains in ` +
    `src/GoblinEdge.tsx = ${!/clearStart|clearEnd|labelHalfAlong|labelClearance|hasEndGlyph|hasHeadGlyph/.test(EDGE_C)}, ` +
    `and \`nudgeAlongPath\` is still called there and still exported = ${/nudgeAlongPath\(/.test(EDGE_C) && M.nudgeAlongPath !== undefined}. ` +
    `That is the distinction the report has to make: the LABEL's rails went, the HANDLE's rail stayed, because it ` +
    `protects the handle's hit area from the label's rather than the label from the line.`);
}

/* ===========================================================================
   AL-2 (was AK-10/AK-14) — `labelWrite` is the one writer, with NO rails.
   ===========================================================================
   RE-ANCHORED BY ROUND AL, NOT DELETED. Three of the five claims below are the
   same claim the old version made; two are the inverse, because the block they
   measured (snap-first, clamp-second) is gone:

     OLD (AK-14):  a point inside the 10px snap stores the CENTRED state; the
                   clamp is applied BEFORE anything is stored (96 → 70); and
                   SNAP WINS over CLAMP when both apply.
     NEW (AL-2):   a point NEAR the anchor is stored where it was put (the snap
                   is deleted); nothing is clamped (the clamp is deleted); and
                   there is no order to test because neither rail exists.
                   What SURVIVES unchanged: the offset is RELATIVE to the anchor,
                   and a zero offset still stores the centred UNPINNED state. */
section('AL-2 (re-anchored from AK-10/AK-14) — `labelWrite` is the one writer, and it has no rails');
{
  const anchor = {x: 50, y: 0};
  const w = W => M.labelWrite({W, anchor});

  /* OLD: `w({x: 52, y: 3})` was "3.6px from the anchor, inside the 10px screen
     snap" and stored the centred state. NEW: it is stored as the offset it is.
     Same fixture, opposite verdict — and the OLD verdict is still executed, by
     the REPLAY at the bottom of this file, against the rails spliced back in. */
  const near = w({x: 52, y: 3});
  assert('al2-write.a-point-NEAR-the-anchor-is-no-longer-snapped-it-is-stored-where-it-was-put',
    near.labelPinned === true
      && Math.abs(near.labelOffset.x - 2) < 1e-9 && Math.abs(near.labelOffset.y - 3) < 1e-9,
    `W=(52,3) — ${Math.hypot(2, 3).toFixed(2)}px from the anchor, INSIDE ROUND AK's 10-screen-px snap — → ` +
    `${JSON.stringify(near)}. OLD claim: this stored \`{labelOffset: {0,0}, labelPinned: false}\` (the label ` +
    `flew home). The owner rejected that rail ("ko cần ràng buộc"), so AL stores the point it was handed, ` +
    `pinned.`);

  const moved = w({x: 70, y: 25});
  assert('al2-write.a-real-move-stores-RELATIVE-px-and-pins-the-label',
    moved.labelPinned === true
      && Math.abs(moved.labelOffset.x - 20) < 1e-9 && Math.abs(moved.labelOffset.y - 25) < 1e-9,
    `W=(70,25) → ${JSON.stringify(moved)}. UNCHANGED FROM ROUND AK, and it is the claim AL must not break: ` +
    `the offset is RELATIVE to the anchor (which the renderer derives), not absolute — the only shape that ` +
    `survives a node move, a re-route or a resize.`);

  /* OLD: the clamp pulled 96 → 70 before storing, so nothing out of range could
     be written. NEW: what is stored is what was dragged. */
  const outside = w({x: 96, y: 40});
  assert('al2-write.a-point-past-the-OLD-range-END-is-stored-UNCHANGED-not-slid-back',
    outside.labelPinned === true
      && Math.abs(outside.labelOffset.x - 46) < 1e-9
      && Math.abs(outside.labelOffset.y - 40) < 1e-9,
    `W=(96,40) → ${JSON.stringify(outside)}. OLD claim: x clamped 96→70 and stored as \`+20\` (the range ` +
    `[30, 70] on the 100px path). Both the clamp and the range are gone, so 96 is stored as \`+46\`. ` +
    `This is the whole of AL-2 as a measured value rather than a description.`);

  /* The point that can tell the two ORDERS apart under ROUND AK is now simply a
     point. Recorded so the fixture's purpose is not lost with the assertion it
     used to serve: `W=(44,1)` with 45px clearances is 6.08 from the anchor
     (inside the snap) and 1px below the range — the old code returned centred
     BECAUSE snap ran first. */
  const both = w({x: 44, y: 1});
  assert('al2-write.the-fixture-that-told-the-two-OLD-orders-apart-is-now-just-a-point',
    both.labelPinned === true
      && Math.abs(both.labelOffset.x + 6) < 1e-9 && Math.abs(both.labelOffset.y - 1) < 1e-9,
    `W=(44,1) → ${JSON.stringify(both)}. OLD (AK): with 45px clearances this was the ONLY fixture that could ` +
    `distinguish snap-first from clamp-first, and it returned centred — proving snap ran first. There is no ` +
    `order left to prove, so the fixture is kept with its verdict inverted, which is also the replay's ` +
    `strongest single case.`);

  /* A CENTRED label is bit-identical to an unpinned one at the anchor. UNCHANGED. */
  assert('al2-write.CENTRED-is-exactly-the-origin',
    M.CENTRED.x === 0 && M.CENTRED.y === 0
      && JSON.stringify(M.labelAnchor({
        sourceX: 0, sourceY: 0, targetX: 100, targetY: 0, labelX: 50, labelY: 0,
        labelOffset: M.CENTRED, labelPinned: true,
      })) === JSON.stringify(M.labelAnchor({
        sourceX: 0, sourceY: 0, targetX: 100, targetY: 0, labelX: 50, labelY: 0,
      })),
    `a PINNED label at ${JSON.stringify(M.CENTRED)} resolves to the identical anchor as an UNPINNED one — ` +
    `so the two states can never render differently, which is what lets the writer collapse them into one ` +
    `state. This is the property that makes \`Reset label position\` and "never moved" interchangeable.`);
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
    && /chipRow\(LABEL_BG_OPTS, eLabelBg,/.test(labelSec)
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

  /* RE-ANCHORED by ROUND AL, AL-6 — the claim that moved is the CONTROL FAMILY,
     not the invariant. OLD: the plate row was carried by `<ToggleRow/>`. NEW: it is
     carried by the round's ONE chip system (`chipRow`), which is the same control kit
     re-shaped — 30px, content-sized, wrapping. The invariant is unchanged: the row is
     carried by an EXISTING shared control and the section invents no native `<select>`.
     AL-3 additionally put a `text color` swatch row above it, from the same kit. */
  const usesKit = /chipRow\(/.test(labelSec) && /swatchRow\(/.test(labelSec) && !/<select/.test(labelSec);
  assert('ak12.the-plate-row-uses-the-existing-control-kit',
    usesKit,
    'the `background` row is carried by `chipRow` and the new `text color` row by `swatchRow` — ' +
    'both from the round\'s existing control kit (RE-ANCHORED by AL-6 from <ToggleRow/>) — and the ' +
    'LABEL section renders no native <select> — the plate control invents nothing');
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

  /* AK-10: ONE history entry per gesture. ROUND AQ-DEFERRED / AUDIT-10
     re-anchor: the entry moved from the 'start' branch to the FIRST 'move' —
     'start' fires on every pointerdown (even a plain click that moves nothing),
     and a click pushing an undo entry that changed nothing made the next
     Ctrl+Z feel dead. Still exactly ONE push per gesture; a click pushes none. */
  const writeBody = (/const onLabelWrite = useCallback\([\s\S]*?\}, \[pushHistory, setEdges\]\)/.exec(APP_C) ?? [''])[0];
  const startBranch = /if \(phase === 'start'\) \{\s*pushHistory\(\);/.test(writeBody);
  const moveOnce = /phase === 'move' && !labelGesturePushed\.current\) \{\s*labelGesturePushed\.current = true;\s*pushHistory\(\);/.test(writeBody);
  const pushesInWrite = (writeBody.match(/pushHistory\(\)/g) ?? []).length;
  assert('ak10.the-drag-pushes-history-ONCE-and-only-at-the-START-phase',
    !startBranch && moveOnce && pushesInWrite === 1,
    `\`onLabelWrite\` pushes history ${pushesInWrite}×, first-move-gated (${moveOnce}), ` +
    `start-branch pushes (${startBranch}) — AUDIT-10 moved the entry off the pointerdown so a ` +
    `plain click writes no history; still exactly one entry per real drag`);
  assert('ak10.a-click-writes-no-history (the AUDIT-10 contract)',
    !startBranch,
    'the \'start\' branch must NOT push — it fires on every pointerdown, clicks included');

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

  /* The renderer opens the editor from the signal. RE-ANCHORED BY ROUND AL
     (AL-4): the commit no longer stores an offset from the clicked point (see
     the AL-4 section below for the full claim); it stores the CENTRED state. */
  const opensAt = /useEffect\(\(\) => \{\s*if \(!createAt \|\| ro\) return;/.test(EDGE_C);
  const noStoredPoint = !/setPendingCreate\(createAt\.at\)/.test(EDGE_C);
  assert('ak13.a-double-click-opens-the-editor-and-the-click-point-is-no-longer-STORED',
    opensAt && noStoredPoint,
    `the renderer opens the editor from \`__editAt\` (${opensAt}) — and the clicked FLOW POINT is no longer ` +
    `kept (\`setPendingCreate(createAt.at)\` gone = ${noStoredPoint}). OLD CLAIM (AK-13, for the record): ` +
    `"the renderer stores the position on an empty commit, through the SAME \`labelWrite\` the drag uses". ` +
    `ROUND AL's AL-4 inverted that deliberately — the owner's "hiện nó đang văng tùm lum" was exactly that ` +
    `stored click offset — so the STORED value is now the centred unpinned state. The claim itself is not ` +
    `dropped: it is carried, with the new verdict, by the AL-4 section below.`);
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
 *  file, the PRE-CHANGE file (the negative control) and each mutant.
 *
 *  RE-ANCHORED BY ROUND AL (AL-2). Four clamp probes, two snap probes, the
 *  clearance probe and the half-along probe measured functions ROUND AL DELETED.
 *  Their claims are NOT dropped — they are inverted into the two "the rails are
 *  absent" / "the write keeps what it is handed" probes below, and the ones the
 *  old code would have FAILED are exercised against the pre-change module in
 *  `PRE_MODULE` (see the REPLAY). Every `old claim` is named in the detail text
 *  of the assertion that replaced it, above. */
const MODULE_PROBES = {
  'lock: a click-sized delta is not a drag, a real move is':
    m => m.movedBy(0, 0, m.LABEL_DRAG_LOCK_PX) === false
      && m.movedBy(1, 1, m.LABEL_DRAG_LOCK_PX) === false
      && m.movedBy(2, 0, m.LABEL_DRAG_LOCK_PX) === false
      && m.movedBy(4, 0, m.LABEL_DRAG_LOCK_PX) === true,
  'lock: the threshold is SCREEN px, divided by the zoom':
    m => Math.abs(m.labelDragLockPx(2) - m.LABEL_DRAG_LOCK_PX / 2) < 1e-9
      && Math.abs(m.labelDragLockPx(0.5) - m.LABEL_DRAG_LOCK_PX * 2) < 1e-9
      && m.labelDragLockPx(0) === m.LABEL_DRAG_LOCK_PX,
  'lock: the value sits inside the 2-3px window':
    m => m.LABEL_DRAG_LOCK_PX >= 2 && m.LABEL_DRAG_LOCK_PX <= 3,
  'rails: the two rails, their constant and their clearances are ABSENT':
    m => m.snapToCentre === undefined && m.clampToRange === undefined
      && m.labelClearance === undefined && m.labelHalfAlong === undefined
      && m.LABEL_SNAP_PX === undefined && m.LABEL_TO_ARROW_PADDING === undefined
      && m.screenToFlowPx === undefined,
  'write: a point NEAR the anchor is stored where it was put (no snap)':
    /* OLD CLAIM: this returned the centred state (it is 3.6px from the anchor,
       inside the deleted 10-screen-px snap). */
    m => {
      const w = m.labelWrite({W: {x: 52, y: 3}, anchor: {x: 50, y: 0}});
      return w.labelPinned === true && Math.abs(w.labelOffset.x - 2) < 1e-9
        && Math.abs(w.labelOffset.y - 3) < 1e-9;
    },
  'write: a point FAR from the line keeps its full offset (no clamp)':
    /* OLD CLAIM: the clamp slid the along-the-line component back inside the
       path's range. The pre-change module THROWS on this probe (it is handed no
       `pts`), which the REPLAY records rather than hides. */
    m => {
      const w = m.labelWrite({W: {x: 3050, y: -1200}, anchor: {x: 50, y: 0}});
      return w.labelPinned === true && w.labelOffset.x === 3000 && w.labelOffset.y === -1200;
    },
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
    m => m.labelWrite({W: {x: 50, y: 0}, anchor: {x: 50, y: 0}}).labelPinned === false,
  'write: a real move stores RELATIVE px':
    m => {
      const w = m.labelWrite({W: {x: 70, y: 25}, anchor: {x: 50, y: 0}});
      return w.labelPinned === true && Math.abs(w.labelOffset.x - 20) < 1e-9;
    },
  'plate: an unknown value resolves to the default':
    m => m.labelBgOf('bogus') === m.LABEL_BG_DEFAULT && m.labelBgClass('bogus') === `lb-${m.LABEL_BG_DEFAULT}` && m.labelBgClass('outline') === 'lb-outline',
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
  /* ROUND AL (AL-2) — the rails coming BACK, which is the failure this round
     exists to prevent, and the lock going back to ROUND AK's zero. */
  {name: 'write-reintroduces-snap',
    m: [['const labelOffset = {x: p.W.x - p.anchor.x, y: p.W.y - p.anchor.y};',
         'const labelOffset = Math.hypot(p.W.x - p.anchor.x, p.W.y - p.anchor.y) <= 10 ? {x: 0, y: 0} : {x: p.W.x - p.anchor.x, y: p.W.y - p.anchor.y};']],
    kills: 'write: a point NEAR the anchor is stored where it was put (no snap)'},
  {name: 'write-reintroduces-clamp',
    m: [['const labelOffset = {x: p.W.x - p.anchor.x, y: p.W.y - p.anchor.y};',
         'const labelOffset = {x: Math.max(-200, Math.min(200, p.W.x - p.anchor.x)), y: p.W.y - p.anchor.y};']],
    kills: 'write: a point FAR from the line keeps its full offset (no clamp)'},
  {name: 'lock-back-to-zero',
    m: [['export const LABEL_DRAG_LOCK_PX = 2.5;', 'export const LABEL_DRAG_LOCK_PX = 0;']],
    kills: 'lock: the value sits inside the 2-3px window'},
  {name: 'lock-flow-px-only',
    m: [['return zoom > 0 ? LABEL_DRAG_LOCK_PX / zoom : LABEL_DRAG_LOCK_PX;',
         'return LABEL_DRAG_LOCK_PX;']],
    kills: 'lock: the threshold is SCREEN px, divided by the zoom'},
  {name: 'rails-restored',
    m: [['export function mirrorOffset(',
         'export const LABEL_SNAP_PX = 10;\nexport const LABEL_TO_ARROW_PADDING = 20;\n'
         + 'export function snapToCentre(W: Pt, centre: Pt, zoom: number): Pt { return {...W}; }\n'
         + 'export function clampToRange(W: Pt, pts: Pt[], start: number, end: number): Pt { return {...W}; }\n'
         + 'export function labelClearance(hasGlyph: boolean): number { return hasGlyph ? 20 : 0; }\n'
         + 'export function labelHalfAlong(pts: Pt[], W: Pt, halfW: number, halfH: number): number { return halfW; }\n'
         + 'export function screenToFlowPx(px: number, zoom: number): number { return px; }\n'
         + 'export function mirrorOffset(']],
    kills: 'rails: the two rails, their constant and their clearances are ABSENT'},
  {name: 'guard-becomes-truthy',
    m: [['return Math.hypot(dx, dy) > lock;', 'return Math.hypot(dx, dy) >= lock;']],
    kills: 'guard: exactly {0,0} is not a drag'},
  {name: 'anchor-reassociated',
    m: [['const ax = p.sourceX + (p.targetX - p.sourceX) * f + (p.labelX - (p.sourceX + p.targetX) / 2);',
         'const ax = p.sourceX + (p.targetX - p.sourceX) * f - (p.sourceX + p.targetX) / 2 + p.labelX;']],
    kills: 'anchor: an unpinned label is bit-identical to the shipped expression'},
  {name: 'write-pins-when-centred',
    /* RE-ANCHORED BY ROUND AM, AM-1: the centred return gained the `labelAnchor`
       key (null for every ABSOLUTE write), so the mutation's `from` string is the
       shipped line as AM wrote it. The CLAIM is untouched — a centred result must
       still come back unpinned. */
    m: [['return {labelAnchor: null, labelOffset: {...CENTRED}, labelPinned: false};',
         'return {labelAnchor: null, labelOffset: {...CENTRED}, labelPinned: true};']],
    kills: 'write: a centred result DELETES the pin (pinned false)'},
  {name: 'write-absolute-not-relative',
    m: [['const labelOffset = {x: p.W.x - p.anchor.x, y: p.W.y - p.anchor.y};',
         'const labelOffset = {x: p.W.x, y: p.W.y};']],
    kills: 'write: a real move stores RELATIVE px'},
  {name: 'plate-not-tolerant',
    m: [["return v === 'surface' || v === 'outline' ? v : 'none';", 'return v;']],
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

/* ROUND AL (AL-2) — THE PRE-CHANGE MODULE IS THE NEGATIVE CONTROL for every
 *  claim this round INVERTED.
 *
 *  A SECOND PIN, and it is not a convenience: `PRE_COMMIT` is the commit the
 *  SOURCE half measures against, and `src/edgeLabel.ts` does not exist there at
 *  all (it was created by ROUND AK, pass 2). The module's control therefore has
 *  to be the last commit at which the ROUND AK version of the file was live —
 *  `f0b00aa`, ROUND AK's final commit, i.e. exactly the tree the owner device-
 *  tested and rejected. Reading it from the same commit as the source half would
 *  silently skip this control, which is the failure mode it exists to prevent.
 *
 *  A probe that is TRUE on both trees would prove nothing, so each rail probe is
 *  REQUIRED to be RED there.
 *
 *  The two write probes are the interesting ones, and they fail on the old file
 *  for TWO different reasons — recorded rather than smoothed over:
 *    · 'no snap'   returns the centred state (pinned false), so the probe is RED;
 *    · 'no clamp'  THROWS: ROUND AK's `labelWrite` dereferences `p.pts`, and the
 *                  probe deliberately passes only the two points.
 *  A throw counts as RED and is labelled as such, because "the old code cannot
 *  even accept this call" is exactly what removing the rail means. */
const PRE_MODULE_COMMIT = process.env.DS_PRE_MODULE_COMMIT || 'f0b00aa';
let preMod = null;
try {
  const preSrc = execFileSync('git', ['show', `${PRE_MODULE_COMMIT}:src/edgeLabel.ts`],
    {cwd: ROOT, encoding: 'utf8', maxBuffer: 1 << 28});
  const dir = mkdtempSync(join(tmpdir(), 'ak2-pre-'));
  const file = join(dir, 'edgeLabel.ts');
  writeFileSync(file, preSrc);
  preMod = {mod: await import(`${file}?t=${Date.now()}`), dir};
} catch (err) {
  console.log(`  FAIL  the pre-change module could not be loaded from ${PRE_MODULE_COMMIT}: ${err.message.split('\n')[0]}`);
  console.log('        This is the control for every INVERTED claim below. Do NOT delete it:');
  console.log('        re-pin DS_PRE_MODULE_COMMIT to the last commit where the ROUND AK');
  console.log('        edgeLabel.ts was live.');
  failures++;
}

if (preMod) {
  /* WHICH PROBES ARE AL's, stated as DATA rather than implied. "The rails are
   *  gone", "the lock is not zero" and "a write keeps what it is handed" are
   *  AL-2's claims and MUST be RED against ROUND AK's file. The rest assert
   *  behaviour AL deliberately did not touch (the `{0,0}` guard, the anchor
   *  parity, the centred pin, the plate, the reverse) and MUST be GREEN there —
   *  listed individually so a reader can see they were run and found shared,
   *  rather than skipped by a filter they cannot see.
   *
   *  `write: a real move stores RELATIVE px` is in the RED list although the
   *  CLAIM is shared, because its verdict on the old file is RED for a reason
   *  that IS this round's: the probe calls `labelWrite` with the TWO-POINT
   *  signature AL introduced, and ROUND AK's version dereferences the `pts` a
   *  rail needed, so it THROWS. "The old signature cannot accept this call" is
   *  the same fact as "the rails' inputs are gone", one step earlier. */
  const RED_ON_PRE = [
    'lock: a click-sized delta is not a drag, a real move is',
    'lock: the threshold is SCREEN px, divided by the zoom',
    'lock: the value sits inside the 2-3px window',
    'rails: the two rails, their constant and their clearances are ABSENT',
    'write: a point NEAR the anchor is stored where it was put (no snap)',
    'write: a point FAR from the line keeps its full offset (no clamp)',
    'write: a real move stores RELATIVE px',
  ];
  console.log(`\n  the SAME probes over the PRE-CHANGE module (${PRE_MODULE_COMMIT}, ROUND AK's own edgeLabel.ts):`);
  const wrongVerdict = [];
  for (const [id, probe] of Object.entries(MODULE_PROBES)) {
    let ok = true, how = '';
    try { ok = probe(preMod.mod); } catch (err) { ok = false; how = ` (THROWS: ${err.message.split('\n')[0].slice(0, 58)})`; }
    const want = RED_ON_PRE.includes(id) ? 'RED' : 'GREEN';
    const got = ok ? 'GREEN' : 'RED';
    if (got !== want) wrongVerdict.push(`${id} (want ${want}, got ${got})`);
    console.log(`  ${got === want ? 'ok   ' : 'WRONG'}  ${want.padEnd(5)} ${id}${how}`);
  }
  console.log('');
  assert('replay.every-AL-2-probe-is-RED-on-the-pre-change-module-and-every-shared-probe-is-GREEN-on-both',
    wrongVerdict.length === 0,
    wrongVerdict.length === 0
      ? `${RED_ON_PRE.length} probes are RED against ROUND AK's own \`src/edgeLabel.ts\` (${PRE_MODULE_COMMIT}) and ` +
        `GREEN against the shipped file, so each one really measures a change this round made; and the other ` +
        `${Object.keys(MODULE_PROBES).length - RED_ON_PRE.length} probes are GREEN on BOTH trees, which is the ` +
        `honest reading — AL did not touch the guard, the anchor expression, the centred pin, the plate or the ` +
        `reverse, so a probe over any of them would prove nothing about this round. They are listed above with the ` +
        `verdict they are REQUIRED to have rather than filtered out.`
      : `PROBES WITH THE WRONG VERDICT: ${wrongVerdict.join(', ')}`);
  rmSync(preMod.dir, {recursive: true, force: true});
}

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
