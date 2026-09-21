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
function readOne(path, commit) {
  const raw = commit
    ? execFileSync('git', ['show', `${commit}:${path}`], {cwd: ROOT, encoding: 'utf8', maxBuffer: 1 << 28})
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
/* the check is not vacuous: the ADDITIVE replacement must be declared AND drawn */
P.overlayDeclared = src => /\.edge-sel-overlay\s*\{/.test(src.styles.code)
  && declsOf((/\.edge-sel-overlay\s*\{([^}]*)\}/.exec(src.styles.code) ?? ['', ''])[1])
    .some(d => d.prop === 'stroke');
P.overlayRendered = src => src.GoblinEdge.code.includes('edge-sel-overlay')
  && /className=["']edge-sel-overlay["']/.test(src.GoblinEdge.code);

/* --- AK-2/AK-3/AK-4 (2): the removed controls are gone --- */
const REMOVED_APP_STRINGS = ['intent label', 'label position', 'animated (dash on the line)'];
P.removedAppStrings = src => REMOVED_APP_STRINGS.every(s => !src.App.code.includes(s));

/* --- AK-8 (3): the deleted preset data --- */
P.presetDataGone = src => !src.presets.code.includes('labelPresets') && !src.presets.code.includes('C4_LABELS');

/* --- AK-8 (4): the gate reads the EDGE --- */
P.gateReadsEdge = src => src.inspector.code.includes('hasCrowFootEnds')
  && !src.inspector.code.includes("presetId === 'erd'");

/* --- AK-6 (5): the flat rows, and the equal share they divide --- */
const ROW_TABLES = ['WIDTH_OPTS', 'DASH_OPTS', 'CURVE_OPTS', 'MARKER_OPTS', 'MARKER_OPTS_START'];
P.equalWidthRule = src => declsOf((/\.insp-seg\s+\.insp-seg-btn\s*\{([^}]*)\}/.exec(src.styles.code) ?? ['', ''])[1])
  .some(d => d.prop === 'flex' && /^1\s+1\s+0\b/.test(d.value))
  && declsOf((/\.insp-seg\s+\.insp-seg-btn\s*\{([^}]*)\}/.exec(src.styles.code) ?? ['', ''])[1])
    .some(d => d.prop === 'min-width' && d.value === '0');
P.styleRowsAreFlat = src => ROW_TABLES.every(t => carrierOf(src.App.code, t) === 'ToggleRow');
/* and the ROW LABELS are in the panel, so the conversion did not drop a row */
P.styleRowLabels = src => ['<label>stroke width</label>', '<label>line style</label>',
  '<label>curvature</label>', '<label>start</label>', '<label>end</label>']
  .every(l => src.App.code.includes(l));

/* --- AK-5/AK-7 (6): the two marker rows, labelled and correctly wired --- */
/** The `start` row must WRITE `markerStart` with MARKER_OPTS_START, and the
 *  `end` row `markerEnd` with MARKER_OPTS — the labels were the defect, the
 *  wiring was always right, and a rename that swapped the two would be worse
 *  than the bug. Read from the markers slice, because `start`/`end` are also the
 *  Cardinality rows' labels. */
const rowWiring = (slice, label) => {
  const i = slice.indexOf(`<label>${label}</label>`);
  if (i < 0) return {found: false, writesKey: null, table: null, title: null};
  const blk = slice.slice(i, slice.indexOf('</div>', i));
  const write = /updateEdge\(\{(markerStart|markerEnd):/.exec(blk);
  return {found: true, writesKey: write?.[1] ?? null,
    table: /options=\{(\w+)\}/.exec(blk)?.[1] ?? null,
    title: /title="([^"]+)"/.exec(blk)?.[1] ?? null};
};
P.markerRows = src => {
  const mk = secBodyOf(src.App.code, 'markers');
  const s = rowWiring(mk, 'start'), e = rowWiring(mk, 'end');
  return s.found && e.found
    && s.writesKey === 'markerStart' && s.table === 'MARKER_OPTS_START'
    && e.writesKey === 'markerEnd' && e.table === 'MARKER_OPTS'
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
  const decl = /\.edge-sel-overlay\s*\{([^}]*)\}/.exec(SHIP.styles.code);
  assert('ak1.the-check-is-not-vacuous-the-selection-OVERLAY-is-declared-and-drawn',
    P.overlayDeclared(SHIP) && P.overlayRendered(SHIP),
    `\`.edge-sel-overlay\` declared in src/styles.css=${P.overlayDeclared(SHIP)}${decl ? ` with ${JSON.stringify(declsOf(decl[1]).map(d => `${d.prop}:${d.value}`).join('; '))}` : ''}, drawn by src/GoblinEdge.tsx=${P.overlayRendered(SHIP)} — so "no restroke" is a REPLACEMENT (a second additive path, the technique draw.io / Excalidraw / tldraw all use), not a deletion of the selection signal`);
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
  const carriers = ROW_TABLES.map(t => `${t}=${carrierOf(SHIP.App.code, t)}`);
  assert('ak6.width-line-style-curvature-and-the-two-marker-rows-render-as-segmented-rows',
    P.styleRowsAreFlat(SHIP) && P.styleRowLabels(SHIP),
    `${carriers.join(' ')} — each control is carried by \`<ToggleRow/>\` (the segmented row), NOT by an \`IconPickerRow\` popover trigger (\`o.art ?? o.label\` renders the buttons inline, so every option is visible without opening anything — the discoverability reason AK-6 records, no false precedent cited)`);
}

section('AK-5 / AK-7 — the two marker rows are labelled `start` and `end`, and still write their own key');
{
  const mk = secBodyOf(SHIP.App.code, 'markers');
  const s = rowWiring(mk, 'start'), e = rowWiring(mk, 'end');
  assert('ak5-7.marker-rows-are-START-and-END-and-each-writes-its-own-marker-key',
    P.markerRows(SHIP),
    `markers body: \`start\` → ${s.writesKey} / options=${s.table} / title=${JSON.stringify(s.title)}; ` +
    `\`end\` → ${e.writesKey} / options=${e.table} / title=${JSON.stringify(e.title)}; the retired words ` +
      `\`arrow head\` / \`head start\` ${mk.includes('arrow head') || mk.includes('head start') ? 'STILL PRESENT' : 'absent'}` +
    ` — the LABELS were the defect (today's "arrow head" wrote markerEnd), so the check pins label→key and would fail a rename that swapped the two ends`);
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
     · `.edge-sel-overlay` is absent from both the sheet and GoblinEdge (ak1)
     · all three removed strings are PRESENT   (ak2-4)
     · labelPresets / C4_LABELS are PRESENT    (ak8)
     · `presetId === 'erd'` IS the gate        (ak8)
     · the five tables are carried by IconPickerRow, the labels are
       `arrow head` / `head start`             (ak6, ak5-7)
   The ONE probe that is GREEN on both trees is `ak6.equal-width-rule-present`:
   the `.insp-seg .insp-seg-btn` rule is ROUND AA's and predates this round. It
   is kept in the GREEN set above because it is the rule AK-6 relies on, and it is
   excluded from the RED set below with this note rather than quietly dropped.
   =========================================================================== */
console.log('\n' + '='.repeat(78));
console.log(`REPLAY (negative control) — the probes over the PRE-CHANGE tree ${PRE_COMMIT}`);
console.log('each must be RED, or the probe measures nothing');
console.log('='.repeat(78));

let pre;
try {
  pre = bundleOf(PRE_COMMIT);
} catch (err) {
  console.log(`  FAIL  the pre-change tree could not be read from ${PRE_COMMIT}: ${err.message}`);
  console.log('        The control is PINNED to the commit this round was built on. If history');
  console.log('        has been rewritten, re-pin DS_PRE_COMMIT to the commit before ROUND AK —');
  console.log('        do NOT delete this section: a control that silently disappears is worse');
  console.log('        than one that fails.');
  failures++;
}

if (pre) {
  const INVERTED = [
    ['ak1.no-.react-flow__edge.selected-.react-flow__edge-path-rule-carries-a-stroke', P.noSelectedRestroke],
    ['ak1.no-.ds-electric-rule-carries-stroke-!important', P.noElectricStrokeOverride],
    ['ak1.selection-overlay-declared-and-drawn', src => P.overlayDeclared(src) && P.overlayRendered(src)],
    ['ak2-4.the-three-removed-controls-are-absent', P.removedAppStrings],
    ['ak8.labelPresets-and-C4_LABELS-absent', P.presetDataGone],
    ['ak8.gate-reads-the-EDGE-not-the-preset', P.gateReadsEdge],
    ['ak6.the-five-style-rows-are-segmented-rows', P.styleRowsAreFlat],
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

  /* the two restroke rules, named as the pre-change sheet really had them, so the
     RED above is auditable rather than a bare boolean */
  const preSel = rulesWithProp(pre.styles.code, ['react-flow__edge.selected', 'react-flow__edge-path'], 'stroke');
  const preElec = rulesWhere(pre.styles.code, ['ds-electric', 'react-flow__edge-path'])
    .flatMap(r => declsOf(r.body).filter(d => d.prop.startsWith('stroke') && d.value.includes('!important')));
  console.log('\n  the pre-change declarations this round removed, quoted from the sheet:');
  for (const r of preSel) console.log(`    ${r.sel} { ${declsOf(r.body).filter(d => d.prop.startsWith('stroke')).map(d => `${d.prop}: ${d.value}`).join('; ')} }`);
  for (const d of preElec) console.log(`    .ds-electric .react-flow__edge-path { ${d.prop}: ${d.value} }`);
  console.log(`    (the replacement, absent before this round and present now: ` +
    `.edge-sel-overlay declared=${P.overlayDeclared(SHIP)} drawn=${P.overlayRendered(SHIP)})`);
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
