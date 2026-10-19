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

/** A measured text block, relative to its node's top-left corner. */
export type TextRect = {
  x: number; y: number; w: number; h: number;
  size: number; weight: number; fill: string; anchor: string;
};

/** Injected measurements. `nodeEl`/`edgeEl` are the themed clone's live
 *  elements (typed `unknown` here so the module stays React/DOM-free); the
 *  harness stub ignores them and returns deterministic values. */
export type SvgMeasurer = {
  /** The node's text body box. Coordinates are relative to the node box. */
  text(nodeEl: unknown): TextRect | null;
  /** The edge's route, in the clone's own coordinate space. */
  edgePath(edgeEl: unknown): {d: string; midX: number; midY: number} | null;
  /** model position − clone-space position of a node's top-left corner.
   *  Constant across the clone, so edge routes translate into model space
   *  with ONE group transform (no path rewriting). */
  origin(nodeEl: unknown, node: ExportNode): {x: number; y: number} | null;
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
      const box = rel(el, body as Element);
      const titleEl = el.querySelector('.node-title') ?? el.querySelector('.lo-title');
      let size = 14.5, weight = 650, fill = '';
      if (titleEl) {
        const cs = getComputedStyle(titleEl);
        size = parseFloat(cs.fontSize) || size;
        weight = parseInt(cs.fontWeight, 10) || weight;
        fill = cs.color || '';
      }
      return {...box, size, weight, fill, anchor: 'start'};
    },
    edgePath(edgeEl) {
      const el = edgeEl as Element | null;
      if (!el || typeof el.querySelector !== 'function') return null;
      const p = el.querySelector('.react-flow__edge-path') ?? el.querySelector('path');
      if (!p) return null;
      const d = p.getAttribute('d');
      if (!d) return null;
      const b = p.getBoundingClientRect();
      return {d, midX: b.left + b.width / 2, midY: b.top + b.height / 2};
    },
    origin(nodeEl, node) {
      const el = nodeEl as Element | null;
      if (!el || typeof el.getBoundingClientRect !== 'function') return null;
      const b = el.getBoundingClientRect();
      return {x: node.position.x - b.left, y: node.position.y - b.top};
    },
  };
}

/* --------------------------------------------------------------- emitters */

const FONT_STACK = 'ui-monospace,Menlo,Consolas,monospace';

function tokenStyle(tokens: Record<string, string>): string {
  const lines = EXPORT_TOKENS
    .map(t => `    ${t}:${escAttr(tokens[t] ?? '')};`)
    .join('\n');
  return `<style>\n  :root, svg {\n${lines}\n  }\n  text { font-family: ${FONT_STACK}; }\n</style>`;
}

/** One `<text>` line with explicit paint attributes (crisp + selectable —
 *  the whole point of replacing the HTML clone). */
function textLine(
  x: number, y: number, content: string,
  o: {size: number; weight: number; fill: string; anchor?: string; spacing?: string; opacity?: string},
): string {
  const a = [
    `x="${x}"`, `y="${y}"`,
    `font-size="${o.size}"`, `font-weight="${o.weight}"`,
    `fill="${escAttr(o.fill)}"`, `font-family="${FONT_STACK}"`,
    o.anchor && o.anchor !== 'start' ? `text-anchor="${o.anchor}"` : '',
    o.spacing ? `letter-spacing="${o.spacing}"` : '',
    o.opacity ? `opacity="${o.opacity}"` : '',
  ].filter(Boolean).join(' ');
  return `<text ${a}>${esc(content)}</text>`;
}

/** The node's text block: kicker / title / sub / metric stacked inside the
 *  measured box. Title uses the measurer's dominant size/weight/fill. */
function nodeText(n: ExportNode, box: {w: number; h: number}, t: TextRect, fg: string, dim: string, accent: string): string {
  const d = (n.data ?? {}) as Record<string, unknown>;
  const title = String(d.title ?? d.label ?? n.id);
  const lines: string[] = [];
  let y = t.y + Math.min(t.size, t.h > 60 ? 16 : t.h * 0.3) + 4;
  const x = t.x;
  if (d.kicker && typeof d.kicker === 'string' && d.kicker !== title) {
    lines.push(textLine(x, y, d.kicker.toUpperCase(), {size: 9.5, weight: 500, fill: t.fill || dim, spacing: '1.1'}));
    y += 15;
  }
  lines.push(textLine(x, y, title, {size: t.size, weight: t.weight, fill: t.fill || fg}));
  if (d.sub && typeof d.sub === 'string') {
    y += Math.round(t.size * 1.35);
    lines.push(textLine(x, y, d.sub, {size: 11.5, weight: 450, fill: dim}));
  }
  if (d.metric && typeof d.metric === 'string') {
    y += 20;
    lines.push(textLine(x, y, d.metric + (d.metricUnit ? ` ${d.metricUnit}` : ''), {size: 20, weight: 700, fill: accent}));
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

/* -------------------------------------------------------------------- main */

export function exportSvg(input: ExportInput): string {
  const pad = input.pad ?? 24;
  const tokens = input.tokens;
  const nodes = input.nodes.filter(n => n && typeof n.id === 'string');
  const byId = new Map(nodes.map(n => [n.id, n]));
  const edges = input.edges.filter(e => e && byId.has(e.source) && byId.has(e.target));
  const ink = {
    fg: tokens['--fg'] || '#e8e8ea',
    dim: tokens['--dim'] || '#8a8a92',
    surface: tokens['--surface'] || '#141417',
    bg: tokens['--bg'] || '#0b0b0d',
  };

  /* content bounds → viewBox (same arithmetic as the PNG path) */
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const n of nodes) {
    const s = nodeSize(n);
    minX = Math.min(minX, n.position.x);
    minY = Math.min(minY, n.position.y);
    maxX = Math.max(maxX, n.position.x + s.w);
    maxY = Math.max(maxY, n.position.y + s.h);
  }
  if (!nodes.length) { minX = minY = 0; maxX = 800; maxY = 400; }
  const w = Math.ceil(maxX - minX) + pad * 2;
  const h = Math.ceil(maxY - minY) + pad * 2;
  const off = {x: pad - minX, y: pad - minY};

  /* Edge `d` coordinates are MODEL space in both paths (the DOM clone's
     React Flow routes use flow coordinates = model coordinates; the stub
     routes are computed from model positions). Only the label mid-point read
     off a live element comes back in rect space, so it is the one value that
     needs `origin` added before `off`. */
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
      b.minX = Math.min(b.minX, k.position.x); b.minY = Math.min(b.minY, k.position.y);
      b.maxX = Math.max(b.maxX, k.position.x + s.w); b.maxY = Math.max(b.maxY, k.position.y + s.h);
    }
    if (!kids.length) { const s = nodeSize(g); b = {minX: g.position.x, minY: g.position.y, maxX: g.position.x + s.w, maxY: g.position.y + s.h}; }
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

  /* ONE group transform puts clone-space edge routes into model space */
  let origin = {x: 0, y: 0};
  const firstWithEl = nodes.find(n => n.el);
  if (firstWithEl) {
    origin = input.measurer.origin(firstWithEl.el, firstWithEl) ?? origin;
  }

  for (const e of edges) {
    const s = byId.get(e.source)!;
    const t = byId.get(e.target)!;
    const color = resolveVar(resolveColor(e.data), tokens);
    const route = (e.el ? input.measurer.edgePath(e.el) : null) ?? stubEdgePath(e, s, t);
    /* a live rect-space mid-point needs the clone→model shift; a stub mid is
       already model space (`origin` = 0 there) */
    const mid = e.el
      ? {x: route.midX + origin.x + off.x, y: route.midY + origin.y + off.y}
      : {x: route.midX + off.x, y: route.midY + off.y};
    const marker = markerId(color);
    edgeParts.push(
      `<path d="${escAttr(route.d)}" fill="none" stroke="${escAttr(color)}" stroke-width="2" marker-end="url(#${marker})"/>`,
    );
    const label = e.data?.label ?? e.label;
    if (typeof label === 'string' && label) {
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
    nodeParts.push(`<g data-ar-node="${escAttr(n.id)}" transform="translate(${n.position.x + off.x},${n.position.y + off.y})">`);
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
      nodeParts.push(nodeText(n, s, nt ?? {x: 10, y: 8, w: s.w - 20, h: s.h - 16, size: 12, weight: 500, fill: ink.fg, anchor: 'start'}, ink.fg, ink.dim, accent));
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
      nodeParts.push(nodeText(n, s, t ?? {x: 13, y: s.h * 0.18, w: s.w * 0.72, h: s.h * 0.64, size: 14.5, weight: 650, fill: ink.fg, anchor: 'start'}, ink.fg, ink.dim, accent));
    }
    nodeParts.push('</g>');
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" data-theme="${escAttr(input.theme)}">` +
    `<rect width="${w}" height="${h}" fill="${escAttr(ink.bg)}"/>` +
    tokenStyle(tokens) +
    (defs.length ? `<defs>${defs.join('')}</defs>` : '') +
    groupParts.join('') +
    edgeParts.join('') +
    nodeParts.join('') +
    `</svg>`;
}

/** Model-space straight route when no live element exists (the harness path —
 *  deterministic, no DOM). */
function stubEdgePath(e: ExportEdge, s: ExportNode, t: ExportNode): {d: string; midX: number; midY: number} {
  const ss = nodeSize(s), ts = nodeSize(t);
  const x1 = s.position.x + ss.w / 2, y1 = s.position.y + ss.h / 2;
  const x2 = t.position.x + ts.w / 2, y2 = t.position.y + ts.h / 2;
  return {d: `M ${x1},${y1} L ${x2},${y2}`, midX: (x1 + x2) / 2, midY: (y1 + y2) / 2};
}

function hashStr(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return h;
}
