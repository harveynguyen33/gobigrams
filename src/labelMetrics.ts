/* ROUND GOBI-LAYOUT — the ONE label-width metric for LAYOUT-time room
 * reservation, in a leaf module that imports NOTHING.
 *
 * WHY THIS EXISTS. Harvey's complaint on a real .gobi render — the edge labels
 * sat ON the node boxes. The layout must reserve room for the widest label
 * crossing each cut, which needs a text WIDTH estimate in a pure module the
 * layout engine can import without cycles (exportSvg's estimateTextWidth is
 * not exported AND lives in a LAZY chunk — importing it from the main-chunk
 * layout would drag the export pipeline onto the boot path: exportSvg-*.js is
 * its own lazy chunk in dist/, measured).
 *
 * THE NUMBER IS NOT INVENTED — it is the export door's own shipped formula,
 * lifted verbatim (exportSvg.ts emitContentInto): a label row measures
 * `length * 6.6 + 12` px, floored at 24. That is 11px mono at the stub's
 * 0.6em advance width (11 * 0.6 = 6.6) plus the label plate's 2 * 6px
 * horizontal padding. M1 in checks/round-gobi-layout.mjs pins the agreement
 * on real labels, and exportSvg.ts now CALLS this helper at its emit site so
 * the two cannot drift apart again.
 *
 * It deliberately OVER-estimates nothing and UNDER-estimates nothing: the
 * same estimate the renderer paints with is the one the layout reserves by. */

/** Estimated width of an edge label's plate in px: `length * 6.6 + 12`,
 *  floored at 24 — the export door's own formula (see the header). */
export function estimateEdgeLabelWidth(text: string): number {
  return Math.max(24, text.length * 6.6 + 12);
}
