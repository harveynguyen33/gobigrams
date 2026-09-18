# PACKAGE-J-SPEC — Canvas navigation: Figma/Miro-style pan/zoom

**Status:** approved by Harvey 2026-09-14 (supersedes the earlier Excalidraw framing — Harvey changed his mind; **Figma/Miro is the target**) · **Implementer:** coder profile

## Problem

On an empty canvas Harvey cannot move (pan) the view: the only pan binding was
**middle mouse button**, which a Mac trackpad does not have. He could zoom but not
scroll around the drawing. Fix = give him the standard canvas gestures that Figma and
Miro use.

Original config — `src/App.tsx`:

```tsx
selectionOnDrag          // left-drag = box-select
panOnDrag={[1]}          // only middle mouse (button 1) pans  ← the bug
selectionKeyCode={['Shift']}
```

## Target behaviour — Figma/Miro standard (verified against official docs, 2026-09-14)

Sources:
- Figma: *Pan and zoom* — plain trackpad two-finger scroll pans; wheel scrolls the canvas;
  `Ctrl`(Win)/`Cmd`(Mac)+scroll zooms; left-drag on empty canvas draws a marquee (selection box).
- Miro: *Using Miro with a mouse, trackpad, or touchscreen* — "Slide two fingers to move
  around the board · Pinch to zoom"; to select objects you drag on the canvas; pan also via
  Space+drag or right-mouse-drag; **Trackpad mode**: wheel scroll pans, wheel+`Ctrl`/`Cmd` zooms.
- Confluence whiteboards (same family): scroll pans (Shift+scroll = horizontal), Ctrl/Cmd+scroll
  zooms, hand tool / Space+drag pans.

| Gesture | Result |
|---|---|
| **Left-drag on empty canvas** | **Box-select (marquee)** — NOT pan |
| `Shift` + left-drag | Box-select (same; kept as an alias) |
| Wheel / two-finger trackpad scroll | **Pan** (free, both axes) |
| `Shift` + wheel | Pan horizontally |
| `Ctrl`/`Cmd` + wheel (= trackpad pinch) | **Zoom** |
| Pinch (trackpad) | Zoom |
| `Space` + left-drag | Pan |
| Middle-drag / right-drag | Pan |
| Right-click (no drag) | Pane context menu (must keep working) |

This differs from Excalidraw, where left-drag pans. **Here left-drag selects** — the fix for
Harvey's Mac is that **two-finger scroll pans** instead of zooming.

## Implementation — React Flow v12 props (`src/App.tsx`, the `<ReactFlow>` block)

Current state after the first pass (Excalidraw flavour) — change it to:

```tsx
// J: Figma/Miro-style canvas navigation — scroll pans (free, both axes),
// Ctrl/Cmd+scroll (trackpad pinch) zooms, left-drag marquee-selects,
// Space+drag / middle / right drag pans.
selectionOnDrag                                  // left-drag = marquee select
selectionKeyCode={['Shift']}                     // Shift+drag also selects
panOnDrag={[1, 2]}                               // middle + right pan (button 0 removed!)
panOnScroll                                      // wheel / two-finger = pan
panOnScrollMode={PanOnScrollMode.Free}           // both axes
zoomOnScroll={false}                             // plain scroll must NOT zoom  ← the bug fix
zoomOnPinch                                      // pinch zooms
zoomActivationKeyCode={['Meta', 'Control']}      // Cmd/Ctrl + scroll = zoom
// panActivationKeyCode stays default ('Space') — Space + drag pans
```

Changes vs the Excalidraw pass: `panOnDrag` drops button `0` → `[1, 2]`; `selectionOnDrag`
goes back to **on** (remove `selectionOnDrag={false}`). Everything else is unchanged.

**Verify the exact prop names/values against the installed `@xyflow/react` v12 types**
(`node_modules/@xyflow/react/dist/esm/types/*.d.ts`) before writing — in particular confirm
`zoomActivationKeyCode` accepts an array (the current code already compiles with it, so it does).

**Conflict checks (do not skip):**
- Right-drag must still pan **and** right-click must still open the pane context menu —
  with `panOnDrag={[1, 2]}` confirm both; if right-click breaks, fall back to `[1]`.
- `onDoubleClick` insert-palette handler must still work.
- `onPaneContextMenu` must still fire.
- Node drag / resize / edge reconnect unaffected (they capture the pointer on the node).
- Note: React Flow's resize/reconnect need trusted pointer events — synthetic DOM events will
  not drive them (see DEV-NOTES "Pitfalls learned").

## Docs to update in the same change (keep consistent — no stale instructions)

The first pass already edited these to the Excalidraw wording — **rewrite them to Figma/Miro**:

1. `README.md` — keyboard-shortcuts table. Correct rows:
   `Drag on empty canvas | Box-select` · `Shift + drag | Box-select` · `Scroll / two-finger | Pan (both axes)` · `Ctrl/Cmd + scroll (pinch) | Zoom` · `Space + drag / middle-drag | Pan`.
2. `README.md` — any "Navigating the canvas" note: scroll moves, Cmd/Ctrl+scroll zooms.
3. `src/App.tsx` cheat-sheet popover (the `<div className="help-row">` list ~line 1679):
   rows must say **Pan — scroll / Space+drag / middle-drag** and **Zoom — Ctrl/Cmd+scroll / pinch**.
   (The first pass added "Pan canvas"/"Zoom canvas" rows — fix their key labels.)
4. `src/Tour.tsx` — "Canvas" step body (~line 31): scroll to move around, Cmd/Ctrl+scroll to
   zoom, drag to box-select. (First pass wrote the Excalidraw wording — correct it.)
5. Empty-state hint in `src/App.tsx` if it helps.

## Acceptance criteria (prove each with measured evidence, not assertion)

1. `npx tsc --noEmit` → 0 errors.
2. `npx vite build` → 0 errors.
3. Plain wheel over the canvas **pans** and does **not** change zoom (viewport translate
   changes, scale unchanged).
4. Ctrl/Cmd + wheel **zooms** (scale changes).
5. **Left-drag** on empty canvas creates a **selection box** and does **NOT** pan
   (translate unchanged, selection box present during drag).
6. Shift + left-drag also creates a selection box.
7. Right-click on empty canvas still opens the context menu.
8. Double-click empty canvas still opens the insert palette.
9. Dragging a node still moves only that node; node resize still works with a real mouse.
10. `Space` + left-drag pans (verify if the harness allows; otherwise say so).

Report the exact file diff summary and the measured evidence for 3-6. If a criterion cannot
be verified headlessly (React Flow drag/resize needs trusted events), say so explicitly
instead of claiming a pass.

## Constraints

- English artifacts. Keep it generic (this tool will be shared). No Harvey/company content.
- Do NOT git-commit (no repo yet). Do NOT delete or reseed boards; leave
  `boards/mu01q1ue3a854b81.json` ("Kafka rebalance", 3 nodes / 2 edges) untouched.
- Dev server already running on :5200 — do not kill it. Use
  `node ./node_modules/vite/bin/vite.js build` for the build check (one-shot).
