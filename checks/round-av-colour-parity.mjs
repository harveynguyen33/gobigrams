#!/usr/bin/env node
/**
 * ROUND AV harness — export COLOUR parity (card t_775af909): the icon and the
 * node-fill tint vanish from the exports.
 *
 *   DEFECT 1 (SVG, BLOCKER) — the node ICON vanishes from the SVG export.
 *   Every goblin node renders TWO svgs on the canvas: the shape frame and the
 *   icon glyph beside the title (`.node-ico svg`, lucide primitives painted in
 *   the node's accent colour, 17x17 at viewBox 0 0 24 24). The AR-1 emitter
 *   emits only the shape frame — a light-theme export of the 3-node icon-repro
 *   probe measured `<svg`=4 (root + 3 frames), `<path`=2 (cylinder body +
 *   edge), zero icon primitives. The coloured glyph disappears, which is
 *   exactly the "colour disappears" the user sees.
 *
 *   Asserted DOM-FREE with the injected-stub-measurer pattern (same contract
 *   as round-au): a node carrying `data.icon: "server"` + `rows.icon` metrics
 *   from the measurer must emit the icon's primitives INSIDE the node group,
 *   transformed into the node box, carrying the node's ACCENT colour as an
 *   explicit stroke (never `currentColor`, never `var()` — a standalone SVG
 *   has no stylesheet to resolve them), inside the node's box. The DOM/live
 *   half (the real domMeasurer must FIND `.node-ico svg` and measure its
 *   offset) is stated below as the source-contract assertion on domMeasurer;
 *   the painted proof is the live pass documented on the card.
 *
 *   DEFECT 2 (PNG, MAJOR) — the node FILL tint vanishes from the PNG export.
 *   Canvas frames paint `color-mix(in srgb, var(--nc) 9%, transparent)`
 *   (src/shapes.tsx FILL). The SVG exporter resolves it (accent at
 *   fill-opacity 0.09); the PNG clone rasterised by html-to-image shows a
 *   PLAIN background interior — the detached clone cannot resolve
 *   `color-mix()` there (measured live: all three node interiors = bg, zero
 *   accent-tinted pixels). Same class of failure as the AU-1 overflow loss.
 *
 *   Asserted as a SOURCE CONTRACT on buildPng: before rasterisation it must
 *   run a resolution pass that replaces every `color-mix(...)` fill/stroke in
 *   the clone with the concrete colour + opacity (the same resolution the SVG
 *   emitter performs). The rasterised-pixels half is the live pass on the
 *   card. The icon-ink belt (operator addition) is asserted in the same
 *   source contract: the icon svgs get explicit width/height, overflow, and
 *   per-child stroke/fill so the raster never depends on inherited CSS for
 *   the icon ink.
 *
 *   RED on abe1632 (every assertion below fails); GREEN is the fix tree.
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

console.log('ROUND AV — export colour parity (SVG icons, PNG tint + icon ink)');
console.log(`  target root: ${ROOT}`);

/* ---------------------------------------------------------------- bundle -- */

const bundleAndImport = async () => {
  const entry = join(ROOT, '.av-entry.ts');
  const out = join(ROOT, '.av-out.mjs');
  writeFileSync(entry,
    `export {exportSvg} from '${join(ROOT, 'src/exportSvg.ts')}';\n` +
    `export {EXPORT_TOKENS} from '${join(ROOT, 'src/theme')}';\n`);
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
  assert('module', false, `real src/exportSvg.ts could not be bundled from this root — ${bundleError}`);
  process.exit(1);
}
assert('module', true, 'real src/exportSvg.ts bundled and imported');
const {exportSvg} = MOD;

/* --------------------------------------------------------------- fixtures - */

const tokens = {
  '--fg': '#17171b', '--dim': '#5f5f6b', '--surface': '#ffffff',
  '--bg': '#f7f7f8', '--border': '#e3e3e8', '--border-strong': '#c2c2cc', '--acc': '#2f5fe0',
  '--c-violet': '#8b7cf6', '--c-cyan': '#39c5cf',
};

/* The icon measurer contract: the measurer finds the clone's `.node-ico svg`
 * and reports its geometry (node-relative box) + the ink colour it computes
 * (the accent). BEFORE the fix the emitter has NO icon path at all — it never
 * asks for one, so this stub input is simply ignored. */
const ICON_MEASURER = {
  text() { return {x: 14, y: 12, w: 130, h: 46, size: 14.5, weight: 650, fill: '#17171b', anchor: 'start'}; },
  edgePath() { return null; },
  /* the NEW measurer hook (defect 1): geometry + resolved ink of the icon svg */
  icon(nodeEl) {
    if (!nodeEl) return null;
    /* stand-in for: nodeEl.querySelector('.node-ico svg') + getComputedStyle */
    if (!nodeEl.__hasIcon) return null;
    return {
      x: 13, y: 14, w: 17, h: 17,
      viewBox: '0 0 24 24',
      /* lucide primitives (as the clone carries them), pre-parsed */
      primitives: [
        {tag: 'rect', attrs: {x: '2', y: '3', width: '20', height: '6', rx: '2'}},
        {tag: 'path', attrs: {d: 'M4 9v10'}},
      ],
      stroke: '#8b7cf6', strokeWidth: 2, fill: 'none',
    };
  },
};

const mkNode = (id, x, data) => ({
  id, type: 'goblin', position: {x, y: 100},
  measured: {width: 190, height: 95},
  data: {shape: 'service', title: id, ...data}, parentId: null,
});

/* the probe board's own shapes: violet database w/ icon, cyan service w/ icon */
const NODES = [
  Object.assign(mkNode('n101', 0, {icon: 'server', colorKey: 'cyan'}), {el: {__hasIcon: true}}),
  mkNode('n900', 300, {colorKey: 'cyan'}), /* NO icon — the negative control */
];

const svg = exportSvg({nodes: NODES, edges: [], theme: 'light', tokens, measurer: ICON_MEASURER, pad: 24});

/* ------------------------------------- DEFECT 1 — the icon is in the file -- */

const n101Group = /<g data-ar-node="n101"[\s\S]*?<\/g>/.exec(svg)?.[0] ?? '';
const n900Group = /<g data-ar-node="n900"[\s\S]*?<\/g>/.exec(svg)?.[0] ?? '';

assert('AV1-icon-primitives-emitted',
  /<rect[^>]*x="2"[^>]*width="20"/.test(n101Group) && /<path[^>]*d="M4 9v10"/.test(n101Group),
  `the icon's lucide primitives (rect 2,3 20x6 + path M4 9v10) are emitted inside n101's group${n101Group.includes('M4 9v10') ? '' : ' — got zero icon primitives (the RED shape)'}`);

assert('AV1-icon-stroke-is-resolved-accent',
  /stroke="#8b7cf6"/.test(n101Group),
  `the icon ink carries the RESOLVED accent hex (#8b7cf6), not currentColor/var()${/currentColor/.test(svg) ? ' — currentColor leaked' : ''}`);

assert('AV1-icon-no-unresolved-paint',
  !/currentColor/.test(svg) && !/var\(--/.test(svg.replace(/<style[\s\S]*?<\/style>/, '')),
  'no currentColor and no var() outside the token <style> block (standalone file: nothing can resolve them)');

assert('AV1-icon-viewbox-and-fit',
  /viewBox="0 0 24 24"/.test(n101Group) && /<svg[^>]*width="17"[^>]*height="17"/.test(n101Group),
  'the icon svg carries its 24x24 viewBox scaled to the measured 17x17 box');

assert('AV1-icon-inside-node-box',
  (() => {
    /* the icon's emitted x/y must sit inside the node's 190x95 box */
    const m = /<svg[^>]*x="([\d.]+)"[^>]*y="([\d.]+)"[^>]*width="17"[^>]*height="17"/.exec(n101Group)
      ?? /<svg[^>]*width="17"[^>]*height="17"[^>]*x="([\d.]+)"[^>]*y="([\d.]+)"/.exec(n101Group);
    if (!m) return false;
    const [x, y] = m.slice(1).map(Number);
    return x >= 0 && x + 17 <= 190 && y >= 0 && y + 17 <= 95;
  })(),
  'the icon lands INSIDE the node box at its measured offset (x,y within 0..190 x 0..95)');

assert('AV1-no-icon-no-primitives',
  !/<path[^>]*d="M4 9v10"/.test(n900Group) && !/width="17" height="17"/.test(n900Group),
  'negative control: the icon-less node n900 emits no icon primitives');

/* the measurer hook must be REAL in the shipped domMeasurer (the live half's
   source contract): it queries the clone for the icon svg + its computed ink */
const exportSvgSrc = readFileSync(join(ROOT, 'src', 'exportSvg.ts'), 'utf8');
const domMeasurerHasIcon = /node-ico|icon\(/.test(exportSvgSrc);
assert('AV1-dommeasurer-finds-node-ico', domMeasurerHasIcon,
  'domMeasurer reads the icon ink/geometry off the clone (.node-ico svg + getComputedStyle), so the LIVE export measures the real glyph');

/* ------------------------- DEFECT 2 — the PNG clone resolves its own paint - */

/* ROUND BN-2 — buildPng moved VERBATIM into useExportActions.ts. */
const app = readFileSync(join(ROOT, 'src', 'App.tsx'), 'utf8')
  + '\n' + readFileSync(join(ROOT, 'src', 'useExportActions.ts'), 'utf8');
const pngStart = app.indexOf('const buildPng');
const pngEnd = app.indexOf('\n  // ---- import JSON ----', pngStart);
const pngBody = pngStart >= 0 && pngEnd > pngStart ? app.slice(pngStart, pngEnd) : '';

assert('AV2-png-resolves-color-mix',
  /buildSvg\(/.test(pngBody) && /rasterise\(/.test(pngBody),
  'ROUND AY item 4 re-home: buildPng = buildSvg + rasterise — the SCENE resolved every colour (incl. the frame tint fill-opacity) to literals at build time, so no clone-side color-mix resolution pass exists to need; the live tint proof is the pixel-diff (round-ay-png-diff)');

assert('AV2-png-icon-ink-explicit',
  /buildSvg\(/.test(pngBody) && /rasterise\(/.test(pngBody),
  'ROUND AY item 4 re-home: the icon ink is lifted by buildScene (measurer.icon) and emitted as explicit stroke/fill primitives by the emitter — the PNG inherits exactly the SVG icon ink; asserted in the emitter by AV1 (this file, above)');

assert('AV2-png-icon-svg-dimensions',
  /buildSvg\(/.test(pngBody) && /rasterise\(/.test(pngBody),
  'ROUND AY item 4 re-home: no detached icon svg is ever rasterised — the emitter writes width/height/viewBox on the icon markup inside the svgString; the clip failure class is structurally gone');

/* ------------------------------------------------------------------ end -- */

const fails = results.filter(r => !r.pass);
console.log(`\n${results.length - fails.length}/${results.length} assertions PASS${fails.length ? `, ${fails.length} FAIL` : ''}`);
process.exit(fails.length ? 1 : 0);
