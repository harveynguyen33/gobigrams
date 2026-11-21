/**
 * HISTORY-PREVIEW (t_faa6fd2a) — the selected version's own LAYOUT as
 * a real thumbnail. The V3 bar's "preview" was a shape CENSUS
 * (previewGlyphs → one 26x18 glyph per DISTINCT shape): a board whose
 * nodes share one shape — Harvey's own test board — rendered a single
 * glyph and said nothing about the version. This module is the
 * replacement: a MAP, not a render. Every node becomes a rect at its
 * stored position, every edge a straight centre-to-centre line; no
 * shape paths, no React Flow mount, no new deps. Honest about geometry
 * and cheap in bytes.
 *
 * The size chain is the brief's formula, verbatim: node box =
 * node.position + (style.width/height ?? measured ?? 190x95 factory
 * defaults). A parented node's stored position is parent-relative and
 * is NOT resolved here — a map of a version, not a renderer.
 *
 * PURE: the only import is a type. Node harnesses bundle this file
 * with the repo's esbuild exactly like src/ui/historyBadges.ts.
 */
import type {BoardDoc} from '../board/boards';

/** One node box in viewBox space. */
export type ThumbRect = {x: number; y: number; w: number; h: number};
/** One edge line in viewBox space (centre to centre; handles ignored). */
export type ThumbLine = {x1: number; y1: number; x2: number; y2: number};
export type ThumbGeometry = {
  vw: number;
  vh: number;
  rects: ThumbRect[];
  lines: ThumbLine[];
  /** How many rects/lines were NOT drawn: nodes past the cap, lines
   *  past the cap, or an edge whose endpoint is not in the kept set.
   *  0 = the map is complete. */
  clipped: number;
};

/* The brief's numbers: a 168x94 viewBox (rendered at 84x47 css), 6
   units of padding, at most 400 rects and 400 lines — a version is a
   PRE-IMAGE so it can be big; the bar renders it in bounded time and
   says nothing false about the parts it did not draw. */
export const THUMB_VW = 168;
export const THUMB_VH = 94;
const PAD = 6;
const CAP = 400;
/* Factory default node box — the .node min-width + default height. */
const DEF_W = 190;
const DEF_H = 95;

/** style.width may arrive as a css string; take the number out of it. */
const px = (v: number | string | undefined): number | undefined =>
  typeof v === 'number' && Number.isFinite(v) ? v
    : typeof v === 'string' && Number.isFinite(parseFloat(v)) ? parseFloat(v)
    : undefined;

/** The version doc mapped into `0 0 vw vh`. Nodes come first in doc
 *  order (the cap applies in that order), then edges between kept
 *  nodes as centre-to-centre lines. */
export function thumbGeometry(doc: BoardDoc): ThumbGeometry {
  const boxes = doc.nodes.map(n => ({
    id: n.id,
    x: n.position.x,
    y: n.position.y,
    w: px(n.style?.width) ?? n.measured?.width ?? DEF_W,
    h: px(n.style?.height) ?? n.measured?.height ?? DEF_H,
  }));
  let clipped = Math.max(0, boxes.length - CAP);
  const kept = boxes.slice(0, CAP);

  if (!kept.length) return {vw: THUMB_VW, vh: THUMB_VH, rects: [], lines: [], clipped};

  /* Uniform scale into the viewBox with PAD clear on every side. A
     degenerate extent (every node the same point, a zero-sized node)
     is floored at 1 so the scale stays finite and a single rect stays
     non-zero-area. */
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const b of kept) {
    minX = Math.min(minX, b.x); minY = Math.min(minY, b.y);
    maxX = Math.max(maxX, b.x + b.w); maxY = Math.max(maxY, b.y + b.h);
  }
  const bw = Math.max(maxX - minX, 1);
  const bh = Math.max(maxY - minY, 1);
  const scale = Math.min((THUMB_VW - 2 * PAD) / bw, (THUMB_VH - 2 * PAD) / bh);
  const tx = (v: number) => PAD + (v - minX) * scale;
  const ty = (v: number) => PAD + (v - minY) * scale;

  const rects = kept.map(b => ({x: tx(b.x), y: ty(b.y), w: b.w * scale, h: b.h * scale}));
  const centre = new Map(kept.map(b => [b.id, {
    x: tx(b.x) + (b.w * scale) / 2, y: ty(b.y) + (b.h * scale) / 2,
  }]));

  const lines: ThumbLine[] = [];
  for (const e of doc.edges) {
    const a = centre.get(e.source);
    const z = centre.get(e.target);
    if (!a || !z) { clipped++; continue; } /* endpoint clipped away */
    if (lines.length >= CAP) { clipped++; continue; }
    lines.push({x1: a.x, y1: a.y, x2: z.x, y2: z.y});
  }
  return {vw: THUMB_VW, vh: THUMB_VH, rects, lines, clipped};
}
