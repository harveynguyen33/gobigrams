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
console.log('\n-- 3. the floors (smaller than a diagram node, by design) --');
const minW = +jsxProp(LABEL, 'NodeResizer', 'minWidth');
const minH = +jsxProp(LABEL, 'NodeResizer', 'minHeight');
const diagW = +jsxProp(DIAGRAM, 'NodeResizer', 'minWidth');
const diagH = +jsxProp(DIAGRAM, 'NodeResizer', 'minHeight');
console.log(`  DiagramNode floors : ${diagW} x ${diagH}`);
console.log(`  LabelNode   floors : ${minW} x ${minH}`);
/* The sheet's own floor for a label that carries no style — must survive, and
   must be strictly below the resizer's, or it would bind instead of the floor. */
const labelRule = rule(CSS, '.label-node');
const cssMinW = labelRule?.decls['min-width'];
console.log(`  .label-node min-width: ${cssMinW}   [styles.css:${labelRule?.line ?? '-'}]`);

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

assert('R5 the label floors are smaller than a diagram node\'s, and grabbable (>44)',
  Number.isFinite(minW) && Number.isFinite(minH) && minW > 0 && minH > 0
    && (minW < diagW || minH < diagH) && minW >= 44 && minH >= 44,
  `label ${minW}x${minH} vs goblin ${diagW}x${diagH}`);

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
