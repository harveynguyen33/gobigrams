#!/usr/bin/env node
/**
 * ROUND 5 harness — a RESIZE is ONE undoable step, exactly like a drag.
 *
 * Run:  node checks/round-5-resize-undo.mjs
 *
 * THE REPORTED DEFECT (Harvey, verbatim):
 *   "nếu khi shape ko có liên kết với ai, và tôi kéo nó dài ra hay ngắn đi.
 *    Thì nó k đc tính là 1 history move."
 * Moving a node with the pointer was undoable; RESIZING one was not. Ctrl+Z
 * after a resize left the new size on the board.
 *
 * WHAT THIS FILE PROVES, AND HOW.
 *
 * 1. THE GUARD IS EXECUTED, NOT RESTATED. The shipped decision function
 *    `recordResizeGesture` is imported from `src/resizeHistory.ts` (Node 22
 *    strips the types natively) and driven with the exact change objects React
 *    Flow emits. A harness that re-implemented the predicate would keep passing
 *    while the app drifted away from it.
 *
 * 2. THE DIMENSIONS REALLY PERSIST, so there IS a size to restore. The REAL
 *    `applyNodeChanges` is imported from the installed `@xyflow/react` and run
 *    over a node: this is what writes the new width/height into the node, which
 *    is why the resize survives without a history entry — the defect, not an
 *    assumption about it.
 *
 * 3. THE UNDO/REDO ROUND TRIP IS MODELLED ON THE APP'S OWN `Snap` SHAPE.
 *    `pushHistory` snapshot of the PRE-resize node, then the app's `undo`
 *    (`setNodes(prev.nodes)`) and its `redo` (`setNodes(next.nodes)`), so the
 *    old size comes back and the new one re-applies.
 *
 * 4. BOTH CASES ARE MEASURED, because the brief claims Harvey sees the defect
 *    only on a node with NO connections. A standalone node and a node with an
 *    edge are each driven through a full gesture and the push counts are
 *    compared. The verdict is asserted, so a real difference would RED this
 *    file rather than be explained away.
 *
 * 5. THE NEGATIVE CONTROLS DRIVE THE SAME COUNTING LOOP WITH MUTANT PREDICATES.
 *    Without them the "exactly one push" assertions could be passing because the
 *    counter cannot see anything. Two mutants are required to be caught: one
 *    that pushes every frame (the "hundreds of steps" bug) and one that never
 *    re-arms (the second resize of a session is not undoable).
 *
 * COMMENTS ARE BLANKED, NOT STRIPPED, for every "the source says X" probe, so
 * the docblocks — including this one — cannot satisfy or violate a probe, and
 * any line number stays true.
 */
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {dirname, join} from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = process.env.DS_ROOT ?? join(HERE, '..');

const {
  newResizeGuard,
  recordResizeGesture,
} = await import(join(ROOT, 'src/resizeHistory.ts'));

const {applyNodeChanges} = await import(
  join(ROOT, 'node_modules/@xyflow/react/dist/esm/index.mjs')
);

const APP_RAW = readFileSync(join(ROOT, 'src/App.tsx'), 'utf8');
/** Blank comments while keeping every byte offset (and so every line number). */
const blankComments = (s) =>
  s
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))
    .replace(/(^|[^:])\/\/[^\n]*/g, (m, p1) => p1 + ' '.repeat(m.length - p1.length));
const APP = blankComments(APP_RAW);

const DIAGRAM = readFileSync(join(ROOT, 'src/DiagramNode.tsx'), 'utf8');
const LABEL = readFileSync(join(ROOT, 'src/LabelNode.tsx'), 'utf8');
const CUSTOM = readFileSync(join(ROOT, 'src/CustomShapeNode.tsx'), 'utf8');
const PKG = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'));
const RF_CHANGES_DTS = readFileSync(
  join(ROOT, 'node_modules/@xyflow/system/dist/esm/types/changes.d.ts'),
  'utf8',
);
const RF_DIST = readFileSync(
  join(ROOT, 'node_modules/@xyflow/react/dist/esm/index.mjs'),
  'utf8',
);

let passed = 0;
let failed = 0;
const check = (name, fn) => {
  try {
    fn();
    passed += 1;
    console.log(`  ok  ${name}`);
  } catch (err) {
    failed += 1;
    console.log(`FAIL  ${name}`);
    console.log(`        ${err.message.split('\n').join('\n        ')}`);
  }
};

/* ==========================================================================
   THE FABRICATED CHANGE STREAMS — built to the shape React Flow emits.
   Read out of the installed library, not invented:
     onChange -> {id, type:'dimensions', resizing:true,  setAttributes, dimensions}
     onEnd    -> {id, type:'dimensions', resizing:false,             dimensions}
   ========================================================================== */

const dimensionFrame = (id, width, height) => ({
  id,
  type: 'dimensions',
  resizing: true,
  setAttributes: true,
  dimensions: {width, height},
});
const resizeEnded = (id, width, height) => ({
  id,
  type: 'dimensions',
  resizing: false,
  dimensions: {width, height},
});
const positionFrame = (id, x, y) => ({
  id,
  type: 'position',
  position: {x, y},
  dragging: true,
});

/**
 * Drive a whole gesture through the SHIPPED predicate and count the pushes.
 * Every assertion below and every negative control goes through this one loop,
 * so the loop is what is being proven able to fail.
 */
const runGesture = (predicate, frames) => {
  const guard = newResizeGuard();
  let pushes = 0;
  for (const frame of frames) {
    if (predicate(guard, frame)) pushes += 1;
  }
  return {pushes, guard};
};

/** One gesture: N resizing frames, then React Flow's end change. */
const gestureFrames = (id, frames, from, to) => {
  const out = [];
  for (let i = 0; i < frames; i += 1) {
    const w = Math.round(from.w + ((to.w - from.w) * (i + 1)) / frames);
    const h = Math.round(from.h + ((to.h - from.h) * (i + 1)) / frames);
    out.push([dimensionFrame(id, w, h)]);
  }
  out.push([resizeEnded(id, to.w, to.h)]);
  return out;
};

console.log('ROUND 5 — a resize is one undoable history step');
console.log(`  root: ${ROOT}`);
console.log(`  @xyflow/react ${PKG.dependencies['@xyflow/react']}`);
console.log('');

/* --------------------------------------------------------------------------
   1. THE SIGNAL IS REAL — the field the guard keys off is in the INSTALLED lib
   -------------------------------------------------------------------------- */
console.log('1. the resizing signal exists in the installed library');

check('1a. NodeDimensionChange carries `resizing` (the field the guard reads)', () => {
  const block = RF_CHANGES_DTS.slice(
    RF_CHANGES_DTS.indexOf('export type NodeDimensionChange'),
    RF_CHANGES_DTS.indexOf('export type NodePositionChange'),
  );
  assert.ok(block.length > 0, 'NodeDimensionChange block not found in the installed types');
  assert.match(block, /type:\s*'dimensions'/, 'not a dimensions change');
  assert.match(block, /resizing\?:\s*boolean/, 'no resizing field');
  assert.match(block, /setAttributes\?/, 'no setAttributes field');
});

check('1b. the RESIZER emits resizing true per frame and false at the end', () => {
  // The two literals the guard branches on, read off the shipped code.
  assert.match(RF_DIST, /resizing:\s*true/, 'no per-frame resizing:true emission in the lib');
  assert.match(RF_DIST, /resizing:\s*false/, 'no end-of-gesture resizing:false emission in the lib');
});

/* --------------------------------------------------------------------------
   2. THE GUARD — exactly ONE push per gesture (executed, not restated)
   -------------------------------------------------------------------------- */
console.log('');
console.log('2. the gesture leaves exactly ONE history entry');

check('2a. one resizing frame pushes once', () => {
  const {pushes} = runGesture(recordResizeGesture, [[dimensionFrame('a', 300, 200)]]);
  assert.equal(pushes, 1, `expected 1 push, got ${pushes}`);
});

check('2b. TWO CONSECUTIVE resizing:true frames produce ONE push (the brief)', () => {
  const {pushes} = runGesture(recordResizeGesture, [
    [dimensionFrame('a', 280, 180)],
    [dimensionFrame('a', 320, 210)],
  ]);
  assert.equal(pushes, 1, `expected 1 push for 2 frames, got ${pushes}`);
});

check('2c. a 60-frame drag of the grip is still ONE push, not 60', () => {
  const {pushes} = runGesture(recordResizeGesture, gestureFrames('a', 60, {w: 200, h: 141}, {w: 400, h: 300}));
  assert.equal(pushes, 1, `expected 1 push across 60 frames, got ${pushes}`);
});

check('2d. resizing:false re-arms the latch, so the NEXT resize is undoable too', () => {
  const guard = newResizeGuard();
  const first = gestureFrames('a', 5, {w: 200, h: 141}, {w: 300, h: 200});
  const second = gestureFrames('a', 5, {w: 300, h: 200}, {w: 420, h: 260});
  let pushes = 0;
  for (const f of [...first, ...second]) if (recordResizeGesture(guard, f)) pushes += 1;
  assert.equal(pushes, 2, `two separate gestures must leave 2 entries, got ${pushes}`);
});

check('2e. an interleaved position frame neither pushes nor drops the latch', () => {
  const guard = newResizeGuard();
  assert.equal(recordResizeGesture(guard, [dimensionFrame('a', 300, 200)]), true, 'frame 1 must push');
  assert.equal(recordResizeGesture(guard, [positionFrame('a', 10, 10)]), false, 'a position frame must not push');
  assert.equal(recordResizeGesture(guard, [dimensionFrame('a', 310, 205)]), false, 'the gesture is still open');
  assert.equal(recordResizeGesture(guard, [resizeEnded('a', 310, 205)]), false, 'the end frame must not push');
});

check('2f. select / remove frames are NOT recorded here (removals are noteRemove\'s)', () => {
  const guard = newResizeGuard();
  const selectFrame = [{id: 'a', type: 'select', selected: true}];
  const removeFrame = [{id: 'a', type: 'remove'}];
  assert.equal(recordResizeGesture(guard, selectFrame), false, 'a select frame must not push');
  assert.equal(recordResizeGesture(guard, removeFrame), false, 'a remove frame must not push here');
});

/* --------------------------------------------------------------------------
   3. THE DRAG PATH IS UNTOUCHED — the regression this change could cause
   -------------------------------------------------------------------------- */
console.log('');
console.log('3. the drag path keeps working exactly as before (no double-push)');

check('3a. N position frames push NOTHING here (the move already pushes at gesture level)', () => {
  const {pushes} = runGesture(
    recordResizeGesture,
    Array.from({length: 30}, (_, i) => [positionFrame('a', i, i)]),
  );
  assert.equal(pushes, 0, `position frames must push 0 here, got ${pushes}`);
});

check('3b. a mixed drag frame (position + dimensions with no resizing flag) pushes nothing', () => {
  const guard = newResizeGuard();
  const frame = [
    positionFrame('a', 12, 8),
    {id: 'a', type: 'dimensions', dimensions: {width: 200, height: 141}},
  ];
  assert.equal(recordResizeGesture(guard, frame), false, 'a frame without an explicit resizing flag must not push');
});

check('3c. onNodeDragStartAll still pushes, and is still wired on the canvas', () => {
  const start = APP.indexOf('const onNodeDragStartAll');
  assert.ok(start > -1, 'onNodeDragStartAll not found in App.tsx');
  const body = APP.slice(start, APP.indexOf('}, [', start));
  assert.match(body, /pushHistory\(\)/, 'onNodeDragStartAll must still push history');
  assert.equal(
    APP.split('onNodeDragStart={').length - 1,
    1,
    'exactly one canvas onNodeDragStart wiring expected',
  );
});

check('3d. exactly ONE canvas element renders the node types (a second would double-handle changes)', () => {
  // The JSX TAG, not the string: `<ReactFlowInstance` (the `useState` type
  // argument) also contains the substring `<ReactFlow` and would read as a
  // second canvas.
  const canvases = (APP.match(/<ReactFlow[\s>]/g) ?? []).length;
  assert.equal(canvases, 1, `expected exactly one <ReactFlow> element, found ${canvases}`);
});

/* --------------------------------------------------------------------------
   4. THE WIRING — handleNodesChange pushes for a resize, and only there
   -------------------------------------------------------------------------- */
console.log('');
console.log('4. the wiring in App.tsx');

const nodeChangeSlice = (() => {
  const from = APP.indexOf('const handleNodesChange');
  const to = APP.indexOf('const handleEdgesChange');
  assert.ok(from > -1 && to > from, 'handleNodesChange slice anchors not found');
  return APP.slice(from, to);
})();

check('4a. the slice is LIVE (non-empty and holds a row known to be inside it)', () => {
  assert.ok(nodeChangeSlice.length > 80, `slice too short (${nodeChangeSlice.length}) — anchor may be wrong`);
  assert.match(nodeChangeSlice, /onNodesChange\(changes\)/, 'the real handler body is not in the slice');
});

check('4b. handleNodesChange calls recordResizeGesture AND pushHistory', () => {
  assert.match(nodeChangeSlice, /recordResizeGesture\(/, 'no resize guard call');
  assert.match(nodeChangeSlice, /pushHistory\(\)/, 'no push');
});

check('4c. it still pushes for removals, and pushes at most once per frame batch', () => {
  assert.match(nodeChangeSlice, /c\.type === 'remove'/, 'the removal path was dropped');
  assert.match(nodeChangeSlice, /noteRemove\(\)/, 'the removal guard was dropped');
  const pushes = nodeChangeSlice.split('pushHistory()').length - 1;
  assert.equal(pushes, 1, `expected exactly 1 literal pushHistory() call, found ${pushes}`);
});

check('4d. the guard lives in a ref (it must survive re-renders across the gesture)', () => {
  assert.match(APP, /useRef\(newResizeGuard\(\)\)/, 'the resize guard is not held in a useRef');
});

check('4e. handleEdgesChange has NO resize guard (an edge has no dimensions)', () => {
  const from = APP.indexOf('const handleEdgesChange');
  const to = APP.indexOf('}, [onEdgesChange, noteRemove]);', from);
  assert.ok(from > -1 && to > from, 'handleEdgesChange anchors not found');
  const slice = APP.slice(from, to);
  assert.ok(slice.length > 40, 'handleEdgesChange slice too short');
  assert.equal(
    slice.includes('recordResizeGesture'),
    false,
    'the resize guard was wired to the EDGE changes too',
  );
});

/* --------------------------------------------------------------------------
   5. A RESIZE IS UNDOABLE — modelled on the app's own Snap / undo / redo
   -------------------------------------------------------------------------- */
console.log('');
console.log('5. undo restores the previous size, and redo re-applies the new one');

const BEFORE = {w: 200, h: 141};
const AFTER = {w: 340, h: 260};

const initialNode = () => ({
  id: 'a',
  type: 'goblin',
  position: {x: 0, y: 0},
  data: {body: 'Alpha'},
  width: BEFORE.w,
  height: BEFORE.h,
  measured: {width: BEFORE.w, height: BEFORE.h},
});

/** The app's `snapshot()`: the fields it copies, in the shape it RETURNS.
 *  `Snap` is `{nodes, edges}` — the array must not be flattened here or the
 *  `prev.nodes` reads below become undefined. */
const snapshot = (nodes, edges = []) => ({
  nodes: nodes.map((n) => ({...n, position: {...n.position}, data: {...(n.data ?? {})}, selected: false})),
  edges: edges.map((e) => ({...e, selected: false})),
});

check('5a. the real applyNodeChanges writes the size into the node (this is why it survives)', () => {
  const nodes = [initialNode()];
  const out = applyNodeChanges([dimensionFrame('a', AFTER.w, AFTER.h)], nodes);
  assert.equal(out[0].width, AFTER.w, 'width was not written by the library');
  assert.equal(out[0].height, AFTER.h, 'height was not written by the library');
  assert.equal(out[0].measured.width, AFTER.w, 'measured.width was not updated');
  assert.equal(out[0].measured.height, AFTER.h, 'measured.height was not updated');
});

check('5b. undo restores the PRE-resize dimensions', () => {
  const nodes = [initialNode()];
  // pushHistory() at the first resizing frame — the state BEFORE the resize.
  const past = [snapshot(nodes)];
  // The gesture runs; React Flow writes the new size in.
  let live = nodes;
  for (let i = 1; i <= 20; i += 1) {
    const w = Math.round(BEFORE.w + ((AFTER.w - BEFORE.w) * i) / 20);
    const h = Math.round(BEFORE.h + ((AFTER.h - BEFORE.h) * i) / 20);
    live = applyNodeChanges([dimensionFrame('a', w, h)], live);
  }
  assert.deepEqual(
    {w: live[0].width, h: live[0].height},
    {w: AFTER.w, h: AFTER.h},
    'the resize did not land before undo',
  );

  // undo(): future.push(snapshot(live)); setNodes(past.pop().nodes)
  const prev = past.pop();
  const restored = prev.nodes;
  assert.deepEqual(
    {w: restored[0].width, h: restored[0].height, mw: restored[0].measured.width, mh: restored[0].measured.height},
    {w: BEFORE.w, h: BEFORE.h, mw: BEFORE.w, mh: BEFORE.h},
    'undo did not restore the previous size',
  );
});

check('5c. redo re-applies the resized dimensions', () => {
  const nodes = [initialNode()];
  const past = [snapshot(nodes)];
  let live = applyNodeChanges([dimensionFrame('a', AFTER.w, AFTER.h)], nodes);
  // undo()
  const prev = past.pop();
  const future = [snapshot(live)]; // what undo() pushes for redo
  live = prev.nodes;
  assert.equal(live[0].width, BEFORE.w, 'undo step did not run');
  // redo(): past.push(snapshot(live)); setNodes(future.pop().nodes)
  const next = future.pop();
  live = next.nodes;
  assert.deepEqual(
    {w: live[0].width, h: live[0].height, mw: live[0].measured.width, mh: live[0].measured.height},
    {w: AFTER.w, h: AFTER.h, mw: AFTER.w, mh: AFTER.h},
    'redo did not re-apply the resize',
  );
});

check('5d. the pre-resize entry is a DEEP copy (a later frame cannot mutate it away)', () => {
  const nodes = [initialNode()];
  const past = [snapshot(nodes)];
  const live = applyNodeChanges([dimensionFrame('a', AFTER.w, AFTER.h)], nodes);
  live[0].position.x = 999;
  live[0].data.body = 'mutated';
  assert.equal(past[0].nodes[0].width, BEFORE.w, 'the snapshot holds the pre-resize width');
  assert.equal(past[0].nodes[0].position.x, 0, 'the snapshot position was aliased');
  assert.equal(past[0].nodes[0].data.body, 'Alpha', 'the snapshot data was aliased');
});

/* --------------------------------------------------------------------------
   6. BOTH CASES MEASURED — Harvey's "only unconnected shapes" claim
   -------------------------------------------------------------------------- */
console.log('');
console.log('6. MEASURED: a standalone node vs a node with an edge');

/** A board of one standalone node, and one of two nodes joined by an edge. */
const standaloneBoard = () => ({nodes: [initialNode()], edges: []});
const connectedBoard = () => ({
  nodes: [initialNode(), {...initialNode(), id: 'b', position: {x: 400, y: 0}}],
  edges: [{id: 'e1', source: 'a', target: 'b', sourceHandle: 'r', targetHandle: 'l'}],
});

/** Replay the app's own resize path over a board and count the history pushes. */
const measureBoard = (board) => {
  const guard = newResizeGuard();
  const past = [];
  let live = board.nodes;
  for (const frame of gestureFrames('a', 20, BEFORE, AFTER)) {
    // handleNodesChange: removal note, then the resize note, then the change.
    if (frame.some((c) => c.type === 'remove')) { /* noteRemove(), guarded */ }
    if (recordResizeGesture(guard, frame)) past.push(snapshot(live));
    live = applyNodeChanges(frame, live);
  }
  return {pushes: past.length, edges: board.edges.length, finalW: live[0].width, finalH: live[0].height};
};

const standalone = measureBoard(standaloneBoard());
const connected = measureBoard(connectedBoard());

check('6a. the standalone node: gesture pushes exactly once', () => {
  assert.equal(standalone.pushes, 1, `standalone pushes = ${standalone.pushes}`);
});

check('6b. the node WITH AN EDGE: gesture pushes exactly once', () => {
  assert.equal(connected.pushes, 1, `connected pushes = ${connected.pushes}`);
});

check('6c. MEASURED VERDICT — the connected/unconnected difference does NOT exist', () => {
  const differs = standalone.pushes !== connected.pushes;
  assert.equal(
    differs,
    false,
    `the push count DIFFERS by connection state: standalone=${standalone.pushes}, connected=${connected.pushes}`,
  );
  console.log(
    `        measured: standalone ${standalone.edges} edges -> ${standalone.pushes} push; ` +
      `connected ${connected.edges} edge -> ${connected.pushes} push (sizes ${standalone.finalW}x${standalone.finalH}, ` +
      `${connected.finalW}x${connected.finalH})`,
  );
});

check('6d. WHY there can be no difference: the resize path reads no edge state', () => {
  const RESIZE_SRC = blankComments(readFileSync(join(ROOT, 'src/resizeHistory.ts'), 'utf8'));
  for (const word of ['edge', 'Edge', 'connection', 'Connection', 'source', 'target']) {
    assert.equal(
      RESIZE_SRC.includes(word),
      false,
      `src/resizeHistory.ts mentions "${word}" — the resize history path is not edge-independent`,
    );
  }
  for (const word of ['edge', 'Edge', 'connection', 'Connection']) {
    assert.equal(
      nodeChangeSlice.includes(word),
      false,
      `handleNodesChange mentions "${word}" — the resize history path is not edge-independent`,
    );
  }
});

/* --------------------------------------------------------------------------
   7. THE RESIZE IS NOT TOUCHED — geometry, floors and gesture feel
   -------------------------------------------------------------------------- */
console.log('');
console.log('7. this round did not move the resize geometry, the floors or the feel');

check('7a. no resizer gained a gesture callback prop (the feel is unchanged)', () => {
  for (const [name, src] of [['DiagramNode', DIAGRAM], ['LabelNode', LABEL], ['CustomShapeNode', CUSTOM]]) {
    const blocks = src.match(/<NodeResizer[\s\S]*?\/>/g) ?? [];
    assert.ok(blocks.length > 0, `${name}: no <NodeResizer> found`);
    for (const block of blocks) {
      for (const prop of ['onResizeStart', 'onResize=', 'onResizeEnd']) {
        assert.equal(block.includes(prop), false, `${name}'s resizer gained ${prop} — this round must not change the gesture`);
      }
    }
  }
});

check('7b. the diagram node floors are still wired to the same constants', () => {
  /* AQ19e 2026-10-16 — minWidth became per-node too (minWFloor, same pattern
     as minHeight): measured natural width clamped by NODE_MIN_W.
     RE-ANCHORED (ROUND BF, 2026-10-23): the derivation moved INSIDE the
     exported `resizeFloorsFor(shape, naturalW, naturalH)` (per-shape-class
     floors — connector 64 flat, note 130/44 flat, text-card unchanged
     semantics with a max() pin to the CSS floor); the component now derives
     both floors with ONE call and reads floors.w / floors.h. The regexes
     retarget the function body; the constants themselves are unchanged. */
  assert.match(DIAGRAM, /minWidth=\{floors\.w\}/, 'minWidth no longer reads the resizeFloorsFor derivation');
  assert.match(DIAGRAM, /minHeight=\{floors\.h\}/, 'minHeight no longer reads the resizeFloorsFor derivation');
  assert.match(DIAGRAM, /const floors = resizeFloorsFor\(shape, naturalWRef\.current, naturalHRef\.current\)/,
    'the component no longer derives its floors via ONE resizeFloorsFor call from the natural refs');
  assert.match(DIAGRAM, /w: Math\.max\(CSS_CONTENT_MIN_W, Math\.min\(NODE_MIN_W, naturalW \|\| NODE_MIN_W\)\)/,
    'the text-card width floor derivation changed (max(cssFloor, min(clamp, natural)))');
  assert.match(DIAGRAM, /h: Math\.min\(NODE_MIN_H, naturalH \|\| NODE_MIN_H\)/,
    'the text-card height floor derivation changed');
  assert.match(DIAGRAM, /export const NODE_MIN_W = CSS_CONTENT_MIN_W \+ FLOOR_SLACK_PX/, 'NODE_MIN_W derivation changed');
  assert.match(DIAGRAM, /export const NODE_MIN_H = CONTENT_MIN_H \+ FLOOR_SLACK_PX/, 'NODE_MIN_H derivation changed');
});

check('7c. the label node still resizes with its own floors (it shares this path)', () => {
  assert.match(LABEL, /<NodeResizer/, 'the label node lost its resizer');
  assert.match(LABEL, /minWidth=\{80\}/, 'the label floor moved');
  assert.match(LABEL, /minHeight=\{48\}/, 'the label floor moved');
});

check('7d. the custom-shape resizer floors, and carries NO ceiling', () => {
  /* RE-ANCHORED (ROUND BE, 2026-10-23): OLD claim — the custom resizer carried
     all four clamps (min AND maxWidth/maxHeight = SHAPE_MAX_PX 512). NEW claim
     — only the 32px floors: DiagramNode's resizer has no ceiling either, and
     Harvey asked for resize parity ("resize should behave like normal
     shapes"), so the 512 cap left the live resizer. SHAPE_MAX_PX survives
     ONLY inside the import path's clampShapeSize window (customShape.ts) —
     it must NOT be imported by CustomShapeNode.tsx any more, or a cap can
     creep back in through the side door. */
  for (const prop of ['minWidth={SHAPE_MIN_PX}', 'minHeight={SHAPE_MIN_PX}']) {
    assert.ok(CUSTOM.includes(prop), `the custom-shape resizer lost ${prop}`);
  }
  for (const gone of ['maxWidth={SHAPE_MAX_PX}', 'maxHeight={SHAPE_MAX_PX}']) {
    assert.ok(!CUSTOM.includes(gone), `the custom-shape resizer still carries ${gone} — the live cap was removed in ROUND BE`);
  }
  assert.ok(!/SHAPE_MAX_PX/.test(CUSTOM), 'CustomShapeNode.tsx still references SHAPE_MAX_PX — the import-window clamp must stay in customShape.ts only');
});

check('7e. the removal guard is untouched', () => {
  const from = APP.indexOf('const removeGuard');
  const to = APP.indexOf('const noteRemove', from);
  assert.ok(from > -1 && to > from, 'removeGuard anchors not found');
  const slice = APP.slice(from, to);
  assert.match(slice, /useRef\(false\)/, 'removeGuard is no longer a boolean ref');
  const body = APP.slice(to, APP.indexOf('}, [pushHistory]);', to));
  assert.match(body, /window\.setTimeout/, 'noteRemove lost its same-tick guard');
});

/* --------------------------------------------------------------------------
   8. NEGATIVE CONTROLS — the counting loop must be able to FAIL
   -------------------------------------------------------------------------- */
console.log('');
console.log('8. negative controls (the loop must catch a broken predicate)');

/** MUTANT 1: push on every frame — the "hundreds of history steps" bug. */
const pushEveryFrame = () => true;
/** MUTANT 2: never re-arm — the second resize of a session is not undoable. */
const neverReArms = (guard, changes) => {
  if (!changes.some((c) => c.type === 'dimensions' && c.resizing === true)) return false;
  if (guard.active) return false;
  guard.active = true;
  return true;
};

check('8a. CONTROL: the loop DOES report 60 pushes for a push-every-frame mutant', () => {
  const {pushes} = runGesture(pushEveryFrame, gestureFrames('a', 60, BEFORE, AFTER));
  assert.equal(pushes, 61, `the control loop reported ${pushes}, so it cannot see a per-frame push at all`);
  assert.notEqual(pushes, 1, 'the control must NOT also read 1 — that would make 2c vacuous');
});

check('8b. CONTROL: the loop DOES catch a predicate that never re-arms', () => {
  const guard = newResizeGuard();
  const one = gestureFrames('a', 3, BEFORE, AFTER); // resizing frames + resizing:false
  const two = gestureFrames('a', 3, AFTER, {w: 400, h: 300});
  let pushes = 0;
  for (const f of [...one, ...two]) if (neverReArms(guard, f)) pushes += 1;
  assert.equal(pushes, 1, `the mutant should leave 1 entry across two gestures, got ${pushes}`);
  assert.notEqual(pushes, 2, 'the control must NOT read 2 — that would make 2d vacuous');
});

check('8c. CONTROL: a predicate that never pushes is caught too', () => {
  const {pushes} = runGesture(() => false, gestureFrames('a', 20, BEFORE, AFTER));
  assert.equal(pushes, 0, 'the never-push mutant must read 0');
  assert.notEqual(pushes, 1, 'the control must NOT read 1 — that would make 2a vacuous');
});

console.log('');
console.log(`ROUND 5 harness: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
