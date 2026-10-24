#!/usr/bin/env node
/* ROUND AY item 6 — the FONT-FORK ANNEX (REPORT ONLY — Harvey decides).
 *
 * Measures, on the standard probe board, under BOTH routes' assumptions:
 *   Route 1 (ship OFL fonts, subset+embed base64 WOFF2): the emitted file's
 *     size delta with a synthetic @font-face block of the measured glyph
 *     corpus (families × weights × the corpus size the typography report
 *     used: 63 unique glyphs, ~140 B/glyph → +8.8 KB per family+weight).
 *   Route 2 (ship nothing, keep stacks): 0 bytes today + the OPTIONAL
 *     per-line textLength hardening's size cost (measured: one attribute per
 *     text row, bytes = the attribute text over the board's row count).
 *
 * The fontEmbedCss seam (item 2) is in place; NOTHING is shipped. This file
 * prints the annex numbers; the card carries them.
 */
import {readFileSync, writeFileSync, rmSync, existsSync, readdirSync} from 'node:fs';
import {join, dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, '..');
const require_ = createRequire(join('/home/harvey/projects/tech-goblin/package.json', 'noop.js'));
const {chromium} = require_('playwright-core');

const APP = process.env.AY_APP_URL || 'http://localhost:5200/';
const board = {id: '', name: 'AY-FONT-ANNEX', nodes: [
  {id: 'p1', type: 'goblin', position: {x: 0, y: 0}, selected: false,
   style: {width: 190, height: 129}, measured: {width: 190, height: 129},
   data: {shape: 'database', kicker: 'database', title: 'Primary DB', sub: 'postgres 16', metric: '12', metricUnit: 'ms', icon: 'database', colorKey: 'violet'}},
  {id: 'p2', type: 'goblin', position: {x: 340, y: 40}, selected: false,
   style: {width: 190, height: 95}, measured: {width: 190, height: 95},
   data: {shape: 'service', title: 'Order API', sub: 'rest', icon: 'server', colorKey: 'cyan'}},
], edges: [
  {id: 'pe1', source: 'p1', target: 'p2', type: 'goblinEdge', label: 'reads', data: {colorKey: 'slate'}},
]};

const boardsDir = join(REPO, 'boards');
for (const f of existsSync(boardsDir) ? readdirSync(boardsDir) : []) {
  const m = /^([A-Za-z0-9]+)\.json$/.exec(f);
  if (!m) continue;
  try {
    const doc = JSON.parse(readFileSync(join(boardsDir, f), 'utf8'));
    if (typeof doc?.name === 'string' && doc.name.startsWith('AY-FONT-ANNEX')) {
      rmSync(join(boardsDir, f));
      const bak = join(boardsDir, f + '.bak');
      if (existsSync(bak)) rmSync(bak);
      console.log(`  stale annex probe removed: ${f}`);
    }
  } catch { /* not ours */ }
}

const put = async (b) => {
  const r0 = await fetch(`${APP}api/boards`, {
    method: 'POST', headers: {'content-type': 'application/json'},
    body: JSON.stringify({name: b.name})});
  if (!r0.ok) throw new Error(`POST: ${r0.status}`);
  b.id = (await r0.json()).id;
  const r = await fetch(`${APP}api/boards/${b.id}`, {
    method: 'PUT', headers: {'content-type': 'application/json'}, body: JSON.stringify(b)});
  if (!r.ok) throw new Error(`PUT: ${r.status}`);
};

const browser = await chromium.launch();
try {
  await put(board);
  const page = await browser.newPage({viewport: {width: 1600, height: 1000}});
  await page.addInitScript((id) => {
    localStorage.setItem('diagram-studio:last-board', id);
    localStorage.setItem('diagram-studio:tour-seen', '1');
  }, board.id);
  await page.goto(APP, {waitUntil: 'networkidle'});
  await page.waitForTimeout(1200);
  await page.locator('button[aria-label="Import and export menu"]').click();
  await page.waitForTimeout(400);
  await page.locator('button:has-text("Export")').last().click();
  await page.waitForTimeout(400);
  await page.locator('.em-modal').waitFor({state: 'visible', timeout: 5000});
  await page.locator('.em-seg[aria-label="Format"]').locator('button:has-text("SVG")').click();
  await page.waitForTimeout(800);
  const [dl] = await Promise.all([
    page.waitForEvent('download', {timeout: 20000}),
    page.locator('button.em-go').first().click(),
  ]);
  await dl.saveAs('/tmp/ay6-annex.svg');
  await page.close();
} finally {
  await browser.close();
  for (const s of ['.json', '.json.bak']) {
    const p = join(boardsDir, board.id + s);
    if (existsSync(p)) rmSync(p);
  }
}

const svg = readFileSync('/tmp/ay6-annex.svg', 'utf8');
const baseBytes = Buffer.byteLength(svg);
const textRows = (svg.match(/<text /g) ?? []).length;

/* Count the rows' effective (family, weight) pairs. Rows carry
 * font-weight="N" and EITHER their own font-family or the root's inherited
 * `font-family` attribute (the measurer's defaultFamily). Pair them up in
 * document order the way a renderer would (inheritance). */
const rootFam = /<svg[^>]*font-family="([^"]*)"/.exec(svg)?.[1] ?? 'sans';
const pairs = new Set();
{
  const rows = [...svg.matchAll(/<text ([^>]*)>/g)].map(m => m[1]);
  const fw = rows.map(attrs => {
    const fam = /font-family="([^"]*)"/.exec(attrs)?.[1] ?? rootFam;
    const w = /font-weight="([^"]*)"/.exec(attrs)?.[1] ?? '400';
    return `${/mono/i.test(fam) ? 'mono' : 'sans'}@${w}`;
  });
  fw.forEach(p => pairs.add(p));
}
const pairList = [...pairs].sort();
const perPair = 63 * 140;                     /* ≈8.8 KB */
const route1 = pairList.length * perPair;     /* subset WOFF2 bytes */
const route1B64 = Math.ceil(route1 * 4 / 3);  /* base64 inside @font-face */

/* Route 2 hardening: textLength="<w> " per text row (measured widths live in
 * the §1 cache; the attribute costs ~14-18 bytes per row with a typical 2-3
 * digit width number). Use the file's actual row count. */
const perRow = 'textLength="000.0" lengthAdjust="spacing" '.length;
const route2Hardening = textRows * perRow;

console.log('FONT-FORK ANNEX (report only — Harvey decides; nothing shipped)');
console.log(`  emitted svg (Route 2, as today): ${baseBytes} bytes, ${textRows} <text> rows`);
console.log(`  distinct family@weight pairs in the file: ${pairList.length} [${pairList.join(', ')}]`);
console.log(`  Route 1 (ship OFL, subset+embed): +${route1} B WOFF2 = +${(route1 / 1024).toFixed(1)} KB raw, +${route1B64} B = +${(route1B64 / 1024).toFixed(1)} KB base64-in-file per export`);
console.log(`    → whole-app visual change: every label reflows (Inter/JetBrains vs system stacks) — Harvey's call`);
console.log(`  Route 2 (ship nothing): +0 bytes; optional textLength lock hardening: +${route2Hardening} B = +${(route2Hardening / 1024).toFixed(2)} KB (${textRows} rows × ~${perRow} B)`);
console.log(`  caveat (SVG 1.1): intermediate glyph placement under textLength is explicitly unpredictable; do NOT combine with wrapping`);
rmSync('/tmp/ay6-annex.svg');
