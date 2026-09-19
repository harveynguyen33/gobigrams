import {MarkerType, type Edge, type Node} from '@xyflow/react';
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

export type PresetId = 'architecture' | 'flowchart' | 'c4' | 'erd' | 'custom';
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
  /** Intent-label suggestions shown in the edge inspector (L3b). */
  labelPresets?: string[];
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

export type TemplateSpec = {
  id: string;
  label: string;
  hint?: string;
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
  caps?: {subflow?: boolean; proximityConnect?: boolean; cyclePrevention?: boolean; oneInput?: boolean; resizable?: boolean};
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
export function edgeColorPatch(key: ColorKey, existing?: {markerEnd?: any; markerStart?: any}) {
  const color = COLOR_VAR[key];
  const patch: any = {style: {stroke: color}, data: {strokeKey: key}};
  if (existing?.markerEnd?.type) patch.markerEnd = {...existing.markerEnd, color};
  if (existing?.markerStart?.type) patch.markerStart = {...existing.markerStart, color};
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
    size: e.shape === 'group' ? {width: 460, height: 300} : undefined,
    make: () => ({
      shape: e.shape, kicker: e.kicker, title: e.kicker.replace(/[[\]]/g, ''),
      sub: e.sub, metric: '', metricUnit: '', icon: e.icon, colorKey: e.colorKey, c4Type: t,
    }),
  };
};

const C4_PALETTE_ITEMS: PaletteItem[] = C4_PALETTE_TYPES.map(c4PaletteItem);

/* C4 relationship intent labels — an intent VERB PHRASE, not a bare "uses"
   (the c4model notation page says to avoid single words), plus the technology
   suffix the container level calls for. */
const C4_LABELS = [
  'uses', 'views account balances and makes payments using', 'reads from',
  'gets account information from, and makes payments using', 'sends events to',
  'makes API calls to · HTTPS/JSON', 'reads from and writes to · sync, JDBC',
  'publishes events to · Kafka', 'sends e-mail using · SMTP', 'sends e-mails to',
  'serves static assets to · HTTPS', 'invokes · in-process', 'delegates to',
];

/* The three real presets' edge defaults, declared here (above the templates)
   because the templates build their edges through the same factory. */
export const C4_EDGES: EdgeDefaults = {
  path: 'smoothstep',
  strokeKey: 'slate',
  dash: 'dashed',
  markerStart: null,
  markerEnd: MarkerType.ArrowClosed,
  labelPresets: C4_LABELS,
  technField: true,
  flowAllowed: false,
};

export const FLOWCHART_EDGES: EdgeDefaults = {
  path: 'smoothstep',
  strokeKey: 'slate',
  dash: 'solid',
  markerStart: null,
  markerEnd: MarkerType.ArrowClosed,
  labelPresets: ['Yes', 'No', 'True', 'False', 'Retry', 'Timeout', 'Otherwise', 'revise'],
  flowAllowed: true,
};

export const ERD_EDGES: EdgeDefaults = {
  path: 'smoothstep',
  strokeKey: 'slate',
  dash: 'solid',
  markerStart: null,
  markerEnd: null,
  crowStart: 'one',
  crowEnd: 'many',
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
  fc('On-page connector', 'circle · jump', 'connector', 'slate', 'A', 'flowchart', FLOW, ['connector', 'circle', 'reference', 'jump', 'on-page'], 'circle', FLOWCHART_NODE_SIZE),
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

/* "Approval request" — pools + 2 lanes, a decision with Yes/No, a connector pair
   and a deliberate loop-back. The lanes are FROZEN BANDS (bandGroups), the flow
   nodes are top-level, so Auto-arrange lays the flow out and the loop-back is a
   real regression test rather than a no-op. */
const lane = (id: string, title: string, sub: string, x: number, y: number, w: number, h: number): Node => ({
  id, type: 'goblin', position: {x, y}, style: {width: w, height: h},
  data: {shape: 'group', kicker: '', title, sub, metric: '', metricUnit: '', icon: '', colorKey: 'slate'},
});

const flowNode = (
  id: string, shape: Shape, title: string, colorKey: ColorKey, x: number, y: number,
  size?: {width: number; height: number},
): Node => ({
  id, type: 'goblin', position: {x, y},
  ...(size ? {style: {width: size.width, height: size.height}} : null),
  data: {shape, kicker: '', title, sub: '', metric: '', metricUnit: '', icon: '', colorKey, body: 'label-only', handles: 'tb'},
});

const flowchartApprovalTemplate: TemplateSpec = {
  id: 'approval',
  label: 'Approval request',
  hint: 'two lanes · decision · Yes/No · loop-back',
  nodes: [
    lane('pool', 'Purchase approval', 'pool · who does what', 0, 0, 1000, 640),
    lane('laneReq', 'Requester', 'lane · role', 30, 70, 940, 230),
    lane('laneFin', 'Finance', 'lane · role', 30, 320, 940, 230),

    flowNode('a1', 'terminator', 'Start', 'green', 200, 130, FLOWCHART_NODE_SIZE),
    flowNode('a2', 'process', 'Submit purchase request', 'cyan', 180, 220, FLOWCHART_NODE_SIZE),
    flowNode('a3', 'io', 'Attach quote', 'violet', 430, 220, FLOWCHART_NODE_SIZE),
    flowNode('a4', 'decision', 'Amount > 1,000?', 'amber', 660, 200, FLOWCHART_NODE_SIZE),
    flowNode('a5', 'manual', 'Finance review', 'green', 660, 380, FLOWCHART_NODE_SIZE),
    flowNode('a6', 'decision', 'Approved?', 'amber', 420, 360, FLOWCHART_NODE_SIZE),
    flowNode('a7', 'document', 'Issue purchase order', 'violet', 180, 470, FLOWCHART_NODE_SIZE),
    flowNode('a8', 'terminator', 'End — approved', 'green', 430, 480, FLOWCHART_NODE_SIZE),
    flowNode('a9', 'connector', 'A', 'slate', 300, 380, FLOWCHART_NODE_SIZE),
    flowNode('a10', 'connector', 'A', 'slate', 300, 175, FLOWCHART_NODE_SIZE),
    {id: 'a11', type: 'label', position: {x: 120, y: 590}, data: {text: 'Rejections must state a reason.'}},
  ],
  edges: [
    makeEdge('a1', 'a2', FLOWCHART_EDGES, 'f1'),
    makeEdge('a2', 'a3', FLOWCHART_EDGES, 'f2'),
    makeEdge('a3', 'a4', FLOWCHART_EDGES, 'f3'),
    makeEdge('a4', 'a5', FLOWCHART_EDGES, 'f4', {label: 'Yes'}),
    makeEdge('a4', 'a6', FLOWCHART_EDGES, 'f5', {label: 'No'}),
    makeEdge('a6', 'a7', FLOWCHART_EDGES, 'f7', {label: 'Yes'}),
    makeEdge('a6', 'a9', FLOWCHART_EDGES, 'f8', {label: 'No'}),
    // the connector pair: a9 → a10 is the genuine back-edge (a10 → a2 is
    // upstream of a9), which is what makes this template a layout regression
    // test — the old engine collapsed everything inside the loop onto layer 0.
    makeEdge('a9', 'a10', FLOWCHART_EDGES, 'f11'),
    makeEdge('a10', 'a2', FLOWCHART_EDGES, 'f9', {label: 'revise'}),
    makeEdge('a7', 'a8', FLOWCHART_EDGES, 'f10'),
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
  ...PALETTE,
  // 2 — the flowchart's own elements (10): Terminal … On-page connector.
  ...FLOWCHART_PALETTE.filter(p => p.label !== 'Lane' && p.label !== 'Note'),
  // 3 — `Lane` (groups).
  ...FLOWCHART_PALETTE.filter(p => p.label === 'Lane'),
  // 4 — the C4 elements (11), in C4_TYPES order.
  ...C4_PALETTE_ITEMS,
  // 5 — the ERD entities.
  TABLE_PALETTE_ITEM,
  ERD_ENUM_NOTE_ITEM,
];

/* §2.7 — the Mixed (`custom`) set is its OWN selector, NOT a `types[]` filter
   (a filter over `types[]` would yield all 34). Membership is keyed on the
   `label`, unique inside LIBRARY, and the ORDER is rebuilt to match the old
   `custom` palette exactly: ARCH ++ FLOW(−Lane,−Note) ++ C4[0..6] ++ Table. */
const MIXED_LABELS = new Set<string>([
  ...PALETTE.map(p => p.label),
  ...FLOWCHART_PALETTE.filter(p => p.label !== 'Lane' && p.label !== 'Note').map(p => p.label),
  ...C4_PALETTE_ITEMS.slice(0, 6).map(p => p.label),
  TABLE_PALETTE_ITEM.label,
]);

const byLabel = new Map(LIBRARY.map(p => [p.label, p] as const));
const pick = (labels: Iterable<string>): PaletteItem[] => [...labels].map(l => byLabel.get(l)!);

/** The ONE shared `Note` moved to the tail — the position the old flowchart and
 *  C4 lists both gave it (they appended it last; the architecture list has it
 *  second-to-last, which is why ONE flat library order cannot serve all five). */
const withNoteLast = (items: PaletteItem[]): PaletteItem[] =>
  [...items.filter(p => p.label !== 'Note'), NOTE_ITEM];

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
    default:
      return LIBRARY.filter(p => p.types.includes('architecture'));
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
  caps: {subflow: true, proximityConnect: false, cyclePrevention: false, oneInput: false, resizable: true},
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
  caps: {subflow: true, proximityConnect: false, cyclePrevention: false, oneInput: false, resizable: true},
  templates: [flowchartApprovalTemplate],
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
  caps: {subflow: true, proximityConnect: false, cyclePrevention: true, oneInput: false, resizable: true},
  templates: [c4ContextTemplate, c4ContainerTemplate],
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
  caps: {subflow: false, proximityConnect: false, cyclePrevention: false, oneInput: false, resizable: true},
  templates: [erdTemplate],
  showMode: 'ALL_FIELDS',
  note: 'FK edges attach column-to-column. Crow’s feet show cardinality: ring = zero, bar = one, foot = many.',
  legend: [
    {colorKey: 'accent', label: 'Primary key'},
    {colorKey: 'slate', label: 'Foreign key column name'},
    {colorKey: 'slate', label: 'Filled dot = NOT NULL · hollow = nullable'},
    {colorKey: 'slate', label: 'ring + bar = zero-or-one · bar = one · foot = many'},
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
  caps: {subflow: true, proximityConnect: false, cyclePrevention: false, oneInput: false, resizable: true},
  legend: [{colorKey: 'slate', label: 'Mixed notation'}],
};

export const PRESETS: Record<PresetId, DiagramPreset> = {
  architecture: ARCHITECTURE_PRESET,
  flowchart: FLOWCHART_PRESET,
  c4: C4_PRESET,
  erd: ERD_PRESET,
  custom: CUSTOM_PRESET,
};

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
