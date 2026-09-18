# PACKAGE-M2 — Settings roadmap (follow-up to PACKAGE-M)

**Status:** approved scope by Harvey 2026-09-14 (option (a): lock the roadmap now).
**Predecessor:** `PACKAGE-M-SPEC.md` (the Settings modal itself, 7 nav groups, in flight).
**Evidence base:** `/home/harvey/diagram-studio-research/settings-survey.md` (11 mature diagramming
& whiteboard tools, each claim sourced by URL).

This file is a ROADMAP, not an implementation spec. Each item below became a candidate because the
survey shows it is common in mature tools OR because it directly reduces support burden for a tool
that will be shared with other users.

---

## 1. Why M2 exists

PACKAGE-M ships the Settings **surface** (modal + nav + search) and moves the theme picker into it.
It renders only truthful, already-existing content and does NOT invent controls (§1.1 of the M spec).
M2 fills that surface with the settings real diagram tools actually ship.

### Cross-tool frequency (from the survey, §2) — the top of the list is what users expect

| Rank | Setting group | Tools exposing it |
|---|---|---|
| 1 | Theme / colour mode | 9 / 11 |
| 2 | Grid: show/hide + snap + grid size | 9 / 11 |
| 3 | Zoom / viewport behaviour (min/max, direction, fit-on-load) | 10 / 11 |
| 4 | Keyboard shortcuts (enable/rebind) | 6 / 11 |
| 5 | Export defaults & format | 6 / 11 |
| 6 | Interface language / locale | 6 / 11 |
| 7 | Input device mode: mouse vs trackpad | 6 / 11 |
| 8 | Accessibility (reduce motion, precise selection) | 4 / 11 |
| 9 | Snapping & alignment aids beyond the grid | 5 / 11 |
| 10 | Default styles for new elements | 5 / 11 |
| 11 | Autosave / persistence & file handling | 5 / 11 |

---

## 2. Decisions locked in M2

- **D3 — nav grows from 7 to 8 groups.** Add **Data & Storage** as its own group. Rationale: it is the
  only setting class where a mistake loses the user's work, and users look for it under a
  Data/Storage heading, not "Editor" (draw.io, Excalidraw, tldraw, Miro, Whimsical all ship the
  concept; Excalidraw explicitly warns users their drawings live in browser storage).
- **D4 — keep the nav search box.** The survey confirms draw.io is the ONLY one of the 11 surveyed
  tools with in-dialog settings search. Keeping ours + "room to grow" copy is a genuine differentiator
  and it is what makes an 8-group modal safe to grow further.
- **D5 — do NOT build a per-action key-rebinding editor.** 6/11 tools allow rebinding, but it is a
  heavy feature; M2 keeps the Keyboard pane read-only (shortcut reference) plus a single
  master enable/disable toggle.
- **D6 — Accessibility stays folded into the groups that own the concern** (reduce motion under
  Appearance, keyboard a11y under Keyboard) until it has enough items to justify its own group.

---

## 3. M2 backlog, by nav group

### Appearance
- Language / locale selector (6/11 — no home today; Excalidraw puts Theme + Language side by side).
- UI density / compact mode + interface scale (draw.io Compact UI; Figma Interface Scale).
- Canvas background colour (Excalidraw, Miro).
- Toggle visual extras: shadows, animations (draw.io; tldraw animationSpeed) — pairs with the
  existing reduce-motion.
- Reduce motion (a11y, 4/11) — already reachable in M as a stretch; formalise here.

### Canvas
- Show grid + snap-to-grid + **grid size** as one cluster (9/11).
- minZoom / maxZoom exposed as a preset (Tight / Default / Wide) — today hardcoded 0.2 / 2.5.
- Zoom direction (invert) — Whimsical, tldraw.
- Fit-on-load / fit-to-view-on-open.
- Snapping aids beyond the grid: snap to objects, snap to midpoints (Excalidraw).
- Minimap show/hide; background pattern dots/lines/none (Miro grid type).

### Connections
- Connect on click vs drag — React Flow `connectOnClick` default true.
- Default connector style: type (bezier/step/smoothstep/straight), colour, width, arrow marker
  (draw.io defaultEdgeStyle; React Flow `defaultEdgeOptions`).
- Connection mode strict vs loose; reconnectable radius (React Flow).

### Editor
- **Input device: Trackpad / Mouse** (6/11; Excalidraw, Miro, tldraw). High value here — this tool
  already had a Mac-trackpad bug (PACKAGE-J), so an explicit input-mode preference directly reduces
  support burden.
- Paste at cursor vs original location (tldraw; draw.io Paste at Mouse).
- Default styles for newly created elements (5/11; draw.io defaultVertexStyle/defaultEdgeStyle).
- Node drag / click thresholds; auto-pan on connect/drag/selection.
- Tool lock / one-time tools (Excalidraw Tool lock).

### Export
- Default export format (PNG / SVG / JSON).
- Export scale / high-resolution multiplier (today fixed 2×).
- Include/exclude grid, background, legend, metadata.
- PNG background: transparent vs canvas colour.

### Keyboard
- Master enable/disable keyboard shortcuts toggle (tldraw `areKeyboardShortcutsEnabled`).
- Per-action enable/disable for the React Flow key props (delete / selection / multi-select /
  zoom-activation / pan-activation) — NOT a full rebinding editor (D5).
- Show shortcuts inline next to each control where cheap (Excalidraw's approach).
- Remove the third copy of the shortcut list: extract ONE shared `SHORTCUTS` const consumed by
  README, the `?` cheat sheet and this pane.

### Data & Storage — NEW GROUP (D3)
- Autosave interval + enable/disable (draw.io Autosave Delay; Obsidian Excalidraw autosave timer).
- Where data lives: explain server boards vs localStorage keys, and the per-board JSON.
- Import / export the whole workspace (all boards).
- Clear / reset local data; reset tour + checklist flags.
- Default save file type.
- Version history (only if the backend grows it).

### About
- Version + build (already planned in M; keep the plain `const APP_VERSION` per M §8.7).
- Licence / attribution; our stance on React Flow attribution (`proOptions`).
- Links: docs, source repo, changelog, report a bug.
- **Reset all settings to defaults** (draw.io Reset; Excalidraw).
- Import / export settings — draw.io's "share config as URL" pattern is a strong fit for a shared tool.
- Data / privacy statement (Excalidraw-style: say plainly where drawings are stored).

---

## 4. Explicitly deferred (not M2)

- **Collaboration group** — show/hide collaborator cursors, presence, comments. Only when/if
  multiplayer ships. The identity half (display name, cursor colour) could ship early if cursors
  are ever added.
- **Performance / Advanced group** — `onlyRenderVisibleElements`, max shapes. Miro and Figma expose
  no performance knobs to end users; revisit only if large diagrams become a real use case.

---

## 5. Grounding + caveats (from the survey)

- Every item above traces to a tool's documented settings or preferences UI (URLs in
  `settings-survey.md` §1).
- NOT fully verified in the survey: Lucidchart's complete in-editor Preferences pane, a FigJam-only
  preferences pane, and Miro's full board-Preferences list (Cloudflare-gated). Those three rely on
  one retrievable official article each; no setting was invented to fill the gaps.
- Before building any single item, re-verify it against the tool's current docs — settings UIs move.
