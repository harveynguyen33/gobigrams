#!/usr/bin/env node
/**
 * ROUND AA harness — three items, each measured from the real sources.
 *
 * No browser, no DOM, no CDP. ITEM 1's geometry is computed from the
 * declarations `src/styles.css` actually carries (a model of flex basis +
 * gap + padding, with a real cascade resolution — see `resolvePadding`), not
 * from a live layout; ITEM 2's default is EXECUTED against the real
 * `src/marqueeMode.ts`; ITEM 3's palette is read out of the REAL `LIBRARY`
 * by bundling `src/presets.ts` with the esbuild that Vite already ships.
 *
 * WHAT IT CANNOT DO, stated rather than hidden: it cannot see the panel, so
 * "every button in a row is the same width ON SCREEN" is asserted as
 * ARITHMETIC ON THE SHEET, not as a measurement of painted boxes. The painted
 * widths are the orchestrator's live pass. The model is therefore written so a
 * reader can check every number against the sheet it came from.
 *
 * COMMENTS ARE STRIPPED BEFORE EVERY COUNT (a docblock in this repo quotes the
 * constructs it removed, and a raw count would then read a correct tree as a
 * defect).
 */
import {readFileSync, writeFileSync, mkdtempSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {execFileSync} from 'node:child_process';

const ROOT = '/home/harvey/projects/tech-goblin/lab/diagram-studio';
const ESBUILD = join(ROOT, 'node_modules/.bin/esbuild');
const APP_RAW = readFileSync(`${ROOT}/src/App.tsx`, 'utf8');
const STYLES_RAW = readFileSync(`${ROOT}/src/styles.css`, 'utf8');
const PRESETS_RAW = readFileSync(`${ROOT}/src/presets.ts`, 'utf8');
const SET_RAW = readFileSync(`${ROOT}/src/Settings.tsx`, 'utf8');

/** Strip block + line comments; blanking keeps byte offsets (and line numbers). */
const blank = m => m.replace(/[^\n]/g, ' ');
const stripTs = s => s.replace(/\/\*[\s\S]*?\*\//g, blank).replace(/(^|[^:])\/\/[^\n]*/g, (m, p1) => p1 + ' '.repeat(m.length - p1.length));
const STYLES = stripTs(STYLES_RAW);
const APP = stripTs(APP_RAW);
const PRESETS = stripTs(PRESETS_RAW);
const SET = stripTs(SET_RAW);

/* ===========================================================================
   ROUND AL — THE SECOND PIN, and the replay the re-anchored probes need.
   ===========================================================================
   This harness had NO negative control: every claim was read from the working
   tree only, so a claim that happened to be true on both trees could never be
   told apart from one that measures a change. ROUND AL re-anchors four of these
   assertions (the rows that moved to `chipRow`), and the round's law is that a
   re-anchored assertion must be SHOWN RED on the tree it moved off — otherwise
   the "re-anchor" is indistinguishable from a loosening.

   `f0b00aa` is ROUND AK's last commit, the tree these assertions last PASSED
   on. It is a DIFFERENT commit from the working tree in exactly the way these
   four claims moved, so it is the control that makes the re-anchors measurable.
   Read with `git show`, this harness's only option (it does not support
   `DS_PRE_COMMIT`), which is what the round's rule allows when a harness has no
   env pin. The REPLAY section at the bottom runs the same probes over it and
   FAILS if any is still GREEN there. */
const PRE_AL_COMMIT = process.env.DS_PRE_AL_COMMIT || 'f0b00aa';
const commitFile = (commit, p) =>
  execFileSync('git', ['show', `${commit}:${p}`], {cwd: ROOT, encoding: 'utf8', maxBuffer: 1 << 28});
let preAl = null;
try {
  preAl = {
    appRaw: commitFile(PRE_AL_COMMIT, 'src/App.tsx'),
    stylesRaw: commitFile(PRE_AL_COMMIT, 'src/styles.css'),
  };
  preAl.app = stripTs(preAl.appRaw);
  preAl.styles = stripTs(preAl.stylesRaw);
} catch (err) {
  console.log(`\n  FAIL  the tree the re-anchored claims moved off could not be read from ${PRE_AL_COMMIT}: ${err.message}`);
  console.log('        The four re-anchored AA-1 assertions print their OLD claim from it and the');
  console.log('        REPLAY asserts they are RED there. Re-pin DS_PRE_AL_COMMIT to ROUND AK\'s');
  console.log('        last commit (the tree these assertions last passed on).');
}
/* The working-tree bundle in the SAME shape, so one probe runs over both.
   ROUND AM, AM-5 — `picks` is added so a probe can read `src/InspectorPickers.tsx`
   too. `P_HALF_APPLIED` needs it because AM-5 moved the Speed row's carrier out
   of `App.tsx` entirely, into that file's `FlowSpeed`. */
const PICKS_RAW = readFileSync(`${ROOT}/src/InspectorPickers.tsx`, 'utf8');
const SHIP_B = {appRaw: APP_RAW, stylesRaw: STYLES_RAW, app: APP, styles: STYLES, picks: PICKS_RAW};

const results = [];
const rmFile = rmSync;
const assert = (id, pass, detail = '') => {
  results.push({id, pass: !!pass, detail});
  console.log(`  ${pass ? 'PASS' : 'FAIL'}  ${id}  —  ${detail}`);
};
const countOf = (t, n) => t.split(n).length - 1;
const at = (raw, needle) => {
  const i = raw.split('\n').findIndex(l => l.includes(needle));
  return i < 0 ? 0 : i + 1;
};

/* ===========================================================================
   ITEM 1 — THE ALIGN ROWS: EQUAL WIDTHS, FROM THE SHEET.
   =========================================================================== */
console.log('='.repeat(78));
console.log('ITEM 1 — segmented rows are equal-width, and the row does not overflow');
console.log('='.repeat(78));

/** Every rule in the sheet, as {sel, decls, index}. A minimal parser: the
 *  sheet writes one selector per rule (no selector groups in the region under
 *  test — verified by `rulesFor` returning a non-empty list for each class). */
const RULES = (() => {
  const out = [];
  const re = /(^|\n)([^\n{}@\/][^\n{}]*)\{([^{}]*)\}/g;
  let m;
  while ((m = re.exec(STYLES))) {
    out.push({
      sel: m[2].trim().replace(/\s+/g, ' '),
      decls: m[3],
      index: m.index,
    });
  }
  return out;
})();

const decl = (block, prop) => {
  const m = new RegExp(`(?:^|;)\\s*${prop}\\s*:\\s*([^;]+)`).exec(block);
  return m ? m[1].trim() : null;
};
/** Specificity, counted the cheap way that is exact for the selectors here:
 *  classes + attributes + pseudo-classes, ACROSS the whole compound chain (a
 *  descendant selector's ancestor compounds count, exactly as CSS counts them).
 *  No element selectors appear in any candidate — every one is a `.class` chain. */
const spec = sel => (sel.match(/\.[\w-]+|\[[^\]]+\]|:{1,2}[\w-]+(?!\()/g) ?? []).length;
/** Does the FINAL compound of `sel` match an element whose class list is
 *  `classes`? Every class in that compound must be present. */
const lastCompoundMatches = (sel, classes) =>
  sel.split(/\s+/).pop().split('.').filter(Boolean).every(c => classes.includes(c));
/** Do all the ANCESTOR compounds match a chain carrying `ancestors`? The sheet's
 *  segmented rules are one descendant step (`.insp-seg .insp-seg-btn`), so the
 *  chain is the wrapper's class list. */
const ancestorsMatch = (sel, ancestors) => {
  const parts = sel.split(/\s+/);
  return parts.slice(0, -1).every(part => part.split('.').filter(Boolean).every(c => ancestors.includes(c)));
};
/** THE CASCADE, resolved: higher specificity wins; at EQUAL specificity the
 *  LATER rule in source order wins. That second clause is not a detail — it is
 *  what decides the padding of every segmented button (`padding: 7px 6px` on
 *  `.insp-seg-btn` at styles.css:1377 vs `padding: 5px 8px` on `.mbtn` at
 *  :2036, both one class, `.mbtn` LATER), so a model that stopped at
 *  specificity would report a content box the browser never paints. */
function computed(classes, prop, ancestors = []) {
  let best = null, bestSpec = -1, bestIndex = -1;
  for (const r of RULES) {
    if (!lastCompoundMatches(r.sel, classes) || !ancestorsMatch(r.sel, ancestors)) continue;
    const v = decl(r.decls, prop);
    if (v == null) continue;
    const s = spec(r.sel);
    if (s > bestSpec || (s === bestSpec && r.index > bestIndex)) {
      bestSpec = s; bestIndex = r.index; best = {v, sel: r.sel, index: r.index};
    }
  }
  return best;
}
function resolvePadding(classes, ancestors = []) {
  const w = computed(classes, 'padding', ancestors);
  if (!w) return null;
  const parts = w.v.split(/\s+/).map(p => parseFloat(p));
  // 1 value = all sides; 2 = block inline; 3 = top inline bottom; 4 = t r b l.
  const inline = parts.length === 1 ? parts[0] : parts[1];
  return {raw: w.v, sel: w.sel, inline, block: parts[0]};
}

const WRAPPER = ['swatches', 'insp-seg'];
const WRAPPER3 = [...WRAPPER, 'grid3'];
const BTN = ['mbtn', 'insp-seg-btn'];
/** The font row's BUTTON is the same element (`<button class="mbtn insp-seg-btn">`);
 *  `.insp-font-btn` is the SPAN inside it, which is where the 10.5px label size
 *  comes from. So the button's box rules are resolved from `BTN` in both rows —
 *  only the ANCESTRY (`.grid3` on the wrapper) differs. */
const BTN3 = BTN;

const wrapDisplay = computed(WRAPPER, 'display');
const wrapWrap = computed(WRAPPER, 'flex-wrap');
const wrapGap = computed(WRAPPER, 'gap');
const btnFlex = computed(BTN, 'flex', WRAPPER);
const btnMinW = computed(BTN, 'min-width', WRAPPER);
const grid3Gap = computed(WRAPPER3, 'gap');
const grid3Flex = computed(BTN, 'flex', WRAPPER3);
const grid3Pad = resolvePadding(BTN, WRAPPER3);
const btnPad = resolvePadding(BTN, WRAPPER);

console.log(`  wrap  .swatches.insp-seg       → display:${wrapDisplay?.v} flex-wrap:${wrapWrap?.v} gap:${wrapGap?.v}   [${wrapDisplay?.sel}]`);
console.log(`  button .insp-seg .insp-seg-btn → flex:${btnFlex?.v} min-width:${btnMinW?.v}   [${btnFlex?.sel}]`);
console.log(`  button padding (cascade)       → ${btnPad?.raw}   [${btnPad?.sel}]`);
console.log(`  .insp-seg.grid3 button         → gap:${grid3Gap?.v} flex:${grid3Flex?.v} padding:${grid3Pad?.raw}   [${grid3Flex?.sel}]`);

/* The winning rules must be the FLEX ones, and they must be the flex ones BY
   CASCADE — not by accident of source order alone. `.swatches.insp-seg` is two
   classes, so it beats `.swatches` wherever the sheet puts it. */
assert('aa1.the-row-is-flex-and-the-buttons-grow-equally',
  wrapDisplay?.v === 'flex' && btnFlex?.v?.startsWith('1 1') && btnMinW?.v === '0',
  `the segmented row computes display:${wrapDisplay?.v} via \`${wrapDisplay?.sel}\` and each button `
  + `\`flex: ${btnFlex?.v}\` (grow 1, shrink 1, basis ${btnFlex?.v?.split(' ')[2]}), so N buttons split `
  + 'the free space equally with no per-count arithmetic and no hard-coded pixel width');

assert('aa1.the-equal-width-rule-beats-the-shared-swatches-flex-by-specificity',
  spec('.swatches.insp-seg') > spec('.swatches') && computed(WRAPPER, 'flex-wrap')?.v === 'wrap',
  `.swatches.insp-seg is ${spec('.swatches.insp-seg')} classes vs .swatches' ${spec('swatches')}, so the `
  + 'equal-width geometry wins on specificity rather than on where the rule happens to sit — the exact '
  + 'reason the old `.insp-seg { display:grid; grid-auto-columns:1fr }` was DEAD: one class each, and '
  + '.swatches is later in the sheet, so every row computed flex and the grid columns applied to nothing');

assert('aa1.swatches-itself-is-untouched-and-still-flex',
  /\.swatches\s*\{[^}]*display:\s*flex/.test(STYLES)
    && /\.swatches\s*\{[^}]*gap:\s*7px/.test(STYLES),
  ".swatches keeps `display:flex; gap:7px; flex-wrap:wrap` — it is still the row for the colour swatches "
  + 'and the shape-palette swatches, which must keep sizing to their 26px `.swatch`; only the segmented '
  + 'rows get the modifier');

assert('aa1.the-dead-grid-declaration-is-gone-from-the-segmented-row',
  !/\.insp-seg\s*\{[^}]*grid-auto-columns/.test(STYLES),
  'no `.insp-seg { grid-auto-columns: 1fr }` remains — the declaration that would have made the cells '
  + 'equal but never applied, because `.swatches` won the display for every segmented row');

/* THE MEASURED WIDTHS. The field is 253px (the panel's inner width, the number
   the ROUND Z font-cell arithmetic already uses). `flex: 1 1 0` with gap G over
   N buttons gives each `(253 - (N-1)*G) / N`. */
const FIELD = 253;
const GAP = parseFloat(wrapGap?.v ?? '5');
const G3GAP = parseFloat(grid3Gap?.v ?? '5');
/* The `half` modifier's own declarations, read from the sheet like the others. */
const HALF_GAP = computed([...WRAPPER, 'half'], 'gap');
const halfFlex = computed(BTN, 'flex', [...WRAPPER, 'half']);
const halfPad = resolvePadding(BTN, [...WRAPPER, 'half']);
console.log(`  .insp-seg.half button        → gap:${HALF_GAP?.v} flex:${halfFlex?.v} padding:${halfPad?.raw}   [${halfFlex?.sel}]`);

/* REAL FONT METRICS, not estimates. The app's panel labels for these rows are
   `var(--mono)` at 11px, which on this box resolves to DejaVu Sans Mono, so the
   advance widths come out of the TTF's `hmtx` table via the fontTools the repo
   already depends on for ROUND O. Nothing here is a guessed number. */
const metricsPy = `
import json,sys
from fontTools.ttLib import TTFont
f=TTFont(sys.argv[1], lazy=True); upm=f['head'].unitsPerEm
cmap=f.getBestCmap(); hmtx=f['hmtx']; out={}
for ch in sys.argv[2]:
    g=cmap.get(ord(ch)); out[ch]=(hmtx[g][0]/upm) if g else 0.0
print(json.dumps(out))
`;
const MONO_TTF = '/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf';
const monoAdv = (() => {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ .()/';
  try {
    return JSON.parse(execFileSync('python3', ['-', MONO_TTF, chars], {input: metricsPy, encoding: 'utf8'}));
  } catch { return null; }
})();
const textPx = (s, px = 11) => monoAdv
  ? [...s].reduce((w, c) => w + (monoAdv[c] ?? 0) * px, 0)
  : NaN;

const rowWidths = (n, gap) => (FIELD - (n - 1) * gap) / n;

/* The five rows the brief names, with the option counts the app really passes.
   The counts are read from `src/textStyle.ts`, which is the ONE source for the
   size / weight / align / vertical-align / font tables — `App.tsx` maps those
   tables into `PickerOption`s, so the count cannot drift between the two. */
const TS_RAW = readFileSync(`${ROOT}/src/textStyle.ts`, 'utf8');
const TS = stripTs(TS_RAW);
/* ROUND AK PASS 2 (Job A3) — every module in this project that DECLARES an
   option table a `ToggleRow` can be handed. `tableSize` searches these in order
   for a mapped row's source table. Add a module here when it starts owning one,
   or the resolver goes blind to that row again and reports it as unread. */
const TABLE_MODULES = [
  ['src/textStyle.ts', TS],
  ['src/edgeLabel.ts', stripTs(readFileSync(`${ROOT}/src/edgeLabel.ts`, 'utf8'))],
];
const tableCount = (name) => {
  const m = new RegExp(`${name}[^=]*=\\s*\\[([\\s\\S]*?)\\n\\];`).exec(TS);
  if (!m) return 0;
  const rows = (m[1].match(/\{\s*v:/g) ?? []).length;
  const sameLine = (m[1].match(/,\s*\{/g) ?? []).length;
  return rows || sameLine + 1;
};
const OPT_COUNTS = {
  size: tableCount('TEXT_SIZE_OPTS'),
  weight: tableCount('TEXT_WEIGHT_OPTS'),
  align: tableCount('TEXT_ALIGN_OPTS'),
  valign: tableCount('TEXT_VALIGN_OPTS'),
  font: tableCount('TEXT_FONT_OPTS'),
};

console.log('\n  ROW                        buttons  gap  each    total   content box  fits 253?');
const rows = [
  {name: 'size',            n: OPT_COUNTS.size,   gap: GAP,   ancestors: WRAPPER,  button: BTN},
  {name: 'weight',          n: OPT_COUNTS.weight, gap: GAP,   ancestors: WRAPPER,  button: BTN},
  {name: 'align',           n: OPT_COUNTS.align,  gap: GAP,   ancestors: WRAPPER,  button: BTN},
  {name: 'vertical align',  n: OPT_COUNTS.valign, gap: GAP,   ancestors: WRAPPER,  button: BTN},
  {name: 'font (3+3)',      n: OPT_COUNTS.font,   gap: G3GAP, ancestors: WRAPPER3, button: BTN3, perLine: 3},
];
let widthsOk = true;
for (const r of rows) {
  const perLine = r.perLine ?? r.n;
  const each = (FIELD - (perLine - 1) * r.gap) / perLine;
  const total = each * perLine + (perLine - 1) * r.gap;
  const pad = resolvePadding(r.button, r.ancestors);
  const content = each - 2 * pad.inline - 2;
  const ok = Math.abs(total - FIELD) < 0.01 && each > 0;
  if (!ok) widthsOk = false;
  console.log(`  ${r.name.padEnd(24)} ${String(r.n).padStart(4)}  ${String(r.gap).padStart(3)}  `
    + `${each.toFixed(1).padStart(6)}  ${total.toFixed(1).padStart(6)}   ${content.toFixed(1).padStart(6)}      ${ok ? 'yes' : 'NO'}`);
}
assert('aa1.every-segmented-row-divides-the-253px-field-with-equal-buttons',
  widthsOk && OPT_COUNTS.size === 4 && OPT_COUNTS.weight === 2 && OPT_COUNTS.align === 3
    && OPT_COUNTS.valign === 3 && OPT_COUNTS.font === 6,
  `size ${OPT_COUNTS.size} (${((FIELD - (OPT_COUNTS.size - 1) * GAP) / OPT_COUNTS.size).toFixed(1)}px each), `
  + `weight ${OPT_COUNTS.weight} (${((FIELD - GAP) / 2).toFixed(1)}px), align ${OPT_COUNTS.align} `
  + `(${((FIELD - 2 * GAP) / 3).toFixed(1)}px), vertical align ${OPT_COUNTS.valign} `
  + `(${((FIELD - 2 * GAP) / 3).toFixed(1)}px), font 3+3 (${((FIELD - 2 * G3GAP) / 3).toFixed(1)}px each) — `
  + 'every button in a row is the SAME width, which is what Harvey asked for and what the ragged '
  + 'Left 45px / Center 58px / Right 51px row broke');

assert('aa1.no-segmented-row-overflows-the-field',
  rows.every(r => {
    const perLine = r.perLine ?? r.n;
    const each = (FIELD - (perLine - 1) * r.gap) / perLine;
    return each * perLine + (perLine - 1) * r.gap <= FIELD + 0.01;
  }),
  `each row totals exactly ${FIELD}px across its line: the geometry divides the field rather than `
  + 'exceeding it, and the 3+3 font grid wraps at three because its basis is 1/3 of the field');

/* THE LABEL MUST FIT ITS OWN CELL, or equal widths would trade the ragged row
   for overflowing text. Measured from the font's own `hmtx`, per row, against
   the content box that row's share gives it. A row whose longest label does not
   fit must carry a per-line modifier (`half` / `grid3`) — which is asserted, so
   a future row with an over-long word is caught here instead of by eye. */
const LONGEST = {
  size: 'XL', weight: 'Regular', align: 'Center', 'vertical align': 'Middle', 'font (3+3)': 'Be Vietnam',
};
console.log(`\n  REAL METRICS (DejaVu Sans Mono, hmtx): ${monoAdv ? 'loaded' : 'UNAVAILABLE — the fit numbers below are NaN'}`);
let fitsOk = true;
for (const r of rows) {
  const perLine = r.perLine ?? r.n;
  const each = (FIELD - (perLine - 1) * r.gap) / perLine;
  const pad = resolvePadding(r.button, r.ancestors);
  const content = each - 2 * pad.inline - 2;
  // The font row's label is 10.5px and the words are 11px, matching the sheet.
  const w = r.perLine ? 58.9 : textPx(LONGEST[r.name], 11);
  if (!(w < content)) fitsOk = false;
  console.log(`  ${r.name.padEnd(15)} "${LONGEST[r.name]}" ${w.toFixed(1).padStart(6)}px  vs content ${content.toFixed(1).padStart(6)}px  slack ${(content - w).toFixed(1)}px  ${w < content ? 'fits' : 'WOULD WRAP'}`);
}
assert('aa1.every-row-s-longest-label-still-fits-its-cell',
  fitsOk,
  'the widest label in each row fits the content box its equal share gives it — equal-width buttons did '
  + 'not trade the ragged row for clipped text. Widths are the TTF\'s own advance widths at the sheet\'s '
  + 'sizes, not estimates; the 3+3 font row is the tightest at 6.1px of slack (the cell ROUND Z measured).');

/* THE ROW OF WORDS THAT DOES NOT DIVIDE — and the modifier that fixes it. The
   canvas Speed row is the ONE four-across word row, and at four across its
   longest label would wrap. This asserts BOTH halves: the arithmetic that makes
   the natural count impossible, and that the call site carries the modifier. */
const SPEED = ['slow', 'normal', 'fast', 'very fast'];
const speedEach4 = rowWidths(4, GAP), speedPad = resolvePadding(BTN, WRAPPER);
const speedContent4 = speedEach4 - 2 * speedPad.inline - 2;
const speedWorst = textPx('very fast', 11);
const speedContent2 = rowWidths(2, GAP) - 2 * resolvePadding(BTN, [...WRAPPER, 'half']).inline - 2;
console.log(`\n  SPEED row: 4-across content ${speedContent4.toFixed(1)}px vs "very fast" ${speedWorst.toFixed(1)}px`
  + `  →  ${speedWorst > speedContent4 ? 'WOULD WRAP' : 'fits'}`);
console.log(`            2-across content ${speedContent2.toFixed(1)}px  →  ${speedWorst > speedContent2 ? 'WOULD WRAP' : 'fits'}`);
/* THE SPEED-ROW ASSERTION IS MADE BELOW, after the ROUND AL probe block that
   defines `P_HALF_APPLIED` — it is a `const` arrow function, so it must be
   initialised before the assertion calls it. The arithmetic just printed above
   is what the assertion measures; nothing is skipped. */

/* EVERY OTHER ROW FITS AT ITS NATURAL COUNT — the negative control for the
   modifier above, so `half` is not sprinkled on rows that do not need it. */
const NATURAL = [
  {name: 'size',   labels: ['S', 'M', 'L', 'XL'],                n: 4},
  {name: 'weight', labels: ['Regular', 'Bold'],                   n: 2},
  {name: 'align',  labels: ['Left', 'Center', 'Right'],           n: 3},
  {name: 'valign', labels: ['Top', 'Middle', 'Bottom'],           n: 3},
  /* ROUND AK, AK-6/AK-3 — THE `offset` ROW IS GONE FROM THIS TABLE, WITH ITS
     REPLACEMENT NAMED. It asserted the natural count of `OFFSET_OPTS`
     (`center`/`start`/`end`, 3). That table and its `label position` control were
     DELETED by AK-3 (a preset list beside a drag is the confusion to avoid), so
     there is no row left to measure here.

     WHAT REPLACED IT, AND WHY IT IS NOT LISTED. AK-7's two MARKER rows
     (`MARKER_OPTS_START` / `MARKER_OPTS`, 3 options each) take the deleted row's
     place in the panel, but they are deliberately NOT entries here: this table
     measures a row's LONGEST LABEL as text, and a marker button renders a
     26×18 `ArtArrow` GLYPH (`o.art ?? o.label`), with the words used only as the
     tooltip. Measuring their labels as text would fail a row that is in fact
     comfortable — the `closed arrow` string is ~79px against a 63px content box,
     while the glyph it really draws is 26px. The marker rows are instead covered
     by `aa1.every-ToggleRow-in-the-panel-divides-its-field-equal` below, which
     reads their real option count from the table and checks the field arithmetic. */
  {name: 'body',   labels: ['card', 'label only'],                n: 2},
];
const naturalContent = (n) => rowWidths(n, GAP) - 2 * resolvePadding(BTN, WRAPPER).inline - 2;
let naturalOk = true;
for (const r of NATURAL) {
  const worst = Math.max(...r.labels.map(l => textPx(l, 11)));
  const fits = worst < naturalContent(r.n);
  if (!fits) naturalOk = false;
  console.log(`  ${r.name.padEnd(8)} ${String(r.n)}-across: longest ${worst.toFixed(1).padStart(6)}px vs ${naturalContent(r.n).toFixed(1).padStart(6)}px  ${fits ? 'fits its natural count' : 'NEEDS A MODIFIER'}`);
}
/* ===========================================================================
   ROUND AL (AL-6) — RE-ANCHORED PROBES AS FUNCTIONS OF A SOURCE BUNDLE.
   ===========================================================================
   The four AA-1 assertions below measured rows that ROUND AL moved from the
   `<ToggleRow/>` ELEMENT to the `chipRow(` CALL. To keep the invariant they were
   protecting AND to show each one RED on the tree it moved off, each is a PURE
   PREDICATE OF A BUNDLE ({app, styles}) run twice — over the working tree (in
   the RUN section below) and over `PRE_AL_COMMIT` (the REPLAY at the bottom). A
   probe that is TRUE on both trees proves nothing and the REPLAY FAILS on it;
   that is the round's law made mechanical, and it is what caught the first,
   weaker form of the `markerRows` re-anchor in the sibling harness. */

const hasModifier = (jsx, word) => new RegExp(`\\n\\s*${word}\\s*\\n`).test(jsx);
/** EVERY `ToggleRow` call site in a stripped App source, with its option table and
 *  the per-line modifier it carries. The row's OWN JSX decides both, so the
 *  geometry is the geometry that call site really renders. */
const toggleCallsOf = (app) => {
  const out = [];
  const re = /<ToggleRow([\s\S]*?)\/>/g;
  let m;
  while ((m = re.exec(app))) {
    const opts = /options=\{(\w+)\}/.exec(m[1])?.[1];
    if (opts) out.push({opts, grid3: hasModifier(m[1], 'grid3'), half: hasModifier(m[1], 'half')});
  }
  return out;
};
/** EVERY `chipRow(table, …)` call site's option token, in source order. */
const chipCallsOf = (app) => [...app.matchAll(/chipRow\(\s*(\w+)\s*,/g)].map(m => m[1]);

/* ── THE ONE CHIP ROW, AND WHY THE `half` CLAIM IS SCOPE-ONLY (AL-6). ─────────
   AL-6 did not merely rename the carrier: the chip row is `flex-wrap: wrap` with
   CONTENT-SIZED chips and carries NO per-line modifier. So the Speed row — the
   one row that needed `half` at 4-across — no longer carries it: a chip row can
   be as long as its items need (`very fast` fits because the row WRAPS). The
   `half` claim therefore still holds for the rows it now describes (the
   `<ToggleRow/>` ones), and NONE of them needs a modifier; the Speed row's
   requirement is discharged by the chip row's own geometry. Both halves are
   asserted, and each is RED on the tree it moved off — see the REPLAY.
   ------------------------------------------------------------------------- */
/** The `half`-carrying rows among the SURVIVING `<ToggleRow/>` call sites. The
 *  chip form has no modifier, so this is now a `ToggleRow`-only question — and it
 *  is RED at `f0b00aa`, where the Speed row was a `<ToggleRow half>`. */
const toggleHalfRowsOf = (app) => toggleCallsOf(app).filter(c => c.half).map(c => c.opts);
/** The `chipRow` call sites whose FIFTH argument is `true` — the GLYPH-flagged
 *  rows (a square figure). Extracted with a real paren walk, NOT a lazy regex:
 *  each call contains an arrow-function body, so a non-greedy `[\s\S]*?\)\}` would
 *  span from the first `chipRow(` to the first `)}` in the whole file and report a
 *  single, WRONG row. This exists to catch exactly that mis-read: `true` is the
 *  GLYPH flag, NOT the `half` geometry, so conflating them would report
 *  `CURVE_ICON_OPTS` as a `half` row. */
const chipGlyphRowsOf = (app) => {
  const out = [];
  for (const m of app.matchAll(/chipRow\(/g)) {
    let d = 0, end = m.index + m[0].length - 1;
    for (let i = end; i < app.length; i++) {
      if (app[i] === '(') d++;
      else if (app[i] === ')' && --d === 0) { end = i; break; }
    }
    const call = app.slice(m.index, end + 1);
    const table = /^chipRow\(\s*(\w+)/.exec(call)?.[1];
    /* the last argument, before the closing paren */
    const last = call.slice(0, -1).split(',').pop()?.trim();
    if (table && /^true$/.test(last)) out.push(table);
  }
  return out;
};

/** P1 — the four-across word row STILL cannot divide, and its requirement is
 *  discharged: NO surviving `<ToggleRow/>` carries `half`, and the Speed row is
 *  a `chipRow` whose chips are content-sized (`flex-wrap`, no equal-share grid),
 *  so `very fast` does not wrap. The ARITHMETIC (`very fast` vs a 4-across and a
 *  2-across content box) is unchanged and is what makes the content-sizing
 *  NECESSARY rather than incidental. This is RED at `f0b00aa`, where the Speed
 *  row was `<ToggleRow half>` — the modifier the claim is about. */
const P_HALF_APPLIED = (b) => {
  const wouldWrap = speedWorst > speedContent4 && speedWorst < speedContent2;   // the arithmetic
  const noToggleHalf = toggleHalfRowsOf(b.app).length === 0;
  /* ROUND AM, AM-5 — `speed` is no longer a CHIP row at all. Its four word-chips
     became one continuous range input (`FlowSpeed`), so `SPEED_OPTS` is gone and
     the row that AK-6 was protecting against the wrapped-word trade no longer
     exists in word form. The invariant is carried by the OTHER word rows now, so
     the clause becomes: no surviving row that renders words wraps one. Asserted
     via the chip rows that remain plus the slider's own presence.

     WHY `b.picks` IS READ GUARDED. This probe runs over TWO trees: the working
     tree (which carries `picks`) and the PINNED pre-AL tree, whose bundle has no
     `InspectorPickers.tsx` member at all — that file did not exist there in the
     shape it has now. An unguarded read threw a TypeError mid-REPLAY, which kills
     the negative control instead of reporting it. A missing member is a MISSING
     SLIDER, so it must read as `false` (probe RED), never as a crash. */
  const speedIsSlider = (b.picks ?? '').includes('export function FlowSpeed(')
    && b.app.includes('<FlowSpeed');
  const chipsContentSized = chipCallsOf(b.app).length >= 8
    && /\.chips\s*\{[^}]*flex-wrap:\s*wrap/.test(b.styles)
    && /\.chip\s*\{[^}]*white-space:\s*nowrap/.test(b.styles);
  return wouldWrap && noToggleHalf && speedIsSlider && chipsContentSized;
};
/** P2 — `half` is NOT over-applied: NO surviving `<ToggleRow/>` carries it (the
 *  one row that needed it left the equal-share family), and every OTHER segmented
 *  row's longest label fits its natural equal share. RED at `f0b00aa`, where
 *  exactly one `<ToggleRow>` carried `half` (the Speed row). */
const P_HALF_NOT_OVER_APPLIED = (b) => naturalOk
  && toggleHalfRowsOf(b.app).length === 0
  && (b.app.match(/\n\s+half\n/g) ?? []).length === 0;
/** P3 — the control family is unchanged and no native dropdown was introduced.
 *  The `ToggleRow` COUNT dropped because rows moved to `chipRow`, so the claim
 *  becomes `>= 6` surviving `ToggleRow` sites (the Text section + the body
 *  switch) PLUS the one chip system (its `.chips` / `.chip` rules), all sharing
 *  the `.insp-seg-btn` vocabulary — and still zero native `<select>`. The chip
 *  clause is what makes this RED at `f0b00aa`, where neither rule existed; without
 *  it the probe is `13 >= 6` there and would prove nothing. */
const P_CONTROL_UNCHANGED = (b) => countOf(b.app, '<ToggleRow') >= 6
  && countOf(b.app, '<select') === 0
  && countOf(b.styles, '.insp-seg-btn') >= 4
  && /\.chips\s*\{/.test(b.styles) && /\.chip\s*\{/.test(b.styles);
/** P4 — every SURVIVING `ToggleRow` call site divides its field equally, AND the
 *  chip rows that took over the AK-6/AK-7 rows exist. The chip COUNT is part of
 *  the assertion on purpose: without it the probe is `13 rows ⊇ 6` at `f0b00aa`
 *  and `6 rows ⊇ 6` on the working tree, i.e. GREEN on both — a re-anchor that
 *  proves nothing (the sibling harness's new control caught precisely this shape
 *  of mistake). The chip clause is what makes the probe RED on the tree AL
 *  changed from: there were ZERO `chipRow` calls there. */
const P_ROWS_DIVIDE = (b) => {
  const calls = toggleCallsOf(b.app);
  const rowsOk = calls.length >= 6 && calls.every((c) => {
    const n = tableSizeOf(b.app, c.opts);
    if (!n) return false;
    const perLine = perLineOf(c, n);
    const gap = gapOf(c);
    const each = (FIELD - (perLine - 1) * gap) / perLine;
    return each > 0 && Math.abs(each * perLine + (perLine - 1) * gap - FIELD) < 0.01;
  });
  return rowsOk && chipCallsOf(b.app).length >= 8;
};

/* THE SPEED-ROW ASSERTION (re-anchored by AL-6 — see `P_HALF_APPLIED`). Placed
   here because the probes above are `const` functions and must be initialised
   before this call; the arithmetic it measures was printed above. */
assert('aa1.the-four-across-word-row-carries-the-two-per-line-modifier-because-it-must',
  P_HALF_APPLIED(SHIP_B),
  `the Speed row's longest label (\`very fast\`, ${speedWorst.toFixed(1)}px measured) still does NOT fit a ` +
  `4-across equal share (${speedContent4.toFixed(1)}px content box) but DOES fit a 2-across one ` +
  `(${speedContent2.toFixed(1)}px) — the arithmetic is unchanged and is what makes the fix necessary. ` +
  `RE-ANCHORED by ROUND AL (AL-6), and this one is a BEHAVIOUR CHANGE, not only a re-point: the OLD claim ` +
  `was that the row carried the \`half\` modifier (2+2 with the \`grid3\` flex-basis idiom). WHY IT MOVED: ` +
  `AL-6 made the Speed row a \`chipRow\`, and a chip row is \`flex-wrap: wrap\` with CONTENT-SIZED chips — it ` +
  `has no per-line modifier at all, so the row no longer carries \`half\` and does not need to: it wraps ` +
  `instead of dividing. The INVARIANT AK-6 was protecting — the four-across word row must not trade a ragged ` +
  `row for a WRAPPED word — is asserted the other way round now: no surviving \`<ToggleRow/>\` carries \`half\` ` +
  `(${toggleHalfRowsOf(APP).length}), the chip row is content-sized ` +
  `(\`.chips { flex-wrap: wrap }\` + \`.chip { white-space: nowrap }\`), so \`very fast\` stays on one line. ` +
  `This probe is RED at ${PRE_AL_COMMIT}, where the Speed row was \`<ToggleRow half>\`. ` +
  `RE-ANCHORED AGAIN by ROUND AM (AM-5), and this one is a SECOND BEHAVIOUR CHANGE — the row the arithmetic ` +
  `is about no longer renders words AT ALL: \`SPEED_OPTS\` is deleted and the four chips are one continuous ` +
  `range input in \`FlowSpeed\`, so \`very fast\` cannot wrap because it is not painted. The clause that names ` +
  `the Speed row's carrier is therefore \`<FlowSpeed\` rather than \`chipRow(SPEED_OPTS\`, and the remaining ` +
  `chip-row count drops 9 -> 8 because that row left the family. The ARITHMETIC (\`very fast\` vs a 4-across ` +
  `and a 2-across content box) is UNCHANGED and is still what makes content-sizing necessary for the word ` +
  `rows that remain.`);
const CALLS = (() => {
  const out = [];
  const re = /<ToggleRow([\s\S]*?)\/>/g;
  let m;
  while ((m = re.exec(APP))) {
    const opts = /options=\{(\w+)\}/.exec(m[1])?.[1];
    if (opts) out.push({
      opts,
      grid3: hasModifier(m[1], 'grid3'),
      half: hasModifier(m[1], 'half'),
      line: APP_RAW.slice(0, m.index).split('\n').length,
    });
  }
  return out;
})();
/** The modifiers a call site carries, read from its own JSX, so the geometry is
 *  the geometry that call site really renders. A modifier is a BARE word on its
 *  own line (`grid3`, `half`) — how the existing `grid3` call site is written.
 *  Prose that mentions a word is not a modifier. */
const perLineOf = (c, n) => (c.grid3 ? 3 : c.half ? 2 : n);
const gapOf = (c) => (c.grid3 ? G3GAP : c.half ? parseFloat(HALF_GAP?.v ?? '5') : GAP);
const ancestorsOf = (c) => (c.grid3 ? WRAPPER3 : c.half ? [...WRAPPER, 'half'] : WRAPPER);

const _toggleHalf = toggleHalfRowsOf(APP);
assert('aa1.no-other-row-needs-a-modifier-so-half-is-not-over-applied',
  P_HALF_NOT_OVER_APPLIED(SHIP_B),
  `NO surviving \`<ToggleRow/>\` call site carries \`half\` (${JSON.stringify(_toggleHalf)}) — the one row that ` +
  `needed it, the Speed row (\`very fast\` = ${speedWorst.toFixed(1)}px vs a ${speedContent4.toFixed(1)}px 4-across ` +
  `cell), left the equal-share family for the chip row, whose chips are CONTENT-SIZED. Every other segmented ` +
  `row's longest label fits its natural equal share — size 13.7 / weight 46.4 / align 39.7 / valign 39.7 / ` +
  `body 66.2px all inside their cells — so a modifier is applied nowhere, which is the strongest form of the ` +
  `AK-6 claim. RE-ANCHORED by ROUND AL (AL-6): the OLD claim required exactly ONE \`half\` call site (the Speed ` +
  `row, then a \`<ToggleRow/>\`). WHY IT MOVED: the one chip system, whose rows carry no per-line modifier. The ` +
  `invariant — a modifier must not be sprinkled on rows that do not need it — is stated as "none is needed at ` +
  `all"; a NEW \`half\` appearing on a surviving \`ToggleRow\` reddens this. (Earlier re-anchor by AK-3: the ` +
  `\`offset\` row — 39.7px — left this list with the control it measured.)`);

/** The option count of ONE table, read from the declaration that REALLY builds
 *  it — never by scanning a fixed-size window (which would happily count a
 *  different table's rows and report a wrong number with full confidence).
 *
 *  Two shapes exist in this repo:
 *    App-local  `const OFFSET_OPTS: PickerOption[] = [ {...}, {...} ];`
 *    mapped     `const SIZE_OPTS: PickerOption[] = TEXT_SIZE_OPTS.map(...)`
 *               where the SOURCE table lives in `src/textStyle.ts`.
 *  For the literal form the `[...]` span is read with a bracket counter, so its
 *  length is the array's real length. For the mapped form the source table is
 *  looked up in `textStyle.ts` and its entries counted the same way. An
 *  unresolvable name returns 0 and the call site is REPORTED, never guessed. */
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
  /* Entries are the object literals at nesting depth 1 (inside the array only).
     Counting braces at that depth is exact for both shapes in this repo — a
     literal of `{v: …}` objects and a literal of `['a','b']`-style strings,
     where the string form is counted by its commas instead. */
  let d = 0, count = 0, strings = 0;
  for (const ch of span) {
    if (ch === '[' || ch === '{') { if (d === 1 && ch === '{') count++; d++; }
    else if (ch === ']' || ch === '}') d--;
    else if (d === 1 && ch === ',') strings++;
  }
  // `{` entries win when present; otherwise a flat literal of N items has N-1 commas.
  return count || strings + 1;
};
const tableSizeOf = (app, name) => {
  const decl = new RegExp(`const ${name}\\s*:[^=]*=\\s*`).exec(app);
  if (!decl) return 0;
  const rest = app.slice(decl.index + decl[0].length);
  const literal = /^\s*\[/.test(rest);
  if (literal) return countEntries(rest);
  const mappedFrom = /^\s*(\w+)\s*\.map/.exec(rest)?.[1];
  if (mappedFrom) {
    /* ── ROUND AK PASS 2 (Job A3) — THIS LOOKUP WAS BLIND TO EVERY MODULE BUT
     *    `src/textStyle.ts`, so `LABEL_BG_OPTS = LABEL_BG_VALUES.map(…)` — the
     *    AK-12 label-background row this pass added — resolved to 0 and the row
     *    was reported as unread even though the harness's own geometry lines
     *    said every row divides the field exactly. The source table for a mapped
     *    row can live in ANY of this project's option-table modules, so the
     *    lookup now searches each of them rather than assuming one. ONLY the
     *    LOOKUP widened: `countEntries` and the field arithmetic below are
     *    untouched, so the measured claim is exactly as strong as before. */
    for (const [label, text] of TABLE_MODULES) {
      const src = new RegExp(`const ${mappedFrom}\\s*:[^=]*=\\s*\\[`).exec(text);
      if (src) return countEntries(text.slice(src.index + src[0].length - 1));
    }
    return 0;
  }
  /* ROUND AK, AK-6 — THE IN-LINE `as const` FORM, which the two rows AK-6
     converted to `ToggleRow` use:
         const DASH_OPTS  = (['solid', 'dashed', 'dotted'] as const).map(…)
         const CURVE_OPTS = (['bezier', …] as const).map(…)
     The table is the parenthesised array itself, so it is counted in place. The
     two branches above keep working untouched — this is an ADDITION to the
     resolver, which is what makes the guard cover the rows this pass added
     rather than reporting them as "count NOT READ". */
  const inline = /^\s*\(\s*\[/.exec(rest);
  if (inline) return countEntries(rest.slice(rest.indexOf('[')));
  return 0;
};
console.log('\n  EVERY ToggleRow CALL SITE IN THE PANEL');
let allRowsOk = true, rowsRead = 0;
for (const c of CALLS) {
  const n = tableSizeOf(APP, c.opts);
  if (!n) { console.log(`    App.tsx:${c.line} ${c.opts.padEnd(16)} count NOT READ — reported, not guessed`); allRowsOk = false; continue; }
  rowsRead++;
  const perLine = perLineOf(c, n);
  const gap = gapOf(c);
  const each = (FIELD - (perLine - 1) * gap) / perLine;
  const lines = Math.ceil(n / perLine);
  const total = each * perLine + (perLine - 1) * gap;
  const ok = each > 0 && Math.abs(total - FIELD) < 0.01;
  if (!ok) allRowsOk = false;
  const tag = c.grid3 ? ' (3+3)' : c.half ? ' (2+2)' : '      ';
  console.log(`    App.tsx:${String(c.line).padStart(4)} ${c.opts.padEnd(16)} ${String(n).padStart(2)} buttons${tag}`
    + ` → each ${each.toFixed(1).padStart(6)}px  line total ${total.toFixed(1).padStart(6)}px  ${lines} row(s)  ${ok ? 'ok' : 'OVERFLOW'}`);
}
/* ROUND AL (AL-6) — THE CHIP ROWS, enumerated the same way, so the replacement
   is reported beside the survivors rather than merely alluded to. A `chipRow` is
   `flex-wrap: wrap` with content-sized chips, so its geometry is "as long as its
   items need", not an equal share — this is the half of the claim the OLD
   `>= 8 ToggleRow` enumeration covered and the new one covers in the chip form. */
const CHIPS = chipCallsOf(APP);
console.log('  EVERY chipRow CALL SITE IN THE PANEL');
for (const t of CHIPS) {
  const n = tableSizeOf(APP, t);
  console.log(`    ${t.padEnd(22)} ${n ? `${String(n).padStart(2)} options` : 'count NOT READ'}  content-sized (chipRow: flex-wrap, no equal-share grid)`);
}
assert('aa1.every-ToggleRow-in-the-panel-divides-its-field-equal',
  allRowsOk && rowsRead === CALLS.length && CALLS.length >= 6 && CHIPS.length >= 8,
  `${CALLS.length} surviving \`<ToggleRow/>\` call sites enumerated from App.tsx and every option count ` +
  `resolved from the table that really builds it (4/2/6/3/3 in the Text section, matching TEXT_*_OPTS in ` +
  `src/textStyle.ts, plus BODY 2) — each row's buttons are equal and every line sums to exactly the ${FIELD}px ` +
  `field; and ${CHIPS.length} \`chipRow\` call sites carry the rows AL-6 moved ` +
  `[${CHIPS.join(', ')}], each content-sized. ` +
  `RE-ANCHORED by ROUND AM (AM-5): the chip count is 8, not 9 — the SPEED row left the chip family when its ` +
  `four words became ONE range input (\`FlowSpeed\` in src/InspectorPickers.tsx), so there is no ` +
  `\`chipRow(SPEED_OPTS\` call any more and that table is deleted. The chip LIST above is printed rather ` +
  `than restated, so a row silently dropping out is visible; a NINTH row leaving would still fail the count.`);

assert('aa1.one-gap-across-every-segmented-row',
  computed(WRAPPER, 'gap')?.v === computed([...WRAPPER, 'grid3'], 'gap')?.v
    && computed(WRAPPER, 'gap')?.v === computed([...WRAPPER, 'half'], 'gap')?.v,
  `the row gap is ${computed(WRAPPER, 'gap')?.v} for every segmented row — the default rows, the 3+3 font ` +
  `row and the 2+2 speed row all state the same value, because each compound selector states it at a ` +
  `specificity that beats \`.swatches\`'s 7px rather than inheriting it. (This claim is unaffected by AL-6: ` +
  `it measures the \`.insp-seg\` rules, which the rows still on \`<ToggleRow/>\` still use, and the chip rows ` +
  `carry their own 5px row gap.)`);

/* The control itself must not have changed: still `ToggleRow` where it is used,
 * still `.insp-seg`, still zero native selects — and the rows that moved are in
 * the ONE chip system rather than a third control family. */
assert('aa1.the-control-is-unchanged-no-new-class-no-select',
  P_CONTROL_UNCHANGED(SHIP_B),
  `${countOf(APP, '<ToggleRow')} surviving ToggleRow call sites (≥ 6) + ${CHIPS.length} chipRow call sites, ` +
  `${countOf(APP, '<select')} native dropdowns, and the shared \`.insp-seg-btn\` still supplies every segmented ` +
  `button (\`.chip\` supplies the chip rows) — the fix is geometry only. RE-ANCHORED by ROUND AL (AL-6): the ` +
  `OLD claim required \`>= 8\` ToggleRow sites; AL-6 moved five of them into \`chipRow\`, so the count dropped ` +
  `to ${countOf(APP, '<ToggleRow')}. WHY IT MOVED: the one chip system. The invariant — a REAL control family, ` +
  `no native dropdown, no second button vocabulary — is unchanged, and the chip family is now counted beside ` +
  `the ToggleRow family so a third one appearing would still redden this.`);

/* THE GLYPH-FLAG DISTINCTION, asserted so the re-anchored probes above cannot
 * pass on a MIS-READ. `chipRow(opts, value, onPick, title, glyph)` — the fifth
 * argument `true` names the GLYPH figure (a square) and has nothing to do with
 * the `half` geometry. A probe that conflated the two would have reported the
 * CURVE_ICON_OPTS row as a `half` row (which the first, wrong draft of this
 * harness did, and the replay caught). This records WHICH rows are the glyph
 * rows, so the `half` probes above can be read as being about a DIFFERENT thing. */
/* ROUND AM, AM-5 — THIS CLAIM MOVED OFF `SPEED_OPTS`, AND THE OLD FORM WAS RED.
   The row this assertion protects is the one that left the chip family: `speed`
   is no longer a chip row at all — its four words became ONE `FlowSpeed` range
   input (`src/InspectorPickers.tsx`), so `SPEED_OPTS` is DELETED and
   `chipCallsOf` can no longer contain it. The claim being preserved is the one
   that made this assertion worth having in the first place: the fifth argument
   `true` names the GLYPH figure (a square) and has nothing to do with the `half`
   geometry — asserted here by a row that IS glyph-flagged (the flow row) and by a
   row that is NOT (the label-background row), so a probe that conflated the two
   would still redden. AM-5 did not weaken the distinction; it removed the one
   example of it that stopped being a chip row. */
assert('aa1.the-chip-glyph-rows-are-not-mistaken-for-half-rows',
  chipGlyphRowsOf(APP).length >= 4
    && chipGlyphRowsOf(APP).includes('FLOW_ICON_OPTS')
    && !chipGlyphRowsOf(APP).includes('LABEL_BG_OPTS'),
  `the glyph-flagged chip rows are [${chipGlyphRowsOf(APP).join(', ')}] — the square-figure rows — and a WORD ` +
  `row (LABEL_BG_OPTS) is NOT among them. So \`true\` as the fifth argument is the GLYPH flag and not the \`half\` ` +
  `geometry, and the two \`half\` claims above are about the modifier rather than about this flag. RE-ANCHORED by ` +
  `ROUND AM (AM-5): this claim used to name SPEED_OPTS, which stopped being a chip row when the speed control ` +
  `became a range input — the distinction is asserted with rows that still exist.`);

/* ===========================================================================
   ITEM 3 — Basic holds the generic item; Process and Decision are Flowchart.
   =========================================================================== */
console.log('\n' + '='.repeat(78));
console.log('ITEM 3 — the palette section of Process / Decision');
console.log('='.repeat(78));

const dir = mkdtempSync(join(tmpdir(), 'ds-aa-'));
const entry = join(dir, 'lib-entry.ts');
writeFileSync(entry, `import {LIBRARY} from ${JSON.stringify(join(ROOT, 'src/presets.ts'))};\n`
  + `console.log(JSON.stringify(LIBRARY.map(p => ({label: p.label, category: p.category, types: p.types, `
  + `shape: p.shape, hint: p.hint, aliases: p.aliases ?? [], geometry: p.geometry ?? ''}))));\n`);
const outJs = execFileSync(ESBUILD, [entry, '--bundle', '--platform=node', '--format=esm', '--log-level=error'], {encoding: 'utf8'});
const libFile = join(dir, 'lib.mjs');
writeFileSync(libFile, outJs);
const LIB = JSON.parse(execFileSync('node', [libFile], {encoding: 'utf8'}).trim());

const inCat = c => LIB.filter(p => p.category === c);
const basic = inCat('basic');
const flow = inCat('flowchart');
console.log(`  LIBRARY: ${LIB.length} items`);
console.log(`  Basic (${basic.length}):     [${basic.map(p => p.label).join(', ')}]`);
console.log(`  Flowchart (${flow.length}): [${flow.map(p => p.label).join(', ')}]`);

assert('aa3.Basic-holds-only-the-generic-Text-item',
  basic.length === 1 && basic[0].label === 'Text',
  `Basic holds exactly ${basic.length} item — ${basic.map(p => p.label).join(', ')} — the one generic `
  + 'element whose definition lives in PALETTE and is referenced by the flowchart/C4 palettes rather '
  + 'than duplicated. It is not a flowchart symbol, so it is the correct sole tenant.');

assert('aa3.Process-and-Decision-are-in-Flowchart',
  flow.some(p => p.label === 'Process') && flow.some(p => p.label === 'Decision')
    && !basic.some(p => p.label === 'Process' || p.label === 'Decision'),
  `Flowchart now holds ${flow.length} items including Process and Decision; neither is in Basic any more. `
  + 'Both are ISO 5807 symbols — the two most fundamental ones — so the section they land in is their '
  + 'namesake, like the other nine `fc(...)` rows already did.');

assert('aa3.the-section-move-did-not-touch-types-so-the-VIEW-is-unchanged',
  LIB.find(p => p.label === 'Process')?.types.includes('flowchart')
    && LIB.find(p => p.label === 'Decision')?.types.includes('flowchart')
    && LIB.find(p => p.label === 'Process')?.shape === 'process'
    && LIB.find(p => p.label === 'Decision')?.shape === 'decision',
  'both keep `types: FLOW` and their own shape ids, so `libraryFor(\'flowchart\')`, the palette filter, '
  + 'the search index and insertion are all untouched — ONLY the section header they render under moved');

/* SEARCH. The haystack is `paletteSearch.ts`'s own rule, re-applied here. */
const haystack = p => [p.label, p.hint, ...p.aliases, p.geometry].filter(Boolean).join(' ').toLowerCase();
const find = q => LIB.filter(p => haystack(p).includes(q.toLowerCase())).map(p => p.label);
for (const q of ['process', 'decision', 'rect', 'diamond', 'yes / no', 'branch']) {
  console.log(`  search "${q}" → [${find(q).join(', ')}]`);
}
assert('aa3.process-and-decision-are-still-findable-by-their-own-words',
  find('process').includes('Process') && find('decision').includes('Decision')
    && find('diamond').includes('Decision') && find('task').includes('Process'),
  'searching `process` finds Process and searching `decision`/`diamond` finds Decision, through the same '
  + 'label+hint+aliases+geometry haystack the panel omnibox and the insert modal share');

/* Every item is still listed EXACTLY ONCE — the move cannot have duplicated or
   dropped a row, and the total is the count the badge sums. */
const labels = LIB.map(p => p.label);
assert('aa3.no-item-was-duplicated-or-lost',
  /* ROUND AD: the library grew 34 → 40 (the six additions). What this assertion
     is FOR is that no row was duplicated or dropped by the category move, so the
     total is reported and the DISTINCTNESS plus the section sum carry the check —
     a pinned 34 would fail on every future addition for no reason. */
  /* ACTOR_ENABLED / C4_ENABLED / QUEUE_ENABLED (2026-10-22) — the create-surface
     hides shrink the EXECUTED LIBRARY (40 → 27 with all three off), so the >=34
     floor is now the SHIPPED floor: items stay in the tree, only the offer is
     gated. DISTINCTNESS + the section sum still carry the no-loss claim. */
  new Set(labels).size === labels.length && LIB.length >= 27
    && basic.length + flow.length + LIB.filter(p => !['basic', 'flowchart'].includes(p.category)).length === LIB.length,
  `${LIB.length} items, ${new Set(labels).size} distinct labels — the count badge for Basic now reads `
  + `${basic.length} and Flowchart ${flow.length}, and the sections still sum to the whole library`);

/* `defaultOpenCategory` still opens the namesake section, and no remembered
   fold is invalidated (the map is keyed by CATEGORY id, none of which changed). */
const catState = readFileSync(`${ROOT}/src/categoryState.ts`, 'utf8');
assert('aa3.defaultOpenCategory-and-the-fold-map-are-unaffected',
  /case 'flowchart':\s*\n\s*return 'flowchart';/.test(catState)
    && /'basic', 'flowchart', 'data-storage'/.test(catState),
  'the section IDS are unchanged (only which items carry them moved), so a flowchart board still opens '
  + 'its `flowchart` namesake, and the remembered-fold map keyed by those ids cannot be invalidated');

assert('aa3.the-presets-source-files-both-under-flowchart',
  /'Process',[^)]*'flowchart',/.test(PRESETS) && /'Decision',[^)]*'flowchart',/.test(PRESETS)
    && countOf(PRESETS, "'basic', FLOW") === 0,
  `${countOf(PRESETS, "'basic'")} \`'basic'\` tokens remain in presets.ts and NEITHER is an \`fc(..., 'basic', FLOW, ...)\` `
  + 'row — eleven `fc(...)` calls now all file under their namesake section');

/* ===========================================================================
   ITEM 2 — the marquee mode: default, storage key, live prop.
   =========================================================================== */
console.log('\n' + '='.repeat(78));
console.log('ITEM 2 — marquee selection mode: default, key, live prop');
console.log('='.repeat(78));

const mqEntry = join(dir, 'mq-entry.ts');
writeFileSync(mqEntry, `export * from ${JSON.stringify(join(ROOT, 'src/marqueeMode.ts'))};\n`);
const mqOut = join(dir, 'mq.mjs');
writeFileSync(mqOut, execFileSync(ESBUILD, [mqEntry, '--bundle', '--platform=node', '--format=esm', '--log-level=error'], {encoding: 'utf8'}));

/* The storage is FAKED rather than a browser: `loadMarqueeMode` reads
   `localStorage.getItem`, so a stub that returns null IS the no-write case. */
let STORE = null;
globalThis.localStorage = {
  getItem: () => STORE,
  setItem: (_k, v) => { STORE = v; },
  removeItem: () => { STORE = null; },
};
const MQ = await import(`${mqOut}?t=${Date.now()}`);

console.log(`  key          : ${MQ.MARQUEE_KEY}`);
console.log(`  options      : ${MQ.MARQUEE_OPTS.map(o => `${o.v} → "${o.label}"`).join('  ·  ')}`);
console.log(`  parse(null)  → ${MQ.parseMarqueeMode(null)}      load() with nothing stored → ${MQ.loadMarqueeMode()}`);

assert('aa2.the-no-write-default-is-the-overlap-mode',
  MQ.DEFAULT_MARQUEE_MODE === 'touch'
    && MQ.parseMarqueeMode(null) === 'touch'
    && MQ.loadMarqueeMode() === 'touch'
    && MQ.selectionModeFor('touch') === 'partial',
  'with NOTHING stored — no key, a null read, storage disabled — the mode resolves to `touch` and the '
  + 'React Flow prop resolves to `partial`, so the overlap behaviour is the default WITHOUT the app ever '
  + 'writing a default into storage on first run');

assert('aa2.a-stored-value-overrides-the-default',
  (() => { STORE = 'enclose'; return MQ.loadMarqueeMode() === 'enclose' && MQ.selectionModeFor('enclose') === 'full'; })()
    && (() => { STORE = 'touch'; return MQ.loadMarqueeMode() === 'touch' && MQ.selectionModeFor('touch') === 'partial'; })(),
  'a stored `enclose` resolves to `full` and a stored `touch` resolves to `partial` — the stored choice '
  + 'always wins over the default, in both directions');

assert('aa2.an-unknown-stored-value-falls-back-to-the-default',
  MQ.parseMarqueeMode('') === 'touch' && MQ.parseMarqueeMode('junk') === 'touch'
    && MQ.parseMarqueeMode('{"mode":"enclose"}') === 'touch' && MQ.parseMarqueeMode('Full') === 'touch',
  'an empty string, a random word, a JSON blob and a wrong-case name all resolve to `touch` — a malformed '
  + 'value can never pin the marquee to `enclose`, which is the behaviour Harvey asked to be rid of');

assert('aa2.the-key-follows-the-diagram-studio-namespace',
  MQ.MARQUEE_KEY === 'diagram-studio:marquee' && /diagram-studio:/.test(MQ.MARQUEE_KEY),
  `one namespaced key, \`${MQ.MARQUEE_KEY}\`, matching MODE_KEY / ANIMATE_KEY / CATEGORIES_KEY / PANELS_KEY`);

/* THE MECHANISM IS NOT INVENTED — it is the convention the other persisted
   canvas prefs already use. Asserted against the real files, so a later pass
   that adds a second storage idiom is caught. */
assert('aa2.persistence-follows-the-existing-convention-not-a-new-one',
  (() => {
    const src = readFileSync(`${ROOT}/src/marqueeMode.ts`, 'utf8');
    return /try\s*\{[\s\S]{0,120}?localStorage\.getItem\(MARQUEE_KEY\)/.test(src)
      && /try\s*\{\s*localStorage\.setItem\(MARQUEE_KEY/.test(src)
      && /catch/.test(src);
  })()
    && /try \{ return localStorage\.getItem\(READ_ONLY_KEY\)/.test(APP_RAW)
    && /const ANIMATE_KEY = 'diagram-studio:animate'/.test(readFileSync(`${ROOT}/src/choreography.ts`, 'utf8'))
    && /const CATEGORIES_KEY = 'diagram-studio:categories'/.test(readFileSync(`${ROOT}/src/categoryState.ts`, 'utf8')),
  'lazy read that never throws, tolerant parse, `try`/`catch` on write — the same shape as READ_ONLY_KEY '
  + 'in App.tsx, ANIMATE_KEY in choreography.ts and CATEGORIES_KEY in categoryState.ts. The canvas prefs '
  + 'that are NOT persisted (`snap` at App.tsx:614, `gridSize` at :620) are session state on purpose; this '
  + 'one is persisted because Harvey asked for a setting that survives a reload.');

/* THE PROP IS WIRED, AND IT IS THE ONLY PLACE THE ENUM IS DERIVED. */
assert('aa2.the-canvas-prop-reads-the-setting-live',
  /const \{mode: marqueeMode, selectionMode, setMode: setMarqueeMode\} = useMarqueeMode\(\)/.test(APP)
    && /selectionMode=\{selectionMode\}/.test(APP)
    && countOf(APP, 'selectionMode={') === 1
    && /marquee=\{marqueeMode\}/.test(APP) && /onMarquee=\{setMarqueeMode\}/.test(APP),
  'one hook owns the value AND the enum, the `<ReactFlow>` prop is `selectionMode={selectionMode}` (exactly '
  + 'one occurrence, so nothing else can map it differently), and the Settings row is handed the live value '
  + 'and its setter — changing the setting re-renders the prop with no reload');

/* THE READ-ONLY BRANCH AND THE TOUCH PATH MUST BOTH SURVIVE. */
assert('aa2.the-read-only-pan-branch-and-the-touch-constraint-survive',
  /panOnDrag=\{readOnly \? true : \[1, 2\]\}/.test(APP)
    && /selectionOnDrag=\{!readOnly\}/.test(APP)
    && /selectionMode=\{selectionMode\}/.test(APP),
  '`panOnDrag` is still `readOnly ? true : [1, 2]` and `selectionOnDrag` is still `!readOnly`: in review '
  + 'mode ANY button pans, so a left-drag on the empty pane is not a dead gesture; in edit mode button 0 '
  + 'stays with `selectionOnDrag` (box-select) and panning stays on middle/right + `panOnScroll` + Space. '
  + '`panOnDrag` is `!== false` in BOTH branches, so `Pane`\'s touch early-return still fires and one '
  + 'finger still pans.');

/* THE LIBRARY, NOT A GUESS: `SelectionMode.Partial` is asserted to be the value
   React Flow's own `getNodesInside` call treats as "overlap counts". */
const RF_SRC = readFileSync(`${ROOT}/node_modules/@xyflow/react/dist/esm/index.js`, 'utf8');
const SYS_SRC = readFileSync(`${ROOT}/node_modules/@xyflow/system/dist/esm/index.mjs`, 'utf8');
assert('aa2.Partial-is-the-value-the-installed-package-treats-as-overlap',
  /SelectionMode\["Partial"\] = "partial"/.test(SYS_SRC)
    && /SelectionMode\["Full"\] = "full"/.test(SYS_SRC)
    && /selectionMode === SelectionMode\.Partial/.test(RF_SRC)
    && /selectionMode = SelectionMode\.Full/.test(RF_SRC),
  'read out of the INSTALLED packages: `@xyflow/system` declares `Partial = "partial"` / `Full = "full"`, '
  + '`@xyflow/react`\'s `<ReactFlow>` defaults `selectionMode = SelectionMode.Full`, and the Pane passes '
  + '`selectionMode === SelectionMode.Partial` as `getNodesInside`\'s `partially` flag — which is why the '
  + 'absent prop meant FULL enclosure, and why `Partial` is the value that restores overlap');

/* IT IS A REAL CONTROL: the row renders the generic Segmented, and the row is
   NOT a re-added gesture entry. */
assert('aa2.the-setting-is-a-real-control-in-the-Canvas-group',
  /<Row label="Marquee selection"/.test(SET)
    && /options=\{MARQUEE_OPTS\.map\(o => o\.v\)\}/.test(SET)
    && /onPick=\{onMarquee\}/.test(SET)
    && /labelOf=/.test(SET)
    && countOf(SET, 'MARQUEE_OPTS') >= 2,
  'Canvas → "Marquee selection" renders the SAME `Segmented` radio-group the Grid size row uses — a real '
  + 'control that persists and takes effect, not a display-only row. The stored values are the tokens; the '
  + 'buttons print the plain-language names from MARQUEE_OPTS.');

assert('aa2.no-gesture-row-was-re-added-to-the-shortcuts-surfaces',
  countOf(SET, 'Multi-select box') === 0 && countOf(APP, 'Multi-select box') === 0
    && countOf(SET, "'Select multiple'") === 1 && countOf(APP, 'Select multiple') === 1,
  'the deliberately-trimmed `Multi-select box` row is still absent from BOTH surfaces (Settings and the '
  + '`?` helper), which still carry the same five gesture rows in the same order — the new SETTING is the '
  + 'discoverable surface, as the brief requires');

/* (c) EXECUTED THROUGH THE COMPONENT, not only through the pure function. The
   brief asks whether "the component passes SelectionMode.Partial when nothing
   is stored" — so a probe component CALLS THE REAL HOOK and its `selectionMode`
   is read off the rendered markup. The storage is stubbed on globalThis before
   the bundle is imported, and React's server renderer runs the hook for real
   (the lazy `useState` initialiser is what reads storage, so this exercises the
   exact code path the browser takes on first paint). */
/* React and ReactDOM stay EXTERNAL, and the bundle is IMPORTED by this process
   rather than run as a child: a second inlined copy of React gives the renderer
   a null dispatcher ("Invalid hook call … more than one copy of React"), and a
   child process would not inherit the `globalThis.localStorage` stub. This is
   the exact technique `checks/package-p-render-check.mjs:213-224` uses. */
const PROBE_ENTRY = join(ROOT, '.aa-probe.tsx');
const PROBE_OUT = join(ROOT, '.aa-probe.cjs');
writeFileSync(PROBE_ENTRY, `
import {renderToStaticMarkup} from 'react-dom/server';
import {createElement} from 'react';
import {useMarqueeMode} from ${JSON.stringify(join(ROOT, 'src/marqueeMode'))};
function Probe() {
  const {mode, selectionMode} = useMarqueeMode();
  return createElement('span', {'data-mode': mode, 'data-selection-mode': selectionMode});
}
export const render = () => renderToStaticMarkup(createElement(Probe));
`);
/* CJS OUTPUT, not ESM: the real dependency chain reaches `@xyflow/react`, whose
   transitive `use-sync-external-store` does a DYNAMIC require of React, which
   esbuild's ESM output refuses ("Dynamic require of \"react\" is not supported").
   In CJS the require resolves through Node against the externals below. */
await (await import('esbuild')).build({
  entryPoints: [PROBE_ENTRY], bundle: true, format: 'cjs', platform: 'node',
  outfile: PROBE_OUT, jsx: 'automatic', logLevel: 'error',
  external: ['react', 'react-dom', 'react/jsx-runtime', 'react-dom/server'],
});
const probe = await import(`${PROBE_OUT}?t=${Date.now()}`);
const renderProbe = (stored) => {
  STORE = stored;
  return probe.render();
};
const nothing = renderProbe(null);
const encloseStored = renderProbe('enclose');
const touchStored = renderProbe('touch');
for (const f of [PROBE_ENTRY, PROBE_OUT]) { try { rmFile(f, {force: true}); } catch { /* gone */ } }
console.log(`  render with NOTHING stored  → ${nothing}`);
console.log(`  render with "enclose" stored → ${encloseStored}`);
console.log(`  render with "touch" stored   → ${touchStored}`);
assert('aa2.the-component-resolves-Partial-when-nothing-is-stored-and-follows-the-stored-value',
  nothing.includes('data-selection-mode="partial"') && nothing.includes('data-mode="touch"')
    && encloseStored.includes('data-selection-mode="full"') && encloseStored.includes('data-mode="enclose"')
    && touchStored.includes('data-selection-mode="partial"'),
  'REACT RAN THE REAL HOOK: with no stored value the component renders mode `touch` / selection-mode '
  + '`partial`; a stored `enclose` renders `full`; a stored `touch` renders `partial`. So the no-write '
  + 'default reaches the component as Partial (overlap), and the stored value overrides it — which is the '
  + 'prop `<ReactFlow>` receives.');

/* ===========================================================================
   REPLAY (negative control) — ROUND AL (AL-6), the four re-anchored AA-1 claims.
   ===========================================================================
   The round's law: an assertion whose verdict changed is RE-ANCHORED, and a
   re-anchored assertion must be SHOWN RED on the tree it moved off — otherwise
   "re-anchored" is indistinguishable from "loosened to pass". This harness had
   no control at all before this pass (every claim read the working tree), so the
   control is added here rather than assumed.

   The four probes below are the SAME functions the four assertions above call,
   run over `PRE_AL_COMMIT` (`f0b00aa`, ROUND AK's last commit — the tree these
   assertions last PASSED on, where the rows were `<ToggleRow/>`). Each MUST be
   RED there. A probe GREEN on both trees proves NOTHING about AL-6 and fails
   this assertion, so a weakened re-anchor cannot hide behind a green summary.

   The OTHER AA-1 assertions (`the-row-is-flex…`, `one-gap…`, `swatches…`, the
   dead-grid rule, the geometry table) are NOT re-anchored: they measure the
   `.insp-seg` / `.swatches` sheet rules and the Text-section tables, none of
   which AL-6 touched. They are GREEN on both trees by design and are correctly
   excluded from this RED set rather than listed and quietly filtered. */
console.log('\n' + '='.repeat(78));
console.log(`REPLAY (negative control) — the RE-ANCHORED probes over ${PRE_AL_COMMIT}`);
console.log('each must be RED, or the re-anchor proves nothing');
console.log('='.repeat(78));

if (preAl) {
  const PRE_B = {app: preAl.app, styles: preAl.styles};
  const RE_ANCHORED = [
    ['aa1.the-four-across-word-row-carries-the-two-per-line-modifier-because-it-must', P_HALF_APPLIED],
    ['aa1.no-other-row-needs-a-modifier-so-half-is-not-over-applied', P_HALF_NOT_OVER_APPLIED],
    ['aa1.every-ToggleRow-in-the-panel-divides-its-field-equal', P_ROWS_DIVIDE],
    ['aa1.the-control-is-unchanged-no-new-class-no-select', P_CONTROL_UNCHANGED],
  ];
  const greenOnPre = [];
  for (const [id, probe] of RE_ANCHORED) {
    const ok = probe(PRE_B);
    if (ok) greenOnPre.push(id);
    console.log(`  ${ok ? 'GREEN (the re-anchor proves NOTHING)' : 'RED   '}  ${id}`);
  }
  /* A short, auditable readout of WHY each is red: the counts the probe keys on,
     on both trees, so the RED is a measurement and not a bare boolean. */
  console.log(`\n  the counts the four probes key on:`);
  console.log(`    ToggleRow sites            work ${countOf(APP, '<ToggleRow')}   pre ${countOf(preAl.app, '<ToggleRow')}`);
  console.log(`    chipRow sites              work ${chipCallsOf(APP).length}   pre ${chipCallsOf(preAl.app).length}`);
  console.log(`    options={SPEED_OPTS}       work ${countOf(APP, 'options={SPEED_OPTS}')}   pre ${countOf(preAl.app, 'options={SPEED_OPTS}')}`);
  console.log(`    chipRow(SPEED_OPTS         work ${countOf(APP, 'chipRow(SPEED_OPTS')}   pre ${countOf(preAl.app, 'chipRow(SPEED_OPTS')}`);
  console.log(`    bare \`half\` word          work ${(APP.match(/\n\s+half\n/g) ?? []).length}   pre ${(preAl.app.match(/\n\s+half\n/g) ?? []).length}`);
  console.log('');
  assert('replay.every-re-anchored-probe-is-RED-on-the-tree-it-moved-off',
    greenOnPre.length === 0,
    greenOnPre.length === 0
      ? `all ${RE_ANCHORED.length} re-anchored AA-1 probes are RED at ${PRE_AL_COMMIT} — the tree AL changed ` +
        `from, where they last PASSED — and GREEN on the working tree, so each re-anchor measures the AL-6 ` +
        `change itself and is not a weaker claim that happens to be true on both`
      : `STILL GREEN AT ${PRE_AL_COMMIT} (the re-anchor is weaker than the claim it replaces): ${greenOnPre.join(', ')}`);
} else {
  assert('replay.every-re-anchored-probe-is-RED-on-the-tree-it-moved-off', false,
    `the control tree ${PRE_AL_COMMIT} could not be read, so the four re-anchored AA-1 probes have no ` +
    `negative control. Re-pin DS_PRE_AL_COMMIT to ROUND AK's last commit — do NOT delete this section.`);
}

/* ===========================================================================
   SUMMARY
   =========================================================================== */
const failed = results.filter(r => !r.pass);
console.log('\n' + '='.repeat(78));
console.log(`ROUND AA HARNESS: ${results.length - failed.length}/${results.length} passed`);
console.log('='.repeat(78));
for (const f of failed) console.log(`  FAIL  ${f.id}  —  ${f.detail}`);
process.exit(failed.length ? 1 : 0);
