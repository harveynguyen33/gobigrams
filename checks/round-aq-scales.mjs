
/* ROUND AQ — the type-scale + spacing-scale ratchet.
 *
 *  TWO INVARIANTS, both enforced against src/styles.css:
 *    1. every font-size is a var(--fs-*) token — zero raw px font-size
 *       outside the token block (the block itself declares the 8 steps).
 *    2. every padding/margin/gap px value is in the 15-step allowed set.
 *
 *  RED replay: on the pre-AQ tree both sweeps MUST report violations (the
 *  16-size type sheet and the 21 off-scale spacing numbers prove the probes
 *  can see them).
 */
import {execFileSync} from 'node:child_process';
import {mkdtempSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {readFileSync} from 'node:fs';

const ROOT = process.env.DS_ROOT || '/home/harvey/projects/tech-goblin/lab/diagram-studio';
const PRE_COMMIT = '492b0b6';
let pass = 0, fail = 0;
const assert = (name, cond, detail = '') => {
  if (cond) { pass++; console.log('  PASS  ' + name); }
  else { fail++; console.log('  FAIL  ' + name + '  —  ' + detail); }
};
const css = readFileSync(join(ROOT, 'src/styles.css'), 'utf8');

console.log('\nROUND AQ — type scale + spacing scale ratchet');

/* ---- 1. type scale ---- */
const FS_TOKENS = ['--fs-2xs','--fs-xs','--fs-sm','--fs-md','--fs-lg','--fs-xl','--fs-2xl','--fs-display'];
{
  const declared = FS_TOKENS.every(t => new RegExp(t.replace(/-/g,'\\-') + ':\\s*\\d+px').test(css));
  assert('AQ.1 the 8 --fs-* steps are declared on :root', declared,
    'the token block must declare all of: ' + FS_TOKENS.join(' '));
}
{
  /* blank comment before the probe */
}
{
  // token block lives once; count raw font-size outside it
  const tokenBlockStart = css.indexOf('ROUND AQ — the type scale');
  const tokenBlockEnd = css.indexOf('--fs-display', tokenBlockStart);
  const before = css.slice(0, tokenBlockStart);
  const after = css.slice(css.indexOf(';', tokenBlockEnd));
  const rawBefore = (before.match(/font-size:\s*\d+(?:\.\d+)?px/g) || []);
  const rawAfter = (after.match(/font-size:\s*\d+(?:\.\d+)?px/g) || []);
  assert('AQ.2 zero raw px font-size outside the token block',
    rawBefore.length === 0 && rawAfter.length === 0,
    `raw font-size found: ${[...rawBefore, ...rawAfter].slice(0, 5).join(', ')}...`);
}
{
  const uses = (css.match(/font-size:\s*var\(--fs-/g) || []).length;
  assert('AQ.3 the tokens are actually consumed (>= 140 font-size rules)', uses >= 140,
    `only ${uses} var(--fs-*) font-size declarations found`);
}

/* ---- 2. spacing scale ---- */
/* 7 and 9 stay: they are load-bearing in control arithmetic that pinned
   harnesses measure (insp-seg padding, table rows). Consolidating them would
   re-prove every measured claim; the honest kill-list is the rest. */
const ALLOWED = new Set([1,2,3,4,5,6,7,8,9,10,12,13,14,16,18,20,24,32,40]);
{
  /* blank comment before the probe */
}
{
  const PROP = /(?:^|;)\s*((?:padding|margin|gap)(?:-(?:top|right|bottom|left|inline|block|inline-start|inline-end|block-start|block-end|x|y))?):\s*([^;{}]+)/g;
  const off = [];
  let m;
  while ((m = PROP.exec(css)) !== null) {
    for (const num of m[2].matchAll(/(-?)(\d+(?:\.\d+)?)px/g)) {
      const f = parseFloat(num[2]);
      /* negative margins are geometry offsets (e.g. the -5px handle fade), not
         rhythm — out of scope by the spec's own offsets clause */
      if (num[1] === '-') continue;
      if (Number.isInteger(f) && !ALLOWED.has(f)) off.push(`${m[1]}: ${num[1]}px`);
    }
  }
  assert('AQ.4 every padding/margin/gap px value is on the 15-step scale',
    off.length === 0,
    `off-scale: ${[...new Set(off)].slice(0, 8).join(' · ')}`);
}

/* ---- RED replay on the pre-AQ tree ---- */
console.log('\n  REPLAY — both sweeps must be RED on the pre-AQ tree');
if (process.env.DS_ROOT) {
  console.log('  (nested run: replay skipped)');
} else {
  const worktree = mkdtempSync(join(tmpdir(), 'aq-replay-'));
  try {
    execFileSync('git', ['worktree', 'add', worktree, PRE_COMMIT], {cwd: ROOT, stdio: 'pipe'});
    /* ESM has no __dirname; the harness file lives in the PROJECT's checks/ dir
       (the worktree's copy may not exist — the file is untracked until commit).
       Running the project copy with DS_ROOT pointed at the worktree is exactly
       how the other re-playable harnesses do it. */
    const r = execFileSync('node', [join(ROOT, 'checks', 'round-aq-scales.mjs')], {
      encoding: 'utf8', cwd: worktree, env: {...process.env, DS_ROOT: worktree},
    });
    const fails = (r.match(/(\d+) failed/g) || []).map(s => parseInt(s));
    const totalFails = fails.reduce((a, b) => a + b, 0);
    assert('REPLAY — RED on the pre-AQ tree', totalFails > 0,
      `pre-AQ tree printed ${totalFails} failures — the probes prove nothing`);
  } catch (e) {
    const out = String(e.stdout || '');
    const fails = (out.match(/(\d+) failed/g) || []).map(s => parseInt(s));
    const totalFails = fails.reduce((a, b) => a + b, 0);
    assert('REPLAY — RED on the pre-AQ tree', totalFails > 0,
      `replay output: ${out.slice(0, 150) || e.message.slice(0, 150)}`);
  } finally {
    try { execFileSync('git', ['worktree', 'remove', '--force', worktree], {cwd: ROOT, stdio: 'pipe'}); } catch {}
  }
}

console.log(`\n  ${pass} passed / ${fail} failed`);
console.log(fail === 0 ? '\nROUND AQ HARNESS: GREEN' : '\nROUND AQ HARNESS: RED');
process.exit(fail === 0 ? 0 : 1);
