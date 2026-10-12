# SYNTHESIS — Excalidraw reference for the inspector + text editing

Orchestrator synthesis of 3 grounded reports, written after **independently re-verifying** the claims that
change a design decision. Source pinned at `github.com/excalidraw/excalidraw` @
`c0ad61c6743aef7623e641cd1460d757cc6cacf3` (2026-09-16, `@excalidraw/excalidraw` 0.18.0).

Inputs: `X1-text-editor.md` (134 api calls), `X2-right-panel.md` (94), `X3-panel-by-type.md` (75), plus my own
clone-and-grep pass recorded in `ORCH-FINDINGS-icons-and-collapse.md`.

---

## 0. THE THREE CORRECTIONS THAT MATTER

These contradict what either Harvey or I assumed, and each one changes a decision.

### 0.1 Excalidraw's properties panel is **TOP-LEFT**, not right
`LayerUI.tsx:313` — `<FixedSideContainer side="top">`, inside `.App-menu_top__left`. The column on the RIGHT is
the **library** sidebar. So Harvey's sketch (and our right-panel inspector) is a **deliberate divergence from
Excalidraw, not a copy of it.** Say that out loud rather than pretending we are copying.

*Orchestrator re-verified: `grep FixedSideContainer packages/excalidraw/components/LayerUI.tsx` → `:313
side="top"`.*

### 0.2 There is **no floating toolbar while typing** — the "buttons" are the ordinary panel
`X1 §2.5`: no floating bar, no handle, no on-canvas button near the text. The textarea lives in a container
(`.excalidraw-textEditorContainer`, `App.tsx:2529`) that has **zero CSS rules in the whole repo**. The only
canvas markup while editing is a 50%-alpha dashed box, and **only** when `autoResize === false`.

What Harvey is remembering as "the buttons like Excalidraw" is the **persistent styles panel**, which stays
usable during editing because **editing counts as a selection target**
(`showSelectedShapeActions.ts:11-22`), with caret save/restore and blur-submit suppression around panel clicks
(`useTextEditorFocus.ts`, `textWysiwyg.tsx:938-944`).

**This is the single most important finding: "show the controls while typing" = keep the panel mounted and make
the editing node its target. It is NOT new UI.** Our chosen option **B** is already the right shape.

### 0.3 Font family has **3** buttons, not 4
`FontPicker.tsx` `DEFAULT_FONTS` = handDrawn (Excalifont) · normal (Nunito) · code (Comic Shanns). The 4th icon
Harvey saw is the **popover trigger** (`FontPickerTrigger.tsx:37`, `TextIcon`, title "Show font picker"), not a
4th font. *Re-verified from source.*

---

## 1. ICON PICKERS — Harvey's ask is what Excalidraw already does

> "thay vì chọn dropdown chữ thì nên thể hiện bằng hình để chọn dễ dàng"

**`grep -c "<select"` over the whole panel layer = 0** (re-verified). Every control is an icon button.

**The pattern to copy — trigger + popover, not a native dropdown** (`FontPicker*`):

| piece | where |
|---|---|
| resting control | one `IconButton type="toggle"` (`FontPickerTrigger.tsx:37`) |
| open state | flips `appState.openPopup` between the id and `null` (`:48-52`) |
| the popup | radix-ui `Popover.Root` (`FontPicker.tsx:105`) |
| each option | a `<button>` with **icon + label + optional badge** (`FontPickerList.tsx:308`) |
| keyboard | its own nav handlers (`keyboardNavHandlers.ts`) |

**Measured control metrics to copy:** button **32px**, icon **16px**, gap **8px**, radius **8px**, label
**12px**, section gap **0.75rem**, swatch **22px**, slider thumb **16px**, panel width **200px / padding 12px /
row-gap 12px**.

## 2. COLLAPSE — Excalidraw has **no accordion**; it has something better

`ls components/ | grep -iE "accordion|collapse|disclosur"` → **empty**. No `<details>`, no disclosure widget.
**Do not invent an accordion and attribute it to Excalidraw.**

But the exact idea Harvey wants exists under another name: **`CompactShapeActions`**
(`Actions.tsx:608-612`), verbatim comment:
> *"Compact styles panel — the collapsed, popover-driven layout used on tablets and on desktop when the UI is in
> 'compact' mode."*

Same action set, **two densities**: full rows, or folded behind popover triggers. That is frequency-driven, it
is what the tablet tier uses anyway (this project has a tablet tier), and it is upstream code — not our
invention. **"Rarely changed ⇒ behind a trigger" is the mechanism to reuse.**

## 3. SORTING — Excalidraw never made that decision; it is ours
The order is **fixed**; entries are filtered by predicates, never sorted
(`predicates.strokeColor && renderAction(...)`). So "sắp xếp theo thứ tự ưu tiên hay dùng" must be justified by
**what each element type actually shows** — that is exactly what X3's truth table gives us.

---

## 4. WHAT SHOWS FOR WHAT — the real dispatch

**Not `Actions.tsx`.** The decision is one pure function: **`components/shapeActionPredicates.ts:88
getShapeActionPredicates()`** → **18 boolean flags**. `Actions.tsx:157-224` is only the renderer (17 ordered
`flag && renderAction(name)` branches, plus a bucketfill early-return). **All three layouts consume the same
flags** — so a frequency/priority decision has exactly ONE place to live.

From X3's truth table (13 element types × 14 columns), the facts that matter to us:

- **`fill` is hidden by default for every type** (needs a non-transparent background).
- **`freedraw` is the only type without Layers.**
- **`text` is the only type with font/size/align and WITHOUT strokeWidth/strokeStyle/sloppiness.**
- **font family/size show ⟺ `activeTool === 'text' || targets.some(isTextElement)`**, and because
  `includeBoundTextElement: true`, **a labelled rectangle KEEPS its font controls**.
- An **arrow's own label loses Text align** (`suppportsHorizontalAlign` false for arrow containers).
- **Arrow vs shape swap:** shapes get **Edges (Sharp/Round)** via `canChangeRoundness`; arrows get **Arrow type
  (Sharp/Curved/Elbow)** via `toolIsArrow`/`canHaveArrowheads`. At this commit a plain `line` gets **no
  Arrowheads section at all**.
- **Multi-select has no dedicated branch** — it is `some()` union semantics: everything any member supports,
  plus Align (≥2) and Distribute (>2). Crop and the linear editor drop out.
- **Nothing selected ⇒ the panel is not mounted at all.** Document settings live in the **hamburger menu**
  (canvas background; grid under Preferences) — **never** in the styles panel.
- **`showExtraActions = hasSelection && !isEditingTextOrNewElement`** → duplicate/delete are **hidden while
  editing text**, while colour/font/size/align stay. Worth copying verbatim.

**Exact values:** `FONT_SIZES {sm:16, md:20, lg:28, xl:36}` (default 20 — the 4th label is **"Very large"**, not
XL); opacity `min 0 max 100 step 10`; real applied stack
`Excalifont, Xiaolai, sans-serif, Segoe UI Emoji`; per-family line-heights 1.15 / 1.2 / 1.25.

---

## 5. TEXT EDITING — what transfers to a DOM/React Flow build

**Transfers 1:1:**
1. **A plain `<textarea>`, not `contentEditable`** — Excalidraw deliberately did not use contentEditable (no
   IME/lint/paste-html pain). Our node content is already DOM, so this is a straight win.
2. **Tag the editor and bail at the top of the global key handler** — `dataset.type="wysiwyg"` +
   `isWritableElement()`. In React: `if (isEditableTarget(e.target) && e.key !== 'Escape') return;`
   **Do NOT add a `mode === 'editing'` flag**; Excalidraw does not, and a flag breaks host-rendered inputs.
   (We already have `isEditable()` in `App.tsx` doing this — same idea.)
3. **The key contract:** Enter = newline · **Escape AND blur both COMMIT** (never revert; only undo reverts) ·
   Ctrl/Cmd+Enter commits · Tab = indent · **Ctrl+Shift+`<`/`>` resizes the font WITHOUT leaving the editor**
   (worth stealing) · guard IME with `event.isComposing || keyCode === 229`.
4. **The panel-as-target pattern** (§0.2) — the whole answer to "controls while typing".
5. **Empty-after-`trim()` on commit ⇒ delete the element**, single undo entry.
6. **No placeholder text** in Excalidraw. If we add one, it is our choice, not a copy.

**Does NOT transfer (do not port blindly):** canvas `measureText` autosize (we have real DOM measurement, which
is *simpler*), the `/zoom` arithmetic all over the canvas path, the `×1.05` height buffer, the `+0.5` width
fudge, and the grip geometry. Our DOM nodes reflow natively.

---

## 6. RECOMMENDATION FOR THE SPEC

1. **Inspector = option B (chosen)**, built on the **predicate-flag model**: one `showXFor(type)` decision
   function, one render list per element type. This is directly copied from upstream and is why Excalidraw's
   panel can serve 13 element types without a tangle.
2. **Convert icon-able `<select>`s to trigger+popover pickers** (font, size, align, stroke width, line style,
   arrowheads, curvature, cardinality). Native `<select>` is the thing Harvey is complaining about, and
   upstream has **zero** of them.
3. **"Rarely changed" ⇒ popover trigger**, following `CompactShapeActions`. No home-made accordion.
4. **Order sections per element type**, justified from the truth table; do not port Excalidraw's order (its
   panel is top-left, ours is right — different constraints).
5. **Text editing:** keep the panel mounted and target the editing node; hide duplicate/delete while editing;
   `<textarea>`; the key contract in §5.3.
6. **Tell Harvey plainly:** the panel being on the right, and any collapse mechanism, are OUR decisions, not
   copies. Excalidraw is a reference for the CONTROL VOCABULARY, not for the layout.
