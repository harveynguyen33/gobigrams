// UMAMI TRACKER (2026-10-25) — pins the analytics wiring in index.html.
// Rule: the tracker loads ONLY on the production origin (gobigrams.tech-goblin.com),
// with the pinned website id. Unconditional loads (dev/LAN pollution) fail.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = process.env.DS_ROOT ?? resolve(import.meta.dirname, '..');
const html = readFileSync(`${ROOT}/index.html`, 'utf8');
const built = readFileSync(`${ROOT}/dist/index.html`, 'utf8');

const results = [];
const assert = (name, ok) => { results.push({name, ok}); if (!ok) console.log(`FAIL  ${name}`); };

const SRC = 'https://analytics.tech-goblin.com/script.js';
const ID = 'ee9cefdb-9ecb-4d2e-8aaf-a56d44b0420a';

assert('u1 the tracker src is pinned to the self-hosted instance',
  html.includes(SRC));
assert('u2 the website id is pinned to the Gobigrams site',
  html.includes(`'${ID}'`));
assert('u3 the tracker is gated on the production hostname (no dev/LAN pollution)',
  /hostname === 'gobigrams\.tech-goblin\.com'/.test(html));
assert('u4 the built bundle carries the same gated loader',
  built.includes(SRC) && built.includes(ID));

const fails = results.filter(r => !r.ok).length;
console.log(`umami-tracker: ${results.length - fails}/${results.length} PASS`);
process.exit(fails ? 1 : 0);
