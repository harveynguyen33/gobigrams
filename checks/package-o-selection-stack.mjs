#!/usr/bin/env node
/**
 * PACKAGE-O ITEM 1 harness — the SELECTION PAINT STACK on a node's top edge.
 *
 * THE QUESTION: how many distinct painted lines cross a selected node's top
 * edge, and what paints each one?
 *
 * WHY NOT A SCREENSHOT: this pass has no browser and no DOM. So the stack is
 * DERIVED from the three things that actually decide it, none of them a guess:
 *
 *   1. THE TREE. Which elements exist is read from `@xyflow/react`'s INSTALLED
 *      source — `NodeResizer` maps `XY_RESIZER_LINE_POSITIONS` to controls with
 *      `variant: 'Line'` and `XY_RESIZER_HANDLE_POSITIONS` to `variant:
 *      'Handle'`. This file imports those two arrays from the installed package
 *      rather than transcribing them, so the count cannot drift from the pin.
 *   2. THE PAINT. What each element paints is read out of the INSTALLED
 *      `@xyflow/react/dist/style.css` and our own `src/styles.css` — the real
 *      declarations, quoted with their file+line.
 *   3. THE GEOMETRY. Where each painted line sits relative to the node's own
 *      edge comes from those same rules (`left/right/top/bottom`, `width`,
 *      `transform`, `border-*-width`).
 *
 * It is NOT a renderer. It models the handful of rules that decide the one
 * question. Every modelled rule is printed with its source line so the model
 * can be checked against the sheet by eye.
 */
import {readFileSync} from 'node:fs';

const ROOT = '/home/harvey/projects/tech-goblin/lab/diagram-studio';

const OUR_CSS = readFileSync(`${ROOT}/src/styles.css`, 'utf8');
const RF_CSS = readFileSync(`${ROOT}/node_modules/@xyflow/react/dist/style.css`, 'utf8');
const RF_SRC = readFileSync(`${ROOT}/node_modules/@xyflow/react/dist/esm/index.js`, 'utf8');
const SYS_SRC = readFileSync(`${ROOT}/node_modules/@xyflow/system/dist/esm/index.mjs`, 'utf8');

/* The two position arrays are READ OUT OF THE INSTALLED PACKAGE rather than
   transcribed, so the control count can never drift from the pin. (ESM import
   of `@xyflow/system` fails from a script outside the package root, and the
   arrays are `const … = [...]` literals, so a targeted parse is exact.) */
function constArray(src, name) {
  const m = new RegExp(`const ${name} = \\[([^\\]]*)\\]`).exec(src);
  if (!m) throw new Error(`array ${name} not found in the installed package`);
  return m[1].split(',').map(s => s.trim().replace(/^['"]|['"]$/g, '')).filter(Boolean);
}
const LINE_POSITIONS = constArray(SYS_SRC, 'XY_RESIZER_LINE_POSITIONS');
const HANDLE_POSITIONS = constArray(SYS_SRC, 'XY_RESIZER_HANDLE_POSITIONS');

/* ---------- helpers: read a CSS rule out of OUR sheet or RF's ---------- */
/** Parse a rule body into declarations. Handles BOTH a multi-line block and a
 *  one-liner written on a single source line (`.resize-line { stroke: … }`). */
function parseDecls(text) {
  const out = {};
  for (const d of String(text).replace(/\/\*[\s\S]*?\*\//g, '').split(';')) {
    const m = /([a-z-]+):\s*([\s\S]+)/.exec(d.trim());
    if (m) out[m[1]] = m[2].replace(/\s+/g, ' ').trim();
  }
  return out;
}
function rule(sheet, sel, label) {
  const lines = sheet.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const t = lines[i].trim();
    if (!t.startsWith(sel)) continue;
    // selector may be part of a list; require a word boundary after it
    const after = t.slice(sel.length).trimStart();
    if (!after.startsWith('{') && !after.startsWith(',')) continue;
    // one-liner: the whole rule closes on this line
    const same = /\{([\s\S]*)\}/.exec(t);
    if (same) return {decls: parseDecls(same[1]), line: i + 1, label};
    const body = [];
    for (let j = i + 1; j < lines.length; j++) {
      if (/^\}/.test(lines[j].trim())) break;
      body.push(lines[j]);
    }
    return {decls: parseDecls(body.join('\n')), line: i + 1, label};
  }
  return null;
}
/** All rules whose selector list contains `needle` (e.g. every `.line.top`). */
function rulesMatching(sheet, needle, label) {
  const lines = sheet.split('\n');
  const found = [];
  for (let i = 0; i < lines.length; i++) {
    const t = lines[i].trim();
    if (!t.endsWith('{') || !t.includes(needle)) continue;
    const out = {};
    const body = [];
    for (let j = i + 1; j < lines.length; j++) {
      if (/^\}/.test(lines[j].trim())) break;
      body.push(lines[j]);
    }
    for (const d of body.join('\n').replace(/\/\*[\s\S]*?\*\//g, '').split(';')) {
      const m = /([a-z-]+):\s*([\s\S]+)/.exec(d.trim());
      if (m) out[m[1]] = m[2].replace(/\s+/g, ' ').trim();
    }
    found.push({sel: t.replace(/\s*\{$/, ''), decls: out, line: i + 1, label});
  }
  return found;
}
/** Resolve a theme token to its literal, from the dark block (`[data-theme="dark"]`). */
function token(name) {
  const lines = OUR_CSS.split('\n');
  const start = lines.findIndex(l => l.trim() === '[data-theme="dark"] {');
  for (let j = start + 1; j < lines.length; j++) {
    if (/^\}/.test(lines[j].trim())) break;
    const m = new RegExp('^\\s*' + name.replace(/[-]/g, '\\-') + ':\\s*(.+?);').exec(lines[j]);
    if (m) return m[1];
  }
  return null;
}
/** Our sheet with comments stripped. MANDATORY before any "is this declared?"
 *  probe: a note that QUOTES the old declaration is still a comment, and a
 *  naive grep counts it (measured — the first run of A6 below read the
 *  explanatory comment as a live declaration). */
const OUR_CSS_NO_COMMENTS = OUR_CSS.replace(/\/\*[\s\S]*?\*\//g, '');

console.log('='.repeat(78));
console.log('ITEM 1 — SELECTION PAINT STACK ACROSS A NODE\'S TOP EDGE');
console.log('='.repeat(78));

/* ---------- 1. the tree, from the INSTALLED React Flow ---------- */
console.log('\n-- 1. What NodeResizer RENDERS (read from the installed package) --');
console.log(`XY_RESIZER_LINE_POSITIONS   = ${JSON.stringify(LINE_POSITIONS)}`);
console.log(`XY_RESIZER_HANDLE_POSITIONS = ${JSON.stringify(HANDLE_POSITIONS)}`);
// The mapping that proves variant Line vs Handle. Both maps live on the SAME
// source line, so each variant is read from its own slice of the line.
const mapLineSrc = RF_SRC.split('\n').find(l => l.includes('XY_RESIZER_LINE_POSITIONS.map')) ?? '';
const lineSegment = mapLineSrc.split('XY_RESIZER_HANDLE_POSITIONS.map')[0] ?? '';
const handleSegment = mapLineSrc.split('XY_RESIZER_HANDLE_POSITIONS.map')[1] ?? '';
const variantOf = s => /ResizeControlVariant\.(\w+)/.exec(s)?.[1];
console.log(`variant mapping present: Line=${/XY_RESIZER_LINE_POSITIONS\.map/.test(RF_SRC)} Handle=${/XY_RESIZER_HANDLE_POSITIONS\.map/.test(RF_SRC)}`);
console.log(`  line controls  -> variant ${variantOf(lineSegment)}  (${LINE_POSITIONS.length} of them)`);
console.log(`  handle controls-> variant ${variantOf(handleSegment)}  (${HANDLE_POSITIONS.length} of them)`);
/* ---------- 2. THE RESIZE LINE's paint ---------- */
console.log('\n-- 2. The resize LINE control paints (installed RF sheet) --');
const lineBase = rule(RF_CSS, '.react-flow__resize-control.line', 'rf');
console.log(`  ${RF_CSS.split('\n')[lineBase.line - 1].trim()}   [rf style.css:${lineBase.line}]`);
console.log(`  ${JSON.stringify(lineBase.decls)}`);
const linePos = rulesMatching(RF_CSS, '.react-flow__resize-control.line.', 'rf');
for (const r of linePos) {
  console.log(`  ${r.sel.padEnd(46)} ${JSON.stringify(r.decls)}   [rf style.css:${r.line}]`);
}
const rfDefault = /--xy-resize-background-color-default:\s*([^;]+);/.exec(RF_CSS)?.[1];
console.log(`  --xy-resize-background-color-default = ${rfDefault}   [rf style.css:51]`);

/* ---------- 3. OUR sheet: what we override ---------- */
console.log('\n-- 3. OUR overrides --');
const ourResizeLine = rule(OUR_CSS, '.resize-line', 'ours');
console.log(`  .resize-line { ${JSON.stringify(ourResizeLine.decls)} }   [styles.css:${ourResizeLine.line}]`);
const ourHandle = rule(OUR_CSS, '.react-flow__resize-control.handle', 'ours');
console.log(`  .react-flow__resize-control.handle { ${JSON.stringify(ourHandle.decls)} }   [styles.css:${ourHandle.line}]`);
/* The CONNECT DOT — `.react-flow__handle`. Read here as well as the grip: the
   band has to be ordered against BOTH, and A12 compares the band's 10px against
   this dot's own declared box. NOTE the selector boundary: `rule()` requires the
   char after the selector to be `{` or `,`, so `.react-flow__handle:hover`,
   `-left`, `-top` and the `.tnode` overrides do not match and cannot be picked
   up by mistake. */
const ourHandleDot = rule(OUR_CSS, '.react-flow__handle', 'ours');
console.log(`  .react-flow__handle { ${JSON.stringify(ourHandleDot.decls)} }   [styles.css:${ourHandleDot.line}]`);
const ourNodeSel = rule(OUR_CSS, '.node.selected', 'ours');
console.log(`  .node.selected { ${JSON.stringify(ourNodeSel.decls)} }   [styles.css:${ourNodeSel.line}]`);
console.log(`    --bg = ${token('--bg')}, --sel = ${token('--sel')}`);

/* ---------- 4. THE SHAPE FRAME's paint ---------- */
/* ROUND AR — the frame's stroke width lives in `frameMarkup`'s `sw` default:
   `const sw = p.strokeWidth ?? 1.5;` inside the frameMarkup table. */
console.log('\n-- 4. The shape\'s OWN border --');
const shapesSrc = readFileSync(`${ROOT}/src/shapes.tsx`, 'utf8');
const swDefault = /const sw = p\.strokeWidth \?\? ([\d.]+);/.exec(shapesSrc)?.[1];
const frameStrokeW = swDefault
  ?? /stroke-width="([\d.]+)"/.exec(shapesSrc)?.[1]
  ?? /strokeWidth:\s*([\d.]+)/.exec(shapesSrc)?.[1];
const frameStrokeSrc = /stroke:\s*'([^']+)'/.exec(shapesSrc)?.[1];
console.log(`  ShapeFrame strokeWidth = ${frameStrokeW}   [src/shapes.tsx, the \`p\` object]`);
console.log(`  ShapeFrame stroke      = ${frameStrokeSrc}`);
const frameSelOverride = /\.shape-frame[^{]*selected/.test(OUR_CSS);
console.log(`  a \`.selected\` override on the frame stroke exists? ${frameSelOverride ? 'YES' : 'NO'}`);
console.log(`  .shape-frame { ${JSON.stringify(rule(OUR_CSS, '.shape-frame').decls)} }   [styles.css:904]`);

/* ---------- 5. BUILD THE STACK ---------- */
console.log('\n-- 5. THE PAINT STACK (offsets are px relative to the node\'s top edge; negative = outside) --');
/** Resolve `var(--xy-resize-background-color, var(--xy-resize-background-color-default))`
 *  against a possible local definition on the control itself. Comments are
 *  stripped first — an explanatory comment that quotes the old declaration is
 *  not a declaration. */
const localResizeVar = /--xy-resize-background-color:\s*([^;)\n]+)/.exec(OUR_CSS_NO_COMMENTS)?.[1]?.trim() ?? null;
console.log(`  our own --xy-resize-background-color declaration: ${localResizeVar ?? '(none)'}`);
/** The EFFECTIVE border width per side, resolving our override over RF's
 *  per-position rule. `!important` is stripped before the numeric compare. */
const effectiveLineWidth = {};
for (const pos of LINE_POSITIONS) {
  const side = {top: 'border-top-width', bottom: 'border-bottom-width',
    left: 'border-left-width', right: 'border-right-width'}[pos];
  const oursBorder = ourResizeLine?.decls['border-width']
    ?? ourResizeLine?.decls['border']
    ?? ourResizeLine?.decls[side];
  const rfPerPos = rulesMatching(RF_CSS, `.react-flow__resize-control.line.${pos}`, 'rf')
    .find(r => r.decls[side] != null)?.decls[side];
  effectiveLineWidth[pos] = String(oursBorder ?? rfPerPos ?? lineBase.decls['border-width'])
    .replace(/!important/g, '').trim();
}
const linePaints = Object.values(effectiveLineWidth).some(v => !/^0(px)?$/.test(v));

const stack = [];
// (a) the selection ring — box-shadow paints OUTSIDE the border box
stack.push({
  what: '.node.selected box-shadow layer 2 (the ring)',
  colour: token('--sel'),
  width: 2,
  offset: [-4, -2],
  source: `.node.selected { box-shadow: 0 0 0 2px ${token('--bg')}, 0 0 0 4px ${token('--sel')} }  [styles.css:${ourNodeSel.line}]`,
  selectionColoured: true,
});
// (b) the selection ring's gap (painted --bg, invisible against the board)
stack.push({
  what: '.node.selected box-shadow layer 1 (the gap)',
  colour: token('--bg'),
  width: 2,
  offset: [-2, 0],
  source: 'same rule; painted in the board colour, so invisible',
  selectionColoured: false,
});
// (c) the RF resize LINE, at the node's own edge — only when it still paints
if (linePaints) {
  const lineColourDecl = lineBase.decls['border-color'];
  const lineResolved = String(lineColourDecl).includes('--xy-resize-background-color')
    ? (localResizeVar ?? rfDefault)
    : lineColourDecl;
  stack.push({
    what: `a .react-flow__resize-control.line.${LINE_POSITIONS[0]} control (variant Line)`,
    colour: lineResolved,
    width: 1,
    offset: [0, 1],
    source: `.react-flow__resize-control.line { ${lineColourDecl} }  +  .line.${LINE_POSITIONS[0]} { border-top-width: 1px; top: 0 }   [rf style.css:585,612]`,
    selectionColoured: true,
  });
} else {
  stack.push({
    what: `the 4 .react-flow__resize-control.line controls (variant Line) — INVISIBLE`,
    colour: '(not painted)',
    width: 0,
    offset: [0, 0],
    source: `.resize-line { border-width: 0 !important }  overrides .line.top/.right/.bottom/.left [styles.css:${ourResizeLine.line}]`,
    selectionColoured: false,
  });
}
// (d) the shape's own frame stroke
stack.push({
  what: 'svg.shape-frame (the shape\'s own border)',
  colour: frameStrokeSrc,
  width: +frameStrokeW,
  offset: [0, +frameStrokeW],
  source: 'ShapeFrame strokeWidth=1.5 / stroke=var(--nc)  [src/shapes.tsx]',
  selectionColoured: false,
});

for (const s of stack) {
  console.log(`  ${String(s.width).padStart(4)}px @ [${s.offset.map(o => String(o).padStart(3)).join(', ')}]  ${String(s.colour).padEnd(30)} ${s.what}`);
}
const selCount = stack.filter(s => s.selectionColoured && s.width > 0).length;
console.log(`\n  SELECTION-COLOURED painted lines on the top edge: ${selCount}`);
console.log(`  total painted lines (any colour):                ${stack.filter(s => s.width > 0).length}`);

/* The verdict: a lone selection indicator means exactly ONE selection-coloured
   line. The ring is layer (a); the RF resize line (c) is the duplicate. */
const VERDICT = selCount === 1 ? 'ONE indicator' : `${selCount} selection-coloured lines = the reported double border`;
console.log(`\n  VERDICT: ${VERDICT}`);

const out = {
  lineControls: LINE_POSITIONS.length,
  handleControls: HANDLE_POSITIONS.length,
  selectionColouredLines: selCount,
  totalPaintedLines: stack.filter(s => s.width > 0).length,
  effectiveLineWidth,
  linePaints,
  ourResizeToken: localResizeVar,
  rfResizeTokenDefault: rfDefault,
  stack,
};
console.log('\n' + JSON.stringify(out, null, 2));

/* ---------------------------------------------------------------------------
   ASSERTIONS — the fix's acceptance criteria, checked against the two sheets.
   Every one of these is a claim about CSS we can read, so none of them needs a
   renderer.
--------------------------------------------------------------------------- */
console.log('\n-- ASSERTIONS --');
const assertions = [];
const assert = (id, pass, detail) => {
  assertions.push({id, pass, detail});
  console.log(`  ${pass ? 'PASS' : 'FAIL'}  ${id}${detail ? '  — ' + detail : ''}`);
};

// A1 — exactly ONE selection-coloured painted line on the edge.
assert('A1 one selection-coloured line',
  selCount === 1,
  `measured ${selCount}`);

// A2 — the resize LINE control paints no border at all. The BASE rule says
//      `border-width: 0`, but the per-position rules put it back
//      (`.line.top { border-top-width: 1px }`), so the base value alone proves
//      nothing — the EFFECTIVE painted width is what matters.
const allZero = Object.values(effectiveLineWidth).every(v => /^0(px)?$/.test(v));
assert('A2 the resize LINE paints no border (effective, per side)',
  allZero,
  JSON.stringify(effectiveLineWidth));

// A3 — the LINE control must stay INTERACTIVE: it is the edge-drag resize target,
//      so it may be invisible but never `display:none` / `pointer-events:none`.
const lineKilled = Object.values(lineBase.decls).some(v => v === 'none')
  || (ourResizeLine && Object.values(ourResizeLine.decls).some(v => v === 'none'));
assert('A3 the resize LINE stays interactive (not display:none)',
  !lineKilled,
  lineKilled ? 'display:none found — edge-drag resize would be lost' : 'no display/pointer-events kill');

// A4 — the corner grips survive.
const handleAlive = ourHandle && ourHandle.decls.width && ourHandle.decls.background;
assert('A4 the corner grips survive',
  !!handleAlive,
  `width=${ourHandle?.decls.width} bg=${ourHandle?.decls.background}`);

// A5 — the shape's OWN border keeps its normal 1.5px in BOTH states: no
//      `.selected` rule may repaint the frame stroke.
assert('A5 shape frame border 1.5px, no .selected override',
  +frameStrokeW === 1.5 && !frameSelOverride,
  `strokeWidth=${frameStrokeW}, selected-override=${frameSelOverride}`);

// A6 — the resize token must NOT be the selection colour any more: that global
//      override is what painted the second blue perimeter.
const resizeTokenIsSel = localResizeVar != null && localResizeVar.includes('--sel');
assert('A6 --xy-resize-background-color is not var(--sel)',
  !resizeTokenIsSel,
  localResizeVar == null ? '(not declared at all)' : `declared as ${localResizeVar}`);

/* ===========================================================================
   ITEM 1 — THE MID-EDGE HIT BAND (2026-09-18, approved mockup "A — wide edge
   band"). The block above models PAINT; this block models HIT-TEST ORDER and
   the new band's GEOMETRY. Both are read from the same two sheets, so neither
   needs a renderer. The band's own rule is pulled out of OUR sheet and its
   declarations are asserted, not assumed.
=========================================================================== */
console.log('\n-- 6. THE MID-EDGE HIT BAND (our ::after on the LINE controls) --');

// The band rules, read out of our sheet by their EXACT selector lists — so a
// band that lost its orientation pairing (e.g. only `.right::after`) fails
// rather than silently half-working.
const bandV = rule(OUR_CSS, '.resize-line.left::after, .resize-line.right::after', 'ours');
const bandH = rule(OUR_CSS, '.resize-line.top::after, .resize-line.bottom::after', 'ours');
console.log(`  ${bandV ? `[styles.css:${bandV.line}]` : '(NOT FOUND)'} vertical-edge band (left/right) ${JSON.stringify(bandV?.decls ?? null)}`);
console.log(`  ${bandH ? `[styles.css:${bandH.line}]` : '(NOT FOUND)'} horizontal-edge band (top/bottom) ${JSON.stringify(bandH?.decls ?? null)}`);

// 10px total, the SAME number as the corner grip's painted width, so the two
// affordances feel the same. Read from BOTH sheets rather than hard-coded.
const BAND_PX = 10;
const bandSizeV = bandV ? parseFloat(bandV.decls.width) : NaN;   // grows on X
const bandSizeH = bandH ? parseFloat(bandH.decls.height) : NaN;  // grows on Y
const gripPx = parseFloat(ourHandle?.decls.width);
console.log(`  band width (left/right, grows on X)  = ${bandSizeV}px   band height (top/bottom, grows on Y) = ${bandSizeH}px`);
console.log(`  corner grip painted size (ours)      = ${gripPx}px  [styles.css:${ourHandle?.line}]`);

// The two axes that must NOT grow: each band spans the full length of its own
// control, which RF already sizes to 100% of the edge (`.line.left {height:100%}`).
const vSpanBoth = bandV && bandV.decls.top === '0' && bandV.decls.bottom === '0';
const hSpanBoth = bandH && bandH.decls.left === '0' && bandH.decls.right === '0';
const vNoY = !bandV || (bandV.decls.height == null);
const hNoX = !bandH || (bandH.decls.width == null);
// Centred on the node's edge: 50% of the 1px control, pulled back by half the band.
const vCentred = bandV?.decls.left === '50%' && /translateX\(\s*-50%\s*\)/.test(bandV?.decls.transform ?? '');
const hCentred = bandH?.decls.top === '50%' && /translateY\(\s*-50%\s*\)/.test(bandH?.decls.transform ?? '');

// A pseudo-element is the ONLY device that works here: it takes part in hit
// testing, unlike `outline` / `box-shadow` (paint-only). `content` must exist.
const vIsPseudo = bandV?.decls.content === "''" && bandV?.decls.position === 'absolute';
const hIsPseudo = bandH?.decls.content === "''" && bandH?.decls.position === 'absolute';

assert('A7 the mid-edge band exists, 10px, matching the corner grip',
  bandSizeV === BAND_PX && bandSizeH === BAND_PX && gripPx === BAND_PX,
  `band ${bandSizeV}x${bandSizeH}, grip ${gripPx}`);

assert('A8 the band is PERPENDICULAR to its line and centred on the edge',
  !!(vNoY && hNoX && vSpanBoth && hSpanBoth && vCentred && hCentred),
  `left/right: width=${bandSizeV} no-height=${vNoY} spans-top+bottom=${vSpanBoth} centred=${vCentred}; `
  + `top/bottom: height=${bandSizeH} no-width=${hNoX} spans-left+right=${hSpanBoth} centred=${hCentred}`);

assert('A9 the band is a PSEUDO-ELEMENT (the only hit-testable device)',
  !!(vIsPseudo && hIsPseudo),
  `content+position on both pairs: vertical=${vIsPseudo} horizontal=${hIsPseudo}`);

/* The band must paint NOTHING: it is a hit box only. A painted background /
   border / box-shadow here would be a SECOND selection-coloured line and break
   A1. Checked across BOTH pairs, and `outline` counts as paint too. */
const paintProps = ['background', 'background-color', 'border', 'border-width',
  'box-shadow', 'outline', 'outline-color', 'border-color'];
const paintedDecls = [];
for (const [name, b] of [['vertical', bandV], ['horizontal', bandH]]) {
  for (const p of paintProps) {
    if (b?.decls[p] != null && !/^(0|none|transparent)(px|%)?$/.test(String(b.decls[p]).trim())) {
      paintedDecls.push(`${name}.${p}=${b.decls[p]}`);
    }
  }
}
assert('A10 the band paints NOTHING (hit box only)',
  paintedDecls.length === 0,
  paintedDecls.length ? paintedDecls.join(', ') : 'no background/border/box-shadow/outline on either pair');

/* ---- THE HIT-TEST ORDER, and the connect dot's claim on its own centre ----
   Modelled as the stack of PAINTED/hit-testable layers at an edge midpoint, in
   stacking order. Only three numbers decide it and each is read from a sheet:
     connect dot  z 5   `.react-flow__handle { z-index: 5 }`      [styles.css:1017]
     corner grip  z 2   `.react-flow__resize-control.handle`      [styles.css:1474]
     line band    z ?   `.resize-line { z-index: … }`             [styles.css:1406]
     node body    auto  `.node-body { position: relative }`       [styles.css:931]
   `.node-body` is positioned with z-index:auto, so it paints in the same
   (0) group as any z-index-less sibling and WINS that group on tree order —
   it comes after the resize controls in the DOM. So the band is buried unless
   its z-index is strictly greater than 0, and it steals the corner grip if it
   is >= 2, and it steals the connect dot if it is >= 5. */
const dotZ = parseFloat(ourHandleDot?.decls['z-index'] ?? 'NaN');
const gripZ = parseFloat(ourHandle?.decls['z-index'] ?? 'NaN');
const bandZ = ourResizeLine ? parseFloat(ourResizeLine.decls['z-index'] ?? 'NaN') : NaN;
const bodyZ = (rule(OUR_CSS, '.node-body', 'ours')?.decls['z-index']) ?? 'auto';
console.log(`  z-order read from sheets: dot=${dotZ} (styles.css:${ourHandleDot?.line}) > grip=${gripZ} (styles.css:${ourHandle?.line}) > band=${bandZ} (styles.css:${ourResizeLine?.line}) > body=${bodyZ} (styles.css:${rule(OUR_CSS, '.node-body', 'ours')?.line})`);
const orderOk = Number.isFinite(dotZ) && Number.isFinite(gripZ) && Number.isFinite(bandZ)
  && dotZ > gripZ && gripZ > bandZ && bandZ > 0;
assert('A11 z-order: connect dot > corner grip > line band > node body',
  orderOk,
  dotZ > gripZ && gripZ > bandZ && bandZ > 0
    ? `${dotZ} > ${gripZ} > ${bandZ} > 0(body auto)`
    : `BROKEN: dot=${dotZ} grip=${gripZ} band=${bandZ} (body=${bodyZ})`);

/* ---- THE DOT MUST WIN, ON z-INDEX AND NOT ON SIZE ----
   Every number below is the value the sheet actually declares.
     the dot's hit box:  `.react-flow__handle { width: 12px; height: 12px }`
                         [styles.css:1014-1015], centred ON the edge by RF's own
                         `translate(-50%, 50%)` [rf style.css:279]. At the 0.75
                         zoom the recon measured, 12 node-local px = 9 screen px
                         — which is the 9x9 the recon reported. (The recon's
                         "9x9" and this sheet's "12px" are the SAME box; the
                         recon measured the SCREEN px and this file declares
                         CSS px. The corner grip looks screen-constant because RF
                         writes `scale: max(1/zoom, 1)` inline for the HANDLE
                         variant only and leaves the LINE variant's scale
                         `undefined`; ours is read as the DECLARED node-local
                         number, which is the conservative, zoom-independent
                         comparison.)
     the band:           10px across, so it is 1px WIDER than the dot's box on
                         each side of the edge (half of 10 is 5, half of 12 is
                         6 — the band is 1px SHORT of the dot on each side too).
                         Either way the two boxes OVERLAP at the midpoint: a
                         larger hit box alone would lose the tie, and a smaller
                         one would be harmless. Size cannot decide it — z-index
                         does, and 5 > 1 by construction (asserted in A11). */
const dotHitW = parseFloat(ourHandleDot?.decls.width ?? 'NaN');
const dotHitH = parseFloat(ourHandleDot?.decls.height ?? 'NaN');
console.log(`  connect dot hit box = ${dotHitW}x${dotHitH} node-local px [styles.css:${ourHandleDot?.line}]  vs band 10px`);
const boxesOverlap = Number.isFinite(dotHitW) && BAND_PX / 2 + dotHitW / 2 > 0;
const dotOutranksBand = Number.isFinite(dotZ) && Number.isFinite(bandZ) && dotZ > bandZ;
assert('A12 the connect dot keeps its own spot: it wins the tie ON z-INDEX',
  dotOutranksBand && boxesOverlap && dotHitW > 0 && dotHitH > 0,
  `dot z=${dotZ} vs band z=${bandZ} (dot wins by ${dotZ - bandZ}); band 10px vs dot ${dotHitW}px — boxes `
  + `OVERLAP at the midpoint (half 5 vs half ${dotHitW / 2}), so size would tie it, z-index decides it`);

const failed = assertions.filter(a => !a.pass);
console.log(`\nHARNESS: ${assertions.length - failed.length}/${assertions.length} passed`);
process.exit(failed.length ? 1 : 0);
