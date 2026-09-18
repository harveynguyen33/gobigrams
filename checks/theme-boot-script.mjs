#!/usr/bin/env node
/**
 * ITEM 1 proof — EXECUTE the pre-paint script from index.html against a stub
 * document, and assert the four boot states resolve the way React's first commit
 * does. This is the runtime half of the guard: `theme-boot-sync.mjs` proves the
 * two sources agree on their inputs, this proves the script turns those inputs
 * into the right `data-theme` before anything paints.
 *
 * No browser, no DOM library — `window` / `document.documentElement` /
 * `localStorage` / `matchMedia` are stubs sized to exactly what the script uses.
 *
 *   node checks/theme-boot-script.mjs     → exit 0 green, 1 red
 */
import {readFileSync} from 'node:fs';

const html = readFileSync('/home/harvey/projects/tech-goblin/lab/diagram-studio/index.html', 'utf8');
const body = /<script>\s*([\s\S]*?)<\/script>/.exec(html)?.[1];
if (!body) { console.error('FAIL  no inline <script> found in index.html'); process.exit(1); }

/** Run the script with a given localStorage state + OS preference. */
function boot(stored, osDark) {
  const classes = new Set();
  const el = {
    dataset: {},
    classList: {toggle: (c, on) => { if (on) classes.add(c); else classes.delete(c); }},
  };
  const window = {
    localStorage: {getItem: k => (k in stored ? stored[k] : null)},
    matchMedia: () => ({matches: osDark}),
  };
  // eslint-disable-next-line no-new-func
  new Function('window', 'document', body)(window, {documentElement: el});
  return {theme: el.dataset.theme, dark: classes.has('dark')};
}

const fails = [];
const ok = (name, cond, detail = '') => {
  console.log(`${cond ? '  ok  ' : ' FAIL '} ${name}${detail ? `  — ${detail}` : ''}`);
  if (!cond) fails.push(name);
};

const KEY = 'diagram-studio:theme';
const cases = [
  // [label, stored map, OS dark, expected theme, expected .dark]
  ['never chose + OS light → the preset suggestion (dark), NOT light',
    {}, false, 'dark', true],
  ['never chose + OS dark → dark', {}, true, 'dark', true],
  ['stored light wins over the suggestion', {[KEY]: 'light'}, true, 'light', false],
  ['stored system + OS light → light (matchMedia)', {[KEY]: 'system'}, false, 'light', false],
  ['stored system + OS dark → dark (matchMedia)', {[KEY]: 'system'}, true, 'dark', true],
  ['stored midnight → dark chrome', {[KEY]: 'midnight'}, false, 'midnight', true],
  ['stored contrast → dark chrome', {[KEY]: 'contrast'}, false, 'contrast', true],
  ['stored paper → no dark chrome', {[KEY]: 'paper'}, true, 'paper', false],
  // A key that EXISTS but holds junk: `loadMode()` falls back to 'system' while
  // `hasStoredMode()` is still true (the key is present), so the preset
  // suggestion is correctly withheld and the OS preference wins. React's first
  // commit takes the same branch — agreement is the whole point here.
  ['garbage value → system, suggestion withheld, OS light wins', {[KEY]: 'neon'}, false, 'light', false],
];
for (const [label, stored, osDark, theme, dark] of cases) {
  const r = boot(stored, osDark);
  ok(label, r.theme === theme && r.dark === dark, `got theme=${r.theme} dark=${r.dark}`);
}

// A thrown localStorage (private mode) must leave the :root default alone rather
// than crash the parse of the document.
const classes = new Set();
const el = {dataset: {}, classList: {toggle: (c, on) => { if (on) classes.add(c); else classes.delete(c); }}};
const hostile = {localStorage: {getItem() { throw new Error('blocked'); }}, matchMedia: () => ({matches: false})};
try {
  new Function('window', 'document', body)(hostile, {documentElement: el});
  ok('a blocked localStorage leaves the dark default untouched', el.dataset.theme === undefined && !classes.has('dark'));
} catch (e) {
  ok('a blocked localStorage leaves the dark default untouched', false, `threw: ${e.message}`);
}

console.log(fails.length ? `\nRED — ${fails.length} failing: ${fails.join('; ')}` : '\nGREEN — the boot script resolves all boot states');
process.exit(fails.length ? 1 : 0);
