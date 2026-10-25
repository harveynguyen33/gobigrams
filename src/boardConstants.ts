/* boardConstants.ts — ROUND BN, ITEM 2: the module-level CONSTANT TABLES moved
 *  out of App.tsx verbatim (behaviour-neutral move: no edits, only the export
 *  keyword and this file's imports). Size budgets: checks/file-size-gate.mjs. */
import type {Edge, Node} from '@xyflow/react';
import {PRESETS, makeEdge} from './presets';
import type {SvgRejectReason} from './nodes/customShape';

/* PACKAGE-N §8.1 — the import rejection table, verbatim from the spec.
   Every message names the FIX where one exists: `no-viewbox`, `no-size` and
   `bad-size` are all the same repair ("re-export it with a viewBox and a
   size"), so they carry it; the rest are already the whole story. A Record
   keyed by `SvgRejectReason` makes the mapping total at compile time — adding a
   reason without a message is a type error, not a silent blank toast. */
export const SHAPE_REJECT_MESSAGE: Record<SvgRejectReason, string> = {
  'too-large': 'That SVG is too large (limit 512 KB).',
  'not-xml': "That file isn't valid SVG markup.",
  'no-root-svg': 'That file has no <svg> root element.',
  'no-viewbox': "That SVG has no viewBox, so it can't be scaled. Re-export it with a viewBox and a size.",
  'bad-viewbox': "That SVG's viewBox is invalid.",
  'no-size': 'That SVG declares no width and height. Re-export it with a viewBox and a size.',
  'bad-size': "That SVG's width or height is zero or invalid. Re-export it with a viewBox and a size.",
  'empty-markup': 'That SVG is empty after sanitising.',
};


export const MAX_HISTORY = 50;

/** React Flow's non-custom edge types; anything else renders through goblinEdge. */
export const PATH_TYPES = {bezier: 'goblinEdge', custom: 'goblinEdge', smoothstep: 'smoothstep', step: 'step', straight: 'straight'} as const;
export type PathType = keyof typeof PATH_TYPES;

/** Edges whose label-commit callback must be injected (all registered types). */
export const isGoblinEdge = (t?: string) =>
  t === 'goblinEdge' || t === 'bezier' || t === 'smoothstep' || t === 'step' || t === 'straight';


/* Q — THE RECONNECT GRAB RADIUS. React Flow's `<ReactFlow>` prop `reconnectRadius`
   defaults to 10 (`@xyflow/react/dist/esm/index.js` — `reconnectRadius = 10` in the
   ReactFlow signature). 10px RADIUS around a point is a ~20px-wide target to hit
   blind, which is why the reconnect gesture was undiscoverable: the anchors are
   invisible (RF paints `stroke="transparent" fill="transparent"`), so the pointer
   had to land on an unseen 20px disc. 14 is DELIBERATELY MODEST — it buys ~2x the
   area without swallowing the neighbouring interactions, and the arithmetic below
   is why it cannot go larger.

   THE GRABBER IS SHIFTED, NOT CENTRED. `EdgeAnchor` (`…/react-flow/dist/esm/index.js`)
   renders `cx: shiftX(centerX, radius, position)` and `shiftX` returns `x + shift`
   for Position.Right (x - shift for Left; same shape for shiftY on Top/Bottom). So
   the disc is pushed radius OUTWARD along the endpoint's own side: its near edge is
   TANGENT to the endpoint, and the whole disc lies OUTSIDE the handle that owns it.
   That is what makes the "does the grabber eat its own connect handle" question exact.
   Worked through for BOTH sides of ONE wire junction, all in flow units with the wire
   attachment point at J = 0 (1:1 at zoom 1; every quantity is a flow length, so the
   ratio is zoom-invariant). J is where the left node's RIGHT-side wire meets the right
   node's LEFT-side wire:
     handle dot     12px wide, and RF centres it ON its own node's border, so the dot's
                    OUTER edge is exactly the wire's attachment point — J is the outer
                    edge of BOTH owning dots (RF getHandlePosition: Right => x + width,
                    Left => x; the dot is centred on the border, so both give J)
     RIGHT-side dot  [J - 12, J];  its disc `shiftX(centerX, R, Right)` = J + R => [J, J + 2R]
     LEFT-side dot   [J, J + 12];  its disc `shiftX(centerX, R, Left)`  = J - R => [J - 2R, J]
   So each disc is TANGENT to J and therefore TANGENT to its own node's connect dot —
   adjacent, never overlapping: the grabber cannot cover the handle it belongs to. The two
   discs over one junction are MIRRORS of each other sharing only the point J, so they can
   never coincide however large R grows (both are pushed outward, away from each other).
   ONE COST of the enlargement, stated because it is real: a disc reaches 2R = 28 from J,
   while the neighbouring node's border is only 6 away at the tightest usable spacing. The
   node's opaque body paints ABOVE the edge layer (RF renders `<EdgeRenderer>` before
   `<NodeRenderer>`, and nodes carry the higher z-index), and `.react-flow__handle` is
   `pointer-events: none`, so where a disc runs under a close neighbour the NODE wins both
   the paint and the hit test — the dot is simply clipped there, never a stolen click, and
   never a blocked connect handle. At the app's normal spacing there is no clipping at all:
   the demo board's nodes sit 377 apart.
   A drop inside the grabber is NOT "elementFromPoint returns a non-handle": the circle is
   `fill: transparent` and is never hit-tested, so the drop still resolves through
   elementFromPoint / getClosestHandle exactly as it did at the 10px default. Enlarging
   the radius cannot change WHICH element a drop lands on — it only changes whether the
   user can find the band at all, which is the whole point of the paint below.
   NEAREST CONNECT HANDLE vs AN INCOMING WIRE — this is the arm that actually bounds
   the value. Every wire in the demo board meets node LEFT and RIGHT midpoints. On ONE
   node the TOP / BOTTOM / end midpoints all SHARE an x, so the nearest handle that is
   NOT the endpoint is exactly H/2 away, for ANY node width — this arm is bounded by the
   node HEIGHT alone. React Flow persists the measured box into the board file, so the
   real numbers are 190 wide and 114-131 tall. At the smaller one H/2 = 57, so 14 clears
   the nearest connect handle with a 4.07x margin; the neighbouring wire's own endpoint
   is 175 away (borders at 137 and 324, endpoints at 143 and 318), an order of magnitude
   clear. THE VISUAL GAP is what makes the enlargement safe rather than merely hittable:
   the disc ends 28 from the junction, while the next node's border is 153 beyond that —
   at the app's normal spacing the disc sits in open canvas and never reaches a
   neighbour. 20 would spend that margin for no discoverability gain. */
export const RECONNECT_RADIUS = 14;
/* HARVEY 2026-10-13 — dblclick-a-handle auto-connect reach, in flow px
   (centre-to-centre). Beyond this the nearest shape is IGNORED. */
export const DOUBLE_CLICK_CONNECT_RANGE = 400;
/* Below this facing gap (px) the auto-connect renders a STRAIGHT edge instead
   of an elbow — no kink when the shapes nearly touch (Harvey, batch #3). */
export const DBL_STRAIGHT_GAP = 160;



/** G — the four connection points of the goblin node (src/nodes/DiagramNode.tsx
 *  NodeHandles). The onConnect direction guard is scoped to these: an ERD
 *  column handle is NOT in the set, so a relationship drag is never re-aimed. */
export const GOBLIN_HANDLE_IDS: ReadonlySet<string> = new Set(['left', 'right', 'top', 'bottom']);

/** H3a: the seeded sample reads as a tiny pipeline — External → Queue → Service —
 *  L2: built through the preset's palette + edge factory, so the seed is the
 *  same shape of data a user creates. */
export const initialNodes: Node[] = [
  {id: 'n1', type: 'goblin', position: {x: 60, y: 180}, data: PRESETS.architecture.palette[3].make() as any},
  {id: 'n2', type: 'goblin', position: {x: 360, y: 170}, data: PRESETS.architecture.palette[2].make() as any},
  {id: 'n3', type: 'goblin', position: {x: 680, y: 180}, data: PRESETS.architecture.palette[0].make() as any},
];
export const initialEdges: Edge[] = [
  {...makeEdge('n1', 'n2', PRESETS.architecture.edges, 'e1'), label: 'events'},
  makeEdge('n2', 'n3', PRESETS.architecture.edges, 'e2'),
];

