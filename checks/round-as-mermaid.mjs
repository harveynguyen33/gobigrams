#!/usr/bin/env node
/**
 * ROUND AS harness — mermaid export/import round-trip (AS-1 §A, AS-2 §B/§C).
 *
 * DOM-free: no browser, no CDP, no mermaid parser import. `src/mermaid.ts` is
 * bundled with the PROJECT'S OWN esbuild and EXECUTED in Node (toMermaid /
 * fromMermaid are pure; precedent: checks/round-ad-flowchart.mjs,
 * checks/round-aa-align-marquee-palette.mjs). The mermaid@11 PARSE itself is
 * NOT proven here — the live mermaid.live paste is the reviewer's pass, as
 * stated in checks/round-ad-flowchart.mjs for its own scope.
 *
 * Negative control: AS_ROOT env var pointing at a checkout of the pre-fix
 * commit `26baec6` must be RED (the AR commits 7ff1a53…c03c16a and AR PASS 2
 * do not touch src/mermaid.ts, so any post-26baec6 pre-AS tree is equally
 * RED). RED, not a silent pass.
 *
 * COMMENTS ARE BLANKED BEFORE EVERY SOURCE COUNT (byte offsets preserved), as
 * in checks/round-ar-modal-stability.mjs — this repo's docblocks quote the
 * constructs they describe.
 */
import {readFileSync, writeFileSync, rmSync} from 'node:fs';
import {join, dirname} from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {execFileSync} from 'node:child_process';
import {tmpdir} from 'node:os';

const HERE = dirname(fileURLToPath(import.meta.url));
const REAL_ROOT = join(HERE, '..');
const ROOT = process.env.AS_ROOT || REAL_ROOT;
const SCRATCH = tmpdir();

const results = [];
const assert = (id, pass, detail = '') => {
  results.push({id, pass: !!pass, detail});
  console.log(`  ${pass ? 'PASS' : 'FAIL'}  ${id}  —  ${detail}`);
};

console.log('ROUND AS — mermaid round-trip (export form, import back-compat, guards)');
console.log(`  target root: ${ROOT}`);

/* ---------------------------------------------------------------- bundle -- */
const ENTRY = join(SCRATCH, `.as-mermaid-entry-${process.pid}.mjs`);
const OUT = join(SCRATCH, `.as-mermaid-out-${process.pid}.mjs`);
writeFileSync(ENTRY, `export {toMermaid, fromMermaid} from ${JSON.stringify(join(ROOT, 'src/mermaid.ts'))};\n`);
try {
  writeFileSync(OUT, execFileSync(join(REAL_ROOT, 'node_modules/.bin/esbuild'),
    [ENTRY, '--bundle', '--platform=node', '--format=esm', '--log-level=error',
      '--external:react', '--external:react-dom', '--external:react/jsx-runtime', '--external:@xyflow/react'],
    {encoding: 'utf8'}));
} catch (e) {
  console.error(`esbuild bundle failed: ${e.message}`);
  process.exit(2);
}
const {toMermaid, fromMermaid} = await import(`${pathToFileURL(OUT).href}?t=${Date.now()}`);
rmSync(ENTRY, {force: true});

/* ------------------------------------------------------------- fixture --- */
/* Eight shapes (AS-1 acceptance 3), a title with a double quote (esc →
   #quot; → back), a title+sub node (the ` — ` join), a labelled edge, and a
   subgraph with one child (the child path goes through the same emitNode). */
const boardNodes = [
  {id: 'n1', type: 'goblin', position: {x: 0, y: 0}, data: {shape: 'service', title: 'Service A', sub: 'handles requests'}},
  {id: 'n2', type: 'goblin', position: {x: 220, y: 0}, data: {shape: 'database', title: 'Postgres'}},
  {id: 'n3', type: 'goblin', position: {x: 440, y: 0}, data: {shape: 'decision', title: 'Valid?'}},
  {id: 'n4', type: 'goblin', position: {x: 0, y: 140}, data: {shape: 'actor', title: 'He says "hi"'}},
  {id: 'n5', type: 'goblin', position: {x: 220, y: 140}, data: {shape: 'external', title: 'Stripe API'}},
  {id: 'n6', type: 'goblin', position: {x: 440, y: 140}, data: {shape: 'note', title: 'a note'}},
  {id: 'n7', type: 'goblin', position: {x: 0, y: 280}, data: {shape: 'queue', title: 'ingest queue'}},
  {id: 'n8', type: 'goblin', position: {x: 220, y: 280}, data: {shape: 'gateway', title: 'API gateway'}},
  {id: 'n9', type: 'goblin', position: {x: 700, y: 0}, data: {shape: 'group', title: 'Cluster G'}},
  {id: 'n10', type: 'goblin', position: {x: 710, y: 60}, data: {shape: 'service', title: 'Inner service'}},
];
const boardEdges = [
  {id: 'e1', source: 'n1', target: 'n2', data: {label: 'reads'}},
];
const exported = toMermaid(boardNodes, boardEdges);
console.log('  exported:');
for (const l of exported.split('\n')) console.log(`    | ${l}`);

/* ===========================================================================
 * §A — AS-1: the export emits `id ("label")`, never `id: ("label")`.
 * =========================================================================== */
const bodyLines = exported.split('\n');

const colonLines = bodyLines.filter(l => /^\s*\w+: \(/.test(l) || /^\s*\w+: \[/.test(l) || /^\s*\w+: \{/.test(l));
assert('as1.a1.zero-colon-form-node-lines',
  colonLines.length === 0,
  `0 lines match /^\\s*\\w+: [{[(]/ in the export (found ${colonLines.length}: ${JSON.stringify(colonLines)})`);

/* non-edge, non-subgraph, non-`end` body lines. The empty-group placeholder
   `mX_empty[ ]` is a PRE-EXISTING, documented quirk (ROUND-AS-SPEC "Out of
   scope") — skipped here by name, not silently. */
const defLines = bodyLines.filter(l =>
  l && !/^flowchart/.test(l) && !/-->/.test(l) && !/^ {0,4}subgraph /.test(l)
  && l.trim() !== 'end' && !/^\s*m\d+_empty\b/.test(l));
const badDef = defLines.filter(l => !/^\s*m\d+\s*[([{]/.test(l));
assert('as1.a2.every-def-line-is-id-plus-shape-token',
  defLines.length >= 8 && badDef.length === 0,
  `${defLines.length} definition lines, all match /^\\s*m\\d+\\s*[([{]/ (offenders: ${JSON.stringify(badDef)})`);

/* the round-trip property: labels AND shapes survive, edges survive with
   their label, the subgraph child stays claimed by its group. */
const re = fromMermaid(exported);
assert('as1.a3.importer-reads-own-export',
  re !== null, 'fromMermaid(export) is not null');
if (re) {
  const misses = [];
  for (const n of boardNodes) {
    if (n.data.shape === 'group') continue;
    const want = [n.data.title, n.data.sub].filter(Boolean).join(' — ');
    const got = re.nodes.find(m => m.label === want);
    if (!got) { misses.push(`${n.data.title ?? n.id}: label "${want}" not found`); continue; }
    if (got.shape !== n.data.shape) misses.push(`${n.data.title}: shape ${got.shape} ≠ ${n.data.shape}`);
  }
  assert('as1.a3a.labels-and-shapes-survive',
    misses.length === 0,
    misses.length === 0
      ? `all ${boardNodes.length - 1} non-group nodes round-trip label AND shape (incl. #quot; escape and title+sub join)`
      : misses.join(' · '));
  const edge = re.edges.find(e => e.label === 'reads');
  assert('as1.a3b.labelled-edge-survives',
    re.edges.length === boardEdges.length && !!edge,
    `1 edge with label "reads" (got ${re.edges.length} edges)`);
  const groupEntry = Object.entries(re.groups).find(([, kids]) => kids.length >= 1);
  const inner = groupEntry && re.nodes.find(m => m.key === groupEntry[1][0]);
  assert('as1.a3c.subgraph-child-still-claimed-and-labelled',
    !!groupEntry && !!inner && inner.label === 'Inner service',
    groupEntry ? `group "${(re.nodes.find(m => m.key === groupEntry[0]) ?? {}).label}" claims [${groupEntry[1].join(', ')}], child label "${inner?.label}"`
               : 'no group claims a child');
}

/* ===========================================================================
 * §B — AS-2: the importer ALSO reads the old colon form (backward compat).
 * =========================================================================== */
const oldForm = fromMermaid('flowchart TD\n  m1: ("Service A")\n  m2: [("Postgres")]');
const b1 = oldForm && oldForm.nodes.find(n => n.key === 'm1');
const b2 = oldForm && oldForm.nodes.find(n => n.key === 'm2');
assert('as2.b1.colon-form-round-node',
  !!b1 && b1.label === 'Service A' && b1.shape === 'service',
  b1 ? `m1 label="${b1.label}" shape=${b1.shape}` : 'm1 not parsed');
assert('as2.b2.colon-form-database',
  !!b2 && b2.label === 'Postgres' && b2.shape === 'database',
  b2 ? `m2 label="${b2.label}" shape=${b2.shape}` : 'm2 not parsed');

/* colon form in an EDGE line (both endpoints carry their token) */
const oldEdge = fromMermaid('flowchart TD\n  m1: ("A") -->|sends| m2: ("B")');
const be = oldEdge && oldEdge.edges[0];
const ba = oldEdge && oldEdge.nodes.find(n => n.key === 'm1');
const bb = oldEdge && oldEdge.nodes.find(n => n.key === 'm2');
assert('as2.b3.colon-form-on-edge-line',
  !!be && be.label === 'sends' && ba?.label === 'A' && ba?.shape === 'service' && bb?.label === 'B',
  be ? `edge ${be.from}→${be.to} label=${JSON.stringify(be.label)}, m1="${ba?.label}"(${ba?.shape}), m2="${bb?.label}"` : 'edge not parsed');

/* colon form inside a subgraph: child claimed by the group AND labelled */
const oldSub = fromMermaid('flowchart TD\n  subgraph g1["Outer"]\n    m2: ("Inner")\n  end');
const oc = oldSub && oldSub.nodes.find(n => n.key === 'm2');
const og = oldSub && Object.entries(oldSub.groups).find(([, kids]) => kids.includes('m2'));
assert('as2.b4.colon-form-inside-subgraph',
  !!oc && oc.label === 'Inner' && oc.shape === 'service' && !!og,
  oc ? `m2 label="${oc.label}", claimed by group ${og ? og[0] : 'NONE'}` : 'm2 not parsed');

/* ===========================================================================
 * §C — AS-2 guards: the tolerance is JUNCTION-ONLY.
 * =========================================================================== */
/* a colon INSIDE a label must not be eaten */
const guard1 = fromMermaid('flowchart TD\n  m1("port: 8080")');
const g1 = guard1 && guard1.nodes.find(n => n.key === 'm1');
assert('as2.c1.colon-inside-label-survives',
  !!g1 && g1.label === 'port: 8080' && g1.shape === 'service',
  g1 ? `label="${g1.label}"` : 'm1 not parsed');

/* the new (colon-free) form still imports losslessly — pinned so it cannot
   regress, and so a colon in ANY label position is never scrubbed */
const newForm = fromMermaid(exported);
const g2 = newForm && newForm.nodes.find(n => n.label === 'Service A — handles requests');
assert('as2.c2.new-form-still-lossless',
  !!g2 && g2.shape === 'service',
  g2 ? `title+sub node label intact, shape=${g2.shape}` : 'round-trip node missing');

/* %% comment lines are skipped (untouched by the lexer widening) */
const commented = fromMermaid('flowchart TD\n  %% m9: ("not a node")\n  m1("Real")');
const cOnly = commented && commented.nodes.filter(n => n.key === 'm9');
assert('as2.c3.comment-lines-still-skipped',
  !!commented && (!cOnly || cOnly.length === 0) && !!commented.nodes.find(n => n.label === 'Real'),
  `%% line produced ${cOnly ? cOnly.length : 0} phantom node(s)`);

/* ------------------------------------------------------------------ done -- */
console.log(results.every(r => r.pass) ? '\nALL GREEN' : `\n${results.filter(r => !r.pass).length} FAILURE(S)`);
process.exit(results.every(r => r.pass) ? 0 : 1);
