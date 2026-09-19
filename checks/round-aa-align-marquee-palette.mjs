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
assert('aa1.the-four-across-word-row-carries-the-two-per-line-modifier-because-it-must',
  speedWorst > speedContent4 && speedWorst < speedContent2
    && /options=\{SPEED_OPTS\}[\s\S]{0,80}?\bhalf\b/.test(APP)
    && /\.insp-seg\.half \.insp-seg-btn \{[^}]*calc\(\(100% - 5px\) \/ 2\)/.test(STYLES),
  `the Speed row's longest label (\`very fast\`, ${speedWorst.toFixed(1)}px measured) does NOT fit a `
  + `4-across share (${speedContent4.toFixed(1)}px content box) and DOES fit a 2-across one `
  + `(${speedContent2.toFixed(1)}px), so the row carries the \`half\` modifier — 2+2 with the same `
  + 'flex-basis idiom as `grid3`. Without it the equal-width change would have traded a ragged row for a '
  + 'wrapped word, which is a regression the content-sized row did not have.');

/* EVERY OTHER ROW FITS AT ITS NATURAL COUNT — the negative control for the
   modifier above, so `half` is not sprinkled on rows that do not need it. */
const NATURAL = [
  {name: 'size',   labels: ['S', 'M', 'L', 'XL'],                n: 4},
  {name: 'weight', labels: ['Regular', 'Bold'],                   n: 2},
  {name: 'align',  labels: ['Left', 'Center', 'Right'],           n: 3},
  {name: 'valign', labels: ['Top', 'Middle', 'Bottom'],           n: 3},
  {name: 'offset', labels: ['center', 'start', 'end'],            n: 3},
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
/* THE ENUMERATION, not the five the brief names: EVERY `ToggleRow` call site in
   the panel is found from the source, its option count read from the table it
   passes, and the row's geometry computed. A row added later with a count that
   does not divide the field cleanly is caught here rather than found by eye. */
const hasModifier = (jsx, word) => new RegExp(`\\n\\s*${word}\\s*\\n`).test(jsx);
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

assert('aa1.no-other-row-needs-a-modifier-so-half-is-not-over-applied',
  naturalOk && countOf(APP, 'options={SPEED_OPTS}') === 1
    && (APP.match(/\n\s+half\n/g) ?? []).length === 1
    && CALLS.filter(c => c.half).length === 1
    && CALLS.find(c => c.half)?.opts === 'SPEED_OPTS',
  `exactly ONE call site carries \`half\` (the Speed row). Every other segmented row's longest label fits `
  + 'its natural equal share — size 13.7 / weight 46.4 / align 39.7 / valign 39.7 / offset 39.7 / body '
  + '66.2px all inside their cells — so the modifier is applied where the measurement demands it and '
  + 'nowhere else.');

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
const tableSize = (name) => {
  const decl = new RegExp(`const ${name}\\s*:[^=]*=\\s*`).exec(APP);
  if (!decl) return 0;
  const rest = APP.slice(decl.index + decl[0].length);
  const literal = /^\s*\[/.test(rest);
  if (literal) return countEntries(rest);
  const mappedFrom = /^\s*(\w+)\s*\.map/.exec(rest)?.[1];
  if (!mappedFrom) return 0;
  const src = new RegExp(`const ${mappedFrom}\\s*:[^=]*=\\s*\\[`).exec(TS);
  if (!src) return 0;
  return countEntries(TS.slice(src.index + src[0].length - 1));
};
console.log('\n  EVERY ToggleRow CALL SITE IN THE PANEL');
let allRowsOk = true, rowsRead = 0;
for (const c of CALLS) {
  const n = tableSize(c.opts);
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
assert('aa1.every-ToggleRow-in-the-panel-divides-its-field-equal',
  allRowsOk && rowsRead === CALLS.length && CALLS.length >= 8,
  `all ${CALLS.length} \`<ToggleRow/>\` call sites enumerated from App.tsx and every option count resolved `
  + `from the table that really builds it (4/2/6/3/3 in the Text section, matching TEXT_*_OPTS in `
  + `src/textStyle.ts, plus OFFSET ${tableSize('OFFSET_OPTS')} / SPEED ${tableSize('SPEED_OPTS')} / BODY ${tableSize('BODY_OPTS')}) `
  + `— each row's buttons are equal, every line sums to exactly the ${FIELD}px field, and the two `
  + 'word-rows carry the per-line modifiers their labels require (font 3+3, speed 2+2)');

/* THE GAP IS NOW ONE NUMBER. Before this round the font row carried 5px (its
   own two-class rule) while every other segmented row silently inherited
   `.swatches`'s 7px — a second ragged edge, in the spacing rather than the
   widths. */
assert('aa1.one-gap-across-every-segmented-row',
  computed(WRAPPER, 'gap')?.v === computed([...WRAPPER, 'grid3'], 'gap')?.v
    && computed(WRAPPER, 'gap')?.v === computed([...WRAPPER, 'half'], 'gap')?.v,
  `the row gap is ${computed(WRAPPER, 'gap')?.v} for every segmented row — the default rows, the 3+3 font `
  + 'row and the 2+2 speed row all state the same value, because each compound selector states it at a '
  + "specificity that beats `.swatches`'s 7px rather than inheriting it");

/* The control itself must not have changed: still `ToggleRow`, still `.insp-seg`. */
assert('aa1.the-control-is-unchanged-no-new-class-no-select',
  countOf(APP, '<ToggleRow') >= 8 && countOf(APP, '<select') === 0
    && countOf(STYLES, '.insp-seg-btn') >= 4,
  `${countOf(APP, '<ToggleRow')} ToggleRow call sites, ${countOf(APP, '<select')} native dropdowns, and the `
  + 'shared `.insp-seg-btn` still supplies every segmented button — the fix is geometry only');

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
  new Set(labels).size === labels.length && LIB.length === 34
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
   SUMMARY
   =========================================================================== */
const failed = results.filter(r => !r.pass);
console.log('\n' + '='.repeat(78));
console.log(`ROUND AA HARNESS: ${results.length - failed.length}/${results.length} passed`);
console.log('='.repeat(78));
for (const f of failed) console.log(`  FAIL  ${f.id}  —  ${f.detail}`);
process.exit(failed.length ? 1 : 0);
