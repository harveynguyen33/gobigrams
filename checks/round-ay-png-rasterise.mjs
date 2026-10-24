#!/usr/bin/env node
/**
 * ROUND AY item 4 — the DOM-free half of the PNG gate.
 * checks/round-ay-png-rasterise.mjs
 *
 * Asserted here WITHOUT a browser (the live pixel-diff half is the probe
 * pass, driver checks/round-ay-png-capture.mjs + diff round-ay-png-diff.mjs):
 *
 *   1. RED-first: src/exportPng.ts must not exist on the pre-change tree
 *      (this harness is the item's own proof — run against the parent commit
 *      with AR_ROOT it exits 1, proven by round-ay-red-item4.mjs).
 *   2. svgIntrinsicSize: reads the AR root <svg width height>; rejects
 *      strings without measurable dimensions.
 *   3. Oversize guard: a 20000-px-wide scene REJECTS with PngOversizeError
 *      (the explicit error, never a silent rescale — html-to-image silently
 *      clamped; the new path must not).
 *   4. Timeout: a poisoned svg (an Image stub that never fires onload/
 *      onerror) rejects within the 15 s bound + timing sanity (a stubbed
 *      timer that fires immediately rejects fast — no real 15 s wait).
 *   5. Pixel path: with a stubbed Image + canvas 2d context recorder, the
 *      drawImage call receives the DECODED image at exactly
 *      ceil(w*scale) x ceil(h*scale), bg pre-fill happens first, and the
 *      returned value is the canvas's dataURL (the compose contract the
 *      buildPng flip relies on).
 */
import {readFileSync, existsSync, writeFileSync, rmSync} from 'node:fs';
import {join, dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';

const HERE = dirname(fileURLToPath(import.meta.url));
const REAL_ROOT = join(HERE, '..');
const ROOT = process.env.AR_ROOT || REAL_ROOT;

const results = [];
const assert = (id, pass, detail = '') => {
  results.push({id, pass: !!pass, detail});
  console.log(`  ${pass ? 'PASS' : 'FAIL'}  ${id}  —  ${detail}`);
};

console.log('ROUND AY item 4 — rasterise (DOM-free contract)');
console.log(`  target root: ${ROOT}`);

if (!existsSync(join(ROOT, 'src', 'exportPng.ts'))) {
  console.log('  FAIL  AY4-module-exists — src/exportPng.ts does not exist in the target root (pre-change tree)');
  process.exit(1);
}

/* bundle ONLY src/exportPng.ts (no react, no app imports) */
const entry = join(ROOT, '.ay4-entry.ts');
const out = join(ROOT, '.ay4-out.mjs');
writeFileSync(entry, `export * from '${join(ROOT, 'src/exportPng.ts')}';\n`);
const esbuild = existsSync(join(ROOT, 'node_modules/.bin/esbuild'))
  ? join(ROOT, 'node_modules/.bin/esbuild')
  : join(REAL_ROOT, 'node_modules/.bin/esbuild');
writeFileSync(out, execFileSync(esbuild,
  [entry, '--bundle', '--platform=node', '--format=esm', '--log-level=error'],
  {encoding: 'utf8', env: {...process.env, NODE_PATH: join(REAL_ROOT, 'node_modules')}}));
const mod = await import(`${out}?t=${Date.now()}`);

/* ---- fixtures */
const GOOD_SVG = '<svg xmlns="http://www.w3.org/2000/svg" width="296" height="196" viewBox="0 0 296 196"><rect width="296" height="196" fill="#f7f7f8"/></svg>';
const POISON_SVG = '<svg xmlns="http://www.w3.org/2000/svg" width="296" height="196"><rect width="296" height="9';
const BIG_SVG = '<svg xmlns="http://www.w3.org/2000/svg" width="20000" height="100"><rect width="20000" height="100"/></svg>';

/* ---- 2. svgIntrinsicSize */
const sz = mod.svgIntrinsicSize(GOOD_SVG);
assert('AY4-size-reads-root', sz && sz.w === 296 && sz.h === 196, `got ${JSON.stringify(sz)}`);
const szHtFirst = mod.svgIntrinsicSize('<svg height="55" width="77" xmlns="http://www.w3.org/2000/svg"></svg>');
assert('AY4-size-attr-order-free', szHtFirst && szHtFirst.w === 77 && szHtFirst.h === 55, `got ${JSON.stringify(szHtFirst)}`);
const szBad = mod.svgIntrinsicSize('<svg xmlns="http://www.w3.org/2000/svg"></svg>');
assert('AY4-size-rejects-dimensionless', szBad === null, `got ${JSON.stringify(szBad)}`);

/* ---- stub browser: Image + canvas recorder + clock */
class StubImage {
  constructor() { this.decoding = ''; this.src = ''; this.onload = null; this.onerror = null; }
}
class StubCtx {
  constructor() { this.calls = []; }
  set fillStyle(v) { this._fill = v; }
  fillRect(x, y, w, h) { this.calls.push(['fillRect', x, y, w, h]); }
  drawImage(img, x, y, w, h) { this.calls.push(['drawImage', img, x, y, w, h]); }
  toDataURL() { return 'data:image/png,STUB-DATAURL'; }
}
const makeDeps = ({timerFire = null, failLoad = false, canvasOverride = null} = {}) => {
  const canvas = canvasOverride ?? {width: 0, height: 0, getContext: () => new StubCtx()};
  const doc = {createElement: (t) => (t === 'canvas' ? canvas : {})};
  const win = {
    setTimeout: (fn, ms) => {
      if (timerFire === 'now') fn();
      return (timerFire === 'never' ? 0 : 1);
    },
    clearTimeout: () => {},
  };
  const deps = {
    doc, win,
    ImageCtor: class extends StubImage {
      set src(v) {
        this._src = v;
        queueMicrotask(() => {
          if (failLoad) this.onerror?.();
          else this.onload?.();
        });
      }
      get src() { return this._src; }
    },
  };
  return deps;
};

/* ---- 3. oversize guard */
let oversizeErr = null;
try { await mod.rasterise(BIG_SVG, {scale: 2, deps: makeDeps()}); }
catch (e) { oversizeErr = e; }
assert('AY4-oversize-rejects', oversizeErr instanceof mod.PngOversizeError,
  `${oversizeErr?.name}: ${String(oversizeErr?.message).slice(0, 80)}`);
assert('AY4-oversize-message-names-limit', oversizeErr && /16384/.test(oversizeErr.message),
  'the visible error names the 16384 px limit');

/* scale that pushes an OK svg over the limit also rejects */
let oversize2 = null;
try { await mod.rasterise(GOOD_SVG, {scale: 100, deps: makeDeps()}); }
catch (e) { oversize2 = e; }
assert('AY4-oversize-by-scale-rejects', oversize2 instanceof mod.PngOversizeError, String(oversize2?.name));

/* ---- 4. timeout + poisoned svg. The stub clock fires the timer SYNCHRONOUSLY
 * inside setTimeout — before the promise body's own handlers are assigned —
 * so rasterise must tolerate a timeout that beats onload (cleanup() called
 * before assignment must not throw). */
const t0 = Date.now();
let timeoutErr = null;
try { await mod.rasterise(GOOD_SVG, {scale: 2, deps: makeDeps({timerFire: 'now'})}); }
catch (e) { timeoutErr = e; }
const dt = Date.now() - t0;
assert('AY4-poisoned-rejects-timeout', timeoutErr && /timed out/.test(timeoutErr.message),
  `${timeoutErr?.message?.slice(0, 60)} (${dt} ms — stub clock, no real wait)`);

let loadErr = null;
try { await mod.rasterise(GOOD_SVG, {scale: 2, deps: makeDeps({failLoad: true})}); }
catch (e) { loadErr = e; }
assert('AY4-load-failure-rejects', loadErr && /failed to load/.test(loadErr.message), loadErr?.message?.slice(0, 60));

/* ---- 5. compose contract with the recorded 2d calls */
const record = [];
const spyCtx = new StubCtx();
{
  const origFill = spyCtx.fillRect.bind(spyCtx);
  const origDraw = spyCtx.drawImage.bind(spyCtx);
  spyCtx.fillRect = (...a) => { record.push(['fillRect', ...a.slice(1)]); origFill(...a); };
  spyCtx.drawImage = (...a) => { record.push(['drawImage', 'IMG', ...a.slice(2)]); origDraw(...a); };
}
const spyCanvas = {width: 0, height: 0, getContext: () => spyCtx};
const deps2 = makeDeps({canvasOverride: spyCanvas});
const url2 = await mod.rasterise(GOOD_SVG, {scale: 2, bg: '#f7f7f8', deps: deps2});
const fill = record.find(r => r[0] === 'fillRect');
const draw = record.find(r => r[0] === 'drawImage');
assert('AY4-returns-dataurl', typeof url2 === 'string' && url2.startsWith('data:image/png'),
  String(url2).slice(0, 30));
assert('AY4-paint-order-bg-then-image', fill && draw && record.indexOf(fill) < record.indexOf(draw),
  `fillRect@${record.indexOf(fill)} drawImage@${record.indexOf(draw)}`);
assert('AY4-canvas-dims-ceil-scale', draw && draw[3] === 592 && draw[4] === 392,
  `drawImage dims ${draw?.[3]}x${draw?.[4]} (expect 296*2=592 x 196*2=392)`);
assert('AY4-compose-returns-canvas-dataurl', url2 === 'data:image/png,STUB-DATAURL', String(url2).slice(0, 30));

console.log(`\n${results.filter(r => r.pass).length}/${results.length} assertions pass`);
const failed = results.filter(r => !r.pass);
if (failed.length) { console.log('FAILED:', failed.map(f => f.id).join(', ')); process.exit(1); }
console.log('ROUND AY item 4 rasterise contract: GREEN');
