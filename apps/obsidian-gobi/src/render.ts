/* STEP-6-OBSIDIAN — the plugin's RENDER ENTRY: the ONE place ```gobi text
 * becomes HTML, built on the shared core exactly the way SPEC-GOBI-CORE §E
 * demands: compileGobi + renderGobiDocument + the committed metric table.
 * There is NO second implementation of parse/validate/layout/draw here — this
 * module only picks tokens, calls the core, and shapes the result as HTML.
 *
 * DOM-FREE by design (the Obsidian side lives in main.ts / obsidianTheme.ts),
 * so the headless corpus test can drive the BUILT main.js against the same
 * committed SVG hashes every other surface pins (§F: "a surface cannot pass
 * its own suite and fail the corpus").
 *
 * BUNDLED_GOBI_CORE is injected at build time (scripts/build.mjs --define)
 * from packages/gobi/package.json + the tree's HEAD sha — the version
 * handshake of §F. The build FAILS if that version disagrees with the
 * workspace core, so a stale bundle cannot ship. */
declare const BUNDLED_GOBI_CORE: string;
export const BUNDLED_CORE = BUNDLED_GOBI_CORE;

import {
  DEFAULT_METRICS,
  EXPORT_TOKENS,
  THEME_CSS,
  compileGobi,
  renderGobiDocument,
  tableMeasurer,
  tokensFromCss,
} from '@techgoblin/gobi-core';
import type {GobiError} from '@techgoblin/gobi-core';

/** The renderer's own refusal strings live in the bundle — grep
 * 'GobiMeasureTextInvalid' main.js to prove the core is inside (§F marker). */
export type GobiBlockResult =
  | {ok: true; svg: string}
  | {ok: false; errors: GobiError[]};

/** ```gobi text -> SVG through the ONE core path (table measurer always —
 * the "one logic" rule: the plugin never measures the live DOM). */
export function renderGobiBlock(
  text: string,
  opts: {theme: string; tokens: Record<string, string>},
): GobiBlockResult {
  const compiled = compileGobi(text);
  if (!compiled.ok) return {ok: false, errors: compiled.errors};
  const svg = renderGobiDocument(compiled.doc, {
    theme: opts.theme,
    tokens: opts.tokens,
    measureText: tableMeasurer(DEFAULT_METRICS),
  });
  return {ok: true, svg};
}

/** The gobi baseline tokens for a vault mode — the accent vocabulary (--c-*)
 * always comes from here; obsidianTheme overrides only the neutrals. With no
 * DOM (headless test), 'dark' is the baseline the corpus goldens pin. */
export function baseTokens(isDark: boolean): Record<string, string> {
  return tokensFromCss(THEME_CSS, isDark ? 'dark' : 'light', EXPORT_TOKENS);
}

/** The HTML for a rendered diagram. Plain string building so a headless test
 * (or any host) can verify the exact bytes; main.ts only assigns it. */
export function successHtml(svg: string): string {
  return `<div class="gobi-render">${svg}</div>`;
}

const esc = (s: string): string =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** The error block — ALL errors, Mermaid-style: never a silent empty box,
 * never a throw. Line/column + message + the compiler's hint when it has one. */
export function errorHtml(errors: GobiError[]): string {
  const rows = errors
    .map((e) => {
      const where = `L${e.line}:C${e.col}`;
      const hint = e.hint
        ? `\n      <span class="gobi-errors-hint">→ ${esc(e.hint)}</span>`
        : '';
      return `    <div class="gobi-errors-row">${where}  ${esc(e.message)}${hint}</div>`;
    })
    .join('\n');
  const n = errors.length === 1 ? '1 error' : `${errors.length} errors`;
  return `<div class="gobi-errors">
      <div class="gobi-errors-title">gobi — ${n}, nothing rendered</div>
${rows}
    </div>`;
}

/** The same block as plain text (tests, copy-paste, accessibility). */
export function errorText(errors: GobiError[]): string {
  return errors
    .map((e) => `L${e.line}:C${e.col}  ${e.message}${e.hint ? `\n  → ${e.hint}` : ''}`)
    .join('\n');
}
