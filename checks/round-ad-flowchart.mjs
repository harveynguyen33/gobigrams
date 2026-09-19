#!/usr/bin/env node
/**
 * ROUND AD harness — the flowchart build Harvey approved.
 *
 * No browser, no DOM, no CDP. Everything below is either (1) EXECUTED against
 * the real `src/presets.ts` (bundled with the project's own esbuild and
 * imported, so `LIBRARY` and the `fc()` rows are the shipped objects, not a
 * transcription), or (2) ARITHMETIC on the frame geometry as written in
 * `src/shapes.tsx`, or (3) a TEXT read of `src/shapes.tsx` / `src/DiagramNode.tsx`
 * for the two tables Node cannot strip JSX out of. Nothing here is a painted
 * measurement — that is the orchestrator's live pass.
 *
 * COMMENTS ARE BLANKED BEFORE EVERY COUNT (blanking keeps byte offsets, so any
 * reported line number stays true). This repo's docblocks quote the constructs
 * they describe, and a raw count would read a correct tree as a defect.
 */
import {readFileSync, writeFileSync, rmSync} from 'node:fs';
import {join} from 'node:path';

const ROOT = '/home/harvey/projects/tech-goblin/lab/diagram-studio';
const SHAPES_RAW = readFileSync(`${ROOT}/src/shapes.tsx`, 'utf8');
const NODE_RAW = readFileSync(`${ROOT}/src/DiagramNode.tsx`, 'utf8');
const PRESETS_RAW = readFileSync(`${ROOT}/src/presets.ts`, 'utf8');
const STYLES_RAW = readFileSync(`${ROOT}/src/styles.css`, 'utf8');

const blank = m => m.replace(/[^\n]/g, ' ');
const stripTs = s => s
  .replace(/\/\*[\s\S]*?\*\//g, blank)
  .replace(/(^|[^:])\/\/[^\n]*/g, (m, p1) => p1 + ' '.repeat(m.length - p1.length));
const SHAPES = stripTs(SHAPES_RAW);
const NODE = stripTs(NODE_RAW);
const PRESETS = stripTs(PRESETS_RAW);

const results = [];
const assert = (id, pass, detail = '') => {
  results.push({id, pass: !!pass, detail});
  console.log(`  ${pass ? 'PASS' : 'FAIL'}  ${id}  —  ${detail}`);
};

/* ===========================================================================
   THE CONTRACT FOR THIS ROUND — the six approved additions, with the label,
   the hint and the colour key each was approved with. Held here as DATA so the
   checks below are generated from it rather than written six times.
=========================================================================== */
const NEW_SHAPES = [
  {id: 'offpage',         label: 'Off-page connector', hint: 'home plate · another page',    colorKey: 'slate',  geom: 'M2 2 H198 V66 L100 98 L2 66 Z'},
  {id: 'manualinput',     label: 'Manual input',       hint: 'sloped top · by keyboard',     colorKey: 'green',  geom: 'M2 30 L198 2 V98 H2 Z'},
  {id: 'display',         label: 'Display',            hint: 'curved trapezoid · show data', colorKey: 'violet', geom: 'M2 2 H120 A 78 48 0 0 1 120 98 H2 Z'},
  {id: 'storeddata',      label: 'Stored data',        hint: 'cylinder · read / write',      colorKey: 'violet', geom: 'cylinder'},
  {id: 'looplimit',       label: 'Loop limit',         hint: 'notched top · loop start',     colorKey: 'amber',  geom: 'M36 2 H164 L198 24 V98 H2 V24 Z'},
  {id: 'internalstorage', label: 'Internal storage',   hint: 'pane rect · in-memory',        colorKey: 'violet', geom: 'M26 2 V98'},
];

/* ===========================================================================
   0 — THE TERMINAL'S PROPORTION (1.50 / 270x180), AND ITS GEOMETRY, ARITHMETIC.
=========================================================================== */
console.log('='.repeat(78));
console.log('AD-1 — the Terminal defaults to 270x180 = 1.50');
console.log('='.repeat(78));

const fcRows = [...PRESETS.matchAll(/fc\('([^']*)',\s*'([^']*)',\s*'([^']*)',\s*'([^']*)'([^\n]*)/g)]
  .map(m => ({label: m[1], hint: m[2], shape: m[3], colorKey: m[4], tail: m[5]}));
const fcByLabel = new Map(fcRows.map(r => [r.label, r]));
const sizeOf = tail => {
  const m = /\{width:\s*(\d+),\s*height:\s*(\d+)\}/.exec(tail);
  return m ? {width: +m[1], height: +m[2]} : null;
};
console.log(`  fc() rows parsed from src/presets.ts: ${fcRows.length}`);

const TERMINAL = fcByLabel.get('Terminal');
const TERMINAL_SIZE = TERMINAL ? sizeOf(TERMINAL.tail) : null;
console.log(`  Terminal palette row → shape=${TERMINAL?.shape} size=${TERMINAL_SIZE ? `${TERMINAL_SIZE.width}x${TERMINAL_SIZE.height}` : 'ABSENT (content-sized)'}`);
assert('ad1.the-Terminal-palette-row-declares-the-approved-default-size',
  !!TERMINAL && TERMINAL.shape === 'terminator'
    && TERMINAL_SIZE?.width === 270 && TERMINAL_SIZE?.height === 180,
  `the \`fc('Terminal', …)\` row carries ${TERMINAL_SIZE ? `${TERMINAL_SIZE.width}x${TERMINAL_SIZE.height}` : 'no size at all'}. ` +
  'Before this round it carried NO size, so `addNodeByLabel` fell through `item.size ?? group ?? note ?? null` and the node was ' +
  'CONTENT-SIZED — 304x180 was a content measurement, not a constant anywhere in the source. The approved default is now explicit.');

assert('ad1.the-ratio-is-exactly-1.50',
  TERMINAL_SIZE != null && TERMINAL_SIZE.width === TERMINAL_SIZE.height * 1.5,
  TERMINAL_SIZE
    ? `${TERMINAL_SIZE.width} / ${TERMINAL_SIZE.height} = ${(TERMINAL_SIZE.width / TERMINAL_SIZE.height).toFixed(3)} — the approved 1.50 ` +
      '(the pre-round content measurement was 304/180 = 1.689).'
    : 'the Terminal row declares NO size, so there is no ratio to check — see the assertion above.');

/* THE TEMPLATE PATH CREATES TERMINALS TOO, so it must not disagree with the
   palette: a board seeded from the Approval template is the same shape a user
   drags out of the panel. */
const TEMPLATE_TERMINALS = [...PRESETS.matchAll(/flowNode\('((?:a1|a8))',\s*'terminator'[^\n]*/g)].map(m => m[0]);
const templateSizes = TEMPLATE_TERMINALS.map(s => sizeOf(s.replace(/^[^\n]*?flowNode/, '')));
console.log(`  template terminator nodes: ${TEMPLATE_TERMINALS.length}  sizes=[${templateSizes.map(s => s ? `${s.width}x${s.height}` : 'none').join(', ')}]`);
assert('ad1.the-template-s-Terminal-nodes-carry-the-same-default-size',
  TEMPLATE_TERMINALS.length === 2
    && templateSizes.every(s => s?.width === 270 && s?.height === 180),
  `${TEMPLATE_TERMINALS.length} \`terminator\` nodes in the Approval template, each ` +
  `${templateSizes.map(s => s ? `${s.width}x${s.height}` : 'unsized').join(' / ')} — so seed-from-template and drag-from-panel agree on one default.`);

/* THE GEOMETRIC CATCH, AS ARITHMETIC ON THE SOURCE. The frame is a 200x100
   viewBox stretched (`preserveAspectRatio="none"`) to the node box, with a
   fixed `rx=49`, so the end caps are ellipses whose radii scale with the box. */
const VIEWBOX = /viewBox="0 0 200 100"/.test(SHAPES);
const RX = 49;
const capRadii = (w, h) => ({rh: RX * w / 200, rv: RX * h / 100});
const at270 = capRadii(270, 180), at304 = capRadii(304, 180);
const roundness = r => r.rh / r.rv;
console.log(`  frame: viewBox="0 0 200 100" present=${VIEWBOX}, stretch (preserveAspectRatio="none")=${/preserveAspectRatio="none"/.test(SHAPES)}, rx=${RX} fixed`);
console.log(`  caps at 270x180: ${at270.rh.toFixed(2)} x ${at270.rv.toFixed(2)} px -> ${roundness(at270).toFixed(3)} of a semicircle`);
console.log(`  caps at 304x180: ${at304.rh.toFixed(2)} x ${at304.rv.toFixed(2)} px -> ${roundness(at304).toFixed(3)} of a semicircle`);
assert('ad1.the-narrower-box-makes-the-caps-MORE-elliptical-and-that-is-reported-not-hidden',
  Math.abs(roundness(at270) - 0.750) < 0.002 && Math.abs(roundness(at304) - 0.844) < 0.002
    && roundness(at270) < roundness(at304)
    && !/viewBox="0 0 200 100"[\s\S]{0,200}preserveAspectRatio="xMidYMid/.test(SHAPES),
  `narrowing the box moves the cap from ${roundness(at304).toFixed(3)} to ${roundness(at270).toFixed(3)} of a true semicircle — MORE elliptical, ` +
  'not rounder, because `rh = 49*W/200` and `rv = 49*H/100` only agree when `W = 2H`. The viewBox and the rx are untouched, as required. ' +
  `A circular cap at 1.50 would need W = 2H (360 at H=180), i.e. the OPPOSITE of the change Harvey asked for.`);

/* THE RESIZER FLOOR IS NOT MOVED, and the new default sits above it. */
const CONSTS = {};
for (const m of NODE.matchAll(/(?:export )?const (CSS_CONTENT_MIN_W|NODE_MIN_W|NODE_MIN_H|FLOOR_SLACK_PX|CONTENT_MIN_H)\s*=\s*([^;]+);/g)) {
  CONSTS[m[1]] = m[2].trim();
}
const CSS_MINW = (/^(\d+)$/.exec(CONSTS.CSS_CONTENT_MIN_W) ?? [])[1];
/* ANCHORED ON THE `.node` RULE ITSELF. The first `min-width:` in the sheet
   belongs to a different rule entirely (`.panel`-adjacent, 168px), so a bare
   search would read the wrong number and report a correct tree as broken. */
const nodeRuleBlock = (STYLES_RAW.match(/(?:^|\n)\.node \{[^}]*\}/) ?? [''])[0];
const nodeCssMinW = (/min-width:\s*(\d+)px/.exec(nodeRuleBlock) ?? [])[1];
console.log(`  DiagramNode consts: CSS_CONTENT_MIN_W=${CONSTS.CSS_CONTENT_MIN_W} NODE_MIN_W=${CONSTS.NODE_MIN_W} NODE_MIN_H=${CONSTS.NODE_MIN_H}`);
console.log(`  .node { min-width } in styles.css: ${nodeCssMinW}px   [rule found: ${nodeRuleBlock ? 'yes' : 'NO — anchored probe failed'}]`);
assert('ad1.the-resizer-floor-is-unchanged-and-the-new-default-clears-it',
  /* `NODE_MIN_W` / `NODE_MIN_H` are EXPRESSIONS (`CSS_CONTENT_MIN_W + FLOOR_SLACK_PX`),
     not literals, so they are evaluated with the two operands read from the same
     file rather than coerced with a bare `+`. A `+` on `'CSS_CONTENT_MIN_W + 10'`
     is NaN, which would have failed this assertion on a correct tree. */
  CSS_MINW === '190' && +CONSTS.FLOOR_SLACK_PX === 10 && +nodeCssMinW === 190
    && (+CSS_MINW + +CONSTS.FLOOR_SLACK_PX) === 200
    && (+CONSTS.CONTENT_MIN_H + +CONSTS.FLOOR_SLACK_PX) === 141
    && !!TERMINAL_SIZE && TERMINAL_SIZE.width >= 200 && TERMINAL_SIZE.height >= 141,
  `floors still 200x141 (CSS_CONTENT_MIN_W 190 + FLOOR_SLACK_PX ${CONSTS.FLOOR_SLACK_PX}); the 270x180 default clears both, ` +
  'so the Terminal is resizable in both directions from the new default and 200x141 still binds as the floor.');

/* ===========================================================================
   1 — THE SIX NEW SHAPES, IN EVERY TABLE THAT MUST KNOW ABOUT THEM.
=========================================================================== */
console.log('\n' + '='.repeat(78));
console.log('AD-2 — the six additions, half-wired or wired');
console.log('='.repeat(78));

/* shapes.tsx — the Shape union, the SHAPES table, the frame switch, the preview switch. */
const UNION_BLOCK = SHAPES.slice(SHAPES.indexOf('export type Shape'), SHAPES.indexOf('export const SHAPES'));
const shapeTable = [...SHAPES.matchAll(/\{id: '([^']+)', label: '([^']+)', hint: '([^']+)'\}/g)]
  .map(m => ({id: m[1], label: m[2], hint: m[3]}));
const shapeById = new Map(shapeTable.map(s => [s.id, s]));
const frameCases = [...SHAPES.matchAll(/case '([^']+)':/g)].map(m => m[1]);
console.log(`  shapes.tsx: ${shapeTable.length} SHAPES rows, ${frameCases.length} \`case\` labels in the file`);
console.log(`  SHAPES ids: [${shapeTable.map(s => s.id).join(', ')}]`);

/* DiagramNode.tsx — the RESIZABLE set is the shape LIST on the render side. */
const RESIZABLE_BLOCK = NODE.slice(NODE.indexOf('export const RESIZABLE'), NODE.indexOf('const POSTIT'));
const resizableIds = [...RESIZABLE_BLOCK.matchAll(/'([^']+)'/g)].map(m => m[1]);
/* A REGEX ON THE WHOLE DECLARATION, NOT AN OFFSET. Offsets were tried twice and
   were wrong twice: `FLOWCHART_EXTRA_SHAPES: Shape[] = [...]` carries a `[]` in
   its TYPE ANNOTATION before the initialiser, and the initialiser itself starts
   on the NEXT line, so neither `indexOf(']')` nor `indexOf('= [')` finds the
   array. `[^=]*=` skips the annotation and `\s*` spans the newline. */
const extrasDecl = (SHAPES.match(/FLOWCHART_EXTRA_SHAPES[^=]*=\s*\[([\s\S]*?)\]/) ?? [])[1] ?? '';
const extraIds = [...extrasDecl.matchAll(/'([^']+)'/g)].map(m => m[1]);
const FRAME_HALF = SHAPES.slice(SHAPES.indexOf('export function ShapeFrame'), SHAPES.indexOf('export function ShapePreview'));
const PREVIEW_HALF = SHAPES.slice(SHAPES.indexOf('export function ShapePreview'));

const wiring = NEW_SHAPES.map(s => {
  const inUnion = new RegExp(`'${s.id}'`).test(UNION_BLOCK);
  const inTable = shapeById.has(s.id);
  const frameCase = [...FRAME_HALF.matchAll(new RegExp(`case '${s.id}':`, 'g'))].length;
  const previewCase = [...PREVIEW_HALF.matchAll(new RegExp(`case '${s.id}':`, 'g'))].length;
  const inResizable = resizableIds.includes(s.id);
  const inExtras = extraIds.includes(s.id);
  const fc = fcByLabel.get(s.label);
  return {s, inUnion, inTable, frameCase, previewCase, inResizable, inExtras, fc};
});
console.log(`  FLOWCHART_EXTRA_SHAPES ids (${extraIds.length}): [${extraIds.join(', ')}]`);
for (const w of wiring) {
  console.log(`  ${w.s.id.padEnd(16)} union=${w.inUnion ? 'Y' : 'N'} table=${w.inTable ? 'Y' : 'N'} ` +
    `frameCase=${w.frameCase} previewCase=${w.previewCase} resizable=${w.inResizable ? 'Y' : 'N'} extras=${w.inExtras ? 'Y' : 'N'} ` +
    `palette=${w.fc ? 'Y' : 'N'}`);
}

assert('ad2.every-addition-is-in-the-Shape-union-and-the-SHAPES-table',
  wiring.every(w => w.inUnion && w.inTable && shapeById.get(w.s.id).label === w.s.label),
  `${wiring.filter(w => w.inUnion && w.inTable).length}/6 in BOTH the \`Shape\` union and the SHAPES table — a shape in one table but not ` +
  'the union is the classic half-wired bug this check exists for.');

assert('ad2.every-addition-has-a-frame-renderer',
  wiring.every(w => w.frameCase >= 1),
  `${wiring.filter(w => w.frameCase >= 1).length}/6 carry a \`case\` in \`ShapeFrame\`'s switch — a SHAPES row with no frame draws an empty box.`);

assert('ad2.every-addition-has-a-palette-preview-renderer',
  wiring.every(w => w.previewCase >= 1),
  `${wiring.filter(w => w.previewCase >= 1).length}/6 render a silhouette in \`ShapePreview\`, which is the art the palette ROW draws.`);

assert('ad2.every-addition-is-resizable-on-the-canvas',
  wiring.every(w => w.inResizable),
  `${wiring.filter(w => w.inResizable).length}/6 are in \`RESIZABLE\` — the set the node renderer consults before offering NodeResizer.`);

assert('ad2.every-addition-is-in-the-flowchart-shape-set',
  wiring.every(w => w.inExtras),
  `\`FLOWCHART_EXTRA_SHAPES\` carries ${wiring.filter(w => w.inExtras).length}/6. The two preset \`extraShapes\` arrays are asserted separately below.`);

assert('ad2.every-addition-is-a-palette-row-with-its-approved-colour-key',
  wiring.every(w => w.fc && w.fc.shape === w.s.id && w.fc.colorKey === w.s.colorKey),
  wiring.map(w => `${w.s.label}=${w.fc ? w.fc.colorKey : 'MISSING'}`).join('  ') +
  ` — each row carries the colour key proposed for it, drawn from the EXISTING six accent keys (no new colour).`);

/* Stored data REUSES the database geometry, which the brief requires verbatim:
   the cylinder path must be ONE source, not a second copy. The shared drawing
   lives in `cylinder()`, so the requirement is asserted on THAT: one cylinder
   body in the whole file, both cases routing through it. */
const dbCase = (SHAPES.match(/case 'database':[\s\S]*?(?=case ')/) ?? [''])[0];
const sdCase = (SHAPES.match(/case 'storeddata':[\s\S]*?(?=case ')/) ?? [''])[0];
const cylinderDefs = [...SHAPES.matchAll(/const cylinder\s*=\s*\(/g)].length;
const ellipseDefs = [...SHAPES.matchAll(/ellipse cx="100" cy="20" rx="96" ry="15"/g)].length;
console.log(`  database  case: ${dbCase.replace(/\s+/g, ' ').trim()}`);
console.log(`  storeddata case: ${sdCase.replace(/\s+/g, ' ').trim()}`);
console.log(`  \`const cylinder = (\` definitions: ${cylinderDefs}   \`ellipse cx="100" cy="20"\` occurrences: ${ellipseDefs}`);
assert('ad2.stored-data-reuses-the-database-cylinder-rather-than-redrawing-it',
  cylinderDefs === 1 && ellipseDefs === 1
    && /return cylinder\('database'\)/.test(dbCase)
    && /return cylinder\('storeddata'\)/.test(sdCase),
  'the cylinder markup is drawn ONCE (`const cylinder = (` x1, one `ellipse cx="100" cy="20"` in the file) and BOTH cases route ' +
  'through it — `database` with its own class and the new `storeddata` with its. So the two cannot drift and no second cylinder path ' +
  'exists. (The brief: "REUSE the path, do not redraw".)');

/* The preset extraShapes fields — both of them. They are REFERENCES now (see
   the note in `src/presets.ts`), so the check is that both point at the ONE
   array AND that the array carries all six. Asserting the literal contents here
   would have re-created the three-copy problem in a fourth place. */
const PRESET_EXTRA_REFS = [...PRESETS.matchAll(/extraShapes:\s*([A-Za-z_][\w]*)\s*,/g)].map(m => m[1]);
console.log(`  preset extraShapes references: ${PRESET_EXTRA_REFS.length}  [${PRESET_EXTRA_REFS.join(', ')}]`);
assert('ad2.both-presets-reference-the-one-shape-array-and-it-carries-all-six',
  PRESET_EXTRA_REFS.length === 2
    && PRESET_EXTRA_REFS.every(r => r === 'FLOWCHART_EXTRA_SHAPES')
    && NEW_SHAPES.every(s => extraIds.includes(s.id)),
  `${PRESET_EXTRA_REFS.length} \`extraShapes\` fields, both pointing at \`FLOWCHART_EXTRA_SHAPES\` (${extraIds.length} ids, including all ` +
  '6 additions) — so the flowchart preset AND the Mixed one cannot disagree with it or with each other.');

/* ===========================================================================
   2 — THE HINT-AGREEMENT SWEEP. GENERIC, over every shape the two files share.
=========================================================================== */
console.log('\n' + '='.repeat(78));
console.log('AD-3/AD-4 — one shape, one hint');
console.log('='.repeat(78));

/* The LIBRARY side is EXECUTED, not transcribed: presets.ts is bundled with the
   project's own esbuild and imported, so `LIBRARY` is the shipped array and the
   `fc()` rows are the shipped objects. A bundle written to /tmp cannot resolve
   its own externals, so entry and output live INSIDE ROOT and are removed below. */
const ENTRY = join(ROOT, '.ad-entry.ts');
const OUT = join(ROOT, '.ad-out.mjs');
writeFileSync(ENTRY, `export {LIBRARY, FLOWCHART_PRESET, CUSTOM_PRESET} from './src/presets';\nexport {COLOR_KEYS, resolveColor} from './src/colors';\n`);
const {execFileSync} = await import('node:child_process');
writeFileSync(OUT, execFileSync(join(ROOT, 'node_modules/.bin/esbuild'),
  [ENTRY, '--bundle', '--platform=node', '--format=esm', '--log-level=error',
    '--external:react', '--external:react-dom', '--external:react/jsx-runtime', '--external:@xyflow/react'],
  {encoding: 'utf8'}));
const MOD = await import(`${OUT}?t=${Date.now()}`);
const {LIBRARY, COLOR_KEYS, resolveColor} = MOD;
console.log(`  LIBRARY EXECUTED: ${LIBRARY.length} items`);

/* THE SWEEP: every label present in BOTH tables must carry the SAME hint.
   Generic by construction — it enumerates the intersection and fails on ANY
   pair that disagrees, so a future drift cannot slip past as a known exception. */
const compareSet = shapeTable.filter(s => LIBRARY.some(p => p.label === s.label));
const drift = compareSet
  .map(s => ({label: s.label, shape: s.id, inspector: s.hint, palette: LIBRARY.find(p => p.label === s.label).hint}))
  .filter(r => r.inspector !== r.palette);
console.log(`  shapes present in BOTH files: ${compareSet.length}  [${compareSet.map(s => s.label).join(', ')}]`);
console.log(`  disagreeing: ${drift.length}`);
for (const r of drift) console.log(`    ! ${r.label.padEnd(20)} inspector="${r.inspector}"   palette="${r.palette}"`);

/* THE LIVENESS FLOOR — a sweep over an empty set passes on anything. */
assert('ad3.the-sweep-compares-a-real-set-of-shapes',
  compareSet.length >= 19
    && ['Process', 'Input / Output', 'Document', 'Terminal', 'Database'].every(l => compareSet.some(s => s.label === l)),
  `${compareSet.length} labels are compared and the set contains Process, Input / Output, Document, Terminal and Database — ` +
  'so the zeros below cannot be a vacuous pass over nothing.');

assert('ad3.no-shape-tells-the-user-two-different-things',
  drift.length === 0,
  drift.length
    ? `${drift.length} disagreeing pair(s): ` + drift.map(r => `${r.label} (inspector "${r.inspector}" vs palette "${r.palette}")`).join('; ')
    : `all ${compareSet.length} shared labels carry ONE hint, in both the palette row (src/presets.ts) and the inspector's shape ` +
      'picker (src/shapes.tsx). The two strings Harvey was handed — Process and Input / Output — were the visible half of a class of ' +
      'bug; Database, Queue, Actor and Storage were silently the same drift.');

/* HINTS ARE UNIQUE AND SHORT — the invariants `checks/package-o-metrics.mjs`
   holds each table to, re-asserted here so a new row cannot land without
   meeting them. DEDUPLICATED ACROSS TABLES: one shape legitimately carries ONE
   hint in BOTH tables (that is assertion ad3 above), so a cross-table repeat of
   a value shared by two different shapes is the defect, not the repeat itself. */
const newHints = NEW_SHAPES.map(s => s.hint);
const perTableDupes = [];
for (const [name, table] of [['shapes.tsx', shapeTable], ['LIBRARY', LIBRARY]]) {
  const seen = new Map();
  for (const row of table) seen.set(row.hint, (seen.get(row.hint) ?? 0) + 1);
  for (const [h, n] of seen) if (n > 1) perTableDupes.push(`${name}: x${n} "${h}"`);
}
const allHints = [...new Set([...shapeTable.map(s => s.hint), ...LIBRARY.map(p => p.hint)])];
const overLong = allHints.filter(h => h.length > 32);
const repeatsLabel = shapeTable.filter(s => s.hint.toLowerCase().includes(s.label.toLowerCase())).map(s => s.label);
const newHintCollisions = newHints.filter(h => !(
  shapeTable.filter(s => s.hint === h).length === 1 && LIBRARY.filter(p => p.hint === h).length === 1
));
console.log(`  distinct hint strings across both tables: ${allHints.length}  (length ${Math.min(...allHints.map(h => h.length))}–${Math.max(...allHints.map(h => h.length))} chars)`);
console.log(`  per-table duplicate hints: ${perTableDupes.length}${perTableDupes.length ? ' -> ' + perTableDupes.join('; ') : ''}`);
assert('ad3.the-new-hints-are-distinct-from-every-existing-hint-and-under-32-chars',
  newHintCollisions.length === 0 && overLong.length === 0 && perTableDupes.length === 0
    && newHints.every(h => allHints.includes(h)),
  `${newHints.length} new hints, each appearing exactly once in EACH table that carries it and colliding with no existing hint; longest ` +
  `of the ${allHints.length} distinct hints is ${Math.max(...allHints.map(h => h.length))} chars (limit 32); ` +
  `${repeatsLabel.length} hint(s) repeat their own label` + (repeatsLabel.length ? ` (${repeatsLabel.join(', ')})` : ' — none do'));

/* AD-4 — the Document hint covers the input OR the output, in BOTH surfaces.
   The assertion is POSITIVE ON THE DISJUNCTION rather than negative on the word
   "output": the hint should say the symbol serves either direction, and the way
   it says it is `in or out`. A negative probe on the word would also have to
   whitelist that phrase to survive, which is a weaker test of the same fact. */
const DOC_INSPECTOR = shapeById.get('document')?.hint;
const DOC_PALETTE = LIBRARY.find(p => p.label === 'Document')?.hint;
console.log(`  Document hint — inspector="${DOC_INSPECTOR}"  palette="${DOC_PALETTE}"`);
assert('ad4.the-Document-hint-covers-input-or-output-in-both-surfaces',
  DOC_INSPECTOR === DOC_PALETTE
    && /in or out|input \/ output|in \/ out/i.test(DOC_INSPECTOR)
    && /\bwavy base\b/.test(DOC_INSPECTOR),
  `both surfaces read "${DOC_INSPECTOR}". The symbol covers the input OR the output of a document (Lucidchart: "represents the input or ` +
  'output of a document"), so a hint naming only "output" was factually too narrow. It keeps the geometry cue every other flowchart hint leads ' +
  'with, and adds no word the row already shows as its LABEL.');

/* AD-5(b) — THE COLOUR IS A DEFAULT, NOT A CAGE. EXECUTED: take the shipped
   palette payload, override `colorKey` the way the inspector's swatch does, and
   resolve it. If the key pinned the colour this returns the original. */
const termItem = LIBRARY.find(p => p.label === 'Terminal');
const made = termItem.make();
const overridden = {...made, colorKey: 'amber'};
const asMade = resolveColor(made);
const asOverridden = resolveColor(overridden);
const keysInPalette = new Set(LIBRARY.map(p => p.colorKey));
console.log(`  Terminal make().colorKey=${made.colorKey} → resolveColor ${asMade}`);
console.log(`  after the inspector's swatch write (colorKey:'amber') → resolveColor ${asOverridden}`);
console.log(`  colour keys used by the palette: [${[...keysInPalette].join(', ')}]  (COLOR_KEYS = [${COLOR_KEYS.join(', ')}])`);
assert('ad5b.a-node-colour-can-be-overridden-per-node-and-the-key-only-supplies-the-default',
  asMade === 'var(--c-green)' && asOverridden === 'var(--c-amber)' && asOverridden !== asMade
    && [...keysInPalette].every(k => COLOR_KEYS.includes(k)),
  `the palette supplies \`colorKey: 'green'\` and \`resolveColor\` returns ${asMade}; writing \`colorKey: 'amber'\` on the same payload — ` +
  `exactly what the inspector's Style swatches do — returns ${asOverridden}. So the key is a DEFAULT the node carries, not a pin: nothing ` +
  'in the render path re-reads the palette after creation, and every key the palette uses is one of the six existing accents.');

/* ===========================================================================
   3 — THE GATE.
=========================================================================== */
console.log('\n' + '='.repeat(78));
console.log('GATES');
console.log('='.repeat(78));
const HEX = (STYLES_RAW.match(/#[0-9a-fA-F]{3,8}\b/g) ?? []).length;
console.log(`  hex literals in src/styles.css: ${HEX} (limit 127)`);
assert('ad0.the-token-gate-holds-no-new-colour-was-added',
  HEX === 127,
  `${HEX} hex colour literals in \`src/styles.css\`. This round adds six shapes and a labelled key and introduces ZERO colour: every ` +
  'new shape reuses an existing accent key and the label is a `.hint`-class row.');

const failed = results.filter(r => !r.pass);
console.log('\n' + '='.repeat(78));
console.log(`ROUND AD HARNESS: ${results.length - failed.length}/${results.length} passed`);
console.log('='.repeat(78));
for (const f of failed) console.log(`  FAIL  ${f.id}  —  ${f.detail}`);
try { rmSync(ENTRY, {force: true}); rmSync(OUT, {force: true}); } catch { /* gone */ }
console.log(`  cleaned build artefacts: ${ENTRY.replace(ROOT + '/', '')}, ${OUT.replace(ROOT + '/', '')}`);
process.exit(failed.length ? 1 : 0);
