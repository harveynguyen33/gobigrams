#!/usr/bin/env node
/* STEP-6-OBSIDIAN — the plugin build: ONE self-contained main.js (cjs,
 * 'obsidian' external — Obsidian provides that module at load time), with
 * the core BUNDLED IN (§E's distribution constraint: Obsidian loads exactly
 * one main.js per plugin; no runtime resolution).
 *
 * The version handshake (§F): BUNDLED_GOBI_CORE is --define'd from the
 * WORKSPACE core's package.json version + this tree's HEAD sha, and the
 * build FAILS if the plugin package's own version disagrees with the core's
 * major.minor line being bundled. Over the 1.5 MB budget (§E) also fails. */
import {execFileSync} from 'node:child_process';
import {createRequire} from 'node:module';
import {readFileSync, rmSync, statSync} from 'node:fs';
import {dirname, join} from 'node:path';
import {fileURLToPath} from 'node:url';

const pkg = join(dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const esbuildBin = require.resolve('esbuild/bin/esbuild');
const tscBin = require.resolve('typescript/bin/tsc');

const corePkg = JSON.parse(readFileSync(join(pkg, '..', '..', 'packages/gobi/package.json'), 'utf8'));
const coreVersion = corePkg.version;
let sha = '';
try {
  sha = execFileSync('git', ['rev-parse', '--short', 'HEAD'], {cwd: join(pkg, '..', '..'), encoding: 'utf8'}).trim();
} catch {
  sha = 'nosha'; /* not a git checkout — still versioned, just untraceable */
}
const marker = `gobi-core:${coreVersion} ${sha}`;

/* The handshake: the plugin's declared dependency must match the core being
 * bundled, or the artifact lies about what is inside it. */
const depVersion = JSON.parse(readFileSync(join(pkg, 'package.json'), 'utf8'))
  .dependencies['@techgoblin/gobi-core'];
if (depVersion !== '*' && depVersion !== coreVersion) {
  console.error(`build: dependency handshake failed — package.json pins @techgoblin/gobi-core@${depVersion} but the workspace core is ${coreVersion}`);
  process.exit(1);
}

/* ORDER MATTERS (the MCP package's lesson): the core's `exports` map
 * resolves `types` to packages/gobi/dist/index.d.ts, so the core is rebuilt
 * FIRST — otherwise a stale dist silently drops new exports and tsc checks
 * against yesterday's shapes. Also note the repo compiles strict:false; this
 * package keeps its own strict:true tsconfig and reads the core through its
 * built .d.ts, never through a paths alias into strict-checked sources. */
execFileSync(process.execPath, ['scripts/build.mjs'], {cwd: join(pkg, '..', '..', 'packages/gobi'), stdio: 'inherit'});

execFileSync(process.execPath, [tscBin, '-p', join(pkg, 'tsconfig.json')], {stdio: 'inherit'});

rmSync(join(pkg, 'main.js'), {force: true});
execFileSync(esbuildBin, [
  join(pkg, 'src/main.ts'),
  '--bundle', '--format=cjs', '--platform=browser', '--target=es2018',
  '--minify', '--legal-comments=inline', '--log-level=error',
  '--external:obsidian',
  `--define:BUNDLED_GOBI_CORE=${JSON.stringify(marker)}`,
  `--outfile=${join(pkg, 'main.js')}`,
], {stdio: 'inherit'});

const bytes = statSync(join(pkg, 'main.js')).size;
const BUDGET = 1_500_000; /* §E: plugin main.js <= 1.5 MB minified */
console.log(`apps/obsidian-gobi: main.js ${bytes} B (budget ${BUDGET} B), marker ${JSON.stringify(marker)}`);
if (bytes > BUDGET) {
  console.error(`build: main.js is over budget by ${bytes - BUDGET} B (SPEC-GOBI-CORE §E)`);
  process.exit(1);
}
