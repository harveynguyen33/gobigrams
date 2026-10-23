<!-- gob:begin (gobstack config — edit in place; the parser reads only this block) -->
practice:
practice_sha256:
archive: false
max_dirty: 0
advisory_ceiling: 10
security.gitignore_family: yes
security.build_output: dist/assets
security.write_routes: vite.config.ts
perf.metric: client_js_bytes
perf.cmd: find dist/assets -type f -name '*.js' -exec cat {} + 2>/dev/null | wc -c
perf.baseline_commit: 0bde816
perf.baseline_value: 831522
perf.measured: 2026-10-12
perf.host_gate:
harness_dir: checks
scaffold_checks: yes
feature_map: features/README.md
source_root: .
verify_doctor:
reference_manifest:
quarantine_root:
gate_tsc_build_cmd: npx tsc --noEmit && npx vite build
gate_todo_ceiling_cmd: test "$(grep -rniE '\b(TODO|FIXME)\b' --include='*.ts' --include='*.tsx' --include='*.js' --include='*.jsx' --include='*.mjs' --exclude-dir=node_modules --exclude-dir=.vite --exclude-dir=dist . 2>/dev/null | wc -l)" -le 160
ratchet.name: client_js_bytes
ratchet.cmd: find dist/assets -type f -name '*.js' -exec cat {} + 2>/dev/null | wc -c
ratchet.ceiling: 924162
# RAISED 2026-10-23 (z-order display mode setting), measured: 924162 (+1060,
# +0.11%). Reason: Harvey's UX call — instead of a hard zIndexMode flip, the
# choice became a SETTING: new src/zOrderMode.ts (persisted 'wysiwyg' |
# 'lift', default wysiwyg = RF 'manual'), the Layer display segmented row in
# Settings Canvas pane, and reorderSelection keeping the selection alive in
# wysiwyg (clearing only under 'lift'). round-bd harness re-anchored to the
# deps-tail + write-budget counts. Harvey approved in chat ("ok approve").
# Gates green at the measurement: tsc 0, build 0, round-bd 47/47, sweep 68/0.
# RAISED 2026-10-23 (Arrange pivot fix), measured: 923102 (+48, +0.005%).
# Reason: BUGFIX 2 — reorderSelection now pivots on `sel` (the last-clicked
# node): the pivot lands ON the band extreme, the rest of the selection stacks
# contiguously beneath/above. Fixes Harvey's "bring to front/back vẫn không
# thay đổi": the array-order band of the first cut could never flip two
# overlapping selected nodes. Harvey approved in chat ("show approve"). Gates
# green at the measurement: tsc 0, build 0, round-bd 47/47, goblin-verify
# 0 FAIL, sweep 68/0.
# RAISED 2026-10-23 (ROUND BD multi-select inspector redesign), measured: 923054
# (+1871, +0.20%). Reason: the multi panel gained reorderSelection (z-order
# bands through setNodes behind one pushHistory), the 3x2 lucide align grid +
# distribute/Arrange icon rows, the shared-key swatch ring, and the new
# checks/round-bd-multi-panel.mjs harness (not in the shipped bundle, but the
# icon imports are). Harvey approved in chat ("send approve"). Gates green at
# the measurement: tsc 0, vite build 0, round-bd 44/44, package-p-inspector +
# package-o-metrics exit 0, sweep 68/0.
# RAISED 2026-10-23 (four create-surface hides), measured: 921183 (+75, +0.008%).
# Reason: STORAGE_ENABLED / ERD_ENABLED / LANE_ENABLED / NOTE_ENABLED — the four
# Harvey hides (Storage; Table+Note(enum); Lane; Note) added filter chains in
# LIBRARY + MIXED_LABELS + the gated withNoteLast hoist in src/presets.ts, and
# the round-aa library floor re-anchor (34→27→22) is a harness, not shipped.
# Harvey approved raises in chat for this round's pattern. Gates green at the
# measurement: tsc 0, vite build 0, goblin-verify 22/0/5, sweep 67/0.
# RAISED 2026-10-22 (config round fixes), measured: 921108 (+12, +0.0013%).
# Reason: the ACTOR_ENABLED hide (Harvey corrected "Action" -> "Actor") added a
# second filter chain in LIBRARY + MIXED_LABELS in src/presets.ts, and the
# positive gating assertion in checks/package-o-metrics.mjs (not in the shipped
# bundle). Harvey approved in chat ("approve sao"). Gates green at the
# measurement: tsc 0, vite build 0, boot-no-flash / package-templates /
# boards-popover-pinned / package-o-metrics all exit 0.
# RAISED 2026-10-22 (config round: items 1/2/4 + A Queue-hide + B boards-popover redesign), measured at HEAD 7786a53: 921096 (+25, +0.003%).
# Previous: 921071 (0 headroom). Reason: the Queue hide added the QUEUE_ENABLED
# flag + filter + seed-facing LIBRARY_FULL assembly in src/presets.ts; the boards
# popover redesign added boardsPopPos state/boardsPopClamp + a createPortal
# block in App.tsx, and the new checks/boards-popover-pinned.mjs harness is not
# in the shipped bundle. Gates green at the measurement: tsc 0, vite build 0,
# goblin-verify 22/0/5, harness sweep 67/0.
# RAISED 2026-10-22 (+450 for the in-modal note explaining when to outline, inside the +2% window).
# Previous: 920561 -> 920621 (+60, the outline-geometry and PDF-flag fixes).
# Reason: the outline-geometry fix and the PDF outline-flag fix added 60 bytes. Breakdown for the record:
# harfbuzz is a separate LAZY chunk (31,694 B JS + a 441,359 B .wasm fetched only in outline mode);
# the fonts are ASSETS under public/fonts (1.9 MB on disk, none of it in client_js_bytes).
# RAISED 2026-10-22, Harvey-approved ("I approve"), measured at HEAD 4ea2c98: 920561.
# Breakdown, measured not estimated: the shipped payload went 875145 -> ~884000 when ROUND C added
# the harfbuzzjs shaper, and harfbuzz lands as a SEPARATE LAZY CHUNK (31694 B) plus a 441359 B .wasm
# fetched only when the user ticks "Outline text"; the metric sums every dist/assets/*.js so it counts
# the lazy chunk, but no user downloads it unless they use outline mode. ROUND AZ added ~4700 B of
# font-embedding plumbing and the file-first shaper; the font files themselves are ASSETS under
# public/fonts (1.9 MB on disk, none of it in client_js_bytes).
# RAISED 2026-10-21 (FINAL raise of the day), Harvey-approved: 883721 -> 900000 (+16279 headroom).
# Reason: the ceiling was being raised once per feature round (4x today: 878/810/2496/1938/61 bytes),
# which turned a bloat alarm into a per-commit negotiation. The ceiling now carries ~1.6% headroom and
# the POLICY below governs raises instead of Harvey being asked each time.
#
# RATCHET POLICY (Harvey, 2026-10-21):
#   1. The orchestrator MAY raise the ceiling without asking when the measured growth is <= +2% of the
#      current ceiling, the round's gates are green (tsc 0, build 0, all harnesses), and the bytes come
#      from code Harvey asked for. Record the measured number + reason in this file and in the vault
#      Change Log. Never raise silently for a jump that is not explained.
#   2. ASK Harvey for anything above +2%, for ANY new npm dependency, or if bytes DROP by more than 2%
#      (a large drop usually means code was deleted by accident, not optimised).
#   3. Re-baseline the ceiling at release milestones only (a release candidate, a major round boundary),
#      not per round. Between milestones the ceiling is a hard stop that should rarely be approached.
#   4. A worker that exceeds the ceiling reports the number and BLOCKS; it must never edit this file.
#
# History of the raises that led to this policy (kept for the audit trail):
#   883721 -> ROUND AW canvas frame tint (style attribute fill, var() invalid in a presentation attr)
# Reason: ROUND AV export colour parity - the SVG emitter now lifts every node icon out of the
# themed clone as real vector primitives (frameMarkup gained an optional icon block instead of a
# deferred unicode fallback), and the PNG path resolves the frame fill and the icon ink to literal
# colours before rasterising so html-to-image cannot inherit a transparent/currentColor value.
# +2496 bytes over the previous ceiling.
# Reason: AU-1/2/3 export parity - the PNG clone now sanitises editor chrome (selection ring,
# resize handles, connection ports) while keeping the connector, the SVG emitter feeds the
# clone's own edge element so every routed bend survives, and the marker contract matches the
# canvas (14x14, markerUnits=strokeWidth). +810 bytes over the previous ceiling.
# RAISED 2026-10-21, Harvey-approved in session, measured not guessed: 831522 -> 880354.
# Reason: ROUND AR replaced the SVG export's HTML-in-foreignObject clone with a real vector
# serializer (src/exportSvg.ts + the per-row measured font path + the note-node measurer),
# ROUND AS added the Mermaid round-trip contract, the import-history guard, the boards
# PUT/bak contract and the explicit canAutosave gate, and ROUND AT added browser-local
# storage (localStore.ts + the boot probe + the storage-mode UI). Measured at HEAD 338a786:
# 880,354 bytes. Part of this raise pays a pre-existing debt: the ceiling was already
# exceeded BEFORE this work (859,044 at 26baec6) and no gate was enforcing it.
# A further raise must be recorded here the same way, with its own measured number.
runtime_data: [.gob/state.json]
layers:
replay.env: GOBLIN_PRE_COMMIT
replay.cmd: node checks/{name}.mjs
replay.commit: ""
disabled: []
<!-- gob:end -->
# AGENTS.md

This repository uses **gobstack** (installed 2026-10-12). It is a pointer,
not a rule dump — the rules live in one executable place, and facts beat requirements.

- **Harness entry point:** `.gob/bin/goblin-verify` — exit 0 pass, 1 a check failed,
  2 could not run, 3 the manifest is broken. Run it before you commit; the gate is the
  same run.
- **Rules and their checks:** `.gob/manifest/enforcement.tsv` (one row per rule; every row
  carries a runnable check or the literal `advisory`).
- **Forbidden code (the ban list):** `.gob/bin/goblin-bans` runs the bans whose `applies_when`
  glob matches a real file in this tree; each ban's mechanism lives in `.gob/manifest/bans.tsv`.
  To turn one off, name it in `bans_disabled:` in this file's gob block. Run it before
  you write the line, not after — a ban is a gate, and `goblin-verify` only reports it once the
  code exists.
- **Session state:** `HANDOFF.md` at the repo root. Read it before touching anything.
- **Project config:** the `<!-- gob:begin --> … <!-- gob:end -->` block in this file
  (gates, ratchet, runtime data, replay, opt-outs). Edit it in place; the
  installer never rewrites the block after the first install and never touches the prose.
- **The referenced standard**, if configured, is named by `practice:` in the gob block.
  Read it before starting work; this repo carries no copy of it.

One thing this repo does not do: it does not write outside its own tree.
