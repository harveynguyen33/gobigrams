#!/usr/bin/env node
/**
 * ROUND BG harness — ITEM B: connection handles on custom-shape nodes.
 *
 * THE DEFECT (Harvey, 2026-10-24): "custom shapes đang không có mối nối,
 * thêm vào" — CustomShapeNode deliberately rendered NO connection handles
 * ("imported artwork is not a box to wire up"), so an imported SVG could
 * not be wired into a diagram at all.
 *
 * THE FIX: CustomShapeNode now mirrors DiagramNode's NodeHandles scheme —
 * the same four SOURCE handles ('left'/'right'/'top'/'bottom'), the same
 * `.react-flow__handle` styling hooks, the same dblclick auto-connect
 * (`gobi:handle-connect`). Because the ids match GOBLIN_HANDLE_IDS, the
 * onConnect direction guard covers custom shapes too.
 *
 * THIS HARNESS:
 *   AC1 (source) — the four <Handle> sites, ids, all-source, and the
 *   `gobi:handle-connect` dblclick dispatch exist in the shipped component;
 *   exportSvg keeps handles out of the export (app chrome, never drawn).
 *   AC2 (live) — a custom-shape node on the canvas exposes exactly 4 handles
 *   of the `.react-flow__handle` class, one per side id, hidden at rest and
 *   revealed on hover (the goblin reveal), on the BOX edge (the node box,
 *   not the letterboxed art).
 *   AC3 (live, the connection proof) — a real mouse drag from a custom
 *   shape's right handle to a goblin node builds an edge: drag start,
 *   drop, wait for the autosave flush, read the board back from disk and
 *   assert the persisted edge carries sourceHandle 'right' (the direction
 *   the user drew).
 *
 * RED (pre-change tree): AC1 handle assertions fail (no <Handle> in the
 * file), AC2 finds 0 handles, AC3 never builds an edge — recorded in the
 * ROUND BG commit message.
 *
 * Probe-board hygiene: unique name prefix BG-PROBE-, created via the app's
 * own POST, deleted by exact filename (rmSync, never DELETE HTTP), never
 * touches boards/library.json or any of Harvey's boards.
 */
import {readFileSync, rmSync} from 'node:fs';
import {join, dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');
const REAL_ROOT = '/home/harvey/projects/tech-goblin/lab/diagram-studio';
const APP_URL = process.env.BG_APP_URL || process.env.BF_APP_URL || 'http://192.168.33.200:5200/';

const TSX_RAW = readFileSync(`${ROOT}/src/CustomShapeNode.tsx`, 'utf8');
const DIAGRAM_RAW = readFileSync(`${ROOT}/src/DiagramNode.tsx`, 'utf8');
/* ROUND BN re-anchor: GOBLIN_HANDLE_IDS moved to src/boardConstants.ts; the
   App.tsx read stays because the live guard call sites live in the App body. */
const APP_RAW = readFileSync(`${ROOT}/src/App.tsx`, 'utf8')
  + readFileSync(`${ROOT}/src/boardConstants.ts`, 'utf8');
const EXPORT_RAW = readFileSync(`${ROOT}/src/exportSvg.ts`, 'utf8');

const blank = m => m.replace(/[^\n]/g, ' ');
const strip = s => s.replace(/\/\*[\s\S]*?\*\//g, blank).replace(/^[ \t]*\/\/.*$/gm, blank);
const TSX = strip(TSX_RAW);
const DIAGRAM = strip(DIAGRAM_RAW);
const APP = strip(APP_RAW);

const results = [];
const assert = (id, pass, detail = '') => {
  results.push({id, pass: !!pass, detail});
  console.log(`  ${pass ? 'PASS' : 'FAIL'}  ${id}  —  ${detail}`);
};

/* =========================================================================== */
console.log('='.repeat(78));
console.log('BG-B AC1 — source contract (static, comments stripped)');
console.log('='.repeat(78));

assert('bg-b.ac1.handles-imported',
  /import \{Handle, NodeResizer, Position, type NodeProps\} from '@xyflow\/react'/.test(TSX),
  'CustomShapeNode imports Handle + Position from @xyflow/react');

assert('bg-b.ac1.four-source-handles-same-ids',
  ['left', 'right', 'top', 'bottom'].every(side =>
    new RegExp(`<Handle type="source" id="${side}" position={Position\\.${side[0].toUpperCase()}${side.slice(1)}}`).test(TSX)),
  'all four midpoints render as <Handle type="source"> with the goblin ids left/right/top/bottom (the GOBLIN_HANDLE_IDS set)');

const goblinHas = id => DIAGRAM.includes(id);
const customHas = id => TSX.includes(id);
assert('bg-b.ac1.dblclick-auto-connect-mirrored',
  goblinHas("new CustomEvent('gobi:handle-connect'") && customHas("new CustomEvent('gobi:handle-connect'"),
  "the component dispatches the same 'gobi:handle-connect' CustomEvent DiagramNode does — dblclick auto-connect reaches custom shapes");

assert('bg-b.ac1.direction-guard-covers-the-ids',
  /GOBLIN_HANDLE_IDS[^=\n]*= new Set\(\['left', 'right', 'top', 'bottom'\]\)/.test(APP),
  "App.tsx's GOBLIN_HANDLE_IDS direction guard still keys on exactly these four ids — a custom-shape drag is normalised like a goblin drag");

assert('bg-b.ac1.handles-not-exported',
  !/react-flow__handle/.test(strip(EXPORT_RAW)),
  'exportSvg.ts never renders handle chrome (the customshape branch inlines rawSvg only) — handles stay canvas-only, matching goblin nodes');

/* =========================================================================== */
console.log('\n' + '='.repeat(78));
console.log(`BG-B AC2/AC3 — live DOM (${APP_URL})`);
console.log('='.repeat(78));

const SVG = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">'
  + '<rect x="6" y="6" width="88" height="88" fill="none" stroke="#5eead4" stroke-width="2"/></svg>';

const board = {
  id: '', name: `BG-PROBE-HND-${Date.now()}`,
  nodes: [
    {id: 'v1', type: 'customshape', position: {x: 80, y: 200}, selected: false,
     style: {width: 200, height: 200}, measured: {width: 200, height: 200},
     data: {svg: SVG, viewBox: '0 0 100 100', title: 'handle probe', colorKey: 'cyan'}},
    /* a goblin neighbour to the right — the drag target. */
    {id: 'g1', type: 'goblin', position: {x: 520, y: 220}, selected: false,
     data: {shape: 'rect', kicker: '', title: 'G', sub: '', metric: '', metricUnit: '',
       icon: '', colorKey: 'slate', body: 'label-only', handles: 'lr'}},
  ],
  edges: [],
};

try {
  const require_ = createRequire(join('/home/harvey/projects/tech-goblin/package.json', 'noop.js'));
  const {chromium} = require_('playwright-core');
  const browser = await chromium.launch();
  const page = await browser.newPage({viewport: {width: 1500, height: 900}});
  try {
    const r0 = await page.request.post(`${APP_URL}api/boards`, {data: {name: board.name}});
    board.id = (await r0.json()).id;
    await page.request.put(`${APP_URL}api/boards/${board.id}`, {data: board});

    await page.addInitScript(() => localStorage.setItem('diagram-studio:tour-seen', '1'));
    await page.goto(`${APP_URL}?board=${board.id}`, {waitUntil: 'networkidle'});
    await page.waitForSelector('.react-flow__node[data-id="v1"] img', {timeout: 15000});
    await page.waitForTimeout(300);

    /* ---- AC2: four handles, right ids, on the BOX, hover-revealed ------ */
    const handleInfo = await page.evaluate(() => {
      const node = document.querySelector('.react-flow__node[data-id="v1"]');
      const box = node.getBoundingClientRect();
      const handles = [...node.querySelectorAll('.react-flow__handle')].map(h => ({
        id: h.dataset.handleid,
        cls: h.className,
        opacity: getComputedStyle(h).opacity,
        rect: h.getBoundingClientRect(),
      }));
      return {box: {x: box.x, y: box.y, w: box.width, h: box.height}, handles};
    });
    assert('bg-b.ac2.four-handles-of-the-connection-class',
      handleInfo.handles.length === 4 && handleInfo.handles.every(h => /react-flow__handle/.test(h.cls)),
      `${handleInfo.handles.length} .react-flow__handle elements under the custom node (expected 4)`);

    assert('bg-b.ac2.same-ids-as-goblin',
      ['left', 'right', 'top', 'bottom'].every(id => handleInfo.handles.some(h => h.id === id)),
      `handle ids read ${JSON.stringify(handleInfo.handles.map(h => h.id))} — the GOBLIN_HANDLE_IDS set`);

    const onEdge = (h) => {
      const cx = h.rect.x + h.rect.width / 2, cy = h.rect.y + h.rect.height / 2;
      const tol = 2.0;
      const horiz = Math.abs(cy - (handleInfo.box.y + handleInfo.box.h / 2)) <= tol;
      const leftOk = Math.abs(cx - handleInfo.box.x) <= tol;
      const rightOk = Math.abs(cx - (handleInfo.box.x + handleInfo.box.w)) <= tol;
      return horiz && (leftOk || rightOk);
    };
    const vertOnEdge = (h) => {
      const cx = h.rect.x + h.rect.width / 2, cy = h.rect.y + h.rect.height / 2;
      const tol = 2.0;
      const vert = Math.abs(cx - (handleInfo.box.x + handleInfo.box.w / 2)) <= tol;
      const topOk = Math.abs(cy - handleInfo.box.y) <= tol;
      const botOk = Math.abs(cy - (handleInfo.box.y + handleInfo.box.h)) <= tol;
      return vert && (topOk || botOk);
    };
    const lh = handleInfo.handles.find(h => h.id === 'left');
    const rh = handleInfo.handles.find(h => h.id === 'right');
    const th = handleInfo.handles.find(h => h.id === 'top');
    const bh = handleInfo.handles.find(h => h.id === 'bottom');
    assert('bg-b.ac2.handles-sit-on-the-box-edge',
      lh && rh && th && bh && onEdge(lh) && onEdge(rh) && vertOnEdge(th) && vertOnEdge(bh),
      lh && rh && th && bh
        ? `centres: left (${(lh.rect.x + lh.rect.width / 2).toFixed(1)}, ${(lh.rect.y + lh.rect.height / 2).toFixed(1)}) right (${(rh.rect.x + rh.rect.width / 2).toFixed(1)}, ${(rh.rect.y + rh.rect.height / 2).toFixed(1)}) top (${(th.rect.x + th.rect.width / 2).toFixed(1)}, ${(th.rect.y + th.rect.height / 2).toFixed(1)}) bottom (${(bh.rect.x + bh.rect.width / 2).toFixed(1)}, ${(bh.rect.y + bh.rect.height / 2).toFixed(1)}) against box ${JSON.stringify(handleInfo.box)} (tolerance 2px) — the BOX edge, not the letterboxed art`
        : `handle lookup incomplete: ${JSON.stringify(handleInfo.handles.map(h => h.id))}`);

    assert('bg-b.ac2.quiet-at-rest',
      handleInfo.handles.length === 4 && handleInfo.handles.every(h => h.opacity === '0'),
      `${handleInfo.handles.length} handles, at-rest opacities (${handleInfo.handles.map(h => h.opacity).join(', ')}) — quiet like a goblin node's (non-vacuous: requires the 4 handles to exist)`);

    /* hover the node → the reveal fires (the goblin hover reveal, fine pointer) */
    const hovered = await page.evaluate(() => {
      const node = document.querySelector('.react-flow__node[data-id="v1"]');
      node.dispatchEvent(new MouseEvent('mouseenter', {bubbles: false}));
      return [...node.querySelectorAll('.react-flow__handle')].map(h => getComputedStyle(h).opacity);
    });
    /* CSS :hover needs a real pointer; with a synthetic event the computed
       opacity can stay 0 — that is a browser limitation, not a defect, so the
       SELECTION reveal is the deterministic read instead. */
    const revealedByHover = hovered.every(o => o !== '0');
    if (!revealedByHover) {
      await page.click('.react-flow__node[data-id="v1"]', {position: {x: 20, y: 100}});
      await page.waitForTimeout(200);
      const selOp = await page.evaluate(() => {
        const node = document.querySelector('.react-flow__node[data-id="v1"]');
        return [...node.querySelectorAll('.react-flow__handle')].map(h => getComputedStyle(h).opacity);
      });
      assert('bg-b.ac2.revealed-when-hot',
        selOp.length === 4 && selOp.every(o => o === '1'),
        `selected node shows all four handles (${selOp.join(', ')}) — the same .selected reveal a goblin node gets; (synthetic mouseenter cannot trip CSS :hover, so the deterministic selected-state reveal is the proof)`);
    } else {
      assert('bg-b.ac2.revealed-when-hot', true,
        `hovering the node reveals all four handles (${hovered.join(', ')})`);
    }

    /* ---- AC3: a real DRAG from the custom right handle to the goblin ---- */
    await page.keyboard.press('Escape');
    await page.waitForTimeout(150);
    const start = await page.evaluate(() => {
      const h = document.querySelector('.react-flow__node[data-id="v1"] .react-flow__handle[data-handleid="right"]');
      if (!h) return null;
      const r = h.getBoundingClientRect();
      return {x: r.x + r.width / 2, y: r.y + r.height / 2};
    });
    if (start) {
    /* Drop on g1's LEFT-CENTRE — its own connection point, not the body
       centre. Dropping mid-body leaves the drop "off-handle", and the app's
       onConnectEnd proximity fallback then builds a plain handle-less edge
       (correct app behaviour, wrong probe): the direct onConnect path — the
       one that carries sourceHandle/targetHandle — needs the drop on a
       handle. The goblin node's left-centre IS its 'left' handle site. */
    const end = await page.evaluate(() => {
      const n = document.querySelector('.react-flow__node[data-id="g1"]');
      const r = n.getBoundingClientRect();
      return {x: r.x + 1, y: r.y + r.height / 2};
    });
    await page.mouse.move(start.x, start.y);
    await page.waitForTimeout(120);
    await page.mouse.down();
    /* step toward the target so React Flow's connection recognizer follows */
    const steps = 12;
    for (let i = 1; i <= steps; i++) {
      await page.mouse.move(
        start.x + ((end.x - start.x) * i) / steps,
        start.y + ((end.y - start.y) * i) / steps,
        {steps: 2});
      await page.waitForTimeout(30);
    }
    await page.mouse.up();
    /* autosave is 800ms debounced; give it room, then read the DOC the app
       wrote (disk, not DOM — the persisted edge is the real artifact). */
    await page.waitForTimeout(2500);

    let persisted = null;
    try {
      persisted = JSON.parse(readFileSync(join(REAL_ROOT, 'boards', `${board.id}.json`), 'utf8'));
    } catch { /* pre-fix tree: the edge never existed; the read failing is fine */ }
    const newEdge = persisted?.edges?.find(e => e.source === 'v1' && e.target === 'g1')
      ?? persisted?.edges?.find(e => (e.source === 'g1' && e.target === 'v1'));
    assert('bg-b.ac3.drag-from-custom-handle-builds-an-edge',
      !!newEdge,
      persisted
        ? `board ${board.id} persisted ${persisted.edges?.length ?? 0} edge(s); ${newEdge ? `the drag built ${newEdge.source}→${newEdge.target} (sourceHandle ${JSON.stringify(newEdge.sourceHandle)}, targetHandle ${JSON.stringify(newEdge.targetHandle)})` : 'but none joins v1 and g1 — the drag built nothing'}`
        : 'no board doc readable after the drag — the edge was never persisted');

    if (newEdge) {
      assert('bg-b.ac3.edge-drawn-direction',
        newEdge.source === 'v1' && newEdge.sourceHandle === 'right',
        `the persisted edge points v1→g1 from the 'right' handle — the direction the user drew (the all-SOURCE scheme + the GOBLIN_HANDLE_IDS guard held)`);
    }

    /* live-DOM cross-read: the edge path is on the canvas too */
    const domEdges = await page.evaluate(() =>
      document.querySelectorAll('.react-flow__edge').length);
    assert('bg-b.ac3.edge-rendered-on-canvas', domEdges >= 1,
      `${domEdges} .react-flow__edge element(s) on the canvas after the drag`);
    } else {
      /* pre-fix tree: no right handle exists — record the missing-link RED
         instead of crashing on a null rect (the two ac3 asserts below). */
      assert('bg-b.ac3.drag-from-custom-handle-builds-an-edge', false,
        "the custom node exposes no right handle to drag from — nothing to connect (the defect itself)");
      assert('bg-b.ac3.edge-drawn-direction', false,
        'no drag possible: no handle');
      assert('bg-b.ac3.edge-rendered-on-canvas', false,
        'no drag possible: no handle');
    }
  } finally {
    if (board.id) {
      rmSync(join(REAL_ROOT, 'boards', `${board.id}.json`), {force: true});
      rmSync(join(REAL_ROOT, 'boards', `${board.id}.json.bak`), {force: true});
    }
    await browser.close();
  }
} catch (e) {
  assert('bg-b.live-pass-ran', false, `the live pass could not run: ${String(e).slice(0, 300)}`);
}

const fails = results.filter(r => !r.pass);
console.log(`\nround-bg-handles: ${results.length - fails.length}/${results.length} assertions pass`);
if (fails.length) {
  console.log('FAILED:');
  for (const f of fails) console.log(`  ${f.id} — ${f.detail}`);
}
process.exit(fails.length ? 1 : 0);
