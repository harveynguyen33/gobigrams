/* CORE-STEP3 (task t_62cf7a90) — the CSS-text theme resolver, the ONE home of
 * the styles.css token parse. Before this round the same parser lived as two
 * private copies (scripts/gobi-render.mjs and checks/round-gobi-core-decouple.mjs);
 * both now import it from here, so a third copy can never appear.
 *
 * PURE: a function of (css text, theme name, wanted tokens) — no DOM, no fs.
 * The browser side resolves the same tokens through document.styleSheets
 * (src/theme.ts tokensFor); this parser is the NODE side's twin for consumers
 * that cannot mount a stylesheet (the CLI, the corpus runner, a future MCP
 * server). The corpus pins that the two agree by rendering the same fixtures
 * with tokens parsed HERE in both node and browser checks.
 */

/* CORE-API-GAP (task t_b7bb0ff1) — the vocabulary this resolver asks for is the
 * package's export, so a caller never has to restate (or hunt for) the list.
 * themeCss → model/theme is a leaf import: model/theme declares no DOM work at
 * module scope, so this stays node-safe (PURE module rule above). */
import {EXPORT_TOKENS} from './model/theme';

/** The theme blocks of styles.css, in source order: [{name, body}]. `:root`
 *  rides with the dark block (`:root, [data-theme="dark"] {…}`). */
export function themeBlocks(css: string): {name: string; body: string}[] {
  const blocks: {name: string; body: string}[] = [];
  let i = 0;
  while (i < css.length) {
    const open = css.indexOf('{', i);
    if (open < 0) break;
    const selector = css.slice(i, open);
    let depth = 0, end = -1;
    for (let j = open; j < css.length; j++) {
      if (css[j] === '{') depth++;
      else if (css[j] === '}' && --depth === 0) { end = j; break; }
    }
    if (end < 0) break;
    const m = /data-theme\s*=\s*["']([a-z]+)["']/.exec(selector);
    if (m || /(^|,)\s*:root\s*(,|$)/.test(selector)) {
      blocks.push({name: m ? m[1]! : 'dark', body: css.slice(open + 1, end)});
    }
    i = end + 1;
  }
  return blocks;
}

function declarations(body: string): Record<string, string> {
  const out: Record<string, string> = {};
  /* comments FIRST: this stylesheet documents tokens inline, and a comment
     containing ':' or ';' swallows the declaration that follows it. */
  const clean = body.replace(/\/\*[\s\S]*?\*\//g, '');
  for (const piece of clean.split(';')) {
    const at = piece.indexOf(':');
    if (at < 0) continue;
    const key = piece.slice(0, at).trim();
    if (key.startsWith('--')) out[key] = piece.slice(at + 1).trim();
  }
  return out;
}

/** The resolved token map for one theme: dark (the `:root` baseline), then the
 *  theme's own overrides, then passes of `var(--x)` substitution inside the
 *  values (this repo has eg. `--acc-soft: color-mix(in srgb, var(--acc) 10%,
 *  transparent)`). `--mono`/`--sans` ride along for the headless row model.
 *
 *  CORE-API-GAP (task t_b7bb0ff1) — `wanted` DEFAULTS to the package's own
 *  EXPORT_TOKENS, and a wanted name the sheet does not declare is a NAMED
 *  failure (GobiThemeTokenMissing), never a silently unresolved `var()` in the
 *  output. A partial stylesheet therefore reads as an error, not as a
 *  washed-out SVG. */
export function tokensFromCss(css: string, name: string, wanted: readonly string[] = EXPORT_TOKENS): Record<string, string> {
  const blocks = themeBlocks(css);
  const names = [...new Set([...wanted, '--mono', '--sans'])];
  const map: Record<string, string> = {};
  const dark = blocks.find((b) => b.name === 'dark');
  const own = blocks.filter((b) => b.name === name && b !== dark);
  for (const b of [...(dark ? [dark] : []), ...own]) {
    const d = declarations(b.body);
    for (const k of names) if (k in d) map[k] = d[k]!;
  }
  for (let pass = 0; pass < 3; pass++) {
    let changed = false;
    for (const k of Object.keys(map)) {
      const next = map[k]!.replace(/var\(\s*(--[\w-]+)\s*(?:,[^)]*)?\)/g, (m, ref) => (ref in map ? map[ref]! : m));
      if (next !== map[k]) { map[k] = next; changed = true; }
    }
    if (!changed) break;
  }
  const absent = wanted.filter((k) => !(k in map));
  if (absent.length) {
    throw new Error('GobiThemeTokenMissing: ' + absent.join(', ')
      + ' — the sheet passed to tokensFromCss declares no value for '
      + (absent.length === 1 ? 'this token' : 'these tokens') + ' in theme ' + JSON.stringify(name)
      + '. Pass the theme sheet that goes with the vocabulary (THEME_CSS from this package, or your own copy of the app stylesheet).');
  }
  return map;
}
