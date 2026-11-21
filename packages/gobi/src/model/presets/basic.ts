/* ROUND BN-4 — this file is one slice of the former `src/presets.ts` (split verbatim, 2026-10-25). `src/presets/index.ts` re-exports the union, so every import of './presets' is unchanged. */
import type {FlowEdge, FlowEdgeMarker} from '../flowTypes';
/* CORE-STEP1: the marker enum is local plain data (src/markers.ts), values verbatim. */
import {MarkerType} from '../markers';
import {COLOR_VAR, type ColorKey} from '../colors';
import {type PaletteItem} from '../palette';
import {type Shape} from '../nodes/shapes';
import {gridLayout, layoutDiagram, type LayoutDirection, type LayoutSpacing} from '../layout';
import type {CrowFoot} from '../nodeData';
import {type ThemeName} from '../theme';
import type {ShowMode} from '../nodeData';
import type {EdgeFlowKind} from '../edges/edgeData';
import type {FlowNode} from '../flowTypes';
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

/* HARVEY 2026-10-22 — three more create-surface hides, SAME pattern
   (ACTOR/QUEUE/C4/SEQUENCE). One flag each; items stay in the tree, only the
   OFFER is gated:
     · STORAGE_ENABLED — the bucket shape in Data & storage (Harvey: "xoá
       Storage trong Data & Storage").
     · LANE_ENABLED — the swimlane; Harvey: Group and Lane are near-duplicates
       (both shape 'group', both a dashed boundary; Lane only adds a 420×200
       default size + swimlane aliases), so Lane goes, Group stays.
     · NOTE_ENABLED — the shared plain-text Note (annotations category).
       `withNoteLast` and the flowchart/c4 tail-hoist no-op when the item is
       not in LIBRARY (the filter finds nothing, nothing is appended).
   Flip any to `true` to put the shape back — the flag is the entire switch.

   UNISURF-S13 (2026-11-09) — THE ERD HIDE IS GONE, and it was not replaced by
   another flag. The old switch gated THREE unrelated things (the Table + Note
   (enum) palette rows, the `erd` template, and the crow's-foot defaults on new
   edges) and was flipped off to fix ONE of them: a plain arrow drawn on an
   'erd' board arrived crow-footed because the markers came from the BOARD
   PRESET instead of from what the edge connects. Gating the edge default also
   gated the shapes, so the ERD surface was unreachable with a mouse. The
   replacement is a rule, not a switch: a NEW edge is a plain arrow on EVERY
   preset, and crow is authored where the cardinality actually lives — the FK
   writer (table column → table) and the erdTemplate's own seeded
   relationships. Both ERD palette rows and the template are always offered. */
export const STORAGE_ENABLED = false;
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
  nodes: FlowNode[];
  edges: FlowEdge[];
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
 *  applied by the caller (`animateLayout`), so it stays preset-independent.
 *  ROUND LAYOUT — the layered engines read `spec.direction` (falling back to
 *  their own birth direction), so the persisted Canvas preference can flow
 *  through `useCanvasTools`'s `{...preset.layout, direction: layoutDir}`
 *  override. The grid engine keeps its own geometry (no direction). */
export const LAYOUTS = {
  'layered-lr': (nodes: FlowNode[], edges: FlowEdge[], spec: LayoutSpec) =>
    layoutDiagram(nodes, edges, {direction: spec.direction ?? 'LR', spacing: spec.spacing, bandGroups: spec.bandGroups}),
  'layered-tb': (nodes: FlowNode[], edges: FlowEdge[], spec: LayoutSpec) =>
    layoutDiagram(nodes, edges, {direction: spec.direction ?? 'TB', spacing: spec.spacing, bandGroups: spec.bandGroups}),
  grid: (nodes: FlowNode[], edges: FlowEdge[], spec: LayoutSpec) =>
    gridLayout(nodes, edges, {cols: spec.cols ?? 2, gap: spec.spacing}),
  free: () => new Map<string, {x: number; y: number}>(),
} as const;

/* ===========================================================================
   FlowEdge factory — one place that knows what a new edge in this preset looks
   like. Replaces the four ad-hoc edge literals that used to be scattered
   through App.tsx (initial seed, proximity connect, connect-end drop, connect).
=========================================================================== */

/* DASHED-EXPORT (t_4a50be14) — the ONE dash-pattern table in the codebase.
 * makeEdge writes it into edge.style.strokeDasharray (the exact field the
 * canvas paints), the gobi adapter resolves doc `dash` words through it, and
 * the SVG emitter reads the SAME style field back — so no door can invent a
 * second pattern. Exported since DASHED-EXPORT; was a module-private `DASH`. */
export const EDGE_DASH: Record<string, string | undefined> = {solid: undefined, dashed: '6 4', dotted: '1.5 3.5'};

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
  /* ONBOARD-P4 — a seeded edge may preview a flow (registry: EDGE_FLOW_KINDS). */
  flow?: EdgeFlowKind;
  crowStart?: CrowFoot;
  crowEnd?: CrowFoot;
};

/**
 * Build a new edge from an `EdgeDefaults` block. Every creation path goes
 * through here, so a flowchart never accidentally gets an architecture bezier.
 */
export function makeEdge(source: string, target: string, e: EdgeDefaults, id: string, seed: EdgeSeed = {}): FlowEdge {
  const color = COLOR_VAR[e.strokeKey];
  const dash = EDGE_DASH[e.dash ?? 'solid'];
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

  const edge: FlowEdge = {
    id,
    type: typeId,
    source,
    target,
    animated: false,
    style: {stroke: color, ...(dash ? {strokeDasharray: dash} : null), ...(e.strokeWidth ? {strokeWidth: e.strokeWidth} : null)},
    data: {shape: e.path, offset: 'center', strokeKey: e.strokeKey, ...(seed.flow ? {flow: seed.flow} : null), ...(seed.techn ? {techn: seed.techn} : null)},
  };
  if (seed.label) edge.label = seed.label;
  if (markerStart) edge.markerStart = markerStart;
  if (markerEnd) edge.markerEnd = markerEnd;
  if (seed.sourceHandle) edge.sourceHandle = seed.sourceHandle;
  if (seed.targetHandle) edge.targetHandle = seed.targetHandle;
  return edge;
}

/** FlowEdge patch for the inspector's colour swatches: symbolic key everywhere it
 *  is baked in (path stroke + both markers), which is what makes a recolour
 *  survive a theme change. */
export function edgeColorPatch(key: ColorKey, existing?: {markerEnd?: FlowEdgeMarker; markerStart?: FlowEdgeMarker}) {
  const color = COLOR_VAR[key];
  const patch: {style: {stroke: string}; data: {strokeKey: ColorKey}; markerEnd?: FlowEdgeMarker; markerStart?: FlowEdgeMarker} =
    {style: {stroke: color}, data: {strokeKey: key}};
  /* FlowEdgeMarker is `string | EdgeMarker`; only the OBJECT form carries a colour to
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
export function edgeColorLiteralPatch(hex: string, existing?: {markerEnd?: FlowEdgeMarker; markerStart?: FlowEdgeMarker}) {
  const patch: {style: {stroke: string}; data: {color: string; strokeKey: undefined}; markerEnd?: FlowEdgeMarker; markerStart?: FlowEdgeMarker} =
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

/* UNISURF-S13 (2026-11-09) — the ERD preset's NEW-EDGE defaults, and the reason
   they are plain. ROUND BG (2026-10-24) found Harvey drawing a plain arrow on a
   stored 'erd'-preset board and every new edge arriving crow-footed: the markers
   were seeded from the BOARD's preset, so they described the board, not the edge.
   The fix then was a global switch that also hid the shapes; the replacement is
   this: a NEW edge is a plain ArrowClosed on EVERY preset, because a plain arrow
   is plain by what it connects. Crow is authored at the CONNECTION — the FK
   writer (`useConnections.fkConnect`) and the erdTemplate's own seeded
   relationships — and `makeEdge` still honours an explicit seed for them.
   Stored boards keep their baked markers: this is a DEFAULTS table, never a
   board rewrite. */
export const ERD_PRESET_EDGES: EdgeDefaults = {
  path: 'smoothstep',
  strokeKey: 'slate',
  dash: 'solid',
  markerStart: null,
  markerEnd: MarkerType.ArrowClosed,
  strokeWidth: 1.6,
  flowAllowed: false,
};

/* UNISURF-S13 — TEMPLATE-LOCAL defaults for `erdTemplate`'s authored
   relationship edges (dataStorage.ts). Deliberately a COPY of the preset's
   defaults, not a reference: the template's look and the board's new-edge look
   are separate decisions, and neither may restyle the other. No crow lives
   here either — each seeded relationship states its own cardinality
   (crowStart/crowEnd on the seed). */
export const ERD_EDGES: EdgeDefaults = {...ERD_PRESET_EDGES};
