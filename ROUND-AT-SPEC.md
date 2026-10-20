# ROUND AT — Architecture Spec: browser-local persistence (IndexedDB) so a static deploy works

Round: AT. Pre-fix commit: `8fde9dc` (branch main; two untracked spec files, no product code
dirty). Author: architect. Status: SPEC ONLY — this pass changed no product code.
Harvey's decision (2026-10-19): default persistence is "local in their browser"; a real file
on disk (`.gobd` / File System Access) is a LATER round. This round ships browser-local only.

Measured basis (this round, real probes):
- Dev server on :5200 answers `GET /api/boards` → `200 application/json` (verified by curl
  this round; the server was already up — it was NOT restarted).
- The boards API exists ONLY as a dev/preview plugin: `vite.config.ts:172` `boardsApi()`
  registers only `configureServer` (AS-4 adds `configurePreviewServer`). On a truly static
  host (GitHub Pages, dumb CDN, `file://`) there is no server process at all: the SPA
  fallback answers `200 text/html` with index.html, the client's `req()`
  (`src/boards.ts:38-42`) resolves `null`, bootstrap's `list.length` throws, and the user
  gets "Boards API error" + an empty canvas (measured by the orchestrator; consistent with
  `src/App.tsx:1319-1350` read this round).
- Historical constraint respected: the project REJECTED localStorage for the library
  (5 MiB quota, UTF-16, non-atomic; one real `.excalidrawlib` = 3.98 MiB). IndexedDB does
  not repeat that mistake (async, quota-shared-but-large, structured clone, transactional).

Interaction with ROUND AS (specced, not implemented): AS-4 makes `vite preview` serve
`/api/*` and fixes PUT-404 resurrection SERVER-side. AT does not re-spec any of that.
AT adds a client-side fallback for the case AS-4 explicitly does NOT cover: hosts with no
server process at all. Where AS-4's contracts matter to AT they are referenced by item,
not restated. AT assumes AS lands first or in the same round; if AT lands first, nothing
here depends on AS code — only the wording of the "server mode" error paths does.

Items: AT-1 mode selection, AT-2 storage adapter, AT-3 IndexedDB schema, AT-4 data safety,
AT-5 parity, AT-6 what stays server-side, AT-7 out of scope. Harness plan at the end.

---

## AT-1 — Mode selection: the boot probe

**Contract.** Exactly once per page load, before the first `listBoards()` call, the client
runs a probe against the server backend and picks a mode:

```
probeServerMode():
  GET /api/boards  with AbortController, timeout 2500 ms
  SERVER mode  iff:  response arrived AND res.ok AND content-type matches /json/i
                     AND the parsed body is an Array
  LOCAL mode   otherwise (any other outcome)
```

Decision table — each row must be pinned by the harness (see Testing):

| Fetch outcome | Mode | Why |
|---|---|---|
| 200, `application/json`, body is an array | server | the real API |
| 200, `text/html` (SPA fallback) | local | static host; this is the release blocker |
| 404 / 5xx / any non-2xx | local | no API there; do not retry into a dead end |
| 200 JSON but body is NOT an array | local | something else answered; treat as "no API" |
| Rejects (network error, `file://` origin) | local | offline / dumb CDN / opened from disk |
| Aborts at 2500 ms | local | hung connection must not hang the boot |

Reasoning a non-designer can follow: `content-type` alone is spoofable by proxies and
absent on some static hosts' 404 HTML; `res.ok` alone is fooled by the SPA fallback
(measured: it answers 200). The array check is the cheapest proof that the ANSWER came
from our API, not from a fallback page — `listBoards()` returns `BoardMeta[]` and nothing
else on this origin ever will. The 2500 ms timeout is ~3× a LAN round-trip and well under
the 800 ms autosave's human timescale; a hung probe must never produce a white screen.

- The decision is memoised for the session (a module-level promise). No mid-session
  flipping: a board saved during the session goes to the mode chosen at boot.
- The probe failure paths all converge on LOCAL mode; the user never sees a broken board
  list. The only remaining failure is IndexedDB itself being unavailable (rare: storage
  disabled) — see the volatile fallback at the end of AT-2.
- **Mode is visible, not guessed.** The board-list header shows one small line: server
  mode → "Saved to server files"; local mode → "Saved in this browser". No dead buttons,
  no modal, no setting to change mode (the mode follows the host; a manual override is
  out of scope).

## AT-2 — The storage adapter (the seam a file backend plugs into later)

**Interface.** One TypeScript interface, `BoardStore`, plus one for the library; the
existing call sites keep calling the SAME names with the SAME signatures they use today
(`src/App.tsx` calls `boards.listBoards/getBoard/createBoard/saveBoard/deleteBoard` at
lines 1226–1643; `src/library.ts` exposes `getLibrary/saveLibrary`). Nothing in App.tsx
forks on mode.

```ts
interface BoardStore {
  listBoards(): Promise<BoardMeta[]>;
  getBoard(id: string): Promise<BoardDoc>;
  createBoard(name: string, preset?: string): Promise<BoardDoc>;
  saveBoard(doc: SaveBoardDoc): Promise<BoardDoc>;   // same param shape as boards.ts:55
  deleteBoard(id: string): Promise<{ok: boolean}>;
}
interface LibraryStore {
  getLibrary(): Promise<LibraryDoc>;
  saveLibrary(doc: LibraryDoc): Promise<LibraryDoc>;
}
```

File layout (new file `src/localStore.ts`; `src/boards.ts` and `src/library.ts` keep
their public exports and become thin delegators):

- `src/serverBoards.ts` + the library half: today's `req()`-based calls, moved verbatim.
- `src/localStore.ts`: the IndexedDB backend (AT-3).
- `src/boards.ts`: `probeServerMode()` (AT-1), picks the backend once, re-exports the
  same function names plus the pure helpers it owns today (`nextUntitledName`,
  `resolveBoardName`, `templateDoc`, `defaultTemplate`, `cacheLastBoard`,
  `lastBoardId`, types). This keeps `checks/package-templates.mjs` §1106–1117 (which
  bundles `src/boards.ts` for `nextUntitledName`) and `checks/round-ae-favourite-id.mjs`
  (which bundles `src/library.ts`) green without semantic edits.

**Shared (one owner, both modes):** the `BoardMeta`/`BoardDoc` types, doc validation
(the client-side twin of the plugin's `validateDoc`: nodes and edges must be arrays;
name defaults to `'Untitled'`), id format (AT-5), list ordering (`updatedAt` desc),
and the last-opened pointer.

**Differs per backend:** transport only — where bytes land (HTTP vs IndexedDB), who
stamps `updatedAt` (server clock vs `Date.now()` in the adapter), and who owns the
library envelope (server constructs it on PUT; the local adapter constructs it with the
same `LIBRARY_TYPE/VERSION/SOURCE` constants from `src/library.ts`).

**Error-shape parity (this is where AS-4 meets AT):** the local adapter rejects with
`Error` objects carrying `err.status`, exactly like `boards.ts` `req()` will after AS-4.
Concretely: `saveBoard` on a deleted id → reject with `status: 404, message: 'not found'`;
`getBoard` on a missing id → same. Then App.tsx's `flushSave` retry/flash logic (AS-4's
client half: no retry on 4xx, "Save failed: this board was deleted" flash +
`refreshBoards()`) serves BOTH modes unchanged. One error path, not two.

**Volatile last resort:** if `indexedDB.open(...)` itself rejects or throws (storage
disabled / unsupported), local mode degrades to an in-memory `Map` implementation of the
same interface plus a one-time flash: "Browser storage is unavailable — boards will not
survive a reload. Export JSON to keep your work." The board list still renders; the app
is never a blank error page. This branch is source-asserted, not behaviour-proven (the
harness cannot remove IndexedDB from Node).

**THE SEAM (named for the future round):** `BoardStore`/`LibraryStore` is where a
file-on-disk backend (`.gobd`, File System Access API) plugs in later — a third
implementation selected by the same probe, with zero App.tsx changes. That round is
explicitly out of scope now (AT-7); the interface is designed so it does not need
revisiting.

## AT-3 — IndexedDB schema

- Database `diagram-studio`, version **1**.
- Store `boards`, keyPath `'id'`, value = the full `BoardDoc`. One index: `updatedAt`
  (non-unique). The list view reads `getAll()` and sorts `updatedAt` desc in the adapter
  (a dozen boards; the index exists so a future cursor can page without a schema bump).
- Store `library`, out-of-line key `'library'` (a singleton). Value = the `LibraryDoc`
  envelope exactly as the server would store it (`type/version/source/updatedAt/
  favourites/shapes`, constants imported from `src/library.ts` — never duplicated).
- **Last-opened board pointer: stays where it is today** — localStorage key
  `diagram-studio:last-board` (`src/boards.ts:36`), untouched, for BOTH modes. Rationale:
  it is a pointer, not data; keeping one home means switching hosts/modes needs no
  migration, and the bootstrap already falls back gracefully when the pointed-at board
  does not exist in the active backend (`App.tsx:1340-1342`: fall back to newest, catch,
  re-seed). "Clear site data" clears it together with the boards — consistent, not
  dangling.
- No other stores. No `meta`/`kv` store (YAGNI — the probe cache lives in memory).
- **Upgrade policy:** version bumps are ADDITIVE by rule — new stores/indexes created in
  `onupgradeneeded`; existing stores are never renamed or dropped without migration code
  in the same upgrade. The harness pins version `1` and the two store names as source
  assertions. A v2 example is deliberately NOT designed here.

## AT-4 — Data safety (honest and cheap: no cloud, no accounts)

IndexedDB is wiped by "clear site data" and can be evicted under storage pressure. The
UI must never let a user be silently one cache-clear away from losing work:

1. **`navigator.storage.persist()`** — called ONCE, on the first successful
   `saveBoard`/`saveLibrary` write in local mode (not at boot: asking during an
   onboarding flash is noise, and an empty database has nothing to protect). Result
   handling: granted → nothing user-visible (recorded in the storage readout); denied or
   unsupported → nothing at write time either — it surfaces only in the readout (next
   item). Never re-ask automatically; the browser re-evaluates persist() eligibility on
   its own.
2. **Storage readout** — the "Saved in this browser" line from AT-1 becomes a small
   popover/Settings entry showing `navigator.storage.estimate()` as "X MB used of ~Y MB"
   and one of: "Storage is persistent" / "Best-effort storage — the browser may clear it
   under disk pressure. Export JSON to keep a durable copy." The JSON export button
   already exists in the app and is linked from that sentence's context. This is the
   whole honesty budget: one readout, one sentence, no scare modals.
3. **QuotaExceededError path** — `saveBoard`/`saveLibrary` rejections whose
   `err.name === 'QuotaExceededError'` (browsers may also surface it as the abort of the
   transaction) map to: `saveState 'error'` + flash "Browser storage is full — export
   this board as JSON, then delete old boards to free space." No silent data loss, no
   retry storm (quota is not transient; flushSave's AS-4 no-retry-on-4xx logic does not
   cover this, so the adapter tags the error and the flash names it).
4. What is NOT built: export reminders on a timer, backup scheduling, any network sync.

## AT-5 — Parity (what "works the same" means, item by item)

- **Autosave:** the 800 ms debounce and `flushSave` are untouched — they call
  `boards.saveBoard`, which now delegates. The saved/idle/error indicator behaves
  identically in both modes.
- **Board list:** same `BoardMeta` shape, ordered `updatedAt` desc; `nodeCount`/
  `edgeCount` computed from the stored doc; `preset` badge identical (old boards without
  `preset` show the same default as server mode).
- **Rename / delete:** rename = `saveBoard` with the new name (adapter keeps
   `updatedAt` fresh); delete removes the record and the next `listBoards` no longer
   offers it. Delete-then-save is AT-2's 404-parity path.
- **Legacy keys:** `theme` is read but NEVER written (PACKAGE-M rule — the server drops
  it on re-save; the local adapter does the same: it writes only
  `id/name/nodes/edges/updatedAt/preset?/legend?`). `legend` rides through unchanged.
  Both rules live in the SHARED validation/normalisation step so they cannot drift.
- **ids keep the same format:** local `createBoard` generates
  `${Date.now().toString(36)}${hex4}` using Web Crypto `crypto.getRandomValues` — same
  shape and charset as the server's `crypto.randomBytes(4)` id
  (`vite.config.ts` POST branch), matching `/^[a-z0-9]+$/`.
- **Round-trip property (the one to assert):** *a `BoardDoc` accepted by one backend is
  accepted unchanged by the other.* Concretely: the JSON blob exported from a board in
  local mode imports into a server-mode instance (and back) with identical
  nodes/edges/name/preset/legend — because validation and normalisation are shared and
  the key set written is identical. The DOM-free harness proves this at the function
  level (shared validator vs the plugin's `validateDoc`); the live pass proves the UI
  import (see Testing).

## AT-6 — What stays server-side (unchanged)

In dev (and `vite preview` after AS-4) the file backend still wins — the probe returns
JSON, so mode = server, and every byte of `vite.config.ts` behaviour is untouched:
Harvey tests against real files in `boards/`, the 41 harnesses read that same code, and
AS-4's contracts (PUT-404 no-resurrection, preview parity, client no-retry-on-4xx) apply
exactly as specced there. AT adds no server code, no `vite.config.ts` edit, and no route.
The only AT-visible change in server mode is the "Saved to server files" readout line.

## AT-7 — Out of scope, named

- File-on-disk persistence: File System Access picker, `.gobd` format, download-folder
  watching — Harvey: later ("File trên disk tính sau"). The seam is AT-2's interface.
- Share links, sync, collaboration, accounts, any network egress.
- Migrating existing `boards/*.json` INTO a hosted/local instance. Instead: the user
  imports a JSON by hand through the existing import path (per-board, explicit). No
  bulk importer this round.
- localStorage for boards or library (rejected on the record: quota/UTF-16/atomicity).
- A manual mode switcher UI; schema v2; Service-Worker offline shell.

---

## Testing — what is provable DOM-free, and what is not

House rule (from `checks/round-ad-flowchart.mjs`'s header): harnesses are DOM-free Node
scripts — no browser, no DOM, no CDP. That binds AT harder than any round before it:
the entire LOCAL backend's I/O is a browser API. The spec therefore splits proof in two
and labels the split honestly.

**Provable DOM-free** (new harness `checks/round-at-local-store.mjs`, bundling the new
modules with the project's esbuild, precedent `checks/round-as-mermaid.mjs`):

1. **Probe decision table** — `probeServerMode` with an injected `fetch` stub: all six
   rows of AT-1's table (200+JSON+array → server; 200 HTML → local; 404 → local;
   non-array JSON → local; rejected promise → local; never-resolving fetch + fake timer
   → local after 2500 ms).
2. **Shared validation/normalisation** — fixture boards (with/without `preset`,
   `legend`, legacy `theme`) in and out: key set written is exactly
   `id/name/nodes/edges/updatedAt/preset?/legend?`; `theme` dropped; name default.
3. **Mutual acceptance (AT-5's round-trip, function level)** — bundle the plugin's
   `validateDoc` from `vite.config.ts` (AS-4 precedent: it is importable) and the shared
   local validator; every doc that passes one passes the other, on a fixture matrix
   including edge cases (empty nodes, unicode names, `legend:true`).
4. **id format** — local ids match `/^[a-z0-9]+$/` and the server id shape; 10k draws
   collide-free.
5. **Quota error mapping** — a fake rejection `{name:'QuotaExceededError'}` maps to the
   AT-4 message; a plain `Error` does not.
6. **Library envelope** — `saveLibrary` constructs the envelope with the constants from
   `src/library.ts` and stamps `updatedAt`.
7. **Ordering** — `listBoards` output sorted `updatedAt` desc (in-memory sort over a
   stubbed store: the adapter's sort is pure; the IndexedDB read is stubbed).
8. **Schema source assertions** — DB name/version/store names/index as pinned in AT-3;
   the volatile-fallback branch exists and constructs the in-memory store; error objects
   carry `.status` (404 parity with AS-4).

**NOT provable DOM-free (stated in the harness header, like round-ad does):** the real
IndexedDB transactions, `navigator.storage.persist()/estimate()` behaviour, actual
eviction, and the live UI. The harness stubs those APIs and proves the logic around
them; the claims above are the boundary.

**Negative control / REPLAY:** every new assertion RED on pre-AT tree via the usual
`AT_ROOT` env override pointing at `8fde9dc` (current HEAD) — trivially RED there
because `src/localStore.ts` does not exist ("no local mode exists at all" is the
defect). The harness must fail loudly (not crash silently) when the module is missing,
so the RED run is legible.

**Existing harnesses — re-anchoring, named:**
- `checks/package-templates.mjs` r3g (~line 1333): the PREDICATE (`src/boards.ts` and
  App.tsx contain no `node:fs`/`readFileSync`/`writeFileSync`) stays true — IndexedDB is
  not fs — but its message prose says boards are reached "through the `/api/boards` HTTP
  route only", which AT makes conditionally false. Re-anchor in the SAME commit as the
  AT edit: dated comment above the assertion, message updated to "through the storage
  adapter (server API or browser-local), never a filesystem handle". No semantics change.
- `checks/package-templates.mjs` §1106–1117 (bundles `src/boards.ts`, executes
  `nextUntitledName`) and `checks/round-ae-favourite-id.mjs` (bundles `src/library.ts`):
  stay green by construction (AT-2 keeps those exports pure and in place). If the coder
  moves the pure helpers instead, that file's import path is the one line to re-anchor —
  prefer not moving them.
- `checks/package-q-reconnect-endpoints.mjs:585-590` pins `vite.config.ts` mtime: AT
  does not touch vite.config.ts, so no re-anchor (unlike AS-4, which owns that one).
- All 41 existing harnesses re-run green after AT; none is weakened.

**Live pass (orchestrator/reviewer, browser — NOT claimed by any harness):**
1. Static or no-server host (e.g. `npx serve dist` WITHOUT the preview plugin, or a
   build opened via a dumb static server): boot → no "Boards API error"; board list
   renders; "Saved in this browser" visible.
2. Create a board, draw, reload → board survives. Delete it, reload → stays deleted.
3. Two boards, edit the older one → it moves to the top of the list (updatedAt order).
4. Export JSON from local mode → import into dev (server mode) → content identical;
   export from server mode → import into local mode → identical (AT-5 property, UI level).
5. Dev on :5200 (server mode): everything as today; PUT-on-deleted shows AS-4's
   deleted-board flash; "Saved to server files" visible.
6. Storage readout shows estimate; the persist() prompt fires on first save in local
   mode only.

Gates that must survive: `npx tsc --noEmit` = 0, `vite build` = 0, todo ceiling, the 41
harnesses, and the JS-size ratchet — `localStore.ts` is small (no dependency, raw
IndexedDB, no idb wrapper) and if the ratchet ceiling binds that is a finding to report,
not to raise silently.

## Item summary

| Item | Delivers | Files | Proof |
|------|----------|-------|-------|
| AT-1 | boot probe + decision table | src/boards.ts (probe) | harness §1 (RED on 8fde9dc) |
| AT-2 | BoardStore/LibraryStore seam + error parity + volatile fallback | src/boards.ts, src/library.ts, src/serverBoards.ts, src/localStore.ts | harness §2,8; App.tsx untouched call sites |
| AT-3 | IndexedDB schema v1 | src/localStore.ts | harness §7-8 + live pass 2-3 |
| AT-4 | persist/estimate/quota honesty | src/localStore.ts, one readout | harness §5; live pass 6 |
| AT-5 | parity + round-trip property | shared validator | harness §3-4; live pass 4 |
| AT-6 | server mode untouched | none | existing 41 green |
| AT-7 | out of scope named | — | — |
