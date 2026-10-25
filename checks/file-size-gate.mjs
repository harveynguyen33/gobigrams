// checks/file-size-gate.mjs — the GOD-FILE GUARDRAIL (ROUND BN, ITEM 1).
//
// WHAT THIS IS: a per-file line budget over everything under src/. The BUDGET
// MAP below is the SOURCE OF TRUTH for AGENTS.md's "Code structure rules"
// section — if a file's budget and this table disagree, this table wins.
//
// WHAT IT ENFORCES:
//   * every file under src/ has an explicit budget; a file with NO entry FAILS
//     (an unbudgeted file is an unwatched god-file in the making);
//   * a file over budget FAILS, and the remedy is a real shrink, not a raise —
//     budgets RATCHET DOWN over time; each extraction round must lower its
//     target's budget, and only a code change that genuinely warrants it may
//     raise one (say why in the commit);
//   * entries marked 'hard' (App.tsx, presets.ts, GoblinEdge.tsx, exportSvg.ts)
//     are capped at their current size and may NEVER grow — not one line.
//
// NEW FILES default to a 400-line budget (ESLint max-lines territory; 100-500
// is the industry norm) and must be ADDED to the map with their real budget
// once they exist.
//
// WHAT THIS CANNOT SEE: anything that is not a file's line count — quality,
// coupling, duplication. It is a ratchet, not a review.
//
// RED-FIRST EVIDENCE: this harness was proven to fire before it went green —
// see the ROUND BN commit message (a temporarily-inflated budget breach was
// detected and failed the run, then the real budgets landed).

import {readFileSync, readdirSync, statSync} from 'node:fs';
import {join, relative} from 'node:path';

const SRC = 'src';
const NEW_FILE_DEFAULT_BUDGET = 400;

// The budget map: [path, budget, mode?] — mode 'hard' = exact cap, no growth ever.
// Generated from the measured line counts at ROUND BN (HEAD 4402da1); the
// "now N" comments record the count each budget was derived from.
const BUDGETS = new Map([
    ['src/App.tsx', 5571, 'hard'],  // ROUND BN-3 PHASE B: LOWERED again (Toolbar extraction)
  ['src/useUndoHistory.ts', 132],  // ROUND BN PHASE A (now 121)
  ['src/usePersistence.ts', 272],  // ROUND BN-2 (now 271)
  ['src/useConnections.ts', 298],  // ROUND BN-2
  ['src/useExportActions.ts', 500],  // ROUND BN-2
  ['src/useCanvasTools.ts', 182],  // ROUND BN-2
  ['src/useBoardsMenu.ts', 429],  // ROUND BN-2
  ['src/boardConstants.ts', 129],  // ROUND BN ITEM 2 (now 118)
  ['src/boardMigrations.ts', 234],  // ROUND BN ITEM 2 (now 213)
  ['src/boardUtils.tsx', 231],  // ROUND BN ITEM 2 (now 210),
  ['src/BoardDialog.tsx', 383],  // now 348,
  ['src/components/HelpSheet.tsx', 96],  // ROUND BN-3 PHASE B (new)
  ['src/components/ModalMounts.tsx', 143],  // ROUND BN-3 PHASE B (new)
  ['src/components/CanvasEmptyPanel.tsx', 41],  // ROUND BN-3 PHASE B (new)
  ['src/components/Toolbar.tsx', 173],  // ROUND BN-3 PHASE B (new)
  ['src/Checklist.tsx', 133],  // now 120,
  ['src/ContextMenu.tsx', 136],  // now 123,
  ['src/CustomShapeNode.tsx', 145],  // now 131,
  ['src/DiagramNode.tsx', 655],  // now 595,
  ['src/ExportModal.tsx', 325],  // now 295,
  ['src/FeedbackDialog.tsx', 310],  // now 281,
  // ROUND BN-4 — GoblinEdge.tsx (hard 1274) split into src/edges/: the type
  // declaration, the K2 payload machinery and the registry moved out verbatim;
  // the component itself (the part a dozen harnesses pin spellings inside)
  // moved to src/edges/GoblinEdge.tsx.
  ['src/edges/GoblinEdge.tsx', 1050],  // now 1042
  ['src/edges/EdgeData.ts', 165],  // now 158
  ['src/edges/flowPayloads.tsx', 100],  // now 95
  ['src/edges/index.ts', 30],  // now 20
  ['src/HelperLinesView.tsx', 58],  // now 52,
  ['src/IconPicker.tsx', 129],  // now 117,
  ['src/InspectorPickers.tsx', 930],  // now 845,
  ['src/LabelNode.tsx', 301],  // now 273,
  ['src/SearchPalette.tsx', 124],  // now 112,
  ['src/Settings.tsx', 440],  // ROUND BN-4: panes+helpers split out (now 424)
  ['src/settings/panes.tsx', 205],  // now 198 (Canvas + About/Roadmap panes)
  ['src/settings/controls.tsx', 145],  // now 138 (Row/Toggle/Segmented/etc)
  ['src/settings/shared.ts', 80],  // now 74 (Props)
  ['src/settings/version.ts', 10],  // now 6 (APP_VERSION)
  ['src/TableNode.tsx', 171],  // now 155,
  ['src/TemplatesGallery.tsx', 359],  // now 326,
  ['src/ThemePicker.tsx', 248],  // now 225,
  ['src/Tooltip.tsx', 233],  // now 211,
  ['src/Tour.tsx', 243],  // now 220,
  ['src/boardClipboard.ts', 153],  // now 139,
  ['src/boards.ts', 213],  // now 193,
  ['src/categoryState.ts', 185],  // now 168,
  ['src/choreography.ts', 465],  // now 422,
  ['src/colorKeyNote.ts', 116],  // now 105,
  ['src/colors.ts', 118],  // now 107,
  ['src/crowfoot.tsx', 137],  // now 124,
  ['src/customShape.ts', 573],  // now 520,
  ['src/edgeBend.ts', 409],  // now 371,
  ['src/edgeLabel.ts', 655],  // now 595,
  ['src/exportPng.ts', 140],  // now 127,
  ['src/exportScene.ts', 634],  // now 576,
  ['src/exportSvg.ts', 1074, 'hard'],  // hard cap at current: may NEVER grow,
  ['src/feedbackIssueUrl.ts', 81],  // now 73,
  ['src/flowIcons.tsx', 76],  // now 69,
  ['src/fontFiles.ts', 150],  // now 136,
  ['src/fontManifest.ts', 45],  // now 40,
  ['src/helperLines.ts', 213],  // now 193,
  ['src/inspector.ts', 325],  // now 295,
  ['src/inspectorState.ts', 140],  // now 127,
  ['src/layout.ts', 281],  // now 255,
  ['src/library.ts', 305],  // now 277,
  ['src/localStore.ts', 405],  // now 368,
  ['src/lucideIcons.ts', 433],  // now 393,
  ['src/main.tsx', 12],  // now 10,
  ['src/marqueeMode.ts', 119],  // now 108,
  ['src/mermaid.ts', 368],  // now 334,
  ['src/palette.ts', 172],  // now 156,
  ['src/paletteSearch.ts', 94],  // now 85,
  ['src/panelCollapse.ts', 139],  // now 126,
  ['src/prefs.ts', 41],  // now 37,
  // ROUND BN-4 — presets.ts (hard 1431) split into src/presets/: the LIFT the
  // split buys. Verbatim data moves; index.ts re-exports the union.
  ['src/presets/basic.ts', 380],  // now 374 (spine + factory + edge defaults)
  ['src/presets/flowchart.ts', 340],  // now 332
  ['src/presets/dataStorage.ts', 130],  // now 117
  ['src/presets/architecture.ts', 410],  // now 368
  ['src/presets/index.ts', 300],  // now 289
  ['src/printView.ts', 59],  // now 53,
  ['src/resizeHistory.ts', 109],  // now 99,
  ['src/roadmap.ts', 138],  // now 125,
  ['src/serverBoards.ts', 59],  // now 53,
  ['src/shapes.tsx', 431],  // now 391,
  ['src/storageMode.ts', 75],  // now 68,
  ['src/styles.css', 5997],  // now 5451,
  ['src/templateCatalog.ts', 103],  // now 93,
  ['src/textMetrics.ts', 162],  // now 147,
  ['src/textOutline.ts', 280],  // now 254,
  ['src/textOutlineHb.ts', 305],  // now 277,
  ['src/textStyle.ts', 714],  // now 649,
  ['src/theme.ts', 192],  // now 174,
  ['src/touch.ts', 362],  // now 329,
  ['src/useEdgeGesture.ts', 224],  // now 203,
  ['src/useEditorInterface.ts', 230],  // now 209,
  ['src/zOrderMode.ts', 93],  // now 84
].map(([path, budget, mode]) => [path, {budget, mode}]));

const failures = [];
let checked = 0;

function assert(name, ok, detail = '') {
  checked += 1;
  if (ok) {
    console.log(`PASS  ${name}${detail ? ' - ' + detail : ''}`);
  } else {
    console.log(`FAIL  ${name}${detail ? ' - ' + detail : ''}`);
    failures.push(name);
  }
}

// Count like `wc -l` (newline characters): a trailing newline does not open a new line.
const countLines = (p) => { const c = readFileSync(p, 'utf8'); return c.endsWith('\n') ? c.split('\n').length - 1 : c.split('\n').length; }

// ---- discover every budgetable file under src/ --------------------------------
const found = [];
(function walk(dir) {
  for (const name of readdirSync(dir)) {
    if (name === 'vendor') continue; // vendored code: not ours to budget
    const p = join(dir, name);
    if (statSync(p).isDirectory()) { walk(p); continue; }
    if (/\.(ts|tsx|css|mjs)$/.test(name)) found.push(p);
  }
})(SRC);

// ---- the table ----------------------------------------------------------------
const rows = [];
for (const p of found) {
  const rel = relative('.', p).split('\\').join('/');
  const lines = countLines(p);
  const entry = BUDGETS.get(rel);
  rows.push({rel, lines, budget: entry?.budget, mode: entry?.mode ?? 'soft', hasEntry: entry != null});
}
rows.sort((a, b) => b.lines - a.lines || a.rel.localeCompare(b.rel));

const W = Math.max(...rows.map(r => r.rel.length), 4) + 2;
console.log(`${'file'.padEnd(W)} lines  budget  status`);
for (const r of rows) {
  const status = !r.hasEntry ? 'MISSING BUDGET'
    : r.lines > r.budget ? (r.mode === 'hard' ? 'OVER (hard cap)' : 'OVER BUDGET')
    : r.lines === r.budget && r.mode === 'hard' ? 'AT hard cap'
    : 'ok';
  console.log(`${r.rel.padEnd(W)} ${String(r.lines).padStart(5)}  ${r.budget == null ? '    —' : String(r.budget).padStart(5)}  ${status}`);
}

// ---- verdicts -----------------------------------------------------------------
const over = rows.filter(r => r.budget != null && r.lines > r.budget);
for (const r of over) {
  assert(`${r.rel} within budget`, false,
    `${r.lines} lines > ${r.budget}${r.mode === 'hard' ? ' (HARD CAP — this file may never grow)' : ''}; shrink the file or, only with a real code-change reason in the commit, raise the budget map`);
}
const missing = rows.filter(r => !r.hasEntry);
for (const r of missing) {
  assert(`${r.rel} has a budget entry`, false,
    `no entry in the BUDGETS map — add one (new files start at ${NEW_FILE_DEFAULT_BUDGET})`);
}
const stale = [...BUDGETS.keys()].filter(k => !rows.some(r => r.rel === k));
for (const k of stale) {
  assert(`${k} budget entry is live`, false, 'entry points at a file that no longer exists — remove or rename it');
}
if (over.length === 0 && missing.length === 0 && stale.length === 0) {
  assert('every file under src/ is within its size budget', true,
    `${rows.length} files checked, ${rows.filter(r => r.mode === 'hard').length} on hard caps`);
}

// ---- verdict ------------------------------------------------------------------
if (failures.length > 0) {
  console.log(`${checked - failures.length}/${checked} passed`);
  process.exit(1);
}
console.log(`${checked}/${checked} passed`);
process.exit(0);
