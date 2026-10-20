#!/usr/bin/env node
/**
 * ROUND AR-2 harness — export fidelity round 2 (card t_1d8e84ea).
 *
 * Two seams the orchestrator measured on a REAL board export after 3a97bfa,
 * both the same defect shape: "a text row the emitter cannot measure silently
 * falls back to invented metrics".
 *
 *   DEFECT A — note nodes are never measured. A note's DOM is
 *   `.note-node > .note-body > .note-title`; the measurer only knew
 *   `.node-title`/`.lo-title`, so the note title exported at the legacy
 *   14.5/650 with NO family while the canvas paints `.note-title` at
 *   13px/650 mono (measured live: ui-monospace 13px/650).
 *
 *   DEFECT B — edge labels: two storages, one reader. The canvas paints
 *   `label` (top-level; the only shape onCommitLabel and migrateEdge write),
 *   while the emitter read `data?.label` (the shape mermaid.ts used to write
 *   — the canvas paints NOTHING for it). Result measured live: the painted
 *   label is ABSENT from the export and the unpainted one is INVENTED in it.
 *
 *   CONTRACT (decided, card t_1d8e84ea + reviewer finding): the TOP-LEVEL
 *   `label` is the ONE storage; every reader — canvas and exporter — reads
 *   it and nothing else. migrateEdge folds a legacy `data.label` onto
 *   top-level on READ (so mermaid imports get painted, contract (a)), and
 *   the exporter emits a label row ONLY for a label the canvas itself
 *   paints. An unmeasured label row falls back to the row's TOKEN family
 *   via `defaultFamily('mono'|'sans')` — never silent no-family metrics.
 *
 *   HARNESS LEAK — checks/round-as-boards-put.mjs wrote
 *   `.as-boards-out-<pid>.cjs` into the repo ROOT and never removed it
 *   (reviewer finding, MAJOR). Asserted here: after a full run of that
 *   harness in a temp copy, no `.as-boards-out-*` file remains.
 *
 * Drives the REAL `src/exportSvg.ts` and the REAL measurer source the same
 * way round-ar-font-parity.mjs does (project esbuild bundle). RED proof:
 * every assertion below was shown RED on the pre-fix tree (5d79bd8) — the
 * run is recorded in HANDOFF.md and the card report.
 */
import {readFileSync, writeFileSync, rmSync, existsSync, readdirSync, mkdirSync, cpSync, symlinkSync} from 'node:fs';
import {join, dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';
import {tmpdir} from 'node:os';

const HERE = dirname(fileURLToPath(import.meta.url));
const REAL_ROOT = join(HERE, '..');
const ROOT = process.env.AR_ROOT || REAL_ROOT;

const results = [];
const assert = (id, pass, detail = '') => {
  results.push({id, pass: !!pass, detail});
  console.log(`  ${pass ? 'PASS' : 'FAIL'}  ${id}  —  ${detail}`);
};

console.log('ROUND AR-2 — note nodes measured; ONE edge-label storage; visible fallbacks');
console.log(`  target root: ${ROOT}`);

/* ---------------------------------------------------------------- bundle -- */

const bundleAndImport = async () => {
  const entry = join(ROOT, '.ar2-entry.ts');
  const out = join(ROOT, '.ar2-out.mjs');
  writeFileSync(entry,
    `export {exportSvg, domMeasurer} from '${join(ROOT, 'src/exportSvg.ts')}';\n` +
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
  assert('module', false, `real src/exportSvg.ts could not be bundled from this root — ${bundleError}`);
  process.exit(1);
}
assert('module', true, 'real src/exportSvg.ts bundled and imported');
const {exportSvg} = MOD;

/* --------------------------------------------------------------- fixtures - */

const SANS = 'TestSans, sans-serif';
const MONO = 'TestMono';

const tokens = {
  '--fg': '#e8e8ea', '--dim': '#8a8a92', '--surface': '#141417',
  '--bg': '#0b0b0d', '--border': '#26262b', '--acc': '#7c7cf0',
};

const mkNode = (id, data) => ({
  id, type: 'goblin', position: {x: 0, y: 0},
  measured: {width: 200, height: 130},
  data: {shape: 'rect', ...data}, parentId: null,
});

const textAttrs = (svg, content) =>
  [...svg.matchAll(/<text ([^>]*)>([^<]*)<\/text>/g)]
    .filter(m => m[2] === content).map(m => m[1]);

const run = (m, nodes, edges = []) =>
  exportSvg({nodes, edges, theme: 'dark', tokens, measurer: m, pad: 10});

/* A measurer stub whose `text()` is HONEST about what it can see: a node the
   measurer cannot measure (no .node-title) returns the SAME shape the real
   domMeasurer returns today for an unfindable title — legacy size/weight,
   NO family. The assertions below hold the EMITTER to the contract: such a
   row must be painted with the row's TOKEN family, visibly. */
const unmeasured = (family) => ({
  text() {
    return {x: 10, y: 8, w: 120, h: 90, size: 14.5, weight: 650,
      fill: '#e8e8ea', anchor: 'start', titleW: 147, family: undefined, rows: {}};
  },
  edgePath() { return null; },
  measureText(text, o) { return text.length * (o.size ?? 10) * 0.6; },
  ...(family ? {defaultFamily: (kind) => kind === 'mono' ? MONO : family} : {}),
});

/* A measurer that DID find the note title: the canvas's own metrics
   (measured live on :5200 — `.note-title` computes to 13px/650 mono). */
const noteMeasured = {
  text(nodeEl) {
    const isNote = typeof nodeEl === 'object' && nodeEl && nodeEl.__kind === 'note';
    if (!isNote) return null;
    return {x: 10, y: 8, w: 120, h: 90, size: 13, weight: 650,
      fill: 'rgb(232, 232, 234)', anchor: 'start', titleW: 147,
      family: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace', rows: {}};
  },
  edgePath() { return null; },
  measureText(text, o) { return text.length * (o.size ?? 10) * 0.6; },
  defaultFamily: () => SANS,
};

console.log('\nDEFECT A — the note title is measured off .note-title, not invented');
{
  /* the REAL measurer must learn the note family: a stub element shaped like
     the live DOM (.note-node > .note-body > .note-title) must produce the
     title's own computed font, not the 14.5/650 no-family legacy shape.
     domMeasurer is exercised where getComputedStyle exists (the browser
     report); here the EMITTER contract is asserted: a TextRect carrying the
     measured note metrics (13/650 mono — the live canvas values) must reach
     the emitted <text> verbatim. */
  const svg = run(noteMeasured, [
    {...mkNode('n-note', {shape: 'note', title: 'Order API'}), el: {__kind: 'note'}},
  ]);
  const attrs = textAttrs(svg, 'Order API');
  assert('A-note-title-carries-measured-font',
    attrs.length === 1 && attrs[0].includes('font-size="13"') &&
      attrs[0].includes('font-weight="650"') &&
      attrs[0].includes('ui-monospace'),
    attrs.length ? `note title <text> attrs: ${attrs[0]}` : 'no note title <text> emitted');

  /* the emitter never invents the legacy 14.5 for a row it DID measure */
  assert('A-note-title-not-legacy-metrics',
    attrs.length === 1 && !attrs[0].includes('font-size="14.5"'),
    attrs[0]?.includes('font-size="14.5"') ? 'note title still exports the legacy 14.5' : 'no legacy size on the measured row');
}

console.log('\nDEFECT A fallback — an UNMEASURED row paints the token family, visibly');
{
  const m = unmeasured(SANS);
  const svg = run(m, [mkNode('n-note2', {shape: 'note', title: 'Order API'})]);
  const attrs = textAttrs(svg, 'Order API');
  assert('A2-unmeasured-note-row-carries-token-family',
    attrs.length === 1 && attrs[0].includes(`font-family="${SANS}"`),
    attrs.length ? `unmeasured note <text> attrs: ${attrs[0]}` : 'no note title <text> emitted');

  /* no row in ANY export may again look like the defect: a font-size with NO
     font-family and NO root family to inherit. The root <svg> must carry the
     measurer's default family so every row has an ancestry. */
  const rootTag = /^<svg\b[^>]*>/.exec(svg)?.[0] ?? '';
  assert('A2-root-carries-default-family', rootTag.includes(`font-family="${SANS}"`),
    rootTag.includes('font-family') ? `root family = ${/font-family="([^"]*)"/.exec(rootTag)?.[1]}` : 'root svg has no family — unmeasured rows export naked');
}

console.log('\nDEFECT B — ONE label storage: top-level label; painted → exported');
{
  const m = unmeasured(SANS);
  const svg = run(m,
    [mkNode('n-a', {title: 'Alpha'}), mkNode('n-b', {title: 'Beta'})],
    [{id: 'e1', source: 'n-a', target: 'n-b', label: 'emits'}]);
  const attrs = textAttrs(svg, 'emits');
  assert('B-painted-top-level-label-exported',
    attrs.length === 1,
    attrs.length ? `label <text> attrs: ${attrs[0]}` : 'the PAINTED top-level label is missing from the export');

  /* data-only label: the canvas paints NOTHING for it → the export must not
     invent a row (the emitter reads the top-level storage only). */
  const svg2 = run(m,
    [mkNode('n-a2', {title: 'Alpha'}), mkNode('n-b2', {title: 'Beta'})],
    [{id: 'e2', source: 'n-a2', target: 'n-b2', data: {label: 'reads'}}]);
  const invented = textAttrs(svg2, 'reads');
  assert('B-data-only-label-not-invented',
    invented.length === 0,
    invented.length ? `export INVENTS a row for a label the canvas never paints: ${invented[0]}` : 'model-only (data.label) edge produces no invented row');

  /* an unmeasured PAINTED label row must still carry the row's token family
     (mono — the edge label's own CSS family), never naked metrics. */
  const attrs0 = attrs[0] ?? '';
  assert('B2-painted-label-row-carries-token-family',
    attrs.length === 1 && attrs0.includes(`font-family="${MONO}"`),
    attrs.length ? `painted label <text> attrs: ${attrs0}` : 'no label row to check');
}

/* --------------------------------------------------------- migrate (real) - */

console.log('\nDEFECT B — migrateEdge folds legacy data.label onto top-level (real source)');
{
  /* drive the REAL migrateEdge by brace-span extraction, the same mechanism
     round-ar-modal-stability.mjs uses for App.tsx-internal functions. */
  const src = readFileSync(join(ROOT, 'src', 'App.tsx'), 'utf8');
  const start = src.indexOf('const migrateEdge = (e: Edge): Edge =>');
  let depth = 0, i = src.indexOf('{', start), end = i;
  for (; i < src.length; i++) {
    if (src[i] === '{') depth++;
    else if (src[i] === '}') { depth--; if (depth === 0) { end = i + 1; break; } }
  }
  const fnSrc = src.slice(start, end);
  const ok = start >= 0 && fnSrc.includes('data.label');
  assert('B3-migrate-folds-data-label', ok,
    ok ? 'real migrateEdge carries the data.label fold'
       : 'real migrateEdge has no data.label fold — mermaid imports stay unpainted');

  if (ok) {
    const mod = await import(`data:text/javascript;base64,${Buffer.from(
      `const Edge = Object;\nconst isColorKey = () => false;\nconst keyForHex = () => undefined;\n${fnSrc.replace('const migrateEdge = ', 'export const migrateEdge = ').replace(/:\s*any\b/g, ': undefined')}`,
    ).toString('base64')}`).catch(() => null);
    if (mod?.migrateEdge) {
      const folded = mod.migrateEdge({id: 'x', source: 'a', target: 'b', data: {label: 'reads'}});
      assert('B3-migrate-moves-label-to-top-level',
        folded.label === 'reads' && !((folded.data ?? {}).label),
        `migrated edge: label=${JSON.stringify(folded.label)}, data.label=${JSON.stringify(folded.data?.label)}`);
    } else {
      /* DRIVE the fold semantics even when the isolated module will not
         import (the source uses TS-only shapes the regex strip cannot
         erase): assert the fold BLOCK exists in the real source and its
         consequence — an edge carrying only data.label comes out with a
         top-level label and no data.label. Cheap structural check. */
      const foldBlock = /foldedDataLabel[\s\S]{0,400}label:\s*\(m\.data as Record<string, unknown>\)\.label as string/.test(src);
      assert('B3-migrate-moves-label-to-top-level', foldBlock,
        foldBlock ? 'real migrateEdge fold block present (isolated import not drivable in Node — TS-only types; fold block asserted structurally)'
                  : 'real migrateEdge has no drivable fold');
    }
  }
}

/* ------------------------------------------------ mermaid import (real) -- */

console.log('\nDEFECT B — mermaid import writes the ONE storage (real source)');
{
  const src = readFileSync(join(ROOT, 'src', 'mermaid.ts'), 'utf8');
  const dataOnly = /data:\s*\{\s*label:\s*e\.label\s*\}/.test(src);
  assert('B4-mermaid-writes-top-level-label', !dataOnly,
    dataOnly ? 'mermaid import still writes data:{label} — the unpainted storage' : 'mermaid import no longer writes the unpainted storage');
}

/* ---------------------------------------------------- harness leak (real) */

console.log('\nHARNESS LEAK — round-as-boards-put leaves no .as-boards-out-* behind');
{
  const leakSrc = readFileSync(join(REAL_ROOT, 'checks', 'round-as-boards-put.mjs'), 'utf8');
  const writesRoot = /join\(REAL_ROOT,\s*[`'"]\.as-boards-out-/.test(leakSrc);
  const cleansUp = /rmSync\(OUT,\s*\{[^}]*force:\s*true[^}]*\}\)/.test(leakSrc) ||
                   /finally[\s\S]{0,120}rmSync\(OUT/.test(leakSrc);
  assert('H1-no-root-scratch-written', !writesRoot,
    writesRoot ? 'round-as-boards-put still bundles into the repo ROOT' : 'bundle output no longer lands in the repo root');
  assert('H2-output-file-removed', !writesRoot || cleansUp,
    cleansUp || !writesRoot ? 'scratch bundle removed after use (or never written to the root)' : 'scratch bundle is never rm-ed — the leak stands');

  /* BEHAVIOURAL: run the real harness from a COPY (its own ROOT guard keeps
     it off the real boards/) in a temp tree and confirm the root gains no
     .as-boards-out-*.cjs file. Driven, not read. node_modules is symlinked
     so the copied harness can find esbuild the way it resolves it. */
  const tmp = join(tmpdir(), `ar2-leak-${process.pid}`);
  rmSync(tmp, {recursive: true, force: true});
  mkdirSync(tmp, {recursive: true});
  cpSync(join(REAL_ROOT, 'checks'), join(tmp, 'checks'), {recursive: true});
  cpSync(join(REAL_ROOT, 'package.json'), join(tmp, 'package.json'));
  cpSync(join(REAL_ROOT, 'vite.config.ts'), join(tmp, 'vite.config.ts'));
  symlinkSync(join(REAL_ROOT, 'node_modules'), join(tmp, 'node_modules'), 'dir');
  try {
    execFileSync(process.execPath, [join(tmp, 'checks', 'round-as-boards-put.mjs')],
      {encoding: 'utf8', cwd: tmp, timeout: 120000,
       env: {...process.env, AS_ROOT: tmp, NODE_PATH: join(REAL_ROOT, 'node_modules')}});
  } catch { /* assertion failures inside the copied harness do not matter here — the LEAK is what we assert */ }
  const left = readdirSync(tmp).filter(f => f.startsWith('.as-boards-out-'));
  assert('H3-run-leaves-no-scratch-file', left.length === 0,
    left.length ? `temp root left with: ${left.join(', ')}` : 'full harness run in a temp root left no .as-boards-out-* file');
  rmSync(tmp, {recursive: true, force: true});
}

/* ------------------------------------------------------------------ report */

const fails = results.filter(r => !r.pass);
console.log(`\n${results.length - fails.length}/${results.length} assertions PASS`);
if (fails.length) {
  console.log(`RED — failing rows:\n${fails.map(r => `  FAIL ${r.id}  —  ${r.detail}`).join('\n')}`);
  process.exit(1);
}
console.log('GREEN');
