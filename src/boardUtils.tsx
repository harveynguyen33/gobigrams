/* boardUtils.tsx — ROUND BN, ITEM 2: the pure module-level helpers moved out of
 *  App.tsx verbatim (edge marker/colour lookups, isEditable, node geometry,
 *  edgeGeo/sideAnchor, the TableGlyph component, dashArray, favouritePreview,
 *  markerFor, bootTheme, wouldCycle). Behaviour-neutral: byte-identical bodies,
 *  only `export` keywords and this file's imports are new. .tsx because
 *  TableGlyph is a component. */
import {MarkerType, type Edge, type Node} from '@xyflow/react';
import {COLOR_VAR, isColorKey, keyForHex, resolveColor, resolveColorKey, type ColorKey} from './colors';
import {asShape, SHAPE_IDS, ShapePreview, type Shape} from './shapes';
import {isCrowFoot, markerIdFor} from './crowfoot';
import {applyDrag, drawnMid, isSide4, type BendGeo, type Pt, type Side4} from './edgeBend';
import {LIBRARY, DEFAULT_PRESET_ID, getPreset} from './presets';
import * as library from './library';
import {loadMode, resolveMode, type ThemeName} from './theme';
import {handleSidesOf} from './boardMigrations';
import type {EdgeData} from './App';

/** The live marker id for an edge's crow's-foot end. React Flow wraps a STRING
 *  marker in `url('#…')` itself and skips string markers when building its own
 *  `<defs>`, so we hand it a bare id and render the matching glyph ourselves
 *  (see crowfoot.tsx). Derived from the data, so a theme switch needs no rewrite. */
export const edgeMarkerUrl = (e: Edge, which: 'start' | 'end'): string | undefined => {
  const m = (which === 'start' ? e.markerStart : e.markerEnd) as any;
  if (!isCrowFoot(m?.type)) return undefined;
  return markerIdFor(m.type, edgeStrokeKeyOf(e));
};

/** The symbolic colour key of an edge (used for its crow's-foot markers). */
export const edgeStrokeKeyOf = (e: Edge): ColorKey => {
  const d = (e.data ?? {}) as any;
  if (isColorKey(d.strokeKey)) return d.strokeKey;
  return keyForHex((e.style as any)?.stroke) ?? 'slate';
};

/** True when the edge carries an ERD crow's-foot end. */
export const hasCrow = (e: Edge, which: 'start' | 'end') =>
  isCrowFoot(((which === 'start' ? e.markerStart : e.markerEnd) as any)?.type);

/** True when the keyboard event originates from a text field — never hijack typing. */
export function isEditable(t: EventTarget | null): boolean {
  const el = t as HTMLElement | null;
  if (!el) return false;
  const tag = el.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el.isContentEditable === true;
}

export const nodeW = (n: Node) => (n.measured?.width ?? n.width ?? 190) as number;
export const nodeH = (n: Node) => (n.measured?.height ?? n.height ?? 60) as number;

/* ---------------------------------------------------------------------------
   STEP 1 (2026-09-18) / ROUND T — BEND POSITION for step / smoothstep edges.

   `getSmoothStepPath` takes a `stepPosition` fraction (0 = at the source end,
   1 = at the target end, 0.5 = React Flow's default) that slides the step's
   cross-bar along the split axis. ROUND T REMOVED THE SLIDER that used to expose
   it — the control is gone from the inspector — and the fraction is now
   read-only legacy: an old board's stored `bend` still renders through the
   generator exactly as it did, and nothing writes the key any more. What bends
   an edge now is the midpoint HANDLE, which stores an absolute 2-D waypoint.

   The old slider's gate (a per-geometry axis derived from the generator's own
   split), the collapsed-bar special cases and the `App`-shaped wrapper that
   presented them to the inspector were all deleted with the control itself.
   What survives is what has a live reader, in `src/edgeBend.ts`:
   `dragAxis` (the POINTER's rule — draw.io's), `applyDrag` (the writer),
   `drawnMid` (the drag's base point), `freePath` (the route that reads both
   coordinates) and `needsCustom` (stored waypoint → `freePath`).
--------------------------------------------------------------------------- */

/** Midpoint of one named side of a node — the same anchor React Flow hands the
 *  edge component as `sourceX`/`sourceY` (see `GoblinEdge`'s props). */
export const sideAnchor = (n: Node, side: Side4): Pt => {
  const w = nodeW(n), h = nodeH(n);
  if (side === 'right')  return {x: n.position.x + w,     y: n.position.y + h / 2};
  if (side === 'left')   return {x: n.position.x,         y: n.position.y + h / 2};
  if (side === 'top')    return {x: n.position.x + w / 2, y: n.position.y};
  return {x: n.position.x + w / 2, y: n.position.y + h};
};

/** ROUND S — an edge's geometry as `edgeBend` wants it: the node sides it
 *  actually leaves and arrives on. Null when either end is not a node side (an
 *  ERD column handle, or a node that is not on this board). The stored handle id
 *  IS the Position value (`DiagramNode` names its handles `left`/`right`/
 *  `top`/`bottom`); when one was never stored, fall back to the connected node's
 *  own `data.handles` — the same authority `migrateEdgeEnds` uses. */
export const edgeGeo = (e: Edge, nodes: Node[]): BendGeo | null => {
  const source = nodes.find(n => n.id === e.source);
  const target = nodes.find(n => n.id === e.target);
  if (!source || !target) return null;
  const sFrom = handleSidesOf(source).source;
  const tFrom = handleSidesOf(target).target;
  const sp = isSide4(e.sourceHandle) ? e.sourceHandle : (isSide4(sFrom) ? sFrom : null);
  const tp = isSide4(e.targetHandle) ? e.targetHandle : (isSide4(tFrom) ? tFrom : null);
  if (!sp || !tp) return null;
  return {s: sideAnchor(source, sp), t: sideAnchor(target, tp), sp, tp};
};

/** ROUND S — `edgeMid` (the W an edge is drawn through) lives in `GoblinEdge`,
 *  which already holds the two anchors and the two handle sides; the app version
 *  would have to re-derive them and could disagree. */

/** ROUND T — the base point a drag starts from, for the handler that has the
 *  edge + the board's nodes rather than the renderer's props: exactly
 *  `GoblinEdge`'s `W` (`drawnMid` over the edge's stored keys, honouring a
 *  legacy `bend` fraction). */
export const edgeDrawnMid = (e: Edge, nodes: Node[]): Pt | null => {
  const geo = edgeGeo(e, nodes);
  if (!geo) return null;
  const d = (e.data ?? {}) as EdgeData;
  return drawnMid(geo, d.bendX, d.bendY, d.bend);
};

/** Tiny table glyph for the ERD palette row (26×18, same box as ShapePreview). */
export function TableGlyph({color}: {color: string}) {
  return (
    <svg className="shape-preview table" viewBox="0 0 26 18" width="26" height="18">
      <rect x="1" y="2" width="24" height="14" rx="2" fill="none" stroke={color} strokeWidth="1.4" />
      <path d="M1 6.5 H25 M9 6.5 V16" fill="none" stroke={color} strokeWidth="1" opacity=".8" />
    </svg>
  );
}

export const dashArray = (v: string | undefined) =>
  v === 'dashed' ? '6 4' : v === 'dotted' ? '1.5 3.5' : undefined;

/* ---------------------------------------------------------------------------
   PACKAGE-N pass 3 — favourites (§6).

   The star control and the favourite tiles are palette-shaped controls, not
   canvas ones, so they live here rather than inside `DiagramNode`.

   `favouritePreview` decides a tile's glyph from the STORED payload — it never
   trusts a stored `position`, only identity:
     - a labelled payload  → the palette item's own row (identical to §6.3);
     - an unlabelled one   → the node's `shape` directly (a selection copy);
     - neither (e.g. an ERD `table` copy, whose `data` has no `shape`) → the
       table glyph, which is the only node kind without a Shape.
   Colours come from the payload's symbolic `colorKey` via `COLOR_VAR`, so a
   tile recolours with the theme exactly like a board node does.
--------------------------------------------------------------------------- */
export function favouritePreview(fav: library.Favourite) {
  const label = library.favouriteLabel(fav);
  const item = label ? LIBRARY.find(p => p.label === label) : undefined;
  if (item) {
    if (item.kind === 'label') return <span style={{color: COLOR_VAR[item.colorKey]}}>T</span>;
    if (item.label === 'Table') return <TableGlyph color={COLOR_VAR[item.colorKey]} />;
    return <ShapePreview shape={item.shape} color={COLOR_VAR[item.colorKey]} />;
  }
  const node = fav.nodes[0] ?? {};
  const raw = (node as any).data ?? node; // a selection copy keeps the node wrapper
  const key = isColorKey((raw as any)?.colorKey) ? ((raw as any).colorKey as ColorKey) : 'slate';
  const shape = (raw as any)?.shape;
  if (typeof shape === 'string' && (SHAPE_IDS as string[]).includes(shape)) {
    return <ShapePreview shape={shape as Shape} color={COLOR_VAR[key]} />;
  }
  if ((raw as any)?.shape === undefined && (raw as any)?.columns) return <TableGlyph color={COLOR_VAR[key]} />;
  return <span style={{color: COLOR_VAR[key]}}>T</span>;
}

export const markerFor = (kind: string, color: string) =>
  kind === 'arrowclosed' || kind === 'arrow' ? {type: kind as MarkerType, color, width: 14, height: 14} : undefined;

export const edgeStroke = (e: Edge) => resolveColor(e.data as any);
/** The live symbolic key of an edge (for the "on" swatch). */
export const edgeStrokeKey = (e: Edge | null) => (e ? resolveColorKey(e.data as any) : null);


/** ITEM 1 — the boot theme. Resolved from exactly the same three inputs as the
 *  pre-paint script in `index.html`'s <head>, so the document can never paint a
 *  theme React is about to replace. Precedence:
 *
 *    1. a stored CONCRETE theme — the user's explicit choice (`loadMode`).
 *    2. otherwise, for a user who has NEVER chosen, the DEFAULT preset's
 *       suggested theme. App starts on `DEFAULT_PRESET_ID`, so that suggestion
 *       is already in force at mount; this is the one that used to arrive ~130ms
 *       late (with the board load) as `dark`, flipping a light first frame.
 *    3. otherwise `system`, resolved through matchMedia.
 *
 *  The `hasStoredTheme` param lets `App` hand over the value it already read
 *  for the lazy initialiser instead of touching localStorage a second time. */
export function bootTheme(hasStoredTheme: boolean): ThemeName {
  const stored = loadMode();
  if (stored !== 'system') return stored;
  if (!hasStoredTheme) {
    const suggested = getPreset(DEFAULT_PRESET_ID).theme.suggested;
    if (suggested) return suggested;
  }
  return resolveMode(stored);
}

/* AUDIT-follow-up (Harvey 2026-10-13) — cycle detection as a pure function so
   EVERY edge-creation path can use it, not just the inspector's onConnect. Three
   paths were bypassing the Prevent-cycles setting: a connect drag dropped on an
   existing node, the proximity connect, and an edge rewire. */
export function wouldCycle(source: string, target: string, edges: {source: string; target: string}[]): boolean {
  if (source === target) return true;
  const adj = new Map<string, string[]>();
  edges.forEach(e => {
    if (!adj.has(e.source)) adj.set(e.source, []);
    adj.get(e.source)!.push(e.target);
  });
  const seen = new Set<string>([target]);
  const stack = [target];
  while (stack.length) {
    const cur = stack.pop()!;
    if (cur === source) return true;
    for (const nxt of adj.get(cur) ?? []) if (!seen.has(nxt)) { seen.add(nxt); stack.push(nxt); }
  }
  return false;
}
