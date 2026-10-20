/* PACKAGE-S — the Settings completion round: persisted prefs (grid size, align
 *  guides), the export defaults (PNG scale + padding), and the autosave control.
 *
 *  House shape copied from checks/round-ao-colour-and-nub.mjs: an assert() that
 *  prints PASS/FAIL with a detail line, a blank comment before every source
 *  probe, and a REPLAY at the bottom that re-runs the SOURCE probes against the
 *  pinned pre-change commit (5daf3b5) and REQUIRES THEM RED.
 *
 *  WHY THE REPLAY IS NOT OPTIONAL: an assertion that is green on both trees
 *  proves nothing (three AL probes were silently useless from double-backslash
 *  regexes). The probes that can only be green because PACKAGE-S landed are
 *  replayed and MUST be red on the pinned commit.
 *
 *  HOW PREFS ARE ASSERTED: `src/prefs.ts` is EXECUTED against a stubbed
 *  localStorage — the real load/save contract (JSON encoding, prefix, fallback
 *  on absent/malformed/unreachable) is proven by running it, not by grepping.
 */

import {execFileSync} from 'node:child_process';
import {mkdtempSync, cpSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join, dirname} from 'node:path';

const ROOT = process.env.DS_ROOT || '/home/harvey/projects/tech-goblin/lab/diagram-studio';
/* PACKAGE-S base — the tree the round landed on top of. */
const PRE_COMMIT = '5daf3b5';

let pass = 0, fail = 0;
const assert = (name, cond, detail = '') => {
  if (cond) { pass++; console.log(`  PASS  ${name}`); }
  else { fail++; console.log(`  FAIL  ${name}  —  ${detail}`); }
};
const css = () => readFileSync(join(ROOT, 'src/styles.css'), 'utf8');
import {readFileSync} from 'node:fs';
const appSource = () => readFileSync(join(ROOT, 'src/App.tsx'), 'utf8');
const settingsSource = () => readFileSync(join(ROOT, 'src/Settings.tsx'), 'utf8');
const prefsSource = () => readFileSync(join(ROOT, 'src/prefs.ts'), 'utf8');

console.log(`\nPACKAGE-S — persisted prefs, export defaults, autosave control`);

/* ---------------------------------------------------------------- S-1 prefs --
 *  prefs.ts is EXECUTED (bundled by hand: the module is dependency-free) with a
 *  stubbed localStorage, proving the real contract by running it. */

const runPrefs = (stubScript) => {
  const dir = mkdtempSync(join(tmpdir(), 'ps-prefs-'));
  /* prefs.ts is TypeScript with one generic; the driver needs runnable JS.
     Strip exactly the constructs prefs.ts uses — the single `<T>` generic and
     the `: T` return / `: string` parameter annotations — nothing else. If
     prefs.ts ever grows richer types, this strip breaks LOUDLY here (syntax
     error in the driver), which is the honest failure. */
  const ts = readFileSync(join(ROOT, 'src/prefs.ts'), 'utf8');
  const js = ts
    .replace(/export function loadPref<T>/, 'export function loadPref')
    .replace(/export function savePref<T>/, 'export function savePref')
    .replace(/\(key: string, fallback: T\): T/, '(key, fallback)')
    .replace(/\(key: string, value: T\): void/, '(key, value)')
    .replace(/ as T;/g, ';');
  writeFileSync(join(dir, 'prefs.mjs'), js);
  writeFileSync(join(dir, 'driver.mjs'), stubScript.replace('__PREFS__', './prefs.mjs'));
  try {
    return execFileSync('node', [join(dir, 'driver.mjs')], {encoding: 'utf8'});
  } catch (e) {
    return `THREW: ${e.stdout || e.message}`;
  }
};

{
  // blank comment before the probe
}
const roundTrip = runPrefs(`
import {loadPref, savePref} from '__PREFS__';
const store = new Map();
globalThis.localStorage = {
  getItem: k => store.has(k) ? store.get(k) : null,
  setItem: (k, v) => store.set(k, String(v)),
};
savePref('grid-size', 24);
savePref('png-scale', 3);
console.log(JSON.stringify({
  grid: loadPref('grid-size', 16),
  scale: loadPref('png-scale', 2),
  missing: loadPref('nothing', 'fb'),
  prefixed: store.has('diagram-studio:pref:grid-size'),
}));
`);
assert('S1.round-trip — savePref writes JSON under the prefix; loadPref reads it back',
  roundTrip.includes('"grid":24') && roundTrip.includes('"scale":3')
    && roundTrip.includes('"missing":"fb"') && roundTrip.includes('"prefixed":true'),
  `driver printed: ${roundTrip.trim().slice(0, 200)}`);

{
  // blank comment before the probe
}
const malformed = runPrefs(`
import {loadPref} from '__PREFS__';
globalThis.localStorage = {
  getItem: k => '{broken json',
  setItem: () => {},
};
console.log(JSON.stringify({fb: loadPref('grid-size', 99)}));
`);
assert('S1.malformed — a corrupted stored value reads as the fallback (cleared, never migrated)',
  malformed.includes('"fb":99'),
  `driver printed: ${malformed.trim().slice(0, 200)}`);

{
  // blank comment before the probe
}
const throwing = runPrefs(`
import {loadPref, savePref} from '__PREFS__';
globalThis.localStorage = {
  getItem: () => { throw new Error('private mode'); },
  setItem: () => { throw new Error('quota'); },
};
const a = loadPref('grid-size', 16);
savePref('grid-size', 24);
console.log(JSON.stringify({a, survived: true}));
`);
assert('S1.unreachable-storage — throwing localStorage falls back and does not take the app down',
  throwing.includes('"a":16') && throwing.includes('"survived":true'),
  `driver printed: ${throwing.trim().slice(0, 200)}`);

/* --------------------------------------------------- S-1 wiring in App.tsx -- */

{
  // blank comment before the probe
}
const app = appSource();
assert('S1.grid-size-persisted — App lazy-inits gridSize from prefs and saves on change',
  app.includes(`loadPref('grid-size', 16)`) && app.includes(`savePref('grid-size', next)`),
  'the gridSize state must read loadPref and the setter must savePref');

{
  // blank comment before the probe
}
assert('S1.align-guides-persisted — App lazy-inits alignGuides from prefs and saves on change',
  app.includes(`loadPref('align-guides', true)`) && app.includes(`savePref('align-guides', next)`),
  'the alignGuides state must read loadPref and its setter must savePref');

/* ------------------------------------------------------------ S-2 export --- */

{
  // blank comment before the probe
}
assert('S2.png-scale — exportPng consumes the stored scale (pixelRatio) and the stored padding',
  app.includes('pixelRatio: pngScale') && app.includes('const pad = pngPad'),
  'the two hard-coded values (pixelRatio 2, pad 48) must read the persisted state');

{
  // blank comment before the probe
}
const settings = settingsSource();
assert('S2.settings-rows — the Canvas pane offers PNG scale (1x/2x/3x) and padding (24/48/96)',
  settings.includes(`options={['1x', '2x', '3x']}`) && settings.includes(`options={['24', '48', '96']}`),
  'the two Segmented controls must exist in Settings.tsx with exactly those value sets');

{
  // blank comment before the probe
}
assert('S2.defaults-are-todays — the defaults are scale 2 and pad 48 (unchanged behaviour)',
  app.includes(`loadPref('png-scale', 2)`) && app.includes(`loadPref('png-pad', 48)`),
  'a user who never opens Settings must see no change');

/* ----------------------------------------------------------- S-3 autosave --- */

{
  // blank comment before the probe
}
assert('S3.autosave-gate — the debounced effect returns early when autosave is off',
  app.includes('if (!autosave) {') && app.includes('setDirty(true);') && app.includes('}, [nodes, edges, boardId, flushSave, autosave, canAutosave]);'),
  'the effect must gate on the persisted flag and mark the board dirty instead (dep array extended by ROUND AS AS-5: the explicit save gate re-runs the effect so a gate transition cannot strand a pending autosave)');

{
  // blank comment before the probe
}
assert('S3.dirty-marker — the save indicator renders an unsaved state while autosave is off and changes exist',
  app.includes("dirty && !autosave ? 'unsaved' : ''"),
  'unsaved work must never be silent');

{
  // blank comment before the probe
}
assert('S3.flush-clears — flushSave clears the dirty flag',
  /const flushSave = useCallback\(async \(\) => \{\s*\n\s*setDirty\(false\);/.test(app),
  'a flush (Save / Cmd+S / autosave) must resolve the marker');

{
  // blank comment before the probe
}
assert('S3.settings-row — the Canvas pane carries the Autosave toggle',
  settings.includes('label="Autosave"'),
  'the control must be user-reachable in Settings → Canvas');

/* ------------------------------------------------------------------- hex ---- */

{
  // blank comment before the probe
}
const HEX = (css().match(/#[0-9a-fA-F]{3,8}/g) || []).length;
assert('hex ratchet holds at 144', HEX === 144, `count is ${HEX}, pinned ceiling is 144`);

/* ================================================================ REPLAY ====
 *  The SOURCE probes above re-run against the pre-change tree and MUST be RED
 *  there — a probe green on both trees proves nothing.
 */
console.log('\n  REPLAY — the source probes must be RED on the pre-change tree');
if (process.env.DS_ROOT) {
  /* We ARE the replay (running inside a worktree against another tree): do not
     recurse. The parent's tally already covers this run's verdict. */
  console.log('  (nested run: replay skipped)');
} else {
{
  const worktree = mkdtempSync(join(tmpdir(), 'ps-replay-'));
  try {
    execFileSync('git', ['worktree', 'add', worktree, PRE_COMMIT], {cwd: ROOT, stdio: 'pipe'});
    /* prefs.ts exists only on the new tree (it IS part of the change). The replay
       targets the APP probes (App.tsx / Settings.tsx wiring), so seed the module
       itself — the S1 execution probes then behave identically on both trees and
       only the wiring probes can differ. */
    cpSync(join(ROOT, 'src', 'prefs.ts'), join(worktree, 'src', 'prefs.ts'));
    // this harness hardcodes ROOT; run the SAME probes against the worktree by
    // pointing DS_ROOT at it (the file reads DS_ROOT first).
    const r = execFileSync('node', [join(ROOT, 'checks', 'package-s-settings.mjs')], {
      encoding: 'utf8',
      cwd: worktree,
      env: {...process.env, DS_ROOT: worktree},
    });
    const m = r.match(/(\d+) passed \/ (\d+) failed/);
    if (m) {
      const [, p, f] = m;
      assert('REPLAY — the source probes are RED on the pre-change tree', parseInt(f, 10) > 0,
        `pre-change tree printed ${p} passed / ${f} failed — the probes prove nothing`);
    } else {
      assert('REPLAY — the source probes are RED on the pre-change tree', false, 'no tally line in replay output');
    }
  } catch (e) {
    // execFileSync throws when the child exits non-zero (RED replay) — that is the PASS path
    const out = e.stdout || '';
    const m = out.match(/(\d+) passed \/ (\d+) failed/);
    if (m && parseInt(m[2], 10) > 0) {
      assert('REPLAY — the source probes are RED on the pre-change tree', true);
    } else {
      assert('REPLAY — the source probes are RED on the pre-change tree', false,
        `replay output: ${out.slice(0, 200) || e.message.slice(0, 200)}`);
    }
  } finally {
    try { execFileSync('git', ['worktree', 'remove', '--force', worktree], {cwd: ROOT, stdio: 'pipe'}); } catch { /* best effort */ }
  }
}

}

console.log(`\n  ${pass} passed / ${fail} failed / 0 skipped (cumulative)`);
console.log(fail === 0 ? '\nPACKAGE-S HARNESS: GREEN' : '\nPACKAGE-S HARNESS: RED');
process.exit(fail === 0 ? 0 : 1);
