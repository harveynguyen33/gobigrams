---
feature: canvas-editor
entry_paths:
  - src/App.tsx
  - src/DiagramNode.tsx
  - src/GoblinEdge.tsx
verified: never-driven (2026-10-12)
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

## How to get to it (user POV)

- Open the app (dev server or built dist). The canvas is the whole screen; drag a shape
  from the left palette onto the canvas to create a node.

## Driving it with harness

Preconditions: dev server running (`npm run dev`, default port from vite config).

**Create + select a node.** Run a browser harness against the page; a node div with
`.react-flow__node` must exist and gain the `selected` class on click. The round harnesses
in `checks/` (38 files, `node *.mjs` from repo root with the dev server up) are the
canonical drivers.

## Gotchas

- The harnesses assume the demo board state ("Kafka rebalance", 3 nodes / 2 edges) — tests
  that mutate the board must restore it byte-identical.
- `checks/*.mjs` use `DS_ROOT` to point at a tree; default is the repo dir.
