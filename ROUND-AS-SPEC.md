# ROUND AS — Architecture Spec (Mermaid round-trip, import history, board resurrection)

Status: SPEC (architecture round; no product code changed by this pass)
Baseline tree read: HEAD `c03c16a` (working tree, ROUND AR PASS 2 landing in parallel —
nothing in this spec depends on `src/exportSvg.ts`).
All "measured" claims below were produced by real probes this round: an esbuild bundle of
`src/mermaid.ts` executed in Node (scratch, not committed), and a real `npm run build` +
`vite preview` on port 5299 (started and killed by PID; the dev server on 5200 was never
touched).

Verification of the reviewer's four findings: **all four confirmed at line level.**
Refinements per item below.

---

## AS-1 (was F1) — Export emits invalid Mermaid: the `id: ("label")` colon form

### Diagnosis (confirmed, refined)
`src/mermaid.ts:113` — `lines.push(`${indent}${mid(n.id)}: ${wrap(n)}`)` — emits e.g.
`  m1: ("Service A — handles requests")`. Measured exporter output for a 5-shape fixture:

```
flowchart TD
  m1 -->|reads| m2
  m1: ("Service A — handles requests")
  m2: [("Postgres")]
  m3: {"Valid?"}
```

mermaid@11 rejects `id: (…)` (`Parse error … got 'PS'` — reviewer's live parse; we cannot
re-run the parser DOM-free, see "live pass"). Refinements to the reviewer's claim:

- The colon form is emitted from THREE sites that share `emitNode` (`mermaid.ts:112-115`):
  top-level nodes (line 116), subgraph children (line 121-124), and the orphan re-emit
  sweep (line 132). Fixing `emitNode` alone fixes all three — one line, not three.
- `subgraph m1["Cluster G"]` header lines (mermaid.ts:119) are already colon-free and
  valid; do not touch them.
- Edge lines (`m1 -->|reads| m2`) are already valid.

### Contract
The exporter emits the standard Mermaid node-definition syntax: **`id` immediately
followed by the shape token, no colon** — `m1("Service A — handles requests")`,
`m2[("Postgres")]`, `m3{"Valid?"}`. This is the form mermaid@11 parses (reviewer's live
evidence: the same text minus the colon parses clean) and — measured this round, probe 2 —
the form our own importer already reads losslessly (labels AND shapes round-trip; see AS-2).

Exact round-trip property the harness asserts (all five shapes + labelled edge):

```
for each board node n (non-group):  fromMermaid(toMermaid(board)).nodes
  contains a node whose label === esc(title ⊕ " — " ⊕ sub) un-escaped, and whose shape
  maps back to n.shape through SHAPE_TO_MERMAID's inverse;
every edge survives with its label; the exported string contains ZERO node-definition
lines matching /^\s*m\d+:\s*[{[(]/.
```

### Change
`src/mermaid.ts` `emitNode` (line 113): `${indent}${mid(n.id)} ${wrap(n)}` (drop colon).
No other function changes for AS-1.

### Acceptance criteria (machine-measurable)
1. `toMermaid(fixture)` output: zero lines matching `/^\s*\w+: \(/` or `/^\s*\w+: \[/` or
   `/^\s*\w+: \{/` (comments blanked before the test, per house convention).
2. Every non-edge, non-subgraph, non-`end` body line matches
   `/^\s*m\d+\s*[([{]/` (id + shape token, nothing between).
3. Round-trip property above holds for a fixture covering shapes: service, database,
   decision, actor, external, note, queue, gateway; a title containing a double quote
   (esc → `#quot;` → back); a node with title+sub (the ` — ` join); ≥1 labelled edge;
   ≥1 subgraph with a child (child line must still be claimed by the group — the
   subgraph-children path goes through the same `emitNode`).

### Harness
`checks/round-as-mermaid.mjs` — DOM-free, no parser import. Bundles `src/mermaid.ts`
with the project's own esbuild (`node_modules/.bin/esbuild --bundle --format=esm`) into
the scratch dir and EXECUTES `toMermaid`/`fromMermaid` (both pure; precedent:
`checks/package-r-roadmap.mjs`, `checks/round-aa-align-marquee-palette.mjs`).
**Negative control:** `AS_ROOT` env pointing at a checkout of `26baec6` must be RED
(naming it explicitly: RED-proven on `26baec6`; the AR commits `7ff1a53`…`c03c16a` and
PASS 2 do not touch `src/mermaid.ts`, so any post-26baec6 pre-AS tree is equally RED).
Header must state, as `round-ad-flowchart.mjs` does, that the mermaid@11 parse itself is
NOT proven here.

### Live pass (orchestrator/reviewer only — NOT claimed by the harness)
Paste the exported text into mermaid.live (mermaid@11) and confirm it renders. This is
the only place the real-parser claim may appear.

---

## AS-2 (was F2) — Importer cannot read the exporter's own output; backward compat

### Diagnosis (confirmed, refined — worse than reported)
`src/mermaid.ts:161-258` `fromMermaid`. On a definition line like
`  m1: ("Service A — handles requests")` the node lexer (NODE regex, line 171) finds the
bare id `m1` with NO shape token (the colon+space breaks id↔token adjacency), and
`("Service A…")` alone cannot start a match. The line then falls to the bare-definition
branch (line 251) → `defNode('m1', undefined)` → `labelOf(undefined) || key` = `"m1"`.
Measured: importing our own export yields labels `m1, m2` and — refinement — **shapes are
lost too** (`shapeOf(undefined)` = `'service'` for every node). Re-export compounding
(`m4: ("m1")`) is the reviewer's finding and follows.

### Contract
1. **Lossless self round-trip** (AS-1's property): after the AS-1 exporter change, the
   CURRENT importer already reads the new form losslessly — measured this round
   (probe 2: all 5 fixtures label+shape OK). The importer needs NO change for the new
   form; the harness pins it so it cannot regress.
2. **Backward compatibility with the colon form already pasted into people's notes:**
   `fromMermaid` must ALSO accept `m1: ("Old title")` and recover the label and shape —
   i.e. the definition-line lexer treats an optional `:` (colon + optional space) between
   id and shape token as whitespace. Rationale: every export produced since AQ21 sits in
   Harvey's notes/PRs with the colon; those must import with titles, not as `m1`/`m2`.
   Scope note: this tolerance is READ-side only; the exporter never emits the colon
   again (AS-1 assertion 1).

### Change
`src/mermaid.ts` NODE regex (line 171) or, simpler and safer, the definition-line branch:
normalise a definition line by stripping one `:\s*` between the leading id and a shape
token before lexing (must NOT scrub colons inside labels, e.g. `m1("port: 8080")` —
the strip applies only at the `id : token` junction).

### Acceptance criteria
1. `fromMermaid('flowchart TD\n  m1: ("Service A")\n  m2: [("Postgres")]')` → labels
   `Service A` / `Postgres`, shapes `service` / `database` (RED today: labels `m1`/`m2`,
   shapes `service`/`service`).
2. Self round-trip property of AS-1 (unchanged importer behaviour on the new form).
3. `m1("port: 8080")` still imports with label `port: 8080` (colon-in-label guard).
4. Subgraph child in colon form (`    m2: ("Inner")` inside a subgraph) is claimed by
   the group AND gets its label.

### Harness
Same file `checks/round-as-mermaid.mjs`, sections B (backward compat) and C (guards).
Same RED commit `26baec6`.

---

## AS-3 (was F3) — Import wipes undo history

### Diagnosis (confirmed)
`src/App.tsx:4188-4189` — inside the `gobi:mermaid-import` handler:
`past.current = []; future.current = [];` before appending nodes/edges. The comment at
4180-4181 shows it was deliberate ("same apply path as a JSON import (history reset)") —
but a JSON import REPLACES the board, while this path is ADDITIVE (`setNodes(ns => […ns, …mmNodes])`),
so the reset is wrong. Measured by reviewer: 3× Cmd+Z after an import changed nothing.

### Contract
An import is ONE history entry.
- **Successful import:** `pushHistory()` (App.tsx:1737) BEFORE the append — it snapshots
  the pre-import graph, and it already clears `future` (line 1740). A single undo
  removes exactly the imported nodes and edges (nothing else — the snapshot is the whole
  pre-import graph, and the imported ids are namespaced `mm*` so nothing else moves).
  Redo restores the import. This matches paste/duplicate semantics elsewhere in the app.
- **Failed parse:** `fromMermaid` returns null → `ExportModal.tsx:166` shows the message
  and dispatches NOTHING; the App handler early-returns on `!detail` (App.tsx:4185).
  Zero history entries, board untouched. (Already true; the harness pins it as a source
  assertion on the handler's guard.)
- **Partial parse:** whatever `mermaidToGraph` produced is one entry — undo removes all
  of it at once.
- **Second import on top of the first:** TWO entries; each undo removes exactly one
  import, newest first (stack semantics; MAX_HISTORY cap applies as to any edit).
- Autosave interplay: the append re-runs the autosave effect → debounced PUT. That is
  correct and unaffected; no `skipAutosave` (this is a real edit, unlike `applyBoard`).

### Change
`src/App.tsx` handler (4182-4197): replace the two wipe lines with one `pushHistory()`
before `setNodes`/`setEdges`; update the 4180-4181 comment. `pushHistory` is already in
scope (defined at 1737, before this handler).

### Acceptance criteria (what CAN be proven DOM-free)
The history arrays live in refs inside the App component — NOT importable in Node. So,
exactly like `checks/round-ar-modal-stability.mjs` (source assertions on App.tsx), the
harness asserts the handler's SOURCE SHAPE via its brace span:
1. The `gobi:mermaid-import` handler body contains NO `past.current = []` and NO
   `future.current = []`.
2. It calls `pushHistory()` at a position BEFORE both `setNodes` and `setEdges`.
3. The `if (!parsed) return;` guard is still the first statement (failed-parse no-op).
4. `pushHistory` itself still clears `future` (its own brace span) — the redo contract.
What CANNOT be proven DOM-free: the actual Cmd+Z behaviour. That is the reviewer's live
pass (import → one Cmd+Z → imported nodes gone; a second import → two undos needed).

### Harness
`checks/round-as-import-history.mjs` — text/brace-span assertions on App.tsx (blank
comments first; `AS_ROOT` override; RED on `26baec6`). No bundling needed.

---

## AS-4 (was F4) — Deleted board resurrects via PUT; static-build persistence (measured)

### Diagnosis (confirmed)
`vite.config.ts:275-301` — PUT validates the body but never checks existence:
`writeJsonAtomic(file, out)` (line 300) re-creates the file. DELETE (305-309) unlinks.
Client: debounced autosave (App.tsx:1305, 800 ms) → `flushSave` → `boards.saveBoard`
(`src/boards.ts:58`), which retries ANY throw 2× (App.tsx:1260-1267) then surfaces
"Save failed". Reproduced by reviewer: DELETE 200 → reload → board back with fresh
`updatedAt`; with two tabs, deletion effectively never sticks.

### Static build — measured this round (this was NOT in the reviewer's pass)
`npm run build` + `npm run preview -- --port 5299` (scratch, killed after measuring):

- `GET /api/boards` → **HTTP 200 with index.html** (sirv's SPA fallback). The client's
  `req()` (`boards.ts:38-42`) does `res.json().catch(() => null)` and `res.ok` is true,
  so `listBoards()` RESOLVES `null` → bootstrap's `list.length` throws → outer catch →
  flash "Boards API error" → empty-state canvas. A public user on a static deploy gets a
  broken app with an error toast, no boards, no persistence.
- `PUT /api/boards/nonexistent` → HTTP 404 (no file to fall back to).
- Root cause: `boardsApi()` registers ONLY `configureServer` (vite.config.ts:173) — the
  plugin is dev-only. **Verdict: not acceptable for the stated goal (public release).**

### Contract
1. **PUT on a missing board fails loudly: HTTP 404 `{error:'not found'}`** — 404, not
   412/409, because GET and DELETE on this file already answer 404 for the same
   condition (vite.config.ts:271, 306); one convention. The check goes AFTER body
   validation, BEFORE `writeJsonAtomic`, and the file must not be written.
2. **Client behaviour on 404:** `boards.ts` `req()` attaches `err.status = res.status`;
   `flushSave`'s retry loop (App.tsx:1260-1267) must NOT retry 4xx (a deleted board is
   not transient — today a 404 would burn 1s+3s retries pointlessly). User-visible
   outcome: `saveState 'error'` + a flash that names the case, e.g.
   `Save failed: this board was deleted` (distinct message when `err.status === 404`),
   and a `refreshBoards()` so the list stops offering the corpse. The tab does NOT
   auto-navigate; the user keeps their pixels (they can export JSON) — the board is
   gone server-side and stays gone.
3. **Two-tab case (the definition):** tab A deletes → DELETE 200, file unlinked. Tab B's
   in-flight/debounced PUT → 404, no file written, no resurrection — enforced by the
   SERVER-side existence check, which is the only thing both tabs must agree on. Tab B
   then shows the error path from (2). Tab A's delete is final.
4. **Preview parity (release blocker, small):** `boardsApi()` also registers
   `configurePreviewServer(server)` wiring the SAME middleware, so `vite preview`
   serves `/api/*`. Measured: today it does not. This makes a self-hosted public
   release (`npm run build && npm run preview`) actually work. TRUE static hosting
   (file://, or a dumb CDN with no server process) remains unsupported — that is a
   documented limitation (README one-liner + release checklist), NOT a code path; a
   localStorage backend is explicitly out of scope for this round.

### Change
`vite.config.ts` PUT branch (275-301): early `if (!readBoard(id)) return send(404, {error: 'not found'});`
(the `prev` read at line 285 already exists — reuse it). `src/boards.ts` `req()`: set
`err.status`. `src/App.tsx` `flushSave`: skip retries when `err?.status >= 400 && < 500`;
on final 404 flash the deleted-board message and call `refreshBoards()`.
`vite.config.ts` `boardsApi()`: factor the middleware registration into a helper used by
both `configureServer` and `configurePreviewServer`.

### Acceptance criteria (machine-measurable)
1. **Behavioural, DOM-free:** the PUT branch of vite.config.ts is importable — the config
   is a TS module importing only `node`/`path`/`crypto`/`vite`; the harness bundles
   `vite.config.ts` with esbuild, imports it, instantiates the plugin, and drives its
   middleware against a fake `ServerResponse`-shaped stub in a scratch `BOARDS_DIR`:
   PUT on a missing id → 404 body `{error:'not found'}`, and the file DOES NOT EXIST on
   disk afterwards; PUT on an existing id → 200, file written (regression guard);
   DELETE → 404 when missing. (If driving the middleware shape proves brittle, fall back
   to brace-span source assertions on the PUT branch — state which one shipped.)
2. **Preview parity:** the `boardsApi()` plugin object has a `configurePreviewServer`
   function that references the same registration helper as `configureServer`
   (source/AST assertion, RED on `c03c16a`).
3. **Client source assertions** (App.tsx brace spans): the retry guard mentions
   `status`; the 404 branch flashes a message containing `deleted` and calls
   `refreshBoards`.
4. **Live pass (reviewer):** two real tabs; delete in A; tab B edits → PUT 404 → error
   toast; reload both → board gone. Plus `npm run build && npm run preview` on a spare
   port: `curl /api/boards` returns JSON, not index.html.

### Harness
`checks/round-as-boards-put.mjs` (items 1-3). Negative control: RED on `c03c16a` via
`AS_ROOT` (the plugin import works on the old tree too — the 404 assertion fails there).

### Re-anchoring an existing green harness (required, named)
`checks/package-q-reconnect-endpoints.mjs:585-590` pins `vite.config.ts` mtime < its own
mtime ("never touched by that round"). AS-4 legitimately edits vite.config.ts, so that
check would go RED falsely. Re-anchor: in the SAME commit as the AS-4 edit, touch that
harness with a dated comment line above the loop (e.g. `/* ROUND AS re-anchor: vite.config.ts legitimately edited by AS-4 on 2026-10-19 */`) so its mtime moves past the
config's. No assertion semantics change.

---

## Out of scope (this round)
- F5/F6 (React 19 console errors), F7/F9 (British spelling, "1 nodes"), F8 (React Flow
  attribution — Harvey decided: KEEP and theme). All routed elsewhere.
- The Mermaid SEQUENCE path (`toMermaidSequence`, mermaid.ts:39-70): hidden behind
  `SEQUENCE_ENABLED=false`; emits `participant S1 as X` which is valid; untouched.
- `src/exportSvg.ts` — ROUND AR PASS 2 owns it while this spec is written.
- Any browser/CDP dependency (none exists; adding one is banned by house convention —
  `checks/round-ad-flowchart.mjs` header).
- localStorage/no-backend persistence mode; board schema changes; the `boards/` dir
  (Harvey's live boards; the AS-4 harness uses a scratch BOARDS_DIR, never the real one).
- The empty-group `m1_empty[ ]` placeholder quirk (mermaid.ts:127) — pre-existing,
  harmless to the round-trip property; noted here so nobody "fixes" it silently.

## Regressions to watch
- **Shared export modal:** ROUND AR reworked `ExportModal.tsx` (busy split, Seg hoist,
  modal-stability harness `checks/round-ar-modal-stability.mjs` asserts on its source).
  AS-1/AS-2 change `src/mermaid.ts` only; AS-3 changes one App.tsx handler — re-run
  `round-ar-modal-stability.mjs` after AS-3 (its App.tsx brace spans must still resolve).
- **`toMermaid` callers:** only `ExportModal.tsx:150` (and the preview effect). The
  string shape change flows to both — the preview textarea will show the new syntax;
  that is intended and visible.
- **Importer tolerance:** widening the lexer (AS-2) must not start eating `:` inside
  labels or Mermaid `classDef`-style lines — guard assertion 3 in AS-2 covers the label
  colon; `%%` comment skipping (mermaid.ts:205) is untouched.
- **Ratchet:** client JS size — mermaid.ts edits are byte-neutral-ish (one char removed
  per def line; small additions in boards/App). `ratchet.ceiling: 831522` has headroom
  (gate runs at commit time; if the ceiling binds, that is a finding to report, not to
  raise silently).
- **Dev server:** the coder must NOT restart/replace the 5200 dev server; AS-4 harness
  drives the plugin object in-process, never a server.

## Item summary
| Item | Finding | Files | Harness |
|------|---------|-------|---------|
| AS-1 | F1 invalid export | src/mermaid.ts (emitNode) | checks/round-as-mermaid.mjs §A |
| AS-2 | F2 import round-trip + colon back-compat | src/mermaid.ts (lexer) | checks/round-as-mermaid.mjs §B/C |
| AS-3 | F3 history wipe | src/App.tsx (import handler) | checks/round-as-import-history.mjs |
| AS-4 | F4 resurrect + preview parity + client 404 | vite.config.ts, src/boards.ts, src/App.tsx | checks/round-as-boards-put.mjs + re-anchor package-q |

RED control for all: `AS_ROOT` → `26baec6` (AS-4's preview-parity assertion RED on any
pre-AS tree; `c03c16a` equally so).

---

## AMENDMENT 1 — orchestrator, appended 2026-10-20 after a MEASURED data-loss incident

The round gained two items the original spec could not know about, because the incident happened while the AR
round was being verified.

**What happened (measured, not inferred).** Harvey's board `boards/mvaf8pkt162b2aed.json` held 4 nodes / 2 edges
at 22:56 on 2026-10-19. At **00:06:10** the same file was rewritten to **140 bytes — 0 nodes, 0 edges**. There is
no `.bak` for board files (only the library document keeps one), `boards/` is gitignored, and neither the browser
cache nor any temp file held a copy, so the content is unrecoverable.

**The cause is UNDETERMINED and this spec will not pretend otherwise.** Read after the incident: the autosave
effect is guarded (`src/App.tsx:1308` `if (!boardId) return;`), `flushSave` returns when no board doc is loaded
(`:1234`), and `applyBoard` arms `skipAutosave` so the first post-load effect run is skipped — so the "empty write
before load completes" race the orchestrator first suspected is NOT supported by the code. Two unproven candidates
remain: (a) an edit that legitimately emptied the canvas in some tab (an empty board is a legal state and saves
exactly this payload), and (b) a path where `curBoard` is set while `nodes`/`edges` are still empty (switch/flush
ordering). Neither can be confirmed from the artefacts that survive, and the reporter will not invent a
mechanism. Everything below is therefore defence-in-depth plus recoverability, not a fix for a proven bug — and
the harnesses must be written to test the GUARDS, not to assert the incident's cause.

**AS-5 — make the save gate EXPLICIT and testable (the guard partly exists; prove and harden it).**
The current guard is implicit: `boardId` (from `curBoard`) plus `skipAutosave`, and `flushSave` bails when no board
doc is loaded. Replace it with a named, testable predicate so the invariant is stated once: a save runs only when
(a) a board document has been LOADED (an explicit flag set by the loader, cleared on board switch) and (b) the
in-memory doc's `id` equals the id being written. Enumerate and cover: first boot with no last-board, switching
boards (including a flush landing while the next doc is still loading), the debounce firing during load, and a
failed load (404/timeout). This is hardening, not a fix for a proven race — say so in the commit message.
- Harness: DOM-free — drive the predicate through those cases; assert the not-loaded case is FALSE and the
  loaded-ids-match case is TRUE.
- Negative control: RED on the pre-fix commit named in the harness header.

**AS-6 — board writes keep ONE `.bak` generation, exactly like the library.**
`vite.config.ts` already renames `library.json` to `library.json.bak` before writing (`:221-224`) and writes
atomically through a temp file + `rename` (`:74-80`). Boards get neither. Give boards the same treatment: one
previous generation per board, written before the new document lands, plus (in the same item) a documented
recovery sentence in the README/DEV-NOTES naming where the backup lives. The incident above is the reason: a
140-byte overwrite of a 4-node board destroyed the only copy.
- Harness: drive the plugin's write path in-process (it is importable, per AS-4's own approach) and assert that a
  second save leaves a `.bak` holding the FIRST document's bytes; assert a save on a board id that does not exist
  still follows AS-4's 404 contract (no file, no `.bak`).
- Note the interaction with ROUND AT: in IndexedDB mode there is no `.bak` on disk — the AT spec must state what
  its equivalent is (and if the answer is "nothing", say so plainly rather than implying safety).

**Ordering consequence.** AS-5 and AS-6 are not optional polish: they are the only two guards between this app and
a second silent overwrite. Both must land in the same AS coder pass as AS-1..AS-4, and both are server-mode items
(AT inherits the same load-gate requirement in its own storage adapter).
