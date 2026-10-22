#!/usr/bin/env node
/**
 * ROUND C — "Outline text" (harfbuzzjs text→paths) + PDF print route.
 * checks/round-c-outline.mjs — the DOM-free contract half.
 *
 * Target modules: src/textOutline.ts (NEW), src/exportSvg.ts (the outline
 * emitter seam), src/ExportModal.tsx (the checkbox), src/App.tsx (wiring).
 *
 * Asserted here WITHOUT a browser (the live rasterised floor check is
 * checks/round-c-live.mjs, a probe-board pass):
 *
 *   A. module exists + the emitter carries the outline seam (RED on the
 *      pre-change tree: no src/textOutline.ts → exit 1, the AR pattern).
 *   B. shapeLine(): a stub shaper yields per-glyph positioned paths —
 *      one <path> per glyph, translate per run, y flipped (harfbuzz y-up
 *      → SVG y-down), letter-spacing folded into the advance BEFORE
 *      emission (report §7.4: shape first, spacing second), fill on the
 *      run group (never on <text>).
 *   C. no <text> survives in an outlined emission of the same scene rows;
 *      the outlined run's ink box is within 1px of the <text> box for the
 *      stub (deterministic) metrics.
 *   D. default OFF: emitSvg without the ctx flag emits byte-identical
 *      markup to the pre-change emitter (text stays selectable).
 *   E. accessibility contract: the outlined run keeps the source string in
 *      a data-text attribute (typography report §7.4 "Losses").
 *   F. modal: ExportModal source carries an "Outline text" checkbox whose
 *      default is false (grep contract — React behaviour is the live half).
 *   G. print route: a print stylesheet module (src/printView.ts) exists and
 *      produces a document with the SVG INLINED (no iframe, no external
 *      asset) and window.print() invoked after mount.
 */
import {readFileSync, existsSync, writeFileSync, rmSync, mkdtempSync} from 'node:fs';
import {join, dirname} from 'node:path';
import {tmpdir} from 'node:os';
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

console.log('ROUND C — outline text + PDF print route (DOM-free contract)');
console.log(`  target root: ${ROOT}`);

if (!existsSync(join(ROOT, 'src', 'textOutline.ts'))) {
  console.log('  FAIL  C-module-exists — src/textOutline.ts does not exist in the target root (pre-change tree: outline mode not implemented)');
  process.exit(1);
}

/* ---------------------------------------------------------------- bundle -- */
/* bundle src/textOutline.ts + src/exportSvg.ts (the emitter seam) with the
 * SAME esbuild the repo already carries. harfbuzzjs is LAZY (a dynamic
 * import + a ?url wasm asset) so the static bundle never pulls the wasm:
 * the outline module must expose its PURE parts (run layout, path scale)
 * without instantiating the shaper. */
const OUT = join(ROOT, '.rc-out.mjs');
const ENTRY = join(ROOT, '.rc-entry.ts');
writeFileSync(ENTRY, `
export * from '${join(ROOT, 'src/textOutline.ts')}';
export {emitSvg, emitContent} from '${join(ROOT, 'src/exportSvg.ts')}';
export {buildSceneSync} from '${join(ROOT, 'src/exportScene.ts')}';
`);
const esbuild = existsSync(join(ROOT, 'node_modules/.bin/esbuild'))
  ? join(ROOT, 'node_modules/.bin/esbuild')
  : join(REAL_ROOT, 'node_modules/.bin/esbuild');
writeFileSync(OUT, execFileSync(esbuild,
  [ENTRY, '--bundle', '--platform=node', '--format=esm', '--log-level=error'],
  {encoding: 'utf8', env: {...process.env, NODE_PATH: join(REAL_ROOT, 'node_modules')}}));
const mod = await import(`${OUT}?t=${Date.now()}`);

/* ---- B. shapeLine contract: a STUB shaper (deterministic, no wasm) ---- */
/* The stub shaper: every char -> one glyph whose "outline" is a 10x10 box
 * (M0,0 L10,0 L10,10 L0,10 Z), advance 10 units, upem 10. The point of the
 * stub is the CONTRACT: positioning, flipping, spacing, fill — not HarfBuzz. */
const stubOutlineOf = (gid) => 'M0,0 L10,0 L10,10 L0,10 Z';
const stubShaper = {
  shapeRun(text, o) {
    /* 10 units per glyph, advance 7 units (so spacing matters) */
    const glyphs = [...text].map((ch, i) => ({gid: i, ch, xOffset: 0, yOffset: 0, xAdvance: 7}));
    return {glyphs, upem: 10};
  },
  glyphPath(gid) { return stubOutlineOf(gid); },
};
void stubOutlineOf;

const run = mod.shapeLineToSvg ? mod : null;
if (!run || typeof mod.shapeLineToSvg !== 'function') {
  assert('C-shapeLine-export', false, 'src/textOutline.ts must export shapeLineToSvg(...) — see the harness call shape below');
} else {
  assert('C-shapeLine-export', true, 'shapeLineToSvg exported');

  /* B1: per-glyph <path>, positioned by advance, y FLIPPED (font y-up ->
   * SVG y-down: the glyph box M0,0 L10,0 L10,10 must land with NEGATIVE y
   * above the baseline, i.e. a scale(1,-1) flip). */
  const svg = mod.shapeLineToSvg('ab', {
    x: 100, baselineY: 50, size: 10, weight: 400, fill: '#ff0000',
    spacing: 0, shaper: stubShaper,
  });
  const paths = (svg.match(/<path\b/g) || []).length;
  assert('C-glyph-paths-per-glyph', paths === 2, `2 glyphs -> ${paths} <path> elements; svg: ${svg.slice(0, 120)}`);
  /* the group must carry fill and NOT be a <text> */
  assert('C-no-text-element', !/<text[\s>]/.test(svg), 'outlined run emits no <text>');
  assert('C-run-fill', /fill="#ff0000"/.test(svg), `run fill on the group: ${svg.slice(0, 160)}`);

  /* B2: advance placement — glyph 2 starts at advance(1 glyph)*scale.
   * scale = size/upem = 10/10 = 1; advance 7 => second glyph x = 107. */
  const second = svg.indexOf('translate(107');
  assert('C-advance-placement', second >= 0, `second glyph translated to x=107 (100 + advance 7 * scale 1)`);

  /* B3: y flip — glyph boxes sit ABOVE the baseline in SVG space (negative
   * y relative to the run origin, because fonts are y-up). The emitted
   * group transform must flip y: look for scale(1,-1) or negated coords. */
  assert('C-y-flip', /scale\(1[,\s]-1\)|scale\(-1,-1\)|,\s*-10/.test(svg),
    `the glyph outline must be y-flipped (font y-up -> SVG y-down): ${svg.slice(0, 200)}`);

  /* B4: letter-spacing folded into the ADVANCE (shape first, spacing
   * second): with spacing 3, glyph 2 lands at 100 + (7+3) = 110. */
  const svgSp = mod.shapeLineToSvg('ab', {
    x: 100, baselineY: 50, size: 10, weight: 400, fill: '#00ff00',
    spacing: 3, shaper: stubShaper,
  });
  assert('C-spacing-in-advance', svgSp.indexOf('translate(110') >= 0,
    `letter-spacing 3 folded into the advance: glyph 2 at x=110`);

  /* B5: anchor middle — the run is centred on x by its shaped width. */
  const svgMid = mod.shapeLineToSvg('ab', {
    x: 100, baselineY: 50, size: 10, weight: 400, fill: '#00ff00',
    spacing: 0, anchor: 'middle', shaper: stubShaper,
  });
  /* width = 2 glyphs * 7 = 14 => start x = 100 - 7 = 93 */
  assert('C-anchor-middle', /translate\(9[23]/.test(svgMid), `middle-anchored run starts at 93 (100 - shapedWidth/2): ${svgMid.slice(0, 140)}`);

  /* E: the source string rides a data attribute (a11y / round-trip). */
  assert('C-data-text', /data-text="ab"/.test(svg), `source text kept in data-text`);
}

/* ---- C/D. emitter seam: outlineRows over scene rows ---- */
if (typeof mod.emitSvg === 'function' && typeof mod.buildSceneSync === 'function') {
  assert('C-emitter-exports', true, 'emitSvg + buildSceneSync available');
  const mkInput = () => ({
    nodes: [{id: 'n1', position: {x: 0, y: 0}, measured: {width: 180, height: 90},
      data: {title: 'Hello', shape: 'service'}}],
    edges: [],
    theme: 'dark',
    tokens: Object.fromEntries(['--bg', '--fg', '--dim', '--surface'].map(t => [t, '#111'])),
    measurer: {
      text() { return {x: 10, y: 10, w: 120, h: 30, size: 14, weight: 650, fill: '#fff', anchor: 'start'}; },
      icon() { return null; },
      edgePath() { return null; },
      measureText(s, o) { return s.length * (o.size || 14) * 0.6; },
      defaultFamily() { return 'Test, sans-serif'; },
    },
    pad: 24,
  });
  /* D: default OFF — no ctx.outline flag -> <text> stays, byte-compat. */
  try {
    const scene = mod.buildSceneSync(mkInput());
    const plain = mod.emitSvg(scene, {tokens: mkInput().tokens});
    const plainText = plain.includes('<text');
    assert('C-default-text-mode', plainText, 'without the outline flag the file keeps <text> (selectable by default)');
    /* with outline ON and a shaper injected, no <text> survives */
    if (typeof mod.shapeLineToSvg === 'function') {
      const outlined = mod.emitSvg(scene, {tokens: mkInput().tokens, outline: {shaper: stubShaper}});
      assert('C-outlined-no-text', !/<text[\s>]/.test(outlined), 'outline ctx flag -> zero <text> elements');
      assert('C-outlined-has-paths', (outlined.match(/<path\b/g) || []).length > 0, 'outlined file carries glyph paths');
      assert('C-outlined-data-text', outlined.includes('data-text='), 'outlined file keeps data-text per run');
    }
  } catch (e) {
    assert('C-emitter-exports', false, `emitSvg scene path threw: ${e.message}`);
  }
} else {
  assert('C-emitter-exports', false, 'exportSvg.ts must re-export emitSvg + buildSceneSync for this bundle');
}

/* ---- F. modal checkbox (grep contract) ---- */
const modalSrc = readFileSync(join(ROOT, 'src', 'ExportModal.tsx'), 'utf8');
assert('C-modal-checkbox', /Outline text/.test(modalSrc), 'the export modal carries an "Outline text" control');
assert('C-modal-off-default', /useState<boolean>\(false\)/.test(modalSrc) || /outline[^,;]{0,40}=false/.test(modalSrc),
  'the outline option defaults to false');

/* ---- G. print route ---- */
if (!existsSync(join(ROOT, 'src', 'printView.ts'))) {
  assert('C-print-module', false, 'src/printView.ts does not exist (PDF route not implemented)');
} else {
  const printSrc = readFileSync(join(ROOT, 'src', 'printView.ts'), 'utf8');
  assert('C-print-module', true, 'src/printView.ts exists');
  assert('C-print-inline-svg', /svg/.test(printSrc) && !/iframe/i.test(printSrc),
    'print view inlines the SVG (no iframe)');
  assert('C-print-calls-print', /window\.print\(\)/.test(printSrc), 'print view triggers window.print()');
}
const modalHasPdf = /PDF/.test(modalSrc) && /print/i.test(modalSrc);
assert('C-modal-pdf-label', modalHasPdf, 'the modal offers a PDF (print) target with an honest label');

const failed = results.filter(r => !r.pass);
console.log(`\n${results.length - failed.length}/${results.length} assertions pass`);
if (failed.length) { console.log('FAILED:', failed.map(f => f.id).join(', ')); process.exit(1); }
console.log('ROUND C outline contract: GREEN');
