#!/usr/bin/env node
/**
 * ROUND AN — the second device test of the edge panel: AN-3 (the flow-glyph
 * figures draw in the flow row's own frame), AN-4 (the FlowRail is DELETED, the
 * printed speed value stays), AN-5 (undo/redo keep the LIVE selection), AN-6a
 * (a selected label may not overwrite its authored colour) and AN-6b (the plate
 * colour gets a consumer).
 *
 * WHAT THIS FILE IS, and what it deliberately is not. It cannot see a browser:
 * this project's headless session renders ZERO edges (nodes render, `minimap
 * edges` = 0), so no live edge-panel measurement exists and none is claimed
 * here. Every claim below is made the only ways this project allows (ROUND AK's
 * hard rule):
 *
 *   (1) SOURCE / SHEET claims — read as TEXT with COMMENTS BLANKED FIRST, because
 *       this codebase DELETES a control and leaves a comment QUOTING it in its
 *       place, and because a rule named in a comment is not a rule the browser
 *       ever matches. Blanking (not stripping) keeps every byte offset and line
 *       number true, so a reported line is the line the code is really on.
 *   (2) COMPUTED claims — several numbers here are ARITHMETIC OVER PARSED SOURCE
 *       (frame spans, painted pixel sizes, painted stroke widths, cascade
 *       winners). They are printed as the numbers they are rather than as a
 *       boolean, because "12.7px equals 12.7px" is auditable and "same frame"
 *       is not.
 *
 * THE NEGATIVE CONTROL IS IN THE FILE (the REPLAY at the bottom) and it is
 * mandatory: EVERY probe in its list is re-run over the PINNED pre-change tree,
 * read with `git show`, and MUST be RED there. A probe that cannot be shown RED
 * proves nothing.
 *
 * ONE CLAIM IS DELIBERATELY NOT IN THAT LIST. AN-6's untouched-board parity —
 * "an unselected label still paints exactly what it painted" — is GREEN ON BOTH
 * TREES BY CONSTRUCTION, because it asserts that nothing changed. It is printed
 * with a NOTE saying so rather than counted as a kill; the KILL for AN-6 is the
 * half of the same claim that the selection override used to break, and it is in
 * the list. Declared here for the same reason ROUND AM declared its own
 * green-on-both probe: a control that cannot fail must not look like one that can.
 *
 * DS_ROOT overrides the project root; DS_PRE_COMMIT overrides the pinned commit.
 */
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';

const ROOT = process.env.DS_ROOT || '/home/harvey/projects/tech-goblin/lab/diagram-studio';

/* The tree ROUND AN was built on: ROUND AM's handoff commit, i.e. the tree before
 * AN-3…AN-6 (AN-1 had already been committed as dd02b49 and AN-2 needed no
 * change). PINNED, never `HEAD`: once this round is committed, `HEAD` IS the
 * fixed tree and a `HEAD`-based control would compare the fix with itself. */
const PRE_COMMIT = process.env.DS_PRE_COMMIT || 'f75f5d1';

/* ---------- the assertion harness (house style) ---------- */
let failures = 0;
const assert = (name, ok, detail) => {
  if (ok) console.log(`  PASS  ${name}\n        ${detail}`);
  else { failures++; console.log(`  FAIL  ${name}\n        ${detail}`); }
};
const section = t => console.log(`\n${t}\n${'='.repeat(78)}`);
const note = t => console.log(`  NOTE  ${t}`);

/** Blank comments, preserving every byte offset and line number. `//` needs a
 *  guard: a bare `//` inside a URL or a string would truncate a real line. */
const blankComments = src => src
  .replace(/\/\*[\s\S]*?\*\//g, m => m.replace(/[^\n]/g, ' '))
  .replace(/(^|[^:])\/\/[^\n]*/g, (m, p1) => p1 + ' '.repeat(m.length - p1.length));

const read = p => readFileSync(`${ROOT}/${p}`, 'utf8');
const commitFile = (commit, p) =>
  execFileSync('git', ['show', `${commit}:${p}`], {cwd: ROOT, encoding: 'utf8', maxBuffer: 1 << 28});
const code = p => blankComments(read(p));
const codeAt = (commit, p) => blankComments(commitFile(commit, p));

/* ---------- small source readers, shared by the probes and the replay -------
 * Each takes BLANKED source, so nothing here can be fooled by a comment that
 * quotes a deleted rule (AN-4's whole subject) or by a rule quoted in prose. */

/** The declarations of one `selector { … }` rule, as a property → value map.
 *  Anchored on the selector followed by `{`, so `.edge-label` cannot swallow
 *  `.edge-label.selected`: the lookalike has `.selected` between them. */
const ruleDecls = (src, selector) => {
  const esc = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const body = new RegExp(`${esc}\\s*\\{([^}]*)\\}`).exec(src)?.[1] ?? '';
  const map = {};
  for (const decl of body.split(';')) {
    const i = decl.indexOf(':');
    if (i < 0) continue;
    map[decl.slice(0, i).trim()] = decl.slice(i + 1).trim();
  }
  return map;
};

/** The specificity of a simple selector, as the one number that decides a
 *  cascade between two rules in the same sheet: the COUNT OF CLASSES. Both
 *  selectors here are class-only (`.edge-label`, `.edge-label.selected`), so the
 *  real weights are (0,1,0) and (0,2,0) and their classes are 1 and 2. */
const classWeight = selector => (selector.match(/\./g) ?? []).length;

/** What a `var(--x, <fallback>)` chain resolves to when its token is UNSET —
 *  one level, which is all this sheet uses for these two properties. */
const unresolved = value => (value ?? '').replace(/var\(\s*--[a-z0-9-]+\s*,\s*([^()]*(?:\([^()]*\))?[^()]*)\)/g, '$1').trim();

/** The winner of the `color` property for a SELECTED label, from the two rules
 *  that can write it, by the only rule the cascade uses here: specificity. */
const colourWinner = src => {
  const writers = [
    {sel: '.edge-label', v: ruleDecls(src, '.edge-label').color},
    {sel: '.edge-label.selected', v: ruleDecls(src, '.edge-label.selected').color},
  ].filter(w => typeof w.v === 'string' && w.v.length > 0)
    .map(w => ({...w, w: classWeight(w.sel)}))
    .sort((a, b) => b.w - a.w);
  return writers[0] ?? {sel: '(none)', v: '(none)', w: 0};
};

/** The `<svg>` the glyph row builds, as numbers: its viewBox size, the width the
 *  sheet gives it, the scale applied to the glyph, and the stroke declared. */
const glyphFrame = appSrc => {
  const block = sliceBlock(appSrc, 'const FLOW_ICON_OPTS');
  const dims = /viewBox="0 0 (\d+) (\d+)"/.exec(block);
  const width = /width=\{(\d+(?:\.\d+)?)\}/.exec(block) ?? /width="(\d+)"/.exec(block);
  const scale = /const FLOW_GLYPH_SCALE = (\d+(?:\.\d+)?) \/ (\d+(?:\.\d+)?)/.exec(appSrc);
  /* the DECLARED stroke, in the glyph's own coordinate system (pre-scale) */
  const stroke = /strokeWidth=\{(\d+(?:\.\d+)?) \/ FLOW_GLYPH_SCALE\}/.exec(block);
  const s = scale ? Number(scale[1]) / Number(scale[2]) : 1;
  const declared = stroke ? Number(stroke[1]) / s : null;
  return {
    block,
    unitW: dims ? Number(dims[1]) : null,
    unitH: dims ? Number(dims[2]) : null,
    declared: width ? Number(width[1]) : null,
    scale: s,
    /* the stroke the browser PAINTS, in frame units: a declared stroke is in the
       local system, so the group's scale multiplies it — which is exactly why
       `stroke-width` is divided by the scale in the source. */
    strokeUnits: declared === null ? null : declared * s,
    sharesClass: /className="insp-glyph"/.test(block),
    glyphInk: 20,   // the 24×24 grid's own ink spans 2..22 — see below
  };
};

/** Slice from a marker to that statement's own end. `FLOW_ICON_OPTS` is
 *  `(([ … ] as const)).map(…)`, which does not balance on parens alone, so the
 *  end is its closing `}));` — a fixed-length window runs into the NEXT options
 *  table, which legitimately carries `art: null` (ROUND AM's own reported bug). */
const sliceBlock = (src, marker) => {
  const i = src.indexOf(marker);
  if (i < 0) return '';
  const end = src.indexOf('}));', i);
  return end > i ? src.slice(i, end + 4) : '';
};

/** The flow row's own figure, from `ArtFlow`'s `G` wrapper: a 26×18 frame whose
 *  figure spans x=2 → x=24 at `strokeWidth 2`. */
const flowFrame = picksSrc => {
  const g = /viewBox="0 0 (\d+) (\d+)"/.exec(picksSrc);
  const art = picksSrc.slice(picksSrc.indexOf('export const ArtFlow'), picksSrc.indexOf('export const ArtCurve'));
  return {
    unitW: g ? Number(g[1]) : null,
    unitH: g ? Number(g[2]) : null,
    ink: 22,            // 2 → 24, the span ArtFlow's figures occupy
    /* `ArtFlow` declares its strokes with DOUBLE quotes (`strokeWidth="2"`), so
       the quote form has to be accepted — a braces-only pattern reads this as 0
       and would make the stroke parity below fail on a correct tree. */
    stroke: Number((/strokeWidth=\{?["']?(\d+(?:\.\d+)?)/.exec(art) ?? [])[1] ?? 0),
  };
};

const chipSvgBox = stylesSrc => {
  const m = /\.chip svg \{\s*width:\s*(\d+)px;\s*height:\s*(\d+)px/.exec(stylesSrc);
  return m ? Number(m[1]) : null;
};

const AN_APP = 'src/App.tsx';
const AN_EDGE = 'src/GoblinEdge.tsx';
const AN_PICKS = 'src/InspectorPickers.tsx';
const AN_STYLES = 'src/styles.css';
const AN_ICONS = 'src/flowIcons.tsx';

const APP = code(AN_APP);
const EDGE = code(AN_EDGE);
const PICKS = code(AN_PICKS);
const STYLES = code(AN_STYLES);

console.log('='.repeat(78));
console.log('ROUND AN, AN-3…AN-6 — the edge panel: glyph frame, rail, undo, colours');
console.log('='.repeat(78));
console.log(`root: ${ROOT}`);
console.log(`node: ${process.version}`);
console.log(`pre-change tree (negative control): ${PRE_COMMIT}`);

/* ===========================================================================
   AN-3 — the flow-glyph figures and the flow row draw in ONE frame.
   =========================================================================== */
section('AN-3 — the flow-glyph row draws in the flow row\'s own frame');

{
  const gf = glyphFrame(APP);
  const ff = flowFrame(PICKS);
  const box = chipSvgBox(STYLES);

  /* (a) THE FRAME ITSELF, and the class that carries it. `insp-glyph` is the
   *     class `G` renders, so this is not a lookalike frame: it is the row's. */
  const sameFrame = gf.unitW === ff.unitW && gf.unitH === ff.unitH;
  assert('an3.the-glyph-row-declares-the-SAME-frame-and-class-as-the-flow-row',
    sameFrame && gf.sharesClass && ff.unitW === 26 && ff.unitH === 18,
    `the glyph row's \`<svg>\` is viewBox 0 0 ${gf.unitW} ${gf.unitH} and the flow row's \`G\` wrapper is ` +
    `viewBox 0 0 ${ff.unitW} ${ff.unitH} — equal = ${sameFrame}; the glyph row also carries the shared ` +
    `\`insp-glyph\` class = ${gf.sharesClass}, which is the class \`G\` itself renders, so the two rows' figures ` +
    `are carried by the same box rather than by two that happen to look alike.`);

  /* (b) THE ARITHMETIC, EXECUTED OVER PARSED SOURCE. The figures must land on the
   *     same pixel span AND the same painted stroke, in the box the sheet gives
   *     BOTH `<svg>`s (`.chip svg`, 15px — the chip box itself is not touched by
   *     this item). Printed as numbers: this is the parity the owner asked for. */
  const glyphSpanPx = (gf.glyphInk * gf.scale / gf.unitW) * box;
  const flowSpanPx = (ff.ink / ff.unitW) * box;
  const glyphStrokePx = (gf.strokeUnits / gf.unitW) * box;
  const flowStrokePx = (ff.stroke / ff.unitW) * box;
  const spanParity = Math.abs(glyphSpanPx - flowSpanPx) < 0.05;
  const strokeParity = Math.abs(glyphStrokePx - flowStrokePx) < 0.05;
  assert('an3.the-two-rows-figures-and-strokes-land-on-the-SAME-pixels',
    spanParity && strokeParity && gf.scale === 1.1 && gf.strokeUnits === ff.stroke,
    `both SVGs are sized by \`.chip svg\` to ${box}px, so one frame unit is 15/26 = 0.577px in each. The glyph ` +
    `figure: its 24-unit grid's own ink spans 2..22 = ${gf.glyphInk} units, scaled by ${gf.scale} = ` +
    `${(gf.glyphInk * gf.scale).toFixed(1)} units → ${glyphSpanPx.toFixed(2)}px with a ` +
    `${glyphStrokePx.toFixed(2)}px stroke (declared ${(gf.strokeUnits / gf.scale).toFixed(3)} × scale ${gf.scale} = ` +
    `${gf.strokeUnits} frame units). The flow row's figure: ${ff.ink} units → ${flowSpanPx.toFixed(2)}px with a ` +
    `${flowStrokePx.toFixed(2)}px stroke. Equal figure = ${spanParity}, equal stroke = ${strokeParity}. The scale ` +
    `is frame-span ÷ the glyph's own INK span (22/20), NOT 22/24: dividing by the grid would make this row's ` +
    `figures smaller than the row above it.`);

  /* (c) THE GLYPHS ARE STILL THE SAME SIX, from the ONE map, and the frame they
   *     are drawn in no longer has a private copy of the glyphs' geometry. */
  const keys = [...gf.block.matchAll(/\['([a-z]+)', '/g)].map(m => m[1]);
  const mapKeys = Object.keys(
    Object.fromEntries([...code(AN_ICONS).matchAll(/^\s{2}([a-z]+):\s/gm)].map(m => [m[1], 1])));
  const allFromMap = /FLOW_ICON_PATHS\[v\]/.test(gf.block);
  const stillUnique = keys.length === 6 && new Set(keys).size === 6;
  assert('an3.the-six-glyphs-are-unchanged-and-still-come-from-the-one-map',
    stillUnique && allFromMap && keys.every(k => mapKeys.includes(k)),
    `the row lists six distinct keys [${keys.join(', ')}] = ${stillUnique}, each rendered from ` +
    `\`FLOW_ICON_PATHS[v]\` = ${allFromMap}, and every one of them is a key of \`src/flowIcons.tsx\` ` +
    `[${mapKeys.join(', ')}] = ${keys.every(k => mapKeys.includes(k))}. The glyph PATHS did not change: only the ` +
    `frame and the scale that carry them did, which is the whole item.`);

  /* (d) THE OLD PRIVATE FRAME IS GONE — read with comments BLANKED, because AN-3's
   *     own note QUOTES the deleted `24 24`/`15` frame. A comment-quoting probe
   *     would read the explanation as the defect. */
  const noLegacyFrame = !/viewBox="0 0 24 24"/.test(gf.block) && !/width=\{15\}/.test(gf.block);
  assert('an3.the-private-24x24-15px-frame-is-gone-from-the-glyph-row',
    noLegacyFrame,
    `the row's block (${gf.block.length} chars, sliced to its own \`}));\`) contains no \`viewBox="0 0 24 24"\` and ` +
    `no \`width={15}\` = ${noLegacyFrame}. Comments are blanked BEFORE this probe, and that matters here more than ` +
    `anywhere: this project deletes a control and leaves a comment quoting it, so a probe run against raw text ` +
    `would find the deleted frame inside the sentence that explains its deletion.`);

  /* (e) THE CHIP BOX IS UNCHANGED AND THE ROW STILL WRAPS ON ITS OWN. The owner
   *     asked for the FIGURE's size, not a bigger button, and a row that no longer
   *     fits must drop to a second line without a new rule. */
  const chip = ruleDecls(STYLES, '.chip.ic');
  const chips = ruleDecls(STYLES, '.chips');
  assert('an3.the-chip-box-stays-30x30-and-the-row-still-wraps-with-no-new-rule',
    chip.width === '30px' && chip.height === '30px' && chips['flex-wrap'] === 'wrap',
    `\`.chip.ic\` is still width ${chip.width} / height ${chip.height} — the button was NOT enlarged, because the ` +
    `complaint is the figure's weight — and \`.chips\` still declares \`flex-wrap: ${chips['flex-wrap']}\`, which is ` +
    `the row's own class (\`chipRow\` renders \`<div className="chips">\`). So six chips that no longer fit wrap ` +
    `onto a second line with no rule added for this round: verified in the sheet rather than assumed.`);
}

/* ===========================================================================
   AN-4 — the FlowRail is DELETED and the printed value survives it.
   =========================================================================== */
section('AN-4 — the FlowRail is deleted, the printed speed value stays');

{
  const railGone = !/export function FlowRail\(/.test(PICKS) && !/<FlowRail/.test(APP);
  const railRulesGone = !/flow-rail/.test(STYLES);
  const stillPrints = /className="speedval"/.test(PICKS) && /\{seconds\.toFixed\(1\)\}s/.test(PICKS);
  const stillWired = /<FlowSpeed[\s\S]{0,200}value=\{eFlowSpeed\}/.test(APP)
    && /onInput=\{secs => updateEdge\(\{data: \{flowDuration: secs\}\}/.test(APP);
  assert('an4.the-rail-is-deleted-everywhere-and-the-speed-value-is-still-printed',
    railGone && railRulesGone && stillPrints && stillWired,
    `\`FlowRail\` is absent from the component and from App = ${railGone}, the sheet declares no \`flow-rail\` rule ` +
    `at all = ${railRulesGone}, and the read-out is the live subject that stayed: \`.speedval\` prints ` +
    `\`{seconds.toFixed(1)}s\` = ${stillPrints} while App still drives \`FlowSpeed\` from \`eFlowSpeed\` and writes ` +
    `\`data.flowDuration\` = ${stillWired}. The removal is the first half, and it is what makes this probe RED on ` +
    `the pre-change tree; the second half is true on BOTH trees and is declared as such rather than sold as a kill.`);

  /* The deletion is RECORDED, not merely performed — this project's comments are
   * its design record, and a removal with no note is how a "helpful" preview gets
   * re-added by the next round. */
  const reasonPicks = /AN-4[\s\S]{0,600}Flow rail/i.test(read(AN_PICKS));
  const reasonStyles = /AN-4[\s\S]{0,600}FLOW RAIL/i.test(read(AN_STYLES));
  const reasonApp = /AN-4[\s\S]{0,600}RAIL WAS DELETED HERE/.test(read(AN_APP));
  assert('an4.the-removal-is-recorded-in-the-code-with-its-reason',
    reasonPicks && reasonStyles && reasonApp,
    `the reason is written where the component was = ${reasonPicks}, where its CSS was = ${reasonStyles}, and where ` +
    `it was rendered = ${reasonApp}. Each note names the owner's own sentence and says what STAYED (the printed ` +
    `seconds), so a later round can see why there is no preview here without re-deriving the idea.`);

  /* The motion gate went with the animation it gated, and the project's two REAL
   * switches survive for the payloads that are still moving. */
  const noRailGate = !/flow-rail/.test(STYLES);
  const gatesIntact = /prefers-reduced-motion:\s*reduce/.test(STYLES) && /\.ds-no-anim/.test(STYLES);
  assert('an4.the-motion-gate-went-with-the-animation-and-the-real-switches-survive',
    noRailGate && gatesIntact,
    `no \`flow-rail-bead\` rule is left to stop = ${noRailGate}, while the project's two motion switches still exist ` +
    `for the canvas payloads = ${gatesIntact}. Both halves matter: a gate for a deleted animation is dead CSS that ` +
    `reads as live policy, and deleting the gate for everything else would be the opposite defect.`);
}

/* ===========================================================================
   AN-5 — undo/redo keep the LIVE selection.
   =========================================================================== */
section('AN-5 — undo and redo keep the selection');

{
  const liveFn = /const liveSelection = useCallback\(\(\) => \(\{/.test(APP)
    && /nodesRef\.current\.filter\(n => n\.selected\)\.map\(n => n\.id\)/.test(APP)
    && /edgesRef\.current\.filter\(e => e\.selected\)\.map\(e => e\.id\)/.test(APP);
  const survivorOnly = /const nKeep = new Set\(live\.nodes\.filter\(id => nodeIds\.has\(id\)\)\)/.test(APP)
    && /const eKeep = new Set\(live\.edges\.filter\(id => edgeIds\.has\(id\)\)\)/.test(APP);
  const reApplied = /setNodes\([\s\S]{0,60}selected: nKeep\.has\(n\.id\)/.test(APP)
    && /setEdges\([\s\S]{0,60}selected: eKeep\.has\(e\.id\)/.test(APP);
  assert('an5.the-live-selection-is-captured-and-re-applied-only-to-survivors',
    liveFn && survivorOnly && reApplied,
    `\`liveSelection()\` reads \`selected\` off the LIVE nodes and edges = ${liveFn}; \`applySelection\` keeps an id ` +
    `only when the RESTORED graph still contains it = ${survivorOnly}; and the restore writes \`selected\` from that ` +
    `survivor set = ${reApplied}. That last clause is the edge case in the item: undoing a CREATE must clear the ` +
    `selection, because the selected entity is no longer in the graph.`);

  const undoCalls = /const undo = useCallback\(\(\) => \{[\s\S]{0,400}applySelection\(prev\.nodes, prev\.edges, live\)/.test(APP);
  /* a WIDER window for redo: its note between the `useCallback` and the call is
     longer than undo's, so a 400-char window stopped short of the call itself */
  const redoCalls = /const redo = useCallback\(\(\) => \{[\s\S]{0,900}applySelection\(next\.nodes, next\.edges, live\)/.test(APP);
  const noVerbatimRestore = !/setNodes\(prev\.nodes\)/.test(APP) && !/setNodes\(next\.nodes\)/.test(APP);
  assert('an5.both-undo-and-redo-apply-it-and-neither-restores-the-snapshot-verbatim',
    undoCalls && redoCalls && noVerbatimRestore,
    `undo calls \`applySelection(prev.nodes, prev.edges, live)\` = ${undoCalls}, redo calls it with \`next\` = ` +
    `${redoCalls}, and no \`setNodes(prev.nodes)\` / \`setNodes(next.nodes)\` verbatim restore is left = ` +
    `${noVerbatimRestore}. The verbatim restore is the MEASURED cause: the snapshot normalises \`selected: false\`, ` +
    `so the controlled \`onSelectionChange\` then saw an empty selection and blanked \`selEdgeId\`.`);

  /* The three UI states are DERIVED from what survived, in the same SHAPE the
     selection callback uses — so the inspector cannot disagree with the canvas. */
  const derived = /setSel\(keptNodes\[0\] \?\? null\)/.test(APP)
    && /setSelCount\(keptNodes\.length\)/.test(APP)
    && /setSelEdgeId\(keptEdges\.length === 1 \? keptEdges\[0\] : null\)/.test(APP);
  const callbackShape = /setSelEdgeId\(se\.length === 1 \? se\[0\]\.id : null\)/.test(APP);
  assert('an5.sel-selCount-selEdgeId-are-derived-in-the-callbacks-own-shape',
    derived && callbackShape,
    `\`applySelection\` writes \`sel\` / \`selCount\` / \`selEdgeId\` from the survivors = ${derived}, using the same ` +
    `expression shapes as React Flow's own \`onSelectionChange\` (\`se.length === 1 ? se[0].id : null\`) = ` +
    `${callbackShape}. Deriving them means the callback fired by this very restore agrees with them instead of ` +
    `overwriting them with an empty selection.`);

  /* The SNAPSHOT keeps `selected: false`: the fix is that the LIVE selection
     survives, not that a stale one is replayed. */
  const snapshotClean = /edges: edgesRef\.current\.map\(e => \(\{\.\.\.e, selected: false\}\)\)/.test(APP)
    && /data: \{\.\.\.\(n\.data as any\)\}, selected: false,/.test(APP);
  assert('an5.the-snapshot-still-normalises-selected-false',
    snapshotClean,
    `\`snapshot()\` still maps every edge to \`{...e, selected: false}\` and every node to \`selected: false\` = ` +
    `${snapshotClean}. Left in place deliberately: history must never replay a selection captured twenty edits ago. ` +
    `The fix is the LIVE selection surviving the restore, and this probe is what stops a later round "simplifying" ` +
    `the fix into the snapshot, which would reintroduce stale-selection replay instead of curing the defect.`);
}

/* ===========================================================================
   AN-6a — a selected label may not overwrite its authored colour.
   =========================================================================== */
section('AN-6a — the selected label keeps the authored colour');

{
  const base = ruleDecls(STYLES, '.edge-label');
  const sel = ruleDecls(STYLES, '.edge-label.selected');
  const winner = colourWinner(STYLES);
  const authored = /^var\(--label-fg/.test(base.color ?? '');
  const noOverride = sel.color === undefined;
  const ringKept = sel['border-color'] === 'var(--sel)';
  assert('an6a.the-selected-state-keeps-the-ring-and-stops-writing-color',
    noOverride && ringKept && authored && /^var\(--label-fg/.test(winner.v),
    `\`.edge-label.selected\` now declares \`border-color: ${sel['border-color']}\` and NO \`color\` at all = ` +
    `${noOverride}; the base rule's \`color\` is \`${base.color}\` = ${authored}; and the cascade WINNER for a ` +
    `selected label is therefore \`${winner.sel}\` → \`${winner.v}\` (class weight ${winner.w}), i.e. the authored ` +
    `colour reaches the paint. The selection stays VISIBLE because the ring — the chrome that carries no authored ` +
    `meaning — was left exactly as it was: that is the ROUND AK answer for the edge stroke, applied here.`);

  /* THE PARITY HALF, and it is GREEN ON BOTH TREES BY CONSTRUCTION: an UNSELECTED
     label never matched the deleted rule, and the base rule's own declarations are
     untouched. Printed as a separate PASS with its NOTE so it is not read as a
     kill — the item's kill is the assertion above. */
  const unselectedSame = authored && base.background === 'var(--surface)'
    && base['font-size'] === 'calc(11px * var(--ts-scale, 1))';
  note('an6.unselected-label-parity — GREEN ON BOTH TREES BY CONSTRUCTION (it asserts nothing changed).');
  assert('an6.an-UNSELECTED-label-still-paints-the-pre-change-declarations',
    unselectedSame,
    `the base \`.edge-label\` rule still declares \`color: ${base.color}\`, \`background: ${base.background}\`, ` +
    `\`font-size: ${base['font-size']}\` = ${unselectedSame}. AN-6a removed a declaration from the SELECTED rule ` +
    `only, so an unselected label matches the same rules it always did; this probe cannot go RED at ${PRE_COMMIT} ` +
    `and is therefore excluded from the replay's kill list, by name, below.`);

  /* AN-6a must not have been "fixed" by deleting the selected state outright: the
     ring is what tells the user which label the panel is editing. */
  const ringWasThereBefore = /border-color:\s*var\(--sel\)/.test(
    blankComments(commitFile(PRE_COMMIT, AN_STYLES)).slice(0, 1 << 20));
  assert('an6a.the-selection-signal-existed-before-and-still-does',
    ringKept && ringWasThereBefore,
    `the pre-change tree already ringed the selected label in \`var(--sel)\` = ${ringWasThereBefore}, and the fixed ` +
    `sheet still does = ${ringKept}. This is the anti-regression guard for the obvious wrong fix: deleting ` +
    `\`.edge-label.selected\` entirely would also have made the panel's colour truthful while removing the only ` +
    `marker of WHICH label is being edited.`);
}

/* ===========================================================================
   AN-6b — the plate colour finally has a consumer.
   =========================================================================== */
section('AN-6b — the plate colour is applied, with the token as the fallback');

{
  const plate = ruleDecls(STYLES, '.edge-label.lb-surface');
  const outline = ruleDecls(STYLES, '.edge-label.lb-outline');
  const none = ruleDecls(STYLES, '.edge-label.lb-none');
  const emitters = (STYLES.match(/var\(\s*--label-plate\b/g) ?? []);
  const withFallback = /^var\(\s*--label-plate\s*,\s*var\(--surface\)\s*\)$/.test(plate.background ?? '');
  const outlineFallback = /^var\(\s*--label-plate\s*,\s*transparent\s*\)$/.test(outline.background ?? '');
  const edgeEmits = /'--label-plate': labelBgColor/.test(EDGE);
  assert('an6b.the-sheet-reads-label-plate-in-BOTH-states-that-offer-a-colour-and-the-renderer-emits-it',
    emitters.length === 2 && withFallback && outlineFallback && edgeEmits,
    `the sheet now has ${emitters.length} \`--label-plate\` consumers: \`surface\` → \`${plate.background}\` (token ` +
    `first, \`var(--surface)\` as the FALLBACK = ${withFallback}) and \`outline\` → \`${outline.background}\` (token ` +
    `first, \`transparent\` as its fallback = ${outlineFallback}); \`GoblinEdge\` still emits the stored colour as the ` +
    `inline custom property = ${edgeEmits}. TWO, not one, because the panel offers the SAME \`background color\` row ` +
    `for both (\`eLabelBg !== 'none'\`): fixing only \`surface\` would have left the swatch a no-op one state over. ` +
    `Before this item the count of consumers was ZERO — the panel wrote a key nothing read, the sixth instance in ` +
    `this project of a value that is emitted and never applied.`);

  /* UNTOUCHED-BOARD PARITY, COMPUTED, FOR BOTH STATES: with nothing stored each
     new expression must resolve to exactly the value that rule declared before. */
  const preRule = (() => {
    try {
      const pre = blankComments(commitFile(PRE_COMMIT, AN_STYLES));
      return {
        surface: ruleDecls(pre, '.edge-label.lb-surface'),
        outline: ruleDecls(pre, '.edge-label.lb-outline'),
        none: ruleDecls(pre, '.edge-label.lb-none'),
      };
    } catch { return {surface: {}, outline: {}, none: {}}; }
  })();
  const surfaceParity = unresolved(plate.background) === preRule.surface.background
    && preRule.surface.background === 'var(--surface)';
  const outlineParity = unresolved(outline.background) === preRule.outline.background
    && preRule.outline.background === 'transparent';
  const noneUntouched = /^transparent$/.test(none.background ?? '');
  assert('an6b.with-nothing-stored-EVERY-plate-resolves-to-its-pre-change-value',
    surfaceParity && outlineParity && noneUntouched,
    `surface: pre-change \`${preRule.surface.background}\`, fixed \`${plate.background}\`, resolves with the token ` +
    `UNSET to \`${unresolved(plate.background)}\` = ${surfaceParity}. outline: pre-change ` +
    `\`${preRule.outline.background}\`, fixed \`${outline.background}\`, resolves to ` +
    `\`${unresolved(outline.background)}\` = ${outlineParity}. none is left with its own ` +
    `\`background: ${none.background}\` = ${noneUntouched} — it is "no plate at all" and it carries the ` +
    `canvas-coloured halo. Computed from the COMMITTED pre-change rules rather than restated, so "an untouched ` +
    `board paints exactly what it painted" is a measured equivalence and not a promise.`);
}

/* ===========================================================================
   THE REPLAY — every SOURCE probe re-run over the PINNED pre-change tree.
   =========================================================================== */
section(`REPLAY (negative control) — the source probes over ${PRE_COMMIT}`);

let pre = null;
try {
  pre = {
    APP: codeAt(PRE_COMMIT, AN_APP),
    EDGE: codeAt(PRE_COMMIT, AN_EDGE),
    PICKS: codeAt(PRE_COMMIT, AN_PICKS),
    STYLES: codeAt(PRE_COMMIT, AN_STYLES),
  };
} catch (err) {
  console.log(`  FAIL  the pre-change tree could not be read from ${PRE_COMMIT}: ${err.message}`);
  failures++;
}

if (pre) {
  const preGlyphSpan = (() => {
    const gf = glyphFrame(pre.APP);
    const box = chipSvgBox(pre.STYLES);
    return {gf, box, spanPx: (gf.glyphInk * gf.scale / gf.unitW) * box};
  })();

  /* EVERY entry below MUST be RED at the pre-change tree. The AN-6a selected
   * colour, the AN-6b consumer and the AN-3 frame are the ones that fire; the
   * AN-5 and AN-4 predicates are about code that did not exist / a component that
   * still did. */
  const KILLS = [
    ['AN-3 · the glyph row declares the flow row\'s 26×18 frame',
      (() => { const gf = glyphFrame(pre.APP); return gf.unitW === 26 && gf.unitH === 18; })()],
    ['AN-3 · the glyph row carries the shared `insp-glyph` class',
      glyphFrame(pre.APP).sharesClass],
    ['AN-3 · a scale correction exists at all',
      /FLOW_GLYPH_SCALE/.test(pre.APP)],
    ['AN-3 · the two rows\' figures land on the same pixels',
      Math.abs(preGlyphSpan.spanPx - (22 / 26) * preGlyphSpan.box) < 0.05],
    ['AN-3 · the private 24×24 / 15px frame is gone',
      !/viewBox="0 0 24 24"/.test(sliceBlock(pre.APP, 'const FLOW_ICON_OPTS'))],
    ['AN-4 · the rail is DELETED from the component and from App',
      !/export function FlowRail\(/.test(pre.PICKS) && !/<FlowRail/.test(pre.APP)],
    ['AN-4 · the sheet declares no `flow-rail` rule',
      !/flow-rail/.test(pre.STYLES)],
    ['AN-4 · the removal note is present in the component',
      /AN-4[\s\S]{0,600}Flow rail/i.test(commitFile(PRE_COMMIT, AN_PICKS))],
    ['AN-5 · the live selection is captured before the restore',
      /const liveSelection = useCallback/.test(pre.APP)],
    ['AN-5 · the restore re-applies `selected` to survivors',
      /applySelection\(prev\.nodes, prev\.edges, live\)/.test(pre.APP)],
    ['AN-6a · the selected rule declares NO `color`',
      ruleDecls(pre.STYLES, '.edge-label.selected').color === undefined],
    ['AN-6a · the cascade winner for a selected label is the authored colour', /^var\(--label-fg/
      .test(colourWinner(pre.STYLES).v)],
    ['AN-6b · the sheet consumes `--label-plate` in the surface state',
      /^var\(\s*--label-plate\s*,\s*var\(--surface\)\s*\)$/
        .test(ruleDecls(pre.STYLES, '.edge-label.lb-surface').background ?? '')],
    ['AN-6b · the sheet consumes `--label-plate` in the outline state',
      /^var\(\s*--label-plate\s*,\s*transparent\s*\)$/
        .test(ruleDecls(pre.STYLES, '.edge-label.lb-outline').background ?? '')],
  ];
  const greenOnPre = [];
  for (const [id, bad] of KILLS) {
    if (bad) greenOnPre.push(id);
    console.log(`  ${bad ? 'GREEN (proves NOTHING)' : 'RED  '}  ${id}`);
  }
  assert('replay.every-source-probe-REALLY-detects-the-change-it-claims',
    greenOnPre.length === 0,
    greenOnPre.length === 0
      ? `all ${KILLS.length} source probes are RED at ${PRE_COMMIT} and GREEN on the working tree, so each one ` +
        `measures AN-3…AN-6 rather than a claim that happened to be true before this round too. The AN-6 ` +
        `unselected-label parity claim is deliberately NOT in this list: it asserts that nothing changed and is ` +
        `therefore green on both trees, which is why it is printed above with a NOTE instead of a kill.`
      : `${greenOnPre.length} probe(s) are GREEN on the pre-change tree and therefore prove NOTHING: ` +
        `${greenOnPre.join(' · ')}. A probe whose condition already held cannot be evidence that this round ` +
        `changed it — fix the probe or drop the claim.`);

  /* The measured pre-change numbers, printed so the kill above is auditable
   * rather than asserted: the same figures AN-3's parity claim now equates. */
  console.log(`\n  pre-change glyph frame: viewBox 0 0 ${preGlyphSpan.gf.unitW} ${preGlyphSpan.gf.unitH}, ` +
    `declared width ${preGlyphSpan.gf.declared}, scale ${preGlyphSpan.gf.scale}, ` +
    `resolved ${preGlyphSpan.spanPx.toFixed(2)}px in the ${preGlyphSpan.box}px box the sheet gives every chip svg`);
  console.log(`  fixed-tree glyph frame: the same 26×18 frame the flow row uses, ` +
    `${((20 * (22 / 20) / 26) * chipSvgBox(STYLES)).toFixed(2)}px in the same ${chipSvgBox(STYLES)}px box`);

  /* the flowIcons module is the same file on both trees — the glyphs were not
   * touched, which is part of AN-3's claim and is cheap to check. */
  const iconsSame = (() => {
    try { return commitFile(PRE_COMMIT, AN_ICONS) === read(AN_ICONS); } catch { return false; }
  })();
  assert('replay.the-glyph-paths-themselves-are-untouched-by-this-round',
    iconsSame,
    `\`src/flowIcons.tsx\` is byte-identical between ${PRE_COMMIT} and the working tree = ${iconsSame}. AN-3 changed ` +
    `the FRAME, the scale and the stroke that carry the figures; not one \`d\` moved, which is what this compares.`);
}

console.log('\n' + '='.repeat(78));
console.log(failures === 0
  ? 'ROUND AN EDGE-PANEL HARNESS: all checks passed'
  : `ROUND AN EDGE-PANEL HARNESS: ${failures} FAILURE(S)`);
console.log('='.repeat(78));
process.exit(failures === 0 ? 0 : 1);
