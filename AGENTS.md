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
ratchet.ceiling: 831522
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
