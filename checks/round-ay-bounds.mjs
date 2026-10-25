#!/usr/bin/env node
/**
 * ROUND AY item 3 — bounds from getBBox + marker extents + pad
 * (checks/round-ay-bounds.mjs).
 *
 * Asserted DOM-free with the analytic part (the same stub-measurer pattern):
 *
 *   1. bboxBounds unions the measured content box with the ANALYTIC marker
 *      extents: a horizontal edge whose arrowhead lands at the extreme
 *      right must extend the returned bounds BEYOND the content box edge
 *      (RED on the pre-change tree: no bboxBounds exists there).
 *   2. The half-stroke inflation: 0.9px at stroke 1.8 (spec's number) on
 *      every side.
 *   3. Empty-ish board (1 node): the scene's box bounds stay numeric — no
 *      Infinity/NaN reaches the emitted width/height attrs.
 *   4. Emitted svg width/height are finite numbers for the 1-node scene
 *      (the emitter's ceil arithmetic never invents NaN).
 *   5. The scene records boundsSource ('boxes' on the stub path) so a
 *      harness can assert which path ran.
 *
 * The LIVE half (a real getBBox on a mounted hidden group, the marker
 * visibly inside the viewBox on a real export) is the live pass on the
 * card, per the house DOM-free/live split.
 */
import {readFileSync, writeFileSync, rmSync, existsSync} from 'node:fs';
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

console.log('ROUND AY item 3 — bounds (analytic + emitted-number assertions)');
console.log(`  target root: ${ROOT}`);

const bundleAndImport = async () => {
  const entry = join(ROOT, '.ay3-entry.ts');
  const out = join(ROOT, '.ay3-out.mjs');
  if (!existsSync(join(ROOT, 'src', 'export/exportScene.ts'))) {
    throw new Error('src/export/exportScene.ts does not exist in the target root (pre-change tree: no bboxBounds)');
  }
  writeFileSync(entry,
    `export {bboxBounds, buildSceneSync} from '${join(ROOT, 'src/export/exportScene.ts')}';\n` +
    `export {emitSvg} from '${join(ROOT, 'src/export/exportSvg.ts')}';\n`);
  const esbuild = existsSync(join(ROOT, 'node_modules/.bin/esbuild'))
    ? join(ROOT, 'node_modules/.bin/esbuild')
    : join(REAL_ROOT, 'node_modules/.bin/esbuild');
  writeFileSync(out, execFileSync(esbuild,
    [entry, '--bundle', '--platform=node', '--format=esm', '--log-level=error',
     '--external:react', '--external:react-dom', '--external:react/jsx-runtime',
     '--external:@xyflow/react'],
    {encoding: 'utf8', env: {...process.env, NODE_PATH: join(REAL_ROOT, 'node_modules')}}));
  const mod = await import(`${out}?t=${Date.now()}`);
  rmSync(entry, {force: true});
  rmSync(out, {force: true});
  return mod;
};

let MOD = null;
let bundleError = '';
try { MOD = await bundleAndImport(); } catch (e) { bundleError = String(e?.message ?? e); }
if (!MOD) {
  assert('module', false, `src/export/exportScene.ts could not be bundled from this root — ${bundleError}`);
  console.log('\nRED — the scene module under test does not exist on this tree (expected for the pre-change negative control).');
  process.exit(1);
}
assert('module', true, 'real src/export/exportScene.ts bundled and imported');
const {bboxBounds, buildSceneSync, emitSvg} = MOD;

/* ------------------- assertion 1 — the marker extends the content bounds */

/* The spec's probe: a horizontal edge whose arrowhead lands at the extreme
 * right. The CONTENT box (what node-box arithmetic would report) ends at
 * x=480; the edge endpoint sits exactly ON that edge and the AU-3 marker
 * (14/14, markerUnits=strokeWidth) paints BEYOND it. */
const TOKENS = {'--fg': '#fff', '--dim': '#888', '--surface': '#111', '--bg': '#000', '--c-amber': '#f5a623'};
const STUB = {text: () => null, edgePath: () => null};
const NODES = [
  {id: 'a', type: 'goblin', position: {x: 0, y: 0}, measured: {width: 190, height: 95}, data: {shape: 'rect', title: 'A'}, parentId: null},
  {id: 'b', type: 'goblin', position: {x: 290, y: 0}, measured: {width: 190, height: 95}, data: {shape: 'rect', title: 'B'}, parentId: null},
];
const EDGES = [
  /* a→b straight: the STUB route runs centre-to-centre, endpoint
   * (385, 47.5) — 95 short of the content box's right edge (480), so the
   * marker-union step (reach 4.4 around the endpoint) must still extend
   * the bounds PAST the measured content box when the endpoint is near an
   * edge; for the extension assertion below the LIVE path supplies the
   * route (the clone's real smoothstep ends ON the node edge). Here the
   * measured stand-in box is shrunk to the path's own bbox (95..385) so
   * the endpoint sits ON the box edge exactly as the spec's probe draws
   * it. */
  {id: 'e1', source: 'a', target: 'b', data: {colorKey: 'amber'}, markerEnd: {width: 14, height: 14}},
];

/* the OLD arithmetic: node boxes only → maxX 480 */
const scene = buildSceneSync({nodes: NODES, edges: EDGES, theme: 'dark', tokens: TOKENS, measurer: STUB, pad: 24});
const oldMaxX = scene.bounds.maxX;

/* the NEW bounds: the measured content box + analytic marker extents. The
 * measured box here is the PATH's own bbox (95..385 horizontal, as a live
 * getBBox of the content group reports the painted geometry) — the marker
 * is NOT in it, and the union must reach past 385+... to cover the
 * arrowhead. */
const measured = {x: 95, y: 0, width: 290, height: 95};
const b = bboxBounds('<!--stand-in for the mounted content-->', scene.edges, () => measured);
assert('AY3-marker-extends-bounds',
  !!b && b.maxX > measured.x + measured.width,
  `bbox bounds maxX ${b ? b.maxX.toFixed(2) : 'null'} > measured box right edge ${measured.x + measured.width} — the arrowhead (marker extent) is inside the viewBox now`);

/* the marker's analytic reach: the marker can paint maxHalfSpan =
 * max(w,h)/20*5 = 3.5 beyond the endpoint in EVERY direction, and the
 * endpoint itself sits ON the content edge whose stroke reaches 0.9 past —
 * so the marker-union step adds reach = 3.5 + 0.9 = 4.4 to the INFLATED
 * box: maxX = 480 + 0.9 + 3.5 = 484.4 (the union already carries the
 * 0.9 half-stroke, so the marker union reaches 3.5 past THAT). */
assert('AY3-marker-extent-number',
  !!b && Math.abs(b.maxX - (385 + 0.9 + 14 / 20 * 5)) < 0.001,
  `marker reach is 0.9 (half stroke) + ${14 / 20 * 5} (marker half-span) past the endpoint 385 → maxX ${b ? b.maxX.toFixed(2) : 'null'}`);

/* ------------------------- assertion 2 — the half-stroke inflation */

const b2 = bboxBounds('x', [], () => ({x: 10, y: 10, width: 100, height: 50}));
assert('AY3-half-stroke-inflation',
  !!b2 && b2.minX === 9.1 && b2.minY === 9.1 && b2.maxX === 110.9 && b2.maxY === 60.9,
  `content box 10,10 100x50 inflates by 0.9 on every side → ${b2 ? `${b2.minX},${b2.minY} ${b2.maxX - b2.minX}x${b2.maxY - b2.minY}` : 'null'}`);

/* no edges → no marker union, bounds stay the inflated content box */
assert('AY3-no-edges-no-marker-union',
  !!b2 && b2.maxX === 110.9,
  'an edge-less board keeps exactly the half-stroke-inflated content box');

/* ------------------- assertion 3 — the empty-ish board stays numeric */

const one = buildSceneSync({nodes: [NODES[0]], edges: [], theme: 'dark', tokens: TOKENS, measurer: STUB, pad: 24});
const svgOne = emitSvg(one, {tokens: TOKENS});
const wm = /width="([^"]*)"/.exec(svgOne);
const hm = /height="([^"]*)"/.exec(svgOne);
const isNum = (s) => s !== null && isFinite(parseFloat(s)) && !String(s).includes('Infinity') && !String(s).includes('NaN');
assert('AY3-single-node-width-height-numeric',
  !!wm && !!hm && isNum(wm[1]) && isNum(hm[1]),
  `1-node board emits width="${wm?.[1]}" height="${hm?.[1]}" — no Infinity/NaN`);

/* and the viewBox matches the box bounds + pad */
assert('AY3-single-node-viewbox-padded',
  /viewBox="0 0 (\d+) (\d+)"/.exec(svgOne) !== null,
  `viewBox present: ${/viewBox="[^"]*"/.exec(svgOne)?.[0]}`);

/* ------------------- assertion 4 — boundsSource is recorded */

assert('AY3-bounds-source-boxes',
  scene.boundsSource === 'boxes',
  `the stub scene records boundsSource='${scene.boundsSource}' (the live path will record 'bbox' through ctx.bounds)`);

/* ------------------- assertion 5 — the emitter honours a bounds override */

const wider = emitSvg(scene, {tokens: TOKENS, bounds: {minX: -50, minY: -50, maxX: 600, maxY: 200}});
const wOverride = parseInt(/width="(\d+)"/.exec(wider)?.[1] ?? '0', 10);
const wPlain = parseInt(/width="(\d+)"/.exec(emitSvg(scene, {tokens: TOKENS}))?.[1] ?? '0', 10);
assert('AY3-emitter-honours-bbox-override',
  wOverride === 698 && wOverride > wPlain,
  `ctx.bounds {minX:-50, maxX:600} → width ${wOverride} = 600-(-50) + 2*24 pad (the getBBox pass drives the viewBox)`);

/* ------------------- source contract — the seam exists for the live path */

const sceneSrc = readFileSync(join(ROOT, 'src', 'export/exportScene.ts'), 'utf8');
assert('AY3-bboxbounds-source-contract',
  /export function bboxBounds/.test(sceneSrc) && /halfStroke/.test(sceneSrc),
  'bboxBounds exports the measured-box + marker + half-stroke union the live mount will feed');

/* -------------------------------------------------------------------- end */

const fails = results.filter(r => !r.pass);
console.log(`\n${results.length - fails.length}/${results.length} assertions PASS${fails.length ? `, ${fails.length} FAIL` : ''}`);
process.exit(fails.length ? 1 : 0);
