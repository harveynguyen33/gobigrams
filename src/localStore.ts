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
 * id/name/nodes/edges/updatedAt/preset?/legend?; legacy `theme` is dropped),
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
 * server would store it). No other stores (YAGNI — the probe cache lives in
 * memory). UPGRADE POLICY: version bumps are ADDITIVE — new stores/indexes in
 * onupgradeneeded; existing stores are never renamed or dropped without
 * migration code in the same upgrade.
 */
import {type Node, type Edge} from '@xyflow/react';
import {type PresetId} from './presets';
import {LIBRARY_TYPE, LIBRARY_VERSION, LIBRARY_SOURCE, type LibraryDoc} from './library';

/** The shape of a document this store accepts — the same param shape
 *  `boards.ts saveBoard` has always taken (theme tolerated, never stored). */
export type SaveBoardDoc = {
  id: string; name: string; nodes: Node[]; edges: Edge[];
  preset?: PresetId;
  /** @deprecated (PACKAGE-M fix) — ignored; boards no longer store a theme. */
  theme?: string;
  legend?: boolean;
};

/** The document as stored/read back (BoardDoc minus the legacy theme key). */
export type StoredBoardDoc = {
  id: string; name: string; nodes: Node[]; edges: Edge[]; updatedAt: number;
  preset?: PresetId; legend?: boolean;
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
const DB_VERSION = 1;
const BOARDS_STORE = 'boards';
const LIBRARY_STORE = 'library';
const LIBRARY_KEY = 'library';

/** The singleton connection. Opened lazily on the first call; if
 *  `indexedDB.open` rejects or throws (storage disabled/unsupported), the
 *  volatile in-memory fallback takes over (AT-2) and `volatile` is true so
 *  the UI can flash the one-time warning. */
let dbPromise: Promise<IDBDatabase | null> | null = null;
export let isVolatile = false;

/** The in-memory fallback store (AT-2's last resort): the same operations,
 *  a Map instead of IndexedDB. Boards do not survive a reload — the UI says
 *  so, once, via the App-level flash wired to `isVolatile`. */
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
  const rows = await tx(BOARDS_STORE, 'readonly', s => s.getAll() as IDBRequest<StoredBoardDoc[]>);
  return sortByUpdatedDesc(rows);
}

export async function getBoard(id: string): Promise<StoredBoardDoc> {
  const doc = await tx(BOARDS_STORE, 'readonly', s => s.get(id) as IDBRequest<StoredBoardDoc | undefined>);
  if (!doc) throw notFound();
  return doc;
}

export async function createBoard(name: string, preset?: PresetId): Promise<StoredBoardDoc> {
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
  const db = await openDb();
  if (!db) throw new Error('IndexedDB unavailable');
  const t = db.transaction(BOARDS_STORE, 'readwrite');
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
  await reqAsPromise(store.put(out));
  return out;
}

export async function deleteBoard(id: string): Promise<{ok: boolean}> {
  const db = await openDb();
  if (!db) throw new Error('IndexedDB unavailable');
  const t = db.transaction(BOARDS_STORE, 'readwrite');
  const store = t.objectStore(BOARDS_STORE);
  const prev = await reqAsPromise(store.get(id) as IDBRequest<StoredBoardDoc | undefined>);
  if (!prev) throw notFound();
  await reqAsPromise(store.delete(id));
  return {ok: true};
}

/* --------------------------------------------------------------- library -- */

export async function getLibrary(): Promise<LibraryDoc> {
  const doc = await tx(LIBRARY_STORE, 'readonly', s => s.get(LIBRARY_KEY) as IDBRequest<LibraryDoc | undefined>);
  return doc ?? libraryEnvelope([], []); // an empty database IS the empty envelope
}

export async function saveLibrary(favourites: LibraryDoc['favourites'], shapes: LibraryDoc['shapes']): Promise<LibraryDoc> {
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
