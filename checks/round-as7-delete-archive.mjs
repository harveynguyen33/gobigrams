#!/usr/bin/env node
/**
 * ROUND AS-7 harness — DELETE /api/boards/:id is ARCHIVE-NOT-UNLINK.
 *
 * INCIDENT (2026-10-21, twice): a worker's probe sweep called the boards API's
 * DELETE and Harvey's live board was gone — the handler was a bare
 * `fs.unlinkSync(file)`. The contract after the fix: a DELETE moves the board
 * file to `boards/<id>.deleted-<UTC-stamp>.json` and NEVER removes bytes; only
 * scripts/purge-deleted-boards.mjs (dry-run by default) removes archives, and
 * only ones older than a stated age.
 *
 * BEHAVIOURAL, DOM-free, and NEVER touching the real boards/: `vite.config.ts`
 * is bundled with the project's own esbuild into a scratch CJS file, the
 * BOARDS_DIR literal is patched to a scratch directory (same technique as
 * checks/round-as-boards-put.mjs), and the middleware is driven against
 * fake ServerResponse-shaped stubs. scripts/purge-deleted-boards.mjs is
 * driven as a real subprocess against the same scratch dir.
 *
 * HARVEY'S BOARD GUARD: this harness runs entirely inside a tmpdir. It never
 * issues a DELETE against `mvaf8pkt162b2aed`; the live-behaviour proof on the
 * real server uses a fresh probe id created and deleted by this round's
 * driver, never the real board's id.
 *
 * WHAT THIS CANNOT SEE: a browser. The client contract (HTTP 200 `{ok:true}`,
 * `err.status` on failure) is proven at the transport seam here; the click
 * path through the boards dialog is the reviewer's live pass, as in every
 * round.
 */
import {writeFileSync, readFileSync, rmSync, mkdirSync, existsSync, readdirSync} from 'node:fs';
import {join, dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';
import {tmpdir} from 'node:os';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';

const HERE = dirname(fileURLToPath(import.meta.url));
const REAL_ROOT = join(HERE, '..');
const ROOT = process.env.AS_ROOT || REAL_ROOT;

const results = [];
const assert = (id, pass, detail = '') => {
  results.push({id, pass: !!pass, detail});
  console.log(`  ${pass ? 'PASS' : 'FAIL'}  ${id}  —  ${detail}`);
};

console.log('ROUND AS-7 — DELETE archives instead of unlinking (driven, DOM-free)');
console.log(`  target root: ${ROOT}`);

/* ---------------------------------------------------------------- bundle -- */
/* Same shape-guard as round-as-boards-put.mjs: patch the BOARDS_DIR literal in
   the bundled module, never the real one. */
const BOARDSDIR = join(tmpdir(), `as7-boards-${process.pid}`);
rmSync(BOARDSDIR, {recursive: true, force: true});
mkdirSync(BOARDSDIR, {recursive: true});
const ENTRY = join(tmpdir(), `.as7-entry-${process.pid}.mjs`);
const OUT = join(tmpdir(), `.as7-out-${process.pid}.cjs`);
writeFileSync(ENTRY, `import cfg from ${JSON.stringify(join(ROOT, 'vite.config.ts'))};\nexport default cfg;\n`);
let bundled = execFileSync(join(REAL_ROOT, 'node_modules/.bin/esbuild'),
  [ENTRY, '--bundle', '--platform=node', '--format=cjs', '--log-level=error',
    '--external:vite', '--external:@vitejs/plugin-react'],
  {encoding: 'utf8', cwd: REAL_ROOT});
const assignRe = /BOARDS_DIR\s*=\s*import_\w+\.default\.resolve\(__dirname,\s*"boards"\)/;
if (!assignRe.test(bundled)) {
  console.error('bundle shape changed — BOARDS_DIR literal not found; refusing to guess');
  process.exit(2);
}
bundled = bundled.replace(assignRe, `BOARDS_DIR = ${JSON.stringify(BOARDSDIR)}`);
const require_ = createRequire(join(REAL_ROOT, 'package.json'));
writeFileSync(OUT, bundled.replace('module.exports =',
  `module.paths.unshift(${JSON.stringify(join(REAL_ROOT, 'node_modules'))});\nmodule.exports =`));
const cfg = require_(OUT).default;
rmSync(ENTRY, {force: true});
rmSync(OUT, {force: true});
const plug = (cfg.plugins ?? []).find(p => p && p.name === 'diagram-studio-boards-api');

/* --------------------------------------------------------------- driver --- */
const fakeRes = () => ({statusCode: 0, headers: {}, body: null,
  setHeader() {}, end(b) { this.body = b === undefined ? null : String(b); }, destroy() {}});
const drive = async (plug, method, url, body) => {
  let mw;
  await plug.configureServer({middlewares: {use: fn => { mw = fn; }}});
  const res = fakeRes();
  const req = {method, url, destroy() {}, __nexted: false};
  req.on = (ev, fn) => {
    if (ev === 'data' && body !== undefined) setImmediate(() => fn(Buffer.from(body)));
    if (ev === 'end') setImmediate(fn);
    return req;
  };
  try { await mw(req, res, () => { req.__nexted = true; }); } catch (e) { res.error = String(e?.message ?? e); }
  await new Promise(r => setImmediate(() => setImmediate(r)));
  return {res, req};
};
const boardPath = id => join(BOARDSDIR, `${id}.json`);
const sha256 = p => createHash('sha256').update(readFileSync(p)).digest('hex');
const listArchives = id => readdirSync(BOARDSDIR).filter(f =>
  f.startsWith(`${id}.deleted-`) && f.endsWith('.json'));

/* ===========================================================================
 * §A — the DELETE itself: archive-not-unlink, byte-exact.
 * =========================================================================== */
/* create a probe board through the API's own POST route */
const created = await drive(plug, 'POST', '/api/boards', JSON.stringify({name: 'as7-probe'}));
const probeId = created.res.statusCode === 201 ? JSON.parse(created.res.body).id : null;
if (!probeId) {
  console.error(`POST /api/boards failed: HTTP ${created.res.statusCode} ${created.res.body}`);
  process.exit(1);
}
const bytesBefore = readFileSync(boardPath(probeId));
const sumBefore = createHash('sha256').update(bytesBefore).digest('hex');

const del = await drive(plug, 'DELETE', `/api/boards/${probeId}`, undefined);
assert('as7.a1.delete-still-200-ok', del.res.statusCode === 200,
  `DELETE probe -> HTTP ${del.res.statusCode} ${del.res.body}`);

const liveGone = !existsSync(boardPath(probeId));
assert('as7.a2.live-file-gone', liveGone,
  liveGone ? '<id>.json no longer exists after DELETE' : '<id>.json STILL EXISTS after DELETE');

const archives = listArchives(probeId);
assert('as7.a3.archive-exists', archives.length === 1,
  archives.length === 1 ? `archive: ${archives[0]}` : `archives found: ${archives.length ? archives.join(', ') : 'NONE'}`);

const ARCHIVE_RE = new RegExp(`^${probeId}\\.deleted-\\d{8}T\\d{6}Z\\.json$`);
assert('as7.a4.archive-name-shape', archives.length === 1 && ARCHIVE_RE.test(archives[0]),
  archives.length === 1 ? `name ${archives[0]} matches <id>.deleted-<ISO8601-UTC>.json` : 'no archive to name-check');

let sumAfter = null;
if (archives.length === 1) sumAfter = sha256(join(BOARDSDIR, archives[0]));
assert('as7.a5.archive-bytes-identical', sumAfter === sumBefore,
  sumAfter === sumBefore
    ? `sha256 before == after (${sumBefore.slice(0, 16)}…)`
    : `sha256 before ${sumBefore.slice(0, 16)}… vs after ${sumAfter ? sumAfter.slice(0, 16) + '…' : 'NO FILE'}`);

assert('as7.a6.no-unlink-anywhere', (() => {
  const src = readFileSync(join(ROOT, 'vite.config.ts'), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, m => m.replace(/[^\n]/g, ' '))
    .replace(/(^|[^:])\/\/[^\n]*/g, (m, p1) => p1 + ' '.repeat(m.length - p1.length));
  return !src.includes('unlinkSync') && !src.includes('rmSync');
})(), 'vite.config.ts source (comments blanked) carries no unlinkSync/rmSync');

/* the archive is NOT a board: GET /api/boards must not list it */
const list = await drive(plug, 'GET', '/api/boards', undefined);
const listed = list.res.statusCode === 200 ? JSON.parse(list.res.body) : [];
assert('as7.a7.archive-not-listed', !listed.some(b => b.id === probeId),
  `GET /api/boards after DELETE -> ${listed.length} board(s), probe absent: ${!listed.some(b => b.id === probeId)}`);

/* ===========================================================================
 * §B — the untouched contracts: 404s behave exactly as before AS-7.
 * =========================================================================== */
const delMissing = await drive(plug, 'DELETE', '/api/boards/as7-gone', undefined);
assert('as7.b1.delete-missing-still-404', delMissing.res.statusCode === 404,
  `DELETE missing -> HTTP ${delMissing.res.statusCode} ${delMissing.res.body}`);

const putMissing = await drive(plug, 'PUT', '/api/boards/as7-gone', JSON.stringify({name: 'x', nodes: [], edges: []}));
assert('as7.b2.put-missing-still-404', putMissing.res.statusCode === 404,
  `PUT missing -> HTTP ${putMissing.res.statusCode} (AS-4 rule intact)`);

const getMissing = await drive(plug, 'GET', '/api/boards/as7-gone', undefined);
assert('as7.b3.get-missing-still-404', getMissing.res.statusCode === 404,
  `GET missing -> HTTP ${getMissing.res.statusCode}`);

/* a second DELETE on the SAME id (archive already on disk) must not conjure
   a board back nor clobber the first archive */
const delAgain = await drive(plug, 'DELETE', `/api/boards/${probeId}`, undefined);
const archivesAfterAgain = listArchives(probeId);
assert('as7.b4.second-delete-404-and-archive-untouched',
  delAgain.res.statusCode === 404 && archivesAfterAgain.length === 1
    && sha256(join(BOARDSDIR, archivesAfterAgain[0])) === sumBefore,
  `second DELETE -> HTTP ${delAgain.res.statusCode}, archive count ${archivesAfterAgain.length}, bytes intact`);

/* PUT on a missing id must not resurrect anything either (no new files) */
const filesNow = readdirSync(BOARDSDIR).filter(f => f.startsWith('as7-gone'));
assert('as7.b5.no-resurrection-files', filesNow.length === 0,
  `files matching the missing id: ${filesNow.length ? filesNow.join(', ') : 'none'}`);

/* ===========================================================================
 * §C — scripts/purge-deleted-boards.mjs: DRY-RUN BY DEFAULT, age-bounded.
 * =========================================================================== */
const PURGE = join(REAL_ROOT, 'scripts/purge-deleted-boards.mjs');
let purgeRuns = false;
try { execFileSync(process.execPath, [PURGE, '--help'], {encoding: 'utf8'}); purgeRuns = true; }
catch (e) { purgeRuns = e.status !== undefined; }
assert('as7.c1.purge-script-exists', existsSync(PURGE) && purgeRuns,
  `scripts/purge-deleted-boards.mjs exists and is a runnable node script`);

/* an OLD archive (timestamp in the name, 2020) and the fresh probe archive */
const oldName = 'as7-old.deleted-20200101T000000Z.json';
writeFileSync(join(BOARDSDIR, oldName), '{"old":true}');
const dry = execFileSync(process.execPath, [PURGE, '--dir', BOARDSDIR], {encoding: 'utf8'});
const dryKept = existsSync(join(BOARDSDIR, oldName)) && archives.length === 1
  && existsSync(join(BOARDSDIR, archives[0]));
assert('as7.c2.dry-run-deletes-nothing', dryKept,
  `dry run removed nothing (old archive present: ${existsSync(join(BOARDSDIR, oldName))}, probe archive present: ${existsSync(join(BOARDSDIR, archives[0] ?? 'x'))})`);
assert('as7.c3.dry-run-names-victims', dry.includes(oldName),
  'dry-run output names the archive it WOULD delete');

const applied = execFileSync(process.execPath,
  [PURGE, '--dir', BOARDSDIR, '--apply', '--older-than', '30d'], {encoding: 'utf8'});
const oldGone = !existsSync(join(BOARDSDIR, oldName));
const freshKept = archives.length === 1 && existsSync(join(BOARDSDIR, archives[0]));
assert('as7.c4.apply-removes-only-old', oldGone && freshKept,
  `--apply --older-than 30d: old archive gone: ${oldGone}, fresh archive kept: ${freshKept}`);

/* the real boards/ dir must hold no stray AS-7 artefacts from THIS run
   (the harness never wrote there — this is the belt, not the proof) */
const realDir = join(ROOT, 'boards');
const realStray = existsSync(realDir)
  ? readdirSync(realDir).filter(f => f.startsWith('as7-'))
  : [];
assert('as7.c5.real-boards-untouched', realStray.length === 0,
  realStray.length === 0 ? 'no as7-* artefacts in the real boards/' : `STRAY: ${realStray.join(', ')}`);

rmSync(BOARDSDIR, {recursive: true, force: true});

const failed = results.filter(r => !r.pass);
console.log(failed.length === 0 ? '\nALL GREEN' : `\n${failed.length} FAILURE(S)`);
process.exit(failed.length === 0 ? 0 : 1);
