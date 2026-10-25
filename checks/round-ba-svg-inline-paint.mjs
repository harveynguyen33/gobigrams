#!/usr/bin/env node
/**
 * ROUND BA harness — RETIRED-IN-PLACE at ROUND AY item 4 (spec table:
 * "round-ba-svg-inline-paint.mjs | RETIRED — asserts the deleted clone path;
 * live assertions re-homed to item 4").
 *
 * HISTORY: card t_a272757e (the OPTION A stopgap) asserted a source contract
 * on buildPng — the AU/AV/BA clone-patch passes that inlined computed paint
 * onto the html-to-image clone before toPng. OPTION B (ROUND AY item 4)
 * deletes that whole path: buildPng is now `buildSvg(o)` + `rasterise(svg)`,
 * and every paint value arrives in the svgString as a literal attribute from
 * the scene emitter (one painter per pixel class, D5).
 *
 * The still-meaningful live assertions are RE-HOMED:
 *   edge pixels / tint / icon ink / marker paint → the scene-emitter
 *   harnesses (round-au-export-parity, round-av-colour-parity, both re-run
 *   GREEN by hand) + the item-4 pixel-diff live pass
 *   (checks/fixtures/round-ay-png-before vs round-ay-png-diff.mjs, 0
 *   selection-blue px re-proven on the new path).
 *
 * THIS FILE now asserts the SUPERSESSION CONTRACT (still RED on the BA-era
 * tree, where buildPng carries the clone walks and imports html-to-image):
 *   BA1'  buildPng performs NO per-svg clone walk (the passes are gone)
 *   BA2'  buildPng's body names no computed-style paint inlining
 *   BA3'  buildPng delegates to buildSvg and rasterise (the flip)
 *   BA4'  html-to-image's toPng no longer appears in src/App.tsx at all
 * (BA4' goes fully green at item 5 when the import and the dependency are
 * removed; until then the import line — now annotated — is the only hit and
 * this assertion checks the buildPng body, not the file.)
 */
import {readFileSync} from 'node:fs';
import {join, dirname} from 'node:path';
import {fileURLToPath} from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = process.env.AR_ROOT || join(HERE, '..');

const results = [];
const assert = (id, pass, detail = '') => {
  results.push({id, pass: !!pass, detail});
  console.log(`  ${pass ? 'PASS' : 'FAIL'}  ${id}  —  ${detail}`);
};

console.log('ROUND BA — SUPERSEDED by ROUND AY item 4 (the rasterise flip)');
console.log(`  target root: ${ROOT}`);

/* ROUND BN-2 — buildPng moved VERBATIM into useExportActions.ts. */
const app = readFileSync(join(ROOT, 'src', 'App.tsx'), 'utf8')
  + '\n' + readFileSync(join(ROOT, 'src', 'useExportActions.ts'), 'utf8');
const pngStart = app.indexOf('const buildPng');
const pngEnd = app.indexOf('\n  // ---- import JSON ----', pngStart);
const pngBody = pngStart >= 0 && pngEnd > pngStart ? app.slice(pngStart, pngEnd) : '';

assert('BA0-buildPng-found', pngBody !== '', 'buildPng body isolated from src/App.tsx');

/* BA1' — the general per-svg clone walk is GONE (no querySelectorAll on svg
 * anywhere in the builder; the scene path never touches a clone). */
const generalWalk = /querySelectorAll(<[^>]+>)?\(\s*['"]svg/.test(pngBody);
assert('BA1-no-svg-clone-walk', pngBody !== '' && !generalWalk,
  generalWalk
    ? 'buildPng still walks clone svgs — the demolition has not happened'
    : "buildPng contains no svg clone walk (the BA paint passes are deleted; the svgString's primitives are already literal)");

/* BA2' — no computed-style paint inlining (no getComputedStyle in the body:
 * the flip derives every attribute from the Scene, not from live style). */
const computedRead = /getComputedStyle/.test(pngBody);
assert('BA2-no-computed-style-inlining', pngBody !== '' && !computedRead,
  computedRead
    ? 'buildPng still reads computed styles — the clone patch is not fully removed'
    : 'buildPng reads NO computed style — every paint attribute is resolved by buildScene');

/* BA3' — the flip: buildSvg + rasterise. */
const flipped = /buildSvg\(/.test(pngBody) && /rasterise\(/.test(pngBody);
assert('BA3-buildpng-is-svg-rasterise', pngBody !== '' && flipped,
  flipped
    ? 'buildPng = buildSvg(o) + rasterise(svg) — the OPTION B one-painter pipeline'
    : 'buildPng does not compose buildSvg + rasterise');

/* BA4' — the builder body carries no toPng call (the html-to-image era ends;
 * the top-of-file annotated import is removed at item 5). */
const toPngCall = /toPng\(/.test(pngBody);
assert('BA4-no-topng-in-buildpng', pngBody !== '' && !toPngCall,
  toPngCall
    ? 'buildPng still calls toPng — the DOM-clone rasteriser is still wired'
    : 'no toPng call in buildPng (the import line goes with item 5)');

/* ------------------------------------------------------------------ end -- */

const fails = results.filter(r => !r.pass);
console.log(`\n${results.length - fails.length}/${results.length} assertions PASS${fails.length ? `, ${fails.length} FAIL` : ''}`);
process.exit(fails.length ? 1 : 0);
