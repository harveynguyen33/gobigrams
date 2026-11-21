/* LAYOUT-FOLLOWS-WIDTH (task t_c50332ff, 2026-11-09) — THE table width, in the
 * core. One function, three readers: the .gobi layout (placement), the canvas
 * adapter (the document's own node width) and the app's live refinement
 * (src/hooks/useTableWidth.ts). Before this, width was a RENDER-TIME fact —
 * a hook measured the DOM after the layout had already placed the cards 250px
 * apart, so a widened card overlapped its neighbour (measured: 96px).
 *
 * THE MODEL, measured from the live DOM (chromium, 1600x1000, the app's own
 * fonts) — every constant below was READ OFF a real card, never estimated:
 *   width = 2 (card border) + 2*rowInset + 2*padX
 *         + flagsTrack + gap + nameTrack + gap + typeTrack + gap + door
 * The three tracks are the SAME shared maxima the card's CSS lays out:
 *   flagsTrack = the widest row's constraint gutter (PK/FK/UQ/NN marks);
 *   nameTrack  = the widest column NAME (a mono field-sizing input);
 *   typeTrack  = the widest TYPE (Inter, right-aligned in a 52px floor);
 *   door       = the FK arrow: a 24px hit box with -7px margins = 10px of row.
 *
 * WHY A MODEL AND NOT tableMeasurer(DEFAULT_METRICS): that table is committed
 * for the 14.5px SVG baseline and carries no 8-13px row strings, so every call
 * would fall through to the 0.6em estimate AND COUNT a fallback — the corpus
 * asserts that count is 0. The mono advance below is the same measurement in a
 * cheaper form: the widest advance the `--mono` STACK can paint, taken from the
 * live DOM (see MONO_ADVANCE_RATIO — the font's 0.600em metric, the hinted
 * whole-pixel advance Chromium uses at these sizes, and the fallback face's
 * 0.602em, because a machine without the web font still renders the card).
 * The Inter type run is not monospace, so its factor carries a margin (0.60
 * lower / 0.72 UPPER) — the card is a few pixels wider than its ink, never
 * narrower, which is the direction that cannot clip.
 *
 * PURE: no DOM, no clock, no React. Same input -> same number (W3). The table's
 * COLLAPSE / show-mode is render-only, so the width of the document's table is
 * computed over every column it carries.
 */
import {resolveDensity, resolveTableScale, resolveTableStyle, type Density, type TableStyle} from './tableStyle';

/** The row's own spacing scale, verbatim from src/styles.css's per-density
 *  blocks (`.canvas-wrap[data-density=...] .tnode`). One copy per surface is a
 *  drift risk, so checks/unisurf-board-style W0 pins these to the CSS.
 *  TABLE-HEIGHT (t_5fa4dbb0) added `row` — the card's `--rH` — because the
 *  card's HEIGHT is now a core fact too (tableNaturalHeight below): the layout
 *  must reserve the rows it can see, not the 170px palette box. */
export const TABLE_METRICS: Record<Density, {
  row: number; padX: number; gap: number; name: number; type: number; chip: number; chipGap: number;
}> = {
  compact: {row: 22, padX: 8, gap: 8, name: 11, type: 9.5, chip: 8, chipGap: 4},
  comfy: {row: 28, padX: 12, gap: 14, name: 12, type: 10.5, chip: 8.5, chipGap: 6},
  airy: {row: 34, padX: 16, gap: 20, name: 13, type: 11.5, chip: 9.5, chipGap: 8},
};

/** The style's chrome, measured from the same DOM. A style may only change
 *  decoration — the row inset (ledger insets its rows 6px), the constraint
 *  mark's padding+border (ledger's bordered chips), the bracket pair (blueprint
 *  paints `[PQ]`) and the type run's tracking/case (blueprint uppercases it). */
export const TABLE_CHROME: Record<TableStyle, {
  rowInset: number; flagPad: number; flagBrackets: number; flagSize: number; flagTrack: number;
  upperType: boolean;
}> = {
  sheet: {rowInset: 0, flagPad: 0, flagBrackets: 0, flagSize: 0, flagTrack: 0.04, upperType: false},
  ledger: {rowInset: 6, flagPad: 12, flagBrackets: 0, flagSize: 0, flagTrack: 0.04, upperType: false},
  blueprint: {rowInset: 0, flagPad: 0, flagBrackets: 2, flagSize: 0.5, flagTrack: 0.02, upperType: true},
};

/** The minimum the width reads: anything with columns (GobiDocNode, FlowNode
 *  data, a TableKind). Structural so no caller has to cast. */
export type TableWidthInput = {
  columns?: ReadonlyArray<{
    name?: string; type?: string;
    pk?: boolean; fk?: boolean; unique?: boolean; notNull?: boolean;
  }> | null;
};

/** The mono glyph advance, in px — the WIDEST the `--mono` stack can paint.
 *  JetBrains Mono is 0.600em, but Chromium HINTS it to whole px at these sizes
 *  (measured 7px at 11/12px, 8px at 13px); the stack's fallback (ui-monospace
 *  -> DejaVu Sans Mono / Menlo) is 0.602em and is NOT hinted (measured
 *  7.225px at 12px). WIDTH-SLACK (t_d4e1272d): modelling round(0.6em) alone
 *  gave the 29-char `external_reference_identifier` a 203px track while the
 *  fallback painted 209.5px in it (scrollWidth 210 / clientWidth 203). The
 *  ratio is MEASURED, not a slack fudge; the hinted face is the max(). */
const MONO_ADVANCE_RATIO = 0.602;

/** The advance the card paints for one glyph of the mono face. */
const mono = (size: number) => Math.max(Math.round(size * 0.6), size * MONO_ADVANCE_RATIO);

/** The four mark widths a column can contribute to the gutter. The NN toggle
 *  is a hit box of `max(24, 24s)` whatever its glyphs need (the 24px rule). */
const markWidth = (mark: string, chip: number, ch: (typeof TABLE_CHROME)[TableStyle], s: number) => {
  const glyphs = mark.length + ch.flagBrackets;
  const text = glyphs * mono(chip + ch.flagSize) + glyphs * (chip + ch.flagSize) * ch.flagTrack;
  /* ROW-CHROME-SCALE: the NN box scales (CSS `max(24px, 24px*--ts)`) and so does
     a chip's PADDING — its 1px border pair does not, hence `- 2 … + 2`. */
  const pad = ch.flagPad ? (ch.flagPad - 2) * s + 2 : 0;
  return mark === 'NN' ? Math.max(24 * Math.max(1, s), text) : text + pad;
};

/** One table's box: the total width plus the three track widths the card's CSS
 * needs so every row's name/type columns start on one x. */
export type TableBox = {width: number; flags: number; name: number; type: number};

/** TABLE-SCALE (t_cdd8e4f6) — `scale` is the table's OWN multiplier (1 = the
 *  board's density as-is, no ceiling). It multiplies the row's FONT SIZES, its
 *  padding and its gaps, and ROW-CHROME-SCALE (t_f5d3fd9a) made the 24px editing
 *  boxes + the FK door scale with it too (`max(24, 24s)`); what stays literal is
 *  only what is not text — the 1px borders and the style's row inset. */
export function tableMetrics(
  table: TableWidthInput, style?: unknown, density?: unknown, scale?: unknown,
): TableBox {
  const st = resolveTableStyle(style);
  const de = resolveDensity(density);
  const m = TABLE_METRICS[de];
  const ch = TABLE_CHROME[st];
  const s = resolveTableScale(scale);
  /* the density numbers the scale multiplies, resolved once */
  const chip = m.chip * s, chipGap = m.chipGap * s, colGap = m.gap * s;
  const nameSize = m.name * s, typeSize = m.type * s;
  /* THE ROW'S SIDE PADDING, composed exactly as the CSS composes it: the
   * style's row inset (a literal `margin`) plus the density's `--padX` (which
   * the scale multiplies) minus that same inset (LEDGER's `padding: 0
   * calc(var(--padX) - 6px)`). One expression per side, so 1.5 hands the card
   * 1.5x the padding instead of 1.5x plus an unscaled 6px. At s = 1 this is
   * `max(rowInset, padX)` — the number the width has always used. */
  const side = ch.rowInset + Math.max(0, m.padX * s - ch.rowInset);

  /* FLAG-SLOTS (t_d13987ba) — FOUR FIXED SLOTS, one per constraint TYPE the
   * table uses (PK · FK · UQ · NN; NN exists for any non-pk column — it is the
   * control that SETS the flag), so the track is their SUM: a row without a
   * type leaves its slot EMPTY and `NN` never slides left under `UQ`. */
  const kinds = ['PK', 'FK', 'UQ', 'NN'];
  const used = kinds.filter((k) => (table.columns ?? []).some((c) =>
    k === 'PK' ? c.pk : k === 'FK' ? c.fk : k === 'UQ' ? c.unique : !c.pk));
  let flags = 0, name = 0, type = 0;
  used.forEach((mark, i) => { flags += (i ? chipGap : 0) + markWidth(mark, chip, ch, s); });
  for (const col of table.columns ?? []) {
    const nameLen = (col.name ?? '').length;
    name = Math.max(name, Math.max(2, nameLen) * mono(nameSize));
    const typeLen = (col.type ?? '').length;
    const run = typeLen * typeSize * (ch.upperType ? 0.72 : 0.6) + (ch.upperType ? typeLen * typeSize * 0.04 : 0);
    /* the 52px floor scales with the type run: a track built for 10.5px text
       would look chunky under 7.9px text (and the card's `--gType` IS this
       number, so the floor is measured, never painted by a second rule). */
    type = Math.max(type, Math.max(52 * s, Math.ceil(run) + 4)); /* the old chip's 2px border pair: kept as slack (TYPE-CELL, t_67f95be7) */
  }

  /* ROW-CHROME-SCALE: the door's box is `max(24, 24s)` (never under the 24px
   * target, grows with the scale) and its -7px margins scale, so the row pays
   * `box - 14s` = 10px at 100%. Rows with nothing to show still lay the track
   * out (max() over no rows keeps the 0 above). The 200px floor is the card's
   * own CSS `min-width: 200px`: under it the inner card would be wider than the
   * wrapper React Flow positions (B9).
   * WIDTH-SLACK (t_d4e1272d): build the box from the CEILED tracks it
   * publishes (--gFlags/--gType are integer px), so the name input — the only
   * flex-grow item — cannot pay the rounding out of its own width. */
  const flagsTrack = Math.ceil(flags), nameTrack = Math.ceil(name), typeTrack = Math.ceil(type);
  const door = Math.max(24, 24 * s) - 14 * s;
  const raw = 2 + 2 * side
    + flagsTrack + colGap + nameTrack + colGap + typeTrack + colGap + door;
  return {width: Math.max(200, Math.ceil(raw)), flags: flagsTrack, name: nameTrack, type: typeTrack};
}

/** The number every surface stores: the node's WIDTH (the document's own). */
export const tableNaturalWidth = (
  table: TableWidthInput, style?: unknown, density?: unknown, scale?: unknown,
): number => tableMetrics(table, style, density, scale).width;

/* TABLE-HEIGHT (t_5fa4dbb0) — THE table's HEIGHT, the box half the width model
 * was missing. The canvas wrapper's height is the CARD's (CSS `.react-flow-node-
 * table { height: auto }`), but the LAYOUT places with a number before anything
 * renders, so the number must be the card's real one: the palette's 170px box
 * outlived its rows (measured: a 2-row card is 93px, a 6-row card 205px — the
 * 6-row card ran 11px into the node below it on a TB `.gobi` import whose
 * reservation said 170).
 *
 * THE MODEL, read off the live DOM (chromium, 1600x1000, the app's fonts):
 *   height = 2 (card border pair) + head + rows x rowH
 *   head   = 1 (its rule) + 2x7 (its padding) + max(20px toggle, name line) —
 *            measured 35px at 100% (93 = 2 + 35 + 2x28) and 36 at 150%, where
 *            the 1.5x name's line box overtakes the unscaled 20px toggle.
 *   rowH   = the density's `--rH` (the SAME number the CSS paints), x scale.
 * PURE, like the width (W3): no DOM, no clock. Rounded UP — the reservation may
 * sit a pixel proud of the card, never short (a short slot is an overlap). */
const TABLE_HEAD_RULE = 15;   /* 1px rule + 2x7px padding */
const TABLE_HEAD_MIN = 20;    /* the mode toggle: the head's tallest constant */
const NAME_LINE_RATIO = 1.2;  /* the name's line box per font px (measured) */

export const tableNaturalHeight = (
  table: TableWidthInput, style?: unknown, density?: unknown, scale?: unknown,
): number => {
  void style; /* a style changes chrome, width and paint — never the row's box */
  const m = TABLE_METRICS[resolveDensity(density)];
  const s = resolveTableScale(scale);
  const head = TABLE_HEAD_RULE + Math.max(TABLE_HEAD_MIN, m.name * s * NAME_LINE_RATIO);
  const rows = (table.columns ?? []).length;
  return Math.ceil(2 + head + rows * m.row * s);
};
