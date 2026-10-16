#!/usr/bin/env node
/**
 * ROUND R harness — the `label` (Text) node kind is RESIZABLE.
 *
 * THE QUESTION: does the Text palette item now produce a node that can be
 * scaled with a mouse, in both directions, without regressing the labels that
 * already exist on a board?
 *
 * WHY THIS FILE DOES NOT RENDER: this pass has no browser and no DOM, so a
 * resize GESTURE cannot be performed here — that is orchestrator / human
 * territory and is reported as unverifiable, not as passing. What IS checkable
 * is every piece of the mechanism, and each is read from the REAL source that
 * decides it rather than re-implemented:
 *
 *   1. `src/LabelNode.tsx` — parsed as TEXT: is a `NodeResizer` rendered, is it
 *      gated on `selected`, and with which class names and floors?
 *   2. `src/DiagramNode.tsx` — parsed the same way, purely to COMPARE the two
 *      class names. The class names are the fix for a real reported defect
 *      ("2 borders"): `.resize-line { border-width: 0 !important }` in our
 *      sheet is what stops React Flow's own 1px `variant: Line` control
 *      painting a second selection border. A harness that only asserted
 *      "a resizer exists" would pass with different names and reintroduce it.
 *   3. `src/styles.css` — the REAL stylesheet, parsed with the same rule reader
 *      `package-o-selection-stack.mjs` uses, so `.label-node` is interrogated as
 *      CSS rather than by grepping an approximation of it.
 *   4. `src/palette.ts` — parsed for the `Text` item's `size`.
 *
 * COMMENTS ARE STRIPPED BEFORE EVERY "is this declared?" PROBE. A docblock that
 * quotes the old declaration is still a comment, and a naive grep counts it —
 * measured on an earlier pass in this repo, where a note explaining a removed
 * token made a `must be 0` assertion read 2.
 */
import {readFileSync} from 'node:fs';

const ROOT = '/home/harvey/projects/tech-goblin/lab/diagram-studio';

const LABEL_SRC = readFileSync(`${ROOT}/src/LabelNode.tsx`, 'utf8');
const DIAGRAM_SRC = readFileSync(`${ROOT}/src/DiagramNode.tsx`, 'utf8');
const PALETTE_SRC = readFileSync(`${ROOT}/src/palette.ts`, 'utf8');
const OUR_CSS = readFileSync(`${ROOT}/src/styles.css`, 'utf8');

/** Strip block comments. MANDATORY before any "is this declared?" probe.
 *  Each comment is replaced by the SAME NUMBER OF NEWLINES it contained, so a
 *  rule's reported line number still points at the real `src/styles.css` line —
 *  otherwise the evidence printed below would name the wrong line, and a
 *  printed line number that is wrong is worse than no line number. */
const blank = m => m.replace(/[^\n]/g, ' ');
const strip = s => s.replace(/\/\*[\s\S]*?\*\//g, blank).replace(/^[ \t]*\/\/.*$/gm, blank);
const LABEL = strip(LABEL_SRC);
const DIAGRAM = strip(DIAGRAM_SRC);
const PALETTE = strip(PALETTE_SRC);
const CSS = strip(OUR_CSS);

/* ---------- helpers: the same rule reader the package-O harness uses ---------- */
function parseDecls(text) {
  const out = {};
  for (const d of String(text).split(';')) {
    const m = /([a-z-]+):\s*([\s\S]+)/.exec(d.trim());
    if (m) out[m[1]] = m[2].replace(/\s+/g, ' ').trim();
  }
  return out;
}
/** Read one rule out of OUR sheet, by exact selector. Handles a multi-line
 *  block and a one-liner. Returns {decls, line} or null. */
function rule(sheet, sel) {
  const lines = sheet.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const t = lines[i].trim();
    if (!t.startsWith(sel)) continue;
    const after = t.slice(sel.length).trimStart();
    if (!after.startsWith('{') && !after.startsWith(',')) continue;
    const same = /\{([\s\S]*)\}/.exec(t);
    if (same) return {decls: parseDecls(same[1]), line: i + 1};
    const body = [];
    for (let j = i + 1; j < lines.length; j++) {
      if (/^\}/.test(lines[j].trim())) break;
      body.push(lines[j]);
    }
    return {decls: parseDecls(body.join('\n')), line: i + 1};
  }
  return null;
}
/** Every `prop={N}` / `prop="s"` on the FIRST JSX element named `tag`. */
function jsxProp(src, tag, prop) {
  const at = src.indexOf(`<${tag}`);
  if (at < 0) return undefined;
  const body = src.slice(at, src.indexOf('>', at));
  const m = new RegExp(`${prop}=("([^"]*)"|\\{([^}]*)\\})`).exec(body);
  return m ? (m[2] ?? m[3]).trim() : undefined;
}
function jsxHasProp(src, tag, prop) {
  const at = src.indexOf(`<${tag}`);
  if (at < 0) return false;
  const body = src.slice(at, src.indexOf('>', at));
  return new RegExp(`\\b${prop}\\b`).test(body);
}
/** ROUND S — resolve `const NAME = <numeric expression>;` declarations in source
 *  ORDER, so a floor that is EXPRESSED AS another constant (which is the whole
 *  point of the new floors) resolves to its number instead of `NaN`.
 *  Only names and arithmetic are accepted; anything else (a new Set, a JSX
 *  fragment) is skipped, and a name that is not yet known makes its own
 *  declaration unresolvable rather than silently evaluating to 0. */
function numConsts(src) {
  const out = {};
  for (const line of src.split('\n')) {
    const m = /^\s*(?:export\s+)?const\s+([A-Z][A-Z0-9_]*)\s*=\s*([^;]+);/.exec(line);
    if (!m) continue;
    const expr = m[2].trim();
    if (!/^[\w\s+*/().-]+$/.test(expr)) continue;
    let ok = true;
    const v = expr.replace(/[A-Z][A-Z0-9_]*/g, name => {
      if (name in out) return `(${out[name]})`;
      ok = false;
      return '0';
    });
    if (!ok) continue;
    try {
      const n = Function(`return (${v})`)();
      if (Number.isFinite(n)) out[m[1]] = n;
    } catch { /* not arithmetic — not a floor */ }
  }
  return out;
}

console.log('='.repeat(78));
console.log('ROUND R — THE `label` (Text) NODE KIND IS RESIZABLE');
console.log('='.repeat(78));

/* ---------- 1. the label kind renders a resizer at all ---------- */
console.log('\n-- 1. src/LabelNode.tsx --');
const labelAt = LABEL.indexOf('<NodeResizer');
const renders = labelAt >= 0;
console.log(`  renders <NodeResizer>               : ${renders}`);
const gateLine = LABEL.split('\n').find(l => l.includes('<NodeResizer')) ?? '';
console.log(`  the line it sits on                 : ${gateLine.trim()}`);
console.log(`  imported from @xyflow/react         : ${/import\s*\{[^}]*\bNodeResizer\b[^}]*\}\s*from\s*'@xyflow\/react'/.test(LABEL)}`);

/* The GATE. `DiagramNode` writes `selected && RESIZABLE.has(shape) ? … : null`;
   this kind has no RESIZABLE set to consult (it is not a Shape), so the gate is
   `selected` alone. Assert the ternary's CONDITION mentions `selected` and that
   the absent branch is null — i.e. no resizer when not selected. */
const resizerExpr = /const resizer = ([^\n]*?)\n?\s*\?/.exec(LABEL)?.[1] ?? '';
console.log(`  the gate expression                 : ${resizerExpr.trim()}`);
const gatedOnSelected = /\bselected\b/.test(resizerExpr);
const hasNullBranch = /:\s*null\s*;/.test(LABEL.slice(labelAt >= 0 ? labelAt : 0)) || /:\s*null\s*;/.test(LABEL);

/* ---------- 2. the class names match DiagramNode's, exactly ---------- */
console.log('\n-- 2. class names: label vs the goblin kind (the "2 borders" fix) --');
const labelLine = jsxProp(LABEL, 'NodeResizer', 'lineClassName');
const labelHandle = jsxProp(LABEL, 'NodeResizer', 'handleClassName');
const diagLine = jsxProp(DIAGRAM, 'NodeResizer', 'lineClassName');
const diagHandle = jsxProp(DIAGRAM, 'NodeResizer', 'handleClassName');
console.log(`  DiagramNode  lineClassName="${diagLine}"  handleClassName="${diagHandle}"`);
console.log(`  LabelNode    lineClassName="${labelLine}"  handleClassName="${labelHandle}"`);
const sameClasses = labelLine != null && labelLine === diagLine
  && labelHandle != null && labelHandle === diagHandle;

/* The class name only does its job if the sheet still zeroes the line's border.
   Both halves are asserted: the name AND the rule. */
const resizeLine = rule(CSS, '.resize-line');
const lineBorderZero = resizeLine != null && /^0(!important)?$/.test(String(resizeLine.decls['border-width']).replace(/\s/g, ''));
console.log(`  .resize-line { border-width: ${resizeLine?.decls['border-width'] ?? '(rule absent)'} }   [styles.css:${resizeLine?.line ?? '-'}]`);
const handleRule = rule(CSS, '.react-flow__resize-control.handle');
console.log(`  .react-flow__resize-control.handle   [styles.css:${handleRule?.line ?? '-'}] ${JSON.stringify(handleRule?.decls ?? {})}`);

/* ---------- 3. the floors ---------- */
console.log('\n-- 3. the floors ----------');
/* ROUND S: the TWO floors now have to hold an INVARIANT against each other —
   the resizer's floor must never be smaller than the CSS content floor — so
   both are resolved to numbers rather than just printed. The resizer values are
   EXPRESSIONS in `src/DiagramNode.tsx` (that is the fix: one number is derived
   from the other), so they are resolved, not assumed to be literals. */
const DIAG_CONSTS = numConsts(DIAGRAM);
const minW = +jsxProp(LABEL, 'NodeResizer', 'minWidth');
const minH = +jsxProp(LABEL, 'NodeResizer', 'minHeight');
const diagWExpr = jsxProp(DIAGRAM, 'NodeResizer', 'minWidth');
const diagHExpr = jsxProp(DIAGRAM, 'NodeResizer', 'minHeight');
const resolve = expr => (expr in DIAG_CONSTS ? DIAG_CONSTS[expr] : Number(expr));
const diagW = resolve(diagWExpr);
const diagH = resolve(diagHExpr);
const cssContentMinW = DIAG_CONSTS.CSS_CONTENT_MIN_W;
console.log(`  DiagramNode floors : {${diagWExpr}} x {${diagHExpr}}  =  ${diagW} x ${diagH}`);
console.log(`  DiagramNode constants:`);
for (const k of ['CSS_CONTENT_MIN_W', 'CONTENT_MIN_H', 'FLOOR_SLACK_PX', 'NODE_MIN_W', 'NODE_MIN_H']) {
  if (k in DIAG_CONSTS) console.log(`    ${k.padEnd(20)} = ${DIAG_CONSTS[k]}`);
}
console.log(`  LabelNode   floors : ${minW} x ${minH}   (its own kind — unchanged by ROUND S)`);
/* The sheet's own floor for a label that carries no style — must survive, and
   must be strictly below the resizer's, or it would bind instead of the floor. */
const labelRule = rule(CSS, '.label-node');
const labelNodeRule = rule(CSS, '.node');
const cssMinW = labelRule?.decls['min-width'];
const nodeCssMinW = parseInt(String(labelNodeRule?.decls['min-width'] ?? ''), 10);
console.log(`  .label-node min-width: ${cssMinW}   [styles.css:${labelRule?.line ?? '-'}]`);
console.log(`  .node       min-width: ${String(nodeCssMinW)}px   [styles.css:${labelNodeRule?.line ?? '-'}]  (the CSS CONTENT floor)`);

/* ---------- 3b. THE INVARIANT: resizer floor vs the CSS content floor ---------- */
/* The two measured facts the new floors are justified against — worst-case
   natural content across the shapes sharing DiagramNode's resizer (`queue`), and
   the worst-case spill the old 140x80 floor produced. Measured on the running
   app; the numbers are here, not in the source, because the source cites them
   and a harness that re-derived them would be a second source of truth. */
const WORST_CONTENT_W = 199;
const WORST_CONTENT_H = 131;
console.log('\n-- 3b. the invariant the two floors now hold ----------');
console.log(`  resizer minWidth  ${diagW}  >=  .node { min-width }  ${nodeCssMinW}   : ${diagW >= nodeCssMinW}`);
console.log(`  DiagramNode's CSS_CONTENT_MIN_W (${cssContentMinW}) === the sheet's .node min-width (${nodeCssMinW}) : ${cssContentMinW === nodeCssMinW}`);
console.log(`  worst-case measured content across the shapes sharing this resizer: ${WORST_CONTENT_W} x ${WORST_CONTENT_H} (queue)`);
console.log(`  resizer minWidth  ${diagW} >= ${WORST_CONTENT_W} : ${diagW >= WORST_CONTENT_W}      resizer minHeight ${diagH} >= ${WORST_CONTENT_H} : ${diagH >= WORST_CONTENT_H}`);
/* The OLD floors, asserted absent — a regression to them is the defect itself. */
console.log(`  the old 140 x 80 floors are gone : ${diagW !== 140 && diagH !== 80}`);

/* ---------- 4. the inner element fills the wrapper on BOTH axes (the I5 fix) -- */
console.log('\n-- 4. .label-node fills the RF wrapper (the I5 fix, this kind) --');
const labelW = labelRule?.decls['width'];
const labelMinH = labelRule?.decls['min-height'];
const labelWrap = labelRule?.decls['white-space'];
const labelFg = labelRule?.decls['color'];
console.log(`  width        : ${labelW}`);
console.log(`  min-height   : ${labelMinH}`);
console.log(`  white-space  : ${labelWrap}   (text must still WRAP inside the new width)`);
console.log(`  color        : ${labelFg}   (a token, not a literal)`);
console.log(`  padding      : ${labelRule?.decls['padding']}`);
console.log(`  font-size    : ${labelRule?.decls['font-size']}  line-height: ${labelRule?.decls['line-height']}`);

/* ---------- 5. the palette item carries a default size ---------- */
console.log('\n-- 5. src/palette.ts — the Text item --');
/* Locate the Text item by its unique label, then read the size on it. */
const items = PALETTE.split(/\n  \{\n/);
const textItem = items.find(b => /label:\s*'Text'/.test(b));
const textSize = textItem && /size:\s*\{\s*width:\s*(\d+)\s*,\s*height:\s*(\d+)\s*\}/.exec(textItem);
const sizeW = textSize ? +textSize[1] : null;
const sizeH = textSize ? +textSize[2] : null;
console.log(`  label              : ${/'Text'/.test(textItem ?? '') ? 'Text' : '(item not found)'}`);
console.log(`  size               : ${sizeW ?? '(none)'} x ${sizeH ?? '(none)'}`);
/* The wording this round must NOT touch. */
for (const f of ['hint', 'aliases', 'category', 'types']) {
  const m = textItem && new RegExp(`${f}:\\s*([^,\\n]+)`).exec(textItem);
  console.log(`  ${f.padEnd(9)}          : ${m ? m[1].trim() : '(absent)'}`);
}
/* addNodeByLabel honours item.size — read the real branch, not an assumption. */
const APP_SRC = readFileSync(`${ROOT}/src/App.tsx`, 'utf8');
const sizeLine = /const size = item\.size \?\?[^\n]*/.exec(APP_SRC)?.[0] ?? '';
const spread = /\.\.\.\(size \? \{style:\s*\{width: size\.width, height: size\.height\}\} : null\)/.test(APP_SRC);
console.log(`\n  App.tsx addNodeByLabel: ${sizeLine.trim()}`);
console.log(`  ...(size ? {style:{width,height}} : null) present: ${spread}`);

/* ---------- 6. ROUND S — the in-place editor on a Text node ---------- */
console.log('\n-- 6. src/LabelNode.tsx — double-click to type in place (ROUND S) --');
const APP_SRC_RAW = readFileSync(`${ROOT}/src/App.tsx`, 'utf8');
const APP = strip(APP_SRC_RAW);

const editorAt = LABEL.indexOf('<textarea');
const editor = editorAt >= 0;
const editorClass = jsxProp(LABEL, 'textarea', 'className');
const gatesOnDbl = jsxHasProp(LABEL, 'div', 'onDoubleClick');
/* NOT `jsxHasProp` for these: its body ends at the first `>`, and this element
   contains `onChange={e => …}` — an ARROW, whose `>` truncates the scan before
   `onBlur` is reached. Measured, not guessed: with the helper, `onBlur` read as
   absent while the attribute is plainly there. A direct probe over the stripped
   file is the honest one for a multi-line element with arrows in it. */
const commitsOnBlur = /onBlur=\{\(\) => \{ if \(!holdCommit\.current\) commit\(\); \}\}/.test(LABEL);
/* PACKAGE-P §E.3(b) — the hold that guard consults, asserted as part of S9 so
   removing the panel textarea cannot also remove the reason blur was guarded. */
const blurHoldScoped = /const holdCommit = useRef\(false\)/.test(LABEL)
  && /closest\?\.\(INSPECTOR_HOLD_SELECTOR\)/.test(LABEL)
  && /const INSPECTOR_HOLD_SELECTOR = '\.panel\.right'/.test(LABEL);
const commitsOnModEnter = /e\.key === 'Enter' && \(e\.metaKey \|\| e\.ctrlKey\)/.test(LABEL);
const cancels = /e\.key === 'Escape'/.test(LABEL) && /const cancel = \(\) => \{/.test(LABEL);
const cancelRestores = /setDraft\(d\.text \?\? ''\);\s*setEditing\(false\);/.test(LABEL);
const roGate = /if \(ro\) return;/.test(LABEL) && /const ro = !!d\.readOnly;/.test(LABEL);
const writesOwnId = /d\.onCommitText\?\.\(id, draft\)/.test(LABEL)
  && /const LabelNode = memo\(\(\{id, data, selected\}: NodeProps\)/.test(LABEL);
const noBareEnterHijack = !/if \(e\.key === 'Enter'\) \{/.test(LABEL);
const hasNodrag = /nodrag/.test(editorClass ?? '');
const usesEdgeLook = /edge-label-input/.test(editorClass ?? '');
const labelInputRule = rule(CSS, '.node-label-input');
const hasState = /useState/.test(LABEL) && /useRef/.test(LABEL) && /useEffect/.test(LABEL);
const focusEffect = /setTimeout\(\(\) => area\.current\?\.select\(\), 10\)/.test(LABEL);
/* SCOPED TO THE EDITOR ELEMENT, not the file: `nodrag` appears elsewhere in this
   repo (the resize controls carry it), so a whole-file probe would pass even if
   the textarea lost the class. The element's own slice ends at `/>` — the arrow
   in `onChange` means a `>`-terminated scan would cut off before `className`
   on a reordered element. */
const editorSlice = LABEL.slice(editorAt, LABEL.indexOf('/>', editorAt));
const hasNodragScoped = /\bnodrag\b/.test(editorSlice);

console.log(`  <textarea> in the component        : ${editor}`);
console.log(`  className                          : ${editorClass}`);
console.log(`  label root has onDoubleClick       : ${gatesOnDbl}`);
console.log(`  onBlur commits                     : ${commitsOnBlur}`);
console.log(`  Cmd/Ctrl+Enter commits             : ${commitsOnModEnter}`);
console.log(`  Escape cancels (draft restored)    : ${cancels} / ${cancelRestores}`);
console.log(`  plain Enter NOT hijacked           : ${noBareEnterHijack}`);
console.log(`  review-mode gate (ro)              : ${roGate}`);
console.log(`  writes the node's OWN id           : ${writesOwnId}`);
console.log(`  local editing/draft state + ref    : ${hasState}`);
console.log(`  focus/select effect                : ${focusEffect}`);
console.log(`  nodrag (a selection is not a drag)  : ${hasNodragScoped && hasNodrag}`);
console.log(`  reuses .edge-label-input           : ${usesEdgeLook}`);
console.log(`  .node-label-input rule             : ${labelInputRule ? `[styles.css:${labelInputRule.line}] ${JSON.stringify(labelInputRule.decls)}` : '(absent)'}`);

/* The App half: the callback reaches the component, and the commit keeps
   `update()`'s two load-bearing properties. */
const appInjects = /onCommitText: commitLabelText/.test(APP) && /readOnly,/.test(APP);
const appLabelsOnly = /if \(n\.type === 'label'\) \{/.test(APP);
const commitFn = /const commitLabelText = useCallback\(\(id: string, text: string\) => \{[\s\S]*?\}, \[tickTask, pushHistory, setNodes\]\);/.exec(APP)?.[0] ?? '';
const commitOnceHistory = (commitFn.match(/pushHistory\(\);/g) ?? []).length === 1;
const commitKeysOnId = /ns\.map\(n => \(n\.id === id \? \{\.\.\.n, data: \{\.\.\.n\.data, text\}\} : n\)\)/.test(commitFn);
const commitNoOpGuard = /if \(!cur \|\| \(\(\(cur\.data as any\)\?\.text \?\? ''\) as string\) === text\) return;/.test(commitFn);
console.log(`\n-- 6b. src/App.tsx — the wiring --`);
console.log(`  rfNodes injects onCommitText/readOnly, label kind only : ${appInjects && appLabelsOnly}`);
console.log(`  commitLabelText: pushHistory once per commit           : ${commitOnceHistory}`);
console.log(`  commitLabelText: writes the passed id                  : ${commitKeysOnId}`);
console.log(`  commitLabelText: no-op guard                           : ${commitNoOpGuard}`);
/* The inspector writer used to be a SECOND writer for the same `text`, and it
   is GONE (PACKAGE-P §E.3). The semantics it shared with the in-place editor —
   `update()` keyed on its selected id, `pushHistory()` once per commit — still
   hold, and they are asserted below so the removal cannot quietly take the
   history discipline with it. */
const inspectorTextarea = /selected\.type === 'label' \? \([\s\S]*?<textarea[\s\S]*?onChange=\{e => update\(\{text: e\.target\.value\}/.test(APP);
const noPanelTextarea = !/<textarea/.test(APP);
const updateFn = /const update = \(patch[\s\S]*?\n  \};/.exec(APP)?.[0] ?? '';
console.log(`  the panel's label <textarea> is removed (PACKAGE-P §E.3)  : ${noPanelTextarea}`);
console.log(`  update() still keyed on its selected id + pushHistory once : ${/if \(!sel\) return;/.test(updateFn) && (updateFn.match(/pushHistory\(\);/g) ?? []).length === 1}`);

/* Tokens only — no literal colour in the two rules ROUND S added. */
const newRules = `${JSON.stringify(labelInputRule?.decls ?? {})}`;
console.log(`  no hex literal in .node-label-input                    : ${!/#[0-9a-fA-F]{3,8}\b/.test(newRules)}`);

/* ---------- ASSERTIONS ---------- */
console.log('\n-- ASSERTIONS --');
const assertions = [];
const assert = (id, pass, detail) => {
  assertions.push({id, pass, detail});
  console.log(`  ${pass ? 'PASS' : 'FAIL'}  ${id}${detail ? '  — ' + detail : ''}`);
};

assert('R1 LabelNode renders a NodeResizer',
  renders && jsxHasProp(LABEL, 'NodeResizer', 'minWidth'),
  renders ? 'parsed from the real component text' : 'no <NodeResizer> in src/LabelNode.tsx');

assert('R2 the resizer is gated on `selected` (and null otherwise)',
  gatedOnSelected && hasNullBranch,
  `gate="${resizerExpr.trim()}"`);

assert('R3 the class names are DiagramNode\'s, character for character',
  sameClasses,
  `line "${labelLine}" vs "${diagLine}"; handle "${labelHandle}" vs "${diagHandle}"`);

assert('R4 .resize-line still kills RF\'s own line border (no second selection border)',
  lineBorderZero,
  `.resize-line { border-width: ${resizeLine?.decls['border-width']} } [styles.css:${resizeLine?.line}]`);

/* AQ19e — the goblin floors are per-node derivations; compare the label floors
   against the CLAMP CONSTANTS (the worst cases the derivations can reach). */
assert('R5 the label floors are smaller than a diagram node\'s, and grabbable (>44)',
  Number.isFinite(minW) && Number.isFinite(minH) && minW > 0 && minH > 0
    && (minW < DIAG_CONSTS.NODE_MIN_W || minH < DIAG_CONSTS.NODE_MIN_H) && minW >= 44 && minH >= 44,
  `label ${minW}x${minH} vs goblin clamp ${DIAG_CONSTS.NODE_MIN_W}x${DIAG_CONSTS.NODE_MIN_H}`);

assert('R6 .label-node fills the wrapper on BOTH axes',
  labelW === '100%' && labelMinH === '100%',
  `width: ${labelW}, min-height: ${labelMinH} [styles.css:${labelRule?.line}]`);

assert('R7 .label-node still wraps and still uses a theme token for colour',
  labelWrap === 'pre-wrap' && /^var\(--/.test(String(labelFg)),
  `white-space: ${labelWrap}, color: ${labelFg}`);

assert('R8 the sheet\'s min-width survives and stays below the resizer floor',
  /^(\d+)px$/.test(String(cssMinW)) && parseInt(cssMinW, 10) < minW,
  `min-width: ${cssMinW} < resizer ${minW}px`);

assert('R9 the Text palette item has a default size, above the floor',
  sizeW != null && sizeH != null && sizeW > minW && sizeH > minH,
  `${sizeW}x${sizeH} vs floor ${minW}x${minH}`);

assert('R10 addNodeByLabel honours item.size (no App.tsx change needed)',
  /item\.size \?\?/.test(sizeLine) && spread,
  'item.size is the first branch of the size expression; style is spread onto the node');

/* ---- ROUND S: the floors now hold an invariant against the sheet ---- */
assert('S1 the resizer floor is NEVER below the CSS content floor (.node min-width)',
  DIAG_CONSTS.NODE_MIN_W >= nodeCssMinW
    && /Math\.min\(NODE_MIN_W, naturalWRef\.current\)/.test(DIAGRAM),
  `clamp constant NODE_MIN_W ${DIAG_CONSTS.NODE_MIN_W} >= .node min-width ${nodeCssMinW} (the per-node floor is min(clamp, natural))`);

assert('S2 DiagramNode derives its floor FROM the CSS floor (one number, not two)',
  cssContentMinW === nodeCssMinW && /CSS_CONTENT_MIN_W \+ FLOOR_SLACK_PX/.test(DIAGRAM),
  `CSS_CONTENT_MIN_W ${cssContentMinW} === .node { min-width: ${nodeCssMinW}px }`);

/* AQ19c 2026-10-16 — the vertical floor became PER-NODE: minHeight={minHFloor}
   where minHFloor = min(NODE_MIN_H, measured natural height). The worst-case
   141 guarantee moved into the auto-grow ladder (AQ15c), which re-raises any
   too-short node instead of clipping — so S3 now pins the DERIVATION (the clamp
   must reference NODE_MIN_H) instead of a static number. */
assert('S3 the floors clamp against the NODE_MIN constants (worst-case moved to auto-grow)',
  /minWFloor = naturalWRef\.current > 0[\s\S]{0,80}Math\.min\(NODE_MIN_W, naturalWRef\.current\)/.test(DIAGRAM)
    && /minHFloor = naturalHRef\.current > 0[\s\S]{0,80}Math\.min\(NODE_MIN_H, naturalHRef\.current\)/.test(DIAGRAM)
    && DIAG_CONSTS.NODE_MIN_W >= WORST_CONTENT_W,
  `floors are per-node natural, clamped by NODE_MIN_W=${DIAG_CONSTS.NODE_MIN_W} (>= worst width ${WORST_CONTENT_W}) and NODE_MIN_H=${DIAG_CONSTS.NODE_MIN_H}`);

assert('S4 the old 140x80 floors are GONE (a regression would be the defect)',
  diagW !== 140 && diagH !== 80,
  `minWidth=${diagW}, minHeight=${diagH}`);

assert('S5 the sheet keeps min-width: 190px (Harvey\'s option 1.a — not removed)',
  nodeCssMinW === 190,
  `.node { min-width: ${nodeCssMinW}px } [styles.css:${labelNodeRule?.line}]`);

assert('S6 the label kind\'s own floors are UNCHANGED, and clear its own content',
  minW === 80 && minH === 48,
  `LabelNode still ${minW}x${minH} — one line is 19.5px + 8px padding = 27.5, two = 47`);

/* ---- ROUND S: the in-place editor ---- */
assert('S7 double-click opens a <textarea> (multi-line: an <input> could not hold the text)',
  editor && gatesOnDbl && usesEdgeLook,
  `className "${editorClass}"`);

assert('S8 Escape cancels — the draft is restored before the editor closes',
  cancels && cancelRestores,
  'cancel() sets draft back to the stored text, then closes');

assert('S9 blur commits, and Cmd/Ctrl+Enter commits',
  commitsOnBlur && commitsOnModEnter && blurHoldScoped,
  'the blur handler is now `onBlur={() => { if (!holdCommit.current) commit(); }}` — blur still '
  + 'commits, but PACKAGE-P §E.3 holds that commit while the pointer is inside the inspector, so a '
  + 'Text-section click does not end the edit. Cmd/Ctrl+Enter still commits unconditionally.');

assert('S10 plain Enter is NOT hijacked (it must insert a newline in a textarea)',
  noBareEnterHijack,
  'the Enter branch carries a (metaKey || ctrlKey) guard');

assert('S11 the write targets the DOUBLE-CLICKED node\'s id, not the selection',
  writesOwnId && commitKeysOnId,
  'LabelNode commits (id, draft) from its own NodeProps; App maps n.id === id');

assert('S12 pushHistory runs ONCE PER COMMIT, never per keystroke',
  commitOnceHistory && hasState,
  'the draft lives in local state; exactly one pushHistory() in commitLabelText');

assert('S13 read-only review mode cannot OPEN the editor',
  roGate && appInjects,
  'ro = !!d.readOnly, `if (ro) return` before setEditing; readOnly injected per-node in rfNodes');

assert('S14 the editor is a nodrag region (a selection must not start a node drag)',
  hasNodragScoped && hasNodrag,
  'the class is on the <textarea> itself; @xyflow/system useDrag drops a pointerdown whose target matches `.nodrag`');

/* PACKAGE-P §E.3 REVERSED THIS ASSERTION, deliberately and in the same pass
   that removed its subject. ROUND S asserted `two writers, one semantics` — the
   panel's <textarea> AND the in-place editor both writing `text`. That second
   writer is now REMOVED (its replacement, the Text section, edits STYLE not
   `text`), so the correct statement is: the panel holds no text writer at all,
   the in-place editor is the only one, and the shared history discipline
   (`update()` keyed on the selected id, ONE pushHistory per commit) survives on
   the writer that remains. Stated as a count, so a reintroduction fails. */
assert('S15 the panel\'s second text writer is REMOVED and `update()` keeps its semantics',
  noPanelTextarea && !inspectorTextarea && editor
    && /if \(!sel\) return;/.test(updateFn) && (updateFn.match(/pushHistory\(\);/g) ?? []).length === 1,
  `${APP.match(/<textarea/g)?.length ?? 0} <textarea> in App.tsx (0 expected); the in-place editor is `
  + 'the only writer left; update() still no-ops without a selection and pushes history exactly once');

assert('S16 the new rule uses tokens only',
  labelInputRule != null && !/#[0-9a-fA-F]{3,8}\b/.test(newRules),
  `.node-label-input [styles.css:${labelInputRule?.line}]`);

const failed = assertions.filter(a => !a.pass);
console.log(`\nHARNESS: ${assertions.length - failed.length}/${assertions.length} passed`);

/* ---------- WHAT THIS HARNESS CANNOT SEE ---------- */
console.log('\n-- NOT VERIFIED HERE (needs a real pointer / DOM) --');
console.log('  * the resize GESTURE itself: dragging a grip and seeing the box follow,');
console.log('    and the text reflow. No browser in this pass — orchestrator/human.');
console.log('  * that the grips paint ON TOP of the label text (z-index vs the node');
console.log('    body). `styles.css` sets `z-index: 2` on the handle rule and `.label-node`');
console.log('    declares no z-index, but that is a reading, not an observation.');
console.log('  * read-only review mode hiding the resizer. The mechanism is React Flow\'s');
console.log('    own `elementsSelectable={!readOnly}` plus the mode toggle clearing any');
console.log('    existing selection — a SELECTION cannot exist, so the `selected` gate');
console.log('    above cannot open. That is a code-path argument, not a rendered check.');

process.exit(failed.length ? 1 : 0);
