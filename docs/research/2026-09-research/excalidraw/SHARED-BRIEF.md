# RESEARCH BRIEF (shared) — what Excalidraw actually does, for Diagram Studio

You are researching ONE reference implementation. **You have NO browser and NO ability to run the app.**
Work from SOURCE CODE and DOCS. Every claim needs a file+line citation from the real repository. Mark anything
you could not confirm as `[UNVERIFIED]` — that flag is a valuable deliverable, not a failure.

## WHAT WE ARE BUILDING (context — do NOT research Diagram Studio itself)
"Diagram Studio" is Harvey's own React 19 + Vite + `@xyflow/react` v12 diagram editor. Two features are being
designed RIGHT NOW and both must feel like Excalidraw:

1. **An in-place TEXT EDITOR** on a node — the user double-clicks a text node and edits it on the canvas.
   Excalidraw is the reference for HOW THAT LOOKS AND BEHAVES.
2. **A right-hand PROPERTIES PANEL** for the selected element. Excalidraw's right panel is the reference for
   its SECTIONS, ORDER, CONTROL TYPES and what each control means.

## THE USER'S OWN WORDS
> "Còn text style thì B. tôi muốn nó giống excalidraw. Khi đang input text thì sẽ hiện giống kiểu của excalidraw
> các nút. đã tới lúc chỉnh sửa right side sắp xếp cho phù hợp với mọi loại shapes"

So: option B (a Text section in the right panel) is CHOSEN. He wants the in-place editor to show "the buttons
like Excalidraw" while typing, and the right panel reorganised to suit every shape type.

## THE REFERENCE PANEL (from a screenshot the user supplied — these are REAL Excalidraw controls)
Stroke · Font family (4 icon buttons: hand-drawn / serif / code / normal-ish) · Font size (S / M / L / XL) ·
Text align (3 buttons) · Opacity (0–100 slider) · Layers (send to back · move backward · move forward · bring to
front) · Actions (duplicate · delete · link). Treat this list as the SHAPE of the answer; verify it against the
source and correct it where the source disagrees.

## DECISION THAT LANDED AFTER THIS BRIEF WAS WRITTEN (read this — it changes what to report)

Harvey, on the inspector menus:

> "về phần các menu trước đó. thay vì chọn dropdown chữ thì nên thể hiện bằng hình để chọn dễ dàng. Cái nào ít
> khi đổi khi có thể theo dạng collapse, sắp xếp theo thứ tự ưu tiên hay dùng"

Translation: **replace text dropdowns with VISUAL/ICON pickers** (easy to choose by eye), **collapse the
rarely-changed controls**, and **order sections by how often they are actually used.**

So for the panel clusters (X2, X3), the deliverable is NOT just "what sections exist". It must also answer:
- **Which control is rendered as an icon/segmented picker rather than a text dropdown**, and why. Quote the
  component. Excalidraw's Font family / Font size / Text align / Layers / Actions rows are the model — they are
  icon buttons, not `<select>`s.
- **Which controls/sections are COLLAPSED by default, and what triggers expansion.** Is there a disclosure/
  accordion pattern anywhere in the panel? If Excalidraw has NO collapse, say so plainly — do not invent one.
- **Any ordering signal in the code**: is the section order fixed, or does it reorder by element type / by
  frequency? Report the actual order the DOM renders.

If a cluster finds nothing on one of these three points, state that explicitly — a documented "Excalidraw has
no collapse mechanism" is a usable finding.

## SOURCES — clone what you need, they are public
- **Excalidraw**: `https://github.com/excalidraw/excalidraw` (TypeScript, monorepo). The editor is
  `packages/excalidraw/`. Key areas to find yourself: the text-WYSIWYG/editing component, the text
  measurement/auto-resize logic, the right-side panel (`components/Actions.tsx`,
  `components/FontFamily*.tsx`, `components/TextAlign*.tsx`, `components/Opacity*.tsx`,
  `components/LayerUI.tsx`), and the keyboard/shortcut layer while editing.
- **The docs site** for anything the source leaves ambiguous: `https://docs.excalidraw.com`.

**Clone budget (hard rules):** `git clone --depth 1 --filter=blob:none`. Run `df -h /` BEFORE and AFTER any
clone and REPORT the size. If a clone or your combined temp usage reaches GB scale, STOP and report instead of
continuing. **Delete every clone when your report is written.**

## RESEARCH RULES
- **Primary source first**: the actual code at a pinned commit. Quote the line, give the path + line number.
  Blog posts and tutorials are secondary and must be marked as such.
- **No speculation.** If you did not read it, do not state it. `[UNVERIFIED]` beats a confident guess.
- Prefer reading the RENDERED markup structure / CSS values over prose description: the deliverable is
  something an implementer can copy, so exact class names, sizes, and state names matter.

## OUTPUT
Write your report to the EXACT path given in your own task below. Structure it as:
1. **What I read** — clone commit hash, the files you opened, the docs pages.
2. **Findings** — grouped, each with a `path:line` citation and the quoted code.
3. **Exact numbers** — every pixel size, font size, radius, duration, key name you found.
4. **What I could NOT verify** — explicitly, with the reason.
5. **Implications for a React Flow + DOM (non-canvas) implementation** — what transfers, what does not. Be
   honest where Excalidraw's canvas-based approach has no DOM equivalent.

REPORT: the file above is your deliverable. Keep the chat reply to a 5-line summary + the report path.
