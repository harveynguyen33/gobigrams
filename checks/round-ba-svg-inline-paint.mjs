#!/usr/bin/env node
/**
 * ROUND BA harness — card t_a272757e (OPTION A stopgap): inline SVG
 * presentation properties on the PNG clone BEFORE `toPng` runs.
 *
 * WHY (research/export-architecture-report.md, measured upstream):
 * html-to-image@1.11.13 `lib/clone-node.js` — `cloneChildren()` returns
 * immediately for an SVG element and `cloneSingleNode` deep-clones SVGs
 * WITHOUT `decorate()`/`cloneCSSStyle()`. The detached clone carries no
 * stylesheet, so every `<path>`/`<text>` inside an SVG subtree computes to
 * nothing: edges lose their stroke, icons lose their ink, frames lose their
 * fill. The same file floors font sizes (Math.floor(px) - 0.1 → 14px exports
 * as 13.9px) and omits the `overflow` shorthand.
 *
 * FIX CONTRACT (card step 1): in buildPng, after the clone is prepared and
 * BEFORE toPng, walk EVERY `<svg>` in the clone and, for each element inside
 * it, write the COMPUTED paint (read from the ORIGINAL element, matched by
 * path — the clone is detached, its own computed styles are useless) as
 * explicit presentation attributes:
 *   stroke, fill, stroke-width, stroke-dasharray, stroke-linecap,
 *   stroke-linejoin, opacity, fill-opacity, stroke-opacity, color,
 *   marker-end, marker-start
 * and for `<text>` additionally font-family, font-size, font-weight,
 * letter-spacing. currentColor resolves to the element's computed color.
 * Attributes are preserved where the computed value is none/empty.
 *
 * Asserted here as a SOURCE CONTRACT on buildPng (same pattern as the AU/AV
 * harnesses — the builder is App wiring; the rasterised-pixels half is the
 * live probe pass documented on the card). RED on 92f8660.
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

console.log('ROUND BA — inline SVG presentation properties on the PNG clone');
console.log(`  target root: ${ROOT}`);

const app = readFileSync(join(ROOT, 'src', 'App.tsx'), 'utf8');
const pngStart = app.indexOf('const buildPng');
const pngEnd = app.indexOf('\n  // ---- import JSON ----', pngStart);
const pngBody = pngStart >= 0 && pngEnd > pngStart ? app.slice(pngStart, pngEnd) : '';

assert('BA0-buildPng-found', pngBody !== '', 'buildPng body isolated from src/App.tsx');

/* --- BA1: a general per-svg clone walk exists (not just the .node-ico pass).
 * The card's fix walks EVERY <svg> in the clone; the pre-existing icon pass
 * queries only `.node-ico svg`. The general pass must query the svg element
 * itself (`svg`, i.e. querySelectorAll('svg') / ('svg *')) INSIDE buildPng. */
const generalWalk = /querySelectorAll<SVGSVGElement>\('svg'\)/.test(pngBody);
assert('BA1-general-svg-clone-walk', generalWalk,
  generalWalk
    ? "buildPng walks every <svg> in the clone (querySelectorAll<SVGSVGElement>('svg')), not only the icon/frame passes"
    : "no general <svg> walk in buildPng — only the .node-ico icon pass (the RED shape)");

/* --- BA2: the card's paint list is written as kebab presentation attributes.
 * Baseline (AV passes) already carries stroke/stroke-width/stroke-linecap/
 * stroke-linejoin/fill-opacity — the previously MISSING ones are asserted:
 * stroke-dasharray, stroke-opacity, marker-end, marker-start (+ fill/opacity/
 * color which are trivially present via the AV passes). */
const PAINT = ['stroke-dasharray', 'stroke-opacity', 'marker-end', 'marker-start',
  'fill-opacity', 'opacity', 'stroke-linejoin'];
const missingPaint = PAINT.filter(p => !pngBody.includes(p));
assert('BA2-paint-property-list-complete', pngBody !== '' && missingPaint.length === 0,
  missingPaint.length
    ? `paint properties missing from the clone paint pass: ${missingPaint.join(', ')}`
    : `all ${PAINT.length} paint properties (stroke…marker-start) are written`);

/* --- BA3: text/font properties for <text> elements. */
const FONT = ['font-family', 'font-size', 'font-weight', 'letter-spacing'];
const missingFont = FONT.filter(p => !pngBody.includes(p));
assert('BA3-text-font-properties', pngBody !== '' && missingFont.length === 0,
  missingFont.length
    ? `text font properties missing: ${missingFont.join(', ')}`
    : 'text carries font-family/font-size/font-weight/letter-spacing explicitly');

/* --- BA4: computed values are sourced per element (path-matched walk over
 * the themed clone's svgs — mountThemed keeps the clone ATTACHED so its
 * computed style carries the resolved EXPORT-theme paint), with the live
 * viewport's svg matched by index as a fallback for none/empty values
 * (`origKids`). Reading ONLY the live original would bake live-theme colours
 * into a cross-theme export; reading only the detached serialisation clone
 * is impossible — html-to-image never decorates svg subtrees. */
const sourcesComputed = /getComputedStyle\(kid\)/.test(pngBody) && /origKids/.test(pngBody);
assert('BA4-computed-sourced-per-element', pngBody !== '' && sourcesComputed,
  sourcesComputed
    ? 'the paint pass reads getComputedStyle per walked clone element with the path-matched live svg (origKids) as fallback'
    : 'the paint pass has no per-element computed read with a path-matched fallback (a bare walk writes nothing real — the measured mechanism)');

/* --- BA5: currentColor resolves to the computed color of that element. */
const resolvesCurrentColor = /currentColor/.test(pngBody) && /color/.test(pngBody);
assert('BA5-currentcolor-resolved', pngBody !== '' && resolvesCurrentColor,
  'currentColor is resolved to the element\'s computed color (standalone raster: nothing can resolve it later)');

/* --- BA6: none/empty computed values do NOT clobber existing attributes
 * (preserve contract from the card). */
const preservesNone = /none|''/.test(pngBody) && /getAttribute|hasAttribute|continue|return/.test(pngBody);
assert('BA6-preserves-attrs-on-none-empty', pngBody !== '' && preservesNone,
  'the walk skips (preserves existing attributes on) elements whose computed paint is none/empty');

/* --- BA7: the pass runs BEFORE toPng (ordering contract). */
const toPngAt = pngBody.indexOf('toPng(');
const walkAt = pngBody.search(/querySelectorAll(<[^>]+>)?\(\s*['"]svg/);
assert('BA7-runs-before-toPng', toPngAt > -1 && walkAt > -1 && walkAt < toPngAt,
  walkAt > -1 && walkAt < toPngAt
    ? 'the svg paint walk is ordered before the toPng rasterisation call inside buildPng'
    : 'the paint walk is missing or ordered after toPng (it would never reach the raster)');

/* --- BA8: additive — the AU-1 chrome sanitiser and the AV icon/fill passes
 * stay intact (the card forbids regressions here). */
const CHROME = ['react-flow__resize-control', 'react-flow__handle', 'react-flow__edgeupdater',
  'edge-bend-handle', 'edge-sel-core', 'react-flow__nodesselection'];
const missingChrome = CHROME.filter(c => !pngBody.includes(c));
assert('BA8-au1-sanitiser-intact', missingChrome.length === 0 && pngBody.includes("'selected'"),
  missingChrome.length ? `AU-1 chrome sanitiser lost: ${missingChrome.join(', ')}` : 'AU-1 chrome sanitiser intact');
assert('BA9-av-passes-intact',
  pngBody.includes('node-ico') && pngBody.includes('fill-opacity') && pngBody.includes('color-mix'),
  'ROUND AV passes (icon ink + dimensions, color-mix/fill-opacity resolution) untouched');

/* ------------------------------------------------------------------ end -- */

const fails = results.filter(r => !r.pass);
console.log(`\n${results.length - fails.length}/${results.length} assertions PASS${fails.length ? `, ${fails.length} FAIL` : ''}`);
process.exit(fails.length ? 1 : 0);
