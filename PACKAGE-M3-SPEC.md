# PACKAGE-M3 — Responsive (tablet + phone) & desktop panel collapse

**Status:** APPROVED DESIGN, NOT IMPLEMENTED. Execution is scheduled for a NEW session.
**Approved by:** Harvey, 2026-09-15.
**Sources of truth for this spec:**
- Research (grounded, every claim has a URL): `/home/harvey/diagram-studio-research/responsive-survey.md`
- Interactive mockup of all three tiers: `/home/harvey/diagram-studio-research/mockup-M3.html`
- Screenshots: `/home/harvey/diagram-studio-research/shots/m3-full.png`, `m3-tablet.png`

---

## 1. Why this exists

The tool is intended to be shared with other users. Today it is desktop-only in practice: there is
exactly ONE breakpoint (`@media (max-width: 1279.98px)`, which only shrinks the two side panels) and
nothing at all is handled below it. Harvey's standing requirement (recorded 2026-09-15): every UI/UX
decision must consider tablet and phone, not desktop only; and on desktop both side panels should be
collapsible to widen the canvas.

Measured current state:
- 3-column CSS grid: left palette ~232px, canvas, right inspector ~288px.
- One breakpoint only (panels shrink at ≤1279.98px).
- Right inspector already auto-hides when nothing is selected (matches Figma's model).
- Left palette cannot be collapsed at all.
- Canvas navigation is already Figma/Miro-style (box-select on drag, wheel = pan, Ctrl/Cmd+wheel or
  pinch = zoom, Space+drag = pan).

---

## 2. Breakpoints to adopt (Excalidraw's published ladder)

Excalidraw is the only surveyed tool with a fully published, currently-shipping rule set, and it is the
closest architectural analogue (infinite canvas, left tool palette, right property panel, desktop-first).
Do NOT invent new numbers.

| Tier | Rule | Layout |
|---|---|---|
| `phone` | `width <= 599` **OR** (`height < 500` **AND** `width < 1000`) | Single column. Toolbar at the BOTTOM. Palette + inspector become bottom sheets. |
| `tablet` portrait | `min(w,h) >= 600 && max(w,h) <= 1180` and `w <= h` | Canvas + sliding drawers. |
| `tablet` landscape / small laptop | `width > 1180` | Keep the 3-column grid; both panels collapsible. |
| `desktop` | `width > 1229` | 3-column grid, panels collapsible + persisted. |

- The **landscape-phone clause** (`height < 500 && width < 1000`) is mandatory: an iPhone in landscape
  is 932×430 and a width-only test would wrongly keep the side panels visible.
- Moving the current 1279.98px threshold to 1229 is defensible (Excalidraw's
  `MQ_RIGHT_SIDEBAR_MIN_WIDTH`) but optional — keeping 1279.98 as the 3-column threshold is acceptable.
  Decide once and document it; do not leave two numbers meaning the same thing.

---

## 3. What to build, in order (this order is deliberate — lowest risk first)

### Step 1 — `useEditorInterface()` hook (foundation)
Returns `{ formFactor, isTouchScreen, isLandscape, canFitSidebar }`.
**Critical:** driven by a `ResizeObserver` on the EDITOR CONTAINER, not `window` — Excalidraw measures
`container.getBoundingClientRect()`. This matters because the tool is meant to be embeddable/shareable.
Also expose an overridable `dockedSidebarBreakpoint`-style constant (Excalidraw's
`UIOptions.dockedSidebarBreakpoint`, tldraw's `forceMobile`) so a narrow host can force the compact
layout.

### Step 2 — Desktop panel collapse + persistence (Harvey's explicit ask)
- Affordance: a **chevron button on each panel edge** PLUS a keyboard shortcut. Follow Figma's two-level
  model: `⌘⇧\` / `Ctrl+Shift+\` collapses one panel; `⌘\` / `Ctrl+\` hides all UI.
- Do NOT use double-click-on-divider as the only affordance (no surveyed tool documents that, and it
  conflicts with double-click-to-reset on resizable dividers).
- **Persist** the collapsed state per-panel under one namespaced `diagram-studio:` localStorage key
  (Excalidraw's `desktopUIMode` is the one shipped precedent; wrap in try/catch).
- Keep the existing selection-driven inspector auto-hide. But a MANUALLY collapsed panel must **not**
  silently re-expand when a node is selected (Figma treats "minimize" and "user-collapsed" as distinct
  states). Decide this explicitly and make the UI honest about it.

### Step 3 — Touch hardening on the existing layout (works at ALL sizes; testable in DevTools)
The mandatory ones, each with documented evidence that skipping breaks real behaviour:
1. **Long-press ≈500 ms opens the context menu** instead of right-click; cancel it when a second pointer
   lands so pinching never opens a menu. (Both Excalidraw `TOUCH_CTX_MENU_TIMEOUT = 500` and tldraw
   `longPressDurationMs = 500` use 500 ms.)
2. **Two-finger pan/zoom while a tool could be drawing**; single-finger pan on empty canvas.
3. **Raise coarse-pointer thresholds**: React Flow `nodeDragThreshold` / `connectionDragThreshold`
   default to 1px — raise to ~4–8px on touch (tldraw goes 4→6 for shape drag, 4→25 for UI drag).
4. **Tap-handle → tap-handle connection** via React Flow `connectOnClick` (already default `true`) —
   keep it and make it discoverable.
5. **Enlarge hit targets**: handles 6px → 20px (React Flow's own touch example); nothing below
   24×24 CSS px (WCAG 2.2 SC 2.5.8), aim 44–48px for primary controls.
6. **Kill hover-only affordances** — gate tooltips/hover-reveal behind `@media (hover: hover)` instead
   of deleting them.
7. **Decide `zoomOnDoubleClick` explicitly.** React Flow's source warns that double-tap BYPASSES the
   gesture filter and fires `dblclick.zoom` on the selection — if double-tap means anything else in the
   app, turn `zoomOnDoubleClick` off.
8. Consider a **view-only first touch** (Miro's mobile pattern) so a new user's first pan cannot move
   the diagram.

**Known React Flow trap (do not get bitten):** `panOnDrag` mouse-button arrays do NOT restrict touch.
React Flow's Pane early-returns for `pointerType === 'touch'` when `panOnDrag !== false` and no selection
key is held — so "left-drag = box-select" will NOT work for fingers without changing
`panOnDrag`/`selectionOnDrag` or gating on the selection key. Also: `.xy-flow__pane` already ships
`touch-action: none`, and `touch-action` intersects up the ancestor chain — an over-eager value on a
wrapper will break canvas panning.

### Step 4 — Tablet tier
- Landscape: keep the 3-column grid, inspector docked, palette collapsible.
- Portrait: both panels become sliding drawers (scrim overlay, close on backdrop / Escape).

### Step 5 — Phone tier (most new UI, so last)
- **Toolbar moves to the BOTTOM** (tldraw, draw.io, FigJam iPad all put creation tools within thumb
  reach). Top keeps only a menu + undo/redo + help.
- **Bottom sheets** for palette and inspector, partial height so the canvas stays visible. Build with
  React Flow's `<Panel position="bottom-center">` (it already carries correct positioning and z-index).
- **iOS Safari:** use `dvh`, not `vh`; any bottom-anchored bar needs
  `padding-bottom: env(safe-area-inset-bottom, 0px)` and the page needs `viewport-fit=cover`, otherwise
  the bar is unusable behind the home indicator (WebKit's own write-up says so).
- No tool publishes a hard phone floor; design at **360 CSS px** width and treat <~320px as unsupported
  (a judgement call, not a sourced number).

---

## 4. Acceptance criteria (measure, don't assert)

Each step must be verified in a browser with real measurements, and the project gates must stay green
(`npx tsc --noEmit` = 0, `npx vite build` = 0). At minimum:

1. Hook: at each breakpoint the hook reports the expected `formFactor`; it reacts to CONTAINER resize,
   not just window resize (prove it by resizing a wrapper).
2. Desktop collapse: chevron collapses/expands each panel; the shortcut works; the state SURVIVES a
   reload (read the localStorage key); a manually-collapsed panel does not re-expand on selection; the
   canvas actually gains width (measure the canvas element's width before/after).
3. Touch: long-press opens the context menu and a second pointer cancels it; handles measure ≥20px in
   touch mode; hover-only UI is hidden under `@media (hover: hover)` emulation.
4. Tablet: at 1024×768 the inspector is docked and the palette is a drawer; at 768×1024 both are drawers;
   the drawer closes on backdrop click and Escape.
5. Phone: at 390×844 the toolbar is at the bottom (measure its `bottom` vs viewport height); the palette
   and inspector open as bottom sheets; nothing is clipped behind a safe-area inset; the page uses `dvh`.
6. Landscape phone (932×430) is treated as `phone`, not tablet — assert the form factor directly.
7. Regression: the existing canvas navigation (box-select / pan / Ctrl+wheel zoom / Space+drag) still
   behaves as documented in PACKAGE-J at every tier.

---

## 5. Out of scope for M3

- No change to the board JSON schema.
- No new npm dependency.
- No collaboration/multiplayer features.
- Not a redesign of the desktop layout itself — the 3-column grid stays; M3 only adds collapse +
  responsive tiers + touch behaviour.
- Keep everything generic (the tool is meant to be shared): no owner-specific or company wording.

---

## 6. Notes for the implementing session

- Read this file, then `responsive-survey.md` (the evidence), then the mockup.
- Dev server: `http://192.168.33.200:5200/` — Harvey is on a Mac remote client; never say "localhost" to him.
- The browser harness CAN use localhost. `bringToFront` before measuring React Flow edges (a hidden tab
  never fires ResizeObserver, so no edges render).
- The screenshot daemon in the harness occasionally wedges on heavy pages; if `captureScreenshot` times
  out, restart the browser rather than retrying the same call.
- Restore the demo board "Kafka rebalance" to its clean state when testing: 3 nodes / 2 edges, preset
  `architecture`, no `theme` key, both edges `data.flow = "dots"`.
- Harvey verifies last — the orchestrator must self-verify (tsc + build + real browser evidence) before
  handing anything back.
