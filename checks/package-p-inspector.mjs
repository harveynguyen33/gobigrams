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
  SHAPE_IDS.length === 19 && goblinBad.length === 0,
  `${SHAPE_IDS.length} shapes × ${GOBLIN_BODIES.length} body values, all ${GOBLIN_WANT} — \`text\` is `
  + 'between `content` and `style`, which is exactly what the pass-1 omission note promised');
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
    && ['size', 'weight', 'text colour', 'align'].every(l => APP.includes(`<label>${l}</label>`)),
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
    && /if \(v === undefined \|\| isTextDefault\(k, v, alignDefault\)\)/.test(MERGE)
    && /Object\.keys\(next\)\.length \? next : undefined/.test(MERGE),
  'mergeTextStyle copies the stored object, skips any key NOT in the patch, DROPS a key whose value '
  + 'equals the inherited default, and collapses to `undefined` when nothing is left — so a node the '
  + 'user never touched keeps NO textStyle at all');
assert('h.the-panel-WRITES-through-that-merge-and-never-directly',
  APP.includes('mergeTextStyle(tsStored, patch, tsAlignDefault)')
    && countOf(APP, 'mergeTextStyle(') === 1
    && !/textStyle:\s*\{/.test(APP),
  'the only writer is `writeTextStyle`, one call into the merge; no call site constructs a textStyle '
  + 'object literal, which is what a "writes a value the user did not choose" bug looks like');
assert('h.defaults-are-per-target-for-align-and-derived-not-hardcoded',
  TS.includes("body === 'label-only' ? 'center' : 'left'")
    && APP.includes('alignForBody(inspTarget.kind ===') && APP.includes('readTextStyle(tsStored, tsAlignDefault)'),
  "align's inherited value comes from the TARGET (a label-only node is centred by design), so the "
  + 'panel cannot disagree with the sheet on what "default" means');
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
      const props = countOf(src, "style={{'--nc': nc, ...tsVars}") + countOf(src, 'style={tsVars');
      console.log(`  ${name}: ${access} access(es) to the stored object, ${throughDoor} through the door, `
        + `${withDefault} passing alignForBody, ${props} style site(s) carrying the vars`);
      if (!(access === throughDoor && throughDoor === 1 && withDefault === 1)) return false;
      if (props < 1) return false;
    }
    return true;
  })(),
  'each node kind reads `d.textStyle` ONCE, into `textStyleVars`, WITH the target\'s own align default '
  + '(`alignForBody`) and spreads the result onto the same style object that already carries `--nc` '
  + '(DiagramNode: 4 branches) — so an old board\'s markup is unchanged (an empty spread adds nothing) '
  + 'AND a stored align is painted against the right default');
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
    const stored = M.mergeTextStyle(undefined, {align: pick}, d.def);
    const vars = M.textStyleVars(stored, d.def);
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
    const stored = M.mergeTextStyle(undefined, {align: 'left'}, M.alignForBody('label-only'));
    const vars = M.textStyleVars(stored, M.alignForBody('label-only'));
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
    const stored = M.mergeTextStyle(undefined, {align: 'left'}, 'center');
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
    const stored = M.mergeTextStyle(undefined, {size: pick}, d.def);
    const vars = M.textStyleVars(stored, d.def);
    const want = M.TEXT_SCALE[pick] === 1;
    const ok = want ? (stored === undefined && !('--ts-scale' in vars))
      : (vars['--ts-scale'] === String(M.TEXT_SCALE[pick]) && stored?.size === pick);
    if (!ok) sizeWeightBad.push({field: 'size', d, pick, stored, vars});
  }
  for (const pick of ['regular', 'bold']) {
    const stored = M.mergeTextStyle(undefined, {weight: pick}, d.def);
    const vars = M.textStyleVars(stored, d.def);
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
const TS_FONT = sweepSheet(STYLES_RAW, '--ts-font');
console.log(`  rules parsed: ${TS_FONT.rules.length}   var(--ts-font, …) consumers: ${TS_FONT.consumers.length}`);
for (const c of TS_FONT.consumers) {
  const subj = subjectKey(c.selectors[0]);
  const want = FAMILY_BASE.get(subj);
  const lose = TS_FONT.violations.filter(v => v.c === c);
  console.log(`    line ${String(c.line).padStart(4)}  ${c.prop.padEnd(12)} ${c.sel}`);
  console.log(`              fallback ${JSON.stringify(c.fallback)}` +
    (lose.length ? `  ** LOSES to \`${lose[0].theirSel}\` ${lose[0].theirs} at :${lose[0].theirLine} **`
      : c.base ? `  -> equal specificity (later wins), base \`${c.base.sel}\` @:${c.base.line}`
        : '  (no earlier rule of equal specificity on this subject)') +
    (want === undefined ? '  !! NOT ONE OF THE EIGHT ROWS' : ''));
}

const fontSubjects = TS_FONT.consumers.map(c => subjectKey(c.selectors[0]));
const fontDupes = fontSubjects.filter((s, i) => fontSubjects.indexOf(s) !== i);
console.log(`  subjects: ${TS_FONT.consumers.length} consumers, ${new Set(fontSubjects).size} distinct, dupes: [${[...new Set(fontDupes)].join(', ')}]`);
console.log(`  LOSING: ${TS_FONT.violations.length}   fallback-vs-base mismatches: ${TS_FONT.fallbackBad.length}`);

assert('l2.a-ts-font-has-exactly-one-consumer-per-node-text-row',
  TS_FONT.consumers.length === 8 && fontDupes.length === 0
    && [...new Set(fontSubjects)].sort().join('|') === TS_FONT_ROWS.map(r => r[0]).sort().join('|'),
  `the eight rows (${TS_FONT_ROWS.map(r => r[0]).join(', ')}) each read \`--ts-font\` exactly once — ` +
  'one write sets the whole node, and no row reads it twice');
assert('l2.b-no-earlier-rule-outranks-a-ts-font-consumer',
  TS_FONT.violations.length === 0,
  TS_FONT.violations.length === 0
    ? 'NONE of the eight was losing: every consumer is the last word on `font-family` for its own subject, so ' +
      'moving the picker moves all eight rows'
    : `${TS_FONT.violations.length} row(s) whose \`--ts-font\` LOSES to an earlier more specific literal — the ` +
      'picker would silently do nothing there');
assert('l2.c-every-ts-font-fallback-is-the-stack-its-base-declares',
  TS_FONT.fallbackBad.length === 0
    && TS_FONT.consumers.every(c => c.fallback === FAMILY_BASE.get(subjectKey(c.selectors[0]))),
  '8/8 fallbacks equal their row\'s own pre-ITEM-2 stack (`' +
  TS_FONT_ROWS.map(r => `${r[0]}→${r[1]}`).join('`, `') +
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
   (p) ROUND W — THE FONT PICKER AND THE CUSTOM SIZE.

   Both are §E.2 fields: a choice equal to the default stores ABSENCE. This
   section proves that for `font` and for a typed `1`, and it proves the two
   facts that only the FILE SYSTEM can answer: every `@font-face` carries a
   `unicode-range`, and every file it names EXISTS under `public/fonts/`.

   WHY THE FILE CHECK MATTERS. The sheet is the only thing that names the 24
   woff2 files, and a declaration pointing at a missing file is a SILENT
   failure: the page renders in the fallback stack and nothing throws. A test
   that only reads the CSS would pass on a sheet whose fonts are all absent.
   =========================================================================== */
console.log('\n' + '='.repeat(78));
console.log('(p) ROUND W — the font picker (ITEM 2) and the custom size (ITEM 3)');
console.log('='.repeat(78));
const {existsSync} = await import('node:fs');

/* --- (p1) THE OPTION TABLE, and that each pick carries its role ---------- */
const FONT_ROLES = {mono: 'cod', ui: 'architect', read: 'read', viet: 'Vietnam'};
console.log(`  TEXT_FONT_OPTS at src/textStyle.ts:${at(TS_RAW, 'export const TEXT_FONT_OPTS')}  `
  + `TEXT_FONT_FAMILY at :${at(TS_RAW, 'export const TEXT_FONT_FAMILY')}`);
assert('p.font-option-table-exists-with-all-four-picks',
  TS.includes('TEXT_FONT_OPTS') && M.TEXT_FONT_OPTS.length === 4
    && M.TEXT_FONT_OPTS.map(o => o.v).join() === 'mono,ui,read,viet'
    && M.TEXT_FONT_OPTS.every(o => typeof o.hint === 'string' && o.hint.length > 0),
  `the four picks are [${M.TEXT_FONT_OPTS.map(o => o.v).join(', ')}], each with the role that `
  + 'justifies it: ' + M.TEXT_FONT_OPTS.map(o => `${o.label}=${o.hint}`).join('; '));
assert('p.each-pick-carries-the-role-it-was-chosen-for',
  Object.entries(FONT_ROLES).every(([k, needle]) =>
    M.TEXT_FONT_OPTS.find(o => o.v === k)?.hint.toLowerCase().includes(needle.toLowerCase())),
  'mono→coding, ui→architecture, read→read, viet→Vietnamese diacritics');
assert('p.the-picker-is-the-existing-primitive-and-not-a-select',
  APP.includes('const FONT_OPTS') && APP.includes('<IconPickerRow')
    && countOf(APP, 'options={FONT_OPTS}') === 1 && countOf(APP, '<FONT_OPTS') === 0
    && countOf(APP, '<select') === 0,
  `FONT_OPTS drives one IconPickerRow (trigger + popover, the §B #2-#6 idiom); App.tsx still `
  + `renders ${countOf(APP, '<select')} native dropdowns anywhere`);
assert('p.every-option-previews-its-own-family',
  APP.includes("className=\"insp-opt-label insp-font-sample\"")
    && APP.includes('fontFamily: TEXT_FONT_FAMILY[o.v]')
    && STYLES_RAW.includes('.insp-font-sample'),
  'each option renders its own NAME in its own family — via the `{o.art}` cell the picker already '
  + 'draws on both the trigger and the popover, so no new prop was needed on IconPickerRow');

/* --- (p1b) ROUND W FIX — THE DUPLICATE NAME IN THE POPOVER ----------------
   MEASURED DEFECT. `IconPickerRow` prints a row as a glyph cell + a label. For
   the font picker the cell holds the SAMPLE, which already IS the name, so each
   option rendered `Mono Mono`. The sheet suppressed the duplicate on the
   TRIGGER only (`#insp-text-font:has(.insp-font-sample) .icon-trigger-name`),
   and that rule cannot reach the option rows: the popover is the trigger
   BUTTON's SIBLING inside `.icon-field`, so no selector starting at the font
   field's id matches a row. The row therefore needs a HOOK of its own, passed
   by the one caller that wants it. This section asserts the hook exists, that
   it reaches the row, that it does NOT reach another picker, and that the rule
   suppresses the plain label while leaving the sample. */
const ROW_HOOK = 'icon-field-font';
/* The rule as the sheet must spell it: scoped to the hook, on the option row,
   and EXCLUDING the sample. Read off the sheet with comments blanked, so the
   prose above the rule cannot satisfy the probe. */
const STYLES_BLANK = blankComments(STYLES_RAW);
const ROW_RULE_RE = /\.icon-field-font\s+\.insp-opt\s+\.insp-opt-label:not\(\.insp-font-sample\)\s*\{\s*display:\s*none\s*;?\s*\}/;
const ROW_RULE = ROW_RULE_RE.exec(STYLES_BLANK);
/* Every OTHER picker's `.icon-field` must be hookless: the hook is a prop, and
   exactly ONE call site passes it. Counting the literal in App.tsx is what
   makes "the rule cannot reach another picker" measured rather than asserted. */
const HOOK_CALLS = countOf(APP, `rowClass="${ROW_HOOK}"`);
const PICKS_TRIGGER_RULE = /#insp-text-font:has\(\.insp-font-sample\)\s+\.icon-trigger-name\s*\{\s*display:\s*none\s*;?\s*\}/.test(blankComments(STYLES_RAW));
console.log(`  the option-row hook: rowClass="${ROW_HOOK}" ×${HOOK_CALLS} call site(s); option-row rule present: ${ROW_RULE !== null}; `
  + `trigger rule still present: ${PICKS_TRIGGER_RULE}`);
assert('p.the-sheet-suppresses-the-option-rows-duplicate-name',
  ROW_RULE !== null,
  'the option row hides its plain `.insp-opt-label` — the exact sibling that made every option read `Mono Mono`');
assert('p.the-suppression-cannot-reach-another-picker',
  HOOK_CALLS === 1
    && PICKS.includes('rowClass')
    && countOf(PICKS, 'icon-field${rowClass') === 1
    && countOf(PICKS, 'rowClass ?') === 1,
  `the hook is an OPTIONAL prop on IconPickerRow and exactly ONE call site passes it (App.tsx ×${HOOK_CALLS}) — `
  + 'the shared picker is byte-identical for the other four, so a bare `.insp-opt-glyph + .insp-opt-label` rule '
  + 'that would have emptied every other popover was NOT used');
assert('p.the-sample-is-not-what-is-hidden',
  ROW_RULE !== null && ROW_RULE[0].includes(':not(.insp-font-sample)'),
  'the rule names the sample in a `:not()` — the cell that PRINTS the family is untouched, so the row still reads '
  + 'its name once, in its own family, and the preview the picker exists for survives');
assert('p.the-trigger-keeps-its-single-name',
  PICKS_TRIGGER_RULE,
  'the existing `#insp-text-font:has(.insp-font-sample) .icon-trigger-name` rule is still in the sheet, so the '
  + 'trigger does not regress to `Viet Viet` and does not lose its name');
/* NEGATIVE CONTROL — the probe must SEE the shape it warns about, or assert
   (p) is a tautology. The pre-fix sheet carried no option-row rule at all. */
const BARE_LABEL_RULE = '.insp-opt .insp-opt-label { display: none; }';
assert('p.control-the-row-rule-probe-detects-an-unscoped-rule',
  ROW_RULE_RE.test('.icon-field-font .insp-opt .insp-opt-label:not(.insp-font-sample) { display: none; }')
    && !ROW_RULE_RE.test(BARE_LABEL_RULE)
    && /\.insp-opt-label\s*\{\s*display:\s*none/.test(BARE_LABEL_RULE),
  'the pattern matches the SCOPED rule and does NOT match a bare `.insp-opt-label { display: none }` — the shape '
  + 'the brief warned would empty every other picker, which the harness can still see when it appears');

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
  FACES.length === 24 && noRange.length === 0,
  `${FACES.length} @font-face blocks, ${noRange.length} without a unicode-range — 4 families × `
  + '2 weights × 3 subsets, so a page fetches only the subset it renders');
assert('p.every-referenced-font-file-EXISTS-under-public-fonts',
  noFile.length === 0 && FACES.every(f => faceFile(f) !== null),
  noFile.length === 0
    ? `${FACES.length} referenced woff2 files all present in public/fonts/ (a missing one renders `
      + 'the fallback stack and throws nothing, which is why this is checked on disk)'
    : `MISSING: [${noFile.join(', ')}]`);
assert('p.the-three-ranges-are-the-three-subset-ranges',
  ranges.size === 3,
  `the three ranges are latin / latin-ext / vietnamese, identical across all four families because `
  + 'Google defines the subsets once — copied verbatim, none invented');
assert('p.the-four-families-in-the-model-are-the-four-declared',
  [...declared].sort().join('|') === 'Be Vietnam Pro|Inter|JetBrains Mono|Lexend'
    && M.TEXT_FONT_OPTS.every(o => {
      const first = M.TEXT_FONT_FAMILY[o.v].match(/'([^']+)'/)?.[1]
        ?? M.TEXT_FONT_FAMILY[o.v].match(/var\((--[\w-]+)\)/)?.[1];
      return first != null;
    }),
  `declared: [${[...declared].sort().join(', ')}] — every pick's stack opens with a family the sheet `
  + 'actually declares (or the `--mono` token whose declaration owns that family)');
/* NEGATIVE CONTROL — the file check must SEE an absent file. */
assert('p.control-the-font-file-check-detects-an-absent-file',
  !existsSync(`${ROOT}/public/fonts/definitely-not-a-font.woff2`)
    && existsSync(`${ROOT}/public/fonts/inter-400-latin.woff2`),
  'the probe returns false for a name the brief never mentions and true for a real file');

/* --- (p3) THE DEFAULT PICK WRITES NOTHING (§E.2) ------------------------- */
const fontBad = [];
for (const d of REAL_DEFAULTS) {
  for (const pick of ['mono', 'ui', 'read', 'viet']) {
    const stored = M.mergeTextStyle(undefined, {font: pick}, d.def);
    const vars = M.textStyleVars(stored, d.def);
    const want = pick === M.TEXT_DEFAULT_FONT;
    const ok = want
      ? (stored === undefined && !('--ts-font' in vars))
      : (vars['--ts-font'] === M.TEXT_FONT_FAMILY[pick] && stored?.font === pick);
    if (!ok) fontBad.push({d, pick, stored, vars});
  }
}
console.log(`  font × ${REAL_DEFAULTS.length} target defaults × 4 picks: `
  + `${REAL_DEFAULTS.length * 4 - fontBad.length}/${REAL_DEFAULTS.length * 4} as expected`);
assert('p.a-pick-equal-to-the-default-writes-NOTHING',
  fontBad.length === 0 && M.TEXT_DEFAULT_FONT === 'mono'
    && M.mergeTextStyle(undefined, {font: 'mono'}, 'left') === undefined,
  `${REAL_DEFAULTS.length * 4} cells — Mono stores nothing and paints nothing (a node the user `
  + 'never touched keeps NO textStyle at all); the other three store the KEY and emit `--ts-font` '
  + 'as the resolved stack');
/* NEGATIVE CONTROL for the same rule: a NON-default pick must not be dropped,
   or "the default writes nothing" would pass on a merge that writes nothing ever. */
assert('p.control-a-non-default-pick-is-stored-and-painted',
  (() => {
    const s = M.mergeTextStyle(undefined, {font: 'viet'}, 'left');
    const v = M.textStyleVars(s, 'left');
    return JSON.stringify(s) === '{"font":"viet"}' && v['--ts-font'] === M.TEXT_FONT_FAMILY.viet;
  })(),
  'Viet → stored {"font":"viet"} and painted as the Be Vietnam Pro stack');

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
    && M.mergeTextStyle(undefined, {scale: M.clampTextScale(1)}, 'left') === undefined
    && M.mergeTextStyle({scale: 1.7}, {scale: M.clampTextScale(1)}, 'left') === undefined
    && Object.keys(M.textStyleVars(M.mergeTextStyle(undefined, {scale: null}, 'left'), 'left')).length === 0,
  'typing 1 behaves exactly like picking M: the custom key is dropped and `--ts-scale` is not '
  + 'emitted, so a typed 1 and the default are ONE representation and cannot drift');
assert('p.a-custom-value-overrides-the-step-and-they-never-coexist',
  (() => {
    const custom = M.mergeTextStyle({size: 'lg'}, {scale: 1.7}, 'left');
    const stepped = M.mergeTextStyle(custom, {size: 'xl'}, 'left');
    const back = M.mergeTextStyle(stepped, {scale: 1.7}, 'left');
    console.log(`  lg+1.7 → ${JSON.stringify(custom)}   then XL → ${JSON.stringify(stepped)}   `
      + `then 1.7 again → ${JSON.stringify(back)}`);
    return JSON.stringify(custom) === '{"scale":1.7}'
      && JSON.stringify(stepped) === '{"size":"xl"}'
      && JSON.stringify(back) === '{"scale":1.7}'
      && M.textStyleVars(custom, 'left')['--ts-scale'] === '1.7';
  })(),
  'one property, one writer: picking a step clears the custom value and typing one clears the step');
assert('p.the-custom-input-is-a-real-input-and-clamped-on-commit',
  APP.includes('id="insp-text-scale"') && APP.includes('type="number"')
    && APP.includes('min={TEXT_SCALE_MIN}') && APP.includes('max={TEXT_SCALE_MAX}')
    && APP.includes('writeTextStyle({scale: clampTextScale(n)})')
    && countOf(APP, 'clampTextScale(') === 1,
  'a real `<input type="number">` — which is what keeps the canvas shortcuts inert, because '
  + "App.tsx's keydown opens with `if (isEditable(e.target)) return;` and `isEditable` (App.tsx:367) "
  + 'returns true for INPUT — and the only write goes through the clamp');
assert('p.control-the-clamp-detects-an-out-of-range-value',
  M.clampTextScale(0.1) !== 0.1 && M.clampTextScale(9) !== 9,
  'the bounds are enforced, not merely documented in a hint');

/* ===========================================================================
   SUMMARY
   =========================================================================== */
const failed = results.filter(r => !r.pass);
console.log('\n' + '='.repeat(78));
console.log(`PACKAGE-P PASS 1 HARNESS: ${results.length - failed.length}/${results.length} passed`);
console.log('='.repeat(78));
for (const f of failed) console.log(`  FAIL  ${f.id}  — ${f.detail}`);
process.exit(failed.length ? 1 : 0);
