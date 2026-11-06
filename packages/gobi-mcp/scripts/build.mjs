/* STEP-5-MCP — the @techgoblin/gobi-mcp build: ONE self-contained ESM bundle,
 * dist/server.mjs, the same deterministic esbuild recipe the core package uses
 * (repo esbuild, hoisted by the workspace; executed as the native binary).
 * Everything is bundled — the core, the MCP SDK, zod — so the server runs from
 * any cwd with only node on the path, and can be added to a client config by
 * absolute path.
 *
 * Type-check first (tsc --noEmit, own tsconfig), then bundle. */
import {execFileSync} from 'node:child_process';
import {createRequire} from 'node:module';
import {rmSync, mkdirSync} from 'node:fs';
import {dirname, join} from 'node:path';
import {fileURLToPath} from 'node:url';

const pkg = join(dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const esbuildBin = require.resolve('esbuild/bin/esbuild');
const tscBin = require.resolve('typescript/bin/tsc');

/* ORDER MATTERS: the core's `exports` map resolves `import` to
 * packages/gobi/dist/index.js, so the core is rebuilt FIRST — otherwise a
 * stale core dist silently drops new exports (the stale-transform trap). */
execFileSync(process.execPath, ['scripts/build.mjs'], {cwd: join(pkg, '..', 'gobi'), stdio: 'inherit'});

execFileSync(process.execPath, [tscBin, '-p', join(pkg, 'tsconfig.json')], {stdio: 'inherit'});

rmSync(join(pkg, 'dist'), {recursive: true, force: true});
mkdirSync(join(pkg, 'dist'), {recursive: true});
execFileSync(esbuildBin, [
  join(pkg, 'src/server.ts'),
  '--bundle', '--format=esm', '--platform=node', '--target=node18',
  '--log-level=error',
  `--outfile=${join(pkg, 'dist/server.mjs')}`,
], {stdio: 'inherit'});

console.log('@techgoblin/gobi-mcp built: dist/server.mjs (self-contained)');
