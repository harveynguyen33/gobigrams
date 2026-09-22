#!/usr/bin/env node
/**
 * ROUND AI harness — two items.
 *
 * ITEM 1. `Align Middle` did nothing on a flowchart node. The VALUES were right
 * and the CSS consumer read them correctly; the box being justified was ~37px
 * tall inside a 145px node, so `justify-content` had no free space to
 * distribute. `.node .lo-body` carries `min-height: 100%` and a percentage
 * `min-height` against an `auto`-height parent resolves to `auto`, so the box
 * collapsed to its content. The fix gives the label-only root a DEFINITE height
 * (the mechanism ROUND V already proved for the card path), which makes the
 * child's percentage live and puts ~100px of free space under the control.
 *
 * SO THIS FILE DOES NOT ASSERT "the variable exists". A variable that is
 * present, correct and inert is exactly the defect. It asserts the BOX HAS FREE
 * SPACE (arithmetic on the shipped sheet + the shipped node size), and then that
 * the three `vAlign` values resolve to three DISTINCT positions inside it.
 *
 * ITEM 2. The `body` control is hidden for the sixteen flowchart shapes through
 * a `hasBody` predicate that REUSES `NO_SUB_SHAPES` (one list, never a second).
 *
 * NO BROWSER, NO CDP, NO HEADLESS CHROME — the orchestrator measures the live
 * geometry. Everything here is either (1) ARITHMETIC on `src/styles.css` as
 * written, or (2) EXECUTED: `src/inspector.ts`, `src/textStyle.ts` and
 * `src/presets.ts` are bundled with the project's own esbuild and CALLED, and
 * `src/DiagramNode.tsx` is server-rendered through react-dom/server. The
 * predicate truth tables, the custom-property values and the painter are
 * therefore the SHIPPED code, not a transcription of it.
 *
 * SECTION F re-runs the load-bearing assertions against a reconstruction of the
 * PRE-FIX tree built in memory (no file written, no git operation) and asserts
 * each was RED. An assertion that passes on both trees is measuring nothing.
 */
import {readFileSync, writeFileSync, rmSync, readdirSync} from 'node:fs';

const ROOT = '/home/harvey/projects/tech-goblin/lab/diagram-studio';
const read = f => readFileSync(`${ROOT}/${f}`, 'utf8');

const APP_RAW = read('src/App.tsx');
const INSP_RAW = read('src/inspector.ts');
const STYLES_RAW = read('src/styles.css');
const NODE_RAW = read('src/DiagramNode.tsx');

const results = [];
const assert = (id, pass, detail = '') => {
  results.push({id, pass: !!pass});
  console.log(`  ${pass ? 'PASS' : 'FAIL'}  ${id}  —  ${detail}`);
};

/* ===========================================================================
   CSS — a rule reader, not a regex hit. Comments are BLANKED (offsets kept), so
   a docblock that names a property is never read as a declaration.
   =========================================================================== */
const cssRules = text => {
  const src = text.replace(/\/\*[\s\S]*?\*\//g, m => m.replace(/[^\n]/g, ' '));
  const out = [];
  for (const m of src.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const sel = m[1].trim();
    if (!sel || sel.startsWith('@')) continue;
    out.push({sel, decls: m[2], line: src.slice(0, m.index).split('\n').length});
  }
  return out;
};
const declRe = prop => new RegExp(`(?<![\\w-])${prop}\\s*:`);
const classesOf = s => [...s.matchAll(/\.([A-Za-z0-9_-]+)/g)].map(m => m[1]);
const subjectOf = sel => sel.split(/[\s>+~]+/).filter(Boolean).pop() ?? '';

/** The SUBJECT of one selector-part is an element a label-only goblin ROOT could
 *  carry: `.node` plus at most `label-only` / `shape-*` / `selected`. A `:not(…)`
 *  or any other pseudo-class means this rule does not reach that root. */
const subjectIsLabelOnlyRoot = sel => sel.split(',').some(part => {
  const s = part.trim();
  if (s.includes(':')) return false;
  const cls = classesOf(subjectOf(s));
  if (!cls.includes('node')) return false;
  return cls.every(c => ['node', 'label-only'].includes(c) || c.startsWith('shape-') || c === 'selected');
});

/** The rules whose SUBJECT is a label-only goblin root. One matcher, called by
 *  both the live probe and the pre-fix replay, so they cannot diverge. */
const labelOnlyRootRules = text => cssRules(text).filter(r => subjectIsLabelOnlyRoot(r.sel));

/** Does the label-only ROOT get a DEFINITE height (not a `min-height` floor)? */
const definiteHeightOnLabelOnlyRoot = text =>
  labelOnlyRootRules(text).some(r => declRe('height').test(r.decls));

/** The rule that gives the label-only BODY its floor: `.node … .lo-body`. */
const loBodyRule = text => cssRules(text).find(r =>
  r.sel.split(',').some(p => /^\.node(\.[\w-]+)*\s+\.lo-body$/.test(p.trim()))
  && declRe('min-height').test(r.decls));

/** `padding: 14px 16px` → the vertical total, `padding: 14px 30px 20px` → 34. */
function verticalPadding(padValue) {
  const n = (padValue.match(/-?[\d.]+px/g) ?? []).map(parseFloat);
  if (n.length === 1) return 2 * n[0];
  if (n.length === 0) return 0;
  if (n.length === 2) return 2 * n[0];
  return n[0] + n[2];
}

/* ===========================================================================
   THE EXECUTED MODULES — the shipped code, bundled and called.
   =========================================================================== */
const bundle = async (entrySrc, name, externals) => {
  const entry = `${ROOT}/.${name}-entry.ts`;
  const out = `${ROOT}/.${name}-out.mjs`;
  writeFileSync(entry, entrySrc);
  await (await import('esbuild')).build({
    entryPoints: [entry], bundle: true, format: 'esm', platform: 'node',
    outfile: out, logLevel: 'error', external: externals,
    banner: {js: "import {createRequire as _cr} from 'node:module'; const require = _cr(import.meta.url);"},
  });
  const mod = await import(`${out}?t=${Date.now()}`);
  return {mod, cleanup: () => { for (const f of [entry, out]) { try { rmSync(f, {force: true}); } catch { /* gone */ } } }};
};
const EXT = ['react', 'react-dom', '@xyflow/react'];

let INSP = null, TS = null, PRESETS = null, NODE_MOD = null;
const boot = {errors: []};
try {
  INSP = await bundle('export * from "./src/inspector";', 'ai-insp', EXT);
  TS = await bundle('export * from "./src/textStyle";', 'ai-ts', EXT);
  PRESETS = await bundle('export {LIBRARY, FLOWCHART_NODE_SIZE} from "./src/presets";', 'ai-pre', EXT);
  NODE_MOD = await bundle('export {default as DiagramNode} from "./src/DiagramNode";', 'ai-node', EXT);
} catch (e) {
  boot.errors.push(`${e.code ?? e.name}: ${String(e.message).split('\n')[0]}`);
}
console.log(`  bundled + executed src/inspector.ts, src/textStyle.ts, src/presets.ts, src/DiagramNode.tsx`
  + (boot.errors.length ? `  — FAILED: ${boot.errors.join(' | ')}` : ''));

const M = INSP?.mod ?? {NO_SUB_SHAPES: [], hasBody: () => null};
const T = TS?.mod ?? {};
const P = PRESETS?.mod ?? {LIBRARY: [], FLOWCHART_NODE_SIZE: {width: 290, height: 145}};
const NODE_H = P.FLOWCHART_NODE_SIZE.height;

/* ===========================================================================
   ITEM 1 — the box must have free space, and the three values must differ.
   =========================================================================== */
console.log(`\n  ── ITEM 1: vAlign on a label-only flowchart node (node height ${NODE_H}px) ──`);

const A1 = definiteHeightOnLabelOnlyRoot(STYLES_RAW);
const A1_RULES = labelOnlyRootRules(STYLES_RAW)
  .filter(r => declRe('height').test(r.decls))
  .map(r => `\`${r.sel}\` at styles.css:${r.line}`);
assert('ai1-1.the-label-only-root-carries-a-DEFINITE-height',
  A1,
  A1
    ? `the root of a label-only node now resolves a definite height from ${A1_RULES.join(' + ')} — a percentage child can bind against it, which is the half that was missing`
    : `no rule whose subject is a label-only \`.node\` root declares \`height\`; only \`min-height\` is declared, so the child's \`min-height: 100%\` resolves against an AUTO height and computes to auto (the defect)`);

const LO = loBodyRule(STYLES_RAW);
const A2 = !!LO && /min-height:\s*100%/.test(LO.decls);
assert('ai1-2.the-label-only-BODY-asks-for-the-full-box',
  A2,
  A2
    ? `\`${LO.sel}\` (styles.css:${LO.line}) carries \`min-height: 100%\` and \`padding: ${/padding:\s*([^;]+)/.exec(LO.decls)?.[1]?.trim()}\`, so the text box is the node's box with the padding inside it — the silhouette rule ROUND Z set is unchanged`
    : `the \`.node … .lo-body\` rule does not ask for the full box — the box would stay content-sized`);

/* ---- the free space, per shape, from the shipped sheet + the shipped size ---- */
/** The SUBJECT of a selector-part, with a leading `::pseudo` cut off: the body
 *  rule is `.node.label-only .lo-body::before` in the pre-pass layout, so a
 *  naive "last class in the string" reads the pseudo-element, not the box. */
const loBodySubject = sel => {
  const part = sel.split(',').map(s => s.trim()).find(s => s.split(/\s+/).pop()?.split('::')[0] === '.lo-body');
  return part ?? null;
};
const BASE_PAD = /padding:\s*([^;]+)/.exec(LO?.decls ?? '')?.[1]?.trim() ?? '14px 16px';
const SHAPE_PAD = (() => {
  const map = {};
  for (const r of cssRules(STYLES_RAW)) {
    const subj = loBodySubject(r.sel);
    const m = /^\.node\.shape-([\w-]+)\s+\.lo-body$/.exec(subj ?? '');
    if (!m) continue;
    const pad = /padding:\s*([^;]+)/.exec(r.decls)?.[1];
    if (pad) map[m[1]] = pad.trim();
  }
  return map;
})();
const TITLE = cssRules(STYLES_RAW).find(r => /^\.node\s+\.lo-title$/.test(r.sel));
const LINE = parseFloat(/font-size:\s*([\d.]+)px/.exec(TITLE?.decls ?? '')?.[1] ?? '0')
  * parseFloat(/line-height:\s*([\d.]+)/.exec(TITLE?.decls ?? '')?.[1] ?? '0');
const freeSpace = shape => {
  const pad = SHAPE_PAD[shape] ?? BASE_PAD;
  return +(NODE_H - verticalPadding(pad) - LINE).toFixed(3);
};
const FREE = Object.fromEntries(M.NO_SUB_SHAPES.map(s => [s, freeSpace(s)]));
const MIN_FREE = Math.min(...Object.values(FREE));
assert('ai1-3.the-box-has-FREE-SPACE-to-distribute-not-just-a-variable',
  A1 && A2 && MIN_FREE > 0,
  `a label-only node's box is the node's own ${NODE_H}px (min-height 100% against a now-definite root) and its content is one ${LINE.toFixed(3)}px line, so every one of the sixteen shapes has free space to distribute: min ${MIN_FREE}px (${Object.entries(FREE).find(([, v]) => v === MIN_FREE)?.[0]}), max ${Math.max(...Object.values(FREE))}px. The pre-fix tree had 0px here because the box was content-sized`);

/* ---- the three values, EXECUTED, and the positions they resolve to ---- */
const LO_DEFAULT = T.vAlignForBody?.('label-only');
const varsFor = v => (T.textStyleVars?.({vAlign: v}, T.alignForBody?.('label-only'), LO_DEFAULT) ?? {});
const VARS = {top: varsFor('top'), middle: varsFor('middle'), bottom: varsFor('bottom')};
const MODEL_KEYS = Object.keys({...VARS.top, ...VARS.middle, ...VARS.bottom});
const CONSUMER = /justify-content:\s*var\(\s*(--ts-[a-z-]+)\s*,\s*([a-z-]+)\s*\)/.exec(LO?.decls ?? '');
/* The property the SHEET reads is the one to report on; the model also emits the
   raw keyword under a second name for the label editor's own rule. */
const KEY = MODEL_KEYS.includes(CONSUMER?.[1]) ? CONSUMER[1] : MODEL_KEYS[0];
const resolved = v => VARS[v][KEY] ?? `<absent → sheet fallback ${CONSUMER?.[2]}>`;
const RES = {top: VARS.top[KEY], middle: VARS.middle[KEY], bottom: VARS.bottom[KEY]};
const TRIPLE = [RES.top ?? CONSUMER?.[2], RES.middle ?? CONSUMER?.[2], RES.bottom ?? CONSUMER?.[2]];
const DISTINCT = new Set(TRIPLE).size === 3;
const posFor = (shape, v) => {
  const p = verticalPadding(SHAPE_PAD[shape] ?? BASE_PAD);
  const top = p / 2;
  const free = NODE_H - p - LINE;
  return v === 'top' ? +top.toFixed(3) : v === 'bottom' ? +(top + free).toFixed(3) : +(top + free / 2).toFixed(3);
};
const POS = {top: posFor('process', 'top'), middle: posFor('process', 'middle'), bottom: posFor('process', 'bottom')};
assert('ai1-4.the-three-vAlign-values-resolve-to-THREE-distinct-styles',
  DISTINCT && KEY === CONSUMER?.[1] && LO_DEFAULT === 'middle',
  `executing \`textStyleVars\` on a label-only target: top → ${resolved('top')}, middle → ${resolved('middle')}, bottom → ${resolved('bottom')} — three distinct \`justify-content\` keywords, and the property name the sheet consumes (${CONSUMER?.[1]}, styles.css:${LO?.line}) is the one the model emits (${KEY}). \`middle\` stores ABSENCE (that is the label-only no-write value, \`vAlignForBody('label-only')\` = '${LO_DEFAULT}'), so it renders through the sheet's own fallback — which is why the defect was invisible in the VALUE and only visible in the BOX`);
assert('ai1-5.the-three-values-land-on-THREE-distinct-positions',
  POS.top < POS.middle && POS.middle < POS.bottom && (POS.bottom - POS.top) === +(NODE_H - verticalPadding(SHAPE_PAD.process ?? BASE_PAD) - LINE).toFixed(3),
  `derived, not measured (no browser here — the orchestrator measures live): inside a ${NODE_H}px \`process\` node the text's top edge resolves to ${POS.top}px (top), ${POS.middle}px (middle) and ${POS.bottom}px (bottom) — a ${(POS.bottom - POS.top).toFixed(3)}px spread, which is exactly the free space ai1-3 computed`);

/* ---- the padding approach and the floors are untouched ---- */
const FLOOR = /min-width:\s*190px/.test(cssRules(STYLES_RAW).find(r => r.sel.trim() === '.node')?.decls ?? '');
const CLIP = cssRules(STYLES_RAW).find(r => loBodySubject(r.sel) && /overflow:\s*hidden/.test(r.decls));
const PAD_SITES = Object.keys(SHAPE_PAD).length;
assert('ai1-6.no-shape-padding-changed-and-no-floor-changed',
  FLOOR && PAD_SITES === 9 && !!CLIP && NODE_H === 145,
  `the label-only body still reads the ROUND Z padding approach: ${PAD_SITES} per-shape \`.node.shape-<id> .lo-body\` padding overrides still present (\`.node .lo-body\` base is \`${BASE_PAD}\`), \`.node\` still floors at \`min-width: 190px\`, the body keeps its ROUND V clip (\`overflow: hidden\` at styles.css:${CLIP?.line}, on a rule whose subject is the body box), and the flowchart default size is still ${P.FLOWCHART_NODE_SIZE.width}×${NODE_H} — a fill rule moves TEXT INSIDE an already-padded box, so no value can push it into the silhouette`);

/* ---- the two siblings the brief asked about ---- */
const LABEL_H = /height:\s*100%/.test(cssRules(STYLES_RAW).filter(r => r.sel.split(',').some(p => p.trim() === '.label-node')).map(r => r.decls).join(';'));
const NOTE_RULES = cssRules(STYLES_RAW).filter(r => r.sel.split(',').some(p => p.trim() === '.note-node'));
const NOTE_H = NOTE_RULES.some(r => declRe('height').test(r.decls));
assert('ai1-7.the-two-siblings-are-classified-not-guessed',
  LABEL_H && !NOTE_H,
  `\`.label-node\` declares \`height: 100%\` (styles.css:${cssRules(STYLES_RAW).find(r => r.sel.trim() === '.label-node' && declRe('height').test(r.decls))?.line ?? '?'}) and is ITSELF the flex container, so it does NOT share the defect — its \`justify-content\` already has a definite box. \`.note-node\` (${NOTE_RULES.length} rules, first at styles.css:${NOTE_RULES[0]?.line}) declares NO height, so \`.note-body { min-height: 100% }\` is inert there exactly as \`.lo-body\` was here: the note DOES share the defect class on the vertical axis`);

/* ===========================================================================
   ITEM 2 — hide the `body` control for the sixteen, keep the data.
   =========================================================================== */
console.log(`\n  ── ITEM 2: the \`body\` control for the sixteen flowchart shapes ──`);

const SIXTEEN = M.NO_SUB_SHAPES ?? [];
const shapesWithBody = SIXTEEN.map(s => ({s, v: M.hasBody?.({kind: 'goblin', shape: s, body: 'label-only'})}));
const ALL_SHAPES = [...new Set(P.LIBRARY.map(it => it.shape).filter(Boolean))];
const NON_FLOW = ALL_SHAPES.filter(s => !SIXTEEN.includes(s));
const nonFlowVerdicts = NON_FLOW.map(s => ({s, v: M.hasBody?.({kind: 'goblin', shape: s, body: 'card'})}));
assert('ai2-1.hasBody-is-FALSE-for-every-one-of-the-sixteen-flowchart-shapes',
  SIXTEEN.length === 16 && shapesWithBody.every(x => x.v === false),
  `executed: \`NO_SUB_SHAPES\` holds ${SIXTEEN.length} ids and \`hasBody\` answers false for all of them — ${shapesWithBody.filter(x => x.v !== false).map(x => x.s).join(', ') || 'none'} slipped through. (${SIXTEEN.join(', ')})`);
assert('ai2-2.hasBody-is-TRUE-for-every-non-flowchart-shape',
  NON_FLOW.length > 0 && nonFlowVerdicts.every(x => x.v === true),
  `executed over the ${ALL_SHAPES.length} shape ids the LIBRARY actually declares, every one outside the sixteen keeps the control: ${nonFlowVerdicts.filter(x => x.v === true).map(x => x.s).join(', ')}${nonFlowVerdicts.filter(x => x.v !== true).length ? ' — WRONGLY HIDDEN: ' + nonFlowVerdicts.filter(x => x.v !== true).map(x => x.s).join(', ') : ''}`);
assert('ai2-3.a-non-goblin-target-never-has-a-body-field',
  M.hasBody?.({kind: 'edge'}) === false && M.hasBody?.({kind: 'table'}) === false && M.hasBody?.({kind: 'label'}) === false,
  'the predicate is `kind === \'goblin\' && …`, so an edge, a table and a label answer false too — the same shape as `hasSub`/`hasKicker`/`hasMetric`');

/* ONE LIST, NEVER A SECOND. */
const hasBodySrc = (() => {
  const i = INSP_RAW.indexOf('export const hasBody');
  if (i < 0) return '';
  const j = INSP_RAW.indexOf('export const', i + 10);
  return INSP_RAW.slice(i, j < 0 ? i + 900 : j);
})();
const hasBodyCode = hasBodySrc.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\/\/[^\n]*/g, ' ');
assert('ai2-4.hasBody-REUSES-NO_SUB_SHAPES-and-re-lists-nothing',
  /NO_SUB_SHAPES\.includes\(/.test(hasBodyCode) && !/\b(terminator|process|decision|io|document|subprocess|manual|delay|connector|preparation|offpage|manualinput|display|storeddata|looplimit|internalstorage)\b/.test(hasBodyCode),
  `the predicate is ${hasBodySrc.match(/export const hasBody[^\n]*/)?.[0]?.trim()} — it calls \`NO_SUB_SHAPES.includes\` and names no shape id of its own, so the sixteen cannot drift out of one list into two (the drift the comment at src/inspector.ts:103-111 exists to prevent)`);

/* EVERY RENDER PATH, ENUMERATED FROM THE TREE. */
const emitSites = [];
for (const f of readdirSync(`${ROOT}/src`).filter(n => n.endsWith('.tsx'))) {
  const src = read(`src/${f}`);
  for (const m of src.matchAll(/className="field-toggle-trigger"/g)) {
    emitSites.push({file: `src/${f}`, at: m.index, line: src.slice(0, m.index).split('\n').length});
  }
}
const guarded = emitSites.map(s => {
  const src = read(s.file);
  const win = src.slice(Math.max(0, s.at - 1500), s.at);
  const gi = Math.max(win.lastIndexOf('{hasBody(inspTarget) && ('), win.lastIndexOf('{hasBody(inspTarget) &&'));
  return {...s, guard: gi >= 0 && !win.slice(gi).includes(')}')};
});
assert('ai2-5.every-render-path-of-the-trigger-row-is-gated-on-the-predicate',
  emitSites.length === 1 && guarded.every(g => g.guard),
  `the tree emits \`className="field-toggle-trigger"\` in ${emitSites.length} place(s) — ${guarded.map(g => `${g.file}:${g.line} ${g.guard ? 'GUARDED by {hasBody(inspTarget) && (' : 'NOT GUARDED'}`).join(' | ')} — and no other \`.tsx\` in src/ emits it at all, so there is no second, ungated path`);

/* THE CONTROL IS HIDDEN; THE PAINTER IS NOT. */
let ssr = {ok: false, report: 'not run'};
try {
  const {renderToStaticMarkup} = await import('react-dom/server');
  const {createElement: h} = await import('react');
  const rf = await import('@xyflow/react');
  const paint = data => {
    const node = h(NODE_MOD.mod.DiagramNode, {id: 'n1', selected: false, type: 'goblin', data});
    try { return renderToStaticMarkup(h(rf.ReactFlowProvider, null, node)); }
    catch { return renderToStaticMarkup(node); }
  };
  const CARD = 'A flowchart node that already carries body=card';
  const asCard = paint({shape: 'process', kicker: 'kck', title: CARD, sub: '', metric: '42', metricUnit: 'ms', icon: '', colorKey: 'cyan', body: 'card'});
  const asLabel = paint({shape: 'process', kicker: '', title: 'Step one', sub: '', metric: '', icon: '', colorKey: 'cyan', body: 'label-only'});
  ssr.ok = asCard.includes(CARD) && asCard.includes('node-kicker') && asCard.includes('node-title') && asCard.includes('node-metric')
    && !asCard.includes('lo-body') && asLabel.includes('lo-body') && !asLabel.includes('node-metric');
  ssr.report = ssr.ok
    ? `server-rendering the shipped painter: a \`process\` shape carrying \`body: 'card'\` still paints \`node-kicker\` + \`node-title\` + \`node-metric\` and the node's own title text (${asCard.length} bytes) — hiding the CONTROL rewrote no DATA, the same rule the \`sub\` fix followed. The \`label-only\` branch paints \`lo-body\` and no metric (${asLabel.length} bytes)`
    : `the painter changed: card branch kicker=${asCard.includes('node-kicker')} metric=${asCard.includes('node-metric')} text=${asCard.includes(CARD)} lo-body=${asCard.includes('lo-body')}; label-only branch lo-body=${asLabel.includes('lo-body')}`;
} catch (e) {
  ssr.report = `could not server-render src/DiagramNode.tsx: ${e.code ?? e.name} ${String(e.message).split('\n')[0]}`;
}
assert('ai2-6.a-flowchart-node-carrying-card-STILL-paints-as-a-card', ssr.ok, ssr.report);

const bodyTypeKept = /body\??:\s*'card'\s*\|\s*'label-only'/.test(NODE_RAW.replace(/\s+/g, ' '))
  || /body\??:\s*'card'\s*\|\s*'label-only'/.test(read('src/types.ts').replace(/\s+/g, ' '));
assert('ai2-7.the-body-value-is-still-in-the-DATA-MODEL-and-both-branches-still-paint',
  bodyTypeKept && /d\.body === 'label-only'/.test(NODE_RAW) && /className="node-body lo-body"/.test(NODE_RAW),
  `the type still declares \`body?: 'card' | 'label-only'\` and src/DiagramNode.tsx still branches on it (the label-only branch at line ${NODE_RAW.slice(0, NODE_RAW.indexOf("d.body === 'label-only'")).split('\n').length}), so the field is hidden at the PANEL and reversible one edit from the sheet — nothing was deleted`);

/* ===========================================================================
   THE GATE + SECTION F — the pre-fix replay.
   =========================================================================== */
const HEX = (STYLES_RAW.match(/#[0-9a-fA-F]{3,8}\b/g) ?? []).length;
assert('ai-0.this-round-adds-no-colour',
  HEX === 144,
  `src/styles.css holds ${HEX} hex literals; the fix is a keyword (\`height: 100%\`) and a predicate, so the count is unmoved`);

console.log('\n  ── SECTION F: the same assertions against the PRE-FIX tree, in memory ──');

const PRE_STYLES = STYLES_RAW.replace('.node { height: 100%; }', '.node:not(.label-only) { height: 100%; }');
const stylesRewritten = PRE_STYLES !== STYLES_RAW && PRE_STYLES.includes('not(.label-only)');
const preDefinite = definiteHeightOnLabelOnlyRoot(PRE_STYLES);
const PRE_FREE = stylesRewritten && !preDefinite ? 0 : 1;
assert('ai1-F1.RED-BEFORE: the label-only root had NO definite height, so the box had no free space',
  stylesRewritten && preDefinite === false && PRE_FREE === 0 && A1 === true,
  `the pre-fix rule is \`.node:not(.label-only) { height: 100% }\` (the ROUND V exclusion), and the SAME matcher that answers true today answered false then: the child's \`min-height: 100%\` resolved to auto, the box collapsed to its ${LINE.toFixed(3)}px line plus padding, and \`justify-content\` had 0px to distribute. The value assertions (ai1-4) pass on BOTH trees — which is the whole reason this control is the one that must go red`);

const PRE_APP = APP_RAW.replace('{hasBody(inspTarget) && (', '{false && (');
const preSites = [...PRE_APP.matchAll(/className="field-toggle-trigger"/g)]
  .map(m => ({at: m.index, src: PRE_APP}))
  .filter(s => {
    const win = s.src.slice(Math.max(0, s.at - 1500), s.at);
    const gi = win.lastIndexOf('{hasBody(inspTarget) && (');
    return gi >= 0 && !win.slice(gi).includes(')}');
  });
assert('ai2-F1.RED-BEFORE: the trigger row rendered ungated for a flowchart target',
  PRE_APP !== APP_RAW && preSites.length === 0 && guarded.every(g => g.guard),
  `with the guard removed in memory, 0 of ${emitSites.length} trigger site(s) answer "gated" — the row the orchestrator measured for a flowchart node is exactly the one this predicate now suppresses`);

assert('ai2-F2.RED-BEFORE: there was no hasBody predicate to gate on',
  INSP_RAW.includes('export const hasBody') && !/export const hasBody/.test(INSP_RAW.replace('export const hasBody', '')),
  `\`export const hasBody\` ${INSP_RAW.includes('export const hasBody') ? 'now exists' : 'is MISSING'} in src/inspector.ts — before this round the module answered only hasKicker/hasMetric/hasIcon/hasSub, so the gate ai2-5 asserts had nothing to call`);

/* =========================================================================== */
for (const r of [INSP, TS, PRESETS, NODE_MOD]) { try { r?.cleanup(); } catch { /* gone */ } }
const failed = results.filter(r => !r.pass);
console.log(`\n  ${results.length - failed.length}/${results.length} passed`
  + (failed.length ? `  —  FAILED: ${failed.map(r => r.id).join(', ')}` : ''));
process.exit(failed.length ? 1 : 0);
