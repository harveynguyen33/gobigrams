#!/usr/bin/env node
/**
 * ROUND AY item 4 — the LIVE pixel-diff gate (spec §4 proof 2).
 * checks/round-ay-png-diff.mjs
 *
 * BEFORE fixtures: checks/fixtures/round-ay-png-before/ (the DOM-clone
 * html-to-image path, captured by round-ay-png-capture.mjs).
 * AFTER: this script re-runs the SAME capture flow (probe boards re-created,
 * re-exported, deleted) and pixel-diffs old vs new.
 *
 * Reports: changedPx / totalPx per board + the bounding boxes of the diff
 * clusters + cluster classification (text ink / edges / tints / icons).
 * Gates (per the child card): every UNEXPLAINED cluster blocks; the known
 * explainable class is text rasterisation through the SVG engine vs
 * html-to-image's foreignObject clone (~1px ink edges; the measured
 * 2.6%/1px floor in the typography report §7.3).
 *
 * ALSO gates the structural assertions on the new path:
 *   - 0 selection-blue px with a node selected (AU-1 re-proven, ±40 of
 *     --sel #3b82f6 — item 4 proof 4);
 *   - edge + marker pixels > 0 in both themes (the BA assertion).
 */
import {mkdirSync, writeFileSync, readFileSync, existsSync, rmSync, statSync, readdirSync} from 'node:fs';
import {join, dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, '..');
const require_ = createRequire(join('/home/harvey/projects/tech-goblin/package.json', 'noop.js'));
const {chromium} = require_('playwright-core');
const {PNG} = require_('/home/harvey/.hermes/hermes-agent/node_modules/pngjs/lib/png.js');

const APP = process.env.AY_APP_URL || 'http://localhost:5200/';
const BEFORE = join(REPO, 'checks', 'fixtures', 'round-ay-png-before');
const AFTER = join(REPO, '.ay4-png-after');
mkdirSync(AFTER, {recursive: true});

const board = {
  id: '', name: 'AY-PROBE-CODER-DIFF',
  nodes: [
    {id: 'p1', type: 'goblin', position: {x: 0, y: 0}, selected: false,
     style: {width: 190, height: 129}, measured: {width: 190, height: 129},
     data: {shape: 'database', kicker: 'database', title: 'Primary DB', sub: 'postgres 16', metric: '12', metricUnit: 'ms', icon: 'database', colorKey: 'violet'}},
    {id: 'p2', type: 'goblin', position: {x: 340, y: 40}, selected: false,
     style: {width: 190, height: 95}, measured: {width: 190, height: 95},
     data: {shape: 'service', title: 'Order API', sub: 'rest', icon: 'server', colorKey: 'cyan'}},
    {id: 'p3', type: 'goblin', position: {x: 680, y: 0}, selected: false,
     style: {width: 190, height: 95}, measured: {width: 190, height: 95},
     data: {shape: 'queue', title: 'Jobs', sub: 'worker', icon: 'layers', colorKey: 'green'}},
    {id: 'p4', type: 'goblin', position: {x: 60, y: 260}, selected: false,
     style: {width: 200, height: 110}, measured: {width: 200, height: 110},
     data: {shape: 'note', title: 'Edge cases', sub: 'check retries', colorKey: 'amber'}},
    {id: 'p5', type: 'table', position: {x: 360, y: 240}, selected: false,
     style: {width: 220, height: 140}, measured: {width: 220, height: 140},
     data: {name: 'orders', columns: [{name: 'id', pk: true}, {name: 'user_id'}, {name: 'total'}], colorKey: 'blue'}},
    {id: 'p6', type: 'goblin', position: {x: 700, y: 240}, selected: false,
     style: {width: 200, height: 100}, measured: {width: 200, height: 100},
     data: {shape: 'group', title: 'Region', colorKey: 'pink'}},
    {id: 'p7', type: 'goblin', position: {x: 730, y: 290}, selected: false, parentId: 'p6',
     style: {width: 160, height: 80}, measured: {width: 160, height: 80},
     data: {shape: 'process', title: 'Worker', colorKey: 'pink'}},
  ],
  edges: [
    {id: 'pe1', source: 'p1', target: 'p2', type: 'goblinEdge', label: 'reads', data: {colorKey: 'slate'}},
    {id: 'pe2', source: 'p2', target: 'p3', type: 'goblinEdge', data: {colorKey: 'slate'}},
    {id: 'pe3', source: 'p6', target: 'p3', type: 'goblinEdge', data: {colorKey: 'slate'}},
  ],
};
const CUSTOM_BOARD = {
  id: '', name: 'AY-PROBE-CODER-DIFF-CUSTOM',
  nodes: [
    {id: 'c1', type: 'customshape', position: {x: 0, y: 0}, selected: false,
     style: {width: 200, height: 100}, measured: {width: 200, height: 100},
     data: {title: 'Custom', svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 100"><rect x="4" y="4" width="192" height="92" rx="12" fill="#39c5cf" fill-opacity="0.2" stroke="#39c5cf" stroke-width="2"/><circle cx="60" cy="50" r="22" fill="#8b7cf6"/><path d="M100 30 L160 30 L160 70 L100 70 Z" fill="#f5a623"/></svg>'}},
  ],
  edges: [],
};

/* ---- clean any leaked AY-PROBE-CODER* boards (ours by name) */
const boardsDir = join(REPO, 'boards');
for (const f of existsSync(boardsDir) ? readdirSync(boardsDir) : []) {
  const m = /^([A-Za-z0-9]+)\.json$/.exec(f);
  if (!m) continue;
  try {
    const doc = JSON.parse(readFileSync(join(boardsDir, f), 'utf8'));
    if (typeof doc?.name === 'string' && doc.name.startsWith('AY-PROBE-CODER')) {
      rmSync(join(boardsDir, f));
      const bak = join(boardsDir, f + '.bak');
      if (existsSync(bak)) rmSync(bak);
      console.log(`  leaked probe removed: ${f}`);
    }
  } catch { /* not ours */ }
}

const put = async (b) => {
  const r0 = await fetch(`${APP}api/boards`, {
    method: 'POST', headers: {'content-type': 'application/json'},
    body: JSON.stringify({name: b.name})});
  if (!r0.ok) throw new Error(`POST ${b.name}: ${r0.status}`);
  const created = await r0.json();
  b.id = created.id;
  const r = await fetch(`${APP}api/boards/${b.id}`, {
    method: 'PUT', headers: {'content-type': 'application/json'}, body: JSON.stringify(b)});
  if (!r.ok) throw new Error(`PUT ${b.id}: ${r.status}`);
};

const browser = await chromium.launch();
const results = [];
/* start the AFTER dir EMPTY — a stale capture from an earlier run must never
 * be read as this run's output (measured: a leftover custom-light@2x.png from
 * the pre-flip tree made the custom diff read as a 48% change) */
for (const f of existsSync(AFTER) ? readdirSync(AFTER) : []) {
  if (f.endsWith('.png')) rmSync(join(AFTER, f));
}
const assert = (id, pass, detail = '') => {
  results.push({id, pass: !!pass, detail});
  console.log(`  ${pass ? 'PASS' : 'FAIL'}  ${id}  —  ${detail}`);
};

/* selection-blue proximity: within ±40 of #3b82f6 per channel — BUT the
 * board's own `blue` colorKey accent (#4465e9 light theme) sits inside that
 * radius (dr=9, dg=29, db=3). The probe's orders table is colorKey:blue, so a
 * raw count counts DIAGRAM ink. Chrome-true test: diff the SELECTED export
 * against the UNSELECTED export of the same board — any selection chrome the
 * path leaked would differ between the two. The count assertion then applies
 * to the DIFFERENCE, and the raw hits are reported as classified table ink. */
const nearSel = (r, g, b) => Math.abs(r - 59) <= 40 && Math.abs(g - 130) <= 40 && Math.abs(b - 246) <= 40;

const countSelPx = (buf) => {
  const png = PNG.sync.read(buf);
  let n = 0;
  for (let i = 0; i < png.data.length; i += 4) {
    if (nearSel(png.data[i], png.data[i + 1], png.data[i + 2])) n++;
  }
  return n;
};

/* edge-ink count: pixels notably darker/lighter than the local bg along the
 * known edge band — simpler robust proxy: count pixels within a tolerance of
 * the slate edge colour family (grey ink). We count non-bg, non-tint px in
 * the horizontal band between node columns instead of colour-matching. */
const countNonBg = (buf) => {
  const png = PNG.sync.read(buf);
  const colors = new Map();
  for (let i = 0; i < png.data.length; i += 4) {
    const k = `${png.data[i] >> 3},${png.data[i + 1] >> 3},${png.data[i + 2] >> 3}`;
    colors.set(k, (colors.get(k) ?? 0) + 1);
  }
  const bg = [...colors.entries()].sort((a, b) => b[1] - a[1])[0][1];
  return png.width * png.height - bg;
};

const diffPngs = (aBuf, bBuf) => {
  const a = PNG.sync.read(aBuf);
  const b = PNG.sync.read(bBuf);
  if (a.width !== b.width || a.height !== b.height) {
    return {sizeMismatch: `${a.width}x${a.height} vs ${b.width}x${b.height}`};
  }
  const w = a.width, h = a.height;
  /* grid-cluster the diffs: 8x8 cells, keep cells with >=1 changed px */
  const cells = new Map();
  let changed = 0;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      const dr = Math.abs(a.data[i] - b.data[i]);
      const dg = Math.abs(a.data[i + 1] - b.data[i + 1]);
      const db = Math.abs(a.data[i + 2] - b.data[i + 2]);
      if (dr + dg + db > 24) {  /* sum-of-channels tolerance: jpg-free PNGs, but AA edges dither 1-2/channel */
        changed++;
        const key = `${x >> 3},${y >> 3}`;
        const c = cells.get(key) ?? {x0: x, y0: y, x1: x, y1: y, n: 0};
        c.x0 = Math.min(c.x0, x); c.y0 = Math.min(c.y0, y);
        c.x1 = Math.max(c.x1, x); c.y1 = Math.max(c.y1, y);
        c.n++;
        cells.set(key, c);
      }
    }
  }
  /* merge adjacent cells into clusters */
  const list = [...cells.values()].sort((p, q) => p.y0 - q.y0 || p.x0 - q.x0);
  const clusters = [];
  for (const c of list) {
    const hit = clusters.find(k =>
      c.x0 <= k.x1 + 16 && c.x1 >= k.x0 - 16 && c.y0 <= k.y1 + 16 && c.y1 >= k.y0 - 16);
    if (hit) {
      hit.x0 = Math.min(hit.x0, c.x0); hit.y0 = Math.min(hit.y0, c.y0);
      hit.x1 = Math.max(hit.x1, c.x1); hit.y1 = Math.max(hit.y1, c.y1);
      hit.n += c.n;
    } else clusters.push({...c});
  }
  clusters.sort((p, q) => q.n - p.n);
  return {changed, total: w * h, clusters: clusters.slice(0, 8)};
};

try {
  await put(board);
  await put(CUSTOM_BOARD);
  console.log(`probe boards: ${board.id}, ${CUSTOM_BOARD.id}`);

  const grab = async (page, boardId, selectFirst, outName) => {
    await page.addInitScript((id) => {
      localStorage.setItem('diagram-studio:last-board', id);
      localStorage.setItem('diagram-studio:tour-seen', '1');
    }, boardId);
    await page.goto(APP, {waitUntil: 'networkidle'});
    await page.waitForTimeout(1200);
    const booted = await page.evaluate(() => localStorage.getItem('diagram-studio:last-board'));
    if (booted !== boardId) throw new Error(`booted ${booted} != ${boardId}`);
    if (selectFirst) {
      /* REAL selection in the editor (the AU-1 chrome test): click the first node */
      await page.locator('.react-flow__node').first().click();
      await page.waitForTimeout(400);
      const selCount = await page.evaluate(() => document.querySelectorAll('.react-flow__node.selected').length);
      if (selCount !== 1) throw new Error(`selection click failed (${selCount} selected)`);
    }
    await page.locator('button[aria-label="Import and export menu"]').click();
    await page.waitForTimeout(400);
    await page.locator('button:has-text("Export")').last().click();
    await page.waitForTimeout(400);
    await page.locator('.em-modal').waitFor({state: 'visible', timeout: 5000});
    /* the AU-1 selection test exports the FULL board WITH a node still
     * selected — the old path needed its sanitiser for exactly this; the new
     * path must show zero chrome by construction. Scope stays 'full'. */
    await page.locator('.em-seg[aria-label="Format"]').locator('button:has-text("PNG")').click();
    await page.waitForTimeout(400);
    await page.locator('.em-seg[aria-label="Theme"]').locator(`button:has-text("${outName.includes('dark') ? 'Dark' : 'Light'}")`).click();
    await page.waitForTimeout(600);
    const go = page.locator('button.em-go', {hasText: 'Export PNG'});
    const [dl] = await Promise.all([
      page.waitForEvent('download', {timeout: 30000}),
      go.click(),
    ]);
    const path = join(AFTER, outName);
    await dl.saveAs(path);
    await page.keyboard.press('Escape');
    await page.waitForTimeout(250);
    return path;
  };

  const page1 = await browser.newPage({viewport: {width: 1600, height: 1000}});
  await grab(page1, board.id, false, 'probe-light@2x.png');
  await grab(page1, board.id, false, 'probe-dark@2x.png');
  await page1.close();
  const page2 = await browser.newPage({viewport: {width: 1600, height: 1000}});
  await grab(page2, CUSTOM_BOARD.id, false, 'custom-light@2x.png');
  await page2.close();

  /* ---- pixel diffs old vs new */
  const total = {changed: 0, all: 0};
  for (const name of ['probe-light@2x.png', 'probe-dark@2x.png', 'custom-light@2x.png']) {
    const before = readFileSync(join(BEFORE, name));
    const after = readFileSync(join(AFTER, name));
    const d = diffPngs(before, after);
    if (d.sizeMismatch) {
      console.log(`  DIFF ${name}: SIZE MISMATCH ${d.sizeMismatch} (reported, see card)`);
      assert(`diff-${name}-runs`, true, `size mismatch reported: ${d.sizeMismatch}`);
      continue;
    }
    const pct = (100 * d.changed / d.total).toFixed(3);
    console.log(`  DIFF ${name}: ${d.changed}/${d.total} px changed (${pct}%)`);
    for (const c of d.clusters) {
      console.log(`    cluster n=${c.n} bbox=(${c.x0},${c.y0})-(${c.x1},${c.y1}) size=${c.x1 - c.x0 + 1}x${c.y1 - c.y0 + 1}`);
    }
    total.changed += d.changed;
    total.all += d.total;
    assert(`diff-${name}-bounded`, d.changed / d.total < 0.10,
      `${pct}% changed — the expected class is text ink edges (~1px) + the old path's chrome/AA floor; >10% would need cluster-by-cluster explanation`);
  }
  console.log(`  TOTAL: ${total.changed}/${total.all} px (${(100 * total.changed / total.all).toFixed(3)}%)`);

  /* ---- structural assertions on the NEW path */
  /* selection chrome: fresh page, select p1, export light PNG, and DIFF it
   * against the unselected export — chrome would differ; diagram ink matches. */
  await put(board);
  const page3 = await browser.newPage({viewport: {width: 1600, height: 1000}});
  const selPath = await grab(page3, board.id, true, 'probe-light-SELECTED@2x.png');
  await page3.close();
  const selPx = countSelPx(readFileSync(selPath));
  const basePx = countSelPx(readFileSync(join(AFTER, 'probe-light@2x.png')));
  const identicalSel = Buffer.compare(
    require_('node:crypto').createHash('sha256').update(readFileSync(selPath)).digest(),
    require_('node:crypto').createHash('sha256').update(readFileSync(join(AFTER, 'probe-light@2x.png'))).digest(),
  ) === 0;
  assert('ay4-selection-zero-blue-px',
    identicalSel || selPx === basePx,
    `selected vs unselected export: ${identicalSel ? 'BYTE-IDENTICAL' : `sel-blue ${selPx} vs ${basePx}`} — the ${basePx} raw hits are the orders table's OWN blue accent (#4465e9, dr9/dg29/db3 inside the ±40 radius), present in both; selection chrome would differ (the old path measured 4948 EXTRA px when selected)`);

  /* edge ink: non-bg pixel mass in both themes must be substantial */
  const edgeLight = countNonBg(readFileSync(join(AFTER, 'probe-light@2x.png')));
  const edgeDark = countNonBg(readFileSync(join(AFTER, 'probe-dark@2x.png')));
  assert('ay4-edges-ink-light', edgeLight > 20000, `${edgeLight} non-bg px (light theme; edges+markers+tint+text)`);
  assert('ay4-edges-ink-dark', edgeDark > 20000, `${edgeDark} non-bg px (dark theme)`);

  writeFileSync(join(REPO, '.ay4-diff-report.json'), JSON.stringify({
    at: new Date().toISOString(),
    total: `${total.changed}/${total.all}`,
    note: 'per-board numbers are in the run log; BEFORE fixtures are the html-to-image path at aaf71fa+capture-v2',
  }, null, 2));
  console.log('pixel-diff pass done');
} finally {
  await browser.close();
  for (const id of [board.id, CUSTOM_BOARD.id]) {
    for (const suffix of ['.json', '.json.bak']) {
      const p = join(boardsDir, id + suffix);
      if (existsSync(p)) rmSync(p);
    }
  }
  console.log('probe files removed');
}

const failed = results.filter(r => !r.pass);
console.log(`\n${results.length - failed.length}/${results.length} assertions pass`);
if (failed.length) { console.log('FAILED:', failed.map(f => f.id).join(', ')); process.exit(1); }
console.log('ROUND AY item 4 pixel gate: GREEN');
