# SHARED BRIEF — Palette / shape-library redesign research

Project under study: **Diagram Studio** — Harvey's own React Flow diagram editor at
`/home/harvey/projects/tech-goblin/lab/diagram-studio` (React 19 + Vite + `@xyflow/react` v12,
TypeScript, MIT). It is intended to be shared with other users, so everything must stay GENERIC
(no owner/company content).

## What exists today (measured from the code)

- The left panel is ONE flat list of shape items. There is NO grouping, NO categories, NO search
  inside the palette.
- The list is defined per **preset** (diagram type). There are 4 real presets plus `custom`:
  `architecture`, `flowchart`, `c4`, `erd`, `custom` (union of all).
- A palette item is `{label, hint, shape, colorKey, kind, size?, make()}` — see `src/palette.ts`
  and `src/presets.ts`. `make()` returns the node's initial data.
- There are 10 base shapes (`SHAPES` in `src/shapes.tsx`: service, database, queue, external, actor,
  storage, gateway, group, note, text) plus 9 ISO-5807 flowchart shapes and a C4 set.
- Shapes render with a symbolic colour KEY resolved per theme (`--c-*` tokens). Boards store colour
  keys, never hex, so a theme recolours an existing board.
- Boards are plain JSON files under `boards/<id>.json`, served by a Vite dev middleware (GET + PUT).
- There is already an **insert palette** (`src/SearchPalette.tsx`, class `.sp-overlay`) that opens on
  a double-click on the canvas and is searchable. The left panel is NOT searchable.

## What Harvey asked for (2026-09-16, translated)

1. The left panel should work like **draw.io's left sidebar**: the shapes/elements/components are
   **categorised into groups** rather than one flat list. He explicitly said "tham khảo các bên khác
   nếu có design ok hơn" — i.e. if another tool has a BETTER palette design than draw.io, propose it.
2. A **scratchpad** whose purpose he defined precisely: **a place to keep the shapes the user LIKES**
   (a personal favourites/library area) — NOT draw.io's drag-temporarily-here scratchpad.
3. A **custom element** feature so a user can add their own icons/shapes beyond the built-in set.
4. Custom material must respect the app's rules — his words: **"không phá layout là chính"**
   (chiefly: must not break the layout).
5. Everything is stored **on the local machine for now** (no backend yet).

## DECISIONS FROM THE USER (2026-09-16) — these are settled, do not propose alternatives

- **Custom shapes + favourites live in a SEPARATE USER LIBRARY, not inside a board's JSON.**
  Harvey explicitly chose a personal library reusable across many boards over per-board storage.
  The model to follow is **Excalidraw's library** (a personal, document-independent library with
  import/export as a file), NOT draw.io's drag-a-shape-here-temporarily scratchpad.
- **Shape source must be FLEXIBLE — "like Excalidraw allows"**: user-supplied graphics (importing or
  dragging in an SVG) are in scope, not merely picking from a built-in icon set.
- The scratchpad's purpose is **"a place to keep the shapes the user LIKES"** — a favourites/library
  area. It is NOT a temporary holding pen.
- Custom material must **not break the layout** ("không phá layout là chính").

- **Grounded only.** Every claim about how another tool behaves must carry a source URL. If you cannot
  verify it, write `[UNVERIFIED]` next to it — do not present recollection as fact.
- **Prefer the tool's own docs / source / changelog** over blog posts. For open-source tools
  (draw.io/diagrams.net, Excalidraw, tldraw) read the actual source or docs.
- **Quote exact UI strings** where they matter (a category name, a menu label) so the design can copy
  the real convention rather than invent one.
- Be concrete about DATA and MECHANISM, not aesthetics: what structure does the tool store, how does it
  decide the groups, how does search work, how does a custom shape get defined and persisted.
- Do NOT write any code. Do NOT touch the project. This is research only.

## Output rules

- Write your report to the exact path given in your own task. Do not write anywhere else.
- Markdown, English, headings + tables. Every tool gets a short section with: the palette structure
  (grouped? collapsible? searchable?), the scratchpad/library behaviour, the custom-shape mechanism,
  and a source URL per claim.
- End with a `## Recommendation` section for YOUR cluster only, and a short `## Sources` list of every
  URL you used.
