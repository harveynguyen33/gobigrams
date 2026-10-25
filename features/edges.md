---
feature: edges
entry_paths:
  - src/edges/GoblinEdge.tsx
  - src/edgeLabel.ts
  - src/edgeBend.ts
  - src/useEdgeGesture.ts
  - src/useConnections.ts
verified: never-driven (created 2026-10-25, ROUND BN-4 Phase D)
---
# edges

Connections between nodes: one live component renders all five type ids (goblin bezier,
smoothstep, step, straight, custom), with draggable labels, bend handles, flow-payload
animation and per-edge authored colour.

## Sub-features

The edge family homes and their roles:


- `src/edges/GoblinEdge.tsx` — the ONE live edge component (all 5 type ids; both gesture
  handlers live in-component — they share one per-instance useEdgeGesture claim latch)
- `src/edges/edgeData.ts` — the typed edge data block
- `src/edges/flowPayloads.tsx` — the K2 payload memo (dots/dash/pulse/icon/envelope)
- `src/edges/index.ts` — the type registry
- `src/edgeLabel.ts` — label geometry/anchoring
- `src/edgeBend.ts` — bend path maths
- `src/useEdgeGesture.ts` — the label-drag gesture
- `src/useConnections.ts` — connect/reconnect/cycle-guard/dblclick auto-connect (App side)

## How to get to it (user POV)

Hover an edge: endpoints reveal (reconnect dots), the label becomes the drag target, bends appear. Open the inspector with an edge selected for its panel.

## Driving it with harness

The edge family is covered by the round-ak/al/am/an/ao/s harnesses (readers union
`src/edges/*`). Live: connect two nodes, drag a label, bend an edge, watch a payload.

## Gotchas

- All five type ids mount ONE component (src/edges/GoblinEdge.tsx); there are no per-type wrappers to find.
- src/edgeLabel.ts and src/edgeBend.ts are imported by name — union readers cover both.
