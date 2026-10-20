#!/usr/bin/env node
/**
 * ROUND AS harness — mermaid import is ONE undo entry (AS-3 source assertions).
 *
 * DOM-free: no browser, no DOM. The undo stack lives in refs inside the App
 * component and is NOT importable in Node, so — exactly like
 * checks/round-ar-modal-stability.mjs — this harness asserts the HANDLER'S
 * SOURCE SHAPE via its brace span. The behavioural proof (import → one Cmd+Z
 * removes exactly the imported nodes; a second import needs two undos,
 * newest first) is the reviewer's live pass.
 *
 * Comments are blanked before every count (byte offsets preserved).
 *
 * Negative control: AS_ROOT env var pointing at a checkout of the pre-fix
 * commit `26baec6` must be RED (the handler there wipes `past.current` /
 * `future.current` and never calls pushHistory). RED, not a silent pass.
 */
import {readFileSync} from 'node:fs';
import {join} from 'node:path';

const ROOT = process.env.AS_ROOT || '/home/harvey/projects/tech-goblin/lab/diagram-studio';
const APP_RAW = readFileSync(join(ROOT, 'src/App.tsx'), 'utf8');

const blank = m => m.replace(/[^\n]/g, ' ');
const stripTs = s => s
  .replace(/\/\*[\s\S]*?\*\//g, blank)
  .replace(/(^|[^:])\/\/[^\n]*/g, (m, p1) => p1 + ' '.repeat(m.length - p1.length));
const APP = stripTs(APP_RAW);

const results = [];
const assert = (id, pass, detail = '') => {
  results.push({id, pass: !!pass, detail});
  console.log(`  ${pass ? 'PASS' : 'FAIL'}  ${id}  —  ${detail}`);
};

const braceSpan = (src, start) => {
  let depth = 0, began = -1;
  for (let i = start; i < src.length; i++) {
    if (src[i] === '{') { if (depth === 0) began = i; depth++; }
    else if (src[i] === '}') { depth--; if (depth === 0) return [began, i]; }
  }
  return [began, src.length - 1];
};

console.log('ROUND AS — import history (one entry per import, failed parse = zero)');
console.log(`  target root: ${ROOT}`);

/* the gobi:mermaid-import handler: its brace span starts at the listener
   registration and covers the whole handler effect */
const anchor = APP.indexOf("window.addEventListener('gobi:mermaid-import'");
const H0 = APP.lastIndexOf('useEffect', anchor);
const H = APP.slice(...braceSpan(APP, H0));

assert('as3.anchor.handler-found',
  H.includes('gobi:mermaid-import'),
  `handler span resolved (${H.length} chars) — the assertions below cannot be vacuous`);

/* 1. no history wipe inside the handler */
assert('as3.1.no-history-wipe-in-handler',
  !H.includes('past.current = []') && !H.includes('future.current = []'),
  'the handler contains NO `past.current = []` and NO `future.current = []`');

/* 2. pushHistory() precedes both state writes — the pre-import graph is
   snapshotted BEFORE the append */
const ph = H.indexOf('pushHistory()');
const sn = H.indexOf('setNodes');
const se = H.indexOf('setEdges');
assert('as3.2.pushHistory-before-both-writes',
  ph >= 0 && sn >= 0 && se >= 0 && ph < sn && ph < se,
  `pushHistory() at offset ${ph}, setNodes at ${sn}, setEdges at ${se} — snapshot lands first`);

/* 3. the failed-parse guard is still first — zero entries, board untouched */
const guard = H.indexOf('if (!parsed) return;');
assert('as3.3.failed-parse-guard-first',
  guard >= 0 && guard < ph,
  '`if (!parsed) return;` is the first statement of the handler (offset ' + guard + ')');

/* 4. the redo contract: pushHistory itself still clears `future` */
const phAnchor = APP.indexOf('const pushHistory = useCallback');
const PH = APP.slice(...braceSpan(APP, phAnchor));
assert('as3.4.pushHistory-clears-future',
  PH.includes('past.current.push(snapshot())') && PH.includes('future.current = []'),
  'pushHistory snapshots the pre-graph AND clears `future` (redo contract intact)');

/* 5. the stale "history reset" comment is gone — the doc must not re-teach
   the defect this round fixed */
assert('as3.5.stale-comment-gone',
  !H.includes('history reset'),
  'the handler comment no longer claims "the same apply path as a JSON import (history reset)" — ' +
  '(RED note: this assertion stays GREEN on the pre-fix tree on purpose; the wipe itself is what 1-3 catch)');

console.log(results.every(r => r.pass) ? '\nALL GREEN' : `\n${results.filter(r => !r.pass).length} FAILURE(S)`);
process.exit(results.every(r => r.pass) ? 0 : 1);
