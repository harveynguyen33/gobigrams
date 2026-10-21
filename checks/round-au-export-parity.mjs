#!/usr/bin/env node
/**
 * ROUND AU harness — export parity (card t_a7d2cc2a): three export defects,
 * all measured live on a real smoothstep edge (probe board "export-repro").
 *
 *   DEFECT 1 (PNG) — the PNG clone bakes editor chrome and loses the edge.
 *   The edge half is a LIVE rasterisation defect (html-to-image reads the
 *   DETACHED clone's computed style; off the `.react-flow` ancestor the
 *   scoped `.react-flow .react-flow__edges svg { overflow: visible }` rule
 *   stops matching, svg default overflow `hidden` clips the route at the
 *   300x150 default box) — that half CANNOT be proven DOM-free; it is the
 *   live pass documented on the card. The CHROME half is provable in Node:
 *   the clone-sanitiser must strip every editor-chrome class before
 *   rasterisation. Asserted here as a PURE source-contract check (the
 *   sanitiser is a string-list contract): the builder's clone filter names
 *   each chrome class, and its class list matches the chrome inventory the
 *   live pass measured (.node.selected ring via `selected`, 8x
 *   `.react-flow__resize-control`, 12x `.react-flow__handle`, 2x
 *   `.react-flow__edgeupdater`, `.edge-bend-handle`, `.edge-sel-core`,
 *   `.react-flow__nodesselection`).
 *
 *   DEFECT 2 (SVG) — the emitter threw away the measured route: buildSvg
 *   handed the emitter `el: undefined` (the MODEL edge's missing field), so
 *   every edge fell to `stubEdgePath` — a straight centre-to-centre segment
 *   (measured: `M 380,431 L 750,440.5` vs the canvas smoothstep's 7-segment
 *   route). Asserted DOM-free: a stub measurer that RETURNS a route (the
 *   exact live smoothstep `d`) must see that `d` EMITTED verbatim, not
 *   replaced by `M x1,y1 L x2,y2`.
 *
 *   DEFECT 3 (SVG) — the arrowhead parity. The canvas renders React Flow's
 *   own marker: `<marker markerWidth=14 markerHeight=14 viewBox="-10 -10
 *   20 20" refX=0 refY=0 orient="auto-start-reverse" markerUnits=
 *   "strokeWidth"><polyline points="-5,-4 0,0 -5,4 -5,-4" fill=stroke
 *   (CLOSED triangle) stroke-width=1>`. The exporter hard-coded a
 *   7/7 viewBox-0-0-10-10 open triangle at stroke-width 2 — half size,
 *   wrong shape, wrong contract. Asserted DOM-free: the emitted `<marker>`
 *   must carry the edge's own marker numbers (14/14), the RF viewBox,
 *   strokeWidth units, and the CLOSED polyline points, with the fill
 *   derived from the edge's resolved colour.
 *
 *   RED on edb50bb (all three fail); GREEN is the fix tree. The DOM-free /
 *   live split is stated per assertion group above, per the card's rules.
 */
import {readFileSync, writeFileSync, rmSync, existsSync, mkdtempSync, cpSync, readdirSync} from 'node:fs';
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

console.log('ROUND AU — export parity (edge route, arrow contract, PNG chrome)');
console.log(`  target root: ${ROOT}`);

/* ---------------------------------------------------------------- bundle -- */

const bundleAndImport = async () => {
  const entry = join(ROOT, '.au-entry.ts');
  const out = join(ROOT, '.au-out.mjs');
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
  '--fg': '#e8e8ea', '--dim': '#8a8a92', '--surface': '#141417',
  '--bg': '#0b0b0d', '--border': '#26262b', '--acc': '#7c7cf0',
  '--c-slate': '#94a3b8',
};

const mkNode = (id, x, data) => ({
  id, type: 'goblin', position: {x, y: 365},
  measured: {width: 190, height: 131},
  data: {shape: 'database', title: id, ...data}, parentId: null,
});

const NODES = [mkNode('n100', 321, {}), mkNode('n101', 655, {})];

/* THE measured canvas route of the probe board's smoothstep edge e102
   (live `.react-flow__edge-path` d, captured on :5200) — multi-segment,
   NOT a straight M..L.. */
const CANVAS_D = 'M517 431L537 431L 578.25,431Q 583,431 583,435.75L 583,435.75Q 583,440.5 587.75,440.5L629 440.5L649 440.5';

/* A measurer whose edgePath returns the CANVAS route (what the live
   domMeasurer returns when the clone's edge element is reachable). */
const routeMeasurer = {
  text() { return {x: 14, y: 12, w: 130, h: 46, size: 14.5, weight: 650, fill: '#e8e8ea', anchor: 'start'}; },
  edgePath() {
    return {d: CANVAS_D, start: {x: 517, y: 431}, end: {x: 649, y: 440.5}};
  },
};

/* The probe board's edge MODEL — markerEnd exactly as makeEdge/plainMarker
   writes it (React Flow's object contract, colour = symbolic var). */
const EDGE = {
  id: 'e102', source: 'n100', target: 'n101',
  data: {shape: 'smoothstep', strokeKey: 'slate'},
  markerEnd: {type: 'arrowclosed', color: 'var(--c-slate)', width: 14, height: 14},
  /* the clone element handle: non-null here stands for "the measurer found
     the live clone's edge path" — exactly what the App wiring must feed it
     (the live domMeasurer reads `.react-flow__edge-path` off it). */
  el: {querySelector: () => null},
};

const svg = exportSvg({nodes: NODES, edges: [EDGE], theme: 'dark', tokens, measurer: routeMeasurer, pad: 24});

/* --------------------------- DEFECT 2 — the measured route is emitted ----- */
/* DOM-FREE half: a stub measurer returning the real route must see it in the
   file. (The other half — that buildSvg must FEED the clone element to the
   measurer — is App wiring; its live proof is the card's export diff.) */

const emittedD = (() => {
  const m = /<path d="([^"]+)"[^>]*marker-end=/.exec(svg);
  return m ? m[1] : null;
})();

assert('AU2-edge-path-is-measured-route',
  emittedD === CANVAS_D,
  emittedD === CANVAS_D
    ? 'emitted d === canvas d (multi-segment smoothstep verbatim)'
    : `emitted d (${(emittedD ?? 'NONE').slice(0, 60)}…) !== canvas route (${CANVAS_D.slice(0, 40)}…)`);

/* the OLD bug's shape: a 2-command straight segment must not appear when the
   measurer supplied a real route */
const straightShape = /^M\s*-?[\d.]+,-?[\d.]+\s+L\s*-?[\d.]+,-?[\d.]+$/.test(emittedD ?? '');
assert('AU2-no-straight-fallback', emittedD !== null && !straightShape,
  `emitted edge d is ${straightShape ? 'a bare M..L straight segment (the stub fallback — RED shape)' : 'not a bare straight segment'}`);

/* segment count parity: the emitted path carries the same command count as
   the canvas route (7 segments: 3 L, 2 Q + the M) */
const cmdCount = (s) => (s.match(/[A-Z]/g) ?? []).length;
assert('AU2-segment-count-parity',
  emittedD !== null && cmdCount(emittedD) === cmdCount(CANVAS_D),
  `emitted ${cmdCount(emittedD ?? '')} path commands vs canvas ${cmdCount(CANVAS_D)}`);

/* --------------------------- DEFECT 3 — the arrow contract ---------------- */
/* DOM-FREE. The canvas marker (React Flow's own renderer):
   markerWidth/Height = the edge's markerEnd.width/height (14 here),
   viewBox "-10 -10 20 20", refX/refY 0, markerUnits "strokeWidth",
   orient "auto-start-reverse", CLOSED polyline "-5,-4 0,0 -5,4 -5,-4"
   filled with the marker colour. The emitted marker must byte-match that
   contract with the colour derived from the edge (resolveColor chain). */

const markerTag = /<marker\b[^>]*>[\s\S]*?<\/marker>/.exec(svg)?.[0] ?? '';
const markerAttrs = /<marker\b([^>]*)>/.exec(svg)?.[1] ?? '';

assert('AU3-marker-size-from-edge',
  /markerWidth="14"/.test(markerAttrs) && /markerHeight="14"/.test(markerAttrs),
  `markerWidth/Height = 14 (the edge's markerEnd.width/height); got: ${markerAttrs.slice(0, 120)}`);

assert('AU3-marker-viewbox-canvas-contract',
  /viewBox="-10 -10 20 20"/.test(markerAttrs) && /markerUnits="strokeWidth"/.test(markerAttrs)
    && /refX="0"/.test(markerAttrs) && /refY="0"/.test(markerAttrs)
    && /orient="auto-start-reverse"/.test(markerAttrs),
  'viewBox "-10 -10 20 20", markerUnits strokeWidth, refX/refY 0, orient auto-start-reverse (the canvas contract)');

const closedPolyline = /<polyline[^>]*points="-5,-4 0,0 -5,4 -5,-4"[^>]*\/?>/.test(markerTag);
assert('AU3-marker-closed-triangle', closedPolyline,
  'marker body is the CLOSED polyline "-5,-4 0,0 -5,4 -5,-4" (arrowclosed), not the 10x10 open path');

assert('AU3-marker-fill-from-edge-colour',
  /#94a3b8/.test(markerTag),
  `marker fill/stroke derives from the edge colour chain (resolveColor → --c-slate → #94a3b8); got: ${markerTag.slice(0, 200)}`);

/* the path references SOME emitted marker id */
assert('AU3-path-references-marker',
  /marker-end="url\(#.+?\)"/.test(svg) && markerTag !== '',
  'the edge path carries marker-end="url(#…)" and a <marker> exists in <defs>');

/* stroke-width parity: the canvas edge paints 1.8 (the makeEdge default) and
   the marker scales by strokeWidth units, so the exported path must carry
   the canvas stroke-width, not the legacy 2. */
const edgePathTag = /<path d="[^"]*"[^>]*marker-end/.exec(svg)?.[0] ?? '';
assert('AU3-edge-stroke-width-parity',
  /stroke-width="1\.8"/.test(edgePathTag),
  `exported edge stroke-width = 1.8 (canvas contract); got: ${(edgePathTag.match(/stroke-width="[^"]*"/) ?? ['none'])[0]}`);

/* ----------------- DEFECT 1 (half 1, DOM-free) — the chrome contract ------ */
/* The PNG builder's clone sanitiser must name every editor-chrome class the
   live inventory measured (1 selected ring, 8 resize controls, 12 connection
   handles, 2 edge updaters, bend handles, the edge selection core, the
   nodes-selection rect). This asserts the SANITISER CONTRACT in source; the
   rasterised-pixels half is the card's live pass. */

const app = readFileSync(join(ROOT, 'src', 'App.tsx'), 'utf8');
/* isolate buildPng's body (from its declaration to the next builder) */
const pngStart = app.indexOf('const buildPng');
const pngEnd = app.indexOf('\n  // ---- import JSON ----', pngStart);
const pngBody = pngStart >= 0 && pngEnd > pngStart ? app.slice(pngStart, pngEnd) : '';

const CHROME = [
  'react-flow__resize-control',
  'react-flow__handle',
  'react-flow__edgeupdater',
  'edge-bend-handle',
  'edge-sel-core',
  'react-flow__nodesselection',
];
const missingChrome = CHROME.filter(c => !pngBody.includes(c));

assert('AU1-png-clone-sanitises-chrome', pngBody !== '' && missingChrome.length === 0,
  pngBody === ''
    ? 'buildPng body not found in src/App.tsx'
    : missingChrome.length
      ? `chrome classes not stripped by the clone sanitiser: ${missingChrome.join(', ')}`
      : `all ${CHROME.length} chrome class families stripped (resize controls, connection handles, edge updaters, bend handles, edge selection core, nodes-selection)`);

/* the selection ring: `selected` must be dropped from cloned nodes/edges
   (the ring paints from .selected), and the sanitiser must run INSIDE
   buildPng (the string appears in its body) */
assert('AU1-png-clone-strips-selected', pngBody.includes("'selected'") || pngBody.includes('"selected"'),
  "buildPng's sanitiser drops the `selected` class (the ring/handle paint hook) from the clone");

/* the edge-overflow fix: the host must restore the `.react-flow` rule context
   so the DETACHED clone's computed overflow is `visible` (html-to-image reads
   the detached clone; svg default hidden clips the route at 300x150). The
   live/mechanism half. The assertion is source-level: mountThemed's host (or
   buildPng's host) carries the react-flow class. */
const mountStart = app.indexOf('const mountThemed');
const mountBody = app.slice(mountStart, mountStart + 2500);
const hostGetsFlowClass = /host\.className|host\.classList\.add|setAttribute\('class'/.test(mountBody) &&
  /react-flow/.test(mountBody);
assert('AU1-png-host-restores-react-flow-context', hostGetsFlowClass,
  hostGetsFlowClass
    ? "mountThemed's themed host carries the `react-flow` class — the scoped `.react-flow .react-flow__edges svg { overflow: visible }` rule matches inside the clone, so the detached clone computes overflow:visible and html-to-image bakes it (measured live: hidden → visible)"
    : "the themed host does not restore the `.react-flow` rule context — the clone computes overflow:hidden and the rasterisation clips the edge (the measured live loss)");

/* ------------------------------------------------------------------ end -- */

const fails = results.filter(r => !r.pass);
console.log(`\n${results.length - fails.length}/${results.length} assertions PASS${fails.length ? `, ${fails.length} FAIL` : ''}`);
process.exit(fails.length ? 1 : 0);
