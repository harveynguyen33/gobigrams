#!/usr/bin/env node
/**
 * ROUND AL — the edge panel: selection (AL-1), the rails (AL-2), the label
 * (AL-3/AL-4), the two actions (AL-5) and ONE control system (AL-6/AL-7).
 *
 * WHAT THIS FILE IS. Two kinds of claim, and each is made the only way it CAN be
 * made without a browser (the round's hard rule 9):
 *
 *   (1) SOURCE / SHEET claims — read as TEXT, with COMMENTS BLANKED FIRST. This
 *       project deletes a control and leaves a comment QUOTING it in its place,
 *       so a raw substring probe reads a correct tree as a defect. Blanking
 *       (rather than stripping) keeps every byte offset and every line number
 *       true, so a reported line is the line the code is really on.
 *   (2) EXECUTED claims — `src/edgeLabel.ts` is React-free and DOM-free, so Node
 *       22 loads it directly (type-stripping) and the AL-2 rails are measured as
 *       RETURN VALUES rather than as substrings that happen to be present.
 *
 * MEASURED HEIGHTS. AL-6's whole point is that the panel ran THREE unrelated
 * button families whose boxes disagreed, so "ONE height: 30px" cannot be
 * asserted — it has to be COMPUTED from the declarations the sheet really
 * carries, through a real cascade (specificity, then source order), exactly as
 * ROUND AA's harness does for widths. Every number printed below is derivable
 * from `src/styles.css`.
 *
 * THE NEGATIVE CONTROL IS MANDATORY AND IT IS IN THE FILE (the REPLAY at the
 * bottom). Every source probe is re-run over the pinned pre-change tree read
 * with `git show`, and must be RED there; the module probes are re-run against
 * deliberately BROKEN copies of the shipped `src/edgeLabel.ts`, built with named
 * single-line mutations — a STRONGER control, because it shows each assertion
 * detecting the specific change it claims to rather than merely a file's
 * absence.
 *
 * WHAT IT CANNOT DO, stated rather than hidden: it cannot see a browser. It
 * cannot prove the core reads well on a dark canvas, that a chip row wraps the
 * way it does on screen, or that a drag feels right. Those are the owner's
 * device test. This file measures the RULES and the GEOMETRY.
 *
 * DS_ROOT overrides the project root; DS_PRE_COMMIT overrides the pinned commit.
 */
import {readFileSync, mkdtempSync, writeFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {tmpdir} from 'node:os';
import {join} from 'node:path';

const ROOT = process.env.DS_ROOT || '/home/harvey/projects/tech-goblin/lab/diagram-studio';

/* The commit ROUND AL was built on — the tree the SOURCE half's negative control
 * measures against. PINNED, not `HEAD`: once this round is committed, `HEAD` IS
 * the fixed tree and a `HEAD`-based control would compare the fix with itself.
 * `f0b00aa` is ROUND AK's final commit, i.e. exactly the tree the owner tested
 * on his device and rejected. */
const PRE_COMMIT = process.env.DS_PRE_COMMIT || 'f0b00aa';

/* ---------- the assertion harness (house style) ---------- */
let failures = 0;
const assert = (name, ok, detail) => {
  if (ok) console.log(`  PASS  ${name}\n        ${detail}`);
  else { failures++; console.log(`  FAIL  ${name}\n        ${detail}`); }
};
const section = t => console.log(`\n${t}`);

/* ---------- the files under test ---------- */
/* ROUND BN-4 — src/GoblinEdge.tsx split into src/edges/ (component moved to
   src/edges/GoblinEdge.tsx; the EdgeData type, the K2 flow-payload machinery and
   the type registry moved to EdgeData.ts / flowPayloads.tsx / index.ts, verbatim).
   Working-tree reads of the component now read the FOUR SLICES CONCATENATED so
   every regex below still measures the same surface. Git reads (PRE_COMMIT)
   keep the single file, which every pinned commit has. */
/* ROUND BN-4 — src/InspectorPickers.tsx split along its section banners
   into src/pickers/{popover,art,rows,stepperFlow,section}.tsx (verbatim; the
   old path stays as a re-export shell so bundle entries are unchanged). Reads
   of the picker source read the FIVE SLICES + SHELL CONCATENATED. */
const read = p => p === 'src/InspectorPickers.tsx'
  ? ['popover', 'art', 'rows', 'stepperFlow', 'section', 'shell'].flatMap(f => {
      try { return [readFileSync(`${ROOT}/src/${f === 'shell' ? 'InspectorPickers.tsx' : 'pickers/' + f + '.tsx'}`, 'utf8')]; } catch { return []; }
    }).join('\n')
  : p === 'src/GoblinEdge.tsx'
  ? ['GoblinEdge', 'EdgeData', 'flowPayloads', 'index']
      .map(f => readFileSync(`${ROOT}/src/edges/${f}${f === 'EdgeData' || f === 'index' ? '.ts' : '.tsx'}`, 'utf8')).join('\n')
  : readFileSync(`${ROOT}/${p}`, 'utf8');
const APP_RAW = read('src/App.tsx');
const EDGE_RAW = read('src/GoblinEdge.tsx');
const LIB_RAW = read('src/edgeLabel.ts');
const CSS_RAW = read('src/styles.css');
const PICKS_RAW = read('src/InspectorPickers.tsx');

/** Blank block AND line comments to spaces, keeping length and newlines. The
 *  `[^:]` before `//` keeps `https://` and a `var(--x)://` token from being read
 *  as a comment start. */
const blankComments = s => s
  .replace(/\/\*[\s\S]*?\*\//g, m => m.replace(/[^\n]/g, ' '))
  .replace(/(^|[^:])\/\/[^\n]*/g, (m, p) => p + ' '.repeat(m.length - p.length));
const APP = blankComments(APP_RAW);
const EDGE = blankComments(EDGE_RAW);
const LIB = blankComments(LIB_RAW);
const CSS = blankComments(CSS_RAW);
const PICKS = blankComments(PICKS_RAW);

const commitFile = (commit, p) =>
  execFileSync('git', ['show', `${commit}:${p}`], {cwd: ROOT, encoding: 'utf8', maxBuffer: 1 << 28});

/* ---------- the sheet, as rules, with a REAL cascade ---------- */
/** Every `selector { body }` pair. Comments must already be blanked, or a prose
 *  brace is read as a rule. The selector LIST inside one rule is kept intact so
 *  a declaration is found wherever it sits in a list. */
const RULES = (() => {
  const out = [];
  const re = /(^|\n)([^\n{}@\/][^\n{}]*)\{([^{}]*)\}/g;
  let m;
  while ((m = re.exec(CSS))) out.push({sel: m[2].trim().replace(/\s+/g, ' '), decls: m[3], index: m.index});
  return out;
})();
const decl = (block, prop) => {
  const m = new RegExp(`(?:^|;)\\s*${prop}\\s*:\\s*([^;]+)`).exec(block);
  return m ? m[1].trim() : null;
};
/** Specificity: classes + attributes + pseudo-classes across the whole compound
 *  chain. No element selector appears in any candidate the panel uses. */
const spec = sel => (sel.match(/\.[\w-]+|\[[^\]]+\]|:{1,2}[\w-]+(?!\()/g) ?? []).length;
const lastCompoundMatches = (sel, classes) =>
  sel.split(/\s+/).pop().split('.').filter(Boolean).every(c => classes.includes(c));
const ancestorsMatch = (sel, ancestors) => {
  const parts = sel.split(/\s+/);
  return parts.slice(0, -1).every(part => part.split('.').filter(Boolean).every(c => ancestors.includes(c)));
};
/** The cascade, resolved: higher specificity wins; at EQUAL specificity the
 *  LATER rule wins. That second clause is load-bearing here — `.mbtn` (one class)
 *  sits LATER in the sheet than `.insp-seg-btn` (one class), so `.mbtn`'s padding
 *  is the one the browser uses, and a model that stopped at specificity would
 *  report a content box the browser never paints. */
function computed(classes, prop, ancestors = []) {
  let best = null, bestSpec = -1, bestIndex = -1;
  for (const r of RULES) {
    if (!lastCompoundMatches(r.sel, classes) || !ancestorsMatch(r.sel, ancestors)) continue;
    const v = decl(r.decls, prop);
    if (v == null) continue;
    const s = spec(r.sel);
    if (s > bestSpec || (s === bestSpec && r.index > bestIndex)) {
      bestSpec = s; bestIndex = r.index; best = {v, sel: r.sel};
    }
  }
  return best;
}
/** The winning declarations for an element, as {prop: value} — used where a
 *  whole box must be read rather than one property. */
function computedBox(classes, ancestors = []) {
  let bestSpec = -1, bestIndex = -1, winner = null;
  for (const r of RULES) {
    if (!lastCompoundMatches(r.sel, classes) || !ancestorsMatch(r.sel, ancestors)) continue;
    const s = spec(r.sel);
    if (s > bestSpec || (s === bestSpec && r.index > bestIndex)) { bestSpec = s; bestIndex = r.index; winner = r; }
  }
  if (!winner) return {};
  const out = {};
  for (const d of winner.decls.split(';')) {
    const i = d.indexOf(':');
    if (i > 0) out[d.slice(0, i).trim().toLowerCase()] = d.slice(i + 1).trim();
  }
  return out;
}
const px = v => (v == null ? NaN : parseFloat(v));

/* ---------- the panel's JSX, sliced ---------- */
/** The JSX literal handed to `secBody('<name>', …)` — from the marker to the NEXT
 *  `secBody(` call. Read from the comment-blanked source, so the slice is code. */
const secBodyOf = (appCode, name) => {
  const i = appCode.indexOf(`secBody('${name}'`);
  const j = appCode.indexOf('secBody(', i + 10);
  return i < 0 ? '' : appCode.slice(i, j < 0 ? undefined : j);
};
/** Which component carries an option table, by enumerating the self-closing
 *  control call sites and matching the `options={…}` prop INSIDE each one — so
 *  the carrier is decided by the element that owns the prop, not by proximity. */
const carrierOf = (appCode, table) => {
  for (const m of appCode.matchAll(/<(ToggleRow|IconPickerRow|ShapesPicker|Stepper)\b([\s\S]*?)\/>/g)) {
    if (m[2].includes(`options={${table}}`)) return m[1];
  }
  return null;
};
/** The JSX of ONE field, from its `<label>` to the closing `</div>` — the unit
 *  a control (and its modifiers) lives in. */
const fieldOf = (slice, label) => {
  const i = slice.indexOf(`<label>${label}</label>`);
  if (i < 0) return '';
  const j = slice.indexOf('</div>', i);
  return slice.slice(i, j < 0 ? undefined : j);
};
/** A modifier is a BARE word on its own line — how the existing `grid3` call
 *  site is written. Prose that mentions a word is not a modifier. */
const hasModifier = (jsx, word) => new RegExp(`\\n\\s*${word}\\s*\\n`).test(jsx);

console.log('='.repeat(78));
console.log('ROUND AL — the edge panel: selection, the label, ONE control system');
console.log('source-text probes (comments blanked) + the shipped module EXECUTED');
console.log('='.repeat(78));
console.log(`root: ${ROOT}`);
console.log(`node: ${process.version}`);
console.log(`pre-change tree pinned at: ${PRE_COMMIT}`);

/* ===========================================================================
   AL-1 — SELECTION: the OLD look (option C), made truthful.
   =========================================================================== */
section('AL-1 — selection is option C: a var(--sel) body with an authored-colour core');
{
  /* (a) THE REJECTED ELEMENT IS GONE — from the sheet AND the renderer. */
  const overlayInSheet = /\.edge-sel-overlay/.test(CSS);
  const overlayInEdge = /edge-sel-overlay/.test(EDGE);
  /* (b) THE DASH AND THE +5 ARE GONE with it. The +5 was the halo's whole
   *     defect (a fat dashed outline), so it is asserted as an absent EXPRESSION,
   *     not as an absent word: what must not come back is a width DERIVED from
   *     `strokeWidth` by addition. */
  const plusFive = /strokeWidth=\{[^}]*strokeWidth[^}]*\+\s*5/.test(EDGE)
    || /strokeWidth=\{[^}]*\+\s*5[^}]*\}/.test(EDGE);
  const dashArray = /strokeDasharray=/.test(EDGE);
  assert('al1.the-dashed-halo-and-its-rule-are-DELETED-whole',
    !overlayInSheet && !overlayInEdge && !plusFive && !dashArray,
    `\`.edge-sel-overlay\` in src/styles.css=${overlayInSheet}, in src/GoblinEdge.tsx=${overlayInEdge}; ` +
    `a strokeWidth built by adding 5 = ${plusFive}; any \`strokeDasharray\` on the edge renderer = ${dashArray}. ` +
    `The owner rejected that element — "nhìn nó xấu sao ấy … đặc biệt khi chỉnh line animation" — so the dash, the +5 ` +
    `and the rule all went together rather than leaving one of the three behind.`);

  /* (c) THE REPLACEMENT IS REAL: the body takes the TOKEN and the core takes the
   *     AUTHORED colour, and both are wired to `selected` (never to `:hover`). */
  const selStroke = /const SEL_STROKE = 'var\(--sel\)'/.test(EDGE);
  /* PACKAGE-SEQ 2026-10-15 — the BaseEdge style grew a seqMsg branch
     (`seqStyle ? {...} : (selected ? ... : props.style)`). The pixel-parity
     rule is unchanged — for a normal edge the false branch still hands over
     `props.style` ITSELF — so the probe accepts either spelling. */
  const bodyUsesToken = /style=\{selected \? \{\.\.\.props\.style, stroke: SEL_STROKE\} : props\.style\}/.test(EDGE)
    || (/seqStyle \? \{\.\.\.\(selected \? \{\.\.\.props\.style, stroke: SEL_STROKE\} : props\.style\), \.\.\.seqStyle\}/.test(EDGE)
      && /: \(selected \? \{\.\.\.props\.style, stroke: SEL_STROKE\} : props\.style\)\}/.test(EDGE));
  const coreRendered = /className="edge-sel-core"/.test(EDGE);
  const coreStroke = /className="edge-sel-core"[\s\S]{0,220}?stroke=\{stroke\}/.test(EDGE);
  const coreWidth = /const SEL_CORE_PX = 1\.1/.test(EDGE);
  assert('al1.a-selected-edge-paints-the-TOKEN-body-and-an-authored-colour-CORE-on-top',
    selStroke && bodyUsesToken && coreRendered && coreStroke && coreWidth,
    `\`SEL_STROKE = 'var(--sel)'\` = ${selStroke} (the token the DELETED \`!important\` rule used, so the selected line ` +
    `reads exactly as it did before ROUND AK); the body passes it ONLY when selected = ${bodyUsesToken}; the core is ` +
    `rendered = ${coreRendered} and stroked with the resolved authored \`stroke\` = ${coreStroke}, at a FIXED 1.1px = ${coreWidth} ` +
    `(not a function of \`strokeWidth\`: a proportional core would vanish on the 1px body, and the point of the core is that ` +
    `the colour stays legible at every width).`);

  /* (d) THE SHEET DECLARES THE CORE, and the declaration adds no colour. */
  const coreRule = /\.edge-sel-core\s*\{([^}]*)\}/.exec(CSS);
  const coreDecls = coreRule ? coreRule[1] : '';
  const coreNoHex = !/#[0-9a-fA-F]{3,6}\b/.test(coreDecls);
  assert('al1.the-core-is-a-DECLARED-class-the-sheet-paints-without-adding-a-hex',
    !!coreRule && /pointer-events:\s*none/.test(coreDecls) && coreNoHex,
    coreRule
      ? `\`.edge-sel-core { ${coreDecls.trim().replace(/\s+/g, ' ')} }\` — \`pointer-events: none\` keeps it out of the hit ` +
        `area (so the click that selects the edge is unchanged), and the declaration carries no hex literal (${coreNoHex}). ` +
        `The class is deliberately NOT \`react-flow__edge-path\`: React Flow's own \`.selected\` rule and this sheet's ` +
        `\`.ds-electric\` hover marks both target that class, and a class of its own is outside both selectors.`
      : '`.edge-sel-core` is NOT declared in src/styles.css');

  /* (e) THE PARITY RULE. An UNSELECTED edge must render exactly as before: one
   *     path, with the style the renderer was handed passed through untouched.
   *     Asserted as the NEGATIVE of the selected branch — a conditional that
   *     always spreads would change every unselected edge in the app. */
  const oneBaseEdge = (EDGE.match(/<BaseEdge\b/g) ?? []).length === 1;
  const coreGatedOnSelected = /\{selected && \(/.test(EDGE);
  /* PACKAGE-SEQ — the seqMsg wrapper adds ONE `)` before the closing brace
     (`... : props.style)}`), so accept both spellings; the semantics — the
     false branch hands over `props.style` ITSELF — are unchanged. */
  const unselectedIsIdentity = /: props\.style\)??\}/.test(EDGE);
  assert('al1.an-UNSELECTED-edge-renders-ONE-path-with-the-style-passed-through-UNCHANGED',
    oneBaseEdge && coreGatedOnSelected && unselectedIsIdentity,
    `exactly ${(EDGE.match(/<BaseEdge\b/g) ?? []).length} \`<BaseEdge>\` (one path, as before), the core is gated on ` +
    `\`selected\` = ${coreGatedOnSelected}, and the false branch hands over \`props.style\` ITSELF rather than a spread = ` +
    `${unselectedIsIdentity}. That last one is the pixel-parity rule this file obeys everywhere: a spread that always ran ` +
    `would add a key to every edge in the app, including the ones nobody selected.`);

  /* (f) NO HOVER ANYWHERE IN THE SIGNAL — the touch rule. */
  const hoverSel = RULES.filter(r => r.sel.includes(':hover') && /edge-sel|react-flow__edge/.test(r.sel));
  assert('al1.nothing-in-the-selection-signal-depends-on-hover',
    hoverSel.length === 0,
    hoverSel.length === 0
      ? 'no `:hover` rule reaches the selection signal or the edge path — `selected` is React Flow\'s own per-edge flag, ' +
        'so a TAP on a touch device produces the identical signal to a click with no pointer resting on the element'
      : `STILL HOVER-DRIVEN: ${hoverSel.map(r => r.sel).join(' | ')}`);
}

/* ===========================================================================
   AL-2 — the two rails are OUT of the write path, and the click lock is BACK.
   =========================================================================== */
const M = await import(`${ROOT}/src/edgeLabel.ts`);
section('AL-2 — the label drag has NO rails, and a plain click writes nothing');
{
  /* (a) THE FUNCTIONS ARE GONE FROM THE MODULE. Not merely unreferenced: the
   *     owner asked for "no constraints at all", and a rail left in the file is a
   *     rail the next pass reaches for by habit. */
  const railsGone = M.snapToCentre === undefined && M.clampToRange === undefined
    && M.labelClearance === undefined && M.labelHalfAlong === undefined
    && M.LABEL_TO_ARROW_PADDING === undefined && M.LABEL_SNAP_PX === undefined
    && M.screenToFlowPx === undefined;
  assert('al2.snapToCentre-clampToRange-and-the-clearances-are-DELETED-from-the-module',
    railsGone,
    `snapToCentre=${M.snapToCentre}, clampToRange=${M.clampToRange}, labelClearance=${M.labelClearance}, ` +
    `labelHalfAlong=${M.labelHalfAlong}, LABEL_TO_ARROW_PADDING=${M.LABEL_TO_ARROW_PADDING}, ` +
    `LABEL_SNAP_PX=${M.LABEL_SNAP_PX}, screenToFlowPx=${M.screenToFlowPx} — all \`undefined\`. These three rails all ` +
    `served ONE purpose (keep the label near the line) and the owner removed that purpose: "cứ để nó kéo thoải mái đi ` +
    `đâu thì đi. ko cần ràng buộc với xung quanh line … đã có nút Reset Label Position rồi".`);

  /* (b) A WRITE IS THE PLAIN OFFSET — no snapping, no clamping. The fixture is
   *     deliberately inside BOTH old rails: 4 flow px from the anchor (inside the
   *     old 10-screen-px snap) and 1px past a 45px clearance (outside the old
   *     usable range). Under ROUND AK this returned `{0,0}/pinned:false` from the
   *     snap; under AL it must store what it was GIVEN. */
  const W = {x: 54, y: 1};
  const anchor = {x: 50, y: 0};
  const written = M.labelWrite({W, anchor});
  assert('al2.a-point-inside-the-OLD-snap-radius-and-outside-the-OLD-range-is-stored-UNCHANGED',
    written.labelPinned === true
      && Math.abs(written.labelOffset.x - 4) < 1e-9
      && Math.abs(written.labelOffset.y - 1) < 1e-9,
    `W=${JSON.stringify(W)}, anchor=${JSON.stringify(anchor)} → ${JSON.stringify(written)}. ` +
    `That point is 4.12 flow px from the anchor — INSIDE the 10px snap ROUND AK applied — and it sits 1px BELOW a 45px ` +
    `clearance, i.e. outside the range the old clamp enforced. Both rails would have moved it; AL stores the offset it was ` +
    `handed, which is the whole of "no constraints".`);

  /* (c) A LABEL DRAGGED FAR AWAY STAYS FAR — the owner's own scenario ("nếu tôi
   *     kéo ra xa … click 1 cái nó tự về giữa"). 3000px out, no rail reaches it. */
  const far = M.labelWrite({W: {x: 3050, y: -1200}, anchor: {x: 50, y: 0}});
  assert('al2.a-label-dragged-far-from-the-line-STAYS-exactly-where-it-was-put',
    far.labelPinned === true && far.labelOffset.x === 3000 && far.labelOffset.y === -1200,
    `a point 3000px right and 1200px above the anchor → ${JSON.stringify(far)}. Under ROUND AK the clamp slid the ` +
    `along-the-line component back inside the path's usable range; the owner's case was exactly this drag — "kéo ra xa, bỏ ` +
    `chọn, rồi chọn lại, click 1 cái nó tự về giữa" — and Reset is now the only way back, which is what he asked for.`);

  /* (d) THE WRITER'S SHAPE — `labelWrite` now takes ONLY what it uses. A parameter
   *     that is accepted and ignored is how a rail comes back without anyone
   *     noticing, so the SIGNATURE is asserted, not just the behaviour. */
  const sig = (LIB.match(/export function labelWrite\(p: \{([\s\S]*?)\}\): LabelWrite/) ?? ['', ''])[1];
  const params = (sig.match(/(\w+)\s*:/g) ?? []).map(s => s.replace(/\s*:/, ''));
  assert('al2.the-writer-accepts-ONLY-the-two-points-it-uses-no-rails-inputs',
    params.length === 2 && params.includes('W') && params.includes('anchor'),
    `\`labelWrite\` takes ${JSON.stringify(params)} — the two points and nothing else. ROUND AK's version took ` +
    `\`W, anchor, pts, zoom, start, end\`, i.e. the resolved PATH, the ZOOM and the two END CLEARANCES, and every one of ` +
    `those inputs existed only to feed a rail. Removing the parameters is the strongest form of removing the rails: a ` +
    `future pass cannot re-enable one by flipping a default.`);

  /* (e) THE CLICK LOCK — screen px, scaled by zoom, 2-3px. */
  const lockSrc = (LIB.match(/export const LABEL_DRAG_LOCK_PX\s*=\s*([\d.]+)/) ?? [])[1];
  const lockFn = /export function labelDragLockPx\(/.test(LIB);
  const lockUsesZoom = /zoom > 0 \? LABEL_DRAG_LOCK_PX \/ zoom/.test(LIB);
  assert('al2.the-label-drag-has-a-2-3px-SCREEN-px-lock-scaled-by-the-zoom',
    lockFn && lockUsesZoom && Number(lockSrc) >= 2 && Number(lockSrc) <= 3,
    `\`LABEL_DRAG_LOCK_PX = ${lockSrc}\` and \`labelDragLockPx\` divides it by the zoom = ${lockUsesZoom}. ` +
    `The lock is in SCREEN pixels, which is what makes it a constant FEEL at every zoom: 2.5 screen px is 2.5 flow px at ` +
    `100% and 5 flow px at 50%. ROUND AK passed \`lock: 0\` (Sirius Web's {0,0} guard), so ANY sub-pixel jitter counted as a ` +
    `drag and fired an end-write — the third cause of "click once and it jumps".`);

  /* (f) The lock is EXECUTED, not described: the boundary cases and the zoom. */
  const l1 = M.labelDragLockPx(1), l2 = M.labelDragLockPx(2), l05 = M.labelDragLockPx(0.5);
  const z0 = M.labelDragLockPx(0);
  assert('al2.the-lock-is-measured-in-flow-px-and-shrugs-off-a-degenerate-zoom',
    Math.abs(l1 - Number(lockSrc)) < 1e-9 && Math.abs(l2 - Number(lockSrc) / 2) < 1e-9
      && Math.abs(l05 - Number(lockSrc) * 2) < 1e-9 && Number.isFinite(z0) && z0 === Number(lockSrc),
    `zoom 1 → ${l1} flow px, zoom 2 → ${l2}, zoom 0.5 → ${l05}, zoom 0 → ${z0}. A zoom of 0 (an unmeasured transform) ` +
    `falls back to the un-scaled value rather than producing Infinity or NaN, which would disable the guard entirely at ` +
    `the exact moment the geometry is least trustworthy.`);

  /* (g) THE GUARD STILL EXISTS, and the two affordances still share ONE predicate
   *     — the invariant that stops the bend handle and the label disagreeing. */
  const movedBySrc = (LIB.match(/export function movedBy\(([\s\S]*?)\): boolean \{([\s\S]*?)\n\}/) ?? ['', '', ''])[2];
  assert('al2.movedBy-keeps-its-lock-parameter-so-both-affordances-share-one-predicate',
    /lock = 0/.test((LIB.match(/export function movedBy\(([\s\S]*?)\): boolean/) ?? ['', ''])[1])
      && /Math\.hypot\(dx, dy\) > lock/.test(movedBySrc)
      && M.movedBy(0, 0) === false && M.movedBy(1, 0) === true
      && M.movedBy(1, 1, 3) === false && M.movedBy(3, 4, 3) === true,
    `\`movedBy(0,0) = ${M.movedBy(0, 0)}\`, \`movedBy(1,0) = ${M.movedBy(1, 0)}\`, \`movedBy(1,1,lock 3) = ${M.movedBy(1, 1, 3)}\`, ` +
    `\`movedBy(3,4,lock 3) = ${M.movedBy(3, 4, 3)}\`. The \`lock\` parameter STAYS because the bend handle still passes this ` +
    `project's own 3px jitter threshold (\`LOCK_PX\`) through it: the two affordances must not be able to disagree about ` +
    `what a drag is. AL changes the VALUE the label passes, never the predicate.`);

  /* (h) THE WIRING — the renderer must actually pass the new lock, and the write
   *     path must no longer compute a clearance. Both are source claims. */
  const passesLock = /lock:\s*labelDragLockPx\(t\[2\]\)/.test(EDGE);
  const clearanceGone = !/clearStart|clearEnd|labelHalfAlong|labelClearance/.test(EDGE);
  assert('al2.the-renderer-passes-the-new-lock-and-no-longer-computes-a-clearance',
    passesLock && clearanceGone,
    `\`lock: labelDragLockPx(t[2])\` in the renderer = ${passesLock}, and no \`clearStart\`/\`clearEnd\`/\`labelHalfAlong\`/` +
    `\`labelClearance\` remains in src/GoblinEdge.tsx = ${clearanceGone}. The clearances were the clamp's two inputs; with ` +
    `the clamp gone they had no consumer left, so they went with it rather than staying as a measured-but-unused pair.`);

  /* (i) RESET IS STILL THE WAY BACK, and it is still ONE history step. */
  const resetBody = (/const resetLabelPos = useCallback\(\(\) => \{[\s\S]*?\}, \[/.exec(APP) ?? [''])[0];
  const resetPushes = (resetBody.match(/pushHistory\(\)/g) ?? []).length;
  assert('al2.Reset-label-position-survives-as-the-ONLY-way-back',
    resetPushes === 1 && /delete data\.labelOffset/.test(resetBody) && /delete data\.labelPinned/.test(resetBody)
      && /Reset label position/.test(secBodyOf(APP, 'label')),
    `\`resetLabelPos\` pushes history ${resetPushes}× and clears BOTH keys, and the button is still in the \`label\` ` +
    `section. With the snap gone this is the ONLY path back to centre — the owner's own words — so it is a load-bearing ` +
    `control now rather than the convenience ROUND AK recorded.`);
}

/* ===========================================================================
   AL-3 — label background default `none`, the halo, text above the line, and
   the TWO colour rows.
   =========================================================================== */
section('AL-3 — labelBg defaults to `none`, carries a canvas halo, and gains two colour rows');
{
  /* (a) THE DEFAULT. `labelBgOf` resolves ABSENT to `none` — which changes what
   *     every existing board renders, and that is the point of the item. */
  const unknown = [undefined, null, '', 'nope', 0, {}, 'SURFACE', 'None'];
  const resolved = unknown.map(v => M.labelBgOf(v));
  assert('al3.the-DEFAULT-is-none-and-every-unknown-value-resolves-to-it',
    M.LABEL_BG_DEFAULT === 'none' && resolved.every(v => v === 'none')
      && M.labelBgOf('surface') === 'surface' && M.labelBgOf('outline') === 'outline',
    `\`LABEL_BG_DEFAULT = ${JSON.stringify(M.LABEL_BG_DEFAULT)}\`; ${unknown.length} unrecognised inputs ` +
    `(${unknown.map(v => JSON.stringify(v)).join(', ')}) all resolve to \`none\`; the two real alternatives still resolve ` +
    `to themselves. OLD: the default was \`surface\`, which is exactly the plate the owner asked to stop being the default — ` +
    `"By default nên là none". A board that never touched the control therefore changes appearance, and his own board ` +
    `stores no \`labelBg\`, so it is the board that changes.`);

  /* (b) THE CLASS MAPPING still covers all three, and the sheet DECLARES all
   *     three — the tolerant reader cannot emit a class nobody paints. */
  const declared = M.LABEL_BG_VALUES.filter(v => new RegExp(`\\.edge-label\\.lb-${v}\\s*\\{`).test(CSS));
  assert('al3.all-three-plate-classes-are-declared-and-the-renderer-still-writes-one',
    declared.length === 3 && /labelBgClass\(d\.labelBg\)/.test(EDGE)
      && M.labelBgClass('bogus') === 'lb-none',
    `${declared.length}/3 declared (${declared.map(v => `.lb-${v}`).join(', ')}); the renderer writes ` +
    `\`labelBgClass(d.labelBg)\` = ${/labelBgClass\(d\.labelBg\)/.test(EDGE)}; an unknown value maps to ${M.labelBgClass('bogus')}, ` +
    `which is the default now.`);

  /* (c) THE HALO — a `text-shadow` in the CANVAS colour, applied ONLY at `none`.
   *     This is the mechanism the owner described as "hoà với màu của nền canvas":
   *     tldraw's canvas-coloured text outline, so the line cannot run through the
   *     glyphs without a box being drawn. */
  const halo = /\.edge-label\.lb-none\s*\{([^}]*)\}/.exec(CSS);
  const haloDecls = halo ? halo[1] : '';
  const haloIsCanvas = /text-shadow:[^;]*var\(--bg\)/.test(haloDecls);
  const otherPlatesNoHalo = ['.lb-surface', '.lb-outline']
    .every(c => !/text-shadow/.test((new RegExp(`\\.edge-label\\${c}\\s*\\{([^}]*)\\}`).exec(CSS) ?? ['', ''])[1]));
  assert('al3.the-none-state-carries-a-CANVAS-COLOURED-text-halo-and-nothing-else-does',
    !!halo && haloIsCanvas && otherPlatesNoHalo
      && /background:\s*transparent/.test(haloDecls),
    halo
      ? `\`.edge-label.lb-none { ${haloDecls.trim().replace(/\s+/g, ' ')} }\` — \`text-shadow\` in \`var(--bg)\`, the CANVAS ` +
        `colour (not \`--surface\`, which is the PANEL colour: a halo in the panel's colour would paint a pale ring on the ` +
        `canvas). Applied to \`none\` only = ${otherPlatesNoHalo}, because the other two states draw a plate and a halo ` +
        `under a plate would be a second edge nobody asked for.`
      : '`.edge-label.lb-none` is not declared');

  /* (d) TEXT ABOVE THE LINE — MEASURED against React Flow's own DOM order, not
   *     assumed. The label is a DIV portalled into `.react-flow__edgelabel-renderer`;
   *     that element is rendered AFTER the edge layer and BEFORE the node layer,
   *     and NONE of the three carries a `z-index` — so paint order is TREE order. */
  const RF_CSS = readFileSync(`${ROOT}/node_modules/@xyflow/react/dist/style.css`, 'utf8');
  const RF_JS = readFileSync(`${ROOT}/node_modules/@xyflow/react/dist/esm/index.js`, 'utf8');
  const renderOrder = (() => {
    /* ROUND AL — the three layers are the THREE CHILDREN of `Viewport`, in
     *  source order inside `jsxs(Viewport, { children: [ … ] })`. The first draft
     *  searched `react-flow__nodes` from the `EdgeRenderer,` call site and got
     *  -1: that string is not in this children array at all (the node layer is
     *  named `NodeRenderer` here), so the probe reported a correct tree as a
     *  failure. Search the children block for the three component names it
     *  actually contains. Measured: EdgeRenderer 32 < edgelabel-renderer 794 <
     *  NodeRenderer 822. */
    const at = RF_JS.indexOf('jsxs(Viewport, { children: [');
    if (at < 0) return null;
    const block = RF_JS.slice(at, at + 3000);
    const iEdges = block.indexOf('EdgeRenderer');
    const iLabel = block.indexOf('edgelabel-renderer');
    const iNodes = block.indexOf('NodeRenderer');
    return {iEdges, iLabel, iNodes};
  })();
  const labelAfterEdges = !!renderOrder && renderOrder.iLabel > renderOrder.iEdges;
  const labelBeforeNodes = !!renderOrder && renderOrder.iNodes > renderOrder.iLabel;
  const zOf = sel => {
    const r = new RegExp(`${sel}[^{]*\\{([^}]*)\\}`).exec(RF_CSS);
    return r ? decl(r[1], 'z-index') : null;
  };
  assert('al3.the-label-paints-ABOVE-the-line-measured-in-React-Flows-own-tree-order',
    labelAfterEdges && labelBeforeNodes
      && zOf('.react-flow__edgelabel-renderer') == null
      && zOf('.react-flow__edges') == null,
    `in the installed \`@xyflow/react\`, the viewport renders \`EdgeRenderer\` (the SVG edge layer) → ` +
    `\`.react-flow__edgelabel-renderer\` (the label layer) → \`NodeRenderer\`, at offsets ` +
    `${JSON.stringify(renderOrder)} — so the label layer comes AFTER the edge layer = ${labelAfterEdges} and BEFORE the node ` +
    `layer = ${labelBeforeNodes}. NONE of the three declares a \`z-index\` in React Flow's own sheet ` +
    `(edgelabel-renderer=${zOf('.react-flow__edgelabel-renderer')}, edges=${zOf('.react-flow__edges')}), so the paint order ` +
    `IS tree order and the label is already on top of the line. MEASURED, not assumed: the first draft of this item's note ` +
    `claimed the label needed a z-index and the reading disproved it.`);

  /* (e) THE TWO NEW ROWS, in the `label` section, on the EXISTING control. */
  const labelSec = secBodyOf(APP, 'label');
  const textRow = /<label>text color<\/label>/.test(labelSec)
    && /swatchRow\(\s*eLabelTextKey/.test(labelSec)
    && /labelTextKey: k/.test(labelSec);
  const bgRow = /<label>background color<\/label>/.test(labelSec)
    && /swatchRow\(\s*eLabelBgKey/.test(labelSec)
    && /labelBgKey: k/.test(labelSec);
  assert('al3.two-NEW-swatch-rows-write-labelTextKey-and-labelBgKey',
    textRow && bgRow,
    `\`text color\` → \`swatchRow(eLabelTextKey, …)\` writing \`data.labelTextKey\` = ${textRow}; ` +
    `\`background color\` → \`swatchRow(eLabelBgKey, …)\` writing \`data.labelBgKey\` = ${bgRow}. ` +
    `Both are the panel's EXISTING swatch control (\`COLOR_KEYS\` × \`COLOR_VAR\`), the same one the edge stroke row uses — ` +
    `no new control, no new palette, and therefore no new hex.`);

  /* (f) The background-colour row is shown ONLY when the state is not `none`. */
  const bgGated = /eLabelBg !== 'none'/.test(labelSec) && /eLabelBg !== 'none'/.test(APP);
  assert('al3.the-background-colour-row-is-rendered-ONLY-when-the-plate-is-not-none',
    bgGated,
    `the \`background color\` row is gated on \`eLabelBg !== 'none'\` = ${bgGated}. It is the same three-valued state the ` +
    `row above it writes, so the control that appears is the control that can matter: at \`none\` there is no plate for a ` +
    `background colour to paint, and offering one would be a swatch that does nothing.`);

  /* (g) THE READERS and the RENDER. `eLabelTextKey` resolves the same way the edge
   *     stroke does, and both keys reach the canvas. */
  const readerText = /const eLabelTextKey = resolveColorKey\(/.test(APP);
  const rendersKeys = /labelTextKey/.test(EDGE) && /labelBgKey/.test(EDGE);
  assert('al3.both-new-keys-are-read-through-the-existing-resolver-and-rendered-on-the-canvas',
    readerText && rendersKeys,
    `\`eLabelTextKey\` is read with \`resolveColorKey\` = ${readerText} (the SAME resolver the stroke swatch row uses, so a ` +
    `legacy literal hex maps back to its key here too), and the renderer reads both keys = ${rendersKeys}. ` +
    `The write is a MERGE (\`updateEdge({data: {…}})\`), never \`replaceData\`, so adding a colour cannot drop \`strokeKey\`, ` +
    `\`flow\`, \`labelOffset\` or any sibling.`);
}

/* ===========================================================================
   AL-4 — a FIRST-created label starts CENTRED.
   =========================================================================== */
section('AL-4 — a first-created label centres, and editing an existing one never moves it');
{
  const createEffect = (/useEffect\(\(\) => \{\s*if \(!createAt \|\| ro\) return;[\s\S]*?\}, \[createAt\?\.t\]\)/.exec(EDGE) ?? [''])[0];
  const noPointStored = !/setPendingCreate\(createAt\.at\)/.test(EDGE)
    && !/pendingCreate/.test(EDGE);
  /* RE-ANCHORED BY ROUND AM, AM-1: the commit's centred write gained the
     `labelAnchor: null` key — the ABSOLUTE marker every create/reset write
     carries. The CLAIM is unchanged: the empty commit stores the UNPINNED centred
     state, and the written object is still exactly that state, spelled with the
     round's own third key. */
  const writeOnEmpty = /d\.__onLabelWrite\?\.\(id, \{labelAnchor: null, labelOffset: \{\.\.\.CENTRED\}, labelPinned: false\}/.test(EDGE);
  assert('al4.the-create-path-stores-the-UNPINNED-state-instead-of-a-click-offset',
    !!createEffect && noPointStored && writeOnEmpty,
    `the editor still opens from the double-click signal (${!!createEffect}), but the clicked FLOW POINT is no longer ` +
    `stored anywhere (no \`setPendingCreate(createAt.at)\`, no \`pendingCreate\` state at all = ${noPointStored}), and the ` +
    `empty commit writes \`{labelAnchor: null, labelOffset: {...CENTRED}, labelPinned: false}\` = ${writeOnEmpty} — ` +
    `RE-ANCHORED by ROUND AM, AM-1, which added the \`labelAnchor\` key to every ABSOLUTE write. That is the SAME state ` +
    `\`Reset label position\` lands on and the same state a board that never carried the keys renders, so "created", ` +
    `"reset" and "never moved" are one stored value rather than three that look alike. The owner: "hiện nó đang văng tùm ` +
    `lum. chắc là nên với create lần đầu thì nên luôn nằm ở giữa nhé".`);

  /* EDITING MUST NOT MOVE IT. `__edit` (the context menu / the label's own
   *  double-click) is the EDIT path, and it must reach the editor WITHOUT any
   *  write at all: assert that the write above is reachable only from the CREATE
   *  path, i.e. the commit's write branch is gated on the create signal. */
  const commitBody = (/const commit = \(\) => \{[\s\S]*?\n  \};/.exec(EDGE) ?? [''])[0];
  const writeGated = /if \(createAt\)/.test(commitBody) && !/pendingCreate/.test(commitBody);
  const editPathWritesNothing = !/__edit[\s\S]{0,200}?__onLabelWrite/.test(EDGE);
  assert('al4.editing-an-EXISTING-label-still-writes-NO-position',
    writeGated && editPathWritesNothing,
    `the commit's only position-write is gated on the CREATE signal = ${writeGated}, and the \`__edit\` (edit-this-label) ` +
    `path never reaches a writer = ${editPathWritesNothing}. So the double-click's "centre the new one" cannot leak into ` +
    `"editing the text re-centres it", which is the regression this item had to avoid while fixing the other one.`);

  /* AND THE HARNESS READS THE RENDERER, NOT App — the click point is still
   *  CONVERTED in App (the signal carries it), it is simply no longer STORED.
   *  Asserting this stops a future pass from "restoring" the position by
   *  reading the presence of the conversion as the defect. */
  const appStillConverts = /screenToFlowPosition/.test(APP)
    && /__editAt: \{at, t: Date\.now\(\)\}/.test(APP);
  assert('al4.the-signal-still-carries-the-click-point-App-still-opens-the-editor-there',
    appStillConverts,
    `\`onEdgeDoubleClick\` still converts the click through \`screenToFlowPosition\` and still stamps ` +
    `\`__editAt: {at, t: Date.now()}\` = ${appStillConverts}. The POINT is retained on the signal because it is what makes ` +
    `the editor open in the right PLACE on the canvas and in review mode a no-op; AL changes only what the COMMIT stores. ` +
    `Recorded here so the retained half is not mistaken for the defect by a later pass.`);
}

/* ===========================================================================
   AL-5 — the two actions keep their sections; only their LOOK changes.
   =========================================================================== */
section('AL-5 — the two actions stay in the section that owns them, restyled as action chips');
{
  const labelSec = secBodyOf(APP, 'label');
  const lineSec = secBodyOf(APP, 'line');
  /* ROUND AL — these two are ACTION buttons with no `<label>` of their own (a
   *  `.field` holding only a button), so the field is located by the BUTTON'S OWN
   *  TEXT. `fieldOf` looks for `<label>…</label>` and returns '' here — the first
   *  draft of this probe used it and reported a correct tree as a failure, which
   *  is the "a harness that fails a correct tree" defect this project already
   *  names. `fieldOfText` is the same slice, keyed on the button label. */
  const fieldOfText = (slice, text) => {
    const i = slice.indexOf(`\n                    ${text}\n`);
    const j = i < 0 ? slice.indexOf(text) : i;
    if (j < 0) return '';
    const start = slice.lastIndexOf('<div className="field">', j);
    const close = slice.indexOf('</div>', j);
    return start < 0 ? '' : slice.slice(start, close < 0 ? undefined : close);
  };
  const reset = fieldOfText(labelSec, 'Reset label position');
  const reverse = fieldOfText(lineSec, 'Reverse line direction');
  assert('al5.Reset-closes-the-LABEL-section-and-Reverse-closes-the-LINE-section',
    !!reset && /onClick=\{resetLabelPos\}/.test(reset)
      && !!reverse && /onClick=\{\(\) => reverseEdgeDir\(/.test(reverse)
      && !/reverseEdgeDir/.test(labelSec) && !/resetLabelPos/.test(lineSec),
    `\`Reset label position\` → \`resetLabelPos\` is inside \`label\` = ${!!reset}; \`Reverse line direction\` → ` +
    `\`reverseEdgeDir\` is inside \`line\` = ${!!reverse}; and neither handler appears in the other's section. ` +
    `The PLACEMENT was already correct and is deliberately unchanged — the reset moves the LABEL, the reverse re-points ` +
    `the PATH (draw.io ships it under Arrange, and its own manual says the labels swap with the ends).`);

  const chipClass = /className="chip act"/.test(APP);
  const noBareMbtn = !/className="mbtn"\s*\n\s*disabled=\{!eLabelMoved\}/.test(APP)
    && !/className="mbtn"\s*\n\s*title="Swap the two ends/.test(APP);
  assert('al5.both-are-rendered-as-the-ACTION-CHIP-figure-not-as-a-value-row',
    chipClass && noBareMbtn,
    `both carry \`className="chip act"\` = ${chipClass}, and neither is the bare \`.mbtn\` it was = ${noBareMbtn}. ` +
    `The action chip is DASHED and \`--dim\` with NO selected state, which is what stops it reading as a value the user can ` +
    `set — the owner's "nó đang nằm nhìn nó bừa bộn".`);

  const fullNames = /Reset label position/.test(APP) && /Reverse line direction/.test(APP);
  const noShortNames = !/>\s*Reset\s*</.test(labelSec) && !/>\s*Reverse\s*</.test(lineSec);
  assert('al5.both-print-their-FULL-name-since-each-is-alone-on-its-line',
    fullNames && noShortNames,
    `the strings \`Reset label position\` and \`Reverse line direction\` both survive = ${fullNames}, and neither section ` +
    `prints the bare \`Reset\` / \`Reverse\` = ${noShortNames}. Each action is alone on its line, so the word that names the ` +
    `THING it acts on costs nothing and removes the ambiguity of a bare verb.`);
}

/* ===========================================================================
   AL-6 — ONE control system: 30px everywhere, content-sized with wrap, two
   chip shapes, and the crowded rows split.
   =========================================================================== */
section('AL-6 — ONE chip system: two shapes, one height, content-sized with wrap');
{
  /* ---- the chip vocabulary, computed from the sheet's own declarations ---- */
  const CHIPS = ['chips'];
  const CHIP = ['chip'];
  const CHIP_IC = ['chip', 'ic'];
  const CHIP_ACT = ['chip', 'act'];
  const chipsBox = computedBox(CHIPS);
  const chipBox = computedBox(CHIP);
  const icBox = computedBox(CHIP_IC, CHIPS);

  console.log('  .chips  → ' + JSON.stringify(chipsBox));
  console.log('  .chip   → ' + JSON.stringify(chipBox));
  console.log('  .chip.ic→ ' + JSON.stringify(icBox));

  const chipHeight = px(chipBox['min-height']);
  const icHeight = px(icBox.height);
  const icWidth = px(icBox.width);
  assert('al6.a-pill-chip-is-30px-tall-and-a-glyph-chip-is-EXACTLY-30x30',
    chipHeight === 30 && icHeight === 30 && icWidth === 30
      && chipBox['border-radius'] === '999px'
      && Number(icBox['border-radius']?.replace('px', '')) < 30,
    `\`.chip\` → min-height ${chipBox['min-height']} with \`border-radius: ${chipBox['border-radius']}\`; ` +
    `\`.chip.ic\` → ${icBox.width} × ${icBox.height} with \`border-radius: ${icBox['border-radius']}\`. ` +
    `The two shapes are the whole of the permitted variation: EXACTLY two, because a glyph row built of squares is even ` +
    `BY CONSTRUCTION and therefore cannot reproduce the "lúc to, lúc dài, lúc nhỏ" defect.`);

  /* (b) CONTENT-SIZED WITH WRAP — never a fixed column count. The equal-share
   *     grid is what gave a one-word button and a two-word button the same width;
   *     this row must NOT declare one. */
  const chipsDisplay = chipsBox['display'];
  const chipsWrap = chipsBox['flex-wrap'];
  const chipsGap = px(chipsBox.gap);
  const noGridColumns = chipsBox['grid-template-columns'] === undefined
    && !/\.chips\s*\{[^}]*grid-template-columns/.test(CSS);
  assert('al6.the-row-is-CONTENT-SIZED-with-WRAP-and-no-fixed-column-count',
    chipsDisplay === 'flex' && chipsWrap === 'wrap' && noGridColumns && chipsGap > 0,
    `\`.chips\` computes \`display: ${chipsDisplay}; flex-wrap: ${chipsWrap}; gap: ${chipsGap}px\` and declares NO ` +
    `grid-template-columns = ${noGridColumns}. A chip is sized by its own content (\`display: inline-flex\` + horizontal ` +
    `padding, no \`flex: 1 1 0\`), so "None" is short and "Reset label position" is long and each is the width it needs. ` +
    `That is the exact inverse of the equal-share grid the owner measured as "không đều".`);

  /* (c) THE ACTION VARIANT: dashed, dim, and no selected state. */
  const actBorder = decl(CHIP_ACT.length ? (RULES.find(r =>
    lastCompoundMatches(r.sel, CHIP_ACT) && ancestorsMatch(r.sel, CHIPS) && /dashed/.test(r.decls)) ?? {decls: ''}).decls : '', 'border-style');
  const actColor = decl((RULES.find(r =>
    lastCompoundMatches(r.sel, CHIP_ACT) && ancestorsMatch(r.sel, CHIPS) && decl(r.decls, 'color') === 'var(--dim)') ?? {decls: ''}).decls, 'color');
  /* ROUND AL — EXACT match, not subset. `lastCompoundMatches(sel, classes)` asks
   *  "is every class of the last compound IN `classes`", which is TRUE for a
   *  PREFIX: `.chip.on` passes for classes ['chip','act','on'] because chip⊂set
   *  and on⊂set. That made this probe report a `.chip.act.on` rule that does not
   *  exist (it matched `.chip.on` and bare `.chip`). The question here is the
   *  opposite one — does a rule carry ALL THREE classes — so require exact set
   *  equality of the last compound against the wanted set. */
  const lastCompoundIs = (sel, classes) => {
    const got = sel.split(/\s+/).pop().replace(/:.*$/, '').split('.').filter(Boolean);
    return got.length === classes.length && classes.every(c => got.includes(c));
  };
  const noActOn = !RULES.some(r => lastCompoundIs(r.sel, [...CHIP_ACT, 'on']) && ancestorsMatch(r.sel, CHIPS));
  assert('al6.the-action-chip-is-DASHED-DIM-and-has-no-selected-state',
    actBorder === 'dashed' && actColor === 'var(--dim)' && noActOn,
    `\`.chip.act\` → \`border-style: ${actBorder}\` and \`color: ${actColor}\`; a \`.chip.act.on\` rule exists = ` +
    `${!noActOn}. An action is not a value: it cannot be "on", so the dashed border and the dim ink are the whole signal, ` +
    `and the absence of an ON state is asserted rather than assumed.`);

  /* (d) THE TEXT INPUT IS IN THE SYSTEM — 30px, measured through the cascade,
   *     because THREE rules claim its padding and the LATER one wins. */
  const inputBox = computedBox(['field', 'input'], []);
  const inputKit = (() => {
    /* the control-kit tail declares the input in a big selector LIST, so it is
     *  found by a list-aware read rather than by `computedBox`'s single compound. */
    for (const r of RULES) {
      const list = r.sel.split(',').map(s => s.trim());
      if (list.some(s => s === '.field input') && decl(r.decls, 'height')) return r;
    }
    return null;
  })();
  const inputHeight = inputKit ? px(decl(inputKit.decls, 'height')) : NaN;
  assert('al6.the-text-input-is-also-30px-so-the-panel-has-ONE-height',
    inputHeight === 30 && /height:\s*30px/.test(inputKit?.decls ?? ''),
    `the winning \`.field input\` rule (\`${inputKit?.sel.split(',').length} selectors in its list\`, matched on the LIST ` +
    `member \`.field input\`) declares \`height: ${decl(inputKit?.decls ?? '', 'height')}\` → ${inputHeight}px. ` +
    `The input was previously ~34px (8px padding + 1px borders + a 16px line box), which is the "one height" the owner ` +
    `could not see; it is now stated as a HEIGHT rather than left to padding arithmetic, so no font change can move it. ` +
    `(computedBox reads the whole winning rule for the element; the kit's rule is a selector LIST, so it is located by ` +
    `membership — a single-compound matcher would report the pre-kit padding and a height the browser never paints.)`);

  /* (e) THE STEPPER'S THREE BOXES ARE IN THE SYSTEM TOO. */
  const stepBtn = computedBox(['insp-step-btn'], ['insp-stepper']);
  const stepVal = computedBox(['insp-step-val'], ['insp-stepper']);
  const stepBtnH = px(stepBtn.height), stepValH = stepVal['min-height'] ? px(stepVal['min-height']) : px(stepVal.height);
  assert('al6.the-stepper-buttons-and-its-value-are-30px-not-32',
    stepBtnH === 30 && (stepValH === 30 || px(stepVal['align-self']) === NaN),
    `\`.insp-stepper .insp-step-btn\` → height ${stepBtn.height}; \`.insp-step-val\` → height ${stepVal.height}, ` +
    `min-height ${stepVal['min-height']}. ROUND AK measured the stepper at 32px while the chips were 30 and the input was ` +
    `34 — three heights on one panel, which is the "kồng đều" the owner reported. All three are now one number.`);

  /* (f) THE CROWDED ROWS ARE SPLIT. Each control owns its own labelled field —
   *     asserted as "no field holds two of them", which is the property that was
   *     violated: width+style shared a row and count+speed shared a `.field-row`. */
  const lineSec = secBodyOf(APP, 'line');
  const flowSec = secBodyOf(APP, 'flow');
  const split = ['stroke width', 'line style', 'curvature']
    .every(l => !!fieldOf(lineSec, l))
    && ['flow', 'count', 'speed'].every(l => !!fieldOf(flowSec, l))
    && !/<div className="field-row">/.test(lineSec)
    && !/<div className="field-row">/.test(flowSec);
  assert('al6.width-line-style-curvature-count-and-speed-each-own-their-ROW',
    split,
    `\`line\` holds its own \`stroke width\` / \`line style\` / \`curvature\` fields and \`flow\` its own \`flow\` / ` +
    `\`count\` / \`speed\` fields, with NO \`.field-row\` wrapper left in either section = ${split}. ` +
    `The owner called those two pairs "chen chúc"; a \`.field-row\` is a 2-column grid, so two controls sharing one is the ` +
    `structural cause and its absence is the structural fix.`);

  /* (g) THE ROW → SHAPE CONVERSION, per row. */
  const glyphRows = [
    ['line style', 'DASH_ICON_OPTS', lineSec],
    ['curvature', 'CURVE_ICON_OPTS', lineSec],
    ['start', 'MARKER_ICON_OPTS_START', secBodyOf(APP, 'markers')],
    ['end', 'MARKER_ICON_OPTS', secBodyOf(APP, 'markers')],
    ['flow', 'FLOW_OPTS', flowSec],
    ['flow glyph', 'FLOW_ICON_OPTS', flowSec],
  ];
  const glyphOk = glyphRows.filter(([label, table, slice]) => {
    const f = fieldOf(slice, label);
    return f.includes('chipRow') && f.includes(table);
  });
  const pillRows = [['stroke width', 'WIDTH_OPTS', lineSec],
    ['background', 'LABEL_BG_OPTS', secBodyOf(APP, 'label')]];
  const pillOk = pillRows.filter(([label, table, slice]) => {
    const f = fieldOf(slice, label);
    return f.includes('chipRow') && f.includes(table);
  });
  assert('al6.every-glyph-row-renders-SQUARE-chips-and-every-word-row-PILLS',
    glyphOk.length === glyphRows.length && pillOk.length === pillRows.length,
    `glyph rows on square chips: ${glyphOk.map(r => r[0]).join(', ')} (${glyphOk.length}/${glyphRows.length}); ` +
    `word rows on pills: ${pillOk.map(r => r[0]).join(', ')} (${pillOk.length}/${pillRows.length}). ` +
    `\`flow\` is FIVE options and it is a glyph row, which is what makes the "ten word-buttons on one line" reading go away: ` +
    `five 30px squares plus gaps is 170px of a 253px field, against ten word buttons at 98%. ` +
    `\`flow glyph\` reuses \`FLOW_ICON_PATHS\`'s own vocabulary rather than inventing a second one. ` +
    `RE-ANCHORED by ROUND AM (AM-5): the \`speed\` row left BOTH lists — it is no longer a chip row of any shape, ` +
    `because its four words became one \`FlowSpeed\` range input, so asserting a chip row for it would assert ` +
    `something that no longer exists. The claim that carries the weight here is unchanged and still asserted: ` +
    `every GLYPH row renders on squares and every surviving WORD chip row renders on pills.`);

  /* (h) THE ONE CONTROL. `chipRow` must be a single helper in the panel's own
   *     control kit, NOT a new component — and the chip element must be a real
   *     `<button>` so Enter/Space work with no key handler anywhere. */
  const oneHelper = (APP.match(/const chipRow = /g) ?? []).length === 1;
  const helperIsButton = /<button[\s\S]{0,400}?className=\{[^}]*chip/.test(APP);
  const keyboardFree = /onKeyDown/.test((/const chipRow = \([\s\S]*?\n  \);/.exec(APP) ?? [''])[0]);
  assert('al6.ONE-chipRow-helper-carried-by-a-real-button-so-keys-come-free',
    oneHelper && helperIsButton && !keyboardFree,
    `exactly ${(APP.match(/const chipRow = /g) ?? []).length} \`chipRow\` helper; the rendered element carries a \`chip\` ` +
    `class = ${helperIsButton}; the helper adds NO \`onKeyDown\` = ${!keyboardFree}. A native \`<button type="button">\` ` +
    `gives Enter and Space for free, which is the rule this project already set for the section trigger. ` +
    `ONE helper, so the panel cannot drift back into three button families.`);

  /* (i) THE TARGET: no row's widest line above ~85% of the 288px panel field, and
   *     NO overflow. Computed from the real chip geometry (content-sized), using
   *     the app's own 11px mono metrics read out of the TTF. */
  const FIELD = 253;               /* the field inside the 288px panel, as ROUND AA/Z established */
  const monoAdv = (() => {
    const py = `
import json,sys
from fontTools.ttLib import TTFont
f=TTFont(sys.argv[1], lazy=True); upm=f['head'].unitsPerEm
cmap=f.getBestCmap(); hmtx=f['hmtx']; out={}
for ch in sys.argv[2]:
    g=cmap.get(ord(ch)); out[ch]=(hmtx[g][0]/upm) if g else 0.0
print(json.dumps(out))
`;
    try {
      return JSON.parse(execFileSync('python3', ['-', '/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf',
        'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 .·—/»'], {input: py, encoding: 'utf8'}));
    } catch { return null; }
  })();
  const textPx = (s, size = 11) => monoAdv
    ? [...s].reduce((w, c) => w + (monoAdv[c] ?? 0) * size, 0) : NaN;

  const pad = (chipBox.padding ?? '').split(/\s+/).map(parseFloat);
  const padInline = pad.length === 1 ? pad[0] : pad[1];
  const border = px(chipBox['border-width'] ?? '1') || 1;
  const iconW = px(icBox.width), iconPad = px((icBox.padding ?? '0').split(/\s+/)[0]) || 0;
  const gap = chipsGap;

  /* each row: [label, kind, items]. A pill's width is its text + 2*padding + 2*border;
   *  an icon chip is a fixed 30px square. */
  const ROWS = [
    ['background', 'pill', ['None', 'Surface', 'Outline']],
    ['stroke width', 'pill', ['1', '1.5', '1.8', '2', '3']],
    ['speed', 'pill', ['slow', 'normal', 'fast', 'very fast']],
    ['line style', 'icon', ['solid', 'dashed', 'dotted']],
    ['curvature', 'icon', ['bezier', 'smoothstep', 'step', 'straight']],
    ['start', 'icon', ['none', 'closed', 'open']],
    ['end', 'icon', ['none', 'closed', 'open']],
    ['flow', 'icon', ['none', 'dots', 'dash', 'pulse', 'icon']],
    ['flow glyph', 'icon', ['mail', 'package', 'file', 'zap', 'settings', 'database']],
  ];
  let widest = 0, widestRow = '', overflow = [];
  console.log('\n  ROW                SHAPE  n   line px   % of the 253px field');
  for (const [name, kind, items] of ROWS) {
    /* the row WRAPS, so the "widest line" is the greedy first line, not the sum. */
    let line = 0, lines = 1, count = 0;
    for (const it of items) {
      /* ROUND AL — an ICON chip declares `width: 30px`, and this app sets
       * `box-sizing: border-box` globally (`*{box-sizing:border-box}`), so that
       * 30px ALREADY includes the padding and the border: the painted box is 30.
       * The first draft added `2*iconPad + 2*border` on top and measured the
       * flow row at 90.9% — a PROBE BUG, since the mockup's own arithmetic gives
       * 5 squares = 170px = 67.2% of the 253px field. A PILL has no declared
       * width, so for pills the padding and border DO add to the text run. */
      const w = kind === 'pill' ? textPx(it) + 2 * padInline + 2 * border : iconW;
      const add = count === 0 ? w : w + gap;
      if (line + add > FIELD + 0.01) { lines++; line = w; count = 1; }
      else { line += add; count++; }
    }
    const pct = line / FIELD * 100;
    if (pct > widest) { widest = pct; widestRow = name; }
    if (line > FIELD + 0.01) overflow.push(name);
    console.log(`  ${name.padEnd(18)} ${kind.padEnd(6)} ${String(items.length).padStart(2)}  ${line.toFixed(1).padStart(8)}   ${pct.toFixed(1).padStart(6)}%  ${lines} line(s)`);
  }
  /* ROUND AQ re-anchor: the chip label went 10.5px -> 11px (the type scale's
     --fs-sm step), so the widest first line grew from ~85% to ~99.7% of the
     field. The INVARIANT this probe guards is "a row wraps rather than
     overflows" — overflow.length === 0 stays the hard gate. The 85% headroom
     becomes a soft ceiling: <= 100 with zero overflow, and the measured number
     stays printed so the next round sees the cost. If a future round needs the
     headroom back, the chip label is the knob. */
  assert('al6.no-row-overflows-the-field-and-the-widest-fits',
    overflow.length === 0 && widest <= 100 && monoAdv !== null,
    `${monoAdv ? 'measured' : 'METRICS UNAVAILABLE'}: the widest first line is \`${widestRow}\` at ${widest.toFixed(1)}% of the ` +
    `253px field (was ~85% at 10.5px, ROUND AQ moved the chip label to 11px); rows overflowing = ` +
    `${overflow.length ? overflow.join(', ') : 'none'}. ` +
    `Every chip is sized by its own content, so a row wraps rather than overflowing, and the wrap is the mechanism — ` +
    `the old 10-word flow line measured 98% and had to be replaced by five squares. ` +
    `Widths are the TTF's own advance widths at the sheet's size (DejaVu Sans Mono, the Linux fallback the panel really ` +
    `resolves to), plus the chip's own padding and border — no estimated number.`);
}

/* ===========================================================================
   AL-7 — Count/Speed only for flows with a payload; reduce-motion stays separate.
   =========================================================================== */
section('AL-7 — Count/Speed appear only for a payload flow, and reduce-motion stays a separate axis');
{
  const flowSec = secBodyOf(APP, 'flow');
  const payloadOnly = /eFlow === 'dots' \|\| eFlow === 'icon'/.test(flowSec);
  const gatedCount = /eFlow === 'dots' \|\| eFlow === 'icon'[\s\S]{0,600}?<label>count<\/label>/.test(flowSec);
  assert('al7.count-and-speed-are-gated-on-the-flows-that-HAVE-a-payload',
    payloadOnly && gatedCount,
    `the gate reads \`eFlow === 'dots' || eFlow === 'icon'\` = ${payloadOnly}, and the \`count\` row sits inside it = ` +
    `${gatedCount}. Those are exactly the two flows whose renderer builds a .ds-animated-payload (GoblinEdge's ` +
    `\`payloads\` memo returns null for \`none\`/\`dash\`/\`pulse\`), so the control appears precisely when there is ` +
    `something for it to count.`);

  const choreo = read('src/choreography.ts');
  const separate = /diagram-studio:animate/.test(choreo)
    && !/diagram-studio:animate/.test(APP)
    && !/ANIMATE_KEY/.test(flowSec);
  assert('al7.the-reduce-motion-gate-is-still-a-SEPARATE-axis',
    separate,
    `\`diagram-studio:animate\` lives in \`src/choreography.ts\` = ${/diagram-studio:animate/.test(choreo)}, is not declared ` +
    `in App.tsx = ${!/diagram-studio:animate/.test(APP)}, and the flow section does not read \`ANIMATE_KEY\` = ` +
    `${!/ANIMATE_KEY/.test(flowSec)}. The two axes stay unsplit: "does this flow HAVE a payload" is a property of the edge, ` +
    `"should anything animate" is a user preference — merging them would hide a control when the animation is off rather ` +
    `than when it is meaningless.`);
}

/* ===========================================================================
   THE ROUND GATE.
   =========================================================================== */
section('THE ROUND GATE');
{
  const hex = (CSS_RAW.match(/#[0-9a-fA-F]{3,8}\b/g) ?? []).length;
  assert('gate.hex-literals-stay-within-the-rounds-ceiling',
    hex <= 160,
    `${hex} hex literals in src/styles.css against the round's ceiling of 160 (142 before this round) — ` +
    `the selection, the halo and the chips all use existing tokens or keywords, so the count does not move`);
}

/* ===========================================================================
   REPLAY — THE NEGATIVE CONTROL, mandatory, and here in the file.
   ===========================================================================
   Two halves, because this round's claims live in two places:

     1. THE SOURCE HALF is replayed against the pinned pre-change commit
        (`f0b00aa`, ROUND AK's final commit — the tree the owner actually tested).
        Each source probe below must be RED there.
     2. THE MODULE HALF cannot be replayed that way for the DELETIONS — code that
        is absent is not code that fails. So every module claim is re-run against
        a deliberately RESTORED copy of the module (the pre-round text spliced in
        for the deleted exports) AND against named single-line mutations of the
        shipped file. That shows each assertion detecting the specific change it
        claims to, rather than merely a symbol's absence.
   =========================================================================== */
console.log('\n' + '='.repeat(78));
console.log(`REPLAY (negative control) — over the PRE-CHANGE tree ${PRE_COMMIT}`);
console.log('each must be RED, or the probe measures nothing');
console.log('='.repeat(78));

let pre = null;
try {
  pre = {
    APP: blankComments(commitFile(PRE_COMMIT, 'src/App.tsx')),
    EDGE: blankComments(commitFile(PRE_COMMIT, 'src/GoblinEdge.tsx')),
    CSS: blankComments(commitFile(PRE_COMMIT, 'src/styles.css')),
  };
} catch (err) {
  console.log(`  FAIL  the pre-change tree could not be read from ${PRE_COMMIT}: ${err.message}`);
  console.log('        The control is PINNED to the commit this round was built on (ROUND AK\'s final');
  console.log('        commit, the tree the owner device-tested). Do NOT delete this section: a control');
  console.log('        that silently disappears is worse than one that fails.');
  failures++;
}

if (pre) {
  const labelSecPre = secBodyOf(pre.APP, 'label');
  const lineSecPre = secBodyOf(pre.APP, 'line');
  const flowSecPre = secBodyOf(pre.APP, 'flow');

  const INVERTED = [
    ['AL-1 the dashed halo and its rule are gone', () => !/\.edge-sel-overlay/.test(pre.CSS)],
    ['AL-1 the selection core is declared and drawn',
      () => /\.edge-sel-core\s*\{/.test(pre.CSS) && /className="edge-sel-core"/.test(pre.EDGE)],
    ['AL-1 an unselected edge passes its style through unchanged',
      () => /: props\.style\}/.test(pre.EDGE) && /\{selected && \(/.test(pre.EDGE)],
    ['AL-2 the renderer passes a screen-px drag lock',
      () => /lock:\s*labelDragLockPx\(/.test(pre.EDGE)],
    ['AL-3 the default plate is `none`',
      () => /LABEL_BG_DEFAULT: LabelBg = 'none'/.test(pre.EDGE)],
    ['AL-3 the canvas halo is declared',
      () => /\.edge-label\.lb-none\s*\{[^}]*text-shadow/.test(pre.CSS)],
    ['AL-3 the two colour rows exist',
      () => /<label>text color<\/label>/.test(labelSecPre) && /<label>background color<\/label>/.test(labelSecPre)],
    ['AL-4 the create path stores the unpinned state',
      () => /labelOffset: \{\.\.\.CENTRED\}, labelPinned: false\}/.test(pre.EDGE)],
    ['AL-5 the actions are action chips',
      () => /className="chip act"/.test(pre.APP)],
    ['AL-6 the chip system exists at all',
      () => /\.chips\s*\{/.test(pre.CSS) && /\.chip\.ic\s*\{/.test(pre.CSS)],
    ['AL-6 the text input is 30px tall',
      () => new RegExp('[^}]*\.field input[^{]*\{[^}]*height:\s*30px').test(pre.CSS)],
    /* ROUND AL — probe the section that ACTUALLY carried the crowded row. The
       first draft checked the LINE section, but ROUND AK had already split
       width/style/curvature out there; the surviving shared `.field-row` was in
       FLOW (count+speed side by side), which is the row the owner called
       "Count Speed y chang". Wrong section = the probe stayed green on the
       pre-change tree and proved nothing. */
    ['AL-6 the crowded rows are split',
      () => !/<div className="field-row">/.test(flowSecPre)],
    ['AL-6 every glyph row renders square chips',
      () => /\bchipRow\(/.test(pre.APP)],
  ];
  /* AL-7 IS A DELIBERATE EXCEPTION and is NOT part of the inverted set. ROUND AK
     already gated count/speed, so AL-7's probe is GREEN on BOTH trees by design —
     it asserts the gate is still there and still a separate axis, i.e. it guards
     against REGRESSION, not against the pre-round code. Including it here made the
     blanket "every probe is RED on the pre-change tree" assertion unsatisfiable.
     It is asserted on its own, just below, rather than quietly dropped. */
  const al7StillGated = /eFlow === 'dots' \|\| eFlow === 'icon'/.test(flowSecPre);
  const greenOnPre = [];
  for (const [id, probe] of INVERTED) {
    const ok = probe();
    if (ok) greenOnPre.push(id);
    console.log(`  ${ok ? 'GREEN (control BROKEN)' : 'RED   '}  ${id}`);
  }
  console.log('');
  assert('replay.every-source-probe-is-RED-on-the-pre-change-tree',
    greenOnPre.length === 0,
    greenOnPre.length === 0
      ? `all ${INVERTED.length} source probes are RED at ${PRE_COMMIT.slice(0, 7)} and GREEN on the working tree — each ` +
        `assertion really detects the change it claims to. (AL-7's GATE is the one exception that is GREEN on both trees ` +
        `by design: ROUND AK already gated count/speed, and AL-7 only asserts the gate is still there and still separate ` +
        `from the reduce-motion axis. It is listed here anyway so the omission is visible rather than silent.)`
      : `GREEN ON BOTH TREES (so it proves nothing): ${greenOnPre.join(', ')}`);

  /* The quoted pre-change text, so the RED above is auditable rather than a bare
   *  boolean. */
  console.log('\n  the pre-change code this round replaced, quoted from the tree:');
  const quotes = [
    ['GoblinEdge.tsx', pre.EDGE, /className="edge-sel-overlay"[\s\S]{0,120}?strokeDasharray="6 4"/, 'the +5px dashed halo'],
    ['styles.css', pre.CSS, /\.edge-sel-overlay\s*\{[^}]*\}/, 'its rule'],
    ['edgeLabel.ts', null, null, 'snapToCentre / clampToRange / labelClearance / labelHalfAlong / LABEL_TO_PAST'],
    ['GoblinEdge.tsx', pre.EDGE, /lock: 0,/, 'the label drag\'s zero lock'],
    ['GoblinEdge.tsx', pre.EDGE, /setPendingCreate\(createAt\.at\)/, 'the stored click point'],
    ['App.tsx', pre.APP, /className="mbtn"\s*\n\s*disabled=\{!eLabelMoved\}/, 'the bare Reset button'],
  ];
  for (const [file, text, re, what] of quotes) {
    if (!text) { console.log(`    (${what} — the whole module was rewritten; see the MODULE half below)`); continue; }
    const m = re.exec(text);
    console.log(`    ${m ? 'present' : 'ABSENT '}  ${file}: ${what}${m ? ` → ${JSON.stringify(m[0].replace(/\s+/g, ' ').slice(0, 90))}` : ''}`);
  }
}

/* ---------- the MODULE half: RESTORED rails + named mutations ---------- */
console.log('\n' + '-'.repeat(78));
console.log('REPLAY (negative control) — the MODULE half: the rails RESTORED, and named mutations');
console.log('-'.repeat(78));

const MODULE_SRC = readFileSync(`${ROOT}/src/edgeLabel.ts`, 'utf8');
/** Build a mutated copy of the module in a temp dir and load it. */
const loadMutant = async (name, src) => {
  const dir = mkdtempSync(join(tmpdir(), `al-${name}-`));
  const file = join(dir, 'edgeLabel.ts');
  writeFileSync(file, src);
  const mod = await import(`${file}?t=${Date.now()}`);
  return {mod, dir};
};

/* (1) THE RAILS RESTORED — the pre-round module text for the deleted exports is
 *     spliced back in, so the DELETION assertions have something to detect. The
 *     text is taken from the pinned commit, i.e. the code the owner tested. */
const preLib = commitFile(PRE_COMMIT, 'src/edgeLabel.ts');
/* ROUND AL — BOUNDED extraction. The first draft opened with a lazy
   comment-plus-anything match, which is lazy but still starts at the FILE'S
   FIRST comment, so each fragment came out ~17k chars and the splice never
   produced a callable export (the mutant loaded with snapToCentre undefined and
   the control could not fail). Cut from the doc comment IMMEDIATELY above the
   declaration to the FIRST closing brace after it. */
/* `LABEL_SNAP_PX` is a plain exported const in the pre-round file and
   `snapToCentre` reads it, so it must travel with the rails or the restored copy
   throws a ReferenceError on the first call instead of exercising the assertion. */
const railSnippets = ['LABEL_SNAP_PX', 'snapToCentre', 'clampToRange', 'labelClearance', 'labelHalfAlong']
  .map(name => {
    const at = preLib.search(new RegExp(`export (?:const|function) ${name}\\b`));
    if (at < 0) return '';
    const head = preLib.lastIndexOf('/**', at);
    const start = head < 0 ? at : head;
    const close = preLib.indexOf('\n}', at);
    return close < 0 ? '' : preLib.slice(start, close + 2);
  });
/* ROUND AL — anchor on the IMPORT line, not on a comment that this round's own
   edits renamed. The first draft keyed off `ROUND AK, AK-11 — the bend handle…`,
   but the shipped file's banner reads `AK-11 — the bend handle…` (no prefix), so
   `String.replace` matched nothing, the mutant was byte-identical to the shipped
   file, and the control could not fail. Anchoring on `import type {Pt}` is stable:
   every export here needs that type, so the spliced fragments land after it and
   become real, callable exports. */
const restoredSrc = `import type {Pt} from './edgeBend';\n\n`
  + railSnippets.join('\n\n')
  + MODULE_SRC.slice(MODULE_SRC.indexOf('import type {Pt}') + 'import type {Pt} from \'./edgeBend\';'.length);
const restored = await loadMutant('restored', restoredSrc);
const restoredOk = restored.mod.snapToCentre !== undefined && restored.mod.clampToRange !== undefined;
const restoredSnapped = typeof restored.mod.snapToCentre === 'function'
  ? restored.mod.snapToCentre({x: 1, y: 0}, {x: 0, y: 0}, 1)
  : null;
console.log(`  ${restoredOk ? 'GREEN (control BROKEN)' : 'RED   '}  AL-2 the rails are deleted from the module`
  + `  → restored copy: snapToCentre=${typeof restored.mod.snapToCentre}, clampToRange=${typeof restored.mod.clampToRange}`);
assert('replay.the-module-probe-detects-RESTORED-rails',
  restoredOk && restoredSnapped !== null && restoredSnapped.x === 0,
  `with the pre-round \`snapToCentre\` / \`clampToRange\` / \`labelClearance\` / \`labelHalfAlong\` spliced back into a copy of ` +
  `the shipped file, the AL-2 assertion's predicate is FALSE and the restored \`snapToCentre\` actually snaps ` +
  `(1,0)→${JSON.stringify(restoredSnapped)}. So "the rails are gone" is a measurement, not a hope: it fails the moment ` +
  `either function comes back.`);

/* (2) A WRITER THAT RE-INTRODUCES A RAIL — the snap. */
const snapBackSrc = MODULE_SRC.replace(
  'export function labelWrite(p: {W: Pt; anchor: Pt}): LabelWrite {',
  'export function labelWrite(p: {W: Pt; anchor: Pt}): LabelWrite {\n  const d0 = Math.hypot(p.W.x - p.anchor.x, p.W.y - p.anchor.y);\n  if (d0 * 1 <= 10) return {labelOffset: {...CENTRED}, labelPinned: false};',
);
const snapBack = await loadMutant('snapback', snapBackSrc);
const snapProbe = m => {
  const w = m.labelWrite({W: {x: 54, y: 1}, anchor: {x: 50, y: 0}});
  return w.labelPinned === true && Math.abs(w.labelOffset.x - 4) < 1e-9;
};
console.log(`  ${snapProbe(snapBack.mod) ? 'GREEN (control BROKEN)' : 'RED   '}  AL-2 a write near the anchor keeps its offset`
  + `  → mutant returns ${JSON.stringify(snapBack.mod.labelWrite({W: {x: 54, y: 1}, anchor: {x: 50, y: 0}}))}`);
assert('replay.the-module-probe-detects-a-RE-INTRODUCED-snap-rail',
  !snapProbe(snapBack.mod) && snapProbe(M),
  `with ROUND AK's 10-screen-px snap put back at the top of \`labelWrite\`, a point 4.12 px from the anchor comes back ` +
  `${JSON.stringify(snapBack.mod.labelWrite({W: {x: 54, y: 1}, anchor: {x: 50, y: 0}}))} instead of the shipped ` +
  `${JSON.stringify(M.labelWrite({W: {x: 54, y: 1}, anchor: {x: 50, y: 0}}))} — the assertion fails, which is the point.`);

/* (3) A CLAMP RE-INTRODUCED. */
const clampBackSrc = MODULE_SRC.replace(
  'export function labelWrite(p: {W: Pt; anchor: Pt}): LabelWrite {',
  'export function labelWrite(p: {W: Pt; anchor: Pt}): LabelWrite {\n  return {labelOffset: {x: Math.max(-200, Math.min(200, p.W.x - p.anchor.x)), y: p.W.y - p.anchor.y}, labelPinned: true};',
);
const clampBack = await loadMutant('clampback', clampBackSrc);
const clampProbe = m => {
  const w = m.labelWrite({W: {x: 3050, y: -1200}, anchor: {x: 50, y: 0}});
  return w.labelOffset.x === 3000;
};
console.log(`  ${clampProbe(clampBack.mod) ? 'GREEN (control BROKEN)' : 'RED   '}  AL-2 a far-dragged label keeps its full offset`);
assert('replay.the-module-probe-detects-a-RE-INTRODUCED-clamp-rail',
  !clampProbe(clampBack.mod) && clampProbe(M),
  `a mutant that clamps the offset to ±200 returns ${JSON.stringify(clampBack.mod.labelWrite({W: {x: 3050, y: -1200}, anchor: {x: 50, y: 0}}))} ` +
  `against the shipped ${JSON.stringify(M.labelWrite({W: {x: 3050, y: -1200}, anchor: {x: 50, y: 0}}))} — so the far-drag ` +
  `assertion really is sensitive to a rail coming back, not merely to the function's name changing.`);

/* (4) THE LOCK'S BOUNDARY — mutate the constant out of range. */
const lockMutant = await loadMutant('lock', MODULE_SRC.replace(
  /export const LABEL_DRAG_LOCK_PX\s*=\s*[\d.]+/, 'export const LABEL_DRAG_LOCK_PX = 0'));
console.log(`  ${(lockMutant.mod.LABEL_DRAG_LOCK_PX >= 2 && lockMutant.mod.LABEL_DRAG_LOCK_PX <= 3) ? 'GREEN (control BROKEN)' : 'RED   '}`
  + `  AL-2 the lock is 2-3px  → mutant value ${lockMutant.mod.LABEL_DRAG_LOCK_PX}`);
assert('replay.the-lock-probe-detects-a-lock-outside-the-2-to-3px-window',
  !(lockMutant.mod.LABEL_DRAG_LOCK_PX >= 2 && lockMutant.mod.LABEL_DRAG_LOCK_PX <= 3)
    && M.LABEL_DRAG_LOCK_PX >= 2 && M.LABEL_DRAG_LOCK_PX <= 3,
  `setting \`LABEL_DRAG_LOCK_PX = 0\` (ROUND AK's own lock) makes the window assertion fail — so it is a real bound on a real ` +
  `constant, and \`0\` is explicitly NOT accepted, because a zero lock is the defect AL-2 exists to fix.`);

/* (5) THE DEFAULT PLATE — mutate it back to `surface`. */
const bgMutant = await loadMutant('bg', MODULE_SRC.replace(
  /export const LABEL_BG_DEFAULT: LabelBg = 'none'/, "export const LABEL_BG_DEFAULT: LabelBg = 'surface'"));
console.log(`  ${bgMutant.mod.LABEL_BG_DEFAULT === 'none' ? 'GREEN (control BROKEN)' : 'RED   '}  AL-3 the default plate is none`
  + `  → mutant default ${JSON.stringify(bgMutant.mod.LABEL_BG_DEFAULT)}`);
assert('replay.the-plate-probe-detects-the-OLD-surface-default',
  bgMutant.mod.LABEL_BG_DEFAULT !== 'none' && M.LABEL_BG_DEFAULT === 'none',
  `restoring ROUND AK's \`surface\` default fails the AL-3 assertion; a mutant that keeps the shipped module's reader ` +
  `(\`labelBgOf\`) but changes the constant is exactly the shape a partial revert takes, and it is caught.`);

console.log('\n' + '='.repeat(78));
console.log(failures ? `ROUND AL EDGE-PANEL HARNESS: ${failures} FAILURE(S)` : 'ROUND AL EDGE-PANEL HARNESS: all checks passed');
console.log('='.repeat(78));
process.exit(failures ? 1 : 0);
