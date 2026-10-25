#!/usr/bin/env node
/** ROUND AY item 4 — the RED proof. Archives aaf71fa (pre item-4: no
 * src/export/exportPng.ts) into a scratch worktree and runs
 * checks/round-ay-png-rasterise.mjs against it; the harness must exit 1
 * (the module does not exist there). RED on the parent commit = the new
 * assertions are live, not born green. */
import {execFileSync, spawnSync} from 'node:child_process';
import {mkdtempSync, rmSync} from 'node:fs';
import {join, dirname} from 'node:path';
import {tmpdir} from 'node:os';
import {fileURLToPath} from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, '..');
const PARENT = process.argv[2] || 'aaf71fa';

const tmp = mkdtempSync(join(tmpdir(), 'ay4-red-'));
try {
  execFileSync('git', ['worktree', 'add', '--detach', tmp, PARENT], {cwd: REPO, stdio: 'pipe'});
  const r = spawnSync('node', [join(HERE, 'round-ay-png-rasterise.mjs')], {
    env: {...process.env, AR_ROOT: tmp},
    encoding: 'utf8',
  });
  const out = (r.stdout || '') + (r.stderr || '');
  console.log(out.split('\n').slice(0, 6).join('\n'));
  if (r.status !== 1) {
    console.log(`RED PROOF FAILED: expected exit 1 on ${PARENT} (no exportPng.ts), got ${r.status}`);
    process.exit(1);
  }
  console.log(`RED proven on ${PARENT}: rasterise harness exits 1 (module absent)`);
} finally {
  try { execFileSync('git', ['worktree', 'remove', '--force', tmp], {cwd: REPO, stdio: 'pipe'}); } catch { /* best effort */ }
}
