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

import {resolveColor} from '../colors';
import {asShape} from '../nodes/shapes';
import {rotatedExtent} from '../rotation';
import {labelAnchor, type LabelPos} from '../edgeLabel';
import {
  type ExportNode, type ExportEdge, type ExportInput,
  type TextRect,
} from './exportSvg';
import {getTextMetrics, getTextAscent, type TextWidthFn, type TextAscentFn} from '../textMetrics';

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
  label?: {x: number; y: number; row: SceneTextRow};
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
void cachedWrap;

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
  const runOf = (row: 'kicker' | 'title' | 'sub' | 'metric'): number =>
    t.runs?.[row]?.x ?? xRow;
  const topOf = (row: 'kicker' | 'sub' | 'metric', legacyOffset: number): number => {
    const bt = t.baselineTops?.[row];
    return bt ? bt.top + bt.ascent : yTitleStart + legacyOffset;
  };
  let y = yTitleStart;
  const hasSub = d.sub && typeof d.sub === 'string';
  const hasMetric = d.metric && typeof d.metric === 'string';
  const hasKicker = d.kicker && typeof d.kicker === 'string' && d.kicker !== title;

  const kickerFont = t.rows?.kicker;
  const subFont = t.rows?.sub;
  const metricFont = t.rows?.metric;
  const titleFamily = t.family || '';

  if (hasKicker) {
    const yKick = t.baselineTops?.kicker
      ? t.baselineTops.kicker.top + t.baselineTops.kicker.ascent
      : yTitleStart - 15;
    rows.push({
      x: runOf('kicker'), baselineY: yKick, content: String(d.kicker).toUpperCase(),
      size: kickerFont?.size ?? 9.5, weight: kickerFont?.weight ?? 500,
      fill: t.fill || ink.dim, spacing: kickerFont?.spacing ?? 1.1,
      family: kickerFont?.family,
    });
    y = Math.max(y, yKick + 15);
  }

  const availW = Math.max(12, t.titleW ?? t.w);
  const {lines: wrapped, ascent: titleAscent} = cachedWrap(
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

  /* the cached ascent only bakes when the measurer did NOT supply the row's
   * own measured ascent (the AX baselineTops) — the measured one wins, the
   * cache fills the gap for stub measurers and the legacy stack. */
  const bake = (top: {top: number; ascent: number} | undefined, fallbackY: number): number =>
    top ? top.top + top.ascent : fallbackY + titleAscent * 0;

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
  void bake;

  if (hasSub) {
    y = topOf('sub', lineHeight);
    rows.push({
      x: runOf('sub'), baselineY: y, content: String(d.sub),
      size: subFont?.size ?? 11.5, weight: subFont?.weight ?? 450,
      fill: ink.dim, family: subFont?.family,
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
  return rows;
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
  void tokens;

  const ink = {
    fg: tokens['--fg'] || '#e8e8ea',
    dim: tokens['--dim'] || '#8a8a92',
    surface: tokens['--surface'] || '#141417',
    bg: tokens['--bg'] || '#0b0b0d',
  };

  const isGroup = (n: ExportNode) => asShape(n.data?.shape) === 'group';

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
      /* group children bounds (absolute space) — the ±12 frame inflation is
       * painted geometry, applied by the EMITTER exactly as today */
      const kids = nodes.filter(k => k.parentId === n.id && !isGroup(k));
      let b = {minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity};
      for (const k of kids) {
        const ks = nodeSize(k);
        const kp = abs.get(k.id)!;
        b.minX = Math.min(b.minX, kp.x); b.minY = Math.min(b.minY, kp.y);
        b.maxX = Math.max(b.maxX, kp.x + ks.w); b.maxY = Math.max(b.maxY, kp.y + ks.h);
      }
      if (!kids.length) b = {minX: p.x, minY: p.y, maxX: p.x + s.w, maxY: p.y + s.h};
      (sn as SceneNode & {childBounds: typeof b}).childBounds = b;
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
        ? buildNodeRows(n, s, noteText, {fg: ink.fg, dim: ink.dim}, accent, widthOf, ascentOf)
        : buildNodeRows(n, s, {x: 10, y: 8, w: s.w - 20, h: s.h - 16, size: 12, weight: 500, fill: ink.fg, anchor: 'start'},
            {fg: ink.fg, dim: ink.dim}, accent, widthOf, ascentOf);
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
    const t = measurer.text(n.el);
    sn.textRect = t ?? null;
    sn.rows = buildNodeRows(n, s,
      t ?? {x: 13, y: s.h * 0.18, w: s.w * 0.72, h: s.h * 0.64, size: 14.5, weight: 650, fill: ink.fg, anchor: 'start'},
      {fg: ink.fg, dim: ink.dim}, accent, widthOf, ascentOf);
    sceneNodes.push(sn);
  }

  /* ---- edges */
  const sceneEdges: SceneEdge[] = [];
  for (const e of edges) {
    const src = byId.get(e.source)!;
    const tgt = byId.get(e.target)!;
    const color = resolveVar(resolveColor(e.data), tokens);
    const route = (e.el ? measurer.edgePath(e.el) : null) ?? stubEdgePath(e, src, tgt, abs);
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
        ?? (measurer.defaultFamily ? {family: measurer.defaultFamily('mono'), size: 10.5, weight: 500, spacing: 0} : undefined);
      se.label = {
        x: L.x, y: L.y,
        row: {
          x: 0, baselineY: 4, content: label,
          size: lf?.size ?? 10.5, weight: lf?.weight ?? 500,
          fill: ink.dim, family: lf?.family,
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
