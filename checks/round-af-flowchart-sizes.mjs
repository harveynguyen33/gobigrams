#!/usr/bin/env node
/**
 * ROUND AF harness — one default size for every flowchart shape.
 *
 * No browser, no DOM, no CDP. Everything below is either
 *   (1) EXECUTED against the real `src/presets.ts` — bundled with the project's
 *       own esbuild and imported, so `LIBRARY` and the `fc()` rows are the
 *       SHIPPED objects, not a transcription of them, or
 *   (2) EXECUTED against the shipped `@xyflow/system` resize arithmetic, whose
 *       function sources are sliced VERBATIM out of its bundle and compiled, so
 *       the floor numbers are the library's own maths, or
 *   (3) ARITHMETIC on the frame geometry as written in `src/shapes.tsx`.
 *
 * Nothing here is a painted measurement — that is the orchestrator's live pass.
 *
 * COMMENTS ARE BLANKED BEFORE EVERY COUNT (blanking keeps byte offsets, so any
 * reported line number stays true), because this repo's docblocks quote the
 * constructs they describe and a raw count would read a correct tree as a defect.
 */
import {readFileSync, writeFileSync, rmSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {join} from 'node:path';

const ROOT = '/home/harvey/projects/tech-goblin/lab/diagram-studio';
const PRESETS_RAW = readFileSync(`${ROOT}/src/presets.ts`, 'utf8');
const SHAPES_RAW = readFileSync(`${ROOT}/src/shapes.tsx`, 'utf8');
const NODE_RAW = readFileSync(`${ROOT}/src/DiagramNode.tsx`, 'utf8');
const STYLES_RAW = readFileSync(`${ROOT}/src/styles.css`, 'utf8');
const APP_RAW = readFileSync(`${ROOT}/src/App.tsx`, 'utf8');

const blank = m => m.replace(/[^\n]/g, ' ');
const stripTs = s => s
  .replace(/\/\*[\s\S]*?\*\//g, blank)
  .replace(/(^|[^:])\/\/[^\n]*/g, (m, p1) => p1 + ' '.repeat(m.length - p1.length));
const PRESETS = stripTs(PRESETS_RAW);
const SHAPES = stripTs(SHAPES_RAW);
const NODE = stripTs(NODE_RAW);
const APP = stripTs(APP_RAW);

const results = [];
const assert = (id, pass, detail = '') => {
  results.push({id, pass: !!pass, detail});
  console.log(`  ${pass ? 'PASS' : 'FAIL'}  ${id}  —  ${detail}`);
};

/* ===========================================================================
   0 — EXECUTE THE SHIPPED PALETTE.
   presets.ts is bundled with the project's own esbuild and imported, so the
   `size` values checked below are the shipped objects rather than a reading of
   the source text. A bundle written to /tmp cannot resolve its own externals, so
   entry and output live INSIDE ROOT and are removed at the end.
=========================================================================== */
console.log('='.repeat(78));
console.log('AF-0 — the shipped library, EXECUTED');
console.log('='.repeat(78));

const ENTRY = join(ROOT, '.af-entry.ts');
const OUT = join(ROOT, '.af-out.mjs');
writeFileSync(ENTRY, `export {LIBRARY, FLOWCHART_PRESET} from './src/presets';\n`);
writeFileSync(OUT, execFileSync(join(ROOT, 'node_modules/.bin/esbuild'),
  [ENTRY, '--bundle', '--platform=node', '--format=esm', '--log-level=error',
    '--external:react', '--external:react-dom', '--external:react/jsx-runtime', '--external:@xyflow/react'],
  {encoding: 'utf8'}));
const {LIBRARY} = await import(`${OUT}?t=${Date.now()}`);
console.log(`  LIBRARY EXECUTED: ${LIBRARY.length} items`);

/* THE SET IS ENUMERATED, NEVER HARD-CODED, in BOTH directions:
     - from the SHIPPED palette: every item whose `types` includes 'flowchart'
       and whose shape is a drawing (not a container or an annotation);
     - from `FLOWCHART_EXTRA_SHAPES` in shapes.tsx, which is the union the two
       preset `extraShapes` fields reference and the round-AD additions land in.
   A seventeenth flowchart shape added later is therefore caught by both without
   this file being edited. */
const RESIZABLE_DRAWINGS = (() => {
  const block = SHAPES.slice(SHAPES.indexOf('export const RESIZABLE'), SHAPES.indexOf('const POSTIT'));
  return new Set([...block.matchAll(/'([^']+)'/g)].map(m => m[1]));
})();
const FLOW_ITEMS = LIBRARY.filter(p =>
  p.types.includes('flowchart') && p.shape !== 'group' && p.shape !== 'note');
const FC_ROWS = LIBRARY.filter(p => p.label !== 'Lane' && p.label !== 'Note'
  && p.hint.includes('·') && p.types.length === 1 && p.types[0] === 'flowchart');
console.log(`  flowchart drawing entries (types includes flowchart, not group/note): ${FLOW_ITEMS.length}`);
console.log(`  fc() palette rows (flowchart-only, not Lane/Note): ${FC_ROWS.length}`);

const SIZES = FLOW_ITEMS.map(p => ({label: p.label, shape: p.shape, size: p.size ?? null}));
for (const s of SIZES) {
  const sz = s.size;
  console.log(`  ${s.label.padEnd(20)} shape=${s.shape.padEnd(16)} ` +
    `${sz ? `${sz.width}x${sz.height}  ratio ${(sz.width / sz.height).toFixed(4)}` : 'ABSENT (content-sized)'}`);
}

/* THE CENTRAL ASSERTION — EVERY flowchart entry declares a size, at ratio 2.0.
   Enumerated: this reads whatever is in the shipped library, so adding a
   seventeenth entry with no size fails here without touching this file. */
const SIZED = SIZES.filter(s => s.size !== null);
const RATIO_OK = SIZED.filter(s => Math.abs(s.size.width / s.size.height - 2) < 1e-6);
const UNSIZED = SIZES.filter(s => s.size === null);
const WRONG_RATIO = SIZED.filter(s => Math.abs(s.size.width / s.size.height - 2) >= 1e-6);

/* THE LIVENESS FLOOR — the sweep must cover a real set, or every zero below is
   a vacuous pass over an empty list. */
assert('af1.the-enumeration-found-the-whole-flowchart-set',
  SIZES.length >= 16 && FC_ROWS.length >= 15
    && ['Terminal', 'Process', 'Decision', 'Input / Output', 'On-page connector'].every(l => SIZES.some(s => s.label === l)),
  `${SIZES.length} flowchart drawing entries enumerated from the SHIPPED library and ${FC_ROWS.length} fc() palette rows — the set\n` +
  '      cannot be empty, and it contains the originals by name, so a zero below is a real zero.');

assert('af1.every-flowchart-entry-declares-a-size',
  UNSIZED.length === 0,
  UNSIZED.length
    ? `${UNSIZED.length} entry/entries still have NO size, so they fall to the ".node { min-width: 190px }" CSS floor at auto height: ` +
      UNSIZED.map(s => s.label).join(', ')
    : `all ${SIZES.length} carry an explicit size, so none can fall back to the 190px CSS floor and render as a sliver. ` +
      'Before this round THIRTEEN had none.');

assert('af1.every-declared-size-is-exactly-ratio-2.0',
  WRONG_RATIO.length === 0,
  WRONG_RATIO.length
    ? `${WRONG_RATIO.length} entry/entries are off ratio 2.0, i.e. their silhouette is STRETCHED by the frame: ` +
      WRONG_RATIO.map(s => `${s.label} ${s.size.width}x${s.size.height}=${(s.size.width / s.size.height).toFixed(3)}`).join('; ')
    : `all ${SIZED.length} sizes are exactly 2.0. The frame's viewBox is 200x100 with a stretch fit, so 2.0 is the ` +
      'one ratio at which every silhouette paints as drawn — the palette held 1.50, 1.56 and 1.00 before this round.');

assert('af1.the-flowchart-entries-all-agree-on-ONE-size',
  new Set(SIZED.map(s => `${s.size.width}x${s.size.height}`)).size === 1,
  `${new Set(SIZED.map(s => `${s.size.width}x${s.size.height}`)).size} distinct size(s) across the set: ` +
  `[${[...new Set(SIZED.map(s => `${s.size.width}x${s.size.height}`))].join(', ')}]. Uniform is the point — Harvey's report was that ONE shape ` +
  'reads as bigger than the others.');

/* ===========================================================================
   1 — THE SIX ROUND-AD ADDITIONS ARE INCLUDED.
   A size added for the original ten but not the six additions is the obvious
   half-fix, so the two lists are compared as SETS.
=========================================================================== */
console.log('\n' + '='.repeat(78));
console.log('AF-2 — the six ROUND AD additions, half-fixed or fixed');
console.log('='.repeat(78));

const ROUND_AD = ['Off-page connector', 'Manual input', 'Display', 'Stored data', 'Loop limit', 'Internal storage'];
const SHAPE_BY_LABEL = new Map(SIZES.map(s => [s.label, s]));
const adRows = ROUND_AD.map(l => ({label: l, row: SHAPE_BY_LABEL.get(l)}));
for (const r of adRows) {
  console.log(`  ${r.label.padEnd(20)} ${r.row ? (r.row.size ? `${r.row.size.width}x${r.row.size.height}` : 'NO SIZE') : 'NOT IN THE PALETTE'}`);
}
assert('af2.all-six-ROUND-AD-additions-carry-the-same-size',
  adRows.every(r => r.row && r.row.size && Math.abs(r.row.size.width / r.row.size.height - 2) < 1e-6),
  `${adRows.filter(r => r.row?.size).length}/6 additions are sized at ratio 2.0. A size added for the original ten and not the new ` +
  'six is the half-fix this assertion exists for.');

assert('af2.the-original-ten-are-sized-too',
  ['Terminal', 'Process', 'Decision', 'Input / Output', 'Document', 'Predefined process',
    'Preparation', 'Manual operation', 'Delay', 'On-page connector']
    .every(l => SHAPE_BY_LABEL.get(l)?.size),
  'all ten originals carry a size as well, so neither half of the set was left behind.');

/* FLOWCHART_EXTRA_SHAPES (shapes.tsx) is the union the two preset `extraShapes`
   fields reference. It is a SHAPE-id list, so its length is the number of
   additions the round-AD wiring claims; the palette rows are the other side. */
const EXTRA_BLOCK = (SHAPES.match(/FLOWCHART_EXTRA_SHAPES[^=]*=\s*\[([\s\S]*?)\]/) ?? [])[1] ?? '';
const EXTRA_IDS = [...EXTRA_BLOCK.matchAll(/'([^']+)'/g)].map(m => m[1]);
console.log(`  FLOWCHART_EXTRA_SHAPES ids (${EXTRA_IDS.length}): [${EXTRA_IDS.join(', ')}]`);
assert('af2.the-extra-shapes-union-and-the-palette-carry-the-same-set',
  EXTRA_IDS.length === 16 && EXTRA_IDS.every(id => SIZES.some(s => s.shape === id)),
  `FLOWCHART_EXTRA_SHAPES carries ${EXTRA_IDS.length} shape ids and every one of them resolves to a sized palette row, so the ` +
  'shape union and the size table cannot disagree about what the flowchart set is.');

/* ===========================================================================
   2 — THE FIX REACHES THE INSERT PATH, NOT JUST THE PALETTE DATA.
   `addNodeByLabel` is the one function every drag, drop, search-insert and
   favourite-insert funnels through. If it still resolves a flowchart item to
   `null`, the palette data is decorated and the canvas is unchanged.
=========================================================================== */
console.log('\n' + '='.repeat(78));
console.log('AF-3 — the INSERT path resolves the size');
console.log('='.repeat(78));

const ADD_FN = (() => {
  const start = APP.indexOf('const addNodeByLabel = ');
  if (start < 0) return '';
  const end = APP.indexOf('const insertFromSearch', start);
  return end > start ? APP.slice(start, end) : APP.slice(start, start + 4000);
})();
console.log(`  addNodeByLabel body length: ${ADD_FN.length} chars`);
const sizeLine = (ADD_FN.match(/const size =[\s\S]*?;/) ?? [''])[0].replace(/\s+/g, ' ').trim();
console.log(`  sizing path: ${sizeLine}`);

/* The fallback chain is asserted from the SOURCE (there is no browser to run it
   in), and then the resolution is RE-EXECUTED against the shipped item, which is
   the part the source read cannot tell us. */
const readsItemSize = /const size = item\.size/.test(ADD_FN);
const writesStyle = /style: \{width: size\.width, height: size\.height\}/.test(ADD_FN.replace(/\s+/g, ' '));
console.log(`  reads item.size: ${readsItemSize}   writes it into node.style: ${writesStyle}`);

const terminalItem = LIBRARY.find(p => p.label === 'Terminal');
const insertResolution = (item) => {
  const shape = item.shape;
  return item.size ?? (shape === 'group'
    ? {width: 320, height: 200}
    : shape === 'note'
      ? {width: 200, height: 90}
      : null);
};
const resolved = FLOW_ITEMS.map(p => ({label: p.label, size: insertResolution(p)}));
const unresolved = resolved.filter(r => r.size === null);
console.log(`  re-executing the chain over the shipped items: ${resolved.length - unresolved.length}/${resolved.length} resolve to a size`);
for (const r of resolved.slice(0, 4)) console.log(`    ${r.label.padEnd(20)} -> ${r.size ? `${r.size.width}x${r.size.height}` : 'NULL'}`);

assert('af3.addNodeByLabel-sizes-from-item-size-and-writes-it-to-node-style',
  readsItemSize && writesStyle && ADD_FN.length > 400,
  'the sizing line is `item.size ?? (group / note / null)` and the resolved box is written to `style: {width, height}`, so a ' +
  'flowchart item no longer reaches the `null` branch. The slice is length-checked so it cannot pass on an empty body.');

assert('af3.every-flowchart-item-resolves-to-the-one-size-at-the-INSERT-path',
  unresolved.length === 0
    && resolved.every(r => `${r.size.width}x${r.size.height}` === `${SIZED[0].size.width}x${SIZED[0].size.height}`),
  `re-running the SHIPPED chain over the SHIPPED items: all ${resolved.length} resolve to ` +
  `${SIZED[0].size.width}x${SIZED[0].size.height}. The palette data alone would not prove this — a null here is the sliver bug.`);

/* ===========================================================================
   3 — THE TEMPLATE SEEDS AGREE WITH THE PALETTE.
   A chart seeded from any flowchart template is the same shape a user drags out
   of the panel, so the two defaults must be one number.

   RE-ANCHORED (ROUND 4, ITEM 4) — NOT WEAKENED, and the reason is recorded. This
   probe used to read ONE template block, `flowchartApprovalTemplate`, which
   ROUND 4 deleted (Harvey: "à ngoài ra xoá flowchart template Approve nhé"). Its
   predicates were then true over an EMPTY list — "all 0 flowchart seeds route
   through the constant" is the vacuous pass the whole file exists to avoid. The
   claim is unchanged; the SOURCE is now every `flowchart*Template` block the
   family ships, so the sweep covers all three templates and the liveness floor
   is the family's real seed count (measured: 48).
=========================================================================== */
console.log('\n' + '='.repeat(78));
console.log('AF-4 — seed-from-template == drag-from-panel');
console.log('='.repeat(78));

const TEMPLATE_BLOCKS = [...PRESETS.matchAll(/const flowchart\w*Template: TemplateSpec = \{[\s\S]*?\n\};/g)].map(m => m[0]);
const SEED_NODES = TEMPLATE_BLOCKS.flatMap(block =>
  [...block.matchAll(/flowNode\('([^']+)',\s*'([^']+)'[^\n]*/g)].map(m => ({id: m[1], line: m[0].replace(/\s+/g, ' ')})));
console.log(`  flowchart template blocks: ${TEMPLATE_BLOCKS.length}; flowNode seeds across them: ${SEED_NODES.length}`);
const seedSizes = SEED_NODES.map(n => {
  if (/FLOWCHART_NODE_SIZE/.test(n.line)) return {id: n.id, via: 'constant'};
  const m = /\{width:\s*(\d+),\s*height:\s*(\d+)\}/.exec(n.line);
  return {id: n.id, via: m ? `${m[1]}x${m[2]}` : 'NO SIZE'};
});
const offConstant = seedSizes.filter(s => s.via !== 'constant');
console.log(`  seeds NOT routed through the constant: ${offConstant.length}${offConstant.length ? ` [${offConstant.map(s => `${s.id}=${s.via}`).join(', ')}]` : ''}`);

const seededTerminators = SEED_NODES.filter(n => n.line.includes("'terminator'"));
console.log(`  terminator seeds: ${seededTerminators.length} across ${TEMPLATE_BLOCKS.length} templates`);

assert('af4.every-flowchart-seed-in-the-template-carries-the-shared-constant',
  TEMPLATE_BLOCKS.length === 3 && seedSizes.length >= 48 && seedSizes.every(s => s.via === 'constant'),
  `all ${seedSizes.length} flowchart seeds across the ${TEMPLATE_BLOCKS.length} shipped templates route through FLOWCHART_NODE_SIZE rather than a literal, ` +
  'so a seeded chart cannot drift from a dragged one — the two terminators used to carry 270x180 and the two connectors 84x84 while the palette said the same. ' +
  'Re-anchored this round: the probe used to read the deleted `approval` block alone, where it passed over an empty list.');

assert('af4.the-template-s-terminators-agree-with-the-palette-default',
  seededTerminators.length >= 6
    && seededTerminators.every(n => /FLOWCHART_NODE_SIZE/.test(n.line)),
  `${seededTerminators.length} terminator seeds (2 per template x ${TEMPLATE_BLOCKS.length}), each via the shared constant, whose value is the palette default ` +
  `${SIZED[0].size.width}x${SIZED[0].size.height} — a seeded flowchart and a dragged one now agree.`);

/* The constant must be DECLARED ONCE and be the palette's value, or the two
   sides can be "in agreement" by both being wrong. */
const CONST_DECLS = [...(PRESETS.match(/FLOWCHART_NODE_SIZE\s*=\s*\{[^}]*\}/g) ?? [])];
const CONST_USE = [...PRESETS.matchAll(/FLOWCHART_NODE_SIZE/g)].length;
console.log(`  FLOWCHART_NODE_SIZE: ${CONST_DECLS.length} declaration(s), ${CONST_USE} references total (16 palette rows + ${SEED_NODES.length} template seeds + the declaration)`);
assert('af4.the-shared-size-is-declared-once-and-used-by-every-row',
  CONST_DECLS.length === 1 && CONST_USE === 16 + SEED_NODES.length + 1,
  `one declaration (\`${CONST_DECLS[0]?.replace(/\s+/g, ' ')}\`) and ${CONST_USE} references — the 16 palette rows, the ${SEED_NODES.length} template seeds and ` +
  'the declaration itself. Pinned to the measured number with its parts named (it read 27 when only the deleted 10-seed template was counted), so a template ' +
  'that stops using the constant has to change this deliberately. One number, so the palette, the templates and a future addition cannot disagree.');

/* ===========================================================================
   4 — THE FLOOR IS UNCHANGED, AND THE CHOSEN SIZE CLEARS IT.
   The floor is asserted from BOTH sides (the constants and the CSS rule) and the
   resizer arithmetic is EXECUTED, because "does 140 snap?" is a question about
   the library's maths, not about the source text.
=========================================================================== */
console.log('\n' + '='.repeat(78));
console.log('AF-5 — the resizer floor: unchanged, and honoured by the new size');
console.log('='.repeat(78));

const CONSTS = {};
for (const m of NODE.matchAll(/(?:export )?const (CSS_CONTENT_MIN_W|NODE_MIN_W|NODE_MIN_H|FLOOR_SLACK_PX|CONTENT_MIN_H)\s*=\s*([^;]+);/g)) {
  CONSTS[m[1]] = m[2].trim();
}
const CSS_MINW = (/^(\d+)$/.exec(CONSTS.CSS_CONTENT_MIN_W) ?? [])[1];
/* ANCHORED ON THE `.node` RULE ITSELF — a bare search for the first `min-width`
   in the sheet reads a different rule entirely. */
const nodeRuleBlock = (STYLES_RAW.match(/(?:^|\n)\.node \{[^}]*\}/) ?? [''])[0];
const nodeCssMinW = (/min-width:\s*(\d+)px/.exec(nodeRuleBlock) ?? [])[1];
console.log(`  DiagramNode consts: CSS_CONTENT_MIN_W=${CONSTS.CSS_CONTENT_MIN_W} FLOOR_SLACK_PX=${CONSTS.FLOOR_SLACK_PX} CONTENT_MIN_H=${CONSTS.CONTENT_MIN_H}`);
console.log(`  derived: NODE_MIN_W=${+CSS_MINW + +CONSTS.FLOOR_SLACK_PX}  NODE_MIN_H=${+CONSTS.CONTENT_MIN_H + +CONSTS.FLOOR_SLACK_PX}   [rule found: ${nodeRuleBlock ? 'yes' : 'NO'}]`);
console.log(`  .node { min-width } in styles.css: ${nodeCssMinW}px`);

const FLOOR_W = +CSS_MINW + +CONSTS.FLOOR_SLACK_PX;
const FLOOR_H = +CONSTS.CONTENT_MIN_H + +CONSTS.FLOOR_SLACK_PX;
assert('af5.the-resizer-floor-is-unchanged-200x141-from-a-190px-css-floor',
  CSS_MINW === '190' && +CONSTS.FLOOR_SLACK_PX === 10 && +nodeCssMinW === 190
    && FLOOR_W === 200 && FLOOR_H === 141,
  `the two constants and the CSS rule still read 190 + 10 = 200 wide and 131 + 10 = 141 tall. This round moves NO floor: it exists ` +
  'so content fits, and moving it is a different decision.');

const CHOSEN = {width: SIZED[0].size.width, height: SIZED[0].size.height};
console.log(`  chosen size: ${CHOSEN.width}x${CHOSEN.height}  (floor ${FLOOR_W}x${FLOOR_H})`);
assert('af5.the-chosen-size-clears-the-floor-in-BOTH-axes',
  CHOSEN.width >= FLOOR_W && CHOSEN.height >= FLOOR_H,
  `${CHOSEN.width} >= ${FLOOR_W} and ${CHOSEN.height} >= ${FLOOR_H} with ${CHOSEN.height - FLOOR_H}px of headroom on the tight axis. ` +
  'The approved 280x140 would have been 1px UNDER the 141 height floor — see the executed arithmetic below for what that does.');

/* ---- THE EXECUTED ARITHMETIC. The function sources are sliced VERBATIM out of
   the shipped @xyflow/system bundle and compiled, so these are the library's own
   numbers rather than a re-implementation of its formula. No browser. ---- */
const SYS = readFileSync(`${ROOT}/node_modules/@xyflow/system/dist/esm/index.mjs`, 'utf8');
const grab = (name) => {
  const start = SYS.indexOf(`function ${name}(`);
  if (start < 0) return null;
  const i = SYS.indexOf('{', start);
  let depth = 0;
  for (let j = i; j < SYS.length; j++) {
    if (SYS[j] === '{') depth++;
    else if (SYS[j] === '}') { depth--; if (depth === 0) return SYS.slice(start, j + 1); }
  }
  return null;
};
const FN_NAMES = ['getControlDirection', 'getLowerExtentClamp', 'getUpperExtentClamp', 'getSizeClamp', 'getDimensionsAfterResize', 'xor'];
const FN_SRC = FN_NAMES.map(grab);
const HAVE_ARITHMETIC = FN_SRC.every(s => s && s.length > 20);
assert('af5.the-shipped-resize-arithmetic-was-actually-loaded',
  HAVE_ARITHMETIC && /getSizeClamp/.test(FN_SRC[3] ?? '') && /max\(0, minSize - size/.test(FN_SRC[3] ?? ''),
  HAVE_ARITHMETIC
    ? `the six function sources were sliced out of @xyflow/system and compiled (getSizeClamp reads ` +
      `${(FN_SRC[3] ?? '').replace(/\s+/g, ' ').trim()}` + ') — so the drag results below are the library\u2019s own maths.'
    : 'the function sources could NOT be sliced out of the installed @xyflow/system, so the drag arithmetic below is unverified.');

const {getDimensionsAfterResize, getControlDirection} = HAVE_ARITHMETIC
  ? new Function(`${FN_SRC.join('\n')}\nreturn {getDimensionsAfterResize, getControlDirection};`)()
  : {};
const BOUNDS = {minWidth: FLOOR_W, minHeight: FLOOR_H, maxWidth: Number.MAX_VALUE, maxHeight: Number.MAX_VALUE};
/* Returns the library's own `{width, height, x, y}` unchanged, so every reader
   below must use those names. A partially-normalised result silently yields
   `undefined` for whichever axis was renamed, and a chain of drags then becomes
   NaN rather than failing loudly. */
const drag = (w, h, pos, dx, dy) => getDimensionsAfterResize(
  {x: 0, y: 0, width: w, height: h, pointerX: 1000, pointerY: 1000, aspectRatio: w / h},
  getControlDirection(pos), {xSnapped: 1000 + dx, ySnapped: 1000 + dy},
  BOUNDS, false, [0, 0], undefined, undefined,
);

/* (a) THE 140-TALL CASE, repeated: each result fed back as the next start, which
   is what `onEnd` persists into node.style. */
const collapse = (h, w = 282) => {
  const h0 = h;
  let cur = {w, h};
  for (let i = 0; i < 6; i++) {
    const o = drag(cur.w, cur.h, 'right', 1, 0);
    cur = {w: o.width, h: o.height};
  }
  return {from: h0, to: cur.h};
};
/* The rejected size is 282x140 — the approved 280x140 at ratio 2.0, plus the
   width the floor would force if it were respected. The chosen size is whatever
   the palette actually declares, so this check follows the fix rather than a
   literal. */
const at140 = collapse(140);
const atChosenH = collapse(CHOSEN.height, CHOSEN.width);
console.log(`  6x (right-grip +1px) from height 140 -> ${at140.to}`);
console.log(`  6x (right-grip +1px) from height ${CHOSEN.height} -> ${atChosenH.to}`);

assert('af5.a-140-tall-node-IS-below-the-floor-and-the-first-HORIZONTAL-drag-eats-it',
  HAVE_ARITHMETIC && at140.to < 140 && drag(282, 140, 'right', 1, 0).height < 141,
  HAVE_ARITHMETIC
    ? `executed: one +1px horizontal drag on a 140-tall node returns height ${drag(282, 140, 'right', 1, 0).height}, and six of them ` +
      `walk it to ${at140.to} — the clamp overshoots DOWN instead of lifting the node UP, and each drag re-reads the height the previous one ` +
      'ate. This is why the approved 280x140 was NOT shipped.'
    : 'unverified — the arithmetic could not be loaded.');

assert('af5.the-chosen-height-is-INERT-under-the-same-drag',
  HAVE_ARITHMETIC && atChosenH.to === CHOSEN.height && drag(CHOSEN.width, CHOSEN.height, 'right', 1, 0).height === CHOSEN.height,
  HAVE_ARITHMETIC
    ? `executed: the same six drags from ${CHOSEN.height} leave the height at ${atChosenH.to}, and a horizontal drag on the chosen ` +
      `${CHOSEN.width}x${CHOSEN.height} returns ${CHOSEN.height} — the clamp is 0, so the resizer neither shrinks nor snaps the node.`
    : 'unverified — the arithmetic could not be loaded.');

/* (b) THE FULL SWEEP: every control, a spread of deltas. A violation is a result
   below the floor, or a dimension moving on a control that does not own that
   axis (the horizontal-grip symptom, stated generally). */
const CONTROLS = ['bottom-right', 'top-left', 'bottom-left', 'top-right', 'right', 'left', 'bottom', 'top'];
const DELTAS = [-200, -40, -5, -1, 1, 5, 40, 200];
const sweep = (W, H) => {
  const bad = [];
  for (const pos of CONTROLS) {
    for (const d of DELTAS) {
      const moves = pos.length <= 5 ? [[d, 0], [0, d]] : [[d, d], [d, -d]];
      for (const [dx, dy] of moves) {
        const r = drag(W, H, pos, dx, dy);
        const floorBreach = r.width < FLOOR_W || r.height < FLOOR_H;
        const cross = ((pos === 'right' || pos === 'left') && r.height !== H)
          || ((pos === 'bottom' || pos === 'top') && r.width !== W);
        if (floorBreach || cross) bad.push({pos, dx, dy, r});
      }
    }
  }
  return bad;
};
const badChosen = HAVE_ARITHMETIC ? sweep(CHOSEN.width, CHOSEN.height) : [];
const bad280 = HAVE_ARITHMETIC ? sweep(282, 140) : [];
console.log(`  sweep over ${CONTROLS.length} controls x ${DELTAS.length} deltas`);
console.log(`    at ${CHOSEN.width}x${CHOSEN.height}: ${badChosen.length} violation(s)`);
console.log(`    at 282x140         : ${bad280.length} violation(s)`);
assert('af5.the-chosen-size-passes-the-whole-drag-sweep-and-280x140-does-not',
  HAVE_ARITHMETIC && badChosen.length === 0 && bad280.length > 0,
  HAVE_ARITHMETIC
    ? `every control at every delta leaves ${CHOSEN.width}x${CHOSEN.height} at or above the floor and moves only its own axis (${badChosen.length} ` +
      `violations), while the same sweep at 282x140 produces ${bad280.length} — all of them the height falling below 141. The sweep's own ` +
      'nonzero result on the rejected size is what makes the zero on the chosen one mean something.'
    : 'unverified — the arithmetic could not be loaded.');

/* ===========================================================================
   5 — THE FRAME IS UNTOUCHED, AND THE TONER GATE.
   The silhouettes are correct; this is a SIZING round. If the viewBox or the
   stretch fit moved, every ratio above would be measured against a different
   drawing and the whole fix would be invalidated.
=========================================================================== */
console.log('\n' + '='.repeat(78));
console.log('AF-6 — shapes.tsx untouched, and the gates');
console.log('='.repeat(78));

/* SCOPED TO `ShapeFrame`, the silhouette painter — `ShapePreview` renders the
   palette row's small art in its OWN 26x18 frame and legitimately has a second
   viewBox, so a file-wide count would read a correct tree as a defect. */
const VIEWBOX = /viewBox="0 0 200 100"/.test(SHAPES);
const STRETCH = /preserveAspectRatio="none"/.test(SHAPES);
const FRAME_FN = SHAPES.slice(SHAPES.indexOf('export function ShapeFrame'), SHAPES.indexOf('export function ShapePreview'));
const frameViewBoxes = [...FRAME_FN.matchAll(/viewBox="([^"]+)"/g)].map(m => m[1]);
const frameBoices = frameViewBoxes.length;
console.log(`  ShapeFrame viewBox: [${[...new Set(frameViewBoxes)].join(', ')}]  (${frameBoices} in the painter)  stretch=${STRETCH}`);
assert('af6.the-frame-is-unchanged-200x100-and-still-stretched',
  VIEWBOX && STRETCH && frameBoices === 1 && frameViewBoxes[0] === '0 0 200 100',
  `${frameBoices} viewBox in the silhouette painter and it is still 0 0 200 100 with preserveAspectRatio="none". This round changed ` +
  'NO path and NO frame number — rescaling a path to compensate would hide the distortion instead of removing it.');

const capRoundness = (w, h) => (49 * w / 200) / (49 * h / 100);
const atChosen = capRoundness(CHOSEN.width, CHOSEN.height), at270x180 = capRoundness(270, 180), at150x96 = capRoundness(150, 96);
console.log(`  terminal cap roundness (rh/rv): ${CHOSEN.width}x${CHOSEN.height}=${atChosen.toFixed(3)}  270x180=${at270x180.toFixed(3)}  150x96=${at150x96.toFixed(3)}`);
assert('af6.ratio-2.0-is-the-only-ratio-that-leaves-the-silhouette-undistorted',
  Math.abs(atChosen - 1) < 1e-9 && at270x180 < 1 && at150x96 < 1,
  `the cap is circular exactly when W = 2H: at the chosen ${CHOSEN.width}x${CHOSEN.height} the roundness is ${atChosen.toFixed(3)} (a true ` +
  `semicircle), while the ratios the palette used to carry read ${at270x180.toFixed(3)} (1.50) and ${at150x96.toFixed(3)} (1.56) — both flattened. ` +
  'Arithmetic on the frame\'s own numbers (rh = 49*W/200, rv = 49*H/100), not a painted measurement.');

const HEX = (STYLES_RAW.match(/#[0-9a-fA-F]{3,8}\b/g) ?? []).length;
const HEX_LIMIT = 160;   // raised from 127 by ROUND AG1, which ADDED colour on purpose
console.log(`  hex literals in src/styles.css: ${HEX} (limit ${HEX_LIMIT}, raised by ROUND AG1)`);
assert('af0.the-token-gate-holds-no-new-colour-was-added',
  HEX <= HEX_LIMIT,
  `${HEX} hex colour literals in src/styles.css — this round introduces no colour; the ceiling moved only because ROUND AG1 ` +
  'added the red/blue/pink families.');

const failed = results.filter(r => !r.pass);
console.log('\n' + '='.repeat(78));
console.log(`ROUND AF HARNESS: ${results.length - failed.length}/${results.length} passed`);
console.log('='.repeat(78));
for (const f of failed) console.log(`  FAIL  ${f.id}\n        ${f.detail}`);
try { rmSync(ENTRY, {force: true}); rmSync(OUT, {force: true}); } catch { /* gone */ }
console.log(`  cleaned build artefacts: ${ENTRY.replace(ROOT + '/', '')}, ${OUT.replace(ROOT + '/', '')}`);
process.exit(failed.length ? 1 : 0);
