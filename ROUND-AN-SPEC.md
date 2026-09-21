# ROUND AN — Harvey's second device test of the edge panel (6 items)

Base commit: **`f75f5d1`** (ROUND AM, pushed). Pre-change tree for every negative control: `f75f5d1`.

Harvey's verbatim items, each with the measured cause in the code.

---

## AN-1 — renaming a label sends it back to centre (**a real bug**)

> *"nếu tôi đổi text, enter thì nó tự nhiên về lại center. Ko ổn"*

**CAUSE (measured).** `GoblinEdge` computes `const createAt = d.__editAt`, and `commit()` writes the CENTRED
state when it is set:

```ts
if (createAt) d.__onLabelWrite?.(id, {labelAnchor: null, labelOffset: {...CENTRED}, labelPinned: false}, 'end');
```

`__editAt` is stamped by `openLabelAt` on a double-click of the PATH (App.tsx:2329) and **is never removed
from the edge's data** — grep the tree: it is written in exactly one place and deleted in none. So the
"create" signal stays on the edge forever:

* a first double-click on an empty path → editor opens, commit centres the label (**AL-4's intent**, correct);
* a double-click on the EXISTING label (the rename path) → `__editAt` is STILL there from the earlier
  creation → the rename commit writes the centred state → **the label jumps back to centre on Enter**.

**It is worse than a per-session bug: `__editAt` is PERSISTED.** Measured in the live boards —
`boards/mub08gfl725d408a.json` carries 4 occurrences, `mub6pfm9aa69a2cb.json` 2, `mub0ur0w6c5ac3a4.json` 1.
So the moment a board is reloaded, EVERY label on it is in "create" state and renaming any of them re-centres
it. AL-4's comment claims *"EDITING IS UNTOUCHED … a commit at an EXISTING label leaves `__editAt`
undefined"* — that claim is false for any edge that has been created through a path double-click.

**FIX.** `__editAt` is a one-shot signal, not stored state:
1. `commit()` and `cancel()` must **clear it** — the write is `d.__onLabelWrite?.(...)` already, so add an
   explicit clear (or make the writer clear it). A one-shot must consume itself.
2. The CREATE branch must be consumed **exactly once**: after the commit/cancel that it opened, the key is
   gone, so a later rename cannot re-trigger the centred write.
3. **Clear the key on READ for an existing board** (a tolerant parse in `migrateEdge` or wherever legacy keys
   are already handled), because a persisted `__editAt` must not resurrect the bug on reload. Do NOT rewrite
   boards on disk — fold it on read, the way `flow:'event'` was folded.
4. `openLabelAt` must remain the only writer, and it must be gated so an existing label's double-click does
   NOT re-stamp it (the label element's own double-click is a different handler — verify which one runs).

**AC:** a label created by double-clicking the path and then RENAMED keeps its dragged position; a label
renamed after a drag stays put; a stored `__editAt` on an existing board does not re-centre on rename; a
genuinely FIRST-created label still centres (AL-4 must not regress).

---

## AN-2 — no change needed (confirmed good)

> *"1. tốt"* — the drag fix is accepted.

Keep AM-1's harness and its negative control exactly as they are. Do not touch the gesture.

---

## AN-3 — the flow-glyph figures must match the flow row's size

> *"có thể làm cái icon nó to như mấy cái nút như trong flow cho đồng bộ kích thước ko. Ko đủ thì xuống dưới"*

**CAUSE.** The two rows draw their art in different frames. `ArtFlow` (already in the `flow` row) uses the
shared `G` wrapper — `viewBox="0 0 26 18"` with `strokeWidth 2`, so a figure spans roughly 22×10 of a 26×18
box. `FLOW_ICON_OPTS` renders each glyph as its own `<svg viewBox="0 0 24 24" width={15} height={15}>`, so the
figure is ~12.5px of ink in a 15px box — a different visual weight at the same 30×30 chip size, which is
exactly Harvey's complaint.

**FIX.** Draw the six glyphs in the SAME frame and stroke as `ArtFlow`, so both rows' figures read as one
family at 30×30: reuse the `G` `26×18` wrapper and the `strokeWidth 2` the flow row uses, scaling each
24×24 glyph to fill the frame the way `ArtFlow`'s figures do. The glyph PATHS themselves must not change —
only the frame/scale/stroke that carries them. Keep `.chip ic` at 30×30 (do NOT enlarge the button).

**Wrap:** `.chips` is already `flex-wrap: wrap`, so six chips that no longer fit drop to a second line on
their own. Verify that is true for this row (it is the row's own class) rather than adding a rule.

**AC:** both rows' art declares the same frame and stroke; the flow-glyph chips still carry the six
distinct glyphs; the chip box is unchanged at 30×30; the row still wraps when the panel is narrow.

---

## AN-4 — delete the FlowRail

> *"Ok nhưng tôi k cần cái Flow rail, xoá đi"*

**FIX.** Delete `FlowRail` outright: the component, its render site in the flow section, its two CSS rule
groups (`.flow-rail`, `.flow-rail-line`, `.flow-rail-bead`, `.flow-rail-note`, the `@keyframes
flow-rail-travel`, and the motion-gate entries for it), and the `label` prop plumbing. The `.speedval`
number and the slider stay — the value is still printed beside the thumb.

**Leave the reasoning in place** where the component was: he removed it, and the code must say so, so a
later round does not re-add a "helpful" preview. `checks/round-am-edge-panel.mjs`'s `am4.*` claims assert the
rail EXISTS — **re-anchor them, do not silently delete the assertions**: the claim that survives is the one
with a live subject (the speed value is still printed and still driven by the same stored duration), and the
removal itself becomes the recorded fact.

---

## AN-5 — undo must not drop the selection

> *"khi ctrl+z nó undo tắt cái selection hiện tại. có cần làm vậy ko? bình thường có phải vậy k hay vẫn giữ
> selection còn state thì đổi"*

**ANSWER, and it is not a matter of taste: keeping the selection IS the normal behaviour** (Figma, draw.io
and Excalidraw all leave the object selected after an undo — the selection is UI state, the graph is
document state, and undo restores the document). The current behaviour is not a design decision, it is a
side effect — so this is a defect.

**CAUSE (measured).** `snapshot()` normalises `selected: false` onto every node and edge, and `undo()`
restores that snapshot verbatim:

```ts
nodes: nodesRef.current.map(n => ({...n, position: {...n.position}, data: {...(n.data as any)}, selected: false})),
edges: edgesRef.current.map(e => ({...e, selected: false})),
...
setNodes(prev.nodes); setEdges(prev.edges);
```

The restore then fires React Flow's controlled `onSelectionChange`, which sets `selEdgeId` from the live
selection — now empty — so the inspector closes and the selection ring disappears.

**FIX.** Undo/redo must PRESERVE THE CURRENT SELECTION, not restore a captured one:
1. Capture the ids selected at undo time (`selected` on nodes, `selected` on edges) BEFORE applying the
   history entry.
2. After `setNodes`/`setEdges`, re-apply `selected: true` to those ids **that still exist in the restored
   graph** — an undo can legitimately delete the selected entity (undoing a create), and then the selection
   must go with it.
3. `selEdgeId` / `sel` / `selCount` must end up consistent with that result rather than being blanked by the
   selection callback. Prefer deriving them from the restored selection over writing them by hand, so the
   inspector can never disagree with the canvas.
4. Keep `selected: false` in the SNAPSHOT itself — do not let history restore a stale selection; the fix is
   that the LIVE selection survives, not that an old one is replayed.

**AC:** select an edge → change a value → Ctrl+Z → the edge is STILL selected and the inspector still shows
it; undo an edge's creation → the selection clears (the entity is gone); Redo after that restores the graph
without resurrecting a selection for something that is not there; the inspector's contents match the canvas
in every step.

---

## AN-6 — a selected label/plate lies about its own colour

> *"Cái Text đổi màu nó k có đổi vì do cái select nó đè màu xanh khi chọn. Issue tương tự mũi tên. Có cách
> nào khác ko? Ngoài ra cái background khi tôi đổi cũng k đổi màu luôn."*

**6a — the selected label's text colour is overridden.** `src/styles.css`:

```css
.edge-label { color: var(--label-fg, var(--fg)); }
.edge-label.selected { border-color: var(--sel); color: var(--sel); }
```

`.edge-label.selected` (0,2,0) sets `color` outright, so while the label is selected the user's authored
`--label-fg` is ignored — the panel says the colour changed and the canvas says otherwise. **This is the
same defect ROUND AK fixed for the edge STROKE with the inner authored-colour core, and it must get the same
answer: selection must not overwrite authored colour.** Fix it the AK way — the SELECTION signal moves to
chrome that does not carry meaning (the ring/border, already there), and `color` keeps reading
`var(--label-fg, var(--fg))` in every state. The selected state must stay VISIBLE (that is why `--sel` was
used) — the ring already does that job; do not simply delete the rule without leaving a visible selected
state, and prove an UNSELECTED label is byte-identical to today.

**6b — the plate colour is emitted but nothing consumes it.** `--label-plate` is set as an inline custom
property in `GoblinEdge` (`...(labelBgColor ? {'--label-plate': labelBgColor} : {})`) but **no rule in
`src/styles.css` reads it** — grep returns zero consumers. The three plate rules hard-code `var(--surface)` /
`transparent`. So the background swatch writes a key that renders nothing. **This is the sixth instance in
this project of "emitted but never applied"** — the fix is to give the rule a consumer:
`.edge-label.lb-surface { background: var(--label-plate, var(--surface)); }` (and the same shape for any
other plate state that should accept it), keeping the token as the FALLBACK so an untouched board paints
exactly what it paints today.

**AC:** with a label selected, changing `text color` changes the PAINTED text colour immediately, and the
selected state is still visible; changing `background color` changes the PAINTED plate; an untouched board
and an unselected label render byte-identically to before; a stored colour key still resolves through the
theme (no hex reaches the board).

---

## Gates

`npx tsc --noEmit`=0 · `node ./node_modules/vite/bin/vite.js build`=0 · hex literals in `src/styles.css`
must not rise above 160 (142 today) · **every** `checks/*.mjs` green, the touched ones re-run BY HAND with
their full verdict · new/changed assertions shown RED on `f75f5d1` · `boards/` untouched (hash it before and
after) · one commit per item, commit-as-you-go.
