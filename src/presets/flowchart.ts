/* ROUND BN-4 — this file is one slice of the former `src/presets.ts` (split verbatim, 2026-10-25). `src/presets/index.ts` re-exports the union, so every import of './presets' is unchanged. */
import type {Edge, Node} from '@xyflow/react';
import {type ColorKey} from '../colors';
import {PALETTE, type DiagramType, type PaletteCategory, type PaletteItem} from '../palette';
import {type Shape} from '../nodes/shapes';
import {makeEdge, FLOWCHART_EDGES, type EdgeDefaults, type TemplateSpec} from './basic';
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
export const NOTE_ITEM: PaletteItem = PALETTE.find(p => p.label === 'Note') as PaletteItem;
/* ===========================================================================
   ROUND AF — THE ONE DEFAULT SIZE FOR EVERY FLOWCHART SHAPE.

   RATIO 2.0 IS NOT A TASTE, IT IS THE FRAME'S OWN RATIO. Every silhouette is
   drawn ONCE in a normalised frame — `viewBox="0 0 200 100"` with
   `preserveAspectRatio="none"` (`ShapeFrame`, src/nodes/shapes.tsx) — so the drawing is
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
   src/nodes/DiagramNode.tsx). React Flow's resizer does not lift a below-floor node up
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

export const FLOWCHART_PALETTE: PaletteItem[] = [
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
export const flowchartBasicTemplate: TemplateSpec = {
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
export const flowchartAdvancedTemplate: TemplateSpec = {
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
export const flowchartComplexTemplate: TemplateSpec = {
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
