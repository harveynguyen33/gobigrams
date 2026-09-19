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

/** Strip block + line comments. The `[^:]` before `//` keeps `https://`. */
const stripTs = s => s
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/(^|[^:])\/\/[^\n]*/g, '$1');
const APP = stripTs(APP_RAW);
const PICKS = stripTs(PICKS_RAW);
const INSP = stripTs(INSP_RAW);

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
assert('a.goblin-of-every-shape → [content, style]',
  SHAPE_IDS.every(s => JSON.stringify(ids({kind: 'goblin', shape: s, body: 'card'})) === '["content","style"]'),
  `${SHAPE_IDS.length} shapes, both body values below`);
assert('a.goblin-of-every-shape × both body values → [content, style]',
  SHAPE_IDS.every(s => ['card', 'label-only'].every(b =>
    JSON.stringify(ids({kind: 'goblin', shape: s, body: b})) === '["content","style"]')),
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
assert('d.pass-1-renders-everything-open',
  PICKS.includes('data-collapsed="false"'),
  'the only data-collapsed value in the tree is the literal false — no fold state exists yet');
assert('d.no-collapse-UI-and-no-persistence-key-yet',
  !INSP.includes('localStorage') && !PICKS.includes('localStorage')
    && !APP.includes('inspector-sections') && !INSP.includes('inspector-sections'),
  'no localStorage read/write and no diagram-studio:inspector-sections key in CODE — the string '
  + 'survives only in the PASS 3 notes, which the comment strip removes before this count');
assert('d.section-wrapper-has-no-click-handler-yet',
  (() => {
    const wrap = PICKS_RAW.slice(PICKS_RAW.indexOf('export function Section('));
    const body = stripTs(wrap.slice(0, wrap.indexOf('\n}')));
    console.log(`  <Section> body contains onClick: ${/onClick/.test(body)}  aria-expanded: ${/aria-expanded/.test(body)}`);
    return !/onClick/.test(body) && !/aria-expanded/.test(body);
  })(),
  'the Section wrapper is a pure render — §C\'s expanding trigger row is PASS 3');
assert('d.no-localStorage-in-the-new-files',
  !/\blocalStorage\b/.test(INSP_RAW) && !/\blocalStorage\b/.test(PICKS_RAW),
  'neither new file touches storage');
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
assert('e.the-panel-label-textarea-is-still-there',
  countOf(APP, 'rows={4}') === 1 && APP.includes("secBody('text'"),
  '§E.3.1 removes it in PASS 2 with its replacement — pass 1 must not leave the label with no editor');

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
   SUMMARY
   =========================================================================== */
const failed = results.filter(r => !r.pass);
console.log('\n' + '='.repeat(78));
console.log(`PACKAGE-P PASS 1 HARNESS: ${results.length - failed.length}/${results.length} passed`);
console.log('='.repeat(78));
for (const f of failed) console.log(`  FAIL  ${f.id}  — ${f.detail}`);
process.exit(failed.length ? 1 : 0);
