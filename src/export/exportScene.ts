/* ROUND AY items 2+3 — the resolved SCENE (src/export/exportScene.ts).
 *
 * OPTION B's spine: ONE function turns (nodes, edges, theme, tokens,
 * measurer) into a fully-resolved Scene — absolute coordinates, literal
 * colours, per-line text with baked baseline y, no var()/color-mix()/
 * currentColor anywhere downstream. After buildScene returns, NOTHING reads
 * the DOM or CSS again: `emitSvg(scene)` (exportSvg.ts) is a pure function
 * of (Scene, ctx).
 *
 * What moves here (out of exportSvg's emit loop):
 * - the measurer passes (text rect, rows fonts, run x, baselineTops, icon,
 *   edgePath, edgeLabelFont) — they run ONCE per element, measured off the
 *   themed clone the caller mounted (D1: the clone stays the layout
 *   measurer);
 * - every colour resolution through the existing resolveVar/resolveColor/
 *   tokens chain (D3: resolved at scene build only);
 * - positions through absPosition (the parentId chain);
 * - each row's baselineY = measuredTop + cachedAscent(family, size, weight)
 *   from the item-1 cache, and each line's wrap from the cache (D2:
 *   measured once).
 *
 * Bounds (item 3, spec §3): from the emitted content group's getBBox when a
 * DOM is available (parse the emitted content, mount hidden, measure), union
 * with the ANALYTIC marker extents (markers are not getBBox geometry) and
 * half the max stroke width, inflated by pad. The stub/harness path (no
 * DOM) keeps the deterministic node-box arithmetic, recorded as
 * `boundsSource: 'boxes'` vs 'bbox' so a harness can assert which ran.
 *
 * Purveyance kept verbatim from the AR/AX emitter: the marker contract
 * (markerEnd w/h verbatim, markerUnits="strokeWidth"), the AR-2 label
 * storage (e.label only), the AV icon lift (resolved ink), the AX row model
 * (runs/baselineTops).
 */

import {resolveColor, COLOR_VAR, isColorKey} from '../colors';
import {asShape, SHAPE_TOP_FACE} from '../nodes/shapes';
import {rotatedExtent} from '../rotation';
import {labelAnchor, labelPlatePaint, type LabelPos} from '../edgeLabel';
import {
  type ExportNode, type ExportEdge, type ExportInput,
  type TextRect,
} from './exportSvg';
import {getTextMetrics, getTextAscent, type TextWidthFn, type TextAscentFn} from '../textMetrics';
/* ROUND GOBI-TEXT — the sheet's own edge-label font (11px semibold): the
 * headless door cannot measure it, so ONE leaf constant supplies it. */
import {EDGE_LABEL_FONT} from '../labelMetrics';
/* ROUND GOBI-TEXT — the align → SVG text-anchor mapping for the DOM-less path. */
import {alignAnchor} from '../textStyle';
/* GOBI-CONNECT — the headless route (handle-aware), the ONE owner of the
 * anchor arithmetic + the generator call for a DOM-less export. */
import {edgeRoute} from './edgeRoute';
/* ROUND GOBI-TEXT3 — the DOM-less vertical placement (a leaf: no cycle). */
import {vAlignRows} from './textVAlign';

/* ------------------------------------------------------------------ types */

export type SceneTextRow = {
  x: number;
  baselineY: number;
  content: string;
  size: number;
  weight: number;
  fill: string;
  family?: string;
  spacing?: number;
  anchor?: string;
};

export type SceneIcon = {
  x: number; y: number; w: number; h: number;
  viewBox: string;
  primitives: Array<{tag: string; attrs: Record<string, string>}>;
  stroke: string; strokeWidth: number; fill: string;
};

export type SceneNode = {
  id: string;
  absX: number; absY: number;
  w: number; h: number;
  kind: string;               /* 'goblin' | 'label' | 'table' | 'note' | 'group' | 'customshape' */
  accent: string;             /* the node's resolved accent (fill/stroke/frame) */
  frame?: string;             /* pre-serialized shape-frame markup, literal colours */
  icon?: SceneIcon | null;
  title?: string;             /* label/group title text */
  sub?: string;
  rows: SceneTextRow[];       /* per-line text rows, baselineY baked */
  rawSvg?: string;            /* customshape: the user SVG string, verbatim */
  textRect?: TextRect | null; /* the measured block (tableMarkup consumes it) */
  data?: Record<string, unknown> | null;
  /** ROUND ROTATE — paint rotation in degrees, normalised (-180, 180].
   *  Undefined = 0 = the emitter writes no transform (byte-identical export
   *  for unrotated boards). Includes the K5 post-it tilt exactly like the
   *  canvas root's inline transform — ONE number, one painter. */
  rotation?: number;
};

export type SceneEdge = {
  id: string;
  d: string;
  color: string;
  strokeWidth: number;
  marker: {w: number; h: number};
  label?: {
    x: number; y: number; row: SceneTextRow;
    /** ROUND GOBI-TEXT — the plate, resolved from the SAME three states the
     *  canvas declares as classes (`.edge-label.lb-none|lb-surface|lb-outline`):
     *  `transparent`/`transparent` for `none` (the DEFAULT), `--surface` (or the
     *  stored `labelBgKey`) for `surface`, and the stored colour / `transparent`
     *  fill with a `--border-strong` hairline for `outline`.
     *  ROUND GOBI-TEXT3 — `halo` is the literal `--bg` and is present ONLY for
     *  `none`, the state that draws no plate: the canvas keeps such a label
     *  legible with a `--bg` text-shadow, and the emitter paints the same ring
     *  as a `paint-order="stroke"` stroke on the glyphs (SVG has no
     *  text-shadow). `plateFill`/`plateStroke` are meaningless when a halo is
     *  set — nothing is painted behind it. */
    plateFill?: string; plateStroke?: string; halo?: string;
  };
};

export type Bounds = {minX: number; minY: number; maxX: number; maxY: number};

export type Scene = {
  theme: string;
  bg: string;
  surface: string;
  dim: string;
  fg: string;
  nodes: SceneNode[];
  edges: SceneEdge[];
  groups: SceneNode[];
  /** Where the bounds came from: 'bbox' = the mounted content group's
   *  getBBox + analytic marker extents + half stroke; 'boxes' = the
   *  deterministic node-box arithmetic (the harness/stub path). */
  boundsSource: 'bbox' | 'boxes';
  bounds: Bounds;
  pad: number;
};

export type BuildSceneCtx = {
  /** Mount a serialized content-group string hidden in the document and
   *  measure its getBBox. Supplied by the browser caller; absent in the
   *  Node harness (→ 'boxes' bounds). Returns null when no DOM is usable. */
  measureContentBounds?: (contentGroup: string) => Bounds | null;
  /** Await document.fonts readiness, bounded (spec §1: race a 2 s timeout,
   *  then measure anyway). Optional — the harness passes nothing. */
  awaitFonts?: () => Promise<void>;
  /** Max marker extent box per edge (analytic). Default: the AU-3 numbers. */
  fontFamilyOf?: (kind?: 'mono' | 'sans') => string | undefined;
};

/* ------------------------------------------------------------------ utils */

const num = (v: unknown): number | null =>
  typeof v === 'number' && isFinite(v) ? v : null;

export function nodeSize(n: ExportNode): {w: number; h: number} {
  const w = num(n.measured?.width) ?? num(n.style?.width as number | undefined) ?? 180;
  const h = num(n.measured?.height) ?? num(n.style?.height as number | undefined) ?? 90;
  return {w: Math.max(w, 4), h: Math.max(h, 4)};
}

/** DEFECT-3's absolute-position resolver, moved here verbatim (parentId
 *  chain, cycle-guarded). */
export function absPosition(n: ExportNode, byId: Map<string, ExportNode>): {x: number; y: number} {
  let x = n.position.x, y = n.position.y;
  let pid = n.parentId ?? null;
  const guard = new Set<string>();
  while (pid && !guard.has(pid)) {
    guard.add(pid);
    const p = byId.get(pid);
    if (!p) break;
    x += p.position.x; y += p.position.y;
    pid = p.parentId ?? null;
  }
  return {x, y};
}

function resolveVar(value: string, tokens: Record<string, string>): string {
  const m = /^var\(\s*(--[A-Za-z0-9-]+)\s*(?:,\s*([^)]+))?\)$/.exec(value.trim());
  if (!m) return value;
  const fromMap = tokens[m[1]];
  if (fromMap) return fromMap;
  return m[2] ? m[2].trim() : value;
}

export function nodeAccent(n: ExportNode, tokens: Record<string, string>): string {
  return resolveVar(resolveColor(n.data), tokens);
}

/** The AU-3 route fallback when no live element exists (the harness path). */
export function stubEdgePath(e: ExportEdge, s: ExportNode, t: ExportNode,
  abs: Map<string, {x: number; y: number}>): {
    d: string; start: {x: number; y: number}; end: {x: number; y: number};
  } {
  const ss = nodeSize(s), ts = nodeSize(t);
  const sp = abs.get(s.id)!, tp = abs.get(t.id)!;
  const x1 = sp.x + ss.w / 2, y1 = sp.y + ss.h / 2;
  const x2 = tp.x + ts.w / 2, y2 = tp.y + ts.h / 2;
  return {d: `M ${x1},${y1} L ${x2},${y2}`, start: {x: x1, y: y1}, end: {x: x2, y: y2}};
}

/** `.node-body`'s horizontal padding (`styles.css: 'padding: 14px 18px 14px'`).
 *  The canvas centres node text inside this content box, so a DOM-less export
 *  must use it too; the number lives here and nowhere else in this path. */
const BODY_PAD_X = 18;

/* NODE-TEXT-CENTER (2026-11-03) — the side-rail fractions the sheet's
 * `--body-inset` registry reserves for the two DECORATED silhouettes (the
 *  queue's dot rail, divider x=62 of 200; the actor's person badge, ends
 *  x=58). Reserved on BOTH sides so the DOM-less text box stays centred in
 *  the node while clearing the decoration; at the palette width 290 that
 *  leaves >= 14px of air past each decoration. The sheet is the source of
 *  truth — checks/round-node-text-center.mjs (nt4a) asserts this table equals
 *  the sheet's queue/actor rows, so the two cannot drift. */
const RAIL_FRACTION: Partial<Record<string, number>> = {queue: 0.36, actor: 0.34};

/* GOBI-TEXT-FIT (R2) — where the decoration actually ENDS (the queue's
 * divider x=62 of 200; the actor's badge path x=58), as a width fraction.
 * The reserve alone does not guarantee AIR: at the 190px CSS floor
 * 0.36·w − 0.31·w = 9.5px < 12px of clearance, so the text box also takes a
 * hard 12px past the band end — whichever side is wider wins. */
const RAIL_END_FRACTION: Partial<Record<string, number>> = {queue: 0.31, actor: 0.29};

/* GOBI-WRAP-RULES N2 — the air a text block keeps BELOW a top face's rim
 * (SHAPE_TOP_FACE); the harness floor is rim + 4, this buys one more. */
const RIM_PAD = 5;

/* ------------------------------------------------------- text row building */

/** The wrap for ONE block, served through the item-1 cache. `measure` is the
 *  injected width fn; the cache stops re-measuring on replays. */
function cachedWrap(
  text: string, maxWidth: number,
  font: {family: string; size: number; weight: number; spacing: number},
  widthOf: TextWidthFn, ascentOf: TextAscentFn,
): {lines: string[]; ascent: number} {
  const m = getTextMetrics(
    {text, family: font.family, size: font.size, weight: font.weight,
     spacing: font.spacing, maxWidth},
    widthOf, ascentOf);
  return {lines: m.lines, ascent: m.ascent};
}

const estimateTextWidth = (text: string, o: {size: number; spacing?: number}): number =>
  text.length * o.size * 0.6 + Math.max(0, text.length - 1) * (o.spacing ?? 0);

/** Node text rows (kicker / title(+wrap) / sub / metric) — the AX row model
 *  with the wrap and ascent served from the cache. Baselines bake as
 *  measuredTop + cachedAscent; x is the measured run x. */
export function buildNodeRows(
  n: ExportNode, box: {w: number; h: number}, t: TextRect,
  ink: {fg: string; dim: string}, accent: string,
  widthOf: TextWidthFn, ascentOf: TextAscentFn,
): SceneTextRow[] {
  const d = (n.data ?? {}) as Record<string, unknown>;
  const title = String(d.title ?? d.label ?? n.id);
  const rows: SceneTextRow[] = [];
  const titleTop = t.baselineTops?.title;
  const yTitleStart = titleTop
    ? titleTop.top + titleTop.ascent
    : t.y + Math.min(t.size, box.h > 60 ? 16 : box.h * 0.3) + 4;
  const xRow = t.x;
  /* ROUND GOBI-TEXT — with NO measurement (`t.runs` absent: the headless door
     and every stub) the exporter must place the runs itself, and the node's own
     `textStyle.align` is exactly what the canvas would honour: centre anchors
     the text block's MIDDLE, right anchors its END. A measured rect already
     reflects the CSS, so the derivation is skipped there.
     FIRST-VISIT (2026-11-01) — the fallback is now CENTER: the card body's
     no-write value moved from left to center (alignForBody), so an UNALIGNED
     node must anchor middle here too or the headless export would disagree
     with the canvas it cannot see. */
  const storedAlign = (d.textStyle as {align?: string} | undefined)?.align;
  const anchor = t.runs ? undefined : alignAnchor(storedAlign ?? 'center');
  const place = (x: number) => (anchor === 'middle' ? x + t.w / 2 : anchor === 'end' ? x + t.w : x);
  const runOf = (row: 'kicker' | 'title' | 'sub' | 'metric'): number =>
    place(t.runs?.[row]?.x ?? xRow);
  const topOf = (row: 'kicker' | 'sub' | 'metric', legacyOffset: number): number => {
    const bt = t.baselineTops?.[row];
    return bt ? bt.top + bt.ascent : yTitleStart + legacyOffset;
  };
  let y = yTitleStart;
  const hasSub = d.sub && typeof d.sub === 'string';
  const hasMetric = d.metric && typeof d.metric === 'string';
  /* GOBI-TEXT-FIT (R3) — a label-only body renders NO kicker row (the canvas'
     label-only branch paints one centred sentence; the kind label is not
     prose). The MEASURED path agrees by construction: that branch renders no
     .node-kicker element, so the measurer reports no kicker row at all. */
  const hasKicker = d.body !== 'label-only' && d.kicker && typeof d.kicker === 'string' && d.kicker !== title;

  const kickerFont = t.rows?.kicker;
  const subFont = t.rows?.sub;
  const metricFont = t.rows?.metric;
  const titleFamily = t.family || '';

  if (hasKicker) {
    /* GOBI-TEXT-FIT (R1) — a long authored kicker WRAPS like the title (one
       long line painted past the box borders before). A kicker that already
       fits emits BYTE-IDENTICAL rows, so no existing board changes. Extra
       lines step the kicker's own line pitch and push the title down: the
       trailing `y =` already carries the shift, exactly as the canvas' flex
       column stacks a wrapped kicker above the title. */
    const kickSize = kickerFont?.size ?? 9.5;
    const kickWeight = kickerFont?.weight ?? 500;
    const kickSpacing = kickerFont?.spacing ?? 1.1;
    const kickLine = Math.round(kickSize * 1.35);
    const kickX = runOf('kicker');
    const kickText = String(d.kicker).toUpperCase();
    const kickAvail = t.runs ? Math.max(12, t.x + t.w - kickX) : Math.max(12, t.w);
    const kickLines = widthOf(kickText, {size: kickSize, weight: kickWeight, spacing: kickSpacing, family: kickerFont?.family}) <= kickAvail
      ? [kickText]
      : cachedWrap(kickText, kickAvail, {family: kickerFont?.family ?? '', size: kickSize, weight: kickWeight, spacing: kickSpacing}, widthOf, ascentOf).lines;
    const yKick0 = t.baselineTops?.kicker
      ? t.baselineTops.kicker.top + t.baselineTops.kicker.ascent
      : yTitleStart - 15;
    kickLines.forEach((ln, i) => {
      rows.push({
        x: kickX, baselineY: yKick0 + i * kickLine, content: ln,
        size: kickSize, weight: kickWeight,
        fill: t.fill || ink.dim, spacing: kickSpacing,
        family: kickerFont?.family,
      });
    });
    y = Math.max(y, yKick0 + (kickLines.length - 1) * kickLine + 15);
  }

  const availW = Math.max(12, t.titleW ?? t.w);
  const {lines: wrapped} = cachedWrap(
    title, availW,
    {family: titleFamily, size: t.size, weight: t.weight, spacing: t.spacing ?? 0},
    widthOf, ascentOf);
  const lineHeight = Math.round(t.size * 1.35);
  const otherRows = (hasSub ? lineHeight : 0) + (hasMetric ? 20 : 0);
  let useWrapped = wrapped;
  if (t.h > 0 && otherRows > 0) {
    const budget = (t.y + t.h) - (y - lineHeight * 0.35);
    const maxLines = lineHeight > 0 ? Math.max(1, Math.floor(budget / lineHeight)) : 1;
    if (useWrapped.length > maxLines) useWrapped = useWrapped.slice(0, maxLines);
  }

  useWrapped.forEach((ln, i) => {
    const baseline = titleTop
      ? titleTop.top + titleTop.ascent + i * lineHeight
      : y + i * lineHeight;
    rows.push({
      x: runOf('title'), baselineY: baseline, content: ln,
      size: t.size, weight: t.weight, fill: t.fill || ink.fg,
      family: titleFamily || undefined,
      spacing: t.spacing ? t.spacing : undefined,
    });
  });
  y += (useWrapped.length - 1) * lineHeight;

  if (hasSub) {
    /* GOBI-TEXT-FIT (R1/R2) — the sub WRAPS like the title. It used to be one
       long line: centred over its box it painted past both borders (measured
       +7.3px each side on a 39-char sub) and straight across the queue's dot
       rail (463px² on a 20-char sub at width 290). A line that already fits
       emits BYTE-IDENTICAL rows. The wrap width is the row's own box: the
       derived (DOM-less) box already reserves the rail band on both sides, a
       measured box wraps from the sub's run x to the body's right edge — the
       same width the DOM wraps .node-sub at. Extra lines clamp to the box's
       remaining height (the canvas clips at the body bottom, so lines past
       the budget are painted nowhere); ONE line always renders. */
    const subSize = subFont?.size ?? 11.5;
    const subWeight = subFont?.weight ?? 450;
    const subLine = Math.round(subSize * 1.35);
    const subX = runOf('sub');
    const subAvail = t.runs ? Math.max(12, t.x + t.w - subX) : Math.max(12, t.w);
    const subText = String(d.sub);
    const subLines = widthOf(subText, {size: subSize, weight: subWeight, family: subFont?.family}) <= subAvail
      ? [subText]
      : cachedWrap(subText, subAvail, {family: subFont?.family ?? '', size: subSize, weight: subWeight, spacing: 0}, widthOf, ascentOf).lines;
    /* A measured box clips at its own bottom (the real DOM body); the DOM-less
       box's h is the stub's GUESS (61px, no element to read), so the node's own
       height is the honest clip — vAlignRows re-centres the block in it. The
       legacy first baseline sits one line under the TITLE'S LAST line (a
       wrapped title or kicker pushes it down, exactly as the canvas' flex
       column does); a 1-line block keeps today's exact number. */
    y = t.baselineTops?.sub
      ? t.baselineTops.sub.top + t.baselineTops.sub.ascent
      : Math.max(y, yTitleStart) + lineHeight;
    const subBudget = (t.runs ? t.y + t.h : box.h) - (y - subLine * 0.35);
    const subMax = Math.max(1, Math.floor(subBudget / subLine));
    subLines.slice(0, subMax).forEach((ln, i) => {
      rows.push({
        x: subX, baselineY: y + i * subLine, content: ln,
        size: subSize, weight: subWeight,
        fill: ink.dim, family: subFont?.family,
      });
    });
  }
  if (hasMetric) {
    y = topOf('metric', hasSub ? 20 : lineHeight + 20);
    rows.push({
      x: runOf('metric'), baselineY: y,
      content: String(d.metric) + (d.metricUnit ? ` ${d.metricUnit}` : ''),
      size: metricFont?.size ?? 20, weight: metricFont?.weight ?? 700,
      fill: accent, family: metricFont?.family,
    });
  }
  /* ROUND GOBI-TEXT — the derived anchor rides on every row (the emitter only
     writes `text-anchor` when it is not `start`, so an unaligned node is
     byte-identical). */
  return anchor && anchor !== 'start' ? rows.map((r) => ({...r, anchor})) : rows;
}

/* ------------------------------------------------------------- buildScene */

/** The synchronous scene BODY: no awaits inside — the async entry below is
 *  the fonts-aware wrapper. Every measurer pass runs ONCE here (D1), every
 *  colour resolves through the token chain (D3), every wrap/baseline goes
 *  through the item-1 cache (D2). */
export function buildSceneBody(input: ExportInput): Scene {
  const pad = input.pad ?? 24;
  const tokens = input.tokens;
  const measurer = input.measurer;
  const nodes = input.nodes.filter(n => n && typeof n.id === 'string');
  const byId = new Map(nodes.map(n => [n.id, n]));
  const edges = input.edges.filter(e => e && byId.has(e.source) && byId.has(e.target));
  const abs = new Map(nodes.map(n => [n.id, absPosition(n, byId)]));
  const widthOf: TextWidthFn = measurer.measureText
    ? (s, o) => measurer.measureText!(s, o)
    : (s, o) => estimateTextWidth(s, o);
  const ascentOf: TextAscentFn = ({size, weight, family}) => {
    /* the domMeasurer's real Mg-probe rides the measurer as the ROUND AY
     * `ascentOf` extension (optional); stub measurers fall to the 0.78em
     * floor the domMeasurer itself uses as its last resort. */
    const hook = (measurer as {ascentOf?: (o: {size: number; weight: number; family?: string}) => number}).ascentOf;
    if (hook) return hook({size, weight, family});
    return size * 0.78;
  };
  const ink = {
    fg: tokens['--fg'] || '#e8e8ea',
    dim: tokens['--dim'] || '#8a8a92',
    surface: tokens['--surface'] || '#141417',
    bg: tokens['--bg'] || '#0b0b0d',
  };

  const isGroup = (n: ExportNode) => asShape(n.data?.shape) === 'group';

  /** A node's TEXT BOX. A measurer with a DOM reports the element's rect; one
   *  without (`runs` absent — the `alignAnchor` signal) cannot, and a fixed box
   *  centres EVERY node at the same x (measured: -6px at 190, -56px at 290).
   *  So the SCENE derives it from the node's own width; BODY_PAD_X is the ONE
   *  number. Every shape body is inset symmetrically, so this centres them all.
   *
   *  NODE-TEXT-CENTER (2026-11-03) — the two DECORATED silhouettes reserve
   *  their side rail on BOTH sides, exactly as the sheet's `--body-inset`
   *  registry does (RAIL_FRACTION below mirrors its queue/actor rows; the
   *  harness round-node-text-center nt4a asserts the two tables agree), so the
   *  DOM-less door never paints text across the queue's dot rail or the
   *  actor's badge. The vertical default is the rect band's own top (2%) —
   *  where the canvas starts a `valign:top` block; a MIDDLE block is
   *  re-centred by `vAlignRows` either way. */
  const textBox = (n: ExportNode, s: {w: number; h: number}): TextRect | null => {
    const t = measurer.text(n.el);
    if (t && t.runs) return t;
    const shp = String(asShape(n.data?.shape) ?? '');
    const rail = RAIL_FRACTION[shp] ?? null;
    const side = rail != null
      ? Math.max(Math.round(rail * s.w), Math.round((RAIL_END_FRACTION[shp] ?? rail) * s.w) + 12)
      : BODY_PAD_X;
    /* GOBI-WRAP-RULES N2 — a shape whose outline spends height on a TOP FACE
       (the cylinder's rim, the storage lid: SHAPE_TOP_FACE) starts its text
       band BELOW the rim (rim + RIM_PAD), not where the rect band starts —
       the kicker otherwise sits on the cylinder's front arc (measured 47.8 vs
       rim bottom 50.8 on a 145 px node). Shapes without a top face keep the
       box they already had. */
    const faceFrac = SHAPE_TOP_FACE[shp];
    const faceTop = faceFrac != null ? Math.max(s.h * 0.02, faceFrac * s.h + RIM_PAD) : null;
    const base = t ?? {y: s.h * 0.02, h: s.h * 0.96, size: 14.5, weight: 650, fill: ink.fg, anchor: 'start'};
    return {...base,
      y: faceTop ?? base.y, h: faceTop != null ? Math.max(12, s.h - faceTop - s.h * 0.02) : base.h,
      x: side, w: Math.max(12, s.w - side * 2)};
  };

  /** ROUND GOBI-TEXT3 — a DOM-LESS block is placed ARITHMETICALLY, from the
   *  node's own stored `vAlign` (see textVAlign.ts: the sheet's
   *  `justify-content` needs a layout engine the headless door has not got).
   *  A measured rect already reflects the CSS, so it is left untouched.
   *  GOBI-WRAP-RULES N2 — a top-face shape centres its block in the band
   *  BELOW the rim (bandTop), not the full box, so the first row clears the
   *  rim's arc by RIM_PAD. */
  const placeRows = (n: ExportNode, s: {w: number; h: number}, t: TextRect | null, rows: SceneTextRow[]): SceneTextRow[] => {
    if (t && t.runs) return rows;
    const shp = String(asShape(n.data?.shape) ?? '');
    const bandTop = SHAPE_TOP_FACE[shp] != null ? SHAPE_TOP_FACE[shp]! * s.h + RIM_PAD : 0;
    return vAlignRows(rows, s.h, (n.data?.textStyle as {vAlign?: string} | undefined)?.vAlign, ascentOf, bandTop);
  };

  /* ---- nodes */
  const sceneNodes: SceneNode[] = [];
  const sceneGroups: SceneNode[] = [];
  for (const n of nodes) {
    const s = nodeSize(n);
    const p = abs.get(n.id)!;
    const accent = nodeAccent(n, tokens);
    const type = n.type ?? (n.data?.columns ? 'table' : 'goblin');
    const kind = isGroup(n) ? 'group' : type;
    const sn: SceneNode = {
      id: n.id, absX: p.x, absY: p.y, w: s.w, h: s.h,
      kind, accent, rows: [], data: n.data ?? null,
      /* ROUND ROTATE — GEOMETRY rotation only (d.rotation), NOT the K5 tilt:
       *  the tilt was a canvas-only CSS affectation before this round and the
       *  export never painted it, so including it here would change the bytes
       *  of every old actor/note board — the round's byte-parity invariant
       *  forbids that. A node the user HAS rotated exports with its full
       *  stored angle. */
      rotation: typeof (n.data as {rotation?: unknown} | null)?.rotation === 'number'
        ? ((n.data as {rotation: number}).rotation || undefined)
        : undefined,
    };
    if (kind === 'group') {
      /* ROUND GOBI-GROUP-BANNER — no childBounds re-fit here any more: the
       * emitter paints the AUTHORED box (absX/absY + nodeSize), matching the
       * canvas, so the compiled 68px banner inset survives every export door.
       * The old members-bounds ± 12 computation is deleted with its only
       * reader; a memberless group also paints its authored box. */
      const gt = measurer.text(n.el);
      const title = String(n.data?.title ?? n.id);
      const gtf = gt?.rows?.groupTitle;
      sn.title = title;
      sn.textRect = gt ?? null;
      sn.rows = [{
        x: 10, baselineY: 14, content: title,
        size: gtf?.size ?? 10.5, weight: gtf?.weight ?? 550,
        fill: gt?.fill || ink.dim, family: gtf?.family,
        spacing: gtf && gtf.spacing ? gtf.spacing : 1,
      }];
      sceneGroups.push(sn);
      continue;
    }
    if (kind === 'label') {
      const lt = measurer.text(n.el);
      sn.title = String(n.data?.title ?? n.id);
      sn.sub = n.data?.sub ? String(n.data.sub) : undefined;
      sn.textRect = lt ?? null;
      sn.rows = [{
        x: s.w / 2, baselineY: lt ? lt.y + lt.size + 4 : s.h / 2,
        content: sn.title,
        size: lt?.size ?? 14.5, weight: lt?.weight ?? 650,
        fill: lt?.fill || ink.fg, anchor: 'middle',
      }];
      if (sn.sub) {
        sn.rows.push({
          x: s.w / 2, baselineY: (lt ? lt.y + lt.size + 4 : s.h / 2) + 18,
          content: sn.sub, size: 11.5, weight: 450, fill: ink.dim, anchor: 'middle',
        });
      }
      sceneNodes.push(sn);
      continue;
    }
    if (kind === 'customshape') {
      const svg = typeof n.data?.svg === 'string' && n.data.svg ? n.data.svg : '';
      sn.rawSvg = svg || undefined;
      sceneNodes.push(sn);
      continue;
    }
    if (asShape(n.data?.shape) === 'note') {
      const nt = measurer.text(n.el);
      const noteText = nt
        ? (nt.family || measurer.defaultFamily
            ? {...nt, family: nt.family ?? measurer.defaultFamily!('sans')}
            : nt)
        : nt;
      sn.frame = 'note';
      sn.textRect = noteText ?? null;
      sn.rows = noteText
        ? placeRows(n, s, noteText, buildNodeRows(n, s, noteText, {fg: ink.fg, dim: ink.dim}, accent, widthOf, ascentOf))
        : placeRows(n, s, null, buildNodeRows(n, s, {x: 10, y: 8, w: s.w - 20, h: s.h - 16, size: 12, weight: 500, fill: ink.fg, anchor: 'start'},
            {fg: ink.fg, dim: ink.dim}, accent, widthOf, ascentOf));
      sceneNodes.push(sn);
      continue;
    }
    if (kind === 'table') {
      const tt = measurer.text(n.el);
      sn.textRect = tt ?? null;
      sn.title = String(n.data?.name ?? n.data?.title ?? n.id);
      sceneNodes.push(sn);
      continue;
    }
    /* goblin: the ShapeFrame geometry is serialized by the EMITTER from the
     * shape kind (it is a pure table lookup); the scene carries the kind +
     * accent + icon + text rows. */
    const plain = n.data?.plainCylinder !== false;
    (sn as SceneNode & {plain?: boolean}).plain = plain;
    sn.icon = measurer.icon?.(n.el) ?? null;
    const t = textBox(n, s);
    sn.textRect = t;
    sn.rows = placeRows(n, s, t, buildNodeRows(n, s, t as TextRect, {fg: ink.fg, dim: ink.dim}, accent, widthOf, ascentOf));
    sceneNodes.push(sn);
  }

  /* ---- edges */
  const sceneEdges: SceneEdge[] = [];
  for (const e of edges) {
    const src = byId.get(e.source)!;
    const tgt = byId.get(e.target)!;
    const color = resolveVar(resolveColor(e.data), tokens);
    /* GOBI-CONNECT (t_c911fabb) — the headless fallback is no longer a
     * centre-to-centre stub: with no live element we rebuild the REAL route
     * from the edge's own handles + the nodes' absolute boxes, through the
     * same generators the canvas paints with (see `edgeRoute`). The old stub
     * stays LAST for the shapes it still covers honestly — an edge whose
     * handles are unknown or compound (the ERD column ids). */
    const route = (e.el ? measurer.edgePath(e.el) : null)
      ?? edgeRoute(e, {...abs.get(src.id)!, ...nodeSize(src)}, {...abs.get(tgt.id)!, ...nodeSize(tgt)})
      ?? stubEdgePath(e, src, tgt, abs);
    const me = (typeof e.markerEnd === 'object' && e.markerEnd !== null ? e.markerEnd : {}) as {width?: unknown; height?: unknown};
    const mw = typeof me.width === 'number' && isFinite(me.width) && me.width > 0 ? me.width : 14;
    const mh = typeof me.height === 'number' && isFinite(me.height) && me.height > 0 ? me.height : 14;
    const se: SceneEdge = {
      id: e.id, d: route.d, color, strokeWidth: 1.8, marker: {w: mw, h: mh},
    };
    const label = e.label;
    if (typeof label === 'string' && label) {
      const degenerate = route.start.x === 0 && route.start.y === 0 && route.end.x === 0 && route.end.y === 0;
      const d = (e.data ?? {}) as Record<string, unknown>;
      const L = degenerate
        ? {x: (abs.get(src.id)!.x + abs.get(tgt.id)!.x + nodeSize(src).w - nodeSize(tgt).w) / 2,
           y: (abs.get(src.id)!.y + abs.get(tgt.id)!.y + nodeSize(src).h - nodeSize(tgt).h) / 2}
        : labelAnchor({
            sourceX: route.start.x, sourceY: route.start.y,
            targetX: route.end.x, targetY: route.end.y,
            labelX: (route.start.x + route.end.x) / 2,
            labelY: (route.start.y + route.end.y) / 2,
            offset: (typeof d.offset === 'string' ? d.offset : undefined) as LabelPos | undefined,
            labelOffset: (d.labelOffset ?? undefined) as {x: number; y: number} | undefined,
            labelPinned: d.labelPinned === true,
          });
      const lf = measurer.edgeLabelFont?.(e.id)
        ?? {family: measurer.defaultFamily?.('mono'), size: EDGE_LABEL_FONT.size, weight: EDGE_LABEL_FONT.weight, spacing: 0};
      /* ROUND GOBI-TEXT — the canvas label's OWN colours, resolved to literals.
         The ink is `--label-fg` (data.labelTextKey) falling back to `--fg`; the
         plate is `labelPlatePaint` (src/edgeLabel.ts), the ONE owner of "which
         plate state paints what" — the canvas reads the same states as classes. */
      const inkOf = (v: unknown): string | undefined => (isColorKey(v) ? resolveVar(COLOR_VAR[v], tokens) : undefined);
      const plate = labelPlatePaint(d.labelBg, inkOf(d.labelBgKey),
        {surface: ink.surface, border: tokens['--border-strong'] || ink.dim, bg: ink.bg});
      se.label = {
        x: L.x, y: L.y,
        plateFill: plate.fill, plateStroke: plate.stroke, halo: plate.halo,
        row: {
          x: 0, baselineY: 4, content: label,
          size: lf?.size ?? EDGE_LABEL_FONT.size, weight: lf?.weight ?? EDGE_LABEL_FONT.weight,
          fill: inkOf(d.labelTextKey) ?? ink.fg, family: lf?.family,
          spacing: lf?.spacing ? lf.spacing : undefined,
        },
      };
    }
    sceneEdges.push(se);
  }

  /* ---- bounds: the node-box arithmetic is the FALLBACK (D4's deterministic
   * harness path). When the caller can measure the mounted content group,
   * the bbox replaces it — the emitter hands buildScene the emitted content
   * through ctx.measureContentBounds in a SECOND pass (see emitSvg's compose
   * in exportSvg.ts). */
  let bounds: Bounds = {minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity};
  for (const n of nodes) {
    const s = nodeSize(n);
    const p = abs.get(n.id)!;
    /* ROUND ROTATE — a rotated node's paint extent is the orbit of its four
     * corners, which can exceed the w×h AABB (a 100×50 box at 90° paints a
     * 50×100 footprint whose corners stick out along BOTH axes). Union the
     * rotated corners — exactly the AABB at 0°. Geometry rotation only, same
     * as the emitter (the K5 tilt is canvas-only, as it always was). */
    const rotDeg = typeof (n.data as {rotation?: unknown} | null)?.rotation === 'number'
      ? (n.data as {rotation: number}).rotation
      : 0;
    if (rotDeg === 0) {
      bounds.minX = Math.min(bounds.minX, p.x);
      bounds.minY = Math.min(bounds.minY, p.y);
      bounds.maxX = Math.max(bounds.maxX, p.x + s.w);
      bounds.maxY = Math.max(bounds.maxY, p.y + s.h);
    } else {
      /* ROUND SELBOX — the ONE shared extent (src/rotation.ts rotatedExtent):
       * the inline |cos|/|sin| arithmetic this file used to carry is gone; the
       * export path and the canvas selection box now share the same function. */
      const e = rotatedExtent(p.x, p.y, s.w, s.h, rotDeg);
      bounds.minX = Math.min(bounds.minX, e.x);
      bounds.minY = Math.min(bounds.minY, e.y);
      bounds.maxX = Math.max(bounds.maxX, e.x + e.w);
      bounds.maxY = Math.max(bounds.maxY, e.y + e.h);
    }
  }
  if (!nodes.length) bounds = {minX: 0, minY: 0, maxX: 800, maxY: 400};
  /* edges can stick out beyond the boxes (label boxes, long routes): union
   * the label anchors too */
  for (const e of sceneEdges) {
    if (!e.label) continue;
    bounds.minX = Math.min(bounds.minX, e.label.x);
    bounds.minY = Math.min(bounds.minY, e.label.y);
    bounds.maxX = Math.max(bounds.maxX, e.label.x);
    bounds.maxY = Math.max(bounds.maxY, e.label.y);
  }

  return {
    theme: input.theme, bg: ink.bg, surface: ink.surface, dim: ink.dim, fg: ink.fg,
    nodes: sceneNodes, edges: sceneEdges, groups: sceneGroups,
    boundsSource: 'boxes', bounds, pad,
  };
}

/** Item 3's real bounds: the mounted content group's getBBox + per-edge
 *  analytic marker extents + half max stroke, inflated by pad. `content`
 *  is the emitted content-group markup (groups + edges + nodes, pre-
 *  viewBox); the caller measures it in the DOCUMENT (hidden mount —
 *  detached nodes have no layout). Returns null when measurement is not
 *  possible (the caller keeps the 'boxes' fallback). */
export function bboxBounds(
  content: string,
  edges: SceneEdge[],
  measure: (contentGroup: string) => {x: number; y: number; width: number; height: number} | null,
): Bounds | null {
  const bb = measure(content);
  if (!bb) return null;
  /* half max stroke: the content's widest stroke is 1.8 (edges; frames are
   * ≤1.5) — inflate by half of it (spec: 0.9 px at stroke 1.8) */
  const halfStroke = 0.9;
  let b: Bounds = {
    minX: bb.x - halfStroke, minY: bb.y - halfStroke,
    maxX: bb.x + bb.width + halfStroke, maxY: bb.y + bb.height + halfStroke,
  };
  /* markers are NOT getBBox geometry: union their analytic extents. The
   * marker (AU-3 contract: viewBox -10 -10 20 20, markerUnits=strokeWidth,
   * refX=0 refY=0, w×h at the edge's own numbers) extends BACKWARDS along
   * the route's end tangent from the endpoint. The polyline's extreme
   * points in marker space are (±5, ±4) in a 20-unit box scaled to w/20;
   * the dominant extent is 5*(w/20) behind the tip along the tangent, with
   * the 4*(h/20) lateral span. To stay honest WITHOUT re-deriving tangents
   * from the `d` string (a path parser here would duplicate the measurer's
   * truth), use the route endpoint + the conservative max extent in every
   * direction: maxExtent = max(w,h)/20 * 5 + half stroke — the marker can
   * never paint farther than that from the endpoint (its own geometry is
   * bounded by |x|≤5, |y|≤4 in the 20-unit viewBox). */
  const maxHalfSpan = Math.max(
    ...edges.map(e => Math.max(e.marker.w, e.marker.h)), 14) / 20 * 5;
  for (const e of edges) {
    /* the endpoint: the LAST coordinate pair in the path's data — parse
     * trailing "L x,y" (stub routes) or the final numbers of any command */
    const nums = e.d.match(/-?\d+(?:\.\d+)?/g);
    if (!nums || nums.length < 2) continue;
    const ex = parseFloat(nums[nums.length - 2]);
    const ey = parseFloat(nums[nums.length - 1]);
    if (!isFinite(ex) || !isFinite(ey)) continue;
    const r = maxHalfSpan + halfStroke;
    b = {
      minX: Math.min(b.minX, ex - r), minY: Math.min(b.minY, ey - r),
      maxX: Math.max(b.maxX, ex + r), maxY: Math.max(b.maxY, ey + r),
    };
  }
  return b;
}

/* ------------------------------------------------------ legacy sync bridge */

/** The synchronous scene build for exportSvg's legacy compose (harness
 *  measurers: DOM-free, deterministic). The scene body is fully synchronous
 *  once the fonts await is resolved — the ASYNC entry is a thin wrapper that
 *  awaits fonts and then calls this. Wires itself into exportSvg's legacy
 *  compose on FIRST call (the harness entry module is loaded before the
 *  first export runs). */
export function buildSceneSync(input: ExportInput): Scene {
  return syncScene(input);
}
const syncScene = (input: ExportInput): Scene => buildSceneBody(input);

/** The ASYNC app path (item 2): fonts settle BEFORE any measurement
 *  (spec §1's bounded await — the caller's ctx.awaitFonts), then the same
 *  synchronous body runs. */
export async function buildScene(input: ExportInput, ctx: BuildSceneCtx = {}): Promise<Scene> {
  if (ctx.awaitFonts) await ctx.awaitFonts();
  return buildSceneBody(input);
}
