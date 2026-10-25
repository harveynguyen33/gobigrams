#!/usr/bin/env node
/**
 * ROUND AK, AK-9 — the edge panel after PASS 1.
 *
 * WHAT THIS FILE IS. A source-text harness for the eleven AK-1..AK-8 changes,
 * with the round's own negative control built in (see the REPLAY section at the
 * bottom). It does NOT claim to see a browser: no CDP, no headless Chrome, no
 * screenshot. Every claim is either
 *   (1) a TEXT read of the shipped source with COMMENTS BLANKED FIRST, or
 *   (2) a RULE read of `src/styles.css` — the sheet is parsed into
 *       selector/body pairs so a declaration is found wherever it sits in a
 *       selector list, and a prose brace is never mistaken for a rule.
 *
 * WHY COMMENTS ARE BLANKED BEFORE EVERY COUNT (this project's own rule, and the
 * reason each of AK-2/AK-3/AK-4/AK-8 is a real check). AK-1, AK-3, AK-4 and
 * AK-8 all leave an explanatory comment IN PLACE of the code they delete, and
 * those comments quote the very strings the checks below assert are gone —
 * "label position", "animated (dash on the line)", "intent label", "presetId".
 * A raw substring count would therefore read a CORRECT tree as a defect, and
 * would pass a tree that kept the control and merely described it. Blanking
 * (rather than stripping) keeps every byte offset and every line number true, so
 * the reported line is the line the code is on.
 *
 * WHY THE PREDICATES ARE FUNCTIONS OF A SOURCE BUNDLE. The same probe must be
 * runnable over the PRE-CHANGE tree, or the negative control is theatre. Each
 * assertion below therefore reads a `src` bundle, and `bundleOf()` builds one
 * either from the working tree (default) or from the pinned pre-ROUND-AK commit
 * (`DS_PRE_COMMIT`, see REPLAY).
 *
 * WHAT IT CANNOT DO: it cannot prove the panel PAINTS correctly, that a popover
 * opens, or that the selection overlay is on screen. Those are the orchestrator's
 * live pass. This file asserts the source and the sheet.
 *
 * DS_ROOT overrides the project root (used by the replay and by a future pass
 * that wants to point it at an archived tree).
 */
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';

const ROOT = process.env.DS_ROOT || '/home/harvey/projects/tech-goblin/lab/diagram-studio';

/* The commit ROUND AK PASS 1 was built on — the tree the negative control
 * measures against. PINNED, not `HEAD`: once this round is committed, `HEAD` IS
 * the fixed tree and a `HEAD`-based control would compare the fix with itself. */
const PRE_COMMIT = process.env.DS_PRE_COMMIT || '90edd6c22d76b185d09d01c7643ade3b9a191e79';

/* ── ROUND AL — THE SECOND PIN, and it is not a convenience.
 *
 *  A re-anchored assertion must PRINT the old claim beside the new one, and the
 *  old claim is the one the assertion made on the tree where it last PASSED.
 *  `PRE_COMMIT` above is NOT that tree for this round: it is where the AK round
 *  started, BEFORE AK-6/AK-7 converted these rows at all. The tree AL changed
 *  from — the one the four reddened harnesses were green on — is ROUND AK's last
 *  commit, `f0b00aa`. So the old-claim text is read from HERE and the negative
 *  control keeps reading `PRE_COMMIT`; the two are different questions and are
 *  asked separately rather than conflated. (`round-ak2-label.mjs` pins its own
 *  module control the same way, for the same reason.) */
const PRE_AL_COMMIT = process.env.DS_PRE_AL_COMMIT || 'f0b00aa';

/* ---------- the comment blanker ---------- */
/** Blank block AND line comments to spaces, keeping length and newlines. A
 *  blanked file reports its real line numbers and cannot satisfy a substring
 *  probe with prose. `[^:]` before `//` keeps `https://` and a `var(--x)://`
 *  style token from being read as a comment start. */
const blankComments = s => s
  .replace(/\/\*[\s\S]*?\*\//g, m => m.replace(/[^\n]/g, ' '))
  .replace(/(^|[^:])\/\/[^\n]*/g, (m, p) => p + ' '.repeat(m.length - p.length));

/* ---------- the source bundle ---------- */
const FILES = ['src/App.tsx', 'src/GoblinEdge.tsx', 'src/inspector.ts',
  'src/presets.ts', 'src/InspectorPickers.tsx', 'src/styles.css'];

/** Read one file from the working tree (default) or from `commit` via git.
 *  A comment-blanked copy is attached, so a probe can choose. */
/* ROUND BN-4 — presets.ts split into src/presets/ (five slices, index.ts
   re-exports the union). A WORKING-TREE read of 'src/presets.ts' returns the
   FIVE SLICES CONCATENATED so `b.presets` keeps measuring the same surface;
   a `git show` read keeps the single file, which is what every pinned commit
   has — the REPLAY semantics are unchanged. */
function readOne(path, commit) {
  const raw = commit
    ? execFileSync('git', ['show', `${commit}:${path}`], {cwd: ROOT, encoding: 'utf8', maxBuffer: 1 << 28})
    : path === 'src/InspectorPickers.tsx'
      ? ['popover', 'art', 'rows', 'stepperFlow', 'section', 'shell'].flatMap(f => {
          try { return [readFileSync(`${ROOT}/src/${f === 'shell' ? 'InspectorPickers.tsx' : 'pickers/' + {popover: 'popover.ts', art: 'Art.tsx', rows: 'Rows.tsx', stepperFlow: 'StepperFlow.tsx', section: 'Section.tsx'}[f]}`, 'utf8')]; } catch { return []; }
        }).join('\n')
    : path === 'src/GoblinEdge.tsx'
      ? ['GoblinEdge', 'edgeData', 'flowPayloads', 'index']
          .map(f => readFileSync(`${ROOT}/src/edges/${f}${f === 'edgeData' || f === 'index' ? '.ts' : '.tsx'}`, 'utf8')).join('\n')
    : path === 'src/presets.ts'
      ? ['basic', 'flowchart', 'dataStorage', 'architecture', 'index']
          .map(f => readFileSync(`${ROOT}/src/presets/${f}.ts`, 'utf8')).join('\n')
      : readFileSync(`${ROOT}/${path}`, 'utf8');
  return {raw, code: blankComments(raw)};
}

/** The bundle every predicate below reads. `commit` omitted → working tree. */
function bundleOf(commit) {
  const b = {};
  for (const p of FILES) {
    const key = p.split('/').pop().replace(/\.[^.]+$/, '');
    b[key] = readOne(p, commit);
  }
  b.styles = b['styles'];
  return b;
}

/* ---------- the sheet, as rules ---------- */
/** Every `selector { body }` pair in a stylesheet, selector whitespace folded
 *  and a selector LIST kept intact. Comments must already be blanked, or a prose
 *  brace is read as a rule. */
const rulesOf = css => [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)]
  .map(m => ({sel: m[1].trim().replace(/\s+/g, ' '), body: m[2]}));
/** The declarations of a rule body, as {prop, value} — lowercased properties. */
const declsOf = body => body.split(';').map(s => s.trim()).filter(Boolean).map(d => {
  const i = d.indexOf(':');
  return i < 0 ? {prop: d.toLowerCase(), value: ''} : {prop: d.slice(0, i).trim().toLowerCase(), value: d.slice(i + 1).trim()};
});
/** Rules whose selector contains ALL of `parts`. */
const rulesWhere = (css, parts) => rulesOf(css).filter(r => parts.every(p => r.sel.includes(p)));
/** Rules whose selector contains all of `parts` AND whose body declares a
 *  property starting with `propPrefix`. */
const rulesWithProp = (css, parts, propPrefix) => rulesWhere(css, parts)
  .filter(r => declsOf(r.body).some(d => d.prop.startsWith(propPrefix)));

/* ---------- the panel's JSX, sliced ---------- */
/** The JSX literal handed to `secBody('<name>', …)` — from the marker to the
 *  NEXT `secBody(` call. Read from the comment-blanked source, so the slice is
 *  the code and not the note beside it. */
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
/** ── ROUND AL (AL-6) — THE SAME QUESTION FOR THE CHIP ROW.
 *
 *  `chipRow(table, …)` is a CALL, not a self-closing element, so `carrierOf`
 *  above cannot see it. This is its counterpart: it returns `'chipRow'` when the
 *  table is the FIRST argument of a `chipRow(` call — the position that owns the
 *  options — and `null` otherwise. Kept SEPARATE from `carrierOf` rather than
 *  folded into it so each probe can name the carrier family it measures. */
const chipCarrierOf = (appCode, table) => {
  for (const m of appCode.matchAll(/chipRow\(\s*(\w+)\s*,/g)) if (m[1] === table) return 'chipRow';
  return null;
};
/** A table token's alias, followed one step: `const DASH_ICON_OPTS = DASH_OPTS;`
 *  → `DASH_OPTS`. AL-6's chip rows hand `chipRow` the `_ICON_` alias of the same
 *  table `ToggleRow` used to receive, so "the conversion kept the SAME table" is
 *  a claim about this chain and not about the spelling at the call site. The
 *  type annotation is OPTIONAL — the `_ICON_` aliases are declared bare
 *  (`const DASH_ICON_OPTS = DASH_OPTS;`), unlike the typed tables beside them. */
const aliasOf = (appCode, name) => {
  const m = new RegExp(`const\\s+${name}\\s*(?::[^=;]*)?=\\s*(\\w+)\\s*;`).exec(appCode);
  return m ? m[1] : null;
};
/** Does `token` resolve to `target` through that alias chain (exact equality at
 *  every hop — `MARKER_OPTS` and `MARKER_OPTS_START` must NOT be confused)? */
const resolvesTo = (appCode, token, target) => {
  let cur = token;
  for (let i = 0; i < 5 && cur; i++) {
    if (cur === target) return true;
    cur = aliasOf(appCode, cur);
  }
  return false;
};

/* ---------- the assertion harness (house style) ---------- */
let failures = 0;
const assert = (id, cond, detail) => {
  if (cond) console.log(`  PASS  ${id}\n        ${detail}`);
  else { failures++; console.log(`  FAIL  ${id}\n        ${detail}`); }
};
const section = t => console.log(`\n${t}`);

/* ===========================================================================
   THE PROBES. Each is a pure predicate of a bundle, so the REPLAY at the
   bottom can run every one of them over the pre-change tree.
   =========================================================================== */
const P = {};

/* --- AK-1 (1): neither restroke rule survives --- */
P.noSelectedRestroke = src => rulesWithProp(src.styles.code, ['react-flow__edge.selected', 'react-flow__edge-path'], 'stroke').length === 0;
P.noElectricStrokeOverride = src => rulesWhere(src.styles.code, ['ds-electric', 'react-flow__edge-path'])
  .every(r => !declsOf(r.body).some(d => d.prop === 'stroke' && d.value.includes('!important')));
/* the check is not vacuous: the ADDITIVE replacement must be declared AND drawn.
 *
 * ── RE-ANCHORED BY ROUND AL (AL-1). OLD claim: `.edge-sel-overlay` was declared
 *    with a `stroke` in `src/styles.css` AND rendered by `src/GoblinEdge.tsx`.
 *    WHY THAT HAD TO CHANGE: the owner's device test rejected that element —
 *    a +5px `strokeDasharray="6 4"` halo reads as a fat dashed outline and fights
 *    the flow payload — so ROUND AL deleted BOTH the element and its rule and
 *    replaced them with option C: the body takes `var(--sel)` and the AUTHORED
 *    colour is preserved as a thin core (`.edge-sel-core`). The claim this
 *    assertion exists to make is unchanged — "no restroke, a replacement that is
 *    declared and drawn instead" — so it is re-anchored to the element that now
 *    carries it. The OLD claim is printed in the detail string beside the new
 *    one, and `checks/round-al-edge-panel.mjs` carries the AL-1 assertions
 *    (the dash and the +5 are gone, the core is 1.1px, an unselected edge renders
 *    one path) with their own negative control. */
const SELECTION_CLASS = 'edge-sel-core';
P.selectionCoreDeclared = src => new RegExp(`\\.${SELECTION_CLASS}\\s*\\{`).test(src.styles.code)
  && declsOf((new RegExp(`\\.${SELECTION_CLASS}\\s*\\{([^}]*)\\}`).exec(src.styles.code) ?? ['', ''])[1])
    .some(d => d.prop === 'pointer-events');
P.selectionCoreRendered = src => src.GoblinEdge.code.includes(SELECTION_CLASS)
  && new RegExp(`className=["']${SELECTION_CLASS}["']`).test(src.GoblinEdge.code);

/* --- AK-2/AK-3/AK-4 (2): the removed controls are gone ---
 *
 * ── RE-ANCHORED BY ROUND AK PASS 2 (Job A1). OLD claim: the bare substring
 *    `'label position'` had to be absent from `src/App.tsx`.
 *    WHY THAT HAD TO CHANGE: it was a SUBSTRING false positive. Pass 2 added a
 *    legitimate NEW control named `Reset label position` (App.tsx, AK-14.1), so
 *    the substring appeared on a CORRECT tree and reddened this file. A check
 *    that fires on the feature the round was asked to build is not a check.
 *    NEW claim, ANCHORED POSITIVELY to the deleted control's OWN code: the
 *    three needles below are the things that actually BUILT the removed
 *    `label position` row on the pre-change tree (verified verbatim at
 *    `90edd6c:src/App.tsx` lines 3302 / 3335 and its `onChange`):
 *      - `const eOffset = …`          the value readout that fed the row
 *      - `const OFFSET_OPTS`          the 3-button option table
 *      - `data: {offset: …}`          the row's write
 *    All three are checked in the CODE with comments blanked, so the AK-3 note
 *    that quotes them does not count as the control existing. A future pass that
 *    re-introduces the old field therefore still fails, while the new Reset
 *    button — which shares only the words "label position" — passes. */
const REMOVED_APP_STRINGS = ['intent label', 'animated (dash on the line)'];
/** The deleted `label position` row, by its own code rather than by its name. */
const REMOVED_OFFSET_NEEDLES = ['const eOffset', 'const OFFSET_OPTS', 'offset: v as'];
P.removedAppStrings = src => REMOVED_APP_STRINGS.every(s => !src.App.code.includes(s))
  && REMOVED_OFFSET_NEEDLES.every(s => !src.App.code.includes(s));

/* --- AK-8 (3): the deleted preset data --- */
P.presetDataGone = src => !src.presets.code.includes('labelPresets') && !src.presets.code.includes('C4_LABELS');

/* --- AK-8 (4): the gate reads the EDGE --- */
P.gateReadsEdge = src => src.inspector.code.includes('hasCrowFootEnds')
  && !src.inspector.code.includes("presetId === 'erd'");

/* --- AK-6 (5): the five style rows, their option counts, and their order ---
 *
 * ── RE-ANCHORED BY ROUND AL (AL-6). OLD claim: each of the five tables
 *    (`WIDTH_OPTS` / `DASH_OPTS` / `CURVE_OPTS` / `MARKER_OPTS` /
 *    `MARKER_OPTS_START`) is carried by `<ToggleRow/>`, the AK-6 segmented row,
 *    whose buttons are `o.art ?? o.label` and therefore always visible.
 *    WHY THAT HAD TO CHANGE: ROUND AL replaced the ToggleRow call sites in
 *    LINE / MARKERS / FLOW with ONE chip system, `chipRow` (AL-6, the owner's
 *    "lúc to, lúc dài, lúc nhỏ" measurement). `<ToggleRow/>` still exists and is
 *    still used — the Text section and the body switch keep it — but the five
 *    rows below are now `chipRow(` CALLS, so an element-shaped probe finds
 *    nothing on the shipped tree.
 *    NEW claim: the AL-6 claim itself — each of the five rows is carried by
 *    `chipRow`, ONCE, with its option count and its position in the render
 *    order. It is NOT weakened to "any inline row" (which would be true on both
 *    trees and prove nothing); the replay at the bottom asserts it is RED at
 *    `f0b00aa`, where AK-6/AK-7 shipped these rows as `<ToggleRow/>`. The
 *    `_ICON_` alias is followed so `MARKER_OPTS` != `MARKER_OPTS_START`. */
/** ── THE AL-6 CARRIER, and why the claim must NAME `chipRow` rather than
 *  accept "any inline row".
 *
 *  The tempting re-anchor is to accept EITHER family (`<ToggleRow/>` OR
 *  `chipRow`) on the grounds that both are inline. That probe would be GREEN on
 *  the working tree AND GREEN on `f0b00aa` (where these rows were `ToggleRow`),
 *  so it would prove NOTHING about the change this pass exists to measure — the
 *  exact "a check that passes on both trees" failure this project has already
 *  paid for. The re-anchored claim is therefore the ACTUAL AL-6 claim — these
 *  rows are now carried by the ONE chip system — and it is RED at `f0b00aa`,
 *  where AK-6/AK-7 shipped them as `ToggleRow`.
 *
 *  THE INVARIANT IS NOT WEAKENED, only re-pointed: a `chipRow` renders every
 *  option as a button (`o.art ?? o.label`), so a regression to an
 *  `IconPickerRow` popover — the thing AK-6 removed — makes the carrier `null`
 *  and reddens this probe. That is asserted as `carrier === 'chipRow'`, which
 *  admits NOTHING else. */
const chipRowCarrierOf = (appCode, table) => {
  for (const m of appCode.matchAll(/chipRow\(\s*(\w+)\s*,/g)) {
    if (resolvesTo(appCode, m[1], table)) return 'chipRow';
  }
  return null;
};
/** Source line (1-based) of the `chipRow(` call carrying `table`, or 0 — used to
 *  assert the rows appear in the documented ORDER. */
const chipRowLineOf = (appCode, table) => {
  for (const m of appCode.matchAll(/chipRow\(\s*(\w+)\s*,/g)) {
    if (resolvesTo(appCode, m[1], table)) return appCode.slice(0, m.index).split('\n').length;
  }
  return 0;
};
/* THE FIVE ROWS, IN THE ORDER THE PANEL RENDERS THEM, each with the label that
 * introduces it and the table that really builds it. The order is part of the
 * claim (a swap would move the `end` marker above the `start` one, which is the
 * class of defect AK-5 already caught once). */
const STYLE_ROWS = [
  {label: '<label>stroke width</label>', table: 'WIDTH_OPTS'},
  {label: '<label>line style</label>',   table: 'DASH_OPTS'},
  {label: '<label>curvature</label>',    table: 'CURVE_OPTS'},
  {label: '<label>start</label>',        table: 'MARKER_OPTS_START'},
  {label: '<label>end</label>',          table: 'MARKER_OPTS'},
];
/* The option counts, measured — not asserted from a prose list. Exact for the
 * three literal shapes this repo uses; trailing-comma-proof. */
const arraySpan = (text, openIdx) => {
  let depth = 0;
  for (let i = openIdx; i < text.length; i++) {
    if (text[i] === '[') depth++;
    else if (text[i] === ']' && --depth === 0) return text.slice(openIdx, i + 1);
  }
  return '';
};
const countEntries = (arr) => {
  const span = arraySpan(arr, arr.indexOf('['));
  if (!span) return 0;
  let d = 0, objs = 0, tuples = 0, commas = 0, beforeClose = null;
  for (let i = 0; i < span.length; i++) {
    const ch = span[i];
    if (ch === '[' || ch === '{') { if (d === 1) (ch === '{' ? objs++ : tuples++); d++; }
    else if (ch === ']' || ch === '}') { d--; if (d === 1) beforeClose = ch; }
    else if (d === 1 && ch === ',') commas++;
  }
  if (objs) return objs;
  if (tuples) return tuples;
  return commas + (beforeClose === ',' ? 0 : 1);
};
/** Option count of `name` in a comment-blanked copy of App.tsx, following an
 *  alias and the `.map(…)` form (`.map` does not change the length of the table
 *  it is applied to, so the SOURCE array's length is the count). */
const tableSize = (appCode, name, seen = new Set()) => {
  if (!name || seen.has(name)) return 0;
  seen.add(name);
  const decl = new RegExp(`(?:const|let)\\s+${name}\\s*:[^=]*=\\s*`).exec(appCode);
  if (!decl) return 0;
  const rest = appCode.slice(decl.index + decl[0].length);
  if (/^\(?\s*\[/.test(rest)) return countEntries(rest.slice(rest.indexOf('[')));
  const ref = /^\(?\s*(\w+)\s*(?:\.map|\)|;|,|\s+as\b)/.exec(rest);
  return ref ? tableSize(appCode, ref[1], seen) : 0;
};
/* The documented counts the AK-6 assertion named — the re-anchor asserts them
 * against the tables that BUILD the rows, so a row whose table lost an option
 * reddens here rather than being reported from a stale list. */
const ROW_COUNTS = {WIDTH_OPTS: 5, DASH_OPTS: 3, CURVE_OPTS: 4, MARKER_OPTS: 3, MARKER_OPTS_START: 3};
P.equalWidthRule = src => declsOf((/\.insp-seg\s+\.insp-seg-btn\s*\{([^}]*)\}/.exec(src.styles.code) ?? ['', ''])[1])
  .some(d => d.prop === 'flex' && /^1\s+1\s+0\b/.test(d.value))
  && declsOf((/\.insp-seg\s+\.insp-seg-btn\s*\{([^}]*)\}/.exec(src.styles.code) ?? ['', ''])[1])
    .some(d => d.prop === 'min-width' && d.value === '0');
/** RE-ANCHORED BY ROUND AL (AL-6) — see the block comment above `chipRowCarrierOf`. */
P.styleRowsAreFlat = src => STYLE_ROWS.every(r => chipRowCarrierOf(src.App.code, r.table) === 'chipRow'
  && tableSize(src.App.code, r.table) === ROW_COUNTS[r.table])
  && STYLE_ROWS.every(r => src.App.code.includes(r.label))
  && (() => {
    const lines = STYLE_ROWS.map(r => chipRowLineOf(src.App.code, r.table));
    return lines.every(l => l > 0) && lines.every((l, i) => i === 0 || l > lines[i - 1]);
  })();
/* and the ROW LABELS are in the panel, so the conversion did not drop a row */
P.styleRowLabels = src => STYLE_ROWS.every(r => src.App.code.includes(r.label));

/* --- AK-5/AK-7 (6): the two marker rows, labelled and correctly wired ---
 *
 * ── RE-ANCHORED BY ROUND AL (AL-6). OLD claim (AK-5/AK-7): the `start` row is a
 *    `<ToggleRow options={MARKER_OPTS_START}>` writing `markerStart`, and the
 *    `end` row a `<ToggleRow options={MARKER_OPTS}>` writing `markerEnd` — the
 *    labels were the defect (today's "arrow head" wrote markerEnd), so pinning
 *    label→key is what stops a rename swapping the two ends.
 *    WHY THAT HAD TO CHANGE: the markers rows in THIS SECTION keep their labels
 *    (`<label>start</label>` / `<label>end</label>`) and their writes
 *    unchanged, but the AK-6 `ToggleRow` element became an AL-6 `chipRow(...)`
 *    CALL, so the old extractor — which looked for `options={…}` INSIDE a
 *    self-closing element — could no longer see the table and reported
 *    `options=null`.
 *    NEW claim, THE SAME INVARIANT: `start` still writes `markerStart` from
 *    `MARKER_OPTS_START` and `end` still writes `markerEnd` from `MARKER_OPTS`,
 *    each carried by the section's inline row control in EITHER family, with the
 *    `_ICON_` alias followed (so the two rows cannot be cross-wired through it),
 *    and the retired words are still absent. `title` is no longer asserted from
 *    the JSX: `chipRow(opts, value, onPick, title, glyph)` builds
 *    `title={o.label ? `${title}: ${o.label}` : title}` in the helper, so the
 *    literal a per-row probe could read is now in `App.tsx`'s shared helper
 *    rather than in the row — its per-option presence is asserted instead. */
const rowWiring = (slice, label, appCode) => {
  const i = slice.indexOf(`<label>${label}</label>`);
  if (i < 0) return {found: false, writesKey: null, table: null, carrier: null};
  const blk = slice.slice(i, slice.indexOf('</div>', i));
  const write = /updateEdge\(\{(markerStart|markerEnd):/.exec(blk);
  const elementTable = /options=\{(\w+)\}/.exec(blk)?.[1] ?? null;
  const chipTable = /chipRow\(\s*(\w+)\s*,/.exec(blk)?.[1] ?? null;
  return {found: true, writesKey: write?.[1] ?? null,
    table: elementTable ?? chipTable,
    carrier: elementTable ? carrierOf(appCode, elementTable) : (chipTable ? 'chipRow' : null),
    title: /title="([^"]+)"/.exec(blk)?.[1] ?? null};
};
/** RE-ANCHORED BY ROUND AL (AL-6). The carrier is asserted to be the chip system
 *  BY NAME — not "any inline row" — for the reason the AK-6 comment above
 *  records: a probe that accepts either family is GREEN at `f0b00aa` too (these
 *  rows were `<ToggleRow/>` there) and therefore proves nothing about AL. The
 *  re-anchored claim is the AL-6 one, and the replay below asserts it is RED at
 *  `f0b00aa`. The label→key pinning — the whole reason AK-5 exists — is
 *  unchanged. */
P.markerRows = src => {
  const mk = secBodyOf(src.App.code, 'markers');
  const s = rowWiring(mk, 'start', src.App.code), e = rowWiring(mk, 'end', src.App.code);
  return s.found && e.found
    && s.writesKey === 'markerStart' && s.carrier === 'chipRow' && resolvesTo(src.App.code, s.table, 'MARKER_OPTS_START')
    && e.writesKey === 'markerEnd' && e.carrier === 'chipRow' && resolvesTo(src.App.code, e.table, 'MARKER_OPTS')
    && !mk.includes('arrow head') && !mk.includes('head start');
};

/* ===========================================================================
   RUN — against the WORKING TREE (the shipped source).
   =========================================================================== */
console.log('='.repeat(78));
console.log('ROUND AK — the edge panel after PASS 1 (AK-1 … AK-8)');
console.log('source-text harness, comments blanked before every count');
console.log('='.repeat(78));
console.log(`root: ${ROOT}`);

const SHIP = bundleOf();
const hexCount = (SHIP.styles.raw.match(/#[0-9a-fA-F]{3,8}\b/g) ?? []).length;
console.log(`styles.css hex literals: ${hexCount}  (the round's ceiling is 160)`);

/* The PRE-CHANGE bundle is loaded HERE, before the assertions, because the two
 * re-anchored probes (AK-6, AK-5/AK-7) PRINT the old claim beside the new one
 * and the old claim is read from this tree. The REPLAY section below asserts the
 * same probes are RED here — it does not re-load the bundle. */
let pre;
try {
  pre = bundleOf(PRE_COMMIT);
} catch (err) {
  console.log(`\n  FAIL  the pre-change tree could not be read from ${PRE_COMMIT}: ${err.message}`);
  console.log('        The control is PINNED to the commit this round was built on. If history');
  console.log('        has been rewritten, re-pin DS_PRE_COMMIT to the commit before ROUND AK —');
  console.log('        do NOT delete this section: a control that silently disappears is worse');
  console.log('        than one that fails.');
  failures++;
}

/* ── THE TREE THE RE-ANCHORED CLAIMS MOVED OFF (`PRE_AL_COMMIT`, ROUND AK's last
 *    commit). Loaded under a SECOND name so the old-claim text and the negative
 *    control cannot be conflated — see the pin's own note at the top. A failure
 *    to read it is reported and counted, never swallowed: a re-anchor whose old
 *    claim is blank is a claim a reader cannot check. */
let preAl;
try {
  preAl = bundleOf(PRE_AL_COMMIT);
} catch (err) {
  console.log(`\n  FAIL  the tree the re-anchored claims moved off could not be read from ${PRE_AL_COMMIT}: ${err.message}`);
  console.log('        This is where the OLD claim is read from. Re-pin DS_PRE_AL_COMMIT to');
  console.log('        ROUND AK\'s last commit (the tree these harnesses were green on).');
  failures++;
}

section('AK-1 — selection must never restroke the edge body');
{
  const hit = rulesWithProp(SHIP.styles.code, ['react-flow__edge.selected', 'react-flow__edge-path'], 'stroke');
  assert('ak1.no-.react-flow__edge.selected-.react-flow__edge-path-rule-carries-a-stroke',
    P.noSelectedRestroke(SHIP),
    hit.length === 0
      ? 'no rule whose selector names BOTH `.react-flow__edge.selected` and `.react-flow__edge-path` declares a `stroke*` property — the rule that overwrote the inline stroke the panel writes is gone'
      : `STILL PRESENT: ${hit.map(r => r.sel).join(' | ')} :: ${hit.map(r => declsOf(r.body).filter(d => d.prop.startsWith('stroke')).map(d => `${d.prop}:${d.value}`).join(', ')).join(' ; ')}`);
  const elec = rulesWhere(SHIP.styles.code, ['ds-electric', 'react-flow__edge-path']);
  const bad = elec.filter(r => declsOf(r.body).some(d => d.prop === 'stroke' && d.value.includes('!important')));
  assert('ak1.no-.ds-electric-rule-carries-stroke-!important',
    P.noElectricStrokeOverride(SHIP),
    bad.length === 0
      ? `${elec.length} \`.ds-electric .react-flow__edge-path\` rule(s), none declaring \`stroke: … !important\` — hover keeps its glow and marching dash (ADDITIVE marks) and no longer repaints the authored body or its width`
      : `STILL OVERRIDING: ${bad.map(r => declsOf(r.body).filter(d => d.prop === 'stroke').map(d => d.value).join(', ')).join(' ; ')}`);
  const decl = new RegExp(`\\.${SELECTION_CLASS}\\s*\\{([^}]*)\\}`).exec(SHIP.styles.code);
  assert('ak1.the-check-is-not-vacuous-the-selection-REPLACEMENT-is-declared-and-drawn',
    P.selectionCoreDeclared(SHIP) && P.selectionCoreRendered(SHIP),
    `${SELECTION_CLASS} declared in src/styles.css=${P.selectionCoreDeclared(SHIP)}${decl ? ` with ${JSON.stringify(declsOf(decl[1]).map(d => `${d.prop}:${d.value}`).join('; '))}` : ''}, drawn by src/GoblinEdge.tsx=${P.selectionCoreRendered(SHIP)} — ` +
    `so "no restroke" is a REPLACEMENT, not a deletion of the selection signal. RE-ANCHORED by ROUND AL (AL-1): the OLD claim was that the ` +
    `edge-sel-overlay element was declared with a stroke AND drawn; the owner's device test rejected that +5px dashed halo, and the ` +
    `replacement is option C — the var(--sel) body with the authored colour as a thin core on top.`);
}

section('AK-2 / AK-3 / AK-4 — the three removed controls are absent from App.tsx');
{
  const present = REMOVED_APP_STRINGS.filter(s => SHIP.App.code.includes(s));
  assert('ak2-4.intent-label-and-label-position-and-the-animated-field-are-gone',
    P.removedAppStrings(SHIP),
    present.length === 0
      ? `none of ${JSON.stringify(REMOVED_APP_STRINGS)} appears in the CODE of src/App.tsx (comments blanked first, so the notes the pass left in place of each control do not count as the control existing)`
      : `STILL IN CODE: ${JSON.stringify(present)}`);
}

section('AK-8 — the preset-keyed data is deleted outright');
{
  assert('ak8.labelPresets-and-C4_LABELS-are-absent-from-presets.ts',
    P.presetDataGone(SHIP),
    !P.presetDataGone(SHIP)
      ? `STILL PRESENT: ${['labelPresets', 'C4_LABELS'].filter(s => SHIP.presets.code.includes(s)).join(', ')}`
      : 'neither `labelPresets` (the EdgeDefaults field) nor `C4_LABELS` (its C4 data) is in the code — the board-preset gate has no data left to key on. `technField` / the `technology` input are a DIFFERENT field and are not asserted here.');
}

section('AK-8 — the cardinality gate reads the EDGE, not the board preset');
{
  assert('ak8.inspector.ts-carries-hasCrowFootEnds-and-not-presetId===erd',
    P.gateReadsEdge(SHIP),
    `hasCrowFootEnds ${SHIP.inspector.code.includes('hasCrowFootEnds') ? 'PRESENT' : 'ABSENT'}, ` +
    `\`presetId === 'erd'\` ${SHIP.inspector.code.includes("presetId === 'erd'") ? 'STILL PRESENT' : 'absent'} — ` +
    `presetId ${SHIP.inspector.code.includes('presetId') ? 'still appears' : 'appears nowhere in the file at all'}, so the section decision can no longer change with the BOARD's diagram type (spec §2, Item A)`);
}

section('AK-6 — the four style controls are full-width flat rows on an equal share');
{
  const decl = /\.insp-seg\s+\.insp-seg-btn\s*\{([^}]*)\}/.exec(SHIP.styles.code);
  assert('ak6.equal-width-rule-present',
    P.equalWidthRule(SHIP),
    decl ? `\`${decl[0].replace(/\s+/g, ' ')}\` — every button in a segmented row takes an equal share of its field rather than sizing to its own text` : 'the rule is MISSING from src/styles.css');
  const carriers = STYLE_ROWS.map(r => `${r.table}=${chipRowCarrierOf(SHIP.App.code, r.table)}`
    + `/${tableSize(SHIP.App.code, r.table)}opts@${chipRowLineOf(SHIP.App.code, r.table)}`);
  const oldCarriers = preAl ? STYLE_ROWS.map(r => `${r.table}=${carrierOf(preAl.App.code, r.table)}`) : null;
  const rowLines = STYLE_ROWS.map(r => chipRowLineOf(SHIP.App.code, r.table));
  assert('ak6.width-line-style-curvature-and-the-two-marker-rows-render-as-chip-rows',
    P.styleRowsAreFlat(SHIP) && P.styleRowLabels(SHIP),
    `the five rows TODAY, in render order: ${carriers.join('  ')} — each is carried ONCE by the ONE chip ` +
    `system \`chipRow\`, which renders every option as a button (\`o.art ?? o.label\`) rather than behind a ` +
    `popover trigger, so every option is visible without opening anything — the discoverability reason AK-6 ` +
    `records, no false precedent cited. RE-ANCHORED by ROUND AL (AL-6): OLD claim (AK-6) read ` +
    `${oldCarriers ? oldCarriers.join(' ') : '…'} on ${PRE_AL_COMMIT}, where this assertion last PASSED — all ` +
    `five were \`<ToggleRow/>\`. WHY IT MOVED: round AL replaced those ToggleRow call sites in LINE / MARKERS / ` +
    `FLOW with the ONE chip system (the owner's "lúc to, lúc dài, lúc nhỏ" measurement), so a \`<ToggleRow/>\` ` +
    `probe finds nothing on a correct tree. The claim NAMES \`chipRow\` rather than accepting "any inline row", ` +
    `because the weaker form would be GREEN at ${PRE_AL_COMMIT} too and would prove nothing about this round. ` +
    `The invariant — ONE inline row control per table, never a popover — is unchanged, and the re-anchor is ` +
    `STRONGER than the claim it replaces: it also asserts the option counts ` +
    `(${STYLE_ROWS.map(r => `${r.table}:${tableSize(SHIP.App.code, r.table)}`).join(' ')}, the numbers AK-6 ` +
    `named) and the top-to-bottom ORDER of the five calls (lines ${rowLines.join(' < ')}), so a dropped option ` +
    `or a swapped \`start\`/\`end\` row reddens here. The \`_ICON_\` alias is followed, so \`MARKER_OPTS\` and ` +
    `\`MARKER_OPTS_START\` stay distinct.`);
}

section('AK-5 / AK-7 — the two marker rows are labelled `start` and `end`, and still write their own key');
{
  const mk = secBodyOf(SHIP.App.code, 'markers');
  const s = rowWiring(mk, 'start', SHIP.App.code), e = rowWiring(mk, 'end', SHIP.App.code);
  const preMk = preAl ? secBodyOf(preAl.App.code, 'markers') : '';
  const preS = preAl ? rowWiring(preMk, 'start', preAl.App.code) : null;
  const preE = preAl ? rowWiring(preMk, 'end', preAl.App.code) : null;
  assert('ak5-7.marker-rows-are-START-and-END-and-each-writes-its-own-marker-key',
    P.markerRows(SHIP),
    `markers body: \`start\` → ${s.writesKey} / table=${s.table} (carrier ${s.carrier}); ` +
    `\`end\` → ${e.writesKey} / table=${e.table} (carrier ${e.carrier}); the retired words ` +
      `\`arrow head\` / \`head start\` ${mk.includes('arrow head') || mk.includes('head start') ? 'STILL PRESENT' : 'absent'}` +
    ` — the LABELS were the defect (today's "arrow head" wrote markerEnd), so the check pins label→key and would ` +
    `fail a rename that swapped the two ends. RE-ANCHORED by ROUND AL (AL-6): OLD claim (AK-5/AK-7) read the same ` +
    `two rows on ${PRE_AL_COMMIT}, where it last PASSED — start → ${preS ? `${preS.writesKey}/${preS.table}` : 'n/a'}, ` +
    `end → ${preE ? `${preE.writesKey}/${preE.table}` : 'n/a'}, both through \`<ToggleRow/>\`. WHY IT MOVED: the ` +
    `carrier became a \`chipRow(\` call, which the element-shaped extractor could not see (it reported ` +
    `\`options=null\`). The write key and the table are re-read from the call form and the alias is followed, so ` +
    `the row identity is still pinned. The per-row \`title\` is no longer read here: \`chipRow\` builds ` +
    `\`\${title}: \${o.label}\` inside the shared helper rather than in the row.`);
}

/* ===========================================================================
   REPLAY — the negative control, IN THE FILE.
   ===========================================================================
   The round's rule: "an inverted assertion must be shown RED before the fix".
   A control that passes on BOTH trees proves nothing, and this project has paid
   for that mistake. So the same probes above are re-run over the PRE-ROUND-AK
   tree, read from the pinned commit, and each is asserted to be RED.

   EVERY probe above is expected to be RED before the fix:
     · the restroke rule is PRESENT            (ak1)
     · the selection replacement is absent from both the sheet and GoblinEdge
       (ak1) — ROUND AL re-anchored this one onto `.edge-sel-core`, so it reads
       the element AL ships rather than the `.edge-sel-overlay` element the AK
       round shipped and AL deleted
     · all three removed strings are PRESENT   (ak2-4)
     · labelPresets / C4_LABELS are PRESENT    (ak8)
     · `presetId === 'erd'` IS the gate        (ak8)
     · the five tables are carried by IconPickerRow, the labels are
       `arrow head` / `head start`             (ak6, ak5-7)
   The ONE probe that is GREEN on both trees is `ak6.equal-width-rule-present`:
   the `.insp-seg .insp-seg-btn` rule is ROUND AA's and predates this round. It
   is kept in the GREEN set above because it is the rule AK-6 relies on, and it is
   excluded from the RED set below with this note rather than quietly dropped.

   ── ROUND AL (AL-6) re-anchored the two probes that named the OLD carrier.
      `ak6` and `ak5-7` now read "carried by an INLINE row control" (ToggleRow OR
      chipRow) and "writes its own key from its own table" rather than "carried by
      `<ToggleRow/>`". Both stay in the RED set and MUST still be RED here — not
      because the invariant changed, but because the pre-change tree carries
      these SAME five tables through `<IconPickerRow>`, which the re-anchored
      probe still rejects (it accepts only the two inline families). That is what
      makes AL-6's replacement measurable against the tree AK-6 measured.
   =========================================================================== */
console.log('\n' + '='.repeat(78));
console.log(`REPLAY (negative control) — the probes over the PRE-CHANGE tree ${PRE_COMMIT}`);
console.log('each must be RED, or the probe measures nothing');
console.log('='.repeat(78));

/* `pre` was loaded above the RUN section (the re-anchored probes print the old
 * claim beside the new one). Nothing is read from it here that was not already
 * read there; the load's own failure was reported and counted above. */

if (pre) {
  const INVERTED = [
    ['ak1.no-.react-flow__edge.selected-.react-flow__edge-path-rule-carries-a-stroke', P.noSelectedRestroke],
    ['ak1.no-.ds-electric-rule-carries-stroke-!important', P.noElectricStrokeOverride],
    ['ak1.selection-REPLACEMENT-declared-and-drawn', src => P.selectionCoreDeclared(src) && P.selectionCoreRendered(src)],
    ['ak2-4.the-three-removed-controls-are-absent', P.removedAppStrings],
    ['ak8.labelPresets-and-C4_LABELS-absent', P.presetDataGone],
    ['ak8.gate-reads-the-EDGE-not-the-preset', P.gateReadsEdge],
    ['ak6.the-five-style-rows-are-chip-rows', P.styleRowsAreFlat],
    ['ak5-7.marker-rows-are-START-and-END', P.markerRows],
  ];
  const greenOnPre = [];
  for (const [id, probe] of INVERTED) {
    const ok = probe(pre);
    if (ok) greenOnPre.push(id);
    console.log(`  ${ok ? 'GREEN (control BROKEN)' : 'RED   '}  ${id}`);
  }
  console.log('');
  assert('replay.every-inverted-probe-is-RED-on-the-pre-change-tree',
    greenOnPre.length === 0,
    greenOnPre.length === 0
      ? `all ${INVERTED.length} inverted probes are RED at ${PRE_COMMIT} and GREEN on the working tree — each assertion really detects the change it claims to`
      : `GREEN ON BOTH TREES (so it proves nothing): ${greenOnPre.join(', ')}`);

  /* ── THE RE-ANCHORED CLAIMS, MEASURED AGAINST THE TREE THEY MOVED OFF.
   *    This is the round's law made mechanical: a re-anchored assertion must be
   *    shown RED on the pre-change tree, or it is a loosened assertion wearing a
   *    re-anchor's clothes. `f0b00aa` is ROUND AK's last commit — the tree where
   *    `ak6` and `ak5-7` last PASSED. If either probe is GREEN there, the
   *    re-anchor proves nothing about AL and this FAILS.
   *
   *    It is a SEPARATE assertion from the control above on purpose: the control
   *    asks "does this probe notice the AK round?" and this asks "does the
   *    RE-ANCHORED probe still notice AL's change?" Those are different claims
   *    about different commits and conflating them is how a weakened re-anchor
   *    hides. */
  if (preAl) {
    const realRed = [
      ['ak6.the-five-style-rows-are-chip-rows', P.styleRowsAreFlat],
      ['ak5-7.marker-rows-are-START-and-END', P.markerRows],
    ];
    const greenOnAl = [];
    console.log(`\n  the RE-ANCHORED probes over ${PRE_AL_COMMIT} (ROUND AK's last commit — where they last PASSED):`);
    for (const [id, probe] of realRed) {
      const ok = probe(preAl);
      if (ok) greenOnAl.push(id);
      console.log(`  ${ok ? 'GREEN (the re-anchor proves NOTHING)' : 'RED   '}  ${id}`);
    }
    console.log('');
    assert('replay.every-re-anchored-probe-is-RED-on-the-tree-it-moved-off',
      greenOnAl.length === 0,
      greenOnAl.length === 0
        ? `both re-anchored probes are RED at ${PRE_AL_COMMIT} — the tree AL changed from, where they last PASSED — and GREEN on the working tree, so each re-anchor measures the AL-6 change itself and is not a weaker claim that happens to be true on both`
        : `STILL GREEN AT ${PRE_AL_COMMIT} (the re-anchor is weaker than the claim it replaces): ${greenOnAl.join(', ')}`);
  }

  /* the two restroke rules, named as the pre-change sheet really had them, so the
     RED above is auditable rather than a bare boolean */
  const preSel = rulesWithProp(pre.styles.code, ['react-flow__edge.selected', 'react-flow__edge-path'], 'stroke');
  const preElec = rulesWhere(pre.styles.code, ['ds-electric', 'react-flow__edge-path'])
    .flatMap(r => declsOf(r.body).filter(d => d.prop.startsWith('stroke') && d.value.includes('!important')));
  console.log('\n  the pre-change declarations this round removed, quoted from the sheet:');
  for (const r of preSel) console.log(`    ${r.sel} { ${declsOf(r.body).filter(d => d.prop.startsWith('stroke')).map(d => `${d.prop}: ${d.value}`).join('; ')} }`);
  for (const d of preElec) console.log(`    .ds-electric .react-flow__edge-path { ${d.prop}: ${d.value} }`);
  console.log(`    (the replacement, absent before this round and present now: ` +
    `${SELECTION_CLASS} declared=${P.selectionCoreDeclared(SHIP)} drawn=${P.selectionCoreRendered(SHIP)}; the element the AK round shipped in place of the restroke was the one AL deleted — present in the pre-change sheet=${/\\.edge-sel-overlay/.test(pre.styles.code) ? 'yes' : 'no'}`);
  console.log(`\n  the pre-change strings this round removed, present at ${PRE_COMMIT}:`);
  for (const s of [...REMOVED_APP_STRINGS, 'labelPresets', 'C4_LABELS', "presetId === 'erd'", 'arrow head', 'head start']) {
    const where = REMOVED_APP_STRINGS.includes(s) ? 'App.tsx'
      : s === 'labelPresets' || s === 'C4_LABELS' ? 'presets.ts'
      : s === "presetId === 'erd'" ? 'inspector.ts' : 'App.tsx (markers body)';
    const inPre = where.startsWith('presets') ? pre.presets.code.includes(s)
      : where.startsWith('inspector') ? pre.inspector.code.includes(s)
      : where.includes('markers') ? secBodyOf(pre.App.code, 'markers').includes(s)
      : pre.App.code.includes(s);
    console.log(`    ${inPre ? 'present' : 'ABSENT '}  ${JSON.stringify(s).padEnd(36)} ${where}`);
  }
}

/* ---------- the round's own gate, recorded here too ---------- */
section('THE ROUND GATE');
assert('gate.hex-literals-are-within-the-rounds-ceiling',
  hexCount <= 160,
  `${hexCount} hex literals in src/styles.css against the round's ceiling of 160 (142 at the start of the round) — this pass adds none`);

console.log('\n' + '='.repeat(78));
console.log(`ROUND AK EDGE-PANEL HARNESS: ${failures === 0 ? 'all checks passed' : failures + ' FAILURE(S)'}`);
console.log('='.repeat(78));
process.exit(failures ? 1 : 0);
