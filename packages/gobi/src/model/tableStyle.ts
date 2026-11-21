/* BOARD-STYLE (task t_e13e056b) — the ONE vocabulary for the table node's
 * visual style + density. Pure data + guards: no React, no DOM, and NOTHING
 * here reaches the `.gobi` text language (the board document carries the two
 * fields; compileGobi never reads them — checks/unisurf-board-style B6).
 *
 * Style is PER-BOARD (Harvey, 2026-11-09), defaults `sheet` + `comfy`. A style
 * changes ONLY: border-radius, how constraints are drawn, row insets, header
 * rail, rule style, letter-case. Density is the ONLY place spacing lives. */

export const TABLE_STYLES = ['sheet', 'ledger', 'blueprint'] as const;
export type TableStyle = (typeof TABLE_STYLES)[number];

export const DENSITIES = ['compact', 'comfy', 'airy'] as const;
export type Density = (typeof DENSITIES)[number];

export const DEFAULT_TABLE_STYLE: TableStyle = 'sheet';
export const DEFAULT_DENSITY: Density = 'comfy';

/** The words the three doors print. One source: the inspector, the Boards menu
 *  and Settings all read THIS map (a second copy would drift). */
export const TABLE_STYLE_LABELS: Record<TableStyle, string> =
  {sheet: 'Sheet', ledger: 'Ledger', blueprint: 'Blueprint'};
export const DENSITY_LABELS: Record<Density, string> =
  {compact: 'Compact', comfy: 'Comfy', airy: 'Airy'};

/** Absent (or a value this build does not know) → the app default. A board
 *  authored before BOARD-STYLE carries neither field, so nothing migrates. */
export const resolveTableStyle = (v: unknown): TableStyle =>
  (TABLE_STYLES as readonly unknown[]).includes(v) ? (v as TableStyle) : DEFAULT_TABLE_STYLE;

export const resolveDensity = (v: unknown): Density =>
  (DENSITIES as readonly unknown[]).includes(v) ? (v as Density) : DEFAULT_DENSITY;

/* ---------------------------------------------------------------------------
   TABLE-SCALE (task t_cdd8e4f6, 2026-11-10) — a PER-TABLE scale on top of the
   board's density: `1` = the density as-is, 0.75 - 1.5 in 0.05 steps. It lives
   on the NODE (`data.scale`), not on the board, so one "hero" table can sit
   beside three small ones. It multiplies that table's font sizes, row height,
   side padding and column gaps — nothing structural.
   SURFACE-NEUTRAL like style/density: the `.gobi` text language has no scale
   token (the document carries it, the text does not — unisurf-board-style P5).
   NO UPPER BOUND (TABLE-SCALE-NOMAX, t_7f37db5b — Harvey, 2026-11-09: "can we
   remove scale limit,. Min is ok but should not restrict max"). The ladder had
   a 1.5 ceiling and refused anything above it SILENTLY (an authored 2.0 read
   back as 1.0); the ceiling constant is DELETED, not raised. Only the 0.75
   FLOOR remains — below it the value is still invalid and reads 100%.
--------------------------------------------------------------------------- */
export const TABLE_SCALE_MIN = 0.75;
export const TABLE_SCALE_STEP = 0.05;

/** Absent / not a number / BELOW THE FLOOR → 1 (the board's density untouched:
 *  a table authored before this card reads 100%). Any finite number at or above
 *  the floor is a real value — there is no ceiling, so 2, 3 and 8 all survive a
 *  save/reload byte-identical. A valid number is snapped to the 0.05 ladder so
 *  the card's CSS and the core's width model cannot disagree about the value by
 *  a float hair — the snap is done in whole PERCENT and then divided once,
 *  because `Math.round(n/0.05)*0.05` returns 0.8500000000000001 for 0.85
 *  (measured). */
export const resolveTableScale = (v: unknown): number => {
  if (typeof v !== 'number' || !isFinite(v) || v < TABLE_SCALE_MIN) return 1;
  const stepPct = Math.round(TABLE_SCALE_STEP * 100);
  return Math.round(Math.round(v * 100) / stepPct) * stepPct / 100;
};
