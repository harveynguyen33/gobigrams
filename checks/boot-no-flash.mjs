#!/usr/bin/env node
/**
 * ITEM 2 / 2b / 3 guard — the boot flash and the checklist toast.
 *
 * There is no browser in this pass, so every claim is checked against the source
 * text (and, for the seed bytes, against the literal data structure itself):
 *
 *   ITEM 2   the canvas holds nothing while a board load is in flight, and the
 *            empty-state panel cannot claim "This board is empty" during it.
 *            The seed stays byte-identical FOR THE FIRST-RUN SAVE PATH, which is
 *            the only consumer it is allowed to keep.
 *   ITEM 2b  the seed nodes have no other render route (that flash WAS the dot).
 *   ITEM 3   the completion toast is gone end to end, and the checklist still
 *            auto-hides when all 6 tasks are done.
 *
 *   node checks/boot-no-flash.mjs      → exit 0 green, 1 red
 */
import {readFileSync} from 'node:fs';

const ROOT = '/home/harvey/projects/tech-goblin/lab/diagram-studio';
const app = readFileSync(`${ROOT}/src/App.tsx`, 'utf8');
/* ROUND BN re-anchor: the seed declarations moved to src/boardConstants.ts
   (module-level helper extraction). The seed-token count below reads App PLUS
   its new home so 'only on the first-run save path' still means the whole tree. */
const boardConstants = readFileSync(`${ROOT}/src/boardConstants.ts`, 'utf8');
const list = readFileSync(`${ROOT}/src/Checklist.tsx`, 'utf8');

const fails = [];
const ok = (name, cond, detail = '') => {
  console.log(`${cond ? '  ok  ' : ' FAIL '} ${name}${detail ? `  — ${detail}` : ''}`);
  if (!cond) fails.push(name);
};
const count = (s, re) => (s.match(re) ?? []).length;
/** Prose is not code. Several assertions below are "this token must not appear
 *  in the component" — and this pass documents WHY in comments, which mention
 *  the token by name. Strip comments first or the harness fails on its own
 *  explanation (measured: 3 false reds). */
const stripComments = s => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/[^\n]*/g, '$1');
// Keep the raw text for the two assertions that are ABOUT comments (2b).
const appCode = stripComments(app);
const listCode = stripComments(list);

/* ============================ ITEM 2 — no seed flash ====================== */

// a) React Flow is handed EMPTY collections at mount.
ok('useNodesState is seeded empty',
  /useNodesState<Node>\(\[\]\)/.test(app), 'was useNodesState(initialNodes)');
ok('useEdgesState is seeded empty',
  /useEdgesState<Edge>\(\[\]\)/.test(app), 'was useEdgesState(initialEdges)');

// b) `initialNodes` / `initialEdges` may appear ONLY on the first-run save path.
//    Any other reference is a route by which the seed can paint mid-load.
//    Count TOKENS, not lines: `nodes: initialNodes, edges: initialEdges` is one
//    line but two references.
/* ROUND BN-2 — the first-run save path moved VERBATIM from App.tsx into
   src/usePersistence.ts, so the seed-token census covers the hook too. */
const persistence = readFileSync(`${ROOT}/src/usePersistence.ts`, 'utf8');
const withoutSeedDecls = (appCode + stripComments(persistence) + stripComments(boardConstants)).replace(
  /(?:export )?const initialNodes: Node\[\][\s\S]*?\n\];\n(?:export )?const initialEdges: Edge\[\][\s\S]*?\n\];/, '');
const seedUses = count(withoutSeedDecls, /initialNodes|initialEdges/g);
const onFirstRunPath = count(withoutSeedDecls, /nodes: initialNodes, edges: initialEdges/g) * 2;
ok('seed referenced only by the first-run save path',
  /* ROUND BN: +2 = the export declaration names in boardConstants' import
     statement inside App.tsx — the seed's only remaining references.
     ROUND BN-2: the first-run save path lives in usePersistence.ts now; the
     +2 is its import statement's names instead — the census is unchanged. */
  seedUses === 6 && onFirstRunPath === 4 && seedUses - onFirstRunPath === 2,
  `${seedUses} uses outside the declarations, ${onFirstRunPath} of them on the create-board path`);

// c) The seed is BYTE-IDENTICAL: 3 nodes, 2 edges, architecture palette, and the
//    same positions the first-run board has always been written with.
const seedBlock = /const initialNodes: Node\[\] = \[([\s\S]*?)\n\];/.exec(boardConstants)?.[1] ?? '';
ok('seed still builds 3 goblin nodes', count(seedBlock, /id: 'n\d'/g) === 3);
ok('seed positions unchanged',
  /\{id: 'n1'[\s\S]*?position: \{x: 60, y: 180\}/.test(seedBlock) &&
  /\{id: 'n2'[\s\S]*?position: \{x: 360, y: 170\}/.test(seedBlock) &&
  /\{id: 'n3'[\s\S]*?position: \{x: 680, y: 180\}/.test(seedBlock));
ok('seed still reads the architecture palette + edge factory',
  count(seedBlock, /PRESETS\.architecture\.palette\[\d\]\.make\(\)/g) === 3 &&
  /makeEdge\('n1', 'n2', PRESETS\.architecture\.edges, 'e1'\)/.test(boardConstants) &&
  /makeEdge\('n2', 'n3', PRESETS\.architecture\.edges, 'e2'\)/.test(boardConstants));

// d) The canvas is released on EVERY exit path of the bootstrap, so a load that
//    fails does not leave a permanently blank board with no explanation.
ok('boardLoaded exists and starts false', /const \[boardLoaded, setBoardLoaded\] = useState\(false\)/.test(app));
const finallyBlock = /finally \{[\s\S]{0,400}?setBoardLoaded\(true\)/.test(persistence);
ok('bootstrap releases the canvas in a finally', finallyBlock);

// e) The empty-state panel is gated so a load in flight never shows it.
/* ROUND BN-3 PHASE B — the panel body moved to src/components/CanvasEmptyPanel.tsx;
   the GATE stayed in App as the `show` prop binding. Same predicate, new home. */
ok('empty-state panel gated on boardLoaded',
  /<CanvasEmptyPanel show=\{boardLoaded && nodes\.length === 0\} \/>/.test(app));

/* ============================ ITEM 2b — the "dot" ========================= */
// Sweep of every self-fading candidate named in the brief. Each entry maps a
// source token to whether a render route exists that starts at opacity 0 and
// could fade in DURING the load. The seed nodes were the only one; the rest are
// either static, hover-gated, or bound to user action.
const css = readFileSync(`${ROOT}/src/styles.css`, 'utf8');
const candidates = [
  /* ROUND BH re-anchor: the decorative dot was replaced by the static brand
     mark img (.brand .brand-mark) — same guarantee: no opacity/fade route. */
  ['brand mark (static, no fade)', /\.brand \.brand-mark \{[^}]*width: 1[46]px/.test(css) && !/\.brand-mark[^}]*opacity/.test(css) && !/\.brand-mark[^}]*animation/.test(css)],
  ['handle dots are hover/selection-gated', /\.react-flow__handle \{[\s\S]{0,200}?opacity: 0;/.test(css) && /@media \(hover: hover\) \{\s*\.react-flow__node:hover \.react-flow__handle \{ opacity: 1; \}/.test(css)],
  ['checklist items are not faded in', !/\.gsc-item[^}]*opacity: 0/.test(css)],
  ['save indicator has no fade-in', /\.save-ind \{[\s\S]{0,160}?min-height: 12px/.test(css) && !/\.save-ind[^}]*animation/.test(css)],
];
for (const [name, cond] of candidates) ok(`2b ${name}`, cond);

/* ============================ ITEM 3 — no toast =========================== */
ok('Checklist has no onAllDone prop', !/onAllDone/.test(listCode));
ok('Checklist has no allDoneFired ref', !/allDoneFired/.test(listCode));
ok('Checklist no longer imports useRef', !/useRef/.test(listCode));
ok('App no longer passes onAllDone', !/onAllDone/.test(appCode));
ok('the toast string is gone from src/', !/Nice — you know the basics\./.test(appCode));
// The once-per-mount effect that called it is gone too, not just the callback.
ok('no completion effect left in Checklist',
  !/if \(done\.size >= TASKS\.length && !/.test(listCode));
// …and the auto-hide itself survives as the render guard.
ok('checklist still auto-hides when all 6 are done',
  /if \(done\.size >= TASKS\.length\) return null;/.test(listCode) &&
  /const TASKS: \{id: ChecklistTaskId; label: string\}\[\] = \[/.test(listCode) &&
  count(listCode, /\{id: '(node|edge|label|move|export|board)'/g) === 6);
// The discrete tick signal is still wired (it is not a toast feeder).
ok('doneSignal wiring intact', /doneSignal=\{doneSignal\}/.test(appCode) && /setDoneSignal/.test(appCode));

console.log(fails.length ? `\nRED — ${fails.length} failing: ${fails.join('; ')}` : '\nGREEN — no seed flash, no boot toast');
process.exit(fails.length ? 1 : 0);
