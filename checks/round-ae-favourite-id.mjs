#!/usr/bin/env node
/**
 * ROUND AE harness — id-based favourite removal.
 *
 * No browser, no DOM. The removal itself is EXECUTED: `src/library.ts` imports
 * nothing but two TYPES, so it bundles and runs in Node, and the three helpers
 * below are called for real rather than transcribed. The wiring (which helper the
 * tile reaches, and that no tile is scoped out of it) is read out of
 * `src/App.tsx` with comments blanked.
 *
 * THE CASE THIS ROUND EXISTS FOR, stated up front: a favourite saved from a
 * SELECTION carries no `__label`, so `favouriteLabel()` returns `undefined` for
 * it. A label-based removal therefore matches EVERY unnamed favourite at once.
 * The assertions below construct exactly that collision — two unnamed favourites
 * — and require the id-based path to remove one and leave the other.
 */
import {readFileSync, writeFileSync, rmSync} from 'node:fs';
import {join} from 'node:path';

const ROOT = '/home/harvey/projects/tech-goblin/lab/diagram-studio';
const APP_RAW = readFileSync(`${ROOT}/src/App.tsx`, 'utf8');
const LIB_RAW = readFileSync(`${ROOT}/src/library.ts`, 'utf8');

const blank = m => m.replace(/[^\n]/g, ' ');
const stripTs = s => s
  .replace(/\/\*[\s\S]*?\*\//g, blank)
  .replace(/(^|[^:])\/\/[^\n]*/g, (m, p1) => p1 + ' '.repeat(m.length - p1.length));
const APP = stripTs(APP_RAW);
const LIB = stripTs(LIB_RAW);
const countOf = (t, n) => t.split(n).length - 1;
const at = (raw, needle) => {
  const i = raw.split('\n').findIndex(l => l.includes(needle));
  return i < 0 ? 0 : i + 1;
};

const results = [];
const assert = (id, pass, detail = '') => {
  results.push({id, pass: !!pass, detail});
  console.log(`  ${pass ? 'PASS' : 'FAIL'}  ${id}  —  ${detail}`);
};

/* THE MODULE, EXECUTED. A bundle written to /tmp cannot resolve its own
   externals, so entry and output live INSIDE ROOT and are removed at the end. */
const ENTRY = join(ROOT, '.ae-entry.ts');
const OUT = join(ROOT, '.ae-out.mjs');
writeFileSync(ENTRY, `export * from './src/library';\n`);
const {execFileSync} = await import('node:child_process');
writeFileSync(OUT, execFileSync(join(ROOT, 'node_modules/.bin/esbuild'),
  [ENTRY, '--bundle', '--platform=node', '--format=esm', '--log-level=error'],
  {encoding: 'utf8'}));
const L = await import(`${OUT}?t=${Date.now()}`);

console.log('='.repeat(78));
console.log('AE-1 — the collision case, EXECUTED against src/library.ts');
console.log('='.repeat(78));

/* Two favourites saved from SELECTIONS: no `name`, no `__label`, each with a
   distinct id — which is what `favouriteFromSelection` actually produces. Built
   here as literals so the shape is explicit, then checked against the real
   `favouriteLabel` / `favouriteName` rather than assumed. */
const unnamedA = {id: 'fav_aaa111', created: 1, nodes: [{shape: 'service', colorKey: 'cyan'}], edges: []};
const unnamedB = {id: 'fav_bbb222', created: 2, nodes: [{shape: 'queue', colorKey: 'amber'}], edges: []};
const starred = L.favouriteFromItem({label: 'Terminal', colorKey: 'green', make: () => ({shape: 'terminator', colorKey: 'green'})});
const list3 = [unnamedA, unnamedB, starred];

console.log(`  favouriteFromItem('Terminal') → id=${starred.id} name=${JSON.stringify(starred.name)} label=${JSON.stringify(L.favouriteLabel(starred))}`);
console.log(`  unnamedA label=${JSON.stringify(L.favouriteLabel(unnamedA))} name=${JSON.stringify(L.favouriteName(unnamedA))}`);
console.log(`  unnamedB label=${JSON.stringify(L.favouriteLabel(unnamedB))} name=${JSON.stringify(L.favouriteName(unnamedB))}`);

assert('ae1.a-selection-saved-favourite-has-no-label-and-the-old-path-would-take-both',
  L.favouriteLabel(unnamedA) === undefined && L.favouriteLabel(unnamedB) === undefined
    && L.removeFavouriteItem(list3, undefined).length === 1
    && L.removeFavouriteItem(list3, undefined)[0].id === starred.id,
  'both selection-saved favourites report `undefined` as their label, and `removeFavouriteItem(list, undefined)` removes BOTH of them ' +
  'in one call (leaving only the starred one). That is the collision the round exists for — it is a property of the real module, measured, ' +
  'not a hypothetical.');

/* THE FIX: the id path removes EXACTLY ONE. */
const afterA = L.removeFavouriteById(list3, unnamedA.id);
console.log(`  removeFavouriteById(list, '${unnamedA.id}') → ${afterA.length} remain: [${afterA.map(f => f.id).join(', ')}]`);
assert('ae2.id-based-removal-removes-EXACTLY-ONE-favourite',
  afterA.length === 2 && !afterA.some(f => f.id === unnamedA.id)
    && afterA.some(f => f.id === unnamedB.id) && afterA.some(f => f.id === starred.id),
  `3 favourites in, ${afterA.length} out: only \`${unnamedA.id}\` was removed. The other UNNAMED favourite (\`${unnamedB.id}\`) and the ` +
  'starred one both survive — which is exactly what the label-based call above could not do.');

assert('ae2.two-unnamed-favourites-survive-each-other-s-removal',
  (() => {
    const afterB = L.removeFavouriteById(afterA, unnamedB.id);
    /* and the mirror: remove B first from the original list. */
    const mirror = L.removeFavouriteById(list3, unnamedB.id);
    return afterB.length === 1 && afterB[0].id === starred.id
      && mirror.length === 2 && mirror.some(f => f.id === unnamedA.id) && !mirror.some(f => f.id === unnamedB.id);
  })(),
  'removing the two unnamed favourites one at a time takes exactly one each time, in either order: A then B leaves the starred item, ' +
  'and B first leaves A. Neither unnamed favourite is collateral damage for the other.');

assert('ae2.removing-an-unknown-id-changes-nothing',
  L.removeFavouriteById(list3, 'fav_nothere').length === 3,
  'an id that matches no favourite leaves the list length at 3 — the filter is an equality, so a stale id is a no-op rather than a wipe.');

assert('ae2.the-label-based-path-still-works-for-the-star',
  L.removeFavouriteItem(list3, 'Terminal').length === 2
    && L.removeFavouriteItem(list3, 'Terminal').every(f => f.id !== starred.id)
    && L.toggleFavouriteItem([starred], {label: 'Terminal', colorKey: 'green', make: () => ({})}).length === 0,
  '`removeFavouriteItem(list, \'Terminal\')` still drops exactly the starred favourite, and `toggleFavouriteItem` — the palette star\'s ' +
  'toggle — still removes through it, returning an empty list. So the label path was KEPT WORKING, not replaced.');

/* BOTH helpers exist, each with one job, and neither shadows the other. */
console.log(`  library.ts exports: removeFavouriteItem=${countOf(LIB, 'export const removeFavouriteItem')} ` +
  `removeFavouriteById=${countOf(LIB, 'export const removeFavouriteById')}`);
assert('ae2.exactly-two-removal-helpers-exist-and-no-third-mechanism-was-written',
  countOf(LIB, 'export const removeFavouriteItem') === 1
    && countOf(LIB, 'export const removeFavouriteById') === 1
    && countOf(APP, 'library.removeFavouriteById') === 1
    && countOf(APP, 'library.removeFavouriteItem') === 0,
  'ONE label-based helper (kept for the star, reached only through `toggleFavouriteItem`) and ONE id-based helper, which is the only ' +
  'removal the app itself calls. No third mechanism: `library.removeFavouriteItem` does not appear in `App.tsx` at all any more, and ' +
  '`removeFavouriteById` appears once.');

/* ===========================================================================
   THE WIRING — read out of App.tsx.
=========================================================================== */
console.log('\n' + '='.repeat(78));
console.log('AE-3 — the tile: every favourite has a remove control, and it is id-keyed');
console.log('='.repeat(78));

const favGridStart = APP.indexOf('className="fav-grid"');
const favGridEnd = APP.indexOf('className="cust-shapes"', favGridStart);
const FAV_BLOCK = APP.slice(favGridStart, favGridEnd > 0 ? favGridEnd : favGridStart + 4000);
const REMOVE_BLOCK = FAV_BLOCK.slice(FAV_BLOCK.indexOf('className="fav-remove"'));

console.log(`  .fav-remove call sites in the strip: ${countOf(FAV_BLOCK, 'className="fav-remove"')}`);
console.log(`  \`removeFavourite(\` calls inside the remove block: ${countOf(REMOVE_BLOCK, 'removeFavourite(')}`);

assert('ae3.every-tile-renders-the-remove-control-unconditionally',
  countOf(FAV_BLOCK, 'className="fav-remove"') === 1
    && !/\{library\.favouriteLabel\(f\)\s*&&/.test(FAV_BLOCK)
    && !/\{library\.favouriteLabel\(f\)/.test(FAV_BLOCK.slice(FAV_BLOCK.indexOf('fav-remove'))),
  'the control is written ONCE and is NOT wrapped in `{library.favouriteLabel(f) && …}` — the ROUND AB scope is gone, so a tile saved ' +
  'from a selection (no label) now has a removal path too. The only `favouriteLabel(f)` use left in the strip is the `data-fav-label` ' +
  'readout, which is information rather than a condition.');

assert('ae3.the-tile-removes-by-id-and-not-by-label',
  /onClick=\{e => \{\s*\n\s*e\.stopPropagation\(\);\s*\n\s*removeFavourite\(f\.id\)/.test(REMOVE_BLOCK)
    && /onKeyDown=\{e => \{[\s\S]{0,240}?removeFavourite\(f\.id\)/.test(REMOVE_BLOCK)
    && !/removeFavourite\(library\.favouriteLabel/.test(REMOVE_BLOCK)
    && /data-fav-remove=\{f\.id\}/.test(REMOVE_BLOCK),
  `both the click and the Enter/Space paths call \`removeFavourite(f.id)\` (${countOf(REMOVE_BLOCK, 'removeFavourite(')} call sites), and ` +
  'nothing anywhere calls `removeFavourite(library.favouriteLabel(f))` any more — the argument is the STABLE id the tile already keys on ' +
  'and the drag payload already carries.');

assert('ae3.the-remove-control-is-a-key-operable-non-nested-control-with-a-named-label',
  /role="button"/.test(REMOVE_BLOCK) && /tabIndex=\{0\}/.test(REMOVE_BLOCK)
    && /aria-label=\{`Remove \$\{library\.favouriteName\(f\)\} from Favourites`\}/.test(REMOVE_BLOCK),
  '`role="button"` + `tabIndex={0}` with a per-item accessible name `Remove <name> from Favourites` — a `<span>`, not a nested ' +
  '`<button>`, which would be invalid inside the tile\'s own `<button>` and is the same control vocabulary `.cust-remove` uses.');

/* THE UNNAMED TILE MUST READ SENSIBLY — the name falls back through `name` →
   label → a node count, so an unnamed favourite never renders blank. EXECUTED
   above for the real payloads; asserted here so the fallback cannot be removed. */
assert('ae3.an-unnamed-favourite-still-renders-a-sensible-name',
  L.favouriteName(unnamedA) === '1 node' && L.favouriteName({id: 'x', created: 0, nodes: [{}, {}], edges: []}) === '2 nodes'
    && !L.favouriteName(unnamedA).trim().startsWith(','),
  `an unnamed single-node favourite reads "${L.favouriteName(unnamedA)}" and a two-node one reads ` +
  `"${L.favouriteName({id: 'x', created: 0, nodes: [{}, {}], edges: []})}" — the fallback chain is name → label → a node count, so the ` +
  'tile never shows an empty label and the `data-fav-label=""` marker stays a marker rather than visible text.');

const failed = results.filter(r => !r.pass);
console.log('\n' + '='.repeat(78));
console.log(`ROUND AE HARNESS: ${results.length - failed.length}/${results.length} passed`);
console.log('='.repeat(78));
for (const f of failed) console.log(`  FAIL  ${f.id}  —  ${f.detail}`);
try { rmSync(ENTRY, {force: true}); rmSync(OUT, {force: true}); } catch { /* gone */ }
console.log(`  cleaned build artefacts: ${ENTRY.replace(ROOT + '/', '')}, ${OUT.replace(ROOT + '/', '')}`);
process.exit(failed.length ? 1 : 0);
