#!/usr/bin/env node
/**
 * ROUND AW harness — the CANVAS node tint never paints (card t_b7f884b9).
 *
 *   Harvey's decision A (2026-10-21): the canvas is the side that is wrong;
 *   the exported SVG is already right. Do not change the exporter's fill.
 *
 *   DEFECT — `shapeFrameMarkup` (src/shapes.tsx, the CANVAS render path)
 *   passed `fill: 'transparent'` + `fillOpacity: '0.09'` into the shared
 *   `frameMarkup` table, so every frame primitive in the live DOM carried
 *   `fill="transparent" fill-opacity="0.09"`: opacity × transparent =
 *   transparent. The orphan 0.09 is the fossil of the original intent.
 *   The exporter (src/exportSvg.ts) passes a RESOLVED literal hex, so the
 *   exported SVG is the only surface that shows the tint.
 *
 *   WHY `transparent` WAS THERE — do not repeat it: `var()` is NOT valid
 *   inside an SVG presentation attribute, so `fill="var(--nc)"` silently
 *   fails and the primitive falls back to transparent/initial. The fill
 *   must therefore live where `var()` IS valid: an inline `style`
 *   attribute. The fix emits
 *     style="fill:var(--nc, var(--border-strong));fill-opacity:0.09"
 *   on the frame primitives — and KEEPS fill-opacity as a separate 0.09
 *   (not folded into a color-mix alpha), because buildPng's resolution
 *   pass (src/App.tsx, ROUND AV defect-2) keys on
 *   `0 < computed fillOpacity < 1` to rewrite the clone's fill as
 *   rgba(r,g,b,op); folding the alpha into `fill` would slip past it and
 *   re-break the PNG tint (measured in round-av).
 *
 *   Asserted DOM-FREE by bundling the real src/shapes.tsx (esbuild, the
 *   round-av pattern) and calling BOTH public entries:
 *     - `shapeFrameMarkup`  = the canvas contract: a real `--nc` fill via
 *       style, 0.09 opacity, and NOT the string `transparent`;
 *     - `shapeFrameSvg`     = the exporter's contract, called EXACTLY as
 *       exportSvg.ts calls it: literal resolved hex + `fill-opacity`,
 *       no style attribute (byte-comparable structure, the harness on
 *       round-ar-svg-export parses it).
 *   Source contracts pin the two invariants that make the pair hold in
 *   the LIVE app: the exporter call site stays literal, and
 *   buildPng's opacity-keyed resolution pass is still present.
 *
 *   The painted proof (canvas pixel sample vs SVG fill vs PNG pixel, both
 *   themes, the probe board's 3 nodes) is the live pass recorded on the
 *   card — this file cannot see a browser.
 *
 *   RED on ba3bee0 (assertions aw1/aw2 fail — the canvas markup carries
 *   `fill="transparent"` and no style fill); GREEN is the fix tree.
 */
import {readFileSync, writeFileSync, rmSync, existsSync} from 'node:fs';
import {join, dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';

const HERE = dirname(fileURLToPath(import.meta.url));
const REAL_ROOT = join(HERE, '..');
const ROOT = process.env.AR_ROOT || REAL_ROOT;

const results = [];
const assert = (id, pass, detail = '') => {
  results.push({id, pass: !!pass, detail});
  console.log(`  ${pass ? 'PASS' : 'FAIL'}  ${id}  —  ${detail}`);
};

console.log('ROUND AW — the canvas frame tint (style fill, not the transparent attribute)');
console.log(`  target root: ${ROOT}`);

/* ---------------------------------------------------------------- bundle -- */

const bundleAndImport = async () => {
  const entry = join(ROOT, '.aw-entry.ts');
  const out = join(ROOT, '.aw-out.mjs');
  writeFileSync(entry,
    `export {shapeFrameMarkup, shapeFrameSvg} from '${join(ROOT, 'src/shapes.tsx')}';\n`);
  const esbuild = existsSync(join(ROOT, 'node_modules/.bin/esbuild'))
    ? join(ROOT, 'node_modules/.bin/esbuild')
    : join(REAL_ROOT, 'node_modules/.bin/esbuild');
  writeFileSync(out, execFileSync(esbuild,
    [entry, '--bundle', '--platform=node', '--format=esm', '--log-level=error',
     '--external:react', '--external:react-dom', '--external:react/jsx-runtime',
     '--external:@xyflow/react'],
    {encoding: 'utf8', env: {...process.env, NODE_PATH: join(REAL_ROOT, 'node_modules')}}));
  const mod = await import(`${out}?t=${Date.now()}`);
  rmSync(entry, {force: true});
  rmSync(out, {force: true});
  return mod;
};

let MOD = null;
let bundleError = '';
try { MOD = await bundleAndImport(); } catch (e) { bundleError = String(e?.message ?? e); }
if (!MOD) {
  assert('module', false, `real src/shapes.tsx could not be bundled from this root — ${bundleError}`);
  process.exit(1);
}
assert('module', true, 'real src/shapes.tsx bundled and imported');
const {shapeFrameMarkup, shapeFrameSvg} = MOD;

/* The `nc` argument EXACTLY as ShapeFrame passes it (the var() chain the
   canvas inherits from the node's `--nc` custom property). */
const NC = 'var(--nc, var(--border-strong))';
/* the canvas paint: fill via style (var() is valid there), the 9% alpha as
   the separate fill-opacity attribute buildPng's pass keys on */
const CANVAS_FILL_STYLE = `fill:${NC}`;
const CANVAS_TINT = (m) => m.includes(`style="${CANVAS_FILL_STYLE}"`) && /fill-opacity="0\.09"/.test(m);

/* The exporter's EXACT paint (exportSvg.ts:933): literal resolved hex. */
const EXPORT_PAINT = {fill: '#5b21b6', stroke: '#5b21b6', fillOpacity: '0.09', plain: true};

/* ------------------------------------- AW1 — the canvas fill is REAL paint - */

/* The probe board's three shapes: database (cylinder — the shared `a`
   primitives), service (rounded rect), external (dashed rect). */
for (const shape of ['service', 'database', 'external']) {
  const m = shapeFrameMarkup(shape, NC, true);
  assert(`aw1-canvas-${shape}-fill-is-not-transparent`,
    !/fill="transparent"/.test(m),
    `no frame primitive carries fill="transparent" (the RED shape — opacity × transparent = transparent)`);
  assert(`aw1-canvas-${shape}-style-carries-nc-fill`,
    CANVAS_TINT(m),
    `the frame primitives carry style="${CANVAS_FILL_STYLE}" + fill-opacity="0.09" — var() is valid in a style, never in a presentation attribute`);
}

/* --------------------------------- AW2 — the cylinder: both `a` primitives - */

/* The cylinder's ellipse + body path SHARE the frame paint `a`; both must
   carry the tint. The inner ring arcs (plain === false) stay fill="none". */
const cylRings = shapeFrameMarkup('database', NC, false);
/* the paint string is LITERAL text — escape it before it becomes a pattern
   (its var(--nc, ...) parens would otherwise read as regex groups) */
const tintPattern = new RegExp(CANVAS_FILL_STYLE.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
const tintedCount = (cylRings.match(tintPattern) ?? []).length;
const opCount = (cylRings.match(/fill-opacity="0\.09"/g) ?? []).length;
assert('aw2-cylinder-ellipse-and-body-both-tinted',
  tintedCount === 2 && opCount === 2,
  `the cylinder's TWO frame primitives (ellipse + body path) each carry the tint (style fill ${tintedCount}/2, fill-opacity 0.09 ${opCount}/2)`);
assert('aw2-cylinder-ring-arcs-stay-fill-none',
  /<path d="M4 42[^>]*fill="none"/.test(cylRings) && /<path d="M4 60[^>]*fill="none"/.test(cylRings),
  'the two inner ring arcs keep fill="none" — detail strokes, never the tint');

/* ----------------------------- AW3 — the exporter's contract is UNCHANGED -- */

/* Byte-level structure: literal fill attribute + fill-opacity attribute,
   and NO style attribute (a standalone SVG file resolves no CSS there —
   and round-ar-svg-export parses this exact shape). */
for (const shape of ['service', 'database', 'external']) {
  const m = shapeFrameSvg(shape, EXPORT_PAINT);
  assert(`aw3-export-${shape}-literal-fill-opacity`,
    /fill="#5b21b6" fill-opacity="0\.09"/.test(m),
    'the exported markup keeps the exporter\'s literal resolved fill + fill-opacity attributes');
  assert(`aw3-export-${shape}-no-style-attr`,
    !/style="/.test(m),
    'no style attribute in the exported markup — the exporter speaks in attributes with literal values only');
}

/* ------------------- AW4 — source contracts that hold the LIVE pair together */

const shapesSrc = readFileSync(join(ROOT, 'src', 'shapes.tsx'), 'utf8');
const exportSrc = readFileSync(join(ROOT, 'src', 'exportSvg.ts'), 'utf8');

/* The exporter call site (exportSvg.ts) still speaks LITERALS — nobody
   "simplified" it onto the canvas path. ROUND AY: the call moved into the
   scene emitter (emitContentInto) but the CONTRACT is the same call shape
   with the scene's resolved accent. */
const callSite = /shapeFrameSvg\(asShape\(n\.data\?\.shape\), \{fill: (?:accent|n\.accent), stroke: (?:accent|n\.accent), fillOpacity: '0\.09'/.test(exportSrc);
assert('aw4-exporter-call-site-still-literal', callSite,
  'exportSvg.ts still passes {fill: accent, stroke: accent, fillOpacity: \'0.09\'} — the export contract did not move');

/* `fillStyle` (or whatever carries the canvas paint) is OPTIONAL on
   FramePaint — the exporter call sites compile unchanged. */
const paintType = (shapesSrc.match(/type FramePaint = \{[\s\S]*?\};/) ?? [''])[0];
assert('aw4-framepaint-fill-style-optional',
  /fillStyle\?:/.test(paintType),
  'FramePaint carries the canvas fill as an OPTIONAL field (fillStyle?:) — the exporter call sites compile unchanged');

/* shapeFrameMarkup's signature is untouched (ShapeFrame passes nc + plain). */
assert('aw4-shapeframemarkup-signature-unchanged',
  /export function shapeFrameMarkup\(shape: Shape, nc: string, plain: boolean\): string/.test(shapesSrc),
  'shapeFrameMarkup(shape, nc, plain) keeps its signature — ShapeFrame and every caller compile unchanged');

/* buildPng's opacity-keyed resolution pass — ROUND AY item 4 RE-HOME: the
   clone-side rgba() fold is DELETED; the tint resolution moved INTO
   buildScene (the emitter writes fill=<accent literal> fill-opacity="0.09"),
   and buildPng just rasterises that svgString. The new-form assertion: the
   builder delegates to the scene path and contains no fill rewriting. */
const appSrc = readFileSync(join(ROOT, 'src', 'App.tsx'), 'utf8');
const pngStart = appSrc.indexOf('const buildPng');
const pngEnd = appSrc.indexOf('\n  // ---- import JSON ----', pngStart);
const pngBody = pngStart >= 0 && pngEnd > pngStart ? appSrc.slice(pngStart, pngEnd) : '';
assert('aw4-buildpng-opacity-keyed-resolution-pass',
  /buildSvg\(/.test(pngBody) && /rasterise\(/.test(pngBody) && !/rgba\(/.test(pngBody),
  'buildPng performs NO fill rewriting — the tint arrives in the svgString from the scene (fill=<accent> fill-opacity=0.09), rasterised as-is (the live tint proof is the pixel-diff)');

/* ------------------------------------------------------------------ end -- */

const fails = results.filter(r => !r.pass);
console.log(`\n${results.length - fails.length}/${results.length} assertions PASS${fails.length ? `, ${fails.length} FAIL` : ''}`);
process.exit(fails.length ? 1 : 0);
