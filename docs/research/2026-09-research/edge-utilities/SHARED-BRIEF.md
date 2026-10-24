# SHARED BRIEF — Connection-line (edge) utilities for Diagram Studio

Date: 2026-09-21 · Status: v1
Output dir: `/home/harvey/diagram-studio-research/edge-utilities/`

## 1. GOAL

**Diagram Studio** is a React 19 + Vite 5 + `@xyflow/react` v12 diagram editor at
`/home/harvey/projects/tech-goblin/lab/diagram-studio`. It will be shared with other users, so every
decision must be **generic, self-explanatory, and defensible by what mature tools do** — never one
person's taste.

The owner (Harvey) has asked for one consolidated pass over **connection-line utilities**. He said:

> "Tôi muốn giải quyết line connection utilities 1 lần."

His verbatim asks (Vietnamese, translated faithfully):

1. **Label on the line fights the drag handle.** "Chỗ kéo line trùng với text. Tôi cảm thấy thật bất
   tiện. Tôi muốn có thể điều chỉnh được text trên line xung quanh như tôi muốn nếu tôi không thích nó
   nằm ở giữa." → he wants to **drag the label anywhere**, not pick from 3 fixed slots.
2. **Label background must be adjustable**, not always one white box — **including fully transparent**
   ("đôi khi tôi muốn transparency (không màu)").
3. Remove the **hint text** inside the line's sidebar section.
4. **Double-click anywhere on a line with no label should create one.**
5. Remove the **"Intent label"** field.
6. Remove the **"Label position"** field.
7. **Real bug:** "khi chọn màu cho line là tôi select line thì cái thân line màu xanh (do chọn) rồi khi
   đổi màu line tôi chỉ thấy mũi tên đổi màu chứ không phải thân line đổi theo. Phải unselect mới thấy."
8. **Stroke width / Line style / Curvature must be BUTTON rows, not dropdowns**, one per row, **widths
   balanced** so they look even.
9. **Markers: "arrow head" + "head start"** — he thinks it should read **"head start" / "head end"**;
   and **both should be button rows** like #8.
10. **Flow Animation** — "kiểm tra lại thiết kế, xem có trùng lặp gì với nhau không, tránh confuse các
    option lựa chọn, thiết kế đẹp hơn."
11. And: **"Còn lại nếu trên line connection cần options gì thì nghiên cứu báo tôi cho tiện lợi ích."**
    → **propose any missing connection-line utilities that mature tools ship and Diagram Studio lacks.**

## 2. WHAT DIAGRAM STUDIO ALREADY HAS (do NOT re-research these — verify only if you must)

All in `/home/harvey/projects/tech-goblin/lab/diagram-studio/src/`:

- **Edge component:** `GoblinEdge.tsx` (custom edge). Four path types via React Flow generators:
  `straight` → `getStraightPath`, `step` → `getSmoothStepPath({borderRadius:0})`,
  `smoothstep` → `getSmoothStepPath({borderRadius:12})`, else `getBezierPath`. Registry `edgeTypes`
  maps all four conventional ids + `goblinEdge` to this ONE component.
- **Edge data today:** `{shape?, offset?: 'center'|'start'|'end', flow?, flowIcon?, flowCount?,
  flowDuration?, techn?, bendX?, bendY?}` plus RF's own `label`, `markerStart`, `markerEnd`, `style`,
  `animated`, `type`.
- **Label:** rendered in `EdgeLabelRenderer`. Position is `labelOffset = {center:0.5, start:0.25,
  end:0.75}` projected onto the source→target line **plus** `labelX/labelY` (the path's own midpoint)
  — see `GoblinEdge.tsx` ~line 383. Label CSS `.edge-label` in `src/styles.css` (~line 1283) paints
  `background: var(--surface)`, `1px solid transparent`, transparent until hover.
- **The drag handle that collides with the label:** `.edge-bend-handle` (styles.css ~3627) is painted
  at `labelX/labelY` — **the exact same point as the label's anchor** — and only on the **selected**
  edge. This collision is Harvey's complaint #1. Read `src/edgeBend.ts` (pure maths) +
  the `bendDraggable` block in `GoblinEdge.tsx` (~line 519-552).
- **Sidebar (right panel, edge mode)** lives in `src/App.tsx` around lines **4928-5200**. Section
  vocabulary is decided in `src/inspector.ts`. Current sections: `label`, `line`, `markers`, (ERD only:
  `cardinality`), `flow`.
- **Control kit** (already exists, reuse it — do NOT invent controls): `ToggleRow`, `IconPickerRow`,
  `SegRow`/`InspectorPickers.tsx`, `Stepper`, `swatchRow`. Glyph art components `ArtArrow`, `ArtWidth`,
  `ArtDash`, `ArtCurve`, `ArtLabelPos`, `ArtCardinality` are already written (`src/shapes.tsx` and
  imported in App.tsx line 48).
- **Colour tokens:** `src/colors.ts` + `src/theme.ts`. `src/styles.css` has a **hex-literal ceiling of
  160** (currently 142) — a new hard-coded hex is a gate failure; use an existing CSS variable or a
  `color-mix()`.
- **Themes (5):** dark, light, paper, midnight, contrast. Every token is declared in all five.

## 3. THE KNOWN BUG (#7) — root cause ALREADY MEASURED, do not re-derive

`src/styles.css` line **1217**:
```css
.react-flow__edge.selected .react-flow__edge-path { stroke: var(--sel) !important; }
```
The `!important` overrides the inline `stroke` that `updateEdge({data:{strokeKey}})` writes, so while an
edge is **selected** its body is forced to the selection colour; only the arrow **marker** (a separate
`<marker>` element carrying `color` from `eStroke`) follows the new colour. Unselecting reveals it.
Treat this as fact; you may still cite how other tools handle "selection tint vs authored colour".

## 4. RESEARCH RULES (all children)

- **Every claim needs a URL.** Cite the tool's own docs/source, or its live UI. No "common wisdom".
- **Prefer PRIMARY SOURCE**: the tool's shipped source or its own documentation. Where you must rely on a
  third-party write-up, label it `[SECONDARY]`.
- **Mark anything you could not confirm** `[UNVERIFIED]` and say what you tried. Never invent a feature.
- **Be specific about the INTERACTION and the DATA MODEL**, not marketing prose: what happens on
  double-click, where the value is stored, what the default is, what the UI control actually is
  (button row / dropdown / slider / colour picker / free drag).
- **Answer for the SHARED-TOOL context**: a first-time user must understand it without a tutorial.
- Write **English**. Write ONLY to your own output file. Do not touch `src/`.

## 5. CLUSTERS + OUTPUT FILES (disjoint; one child each)

### C1 → `C1-drawio.md`
**diagrams.net / draw.io** (desktop + web). Dig into its real behaviour for:
(a) edge labels — how you create one (double-click on the edge?), how you move it (free drag? snapping?
reset?), what the label background does, and whether it can be transparent;
(b) edge style controls in the Format panel — which are button/segment rows vs dropdowns, and how the
panel groups them;
(c) the marker/arrowhead model — what the two ends are NAMED in the UI, whether start/end are button rows;
(d) how a selected edge shows selection vs its authored colour (does draw.io tint the line when selected?);
(e) anything else on its edge Format panel a connection line should have (jump/line-jump, rounded, flow
animation, orthogonal/curved, connection arrows, "line start"/"line end" fill, label position presets like
Left/Center/Right/Top).
Source of truth: draw.io's own docs (`drawio.com/doc`), its GitHub source (`jgraph/drawio`) for the
Format panel defaults, and its live app where reachable.

### C2 → `C2-excalidraw-tldraw.md`
**Excalidraw** and **tldraw**. For EACH:
(a) how an arrow/label is created and moved — is the label freely draggable? bound to the line? what is
the data model (`points`, `startBinding`, label position fields)?
(b) label background: what is the default, can it be transparent, what control changes it;
(c) which edge properties their right panel exposes, and as what control type (button row vs dropdown);
(d) selection vs authored colour — what happens to the stroke colour when the element is selected;
(e) flow/animation affordances (tldraw's `animationSpeed`, Excalidraw's absence of it) — cite the docs;
(f) free bonus: anything on an arrow/line they expose that a shared tool should copy.
Source of truth: `excalidraw/excalidraw` and `tldraw/tldraw` GitHub source + docs (Excalidraw has public
`docs.excalidraw.com`), and the live apps.

### C3 → `C3-reactflow-and-others.md`
**React Flow ecosystem + the remaining major tools**. Two halves:
(1) **React Flow / `@xyflow/react` v12** — what the library itself offers for the above: is there a
built-in edge label background prop (`labelBgStyle`/`labelBgPadding`/`labelBgBorderRadius`), a
`labelStyle`, `EdgeLabelRenderer` best practice for free-dragged labels, marker definitions
(`markerStart`/`markerEnd` types), `pathOptions`, and whether dragging an edge label is supported at all.
Cite the library's own docs/types (`reactflow.dev`, `xyflow/xyflow` source). Also find 2-3 **real
open-source React Flow apps** that solved "drag the edge label freely" and report HOW they did it.
(2) **Miro, Lucidchart, Whimsical, FigJam** — for each: the connection-line properties they expose,
what the two arrowhead ends are named, whether label position is a preset or a free drag, and whether
the label background can be transparent. Cite their own help docs. Mark Cloudflare-gated ones
`[UNVERIFIED — gated]` rather than guessing.

## 6. WHAT THE SYNTHESIS MUST CONTAIN

The orchestrator will consolidate your three reports into one `SYNTHESIS.md`. Make it possible by:
- ending your report with a **`## RECOMMENDATIONS`** section: a numbered list, each item =
  {the utility, the evidence (tool + URL), the interaction, the data-model cost, and your confidence};
- keeping the **`[UNVERIFIED]`** flags visible;
- stating explicitly where the tools **disagree**, because that is where the owner must decide.

## 7. HARD CONSTRAINTS TO RESPECT IN EVERY RECOMMENDATION

- Must work on **tablet + phone** (touch), not desktop-only — there is no hover on touch. Flag any
  recommendation that only works with a hover state.
- Must not require a **new npm dependency** unless you state the cost and the licence.
- Must not add a **new hard-coded hex** to `src/styles.css` (ceiling 160, currently 142).
- Must not bake in owner-specific content; the tool is to be shared.
