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
 * `src/nodes/shapes.tsx` — the SAME primitive table the live `ShapeFrame` renders.
 * Theme fidelity: the EXPORT_TOKENS block is inlined in a `<style>` element,
 * `data-theme="<theme>"` rides the root svg, and a theme switch changes the
 * output bytes because the resolved token values differ.
 */

import {resolveColor} from '../colors';
import {asShape, shapeFrameSvg} from '../nodes/shapes';
import {EXPORT_TOKENS} from '../theme';
import {labelAnchor, type LabelPos} from '../edgeLabel';
import {rotateSvgTransform} from '../rotation';
import {buildSceneSync as sceneSync, type Scene, type SceneNode, type SceneTextRow, type Bounds} from './exportScene';
import {shapeLineToSvg, type OutlineShaper} from './textOutline';

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
  /** ROUND AR-2 — 'note' when the measurer actually found and measured a
   *  `.note-title`. The emitter keys its note-row fallback (the row's token
   *  family, applied VISIBLY) off the absence of a measured family, and
   *  this kind documents that the block came from a note element. */
  kind?: 'note';
  /** Per-row font overrides for the synthetic rows (kicker / sub / metric /
   *  table columns / group title);
   *  a row without an entry keeps the exporter's legacy fixed metrics. */
  rows?: Partial<Record<'kicker' | 'sub' | 'metric' | 'tcol' | 'groupTitle', RowFont>>;
  /** ROUND AX (t_17334591) — MEASURED per-row geometry, node-relative px.
   *  `runs[row].x` is the TEXT RUN's own left edge (past the icon + gap on
   *  the title row — the canvas's flex layout), NOT the row container's:
   *  emitting the container x painted the 17px glyph over the word. When a
   *  run x is absent the row keeps the container x (icon-less rows). */
  runs?: Partial<Record<'kicker' | 'title' | 'sub' | 'metric', {x: number}>>;
  /** ROUND AX — measured row-rect tops + the ascent of that row's font, so
   *  each baseline is `top + ascent` (the canvas row model) instead of the
   *  legacy fixed row pitch that drifts on every node whose rows differ. */
  baselineTops?: Partial<Record<'kicker' | 'title' | 'sub' | 'metric', {top: number; ascent: number}>>;
};

/** Injected measurements. `nodeEl`/`edgeEl` are the themed clone's live
 *  elements (typed `unknown` here so the module stays React/DOM-free); the
 *  harness stub ignores them and returns deterministic values. */
export type SvgMeasurer = {
  /** ROUND AV — the node's ICON glyph (`.node-ico svg`): geometry relative
   *  to the node box, its viewBox, the pre-parsed lucide primitives, and the
   *  RESOLVED ink (stroke/fill/stroke-width) — the accent the canvas paints.
   *  The exporter lifts the primitives verbatim into the file so the icon is
   *  real vector art in the node's own colour. Optional: a harness stub or a
   *  node without an icon returns null and the exporter emits no icon. */
  icon?(nodeEl: unknown): {
    x: number; y: number; w: number; h: number;
    viewBox: string;
    primitives: Array<{tag: string; attrs: Record<string, string>}>;
    stroke: string; strokeWidth: number; fill: string;
  } | null;
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
  /** ROUND-AR-DEFECT-1 — the computed font of the edge's own LABEL row.
   *  `.edge-label` is NOT inside `.react-flow__edge`: React Flow's
   *  `EdgeLabelRenderer` portals it into `.react-flow__edgelabel-renderer`
   *  (a sibling of the edge SVGs), so the measurer must reach it through the
   *  CLONE ROOT by `data-edge-id`. Optional — a harness stub that cannot
   *  supply one simply leaves the emitter's legacy metrics in place. */
  edgeLabelFont?(edgeId: string): RowFont | undefined;
  /** DEFECT-2 — width of `text` in px under the SAME font metrics the
   *  emitter paints with (family, size, weight, letter-spacing). Optional:
   *  without it the wrap falls back to the monospace 0.6em estimator.
   *  AR-11 — `family` is the row's computed family (as the emitter writes it
   *  to the file); the wrap decision and the emission MUST use the same one. */
  measureText?(text: string, o: {size: number; weight: number; spacing?: number; family?: string}): number;
  /** AR-11 — the family unmeasured rows (edge labels, table cells, group
   *  titles) should inherit, when the measurer can supply one. Optional: the
   *  emitter omits the root `font-family` when this is absent.
   *  ROUND AR-2 — `kind` names the ROW's own token family ('mono' | 'sans');
   *  the emitter calls it per UNMEASURED row so a missing element resolves
   *  to the family the canvas paints that row in — a visible decision, not
   *  a silent naked-metrics fallback. */
  defaultFamily?(kind?: 'mono' | 'sans'): string | undefined;
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
  /** GOBI-CONNECT — the handle ids the edge was created with (`'left'|'right'|
   *  'top'|'bottom'` for a goblin node; compound ERD column ids otherwise).
   *  The headless route (`edgeRoute`) rebuilds the canvas's anchors from them;
   *  absent/unknown falls back to the stub. */
  sourceHandle?: string | null; targetHandle?: string | null;
  data?: Record<string, unknown> | null;
  markerEnd?: unknown;
  markerStart?: unknown;
  /** ROUND AR-2 — THE label storage. The canvas paints exactly this field
   *  (`GoblinEdge`'s `shown`); the exporter reads it and nothing else, so a
   *  label row exists in the file if and only if the canvas painted one. */
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
  /** ROUND C — outline mode: the pre-built shapers ride the input so the
   *  legacy compose (buildScene + emitSvg) can thread them into EmitCtx. */
  outline?: EmitCtx['outline'];
  /** ROUND AZ — the embedded-font CSS (base64 woff2 @font-face), threaded
   *  into EmitCtx so emitSvg inlines it in <defs><style>. */
  fontEmbedCss?: string;
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

/** getComputedStyle → RowFont for one live element. Module-level so both the
 *  node measurer (`text`) and `edgeLabelFont` share the exact same read —
 *  ROUND-AR-DEFECT-1: every measured row goes through ONE font reader. */
function rowFontOf(rowEl: Element): RowFont | undefined {
  try {
    const cs = getComputedStyle(rowEl);
    return {
      family: cs.fontFamily || '',
      size: parseFloat(cs.fontSize) || 0,
      weight: parseInt(cs.fontWeight, 10) || 0,
      spacing: cs.letterSpacing === 'normal' ? 0 : (parseFloat(cs.letterSpacing) || 0),
    };
  } catch {
    return undefined;
  }
}

/** getComputedStyle-backed measurer for the live (themed, offscreen) clone.
 *  Text boxes are read relative to the node element, so they are directly
 *  usable inside the node's box. Never called at module load — the bundle is
 *  safe for the Node harness, which never imports this symbol's behaviour.
 *  `root` (optional) hands the measurer the clone's viewport element so it
 *  can reach rows that live OUTSIDE an edge's own element (the
 *  `EdgeLabelRenderer` portal: `.edge-label[data-edge-id]`). */
export function domMeasurer(root?: () => unknown): SvgMeasurer {
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
      /* ROUND AR-2 — a NOTE node's title lives in `.note-title` (DOM:
         `.note-node > .note-body > .note-title`); there is no `.node-title`
         on a note, so before this the measurer reported its 14.5/650
         no-family fallback for every note title while the canvas paints
         `.note-title` at its own computed font (13px/650 mono live). */
      const isNote = !!el.querySelector('.note-title');
      const body = el.querySelector('.node-body') ?? el.querySelector('.note-body') ?? el.querySelector('.lo-wrap') ?? el;
      const titleEl = el.querySelector('.node-title') ?? el.querySelector('.lo-title') ?? el.querySelector('.note-title');
      let size = 14.5, weight = 650, fill = '', spacing = 0, titleW: number | undefined;
      /* AR-11 — per-row font parity: each row's family is read off ITS OWN
         element's computed style (the canvas paints .node-title in var(--sans)
         and kicker/sub/metric in var(--mono)), then travels to the emitter so
         every emitted <text> is set in the typeface the measurement used.
         ROUND-AR-DEFECT-1: the read itself is the shared `rowFontOf`. */
      const rowFont = (rowEl: Element | null): RowFont | undefined =>
        rowEl ? rowFontOf(rowEl) : undefined;
      const rows: TextRect['rows'] = {};
      const kickEl = el.querySelector('.node-kicker');
      const subEl = el.querySelector('.node-sub');
      const metricEl = el.querySelector('.node-metric');
      if (kickEl) rows.kicker = rowFont(kickEl);
      if (subEl) rows.sub = rowFont(subEl);
      if (metricEl) rows.metric = rowFont(metricEl);
      /* ROUND-AR-DEFECT-1 — the two remaining MEASURED node rows: an ERD
         table's column names (`.tnode-cname`) and a group's floating title
         (`.group-label`). Each is read off its OWN element so the emitter
         paints it in the typeface the canvas measured, exactly as AR-11 did
         for kicker/sub/metric. Columns share one row entry (they all carry
         the same computed font); a group without a label element falls back
         to the legacy fixed metrics. */
      const tcolEl = el.querySelector('.tnode-cname');
      if (tcolEl) rows.tcol = rowFont(tcolEl);
      const groupTitleEl = el.querySelector('.group-label');
      if (groupTitleEl) rows.groupTitle = rowFont(groupTitleEl);
      /* ROUND AX (t_17334591) — the MEASURED text-run x per row. The title
         row is `.node-title` (flex): icon first, then the text span — the
         ROW's box left edge is the icon's, not the text's. A Range over the
         title's own text gives the text run's client rect; converted
         node-relative here so the emitter can start the glyphs PAST the icon
         (iconX + iconW + gap, measured — never assumed). Rows without a
         dedicated text element (kicker/sub/metric) are their own run: their
         box left edge IS the text's left edge.
         LIVE-FIX: the title text lives in a child `<span>`
         (DiagramNode renders `<span>{d.title}</span>`), so the text-node
         probe walks the row's ELEMENT descendants too — the first
         text-bearing descendant that is not the icon. */
      const runXOf = (rowEl: Element | null): number | undefined => {
        try {
          if (!rowEl) return undefined;
          const nodeLeft = el.getBoundingClientRect().left;
          const rangeLeft = (target: Text | Element): number | undefined => {
            const r = document.createRange();
            r.selectNodeContents(target);
            const rects = r.getClientRects();
            const first = rects.length ? rects[0] : null;
            if (first && first.width > 0) return first.left - nodeLeft;
            return undefined;
          };
          const direct = [...rowEl.childNodes].find(
            (c): c is Text => c.nodeType === Node.TEXT_NODE && !!(c.textContent ?? '').trim());
          if (direct) { const x = rangeLeft(direct); if (x !== undefined) return x; }
          const desc = [...rowEl.querySelectorAll('*')].find(e =>
            !e.classList.contains('node-ico') && !e.closest('.node-ico') &&
            !!(e.textContent ?? '').trim() &&
            [...e.childNodes].some(c => c.nodeType === Node.TEXT_NODE && !!(c.textContent ?? '').trim()));
          if (desc) { const x = rangeLeft(desc); if (x !== undefined) return x; }
          return rowEl.getBoundingClientRect().left - nodeLeft;
        } catch { return undefined; }
      };
      const runs: TextRect['runs'] = {
        kicker: kickEl ? {x: runXOf(kickEl)} : undefined,
        title: titleEl ? {x: runXOf(titleEl)} : undefined,
        sub: subEl ? {x: runXOf(subEl)} : undefined,
        metric: metricEl ? {x: runXOf(metricEl)} : undefined,
      };
      /* ROUND AX — the MEASURED row tops + each row-font's ascent: the canvas
         stacks rows at their own rect tops (pitch 17 then 23 on the defect
         card's node — NOT a fixed pitch). `top` is the row rect's top edge
         node-relative; `ascent` is the font's ascent read off the SAME
         element the baseline hangs from (fontBoundingBoxAscent of the row's
         computed font, sized by that row's font-size — not the title's). */
      const ascentOf = (font: RowFont | undefined): number => {
        try {
          const c = document.createElement('canvas').getContext('2d');
          if (!c) return 0;
          const size = font?.size ?? 14.5;
          const weight = font?.weight ?? 650;
          const family = font?.family || getComputedStyle(document.body).fontFamily || 'sans-serif';
          c.font = `${weight} ${size}px ${family}`;
          const m = c.measureText('Mg');
          return m.fontBoundingBoxAscent || m.actualBoundingBoxAscent || size * 0.78;
        } catch { return 0; }
      };
      const topOf = (rowEl: Element | null): number | undefined => {
        try {
          if (!rowEl) return undefined;
          return rowEl.getBoundingClientRect().top - el.getBoundingClientRect().top;
        } catch { return undefined; }
      };
      const baselineTops: TextRect['baselineTops'] = {};
      if (kickEl) { const top = topOf(kickEl); if (top !== undefined) baselineTops.kicker = {top, ascent: ascentOf(rows.kicker)}; }
      if (titleEl) { const top = topOf(titleEl); if (top !== undefined) baselineTops.title = {top, ascent: ascentOf(rowFont(titleEl))}; }
      if (subEl) { const top = topOf(subEl); if (top !== undefined) baselineTops.sub = {top, ascent: ascentOf(rows.sub)}; }
      if (metricEl) { const top = topOf(metricEl); if (top !== undefined) baselineTops.metric = {top, ascent: ascentOf(rows.metric)}; }
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
      /* ROUND AR-2 — a note the measurer could NOT find a title on (a stub
         element in a harness, or a DOM drift) must not look measured: the
         family stays undefined so the emitter's token-family fallback for
         the note row ('sans' — the canvas note paints var(--sans)-derived
         styles through `.note-node`) applies, visibly. */
      return {...box, size, weight, fill, anchor: 'start', titleW, spacing,
        family: titleEl ? rowFont(titleEl)?.family : undefined,
        kind: isNote && titleEl ? 'note' : undefined, rows, runs, baselineTops};
    },
    /* ROUND AV — the node's icon glyph: the second svg per node (the lucide
       glyph inside `.node-ico`). Geometry is read node-relative (the same
       `rel()` the text box uses); the ink is the icon svg's own computed
       colour — the accent via `.node-ico { color: var(--nc) }` + lucide's
       `stroke: currentColor`. Primitives are pre-parsed here so the pure
       emitter stays DOM-free. */
    icon(nodeEl) {
      try {
        const el = nodeEl as Element | null;
        if (!el || typeof el.querySelector !== 'function') return null;
        const svgEl = el.querySelector('.node-ico svg');
        if (!svgEl) return null;
        const vb = (svgEl.getAttribute('viewBox') || '0 0 24 24').trim();
        const kids = [...svgEl.children].filter((c): c is SVGElement =>
          ['path', 'circle', 'ellipse', 'rect', 'polyline', 'line', 'polygon'].includes(c.tagName.toLowerCase()));
        if (!kids.length) return null;
        const cs = getComputedStyle(svgEl);
        const stroke = cs.stroke && cs.stroke !== 'none' ? cs.stroke : cs.color;
        const fill = cs.fill === 'none' ? 'none' : (cs.fill || 'none');
        const strokeWidth = parseFloat(cs.strokeWidth) || 2;
        const numAttrs = ['x', 'y', 'cx', 'cy', 'r', 'rx', 'ry', 'width', 'height', 'd', 'points', 'x1', 'y1', 'x2', 'y2', 'transform'];
        const primitives = kids.map(c => {
          const attrs: Record<string, string> = {};
          numAttrs.forEach(a => { const v = c.getAttribute(a); if (v) attrs[a] = v; });
          return {tag: c.tagName.toLowerCase(), attrs};
        });
        const box = rel(el, svgEl);
        return {x: box.x, y: box.y, w: box.w, h: box.h, viewBox: vb, primitives, stroke, strokeWidth, fill};
      } catch {
        return null;
      }
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
    /* ROUND-AR-DEFECT-1 — the edge's label row font, read off the portalled
       `.edge-label[data-edge-id]` element inside the clone root. */
    edgeLabelFont(edgeId) {
      try {
        const r = root?.();
        if (!r || typeof (r as Element).querySelector !== 'function') return undefined;
        const labelEl = (r as Element).querySelector(
          `.edge-label[data-edge-id="${CSS.escape(edgeId)}"]`,
        );
        return labelEl ? rowFontOf(labelEl) : undefined;
      } catch {
        return undefined;
      }
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
       clone carries no dedicated element for.
       ROUND AR-2 — `kind` names the ROW's token family ('mono' | 'sans',
       undefined = the body default): an unmeasured row must fall back to
       the family the canvas would paint it in, never to nothing. */
    defaultFamily(kind?: 'mono' | 'sans') {
      try {
        if (kind === 'mono' || kind === 'sans') {
          const probe = document.createElement('span');
          probe.style.font = kind === 'mono' ? 'var(--mono)' : 'var(--sans)';
          probe.style.display = 'none';
          document.body.appendChild(probe);
          const fam = getComputedStyle(probe).fontFamily || undefined;
          probe.remove();
          return fam || getComputedStyle(document.body).fontFamily || undefined;
        }
        return getComputedStyle(document.body).fontFamily || undefined;
      }
      catch { return undefined; }
    },
    dispose() {
      try { (measTextEl?.parentNode ?? null)?.parentNode?.removeChild(measTextEl!.parentNode!); } catch { /* best effort */ }
      measTextEl = null;
    },
  };
}

/* ------------------------------------------------------------- icon glyph */

/** ROUND AV — one icon primitive's attribute list, with the RESOLVED paint
 *  overrides. Lucide draws with `stroke="currentColor"`; a standalone SVG has
 *  no stylesheet, so the emitter writes the measured accent explicitly on
 *  every primitive and strips the unresolved references. */
function iconPrimitive(p: {tag: string; attrs: Record<string, string>},
  ink: {stroke: string; strokeWidth: number; fill: string}): string {
  const overrides: Record<string, string> = {
    stroke: ink.stroke,
    'stroke-width': String(ink.strokeWidth),
    fill: ink.fill,
    'stroke-linecap': 'round',
    'stroke-linejoin': 'round',
  };
  const attrs = Object.entries({...p.attrs, ...overrides})
    .filter(([k, v]) => k !== 'stroke' || v !== 'none')
    .map(([k, v]) => `${k}="${escAttr(v)}"`)
    .join(' ');
  return `<${p.tag} ${attrs}/>`;
}

/** The node's icon as a nested <svg> at its measured node-relative box. */
type IconMeasure = {
  x: number; y: number; w: number; h: number;
  viewBox: string;
  primitives: Array<{tag: string; attrs: Record<string, string>}>;
  stroke: string; strokeWidth: number; fill: string;
};
function iconMarkup(m: IconMeasure): string {
  const kids = m.primitives.map(p => iconPrimitive(p, m)).join('');
  return `<svg x="${m.x}" y="${m.y}" width="${m.w}" height="${m.h}" viewBox="${escAttr(m.viewBox)}" preserveAspectRatio="xMidYMid meet" overflow="visible">${kids}</svg>`;
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
  /* ROUND AX (t_17334591) — the measured ROW MODEL when the measurer found
     one, the legacy stack only for measurers that cannot supply it (the
     stubs). Baseline = measured row top + that row's measured ascent; x =
     that row's measured TEXT RUN x (past the icon on the title row). */
  const titleTop = t.baselineTops?.title;
  const yTitleStart = titleTop
    ? titleTop.top + titleTop.ascent
    : t.y + Math.min(t.size, t.h > 60 ? 16 : t.h * 0.3) + 4;
  const xRow = t.x;
  /* the title's own run x when measured (icon before it → run x > row x);
     kicker/sub/metric carry no icon so their run x IS the row x — but read
     it from the measurement when present, per the card's "same check". */
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

  /* AR-11 — the row's own measured font, emitted verbatim on its <text>.
     A row the measurer reported no font for keeps the legacy fixed metrics
     and inherits the root's font-family. */
  const kickerFont = t.rows?.kicker;
  const subFont = t.rows?.sub;
  const metricFont = t.rows?.metric;
  const titleFamily = t.family || '';

  if (hasKicker) {
    /* ROUND AX — the kicker sits ABOVE the title: measured top+ascent, or
       one legacy line above the title's first baseline. */
    const yKick = t.baselineTops?.kicker
      ? t.baselineTops.kicker.top + t.baselineTops.kicker.ascent
      : yTitleStart - 15;
    lines.push(textLine(runOf('kicker'), yKick, String(d.kicker).toUpperCase(), {
      size: kickerFont?.size ?? 9.5, weight: kickerFont?.weight ?? 500,
      fill: t.fill || dim, spacing: String(kickerFont?.spacing ?? 1.1),
      family: kickerFont?.family,
    }));
    y = Math.max(y, yKick + 15);
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
    lines.push(textLine(runOf('title'), y + i * lineHeight, ln, {
      size: t.size, weight: t.weight, fill: t.fill || fg, family: titleFamily,
      /* AR-11 — the title's computed letter-spacing rides the emitted rows:
         the wrap measured WITH it, so the file paints with it too. */
      spacing: t.spacing ? String(t.spacing) : undefined,
    }));
  });
  y = titleBottomY;

  if (hasSub) {
    /* ROUND AX — measured sub-row baseline; the legacy `+lineHeight` step
       otherwise (the sub hangs one title line below the title's last). */
    y = topOf('sub', lineHeight);
    lines.push(textLine(runOf('sub'), y, String(d.sub), {
      size: subFont?.size ?? 11.5, weight: subFont?.weight ?? 450,
      fill: dim, family: subFont?.family,
    }));
  }
  if (hasMetric) {
    y = topOf('metric', hasSub ? 20 : lineHeight + 20);
    lines.push(textLine(runOf('metric'), y, String(d.metric) + (d.metricUnit ? ` ${d.metricUnit}` : ''), {
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

/** ERD table: header band + colour strip + one row per visible column.
 *  ROUND-AR-DEFECT-1 — `t` (when the measurer found the table's DOM) carries
 *  the `.tnode-cname` row font in `rows.tcol`, so each column line is painted
 *  in the measured family/size/weight instead of the legacy sans defaults.
 *  ROUND C — `emitRow` (when the caller passes it) replaces the direct
 *  textLine calls so outline mode covers the table rows; default keeps
 *  the plain <text> behaviour byte-identical. */
function tableMarkup(n: ExportNode, s: {w: number; h: number}, accent: string, fg: string, dim: string,
  t?: TextRect | null,
  emitRow?: (x: number, y: number, content: string, o: {size: number; weight: number; fill: string; family?: string; anchor?: string; spacingNum?: number}) => string): string {
  const row = emitRow ?? ((x, y, content, o) => textLine(x, y, content, {
    size: o.size, weight: o.weight, fill: o.fill, family: o.family, anchor: o.anchor,
    spacing: o.spacingNum !== undefined ? String(o.spacingNum) : undefined,
  }));
  const d = (n.data ?? {}) as Record<string, unknown>;
  const cols: Array<Record<string, unknown> | string> = Array.isArray(d.columns) ? d.columns : [];
  const headerH = 24;
  const colFont = t?.rows?.tcol;
  const parts: string[] = [
    `<rect x="1" y="1" width="${s.w - 2}" height="${s.h - 2}" rx="6" fill="none" stroke="${escAttr(accent)}" stroke-width="1.5"/>`,
    `<rect x="1" y="1" width="${s.w - 2}" height="${headerH}" rx="6" fill="${escAttr(accent)}" fill-opacity="0.16"/>`,
    `<rect x="1" y="${headerH}" width="4" height="${Math.max(s.h - headerH - 2, 0)}" fill="${escAttr(accent)}"/>`,
    row(12, 17, String(d.name ?? d.title ?? n.id), {size: 12, weight: 650, fill: fg, family: t?.family}),
  ];
  const rowH = cols.length ? Math.min(18, (s.h - headerH - 4) / cols.length) : 0;
  cols.forEach((c, i) => {
    const name = typeof c === 'string' ? c : String(c?.name ?? c?.label ?? '');
    if (!name) return;
    const y = headerH + 4 + rowH * i + rowH / 2 + 4;
    if (typeof c !== 'string' && (c.pk || c.isPrimary || c.primaryKey)) {
      parts.push(`<circle cx="8" cy="${y - 4}" r="2.4" fill="${escAttr(accent)}"/>`);
    }
    parts.push(row(16, y, name, {
      size: colFont?.size ?? 10.5, weight: colFont?.weight ?? 450, fill: dim,
      family: colFont?.family,
    }));
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

/** ROUND AY — the LEGACY compose shim: buildScene (sync, stub path) +
 *  emitSvg. Kept so the 10+ harnesses that import `exportSvg(input)` keep
 *  compiling and byte-acting. The APP path (App.tsx buildSvg) uses the async
 *  buildScene + the bounds pass + emitSvg directly (item 2). */
export function exportSvg(input: ExportInput): string {
  const scene = exportSceneOf(input);
  return emitSvg(scene, {tokens: input.tokens, inheritFamily: input.measurer.defaultFamily?.() ?? '', outline: input.outline, fontEmbedCss: input.fontEmbedCss});
}

/** Alias kept for the App.tsx import name used mid-migration. */
export const exportSvgOf = exportSvg;

/** Synchronous buildScene for the legacy compose: harness measurers are
 *  DOM-free and deterministic (no fonts await needed). The legacy harnesses
 *  bundle ONLY src/export/exportSvg.ts (their esbuild entry never imports
 *  exportScene.ts), so the scene build must live HERE in that bundle —
 *  delegate through the SAME body the app path uses by importing it
 *  directly (a real import, not the runtime bridge: the bridge exists for
 *  the app bundle where exportSvg is a re-export shim). */
export function exportSceneOf(input: ExportInput): Scene {
  return sceneSync(input);
}


/* ROUND AY items 2+3 — the emitter is a PURE function of (Scene, ctx) (D4):
 * it never touches `document` and never re-reads the DOM or CSS. The Scene
 * arrives fully resolved from `src/export/exportScene.ts` (absolute coords, literal
 * colours, baked baselines, cache-served wrap); `ctx` carries the font seam
 * (`fontEmbedCss` — empty until Harvey's fork decision) and the BOUNDS:
 * either the bbox-derived bounds (spec §3, the live path) or the scene's
 * own node-box arithmetic (the harness/stub path, `boundsSource: 'boxes'`). */
export type EmitCtx = {
  /** ROUND AY item 2 — the font-embedding seam (DECISION RESERVED FOR
   *  HARVEY): when present, emitted verbatim inside <defs><style>. Empty
   *  until the fork is decided; Route 1 would fill it with the subset
   *  base64 WOFF2 @font-face CSS. */
  fontEmbedCss?: string;
  /** Bounds override from the getBBox pass (spec §3). When absent the
   *  scene's own bounds are used ('boxes' source). */
  bounds?: Bounds;
  /** The scene's token map (for the informational <style> block — D3:
   *  nothing painted depends on it). */
  tokens?: Record<string, string>;
  /** AR-11 — the family unmeasured rows inherit (from the measurer's
   *  defaultFamily; the emitter itself never invents one). */
  inheritFamily?: string;
  /** ROUND C — "Outline text" (OFF by default): when present, every
   *  scene text row is emitted as positioned glyph outline paths (the
   *  shaper is harfbuzzjs — shape parity with the canvas by construction)
   *  and NO <text> element survives. Rows whose family the map has no
   *  shaper for (missing font bytes/permission) keep <text> per row —
   *  a visible, honest fallback. */
  outline?: {
    /** ONE shaper per resolved family (harfbuzzjs face bytes). */
    shapers: Map<string, OutlineShaper>;
    /** Rows with no family fall back to this face (the measurer's
     *  defaultFamily — the canvas's own default). */
    defaultShaper?: OutlineShaper;
  };
};

/** One text row: a <text> line (the default) or an outlined glyph run
 *  (ctx.outline) — the ONE place the mode branches (D4: the emitter stays
 *  a pure function of (Scene, ctx); the shapers are injected). A row whose
 *  family has no shaper, or whose shaping throws, falls back to <text>. */
function rowMarkup(r: SceneTextRow, outline?: EmitCtx['outline']): string {
  if (outline) {
    const shaper = (r.family ? outline.shapers.get(r.family) : undefined) ?? outline.defaultShaper;
    if (shaper) {
      try {
        return shapeLineToSvg(r.content, {
          x: r.x, baselineY: r.baselineY,
          size: r.size, weight: r.weight, fill: r.fill,
          spacing: r.spacing ?? 0, anchor: r.anchor,
          shaper,
        });
      } catch (e) {
        /* a shaper failure must not lose the row: fall back visibly */
        console.error('[exportSvg] outline run failed; falling back to <text>:', e);
      }
    }
  }
  return textLine(r.x, r.baselineY, r.content, {
    size: r.size, weight: r.weight, fill: r.fill,
    family: r.family, anchor: r.anchor,
    spacing: r.spacing !== undefined ? String(r.spacing) : undefined,
  });
}

/** The content group: groups (behind), edges, nodes — the canvas z-order —
 *  WITHOUT the root svg / bg rect / token style. The bounds pass (spec §3)
 *  mounts exactly this string to measure getBBox, so the measured group and
 *  the painted group are THE SAME bytes. Returns the group markup plus the
 *  collected marker defs (the AU-3 contract — the caller places <defs>
 *  before the content in the root svg). */
export function emitContent(scene: Scene, outline?: EmitCtx['outline']): {content: string; markerDefs: string[]} {
  const parts: string[] = [];
  const defs: string[] = [];
  emitContentInto(scene, parts, defs, outline);
  return {content: parts.join(''), markerDefs: defs};
}

/** The bounds-pass variant: emits with a KNOWN offset (the final viewBox
 *  arithmetic), collecting marker defs into `defs`. */
export function emitContentInto(scene: Scene, parts: string[], defs: string[], outline?: EmitCtx['outline']): void {
  const pad = scene.pad;
  const b: Bounds = scene.bounds;
  const off = {x: pad - b.minX, y: pad - b.minY};
  const rowEl = (r: SceneTextRow): string => rowMarkup(r, outline);
  /* groups first (behind everything) */
  for (const g of scene.groups) {
    const cb = (g as SceneNode & {childBounds?: Bounds}).childBounds
      ?? {minX: g.absX, minY: g.absY, maxX: g.absX + g.w, maxY: g.absY + g.h};
    const left = cb.minX + off.x - 12, top = cb.minY + off.y - 12;
    const lw = (cb.maxX - cb.minX) + 24, lh = (cb.maxY - cb.minY) + 24;
    parts.push(`<g data-ar-node="${escAttr(g.id)}" transform="translate(${left},${top})">`);
    parts.push(`<rect x="0" y="0" width="${lw}" height="${lh}" rx="10" fill="none" stroke="${escAttr(g.accent)}" stroke-width="1.2" stroke-dasharray="8 5"/>`);
    for (const r of g.rows) parts.push(rowEl(r));
    parts.push('</g>');
  }
  /* edges */
  parts.push(`<g transform="translate(${off.x},${off.y})">`);
  const markerId = (color: string, w: number, h: number): string => {
    const id = 'ar-mk-' + Math.abs(hashStr(`${color}|${w}x${h}`)).toString(36);
    if (!defs.some(d => d.includes(`id="${id}"`))) {
      defs.push(
        `<marker id="${id}" markerWidth="${w}" markerHeight="${h}" viewBox="-10 -10 20 20" markerUnits="strokeWidth" refX="0" refY="0" orient="auto-start-reverse">` +
        `<polyline points="-5,-4 0,0 -5,4 -5,-4" fill="${escAttr(color)}" stroke="${escAttr(color)}" stroke-width="1" stroke-linecap="round" stroke-linejoin="round"/></marker>`);
    }
    return id;
  };
  for (const e of scene.edges) {
    const marker = markerId(e.color, e.marker.w, e.marker.h);
    parts.push(`<path d="${escAttr(e.d)}" fill="none" stroke="${escAttr(e.color)}" stroke-width="${e.strokeWidth}" marker-end="url(#${marker})"/>`);
    if (e.label) {
      const lw = Math.max(24, e.label.row.content.length * 6.6 + 12); /* = labelMetrics.estimateEdgeLabelWidth, pinned by M1 */
      const mid = {x: e.label.x + off.x, y: e.label.y + off.y};
      parts.push(
        `<rect x="${mid.x - lw / 2}" y="${mid.y - 9}" width="${lw}" height="18" rx="4" fill="${escAttr(scene.surface)}" stroke="${escAttr(scene.dim)}" stroke-width="0.8"/>`,
        /* ROUND C — the label row goes through rowMarkup like every other
         * row, so outline mode covers it too (was a direct textLine, which
         * left the edge label as the ONE <text> survivor in outlined
         * exports — measured live on the RC probe board). */
        rowMarkup({...e.label.row, x: mid.x - lw / 2 + 6, baselineY: mid.y + 4}, outline));
    }
  }
  parts.push('</g>');
  /* nodes */
  for (const n of scene.nodes) {
    const s = {w: n.w, h: n.h};
    /* ROUND ROTATE — the same paint angle the canvas root carries, as
       rotate(deg,cx,cy) about the node's own centre; no transform at 0°
       (untouched boards export byte-identically). */
    const rt = rotateSvgTransform(n.rotation ?? 0, s.w, s.h);
    parts.push(`<g data-ar-node="${escAttr(n.id)}" transform="translate(${n.absX + off.x},${n.absY + off.y})${rt ? ' ' + rt : ''}">`);
    if (n.kind === 'label') {
      for (const r of n.rows) parts.push(rowEl(r));
    } else if (n.kind === 'customshape') {
      /* ROUND AY item 4 — a nested <svg> without width/height defaults to
         100% of the NEAREST VIEWPORT (the root svg here — measured: the art
         painted at viewport size). Give the nested svg the node box as
         explicit size so scale()'s arithmetic is the only sizing force;
         a user width/height is kept (verbatim inlining, per the AU table). */
      const sized = n.rawSvg
        ? /<svg[^>]*\swidth="/.test(n.rawSvg)
          ? n.rawSvg
          : n.rawSvg.replace(/<svg([^>]*)>/i, `<svg$1 width="${s.w}" height="${s.h}">`)
        : n.rawSvg;
      parts.push(
        sized
          ? `<g transform="scale(${s.w / 200},${s.h / 100})">${sized}</g>`
          : `<rect x="1" y="1" width="${s.w - 2}" height="${s.h - 2}" rx="6" fill="none" stroke="${escAttr(n.accent)}" stroke-width="1.5"/>`);
    } else if (n.frame === 'note') {
      parts.push(noteMarkup(s, scene.surface, scene.dim));
      for (const r of n.rows) parts.push(rowEl(r));
    } else if (n.kind === 'table') {
      /* ROUND C — the table's own textLine calls become rowMarkup calls
       * so outline mode covers the header + column rows too. */
      parts.push(tableMarkup(n as never, s, n.accent, scene.fg, scene.dim, n.textRect,
        (x, y, content, o) => rowMarkup({x, baselineY: y, content, size: o.size, weight: o.weight, fill: o.fill, family: o.family, spacing: o.spacingNum, anchor: o.anchor}, outline)));
    } else {
      /* ROUND BE (2026-10-23) — the connector's frame is SQUARE (ShapeFrame's
         own choice; the circle cannot stretch to 2:1 and stay a circle), so
         the export wrapper must agree with it or the same geometry paints as
         a squashed ellipse in the exported file. */
      const vb = asShape(n.data?.shape) === 'connector' ? '0 0 100 100' : '0 0 200 100';
      parts.push(
        `<svg x="0" y="0" width="${s.w}" height="${s.h}" viewBox="${vb}" preserveAspectRatio="none">` +
        shapeFrameSvg(asShape(n.data?.shape), {fill: n.accent, stroke: n.accent, fillOpacity: '0.09', plain: (n as SceneNode & {plain?: boolean}).plain !== false}) +
        `</svg>`);
      if (n.icon) parts.push(iconMarkup(n.icon));
      for (const r of n.rows) parts.push(rowEl(r));
    }
    parts.push('</g>');
  }
}

export function emitSvg(scene: Scene, ctx: EmitCtx = {}): string {
  const pad = scene.pad;
  /* bounds: the bbox pass overrides; else the scene's boxes */
  const b: Bounds = ctx.bounds ?? scene.bounds;
  const w = Math.ceil(b.maxX - b.minX) + pad * 2;
  const h = Math.ceil(b.maxY - b.minY) + pad * 2;
  const inheritFamily = ctx.inheritFamily ?? '';

  /* the content derives its own offset from the SAME bounds the viewBox
   * uses, so the measured (mounted content) bytes and the painted bytes
   * agree — the spec §3 mount measures what the file paints. */
  const parts: string[] = [];
  const defs: string[] = [];
  emitContentInto(scene, parts, defs, ctx.outline);
  const content = parts.join('');
  /* the token <style> block stays in the file (other tooling reads it) but
   * nothing painted depends on it (D3) */
  const styleBlock = ctx.tokens ? tokenStyle(ctx.tokens) : '';
  const fontBlock = ctx.fontEmbedCss ? `<style>\n${ctx.fontEmbedCss}\n</style>` : '';
  const allDefs = [...defs];
  if (fontBlock) allDefs.push(fontBlock);

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" data-theme="${escAttr(scene.theme)}"` +
    (inheritFamily ? ` font-family="${escAttr(inheritFamily)}"` : '') + `>` +
    `<rect width="${w}" height="${h}" fill="${escAttr(scene.bg)}"/>` +
    styleBlock +
    (allDefs.length ? `<defs>${allDefs.join('')}</defs>` : '') +
    content +
    `</svg>`;
}

function hashStr(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return h;
}
