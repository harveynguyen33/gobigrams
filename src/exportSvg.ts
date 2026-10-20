/* ROUND AR, AR-1 — the SVG vector serializer.
 *
 * Replaces the old buildSvg output (HTML inside one <foreignObject>, which
 * paints NOTHING in image context — Quick Look, Figma, <img>, all showed a
 * bare background rect) with real SVG primitives derived from the node/edge
 * MODEL. Everything an image consumer rasterises is now literal
 * rect/path/ellipse/circle/text markup: no foreignObject, no external
 * references, no web fonts loaded by URL.
 *
 * React-free and pure: the module never touches the DOM itself. Everything
 * that needs live measurements comes in through an INJECTED measurer
 * (`domMeasurer()` below supplies a getComputedStyle-backed implementation
 * for the browser; the Node harness supplies a deterministic stub). That is
 * what makes `checks/round-ar-svg-export.mjs` possible without a DOM.
 *
 * Geometry single-source: shape frames come from `shapeFrameSvg` in
 * `src/shapes.tsx` — the SAME primitive table the live `ShapeFrame` renders.
 * Theme fidelity: the EXPORT_TOKENS block is inlined in a `<style>` element,
 * `data-theme="<theme>"` rides the root svg, and a theme switch changes the
 * output bytes because the resolved token values differ.
 */

import {resolveColor} from './colors';
import {asShape, shapeFrameSvg} from './shapes';
import {EXPORT_TOKENS} from './theme';
import {labelAnchor, type LabelPos} from './edgeLabel';

/** One measured text ROW's font — read off that row's own live element.
 *  AR-11: the canvas sets a DIFFERENT family per row (`.node-title` →
 *  `var(--sans)`, kicker/sub/metric → `var(--mono)`), so parity requires the
 *  emission and the wrap to use the ROW's font, not a file-wide one. */
export type RowFont = {
  family: string;
  size: number;
  weight: number;
  /** px, already normalised (`normal` → 0). */
  spacing: number;
};

/** A measured text block, relative to its node's top-left corner.
 *  AR-10 — `titleW` (when the measurer found a title element) is the TITLE's
 *  own content width — rect width minus its horizontal padding — which the
 *  live canvas wraps `.node-title` at. The exporter must wrap to THAT, not to
 *  the body width: for some node layouts the title sits wider than `.node-body`
 *  and wrapping to the body emitted one line too many. `spacing` is the
 *  title's computed letter-spacing, included in the measured advance.
 *  AR-11 — `family` is the TITLE row's computed family, `rows[k].family`
 *  each other row's, so the emitter paints every row in the typeface the
 *  canvas measured it in. */
export type TextRect = {
  x: number; y: number; w: number; h: number;
  size: number; weight: number; fill: string; anchor: string;
  titleW?: number; spacing?: number;
  /** AR-11 — the title row's computed font family (per-row parity). */
  family?: string;
  /** Per-row font overrides for the synthetic rows (kicker / sub / metric);
   *  a row without an entry keeps the exporter's legacy fixed metrics. */
  rows?: Partial<Record<'kicker' | 'sub' | 'metric', RowFont>>;
};

/** Injected measurements. `nodeEl`/`edgeEl` are the themed clone's live
 *  elements (typed `unknown` here so the module stays React/DOM-free); the
 *  harness stub ignores them and returns deterministic values. */
export type SvgMeasurer = {
  /** The node's text body box. Coordinates are relative to the node box. */
  text(nodeEl: unknown): TextRect | null;
  /** The edge's route. `d` is the path string; `start`/`end` are the route's
   *  ENDPOINTS in the path's own coordinate space — for both the live clone
   *  and the stub that is FLOW space (= absolute model space), so label
   *  anchors derived from them land where the canvas put the label. */
  edgePath(edgeEl: unknown): {
    d: string;
    start: {x: number; y: number};
    end: {x: number; y: number};
  } | null;
  /** DEFECT-2 — width of `text` in px under the SAME font metrics the
   *  emitter paints with (family, size, weight, letter-spacing). Optional:
   *  without it the wrap falls back to the monospace 0.6em estimator.
   *  AR-11 — `family` is the row's computed family (as the emitter writes it
   *  to the file); the wrap decision and the emission MUST use the same one. */
  measureText?(text: string, o: {size: number; weight: number; spacing?: number; family?: string}): number;
  /** AR-11 — the family unmeasured rows (edge labels, table cells, group
   *  titles) should inherit, when the measurer can supply one. Optional: the
   *  emitter omits the root `font-family` when this is absent. */
  defaultFamily?(): string | undefined;
  /** Frees any measurement scaffold (the DOM measurer's hidden <svg>). */
  dispose?(): void;
};

export type ExportNode = {
  id: string;
  type?: string;
  position: {x: number; y: number};
  measured?: {width?: number; height?: number} | null;
  style?: {width?: number | string; height?: number | string} | null;
  data?: Record<string, unknown> | null;
  parentId?: string | null;
  /** Live clone element for the browser measurer; undefined in the harness. */
  el?: unknown;
};

export type ExportEdge = {
  id: string;
  source: string;
  target: string;
  data?: Record<string, unknown> | null;
  markerEnd?: unknown;
  markerStart?: unknown;
  label?: string;
  el?: unknown;
};

export type ExportInput = {
  nodes: ExportNode[];
  edges: ExportEdge[];
  theme: string;
  /** Resolved EXPORT_TOKENS values for the chosen theme. */
  tokens: Record<string, string>;
  measurer: SvgMeasurer;
  /** Padding around the content bounds (the export modal's pngPad). */
  pad?: number;
};

/* ------------------------------------------------------------------ utils */

const esc = (s: unknown): string =>
  String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const escAttr = (s: unknown): string =>
  esc(s).replace(/"/g, '&quot;').replace(/'/g, '&#39;');

const num = (v: unknown): number | null =>
  typeof v === 'number' && isFinite(v) ? v : null;

/** `var(--x, fallback)` → the resolved token value (same fallback chain as
 *  the live render: token map first, then the var's own fallback). */
function resolveVar(value: string, tokens: Record<string, string>): string {
  const m = /^var\(\s*(--[A-Za-z0-9-]+)\s*(?:,\s*([^)]+))?\)$/.exec(value.trim());
  if (!m) return value;
  const fromMap = tokens[m[1]];
  if (fromMap) return fromMap;
  return m[2] ? m[2].trim() : value;
}

/** Node accent: the same `resolveColor` chain the canvas uses, resolved
 *  against the exported token set. */
function nodeColor(n: ExportNode, tokens: Record<string, string>): string {
  return resolveVar(resolveColor(n.data), tokens);
}

function nodeSize(n: ExportNode): {w: number; h: number} {
  const w = num(n.measured?.width) ?? num(n.style?.width as number | undefined) ?? 180;
  const h = num(n.measured?.height) ?? num(n.style?.height as number | undefined) ?? 90;
  return {w: Math.max(w, 4), h: Math.max(h, 4)};
}

/* ------------------------------------------------------------ measurer: DOM */

/** getComputedStyle-backed measurer for the live (themed, offscreen) clone.
 *  Text boxes are read relative to the node element, so they are directly
 *  usable inside the node's box. Never called at module load — the bundle is
 *  safe for the Node harness, which never imports this symbol's behaviour. */
export function domMeasurer(): SvgMeasurer {
  let measTextEl: SVGTextElement | null = null;
  const rel = (el: Element, inner: Element) => {
    const nb = el.getBoundingClientRect();
    const b = inner.getBoundingClientRect();
    return {x: b.left - nb.left, y: b.top - nb.top, w: b.width, h: b.height};
  };
  return {
    text(nodeEl) {
      const el = nodeEl as Element | null;
      if (!el || typeof el.querySelector !== 'function') return null;
      const body = el.querySelector('.node-body') ?? el.querySelector('.lo-wrap') ?? el;
      const titleEl = el.querySelector('.node-title') ?? el.querySelector('.lo-title');
      let size = 14.5, weight = 650, fill = '', spacing = 0, titleW: number | undefined;
      /* AR-11 — per-row font parity: each row's family is read off ITS OWN
         element's computed style (the canvas paints .node-title in var(--sans)
         and kicker/sub/metric in var(--mono)), then travels to the emitter so
         every emitted <text> is set in the typeface the measurement used. */
      const rowFont = (rowEl: Element | null): RowFont | undefined => {
        if (!rowEl) return undefined;
        const cs = getComputedStyle(rowEl);
        return {
          family: cs.fontFamily || '',
          size: parseFloat(cs.fontSize) || 0,
          weight: parseInt(cs.fontWeight, 10) || 0,
          spacing: cs.letterSpacing === 'normal' ? 0 : (parseFloat(cs.letterSpacing) || 0),
        };
      };
      const rows: TextRect['rows'] = {};
      const kickEl = el.querySelector('.node-kicker');
      const subEl = el.querySelector('.node-sub');
      const metricEl = el.querySelector('.node-metric');
      if (kickEl) rows.kicker = rowFont(kickEl);
      if (subEl) rows.sub = rowFont(subEl);
      if (metricEl) rows.metric = rowFont(metricEl);
      if (titleEl) {
        const cs = getComputedStyle(titleEl);
        size = parseFloat(cs.fontSize) || size;
        weight = parseInt(cs.fontWeight, 10) || weight;
        fill = cs.color || '';
        spacing = cs.letterSpacing === 'normal' ? 0 : (parseFloat(cs.letterSpacing) || 0);
        /* AR-10 — wrap to the TITLE's own content width (the canvas wraps
           .node-title at ITS box, which can be wider than .node-body), with
           the title's letter-spacing folded into the measured advance. */
        const padL = parseFloat(cs.paddingLeft) || 0;
        const padR = parseFloat(cs.paddingRight) || 0;
        titleW = Math.max(12, titleEl.getBoundingClientRect().width - padL - padR);
      }
      const box = rel(el, body as Element);
      return {...box, size, weight, fill, anchor: 'start', titleW, spacing,
        family: titleEl ? rowFont(titleEl)?.family : undefined, rows};
    },
    edgePath(edgeEl) {
      const el = edgeEl as Element | null;
      if (!el || typeof el.querySelector !== 'function') return null;
      const p = (el.querySelector('.react-flow__edge-path') ?? el.querySelector('path')) as SVGPathElement | null;
      if (!p) return null;
      const d = p.getAttribute('d');
      if (!d) return null;
      /* Flow-space endpoints read OFF THE PATH ITSELF: the clone's routes are
         drawn in flow coordinates (translate lives on an ancestor), so length
         0 and length N are the edge's absolute endpoints — exactly what the
         canvas's labelAnchor consumes. No getBoundingClientRect here: that was
         the DEFECT-1 bug (a viewport-space box centre is meaningless inside an
         offscreen themed clone). */
      let sx = 0, sy = 0, tx = 0, ty = 0;
      try {
        const total = p.getTotalLength();
        const a = p.getPointAtLength(0);
        const b = p.getPointAtLength(total);
        sx = a.x; sy = a.y; tx = b.x; ty = b.y;
      } catch {
        /* non-renderable path (display:none clone) — keep {0,0} ends, which
           makes the label fall back to the pathless anchor below */
      }
      return {d, start: {x: sx, y: sy}, end: {x: tx, y: ty}};
    },
    /* DEFECT-2 — real glyph widths via a hidden SVG <text> carrying the ROW's
       own font (family/size/weight/spacing — AR-11: the family comes IN with
       the row, never from a stack constant here), so the wrap decision is the
       decision the browser will itself re-derive when painting the file. */
    measureText(text, o) {
      try {
        if (!measTextEl) {
          const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg') as SVGSVGElement;
          svg.setAttribute('style', 'position:absolute;left:-99999px;top:0;width:0;height:0;overflow:hidden');
          measTextEl = document.createElementNS('http://www.w3.org/2000/svg', 'text') as SVGTextElement;
          svg.appendChild(measTextEl);
          document.body.appendChild(svg);
        }
        if (o.family) measTextEl.setAttribute('font-family', o.family);
        measTextEl.setAttribute('font-size', String(o.size));
        measTextEl.setAttribute('font-weight', String(o.weight));
        measTextEl.setAttribute('letter-spacing', String(o.spacing ?? 0));
        measTextEl.textContent = text;
        return measTextEl.getComputedTextLength();
      } catch {
        return text.length * o.size * 0.6 + Math.max(0, text.length - 1) * (o.spacing ?? 0);
      }
    },
    /* AR-11 — the family unmeasured rows inherit: the document body's own
       computed family is what the canvas falls back to for anything the
       clone carries no dedicated element for. */
    defaultFamily() {
      try { return getComputedStyle(document.body).fontFamily || undefined; }
      catch { return undefined; }
    },
    dispose() {
      try { (measTextEl?.parentNode ?? null)?.parentNode?.removeChild(measTextEl!.parentNode!); } catch { /* best effort */ }
      measTextEl = null;
    },
  };
}

/* ------------------------------------------------------- text wrapping (D2) */

/** Advance-width fallback when the injected measurer carries no
 *  `measureText` (the stub): 0.6em per glyph. Family-independent — the
 *  fallback estimates, it does not pin a typeface (AR-11). */
function estimateTextWidth(text: string, o: {size: number; spacing?: number}): number {
  return text.length * o.size * 0.6 + Math.max(0, text.length - 1) * (o.spacing ?? 0);
}

/** Pure greedy word wrap — DEFECT-2's whole mechanism.
 *
 *  Inputs: the text, the box it must fit, and a WIDTH FUNCTION. It knows
 *  nothing about SVG, nodes or the DOM, so the stub measurer drives it in the
 *  harness exactly as the browser's does in the app. `overflow-wrap:
 *  anywhere` semantics: break BETWEEN words first; a word wider than the box
 *  is hard-broken at the character that overflows rather than escaping the
 *  box (matching the `.node-title` CSS rule). */
export function wrapText(
  text: string,
  availableWidth: number,
  measure: (s: string) => number,
): string[] {
  const t = text.trim().replace(/\s+/g, ' ');
  if (!t || availableWidth <= 0) return [text];
  if (measure(t) <= availableWidth) return [t];

  const words = t.split(' ');
  const lines: string[] = [];
  let cur = '';
  for (const word of words) {
    const candidate = cur ? cur + ' ' + word : word;
    if (measure(candidate) <= availableWidth) { cur = candidate; continue; }
    if (cur) { lines.push(cur); cur = ''; }
    if (measure(word) <= availableWidth) { cur = word; continue; }
    /* single word too long: hard-break at the last fitting character */
    let piece = '';
    for (const ch of word) {
      if (piece && measure(piece + ch) > availableWidth) { lines.push(piece); piece = ch; }
      else piece += ch;
    }
    cur = piece;
  }
  if (cur) lines.push(cur);
  return lines;
}

/** Max lines a text row may occupy inside the node box — the exporter's twin
 *  of the live canvas' clip: `.node-body { overflow: hidden; max-height: 100% }`
 *  (src/styles.css) hides whatever overflows the body. Here the leftover
 *  height after the other rows converts into whole line slots; if the very
 *  first line does not fit either, ONE line is kept (the live box always
 *  shows its first line). */
function maxLinesFor(rowBudgetPx: number, lineHeightPx: number): number {
  if (lineHeightPx <= 0) return 1;
  return Math.max(1, Math.floor(rowBudgetPx / lineHeightPx));
}

function tokenStyle(tokens: Record<string, string>): string {
  const lines = EXPORT_TOKENS
    .map(t => `    ${t}:${escAttr(tokens[t] ?? '')};`)
    .join('\n');
  /* AR-11 — NO blanket `text { font-family: … }` rule here: every <text>
     carries its own measured font attributes (per-row parity). The block
     stays for the colour tokens only. (Should a glyph-identical fallback
     ever be needed for machines without the system font stacks, it belongs
     on the measurer side — the emitter never substitutes a family.) */
  return `<style>\n  :root, svg {\n${lines}\n  }\n</style>`;
}

/** One `<text>` line with explicit paint attributes (crisp + selectable —
 *  the whole point of replacing the HTML clone). AR-11 — `family` is the
 *  row's MEASURED family (never a constant); the root svg's inherited
 *  font-family covers rows emitted without one. */
function textLine(
  x: number, y: number, content: string,
  o: {size: number; weight: number; fill: string; anchor?: string; spacing?: string; opacity?: string; family?: string},
): string {
  const a = [
    `x="${x}"`, `y="${y}"`,
    `font-size="${o.size}"`, `font-weight="${o.weight}"`,
    `fill="${escAttr(o.fill)}"`,
    o.family ? `font-family="${escAttr(o.family)}"` : '',
    o.anchor && o.anchor !== 'start' ? `text-anchor="${o.anchor}"` : '',
    o.spacing ? `letter-spacing="${o.spacing}"` : '',
    o.opacity ? `opacity="${o.opacity}"` : '',
  ].filter(Boolean).join(' ');
  return `<text ${a}>${esc(content)}</text>`;
}

/** The node's text block: kicker / title / sub / metric stacked inside the
 *  measured box. Title uses the measurer's dominant size/weight/fill.
 *
 *  DEFECT-2 — the title WRAPS inside the box's content width (`.node-title`
 *  carries `overflow-wrap: anywhere` live) and is clamped to the body's
 *  leftover height (`.node-body { overflow: hidden; max-height: 100% }` live:
 *  lines that would not fit are clipped exactly as the browser clips them). */
function nodeText(
  n: ExportNode, box: {w: number; h: number}, t: TextRect, fg: string, dim: string, accent: string,
  widthOf: (s: string, o: {size: number; weight: number; spacing?: number; family?: string}) => number,
): string {
  const d = (n.data ?? {}) as Record<string, unknown>;
  const title = String(d.title ?? d.label ?? n.id);
  const lines: string[] = [];
  let y = t.y + Math.min(t.size, t.h > 60 ? 16 : t.h * 0.3) + 4;
  const x = t.x;
  const hasSub = d.sub && typeof d.sub === 'string';
  const hasMetric = d.metric && typeof d.metric === 'string';
  const hasKicker = d.kicker && typeof d.kicker === 'string' && d.kicker !== title;

  /* AR-11 — the row's own measured font, emitted verbatim on its <text>.
     A row the measurer reported no font for keeps the legacy fixed metrics
     and inherits the root's font-family. */
  const kickerFont = t.rows?.kicker;
  const subFont = t.rows?.sub;
  const metricFont = t.rows?.metric;
  const titleFamily = t.family || '';

  if (hasKicker) {
    lines.push(textLine(x, y, String(d.kicker).toUpperCase(), {
      size: kickerFont?.size ?? 9.5, weight: kickerFont?.weight ?? 500,
      fill: t.fill || dim, spacing: String(kickerFont?.spacing ?? 1.1),
      family: kickerFont?.family,
    }));
    y += 15;
  }

  /* wrap the title into the TITLE's content width when the measurer found a
     title element (AR-10 — the canvas wraps .node-title at its own box, which
     is wider than .node-body for some layouts); body width otherwise. AR-11 —
     the width function measures in the TITLE's own family, so the wrap
     decision is the one a consumer re-derives from the emitted file. */
  const availW = Math.max(12, t.titleW ?? t.w);
  const meas = (s: string) => widthOf(s, {size: t.size, weight: t.weight, spacing: t.spacing, family: titleFamily});
  const lineHeight = Math.round(t.size * 1.35);
  let wrapped = wrapText(title, availW, meas);
  /* … then clamp to the height the body has left (the CSS clip above). The
     budget only binds when ANOTHER row (sub / metric) needs the space below:
     `.node-body { max-height: 100% }` clips at the NODE box, and a title-only
     node with a small measured body still has the whole node to paint into —
     clipping it to a body stub would invent an ellipsis the canvas never
     draws. */
  const otherRows = (hasSub ? lineHeight : 0) + (hasMetric ? 20 : 0);
  if (t.h > 0 && otherRows > 0) {
    const budget = (t.y + t.h) - (y - lineHeight * 0.35);
    const maxLines = maxLinesFor(budget, lineHeight);
    if (wrapped.length > maxLines) wrapped = wrapped.slice(0, maxLines);
  }

  const titleBottomY = y + (wrapped.length - 1) * lineHeight;
  wrapped.forEach((ln, i) => {
    lines.push(textLine(x, y + i * lineHeight, ln, {
      size: t.size, weight: t.weight, fill: t.fill || fg, family: titleFamily,
      /* AR-11 — the title's computed letter-spacing rides the emitted rows:
         the wrap measured WITH it, so the file paints with it too. */
      spacing: t.spacing ? String(t.spacing) : undefined,
    }));
  });
  y = titleBottomY;

  if (hasSub) {
    y += lineHeight;
    lines.push(textLine(x, y, String(d.sub), {
      size: subFont?.size ?? 11.5, weight: subFont?.weight ?? 450,
      fill: dim, family: subFont?.family,
    }));
  }
  if (hasMetric) {
    y += 20;
    lines.push(textLine(x, y, String(d.metric) + (d.metricUnit ? ` ${d.metricUnit}` : ''), {
      size: metricFont?.size ?? 20, weight: metricFont?.weight ?? 700,
      fill: accent, family: metricFont?.family,
    }));
  }
  return lines.join('');
}

/** Post-it note: rect + folded corner + text (the POSTIT silhouette). */
function noteMarkup(s: {w: number; h: number}, surface: string, dim: string): string {
  return [
    `<rect x="1" y="1" width="${s.w - 2}" height="${s.h - 2}" rx="4" fill="${escAttr(surface)}" stroke="${escAttr(dim)}" stroke-width="1"/>`,
    `<path d="M${s.w - 16} 1 L${s.w - 1} 16 L${s.w - 1} 1 Z" fill="${escAttr(dim)}" opacity="0.25"/>`,
  ].join('');
}

/** ERD table: header band + colour strip + one row per visible column. */
function tableMarkup(n: ExportNode, s: {w: number; h: number}, accent: string, fg: string, dim: string): string {
  const d = (n.data ?? {}) as Record<string, unknown>;
  const cols: Array<Record<string, unknown> | string> = Array.isArray(d.columns) ? d.columns : [];
  const headerH = 24;
  const parts: string[] = [
    `<rect x="1" y="1" width="${s.w - 2}" height="${s.h - 2}" rx="6" fill="none" stroke="${escAttr(accent)}" stroke-width="1.5"/>`,
    `<rect x="1" y="1" width="${s.w - 2}" height="${headerH}" rx="6" fill="${escAttr(accent)}" fill-opacity="0.16"/>`,
    `<rect x="1" y="${headerH}" width="4" height="${Math.max(s.h - headerH - 2, 0)}" fill="${escAttr(accent)}"/>`,
    textLine(12, 17, String(d.name ?? d.title ?? n.id), {size: 12, weight: 650, fill: fg}),
  ];
  const rowH = cols.length ? Math.min(18, (s.h - headerH - 4) / cols.length) : 0;
  cols.forEach((c, i) => {
    const name = typeof c === 'string' ? c : String(c?.name ?? c?.label ?? '');
    if (!name) return;
    const y = headerH + 4 + rowH * i + rowH / 2 + 4;
    if (typeof c !== 'string' && (c.pk || c.isPrimary || c.primaryKey)) {
      parts.push(`<circle cx="8" cy="${y - 4}" r="2.4" fill="${escAttr(accent)}"/>`);
    }
    parts.push(textLine(16, y, name, {size: 10.5, weight: 450, fill: dim}));
  });
  return parts.join('');
}

/* ------------------------------------------------------------- edge label */

/** DEFECT-1 — the export's label anchor, ONE source with the canvas.
 *
 *  `labelAnchor` (src/edgeLabel.ts) is the app's whole parity claim: it
 *  reproduces the shipped GoblinEdge expression operation for operation and
 *  adds `labelOffset` only once `labelPinned` is set. This wrapper adapts the
 *  exporter's route to it: the source/target read from the PATH ITSELF
 *  (getPointAtLength 0 / total), `labelX`/`labelY` default to the endpoints'
 *  midpoint — which is exactly what GoblinEdge's straight/free/bezier
 *  generators hand back for a resting edge — and `offset` is the legacy
 *  3-slot fraction. Same function, same inputs' space (flow), same result. */
function edgeLabelAnchor(
  route: {start: {x: number; y: number}; end: {x: number; y: number}},
  d: Record<string, unknown>,
): {x: number; y: number} {
  return labelAnchor({
    sourceX: route.start.x, sourceY: route.start.y,
    targetX: route.end.x, targetY: route.end.y,
    labelX: (route.start.x + route.end.x) / 2,
    labelY: (route.start.y + route.end.y) / 2,
    offset: (typeof d.offset === 'string' ? d.offset : undefined) as LabelPos | undefined,
    labelOffset: (d.labelOffset ?? undefined) as {x: number; y: number} | undefined,
    labelPinned: d.labelPinned === true,
  });
}

/* -------------------------------------------------- absolute positions (D3) */

/** DEFECT-3 — absolute (flow) position of a node, resolving the `parentId`
 *  chain. React Flow stores a CHILD's `position` RELATIVE TO ITS PARENT; the
 *  exporter used to consume it raw, so a grouped child exported at its
 *  relative offset (the app's own AQ11 ~250 px teleport, paid again). Pure,
 *  no DOM; a missing parent or a cycle terminates (the `guard` set) instead
 *  of hanging — same shape as `absPos` in src/App.tsx. */
function absPosition(n: ExportNode, byId: Map<string, ExportNode>): {x: number; y: number} {
  let x = n.position.x, y = n.position.y;
  let pid = n.parentId ?? null;
  const guard = new Set<string>();
  while (pid && !guard.has(pid)) {
    guard.add(pid);
    const p = byId.get(pid);
    if (!p) break; /* dangling parent id: keep what we have */
    x += p.position.x; y += p.position.y;
    pid = p.parentId ?? null;
  }
  return {x, y};
}

/* -------------------------------------------------------------------- main */

export function exportSvg(input: ExportInput): string {
  const pad = input.pad ?? 24;
  const tokens = input.tokens;
  const measurer = input.measurer;
  const nodes = input.nodes.filter(n => n && typeof n.id === 'string');
  const byId = new Map(nodes.map(n => [n.id, n]));
  const edges = input.edges.filter(e => e && byId.has(e.source) && byId.has(e.target));
  /* DEFECT-3 — every geometry use below consumes the ABSOLUTE position
     (parentId chain resolved), never the stored relative `position`. */
  const abs = new Map(nodes.map(n => [n.id, absPosition(n, byId)]));
  /* DEFECT-2 — one width function for every wrap: the injected measurer when
     it can really measure, the glyph-count estimator otherwise. AR-11: the
     row family rides along so the wrap measures in the SAME family the
     emitter writes to the file. */
  const widthOf: (s: string, o: {size: number; weight: number; spacing?: number; family?: string}) => number =
    measurer.measureText
      ? (s, o) => measurer.measureText!(s, o)
      : (s, o) => estimateTextWidth(s, o);
  /* AR-11 — the family unmeasured rows (edge labels, table cells, group
     titles, legacy textLine calls) inherit, supplied by the measurer; the
     attribute is omitted entirely when it has none to give. */
  const inheritFamily = measurer.defaultFamily?.() ?? '';
  const ink = {
    fg: tokens['--fg'] || '#e8e8ea',
    dim: tokens['--dim'] || '#8a8a92',
    surface: tokens['--surface'] || '#141417',
    bg: tokens['--bg'] || '#0b0b0d',
  };

  /* content bounds → viewBox (same arithmetic as the PNG path); D3: absolute */
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const n of nodes) {
    const s = nodeSize(n);
    const p = abs.get(n.id)!;
    minX = Math.min(minX, p.x);
    minY = Math.min(minY, p.y);
    maxX = Math.max(maxX, p.x + s.w);
    maxY = Math.max(maxY, p.y + s.h);
  }
  if (!nodes.length) { minX = minY = 0; maxX = 800; maxY = 400; }
  const w = Math.ceil(maxX - minX) + pad * 2;
  const h = Math.ceil(maxY - minY) + pad * 2;
  const off = {x: pad - minX, y: pad - minY};

  /* Edge `d` coordinates are MODEL space in both paths (the DOM clone's
     React Flow routes use flow coordinates = absolute model coordinates, and
     the stub routes are computed from absolute positions). Labels derive from
     the SAME coordinates — see `edgeLabelAnchor` below. */
  const edgeParts: string[] = [`<g transform="translate(${off.x},${off.y})">`];
  const defs: string[] = [];
  const markerId = (color: string): string => {
    const id = 'ar-mk-' + Math.abs(hashStr(color)).toString(36);
    if (!defs.some(d => d.includes(`id="${id}"`))) {
      defs.push(
        `<marker id="${id}" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">` +
        `<path d="M0 0 L10 5 L0 10 Z" fill="${escAttr(color)}"/></marker>`,
      );
    }
    return id;
  };

  /* groups / boundaries FIRST (behind everything), then edges, then nodes —
     the canvas' own z-order. */
  const isGroup = (n: ExportNode) => asShape(n.data?.shape) === 'group';
  const groupParts: string[] = [];
  for (const g of nodes.filter(isGroup)) {
    const kids = nodes.filter(n => n.parentId === g.id && !isGroup(n));
    let b = {minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity};
    for (const k of kids) {
      const s = nodeSize(k);
      const p = abs.get(k.id)!; /* D3: child bounds in ABSOLUTE space */
      b.minX = Math.min(b.minX, p.x); b.minY = Math.min(b.minY, p.y);
      b.maxX = Math.max(b.maxX, p.x + s.w); b.maxY = Math.max(b.maxY, p.y + s.h);
    }
    if (!kids.length) { const s = nodeSize(g); const p = abs.get(g.id)!; b = {minX: p.x, minY: p.y, maxX: p.x + s.w, maxY: p.y + s.h}; }
    /* model space here: the off group translate already carries `off` */
    const left = b.minX + off.x - 12, top = b.minY + off.y - 12;
    const lw = (b.maxX - b.minX) + 24, lh = (b.maxY - b.minY) + 24;
    groupParts.push(
      `<g data-ar-node="${escAttr(g.id)}" transform="translate(${left},${top})">`,
    );
    groupParts.push(
      `<rect x="0" y="0" width="${lw}" height="${lh}" rx="10" fill="none" stroke="${escAttr(nodeColor(g, tokens))}" stroke-width="1.2" stroke-dasharray="8 5"/>`,
    );
    const gt = input.measurer.text(g.el);
    const title = String(g.data?.title ?? g.id);
    groupParts.push(textLine(10, 14, title, {size: 10.5, weight: 550, fill: gt?.fill || ink.dim, spacing: '1'}));
    groupParts.push('</g>');
  }

  /* DEFECT-1 removed the clone→model `origin` shift: labels now derive from
     the edge route's own flow-space endpoints, not from any clone-space rect. */

  for (const e of edges) {
    const s = byId.get(e.source)!;
    const t = byId.get(e.target)!;
    const color = resolveVar(resolveColor(e.data), tokens);
    const route = (e.el ? input.measurer.edgePath(e.el) : null) ?? stubEdgePath(e, s, t, abs);
    const marker = markerId(color);
    edgeParts.push(
      `<path d="${escAttr(route.d)}" fill="none" stroke="${escAttr(color)}" stroke-width="2" marker-end="url(#${marker})"/>`,
    );
    const label = e.data?.label ?? e.label;
    if (typeof label === 'string' && label) {
      /* DEFECT-1: the label anchor is the app's own parity function
         (`labelAnchor`), fed the edge's FLOW-space path endpoints — the same
         expression GoblinEdge.tsx paints with, so export matches canvas.
         `midX`/`midY` used to be a viewport-space bounding-rect centre (both
         wrong space and wrong point on a diagonal). Degenerate ends ({0,0}
         both — a path the clone could not measure) fall back to the stub's
         geometric centre so the label never vanishes. */
      const degenerate = route.start.x === 0 && route.start.y === 0 && route.end.x === 0 && route.end.y === 0;
      const d = (e.data ?? {}) as Record<string, unknown>;
      const L = degenerate
        ? {x: (abs.get(s.id)!.x + abs.get(t.id)!.x + nodeSize(s).w - nodeSize(t).w) / 2,
           y: (abs.get(s.id)!.y + abs.get(t.id)!.y + nodeSize(s).h - nodeSize(t).h) / 2}
        : edgeLabelAnchor(route, d);
      const mid = {x: L.x + off.x, y: L.y + off.y};
      const lw = Math.max(24, label.length * 6.6 + 12);
      edgeParts.push(
        `<rect x="${mid.x - lw / 2}" y="${mid.y - 9}" width="${lw}" height="18" rx="4" fill="${escAttr(ink.surface)}" stroke="${escAttr(ink.dim)}" stroke-width="0.8"/>`,
        textLine(mid.x - lw / 2 + 6, mid.y + 4, label, {size: 10.5, weight: 500, fill: ink.dim}),
      );
    }
  }
  edgeParts.push('</g>');

  const nodeParts: string[] = [];
  for (const n of nodes) {
    if (isGroup(n)) continue;
    const s = nodeSize(n);
    const accent = nodeColor(n, tokens);
    const type = n.type ?? (n.data?.columns ? 'table' : 'goblin');
    const p = abs.get(n.id)!; /* D3: absolute, so a grouped child lands at parent+relative */
    nodeParts.push(`<g data-ar-node="${escAttr(n.id)}" transform="translate(${p.x + off.x},${p.y + off.y})">`);
    if (type === 'label') {
      const lt = input.measurer.text(n.el);
      const title = String(n.data?.title ?? n.id);
      nodeParts.push(textLine(s.w / 2, lt ? lt.y + lt.size + 4 : s.h / 2, title, {
        size: lt?.size ?? 14.5, weight: lt?.weight ?? 650, fill: lt?.fill || ink.fg, anchor: 'middle',
      }));
      if (n.data?.sub) {
        nodeParts.push(textLine(s.w / 2, (lt ? lt.y + lt.size + 4 : s.h / 2) + 18, String(n.data.sub), {
          size: 11.5, weight: 450, fill: ink.dim, anchor: 'middle',
        }));
      }
    } else if (type === 'customshape') {
      const svg = typeof n.data?.svg === 'string' && n.data.svg ? n.data.svg : '';
      nodeParts.push(
        svg
          ? `<g transform="scale(${s.w / 200},${s.h / 100})">${svg}</g>`
          : `<rect x="1" y="1" width="${s.w - 2}" height="${s.h - 2}" rx="6" fill="none" stroke="${escAttr(accent)}" stroke-width="1.5"/>`,
      );
    } else if (asShape(n.data?.shape) === 'note') {
      nodeParts.push(noteMarkup(s, ink.surface, ink.dim));
      const nt = input.measurer.text(n.el);
      nodeParts.push(nodeText(n, s, nt ?? {x: 10, y: 8, w: s.w - 20, h: s.h - 16, size: 12, weight: 500, fill: ink.fg, anchor: 'start'}, ink.fg, ink.dim, accent, widthOf));
    } else if (type === 'table') {
      nodeParts.push(tableMarkup(n, s, accent, ink.fg, ink.dim));
    } else {
      /* goblin: the ShapeFrame geometry, ONE source (src/shapes.tsx) */
      nodeParts.push(
        `<svg x="0" y="0" width="${s.w}" height="${s.h}" viewBox="0 0 200 100" preserveAspectRatio="none">` +
        shapeFrameSvg(asShape(n.data?.shape), {fill: accent, stroke: accent, fillOpacity: '0.09', plain: n.data?.plainCylinder !== false}) +
        `</svg>`,
      );
      const t = input.measurer.text(n.el);
      nodeParts.push(nodeText(n, s, t ?? {x: 13, y: s.h * 0.18, w: s.w * 0.72, h: s.h * 0.64, size: 14.5, weight: 650, fill: ink.fg, anchor: 'start'}, ink.fg, ink.dim, accent, widthOf));
    }
    nodeParts.push('</g>');
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" data-theme="${escAttr(input.theme)}"` +
    /* AR-11 — unmeasured rows (edge labels, table cells, group titles)
       inherit this; measured rows carry their own family attributes. */
    (inheritFamily ? ` font-family="${escAttr(inheritFamily)}"` : '') + `>` +
    `<rect width="${w}" height="${h}" fill="${escAttr(ink.bg)}"/>` +
    tokenStyle(tokens) +
    (defs.length ? `<defs>${defs.join('')}</defs>` : '') +
    groupParts.join('') +
    edgeParts.join('') +
    nodeParts.join('') +
    `</svg>`;
}

/** Model-space straight route when no live element exists (the harness path —
 *  deterministic, no DOM). Endpoints are the boxes' ABSOLUTE flow-space
 *  centres (D3: through the parentId chain), the same anchors React Flow
 *  hands the canvas edge. */
function stubEdgePath(e: ExportEdge, s: ExportNode, t: ExportNode,
  abs: Map<string, {x: number; y: number}>): {
  d: string; start: {x: number; y: number}; end: {x: number; y: number};
} {
  const ss = nodeSize(s), ts = nodeSize(t);
  const sp = abs.get(s.id)!, tp = abs.get(t.id)!;
  const x1 = sp.x + ss.w / 2, y1 = sp.y + ss.h / 2;
  const x2 = tp.x + ts.w / 2, y2 = tp.y + ts.h / 2;
  return {d: `M ${x1},${y1} L ${x2},${y2}`, start: {x: x1, y: y1}, end: {x: x2, y: y2}};
}

function hashStr(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return h;
}
