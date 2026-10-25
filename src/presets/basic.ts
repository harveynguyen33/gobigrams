/* ROUND BN-4 — this file is one slice of the former `src/presets.ts` (split verbatim, 2026-10-25). `src/presets/index.ts` re-exports the union, so every import of './presets' is unchanged. */
import {MarkerType, type Edge} from '@xyflow/react';
import type {EdgeMarkerType} from '@xyflow/system';
import {COLOR_VAR, type ColorKey} from '../colors';
import {type PaletteItem} from '../palette';
import {type Shape} from '../shapes';
import {gridLayout, layoutDiagram, type LayoutDirection, type LayoutSpacing} from '../layout';
import {type CrowFoot} from '../crowfoot';
import {type ThemeName} from '../theme';
import {type ShowMode} from '../TableNode';
import type {Node} from '@xyflow/react';
/* ---------------------------------------------------------------------------
   L2 — THE PRESET SPINE.

   One board field (`BoardDoc.preset`) switches five things and nothing else:
     1. the palette the left panel offers,
     2. the shapes those palette items may use (always a SUBSET of one union),
     3. the defaults every new edge gets (one `makeEdge` factory),
     4. the layout engine the Auto-arrange button runs,
     5. a SUGGESTED theme (never forced — the user may be in light mode).

   The node component and the edge component stay singular: a preset selects a
   `shape` from the union and writes `data`, it never introduces a second
   editor. That is the "no fork" rule, and it is why adding a diagram type here
   is a data change.
--------------------------------------------------------------------------- */

export type PresetId = 'architecture' | 'flowchart' | 'c4' | 'erd' | 'sequence' | 'custom';

/* HARVEY 2026-10-16 — sequence shipped but the first cut read poorly ("tệ quá"):
   HIDDEN behind this flag until the row-order/column-constraint design is
   redone. One switch flips it back on — every piece stays in the tree. */
export const SEQUENCE_ENABLED = false;

/* HARVEY 2026-10-22 — C4 hidden the SAME way (deck item 2, mirroring
   SEQUENCE_ENABLED): one flag keeps every C4 piece in the tree but drops it
   from the CREATE surfaces. GATED HERE, and gated NARROWLY on purpose:
     · the `c4` key STAYS in `PRESETS` unconditionally — a stored board whose
     `preset` field is `'c4'` must still open, render and save as C4
     (`asPreset`/`getPreset` are untouched), and the palette a C4 board renders
     with keeps its C4 items (`C4_PALETTE_ITEMS` stays in `LIBRARY`, because
     `MIXED_LABELS` and `libraryFor('c4')` both reach through it).
     · what the flag removes is only the OFFER: `C4_PRESET.templates` is the
     sole source of the catalog's C4 family, so gating the two template specs
     out drops the family from the template catalog + gallery, and with no
     templates a fresh C4 board is unreachable from every create path (the
     board dialog offers templates only through the gallery model).
   Flip to `true` to put C4 back — the flag is the entire switch. */
export const C4_ENABLED = false;

/* HARVEY 2026-10-22 — Actor hidden the SAME way (the corrected item A:
   "Action" was a misreading of ACTOR — Harvey confirmed "yes ý tôi là actor").
   One flag drops it from every CREATE surface — the left panel's library
   sections, the omnibox search and the insert modal, which all read
   `LIBRARY` (`App.tsx` builds its groups from `LIBRARY` alone;
   `addNodeByLabel` resolves through `LIBRARY.find`).
   GATED HERE, and gated NARROWLY on purpose:
     · `PALETTE` (the architecture list) stays UNFILTERED — the seed-facing
       assemblies read it, and a stored board that placed an Actor keeps
       rendering it (shape rendering never consults this flag).
     · what the flag removes is only the OFFER: `LIBRARY` — the one array the
       create surfaces enumerate — filters `label === 'Actor'` out.
   Flip to `true` to put Actor back — the flag is the entire switch. */
export const ACTOR_ENABLED = false;

/* HARVEY 2026-10-22 — four more create-surface hides, SAME pattern
   (ACTOR/QUEUE/C4/SEQUENCE). One flag each; items stay in the tree, only the
   OFFER is gated:
     · STORAGE_ENABLED — the bucket shape in Data & storage (Harvey: "xoá
       Storage trong Data & Storage").
     · ERD_ENABLED — BOTH entities items (Table + Note (enum)); with both off
       the `entities` category section renders empty and disappears
       (groupByCategory drops empty groups), and the ERD preset loses its
       palette offer. `libraryFor('erd')` reads LIBRARY, so it returns [] —
       acceptable: the ERD preset is template-seeded, and a stored erd board
       keeps its nodes (shape rendering never consults this flag).
       HARVEY 2026-10-23 — the ERD preset itself stays in PRESETS (a stored
       erd board must still open as ERD); only its palette offer is gated.
       HARVEY 2026-10-24 — the TEMPLATE is gated too (same flag, same
       narrowness as C4_ENABLED's template gate): `templates` is the sole
       source of the catalog's `erd` family, so gating the spread drops the
       "Data model" family from the template catalog + gallery, and with no
       templates a fresh ERD board is unreachable from every create path.
       The `erd` key STAYS in PRESETS and erdTemplate stays in the tree —
       a stored board with preset:'erd' still opens as ERD.
     · LANE_ENABLED — the swimlane; Harvey: Group and Lane are near-duplicates
       (both shape 'group', both a dashed boundary; Lane only adds a 420×200
       default size + swimlane aliases), so Lane goes, Group stays.
     · NOTE_ENABLED — the shared plain-text Note (annotations category).
       `withNoteLast` and the flowchart/c4 tail-hoist no-op when the item is
       not in LIBRARY (the filter finds nothing, nothing is appended).
   Flip any to `true` to put the shape back — the flag is the entire switch. */
export const STORAGE_ENABLED = false;
export const ERD_ENABLED = false;
export const LANE_ENABLED = false;
export const NOTE_ENABLED = false;

/* HARVEY 2026-10-22 — Queue hidden the SAME way (deck item A, mirroring
   C4_ENABLED / SEQUENCE_ENABLED): one flag drops it from every CREATE surface —
   the left panel's library sections, the omnibox search and the insert modal,
   which all read `LIBRARY` (`App.tsx` builds its groups from `LIBRARY` alone;
   `addNodeByLabel` resolves through `LIBRARY.find`).
   GATED HERE, and gated NARROWLY on purpose:
     · `QUEUE_PALETTE_ITEM` STAYS in the tree and `PALETTE` (the architecture
       list) is assembled UNFILTERED — the first-run seed reads
       `PRESETS.architecture.palette[2]` (`App.tsx` `initialNodes`, the
       External → Queue → Service pipeline) and `checks/boot-no-flash.mjs`
       pins that seed byte-identical, so the seed-facing preset palette keeps
       every entry. A stored board that placed a Queue also keeps rendering it
       (`insertNodeData`/shape rendering never consult this flag).
     · what the flag removes is only the OFFER: `LIBRARY` — the one array the
       create surfaces enumerate — filters `label === 'Queue'` out.
   Flip to `true` to put Queue back — the flag is the entire switch. */
export const QUEUE_ENABLED = false;
export type LayoutId = 'layered-lr' | 'layered-tb' | 'grid' | 'free';

export type PathId = 'bezier' | 'smoothstep' | 'step' | 'straight';

export type EdgeDefaults = {
  path: PathId;
  strokeKey: ColorKey;
  dash?: 'solid' | 'dashed' | 'dotted';
  markerStart?: MarkerType | null;
  markerEnd?: MarkerType | null;
  /** ERD crow's-foot ends (L3c). These override the plain markers above. */
  crowStart?: CrowFoot | null;
  crowEnd?: CrowFoot | null;
  /* ROUND AK, AK-8 — `labelPresets?: string[]` WAS HERE. It is DELETED, with the
     reason. It was a per-PRESET list of suggested edge labels, and the panel
     gated a whole `intent label` row on `preset.edges.labelPresets?.length` —
     i.e. on the BOARD's preset. A board holding a flowchart template AND a C4
     template (which Harvey does) makes that board-level string a lie about half
     its edges. The project already solved this exact problem for NODES: `hasSub`
     keys on the SHAPE, because even with the preset it would be wrong — the
     mixed palette offers the same shapes. Removed: the field, its two data sites
     (`C4_EDGES` + `FLOWCHART_EDGES`), the `C4_LABELS` array, and the JSX block
     that rendered the buttons. `technField` and the `technology` input STAY —
     they are a different field with a real consumer. */
  /** Render `techn` as a dim second line after the label. */
  technField?: boolean;
  /** Whether the six flow animations are offered for this preset. */
  flowAllowed?: boolean;
  /** Default stroke width. */
  strokeWidth?: number;
};

export type LayoutSpec = {
  engine: LayoutId;
  direction: LayoutDirection;
  spacing?: LayoutSpacing;
  /** Treat top-level group nodes as frozen pool / lane bands (L3a). */
  bandGroups?: boolean;
  /** Grid engine: columns. */
  cols?: number;
};

/** Difficulty depth WITHIN a template family, in Harvey's own vocabulary
 *  (cơ bản / advance / complex). OPTIONAL on purpose: the four templates that
 *  ship today carry no level and must stay reachable with zero edits. */
export type TemplateLevel = 'basic' | 'advanced' | 'complex';

/** Display label + one-line meaning, in ONE place, so the dialog and any future
 *  surface cannot word the levels differently. */
export const TEMPLATE_LEVELS: Record<TemplateLevel, {label: string; blurb: string}> = {
  basic:    {label: 'Basic',    blurb: 'everyday flow · common shapes only'},
  advanced: {label: 'Advanced', blurb: 'more branches · the less common symbols'},
  complex:  {label: 'Complex',  blurb: 'full notation · every flowchart shape'},
};

export type TemplateSpec = {
  id: string;
  label: string;
  hint?: string;
  /** The difficulty level inside this template's family. `family` is NOT a
   *  field: the preset that owns the template IS the family, so a second
   *  identity string could drift from `PRESETS`. */
  level?: TemplateLevel;
  /** Display order inside the family when levels tie (lower first). */
  order?: number;
  nodes: Node[];
  edges: Edge[];
};

export type LegendEntry = {colorKey: ColorKey; label: string; dash?: boolean};

export type DiagramPreset = {
  id: PresetId;
  label: string;
  hint: string;
  /** 1 — PALETTE */
  palette: PaletteItem[];
  /** 2 — SHAPE LIBRARY: extra shapes this preset may use (union with the base 9). */
  extraShapes?: Shape[];
  /** 3 — EDGE DEFAULTS */
  edges: EdgeDefaults;
  /** 4 — LAYOUT */
  layout: LayoutSpec;
  /** 5 — THEME (suggested, never forced) + chrome */
  theme: {suggested?: ThemeName; canvas?: 'dots' | 'lines' | 'plain' | 'none'; showLegend?: boolean};
  /** 6 — GUIDANCE */
  guidance?: {tip?: string; requireLabel?: boolean; requireTechnology?: boolean; maxLabelChars?: number};
  /** 7 — TEMPLATES */
  templates?: TemplateSpec[];
  /** 8 — CAPABILITIES */
  caps?: {subflow?: boolean; cyclePrevention?: boolean; oneInput?: boolean; resizable?: boolean};
  /** ERD-specific: the default column show-mode. */
  showMode?: ShowMode;
  /** Legend rows (C4 requires a key on every diagram). */
  legend?: LegendEntry[];
  /** Optional per-preset inspector note shown above the fields. */
  note?: string;
};

/** LAYOUTS registry — one entry per engine. The K3 CSS transition wrapper is
 *  applied by the caller (`animateLayout`), so it stays preset-independent. */
export const LAYOUTS = {
  'layered-lr': (nodes: Node[], edges: Edge[], spec: LayoutSpec) =>
    layoutDiagram(nodes, edges, {direction: 'LR', spacing: spec.spacing, bandGroups: spec.bandGroups}),
  'layered-tb': (nodes: Node[], edges: Edge[], spec: LayoutSpec) =>
    layoutDiagram(nodes, edges, {direction: 'TB', spacing: spec.spacing, bandGroups: spec.bandGroups}),
  grid: (nodes: Node[], edges: Edge[], spec: LayoutSpec) =>
    gridLayout(nodes, edges, {cols: spec.cols ?? 2, gap: spec.spacing}),
  free: () => new Map<string, {x: number; y: number}>(),
} as const;

/* ===========================================================================
   Edge factory — one place that knows what a new edge in this preset looks
   like. Replaces the four ad-hoc edge literals that used to be scattered
   through App.tsx (initial seed, proximity connect, connect-end drop, connect).
=========================================================================== */

const DASH: Record<string, string | undefined> = {solid: undefined, dashed: '6 4', dotted: '1.5 3.5'};

/** Marker object for a plain (React Flow built-in) end. The colour is the
 *  symbolic var, so the arrowhead follows the theme with no data edit. */
const plainMarker = (t: MarkerType | null | undefined, color: string) =>
  t && t !== MarkerType.Arrow && t !== MarkerType.ArrowClosed ? undefined
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    : (t === MarkerType.Arrow || t === MarkerType.ArrowClosed ? {type: t, color, width: 14, height: 14} : undefined) as any;

export type EdgeSeed = {
  sourceHandle?: string | null;
  targetHandle?: string | null;
  label?: string;
  techn?: string;
  crowStart?: CrowFoot;
  crowEnd?: CrowFoot;
};

/**
 * Build a new edge from an `EdgeDefaults` block. Every creation path goes
 * through here, so a flowchart never accidentally gets an architecture bezier.
 */
export function makeEdge(source: string, target: string, e: EdgeDefaults, id: string, seed: EdgeSeed = {}): Edge {
  const color = COLOR_VAR[e.strokeKey];
  const dash = DASH[e.dash ?? 'solid'];
  const typeId = e.path === 'bezier' ? 'goblinEdge' : e.path;

  const crowStart = seed.crowStart ?? e.crowStart ?? undefined;
  const crowEnd = seed.crowEnd ?? e.crowEnd ?? undefined;
  const markerStart = crowStart
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ? ({type: crowStart, color, width: 18, height: 12} as any)
    : plainMarker(e.markerStart, color);
  const markerEnd = crowEnd
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ? ({type: crowEnd, color, width: 18, height: 12} as any)
    : plainMarker(e.markerEnd, color);

  const edge: Edge = {
    id,
    type: typeId,
    source,
    target,
    animated: false,
    style: {stroke: color, ...(dash ? {strokeDasharray: dash} : null), ...(e.strokeWidth ? {strokeWidth: e.strokeWidth} : null)},
    data: {shape: e.path, offset: 'center', strokeKey: e.strokeKey, ...(seed.techn ? {techn: seed.techn} : null)},
  };
  if (seed.label) edge.label = seed.label;
  if (markerStart) edge.markerStart = markerStart;
  if (markerEnd) edge.markerEnd = markerEnd;
  if (seed.sourceHandle) edge.sourceHandle = seed.sourceHandle;
  if (seed.targetHandle) edge.targetHandle = seed.targetHandle;
  return edge;
}

/** Edge patch for the inspector's colour swatches: symbolic key everywhere it
 *  is baked in (path stroke + both markers), which is what makes a recolour
 *  survive a theme change. */
export function edgeColorPatch(key: ColorKey, existing?: {markerEnd?: EdgeMarkerType; markerStart?: EdgeMarkerType}) {
  const color = COLOR_VAR[key];
  const patch: {style: {stroke: string}; data: {strokeKey: ColorKey}; markerEnd?: EdgeMarkerType; markerStart?: EdgeMarkerType} =
    {style: {stroke: color}, data: {strokeKey: key}};
  /* EdgeMarkerType is `string | EdgeMarker`; only the OBJECT form carries a colour to
     recolour — a bare string marker (e.g. 'arrow') is left untouched. */
  if (typeof existing?.markerEnd === 'object') patch.markerEnd = {...existing.markerEnd, color};
  if (typeof existing?.markerStart === 'object') patch.markerStart = {...existing.markerStart, color};
  return patch;
}

/** ROUND AO, AO-1c — the LITERAL twin of `edgeColorPatch`, for the custom picker.
 *  THE EXACT INVERSE of the key patch above, key by key:
 *    · `strokeKey` is set to `undefined` rather than left alone, so the symbolic
 *      key cannot keep winning `resolveColor`'s precedence check and silently
 *      override the colour the user just chose;
 *    · `data.color` carries the literal, which is the branch `resolveColor` falls
 *      through to when no key is set;
 *    · the path stroke and BOTH markers take the literal directly, because they
 *      are baked values (a marker's `color` is not a CSS variable and cannot
 *      follow a theme);
 *    · and `bendX`/`bendY`/`bend` are deliberately NOT touched — the edge's route
 *      and its colour are independent, and the existing writers already own those.
 *  THE THEME HONESTY IS THE POINT OF THE SHAPE: a literal is stored on the edge
 *  and stays exactly as chosen across a theme switch. Picking a KEY afterwards
 *  runs `edgeColorPatch`, which rewrites `stroke` with `var(--c-*)` and the
 *  markers' `color` with the key's var — but it does NOT clear `data.color`,
 *  because that key is not in its patch. `App.setEdgeColor` therefore clears it
 *  explicitly; see the note there. */
export function edgeColorLiteralPatch(hex: string, existing?: {markerEnd?: EdgeMarkerType; markerStart?: EdgeMarkerType}) {
  const patch: {style: {stroke: string}; data: {color: string; strokeKey: undefined}; markerEnd?: EdgeMarkerType; markerStart?: EdgeMarkerType} =
    {style: {stroke: hex}, data: {color: hex, strokeKey: undefined}};
  if (typeof existing?.markerEnd === 'object') patch.markerEnd = {...existing.markerEnd, color: hex};
  if (typeof existing?.markerStart === 'object') patch.markerStart = {...existing.markerStart, color: hex};
  return patch;
}


/* The three real presets' edge defaults, declared here (above the templates)
   because the templates build their edges through the same factory. */
export const C4_EDGES: EdgeDefaults = {
  path: 'smoothstep',
  strokeKey: 'slate',
  dash: 'dashed',
  markerStart: null,
  markerEnd: MarkerType.ArrowClosed,
  technField: true,
  flowAllowed: false,
};

export const FLOWCHART_EDGES: EdgeDefaults = {
  path: 'smoothstep',
  strokeKey: 'slate',
  dash: 'solid',
  markerStart: null,
  markerEnd: MarkerType.ArrowClosed,
  flowAllowed: true,
};

/* ROUND BG, item A (2026-10-24) — HARVEY: drew plain flowchart arrows on a
   stored 'erd'-preset board and every NEW edge arrived with crow's-foot
   markers ("why does a normal arrow suddenly have crow's foot? absurd.").
   The crow seeds on new edges now follow ERD_ENABLED, the SAME flag that has
   hidden the whole ERD create surface since 46ecc24: flag false → plain
   markerEnd ArrowClosed, exactly like FLOWCHART_EDGES, on every creation
   path (all of them consume `preset.edges` through makeEdge). The branch
   below keeps this a DEFAULTS table, never a board rewrite — stored edges
   keep their baked crow markers, and an explicit seed crowStart/crowEnd
   (the erdTemplate relationship seeds) still passes through makeEdge.
   Flip ERD_ENABLED to true and the full crow pair returns. */
export const ERD_EDGES: EdgeDefaults = {
  path: 'smoothstep',
  strokeKey: 'slate',
  dash: 'solid',
  markerStart: null,
  ...(
    /* Read the real flag, never a hard-coded branch: the table itself flips
       with the switch, so a future re-enable cannot ship a stale half. */
    ERD_ENABLED
      ? {markerEnd: null, crowStart: 'one', crowEnd: 'many' as const}
      : {markerEnd: MarkerType.ArrowClosed, crowStart: undefined, crowEnd: undefined}
  ),
  strokeWidth: 1.6,
  flowAllowed: false,
};
