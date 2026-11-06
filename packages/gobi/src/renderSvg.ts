/* CORE-STEP3 (task t_62cf7a90) — renderGobiDocument: the ONE .gobi -> SVG
 * drawing path (SPEC-GOBI-CORE §B / step 3).
 *
 * A PURE function of (GobiDocument, {theme, measureText, tokens, pad}):
 * no React, no DOM globals at module scope, no fs. Text measurement arrives
 * INJECTED — the browser's real DOM measurer at the app boundary, the
 * committed table measurer (src/gobi/tableMeasure.ts + metrics.json) in node
 * — and a missing or failing measurer REFUSES to run with a named error:
 * this renderer never guesses a width.
 *
 * ONE DRAWING PATH, not a second renderer: the emission is
 * src/export/exportSvg.ts's exportSvg, reached through the canvas adapter
 * (toBoardDoc) plus the HEADLESS scene stamps that used to live as private
 * copies in scripts/gobi-render.mjs and the corpus runner — moved HERE so
 * both doors delegate and no third copy can appear. The corpus pins the
 * bytes: renderGobiDocument(doc, table) === checks/fixtures/corpus/<n>.svg.
 */

import {toBoardDoc} from './model/adapterCanvas';
import {exportSvg, type ExportNode, type SvgMeasurer, type TextRect} from './model/export/exportSvg';
import type {BoardDoc} from './model/boardDoc';
import type {GobiDocument} from './gobiTypes';
import type {GobiMeasureText} from './tableMeasure';

export type RenderGobiOptions = {
  /** Theme NAME (rides the root svg's data-theme attribute). */
  theme: string;
  /** The injected measurer — required. Browser: domMeasurer().measureText;
   *  node: tableMeasurer(metrics). A guessed width is never acceptable. */
  measureText: GobiMeasureText;
  /** The theme's resolved token values. The renderer resolves NO colours
   *  itself: each surface hands in the tokens from the source it trusts
   *  (browser: src/theme.ts tokensFor; node: src/gobi/themeCss.ts
   *  tokensFromCss over src/styles.css) — one value table, no copies. */
  tokens: Record<string, string>;
  /** Padding around the content bounds. Default 24 (the corpus/CLI value). */
  pad?: number;
};

/** Wrap the injected measurer so a failure is LOUD and NAMED — the honest
 *  fallback rule (SPEC-GOBI-CORE §B): a measurer that throws or returns a
 *  non-number must surface, never silently degrade to an estimate. */
function guardedMeasureText(measureText: GobiMeasureText): GobiMeasureText {
  return (text, o) => {
    let w: number;
    try {
      w = measureText(text, o);
    } catch (e) {
      throw new Error('GobiMeasureTextFailed: the injected measureText threw for '
        + JSON.stringify(text).slice(0, 60) + ' — ' + String((e as Error)?.message ?? e)
        + '. Inject domMeasurer().measureText (browser) or tableMeasurer(metrics) (node).');
    }
    if (typeof w !== 'number' || !isFinite(w) || w < 0) {
      throw new Error('GobiMeasureTextInvalid: the injected measureText returned '
        + String(w) + ' for ' + JSON.stringify(text).slice(0, 60)
        + ' — a width must be a finite non-negative number, never a guess.');
    }
    return w;
  };
}

/* ---- the headless scene stamps (MOVED from scripts/gobi-render.mjs ————
 * the canvas's measured row model, the ONE copy; the CLI and the corpus
 * runner used to carry it each. ROUND GOBI-TEXT2: the goblin/card kind does
 * not read x/w from here (the scene derives the box from the node's own
 * width); these values serve the kinds the scene does not derive. */

const rowFont = (family: string) => ({family, size: 14.5, weight: 650, spacing: 0});
/* GOBI-TEXT-FIT — a label-only body renders no kicker row, so the row-count
 * stamps must not count one either. */
const rowParts = (data: Record<string, unknown>): number =>
  1 + (data.kicker && data.body !== 'label-only' ? 1 : 0) + (data.sub ? 1 : 0);

const headlessText = (el: unknown, tokens: Record<string, string>): TextRect | null => {
  const node = el && typeof el === 'object' ? (el as {data?: Record<string, unknown>}) : null;
  const data = (node && node.data) || {};
  const rows = rowParts(data);
  return {
    x: 14, y: 12, w: 150, h: 61 + 34 * (rows - 1),
    size: 14.5, weight: 650, fill: tokens['--fg'] || '#e8e8ea', anchor: 'start',
    rows: {kicker: rowFont(tokens['--mono'] || 'monospace'), sub: rowFont(tokens['--mono'] || 'monospace')},
  };
};

/** The compiler's own size wins; a size-less node gets the canvas heights
 * (61 + 34 per row) rather than the emitter's 180x90 default, which would
 * disagree with every row it paints. */
const stampMeasured = (n: {width?: number; height?: number; style?: {width?: number | string; height?: number | string}; data?: Record<string, unknown>}) => {
  const rows = rowParts(n.data || {});
  const w = n.width ?? (typeof n.style?.width === 'number' ? n.style.width : undefined) ?? 190;
  const h = n.height ?? (typeof n.style?.height === 'number' ? n.style.height : undefined) ?? (61 + 34 * (rows - 1));
  return {width: w, height: h};
};

/** GobiDocument -> SVG string. Deterministic: the same doc + options produce
 *  byte-identical output in node and the browser (the corpus asserts it). */
export function renderGobiDocument(doc: GobiDocument, opts: RenderGobiOptions): string {
  if (!opts || typeof opts.measureText !== 'function') {
    throw new Error('GobiMeasurerMissing: renderGobiDocument requires an injected measureText '
      + '(SPEC-GOBI-CORE §B) — pass domMeasurer().measureText at a browser boundary or '
      + 'tableMeasurer(metrics) in node. A guessed width is never acceptable.');
  }
  if (typeof opts.theme !== 'string' || !opts.tokens) {
    throw new Error('GobiThemeMissing: renderGobiDocument requires the theme name and its '
      + 'resolved tokens (tokensFor in the browser, tokensFromCss in node).');
  }
  const measureText = guardedMeasureText(opts.measureText);
  const board: BoardDoc = toBoardDoc(doc);
  const measurer: SvgMeasurer = {
    text: (el) => headlessText(el, opts.tokens),
    edgePath: () => null,
    measureText,
  };
  const nodes = (board.nodes as unknown as ExportNode[]).map((n) => ({
    ...n,
    measured: stampMeasured(n as never),
  }));
  return exportSvg({
    nodes,
    edges: board.edges as never,
    theme: opts.theme,
    tokens: opts.tokens,
    measurer,
    pad: opts.pad ?? 24,
  });
}
