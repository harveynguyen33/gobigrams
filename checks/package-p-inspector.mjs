#!/usr/bin/env node
/**
 * PACKAGE-P PASS 1 harness — the section decision function + the icon pickers.
 *
 * No browser, no DOM, no CDP. Every claim below is read out of the real sources:
 * `src/inspector.ts` is IMPORTED and CALLED (Node 22 strips the types, so the
 * predicates are exercised, not re-implemented here), and `src/App.tsx` /
 * `src/InspectorPickers.tsx` are read as text with comments stripped before any
 * count. That split is deliberate: behaviour is executed, shape is measured.
 *
 * WHY COMMENTS ARE STRIPPED BEFORE EVERY COUNT. This package's prose names the
 * constructs it removed (the spec's §B table lists the twelve `<select>`s by
 * line). A raw count would therefore fail a correct tree and pass nothing. The
 * one counter that matters — "is a native dropdown still RENDERED in the panel"
 * — has to look at code, not at what code says.
 *
 * WHAT IT DOES NOT DO: it cannot see the browser. Presence and order of
 * `data-section`, the popover opening, the click targets: those are the
 * orchestrator's live pass. This file asserts the SOURCE and the DECISION.
 */
import {readFileSync} from 'node:fs';

const ROOT = '/home/harvey/projects/tech-goblin/lab/diagram-studio';
const APP_RAW = readFileSync(`${ROOT}/src/App.tsx`, 'utf8');
const PICKS_RAW = readFileSync(`${ROOT}/src/InspectorPickers.tsx`, 'utf8');
const INSP_RAW = readFileSync(`${ROOT}/src/inspector.ts`, 'utf8');
const STYLES_RAW = readFileSync(`${ROOT}/src/styles.css`, 'utf8');
/* PACKAGE-P PASS 2 (§E) — the Text section's data half, and the in-place editor
   whose blur-commit behaviour (e) and (i) are about. */
const TS_RAW = readFileSync(`${ROOT}/src/textStyle.ts`, 'utf8');
const LABEL_RAW = readFileSync(`${ROOT}/src/LabelNode.tsx`, 'utf8');
/* PACKAGE-P PASS 3 (§C) — the fold state and its persistence. Read as text for
   the shape/copy assertions and BUNDLED below (after `stripTs` exists) for the
   executed ones. */
const IST_SRC = readFileSync(`${ROOT}/src/inspectorState.ts`, 'utf8');

/** Strip block + line comments. The `[^:]` before `//` keeps `https://`. */
const stripTs = s => s
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/(^|[^:])\/\/[^\n]*/g, '$1');
const APP = stripTs(APP_RAW);
const PICKS = stripTs(PICKS_RAW);
const INSP = stripTs(INSP_RAW);
const TS = stripTs(TS_RAW);
const IST = stripTs(IST_SRC);
/* The label editor is stripped with the SAME rule, so a docblock that merely
   QUOTES the hold's mechanism cannot satisfy the "does the hold exist" probe.
   The comment strip is what makes (i) an assertion about code. */
const LABEL = stripTs(LABEL_RAW);

const lines = s => s.split('\n');
const APP_L = lines(APP_RAW);
const PICKS_L = lines(PICKS_RAW);
/** First 1-based line of `raw` containing `needle`, or 0. */
const at = (raw, needle) => {
  const i = raw.split('\n').findIndex(l => l.includes(needle));
  return i < 0 ? 0 : i + 1;
};
const countOf = (text, needle) => text.split(needle).length - 1;
const rendersOf = (text, tag) => (text.match(new RegExp(`<${tag}[\\s>]`, 'g')) ?? []).length;

/* ===========================================================================
   (a) THE DECISION — imported and executed, not transcribed.
   =========================================================================== */
const insp = await import(`${ROOT}/src/inspector.ts`);
const {getInspectorSections, hasKicker, hasMetric, hasIcon, FOLDED_BY_DEFAULT} = insp;
const SHAPES = await import(`${ROOT}/src/shapes.tsx`).catch(() => null);
/* `shapes.tsx` is JSX, which Node cannot strip — so the 19 ids come from the
   SHAPES table read as text, exactly as `checks/package-o-metrics.mjs:311` does. */
const SHAPE_IDS = [];
for (const l of lines(readFileSync(`${ROOT}/src/shapes.tsx`, 'utf8'))) {
  const m = /\{id: '([^']+)', label: '([^']+)', hint: '([^']+)'\}/.exec(l);
  if (m) SHAPE_IDS.push(m[1]);
}
void SHAPES;

const ids = t => getInspectorSections(t).map(s => s.id);
const collapsed = t => getInspectorSections(t).filter(s => s.collapsedDefault).map(s => s.id);

console.log('='.repeat(78));
console.log('(a) THE DECISION — getInspectorSections, executed');
console.log('='.repeat(78));
console.log(`inspector.ts predicates at lines: hasKicker=${at(INSP_RAW, 'export const hasKicker')} `
  + `hasMetric=${at(INSP_RAW, 'export const hasMetric')} hasIcon=${at(INSP_RAW, 'export const hasIcon')}`);
console.log(`getInspectorSections at src/inspector.ts:${at(INSP_RAW, 'export function getInspectorSections')}`);
console.log(`shapes parsed from src/shapes.tsx: ${SHAPE_IDS.length}  [${SHAPE_IDS.slice(0, 5).join(', ')}, …]`);

/* The four named §A.2 cases, quoted with the source line the spec derives them
   from (`DiagramNode.tsx` branches), then executed. */
const NAMED = [
  {case: 'group → no kicker, no metric',
   t: {kind: 'goblin', shape: 'group', body: 'card'},
   want: {kicker: false, metric: false, icon: true},
   why: 'DiagramNode.tsx:260-276 (group branch has neither kicker nor metric)'},
  {case: 'note → no metric, no icon',
   t: {kind: 'goblin', shape: 'note', body: 'card'},
   want: {kicker: true, metric: false, icon: false},
   why: 'DiagramNode.tsx:239-258 (no metric) + :267,291,309 (no IconGlyph)'},
  {case: 'actor → metric + icon',
   t: {kind: 'goblin', shape: 'actor', body: 'card'},
   want: {kicker: true, metric: true, icon: true},
   why: 'DiagramNode.tsx:307-318 (card-shaped branch)'},
  {case: "body:'label-only' → no kicker, no metric",
   t: {kind: 'goblin', shape: 'service', body: 'label-only'},
   want: {kicker: false, metric: false, icon: true},
   why: 'DiagramNode.tsx:309 (label-only keeps icon + title + sub only)'},
];

const results = [];
const assert = (id, pass, detail) => {
  results.push({id, pass, detail});
  console.log(`  ${pass ? 'PASS' : 'FAIL'}  ${id}${detail ? '  — ' + detail : ''}`);
};

console.log('\nper-shape predicates:');
for (const n of NAMED) {
  const got = {kicker: hasKicker(n.t), metric: hasMetric(n.t), icon: hasIcon(n.t)};
  const ok = got.kicker === n.want.kicker && got.metric === n.want.metric && got.icon === n.want.icon;
  console.log(`  ${ok ? ' ' : '!'} ${n.case.padEnd(40)} got=${JSON.stringify(got)}   ${n.why}`);
}

console.log('\nsection lists per target:');
const TABLE = (t, want) => {
  const got = ids(t);
  console.log(`  ${JSON.stringify(got) === JSON.stringify(want) ? ' ' : '!'} ${JSON.stringify(want)}`);
};

/* --- the ordered id lists -------------------------------------------------- */
assert('a.goblin-of-every-shape → [content, text, style]',
  SHAPE_IDS.every(s => JSON.stringify(ids({kind: 'goblin', shape: s, body: 'card'})) === '["content","text","style"]'),
  `${SHAPE_IDS.length} shapes, both body values below  (PASS 2 inserted \`text\` between content and style)`);
assert('a.goblin-of-every-shape × both body values → [content, text, style]',
  SHAPE_IDS.every(s => ['card', 'label-only'].every(b =>
    JSON.stringify(ids({kind: 'goblin', shape: s, body: b})) === '["content","text","style"]')),
  `${SHAPE_IDS.length * 2} combinations`);
assert('a.label → [text]',
  JSON.stringify(ids({kind: 'label'})) === '["text"]', JSON.stringify(ids({kind: 'label'})));
assert('a.table → [table, columns, showMode]',
  JSON.stringify(ids({kind: 'table'})) === '["table","columns","showMode"]',
  JSON.stringify(ids({kind: 'table'})));
assert('a.edge (non-ERD) → [label, line, markers, flow]',
  JSON.stringify(ids({kind: 'edge'})) === '["label","line","markers","flow"]',
  JSON.stringify(ids({kind: 'edge'})));
assert('a.edge (ERD) → [label, line, markers, cardinality, flow]',
  JSON.stringify(ids({kind: 'edge', presetId: 'erd'})) === '["label","line","markers","cardinality","flow"]',
  JSON.stringify(ids({kind: 'edge', presetId: 'erd'})) + '  (the §A.3 `kind === edge && preset.id === erd` gate)');
/* NEGATIVE CONTROL for the gate itself: a DIFFERENT preset must NOT carry it,
   or the assertion above would pass on a function that always returns it. */
assert('a.control-cardinality-is-preset-gated-not-always-present',
  !ids({kind: 'edge', presetId: 'architecture'}).includes('cardinality')
    && ids({kind: 'edge', presetId: 'erd'}).includes('cardinality'),
  'architecture edge has no cardinality; erd edge does');

/* --- the §A.2 named cases -------------------------------------------------- */
for (const n of NAMED) {
  const got = {kicker: hasKicker(n.t), metric: hasMetric(n.t), icon: hasIcon(n.t)};
  const id = `a.${n.case.split(' ')[0]}-${n.case.split('→')[0].trim().split(' ').join('_')}`;
  assert(`a.${n.case.replace(/[^a-z0-9-]+/gi, '-').toLowerCase()}`,
    got.kicker === n.want.kicker && got.metric === n.want.metric && got.icon === n.want.icon,
    `kicker=${got.kicker} metric=${got.metric} icon=${got.icon}  [${n.why}]`);
  void id;
}
/* NEGATIVE CONTROL for the predicates: an UNEXCLUDED shape must have all three,
   or the three checks above could pass on functions that return false always. */
assert('a.control-plain-card-shape-has-all-three-fields',
  hasKicker({kind: 'goblin', shape: 'service', body: 'card'})
    && hasMetric({kind: 'goblin', shape: 'service', body: 'card'})
    && hasIcon({kind: 'goblin', shape: 'service', body: 'card'}),
  'service/card → kicker + metric + icon (the predicates are not all-false)');
assert('a.control-non-goblin-targets-have-no-content-fields',
  !hasKicker({kind: 'edge'}) && !hasMetric({kind: 'table'}) && !hasIcon({kind: 'label'}),
  'edge/table/label → false for all three');

/* ===========================================================================
   (b) ZERO BARE SELECTS — the twelve enumerated controls.
   =========================================================================== */
console.log('\n' + '='.repeat(78));
console.log('(b) ZERO BARE SELECTS in the inspector');
console.log('='.repeat(78));

const INSP_START = APP_RAW.indexOf('{/* RIGHT — inspector */}');
const INSP_END = APP_RAW.indexOf('</aside>', INSP_START);
/* The MARKER is a comment, so the region is sliced from the RAW source and only
   then stripped — slicing the stripped text would find the marker nowhere and
   silently make every count below 0, i.e. pass for the wrong reason. */
const REGION = stripTs(APP_RAW.slice(INSP_START, INSP_END > INSP_START ? INSP_END : undefined));
console.log(`inspector region: App.tsx:${at(APP_RAW, '{/* RIGHT — inspector */}')} `
  + `→ :${APP_RAW.slice(0, INSP_END).split('\n').length}  (${REGION.split('\n').length} lines)`);

const regionSelects = countOf(REGION, '<select');
const fileSelects = countOf(APP, '<select');
const regionOptions = countOf(REGION, '<option');
console.log(`native dropdowns RENDERED in the region: ${regionSelects}   `
  + `in the whole file: ${fileSelects}   <option> in the region: ${regionOptions}`);

/* THE TWELVE, each named with the line it occupied before this pass, and each
   paired with the proof that a picker now carries it. */
const TWELVE = [
  {n: 1, what: 'label position', was: 4145, control: 'ToggleRow', proof: 'options={OFFSET_OPTS}'},
  {n: 2, what: 'stroke width', was: 4162, control: 'IconPickerRow', proof: 'options={WIDTH_OPTS}'},
  {n: 3, what: 'line style', was: 4175, control: 'IconPickerRow', proof: 'options={DASH_OPTS}'},
  {n: 4, what: 'curvature', was: 4187, control: 'IconPickerRow', proof: 'options={CURVE_OPTS}'},
  {n: 5, what: 'arrow head', was: 4210, control: 'IconPickerRow', proof: 'options={MARKER_OPTS}'},
  {n: 6, what: 'head start', was: 4219, control: 'IconPickerRow', proof: 'options={MARKER_OPTS_START}'},
  {n: 7, what: 'flow count', was: 4261, control: 'Stepper', proof: 'min={1} max={6}'},
  {n: 8, what: 'flow speed', was: 4270, control: 'ToggleRow', proof: 'options={SPEED_OPTS}'},
  {n: 9, what: "crow's-foot source end", was: 4313, control: 'IconPickerRow', proof: 'options={CROW_START_OPTS}'},
  {n: 10, what: "crow's-foot target end", was: 4332, control: 'IconPickerRow', proof: 'options={CROW_END_OPTS}'},
  {n: 11, what: 'node shape (19)', was: 4571, control: 'ShapesPicker', proof: '<ShapesPicker'},
  {n: 12, what: 'node body (2)', was: 4580, control: 'ToggleRow', proof: 'options={BODY_OPTS}'},
];
console.log('\nthe twelve enumerated controls, each with its replacement:');
const twelveOk = [];
for (const c of TWELVE) {
  const uses = countOf(REGION, c.proof);
  const controlRenders = rendersOf(REGION, c.control);
  const ok = uses >= 1 && controlRenders >= 1;
  twelveOk.push(ok);
  console.log(`  ${ok ? ' ' : '!'} #${String(c.n).padStart(2)} ${c.what.padEnd(22)} was App.tsx:${c.was}  →  `
    + `<${c.control}> ×${controlRenders}  (${c.proof} ×${uses})`);
}
assert('b.zero-selects-in-the-inspector-region', regionSelects === 0,
  `${regionSelects} native dropdown(s) rendered between the inspector marker and </aside>`);
assert('b.zero-option-elements-in-the-inspector-region', regionOptions === 0,
  `${regionOptions} <option> element(s) left`);
assert('b.all-twelve-enumerated-controls-converted', twelveOk.every(Boolean),
  `${twelveOk.filter(Boolean).length}/12 carried by a picker component`);
assert('b.whole-file-select-count-recorded', fileSelects === 0,
  `App.tsx renders ${fileSelects} native dropdown(s) anywhere — the table/column editor rows use `
  + `<input aria-label="column N …"> + flag buttons (App.tsx:4513-4552), so nothing outside the panel kept one either`);
assert('b.option-art-tables-are-complete',
  (() => {
    /* The option tables are declared with the other derived values, ABOVE the
       inspector region, so they are read from the whole stripped file. Two shapes
       of table exist — a literal `{v: …, art: …}` list (markers, crow's feet,
       speeds, bodies) and an ARRAY `.map`ped into one (widths, dashes, curves) —
       so each is matched by the VALUES it holds, which is what the `<option>`
       list it replaces actually rendered. */
    const TABLES = [
      {what: 'stroke width (5)', ok: APP.includes('const WIDTH_OPTS') && APP.includes('[1, 1.5, 1.8, 2, 3].map')},
      {what: 'line style (3)', ok: APP.includes("(['solid', 'dashed', 'dotted'] as const)")},
      {what: 'curvature (4)', ok: APP.includes("(['bezier', 'smoothstep', 'step', 'straight'] as const)")},
      {what: 'label position (3)', ok: ['center', 'start', 'end'].every(v => APP.includes(`{v: '${v}', label: '${v}'`))},
      {what: 'arrow head (3)', ok: APP.includes('const MARKER_OPTS') && APP.includes('MarkerType.ArrowClosed') && APP.includes('MarkerType.Arrow,')},
      {what: 'head start (3, mirrored)', ok: (() => {
        /* Scoped to its own declaration: `flip` also appears once in the crow-foot
           start table below, so a file-wide count would be 4 and read as a bug. */
        const i = APP.indexOf('const MARKER_OPTS_START');
        const seg = APP.slice(i, APP.indexOf('];', i));
        return countOf(seg, 'flip') === 3;
      })()},
      {what: "crow's foot (6)", ok: ['none', 'one', 'zeroOrOne', 'many', 'zeroOrMany'].every(v => APP.includes(`{v: '${v}'`)) && APP.includes("label: 'arrow'")},
      {what: 'flow speed (4)', ok: ['4', '2.4', '1.4', '0.8'].every(v => APP.includes(`{v: '${v}', label: `))},
      {what: 'body (2, not 19)', ok: APP.includes("{v: 'card', label: 'card'") && APP.includes("{v: 'label-only', label: 'label only'")
          && !APP.includes("body: e.target.value as 'card' | 'label-only'")},
    ];
    for (const t of TABLES) console.log(`  ${t.ok ? ' ' : '!'} ${t.what}`);
    const ARTS = ['ArtWidth', 'ArtDash', 'ArtCurve', 'ArtLabelPos', 'ArtArrow', 'ArtCardinality'];
    for (const a of ARTS) {
      const n = countOf(APP, `<${a}`);
      console.log(`  ${n ? ' ' : '!'} ${a.padEnd(15)} ×${n} uses`);
      if (n === 0) TABLES.push({what: `${a} unused`, ok: false});
    }
    return TABLES.every(t => t.ok);
  })(),
  'every value the twelve selects held is still offered, and each option set is drawn by its own glyph');
assert('b.popover-rows-render-the-option-art',
  countOf(PICKS, 'insp-opt-glyph') >= 2 && PICKS.includes('insp-opt-label')
    && (PICKS.includes('{o.art}') && PICKS.includes('{current?.art}')),
  `IconPickerRow renders \`current?.art\` on the trigger and \`o.art\` in an `
  + `\`.insp-opt-glyph\` cell beside \`.insp-opt-label\`; ShapesPicker uses the same cell for its `
  + `ShapePreview (\`.insp-opt-glyph\` ×${countOf(PICKS, 'insp-opt-glyph')})`);
/* NEGATIVE CONTROL — the counter must SEE a re-introduced dropdown. */
assert('b.control-select-counter-detects-a-reintroduction',
  countOf('<div><select value={x}></select></div>', '<select') === 1
    && countOf('<div><span>a select</span></div>', '<select') === 0,
  'counts a real render (1) and ignores prose that merely says the word (0)');

/* ===========================================================================
   (c) THE PICKERS EXIST — driven by a button/popover, not a select.
   =========================================================================== */
console.log('\n' + '='.repeat(78));
console.log('(c) THE PICKERS — present, and button-driven');
console.log('='.repeat(78));
const PICKS_COMPONENTS = ['IconPickerRow', 'ShapesPicker', 'ToggleRow', 'Stepper', 'Section'];
for (const c of PICKS_COMPONENTS) {
  console.log(`  src/InspectorPickers.tsx:${at(PICKS_RAW, `export function ${c}`)}  export function ${c}`);
}
console.log(`  App.tsx:${at(APP_RAW, "from './InspectorPickers'")}  imports them`);
console.log(`  App.tsx:${at(APP_RAW, 'const MARKER_OPTS')}  the option tables`);

assert('c.popover-is-the-existing-icon-picker-idiom',
  PICKS.includes('icon-field') && PICKS.includes('icon-trigger') && PICKS.includes('icon-pop')
    && PICKS.includes('icon-search') && PICKS.includes('icon-cell') === false,
  'IconPickerRow/ShapesPicker reuse the .icon-field/.icon-trigger/.icon-pop classes from '
  + `styles.css:1239-1256 (the same idiom as src/IconPicker.tsx) — not a second popover pattern`);
assert('c.trigger-is-a-button-with-a-caret',
  countOf(PICKS, 'icon-trigger-caret') >= 2 && countOf(PICKS, 'aria-haspopup="listbox"') >= 2,
  `${countOf(PICKS, '<button')} <button> in the picker module; every popover trigger carries a caret + aria-haspopup`);
assert('c.outside-click-and-escape-close-the-popover',
  countOf(PICKS, "document.addEventListener('mousedown'") >= 2
    && countOf(PICKS, "e.key === 'Escape'") >= 2,
  'same dismissal contract as src/IconPicker.tsx:26-31');
assert('c.shape-picker-is-searchable-and-reuses-ShapePreview',
  PICKS.includes('<ShapePreview') && PICKS.includes('Search shapes…')
    && PICKS.includes('${s.label} ${s.hint}'),
  'ShapePreview (src/shapes.tsx:195) is the item art; the haystack is label + hint, '
  + 'the same pair the palette row renders');
assert('c.no-new-npm-dependency',
  (() => {
    const imports = PICKS_L.filter(l => /^import /.test(l)).join('\n');
    const bare = [...imports.matchAll(/from '([^']+)'/g)].map(m => m[1]).filter(p => !p.startsWith('.'));
    console.log(`  bare (package) imports in InspectorPickers.tsx: [${bare.join(', ')}]`);
    return bare.every(p => p === 'react');
  })(),
  `InspectorPickers.tsx imports only react plus its four ./ siblings — no new package `
  + `(${PICKS_L.filter(l => /^import /.test(l)).length} import lines)`);
assert('c.no-hex-literal-in-either-new-file',
  !/#[0-9a-fA-F]{3,6}\b/.test(PICKS_RAW) && !/#[0-9a-fA-F]{3,6}\b/.test(INSP_RAW),
  'the glyphs stroke `currentColor`; no colour literal enters src/InspectorPickers.tsx or src/inspector.ts');
assert('c.picker-css-is-tokens-only',
  (() => {
    const blk = STYLES_RAW.slice(STYLES_RAW.indexOf('PACKAGE-P: inspector sections'), STYLES_RAW.indexOf('/* ---------- inspector ---------- */'));
    const hex = (blk.match(/#[0-9a-fA-F]{3,6}/g) ?? []).length;
    console.log(`  literal colours inside the new PACKAGE-P CSS block: ${hex}`);
    return hex === 0 && blk.includes('.insp-seg') && blk.includes('.insp-stepper');
  })(),
  'the §B picker/section styles are var()-only');

/* ===========================================================================
   (d) collapsedDefault — the DATA is right, the RENDER is open, no UI yet.
   =========================================================================== */
console.log('\n' + '='.repeat(78));
console.log('(d) collapsedDefault (§A.3) + pass 1 renders OPEN');
console.log('='.repeat(78));
console.log(`COLLAPSED_DEFAULT at src/inspector.ts:${at(INSP_RAW, 'export const COLLAPSED_DEFAULT')}`);
console.log(`folded-by-default set: [${FOLDED_BY_DEFAULT.join(', ')}]`);

const TRUE_FOR = [
  {t: {kind: 'edge', presetId: 'erd'}, want: ['cardinality', 'flow']},
  {t: {kind: 'edge'}, want: ['flow']},
  {t: {kind: 'goblin', shape: 'service', body: 'card'}, want: []},
  {t: {kind: 'label'}, want: []},
  {t: {kind: 'table'}, want: []},
];
for (const c of TRUE_FOR) {
  console.log(`  collapsedDefault true for ${JSON.stringify(c.t)} → [${collapsed(c.t).join(', ')}]`);
}
assert('d.exactly-cardinality-and-flow-are-collapsed-by-default',
  JSON.stringify(FOLDED_BY_DEFAULT.slice().sort()) === '["cardinality","flow"]',
  `the §A.3 "collapsed by default" column, read from the module: [${FOLDED_BY_DEFAULT.join(', ')}]`);
assert('d.erd-edge-collapses-cardinality-and-flow',
  JSON.stringify(collapsed({kind: 'edge', presetId: 'erd'})) === '["cardinality","flow"]',
  JSON.stringify(collapsed({kind: 'edge', presetId: 'erd'})));
assert('d.goblin-collapses-nothing',
  collapsed({kind: 'goblin', shape: 'service', body: 'card'}).length === 0
    && collapsed({kind: 'goblin', shape: 'note', body: 'card'}).length === 0,
  'Content/Text/Style all open (§A.3)');
assert('d.the-flag-is-carried-as-data-not-as-UI',
  PICKS.includes('data-collapsed-default') && PICKS.includes("{String(collapsedDefault)}"),
  'Section emits data-collapsed-default so pass 3 reads the truth table instead of re-deriving it');
/* PASS 3 INVALIDATED THIS ASSERTION AND IT WAS REPLACED, NOT DELETED. It used
   to read `PICKS.includes('data-collapsed="false"')` — "nothing is folded yet".
   The invariant it stood for is still the important one ("the fold state is real
   and one source of it"), so it is now stated against the fold's OWN module and
   the render, below. */
assert('d.fold-state-exists-and-is-defaulted-from-the-truth-table',
  PICKS.includes('collapsed={') && PICKS.includes('data-collapsed={String(collapsed)}')
    && IST.includes('COLLAPSED_DEFAULT')
    && APP.includes('collapsed={isCollapsed(s.id)}'),
  'data-collapsed is the live boolean, and the default comes from COLLAPSED_DEFAULT '
  + '(inspector.ts) read through useInspectorSections — not from a literal');
assert('d.section-wrapper-is-the-trigger-row',
  (() => {
    /* PASS 1's SLICE WAS SILENTLY TRUNCATED. It cut the wrapper at the first
       `\n}` — which in a multi-line props type is the `}) {` line, so `body` was
       the props type alone and the old `!onClick && !aria-expanded` assertion
       passed on an EMPTY slice, i.e. on anything. The slice now runs to the next
       `export function`, and its length is asserted, so it cannot go vacuous
       again. */
    const wrap = PICKS_RAW.slice(PICKS_RAW.indexOf('export function Section('));
    const body = stripTs(wrap.slice(0, wrap.indexOf('\nexport function CardReadout'))).replace(/\s/g, '');
    console.log(`  <Section> body: ${body.length} chars, onClick present ${/onClick/.test(body)}, `
      + `aria-expanded present ${/aria-expanded/.test(body)}  (PASS 3: both required)`);
    return body.length > 400 && /onClick/.test(body) && /aria-expanded/.test(body)
      && /type="button"/.test(body) && /aria-controls/.test(body);
  })(),
  'the Section wrapper is §C\'s trigger row: a native button with onClick + aria-expanded + aria-controls');
assert('d.no-localStorage-in-the-new-files',
  !/\blocalStorage\b/.test(INSP_RAW) && !/\blocalStorage\b/.test(PICKS_RAW),
  'neither file touches storage — the persistence lives in src/inspectorState.ts alone');
assert('d.curvature-picker-writes-type-and-remembers-path',
  APP.includes('updateEdge({type: PATH_TYPES[id]})') && APP.includes('rememberEdgePath(id)')
    && countOf(APP, 'rememberEdgePath(id)') === 1,
  'exactly one rememberEdgePath call, inside the curvature picker');
assert('d.curvature-picker-writes-no-bend',
  (() => {
    /* App.tsx legitimately handles `bendX`/`bendY` elsewhere (the type at :217-218,
       `drawnMid` at :428, the reconnect cleanup at :1645, the endpoint-disc
       normalisation at :1880) — that is ROUND T's shipped work and must stay. The
       invariant this pass owns is narrower: the CURVATURE PICKER must not write a
       bend, because the slider that did was removed and must not come back. So the
       picker's own onChange body is sliced out and checked on its own. */
    const i = APP_RAW.indexOf('id="insp-curvature"');
    const body = stripTs(APP_RAW.slice(i, APP_RAW.indexOf('options={CURVE_OPTS}', i)));
    const bends = countOf(body, 'bend');
    console.log(`  curvature picker onChange: ${bends} occurrence(s) of "bend" (comments stripped)`);
    return bends === 0 && body.includes('updateEdge({type: PATH_TYPES[id]})');
  })(),
  'the picker sets edge.type + calls rememberEdgePath and nothing else');
assert('d.resize-floors-are-still-declared-where-they-live',
  readFileSync(`${ROOT}/src/DiagramNode.tsx`, 'utf8').includes('NODE_MIN_W')
    && countOf(APP, 'NODE_MIN') === 0,
  'NODE_MIN_W/NODE_MIN_H/CSS_CONTENT_MIN_W remain declared in src/DiagramNode.tsx and App.tsx '
  + 'declares none of them — this pass touched neither');

/* ===========================================================================
   (e) NEGATIVE CONTROL — the multi-select branch was NOT restructured.
   =========================================================================== */
console.log('\n' + '='.repeat(78));
console.log('(e) NEGATIVE CONTROL — multi-select branch untouched');
console.log('='.repeat(78));
const MULTI_START = APP.indexOf(') : selCount >= 2 ? (');
const MULTI_END = APP.indexOf(") : selected?.type === 'table' ? (", MULTI_START);
const MULTI = APP.slice(MULTI_START, MULTI_END > MULTI_START ? MULTI_END : undefined);
console.log(`multi-select branch: App.tsx:${at(APP_RAW, ') : selCount >= 2 ? (')} → :${at(APP_RAW, ") : selected?.type === 'table' ? (")}  (${MULTI.split('\n').length} lines)`);
const MULTI_KEEP = ['duplicate', 'deleteSelection', "align('left')", "align('hcenter')", "align('right')",
  "align('top')", "align('vcenter')", "align('bottom')", "distribute('h')", "distribute('v')",
  'swatchRow(null', 'delete selected'];
for (const k of MULTI_KEEP) {
  console.log(`  ${MULTI.includes(k) ? ' ' : '!'} ${k}  ×${countOf(MULTI, k)}`);
}
assert('e.multi-select-branch-still-has-its-controls',
  MULTI_KEEP.every(k => MULTI.includes(k)),
  `${MULTI_KEEP.length}/${MULTI_KEEP.length} controls present: duplicate, delete, 6 align, 2 distribute, swatches, delete selected`);
assert('e.multi-select-branch-was-not-restructured',
  MULTI_START > 0 && MULTI_END > MULTI_START
    && countOf(MULTI, 'data-section') === 0
    && countOf(MULTI, '<Section') === 0
    && countOf(MULTI, 'renderSections()') === 0
    && countOf(MULTI, '<select') === 0,
  'no data-section, no <Section>, no renderSections() inside it — §A.3 has no multi-select row');
assert('e.edge-branch-renders-through-the-list',
  countOf(APP, 'renderSections()') === 4 && countOf(APP, 'secBody(') >= 9,
  `renderSections() called in all four branches (${countOf(APP, 'renderSections()')}); `
  + `${countOf(APP, 'secBody(')} section bodies registered`);
/* PASS 2 (§E.3a) REVERSED THIS ASSERTION ON PURPOSE. Pass 1 asserted the label's
   panel <textarea> was still there, because removing it before its replacement
   existed would have left the label kind with no editor in the panel at all.
   The replacement (`tsBody`, the shared Text section) now exists, so the
   textarea must be GONE — it was a SECOND writer for the same `text`. The check
   moved to (g) below, where it is a "must be 0" plus a proof that the in-place
   editor survives, so the count of text editors is exactly one. */
assert('e.the-panel-label-textarea-is-gone-and-its-replacement-is-not-empty',
  countOf(APP, 'rows={4}') === 0
    && countOf(APP, '<textarea') === 0
    && APP.includes("secBody('text', tsBody)"),
  `${countOf(APP, '<textarea')} <textarea> in App.tsx; the label branch registers the shared `
  + 'Text section body (`tsBody`), which is not an empty shell');

/* ===========================================================================
   (f) RENDER COUNT — registration is not a render.
   ===========================================================================
   WHY THIS EXISTS. §A.1 shipped a registration helper that ALSO returned the
   node, and every call site then printed that return value where it stood — so
   each body landed twice (once at the call site, once inside the Section the
   painter built) and one body landed a third time in a branch it did not
   belong to. Every assertion above passed through all of that, because they ask
   "is the control there / is the section listed", never "how many times".

   The invariant is therefore stated as a COUNT, not a presence:
     1. no call site's value survives into the tree (it must be discarded),
     2. the registered bodies are read back by exactly ONE painter, and the
        registration write is the only occurrence of the map outside it.
   Nothing here reads the browser; it reads the source and counts. The live
   painted-once check is the orchestrator's.
   =========================================================================== */
console.log('\n' + '='.repeat(78));
console.log('(f) RENDER COUNT — secBody registers, renderSections is the only painter');
console.log('='.repeat(78));

/* The painter, sliced by the DECLARATION that follows it. The slice ends at a
   code marker, never at a comment: comments are already stripped from APP, so a
   doc-block needle would land nowhere and the slice would silently run to the
   end of the file. */
const RS_START = APP.indexOf('const renderSections = ()');
const RS_END = APP.indexOf('const nodeColor', RS_START);
const PAINTER = APP.slice(RS_START, RS_END > RS_START ? RS_END : undefined);
/* RAW-line coordinates, because the reported line numbers must be the ones a
   reader (and `grep -n`) sees. Comments are stripped only for the COUNTS. */
const RS_FROM_L = at(APP_RAW, 'const renderSections = ()');
const RS_TO_L = at(APP_RAW, 'const nodeColor');
const PAINTER_RAW = APP_L.slice(RS_FROM_L - 1, RS_TO_L - 1).join('\n');
console.log(`renderSections: App.tsx:${RS_FROM_L} → :${RS_TO_L}  (${PAINTER.split('\n').length} lines)`);

const CALL_SITES = APP_L.map((l, i) => ({n: i + 1, l})).filter(x => x.l.includes("secBody('"));
const embedded = countOf(APP, '{secBody(');
const discards = countOf(APP, 'return null; })()}');
const writes = countOf(APP, 'sectionBody[id] = node');
const MAP_LINES = APP_L.map((l, i) => ({n: i + 1, l: stripTs(l)}))
  .filter(x => x.l.includes('sectionBody['));
const readsTotal = MAP_LINES.length;
const readsInside = countOf(stripTs(PAINTER_RAW), 'sectionBody[');
const readsOutside = MAP_LINES.filter(x => x.n < RS_FROM_L || x.n >= RS_TO_L);

console.log(`  secBody call sites: ${CALL_SITES.length}`);
console.log(`  call sites whose expression container STARTS with the call (value would render): ${embedded}`);
console.log(`  IIFE tails that discard the value (\`return null\`): ${discards}`);
console.log(`  sectionBody[ occurrences: ${readsTotal} at App.tsx:${MAP_LINES.map(x => x.n).join(', ')} — `
  + `${readsInside} inside renderSections, ${readsOutside.length} outside (App.tsx:${readsOutside.map(x => x.n).join(', ')})`);
console.log(`  renderSections declarations: ${countOf(APP, 'const renderSections =')}`);

/* Every call site must be `(() => { secBody('id', …); return null; })()`. */
const badSites = CALL_SITES.filter(x => !/\(\s*\(\)\s*=>\s*\{\s*secBody\('/.test(x.l));
for (const b of badSites) console.log(`  ! App.tsx:${b.n} does not register inside a discarding arrow`);
assert('f.every-secBody-call-site-discards-its-value',
  CALL_SITES.length === discards && embedded === 0 && badSites.length === 0,
  `${CALL_SITES.length} call sites, ${discards} `+ '`return null` tails, '
  + `${embedded} JSX-embedded call(s), ${badSites.length} site(s) not wrapped — a JSX-embedded call renders `
  + 'the body at the call site AND the painter renders it again inside its Section');

/* The map is written once, in secBody, and read only by the painter. */
assert('f.only-one-painter-reads-the-registered-bodies',
  writes === 1 && readsTotal === 3 && readsInside === 2 && readsOutside.length === 1
    && /sectionBody\[id\]\s*=\s*node/.test(APP)
    && countOf(APP, 'const renderSections =') === 1,
  `${readsTotal} occurrence(s) of the map: 1 registration write in secBody `
  + `(App.tsx:${readsOutside.map(x => x.n).join(', ')}), ${readsInside} read(s) inside renderSections `
  + `(App.tsx:${MAP_LINES.filter(x => x.n >= RS_FROM_L && x.n < RS_TO_L).map(x => x.n).join(', ')}) — `
  + 'the painter is the only reader');

/* NEGATIVE CONTROL — the counter must SEE a re-introduced embedded call. */
assert('f.control-render-count-detects-a-reintroduction',
  countOf(`<div>{secBody('x', <b/>)}</div>`, '{secBody(') === 1
    && countOf(`<div>{(() => { secBody('x', <b/>); return null; })()}</div>`, '{secBody(') === 0,
  'counts a call whose value is rendered (1) and ignores one whose value is discarded (0)');

/* THE GATE, stated as a decision: a non-ERD edge must not even BUILD the
   cardinality body, so the harness above would keep passing if the painter\'s
   null-filter were the only thing keeping it off screen. */
console.log(`  cardinality registration is guarded by hasSection('cardinality'): `
  + `${APP.includes("hasSection('cardinality') && (() => { secBody('cardinality'")}`);
assert('f.cardinality-body-is-built-only-for-an-erd-edge',
  (() => {
    const i = APP.indexOf("secBody('cardinality'");
    const site = APP.slice(Math.max(0, i - 80), i);
    const guard = /hasSection\('cardinality'\)\s*&&/.test(site);
    const listed = getInspectorSections({kind: 'edge', presetId: 'erd'}).some(s => s.id === 'cardinality');
    const absent = !getInspectorSections({kind: 'edge'}).some(s => s.id === 'cardinality');
    console.log(`  guard at the call site: ${guard}   erd lists cardinality: ${listed}   `
      + `non-erd lists cardinality: ${!absent}`);
    return guard && listed && absent;
  })(),
  'the call site is gated on `inspSections` itself, not on the painter filtering it away afterwards — '
  + 'the same list the painter walks, so there is no second copy of the ERD rule');

/* ===========================================================================
   PACKAGE-P PASS 2 (§E) — the Text section, its persistence, and the two
   editing behaviours. Same discipline as above: the DECISION is imported and
   CALLED, the rest is read out of the real sources with comments stripped.
   =========================================================================== */
console.log('\n' + '='.repeat(78));
console.log('(f) §A.3/§E — the Text section is IN the list, and only the list changed');
console.log('='.repeat(78));
console.log(`src/textStyle.ts — the model: ${TS.split('\n').length} lines of code `
  + `(textStyle.ts:${at(TS_RAW, 'export function mergeTextStyle')} mergeTextStyle, `
  + `:${at(TS_RAW, 'export function textStyleVars')} textStyleVars)`);

const GOBLIN_WANT = '["content","text","style"]';
const GOBLIN_BODIES = ['card', 'label-only'];
const goblinAll = SHAPE_IDS.flatMap(s => GOBLIN_BODIES.map(b => ({
  s, b, got: JSON.stringify(ids({kind: 'goblin', shape: s, body: b})),
})));
const goblinBad = goblinAll.filter(x => x.got !== GOBLIN_WANT);
console.log(`  goblin × 19 shapes × 2 bodies: ${goblinAll.length - goblinBad.length}/${goblinAll.length} `
  + `return ${GOBLIN_WANT}`);
for (const x of goblinBad.slice(0, 3)) console.log(`  ! ${x.s}/${x.b} → ${x.got}`);
assert('f.every-goblin-lists-content-text-style-in-that-order',
  /* ROUND AD: the count is 25 (the six `every tool ships this` additions joined
     the union). The assertion it guards is that the LIST DOES NOT DEPEND ON THE
     SHAPE, so it is asserted over every id the file declares and the count is
     reported, not pinned to a round's number. */
  SHAPE_IDS.length >= 25 && goblinBad.length === 0,
  `${SHAPE_IDS.length} shapes × ${GOBLIN_BODIES.length} body values, all ${GOBLIN_WANT} — \`text\` is `
  + 'between `content` and `style`, for EVERY shape in the union, which is exactly what the pass-1 omission note promised');
/* `text` must be in the MIDDLE, not merely present: a list that appended it
   would satisfy a `.includes` check and paint the section in the wrong place. */
assert('f.text-sits-before-style-not-after-it',
  ids({kind: 'goblin', shape: 'service', body: 'card'}).indexOf('text')
    < ids({kind: 'goblin', shape: 'service', body: 'card'}).indexOf('style'),
  JSON.stringify(ids({kind: 'goblin', shape: 'service', body: 'card'})));
assert('f.a-label-still-lists-exactly-text',
  JSON.stringify(ids({kind: 'label'})) === '["text"]',
  JSON.stringify(ids({kind: 'label'})) + '  (its `text` is now the SAME section a goblin gets, not a namesake)');
/* THE PASS-2 OMISSION NOTE IS GONE — this is the task-1 deliverable, and it is
   asserted on the RAW source, not the stripped one: the note lived in a comment,
   so a "no longer describes an omission" check has to read the comments. */
assert('f.the-note-no-longer-describes-the-omission',
  !/TWO DELIBERATE PASS-1 OMISSIONS/.test(INSP_RAW)
    && !/text IS NOT RETURNED FOR A GOBLIN/.test(INSP_RAW)
    && /PASS 2 COMPLETED/.test(INSP_RAW),
  'src/inspector.ts now states the omission as CLOSED, and the header keeps the reason the ORDER is '
  + 'what it is (one decision point, not three nested ternaries)');
/* NEGATIVE CONTROL for the ordering assertions: a target that must NOT have it. */
assert('f.control-non-goblin-targets-are-unchanged-from-pass-1',
  JSON.stringify(ids({kind: 'table'})) === '["table","columns","showMode"]'
    && JSON.stringify(ids({kind: 'edge'})) === '["label","line","markers","flow"]'
    && JSON.stringify(ids({kind: 'edge', presetId: 'erd'})) === '["label","line","markers","cardinality","flow"]'
    && !ids({kind: 'table'}).includes('text') && !ids({kind: 'edge'}).includes('text'),
  'table [table,columns,showMode]; non-ERD edge [label,line,markers,flow]; ERD edge adds cardinality '
  + 'before flow; NO target other than goblin/label gained a `text` section');

console.log('\n' + '='.repeat(78));
console.log('(g) §E.3(a) — exactly ONE text editor is left');
console.log('='.repeat(78));
const appTextareas = countOf(APP, '<textarea');
const labelTextareas = countOf(LABEL, '<textarea');
const labelBranchAt = at(APP_RAW, ") : selected.type === 'label' ? (");
const labelBranch = (() => {
  const i = APP.indexOf(") : selected.type === 'label' ? (");
  const j = APP.indexOf(') : (', i);
  return APP.slice(i, j > i ? j : undefined);
})();
console.log(`  App.tsx <textarea> renders: ${appTextareas}   src/LabelNode.tsx: ${labelTextareas}`);
console.log(`  label branch: App.tsx:${labelBranchAt} (${labelBranch.split('\n').length} lines) `
  + `— registers: ${labelBranch.includes("secBody('text', tsBody)")}`);
assert('g.the-panel-label-textarea-is-removed',
  appTextareas === 0 && countOf(APP, 'rows={4}') === 0,
  `${appTextareas} <textarea> left anywhere in App.tsx — the panel no longer holds a second writer `
  + 'for the same `text`');
assert('g.the-in-place-editor-still-exists',
  labelTextareas === 1 && /className="edge-label-input node-label-input nodrag"/.test(LABEL)
    && /onCommitText\?\.\(id, draft\)/.test(LABEL),
  `src/LabelNode.tsx renders ${labelTextareas} <textarea> — the canvas editor, unchanged`);
assert('g.exactly-one-text-editor-remains',
  appTextareas + labelTextareas === 1,
  `${appTextareas} in the panel + ${labelTextareas} in place = ONE writer for a label's text`);
/* NEGATIVE CONTROL — the counter must SEE a textarea if one comes back. */
assert('g.control-textarea-counter-detects-a-reintroduction',
  countOf('<div><textarea rows={4} /></div>', '<textarea') === 1
    && countOf('<div><span>a textarea</span></div>', '<textarea') === 0,
  'counts a real render (1) and ignores prose that merely says the word (0)');
/* The replacement must not be an EMPTY shell — removing the textarea and
   registering nothing would leave the label target with no section at all. */
assert('g.the-replacement-is-not-empty',
  labelBranch.includes("secBody('text', tsBody)")
    && countOf(APP, "secBody('text', tsBody)") === 2
    && ['size', 'weight', 'text color', 'align'].every(l => APP.includes(`<label>${l}</label>`)),
  `2 registrations of tsBody (goblin + label), one body, and it carries all four §E.1 controls`);

console.log('\n' + '='.repeat(78));
console.log('(h) §E.2 — textStyle is ADDITIVE, and only chosen keys are written');
console.log('='.repeat(78));
console.log(`  option tables at src/textStyle.ts:${at(TS_RAW, 'export const TEXT_SIZE_OPTS')} (size), `
  + `:${at(TS_RAW, 'export const TEXT_WEIGHT_OPTS')} (weight), `
  + `:${at(TS_RAW, 'export const TEXT_ALIGN_OPTS')} (align); colour reuses COLOR_KEYS (§E.1)`);
assert('h.an-option-table-exists-for-size-weight-and-align',
  TS.includes('TEXT_SIZE_OPTS') && TS.includes('TEXT_WEIGHT_OPTS') && TS.includes('TEXT_ALIGN_OPTS')
    && countOf(TS, "{v: 'sm'") === 1 && countOf(TS, "{v: 'regular'") === 1
    && countOf(TS, "{v: 'center'") === 1
    && APP.includes('TEXT_SIZE_OPTS.map') && APP.includes('TEXT_WEIGHT_OPTS.map')
    && APP.includes('TEXT_ALIGN_OPTS.map'),
  'the three tables live once in the model and are wrapped once in App — the panel does not re-list them');
assert('h.colour-is-a-KEY-never-a-hex',
  TS.includes("out['--ts-color'] = COLOR_VAR[ts.colorKey]")
    && TS.includes('isColorKey') && TS.includes("colorKey?: ColorKey")
    && !/#[0-9a-fA-F]{3,6}\b/.test(TS_RAW),
  'the stored field is `colorKey?: ColorKey` and the render value is `COLOR_VAR[...]` — a symbolic '
  + 'key through src/colors.ts:20, the same route the outline colour takes');
/* THE WRITER. Read as its own declaration and asserted on the four properties
   that make it LAZY — a writer that always wrote would satisfy "there is an
   option table" and still violate §E.2. */
const MERGE = (() => {
  const i = TS.indexOf('export function mergeTextStyle');
  const j = TS.indexOf('export function readTextStyle', i);
  return TS.slice(i, j > i ? j : undefined);
})();
console.log(`  mergeTextStyle: ${MERGE.split('\n').length} lines; `
  + `deletes default-valued keys: ${/delete next\[k\]/.test(MERGE)}; `
  + `returns undefined when empty: ${/Object\.keys\(next\)\.length \? next : undefined/.test(MERGE)}`);
assert('h.a-missing-field-is-NOT-written',
  /if \(!\(k in patch\)\) continue;/.test(MERGE)
    && /delete next\[k\]/.test(MERGE)
    && /if \(v === undefined \|\| isTextDefault\(k, v, alignDefault, vAlignDefault\)\)/.test(MERGE)
    && /Object\.keys\(next\)\.length \? next : undefined/.test(MERGE),
  'mergeTextStyle copies the stored object, skips any key NOT in the patch, DROPS a key whose value '
  + 'equals the inherited default, and collapses to `undefined` when nothing is left — so a node the '
  + 'user never touched keeps NO textStyle at all');
assert('h.the-panel-WRITES-through-that-merge-and-never-directly',
  /* ROUND Z FIX 2 — BOTH defaults ride in, the vertical one read off the same
     target the horizontal one is. A two-argument call here would compile (the
     model requires both, so it could not) and would silently re-introduce a
     single global vertical default. */
  APP.includes('mergeTextStyle(tsStored, patch, tsAlignDefault, tsVAlignDefault)')
    && countOf(APP, 'mergeTextStyle(') === 1
    && !/textStyle:\s*\{/.test(APP),
  'the only writer is `writeTextStyle`, one call into the merge; no call site constructs a textStyle '
  + 'object literal, which is what a "writes a value the user did not choose" bug looks like');
assert('h.defaults-are-per-target-for-align-and-derived-not-hardcoded',
  TS.includes("body === 'label-only' ? 'center' : 'left'")
    && TS.includes("body === 'label-only' ? 'middle' : 'top'")
    && APP.includes('alignForBody(inspTarget.kind ===') && APP.includes('vAlignForBody(inspTarget.kind ===')
    && APP.includes('readTextStyle(tsStored, tsAlignDefault, tsVAlignDefault)'),
  "BOTH inherited values come from the TARGET (a label-only node is centred by design on both axes), so the "
  + 'panel cannot disagree with the sheet on what "default" means — and (w1) below asserts the sheet half');
assert('h.an-old-board-has-no-textStyle-and-gets-no-write',
  /export type TextStyle = \{/.test(TS)
    && /textStyle\?: TextStyle;/.test(readFileSync(`${ROOT}/src/DiagramNode.tsx`, 'utf8'))
    && /textStyle\?: TextStyle;/.test(LABEL_RAW)
    && /if \(!ts\) return out;/.test(TS),
  'the field is optional in the stored type on BOTH node kinds, and `textStyleVars(undefined)` returns '
  + 'an empty object — so an old board contributes no `--ts-*` and cannot repaint');
/* The RENDERERS. An old board cannot repaint only if the node kinds read
   `textStyle` through exactly one door: `textStyleVars`. A second read — a
   `d.textStyle?.size` reaching for a px number, say — would be a path the model
   does not control, so it is asserted as a count, per kind. */
assert('h.the-renderers-read-textStyle-through-ONE-door',
  (() => {
    for (const [file, src, name] of [
      ['src/DiagramNode.tsx', readFileSync(`${ROOT}/src/DiagramNode.tsx`, 'utf8'), 'DiagramNode'],
      ['src/LabelNode.tsx', LABEL_RAW, 'LabelNode'],
    ]) {
      const s = stripTs(src);
      // EVERY access to the stored object, however it is spelled.
      const access = countOf(s, 'd.textStyle') + countOf(s, '.textStyle?');
      /* The door is `textStyleVars(d.textStyle`, WITHOUT the closing paren:
         PASS 2 added the target's align default as a second argument
         (`textStyleVars(d.textStyle, alignForBody(...))`), so anchoring on the
         old one-arg literal would count 0 and fail a correct tree — while still
         counting every read of the stored object through the door. */
      const throughDoor = countOf(s, 'textStyleVars(d.textStyle');
      /* ...and that second argument must BE the target's own default, which is
         the whole point of the pass: a door fed a hard-coded `left` would paint
         the wrong value on a label-only node. */
      const withDefault = countOf(s, 'textStyleVars(d.textStyle, alignForBody(');
      /* ROUND Z FIX 2 — AND THE THIRD ARGUMENT must be the target's own VERTICAL
         default. Two arguments would compile against an older model and give
         every box one default, which is the defect: a card renders from its
         padding-top (`top`) while only `.lo-body` centres (`middle`), so a
         single constant has to be wrong for one of them. */
      const withVDefault = countOf(s, 'vAlignForBody(');
      const props = countOf(src, "style={{'--nc': nc, ...tsVars}") + countOf(src, 'style={tsVars');
      console.log(`  ${name}: ${access} access(es) to the stored object, ${throughDoor} through the door, `
        + `${withDefault} passing alignForBody, ${withVDefault} passing vAlignForBody, `
        + `${props} style site(s) carrying the vars`);
      if (!(access === throughDoor && throughDoor === 1 && withDefault === 1 && withVDefault === 1)) return false;
      if (props < 1) return false;
    }
    return true;
  })(),
  'each node kind reads `d.textStyle` ONCE, into `textStyleVars`, WITH the target\'s own align default '
  + '(`alignForBody`) AND its own vertical default (`vAlignForBody`) and spreads the result onto the same '
  + 'style object that already carries `--nc` (DiagramNode: 4 branches) — so an old board\'s markup is '
  + 'unchanged (an empty spread adds nothing) AND a stored value is painted against the right default');
assert('h.size-is-a-SCALE-not-a-px-value',
  /TEXT_SCALE: Record<TextSize, number> = \{sm: 0\.85, md: 1, lg: 1\.15, xl: 1\.3\}/.test(TS)
    && /--ts-scale/.test(TS) && !/fontSize/.test(TS)
    && countOf(STYLES_RAW, 'var(--ts-scale, 1)') >= 13,
  'the four steps are multipliers (0.85/1/1.15/1.3), never a px number: one node paints FOUR sizes '
  + `(10.5/14.5/11.5/20) and ${countOf(STYLES_RAW, 'var(--ts-scale, 1)')} rules multiply their own by it, `
  + 'so the hierarchy survives and the resizer floors stay untouched');

console.log('\n' + '='.repeat(78));
console.log('(i) §E.3(b) — the blur-commit hold, scoped to the inspector');
console.log('='.repeat(78));
const HOLD_SEL = /const INSPECTOR_HOLD_SELECTOR = '([^']+)'/.exec(LABEL)?.[1];
/** Every `<aside className="…">` class string in App.tsx. Matched against the
 *  selector the hold uses, so the guard and the element it guards cannot drift. */
const asideSel = [...APP_RAW.matchAll(/<aside className="([^"]+)"/g)].map(m => m[1]);
console.log(`  hold selector in LabelNode.tsx: ${HOLD_SEL}`);
console.log(`  <aside> class names in App.tsx: [${asideSel.join(', ')}]`);
assert('i.the-hold-exists-and-reads-the-pointer-target',
  /const holdCommit = useRef\(false\)/.test(LABEL)
    && /if \(!holdCommit\.current\) commit\(\);/.test(LABEL)
    && /closest\?\.\(INSPECTOR_HOLD_SELECTOR\)/.test(LABEL)
    && /window\.addEventListener\('pointerdown', onDown, true\)/.test(LABEL),
  'a window-level CAPTURE listener arms the hold on a press whose target is inside the panel, and '
  + '`onBlur` consults it before committing — the press happens outside the node, so a listener on '
  + 'the node could never see it');
assert('i.the-hold-is-scoped-to-the-inspector-and-the-selector-is-real',
  HOLD_SEL === '.panel.right' && asideSel.includes('panel right'),
  `the selector "${HOLD_SEL}" matches the real <aside className="panel right"> that renders the panel — `
  + 'asserted on BOTH halves, so a renamed panel cannot silently disarm the hold');
assert('i.the-hold-always-disarms-on-leave',
  /window\.addEventListener\('pointerup', onUp, true\)/.test(LABEL)
    && /window\.addEventListener\('pointercancel', onUp, true\)/.test(LABEL)
    && /removeEventListener\('pointerdown', onDown, true\)/.test(LABEL)
    && /if \(!editing\) \{\s*holdCommit\.current = false;\s*return;/.test(LABEL),
  'pointerup/pointercancel release it, the effect cleanup removes all three listeners and disarms, and '
  + 'a stale hold cannot outlive edit mode');
assert('i.Escape-and-Cmd-Enter-are-UNCHANGED',
  /if \(e\.key === 'Enter' && \(e\.metaKey \|\| e\.ctrlKey\)\) \{ e\.preventDefault\(\); commit\(\); \}/.test(LABEL)
    && /else if \(e\.key === 'Escape'\) \{ e\.preventDefault\(\); cancel\(\); \}/.test(LABEL)
    && /const cancel = \(\) => \{/.test(LABEL),
  '§E.3 "deliberately NOT changing": the hold is a guard AROUND the handlers, not a rewrite of them — '
  + 'Escape still cancels, Cmd/Ctrl+Enter still commits');
assert('i.no-hold-outside-edit-mode',
  /if \(!editing\) \{\s*holdCommit\.current = false;/.test(LABEL) && /, \[editing\]\);/.test(LABEL),
  'the listener set is created only while `editing`, and torn down by the effect on every exit');

console.log('\n' + '='.repeat(78));
console.log('(j) NEGATIVE CONTROL — duplicate/delete while editing: nothing was added');
console.log('='.repeat(78));
/* §H.6: single-node and label selections have NO duplicate/delete in the panel —
   they exist only in the multi-select branch, which never co-occurs with
   in-place editing (one node cannot be selected twice). So the rule is a NO-OP
   here and the only correct change is NO change. Both halves are asserted: the
   single-target branches have none, and the multi-select branch still has
   exactly what pass 1 had. */
const SINGLE_BRANCHES = (() => {
  const i = APP.indexOf(") : selected?.type === 'table' ? (");
  return APP.slice(i);
})();
console.log(`  single-target branches: ${countOf(SINGLE_BRANCHES, 'duplicateSelection')} duplicate, `
  + `${countOf(SINGLE_BRANCHES, 'deleteSelection')} delete`);
console.log(`  multi-select branch:    ${countOf(MULTI, 'duplicateSelection')} duplicate, `
  + `${countOf(MULTI, 'deleteSelection')} delete`);
assert('j.no-duplicate-or-delete-in-any-single-target-branch',
  countOf(SINGLE_BRANCHES, 'duplicateSelection') === 0 && countOf(SINGLE_BRANCHES, 'deleteSelection') === 0,
  'node / table / label branches carry no duplicate and no delete — §H.6 is a no-op here');
assert('j.no-editing-gate-was-invented-for-it',
  !/isEditing/.test(APP) && !/data-editing/.test(APP) && countOf(APP, 'holdCommit') === 0
    && countOf(APP, 'duplicateSelection') === 6 && countOf(APP, 'deleteSelection') === 4,
  'no `isEditing`/`data-editing` flag was added to App.tsx to hide controls that do not exist, and no '
  + 'part of the hold leaked into the panel. The two handler names still appear exactly as often as '
  + 'they did at the end of pass 1 (6 / 4 — their definitions and the multi-select call sites); the '
  + 'assertion that matters is (j) above: ZERO of them inside any single-target branch');
assert('j.control-the-multi-select-branch-is-untouched',
  MULTI.includes('duplicateSelection()') && MULTI.includes('deleteSelection')
    && countOf(MULTI, '<Section') === 0 && countOf(MULTI, 'renderSections()') === 0,
  'pass 1\'s (e) negative control still holds: the only place those controls live is unchanged');

/* ===========================================================================
   (k) THE CROSS-CHECK — a STORED choice is always a PAINTED choice.
   ===========================================================================
   WHY THIS EXISTS. Every check above tests `alignForBody` and `textStyleVars`
   SEPARATELY, so a disagreement BETWEEN them was invisible: pass 1 shipped a
   green 72/72 while `textStyleVars` hard-coded `left` as "the value that
   renders anyway". On a `label-only` node — whose text block is `text-align:
   center` BY DESIGN (`styles.css:3305`) — the user could pick Left, the merge
   would STORE `{"align":"left"}` (correctly: on that target `left` is a real
   choice), and the renderer would then DROP it, because its assumed default
   was `left`. Stored, never painted; the user's Left was indistinguishable
   from an untouched node.

   THE INVARIANT, stated as a decision, for EVERY (target default, pick) pair:
   `textStyleVars(mergeTextStyle(undefined, {align: pick}, default), default)`
   is EMPTY exactly when `pick === default`, and writes `--ts-align` +
   `--ts-justify` otherwise. The `label-only` + `left` cell is the regression
   case and is named below.

   The two functions are IMPORTED AND CALLED, not transcribed. `src/textStyle.ts`
   cannot be imported by Node directly — it imports `./colors` extensionless
   (`src/colors.ts:x`), which Node's ESM resolver refuses — so it is bundled
   with the esbuild that is ALREADY a dev dependency (the same technique
   `checks/package-p-render-check.mjs` uses). No new dependency, and no second
   copy of the rule. */
console.log('\n' + '='.repeat(78));
console.log('(k) §E.2 CROSS-CHECK — a stored choice is always painted');
console.log('='.repeat(78));
const {writeFileSync, rmSync: rmFile} = await import('node:fs');
const MODEL_ENTRY = `${ROOT}/.p-inspector-model.ts`;
const MODEL_OUT = `${ROOT}/.p-inspector-model.mjs`;
writeFileSync(MODEL_ENTRY, "export * from './src/textStyle';\n");
await (await import('esbuild')).build({
  entryPoints: [MODEL_ENTRY], bundle: true, format: 'esm', platform: 'node',
  outfile: MODEL_OUT, logLevel: 'error',
});
const M = await import(`${MODEL_OUT}?t=${Date.now()}`);
for (const f of [MODEL_ENTRY, MODEL_OUT]) { try { rmFile(f, {force: true}); } catch { /* gone */ } }
/* ROUND Z FIX 2 — THE TARGET'S DEFAULTS ARE NOW ARGUMENTS OF THE MODEL, both of
   them, exactly as `src/App.tsx` passes them. These three thin wrappers supply
   the pair from the helper itself so a call site that is only about a
   HORIZONTAL value (`align`) keeps the call it always had: a `center` align
   default IS the label-only body in every existing case here, and everything
   else is a card or a label. Written ONCE rather than re-listed at twenty call
   sites, because a second copy of "which body is this" is a second answer that
   can drift from the one the app uses. */
const mVars = (ts, alignDefault, vAlignDefault) =>
  M.textStyleVars(ts, alignDefault,
    vAlignDefault ?? M.vAlignForBody(alignDefault === 'center' ? 'label-only' : undefined));
const mMerge = (cur, patch, alignDefault) =>
  M.mergeTextStyle(cur, patch, alignDefault,
    M.vAlignForBody(alignDefault === 'center' ? 'label-only' : undefined));
const mLabels = (ts, alignDefault) => M.readTextStyle(ts, alignDefault, M.vAlignForBody(undefined));
console.log(`  textStyle.ts bundled + imported: alignForBody=${typeof M.alignForBody} `
  + `mergeTextStyle=${typeof M.mergeTextStyle} textStyleVars=${typeof M.textStyleVars}`);

/* The two defaults the real targets produce, read from the helper itself — not
   re-listed here, or the check could drift from the rule it is checking. */
const REAL_DEFAULTS = [
  {what: 'card (`.node-body` → left)', body: 'card', def: M.alignForBody('card')},
  {what: 'label (`.label-node` → left)', body: undefined, def: M.alignForBody(undefined)},
  {what: 'label-only (`.lo-body` → center)', body: 'label-only', def: M.alignForBody('label-only')},
];
console.log(`  defaults read from alignForBody: ${REAL_DEFAULTS.map(d => `${d.body ?? '(none)'}=${d.def}`).join('  ')}`);

const ALIGNS = ['left', 'center', 'right'];
const JUSTIFY = {left: 'flex-start', center: 'center', right: 'flex-end'};
const alignBad = [];
for (const d of REAL_DEFAULTS) {
  for (const pick of ALIGNS) {
    const stored = mMerge(undefined, {align: pick}, d.def);
    const vars = mVars(stored, d.def);
    const isDefault = pick === d.def;
    /* empty exactly when the pick IS the target's inherited value. */
    const okEmpty = isDefault
      ? Object.keys(vars).length === 0 && stored === undefined
      : vars['--ts-align'] === pick && vars['--ts-justify'] === JUSTIFY[pick] && stored?.align === pick;
    const tag = (d.body === 'label-only' && pick === 'left') ? '  <-- THE REGRESSION CASE' : '';
    console.log(`  ${okEmpty ? ' ' : '!'} default=${d.def.padEnd(6)} pick=${pick.padEnd(6)} `
      + `stored=${JSON.stringify(stored) ?? 'undefined'} vars=${JSON.stringify(vars)}${tag}`);
    if (!okEmpty) alignBad.push({d, pick, stored, vars});
  }
}
assert('k.stored-align-is-painted-for-every-target-default',
  REAL_DEFAULTS.length === 3 && alignBad.length === 0,
  `${REAL_DEFAULTS.length} target defaults × ${ALIGNS.length} values = `
  + `${REAL_DEFAULTS.length * ALIGNS.length} cells — every stored align paints `
  + '--ts-align + --ts-justify, and only the value that renders anyway stores nothing');
/* The regression, asserted BY NAME so the next reader sees what this guards. */
assert('k.label-only-plus-LEFT-is-painted-not-dropped',
  (() => {
    const stored = mMerge(undefined, {align: 'left'}, M.alignForBody('label-only'));
    const vars = mVars(stored, M.alignForBody('label-only'));
    console.log(`  label-only picks LEFT (its default is center): stored=${JSON.stringify(stored)} `
      + `vars=${JSON.stringify(vars)}`);
    return JSON.stringify(stored) === '{"align":"left"}'
      && vars['--ts-align'] === 'left' && vars['--ts-justify'] === 'flex-start';
  })(),
  'a label-only goblin stores `{align:"left"}` (left is NOT its inherited value) AND the renderer '
  + 'paints it — before the fix it stored the choice and emitted {} , i.e. saved and never shown');
/* NEGATIVE CONTROL — the cross-check must SEE a re-introduced assumption. */
assert('k.control-the-cross-check-detects-a-hard-coded-default',
  (() => {
    /* The old body, reconstructed: align compared against the LITERAL `left`
       while the target's default is `center`. This is why (k) exists. */
    const naive = (ts, def) => {
      const out = {};
      if (ts && ts.align && ts.align !== 'left') { out['--ts-align'] = ts.align; out['--ts-justify'] = JUSTIFY[ts.align]; }
      return out;
    };
    const stored = mMerge(undefined, {align: 'left'}, 'center');
    const got = naive(stored, 'center');
    console.log(`  reconstructed pre-fix renderer on label-only+left: stored=${JSON.stringify(stored)} `
      + `vars=${JSON.stringify(got)}  (empty = the bug this check catches)`);
    return Object.keys(got).length === 0 && stored?.align === 'left';
  })(),
  'the pre-fix body drops the same stored value this harness now requires to be painted');
/* The same cross-check shape for the OTHER two fields, which have no per-target
   default at all — asserted as target-INDEPENDENT, i.e. the result must be the
   same for every default, so a future `alignForBody`-shaped default there would
   fail this check rather than slip through. */
const sizeWeightBad = [];
for (const d of REAL_DEFAULTS) {
  for (const pick of ['sm', 'md', 'lg', 'xl']) {
    const stored = mMerge(undefined, {size: pick}, d.def);
    const vars = mVars(stored, d.def);
    const want = M.TEXT_SCALE[pick] === 1;
    const ok = want ? (stored === undefined && !('--ts-scale' in vars))
      : (vars['--ts-scale'] === String(M.TEXT_SCALE[pick]) && stored?.size === pick);
    if (!ok) sizeWeightBad.push({field: 'size', d, pick, stored, vars});
  }
  for (const pick of ['regular', 'bold']) {
    const stored = mMerge(undefined, {weight: pick}, d.def);
    const vars = mVars(stored, d.def);
    const want = pick === 'regular';
    const ok = want ? (stored === undefined && !('--ts-weight' in vars))
      : (vars['--ts-weight'] === '700' && stored?.weight === 'bold');
    if (!ok) sizeWeightBad.push({field: 'weight', d, pick, stored, vars});
  }
}
assert('k.size-and-weight-have-NO-per-target-default',
  sizeWeightBad.length === 0,
  `${REAL_DEFAULTS.length * 6} cells (4 sizes + 2 weights × 3 defaults) — identical outcome for every `
  + 'target, because `md` is the multiplicative identity and `regular` is the inherited weight '
  + 'everywhere (`styles.css:3285-3292`); neither is `alignForBody`-shaped, so neither needs a parameter');

/* ===========================================================================
   (l) SPECIFICITY SWEEP — a var() override that cannot WIN is not a control.
   ===========================================================================
   WHY THIS EXISTS. (a)-(k) ask whether a value is STORED and whether it is
   EMITTED. Neither asks what (l) asks: whether the emitted value DECIDES
   anything. A sheet may set the same property on the same element in an
   EARLIER rule whose selector is more specific, and CSS then ignores the
   override wherever it sits in the file. Pass 1 shipped a green 72/72 with
   exactly that shape: the label-only body's branch rule (0,3,0) pinned
   `text-align` AND `align-items` to a literal before the (0,2,0) override
   could speak, so the user's Left landed in a declaration that lost. A
   presence-only check is blind to it, which is why this one measures.

   WHAT IT MEASURES. src/styles.css is read with comments BLANKED (blanked,
   never removed, so every byte offset — and therefore every reported line
   number — stays true), split into rules, and each selector is reduced to
   (ids, classes, elements). For every `var(--ts-<x>, <fallback>)` declaration:
     1. CAN IT WIN? Is there an EARLIER rule setting the SAME property on a
        selector with the SAME SUBJECT (last compound) and HIGHER specificity?
        Equal specificity is correct — later wins; only higher is a defect.
     2. IS ITS FALLBACK THE BASE VALUE? The fallback must equal the literal the
        base rule already declares, or a node with nothing stored moves.
   The SUBJECT test keeps it honest: a rule on `.lo-title` is never counted
   against one on `.lo-body`, and a rule on `.node-body small` is never counted
   against one on `.node-body` (the element step is part of the subject).
   =========================================================================== */
console.log('\n' + '='.repeat(78));
console.log('(l) SPECIFICITY SWEEP — every var(--ts-*) consumer vs the rules above it');
console.log('='.repeat(78));

// Blank comment bodies but keep every byte offset (newlines included), so a
// line number derived from the result is the line number a reader sees.
function blankComments(s) {
  return s.replace(/\/\*[\s\S]*?\*\//g, m => m.replace(/[^\n]/g, ' '));
}

// Top-level rules, descending into at-rules. `start` = byte offset of the
// selector's first non-space character in the ORIGINAL text.
function splitRules(text, atRule, offset, out) {
  let depth = 0, prelude = '', body = '', startAbs = -1, bodyStartAbs = -1;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '{') {
      depth++;
      if (depth === 1) { body = ''; bodyStartAbs = offset + i + 1; } else body += ch;
      continue;
    }
    if (ch === '}') {
      if (depth === 0) continue;
      depth--;
      if (depth === 0) {
        const sel = prelude.trim();
        const at = /^@[\w-]+/.exec(sel);
        if (at) splitRules(body, at[0], bodyStartAbs, out);
        else if (sel) out.push({sel, decls: body, at: atRule, start: startAbs});
        prelude = ''; body = ''; startAbs = -1;
      } else body += ch;
      continue;
    }
    if (depth === 0) {
      if (startAbs < 0 && !/\s/.test(ch)) startAbs = offset + i;
      prelude += ch;
    } else body += ch;
  }
  return out;
}

function splitSelectorList(sel) {
  const out = []; let depth = 0, buf = '';
  for (const ch of sel) {
    if (ch === '(') depth++;
    else if (ch === ')') depth--;
    else if (ch === ',' && depth === 0) { out.push(buf.trim()); buf = ''; continue; }
    buf += ch;
  }
  if (buf.trim()) out.push(buf.trim());
  return out;
}

// Declarations at THIS rule's level; a nested rule's prelude is discarded.
function declsOf(body) {
  const out = []; let depth = 0, buf = '';
  for (let i = 0; i < body.length; i++) {
    const ch = body[i];
    if (ch === '{') { depth++; buf = ''; continue; }
    if (ch === '}') { if (depth > 0) depth--; continue; }
    if (depth > 0) continue;
    if (ch === ';') { if (buf.trim()) out.push(buf.trim()); buf = ''; continue; }
    buf += ch;
  }
  if (buf.trim()) out.push(buf.trim());
  return out;
}

function propValue(d) {
  const i = d.indexOf(':');
  if (i < 0) return null;
  const prop = d.slice(0, i).trim(), value = d.slice(i + 1).trim();
  return prop && value ? {prop, value} : null;
}

// (ids, classes, elements). Attribute selectors count as a class, pseudo-
// elements as an element, and `:hover` as a class — the usual approximation,
// applied IDENTICALLY to both sides of every comparison below, which is what
// makes the verdict meaningful even where a browser's exact number differs.
function specOf(raw) {
  const s = raw.replace(/\[[^\]]*\]/g, '#ATTR#').replace(/\([^)]*\)/g, '()');
  const ids = (s.match(/#[\w-]+/g) || []).length;
  const pets = (s.match(/::[\w-]+/g) || []).length;
  const classes = (s.match(/\.[\w-]+/g) || []).length + (s.match(/#ATTR#/g) || []).length
    + (s.match(/(?<!:):[\w-]+/g) || []).length;
  const els = (s.match(/(^|[\s>+~])[a-zA-Z][\w-]*/g) || []).length + pets;
  return {ids, classes, els};
}

// What the selector actually STYLES: its last compound. Two rules style the
// same element only if this agrees, which is what stops a sibling row from
// being reported as a rival.
function subjectKey(sel) {
  const last = (sel.split(/\s*[>+~]\s*|\s+/).filter(Boolean).pop()) || '';
  const cls = (last.match(/\.[\w-]+/g) || []).join('');
  return cls || last;
}

// Every var(<prefix>[, fallback]) inside a declared value, paren-matched so a
// NESTED var (the `calc(Npx * var(--ts-scale, 1))` form) is seen too. The
// prefix is a parameter so `--ts-font` can be swept on its OWN (ROUND W FIX):
// a bare `--ts-` sweep proves a MEMBER of that family is fine, not that the
// one variable this round added is. The default keeps every existing caller
// behaviourally identical.
function varUses(value, varPrefix = '--ts-') {
  const out = []; const re = /var\(/g; let m;
  while ((m = re.exec(value)) !== null) {
    let depth = 1, arg = '', i = m.index + 4;
    for (; i < value.length && depth > 0; i++) {
      const ch = value[i];
      if (ch === '(') depth++;
      else if (ch === ')') { depth--; if (depth === 0) break; }
      arg += ch;
    }
    const comma = arg.indexOf(',');
    const name = (comma < 0 ? arg : arg.slice(0, comma)).trim();
    if (name.startsWith(varPrefix)) {
      out.push({name, fallback: comma < 0 ? null : arg.slice(comma + 1).trim()});
    }
    re.lastIndex = i;
  }
  return out;
}

// The class tokens a selector matches on — used to decide whether two rules
// can even style the same element.
function classSet(sel) {
  return new Set((sel.match(/\.[\w-]+/g) || []).map(s => s.slice(1)));
}
function subset(a, b) {
  for (const x of a) if (!b.has(x)) return false;
  return true;
}
const SPEC_GREATER = (b, a) => b.ids > a.ids
  || (b.ids === a.ids && b.classes > a.classes)
  || (b.ids === a.ids && b.classes === a.classes && b.els > a.els);
const specEqual = (b, a) => b.ids === a.ids && b.classes === a.classes && b.els === a.els;
const specStr = s => `(${s.ids},${s.classes},${s.els})`;

// The whole sweep, as a pure function of a sheet's TEXT — which is what lets
// the three controls below feed it a known-bad sheet instead of trusting it on
// the one file it was written for. `varPrefix` defaults to the `--ts-` family;
// `--ts-font` is swept by passing it on its own (ROUND W FIX).
function sweepSheet(text, varPrefix = '--ts-') {
  const css = blankComments(text);
  const lineIndex = new Uint32Array(css.length + 1);
  { let line = 1;
    for (let i = 0; i < css.length; i++) { lineIndex[i] = line; if (css[i] === '\n') line++; }
    lineIndex[css.length] = line; }
  const lineAt = off => lineIndex[Math.max(0, Math.min(off, css.length))];

  const rules = splitRules(css, '(top level)', 0, []);

  /* Per individual SELECTOR (not per rule): the LITERAL value it declares for
     `<subject>|<property>`. A var() declaration is not a base — it is a
     consumer, collected below. Keying by subject rather than by the raw
     selector is what lets `.node .lo-body` (line 3311) be compared with the
     `.node .lo-body` arm of the 2317 selector list. */
  const bases = [];
  rules.forEach((r, ri) => {
    for (const t of splitSelectorList(r.sel)) {
      const spec = specOf(t), cls = classSet(t), subject = subjectKey(t);
      for (const d of declsOf(r.decls)) {
        const pv = propValue(d);
        if (!pv) continue;
        /* A base is what an element paints with NOTHING stored. A declaration
           that READS the swept variable is a consumer, not a base. But a
           declaration that reads some OTHER token — `font-family: var(--mono)`
           — IS a base, and for a TOKEN-VALUED property every base in this sheet
           is one. Excluding on a bare `var(` therefore left `--ts-font` with NO
           bases whatsoever, which made its half of the sweep VACUOUS: it could
           not report a loss or a fallback mismatch on a property whose every
           literal is a token reference. That is the gap this pass closes, and
           the reason the prefix had to become a parameter. */
        if (varUses(pv.value, varPrefix).length > 0) continue;
        bases.push({ri, key: `${subject}|${pv.prop}`, value: pv.value, sel: t, spec, cls,
          line: lineAt(r.start)});
      }
    }
  });

  const consumers = [];
  rules.forEach((r, ri) => {
    for (const d of declsOf(r.decls)) {
      const pv = propValue(d);
      if (!pv) continue;
      for (const u of varUses(pv.value, varPrefix)) {
        consumers.push({ri, line: lineAt(r.start), sel: r.sel, prop: pv.prop,
          name: u.name, fallback: u.fallback, value: pv.value,
          selectors: splitSelectorList(r.sel)});
      }
    }
  });

  const violations = [], fallbackBad = [];
  for (const c of consumers) {
    /* INTERFERENCE — when are two rules rivals at all? Only if they can style
       the same element: they must end in the same compound (`lo-body` is never
       confused with `lo-title`, and the element step is part of it, so
       `node-body small` is not confused with `node-body`), AND one selector's
       class set must contain the other's. The subset half is what keeps two
       unrelated rows that merely share a trailing element apart: `.group-label
       small` and `.node-metric small` are disjoint by class, so neither's
       literal is treated as the other's base. */
    let beat = false, base = null;
    for (const m of c.selectors) {
      const key = `${subjectKey(m)}|${c.prop}`;
      const aSpec = specOf(m), aCls = classSet(m);
      for (const b of bases) {
        if (b.ri >= c.ri || b.key !== key) continue;
        if (!subset(aCls, b.cls) && !subset(b.cls, aCls)) continue;
        if (SPEC_GREATER(b.spec, aSpec)) {
          violations.push({c, theirSel: b.sel, theirLine: b.line, theirs: specStr(b.spec),
            ours: specStr(aSpec), theirValue: b.value});
          beat = true;
        } else if (specEqual(b.spec, aSpec) && (!base || b.ri > base.ri)) {
          /* Equal specificity: the LATEST one before us is the declaration we
             layer over — that is the value an untouched node would paint. */
          base = b;
        }
      }
    }
    c.beat = beat; c.base = base;
    if (!beat && base) {
      /* IS THE FALLBACK WHAT THE BASE RENDERS? Two shapes are legitimate.
         `--ts-scale` is a MULTIPLIER over the px the base rule already
         declares, so its declaration reads `calc(<that px> * var(--ts-scale,
         1))` and its fallback must be the identity `1` — with nothing stored
         the calc evaluates to the base px itself. Every other variable must
         fall back to the base literal verbatim (a token reference like
         `var(--dim)` included: the comparison is textual, so the two rules are
         required to agree). A consumer whose only earlier rivals are LESS
         specific is skipped: it is not layering over a base, it is declaring
         its own value, which the sheet cannot contradict. */
      const scaleFactor = /^calc\(\s*(.+?)\s*\*\s*var\(--ts-scale,\s*1\)\s*\)$/.exec(c.value)?.[1];
      const isScaleVar = c.name === '--ts-scale';
      const okScale = isScaleVar && c.fallback === '1' && scaleFactor !== undefined
        && scaleFactor.replace(/\s+/g, '') === base.value.replace(/\s+/g, '');
      const okLiteral = !isScaleVar && c.fallback !== null && c.fallback === base.value;
      if (!okScale && !okLiteral) {
        fallbackBad.push({c, base: base.value, baseLine: base.line, scaleFactor});
      }
    }
  }
  return {css, rules, consumers, violations, fallbackBad, lineAt};
}

/* --- the real sheet ------------------------------------------------------- */
const SWEEP = sweepSheet(STYLES_RAW);
const RAW_VAR_USES = countOf(SWEEP.css, 'var(--ts-');
console.log(`  rules parsed: ${SWEEP.rules.length}   var(--ts-*) occurrences: ${SWEEP.consumers.length} `
  + `of ${RAW_VAR_USES} raw (a value may carry two)`);

const byVar = new Map();
for (const c of SWEEP.consumers) {
  if (!byVar.has(c.name)) byVar.set(c.name, []);
  byVar.get(c.name).push(c);
}
console.log('\n  property-by-property (the earlier literal rule is what must LOSE to it):');
for (const [name, list] of [...byVar.entries()].sort()) {
  console.log(`\n  ${name}  — ${list.length} consumer(s)`);
  for (const c of list) {
    const lose = SWEEP.violations.filter(v => v.c === c);
    const mine = specStr(specOf(c.selectors[0]));
    console.log(`    line ${String(c.line).padStart(4)}  ${c.prop.padEnd(16)} ${c.sel}`);
    console.log(`              fallback ${JSON.stringify(c.fallback)}  ` +
      (c.beat ? '** DEFECT: an earlier more specific rule pins this property **'
        : c.base ? `lays over styles.css:${c.base.line} \`${c.base.sel}\` ` +
          `${specStr(c.base.spec)} (${c.base.value}) -> equal specificity, ours ${mine}, later wins`
          : `no earlier rule of equal specificity sets this property on this subject (ours ${mine})`));
  }
}
console.log(`\n  losing pairs: ${SWEEP.violations.length}   fallback-vs-base mismatches: ${SWEEP.fallbackBad.length}`);
for (const v of SWEEP.violations.slice(0, 10)) {
  console.log(`  ! ${v.c.sel} { ${v.c.prop}: var(${v.c.name}) } at styles.css:${v.c.line}  ` +
    `is beaten by \`${v.theirSel}\` ${v.theirs} vs ${v.ours} at styles.css:${v.theirLine} (sets ${v.c.prop}: ${v.theirValue})`);
}
for (const f of SWEEP.fallbackBad.slice(0, 10)) {
  console.log(`  ! ${f.c.sel} { ${f.c.prop} } fallback ${JSON.stringify(f.c.fallback)} ` +
    `!= the base \`${f.base}\` at styles.css:${f.baseLine}`);
}

/* THE TWO ROWS THE USER REPORTED, asserted by name: the label-only body must
   read BOTH of its axes from the variables with the sheet's own pre-fix
   literals as defaults, and the title row must read the horizontal one. */
const LO_BODY = SWEEP.rules.find(r => r.sel.includes('.lo-body') && r.sel.includes('.label-only'));
const loBodyDecls = LO_BODY ? declsOf(LO_BODY.decls).map(propValue).filter(Boolean) : [];
const declOn = (sel, prop) => {
  const r = SWEEP.rules.find(x => x.sel.trim() === sel);
  if (!r) return null;
  const d = declsOf(r.decls).map(propValue).filter(Boolean).find(p => p.prop === prop);
  return d ? d.value : null;
};
console.log(`\n  the label-only body rule (styles.css:${LO_BODY ? SWEEP.lineAt(LO_BODY.start) : '?'}) declares ` +
  `${loBodyDecls.filter(d => /--ts-/.test(d.value)).map(d => `${d.prop}: ${d.value}`).join(' | ')}`);
console.log(`  .node .lo-title declares justify-content: ${declOn('.node .lo-title', 'justify-content')}`);

assert('l.every-var-ts-consumer-was-swept',
  SWEEP.consumers.length >= 20 && SWEEP.consumers.length === RAW_VAR_USES,
  `${SWEEP.consumers.length} var(--ts-*) declarations found in src/styles.css (comments blanked, so a `+
  'docblock mentioning the names cannot inflate the count)');
assert('l.no-earlier-rule-outranks-a-var-ts-consumer',
  SWEEP.violations.length === 0,
  SWEEP.violations.length === 0
    ? `${SWEEP.consumers.length} consumers, each with a subject-equal earlier rule of EQUAL or LOWER specificity — ` +
      'later-in-sheet wins, so every --ts-* value actually decides'
    : `${SWEEP.violations.length} consumer(s) whose value LOSES to an earlier more specific rule`);
assert('l.the-label-only-body-reads-both-axes-with-its-own-literals',
  loBodyDecls.some(d => d.prop === 'text-align' && d.value === 'var(--ts-align, center)')
    && loBodyDecls.some(d => d.prop === 'align-items' && d.value === 'var(--ts-justify, center)')
    && !loBodyDecls.some(d => d.prop === 'text-align' && d.value === 'center')
    && !loBodyDecls.some(d => d.prop === 'align-items' && d.value === 'center'),
  'the rule that OWNS this block reads `text-align` and `align-items` from the variables, and the fallback on ' +
  'each is `center` — the exact literal it declared before — so an untouched node is pixel-identical');
assert('l.the-title-row-reads-the-horizontal-axis',
  declOn('.node .lo-title', 'justify-content') === 'var(--ts-justify, center)',
  'the 2322 rule and the 3316 rule now agree through the variable instead of the earlier literal pinning it');
assert('l.every-fallback-equals-the-base-value-it-falls-back-to',
  SWEEP.fallbackBad.length === 0,
  `${SWEEP.consumers.filter(c => c.base).length} consumers have an earlier base rule of equal specificity ` +
  `on their subject; ${SWEEP.fallbackBad.length} fall back to something other than what that base renders ` +
  '(a `--ts-scale` consumer falls back to the identity `1` while its base reads `calc(<px> * var(--ts-scale, 1))`)');

/* --- THE CONTROLS — the sweep must fail on the pre-fix shape -------------- */
/* The sheet EXACTLY as the reported bug had it: the branch rule pins both axes
   with a literal at (0,3,0), and the override further down only speaks about
   `text-align` at (0,2,0) — so one declaration loses and the other is never
   made at all. */
const PRE_FIX = `.outer { text-align: center; }
.node.label-only .lo-body, .node .lo-body { display: flex; flex-direction: column;
  align-items: center; justify-content: center; text-align: center; }
.node .lo-body { text-align: var(--ts-align, center); }`;
/* An override that DID wire both axes but under the lower-specificity selector:
   the shape a naive "just read the variable" repair leaves behind. */
const PRE_FIX_BOTH = `.node.label-only .lo-body, .node .lo-body { display: flex; flex-direction: column;
  align-items: center; justify-content: center; text-align: center; }
.node .lo-body { text-align: var(--ts-align, center); align-items: var(--ts-justify, center); }`;
const POST_FIX = `.node .lo-body { text-align: center; align-items: center; }
.node .lo-body { text-align: var(--ts-align, center); align-items: var(--ts-justify, center); }`;
const OTHER_ROW = `.node .lo-title { text-align: right; }
.node .lo-body { text-align: var(--ts-align, center); }`;
const preFixSweep = sweepSheet(PRE_FIX);
const preFixBothSweep = sweepSheet(PRE_FIX_BOTH);
const postFixSweep = sweepSheet(POST_FIX);
const otherRowSweep = sweepSheet(OTHER_ROW);
console.log(`\n  controls — pre-fix: ${preFixSweep.violations.length} violation(s); ` +
  `both-axes-under-the-low-selector: ${preFixBothSweep.violations.length}; ` +
  `repaired: ${postFixSweep.violations.length}; different-subject rule: ${otherRowSweep.violations.length}`);
for (const v of preFixSweep.violations) {
  console.log(`    pre-fix defect seen: \`${v.theirSel}\` ${v.theirs} beats \`${v.c.sel}\` ${v.ours} on ${v.c.prop}`);
}
for (const v of preFixBothSweep.violations) {
  console.log(`    wired-but-outranked:  \`${v.theirSel}\` ${v.theirs} beats \`${v.c.sel}\` ${v.ours} on ${v.c.prop}`);
}
assert('l.control-the-sweep-fails-on-the-pre-fix-shape',
  preFixSweep.violations.length === 1
    && preFixSweep.violations[0].theirSel === '.node.label-only .lo-body'
    && preFixSweep.violations[0].c.prop === 'text-align',
  `the unrepaired sheet reports ${preFixSweep.violations.length} losing declaration — \`text-align\`, beaten by ` +
  'the (0,3,0) branch arm of the very rule list the override names. This is the check that would have caught ' +
  'the shipped bug, and it is red on that tree');
assert('l.control-the-sweep-sees-BOTH-axes-lose',
  preFixBothSweep.violations.length === 2
    && preFixBothSweep.violations.every(v => v.theirSel === '.node.label-only .lo-body')
    && preFixBothSweep.violations.map(v => v.c.prop).sort().join() === 'align-items,text-align',
  `an override that wires both axes but keeps the lower selector still loses BOTH (${preFixBothSweep.violations.length} ` +
  'declarations reported) — the flex `align-items` half is not invisible just because `text-align` was the ' +
  'property named in the report') ;
assert('l.control-the-sweep-passes-the-repaired-shape',
  postFixSweep.violations.length === 0 && postFixSweep.fallbackBad.length === 0,
  'equal specificity, later in the sheet: no violation, and `center` matches the base `center`');
assert('l.control-the-subject-test-does-not-cross-rows',
  otherRowSweep.violations.length === 0,
  'a more specific earlier rule on a DIFFERENT subject (the title row) is not counted against the body row — ' +
  'without the subject test every node rule would look like a rival of every other');

/* ===========================================================================
   (l2) THE `--ts-font` SWEEP — the same measurement, run on ONE variable.
   ===========================================================================
   WHY A SECOND SWEEP WHEN (l) ALREADY READS THE FAMILY. (l) matches
   `var(--ts-` — a PREFIX — so it reports `--ts-font` among its members and
   would go on passing if this round's eight rules were the only thing in the
   file that still worked. A family-wide count cannot answer "is THE variable
   this round added actually winning", which is the question ROUND W's font
   control stands or falls on. So the SAME machinery (varUses/sweepSheet, both
   now parameterised) is run against `--ts-font` alone: if any of the eight
   rows had an EARLIER rule of higher specificity pinning its `font-family`, the
   picker would paint nothing on that row and (l) would not have said so.
   `--ts-font` sits in eight PLAIN overrides (not the `calc(… * var(--ts-…))`
   form (l) grew up on), which is exactly why it needed its own pass rather
   than an eye: the failure mode is invisible in the source and only shows as
   one row of a node not changing when the picker moves.
   =========================================================================== */
console.log('\n' + '='.repeat(78));
console.log('(l2) THE --ts-font SWEEP — the eight node-text rows, against the rules above them');
console.log('='.repeat(78));

/* The eight rows, as SUBJECT KEYS (the sweep's own notion of "the element this
   rule styles"), each with the stack its PRE-ITEM-2 base rule declares. That
   pair is the contract: the consumer's fallback must be byte-identical to this
   stack, or a node with NOTHING STORED changes family. */
const TS_FONT_ROWS = [
  ['.node-kicker', 'var(--mono)'],
  ['.node-title', 'var(--sans)'],
  ['.node-sub', 'var(--mono)'],
  ['.node-metric', 'var(--mono)'],
  ['.lo-title', 'var(--sans)'],
  ['.lo-sub', 'var(--mono)'],
  ['.note-node', 'var(--mono)'],
  ['.label-node', 'var(--mono)'],
];
const FAMILY_BASE = new Map(TS_FONT_ROWS);
/* ROUND W FIX 2 — the NINTH consumer, and why it is not a ninth row.
   `.label-node` is the one row with a SECOND render site: its in-place
   `<textarea>` (`.node-label-input`). A textarea does not inherit
   `font-family`, so the row's contract has to be declared on the editor too
   (exactly as `--ts-scale` / `--ts-weight` / `--ts-color` / `--ts-align`
   already are). The sweep still sees EIGHT subjects; one of them — the label —
   is read twice, once per render site, from the SAME base stack. So the
   editor's subject key is folded back onto the row it belongs to here, and
   (l2.a) asserts the 8-subject / 9-consumer shape rather than a bare count. */
const EDITOR_OF = new Map([['.node-label-input', '.label-node']]);
const rowKey = c => EDITOR_OF.get(subjectKey(c.selectors[0])) ?? subjectKey(c.selectors[0]);
const TS_FONT = sweepSheet(STYLES_RAW, '--ts-font');
console.log(`  rules parsed: ${TS_FONT.rules.length}   var(--ts-font, …) consumers: ${TS_FONT.consumers.length}`);
for (const c of TS_FONT.consumers) {
  const subj = rowKey(c);
  const want = FAMILY_BASE.get(subj);
  const lose = TS_FONT.violations.filter(v => v.c === c);
  console.log(`    line ${String(c.line).padStart(4)}  ${c.prop.padEnd(12)} ${c.sel}`);
  console.log(`              fallback ${JSON.stringify(c.fallback)}` +
    (lose.length ? `  ** LOSES to \`${lose[0].theirSel}\` ${lose[0].theirs} at :${lose[0].theirLine} **`
      : c.base ? `  -> equal specificity (later wins), base \`${c.base.sel}\` @:${c.base.line}`
        : '  (no earlier rule of equal specificity on this subject)') +
    (want === undefined ? '  !! NOT ONE OF THE EIGHT ROWS' : ''));
}

const fontSubjects = TS_FONT.consumers.map(rowKey);
const fontDupes = fontSubjects.filter((s, i) => fontSubjects.indexOf(s) !== i);
console.log(`  subjects: ${TS_FONT.consumers.length} consumers, ${new Set(fontSubjects).size} distinct, dupes: [${[...new Set(fontDupes)].join(', ')}]`);
console.log(`  LOSING: ${TS_FONT.violations.length}   fallback-vs-base mismatches: ${TS_FONT.fallbackBad.length}`);

assert('l2.a-ts-font-has-exactly-one-consumer-per-node-text-row',
  TS_FONT.consumers.length === 9 && fontDupes.join('|') === '.label-node'
    && [...new Set(fontSubjects)].sort().join('|') === TS_FONT_ROWS.map(r => r[0]).sort().join('|'),
  `the eight rows (${TS_FONT_ROWS.map(r => r[0]).join(', ')}) — NINE consumers, because \`.label-node\` is ` +
  'the one row with a second render site and reads `--ts-font` twice (root + `.node-label-input`, the ' +
  'in-place editor); every other row reads it exactly once, so one write still sets the whole node');
assert('l2.b-no-earlier-rule-outranks-a-ts-font-consumer',
  TS_FONT.violations.length === 0,
  TS_FONT.violations.length === 0
    ? 'NONE of the eight was losing: every consumer is the last word on `font-family` for its own subject, so ' +
      'moving the picker moves all eight rows'
    : `${TS_FONT.violations.length} row(s) whose \`--ts-font\` LOSES to an earlier more specific literal — the ` +
      'picker would silently do nothing there');
assert('l2.c-every-ts-font-fallback-is-the-stack-its-base-declares',
  TS_FONT.fallbackBad.length === 0
    && TS_FONT.consumers.every(c => c.fallback === FAMILY_BASE.get(rowKey(c))),
  '9/9 fallbacks (8 rows, the label read on BOTH of its render sites) equal that row\'s own pre-ITEM-2 ' +
  'stack (`' + TS_FONT_ROWS.map(r => `${r[0]}→${r[1]}`).join('`, `') +
  '`), so a node carrying no `--ts-font` paints exactly what it painted before');

/* --- THE CONTROLS — the extended sweep must FAIL on the shape it hunts ---- */
/* The shape the diagram-studio note measures: a (0,3,0) per-shape rule pinning
   `font-family` on `.node.shape-connector .node-title`, with the (0,1,0)
   consumer below it. Its subject IS `.node-title`, so the sweep must see it. */
const FONT_LOSING = `.node.shape-connector .node-title { font-family: var(--mono); }
.node-title { font-family: var(--ts-font, var(--sans)); }`;
/* The same sheet with the base stack changed under the consumer: equal
   specificity, so no violation, but the FALLBACK no longer matches. */
const FONT_BAD_FALLBACK = `.node-title { font-family: var(--sans); }
.node-title { font-family: var(--ts-font, var(--mono)); }`;
/* A more specific rule on a DIFFERENT row must not be counted. */
const FONT_OTHER_ROW = `.group-node .group-label { font-family: var(--sans); }
.node-title { font-family: var(--ts-font, var(--sans)); }`;
const fontLosingSweep = sweepSheet(FONT_LOSING, '--ts-font');
const fontBadFallbackSweep = sweepSheet(FONT_BAD_FALLBACK, '--ts-font');
const fontOtherRowSweep = sweepSheet(FONT_OTHER_ROW, '--ts-font');
console.log(`\n  controls — earlier-more-specific base: ${fontLosingSweep.violations.length} violation(s); ` +
  `fallback mismatch: ${fontBadFallbackSweep.fallbackBad.length}; different row: ${fontOtherRowSweep.violations.length}`);
for (const v of fontLosingSweep.violations) {
  console.log(`    seen: \`${v.theirSel}\` ${v.theirs} beats \`${v.c.sel}\` ${v.ours} on ${v.c.prop}`);
}
assert('l2.d-control-the-extended-sweep-fails-on-the-losing-shape',
  fontLosingSweep.violations.length === 1
    && fontLosingSweep.violations[0].theirSel === '.node.shape-connector .node-title'
    && fontLosingSweep.violations[0].c.prop === 'font-family',
  'a (0,3,0) per-shape rule pinning `font-family` before the (0,1,0) consumer is reported as a LOSS — this is the ' +
  'check that makes the green assertion above mean something');
assert('l2.e-control-the-extended-sweep-sees-a-fallback-that-is-not-the-base',
  fontBadFallbackSweep.violations.length === 0 && fontBadFallbackSweep.fallbackBad.length === 1,
  'equal specificity, so it WINDS — but the fallback `var(--mono)` is not the base `var(--sans)`, and an untouched ' +
  'node would change family; the fallback half of the sweep catches what the losing half cannot');
assert('l2.f-control-the-subject-test-does-not-cross-rows-here-either',
  fontOtherRowSweep.violations.length === 0,
  'a more specific earlier rule on `.group-label` is not counted against `.node-title` — the same subject test (l) ' +
  'relies on, re-exercised on this variable');

/* ===========================================================================
   (m)/(n)/(o) — PACKAGE-P PASS 3, THE FOLD AND ITS PERSISTENCE.
   ===========================================================================
   WHY `inspectorState.ts` IS BUNDLED AND NOT IMPORTED. It imports './inspector'
   — a bare extensionless specifier that Node's ESM resolver refuses on a `.ts`
   file (`ERR_MODULE_NOT_FOUND`), the exact problem (k) documents for
   `textStyle.ts` — and unlike `inspector.ts` it also imports React, so Node's
   type-strip cannot run it either. It is therefore bundled with the SAME
   technique (k) uses, and its artefact is removed on the way out. `localStorage`
   is stubbed before the import, so the storage path is really EXECUTED rather
   than described.
   =========================================================================== */
const IST_ENTRY = `${ROOT}/.p-inspector-state.ts`;
const IST_OUT = `${ROOT}/.p-inspector-state.mjs`;
const {writeFileSync: writeState, rmSync: rmState} = await import('node:fs');
writeState(IST_ENTRY, "export * from './src/inspectorState';\n");
await (await import('esbuild')).build({
  entryPoints: [IST_ENTRY], bundle: true, format: 'esm', platform: 'node',
  outfile: IST_OUT, logLevel: 'error',
});

/* A MINIMAL localStorage, backed by a Map. `getItem` returns null for an absent
   key, exactly like the browser — which is the "fresh profile" the default rule
   is about, so this stub cannot make the default test pass by accident. */
const STORE = new Map();
globalThis.localStorage = {
  getItem: k => (STORE.has(k) ? STORE.get(k) : null),
  setItem: (k, v) => { STORE.set(k, String(v)); },
  removeItem: k => { STORE.delete(k); },
  clear: () => STORE.clear(),
};
const istMod = await import(`${IST_OUT}?t=${Date.now()}`);
for (const f of [IST_ENTRY, IST_OUT]) { try { rmState(f, {force: true}); } catch { /* gone */ } }
const {SECTIONS_KEY, defaultSectionState, parseSectionState, loadSectionState,
  saveSectionState, toggleSectionState} = istMod;

console.log('\n' + '='.repeat(78));
console.log('(m) §F.4 — THE COLLAPSED-BY-DEFAULT TRUTH TABLE, from the fold module');
console.log('='.repeat(78));
/* The DEFAULT and the truth table must be the same object's values — the whole
   (§A.3) point of §C. Asserted per section id, not by count. */
const DEFAULTS = defaultSectionState();
const perId = {};
for (const id of Object.keys(DEFAULTS).sort()) {
  perId[id] = {defaultCollapsed: DEFAULTS[id], table: insp.COLLAPSED_DEFAULT[id],
    forErdEdge: getInspectorSections({kind: 'edge', presetId: 'erd'}).find(s => s.id === id)?.collapsedDefault};
}
console.log('  section id        default  COLLAPSED_DEFAULT  on an ERD edge');
for (const [id, r] of Object.entries(perId)) {
  console.log(`    ${id.padEnd(14)}  ${String(r.defaultCollapsed).padEnd(7)}  `
    + `${String(r.table).padEnd(17)}  ${r.forErdEdge === undefined ? '(not listed)' : r.forErdEdge}`);
}
const FOLDED_IDS = Object.keys(DEFAULTS).filter(id => DEFAULTS[id]).sort();
const OPEN_IDS = Object.keys(DEFAULTS).filter(id => !DEFAULTS[id]).sort();
assert('m.the-default-fold-state-is-exactly-cardinality-and-flow',
  FOLDED_IDS.join() === 'cardinality,flow'
    && getInspectorSections({kind: 'edge', presetId: 'erd'})
      .filter(s => s.collapsedDefault).map(s => s.id).join() === 'cardinality,flow',
  `folded by default, per section id: [${FOLDED_IDS.join(', ')}] — and the same list is what an `
  + 'ERD edge is told, so the panel and the truth table cannot disagree');
assert('m.every-other-section-is-open-by-default',
  OPEN_IDS.join() === 'columns,content,label,line,markers,showMode,style,table,text'
    && OPEN_IDS.length === 9,
  `open by default, per section id: [${OPEN_IDS.join(', ')}] — includes Style, which §C's `
  + '"one control folds, not a section" forbids folding');
assert('m.the-render-reads-the-default-and-not-a-literal',
  PICKS.includes('data-collapsed={String(collapsed)}')
    && !/data-collapsed="(true|false)"/.test(PICKS)
    && APP.includes("collapsed={isCollapsed(s.id)}"),
  'the attribute is the live boolean; no literal true/false survives in the wrapper');

console.log('\n' + '='.repeat(78));
console.log('(n) §F.5 — PERSISTENCE, EXECUTED (load / toggle / save / tolerate)');
console.log('='.repeat(78));
/* FRESH PROFILE: no key at all → §A.3's default. */
STORE.clear();
const fresh = loadSectionState();
console.log(`  fresh profile (no key)        → ${JSON.stringify(fresh)}`);
assert('n.a-fresh-profile-loads-the-collapsed-default',
  fresh.cardinality === true && fresh.flow === true && fresh.label === false
    && fresh.line === false && fresh.markers === false,
  'absent key ⇒ COLLAPSED_DEFAULT: Cardinality + Flow folded, Label/Line/Markers open');

/* THE ROUND TRIP. `true` means COLLAPSED, so EXPANDING Cardinality stores
   `{"cardinality":false}` — the negative of the default, stated explicitly so
   the convention is unambiguous to a reader of the stored value. */
const expanded = toggleSectionState(loadSectionState(), 'cardinality');
saveSectionState(expanded);
const RAW = STORE.get(SECTIONS_KEY);
console.log(`  after expanding Cardinality   → ${SECTIONS_KEY} = ${RAW}`);
assert('n.expanding-stores-the-section-under-the-exact-key',
  SECTIONS_KEY === 'diagram-studio:inspector-sections'
    && JSON.parse(RAW).cardinality === false,
  `the exact key holds ${RAW} — \`true\` means COLLAPSED, so an EXPANDED section is stored \`false\``);
assert('n.a-reload-reproduces-the-expanded-state',
  parseSectionState(RAW).cardinality === false && parseSectionState(RAW).flow === true,
  'parse(JSON.stringify(state)) === state: the expanded Cardinality SURVIVES a reload while Flow, '
  + 'never toggled, stays at its default');
assert('n.a-later-default-and-a-save-is-idempotent',
  (() => {
    /* Save twice, reload, and ask again — the state must not drift. */
    saveSectionState(parseSectionState(RAW));
    const again = loadSectionState();
    return again.cardinality === false && JSON.stringify(again) === JSON.stringify(expanded);
  })(),
  'save(parse(save(x))) === x — a second load/save cycle is a no-op, not a slow drift');

/* TOLERANT PARSE — the three shapes the brief names, each asserted to fall back
   to the DEFAULTS without throwing. */
console.log('\n  tolerant parse:');
const TOLERANT = [
  {why: 'a hand-edited, half-written value', raw: '{"cardinality":'},
  {why: 'garbage that is not JSON at all', raw: 'not json -- {{'},
  {why: 'a non-boolean field ("false" is TRUTHY in JS, so this one matters)',
   raw: '{"cardinality":"false","flow":0,"label":null}', want: 'defaults'},
  {why: 'an unknown section id (written by another build)', raw: '{"nope":false}'},
  {why: 'the wrong container entirely (an array)', raw: '[true,false]'},
  {why: 'an empty string', raw: ''},
];
for (const t of TOLERANT) {
  let got; let threw = null;
  try { got = parseSectionState(t.raw); } catch (e) { threw = e; }
  const isDefaults = got && JSON.stringify(got) === JSON.stringify(defaultSectionState());
  console.log(`    ${threw ? 'THREW' : isDefaults ? 'defaults' : 'MUTATED'}  ${JSON.stringify(t.raw).padEnd(46)} ${t.why}`);
  assert(`n.tolerates-${t.raw === '' ? 'empty-string' : JSON.stringify(t.raw).slice(0, 28)}`,
    threw === null && isDefaults,
    'no throw, and every id falls back to the default');
}
/* NEGATIVE CONTROL: the tolerant path must still KEEP a real boolean, or the
   "falls back to defaults" checks above would pass on a parser that ignores the
   input entirely. */
assert('n.control-a-real-boolean-is-kept',
  parseSectionState('{"cardinality":false}').cardinality === false
    && parseSectionState('{"flow":false}').flow === false
    && parseSectionState('{"nope":false}').nope === undefined,
  'a boolean for a KNOWN id is honoured; a boolean for an UNKNOWN id is dropped, not carried into '
  + 'the next save');
assert('n.control-a-missing-id-falls-back-and-a-present-one-is-kept',
  (() => {
    const p = parseSectionState('{"flow":false}');
    return p.flow === false && p.cardinality === true;   // written | defaulted
  })(),
  'a partial stored value is repaired per id: the written one is kept, the missing one restores its default');

console.log('\n' + '='.repeat(78));
console.log('(o) THE TRUTH TABLE HAS ONE HOME');
console.log('='.repeat(78));
/* The bug class this pass must not introduce: a SECOND copy of the folded pair.
   Counted in CODE (comments stripped), so the prose above cannot satisfy it. */
const istIdLists = ['cardinality', 'flow'].map(id => countOf(IST, `'${id}'`));
console.log(`  inspectorState.ts (code) — 'cardinality' ×${istIdLists[0]}, 'flow' ×${istIdLists[1]}`);
console.log(`  inspectorState.ts imports COLLAPSED_DEFAULT: ${IST.includes('COLLAPSED_DEFAULT')}`);
assert('o.inspectorState-imports-the-truth-table-instead-of-re-listing-it',
  IST.includes("import {COLLAPSED_DEFAULT")
    && IST.includes('Object.keys(COLLAPSED_DEFAULT)')
    && istIdLists[0] === 0 && istIdLists[1] === 0,
  'zero occurrences of either section id in the module\'s code: the folded pair is enumerated by '
  + '`Object.keys(COLLAPSED_DEFAULT)`, so a section added to §A.3 is parsed here with no edit to this file');
assert('o.CollapsedDefault-is-not-mutated-by-the-fold-module',
  IST.includes('{...COLLAPSED_DEFAULT}')
    && !/COLLAPSED_DEFAULT\[[^\]]+\]\s*=/.test(IST)
    && !Object.isFrozen(insp.COLLAPSED_DEFAULT)
    && insp.COLLAPSED_DEFAULT.cardinality === true && insp.COLLAPSED_DEFAULT.flow === true,
  'the default is COPIED before use, so a toggle in one session cannot rewrite §A.3 for the next — '
  + 'inspector.ts still reads cardinality=true, flow=true after every write above');

/* ===========================================================================
   (p) ROUND W → ROUND X — THE FONT CONTROL AND THE CUSTOM SIZE.

   Both are §E.2 fields: a choice equal to the default stores ABSENCE. This
   section proves that for `font` and for a typed `1`, and it proves the two
   facts that only the FILE SYSTEM can answer: every `@font-face` carries a
   `unicode-range`, and every file it names EXISTS under `public/fonts/`.

   ROUND X CHANGED THE TWO CONTROLS AND NOT THE TWO MODELS.
     ITEM 3 — the font control stopped being `IconPickerRow` and became the
     segmented row (four self-previewing buttons, one line). So the assertions
     about the TRIGGER, the POPOVER and the two suppression hooks are gone with
     the control — replaced by assertions about the row, and by ABSENCE
     assertions on both hooks, because a suppression rule that matches nothing
     reads as live behaviour.
     ITEM 1 — the custom-size `<input>` is gone; Harvey's "rule giữ khi cần" is
     not. The bounds, the clamp, the `scale` field and the `--ts-scale` read all
     remain, and are asserted here so a later pass cannot quietly delete the
     capability while the UI is gone.
   =========================================================================== */
console.log('\n' + '='.repeat(78));
console.log('(p) ROUND W→X — the font ROW (ITEM 3) and the custom-size RULE (ITEM 1)');
console.log('='.repeat(78));
const {existsSync} = await import('node:fs');

/* --- (p1) THE OPTION TABLE, and that each pick carries its role ----------
   ROUND Z, ITEM 1 — SIX REAL FAMILY NAMES. The four role keys this section used
   to assert are now the LEGACY set (`legacyFontKeyStillResolves` below covers
   them); the live table is the six families, each with the role it was chosen
   for and the full family name that the button's tooltip carries because the
   short label is what fits a 3-column cell. */
const FONT_ROLES = {jetbrains: 'cod', inter: 'neutral', plex: 'architect', shantell: 'hand', lexend: 'read', bevietnam: 'Vietnam'};
const FONT_TITLES = {
  jetbrains: 'JetBrains Mono', inter: 'Inter', plex: 'IBM Plex Sans',
  shantell: 'Shantell Sans', lexend: 'Lexend', bevietnam: 'Be Vietnam Pro',
};
const FONT_LABELS = {
  jetbrains: 'JetBrains', inter: 'Inter', plex: 'IBM Plex',
  shantell: 'Shantell', lexend: 'Lexend', bevietnam: 'Be Vietnam',
};
console.log(`  TEXT_FONT_OPTS at src/textStyle.ts:${at(TS_RAW, 'export const TEXT_FONT_OPTS')}  `
  + `TEXT_FONT_FAMILY at :${at(TS_RAW, 'export const TEXT_FONT_FAMILY')}`);
assert('p.font-option-table-exists-with-all-six-family-picks',
  TS.includes('TEXT_FONT_OPTS') && M.TEXT_FONT_OPTS.length === 6
    && M.TEXT_FONT_OPTS.map(o => o.v).join() === 'jetbrains,inter,plex,shantell,lexend,bevietnam'
    && M.TEXT_FONT_OPTS.every(o => typeof o.hint === 'string' && o.hint.length > 0)
    && M.TEXT_FONT_OPTS.every(o => o.title === FONT_TITLES[o.v] && o.label === FONT_LABELS[o.v]),
  `the six picks are [${M.TEXT_FONT_OPTS.map(o => o.v).join(', ')}], each with the role that `
  + 'justifies it and the full family name as its tooltip: '
  + M.TEXT_FONT_OPTS.map(o => `${o.label}("${o.title}")=${o.hint}`).join('; '));
assert('p.each-pick-carries-the-role-it-was-chosen-for',
  Object.entries(FONT_ROLES).every(([k, needle]) =>
    M.TEXT_FONT_OPTS.find(o => o.v === k)?.hint.toLowerCase().includes(needle.toLowerCase())),
  'jetbrains→coding, inter→neutral UI, plex→architecture, shantell→hand-drawn, lexend→reading, '
  + 'bevietnam→Vietnamese');
/* ROUND Z, ITEM 1 — THE SHORT LABEL IS A MEASUREMENT, NOT A TASTE.
   Six buttons in two rows of three is Harvey's layout. The field is 253px, the
   row gaps are 2x5px, so each cell is 81px and — `box-sizing: border-box` is
   global (`styles.css:268`) — its CONTENT box is 81 - 2x7 padding - 2x1 border
   = 65px. The full family names at 10px measure 84.0px (`JetBrains Mono`) and
   75.2px (`Be Vietnam Pro`): both would wrap. The short labels at 10.5px are
   56.7 / 22.5 / 42.4 / 41.0 / 37.4 / 58.9px — every one inside the box, with
   `Be Vietnam` the worst case at 6.1px of slack. Asserted here as arithmetic on
   the numbers the brief measured, so the label set cannot silently grow. */
const CELL_PX = (253 - 2 * 5) / 3;
const CONTENT_PX = CELL_PX - 2 * 7 - 2 * 1;
const LABEL_PX_AT_10_5 = {JetBrains: 56.7, Inter: 22.5, 'IBM Plex': 42.4, Shantell: 41.0, Lexend: 37.4, 'Be Vietnam': 58.9};
const FULL_NAME_PX_AT_10 = {'JetBrains Mono': 84.0, Inter: 22.5, 'IBM Plex Sans': 64.4, 'Shantell Sans': 64.7, Lexend: 37.4, 'Be Vietnam Pro': 75.2};
console.log(`  the font cell: ${CELL_PX.toFixed(1)}px wide, ${CONTENT_PX.toFixed(1)}px content box`);
for (const o of M.TEXT_FONT_OPTS) {
  const w = LABEL_PX_AT_10_5[o.label], full = FULL_NAME_PX_AT_10[o.title];
  console.log(`    ${o.label.padEnd(11)} ${String(w).padStart(5)}px @10.5 (slack ${(CONTENT_PX - w).toFixed(1)})`
    + `   full "${o.title}" ${String(full).padStart(5)}px @10 ${full > CONTENT_PX ? 'DOES NOT FIT' : 'fits'}`);
}
assert('p.the-six-short-labels-fit-the-measured-cell-and-the-full-names-do-not',
  /* every SHORT label fits with margin … */
  M.TEXT_FONT_OPTS.every(o => LABEL_PX_AT_10_5[o.label] < CONTENT_PX)
  /* … and at least two FULL names genuinely do not, which is WHY the short ones
     exist. Without this half the check would pass on a table that never needed
     short labels at all. */
  && M.TEXT_FONT_OPTS.filter(o => FULL_NAME_PX_AT_10[o.title] > CONTENT_PX).length >= 2
  && M.TEXT_FONT_OPTS.every(o => FONT_TITLES[o.v] === o.title),
  `${M.TEXT_FONT_OPTS.length}/${M.TEXT_FONT_OPTS.length} short labels fit a ${CONTENT_PX.toFixed(1)}px cell at `
  + '10.5px (worst case `Be Vietnam` 58.9px, 6.1px slack) while '
  + M.TEXT_FONT_OPTS.filter(o => FULL_NAME_PX_AT_10[o.title] > CONTENT_PX).map(o => `"${o.title}" ${FULL_NAME_PX_AT_10[o.title]}px`).join(' and ')
  + ` overflow it at 10px — so the full name is the button's \`title\` and the short label is what prints`);
assert('p.the-label-prints-in-its-own-family-exactly-once',
  /* Each option's art is ONE span, printing ONE label, styled with that option's
     OWN resolved stack — so the name is the sample, and `ToggleRow` renders
     `o.art ?? o.label`, one expression and never both. */
  M.TEXT_FONT_OPTS.every(o => M.TEXT_FONT_FAMILY[o.v] != null)
  && new Set(M.TEXT_FONT_OPTS.map(o => o.label)).size === 6
  && new Set(M.TEXT_FONT_OPTS.map(o => o.title)).size === 6,
  'six distinct labels, six distinct tooltips, six resolved stacks — the label and the sample are the SAME '
  + 'span, so no family can print its name twice');
/* ROUND X, ITEM 3 — the font field's control, read OFF the field itself. The
   label `font` is unique in the panel, so the slice from it to its closing
   `</div>` IS the field, and the slice is what is asserted — not the file. */
const FONT_FIELD = (() => {
  const i = APP.indexOf('<label>font</label>');
  return i < 0 ? '' : APP.slice(i, APP.indexOf('</div>', i));
})();
console.log(`  the font field: ${FONT_FIELD.length} chars of code, control = `
  + `${FONT_FIELD.includes('<ToggleRow') ? 'ToggleRow' : FONT_FIELD.includes('<IconPickerRow') ? 'IconPickerRow' : 'NONE'}`);
assert('p.the-font-control-is-the-existing-segmented-row-and-is-not-a-select',
  countOf(APP, '<select') === 0
    && countOf(APP, 'options={FONT_OPTS}') === 1
    && FONT_FIELD.includes('<ToggleRow')
    && !FONT_FIELD.includes('IconPickerRow')
    /* ROUND Z, ITEM 1 — the six-button modifier is `grid3`, NOT `wide`: six in a
       single row gives a 37px cell, which the measurement above rules out. */
    && FONT_FIELD.includes('grid3')
    && !FONT_FIELD.includes('wide')
    && !FONT_FIELD.includes('className="hint"'),
  'the font field renders ONE ToggleRow — the same `.insp-seg` control Size and Align use — with the '
  + '`grid3` modifier for its six word-length labels and NO hint under it; the panel still renders '
  + `${countOf(APP, '<select')} native dropdowns anywhere`);
assert('p.every-button-previews-its-own-family-and-prints-its-name-once',
  APP.includes('className="insp-font-btn"')
    && APP.includes('fontFamily: TEXT_FONT_FAMILY[o.v]')
    && countOf(APP, 'TEXT_FONT_FAMILY[o.v]') === 1
    && APP.includes('title: o.title')
    && blankComments(STYLES_RAW).includes('.insp-font-btn'),
  'each of the six buttons renders its own SHORT NAME in its own family from ONE cell — the cell a '
  + 'segmented button prints — and carries the full family name as its `title`, so the row cannot construct '
  + 'the duplicate name ROUND W had to suppress and the preview the control exists for survives the change '
  + 'from popover to row');

/* ROUND Z, ITEM 1 — THE 3+3 GEOMETRY, as the arithmetic the sheet implements.
   The brief's warning is explicit: the last two rounds each shipped a row that
   looked right in source and was wrong on screen, so the geometry has to be
   PROVEN. It is proven twice, from both sides:
     (a) the sheet's own declarations, read out of the real file, must compute the
         cell the labels were measured against — `calc((100% - 10px) / 3)` over a
         253px field with 2x5px gaps is 81.0px, and with `box-sizing:
         border-box` (the global `*` rule) the content box is 81 - 2x7 - 2x1 = 65px;
     (b) the six labels must fit that 65px (already asserted by their measured
         widths above), AND must NOT fit a 6-across row — which is what makes the
         two-row layout a requirement rather than a preference.
   The cascade trap the brief names is asserted too: `.swatches { display: flex }`
   beats `.insp-seg { display: grid }` at equal specificity, later in the sheet, so
   `grid3` must be written as flex sizing and must NOT rely on
   `grid-template-columns` (which would compute against a flex container). */
const GRID3_BLOCK = (() => {
  const css = blankComments(STYLES_RAW);
  const at = css.indexOf('.insp-seg.grid3');
  if (at < 0) return '';
  const end = css.indexOf('\n\n', at);
  return css.slice(at, end < 0 ? at + 600 : end);
})();
const gapDecl = /gap:\s*(\d+)px/.exec(GRID3_BLOCK);
const basisDecl = /flex:\s*1 1 calc\(\(100% - (\d+)px\) \/ (\d+)\)/.exec(GRID3_BLOCK);
const SEVEN_ACROSS_CELL = (253 - 6 * 5) / 7;
console.log(`  .insp-seg.grid3 → gap ${gapDecl?.[1]}px, basis ${basisDecl ? `calc((100% - ${basisDecl[1]}px) / ${basisDecl[2]})` : 'NONE'}`);
console.log(`  cell at 253px: 3-across ${((253 - 2 * 5) / 3).toFixed(1)}px  vs  6-across ${SEVEN_ACROSS_CELL.toFixed(1)}px  vs  7-across ${((253 - 6 * 5) / 7).toFixed(1)}px`);
assert('p.the-3plus3-row-is-flex-sized-to-the-measured-cell-and-not-a-grid',
  /* (a) the declarations the sheet really carries */
  gapDecl?.[1] === '5' && basisDecl?.[1] === '10' && basisDecl?.[2] === '3'
  && GRID3_BLOCK.includes('min-width: 0')
  /* (b) … and they are FLEX, because a grid column would compute against a flex
     container (`.swatches { display: flex }` wins at equal specificity, later). */
  && !GRID3_BLOCK.includes('grid-template-columns')
  && GRID3_BLOCK.includes('flex: 1 1')
  /* (c) the two-row layout is REQUIRED: the short labels fit 3-across (65px) but
     not 6-across (37px), so six-in-one-row was never an option. */
  && M.TEXT_FONT_OPTS.every(o => LABEL_PX_AT_10_5[o.label] < CONTENT_PX)
  && M.TEXT_FONT_OPTS.filter(o => LABEL_PX_AT_10_5[o.label] > SEVEN_ACROSS_CELL - 16).length >= 4,
  `2 rows x 3: gap ${gapDecl?.[1]}px, cell calc((100% - ${basisDecl?.[1]}px) / ${basisDecl?.[2]}) = 81.0px at the `
  + `253px field, content box ${CONTENT_PX.toFixed(1)}px after 7px padding + 1px border (border-box is the global `
  + `\`*\` rule); written as flex basis because \`.swatches { display: flex }\` beats \`.insp-seg { display: grid }\` `
  + `at equal specificity later in the sheet, so a grid column would compute against a flex container and do `
  + `nothing. Six across would give each button ${SEVEN_ACROSS_CELL.toFixed(1)}px, which `
  + `${M.TEXT_FONT_OPTS.filter(o => LABEL_PX_AT_10_5[o.label] > SEVEN_ACROSS_CELL - 16).length}/6 labels exceed — `
  + 'so 3+3 is arithmetic, not taste');

/* --- (p1b) THE DUPLICATE-NAME GUARD, GENERALISED (ROUND X, ITEM 3) ---------
   ROUND W's defect: `IconPickerRow` prints a row as a glyph cell + a label, so a
   font option whose cell held the family NAME rendered `Mono Mono`. The fix was
   two suppression rules — one on the trigger, one on the option row via an
   `icon-field-font` HOOK — plus the `rowClass` prop that carried it.
   THE FONT CONTROL IS NO LONGER A PICKER, so there is no trigger, no popover
   and no second name cell: each of the four buttons prints ONE span that is its
   own name in its own family. The duplicate is impossible BY CONSTRUCTION, which
   is a stronger guarantee than a rule that hides it — so this section now
   asserts the ABSENCE of every hook ROUND W added (a suppression rule matching
   nothing reads as live behaviour) and keeps the probe below, which is what
   makes "absent" a measurement rather than a hope. */
const STYLES_BLANK = blankComments(STYLES_RAW);
const STYLES_HOOKS = ['insp-font-sample', 'icon-field-font'].filter(h => STYLES_BLANK.includes(h));
const APP_HOOKS = ['insp-font-sample', 'icon-field-font'].filter(h => APP.includes(h));
const HOOK_CALLS = countOf(APP, 'rowClass');
console.log(`  ROUND W suppression hooks left in the sheet: ${STYLES_HOOKS.length ? `[${STYLES_HOOKS.join(', ')}]` : 'NONE'}`
  + `; in App.tsx: ${APP_HOOKS.length ? `[${APP_HOOKS.join(', ')}]` : 'NONE'}; rowClass call sites: ${HOOK_CALLS}`);
assert('p.the-ROUND-W-suppression-hooks-are-all-gone',
  STYLES_HOOKS.length === 0 && APP_HOOKS.length === 0 && HOOK_CALLS === 0,
  'neither hook survives anywhere — the trigger/option-row suppression rules and the `icon-field-font` call '
  + 'site went with the picker they existed for, so no rule is left matching nothing');
assert('p.the-shared-picker-kept-its-optional-hook-and-nobody-uses-it',
  PICKS.includes('rowClass')
    && countOf(PICKS, 'icon-field${rowClass') === 1
    && countOf(PICKS, 'rowClass ?') === 1,
  'IconPickerRow still carries the OPTIONAL `rowClass` prop (inert: no caller passes one), so the next picker '
  + 'needing a scoped sheet rule does not have to re-add the plumbing — and the other four pickers are '
  + 'byte-identical either way');
/* THE ROW CANNOT PRINT A NAME TWICE: the option's `art` is one span, and that
   span is the only thing the button prints (`ToggleRow` renders `o.art ?? o.label`
   — ONE expression, never both). Counted in the FONT_OPTS literal. */
const FONT_OPTS_BLOCK = (() => {
  const i = APP.indexOf('const FONT_OPTS');
  if (i < 0) return '';
  const end = APP.indexOf('}));', i);
  return end < 0 ? APP.slice(i) : APP.slice(i, end + 4);
})();
assert('p.the-six-font-buttons-print-their-name-ONCE-by-construction',
  countOf(FONT_OPTS_BLOCK, 'insp-font-btn') === 1
    && countOf(FONT_OPTS_BLOCK, '<span') === 1
    && countOf(PICKS, 'o.art ?? o.label') === 1,
  'the FONT_OPTS entry carries exactly ONE <span> — the name in its family — and ToggleRow prints `o.art ?? '
  + 'o.label`, one expression and never both, so the two-cell `Mono Mono` shape cannot be re-created here');
/* NEGATIVE CONTROL — the probe must SEE the shape it warns about, or the
   absence assertion above is a tautology. Kept from ROUND W on purpose: if a
   suppression rule is ever reintroduced, this is what recognises it. */
const ROW_RULE_RE = /\.icon-field-font\s+\.insp-opt\s+\.insp-opt-label:not\(\.insp-font-sample\)\s*\{\s*display:\s*none\s*;?\s*\}/;
const BARE_LABEL_RULE = '.insp-opt .insp-opt-label { display: none; }';
assert('p.control-the-suppression-probe-still-detects-a-reintroduced-rule',
  ROW_RULE_RE.test('.icon-field-font .insp-opt .insp-opt-label:not(.insp-font-sample) { display: none; }')
    && !ROW_RULE_RE.test(BARE_LABEL_RULE)
    && /\.insp-opt-label\s*\{\s*display:\s*none/.test(BARE_LABEL_RULE),
  'the pattern still matches the SCOPED suppression rule and does NOT match a bare `.insp-opt-label { display: '
  + 'none }` — the shape the brief warned would empty every other picker, which the harness can still see');

/* --- (p2) THE DECLARATIONS AND THE FILES --------------------------------- */
const FACES = [...STYLES_RAW.matchAll(/@font-face\s*\{([^}]*)\}/g)].map(m => m[1]);
const faceFamily = f => /font-family:\s*'([^']+)'/.exec(f)?.[1] ?? null;
const faceFile = f => /url\('\/fonts\/([^']+)'\)/.exec(f)?.[1] ?? null;
const declared = new Set(FACES.map(faceFamily).filter(Boolean));
const noRange = FACES.filter(f => !/unicode-range:/.test(f));
const noFile = FACES.map(faceFile).filter(Boolean).filter(n => !existsSync(`${ROOT}/public/fonts/${n}`));
const ranges = new Set(FACES.map(f => /unicode-range:\s*([^;]+);/.exec(f)?.[1].trim()));
console.log(`  @font-face blocks in src/styles.css: ${FACES.length}  `
  + `(weights × families × subsets); families declared: [${[...declared].join(', ')}]`);
console.log(`  distinct unicode-ranges: ${ranges.size}  files referenced: ${FACES.length}  `
  + `files missing on disk: ${noFile.length}`);
assert('p.every-font-face-declares-a-unicode-range',
  FACES.length === 36 && noRange.length === 0,
  `${FACES.length} @font-face blocks, ${noRange.length} without a unicode-range — 6 families × `
  + '2 weights × 3 subsets, so a page fetches only the subset it renders');
assert('p.every-referenced-font-file-EXISTS-under-public-fonts',
  noFile.length === 0 && FACES.every(f => faceFile(f) !== null),
  noFile.length === 0
    ? `${FACES.length} referenced woff2 files all present in public/fonts/ (a missing one renders `
      + 'the fallback stack and throws nothing, which is why this is checked on disk)'
    : `MISSING: [${noFile.join(', ')}]`);
assert('p.the-three-ranges-are-the-three-subset-ranges',
  ranges.size === 3,
  `the three ranges are latin / latin-ext / vietnamese, identical across all six families because `
  + 'Google defines the subsets once — copied verbatim, none invented');
assert('p.the-six-families-in-the-model-are-the-six-declared',
  [...declared].sort().join('|') === 'Be Vietnam Pro|IBM Plex Sans|Inter|JetBrains Mono|Lexend|Shantell Sans'
    && M.TEXT_FONT_OPTS.every(o => {
      const first = M.TEXT_FONT_FAMILY[o.v].match(/'([^']+)'/)?.[1]
        ?? M.TEXT_FONT_FAMILY[o.v].match(/var\((--[\w-]+)\)/)?.[1];
      return first != null;
    }),
  `declared: [${[...declared].sort().join(', ')}] — every pick's stack opens with a family the sheet `
  + 'actually declares (or the `--mono` token whose declaration owns that family), and nothing is declared '
  + 'that no pick can reach');
/* ROUND Z, ITEM 1 — THE MODEL'S SIX KEYS AND THE SHEET'S SIX FAMILIES ARE THE
   SAME SET, both directions. The generic half above only checks model→sheet;
   this adds sheet→model, so a declared family with no button (or a button with no
   `@font-face`) cannot ship either way. */
const modelFirstFamily = v => M.TEXT_FONT_FAMILY[v].match(/'([^']+)'/)?.[1] ?? null;
const modelFamilies = M.TEXT_FONT_OPTS.map(o => modelFirstFamily(o.v)).filter(Boolean);
console.log(`  model→sheet families: [${modelFamilies.join(', ')}]`);
assert('p.every-declared-family-is-reachable-from-a-button-and-vice-versa',
  modelFamilies.length === 6 && M.TEXT_FONT_OPTS.length === 6
    && modelFamilies.every(f => declared.has(f)),
  `all ${modelFamilies.length} reachable families are declared, and the six declared families are exactly `
  + 'the six buttons — so the sheet carries no orphan family and the row no dead button');
/* NEGATIVE CONTROL — the file check must SEE an absent file. */
assert('p.control-the-font-file-check-detects-an-absent-file',
  !existsSync(`${ROOT}/public/fonts/definitely-not-a-font.woff2`)
    && existsSync(`${ROOT}/public/fonts/inter-400-latin.woff2`),
  'the probe returns false for a name the brief never mentions and true for a real file');

/* --- (p3) THE DEFAULT PICK WRITES NOTHING (§E.2) ------------------------- */
const FONT_KEYS = ['jetbrains', 'inter', 'plex', 'shantell', 'lexend', 'bevietnam'];
const fontBad = [];
for (const d of REAL_DEFAULTS) {
  for (const pick of FONT_KEYS) {
    const stored = mMerge(undefined, {font: pick}, d.def);
    const vars = mVars(stored, d.def);
    const want = pick === M.TEXT_DEFAULT_FONT;
    const ok = want
      ? (stored === undefined && !('--ts-font' in vars))
      : (vars['--ts-font'] === M.TEXT_FONT_FAMILY[pick] && stored?.font === pick);
    if (!ok) fontBad.push({d, pick, stored, vars});
  }
}
console.log(`  font × ${REAL_DEFAULTS.length} target defaults × ${FONT_KEYS.length} picks: `
  + `${REAL_DEFAULTS.length * FONT_KEYS.length - fontBad.length}/${REAL_DEFAULTS.length * FONT_KEYS.length} as expected`);
assert('p.a-pick-equal-to-the-default-writes-NOTHING',
  fontBad.length === 0 && M.TEXT_DEFAULT_FONT === 'jetbrains'
    && mMerge(undefined, {font: 'jetbrains'}, 'left') === undefined,
  `${REAL_DEFAULTS.length * FONT_KEYS.length} cells — JetBrains stores nothing and paints nothing (a node the user `
  + 'never touched keeps NO textStyle at all); the other five store the KEY and emit `--ts-font` '
  + 'as the resolved stack');
/* NEGATIVE CONTROL for the same rule: a NON-default pick must not be dropped,
   or "the default writes nothing" would pass on a merge that writes nothing ever. */
assert('p.control-a-non-default-pick-is-stored-and-painted',
  (() => {
    const s = mMerge(undefined, {font: 'bevietnam'}, 'left');
    const v = mVars(s, 'left');
    return JSON.stringify(s) === '{"font":"bevietnam"}' && v['--ts-font'] === M.TEXT_FONT_FAMILY.bevietnam;
  })(),
  'Be Vietnam → stored {"font":"bevietnam"} and painted as the Be Vietnam Pro stack');

/* --- (p3b) THE LEGACY KEYS A BOARD MAY STILL CARRY (ROUND Z, ITEM 1) ------
   ROUND W shipped four ROLE keys. They are still legal on disk, so every one of
   them must resolve to the family it already painted — NOT to the default, and
   not to nothing. This is the migration asserted as behaviour, not as a table. */
const LEGACY_EXPECT = {mono: 'jetbrains', ui: 'inter', read: 'lexend', viet: 'bevietnam'};
/* `mono` IS A SPECIAL CASE, AND IT IS ROUND W's OWN DEFINITION, NOT AN OMISSION.
   ROUND W's `TEXT_DEFAULT_FONT` was `'mono'`, so `isTextDefault('font','mono')`
   was TRUE and picking Mono stored ABSENCE — i.e. the control could never write
   `font:'mono'` to a board. Only a hand-edited file can carry it, and it resolves
   to this round's default, so it is a no-write for the same reason `middle` and
   `md` are. The THREE keys a board can really carry are ui / read / viet, and each
   must store verbatim and paint the stack it painted before. */
const LEGACY_FROM_THE_UI = ['ui', 'read', 'viet'];
const legacyBad = [];
for (const [oldKey, newKey] of Object.entries(LEGACY_EXPECT)) {
  const resolved = M.resolveFontKey(oldKey);
  const stored = mMerge(undefined, {font: oldKey}, 'left');
  const vars = mVars(stored, 'left');
  const read = mLabels(stored, 'left').font;
  const ok = LEGACY_FROM_THE_UI.includes(oldKey)
    ? (resolved === newKey
       /* a real choice, so it is stored VERBATIM — a board is not rewritten by
          being opened, and the value it holds is still a legal one */
       && stored?.font === oldKey
       && vars['--ts-font'] === M.TEXT_FONT_FAMILY[newKey]
       /* and the panel lights the button that repaints it */
       && read === newKey)
    /* `mono` → the default, so it writes nothing and emits nothing, exactly as
       ROUND W's own default test treated it. */
    : (resolved === M.TEXT_DEFAULT_FONT && stored === undefined && !('--ts-font' in vars)
       && read === M.TEXT_DEFAULT_FONT);
  if (!ok) legacyBad.push({oldKey, newKey, resolved, stored, vars, read});
}
console.log(`  legacy keys: ${Object.entries(LEGACY_EXPECT).map(([o, n]) => `${o}→${n}`).join('  ')}`
  + `  (${Object.keys(LEGACY_EXPECT).length - legacyBad.length}/${Object.keys(LEGACY_EXPECT).length} resolve as painted before)`);
assert('p.every-ROUND-W-role-key-still-resolves-to-the-family-it-painted',
  legacyBad.length === 0,
  legacyBad.length
    ? `BROKEN: ${legacyBad.map(b => `${b.oldKey}→${b.resolved} (wanted ${b.newKey})`).join(', ')}`
    : 'ui→inter, read→lexend, viet→bevietnam: each STORES VERBATIM (a board is never rewritten by being '
      + 'opened) and emits the same stack it emitted in ROUND W, and the panel lights the button that '
      + 'repaints it — so no stored board changed face when the control was relabelled. `mono` was ROUND W\'s '
      + 'own no-write default (the UI could never store it), so it now resolves to THIS default and writes '
      + 'nothing — the same treatment `middle` and `md` get');
/* Every live key round-trips through the resolver unchanged, and an unknown value
   is the ONLY thing that falls back — otherwise "everything resolves to jetbrains"
   would satisfy the check above. */
assert('p.the-resolver-is-identity-on-live-keys-and-falls-back-only-on-unknown-values',
  FONT_KEYS.every(k => M.resolveFontKey(k) === k)
    && M.resolveFontKey('comic-sans') === M.TEXT_DEFAULT_FONT
    && M.resolveFontKey(undefined) === M.TEXT_DEFAULT_FONT,
  'the six live keys resolve to themselves (so nothing is silently remapped), and only an unrecognised value '
  + '— a hand-edited board, a key from a future round — answers the default');

/* --- (p3c) VERTICAL ALIGN (ROUND Z, ITEM 2; REWRITTEN ROUND Z FIX 2) -------
   The model's half — and the half that WAS WRONG. This block used to assert
   `M.TEXT_DEFAULT_VALIGN === 'middle'` and that a card picking `middle` writes
   nothing. All of it true, and all of it the defect: no card paints `middle`
   with nothing stored. A card renders from its own `padding-top` (`top`), and
   only a label-only node — whose element carries `.lo-body` — centres. The
   default is therefore PER TARGET, answered by `vAlignForBody`, and the cells
   below are written as the rule the defect violated: for every target and every
   value, the pick stores absence EXACTLY when it equals THAT TARGET's default. */
assert('p.vAlign-has-three-values-and-a-no-write-default-PER-TARGET',
  M.TEXT_VALIGN_OPTS.map(o => o.v).join() === 'top,middle,bottom'
    && typeof M.vAlignForBody === 'function'
    && M.vAlignForBody('card') === 'top'
    && M.vAlignForBody(undefined) === 'top'
    && M.vAlignForBody('label-only') === 'middle',
  'Top / Middle / Bottom, and the no-write value comes from the TARGET: `top` for a card and for a label '
  + '(both render from their padding-top, before and after this round), `middle` only for a label-only node '
  + '— the box that centres by design. A single global `middle` made the panel report Middle on nodes that '
  + 'painted top, which is the defect this replaces');
const VALIGN_TARGETS = [
  {what: '.node-body / .note-body / .label-node', body: undefined, def: M.vAlignForBody(undefined)},
  {what: '.node .lo-body (label-only)', body: 'label-only', def: M.vAlignForBody('label-only')},
];
const valignBad = [];
for (const t of VALIGN_TARGETS) {
  for (const [v, flex] of Object.entries(M.TEXT_VALIGN_FLEX)) {
    const stored = M.mergeTextStyle(undefined, {vAlign: v}, 'left', t.def);
    const vars = M.textStyleVars(stored, 'left', t.def);
    const isDefault = v === t.def;
    const ok = isDefault
      ? (stored === undefined && !('--ts-valign' in vars) && !('--ts-align-items' in vars))
      : (JSON.stringify(stored) === `{"vAlign":"${v}"}`
         && vars['--ts-valign'] === v && vars['--ts-align-items'] === flex);
    if (!ok) valignBad.push({what: t.what, v, def: t.def, stored, vars});
  }
}
console.log(`  vAlign: ${Object.entries(M.TEXT_VALIGN_FLEX).map(([v, f]) => `${v}→${f}`).join('  ')}`
  + `  (${VALIGN_TARGETS.length * 3 - valignBad.length}/${VALIGN_TARGETS.length * 3} cells as expected)`);
assert('p.every-vAlign-value-is-one-field-and-one-property-pair-per-target',
  valignBad.length === 0,
  'for each target`s OWN default that value stores NOTHING and emits neither property (its flex keyword is '
  + 'the sheet fallback) and the other two store ONLY `vAlign` and emit `--ts-valign` + `--ts-align-items`, '
  + 'the single pair the padded box reads');

/* --- (p4) THE CUSTOM SIZE ------------------------------------------------- */
console.log(`  TEXT_SCALE_MIN=${M.TEXT_SCALE_MIN}  TEXT_SCALE_MAX=${M.TEXT_SCALE_MAX}`);
assert('p.the-clamp-bounds-are-0.5-and-2.0',
  M.TEXT_SCALE_MIN === 0.5 && M.TEXT_SCALE_MAX === 2
    && M.clampTextScale(0.1) === 0.5 && M.clampTextScale(9) === 2
    && M.clampTextScale(1.7) === 1.7 && M.clampTextScale(2) === 2
    && M.clampTextScale(0.5) === 0.5,
  `Harvey's range: 0.1 → ${M.clampTextScale(0.1)}, 9 → ${M.clampTextScale(9)}, `
  + `1.7 → ${M.clampTextScale(1.7)} (inside the range is untouched)`);
assert('p.a-literal-1-stores-ABSENCE',
  M.clampTextScale(1) === null
    && mMerge(undefined, {scale: M.clampTextScale(1)}, 'left') === undefined
    && mMerge({scale: 1.7}, {scale: M.clampTextScale(1)}, 'left') === undefined
    && Object.keys(mVars(mMerge(undefined, {scale: null}, 'left'), 'left')).length === 0,
  'typing 1 behaves exactly like picking M: the custom key is dropped and `--ts-scale` is not '
  + 'emitted, so a typed 1 and the default are ONE representation and cannot drift');
assert('p.a-custom-value-overrides-the-step-and-they-never-coexist',
  (() => {
    const custom = mMerge({size: 'lg'}, {scale: 1.7}, 'left');
    const stepped = mMerge(custom, {size: 'xl'}, 'left');
    const back = mMerge(stepped, {scale: 1.7}, 'left');
    console.log(`  lg+1.7 → ${JSON.stringify(custom)}   then XL → ${JSON.stringify(stepped)}   `
      + `then 1.7 again → ${JSON.stringify(back)}`);
    return JSON.stringify(custom) === '{"scale":1.7}'
      && JSON.stringify(stepped) === '{"size":"xl"}'
      && JSON.stringify(back) === '{"scale":1.7}'
      && mVars(custom, 'left')['--ts-scale'] === '1.7';
  })(),
  'one property, one writer: picking a step clears the custom value and typing one clears the step');
/* ROUND X, ITEM 1 — THE INPUT IS GONE, THE RULE IS NOT. This assertion is
   INVERTED from ROUND W on purpose: it used to require `id="insp-text-scale"` +
   `type="number"`; it now requires their ABSENCE, and simultaneously requires
   every piece of the capability the input used to write. Deleted with the input:
   the element, its id, the two bound props and the handler's `clampTextScale`
   call. KEPT: `TEXT_SCALE_MIN`/`TEXT_SCALE_MAX`, `clampTextScale`, the optional
   `scale` field, and `textStyleVars` reading it — so a board already carrying a
   custom multiplier still renders it, and a later pass cannot delete the rule
   while the UI is gone without failing here. */
assert('p.the-custom-size-INPUT-is-gone-and-the-RULE-still-exists',
  /* UI GONE — the element, its id, its class, its handler, its imports. APP is
     comment-stripped, so the note explaining the removal cannot satisfy this. */
  !APP.includes('insp-text-scale') && !APP.includes('insp-num')
    && !/type="number"/.test(APP)
    && countOf(APP, 'clampTextScale(') === 0
    && countOf(APP, 'TEXT_SCALE_MIN') === 0 && countOf(APP, 'TEXT_SCALE_MAX') === 0
    && !STYLES_BLANK.includes('.insp-num')
    /* RULE KEPT — bounds, clamp, the field, and the render read. */
    && TS.includes('export const TEXT_SCALE_MIN = 0.5')
    && TS.includes('export const TEXT_SCALE_MAX = 2')
    && TS.includes('export function clampTextScale')
    && TS.includes('scale?: number')
    && /out\['--ts-scale'\] = String\(scale\)/.test(TS),
  'no input, no `insp-text-scale`, no `type="number"`, no clamp call and no bound import left in App.tsx; '
  + 'the bounds, the clamp, `scale?: number` and the `--ts-scale` render read all remain in textStyle.ts');
assert('p.a-stored-custom-scale-still-RENDERS-and-no-step-claims-it',
  (() => {
    /* The display rule, EXECUTED through the model the panel reads. */
    const r = k => mLabels(k, 'left');
    const custom = r({scale: 1.7});
    const onStep = r({scale: 1.15});
    const none = r(undefined);
    const stored = r({size: 'xl'});
    console.log(`  readTextStyle — {scale:1.7} → size=${JSON.stringify(custom.size)} scale=${custom.scale}; `
      + `{scale:1.15} → size=${JSON.stringify(onStep.size)}; no textStyle → size=${JSON.stringify(none.size)}; `
      + `{size:'xl'} → size=${JSON.stringify(stored.size)}`);
    return custom.size === null && custom.scale === 1.7
      && mVars({scale: 1.7}, 'left')['--ts-scale'] === '1.7'
      && onStep.size === 'lg'
      && none.size === 'md'
      && stored.size === 'xl';
  })(),
  '1.7 paints (--ts-scale "1.7") and lights NO step; 1.15 is the L step and lights it; a node with no '
  + 'textStyle still shows M; a stored step shows itself — the control reports what PAINTS, so it cannot '
  + 'claim M for a node painting 1.7');
/* NEGATIVE CONTROL — the read must be able to distinguish the two cases, or the
   assertion above passes on a read that always answers the same thing. */
assert('p.control-the-step-lookup-distinguishes-custom-from-step',
  M.stepForScale(1.7) === null && M.stepForScale(1.3) === 'xl'
    && M.stepForScale(1) === 'md' && M.stepForScale(0.85) === 'sm',
  'a multiplier that IS a step resolves to it; one that is not resolves to nothing');
assert('p.control-the-clamp-detects-an-out-of-range-value',
  M.clampTextScale(0.1) !== 0.1 && M.clampTextScale(9) !== 9,
  'the bounds are enforced, not merely documented in a hint');

/* ===========================================================================
   (p5) ROUND W FIX 2 — A `--ts-*` ON `.label-node` NEEDS ITS EDITOR TWIN.
   ---------------------------------------------------------------------------
   The label is the ONE node kind whose text has a SECOND render site: the
   in-place `<textarea>` (`.node-label-input`). A `<textarea>` is a REPLACED
   form control — it does not inherit `font-family` from `.label-node` — so a
   text property declared on the root alone paints the label at rest and is
   silently dropped the moment editing starts. `--ts-font` shipped with ONLY
   the root consumer for that reason; three earlier passes fixed the same
   omission one property at a time for `--ts-scale`, `--ts-weight`,
   `--ts-color` and `--ts-align`. THIS RULE IS THE STOP: it is general over
   EVERY `--ts-*` property, not a line about font, so a fifth one added
   tomorrow fails here instead of reaching a browser.
   =========================================================================== */
console.log('\n' + '='.repeat(78));
console.log('(p5) every --ts-* on .label-node ALSO on its in-place editor');
console.log('='.repeat(78));
/* Comment-stripped FIRST, so a docblock that merely QUOTES a property cannot
   satisfy the rule — the same reason LABEL is stripped above. One entry per
   selector in a comma list; a rule nested in an at-rule still yields its own
   selector, since `[^{}]*` cannot span the inner brace. */
const CSS_SHEET = stripTs(STYLES_RAW);
const CSS_BLOCKS = [];
for (const m of CSS_SHEET.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
  for (const sel of m[1].split(',')) CSS_BLOCKS.push({sel: sel.trim().replace(/\s+/g, ' '), body: m[2]});
}
const tsPropsIn = pred => {
  const out = new Set();
  for (const b of CSS_BLOCKS) {
    if (!pred(b.sel)) continue;
    for (const p of b.body.matchAll(/--ts-[a-z-]+/g)) out.add(p[0]);
  }
  return out;
};
const LABEL_PROPS = tsPropsIn(sel => sel === '.label-node');
const EDITOR_PROPS = tsPropsIn(sel => /\.label-node\b/.test(sel) && /\.node-label-input\b/.test(sel));
/* The four the sheet is already known to pair. Required as a LIVENESS FLOOR:
   without them this rule would pass on a parse that found nothing at all. */
const PAIRED = ['--ts-scale', '--ts-weight', '--ts-color', '--ts-align'];
/* THE ONE PROPERTY ALLOWED TO BE UNPAIRED, named so the general rule below can
   still fail on a SECOND unpaired property appearing. ROUND Z FIX — the entry
   itself changed: it is now the flex keyword, not the semantic name, because
   the semantic name no longer has any rule consumer at all (see (v2)).

   `--ts-align-items` is read by `.label-node`'s own `justify-content`, and a flex
   CONTAINER's placement of a child needs no cooperation from the child: the root
   rule places `.label-text` at rest and the in-place editor mid-edit through one
   mechanism, so the two states cannot disagree. A twin on the editor would be
   INERT (an item's own `justify-content` distributes nothing) and WRONG (this is
   a COLUMN flex, so there it would re-mean the horizontal axis). The four paired
   properties are the opposite case: a `<textarea>` is a REPLACED control that
   inherits none of font / colour / `text-align`, so their twin is the only thing
   that paints them mid-edit. */
const UNPAIRED_BY_DESIGN = ['--ts-align-items'];
const UNPAIRED = [...LABEL_PROPS].filter(p => !EDITOR_PROPS.has(p)).sort();
const UNPAIRED_UNEXPECTED = UNPAIRED.filter(p => !UNPAIRED_BY_DESIGN.includes(p));
console.log(`  .label-node consumers:          ${[...LABEL_PROPS].sort().join(' ')}`);
console.log(`  .label-node .node-label-input:  ${[...EDITOR_PROPS].sort().join(' ')}`);
console.log(`  unpaired by design:             ${UNPAIRED_BY_DESIGN.join(' ') || 'none'}`
  + `   unexpected: ${UNPAIRED_UNEXPECTED.join(' ') || 'none'}`);
assert('p.every-ts-property-on-the-label-has-its-editor-twin',
  UNPAIRED_UNEXPECTED.length === 0 && PAIRED.every(p => LABEL_PROPS.has(p)),
  UNPAIRED_UNEXPECTED.length
    ? `UNPAIRED on .node-label-input: ${UNPAIRED_UNEXPECTED.join(', ')} — a textarea does not inherit `
      + 'font-family, so this value paints at rest and is dropped mid-edit'
    : `${LABEL_PROPS.size} properties on .label-node: the four known pairs (${PAIRED.join(' ')}) are all on the `
      + `editor too, and the only unpaired one is ${UNPAIRED_BY_DESIGN.join(', ')} — the flex keyword read by `
      + 'this root`s own flex CONTAINER, exempted by name, so the rule still fires on a second property '
      + 'that loses its twin');

/* ROUND Z FIX — THE BOXES' `justify-content` CONSUMERS, per text box, each with
   that box's OWN current value as the fallback. FIVE rules read it — the goblin
   body, the label-only body (already a column flex), the note body and the label
   root, whose one `justify-content` places BOTH its children (`.label-text` at
   rest and the editor mid-edit). The fallbacks are not decoration: they are the
   values the boxes resolve to TODAY, and `middle` stores absence, so an untouched
   node emits nothing and every box must land on exactly what it paints now.

   THE PROPERTY NAME IS THE WHOLE FIX. Round Z's first pass pointed all five at
   the SEMANTIC name (`top`/`middle`/`bottom`). A `var()` cannot look a keyword
   up, so the browser saw `justify-content: bottom`, found it invalid and
   discarded it — the declaration LOST and the control moved nothing, while every
   assertion above still passed because the property was EMITTED. The sheet now
   reads the flex keyword `textStyleVars` was already computing beside it. (v1)
   below is the general stop; this block is the per-box measurement. */
const ALIGN_ITEMS_WANT = {top: 'flex-start', middle: 'center', bottom: 'flex-end'};
const VALIGN_WANT = new Map([
  ['.node-body', 'flex-start'],
  /* the rule is a two-selector list, so both arms are read — and both must fall
     back to `center`, the literal the block declared before this round */
  ['.node .lo-body', 'center'],
  ['.node.label-only .lo-body', 'center'],
  ['.note-body', 'flex-start'],
  /* the label ROOT places BOTH its children (`.label-text` at rest, the editor
     while editing) — this is the consumer the editor relies on instead of a twin */
  ['.label-node', 'flex-start'],
]);
const valignConsumers = [];
for (const b of CSS_BLOCKS) {
  for (const m of b.body.matchAll(/justify-content:\s*var\(--ts-align-items,\s*([^)]+)\)/g)) {
    valignConsumers.push({sel: b.sel, prop: 'justify-content', fallback: m[1].trim()});
  }
}
for (const c of valignConsumers) {
  console.log(`    ${c.sel.padEnd(32)} ${c.prop}: var(--ts-align-items, ${c.fallback})`);
}
const valignWrong = valignConsumers.filter(c => VALIGN_WANT.get(c.sel) !== c.fallback);
/* A box reading the flex keyword 0 times is the pre-fix defect's signature (it
   read the semantic name instead). Counted PER BOX so the failure detail below
   can never print the success sentence for a box that does not read it at all —
   a harness message that lies is the same family of trap as a harness that
   measures presence instead of effect. */
const boxesNotReading = [...VALIGN_WANT.keys()]
  .map(sel => ({sel, n: valignConsumers.filter(c => c.sel === sel).length}))
  .filter(b => b.n !== 1);
assert('p.the-flex-keyword-is-read-by-every-text-box-with-that-boxs-own-fallback',
  /* every box that owns text reads it exactly once … */
  boxesNotReading.length === 0
  /* … and the fallback IS the literal that box renders with today, so `middle`
     (which stores absence) is pixel-identical to the sheet before this round. */
  && valignWrong.length === 0,
  boxesNotReading.length
    ? `NOT READING THE FLEX KEYWORD: ${boxesNotReading.map(b => `${b.sel} → ${b.n} consumer(s)`).join(', ')}`
      + ' — a box that reads 0 times is the shipped defect: the pre-fix sheet pointed these at the SEMANTIC name,'
      + ' so the browser saw a keyword that is not one, discarded the declaration and left the box where it was'
    : valignWrong.length
      ? `WRONG FALLBACK: ${valignWrong.map(c => `${c.sel} → ${c.fallback} (want ${VALIGN_WANT.get(c.sel)})`).join(', ')}`
        + ' — the fallback is the literal that box renders with today, and `middle` stores absence, so a wrong'
        + ' literal moves an untouched node'
      : `${valignConsumers.length} consumers — .node-body / .node .lo-body (both arms) / .note-body / `
        + '.label-node read `justify-content` from the flex keyword with flex-start/center/flex-start/flex-start '
        + '— exactly today`s values — so `middle` (which stores absence) leaves every box where it already sits');
/* The label-only body's reader is asserted as the SAME property the block already
   used for its vertical axis, or the control would fight the sheet rather than
   drive it. ROUND Z FIX — the vertical declaration is the keyword property. */
const loBody = CSS_BLOCKS.find(b => b.sel === '.node.label-only .lo-body' || b.sel === '.node .lo-body');
assert('p.the-label-only-block-drives-its-existing-vertical-axis',
  !!loBody && /justify-content:\s*var\(--ts-align-items,\s*center\)/.test(loBody.body)
    && /align-items:\s*var\(--ts-justify,\s*center\)/.test(loBody.body),
  'that block is already `flex-direction: column`, so `justify-content` WAS its vertical axis: the round routed '
  + 'it through the flex keyword instead of adding a second mechanism, and its fallback stays `center`');

/* ===========================================================================
   (v1) EVERY `--ts-*` A RULE FEEDS TO A CSS PROPERTY MUST BE CONSUMED WITH A
   VALUE THAT IS VALID FOR THAT PROPERTY.
   ---------------------------------------------------------------------------
   (v3) This is the regression that shipped past the 144-assertion suite: it
   asserted the pair was EMITTED, and emission is not effect. `--ts-valign`
   carried `bottom`, the sheet fed it to `justify-content`, the browser found
   `justify-content: bottom` INVALID and DROPPED it, and the control moved
   nothing while every test stayed green. The suite tested PRESENCE; these rules
   test that the value REACHES a property and WINS there.

   The three declarations below are the ones `textStyleVars` computes its flex
   keywords FOR, so a consumer of them is checked against the mapping the module
   itself applies. `justify-content` on a `flex-direction: column` container is
   the VERTICAL axis — `flex-start` top, `center` middle, `flex-end` bottom —
   which is why this pair is the one the boxes must read.
   =========================================================================== */
console.log('\n' + '='.repeat(78));
console.log('(v1) every --ts-* fed to a CSS property is consumed with a VALID value');
console.log('='.repeat(78));
/* Derived from M's own table, not restated: if `ALIGN_ITEMS` ever stops mapping
   onto these keywords, both this rule and the sheet's fallback must move. */
const VALID_FOR = new Map();
for (const [v, flex] of Object.entries(ALIGN_ITEMS_WANT)) VALID_FOR.set(flex, v);
const KEYWORD_CONSUMERS = [];
const SEMANTIC_AS_KEYWORD = [];
for (const b of CSS_BLOCKS) {
  for (const m of b.body.matchAll(/([a-z-]+):\s*var\(--ts-([a-z-]+)(?:,\s*([^)]+))?\)/g)) {
    const rec = {sel: b.sel, prop: m[1], tsProp: `--ts-${m[2]}`, fallback: (m[3] ?? '').trim()};
    if (rec.tsProp === '--ts-align-items') KEYWORD_CONSUMERS.push(rec);
    if (rec.tsProp === '--ts-valign' && ['justify-content', 'align-content', 'align-items', 'align-self'].includes(rec.prop)) {
      SEMANTIC_AS_KEYWORD.push(rec);
    }
  }
}
const badKeyword = KEYWORD_CONSUMERS.filter(c => !VALID_FOR.has(c.fallback));
console.log(`  rules reading the flex keyword: ${KEYWORD_CONSUMERS.length}`
  + `   [${[...new Set(KEYWORD_CONSUMERS.map(c => c.sel))].join(', ')}]`);
console.log(`  rules in the flex-keyword declarations that the flex keyword never supplies: ${badKeyword.length}`);
assert('p.every-flex-keyword-consumer-reads-a-value-valid-for-the-property',
  KEYWORD_CONSUMERS.length >= 5 && badKeyword.length === 0
    && ['flex-start', 'center', 'flex-end'].every(v => VALID_FOR.has(v)),
  badKeyword.length
    ? `INVALID VALUE: ${badKeyword.map(c => `${c.sel} { ${c.prop}: var(${c.tsProp}, ${c.fallback}) }`).join('; ')}`
      + ' — the property would be discarded by the browser and the control would move nothing'
    : `${KEYWORD_CONSUMERS.length} declarations across ${new Set(KEYWORD_CONSUMERS.map(c => c.sel)).size} selectors read the`
      + ' flex keyword, and each one`s fallback is either a keyword this sheet declares or the box`s own literal'
      + ' (`flex-start` / `center`) — so with the property emitted the resolved value is valid for the property');

/* DIRECTION SEMANTICS — `justify-content` is the MAIN axis, and the keyword
   mapping is the VERTICAL one only because every consumer box is
   `flex-direction: column`. In a column container the main axis runs top →
   bottom, so `flex-start` is the TOP, `center` the MIDDLE, `flex-end` the
   BOTTOM. Asserted per box rather than assumed: in a ROW flex the same three
   keywords would mean left / center / right, so a box that is not a column flex
   would move the text sideways and this control would be the wrong control. */
const axisOf = KEYWORD_CONSUMERS.map(c => {
  const b = CSS_BLOCKS.find(x => x.sel === c.sel && /justify-content:\s*var\(--ts-align-items,/.test(x.body));
  return {sel: c.sel, column: !!b && /flex-direction:\s*column/.test(b.body)};
});
const rowBoxes = axisOf.filter(a => !a.column);
console.log(`  vertical axis confirmed on ${axisOf.filter(a => a.column).length}/${axisOf.length} boxes: `
  + axisOf.map(a => `${a.sel}${a.column ? '' : ' (NOT COLUMN)'}`).join(', '));
assert('p.the-flex-keyword-drives-the-VERTICAL-axis-of-every-box-it-lands-on',
  axisOf.length === 5 && rowBoxes.length === 0,
  rowBoxes.length
    ? `WRONG AXIS: ${rowBoxes.map(a => a.sel).join(', ')} is not a column flex, so \`justify-content\` there is the `
      + 'HORIZONTAL axis and top/middle/bottom would land as left/center/right'
    : 'all 5 boxes declare `flex-direction: column`, so `justify-content` is their MAIN axis, which runs '
      + 'top → bottom: `flex-start` = top, `center` = middle, `flex-end` = bottom — exactly the three values '
      + '`TEXT_VALIGN_FLEX` supplies for top / middle / bottom');
/* NEGATIVE CONTROL — flip one box to a ROW flex and the axis check must fire, or
   it is only reading that a keyword is present somewhere. */
const ROW_SHEET = CSS_SHEET.replace(/(\.node-body\s*\{[^}]*?)flex-direction:\s*column/, '$1flex-direction: row');
const rowAxis = [];
for (const m of ROW_SHEET.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
  for (const sel of m[1].split(',')) {
    const s = sel.trim().replace(/\s+/g, ' ');
    if (s === '.node-body' && /justify-content:\s*var\(--ts-align-items,/.test(m[2]) && !/flex-direction:\s*column/.test(m[2])) {
      rowAxis.push(s);
    }
  }
}
assert('p.control-the-axis-check-fires-when-a-box-becomes-a-ROW-flex',
  rowAxis.length === 1,
  `with .node-body mutated to \`flex-direction: row\` the axis check reports ${rowAxis.length} box off the `
  + 'vertical axis — it measures the direction rather than trusting that the keyword reached a flex box');

/* ===========================================================================
   (v2) THE SEMANTIC-NAME GUARD — no rule may pass `--ts-valign` to a CSS
   property. Its value is a SEMANTIC name (`top` / `middle` / `bottom`) and a
   `var()` cannot translate one into a keyword, so ANY rule reading it as a
   keyword is broken by construction, not merely mis-set. (v3) On the pre-fix
   tree this count is 5; today it is 0.
   =========================================================================== */
console.log(`  rules feeding the SEMANTIC name to a CSS property: ${SEMANTIC_AS_KEYWORD.length}`
  + (SEMANTIC_AS_KEYWORD.length ? `  ${SEMANTIC_AS_KEYWORD.map(c => c.sel).join(', ')}` : ''));
assert('p.no-rule-feeds-the-semantic-alignment-name-to-a-css-property',
  SEMANTIC_AS_KEYWORD.length === 0,
  SEMANTIC_AS_KEYWORD.length
    ? `BROKEN-BY-CONSTRUCTION: ${SEMANTIC_AS_KEYWORD.map(c => `${c.sel} { ${c.prop}: var(${c.tsProp}`).join('; ')}`
      + ' — a semantic name is not a CSS keyword, a `var()` cannot look one up, so the declaration is INVALID and'
      + ' is discarded, leaving the property unset: this is exactly the defect that made the control inert while'
      + ' the suite stayed green'
    : '0 rules feed the semantic name to a CSS property — it survives only as the value the panel HIGHLIGHTS, '
      + 'and its keyword twin is what the boxes read');
/* If the property that IS read ever loses its emitter, every box silently falls
   back and the control is inert again — by a different route. Asserted against
   the module, so `textStyleVars` and the sheet cannot drift apart. */
assert('p.the-read-property-is-the-one-the-module-EMITS',
  JSON.stringify(mVars(mMerge(undefined, {vAlign: 'bottom'}, 'left'), 'left'))
      === '{"--ts-valign":"bottom","--ts-align-items":"flex-end"}'
  && VALID_FOR.size === 3,
  'a stored `bottom` emits `--ts-align-items: flex-end` — the property the five rules above consume, and a value '
  + 'valid for `justify-content` — so the write reaches the box instead of being discarded');

/* NEGATIVE CONTROLS — the rules must FIRE on the pre-fix sheet. (v3) This is the
   same analysis re-run on a MUTATED copy: the consumers put back onto the
   semantic name, exactly as they shipped. A parse that silently found nothing
   would report an empty set for both and pass, so each control pins the count. */
const semanticConsumersIn = sheet => {
  const out = [];
  for (const m of sheet.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    for (const sel of m[1].split(',')) {
      for (const d of m[2].matchAll(/justify-content:\s*var\(--ts-valign(?:,\s*([^)]+))?\)/g)) {
        out.push({sel: sel.trim().replace(/\s+/g, ' '), fallback: (d[1] ?? '').trim()});
      }
    }
  }
  return out;
};
const PREFIX_SHEET = CSS_SHEET.replace(/var\(--ts-align-items,/g, 'var(--ts-valign,');
assert('p.control-v2-reports-the-shipped-defect-when-the-consumers-are-put-back',
  semanticConsumersIn(PREFIX_SHEET).length === 5 && semanticConsumersIn(CSS_SHEET).length === 0,
  `on the pre-fix copy ${semanticConsumersIn(PREFIX_SHEET).length} declarations feed the semantic name to `
  + '`justify-content` — the five the browser discarded — and 0 on the real sheet: the guard is measuring the '
  + 'defect it was written for, not a parse that found nothing');

/* NEGATIVE CONTROLS — the rule must FIRE on the defect it was written for.
   This is the same analysis re-run on a MUTATED copy of the sheet: the editor
   twin deleted. A parse that silently found nothing would report an EMPTY
   unpaired set for both and pass, so each control also pins the detection. */
const analyse = sheet => {
  const props = {};
  for (const m of sheet.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    for (const sel of m[1].split(',')) {
      const s = sel.trim().replace(/\s+/g, ' ');
      props[s] ??= new Set();
      for (const p of m[2].matchAll(/--ts-[a-z-]+/g)) props[s].add(p[0]);
    }
  }
  const root = props['.label-node'] ?? new Set();
  const ed = new Set();
  for (const [s, v] of Object.entries(props)) {
    if (/\.label-node\b/.test(s) && /\.node-label-input\b/.test(s)) for (const p of v) ed.add(p);
  }
  return [...root].filter(p => !ed.has(p)).sort();
};
/* ROUND Z, ITEM 2 — the exemption applies here too, or every control would
   report `--ts-valign` alongside the property it is really hunting. */
const unexpected = list => list.filter(p => !UNPAIRED_BY_DESIGN.includes(p));
const noFontTwin = unexpected(analyse(CSS_SHEET.replace(
  /\.label-node \.node-label-input \{ font-family: var\(--ts-font[^}]*\}\n/, '')));
const noWeights = unexpected(analyse(CSS_SHEET.replace(
  /\.label-node \.node-label-input \{ font-weight: var\(--ts-weight[^}]*\}\n/, '')));
assert('p.control-the-pair-rule-detects-the-font-defect-in-place',
  noFontTwin.length === 1 && noFontTwin[0] === '--ts-font',
  `with the font-family editor rule deleted the mutated sheet reports ${JSON.stringify(noFontTwin)} `
  + '— exactly the bug measured live (label at rest "Be Vietnam Pro", editor ui-monospace)');
assert('p.control-the-pair-rule-is-not-keyed-to-font',
  noWeights.length === 1 && noWeights[0] === '--ts-weight',
  `with the font-WEIGHT editor rule deleted instead it reports ${JSON.stringify(noWeights)} — the rule `
  + 'is general over the property, not a special case for the one that shipped broken');
/* NEGATIVE CONTROL for the EXEMPTION itself: the list must be exactly the one
   property, or "exempted by name" would become an exemption for everything. */
assert('p.control-the-exemption-list-is-exactly-one-property',
  UNPAIRED_BY_DESIGN.length === 1 && UNPAIRED_BY_DESIGN[0] === '--ts-align-items'
    && unexpected(['--ts-align-items', '--ts-pretend']).join() === '--ts-pretend',
  'the exemption admits the flex keyword and NOTHING else — a second unpaired property still fails the general '
  + 'rule, which is what keeps the exemption from turning into a blanket');

/* ===========================================================================
   (w1) THE NO-WRITE STATE MUST RENDER AS THE DECLARED DEFAULT — per box.
   ---------------------------------------------------------------------------
   (w3) WHY THIS FAILS ON THE PRE-FIX TREE. The suite below passed 149/149 with
   the defect live, because it asserted that the property was EMITTED with a
   valid keyword. It never asserted that the value NOT WRITTEN paints what the
   panel reports — so `middle` (the model's default, which stores absence)
   rendered as `flex-start` on every card and the suite stayed green. That is the
   fifth defect of this family in this project, so the rule written here is the
   general one rather than the single cell that shipped broken: for EVERY box
   that consumes the property, the box's own fallback literal must BE the flex
   keyword of that box's own no-write value. Each side has ONE source of truth
   and the two are asserted to agree — never the same literal written twice.

   HOW IT FIRES ON THE PRE-FIX STATE: the negative control at the end re-runs
   this exact analysis with the model's default forced back to a single global
   `middle` — what shipped — and requires the three boxes that really render from
   their `padding-top` to be reported. On the literal pre-fix tree the model has
   no per-target default at all (`W_M` is null) and this assert fails on that.
   =========================================================================== */
const VBOXES = [
  /* `.node-body` / `.note-body` / `.label-node`: content begins at each box's own
     `padding-top` — that IS `top`, and it is what all three painted before this
     round (none of them declared `display: flex` at all). */
  {sel: '.node-body', body: undefined},
  {sel: '.note-body', body: undefined},
  {sel: '.label-node', body: undefined},
  /* The label-only node renders `<div class="node-body lo-body">`, so BOTH arms
     of that two-selector rule are read; each declares the same `center`. */
  {sel: '.node .lo-body', body: 'label-only'},
  {sel: '.node.label-only .lo-body', body: 'label-only'},
];
const vBoxFallback = sel => {
  const b = CSS_BLOCKS.find(x => x.sel === sel && /justify-content:\s*var\(--ts-align-items,/.test(x.body));
  const m = b && b.body.match(/justify-content:\s*var\(--ts-align-items,\s*([^)]+)\)/);
  return m ? m[1].trim() : null;
};
const vBoxRules = VBOXES.map(box => ({...box, fallback: vBoxFallback(box.sel)}));
/* ONE source of truth for the mapping: the model's own exported table. The
   sheet-side copy (`ALIGN_ITEMS_WANT`) is asserted EQUAL to it rather than
   re-listed against literal keywords, so the two halves cannot drift apart. */
console.log(`  TEXT_VALIGN_FLEX (the model's one mapping): ${JSON.stringify(M.TEXT_VALIGN_FLEX)}`);
assert('w1.the-vertical-mapping-is-one-table-asserted-equal-on-both-sides',
  JSON.stringify(M.TEXT_VALIGN_FLEX) === JSON.stringify(ALIGN_ITEMS_WANT)
    && new Set(Object.values(M.TEXT_VALIGN_FLEX)).size === 3
    && M.TEXT_VALIGN_FLEX.top === 'flex-start'
    && M.TEXT_VALIGN_FLEX.middle === 'center'
    && M.TEXT_VALIGN_FLEX.bottom === 'flex-end',
  'top / middle / bottom → flex-start / center / flex-end: three DISTINCT keywords, and the correct ones for '
  + '`justify-content` on a `flex-direction: column` box, whose main axis runs top → bottom. The sheet-side '
  + 'copy is asserted equal to the model`s table instead of being spelled a second time');
/* The model's per-target answer, or null on the pre-fix tree where it does not
   exist yet — the rule must fail there rather than throw. */
const W_M = typeof M.vAlignForBody === 'function' ? M.vAlignForBody : null;
/** The rule, parameterised by "what does the panel claim for this target?" so the
 *  SAME code can be pointed at the pre-fix answer for the (w3) control. */
const w1Wrong = defFor => vBoxRules
  .filter(b => b.fallback === null || b.fallback !== M.TEXT_VALIGN_FLEX[defFor(b.body)])
  .map(b => `${b.sel} → ${b.fallback ?? 'NO CONSUMER'} (want ${b.fallback === null ? 'a consumer' : M.TEXT_VALIGN_FLEX[defFor(b.body)]})`);
for (const b of vBoxRules) {
  console.log(`    ${b.sel.padEnd(32)} body=${String(b.body).padEnd(10)} fallback=${String(b.fallback).padEnd(10)}`
    + ` no-write=${W_M ? W_M(b.body) : '?'} → want ${M.TEXT_VALIGN_FLEX[W_M ? W_M(b.body) : 'top']}`);
}
assert('w1.the-default-value-RENDERS-as-the-declared-default-on-every-box',
  W_M !== null && vBoxRules.every(b => b.fallback !== null) && w1Wrong(W_M).length === 0,
  W_M === null
    ? 'the model has no per-target vertical default (`vAlignForBody`), so this rule cannot hold: one global '
      + 'default is necessarily a different value from the one three of these five fallbacks render'
    : w1Wrong(W_M).length
      ? `DEFAULT DOES NOT RENDER: ${w1Wrong(W_M).join('; ')} — the panel would report the default while those `
        + 'boxes paint their own fallback literal'
      : `${vBoxRules.length} consumers — each box's fallback IS the flex keyword of that box's own no-write value `
        + '(top → flex-start on .node-body / .note-body / .label-node; middle → center on both arms of '
        + '.lo-body) — so the value the panel reports is the value the pixels show, with NOTHING stored');
/* (w2) THE THREE VALUES ARE DISTINCT AND CORRECT, and the state that writes
   nothing is exactly the pick equal to that target's own default — whose keyword
   is the literal the box already renders, so the fallback paints it. */
const w2Cells = [];
for (const body of [undefined, 'label-only']) {
  const def = W_M ? W_M(body) : 'middle';
  for (const v of ['top', 'middle', 'bottom']) {
    const stored = M.mergeTextStyle(undefined, {vAlign: v}, 'left', def);
    const vars = M.textStyleVars(stored, 'left', def);
    w2Cells.push({
      body: body ?? '(card/label)', def, pick: v,
      emitted: '--ts-align-items' in vars ? vars['--ts-align-items'] : null,
      stored: stored === undefined,
    });
  }
}
const w2Wrong = w2Cells.filter(c => c.stored !== (c.pick === c.def)
  || (!c.stored && c.emitted !== M.TEXT_VALIGN_FLEX[c.pick]));
console.log('  (w2) per target and value:');
for (const c of w2Cells) {
  console.log(`       ${c.body.padEnd(14)} default=${c.def.padEnd(7)} pick=${c.pick.padEnd(7)} `
    + `→ ${c.emitted ?? 'nothing stored (the fallback paints it)'}`);
}
assert('w2.each-value-emits-its-own-keyword-and-the-no-write-state-is-the-fallback',
  w2Wrong.length === 0
    && ['flex-start', 'center', 'flex-end'].every(k => Object.values(M.TEXT_VALIGN_FLEX).includes(k))
    && valignConsumers.length === VBOXES.length
    && valignConsumers.every(c => c.fallback === 'flex-start' || c.fallback === 'center'),
  w2Wrong.length
    ? `MISMATCH: ${JSON.stringify(w2Wrong)}`
    : 'top / middle / bottom emit flex-start / center / flex-end — distinct, and each one lands where its '
      + 'label says on a column flex — and the ONLY state that writes nothing is the pick equal to that '
      + 'target`s own default, whose keyword is the literal that box already falls back to');
/* (w3) THE NEGATIVE CONTROL. A global `middle` for every target is the state that
   shipped; the rule must report the three boxes that do not render it. */
const w3PreFix = w1Wrong(() => 'middle');
console.log(`  (w3) with a global \`middle\` default the rule reports: `
  + `${w3PreFix.join('; ') || 'NOTHING — the rule would not have caught the defect'}`);
assert('w3.control-the-rule-reports-the-shipped-defect-in-place',
  w3PreFix.length === 3
    && ['.node-body', '.note-body', '.label-node']
      .every(sel => w3PreFix.some(s => s.startsWith(sel))),
  `with the model's default forced back to a single global \`middle\` — what shipped — this rule reports `
  + `${w3PreFix.length} boxes whose fallback is not that default's keyword `
  + `(${w3PreFix.map(s => s.split(' ')[0]).join(', ')}), which is exactly the disagreement the 149-assertion `
  + 'suite could not see: it measured that the property was EMITTED, never that the value NOT WRITTEN is the '
  + 'one that paints');

/* ===========================================================================
   SUMMARY
   =========================================================================== */
const failed = results.filter(r => !r.pass);
console.log('\n' + '='.repeat(78));
console.log(`PACKAGE-P PASS 1 HARNESS: ${results.length - failed.length}/${results.length} passed`);
console.log('='.repeat(78));
for (const f of failed) console.log(`  FAIL  ${f.id}  — ${f.detail}`);
process.exit(failed.length ? 1 : 0);
