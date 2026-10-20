# DEV NOTES — Diagram Studio (engineering)

Internal notes. For the user-facing guide see `README.md`.

## Run / access

```bash
cd ~/projects/tech-goblin/lab/diagram-studio
npm install
npx vite --host 0.0.0.0 --port 5200 --strictPort
```

- Same machine: `http://localhost:5200/`
- From another device on the LAN (Harvey's Mac): `http://192.168.33.200:5200/`
  (`--host 0.0.0.0` is required; `localhost` will not resolve remotely.)

Stop safely — **never** `pkill -f vite` (it kills your own shell):

```bash
for p in $(ss -lntp | grep 5200 | grep -oP 'pid=\K[0-9]+'); do kill $p; done
```

## Architecture

```
src/
├── main.tsx           # entry
├── App.tsx            # shell: toolbar, panels, canvas, inspectors, shortcuts, history, boards glue
├── DiagramNode.tsx    # shape-driven node (ShapeFrame + lucide/glyph icon + NodeResizer)
├── GoblinEdge.tsx     # custom edge: curvature + inline label editing + flow animation, edgeTypes
├── LabelNode.tsx      # free-text 'label' node
├── IconPicker.tsx     # searchable lucide popover
├── SearchPalette.tsx  # double-click-canvas insert palette
├── Tooltip.tsx        # reusable tooltip (hover + focus, ~350 ms)
├── boards.ts          # board persistence client (fetch + localStorage last-id)
├── shapes.tsx         # 9 architecture shapes + ShapeFrame + ShapePreview
├── palette.ts         # palette presets + COLORS
├── lucideIcons.ts     # curated lucide registry
└── styles.css         # design tokens + all component styles
```

Persistence: dev middleware in `vite.config.ts` → `/api/boards` (+ `/:id`) writing one
JSON file per board to `boards/` (git-ignored). Debounced 800 ms autosave.
PUT on a board id that does not exist answers 404 and writes nothing — a deleted
board cannot resurrect through an in-flight autosave (AS-4). RECOVERY: every board
write keeps ONE previous generation beside the file — `boards/<id>.json.bak` holds
the document AS IT WAS before the latest save (AS-6); if a save destroys content,
restore by copying the `.bak` over the `.json` (same one-generation scheme as
`boards/library.json.bak`). `vite preview` serves the same `/api/*` middleware, so
`npm run build && npm run preview` is self-hostable; a dumb static host (no server
process) is NOT supported.

## Design tokens

`--bg #0b0b0d` · `--surface #131316` · `--elevated #1a1b1f` · `--border #26272c` ·
`--border-strong #33343a` · `--fg #e8e8ea` · `--dim #8a8a92` · `--acc #f54e00`
(brand + exactly one CTA) · `--sel #3b82f6` (selection/active) · `--green #4ade80`.

Rules: dark only · no UI text below 11px · node titles in sans, mono for kickers/metrics ·
selection = 2px `--sel` ring (never a glow) · handles hidden at rest, visible on hover ·
one grid only (16px, `rgba(255,255,255,0.07)`) · edges static by default
(animation means "running").

## Where this came from

An independent UI/UX audit (separate model, evidence-first) + a React Flow pattern study
(n8n, LangFlow, Dify, Flowise, Retool, ComfyUI, React Flow Pro) drove a redesign in packages:

- **A+B (visual foundation):** selection ring vs glow · 40px single-row icon toolbar
  (was 110px / 10 text buttons) · accent split (10 orange elements → 4) · typography floor ·
  single grid · snap/grid alignment · hidden handles · static edges · icon-picker overflow fix ·
  bare-key shortcuts · toast.
- **C+D (structure & pro):** grouped inspector · multi-select summary · node resize ·
  collapsible panel · zoom pill · edge-label capsule · search palette · cheat sheet ·
  Escape · parallel-edge dedupe.
- **E (boards):** multi-document persistence + autosave + board menu.
- **F (advanced):** context menus · helper lines · node toolbar · edge reconnect ·
  add-node-on-edge · subflows · cycle prevention · auto-layout · proximity connect.
  See `PACKAGE-F-SPEC.md`.

Key insight from the research: *quiet at rest, exact when touched.*

## Roadmap (next)

- Automation: generate diagrams from code/config
- Animation: message-flow motion for the article piece (Motion Canvas covers the rebalance video)
- Server-side boards (currently dev-middleware only — needs a real backend before public hosting)
- Clean SVG export (currently `foreignObject`-based — fine in browsers, not in Figma/Inkscape)
- Templates (pipeline / rebalance / env-ladder)
- Code-split the bundle (~600 kB with lucide)
- Generic defaults: remove the seeded "Kafka rebalance" board name and the `~/tech-goblin`
  breadcrumb in the panel header before sharing publicly

## Pitfalls learned

- React Flow `<Controls>` ships a white background — override `.react-flow__controls-button`.
- `useStore` must be called INSIDE `ReactFlowProvider` / inside `<ReactFlow>` children.
- `zoomOnDoubleClick` swallows double-click — disable it for a custom dblclick-on-canvas handler.
- React Flow needs trusted pointer events for connection drags; headless CDP can't drive them
  (verify connection logic in code, not in an automated browser).
- Handles hidden at rest must still be revealed for `.connecting` / `.valid` or you can't connect.
- StrictMode double-mount: guard one-shot bootstrap with a ref (bit the boards seeding).
- `updateEdge` marker handling: an explicit `none` is `undefined`, so check key PRESENCE
  (`'markerEnd' in patch`) not value, or you cannot remove an arrow head.
- `replaceData=true` on edge data REPLACES the object — it wiped the `flow` key when changing
  count/speed. Prefer merge mode unless a full replace is intended.
- `preserveAspectRatio="none"` on the shape frames stretches geometry vertically; the ellipse
  rings on the cylinder look flatter than authored at short node heights (acceptable, watch it).
- Icon-chip flow markers must not use `--surface` — too close to the canvas bg; use `--elevated`
  plus a stronger stroke or they are invisible.
- **Node click vs drag is TWO gates with TWO numbers.** `nodeDragThreshold` starts the drag;
  d3-drag's `clickDistance` (fed by `nodeClickDistance`) suppresses the trailing click — and
  React Flow defaults the latter to **0**. If `nodeClickDistance < nodeDragThreshold`, travel in
  `(clickDistance, dragThreshold]` does NOTHING: no click, no drag (a "dead band" — a press that
  moves 2-4px silently fails). Raise BOTH together, per pointer class; the constants and the full
  d3-drag / @xyflow source trace live in `src/touch.ts`, and
  `node checks/node-click-distance.harness.mjs` asserts the pairing. `nodeDragThreshold` and
  `nodeClickDistance` must both be passed to `<ReactFlow>`.
