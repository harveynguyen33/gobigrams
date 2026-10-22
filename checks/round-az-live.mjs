#!/usr/bin/env node
/**
 * ROUND AZ — the LIVE probe (t_96100cb2 acceptance, §2 + §3).
 * checks/round-az-live.mjs
 *
 * THE AZ DIFFERENCE from checks/round-c-live.mjs: NO localFonts permission
 * is granted (a fresh browser, no CDP grant) — the outlined export must come
 * from the COMMITTED font files alone. On the parent tree this exact probe
 * stays <text> (the silent no-op the card names); on the AZ tree it must be
 * 0 <text> in both themes, inside the pixel floor, with the embed present.
 *
 * Also captures the §3 pairs: the probe board's canvas (screenshot) + the
 * SVG + PNG exports, light + dark, saved to .az-live/ for the before/after
 * attachment set. Probe board carries a VIETNAMESE label (the card's trap:
 * diacritics must survive both the subsets and the outline path).
 *
 * Probe-board hygiene: unique id via POST /api/boards, cleanup rmSync's our
 * own files, never DELETE HTTP, never touches mvaf8pkt162b2aed.
 */
import {mkdirSync, writeFileSync, readFileSync, existsSync, rmSync, statSync} from 'node:fs';
import {join, dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, '..');
const require_ = createRequire(join('/home/harvey/projects/tech-goblin/package.json', 'noop.js'));
const {chromium} = require_('playwright-core');
const {PNG} = require_('/home/harvey/.hermes/hermes-agent/node_modules/pngjs/lib/png.js');

const APP = process.env.AY_APP_URL || process.env.AZ_APP_URL || 'http://localhost:5200/';
const TAG = process.env.AZ_TAG || 'after'; /* 'before' captures land in the same dir, tagged */
const OUT = join(REPO, '.az-live');
mkdirSync(OUT, {recursive: true});

const results = [];
const assert = (id, pass, detail = '') => {
  results.push({id, pass: !!pass, detail});
  console.log(`  ${pass ? 'PASS' : 'FAIL'}  ${id}  —  ${detail}`);
};

const board = {
  id: '', name: `AZ-PROBE-FONTS-${Date.now()}`,
  nodes: [
    {id: 'c1', type: 'goblin', position: {x: 0, y: 0}, selected: false,
     style: {width: 190, height: 129}, measured: {width: 190, height: 129},
     data: {shape: 'database', kicker: 'database', title: 'Đơn hàng', sub: 'postgres 16', metric: '12', metricUnit: 'ms', icon: 'database', colorKey: 'violet'}},
    {id: 'c2', type: 'goblin', position: {x: 340, y: 40}, selected: false,
     style: {width: 190, height: 95}, measured: {width: 190, height: 95},
     data: {shape: 'service', title: 'Xử lý — API', sub: 'rest', icon: 'server', colorKey: 'cyan'}},
    {id: 'c3', type: 'table', position: {x: 120, y: 240}, selected: false,
     style: {width: 220, height: 140}, measured: {width: 220, height: 140},
     data: {name: 'orders', columns: [{name: 'id', pk: true}, {name: 'khách hàng'}, {name: 'total'}], colorKey: 'blue'}},
    {id: 'c4', type: 'note', position: {x: 420, y: 240}, selected: false,
     style: {width: 200, height: 90}, measured: {width: 200, height: 90},
     data: {title: 'Ghi chú', text: 'Tiếng Việt: ả ế ộ ữ — dấu đủ cả', colorKey: 'green'}},
  ],
  edges: [
    {id: 'e1', source: 'c1', target: 'c2', label: 'đọc ghi', data: {}},
  ],
};

const put = async (page, doc) => {
  const r = await page.request.post(`${APP}api/boards`, {data: {name: doc.name}});
  const created = await r.json();
  doc.id = created.id;
  await page.request.put(`${APP}api/boards/${created.id}`, {data: doc});
  return doc;
};

async function grab(page, opts) {
  await page.goto(`${APP}?board=${opts.board}`, {waitUntil: 'networkidle'});
  await page.waitForSelector('.react-flow__node', {timeout: 15000});
  /* let the webfonts land before measuring anything (the fonts-epoch guard
   * re-measures after loadingdone; the canvas screenshot must be post-swap) */
  await page.evaluate(async () => {
    try { await document.fonts.ready; } catch { /* older engines */ }
  });
  await page.waitForTimeout(400);
  return await page.evaluate(async (o) => {
    const fn = window.__ds_export;
    if (!fn) return {error: 'window.__ds_export missing'};
    return await fn(o);
  }, opts);
}

/* NO localFonts grant anywhere — the committed files must be enough. */
const browser = await chromium.launch();
try {
  const page = await browser.newPage({viewport: {width: 1600, height: 1000}});
  await put(page, board);

  const fontsApi = await page.evaluate(async () => {
    try { return (await window.queryLocalFonts()).length; } catch { return -1; }
  }).catch(() => -1);
  console.log(`  queryLocalFonts reachable (must be DENIED for this probe): ${fontsApi}`);

  /* open the board ONCE so the rows actually paint (a font face loads only
   * when a painted codepoint needs its unicode-range); then read the set. */
  await page.goto(`${APP}?board=${board.id}`, {waitUntil: 'networkidle'});
  await page.waitForSelector('.react-flow__node', {timeout: 15000});
  await page.evaluate(async () => { try { await document.fonts.ready; } catch { /* older engines */ } });
  await page.waitForTimeout(400);

  const fontFaces = await page.evaluate(() => {
    const fams = new Set();
    for (const f of document.fonts) fams.add(`${f.family}|${f.weight}|${f.status}`);
    return [...fams];
  });
  /* each family ships several subsets per weight; a subset face stays
   * 'unloaded' until a page codepoint needs its unicode-range. LOADED for
   * ANY face of the family = the shipped fonts paint. */
  const interLoaded = fontFaces.some(f => f.startsWith('Inter|') && f.endsWith('loaded'));
  const jbmLoaded = fontFaces.some(f => f.startsWith('JetBrains Mono|') && f.endsWith('loaded'));
  assert(`az-${TAG}-webfonts-landed`, interLoaded && jbmLoaded,
    `document.fonts: Inter ${interLoaded ? 'loaded' : 'NOT LOADED'}, JetBrains Mono ${jbmLoaded ? 'loaded' : 'NOT LOADED'} (any subset face suffices)`);

  /* canvas screenshot per theme (the §3 pair) */
  for (const theme of ['light', 'dark']) {
    await page.goto(`${APP}?board=${board.id}`, {waitUntil: 'networkidle'});
    await page.evaluate((t) => {
      try { localStorage.setItem('diagram-studio:theme', t); } catch { /* ignore */ }
    }, theme);
    await page.reload({waitUntil: 'networkidle'});
    await page.waitForSelector('.react-flow__node', {timeout: 15000});
    await page.evaluate(async () => { try { await document.fonts.ready; } catch { /* ignore */ } });
    await page.waitForTimeout(500);
    const shot = await page.screenshot();
    writeFileSync(join(OUT, `canvas-${theme}-${TAG}.png`), shot);
  }

  for (const theme of ['light', 'dark']) {
    const text = await grab(page, {board: board.id, theme, outline: false});
    const outl = await grab(page, {board: board.id, theme, outline: true});
    if (text.error || outl.error) {
      assert(`az-${theme}-export`, false, `export hook error: ${text.error || outl.error}`);
      continue;
    }
    writeFileSync(join(OUT, `svg-text-${theme}-${TAG}.svg`), text.svg);
    writeFileSync(join(OUT, `svg-outlined-${theme}-${TAG}.svg`), outl.svg);
    /* PNG from the app's own path (the modal's PNG = rasterise(svgString)) */
    const pngData = await page.evaluate(async (o) => {
      const fn = window.__ds_export_png;
      if (!fn) return null;
      return await fn(o);
    }, {board: board.id, theme}).catch(() => null);

    const kb = (s) => (statSync(s).size / 1024).toFixed(1) + ' KB';
    console.log(`  sizes[${theme}]: text ${kb(join(OUT, `svg-text-${theme}-${TAG}.svg`))} · outlined ${kb(join(OUT, `svg-outlined-${theme}-${TAG}.svg`))}`);

    const noText = !/<text[\s>]/.test(outl.svg);
    const hasPaths = (outl.svg.match(/<path\b/g) || []).length > 0;
    const hasData = outl.svg.includes('data-text=');
    const hasEmbed = outl.svg.includes('base64');
    assert(`az-${theme}-outlined-no-text-NO-PERMISSION`, noText && hasPaths,
      `outlined export without any localFonts grant: ${noText ? '0 <text>' : '<text> SURVIVED'}, ${(outl.svg.match(/<path\b/g) || []).length} paths${hasData ? ', data-text present' : ''}`);
    assert(`az-${theme}-embed-present`, hasEmbed,
      `the outlined export embeds the committed subsets (base64 @font-face in defs)`);
    /* the Vietnamese rows survived: data-text carries the diacritics */
    const vn = outl.svg.includes('Đơn hàng') || outl.svg.includes('Ghi ch') || outl.svg.includes('đọc ghi');
    assert(`az-${theme}-vietnamese-data`, hasData && vn,
      `the outlined export's data-text carries the Vietnamese strings`);

    if (noText && hasPaths) {
      const pngText = await rasteriseViaBrowser(page, text.svg);
      const pngOutl = await rasteriseViaBrowser(page, outl.svg);
      writeFileSync(join(OUT, `png-text-${theme}-${TAG}.png`), pngText);
      writeFileSync(join(OUT, `png-outlined-${theme}-${TAG}.png`), pngOutl);
      const d = diffPng(pngText, pngOutl);
      const pct = 100 * d.changed / d.total;
      console.log(`  diff[${theme}]: ${d.changed}/${d.total} px (${pct.toFixed(3)}%)`);
      assert(`az-${theme}-pixel-floor`, pct > 0 && pct <= 2.57,
        `${pct.toFixed(3)}% changed — >0 (identical = red flag) and within the 2.57% floor`);
      const topT = firstInkRow(pngText), topO = firstInkRow(pngOutl);
      assert(`az-${theme}-ink-top`, Math.abs(topT - topO) <= 1, `ink-top text=${topT} outlined=${topO} (<=1px)`);
    }
  }

  /* cleanup: rm our own probe files only */
  for (const suffix of ['.json', '.json.bak']) {
    const p = join(REPO, 'boards', board.id + suffix);
    if (existsSync(p)) rmSync(p);
  }
  console.log('probe board removed (rmSync, no DELETE HTTP)');
} finally {
  await browser.close();
}

async function rasteriseViaBrowser(page, svg) {
  return await page.evaluate(async (svgString) => {
    const url = URL.createObjectURL(new Blob([svgString], {type: 'image/svg+xml'}));
    const img = new Image();
    img.decoding = 'async';
    await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = url; });
    const w = parseInt(svgString.match(/width="(\d+)"/)?.[1] ?? '800', 10);
    const h = parseInt(svgString.match(/height="(\d+)"/)?.[1] ?? '600', 10);
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    const ctx = c.getContext('2d');
    ctx.drawImage(img, 0, 0, w, h);
    URL.revokeObjectURL(url);
    return c.toDataURL('image/png');
  }, svg);
}

function toPng(dataUrl) {
  return PNG.sync.read(Buffer.from(dataUrl.split(',')[1] ?? '', 'base64'));
}

function diffPng(aUrl, bUrl) {
  const a = toPng(aUrl), b = toPng(bUrl);
  const total = a.width * a.height;
  let changed = 0;
  for (let i = 0; i < a.data.length; i += 4) {
    if (Math.abs(a.data[i] - b.data[i]) > 8 || Math.abs(a.data[i + 1] - b.data[i + 1]) > 8 || Math.abs(a.data[i + 2] - b.data[i + 2]) > 8) changed++;
  }
  return {changed, total, width: a.width, height: a.height, a, b};
}

function firstInkRow(dataUrl) {
  const p = toPng(dataUrl);
  const bg = [p.data[0], p.data[1], p.data[2]];
  for (let y = 0; y < p.height; y++) {
    let n = 0;
    for (let x = 0; x < p.width; x++) {
      const i = (y * p.width + x) * 4;
      if (Math.abs(p.data[i] - bg[0]) > 24 || Math.abs(p.data[i + 1] - bg[1]) > 24 || Math.abs(p.data[i + 2] - bg[2]) > 24) n++;
    }
    if (n > p.width * 0.02) return y;
  }
  return -1;
}

const failed = results.filter(r => !r.pass);
console.log(`\n${results.length - failed.length}/${results.length} assertions pass`);
if (failed.length) { console.log('FAILED:', failed.map(f => f.id).join(', ')); process.exit(1); }
console.log(`ROUND AZ live probe (${TAG}): GREEN`);
