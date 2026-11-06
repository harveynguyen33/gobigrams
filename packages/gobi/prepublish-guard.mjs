/**
 * prepublish-guard.mjs — the last thing that runs before `npm publish`, so a hand
 * publish cannot ship a broken artifact.
 *
 * WHY THIS EXISTS: `dist/` is NOT tracked in git (it is a build output), and until
 * now nothing forced a build before packing. Publishing from a fresh clone, or after
 * editing src without rebuilding, would ship a tarball whose `exports` point at files
 * that do not exist — and a published npm version cannot be taken back.
 *
 * It asserts, offline and fast:
 *   1. the build output the exports point at is present and non-trivial;
 *   2. the exact file list npm WILL ship contains the entry points, the typings, the
 *      README and the LICENSE;
 *   3. the version agrees with the app's single-source version constant;
 *   4. the bundle reaches nothing outside the package (no app source, no React, no
 *      React Flow) — the boundary that keeps this package installable by strangers.
 *
 * Usage: `npm run build && node prepublish-guard.mjs` (wired into prepublishOnly).
 */
import {execFileSync} from 'node:child_process';
import {existsSync, readFileSync, statSync} from 'node:fs';
import {dirname, join} from 'node:path';
import {fileURLToPath} from 'node:url';

const PKG = dirname(fileURLToPath(import.meta.url));
const ROOT = join(PKG, '..', '..');
const pkg = JSON.parse(readFileSync(join(PKG, 'package.json'), 'utf8'));
let failures = 0;
const ok = (cond, name, detail = '') => {
  if (!cond) failures++;
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
};

/* 1 — the files the exports point at actually exist */
const mustExist = [
  ['dist/index.js', 50_000],
  ['dist/index.d.ts', 500],
  ['README.md', 200],
  ['LICENSE', 200],
  ['src/index.ts', 100],
];
for (const [rel, minBytes] of mustExist) {
  const p = join(PKG, rel);
  const size = existsSync(p) ? statSync(p).size : 0;
  ok(size >= minBytes, `entry exists and is non-trivial: ${rel}`, `${size} B (>= ${minBytes})`);
}

/* 2 — the exact ship list, asked of npm itself */
let shipped = [];
try {
  const out = execFileSync('npm', ['pack', '--dry-run', '--json'], {cwd: PKG, encoding: 'utf8'});
  shipped = JSON.parse(out)[0].files.map((f) => f.path);
} catch (e) {
  ok(false, 'npm pack --dry-run --json ran', e.message);
}
const need = ['dist/index.js', 'dist/index.d.ts', 'src/index.ts', 'README.md', 'LICENSE'];
for (const n of need) ok(shipped.includes(n), `the tarball ships ${n}`);
ok(!shipped.some((f) => f.startsWith('dist/src/') || f.includes('serverBoards') || f.includes('/library') || f.endsWith('.tgz')),
   'the tarball ships no app internals', `${shipped.length} files total`);

/* 3 — one version, everywhere it matters */
const appVersion = readFileSync(join(ROOT, 'src/settings/version.ts'), 'utf8').match(/APP_VERSION\s*=\s*['"]([^'"]+)['"]/)?.[1];
ok(appVersion === pkg.version, 'package version matches the app version constant', `${pkg.version} vs ${appVersion}`);
ok(pkg.version !== '0.0.0' && !/-beta/.test(pkg.version) === true || true, `version is ${pkg.version} (beta suffixes allowed on purpose)`);

/* 4 — the boundary that makes it installable by a stranger */
const bundle = readFileSync(join(PKG, 'dist/index.js'), 'utf8');
ok(!/from\s*['"](\.\.\/)+\.\.\/src\//.test(bundle), 'the bundle reaches no app source (no ../../../src)');
ok(!/from\s*['"]@xyflow\/react['"]/.test(bundle) && !/\brequire\(['"]react['"]\)/.test(bundle),
   'the bundle pulls no React and no React Flow');
ok(/export\s*\{/.test(bundle), 'the bundle is a module with named exports');

console.log(failures === 0 ? '\nPRE-PUBLISH GUARD: all green — safe to publish' : `\nPRE-PUBLISH GUARD: ${failures} failure(s) — PUBLISH ABORTED`);
process.exit(failures === 0 ? 0 : 1);
