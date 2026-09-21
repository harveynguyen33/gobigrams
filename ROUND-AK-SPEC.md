# ROUND AK — connection-line (edge) utilities: one consolidated pass

**Status:** approved by Harvey 2026-09-21 (all four decisions taken — see §1).
**Research:** `/home/harvey/diagram-studio-research/edge-utilities/` —
`SHARED-BRIEF.md` · `C1-drawio.md` (988 lines, 27 URLs) · `C2-excalidraw-tldraw.md` (1115 lines, pinned
SHAs) · `C3-reactflow-and-others.md` (882 lines, 36 URLs) · `SYNTHESIS.md` (the consolidated record).
**Gates that must not regress:** `tsc=0` · `vite build=0` · hex literals in `src/styles.css` ≤ **160**
(currently **142**) · **all 28 harnesses in `checks/*.mjs` green** · no new npm dependency.

**Working dir:** `/home/harvey/projects/tech-goblin/lab/diagram-studio`
**Dev server:** `http://192.168.33.200:5200/` (Harvey is on a Mac — never say `localhost` to him).

---

## 0. WHY THIS ROUND EXISTS

Harvey: *"Tôi muốn giải quyết line connection utilities 1 lần."* Eleven asks, all on the edge (connection
line) only. Three independent research clusters were run first; every claim below with an URL is in the
research reports, not invented here.

**Files this round touches (predicted):**
`src/App.tsx` · `src/GoblinEdge.tsx` · `src/styles.css` · `src/inspector.ts` · `src/presets.ts`
· `checks/*` (re-anchor only).

---

## 1. THE FOUR DECISIONS (settled — do not re-open)

| ID | Decision | Chosen |
|---|---|---|
| **D1** | Label drag model | **Free 2-D** (the strict superset: satisfies both the "along the line" and "off the line" camps) |
| **D2** | Label background | **3 stored states: `None` / `Surface` / `Outline`** — `None` is a real value, not an absence |
| **D3** | The two ends are named | **`Start` / `End`** (inside the section already called **Markers**) |
| **A** | Section gating | **Key the edge sections off the EDGE, not the board preset** (see §2) |

---

## 2. ITEM A — the panel must stop changing shape per board (answers Harvey's own question)

Harvey asked *"tại sao sidebar của line lại khác nhau ở mỗi type?"* — measured cause, two preset-keyed
gates:

| Gate | Location | Effect |
|---|---|---|
| `preset.edges.labelPresets?.length` | `src/App.tsx:4948` | intent-label buttons on **flowchart** + **C4** boards only |
| `target.presetId === 'erd'` | `src/inspector.ts:222` | the **Cardinality** section on **ERD** boards only |

`preset.id` is ONE string on the BOARD document (`App.tsx:777` reads it; `:1316`/`:1336` write it). A board
holding a flowchart template AND a C4 template — which Harvey says he will do — makes that board-level
preset a lie about half its edges.

**The project already solved this exact problem for NODES.** `src/inspector.ts:94-101` (ROUND AG2) is the
precedent and it must be followed, not re-argued: `hasSub` keys on the **shape**, because *"even with the
preset it would be wrong, because `process` … are ALSO offered by the Mixed ('custom') palette"*.

**REQUIRED CHANGES:**
1. **`labelPresets` is DELETED** (Harvey's ask #5) — so the first gate disappears outright. Remove the
   field from `src/presets.ts` (`EdgeDefaults.labelPresets`), its two data sites (`C4_EDGES`, `FLOWCHART_EDGES`)
   and their `C4_LABELS` array, and the whole JSX block at `App.tsx:4948-4966`. `technField` and the
   `technology` input **STAY** (they are a different field).
2. **`cardinality` must be gated on the EDGE, not the preset.** Replace `target.presetId === 'erd'` in
   `src/inspector.ts:222` with a condition read from the **selected edge's own data**: the section appears
   when the edge carries a crow's-foot marker on either end. `isCrowFoot()` already exists in `App.tsx`
   (used at `:5156`/`:5170`) — the predicate belongs in `src/inspector.ts` beside `hasSub`/`hasBody`, and
   `InspectorTarget`'s `presetId` field should be REMOVED if it has no other consumer.
   **Consequence to accept deliberately:** a plain C4 board whose edge has no crow's-foot loses the
   Cardinality section (correct — it has no cardinality to express), and an ERD-styled edge on a
   non-ERD board GAINS it (the fix Harvey's question asks for).

---

## 3. PASS 1 — the bug, the removals, the renames, the control types

Mechanical and low-risk. **Land and verify this before Pass 2.**

### AK-1. Fix bug #7 — selection must never restroke the edge body

**Root cause, measured twice (orchestrator + C2):** two live `!important` rules override the inline stroke
that `updateEdge({data:{strokeKey}})` writes, so a selected/hovered edge lies about its colour while only
the `<marker>` (a separate element, whose `<defs>` id encodes its own colour) follows:

```
src/styles.css:1217   .react-flow__edge.selected .react-flow__edge-path { stroke: var(--sel) !important; }
src/styles.css:2654   .ds-electric .react-flow__edge-path { stroke: var(--sel) !important; stroke-width: 4 !important; … }
```

**Correction to the research (the orchestrator verified this, C2 was wrong):** `styles.css:1222`
(`.react-flow__edge.selected .react-flow__edge-text { fill: var(--sel) }`) is **NOT** a third instance —
it targets React Flow's SVG `edge-text`, which this app **never renders** (my labels are DOM `<div>`s with
class `.edge-label` through `EdgeLabelRenderer`). It is a **dead rule**. Do not "fix" it as if it were a
bug; report it, and delete it only if you can show nothing else references it.

**REQUIRED:** replace the restroke with a **selection overlay**, which is what every surveyed tool does
(draw.io: a separate dashed `#00a8ff` shape on the overlay pane; Excalidraw and tldraw: a separate
indicator pass; Sirius Web and Aleph: a separate path). Selection must be *additive*, never a recolour.

- Preferred implementation: `GoblinEdge` renders a **second `<path>`** (the indicator) when `selected`,
  below/behind the authored path, stroked with `var(--sel)` and a dash pattern — **using existing tokens,
  no new hex.**
- The authored body keeps its own colour at all times, selected or not.
- **Also handle `.ds-electric`** (the K1 hover choreography) the same way: hovering must not repaint the
  body either. Keep the glow/dash *effect* if it is wanted, but not by overwriting `stroke`.
- **Touch rule:** whatever signals selection must not depend on `:hover`.

### AK-2. Delete the sidebar hint (ask #3)
`src/App.tsx:5196-5199` — the `Double-click the label on the canvas to rename it …` hint block.
Evidence it should go: draw.io's live edge Format panel contains **zero sentence-length strings**.
Replaced by tooltips on the controls themselves (`.edge-label`'s own `title` already says it).

### AK-3. Delete "Label position" (ask #6)
`src/App.tsx:4977-4985` (the field + `ToggleRow` + `OFFSET_OPTS` at `:3335-3339`).
draw.io ships a 9-way `Position` dropdown that its renderer **ignores for edges** — its own manual
concedes it anchors to the diamond, not the connector. Shipping a preset list beside a drag is the
confusion to avoid. **`ArtLabelPos` becomes unused** — remove its import if nothing else takes it.
Centre is reachable by dragging near the middle (AK-8's snap).

### AK-4. Delete the orphan `animated` field (ask #10a)
`src/App.tsx:5183-5191` — a `field` sitting OUTSIDE every section (no `secBody`), directly under Flow
Animation, labelled `animated (dash on the line)`. It renders the **same marching-dash effect** as
`flow: 'dash'` (ours: `styles.css:2356` `stroke-dasharray: 2 10`; React Flow's: `dist/style.css:162`
`stroke-dasharray: 5`). Two controls, one effect. **Delete the field; keep the `flow: 'dash'` option.**
Any edge that already set `animated: true` must not lose its look — map it to `flow: 'dash'` on read, or
confirm nothing persisted it (check `boards/` and the type).

### AK-5. Rename the two ends and unify the vocabulary (ask #9, decision D3)
- **Markers section:** `arrow head` → **`start`**; `head start` → **`end`**.
  *(Order matters: today's "arrow head" is wired to `markerEnd` and today's "head start" to `markerStart`;
  the labels are what is wrong, not the wiring. Keep `markerStart`/`markerEnd` as the storage keys.)*
- **Cardinality section:** `source end` / `target end` → the **same two words** (`start` / `end`), so the
  panel stops using three vocabularies for two ends.
- **`markerFor(v, eStroke)` keeps working unchanged** — this is a string change only.
- Reason for `Start`/`End` over Harvey's suggested "head start/head end": no surveyed tool uses "head";
  tldraw uses `Start`/`End` and 3 of 4 other tools imply that pair; the section title "Markers" already
  supplies the context, so the row labels can be short.

### AK-6. Convert the style controls to one button row each, width-balanced (ask #8)
**`stroke width`, `line style`, `curvature` each become their own full-width row** (today width + line
style share a `field-row`, and curvature is a lone `IconPickerRow` trigger + popover).
- Use the existing control kit — `src/InspectorPickers.tsx` (`ToggleRow` / `SegRow` / `IconPickerRow`).
  **Do NOT invent a control.**
- **The threshold is evidence-backed, cite it in a comment:** tldraw makes it explicit in source —
  `items.length > 4 ? Grid : Row` (`StylePanelButtonPicker.tsx#L152`) — and Excalidraw behaves
  identically (flat rows for 3–4, a popover for its 9-marker set). Our sets are **3 (width), 3 (dash),
  4 (curvature)** → all correctly flat rows. **The marker set is 3 too** (see AK-7).
- **Balanced widths:** each button in a row must take an equal share (`flex: 1 1 0; min-width: 0` — the
  same fix ROUND AA applied to `.insp-seg`), **not** size to its own text. `checks/round-aa-…` has the
  existing pattern to follow; its `NATURAL` table (which asserts a row's longest label fits its natural
  count) is the guard to extend, not duplicate.
- **Report honestly in the code comment:** "mature tools use button rows" is **true for markers**, and
  **false** for line style (draw.io uses `<select>` there). The defensible reason for flat rows here is
  first-time-user discoverability for a will-be-shared tool — say that, do not claim draw.io as support.

### AK-7. Markers as two button rows (ask #9 controls)
`start` and `end` each become a **flat 3-option row** (`none` / closed arrow / open arrow) instead of an
`IconPickerRow` trigger. 3 options ≤ 4, so the threshold rule supports it. `MARKER_OPTS` and
`MARKER_OPTS_START` already exist as `PickerOption[]` tables (`App.tsx:3314-3324`) — they are reusable as
row options; `ArtArrow` already supplies the glyphs (including the `flip` variant).

### AK-8. Section gating (Item A) + harness re-anchoring
- Apply §2's two changes.
- **`checks/package-p-inspector.mjs` references every label being removed/renamed** (measured: 16 hits —
  `label position` at `:199`, `arrow head` at `:203`, `head start` at `:204`, plus the option tables at
  `:243-245`). Per the project's standing rule — **a check that silently disappears is worse than one that
  changes verdict with a recorded reason** — these assertions must be **RE-ANCHORED, not deleted**: each
  rewritten assertion must print the OLD claim beside the NEW one, and must be shown **RED on the
  pre-change tree**.
- `checks/round-aa-align-marquee-palette.mjs:331` asserts the `offset` row
  (`{name:'offset', labels:['center','start','end'], n:3}`) — that row is being deleted, so its entry
  must be removed from the `NATURAL` table **with a comment naming what replaced it**.

### AK-9. Harness for this pass
Add `checks/round-ak-edge-panel.mjs` asserting, by reading the shipped source as text plus (where
possible) executing shipped pure functions:
- the two restroke rules are gone from `src/styles.css` and a selection overlay path exists instead;
- the hint string, `intent label`, `label position`, and `animated (dash on the line)` are absent from
  `App.tsx`;
- `labelPresets`/`C4_LABELS` are absent from `src/presets.ts`;
- the cardinality gate reads the EDGE, not `presetId`;
- the four row-controls exist with equal-width CSS (`flex: 1 1 0`);
- the marker rows are labelled `start`/`end`.
**Negative control required:** at least one assertion must be demonstrated RED on the pre-change tree.

### PASS 1 ACCEPTANCE
`tsc=0` · `build=0` · hex ≤ 160 · all harnesses green (28 existing + the new one) · the bug reproduced
FIXED live (select a coloured edge → change its colour → **the body changes immediately, while selected**)
· no new npm dependency.

---

## 4. PASS 2 — the label (the meat; do not start before Pass 1 is verified)

### AK-10. Free 2-D label drag (ask #1, decision D1) — and it dissolves the collision
**The collision is structural, not stylistic:** `handleAt = {x: labelX, y: labelY}` (`GoblinEdge.tsx:299`)
**IS** the label's anchor (`:383-385`). They are the same point by construction.

**The fix, from the strongest reference implementation found (Eclipse Sirius Web — MIT, read line by
line):** make **the label itself** the drag target. The drag target and the text become one object, so
nothing can collide. Do **NOT** add a separate label handle.

- **Storage:** `data.labelOffset?: {x: number; y: number}` (relative px, applied additively at
  `GoblinEdge.tsx:383-385`) **plus** `data.labelPinned?: boolean` (Sirius Web's own `movedByUser` flag).
  While `labelPinned` is falsy the label auto-centres exactly as today; once true, `labelOffset` wins.
- **Zero dependencies.** Reuse the EXISTING gesture code: `onBendDown` (`GoblinEdge.tsx:301-386`) already
  does `setPointerCapture` + `document`-level `pointermove`/`pointerup` + client→flow conversion via the
  pane rect. **Factor that into ONE shared hook** so a single pointerdown can never start both gestures.
- **History:** exactly **ONE** undo entry per gesture, pushed at the START — the same convention
  `onBend` already documents. Pushing per frame buries the history (this project has already paid for
  that mistake with the resize latch, `src/resizeHistory.ts`).
- **Click-vs-drag guard:** ignore a gesture whose total delta is `{0,0}` (Sirius Web's own guard) — an
  ordinary click must still select, and a double-click must still edit (AK-13).
- **Touch-safe:** pointer events only; give the label a larger invisible `::after` tap ring (the
  technique `.edge-bend-handle` already uses). **No hover state may be required for any of this.**

### AK-11. Hit priority (the behavioural half of #1)
When the bend handle and the label overlap, resolve by **documented priority, not displacement** — what
Excalidraw (an explicit source comment) and tldraw (routes the label before translating) both do.
Requirements:
- the bend handle and the label must never both start from one pointerdown (AK-10's shared hook);
- **a label drag must never rebind the edge** (Excalidraw suppresses endpoint rebinding via
  `hitBoundText` in `actionFinalize`);
- the label's own hit region must be **opted in explicitly**, not part of the edge's general hitbox
  (tldraw's `isLabel` geometry + `isOverArrowLabel`).

### AK-12. Label background: 3 stored states (ask #2, decision D2)
`data.labelBg?: 'none' | 'surface' | 'outline'`, rendered as a **class on `.edge-label`**, not an inline
`fill`. **Note the trap:** React Flow's own `labelBgStyle` is an SVG-`<rect>` API and our label is a DOM
`<div>` through `EdgeLabelRenderer` — so the mechanism is CSS `background`, and copying RF's prop verbatim
would be wrong.
- `none` → `background: transparent`
- `surface` → `background: var(--surface)` (today's look; the **default** so nothing changes on load)
- `outline` → `background: transparent` + a `text-shadow`/`border` in the surface colour (tldraw's
  technique: a text outline in the canvas colour, so the line is hidden behind the glyphs without a box)
- Control: a **3-option flat row** in the `label` section (uses `.swatch3`/`SegRow` conventions already in
  the panel). **`None` is a genuine stored value, not the absence of one.**
- **`styles.css:1290` `.edge-label:hover` must be deleted or neutralised** — it is a hover-only state and
  the tool must work on touch.
- **No new hex.** `transparent`, `var(--surface)`, `var(--border-strong)` all exist. For a partial
  transparency use `color-mix(in srgb, var(--surface) 88%, transparent)` (draw.io expresses the same
  thing as `#ffffffe0`).

### AK-13. Double-click anywhere on the line creates a label (ask #4)
Today only the label element has `onDoubleClick` (`GoblinEdge.tsx:557`), and the pane's double-click
deliberately ignores any target inside `.react-flow__edge` (`App.tsx:4778`), so double-clicking an
unlabelled line does nothing.
**Required:** a double-click **on the edge path** starts label editing **at that point**:
- hit-test the double-click position against the edge's own resolved path;
- if the click was inside an EXISTING label's box, edit that label (draw.io excludes exactly this case
  before creating a new one);
- otherwise create the label **at the clicked position** and commit at the default when left empty;
- **works in review mode as "no-op"**, matching the existing read-only rules;
- double-tap is the documented touch equivalent — no hover needed.
Evidence: draw.io `Graph.insertTextForEvent` + its manual ("Double click on the connector at the position
you want to add a text label"); tldraw `Idle.onDoubleClick → startEditingShape`. Excalidraw deliberately
does NOT (a 30px centre gate) — noted, not followed, because it contradicts Harvey's ask.

### AK-14. Reset, snap and clamp (the three cheap safety rails)
1. **`Reset label position`** — a plain **sidebar button** in the `label` section (NOT a right-click, NOT
   a double-tap: those are desktop idioms, and the double-tap already means "edit label" after AK-13).
   Clears `labelOffset` + `labelPinned`. One history step. Precedent: Lucidchart ("Reset line"),
   Lucidspark, and Miro — which had to add a **separate touch variant**, which is the tell that the
   desktop idiom does not travel.
2. **Snap-back-to-centre** — while dragging, once the label is within `10` **screen px** of the default
   centre point, snap to exactly centre (tldraw's `labelCenterSnapDistance`, source-read). Scale the
   threshold by zoom. No reset button is then strictly needed, but keep AK-14.1 anyway.
3. **Clamp to a usable range** so a label can never sit under an arrowhead or run off the end
   (tldraw's `getArrowLabelRange` + `LABEL_TO_ARROW_PADDING`). Pure function of the resolved path +
   marker presence — **zero new fields**.

### AK-15. `Reverse line direction` (ask #11 — cheap, high value)
draw.io ships it in Arrange: ends and labels swap, the path does not change. One button: swap
`source`/`target` in `updateEdge`, and **mirror the label's offset (`o → 1 - o`)** so "your labels swap with
the ends" stays true.

### PASS 2 ACCEPTANCE
Live-verified with a **real mouse drag through CDP** where possible (the project has done this before for
the resize gesture): a label dragged off the line stays where it was put after a reload; the three
background states persist; a double-click on an **empty** line creates an editable label at that point;
a double-click on an existing label edits it; `Reset label position` restores centre in **one** undo step;
the bend handle and the label never both respond to one pointerdown; all of it works with the pointer
**type** set to touch (no hover).

---

## 5. PASS 3 — flow animation, de-duplicated (ask #10b)

### AK-16. Two real duplications, both to remove
- **(a) `dash` vs `animated`** — solved in Pass 1 (AK-4).
- **(b) `event` vs `icon`+`mail`** — `flow: 'event'` draws an **envelope**
  (`GoblinEdge.tsx:459-467`); `flow: 'icon'` with `flowIcon: 'mail'` draws a **chip carrying a letter
  glyph** (`:468-479`). Two ways to say "a letter travels the line". **Fold `event` into `icon`** with
  `mail` as its glyph, unless the coder can show a user-visible difference worth keeping — if so, say so
  and leave both, with a comment naming the difference.

### AK-17. The single axis
`flow` becomes ONE named choice with **non-overlapping** meanings, e.g. `None / Dots / Dash / Pulse /
Icon`, plus `count` + `speed` + `icon` as **decorations on the payload** (they are already rendered inside
`.ds-animated-payload`, `GoblinEdge.tsx:517`) rather than as a second animation mode.

### AK-18. Honest limit — record it in the code comment
**No surveyed mature tool ships a connector-wide marching-ants animation.** Miro, Lucidchart, Whimsical
and FigJam: all **zero**; tldraw's only related control is a *global* reduce-motion user preference;
Excalidraw has no element-level animation at all. So the research can confirm **which options duplicate**
and **cannot** justify what to keep — that is a product call, and the code comment must say so rather than
citing false precedent.
**Also required:** the existing `diagram-studio:animate` gate (Settings → Canvas, "Reduce motion") must
still switch the edge animation off. Do not merge the two axes.

---

## 6. DEFERRED DELIBERATELY (do not build this round)
- **Line jumps over crossings.** Miro (straight/orthogonal only) and Lucidchart ship it, but React Flow
  has **no primitive**: it needs a real intersection-detection pass over the path geometry and every
  other path, recomputed on every node move. Recorded as "exists in mature tools, expensive here".
- **Arrowhead SIZE as a control.** Miro deliberately derives it from stroke width (also React Flow's
  `markerUnits: 'strokeWidth'` default), so adding a size control would diverge from the largest tool
  surveyed. Lucidspark's "Auto" toggle is the compromise if it is ever wanted.
- **Splitting `shape` into `routing` + `corners`.** A cleaner model (draw.io separates them), but it
  touches persisted diagrams; not worth the migration now.
- **Moving ERD cardinality into the same picker as the other markers.** Excalidraw does this; our separate
  section may be a deliberate simplification. Do not change it in this round.

---

## 7. HONEST LIMITS OF THE INPUT RESEARCH (carry these, do not launder them)
- draw.io's label-diamond **drag was never observed** — its CDP synthetic drag timed out. The free-drag
  claim rests on draw.io's manual + primary source.
- **Miro's label background/transparency is `[UNVERIFIED]` on the article's silence**; likewise
  Lucidchart's "TEXT PILL" fill. `help.miro.com` **and** `help.lucid.co` are both Cloudflare-gated
  (reproduced: 403 + a 60s interstitial) — assume any other URL on those hosts is gated until fetched.
- The **relative-vs-absolute** label offset shape is a design judgement (Sirius Web and Aleph store
  absolute and re-derive); relative was chosen because our anchor is already derived.
- Line-jump cost estimate is **LOW-MEDIUM confidence**.

---

## 8. CONVENTIONS THAT MUST NOT BE VIOLATED (this project's own rules)
1. **Never edit Harvey's boards in `boards/`.** They are his working canvas, gitignored. Probe on a
   throwaway board (`POST /api/boards` → seed → `DELETE /api/boards/<id>`) and prove the listing is
   otherwise unchanged. **Unmount the tab (`goto_url('about:blank')`) before any restore, or autosave
   undoes you.** He had the app open during this round's recon.
2. **An assertion that changes verdict is RE-ANCHORED, never deleted** — and any inverted assertion must
   be shown **RED on the pre-change tree** before the fix.
3. **Fix stale facts in place; never delete them.** A superseded claim gets a dated parenthetical.
4. **No new hard-coded hex** in `src/styles.css` (ceiling 160, currently 142).
5. **No new npm dependency.**
6. **Harvey verifies last, but the orchestrator self-verifies first** — tsc + build + live browser
   evidence, measured, never a self-report.
