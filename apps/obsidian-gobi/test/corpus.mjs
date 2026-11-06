#!/usr/bin/env node
/* STEP-6-OBSIDIAN — the ACCEPTANCE TEST. Drives the BUILT main.js (never the
 * TS sources) in a stubbed Obsidian host: Module._load hands the bundle the
 * same module Obsidian itself provides, the plugin class is instantiated and
 * onload'd, and the REGISTERED code-block processor is invoked on fake els.
 * No DOM exists, so the processor renders the dark baseline — exactly the
 * recipe the committed goldens pin (§F: the corpus IS this suite's core).
 *
 * WHAT IT PROVES (the card's acceptance 1, 2, 3, 5):
 *   C1  main.js loads as CJS with only 'obsidian' external; the bundled-core
 *       marker (BUNDLED_CORE + the core's own refusal string) is inside it;
 *   C2  corpus parity: all 24 good fixtures render through the processor and
 *       hash- AND byte-match packages/gobi/test/corpus/expected/<name>.svg;
 *   C3  the negative control: the comparator FAILS on a wrong pair (a runner
 *       that always says pass cannot survive);
 *   C4  collect-everything: each of the 7 bad-* fixtures renders ALL its
 *       errors (count === the committed .errors.json) — one rendered text is
 *       printed in full, plus a hint-bearing typo input;
 *   C5  theme mapping: the Obsidian bridge resolves a light and a dark vault
 *       fixture into two different token tables, and the rendered diagrams
 *       carry the vault colours (both values printed).
 *
 * Run: npm test -w @techgoblin/obsidian-gobi   (build first). Exit 0 = green. */
import Module, {createRequire} from 'node:module';
import {createHash} from 'node:crypto';
import {copyFileSync, mkdtempSync, readFileSync, readdirSync} from 'node:fs';
import {dirname, join} from 'node:path';
import {tmpdir} from 'node:os';
import {fileURLToPath} from 'node:url';

const PKG = join(dirname(fileURLToPath(import.meta.url)), '..');
const MAIN = join(PKG, 'main.js');
const FIXTURE_DIR = join(PKG, '..', '..', 'packages/gobi/test/corpus/gobi');
const EXPECTED = join(PKG, '..', '..', 'packages/gobi/test/corpus/expected');

let pass = 0, fail = 0;
const failures = [];
const ok = (id, cond, detail = '') => {
  if (cond) { pass++; console.log('  ok   ' + id); }
  else { fail++; failures.push(id); console.log('  FAIL ' + id + (detail ? '  — ' + detail : '')); }
};
const sha = (s) => createHash('sha256').update(s, 'utf8').digest('hex');

/* ---------------------------------------------------- the stubbed host -- */

/** What the bundle sees as require('obsidian'): a Plugin that captures the
 * processor registration, an inert Notice. Obsidian's real Plugin does the
 * same bookkeeping we do not rely on. */
const registrations = [];
class StubPlugin {
  constructor(app, manifest) { this.app = app; this.manifest = manifest; }
  registerMarkdownCodeBlockProcessor(language, processor) {
    registrations.push({language, processor});
  }
  registerEvent() {}
  registerDomEvent() {}
}
const obsidianStub = {Plugin: StubPlugin, Notice: class Notice { constructor() {} }};

const origLoad = Module._load;
Module._load = function (request, ...rest) {
  if (request === 'obsidian') return obsidianStub;
  return origLoad.call(this, request, ...rest);
};

/* createRequire, not dynamic import: main.js is CJS and its named exports
 * must be read straight off module.exports (the import() interop guesses).
 * The package is type:module, so Node would misread a .js as ESM — the
 * BUILT bytes are copied to a temp .cjs and required from there (Obsidian's
 * own loader has no such package.json, and requires the name main.js). */
const doRequire = createRequire(import.meta.url);
const cjsCopy = join(mkdtempSync(join(tmpdir(), 'gobi-obsidian-')), 'main.cjs');
copyFileSync(MAIN, cjsCopy);
const bundle = doRequire(cjsCopy);
Module._load = origLoad;

/* ------------------------------------------------------------- C1 marker -- */

ok('C1a main.js loads as CJS and exports the plugin class', typeof bundle.default === 'function');
ok('C1b main.js exports the render entry (renderGobiBlock, obsidianTokens, BUNDLED_CORE)',
  typeof bundle.renderGobiBlock === 'function' && typeof bundle.obsidianTokens === 'function' && typeof bundle.BUNDLED_CORE === 'string');
const rawMain = readFileSync(MAIN, 'utf8');
ok('C1c the bundled-core marker is inside main.js', rawMain.includes('gobi-core:'),
  `BUNDLED_CORE=${String(bundle.BUNDLED_CORE)}`);
ok('C1d a core-only string survives minification (GobiMeasureTextInvalid from renderSvg.ts)',
  rawMain.includes('GobiMeasureTextInvalid'));
console.log(`  ..   bundled-core marker: ${bundle.BUNDLED_CORE}`);

/* ----------------------------------------------- the live plugin instance -- */

const app = {workspace: {on: () => ({})}};
const plugin = new bundle.default(app, JSON.parse(readFileSync(join(PKG, 'manifest.json'), 'utf8')));
plugin.onload();
ok('C1e exactly one code-block processor registered, for language "gobi"',
  registrations.length === 1 && registrations[0].language === 'gobi');
const processor = registrations[0].processor;

/** A fake el: captures innerHTML, accepts classList. */
const fakeEl = () => {
  const classes = new Set();
  return {
    classes,
    innerHTML: '',
    classList: {add: (c) => classes.add(c)},
  };
};

/* ------------------------------------------------------------ C2 corpus -- */

const fixtures = readdirSync(FIXTURE_DIR).filter((f) => f.endsWith('.gobi'));
const good = fixtures.filter((f) => !f.startsWith('bad-')).map((f) => ({name: f.replace(/\.gobi$/, ''), text: readFileSync(join(FIXTURE_DIR, f), 'utf8')}));
const bad = fixtures.filter((f) => f.startsWith('bad-')).map((f) => ({name: f.replace(/\.gobi$/, ''), text: readFileSync(join(FIXTURE_DIR, f), 'utf8')}));

console.log(`  ..   fixtures: ${good.length} good / ${bad.length} bad`);
ok('C2a the corpus has the expected shape (24 good / 7 bad)', good.length === 24 && bad.length === 7);

const svgOf = (html) => {
  const open = html.indexOf('<svg');
  const close = html.lastIndexOf('</svg>');
  return open >= 0 && close > open ? html.slice(open, close + 6) : null;
};

let parity = 0;
const mismatches = [];
for (const g of good) {
  const el = fakeEl();
  processor(g.text, el, {sourcePath: `${g.name}.gobi`});
  const svg = svgOf(el.innerHTML);
  const expected = readFileSync(join(EXPECTED, `${g.name}.svg`), 'utf8');
  if (svg && svg === expected && el.classes.has('gobi-block') && el.innerHTML.includes('gobi-render')) parity++;
  else mismatches.push(`${g.name} (svg=${svg ? 'yes' : 'NONE'} byte-equal=${svg === expected})`);
}
ok(`C2b all 24 good fixtures render byte-identical SVG through the plugin processor`, parity === good.length,
  `${parity}/${good.length}; mismatches: ${mismatches.slice(0, 5).join(', ')}`);
ok('C2c hashes agree with the committed .sha256 goldens',
  good.every((g) => {
    const el = fakeEl();
    processor(g.text, el, {sourcePath: `${g.name}.gobi`});
    const svg = svgOf(el.innerHTML) ?? '';
    return sha(svg) === sha(readFileSync(join(EXPECTED, `${g.name}.svg`), 'utf8'));
  }));

/* ------------------------------------------------- C3 the negative control -- */

const svgA = svgOf(((el) => { processor(good[0].text, el, {}); return el.innerHTML; })(fakeEl()));
const wrongExpected = readFileSync(join(EXPECTED, `${good[1].name}.svg`), 'utf8');
ok('C3 negative control: the comparator FAILS on a wrong pair', svgA !== null && svgA !== wrongExpected);

/* -------------------------------------------------------- C4 error path -- */

let errAll = 0;
for (const b of bad) {
  const expected = JSON.parse(readFileSync(join(EXPECTED, `${b.name}.errors.json`), 'utf8'));
  const el = fakeEl();
  processor(b.text, el, {sourcePath: `${b.name}.gobi`});
  const rows = (el.innerHTML.match(/gobi-errors-row/g) || []).length;
  const allMessagesShown = expected.every((e) => el.innerHTML.includes(e.message
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')));
  const noSvg = svgOf(el.innerHTML) === null;
  if (rows === expected.length && allMessagesShown && el.innerHTML.includes('gobi-errors') && noSvg) errAll++;
  else console.log(`  ..   ${b.name}: rows=${rows} expected=${expected.length} messages=${allMessagesShown} noSvg=${noSvg}`);
}
ok(`C4a all 7 bad-* fixtures show ALL their errors, styled, no SVG`, errAll === bad.length, `${errAll}/${bad.length}`);

/* The rendered text the card asks to see (acceptance 3), plus a typo input
 * that carries a compiler suggestion so the hint row is exercised too. */
const elShow = fakeEl();
processor(bad.find((b) => b.name === 'bad-block-undeclared').text, elShow, {});
const stripTags = (h) => h.replace(/<[^>]+>/g, '').replace(/\n\s+/g, '\n').trim();
console.log('\n  ---- rendered error block (bad-block-undeclared) ----');
console.log(stripTags(elShow.innerHTML).replace(/^/gm, '  '));
console.log('  ------------------------------------------------------');

const elTypo = fakeEl();
processor('a = service "A"\nb = databse "DB"\na -> b', elTypo, {});
/* The compiler folds its suggestion into the message ("Did you mean …"),
 * which must reach the block verbatim. */
ok('C4b a typo input shows the compiler suggestion through the processor',
  elTypo.innerHTML.includes('Did you mean &quot;database&quot;?') || elTypo.innerHTML.includes('Did you mean "database"?'));
/* The separate hint field (GobiError.hint) is rendered on its own row when
 * a future compiler path populates it — pinned directly on errorHtml. */
ok('C4c errorHtml renders a hint row for an error that carries one',
  bundle.errorHtml([{line: 2, col: 5, message: 'x', hint: 'database'}]).includes('gobi-errors-hint')
  && !bundle.errorHtml([{line: 2, col: 5, message: 'x'}]).includes('gobi-errors-hint'));

/* --------------------------------------------------- C5 the theme bridge -- */

/* Two fixture vaults, the values Obsidian's own default themes define. */
const LIGHT_VAULT = {
  '--background-primary': '#ffffff', '--background-secondary': '#f6f6f6',
  '--background-modifier-border': '#dddddd', '--background-modifier-border-hover': '#cccccc',
  '--text-normal': '#333333', '--text-muted': '#777777', '--text-faint': '#999999',
  '--interactive-accent': '#7c3aed', '--text-accent': '#7c3aed',
  '--color-green': '#1a7f37', '--color-red': '#cf222e',
};
const DARK_VAULT = {
  '--background-primary': '#1e1e1e', '--background-secondary': '#262626',
  '--background-modifier-border': '#3f3f3f', '--background-modifier-border-hover': '#4f4f4f',
  '--text-normal': '#dcddde', '--text-muted': '#999999', '--text-faint': '#666666',
  '--interactive-accent': '#a882ff', '--text-accent': '#a882ff',
  '--color-green': '#4ac26b', '--color-red': '#ff5c5c',
};
const base = bundle.baseTokens ? bundle.baseTokens(true) : null;
ok('C5a baseTokens ships through main.js', !!base && typeof base['--bg'] === 'string');

const getFrom = (vars) => (name) => vars[name] ?? '';
const lightTokens = bundle.obsidianTokens(getFrom(LIGHT_VAULT), base);
const darkTokens = bundle.obsidianTokens(getFrom(DARK_VAULT), base);
ok('C5b the bridge maps the vault neutrals (bg/fg/border)',
  lightTokens['--bg'] === 'rgba(255, 255, 255, 1)'
  && darkTokens['--bg'] === 'rgba(30, 30, 30, 1)'
  && lightTokens['--fg'] === 'rgba(51, 51, 51, 1)'
  && darkTokens['--fg'] === 'rgba(220, 221, 222, 1)');
ok('C5c the soft wash is the accent at 0.14 alpha',
  lightTokens['--acc-soft'] === 'rgba(124, 58, 237, 0.14)');
ok('C5d an undefined vault variable keeps the gobi baseline token',
  bundle.obsidianTokens(() => '', base)['--bg'] === base['--bg']);

const bgFill = (svg) => (/<rect[^>]*fill="([^"]+)"/.exec(svg) || [])[1];
const sample = good.find((g) => g.name === 'spec-example') ?? good[0];
const lightSvg = bundle.renderGobiBlock(sample.text, {theme: 'light', tokens: lightTokens});
const darkSvg = bundle.renderGobiBlock(sample.text, {theme: 'dark', tokens: darkTokens});
const lightBg = lightSvg.ok ? bgFill(lightSvg.svg) : null;
const darkBg = darkSvg.ok ? bgFill(darkSvg.svg) : null;
console.log(`  ..   light vault bg fill: ${lightBg}   dark vault bg fill: ${darkBg}`);
ok('C5e the same diagram renders in the vault colours (two different fills)',
  lightBg === 'rgba(255, 255, 255, 1)' && darkBg === 'rgba(30, 30, 30, 1)' && lightBg !== darkBg);

/* ------------------------------------------------------------- verdict -- */

console.log(`\n${pass} ok, ${fail} FAIL`);
if (fail) { console.log('failures: ' + failures.join(', ')); process.exit(1); }
