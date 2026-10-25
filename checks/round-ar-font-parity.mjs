#!/usr/bin/env node
/**
 * ROUND AR harness — AR-11 typography parity (measurement ↔ emission).
 *
 * The exporter used to hard-code a monospace FONT_STACK in three places (the
 * wrap measurer, the <style> block and every <text>), so the exported file
 * wrapped and painted in a DIFFERENT typeface than the canvas. This harness
 * drives the REAL `src/export/exportSvg.ts` (project esbuild bundle, DOM-free) with
 * a stub measurer that supplies a per-row font FAMILY, and asserts:
 *   - every emitted <text> carries the row's own family (no hard-coded one),
 *   - the inline <style> no longer forces one family on all text,
 *   - the wrap consumes the family-keyed metrics (narrow family → fewer
 *     lines, wide family → more lines, both the canonical greedy counts),
 *   - `measureText` is called WITH the row family,
 *   - the source carries no font-stack literal,
 *   - ROUND-AR-DEFECT-1: the three rows the reviewer measured WRONG
 *     (edge label, table column, group title) are asserted BY NAME to carry
 *     their own MEASURED family on the emitted <text> — the measurer stub
 *     supplies distinct fonts per row and the assertion is that the emitted
 *     bytes match, not that the rows silently inherit a root fallback.
 *
 * Negative control: AR_ROOT pointed at the mono-hard-coded tree (ffafce9) —
 * the family rows FAIL there. RED, not a silent pass. The DEFECT-1 rows were
 * additionally proven RED on the pre-fix commit ee1611e (they inherited the
 * root family there while this harness asserted the measured one).
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

console.log('ROUND AR — font parity (per-row family through measurement AND emission)');
console.log(`  target root: ${ROOT}`);

/* ---------------------------------------------------------------- bundle -- */

const bundleAndImport = async () => {
  const entry = join(ROOT, '.ar11-entry.ts');
  const out = join(ROOT, '.ar11-out.mjs');
  writeFileSync(entry,
    `export {exportSvg} from '${join(ROOT, 'src/export/exportSvg.ts')}';\n` +
    `export {EXPORT_TOKENS} from '${join(ROOT, 'src/theme')}';\n`);
  const esbuild = existsSync(join(ROOT, 'node_modules/.bin/esbuild'))
    ? join(ROOT, 'node_modules/.bin/esbuild')
    : join(REAL_ROOT, 'node_modules/.bin/esbuild');
  writeFileSync(out, execFileSync(esbuild,
    [entry, '--bundle', '--platform=node', '--format=esm', '--log-level=error',
     '--external:react', '--external:react-dom', '--external:react/jsx-runtime',
     '--external:@xyflow/react'],
    {encoding: 'utf8',
     env: {...process.env, NODE_PATH: join(REAL_ROOT, 'node_modules')}}));
  const mod = await import(`${out}?t=${Date.now()}`);
  rmSync(entry, {force: true});
  rmSync(out, {force: true});
  return mod;
};

let MOD = null;
let bundleError = '';
try { MOD = await bundleAndImport(); } catch (e) { bundleError = String(e?.message ?? e); }
if (!MOD) {
  assert('module', false, `real src/export/exportSvg.ts could not be bundled from this root — ${bundleError}`);
  process.exit(1);
}
assert('module', true, 'real src/export/exportSvg.ts bundled and imported');
const {exportSvg, EXPORT_TOKENS} = MOD;

/* --------------------------------------------------------------- fixtures - */

/* Two distinct families with two distinct metrics. The measurer's width
   function keys the advance off the SUPPLIED family: the sans family is
   narrow, the display family wide. A tree that wraps WITHOUT carrying the
   family through to measureText falls into the wide default and over-wraps
   the sans fixture — which is exactly the AR-11 defect shape (wrap decided
   in one typeface, file painted in another). */
const SANS = 'TestSans, sans-serif';
const WIDE = 'TestWideDisplay';
const MONO = 'TestMono';
/* ROUND-AR-DEFECT-1 — four DISTINCT family strings, so an emitted row that
   inherits the root fallback (or a sibling row's family) can never satisfy
   its own assertion. */
const ELABEL = 'TestEdgeLabelMono';
const TCOL = 'TestTableColMono';
const GTITLE = 'TestGroupTitleMono';

const advanceOf = (text, o = {}) =>
  text.length * (o.family === SANS ? 5.8 : o.family === WIDE ? 13.05 : 13.05) +
  Math.max(0, text.length - 1) * (o.spacing ?? 0);

const stub = (family, opts = {}) => {
  const calls = [];
  const measurer = {
    text() {
      return {
        x: 10, y: 8, w: 120, h: 90, size: 14.5, weight: 650,
        fill: '#e8e8ea', anchor: 'start', titleW: 147,
        family,
        rows: {
          kicker: {family: MONO, size: 9.5, weight: 500, spacing: 1.1},
          sub: {family: MONO, size: 11.5, weight: 450, spacing: 0},
          metric: {family: MONO, size: 20, weight: 700, spacing: 0},
          /* ROUND-AR-DEFECT-1 — the re-anchored rows each carry their OWN
             measured font; the harness asserts the emitted <text> matches
             THESE, so a root-fallback inheritance fails loudly. */
          tcol: {family: TCOL, size: 11, weight: 400, spacing: 0},
          groupTitle: {family: GTITLE, size: 12, weight: 600, spacing: 0.2},
        },
      };
    },
    edgePath() { return null; },
    edgeLabelFont() { return {family: ELABEL, size: 11, weight: 600, spacing: 0}; },
    measureText(text, o) { calls.push(o ?? null); return advanceOf(text, o); },
    ...(opts.noDefaultFamily ? {} : {defaultFamily: () => family}),
  };
  return {calls, measurer};
};

const tokens = {
  '--fg': '#e8e8ea', '--dim': '#8a8a92', '--surface': '#141417',
  '--bg': '#0b0b0d', '--border': '#26262b', '--acc': '#7c7cf0',
};
const mkNode = (id, data) => ({
  id, type: 'goblin', position: {x: 0, y: 0},
  measured: {width: 200, height: 130},
  data: {shape: 'rect', ...data}, parentId: null,
});
const run = (m, nodes) => exportSvg({nodes, edges: [], theme: 'dark', tokens, measurer: m, pad: 10});

const nodeBlock = (svg, id) => svg.split(`<g data-ar-node="${id}"`)[1]?.split('</g>')[0] ?? '';
const textAttrs = (block, content) =>
  [...block.matchAll(/<text ([^>]*)>([^<]*)<\/text>/g)]
    .filter(m => m[2] === content).map(m => m[1]);

/* canonical greedy line count at the title's 147 px content width (the same
   arithmetic `wrapText` must reproduce when fed the family's advance) */
const greedyLines = (title, adv) => {
  let n = 1, cur = '';
  for (const w of title.trim().split(/\s+/)) {
    const cand = cur ? cur + ' ' + w : w;
    if (adv(cand) <= 147) { cur = cand; continue; }
    if (cur) n++;
    cur = w;
  }
  return n;
};

const LONG = 'Order Ingestion Service With Very Long Name That Must Wrap';

/* ------------------------------------------------- F1/F4/F7/F8: full rows - */

console.log('\nF1/F4/F7/F8 — per-row family reaches the emitted <text>');
{
  const {measurer} = stub(SANS);
  const svg = run(measurer, [mkNode('n-full', {
    kicker: 'step', title: 'Short Title', sub: 'sub line', metric: '42', metricUnit: 'ms',
  })]);
  const block = nodeBlock(svg, 'n-full');

  const titleAttrs = textAttrs(block, 'Short Title');
  assert('F1-title-carries-row-family',
    titleAttrs.length >= 1 && titleAttrs.every(a => a.includes(`font-family="${SANS}"`)),
    titleAttrs.length
      ? `title <text> font-family = ${/font-family="([^"]*)"/.exec(titleAttrs[0])?.[1]}`
      : 'no title <text> emitted');

  const kickAttrs = textAttrs(block, 'STEP');
  assert('F4-kicker-row-font-and-spacing',
    kickAttrs.length === 1 && kickAttrs[0].includes(`font-family="${MONO}"`) &&
      kickAttrs[0].includes('letter-spacing="1.1"') && kickAttrs[0].includes('font-size="9.5"'),
    kickAttrs.length ? `kicker <text> attrs: ${kickAttrs[0]}` : 'no kicker <text> emitted');

  const subAttrs = textAttrs(block, 'sub line');
  const metricAttrs = textAttrs(block, '42 ms');
  assert('F4b-sub-metric-row-fonts',
    subAttrs.length === 1 && subAttrs[0].includes(`font-family="${MONO}"`) &&
      metricAttrs.length === 1 && metricAttrs[0].includes(`font-family="${MONO}"`),
    `sub ${subAttrs[0]?.includes(`font-family="${MONO}"`)}, metric ${metricAttrs[0]?.includes(`font-family="${MONO}"`)}`);

  const styleBlock = /<style>[\s\S]*?<\/style>/.exec(svg)?.[0] ?? '';
  const missingTokens = EXPORT_TOKENS.filter(t => !styleBlock.includes(`${t}:`));
  assert('F2-style-block-no-forced-family',
    styleBlock !== '' && missingTokens.length === 0 && !/font-family/.test(styleBlock) &&
      !/<text\b/.test(styleBlock),
    styleBlock.includes('font-family')
      ? '<style> still forces a font-family (blanket text rule must go; tokens stay)'
      : `<style> carries only the ${EXPORT_TOKENS.length - missingTokens.length} token declarations, no font-family rule`);

  const rootTag = /^<svg\b[^>]*>/.exec(svg)?.[0] ?? '';
  assert('F7-root-inherits-measurer-default',
    rootTag.includes(`font-family="${SANS}"`),
    rootTag.includes('font-family')
      ? `root svg font-family = ${/font-family="([^"]*)"/.exec(rootTag)?.[1]} (rows WITHOUT a dedicated element still inherit it)`
      : 'root svg carries no measurer-supplied fallback family');

  /* ROUND-AR-DEFECT-1 — the three rows the reviewer measured WRONG must each
     carry THEIR OWN measured family on the emitted <text>. The stub families
     are distinct from the root fallback, so silent inheritance is RED here
     (and was RED on the pre-fix tree, recorded in the header). */
  console.log('\nDEFECT-1 — edge label / table column / group title carry their MEASURED family');
  {
    /* edge label: a labelled edge between two nodes */
    const el = stub(SANS);
    const full = exportSvg({
      nodes: [mkNode('n-a', {title: 'Alpha'}), mkNode('n-b', {title: 'Beta'})],
      edges: [{id: 'e-lab', source: 'n-a', target: 'n-b', data: {label: 'events'}, label: 'events'}],
      theme: 'dark', tokens, measurer: el.measurer, pad: 10,
    });
    const labAttrs = textAttrs(full, 'events');
    assert('D1-edge-label-row-family',
      labAttrs.length >= 1 && labAttrs.every(a => a.includes(`font-family="${ELABEL}"`)) &&
        labAttrs.every(a => a.includes('font-size="11"') && a.includes('font-weight="600"')),
      labAttrs.length
        ? `edge label <text> attrs: ${labAttrs[0]}`
        : 'no edge label <text> emitted');

    /* table column: `.tnode-cname` rows via rows.tcol */
    const tb = stub(SANS);
    const tableNode = {
      ...mkNode('n-tbl', {title: 'users'}),
      type: 'table',
      data: {columns: [{name: 'user_id', pk: true}, {name: 'email'}]},
    };
    const tblSvg = exportSvg({
      nodes: [tableNode], edges: [], theme: 'dark', tokens, measurer: tb.measurer, pad: 10,
    });
    const colAttrs = textAttrs(nodeBlock(tblSvg, 'n-tbl'), 'user_id');
    assert('D1-table-column-row-family',
      colAttrs.length >= 1 && colAttrs.every(a => a.includes(`font-family="${TCOL}"`)) &&
        colAttrs.every(a => a.includes('font-size="11"') && a.includes('font-weight="400"')),
      colAttrs.length
        ? `table column <text> attrs: ${colAttrs[0]}`
        : 'no table column <text> emitted');

    /* group title: `.group-label` rows via rows.groupTitle */
    const gr = stub(SANS);
    const groupNode = {...mkNode('n-g', {title: 'Core Domain'}), data: {shape: 'group', title: 'Core Domain'}};
    const child = {...mkNode('n-c', {title: 'Inside'}), parentId: 'n-g'};
    const grSvg = exportSvg({
      nodes: [groupNode, child], edges: [], theme: 'dark', tokens, measurer: gr.measurer, pad: 10,
    });
    const gBlock = grSvg.split(`<g data-ar-node="n-g"`)[1]?.split('</g>')[0] ?? '';
    const gtAttrs = textAttrs(gBlock, 'Core Domain');
    assert('D1-group-title-row-family',
      gtAttrs.length >= 1 && gtAttrs.every(a => a.includes(`font-family="${GTITLE}"`)) &&
        gtAttrs.every(a => a.includes('font-size="12"') && a.includes('font-weight="600"')),
      gtAttrs.length
        ? `group title <text> attrs: ${gtAttrs[0]}`
        : 'no group title <text> emitted');
  }

  const {measurer: bare} = stub(SANS, {noDefaultFamily: true});
  const bareRoot = /^<svg\b[^>]*>/.exec(run(bare, [mkNode('n-bare', {title: 'x'})]))?.[0] ?? '';
  assert('F7b-root-omits-attr-without-default', !bareRoot.includes('font-family'),
    bareRoot.includes('font-family') ? 'root svg invented a family the measurer never supplied' : 'no measurer default → no font-family on the root');

  const monoTokens = ['ui-monospace', 'Menlo', 'Consolas'].filter(t => svg.includes(t));
  assert('F8-output-has-no-hardcoded-stack', monoTokens.length === 0,
    monoTokens.length ? `output still carries hard-coded stack tokens: ${monoTokens.join(', ')}` : 'emitted bytes contain no member of the old hard-coded stack');
}

/* ------------------------------------------- F3/F5: the wrap uses the font - */

console.log('\nF3/F5 — the wrap decision consumes the row family\'s own metrics');
{
  const LONG_ONLY = {title: LONG}; /* no sub/metric → no height clamp interferes */

  const sans = stub(SANS);
  const sansSvg = run(sans.measurer, [mkNode('n-sans', LONG_ONLY)]);
  const sansLines = textAttrs(nodeBlock(sansSvg, 'n-sans'), '').length; /* placeholder, recomputed below */
  const sansTexts = [...nodeBlock(sansSvg, 'n-sans').matchAll(/<text ([^>]*)>([^<]*)<\/text>/g)]
    .filter(m => m[1].includes(`font-size="14.5"`));
  const wantSans = greedyLines(LONG, (t) => advanceOf(t, {family: SANS}));
  assert('F3a-narrow-family-canonical-lines', sansTexts.length === wantSans,
    `"${LONG.slice(0, 24)}…" @147px in the NARROW family → emitted ${sansTexts.length} lines, canonical greedy = ${wantSans} (sans call count observed: ${sans.calls.length}${sansLines ? '' : ''})`);

  const wide = stub(WIDE);
  const wideSvg = run(wide.measurer, [mkNode('n-wide', LONG_ONLY)]);
  const wideTexts = [...nodeBlock(wideSvg, 'n-wide').matchAll(/<text ([^>]*)>([^<]*)<\/text>/g)]
    .filter(m => m[1].includes(`font-size="14.5"`));
  const wantWide = greedyLines(LONG, (t) => advanceOf(t, {family: WIDE}));
  assert('F3b-wide-family-more-lines', wideTexts.length === wantWide && wantWide > wantSans,
    `SAME text in the WIDE family → emitted ${wideTexts.length} lines, canonical greedy = ${wantWide} (> ${wantSans} narrow)`);

  assert('F5-measureText-receives-row-family',
    sans.calls.length > 0 && sans.calls.every(o => o && o.family === SANS),
    sans.calls.length
      ? `${sans.calls.length} measureText call(s), families observed: ${[...new Set(sans.calls.map(o => o?.family ?? 'NONE'))].join(', ')}`
      : 'measureText never called');
}

/* -------------------------------------------------- F6: source has no stack */

console.log('\nF6 — source carries no font-stack literal');
{
  const strip = (src) => src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/[^\n]*/g, '$1');
  let src = '';
  try { src = readFileSync(join(ROOT, 'src', 'export/exportSvg.ts'), 'utf8'); } catch { /* missing */ }
  const hits = ['ui-monospace', 'Menlo', 'Consolas', 'monospace'].filter(t => strip(src).includes(t));
  assert('F6-source-no-font-stack-literal', src !== '' && hits.length === 0,
    src === '' ? 'src/export/exportSvg.ts unreadable' :
      hits.length ? `comment-stripped source still contains: ${hits.join(', ')}` : 'comment-stripped src/export/exportSvg.ts contains no font-stack literal (families come from the measurer only)');
}

/* ------------------------------------------------------------------ report */

const fails = results.filter(r => !r.pass);
console.log(`\n${results.length - fails.length}/${results.length} assertions PASS`);
if (fails.length) {
  console.log(`RED — failing rows:\n${fails.map(r => `  FAIL ${r.id}  —  ${r.detail}`).join('\n')}`);
  process.exit(1);
}
console.log('GREEN');
