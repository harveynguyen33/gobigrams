# Package H — Onboarding (guided tour + getting-started checklist)

Decision (Harvey, 2026-09-13): **1c + 2a/c + 3a**
- 1c: interactive guided tour **and** a getting-started checklist
- 2a: auto-run once on first visit (persisted) with a Skip button
- 2c: also launchable on demand via a "Take a tour" button
- 3a: teach on a **sample diagram** (a small example is seeded), the tour points at it

Goal: a first-time user (someone Harvey shares the tool with) understands the tool in ~60 s
without reading the README.

---

## H1 — Guided tour

A modal-ish overlay tour over the real UI:

- **Dim layer**: darkens the whole app except a highlighted "spotlight" around the current
  target element (`position: fixed`, rgba(0,0,0,.55), the target raised above it with a
  `box-shadow: 0 0 0 9999px rgba(0,0,0,.55)` trick or a 4-panel mask).
- **Tooltip card**: anchored near the target (auto-flip if it would overflow the viewport),
  showing: step counter (`3 / 8`), title, one or two sentences of body text, and buttons
  **Back · Next · Skip tour** (last step: **Done**). Style with existing tokens
  (--surface bg, --border, --fg, --dim, --acc for the primary button, --sel for the ring).
- **Keyboard**: `→`/`Enter` next, `←` back, `Esc` skip.
- **Steps** (target selectors must be real — check the DOM):
  1. Welcome — centred, no target: what this tool is ("Draw your system as boxes and arrows. Everything autosaves.").
  2. **Board menu** (`.boards-btn`): "Everything lives in a *board*. Create as many as you want; rename, duplicate or delete from here."
  3. **Shape palette** (`.palette`): "Drag any shape onto the canvas, or double-click it to drop it in the middle. Database, Queue, Service… each shape has an architectural meaning."
  4. **Canvas** (`.canvas-wrap`): "Drop shapes here. Double-click empty space to search and insert a node."
  5. **Toolbar** (`.toolbar`): "Undo, snap, alignment guides, auto-layout, and **Export** (PNG / SVG / JSON)."
  6. **Inspector** (`.panel.right`): "Select a node to edit its text, icon and colour. Select an arrow to edit its label, style and flow animation."
  7. **Edge + flow** (target the first `.react-flow__edge`): "Arrows show the flow. Give them a label, or animate them (dots / dash / pulse / icon) to show data moving."
  8. **Help** (`.help-btn`): "Press **?** any time for the shortcut list — and to replay this tour."
- If a target element is missing (e.g. the edge step when the board has no edges), **skip that
  step automatically** rather than showing a mis-anchored card.

## H2 — Getting-started checklist

A compact floating panel (bottom-left above the zoom controls, or top-right under the toolbar —
pick whichever does not collide) listing tasks; ticks itself as the user actually does them:

1. Create a node  (a node exists that the user added — i.e. node count grew, or any of the seeded
   nodes was edited/duplicated; simplest reliable signal: the user has added at least one node)
2. Connect two nodes  (an edge exists that the user created — or any edge exists after first
   interaction; use "user has created an edge" via the existing onConnect handler)
3. Rename an arrow  (an edge label was changed)
4. Move something  (a node drag ended)
5. Export your diagram  (any export action ran)
6. Create your own board  (a second board exists)

- Panel header: "Getting started" + `n / 6` + a small **×** to dismiss permanently
  (localStorage flag `diagram-studio:checklist-dismissed`).
- All 6 done → auto-hide with a short "Nice — you know the basics." toast.
- Collapsible to a small pill (`Getting started · 3/6`) so it never blocks work.
- Style with existing tokens; small type (11-12px), mono for the counter.

## H3 — Triggering

- **First visit**: auto-start the tour once. Persist `diagram-studio:tour-seen`. The checklist
  shows for every user until dismissed/completed (that is the point of 1c).
- **On demand**: add a **"Take a tour"** item to the `?` help popover, and also a
  **"Replay tour"** affordance inside the tour card flow (i.e. starting it again is possible).
- A fresh board seeds a **small sample diagram** so the tour has something to point at:
  keep/refresh the existing seeded initialNodes so they read as a tiny pipeline
  (External → Queue → Service) with one labelled edge. Generic names only.

## Rules

- Dark theme; reuse existing tokens/classes; English UI; do NOT break any existing feature
  (undo, box-select, align, snap, guides, context menus, boards, inspector, export, tooltips).
- All new state that should persist uses localStorage with a `diagram-studio:` prefix.
- `npx tsc --noEmit` exit 0 · `npx vite build` exit 0.
- Self-verify in the browser (port 5200): screenshot the tour at several steps, the spotlight
  actually dimming the rest, the checklist ticking an item as you perform the action, dismiss +
  persistence across reload, and "Take a tour" from the help popover.
