# ROUND AM — Harvey's 5 connection-line (edge) items

Status: **AM-1 committed `6cb9f6c`, harness in progress** · **AM-2…AM-5 APPROVED by Harvey**
(2026-09-21, "ok làm đi") against the mockup `/home/harvey/diagram-studio-research/mockup-am-edge-flow.html`
— that four-times-revised-style mockup is the approved design of record for AM-2…AM-5.

Repo: `/home/harvey/projects/tech-goblin/lab/diagram-studio` · base commit `253a77e` (HEAD, clean).
Pre-fix tree for every negative control in this round: **`253a77e`**.

---

## AM-1 — the label drag is wrong: it writes an ABSOLUTE point, not a delta

**Harvey's report (verbatim):** *"khi nắm kéo text di chuyển, sau lần đầu, những lần sau nắm
kéo thì cái text bị giật và ra xa con trỏ chuột 1 khoảng => đáng lý phải luôn theo con trỏ chuột"*.

**ROOT CAUSE — MEASURED, not guessed.** Proven by executing the shipped, React-free module
`src/edgeLabel.ts` under Node (the round's proof script), reproducing `GoblinEdge.onLabelDown`
operation for operation:

```
anchor A = {100,100}   (the auto-centre point; it does not move while no node moves)
drag 1 — finger ends at {300,200}:  label painted at {300,200}   error = 0.0 px   (looks perfect)
drag 2 — finger ends at {400,250}:  label painted at {200,150}   error = 223.6 px  ← the bug
```

**Why.** `GoblinEdge` computes the anchor `L = labelAnchor({…, labelOffset: d.labelOffset, …})`
**during render** and `onLabelDown` closes over that render's value. `labelWrite({W, anchor: L})`
returns `W − L`, i.e. **the pointer's absolute position minus the anchor** — a *delta* only when
`L` is the anchor. But `L` is **the painted position** as soon as `labelPinned` is true, so:

* drag 1 (never pinned): `L` = anchor → the write happens to be correct;
* the render after drag 1 makes `L` = the new painted point, so drag 2's write is
  `pointer − paintedPoint` = the pointer's *delta*, and adding it to the painted point gives
  `pointer − (pointer − painted) = paintedPoint` → **the label stops moving** (frozen under the
  finger) and the *next* write teleports it by exactly the previous drag's distance. That is the
  "giật và ra xa con trỏ chuột 1 khoảng" Harvey measured, and the reported offset equals the first
  drag's own distance (`{200,100}` in the proof above).

**The fix — a DELTA gesture with an O(1) correction.** Nothing re-renders the label in the same
frame as the pointer, so the closure's `L` is *always* one render behind; the fix must therefore be
correct for a stale anchor rather than assume a fresh one.

1. `src/edgeLabel.ts` — the write carries **the gesture's own anchor** so the next gesture can
   correct for it:
   ```
   export type LabelWrite = {labelAnchor: LabelOffset | null; labelOffset: LabelOffset; labelPinned: boolean}
   ```
   * `labelAnchor: null` = "this offset is ABSOLUTE — do not rebase" (the Reset path and the
     create path today; nothing else may pass null).
   * `labelAnchor: {x,y}` = "this offset was captured at gesture start with the anchor at {x,y}".
   * `anchorWrite({anchor, base, W})`: `base` is the offset at gesture start (`null` when the edge
     carried none). Returns `{labelAnchor: anchor, labelOffset: base + (W − grabPoint)…}` — see the
     exact contract below.
   * `labelWrite` STAYS (same signature, same arithmetic) so ROUND AK/AL's harnesses keep a real
     subject; it becomes the ABSOLUTE form used by the create/reset paths.
2. The gesture's grab point is captured ONCE, at pointerdown, in the renderer: the pointer starts on
   the label, so `grabPoint = origin` (already computed in `onLabelDown`) and the write is
   `base + (W − origin)`, rebased against the live anchor. **`W − origin` is a delta**, so a stale
   anchor can no longer corrupt it: the write adds a delta to the offset the user can SEE.
3. `App.onLabelWrite` — the rebase correction, so a node moving *during* a drag still tracks the
   finger. `data.labelAnchor` stores the anchor the stored offset was captured against; when the
   incoming write's `labelAnchor` differs from the stored one, the stored offset is first rebased by
   `stored − incoming` and then the new offset is applied. When they agree (the normal case) or the
   edge has no stored `labelAnchor` (an existing board), the write is applied as-is.
4. `EdgeData` gains `labelAnchor?: {x,y}`. **Centred writes delete ALL THREE keys** (`labelOffset`,
   `labelPinned`, `labelAnchor`) so "reset", "dragged exactly back" and "never moved" stay ONE
   stored state — the invariant ROUND AK established.
5. `Reset label position` (App, the `eLabelMoved` branch) deletes `labelAnchor` too.

**No migration and no board rewrite:** a board with an old `labelOffset` and no `labelAnchor`
renders byte-identically (the anchor is the rendered value, unchanged), and the first drag adopts
the live anchor as its base.

**Acceptance (all measurable without a browser):**
* AM1-a: two consecutive gestures, each ending with the pointer at a different point — the painted
  position tracks the pointer to **< 0.01 px in BOTH**, on an edge that was never pinned AND on an
  edge that was pinned by the first gesture. (The pre-fix tree fails the second: 223.6 px.)
* AM1-b: the anchor moving mid-gesture (simulating a node drag) still leaves the label under the
  pointer (the rebase correction), error < 0.01 px.
* AM1-c: a centred write deletes `labelOffset`, `labelPinned` AND `labelAnchor` (no leftovers).
* AM1-d: releasing exactly on the grab point restores the pre-drag painted position exactly.
* AM1-e: zoom-independence — the same gesture at zoom 0.5 / 1 / 2 tracks the pointer in flow units.
* AM1-f: **negative control** — the harness's own model of the SHIPPED semantics (frozen anchor +
  absolute write) must be RED on the same inputs, and the source probes must be RED on `253a77e`.

---

## AM-2 — the edge label gets a TEXT section (size like a normal Text)

`getInspectorSections({kind:'edge'})` gains `text` (order: `label → text → line → markers →
[cardinality] → flow`). The label target already renders the Text section; the edge target gains it.

* Stored as `data.labelStyle` (a `TextStyle`), applied by `textStyleVars` to the `.edge-label` div —
  the SAME vars the node/label path emits, so there is one text-style vocabulary, not a second.
* Controls: **SIZE** (the S/M/L/XL ladder, custom scale stays honoured if a board carries one),
  **WEIGHT**, **FONT**. **No ALIGN and no vertical align** — an edge label is an inline chip with no
  box to align inside; its position is the drag.
* **Colour is NOT duplicated:** the edge's text colour stays `data.labelTextKey` in the LABEL
  section (`text color`). The Text section therefore renders no colour row for an edge.
* Renderer: `.edge-label` reads `--ts-scale` / `--ts-weight` / `--ts-font` with today's values as
  fallbacks, so an untouched board paints byte-identically (`font-size: calc(11px * var(--ts-scale,1))`).

## AM-3 — the flow GLYPH row gets pictures

`FLOW_ICON_OPTS` currently passes `art: null` (six word-chips). Each option becomes the travelling
chip in miniature, carrying that option's own glyph. **`FLOW_ICON_PATHS` moves out of
`GoblinEdge.tsx` into a shared module (`src/flowIcons.tsx`)** so the edge renderer and the panel read
ONE vocabulary — AL-6's own note ("reuses `FLOW_ICON_PATHS`' own vocabulary rather than inventing a
second one") becomes structural instead of a comment.

## AM-4 — Speed gets a real illustration

A **live animated preview**: a miniature rail whose beads travel at the edge's ACTUAL current
duration, so the picture is the speed rather than a word for it. The five FLOW chips animate too
(the flow row is the other place a speed is felt). Both obey the existing reduce-motion gate
(`prefers-reduced-motion` + `.ds-no-anim`).

## AM-5 — Count smaller, and Count + Speed on ONE row, Speed as a SLIDER

* The `Stepper` stays 30px tall but becomes **compact (auto width)** instead of stretching a 253px
  panel row.
* `count` and `speed` share ONE row. Speed is an `<input type="range">` (styled from tokens, no new
  hex) over the SAME range the old chips covered (`flowDuration` 0.6…8s, today's four chips at
  4 / 2.4 / 1.4 / 0.8), inverted for the eye so dragging RIGHT is FASTER, with the numeric value
  printed. One history entry per gesture (`onPointerDown` of the slider pushes; the `input` events
  coalesce) — the same rule the resize slider already follows.
* `count`/`speed` stay gated on a payload flow (`dots`/`icon`) — AL-7 unchanged.

---

## Gates (must stay green)

`npx tsc --noEmit` = 0 · `node ./node_modules/vite/bin/vite.js build` = 0 · hex literals in
`src/styles.css` **must not rise above 160** (142 today — use an existing token, never a new hex) ·
every `checks/*.mjs` green, with the new ones run BY HAND and their negative control demonstrated
RED on `253a77e` · `boards/` untouched.
