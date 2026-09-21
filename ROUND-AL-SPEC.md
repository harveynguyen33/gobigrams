# ROUND AL — edge panel: selection, label, unified controls

**Status:** approved by Harvey 2026-09-21 (mockup v4 accepted: *"ok"*).
**Mockup of record:** `/home/harvey/diagram-studio-research/mockup-al-sidebar-real.html` (v4).
**Feedback of record:** `ROUND-AL-FEEDBACK.md`.
**Round AK is already shipped** (`f0b00aa`, pushed) — this round amends it from his device test.

**Scope: FLOWCHART ONLY.** C4 is excluded on his instruction (*"tạm thời C4 bỏ qua 1 bên đừng cân nhắc…
Tôi muốn tập trung dựa vào flowchart làm 1 cái initial thật tốt đã rồi apply cho các cái khác"*). Do not
design or tune anything around C4, and do not gate anything on the C4 preset.

**Gates that must not regress:** `tsc=0` · `vite build=0` · hex literals in `src/styles.css` ≤ **160**
(currently **142**) · **all 32 harnesses in `checks/*.mjs` green** · no new npm dependency.

---

## AL-1 — selection: the old look, made truthful *(he rejected the dashed halo)*

**Today (rejected):** `.edge-sel-overlay` is a second `<path>` at `strokeWidth + 5` with
`strokeDasharray="6 4"` (`src/GoblinEdge.tsx:802-809`, `styles.css:1241`). He called it ugly and said it
fights the flow animation.

**Chosen: option C** — the body turns the **selection colour exactly as it did before ROUND AK** (the look
he liked), and the **authored colour is preserved as a thin core line inside it**, so the panel can never
lie about the colour.

**Required:**
- Delete the dashed halo: the `strokeDasharray`, the `+5` width, and the `.edge-sel-overlay` rule.
- When `selected`: draw the body in `var(--sel)` (this is the old look) **and** a second path on top in the
  edge's **authored** colour, thin (≈1.1px vs the body's own width).
- **Unselected renders byte-identically to today** — the authored path only, one path. This is the
  pixel-parity rule this file obeys; assert it.
- Must NOT depend on `:hover` (no hover on touch).
- **Tokens only, no new hex.**

## AL-2 — the label drag: remove BOTH rails *(his words: no constraints at all)*

> *"cứ để nó kéo thoải mái đi đâu thì đi. ko cần ràng buộc với xung quanh line. Nếu kéo quá xa thì đó là
> user issue (ngoài ra đã có nút Reset Label Position rồi)"*

In `src/edgeLabel.ts`:
- **Delete `snapToCentre`** from the write path (and the `LABEL_SNAP_PX` rail it implements). A label parked
  near the centre must STAY where it was put.
- **Delete `clampToRange`** from the write path. A label dragged far from the line STAYS far.

**Also fix the third cause of "click once and it jumps":** `onLabelDown` claims with **`lock: 0`**
(`GoblinEdge.tsx:480`), so any sub-pixel jitter counts as a drag and fires `onEnd` → a write. Give it a
small **screen-px** lock (2-3px, scaled by zoom) so a real click writes nothing at all, and keep the
`{0,0}`-delta guard.

**Keep:** `Reset label position` — it is now the ONLY way back, which is what he asked for.

**Dead code:** `labelClearance` / `labelHalfAlong` / `LABEL_TO_ARROW_PADDING` / `clampToRange` /
`snapToCentre` exist only to feed the removed rails. **Say in the report which of them become unused**, and
remove only those with no other consumer — do NOT delete a helper another caller still uses.

## AL-3 — label background: default `None`, halo, text above the line, and TWO colour pickers

1. **`data.labelBg` default becomes `'none'`** (today `'surface'`). `labelBgOf` must resolve an absent value
   to `'none'`.
2. **Text paints ABOVE the line.** Check the real z-order rather than assuming: the label is a DOM `<div>`
   portalled into `.react-flow__edgelabel-renderer`. **Measure it** and report the actual stacking.
3. **At `none`, the glyphs carry a canvas-coloured HALO** (tldraw's `showTextOutline` technique), so the
   line cannot run through the text. This is what he meant by *"none background nên hoà với màu của nền
   canvas"*. Implement as a `text-shadow` in the **canvas** colour (`var(--bg)`), applied only to the
   `none` state.
4. **NEW: two colour pickers in the `label` section** —
   - **`text color`** → a swatch row writing `data.labelTextKey` (use the existing `ColorKey` vocabulary
     and `COLOR_VAR`, exactly as the edge stroke already does — do NOT invent a new palette).
   - **`background color`** → a swatch row writing `data.labelBgKey`, **shown only when the background
     state is not `none`** (the mockup dims it at 42%).
   Both are the panel's existing swatch control; no new control type.

## AL-4 — a first-created label starts CENTRED

> *"hiện nó đang văng tùm lum. chắc là nên với create lần đầu thì nên luôn nằm ở giữa nhé"*

Today `onEdgeDoubleClick` (`App.tsx:2242-2250`) stamps the clicked flow point and the commit stores an offset
from it. **Change: the FIRST creation ignores the click point and centres.** The double-click still OPENS
the editor; only the stored position becomes centre (i.e. store no offset / unpinned — the same state
`Reset` lands on). Editing an EXISTING label must still never move it.

## AL-5 — the two actions sit in the section that owns them

**Already true in the code — do NOT move them:**
- `Reset label position` closes the **`label`** section (`App.tsx:5271`).
- `Reverse line direction` closes the **`line`** section (`App.tsx:5373`). It re-points the path; it does not
  move the label, which is why it belongs to Line (draw.io ships it under Arrange).

**What changes is only the LOOK:** restyle both from bare `.mbtn` into the panel's **action chip** — dashed
border, dim, no selected state — so they stop reading as value rows. Full names (not `Reset` / `Reverse`),
since each is alone on its line.

## AL-6 — ONE control system (v4). The core of the round.

> *"tổng thể UI/UX của các button hiện tại đang rất xấu và k đồng đều nhau… Lúc to, lúc dài, lúc nhỏ"*

**Measured cause: the panel runs THREE unrelated button families.** `.insp-seg-btn` (`flex: 1 1 0`, equal
share), `.mbtn` (**content-sized**), `.toggle` (its own shape), plus `.insp-seg.grid3` and
`.insp-seg.half` carrying their own paddings.

**Required — one chip system, used by EVERY row in the panel:**
- **ONE height: 30px**, on every interactive control — chips, stepper buttons, stepper value, AND the text
  input. Measured, not asserted. *(The mockup's first draft claimed 29 and measured 29/32/32 — same defect
  class as the code; do not repeat it.)*
- **Content-sized with wrap — never a fixed column count.** An equal-share grid gives a one-word button and
  a two-word button the same width, which is exactly the "không đều" he saw.
- **Two chip shapes only:**
  - **pill** (`border-radius: 999px`) for rows whose options are WORDS;
  - **square** (`30×30`, small radius) for rows whose options are GLYPHS — square chips are even by
    construction, so a glyph row cannot be uneven.
- **`action` variant:** dashed border, `--dim`, no selected state.
- **Rows may differ in length** (*"có thể k cần tất cả chung 1 dòng"*), and **a crowded row must be split**:
  he called the old `width · style · curve` and `count · speed` rows **"chen chúc"**.
- **Convert these rows:**
  - `stroke width` → its own row: pills `1 / 1.5 / 2 / 3`.
  - `line style` → its own row: **3 square glyph chips**.
  - `curvature` → its own row: **3 square glyph chips**.
  - `start` / `end` → each its own row: **3 square glyph chips** (the arrow glyphs already exist as
    `ArtArrow`; reuse them).
  - `flow` → **5 square glyph chips** (None / Dots / Dash / Pulse / Icon), replacing the 5 word buttons.
  - `count` → its own row (the existing `Stepper`, brought into the system).
  - `speed` → its own row: 4 word pills.
  - `flow glyph` → **square glyph chips**, reusing `FLOW_ICON_PATHS`.
  - `background` → 3 word pills (`None / Surface / Outline`).
- **Target, measured on the 288px panel:** no row's widest line above **~85%** of the field width, and **no
  row may overflow** (`scrollWidth <= clientWidth`). The v3 mockup measured 83% max after the fix.

## AL-7 (Q2 = c) — hide Count/Speed unless the flow choice uses them

Count and Speed appear only for the flows that HAVE a payload (`dots`, `icon`). Keep the existing
`diagram-studio:animate` reduce-motion gate a **separate axis** (ROUND AK, AK-18) — do not merge them.

---

## HARD RULES
1. **NEVER edit anything in `boards/`.** It must hold exactly 4 files when you finish:
   `library.json`, `library.json.bak`, `mu9u9pb943fe8b4f.json`, `muao54169b28cc5a.json`.
2. **COMMIT AS YOU GO** — after each AL item is green, commit. A previous run was killed from outside and
   lost everything uncommitted; the run that committed per step survived. **Never leave more than one
   item's work uncommitted.**
3. **No new hard-coded hex** — ceiling **160**, currently **142**.
4. **No new npm dependency.**
5. **Reuse the existing control kit** (`src/InspectorPickers.tsx`). Do NOT invent a control.
6. **`updateEdge` merges `data` by default — never pass `replaceData=true`.**
7. **ONE history entry per gesture**, at the START.
8. **An assertion that changes verdict is RE-ANCHORED, never deleted**, with the old claim printed beside
   the new, and shown RED on the pre-change tree.
9. **You have no browser.** Assert against source and by executing shipped pure functions under Node.
   **Do not invent measurements.**
10. Gates: `tsc`=0 · `build`=0 · every `checks/*.mjs` exits 0 **except the 2 known pre-existing reds**
    (`package-templates.mjs` and `round-4-dialog-tooltip-approval.mjs`, which assert `boards/ >= 3` and fail
    identically at `90edd6c`) · hex ≤ 160.

## EVIDENCE TO RETURN
1. Per AL item: done/partial/not-started with file+line.
2. `tsc` / `build` exit codes; the hex count; the full harness sweep naming the 2 expected reds.
3. The **measured** height of every interactive control (must be one number) and each row's widest fill %
   on the 288px panel (must be ≤ ~85%, no overflow).
4. Which helpers became dead with the rails, and what you removed vs kept.
5. `git log --oneline` of your commits; `git status --short` (clean); the `boards/` listing.
6. Anything you could NOT do, stated plainly.
