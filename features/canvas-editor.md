---
feature: canvas-editor
entry_paths:
  - src/App.tsx
  - src/DiagramNode.tsx
  - src/edges/GoblinEdge.tsx
  - src/useConnections.ts
  - src/useCanvasTools.ts
  - src/useUndoHistory.ts
verified: never-driven (2026-10-12; homes re-pointed 2026-10-25, ROUND BN-4 Phase D)
---
# canvas-editor

The main surface: a React Flow canvas where the user drops nodes (9 resizable shapes),
connects them with edges, bends edges, drags labels, and animates flow payloads along
connections. Selecting a node or edge opens the inspector panel on the right.

## Sub-features

- node palette: 9 shapes (service, database, queue, external, actor, storage, gateway, group, note), all resizable
- edge system: bend handles, draggable labels with anchor rebase, flow payload animation (dots/dash/pulse/icon/envelope)
- inspector panel: per-selection editors (text, colour, flow, cardinality)
- canvas navigation: Figma/Miro standard (wheel = pan, Ctrl/Cmd+wheel = zoom, left-drag = box-select)
- undo/redo that preserves the live selection

*Module homes (after the BN decomposition)*

- `src/App.tsx` — the composition root: wires the hooks, owns shared state, mounts the panels
- `src/useConnections.ts` — connect / reconnect / cycle-guard / dblclick auto-connect
- `src/useCanvasTools.ts` — align, distribute, z-order, auto-layout
- `src/useUndoHistory.ts` — the 50-step history with selection-preserving undo/redo
- `src/edges/` — the edge family: `GoblinEdge.tsx` (the ONE live component, all 5 type
  ids), `EdgeData.ts` (typed data block), `flowPayloads.tsx` (the K2 payload memo),
  `index.ts` (the type registry)
- `src/DiagramNode.tsx` — the node component (resize floors, measure)

## How to get to it (user POV)

- Open the app (dev server or built dist). The canvas is the whole screen; drag a shape
  from the left palette onto the canvas to create a node.

## Driving it with harness

Preconditions: dev server running (`npm run dev`, default port from vite config).

**Create + select a node.** Run a browser harness against the page; a node div with
`.react-flow__node` must exist and gain the `selected` class on click. The round harnesses
in `checks/` are the canonical drivers.

## Gotchas

- The harnesses assume the demo board state — tests that mutate the board must restore it.
- `checks/*.mjs` use `DS_ROOT` to point at a tree; default is the repo dir.
- After a module move, `touch` every importer: the Vite dev server keeps serving dead
  `/src/<old>.ts?t=` transforms from cache and the app silently stops mounting (BN-4 lesson).
