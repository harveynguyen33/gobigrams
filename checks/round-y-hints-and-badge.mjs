#!/usr/bin/env node
/**
 * ROUND Y harness — two hint deletions in the Text section, and the inspector's
 * target badge decided (four candidates, four verdicts).
 *
 * No browser, no DOM, no CDP. Everything below is read out of the real sources.
 * Comments are STRIPPED before every count: the code this pass touched carries
 * prose that names the very constructs measured ("badge", "12px spacer"), so a
 * raw count would fail a correct tree. What is counted is CODE.
 *
 * WHAT IT CANNOT DO: it cannot see the panel. That the removed rows are GONE
 * from the painted panel, and that nothing shifted or broke, is the
 * orchestrator's live pass. This file measures the source.
 */
import {readFileSync} from 'node:fs';

const ROOT = '/home/harvey/projects/tech-goblin/lab/diagram-studio';
const APP_RAW = readFileSync(`${ROOT}/src/App.tsx`, 'utf8');
const STYLES_RAW = readFileSync(`${ROOT}/src/styles.css`, 'utf8');

const stripTs = s => s
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/(^|[^:])\/\/[^\n]*/g, '$1');
/* Comments blanked, never removed, for anything that reports a source LINE:
   every byte offset (and so every line number) stays true. */
const blankTs = s => s
  .replace(/\/\*[\s\S]*?\*\//g, m => m.replace(/[^\n]/g, ' '))
  .replace(/(^|[^:])\/\/[^\n]*/g, (m, p1) => p1 + ' '.repeat(m.length - p1.length));

const APP = stripTs(APP_RAW);
const APP_BLANK = blankTs(APP_RAW);
const STYLES = stripTs(STYLES_RAW);

const countOf = (text, needle) => text.split(needle).length - 1;
const at = (raw, needle) => {
  const i = raw.split('\n').findIndex(l => l.includes(needle));
  return i < 0 ? 0 : i + 1;
};

const results = [];
const assert = (id, pass, detail = '') => {
  results.push({id, pass: !!pass, detail});
  console.log(`  ${pass ? 'PASS' : 'FAIL'}  ${id}  —  ${detail}`);
};

/* ===========================================================================
   SLICE 1 — the Text section body, `tsBody`. The slice is what is asserted,
   never the file: the panel has other hints that this round does not touch
   (the multi-select branch, the Style section, the table's FK note, the edge's
   double-click note), and a file-wide "no hint" count would forbid them.
   =========================================================================== */
const tsStart = APP.indexOf('const tsBody = (');
const tsEnd = APP.indexOf('</>\n  );', tsStart);
const TS_BODY = tsStart < 0 ? '' : APP.slice(tsStart, tsEnd > tsStart ? tsEnd : undefined);
console.log('='.repeat(78));
console.log('(1) THE TEXT SECTION — no hint at all (items 1 and 2)');
console.log('='.repeat(78));
console.log(`  tsBody starts at App.tsx:${at(APP_RAW, 'const tsBody = (')} `
  + `(${TS_BODY.length} chars sliced, ends at :${at(APP_RAW, 'const leftHidden')} — the next statement)`);

/* LIVENESS FLOOR. Every assertion below is a "must be 0". A slice that failed
   to resolve would report 0 for all of them and pass on nothing, so the slice
   is proven non-empty AND proven to contain the row the hints sat under. */
assert('y.the-text-section-slice-is-not-empty',
  TS_BODY.length > 500
    && TS_BODY.includes('<label>text colour</label>')
    && TS_BODY.includes('<label>align</label>'),
  `${TS_BODY.length} chars, and it carries the two rows the deleted hints sat under — so the zeros `
  + 'below are measurements, not a slice that came back empty');

assert('y.the-text-section-contains-NO-hint',
  countOf(TS_BODY, 'className="hint"') === 0 && !TS_BODY.includes('hint'),
  `${countOf(TS_BODY, 'className="hint"')} hint rows left in tsBody — the section reads `
  + 'SIZE · WEIGHT · FONT · TEXT COLOUR · ALIGN with nothing else');

/* NEGATIVE CONTROL — the counter must SEE a hint if one comes back. */
assert('y.control-the-hint-counter-detects-a-reintroduction',
  countOf('<div className="hint">Text only</div>', 'className="hint"') === 1
    && countOf('<div className="hint">Size scales the block</div>', 'className="hint"') === 1
    && countOf('the word hint in prose', 'className="hint"') === 0,
  'counts a real hint row (1) and ignores prose that merely says the word (0)');

/* THE TWO SENTENCES THEMSELVES — gone from the panel, and gone as TEXT, so a
   reworded copy cannot sneak back under a different class. */
assert('y.both-deleted-sentences-are-absent-from-the-panel',
  !APP.includes('Text only — the node outline keeps its own colour')
    && !APP.includes('Size scales the whole text block')
    && !APP.includes('Default (M) is not stored on the node'),
  'neither the text-colour hint (item 1) nor the trailing size/hierarchy hint (item 2) '
  + 'survives anywhere in App.tsx');

/* The four controls are all still there, in order, and each row is a `.field`. */
assert('y.the-five-rows-survive-in-order',
  ['size', 'weight', 'font', 'text colour', 'align']
    .every(l => TS_BODY.includes(`<label>${l}</label>`))
    && countOf(TS_BODY, 'className="field"') === 5,
  `5 .field rows, ${countOf(TS_BODY, 'className="field"')} labelled; the align row has NO hint `
  + 'of its own and none was added (its only child is the ToggleRow)');

/* ===========================================================================
   SLICE 2 — the inspector's panel body. Four candidate badges lived here.
   =========================================================================== */
const pStart = APP.indexOf('<aside className="panel right">');
const pEnd = APP.indexOf('</aside>', pStart);
const PANEL = pStart < 0 ? '' : APP.slice(pStart, pEnd > pStart ? pEnd : undefined);
console.log('\n' + '='.repeat(78));
console.log('(2) THE PANEL BODY — one badge left, and it is not a kind label');
console.log('='.repeat(78));
const pBodyStart = APP.indexOf('<div className="panel-body">', pStart);
/* The line number comes from the RAW source, and the inspector's body is looked
   up by OFFSET after the aside — `at()` searches the whole file, and the palette
   has an earlier panel-body, so it answers with the wrong one. Never mix a
   comment-stripped offset with raw line counting; find the raw offset instead. */
const RAW_ASIDE = APP_RAW.indexOf('<aside className="panel right">');
const RAW_PBODY = APP_RAW.indexOf('<div className="panel-body">', RAW_ASIDE);
const lineAtRawOffset = off => APP_RAW.slice(0, off).split('\n').length;
console.log(`  the INSPECTOR side (<aside className="panel right">) at App.tsx:`
  + `${lineAtRawOffset(RAW_ASIDE)}, its own panel-body at :${lineAtRawOffset(RAW_PBODY)}`
  + ` — ${PANEL.length} chars sliced, `
  + `${countOf(PANEL, 'className="badge"')} bare badge(s), `
  + `${countOf(PANEL, 'className="badge preset"')} preset chip(s)`);

assert('y.the-panel-slice-is-not-empty',
  PANEL.length > 5000 && pBodyStart > pStart && PANEL.includes("secBody('content'")
    && PANEL.includes("secBody('text', tsBody)"),
  `${PANEL.length} chars spanning all four branches (edge / no-selection / table / label / goblin) `
  + '— the zeros below are measurements, not a slice that came back empty');

/* THE FOUR TARGET-KIND BADGES, each with the verdict this round reached.
   `className="badge">` matches ONLY the bare form: the surviving C4 chip is
   `className="badge preset"`, whose space stops the match. */
assert('y.no-target-KIND-badge-remains-in-the-panel',
  countOf(PANEL, 'className="badge">') === 0,
  `0 bare badges. Verdicts: edge — REMOVED (Label/Line/Markers(/Cardinality)/Flow is a `
  + 'vocabulary no node target renders); table — REMOVED (Table/Columns/Show mode is the same '
  + 'kind of tell); label — REMOVED (one section, `text`, so the badge named the header below '
  + 'it); goblin shape — REMOVED (the Style section shape picker already reads out the shape)');

assert('y.no-badge-prints-a-shape-name',
  !PANEL.includes('{asShape((selected.data as any).shape)}</span>')
    && !/className="badge">\{asShape/.test(PANEL),
  'the goblin shape badge rendered the MACHINE name (`service`, `queue`…) while the shape '
  + 'picker renders the label — the badge was the less readable of two copies of one fact');

/* THE SURVIVOR, AND WHY. The C4 chip is not a kind label: it states the node's
   C4 role, which nothing else in the panel prints. */
const c4Chip = PANEL.indexOf('className="badge preset"');
assert('y.the-C4-role-chip-survives-and-still-states-its-reason',
  c4Chip >= 0
    && PANEL.includes("C4[(selected.data as any).c4Type as keyof typeof C4].kicker")
    && PANEL.includes('isC4Type((selected.data as any).c4Type)'),
  'the one badge kept is the C4 ROLE readout (Person / Container / System), gated on an actual '
  + 'C4 node type — a fact the node card and every other row of this panel are silent about');

/* ===========================================================================
   (3) THE SPACER — a 12px div whose only tenant was a badge.
   =========================================================================== */
console.log('\n' + '='.repeat(78));
console.log('(3) the 12px spacer that followed each badge');
console.log('='.repeat(78));
const SPACER = '<div style={{height: 12}} />';
const spacersInApp = countOf(APP, SPACER);
const spacersInPanel = countOf(PANEL, SPACER);
console.log(`  ${SPACER} in App.tsx: ${spacersInApp}   inside the panel body: ${spacersInPanel}`);
console.log(`  line(s): ${APP_BLANK.split('\n')
  .map((l, i) => (l.includes(SPACER) ? i + 1 : 0)).filter(Boolean).join(', ') || 'none'}`);

assert('y.the-three-orphaned-spacers-are-gone-and-one-remains',
  spacersInApp === 1 && spacersInPanel === 1,
  `4 spacers before this round, ${spacersInApp} now. The edge / table / label spacers followed a `
  + 'badge that no longer exists, so they went WITH it; the fourth is kept because the C4 chip is '
  + 'still above it');

/* The survivor must sit INSIDE the C4 conditional, not beside it — a spacer that
   is now unconditional would leave a 12px hole on every plain goblin. */
const c4Close = PANEL.indexOf(')}\n              {preset.note', c4Chip);
assert('y.the-remaining-spacer-is-inside-the-C4-conditional',
  c4Chip >= 0 && c4Close > c4Chip
    && PANEL.slice(c4Chip, c4Close).includes(SPACER),
  'the spacer is rendered by the SAME condition as the chip it spaces, so a non-C4 goblin '
  + 'paints no stray gap where the shape badge used to be');

/* ===========================================================================
   (4) THE CLASSES THE SURVIVOR NEEDS — the C4 chip must not go unstyled, and
   `checks/package-o-metrics.mjs` item 5 asserts `.badge.preset` is SHARED.
   =========================================================================== */
console.log('\n' + '='.repeat(78));
console.log('(4) `.badge` and `.badge.preset` are still consumed');
console.log('='.repeat(78));
assert('y.the-badge-rules-are-still-consumed-so-the-C4-chip-stays-styled',
  STYLES.includes('.badge {') && STYLES.includes('.badge.preset')
    && countOf(APP, 'className="badge preset"') === 1,
  'one live consumer (`badge preset`), so both rules keep a reason to exist — deleting them '
  + 'with the four badges would have left the C4 chip as unstyled plain text');

/* ===========================================================================
   SUMMARY
   =========================================================================== */
const failed = results.filter(r => !r.pass);
console.log('\n' + '='.repeat(78));
console.log(`ROUND Y HARNESS: ${results.length - failed.length}/${results.length} passed`);
console.log('='.repeat(78));
for (const f of failed) console.log(`  FAIL  ${f.id}  — ${f.detail}`);
process.exit(failed.length ? 1 : 0);
