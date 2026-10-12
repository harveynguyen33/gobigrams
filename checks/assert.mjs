// checks/assert.mjs — the house assertion harness (PROJECT-PRACTICE section 3 shape).
//
// Rename it to checks/<round>-<slug>.mjs and write real assertions. This file ships the
// SHAPE, not the checks: it currently asserts one thing that is true by construction, so it
// is a scaffold, not a deliverable. P6: "a generated skill that was never executed is a
// draft, not a deliverable."
//
// WHAT THIS CANNOT SEE: anything that needs a browser, a device, a network service or a
// human. Say so at the top of every harness you write here.

import { readFileSync } from 'node:fs';

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

// Source probes read text with comments BLANKED first, not stripped: blanking keeps line
// numbers and byte offsets true, and stops a comment that quotes a removed control from
// reading as the control still being present.
function blankComments(src) {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))
    .replace(/(^|[^:])\/\/[^\n]*/g, (m, p1) => p1 + ' '.repeat(m.length - p1.length));
}

// ---- REPLAY ------------------------------------------------------------------
// A check green on both trees proves NOTHING. Before this harness is trusted, run it against
// the pinned pre-change commit and require it to be RED there:
//
//   git worktree add --detach /tmp/pre <commit>
//   GOBLIN_PRE_COMMIT=<commit> node /tmp/pre/checks/<this-file>.mjs   # must exit non-zero
//
// goblin-verify does exactly this for every harness when replay.commit is set (rule HS-02).
// Pin the pre-change commit, never HEAD: once the round is committed, HEAD IS the fixed tree.
const REPLAY = Boolean(process.env.GOBLIN_PRE_COMMIT);

// ---- probes ------------------------------------------------------------------
// Replace this block. Each assertion must be RED on the pre-change tree, or it is not a
// check - it is a description.
const self = readFileSync(new URL(import.meta.url), 'utf8');
assert('harness reads its own source with comments blanked',
  blankComments(self).includes('function assert('),
  `blanked ${blankComments(self).length} bytes`);

// ---- verdict -----------------------------------------------------------------
if (failures.length > 0) {
  console.log(`${checked - failures.length}/${checked} passed${REPLAY ? ' (replay: this tree is pre-change)' : ''}`);
  process.exit(1);
}
console.log(`${checked}/${checked} passed${REPLAY ? ' (replay: this tree is pre-change)' : ''}`);
process.exit(0);
