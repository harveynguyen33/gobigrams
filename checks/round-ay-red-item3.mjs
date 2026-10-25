#!/usr/bin/env node
/* RED proof for item 3: archive HEAD (pre-item-3-commit? No — item 3 rides
 * in the SAME commit as item 2's files; the RED reference is the tree at
 * HEAD BEFORE this commit, i.e. 33863d5 already contains exportScene but
 * NOT checks/round-ay-bounds.mjs... the harness file is new here, so the
 * RED proof archives HEAD (33863d5) which HAS bboxBounds already).
 *
 * The honest RED for item 3 is therefore the PARENT of the item-2/3 commit:
 * 77264d4 (item 1), which has no src/export/exportScene.ts at all. Archive that. */
import {execSync, spawnSync} from 'node:child_process';
import {mkdtempSync, rmSync} from 'node:fs';
import {join, dirname} from 'node:path';
import {tmpdir} from 'node:os';
import {fileURLToPath} from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, '..');
const tmp = mkdtempSync(join(tmpdir(), 'ay3-red-'));
try {
  execSync(`git -C ${JSON.stringify(REPO)} archive 77264d4 | tar -x -C ${JSON.stringify(tmp)}`, {stdio: 'pipe'});
  const {status} = spawnSync(process.execPath, [join(HERE, 'round-ay-bounds.mjs')], {
    stdio: 'inherit', env: {...process.env, AR_ROOT: tmp}});
  console.log(status === 1
    ? '\nRED PROVEN — the harness fails on 77264d4 (no src/export/exportScene.ts), as required.'
    : `\nUNEXPECTED: harness exit ${status} on 77264d4 (want 1).`);
  process.exit(status === 1 ? 0 : 1);
} finally {
  rmSync(tmp, {recursive: true, force: true});
}
