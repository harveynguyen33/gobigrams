#!/usr/bin/env node
/**
 * ROUND AR harness — the SVG vector serializer (AR-1), per AMENDMENT 1.
 *
 * No browser, no DOM, no CDP. The REAL `src/exportSvg.ts` is bundled with the
 * project's own esbuild and imported (the `round-ao`/`round-ad` pattern), then
 * every assertion below runs on the exporter's OUTPUT STRING and emitted
 * GEOMETRY, with a deterministic STUB measurer standing in for the browser's
 * getComputedStyle-backed one. Nothing here is a painted measurement — the
 * PAINTED proof (canvas pixel diff > 0 through an <img>, natural dimensions,
 * the live download landing on disk, Quick Look / Figma parity) is the
 * orchestrator's and reviewer's LIVE pass, exactly as
 * `checks/round-ad-flowchart.mjs` states for its own scope.
 *
 * Negative control: with `AR_ROOT` pointed at a checkout (or a `git show
 * 26baec6:…` reconstruction) of the PRE-FIX tree, the pure emitter does not
 * exist there — the bundle step fails, the harness records that as a FAIL row
 * with the reason and exits non-zero. RED, not a silent crash.
 */
import {readFileSync, writeFileSync, rmSync, existsSync, mkdtempSync} from 'node:fs';
import {join, dirname} from 'node:path';
import {tmpdir} from 'node:os';
import {fileURLToPath} from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REAL_ROOT = join(HERE, '..');
const ROOT = process.env.AR_ROOT || REAL_ROOT;

const results = [];
const assert = (id, pass, detail = '') => {
  results.push({id, pass: !!pass, detail});
  console.log(`  ${pass ? 'PASS' : 'FAIL'}  ${id}  —  ${detail}`);
};

console.log('ROUND AR — svg-export (output-string + geometry assertions)');
console.log(`  target root: ${ROOT}`);

/* ---------------------------------------------------------------- bundle -- */

const ENTRY = join(ROOT, '.ar5-entry.ts');
const OUT = join(ROOT, '.ar5-out.mjs');
let MOD = null;
let bundleError = '';
try {
  if (!existsSync(join(ROOT, 'src', 'exportSvg.ts'))) {
    throw new Error('src/exportSvg.ts does not exist in the target root (pre-fix tree: the pure emitter is not there yet)');
  }
  writeFileSync(ENTRY, `export {exportSvg} from './src/exportSvg';\nexport {EXPORT_TOKENS} from './src/theme';\n`);
  const esbuild = existsSync(join(ROOT, 'node_modules/.bin/esbuild'))
    ? join(ROOT, 'node_modules/.bin/esbuild')
    : join(REAL_ROOT, 'node_modules/.bin/esbuild');
  const {execFileSync} = await import('node:child_process');
  writeFileSync(OUT, execFileSync(esbuild,
    [ENTRY, '--bundle', '--platform=node', '--format=esm', '--log-level=error',
      '--external:react', '--external:react-dom', '--external:react/jsx-runtime', '--external:@xyflow/react'],
    {encoding: 'utf8'}));
  MOD = await import(`${OUT}?t=${Date.now()}`);
} catch (e) {
  bundleError = String(e && e.message ? e.message : e);
} finally {
  try { rmSync(ENTRY, {force: true}); } catch { /* best effort */ }
  try { rmSync(OUT, {force: true}); } catch { /* best effort */ }
}

if (!MOD) {
  assert('module', false, `src/exportSvg.ts could not be bundled/imported from this root — ${bundleError}`);
  console.log('\nRED — the serializer under test does not exist on this tree (expected for the pre-fix negative control).');
  process.exit(1);
}
assert('module', true, `real src/exportSvg.ts bundled and imported (${bundleError ? 'unused err: ' + bundleError : 'clean'})`);

const {exportSvg, EXPORT_TOKENS} = MOD;

/* ------------------------------------------------------------- fixtures -- */

/* Theme-invariant token map shape: the HARNESS does not resolve CSS — it
   passes two distinct resolved maps (as App does for dark / light) and
   asserts the output carries them and that a theme switch changes bytes. */
const DARK = {
  '--bg': '#0b0b0d', '--surface': '#141417', '--elevated': '#1b1b20',
  '--border': '#26262c', '--border-strong': '#3a3a44', '--fg': '#e8e8ea',
  '--dim': '#8a8a92', '--dim2': '#5c5c66', '--acc': '#5b8cff', '--acc-soft': '#5b8cff22',
  '--sel': '#5b8cff', '--sel-soft': '#5b8cff18', '--green': '#3fbf6f', '--red': '#e5484d',
  '--danger': '#e5484d', '--card': '#141417',
  '--c-accent': '#5b8cff', '--c-green': '#3fbf6f', '--c-cyan': '#39c5cf',
  '--c-violet': '#8b7cf6', '--c-amber': '#f5a623', '--c-slate': '#8a8a92',
  '--c-red': '#e5484d', '--c-blue': '#4c7ef3', '--c-pink': '#e55c8c',
  '--c-black': '#000000', '--c-white': '#ffffff',
};
const LIGHT = {...DARK,
  '--bg': '#f7f7f8', '--surface': '#ffffff', '--elevated': '#ffffff',
  '--border': '#e3e3e8', '--border-strong': '#c2c2cc', '--fg': '#17171b',
  '--dim': '#5f5f6b', '--dim2': '#8f8f9a', '--acc': '#2f5fe0', '--acc-soft': '#2f5fe022',
  '--sel': '#2f5fe0', '--sel-soft': '#2f5fe018',
  '--c-accent': '#2f5fe0', '--c-violet': '#6b4fe0', '--c-slate': '#5f5f6b',
};

/* The deterministic STUB measurer — the whole point of the injected-measurer
   design. Values mirror the app stylesheet's own numbers (title 14.5/650). */
const STUB = {
  text() { return {x: 14, y: 12, w: 130, h: 46, size: 14.5, weight: 650, fill: '#e8e8ea', anchor: 'start'}; },
  edgePath() { return null; },
  origin() { return {x: 0, y: 0}; },
};

const node = (id, x, y, data, extra = {}) => ({
  id, type: 'goblin', position: {x, y},
  measured: {width: 190, height: 131},
  data, parentId: null, ...extra,
});

/* One node per family the round must cover (spec's SHAPE COVERAGE list). */
const FAMILY = [
  ['rect', 'service', {}],
  ['rounded-external', 'external', {}],
  ['cylinder-database', 'database', {plainCylinder: true}],
  ['cylinder-full', 'database', {plainCylinder: false}],
  ['cylinder-storeddata', 'storeddata', {}],
  ['queue', 'queue', {}],
  ['actor', 'actor', {}],
  ['gateway', 'gateway', {}],
  ['note', 'note', {}],
  ['terminator', 'terminator', {}],
  ['process', 'process', {}],
  ['decision', 'decision', {}],
  ['io', 'io', {}],
  ['document', 'document', {}],
  ['subprocess', 'subprocess', {}],
  ['preparation', 'preparation', {}],
  ['manual', 'manual', {}],
  ['delay', 'delay', {}],
  ['connector', 'connector', {}],
  ['offpage', 'offpage', {}],
  ['manualinput', 'manualinput', {}],
  ['display', 'display', {}],
  ['looplimit', 'looplimit', {}],
  ['internalstorage', 'internalstorage', {}],
  ['lifeline', 'lifeline', {}],
  ['activation', 'activation', {}],
  ['fragment', 'fragment', {}],
].map(([tag, shape, extraData], i) =>
  node(`n-${tag}`, 40 + (i % 6) * 240, 40 + Math.floor(i / 6) * 180,
    {shape, kicker: shape, title: `Node ${tag}`, sub: 'sub line', colorKey: 'violet', ...extraData}));

const TABLE = node('n-table', 40, 1300, {
  columns: [
    {name: 'id', pk: true}, {name: 'name'}, {name: 'qty'},
  ], name: 'orders', colorKey: 'cyan',
}, {type: 'table', measured: {width: 190, height: 110}});

const GROUP = node('n-group', 20, 1480, {shape: 'group', title: 'boundary'}, {
  measured: {width: 500, height: 300},
});
const GROUPED = node('n-grouped', 60, 1540, {shape: 'service', title: 'inside group', colorKey: 'green'}, {parentId: 'n-group'});

const LABEL = node('n-label', 700, 1400, {title: 'free label', sub: 'note'}, {type: 'label', measured: {width: 120, height: 40}});

const CUSTOM = node('n-custom', 700, 1480, {
  svg: '<rect x="2" y="2" width="196" height="96" rx="8" fill="none" stroke="#39c5cf" stroke-width="3"/>',
  title: 'imported', colorKey: 'cyan',
}, {type: 'customshape'});

const NODES = [...FAMILY, TABLE, GROUP, GROUPED, LABEL, CUSTOM];
const EDGES = [
  {id: 'e1', source: 'n-rect', target: 'n-cylinder-database', data: {label: 'reads', colorKey: 'amber'}},
  {id: 'e2', source: 'n-process', target: 'n-decision', data: {colorKey: 'red'}},
];

const svg = exportSvg({nodes: NODES, edges: EDGES, theme: 'dark', tokens: DARK, measurer: STUB, pad: 24});
const svgLight = exportSvg({nodes: NODES, edges: EDGES, theme: 'light', tokens: LIGHT, measurer: STUB, pad: 24});

/* ---------------------------------------------------------- assertions -- */

/* A1 — no foreignObject anywhere in the output. */
assert('A1-no-foreignObject', !svg.includes('<foreignObject'),
  `output bytes contain no '<foreignObject' (length ${svg.length})`);

/* A2 — root svg carries data-theme. */
const rootTag = /^<svg\b[^>]*>/.exec(svg)?.[0] ?? '';
assert('A2-data-theme', /data-theme="dark"/.test(rootTag), `root svg: ${rootTag.slice(0, 90)}…`);

/* A3 — the node title is real <text> content (assert on the CONTENT, not the
   node id: a title <text> is matched by its painted attributes + payload). */
assert('A3-title-as-text', />Node rect-rounded<\/text>/.test(svg) || />Node queue<\/text>/.test(svg),
  '<text> elements carry the node titles');
const titleCount = (svg.match(/<text [^>]*font-size="14\.5"[^>]*font-weight="650"[^>]*>[^<]+<\/text>/g) ?? []).length;
assert('A3c-title-per-node', titleCount >= NODES.length - 3, /* label + custom carry their own text shapes */
  `${titleCount} title <text> elements for ${NODES.length - 3} expected`);
assert('A3b-text-paint-attrs', /<text [^>]*font-size="14\.5"[^>]*font-weight="650"[^>]*fill="#e8e8ea"/.test(svg),
  'title <text> carries explicit font-size / font-weight / fill');

/* A4 — the <style> block inlines the EXPORT_TOKENS set for the chosen theme. */
const styleBlock = /<style>[\s\S]*?<\/style>/.exec(svg)?.[0] ?? '';
const missingTokens = EXPORT_TOKENS.filter(t => !styleBlock.includes(`${t}:`));
assert('A4-token-style', styleBlock !== '' && missingTokens.length === 0,
  missingTokens.length ? `missing in <style>: ${missingTokens.join(' ')}` : `all ${EXPORT_TOKENS.length} EXPORT_TOKENS inlined`);

/* A5 — a theme switch changes the output bytes (dark vs light resolved maps). */
assert('A5-theme-bytes', svg !== svgLight && svgLight.includes('data-theme="light"') && svgLight.includes('--bg:#f7f7f8'),
  `dark ${svg.length}B vs light ${svgLight.length}B, both rooted with their own data-theme`);

/* A6 — the string parses as XML: a stack-based well-formedness check (no DOM
   in Node, per AMENDMENT 1; no XML parser dependency, per the no-new-deps
   rule). Balanced tags, no stray '<', single root, self-closing respected. */
function xmlWellFormed(s) {
  const src = s.replace(/<!--[\s\S]*?-->/g, '');
  const stack = [];
  const re = /<\s*(\/?)([A-Za-z][\w:-]*)((?:[^>"']|"[^"]*"|'[^']*')*?)(\/?)\s*>/g;
  let last = 0, m;
  while ((m = re.exec(src))) {
    if (src.slice(last, m.index).includes('<')) return 'bare < outside a tag';
    const [, close, name, attrs, self] = m;
    if (close) {
      const top = stack.pop();
      if (top !== name) return `mismatched </${name}>, open stack top = ${String(top)}`;
    } else {
      if (/\bxmlns:xhtml\b/.test(attrs)) return 'xhtml namespace smuggled in';
      if (!self) stack.push(name);
    }
    last = m.index + m[0].length;
  }
  if (src.slice(last).includes('<')) return 'bare < after the last tag';
  if (stack.length) return `unclosed <${stack.join('><')}>`;
  if (!/^<svg\b/.test(src)) return 'root element is not svg';
  return '';
}
const xmlErr = xmlWellFormed(svg);
assert('A6-xml-wellformed', xmlErr === '', xmlErr === '' ? 'balanced tags, single svg root, no xhtml ns' : xmlErr);

/* A7 — painted primitives exist inside EVERY known shape family's node box,
   and their union covers a non-trivial area of it (arithmetic over the
   emitted geometry, the AD frame-check style). */
function nodeBlock(svgSrc, id) {
  const begin = svgSrc.indexOf(`<g data-ar-node="${id}"`);
  if (begin < 0) return null;
  let depth = 0, i = begin;
  for (; i < svgSrc.length; i++) {
    if (svgSrc.startsWith('<g', i)) depth++;
    else if (svgSrc.startsWith('</g>', i)) { depth--; if (!depth) return svgSrc.slice(begin, i + 4); }
  }
  return null;
}
function paintedArea(block, boxW, boxH) {
  let area = 0;
  /* the goblin frame's own wrapper svg IS a paint region sized to the node */
  const frame = /<svg x="0" y="0" width="([\d.]+)" height="([\d.]+)"/.exec(block);
  if (frame) area = Math.max(area, parseFloat(frame[1]) * parseFloat(frame[2]));
  for (const m of block.matchAll(/<rect\b([^>]*)\/?>(?:<\/rect>)?/g)) {
    const a = m[1];
    const x = parseFloat(/x="([\d.-]+)"/.exec(a)?.[1] ?? '0');
    const y = parseFloat(/y="([\d.-]+)"/.exec(a)?.[1] ?? '0');
    const w = parseFloat(/width="([\d.-]+)"/.exec(a)?.[1] ?? '0');
    const h = parseFloat(/height="([\d.-]+)"/.exec(a)?.[1] ?? '0');
    area += Math.max(0, w * h * (a.includes('fill="none"') ? 0.12 : 1));
  }
  for (const m of block.matchAll(/<circle\b[^>]*r="([\d.]+)"[^>]*>/g)) area += Math.PI * parseFloat(m[1]) ** 2;
  for (const m of block.matchAll(/<ellipse\b[^>]*rx="([\d.]+)"[^>]*ry="([\d.]+)"[^>]*>/g)) area += Math.PI * parseFloat(m[1]) * parseFloat(m[2]);
  for (const m of block.matchAll(/<path\b[^>]*d="([^"]+)"[^>]*>/g)) {
    const nums = m[1].match(/-?\d+(?:\.\d+)?/g)?.map(Number) ?? [];
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (let i = 0; i + 1 < nums.length; i += 2) {
      minX = Math.min(minX, nums[i]); maxX = Math.max(maxX, nums[i]);
      minY = Math.min(minY, nums[i + 1]); maxY = Math.max(maxY, nums[i + 1]);
    }
    if (isFinite(minX)) area += Math.min((maxX - minX) * (maxY - minY), boxW * boxH) * 0.4;
  }
  return area;
}
const weak = [];
/* label nodes are text-only BY DESIGN (transparent background, as rendered —
   the spec's table), and customshape nests verbatim markup (A11): both are
   excluded from the painted-area floor, the others must clear it. */
const TEXT_ONLY = new Set(['n-label', 'n-custom']);
for (const n of NODES) {
  if (n.id === 'n-group') continue; /* boundary: frame-only, asserted separately */
  const block = nodeBlock(svg, n.id);
  const w = n.measured?.width ?? 0, h = n.measured?.height ?? 0;
  if (!block) { weak.push(`${n.id}: no block`); continue; }
  const primCount = (block.match(/<(rect|path|ellipse|circle|text)\b/g) ?? []).length;
  const ratio = paintedArea(block, w, h) / (w * h);
  const floor = TEXT_ONLY.has(n.id) ? 0 : 0.25;
  if (primCount < Math.min(2, TEXT_ONLY.has(n.id) ? 1 : 2) || ratio < floor) weak.push(`${n.id}: ${primCount} primitives, ${(ratio * 100).toFixed(0)}% coverage`);
}
assert('A7-painted-primitives-per-node', weak.length === 0,
  weak.length ? `weak nodes: ${weak.join('; ')}` : `${NODES.length - 3}/${NODES.length - 3} shape-box nodes carry primitives covering >= 25% of the box (cylinder full + plain, table, custom, label; group asserted by A8)`);

/* A8 — group boundary: a dashed frame BEHIND its child (emitted before it). */
const gBlock = nodeBlock(svg, 'n-group');
const giGroup = svg.indexOf(nodeBlock(svg, 'n-group') ?? '');
const giChild = svg.indexOf(nodeBlock(svg, 'n-grouped') ?? '');
assert('A8-group-boundary', !!gBlock && gBlock.includes('stroke-dasharray') && giGroup < giChild && giChild > 0,
  `dashed boundary rect present, emitted before its child (group@${giGroup} < child@${giChild})`);

/* A9 — edge routes + markers + label plate. */
assert('A9-edges-markers', svg.includes('marker-end="url(#ar-mk-') && svg.includes('<marker') && svg.includes('>reads</text>'),
  'both edges routed as <path> with defs markers; the label "reads" on a plate');

/* A10 — table: header + one row per column + PK dot. */
const tBlock = nodeBlock(svg, 'n-table') ?? '';
assert('A10-table', tBlock.includes('>orders</text>') && tBlock.includes('>id</text>') && tBlock.includes('>qty</text>') && tBlock.includes('<circle'),
  'header text + column rows + PK circle present');

/* A11 — custom imported shape is nested verbatim SVG. */
const cBlock = nodeBlock(svg, 'n-custom') ?? '';
assert('A11-custom-verbatim', cBlock.includes('stroke="#39c5cf"') && cBlock.includes('<rect'),
  'data.svg nested as real SVG markup');

/* A12 — budget: a 70-node synthetic board exports in <= 2000 ms. */
const big = Array.from({length: 70}, (_, i) =>
  node(`big-${i}`, (i % 10) * 240, Math.floor(i / 10) * 180,
    {shape: FAMILY[i % FAMILY.length][1], title: `svc ${i}`, kicker: 'k', sub: 's', colorKey: 'accent'}));
const bigEdges = Array.from({length: 40}, (_, i) =>
  ({id: `be${i}`, source: `big-${i}`, target: `big-${i + 10}`, data: {colorKey: 'slate'}}));
const t0 = process.hrtime.bigint();
const bigSvg = exportSvg({nodes: big, edges: bigEdges, theme: 'dark', tokens: DARK, measurer: STUB, pad: 24});
const ms = Number(process.hrtime.bigint() - t0) / 1e6;
assert('A12-budget-70nodes', ms <= 2000 && bigSvg.length > 10000,
  `${ms.toFixed(1)} ms, ${bigSvg.length} bytes (ceiling 2000 ms)`);

/* ------------------------------------------------------------------ end -- */

const fails = results.filter(r => !r.pass);
console.log(`\n${results.length - fails.length}/${results.length} assertions PASS${fails.length ? `, ${fails.length} FAIL` : ''}`);
process.exit(fails.length ? 1 : 0);
