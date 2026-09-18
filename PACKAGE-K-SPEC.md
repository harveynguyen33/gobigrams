# PACKAGE-K — EventCatalog visual techniques (hover choreography, SMIL payloads, layout transition, glow handles, post-it nodes)

**Source of truth for technique details:** `/home/harvey/ec-research/eventcatalog-reactflow-report.md`
(evidence base: EventCatalog `packages/visualiser`, MIT, `@xyflow/react@^12.6.1`, commit `c75c674`).
Read the relevant section of that report before implementing each item — it has code-level descriptions
and the exact pitfalls to honour.

**Goal:** port the genuinely reusable visual/motion techniques from EventCatalog's React Flow layer into
Diagram Studio. Keep everything generic (no EventCatalog domain semantics). Do not regress any existing
feature (undo/redo, box-select, align/distribute, resize, snap, search palette, icon picker, edge
inspector + flow animation, tooltips, boards, import/export). Dark theme only.

**Constraints**
- English artifacts. No Harvey/company-specific content. No new npm dependency.
- Keep the existing `flow*` edge data contract (`flow`, `flowCount`, `flowDuration`, `flowIcon`) —
  K2 UPGRADES it, does not replace the inspector controls.
- Every item must be independently testable in a browser on port 5200 (LAN `http://192.168.33.200:5200/`).
- `npx tsc --noEmit` = 0 and `npx vite build` = 0 at the end. No git commit (no repo).

---

## K1 — Hover choreography (electric edge + neighbour pulse) + interaction perf guard

**Technique:** report T1 + T3.

**Behaviour**
- Hover an **edge** → that edge's path goes "electric": accent stroke, thicker, a soft glow
  (`filter: drop-shadow`), a flowing dash (`animation: ec-edge-dash .5s linear infinite` on
  `stroke-dashoffset`), and both endpoint nodes get a pulsing outline. The edge label, if present,
  gets emphasised (bolder).
- Hover a **node** → every edge connected to it (source OR target, any direction) goes electric, and
  every peer node at the other end of those edges gets the pulsing outline. Use a deduped set for peers.
- Perf guard: while the user is panning / zooming / dragging a node, all animated edge payloads
  (K2's payloads + the existing dots/icons) are hidden (`visibility: hidden`) to avoid expensive SVG
  repaints. Reference-counted so overlapping start/end events don't clear early.

**Implementation**
- Register `onEdgeMouseEnter` / `onEdgeMouseLeave` / `onNodeMouseEnter` / `onNodeMouseLeave` on `<ReactFlow>`
  (App.tsx ~L1714). Keep the handlers dependency-free by holding `edgesRef` (updated each render).
- Target React Flow's own DOM: `.react-flow__node[data-id="…"]`, `.react-flow__edge[data-id="…"]`.
  Add/remove the classes shown in the report (`ec-node-hover-edge`, `.ec-edge-hover-node`, etc.).
  Store returned elements in refs for cleanup on leave. Zero React re-renders.
- Accent for the electric treatment: use the existing `--sel` token (`#3b82f6`) on this dark canvas
  (the report's `#00d9ff` is EventCatalog's dark accent; keep Diagram Studio's own accent).
- Perf guard: ref-counted `startInteraction`/`endInteraction` wired to `onMoveStart`/`onMoveEnd` and
  node drag start/stop, toggling one `.interaction-active` class on the flow wrapper. CSS hides
  animated payloads under that class. **Scope the class to the Diagram Studio wrapper**, not globally.
- CSS lives in `src/styles.css` (tokens + rules). Prefix new classes to avoid collisions
  (e.g. `.ds-edge-hover`, `.ds-node-hover`, `.ds-interaction-active`).

---

## K2 — Upgrade flow payloads to shape-aware SMIL payloads driven by the existing props

**Technique:** report T2 (ADAPT).

**Behaviour**
- The existing `flow` modes must keep working. Upgrade the `dots` and `icon` modes so that:
  - payload **count** = `flowCount` and **speed** = `flowDuration` (already true) — but the `dur`
    attribute must be a valid SMIL time string: format `${flowDur}s` (bare ms is parsed as seconds).
  - each edge gets a small random start offset (`useMemo(() => Math.random(), [])`) so parallel edges
    do NOT animate in lockstep, plus the existing per-payload stagger.
  - the payload follows the **real computed edge path**; keep using `path={path}` (already correct) —
    the report's `mpath` indirection is optional and not required here since the path is inline.
  - payload `pointerEvents` must be `none` so it cannot steal clicks from the edge hit area.
  - the SMIL subtree is memoised so it is only rebuilt when endpoints actually move
    (`useMemo` keyed on `[path, id, flowCount, flowDur]`).
- Add a new flow mode **`event`**: a rounded-rect + flap "envelope" payload (not a dot, not a chip)
  travelling the path with `rotate="auto"` — the report's 14×10 `rx=1.5` envelope glyph, scaled to
  fit an edge payload (~16×12). This is the most visible upgrade ("a message being delivered").

**Implementation** — `src/GoblinEdge.tsx`
- Extend the `flow` union with `'event'`.
- Add the envelope glyph (rect + `M…` flap path), fill from `stroke`, flap stroke from `--card`/`--bg`.
- Wire `randomDelay` + `useMemo`. Keep `dur={`${flowDur}s`}`.
- Expose `event` in the edge inspector's flow-mode selector (App.tsx ~L1913–1932) with label
  "event (envelope)". `flowIcon` remains for the `icon` mode only.

---

## K3 — CSS-only re-layout transition + animation gating

**Technique:** report T4 + T11.

**Behaviour**
- Any **programmatic** re-layout (auto-layout, subflow expand/collapse, import) eases in instead of
  snapping: `.ds-animating-layout .react-flow__node { transition: transform .35s cubic-bezier(.4,0,.2,1) }`.
- The class is added before the layout and removed after the transition (400ms > 350ms) so it never
  applies during a user drag. Guard the timeout with a ref (clear any pending timer) so rapid
  successive layouts don't strip the class mid-transition.
- Animation gating: when a board exceeds **30 nodes**, animated edge payloads default OFF (persisted
  in localStorage, e.g. `diagram-studio:animate`), with a user toggle in the edge inspector (or the
  existing options area) to force it back on. Note: Diagram Studio's existing auto-layout already has
  a 300ms rAF animation — K3's CSS transition is additive and must not conflict with it; prefer to
  let the CSS transition own programmatic layout moves that are NOT the auto-layout rAF tween.

**Implementation** — App.tsx + `src/styles.css`. Wrap programmatic layout calls with a helper that
adds/removes the wrapper class.

---

## K4 — Glow handles (single keyframe + accent variable)

**Technique:** report T6 (ADAPT — one keyframe, not nine).

**Behaviour** — the real React Flow `<Handle>` stays invisible/interactive as today, but a decorative
non-interactive `div` sits on top of it: a small gradient disc with a `2px solid` canvas-bg border
(so it reads as punched out of the card) and a soft pulsing box-shadow **in the shape's accent colour**
(one keyframe, colour from a CSS variable / the node's accent token — NOT nine hard-coded keyframes).
Reveal it on hover/selected so it doesn't add noise at rest (keep the current "handles hidden at rest"
convention).

**Implementation** — `src/DiagramNode.tsx` (next to the existing `<Handle>`s) + `styles.css`.

---

## K5 — Post-it treatment for `actor` and `note` only + group header polish

**Technique:** report T8 (ADAPT narrowly).

**Behaviour** — apply ONLY to shapes `actor` and `note` (they are the "human/annotation" shapes; a
rotated gradient card on `service`/`database`/`queue`/`gateway` would fight the architecture language):
- slight rotation (~±1°), subtle gradient surface, a folded-corner (a zero-size div with asymmetric
  `borderWidth`), and a faint corner watermark of the shape's icon (`opacity ~0.2`, `rotate(12deg)`).
Also (all shapes' group): overlapping circular icon badge on the group header — a 32px circular badge
positioned to overlap above a 44px header banner. Keep the React Flow node `style`
`{background:'transparent', border:'none', padding:0}` split for `group` so CSS owns the chrome while
React Flow owns the box (this already partly exists — extend, don't break resizing).

**Implementation** — `src/DiagramNode.tsx` + `styles.css`. Must not break I5 resize (inner `.node`
fills the wrapper both axes) nor the NodeResizer.

---

## Verification (self-verify before reporting — measured evidence, not "looks fine")
1. `npx tsc --noEmit` = 0, `npx vite build` = 0.
2. Dev server live on 5200; open in a real browser and measure:
   - K1: hovering an edge adds the electric class to the path AND the pulse class to both endpoints
     (query the DOM and print the class lists + computed `stroke`/`filter`). Hovering a node lights
     all its connected edges (count must equal the node's degree).
   - K1 guard: during a synthetic pan (dispatch events / `onMoveStart`) the payload elements have
     computed `visibility: hidden`; after `onMoveEnd` they are visible again.
   - K2: create a 3-node board with an `event`-flow edge; `document.querySelectorAll('.edge-flow …')`
     shows `flowCount` payloads each with an `<animateMotion dur="2.4s">`; change `flowDuration`
     in the inspector → the `dur` attribute updates to e.g. `3s`. Confirm `pointer-events:none`.
   - K3: trigger auto-layout → the wrapper carries the animating class during the move and not after
     ~400ms; with >30 nodes on the board, payload animation defaults off and the toggle re-enables it.
   - K4: hover a node → the glow disc is present over the handle with the shape's accent colour.
   - K5: `actor`/`note` nodes render rotated + watermark; other shapes unchanged; group badge overlaps.
3. No regression: existing `flow` modes (none/dots/dash/pulse/icon) still render; undo/redo, export
   PNG/SVG/JSON, import, boards still work.
4. Board hygiene: leave the demo board "Kafka rebalance" (`boards/*.json`) at a clean state; delete
   any board you create while testing (unless it is the demo board).

**Report format:** table of each item (K1–K5) with status + the measured evidence (DOM query output,
attribute values, class names) + any deviation from this spec and why. If something cannot be verified
headlessly (e.g. a real mouse-hover feel), say so explicitly.
