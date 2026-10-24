import {MarkerType, type Edge, type Node} from '@xyflow/react';
import type {EdgeMarkerType} from '@xyflow/system';
import {COLOR_VAR, type ColorKey} from './colors';
import {PALETTE, type DiagramType, type PaletteCategory, type PaletteItem} from './palette';
import {type Shape, FLOWCHART_EXTRA_SHAPES} from './shapes';
import {gridLayout, layoutDiagram, type LayoutDirection, type LayoutSpacing} from './layout';
import {type CrowFoot} from './crowfoot';
import {type ThemeName} from './theme';
import {type ShowMode, type TableColumn} from './TableNode';
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

/* ===========================================================================
   L3b — C4 element table. ZERO new shapes: eight of the nine C4 primitives
   already exist, and the ninth (`external`) is already a dashed rect.
   Colours deliberately stay on our six themed accents — c4model.com states the
   blue/grey palette is NOT mandated; what must be consistent is the MAPPING.
=========================================================================== */

export type C4Type =
  | 'person' | 'personExternal'
  | 'system' | 'systemExternal'
  | 'container' | 'containerDb' | 'containerQueue' | 'containerStore' | 'containerExternal'
  | 'component' | 'componentDb' | 'componentQueue'
  | 'boundarySystem' | 'boundaryContainer' | 'boundaryEnterprise';

export const C4: Record<C4Type, {level: 1 | 2 | 3; shape: Shape; colorKey: ColorKey; kicker: string; icon: string; sub: string; hint: string}> = {
  person:            {level: 1, shape: 'actor',    colorKey: 'green',  kicker: '[Person]',                      icon: 'user',    sub: 'a user of the system', hint: 'actor · in scope'},
  personExternal:    {level: 1, shape: 'actor',    colorKey: 'slate',  kicker: '[Person, External]',             icon: 'user',    sub: 'outside the organisation', hint: 'actor · external'},
  system:            {level: 1, shape: 'service',  colorKey: 'cyan',   kicker: '[Software System]',              icon: 'server',  sub: 'the system in scope', hint: 'system · in scope'},
  systemExternal:    {level: 1, shape: 'external', colorKey: 'accent', kicker: '[Software System, External]',    icon: 'cloud',   sub: 'third-party system', hint: 'system · external'},
  container:         {level: 2, shape: 'service',  colorKey: 'cyan',   kicker: '[Container: application]',       icon: 'box', sub: 'technology', hint: 'container · app'},
  containerDb:       {level: 2, shape: 'database', colorKey: 'violet', kicker: '[Container: database]',          icon: 'database', sub: 'technology', hint: 'container · database'},
  containerQueue:    {level: 2, shape: 'queue',    colorKey: 'amber',  kicker: '[Container: queue]',             icon: 'layers',  sub: 'technology', hint: 'container · queue'},
  containerStore:    {level: 2, shape: 'storage',  colorKey: 'amber',  kicker: '[Container: object store]',      icon: 'package', sub: 'technology', hint: 'container · store'},
  containerExternal: {level: 2, shape: 'external', colorKey: 'slate',  kicker: '[Container, External]',          icon: 'cloud',   sub: 'technology', hint: 'container · 3rd party'},
  component:         {level: 3, shape: 'service',  colorKey: 'green',  kicker: '[Component]',                    icon: 'box',     sub: 'technology', hint: 'part · inside a container'},
  componentDb:       {level: 3, shape: 'database', colorKey: 'violet', kicker: '[Component: store]',             icon: 'database', sub: 'technology', hint: 'component · store'},
  componentQueue:    {level: 3, shape: 'queue',    colorKey: 'amber',  kicker: '[Component: queue]',             icon: 'layers',  sub: 'technology', hint: 'component · queue'},
  boundarySystem:    {level: 2, shape: 'group',    colorKey: 'cyan',   kicker: '[System boundary]',              icon: '',        sub: 'boundary', hint: 'boundary · one system'},
  boundaryContainer: {level: 3, shape: 'group',    colorKey: 'violet', kicker: '[Container boundary]',           icon: '',        sub: 'boundary', hint: 'boundary · one container'},
  boundaryEnterprise:{level: 1, shape: 'group',    colorKey: 'slate',  kicker: '[Enterprise boundary]',          icon: '',        sub: 'boundary', hint: 'boundary · enterprise'},
};

export const C4_TYPES = Object.keys(C4) as C4Type[];
export const isC4Type = (v: unknown): v is C4Type =>
  typeof v === 'string' && Object.prototype.hasOwnProperty.call(C4, v);

/* The 11 C4 elements the palette offers, in C4_TYPES order. Factored out of
   `C4_PRESET.palette` (v2 §2.5) so the ONE LIBRARY and the `c4` preset's
   derived palette share the same objects instead of two parallel literals. */
const C4_PALETTE_TYPES: C4Type[] = [
  'person', 'personExternal', 'system', 'systemExternal', 'container', 'containerDb',
  'containerQueue', 'containerStore', 'component', 'boundarySystem', 'boundaryContainer',
];

const c4PaletteItem = (t: C4Type): PaletteItem => {
  const e = C4[t];
  return {
    label: e.kicker.replace(/[[\]]/g, ''),
    hint: e.hint, shape: e.shape, colorKey: e.colorKey, kind: 'goblin',
    category: 'c4', types: ['c4'],
    /* AQ20 — every C4 entry shares the c4 category, so the generic
       SOURCE_PURPOSE sentence made all C4 rows read identically in search.
       The level + the C4 element's own description say what THIS one is. */
    purpose: `a level-${e.level} C4 element — ${e.sub}`,
    size: e.shape === 'group' ? {width: 460, height: 300} : undefined,
    make: () => ({
      shape: e.shape, kicker: e.kicker, title: e.kicker.replace(/[[\]]/g, ''),
      sub: e.sub, metric: '', metricUnit: '', icon: e.icon, colorKey: e.colorKey, c4Type: t,
    }),
  };
};

const C4_PALETTE_ITEMS: PaletteItem[] = C4_PALETTE_TYPES.map(c4PaletteItem);

/* ROUND AK, AK-8 — `C4_LABELS` WAS HERE, and it is DELETED.
   It was the C4 preset's list of relationship intent VERB PHRASES ("uses",
   "publishes events to · Kafka", …) that the edge panel offered as one-click
   label buttons. It was gated on the board's preset, so it appeared or vanished
   according to a board-level fact rather than anything about the edge in front
   of the user — the defect Harvey asked about ("tại sao sidebar của line lại
   khác nhau ở mỗi type?"). Removing it (with the field and its two data sites)
   deletes the gate outright rather than re-keying it: the row offered no
   capability the plain `label` input does not, and draw.io's edge Format panel
   has no equivalent. The `technology` input that the C4 preset ALSO needs is a
   different field and stays (`technField`). */

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

const c4Edge = (e: EdgeDefaults, id: string, from: string, to: string, label: string, techn?: string) =>
  makeEdge(from, to, e, id, {label, techn});

const c4Node = (
  id: string, type: C4Type, title: string, sub: string, x: number, y: number,
  extra: Record<string, unknown> = {},
): Node => {
  const t = C4[type];
  return {
    id, type: 'goblin', position: {x, y},
    data: {
      shape: t.shape, kicker: t.kicker, title, sub, metric: '', metricUnit: '',
      icon: t.icon, colorKey: t.colorKey, c4Type: type, ...extra,
    },
  };
};

/* ---------------- C4 templates (§D.6, canonical wording) ---------------- */

const c4ContextTemplate: TemplateSpec = {
  id: 'c4-context',
  label: 'C4 Context',
  hint: 'one system + its people and neighbours · L1',
  nodes: [
    c4Node('customer', 'person', 'Personal Banking Customer', 'A customer of the bank, with personal bank accounts', 0, 200),
    c4Node('banking', 'system', 'Internet Banking System', 'Allows customers to view information about their bank accounts, and make payments', 300, 200),
    c4Node('mainframe', 'systemExternal', 'Mainframe Banking System', 'Stores all of the core banking information about customers, accounts, transactions, etc', 640, 90),
    c4Node('email', 'systemExternal', 'E-mail System', 'The internal Microsoft Exchange e-mail system', 640, 320),
    {
      id: 'title', type: 'label', position: {x: 0, y: 60},
      data: {text: 'System Context diagram for Internet Banking System'},
    },
  ],
  edges: [
    c4Edge(C4_EDGES, 'c1', 'customer', 'banking', 'Views account balances, and makes payments using'),
    c4Edge(C4_EDGES, 'c2', 'banking', 'mainframe', 'Gets account information from, and makes payments using'),
    c4Edge(C4_EDGES, 'c3', 'banking', 'email', 'Sends e-mail using'),
    c4Edge(C4_EDGES, 'c4', 'email', 'customer', 'Sends e-mails to'),
  ],
};

const c4ContainerTemplate: TemplateSpec = {
  id: 'c4-container',
  label: 'C4 Container',
  hint: 'containers inside one system boundary · L2',
  nodes: [
    c4Node('customer', 'person', 'Personal Banking Customer', 'A customer of the bank, with personal bank accounts', 0, 300),
    c4Node('email', 'systemExternal', 'E-mail System', 'The internal Microsoft Exchange e-mail system', 60, 20),
    c4Node('mainframe', 'systemExternal', 'Mainframe Banking System', 'Stores all of the core banking information', 60, 640),
    {
      id: 'boundary', type: 'goblin', position: {x: 300, y: 40},
      style: {width: 460, height: 560},
      data: {shape: 'group', title: 'Internet Banking System', sub: '[System boundary]', kicker: '', metric: '', metricUnit: '', icon: '', colorKey: 'cyan', c4Type: 'boundarySystem'},
    },
    c4Node('web', 'container', 'Web Application', 'Java, Spring MVC', 360, 110),
    c4Node('spa', 'container', 'Single-Page Application', 'JavaScript, Angular', 360, 210),
    c4Node('mobile', 'container', 'Mobile App', 'Kotlin, iOS / Android', 360, 310),
    c4Node('api', 'container', 'API Application', 'Java, Spring Boot', 360, 410),
    c4Node('db', 'containerDb', 'Database', 'MySQL 8', 360, 510),
    c4Node('bus', 'containerQueue', 'Message Bus', 'Kafka', 620, 110),
    {
      id: 'title', type: 'label', position: {x: 0, y: 0},
      data: {text: 'Container diagram for Internet Banking System'},
    },
  ],
  edges: [
    c4Edge(C4_EDGES, 'e1', 'customer', 'web', 'Views account balances, and makes payments using', 'HTTPS'),
    c4Edge(C4_EDGES, 'e2', 'customer', 'spa', 'Views account balances, and makes payments using', 'HTTPS'),
    c4Edge(C4_EDGES, 'e3', 'customer', 'mobile', 'Views account balances, and makes payments using', 'HTTPS'),
    c4Edge(C4_EDGES, 'e4', 'spa', 'api', 'Makes API calls to', 'JSON/HTTPS'),
    c4Edge(C4_EDGES, 'e5', 'mobile', 'api', 'Makes API calls to', 'JSON/HTTPS'),
    c4Edge(C4_EDGES, 'e6', 'api', 'db', 'Reads from and writes to', 'sync, JDBC'),
    c4Edge(C4_EDGES, 'e7', 'api', 'bus', 'Publishes events to', 'async, Kafka'),
    c4Edge(C4_EDGES, 'e8', 'api', 'mainframe', 'Gets account information from, and makes payments using', 'XML/HTTPS'),
    c4Edge(C4_EDGES, 'e9', 'api', 'email', 'Sends e-mail using', 'SMTP'),
  ],
};

/* ===========================================================================
   L3a — flowchart palette (ISO 5807). `preparation` adapts the gateway hexagon.
=========================================================================== */

/* ROUND AA, ITEM 3 — `Process` and `Decision` were filed under `basic` while
   the other nine flowchart items passed `flowchart`: a typo from the palette
   build, not a decision. They are the two most fundamental ISO 5807 shapes, so
   they belong to their namesake section like every other flowchart symbol.
   Effect: `Basic` now holds exactly `Text` (the one generic item, whose
   definition lives in `PALETTE` and is referenced rather than duplicated), and
   `Flowchart` holds the other ten. `types` is untouched, so the flowchart VIEW,
   the search index and insertion are unaffected — only the SECTION moves. */
const fc = (
  label: string, hint: string, shape: Shape, colorKey: ColorKey, title: string,
  category: PaletteCategory, types: DiagramType[], aliases: string[], geometry: string,
  size?: {width: number; height: number}, icon = '',
): PaletteItem => ({
  label, hint, shape, colorKey, kind: 'goblin', size, category, types, aliases, geometry,
  make: () => ({shape, kicker: '', title, sub: '', metric: '', metricUnit: '', icon, colorKey, body: 'label-only', handles: 'tb'} as any),
});

const FLOW: DiagramType[] = ['flowchart'];

/** The ONE generic `Note` (v2 §12.7). Its definition lives in PALETTE; the
 *  flowchart and C4 palettes reference THIS object rather than repeating a
 *  literal, so the panel can never list `Note` twice. */
const NOTE_ITEM: PaletteItem = PALETTE.find(p => p.label === 'Note') as PaletteItem;

/* ===========================================================================
   ROUND AF — THE ONE DEFAULT SIZE FOR EVERY FLOWCHART SHAPE.

   RATIO 2.0 IS NOT A TASTE, IT IS THE FRAME'S OWN RATIO. Every silhouette is
   drawn ONCE in a normalised frame — `viewBox="0 0 200 100"` with
   `preserveAspectRatio="none"` (`ShapeFrame`, src/shapes.tsx) — so the drawing is
   STRETCHED to whatever box the node is handed, and 200:100 = 2.0 is the single
   ratio at which each shape paints exactly as drawn. At every other ratio the
   silhouette is distorted: a circle flattens into an ellipse, the terminal's
   round caps go elliptical. The three sizes this palette used to carry were
   1.50 (Terminal 270x180), 1.56 (Decision 150x96) and 1.00 (On-page connector
   84x84) — all three distorted, and the thirteen entries with NO size fell to
   `.node { min-width: 190px }` at auto height, i.e. a 190-wide sliver tens of
   pixels tall. One size at one ratio removes the distortion instead of hiding
   it, and removes the "one shape is huge and the rest are slivers" read.

   WHY 290x145 AND NOT 280x140. 280x140 is the approved size and it has the right
   SHAPE, but 140 is 1px BELOW this app's own resizer floor (`NODE_MIN_H` = 141,
   src/DiagramNode.tsx). React Flow's resizer does not lift a below-floor node up
   to the floor. Its clamp is
   `getSizeClamp(size, minSize, maxSize) = max(0, minSize - size, size - maxSize)`,
   which returns 1 for a 140-tall node, and a HORIZONTAL drag folds that into the
   vertical delta as a SUBTRACTION — so grabbing a left/right grip silently
   shrinks the height to 139, then 137, 133, 125 … to zero, because each drag
   re-reads the height the previous one ate. EXECUTED against the shipped
   `getDimensionsAfterResize` (see `checks/round-af-flowchart-sizes.mjs`): a
   140-tall node collapses on a horizontal drag while a 145-tall node is inert.
   145 clears the 141 height floor AND the 200 width floor with real slack, at
   exactly ratio 2.0 (290/145 = 2.000). It is still ~13% less area than the
   270x180 Terminal Harvey called too big, so the fix brings the Terminal DOWN
   rather than inflating the other fifteen shapes. */
export const FLOWCHART_NODE_SIZE = {width: 290, height: 145} as const;

/* ROUND BE (2026-10-23) — the connector is SQUARE. Its silhouette is a circle
   (shapes.tsx now draws it in a square frame, where it reaches every edge), so
   its default node must be square or NodeResizer's grips sit in the dead
   corners the 2:1 box added (Harvey: "4 góc mũi tên xa so với hình tròn").
   152x152 is the ratio-2.0 default's own SHORT edge (145) raised to the next
   grid-16 multiple, so the circle is the same visual height as every sibling
   on the palette while being genuinely round. Every other flowchart shape
   stays on FLOWCHART_NODE_SIZE. */
export const CONNECTOR_NODE_SIZE = {width: 152, height: 152} as const;

const FLOWCHART_PALETTE: PaletteItem[] = [
  fc('Terminal', 'stadium · start / end', 'terminator', 'green', 'Start', 'flowchart', FLOW, ['start', 'end', 'start / end', 'pill', 'stop', 'terminator'], 'stadium', FLOWCHART_NODE_SIZE),
  fc('Process', 'rect · action step', 'process', 'cyan', 'Process step', 'flowchart', FLOW, ['rect', 'step', 'action', 'action step', 'task'], 'rect', FLOWCHART_NODE_SIZE),
  fc('Decision', 'diamond · yes / no', 'decision', 'amber', 'Decision?', 'flowchart', FLOW, ['diam', 'diamond', 'question', 'branch'], 'diamond', FLOWCHART_NODE_SIZE),
  fc('Input / Output', 'parallelogram · data', 'io', 'violet', 'Read input', 'flowchart', FLOW, ['io', 'input', 'output', 'data', 'parallelogram'], 'parallelogram', FLOWCHART_NODE_SIZE),
  fc('Document', 'wavy base · in or out', 'document', 'violet', 'Document', 'flowchart', FLOW, ['doc', 'report', 'produced doc'], 'wavy base', FLOWCHART_NODE_SIZE),
  fc('Predefined process', 'double-bar rect', 'subprocess', 'cyan', 'Subprocess', 'flowchart', FLOW, ['subprocess', 'subproc', 'subroutine', 'fr-rect', 'predefined'], 'double-bar rect', FLOWCHART_NODE_SIZE),
  fc('Preparation', 'hexagon · setup', 'preparation', 'cyan', 'Initialise', 'flowchart', FLOW, ['initialization', 'initialisation', 'setup', 'init', 'hex'], 'hexagon', FLOWCHART_NODE_SIZE),
  fc('Manual operation', 'trapezoid · by hand', 'manual', 'green', 'Manual step', 'flowchart', FLOW, ['manual step', 'manual', 'person'], 'trapezoid', FLOWCHART_NODE_SIZE),
  fc('Delay', 'D-shape · wait', 'delay', 'amber', 'Wait', 'flowchart', FLOW, ['wait', 'pause'], 'D-shape', FLOWCHART_NODE_SIZE),
  fc('On-page connector', 'circle · jump', 'connector', 'slate', 'A', 'flowchart', FLOW, ['connector', 'circle', 'reference', 'jump', 'on-page'], 'circle', CONNECTOR_NODE_SIZE),
  /* ROUND AD, ITEM 2 — the six additions. Colour keys follow the SAME semantic
     grouping as the ten above (Option B), so the key stays one idea:
       offpage          slate  — a routing marker, like On-page connector
       manualinput      green  — entry / exit-ish: data arriving from outside
       display          violet — I/O, beside Input / Output and Document
       storeddata       violet — a store read/written, beside Document's violet
       looplimit        amber  — control (loop start), beside Decision / Delay
       internalstorage  violet — I/O-adjacent, a store; the cylinder's sibling */
  fc('Off-page connector', 'home plate · another page', 'offpage', 'slate', 'Off page', 'flowchart', FLOW, ['off page', 'off-page', 'offpage', 'home plate', 'another page', 'next page'], 'home plate', FLOWCHART_NODE_SIZE),
  fc('Manual input', 'sloped top · by keyboard', 'manualinput', 'green', 'Manual input', 'flowchart', FLOW, ['manual input', 'keyboard', 'typed', 'form', 'sloped top'], 'sloped top', FLOWCHART_NODE_SIZE),
  fc('Display', 'curved trapezoid · show data', 'display', 'violet', 'Show result', 'flowchart', FLOW, ['display', 'screen', 'show', 'report', 'output device'], 'curved trapezoid', FLOWCHART_NODE_SIZE),
  fc('Stored data', 'cylinder · read / write', 'storeddata', 'violet', 'Stored data', 'flowchart', FLOW, ['stored data', 'store', 'database', 'db', 'read write', 'cylinder'], 'cylinder', FLOWCHART_NODE_SIZE),
  fc('Loop limit', 'notched top · loop start', 'looplimit', 'amber', 'Loop', 'flowchart', FLOW, ['loop limit', 'loop', 'loop start', 'notched top', 'iteration'], 'notched top', FLOWCHART_NODE_SIZE),
  fc('Internal storage', 'pane rect · in-memory', 'internalstorage', 'violet', 'In memory', 'flowchart', FLOW, ['internal storage', 'in memory', 'memory', 'pane rect', 'ram'], 'pane rect', FLOWCHART_NODE_SIZE),
  {
    label: 'Lane', hint: 'container · role', shape: 'group', colorKey: 'slate', kind: 'goblin',
    category: 'groups', types: FLOW, aliases: ['swimlane', 'pool', 'role', 'container', 'system'], geometry: 'dashed boundary band',
    size: {width: 420, height: 200},
    make: () => ({shape: 'group', kicker: '', title: 'Lane', sub: 'role', metric: '', metricUnit: '', icon: '', colorKey: 'slate'} as any),
  },
  NOTE_ITEM,
];

const flowNode = (
  id: string, shape: Shape, title: string, colorKey: ColorKey, x: number, y: number,
  size?: {width: number; height: number},
): Node => ({
  id, type: 'goblin', position: {x, y},
  ...(size ? {style: {width: size.width, height: size.height}} : null),
  data: {shape, kicker: '', title, sub: '', metric: '', metricUnit: '', icon: '', colorKey, body: 'label-only', handles: 'tb'},
});

/* ROUND 4, ITEM 4 (2026-09-20) — THE `approval` TEMPLATE IS DELETED.

   Harvey, verbatim: "à ngoài ra xoá flowchart template Approve nhé".

   Removed here: `flowchartApprovalTemplate` (id `approval`, label "Approval
   request", "two lanes · decision · Yes/No · loop-back"), its entry in the
   flowchart preset's `templates` array, the `lane()` helper that built its three
   FROZEN BAND (`group`) nodes and existed for that template alone, and the
   layout-regression comments that named it. The flowchart family now ships
   `flow-basic`, `flow-advanced`, `flow-complex`.

   WHAT THIS COSTS, RECORDED (not hidden): `approval` was the only shipped
   template that exercised `LayoutSpec.bandGroups` — top-level `group` nodes
   frozen at their authored coordinates while the rest is re-placed — and the
   only one whose connector PAIR (`a9 → a10 → a2`) made a genuine back-edge the
   layout engine had to remove as a feedback arc. §8 Q2's lane work is a future
   round by design (D3: the three new templates use NO Lane nodes), so no
   shipped template covers that path after this deletion. Nothing else in `src/`
   reads `lane`, and no board on disk stores a template id, so there is nothing
   to migrate. Its replacement regression case is `flow-advanced`'s connector
   pair (`c11`/`c12`), which covers the back-edge half only. */

/* ===========================================================================
   PACKAGE-TEMPLATES §4 — THE FLOWCHART TEMPLATE FAMILY.

   ONE DOMAIN (online ordering and delivery, D5) at three depths. The ladder is
   NOT "3, 8 and 16 shapes picked by feel": it is THREE CONTIGUOUS BANDS of the
   palette above, which is already ordered by increasing difficulty —
     basic    = palette rows 0-4   (terminator, process, decision, io, document)
     advanced = rows 0-9           (+ subprocess, preparation, manual, delay, connector)
     complex  = rows 0-15          (all 16 ISO 5807 ids)
   so the difficulty claim IS how far down the curated palette a level goes, and
   the shape assertions are one-line probes over `palette.slice(0, N)`.

   D3/D4 INVARIANTS (measured, not guessed — do not "improve" on them):
   no `group`/Lane node anywhere in these three, and no `label` node either.
   `LAYOUTS['layered-tb']` FREEZES top-level `group` nodes at their authored
   coordinates while re-placing every other node, and it parks an edge-less
   annotation node (label OR note) in a trailing ORPHAN row AFTER the last
   layer. A phase heading is an annotation, so on Auto-arrange it would be
   flung to the bottom of the board (measured: an isolated `label` authored at
   x 60, y 40 came out at x -140, y 2150 below a flow ending at y 1935). A
   footnote below the flow is CORRECT, which is why the single `note` stays and
   the headings go. Lane usage is deferred to its own future round.
=========================================================================== */

/** The single footnote node (advanced + complex). Not a flowchart shape: the
 *  shape-set probes exclude `note`, exactly as they exclude `group`/`label`. */
const flowNote = (id: string, text: string, x: number, y: number): Node => ({
  id, type: 'goblin', position: {x, y}, style: {width: 400, height: 200},
  data: {shape: 'note', kicker: 'note', title: text, sub: '', metric: '', metricUnit: '', icon: 'sticky-note', colorKey: 'slate'},
});

/* LEVEL 1 — BASIC. 10 flow nodes, 11 edges, 5 shapes, one genuine back-edge
   (b9 → b8: "retry"). Colour keys stay inside the flowchart preset's OWN legend
   — no new key, no new token. Node text obeys the per-symbol grammar (§4.0, D6):
   process = ACTION (an imperative), decision = QUESTION (ends in "?"),
   io / document = DATA (a noun phrase naming the thing), terminator = MARKER
   (a state). The five violations §4.0 measured are exactly the cases this fixes. */
const flowchartBasicTemplate: TemplateSpec = {
  id: 'flow-basic',
  label: 'Place an online order',
  hint: 'basic · 5 common shapes · one retry-the-payment loop',
  level: 'basic',
  order: 1,
  nodes: [
    flowNode('b1', 'terminator', 'Order started', 'green', 380, 60, FLOWCHART_NODE_SIZE),
    flowNode('b2', 'io', 'Cart items and prices', 'violet', 380, 275, FLOWCHART_NODE_SIZE),
    flowNode('b3', 'process', 'Check stock for each item', 'cyan', 380, 490, FLOWCHART_NODE_SIZE),
    flowNode('b4', 'decision', 'All items in stock?', 'amber', 380, 705, FLOWCHART_NODE_SIZE),
    flowNode('b5', 'process', 'Email the customer about missing items', 'cyan', 0, 920, FLOWCHART_NODE_SIZE),
    flowNode('b6', 'process', 'Reserve the items', 'cyan', 380, 920, FLOWCHART_NODE_SIZE),
    flowNode('b7', 'document', 'Order confirmation', 'violet', 380, 1135, FLOWCHART_NODE_SIZE),
    flowNode('b8', 'decision', 'Payment cleared?', 'amber', 380, 1350, FLOWCHART_NODE_SIZE),
    flowNode('b9', 'process', 'Retry the payment', 'cyan', 0, 1565, FLOWCHART_NODE_SIZE),
    flowNode('b10', 'terminator', 'Order confirmed', 'green', 380, 1565, FLOWCHART_NODE_SIZE),
  ],
  edges: [
    makeEdge('b1', 'b2', FLOWCHART_EDGES, 'fb1'),
    makeEdge('b2', 'b3', FLOWCHART_EDGES, 'fb2'),
    makeEdge('b3', 'b4', FLOWCHART_EDGES, 'fb3'),
    makeEdge('b4', 'b6', FLOWCHART_EDGES, 'fb4', {label: 'Yes'}),
    makeEdge('b4', 'b5', FLOWCHART_EDGES, 'fb5', {label: 'No'}),
    makeEdge('b5', 'b6', FLOWCHART_EDGES, 'fb6'),
    makeEdge('b6', 'b7', FLOWCHART_EDGES, 'fb7'),
    makeEdge('b7', 'b8', FLOWCHART_EDGES, 'fb8'),
    makeEdge('b8', 'b10', FLOWCHART_EDGES, 'fb9', {label: 'Yes'}),
    // the genuine back-edge: b9 → b8 re-enters the decision that produced it,
    // so the engine must remove it from the DAG (it is the ONLY feedback arc
    // here) and never collapse the loop onto layer 0.
    makeEdge('b8', 'b9', FLOWCHART_EDGES, 'fb10', {label: 'No'}),
    makeEdge('b9', 'b8', FLOWCHART_EDGES, 'fb11', {label: 'retry'}),
  ],
};

/* LEVEL 2 — ADVANCED. 14 flow nodes + 1 note = 15 nodes, 15 edges, 10 shapes.
   The connector is a PAIR (c11/c12, "A") so the redo step is an on-page jump
   rather than a long edge — the family's layout-regression case for a genuine
   back-edge now that the `approval` template is gone (ROUND 4, ITEM 4). */
const flowchartAdvancedTemplate: TemplateSpec = {
  id: 'flow-advanced',
  label: 'Order — stock to packing',
  hint: 'advanced · adds subprocess, preparation, manual, delay, connector · no lanes',
  level: 'advanced',
  order: 1,
  nodes: [
    flowNode('c1', 'terminator', 'Packing started', 'green', 380, 60, FLOWCHART_NODE_SIZE),
    flowNode('c2', 'io', 'Stock reserved for the order', 'violet', 380, 275, FLOWCHART_NODE_SIZE),
    flowNode('c3', 'preparation', 'Set up the packing station', 'cyan', 380, 490, FLOWCHART_NODE_SIZE),
    flowNode('c4', 'decision', 'Any item marked fragile?', 'amber', 380, 705, FLOWCHART_NODE_SIZE),
    flowNode('c5', 'manual', 'Wrap the fragile item by hand', 'green', 0, 920, FLOWCHART_NODE_SIZE),
    flowNode('c6', 'subprocess', 'Run the packing procedure (set out on its own sheet)', 'cyan', 380, 920, FLOWCHART_NODE_SIZE),
    flowNode('c7', 'delay', 'Waiting for the courier pickup', 'amber', 380, 1135, FLOWCHART_NODE_SIZE),
    flowNode('c8', 'process', 'Seal and label the parcel', 'cyan', 380, 1350, FLOWCHART_NODE_SIZE),
    flowNode('c9', 'document', 'Packing slip', 'violet', 380, 1565, FLOWCHART_NODE_SIZE),
    flowNode('c10', 'decision', 'Parcel matches the packing slip?', 'amber', 380, 1780, FLOWCHART_NODE_SIZE),
    flowNode('c11', 'connector', 'A', 'slate', 760, 1780, CONNECTOR_NODE_SIZE),
    flowNode('c12', 'connector', 'A', 'slate', 760, 1995, CONNECTOR_NODE_SIZE),
    flowNode('c13', 'process', 'Hand the parcel to the courier', 'cyan', 380, 1995, FLOWCHART_NODE_SIZE),
    flowNode('c14', 'terminator', 'Packing done', 'green', 380, 2210, FLOWCHART_NODE_SIZE),
    flowNote('cNote', 'Packing runs on its own sheet: it is a sub-assembly of the order, not a step of it.', 760, 60),
  ],
  edges: [
    makeEdge('c1', 'c2', FLOWCHART_EDGES, 'fa1'),
    makeEdge('c2', 'c3', FLOWCHART_EDGES, 'fa2'),
    makeEdge('c3', 'c4', FLOWCHART_EDGES, 'fa3'),
    makeEdge('c4', 'c5', FLOWCHART_EDGES, 'fa4', {label: 'Yes'}),
    makeEdge('c4', 'c6', FLOWCHART_EDGES, 'fa5', {label: 'No'}),
    makeEdge('c5', 'c6', FLOWCHART_EDGES, 'fa6'),
    makeEdge('c6', 'c7', FLOWCHART_EDGES, 'fa7'),
    makeEdge('c7', 'c8', FLOWCHART_EDGES, 'fa8'),
    makeEdge('c8', 'c9', FLOWCHART_EDGES, 'fa9'),
    makeEdge('c9', 'c10', FLOWCHART_EDGES, 'fa10'),
    makeEdge('c10', 'c13', FLOWCHART_EDGES, 'fa11', {label: 'Yes'}),
    // the connector pair: c12 → c8 re-enters c8 (several layers upstream of
    // c11), so this is a genuine back-edge through an on-page jump.
    makeEdge('c10', 'c11', FLOWCHART_EDGES, 'fa12', {label: 'No — mismatch'}),
    makeEdge('c11', 'c12', FLOWCHART_EDGES, 'fa13'),
    makeEdge('c12', 'c8', FLOWCHART_EDGES, 'fa14', {label: 'repack'}),
    makeEdge('c13', 'c14', FLOWCHART_EDGES, 'fa15'),
  ],
};

/* LEVEL 3 — COMPLEX. 24 flow nodes + 1 note = 25 nodes, 27 edges, ALL 16
   flowchart shape ids, three genuine back-edges (d13→d12, d18→d11 through the
   connector pair, d23→d22) plus the d20→d21 page hand-off. Every symbol has an
   honest job in the process — no node exists only to carry a shape. */
const flowchartComplexTemplate: TemplateSpec = {
  id: 'flow-complex',
  label: 'Online order — full notation',
  hint: 'complex · all 16 flowchart shapes · two pages',
  level: 'complex',
  order: 1,
  nodes: [
    flowNode('d1', 'terminator', 'Order placed', 'green', 380, 70, FLOWCHART_NODE_SIZE),
    flowNode('d2', 'io', 'Order accepted — items and prices', 'violet', 380, 285, FLOWCHART_NODE_SIZE),
    flowNode('d3', 'document', 'Order confirmation', 'violet', 380, 500, FLOWCHART_NODE_SIZE),
    flowNode('d4', 'manualinput', 'Recipient phone number', 'green', 380, 715, FLOWCHART_NODE_SIZE),
    flowNode('d5', 'preparation', 'Set up the packing station', 'cyan', 380, 930, FLOWCHART_NODE_SIZE),
    flowNode('d6', 'decision', 'Any item marked fragile?', 'amber', 380, 1145, FLOWCHART_NODE_SIZE),
    flowNode('d7', 'manual', 'Wrap the fragile item by hand', 'green', 0, 1360, FLOWCHART_NODE_SIZE),
    flowNode('d8', 'subprocess', 'Run the packing procedure (set out on its own sheet)', 'cyan', 760, 1360, FLOWCHART_NODE_SIZE),
    flowNode('d9', 'display', 'Order total and shipping fee', 'violet', 380, 1575, FLOWCHART_NODE_SIZE),
    flowNode('d10', 'internalstorage', 'Cart items, kept until the session closes', 'violet', 380, 1790, FLOWCHART_NODE_SIZE),
    flowNode('d11', 'looplimit', 'For each of 8 items', 'amber', 380, 2005, FLOWCHART_NODE_SIZE),
    flowNode('d12', 'process', 'Pack the next cart item', 'cyan', 380, 2220, FLOWCHART_NODE_SIZE),
    flowNode('d13', 'decision', 'Items left to pack?', 'amber', 380, 2435, FLOWCHART_NODE_SIZE),
    flowNode('d14', 'delay', 'Waiting for the courier pickup', 'amber', 380, 2650, FLOWCHART_NODE_SIZE),
    flowNode('d15', 'process', 'Seal and label the parcel', 'cyan', 380, 2865, FLOWCHART_NODE_SIZE),
    flowNode('d16', 'decision', 'Parcel matches the packing slip?', 'amber', 380, 3080, FLOWCHART_NODE_SIZE),
    flowNode('d17', 'connector', 'A', 'slate', 760, 3080, CONNECTOR_NODE_SIZE),
    flowNode('d18', 'connector', 'A', 'slate', 1140, 3080, CONNECTOR_NODE_SIZE),
    flowNode('d19', 'storeddata', 'Order history log', 'violet', 380, 3295, FLOWCHART_NODE_SIZE),
    flowNode('d20', 'offpage', 'To page 2: deliver the parcel', 'slate', 380, 3510, FLOWCHART_NODE_SIZE),
    flowNode('d21', 'offpage', 'From page 1: order packed', 'slate', 380, 3725, FLOWCHART_NODE_SIZE),
    flowNode('d22', 'process', 'Load the parcel on the van', 'cyan', 380, 3940, FLOWCHART_NODE_SIZE),
    flowNode('d23', 'decision', 'Address found by the courier?', 'amber', 380, 4155, FLOWCHART_NODE_SIZE),
    flowNode('d24', 'terminator', 'Order delivered', 'green', 380, 4370, FLOWCHART_NODE_SIZE),
    flowNote('dNote', 'Two pages: page 1 takes the order to a sealed parcel, page 2 delivers it. The off-page connectors mark the page break.', 760, 70),
  ],
  edges: [
    makeEdge('d1', 'd2', FLOWCHART_EDGES, 'fx1'),
    makeEdge('d2', 'd3', FLOWCHART_EDGES, 'fx2'),
    makeEdge('d3', 'd4', FLOWCHART_EDGES, 'fx3'),
    makeEdge('d4', 'd5', FLOWCHART_EDGES, 'fx4'),
    makeEdge('d5', 'd6', FLOWCHART_EDGES, 'fx5'),
    makeEdge('d6', 'd7', FLOWCHART_EDGES, 'fx6', {label: 'Yes'}),
    makeEdge('d6', 'd8', FLOWCHART_EDGES, 'fx7', {label: 'No'}),
    makeEdge('d7', 'd9', FLOWCHART_EDGES, 'fx8'),
    makeEdge('d8', 'd9', FLOWCHART_EDGES, 'fx9'),
    makeEdge('d9', 'd10', FLOWCHART_EDGES, 'fx10'),
    makeEdge('d10', 'd11', FLOWCHART_EDGES, 'fx11'),
    makeEdge('d11', 'd12', FLOWCHART_EDGES, 'fx12'),
    makeEdge('d12', 'd13', FLOWCHART_EDGES, 'fx13'),
    // back-edge 1 — the packing loop runs back into its own loop-limit marker
    makeEdge('d13', 'd12', FLOWCHART_EDGES, 'fx14', {label: 'Yes — next item'}),
    makeEdge('d13', 'd14', FLOWCHART_EDGES, 'fx15', {label: 'No — all packed'}),
    makeEdge('d14', 'd15', FLOWCHART_EDGES, 'fx16'),
    makeEdge('d15', 'd16', FLOWCHART_EDGES, 'fx17'),
    makeEdge('d16', 'd17', FLOWCHART_EDGES, 'fx18', {label: 'No — mismatch'}),
    makeEdge('d17', 'd18', FLOWCHART_EDGES, 'fx19'),
    // back-edge 2 — through the connector pair, back to the packing loop
    makeEdge('d18', 'd11', FLOWCHART_EDGES, 'fx20', {label: 'wrong item'}),
    makeEdge('d16', 'd19', FLOWCHART_EDGES, 'fx21', {label: 'Yes'}),
    makeEdge('d19', 'd20', FLOWCHART_EDGES, 'fx22'),
    makeEdge('d20', 'd21', FLOWCHART_EDGES, 'fx23', {label: 'page 2'}),
    makeEdge('d21', 'd22', FLOWCHART_EDGES, 'fx24'),
    makeEdge('d22', 'd23', FLOWCHART_EDGES, 'fx25'),
    makeEdge('d23', 'd24', FLOWCHART_EDGES, 'fx26', {label: 'Yes'}),
    // back-edge 3 — "not found" sends the parcel back out on the van
    makeEdge('d23', 'd22', FLOWCHART_EDGES, 'fx27', {label: 'No — address not found'}),
  ],
};

/* ===========================================================================
   L3c — ERD palette + template.
=========================================================================== */

export const TABLE_PALETTE_ITEM: PaletteItem = {
  label: 'Table', hint: 'columns + keys', shape: 'note', colorKey: 'cyan', kind: 'erg-table' as any,
  category: 'entities', types: ['erd'], aliases: ['entity', 'schema', 'db table'], geometry: 'table · columns',
  size: {width: 250, height: 170},
  // `make` is provided for the type contract only — App builds table nodes.
  make: () => ({text: ''} as any),
};

/** DISTINCT from the generic `Note` — the amber enum annotation (kicker
 *  'enum') that `erdTemplate`'s `note_enum` node uses. v2 §2.5/§12.7. */
export const ERD_ENUM_NOTE_ITEM: PaletteItem = {
  label: 'Note (enum)', hint: 'enum / annotation', shape: 'note', colorKey: 'amber', kind: 'goblin',
  category: 'annotations', types: ['erd'], aliases: ['enum', 'field values'], geometry: 'plain text annotation',
  /* AQ20 — same shape + category as the shared Note; the purpose line must
     say this one lists field values. */
  purpose: 'an ERD note listing the allowed values of a field',
  make: () => ({shape: 'note', kicker: 'enum', title: 'status', sub: 'pending · paid · shipped', metric: '', metricUnit: '', icon: 'sticky-note', colorKey: 'amber'}),
};

const col = (
  id: string, name: string, type: string,
  flags: {pk?: boolean; fk?: boolean; notNull?: boolean; unique?: boolean} = {},
): TableColumn => ({id, name, type, ...flags});

const table = (id: string, name: string, columns: TableColumn[], colorKey: ColorKey, x: number, y: number): Node => ({
  id, type: 'table', position: {x, y},
  data: {name, columns, colorKey},
});

const erdTemplate: TemplateSpec = {
  id: 'commerce',
  label: 'users / orders / order_items',
  hint: 'one-to-many · associative table · enum · nullable · unique',
  nodes: [
    table('users', 'users', [
      col('u_id', 'id', 'uuid', {pk: true, notNull: true}),
      col('u_email', 'email', 'varchar(320)', {notNull: true, unique: true}),
      col('u_name', 'name', 'varchar(120)'),
      col('u_created', 'created_at', 'timestamptz', {notNull: true}),
    ], 'cyan', 0, 120),

    table('orders', 'orders', [
      col('o_id', 'id', 'uuid', {pk: true, notNull: true}),
      col('o_user', 'user_id', 'uuid', {fk: true, notNull: true}),
      col('o_status', 'status', 'order_status'),
      col('o_total', 'total_cents', 'integer', {notNull: true}),
      col('o_placed', 'placed_at', 'timestamptz', {notNull: true}),
    ], 'cyan', 400, 60),

    table('order_items', 'order_items', [
      col('i_id', 'id', 'uuid', {pk: true, notNull: true}),
      col('i_order', 'order_id', 'uuid', {fk: true, notNull: true}),
      col('i_product', 'product_id', 'uuid', {notNull: true}),
      col('i_qty', 'quantity', 'integer', {notNull: true}),
      col('i_unit', 'unit_cents', 'integer', {notNull: true}),
    ], 'violet', 800, 120),

    {
      id: 'note_enum', type: 'goblin', position: {x: 400, y: 420},
      data: {
        shape: 'note', kicker: 'enum', title: 'order_status',
        sub: 'pending · paid · shipped · cancelled', metric: '', metricUnit: '',
        icon: 'sticky-note', colorKey: 'amber',
      },
    },
  ],
  edges: [
    // order_items.order_id → orders.id  (one order, many items)
    makeEdge('orders', 'order_items', ERD_EDGES, 'r1', {
      sourceHandle: 'right_rel_o_id', targetHandle: 'left_rel_i_order',
      crowStart: 'one', crowEnd: 'many',
    }),
    // orders.user_id → users.id  (one user, many orders; nullable on the user side)
    makeEdge('users', 'orders', ERD_EDGES, 'r2', {
      sourceHandle: 'right_rel_u_id', targetHandle: 'left_rel_o_user',
      crowStart: 'zeroOrOne', crowEnd: 'many',
    }),
  ],
};

/* PACKAGE-SEQ — the UML sequence palette. Message ARROW KINDS (sync / async /
   reply) are edge data, not shapes; these rows are the NODE pieces. `purpose`
   lines carry the level (S1/S2/S3) so the search modal says which tier each
   piece belongs to (AQ20 override). */
const SEQUENCE_PALETTE: PaletteItem[] = [
  {
    label: 'Lifeline', hint: 'head + dashed stem', shape: 'lifeline', colorKey: 'cyan', kind: 'goblin',
    category: 'sequence', types: ['sequence'], aliases: ['participant', 'column', 'object'],
    geometry: 'head + dashed stem', purpose: 'a sequence participant — stretch it downward to lengthen the lifeline',
    size: {width: 190, height: 380},
    make: () => ({shape: 'lifeline', kicker: '', title: 'Participant', sub: '', metric: '', metricUnit: '', colorKey: 'cyan'}),
  },
  {
    label: 'Activation', hint: 'thin bar · processing', shape: 'activation', colorKey: 'cyan', kind: 'goblin',
    category: 'sequence', types: ['sequence'], aliases: ['active', 'bar', 'focus'],
    geometry: 'thin vertical bar', purpose: 'the span in which a participant processes — level S2+',
    size: {width: 30, height: 220},
    make: () => ({shape: 'activation', kicker: '', title: 'activation', sub: '', metric: '', metricUnit: '', colorKey: 'cyan'}),
  },
  {
    label: 'Fragment', hint: 'frame · alt / loop', shape: 'fragment', colorKey: 'slate', kind: 'goblin',
    category: 'sequence', types: ['sequence'], aliases: ['alt', 'opt', 'loop', 'par', 'frame', 'combined'],
    geometry: 'frame + label tab', purpose: 'a combined fragment — set its kind in the kicker (alt / opt / loop / par)',
    size: {width: 480, height: 180},
    make: () => ({shape: 'fragment', kicker: 'loop', title: 'fragment', sub: '[ condition ]', metric: '', metricUnit: '', colorKey: 'slate'}),
  },
];

/* ===========================================================================
   v2 §2 — THE ONE LIBRARY + the `libraryFor(id)` selector.

   Every element appears EXACTLY ONCE in `LIBRARY`; a diagram type is a
   filtering VIEW of it, not a separate list. Nothing is re-declared here —
   the library assembles the existing definitions (PALETTE, the flowchart
   literals, the C4 map output, TABLE_PALETTE_ITEM) so the objects are shared.

   The library order is the source lists concatenated:
     PALETTE (architecture, incl. the shared `Note` at index 8)
     → the flowchart's own elements (minus Lane/Note) → `Lane`
     → the C4 elements (C4_TYPES order) → `Table` → `Note (enum)`
   That order makes `architecture`, `erd` and the §2.7 Mixed set EXACT with no
   re-ordering. `flowchart` and `c4` do move one element (see `libraryFor`).
=========================================================================== */

export const LIBRARY: PaletteItem[] = [
  // 1 — architecture, PALETTE's own order (its `Note` is the ONE shared Note).
  //     QUEUE_ENABLED (2026-10-22) — Queue drops out of the CREATE-SURFACE
  //     library HERE; the seed-facing preset palette keeps it (see
  //     `libraryFor`'s architecture branch and the flag's comment above).
  //     STORAGE / NOTE (2026-10-22) — same hide, same reasoning.
  ...PALETTE.filter(p => QUEUE_ENABLED || p.label !== 'Queue')
            .filter(p => ACTOR_ENABLED || p.label !== 'Actor')
            .filter(p => STORAGE_ENABLED || p.label !== 'Storage')
            .filter(p => NOTE_ENABLED || p.label !== 'Note'),
  // 2 — the flowchart's own elements (10): Terminal … On-page connector.
  //     LANE_ENABLED (2026-10-22) — the Lane piece is its own filter below.
  ...FLOWCHART_PALETTE.filter(p => p.label !== 'Lane' && p.label !== 'Note'),
  // 3 — `Lane` (groups).
  //     LANE_ENABLED (2026-10-22) — Harvey: Lane duplicates Group (same shape,
  //     same dashed boundary); gated out of the create surface.
  ...(LANE_ENABLED ? FLOWCHART_PALETTE.filter(p => p.label === 'Lane') : []),
  // 4 — the C4 elements (11), in C4_TYPES order.
  //     C4_ENABLED (2026-10-22, HARVEY follow-up: "C4 shapes/group vẫn còn
  //     hiện") — the first cut kept the items in LIBRARY so `libraryFor('c4')`
  //     and MIXED_LABELS stayed intact, but LIBRARY is the create-surface
  //     enumeration, so the C4 section still rendered in the panel, search and
  //     the insert modal. Mirror SEQUENCE_ENABLED exactly: gate the SPREAD.
  //     MIXED_LABELS below is gated the same way; `libraryFor('c4')` still
  //     reads C4_PALETTE_ITEMS directly, so a STORED c4 board keeps its palette.
  ...(C4_ENABLED ? C4_PALETTE_ITEMS : []),
  // 4b — PACKAGE-SEQ: the UML sequence pieces (HIDDEN — see SEQUENCE_ENABLED).
  ...(SEQUENCE_ENABLED ? SEQUENCE_PALETTE : []),
  // 5 — the ERD entities.
  //     ERD_ENABLED (2026-10-22) — both items gated; `entities` section
  //     disappears when empty (groupByCategory drops empty groups).
  ...(ERD_ENABLED ? [TABLE_PALETTE_ITEM, ERD_ENUM_NOTE_ITEM] : []),
];

/* §2.7 — the Mixed (`custom`) set is its OWN selector, NOT a `types[]` filter
   (a filter over `types[]` would yield all 34). Membership is keyed on the
   `label`, unique inside LIBRARY, and the ORDER is rebuilt to match the old
   `custom` palette exactly: ARCH ++ FLOW(−Lane,−Note) ++ C4[0..6] ++ Table.
   QUEUE_ENABLED (2026-10-22) — the hidden Queue drops out of this set too: the
   `custom` preset's palette is a CREATE surface. */
const MIXED_LABELS = new Set<string>([
  ...PALETTE.filter(p => QUEUE_ENABLED || p.label !== 'Queue')
            .filter(p => ACTOR_ENABLED || p.label !== 'Actor')
            .filter(p => STORAGE_ENABLED || p.label !== 'Storage')
            .filter(p => NOTE_ENABLED || p.label !== 'Note').map(p => p.label),
  // LANE_ENABLED / NOTE_ENABLED (2026-10-22) — the flowchart slice already
  // excludes Lane and Note textually; the Lane piece is the ONLY Lane source,
  // so gate it here (Mixed is a CREATE surface).
  ...FLOWCHART_PALETTE.filter(p => p.label !== 'Lane' && p.label !== 'Note').map(p => p.label),
  ...(LANE_ENABLED ? FLOWCHART_PALETTE.filter(p => p.label === 'Lane').map(p => p.label) : []),
  // C4_ENABLED (2026-10-22) — gated with the LIBRARY spread above: the Mixed
  // set is a CREATE surface, so hidden C4 items must not re-enter through it.
  ...(C4_ENABLED ? C4_PALETTE_ITEMS.slice(0, 6).map(p => p.label) : []),
  TABLE_PALETTE_ITEM.label,
]);

const byLabel = new Map(LIBRARY.map(p => [p.label, p] as const));
const pick = (labels: Iterable<string>): PaletteItem[] => [...labels].map(l => byLabel.get(l)!);

/** The seed-facing FULL assembly — every piece the library is built from, in
 *  library order, with NOTHING hidden. `libraryFor`'s architecture branch and
 *  `PRESETS.architecture.palette` read THIS, because the first-run seed builds
 *  its External → Queue → Service pipeline through `palette[3]/[2]/[0]`
 *  (`App.tsx` `initialNodes`) and `checks/boot-no-flash.mjs` pins that seed
 *  byte-identical. The create-surface `LIBRARY` above applies the
 *  `QUEUE_ENABLED` hide to its architecture slice; this array never does. */
const LIBRARY_FULL: PaletteItem[] = [
  ...PALETTE,
  ...FLOWCHART_PALETTE.filter(p => p.label !== 'Lane' && p.label !== 'Note'),
  ...FLOWCHART_PALETTE.filter(p => p.label === 'Lane'),
  ...C4_PALETTE_ITEMS,
  ...(SEQUENCE_ENABLED ? SEQUENCE_PALETTE : []),
  TABLE_PALETTE_ITEM,
  ERD_ENUM_NOTE_ITEM,
];

/** The ONE shared `Note` moved to the tail — the position the old flowchart and
 *  C4 lists both gave it (they appended it last; the architecture list has it
 *  second-to-last, which is why ONE flat library order cannot serve all five).
 *  NOTE_ENABLED (2026-10-22) — when the Note is hidden from the create surface,
 *  the hoist no-ops: the filter drops every row, and the append is gated so
 *  the hidden item cannot re-enter through the tail. */
const withNoteLast = (items: PaletteItem[]): PaletteItem[] =>
  [...items.filter(p => p.label !== 'Note'), ...(NOTE_ENABLED ? [NOTE_ITEM] : [])];

/** The ONE selector. The four real types are `types[]` FILTERS over LIBRARY
 *  (§2.6); `custom` is the curated Mixed set (§2.7). `flowchart` and `c4`
 *  additionally hoist the shared `Note` back to the tail — see `withNoteLast`.
 *  Order is preserved for DISPLAY; it is no longer load-bearing for insert.
 *  (Pass 2b made insertion IDENTITY-KEYED: the panel's drag payload and
 *  `SearchPalette.onInsert` both carry the item `label`, and `App.tsx`
 *  `addNodeByLabel(label)` resolves it via `LIBRARY.find`. Nothing reads
 *  `preset.palette[idx]` any more, so a reordering here cannot mis-insert.) */
export function libraryFor(id: PresetId): PaletteItem[] {
  switch (id) {
    case 'custom':
      return pick(MIXED_LABELS);
    case 'flowchart':
      return withNoteLast(LIBRARY.filter(p => p.types.includes('flowchart')));
    case 'c4':
      return withNoteLast(LIBRARY.filter(p => p.types.includes('c4')));
    case 'erd':
      return LIBRARY.filter(p => p.types.includes('erd'));
    case 'sequence':
      return withNoteLast(LIBRARY.filter(p => p.types.includes('sequence')));
    /* Architecture reads LIBRARY_FULL, NOT the create-surface LIBRARY: the
       first-run seed reads `PRESETS.architecture.palette[3]/[2]/[0]` and
       checks/boot-no-flash.mjs pins the seed byte-identical (QUEUE_ENABLED,
       2026-10-22 — see LIBRARY_FULL above). Stored boards' presets resolve the
       same way, so a stored Queue keeps its palette. */
    default:
      return LIBRARY_FULL.filter(p => p.types.includes('architecture'));
  }
}

/* ===========================================================================
   THE PRESETS
=========================================================================== */

/** 1 — `architecture`: today's behaviour, the default for every old board. */
export const ARCHITECTURE_PRESET: DiagramPreset = {
  id: 'architecture',
  label: 'Architecture',
  hint: 'services · datastores · boundaries',
  palette: libraryFor('architecture'),
  edges: {
    path: 'bezier',
    strokeKey: 'slate',
    dash: 'solid',
    markerStart: null,
    markerEnd: MarkerType.ArrowClosed,
    flowAllowed: true,
  },
  layout: {engine: 'layered-lr', direction: 'LR', spacing: {x: 70, y: 24}},
  theme: {suggested: 'dark', canvas: 'dots', showLegend: false},
  guidance: {tip: 'Name the system, then label every arrow with what flows across it.'},
  // Truthful to today's behaviour: all three toggles ship OFF, so adopting this
  // preset cannot change an existing board (L2: architecture is byte-identical).
  caps: {subflow: true, cyclePrevention: false, oneInput: false, resizable: true},
  legend: [
    {colorKey: 'accent', label: 'External system'},
    {colorKey: 'cyan', label: 'Service'},
    {colorKey: 'violet', label: 'Datastore'},
    {colorKey: 'amber', label: 'Queue / storage'},
    {colorKey: 'green', label: 'Actor'},
    {colorKey: 'slate', label: 'Boundary / note'},
  ],
};

/** 3a — `flowchart` */
export const FLOWCHART_PRESET: DiagramPreset = {
  id: 'flowchart',
  label: 'Flowchart',
  hint: 'steps · decisions · lanes',
  palette: libraryFor('flowchart'),
  /* ROUND AD — ONE SHAPE LIST. These two arrays used to repeat the ten ids
     literally in this file AND in `FLOWCHART_EXTRA_SHAPES` in `src/shapes.tsx`,
     so adding a shape meant editing three lists and a miss was silent (the
     round-AD additions landed in `shapes.tsx` first and left both copies at
     ten). They now REFERENCE the one array, so a shape added for the flowchart
     set cannot be missing here. */
  extraShapes: FLOWCHART_EXTRA_SHAPES,
  edges: FLOWCHART_EDGES,
  layout: {engine: 'layered-tb', direction: 'TB', spacing: {x: 90, y: 70}, bandGroups: true},
  theme: {suggested: 'dark', canvas: 'plain', showLegend: false},
  guidance: {
    tip: 'One start, at least one end, and a label on every branch out of a decision.',
    requireLabel: true,
    maxLabelChars: 30,
  },
  // a flowchart legitimately loops back, so cycle prevention stays off here
  caps: {subflow: true, cyclePrevention: false, oneInput: false, resizable: true},
  // PACKAGE-TEMPLATES — order follows the catalog's own render order inside the
  // family (basic → advanced group, whose members sort by `order ?? 0` then id).
  templates: [flowchartBasicTemplate, flowchartAdvancedTemplate, flowchartComplexTemplate],
  note: 'Handles are vertical (top-in / bottom-out) and cycles are allowed — a flowchart legitimately loops back.',
  legend: [
    {colorKey: 'green', label: 'Terminal (start / end)'},
    {colorKey: 'cyan', label: 'Process / subprocess'},
    {colorKey: 'amber', label: 'Decision / delay'},
    {colorKey: 'violet', label: 'Input, output or document'},
    {colorKey: 'slate', label: 'Connector / lane'},
  ],
};

/** 3b — `c4` (context + container templates, dashed intent-labelled edges) */
export const C4_PRESET: DiagramPreset = {
  id: 'c4',
  label: 'C4',
  hint: 'people · systems · containers · boundaries',
  palette: libraryFor('c4'),
  edges: C4_EDGES,
  layout: {engine: 'layered-lr', direction: 'LR', spacing: {x: 110, y: 60}},
  theme: {suggested: 'midnight', canvas: 'plain', showLegend: true},
  guidance: {
    tip: 'Name the diagram "<type> diagram for <scope>". Label every arrow with its intent, and add the technology at container level.',
    requireLabel: true,
    requireTechnology: true,
  },
  caps: {subflow: true, cyclePrevention: true, oneInput: false, resizable: true},
  /* C4_ENABLED (2026-10-22) — the templates ARE the C4 create offer, so they
     are the piece the flag gates: `templates: undefined` drops the whole C4
     family from `templateCatalog()` (a preset with no templates contributes no
     family), hence from the gallery and the board dialog. `templates?:` is
     already optional on `DiagramPreset` — the ERD-less presets ship without it. */
  ...(C4_ENABLED ? {templates: [c4ContextTemplate, c4ContainerTemplate]} : {}),
  /* A note pinned outside the flag on purpose: a STORED C4 board still opens,
     still renders, and its inspector still prints this. */
  note: 'Relationships are unidirectional and dashed (the C4 convention), with an intent label plus a technology suffix.',
  legend: [
    {colorKey: 'green', label: '[Person]'},
    {colorKey: 'cyan', label: 'Internal software system / container'},
    {colorKey: 'accent', label: 'External software system'},
    {colorKey: 'violet', label: 'Container: database'},
    {colorKey: 'amber', label: 'Container: queue / object store'},
    {colorKey: 'slate', label: 'External container / boundary', dash: true},
    {colorKey: 'slate', label: 'Relationship (intent · technology)', dash: true},
  ],
};

/** 3c — `erd` */
export const ERD_PRESET: DiagramPreset = {
  id: 'erd',
  label: 'Data model',
  hint: 'tables · columns · relationships',
  palette: libraryFor('erd'),
  edges: ERD_EDGES,
  layout: {engine: 'grid', direction: 'LR', spacing: {x: 150, y: 90}, cols: 3},
  theme: {suggested: 'dark', canvas: 'plain', showLegend: true},
  guidance: {tip: 'Every table needs a primary key; draw the relationship from the FK column to the column it references.'},
  caps: {subflow: false, cyclePrevention: false, oneInput: false, resizable: true},
  /* ERD_ENABLED (2026-10-24, HARVEY: template not needed yet) — the EXACT
     C4_ENABLED pattern (see C4_PRESET's spread): the templates ARE the ERD
     create offer, so the flag gates them. `templates: undefined` drops the
     whole "Data model" family from `templateCatalog()` (a preset with no
     templates contributes no family), hence from the gallery and the board
     dialog; with no template a fresh ERD board is unreachable from every
     create path. The erdTemplate spec stays in the tree and the `erd` key
     stays in PRESETS — a STORED erd board still opens, renders and saves as
     ERD. Flip ERD_ENABLED to true to put the family back. */
  ...(ERD_ENABLED ? {templates: [erdTemplate]} : {}),
  showMode: 'ALL_FIELDS',
  note: 'FK edges attach column-to-column. Crow’s feet show cardinality: ring = zero, bar = one, foot = many.',
  legend: [
    {colorKey: 'accent', label: 'Primary key'},
    {colorKey: 'slate', label: 'Foreign key column name'},
    {colorKey: 'slate', label: 'Filled dot = NOT NULL · hollow = nullable'},
    {colorKey: 'slate', label: 'ring + bar = zero-or-one · bar = one · foot = many'},
  ],
};

/* ===========================================================================
   3e — PACKAGE-SEQ: `sequence` (UML sequence diagrams, 3 template levels)

   Levels (research-backed, deleg_5be68934):
     S1 System     — actors + ONE black-box system lifeline; boundary messages.
     S2 Component  — typed lifelines (service/db/queue), activations, fragments.
     S3 Protocol   — everything S2 has, plus break/critical, dividers, notes.

   MESSAGES ARE EDGES. Arrow semantics (UML 2.5): sync = solid + filled
   arrowhead, async = solid + open, reply = dashed + open. The palette rows for
   messages insert an edge kind by way of the edge-defaults button row — the
   shapes here are only the NODE pieces (lifelines, activations, fragments).
   =========================================================================== */

const seqNode = (
  key: string, shape: Shape, title: string, sub: string,
  colorKey: ColorKey, x: number, y: number,
  w?: number, h?: number,
): Node => ({
  id: `sq-${key}`,
  type: 'goblin',
  position: {x, y},
  ...(w && h ? {style: {width: w, height: h}} : {}),
  data: {shape, kicker: '', title, sub, metric: '', metricUnit: '', colorKey},
});

const seqEdge = (id: string, source: string, target: string, label: string, kind: 'sync' | 'async' | 'return'): Edge => ({
  id: `sq-${id}`,
  source: `sq-${source}`,
  target: `sq-${target}`,
  type: 'goblinEdge',
  /* ROUND AR-2 — the label rides at the TOP LEVEL (the one storage the
     canvas paints and the exporter reads); `seqMsg` stays in data. */
  label,
  data: {seqMsg: kind},
});

const seqSystemTemplate: TemplateSpec = {
  id: 'seq-system',
  label: 'Sequence · System',
  hint: 'actors ↔ one black-box system · S1',
  level: 'basic',
  nodes: [
    seqNode('user', 'lifeline', 'Customer', 'actor', 'green', 0, 0, 190, 380),
    seqNode('system', 'lifeline', 'Booking System', 'system', 'cyan', 320, 0, 190, 380),
    seqNode('frag', 'fragment', 'loop', '[ more items ]', 'slate', 60, 150, 480, 170),
    {
      id: 'sq-title', type: 'label', position: {x: 0, y: -50},
      data: {text: 'System Sequence diagram — booking flow'},
    },
  ],
  edges: [
    seqEdge('e1', 'user', 'system', 'searchItems(query)', 'sync'),
    seqEdge('e2', 'system', 'user', 'items', 'return'),
    seqEdge('e3', 'user', 'system', 'checkout(cart)', 'sync'),
    seqEdge('e4', 'system', 'user', 'receipt', 'return'),
  ],
};

const seqComponentTemplate: TemplateSpec = {
  id: 'seq-component',
  label: 'Sequence · Component',
  hint: 'services + datastores + activations · S2',
  level: 'advanced',
  nodes: [
    seqNode('api', 'lifeline', 'API Gateway', 'service', 'cyan', 0, 0, 190, 460),
    seqNode('auth', 'lifeline', 'Auth Service', 'service', 'violet', 300, 0, 190, 460),
    seqNode('db', 'lifeline', 'User Database', 'database', 'amber', 600, 0, 190, 460),
    seqNode('act1', 'activation', '', '', 'cyan', 80, 120, 30, 260),
    seqNode('act2', 'activation', '', '', 'violet', 380, 170, 30, 170),
    seqNode('act3', 'activation', '', '', 'amber', 680, 230, 30, 90),
    /* activation x centres under each lifeline stem (lifeline x + 95 - 15) */
    seqNode('note1', 'note', 'Token verified on every request', '', 'slate', 40, 420, 220, 60),
    {
      id: 'sq-title', type: 'label', position: {x: 0, y: -50},
      data: {text: 'Component interaction — authenticate'},
    },
  ],
  edges: [
    seqEdge('e1', 'api', 'auth', 'authenticate(token)', 'sync'),
    seqEdge('e2', 'auth', 'db', 'loadUser(id)', 'sync'),
    seqEdge('e3', 'db', 'auth', 'user record', 'return'),
    seqEdge('e4', 'auth', 'api', 'session', 'return'),
  ],
};

const seqProtocolTemplate: TemplateSpec = {
  id: 'seq-protocol',
  label: 'Sequence · Protocol',
  hint: 'fragments · dividers · full set · S3',
  level: 'complex',
  nodes: [
    seqNode('client', 'lifeline', 'Client', 'actor', 'green', 0, 0, 190, 520),
    seqNode('lb', 'lifeline', 'Load Balancer', 'gateway', 'cyan', 300, 0, 190, 520),
    seqNode('svc', 'lifeline', 'Payment Service', 'service', 'violet', 600, 0, 190, 520),
    seqNode('q', 'lifeline', 'Event Queue', 'queue', 'amber', 900, 0, 190, 520),
    seqNode('div', 'fragment', 'div', '== settled payments ==', 'slate', 60, 380, 1020, 60),
    seqNode('frag1', 'fragment', 'alt', '[ card ] / [ wallet ]', 'slate', 40, 120, 840, 200),
    {
      id: 'sq-title', type: 'label', position: {x: 0, y: -50},
      data: {text: 'Payment protocol — charge flow'},
    },
  ],
  edges: [
    seqEdge('e1', 'client', 'lb', 'POST /charge', 'sync'),
    seqEdge('e2', 'lb', 'svc', 'charge(amount)', 'sync'),
    seqEdge('e3', 'svc', 'q', 'PaymentSettled', 'async'),
    seqEdge('e4', 'svc', 'lb', 'result', 'return'),
    seqEdge('e5', 'lb', 'client', '200 OK', 'return'),
  ],
};

export const SEQUENCE_PRESET: DiagramPreset = {
  id: 'sequence',
  label: 'Sequence',
  hint: 'lifelines · messages over time',
  palette: libraryFor('sequence'),
  extraShapes: ['lifeline', 'activation', 'fragment'],
  edges: {path: 'straight', strokeKey: 'slate', markerEnd: MarkerType.ArrowClosed},
  layout: {engine: 'grid', direction: 'LR', spacing: {x: 300, y: 80}},
  theme: {suggested: 'paper', canvas: 'lines', showLegend: false},
  guidance: {tip: 'Lifelines are columns — stretch one downward to lengthen it. Messages are edges: drop them between lifelines, top to bottom in time order.'},
  caps: {subflow: true, cyclePrevention: false, oneInput: false, resizable: true},
  templates: [seqSystemTemplate, seqComponentTemplate, seqProtocolTemplate],
  note: 'Time flows downward. Solid + filled arrow = sync call · solid + open = async · dashed = reply.',
  legend: [
    {colorKey: 'green', label: 'Actor / client'},
    {colorKey: 'cyan', label: 'System under design'},
    {colorKey: 'violet', label: 'Internal service'},
    {colorKey: 'amber', label: 'Datastore / queue'},
    {colorKey: 'slate', label: 'Fragment frame (alt · opt · loop)'},
  ],
};

/** 2/5 — `custom`: the union of every palette, for blending diagram types. */
export const CUSTOM_PRESET: DiagramPreset = {
  id: 'custom',
  label: 'Mixed',
  hint: 'everything — mix freely',
  palette: libraryFor('custom'),
  /* ROUND AD — the SAME one array the flowchart preset references (see the note
     there): a Mixed board offers the whole shape vocabulary, so the two lists
     were always meant to be identical and now cannot differ. */
  extraShapes: FLOWCHART_EXTRA_SHAPES,
  edges: {
    path: 'bezier',
    strokeKey: 'slate',
    dash: 'solid',
    markerStart: null,
    markerEnd: MarkerType.ArrowClosed,
    flowAllowed: true,
  },
  layout: {engine: 'free', direction: 'LR'},
  theme: {canvas: 'dots'},
  caps: {subflow: true, cyclePrevention: false, oneInput: false, resizable: true},
  legend: [{colorKey: 'slate', label: 'Mixed notation'}],
};

export const PRESETS = ({
  architecture: ARCHITECTURE_PRESET,
  ...(SEQUENCE_ENABLED ? {sequence: SEQUENCE_PRESET} : {}),
  flowchart: FLOWCHART_PRESET,
  c4: C4_PRESET,
  erd: ERD_PRESET,
  custom: CUSTOM_PRESET,
}) as unknown as Record<PresetId, DiagramPreset>; // `sequence` key is flag-gated (see SEQUENCE_ENABLED)

/** The preset a fresh editor starts on — until a board load replaces it. Kept as
 *  ONE named constant because the boot theme depends on its suggestion: both
 *  `App`'s preset state and the pre-paint script in index.html's <head> (via
 *  `bootTheme`) must read the SAME default, or the first frame paints a theme the
 *  preset suggestion is about to flip. */
export const DEFAULT_PRESET_ID: PresetId = 'architecture';

export const PRESET_IDS = Object.keys(PRESETS) as PresetId[];
export const isPresetId = (v: unknown): v is PresetId =>
  typeof v === 'string' && Object.prototype.hasOwnProperty.call(PRESETS, v);

/** Boards are old or hand-written — never trust the field. */
export function asPreset(id: unknown): PresetId {
  return isPresetId(id) ? id : 'architecture';
}
export function getPreset(id: unknown): DiagramPreset {
  return PRESETS[asPreset(id)];
}

/** Board-menu warning copy (§E.5). */
export const PRESET_SWITCH_WARNING =
  'This changes the palette, edge defaults and auto-layout. Existing elements are kept.';

/** Palette index helper — legacy shape kept for the `preset.palette[idx]` fields
 *  it still returns. Panel INSERTION is IDENTITY-KEYED: the panel's drag payload
 *  and `SearchPalette.onInsert` both carry the item `label`, and `App.tsx`
 *  `addNodeByLabel(label)` resolves it via `LIBRARY.find` — so reordering the
 *  palette cannot mis-insert. */
export const makeFromPalette = (p: PaletteItem, index: number, preset: DiagramPreset) => ({
  index, item: p, preset,
});
