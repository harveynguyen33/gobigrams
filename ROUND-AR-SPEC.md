# ROUND AR — SPEC: SVG export paints nothing + export-modal button flicker

Round: AR. Pre-fix commit: `26baec6` (branch main, tree clean). Author: architect.
Input: Harvey's report (VN, verbatim): "hiện tại tôi add 1 node, export thì SVG ko có hình show? trong khi PNG có. Ngoài ra button của cả 2 SVG, PNG bị flick."
Status: SPEC ONLY — no product code was touched writing this file.

---

## 0. Verified root causes (line-level, this round)

### D1 — SVG export is HTML inside one `<foreignObject>`, and foreignObject does not paint when an SVG is rasterized as an image

- `src/App.tsx:4081` `buildSvg()` mounts an offscreen themed clone (`mountThemed`, `src/App.tsx:4034`),
  prunes non-selected nodes (`:4095-4097`), then wraps
  `new XMLSerializer().serializeToString(clone)` (`:4125`) inside ONE `<foreignObject width="100%" height="100%">` (`:4123`).
  Everything visible — shapes, text, edges — is HTML-in-foreignObject.
- `src/ExportModal.tsx:61-63` sets that string as `<img src="data:image/svg+xml;utf8,…">`; `:204` states
  "what you see is what downloads" — the preview IS the artifact, so the defect ships in the file.
- Confirmed against the DOM evidence supplied: the exported bytes DO contain the node (`.react-flow__node`,
  `.node-title` = "Database"), yet an `<img>`-context raster shows 64,922 px all equal to the background rect
  `#0b0b0d`, diff = 0. Chromium (and every image consumer: Quick Look, Figma, Illustrator, `<img>`, CSS
  background) refuses to paint foreignObject content in image context — resource loading and HTML layout
  inside an SVG used as an image are disabled by design. The bytes are correct; the RENDERING MODEL is wrong.
- `buildPng` (`src/App.tsx:4135`) rasterizes the live DOM via canvas, so PNG is unaffected. Verified.
- Secondary (same item): the theme-token CSS inlining (`EXPORT_TOKENS` at `src/theme.ts:115`, `collectCss`
  at `src/App.tsx:4054`, token `<style>` at `:4111-4122`) exists ONLY to style that HTML clone. Under Option A
  most of `collectCss` becomes dead weight for SVG (no HTML classes left to style) — see AR-1 step 5.

### D2 — every segmented control is REMOUNTED on each state change; the primary button's label flips on every preview rebuild

Two independent mechanisms, both verified:

- **D2a — `Seg` is defined INSIDE the component body** (`src/ExportModal.tsx:136`). Its type identity is new
  on every render of `ExportModal`, so React unmounts and remounts the whole `.em-seg` subtree on any state
  change (`scope`/`format`/`theme`/`busy`/`preview`/`tab`). Each remount restarts every CSS transition,
  `:hover` and `:active` state → the flicker Harvey sees. Matches the measured 0/12 marker survival.
- **D2b — the preview effect re-runs on unstable identities, and `busy` drives the label.** The effect at
  `src/ExportModal.tsx:55-84` has deps `[open, scope, format, theme, nodes, edges, liveTheme, boardName, buildSvg, buildPng, scoped]`.
  `buildSvg`/`buildPng` are passed INLINE from `App.tsx:5940-5941` and are re-created on every App render
  (they are plain consts in the component body, `src/App.tsx:4081/4135` — no `useCallback`), so ANY App
  re-render re-triggers a preview build. Inside, `setBusy(true)` (`:58`) → label flips to "Rendering…"
  (`:207`) → `setBusy(false)` (`:81`), and `busy` also disables the button (`:206`). Because D2a remounts the
  buttons anyway, the label flip lands on a fresh node. It is interaction-driven, not a loop (6 s idle = 0
  mutations, as measured). NOTE: `busy` is ONE state for TWO meanings — "preview rebuilding" and "download in
  flight". The first must not change the label at all.

---

## 1. Architecture decision: Option A — real SVG primitives

**Recommendation: Option A.** The exporter stops serializing DOM and instead derives real SVG
(`rect`/`path`/`text`/`line`/`ellipse`/`circle` + `<defs>` markers) from the node/edge MODEL, keeping the
existing theme-token inlining so the file stays theme-faithful with zero DOM cloning.

- **Option B (rejected stopgap):** keep the HTML clone, embed a rasterized PNG inside the SVG via
  `<image href="data:image/png…">`. It WOULD paint everywhere (an image inside an image context is fine).
  What the user loses: no crisp zoom (pixels, not vectors), no selectable/searchable text, no vector editing
  downstream (Figma/Illustrator get one flat bitmap), file size is the PNG's, and the "SVG" is a lie — it is
  a PNG wearing an SVG extension. Acceptable only as a one-line hotfix if Option A were blocked; it is not.

**Why A is cheap HERE specifically:** this repo already owns every primitive we need as pure data.
`src/shapes.tsx:107` `ShapeFrame` draws all 30+ shapes from literal path/rect/ellipse geometry in a
normalised 200×100 viewBox — the geometry is already SVG, currently wrapped in React. The edge kinds are
produced by pure path generators (`getSmoothStepPath`/`getBezierPath`/`getStraightPath` plus
`src/edgeBend.ts` waypoints). Crow's-foot markers are hand-authored SVG (`src/crowfoot.tsx`). So the exporter
is assembly of existing geometry, not a re-draw.

**Shape-family → primitive map (this repo's actual families):**

| Family in this repo | Source of truth | Export primitive |
|---|---|---|
| All `goblin` shapes (service, external, database, queue, actor, storage, gateway + 16 ISO-5807 + lifeline/activation/fragment) | `ShapeFrame` geometry, `src/shapes.tsx:107-295` | the SAME path/rect/ellipse data, re-emitted as markup — see AR-1 step 1 (single source, not a copy) |
| Node text: kicker / title / sub / metric, incl. `label-only` bodies | `src/DiagramNode.tsx:478-489`, `textStyle.ts` vars | `<text>`/`<tspan>` with the token `<style>` carrying the same font stack (`ui-monospace…`, already the exported CSS at `App.tsx:4115-4121`) |
| Node icon glyph (lucide `d.icon`) | `IconGlyph`, `src/DiagramNode.tsx:179` | **DEFERRED this round**: emit the existing fallback path — a plain unicode/text glyph — never an empty gap. Rationale: lucide icons are React components; extracting their path data is a separate, mechanical follow-up |
| Notes (post-it) | `POSTIT` markup, `src/DiagramNode.tsx:392` | `<rect>` + fold-corner `<path>` + `<text>` |
| Edges (straight/bezier/smoothstep/step, bends, crow's-foot, arrowheads, flow icons) | path generators + `src/edgeBend.ts` + `src/crowfoot.tsx` + `src/flowIcons.tsx` | `<path d>` from the SAME generator call, markers in `<defs><marker>`, label as plate `<rect>` + `<text>` |
| Tables (ERD) | `src/TableNode.tsx` data (`name`, `columns[]`, show-mode) | header `<rect>` + colour strip + one `<text>` row per visible column; PK/FK dots as `<circle>`; honours the node's collapsed state |
| Free labels (`label` kind) | `src/LabelNode.tsx` | `<text>` block only (transparent background, as rendered) |
| Custom imported shapes (`customshape` kind) | `data.svg` — ALREADY sanitised SVG markup (`src/customShape.ts`) | nested verbatim inside a positioned `<g>` — it is real SVG today, zero conversion |
| Groups / boundaries | child bounds of `parentId` groups | one `<rect>` frame behind the children, derived from `getNodesBounds` of the group's members |

**Deliberately deferred (named, not silently dropped):** lucide icon path extraction (unicode fallback
ships instead), pixel-parity of HTML text wrapping vs SVG `<text>` line breaking (see acceptance — parity is
NOT claimed, presence is), and edge text-style micro-typography (font vars only).

**What we are explicitly NOT doing:** no DOM cloning, no `collectCss` for the SVG path (tokens only), no
change to `buildPng`, no change to JSON/Mermaid exports, no foreignObject anywhere in the output.

---

## 2. Items

### AR-1 — `buildSvg` emits real SVG primitives from the model

**Change.**
1. Extract `ShapeFrame`'s geometry into a pure string emitter (e.g. `shapeFrameSvg(shape, {plain})` returning
   the inner markup + wrapper attributes) in `src/shapes.tsx`, and make the React `ShapeFrame` render THAT.
   ONE source of truth — the file's own rule ("never a second copy free to drift", `src/shapes.tsx:127-132`)
   applies to the exporter too. The emitter must accept fill/stroke as resolved values (see step 4).
2. New module `src/exportSvg.ts`, React-free and pure (input: scoped nodes, edges, theme token map; output:
   SVG string). Emits: background `<rect>`, `<style>` with the `EXPORT_TOKENS` block, per-family primitives
   per the table above, `<defs>` markers. Nodes positioned by `translate(x,y)` inside the bounds-derived
   viewBox — same `getNodesBounds` + `pngPad` arithmetic `buildSvg` uses today (`src/App.tsx:4084-4087`).
3. `App.tsx` `buildSvg` (`:4081`) becomes a thin wrapper: resolve tokens (existing `tokensFor`/`readToken`
   logic, `:4101-4104`), resolve per-node `--nc` via the existing `resolveColor` path, call `exportSvg`.
   `mountThemed`/`collectCss` are no longer called by `buildSvg` (they remain for `buildPng` unchanged).
4. Theme fidelity: same `EXPORT_TOKENS` list, same `data-theme` attribute on the root `<svg>`, `var(--…)`
   references resolve against the inlined `<style>` — no colour literals except where a token is
   unresolvable (same fallback chain as today).
5. Bundle/ratchet: the new module adds client JS. Measure `find dist/assets -name '*.js' -exec cat {} + | wc -c`
   before/after; update `ratchet.ceiling` in the AGENTS.md gob block ONCE, to the measured post value, named
   increment `round-ar-export-svg`. The ratchet must move DOWN again in any later round that shrinks it.

**Files/functions:** new `src/exportSvg.ts`; `src/shapes.tsx` (`ShapeFrame` → shared emitter);
`src/App.tsx:4081` `buildSvg`; `AGENTS.md` gob block (ratchet ceiling only).

**Acceptance (machine-measured, via AR-5):**
- Rasterize the exported SVG through an `<img>` into a canvas: pixels differing from the background rect
  MUST be > 0 (pre-fix: 0 of 64,922) AND the node's own accent colour MUST be present among the painted
  pixels (sampled by hex match against the resolved `--nc` token).
- The exported bytes MUST contain the node's title text as `<text>` content, and MUST contain
  `data-theme="<theme>"`.
- The SVG MUST render in IMAGE context: load via `<img>` and assert `naturalWidth > 0` AND the canvas has
  non-background pixels (the D1 instrument itself — Quick Look parity follows from image-context support).
- The bytes MUST NOT contain `<foreignObject` (string assert).
- PNG path unchanged: `buildPng` diff = 0 lines.
- Budget: exporting a 70-node synthetic board must complete in ≤ 2000 ms (harness prints the number;
  pre-fix number recorded for comparison).

### AR-2 — `Seg` hoisted to module scope

**Change.** Move the `Seg` component out of the `ExportModal` body (`src/ExportModal.tsx:136-149`) to module
level (top of the file, below the constants). It needs `selCount` — pass it as a prop instead of closing over
it. Same JSX, same classes, same aria wiring; `tabRef` stays a prop.

**Files/functions:** `src/ExportModal.tsx` only.

**Acceptance (via AR-6):** mark every `.em-seg button` with `data-ar-marker`; click one Theme option; assert
12/12 markers survive immediately AND after 600 ms (pre-fix: 0/12). The Scope/Format/Theme groups together
have exactly 12 buttons (2+4+6) — the harness asserts the count is 12 before clicking, so a lost group fails
loudly.

### AR-3 — `busy` split: preview rebuilds must not touch the primary button

**Change.** Two states in `src/ExportModal.tsx`: `previewBusy` (set inside the preview effect, `:58/:81`) and
`exportBusy` (set in `doExport`, `:96/:124`). The primary button's label and `disabled` read ONLY
`exportBusy` (`:206-208`); a preview rebuild keeps the previous preview on screen (no clearing to `…`) while
it runs. `Seg` and the tabs never read either flag.

**Files/functions:** `src/ExportModal.tsx` (`:41`, `:55-84`, `:95-126`, `:206-208`).

**Acceptance (via AR-6):** with the modal open and an UNCHANGED selection, fire one Theme click and record
the primary button's `textContent` via MutationObserver for 3 s: it MUST remain `Export SVG` throughout
(pre-fix: flips `Export SVG` → `Rendering…` → `Export SVG`). The button must also stay enabled.

### AR-4 — stable `buildSvg`/`buildPng` identities

**Change.** Wrap both builders in `App.tsx` in `useCallback` with honest deps (`theme`, `pngPad`, and the
refs they read), or hold them in a ref updated in an effect — either way, the props passed at
`src/App.tsx:5940-5941` keep identity across App re-renders that don't change theme/pad, so the preview
effect (`ExportModal.tsx:84`) no longer re-fires on unrelated renders. `scoped` identity is already
memoised (`:46-53`); `nodes`/`edges` in the dep array are the live state and are correct to keep.

**Files/functions:** `src/App.tsx:4081/4135` (+ the JSX at `:5940`).

**Acceptance (via AR-6):** with the modal open, trigger an App re-render that does NOT touch nodes/edges/
theme (e.g. one inspector hover or a panel toggle outside the modal): the preview effect must NOT rebuild —
assert 0 preview-image `src` mutations over 2 s (pre-fix: rebuild + label flip on every such render).

### AR-5 — harness `checks/round-ar-svg-export.mjs` (new)

Real Chrome against the dev server. Steps: open the app, add a known node (accent `--c-accent` resolved),
open the export modal, read the preview `<img>`'s data URI, decode through an `<img>` → canvas, count
non-background pixels, sample for the accent hex, string-assert `<text` + title + `data-theme` + absence of
`<foreignObject`, click Export and read the downloaded file's bytes with the same asserts, then load a
70-node board and time `buildSvg` (exposed for the harness the same way existing harnesses reach app
internals — follow `checks/round-ad-flowchart.mjs`'s pattern). Also `diff`s `buildPng`-related source? No —
PNG non-change is proven by `git diff` in review, not by this harness.

**Negative control / replay:** the full check MUST be RED on `26baec6` (pixel-diff = 0 there). Register in
the AGENTS.md gob block replay list per convention (`replay.cmd: node checks/round-ar-svg-export.mjs`), so
`GOBLIN_PRE_COMMIT` runs it against the pre-fix tree.

### AR-6 — harness `checks/round-ar-modal-stability.mjs` (new)

Real Chrome. Markers on all `.em-seg button`s (assert count = 12) → one Theme click → 12/12 markers at 0 ms
and 600 ms. MutationObserver on the primary button for 3 s around a Theme click: label constant, never
disabled. Idle 2 s after an out-of-modal App re-render: 0 preview `src` mutations. Negative control / replay:
RED on `26baec6` (0/12 markers, label flip observed).

---

## 3. Existing harness survey (mechanical, this round)

`grep` over all 41 files in `checks/` (`*.mjs`): NO check references `buildSvg`, `buildPng`, `ExportModal`,
`foreignObject`, `em-seg`, or `em-img`. The only AQ21 mention anywhere is a comment in
`checks/package-o-metrics.mjs:491-492` about the retired bare `.pop` dropdown — a narrative note, not an
assertion on the export path. **Conclusion: nothing pins the current SVG implementation; no re-anchoring of
existing numbers is required.** The only ratchet interaction is the `client_js_bytes` increment in AR-1
step 5 (named, measured, one-way-up-with-reason — the sanctioned mechanism, not a weakening).

---

## 4. Out of scope / regression watch

Out of scope this round: lucide icon vector extraction (unicode fallback ships), pixel-parity between SVG
text layout and the HTML rendering, Mermaid/JSON export paths, `buildPng` (must be untouched, `git diff`
clean on its body), Import tab, edge-label micro-typography, and any change to the live board rendering
(`ShapeFrame`'s React output must be byte-identical markup after the extraction — AR-5 asserts the app still
boots and `package-o-selection-stack.mjs`'s `svg.shape-frame` assertions stay green).

Regressions to watch, all gated: the 39 existing harnesses stay green; `npx tsc --noEmit` and
`npx vite build` pass; `todo_ceiling` gate satisfied (no new TODO/FIXME); `client_js_bytes` under the
re-anchored ceiling; 70-node export ≤ 2000 ms; PNG path diff = 0; theme fidelity (all 6 theme choices
produce their own `data-theme` + token set — AR-5 asserts for `dark` and `light` at minimum).

---

## 5. Sequencing

AR-2 and AR-3 are independent of AR-1 (do them first — small, unblock Harvey's flicker immediately).
AR-4 after AR-3 (both touch the busy/effect wiring). AR-1 is the large item; AR-5/AR-6 are written AGAINST
the pre-fix tree first (to prove RED), then land with their items. One commit per item, per house rules.

---

## AMENDMENT 1 — orchestrator, measured 2026-10-19 (constrains AR-5/AR-6; AR-1…AR-4 unchanged)

Two facts this spec's AR-5/AR-6 assumed wrongly, both re-measured before dispatch:

1. **This repo has no browser automation dependency.** `package.json` carries none (no puppeteer, no
   playwright), and all 41 `checks/*.mjs` are DOM-free Node scripts. `checks/round-ad-flowchart.mjs` states
   the house rule in its own header: *"No browser, no DOM, no CDP… Nothing here is a painted measurement —
   that is the orchestrator's live pass."* A harness therefore CANNOT be "real Chrome against the dev
   server", and adding a browser dep is out of scope (no new npm dependency since PACKAGE-Q is standing).
2. **`src/exportSvg.ts` being React-free and pure (AR-1 step 2) is what makes it testable** — that is the
   house style, not a side benefit.

**AR-5 revised** — `checks/round-ar-svg-export.mjs`, bundling/importing the REAL modules with the project's
own esbuild as `round-ao`/`round-ad` do, then asserting on the exporter's OUTPUT STRING and geometry:
- no `<foreignObject` anywhere in the output; root `<svg` carries `data-theme="<theme>"`;
- `<text>` content includes the node's title;
- for each known shape family the emitter paints primitives inside the node box and their union covers a
  non-trivial area of it (arithmetic over the emitted geometry, the same style as AD's frame checks);
- `<style>` carries the `EXPORT_TOKENS` block for the chosen theme;
- **negative control**: the same script MUST be RED on `26baec6` (the pure emitter does not exist there).

**AR-6 revised** — `checks/round-ar-modal-stability.mjs`, DOM-free, three source assertions that are RED on
`26baec6`, with comments blanked before counting (the round-ad rule, so a docblock that quotes the
construct cannot read as a defect):
- `Seg` is declared at module scope, and there is NO `const Seg` inside the `ExportModal` function body;
- the primary button's label and `disabled` read `exportBusy` only, and the preview effect no longer sets
  the flag that drives the label;
- `buildSvg`/`buildPng` are identity-stable (useCallback or a ref) and the modal receives them as props.
Its header must state plainly that the BEHAVIOURAL proof — 12/12 markers surviving a state change, a
constant primary label, 0 preview `src` mutations on an unrelated App re-render — is the orchestrator's and
reviewer's LIVE CDP pass, exactly as AD does.

**Sequencing amended: TWO coder dispatches, not one.** PASS 1 = AR-2, AR-3, AR-4 + AR-6 (small; unblocks
Harvey's flicker immediately). PASS 2 = AR-1 + AR-5 (the serializer). Reason: a `chat -q` child cannot be
steered mid-run, and its budget is the binding constraint — one mega-brief for four items plus a new
serializer is how a round dies after its commits with no harness.

Live on `:5200` while the coder works: HMR reloads the running app, so Harvey's parallel manual test must
pause for the duration of PASS 1 (he is told), and the 39 existing harnesses are re-run by the orchestrator
afterwards.

---

## PASS 3 SCOPE — decisions recorded by the orchestrator, 2026-10-19 (Harvey's call)

An independent reviewer QA pass over `26baec6` produced nine findings. Four of them carry design content and
are being specced separately as ROUND AS (F1 invalid Mermaid export, F2 the importer cannot read our own
export, F3 import destroys the undo history, F4 a deleted board resurrects itself through autosave PUT). The
rest are mechanical and land here.

**AR-7 — F8, Harvey decided: KEEP the React Flow attribution and theme it.** The badge has been hidden since
the initial commit `f59783f` in two places: `proOptions={{hideAttribution: true}}` on `<ReactFlow>`
(`src/App.tsx:6075`) and `.react-flow__attribution { display: none; }` (`src/styles.css:892`). Remove BOTH,
then theme the badge so it reads as part of the canvas (it is a `Panel` in the bottom-right corner). Rationale,
quoted from the library's own policy page: *"We can't legally require you to keep the attribution — React Flow
is MIT-licensed — but to keep the library MIT, we need your support. Our policy is simple: attribution
visible, no subscription needed; no attribution, please subscribe."* The attribution element's own
`data-message` says the same. React Flow's licence is MIT (`node_modules/@xyflow/react/LICENSE`), so this is a
policy/optics fix, not a legal one. The README credit lines (`README.md:4`, `:230`) stay exactly as they are.

**AR-8 — F5/F6, the first-load console is not clean.** Two React 19 errors every load: "Accessing element.ref
was removed" (`src/Tooltip.tsx:167` reads the child's ref), plus a "unique key … ForwardRef" warning the
reviewer could not attribute (stack stripped). Both must be gone, or attributed with the offending line named —
a public release should not open with a red console.

**AR-9 — F7/F9, visible copy.** `src/ExportModal.tsx:112` says "colours/text styles/icons are not
representable" — British, while the app standardised on American spelling in ROUND AH. And the preview/status
line reads "1 nodes · 0 edges" for a single node (`src/ExportModal.tsx:99/104/168`) — pluralise properly.

**Ordering:** PASS 2 (AR-1 + AR-5) → reviewer structural pass on the serializer → PASS 3 (AR-7/AR-8/AR-9) →
the ROUND AS coder pass. One commit per item, local only; the orchestrator pushes after independent
verification.
