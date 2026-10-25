#!/usr/bin/env node
/**
 * ROUND BN-3, ITEM 1 — the BN-2 hooks safety net.
 * checks/round-bn2-hooks.mjs
 *
 * WHAT THIS PROVES, in two halves:
 *
 *   STATIC half — for each of the six hooks extracted in ROUND BN-2
 *   (useUndoHistory, usePersistence, useConnections, useExportActions,
 *   useCanvasTools, useBoardsMenu):
 *     * the file exists;
 *     * it exports its hook (`export function <name>`);
 *     * App.tsx imports it from its own module.
 *   Plus the ROUND BJ invariant that survived the move: useExportActions
 *   statically imports NONE of the lazy export cluster — exportSvg,
 *   textOutline (and textOutlineHb), exportPng, printView, fontFiles may
 *   appear only inside dynamic import() (type-only imports are erased and
 *   allowed). A static import anywhere would fold the export chunk back
 *   into the main bundle.
 *
 *   LIVE half — ONE probe through the running dev server (the Playwright
 *   seam the round harnesses share): boot, board loads (nodes paint),
 *   selection works (click), and undo works (delete a node, click Undo,
 *   the node is back). This is the net the rest of BN-3's JSX moves fall
 *   into: if an extraction breaks boot, board load or history, this goes
 *   red before anything else runs.
 *
 * PROBE HYGIENE: a unique board via POST /api/boards + PUT, never the demo
 * board; cleanup rmSync's our own files only, never DELETE HTTP (the az
 * probe's rule). Set BN3_SKIP_LIVE=1 to run the static half alone (used by
 * the RED proof against an archived pre-BN2 root, where the live server
 * serves the CURRENT tree and would wrongly pass).
 *
 * RED-FIRST EVIDENCE: run against the pre-BN2 root (git archive of the
 * commit before the hook extractions) the static half fails on every hook
 * (file missing) — see the ROUND BN-3 commit message.
 *
 *   node checks/round-bn2-hooks.mjs   → exit 0 green, 1 red
 */
import {readFileSync, existsSync, rmSync} from 'node:fs';
import {join, dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, '..');
const read = (p) => readFileSync(join(REPO, p), 'utf8');

const fails = [];
const ok = (name, cond, detail = '') => {
  console.log(`${cond ? '  ok  ' : ' FAIL '} ${name}${detail ? `  —  ${detail}` : ''}`);
  if (!cond) fails.push(name);
};
/** Prose is not code: strip comments before asserting "this token must not
 *  appear" or the harness fails on its own header (boot-no-flash's rule). */
const stripComments = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/[^\n]*/g, '$1');

/* ---- STATIC half — the six BN-2 hooks ----------------------------------- */

const HOOKS = [
  ['useUndoHistory', 'src/useUndoHistory.ts'],
  ['usePersistence', 'src/usePersistence.ts'],
  ['useConnections', 'src/useConnections.ts'],
  ['useExportActions', 'src/useExportActions.ts'],
  ['useCanvasTools', 'src/useCanvasTools.ts'],
  ['useBoardsMenu', 'src/useBoardsMenu.ts'],
];

const app = read('src/App.tsx');
for (const [name, path] of HOOKS) {
  const present = existsSync(join(REPO, path));
  ok(`${path} exists`, present);
  if (!present) continue; /* RED on a pre-extraction root: fail the row, don't crash */
  const src = read(path);
  ok(`${name} exports its hook`, new RegExp(`export function ${name}\\b`).test(src));
  ok(`App.tsx imports ${name}`,
    new RegExp(`import\\s*\\{[^}]*\\b${name}\\b[^}]*\\}\\s*from\\s*'\\./${name}'`).test(app));
}

/* The lazy export cluster: these module specifiers may appear in
 * useExportActions ONLY inside dynamic import() (or erased type imports).
 * Remove type imports and every import(...) call, then none may remain. */
const CLUSTER = ['exportSvg', 'textOutline', 'textOutlineHb', 'exportPng', 'printView', 'fontFiles'];
const uxaPath = join(REPO, 'src/useExportActions.ts');
if (!existsSync(uxaPath)) {
  ok('useExportActions has NO static export-cluster import', false, 'src/useExportActions.ts is missing');
  ok('the lazy thunks still import() every cluster module', false, 'src/useExportActions.ts is missing');
} else {
const uxa = stripComments(read('src/useExportActions.ts'));
const stripped = uxa
  .replace(/import\s+type[^;]+;/g, '')            // type-only imports: erased at build
  .replace(/import\([^)]*\)/g, 'import()');       // dynamic imports: the allowed form
const residue = CLUSTER.filter((m) => new RegExp(`['"]\\.\\/${m}['"]`).test(stripped));
ok('useExportActions has NO static export-cluster import', residue.length === 0,
  residue.length ? `static specifier(s) remain: ${residue.join(', ')}` : `${CLUSTER.length} cluster modules, dynamic import() only`);
/* And the cluster is genuinely still wired lazily (a deletion must not
 * sneak past the residue check). */
const wired = CLUSTER.filter((m) => uxa.includes(`import('./${m}')`));
ok('the lazy thunks still import() every cluster module', wired.length === CLUSTER.length,
  `${wired.length}/${CLUSTER.length}: ${wired.join(', ')}`);
}

/* ---- LIVE half — boot, board load, undo ---------------------------------- */

const APP = process.env.BN3_APP_URL || 'http://localhost:5200/';
const SKIP_LIVE = !!process.env.BN3_SKIP_LIVE;

if (SKIP_LIVE) {
  console.log('  SKIP live probe (BN3_SKIP_LIVE=1 — RED runs against archived roots only)');
} else {
  const require_ = createRequire(join('/home/harvey/projects/tech-goblin/package.json', 'noop.js'));
  const {chromium} = require_('playwright-core');

  /* 2 nodes + 1 edge — just enough to prove paint, selection and history. */
  const board = {
    id: '', name: `BN3-PROBE-HOOKS-${Date.now()}`,
    nodes: [
      {id: 'p1', type: 'goblin', position: {x: 0, y: 0}, selected: false,
       style: {width: 190, height: 95}, measured: {width: 190, height: 95},
       data: {shape: 'service', title: 'Probe A', sub: 'rest', icon: 'server', colorKey: 'cyan'}},
      {id: 'p2', type: 'goblin', position: {x: 340, y: 40}, selected: false,
       style: {width: 190, height: 95}, measured: {width: 190, height: 95},
       data: {shape: 'database', kicker: 'database', title: 'Probe B', sub: 'pg', icon: 'database', colorKey: 'violet'}},
    ],
    edges: [{id: 'pe1', source: 'p1', target: 'p2', label: 'probe', data: {}}],
  };

  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({viewport: {width: 1400, height: 900}});
    /* First visit auto-starts the guided tour, whose overlay intercepts every
     * pointer event (measured on the first run). Mark it seen BEFORE the app
     * boots — the same key `tourFinished` writes — so the probe measures the
     * canvas, not the tour. */
    await page.addInitScript('try { localStorage.setItem("diagram-studio:tour-seen", "1"); } catch {}');
    const r = await page.request.post(`${APP}api/boards`, {data: {name: board.name}});
    board.id = (await r.json()).id;
    await page.request.put(`${APP}api/boards/${board.id}`, {data: board});
    try {
      await page.goto(`${APP}?board=${board.id}`, {waitUntil: 'networkidle'});
      await page.waitForSelector('.react-flow__node', {timeout: 15000});
      const painted = await page.locator('.react-flow__node').count();
      ok('bn3-live-board-loads', painted === 2, `${painted} nodes painted (want 2)`);

      /* selection: a click on the node must mark it selected. */
      await page.locator('.react-flow__node').first().click();
      const selected = await page.locator('.react-flow__node.selected').count();
      ok('bn3-live-selection-works', selected === 1, `${selected} selected node (want 1)`);

      /* history: Delete removes the node (React Flow's own deleteKeyCode),
       * then the toolbar's Undo restores it — boot-through-undo in one pass. */
      await page.keyboard.press('Delete');
      await page.waitForTimeout(250);
      const afterDelete = await page.locator('.react-flow__node').count();
      ok('bn3-live-delete-works', afterDelete === 1, `${afterDelete} nodes after Delete (want 1)`);
      await page.click('button[aria-label="Undo"]');
      await page.waitForTimeout(250);
      const afterUndo = await page.locator('.react-flow__node').count();
      ok('bn3-live-undo-works', afterUndo === 2, `${afterUndo} nodes after Undo (want 2)`);
    } finally {
      /* our own probe files only, never the demo board, never DELETE HTTP */
      for (const suffix of ['.json', '.json.bak']) {
        const p = join(REPO, 'boards', board.id + suffix);
        if (existsSync(p)) rmSync(p);
      }
      console.log('probe board removed (rmSync, no DELETE HTTP)');
    }
  } finally {
    await browser.close();
  }
}

if (fails.length) { console.log(`\nFAILED: ${fails.join(', ')}`); process.exit(1); }
console.log('\nROUND BN-3 bn2-hooks harness: GREEN');
