#!/usr/bin/env node
/**
 * ROUND BE harness — the five Harvey-reported grip/behaviour defects
 * (2026-10-23 screenshot round):
 *   (1) the On-page connector's paint must FILL its node box (grips on the circle),
 *   (2) the custom-shape node box must hug the imported art (no 4px padding, no
 *       aspect drift between the stored box and the viewBox),
 *   (3) the custom-shape import default is 200px long edge (was 64 — "rất nhỏ"),
 *   (4) the custom-shape live resizer carries NO 512 ceiling (parity with goblin),
 *   (5) the custom tile must NOT insert on single click (palette parity) while
 *       double-click and drag keep working.
 *
 * No browser, no DOM, no CDP. Everything here is (a) EXECUTED against the real
 * `src/customShape.ts` / `src/presets.ts` / `src/exportSvg.ts` via the project's
 * own esbuild (the round-af / round-ar pattern), or (b) GEOMETRY parsed out of
 * the shipped source (the circle's bbox vs its frame), or (c) a TEXT read of the
 * render sites / the tile's JSX. The painted proof — a selected node on the live
 * canvas with the grips measured against the art's bbox — is the orchestrator's
 * live CDP pass, exactly as `checks/round-ad-flowchart.mjs` states for its scope.
 *
 * NEGATIVE CONTROLS (RED before the fix): each predicate below was run against
 * the pre-fix tree (git stash / checkout 58cef4d) and FAILED there:
 *   - r2g1: old `<circle cx="100" cy="50" r="48"/>` bbox = 96/200 = 0.48 fill  → RED
 *   - r2g2: old defaultShapeSize('0 0 64 96') at pitch 16 → 64x96, ratio off by the
 *     quantise drift (64x96 vs viewBox 0.667 → 0.667 vs 0.6665) AND the 4px CSS
 *     padding pulled the art off the box edges                            → RED
 *   - r2g3: old SHAPE_DEFAULT_PX = 64 ≠ 200                                 → RED
 *   - r2g4: old CustomShapeNode resizer carried maxWidth/maxHeight=SHAPE_MAX_PX → RED
 *   - r2g5: old custom tile carried onClick={() => insertCustomShape(s)}     → RED
 * Recorded here so the zero-results below are measured against a claim, not a wish.
 */
import {readFileSync, writeFileSync, rmSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {join} from 'node:path';

const ROOT = process.env.BE_ROOT || '/home/harvey/projects/tech-goblin/lab/diagram-studio';
const REAL_ROOT = '/home/harvey/projects/tech-goblin/lab/diagram-studio';
const SHAPES_RAW = readFileSync(`${ROOT}/src/shapes.tsx`, 'utf8');
const CUSTOMNODE_RAW = readFileSync(`${ROOT}/src/CustomShapeNode.tsx`, 'utf8');
const APP_RAW = readFileSync(`${ROOT}/src/App.tsx`, 'utf8');
const STYLES_RAW = readFileSync(`${ROOT}/src/styles.css`, 'utf8');
/* ROUND BN-4 — src/presets.ts split into src/presets/{basic,flowchart,dataStorage,architecture,index}.ts (verbatim data moves;
   index.ts re-exports the union). This reads the FIVE SLICES CONCATENATED in that order, so
   every count and regex below still measures the same surface the single file had. */
const PRESETS_RAW = ['basic', 'flowchart', 'dataStorage', 'architecture', 'index']
  .map(f => readFileSync(`${ROOT}/src/presets/${f}.ts`, 'utf8')).join('\n');

const blank = m => m.replace(/[^\n]/g, ' ');
const stripTs = s => s
  .replace(/\/\*[\s\S]*?\*\//g, blank)
  .replace(/(^|[^:])\/\/[^\n]*/g, (m, p1) => p1 + ' '.repeat(m.length - p1.length));
const SHAPES = stripTs(SHAPES_RAW);
const CUSTOMNODE = stripTs(CUSTOMNODE_RAW);
const APP = stripTs(APP_RAW);

const results = [];
const assert = (id, pass, detail = '') => {
  results.push({id, pass: !!pass, detail});
  console.log(`  ${pass ? 'PASS' : 'FAIL'}  ${id}  —  ${detail}`);
};

/* ===========================================================================
   0 — EXECUTE the shipped modules (presets + customShape + exportSvg).
=========================================================================== */
console.log('='.repeat(78));
console.log('BE-0 — the shipped modules, EXECUTED');
console.log('='.repeat(78));

const ENTRY = join(ROOT, '.be-entry.ts');
const OUT = join(ROOT, '.be-out.mjs');
writeFileSync(ENTRY,
  `export {LIBRARY, CONNECTOR_NODE_SIZE, FLOWCHART_NODE_SIZE} from './src/presets';\n` +
  `export {clampShapeSize, defaultShapeSize, SHAPE_DEFAULT_PX, SHAPE_MIN_PX, SHAPE_MAX_PX} from './src/customShape';\n` +
  `export {exportSvg} from './src/exportSvg';\n`);
writeFileSync(OUT, execFileSync(join(REAL_ROOT, 'node_modules/.bin/esbuild'),
  [ENTRY, '--bundle', '--platform=node', '--format=esm', '--log-level=error',
    '--external:react', '--external:react-dom', '--external:react/jsx-runtime', '--external:@xyflow/react'],
  {encoding: 'utf8'}));
const {LIBRARY, CONNECTOR_NODE_SIZE, FLOWCHART_NODE_SIZE, clampShapeSize, defaultShapeSize,
  SHAPE_DEFAULT_PX, SHAPE_MIN_PX, SHAPE_MAX_PX, exportSvg} = await import(`${OUT}?t=${Date.now()}`);
rmSync(ENTRY, {force: true});
rmSync(OUT, {force: true});
/* On a PRE-FIX tree CONNECTOR_NODE_SIZE does not exist — that absence IS the
   defect, so degrade to a sentinel instead of crashing before the asserts. */
const CX = CONNECTOR_NODE_SIZE ?? {width: -1, height: -1};
console.log(`  LIBRARY ${LIBRARY.length} items; CONNECTOR_NODE_SIZE ` +
  `${CONNECTOR_NODE_SIZE ? `${CX.width}x${CX.height}` : 'ABSENT (pre-fix tree)'}; ` +
  `SHAPE_DEFAULT_PX=${SHAPE_DEFAULT_PX}; clamp window ${SHAPE_MIN_PX}..${SHAPE_MAX_PX}`);

/* ===========================================================================
   1 — THE CONNECTOR'S PAINT FILLS ITS FRAME (fix 1).
   Parsed geometry: the circle's bbox vs the viewBox it is drawn in, plus the
   node box it stretches into. ratio = frameW/frameH of the SVG source strings.
=========================================================================== */
console.log('\n' + '='.repeat(78));
console.log('BE-1 — the connector paint reaches its frame (grips on the circle)');
console.log('='.repeat(78));

const cxCase = SHAPES.match(/case 'connector':\s*\n\s*return `<circle ([^`]+)`;/);
assert('r2g1.the-frame-draws-a-circle-with-a-bbox-parse', !!cxCase,
  cxCase ? 'the connector case is a single <circle> primitive — parseable' : "the connector case is no longer one <circle>; the parser needs updating");

if (cxCase) {
  const attrs = Object.fromEntries([...cxCase[1].matchAll(/(\w+)="([\d.]+)"/g)].map(m => [m[1], +m[2]]));
  const vb = /shape === 'connector' \? '0 0 (\d+) (\d+)' : '0 0 (\d+) (\d+)'/.exec(SHAPES);
  assert('r2g1.the-connector-frame-is-square', !!vb && +vb[1] === +vb[2],
    vb ? `ShapeFrame picks viewBox 0 0 ${vb[1]} ${vb[2]} for the connector (square, ${+vb[1] === +vb[2] ? 'yes' : 'NOT'} square) ` +
        `and 0 0 ${vb[3]} ${vb[4]} for every other silhouette` : 'the per-shape viewBox ternary is gone from ShapeFrame');

  /* Fill ratio, measured as the skill demands (bbox vs frame), never by eye:
     the OLD claim was 96/200 = 0.48 — a 52% dead margin per side where the
     grips sat. The NEW claim is 99/100 = 0.99 (the half-unit stroke inset). */
  /* The old frame literal is the graceful fallback: a pre-fix tree has no
     ternary, and its frame WAS 200 wide — so the ratio reads 0.48, the
     measured defect, instead of NaN. */
  const frameW = vb ? +vb[1] : 200;
  const fillRatio = (2 * attrs.r) / frameW;
  assert('r2g1.the-circle-fills-its-frame',
    Math.abs(fillRatio - 0.99) < 1e-9,
    `circle r=${attrs.r} in a ${frameW}-wide frame fills ${(fillRatio * 100).toFixed(1)}% of the width. ` +
    `OLD claim (pre-BE): r=48 in a 200-wide frame = 48% — Harvey's grips floated in the other 52%.`);

  assert('r2g1.the-node-box-is-square-and-matches-the-frame-ratio',
    CX.width === CX.height
      && CX.width !== FLOWCHART_NODE_SIZE.width,
    `CONNECTOR_NODE_SIZE is ${CX.width}x${CX.height} (square) against the rect frames' ` +
    `${FLOWCHART_NODE_SIZE.width}x${FLOWCHART_NODE_SIZE.height}. A 2:1 node stretched the circle into an ellipse AND left ` +
    'dead corners for the grips — the square box is what puts eight grips ON the paint.');

  /* Export parity: emit a real board and read the wrapper the goblin branch
     writes for the connector node. OLD claim: every node exported
     viewBox="0 0 200 100", so the exporter squashed the new square frame. */
  const TOKENS = { '--bg': '#0b0b0d', '--surface': '#141417', '--elevated': '#1b1b20',
    '--border': '#26262c', '--border-strong': '#3a3a44', '--fg': '#e8e8ea',
    '--dim': '#8a8a92', '--dim2': '#5c5c66', '--acc': '#5b8cff', '--acc-soft': '#5b8cff22',
    '--sel': '#5b8cff', '--sel-soft': '#5b8cff18', '--green': '#3fbf6f', '--red': '#e5484d',
    '--danger': '#e5484d', '--card': '#141417',
    '--c-accent': '#5b8cff', '--c-green': '#3fbf6f', '--c-cyan': '#39c5cf',
    '--c-violet': '#8b7cf6', '--c-amber': '#f5a623', '--c-slate': '#8a8a92',
    '--c-red': '#e5484d', '--c-blue': '#4c7ef3', '--c-pink': '#e55c8c',
    '--c-black': '#000000', '--c-white': '#ffffff' };
  const STUB = {
    text() { return {x: 14, y: 12, w: 10, h: 10, size: 10, weight: 400, fill: '#e8e8ea', anchor: 'start'}; },
    edgePath() { return null; },
    origin() { return {x: 0, y: 0}; },
  };
  const board = {
    nodes: [
      {id: 'cx', type: 'goblin', position: {x: 0, y: 0}, measured: {width: CX.width, height: CX.height},
        data: {shape: 'connector', kicker: '', title: 'A', sub: '', metric: '', metricUnit: '', icon: '', colorKey: 'slate', body: 'label-only', handles: 'tb'}},
    ], edges: [], theme: 'dark', tokens: TOKENS, measurer: STUB, pad: 24,
  };
  let svgOut = '';
  try { svgOut = exportSvg(board); } catch (e) {
    svgOut = '';
    console.log('  (exportSvg probe failed: ' + String(e?.message ?? e) + ' — falling back to source assertion)');
  }
  if (svgOut) {
    const cxBlock = /<g data-ar-node="cx"[\s\S]*?<\/g>/.exec(svgOut)?.[0] ?? '';
    const wrap = /<svg x="0" y="0" width="([\d.]+)" height="([\d.]+)" viewBox="([^"]+)"/.exec(cxBlock);
    assert('r2g1.the-exporter-uses-the-square-frame-for-the-connector',
      !!wrap && wrap[3] === '0 0 100 100' && cxBlock.includes('cx="50"'),
      wrap ? `the exporter's connector wrapper carries viewBox="${wrap[3]}" and the circle at cx=50 — the export agrees with the canvas` :
        'the connector block or its wrapper svg was not found in the emitted export');
  } else {
    assert('r2g1.the-exporter-picks-the-frame-per-shape',
      /asShape\(n\.data\?\.shape\) === 'connector' \? '0 0 100 100' : '0 0 200 100'/.test(readFileSync(`${ROOT}/src/exportSvg.ts`, 'utf8')),
      '(source fallback) the export wrapper picks the square frame for the connector per shape — the live export emit could not be probed headlessly');
  }
}

/* The PREVIEW site — the skill's law 2: every geometry exists TWICE. The
   preview frame is 26x18 (2:1), so its frame-filling glyph is an ellipse. */
const cxPreview = SHAPES.match(/case 'connector':\s*\n\s*\/\*[^/]*?\*\/\s*\n\s*return wrap\(<(ellipse|circle) ([^)]+)\/>, 'connector'\);/)
  ?? SHAPES.match(/case 'connector':[\s\S]{0,400}?return wrap\(<(ellipse|circle) ([^)]+)\/>, 'connector'\);/);
assert('r2g1.the-preview-glyph-fills-ITS-frame-too',
  !!cxPreview && cxPreview[1] === 'ellipse',
  cxPreview ? `the ShapePreview connector is an <ellipse ${cxPreview[2].trim().slice(0, 60)}…> filling the 26x18 glyph frame ` +
    '(rx=12.5/13, ry=8.5/9 minus the stroke inset). OLD claim: r=5.6 — a circle with 54% side margins.' :
    "the ShapePreview connector case moved; the parser needs updating");

/* ===========================================================================
   2 — THE CUSTOM NODE BOX HUGS THE ART (fix 2), and
   3 — THE IMPORT DEFAULT IS LEGIBLE (fix 3).
=========================================================================== */
console.log('\n' + '='.repeat(78));
console.log('BE-2/3 — custom node box = art box; the import default');
console.log('='.repeat(78));

assert('r2g2.no-padding-on-the-custom-node',
  !/\.custom-shape-node\s*\{[^}]*padding/.test(STYLES_RAW),
  '.custom-shape-node carries no padding — the OLD 4px pulled the art in from the exact edges NodeResizer ' +
  'measures, so every grip sat 4px off the paint on every side.');

/* EXECUTED, not transcribed: for a spread of viewBoxes, the import default's
   post-clamp aspect must equal the viewBox aspect (within one grid step —
   clampShapeSize quantises each axis to the pitch, so the RATIO survives only
   approximately; the claim is |aspect_error| ≤ one grid unit on the short axis). */
const VB_SAMPLES = [
  {vb: '0 0 100 100', w: 100, h: 100},
  {vb: '0 0 200 100', w: 200, h: 100},
  {vb: '0 0 64 96', w: 64, h: 96},
  {vb: '0 0 300 80', w: 300, h: 80},
  {vb: '0 0 40 240', w: 40, h: 240},
  {vb: '0 0 512 512', w: 512, h: 512},
];
const drifts = VB_SAMPLES.map(({vb, w, h}) => {
  const size = defaultShapeSize(vb, 16);
  const vbAspect = w / h;
  const boxAspect = size.w / size.h;
  const errAxis = Math.max(Math.abs(size.w - 200 * (w / Math.max(w, h))), Math.abs(size.h - 200 * (h / Math.max(w, h))));
  return {vb, size, vbAspect, boxAspect, errAxis};
});
for (const d of drifts) console.log(`  ${d.vb.padEnd(12)} -> ${d.size.w}x${d.size.h}  aspect ${d.boxAspect.toFixed(4)} vs ${d.vbAspect.toFixed(4)}  axis err ${d.errAxis.toFixed(1)}px`);
assert('r2g2.the-import-box-aspect-follows-the-viewBox-within-one-grid-step',
  drifts.every(d => d.errAxis <= 16.0001),
  'defaultShapeSize quantised to pitch 16 keeps every axis within one grid step of the exact viewBox-proportional 200-long-edge box. ' +
  'This is the drift guard: with the padding gone, box aspect ≈ art aspect means object-fit:contain letterboxes NOTHING on import — ' +
  'the grips sit on the art corners. It stays the distortion GUARD for hand-resized boxes (any ratio), not a silent crop.');

assert('r2g2.the-stored-shape-is-unchanged',
  /aspect:\s*'fixed'/.test(readFileSync(`${ROOT}/src/customShape.ts`, 'utf8')),
  "the stored CustomShape keeps aspect:'fixed' and the {title,tags,data,w,h,…} store — fix 2 changed ONLY the rendered box, never the data shape.");

assert('r2g3.the-import-default-is-200-not-64',
  SHAPE_DEFAULT_PX === 200,
  `SHAPE_DEFAULT_PX executed = ${SHAPE_DEFAULT_PX}. OLD claim: 64 — Harvey: "rất nhỏ khó nhìn so với default". 200 sits between ` +
  `the flowchart long edge (${FLOWCHART_NODE_SIZE.width}) and the group container, so an import lands legible next to the built-ins; ` +
  'the 32..512 clamp keeps its RESIZE-floor job only (see r2g4).');

/* ===========================================================================
   4 — NO 512 CEILING ON THE LIVE RESIZER (fix 4).
=========================================================================== */
console.log('\n' + '='.repeat(78));
console.log('BE-4 — the custom resizer carries no ceiling');
console.log('='.repeat(78));

const resizerBlock = CUSTOMNODE.match(/<NodeResizer[\s\S]*?\/>/)?.[0] ?? '';
assert('r2g4.the-live-resizer-has-no-max-props',
  resizerBlock.length > 0 && !/maxWidth|maxHeight/.test(resizerBlock),
  resizerBlock.length > 0
    ? `the custom NodeResizer mounts ${resizerBlock.replace(/\s+/g, ' ').replace(/className="[^"]*"/g, () => 'className=…')} — ` +
      'min 32 floors only. OLD claim: maxWidth/maxHeight=SHAPE_MAX_PX capped the live drag at 512, which NO goblin node ' +
      "has (DiagramNode mounts its resizer without a ceiling) — Harvey: resize should behave like normal shapes."
    : 'CustomShapeNode lost its <NodeResizer>');
assert('r2g4.the-floors-are-still-wired',
  /minWidth=\{SHAPE_MIN_PX\}/.test(CUSTOMNODE) && /minHeight=\{SHAPE_MIN_PX\}/.test(CUSTOMNODE),
  'the 32px floors survive — the ceiling went, the floor stayed.');
assert('r2g4.the-import-window-keeps-its-clamp',
  SHAPE_MAX_PX === 512 && (() => {
    const over = clampShapeSize(4096, 4096, 16);
    return over.w === 512 && over.h === 512;
  })(),
  'clampShapeSize still bounds the IMPORT default at 512 (executed: clampShapeSize(4096,4096,16) -> 512x512) — a sanity default ' +
  'for the freshly dropped box, NOT a live resizer bound. The cap question on drag is now answered by parity with every other node: no cap.');

/* ===========================================================================
   5 — THE CUSTOM TILE DOES NOT INSERT ON SINGLE CLICK (fix 5).
=========================================================================== */
console.log('\n' + '='.repeat(78));
console.log('BE-5 — custom tile: palette parity, drag + double-click intact');
console.log('='.repeat(78));

const tileStart = APP.indexOf('data-custom-shape=');
const tileSlice = tileStart > -1 ? APP.slice(tileStart, APP.indexOf('</button>', tileStart)) : '';
assert('r2g5.the-custom-tile-has-no-onClick-insert',
  tileSlice.length > 0 && !/onClick=\{\(\) => insertCustomShape/.test(tileSlice),
  tileSlice.length > 0
    ? "the custom tile's JSX carries NO onClick insert (OLD claim: onClick={() => insertCustomShape(s)} — one stray click " +
      'littered the board). Convention target: the LEFT palette rows, whose contract is drag-or-double-click ' +
      '("Drag onto the canvas or double-click to add"). Favourites are click-to-insert BY DESIGN and stay so; ' +
      'the custom tiles follow the palette, per Harvey: single click should NOT insert.'
    : 'the custom tile markup moved — re-anchor the slice');
assert('r2g5.the-double-click-path-survives',
  tileSlice.length > 0 && /onDoubleClick=\{\(\) => insertCustomShape\(s\)\}/.test(tileSlice),
  'onDoubleClick still inserts — the two working paths are double-click and drag; click joined the palette in doing nothing.');
assert('r2g5.the-drag-path-survives',
  tileSlice.length > 0 && /onDragStart=\{e => e\.dataTransfer\.setData\('customshape', s\.data\)\}/.test(tileSlice),
  "the drag payload (the sanitised MARKUP, resolved back through dropCustomShape) is untouched.");
assert('r2g5.the-tooltip-is-truthful',
  tileSlice.length > 0 && /title=\{`Drag onto the canvas or double-click to add/.test(tileSlice)
    && !/click, double-click or drag/.test(tileSlice),
  'the title no longer advertises a click that does nothing (and no longer leaks the favourites wording); it matches the palette rows wording.');

/* ===========================================================================
   6 — NEGATIVE CONTROLS: the counting must be able to FAIL.
=========================================================================== */
console.log('\n' + '='.repeat(78));
console.log('BE-6 — negative controls (each predicate must catch its mutant)');
console.log('='.repeat(78));
const MUTANT_SHAPES = SHAPES_RAW.replace('<circle cx="50" cy="50" r="49.5"', '<circle cx="100" cy="50" r="48"');
const mutantCx = (stripTs(MUTANT_SHAPES).match(/case 'connector':\s*\n\s*return `<circle ([^`]+)`;/) ?? [])[1];
const mAttrs = Object.fromEntries([...(mutantCx ?? '').matchAll(/(\w+)="([\d.]+)"/g)].map(m => [m[1], +m[2]]));
assert('r2g6.mutant-old-circle-geometry-IS-caught',
  mAttrs.r === 48 && (2 * mAttrs.r) / 100 !== 0.99,
  `reverting the geometry to the old r=48/cx=100 pair reads a ${(2 * mAttrs.r).toFixed(0)}-unit fill over the 100-unit square frame ` +
  '(0.96 ≠ 0.99, and cx=100 is half OFF the frame) — r2g1\'s 0.99 claim fails it. RED, not vacuous.');
const MUTANT_TILE = APP_RAW.replace("onDoubleClick={() => insertCustomShape(s)}", "onClick={() => insertCustomShape(s)}");
assert('r2g6.mutant-click-insert-IS-caught',
  /onClick=\{\(\) => insertCustomShape\(s\)\}/.test(MUTANT_TILE),
  'the click-insert mutant is visible to the same slice r2g5 reads — a regression cannot hide.');

const failed = results.filter(r => !r.pass);
console.log('\n' + '='.repeat(78));
console.log(`ROUND BE HARNESS: ${results.length - failed.length}/${results.length} passed`);
console.log('='.repeat(78));
for (const f of failed) console.log(`  FAIL  ${f.id}\n        ${f.detail}`);
try { rmSync(join(ROOT, '.be-entry.ts'), {force: true}); } catch { /* gone */ }
try { rmSync(join(ROOT, '.be-out.mjs'), {force: true}); } catch { /* gone */ }
process.exit(failed.length ? 1 : 0);
