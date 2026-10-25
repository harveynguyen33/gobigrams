/* ROUND BN-4 — this file is one slice of the former `src/presets.ts` (split verbatim, 2026-10-25). `src/presets/index.ts` re-exports the union, so every import of './presets' is unchanged. */
import {MarkerType, type Edge, Node} from '@xyflow/react';
import type {Node as _N} from '@xyflow/react';
import {type ColorKey} from '../colors';
import {PALETTE, type PaletteItem, type PaletteCategory, type DiagramType} from '../palette';
import {type Shape, FLOWCHART_EXTRA_SHAPES} from '../nodes/shapes';
import {
  QUEUE_ENABLED, ACTOR_ENABLED, STORAGE_ENABLED, NOTE_ENABLED, LANE_ENABLED, ERD_ENABLED,
  C4_ENABLED, SEQUENCE_ENABLED,
  C4_EDGES, FLOWCHART_EDGES, ERD_EDGES,
  type PresetId, type EdgeDefaults, type TemplateSpec, type DiagramPreset, makeEdge,
} from './basic';
import {FLOWCHART_PALETTE, FLOWCHART_NODE_SIZE, CONNECTOR_NODE_SIZE, NOTE_ITEM} from './flowchart';
import {TABLE_PALETTE_ITEM, ERD_ENUM_NOTE_ITEM, SEQUENCE_PALETTE} from './dataStorage';
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
