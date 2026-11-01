/* ROUND GOBI-TEXT3 — the DOM-less export's VERTICAL placement of a node's
 * text block.
 *
 * WHY THIS MODULE. The canvas centres a text block with `justify-content`
 * (`.node-body { justify-content: var(--ts-align-items, flex-start) }`), which
 * needs a layout engine. The headless door has none: it holds the node's box
 * and the baked baselines, so the block's position has to be ARITHMETIC. The
 * language now defaults to `valign:middle` (src/gobi/gobiText.ts) and stores it
 * on the node as `data.textStyle.vAlign`; the app reads that same stored value
 * through `textStyleVars`, so the canvas and the PNG agree by construction
 * rather than by two defaults that happen to look alike.
 *
 * THE METRIC is the PAINTED SPAN of a row, [baseline − ascent, baseline + (size
 * − ascent)]: the ascent is the caller's (measured on the canvas; the 0.78em
 * floor when nothing can measure), and the descent completes the em. It is
 * deliberately NOT a line box: the harness measures the same span off the
 * emitted `<text>` elements, so a line-height constant could not pass by luck,
 * and a rounded box would hide a one-pixel drift.
 *
 * `top` is a no-op — the block keeps the place the emitter already gave it, so
 * a node with no stored vAlign exports byte-identically. `bottom` parks the
 * block `BODY_PAD_Y` above the box's bottom edge: the vertical twin of the 18px
 * `.node-body` inset (BODY_PAD_X in exportScene), so a bottom-aligned block
 * does not sit ON the border.
 *
 * A LEAF MODULE on purpose: it declares its own structural row shape instead of
 * importing `SceneTextRow`, so there is no cycle with the scene builder and a
 * harness can execute it on three-number objects. */

export const BODY_PAD_Y = 18;

export type VRow = {baselineY: number; size: number; weight?: number; family?: string};
export type AscentOf = (o: {size: number; weight: number; family?: string}) => number;

/** The painted span of a row set, in the emitter's own coordinates. */
export function rowsExtent(rows: VRow[], ascentOf: AscentOf): {top: number; bottom: number} {
  let top = Infinity, bottom = -Infinity;
  for (const r of rows) {
    const a = ascentOf({size: r.size, weight: r.weight ?? 400, family: r.family});
    top = Math.min(top, r.baselineY - a);
    bottom = Math.max(bottom, r.baselineY + (r.size - a));
  }
  return {top, bottom};
}

/** Shift a row set to the stored vertical alignment inside `boxH`. Unknown
 *  values fall back to `middle`, the value the language writes. */
export function vAlignRows<T extends VRow>(
  rows: T[], boxH: number, valign: string | undefined, ascentOf: AscentOf,
): T[] {
  if (!rows.length || !(boxH > 0)) return rows;
  if (valign === 'top') return rows;
  const {top, bottom} = rowsExtent(rows, ascentOf);
  const h = bottom - top;
  const target = valign === 'bottom' ? boxH - BODY_PAD_Y - h : (boxH - h) / 2;
  const delta = target - top;
  return delta ? rows.map((r) => ({...r, baselineY: r.baselineY + delta})) : rows;
}
