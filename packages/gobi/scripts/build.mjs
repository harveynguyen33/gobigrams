/* CORE-STEP4A — the @techgoblin/gobi-core build: ONE self-contained ESM bundle plus
 * declarations, no bundler of its own. esbuild is the repo's existing tool at
 * the repo's existing version (hoisted by the workspace); tsc emits the .d.ts.
 *
 /* CORE-STEP4A-FIX — the package is SELF-CONTAINED: the shared model modules
  * (palette, presets, layout, textStyle, the SVG emitter …) MOVED into
  * packages/gobi/src/model (they are no longer inlined from the app's src/).
  * dist/ mirrors src/ for the declarations and carries exactly ONE runtime
  * bundle. Nothing in the graph imports react, @xyflow/react or lucide — at
  * runtime OR in the declarations — which is the whole point of this round. */
import {execFileSync} from 'node:child_process';
import {createRequire} from 'node:module';
import {rmSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync} from 'node:fs';
import {dirname, join} from 'node:path';
import {fileURLToPath} from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const pkg = join(here, '..');
/* the esbuild binary is the NATIVE ELF at node_modules/esbuild/bin/esbuild —
 * execFileSync it directly (wrapping it in node dies on the ELF header). */
const esbuildBin = createRequire(import.meta.url).resolve('esbuild/bin/esbuild');
const tscBin = createRequire(import.meta.url).resolve('typescript/bin/tsc');

rmSync(join(pkg, 'dist'), {recursive: true, force: true});
mkdirSync(join(pkg, 'dist'), {recursive: true});

execFileSync(esbuildBin, [
  join(pkg, 'src/index.ts'),
  '--bundle', '--format=esm', '--platform=node', '--target=node18',
  `--outfile=${join(pkg, 'dist/index.js')}`,
], {stdio: 'inherit'});

execFileSync(process.execPath, [tscBin, '-p', join(pkg, 'tsconfig.json')], {stdio: 'inherit'});

/* CORE-STEP4A-FIX — a nodenext consumer (tsc --moduleResolution nodenext)
 * REQUIRES explicit file extensions in the emitted d.ts relative imports;
 * the sources are extensionless (app/vite style), so the declarations get
 * '.js' appended post-emit. Without this, installing the tarball and
 * type-checking fails with TS2834 on every relative import in index.d.ts. */
{
  const fix = (dir) => {
    for (const e of readdirSync(dir)) {
      const p = join(dir, e);
      if (statSync(p).isDirectory()) fix(p);
      else if (e.endsWith('.d.ts')) {
        const s = readFileSync(p, 'utf8');
        const out = s.replace(/from '(\.\.?\/[^']+?)'/g, (m, spec) =>
          /\.(js|json)$/.test(spec) ? m : `from '${spec}.js'`);
        if (out !== s) writeFileSync(p, out);
      }
    }
  };
  fix(join(pkg, 'dist'));
}

console.log('@techgoblin/gobi-core built: dist/index.js + dist/*.d.ts');
