/* feature-map home: src/board/localStore.ts */
/**
 * ROUND AT — AT-2/AT-3/AT-4: the browser-LOCAL storage backend (IndexedDB).
 *
 * WHY THIS EXISTS. On a static host there is no server process at all: the
 * SPA fallback answers `GET /api/boards` with 200 text/html, and until this
 * module a hosted build could not save anything. AT's decision (Harvey,
 * 2026-10-19): the user's data lives in THEIR browser by default. This module
 * is the `BoardStore`/`LibraryStore` implementation for that mode; the seam is
 * the interface `src/boards.ts` re-exports — a future file-on-disk backend
 * (`.gobd`, File System Access) is a THIRD implementation picked by the same
 * probe, with zero App.tsx changes (explicitly out of scope, AT-7).
 *
 * WHAT IS SHARED vs PER-BACKEND (AT-2): transport only differs. Validation,
 * normalisation (`normalizeBoardDoc` — the key set written is exactly
 * id/name/nodes/edges/updatedAt/preset?/legend?/style?/density?; legacy `theme`
 * is dropped),
 * id format (`newLocalId`, same shape as the server's randomBytes(4) id),
 * ordering (`sortByUpdatedDesc`), the library envelope (built with the
 * constants IMPORTED from src/library.ts — never duplicated) and the
 * error-shape (`err.status`, AS-4 parity so flushSave's one error path serves
 * both modes) all live here and are the shared law both backends obey.
 *
 * DOM-FREE TEST BOUNDARY (stated honestly, per the spec's Testing section):
 * checks/round-at-local-store.mjs proves the pure helpers, the probe table,
 * mutual acceptance with the server's validateDoc and the error/quota mapping
 * in Node. The REAL IndexedDB transactions, navigator.storage.persist()/
 * estimate() and the live UI are the labelled LIVE pass — this module is
 * written so those calls sit at the boundary the harness stubs around.
 *
 * SCHEMA (AT-3): database `diagram-studio`, version 1. Store `boards`
 * (keyPath 'id', value = the full BoardDoc, one non-unique `updatedAt` index
 * — the list reads getAll() and sorts in the adapter; the index exists so a
 * future cursor can page without a schema bump). Store `library` (out-of-line
 * key 'library', a singleton holding the LibraryDoc envelope exactly as the
 * server would store it).
 * HISTORY-V4 (t_1b538662): version 2 ADDS store `versions` — one record per
 * sampled checkpoint, keyed by the SAME `<boardId>.<stamp13>.json` grammar
 * the server's generation files carry, so the ONE policy home
 * (src/board/historyPolicy.ts) serves both backends verbatim (HISTORY_RE /
 * shouldCheckpoint / planHistory / the ring/daily/pin numbers). A v1
 * database upgrades on first open with zero migration code (nothing existing
 * is renamed or dropped) — the harness proves the pre-existing boards
 * survive byte-identical. UPGRADE POLICY: version bumps are ADDITIVE — new
 * stores/indexes in onupgradeneeded; existing stores are never renamed or
 * dropped without migration code in the same upgrade.
 */
import {type Node, type Edge} from '@xyflow/react';
import {type PresetId} from '../presets';
import {type TableStyle, type Density} from '../../packages/gobi/src/model/tableStyle';
import {LIBRARY_TYPE, LIBRARY_VERSION, LIBRARY_SOURCE, type LibraryDoc} from './library';
/* HISTORY-V4 — the sampling predicate + the retention plan + the pin cap come
 * from the ONE policy home, exactly as vite.config.ts imports it server-side
 * (never scripts/boardRetention.mjs — that pulls node:fs). */
import {HISTORY_PIN_KEEP, planHistory, shouldCheckpoint} from './historyPolicy';

/** The shape of a document this store accepts — the same param shape
 *  `boards.ts saveBoard` has always taken (theme tolerated, never stored). */
export type SaveBoardDoc = {
  id: string; name: string; nodes: Node[]; edges: Edge[];
  preset?: PresetId;
  /** BOARD-STYLE (2026-11-09) — the board's own table paint + spacing. Absent
   *  stays absent: a board authored before the round carries no key. */
  style?: TableStyle; density?: Density;
  /** @deprecated (PACKAGE-M fix) — ignored; boards no longer store a theme. */
  theme?: string;
  legend?: boolean;
  /** HISTORY-V4 — the save-intent flag the SERVER's checkpoint hook reads
   *  from the raw PUT body ('pre-restore' bypasses the 120 s sampling gap so
   *  the replaced state lands as the auto-shadow). Never persisted, never
   *  read back — the local adapter's checkpoint branch reads it the same
   *  way, with the V4 brief's one refinement: byte-diff is honored even
   *  while the gap is waived (restoring the state already live archives
   *  nothing). */
  historyReason?: string;
};

/** The document as stored/read back (BoardDoc minus the legacy theme key). */
export type StoredBoardDoc = {
  id: string; name: string; nodes: Node[]; edges: Edge[]; updatedAt: number;
  preset?: PresetId; legend?: boolean; style?: TableStyle; density?: Density;
};

/** AT-4 #3 — the flash copy for the quota path. Exported so the UI and the
 *  harness assert the SAME sentence (one owner, no drift). */
export const QUOTA_MESSAGE =
  'Browser storage is full — export this board as JSON, then delete old boards to free space.';

/** AT-4 #2/#3 — the volatile-degradation + persistence one-liners live in
 *  App.tsx (they are UI copy); the quota message lives here because the
 *  ADAPTER is what tags the error. */
export const isQuotaError = (err: unknown): boolean =>
  !!err && typeof err === 'object' &&
  ((err as Error).name === 'QuotaExceededError' ||
    /* Some browsers surface quota as a DOMException named elsewhere but with
       this code; matching the code keeps the mapping honest across engines. */
    (err as DOMException).code === 22);

/* ===========================================================================
   SHARED NORMALISATION — the one law both backends obey (AT-5).
   =========================================================================== */

/** Validate + normalise a board doc for STORAGE. Returns the exact key set a
 *  local write produces (and the server's PUT produces): id, name (default
 *  'Untitled'), nodes, edges, updatedAt (restamped by the caller's clock),
 *  plus preset?/legend? only when present. `theme` is READ (old files still
 *  parse) and NEVER written (PACKAGE-M — the server drops it on re-save; so
 *  does this adapter). Throws nothing: callers validate first via
 *  `isValidBoardDoc` and this function is total over that input. */
export function normalizeBoardDoc(
  doc: SaveBoardDoc,
  updatedAt: number,
): StoredBoardDoc {
  const out: StoredBoardDoc = {
    id: doc.id,
    name: typeof doc.name === 'string' && doc.name ? doc.name : 'Untitled',
    nodes: doc.nodes,
    edges: doc.edges,
    updatedAt,
  };
  if (typeof doc.preset === 'string') out.preset = doc.preset as PresetId;
  if (typeof doc.legend === 'boolean') out.legend = doc.legend;
  /* BOARD-STYLE — an absent value stays absent (the reader falls back to the
     Settings default); an unknown token is stored and resolved on read. */
  if (typeof doc.style === 'string') out.style = doc.style;
  if (typeof doc.density === 'string') out.density = doc.density;
  return out;
}

/** The client twin of the plugin's validateDoc (vite.config.ts). Same verdicts
 *  — AT-5's mutual-acceptance property is that every doc passing one passes
 *  the other; checks/round-at-local-store.mjs §3 drives BOTH against a fixture
 *  matrix to prove it stays true. */
export function isValidBoardDoc(doc: unknown): boolean {
  if (!doc || typeof doc !== 'object') return false;
  const d = doc as Record<string, unknown>;
  if (d.name !== undefined && typeof d.name !== 'string') return false;
  if (!Array.isArray(d.nodes)) return false;
  if (!Array.isArray(d.edges)) return false;
  if (d.preset !== undefined && typeof d.preset !== 'string') return false;
  if (d.legend !== undefined && typeof d.legend !== 'boolean') return false;
  /* BOARD-STYLE — the client twin of the plugin's validateDoc: the two per-board
     values are plain strings, so both backends accept exactly the same bodies. */
  if (d.style !== undefined && typeof d.style !== 'string') return false;
  if (d.density !== undefined && typeof d.density !== 'string') return false;
  for (const n of d.nodes as Array<Record<string, unknown>>) {
    const pos = n?.position as {x?: unknown; y?: unknown} | undefined;
    if (!n || typeof n.id !== 'string' || !pos ||
        typeof pos.x !== 'number' || typeof pos.y !== 'number') return false;
  }
  for (const e of d.edges as Record<string, unknown>[]) {
    if (!e || typeof e.id !== 'string' || typeof e.source !== 'string' || typeof e.target !== 'string') return false;
  }
  return true;
}

/** AT-5 — local ids keep the SERVER's format: `${Date.now().toString(36)}`
 *  + 8 hex chars, matching `/^[a-z0-9]+$/` (the server mints
 *  crypto.randomBytes(4).toString('hex') beside the same time base). Web
 *  Crypto, no dependency. 10k draws are asserted collision-free. */
export function newLocalId(now: number = Date.now()): string {
  const bytes = new Uint8Array(4);
  crypto.getRandomValues(bytes);
  const hex = Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
  return `${now.toString(36)}${hex}`;
}

/** AT-5 — the board list's one ordering: updatedAt desc, newest first. Pure
 *  (returns a new array; the input is not mutated) so the harness can drive
 *  it over a stubbed read. */
export function sortByUpdatedDesc<T extends {updatedAt: number}>(rows: readonly T[]): T[] {
  return [...rows].sort((a, b) => b.updatedAt - a.updatedAt);
}

/** AT-5 — BoardMeta parity: the list rows a local backend yields carry the
 *  SAME shape the server list yields (counts computed from the stored doc,
 *  preset badge identical, old boards without preset get the same default —
 *  undefined here exactly as the server's `preset: undefined`). */
export function toBoardMeta(doc: StoredBoardDoc) {
  return {
    id: doc.id,
    name: doc.name,
    updatedAt: doc.updatedAt,
    nodeCount: doc.nodes.length,
    edgeCount: doc.edges.length,
    preset: doc.preset,
  };
}

/** AT-3 — the library envelope, built with the constants IMPORTED from
 *  src/library.ts (never duplicated) — exactly the document the server's PUT
 *  would store: type/version/source owned by the builder, favourites/shapes
 *  passed through, updatedAt stamped here (local mode's clock). */
export function libraryEnvelope(
  favourites: LibraryDoc['favourites'],
  shapes: LibraryDoc['shapes'],
  type: string = LIBRARY_TYPE,
  version: number = LIBRARY_VERSION,
  source: string = LIBRARY_SOURCE,
  now: number = Date.now(),
): LibraryDoc {
  return {type: type as LibraryDoc['type'], version: version as LibraryDoc['version'], source: source as LibraryDoc['source'], updatedAt: now, favourites, shapes};
}

/* ===========================================================================
   THE ADAPTERS (AT-2). Same call signatures as the server functions in
   src/boards.ts / src/library.ts — App.tsx does not fork on mode.
   =========================================================================== */

const DB_NAME = 'diagram-studio';
/* HISTORY-V4 — 1 -> 2, ADDITIVE (the file's own upgrade policy): the open
 * below creates `versions` when missing, so a v1 database upgrades on first
 * open with zero migration code. */
const DB_VERSION = 2;
const BOARDS_STORE = 'boards';
const LIBRARY_STORE = 'library';
const LIBRARY_KEY = 'library';
/* HISTORY-V4 — one record per sampled checkpoint; the key IS the name the
 * retention planner parses (`<boardId>.<stamp13>.json`). Out-of-line keys,
 * no indexes: the store is bounded by retention (~28 records per board). */
const VERSIONS_STORE = 'versions';

/** The singleton connection. Opened lazily on the first call; if
 *  `indexedDB.open` rejects or throws (storage disabled/unsupported), the
 *  volatile in-memory fallback takes over (AT-2) and `volatile` is true so
 *  the UI can flash the one-time warning. */
let dbPromise: Promise<IDBDatabase | null> | null = null;
export let isVolatile = false;

/** F4 (2026-11-20, t_8cfc79b0) — the session's local backend, resolved ONCE:
 *  when `openDb()` resolves null (storage disabled or unsupported), the first
 *  routed operation swaps the WHOLE session to the volatile memory store and
 *  `isVolatile` finally gains its writer — the storage header's warning
 *  renders (AT-2's promise, kept). Each routed export below checks this first
 *  and delegates the ENTIRE operation to the memory store, which implements
 *  the SAME method names the app already calls, so no caller can tell which
 *  backend it holds. History stays DB-only: a volatile session has no
 *  versions store, so History calls keep failing loudly ('IndexedDB
 *  unavailable') instead of faking versions. */
let volatileStore: MemoryStore | null = null;
async function resolveVolatile() {
  if (volatileStore) return volatileStore;
  if (await openDb()) return null;
  volatileStore = createMemoryStore();
  isVolatile = true;
  return volatileStore;
}

/** The in-memory fallback store (AT-2's last resort): the same operations,
 *  a Map instead of IndexedDB. Boards do not survive a reload — the UI says
 *  so via the App-level flash wired to `isVolatile` (each list refresh). */
export function createMemoryStore() {
  const boards = new Map<string, StoredBoardDoc>();
  let library: LibraryDoc | null = null;
  return {
    volatile: true as const,
    async listBoards() { return sortByUpdatedDesc([...boards.values()]); },
    async getBoard(id: string) {
      const doc = boards.get(id);
      if (!doc) throw notFound();
      return doc;
    },
    async createBoard(name: string, preset?: PresetId) {
      const doc = normalizeBoardDoc({id: newLocalId(), name, nodes: [], edges: [], preset}, Date.now());
      boards.set(doc.id, doc);
      return doc;
    },
    async saveBoard(doc: SaveBoardDoc) {
      const prev = boards.get(doc.id);
      if (!prev) throw notFound(); // AS-4 parity: PUT on a deleted id never resurrects
      const out = normalizeBoardDoc({...doc, nodes: doc.nodes, edges: doc.edges}, Date.now());
      if (out.preset === undefined && prev.preset !== undefined) out.preset = prev.preset;
      boards.set(doc.id, out);
      return out;
    },
    async deleteBoard(id: string) {
      if (!boards.delete(id)) throw notFound();
      return {ok: true as const};
    },
    async getLibrary() {
      return library ?? libraryEnvelope([], []);
    },
    async saveLibrary(favourites: LibraryDoc['favourites'], shapes: LibraryDoc['shapes']) {
      library = libraryEnvelope(favourites, shapes);
      return library;
    },
  };
}

export type MemoryStore = ReturnType<typeof createMemoryStore>;

/** AS-4 error-shape parity: the SAME `{status: 404, message: 'not found'}`
 *  rejection `boards.ts req()` produces after AS-4, so App.tsx's flushSave
 *  (no retry on 4xx, the deleted-board flash) serves both modes unchanged. */
function notFound(): Error & {status: number} {
  const err = new Error('not found') as Error & {status: number};
  err.status = 404;
  return err;
}

function openDb(): Promise<IDBDatabase | null> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise<IDBDatabase | null>(resolve => {
    try {
      if (typeof indexedDB === 'undefined') return resolve(null);
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        /* ADDITIVE upgrades only (AT-3): v1 creates the two stores; later
           versions add stores/indexes here and never drop or rename. */
        if (!db.objectStoreNames.contains(BOARDS_STORE)) {
          const store = db.createObjectStore(BOARDS_STORE, {keyPath: 'id'});
          store.createIndex('updatedAt', 'updatedAt', {unique: false});
        }
        if (!db.objectStoreNames.contains(LIBRARY_STORE)) {
          db.createObjectStore(LIBRARY_STORE);
        }
        /* HISTORY-V4 — the additive v2 store (records keyed by the
           generation-name grammar; nothing existing is touched). */
        if (!db.objectStoreNames.contains(VERSIONS_STORE)) {
          db.createObjectStore(VERSIONS_STORE);
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
      req.onblocked = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
  return dbPromise;
}

function reqAsPromise<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error('IndexedDB request failed'));
  });
}

async function tx<T>(
  store: string,
  mode: IDBTransactionMode,
  run: (s: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  const db = await openDb();
  if (!db) throw new Error('IndexedDB unavailable');
  const t = db.transaction(store, mode);
  return reqAsPromise(run(t.objectStore(store)));
}

/* ---------------------------------------------------------------- boards -- */

export async function listBoards(): Promise<StoredBoardDoc[]> {
  const m = await resolveVolatile(); if (m) return m.listBoards();
  const rows = await tx(BOARDS_STORE, 'readonly', s => s.getAll() as IDBRequest<StoredBoardDoc[]>);
  return sortByUpdatedDesc(rows);
}

export async function getBoard(id: string): Promise<StoredBoardDoc> {
  const m = await resolveVolatile(); if (m) return m.getBoard(id);
  const doc = await tx(BOARDS_STORE, 'readonly', s => s.get(id) as IDBRequest<StoredBoardDoc | undefined>);
  if (!doc) throw notFound();
  return doc;
}

export async function createBoard(name: string, preset?: PresetId): Promise<StoredBoardDoc> {
  const m = await resolveVolatile(); if (m) return m.createBoard(name, preset);
  const doc = normalizeBoardDoc({id: newLocalId(), name, nodes: [], edges: [], preset}, Date.now());
  await tx(BOARDS_STORE, 'readwrite', s => s.put(doc));
  return doc;
}

export async function saveBoard(doc: SaveBoardDoc): Promise<StoredBoardDoc> {
  if (!isValidBoardDoc(doc)) {
    const err = new Error('invalid board') as Error & {status: number};
    err.status = 400; // the server answers 400 for an invalid body — same shape
    throw err;
  }
  const m = await resolveVolatile(); if (m) return m.saveBoard(doc);
  const db = await openDb();
  if (!db) throw new Error('IndexedDB unavailable');
  /* HISTORY-V4 — ONE transaction across BOTH stores: the checkpoint and the
     live write commit atomically. A second, interleaved transaction is the
     classic IDB trap (this one would auto-commit while the other runs, and
     the put below would throw TransactionInactiveError) — every step of the
     capture stays on THIS transaction, whose same-tx await pattern is the
     one the get/put pair below has used since AT. */
  const t = db.transaction([BOARDS_STORE, VERSIONS_STORE], 'readwrite');
  const store = t.objectStore(BOARDS_STORE);
  const prev = await reqAsPromise(store.get(doc.id) as IDBRequest<StoredBoardDoc | undefined>);
  if (!prev) {
    /* AS-4 parity — a save on a deleted board is a loud 404: no resurrection,
       and flushSave's no-retry-on-4xx + deleted-board flash apply unchanged. */
    const err = notFound();
    try { t.abort(); } catch { /* already done */ }
    throw err;
  }
  const out = normalizeBoardDoc(doc, Date.now());
  if (out.preset === undefined && prev.preset !== undefined) out.preset = prev.preset;
  /* HISTORY-V4 — the sampled checkpoint of the state being replaced. H6:
     best-effort by construction — captureCheckpoint contains every failure
     (one console.warn, never a throw), so the live write below always runs. */
  await captureCheckpoint(t.objectStore(VERSIONS_STORE), doc, prev, out);
  await reqAsPromise(store.put(out));
  return out;
}

export async function deleteBoard(id: string): Promise<{ok: boolean}> {
  const m = await resolveVolatile(); if (m) return m.deleteBoard(id);
  const db = await openDb();
  if (!db) throw new Error('IndexedDB unavailable');
  /* HISTORY-V4 — the same two-store transaction: the board and ALL its
     version records go together (H9 — zero orphans; the server's DELETE
     drops the board's .history entries beside its tombstone). */
  const t = db.transaction([BOARDS_STORE, VERSIONS_STORE], 'readwrite');
  const store = t.objectStore(BOARDS_STORE);
  const prev = await reqAsPromise(store.get(id) as IDBRequest<StoredBoardDoc | undefined>);
  if (!prev) throw notFound();
  await reqAsPromise(store.delete(id));
  try {
    const versions = t.objectStore(VERSIONS_STORE);
    const records = await reqSoft(versions.getAll() as IDBRequest<VersionRecord[]>);
    if (records != null) {
      for (const r of records) {
        if (r && r.id === id) await reqSoft(versions.delete(versionKeyOf(r)));
      }
    }
  } catch (e) {
    console.warn('[local-history] version drop failed:', (e as Error | undefined)?.message ?? e);
  }
  return {ok: true};
}

/* ============================================ HISTORY-V4: the versions store ==
 * The LOCAL twin of the server's `boards/.history/` — same law, same policy
 * home (historyPolicy.ts), same row shape, same error statuses. The record's
 * `doc` is the RAW BoardDoc JSON string (2-space pretty, the bytes the
 * server's writeJsonAtomic would hold for the same state), so a restore
 * writes the exact old bytes and `bytes` is the same UTF-8 length the
 * server's file size reports.
 * ============================================================================ */

/** One sampled checkpoint. `label` present (even '') = pinned — the local
 *  pins live ON the record itself, no sidecar (HISTORY-V3 parity: the server
 *  keeps a labels sidecar because its files are read-only captures; here the
 *  record is the natural home). */
export type VersionRecord = {
  id: string;
  /** 13-digit epoch-ms stamp — the key's own digits. */
  stamp: string;
  at: number;
  bytes: number;
  doc: string;
  label?: string;
  source?: string;
};

/** The listing row — structurally the seam's HistoryRow (serverBoards.ts).
 *  Kept as a local structural type so localStore stays a leaf with no import
 *  edge onto the transport; the harness asserts the two shapes agree. */
export type LocalHistoryRow = {
  stamp: string;
  at: number;
  bytes: number;
  label?: string;
  source?: string;
};

/** The record's key: the SAME `<boardId>.<stamp13>.json` grammar the server's
 *  generation files carry, so planHistory/shouldCheckpoint work verbatim. */
const versionKeyOf = (r: Pick<VersionRecord, 'id' | 'stamp'>) => `${r.id}.${r.stamp}.json`;

/** UTF-8 byte length — the same measure the server's fs.statSync().size
 *  reports for the equivalent file. */
const utf8Len = (s: string) => new TextEncoder().encode(s).length;

/** A SOFT IDB request: a failure resolves null (and the error's default is
 *  prevented, so the surrounding TRANSACTION survives) instead of rejecting.
 *  The history capture must never abort the board save — H6: best-effort,
 *  one console.warn, the save completes byte-identically. Callers treat null
 *  as "this step is skipped". */
function reqSoft<T>(req: IDBRequest<T>): Promise<T | null> {
  return new Promise(resolve => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = ev => {
      (ev as unknown as Event).preventDefault?.();
      resolve(null);
    };
  });
}

/** The local twin of the server's nextHistoryStamp: bump until the name is
 *  free — two saves can land in the same millisecond (harness drives do),
 *  and a record is never overwritten. Same 1000-try bound as the server's. */
function nextLocalStamp(existing: ReadonlySet<string>, id: string, now: number): string {
  let ts = now;
  for (let i = 0; i < 1000; i++) {
    if (!existing.has(`${id}.${ts}.json`)) return String(ts);
    ts += 1;
  }
  throw new Error(`no free history stamp for ${id}`);
}

/** The capture + the per-save prune, run inside the save's own transaction.
 *  Mirrors the server's PUT-path hook byte-for-byte: prevRaw is what the
 *  server's live file held, outRaw is what the new write will hold; the
 *  capture stores prevRaw exactly (the state being replaced), and the prune
 *  plans over the WHOLE store after every save exactly like the server's
 *  pruneBoardHistory(HISTORY_DIR) after every PUT. ONE deliberate
 *  divergence, stated in the V4 brief: a 'pre-restore' save honors BYTE-DIFF
 *  while the 120 s gap is waived — the server's hook is unconditional, so
 *  restoring the state already live archives a redundant copy there; locally
 *  it archives nothing (the sampling harness pins the server's opposite). */
async function captureCheckpoint(
  versions: IDBObjectStore,
  doc: SaveBoardDoc,
  prev: StoredBoardDoc,
  out: StoredBoardDoc,
): Promise<void> {
  try {
    const prevRaw = JSON.stringify(prev, null, 2);
    const outRaw = JSON.stringify(out, null, 2);
    const bytesDiffer = prevRaw !== outRaw;
    const records = await reqSoft(versions.getAll() as IDBRequest<VersionRecord[]>);
    if (records == null) throw new Error('versions read failed');
    const newestStamp = records.reduce<number | null>(
      (m, r) => (r && r.id === doc.id ? Math.max(m ?? -Infinity, Number(r.stamp)) : m),
      null,
    );
    const names = records.map(versionKeyOf);
    const take = doc.historyReason === 'pre-restore'
      ? bytesDiffer
      : shouldCheckpoint({now: Date.now(), newestStamp, bytesDiffer, reason: doc.historyReason});
    let afterNames = names;
    if (take) {
      const stamp = nextLocalStamp(new Set(names), doc.id, Date.now());
      const record: VersionRecord = {id: doc.id, stamp, at: Number(stamp), bytes: utf8Len(prevRaw), doc: prevRaw};
      const key = versionKeyOf(record);
      const written = await reqSoft(versions.put(record, key));
      if (written == null) throw new Error('versions write failed');
      /* plan over the post-capture set — the server's prune lists the dir
         AFTER the copy, so the newest generation is in the plan too. */
      afterNames = [...names, key];
    }
    /* pins are the labelled records themselves; the planner bounds them at
       HISTORY_PIN_KEEP newest, per board by construction of the names. */
    const pins = records.filter(r => r && r.label !== undefined).map(versionKeyOf);
    const plan = planHistory(afterNames.map(name => ({name})), {now: Date.now(), pins});
    for (const name of plan.evict) await reqSoft(versions.delete(name));
  } catch (e) {
    console.warn('[local-history] checkpoint skipped:', (e as Error | undefined)?.message ?? e);
  }
}

/** One row per sampled checkpoint, NEWEST FIRST — the same shape the server
 *  listing produces. A board with no live record is the server read half's
 *  own 404 gate; a live board with no captures yet lists empty (honest). */
export async function listHistoryLocal(id: string): Promise<LocalHistoryRow[]> {
  await getBoard(id); /* the server route: if (!readBoard(id)) 404 */
  const records = await tx(VERSIONS_STORE, 'readonly', s => s.getAll() as IDBRequest<VersionRecord[]>);
  const rows: LocalHistoryRow[] = [];
  for (const r of records) {
    if (!r || r.id !== id || typeof r.stamp !== 'string') continue;
    const row: LocalHistoryRow = {stamp: r.stamp, at: Number(r.stamp), bytes: Number(r.bytes) || 0};
    if (r.label !== undefined) row.label = r.label;
    if (r.source !== undefined) row.source = r.source;
    rows.push(row);
  }
  rows.sort((a, b) => b.at - a.at); // newest first — the server route's own order
  return rows;
}

/** One generation, the exact stored bytes as a doc. Mirrors the server
 *  route's guards: a malformed stamp is the route's own 400, a stamp with no
 *  record its 404 (H9 means a deleted board has no records, so it 404s the
 *  same way the server's dropped .history entries do). */
export async function getHistoryVersionLocal(id: string, stamp: string): Promise<StoredBoardDoc> {
  if (!/^\d{13}$/.test(stamp)) {
    const err = new Error('invalid stamp') as Error & {status: number};
    err.status = 400;
    throw err;
  }
  const rec = await tx(VERSIONS_STORE, 'readonly', s => s.get(`${id}.${stamp}.json`) as IDBRequest<VersionRecord | undefined>);
  if (!rec) throw notFound();
  return JSON.parse(rec.doc) as StoredBoardDoc;
}

/** Pin one generation, or edit an existing pin's label — the server route's
 *  WRITE half mirrored: the stamp must name a record the listing produced
 *  (ghost 404), the label is trimmed, ≤80 chars, '' is LEGAL (pinned without
 *  a name — the pin is the label slot), and the cap counts PINS per board,
 *  not edits: a re-label at cap is a 200, a NEW pin at cap is a 409 carrying
 *  the count. */
export async function pinHistoryLabelLocal(id: string, stamp: string, label: string): Promise<{ok: boolean; pinned: number}> {
  if (!/^\d{13}$/.test(stamp)) {
    const err = new Error('invalid stamp') as Error & {status: number};
    err.status = 400;
    throw err;
  }
  if (typeof label !== 'string') {
    const err = new Error('label must be a string') as Error & {status: number};
    err.status = 400;
    throw err;
  }
  const trimmed = label.trim();
  if (trimmed.length > 80) {
    const err = new Error('label must be at most 80 characters') as Error & {status: number};
    err.status = 400;
    throw err;
  }
  await getBoard(id); /* the route's own gate: the board must be live */
  const records = await tx(VERSIONS_STORE, 'readonly', s => s.getAll() as IDBRequest<VersionRecord[]>);
  const key = `${id}.${stamp}.json`;
  const rec = records.find(r => r && versionKeyOf(r) === key);
  if (!rec) throw notFound();
  const isPin = rec.label !== undefined;
  const pinned = records.filter(r => r && r.id === id && r.label !== undefined).length;
  if (!isPin && pinned >= HISTORY_PIN_KEEP) {
    const err = new Error(`pin cap reached (${HISTORY_PIN_KEEP})`) as Error & {status: number};
    err.status = 409;
    throw err;
  }
  const next: VersionRecord = {...rec, label: trimmed};
  await tx(VERSIONS_STORE, 'readwrite', s => s.put(next, key));
  return {ok: true, pinned: isPin ? pinned : pinned + 1};
}

/** Unpin one generation. The freed slot is immediately usable (the harness
 *  proves unpin-frees); unpinning a stamp that was never pinned answers the
 *  route's own 404 'not pinned'. */
export async function unpinHistoryLabelLocal(id: string, stamp: string): Promise<{ok: boolean; pinned: number}> {
  if (!/^\d{13}$/.test(stamp)) {
    const err = new Error('invalid stamp') as Error & {status: number};
    err.status = 400;
    throw err;
  }
  await getBoard(id);
  const records = await tx(VERSIONS_STORE, 'readonly', s => s.getAll() as IDBRequest<VersionRecord[]>);
  const key = `${id}.${stamp}.json`;
  const rec = records.find(r => r && versionKeyOf(r) === key);
  if (!rec) throw notFound();
  if (rec.label === undefined) {
    const err = new Error('not pinned') as Error & {status: number};
    err.status = 404;
    throw err;
  }
  const {label: _drop, ...rest} = rec;
  void _drop;
  await tx(VERSIONS_STORE, 'readwrite', s => s.put(rest, key));
  const pinned = records.filter(r => r && r.id === id && r.label !== undefined && r.stamp !== stamp).length;
  return {ok: true, pinned};
}

/* --------------------------------------------------------------- library -- */

export async function getLibrary(): Promise<LibraryDoc> {
  const m = await resolveVolatile(); if (m) return m.getLibrary();
  const doc = await tx(LIBRARY_STORE, 'readonly', s => s.get(LIBRARY_KEY) as IDBRequest<LibraryDoc | undefined>);
  return doc ?? libraryEnvelope([], []); // an empty database IS the empty envelope
}

export async function saveLibrary(favourites: LibraryDoc['favourites'], shapes: LibraryDoc['shapes']): Promise<LibraryDoc> {
  const m = await resolveVolatile(); if (m) return m.saveLibrary(favourites, shapes);
  const out = libraryEnvelope(favourites, shapes);
  await tx(LIBRARY_STORE, 'readwrite', s => s.put(out, LIBRARY_KEY));
  return out;
}

/* -------------------------------------------------------- AT-4 #1 — persist */

/** navigator.storage.persist() — called ONCE, on the first successful local
 *  write (not at boot: an empty database has nothing to protect). Denied or
 *  unsupported → nothing user-visible at write time; it surfaces only in the
 *  storage readout. Never re-asked. */
let persistAttempted = false;
export function requestPersistenceOnce(): void {
  if (persistAttempted) return;
  persistAttempted = true;
  try {
    void navigator?.storage?.persist?.().catch(() => { /* surfaces in the readout only */ });
  } catch { /* unsupported — same treatment */ }
}
