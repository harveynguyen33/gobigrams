# HANDOFF — Diagram Studio

## ▶ 2026-10-20 (overnight) — ROUND AR + ROUND AS LANDED, 2 AR DEFECTS OPEN, ROUND AT QUEUED

Read this block first. Everything below is history.

**Tree:** branch `main`, HEAD recorded in the commit that added this block; ~28 commits ahead of origin
(Forgejo) and github-mirror, both of which sat at `26baec6` before tonight.

**Gates measured at HEAD (orchestrator, not self-reported):** `npx tsc --noEmit` 0 · `npx vite build` 0 ·
**46/46 harnesses green** · `client_js_bytes` **870,070** (declared ceiling still 831,522 — see OPEN #3) ·
dev server `:5200` HTTP 200.

**ROUND AR — Harvey's two defects, plus everything the round grew into**
- SVG export is REAL VECTOR now (`src/exportSvg.ts`, no `foreignObject`). Measured on a live export: the preview
  canvas went from **0 to 20,668 of 64,922** pixels differing from the background; the file opened as an image
  document went from **2 colours to 945**; the file shrank 20,773 → 1,867 bytes; all five themes produce different
  output; PNG is untouched (2× the viewBox).
- The flicker is gone: all **12/12** `.em-seg` buttons survive a state change (was 0/12), the primary button no
  longer flips to "Rendering…" during preview rebuilds, and an unrelated App re-render no longer rebuilds the
  preview.
- Reviewer-found defects repaired: diagonal-edge labels sit inside the viewBox (were at x=855.8 and x=1,445.9 on a
  658-wide canvas), long titles wrap inside the box, group children export at absolute positions. Each carries a
  harness assertion that is RED on `8fde9dc` (20/24).
- React Flow attribution KEPT and themed (Harvey's decision): visible, themed on all five themes, not overlapping
  the controls.
- Console clean on a fresh load (Tooltip's React 19 `element.ref` read fixed); copy fixed ("colors",
  "1 node · 0 edges"); every text row is measured AND emitted with its own computed font.

**ROUND AS — Mermaid contract + data safety**
- Mermaid export emits the standard `id("label")` form; zero colon-form lines. The importer reads its own output
  losslessly — **9/9 nodes keep label AND shape** — and still reads the old colon form (round node, database,
  edge lines, inside a subgraph), keeps a colon inside a label (`port: 8080`), and skips `%%` comments.
- A Mermaid import is ONE undo entry (pushHistory before the append, no history wipe; failed parse = zero entries).
- `PUT /api/boards/<missing>` → **404, no file, no resurrection** (measured live), and the client never retries 4xx.
- `vite preview` serves `/api/*` via `configurePreviewServer`.
- Board writes keep **ONE `.bak` generation** (measured live: PUT A then PUT B leaves `.bak` holding doc A), and the
  implicit autosave guard became an explicit named predicate — HARDENING, not a fix: the 2026-10-19 board loss has
  no proven cause.
- Incident on record: `boards/mvaf8pkt162b2aed.json` went to 0 nodes at 00:06:10 on 2026-10-19, no backup existed,
  cause undetermined. AS-6 exists so a second overwrite is recoverable.

**OPEN (neither blocks the push)**
1. **AR defect — three text rows still export in the wrong typeface: edge label (canvas mono 11/600), table column
   (mono 11/400), group title (mono 12/600) all emit sans 10.5 with no `font-family`. `round-ar-font-parity`
   currently asserts the wrong behaviour, so it is green while parity is wrong.** Queued as kanban `t_aa6accb1`.
2. **AR defect — intermittent React key warning**, 1 of 4 fresh loads, no stack in the production build; needs a
   dev-build repro (same card).
3. **Ratchet raise is BLOCKED on an interactive approval.** Harvey approved it verbally; `AGENTS.md` is a protected
   agent-instruction file, the approval prompt cannot be answered while he is away, and the gate refused the write
   for the orchestrator too. Measured `870,070` vs declared `831,522` (which was already exceeded before this work,
   at 859,044). Nothing was edited — do not read this as a silent raise.

**QUEUED (kanban, gateway-dispatched so it survives a closed chat session):** `t_aa6accb1` = the two AR defects →
ROUND AT (`ROUND-AT-SPEC.md`, 7 items, browser-local storage) → reviewer verification. Workers commit locally and
never push; the orchestrator pushes after measuring.

**MORNING CHECKLIST (5 minutes, on the Mac)**
1. Export SVG → open the file in Preview/Figma: shapes AND real selectable text, not a background-only rectangle.
2. Export modal: click SVG / PNG / each theme — no button flicker, no label flashing "Rendering…".
3. Mermaid: export a board, paste the text back into Import → titles and shapes survive; one Cmd+Z removes it.
4. Boards: save a board twice → a `.bak` appears beside it in `boards/`.
5. Approve the ratchet: `AGENTS.md` → `ratchet.ceiling` → `870070` (the reason comment is written and waiting).

## ▶ ROUND AR PASS 2 (coder, 2026-10-19) — AR-1 landed at e0fb1d0; ONE ORCHESTRATOR ACTION OPEN

AR-1 (SVG vector serializer) is COMMITTED at `e0fb1d0` (local, not pushed):
`src/exportSvg.ts` new (React-free pure emitter, injected measurer), `src/shapes.tsx`
geometry lifted into one data table (ShapeFrame renders it), `src/App.tsx` buildSvg is a
thin wrapper. Gates measured: tsc 0 · vite build 0 · goblin-verify 22 passed / 0 failed ·
client_js_bytes 866161.

**OPEN — the ratchet re-anchor could NOT land:** AGENTS.md is a write-protected agent
instruction file for this profile (approval gate timed out, single-query session). The
gob block still says `ratchet.ceiling: 831522` while the measured value is 866161, so
goblin-verify's ratchet row reads OVER CEILING until the orchestrator applies:

```
ratchet.ceiling: 866161
ratchet.increment: round-ar-export-svg (AR-1: real SVG primitives replace the
  foreignObject serializer; measured 2026-10-19 at e0fb1d0)
```

## START HERE

Read the newest `## ▶` section below — it is the current state of the repo. The gob
config lives in `AGENTS.md`; the gate is `npx tsc --noEmit && npx vite build`.
Conventions (demo board restore, English artifacts, per-round spec files) are in
`docs/GUIDE.md`-shaped prose at the bottom of this file and in the newest round section.










































## ▶ SESSION CLOSED 2026-10-15 — HEAD 3b26faa (pushed, 0 ahead, mirror synced, 40/40 GREEN).

This session shipped: AQ16 (auto-scale min width) · AQ17 (dblclick next-nearest)
· AQ18 (drop double-subtract fix) · AQ19 (centre-under-cursor) · AQ19b/c/d/e
(drop-jump X-only + per-node natural resize floors) · AQ20 (search purpose
lines for all duplicated shapes) · AQ21 + F/G/H (Export modal: scope/format/
theme/preview, Import tab, theme-faithful SVG/PNG via mountThemed) ·
PACKAGE-SEQ (sequence diagrams) then SEQ-HIDE (hidden behind
SEQUENCE_ENABLED=false in presets.ts — one-flag restore).

**Harvey's stated next step: a FINAL TEST ROUND, then PUBLIC RELEASE.**

Next-session pointers:
- Sequence redesign backlog (research at `.hermes/research/track1-sequence-notation.md`,
  24 sources): column-constrained participants, ordered message model, derived
  activations, Mermaid sequence import. Flag = SEQUENCE_ENABLED in presets.ts.
- Vault debt: one batched pkm pass for AQ2..AQ21 + PACKAGE-SEQ (still unwritten).
- #7 bend handle: still awaiting Harvey's phenomenon description.
- Mermaid import is FLOWCHART-ONLY (fromMermaid); sequence import not built.
- Known pre-existing: Mermaid-export modal says "sequenceDiagram — activations/
  fragments not representable" (fine); dev browser boards hold test nodes
  (gitignored runtime data).

Gates at HEAD: tsc 0 · build 0 · verify 22/0/5 · hex 144 · 40/40 harnesses.

## ▶ AQ19d/e — no vertical motion after drop; width floor = per-node natural. DONE, 40/40 GREEN, live-verified.

Harvey, two more cylinder issues:
1. **Still jumps up ~1s after drop** — AQ19b fixed only the 1150ms pass, but
   the grow ladder's 60/150ms steps land BEFORE the 320ms pass, so the cylinder
   is already taller than the estimate when pass 1 re-centres Y. Fix: BOTH
   passes are now X-ONLY. Vertical is decided at insert time (the centre
   estimate) and never revisited — growth extends downward from the placed
   head. LIVE-VERIFIED: cylinder drop, position sampled across 0-3s is
   x=557 y=473 CONSTANT while h settles 128; zero motion.
2. **Width: stretch → shrink never returned to the dropped width** — same
   static-floor bug as the height (AQ19c): resizer `minWidth` was NODE_MIN_W
   (200) while a fresh drop is 190 (the CSS floor). Fix mirrors AQ19c:
   `naturalWRef` measured alongside the height; `minWFloor =
   min(NODE_MIN_W, naturalW)`. Shrink-below-content is safe (AQ15c auto-grow
   re-widens).

Harness re-anchors: round-5 7b (minWFloor derivation), round-r S3 (both floor
derivations + clamp constants), R5/S1 (compare against clamp constants; a
stray debug line removed).

Gates: tsc 0 · build 0 · verify 22/0/5 · **40/40 harnesses**.

## ▶ AQ19c — resize floor = the node's own natural height (shrink-back == fresh-drop size). DONE, 40/40 GREEN.

Harvey + screenshot: a fresh-dropped node is SMALLER than the same node after
stretch → shrink-to-minimum (right panel ~15px taller). Root cause: the
resizer's static floor `NODE_MIN_H` (141, the ROUND-S worst-case across ALL
shapes — queue) applied to every node, while a fresh database drop sits at its
grown natural height (131). Shrink could never go below 141.

Fix (`src/DiagramNode.tsx`): `naturalHRef` records the node's measured natural
height — written by the grow-check when content fits (wrapper.offsetHeight) and
after each grow (target). `minHFloor = min(NODE_MIN_H, naturalH)` when measured
(else 141) feeds `NodeResizer minHeight`. Text spill stays impossible: shrink
below content triggers the AQ15c auto-grow ladder, which re-raises the node.
Harness re-anchors: round-5 7b + round-r S3 now pin the minHFloor derivation
(the worst-case vertical guarantee moved to auto-grow); R3 parses clean again.

NOTE: CDP-driven resize simulation could not grab the NodeResizer handles
(pointer-capture quirk of the test harness, not the app) — the prop wiring is
tsc/harness-verified; the behavioural check is Harvey's device test.

Gates: tsc 0 · build 0 · verify 22/0/5 · **40/40 harnesses**.

## ▶ AQ19b — drop jump fix: the 1150ms re-centre pass is X-ONLY. DONE, 40/40 GREEN, live-verified.

Harvey: dropping a node made it JUMP UP ~1s later (cylinders only). Root cause:
the cylinder auto-grow ladder (up to ~2.2× height) runs inside the AQ19
two-pass re-centre window; pass 2 re-centred BOTH axes, so after the growth the
pass yanked the grown body's centre back to the drop point — a visible upward
jump ~1s after the drop, on exactly the shapes that grow (cylinders).

Fix: pass 2 is X-ONLY. The user placed the HEAD — auto-growth belongs BELOW it,
so vertical is anchored at pass 1 (320ms, before growth) and never touched
again. Horizontal still recentres (width estimates can be off).

LIVE-VERIFIED: cylinder dropped at (600, 300) — position sampled at ~0.4/1.0/
1.6/2.5s stays y=235 x=505 constant while height settles 95→131 (grew); centre
lands exactly on the drop x. No jump.

Gates: tsc 0 · build 0 · verify 22/0/5 · **40/40 harnesses**.

## ▶ PACKAGE-SEQ-HIDE — sequence hidden behind SEQUENCE_ENABLED=false. DONE, 40/40 GREEN, live-verified.

Harvey: the first sequence cut reads poorly ("tệ quá") — hide it for now, the
design will be revisited; the near-term priority is a final test round then
public release.

**One flag, three gates** (all code stays in the tree — flipping
`SEQUENCE_ENABLED` to true in `src/presets.ts` restores everything):
1. `LIBRARY` spread: `...(SEQUENCE_ENABLED ? SEQUENCE_PALETTE : [])` — search
   + palette + Mixed lose the 3 sequence rows.
2. `PRESETS` record: `...(SEQUENCE_ENABLED ? {sequence: SEQUENCE_PRESET} : {})`
   (cast `as unknown as Record<PresetId, DiagramPreset>` — the key is
   flag-gated) — board dialog + templateCatalog lose the family + 3 templates.
3. Shapes stay REGISTERED in the Shape union/SHAPES/ShapeFrame (no harness
   count churn); they are simply unreachable from any palette.

Live-verified: templates gallery shows Flowchart/C4/Data model only (0
"Sequence" buttons); palette sidebar has no Sequence section.

INCIDENT during this pass: a bad insert briefly duplicated most of
`src/presets.ts` (blind `find('
};')` surgery); repaired by deleting the whole
duplicate copy — final `git diff` verified to contain ONLY the flag change
(+10/−5), symbol counts 1× each, tsc/build/harnesses green.

Gates: tsc 0 · build 0 · verify 22/0/5 · **40/40 harnesses**.

## ▶ PACKAGE-SEQ — UML Sequence diagrams ship: 3 levels (System / Component / Protocol). DONE, 40/40 GREEN, live-verified.

Harvey: research sequence charts, then — matching the flowchart experience —
build 3 sequence-chart variants at 3 levels. Research (deleg_5be68934, 24
sources, notes at `.hermes/research/track1-sequence-notation.md`) → synthesised
spec → built overnight for Harvey's morning review.

**The 3 levels (research-backed, Larman SSD lineage):**
- **Sequence · System** (basic) — actors ↔ one black-box system, loop fragment,
  boundary messages + replies.
- **Sequence · Component** (advanced) — typed lifelines (service/db/queue),
  activation bars, notes — the DEFAULT for design work.
- **Sequence · Protocol** (complex) — alt fragment, queue lifeline, dividers.

**What was built:**
- `src/shapes.tsx`: 3 new shapes — `lifeline` (head box + dashed stem in ONE
  frame; stretch the node → longer lifeline), `activation` (thin bar),
  `fragment` (UML 2.5 frame + pentagon label tab; kind lives in the kicker).
  Both ShapeFrame and ShapePreview drawn.
- `src/palette.ts` + `src/categoryState.ts`: DiagramType + PaletteCategory
  gain `sequence`; TYPE_LABEL/SOURCE_PURPOSE rows (search modal annotates
  "Sequence — a piece of a UML sequence diagram").
- `src/presets.ts`: PresetId `sequence`; SEQUENCE_PALETTE (3 rows, purpose
  lines carry the S1/S2/S3 tier); SEQUENCE_PRESET (straight edges, ArrowClosed
  default marker, paper/lines theme, 3 templates registered at basic/advanced/
  complex — surfaced automatically by templateCatalog).
- Message semantics: `EdgeData.seqMsg: 'sync'|'async'|'return'|'self'` →
  GoblinEdge derives arrowhead (ArrowClosed for sync, Arrow for the rest) +
  dash (return/self dashed) per render; template edges carry the field.
- Mermaid: `toMermaidSequence` — participants ordered by x, messages ordered by
  y, `->>` sync / `-->>` return / `-)` async; ExportModal picks the sequence
  branch automatically when any edge carries seqMsg.
- Harness re-anchors (this round DID add shapes): package-templates fixture
  28, round-4 union pin 28 + message, round-ad hint collision fixed (Lifeline
  hint unified 'head + dashed stem'), round-al style-probe accepts the seqMsg
  wrapper spelling (identity semantics unchanged).

**LIVE-VERIFIED:** gallery shows Sequence · System/Component/Protocol; picking
Component loads 8 nodes (3 lifelines + 3 activations + note + title) + 4
messages; return edges render dashed (styleDash 6,4); Mermaid export emits a
valid sequenceDiagram (participants by x, sync ->>, return -->>).

**KNOWN V1 LIMITS (deliberate, next-round candidates):** participant x-only
drag + message-order row model not enforced (freeform positions still win —
the column constraint is the research's big ~30% item); activations are
placeable, not derived; fragment frames are visual (no operand enforcement);
no import of Mermaid sequence syntax (fromMermaid stays flowchart-only).

Gates: tsc 0 · build 0 · verify 22/0/5 · **40/40 harnesses**.

## ▶ AQ21-H — offscreen re-theme: exports now match a real Appearance switch; flicker gone. DONE, 40/40 GREEN, live-verified.

Harvey: exporting with a non-live theme STILL didn't bring the colours a real
Appearance change does; also changing modal controls made the board flicker
behind the modal.

Root causes, one fix:
- buildSvg serialized tokens but the clone's paint-time styles (theme-scoped
  rules, text mixers, pseudo-elements) had resolved under the LIVE theme.
- buildPng's html-to-image ran on the LIVE viewport and MUTATED its transform
  (translate/scale) mid-render — the board visibly jumped behind the modal,
  and computed styles were still live-theme.

**`mountThemed(source, theme)`**: clones the viewport into an offscreen host
(`position:fixed; left:-100000px`) with `data-theme=<target>`, lets the REAL
stylesheet style it (2 rAF), and removes it after. Both builders now render
THAT clone — identical mechanics to switching Appearance, zero contact with
the visible board (transform never touches the live viewport → flicker gone).

LIVE-VERIFIED: live theme dark + export theme light → SVG bg #f7f7f8 (correct),
documentElement data-theme still dark, 0 themed hosts leaked into body; PNG
preview renders 3052×9082 through the same path.

Gates: tsc 0 · build 0 · verify 22/0/5 · **40/40 harnesses**.

## ▶ AQ21-G — theme-faithful SVG export; Import as its own tab. DONE, 40/40 GREEN, live-verified.

Harvey: switching the export theme made the preview look washed out/dim vs the
real Appearance switch, and Import should be its own tab (file + pasted data),
not mixed into the export column.

- **Washed preview root cause**: the exported SVG only inlined ~8 hand-written
  style rules; every class the cloned viewport carries (.node shapes, edges,
  handles, group fills, lo-body…) resolves from the APP stylesheet on the live
  page but nowhere in a standalone SVG → default black strokes/transparent
  fills. Fix: `collectCss(clone)` walks document.styleSheets and inlines only
  rules whose selector matches a class present in the clone (live: 410 rules,
  110KB — vs ~2KB before), then the chosen theme's token block overrides :root.
  Midnight bg #0a0f1e vs light #f7f7f8 verified in the generated files.
- **Tabs**: modal header = Export | Import. Export tab unchanged (scope /
  format / theme / preview). Import tab = Mermaid textarea + "Import board
  JSON…" (delegates to App's fileRef via the new onImportJson prop).

Gates: tsc 0 · build 0 · verify 22/0/5 · hex 144 · **40/40 harnesses**.

## ▶ AQ21-F — modal replaces the toolbar dropdown; SVG preview renders; fixed modal height. DONE, 40/40 GREEN.

Harvey feedback on AQ21: (1) the modal should REPLACE the old export buttons,
not sit beside them; (2) the SVG preview showed nothing; (3) a too-tall modal
should scroll inside, not scale its height.

- The toolbar "Export" button now opens the modal DIRECTLY. The whole dropdown
  (Import JSON / Export JSON / Export SVG one-click rows) is REMOVED along with
  the dead `exportJson`/`exportSvg`/`exportPng` wrappers and the `pop` state —
  JSON import moved into the modal (Mermaid textarea + JSON via the file input
  stays through `fileRef`; note: JSON import row retired — import now = Mermaid
  in-modal, JSON boards via drag-drop which already existed).
- SVG preview root cause: `clone.outerHTML` inside the SVG `<foreignObject>`
  is HTML, not well-formed XML, and an `<img>`-loaded SVG parses STRICT XML →
  blank image. Fix: `new XMLSerializer().serializeToString(clone)`. Live:
  naturalWidth 641 (was 0/blank).
- Modal height is now FIXED (`height: min(84vh, 640px)`) — the left pane
  (`overflow-y: auto`) scrolls; the dialog never stretches.
- buildPng `pixelRatio` now reads the stored `pngScale` pref (was hard-coded 2 —
  S2.png-scale harness caught the regression my dead-code removal introduced).
- package-o-metrics re-anchored: the export dropdown was the last BARE `.pop`
  element; base CSS + compound boards-pop consumer stay pinned.

Gates: tsc 0 · build 0 · verify 22/0/5 · **40/40 harnesses**.

## ▶ AQ21 — Export modal: scope + format + theme + live preview; Mermaid export/import. DONE, 40/40 GREEN, live-verified.

Harvey: make export a modal — choose selected-only/full, preview on the right,
pick the export theme, and ask whether Mermaid interop is possible.

**ExportModal.tsx** (new): two-pane modal. LEFT: Scope (Full board / Selected
only — disabled at 0 selection), Format (SVG/PNG/JSON/Mermaid), Theme (live +
the 5 concrete themes), Export button, plus an Import-Mermaid textarea. RIGHT:
live preview of the ACTUAL artifact (same builder the download uses), debounced
250ms. Entry: the import/export dropdown's new primary row "Export / Import…".

- App gains parametrised `buildSvg`/`buildPng` builders (scope filters nodes in
  the cloned viewport; theme tokens resolved via the new `tokensFor(theme,
  names)` in theme.ts — walks document stylesheets for `[data-theme=x]`
  blocks over the light baseline, no live re-theme needed).
- **Mermaid export** (`src/mermaid.ts` toMermaid): flowchart TD, shape mapping
  (database/storeddata→[(·)], decision/gateway→{·}, actor→((·)), external→([·]),
  queue→[/·], else (·)), edge labels, RF parentId groups → subgraphs. HONEST
  loss list shown in the modal (colours/text styles/icons/metrics/custom shapes).
- **Mermaid import** (fromMermaid): line-based flowchart subset — shape tokens,
  `-->`/`---`/`==>` edges, `|label|` and `-- text -->` labels (labels scrubbed
  before node-lexing — the |reads| bug), subgraph blocks → group nodes +
  membership. mermaidToGraph lays out a 4-row grid, ids namespaced mm*/me*.
  Live E2E: import inserted 4 nodes with correct shapes/labels + 3 labelled
  edges; export of the 25-node template produced a 59-line valid flowchart.

Gates: tsc 0 · build 0 · verify 22/0/5 · hex 144 (modal CSS uses tokens only)
· **40/40 harnesses**. Boards runtime data untouched (gitignored).

## ▶ AQ20 — search source lines unique for EVERY duplicated shape. DONE, 40/40 GREEN, live-verified.

Harvey: extend the AQ6 treatment (search annotation) to all duplicated shapes.
Audit of the 28-entry LIBRARY found the duplicate-shape groups: actor (1+2 C4),
service (1+3), database (1+2), queue (1+2), storage (1+1), external (1+2),
group (1 arch + 1 flow + 3 C4), note (4 entries). The AQ6 line was generic:
`p.types → TYPE_LABEL` + `SOURCE_PURPOSE[p.category]` — so ALL C4 rows read the
identical "C4 — a node in a C4 model", and Note vs Note (enum) collided too.

Fix: `PaletteItem.purpose?: string` override, consumed by SearchPalette as
`p.purpose ?? SOURCE_PURPOSE[p.category]`.
- Every C4 palette item now sets `purpose: a level-N C4 element — <e.sub>`.
- ERD Note (enum): "an ERD note listing the allowed values of a field".

LIVE-VERIFIED: 'boundary' → Group (Architecture — boundary…), Lane (Flowchart —
boundary…), System boundary (C4 — level-2…), Container boundary (C4 — level-3…)
— four rows, four distinct lines. 'datab' trio unchanged and distinct.

Gates: tsc 0 · build 0 · verify 22/0/5 · hex 144 · **40/40 harnesses**.

## ▶ AQ19 — node CENTRES under the cursor at insert. DONE, 40/40 GREEN, live-verified at 0.53 zoom.

Harvey approved the option offered in AQ18 ("vậy đổi thử"). Nodes now land
CENTRED on the drop point instead of top-left anchored:
- `addNodeByLabel` offsets by half the estimated size (palette item size,
  group 320x200, note 200x90, else 190x95) — covers palette drop, ctx menu,
  search insert, dblclick canvas, favourites (single-node path).
- `dropCustomShape` uses its own known shape.w/h.
- Two-pass re-centre after insert (320ms + 1150ms, after the auto-grow ladder
  steps): measures the RENDERED box, converts its centre to FLOW space via
  screenToFlowPosition, shifts so centre == the stored `data.__dropAt`. The
  flag is cleared on the second pass.
- PITFALL (caught live): the first pass compared FLOW drop coords against a
  CLIENT rect centre — at 0.53 zoom this teleported the node ~1200px down.
  Always convert rendered-box points to flow space before diffing.

LIVE-VERIFIED: ctx 'Add node here' at client (650, 500) on a 0.53-zoom board →
Queue centre lands at (650, 500) exactly.

Gates: tsc 0 · build 0 · verify 22/0/5 · hex 144 · **40/40 harnesses**.

## ▶ AQ18 — drop-position double-subtract fixed (2 more instances of the AUDIT-7 class). DONE, 40/40 GREEN, live-verified.

Harvey: "thả node theo con trỏ chuột... lệch nhiều so với vị trí thả". AUDIT of
every screenToFlowPosition call found TWO remaining double-subtractions — the
same defect AUDIT-7 fixed for the ctx-menu path, in its siblings:

1. **Palette drag-drop** (`onDrop`): `screenToFlowPosition({x: e.clientX - b.left, ...})`
   — the extra wrap-rect subtraction landed every palette drop up-left of the
   cursor by the sidebar+toolbar offset (200+px on wide layouts).
2. **Double-click empty canvas → search palette position**: same pattern.

Both now pass raw client coords. LIVE-VERIFIED: dragged Service from the palette,
dropped at client (732, 300) → node top-left lands EXACTLY at (732, 300). The
remaining 4 screenToFlowPosition calls are wrap-centre fallbacks (intentional) or
already raw. Note: node TOP-LEFT anchors at the cursor — standard for draw.io/
Figma; say the word if you'd rather centre the node under the cursor.

Gates: tsc 0 · build 0 · verify 22/0/5 · hex 144 · **40/40 harnesses**.

## ▶ AQ17 — dblclick-handle skips already-connected, picks the NEXT nearest. DONE, 40/40 GREEN, live-verified.

Harvey: dblclick a handle on an already-connected node should not just report
"already connected" — find the next nearest shape. The candidate loop now skips
any shape already joined to this node (either direction) and keeps the nearest
unconnected one; the flash only reports when EVERY candidate in range is
exhausted ("All N nearby shapes already connected") or none are in range.
noCycles + oneIn still gate the final choice.

LIVE-VERIFIED on a 4-node board: Service pre-connected to both neighbours;
dblclick its right handle with a fresh unconnected Queue nearby → connected to
the Queue (edge 2→3), toast "Connected (straight — shapes are close)".

Gates: tsc 0 · build 0 · verify 22/0/5 · hex 144 · **40/40 harnesses**.

## ▶ AQ16 — auto-scale WIDTH + re-check on text edits. DONE, 40/40 GREEN, live-verified.

Harvey: auto scale should set the minimum WIDTH too (the first-create fitting).
- The grow check now probes the content's natural single-line width
  (`width: max-content` probe, capped 340) and grows WIDTH alongside height —
  floored at the node's 190px min-width, never shrunk.
- Text edits (title/sub/metric/textStyle) re-run the grow check via a
  data-keyed effect — the body box doesn't resize on a text change, so the
  ResizeObserver stays silent exactly when the user retypes.
- The recheck no longer bails on an existing wrapper height: growth is
  GROW-ONLY (App's onGrow keeps max(current, target)), so a text change raises
  a too-short node but never shrinks a user's resize.

LIVE-VERIFIED: long title set on a 300x150 node → grew to 300x163, clipped 0,
sub fully visible inside the band. Width 300 kept (grow-only).

Gates: tsc 0 · build 0 · verify 22/0/5 · hex 144 · **40/40 harnesses**.

## ▶ AQ15c-final — the grow amount was under-shot by the percent insets. FIXED, 40/40 GREEN.

Harvey pushed once more ("kiểm tra kỹ") and the deeper defect surfaced: percent
insets mean the TEXT BAND is a fixed FRACTION of the node — growing the node by
exactly the clip amount grows the band by only 45% of it (cylinders), so the fix
kept re-converging 3px short (sub descender still crossing). The grow now divides
the measured clip by the band's actual height share (read from the body's
computed top/bottom insets, floor 0.2): a 3-5px clip on a cylinder grows the node
~7-16px. LIVE-VERIFIED: fresh node 116px, sub fully inside the band with 4px
margin. Also: the grow metric now compares the LAST CONTENT CHILD's bottom to the
body's bottom (scrollHeight misses glyph descenders painted below their line box
under overflow:hidden — the exact "primary" slice).

Gates: tsc 0 · build 0 · verify 22/0/5 · hex 144 · **40/40 harnesses**.

## ▶ AQ15c — belt-and-braces font timing for auto-grow. DONE, 40/40 GREEN.

Harvey asked to double-check first-create. On the dev box the first-create path
measures clean (110px, sub visible, cache disabled + hard reload), but Harvey's
machine could still land a webfont AFTER every existing re-check. Added:
`document.fonts.loadingdone` listener (fires per webfont batch, however late) +
a 2000ms ladder timer, alongside fonts.ready and the 120/400/900 ladder. Any
late font landing now re-runs the grow check. Cleanup listener included.

Gates: tsc 0 · build 0 · verify 22/0/5 · hex 144 · **40/40 harnesses**.

## ▶ AQ15b — auto-grow re-checks after webfonts settle. DONE, 40/40 GREEN.

Harvey's screenshot: a WIDE (430px) fresh cylinder with the sub still half-sliced.
Root cause: the first auto-grow check ran at first paint with FALLBACK font
metrics — it measured "fits" (clip ≤ 6) and stopped; when the real webfont
swapped in, line heights changed and the clip returned. The body BOX does not
resize on a font swap, so the ResizeObserver never refired.

FIX: after fonts.ready + a settle ladder (120/400/900ms), the check re-runs with
real metrics and grows if needed. Live-verified: fresh node resized to 430px wide
→ 110px tall, clip 4, sub fully visible.

Gates: tsc 0 · build 0 · verify 22/0/5 · hex 144 · **40/40 harnesses**.

## ▶ AQ15 — auto-grow on create: clipped text grows the node. DONE, 40/40 GREEN, live-verified.

Harvey: a fresh cylinder (card body) hid its sub text until manually resized —
"the shape should scale to adapt to show all". IMPLEMENTED for every goblin shape:

- DiagramNode gains an auto-grow effect: ResizeObserver on the body; when
  `scrollHeight − clientHeight > 6px` (6 = flex-centring slack, not hidden text)
  and the WRAPPER has no user-set height, it reports the needed full height via
  `gobi:node-grow`; App's `onGrow` writes `style.height` on the node — the same
  write a manual resize performs, so it persists in the board and never
  overrides a user resize (the renderer's wrapper check guarantees that).
- Refs plumbed to BOTH branches (card `.node-body` and label-only `.lo-body`);
  the card root was missing its innerRef on the first pass — caught live.
- Delivered through a `gobi:node-grow` CustomEvent + a dedicated App listener
  (the __onGrow-in-edge-memo first attempt was the wrong surface).

LIVE-VERIFIED: fresh Database node auto-grew 95 → 110px and the sub renders fully
(subBottom inside the node). A manual dispatch grows on demand; a wrapper with an
explicit height is untouched.

Gates: tsc 0 · build 0 · verify 22/0/5 · hex 144 · **40/40 harnesses**.

## ▶ AQ14 — Details toggle un-inverted + cylinder previews minimal. DONE, 40/40 GREEN, live-verified both directions.

Harvey: "ấn Minimal nó hiện Full và ngược lại". CONFIRMED + ROOT CAUSE: when the
AQ10 default flip changed the value expression (`plainCylinder !== false`), the
onChange was also flipped to `plainCylinder: v !== 'plain'` — which stores FALSE
for Minimal. false renders FULL. Both mappings were inverted relative to each
other's intent. Fix: onChange stores `v === 'plain'` (Minimal → true → bare drum;
Full → false → arcs).

ALSO: the ShapePreview cylinders (palette icons for database/storeddata) drew the
inner arc — previews now match the Minimal default (arc removed). Node data icons
already default minimal via DatabaseMin (AQ10b).

LIVE-VERIFIED end-to-end on a fresh node: default 0 arcs; Full → 2 arcs +
active=Full; Minimal → 0 arcs + active=Minimal.

Gates: tsc 0 · build 0 · verify 22/0/5 · hex 144 · **40/40 harnesses**.

## ▶ AQ13 — selection bar redesigned (Harvey: "quite ugly"). DONE, 40/40 GREEN, live-verified.

What was ugly (measured from Harvey's screenshot): three icon languages glued in
one bar — oversized Copy/Trash with text labels, skinny unicode arrows
(⇤↔⇥⇡↕⇣), and "⇹ H"/"⇹ V" stacks; the count broke across two lines ("7" over
"SELECTED"); uneven button sizes.

The redesign:
- ONE icon language: every control is a lucide icon at 15px in a uniform 30x30
  button (Duplicate Copy, Delete Trash2, aligns
  AlignStart/Center/EndVertical + AlignStart/Center/EndHorizontal, distributes
  AlignHorizontalSpaceAround / AlignVerticalSpaceAround).
- Count chip on ONE line: bold mono number + small uppercase "selected".
- Even rhythm: flex gap 2px with every button the same 30x30 box; the bar keeps
  its glass pill.

LIVE-VERIFIED: all 10 buttons render 30x30 lucide icons with correct
aria-labels; Align left through the bar aligned 14 nodes to a single x (445).

Gates: tsc 0 · build 0 · verify 22/0/5 · hex 144 · **40/40 harnesses**.

## ▶ AQ12 — align/distribute relocated to the selection bar. DONE, 40/40 GREEN, live-verified.

Harvey: align only means something WITH a selection — the toolbar group
("align" label + 6 align buttons + H/V distribute, visible whenever selCount >= 2)
duplicated the selection bar's controls. Changes:

- Toolbar: the whole align/distribute block REMOVED (the "Alignment guides" snap
  toggle stays — it is a different feature).
- Selection bar: the mislabeled single "Align" button (it only ran hcenter!) and
  "Distribute" (only h) replaced by the FULL set — 6 align buttons + H/V
  distribute — after Duplicate/Delete. Toolbar now shows only selection-proof
  controls.

LIVE-VERIFIED: toolbar with no selection has 0 align/distribute buttons (only the
guides toggle); selecting 14 nodes shows the sel-bar with Duplicate, Delete,
6 aligns, H/V distribute; clicking its Align left aligned all 14 nodes to x445.

Gates: tsc 0 · build 0 · verify 22/0/5 · hex 144 · **40/40 harnesses**.

## ▶ AQ11 — align/distribute/auto-arrange AUDIT (Harvey: "sai sai"). 1 REAL BUG FIXED + 1 UX FIX + 2 verdicts WORK-AS-DESIGNED. 40/40 GREEN.

AUDITED LIVE over CDP on a 9-node board (8 top-levels + 1 group child):

1. **Align — REAL BUG, FIXED.** align/distribute read `n.position`, which is
   PARENT-RELATIVE for a group child. Measured: align-left with one group child
   in the selection teleported the whole 8-node board ~250px left (the child's
   local (37,66) poisoned the min/max). Rewritten in ABSOLUTE space via the
   existing `absNodes` map; the write converts the absolute target back to each
   node's parent-relative position. Verified: 9-node mixed selection align-left
   → every node at the same left edge, child keeps its in-group offset.
2. **Distribute — semantics are STANDARD, frames bug fixed by the same rewrite.**
   Equal-gaps-between-boxes across the selection (same as draw.io/Figma). Note:
   with mixed node heights the y-gaps are uneven BY DEFINITION (gaps are between
   box edges, and boxes differ) — not a defect. Verified across the mixed
   selection in absolute space.
3. **Auto-arrange — works, but had a UX hole: FIXED.** The layered engine
   rearranged correctly but laid out from (0,0): measured y −340..756 on a 577px
   viewport — 7 of 9 nodes OFF-SCREEN, which reads exactly as "the button does
   nothing". `fitView({padding: 0.25, duration: 300})` now runs after the
   animation: 9/9 nodes visible after clicking.

Gates: tsc 0 · build 0 · verify 22/0/5 · hex 144 · **40/40 harnesses**.

## ▶ AQ10b — the database ICON defaults to Minimal too. DONE, 40/40 GREEN, live-verified.

Harvey: "make the icon of cylinder by default minimal too". The lucide
`Database` glyph carries the same inner arc the shape did. Built
`DatabaseMin` (lucide's own `createLucideIcon` factory, ellipse + body —
the classic glyph minus its inner arc) and remapped the `"database"` icon key
to it; the classic three-line glyph stays available as `"database-full"`.
Live-verified: a fresh Database node renders icon with 0 inner arcs + the
ellipse/body drum. IconPicker follows automatically (it reads the same map).

Gates: tsc 0 · build 0 · verify 22/0/5 · hex 144 · **40/40 harnesses**.

## ▶ AQ10 — inscribed-rect insets for slanted shapes + cylinder default = Minimal. DONE, 40/40 GREEN, decision verified to 520x420.

Harvey's screenshot: a label-only Decision with "Decision?" parked at the body's
top-left — outside the diamond once the node grew. TWO findings:

1. **Diamond (and circle) needed INSCRIBED-RECTANGLE insets, not border bands.**
   The AQ9 audit measured "generous border bands"; for a diamond the safe region
   is a rhombus, so a band of 2/30/2/30 still had its TOP-LEFT CORNER outside
   the outline. Corrected: decision 28/27/28/27 (largest inscribed rect ≈
   25.5/26 plus margin — corners verified against the path vertices), connector
   (circle → ellipse under preserveAspectRatio=none) 17/34/17/34. ALSO
   recomputed from the vertices: preparation 2/24/2/24, io + manual 2/19/2/19,
   manualinput 30/3/2/3 (its sloped TOP edge binds at the box's top-left).
2. **The label-only branch had NO inset at all** — Harvey's node was label-only,
   and that return path lacked `body-inset`, so the band never applied. Added
   (its body is `.node-body lo-body`, matched by the same rule).
3. **The body-inset block relocated to the END of styles.css** — `.node.label-only
   .lo-body` (equal specificity, later in the sheet) was beating the band's
   position/min-height; later-in-sheet now decides.
4. **Cylinder default = Minimal** (Harvey's ask): `plainCylinder !== false` — a
   board that never stored the flag draws the bare drum; "Full" is the explicit
   choice. The inspector toggle shows Minimal for untouched nodes.

LIVE-VERIFIED: decision label-only insets 28/27/28/27 at 190x141 AND at
520x420 with all four body-box corners INSIDE the diamond path.

Gates: tsc 0 · build 0 · verify 22/0/5 · hex 144 · **40/40 harnesses**.

## ▶ AQ9 — TEXT-FITS-THE-SHAPE: all 25 shapes audited and moved to percent insets. DONE, 40/40 GREEN, live-verified 23/25 in-browser.

Harvey: "scan all the shapes and see if any shapes should fit the text". AUDIT
RESULT: 16/25 shapes FAILED at the default 190x95 — every non-rectangular shape's
fixed px padding mismatched its silhouette, and ALL failed worse when resized
(the frames scale, px padding does not). The cylinder fix generalised:

- ONE `.body-inset` mechanism (abs-pos body, `min-height: 0`, aspect-ratio 2/1
  fallback) driven by a per-shape `--body-inset` percent band measured off each
  shape's real geometry — decision (diamond) 2/30/2/30, delay (D) 2/42/2/3,
  offpage 2/3/34/3, manualinput 33/3/2/3, queue (gutter) 2/34/2/36, actor
  (badge) 2/3/2/33, document (wavy base) 2/3/26/3, gateway/preparation/
  terminator/connector 2/27/2/27, io/manual 2/21/2/21, subprocess/
  internalstorage 2/16/2/16, storage (open drum) 24/3/26/3, cylinders 35/6/20/6,
  rect family 2/3/2/3. The 14 scattered px-padding rules are DELETED.
- `body-inset` lands on the goblin node root only — tables/labels/notes keep
  their own layout.
- LIVE-VERIFIED over CDP by swapping one node through the inspector's shape
  picker across 23 shapes: every measured inset matched its band EXACTLY
  (35.0/20.0 drums, 2/30 diamond, 2/42 D-shape...), title painting inside.

Gates: tsc 0 · build 0 · verify 22/0/5 · hex 144 · **40/40 harnesses**.

## ▶ AQ8 — "Details" label (Harvey's pick) + cylinder text confined to the drum body. DONE, 40/40 GREEN, live-verified.

- Label rename: the AQ7 "arcs" row is now **"details"** with **Full | Minimal**
  (Harvey's pick; the vocabulary deliberately generalises to future shapes with
  optional inner lines).
- The cylinder's text now ALWAYS sits in the drum body. Root cause: the body's
  padding was FIXED px (24px) while the frame scales with the node
  (preserveAspectRatio=none), so a resized-taller cylinder let titles paint over
  the caps. The body is now an absolutely-positioned inset over the safe band —
  **top 35% / bottom 20% / sides 6%** (measured off the frame's geometry:
  cap ends y=35, bottom arc starts y=80 of the 200x100 viewBox).
- TWO interactions surfaced (both fixed, both instructive):
  1. `.node-body`'s AI-1 `min-height: 100%` beats top+bottom inset solving — the
     body needs `min-height: 0` inside the band or the box ignores `bottom`.
  2. A fresh unresized cylinder collapsed to 0 height once the body left normal
     flow (`.node` min-height:100% of an auto wrapper) — `aspect-ratio: 2/1`
     on cylinder nodes restores the fallback height; a resized node still fills
     its wrapper via min-height.
- Harness l (no earlier rule outranks a --ts-* consumer) caught my first draft
  setting justify-content/display earlier+more-specific than the consumer rule —
  slimmed to geometry-only declarations; alignment stays with the --ts-* layer.

Live-verified: insets exactly 35.0%/20.0% at 190x95 AND at 300x240; title paints
inside. Gates: tsc 0 · build 0 · verify 22/0/5 · hex 144 · **40/40 harnesses**.

## ▶ AQ7 — per-node "Plain cylinder" (drop the inner arcs). DONE, 40/40 GREEN, live-verified both directions.

Harvey: the cylinder's two inner arcs (the stacked-disks suggestion) should be
droppable per node. `NodeKind.plainCylinder?: boolean` — absent keeps the arcs,
so pre-existing boards render byte-identical. `ShapeFrame` takes `plain:` and
`cylinder(cls, plain)` conditionally renders the two arcs; both cylinder shapes
(database, storeddata) forward it. Inspector → Style → **"arcs" ToggleRow
(Disks / Plain)**, shown ONLY when the shape is a cylinder. round-ad-flowchart's
ad2 re-anchored: the call sites now forward `plain` (draw-once invariant
unchanged — one definition, one ellipse markup).

Live-verified over CDP: insert Database → arcs row appears → Plain → inner arcs
gone (M4 42 / M4 60 absent) → Disks → arcs return. Palette previews unchanged
(still show the default disks — the preview represents the default).

Gates: tsc 0 · build 0 · verify 22/0/5 · hex 144 · **40/40 harnesses**.

## ▶ AQ6 — search results annotated with SOURCE + PURPOSE. DONE, 40/40 GREEN, live-verified.

Harvey's "why are there three identical cylinders" — the search palette now
answers it in place. Each `.sp-item` in the SearchPalette modal carries a third
line: the diagram language(s) the entry belongs to (`TYPE_LABEL` over `types[]`)
+ a one-line purpose (`SOURCE_PURPOSE` over `category`), e.g. "Database /
Architecture — a datastore in a system diagram", "Stored data / Flowchart — a
step in a flowchart (ISO 5807)", "Container: database / C4 — a node in a C4
model". Maps live in palette.ts as static vocabulary; styles use `--fs-2xs` +
`--dim2` (the AP-1 contrast-fixed token), no new hex (ratchet 144 intact).

SCOPE NOTE: the LEFT PANEL omnibox was deliberately NOT annotated — its results
stay grouped under category headers (the "who" is already visible), and painting
type on every resting row would regress PACKAGE-N's explicit "a single-type
element no longer repeats its own category" decision. Group-by switcher: PARKED
until the custom library grows (conditions: volume + missing taxonomy + mixed
sources on one surface).

Live-verified over CDP: "datab" → 3 rows, each with the right source line.
Gates: tsc 0 · build 0 · verify 22/0/5 · hex 144 · 40/40 harnesses.

## ▶ ROUND AQ5 — batch #3: dblclick-connect as a SETTING (+reach), straight-when-close, bend-drag verdict. DONE, 40/40 GREEN.

- **Item 12** — the auto-connect is now a real control, Connections pane:
  "Connect on handle double-click" (default ON) + "Connect reach" segmented
  150/200/300/400/600/800 px (default 400). Both persist via prefs.ts lazy-init;
  the reach row hides while the toggle is off. `DOUBLE_CLICK_CONNECT_RANGE` stays
  as the default constant.
- **Item 14** — NO KINK at small distance: when the facing gap is under
  `DBL_STRAIGHT_GAP = 160` px the auto-connect renders a plain STRAIGHT edge
  (arrowhead unchanged — it is the marker, not the path). Elbow above the gap.
- **Item 13** — self-review fixed 2 holes: read-only boards refuse the
  auto-connect (flash), and One-input-per-node gates it (a target with an
  incoming edge is refused). Noted (kept): auto-connect REFUSES a duplicate pair
  while manual connect bumps ×N — deliberate, documented.
- **Item 15** — VERDICT: bend drag is NOT broken. Proven end-to-end over CDP on
  the live board: click an edge (selects it) → the dot handle appears → drag →
  bendX/bendY written and the path routes through the waypoint. The mechanics:
  (a) the handle shows ONLY on a SELECTED edge; (b) only for opposite-side pairs
  (bottom→left has NO handle); (c) dragging the line BODY never bends — only the
  dot. Harvey should say which of the three he hit.

Gates: tsc 0 · build 0 · verify 22/0/5 · hex 144 · **40/40 harnesses**.

## ▶ AQ4b — target-side metric fixed: line distance → CLAMPED SEGMENT distance. DONE, 40/40 GREEN.

Harvey's screenshot: dblclick A's RIGHT handle → edge left A.right correctly but
landed on B's BOTTOM (arrow pointing up under B) instead of B's LEFT. Root cause,
numeric: the metric measured |handle point − side LINE|, and B's bottom LINE was
62px from the handle (the handle sat above the bottom line's y-band) while B's
left line was 185px — so 'bottom' won even though the handle faces left. Fix:
distance from the handle POINT to the CLOSEST POINT ON each side SEGMENT
(projection clamped). Proven on the screenshot's own geometry: left 185.0 beats
bottom 195.1 → LEFT wins. A shape-below control still picks the facing side (top).

Gates: tsc 0 · build 0 · verify 22/0/5 · **40/40 harnesses**.

## ▶ AQ4 FIXUP — the CLICKED handle is the SOURCE (Harvey's clarification). DONE, 40/40 GREEN.

Harvey: "khi double click vào handle, từ cái handle đó sẽ kết nối tới shape gần nhất
(cạnh shape gần nhất)". The first cut overrode BOTH handles with the gap matrix —
the clicked one was ignored. Now: `sourceHandle` = the handle you double-clicked,
verbatim; only the TARGET side is computed, as whichever of the target's four sides
is closest to the clicked handle's midpoint. Range 400px, cycle check, already-
connected flash: all unchanged.

Gates: tsc 0 · build 0 · verify 22/0/5 · **40/40 harnesses**.

## ▶ ROUND AQ4 — proximity RETIRED, dblclick-a-handle auto-connect BUILT. DONE, 40/40 GREEN. PENDING HARVEY'S TEST.

Harvey's call: proximity connect (drag-near auto-edge) is GONE — the toggle, the F9
drag-move candidate, the drag-stop creation, the dashed preview SVG, the caps field
on all 5 presets, and the dead .prox-edge CSS block. #6 (×N overlap) confirmed OK.

THE REPLACEMENT: **double-click any of the 4 handles** on a node → App searches for
the nearest top-level shape within `DOUBLE_CLICK_CONNECT_RANGE = 400` flow px
(centre-to-centre), picks the nearest-side pair (right↔left / left↔right /
bottom↔top / top↔bottom from the absolute rects), cycle-checks like every other
path, and creates the edge. Too far → flash "No shape within 400px". Already
connected → flash. Mechanism: the Handle dispatches `gobi:handle-connect`
CustomEvent (DiagramNode has no store access); one App effect owns search + guard +
creation. `package-q-reconnect-endpoints` re-anchored (it pinned the caps literal
that no longer carries `proximityConnect`).

Gates: tsc 0 · build 0 · verify 22/0/5 · hex 144 · **40/40 harnesses**.

## ▶ ROUND AQ3 — feedback batch #2 (Canvas note removed, Prevent-cycles on all paths, proximity nearest-side). DONE, 40/40 GREEN. PENDING HARVEY'S TEST.

- **Canvas pane description block: REMOVED** (Harvey: "do we need this?"). The pane now holds only the controls.
- **Prevent cycles now works on EVERY edge-creation path.** Harvey: "seems didn't work". Root cause: the cycle
  check lived only in `onConnectRules`; THREE paths bypassed it — a connect drag dropped straight on an existing
  node (F6 Part C), the proximity connect (F9), and edge rewire. `wouldCycle(source, target, edges)` is now a
  module-level pure function; `createsCycle` delegates to it; all three paths check it (reconnect checks against
  the edge set minus the edge being rewired) and flash the same Blocked message.
- **Proximity connect: NEAREST-SIDE handles** (Harvey's ask): the pair of sides facing each other most closely
  wins — right↔left, left↔right, bottom↔top or top↔bottom, computed from the two nodes' absolute rects. Handles
  are the goblin ids `left/right/top/bottom`.

**Still needs Harvey:** the ×N overlap repro detail and the rest of the bend-handle sentence (both from the
earlier batch).

Gates: tsc 0 · build 0 · verify 22/0/5 · hex 144 · **40/40 harnesses**.

## ▶ AQ2 FIX — first-shape zoom-to-250% on an empty board. DONE, 40/40 GREEN. READY FOR HARVEY'S RETEST.

Harvey: empty board, 50%/100% zoom, add the first shape → viewport snapped to 250%.

ROOT CAUSE: React Flow's `fitView` PROP runs whenever the graph first gains content
— on an empty board that moment IS the first shape — and fitting the viewport to one
node zoomed to the element's `maxZoom` = 2.5. Not a state bug: a stored-position bug
was ruled out (reload fixed it, positions were never touched).

FIX: `fitViewOptions={{padding: 0.25, maxZoom: 1}}` on the element, and the same cap
on the board-load and JSON-import fitViews (a 1-node board file hit the same trap).
Initial fit now never exceeds 100%; the user's manual zoom (50%) is untouched because
the fit only runs once, on first content.

**En route:** package-templates + round-4 probes re-anchored — they pinned ">= 3
boards", but boards/ is Harvey's LIVE data dir (his test session deleted the demo
board and saved his own `muchcvb…`), so the count now floors at >= 1. g1 lesson
re-learned: the harness may not spell the runtime data dir's name in a comment
(self-match); reworded.

Gates: tsc 0 · build 0 · verify 22/0/5 · hex 144 · **40/40 GREEN**.

## ▶ AQ2 FOLLOW-UP — custom colour picker on the TEXT colour row. DONE, 40/40 GREEN.

Harvey's clarification of #5: the "text color" row had 11 preset swatches but NO
custom cell (node fill, edge stroke and table colour rows all had one since AO-1c).

**What shipped:** `TextStyle.customColor?: string` — a literal hex stored beside
`colorKey`, with the SAME mutual exclusion `scale`/`size` has (setting one deletes
the other, enforced in `mergeTextStyle`). `textStyleVars` emits `--ts-color` from
the key first, the literal second (a hand-edited board carrying both keeps the key,
same documented precedence). `readTextStyle` reads `customColor` back for the cell.
The Text colour row passes the custom cell: key pick clears the literal, literal
pick clears the key. Export note: `EXPORT_TOKENS` covers theme tokens; a literal
travels inside the inlined `--ts-color` value automatically (it IS the emitted value).

Reproduce: select a node → inspector → Text → "text color" → 12th cell = custom.

Gates: tsc 0 · build 0 · verify 22/0/5 · 40/40 harnesses · hex 144.

## ▶ ROUND AQ2 — device-test feedback batch (About rewrite, nav note, Shipped removed, X buttons, swatch ring, save retry). DONE, 40/40 GREEN. PENDING HARVEY'S REVIEW.

Harvey's feedback, all applied:
- **About pane rewritten**: "Gobigrams" wordmark + goblin joke (his words: funny,
  mischievous, pun on Goblin Diagrams); Version shows ONLY the number; Licence row
  REMOVED (licensing undecided — anti-RE direction makes a displayed MIT row wrong);
  Building blocks row REMOVED; self-host note REMOVED (re-homed when the product ships).
- **"5 groups · room to grow"** nav note: REMOVED.
- **Shipped block in the roadmap pane: REMOVED** ("quá xấu") — data lives on in
  `src/roadmap.ts`; r13 re-anchored to the new pane shape.
- **X buttons** (fav + cust tiles): text '×' -> lucide X icon 12px; circle -> 7px
  rounded square (matches the chip system).
- **White swatch cell** on light/paper: inset hairline ring via var(--border) — the
  cell no longer vanishes. NOTE: the sheet's own "white node invisible on light
  canvas is the user's choice" consequence STILL STANDS for node fills; the ring
  fixes the CELL only. Text colour picker already exists (inspector "text color").
- **Save retry**: fetch failures retry twice (1s, 3s) with the payload rebuilt from
  refs (latest work, not stale); persistent failure still surfaces as "save failed".
  Root cause of Harvey's "Saved failed: fetch" was the DEV SERVER dying (infra, fixed
  separately — server now runs persisted).

**NOT in this round (needs Harvey/live repro):** #6 flowCount -> nodes overlap (cannot
reproduce from code — flowCount only changes SMIL payload count; needs his exact steps
next session); #7 bend handle after 2nd+ top/bottom connection (his sentence was cut
mid-thought — needs the rest).

Gates: tsc 0 · build 0 · verify 22/0/5 · hex 144 · 40/40 harnesses · boards clean.
r13 re-anchored (AboutPane rewrite made the old positional contract obsolete).

## ▶ AUDIT FIXES — all 15 interaction findings fixed (3 real bugs, 6 latent, 6 smells). DONE, 39/39 harnesses GREEN. PENDING HARVEY'S DEVICE TEST.

From `AUDIT-INTERACTIONS-2026-10-12.json`. One commit per concern group:

**REAL bugs:**
- **AUDIT-1** — paste/duplicate remaps `parentId` through idMap (ghost children of the original group gone; unpasted-parent children leave the group).
- **AUDIT-2+3** — onConnect: twin check + pushHistory + id mint hoisted OUT of the setEdges updater (×N bump now undoable; StrictMode double-push gone).
**Latent:**
- **AUDIT-4** — prefers-reduced-motion folds into useAnimationGating (override still wins) → SMIL beads gated.
- **AUDIT-5** — return-to-origin dblclick guard: the claim latch was self-releasing before dblclick; the gesture hook now stamps `noteDrag()` on real moves and the dblclick refuses within 400ms.
- **AUDIT-6** — beginGesture accepts a transform GETTER; both GoblinEdge gestures pass `() => storeApi.getState().transform` (mid-gesture ctrl-zoom no longer skews writes).
- **AUDIT-7** — all 5 client→flow sites pass RAW client coords (screenToFlowPosition subtracts its own rect; the manual wrap subtraction double-subtracted). The favourite/shape wrap-centre fallbacks now centre correctly.
- **AUDIT-8** — snapshot() copies edge `data` one level (matches the node arm; enforced, not implicit).
- **AUDIT-9** — pre-AM-1 pinned labels (no stored anchor) adopt the live anchor on first touch; no teleport.
**Smells:**
- **AUDIT-10** — bend/label gesture history moves from 'start' to first 'move' (a plain click no longer pushes a phantom undo entry). ak10 re-anchored + a new click-writes-no-history probe.
- **AUDIT-11** — bend 'end' reuses the LOCKED axis (dx=dy=0 resolved to 'h' and could store a spurious bendX on vertical drags).
- **AUDIT-12** — reparent/release no longer pushes a second history entry (one gesture = one undo; proximity keeps its own — it's a distinct edge creation).
- **AUDIT-13** — connectEnd with no touch coordinates bails instead of hit-testing (0,0).
- **AUDIT-14** — addNodeByLabel's default insert centres on the wrap (was raw 480,300 client).
- **AUDIT-15** — CustomShapeNode comment corrected: no aspect lock; the <img> letterboxes (object-fit contain).
- **AUDIT-16** — readOnlyRef guards onConnect/onConnectEnd: an in-flight connection drag dropped after toggling read-only no longer creates an edge.

**Re-anchored harnesses:** ak10 (history-at-first-move + new click probe), an5 (snapshot data copy), round-s-edge-bend (axis derivation form).

Gates: tsc 0 · build 0 · verify 22/0/5 · hex 144 · **39/39 GREEN** · boards clean.

## ▶ ROUND AQ — type scale + spacing scale consolidation. DONE, all 39 harnesses GREEN. PENDING HARVEY'S DEVICE TEST.

**AQ-1 — the type scale (8 steps).** New `--fs-*` tokens on :root (--fs-2xs 9px →
--fs-display 26px; NAMED `--fs-*`, NOT `--ts-*` — that namespace is the per-node
textStyle feature and a collision broke package-p's pairing probe on day one). All 168
font-size declarations + 17 calc-scaled consumers consume the tokens; raw px font-size
outside the token block is forbidden (ratchet). Half-steps collapsed: 9.5→10, 10.5→11,
11.5→12, 12.5→12, 13.5→13, 14.5/15→14, 20→16.

**AQ-2 — the spacing scale.** 152 padding/margin/gap numbers consolidated onto the
17-step allowed set (1..5..40). Survivors with reasons: **5px** (coupled to
.insp-seg.grid3's calc((100% - 10px)/3) basis + the aa1 one-gap equality), **7px/9px**
(load-bearing in measured control arithmetic), **13px** (AO-2's named rhythm + the ab1
equality + .field margin). Negative margins are geometry — out of scope. Transform via
`scripts/aq-transform.mjs` (postcss — a real parser; the first regex attempt corrupted
comments and calc() math and was reverted).

**Re-anchors (each its own reason):** package-p (154/154 — fallback sweep now sees
tokens), round-aj (11.5→12 documented bump), round-am/an (edge-label 11px literal →
var(--fs-sm), same resolved value), round-al (85% headroom → 100% + zero-overflow hard
gate; the chip label grew, headroom cost printed), round-aa (one-gap equality restored
at 5px).

**Found + fixed en route:** the transform initially desynced .insp-seg.grid3's gap from
its flex-basis calc (gap 4 vs basis -10px) — caught by package-p's arithmetic, restored
to the coupled 5px.

Gates: tsc 0 · build 0 · verify 22/0/5 · hex 144 · **39/39 harnesses GREEN** · boards clean.
Dev server on :5200 for the review batch.

## ▶ PACKAGE-S — Settings completion: persisted prefs, export defaults, autosave control. DONE, gates green. PENDING HARVEY'S DEVICE TEST.

**S-1 — persisted prefs.** New `src/prefs.ts` (one load/save pair, `diagram-studio:pref:`
prefix, JSON values, try/catch-and-ignore, lazy-init writes nothing until an explicit
pick). Wired: `gridSize` (was `useState(16)` — reset every reload, making the Settings
choice a lie) and `alignGuides`. `animate`/`highlight`/`marquee` already persisted via
their own hooks — verified during recon, untouched.

**S-2 — export defaults.** PNG scale (1x/2x/3x, default 2x = today) and export padding
(24/48/96, default 48 = today) as Segmented controls in Settings → Canvas; `exportPng()`
consumes both; the menu item's hard-coded "(2x)" title dropped.

**S-3 — autosave control.** Toggle in Canvas, default ON = today's behaviour. OFF stops
the debounced write; the save indicator shows `unsaved` (dirty flag set on change,
cleared on flush) and Save/Cmd+S still works through the existing `flushSave`.

**Roadmap:** package 6 + 7 added to SHIPPED (newest-first), the Settings Now item
re-worded. `round-ab` untouched; `package-r` re-anchored (r4 pin→floor ratchet, r10
expect-order += package 7/6).

**ERD templates: SKIPPED this round** (Harvey: "tạm thời skip. tôi làm sau").

New harness `checks/package-s-settings.mjs`: 14/0 — prefs.ts EXECUTED against a stubbed
localStorage (round-trip, malformed, throwing), the App/Settings wiring probed at
source, replay RED on `5daf3b5` (9 failed there).

Gates: tsc 0 · build 0 · verify 22/0/5 · hex 144 · package-r 23/0 (re-anchored) ·
boards/ clean.

## ▶ ROUND AP — design polish (contrast, hit targets) + BN-01 narrowed. DONE, gates green. PENDING HARVEY'S DEVICE TEST.

**AP-1 — `--dim2` no longer paints real text.** Measured 3.12:1 on `--surface` (below
the 4.5:1 body bar). Three real-text sites moved to `--dim` (5.41:1 PASS): `.lib-cat-n`,
`.lib-no-match`, `.settings-state.off`. Placeholders/disabled/border keep `--dim2`
(exempt from 4.5:1). Zero hex moved — ratchet stays 144.

**AP-2 — hit targets 24px.** `.fav-remove` 16→24px, `.pal-star` 22→24px, and the twin
`.cust-remove` 16→24px (the ab2 vocabulary probe demands one shared control). At 24px
the control overlays the art corner in a 72px tile (24+34+pad > 72) — the
Excalidraw/tldraw tile-remove pattern; `round-ab` re-anchored (2 probes) with a
negative control: RED 17/19 on the pre-AP tree, GREEN 19/19 after.

**AP-3 — BN-01 exempt retired.** All 24 pre-existing `any` sites narrowed to real
types / `unknown`+narrow / `String()` key-makers; the `bans_exempt:` line is DELETED
from AGENTS.md. One comment false-positive (`// H1: any other overlay`) rephrased.
goblin-verify: 22/0/5 with an EMPTY exempt list.

**Deferred (stated in the spec):** font-scale consolidation (16 sizes → ~8) and the
spacing scale — each moves real pixels across pinned harnesses; their own round.

Gates: tsc 0 · build 0 · verify 22/0/5 · hex 144/144 · boards/ clean.
Harnesses re-run by hand: ag-colors, ag2, ao, package-r (ratchet), theme-boot-sync,
ae, ab (19/19). `package-o-board-dialog` needs a live dev server — run it at the
device-test session.

## State

main @ 0bde816 on Forgejo (`origin`), mirrored to GitHub. gobstack 0.6.0-beta.1 installed
2026-10-12. PACKAGE-R + ROUND AO pushed, PENDING HARVEY'S DEVICE TEST — nothing queued
beyond that.

## Gates

- commit (tsc_build): `npx tsc --noEmit && npx vite build` = exit 0, measured 2026-10-12 on 0bde816.
- todo_ceiling: 0 repo TODOs (excl. node_modules), measured 2026-10-12 on 0bde816, ceiling 160.
- harnesses: 38 check files; the touched ones re-run per round (latest full tally in the
  PACKAGE-R section).

## NEXT

1. Harvey device-tests PACKAGE-R (roadmap pane) + ROUND AO (colour grid, neutrals,
   custom picker, pair gap, nub) on his Mac.
2. gobstack first round: nothing queued — the harness is installed, the next round rides
   the existing spec → build → verify flow.

## NOT VERIFIED

- PACKAGE-R + AO on a real device (Harvey's Mac) — desktop-only review so far.
- Tablet/phone breakpoints: never measured; the app is desktop-first.
- The `.gob/` harness rules were verified once at install (18 passed / 4 failed before the
  config fixes) — first full green run still owed.

---
# Historical session log (newest first)


## ▶ PACKAGE-R — Roadmap surface in Settings → About. DONE, gates green, VERIFIED LIVE, PUSHED. PENDING HARVEY'S DEVICE TEST.

**What it is:** a Roadmap surface that tells a user what the tool does today, what is being built
next, and what is only an idea. Reached from **Settings → About**. Studio-only — links nowhere
outside the app. Spec `PACKAGE-R-SPEC.md`; mockup approved by Harvey (`/tmp/ds-roadmap-mockup/roadmap-v2.html`,
served during review).

**HARVEY'S FOUR DECISIONS (2026-09-22):** (1) belongs to diagram-studio only and lives INSIDE the
studio · (2) scope = diagram-studio only · (3) format = the modern common pattern, decided from
research · (4) **NO staleness warning** — the page stays silent when out of date (he was shown the
counter-evidence and kept this choice; the quiet `last reviewed` line is in scope per §6 of the spec).

**THE RESEARCH CHANGED THE DESIGN — it did not merely confirm it.** Six roadmaps opened live
(`/home/harvey/.hermes/cache/scratch/public-roadmap-research.md`):
- 🔴 **"Now / Next / Later" is a TOOL layout, not an observed convention** — NO live page uses those
  headings. Real sets: `Active/Planned/Launched` (obsidian.md) · `Concept/Alpha/Beta` (posthog) ·
  `Triage/Planned/In progress` (zed.dev) · `Soon™` (immich) · `in design/exploring` (GitHub README).
  → shipped labels are **Now / Next / Exploring**.
- **No-dates is the majority** (4/6). ProdPad: dated columns *"turn every date into a commitment…
  those commitments break."*
- 🔴 **The mechanical reason no-dates is non-negotiable: pruning a DATED roadmap reads as
  cancellation; pruning an UNDATED one reads as completion.** Live proof: cal.com renders
  *"Overdue by 4 month(s)"*; GitHub's Nov-2024 mass-deprecation of ~40 stale items drew *"Ya'll left
  it sit for several years"* → public apology.
- **Status is never colour-only** (a11y SC 1.4.1) — 0/4 surveyed roadmaps did it; ours carries a
  TEXT label per column with the dot `aria-hidden`.
- **Tooling ranked for a single owner:** typed file in the repo (#1) > Strapi > GitHub
  Issues/Milestones (opts you into publishing slippage; no `Access-Control-Allow-Origin`) > SaaS.
  → `src/roadmap.ts`.
- **"Does a public roadmap help?" is UNPROVEN** — no rigorous study found. Counter-evidence:
  ~12 live products' `/roadmap` now 404; Ghost deleted its roadmap after a 4-year unfulfilled promise.

**Implementation.** `src/roadmap.ts` (NEW, pure) — 7 items (2 now / 3 next / 2 later) + 8 shipped
rows + `ROADMAP_REVIEWED`. `RoadmapBlock` inside `AboutPane()` (`src/Settings.tsx`), between
`settings-rows` and `settings-note`, reusing the pane's own `Row` vocabulary + `settings-*` classes.
CSS in a `.rm*` namespace, token-only, **ZERO new hex**. `checks/package-r-roadmap.mjs` (NEW):
23 PASS + a replay RED on `c018656` + 10 mutation-based negative controls.
**Seed content is REAL** — now/next from `PACKAGE-M2-ROADMAP.md` §3/§4, `Rotation for shapes` from
this file, the 8 shipped rows from git log.

**🔴 THE LAYOUT FIX — AND THE LESSON WORTH CARRYING.** The first cut put the three columns
side-by-side and stacked them only on the PHONE tier. Measured live on the real pane: the desktop
modal is 720px **minus a 190px vertical nav**, so `grid-template-columns` resolved to **`147px
147px 147px`** — each card 136px with a 116px text column, wrapping the title to **TWO** lines
(28px) and the description to **SIX** (95px). **DESKTOP was the WORST tier while PHONE was the
BEST** — because phone stacked. Harvey chose option A (stack everywhere). After: `466px ×1`, title
**1 line**, desc **2 lines**, at desktop/tablet/phone. The phone-only `.rm-cols` override was
**DELETED, not kept as a second number meaning the same thing**; the shipped list keeps its own
phone rule because it genuinely is three columns when wide.
**The generalisable lesson: a harness can be fully GREEN while the layout is wrong.** tsc=0,
build=0, 38/38 harnesses, 23/23 new assertions — all green, and desktop was unreadable. Only live
DOM measurement with the REAL container width caught it. And **a spec written from a 980px mockup
must state the real pane width**, or the coder builds the spec correctly and the result is still
bad. That was MY spec defect, not the coder's.

**Gates (orchestrator-measured):** `tsc`=0 · `build`=0 · hex **144** (ceiling 160, unchanged) ·
**38/38 harnesses green** · new harness **23 PASS / 0 FAIL** with replay RED on `c018656` ·
live DOM at 1280/768/360: 3 headings with TEXT labels (`Now 2`/`Next 3`/`Exploring 2`), 7 items,
8 shipped rows, 1 reviewed line, confidence chips carrying the WORD, **zero `<a href>`**, doc
overflow 0/0, worst child overflow 0px · `boards/` **byte-identical (sha256, all 5)** · push
verified with a **FRESH CLONE** (head `419bd83`, roadmap.ts + harness present, hex 144).
**Cross-pane regression used a REAL MOUSE CLICK** — a JS `.click()` probe reads FALSE here (React
needs a real event) and made the nav look broken.

**Commits:** `9532cf9` (data model) · `2cae936` (RoadmapBlock + token-only CSS) · `4676ee3`
(harness + spec) · `419bd83` (the one-column layout fix). **Pushed** `1808799..419bd83`.

**VAULT: DONE.** ADR-031 gained `## PACKAGE-R — Roadmap surface (Settings → About)` (215,120 B, one
Mermaid block, 1 H1) before `## Verification`; Change Log gained a decision row + a service row under
`## 2026-09-22`; the Architecture MOC ADR-031 line extended. System Architecture deliberately
UNCHANGED (no topology/flow) — and that reason is stated inside the ADR section. `verify.sh`:
**43 passed / 0 failed** (orchestrator re-run).

### HARVEY — please test on your Mac (`http://192.168.33.200:5200/`)

1. **Settings → About** — the roadmap should read as ONE column, Now → Next → Exploring, then the
   shipped list. Titles should sit on one line.
2. Does the single column read better than three squeezed columns would have? (That was the choice.)
3. Is the `last reviewed 2026-09-22` line the right weight — noticeable but quiet?
4. Anything in the seed content that is factually wrong or says something you would not promise?

## ▶ ROUND AO — Harvey's 3rd device test: colour cells, the neutrals, the custom picker, the pair gap, the nub. DONE, gates green, VERIFIED LIVE. PENDING HIS DEVICE TEST.

**What it is:** four items from Harvey's third device test (he went away and asked for the whole thing done
autonomously). Spec `ROUND-AO-SPEC.md` (22,013 B) + the evidence file `ROUND-AO-DIAGNOSIS.md` (11,485 B),
both COMMITTED before any code. Base `e4a3e14`. Head `c018656` (7 commits).

**THE DIAGNOSIS WAS THE VALUABLE PART, and one item contradicted its own obvious reading.**

- **AO-3 — the "nub" on a selected step edge is NOT a marker and NOT a corner artifact.** Harvey: *"phần
  giữa hay có 1 điểm nhô ra 2 bên thay vì vòng tròn only"*. Measured live: the midpoint of a selected edge
  with NO label holds the round `.edge-bend-handle` (14×14, radius 50%) and, ON TOP and WIDER, an EMPTY
  `.edge-label` box (17×5 at one zoom, 25×7 at another) that still carries `.selected` — so it paints a 1px
  `--sel` border ~5px out each side of the circle. Cause: the render gate `(shown || editing || d.techn ||
  bendDraggable)` opens the block for the HANDLE when an edge is selected, and the label `<div>` was rendered
  UNCONDITIONALLY inside it. Unselected, the empty box is invisible (no border) — which is exactly why it
  only appeared on selection. **NEGATIVE CONTROL that named it: hide only the label, live → the circle alone
  remains.** Fix: wrap the label in `{hasLabel && …}` (`hasLabel` already `!!(shown || editing || d.techn)` and
  already excludes `bendDraggable`, so `handleAt` needed NO change) + a defensive `.edge-label:empty`.
- **AO-1a/1b/1c — the colour work.** Cells were **80×26px** (a third of the 253px panel each, `swatch3`),
  now **36×26** in a 6-column grid (`swatch6`, `--cell: calc((100% - 35px)/6)`). The palette was nine HUES
  with no black and no white; two theme-invariant neutrals now join ONCE in `:root`. The custom picker: the
  colour model ALREADY accepted a literal hex (`data.color`, `resolveColor` returns it), `resolveColorKey`
  already returned `null` for an arbitrary hex, and `swatchRow` had an UNUSED third parameter — but there was
  no UI reaching any of it. Now a 12th cell (11 keys + 1) holds an `<input type="color">` at `opacity: 0`
  over a designed trigger, so a tap opens the OS picker. Picker on node/edge-stroke/table colour only; the
  Text and label rows stay key-only.
- **AO-2 — the flow-glyph row sat 0px under the count/speed pair.** `.pair .field { margin: 0 }` (0,2,0) beats
  `.field { margin-bottom: 13px }` (0,1,0), correctly zeroing the pair's children — but the `.pair` ELEMENT
  never got the section's rhythm back. Live: pair bottom y=1379, glyph field top y=1379. Fix `margin-bottom:
  13px` on `.pair` (one call site). **Verified live after: gap 0px → 13px.**

**Gates (orchestrator-measured):** `tsc`=0 · `build`=0 · hex **144** (ceiling 160; +2 = the two neutrals) ·
**37/37 harnesses green** · new `checks/round-ao-colour-and-nub.mjs` **23 PASS / 0 FAIL** with its REPLAY
**9/9 RED on `e4a3e14`** · **all four items re-measured LIVE after the fix** (cells 36px with black+white+custom
present; pair gap 13px; selected unlabelled step edge = handle only) · `boards/` byte-identical (sha256).

**FOUR DEFECTS THE HARNESS FOUND — none visible in the five item commits.** The coder hit its iteration
budget (150/150) after committing all five items but before the harness, so the round was finished by hand;
writing the harness and running the required BY-HAND sweep is what surfaced these:
1. AO-1b left `COLORS` (the `Record<ColorKey,string>` literal fallback) WITHOUT the neutrals →
   `keyForHex(COLORS.black)` read `undefined.toLowerCase()` and THREW, taking the whole colours module down
   inside `round-ag-colors` (4 assertions lost).
2. AO-1b left `--c-black`/`--c-white` out of `EXPORT_TOKENS` → an exported standalone SVG would not inline
   them and a black/white node would export a WRONG colour.
3. AO-1c spelled its own label **"Custom colour"** while ROUND AG2/AG4 had removed every British spelling
   from user-visible copy. Three strings; caught by `round-ag2`.
4. The two neutrals are theme-invariant and declared ONCE in `:root`, but the colour harness read each
   theme's block ONLY → it reported them as 8 missing declarations and produced `NaN` contrast. Fixed by
   modelling the cascade (`:root` + block) in `themePalette`.
Plus SIX hex-ratchet pins re-anchored 142 → 144 (each with the increment named, per the standard's
stale-number rule), and the two readability floors (ag16/ag17) restricted BY NAME to the nine hue keys — a
neutral has no hue to read and `white` on white is 1.00 by definition, not a defect.

**⚠️ PROCESS NOTE — the brief said "the dev server is already running"; it was NOT.** The coder measured no
listener on 5200 (`ERR_CONNECTION_REFUSED`) and started one itself because the spec REQUIRED a live-DOM
assertion. It also left its own second server (127.0.0.1) and a probe board (`AO-PROBE-CODER`) behind; both
were cleaned up by PID and by exact id, and Harvey's six boards re-verified byte-identical. **Do not trust a
brief's claim that a server is up — check the port.**

**Not verified:** nothing live-measured remains outstanding; the coder's own probe infrastructure was removed
rather than kept. Harvey's device test IS outstanding (the five checks below).

## ▶ ROUND AN — Harvey's 2nd device test of the edge panel (6 items). DONE, gates green. PENDING HIS DEVICE TEST.

**What it is:** six items from Harvey's second device test, resolved as ONE round. Spec `ROUND-AN-SPEC.md`
(now COMMITTED — the reviewer's audit flagged it sitting untracked while its code was committed; see the
standard at `/home/harvey/projects/PROJECT-PRACTICE.md`). Base `f75f5d1`.

**AN-1 — renaming a label re-centred it. A REAL BUG, and worse than it looked.** Harvey: *"nếu tôi đổi text,
enter thì nó tự nhiên về lại center"*. `__editAt` was a ONE-SHOT create signal written by exactly one place
(`openLabelAt`, a double-click on the path) and **deleted by none** — so it stayed on the edge forever, and
every later RENAME re-entered `commit`'s create branch and wrote the CENTRED state. It was also PERSISTED: grep
measured it in three of his live boards (4 + 2 + 1 occurrences), so after a reload EVERY label was in create
state. AL-4's own comment claimed *"a commit at an EXISTING label leaves `__editAt` undefined"* — false for
every edge ever created through a path double-click. **Fix:** a new `__consumeEditAt` callback threaded from
`App` so BOTH editor exits (commit and cancel) consume the signal, plus a FOLD-ON-READ that drops a stored key
without rewriting any board. A first-created label still centres (AL-4 intact).

**AN-3 — the flow-glyph row now draws in the flow row's own frame.** The two rows drew in different frames
(`ArtFlow` through the shared `G` wrapper at `viewBox 26 18` / stroke 2; `FLOW_ICON_OPTS` building its own
`24 24` / 15px svg), so their ink differed at the same 30×30 chip. Glyph PATHS unchanged; scaled inside the
shared frame by **22/20** and the stroke divided by the same factor. **The spec said 22/24 and was WRONG** — the
coder measured it: 22/24 divides by the GRID and lands at 18.3 units, i.e. SMALLER than the row above, the
opposite error; the ink spans 2..22, so 22/20 is the factor. Chip stays 30×30; `.chips` already wraps.

**AN-4 — the FlowRail is DELETED.** Harvey: *"tôi k cần cái Flow rail, xoá đi"*. Component, render site, all
five CSS rules, the keyframes and both motion-gate entries, and the prop plumbing are gone; the reason is left
in the code where it was so a later round cannot re-add it. The `.speedval` number beside the slider stays. The
`am4.*` claims in `round-am-edge-panel.mjs` were RE-ANCHORED to the removal plus the surviving printed value
(5 new probes, RED on `f75f5d1`) — not silently deleted.

**AN-5 — undo now KEEPS the selection. This was a DEFECT, not a preference.** Figma / draw.io / Excalidraw all
leave the object selected after an undo (selection is UI state, the graph is document state). Cause:
`snapshot()` normalised `selected: false` and `undo()` restored it verbatim, so React Flow's controlled
`onSelectionChange` blanked `selEdgeId` and the inspector closed. Fix: capture the LIVE selection ids at undo
time and re-apply `selected: true` only to entities that still EXIST in the restored graph, deriving
`sel`/`selCount`/`selEdgeId` from what survived. The SNAPSHOT still carries `selected: false`. An undo of a
CREATE legitimately clears the selection.

**AN-6a — a selected label no longer lies about its colour.** `.edge-label.selected` set `color: var(--sel)`
OUTRIGHT, so while selected the authored `--label-fg` never reached the screen: the panel said it changed, the
canvas disagreed (*"do cái select nó đè màu xanh khi chọn. Issue tương tự mũi tên"*). That rule now owns ONLY
the ring (`border-color`), the base rule is the single `color` writer, and an unselected label is byte-identical.

**AN-6b — `--label-plate` finally has consumers.** It was emitted inline and read by NO rule in `src/styles.css`
(grep: zero) — the SIXTH "emitted but never applied" defect in this project, and why the `background color`
swatch did nothing (*"cái background khi tôi đổi cũng k đổi màu luôn"*). Both plate states that offer the
swatch now consume it with the token FIRST and the old value as the FALLBACK:
`.lb-surface { background: var(--label-plate, var(--surface)) }` and `.lb-outline { … var(--label-plate,
transparent) }` — so an untouched board paints exactly what it painted.

**Commits:** `dd02b49` (AN-1) · `023a9e6` (AN-3) · `bd83d48` (AN-4) · `1d186e0` (AN-5) · `07f804a` (AN-6a/6b +
the new harness) · `5c8f900` (AN-6b outline) · `2649632` (the spec). **Not yet pushed.**

**Gates (orchestrator-measured):** `tsc`=0 · `build`=0 · hex **142** (ceiling 160) · **36/36 harnesses green**
· new `checks/round-an-edge-panel.mjs` **19 PASS / 0 FAIL** (17 claim-level assertions + 2 REPLAY assertions;
the vault capture measured 19 and corrected an earlier 18 in this line — the number counts printed PASS
lines, not claims) with its REPLAY probes RED on `f75f5d1` (14 + 2) · `boards/` untouched.

**⚠️ NOT VERIFIED — do not claim it is.** No live gesture, no live panel, no live undo: the headless browser
renders ZERO edges. AN-5's runtime behaviour (selection surviving a real Ctrl+Z) and AN-3's real layout are
proven at SOURCE level only. **Harvey's device test is the outstanding step.**

**PROCESS FAILURE WORTH CARRYING:** the first AN coder run was killed by the ORCHESTRATOR'S OWN `pkill` aimed at
a name pattern, mid-item, with 168 uncommitted lines — recovered only by committing the salvage. Kill by PID from
the launch result, never by pattern; check `git status` before deciding a run is "burning recon" (a run with
modified files has left that phase).

### HARVEY — please test on your Mac (`http://192.168.33.200:5200/`)

1. **Rename a label (AN-1)**: double-click a line's text, type, press Enter — the label must STAY where it is.
   This is the exact bug; it also fixes every label on a board you RELOAD.
2. **Flow glyph (AN-3)**: the six glyph chips should now read as one family with the `flow` row above them.
3. **Flow rail (AN-4)**: it is GONE. `count` + the `speed` slider + the printed seconds remain.
4. **Undo keeps the selection (AN-5)**: select a line, change something, Ctrl+Z — the line must stay SELECTED
   and the inspector stay open.
5. **Label colours (AN-6)**: select a line and change **text color** — it must change WHILE selected (ring
   stays visible). Change **background** to Surface or Outline — the plate must take the colour.

**VAULT DEBT — ROUNDS AK, AL, AM **and now AN** (4 rounds).** Do them in ONE pass via `pkm`: a new ADR-031
section, Change Log rows, the Mermaid update, the Architecture MOC line.

---

## ▶ ROUND AM — Harvey's five connection-line items. DONE. PENDING HIS DEVICE TEST.

**What it is:** five feedback items on the connection line, resolved as ONE round. Spec
`ROUND-AM-SPEC.md`; the **approved** mockup (for AM-2…AM-5) is
`/home/harvey/diagram-studio-research/mockup-am-edge-flow.html` — Harvey said "ok làm đi"
2026-09-21 against it.

**AM-1 — THE LABEL-DRAG BUG, and the root cause was measured, not guessed.** Harvey: *"khi nắm kéo
text di chuyển, sau lần đầu, những lần sau nắm kéo thì cái text bị giật và ra xa con trỏ chuột 1
khoảng"*. `GoblinEdge` computed the anchor `L` **during render** and `onLabelDown` closed over that
render's value; `labelWrite({W, anchor: L})` returns `W − L`, which is a DELTA only while `L` is the
anchor. Once `labelPinned` was true, `L` was the **painted point**, so the write became
`pointer − painted` — the label FROZE under the finger and the next write teleported it by exactly
the previous drag's distance. Reproduced by executing the shipped `src/edgeLabel.ts` under Node:
drag 1 ends at {300,200} → painted {300,200}, error 0.0px (**looks perfect — a one-gesture harness
would have passed the broken tree**); drag 2 ends at {400,250} → painted {200,150}, error **223.6px**,
exactly drag 1's own distance. **Fix:** the gesture now writes a DELTA with an ANCHOR REBASE —
`anchorWrite` (new, in `edgeLabel.ts`) reports `W − reference` where `reference` is the painted point
in the incoming frame for a gesture's first write and the previous reported point thereafter, and
`App.onLabelWrite` rebases the stored offset by the anchor's movement before accumulating. The
renderer publishes the live anchor through an `anchorRef` effect, because React Flow's controlled flow
means the closure's anchor is ALWAYS one render stale — a plain delta would still drift by exactly a
node's movement, which AM1-b measures (31.6px shipped; 226.7px with the rebase deleted). `labelWrite`
keeps its exact body as the ABSOLUTE form, used only by the create/centred/reset writes and now
returning `labelAnchor: null`. Centred writes delete **all three** keys (`labelOffset`, `labelPinned`,
`labelAnchor`), so "reset", "dragged exactly back" and "never moved" stay ONE stored state. **No
migration, no board rewrite.**

**AM-2 — the edge label gets a TEXT section.** `text` added to the EDGE section list, ordered
`label → text → line → markers → [cardinality] → flow` (`src/inspector.ts`). Stored as
`data.labelStyle` (the EDGE's own key, so it cannot overwrite a node's `textStyle`) and emitted by
`edgeTextStyleVars` — the edge subset of the ONE `textStyleVars`, not a second vocabulary; it emits
`--ts-scale` / `--ts-weight` / `--ts-font` and deliberately NOT align/vAlign/colour. SIZE / WEIGHT /
FONT come from the shared `TEXT_*_OPTS`. **No ALIGN and no vAlign:** an edge label is an inline chip
with no box to align inside — its position IS the drag. `.edge-label`'s three declarations became vars
with **today's literals as the fallbacks** (`calc(11px * var(--ts-scale, 1))`, `var(--ts-weight, 600)`,
`var(--ts-font, var(--mono))`), which is the parity guarantee: an untouched board emits no inline
property and paints the identical bytes. **The `600` fallback is the load-bearing one** — every node row
falls back to `400`, so copying that would have silently lightened every existing edge label.

**AM-3 — the flow-glyph row draws its glyphs.** `FLOW_ICON_PATHS` MOVED out of `GoblinEdge.tsx` into
`src/flowIcons.tsx`, a React-Flow-free leaf read by BOTH the edge renderer and the panel — AL-6's "reuses
the same vocabulary" comment is now structural. `FLOW_ICON_OPTS` no longer passes `art: null`: the six
chips are 30×30 squares carrying the glyph that will actually travel the line. No glyph path was touched.

**AM-4 — the speed gets a real illustration.** `FlowRail`: a bead travelling a rail at the edge's ACTUAL
`flowDuration`, so the picture IS the speed. It reads the same `value` prop the number prints, so it
cannot disagree; it is `aria-hidden` and **decorative, never the source of truth**; and it obeys the
project's own two motion switches (`prefers-reduced-motion` and `.ds-no-anim`).

**AM-5 — count smaller, count + speed on ONE row, speed as a SLIDER.** `Stepper` gained an OPT-IN
`compact` prop (default `false`, so no other caller re-flows) capping it at 96px; the four speed words
became one `<input type="range">` over the renderer's own clamp (0.6…8s — all four old chip values
4/2.4/1.4/0.8 live inside it, so nothing became unreachable) with the seconds printed beside it.
**The display direction is INVERTED** (`sliderSeconds = SPEED_MAX + SPEED_MIN − position`), so dragging
RIGHT is FASTER — the one place the inversion happens, and the printed number is always the real stored
seconds. One gesture = ONE undo step (`coalesce` + a pointer/keyboard boundary latch, with `ev.repeat`
guarded so a held arrow key cannot re-arm per repeat).

**Commits (base `253a77e`, 11 total):** AM-1 → `6cb9f6c`, `954be91`, `303c655`, `ed89dc9`, `3c23b4c`,
`1a819f1` · AM-2 → `50c8743` · AM-3 → `3fe4d4a` · AM-4+AM-5 → `05120ce`, `7add0ac` · the AM harness →
`924ed03`. **Not yet pushed.**

**Gates (orchestrator-measured):** `tsc`=0 · `build`=0 · hex **142** (ceiling 160, unchanged) ·
**35/35 harnesses green** · new `checks/round-am-label-drag.mjs` **19/19** and
`checks/round-am-edge-panel.mjs` **23/23**, each with its own negative control RED on the pinned
pre-change tree (AM-1: 12/12 source probes RED at `253a77e` plus the pre-fix module loaded from the
commit; AM-2…AM-5: 12/12 RED at `1a819f1`) · `boards/` untouched.

**TWO HARNESSES WERE RE-ANCHORED, with the old claim kept beside the new one** — not quietly dropped:
`round-aa-align-marquee-palette.mjs` `aa1.the-chip-glyph-rows-are-not-mistaken-for-half-rows` and
`round-al-edge-panel.mjs` `al6` both asserted a chip row FOR `SPEED_OPTS`, which stopped being a chip
row. Both now assert the same distinction with rows that still exist. `round-aa`'s REPLAY ALSO CRASHED
(a `b.picks` read that only the working tree has), which killed its negative control instead of
reporting it — fixed to read as `false` (probe RED) rather than throw. Also re-anchored by the coder:
`package-p-inspector` (its curvature probe had an **unbounded slice** — its end anchor stopped existing
when AL-6 moved that row, so `indexOf` returned −1 and the slice ran 18,684 chars to EOF, passing only
by luck), and `round-s-edge-bend` (its "0 `type=range` in live source" became false for a reason
unrelated to its subject).

**⚠️ WHAT IS *NOT* VERIFIED — do not claim it is.** **No live gesture and no live edge-panel
measurement exists.** This project's headless browser renders **ZERO edges** (nodes render, `minimap
edges`=0), so every number above is a source measurement or a Node-executed return value. **The feel of
the new drag, the slider, the rail and the glyph row is Harvey's device test.**

### HARVEY — please test on your Mac (`http://192.168.33.200:5200/`)

1. **The drag (AM-1)**: grab a line's text and drag it — it must stay UNDER the pointer, first drag and
   every drag after. Then drag it somewhere, let go, and drag it AGAIN from the new spot: this is the
   exact case that used to jump.
2. **Text size (AM-2)**: select a line → the new **Text** section → S/M/L/XL + weight + font. An old
   board's labels must look unchanged until you touch a control.
3. **Flow glyph (AM-3)**: the six glyph chips now SHOW the picture (Letter/Package/File/Zap/Gear/DB).
4. **Speed (AM-4/AM-5)**: a dot/dash/icon flow → **count + speed on one row**, speed is a slider that
   prints the seconds; drag RIGHT = faster; the rail below animates at that speed.
5. **Undo**: after a slider drag, ONE Ctrl+Z must undo the whole gesture, not one frame of it.

**VAULT DEBT — ROUND AK, AL **and** AM together (3 rounds).** Do all three in ONE pass via `pkm`: a new
ADR-031 section, one Change Log row, the Mermaid diagram update, and the Architecture MOC line.

---

## ▶ ROUND AL — the edge panel re-shaped from Harvey's device test. DONE. PENDING HIS DEVICE TEST.

**What it is:** the round that AMENDS ROUND AK from his own device test. Spec `ROUND-AL-SPEC.md`;
his verbatim complaints with a measured cause for each in `ROUND-AL-FEEDBACK.md`; the **approved**
mockup (v4, accepted after 4 revisions) is `/home/harvey/diagram-studio-research/mockup-al-sidebar-real.html`.

**The seven items.** **AL-1** selection = option C — the body again paints `var(--sel)` (the look he
liked) with a thin INNER `<path class="edge-sel-core">` in the AUTHORED colour, so changing the colour
while selected is visible immediately; the rejected dashed halo (`.edge-sel-overlay`, its +5 width and
its dasharray) is deleted, and an unselected edge renders byte-identically to before. **AL-2** BOTH
rails (snap-to-centre, clamp-to-range) are DELETED from the write path — a label dragged far away stays
there; the only way home is `Reset label position` — and the drag lock became a real 2-3 SCREEN px
instead of `lock: 0`, so a plain click no longer writes an offset. **AL-3** the plate defaults to
`none`; at `none` the glyphs get a canvas-coloured halo (`text-shadow` in `var(--bg)`) so the label and
the line stop being ambiguous; two NEW swatch rows (`text color`, `background color`) read through the
existing `resolveColorKey`. **AL-4** a FIRST-created label centres, ignoring the click point (an
existing label still never moves when edited). **AL-5** the two actions keep their own sections
(`Reset` in LABEL, `Reverse` in LINE) and became dashed action chips. **AL-6** ONE chip system for the
whole panel: `.chips` (flex-wrap, no fixed columns) + a 30px pill + a 30×30 square glyph chip + a
`.chip.act` action variant; the stepper buttons, the stepper value and the text input are 30px too; the
crowded rows were split (width / line style / curvature each their own row; count and speed each their
own row) and the flow + flow-glyph rows became square GLYPH chips (`ArtFlow`, new in
`src/InspectorPickers.tsx`). **AL-7** count/speed appear only for a payload flow (`dots`/`icon`), with
the reduce-motion gate still a separate axis. **C4 is explicitly OUT of this round** — he wants
flowchart to be the good initial, applied to the others later.

**Commits:** `4368dc7` (AL-1) · `5c0fb99` (AL-2 + AL-4) · `5a67cf7` (AL-3) · `a19272d` (AL-3 rest +
AL-5/6/7 + the AL harness) · `deae093` (ArtFlow + the probe fixes) · then the four re-anchors
`1cd018a`, `f719439`, `16dbb93`, `7026036`.

**Gates:** `tsc=0` · `build=0` · hex=**142** (ceiling 160) · **33/33 harnesses green** ·
`boards/` untouched (6 files: Harvey's own, including the 2 his session created at 16:07/16:30).

**What is NOT proven:** the round's feel. Every number above is a source measurement or a pure-function
run under Node (`checks/round-al-edge-panel.mjs`, whose own negative control puts all 13 of its source
probes RED on the pre-change tree `f0b00aa`). Nobody has yet LOOKED at the new chips, dragged a label
far off the line, or changed a colour while selected. That is the review below.

### HARVEY — please test on your Mac (`http://192.168.33.200:5200/`)

1. **Chip system**: open a line's sidebar. Every control should be the same 30px height — the pills,
   the square glyph chips (flow, markers, line style, curvature), the count/speed steppers, the label
   input. No row should look crowded or overflow. Does it read as ONE system?
2. **Selection colour (AL-1)**: select a line and change its colour. The body must change **while
   selected** (green body + a thin core in the new colour). Then check an unselected line looks exactly
   as it did before.
3. **Label free drag (AL-2)**: drag a label far off the line, click empty canvas, then select the edge
   again. It must NOT jump back to the centre. `Reset label position` is the only way home.
4. **Plain click writes nothing (AL-2)**: click ONCE on a label without moving. It must not shift.
5. **Plate default (AL-3)**: a new label should have NO white plate, and the text should still be
   legible over the line (canvas halo). Try `text color` and `background color`; the background swatch
   row should only appear once a plate is on.
6. **Double-click (AL-4)**: double-click a point on a line with no label — the label must appear
   CENTRED, not where you clicked.
7. **Flow row**: choose each of None/Dots/Dash/Pulse/Icon. Count and Speed must appear ONLY for Dots
   and Icon. Do the dots fight the selection colour?
8. **The two actions (AL-5)**: `Reset label position` at the bottom of Label, `Reverse line direction`
   at the bottom of Line. Do they look intentional rather than dumped? (This is the exact thing you
   called "nằm kỳ" — it was the structure that was wrong, not the buttons.)

### VAULT DEBT — ROUND AK **and** AL together

Neither round is in the vault yet. When recording, do BOTH in one pass: a new ADR-031 section covering
ROUND AK + ROUND AL, one Change Log row, the Mermaid diagram update, and the Architecture MOC — all via
`pkm`. Deliberately deferred until after his review, so a review finding does not have to be revised
twice.

---

## ▶ ROUND AK — connection-line (edge) utilities. DONE, pushed at `4a127cb`. AMENDED BY ROUND AL ABOVE.


**What it is:** eleven of Harvey's asks, resolved as ONE round in 3 passes — the edge panel, the label,
and the flow animation. Spec `ROUND-AK-SPEC.md`; research + synthesis in
`/home/harvey/diagram-studio-research/edge-utilities/` (3 grounded reports, C1 draw.io · C2
Excalidraw+tldraw · C3 React Flow + Miro/Lucidchart/Whimsical/FigJam, plus `SYNTHESIS.md`).

**PASS 1** (`b200d31`…`26c61e2`) — **bug #7 fixed**: two `!important` rules
(`.react-flow__edge.selected .react-flow__edge-path` and `.ds-electric …`) REPLACED by a separate
additive `<path class="edge-sel-overlay">` drawn under the body from React Flow's own `selected` flag, so
a selected/hovered edge stops lying about its colour. Also: sidebar hint deleted · `intent label` +
its `labelPresets` preset gate deleted outright · `label position` deleted · the orphan
`animated (dash on the line)` field deleted (migrated to `flow:'dash'` on read) · markers renamed
`start`/`end` and unified with Cardinality · stroke width / line style / curvature / both markers became
full-width flat rows · **cardinality now gated on the EDGE (`hasCrowFootEnds`), not the board preset** —
the last preset-keyed rule in the panel, following the project's own `hasSub`-keys-on-shape precedent.

**PASS 2** (`1fae20e`, `50a8eff`) — `src/edgeLabel.ts` (NEW, 408 lines pure) + `src/useEdgeGesture.ts`
(NEW, 161 lines — ONE hook for both the bend and the label, so one pointerdown can never start two
gestures). The **label itself is now the drag target** (`data.labelOffset {x,y}` + `data.labelPinned`,
nothing migrates on load) · `data.labelBg: 'none'|'surface'|'outline'` (3 real CSS classes, `None` is a
stored value) · double-click on the LINE creates a label at that point · `Reset label position` button ·
snap-to-centre · clamp clear of the arrowheads · `Reverse line direction`. The hover-only
`.edge-label:hover` rule is deleted (there is no hover on touch).

**PASS 3** (`4a127cb`) — `flow:'event'` (a 16×12 envelope) FOLDED into `flow:'icon'` + `mail`, because
`FLOW_ICON_PATHS.mail` IS an envelope: two names, one picture. Folded ON READ in `migrateEdge`, so no
board is rewritten. Panel list 6 → 5 (`None/Dots/Dash/Pulse/Icon`). The render branch, its envelope and
the type-union member are all deleted. **The honest limit is recorded IN THE CODE:** no surveyed tool
ships a connector-wide marching-ants animation, so only the *removal* is evidence-backed and the five
names are the owner's call. `diagram-studio:animate` stays a **separate** axis.

**Gates (orchestrator-measured):** `tsc`=0 · `build`=0 · hex **142** (ceiling 160) · **32/32 harnesses
green** · `boards/` untouched (4 files). New harnesses: `round-ak-edge-panel`, `round-ak2-label`,
`round-ak3-flow` — each with its negative control demonstrated RED on the pinned pre-change tree.

**⚠️ WHAT IS *NOT* VERIFIED — do not claim it is.** The headless browser session for this project renders
**ZERO edges** (nodes render, minimap nodes render, `minimap edges`=0, no React Flow warning) even on
Harvey's own board, on the ORIGINAL tree, with a fresh server and a fresh browser session. So **no live
measurement of bug #7 or of any gesture exists**. Everything above is source-level evidence plus
harnesses. **Harvey's Mac test is the outstanding step.**

**▶ HARVEY'S TEST LIST:** (1) select a coloured edge → change its colour → the BODY must change while
still selected; hovering must not repaint the body either. (2) Drag the text itself around the line; drop
it near the middle and it should snap back to centre. (3) Double-click an EMPTY line → a label is created
where you clicked; double-click an existing label → it edits. (4) Label background `None` / `Surface` /
`Outline` — `None` is truly transparent. (5) `Reset label position` and `Reverse line direction` in the
sidebar. (6) A flowchart board and a C4 board must now show the SAME line sections; Cardinality appears
only when THAT edge carries a crow's-foot. (7) Flow animation offers five options, no `Envelope`.
(8) `Ctrl+Z` a few times.

**Vault: ROUND AK + ROUND AL are NOT yet in the vault** — ADR-031 + Change Log + MOC is the outstanding debt (the
TEMPLATES arc debt noted below was paid on 2026-09-20; **do not re-pay it**).

**PROCESS LESSON (this round):** the same narrow job failed across **three** coder dispatches — the first
was SIGTERM'd by `agent_close` and lost everything uncommitted; the second hit its 150-iteration budget;
the third exited after 7 minutes having written nothing. Per Harvey's LOOP-BREAK rule the orchestrator
**stopped dispatching and finished it directly** — which worked. Give every long coder brief a
**commit-as-you-go** rule: the run that had one survived with its work.

---

**Last session:** 2026-09-20 (evening) · **Status:** ✅ PACKAGE-P + W + X + Y + Z + AA + AB + AD + AE +
AF + AG1 + AG2 + AH + AI + AJ shipped, then the **TEMPLATES arc (rounds 1–6 + the `delay` shape fix)**
shipped on top — see the first `##` section below. All orchestrator-verified live.
**Vault: ROUNDS S…AJ are recorded** (ADR-031 + Change Log + System Architecture + MOC + Content Index;
`pkm verify.sh` 43 passed / 0 failed, re-verified by the orchestrator 2026-09-20).
**The TEMPLATES arc IS in the vault** — *(corrected 2026-09-21: this line used to say it was the
outstanding debt. It was paid on 2026-09-20 and re-verified by the orchestrator on 2026-09-21 — ADR-031
carries `## Vòng TEMPLATES (1–6) + fix shape delay` with its own Verification line, and the Change Log
carries the matching 2026-09-20 row. The stale sentence is kept, dated, rather than deleted.)* The
outstanding vault debt is now **ROUND AK** — see the section at the top of this file.
**ALL 32 HARNESSES GREEN** as of ROUND AK (28 → 32: `round-ak-edge-panel`, `round-ak2-label`,
`round-ak3-flow`, plus `checks/measure-flows.mjs`, a read-only probe).
**Dev server RUNNING** on `http://192.168.33.200:5200/` (it dies when the session that started it closes —
if it is down, `npx vite --host 0.0.0.0 --port 5200`).

## ⚠️ BOARD STATE — read before touching `boards/`

`boards/` is **runtime data, gitignored, and Harvey's to change freely.** He confirmed 2026-09-20:
*"nếu ko khớp trạng thái mới, có thể xoá ko vấn đề"* — a board that no longer matches the documented
invariant may simply be DELETED; it is not an artifact to preserve.

**Current state (measured 2026-09-20):** the old board set (`mu01q1ue3a854b81` "Kafka rebalance" had
drifted to **4 nodes / 2 edges** with a Text label and a bent edge, not the documented 3n/2e; plus
`mu99xrmwb792cf01` "Untitled" 2n/1e) was **deleted at Harvey's instruction**. Backups sit at
`/tmp/ds-boards-backup-20260920/` (tmp — do not rely on them surviving). The app **regenerates a clean
first-run board on its own**: a fresh load with an empty `boards/` produced `mu9iat9i2b1b9bb7` =
"My first board", **3 nodes / 2 edges** (External System → Queue → Service, positions
`60,180 · 360,170 · 680,180`), bezier/slate/solid edges, **no `theme` key**, **no `preset` key**.

**Consequence for the old invariant:** the "demo-board invariant" (`mu01q1ue3a854b81` is 3n/2e at
positions `-53,298 · 324,290 · 704,290` with `preset:"architecture"`) is **SUPERSEDED** — that file no
longer exists. Do **not** recreate it; do **not** treat its absence as data loss. Assert the *shape* of
a clean board instead (3 nodes / 2 edges, no `theme` key) against whatever board is current.

**No harness reads `boards/` any more** (verified 2026-09-20): `checks/package-q-reconnect-endpoints.mjs`
derives its fixture from `src/presets.ts` / `src/DiagramNode.tsx` constants (ROUND AJ removed the live
coupling) and `checks/round-ag2-copy-sub-swatch.mjs` only *mentions* `boards/` in a report line.
**All harnesses exit 0 with the folder emptied** — re-measured after the deletion. The templates arc added
three files (`package-templates`, `round-4-dialog-tooltip-approval`, `round-5-resize-undo`) taking the total
to **28**, and none of them reads `boards/` either.

**Harvey's boards are HIS working canvas — never delete or rewrite them.** As of the end of the templates
arc he holds 8 (`Untitled` … `Untitled 6` plus one he named himself). While probing, use a throwaway board
and delete exactly that one afterwards (`POST /api/boards` → seed → `DELETE /api/boards/<id>`), and prove
the before/after listing is otherwise unchanged.

### Harness tally re-measured 2026-09-20 after the board deletion (orchestrator, current tree)

`npx tsc --noEmit` = **0** · `node ./node_modules/vite/bin/vite.js build` = **0** · hex literals = **142**
(ceiling 160) · **every one of the 25 files in `checks/*.mjs` exits 0**, and every file that prints a
verdict is green: `package-p-inspector` 153/153 · `package-q-panel-shortcuts` 50/0 · `package-o-metrics`
35/35 · `package-o-selection-stack` 12/12 · `package-o-board-dialog.harness` 10/10 ·
`node-click-distance.harness` 27/27 · `round-aa` 30/30 · `round-ab` 19/19 · `round-ad` 19/19 ·
`round-ae` 10/10 · `round-af` 21/21 · `round-ag` 31/31 · `round-ag2` 27/27 · `round-ai` 18/18 ·
`round-r` 26/26 · `round-v` 33/33 · `round-y` 12/12 · `round-z` all passed ·
`package-p-render-check` all passed · `package-q-reconnect-endpoints` ALL GREEN ·
`round-aj-table-handles` ALL GREEN · `round-s-edge-bend` ALL GREEN · `boot-no-flash` GREEN ·
`theme-boot-script` GREEN · `theme-boot-sync` GREEN.

## TEMPLATES arc 2026-09-20 — shipped `d7c8e0b` → `0e0e28e`

**Harvey's ask:** templates for Flowchart at 3 levels (basic / advanced / complex), designed so more
diagram families can be added later without a rewrite.

**Where it lives:** the gallery is reached from the boards menu (**`Create from Templates`**, renamed from
`Templates…`) and from the New-board dialog's **`Use template`** row. `src/templateCatalog.ts` builds and
groups the catalog; `TemplatesGallery.tsx` is the ONE UI reader of it; `BoardDialog.tsx` no longer names
`PRESETS` at all.

**Shipped rounds (each one gated, orchestrator-verified live):**

- **`c50a42e` pass 1** — a `level` field on `TemplateSpec`, three flowchart templates, family/level grouping,
  `checks/package-templates.mjs`.
- **`b30112b` round 2** — the three templates **re-domained to online ordering & delivery** (Harvey: the
  flat-pack content was "khó hiểu"), plus a NODE-TEXT GRAMMAR: each shape may only carry the kind of
  sentence it means — an imperative action for Process/Preparation/Subprocess/Manual-op, a `?`-terminated
  question for Decision, a noun for data/document shapes, a state for Terminal/Loop-limit/Connector/Delay.
  0 violations measured.
- **`dddc6f1`** — two edge labels exceeded the preset's own `maxLabelChars: 30`; shortened, and guarded by a
  new assertion so it cannot come back.
- **`2d0cf20` pass 2** — `TemplatesGallery.tsx`: 2-pane desktop, responsive to tablet/phone, 7 cards.
- **`d7c8e0b` delay shape fix** — the `delay` path was `M2 2 H100 A 48 48 …`, so the arc fell 52 units
  (26% of the box) short of the right edge while `display` reached 198/200. Measured 26% → 0%, fixed in BOTH
  render sites (`ShapeFrame` and the palette's `ShapePreview`). Only `delay` was affected; all 16 shapes swept.
- **`32fb563` round 3** — `Use template` creates the board in ONE step (no dialog pit-stop), via a pure
  `nextUntitledName(existing)` in `boards.ts` (smallest unused `Untitled N`; fills gaps; a user's own board
  names never shift the numbering). ONE `createFromTemplate` owns board creation for both routes.
- **`a8b79cf` round 4** — dialog reduced to TWO rows; menu row renamed `Create from Templates`; **the stuck
  tooltip fixed**; the `approval` template deleted.
- **`d866342` round 5** — a resize is one undoable step (see the trap below).
- **`0e0e28e` round 6** — both dialog rows made visually uniform with the radio model deleted outright;
  row gap 4 → 8px; the typed name now survives into the gallery.

**THE TWO ROOT CAUSES WORTH REMEMBERING (both measured, not guessed):**

1. **The stuck tooltip.** `Tooltip.tsx` showed on BOTH `onMouseEnter` and `onFocus`, but hid only on
   `onMouseLeave` / blur / Escape. After a create or delete, `returnFocusTo.current.focus()` restores the
   caret to the Boards button — focus lands with the pointer nowhere near it, `onFocus` fires, and **no
   `mouseleave` will ever arrive** to dismiss it. Fix is modality-aware (a focus only opens the tooltip when
   the focus came from the keyboard), applied INSIDE `Tooltip.tsx` so all ~20 call sites benefit.
2. **Resize was not undoable.** A MOVE is covered at the gesture level (`onNodeDragStart` → `pushHistory`),
   but a RESIZE had no equivalent hook: `NodeResizer` carried geometry props only, and `handleNodesChange`
   only looked at `type === 'remove'`, so every `dimensions` change fell through. Fixed by keying off the
   `resizing: true` flag with a per-gesture latch (`src/resizeHistory.ts`, pure) so one grip drag = ONE
   entry — pushing per frame would bury the history under hundreds of steps. **Do NOT key off
   `onResizeStart`**: d3-drag fires it on a bare CLICK on a grip, which would record an undo step for a
   gesture that changed nothing.

**A defect Harvey reported that was NOT real:** he saw the resize-undo gap only "when the shape has no
connections". Measured both cases with a real mouse drag — standalone node and node-with-an-edge behave
identically. Nothing in the history path references edges.

**Deliberate non-changes:** the `approval` template was removed rather than re-levelled; create mode's
`Create board` submit button was removed (both rows act on press, so it was dead UI) while rename/delete
kept theirs; `Shape` is a 25-id union, not 19 (the spec's "19" predates ROUND AD).

**A coder died mid-round 6** after finishing the source but before the gap fix and the harness re-anchors
(harness red: package-templates 50/60, round-4 13/18, package-o-board-dialog 8/10). Round 6b finished only
those two things. **Detect this by `ps aux | grep "[c]oder chat"` — a dead child sends no completion notice.**

**Gates (orchestrator-measured on the current tree):** `tsc` 0 · `build` 0 · hex **142** · **all 28
harnesses green** (`package-templates` 60/60, `round-4` 18/18, `package-o-board-dialog` 10/10,
`round-5-resize-undo` new).

## ROUND AJ — the two known debts, cleaned

**ITEM 1 — `package-q-reconnect-endpoints.mjs` is no longer stale.** It had reported 15/16 failures
because 11 of its assertions required the endpoint DISC to be painted — the disc Harvey asked ROUND T to
remove. It was left as the record at the time ("do not fix a harness to hide a real change"), and Harvey
then asked for the debt to be cleaned. **The file was INVERTED, not deleted** (a check that silently
disappears is worse than one that changes verdict with a recorded reason — the same rule AG2/AH
followed). Its live-board coupling was removed rather than freezing Harvey's current board into it: a
harness that fails whenever the user edits his board is not a harness. Now `ALL GREEN`.

**ITEM 2 — the ERD table's connection handles were CLIPPED.** Measured before: `.tnode` carried
`overflow: hidden`, the six handles are its children, the left handle protruded 4px and was cut, so a
table handle painted **7×7px against every other node's 11×11px**. Fixed by moving the radius clip to
where it is actually needed (the header, which now carries its own `8px 8px 0 0`) instead of clipping
the whole node box. **Verified live: the table handle now measures 11.1×11.1px — identical to a goblin
node — protruding 5.5px with nothing clipped, and the table's silhouette, radius (9px), header bar and
columns are unchanged.**

**Worth keeping:** the coder's own negative control caught a parser bug in its NEW harness (nested rules
lost their selector), which had made three inverted assertions vacuous — they passed on the pre-fix tree.
Fixed and re-proved. That is exactly why an inverted assertion must be shown RED before the fix.

## ROUND AI — vAlign finally paints, and the body control is flowchart-free

Two of Harvey's review items, both decided by him.

**ITEM 1 — the vertical-align control was present, correct, and doing nothing.** Harvey: *"text vẫn
chỉ nằm trên dù đã chọn Align Middle. Text nên đc tự do trong khung shape"*. The orchestrator measured
three label-only nodes at identical geometry varying ONLY `textStyle.vAlign`: all three had
`--ts-align-items` resolving correctly AND `justify-content` correctly computed, yet **every title top
gap was identical at 13px**. Cause: `.node-body` was **37px tall inside a 96px node**, so
`justify-content` had no free space to distribute. Proof it was the box, not the value: switching the
same node to `body: 'card'` made the box 96px and the gap 43px.

**The root fix:** `src/styles.css` had `.node:not(.label-only) { height: 100% }` — an exclusion that
deliberately kept `.node .lo-body`'s `min-height: 100%` INERT, on the reading that a live percentage
would "drop every flowchart label into the middle". That reading was right about the geometry and wrong
about the intent: `label-only`'s own no-write default IS `middle` (`vAlignForBody`), so the panel SHOWED
Middle while the box painted top. The exclusion is gone; `.node` now takes a definite height, so the
padded box is the node's box. **The vAlign VALUES were never the bug and were not touched.**

Verified live: top/middle/bottom now measure top gaps **13 / 42 / 71** (was 13/13/13) with body height
**96px** on all three. Card path not regressed (kicker + metric still paint). Harness
`round-ai-body-valign` **18/18**, proven 12/18 RED on the pre-fix tree; notably the value/keyword
assertion passes on BOTH trees — which is the point.

**ITEM 2 — the `body` control is hidden for the sixteen flowchart shapes** (Harvey: *"Với flowchart tôi
nghĩ k cần dùng card! Nhớ kiểm tra chỉ impact với flowchart element nhé"*). `hasBody` was added beside
`hasSub` in `src/inspector.ts` and **reuses `NO_SUB_SHAPES`** rather than declaring a second list of the
same ids. A flowchart node already carrying `body: 'card'` still paints it (control removed, data
untouched). **Impact verified live: `service`, `note` and `actor` all KEEP the control.**

**Process note (a real failure worth keeping):** the first attempt at this round spent **31 minutes on
recon and wrote zero code**, then stalled on a request dropped when the network went down — `utime`
rising 1 tick/10s while the report stopped growing, i.e. blocked, not computing. It was killed and
re-dispatched with the recon supplied in the brief and a 6-tool-call budget; the second attempt finished
in 21 minutes. **Lesson: put the recon IN the brief and cap it — and verify a child by PID + a GROWING
log, never the log alone** (also recorded in the skill).

## ROUND AH — the colour-key note's dismissal key moved with its copy

**Harvey's standing rule (recorded):** *when a change makes persisted state no longer appropriate,
CLEAR it rather than preserve it.* He picked this option for the case below.

AG2 renamed the note's VISIBLE text `Colour…` → `Color…` but kept `KEY_NOTE_KEY` British on purpose,
so an already-dismissed note would not reappear — with the cost that a user who dismissed it before
the rename never sees the new copy. Fix: `KEY_NOTE_KEY = 'diagram-studio:color-key-note'`, which also
matches the module's own name (`colorKeyNote.ts` was ALREADY American — only the key string was
British).

**The old key is ABANDONED, not migrated.** `parseKeyNote()` returns true for every value but `'0'`,
so a British-era dismissal resolves to ABSENT and the note shows once. Migrating would re-hide it —
the thing being fixed.

**The assertion was INVERTED, not deleted** (`ag2-14` asserted the British key; a check that silently
disappears is worse than one that changes verdict with a recorded reason).

Verified live: a browser holding ONLY `colour-key-note='0'` shows the note reading
`Color = our grouping, not ISO.`; dismissing writes `color-key-note='0'` and leaves the British entry
untouched; reload + reselect keeps it dismissed. Coder also proved it by executing the shipped module
with stubbed storage (5/5). Gates: tsc=0, build=0, hex 142 unchanged.

## ROUND AG1 — the colour palette (Harvey chose Option A). DONE + verified live

Harvey: *"decision có vẻ màu vàng nhưng chúng ta lại thiếu, có phải đó là lý do bạn chọn màu nâu
đất?"* — **he was right, and it was a real bug.**

**The bug, measured:** `--c-amber` was hue **43°** in dark (`#fbbf24`) but hue **23°** in light and
paper (`#92400e`), at saturation 0.90 — a 20° hue rotation plus a 25-point lightness drop. Yellow at
low lightness IS brown. **The orchestrator swept ALL six tokens** rather than fixing only the
reported one: only `amber` was a real defect. `cyan` (22° spread) is cyan-teal→teal, same family;
`slate` (185° spread) is near-grey at saturation **0.12**, invisible. **Lesson: a hue spread matters
only where saturation is high enough to see it.**

**Harvey chose OPTION A — keep the hue, adapt only lightness**, which is what every tool with a dark
mode does. draw.io's docs say it verbatim (*"They don't change hue."*), verified against the live
page. Tokens are NOT renamed to roles — that would hide the bug, not fix it.

**Fixed values:** light `amber` `#8e6700` (hue 43.5°, contrast **4.80**), paper `#6d4f00` (hue 43.5°,
7.29). **Verified live by measuring the PAINTED stroke:** dark 43°, light 44°, paper 43°, midnight
46°, contrast 48° — the hue now holds across every theme, where light used to read 23°.

**Added three hue families** (consensus across Excalidraw/draw.io/tldraw/Mermaid/Miro: red, orange,
yellow, green, teal, blue, purple are 6-7/7; we lacked red and blue): `red` `#ff6b6b`/`#e03131`,
`blue` `#7aa2ff`/`#4465e9`, `pink` `#f783ac`/`#c2255c`, hexes taken from those tools, all declared in
**all five themes**, all clearing 3:1 on both surfaces. **Brown deliberately NOT added** — 1/7
outlier and not a hue family; `amber`'s broken light value already WAS one.
Swatch row is now 9 keys: `accent, green, cyan, violet, amber, slate, red, blue, pink`.

**Recorded, not changed:** the 9% fill yields only a **1.07–1.17** contrast delta from the surface —
invisible as a signal; the stroke carries the semantics (5.4:1–11.8:1). Mermaid deletes its
background array in dark mode for the same reason.

**Hex count 127 → 142** (127 + 3 families × 5 themes = 142, arithmetic asserted). Five older
harnesses pinned the sheet to exactly 127 and went red on a CORRECT tree; the coder re-anchored them
to a 160 ceiling, keeping every assertion id and narrowing only the threshold — a pinned count cannot
survive any round that adds a token legitimately. Verified by diff: only the threshold moved.
Harness `round-ag-colors` **31/31**, proven failing on the pre-fix palette first.

**STILL OPEN (AG2):** the 9-swatch row **wraps 7+2** in the 253px field — measured live, no panel
overflow but an orphan row. Harvey wants an even grid.

## ROUND AF — flowchart default sizes (the "Terminal is too big" fix)

Harvey: *"sao cái terminal nó to so với các hình khác trong flowchart vậy?"* Approved "hướng 1".

**The real bug was worse than a Terminal that was too big.** Only THREE of sixteen flowchart
entries declared a size; the other thirteen wrote no `style.width/height` and fell back to the CSS
floor (`min-width:190px`, auto height) — measured live at **190 × 27–77px**, slivers, while the
Terminal was ~7× their area.

**The root cause, and it corrected our own earlier decision.** Every silhouette is drawn in ONE
frame — `shapes.tsx:111`, `viewBox="0 0 200 100" preserveAspectRatio="none"` — so the geometry is
**stretched to its box**, and **ratio 2.0 is the only ratio that does not distort**. PROVEN by
rendering the `connector` (a circle in that frame) at four box ratios and measuring the painted
result: **2.00 → 1.00 round; 1.67 → 0.83; 1.50 → 0.75; 1.00 → 0.63.** So Decision (1.56) and the
on-page connector (1.00) had been distorted all along, and the Terminal's caps at 1.50 were
elliptical.

**FIX:** one exported `FLOWCHART_NODE_SIZE = {width: 290, height: 145}` for all sixteen entries
plus the template seeds. Ratio exactly 2.000. **Terminal −13.5% area** (came down, not the rest up).
Coder picked **145, not 140**: the floor is enforced only by the resizer, and a 140-tall node
**ratchets** (140→139→137→133…) on the first horizontal resize, while 145 is inert. Floor
constants unchanged.

**`ROUND AD's Terminal 1.50 (270×180) is SUPERSEDED** — it was chosen before the roundness
measurement existed. Flagged to Harvey, not silently changed.

Verified live: connector roundness **1.000** (139.2×139.2, was 0.63); all sixteen render
**290×145**, one distinct value; no label clipping at 145; resizer holds height, clamps at
200×145, survives a zero-movement grip click. Harness `round-af-flowchart-sizes` **21/21**.

## ROUND AD + AE — Harvey's flowchart decisions, built

Harvey reviewed `mockup-flowchart-symbols.html` (ROUND AC) and answered four questions:
**1. Colour = OPTION B** — he keeps the editor's own semantic colour grouping
("tôi muốn thiết kế theo ý tôi trước, đó là điểm khác biệt"). The honest caveat stands and he
accepted it deliberately: the research PROVED no standard colour scheme exists (draw.io's
flowchart stencil contains zero `fillColor`; Mermaid uses one `nodeBkg` for every node). Two
conditions were attached and both are met: **(a)** the key is labelled where the user actually
looks — `Colour = our grouping, not ISO.`, rendered as markup (survives touch), one line, at
the colour control, dismissible with the dismissal persisted; **(b)** the colour stays
**overridable per node** — proven live, green `rgb(74,222,128)` → violet `rgb(167,139,250)`.
   - **2. Symbol set** — the six "every tool ships this" symbols added: Off-page connector,
     Manual input, Display, Stored data, Loop limit, Internal storage. All six PAINT with six
     distinct geometries and all six are searchable.
   - **3. Terminal 1.69 → 1.50** (270×180), in both the palette entry and the template path.
   - **4. Id-based favourite removal** — done; the collision case is PROVEN (two unnamed
     favourites, remove one, the other survives).
   - **`body: card` on flowchart — the orchestrator was WRONG and the coder was right.** I
     concluded from `fc()`'s hard-coded `label-only` that the control was dead UI. Harvey's own
     board disproves it: node `n118` is a `terminator` with `body: card` and a metric. The
     insert paths merely never *default* to card; a user can and does use it. Nothing was
     removed, correctly.
   - Harness: `round-ad-flowchart` 19/19 (incl. a GENERIC hint-agreement sweep that failed on
     the tree first — 6 drift pairs found), `round-ae-favourite-id` 10/10.
   - **Still owed:** `body: card` needs no fix; **vault debt** — ROUNDS S…AE are not yet in
     ADR-031 / the Change Log.

> ## ✅ ROUND AA (2026-09-19) — equal-width rows, a marquee-mode SETTING, the palette typo
>
> **1. THE SEGMENTED BUTTONS SIZED TO THEIR TEXT.** Measured before: `Left` 45 / `Center` 58 / `Right` 51px.
> `.insp-seg` declares `display: grid; grid-auto-columns: 1fr` — which WOULD equalise them — but
> `.swatches { display: flex }` beats it at equal specificity, later in the sheet. Now
> `.insp-seg .insp-seg-btn { flex: 1 1 0; min-width: 0 }` + `.swatches.insp-seg { gap: 5px }` (two classes, so
> the gap is the segmented row's own). **This also fixed a GAP inconsistency it exposed:** `.swatches`'s 7px had
> been beating `.insp-seg`'s 5px everywhere while `.insp-seg.grid3` won inside its own row — 7px in one row, 5px
> in the next. Verified live: every row divides its 253px equally with a uniform 5px gap — size 60×4 · weight
> 124×2 · align 81×3 · vertical 81×3 · font 81×6.
>
> **2. THE MARQUEE REQUIRED FULL ENCLOSURE.** Harvey: *"nếu cái vòng bao của chuột ko dính vào góc trái của
> element thì nó sẽ k đc chọn"*. **ROOT CAUSE:** ReactFlow's default is `selectionMode = SelectionMode.Full`
> (`@xyflow/system`: `enum SelectionMode { Partial, Full }`), and the Pane selects via
> `getNodesInside(..., selectionMode === SelectionMode.Partial, ...)`. **This app passed NO `selectionMode`**, so
> it inherited Full — a marquee clipping any corner left the node unselected. Now a plain LEFT-drag box-selects
> (no Shift), panning stays on middle/right + scroll, the read-only branch still pans on any button, and the
> touch pan path is untouched.
> **THE SETTING Harvey asked for:** `Marquee selection` in the Canvas group — **Touch** (overlap selects) |
> **Enclose** (must fully surround), key `diagram-studio:marquee`, **default Touch = Partial**, absent value
> resolves to it, applies with no reload. Verified both directions live.
> **The setting is now the discoverable surface — do NOT re-add a "Multi-select box" row to `SHORTCUTS_MOUSE`:**
> that list deliberately dropped it (with Pan and Zoom) as over-information, and its comment says so.
>
> **3. `Process` and `Decision` were filed under `Basic`.** Two of the eleven `FLOWCHART_PALETTE` `fc(...)` calls
> passed `'basic'` while the other nine passed `'flowchart'` — a typo, not a decision (they are ISO 5807's
> process and decision symbols). Both moved to `flowchart`. Verified live: Basic badge 3 → 1 (only the generic
> `Text`), Flowchart 8 → 10.
>
> **Harness:** new `checks/round-aa-align-marquee-palette.mjs` 30/30; package-p-inspector 153/153; every other
> harness green. **Process note:** the first dispatch of this round was killed during recon after I mis-read the
> marquee complaint (I assumed the Shift requirement was the issue); a re-dispatch with the measured root cause
> then hit the 150-iteration budget but landed all three items, and the orchestrator committed them.

> ## ✅ ROUND Z (2026-09-19) — six font names in a 3+3 grid + vertical align
>
> **1. SIX FAMILIES, REAL NAMES:** JetBrains / Inter / IBM Plex / Shantell / Lexend / Be Vietnam, 3+3 as
> Harvey asked. **The short button labels are a MEASUREMENT, not taste** — a 3-column cell is 81px (content box
> 65px), while "JetBrains Mono" is 84px and "Be Vietnam Pro" 75.2px at 10px. The full name rides the `title`.
> `public/fonts/` now holds **36 woff2** (400+700 × latin/latin-ext/vietnamese); **offline, no CDN**.
> **Every family was picked by MEASURING its vietnamese subset with fontTools.** Rejected for lacking one:
> Atkinson Hyperlegible, Fira Code, Caveat, **Architects Daughter (draw.io's own sketch font)**.
> **ROUND W's role keys still resolve** — a board storing `'viet'` renders Be Vietnam Pro (verified live).
>
> **2. VERTICAL ALIGN (top/middle/bottom)**, draw.io's model verified in mxGraph source: the padded
> `.node-body` — which already carries the per-shape silhouette insets — is the text's **containing box**, so a
> choice can never move text onto a cylinder cap or a diamond corner. The resizer floor stays
> alignment-invariant.
>
> **⚑ THE THING TO KNOW BEFORE TOUCHING ANY `--ts-*` PROPERTY: three defects here, and they are the SAME family
> as the earlier ones in this session. The harness missed all three.**
> 1. **The emitted value was not a CSS keyword.** `--ts-valign: bottom` was fed to `justify-content`, where
>    `bottom` is invalid → the declaration is DISCARDED, computed `normal`, control does nothing. The keyword
>    mapping existed as `--ts-align-items` with **zero consumers**. **A `var()` cannot translate a semantic name
>    into a keyword — the sheet must read the keyword directly.**
> 2. **`middle` rendered as TOP:** it is the default so it stores absence, and the fallback was `flex-start`.
>    The panel said Middle while every untouched node painted top.
> 3. **A single global default was IMPOSSIBLE.** `.node-body` / `.note-body` / `.label-node` render from
>    `padding-top` (= **top**), while `.node .lo-body` (label-only) centres BY DESIGN (= **middle**). The
>    horizontal axis had already solved this shape — `alignForBody(body)` gives a **per-target** default and
>    `textStyleVars` takes it as a PARAMETER. `vAlign` now does the same (`vAlignForBody`). **Whenever a
>    no-write default differs by target, look for the `alignForBody` pattern rather than inventing a constant.**
>
> **Harness 132 → 153/153**, and the new assertions test that a value **REACHES** the property with a keyword
> **valid for it** and that the **no-write state matches the declared per-target default** — not merely that a
> property was emitted. **That is the fifth "emitted but never applied" defect in this project;** the reference
> `references/verifying-token-driven-styles.md` now carries the rule and the per-target fix.
>
> **Verified live on distinct non-overlapping nodes:** card top → Top/flex-start/at top; middle →
> Middle/center/centred (43/42); bottom → Bottom/flex-end/at bottom (74/10); no textStyle → Top/flex-start.
> label-only no-textStyle → Middle/center; label-only bottom → Bottom/flex-end. note no-textStyle → Top.
> label node bottom → inline `--ts-align-items: flex-end`, computed `flex-end`.
>
> **PROBE LESSONS (four of my own readings were wrong this round, all probe bugs not code bugs):**
> (a) **nodes seeded at the same coordinates** make every click select the same one — always print and check
> the rects; (b) reading a `.insp-seg` group must select the row by `aria-label`, not by index;
> (c) a label node has **no `.node` class**, so `querySelector('.node, .label-node')` returns null for it — read
> the element's own inline `style` instead; (d) **an SVG can sit over a node** so a centre click hits the SVG
> (`elementFromPoint` shows `ownerNode: null`) — click the node's own text child, or read its inline vars
> directly. The app was correct in all four cases.

> ## ✅ ROUND Y (2026-09-19) — the teaching hints out, the target badges out
>
> Harvey: *"Tiếp tục hint chỗ Text color và align tôi nghĩ k cần thiết lắm"* + *"cái label ở top có cần ko?"*
>
> **The Text section now carries ZERO `.hint`** — `SIZE · WEIGHT · FONT · TEXT COLOUR · ALIGN` and nothing else.
> Verified live: a label target reads exactly that with `hints: 0`.
>
> **ALL FOUR target-kind badges are gone.** The reasoning, per badge: a `label` target's panel holds one section
> so `label` said nothing; `edge`/`table` were already evident from their section names; the goblin's
> `{asShape(…)}` printed the SHAPE's machine name (`service`) while the Style section's own picker prints the
> human label — the badge was the less readable of two copies. Each badge's `<div style={{height:12}} />` spacer
> went with it (the 4th was kept but moved INSIDE the C4 conditional, because an unconditional spacer would
> leave a 12px hole on every plain goblin).
>
> **KEPT: the C4 chip.** It is the one surviving badge and it is NOT a kind label — it states the node's C4
> ROLE (`[Container: application]`), which nothing else in the panel and nothing on the node card prints.
> Its now-meaningless `marginLeft: 6` (which separated it from the deleted shape badge) was removed.
> Verified live: label → no badge / 1 section; plain goblin → no badge / 3 sections; C4 container →
> `[Container: application]` / 3 sections. `package-o-metrics` item 5 asserts `.badge.preset` has ≥1 consumer —
> still true (the C4 chip), so it stayed green unmodified.
>
> New harness `checks/round-y-hints-and-badge.mjs` (12/12). Gates: tsc=0, build=0, hex=127 (no CSS touched).
> **Process note worth keeping:** the coder's first slice anchor was `<div className="panel-body">`, which is
> NOT unique (the palette renders one first) — the slice was the palette's and four assertions were passing
> **vacuously**. Re-anchored on `<aside className="panel right">` with a liveness floor. Same failure family as
> the empty-slice bug; see the diagram-studio skill's reference.

> ## ✅ ROUND X (2026-09-19) — Harvey's UI feedback on the Text section
>
> **1. THE SIZE ROW WAS BROKEN, measured live: S/M/L/XL all at `left: 1005` — STACKED INTO A COLUMN** (the
> `.insp-seg` row measured 31×121px). Cause: ROUND W's `.insp-num-row` flex wrapper handed all 253px to the
> input and starved the grid. **Fixed per Harvey: "Trả lại như cũ ko cần input, nhưng rule giữ khi cần"** — the
> input and the dead `.insp-num*` rules are gone; `TEXT_SCALE_MIN/MAX`, `clampTextScale` and the `scale` field
> **stay**, so a board carrying a custom scale still RENDERS it (verified: `{scale:2.0}` paints `--ts-scale:2`,
> title 29px). `readTextStyle().size` now derives the marked step from what PAINTS, so `{scale:1.15}` marks L
> and `{scale:2.0}` marks **nothing** — deliberate, not a leftover.
>
> **THE CASCADE TRAP BEHIND IT (found, flagged, not fixed):** `.insp-seg` declares
> `display: grid; grid-auto-columns: 1fr` but **`.swatches { display: flex }` beats it** at equal specificity,
> later in the sheet — verified: **all four** segmented rows (size/weight/align/font) compute `display: flex;
> flex-wrap: wrap`. The grid declaration has never had any effect and the buttons are auto-width. That is how
> the size buttons could be squeezed to 25px. **Before touching any `.insp-seg`/`.swatches` rule, know this.**
>
> **2.** The custom-size hint deleted (it described a control that no longer exists).
>
> **3. THE FONT CONTROL IS NOW FOUR SELF-PREVIEWING BUTTONS IN ONE ROW** (`ToggleRow wide`, the same `.insp-seg`
> idiom Size and Align use — a modifier, not a fork). Measured: one row, each in its own family
> (Mono/UI/Read/Viet), **184px in a 253px field**, no overflow, no label shrunk. Names print **once** by
> construction, so ROUND W's suppression hooks are gone and asserted absent.
>
> **4.** The label branch's "Free text annotation…" hint deleted, plus a full `.hint` audit (8 entries,
> classified visible-teaching vs invisible-fact). Only the two named were removed.
>
> **Verified live:** S/M/L/XL on one row with distinct lefts (1005/1037/1068/1100) and no input; the four font
> buttons all at one top with their own families; and **all four controls act independently** — XL then M
> returns `--ts-scale` to unset (the lazy write), and Viet/Bold/Right each land without disturbing the others.
>
> **Harness note:** `scripts/measure-font-row.py` (new) measures the four labels' advance widths straight out
> of the woff2 files. Its conclusion (FITS) is right but its arithmetic assumes the grid that does not apply —
> trust the live measurement, not its model, if you change the row.

> ## ✅ ROUND W (2026-09-19) — section header, font picker, custom size
>
> Harvey's three asks from the inspector screenshot. Gates `tsc=0 build=0 hex=127`; harness 117 → 131.
>
> **1. THE SECTION HEADER DID NOT READ AS A HEADER.** Measured: the section title and a `.field label` were
> **identical** (both 11px, both `rgb(138,138,146)`), so a header looked like one more field label and a folded
> section was a 17px dim strip whose only affordance was a 10px dim caret. Now title 13px / `var(--fg)`, caret a
> 16px SVG at full foreground with rotate-on-open, row 17 → 27px.
>
> **2. A FONT PICKER — Mono (JetBrains Mono, default) / UI (Inter) / Read (Lexend) / Viet (Be Vietnam Pro)**,
> applied to the **whole node** as Harvey chose. Four families **shipped in `public/fonts/`** (24 woff2, 688K,
> 400+700 × latin/latin-ext/vietnamese) as 24 `@font-face` rules with per-subset `unicode-range`; **no CDN, the
> app stays offline.** **WHY THOSE FOUR: the obvious "easy read" pick — Atkinson Hyperlegible — has NO
> vietnamese subset**, so it would silently fall back for every accented glyph. The picker previews each option
> **in its own family**. `mono` renders anyway, so picking Mono stores **absence**.
>
> **3. A CUSTOM SIZE** beside the steps: `<input type=number>`, min .5 / max 2 / step .1, typed `1` stores
> absence. **The 2.0x overflow risk was measured, not assumed:** a node at the resizer floor (200×141) with
> worst-case content has its title box 20px below the node — **clipped, not painted** (`.node-body` carries
> `overflow:hidden` per ROUND V; `elementFromPoint` below the box returns the canvas). Floors untouched.
>
> **TWO FOLLOW-UP DEFECTS, both the SAME bug class — one rule reaching one of its two render sites:**
> - The picker painted each option's name **twice** (`Mono Mono`). The `:has()` rule suppressing the duplicate
>   targeted the TRIGGER only. Fixed with a `icon-field-font` hook + `:not(.insp-font-sample)`, so it cannot
>   reach another picker (verified: shape and icon pickers keep their labels).
> - The font **skipped the in-place editor**: a label at rest painted `"Be Vietnam Pro"` while its editor
>   painted `ui-monospace`, so Vietnamese diacritics rendered in a different font while typing than while
>   reading. `--ts-weight/color/align` each carried TWO consumers (label + `.node-label-input`); `--ts-font`
>   had only one. **This was the third instance of that class in one session**, so the harness now asserts the
>   asymmetry **generally** over all four `--ts-*` properties, not per-property.
>
> **Verified live:** all five properties MATCH between the label at rest and its open editor; both vietnamese
> faces load; the goblin's four rows all take the chosen family; every woff2 fetches 200 `font/woff2`.
> **`.edge-label-input` needs no `ts-*`** — the `text` section is listed for `goblin` and `label` only, so an
> edge is not a text-style target. The option row's `title` attribute deliberately keeps printing the name on
> hover: it is the row's only accessible name.

> ## ✅ PACKAGE-P COMPLETE (2026-09-19) — the inspector rebuild
>
> **What it delivers, per Harvey's three asks:** per-shape-type sections (19 goblin shapes used to share ONE
> panel), icon pickers instead of text dropdowns (**the app now renders ZERO native `<select>`**), and the
> rarely-changed controls folded with their current value on the trigger.
>
> **The three passes:**
> 1. `src/inspector.ts` — ONE pure decision function, `getInspectorSections(target)`, mirroring upstream's
>    `shapeActionPredicates.ts`. `src/InspectorPickers.tsx` — the picker kit; all 12 `<select>`s converted.
> 2. `src/textStyle.ts` — the Text section (size / weight / colour / align). Option B, from the Excalidraw
>    research. **`size` is a MULTIPLIER** (`--ts-scale`, ladder 0.85/1/1.15/1.3, `1` = Default = not written)
>    because one node already paints FOUR sizes and the hierarchy IS the ladder.
> 3. `src/inspectorState.ts` — the fold UI + `diagram-studio:inspector-sections`.
>
> **FOUR defects were found during verification, ALL invisible to the harness as it stood — three in pass 2:**
> 1. **Double render.** `secBody` both registered a body AND returned it; all 11 call sites rendered the return
>    value, so every section painted TWICE and Cardinality three times. `secBody` now registers only;
>    `renderSections` is the ONE painter.
> 2. **A stored align that was never painted.** `textStyleVars` hard-coded `left`, but align's default is
>    **per-target** (`center` for `label-only`). Executed both pure functions together: `label-only + Left`
>    stored `{"align":"left"}` and returned `vars={}` — saved and dropped.
> 3. **The variable losing to a more specific rule.** `.node.label-only .lo-body` (specificity 0,3,0) beat
>    `.node .lo-body` (0,2,0) and pinned `text-align: center` **plus** `align-items: center`.
> 4. A **vacuous assertion** from pass 1 (a slice cut at the first `\n}`, so it asserted against an empty
>    string and passed on anything) — found by the coder, fixed with a length floor.
>
> **Defects 2 and 3 are the SAME bug class: one rule with two copies, one right and one guessing.** The harness
> missed them because it asserted *presence*, not *precedence*. It now carries a cross-check for every
> `(align default, choice)` pair and a **specificity sweep** over every `--ts-*` consumer that fails on the
> pre-fix tree. **Read `references/verifying-token-driven-styles.md` in the diagram-studio skill** before
> touching any token-driven style feature — the three traps, the geometry measurement, and the probe hygiene
> (`.tour-overlay` AND `.gsc` swallow clicks; CDP keys do not reach React) that also cost time here.
>
> **§C's ambiguity, resolved:** Style does NOT fold; the goblin `body` toggle moved behind a SECOND-LEVEL
> disclosure inside Style (`▸ body: card`). The old `<label>body</label>` is gone.
>
> **Verified live:** text lands where the user chose (span offset 14/57/35 = left/right/centred in a 186px
> block, and back to the default drops the stored key); size XL `1.3` → title 18.85px, S `0.85` → 12.325px;
> the fold survives a reload; folded rows read `ends: one → zero or many` and `flow: on · 3`; 0 overflow
> against the 288px panel; and with the in-place editor focused, clicking a Text control left the editor
> **open** and the text **uncommitted** (§E.3(b)).

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
> ~~**Known, NOT fixed (pre-existing):** `.tnode { overflow:hidden }` clips TableNode's per-column handles
> (8px, centred on the border → 4px sits outside). Table nodes are not resizable; recorded in the round's skill.~~
> **FIXED IN ROUND AJ (2026-09-20)** — see the ROUND AJ section at the top. `.tnode` no longer clips at all
> (the card was clipping 6px of every 12px handle, not 4px of 8 — the handle was 8px and is now the standard
> 12px like every other node); the radius the clip used to draw moved onto `.tnode-head` (inner radius 8px =
> 9px − 1px border) and onto the card's last child. `checks/round-aj-table-handles.mjs` guards it.
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

**Gates that must stay green (last verified 2026-09-20, ROUND AJ):**
`npx tsc --noEmit` = 0 · `node ./node_modules/vite/bin/vite.js build` = 0 · hex literals in `src/styles.css` = **142**
(must not rise — use an existing CSS variable, never a new hex).

**Harnesses: 25 files in `checks/*.mjs`, run each by path (there is no npm runner).**
**ALL 25 ARE GREEN as of ROUND AJ.** `checks/package-q-reconnect-endpoints.mjs` used to fail 2→13→16 assertions
(it hard-coded an old 3-node board fixture while the live board is Harvey's working board, then ROUND T deleted
the endpoint disc it asserted); ROUND AJ inverted it against ROUND T's real behaviour and removed its read of
`boards/` entirely, so **a harness can no longer be reddened by Harvey using the app.**

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

**PACKAGE-P is COMPLETE, and so is PACKAGE-N.** This section used to say *"then PACKAGE-N — the palette
redesign"*, which went stale: **N shipped on 2026-09-17** (passes 1/2a/2b/2c/3/4a/4b/4c/5 all ✅ — the table
and per-pass verification records further down this file are the record). `PACKAGE-N-SPEC.md` is spent; do
not plan new work from it. **Nothing is queued after the TEMPLATES arc either.** The only open items on N are
Harvey's real-device test and the two recorded cosmetic deviations (a `width="abc"` reason code, and the
panel drop zone proving its wiring only by an actual file drop).

**The standing discipline is unchanged:** land one pass, verify it live, then the next — a mistake in pass 1
gets built on three times otherwise.

**The pass-2 note that pass 3 resolved** (`getInspectorSections` not returning `text` for a goblin) is settled;
`text` sits between `content` and `style` in that one array. The panel's label `<textarea>` is gone — the label
target has exactly ONE text editor, the in-place one.

**Harvey re-tests:** click each shape kind and confirm the panel differs (`group` has no kicker/metric, `note`
has no metric/icon); the 12 dropdowns are icon pickers; **expand/collapse Cardinality and Flow on an ERD edge,
reload, and confirm the fold is remembered**; the chevrons show `Cmd+Ctrl+Shift+[` / `]`; and the three hotkeys
toggle left / right / both. Also: **two onboarding layers swallow clicks** — `.tour-overlay` and the
`Getting started` checklist (`.gsc`). If a click does nothing on a fresh profile, it is one of those, not a bug.

**Known debt: NONE as of ROUND AJ.** `checks/package-q-reconnect-endpoints.mjs` used to report 15/16
failures (11 asserting the endpoint disc ROUND T deliberately removed, 2 old fixture failures, 2 against
the user's LIVE board). ROUND AJ **inverted** those assertions instead of deleting the file and removed the
live-board coupling, so it is now `ALL GREEN`. **All 25 harnesses are green — there is no known-stale
harness any more.**
> **CLEARED IN ROUND AJ (2026-09-20).** The file was INVERTED, not deleted: it now asserts ROUND T's real
> behaviour and every rewritten assertion prints the OLD claim beside the NEW one. It no longer reads `boards/`
> at all — the geometry fixture is derived from `src/presets.ts` / `src/DiagramNode.tsx` constants, so Harvey
> editing his own board can never redden it again. Before 16 failures, after ALL GREEN. The pre-ROUND-T sheet
> is the negative control and still fails exactly the 11 inverted assertions.

**Vault debt:** edge reshaping — ROUND S, T and U are NOT yet in ADR-031 / Change Log. Batch via pkm.
`checks/round-s-edge-bend.mjs` covers (a)–(o).
**Stale harness:** ~~`checks/package-q-reconnect-endpoints.mjs` FAILS 13 (was 2): 11 assertions require the
endpoint disc to be PAINTED, which ROUND T was explicitly asked to remove. Left as the record — do not "fix".~~
> **CLEARED IN ROUND AJ (2026-09-20)** — inverted, not deleted. See the note above.

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

## ▶ PACKAGE N — COMPLETE (all passes 1/2a/2b/2c/3/4a/4b/4c/5 ✅). Kept as the record.

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

`boards/` is **runtime data** — see the BOARD STATE section at the top of this file; the old
`mu01q1ue3a854b81` "Kafka rebalance" 3n/2e board was **deleted at Harvey's instruction on 2026-09-20**
after it drifted to 4n/2e, and its invariant is superseded. `boards/library.json` and its `.bak` are
also runtime data — delete them after any test that creates them. Dev server on
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
