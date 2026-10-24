#!/usr/bin/env node
/**
 * ROUND AY item 1 — RED PROOF for the pre-change tree.
 *
 * The RED run is the same harness with AR_ROOT pointed at a pre-change root.
 * This helper materialises that root: the repo at the CURRENT HEAD minus the
 * item-1 changes (a git worktree of HEAD~ would do, but the tree may have no
 * prior commit carrying the harness, so instead: a plain copy of the repo's
 * src/ + package.json via `git archive` of HEAD).
 *
 * Usage: node checks/round-ay-red-item1.mjs
 * Exits 0 when the harness is RED (exit 1) on the pre-change root.
 */
import {execSync} from 'node:child_process';
import {mkdtempSync, rmSync} from 'node:fs';
import {join, dirname} from 'node:path';
import {tmpdir} from 'node:os';
import {fileURLToPath} from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, '..');
const tmp = mkdtempSync(join(tmpdir(), 'ay-red-'));
try {
  /* the tree at HEAD (which does NOT contain item-1's changes — the proof
   * must be captured BEFORE the item-1 commit lands; this helper is run at
   * that point in the workflow, with the changes still uncommitted) */
  execSync(`git -C ${JSON.stringify(REPO)} archive HEAD | tar -x -C ${JSON.stringify(tmp)}`, {stdio: 'inherit'});
  const {status} = await import('node:child_process').then(cc =>
    cc.spawnSync(process.execPath, [join(HERE, 'round-ay-text-cache.mjs')], {
      stdio: 'inherit', env: {...process.env, AR_ROOT: tmp}}));
  console.log(status === 1
    ? '\nRED PROVEN — the harness fails on the pre-change root (exit 1), as required.'
    : `\nUNEXPECTED: harness exit ${status} on the pre-change root (want 1).`);
  process.exit(status === 1 ? 0 : 1);
} finally {
  rmSync(tmp, {recursive: true, force: true});
}
