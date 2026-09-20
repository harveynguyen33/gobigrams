#!/usr/bin/env node
/**
 * PACKAGE-TEMPLATES harness — Pass 1 (data model + the flowchart family + the
 * dialog's grouping).
 *
 * NO BROWSER, NO CDP, NO HEADLESS CHROME. Every number printed below is either
 *   (1) EXECUTED against the real `src/templateCatalog.ts` / `src/presets.ts` —
 *       bundled with the project's OWN esbuild and imported, so the catalog, the
 *       three new templates and `LAYOUTS['layered-tb']` are the shipped objects
 *       and not a transcription of them, or
 *   (2) a TEXT/structural read of `src/BoardDialog.tsx` / `src/styles.css` /
 *       `src/shapes.tsx` with comments blanked first, or
 *   (3) ARITHMETIC on the returned layout positions.
 * The live painted measurement (tab order, focus, paint) is the orchestrator's
 * browser pass — this file proves nothing about the DOM and says so.
 *
 * COMMENTS ARE BLANKED BEFORE EVERY TEXT COUNT (blanking keeps byte offsets, so
 * any reported line number stays true). This repo's docblocks quote the very
 * constructs they describe, and a raw count would read a correct tree as a defect.
 *
 * PRE-FIX REPLAY (bottom of this file): the same predicates are re-run over an
 * in-memory reconstruction of the PRE-CHANGE catalog, and each is asserted to be
 * RED. A control that only passes on the fixed tree measures nothing.
 */
import {readFileSync, writeFileSync, mkdtempSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';

const ROOT = process.env.DS_ROOT ?? '/home/harvey/projects/tech-goblin/lab/diagram-studio';
const ESBUILD = join(ROOT, 'node_modules/.bin/esbuild');

const STYLES_RAW = readFileSync(`${ROOT}/src/styles.css`, 'utf8');
const DIALOG_RAW = readFileSync(`${ROOT}/src/BoardDialog.tsx`, 'utf8');
const CATALOG_RAW = readFileSync(`${ROOT}/src/templateCatalog.ts`, 'utf8');
const SHAPES_RAW = readFileSync(`${ROOT}/src/shapes.tsx`, 'utf8');

const blank = m => m.replace(/[^\n]/g, ' ');
const stripTs = s => s
  .replace(/\/\*[\s\S]*?\*\//g, blank)
  .replace(/(^|[^:])\/\/[^\n]*/g, (m, p1) => p1 + ' '.repeat(m.length - p1.length));
const DIALOG = stripTs(DIALOG_RAW);

const results = [];
const assert = (id, pass, detail = '') => {
  results.push({id, pass: !!pass, detail});
  console.log(`  ${pass ? 'PASS' : 'FAIL'}  ${id}  —  ${detail}`);
};

/* ===========================================================================
   THE PRE-CHANGE FIXTURE — captured off the tree BEFORE this round's first edit
   (esbuild-bundled `src/presets.ts`, JSON.stringify of both arrays, sha256).
   Stored here only so the "approval is untouched" assertion has something to
   compare against that is NOT the post-change data agreeing with itself.
=========================================================================== */
const FIXTURE = {
  approvalNodesSha: '45a9f90152eba562c55aa5610614e953216da47d0cd3c0157a11ef78e9b34504',
  approvalEdgesSha: '5261502f16950508aa56bb5776edcaee1031df1f199aab5f3f36a018780e13e7',
  approvalNodesLen: 3360,
  approvalEdgesLen: 2716,
  approvalNodes: 14,
  approvalEdges: 10,
  hexLiterals: 142,
  shapeUnionIds: 25,
  templates: 4,
};

/* ===========================================================================
   1 — EXECUTE the real modules.
=========================================================================== */
const dir = mkdtempSync(join(tmpdir(), 'ds-pt-'));
const entry = join(dir, 'entry.ts');
writeFileSync(entry,
  `export {templateCatalog, TEMPLATE_LEVEL_ORDER} from ${JSON.stringify(join(ROOT, 'src/templateCatalog.ts'))};\n` +
  `export {PRESETS, FLOWCHART_PRESET, FLOWCHART_NODE_SIZE, TEMPLATE_LEVELS, LAYOUTS} from ${JSON.stringify(join(ROOT, 'src/presets.ts'))};\n`);
const out = join(dir, 'out.mjs');
writeFileSync(out, execFileSync(ESBUILD, [entry, '--bundle', '--platform=node', '--format=esm', '--log-level=error'], {encoding: 'utf8'}));
const M = await import(pathToFileURL(out).href);
const {PRESETS, FLOWCHART_PRESET, FLOWCHART_NODE_SIZE, TEMPLATE_LEVELS, LAYOUTS, templateCatalog, TEMPLATE_LEVEL_ORDER} = M;

const sha = s => createHash('sha256').update(s).digest('hex');
const catalog = templateCatalog();
const families = catalog.map(f => f.preset);
const allEntries = catalog.flatMap(f => f.groups.flatMap(g => g.entries));
const pairOf = e => `${e.preset}:${e.t.id}`;
const byPair = new Map(allEntries.map(e => [pairOf(e), e]));
const tpl = id => FLOWCHART_PRESET.templates.find(t => t.id === id);

/* The SHARED shape predicate, exactly as §6 AC 5/6/7 define it: `label` nodes
 *  (and `group` / `note` shapes) are canvas ANNOTATIONS, not flowchart shape ids. */
const isFlowShape = n => n.type !== 'label' && n.data?.shape !== 'group' && n.data?.shape !== 'note';
const shapeSet = t => new Set(t.nodes.filter(isFlowShape).map(n => n.data.shape));
const PALETTE_SHAPES = FLOWCHART_PRESET.palette.filter(p => p.shape !== 'group' && p.shape !== 'note').map(p => p.shape);
const PALETTE_AT = n => PALETTE_SHAPES.slice(0, n);

const fmt = s => `{${[...s].sort().join(', ')}}`;
const layerCount = pos => new Set([...pos.values()].map(p => p.y)).size;

console.log('PACKAGE-TEMPLATES — Pass 1 data + create-dialog grouping');
console.log('='.repeat(78));
console.log(`PRESETS key order            : [${Object.keys(PRESETS).join(', ')}]`);
console.log(`families in the catalog      : [${families.join(', ')}]  (${families.length} of ${Object.keys(PRESETS).length} presets)`);
console.log(`catalog entries              : ${allEntries.length}`);
for (const f of catalog) {
  console.log(`  ${f.preset.padEnd(12)} ${f.label}`);
  for (const g of f.groups) console.log(`      ${String(g.level).padEnd(9)} ${g.label.padEnd(34)} ${g.entries.map(e => e.t.id).join(', ')}`);
}
console.log(`palette flow shapes (16)     : [${PALETTE_SHAPES.join(', ')}]`);
console.log(`FLOWCHART_NODE_SIZE          : ${FLOWCHART_NODE_SIZE.width}x${FLOWCHART_NODE_SIZE.height}`);

/* ---------- AC 1 — level field + grouping order --------------------------- */
console.log('\n' + '='.repeat(78));
console.log('AC 1 — families in PRESETS key order; groups basic → advanced → complex → null-last');
console.log('='.repeat(78));

/* The ordering rule, as a PURE predicate over a catalog, so the pre-fix replay
 *  below can run the same code on a different catalog object. */
const LEVEL_ORDER = ['basic', 'advanced', 'complex'];
function ac1(predFamilies) {
  const expected = Object.keys(PRESETS).filter(id => (PRESETS[id].templates ?? []).length > 0);
  if (JSON.stringify(predFamilies.map(f => f.preset)) !== JSON.stringify(expected)) return {ok: false, why: `families [${predFamilies.map(f => f.preset)}] vs expected [${expected}]`};
  for (const f of predFamilies) {
    const lv = f.groups.map(g => g.level);
    const nulls = lv.filter(l => l === null).length;
    if (nulls > 1) return {ok: false, why: `${f.preset}: ${nulls} null groups`};
    if (nulls === 1 && lv[lv.length - 1] !== null) return {ok: false, why: `${f.preset}: the null group is not LAST (${lv.join(',')})`};
    const levelled = lv.filter(l => l !== null);
    const want = LEVEL_ORDER.filter(l => levelled.includes(l));
    if (JSON.stringify(levelled) !== JSON.stringify(want)) return {ok: false, why: `${f.preset}: levels ${levelled.join(',')} not in ${want.join(',')}`};
    for (const g of f.groups) {
      /* The sort key depends on WHICH group this is (verification of pass 1):
         a LEVELLED group sorts by (order ?? 0, then id); the UNLEVELLED tail
         sorts by (order ?? 0) ONLY, so its authored/declaration order survives
         (Array.sort is stable). The id tiebreak must NOT apply to the tail: no
         field asked for it, and applying it re-alphabetised the legacy rows into
         "C4 Container" before "C4 Context" — reversing the authored L1→L2 order. */
      const keys = g.level === null
        ? g.entries.map(e => `${String(e.t.order ?? 0).padStart(6, '0')}`)
        : g.entries.map(e => `${String(e.t.order ?? 0).padStart(6, '0')}:${e.t.id}`);
      const sorted = [...keys].sort();
      if (JSON.stringify(keys) !== JSON.stringify(sorted))
        return {ok: false, why: `${f.preset}/${g.level}: entries not sorted (${g.level === null ? 'order ?? 0 only — declaration order preserved' : 'order ?? 0, then id'})`};
      /* the label IS the level's own label, or the preset's for the null group */
      const wantLabel = g.level === null ? f.label : TEMPLATE_LEVELS[g.level].label;
      if (g.label !== wantLabel) return {ok: false, why: `${f.preset}/${g.level}: label "${g.label}" != "${wantLabel}"`};
      if (g.entries.some(e => e.level !== g.level)) return {ok: false, why: `${f.preset}/${g.level}: an entry disagrees with its group`};
    }
  }
  return {ok: true};
}
const a1 = ac1(catalog);
/* AC 1 is "the level field AND the grouping", so the ordering predicate alone is
   not enough: an all-null catalog satisfies it vacuously. The LIVENESS FLOOR is
   part of the criterion — every one of the three levels must actually produce a
   group SOMEWHERE, or "basic → advanced → complex → null-last" is a rule over
   nothing (this floor is also what makes the pre-fix replay red below). */
const levelledGroups = catalog.flatMap(f => f.groups).filter(g => g.level !== null);
const levelsPresent = [...new Set(levelledGroups.map(g => g.level))];
const floorOk = LEVEL_ORDER.every(l => levelsPresent.includes(l)) && levelledGroups.length >= 3;
console.log(`  levelled groups: ${levelledGroups.length} [${levelledGroups.map(g => `${g.entries[0].preset}/${g.level}`).join(', ')}]`);
assert('1.catalog-order-and-grouping',
  a1.ok && floorOk,
  a1.ok && floorOk
    ? `families [${families.join(', ')}] in PRESETS key order; per family the level order is ` +
      catalog.map(f => `${f.preset}:${f.groups.map(g => g.level ?? 'null').join('>')}`).join(' ') +
      `; every group's entries sort by (order ?? 0, id) and carry the level their header names; ` +
      `${levelledGroups.length} levelled groups cover all three levels, so the order is not a rule over nothing`
    : `${a1.ok ? a1.why : 'ordering predicate FAILED'} | floor: ${levelsPresent.length}/3 levels present`);

/* ---------- AC 2 — nothing lost, nothing invented -------------------------- */
console.log('\n' + '='.repeat(78));
console.log('AC 2 — the catalog is exactly the set of PRESETS templates');
console.log('='.repeat(78));
const declaredPairs = Object.values(PRESETS).flatMap(p => (p.templates ?? []).map(t => `${p.id}:${t.id}`));
const catalogPairs = allEntries.map(pairOf);
const missing = declaredPairs.filter(k => !catalogPairs.includes(k));
const invented = catalogPairs.filter(k => !declaredPairs.includes(k));
console.log(`  Σ PRESETS[id].templates.length = ${declaredPairs.length}   catalog entries = ${catalogPairs.length}`);
assert('2.entry-counts-match-and-no-pair-is-invented',
  declaredPairs.length === catalogPairs.length && missing.length === 0 && invented.length === 0 && new Set(catalogPairs).size === catalogPairs.length,
  `${catalogPairs.length} entries === ${declaredPairs.length} declared; missing=[${missing.join(', ')}] invented=[${invented.join(', ')}]; ` +
  `${new Set(catalogPairs).size} distinct (so the pair set cannot hide a duplicate)`);

/* ---------- AC 4 — the legacy templates are still reachable ---------------- */
console.log('\n' + '='.repeat(78));
console.log('AC 4 — the four legacy templates resolve the way App.tsx resolves them');
console.log('='.repeat(78));
/* The SAME lookup App.tsx performs: getPreset(pid).templates?.find(x => x.id === id) */
const appResolve = (preset, templateId) => (PRESETS[preset].templates ?? []).find(x => x.id === templateId);
const LEGACY = [['flowchart', 'approval'], ['c4', 'c4-context'], ['c4', 'c4-container'], ['erd', 'commerce']];
const legacyRows = LEGACY.map(([p, t]) => {
  const inCatalog = byPair.get(`${p}:${t}`);
  const resolved = appResolve(p, t);
  return {p, t, inCatalog: !!inCatalog, resolves: !!resolved, label: resolved?.label};
});
for (const r of legacyRows) console.log(`  ${`${r.p} / ${r.t}`.padEnd(26)} catalog=${r.inCatalog ? 'Y' : 'N'} App-resolves=${r.resolves ? 'Y' : 'N'}  "${r.label}"`);
assert('4.the-four-legacy-templates-are-in-the-catalog-and-still-resolve',
  legacyRows.every(r => r.inCatalog && r.resolves) && !!byPair.get('flowchart:approval'),
  `${legacyRows.filter(r => r.inCatalog && r.resolves).length}/4 resolve through the exact App lookup ` +
  `\`(PRESETS[pid].templates ?? []).find(x => x.id === templateId)\``);

/* ---------- AC 5/6/7/8 — the shape ladder --------------------------------- */
console.log('\n' + '='.repeat(78));
console.log('AC 5/6/7/8 — level → palette band, 5 / 10 / 16, strictly nested');
console.log('='.repeat(78));
const basic = tpl('flow-basic'), advanced = tpl('flow-advanced'), complex = tpl('flow-complex');
const present = [basic, advanced, complex].every(Boolean);
assert('5b.the-three-new-templates-exist-in-the-flowchart-family',
  present && byPair.has('flowchart:flow-basic') && byPair.has('flowchart:flow-advanced') && byPair.has('flowchart:flow-complex'),
  present ? `flow-basic / flow-advanced / flow-complex are all declared and all reachable in the catalog` : 'one or more of the three ids is missing');

const L1 = present ? shapeSet(basic) : new Set();
const L2 = present ? shapeSet(advanced) : new Set();
const L3 = present ? shapeSet(complex) : new Set();
const diff = (a, b) => [...a].filter(x => !b.has(x));
console.log(`  L1 (basic)    |${L1.size}| ${fmt(L1)}`);
console.log(`  L2 (advanced) |${L2.size}| ${fmt(L2)}`);
console.log(`  L3 (complex)  |${L3.size}| ${fmt(L3)}`);
console.log(`  palette 0..4  ${fmt(new Set(PALETTE_AT(5)))}`);
console.log(`  palette 0..9  ${fmt(new Set(PALETTE_AT(10)))}`);
console.log(`  palette 0..15 ${fmt(new Set(PALETTE_AT(16)))}`);

const eq = (a, b) => a.size === b.size && [...a].every(x => b.has(x));
assert('5.level-1-shape-set-is-the-first-5-palette-rows',
  eq(L1, new Set(PALETTE_AT(5))),
  L1.size === 5 && eq(L1, new Set(PALETTE_AT(5)))
    ? `flow-basic uses exactly the first 5 palette rows ${fmt(L1)} (5 of 16)`
    : `flow-basic -> ${fmt(L1)}; missing ${fmt(new Set(diff(new Set(PALETTE_AT(5)), L1)))} extra ${fmt(new Set(diff(L1, new Set(PALETTE_AT(5)))))}`);
assert('6.level-2-shape-set-is-the-first-10-palette-rows',
  eq(L2, new Set(PALETTE_AT(10))),
  L2.size === 10 && eq(L2, new Set(PALETTE_AT(10)))
    ? `flow-advanced uses exactly the first 10 palette rows (10 of 16)`
    : `flow-advanced -> ${fmt(L2)}; missing ${fmt(new Set(diff(new Set(PALETTE_AT(10)), L2)))} extra ${fmt(new Set(diff(L2, new Set(PALETTE_AT(10)))))}`);
assert('7.level-3-shape-set-is-ALL-16-flowchart-shape-ids',
  L3.size === 16 && eq(L3, new Set(PALETTE_AT(16))),
  L3.size === 16 && eq(L3, new Set(PALETTE_AT(16)))
    ? `flow-complex uses ALL 16 ISO 5807 ids — set difference against the palette is EMPTY`
    : `|L3| = ${L3.size}; missing ${fmt(new Set(diff(new Set(PALETTE_AT(16)), L3)))} (the unlevelled/unfiltered expression would count 'undefined' as a 17th shape)`);
assert('8.the-ladder-is-strictly-nested',
  diff(L1, L2).length === 0 && diff(L2, L3).length === 0 && L3.size === 16 && L2.size === 10 && L1.size === 5,
  `L1 ⊂ L2 ⊂ L3: |L1|=${L1.size} |L2|=${L2.size} |L3|=${L3.size}; L1−L2=${diff(L1, L2).length} L2−L3=${diff(L2, L3).length}`);

/* ---------- AC 9 — layout + the D3/D4 data invariants --------------------- */
console.log('\n' + '='.repeat(78));
console.log('AC 9 — every template lays out; nothing can move wrongly');
console.log('='.repeat(78));
const LAYOUT_SPEC = FLOWCHART_PRESET.layout;
const layoutRows = [basic, advanced, complex].filter(Boolean).map(t => {
  const pos = LAYOUTS['layered-tb'](t.nodes, t.edges, LAYOUT_SPEC);
  const coords = [...pos.values()].map(p => `${p.x},${p.y}`);
  return {
    id: t.id,
    nodes: t.nodes.length,
    placed: pos.size,
    distinctCoords: new Set(coords).size,
    layers: layerCount(pos),
    labels: t.nodes.filter(n => n.type === 'label').length,
    groups: t.nodes.filter(n => n.data?.shape === 'group').length,
    notes: t.nodes.filter(n => n.data?.shape === 'note').length,
    edgeLess: t.nodes.filter(n => !t.edges.some(e => e.source === n.id || e.target === n.id)).map(n => `${n.id}:${n.data.shape}`),
    yRange: coords.length ? `${Math.min(...[...pos.values()].map(p => p.y))}→${Math.max(...[...pos.values()].map(p => p.y))}` : '-',
    xCount: new Set([...pos.values()].map(p => p.x)).size,
  };
});
for (const r of layoutRows) {
  console.log(`  ${r.id.padEnd(14)} nodes=${r.nodes} placed=${r.placed} distinctCoords=${r.distinctCoords} layers=${r.layers} ` +
    `x-positions=${r.xCount} y ${r.yRange}  label=${r.labels} group=${r.groups} note=${r.notes}  edge-less=[${r.edgeLess.join(', ')}]`);
}
assert('9a.every-node-of-every-new-template-gets-a-position-and-no-two-share-one',
  layoutRows.length === 3 && layoutRows.every(r => r.placed === r.nodes && r.distinctCoords === r.nodes),
  layoutRows.map(r => `${r.id}: ${r.placed}/${r.nodes} placed, ${r.distinctCoords} distinct coords`).join('; ') +
  ' — a 24-flow-node graph with three back-edges is the case most likely to expose a layering bug');
assert('9b.flow-complex-produces-its-many-layers',
  (layoutRows.find(r => r.id === 'flow-complex')?.layers ?? 0) >= 18,
  `layers (distinct y): ` + layoutRows.map(r => `${r.id}=${r.layers}`).join(' ') + ' — the threshold is 18 for flow-complex');
assert('9c.D4-invariant-no-label-and-no-group-node-in-any-of-the-three',
  layoutRows.every(r => r.labels === 0 && r.groups === 0),
  layoutRows.map(r => `${r.id}: label=${r.labels} group=${r.groups}`).join('; ') +
  ' — an edge-less annotation is an ORPHAN to the engine and is parked in a trailing row AFTER the last layer, so a phase heading would be flung to the bottom of the board');
assert('9d.the-only-edge-less-node-is-the-single-note-at-advanced-and-complex',
  layoutRows.every(r => r.edgeLess.length === (r.notes ? 1 : 0) && r.edgeLess.every(x => x.endsWith(':note'))),
  layoutRows.map(r => `${r.id}: ${r.edgeLess.length} edge-less (${r.edgeLess.join(', ') || 'none'})`).join('; ') +
  ' — a footnote below the flow is where it belongs');

/* ---------- counts + sizes (the spec's target numbers) -------------------- */
console.log('\n' + '='.repeat(78));
console.log('TARGET COUNTS + node geometry');
console.log('='.repeat(78));
const EXPECT = {
  'flow-basic': {nodes: 10, edges: 11, shapes: 5},
  'flow-advanced': {nodes: 15, edges: 15, shapes: 10},
  'flow-complex': {nodes: 25, edges: 27, shapes: 16},
};
const countRows = Object.entries(EXPECT).map(([id, want]) => {
  const t = tpl(id);
  const sizes = t ? t.nodes.filter(n => n.data?.shape !== 'note').map(n => `${n.style?.width}x${n.style?.height}/${n.data.handles}`) : [];
  const badSize = sizes.filter(s => s !== `${FLOWCHART_NODE_SIZE.width}x${FLOWCHART_NODE_SIZE.height}/tb`);
  return {id, want, got: t ? {nodes: t.nodes.length, edges: t.edges.length, shapes: shapeSet(t).size} : null, badSize};
});
for (const r of countRows) console.log(`  ${r.id.padEnd(14)} nodes ${r.got ? r.got.nodes : '-'}/${r.want.nodes}  edges ${r.got ? r.got.edges : '-'}/${r.want.edges}  shapes ${r.got ? r.got.shapes : '-'}/${r.want.shapes}`);
const levels = [['flow-basic', 'basic'], ['flow-advanced', 'advanced'], ['flow-complex', 'complex'], ['approval', 'advanced']];
const badLevel = levels.filter(([id, lvl]) => tpl(id)?.level !== lvl);
assert('c1.node-edge-and-shape-counts-are-the-spec-numbers',
  countRows.every(r => r.got && r.got.nodes === r.want.nodes && r.got.edges === r.want.edges && r.got.shapes === r.want.shapes),
  countRows.map(r => `${r.id}: ${r.got ? `${r.got.nodes}n/${r.got.edges}e/${r.got.shapes}s` : 'MISSING'} (want ${r.want.nodes}/${r.want.edges}/${r.want.shapes})`).join('  '));
assert('c2.every-flow-node-carries-FLOWCHART_NODE_SIZE-and-tb-handles',
  countRows.every(r => r.badSize.length === 0),
  countRows.map(r => `${r.id}: ${r.badSize.length} off-size`).join('; ') +
  ` — seed-from-template and drag-from-panel agree on one ${FLOWCHART_NODE_SIZE.width}x${FLOWCHART_NODE_SIZE.height} default`);
assert('c3.the-levels-are-tagged-as-specified',
  badLevel.length === 0,
  levels.map(([id, lvl]) => `${id}=${tpl(id)?.level ?? 'none'}`).join(' ') + ' — §3.4 tags `approval` advanced and leaves the c4/erd templates unlevelled');
const unlevelled = allEntries.filter(e => e.level === null).map(pairOf);
assert('c4.the-three-single-member-families-stay-unlevelled',
  ['c4:c4-context', 'c4:c4-container', 'erd:commerce'].every(k => unlevelled.includes(k)) && unlevelled.length === 3,
  `unlevelled rows: [${unlevelled.join(', ')}] — a level chip in a one-member family would be noise`);

/* ---------- AC 10 — approval is untouched where it matters ---------------- */
console.log('\n' + '='.repeat(78));
console.log('AC 10 — the approval template is metadata-only changed');
console.log('='.repeat(78));
const appr = tpl('approval');
const aNj = JSON.stringify(appr.nodes), aEj = JSON.stringify(appr.edges);
const aHashes = {nodes: sha(aNj), edges: sha(aEj)};
console.log(`  approval nodes: ${appr.nodes.length} (pre-change ${FIXTURE.approvalNodes}), JSON ${aNj.length} chars (pre-change ${FIXTURE.approvalNodesLen})`);
console.log(`  approval edges: ${appr.edges.length} (pre-change ${FIXTURE.approvalEdges}), JSON ${aEj.length} chars (pre-change ${FIXTURE.approvalEdgesLen})`);
console.log(`  sha256 nodes ${aHashes.nodes}`);
console.log(`  sha256 edges ${aHashes.edges}`);
assert('10.approval-nodes-and-edges-are-byte-identical',
  aHashes.nodes === FIXTURE.approvalNodesSha && aHashes.edges === FIXTURE.approvalEdgesSha
    && appr.nodes.length === FIXTURE.approvalNodes && appr.edges.length === FIXTURE.approvalEdges,
  aHashes.nodes === FIXTURE.approvalNodesSha && aHashes.edges === FIXTURE.approvalEdgesSha
    ? `both arrays still hash to the PRE-CHANGE capture (nodes ${aHashes.nodes.slice(0, 12)}…, edges ${aHashes.edges.slice(0, 12)}…) — only \`level\` was added`
    : `nodes ${aHashes.nodes === FIXTURE.approvalNodesSha ? 'ok' : 'CHANGED'} edges ${aHashes.edges === FIXTURE.approvalEdgesSha ? 'ok' : 'CHANGED'}`);

/* ---------- AC 11 — the three new templates are generic ------------------- */
console.log('\n' + '='.repeat(78));
console.log('AC 11 — no person, company, brand, email or URL in the new templates');
console.log('='.repeat(78));
const BRANDS = ['ikea', 'argos', 'amazon', 'walmart', 'wayfair', 'home depot', 'lowes', "lowe's", 'google', 'apple', 'microsoft', 'facebook', 'gmail', 'outlook', 'goblin', 'harvey', 'hermes'];
const stringsOf = t => [
  t.label ?? '', t.hint ?? '',
  ...t.nodes.flatMap(n => [n.data?.title ?? '', n.data?.sub ?? '', n.data?.text ?? '', n.data?.kicker ?? '']),
  ...t.edges.map(e => (typeof e.label === 'string' ? e.label : '')),
].map(s => String(s)).filter(s => s.length);
const scanRows = [basic, advanced, complex].filter(Boolean).map(t => {
  const strs = stringsOf(t).map(String);
  const hits = [];
  for (const s of strs) {
    if (/@[a-z0-9.-]+\./i.test(s)) hits.push(`email-ish "${s}"`);
    if (/https?:|www\./i.test(s)) hits.push(`url-ish "${s}"`);
    for (const b of BRANDS) if (s.toLowerCase().includes(b)) hits.push(`brand "${b}" in "${s}"`);
  }
  return {id: t.id, strings: strs.length, longest: Math.max(...strs.map(s => s.length)), hits};
});
for (const r of scanRows) console.log(`  ${r.id.padEnd(14)} ${r.strings} strings scanned, longest ${r.longest} chars, hits ${r.hits.length}`);
assert('11.the-new-templates-carry-no-identifying-string',
  scanRows.every(r => r.hits.length === 0),
  scanRows.every(r => r.hits.length === 0)
    ? `${scanRows.reduce((n, r) => n + r.strings, 0)} strings scanned across the three templates: no email, no URL, no brand/person word — an online order reads the same to every user`
    : scanRows.flatMap(r => r.hits).join('; '));

/* ---------- AC 12 — tokens only ------------------------------------------- */
console.log('\n' + '='.repeat(78));
console.log('AC 12 — no new colour');
console.log('='.repeat(78));
const HEX = (STYLES_RAW.match(/#[0-9a-fA-F]{3,8}\b/g) ?? []).length;
const hexHits = [['src/templateCatalog.ts', CATALOG_RAW], ['src/BoardDialog.tsx', DIALOG_RAW]]
  .map(([name, src]) => ({name, n: (src.match(/#[0-9a-fA-F]{3,8}\b/g) ?? []).length, rgba: (src.match(/rgba?\(/g) ?? []).length}))
  .filter(r => r.n || r.rgba);
const bdHdBlock = (STYLES_RAW.match(/(?:^|\n)\.bd-hd[^{]*\{[^}]*\}/g) ?? []).join('\n');
const bdHdHex = (bdHdBlock.match(/#[0-9a-fA-F]{3,8}\b/g) ?? []).length;
console.log(`  hex literals in src/styles.css: ${HEX} (pre-change ${FIXTURE.hexLiterals}, ceiling 160)`);
console.log(`  .bd-hd rule(s): ${bdHdBlock ? `${bdHdBlock.split('\n').length} block(s), ${bdHdHex} hex literal(s)` : 'ABSENT'}`);
assert('12a.the-hex-count-is-unchanged',
  HEX === FIXTURE.hexLiterals && HEX <= 160,
  `${HEX} hex literals in src/styles.css, identical to the pre-change ${FIXTURE.hexLiterals} — this round adds a level header and grouping, ZERO colour`);
assert('12b.no-colour-literal-in-the-new-module-or-the-dialog',
  hexHits.length === 0,
  hexHits.length === 0
    ? 'src/templateCatalog.ts and src/BoardDialog.tsx contain no #hex and no rgb()/rgba() literal; the .bd-hd rule is built from --surface / --dim only'
    : hexHits.map(r => `${r.name}: ${r.n} hex, ${r.rgba} rgb()`).join('; '));
assert('12c.the-group-header-reuses-existing-tokens',
  bdHdBlock.length > 0 && bdHdHex === 0 && /var\(--dim\)/.test(bdHdBlock) && /var\(--surface\)/.test(bdHdBlock),
  bdHdBlock.length > 0
    ? '.bd-hd uses var(--surface) and var(--dim) — the .bd-label caption grammar, no new colour and no new widget'
    : '.bd-hd is not declared in src/styles.css');

/* ---------- AC 13 — the Shape union does not move -------------------------- */
console.log('\n' + '='.repeat(78));
console.log('AC 13 — no new shape id');
console.log('='.repeat(78));
const SHAPES = stripTs(SHAPES_RAW);
const UNION_BLOCK = SHAPES.slice(SHAPES.indexOf('export type Shape'), SHAPES.indexOf('export const SHAPES'));
const unionIds = [...UNION_BLOCK.matchAll(/'([a-z]+)'/g)].map(m => m[1]);
console.log(`  Shape union: ${unionIds.length} ids (pre-change ${FIXTURE.shapeUnionIds})`);
console.log(`  [${unionIds.join(', ')}]`);
assert('13.the-Shape-union-is-unchanged',
  unionIds.length === FIXTURE.shapeUnionIds && new Set(unionIds).size === unionIds.length,
  `${unionIds.length} ids — identical to the pre-change count. NOTE: the brief and spec §1.2 say "19 ids"; the REAL ` +
  `shipped union is ${unionIds.length} (9 architecture + 10 ISO 5807 + the 6 ROUND AD additions), so 19 is a stale ` +
  'number in the spec, not a regression here. This round adds no shape either way.');

/* ---------- AC 3 / 16 — BoardDialog source contract ----------------------- */
console.log('\n' + '='.repeat(78));
console.log('AC 3 / 16 — the dialog still builds its list from PRESETS, and the keyboard contract holds');
console.log('='.repeat(78));
const loopMatch = /const TEMPLATES[\s\S]*?\n\}\n/.exec(DIALOG_RAW);
console.log(`  /const TEMPLATES[\\s\\S]*?\\n}\\n/ lifts a block: ${!!loopMatch}${loopMatch ? ` (${loopMatch[0].split('\n').length} lines)` : ''}`);
assert('3a.the-two-flattening-loops-and-the-liftable-TEMPLATES-block-survive',
  /for \(const id of Object\.keys\(PRESETS\) as PresetId\[\]\)/.test(DIALOG_RAW)
    && /for \(const t of PRESETS\[id\]\.templates \?\? \[\]\)/.test(DIALOG_RAW)
    && !!loopMatch,
  'both `for` loops and the `const TEMPLATES` block are still literally present, so package-o-board-dialog.harness.mjs can still lift and execute them');
if (loopMatch) {
  const loopEntry = join(dir, 'loop-entry.ts');
  writeFileSync(loopEntry, `import {PRESETS} from ${JSON.stringify(join(ROOT, 'src/presets.ts'))};\n${loopMatch[0]}\nexport {TEMPLATES};\n`);
  const loopJs = join(dir, 'loop.mjs');
  writeFileSync(loopJs, execFileSync(ESBUILD, [loopEntry, '--bundle', '--platform=node', '--format=esm', '--log-level=error'], {encoding: 'utf8'}));
  const lifted = (await import(pathToFileURL(loopJs).href)).TEMPLATES;
  console.log(`  the lifted block builds ${lifted.length} rows: [${lifted.map(t => `${t.preset}:${t.t.id}`).join(', ')}]`);
  assert('3b.the-lifted-block-builds-every-template',
    lifted.length === declaredPairs.length && lifted.map(t => `${t.preset}:${t.t.id}`).join(',') === declaredPairs.join(','),
    `${lifted.length} rows from the executed builder === ${declaredPairs.length} declared, in the same order`);
}
const radioGroups = (DIALOG.match(/role="radiogroup"/g) ?? []).length;
const rovingTabbable = /tabIndex=\{\(on \|\| \(!hasPick && i === 0\)\) \? 0 : -1\}/.test(DIALOG_RAW)
  && /const hasPick = opts\.includes\(pick\)/.test(DIALOG_RAW);
console.log(`  role="radiogroup" occurrences: ${radioGroups}; roving tabindex expression present: ${rovingTabbable}`);
assert('16a.one-radiogroup-and-one-roving-tab-stop',
  radioGroups === 1 && rovingTabbable && /const opts = useMemo\(\(\) => rows\.filter\(r => r\.kind === 'opt'\)\.map\(r => r\.key\), \[rows\]\)/.test(DIALOG_RAW),
  'exactly ONE radiogroup; the roving rule is still `tabIndex={(on || (!hasPick && i === 0)) ? 0 : -1}` — where ' +
  "`hasPick = opts.includes(pick)`, so an `initialPick` naming a row that no longer exists leaves the FIRST row as the single tab stop instead of the group losing one — " +
  "and the walk indexes `opts`, which is DERIVED from `rows` by filtering to `kind === 'opt'`, so a header row is not in the array and cannot become a tab stop or an arrow-key target");
assert('16b.header-rows-are-not-focusable-and-not-radios',
  /row\.kind === 'header'/.test(DIALOG_RAW)
    && /<div key=\{row\.key\} className="bd-hd" aria-hidden="true">\{row\.label\}<\/div>/.test(DIALOG_RAW)
    && !/className="bd-hd"[^>]*tabIndex/.test(DIALOG_RAW)
    && !/className="bd-hd"[^>]*role="radio"/.test(DIALOG_RAW),
  'the header renders as a plain `div.bd-hd` — no `tabIndex`, no `role="radio"` — and it is never pushed into `opts`');
assert('16c.the-start-empty-row-stays-first-and-escape-focus-restore-are-untouched',
  /const rows: Row\[\] = \[\{kind: 'opt', key: EMPTY, entry: null\}\]/.test(DIALOG_RAW)
    && /if \(e\.key === 'Escape'\)/.test(DIALOG_RAW)
    && /returnFocusTo\?\.current\?\.focus\(\)/.test(DIALOG_RAW)
    && /case 'End': e\.preventDefault\(\); pickAt\(last\); break;/.test(DIALOG_RAW),
  '"start empty" is still pushed first, Escape still cancels, Arrow/Home/End still move the choice AND the focus (`pickAt` focuses the picked row), and the returnFocusTo contract is intact. ' +
  'The DOM-level half of AC 16 (real tab order, real focus, real paint) needs a browser and is reported as UNVERIFIED by this file.');

/* ---------- AC 20 — docs/state honesty ------------------------------------ */
console.log('\n' + '='.repeat(78));
console.log('AC 20 — the measured numbers, so a reader sees data not a claim');
console.log('='.repeat(78));
for (const t of [basic, advanced, complex].filter(Boolean)) {
  const pos = LAYOUTS['layered-tb'](t.nodes, t.edges, LAYOUT_SPEC);
  console.log(`  ${t.id.padEnd(14)} level=${String(t.level).padEnd(9)} label="${t.label}"`);
  console.log(`  ${' '.repeat(14)} hint="${t.hint}"`);
  console.log(`  ${' '.repeat(14)} nodes=${t.nodes.length} edges=${t.edges.length} distinct flow shapes=${shapeSet(t).size} back-edges=${t.edges.filter(e => pos.get(e.source)?.y > pos.get(e.target)?.y).length}`);
  console.log(`  ${' '.repeat(14)} shape set = ${[...shapeSet(t)].sort().join(', ')}`);
}
console.log(`  ${'approval'.padEnd(14)} level=${String(appr?.level).padEnd(9)} label="${appr?.label}" (metadata-only change; arrays byte-identical)`);
assert('20.the-three-templates-print-their-measured-numbers',
  present && [basic, advanced, complex].every(t => t && t.nodes.length && t.edges.length && shapeSet(t).size),
  present
    ? `the three templates print nodes / edges / distinct shape count / level above; approval's level is reported too`
    : 'one or more of the three ids is MISSING from the flowchart family — the numbers above are empty');

/* ---------- AC 21 — D6, the per-symbol node-text grammar (§4.0) ------------ */
console.log('\n' + '='.repeat(78));
console.log('AC 21 — D6: every node text obeys the grammar of its OWN symbol (§4.0)');
console.log('='.repeat(78));
/* The four content kinds of §4.0. The mapping is per-SYMBOL, not per-template, so
 *  the SAME predicate reads all three levels — a user who learns it at Basic can
 *  read Complex. Every text is read from the BUNDLED module, never transcribed. */
const KIND_OF = {
  action:   ['process', 'preparation', 'manual', 'subprocess'],
  question: ['decision'],
  data:     ['io', 'manualinput', 'display', 'storeddata', 'internalstorage', 'document'],
  marker:   ['connector', 'offpage', 'looplimit', 'terminator', 'delay'],
};
/* The small imperative denylist the §4.0 violations actually used: `Check`,
 *  `Follow`, `Write` on DATA symbols, plus `Wait` on a MARKER (`delay`) — a
 *  `delay` node opening with `Wait…` is the exact defect the marker rule forbids. */
const IMPERATIVES = ['Check', 'Follow', 'Write', 'Read', 'Fit', 'Push', 'Wait'];
const isQuestion = s => String(s).trim().endsWith('?');
const firstWord = s => String(s).trim().split(/\s+/)[0] ?? '';
/** null = the text obeys its symbol's grammar; otherwise a one-line reason. */
function grammarViolation(shape, text) {
  const t = String(text ?? '').trim();
  if (!t) return 'empty text';
  if (KIND_OF.question.includes(shape)) return isQuestion(t) ? null : 'a QUESTION must end with "?"';
  if (KIND_OF.action.includes(shape)) return isQuestion(t) ? 'an ACTION must not end with "?"' : null;
  if (KIND_OF.data.includes(shape)) {
    if (isQuestion(t)) return 'a DATA text must not end with "?"';
    const w = firstWord(t);
    return IMPERATIVES.includes(w) ? `a DATA text must not open with the imperative ${JSON.stringify(w)}` : null;
  }
  if (KIND_OF.marker.includes(shape)) {
    const w = firstWord(t);
    return IMPERATIVES.includes(w) ? `a MARKER text must not open with the imperative ${JSON.stringify(w)}` : null;
  }
  return null; /* `note` is an annotation, not a flowchart symbol — excluded (§4.0) */
}
const KINDED_SHAPES = new Set([...KIND_OF.action, ...KIND_OF.question, ...KIND_OF.data, ...KIND_OF.marker]);
/* The union MUST be the 16 palette shapes: a shape the mapping forgets would
 *  escape the probe entirely, which is how a grammar rule rots silently. */
const uncoveredShapes = PALETTE_SHAPES.filter(s => !KINDED_SHAPES.has(s));
console.log(`  kind mapping covers ${KINDED_SHAPES.size}/16 palette shapes; uncovered = [${uncoveredShapes.join(', ')}]`);
const grammarRows = [basic, advanced, complex].filter(Boolean).map(t => {
  const flow = t.nodes.filter(n => n.type !== 'label' && n.data?.shape !== 'note' && n.data?.shape !== 'group');
  const byKind = {action: 0, question: 0, data: 0, marker: 0};
  for (const n of flow) for (const [k, list] of Object.entries(KIND_OF)) if (list.includes(n.data.shape)) byKind[k]++;
  const bad = flow
    .map(n => ({template: t.id, id: n.id, shape: n.data.shape, text: String(n.data?.title ?? '')}))
    .filter(o => grammarViolation(o.shape, o.text) !== null)
    .map(o => ({...o, why: grammarViolation(o.shape, o.text)}));
  return {id: t.id, flow: flow.length, byKind, bad, excluded: t.nodes.length - flow.length};
});
for (const r of grammarRows) {
  console.log(`  ${r.id.padEnd(14)} ${r.flow} flow nodes  ACTION=${r.byKind.action} QUESTION=${r.byKind.question} ` +
    `DATA=${r.byKind.data} MARKER=${r.byKind.marker}  excluded(annotation)=${r.excluded}  offenders=${r.bad.length}`);
}
for (const r of grammarRows) {
  for (const o of r.bad) {
    console.log(`      OFFENDER  {template: ${o.template}, id: ${o.id}, shape: ${o.shape}, text: ${JSON.stringify(o.text)}} — ${o.why}`);
  }
}
assert('21.every-node-text-obeys-its-symbols-grammar',
  grammarRows.length === 3 && uncoveredShapes.length === 0 && grammarRows.every(r => r.bad.length === 0),
  uncoveredShapes.length
    ? `the §4.0 kind mapping leaves ${uncoveredShapes.length} palette shape(s) uncovered (${uncoveredShapes.join(', ')}) — a node of that shape would escape the probe`
    : grammarRows.every(r => r.bad.length === 0)
      ? `all ${grammarRows.reduce((n, r) => n + r.flow, 0)} flow nodes across the three templates obey §4.0: every decision ends in "?", no ACTION ends in "?", and no DATA/MARKER text opens with one of the ${IMPERATIVES.length} measured action verbs (${IMPERATIVES.join(', ')})`
      : `${grammarRows.reduce((n, r) => n + r.bad.length, 0)} offender(s) printed above as {template, id, shape, text}`);

/* ---------- AC 22 — every edge label fits the preset's own maxLabelChars ---- */
console.log('\n' + '='.repeat(78));
console.log('AC 22 — every edge label respects FLOWCHART_PRESET.guidance.maxLabelChars');
console.log('='.repeat(78));
/* The limit is READ from the preset, never typed here: if the preset's guidance
   changes, this assertion follows it. Harvey's call (2026-09-20) shortened two
   labels the round-1 coder had correctly flagged rather than silently trimming:
   'repack' (was 33 chars) and 'wrong item' (was 37). */
const MAXLABEL = FLOWCHART_PRESET.guidance?.maxLabelChars ?? Infinity;
const labelRows = [basic, advanced, complex].filter(Boolean).map(t => ({
  template: t.id,
  bad: (t.edges ?? []).filter(e => e.label && String(e.label).length > MAXLABEL)
    .map(e => ({id: e.id, label: e.label, len: String(e.label).length})),
  longest: (t.edges ?? []).filter(e => e.label)
    .reduce((m, e) => Math.max(m, String(e.label).length), 0),
}));
for (const r of labelRows) {
  console.log(`  ${r.template.padEnd(14)} longest labelled edge = ${r.longest} chars (limit ${MAXLABEL})`);
  for (const b of r.bad) console.log(`      OVER  {template: ${r.template}, edge: ${b.id}, label: ${JSON.stringify(b.label)}, length: ${b.len}}`);
}
assert('22.every-edge-label-within-the-presets-own-limit',
  labelRows.length === 3 && labelRows.every(r => r.bad.length === 0),
  labelRows.length === 3 && labelRows.every(r => r.bad.length === 0)
    ? `all labelled edges across the three templates are <= ${MAXLABEL} chars (longest: ${Math.max(...labelRows.map(r => r.longest))}) — the limit is read from the preset's own guidance`
    : `${labelRows.reduce((n, r) => n + r.bad.length, 0)} label(s) exceed the preset's maxLabelChars (${MAXLABEL}); offenders printed above`);

/* ===========================================================================
   PRE-FIX REPLAY — each new assertion red before the change
   ===========================================================================
   The pre-change catalog is reconstructed IN MEMORY from the live one (no file
   is written, no git operation): the three new templates are removed, `approval`
   loses its level, and the three new TEMPLATES are removed from the preset copy
   the shape/layout probes run over. The SAME predicates are then re-run. A
   control that also passes on the pre-fix tree would prove the assertion catches
   nothing.

   The reconstruction is built from a SEPARATE deep copy, and every probe below
   reads ONLY from that copy — so the replay cannot silently measure the live
   tree again (the trap the first draft of this file fell into: it re-derived the
   pre-fix counts from the live catalog and reported "4 (now 4)").
=========================================================================== */
console.log('\n' + '='.repeat(78));
console.log('PRE-FIX REPLAY — the probes must be RED on the pre-change catalog');
console.log('='.repeat(78));

const preFlowTemplates = [flowchartApprovalTemplateLike()];
function flowchartApprovalTemplateLike() {
  /* the pre-change `approval`: same arrays, no `level` */
  const {level, ...rest} = tpl('approval');
  return rest;
}
const prePresets = JSON.parse(JSON.stringify({
  flowchart: {...FLOWCHART_PRESET, templates: preFlowTemplates},
  c4: PRESETS.c4,
  erd: PRESETS.erd,
}));
/* the pre-change PRESETS had exactly these families, in key order */
const PRE_KEYS = Object.keys(PRESETS).filter(id => (prePresets[id]?.templates ?? []).length > 0);

/** A pre-change catalog builder: the SAME two loops, over the pre-change data. */
function preCatalogBuild() {
  const fams = [];
  for (const id of PRE_KEYS) {
    const preset = prePresets[id];
    const entries = (preset.templates ?? []).map(t => ({preset: id, presetLabel: preset.label, presetHint: preset.hint, t, level: t.level ?? null}));
    const groups = [];
    for (const level of LEVEL_ORDER) {
      const list = entries.filter(e => e.level === level).sort((a, b) => (a.t.order ?? 0) - (b.t.order ?? 0));
      if (list.length) groups.push({level, label: level, entries: list});
    }
    const un = entries.filter(e => e.level === null);
    if (un.length) groups.push({level: null, label: preset.label, entries: un});
    fams.push({preset: id, label: preset.label, hint: preset.hint, groups});
  }
  return fams;
}
const preCatalog = preCatalogBuild();
const preEntries = preCatalog.flatMap(f => f.groups.flatMap(g => g.entries));
const prePairs = preEntries.map(pairOf);
const preDeclaredPairs = PRE_KEYS.flatMap(id => (prePresets[id].templates ?? []).map(t => `${id}:${t.id}`));
const preLevelledGroups = preCatalog.flatMap(f => f.groups).filter(g => g.level !== null);
const preLevelsPresent = [...new Set(preLevelledGroups.map(g => g.level))];
const preFloorOk = LEVEL_ORDER.every(l => preLevelsPresent.includes(l)) && preLevelledGroups.length >= 3;
const preA1 = ac1(preCatalog).ok && preFloorOk;
const preA2 = preEntries.length === preDeclaredPairs.length && preEntries.length === 4;
const preNewIds = ['flow-basic', 'flow-advanced', 'flow-complex'].filter(id => prePairs.includes(`flowchart:${id}`));
const preBasic = prePresets.flowchart.templates.find(t => t.id === 'flow-basic');
const preBasicShapes = preBasic ? shapeSet(preBasic).size : 0;
const preApprovalLevel = preFlowTemplates[0].level;

console.log(`  pre-change families          : [${PRE_KEYS.join(', ')}]`);
console.log(`  pre-change entries           : ${preEntries.length} (live: ${allEntries.length}; declared then: ${preDeclaredPairs.length})`);
console.log(`  pre-change AC1 grouping ok   : ${preA1}`);
console.log(`  pre-change AC2 count ok      : ${preA2}`);
console.log(`  pre-change new template ids  : ${preNewIds.length}/3 present`);
console.log(`  pre-change levelled rows     : ${preEntries.filter(e => e.level !== null).length} (live: ${allEntries.filter(e => e.level !== null).length})`);
console.log(`  pre-change approval.level    : ${String(preApprovalLevel)}`);
console.log(`  pre-change flow-basic shapes : ${preBasicShapes}`);

assert('pre1.REPLAY-AC1-and-AC2-were-RED',
  preA1 === false && preA2 === true && preEntries.length === 4,
  preA1 === false
    ? `AC1 failed: the pre-change tree had ZERO levelled groups (${preLevelsPresent.length}/3 levels present), so "basic → advanced → complex → null-last" was a rule over nothing. ` +
      `AC2 correctly still read ${preEntries.length} === ${preDeclaredPairs.length} on the PRE-change data, which is why AC1 carries the liveness floor.`
    : `AC1=${preA1} on the pre-change catalog — the grouping assertion catches nothing`);
assert('pre2.REPLAY-AC4-and-the-level-tag-were-RED',
  preNewIds.length === 0 && preApprovalLevel === undefined,
  `none of flow-basic / flow-advanced / flow-complex existed (${preNewIds.length}/3) and approval carried no level — so the 5/10/16 ladder, the nesting probe, the layout probe and the level assertions all had nothing to measure. flow-basic's shape count on the pre-change tree: ${preBasicShapes}.`);
assert('pre3.REPLAY-does-not-disturb-the-live-tree',
  allEntries.length === declaredPairs.length
    && !!complex && eq(shapeSet(complex), new Set(PALETTE_AT(16)))
    && tpl('approval')?.level === 'advanced',
  `after the replay the LIVE catalog still reports ${allEntries.length} entries, |L3|=${complex ? L3.size : 'n/a'}, approval.level=${tpl('approval')?.level ?? 'none'} — the replay mutated a deep copy in memory only`);

/* AC 21's control. The D6 grammar probe is only worth running if it is RED on
   content that violates it. §4.0's table lists FIVE held violations, but only
   TWO of them are IMPERATIVE-OPENER defects — `Follow` on a `document`,
   `Write` on a `manualinput` — which is the only shape of defect AC 21's
   wording predicate tests. The other three are symbol-choice defects that
   §4.0 itself describes as NOT wording problems: the `io` text opens with
   `Count` (not in the spec's denylist), the `looplimit` text restates the loop,
   and the `storeddata` text DESCRIBES the store instead of naming it. So the
   control asserts two things and states the boundary rather than over-claiming:
     pre4 — every violation AC 21's predicate CAN catch is RED, and its §4.0
            correction is green; plus the MARKER half of the rule (`Wait` on a
            `delay`) is RED, which is the rule's other stated case.
     pre5 — the boundary, recorded: the three non-imperative §4.0 violations are
            NOT caught by a first-word wording predicate, by §4.0's own account.
   The pairs are quoted from §4.0's table; nothing is transcribed from the tree. */
const D6_WORDING_VIOLATIONS = [
  {shape: 'document', held: 'Follow the printed step sheet', fixed: 'Order confirmation', why: 'an ACTION in a DOCUMENT symbol'},
  {shape: 'manualinput', held: 'Write the unit number on the box label by hand', fixed: 'Recipient phone number', why: 'an ACTION in a MANUALLY-ENTERED-DATA symbol'},
  {shape: 'delay', held: 'Wait 30 minutes for the wood glue to set', fixed: 'Waiting for the courier pickup', why: 'an imperative opening a MARKER symbol (the rule applied to `delay`)'},
];
const D6_SYMBOL_CHOICE_VIOLATIONS = [
  {shape: 'io', held: 'Count the parts against the checklist', fixed: 'Cart items and prices', why: 'an ACTION in a DATA symbol, opening with a verb outside the spec denylist'},
  {shape: 'looplimit', held: 'Loop: for each of the 8 cam locks', fixed: 'For each of 8 items', why: 'restates the loop the symbol already says — not a first-word defect'},
  {shape: 'storeddata', held: 'Leftover screws — kept in the box', fixed: 'Order history log', why: 'DESCRIBES the store instead of naming it — not a first-word defect'},
];
const d6Wording = D6_WORDING_VIOLATIONS.map(v => ({...v, held: grammarViolation(v.shape, v.held), fixed: grammarViolation(v.shape, v.fixed)}));
for (const r of d6Wording) console.log(`  ${r.shape.padEnd(13)} held → ${r.held ? 'RED' : 'green'} [${r.why}]  |  §4.0 correction → ${r.fixed ? 'RED' : 'green'}`);
const d6SymbolChoice = D6_SYMBOL_CHOICE_VIOLATIONS.map(v => ({...v, held: grammarViolation(v.shape, v.held), fixed: grammarViolation(v.shape, v.fixed)}));
for (const r of d6SymbolChoice) console.log(`  ${r.shape.padEnd(13)} held → ${r.held ? 'RED' : 'green (outside the wording predicate)'} [${r.why}]`);
assert('pre4.REPLAY-AC21-is-RED-on-every-violation-its-predicate-can-catch',
  d6Wording.every(r => r.held !== null) && d6Wording.every(r => r.fixed === null),
  d6Wording.every(r => r.held !== null)
    ? `${d6Wording.length}/${d6Wording.length} catchable forms are RED (${d6Wording.map(r => r.shape).join(', ')}) and all ${d6Wording.length} of their §4.0 corrections are green — the wording rule is not vacuous`
    : `only ${d6Wording.filter(r => r.held !== null).length}/${d6Wording.length} held forms are red — the predicate would let an ACTION through a DATA/MARKER symbol`);
assert('pre5.REPLAY-AC21s-reach-is-the-imperative-opener-subset-and-that-is-recorded',
  d6SymbolChoice.every(r => r.held === null) && d6SymbolChoice.every(r => r.fixed === null),
  `${d6SymbolChoice.length} of §4.0's five measured violations are NOT caught by AC 21's first-word predicate and cannot be: ` +
  d6SymbolChoice.map(r => `${r.shape} (${r.why})`).join('; ') +
  `. §4.0 states this boundary itself — "the five violations above were not wording problems, they were five symbols sitting on the wrong step". ` +
  `AC 21 is therefore a wording probe over the 16 symbols, not a full audit of §4.0's table.`);

/* pre6 — AC 22's predicate is not vacuous: the two labels the round-1 coder
   flagged ARE over the preset's own limit, and Harvey's shortened forms are
   under it. The pairs are the real strings, not paraphrases. */
const LABEL_OVER = ['repack — back to the sealing step', 'wrong item — back to the packing loop'];
const LABEL_FIXED = ['repack', 'wrong item'];
const labelReplay = LABEL_OVER.map((held, i) => ({
  held, fixed: LABEL_FIXED[i],
  heldLen: held.length, fixedLen: LABEL_FIXED[i].length,
}));
for (const r of labelReplay) {
  console.log(`  ${String(r.heldLen).padStart(2)} chars → ${r.heldLen > MAXLABEL ? 'RED' : 'green'}  |  ${String(r.fixedLen).padStart(2)} chars → ${r.fixedLen > MAXLABEL ? 'RED' : 'green'}  ${JSON.stringify(r.fixed)}`);
}
assert('pre6.REPLAY-AC22-is-RED-on-both-flagged-labels-and-green-on-the-fix',
  labelReplay.every(r => r.heldLen > MAXLABEL) && labelReplay.every(r => r.fixedLen <= MAXLABEL),
  labelReplay.every(r => r.heldLen > MAXLABEL)
    ? `both flagged labels are over the preset's own limit (${labelReplay.map(r => r.heldLen).join(', ')} > ${MAXLABEL}) and both shortened forms are under it (${labelReplay.map(r => r.fixedLen).join(', ')} <= ${MAXLABEL}) — the assertion has a live target`
    : 'the flagged labels are NOT over the preset limit, so AC 22 would have been green on the tree that carried them — it would catch nothing');

/* ---------- the untouched-invariants gate --------------------------------- */
console.log('\n' + '='.repeat(78));
console.log('GATES — invariants this round must not move');
console.log('='.repeat(78));
console.log('  src/layout.ts and vite.config.ts: untouched by this round (no probe here writes either)');
/* AC 19 — this harness must never read the gitignored runtime data directory. The
   needle is built by CONCATENATION so that spelling it here cannot make the
   assertion match its own source text. */
const SELF_SRC = readFileSync(new URL(import.meta.url), 'utf8');
const BOARDS_NEEDLE = 'boa' + 'rds' + '/';
const boardsRefs = SELF_SRC.split('\n').map((l, i) => ({l, i: i + 1})).filter(r => r.l.includes(BOARDS_NEEDLE));
assert('g1.the-harness-never-reads-the-runtime-boards-directory',
  boardsRefs.length === 0,
  boardsRefs.length === 0
    ? 'no reference to the gitignored runtime boards directory anywhere in this file — every probe reads src/ or executes the bundled modules'
    : `referenced at line(s) ${boardsRefs.map(r => r.i).join(', ')}`);

console.log('\n' + '='.repeat(78));
console.log('GATES — the hex count');
console.log('='.repeat(78));
assert('g2.hex-gate',
  HEX === FIXTURE.hexLiterals,
  `src/styles.css holds ${HEX} hex literals, the pre-change number — the gate is a COUNT, and this round adds none`);

const failed = results.filter(r => !r.pass);
console.log('\n' + '='.repeat(78));
console.log(`PACKAGE-TEMPLATES HARNESS: ${results.length - failed.length}/${results.length} passed`);
console.log('='.repeat(78));
for (const f of failed) console.log(`  FAIL  ${f.id}  —  ${f.detail}`);
try { rmSync(dir, {recursive: true, force: true}); } catch { /* gone */ }
process.exit(failed.length ? 1 : 0);
