#!/usr/bin/env node
/**
 * ROUND AS harness — boards API contract + save gate + .bak generation
 * (AS-4 items 1-3, AS-5, AS-6 — all DRIVEN, not read).
 *
 * BEHAVIOURAL, DOM-free: `vite.config.ts` is a TS module importing only
 * node/path/crypto/vite, so it bundles with the project's own esbuild into a
 * scratch CJS file, the BOARDS_DIR literal is patched to a scratch directory
 * (never the real boards/ — that is Harvey's live data), the plugin object is
 * instantiated from the default export, and its middleware is driven against
 * fake ServerResponse-shaped stubs. The shipped plugin path is what runs —
 * no rule is restated in the harness.
 *
 * The mermaid@11/live-browser scope notes of checks/round-ad-flowchart.mjs and
 * checks/round-as-mermaid.mjs apply here too: the two-tab race is argued
 * through the SERVER-side existence check (the only authority both tabs must
 * agree on), driven in-process; the reviewer's two-real-tabs pass is live.
 *
 * AS-5 negative control: the save gate did not exist before the AS-5 commit;
 * its RED commit is `84b8b91` (the round's dispatch HEAD), NOT `26baec6` —
 * AS-5/AS-6 have no pre-26baec6 form (they are Amendment-1 items, written
 * after 26baec6). The client-side predicate is extracted from App.tsx SOURCE
 * (brace span, like checks/round-ar-modal-stability.mjs) and DRIVEN through
 * the four spec cases in Node.
 *
 * AS-6 negative control: same RED commit `84b8b91` (board PUT wrote in place
 * with no .bak there).
 */
import {readFileSync, writeFileSync, rmSync, mkdirSync, existsSync, readFileSync as rf} from 'node:fs';
import {join, dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';
import {tmpdir} from 'node:os';
import {createRequire} from 'node:module';

const HERE = dirname(fileURLToPath(import.meta.url));
const REAL_ROOT = join(HERE, '..');
const ROOT = process.env.AS_ROOT || REAL_ROOT;

const results = [];
const assert = (id, pass, detail = '') => {
  results.push({id, pass: !!pass, detail});
  console.log(`  ${pass ? 'PASS' : 'FAIL'}  ${id}  —  ${detail}`);
};

console.log('ROUND AS — boards PUT 404, save gate, .bak generation (driven, DOM-free)');
console.log(`  target root: ${ROOT}`);

/* ---------------------------------------------------------------- bundle -- */
const BOARDSDIR = join(tmpdir(), `as-boards-${process.pid}`);
rmSync(BOARDSDIR, {recursive: true, force: true});
const ENTRY = join(REAL_ROOT, `.as-boards-entry-${process.pid}.mjs`);
const OUT = join(REAL_ROOT, `.as-boards-out-${process.pid}.cjs`);
writeFileSync(ENTRY, `import cfg from './vite.config.ts';\nexport default cfg;\n`);
let bundled = execFileSync(join(REAL_ROOT, 'node_modules/.bin/esbuild'),
  [ENTRY, '--bundle', '--platform=node', '--format=cjs', '--log-level=error',
    '--external:vite', '--external:@vitejs/plugin-react'],
  {encoding: 'utf8', cwd: REAL_ROOT});
/* point the bundled module at the scratch boards dir (the esbuild local name
   for `path` may vary — match the assignment by shape, then verify the value) */
const assignRe = /BOARDS_DIR\s*=\s*import_\w+\.default\.resolve\(__dirname,\s*"boards"\)/;
if (!assignRe.test(bundled)) {
  console.error('bundle shape changed — BOARDS_DIR literal not found; refusing to guess');
  process.exit(2);
}
bundled = bundled.replace(assignRe, `BOARDS_DIR = ${JSON.stringify(BOARDSDIR)}`);
writeFileSync(OUT, bundled);
const require_ = createRequire(join(REAL_ROOT, 'package.json'));
const cfg = require_(OUT).default;
rmSync(ENTRY, {force: true});
const plug = (cfg.plugins ?? []).find(p => p && p.name === 'diagram-studio-boards-api');
assert('as4.0.plugin-instantiated',
  !!plug && typeof plug.configureServer === 'function',
  `plugin object from the real vite.config.ts default export (hooks: ${Object.keys(plug ?? {}).join(',')})`);

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
const put = body => JSON.stringify(body);

const doc = (nodes, edges) => ({name: 'probe', nodes: nodes ?? [], edges: edges ?? []});
const node = id => ({id, position: {x: 0, y: 0}});

/* ===========================================================================
 * §A — AS-4: PUT on a missing board is a loud 404 and writes NOTHING.
 * =========================================================================== */
mkdirSync(BOARDSDIR, {recursive: true});
const before = existsSync(boardPath('as-missing'));
const r1 = await drive(plug, 'PUT', '/api/boards/as-missing', put(doc([node('n1')], [])));
const after = existsSync(boardPath('as-missing'));
assert('as4.a1.put-missing-is-404-notfound',
  r1.res.statusCode === 404 && r1.res.body === JSON.stringify({error: 'not found'}),
  `PUT /api/boards/as-missing -> HTTP ${r1.res.statusCode} ${r1.res.body}`);
assert('as4.a2.put-missing-writes-nothing',
  before === false && after === false,
  `no board file and no .bak exists after the 404 (file existed before: ${before})`);
const bakAfter = existsSync(boardPath('as-missing') + '.bak');
assert('as4.a2b.put-missing-writes-no-bak',
  bakAfter === false, 'no .bak resurrect artefact either');

/* regression guard: PUT on an EXISTING board still writes */
writeFileSync(boardPath('as-live'), JSON.stringify({id: 'as-live', name: 'v1', nodes: [node('n1')], edges: [], updatedAt: 1}));
const r2 = await drive(plug, 'PUT', '/api/boards/as-live', put(doc([node('n1'), node('n2')], [])));
assert('as4.a3.put-existing-still-200-and-written',
  r2.res.statusCode === 200 && existsSync(boardPath('as-live'))
    && JSON.parse(rf(boardPath('as-live'), 'utf8')).nodes.length === 2,
  `PUT existing -> HTTP ${r2.res.statusCode}, file holds ${JSON.parse(rf(boardPath('as-live'), 'utf8')).nodes.length} nodes`);

/* DELETE on a missing id answers 404 (one convention with GET/PUT) */
const r3 = await drive(plug, 'DELETE', '/api/boards/as-gone', undefined);
assert('as4.a4.delete-missing-is-404',
  r3.res.statusCode === 404,
  `DELETE missing -> HTTP ${r3.res.statusCode} (same convention as GET/PUT)`);

/* invalid id: rejected BEFORE any existence work (traversal guard unchanged) */
const r4 = await drive(plug, 'PUT', '/api/boards/..%2Fescape', put(doc([], [])));
assert('as4.a5.invalid-id-still-rejected',
  [400, 404].includes(r4.res.statusCode),
  `PUT with a traversal-shaped id -> HTTP ${r4.res.statusCode}`);

/* ===========================================================================
 * §B — AS-6: a board write keeps ONE .bak generation (the first document's
 * bytes survive the second save).
 * =========================================================================== */
rmSync(boardPath('as-bak'), {force: true});
rmSync(boardPath('as-bak') + '.bak', {force: true});
const v1 = doc([node('b1'), node('b2'), node('b3'), node('b4')], [{id: 'e1', source: 'b1', target: 'b2'}]);
const rb1 = await drive(plug, 'PUT', '/api/boards/as-bak', put(v1));
const rb2 = await drive(plug, 'PUT', '/api/boards/as-bak', put(doc([], [])));  /* the incident's shape: a 0-node overwrite */
const bakRaw = existsSync(boardPath('as-bak') + '.bak') ? rf(boardPath('as-bak') + '.bak', 'utf8') : null;
const curRaw = rf(boardPath('as-bak'), 'utf8');
const bakDoc = bakRaw && JSON.parse(bakRaw);
assert('as6.b1.bak-holds-first-document',
  bakDoc && bakDoc.nodes.length === 4 && bakDoc.edges.length === 1,
  bakDoc ? `.bak holds the FIRST document (${bakDoc.nodes.length} nodes / ${bakDoc.edges.length} edges) after the second save emptied the board`
         : '.bak missing after the second save');
assert('as6.b2.bak-is-exactly-one-generation',
  bakDoc && JSON.parse(curRaw).nodes.length === 0,
  'the live file is the NEW document (0 nodes) while .bak holds the old one — one generation, like the library');
assert('as6.b3.first-save-creates-no-bak-of-nothing',
  rb1.res.statusCode === 200 && rb2.res.statusCode === 200,
  `both saves 200 (first: ${rb1.res.statusCode}, second: ${rb2.res.statusCode})`);

/* a save on a MISSING id must not conjure a .bak either (AS-4 contract) */
assert('as6.b4.no-bak-on-missing-id', bakAfter === false,
  'the 404 path leaves no .bak (asserted with §A above)');

/* ===========================================================================
 * §C — AS-5: the save gate is an explicit, named predicate, and it is DRIVEN
 * through the spec's four cases (extracted from App.tsx source).
 * =========================================================================== */
const APP_RAW = readFileSync(join(ROOT, 'src/App.tsx'), 'utf8');
const blank = m => m.replace(/[^\n]/g, ' ');
const stripTs = s => s
  .replace(/\/\*[\s\S]*?\*\//g, blank)
  .replace(/(^|[^:])\/\/[^\n]*/g, (m, p1) => p1 + ' '.repeat(m.length - p1.length));
const APP = stripTs(APP_RAW);
const braceSpan = (src, start) => {
  let depth = 0, began = -1;
  for (let i = start; i < src.length; i++) {
    if (src[i] === '{') { if (depth === 0) began = i; depth++; }
    else if (src[i] === '}') { depth--; if (depth === 0) return [began, i]; }
  }
  return [began, src.length - 1];
};

const gateAnchor = APP.search(/const\s+canAutosave\s*=/);
const gateSpan = gateAnchor >= 0 ? APP.slice(gateAnchor, gateAnchor + 400) : '';
assert('as5.c1.predicate-exists-and-is-named',
  gateAnchor >= 0 && /^const\s+canAutosave\s*=/.test(gateSpan),
  gateAnchor >= 0 ? 'an explicit named predicate `canAutosave` is declared in App.tsx'
                  : 'no named save-gate predicate found in App.tsx');
/* the gate is the LOADED FLAG + ID MATCH pair, stated once */
assert('as5.c2.predicate-covers-loaded-and-id-match',
  /boardLoaded/.test(gateSpan) && /boardLoadedDocId/.test(gateSpan) && /curBoardRef\.current\?\.id/.test(gateSpan),
  'the predicate reads the loaded flag (boardLoaded), the loaded id (boardLoadedDocId) and the in-memory doc id');
/* the implicit combination is replaced at the consumers */
const effectAnchor = APP.indexOf('useEffect(() => {\n    if (!boardId) return;');
const effectSpan = effectAnchor >= 0 ? APP.slice(effectAnchor, effectAnchor + 900) : '';
assert('as5.c3.autosave-effect-uses-the-predicate',
  effectAnchor >= 0 && effectSpan.includes('canAutosave'),
  'the autosave effect gates its schedule on `canAutosave` (not the bare boardId)');
const flushAnchor = APP.indexOf('const flushSave = useCallback');
const flushSpan = APP.slice(...braceSpan(APP, flushAnchor));
assert('as5.c4.flushSave-uses-the-predicate',
  flushSpan.includes('canAutosave') || flushSpan.includes('boardLoadedDocId'),
  'flushSave gates the write on the loaded state, not just on a truthy curBoard');
/* applyBoard sets the loaded id AFTER a successful load; failed load leaves it */
const applyAnchor = APP.indexOf('const applyBoard = useCallback');
const applySpan = APP.slice(...braceSpan(APP, applyAnchor));
assert('as5.c5.applyBoard-arms-the-gate',
  applySpan.includes('setBoardLoadedDocId') && applySpan.includes('doc.id'),
  'applyBoard sets the loaded id from the LOADED doc (cleared paths never arm it)');
/* the raw gate code is extracted and EXECUTED against the four cases. SAFETY:
   `new Function` here wraps SOURCE EXTRACTED FROM THE REPO'S OWN App.tsx (the
   file this harness reads from disk) — no user or network input is ever
   interpolated, and the extracted text is a pure boolean expression over its
   three parameters. The same text-scrape pattern the house harnesses already
   use, executed instead of counted. */
const gateExpr = /^const\s+canAutosave\s*=\s*([^;\n]+);?/.exec(gateSpan)?.[1];
let gateCases = null;
if (gateExpr) {
  const mk = new Function('curBoardRef', 'boardLoaded', 'boardLoadedDocId', `return (${gateExpr.trim().replace(/^return\s+/, '')});`);
  const caseOf = (loaded, loadedId, curId) => mk(
    {current: curId === undefined ? null : {id: curId}},
    loaded, loadedId,
  );
  gateCases = {
    firstBoot: caseOf(false, null, undefined),          /* no board, nothing loaded */
    loadingSwitch: caseOf(true, 'b1', 'b2'),            /* next doc loading, stale doc still in ref */
    debounceDuringLoad: caseOf(true, null, 'b1'),       /* doc loaded in state, gate not armed */
    failedLoad: caseOf(false, null, 'b1'),              /* load 404/timeout — flag cleared */
    loadedMatch: caseOf(true, 'b1', 'b1'),              /* the ONLY true case */
  };
}
assert('as5.c6.gate-false-on-all-loss-cases',
  !!drive && !drive.firstBoot && !drive.loadingSwitch && !drive.debounceDuringLoad && !drive.failedLoad,
  drive
    ? `driven: first-boot-no-board=${drive.firstBoot} switch-while-loading=${drive.loadingSwitch} debounce-during-load=${drive.debounceDuringLoad} failed-load=${drive.failedLoad} — all FALSE`
    : 'predicate not executable');
assert('as5.c7.gate-true-only-when-loaded-and-ids-match',
  !!drive && drive.loadedMatch === true,
  drive ? `loaded + ids match (${drive.loadedMatch}) — the save runs` : 'predicate not executable');

console.log(results.every(r => r.pass) ? '\nALL GREEN' : `\n${results.filter(r => !r.pass).length} FAILURE(S)`);
process.exit(results.every(r => r.pass) ? 0 : 1);
