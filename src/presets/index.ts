/* ROUND BN-4 — this file is one slice of the former `src/presets.ts` (split verbatim, 2026-10-25). `src/presets/index.ts` re-exports the union, so every import of './presets' is unchanged. */
/* The preset objects whose data lives in the other slices assemble here (the
   presets that own their data sit next to it), followed by the ONE registry
   (`PRESETS`) and its helpers — re-exported below together with every slice, so
   `import ... from './presets'` sees exactly the union the old single file had. */
import {MarkerType, type Edge, type Node} from '@xyflow/react';
import {type ColorKey} from '../colors';
import {type PaletteItem} from '../palette';
import {type Shape, FLOWCHART_EXTRA_SHAPES} from '../shapes';
import {
  SEQUENCE_ENABLED, ERD_ENABLED, FLOWCHART_EDGES, ERD_EDGES,
  type PresetId, type DiagramPreset, type TemplateSpec,
} from './basic';
import {libraryFor, ARCHITECTURE_PRESET, C4_PRESET} from './architecture';
import {
  FLOWCHART_NODE_SIZE, CONNECTOR_NODE_SIZE,
  flowchartBasicTemplate, flowchartAdvancedTemplate, flowchartComplexTemplate,
} from './flowchart';
import {erdTemplate} from './dataStorage';

export * from './basic';
export * from './flowchart';
export * from './dataStorage';
export * from './architecture';
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
