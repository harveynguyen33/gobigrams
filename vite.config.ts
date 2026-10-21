import {defineConfig, type Plugin} from 'vite';
import react from '@vitejs/plugin-react';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const BOARDS_DIR = path.resolve(__dirname, 'boards');
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
            };
            // AS-6 — ONE `.bak` generation before the new document lands, the
            // exact treatment the library document already gets above: the
            // endpoint is unauthenticated and un-merged, so a bad write (an
            // emptied canvas, a stale tab) must not destroy the ONLY copy of a
            // board. The backup holds the PREVIOUS generation; the write below
            // is atomic (temp + rename).
            if (fs.existsSync(file)) fs.renameSync(file, `${file}.bak`);
            writeJsonAtomic(file, out);
            return send(200, out);
          }

          // DELETE /api/boards/:id — AS-7: ARCHIVE, never unlink. This endpoint
          // is unauthenticated and un-merged: the incident of 2026-10-21 (a
          // worker's probe sweep deleted the live board; only the one-.bak
          // generation saved it) showed any caller that sweeps the board list
          // can destroy a real board. The file is RENAMED to
          // `<id>.deleted-<UTC-stamp>.json` instead, so every delete leaves a
          // recoverable artefact and no code path here removes bytes. The
          // archive stays until a human (or an explicit purge step,
          // scripts/purge-deleted-boards.mjs — dry-run by default) removes
          // archives older than a stated age. Nothing is ever deleted
          // automatically.
          if (method === 'DELETE') {
            if (!fs.existsSync(file)) return send(404, {error: 'not found'});
            const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
            const archive = path.join(BOARDS_DIR, `${id}.deleted-${stamp}.json`);
            try {
              fs.renameSync(file, archive);
            } catch (e: any) {
              return send(500, {error: String(e)});
            }
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

export default defineConfig({
  plugins: [react(), boardsApi()],
  server: {host: '0.0.0.0', port: 5200, strictPort: true},
});