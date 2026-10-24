#!/usr/bin/env node
/**
 * ITEM 1 guard — the pre-paint theme script in `index.html`'s <head> duplicates
 * three facts that live in TypeScript, because a <head> script cannot import
 * them:
 *
 *   1. the localStorage KEY                (src/theme.ts   MODE_KEY)
 *   2. the set of DARK theme ids           (src/theme.ts   isDarkTheme)
 *   3. the DEFAULT preset's suggestion     (src/presets.ts PRESETS[DEFAULT_PRESET_ID])
 *
 * A rename on either side would silently desync the document's pre-paint theme
 * from React's first commit — the exact flicker this pass removes. This harness
 * reads BOTH sides and fails on any drift. No browser, no DOM: pure source text.
 *
 *   node checks/theme-boot-sync.mjs     → exit 0 green, 1 red
 */
import {readFileSync} from 'node:fs';

const ROOT = '/home/harvey/projects/tech-goblin/lab/diagram-studio';
const html = readFileSync(`${ROOT}/index.html`, 'utf8');
const theme = readFileSync(`${ROOT}/src/theme.ts`, 'utf8');
const presets = readFileSync(`${ROOT}/src/presets.ts`, 'utf8');
const app = readFileSync(`${ROOT}/src/App.tsx`, 'utf8');

const fails = [];
const ok = (name, cond, detail = '') => {
  console.log(`${cond ? '  ok  ' : ' FAIL '} ${name}${detail ? `  — ${detail}` : ''}`);
  if (!cond) fails.push(name);
};

/* ---- 1. the key ---------------------------------------------------------- */
const keyInTs = /export const MODE_KEY = '([^']+)'/.exec(theme)?.[1];
const keyInHtml = /var KEY = '([^']+)'/.exec(html)?.[1];
ok('MODE_KEY exists in src/theme.ts', !!keyInTs, keyInTs);
ok('boot script declares the same key', !!keyInHtml && keyInHtml === keyInTs,
  `index.html=${keyInHtml} theme.ts=${keyInTs}`);

/* ---- 2. the dark list ---------------------------------------------------- */
// isDarkTheme is a boolean expression over string literals: t === 'dark' || …
const darkInTs = [.../export const isDarkTheme[\s\S]{0,200}?;/.exec(theme)?.[0]
  .matchAll(/t === '([^']+)'/g)].map(m => m[1]).sort();
const darkInHtml = (/var DARK = \[([^\]]*)\]/.exec(html)?.[1] ?? '')
  .split(',').map(s => s.trim().replace(/^'|'$/g, '')).filter(Boolean).sort();
ok('isDarkTheme ids parse from theme.ts', darkInTs.length > 0, darkInTs.join(','));
ok('boot script DARK list matches isDarkTheme',
  darkInTs.length > 0 && darkInTs.join(',') === darkInHtml.join(','),
  `theme.ts=[${darkInTs}] index.html=[${darkInHtml}]`);

/* ---- 3. the default suggestion ------------------------------------------- */
const defaultPresetId = /export const DEFAULT_PRESET_ID: PresetId = '([^']+)'/.exec(presets)?.[1];
ok('DEFAULT_PRESET_ID exists', !!defaultPresetId, defaultPresetId);
const presetBlock = new RegExp(`id: '${defaultPresetId}'[\\s\\S]*?theme: \\{suggested: '([^']+)'`).exec(presets);
const suggestInTs = presetBlock?.[1];
const suggestInHtml = /var DEFAULT_SUGGEST = '([^']+|null)'/.exec(html)?.[1];
ok('default preset declares a suggestion', !!suggestInTs, suggestInTs);
ok('boot script DEFAULT_SUGGEST matches it',
  suggestInHtml === suggestInTs, `presets.ts=${suggestInTs} index.html=${suggestInHtml}`);

/* ---- 4. the suggestion is honoured in the SAME default order ------------- */
// theme.ts boots a concrete stored mode first; the suggestion only lands for a
// user who never chose. Assert that ordering exists in the script.
ok('boot script prefers a stored concrete mode over the suggestion',
  /if \(stored !== 'system'\)[\s\S]*?\} else if \(!hasStored && DEFAULT_SUGGEST\)/.test(html));

/* ---- 5. React's first commit agrees ------------------------------------- */
ok('App resolves its initial theme with the same bootTheme()',
  /useState<ThemeName>\(\(\) => bootTheme\(hasStoredMode\(\)\)\)/.test(app));
ok('App seeds suggestedTheme from the DEFAULT preset (not null)',
  /useState<ThemeName \| null>\(\s*\(\) => hasStoredMode\(\) \? null : \(getPreset\(DEFAULT_PRESET_ID\)/.test(app));
ok('App starts on DEFAULT_PRESET_ID',
  /const \[presetId, setPresetId\] = useState<PresetId>\(DEFAULT_PRESET_ID\)/.test(app));

/* ---- 6. the script is INSIDE <head>, before anything paints -------------- */
const headEnd = html.indexOf('</head>');
const scriptAt = html.indexOf('var KEY =');
ok('boot script sits inside <head>', scriptAt > 0 && headEnd > scriptAt);

console.log(fails.length ? `\nRED — ${fails.length} failing: ${fails.join('; ')}` : '\nGREEN — boot theme mirror is in sync');
process.exit(fails.length ? 1 : 0);
