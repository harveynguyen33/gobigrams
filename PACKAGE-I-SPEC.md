# Package I — Bug fixes from Harvey's UI review (2026-09-14)

Six issues reported after using the tool from a **Mac client over LAN** (not localhost).
All confirmed by reproduction unless noted. Fix them all; do not regress anything.

---

## I1 — Tour spotlight on `.canvas-wrap` shows only its left border

**Repro (measured):** viewport 1280×577. Step 4 spotlight rect: `x=226, y=-6, w=1060, h=589`.
The canvas fills almost the whole window, so with `PAD` expansion the spotlight extends past the
right edge (226+1060=1286 > 1280), above (y=-6) and below (y=-6+589=583 > 577). The dim
(`box-shadow: 0 0 0 9999px`) covers everything outside the spotlight, so the right/top/bottom
edges of the ring are off-screen — Harvey sees only the left border.

**Fix:** clamp the spotlight rect to the viewport (and clamp the padding to what fits), so the
full ring is always visible with a small margin (e.g. keep ≥4px inside the viewport on all
sides). When the target is larger than the viewport, inset the spotlight instead of expanding
it. Keep the card placement logic working with the clamped rect.

## I2 — Tour "Back" button at step 8/8 does not respond

Harvey reports the **Back** button at the last step cannot be clicked. My automated test used
`elementFromPoint` at the button centre and it returned the button itself, and a scripted
`.click()` did go 8/8 → 7/8 — so the cause is not an overlap *at the button centre*.
Investigate for real (mouse, not script):
- Is the card positioned so part of the button row is under the viewport edge or under another
  element at the last step? Step 8 targets `.help-btn`.
- Does the `autoFocus` on the primary button plus the capture-phase keydown handler interfere?
- Reproduce with an actual mouse drag/click on the button (not `.click()`), at several window
  sizes, and confirm Back works from every step including the last.
Report the real root cause you find (or prove it already works with a mouse and say so).

## I3 — Help tooltip is clipped by the bottom of the window

`src/Tooltip.tsx` `place()` returns a position with no viewport clamping. The help button sits
near the bottom of the window, the default `side` is `'bottom'`, so the popover renders below
the window and is cut off.

**Fix:** after computing the preferred position, clamp it into the viewport, and **flip** to the
opposite side when the preferred side does not fit (bottom↔top, right↔left). Keep a small
margin (~8px). Also clamp horizontally. Applies to every tooltip (toolbar, help, inspector).

## I4 — PNG / SVG export hangs from a remote (Mac) client — no download

Locally the export completes in ~1s and the file downloads (verified). From Harvey's Mac over
the LAN it "always gets stuck at the end and no download". The PNG path sets
`a.href = <data-URL from html-to-image>` and calls `a.click()` without attaching the anchor to
the document — **Safari blocks/ignores downloads from a detached anchor with a large `data:`
URL**, which matches "stuck at the end, nothing happens".

**Fix (apply to PNG, SVG and JSON exports):**
- Convert the result to a `Blob` + `URL.createObjectURL(blob)` instead of a giant `data:` URL.
- `document.body.appendChild(a)`, `a.click()`, then remove the anchor and revoke the object URL
  (in a `setTimeout`, so Safari has a chance to start the download).
- Wrap the PNG render in a timeout / `Promise.race` so that if `html-to-image` stalls, the user
  gets a clear "export failed" message instead of a silent hang.
- Add `skipFonts: true` (and any equivalent option that avoids fetching cross-origin
  stylesheets) to the `toPng` call if it does not hurt the output.
- Ensure the export works when the page is opened from a non-localhost origin over the LAN.

## I5 — A node cannot be resized in more than one direction

Harvey: "I cannot scale the shape in multiple directions, only horizontally."

Resizing is gated to `RESIZABLE = {group, note, service}` in `src/DiagramNode.tsx`, and the
`NodeResizer` renders 8 controls (4 edge lines + 4 corner handles — measured). The vertical
drag did not take effect in my CDP-driven test, but CDP synthetic events are known not to drive
React Flow's resize handler, so that test is inconclusive.

**Investigate with a real mouse and find the actual cause.** Suspects, in order:
1. `.node { min-width: 190px }` with no height constraint combined with the absolutely
   positioned `.shape-frame` (`inset: 0`) — check whether the node's height is driven by content
   and overrides the resized `height`.
2. Whether `.node-body` padding or the shape SVGs prevent the node from growing vertically.
3. Whether the corner/edge handles are reachable (hit target, pointer-events, z-index) so a
   vertical drag actually starts.

Fix so that every resizable shape can be dragged **both horizontally and vertically** (and
corner-resized diagonally), and resize **persists** through the board JSON. Consider whether
Harvey actually expects *every* shape to be resizable — if resizing is only meant for
group/note/service, that limitation must be obvious in the UI (e.g. the inspector or a tooltip
states it); the default expectation from a user is that any box can be resized. Prefer making
all non-note shapes resizable if that does not break the shape rendering.

## I6 — "saving…" never stops (autosave loop) — CONFIRMED

**Repro (measured):** one drag → **30 `PUT /api/boards/<id>` requests in 25 s**, the indicator
showing `saving…` almost continuously.

Root cause: the debounced-autosave effect depends on `curBoard` **and** `flushSave`, while
`flushSave` calls `setCurBoard(...)` with the new `updatedAt` on success. That state change
re-creates `flushSave` → the effect re-runs → marks `saving` again → schedules another save →
loop.

**Fix:** break the loop. Do not depend on the whole `curBoard` object; read what you need
through a ref (or depend only on `curBoard.id`). The save should fire only when `nodes`/`edges`
actually change, and the state machine should settle at `idle`.

**Also (Harvey's request — "saving should have a gap"),** make the indicator calm:
- Show `saving…` only after the user has paused (keep/adjust the debounce, ~800ms is fine) and
  do not re-show it for saves that are already pending.
- After a successful save show `saved` briefly, then go to **idle (empty)** — never leave
  `saving…` on screen while nothing is happening.

## I7 — Cursor should be a normal pointer at rest

`.react-flow.snap-on .react-flow__node { cursor: cell }` and `.react-flow.snap-on
.react-flow__pane { cursor: crosshair }` apply **all the time** when snap is on, so the canvas
shows a special cursor even when nothing is being dragged. Harvey: at rest the pointer should be
the normal cursor.

**Fix:** at rest the pane shows the normal arrow (default) and a node shows `grab`. Apply the
snap/precision cursor **only during an active drag** (`:active`), and return to normal when the
drag ends. Snap on/off should no longer permanently change the resting cursor.

---

## Rules

- Dark theme; reuse existing tokens/classes; English UI.
- Do NOT regress: boards persistence + autosave, undo/redo, copy/paste/duplicate, box-select,
  align/distribute, resize, snap toggle, alignment guides, search palette, icon picker, edge
  inspector + flow animation, context menus, edge reconnect, subflows, cycle prevention,
  auto-layout, proximity connect, tooltips, cheat sheet, import/export, empty state, tour,
  checklist.
- `npx tsc --noEmit` exit 0 · `npx vite build` exit 0.
- Verify in the browser on **port 5200**. For anything a synthetic event cannot drive (resize,
  drag), say so explicitly in the report and describe what you checked instead of claiming a
  pass.
- Restore the demo board ("Kafka rebalance") to a clean state and delete any board you create
  while testing.
