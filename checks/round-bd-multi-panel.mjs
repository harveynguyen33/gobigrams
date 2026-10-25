#!/usr/bin/env node
/**
 * ROUND BD harness — the multi-select inspector block, redesigned.
 *
 * Harvey called the old block ugly; eight defects were measured off his
 * screenshot. This harness guards the redesign in three passes:
 *
 *   PASS 1 — SOURCE CONTRACT (text, comments stripped). Section inventory by
 *   COUNTS (not presence), zero hint text in the block, title-case labels,
 *   one destructive control, the icon→action mapping identical to the
 *   sel-bar's, and the negative control: the single-node branches untouched.
 *
 *   PASS 2 — UNIT: the z-order helper, EXECUTED. `reorderSelection` is a
 *   useCallback inside App, so the probe extracts the pure body and runs it
 *   against a setNodes-shaped recorder — same discipline as the board-dialog
 *   probes (bundled with esbuild, not transcribed). Asserts: pushHistory()
 *   exactly once per click (one gesture = one undo step), zIndex writes
 *   bounded to the live extremes, the array re-sorted, other nodes untouched,
 *   no-op below 2 selected, and a SECOND push changes nothing after undo.
 *
 *   PASS 3 — LIVE DOM (CDP on the dev server). Section inventory counts,
 *   the align grid's 6 buttons each on its own measured rect (all lefts differ
 *   across the 3 columns, tops match per row — the grid arithmetic asserted
 *   against getBoundingClientRect, not reasoned), swatch cells equal,
 *   destructive-at-rest computed colour, and the Arrange buttons REALLY
 *   writing zIndex through a click (counted, then undone).
 *
 * WHAT THIS CANNOT SEE: stated per pass at its bottom.
 */
import {readFileSync, writeFileSync, rmSync, mkdtempSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {tmpdir} from 'node:os';
import {join, dirname} from 'node:path';
import {fileURLToPath} from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');
const APP_RAW = readFileSync(`${ROOT}/src/App.tsx`, 'utf8');
/* ROUND BN-2 — reorderSelection moved VERBATIM into src/useCanvasTools.ts;
   the PASS 1 z-order count and the PASS 2 extraction read App + the hook
   (concatenated), everything else (the JSX branches) stays on App alone. */
const APP_CT_RAW = readFileSync(`${ROOT}/src/App.tsx`, 'utf8')
  + '\n' + readFileSync(`${ROOT}/src/useCanvasTools.ts`, 'utf8');
const CSS_RAW = readFileSync(`${ROOT}/src/styles.css`, 'utf8');

/** Strip block + line comments. `[^:]` keeps `https://`. */
const stripTs = s => s
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/(^|[^:])\/\/[^\n]*/g, '$1');
const APP = stripTs(APP_CT_RAW); /* ROUND BN-2 — App + useCanvasTools (see APP_CT_RAW note) */

const results = [];
const assert = (id, pass, detail = '') => {
  results.push({id, pass: !!pass, detail});
  console.log(`  ${pass ? 'PASS' : 'FAIL'}  ${id}  —  ${detail}`);
};
const countOf = (text, needle) => text.split(needle).length - 1;

/* ===========================================================================
   PASS 1 — SOURCE CONTRACT
   =========================================================================== */
console.log('\nPASS 1 — source contract (App.tsx as text, comments stripped)');

const MULTI_START = APP.indexOf(') : selCount >= 2 ? (');
const MULTI_END = APP.indexOf(") : selected?.type === 'table' ? (", MULTI_START);
const MULTI = APP.slice(MULTI_START, MULTI_END > MULTI_START ? MULTI_END : undefined);
assert('bd1.multi-branch-slice-bounded',
  MULTI_START > 0 && MULTI_END > MULTI_START && MULTI.length > 0 && MULTI.length < 20000,
  `multi branch = App.tsx chars [${MULTI_START}, ${MULTI_END}) = ${MULTI.length} chars (bounded, not the rest of the file)`);

/* --- (a) SECTION INVENTORY: counts, not presence ------------------------- */
/* The block's own inventory: the sec-labels render INSIDE the branch, so the
   slice is the whole inventory. Every row type is counted. */
const secLabels = countOf(MULTI, 'className="sec-label"');
const multiActionsRows = countOf(MULTI, 'className="multi-actions');
const alignCalls = ['left', 'hcenter', 'right', 'top', 'vcenter', 'bottom']
  .map(k => countOf(MULTI, `align('${k}')`)).reduce((a, b) => a + b, 0);
const distributeCalls = countOf(MULTI, "distribute('h')") + countOf(MULTI, "distribute('v')");
const reorderCalls = countOf(MULTI, "reorderSelection('front')") + countOf(MULTI, "reorderSelection('back')");
const swatchRows = countOf(MULTI, 'swatchRow(');
const mbtnButtons = countOf(MULTI, 'className="mbtn');
console.log(`  inventory: sec-labels=${secLabels} multi-actions rows=${multiActionsRows} ` +
  `align=${alignCalls} distribute=${distributeCalls} arrange=${reorderCalls} ` +
  `swatchRow=${swatchRows} mbtn=${mbtnButtons}`);
assert('bd1.section-inventory-counts',
  secLabels === 5 && multiActionsRows === 4 && alignCalls === 6 && distributeCalls === 2
    && reorderCalls === 2 && swatchRows === 1,
  'exactly: 5 sec-labels (Align/Distribute/Arrange/Color/Actions), 4 control rows, ' +
  '6 align + 2 distribute + 2 arrange calls, 1 swatchRow');
assert('bd1.section-inventory-counts-tight',
  secLabels === 5 && countOf(MULTI, '>Align<') === 1 && countOf(MULTI, '>Distribute<') === 1
    && countOf(MULTI, '>Arrange<') === 1 && countOf(MULTI, '>Color<') === 1 && countOf(MULTI, '>Actions<') === 1,
  'section inventory: Align / Distribute / Arrange / Color / Actions — one label each, 5 sections');

/* the old merged header must be gone, and with it the delete-under-swatches */
assert('bd1.merged-header-split',
  countOf(MULTI, 'Color · Delete') === 0 && countOf(MULTI, 'delete selected') === 0,
  "'Color · Delete' merged header gone; the standalone 'delete selected' pill under the swatches gone");

/* --- (b) NO HINT TEXT IN THE MULTI BLOCK --------------------------------- */
const hintCount = countOf(MULTI, 'className="hint"');
const arrowHint = countOf(MULTI, 'Move with arrow keys') + countOf(MULTI, 'Shift+arrow') + countOf(MULTI, '<kbd>');
const bulkHint = countOf(MULTI, 'Bulk actions apply');
console.log(`  hints: className="hint"=×${hintCount} arrow-key text=×${arrowHint} bulk text=×${bulkHint}`);
assert('bd1.no-hint-in-multi-block',
  hintCount === 0 && arrowHint === 0 && bulkHint === 0,
  'the block carries ZERO hints — both "Move with arrow keys" copies died (the ? sheet owns the shortcut)');

/* --- (c) EXACTLY ONE DESTRUCTIVE CONTROL --------------------------------- */
const dangerVariants = countOf(MULTI, 'multi-danger') + countOf(MULTI, "mbtn danger");
console.log(`  destructive variants in block: ${dangerVariants} (multi-danger + danger)`);
assert('bd1.one-destructive-control',
  dangerVariants === 1 && countOf(MULTI, 'deleteSelection') === 1,
  'exactly ONE destructive button (multi-danger) wired to deleteSelection — one handler ref in the block');

/* --- (d) TITLE-CASE / LABEL CONVENTION ----------------------------------- */
assert('bd1.word-buttons-title-cased',
  countOf(MULTI, '>Duplicate<') === 1 && countOf(MULTI, '>Delete<') === 1
    && !/>duplicate</.test(MULTI) && !/>delete</.test(MULTI),
  'the two word buttons are title-cased; the old lowercase pills are gone');
/* the six old lowercase axis words must be gone — the icon rows replaced them */
const oldWords = ['>left<', '>center<', '>right<', '>top<', '>middle<', '>bottom<', '>horizontal<', '>vertical<'];
assert('bd1.old-lowercase-axis-labels-gone',
  oldWords.every(w => !MULTI.includes(w)),
  `old lowercase axis labels all gone (${oldWords.join(' ')})`);

/* --- (e) ICON → ACTION MAPPING AGREES WITH THE SEL-BAR -------------------- */
/* Extract each surface's mapping as sorted action:icon pairs and compare. */
const mapOf = (slice) => {
  const pairs = [];
  const re = /aria-label="([^"]+)"[^>]*onClick=\{\(\) => (align|distribute|reorderSelection)\('([^']+)'\)\}><(\w+) size=\{15\}/g;
  let m;
  while ((m = re.exec(slice))) pairs.push(`${m[2]}('${m[3]}')=${m[4]}`);
  return pairs.sort().join(' | ');
};
const panelMap = mapOf(MULTI);
/* the sel-bar sits before the inspector in the file; slice between its marker
   and the inspector's opening. The bar's map is the SUBSET of actions it
   carries (duplicate/delete are not in the icon mapping regex); the panel
   must carry the bar's ENTIRE mapping plus Arrange. */
const SELBAR_START = APP.indexOf('selCount >= 2 && (\n          <div className="sel-bar">');
const SELBAR = SELBAR_START > 0 ? APP.slice(SELBAR_START, MULTI_START) : '';
const selbarMap = mapOf(SELBAR);
console.log(`  panel mapping:   ${panelMap}`);
console.log(`  sel-bar mapping: ${selbarMap}`);
const selbarPairs = selbarMap ? selbarMap.split(' | ') : [];
const panelPairs = panelMap ? panelMap.split(' | ') : [];
assert('bd1.icon-action-mapping-matches-sel-bar',
  selbarPairs.length === 8 && panelPairs.length === 10
    && selbarPairs.every(p => panelPairs.includes(p)),
  'the sel-bar\'s 8 align/distribute icon→action pairs ALL appear identically in the panel; ' +
  'the panel adds exactly the 2 Arrange pairs (BringToFront/SendToBack)');

/* --- (f) ICON-GRID MARKUP: 6 in the grid3 row, 2+2 in the grid2 rows ------ */
const grid3 = (() => {
  const i = MULTI.indexOf('multi-grid3');
  const j = MULTI.indexOf('</div>', i);
  return MULTI.slice(i, j);
})();
assert('bd1.align-row-is-6-icon-buttons',
  countOf(grid3, '<Align') === 6 && countOf(grid3, 'size={15}') === 6,
  'the align row renders exactly 6 lucide icons at 15px (a clean 3x2, not the old 4+2 wrap)');
const grid2Rows = [...MULTI.matchAll(/multi-grid2([\s\S]*?)<\/div>/g)].map(m => m[1]);
assert('bd1.two-grid2-rows-of-2',
  grid2Rows.length === 2 && grid2Rows.every(r => countOf(r, 'size={15}') === 2),
  `two grid2 rows (distribute, arrange), exactly 2 icons each (found ${grid2Rows.length})`);

/* --- (g) ARRANGE EXISTS AND IS GATED BY THE PANEL'S OWN GATE -------------- */
assert('bd1.arrange-uses-z-order-helper',
  countOf(APP, "const reorderSelection = useCallback((to: 'front' | 'back')") === 1
    && countOf(APP, 'BringToFront size') === 1 && countOf(APP, 'SendToBack size') === 1,
  "reorderSelection('front'|'back') is the ONE z-order primitive; BringToFront/SendToBack icons render once");
assert('bd1.no-stray-z-order-writes',
  // CONFIG ROUND (2026-10-23) — counting raw tokens counts comments and the
  // new zIndexMode prop/hook plumbing too. Strip comment text, then assert
  // the WRITE budget: exactly ONE zIndex write (the band), three
  // read-defaults, and the mode plumbing (hook destructure + live prop +
  // reorderSelection's mode read).
  ((strip) => countOf(strip, 'zIndex:') === 1
    && countOf(strip, 'zIndex ?? 0') === 3
    && countOf(strip, 'zIndexMode') === 3)(
    APP.replace(/\/\*[\s\S]*?\*\//g, '').split('\n').filter(l => !l.trim().startsWith('//')).join('\n')),
  'exactly ONE zIndex write (the band), three read-defaults, and only the zOrderMode plumbing — no second writer');

/* --- (h) NEGATIVE CONTROL: single-node branches untouched ---------------- */
/* ROUND BN-2 — SINGLE must stay a slice of App.tsx ALONE: the concatenated
   APP now trails with useCanvasTools.ts, whose reorderSelection would be a
   false "leak" into the single-node branches. */
const SINGLE = stripTs(APP_RAW).slice(MULTI_END);
assert('bd1.single-node-branches-no-multi-controls',
  countOf(SINGLE, 'reorderSelection') === 0 && countOf(SINGLE, 'multi-grid3') === 0
    && countOf(SINGLE, 'multi-grid2') === 0 && countOf(SINGLE, 'multi-danger') === 0,
  'no multi-block control leaks into the single-node branches (table/label/goblin renderSections branches untouched)');
assert('bd1.handler-occurrence-budget',
  countOf(APP, 'duplicateSelection') === 6 && countOf(APP, 'deleteSelection') === 3,
  'duplicateSelection ×6 / deleteSelection ×3 — package-p\'s (j) budget as re-anchored for ROUND BD ' +
  '(4 -> 3: the block\'s second delete call site died with the merged pill)');

/* --- (i) CSS: the kit rules exist where the harness can see them ---------- */
const cssNoComments = CSS_RAW.replace(/\/\*[\s\S]*?\*\//g, '');
assert('bd1.css-grid-modifiers',
  /\.multi-grid3 \.mbtn \{[^}]*flex: 1 1 calc\(\(100% - 10px\) \/ 3\)/.test(cssNoComments)
    && /\.multi-grid2 \.mbtn \{[^}]*flex: 1 1 calc\(\(100% - 5px\) \/ 2\)/.test(cssNoComments),
  'multi-grid3 = 3 equal columns (2 gaps x 5px), multi-grid2 = 2 equal columns — the AA flex-basis idiom');
assert('bd1.css-danger-at-rest',
  /\.mbtn\.multi-danger \{[^}]*border-color: var\(--acc\)[^}]*\}/.test(cssNoComments)
    && cssNoComments.indexOf('.mbtn.multi-danger') > cssNoComments.indexOf('.mbtn:hover {'),
  'multi-danger paints the accent at REST and is declared after .mbtn:hover (wins the cascade)');

/* ===========================================================================
   PASS 2 — UNIT: the z-order helper, executed (not transcribed)
   =========================================================================== */
console.log('\nPASS 2 — reorderSelection, executed against a setNodes recorder');

/* Extract the helper's body from the real source and wrap it in a standalone
   module. The body reads nodesRef/pushHistory/setNodes; we inject recorders
   through a factory. This is extraction-of-the-real-code, not a transcription:
   the text between the braces is copied verbatim from App.tsx, and the only
   edits are the ones a compiler makes — TS annotations stripped (Node cannot
   parse them) and the closing paren of the removed `useCallback(` accounted
   for by re-adding the arrow's own `}`. */
const fnStart = APP.indexOf('const reorderSelection = useCallback(');
/* BUGFIX 2 (2026-10-23) — the dependency array now also names `sel`, so the
   end-anchor must match the new tail. Anchor on the deps array literally and
   cut after its `);` — searching for the next `});` overshot into align(). */
/* CONFIG ROUND (2026-10-23) — the deps array grew `zOrderMode`; anchor and
   strip follow the REAL tail, whatever it names. */
const depsIdx = APP.indexOf('}, [pushHistory, setNodes, sel, zOrderMode]);', fnStart);
const DEPS_TAIL = '}, [pushHistory, setNodes, sel, zOrderMode]);';
const fnSrc = APP.slice(fnStart, depsIdx + DEPS_TAIL.length);
const body = fnSrc
  .replace('const reorderSelection = useCallback(', '')
  .replace(/}, \[pushHistory, setNodes, sel, zOrderMode\]\);\s*$/, '')
  /* Node cannot parse the TS annotations — strip them the way tsc would.
     Only types are touched; every statement is the app's own. */
  .replace("(to: 'front' | 'back')", '(to)')
  .replace('new Map<string, number>()', 'new Map()')
  .trim();
/* the slice ends at the setNodes call's `});` — its `)` closed the useCallback
   we removed, so the arrow function needs its own `}` appended */
const ARROW = body + '}';
/* sanity: the reconstructed arrow must be brace-balanced */
{
  let depth = 0;
  for (const c of ARROW) { if (c === '{') depth++; else if (c === '}') depth--; }
  assert('bd2.arrow-balanced', depth === 0,
    `extracted arrow fn is brace-balanced (final depth ${depth})`);
}
assert('bd2.helper-extracted',
  body.includes("if (selNodes.length < 2) return;") && body.includes('pushHistory()') && body.includes('setNodes('),
  'helper body lifted verbatim from App.tsx (gate + pushHistory + setNodes present; TS annotation stripped for the Node probe only)');

/* Run the EXACT body in a sandbox where nodesRef/pushHistory/setNodes are the
   recorders, injected through a factory. Written to a tmpdir scratch (never
   the repo root — the repo-root litter of the old probe style is what put
   FM-02 red). */
const T = tmpdir();
const scratch = mkdtempSync(join(T, 'bd-'));
const UNIT2 = join(scratch, 'unit2.mjs');
/* BUGFIX 2 (2026-10-23) — the helper now also reads `sel` (the pivot). Inject
   it as a factory parameter defaulting to the pivot id, so the factory call
   sites below can drive it. */
writeFileSync(UNIT2, `
export const makeReorder = (nodesRef, pushHistory, setNodes, sel, zOrderMode) => ${ARROW};
`);
const {makeReorder} = await import(UNIT2);

/* --- the recorder ------------------------------------------------------- */
let historyPushes = 0;
let setNodesCalls = 0;
const push = () => { historyPushes++; };
const setNodesRec = (updater) => {
  setNodesCalls++;
  globalThis.__nodes = updater(globalThis.__nodes);
};
let PIVOT = null;  // the test drives the pivot like the app drives `sel`
let MODE = 'wysiwyg';  // the test drives the display mode like the app drives `zOrderMode`
const reorderSelection = makeReorder({get current() { return globalThis.__nodes; }}, push, setNodesRec, () => PIVOT, () => MODE);

const n = (id, x, y, sel = false, z = undefined) => ({id, position: {x, y}, selected: sel, ...(z !== undefined ? {zIndex: z} : {})});
const reset = (nodes) => { globalThis.__nodes = nodes; historyPushes = 0; setNodesCalls = 0; };

/* T1: gate — below 2 selected, nothing happens */
reset([n('a', 0, 0, true), n('b', 100, 0, false), n('c', 200, 0, false)]);
reorderSelection('front');
assert('bd2.gate-below-two-selected',
  historyPushes === 0 && setNodesCalls === 0 && globalThis.__nodes[0].zIndex === undefined,
  'one selected: no pushHistory, no setNodes call, no zIndex written (the panel never shows the block, and the helper agrees)');

/* T2: bring to front — one push, band on the live max, array re-sorted.
   BUGFIX 2 (2026-10-23) — PIVOT semantics: ordered[0] (pivot; `sel`, or the
   first array member when no pivot) lands ON the bound, the rest descend.
   With PIVOT=null these tests exercise the no-pivot fallback: array order. */
reset([n('a', 0, 0, true, 0), n('b', 100, 0, true, 5), n('c', 200, 0, false, 9), n('d', 300, 0, false, 2)]);
reorderSelection('front');
const after = globalThis.__nodes;
assert('bd2.front-one-history-push',
  historyPushes === 1 && setNodesCalls === 1,
  `bringToFront = exactly ONE pushHistory + ONE setNodes (measured ${historyPushes}/${setNodesCalls}) — one gesture, one undo step`);
assert('bd2.front-band-on-live-max',
  after.find(n => n.id === 'a').zIndex === 9 && after.find(n => n.id === 'b').zIndex === 8,
  'the pivot (ordered[0] = a in the no-pivot fallback) lands ON the live max (9), the rest stacks contiguously below (8) — bounded, never max+1');
assert('bd2.front-others-untouched',
  after.find(n => n.id === 'c').zIndex === 9 && after.find(n => n.id === 'd').zIndex === 2,
  'unselected nodes keep their exact zIndex values');
assert('bd2.front-array-reordered',
  after.map(n => n.id).join(',') === 'd,b,a,c'
    && after.every((n, i) => i === 0 || after[i - 1].zIndex <= n.zIndex),
  'array re-sorted by zIndex monotone (d,b,a,c — the pivot a ties with c at 9 and keeps its stable original order); ' +
  'the array is the truth, not just the paint');

/* T3: send to back — band on the live min, pivot goes lowest */
reset([n('a', 0, 0, true, 5), n('b', 100, 0, true, 7), n('c', 200, 0, false, 3)]);
reorderSelection('back');
const back = globalThis.__nodes;
assert('bd2.back-band-on-live-min',
  back.find(n => n.id === 'a').zIndex === 3 && back.find(n => n.id === 'b').zIndex === 4
    && back.map(n => n.id).join(',') === 'a,c,b',
  'sendToBack: the pivot (a) lands ON the live min (3), b stacks above (4), ' +
  'array re-sorted a,c,b (the tied pair keeps its stable original order)');

/* T4: no drift — two clicks then "undo" (restore snapshot) then a second push
   changes nothing beyond the restored state */
reset([n('a', 0, 0, true, 0), n('b', 100, 0, true, 0), n('c', 200, 0, false, 0)]);
const snapshot0 = JSON.stringify(globalThis.__nodes);
reorderSelection('front');
const once = JSON.stringify(globalThis.__nodes);
reorderSelection('front');
const twice = JSON.stringify(globalThis.__nodes);
assert('bd2.second-click-idempotent-band',
  JSON.parse(once).find(n => n.id === 'b').zIndex === JSON.parse(twice).find(n => n.id === 'b').zIndex
    && JSON.parse(once).find(n => n.id === 'a').zIndex === JSON.parse(twice).find(n => n.id === 'a').zIndex,
  'a second bringToFront writes the SAME band (no unbounded climbing across clicks)');
globalThis.__nodes = JSON.parse(snapshot0);
reorderSelection('front');
assert('bd2.undo-then-click-reproduces',
  JSON.stringify(globalThis.__nodes) === once,
  'restore the pre-click snapshot ("undo"), click again: byte-identical result — the write is a pure function of state');

/* T5: undefined-zIndex nodes treated as 0 (the default the app had forever) */
reset([n('a', 0, 0, true), n('b', 100, 0, true), n('c', 200, 0, false)]);
reorderSelection('front');
const flat = globalThis.__nodes;
assert('bd2.undefined-z-index-treated-as-zero',
  flat.find(n => n.id === 'a').zIndex === 0 && flat.find(n => n.id === 'b').zIndex === -1
    && flat.find(n => n.id === 'c').zIndex === undefined,
  'a board with NO zIndex anywhere: max defaults to 0, pivot a lands ON it (0), b stacks below (-1); the untouched node stays ' +
  'undefined (never written) — first click on a legacy board works');

/* T6 (BUGFIX 2) — PIVOT: the last-clicked node takes the band extreme.
   Figma/draw.io semantics: with two overlapping nodes selected, the user
   shift-clicks the one they want moved; that node is `sel`. Send to back
   drops THE PIVOT to the bottom of the band; Bring to front lifts it to the
   top. (The array-order band of the first cut could never flip a pair.) */
PIVOT = 'a';
reset([n('a', 0, 0, true), n('b', 100, 0, true), n('c', 200, 0, false)]);
reorderSelection('back');
const pivotedBack = globalThis.__nodes;
assert('bd2.pivot-drops-to-bottom-on-back',
  pivotedBack.find(n => n.id === 'a').zIndex === 0 && pivotedBack.find(n => n.id === 'b').zIndex === 1,
  `pivot a + sendToBack: a lands ON the min (0), b stacks above (1) — the clicked node is the one that moves (z: ${pivotedBack.map(x => x.id + '=' + x.zIndex)})`);
PIVOT = 'a';
reset([n('a', 0, 0, true), n('b', 100, 0, true), n('c', 200, 0, false)]);
reorderSelection('front');
const pivotedFront = globalThis.__nodes;
assert('bd2.pivot-lifts-to-top-on-front',
  pivotedFront.find(n => n.id === 'a').zIndex === 0 && pivotedFront.find(n => n.id === 'b').zIndex === -1,
  `pivot a + bringToFront: a lands ON the max (0), b stacks below (-1) — the clicked node is the one that moves (z: ${pivotedFront.map(x => x.id + '=' + x.zIndex)})`);

rmSync(scratch, {recursive: true, force: true});

/* ===========================================================================
   PASS 3 — LIVE DOM on the dev server (CDP)
   =========================================================================== */
const APP_URL = process.env.BD_APP_URL || 'http://192.168.33.200:5200/';
console.log(`\nPASS 3 — live DOM on ${APP_URL}`);
try {
  const {createRequire} = await import('node:module');
  const require_ = createRequire(join('/home/harvey/projects/tech-goblin/package.json', 'noop.js'));
  const {chromium} = require_('playwright-core');

  /* probe board: three nodes, one edge, distinct colour keys on purpose */
  const board = {
    id: '', name: 'BD-PROBE',
    nodes: [
      {id: 'p1', type: 'goblin', position: {x: 0, y: 0}, selected: false,
       style: {width: 190, height: 95}, measured: {width: 190, height: 95},
       data: {shape: 'service', title: 'Probe 1', icon: 'server', colorKey: 'cyan'}},
      {id: 'p2', type: 'goblin', position: {x: 300, y: 0}, selected: false,
       style: {width: 190, height: 95}, measured: {width: 190, height: 95},
       data: {shape: 'service', title: 'Probe 2', icon: 'server', colorKey: 'amber'}},
      {id: 'p3', type: 'goblin', position: {x: 600, y: 0}, selected: false,
       style: {width: 190, height: 95}, measured: {width: 190, height: 95},
       data: {shape: 'service', title: 'Probe 3', icon: 'server', colorKey: 'violet'}},
    ],
    edges: [
      {id: 'e1', source: 'p1', target: 'p2', label: '', data: {}},
      {id: 'e2', source: 'p2', target: 'p3', label: '', data: {}},
    ],
  };

  const browser = await chromium.launch();
  const page = await browser.newPage({viewport: {width: 1600, height: 1000}});
  try {
    const r0 = await page.request.post(`${APP_URL}api/boards`, {data: {name: board.name}});
    const created = await r0.json();
    board.id = created.id;
    await page.request.put(`${APP_URL}api/boards/${board.id}`, {data: board});

    /* the guided tour overlay intercepts every pointer event — mark it seen
       through its own persistence key BEFORE the app boots (an addInitScript,
       not DOM surgery: removing React-owned nodes mid-tree crashes the app
       with an insertBefore NotFoundError) */
    await page.addInitScript(() => localStorage.setItem('diagram-studio:tour-seen', '1'));
    await page.goto(`${APP_URL}?board=${board.id}`, {waitUntil: 'networkidle'});
    await page.waitForSelector('.react-flow__node', {timeout: 15000});

    /* marquee-select all three nodes: left-drag on the empty pane (the app's
       Excalidraw-style navigation: selectionOnDrag + partial-overlap marquee) */
    const box = await page.locator('.react-flow__pane').first().boundingBox();
    await page.mouse.move(box.x + 100, box.y + 350);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width - 30, box.y + 650, {steps: 15});
    await page.waitForTimeout(120);
    await page.mouse.up();
    await page.waitForTimeout(300);

    const selCount = await page.locator('.multi-head').textContent().catch(() => null);
    assert('bd3.multi-block-open', !!selCount, `multi-head reads "${selCount}"`);

    /* ---- measured inventory ------------------------------------------ */
    const inv = await page.evaluate(() => {
      const q = (s, el = document) => [...el.querySelectorAll(s)];
      /* the panel's own static "Inspector" heading shares the .sec-label
         class — scope the inventory to the multi block by starting at its
         multi-head sibling */
      const head = q('.panel.right .multi-head')[0];
      const secs = [];
      for (let e = head?.nextElementSibling; e; e = e.nextElementSibling) {
        if (e.classList.contains('sec-label')) secs.push(e.textContent.trim());
      }
      const rows = q('.panel.right .multi-actions').map(row => ({
        n: row.children.length,
        lefts: [...row.children].map(b => Math.round(b.getBoundingClientRect().left * 10) / 10),
        tops: [...row.children].map(b => Math.round(b.getBoundingClientRect().top * 10) / 10),
        widths: [...row.children].map(b => Math.round(b.getBoundingClientRect().width * 10) / 10),
        icons: [...row.children].map(b => !!b.querySelector('svg')),
      }));
      const sw = q('.panel.right .swatch').map(s => {
        const r = s.getBoundingClientRect();
        return {w: Math.round(r.width * 10) / 10, h: Math.round(r.height * 10) / 10,
                on: s.classList.contains('on')};
      });
      const hints = q('.panel.right .hint').map(e => e.textContent.trim());
      const danger = q('.panel.right .multi-danger');
      const dangerColor = danger.length ? getComputedStyle(danger[0]).color : null;
      const mbtnCount = q('.panel.right .multi-actions .mbtn').length;
      return {secs, rows, swatches: sw, hints, dangerCount: danger.length, dangerColor, mbtnCount};
    });
    console.log('  live inventory:', JSON.stringify({secs: inv.secs, rows: inv.rows.map(r => r.n),
      swatches: inv.swatches.length, hints: inv.hints.length, danger: inv.dangerCount}, null, 1));

    assert('bd3.sections-live',
      inv.secs.length === 5
        && inv.secs[0] === 'Align' && inv.secs[1] === 'Distribute'
        && inv.secs[2] === 'Arrange' && inv.secs[3] === 'Color' && inv.secs[4] === 'Actions',
      `live section order: ${inv.secs.join(' → ')}`);

    assert('bd3.align-grid-3x2-geometry',
      inv.rows[0].n === 6 && inv.rows[0].tops[0] === inv.rows[0].tops[2]
        && inv.rows[0].lefts.filter((v, i, a) => a.indexOf(v) === i).length === 3
        && Math.abs(inv.rows[0].tops[3] - inv.rows[0].tops[0]) > 10,
      'align row: 6 buttons, 3 distinct column lefts, row 2 strictly below row 1 — measured rects, not grid arithmetic');
    assert('bd3.align-cells-equal',
      Math.max(...inv.rows[0].widths) - Math.min(...inv.rows[0].widths) <= 1,
      `align cells equal width within 1px (${Math.min(...inv.rows[0].widths)}–${Math.max(...inv.rows[0].widths)})`);
    assert('bd3.grid2-rows-two-equal',
      inv.rows[1].n === 2 && inv.rows[2].n === 2
        && Math.abs(inv.rows[1].widths[0] - inv.rows[1].widths[1]) <= 1
        && Math.abs(inv.rows[2].widths[0] - inv.rows[2].widths[1]) <= 1,
      'distribute + arrange rows: 2 buttons each, equal width within 1px (no dead space)');
    assert('bd3.all-rows-icon-buttons',
      inv.rows[0].icons.every(Boolean) && inv.rows[1].icons.every(Boolean) && inv.rows[2].icons.every(Boolean),
      'align/distribute/arrange rows are icon-only (svg in every cell)');
    assert('bd3.no-hint-live',
      inv.hints.length === 0,
      `zero .hint elements in the live panel (${inv.hints.length})`);
    assert('bd3.one-destructive-live',
      inv.dangerCount === 1 && inv.mbtnCount === 12,
      `exactly ONE multi-danger button of ${inv.mbtnCount} mbtns in the block ` +
      '(6 align + 2 distribute + 2 arrange + Duplicate + Delete)');
    const acc = await page.evaluate(() => {
      const d = document.querySelector('.panel.right .multi-danger');
      return d ? {color: getComputedStyle(d).color, border: getComputedStyle(d).borderColor,
                  accVar: getComputedStyle(document.documentElement).getPropertyValue('--acc').trim()} : null;
    });
    assert('bd3.danger-paints-accent-at-rest',
      !!acc && acc.color === rgbOf(acc.accVar) && acc.border === rgbOf(acc.accVar),
      `Delete computes to the theme accent at REST (color ${acc && acc.color} vs --acc ${acc && acc.accVar})`);
    assert('bd3.swatches-11-equal-cells',
      inv.swatches.length === 11
        && Math.max(...inv.swatches.map(s => s.w)) - Math.min(...inv.swatches.map(s => s.w)) <= 1,
      `11 swatch cells, equal widths within 1px (measured ${inv.swatches.length} cells)`);

    /* ---- Arrange writes zIndex, REALLY ------------------------------- */
    const before = await page.evaluate(() =>
      [...document.querySelectorAll('.react-flow__node')].map(n => ({
        id: n.getAttribute('data-id'), z: n.style.zIndex,
      })).sort((a, b) => a.id.localeCompare(b.id)));
    /* precise: the title attributes, never positional clicks */
    await page.locator('.panel.right button[title="Send to back"]').click();
    await page.waitForTimeout(250);
    const mid = await page.evaluate(() =>
      [...document.querySelectorAll('.react-flow__node')].map(n => ({
        id: n.getAttribute('data-id'), z: n.style.zIndex,
      })).sort((a, b) => a.id.localeCompare(b.id)));
    const zChanged = mid.some((n, i) => n.z !== before[i].z);
    assert('bd3.send-to-back-writes-z', zChanged,
      `clicking Send to back changed node z style (${JSON.stringify(before)} -> ${JSON.stringify(mid)})`);

    /* BUGFIX 2 (2026-10-23) — PIVOT CONSISTENCY: the band must put the PIVOT
       (the app's `sel`, the last-clicked node — read from the DOM: the node
       carrying both .selected and the app's own selection source) at the
       band's extreme. With the marquee selection we cannot know which node
       the user 'means', but we CAN assert the WRITE agrees with the app's own
       pivot state: read the pivot from the DOM (the last .selected node in
       RF's reported selection order is NOT exposed, so assert from the app
       side: the LOWEST z after send-to-back must belong to the pivot). The
       app exposes no pivot accessor, so this probe asserts the weaker but
       still real contract: DISTINCT z values across the selection (a band,
       not a flat write), i.e. the relative order inside the selection CAN now
       change — which the pre-fix code could never produce. */
    const bandZs = [...new Set(mid.map(n => n.z))];
    assert('bd3.band-is-not-flat',
      bandZs.length === mid.length,
      `the selection's z write is a contiguous distinct band (${JSON.stringify(mid.map(n => n.z))}) — within-selection order is now writable at all`);

    /* undo once: one gesture = one history entry (the real invariant).
       BUGFIX (2026-10-23) — reorderSelection now clears `selected` in the same
       write (RF12 basic mode paints selected nodes at rawZ+1000, which made the
       bands invisible/inverted), so the DOM style z BEFORE the click carried the
       +1000 selection elevation and can no longer be the undo target. Compare
       RAW document state instead: nodes' stored zIndex (undefined before, the
       written band after, undefined again after undo) and the selected flags. */
    await page.keyboard.press('Control+z');
    await page.waitForTimeout(250);
    const undone = await page.evaluate(() =>
      [...document.querySelectorAll('.react-flow__node')].map(n => ({
        id: n.getAttribute('data-id'), z: n.style.zIndex,
      })).sort((a, b) => a.id.localeCompare(b.id)));
    const undoneSel = await page.evaluate(() =>
      [...document.querySelectorAll('.react-flow__node.selected')].length);
    assert('bd3.undo-restores-exactly',
      undone.every(n => n.z === '' || n.z === '0') && undoneSel === 0,
      `one undo returns every node to the raw z baseline (${JSON.stringify(undone)}) and clears the selection (${undoneSel} rings) — one gesture = one history entry`);
    /* and a second undo must NOT change anything more */
    await page.keyboard.press('Control+z');
    await page.waitForTimeout(250);
    const undone2 = await page.evaluate(() =>
      [...document.querySelectorAll('.react-flow__node')].map(n => ({
        id: n.getAttribute('data-id'), z: n.style.zIndex,
      })).sort((a, b) => a.id.localeCompare(b.id)));
    assert('bd3.second-undo-noop-on-z',
      JSON.stringify(undone2) === JSON.stringify(undone),
      'a SECOND undo changes nothing further (no phantom history entry from the click)');

    /* shared-key ring: pick one swatch for the whole batch, then the SAME key
       must light (the shared-key round trip: write -> read-back).
       2026-10-23 — reorderSelection now CLEARS the selection (the RF12 basic
       +1000 paint bug), so the batch selection from the marquee is gone by the
       time we get here. Re-select the three nodes first. */
    await page.mouse.move(box.x + 100, box.y + 350);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width - 30, box.y + 650, {steps: 15});
    await page.mouse.up();
    await page.waitForTimeout(300);
    await page.locator('.panel.right .swatch[data-color-key="red"]').click();
    await page.waitForTimeout(250);
    const ring = await page.evaluate(() => ({
      on: [...document.querySelectorAll('.panel.right .swatch.on')].map(s => s.dataset.colorKey),
    }));
    assert('bd3.picked-swatch-lights-ring',
      ring.on.length === 1 && ring.on[0] === 'red',
      `after a bulk pick the picked key lights (on=[${ring.on}]) — the ring is wired to the batch state`);

    /* ---- single-node branch does NOT regress -------------------------- */
    /* deselect (click empty canvas below the row), then select ONE node */
    const flowBox = await page.locator('.react-flow').first().boundingBox();
    await page.mouse.click(flowBox.x + 300, flowBox.y + 700);
    await page.waitForTimeout(200);
    await page.locator('.react-flow__node[data-id="p1"]').click();
    await page.waitForTimeout(300);
    const single = await page.evaluate(() => ({
      multiHead: !!document.querySelector('.multi-head'),
      secLabels: [...document.querySelectorAll('.panel.right .sec-label')].map(e => e.textContent.trim()),
      dataSections: [...document.querySelectorAll('.panel.right [data-section]')].map(e => e.dataset.section),
      danger: document.querySelectorAll('.panel.right .multi-danger').length,
      reorderUi: !!document.querySelector('.panel.right button[title="Bring to front"]'),
    }));
    assert('bd3.single-node-no-multi-block',
      !single.multiHead && single.danger === 0 && !single.reorderUi,
      'one node selected: no multi-head, no destructive button, no Arrange buttons');
    assert('bd3.single-node-section-list-intact',
      single.dataSections.length >= 1 && !single.dataSections.includes(undefined),
      `single-node data-section list renders (${single.dataSections.join(',') || 'EMPTY'}) — the section-list contract held`);
  } finally {
    /* archive the probe board through the app's own DELETE (AS-7 archive, not
       unlink) — the harness's own file, never Harvey's boards */
    if (board.id) {
      await page.request.delete(`${APP_URL}api/boards/${board.id}`).catch(() => {});
    }
    await browser.close();
  }
} catch (e) {
  assert('bd3.live-pass-ran', false, `live pass could not run: ${String(e).slice(0, 300)}`);
}

/* rgb helper for the computed-colour comparison */
function rgbOf(hex) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return hex;
  const v = m[1];
  const [r, g, b] = [0, 2, 4].map(i => parseInt(v.slice(i, i + 2), 16));
  return `rgb(${r}, ${g}, ${b})`;
}

const fails = results.filter(r => !r.pass);
console.log(`\nround-bd-multi-panel: ${results.length - fails.length}/${results.length} assertions pass`);
process.exit(fails.length ? 1 : 0);
