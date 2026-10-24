# SYNTHESIS — Connection-line (edge) utilities, Diagram Studio

Date: 2026-09-21 · Author: orchestrator (consolidating C1 + C2 + C3)
Inputs: `C1-drawio.md` (988 lines, 27 URLs) · `C2-excalidraw-tldraw.md` (1115 lines, 9 URLs, pinned SHAs)
· `C3-reactflow-and-others.md` (882 lines, 36 URLs)
Status: **awaiting Harvey's decisions on D1–D3 and the three architectural items.**

---

## 0. THE HEADLINE: the panel is keyed on the BOARD, and that is the bug

Harvey asked: *"tại sao sidebar của line lại khác nhau ở mỗi type?"* — and he is right that it
should not be. Measured cause, two preset-keyed gates, both in the edge branch:

| Gate | File | What it does |
|---|---|---|
| `preset.edges.labelPresets?.length` | `App.tsx:4948` | shows the intent-label buttons on **flowchart** + **C4** boards only |
| `target.presetId === 'erd'` | `inspector.ts:222` | adds the **Cardinality** section on **ERD** boards only |

Both read `preset.id`, and `preset.id` is **one string stored on the BOARD document**
(`App.tsx:777` `getPreset(presetId)`, written at `:1316`/`:1336`). So the sidebar changes shape because
the *board* claims to be one family.

**That model does not survive Harvey's own stated intent.** He said (2026-09-21): *"với tôi board không
phân định theo labelPresets, chỉ có add template vào board thôi. Sau này có khi tôi có thể add cả 2
template both flowchart và C4."* The moment a board holds a flowchart template **and** a C4 template, the
board-level preset is a lie about at least half its edges.

**The project has ALREADY solved this exact problem once, for nodes.** `src/inspector.ts:94-101` (ROUND
AG2) documents why `hasSub` keys on the **shape** and not the active preset: *"even with the preset it
would be wrong, because `process` and the rest of the flowchart vocabulary are ALSO offered by the Mixed
('custom') palette, so a board on `custom` would keep the field the user asked to remove. The shape is
the only key that answers the question for every palette."*

**The edge sections never got that treatment.** They are the last preset-keyed rules in the panel.
→ **Recommendation A: key BOTH edge gates off the selected EDGE's own data, not the board preset.**
This is not a new idea to the codebase; it is the codebase's own established rule, applied to the one
place it was missed.

Consequences of the fix:
- **Intent label (#5):** deleted outright (Harvey's decision) — so this gate disappears entirely.
- **Cardinality:** its gate must become a property of the **edge** (does this edge carry crow's-foot
  markers?) rather than of the board. Otherwise a C4 board with one ERD-style edge can never set it, and
  an ERD board's non-ERD edges keep offering it. **This is a real, user-visible improvement, and it is
  the answer to Harvey's question.**

---

## 1. HARVEY'S 11 ASKS — verdict per ask, with the evidence

| # | Ask | Verdict | Evidence (strongest only) |
|---|---|---|---|
| 1 | Drag the label anywhere; the handle collides with it today | **DO IT — but see D1** for along-line vs free 2-D | Collision is structural, not style: `handleAt = {x: labelX, y: labelY}` (`GoblinEdge.tsx:299`) **is** the label's anchor (`:383-385`). Fix precedent: Sirius Web drags the **label itself** (MIT source, read line-by-line) — the drag target and the text become one object, so nothing can collide. |
| 2 | Label background adjustable, incl. **transparent** | **DO IT** | draw.io's **default is already `rgba(0,0,0,0)`** — transparent is the baseline, not a special case (C1, live-measured). Our `background: var(--surface)` is the departure. See D2. |
| 3 | Delete the sidebar hint | **DO IT** | draw.io's live edge panel contains **zero sentence-length strings** — only control labels (C1, measured). Cost: a deletion. |
| 4 | Double-click anywhere on a line creates a label | **DO IT** | draw.io ships it, documented twice, and `Graph.insertTextForEvent` **creates the label at the double-click point** while excluding the case where the click was inside an existing label's box. tldraw does exactly this too. Excalidraw deliberately does not (30px centre gate) — noted, not followed. Double-tap is the documented touch equivalent. |
| 5 | Remove "Intent label" | **DO IT — and it deletes a real preset gate** (see §0) | Only 2 presets carry it: flowchart (8 buttons) + C4 (13 long noun phrases). |
| 6 | Remove "Label position" | **DO IT**, replaced by the drag | draw.io ships a 9-way `Position` dropdown that **the renderer ignores for edges** — draw.io's own manual concedes it anchors to the diamond, not the connector. Shipping both a preset list and a drag is exactly the confusion to avoid. |
| 7 | Selected edge ignores the new colour | **CONFIRMED BUG — root cause in our own CSS** | `styles.css:1217` `stroke: var(--sel) !important` overrides the inline stroke. **C2 found there are THREE such rules, not one**: `:1217` (selected), `:2655-2656` (the hover "electric edge" — same defect on hover), `:1221` (the selected label's text). **No mature tool restrokes a selected element** — Excalidraw, tldraw, draw.io all draw selection as a **separate overlay**. This is the single highest-confidence fix in the whole pass. |
| 8 | Stroke width / Line style / Curvature → button rows, 1 per row, balanced | **DO IT, on discoverability — not on "draw.io does it"** | **Counter-evidence, stated honestly:** draw.io uses `<select>` dropdowns for Line style and Line jumps. The defensible argument is first-time-user discoverability (shared-tool constraint). **Two independent tools agree on the threshold**: tldraw makes it explicit in code — `items.length > 4 ? Grid : Row` — and Excalidraw behaves identically (rows for 3–4, popover for 9). Our sets are **3, 3, 4** → all correctly button rows. |
| 9 | Rename + button rows for the two ends | **DO IT, but the NAME needs a decision (D3)** | "head start/head end" appears in **NO** surveyed tool. draw.io's shipped string is verbatim **`Line Start` / `Line End`**; tldraw uses **`Start`/`End`** in a section titled "Arrows". **Our panel currently uses three vocabularies for the same two ends** ("arrow head"/"head start" in Markers, "source end"/"target end" in Cardinality) — Harvey approved unifying them. |
| 10 | Flow Animation: de-duplicate, avoid confusion | **DO IT — two real duplications found** | (a) `flow:'dash'` and the orphan `animated` field render the **same** marching-dash effect (ours at `styles.css:2356`, RF's at `@xyflow/react/dist/style.css:162`). (b) `event` (an envelope) vs `icon`+`mail` (a chip carrying a letter glyph) are two ways to say "a letter travels the line". **Honest limit: no surveyed tool ships a connector-wide marching-ants animation at all** (Miro, Lucidchart, Whimsical, FigJam = zero), so the *content* of this axis is a product call, not an evidenceable fact. |
| 11 | Propose missing utilities | **4 proposed, 1 recommended to defer** | See §3. |

---

## 2. THE THREE DECISIONS HARVEY MUST MAKE (evidence genuinely conflicts)

### D1 — Does the label drag **along the line**, or **freely in 2-D**?
Harvey's wording (*"điều chỉnh được text trên line xung quanh như tôi muốn"*) reads as free 2-D. The
evidence is split 3–4, so this cannot be decided by precedent:

- **Along the line only:** Miro (*"Move the text along the line by dragging it"*), FigJam (*"anywhere
  along the connector's path"*), Whimsical.
- **Free, including off the line:** **Lucidchart** (*"including directly above or below it"*),
  Lucidspark, **Sirius Web** (arbitrary `{x,y}`), Aleph (and the line *bends toward* the label).

**Recommendation: free 2-D (the strict superset)** — it satisfies both camps, it is what Harvey asked
for, and Sirius Web is a complete MIT reference implementation to copy. Cost: `data.labelOffset: {x,y}`
+ `data.labelPinned: boolean` (Sirius Web's own `movedByUser` flag), **zero dependencies** — our
`.edge-bend-handle` already has the exact pointerdown/capture pattern to reuse.

### D2 — What is the label background's **default**?
- draw.io: **transparent** (measured `rgba(0,0,0,0)` as the baseline).
- React Flow: a box (`labelShowBg = true`).
- Excalidraw: never a box — it **erases the line** under the text.
- tldraw: no box at all — a zoom-compensated **text-shadow outline** in the canvas colour.
- Ours today: `background: var(--surface)`.
- **FigJam is the outlier to NOT copy:** its text background is forced to match the connector's colour
  and *cannot* differ — the opposite of ask #2.

**Recommendation: a 3-state control — `None` / `Surface` (fill) / `Outline`** where "None" is a genuine
**stored** value. tldraw gives precedent for `Outline`; draw.io gives precedent for `None`-as-default.
No new hex: `transparent` keyword + existing `--surface`/`--border-strong`.

### D3 — Name the two ends what?
No surveyed tool says "head". Options with actual evidence:
- **`Line Start` / `Line End`** — draw.io's shipped UI string, verbatim, live-confirmed.
- **`Start` / `End`** — tldraw, in a section titled "Arrows"; 3 of 4 other tools imply this pair.

**Recommendation: `Start` / `End`** (shorter, fits one balanced button row, and the section is already
named "Markers" so the context is carried by the section title, not the label).

---

## 3. THE EXTRA UTILITIES (ask #11) — proposed, prioritised

| Priority | Utility | Evidence | Cost | Verdict |
|---|---|---|---|---|
| **SHIP** | **Selection = overlay, never a restroke** (fixes #7 three times over) | Unanimous across 6 tools | **zero fields** — delete 3 CSS rules, add 1 halo path | Not optional; it is the bug fix |
| **SHIP** | **"Reset label position" sidebar button** | Lucidchart + Lucidspark + Miro all ship a reset; Miro had to add a *separate* touch variant | zero fields (clears the offset) | The thing that makes a free drag safe to ship |
| **SHIP** | **Snap-back-to-centre on the label drag** | tldraw, `labelCenterSnapDistance: 10` screen px (source-read) | zero fields | Replaces the deleted "Label position" without losing "put it back" |
| **SHIP** | **Clamp the label so it can never sit under an arrowhead** | tldraw `getArrowLabelRange` + `LABEL_TO_ARROW_PADDING` | zero fields, pure function | Cheap, prevents an obvious defect |
| **SHIP** | **Hit priority: the bend handle wins where they overlap; a label drag never rebinds the edge** | Excalidraw (explicit source comment) + tldraw (routes label first) | zero fields | The behavioural half of #1 |
| **SHIP** | **"Reverse line direction" button** | draw.io ships it in Arrange: ends + labels swap, path unchanged | very low (swap source/target; mirror the label offset) | One line, high value |
| **DEFER** | **Line jumps over crossings** | Miro (straight/orthogonal only), Lucidchart | **HIGH** — React Flow has no primitive; needs a real intersection pass recomputed on every node move | Store the value, render later; do not let it block the pass |
| **DEFER** | **Global "Animations off"** | draw.io View → Animations, documented as a *view* setting that does not touch the document | zero — already have `diagram-studio:animate` | Already effectively present via reduce-motion |

---

## 4. THE FINAL SHAPE OF THE EDGE PANEL (proposed)

```
LABEL      label [input]
           background  [None | Surface | Outline]     ← NEW (#2), replaces nothing
           [Reset label position]                      ← NEW, sidebar button
LINE       stroke color  [9 swatches]
           stroke width  [1 | 1.5 | 1.8 | 2 | 3]      ← #8: button row, own row
           line style    [solid | dashed | dotted]     ← #8: button row, own row
           curvature     [bezier | smoothstep | step | straight]  ← #8: own row
           [Reverse direction]                          ← NEW
MARKERS    start  [none | closed | open]                ← #9: renamed + button row
           end    [none | closed | open]                ← #9: renamed + button row
CARDINALITY (only when the EDGE carries crow's-foot markers — §0)
           source end / target end   ← vocabulary unified with Markers
           [derived label]
FLOW       flow animation  [None | Dots | Dash | Pulse | Icon]   ← #10: one axis
           count / speed / icon
```

**Removed:** the sidebar hint (#3) · Intent label + its preset gate (#5) · Label position (#6) · the
orphan `animated` field (#10) · `Envelope` as a separate mode (folded into Icon, since "a letter" is
what both draw).

---

## 5. HONEST LIMITS OF THIS RESEARCH

- **No mature tool ships connector flow animation.** Miro, Lucidchart, Whimsical, FigJam: all zero.
  So §4's Flow section content is Diagram Studio's own product call; the research can only confirm the
  *duplications* to remove, not what to keep.
- **draw.io's label diamond drag is `[UNVERIFIED]`** — the child read the placement code
  (`labelShape.bounds`, `mxEdgeHandler.moveLabel`) but its CDP synthetic drag timed out. The free-drag
  claim rests on draw.io's own manual + primary source, not on an observed gesture.
- **Miro's label background/transparency is `[UNVERIFIED]` on the article's SILENCE**, not on a
  blocked page. Lucidchart's "TEXT PILL" fill likewise. `help.miro.com` **and** `help.lucid.co` are
  both Cloudflare-gated (reproduced: 403 + a 60s "Just a moment…" interstitial) — a future pass should
  assume any *other* URL on those hosts is gated until fetched.
- **The free-drag data shape is MEDIUM-HIGH confidence**: Sirius Web and Aleph store **absolute**
  positions and re-derive the offset at render; a **relative** offset is recommended here because
  Diagram Studio's label anchor is already derived, not stored — but that is a design judgement.
- **Line-jump cost is LOW-MEDIUM confidence**: the child read Sirius Web's rendering and stored type,
  not its gap-computation code.
