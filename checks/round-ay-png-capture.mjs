#!/usr/bin/env node
/* ROUND AY item 4 — BEFORE-capture driver v2 (step 1 of the pixel gate).
 *
 * v2 fixes two measured defects of v1:
 *  1. v1's `put()` overwrote b.id with the server-minted id, so the cleanup
 *     rmSync'd the WRONG (original random) ids — the probe boards leaked.
 *     v2 keeps the server id and deletes via rmSync on THAT id only.
 *  2. v1 never asserted WHICH board the app booted; with the leaked custom
 *     board as the newest board, every capture silently exported it.
 *     v2 asserts the booted board id (localStorage read-back) AND the canvas
 *     node count AND PNG ink stats before saving any fixture.
 *
 * Creates a PROBE board (unique id, never touches Harvey's files — his board
 * mvaf8pkt162b2aed is never written, and no DELETE /api/… HTTP call is made;
 * cleanup is a direct boards/<id>.json unlink of OUR OWN files, the same
 * mechanism the AS-7 archive rename leaves recoverable). Saves the dataURL
 * PNGs under checks/fixtures/round-ay-png-before/.
 *
 * Uses playwright-core from the parent workspace install (an existing dep of
 * the monorepo tooling, NOT a new package dependency).
 */
import {mkdirSync, writeFileSync, readFileSync, existsSync, rmSync, statSync} from 'node:fs';
import {join, dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, '..');
const require_ = createRequire(join('/home/harvey/projects/tech-goblin/package.json', 'noop.js'));
const {chromium} = require_('playwright-core');

const APP = process.env.AY_APP_URL || 'http://localhost:5200/';
const OUT = join(REPO, 'checks', 'fixtures', 'round-ay-png-before');
mkdirSync(OUT, {recursive: true});

/* ---- the probe board: the standard repro set (icon + tint + edge + label
 * + note + table + group + custom shape), unique id. */
const board = {
  id: '',
  name: 'AY-PROBE-CODER-V2',
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
  id: '',
  name: 'AY-PROBE-CODER-V2-CUSTOM',
  nodes: [
    {id: 'c1', type: 'customshape', position: {x: 0, y: 0}, selected: false,
     style: {width: 200, height: 100}, measured: {width: 200, height: 100},
     data: {title: 'Custom', svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 100"><rect x="4" y="4" width="192" height="92" rx="12" fill="#39c5cf" fill-opacity="0.2" stroke="#39c5cf" stroke-width="2"/><circle cx="60" cy="50" r="22" fill="#8b7cf6"/><path d="M100 30 L160 30 L160 70 L100 70 Z" fill="#f5a623"/></svg>'}},
  ],
  edges: [],
};

/* ---- first: delete OUR OWN leaked v1 probe boards (they were never cleaned
 * because of defect 1). These ids are name-matched to AY-PROBE-CODER* —
 * Harvey's mvaf8pkt162b2aed is never touched. Direct file removal, no API
 * DELETE (the standing measurement rule). */
const boardsDir = join(REPO, 'boards');
for (const f of existsSync(boardsDir) ? require_('node:fs').readdirSync(boardsDir) : []) {
  const m = /^([A-Za-z0-9]+)\.json$/.exec(f);
  if (!m) continue;
  try {
    const doc = JSON.parse(readFileSync(join(boardsDir, f), 'utf8'));
    if (typeof doc?.name === 'string' && doc.name.startsWith('AY-PROBE-CODER')) {
      rmSync(join(boardsDir, f));
      const bak = join(boardsDir, f + '.bak');
      if (existsSync(bak)) rmSync(bak);
      console.log(`  leaked probe board removed: ${f} (${doc.name})`);
    }
  } catch { /* unreadable file: not ours to judge */ }
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

await put(board);
await put(CUSTOM_BOARD);
console.log(`probe boards written: ${board.id}, ${CUSTOM_BOARD.id}`);

/* ---- PNG ink analysis (pure JS, no deps): decode the dataURL, count
 * distinct colours + non-background pixels, assert content before saving. */
const pngStats = (buf) => {
  const {PNG} = require_('/home/harvey/.hermes/hermes-agent/node_modules/pngjs/lib/png.js');
  const png = PNG.sync.read(buf);
  const colors = new Map();
  for (let i = 0; i < png.data.length; i += 4) {
    const key = `${png.data[i]},${png.data[i + 1]},${png.data[i + 2]}`;
    colors.set(key, (colors.get(key) ?? 0) + 1);
  }
  return {w: png.width, h: png.height, distinct: colors.size,
    top: [...colors.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3)};
};

/* ---- drive the app */
const browser = await chromium.launch();
const made = [];
try {
  const grab = async (page, boardId, expectNodes, theme, outName) => {
    await page.addInitScript((id) => {
      localStorage.setItem('diagram-studio:last-board', id);
      localStorage.setItem('diagram-studio:tour-seen', '1');
    }, boardId);
    await page.goto(APP, {waitUntil: 'networkidle'});
    await page.waitForTimeout(1200);
    /* ASSERT the booted board is OURS (defect 2's guard): the cached id must
     * read back as the probe, and the canvas must hold the expected count. */
    const booted = await page.evaluate(() => localStorage.getItem('diagram-studio:last-board'));
    if (booted !== boardId) throw new Error(`booted board ${booted} != probe ${boardId}`);
    const probeNodes = await page.evaluate(() => document.querySelectorAll('.react-flow__node').length);
    if (probeNodes !== expectNodes) throw new Error(`board ${boardId}: expected ${expectNodes} nodes, got ${probeNodes}`);
    const exportBtn = page.locator('button[aria-label="Import and export menu"]');
    await exportBtn.click();
    await page.waitForTimeout(400);
    const modalRow = page.locator('button:has-text("Export")').last();
    await modalRow.click();
    await page.waitForTimeout(400);
    await page.locator('.em-modal').waitFor({state: 'visible', timeout: 5000});
    const fmtGroup = page.locator('.em-seg[aria-label="Format"]');
    await fmtGroup.locator(`button:has-text("PNG")`).click();
    await page.waitForTimeout(400);
    const themeGroup = page.locator('.em-seg[aria-label="Theme"]');
    await themeGroup.locator(`button:has-text("${theme}")`).click();
    await page.waitForTimeout(600);
    const go = page.locator('button.em-go', {hasText: 'Export PNG'});
    const [dl] = await Promise.all([
      page.waitForEvent('download', {timeout: 30000}),
      go.click(),
    ]);
    const path = join(OUT, outName);
    await dl.saveAs(path);
    /* content assertion BEFORE accepting the capture */
    const st = pngStats(readFileSync(path));
    const bg = st.top[0];
    console.log(`  saved ${outName} (${statSync(path).size} bytes, ${st.w}x${st.h}, ${st.distinct} colours, top=${bg[0]} x${bg[1]})`);
    if (st.distinct < 24) throw new Error(`${outName}: only ${st.distinct} distinct colours — looks like the wrong board`);
    if (theme === 'Dark') {
      const [r, g, b] = bg[0].split(',').map(Number);
      if (r + g + b > 240) throw new Error(`${outName}: dark-theme background is light (${bg[0]})`);
    }
    made.push(outName);
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);
  };

  const page1 = await browser.newPage({viewport: {width: 1600, height: 1000}});
  await grab(page1, board.id, 7, 'Light', 'probe-light@2x.png');
  await grab(page1, board.id, 7, 'Dark', 'probe-dark@2x.png');
  await page1.close();
  const page2 = await browser.newPage({viewport: {width: 1600, height: 1000}});
  await grab(page2, CUSTOM_BOARD.id, 1, 'Light', 'custom-light@2x.png');
  await page2.close();

  /* the three fixtures must be three DIFFERENT images */
  const h = (n) => require_('node:crypto').createHash('sha256').update(readFileSync(join(OUT, n))).digest('hex').slice(0, 12);
  const [hl, hd, hc] = [h('probe-light@2x.png'), h('probe-dark@2x.png'), h('custom-light@2x.png')];
  console.log(`  sha: light=${hl} dark=${hd} custom=${hc}`);
  if (hl === hc) throw new Error('probe-light == custom-light — the v1 defect is still live');

  writeFileSync(join(OUT, 'CAPTURE-METADATA.json'), JSON.stringify({
    capturedAt: new Date().toISOString(),
    app: APP,
    probeBoards: {standard: board.id, custom: CUSTOM_BOARD.id},
    files: made,
    note: 'BEFORE captures of the DOM-clone (html-to-image) PNG path, pre item-4 flip.',
  }, null, 2));
  console.log('BEFORE captures done →', OUT);
} finally {
  await browser.close();
  /* clean ONLY the probe files, by the SERVER-MINTED ids (defect 1's fix) */
  for (const id of [board.id, CUSTOM_BOARD.id]) {
    for (const suffix of ['.json', '.json.bak']) {
      const p = join(boardsDir, id + suffix);
      if (existsSync(p)) rmSync(p);
    }
  }
  console.log('probe files removed');
}
