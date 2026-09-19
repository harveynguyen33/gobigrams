# HANDOFF — Diagram Studio

**Last session:** 2026-09-19 (midday) · **Status:** PACKAGE-P **passes 1 and 2 shipped** (inspector: per-type
sections + icon pickers; then the Text section) and PACKAGE-Q shipped (panel hotkeys).
**Next: PACKAGE-P pass 3 — the collapse UI + `diagram-studio:inspector-sections` persistence.**

> **PACKAGE-P pass 2 — the Text section (§E).** `src/textStyle.ts` (NEW, React-free). `text` enters the goblin
> section list **BETWEEN `content` and `style`** — the omission pass 1 documented in its own header, now
> resolved. The label branch's 4-row `<textarea>` is **REMOVED**: it was a second writer for the same `text`
> the in-place editor writes, so the label target now has exactly **ONE** text editor.
>
> **`size` is a MULTIPLIER, not a px value** — decision, with reason: one node already paints FOUR sizes
> (kicker 10.5 / title 14.5 / sub 11.5 / metric 20), so the node's hierarchy IS the ladder. One px value would
> flatten all four and push the worst-case content (`queue`, 199×131, the number `NODE_MIN_H` derives from) past
> the resizer floor `round-r` asserts. So the control emits a multiplier, it lands as ONE custom property
> (`--ts-scale`), and every text rule multiplies its own size: one write, whole block, `var(--ts-scale, 1)`
> changes nothing when unset. Ladder `0.85 / 1 / 1.15 / 1.3`, `1` = Default = **not written**.
>
> **THREE defects found and fixed in this pass — all invisible to the harness as it stood.** 1 (double render,
> pass 1) and 2/3 below:
> - **A stored align that was never painted.** `textStyleVars` hard-coded `left` as "the value that renders
>   anyway", but align's default is **per-target** (`center` for `label-only`). Executed both pure functions
>   together: `label-only + Left` stored `{"align":"left"}` and returned `vars={}` — saved and dropped.
> - **The variable losing to a more specific rule.** `.node.label-only .lo-body` (specificity 0,3,0) beat
>   `.node .lo-body` (0,2,0) and pinned `text-align: center` **plus** `align-items: center`. Both are now the
>   variables with their old literals as fallbacks, in the ONE rule that owns the element. **No `!important`,
>   no specificity raise** — the duplicate was removed.
>
> Defects 2 and 3 are the **same bug class: one rule with two copies, one right and one guessing.** The harness
> missed both because it asserted *presence*, not *precedence*. It now carries a cross-check for every
> `(align default, choice)` pair and a **specificity sweep** over every `--ts-*` consumer that fails on the
> pre-fix tree. **See `references/verifying-token-driven-styles.md` in the diagram-studio skill** — the three
> traps, the geometry measurement, and the overlay/CDP probe hygiene that also cost time here.
>
> Orchestrator-verified live by clicking the real buttons and measuring where the text **lands** (span offset in
> its 186px block): untouched `35/35` centred → Left `14/57` hard left → Right `57/14` hard right → Center
> `35/35` and `--ts-align` returns to unset. Size XL `1.3` → title 18.85px / metric 26px; S `0.85` → 12.325/17;
> M → unset, 14.5px. Weight Bold → 700; Regular → unset, title back to its own 650 while the metric keeps its
> own 700. With the in-place editor focused and text typed, clicking size S left the editor **open** and the
> stored text **uncommitted** while the scale applied (§E.3(b) working).

> **PACKAGE-Q — panel hotkeys.** Group toggle `Cmd+Ctrl+Shift+\` (was `mod+Shift+\`); NEW per-side
> `Cmd+Ctrl+Shift+[` (left) and `Cmd+Ctrl+Shift+]` (right); both chevrons now show their key as a tooltip with
> `kbd` chips. **The measured trap:** all three chords carry Shift and **Shift mutates `e.key`** — `\`→`|`,
> `[`→`{`, `]`→`}` — so the branches match on `e.code` (the same fix `Shift+1`/`Shift+2` already use).
> **`mod` already meant meta-OR-ctrl**, so the old chord also fired on `Ctrl+Shift+\`; the new one requires the
> actual pair. Non-Mac mirrors to `Ctrl+Shift+…`. All **five surfaces** updated together (handler · 2 chevron
> tooltips · `?` sheet · Settings · README) — a mismatch between them was a shipped defect once. The
> overlay-tier tooltip advertises **no** chord (none opens an overlay).
>
> **PACKAGE-P pass 1** — `src/inspector.ts` (NEW, one pure decision function mirroring upstream's
> `shapeActionPredicates.ts`) + `src/InspectorPickers.tsx` (NEW). **All 12 `<select>`s converted; the app now
> renders ZERO native dropdowns** (upstream has 0 too). The inspector renders from the ordered section list;
> `group`/`note`/`actor`/`label-only` finally differ instead of all 19 shapes sharing one panel. Each section
> carries `data-section` / `data-collapsed-default` so pass 3 reads the truth table instead of re-deriving it.
> **The double-render fix (orchestrator-found, invisible to the 42/42 harness):** `secBody` both registered a
> body AND returned it, and all 11 call sites rendered that return value — so every section painted TWICE and
> Cardinality three times (one copy inside `flow`, one inside no section). `secBody` now registers only;
> `renderSections` is the ONE painter. `checks/package-p-render-check.mjs` was added because presence-only
> checks cannot see this class of defect.

> **ROUND V — nothing may paint outside a node box.** Two MEASURED defects, both fixed at the CONTENT level:
> a 43-char unbreakable word overflowed 259px RIGHT (`.node-title` is flex; the text span's `min-width:auto`
> == the longest word), and a Text node's sentence overflowed 65px BELOW (`.label-node` had only
> `min-height:100%`, a FILL rule). Fix = **`overflow-wrap: anywhere`** (the WRAP) + `overflow:hidden` as a belt.
> **`overflow:hidden` alone is NOT the fix** — measured, `break-word` + `overflow:hidden` is still 165px out
> because it clips MID-WORD and loses the text. The clip is INNER (`.label-text` / `.note-body` are new child
> boxes) because `.shape-frame` and the 4 connect dots sit ON `.node`'s border; `.label-node` also carries the
> 4 resize grips, so its root stays `overflow:visible` (negative-controlled). **`height:100%` on those inner
> boxes is load-bearing** — a clip on an auto-height box clips nothing vertically.
> Verified live: 0 overflow across 6 nodes, the long word wraps to 3 lines with `scrollWidth === clientWidth`
> (no character lost), 4 connect dots still 0px from the border, the 420×300 node unchanged, the label editor
> still opens focused and scrolls itself.
> **Known, NOT fixed (pre-existing):** `.tnode { overflow:hidden }` clips TableNode's per-column handles
> (8px, centred on the border → 4px sits outside). Table nodes are not resizable; recorded in the round's skill.
>
> **RESEARCH DONE for the next work — `diagram-studio-research/excalidraw/`** (`SYNTHESIS.md` + `X1`/`X2`/`X3`
> + `ORCH-FINDINGS-icons-and-collapse.md`), pinned at Excalidraw `c0ad61c`. **Three corrections that change
> decisions:** (1) Excalidraw's panel is **TOP-LEFT**, not right — our right panel is OUR divergence, not a
> copy; (2) **nothing is rendered near the text while editing** — the "buttons while typing" people remember are
> the ordinary panel, kept live because *editing counts as a selection*; so "controls while typing" = keep the
> panel mounted and target the editing node, **not new UI**; (3) font family has **3** buttons + a popover
> trigger, not 4. Also: **zero `<select>` in the whole panel** (icon pickers everywhere), and **no accordion
> exists** — the frequency-driven mechanism is `CompactShapeActions` ("collapsed, popover-driven layout").

> ⚠️ **THIS FILE HAS GIT.** The project became a git repo on 2026-09-18 — private
> `github.com/harveynguyen33/goblin-diagrams.git`, branch `main`. **`boards/` is gitignored**, so a
> clean `git status` is NOT evidence the board file was untouched — compare a hash before/after instead.
> Older sections below still say "no git"; that is historical, ignore it.

## ▶ START HERE (new session)

**Read this file top-down for the round you need; each `### ▶ ROUND …` section is self-contained.**
Working dir `/home/harvey/projects/tech-goblin/lab/diagram-studio`, dev server `http://192.168.33.200:5200/`.

**Gates that must stay green (last verified 2026-09-18 evening):**
`npx tsc --noEmit` = 0 · `node ./node_modules/vite/bin/vite.js build` = 0 · hex literals in `src/styles.css` = **127**
(must not rise — use an existing CSS variable, never a new hex).

**Harnesses: 9 files in `checks/*.mjs`, run each by path (there is no npm runner).**
**`checks/package-q-reconnect-endpoints.mjs` FAILS 2 assertions (node positions + edge ids) and has done for a
while** — it hard-codes an old 3-node board fixture while the live board is Harvey's 7-node working board.
Proved pre-existing by stashing the change and re-running; **do not "fix" the harness to hide it.** Every other
harness is green.

**IMPORTANT — the live board is Harvey's working canvas.** The app autosaves and there is only ONE board file
until more exist, so **a second tab's autosave overwrites his state.** Before probing: `ss -tn | grep ':5200'`
client connection + `stat -c %y boards/*.json`. If he is in the app, **verify on a throwaway board instead**
(`POST /api/boards` → seed with `type:"goblin"` → `localStorage['diagram-studio:last-board']=<id>` → reload →
`DELETE /api/boards/<id>`), and never copy a baseline over his board while he is editing.
**Unmount the tab (`goto_url('about:blank')`) before any restore, or autosave undoes you.**

### Shipped this session (pushed)

- **`e1397c0` — a draw.io-style draggable midpoint on step / smoothstep edges** (edge-reshaping STEP 2).
  `src/edgeBend.ts` (NEW, pure maths: the generator's routing facts, the gate, the drag patch, and a
  hand-built path for the collapsed-bar case). `getSmoothStepPath`'s centre is consulted ONLY in its
  opposite-handle branch, so a stored point elsewhere is a place the line never goes (`effectiveMid`).
  The one-axis rule is the point: `bendAxis` reads the split the generator ACTUALLY uses, so the drag writes
  the coordinate it reads. Persisted as `data.bendX` / `data.bendY` — the owned axis ONLY (`applyDrag` also
  drops the superseded `bend` fraction and the other axis's stale key, so a later node move cannot promote a
  stale value into the one the generator reads). ONE history entry per gesture (`onBend` 'start'),
  `onReconnect` clears all three keys. `checks/round-s-edge-bend.mjs` (NEW, all green) incl. a 400-geometry
  parity sweep proving an untouched board renders byte-identical.
- **`6bb65c2` — reveal the bend handle only on the SELECTED edge** (orchestrator correction). The first cut
  showed a fully-opaque handle on EVERY step/smoothstep edge at once — measured: a two-orange-dot board at
  rest, each dot exactly ON its edge's label, because the handle is painted at the path's
  `labelX`/`labelY`, which IS the label's anchor. draw.io and Excalidraw both gate on selection, and so did
  the approved spec. `selected` is React Flow's own flag: the click that selects reveals the handle.
- **`2644477` — bend-position slider for step/smoothstep edges** (edge-reshaping STEP 1).
  `GoblinEdge` passes `stepPosition` from `data.bend` (absent → `undefined` → RF's 0.5, so old boards render
  unchanged). The inspector slider is **disabled with an honest reason** when the parameter would be silently
  ignored: honoured only when the target handle is the OPPOSITE side AND the source handle's out-direction agrees
  with `getDirection(source→target)` on the primary axis (verified over 9,600 geometries, 0 counterexamples).
  The app's canonical Right→Left flow IS active; Left→Right, same-side and vertical pairs are not. Also disabled
  for bezier/straight. A drag records ONE undo entry (via a new additive `coalesce` option on `updateEdge`).
  **Measured later: on a LEVEL pair this control is inert (0.000px) — see the note at the top of this file.**
- **`1cfc888` — stop the label-position and colour controls destroying sibling edge data.** Both passed
  `replaceData=true`, which replaced the WHOLE `data` object; changing label position took
  `{shape, offset, flow, flowCount, flowDuration, strokeKey, bend}` down to `{offset}`. Both patches are
  single-key by construction, so they now take the merge default. Verified live on a throwaway board.

### NEXT

**PACKAGE-P pass 2 — the Text section (size / weight / colour / align) + the §E.3 editing behaviours.**
Then pass 3 (the collapse UI + `diagram-studio:inspector-sections` persistence). **Harvey reviews between
passes.** The spec of record is `PACKAGE-P-SPEC.md` §E; pass 1 shipped §A/§B/§D (see the top of this file).

**Pass 2 must also do the one thing pass 1 deliberately left OUT** (and said so in `src/inspector.ts`):
`getInspectorSections` does **not** return a `text` section for a goblin yet, because the render layer cannot
paint it — returning an id the panel cannot draw would make the decision function disagree with the panel.
Pass 2 inserts `text` BETWEEN `content` and `style` in that one array, in the same pass that adds its body.

**Pass 2's other load-bearing item:** the panel's label `<textarea>` (`App.tsx:~4523`) is a **second writer**
for the same `text` the in-place `LabelNode` editor writes. The spec removes it — but ONLY in the same pass that
adds its replacement (§E.3.1). Do not remove it alone.

**Harvey re-tests:** click a node of each kind and confirm the panel differs per shape (`group` has no
kicker/metric, `note` has no metric/icon); the 12 dropdowns are now icon pickers; the chevrons show
`Cmd+Ctrl+Shift+[` / `]` on hover; and the three hotkeys toggle left / right / both.

**Known debt, unchanged:** `checks/package-q-reconnect-endpoints.mjs` reports **15** failures — 11 assert the
endpoint disc the user asked to delete in ROUND T, 2 are its old fixture failures, and 2 more are its
board-fixture assertions against the user's LIVE board (which he has been editing: it is now 9 nodes / 4 edges,
not the 3/2 the harness hard-codes). It is left as the record; **do not "fix" a harness to hide a real change.**

**Vault debt:** edge reshaping — ROUND S, T and U are NOT yet in ADR-031 / Change Log. Batch via pkm.
`checks/round-s-edge-bend.mjs` covers (a)–(o).
**Stale harness:** `checks/package-q-reconnect-endpoints.mjs` FAILS 13 (was 2): 11 assertions require the
endpoint disc to be PAINTED, which ROUND T was explicitly asked to remove. Left as the record — do not "fix".

## ✅ PACKAGE-Q 2026-09-19 — panel hotkeys (rebound group chord, per-side toggles, chevron tooltips)
## ✅ PACKAGE-P pass 1 2026-09-19 — per-type sections + icon pickers (12 selects converted)
## ✅ ROUND V 2026-09-19 — nothing may paint outside a node box
## ✅ ROUND U 2026-09-18 — midpoint drag on bezier + straight (free 2-D)
## ✅ ROUND T 2026-09-18 — 2-D midpoint drag, slider removed, endpoint circle unpainted
## ✅ ROUND S 2026-09-18 — draw.io-style draggable midpoint on the selected edge
## ✅ ROUND Q 2026-09-18 — edge endpoints draggable (reconnect)
## ✅ ROUND P 2026-09-18 — reload flicker, boot flash, checklist toast
## ✅ ROUND O 2026-09-17/18 — 2 borders, node toolbar removed, helper width, shape hints, sidebar badge, board dialog
## ✅ ROUND N 2026-09-17 — click dead band, legend removed, alignment-guide proximity gate
## ✅ Earlier: PACKAGE N (palette), M/M3 (settings+themes), L (multi-diagram types), H/I/J/K (onboarding+fixes)

---

## ✅ REVIEW PASS 2026-09-16 — phantom page scroll in compact tiers — FIXED + orchestrator-verified

**Defect:** in the compact tiers the side panels sit at `transform: translateY(101%)` /
`translateX(±323px)` when closed — off-screen but still in the document. Nothing clipped them, so the
page grew a real scroll range the user could drag into (on a real iPhone: the page slides up and the
URL bar misbehaves). `body { overflow: hidden }` did NOT contain it — the range propagates to `html`,
and `.app-host` / `.app` both computed `overflow: visible`.

**Measured baseline (before) → after, real Chrome + `Emulation.setDeviceMetricsOverride` + reload:**

| viewport | tier | before | after |
|---|---|---|---|
| 768×1024 | tablet portrait | 323px **horizontal** (`scrollTo` → `scrollX 323`) | 0 / 0 |
| 360×740 | phone portrait | 433px **vertical** (`scrollY 433`) | 0 / 0 |
| 932×430 | phone landscape | 252px **vertical** (`scrollY 252`) | 0 / 0 |
| 1280×800 · 1920×1080 | desktop | 0 | 0 |

**Fix:** `src/styles.css` — ONE rule, `.app-host { overflow: clip; }` (line ~377, M3 section).
`clip` (not `hidden`) because it removes the scroll range WITHOUT becoming a scroll container —
`.app-host` is the embeddable boundary, so it must never become programmatically scrollable.
`.app-host` IS the correct element: it is the container that owns the absolutely-positioned panels.

**Independently re-verified by the orchestrator (not the coder's word):** `tsc --noEmit` = 0,
`vite build` = 0; all five viewports 0 overflow + `scrollTo` returns 0; boards dropdown 100 % visible
area at 360/768/1280; help popover 100 %; panel drawers/sheets still slide fully on screen at
`opacity: 1`; tour overlay still full-viewport (360×740, `z-index 10000`, spotlight none needed) with
0 document overflow; demo board unchanged (3n/2e, preset `architecture`, both edges `dots`, no `theme`
key, positions `-53,298 / 324,290 / 704,290`).

### ⚠️ NEW DEFECT FOUND (reported by the coder child, reproduced by the orchestrator) — Settings modal cut on phone

`.settings-modal` is **672px wide on a 360px viewport → 336px (50 %) off-screen**, and there is NO
scroll container that can reveal it (`overlay scrollLeft` stays 0; `.settings-modal` is
`overflow: hidden`). Affects **phone-portrait only** — phone-landscape 932, tablet-portrait 768,
tablet-landscape 1024 and desktop 1280 all measure `cut: 0`.

**Root cause (measured):** `.settings-overlay` is `display: grid; place-items: center` with an
**implicit column track sized by the modal's fixed `width: 720px`**. The track resolves to `720px`,
so the modal's `max-width: calc(100% - 48px)` computes against that **720px track, not the 360px
overlay** → `672px`. The percentage is resolving against the wrong containing block.

**Pre-existing, NOT caused by the clip** — proven by disabling the new rule in the live stylesheet and
re-measuring: identical `672px / cut 336` both ways.

### ✅ FIXED 2026-09-16 — Settings dialog now has one layout per tier

**Defect (fixed):** `.settings-modal` was 672px on a 360px viewport → 336px (50 %) off-screen, no scroll
container able to reveal it. Root cause: `.settings-overlay` is `display: grid; place-items: center`
with an implicit auto column track sized by the modal's fixed `width: 720px`, so the modal's
`max-width: calc(100% - 48px)` resolved against that **cyclic 720px track instead of the overlay**.

**Fix — `src/styles.css` only, scoped on the EXISTING tier attributes (no new props, no new breakpoint):**

| Tier | Layout |
|---|---|
| desktop ≥1229 | **unchanged** — centred 720×460 modal, 190px vertical nav |
| tablet portrait | overlay `display: block; padding: 24px`; modal `100%/100%`; nav → **horizontal tab strip on top**, search pushed right |
| phone ≤599 | full-bleed sheet (no radius/border); tab strip **scrolls horizontally**; rows **stack** (label above control); theme cards **2 columns** |

The `display: block` + container padding + 100 % child is deliberate: it removes the
percentage-against-auto-track dependency that was the bug. `grid-template-columns: minmax(0,1fr)`
alone does NOT fix it.

**Orchestrator-verified (own measurements, not the coder's report):**

| viewport | modal | cutRight | cutBottom | nav dir | nav scroll | doc overflow |
|---|---|---|---|---|---|---|
| 360×740 | 360×740 | **0** | **0** | column→row list | 567/340 ✅ | 0/0 |
| 932×430 | 932×430 | **0** | **0** | column→row list | fits (912/912) | 0/0 |
| 768×1024 | 720×976 | **0** | **0** | **row** ✅ | 559/504 ✅ | 0/0 |
| 1024×768 | 672×460 | **0** | **0** | column (unchanged) | — | 0/0 |
| 1280×800 | 712×460 | **0** | **0** | column (unchanged) | — | 0/0 |

Functional: all 5 nav tabs switch the pane + heading at 360/768/1280; Esc closes at every tier;
backdrop + close button close; theme key `dark` persisted across reload (then restored to its
original `null`); Canvas toggle flipped `true→false→true`; desktop panels intact (232/288, opacity 1);
`tsc --noEmit` = 0, `vite build` = 0; demo board unchanged (3n/2e, preset `architecture`, both edges
`dots`, no `theme` key, positions `-53,298 / 324,290 / 704,290`).

**Follow-up bug found + fixed in the same pass (flagged by the coder, reproduced by the orchestrator):**
the close button is a child of `.settings-main` (now full modal width), so at the compact tiers it sat
ON TOP of the full-width search field — **measured 576 px² overlap at 360, 585 px² at 768** (the
coder's mockup had shown the same collision). It won hit-testing so it worked, but the field read as
broken. Fixed by reserving the button's own width out of the search
(`.settings-search { width: calc(100% - 34px) }` on phone, `margin-right: 34px` on tablet-portrait)
→ **overlap 0 at 360, 932 and 768**, search still focusable and usable.

**Mockup (approved design):** `/home/harvey/diagram-studio-research/mockup-settings-tiers.html`.

## ✅ PACKAGE-M3 — COMPLETE (steps 1, 2, 2b, 2c, 2d, 2e, 3, 4, 5) — orchestrator-verified


| Step | What | Status |
|---|---|---|
| 1 | `useEditorInterface()` — container-driven breakpoints | ✅ verified |
| 2 | desktop panel collapse + persistence | ✅ verified |
| 2b | second shortcut + stuck-state bug removed | ✅ verified |
| 2c | panel toggle desync (chevron vs shortcut) fixed | ✅ verified |
| 2d | inspector auto-hide removed + chevron tooltip removed | ✅ verified |
| 2e | empty right panel after a one-sided collapse fixed | ✅ verified |
| 3 | touch hardening | ✅ verified |
| 4 | tablet tier (docked landscape / drawers portrait) | ✅ verified |
| 5 | phone tier (bottom bar + bottom sheets + dvh/safe-area) | ✅ verified |

**The panel state is now ONE flag per side.** `PanelState = {collapsed: {left, right}}` under the
`diagram-studio:panels` key — nothing else. `uiHidden` (step 2b) and `pinned` (step 2d) were DELETED
along with the behaviours they served; `parsePanelState` still tolerates a legacy value carrying either
key without throwing. Two independent flags that can each mean "hidden" produce a toggle that sticks —
that was 2b, and it is why 2d removed `pinned` the moment its override target (the C4 auto-hide) went.
Settings / cheat sheet / README each carry ONE row: `⌘/Ctrl ⇧ \`.
Verified: 4 consecutive presses toggle correctly; bare `⌘\` does nothing; manual collapse survives
node select/deselect/re-select.

**Step 2 affordances:** chevron on each panel edge + `⌘⇧\` / `Ctrl+Shift+\` (toggle the panel group).
No double-click-on-divider. The collapse reuses the EXISTING
`.app { transition: grid-template-columns .22s ease }` — no second transition mechanism and
no second `grid-template-columns` writer. Tokens only; control-kit styling (7px radius,
`appearance:none`, `--acc` + 3px `--acc-soft` focus ring).

**Measured (live, 1280×577 window):** left collapse 1048→1280px canvas; right manual collapse
1048→1280px; all states survive reload. Breakpoints verified by resizing
the `.app-host` element with `window.innerWidth` held at 1280. `tsc --noEmit` = 0, `vite build` = 0.
*(Historical: step 2 originally also had a C4 "pin open" 1048→760px state — removed in step 2d.)*

## ✅ Step 3 — touch hardening (`src/touch.ts` NEW)
`LONG_PRESS_MS = 500` (Excalidraw `TOUCH_CTX_MENU_TIMEOUT` + tldraw `longPressDurationMs`),
`COARSE_DRAG_THRESHOLD_PX = 6`, `HANDLE_SIZE_COARSE_PX = 20`, `useLongPress`.
- Long-press 500 ms opens the context menu on a coarse pointer; a SECOND pointer disarms the gesture
  entirely (a first attempt cancelled only the timer and the pinch still opened the menu — real bug,
  caught by measuring).
- **One-finger pan on empty canvas; box-select is mouse-only on touch.** This is forced by React Flow:
  its Pane early-returns for `pointerType === 'touch'` when `panOnDrag !== false`
  (`dist/esm/index.js:1481`), so both cannot coexist. Mouse behaviour is unchanged.
- `nodeDragThreshold` / `connectionDragThreshold` = 1 fine / 6 coarse (read off the live fibre props).
- Handles 14px → **20px** on coarse, plus a 5px transparent `::after` hit ring (~33px tap target).
  `.tbtn-icon` and `.panel-toggle` → **44×44**.
- **Hover rules were GATED, not deleted** — the reveal rules moved inside `@media (hover: hover)`;
  an `@media (hover: none)` block supplies a selection-driven alternative. All 61 `:hover` rules intact.
- `zoomOnDoubleClick` stays `false` (double-tap is the app's insert palette).
- **View-only first touch was NOT implemented** — the app already has an 8-step Tour + a 6-task
  checklist covering 100 % of the canvas; a third onboarding wall is noise. Revisit with the Tour work.

## ✅ Step 4 — tablet tier
- Landscape (e.g. 1024×768): 3-column grid, inspector docked, palette collapsible.
- Portrait (e.g. 768×1024): both panels become **sliding drawers** (320px), scrim overlay, close on
  backdrop click AND `Escape`. Drawer state is LOCAL component state — **never written to
  `diagram-studio:panels`** (a dismissed drawer is not a collapsed panel).
- Motion gate honoured: `prefers-reduced-motion: reduce` and `.ds-no-anim` both kill the transition.

## ✅ Step 5 — phone tier
- Toolbar moves to the **BOTTOM** (measured `bottom == innerHeight`, gap 0; top left 14px).
  Landscape phone 932×430 is treated as `phone`, not tablet.
- Palette / inspector become **bottom sheets** (58 % of viewport height) with a grab handle.
- `dvh` not `vh` (built CSS: `100dvh` present, **zero** `vh` occurrences);
  `padding-bottom: env(safe-area-inset-bottom, 0px)`; `viewport-fit=cover` added to `index.html`.
- Designed at 360px: `scrollWidth == clientWidth`, nothing clipped. The bar WRAPS rather than
  scrolling sideways (an `overflow-x:auto` first measured 176px of tools hidden behind an
  undiscoverable swipe).
- `--toolbar-h` is MEASURED (ResizeObserver) and published as an inline custom property — the bar is
  103px at 360 and 57px at 932, so no constant is correct at both.

**Bugs found by measuring and fixed (would have shipped silently):** `.canvas-wrap` fell into the 0px
middle grid track once panels went absolute (toolbar measured 12px wide) → `grid-area: 1 / 1 / 2 / -1`;
`.app.right-hidden .panel.right{opacity:0}` out-specified the tier rules so a phone inspector sheet
slid in invisible → tier-scoped `opacity:1`; the motion gate lost its specificity fight → `!important`.

## Verification method that worked (for the next session)
Container resizes can be done by setting `.app-host` width/height **with a frame wait** (ResizeObserver
is async — a synchronous read shows the stale value). Device tiers need
`Emulation.setDeviceMetricsOverride` **+ a reload**. `(hover: hover)` cannot be toggled at runtime in
this headless build — each hover mode needs its own Chrome launch (`--blink-settings`).


## How the M3 foundation works (current, post-2d — the block below is NOT stale history)

**`src/useEditorInterface.ts`** — reports `{formFactor, isTouchScreen, isLandscape, canFitSidebar}`
off a **ResizeObserver on the editor container**, not the window (the tool is meant to be embeddable;
Excalidraw measures `container.getBoundingClientRect()`, tldraw has `forceMobile`). Breakpoints:
phone ≤599 OR (h<500 && w<1000); tablet min-edge≥600 && max-edge≤1180; desktop otherwise.
`isTouchScreen` = `matchMedia('(pointer: coarse)')` with a `maxTouchPoints` fallback.

**CANONICAL 3-COLUMN THRESHOLD = 1229 (DECISION, was 1280).**
`styles.css` had `@media (max-width: 1279.98px)`; that and 1229 meant the same thing, so there were
two numbers for one rule. Replaced with `@media (max-width: 1228.98px)` — the 0.02px-staggered
complement of "≥ 1229", which is Excalidraw's `MQ_RIGHT_SIDEBAR_MIN_WIDTH`. One number, two runtimes:
the media query in CSS and `dockedSidebarBreakpoint` in `useEditorInterface.ts` (which additionally
gates the collapse affordances on the measured CONTAINER). **Never add a third number for this rule.**

**`src/panelCollapse.ts`** — ONE durable flag per side: `collapsed[left|right]`, under ONE namespaced
key `diagram-studio:panels` (Excalidraw's `desktopUIMode` precedent), every access in `try/catch`.
`isPanelHidden(state, side)` returns `state.collapsed[side]` and nothing else. The hook exposes exactly
`{state, togglePanel, setPanelsVisible}` — `setPanelsVisible` is the shortcut's ONE atomic write.
**The two panels are SYMMETRIC**: `rightHidden` is built the same way as `leftHidden`, because the
inspector's selection-driven auto-hide (and the `pinned` override it needed) was removed in step 2d.

**Step 2 affordances:** chevron on each panel edge + `⌘⇧\` / `Ctrl+Shift+\` (toggle the panel group,
atomic and driven by the VISIBLE state). No double-click-on-divider, and NO tooltip on the chevron.
The collapse reuses the EXISTING `.app { transition: grid-template-columns .22s ease }` — no second
transition mechanism and no second `grid-template-columns` writer. Tokens only; control-kit styling
(7px radius, `appearance:none`, `--acc` + 3px `--acc-soft` focus ring).

**Measured (live, 1280×577 window):** with nothing selected the inspector stays DOCKED
(`232px 760px 288px`, symmetric with the palette); collapsing one side alone keeps the OTHER panel's
content visible (`.panel:not(.right)` — see step 2e); select → deselect does not move the layout;
`⌘⇧\` alternates both-collapsed (`0px 1280px 0px`) / both-visible on every press. Breakpoints verified
by resizing the `.app-host` element with `window.innerWidth` held at 1280. `tsc` = 0, `vite build` = 0.

## ▶ NEXT SESSION: START HERE — PACKAGE N passes 1/2a/2b/3/2c are DONE; pass 4 + 5 remain

**Spec of record: `PACKAGE-N-SPEC.md` — read it before touching the palette.** It now has THREE
revisions; Revision 3 is the current design and SUPERSEDES parts of 1/v2 (read §4.1, §5, §2.6, §12, §13).

### What PACKAGE N shipped (all orchestrator-verified: `tsc=0`, `vite build=0`, live DOM measured)

| Pass | What | State |
|---|---|---|
| 1 | `PaletteItem` gained REQUIRED `category` + `types[]` (+ optional `aliases`, `geometry`) on all 34 elements; 4 element renames (`Terminal`, `Predefined process`, `Manual operation`, `On-page connector`) in BOTH `presets.ts` and `shapes.tsx`, old word kept in `hint`; 2 preset-label renames (`erd`→**Data model**, `custom`→**Mixed**; the **ids are unchanged**, boards are safe). Also collapsed the duplicate `Note` `make()` bodies into ONE (the architecture site had `sub:'annotation'`, the other two `''`) → the library is exactly **34** distinct elements. | ✅ done |
| 2a | ONE `LIBRARY` (34) + `libraryFor(id)` in `src/presets.ts`. `palette.ts` deliberately holds only the TYPES — putting the library there would import `C4Type` from presets and create a cycle. Verified the derived per-preset palettes are **label-for-label identical** to the old hand-written ones. | ✅ done |
| 2b | The panel renders the ONE library; `src/categoryState.ts` (NEW) persists category folding under **`diagram-studio:categories`**; **insert became IDENTITY-KEYED** — the drag payload and `SearchPalette.onInsert` now carry the item **label** and resolve through `addNodeByLabel(label, pos)` (`LIBRARY.find`). This replaced an INDEX-based path that would have silently inserted the WRONG shape once the panel could filter (verified: filter C4 + row 5 → correct `Container: database` node). | ✅ done |
| 3 | Favourites (§6) + `/api/library` (§7) + **the atomic-write bug fix**. `Favourite = {id, name?, created, nodes, edges}` storing the **result of `make()`** with a `__label` marker and a symbolic `colorKey` (so a theme switch recolours it). Store = `boards/library.json` singleton, atomic temp+`renameSync`, ONE `.bak` generation, tolerant read, `version` migration-on-read. **The existing `writeFileSync` truncate-first bug is FIXED at BOTH boards call sites (POST create + PUT save)** via `writeJsonAtomic`. Verified: PUT leaves no `.tmp`, `.bak` is exactly one generation behind, star toggle round-trips. | ✅ done |
| 2c | **Revision 3 — the type chips and the per-row badges were REMOVED and a SEARCH field added.** Measured reason: 33 of the 34 elements belong to exactly ONE type, so the badge just restated the row's category and the 6-chip row cost 77px / 3 wrapped rows. `types[]` STAYS in the data — only the rendering went. Panel = **search → Favourites → 8 collapsible categories**, all 8 always present (sum 34). Search matches `label`+`hint`+`aliases`+`geometry`; a hit in a COLLAPSED category renders **dimmed (opacity .45), never hidden**. Verified: `0` chips, `0` badges, `init`→Preparation, `cyl`→Database, `diamond`→Decision, `subproc`→Predefined process, gibberish→0 rows. | ✅ done |
| 4a | **Custom-shape sanitise pipeline (spec §8.1–§8.3).** NEW `src/customShape.ts` (513 lines): `CustomShape` type, `sanitizeSvgMarkup` (size cap → XML parse → single root `<svg>` → positive `viewBox` → declared size → **DOMPurify SVG profile** + fragment scrub → root rewrite → `XMLSerializer`), `svgDataUri`, DOM-free `quantisePx`/`clampShapeSize`/`defaultShapeSize`, `newCustomShape`, `parseCustomShapeEntry` (untrusted-on-read). `src/library.ts` type-aligned: `shapes: Record<string, unknown>[]` → `shapes: CustomShape[]` (2 lines + 1 import, no behaviour change). `dompurify@3.4.15` added to `package.json` (Harvey-approved runtime dep). **No import UI yet — that is pass 4b.** | ✅ done |
| 4b | **Custom-shape node kind + library plumbing.** NEW `src/CustomShapeNode.tsx` — the import is a NODE KIND, not a shape: the `Shape` union stays at **19** and `customshape` is registered in `nodeTypes` beside `goblin` / `label` / `table`. The markup is NEVER handed to the DOM as HTML — it reaches the canvas ONLY as `<img src={svgDataUri(d.svg)}>`, with `src/customShape.ts`'s DOMPurify scrub as the first guard and the `data:image/svg+xml,` context (scripts disabled, external resources unable to load) as the second, independent one. No `ShapeFrame` (the user's SVG *is* the artwork; a frame would show through any transparent area) and no connection handles. `src/library.ts` carries the `shapes` write path to `/api/library`, re-validated through `parseCustomShapeEntry` on every read. | ✅ done |
| 4c | **Import UI + panel section + error surfaces.** The left panel gained the import affordance (file picker + drop-on-panel), the custom-shape tiles (click or drag to place, `×` to remove) and `newCustomShape`'s `SvgRejectReason` as user-facing text — the §8.1 table: not an `.svg`, over 512 KB, no viewBox, no size / bad size, each message naming the fix ("Re-export it with a viewBox and a size"). **See the measured record below — this pass found and fixed a real persistence race.** | ✅ done |

### PACKAGE N pass 4a — orchestrator verification record (2026-09-17)

`npx tsc --noEmit` = **0** · `npx vite build` = **0** (2084 modules, 2.58 s) — both re-run by the
ORCHESTRATOR, not taken from the coder's report.

Browser probe of the REAL module (imported `/src/customShape.ts` through the running Vite server, 43
assertions, **42 pass / 1 fail**):

- **Rejection branches all correct**: `too-large` (>512 KiB, checked before parsing), `not-xml`,
  `no-root-svg`, `no-viewbox`, `bad-viewbox` (`0 0 0 0`), `no-size`, `bad-size` (`width="0"`).
- **AC #23 hostile SVG** — a single SVG carrying `<style>`, `<script>`, `<foreignObject>`, `<use>`,
  `<animate>`, two `on*=` handlers, a remote `<image href="http://…">`, a remote `xlink:href` and a
  `javascript:` scheme: **accepted**, and the stored markup contains NONE of them, while the harmless
  `<rect>` and the same-document `url(#grad)` fragment **survive**. Root came back with no
  `width`/`height` and `preserveAspectRatio="xMidYMid meet"`.
- **AC #22** `newCustomShape(width="0")` → rejected `bad-size`. **AC #24** source carries zero
  `innerHTML`/`dangerouslySetInnerHTML` (`<img src={svgDataUri(shape.data)}>` is the documented path).
- **`parseCustomShapeEntry`** re-clamps `w`/`h` 4096 → **512**, refuses hostile `data`, a bad
  `colorKey`, `aspect:'free'`, `null` and an array.
- **1 FAIL — AC #21, which is a SPEC defect, not a code defect.** The spec said an import declaring
  `width="4096"` stores `512`; the code stores **64×64** (the §8.3-row-4 default box, ratio-scaled and
  quantised). §8.3 row 4 is the authority: the declared size is a VALIDITY gate, never the stored
  geometry. **Both spec texts amended in place** (§8.3 amendment table + AC #21 rewrite) with the
  measured numbers rather than "fixing" working code.

**TWO spec defects found and amended this pass** (both surfaced as the coder's flagged judgement calls
and reproduced independently by the orchestrator):

1. §8.3 row 3's literal unit formula `clamp(round(px/grid),2,32)*grid` contradicts rows 1–2 at every
   pitch except 16 (pitch 8 → a 16 px floor, below the 32 px minimum; pitches 20/32/64 → ceilings of
   640/1024/2048 px, above the 512 px maximum). Resolution adopted: the unit window is the
   **intersection** of `[2,32]` units with each pitch's own px bounds — identical to the literal
   formula at pitch 16, and honouring 32–512 px at all five offered pitches.
2. AC #21 vs §8.3 row 4 (above).

### PACKAGE N pass 4c — measured verification record (2026-09-17)

**BUG FOUND + FIXED in 4c verification (measured):** the import path persisted the PREVIOUS list.
`persistLibrary` read `shapesRef.current` after a `setTimeout(0)`; the import resumes from
`await file.text()` as a microtask, so the timer (macrotask) fired FIRST — measured put at **+2 ms
carrying the pre-import list** vs the DOM committing at **+27 ms**. Visible effect: the server library
was permanently one import behind the panel (panel 4 / server 3) and a reload silently dropped the
newest shape. **Fix:** `persistLibrary` now takes BOTH lists as arguments, and
`mutateFavourites` / `mutateShapes` advance their ref SYNCHRONOUSLY before `setState` and pass the
computed list. **Re-verified:** 3 sequential imports → panel === server at every step, and the set
survives a reload.

Other facts verified in 4c:

- **Hostile SVG import** (`<script>`, `<style>`, `onload=`, `onmouseover=`, `<foreignObject>`) stores
  **none** of them, while the harmless `<rect>` / `<circle>` survive.
- A **hand-edited `library.json`** carrying a `<script>` entry or a bad `colorKey` / `aspect` is
  **dropped on read** (server 4 entries → panel 2).
- The sanitised markup reaches the canvas ONLY as `<img src="data:image/svg+xml,…">` — measured: no
  live `<svg>` / `<rect>` in the node.

## ▶ FEEDBACK ROUND 2026-09-17 — Harvey's 4 items (ALL DONE + orchestrator-verified)

Harvey used the app and reported 4 things. All shipped; `tsc=0` · `vite build=0` at every step.

| # | Item | What shipped | Measured evidence |
|---|---|---|---|
| 2 | "sidebar guideline text, bỏ qua" | The sidebar `.hint` block REMOVED. It carried **3 rows that existed nowhere else** (click an edge to edit · ⌘/Ctrl+click multi-select · drag to connect) — those were moved into the `?` sheet, Settings → Shortcuts AND the README FIRST, then the block went. `.hint` still lives in the inspector (verified: 1 element on node select). | `?` sheet now 13 rows / 17 chips / 5 gestures, 0 gesture rendered as a chip |
| 3 | "swatch có lớp background trắng" | `.pal-swatch` `background: var(--surface)` → `transparent`; also `.sp-item.on .pal-swatch` (the insert modal painted it DARKER on hover). Root cause: in the **light** theme `--surface` is `#ffffff`, so the swatch was a white chip on the `--elevated` row — card-on-card. | every swatch computes `rgba(0,0,0,0)`; row unchanged at `rgb(26,27,31)` |
| 1a | "remove Diagram type picker" | All **3** UI entry points removed (chip bar + New-board prompt + board-menu item), plus the now-orphaned `pLabelOf`, `PRESET_SWITCH_WARNING`, `PRESET_IDS` and `Network` imports; `.preset-bar`/`.pchip` CSS deleted (31 lines). `BoardDoc.preset` **stays as data** — it still drives edge defaults, auto-layout, ERD Table nodes, C4 legend, inspector note and handle orientation. A NEW board defaults to **`Mixed`**; old boards keep their stored preset invisibly. | `preset-bar\|pb-lbl` = 0 in both files; `Diagram type` = 0 in App.tsx; `const pid: PresetId = 'custom'`; badge still renders `Architecture` |
| 4 | "connection points per shape like draw.io" | **8 points per node** (4 midpoints + 4 corners), all revealed together on hover/selection; corners 8px vs midpoints 12px, no glow; `connectionMode={ConnectionMode.Loose}`; the `ports` dropdown REMOVED. ERD/TableNode handles untouched. | 16 `<Handle>` elements over 8 sites; spread over 5 distinct X × 5 distinct Y; all 16 at opacity 1 when selected; **existing edge paths byte-identical**; a real drag from a corner created an edge that stored `sourceHandle:'bottom-right'` |

### ⚠️ A PACKAGE-N PARITY BUG found while scoping item 1 (fixed in the same round)

PACKAGE N moved the LEFT PANEL to the one 34-element `LIBRARY` but **left `SearchPalette` reading
`items={preset.palette}`** (`App.tsx` ~3276). Measured live on an `erd` board: the double-click insert
modal offered **2** shapes and typing `Note` returned only `Note (enum)` — the generic `Note` was
unreachable — while the panel searched all 34. Fixed to `items={LIBRARY}` (spec §9: *search runs over
the WHOLE library*). Now measured: 34 rows on an `architecture` board, and `Database` returns both
`Database` and `Container: database`.

### The handle work was split in two ON PURPOSE (pass B1 → B2)

React Flow resolves an endpoint with `getHandle(bounds, null) → bounds[0]` — the FIRST handle in DOM
order. Every stored edge had `sourceHandle: null`, so adding a second handle of the same type would
have **moved every existing edge silently**. So B1 gave the current handles explicit ids + a migration
(`migrateEdgeEnds`, resolving a missing endpoint from the connected node's own `data.handles`) and was
verified **provably inert** — the edge `d` attributes were byte-identical before/after, and a test board
proved the migration actually persists (`sourceHandle:'right'`, `targetHandle:'left'`). Only then did B2
add the other 6 points.

### Probe honesty note

My own browser probe **mutated the demo board twice** this round (double-clicking the canvas opened the
insert modal and flipped the board's preset to `erd`; another drag added a probe edge). Both times I
detected it, unmounted the tab FIRST (`about:blank`, so autosave could not rewrite the restore), restored
the file and verified stability. The lesson — unmount before restoring — is recorded in the project skill.

### ▶ FEEDBACK FIX C 2026-09-17 — connection points ugly / jittery / covering the resize grips

Harvey: *"mấy cái nút để kéo connection line xấu quá và bị giật giật… các connect che đi 4 điểm kéo co
giãn shape. Điểm co giãn cũng khó kéo thấy."* **Three defects, three measured root causes — all mine
(the B2 design), all fixed.** `tsc=0` · `vite build=0`; styles.css literal-colour count **183 → 183**.

| # | Root cause (measured) | Fix |
|---|---|---|
| **JITTER** | React Flow centres every handle with a per-side `transform`: `-right` = `translate(50%,-50%)`, `-left`/`-top` = `translate(-50%,-50%)`, `-bottom` = `translate(-50%,50%)`. Our hover rule set a **bare `transform: scale(1.35)`**, which REPLACES the translate — so the dot jumped half its own size the moment the pointer touched it and jumped back on exit. | Each hover value now **restates that side's own translate and appends the scale** (4 rules, one per side). Measured: `-right` computes `matrix(1,0,0,1,7,-7)` — translate intact. The hover ring is now `box-shadow` (paint-only, takes no part in hit-testing) instead of a geometry change. |
| **OVERLAP** | The 4 CSS-positioned corner connect points sat at `-7px` insets while `NodeResizer` places its grips at the node's EXACT corners. Measured: corner at `176,450` vs grip at `178,452` — **2px apart, 33px² overlap**, and the grip lost hit-testing. | Corners pulled to **27% / 73%** along each edge (51.3px on a 190px width) with the vertical offset following the midpoints' own convention (−4.5px for a 9px dot). Measured: **overlap 0px²**, corners now at `222,448 · 296,448 · 222,553 · 296,553` vs grips at `178,452 · 340,452`. The corner points also now read as 8 evenly-spaced anchors instead of 4 crowded into the corners. |
| **GRIPS HARD TO GRAB** | `.react-flow__resize-control.handle` was 8px, and — the half that mattered — `.node-body` is `position: relative` with no z-index and comes AFTER the controls in the DOM, so it **won the hit-test at the node's own edge**: `elementFromPoint()` at a grip's centre returned `.node-body`. The grip was buried under the node's own body. | Grip raised to **10px** + an `::after { inset: -6px }` invisible hit area + **`z-index: 2`** (above the un-z-indexed body, below the handles' 5, so a connect point is still top-most at its own centre). Measured: `elementFromPoint` at a grip now returns the **resize control**. |

**Also quietened (the "xấu" complaint):** the glow disc went from a 12px `z-index:20` pulsing gradient to
a **flat 16px disc at `z-index: 4`** (under the handles' 5) with the `ds-handle-pulse` keyframe **removed
entirely**. So the element under the pointer is now always the grab target, and nothing pulses.

**Verified live — 8/8:** handle transform keeps its translate · overlap 0px² · grip wins at the grip ·
corner handle wins at the corner · midpoint handle wins at the midpoint · pulse gone · glow flat ·
all 8 sites still present. Corner + midpoint hit-tests PASS; resize-grip hit-test PASSES after the
`z-index: 2` fix (it returned `.node-body` before it).

**Note for the next session:** the previous B2 design put connect points at the node's extreme corners,
which is exactly where `NodeResizer` keeps its grips — that collision was the whole of Harvey's item 4
feedback. If the corner points are ever moved again, re-measure the overlap against
`.react-flow__resize-control.handle`, do not eyeball it.

### ▶ FEEDBACK FIX D 2026-09-17 — the K1 hover pulse fought the selection outline (2 rings on one node)

Harvey: *"the effect when hover from event catalog is not quite nice. it makes UI confused with 2
outlines when select the element."* **Real defect, measured.** Two rules painted a ring on the same
node and they DISAGREED:

| Rule | where | outline | border-radius |
|---|---|---|---|
| `.node.selected` | `styles.css` ~907 | **2px** `--sel` | **8px** |
| `.ds-pulse` (K1 hover) | `styles.css` ~1699 | **3px** `--sel !important` | **10px** |

`.ds-pulse` carried `!important`, so it **beat** the selection rule: selecting a node and then hovering
it changed the ring's thickness AND corner radius (2px→3px, 8px→10px). It read as one shifting,
doubled outline rather than two layers — which is exactly "confused". Worse, the pulse is applied to the
`.react-flow__node` **WRAPPER** while the selection ring lives on the inner `.node`, so the two rings
were drawn at different radii and could never layer cleanly.

**Root cause in code:** `src/choreography.ts` `paint([el], PULSE, …)` had **no exclusion for a selected
node** — and `onNodeMouseEnter` does `peers.add(node.id)`, so the hovered node pulsed on top of its own
selection ring.

**Fix — one ring per node; selection outranks hover:**
1. `.ds-pulse` now uses the **same** `outline-width` (2px) and `border-radius` (8px) as `.node.selected`,
   so the two can never disagree even if both classes land. The pulse's only differentiator is now the
   ANIMATION (`ds-node-pulse`, the opacity breathe). The `!important` is kept — it still has to beat
   React Flow's own handle/outline rules; it is now harmless because the values agree.
2. `isSelectedNode(el)` added to `src/choreography.ts` (a class-list read — no React render, no new
   prop) and applied at **BOTH** pulse sites (the edge-hover path and the node-hover path). A selected
   node is skipped whether it is the HOVERED node or a PEER.

**Verified live — 6/6:** a selected node's ring measures `2px/8px` before hover and `2px/8px` after
(**unchanged**), the selected node receives NO `ds-pulse` class, and — the check that matters most —
**K1 still works**: an unselected connected peer still gets `ds-pulse` and the connected edges still go
electric (6 `.ds-electric` elements measured). `.ds-electric`, the SMIL payloads and
`prefers-reduced-motion` are untouched. `tsc=0` · `vite build=0` · literal-colour count 183 → 183.

**Lesson:** when two rules can paint the same visual affordance, give them the SAME geometry and a
different ANIMATION — a different width/radius is the tell that they were designed
independently and will fight. And a hover effect must explicitly exclude the SELECTED element; "the
hovered node pulses too" is right until the hovered node is the selected one.

### ▶ FEEDBACK FIX E 2026-09-17 — the K1 node PULSE removed (Electron effect, option 1)

Harvey asked whether the EventCatalog hover effect should be dropped entirely. Assessment with
measurements found K1 is **two independent halves**, so only one was removed:

| Half | What it did | Verdict |
|---|---|---|
| `PULSE` (`ds-pulse`) | Outlined the hovered node **and every peer** | **REMOVED** |
| `ELECTRIC` (`ds-electric`) | Repainted the connected edges: `1.8px` slate → **`4px` accent + flowing dash + glow** | **KEPT** |

**Why the pulse had to go (3 measured reasons, not taste):**
1. **It duplicated the selection signal.** `.ds-pulse` used `var(--sel)` — the colour the whole app uses
   for *selected* (63 occurrences of `--sel`, always selection). One visual signal, two meanings.
2. **Fix D did not actually solve the ambiguity.** Fix D made the pulse ring IDENTICAL to
   `.node.selected` (2px / radius 8px) — which removed the *geometry* clash but left a ring in the
   selection colour appearing on hover, i.e. the ambiguity was the **colour and the scope**, not the
   size. Matching them made them indistinguishable rather than distinct.
3. **Scope was too wide.** Hovering one node pulsed **itself + every peer**, so moving the mouse lit up
   the whole neighbourhood.

**Why `ELECTRIC` stays:** it answers a question the user actually has — *"what does this node connect
to?"* — by highlighting the relevant edges. It introduces **no new colour** (reuses `--sel`) and only
changes stroke width + dash + glow. Verified still working: hovering a node lights all its edges
(6 `.ds-electric` elements measured) and hovering an edge lights just that one (`4px`, `dash=5px, 5px`,
`animation=ds-edge-dash`).

**A guard was also added, consistent with "selection outranks hover" from fix D:** `lightEdge` now skips
an edge that is already SELECTED, so a selected edge no longer jumps `1.8px → 4px + dash + glow` under
the pointer. Verified: a selected edge stays `1.8px / dash=none`, and an unselected edge still goes
electric.

**What was deleted:** the `PULSE` export and its `touchedNodes` bookkeeping plus both paint call sites in
`choreography.ts`; the now-unused `nodeEl` helper; the `isSelectedNode` helper (generalised to
`isSelected`, used for edges); the `.ds-pulse` rule and the `ds-node-pulse` keyframe in `styles.css`; and
the `.ds-pulse` arm of the `prefers-reduced-motion` block. `useHoverChoreography` still returns the same
four handlers, so `App.tsx` is untouched.

**Verified live — 6/6 + 3 guards:** no `.ds-pulse` rule and no `ds-node-pulse` keyframe in the built
stylesheet · **0** elements wear `ds-pulse` after a node hover · connected edges still go electric ·
a selected node's ring is `2px/8px` with `animation: none` (never repainted) · a selected EDGE is not
repainted · an UNSELECTED edge still goes electric. `tsc=0` · `vite build=0` · literal-colour count
183 → 183 (deleting rules added no colour).

**Lesson (in the skill):** before *removing* a hover effect, split it into its independent halves and
measure each — the useful half here was the edge highlight, not the node outline, and dropping the whole
feature would have thrown away the only part that answered a user question.

### ▶ ROUND Q 2026-09-18 — edge endpoints are now draggable (and visible)

Harvey: *"còn line connection thì tôi muốn có khả năng kéo cái line ra vô chứ ko phải connect là xong cần kéo
line qua lại"*.

**The capability already existed but was undiscoverable.** `onReconnect` + `edgesReconnectable` were already
passed, and React Flow rendered its own grabbers. Two measured reasons he could not use it:
1. **`reconnectRadius` was React Flow's DEFAULT of 10** — a 10px-radius target to hit blind.
2. **The grabbers are painted `stroke="transparent" fill="transparent"`** (RF's `EdgeAnchor`), so nothing on
   screen indicated that a line END is draggable.

**Fixes:**
- **`RECONNECT_RADIUS = 14`** (`App.tsx:147`) passed as the top-level `<ReactFlow>` prop. 14 not by feel: RF
  SHIFTS the disc outward (`cx: shiftX(centerX, radius, position)`) so its near edge is **tangent** to the
  junction and the disc lies outside the handle that owns it — a handle can only enter the disc when the node is
  smaller than `2R`, and the smallest real node (read from the board's `measured` box) is 114px, a **4.07x
  margin**. The harness reads RF's own source to prove the geometry.
- **The endpoint is now VISIBLE on edge hover** — `.react-flow__edgeupdater` gets `--elevated` fill + `--sel`
  ring with `opacity .15s`, revealed by a `@media (hover: hover)` rule covering `:hover`, RF's `.updating`
  (mid-reconnect) and grabber-`:hover`; `opacity: 0` at rest so the canvas stays clean.
- **Gated on read-only:** `edgesReconnectable={!readOnly}` (was an ungated prop — review mode let the user rip a
  connection off, contradicting that mode). No second source of truth.

VERIFIED LIVE: at rest `opacity 0` on all grabbers, `r=14`, fill `rgb(26,27,31)` / stroke `rgb(59,130,246)`
(tokens, no new literals); edit mode → **4 grabbers**, read-only → **0 grabbers while 2 edges and 3 nodes still
render**, toggling back → 4 again.

**END-TO-END DRAG VERIFIED by the orchestrator** (the coder declared this untested — it has no browser). A real
CDP pointer sequence on a grabber: mid-drag `react-flow__connection` = **1** (the rubber-band line appears), and
after release at another node's handle the edge id changed (`e1` → `xy-edge__cgright-topicleft`), i.e. the edge
really re-attached — and the **Undo button became enabled**, proving `pushHistory()` fired. The gesture completes
and is undoable, not merely wired.

**Touch tier deliberately NOT revealed:** the reveal is hover-based and a touch device has no hover state to hang
it on, so on touch the (now larger) invisible 28px disc is what is available. Disclosed, not claimed as parity.
If reconnect ever feels hard on the tablet, that is the known gap.

Gates: `tsc=0` · `build=0` · hex **127** · demo board 3n/2e, preset `architecture`, no `theme` key, positions
`-53,298 / 324,290 / 704,290`. Harnesses: **8/8 green** — new `checks/package-q-reconnect-endpoints.mjs` joins
the 7 from round P.

### ▶ ROUND P 2026-09-18 — the reload flicker, the boot flash, and the toast that fired every load

Harvey: *"Khi reload web or refresh web, nó luôn có flicker của render làm thấy xấu"* · *"Khi trong lúc load, nó
hiện 1 cái dot từ từ biến mất"* · *"Khi load luôn có dòng popup ở dưới lên: Nice, you know the basic => remove"*.

**MEASURED BEFORE (cold load, live CDP):** `data-theme` absent at 146ms → **light at 315ms** → **dark at 446ms**;
the 3 SEED sample nodes (External→Queue→Service) painted then REMOVED at 513ms. A 250ms screenshot showed the
placeholder diagram on a LIGHT background.

**(1) Theme flicker — GONE.** Root cause: `applyTheme` only ran from a React effect, so the document showed a
theme React was about to replace. Fix: a synchronous inline script in `index.html` `<head>` writes
`dataset.theme` + the `dark` class before anything paints, mirroring `loadMode` / `hasStoredMode` / `matchMedia`
**and the default preset's suggested theme** (the trap: `presetId` initialises to the default preset, so its
suggestion is already in force at mount — a script that only read the stored key would still let React flip the
theme). VERIFIED LIVE: `data-theme=dark` from the **first sample (68ms)** and **ZERO theme changes** during boot
(was 2).

**(2) Seed/placeholder flash — GONE.** Option (B): the canvas now mounts empty (`useNodesState<Node>([])`) and
`initialNodes`/`initialEdges` survive **byte-identical** for the genuine first-run save path (`App.tsx:850,852`)
— deleting them would break new-user onboarding. A new `boardLoaded` flag is set on every bootstrap exit path and
gates the empty-state panel (`boardLoaded && nodes.length === 0`) so a load in flight cannot claim "This board is
empty". VERIFIED LIVE: exactly **ONE** node-appearance transition, with the real ids `src/topic/cg`, and **no
sample-node id at any sample** (was 2 transitions).

**(2b) The "dot that slowly fades" WAS the seed flash** — the *slowly* part is `animateLayout()`: `applyBoard`
wraps the swap in it (`.ds-animating-layout` for 400ms eases node `transform` over 350ms), so the seeded nodes
**glide out** as the real ones enter. Ruled out from source: `.brand .dot` (static fill, colour-only), `.gsc`
items (no fade-in), `.save-ind` (colour class only), handles / `.tnode-ctype` (hover-gated).

**(3) The "Nice — you know the basics." toast — REMOVED.** Root cause: it fired from an effect guarded by
`allDoneFired`, a `useRef` that **resets on every reload**, so anyone with all 6 tasks already in localStorage got
it on EVERY load. Fixed by making the condition a **RENDER guard** (`if (done.size >= TASKS.length) return null`)
instead of an effect + ref — a render guard cannot repeat by construction. The `onAllDone` prop, its type, the
`flash(...)` call site and the ref are gone; `doneSignal`/`tickTask` untouched (the only `setDoneSignal(null)`
was inside the deleted callback). VERIFIED LIVE: **0 toast samples** across the whole boot (was always present).

Gates: `tsc=0` · `build=0` · hex **127** · demo board 3n/2e, preset `architecture`, no `theme` key, positions
`-53,298 / 324,290 / 704,290`. Harnesses: **7/7 green** (`node-click-distance` 27/27, `package-o-metrics`,
`package-o-selection-stack` 6/6, `package-o-board-dialog` 10/10, plus NEW `theme-boot-sync.mjs`,
`theme-boot-script.mjs`, `boot-no-flash.mjs`). New files: `checks/*.mjs` ×3.

**PROCESS FAILURE WORTH REMEMBERING (orchestrator):** the first attempt at this round was killed after **50
minutes, 48 python/pixel commands, 0 files written** — the orchestrator handed a browser-less coder three
SCREENSHOT paths to "analyse", so it burned the budget on PIL image diffs. **Give a browser-less coder NUMBERS,
never images.** Retry with an explicit "no image analysis" rule and a recon budget finished in 25 minutes.
Also: that runaway run **deleted the demo board** (replaced it with an "Untitled" scratch board) with no git and
no backup — recovered from the canonical recipe in SESSION HISTORY and verified three ways (file, `/api/boards`,
live canvas). Keep the board recipe in session history findable; a scratch board in `boards/` is a real hazard.

### ▶ ROUND O 2026-09-17/18 — the second border was a LAYER, the node toolbar is gone, and the board prompts became a real dialog

Harvey (reviewed on a real Mac, then slept): *"when I click to select element. I still feel there is 2 border"* ·
*"tool tip khi chọn các element hiển thị, tôi nghĩ k cần"* · *"ở cái helper làm to hơn để các dòng chữ dài chung
1 line"* · *"chữ description nhìn hơi dài, gọn nhẹ hơn"* · *"top của left sidebar, chữ architecture, services bỏ đi"* ·
*"drop download chọn board đang lệch frame … khi tạo thì nó chỉ prompt thôi xấu quá"*.

**NOTE ON PROCESS: the first coder run STOPPED MID-WAY and left `tsc` RED** (it removed a `toolbar` variable from
`DiagramNode.tsx` but left `{toolbar}` in the JSX, which resolved to the global `BarProp`). The orchestrator fixed
that line and dispatched a second run for the remaining items. **A coder run can end mid-task with a broken build —
`tsc` must be re-checked after every run, never assumed.**

**(1) "2 borders" — the ring AND the resizer's own line.** `NodeResizer` renders whenever a node is selected, and
its four line controls paint from React Flow's own sheet (`.react-flow__resize-control.line.left
{border-left-width: 1px}` etc.), so a 1px SOLID `var(--sel)` line ran along every edge, right against the
`box-shadow` selection ring. Two same-colour 1px lines → "2 borders". Fix: `.resize-line { border-width: 0
!important }` (the per-side rules are more specific, so `!important` is required) — the ring is now the only
selection signal and the 4 corner grips remain the resize affordance. Verified by
`checks/package-o-selection-stack.mjs` (6/6: exactly ONE selection-coloured line; 4 line controls, 0 painting;
grips survive; shape border 1.5px in both states) and live (resize LINE controls 4, painting 0).

**(2) The auto-show node toolbar is removed from ALL THREE node kinds** (`DiagramNode`, `CustomShapeNode`,
`LabelNode`). Before removing, every one of the six buttons was mapped to a remaining route so no capability was
lost: duplicate → ⌘/Ctrl+D + context menu, copy → ⌘/Ctrl+C + context menu, note → context menu, bring-to-front →
context menu, delete → `Del`. The sixth was found to be a DEAD BUTTON (it called `onNote`, the same handler as the
button beside it) so nothing was lost with it. The `__toolbar` thread (`App.tsx` injection + the type slot in each
node kind) and the `.node-toolbar*` CSS were removed with it.

**(3) The `?` cheatsheet is now 340px** (was 280px) with the measurement in the rule's comment: at 280px three
rows exceeded the content box (widest requirement 303px for "Collapse / expand panels" + ⌘/Ctrl ⇧ \\). Verified
live: **0 of 14 rows wrap** — measured by counting DISTINCT `kbd` tops, because a Range-based line count reports a
false "wrap" (the 24px chips sit taller than the 12px text). The `max-height` + vertical-scroll guard and the
phone-tier override are both kept.

**(4) All 19 shape hints rewritten short** — longest 23ch (was 53). Constraints held: no hint repeats its label, all
19 distinct, AND search coverage preserved (24 retired words still findable through the omnibox), since the hints
are the palette's search index. Enforced by `checks/package-o-metrics.mjs`.

**(5) The sidebar preset badge + hint are gone.** `.boards-sub` and its `data-preset-badge` attribute removed,
along with the dead CSS. `BoardDoc.preset` and the 5 behaviour drivers (edges / layout / erd / flowchart / c4) are
UNTOUCHED — the field is saved in existing boards, so deleting it would silently drop a key. `.badge.preset` was
KEPT because the inspector still uses it for the C4 kicker chip.

**(6a) The Boards popup overflowed its button by 41px** (button 199px, popup `min-width: 240px` beats `.pop`'s
`right: 0` anchoring). Fixed with `min-width: 0` on `.boards-pop`, which cancels BOTH floors so `left: 0; right: 0`
alone decides the width. Verified live: popup 199px = button width, overflow 0 both sides, not clipped by the panel.

**(6b) `window.prompt` / `window.confirm` are gone — replaced by `src/BoardDialog.tsx`** (295 lines), ONE modal used
for create / rename / delete. Create shows the name field plus the template choices as selectable cards with
descriptions and an explicit "start empty", rather than the old prompt→confirm chain. Reuses the app's existing
vocabulary (`.sp-card` scrim/card from SearchPalette, `FOCUSABLE`/`returnFocusTo` focus handling from Settings)
and is tokens-only (0 colour literals). Verified live: `role="dialog"` + `aria-modal` + `aria-labelledby`, typing
reaches the field (isEditable runs first), the guard sits above the Escape branch, Cancel precedes the destructive
action, and Escape closes it. `grep -c "window.prompt\|window.confirm" src/App.tsx` → **0**.

Gates: `tsc=0` · `build=0` · hex **127** (down from 183; no new colour literals) · demo board clean 3n/2e · preset
`architecture` · no `theme` key · positions `-53,298 / 324,290 / 704,290` · `checks/package-o-metrics.mjs` 35/35 ·
`checks/package-o-selection-stack.mjs` 6/6 · `checks/node-click-distance.harness.mjs` green.

### ▶ FEEDBACK FIX N 2026-09-17 — the click went into a DEAD BAND, the legend is gone, the guides got a proximity gate

Harvey: *"khi tôi click vào chọn element, đôi lúc tôi vẫn thấy con trỏ chuột icon nhấp nhưng lại ko ăn"* ·
*"góc dưới trái canvas có 1 cái note cho architecture legend … tôi nghĩ k còn cần giữ nó nữa"* ·
*"mấy cái line helper, nó cứ văng lung tung ở top … sẽ show khi gần nhau. Nếu k đc thì bỏ luôn"*

**(1) The click "not taking" was a DEAD BAND, and the first fix made it worse.** Two independent gates read two
different numbers: d3-drag's `clickDistance` (wired from `nodeClickDistance`, React Flow default **0** — ANY
movement suppresses the trailing click) and `nodeDragThreshold`. Travel in `(0, 4]` = click suppressed AND drag
not started = nothing happens. Measured live with 1px-step pointer moves: `clickDistance=0` + threshold 4 →
0px selected, **2/3/4px did NOTHING (node did not even move)**, 6px+ dragged. Raising the drag threshold alone
had only WIDENED the band. **Fix:** `nodeClickDistance` derives FROM `nodeDragThreshold` per pointer class
(`FINE_NODE_CLICK_DISTANCE_PX = FINE_DRAG_THRESHOLD_PX`, fine 4 / coarse 6) — equal values hand off cleanly
because both gates compare strictly. Documented in `src/touch.ts` with the d3-drag/@xyflow source lines and both
failure directions; invariant machine-checked by `checks/node-click-distance.harness.mjs` (27 checks, negative
controls included). VERIFIED live: 0/1/2/3/4px ALL select, 6px drags — and the DISCRIMINATION test confirms
4px leaves `node.style.transform` unchanged (a click) while 6px moves it (a drag). *Note: synthetic clicks in
single jumps did NOT reproduce the defect; only 1px-step moves did — which is what a real hand does.*

**(2) The canvas legend is removed.** The render block, the toolbar "Show/Hide legend" control and the local
state went; `BoardDoc.legend` (boards.ts) and `preset.legend` were KEPT because the field is SAVED in existing
boards — deleting it would silently start dropping a key. VERIFIED: 0 `.ds-legend` in the DOM, 0 legend
controls, and the key still round-trips through a save.

**(3) Alignment guides now gate on PROXIMITY.** Measured with a numeric harness against the real module, before
the fix: FAR-vertical (440px apart, same x) → guide `height=560`; FAR-horizontal (820px apart, same y) → guide
`width=1180` (spanning the canvas); NEAR → guide. Distance was ignored, so a far-away node on the same axis drew
a line starting far from the user — *"văng lung tung ở top"*. **Fix:** `PROXIMITY_GAP_PX = 320` requires the two
boxes to be within that gap on the perpendicular axis (same ROW / same COLUMN), and the snap picks its anchor
among NEARBY nodes only, so the span is short and local. AFTER: FAR cases → no guide; NEAR cases → guide of the
expected length. **The first spec proposed LENGTHENING the span — the wrong direction for this complaint**; the
user's own words ("show khi gần nhau") describe a proximity gate.

Gates: `tsc=0` · `build=0` · 4 `<Handle>` all `type="source"` · `ConnectionMode.Loose` present · demo board clean
3n/2e · positions `-53,298 / 324,290 / 704,290` · preset `architecture` · no `theme` key · both edges `dots`.
Untouched (mtimes confirmed): `TableNode.tsx`, `LabelNode.tsx`, `vite.config.ts`, `Tour.tsx`, `boards/` (restored).

### ▶ FEEDBACK FIX M 2026-09-17 — Shift+2 for review mode (5 surfaces), and the misaligned favourite star

Harvey: *"ok make short cut for it. shift + 2"* · *"also the star in shapes some is not in the same vertical
on the right. fix it"*

#### 1 — `Shift+2` toggles the read-only review mode

Followed this project's **"one feature, N surfaces — verify PARITY"** rule; the shortcut shipped on all FIVE
in the same change, with ONE wording (`Toggle read-only review mode`) everywhere:

| surface | result |
|---|---|
| keydown handler (`e.code === 'Digit2'`, NOT `e.key` — Shift+2 delivers `@`) | ✅ |
| `?` cheat sheet | ✅ row right after fit view |
| Settings → `SHORTCUTS_KEYS` | ✅ same order |
| toolbar `Eye` tooltip | ✅ |
| README shortcut table | ✅ |

**The trap, and why placement was the whole fix:** the handler's `if (readOnly) return;` sits a few lines
BELOW the Shift+1 branch. A Shift+2 branch placed after it would switch the mode ON and then be unreachable —
a ONE-WAY shortcut. Verified by line number: **Shift+2 at :2388, the read-only return at :2402.**

**Two sources of truth avoided:** the toolbar's inline `onClick` body was extracted into ONE
`toggleReadOnly()` useCallback (`App.tsx` ~2306) BEFORE the shortcut was added; the button's `onClick` and the
keyboard branch both call it. Copying the body would have created two implementations of one action — the
defect class this codebase has been burned by before.

**Verified live (real CDP key events, modifiers=8 for Shift):** press 1 → `aria-pressed true`, press 2 →
`false`, press 3 → `true` — **bidirectional**. Control: `Shift+1` still re-fits INSIDE review mode (zoom
1.1916 → 0.6014), so the two branches do not shadow each other. Settings → Shortcuts read live:
`Fit view to diagram ⇧1` then `Toggle read-only review mode ⇧2`.

#### 2 — the favourite star was misaligned on short-label rows (MEASURED)

**Before:** `Service 176 · Queue 176 · External 176 · **Actor 157** · Gateway 176` — the `Actor` star sat
**19px further left**.

**Cause:** `.pal-meta` computes `flex: 0 1 auto`, so its width follows its content (103px on four rows, **82px**
on `Actor`), and the star sat behind it at a FIXED `margin-left: 2px`. **The CSS comment directly above
`.pal-star` already claimed `margin-left: auto` — the value did not match its own comment.** The comment
described the intended behaviour; the code did something else.

**Fix:** one value — `margin-left: auto` — exactly what the comment always said. The comment now states the
measured symptom (19px) so it cannot drift back.

Two candidates were tested live before dispatching and BOTH aligned the star: `margin-left: auto` and
`.pal-meta { flex: 1; min-width: 0 }`. Chose the former — one property, no `min-width` risk with long labels.

**Verified live after:** all five rows `star.left = 176` (unique x), `metaW` still 103 vs 82 (the label block
is unchanged — only the star moved), and **no row overflows** (`scrollWidth === clientWidth` on every row).

`tsc=0` · `vite build=0` · 4 `<Handle>` all `type="source"` · `ConnectionMode.Loose` present ·
hex 183 → **183** · read-only key reset to OFF so Harvey keeps the shipped default · board clean 3n/2e.

### ▶ FEEDBACK FIX L 2026-09-17 — read-only still let you EDIT an edge label, and the cursors were lying

Harvey: *"in read mode, vẫn có thể double click chọn thay đổi text của edge. cần xem lại. ngoài ra khi tôi
chạm vào element, nó k chạy đc, đó phải tính năng ko"*

**He was right on both — and the second is CORRECT behaviour that only LOOKED broken.**

#### 1 — the edge-label editor still opened (real bug)
**Measured in read-only:** a `dblclick` on `.edge-label` produced `.edge-label-input` (count 1) and
`.edge-label.editing` — the user could retype a connection's name. The label even still carried
`title="Double-click to rename this connection"`.

**Cause — the props do not reach INSIDE a custom component.** `GoblinEdge.tsx` owns the label and sets
`editing` from its own `onDoubleClick`; neither `GoblinEdge.tsx` nor `DiagramNode.tsx` received the mode flag
at all (`grep readOnly` on both returned nothing). Fix: thread it through the per-edge `data` payload the app
already uses (`rfEdges` passes `__type` / `onCommitLabel`; the flag went beside them, added to the memo deps),
then guard BOTH entry points inside the component — the label's `onDoubleClick` and the `__edit` signal the
edge context menu pokes (defence in depth; the menu is already inert). Deliberately NOT added to the
`__edit` effect's deps — it holds a persistent timestamp, so including the flag would pop the editor open the
moment review mode was left. The label stays READABLE; only editing is off.

#### 2 — "touching an element does nothing" is the FEATURE; the cursors were the defect
**Measured in read-only:** `.react-flow__node` computed `cursor: grab` (a hand promising "drag me"), the pane
computed `grab` as well, and `.edge-label` computed `text` (a caret inviting an edit). Nothing SHOULD happen
when an element is touched in review mode — that inertness is the whole point — but the UI promised the
opposite, so the mode read as broken.

**Fix:** cursor rules scoped under `ds-read-only` — node/edge/label to the default arrow; the PANE kept `grab`
deliberately, because a pane drag really does pan in this mode. That also fixes the actual defect: node and
pane used to read identically while meaning different things.

**A cascade trap found while verifying:** the edit-mode pane has ALWAYS computed `pointer`, because React
Flow's own `.react-flow__pane.selection { cursor: pointer }` (0,2,0) outranks this app's
`.react-flow__pane { cursor: default }` (0,1,0). `selectionOnDrag` is what adds the `selection` class, so it
disappears in review mode and the scoped rule takes over. **Not a regression** — checked by diffing the pane's
class list in both modes (`selection` in edit, `draggable` in read-only) and confirming which stylesheet wins.

**Also recorded:** a first reading said the `title` was missing in edit mode too — that measurement was taken
while the label was mid-edit (`title={editing || ro ? undefined : …}`). Re-measured on a fresh load: edit mode
shows the hint, read-only does not. **Re-measure from a clean state before calling something a regression.**

#### Verified live — read-only vs edit-mode control
| | read-only | edit mode |
|---|---|---|
| dblclick edge label | 0 inputs, 0 `.editing` ✅ | **1 input** (editing still works) ✅ |
| label `title` | `NONE` ✅ | the rename hint ✅ |
| label text still readable | `produce` ✅ | ✅ |
| node cursor | `default` ✅ | `grab` ✅ |
| pane cursor | `grab` (pan is real) ✅ | `pointer` (RF's `.selection`, pre-existing) |
| edge-label cursor | `default` ✅ | `text` ✅ |

`tsc=0` · `vite build=0` · 4 `<Handle>` all `type="source"` · `ConnectionMode.Loose` present ·
hex 183 → **183** · board clean 3n/2e.

### ▶ FEEDBACK FIX K 2026-09-17 — read-only still hovered, and MY OWN panOnDrag fix caused a "drag element" bug

Harvey: *"khi tôi trong mode view only. toi van hover dc, drag element dc trong khi dang le la ko dc"* — in
view-only mode he can still hover, and still drag an element. **Both confirmed real. The second one was my
own J-pass regression, and it was NOT a node drag.**

#### 1 — the hover highlight still fired (measured)
Real mouse move onto a node in read-only with `hover-highlight` ON → **`.ds-electric = 6`** (expected 0).
Cause: `useHoverChoreography(wrap, edgesRef, highlight)` took the user's PREFERENCE as its `enabled` argument
and the mode was never passed. Fix: `highlight && !readOnly`.
**Plus a second, separate arm:** `@media (hover: hover) { .react-flow__node:hover .react-flow__handle
{ opacity: 1 } }` popped 4 unusable connect points regardless of mode. Silenced under the new
`ds-read-only` class, together with `.tnode:hover .react-flow__handle.tnode-h` (the ERD column dots had the
same defect) and `.react-flow__handle:hover`. The `(hover: none)` and `.selected`/`.connecting`/`.valid`
reveals were deliberately left live — none of them can arise in review mode.

#### 2 — "drag element" was the CANVAS panning, not a node moving (measured)
**The two numbers that settle it:** dragging from a NODE BODY in read-only moved the VIEWPORT
(`x 113 → 233`) while the node's own transform stayed exactly `translate(324px, 290px)`. The node never moved;
the canvas panned underneath it, which reads as *"I'm dragging the element"*.

**Root cause — my J-pass `panOnDrag={readOnly ? true : [1, 2]}` widened WHERE a drag may start.** React Flow
applies its `noPanClassName` token (`'nopan'`) to a node wrapper **only while that node is draggable** —
`[noPanClassName]: isDraggable` (@xyflow/react ~2349), where `isDraggable` (~2244) is
`!!(node.draggable || (nodesDraggable && typeof node.draggable === 'undefined'))`. So
`nodesDraggable={false}` **REMOVES `nopan`** and the drag correctly falls through to the pane.

**Fix:** restore the `nopan` guarantee in review mode — both `noPanClassName={readOnly ? NO_PAN : undefined}`
and the per-node `className` injection (`readOnly ? [n.className, NO_PAN].filter(Boolean).join(' ') :
n.className`), because the wrapper is also what RF keys its own copy off. `NO_PAN` is exported from
`choreography.ts` beside `NO_ANIM`; the mode class is `READ_ONLY = 'ds-read-only'`.
**Rejected:** a second `nodesDraggable` guard (the transform proves nodes never moved),
`selectNodesOnDrag`, and `pointer-events: none` on nodes (would kill the hover a reviewer wants).

**Two coder findings worth recording:** (a) `readOnly` was in a **temporal dead zone** — the gate read it at
:392 while its declaration sat at :428, so my brief's own `e.g.` line would have failed `tsc`; the coder
hoisted the declaration (every other reader sits below the new position, behaviour unchanged). (b) The ERD
`Table` node carried the SAME hover-reveal defect, which my measurement on a Shape node never touched.

**MY PROCESS FAILURE, recorded honestly:** the J-pass acceptance criteria tested a drag starting on the PANE
BACKGROUND and passed — it never tested a drag starting ON A NODE, which is exactly what a user does. **When a
fix widens a gesture's scope, enumerate every place that gesture can START and run the control at each one.**

#### Verified live — 3 read-only assertions + 3 edit-mode regression controls
| case | read-only | edit mode |
|---|---|---|
| hover | `.ds-electric = 0`, 0 handles revealed ✅ | `6`, 4 handles revealed ✅ |
| drag starting ON A NODE | node transform unchanged AND viewport unchanged (inert) ✅ | node moves `324,290 → 438,351` ✅ |
| drag on EMPTY pane | viewport `-17,101 → 53,146` — pans ✅ | no pan (box-select) ✅ |

`tsc=0` · `vite build=0` · 4 `<Handle>` all `type="source"` · `ConnectionMode.Loose` present ·
hex 183 → **183** · `panOnDrag={readOnly ? true : [1, 2]}` unchanged · 1 `READ_ONLY_KEY` declaration ·
wrapper carries `ds-read-only` in review mode and NOT in edit mode · node carries `nopan` in BOTH modes
(RF's own in edit, ours in review) · board clean 3n/2e.

### ▶ FEEDBACK FIX I + J 2026-09-17 — double border on select, a READ-ONLY review mode, drop-to-create removed

Harvey: *"khi tôi select 1 shape, có vẽ đang có 2 borderline đúng ko. có vẽ xấu"* · *"tôi muốn thêm 1 button
trên toolbar … tôi sẽ trong chế độ read only, kéo qua lại mà k gây chạm bất kỳ element nào cả"* · *"khi tôi
mở 1 connect nhưng ko chạm tới ai, nó tự động tạo 1 node khác nhưng tôi thấy hơi kì"*

#### A — the "two borders" was a doubled ring, and one of the two rules was DEAD CODE

Selecting a node paints an outer 2-layer `box-shadow` ring (`.node.selected`, styles.css ~916) plus the
shape's own `1.5px var(--nc)` border. Harvey saw exactly that: blue ring → dark gap → orange border.

**The rule meant to unify them never ran.** `.node.selected .shape-frame { stroke-width: 2.5 }` (~920) targets
the parent `<svg>`; the `<rect>` in `src/shapes.tsx` carries `strokeWidth={1.5}` as a React SVG
**presentation attribute**, and a presentation attribute on the element beats a value **inherited** from a CSS
rule on an ancestor. Measured: `<svg>` computed `2.5px` while the `<rect>` rendered `1.5px`. So the "thicken
on select" intent had never been visible — there were simply two static borders.

**Fix:** deleted the dead rule; the ring is now the ONLY selection indicator. Verified live — the ring keeps
both shadow layers, `rect` still `1.5px` while selected, `<svg>` no longer resolves 2.5, no `outline` anywhere.

#### B — READ-ONLY review mode (toolbar, `Eye`, key `diagram-studio:read-only`, default OFF)

Everything element-touching is switched off through React Flow's OWN props — `nodesDraggable`,
`nodesConnectable`, `elementsSelectable`, `selectionOnDrag` all `!readOnly`, `deleteKeyCode={readOnly ? null :
['Delete','Backspace']}` — plus hand guards for what props do not cover: the `onDoubleClick` insert palette,
all three context menus, and ONE early return in the global keydown handler (placed after the Settings guard,
after Escape and after Shift+1, so the viewport-only keys keep working: **Fit view, Escape and `?` stay live**;
undo/redo/copy/paste/duplicate/nudge/`/` are inert). Entering the mode also clears the selection, because
`elementsSelectable={false}` only stops FUTURE selections — a stale ring/node-toolbar/resize-handle would
otherwise stay on screen.

**A real gap I found by measuring, fixed in J:** with `panOnDrag={[1,2]}` a LEFT-drag on the pane did nothing
in review mode — middle and right panned, left was a dead gesture, and a left-drag is precisely Harvey's
"kéo qua lại". Fix: `panOnDrag={readOnly ? true : [1, 2]}` — outside review mode the value is unchanged.
Safe to use `true` because React Flow's selection gate is `_selectionOnDrag = selectionOnDrag && panOnDrag !==
true` (@xyflow/react ~2121), so `true` also collapses box-select even if the other prop were missed; and the
touch pan gate is `panOnDrag !== false`, so one-finger panning still works.

**Verified live with a control (this is the part that mattered):** same pane point, same 60×40 left-drag —
**edit mode `dx = 0`** (left-drag box-selects, does not pan) vs **read-only `dx = 60, dy = 40`** (pans exactly
the drag vector), with **0** selected nodes, **0** node toolbars and **0** resize handles on screen.
Note for future measurement: a long drag toward the pane edge triggers React Flow's AUTO-PAN, which moves the
viewport with the cursor and can look like a false positive — keep the test drag short and away from the edges,
and always run the edit-mode control.

#### C — drop-a-connection-on-empty-canvas no longer creates a node
`onConnectEnd` keeps the drop-on-a-node branch and loses the insert branch. A release over empty canvas is now
a true no-op: no node, no edge, **and no `pushHistory()`** (a phantom undo step is its own bug). Silence, not a
flash. `pendingDrop` and `connectOrigin` bookkeeping preserved; `LIBRARY[0]` and the
`'Node inserted and connected'` message are gone. Doc sweep found NO copy anywhere (README / HANDOFF / Tour /
SearchPalette) teaching the removed behaviour, so nothing to correct.

#### Verified
`tsc=0` · `vite build=0` · `grep "node.selected .shape-frame"` → **0** · literal-colour count 183 → **183** ·
4 `<Handle>` all `type="source"` and `ConnectionMode.Loose` intact (G's scheme untouched) · read-only key
reset to OFF so Harvey gets the shipped default · board clean 3n/2e.

### ▶ FEEDBACK FIX H 2026-09-17 — zoom froze the animation forever, connector floated off the shape, default → smoothstep

Harvey: *"khi tôi zoom in zoom out, animation stop but when I stop zoom action, it didn't show again, I need
to make one click to recover them"* · *"the line connection is quite far to the shape. Can you check which is
good distance."* · *"ah I want to make smooth step is default hehe"*

#### FIX 1 — the zoom freeze (reproduced, then fixed)

Instrumented a `MutationObserver` on the class holder (`MAIN.canvas-wrap`) and ran a ctrl+wheel burst:
```
during the burst      class ADDED
+1.2s / +2.0s / +3.6s class STILL PRESENT   (three bursts in a row)
after one click       removed               ← exactly the reported symptom
```
**Root cause:** `createPanOnScrollHandler` (@xyflow/system ~2764) has an EARLY RETURN for the pinch-zoom
branch, and the only place it arms its own end (`panScrollTimeout` → `onPanZoomEnd`) sits AFTER that return.
This app runs `panOnScroll` + `zoomOnScroll={false}` + `zoomActivationKeyCode={['Meta','Control']}`
(App.tsx ~3495), which routes a ctrl/trackpad wheel into exactly that branch — so the end event that would
decrement the ref-count is never produced and the count LEAKS.

**Fix:** `useInteractionGuard` got a debounced self-release (`INTERACTION_RELEASE_MS = 200`) plus a
pointer-held guard and a `INTERACTION_MAX_MS = 60_000` ceiling, a capture-phase `wheel` listener that
re-arms on every tick, and capture-phase `pointerdown/up/cancel` listeners. The node-drag path works because
the timer never fires while a pointer is held — it re-arms instead. Verified live: the class now clears
**0.45s after the last wheel tick with NO click**, where it previously stuck past 3.6s. The coder's own
virtual-clock harness (22 assertions, incl. a 2s drag that must NOT thaw mid-flight) passes; that harness
tests a 1:1 PORT, so the live measurement above is the load-bearing evidence.

#### FIX 2 — the connector gap: measured, and a genuine TRADE-OFF left OPEN for Harvey

**Measured in FLOW coordinates at two zooms (2.5 and 1.3315, numbers agree):** with the `-6px` midpoint
nudges deleted, the handle dot's CENTRE now sits exactly ON the border (`right: 0` + RF's
`translate(±50%, ±50%)`), but **the edge path still starts 6px outside it** — and symmetric at the far end,
so the arrowhead also stops 6px short.

**WHY it is 6px and not 0** — `getHandlePosition` (@xyflow/system ~1489) returns `x + width` for
`Position.Right` (the handle box's OUTER edge, not its centre) and `y + height` for `Position.Bottom`. With a
12px dot that puts the path endpoint a full radius out from wherever the dot is centred. **The `-6px` pair
was NOT the cause of the gap — deleting it halved the gap 12px → 6px and moved the dot back onto the border;
the remaining 6px is React Flow's own convention (its base stylesheet ships the same `right: 0`).**

**The trade-off, measured both ways by injecting each candidate and re-reading:**

| option | path gap | dot position |
|---|---|---|
| shipped (`right:0`) | **6px** | centred on the border ✅ |
| pulled 6px inboard (`right:6px`) | **0px** | 6px INSIDE the visible border |

There is no offset that gives both, because the path endpoint and the dot centre are locked one radius apart.
**Shipped the version that keeps the DOT on the border** (the handle is the interactive affordance and must sit
where the user aims); the 6px line gap matches React Flow's own default and draw.io's rendering. Moving the
dot inboard was rejected: it would put the grab target inside the node body, where it competes with the node's
own drag handling. **If Harvey prefers the visually flush line, the one-line change is
`left/right/top/bottom: 6px` in the midpoint block — he was shown both numbers.**

Also noted while measuring (pre-existing, not introduced here, not fixed): the inner `.node` measures
**114px** while the React Flow wrapper measures **108px**, so a 6px overflow exists at the bottom of the
node. Unrelated to the connector; recorded here because it was found during this pass.

#### FIX 3 — default edge type is now `smoothstep`
`readEdgePath()`'s fallback changed in BOTH places (the unparseable branch and the `catch`). Valid stored
values still win and the inspector still writes the user's choice for later edges.

#### Verified
`tsc=0` · `vite build=0` · exactly 4 `<Handle>`, all `type="source"` (G's scheme intact) ·
`ConnectionMode.Loose` still present · literal-colour count **183 → 183** · **0** `TEST-ONLY`/debug rules left
in `styles.css` (two candidate offsets were injected during measurement and both were fully reverted —
`grep -n "left: 6px"` returns only an unrelated badge rule) · board clean 3n/2e.

### ▶ FEEDBACK FIX G 2026-09-17 — 8 points → 4, the REVERSED ARROW root cause, straight default

Harvey: *"tạm thời 4 cạnh đi trước đi. với lại khi tôi kéo line từ shape A sang B. ko hiểu sao mũi tên
luôn nằm ở chỗ A chứ k phải B. Với tôi muốn mặc định nó là straight type. Nếu tôi đổi type là gì thì nó
nên default type đó cho các line sau."*

#### THE REVERSED ARROW — measured root cause (this is the valuable part)

`NodeHandles` rendered **16 `<Handle>` across 8 sites** — a `source` AND a `target` with the SAME id at the
SAME coordinates. A measured `document.elementsFromPoint` at each site showed which of the two sits on TOP,
and **it differed per side**:

| site | on top | dragging FROM it |
|---|---|---|
| `left` | `source` | correct |
| `right` | **`target`** | **REVERSED** → arrowhead back on A |
| `top` | `source` | correct |
| `bottom` | **`target`** | **REVERSED** |

Mechanism: React Flow's `isValidHandle` (@xyflow/system `dist/esm/index.js` ~2618) gets the drag origin via
`getHandleType(undefined, handleBelow)`, which reads the handle's `source`/`target` **class**, then builds
```
source: isTarget ? handleNodeId : fromNodeId
target: isTarget ? fromNodeId : handleNodeId
```
So a pointer landing on a `target`-classed handle makes **the node you started from the TARGET**. Only 2 of
the 4 sides did it — which is exactly why the symptom was *"không hiểu sao"* (inconsistent, not always).

**Fix: 4 sites, one `<Handle type="source">` each** (ids `left`/`right`/`top`/`bottom` — load-bearing). The
origin is then always a source, so the connection is always built the right way round. Safe because
`HandleComponent` defaults `isConnectableStart`/`isConnectableEnd` to **true** (@xyflow/react ~1863), so a
source handle still carries `connectableend`, and under Loose mode `isValidHandle` needs only
`connectable && connectableEnd`. `ConnectionMode.Loose` is what lets four source handles serve BOTH ends —
for the target lookup React Flow uses `(targetBounds.target ?? []).concat(targetBounds.source ?? [])`
(@xyflow/system ~1444). **Never remove Loose mode from this app.**

Also: `onConnect` now normalises direction via a `connectOrigin` ref written by `onConnectStart` (kept
SEPARATE from `pendingDrop`, which `onConnectEnd` still needs to decide node-on-drop). And a
`migrateEdge` remap sends a stored corner id to the nearest surviving side (`top-left`/`bottom-left` →
`left`, `top-right`/`bottom-right` → `right`); the ERD ids never enter it.

**A coder flag I had to accept — my spec was WRONG and would have caused a new bug.** I wrote the swap guard
unscoped ("whenever the origin isn't the source, swap"). The coder refused and explained: an ERD column drag
ALSO records an origin (TableNode renders real `target` handles like `left_rel_i_order`), and there the
reversal **is** the correct FK direction — my guard would have **inverted every ERD relationship silently**.
It scoped the guard to the four goblin handle ids instead. Correct call; verified the guard code reads
`GOBLIN_HANDLE_IDS.has(origin.handleId ?? '') && c.target === origin.nodeId`.

#### Straight default + remember the choice
`diagram-studio:edge-path` (absent/unparseable → **`straight`**), read in a lazy `useState` like every other
preference here. Wired into **all three** creation sites that pass `preset.edges` to `makeEdge`
(~1317 proximity, ~1430 node-on-drop, ~1479 onConnect) — not just the drag path. The inspector's curvature
`<select>` calls `rememberEdgePath(id)` on change; its displayed value still reads the **SELECTED edge**, so
an older bezier edge keeps showing `bezier` while the default is `straight`.

#### Verified
`tsc=0` · `vite build=0` · **exactly 4 `<Handle>`, all `type="source"`**, ids `bottom,left,right,top` ·
**no two handles share a coordinate** (`486,420 | 691,420 | 589,343 | 589,496`) · **0** `.ds-handle-corner`
in src AND in the DOM · 4 handles on every node · literal-colour count 183 → **183** ·
`ConnectionMode.Loose` still at App.tsx:3422 · board edge paths **byte-identical** to the pre-G baseline
(`M148.9999928442807,354.99996724600953 C230.4999729…`) with `marker-end` set and `marker-start` ABSENT ·
preference round-trips across a reload (`step` survived) and a GARBAGE value does not crash the editor.

**HONEST LIMIT:** CDP could not drive a real connection drag in this headless build (the same known limit as
I5/I2), so **the arrow direction itself needs Harvey's mouse confirmation**. Everything mechanically
verifiable was verified; the visual "arrow lands on B" is his to confirm.

### ▶ FEEDBACK FIX F 2026-09-17 — duplicated discs, unequal holes, harsh ring, + the hover highlight became an option

Harvey, with a screenshot: *"8 điểm có vẻ khá xấu… có sự bị trùng giữa 2 nốt ở trái và phải, bị duplicated
by default. Chỉ 1 trong 2 thôi. và có lỗ to lỗ nhỏ k đẹp, cần như nhau. với phần viền outline bao quanh
shape mỗi khi nhấn vào có vẻ hơi thô, có cách nào làm nó mềm hơn ko"* + *"có thể ko cần auto show, hãy cho
nó thành 1 option có thể tuỳ chỉnh bật hay tắt."*

**FIVE fixes. Four had a measured root cause. A vision read of the screenshot was used only to decide
WHAT to measure — every finding below was then confirmed in the DOM.**

| # | Complaint | Measured root cause | Fix |
|---|---|---|---|
| **1** | "trùng … duplicated by default. Chỉ 1 trong 2" | `GlowHandle` (the K4 decorative disc) was **not concentric** with the handle it decorates: glow `16px` at `left/right: -6px`, handle `14px` at `-7px` → **measured centre offset 8px** → two overlapping circles | **Deleted the glow discs entirely** (component + 2 call sites + every CSS rule). They were K4 leftovers; with 8 connection points the handle alone is the affordance |
| **2** | "lỗ to lỗ nhỏ k đẹp, cần như nhau" | midpoint `14px`/`2px` border vs corner `9px`/`1.5px` → **measured 12px vs 8px** at the current zoom | All 8 sites now **`12px` + `2px`** border, corner inset `-4.5px` → **`-6px`** (and the `@media (pointer: coarse)` arm updated to match). **Re-measured overlap with the resize grips: still 0px²**, and the grip still wins its own hit-test |
| **3** | "viền outline … hơi thô, làm nó mềm hơn" | **`outline-radius` is NOT supported by this engine** (measured `getComputedStyle(probe).outlineRadius === undefined`) — so the ring was ALWAYS a sharp rectangle, and the `border-radius: 8px` in that same rule was **dead code that never applied** | Converted `.node.selected` to the **`box-shadow` ring its four siblings already use** (`.label-node` / `.note-node` / `.group-node` / `.tnode`): `0 0 0 2px var(--bg), 0 0 0 4px var(--sel)` → keeps the 2px gap, follows the 8px radius, colour and 2px weight unchanged |
| **4** | "8 điểm khá xấu" | 8 equally-loud circles revealed at once | Border token lowered `--border-strong` → `--border` so the set reads as quiet anchors; fill and the `--nc` hover emphasis kept. The reveal mechanism, the touch gate, the 8 ids and `ConnectionMode.Loose` are untouched |
| **5** | "ko cần auto show … thành 1 option bật hay tắt" | The ELECTRIC hover was always on | New **`useHoverHighlight()`** in `choreography.ts` mirroring the established `useAnimationGating` pattern — key `diagram-studio:hover-highlight`, **default OFF**, plus a `Highlight connections` toggle in Settings → **Canvas** beside "Reduce motion". `useHoverChoreography` gained an `enabled` param; when false it returns no-op handlers AND runs `clear()`, so switching it off mid-hover cannot strand a lit edge |

**One prompt defect I caused and fixed myself:** the Settings hint copy I wrote said *"dim the edges"* —
the effect BRIGHTENS them. The coder flagged it honestly rather than inventing copy; the hint now reads
**"brighten the edges that touch the hovered node"**.

**Verified live — 7/7 + the toggle:** 0 glow discs · all 16 handle elements measure a single size
(`10x10` at the current zoom) with a single `2px` border · overlap with the grips still **0px²** and the
grip still wins hit-testing · the ring is now `box-shadow` with `outline: none` · **highlight OFF by
default** (0 `.ds-electric` on hover) · clicking the toggle flips `aria-checked` `false`→`true` and stores
`'1'` · with it ON, hovering a node lights **6** electric elements. `tsc=0` · `vite build=0` · bundle
carries **0** `ds-handle-glow` · literal-colour count 183 → 183.

**Still open as a QUESTION, not done:** the coder's static read is that **8 points crowd a 190px node**
(corners sit ~5.4px from the neighbouring midpoint). Reducing 8 → 4 is a separate decision — it was
deliberately NOT made. Worth asking Harvey.

### ▶ REMAINING — PACKAGE N is COMPLETE (passes 1/2a/2b/2c/3/4a/4b/4c/5 done); next = Harvey's real-device test.


**4b / 4c / 5 — all ✅ done (rows above).** The pass-by-pass plan that used to live here is spent;
`PACKAGE-N-SPEC.md` + the rows above are the record.

**Honest note on the mockup gate:** Harvey waived the intermediate review checkpoints for this batch
(2026-09-17 — *"làm hết đi rồi tôi test 1 lần"*), so 4b/4c shipped without a mockup pass. The existing
`mockup-palette-v2.html` still has **no import UI in it** — the import section was designed straight
from `PACKAGE-N-SPEC.md` §8 and verified by live DOM measurement instead. If the import UI is ever
revisited for a redesign, the mockup-first rule applies again as normal.

**What remains: Harvey's real-device test.** No further code work is queued on PACKAGE N.

**Two known cosmetic deviations, recorded rather than hidden:**

1. A declared `width="abc"` (non-numeric) reports **`no-size`** ("declares no width and height")
   rather than §8.2 rule 5's **`bad-size`** ("zero or invalid"). Both are rejections and the
   *remediation text is identical*, so the user sees correct guidance — but the reason code is the
   wrong branch. One-line fix in `parseDim` if a future pass touches it.
2. The panel drop zone is wired via a `shapeZoneProps` spread rather than a JSX `onDrop` attribute,
   deliberately: the panel and `<main>` are siblings, so a file dropped on the panel cannot reach the
   canvas handler, and keeping the canvas `onDrop` the single JSX drop attribute also keeps
   "`onDrop=` appears exactly once" true as a grep-able invariant. Consequence: that grep alone does
   not prove the zone is wired — verify it by dropping a file on the panel.

### Working state (verified at the stop point)

`boards/` contains ONLY `mu01q1ue3a854b81.json` = **3 nodes / 2 edges / preset `architecture` / NO `theme`
key / positions `-53,298 · 324,290 · 704,290` / both edges `flow: dots`**. `boards/library.json` and its
`.bak` are **runtime data, not source** — delete them after any test that creates them. Dev server on
`http://192.168.33.200:5200/` (Harvey is on a Mac on the LAN — never hand him `localhost`).
Mockups: `/home/harvey/diagram-studio-research/mockup-palette-v2.html` (+ the widget copy in `/tmp`).
Research: `PALETTE-1..4*.md` + `PALETTE-SYNTHESIS.md` in the same dir.

### Two traps this round cost real time — read before testing anything

1. **A React-controlled input ignores `el.value = q` + a synthetic `input` event.** Every search query
   returned the SAME unfiltered list and the feature looked broken when it was fine. Drive it with
   **trusted key events**: focus the field, then `cdp('Input.insertText', text=…)`. When a test says "the
   feature does nothing", check the test's fidelity before reporting a defect.
2. **Deduplicate elements by `make()` OUTPUT, not by label or source text.** `Note` had two bodies that
   printed identically as source but differed in `sub`; comparing `String(i.make)` kept them split (35
   elements) while comparing `JSON.stringify(i.make())` correctly collapsed them (34).

---

## (historical) REVIEW PASS notes — M3 era, kept for the invariants

**Everything in M3 is code-complete, verified and vault-written. Nothing is in flight.**
Vault (all done, verified on disk): ADR-031 gained `## PACKAGE-M3 — Responsive (tablet + phone) & panel
collapse` plus the subsections `### M3 step 2c`, `### M3 step 2d`, `### M3 step 2e`; the `## Verification`
section now carries a 2026-09-15 line beside the 2026-09-14 one; `2 Areas/Hermes/Change Log.md` has the
2026-09-15 M3 row (extended for 2c/2d/2e); `System Architecture.md` has `### Responsive tier decision
(PACKAGE-M3)`; the Architecture MOC + Content Index are refreshed. Do not re-capture.

**The next session is a REVIEW session** — Harvey opens it to keep reviewing the tool. Read this file,
then `PACKAGE-M3-SPEC.md` (the spec of record) and the `diagram-studio` skill (it now carries the M3
architecture, the panel/CSS lessons, and the verification gotchas). Expect user-reported bugs: all five
of this session's defects were found by using the app, four of them by Harvey.
- Process that worked: reporter reproduces with real measurements → dispatch the `coder` profile with the
  root cause already measured → orchestrator verifies independently (tsc + build + live DOM) → `reviewer`
  profile for a second pass when the change is structural → vault via pkm.
- **When you brief the reviewer, give it the COMBINATIONS, not just the paths.** The 2d review passed 6/6
  and still missed 2e (hide both → expand one side) because only the listed paths were tested.

**Still open (human-only):** Harvey's real-device test — Mac mouse (chevrons, `⌘⇧\`, wheel=pan /
`⌘`+wheel=zoom) and a real tablet/phone (long-press, pinch, safe-area, bottom sheets). Emulation cannot
prove: real pinch/two-finger, iOS Safari home indicator + URL-bar collapse, real long-press feel.
Known limits by design: box-select is mouse-only on touch (React Flow forces it); view-only-first-touch
was deliberately not implemented.

## PACKAGE-M3-SPEC.md remains the spec of record
Read `/home/harvey/diagram-studio-research/responsive-survey.md` (evidence, with URLs) and
`/home/harvey/diagram-studio-research/mockup-M3.html` (approved visual) for the reasoning.

## Project
`/home/harvey/projects/tech-goblin/lab/diagram-studio`
React 19 + Vite 5 + `@xyflow/react` v12 + lucide-react + html-to-image.
Dev server: **`http://192.168.33.200:5200/`** (Harvey is on a **Mac remote client** — never
tell him localhost). Restart: `npx vite --host 0.0.0.0 --port 5200 --strictPort &`.

## What shipped 2026-09-15 (PACKAGE-M follow-up — DONE + orchestrator-verified)
Settings was reviewed part-by-part with Harvey and is now complete:
- **Settings panes are all REAL controls.** Nav went 6 → **5 groups**: Appearance (theme cards), Canvas,
  Connections, Keyboard (read-only shortcuts), About (read-only). The **Export** pane was deleted (export
  has its own toolbar menu) and the **Editor** pane was deleted (it held only "Board preset", which Harvey
  will redesign separately).
- **Toolbar frequency rule:** used-constantly controls stay on the toolbar; set-once controls moved into
  Settings. The three connection rules (Prevent cycles / One input / Proximity connect) left the toolbar;
  Reduce motion moved out of the inspector into Settings → Canvas; Snap to grid + Alignment guides live
  on BOTH surfaces over ONE state.
- **Grid size is a real setting** — was hardcoded 16px in four places (toolbar tooltip, rounding math,
  `snapGrid`, `Background gap`), now one `gridSize` state; control is a **segmented control** with
  8/16/20/32/64.
- **Control kit** — every `<select>`/`<input>` (Settings, the inspector's 14 selects + 15 inputs, the
  pickers) was browser-native and unthemeable; now one token-based kit: `appearance: none` + inline-SVG
  chevron, 7px radius, `--border`/`--elevated`/`--fg`, hover `--border-strong`, focus `--acc` + 3px
  `--acc-soft` ring. Verified across all five themes; 0 native selects remain.
- **Bug fixed — grid-dot contrast:** dots measured 1.16–1.22 in four of five themes (below the 1.3–1.6
  band); alphas raised (dark .14 / light .18 / paper .22 / midnight .15) → all now 1.43–1.46.
- **Bug fixed — stale theme in the board file:** autosave wrote the global theme into the board doc and
  load read it with PRIORITY over the preset suggestion, so a preset's real suggestion never applied
  (C4 suggests `midnight` but a C4 board saved on `dark` always loaded `dark`). Boards no longer store a
  theme: removed from all four save payloads, the PUT handler no longer writes it, load uses only
  `suggestTheme(p.theme.suggested)`. Legacy files still parse. Board file keys are now
  `id/name/nodes/edges/updatedAt/preset/legend`.
Vault: ADR-031 §"PACKAGE-M follow-up" + a 2026-09-15 Change Log row (via pkm, verified).

## What is DONE and verified (earlier packages)
**Gói I (7 bug fixes)** — `PACKAGE-I-SPEC.md` — DONE, independently verified by the orchestrator:

| # | Fix | Orchestrator verification (not the coder's word) |
|---|---|---|
| I1 | Tour spotlight clamped to viewport | measured step 4: `x232..right1276` inside 1280×577 (was `226..1286`, cut off) ✅ |
| I2 | Tour Back at 8/8 | real mouse press/release → 8/8 → 7/8 ✅ (could not reproduce any defect) |
| I3 | Tooltip clamp + flip | help-button tooltip `bottom=525 < 577` — flipped above, not clipped ✅ |
| I4 | Blob + attached-anchor downloads | PNG 90 KB + SVG 13 KB + JSON all downloaded ✅ |
| I5 | Vertical resize | inner `.node` now fills the wrapper both axes (`width:100%; min-height:100%`); all shapes resizable. **End-to-end resize gesture NOT verified** — CDP cannot drive RF's resize handler; needs a human mouse test |
| I6 | Autosave loop | one drag → **1 PUT** (was 30 in 25 s); indicator `saved` → idle ✅ |
| I7 | Cursor at rest | pane `pointer`, node `grab`; snap cursor only `:active` ✅ |

`npx tsc --noEmit` = 0 · `npx vite build` = 0. Boards = `["Kafka rebalance"]` only, clean 3 nodes / 2 edges.

**Gói H (onboarding)** — `PACKAGE-H-SPEC.md`
- `src/Tour.tsx` — guided tour, 8 steps, dim + spotlight, Back/Next/Skip + Replay, keyboard.
- `src/Checklist.tsx` — getting-started checklist, 6 tasks that self-tick, dismissible.
- Auto-runs once (`diagram-studio:tour-seen`), relaunchable from the `?` popover.
- Verified: tsc=0, build=0, spotlight dim measured `rgba(0,0,0,.55) 9999px` in computed style
  (pixel check: canvas `(4,4,5)` dimmed vs palette `(26,27,31)` lit), checklist ticked
  1/6→2/6 by a real action, persists across reload.

## What is IN FLIGHT
Nothing.

### PACKAGE-L — Multi-diagram-type: theme foundation, preset spine, flowchart / C4 / ERD — DONE 2026-09-14
Spec: `PACKAGE-L-SPEC.md`. Design reference: `/home/harvey/diagram-studio-research/mockup-L.html` (approved).

**New files:** `src/theme.ts` (theme controller), `src/colors.ts` (symbolic colour layer),
`src/presets.ts` (the preset spine + the 3 real presets), `src/TableNode.tsx` (ERD `table` node),
`src/crowfoot.tsx` (crow's-foot markers).

| # | What shipped | Measured browser evidence |
|---|---|---|
| L1 | Two-layer tokens + `[data-theme]` blocks for dark/light/paper/midnight/contrast; `color-scheme`; every audit literal replaced by a chrome token; RF's `--xy-*` vars re-pointed at our tokens | 6 themes toggled: `dataset.theme` dark/light/paper/midnight/contrast; `.dark` class true for dark/midnight/contrast, false for light/paper; `--c-accent` #f54e00 → #9a3412 → #8a2e05 → #ff7a45 → #ffff00; canvas bg rgb(11,11,13)→rgb(247,247,248)→rgb(246,241,231)→rgb(10,15,30)→rgb(0,0,0); minimap bg follows; dot pattern `--xy-background-pattern-color` follows |
| L1 | **Symbolic colours**: `ColorKey`/`resolveColor`/`LEGACY_HEX` + migration on board load; inspector swatches are keys; `<markerEnd.color>` is the token | legacy-hex board: DARK nc `#f54e00/#a78bfa/#22d3ee` → LIGHT nc `#9a3412/#5b21b6/#0e7490` → MIDNIGHT `#ff7a45/#c4b5fd/#5eead4`; edge stroke rgb(148,163,184) → rgb(71,85,105); persisted board after autosave: **0 hex left**, keys only |
| L1 | Theme-aware PNG/SVG export | SVG: dark `fill="#0b0b0d"` + `--c-accent:#f54e00` vs light `fill="#f7f7f8"` + `--c-accent:#9a3412`; PNG produced both times (85,740 / 86,007 bytes) |
| L2 | `src/presets.ts`: `DiagramPreset` (palette / extraShapes / edges / layout / theme / guidance / templates / caps) + `LAYOUTS` registry; `BoardDoc.preset\|theme\|legend`; 5 switch points wired | preset switching to `custom` left all 14 node transforms + shapes + titles **byte-identical**; custom palette = 27 rows (union); `free` engine is a no-op (undo stayed disabled) |
| L2 | Preset picker (3 entries) + board-list badge | chips `[architecture, flowchart, c4, erd, custom]`; board menu "Diagram type…" + "Show/Hide legend"; board list badges each board; badge shows Architecture on the demo board |
| L2 | `architecture` byte-identical | same palette (10 rows + identical hints), edge `bezier`/no-dash/`arrowclosed`, `layered-lr` 70/24, all three toggles OFF — identical to the pre-L defaults; K1/K2/K3/K4/K5 all re-measured on it |
| L3a | 9+1 ISO 5807 shapes, vertical handles, label-only body, back-edge-safe layout, `bandGroups`, Approval template | all 11 flow nodes have `data-handlepos` **top(target)/bottom(source)**; body `label-only`; shapes terminator/process/decision/io/document/manual/connector/…; auto-arrange TB layers 0→1009px with the loop-back **placed** (old algorithm verbatim: 8 nodes collapsed to layer 0) |
| L3b | C4: `c4Type` table, dashed intent-labelled edges, Context + Container templates, legend panel, `techn` | Context 5n/4e with the canonical 4 labels; Container 11n/9e, kickers `[Person]`/`[Software System, External]`/`[Container: application]`/…, dash `6px, 4px`, techns HTTPS/JSON/HTTPS/sync, JDBC/async, Kafka/XML/HTTPS/SMTP, legend 7 rows |
| L3c | ERD `table` node + column handles + crow's feet (incl. zero-or-one) + relationship labels + `showMode` + users/orders/order_items | 3 table nodes; PK key, FK name in `--sel`, NOT NULL filled vs hollow dot, UNIQUE chip, per-column `left_rel_*`/`right_rel_*`; markers `one`/`many`/`zeroOrOne`/`zeroOrMany` all resolve; `Derived: 1:*` → `0..1:*` after an inspector edit; showMode ALL 4/5/5 → KEY_ONLY 1/2/2 → TABLE_NAME 0/0/0 |

**Deviations (and why):**
1. **The migration is non-destructive only on load.** To make a theme actually recolour a *stored*
   board, the literal `style.stroke` is dropped once its hex maps to a key (the key is the source of
   truth); a genuine custom hex is left untouched. Without this, light mode recoloured the UI but not
   the diagram — the exact failure the spec warned about.
2. **`legacy-hex` arrowheads**: `markerEnd.color` is rewritten to `var(--c-slate)` at migration for
   the same reason (RF's marker def uses the literal verbatim).
3. **Crow's-foot markers are keyed by the symbolic colour KEY, not the resolved hex** — so one
   `<defs>` set serves every theme and the id never goes stale, while the glyph paints from
   `var(--c-*)` and inherits the theme.
4. **Flowchart lanes are frozen BANDS, not sub-flows.** Per `C1 §4.3` the engine excludes group
   children from layout, so a lane inside a pool would freeze the whole swimlane and "Auto-arrange"
   would skip it. `bandGroups` freezes the pool/lane rectangles and lays out the top-level flow —
   which is also what makes the loop-back a real regression test.
5. **`architecture.caps` records today's defaults** (all toggles off) so adopting the preset cannot
   change an existing board. The caps apply to the existing toggles on preset switch (no second toolbar).
6. **`lucide` has no `app-window`** — the C4 container icon is `box` (verified against `SHAPES`/`ICON_NAMES`).
7. **`vite.config.ts`** gained `preset`/`theme`/`legend` pass-through + light validation on the boards
   API. The spec said "no backend change" — this is not a *format* change (the API already stored
   arbitrary JSON), only preserving the three new keys across `PUT` and surfacing `preset` in the list
   so the board badge can be driven by the server list.

**Test note for the next session:** a **hidden** headless tab never fires `ResizeObserver`, so React
Flow never measures nodes and renders **no edges**, while nodes still appear. Bring the tab to front
(`Page.bringToFront`) before measuring edges.

### PACKAGE-K — EventCatalog visual techniques (K1–K5) — DONE 2026-09-14
Spec: `PACKAGE-K-SPEC.md`. Technique source: `/home/harvey/ec-research/eventcatalog-reactflow-report.md`.

| # | What shipped | Measured browser evidence |
|---|---|---|
| K1 | Hover choreography via direct DOM classList (zero re-renders) + ref-counted perf guard | edge hover → path `ds-electric`, `stroke rgb(59,130,246)`, `drop-shadow(…0 0 8px)`, `stroke-dasharray 5px,5px`, `animation ds-edge-dash`; both endpoints `ds-pulse` + `outline rgb(59,130,246) solid 3px`; label `font-weight 700`; node hover with degree 2 → exactly 2 electric edges + 3 pulsed nodes; pan → wrapper `ds-interaction-active`, 3/3 payloads `visibility: hidden`, cleared on release |
| K2 | SMIL payloads useMemo'd, `flowCount`/`flowDuration`-driven, per-edge random `begin`, `pointer-events:none`, new `event` envelope mode | `dur="2.4s"` ×3; per-edge distinct begins `ea1 0.534s…` vs `ea2 0.872s…`; `path` identical to the edge path; `pointerEvents none`; inspector speed→1.4 ⇒ `dur="1.4s"`, count→5 ⇒ 5 payloads, restore ⇒ `2.4s`/3 |
| K3 | CSS-only re-layout transition (`.35s transform`, class around programmatic layouts) + animation gating | measured 22 interpolated x values 600→0 over ~350ms during auto-layout; class present ≤340ms, gone by 385ms; 3 rapid layouts keep the class through the last; 32-node board → `ds-no-anim`, 31/31 payloads hidden, toggle → visible + `localStorage diagram-studio:animate=1`, survives reload, "use auto" resets |
| K4 | Glow handles: ONE keyframe + `--nc` colour variable | 10 discs (2/shape), `border 2px solid rgb(11,11,13)`, gradient from `--nc`; forced `:hover` → `opacity 1`, `animation ds-handle-pulse 2s infinite`, animating `box-shadow`; non-hovered node `opacity 0`; only 3 `ds-*` keyframes total (ds-edge-dash, ds-node-pulse, ds-handle-pulse) |
| K5 | Post-it on `actor`+`note` only; group header banner + overlapping badge | actor `rotate(-1deg)` matrix, gradient `node-body`, double shadow, fold `18px/18px`, watermark `opacity .2` `rotate(12deg)`; note same + `rotate(1deg)`; service/queue `transform none`, `background none`, no fold/mark; group badge 32px (`border-radius 50%`) overlapping 15px above the group top edge and into the 44px header |

`npx tsc --noEmit` = 0 · `npx vite build` = 0 · boards = only `Kafka rebalance` (3n/2e) + the
pre-existing `Untitled`. All test boards deleted. No new npm dependency; the `flow*` data contract
is unchanged (K2 upgrades it). New files: `src/choreography.ts`.
Regression checks passed: all six flow modes render, undo→redo restores/reapplies layout positions,
inner `.node`/`.note-node`/`.group-node` still fill the RF wrapper both axes (I5), palette/tooltip/
boards/edge labels intact.

**Deviation from spec:** the interaction-guard class lives on `.canvas-wrap` (Diagram Studio's own
canvas wrapper) rather than on `.ds-flow-wrap`, because that is the same element the layout-transition
helper uses and it keeps both K1/K3 wrappers identical; it is still scoped to one wrapper, never `<body>`.
Auto-layout now writes final positions once and lets the CSS transition ease them (the old 300ms rAF
tween is removed) — the spec explicitly preferred this. A `pointerup/pointercancel/blur` reset was
added to the guard because React Flow suppresses a pan-zoom end event when a viewport animation is
interrupted, which would otherwise leave the canvas frozen.


### PACKAGE-J — Canvas navigation (Figma/Miro standard) — DONE 2026-09-14
Harvey's bug: on a Mac trackpad he could zoom but not pan (pan was bound only to the
middle mouse button). He first asked for Excalidraw behaviour, then changed his mind to
the **Figma/Miro standard**. Final behaviour (in `src/App.tsx`):
- `selectionOnDrag` — left-drag on empty canvas = **box-select**
- `panOnDrag={[1, 2]}` — middle/right-drag pan
- `panOnScroll` + `panOnScrollMode={PanOnScrollMode.Free}` — wheel / two-finger = **pan**
- `zoomOnScroll={false}` + `zoomOnPinch` + `zoomActivationKeyCode={['Meta','Control']}`
  — Ctrl/Cmd+scroll or pinch = **zoom**  ← this is the actual fix for his Mac
- `selectionKeyCode={['Shift']}`; default `panActivationKeyCode` (Space) kept
Docs updated to match: `README.md` shortcuts table, the `?` cheat-sheet rows
(App.tsx ~1689), and the `Tour.tsx` "Canvas" step.
**Orchestrator-verified** (not the coder's word): `tsc --noEmit` = 0, `vite build` = 0,
plain wheel → translate changed / scale UNCHANGED at 1.17778 (pans, no zoom);
Ctrl+wheel → scale 1.17778 → 1.6427 (zooms). Spec: `PACKAGE-J-SPEC.md`.

**Note for the next session**: the coder that did PACKAGE-J finished its real work in
~5 min then burned ~24 min in a `pkill`-cleanup loop (pkill kept matching its own shell).
It was stopped. A LOOP-BREAK rule now lives in the orchestrator's
`profile-delegation-playbook` skill — stop any child that repeats a failing action.

## Open question for Harvey — RESOLVED 2026-09-14
**I5:** (a) make **all** shapes resizable ✅ **Harvey chose (a)**. Confirmed in code:
`SHAPES` declares exactly 9 ids and `RESIZABLE` in `DiagramNode.tsx` contains all 9
(`service, database, queue, external, actor, storage, gateway, group, note`) — no gap.

## Still TODO after that
1. ✅ DONE 2026-09-14 — I-fixes re-verified in a fresh session: `npx tsc --noEmit` = 0,
   `npx vite build` = 0, dev server live on :5200, boards clean (Kafka rebalance, 3n/2e),
   I1 spotlight re-measured `.tour-spot l=232 r=1276 t=4 b=573` inside 1280×577.
2. ✅ DONE 2026-09-14 — **Vault write for Diagram Studio** (routed through pkm):
   - `2 Areas/Architecture/ADR/ADR-031 Diagram Studio Standalone React Flow Tool.md` (new)
   - `2 Areas/Hermes/Change Log.md` — `## 2026-09-14` `service` entry
   - `2 Areas/Architecture/System Architecture.md` — "Diagram Studio" section + Mermaid
   - `0 Map of Context/Architecture MOC.md` — ADR-031 appended
   - Bonus (approved): stale ADR index in System Architecture.md extended 027→031 (now 001–031, no gap).
3. Keep it generic: no Harvey/company content baked in; it will be shared.

## Cosmetic note — FIXED 2026-09-14
`src/DiagramNode.tsx` — the stale comment above `RESIZABLE` ("every shape except free-form notes")
was corrected to state that all 9 shapes are resizable. Behaviour unchanged.

## Orchestrator re-verification of PACKAGE-K (2026-09-14, fresh session)
Independently re-measured, not trusting the coder's report: `npx tsc --noEmit` = 0 · `npx vite build` = 0.
Live DOM on :5200: demo board 3 nodes / 2 edges, 6 SMIL payloads at `dur="2.4s"`; real mouse hover over
edge `e1` → 3 `ds-electric` elements, `stroke rgb(59,130,246)`, `drop-shadow(rgb(59,130,246) 0 0 8px)`,
2 `ds-pulse` endpoint nodes; glow discs present (6); `.ds-no-anim .ds-animated-payload{visibility:hidden}`;
selecting an edge exposed the new **Envelope** flow button (inspector: None|Dots|Dash|Pulse|Icon|Envelope)
and clicking it rendered 2 envelope payloads (rect+flap) with `pointer-events:none`. Only 6 `@keyframes`
total in styles.css. Demo board restored clean (both edges `flow: dots`) after the test click.

## Conventions (do not violate)
- English artifacts; Vietnamese only in chat with Harvey.
- Subagents never git-commit; no git repo here yet (Harvey has not asked for one).
- Every spec lives as `PACKAGE-<letter>-SPEC.md` in the project root; implement → verify → report.
- Restore the demo board "Kafka rebalance" (`boards/mu01q1ue3a854b81.json`) to a clean
  3-node / 2-edge state and delete any board created while testing.
