import {type NodeKind} from './nodes/DiagramNode';
import {type LabelKind} from './nodes/LabelNode';
import {type Shape} from './nodes/shapes';
import {type ColorKey} from './colors';
import {CARD_SIZE, SIZE_EXCEPTIONS} from './nodeSizes';

/* The symbolic-colour layer lives in colors.ts (no imports → no cycle). */
export {
  COLORS, COLOR_KEYS, COLOR_VAR, LEGACY_HEX, isColorKey, resolveColor, resolveColorKey, keyForHex,
} from './colors';
export type {ColorKey, Colored} from './colors';

/** Node type key registered on the canvas. */
export type PalKind = 'goblin' | 'label';

/** The four real diagram types. `custom` (Mixed) is deliberately ABSENT — it is a
 *  separate SET selector, not a filter over `types[]`. These are the persisted
 *  preset ids minus `custom`. */
export type DiagramType = 'architecture' | 'flowchart' | 'c4' | 'erd' | 'sequence';

/** Grouping in the shape panel. */
export type PaletteCategory =
  | 'basic' | 'flowchart' | 'data-storage' | 'architecture'
  | 'c4' | 'entities' | 'groups' | 'annotations'
  | 'sequence';

/* HARVEY 2026-10-13 — search-result ANNOTATION: the palette merges four
   diagram languages, so one query ("datab") can surface three near-identical
   cylinders. Each result now names its SOURCE (which diagram language the
   entry belongs to) and a one-line PURPOSE (what the entry is FOR). Both maps
   are static vocabulary, not per-item prose. */
export const TYPE_LABEL: Record<DiagramType, string> = {
  architecture: 'Architecture',
  flowchart: 'Flowchart',
  c4: 'C4',
  erd: 'ERD',
  sequence: 'Sequence',
};

export const SOURCE_PURPOSE: Record<PaletteCategory, string> = {
  basic: 'a general-purpose building block',
  flowchart: 'a step in a flowchart (ISO 5807)',
  'data-storage': 'a datastore in a system diagram',
  architecture: 'a component in a system architecture',
  c4: 'a node in a C4 model',
  entities: 'an ERD entity piece',
  groups: 'a boundary that groups other nodes',
  annotations: 'a note or annotation, never connected',
  sequence: 'a piece of a UML sequence diagram',
};

export type PaletteItem = {
  /** Shape name (also the shape's conventional diagram name). */
  label: string;
  hint: string;
  /** Shape rendered by the palette preview. */
  shape: Shape;
  colorKey: ColorKey;
  kind: PalKind;
  /** The default node size, REQUIRED: GOBI-SIZE (2026-10-31) made every palette
      row carry one — a size-less item rendered at the 190px CSS floor while its
      neighbours were 290x145 ("cái to cái nhỏ"). The type is the enforcement:
      `CARD_SIZE` for a card, a `SIZE_EXCEPTIONS` row for the few kinds whose
      geometry genuinely differs (src/nodeSizes.ts). */
  size: {width: number; height: number};
  /** AQ20 — per-item purpose override for the search-result source line. The
      category map (SOURCE_PURPOSE) is generic; C4 entries all share the c4
      category, so without an override every C4 row reads the same sentence.
      Set when the item needs to say something more specific. */
  purpose?: string;
  /** Panel grouping — an item lands in exactly ONE category. */
  category: PaletteCategory;
  /** Diagram types this element belongs to (filter membership). Required and
   *  non-empty: an element can belong to several types and the panel still
   *  lists it ONCE. */
  types: DiagramType[];
  /** Extra search words (old names, synonyms). */
  aliases?: string[];
  /** A geometry word for search ("hexagon", "cylinder", …). */
  geometry?: string;
  make: () => NodeKind | LabelKind;
};

/** Generic components — shape + neutral editable fields. No use case baked in. */
export const node = (
  shape: Shape, title: string, kicker: string, sub: string, colorKey: ColorKey, icon: string,
  extra: Record<string, unknown> = {},
): NodeKind => ({shape, kicker, title, sub, metric: '', metricUnit: '', icon, colorKey, ...extra});

/** Architecture palette — unchanged notation, colours now symbolic.
 *  ITEM 4 (2026-09-17) — hints tightened; see `shapes.tsx` for the rules.
 *  NO SEARCH WORD WAS LOST: `paletteSearch.ts` builds its haystack from
 *  `label + hint + aliases[] + geometry`, so any word dropped from a hint had to
 *  already live in `aliases`/`geometry` (or in the label) or the shape would
 *  become unfindable. Every drop below is covered — e.g. Queue's `topic` lives in
 *  `aliases`, Storage's `object` too, Group's `vpc`/`cluster` in `aliases`,
 *  Note's `annotation` in `aliases`. `checks/package-o-metrics.mjs` asserts this
 *  coverage rather than trusting the reading. */
export const PALETTE: PaletteItem[] = [
  {
    label: 'Service', hint: 'rounded rect · app', shape: 'service', colorKey: 'cyan', kind: 'goblin', size: CARD_SIZE,
    category: 'architecture', types: ['architecture'], aliases: ['app', 'application'], geometry: 'rounded rect',
    make: () => node('service', 'Service', 'service', 'stateless', 'cyan', 'server'),
  },
  {
    label: 'Database', hint: 'cylinder · datastore', shape: 'database', colorKey: 'violet', kind: 'goblin', size: CARD_SIZE,
    category: 'data-storage', types: ['architecture'], aliases: ['cyl', 'db', 'store', 'datastore'], geometry: 'cylinder',
    make: () => node('database', 'Database', 'database', 'primary', 'violet', 'database'),
  },
  {
    label: 'Queue', hint: 'rows + items · bus', shape: 'queue', colorKey: 'amber', kind: 'goblin', size: CARD_SIZE,
    category: 'architecture', types: ['architecture'], aliases: ['bus', 'topic', 'stream'], geometry: 'rows',
    make: () => node('queue', 'Queue', 'stream', 'message bus', 'amber', 'layers'),
  },
  {
    label: 'External', hint: 'dashed rect · 3rd party', shape: 'external', colorKey: 'accent', kind: 'goblin', size: CARD_SIZE,
    category: 'architecture', types: ['architecture'], aliases: ['third party', 'cloud'], geometry: 'dashed rect',
    make: () => node('external', 'External System', 'external', 'third party', 'accent', 'cloud'),
  },
  {
    label: 'Actor', hint: 'rect + person · user', shape: 'actor', colorKey: 'green', kind: 'goblin', size: CARD_SIZE,
    category: 'architecture', types: ['architecture'], aliases: ['person', 'user'], geometry: 'rect + person',
    make: () => node('actor', 'User', 'actor', 'person', 'green', 'user'),
  },
  {
    label: 'Storage', hint: 'bucket · objects', shape: 'storage', colorKey: 'amber', kind: 'goblin', size: CARD_SIZE,
    category: 'data-storage', types: ['architecture'], aliases: ['bucket', 'object', 'objects'], geometry: 'bucket',
    make: () => node('storage', 'Storage', 'object store', 'bucket', 'amber', 'package'),
  },
  {
    label: 'Gateway', hint: 'hexagon · api / lb', shape: 'gateway', colorKey: 'cyan', kind: 'goblin', size: CARD_SIZE,
    category: 'architecture', types: ['architecture'], aliases: ['hex', 'api', 'lb'], geometry: 'hexagon',
    make: () => node('gateway', 'Gateway', 'ingress', 'load balancer', 'cyan', 'router'),
  },
  {
    label: 'Group', hint: 'dashed boundary', shape: 'group', colorKey: 'slate', kind: 'goblin', size: SIZE_EXCEPTIONS.group.size,
    category: 'groups', types: ['architecture'], aliases: ['boundary', 'vpc', 'cluster'], geometry: 'dashed boundary',
    make: () => node('group', 'Group', 'boundary', 'vpc', 'slate', ''),
  },
  {
    label: 'Note', hint: 'plain text', shape: 'note', colorKey: 'slate', kind: 'goblin', size: SIZE_EXCEPTIONS.note.size,
    category: 'annotations', types: ['architecture', 'flowchart', 'c4'],
    aliases: ['annotation', 'comment', 'sticky'], geometry: 'plain text annotation',
    // One canonical Note (v2 §12.7): the flowchart/C4 sites already used sub:''.
    make: () => node('note', 'Note', 'note', '', 'slate', 'sticky-note'),
  },
  {
    label: 'Text', hint: 'plain caption', shape: 'note', colorKey: 'slate', kind: 'label', size: SIZE_EXCEPTIONS.label.size,
    category: 'basic', types: ['architecture'], aliases: ['label', 'plain'], geometry: 'free text label',
    // ROUND R chose 180x64 for a fresh label: 180px is ~21 monospace characters
    // at 13px, so the default string fits on ONE line with room to roughly double
    // before it wraps, and 64px is two typed lines with slack — comfortably above
    // the 48px resizer floor. GOBI-SIZE moved the NUMBER to SIZE_EXCEPTIONS.label,
    // because a note is an annotation too and the two should read alike.
    // `addNodeByLabel` honours `item.size`, so nothing in App.tsx has to change.
    make: () => ({text: 'Text label'}),
  },
];
