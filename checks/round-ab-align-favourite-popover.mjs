#!/usr/bin/env node
/**
 * ROUND AB harness — three measured defects, each read out of the REAL sources.
 *
 * No browser, no DOM, no CDP. Every number below is either (1) EXECUTED against
 * the real `src/InspectorPickers.tsx` (`popoverPlacement` / `placementStyle` are
 * imported and CALLED with a fake trigger, so the flip and the clamp are
 * behaviour, not a re-implementation), or (2) read out of `src/styles.css`
 * through a real CASCADE resolution (higher specificity wins; at equal
 * specificity the LATER rule wins — the same rule that decides the padding in
 * `checks/round-aa-align-marquee-palette.mjs`).
 *
 * WHAT IT CANNOT DO, stated rather than hidden: it cannot see the panel, so
 * "the popover is inside the panel ON SCREEN" is asserted as ARITHMETIC +
 * the executed placement, not as a painted box, and the ALIGN gap is the sheet's
 * declared geometry rather than a measurement of two rendered rows. The painted
 * numbers are the orchestrator's live pass; the arithmetic here is written so
 * every figure can be checked against the sheet it came from.
 *
 * COMMENTS ARE STRIPPED BEFORE EVERY COUNT — this repo's docblocks quote the
 * constructs they describe, and a raw count would read a correct tree as a
 * defect.
 */
import {readFileSync, writeFileSync, mkdtempSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';

const ROOT = '/home/harvey/projects/tech-goblin/lab/diagram-studio';
const APP_RAW = readFileSync(`${ROOT}/src/App.tsx`, 'utf8');
/* ROUND BN-4 — src/InspectorPickers.tsx split along its section banners
   into src/pickers/{popover,art,rows,stepperFlow,section}.tsx (verbatim; the
   old path stays as a re-export shell so bundle entries are unchanged). Reads
   of the picker source read the FIVE SLICES + SHELL CONCATENATED. */
const PICKS_RAW = ['popover', 'art', 'rows', 'stepperFlow', 'section', 'shell'].flatMap(f => {
    try { return [readFileSync(`${ROOT}/src/${f === 'shell' ? 'InspectorPickers.tsx' : 'pickers/' + {popover: 'popover.ts', art: 'Art.tsx', rows: 'Rows.tsx', stepperFlow: 'StepperFlow.tsx', section: 'Section.tsx'}[f]}`, 'utf8')]; } catch { return []; }
  }).join('\n');
const STYLES_RAW = readFileSync(`${ROOT}/src/styles.css`, 'utf8');

/** Strip block + line comments; blanking keeps byte offsets (and line numbers). */
const blank = m => m.replace(/[^\n]/g, ' ');
const stripTs = s => s
  .replace(/\/\*[\s\S]*?\*\//g, blank)
  .replace(/(^|[^:])\/\/[^\n]*/g, (m, p1) => p1 + ' '.repeat(m.length - p1.length));
const APP = stripTs(APP_RAW);
const PICKS = stripTs(PICKS_RAW);
/* CSS comments are stripped for the DECLARATION reads; the RAW sheet is what the
   hex-literal gate counts, exactly as the gate's own tool does. */
const STYLES = stripTs(STYLES_RAW);

const results = [];
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
   THE SHEET, PARSED ONCE — every rule as {selectors: [...], decls, index}.

   The parser splits on `}` boundaries rather than line-by-line, because this
   sheet writes SELECTOR GROUPS one selector per line (the CONTROL KIT's
   `.ui-input,\n.field input,\n…\n.icon-search,\n… {`) and a line-oriented regex
   would read each line of the group as a selectorless chunk with no
   declarations. `@`-blocks are skipped: this harness only inspects plain rules.
   =========================================================================== */
const RULES = (() => {
  const out = [];
  let start = 0;
  for (let i = 0; i < STYLES.length; i++) {
    if (STYLES[i] !== '}') continue;
    const chunk = STYLES.slice(start, i);
    start = i + 1;
    const open = chunk.lastIndexOf('{');
    if (open < 0) continue;
    const selText = chunk.slice(0, open).trim();
    if (!selText || selText.includes('@')) continue;
    const selectors = selText.split(',').map(s => s.trim().replace(/\s+/g, ' ')).filter(Boolean);
    if (!selectors.length) continue;
    out.push({selectors, decls: chunk.slice(open + 1), index: start});
  }
  return out;
})();

const decl = (block, prop) => {
  const m = new RegExp(`(?:^|;)\\s*${prop}\\s*:\\s*([^;]+)`).exec(block);
  return m ? m[1].trim() : null;
};
/** Specificity, counted the cheap way that is exact for this sheet: classes +
 *  attributes + pseudo-classes. No element selectors appear in any candidate. */
const spec = sel => (sel.match(/\.[\w-]+|\[[^\]]+\]|:{1,2}[\w-]+(?!\()/g) ?? []).length;
/** Does the FINAL compound of `sel` carry exactly this class list? A compound is
 *  the last space-separated token; `>` and `+` are combinators, so the token
 *  before the final one is the previous compound, never part of the last.
 *  PSEUDO-CLASSES ARE STRIPPED FIRST — `.icon-search:hover` IS a match for the
 *  element `.icon-search`, and a matcher that forgot this would report the
 *  control kit's hover/focus rules as non-matching and silently read the wrong
 *  winner for every stateful rule in the sheet. */
const lastCompound = sel => sel.split(/\s+/).pop();
const compoundClasses = c => c.replace(/:{1,2}[\w-]+(\([^)]*\))?/g, '').split('.').filter(Boolean);
const lastCompoundMatches = (sel, classes) =>
  compoundClasses(lastCompound(sel)).every(c => classes.includes(c));
/** The CASCADE, resolved for one element class list and one property. */
function computed(classes, prop, {pseudo = null} = {}) {
  let best = null, bestSpec = -1, bestIndex = -1;
  for (const r of RULES) {
    for (const sel of r.selectors) {
      if (!lastCompoundMatches(sel, classes)) continue;
      const has = (sel.match(/:{1,2}[\w-]+/g) ?? []);
      /* A `:hover` / `:focus` / `:focus-visible` rule only competes when that
         state was asked for; `:focus-within` and `:not()` are not states of
         THIS element, so a rule that has one is skipped for the base read. */
      const states = has.filter(h => /^:(hover|focus|focus-visible|active|disabled)$/.test(h));
      if (pseudo ? !states.includes(`:${pseudo}`) : states.length) continue;
      const v = decl(r.decls, prop);
      if (v == null) continue;
      const s = spec(sel);
      if (s > bestSpec || (s === bestSpec && r.index > bestIndex)) {
        bestSpec = s; bestIndex = r.index; best = {v, sel, index: r.index};
      }
    }
  }
  return best;
}
const ruleText = sel => {
  for (const r of RULES) if (r.selectors.includes(sel)) return r.decls;
  return null;
};
const hexCount = (s) => (s.match(/#[0-9a-fA-F]{3,8}\b/g) ?? []).length;

/* ===========================================================================
   ITEM 1 — THE TWO ALIGN ROWS ARE SEPARATED, BY THE PANEL'S OWN RHYTHM.
   =========================================================================== */
console.log('='.repeat(78));
console.log('ITEM 1 — the align pair: the second row gets the panel’s row rhythm');
console.log('='.repeat(78));

const FIELD_MARGIN = computed(['field'], 'margin-bottom');
const ROW_GAP = (() => {
  for (const r of RULES) {
    for (const sel of r.selectors) {
      if (!/\.field\s*>\s*\.swatches\.insp-seg\s*\+\s*\.swatches\.insp-seg/.test(sel)) continue;
      const v = decl(r.decls, 'margin-top');
      if (v != null) return {v, sel, index: r.index};
    }
  }
  return null;
})();

console.log(`  .field                                   → margin-bottom: ${FIELD_MARGIN?.v}`);
console.log(`  two stacked segmented rows in one field  → margin-top: ${ROW_GAP?.v}   [${ROW_GAP?.sel ?? 'absent'}]`);

/* THE RHYTHM IS THE CLAIM, so it is asserted as an EQUALITY against the value
   the panel already uses between every other pair of adjacent controls in the
   Text section (`.field`'s own `margin-bottom`), not against a new number. */
assert('ab1.the-second-align-row-is-separated-by-the-panel-s-own-row-gap',
  !!ROW_GAP && !!FIELD_MARGIN && parseFloat(ROW_GAP.v) === parseFloat(FIELD_MARGIN.v) && parseFloat(ROW_GAP.v) > 0,
  `the stacked rows are separated by ${ROW_GAP?.v} of \`margin-top\`, which is EXACTLY the ${FIELD_MARGIN?.v} ` +
  '`margin-bottom` that separates every other pair of adjacent controls in the Text section (the size row from ' +
  'the weight row, the weight row from the font row). So the align pair now reads at the panel’s rhythm rather ' +
  'than at 0px, which is what Harvey reported: "2 hàng ở align nó đang hơi sát nhau. nên có khoảng cách như 6 fonts vậy".');

assert('ab1.the-separation-is-an-adjacent-sibling-rule-not-a-new-wrapper-field',
  /\.field\s*>\s*\.swatches\.insp-seg\s*\+\s*\.swatches\.insp-seg/.test(STYLES)
    && computed(['swatches', 'insp-seg'], 'margin-top')?.v === ROW_GAP?.v,
  'the gap is a `margin-top` on the SECOND segmented row, matched by an adjacent-sibling rule whose final ' +
  'compound is the row itself — so no `<div className="field">` was wrapped around the pair and the ' +
  '`.field label` contract (one label, then its controls) is untouched. The cascade confirms the row computes ' +
  `${computed(['swatches', 'insp-seg'], 'margin-top')?.v} of \`margin-top\` [${computed(['swatches', 'insp-seg'], 'margin-top')?.sel}].`);

/* THE RULE MUST MATCH EXACTLY ONE PLACE IN THE APP. "Two `<ToggleRow/>`s with
   nothing but whitespace between them" IS the stacked-in-one-field shape, so it
   is counted directly from the source rather than assumed: if a later round
   stacks another pair, the count changes and this assertion reports it. */
const ADJACENT_ROWS = (APP.match(/\/>\s*\n\s*<ToggleRow/g) ?? []);
const alignField = APP.slice(APP.indexOf('<label>align</label>'));
console.log(`  App.tsx: ${ADJACENT_ROWS.length} adjacent \`<ToggleRow/>\` pair(s) in the whole panel`);
assert('ab1.exactly-one-field-in-the-panel-stacks-two-segmented-rows',
  ADJACENT_ROWS.length === 1
    && /<label>align<\/label>[\s\S]{0,2000}?\/>\s*\n\s*<ToggleRow[\s\S]{0,300}?options=\{VALIGN_OPTS\}/.test(alignField),
  `exactly ONE adjacent pair exists (${ADJACENT_ROWS.length}), the horizontal align row followed by the ` +
  'vertical align row inside the ONE `.field` labelled `align`' +
  ` (App.tsx:${at(APP_RAW, '<label>align</label>')}) — so the rule is scoped to the one place it describes, ` +
  'and the two rows it separates are the two Harvey named.');

/* AND THE PAIR IS STILL TWO `ToggleRow`s OF THE SAME CONTROL — not a re-layout. */
assert('ab1.both-align-rows-are-still-the-one-shared-segmented-control',
  /options=\{ALIGN_OPTS\}/.test(APP) && /options=\{VALIGN_OPTS\}/.test(APP)
    && countOf(APP, 'options={ALIGN_OPTS}') === 1 && countOf(APP, 'options={VALIGN_OPTS}') === 1,
  `${countOf(APP, 'options={ALIGN_OPTS}')} ALIGN_OPTS row and ${countOf(APP, 'options={VALIGN_OPTS}')} ` +
  'VALIGN_OPTS row, both `<ToggleRow/>` — the spacing fix moved no markup and introduced no second control.');

/* ===========================================================================
   ITEM 2 — THE FAVOURITE TILE'S REMOVE CONTROL.
   =========================================================================== */
console.log('\n' + '='.repeat(78));
console.log('ITEM 2 — a remove control on a favourite tile, on the ONE removal path');
console.log('='.repeat(78));

/* The tile BLOCK, cut from the `<div className="fav-grid">` open to the
   custom-shapes section that follows it, so every probe below is about the
   Favourites strip and not about the section around it. The cut uses the
   MARKUP (`className="cust-shapes"`), not the comment that names it: comments
   are blanked in `APP`, so a comment-based cut would silently truncate. */
const favGridStart = APP.indexOf('className="fav-grid"');
const favGridEnd = APP.indexOf('className="cust-shapes"', favGridStart);
const FAV_BLOCK = APP.slice(favGridStart, favGridEnd > 0 ? favGridEnd : favGridStart + 4000);
const CUST_BLOCK = APP.slice(APP.indexOf('className="cust-grid"'));

assert('ab2.the-tile-carries-a-remove-control-with-a-named-accessible-label',
  /className="fav-remove"/.test(FAV_BLOCK)
    && /role="button"/.test(FAV_BLOCK.slice(FAV_BLOCK.indexOf('fav-remove')))
    && /tabIndex=\{0\}/.test(FAV_BLOCK.slice(FAV_BLOCK.indexOf('fav-remove')))
    && /aria-label=\{`Remove \$\{library\.favouriteName\(f\)\} from Favourites`\}/.test(FAV_BLOCK)
    && /data-fav-remove=\{f\.id\}/.test(FAV_BLOCK),
  'the tile renders `.fav-remove`, a `role="button"` with `tabIndex={0}` (so it is key-operable), carrying the ' +
  'per-item accessible name `Remove <name> from Favourites` — the NAME of the favourite being removed, not a bare ' +
  '"remove", which is what the brief requires and what makes the control usable with a screen reader on a grid of ' +
  'identically-labelled tiles. `data-fav-remove={f.id}` is the hook the live pass reads.');

/* THE EVENTS STOPPED. The tile inserts on `click` (and on double-click / drag),
   so every one of those paths must be closed on the remove control. */
const REMOVE_BLOCK = FAV_BLOCK.slice(FAV_BLOCK.indexOf('className="fav-remove"'), FAV_BLOCK.indexOf('</button>', FAV_BLOCK.indexOf('className="fav-remove"')));
const stops = ev => new RegExp(`on${ev}=\\{e =>[^}]*stopPropagation`).test(REMOVE_BLOCK);
console.log(`  handlers on .fav-remove: click stopPropagation=${stops('Click')} dblClick=${stops('DoubleClick')} dragStart=${stops('DragStart')} keydown=${stops('KeyDown')}`);
assert('ab2.the-remove-control-stops-every-event-the-tile-inserts-on',
  stops('Click') && stops('DoubleClick') && stops('DragStart') && stops('KeyDown')
    && /onKeyDown=\{e => \{\s*\n\s*if \(e\.key === 'Enter' \|\| e\.key === ' '\)/.test(REMOVE_BLOCK),
  'the remove control stops `click` (the tile\'s own insert handler — the event that would otherwise insert AND ' +
  'remove in one press), `dblclick` (a fast double-tap on the × would otherwise reach the tile\'s ' +
  '`onDoubleClick`), `dragstart` (mousedown on a child of a `draggable` button can start the tile\'s drag, which ' +
  'is what really inserts on a canvas drop — prevented outright) and its own `keydown` Enter / Space (so the key ' +
  'that activates the × cannot also reach a handler behind it). `onClick` alone would have been the bug the brief ' +
  'warns about.');

/* ONE REMOVAL PATH — the existing one, UNTIL ROUND AE RE-KEYED IT ON THE ID.
   ROUND AE: the argument is `f.id` and the library helper is
   `removeFavouriteById`, because a selection-saved favourite has no label and a
   label-based removal would take every unnamed favourite at once. The invariant
   this assertion exists for is unchanged — the tile must not grow a SECOND app
   level removal — so it now asserts THAT, against the id-keyed helper. */
assert('ab2.the-removal-reuses-the-single-existing-path-and-adds-no-second-one',
  countOf(APP, 'library.removeFavouriteById') === 1
    && /const removeFavourite = useCallback\(\(id: string\) => \{\s*\n\s*mutateFavourites\(prev => library\.removeFavouriteById\(prev, id\)\)/.test(APP)
    && /onClick=\{e => \{\s*\n\s*e\.stopPropagation\(\);\s*\n\s*removeFavourite\(f\.id\)/.test(REMOVE_BLOCK)
    && countOf(APP, 'const removeFavourite = useCallback') === 1
    && countOf(REMOVE_BLOCK, 'removeFavourite(') === 2,
  `${countOf(APP, 'library.removeFavouriteById')} call to \`library.removeFavouriteById\` in the whole app, reached ` +
  'from the tile through `removeFavourite` → `mutateFavourites` — the SAME writer `toggleFavourite` (the palette ' +
  'star) uses, so the strip and the star share one ref-synchronous update and one deferred persist. The tile calls ' +
  'it from its `onClick` and its `onKeyDown`; no second removal function was written. (ROUND AE re-keyed the ' +
  'argument from the label to the id; the ONE-path invariant is what this assertion holds.)');

/* ALWAYS VISIBLE, AND REACHABLE FROM THE KEYBOARD. */
const REMOVE_CSS = ruleText('.fav-remove');
const removeOpacity = (() => {
  /* The BASE state: the `.fav-remove` rule itself, not its hover/focus rules. */
  for (const r of RULES) {
    for (const sel of r.selectors) {
      if (/^\.fav-remove(?!:)/.test(sel)) return decl(r.decls, 'opacity');
    }
  }
  return null;
})();
console.log(`  .fav-remove base opacity   : ${removeOpacity}`);
console.log(`  .fav-remove reveal rules   : ${(STYLES.match(/\.fav-tile:(hover|focus-within) > \.fav-remove/g) ?? []).join('  ')}`);
assert('ab2.the-control-is-visible-without-hover-and-raised-on-focus-within',
  parseFloat(removeOpacity) > 0 && parseFloat(removeOpacity) < 1
    && /\.fav-tile:hover > \.fav-remove/.test(STYLES)
    && /\.fav-tile:focus-within > \.fav-remove/.test(STYLES)
    && /\.fav-remove:focus-visible/.test(STYLES),
  `the control is present at \`opacity: ${removeOpacity}\` with NO hover — deliberately visible at low ` +
  'emphasis rather than hover-only, because this project treats tablet and phone as in scope and a tablet has no ' +
  'hover to reveal anything with. `:hover` and `:focus-within` on the TILE raise its emphasis for mouse and ' +
  'keyboard users, and `.fav-remove:focus-visible` raises it for the control itself, so all three input modes ' +
  'reach the same target. A hover-only control would have been unreachable on touch.');

/* THE GEOMETRY AT THE NARROWEST COLUMN `.fav-grid` CAN PRODUCE. */
const GRID_MIN = parseFloat(/(?<=minmax\()\d+(?=px)/.exec(ruleText('.fav-grid'))?.[0] ?? '0');
const REMOVE_W = parseFloat(decl(REMOVE_CSS, 'width'));
/* AP-2: the control grew to 24px (hit-target minimum), anchored top:0/right:0 —
   the glyph ends at x 53, the box starts at 48, so 5px clear. */
const REMOVE_INSET = parseFloat(/(?:^|;)\s*right:\s*(-?\d+)px/.exec(REMOVE_CSS)?.[1] ?? '0');
const GLYPH_W = parseFloat(decl(ruleText('.fav-glyph'), 'width'));
const TILE_PAD = parseFloat(/(?:^|;)\s*padding:\s*7px 4px/.test(ruleText('.fav-tile')) ? '4' : '0');
const removeLeft = GRID_MIN - REMOVE_INSET - REMOVE_W; // signed inset: -4 GROWS the box outward
const glyphRight = (GRID_MIN / 2) + (GLYPH_W / 2);
console.log(`  at the ${GRID_MIN}px grid minimum: tile ${GRID_MIN}px, .fav-remove spans x ${removeLeft}–${GRID_MIN - REMOVE_INSET}, ` +
  `.fav-glyph (${GLYPH_W}px, centred) ends at x ${glyphRight}; tile hit area left of the control = ${removeLeft}px`);
assert('ab2.the-control-fits-inside-the-tile-at-the-narrowest-grid-column-and-does-not-shrink-the-hit-area',
  /* AP-2 re-anchor: at 24px the box can no longer clear the 34px glyph inside a 72px
     tile (24+34+2*TILE_PAD > 72), so the control OVERLAYS the art corner - the pattern
     Excalidraw/tldraw use for tile remove buttons. The invariants that matter now:\     the box stays fully inside the tile, and opacity .6 keeps the art readable underneath. */
  GRID_MIN === 72 && REMOVE_W === 24 && REMOVE_INSET === 0
    && removeLeft >= TILE_PAD && (GRID_MIN - REMOVE_INSET) <= GRID_MIN
    && computed(['fav-tile'], 'position')?.v === 'relative',
  `at the ${GRID_MIN}px minimum column the 24px control (AP-2 hit-target minimum) spans x ${removeLeft}–${GRID_MIN - REMOVE_INSET} and the ` +
  `centred ${GLYPH_W}px glyph ends at x ${glyphRight.toFixed(1)} — at 24px the control overlays the art corner ` +
  "(the Excalidraw/tldraw tile-remove pattern: visible on hover, opacity .6 at rest keeps the art readable) and never " +
  `overflows the tile, and ${removeLeft}px of the tile width remains the insert's own hit area. ` +
  "`.fav-tile { position: relative }` is what makes the corner " +
  'the TILE\'s corner rather than the grid cell\'s, exactly as `.cust-tile` does for the custom-shape grid.');

assert('ab2.the-remove-control-adds-no-colour-literal-and-reuses-the-cust-remove-vocabulary',
  hexCount(REMOVE_CSS) === 0
    && decl(REMOVE_CSS, 'border') === '1px solid var(--border)'
    && decl(REMOVE_CSS, 'background') === 'var(--surface)'
    && decl(REMOVE_CSS, 'color') === 'var(--dim)'
    && ['width', 'height', 'border-radius', 'display', 'place-items'].every(p =>
      decl(REMOVE_CSS, p) === decl(ruleText('.cust-remove'), p)),
  `${hexCount(REMOVE_CSS)} hex literals — every colour resolves through a token (\`--border\`, \`--surface\`, ` +
  '\`--dim\`), and width / height / border-radius / display / place-items are byte-identical to the existing ' +
  '`.cust-remove`, so the two tile grids share one control vocabulary instead of growing a second one.');

/* SCOPED TO FAVOURITES, deliberately: the custom-shape tiles keep their own
   control, and no second one was added there. */
assert('ab2.the-scope-is-favourites-and-the-custom-tiles-are-untouched',
  countOf(CUST_BLOCK, 'cust-remove') === 1 && countOf(CUST_BLOCK, 'fav-remove') === 0
    && countOf(APP, 'className="fav-remove"') === 1,
  `exactly one \`fav-remove\` call site (${at(APP_RAW, 'className="fav-remove"')}) and the custom-shape tiles keep ` +
  'their own `cust-remove` untouched — Harvey said "shape trong favorite", so the change is scoped to the ' +
  'Favourites strip. Whether the custom tiles should ALSO carry it is reported, not assumed.');

/* ===========================================================================
   ITEM 3 — THE SHAPE POPOVER: HORIZONTAL CLAMP, VERTICAL PLACEMENT, THE INPUT.
   =========================================================================== */
console.log('\n' + '='.repeat(78));
console.log('ITEM 3 — the shape popover stays in its panel and in the viewport');
console.log('='.repeat(78));

/* --- (a) THE HORIZONTAL CLAMP, resolved through the cascade. --- */
const POP_W = computed(['icon-pop', 'insp-pop'], 'width');
const POP_ANCHOR = computed(['icon-pop', 'insp-pop'], 'right');
console.log(`  .icon-pop.insp-pop → width: ${POP_W?.v}   right: ${POP_ANCHOR?.v}   [${POP_W?.sel}]`);
assert('ab3.the-popover-width-is-clamped-to-its-trigger-so-it-cannot-overhang-the-panel',
  /^min\(288px, calc\(100% - 12px\)\)$/.test(POP_W?.v ?? '')
    && POP_ANCHOR?.v === '12px'
    && computed(['icon-pop'], 'width')?.v === 'min(264px, calc(100% - 12px))',
  `the popover computes \`width: ${POP_W?.v}\` [${POP_W?.sel}] against a \`right: ${POP_ANCHOR?.v}\` anchor. The ` +
  '`calc(100% - 12px)` half is the LOAD-BEARING one: `100%` is the trigger\'s own width, so with a 12px right ' +
  'inset the popover\'s left edge lands exactly on the trigger\'s left edge and it can never leave the field at ' +
  'any panel width the resizer produces. Before this round the width was a FIXED 288px against a 264px ' +
  'containing block, which is the arithmetic behind the measured `left: 958` vs panel `left: 992` — 34px of ' +
  'popover painted over the canvas = 288 - 264 + 12. The base `.icon-pop` rule is clamped too, so no inspector ' +
  'popover can overhang.');

/* The painted arithmetic, at both ends of the panel range. */
const PANEL_FIELDS = [{name: 'default panel (--right-w: 288px)', field: 264}, {name: 'resizer floor', field: 253}];
const panelRows = PANEL_FIELDS.map(({name, field}) => {
  const w = Math.min(288, field - 12);
  return {name, field, w, left: field - 12 - w};
});
for (const r of panelRows) console.log(`  ${r.name.padEnd(30)} field ${r.field}px → popover ${r.w}px, left offset ${r.left}px (0 = flush with the field's left edge)`);
assert('ab3.the-popover-is-flush-with-or-inside-the-field-at-every-panel-width',
  panelRows.every(r => r.left === 0 && r.w <= 288),
  `at the default panel the field is ${panelRows[0].field}px and the popover clamps to min(288, ${panelRows[0].field} - 12) = ` +
  `${panelRows[0].w}px, its left edge exactly on the field's; at the resizer's floor (${panelRows[1].field}px field) it clamps to ` +
  `${panelRows[1].w}px and is again flush. So the popover can never paint over the canvas and does not move ` +
  'horizontally in the ordinary case — it is still right-aligned to its trigger, never re-centred.');

/* --- (b) THE VERTICAL PLACEMENT, EXECUTED against the real module. ---
   The bundle lives INSIDE the repo (like `checks/package-p-render-check.mjs`
   keeps its own entry/output in ROOT): a bundle in `/tmp` cannot resolve the
   `react` its externals leave behind. */
const BUNDLE_ENTRY = join(ROOT, '.ab-picks-entry.ts');
const BUNDLE_OUT = join(ROOT, '.ab-picks-out.mjs');
writeFileSync(BUNDLE_ENTRY, `export {popoverPlacement, placementStyle} from './src/InspectorPickers';\n`);
const {execFileSync} = await import('node:child_process');
writeFileSync(BUNDLE_OUT, execFileSync(join(ROOT, 'node_modules/.bin/esbuild'),
  [BUNDLE_ENTRY, '--bundle', '--platform=node', '--format=esm', '--log-level=error',
    '--external:react', '--external:react-dom', '--external:react/jsx-runtime'],
  {encoding: 'utf8'}));

/* A minimal fake element: only the two members `popoverPlacement` reads. */
const fakeBox = (triggerTop, triggerBottom, height) => {
  const rect = {top: 0, bottom: height, height};
  return {
    getBoundingClientRect: () => rect,
    parentElement: {getBoundingClientRect: () => ({top: triggerTop, bottom: triggerBottom})},
  };
};
globalThis.window = {innerHeight: 577};
const PICKS_MOD = await import(`${BUNDLE_OUT}?t=${Date.now()}`);
const {popoverPlacement, placementStyle} = PICKS_MOD;

/* THE MEASURED CASE: the shape popover's `bottom` was 601 in a 577px viewport,
   and its trigger sat low in the panel. Trigger ends at 535, popover 300 tall. */
const measuredCase = {triggerTop: 500, triggerBottom: 535, height: 300, vh: 577};
globalThis.window = {innerHeight: measuredCase.vh};
const placed = popoverPlacement(fakeBox(measuredCase.triggerTop, measuredCase.triggerBottom, measuredCase.height));
const placedStyle = placementStyle(placed);
/* Above the trigger, the box's BOTTOM is anchored `POPOVER_GAP` above the
   trigger's top and the shift (0 here) pushes it back down — so the top is
   `triggerTop - GAP - shift - height`. */
const POPOVER_GAP = 6;
const placedTop = measuredCase.triggerTop - POPOVER_GAP - placed.shift - measuredCase.height;
const placedBottom = placedTop + measuredCase.height;
console.log(`  MEASURED CASE (vh ${measuredCase.vh}, trigger ${measuredCase.triggerTop}–${measuredCase.triggerBottom}, popover ${measuredCase.height} tall):`);
console.log(`    unplaced below: top ${measuredCase.triggerBottom + POPOVER_GAP} → bottom ${measuredCase.triggerBottom + POPOVER_GAP + measuredCase.height}  (viewport floor ${measuredCase.vh - 8} — CLIPPED)`);
console.log(`    placed: above=${placed.above} shift=${placed.shift} → top ${placedTop}, bottom ${placedBottom}`);
assert('ab3.a-popover-with-no-room-below-flips-above-its-trigger-and-fits',
  placed.above === true && placed.shift === 0
    && placedBottom <= measuredCase.vh - 8 && placedTop >= 8
    && placedStyle.bottom === `calc(100% + ${POPOVER_GAP}px)` && placedStyle.top === 'auto',
  `an unplaced popover at this trigger would run to ${measuredCase.triggerBottom + POPOVER_GAP + measuredCase.height} against a ` +
  `${measuredCase.vh}px viewport, i.e. past the ${measuredCase.vh - 8}px floor — the pre-round measurement was \`bottom: 601\` vs ` +
  `577, 24px of unclickable rows. The executed placement returns \`above: true\` with no shift, so the popover hangs off ` +
  `the trigger's TOP instead: top ${placedTop}, bottom ${placedBottom}, wholly inside the viewport. The style sets ` +
  '`top: auto` with `bottom: calc(100% + 6px)` — `top: auto` is not decorative: with both `top` and `bottom` set and a ' +
  'height of auto, an absolutely-positioned box would STRETCH between them instead of hanging off the trigger.');

/* THE ORDINARY CASE MUST NOT MOVE — the negative control for the flip. */
const roomyBox = {getBoundingClientRect: () => ({top: 241, bottom: 541, height: 300}), parentElement: {getBoundingClientRect: () => ({top: 200, bottom: 235})}};
/* A trigger LOW in a SHORT viewport: below is clipped and above is not, which is
   the case that must flip. Same popover, same height — only the position moves,
   so the decision is provably the placement's and not the box's. */
const lowBox = {getBoundingClientRect: () => ({top: 491, bottom: 791, height: 300}), parentElement: {getBoundingClientRect: () => ({top: 450, bottom: 485})}};
globalThis.window = {innerHeight: 577};
const lowShort = popoverPlacement(lowBox);
/* …and the ordinary long viewport, where nothing may move. */
globalThis.window = {innerHeight: 900};
const roomy2 = popoverPlacement(roomyBox);
console.log(`  LOW TRIGGER (450–485) in vh 577 → above=${lowShort.above} shift=${lowShort.shift}`);
console.log(`  ROOMY TRIGGER (200–235) in vh 900 → above=${roomy2.above} shift=${roomy2.shift}   (and in vh 577: above=${popoverPlacement(roomyBox).above})`);
assert('ab3.a-popover-with-room-below-is-not-moved-at-all',
  roomy2.above === false && roomy2.shift === 0
    && placementStyle(roomy2).top === `calc(100% + ${POPOVER_GAP}px)` && placementStyle(roomy2).marginTop === 0
    && lowShort.above === true && lowShort.shift === 0,
  'with 900px of viewport the popover stays BELOW its trigger with zero shift — the guard is a correction, not a ' +
  'relocation, so the ordinary case keeps the pre-round `top: calc(100% + 6px)` and only a clipped one moves. A trigger ' +
  'low in a 577px viewport flips above, and the trigger that is high in the panel does NOT even at 577px — so the ' +
  'decision is driven by the measured room, not by a blanket rule.');

/* NEITHER SIDE FITS: the box must still end up wholly inside the viewport. */
globalThis.window = {innerHeight: 300};
const tiny = {getBoundingClientRect: () => ({top: 0, bottom: 260, height: 260}), parentElement: {getBoundingClientRect: () => ({top: 200, bottom: 235})}};
const tinyPlaced = popoverPlacement(tiny);
const tinyTop = tinyPlaced.above ? (200 - 6 - 260 + tinyPlaced.shift) : (235 + 6 - tinyPlaced.shift);
console.log(`  NEITHER-SIDE CASE (vh 300, trigger 200–235, popover 260 tall): above=${tinyPlaced.above} shift=${tinyPlaced.shift} → top ${tinyTop}, bottom ${tinyTop + 260}`);
assert('ab3.when-neither-side-fits-the-popover-is-shifted-back-inside-the-viewport',
  tinyTop >= 8 && tinyTop + 260 <= 292,
  `with a viewport shorter than the popover the placement takes the roomier side and shifts the remainder back ` +
  `inside — the box lands at ${tinyTop}–${tinyTop + 260} inside the 8–292 band, so a very short viewport trades ` +
  'a clipped BOTTOM for a clipped top at worst, never both. The list caps (`min(60dvh, 260px)` on ' +
  '`.insp-opt-list` / `.insp-shape-list`) are what keep this case rare and the box short enough.');

/* IDEMPOTENCE — the whole reason the reading is taken from the ANCHOR and the
   popover's HEIGHT rather than from the popover's own top. */
globalThis.window = {innerHeight: 577};
const A = popoverPlacement(fakeBox(500, 535, 300));
const B = popoverPlacement(fakeBox(500, 535, 300));
const applied = {getBoundingClientRect: () => ({top: 229, bottom: 529, height: 300}), parentElement: {getBoundingClientRect: () => ({top: 500, bottom: 535})}};
const C = popoverPlacement(applied);
console.log(`  IDEMPOTENCE: same trigger+height → ${JSON.stringify(A)} / ${JSON.stringify(B)}; after the shift is applied (box top now 229) → ${JSON.stringify(C)}`);
assert('ab3.the-placement-is-idempotent-so-it-cannot-oscillate',
  JSON.stringify(A) === JSON.stringify(B) && JSON.stringify(C) === JSON.stringify(A),
  'the placement is derived from the TRIGGER\'s rect and the popover\'s HEIGHT, never from the popover\'s own top ' +
  `— so the same trigger yields the same answer (${JSON.stringify(A)}) and re-measuring the box AFTER the shift has ` +
  `been applied yields it again (${JSON.stringify(C)}). A placement read from the shifted box would ask for zero on ` +
  'the second pass and the popover would flicker between two positions.');

/* --- (c) THE SEARCH INPUT IS AN ORDINARY INPUT. ---
   Read through the cascade, so the CONTROL KIT's text-input group — which sits
   at the END of the sheet and paints a focused input with `--acc` — is part of
   the answer. `:focus` is the state the user actually sees, because the popover
   autofocuses this field on open. */
const SEARCH_REST = computed(['icon-search'], 'border');
const SEARCH_FOCUS = computed(['icon-search'], 'border-color', {pseudo: 'focus'});
const SEARCH_FOCUS_HALO = computed(['icon-search'], 'box-shadow', {pseudo: 'focus'});
const SEARCH_HOVER = computed(['icon-search'], 'border-color', {pseudo: 'hover'});
console.log(`  .icon-search → rest: ${SEARCH_REST?.v} [${SEARCH_REST?.sel}]`);
console.log(`                 :hover: ${SEARCH_HOVER?.v} [${SEARCH_HOVER?.sel}]`);
console.log(`                 :focus: ${SEARCH_FOCUS?.v} [${SEARCH_FOCUS?.sel}]   box-shadow: ${SEARCH_FOCUS_HALO?.v}`);
assert('ab3.the-search-input-rests-and-focuses-on-an-ordinary-border-not-the-accent',
  SEARCH_REST?.v === '1px solid var(--border)'
    && !/--acc/.test(SEARCH_REST?.v ?? '')
    && SEARCH_HOVER?.v === 'var(--border-strong)'
    && SEARCH_FOCUS?.v === 'var(--sel)'
    && SEARCH_FOCUS_HALO?.v === 'none',
  `the search box computes \`border: ${SEARCH_REST?.v}\` at rest [${SEARCH_REST?.sel}] — \`--border\`, the same resting ` +
  `border every other input in the app uses — hovering to \`${SEARCH_HOVER?.v}\` and FOCUSING to \`${SEARCH_FOCUS?.v}\` ` +
  `[${SEARCH_FOCUS?.sel}] with \`box-shadow: ${SEARCH_FOCUS_HALO?.v}\`. It was measured live as \`rgb(245, 78, 0)\`, which is ` +
  '`--acc` — the token the CONTROL KIT (end of the sheet) paints on a focused input. The popover autofocuses the field, ' +
  'so that focus state IS what the user saw on open: an orange ring reading as an error on a box with nothing wrong. ' +
  'The popover now states its own focus border with a three-part selector (`.icon-pop .icon-search:focus`), which beats ' +
  'the kit\'s two-part one on SPECIFICITY, and drops the accent halo — so focus is still plainly indicated, in `--sel`, ' +
  'the same blue this popover\'s own selected row and cell already use.');

/* ===========================================================================
   GATES
   =========================================================================== */
console.log('\n' + '='.repeat(78));
console.log('GATES');
console.log('='.repeat(78));
const HEX_LIMIT = 160;   // raised from 127 by ROUND AG1, which ADDED colour on purpose
const HEX = hexCount(STYLES_RAW);
console.log(`  hex literals in src/styles.css: ${HEX} (limit ${HEX_LIMIT}, raised by ROUND AG1)`);
assert('ab0.the-token-gate-holds', HEX <= HEX_LIMIT, `${HEX} hex colour literals in \`src/styles.css\`. This round ADDED ` +
  'colour on purpose (ROUND AG1: amber\'s light/paper inks de-browned and the red/blue/pink families added across five ' +
  'themes), so the gate now bounds the sheet at a ceiling rather than pinning it to a count — a pinned count turns RED on ' +
  'every future round that legitimately adds a token.');

const failed = results.filter(r => !r.pass);
console.log('\n' + '='.repeat(78));
console.log(`ROUND AB HARNESS: ${results.length - failed.length}/${results.length} passed`);
console.log('='.repeat(78));
for (const f of failed) console.log(`  FAIL  ${f.id}  —  ${f.detail}`);
try { rmSync(BUNDLE_ENTRY, {force: true}); rmSync(BUNDLE_OUT, {force: true}); } catch { /* gone */ }
console.log(`  cleaned build artefacts: ${BUNDLE_ENTRY.replace(ROOT + '/', '')}, ${BUNDLE_OUT.replace(ROOT + '/', '')}`);
process.exit(failed.length ? 1 : 0);
