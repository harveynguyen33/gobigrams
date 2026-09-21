# ROUND AL — Harvey's device-test feedback on ROUND AK

**Date:** 2026-09-21 · **Source:** Harvey's own test on his Mac of ROUND AK (`f0b00aa`)
**Status:** feedback captured; **needs a decision pass (mockup) before any build.**
**Round AK is otherwise shipped** — 32/32 harnesses, `tsc`/`build` 0, pushed.

---

## What he verified as FIXED

- **#1 (bug #7) — the colour bug is gone.** *"đồng ý đã hết"* — selecting an edge and changing its colour
  now updates the body immediately. **Confirmed by the device test, which is the measurement the
  orchestrator could not produce** (the headless browser renders zero edges for this project).
- **#2 — the free label drag works.** *"kéo text thì kéo loanh quanh thì ok rồi"*.
- **#5 — the two new buttons work.** *"2 nút mới khá là Ok với tôi"*.
- **#4 — double-click creates a label.** It works; the *position* is the complaint.

---

## The 7 points, verbatim + the measured cause

### AL-1 — the selection affordance is UGLY *(he would rather revert than keep it)*
> *"nhìn nó xấu sao ấy, ko biết có cách nào khác ko. còn nếu k tôi lại thà như cũ nhìn đẹp hơn.
> đặc biệt khi chỉnh line animation, nhìn nó rất kì."*

**Measured cause.** The replacement is a second `<path>` at `strokeWidth + 5` with
`strokeDasharray="6 4"` (`src/GoblinEdge.tsx:802-809`, `.edge-sel-overlay` at `styles.css:1241`). A +5px
dashed halo around the body reads as a **fat dashed outline**, and with flow animation running it fights
the moving payload.

**Candidate fixes (mockup must show these):**
- **(a) Hairline twin, no dash** — a solid `1px` path in `--sel` drawn *exactly* on the body with a small
  `filter: drop-shadow` glow. Reads as "the line glows when selected" rather than "the line got a
  border". This is the closest to the OLD look he liked (the body simply changed colour) while keeping
  the authored colour visible.
- **(b) Endpoint-only signal** — paint the two small endpoint dots in `--sel` and leave the body alone.
  Cheapest, never touches the line, but a weak signal on a long edge.
- **(c) Selection = `--sel` body + authored colour as a thin INNER core** — the inverse of today: the
  outer body takes the selection colour (as before ROUND AK, which he liked) and the authored colour is
  preserved as a 1px core line inside it. **This is the one that literally restores the old look while
  still telling the truth about the colour.**
- **(d) Revert to pre-AK behaviour and accept the lie** — put the `!important` back. Documented as the
  fallback he named himself.

### AL-2 — the label drag's rails are wrong; he wants NO rails
> *"nếu tôi kéo ra xa, bỏ chọn, rồi tôi chọn lại, click 1 cái nó tự về giữa. hơi kì. cứ để nó kéo thoải
> mái đi đâu thì đi. ko cần ràng buộc với xung quanh line. Nếu kéo quá xa thì đó là user issue (ngoài ra
> đã có nút Reset Label Position rồi)"*

**Two rails, both to remove** (`src/edgeLabel.ts`):
1. **`snapToCentre` (AK-14.2)** — within `LABEL_SNAP_PX` (10 **screen** px) of the anchor it snaps to
   exactly centre, and a snapped write STORES the unpinned state. So a label parked near the centre
   cannot be placed there deliberately.
2. **`clampToRange` (AK-14.3)** — slides the point back inside the usable range so the box clears the
   arrowheads. **This is what moves a far-dragged label back toward the line.**

**Plus a third, subtler contributor to "click once and it jumps":** `onLabelDown` claims with
**`lock: 0`** (`GoblinEdge.tsx:480`), so *any* pointer jitter counts as `moved = true`, which fires
`onEnd` → a **write on a gesture the user experienced as a click**.

**The decision:** remove the snap and the clamp; keep the `0,0`-delta guard only if it can be done
without reintroducing the jump (a small lock in SCREEN px, e.g. 2-3px, would let a real click through
untouched). `Reset label position` stays as the only way back — his own words.

### AL-3 — label background: default `None`, text above the line, and COLOUR pickers
> *"By default nên là none, ngoài ra hãy cho chữ luôn là lớp trên của line nếu chữ ở line vì ở trạng thái
> none của background, thì chữ với line nhìn nhập nhằng. or ít nhất none background nên hoà với màu của
> nền canvas. Và cần cho phép chỉnh màu cho background của text và màu của text"*

Three asks:
1. **Default `labelBg` = `none`** (today the default is `surface`). Note this changes the default look of
   every existing board — and his own board stores nothing, so it *will* change what he sees.
2. **Text must paint ABOVE the line** (z-order) — today the label div is portalled into
   `.react-flow__edgelabel-renderer`, so this needs checking rather than assuming.
3. **At `none`, the text must blend with the CANVAS background**, not sit naked on the line: the answer is
   tldraw's **canvas-coloured text outline / halo** (a `text-shadow` in the canvas colour), so the line
   does not run through the glyphs. **This is what "hoà với màu của nền canvas" describes.**
4. **NEW: a colour picker for the label's TEXT colour, and one for its BACKGROUND colour.** Today
   neither exists — `labelBg` is a 3-state enum and the text colour is inherited.

### AL-4 — a first-created label should start CENTRED
> *"hiện nó đang văng tùm lum. chắc là nên với create lần đầu thì nên luôn nằm ở giữa nhé"*

Today `onEdgeDoubleClick` stamps the **clicked flow point** and the commit stores an offset from it
(`App.tsx:2242-2250`, `GoblinEdge.tsx` `commit()`), so the new label lands wherever he happened to click.
**Change: the FIRST creation ignores the click point and centres** (the double-click still *opens* the
editor; only the stored position becomes centre). Keep the click point for the *edit* path? No — he asked
for centre, so centre.

### AL-5 — the two new buttons look messy
> *"nó đang nằm nhìn nó bừa bộn, có các nào thiết kế nhìn nó ok hơn ko"*

Both are bare `.mbtn` in their own `.field` rows (`App.tsx` label section + line section). They are
**actions**, not values — the panel's other rows are value controls, so an action sitting in a value row
reads as clutter. Mockup must propose a placement/shape (e.g. an action row of two icon+label buttons, or
a small toolbar at the section head).

### AL-6 — the button system is INCONSISTENT (the biggest design item)
> *"khi có Count, và Speed nhìn UI/UX các buttons rất xấu. Thật ra nói tổng thể UI/UX của các button hiện
> tại đang rất xấu và k đồng đều nhau. Có cách nào thống nhất tốt hay ko. Lúc to, lúc dài, lúc nhỏ"*

**Measured: the panel runs THREE unrelated button systems at once.**
| System | Where | Size behaviour |
|---|---|---|
| `.insp-seg-btn` | the flat rows (width/dash/curve/markers/valign…) | `flex: 1 1 0` — equal share |
| `.mbtn` | flow options, flow icons, showMode, Reset/Reverse | **content-sized** — so "None"/"Dots" are short and "Reset label position" is long |
| `.toggle` | the boolean switch | its own shape again |
Plus `.insp-seg.grid3` (3+3 font row) and `.insp-seg.half` (2+2 speed row) carry **their own paddings**.

His words *"lúc to, lúc dài, lúc nhỏ"* is exactly this: the same visual role has three different sizes on
one panel. **The round's core deliverable is ONE segmented-row system** used everywhere, with the only
permitted variation being the option count (and a documented wrap rule above 4 — the tldraw threshold
this project already cites).
The **Count + Speed** pair is the worst offender and must be redesigned as one coherent cluster.

### AL-7 — flowchart first; park C4
> *"tạm thời C4 bỏ qua 1 bên đừng cân nhắc, C4 hiện tại cũng k đúng ý tôi nữa. Tôi muốn tập trung dựa vào
> flowchart làm 1 cái initial thật tốt đã rồi apply cho các cái khác"*

**Scope decision:** ROUND AL designs against **flowchart only**. C4 is excluded from the mockup and from
the build. This also means the ROUND AK architecture fix (cardinality gated on the edge) does not need a
C4 answer yet.

---

## Plan for ROUND AL

Harvey's own workflow is **mockup → approve → build**, and he approved that flow for the palette pass. So:

1. **Mockup** (`/home/harvey/diagram-studio-research/mockup-al-edge-panel.html`) showing:
   - AL-1: the four selection variants, rendered **on a real-looking edge, with flow animation running**
     (his specific complaint), on the dark theme;
   - AL-6: the proposed ONE button system, with the Count+Speed cluster redesigned and a before/after;
   - AL-3: the label background states with the canvas-halo at `none`, plus the two new colour pickers;
   - AL-5: two placements for the action buttons;
   - AL-2/AL-4: no mockup needed (behaviour, not look) — documented above.
2. **He picks.** Only then a build brief.
3. Build in ONE pass, gated by `tsc` + `build` + the harnesses + a new one for AL's rules.
4. Then the **ROUND AK vault capture** (still outstanding) can be batched with ROUND AL's.
