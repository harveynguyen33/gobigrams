import {defineConfig, type Plugin} from 'vite';
import react from '@vitejs/plugin-react';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {pruneBoardRetention, pruneBoardHistory, dropBoardHistory, newestHistoryStamp} from './scripts/boardRetention.mjs';
/* HISTORY-V1 — the sampling predicate and the retention numbers live in ONE
   dependency-free home under src/board (importable by this file, the .mjs
   harnesses, and later the browser-side local adapter without any node:
   specifier riding along). */
import {HISTORY_PIN_KEEP, HISTORY_RE, shouldCheckpoint} from './src/board/historyPolicy.ts';

const BOARDS_DIR = path.resolve(__dirname, 'boards');
/** HARNESS-ISOLATION-2 F2 — the rolling save history (`boards/.history/`).
 *  A subdirectory of the already-gitignored `boards/`, so `listBoards()` never
 *  sees it (its readdir filters files) and the retention sweep's own file scan
 *  skips it (a directory is not a file). */
const HISTORY_DIR = path.join(BOARDS_DIR, '.history');
/** PACKAGE-N §7 — the user library is a SINGLETON document in the same
 *  already-gitignored `boards/` dir, with ONE `.bak` generation beside it. */
const LIBRARY_FILE = path.join(BOARDS_DIR, 'library.json');
const LIBRARY_BAK = `${LIBRARY_FILE}.bak`;
const LIBRARY_TYPE = 'diagram-studio-library';
const LIBRARY_VERSION = 1;
const LIBRARY_SOURCE = 'diagram-studio';
const MAX_BODY = 5 * 1024 * 1024; // 5 MB
const ID_RE = /^[A-Za-z0-9_-]+$/;

/** Read a raw request body as a string, capped at MAX_BODY bytes. */
function readBody(req: any): Promise<string> {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks: Buffer[] = [];
    req.on('data', (c: Buffer) => {
      size += c.length;
      if (size > MAX_BODY) {
        reject(new Error('too_large'));
        req.destroy();
        return;
      }
      chunks.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

function boardFile(id: string) {
  if (!ID_RE.test(id)) return null; // also blocks path traversal (no / or . allowed)
  return path.join(BOARDS_DIR, `${id}.json`);
}

/* BOARD-RETENTION (task t_59671f6a) — boards/ tombstones and .bak generations
   are bounded by the policy in scripts/boardRetention.mjs (the ONE home of
   the numbers; checks/round-board-retention.mjs asserts the bound). The
   sweep runs OFF the request path (setTimeout 0) and is unref'd, so it never
   delays a response, never blocks boot, and never keeps the process alive.
   It only ever removes files matching the two exact archive/backup name
   shapes — a live board, the library or a crash leftover is data. */
function scheduleRetentionSweep(delayMs = 0) {
  setTimeout(() => {
    try {
      const s = pruneBoardRetention(BOARDS_DIR);
      if (s.removed.tombstones || s.removed.baks) {
        console.log(`[boards] retention: removed ${s.removed.tombstones} tombstone(s), ${s.removed.baks} .bak(s); kept ${s.kept.tombstones} tombstone(s), ${s.kept.baks} .bak(s) of ${s.scanned} file(s)`);
      }
      /* HARNESS-ISOLATION-2 F2 — the same sweep bounds the save history: the
         newest 10 per board, and nothing at all for a board that no longer has
         a live file (its tombstone is the recovery copy, exactly like its
         `.bak`). There is deliberately NO global cap — a global one let harness
         scratch churn evict a real board's window, measured. */
      const h = pruneBoardHistory(HISTORY_DIR, {
        liveIds: liveBoardIds(),
        log: (m: string) => console.warn(m),
      });
      if (h.removed) {
        console.log(`[boards] history: removed ${h.removed} generation(s); kept ${h.keep.length} (${h.other.length} non-matching file(s) untouched)`);
      }
    } catch (e: any) {
      console.warn('[boards] retention sweep failed:', e?.message ?? e);
    }
  }, delayMs).unref?.();
}

/** HARNESS-ISOLATION-2 F2 — the next free `<epoch-ms>` stamp for one board's
 *  history. Two saves can land in the same millisecond (harness PUTs do); a
 *  bump keeps every generation a distinct file — history is never overwritten. */
function nextHistoryStamp(dir: string, id: string) {
  let ts = Date.now();
  for (let i = 0; i < 1000; i++) {
    if (!fs.existsSync(path.join(dir, `${id}.${ts}.json`))) return ts;
    ts += 1;
  }
  throw new Error(`no free history stamp for ${id} in ${dir}`);
}

/** HISTORY-V3 (t_37f23a89) — the pinned stamps one labels sidecar holds.
 *  An entry counts only when it is the object shape the READ path decorates
 *  from (a broken sidecar degrades to zero pins, same as it degrades to
 *  plain stamps on the read). The cap VALUE comes from the ONE policy home
 *  (HISTORY_PIN_KEEP — never a literal here). */
function pinCountOf(labels: Record<string, any>): number {
  return Object.values(labels).filter(v => v && typeof v === 'object' && !Array.isArray(v)).length;
}

/** HISTORY-V3 — read one board's labels sidecar tolerantly: absent or
 *  unparsable degrades to `{}` (the read half's own rule — never a 500 for
 *  a decoration). */
function readLabelsSidecar(dir: string, id: string): Record<string, any> {
  try {
    const raw = JSON.parse(fs.readFileSync(path.join(dir, `${id}.labels.json`), 'utf8'));
    if (raw && typeof raw === 'object' && !Array.isArray(raw)) return raw;
  } catch { /* absent or broken — start from {} */ }
  return {};
}


/** HARNESS-ISOLATION-2 F2 — the ids that currently have a live board file.
 *  `<id>.json` where the id carries no dot: tombstones (`<id>.deleted-…`) and
 *  crash leftovers are excluded by construction (the same ID_RE the board
 *  routes use). */
function liveBoardIds(): Set<string> {
  try {
    return new Set(fs.readdirSync(BOARDS_DIR)
      .filter(f => f.endsWith('.json') && ID_RE.test(f.slice(0, -5)))
      .map(f => f.slice(0, -5)));
  } catch {
    return new Set();
  }
}

function readBoard(id: string) {
  const f = boardFile(id);
  if (!f || !fs.existsSync(f)) return null;
  try {
    return JSON.parse(fs.readFileSync(f, 'utf8'));
  } catch {
    return null;
  }
}

/** Validate a board document body. Returns an error string or null. */
function validateDoc(doc: any): string | null {
  if (!doc || typeof doc !== 'object') return 'body must be an object';
  if (doc.name !== undefined && typeof doc.name !== 'string') return 'name must be a string';
  if (!Array.isArray(doc.nodes)) return 'nodes must be an array';
  if (!Array.isArray(doc.edges)) return 'edges must be an array';
  // L2: board metadata rides along unchanged (arbitrary JSON, no schema change).
  if (doc.preset !== undefined && typeof doc.preset !== 'string') return 'preset must be a string';
  if (doc.theme !== undefined && typeof doc.theme !== 'string') return 'theme must be a string';
  if (doc.legend !== undefined && typeof doc.legend !== 'boolean') return 'legend must be a boolean';
  /* BOARD-STYLE — the two per-board values are plain strings; the CLIENT's
     resolveTableStyle/resolveDensity owns vocabulary, so an unknown token is
     stored and read back as the default rather than refusing the write. */
  if (doc.style !== undefined && typeof doc.style !== 'string') return 'style must be a string';
  if (doc.density !== undefined && typeof doc.density !== 'string') return 'density must be a string';
  for (const n of doc.nodes) {
    if (!n || typeof n.id !== 'string' || !n.position ||
        typeof n.position.x !== 'number' || typeof n.position.y !== 'number')
      return 'invalid node in nodes';
  }
  for (const e of doc.edges) {
    if (!e || typeof e.id !== 'string' || typeof e.source !== 'string' || typeof e.target !== 'string')
      return 'invalid edge in edges';
  }
  return null;
}

/** Write JSON atomically: a unique temp file in the SAME directory, then rename(2)
 *  over the target. rename is atomic on POSIX, so no reader ever sees a partial
 *  file and a crash mid-write cannot truncate the original. */
function writeJsonAtomic(file: string, data: unknown) {
  const tmp = `${file}.${process.pid}.${Math.random().toString(36).slice(2)}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2));
  fs.renameSync(tmp, file);
}

/* ===========================================================================
   PACKAGE-N §7 — the user library (`/api/library`), a SINGLETON document.

   One file holds BOTH favourites (§6) and custom shapes (§8 — not written
   yet): one `version`, one atomic write, one `.bak` generation. It is the one
   shared, mutable, portable document that outlives "clear browsing data".
=========================================================================== */

/** The document a client gets when nothing has been stored yet — also the
 *  answer to a file that cannot be read (hand-edited, truncated, half-written). */
function emptyLibrary() {
  return {
    type: LIBRARY_TYPE, version: LIBRARY_VERSION, source: LIBRARY_SOURCE,
    updatedAt: 0, favourites: [] as unknown[], shapes: [] as unknown[],
  };
}

/** Read + MIGRATE in memory. Never throws: the endpoint is the only consumer,
 *  and a hand-edited or corrupt file must degrade to the empty envelope rather
 *  than a 500 that would look like "the library is gone" to the client.
 *
 *  Migration follows the PACKAGE-M pattern — READ the legacy shape, upgrade it
 *  in memory, and only ever WRITE the current version. A stored doc missing
 *  `version` (or shaped pre-envelope) is filled field-by-field; absent arrays
 *  become `[]` (Excalidraw's never-trust-absent-fields convention). `updatedAt`
 *  is preserved when it is a real number so the client's "last saved" survives
 *  the upgrade. */
function readLibrary() {
  if (!fs.existsSync(LIBRARY_FILE)) return emptyLibrary();
  try {
    const raw = JSON.parse(fs.readFileSync(LIBRARY_FILE, 'utf8')) as any;
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return emptyLibrary();
    return {
      ...emptyLibrary(),
      ...(Array.isArray(raw.favourites) ? {favourites: raw.favourites} : null),
      ...(Array.isArray(raw.shapes) ? {shapes: raw.shapes} : null),
      ...(typeof raw.updatedAt === 'number' && Number.isFinite(raw.updatedAt) ? {updatedAt: raw.updatedAt} : null),
      // stamped last so a stored doc can never claim a different type/version
      type: LIBRARY_TYPE,
      version: LIBRARY_VERSION,
      source: LIBRARY_SOURCE,
    };
  } catch {
    return emptyLibrary();
  }
}

/** The library is a singleton — same validation style as `validateDoc`. */
function validateLibrary(doc: any): string | null {
  if (!doc || typeof doc !== 'object' || Array.isArray(doc)) return 'body must be an object';
  if (!Array.isArray(doc.favourites)) return 'favourites must be an array';
  if (!Array.isArray(doc.shapes)) return 'shapes must be an array';
  return null;
}

function listBoards() {
  if (!fs.existsSync(BOARDS_DIR)) return [];
  return fs.readdirSync(BOARDS_DIR)
    .filter(f => f.endsWith('.json'))
    .map(f => {
      const doc = readBoard(f.slice(0, -5));
      if (!doc) return null;
      /* PACKAGE-N §7 — `library.json` lives in this same directory (it is the
         already-gitignored home the brief names) and this filter cannot tell it
         from a board: it ends in `.json` and parses. Without this guard it
         becomes a phantom board in the list — `id: undefined`, name
         "Untitled" — and, worse, `openBoard()` would hand a library document
         to `applyBoard`, whose `doc.nodes.map` throws. A board is identified by
         carrying `nodes` AND `edges` arrays; anything else in this directory is
         not a board. (A corrupt board is still omitted, exactly as before —
         `readBoard` returns null for it.) */
      if (!Array.isArray(doc.nodes) || !Array.isArray(doc.edges)) return null;
      return {
        id: doc.id,
        name: doc.name ?? 'Untitled',
        updatedAt: doc.updatedAt ?? 0,
        nodeCount: doc.nodes.length,
        edgeCount: doc.edges.length,
        // L2: surfaced so the board list can badge each board's diagram type.
        preset: typeof doc.preset === 'string' ? doc.preset : undefined,
      };
    })
    .filter(Boolean)
    .sort((a: any, b: any) => b.updatedAt - a.updatedAt);
}

/** Inline dev-server plugin: a tiny JSON file-backed boards API. */
function boardsApi(): Plugin {
  /* AS-4 — the ONE middleware registration, wired into BOTH configureServer
     and configurePreviewServer, so `vite preview` (a self-hosted public
     release: npm run build && npm run preview) serves /api/* exactly like the
     dev server. TRUE static hosting (dumb CDN, file://) remains unsupported —
     a server process is required, stated in README/DEV-NOTES. */
  const registerMiddlewares = (server: {middlewares: {use: (fn: (req: any, res: any, next: any) => void) => void}}) => {
    /* BOARD-RETENTION — one sweep shortly after boot (dev AND preview), so a
       backlog left by a long-dead process is cleared without any board
       operation having to happen first. Deferred + unref'd: never blocks the
       first render or holds the process open. */
    scheduleRetentionSweep(1500);
    server.middlewares.use((req: any, res: any, next: any) => {
      const url = new URL(req.url, 'http://localhost');
        if (!url.pathname.startsWith('/api/')) return next();

        const send = (code: number, data: any) => {
          res.statusCode = code;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify(data));
        };

        /* ---- PACKAGE-N §7 — GET/PUT /api/library -------------------------
           A SINGLETON document: no id segment, one file, one `.bak`
           generation, one atomic write. Same `readBody` / `send` / error
           mapping as the boards routes below. */
        if (url.pathname === '/api/library' || url.pathname === '/api/library/') {
          const method = req.method;
          return (async () => {
            // GET /api/library — the document, or the empty envelope. Reads
            // MIGRATE in memory (readLibrary) and never throw on a bad file.
            if (method === 'GET') return send(200, readLibrary());

            // PUT /api/library — validate, back up, write atomically.
            if (method === 'PUT') {
              let doc: any;
              try {
                doc = JSON.parse(await readBody(req));
              } catch (e: any) {
                return send(e === 'too_large' ? 413 : 400, {error: e === 'too_large' ? 'body too large' : 'invalid JSON'});
              }
              const err = validateLibrary(doc);
              if (err) return send(400, {error: err});
              // The server OWNS the envelope: the client cannot forge type,
              // version or source, and `updatedAt` is always server time.
              const stored = {
                type: LIBRARY_TYPE, version: LIBRARY_VERSION, source: LIBRARY_SOURCE,
                updatedAt: Date.now(),
                favourites: doc.favourites, shapes: doc.shapes,
              };
              try {
                fs.mkdirSync(BOARDS_DIR, {recursive: true});
                // ONE `.bak` generation FIRST — the endpoint is unauthenticated
                // and un-merged, so a bad client write must not destroy the
                // whole library in a single request.
                if (fs.existsSync(LIBRARY_FILE)) fs.renameSync(LIBRARY_FILE, LIBRARY_BAK);
                writeJsonAtomic(LIBRARY_FILE, stored);
              } catch (e: any) {
                // Never fail silently: the library has no server-side copy.
                return send(500, {error: String(e)});
              }
              return send(200, stored);
            }

            return send(405, {error: 'method not allowed'});
          })().catch((e: any) => send(500, {error: String(e)}));
        }

        if (!url.pathname.startsWith('/api/boards')) return next();

        const seg = url.pathname.split('/').filter(Boolean); // ['api','boards'[, id]]
        const id = seg[2];
        const method = req.method;

        (async () => {
          // GET /api/boards — list
          if (method === 'GET' && !id) return send(200, listBoards());

          // POST /api/boards — create
          if (method === 'POST' && !id) {
            let body: any;
            try {
              body = JSON.parse(await readBody(req));
            } catch (e: any) {
              return send(e === 'too_large' ? 413 : 400, {error: e === 'too_large' ? 'body too large' : 'invalid JSON'});
            }
            if (typeof body?.name !== 'string') return send(400, {error: 'name must be a string'});
            fs.mkdirSync(BOARDS_DIR, {recursive: true});
            const nid = `${Date.now().toString(36)}${crypto.randomBytes(4).toString('hex')}`;
            const doc = {id: nid, name: body.name, nodes: [], edges: [], updatedAt: Date.now(),
              ...(typeof body.preset === 'string' ? {preset: body.preset} : null)};
            writeJsonAtomic(boardFile(nid)!, doc);
            return send(201, doc);
          }

          if (!id) return send(405, {error: 'method not allowed'});
          const file = boardFile(id);
          if (!file) return send(400, {error: 'invalid id'});

          /* HISTORY-V2 (t_ed1282a5) — the READ half of the save history. No
             index file: the directory listing is the truth; the labels
             sidecar (V3 owns its writer) may only DECORATE rows. Both
             routes answer 404 for a board whose live file is gone, the
             same answer the plain GET gives. */
          if (method === 'GET' && seg[3] === 'history') {
            if (!readBoard(id)) return send(404, {error: 'not found'});
            if (seg[4] === undefined) {
              const rows: {stamp: string; at: number; bytes: number; label?: string; source?: string}[] = [];
              let names: string[] = [];
              try { names = fs.readdirSync(HISTORY_DIR); } catch { names = []; /* no .history yet */ }
              for (const name of names) {
                const m = HISTORY_RE.exec(name);
                if (!m || m[1] !== id) continue;
                let bytes = 0;
                try { bytes = fs.statSync(path.join(HISTORY_DIR, name)).size; } catch { continue; }
                rows.push({stamp: m[2], at: Number(m[2]), bytes});
              }
              rows.sort((a, b) => b.at - a.at); // newest first
              /* sidecar: missing / unparsable / wrong-shaped degrades to
                 plain stamps — never a 500, never an invented row. */
              let labels: Record<string, any> | null = null;
              try {
                const raw = JSON.parse(fs.readFileSync(path.join(HISTORY_DIR, `${id}.labels.json`), 'utf8'));
                if (raw && typeof raw === 'object' && !Array.isArray(raw)) labels = raw;
              } catch { /* absent or broken — plain stamps */ }
              if (labels) for (const row of rows) {
                const e = labels[row.stamp];
                if (e && typeof e === 'object' && !Array.isArray(e)) {
                  if (typeof e.label === 'string') row.label = e.label;
                  if (typeof e.source === 'string') row.source = e.source;
                }
              }
              return send(200, rows);
            }
            /* one generation, the exact stored bytes. PATH SAFETY is layered
               and each layer stops its own class of attempt: the id was
               ID_RE-validated above (boardFile — no dots or slashes), the
               STAMP regex below stops traversal (`../`, %-encoded dots, a
               short or long stamp) BEFORE the name is concatenated, and the
               resolved-path assert proves the join stayed inside
               HISTORY_DIR. */
            const stamp = seg[4];
            if (seg[5] !== undefined) return send(404, {error: 'not found'});
            if (!/^\d{13}$/.test(stamp)) return send(400, {error: 'invalid stamp'});
            const versionFile = path.resolve(HISTORY_DIR, `${id}.${stamp}.json`);
            if (!versionFile.startsWith(HISTORY_DIR + path.sep)) return send(400, {error: 'invalid path'});
            if (!fs.existsSync(versionFile)) return send(404, {error: 'not found'});
            res.statusCode = 200;
            res.setHeader('Content-Type', 'application/json');
            res.end(fs.readFileSync(versionFile));
            return;
          }

          /* HISTORY-V3 (t_37f23a89) — the pins sidecar's WRITE half:
             PUT | DELETE /api/boards/:id/history/:stamp/label. A pin is
             DECORATION on a row the listing already produced, so the stamp
             must name a real generation file (404 otherwise), and a board
             whose live file is gone answers the V2 read half's own 404. The
             guards mirror the version route exactly: 13-digit stamp regex
             BEFORE the name is concatenated, resolved-path assert after —
             the same traversal layers, the same answers. The label is
             trimmed, ≤80 chars; '' is LEGAL (pinned without a name — the
             pin is the label slot). The cap counts pins, not edits: a
             re-label of an already-pinned stamp is always a 200, a NEW pin
             at cap HISTORY_PIN_KEEP is a 409 carrying the count. */
          if ((method === 'PUT' || method === 'DELETE') && seg[3] === 'history' && seg[5] === 'label') {
            const stamp = seg[4];
            if (stamp === undefined || !/^\d{13}$/.test(stamp)) return send(400, {error: 'invalid stamp'});
            const versionFile = path.resolve(HISTORY_DIR, `${id}.${stamp}.json`);
            if (!versionFile.startsWith(HISTORY_DIR + path.sep)) return send(400, {error: 'invalid path'});
            if (!fs.existsSync(versionFile)) return send(404, {error: 'not found'});
            if (!readBoard(id)) return send(404, {error: 'not found'});
            const labelsFile = path.join(HISTORY_DIR, `${id}.labels.json`);
            const labels = readLabelsSidecar(HISTORY_DIR, id);
            const entry = labels[stamp];
            const isPin = !!(entry && typeof entry === 'object' && !Array.isArray(entry));
            if (method === 'DELETE') {
              if (!isPin) return send(404, {error: 'not pinned'});
              delete labels[stamp];
              try {
                fs.mkdirSync(HISTORY_DIR, {recursive: true});
                writeJsonAtomic(labelsFile, labels);
              } catch (e: any) { return send(500, {error: String(e)}); }
              return send(200, {ok: true, pinned: pinCountOf(labels)});
            }
            let body: any;
            try {
              body = JSON.parse(await readBody(req));
            } catch (e: any) {
              return send(e === 'too_large' ? 413 : 400, {error: e === 'too_large' ? 'body too large' : 'invalid JSON'});
            }
            if (typeof body?.label !== 'string') return send(400, {error: 'label must be a string'});
            const label = body.label.trim();
            if (label.length > 80) return send(400, {error: 'label must be at most 80 characters'});
            if (!isPin && pinCountOf(labels) >= HISTORY_PIN_KEEP) {
              return send(409, {error: `pin cap reached (${HISTORY_PIN_KEEP})`, pinned: pinCountOf(labels)});
            }
            labels[stamp] = {...(isPin ? entry : {}), label};
            try {
              fs.mkdirSync(HISTORY_DIR, {recursive: true});
              writeJsonAtomic(labelsFile, labels);
            } catch (e: any) { return send(500, {error: String(e)}); }
            return send(200, {ok: true, pinned: pinCountOf(labels)});
          }

          // GET /api/boards/:id
          if (method === 'GET') {
            const doc = readBoard(id);
            if (!doc) return send(404, {error: 'not found'});
            return send(200, {...doc, id: doc.id ?? id, name: doc.name ?? 'Untitled'});
          }

          // PUT /api/boards/:id
          if (method === 'PUT') {
            let doc: any;
            try {
              doc = JSON.parse(await readBody(req));
            } catch (e: any) {
              return send(e === 'too_large' ? 413 : 400, {error: e === 'too_large' ? 'body too large' : 'invalid JSON'});
            }
            const err = validateDoc(doc);
            if (err) return send(400, {error: err});
            // AS-4 — a PUT on a board that does not exist must NOT resurrect
            // it: after a DELETE (possibly from another tab), an in-flight or
            // debounced autosave used to re-create the file from the writer's
            // stale copy. 404 — the same answer GET and DELETE give for the
            // same condition — after body validation, before any write, so no
            // file and no .bak ever appears for a missing id.
            const prev = readBoard(id);
            if (!prev) return send(404, {error: 'not found'});
            fs.mkdirSync(BOARDS_DIR, {recursive: true});
            const out = {
              id, name: typeof doc.name === 'string' ? doc.name : (prev?.name ?? 'Untitled'),
              nodes: doc.nodes, edges: doc.edges, updatedAt: Date.now(),
              // L2: keep board metadata on the document (old boards have none).
              ...(typeof doc.preset === 'string' ? {preset: doc.preset}
                : typeof prev?.preset === 'string' ? {preset: prev.preset} : null),
              // PACKAGE-M fix — a board no longer stores a theme: the preset
              // suggests one and the user's global preference wins. We still
              // READ a legacy `theme` off old files (GET path) but never WRITE
              // it back, so a re-save drops the stale key. Do not restore the
              // `doc.theme`/`prev.theme` forward here.
              ...(typeof doc.legend === 'boolean' ? {legend: doc.legend} : null),
              /* BOARD-STYLE (2026-11-09) — the board's own table style + density.
                 Absent on boards authored before the round: kept absent (the
                 reader falls back to the Settings default), and a re-save of an
                 old board never invents a value. */
              ...(typeof doc.style === 'string' ? {style: doc.style}
                : typeof prev?.style === 'string' ? {style: prev.style} : null),
              ...(typeof doc.density === 'string' ? {density: doc.density}
                : typeof prev?.density === 'string' ? {density: prev.density} : null),
            };
            // AS-6 — ONE `.bak` generation before the new document lands, the
            // exact treatment the library document already gets above: the
            // endpoint is unauthenticated and un-merged, so a bad write (an
            // emptied canvas, a stale tab) must not destroy the ONLY copy of a
            // board. The backup holds the PREVIOUS generation; the write below
            // is atomic (temp + rename).
            //
            // HISTORY-V1 — a save SAMPLES a checkpoint instead of shadowing
            // every write. The ring used to count saves (a full ten
            // generations could span 23 seconds — measured), so one autosave
            // burst erased the state before it. A generation is taken only
            // when the bytes about to be written differ from the live file's
            // raw bytes AND the sampling gap has passed since this board's
            // newest stored generation (src/board/historyPolicy.ts owns the
            // number; the newest stamp comes from a readdir + name scan —
            // no index file). A body carrying historyReason 'pre-restore'
            // bypasses the gap: the restore itself must land in history. A
            // save is never blocked by its history — a checkpoint failure is
            // logged once and the write proceeds. Pruning is generational
            // (10 ring + 14 daily + 4 pins, per board, oldest-first, no
            // global cap; scripts/boardRetention.mjs + the policy module own
            // it), and the .bak rotation + writeJsonAtomic below are
            // unchanged.
            if (fs.existsSync(file)) {
              fs.mkdirSync(HISTORY_DIR, {recursive: true});
              try {
                const prevRaw = fs.readFileSync(file);
                const outRaw = Buffer.from(JSON.stringify(out, null, 2), 'utf8');
                if (shouldCheckpoint({
                      now: Date.now(),
                      newestStamp: newestHistoryStamp(HISTORY_DIR, id),
                      bytesDiffer: !outRaw.equals(prevRaw),
                      reason: doc.historyReason,
                    })) {
                  const stamp = nextHistoryStamp(HISTORY_DIR, id);
                  fs.copyFileSync(file, path.join(HISTORY_DIR, `${id}.${stamp}.json`));
                }
              } catch (e: any) {
                console.warn('[boards] history checkpoint skipped:', e?.message ?? e);
              }
              fs.renameSync(file, `${file}.bak`);
            }
            writeJsonAtomic(file, out);
            pruneBoardHistory(HISTORY_DIR, {log: (m: string) => console.warn(m)});
            return send(200, out);
          }

          // DELETE /api/boards/:id — AS-7: ARCHIVE, never unlink. This endpoint
          // is unauthenticated and un-merged: the incident of 2026-10-21 (a
          // worker's probe sweep deleted the live board; only the one-.bak
          // generation saved it) showed any caller that sweeps the board list
          // can destroy a real board. The file is RENAMED to
          // `<id>.deleted-<UTC-stamp>.json` instead, so every delete leaves a
          // recoverable artefact and no code path here removes the board's
          // bytes. BOARD-RETENTION (t_59671f6a) now bounds the archive class:
          // a fresh tombstone always survives; stale/orphaned tombstones and
          // .baks are pruned by scripts/boardRetention.mjs (see that file for
          // the policy; scripts/purge-deleted-boards.mjs remains the explicit
          // human tool). The sweep is deferred and unref'd — the response
          // never waits on it.
          if (method === 'DELETE') {
            if (!fs.existsSync(file)) return send(404, {error: 'not found'});
            const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
            const archive = path.join(BOARDS_DIR, `${id}.deleted-${stamp}.json`);
            try {
              fs.renameSync(file, archive);
            } catch (e: any) {
              return send(500, {error: String(e)});
            }
            /* HARNESS-ISOLATION-2 F2 — the board is gone, so its ten history
               generations go with it: the tombstone above is the recovery copy
               (the same rule the `.bak` class follows). Without this a harness
               night of one-shot scratch boards leaves ten files per board
               forever. Only exact `<id>.<epoch-ms>.json` names can go. */
            try {
              dropBoardHistory(HISTORY_DIR, id);
            } catch (e: any) {
              console.warn('[boards] history drop failed:', e?.message ?? e);
            }
            scheduleRetentionSweep();
            return send(200, {ok: true, archived: path.basename(archive)});
          }

          return send(405, {error: 'method not allowed'});
        })().catch((e: any) => send(500, {error: String(e)}));
  });
  };
  return {
    name: 'diagram-studio-boards-api',
    configureServer(server) {
      // keep drawings out of version control
      const gi = path.resolve(__dirname, '.gitignore');
      try {
        const cur = fs.existsSync(gi) ? fs.readFileSync(gi, 'utf8') : '';
        if (!/^boards\/$/m.test(cur)) fs.writeFileSync(gi, cur + (cur.endsWith('\n') || !cur ? '' : '\n') + 'boards/\n');
      } catch { /* best effort */ }
      registerMiddlewares(server);
    },
    /* AS-4 — release parity: `npm run preview` serves the same API. */
    configurePreviewServer(server) {
      registerMiddlewares(server);
    },
  };
}

/* ROUND PWA — stamp the service worker's cache name at build time.
 * public/sw.js carries the placeholder `__SW_CACHE_VERSION__`; APP_VERSION
 * comes from src/settings/version.ts (the single source of truth) and the
 * short hash from the BUILT index.html bytes, so a version bump OR any
 * content change rotates the cache name `gobigrams-v<version>-<hash>` and
 * the worker's activate pass deletes the old generation. public/ files are
 * copied verbatim by Vite AFTER the bundle is written, so the stamp runs in
 * closeBundle on dist/sw.js directly. NO new npm deps. */
function swCacheStamp(): Plugin {
  const VERSION_FILE = path.resolve(__dirname, 'src/settings/version.ts');
  let outDir = 'dist';
  return {
    name: 'gobigrams-sw-cache-stamp',
    configResolved(config) {
      outDir = path.resolve(config.root, config.build.outDir);
    },
    closeBundle() {
      const swFile = path.join(outDir, 'sw.js');
      const htmlFile = path.join(outDir, 'index.html');
      if (!fs.existsSync(swFile) || !fs.existsSync(htmlFile)) return;
      const sw = fs.readFileSync(swFile, 'utf8');
      if (!sw.includes('__SW_CACHE_VERSION__')) return; // already stamped (watch rebuild)
      const m = fs.readFileSync(VERSION_FILE, 'utf8').match(/APP_VERSION\s*=\s*'([^']+)'/);
      if (!m) throw new Error('APP_VERSION not found in src/settings/version.ts');
      const hash = crypto.createHash('sha256').update(fs.readFileSync(htmlFile)).digest('hex').slice(0, 8);
      fs.writeFileSync(swFile, sw.replaceAll('__SW_CACHE_VERSION__', `${m[1]}-${hash}`));
    },
  };
}

export default defineConfig({
  plugins: [react(), boardsApi(), swCacheStamp()],
  server: {host: '0.0.0.0', port: 5200, strictPort: true},
  /* ROUND GOBI-S2 — a SECOND html entry: /embed (the iframe-embedding
     renderer). The two entries' module graphs share chunks, so the main
     index chunk does not grow by a byte (harness round-gobi-embed E6). */
  build: {
    rollupOptions: {
      input: {
        index: path.resolve(__dirname, 'index.html'),
        embed: path.resolve(__dirname, 'embed.html'),
      },
    },
  },
});