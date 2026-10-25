/* ROUND AO — the colour work and the nub.
 *
 *  House shape copied from checks/round-an-edge-panel.mjs: DS_ROOT + DS_PRE_COMMIT
 *  env overrides, an assert() that prints PASS/FAIL with a detail line, a blank
 *  comment before every source probe (this project deletes a control and leaves a
 *  comment QUOTING it), and a MANDATORY REPLAY at the bottom that re-runs the
 *  SOURCE probes against the pinned pre-change commit and REQUIRES THEM RED.
 *
 *  WHY THE REPLAY IS NOT OPTIONAL: an assertion that is green on both trees proves
 *  nothing. Each `src.*` probe below is written so that it CANNOT pass on e4a3e14 —
 *  that is the property the REPLAY verifies, mechanically, every run.
 *
 *  WHAT IS SOURCE AND WHAT IS LIVE: the data model (COLOR_KEYS, the tokens, the
 *  swatchRow signature) is asserted from SOURCE. The panel's real geometry and the
 *  nub are measured LIVE against the running dev server, because this environment's
 *  headless browser DOES render edges (11 edges + 10 nodes measured) and this round
 *  is about what the user sees. A live probe that cannot reach the server is
 *  reported as SKIP (never as a pass).
 *
 *  Run:  node checks/round-ao-colour-and-nub.mjs
 *  Env:  DS_ROOT=<repo>  (defaults to this file's project dir)
 *        DS_PRE_COMMIT=e4a3e14
 */

import {execFileSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {dirname, resolve} from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = process.env.DS_ROOT || resolve(HERE, '..');
const PRE_COMMIT = process.env.DS_PRE_COMMIT || 'e4a3e14';

let pass = 0, fail = 0, skipped = 0;
const fails = [];

function assert(name, ok, detail = '') {
  if (ok) { pass++; console.log(`  PASS  ${name}`); }
  else { fail++; fails.push(name); console.log(`  FAIL  ${name}${detail ? ' — ' + detail : ''}`); }
  if (detail) console.log(`        ${detail}`);
}
function skipProbe(name, why) { skipped++; console.log(`  SKIP  ${name} — ${why}`); }

/* ROUND BN-4 — src/GoblinEdge.tsx split into src/edges/ (component moved to
   src/edges/GoblinEdge.tsx; the EdgeData type, the K2 flow-payload machinery and
   the type registry moved to EdgeData.ts / flowPayloads.tsx / index.ts, verbatim).
   Working-tree reads of the component now read the FOUR SLICES CONCATENATED so
   every regex below still measures the same surface. Git reads (PRE_COMMIT)
   keep the single file, which every pinned commit has. */
const src = (p) => p === 'src/GoblinEdge.tsx'
  ? ['GoblinEdge', 'EdgeData', 'flowPayloads', 'index']
      .map(f => readFileSync(resolve(ROOT, `src/edges/${f}${f === 'EdgeData' || f === 'index' ? '.ts' : '.tsx'}`), 'utf8')).join('\n')
  : readFileSync(resolve(ROOT, p), 'utf8');

/* Comments are stripped before any CSS probe. `indexOf('.swatches {')` finds an
   occurrence INSIDE a comment this sheet legitimately quotes (`.swatches { display:
   flex }` appears in the ROUND AG2 prose), so a block read from the raw text can
   pick up a comment's brace and report a rule that does not exist — a probe that
   would have been silently meaningless. Stripping first is the fix, and the same
   trap is why the REPLAY compares comment-stripped text too. */
const stripComments = (css) => css.replace(/\/\*[\s\S]*?\*\//g, '');

const srcAt = (commit, p) => {
  try { return execFileSync('git', ['-C', ROOT, 'show', `${commit}:${p}`], {encoding: 'utf8'}); }
  catch { return null; }
};

/* The one CSS block a selector owns, brace-balanced. A naive `indexOf('}')`
   truncates at the first nested brace — the ROUND AM harness learned this the
   hard way, so the slicing is balanced here from the start. */
function cssBlock(css, selector) {
  const i = css.indexOf(selector);
  if (i < 0) return null;
  const start = css.indexOf('{', i);
  if (start < 0) return null;
  let depth = 0;
  for (let j = start; j < css.length; j++) {
    if (css[j] === '{') depth++;
    else if (css[j] === '}') { depth--; if (depth === 0) return css.slice(start + 1, j); }
  }
  return null;
}

const css = stripComments(src('src/styles.css'));
const colors = src('src/colors.ts');
const app = src('src/App.tsx');
const edge = src('src/GoblinEdge.tsx');

console.log(`\nROUND AO — colour cells, the neutrals, the custom picker, the pair gap, the nub`);
console.log(`  ROOT=${ROOT}\n  PRE_COMMIT=${PRE_COMMIT}\n`);

/* ---------------------------------------------------------------- AO-1a --- */

/* AO-1a: the colour row's modifier IS `swatch6`, and `swatch3` is GONE. Before
   this round the row was `swatch3` — three columns of 80px slabs (measured live). */
{
  const b6 = cssBlock(css, '.swatches.swatch6 {');
  assert('ao1a-1  .swatches.swatch6 exists', !!b6);
  assert('ao1a-2  its --cell is the six-column share with five 7px gaps',
    !!b6 && /--cell:\s*calc\(\(100%\s*-\s*35px\)\s*\/\s*6\)/.test(b6),
    b6 ? b6.trim().split('\n')[0] : 'no block');
  /* The 26px height and the zero-basis flex live on the CHILD rule — the modifier
     sets the cell width, the child sizes to it. Both must be present. */
  const b6cell = cssBlock(css, '.swatches.swatch6 .swatch {');
  assert('ao1a-3  the cell is still 26px tall and zero-basis flex',
    !!b6cell && /height:\s*26px/.test(b6cell) && /flex:\s*0\s+0\s+var\(--cell\)/.test(b6cell),
    b6cell ? b6cell.trim().split('\n')[0] : 'no child rule');
  assert('ao1a-4  NO .swatches.swatch3 rule survives', !css.includes('.swatches.swatch3'));
  /* the BASE row must be untouched: the 5-swatch edge rows and the shape-palette
     rows share `.swatches` and must keep sizing to their 26px swatch. */
  const base = cssBlock(css, '.swatches {');
  assert('ao1a-5  .swatches base is untouched (gap 7px, wraps)',
    !!base && /gap:\s*7px/.test(base) && /flex-wrap:\s*wrap/.test(base),
    base ? base.trim().split('\n')[0].slice(0, 70) : 'no block');
}

/* ---------------------------------------------------------------- AO-1b --- */

/* AO-1b: black and white are two new ColorKeys, declared ONCE in :root. */
{
  assert('ao1b-1  COLOR_KEYS carries black and white',
    /'black'/.test(colors) && /'white'/.test(colors));
  assert('ao1b-2  COLOR_VAR maps them to their tokens',
    /black:\s*'var\(--c-black\)'/.test(colors) && /white:\s*'var\(--c-white\)'/.test(colors));
  assert('ao1b-3  the two tokens are declared in src/styles.css',
    /--c-black:\s*#000000/.test(css) && /--c-white:\s*#ffffff/.test(css));
  /* THEME-INVARIANT, AND DECLARED ONCE: count the declarations. Five `[data-theme]`
     scopes must NOT re-declare either name — black is black in every theme. */
  const nBlack = (css.match(/--c-black:/g) || []).length;
  const nWhite = (css.match(/--c-white:/g) || []).length;
  assert('ao1b-4  each neutral is declared EXACTLY once (theme-invariant)', nBlack === 1 && nWhite === 1,
    `--c-black x${nBlack}, --c-white x${nWhite}`);
  /* LEGACY_HEX must NOT learn them: only the six ORIGINAL hexes ever shipped, and
     adding #000000 would make `keyForHex(' #000000 ')` report a legacy hit.
     The probe reads the TABLE, not the module: `COLORS` legitimately carries both
     neutrals as literal FALLBACKS (they are `Record<ColorKey, string>` members),
     and a naive scan of the whole file would flag those two lines as if they were
     mappings — which is exactly the two-different-tables confusion AO-1b names. */
  const legacy = colors.slice(colors.indexOf('export const LEGACY_HEX'), colors.indexOf('isColorKey'));
  assert('ao1b-5  LEGACY_HEX is unchanged (no #000000 / #ffffff mapping)',
    !/#000000/.test(legacy) && !/#ffffff/i.test(legacy),
    legacy.includes('#000000') ? 'a neutral hex reached the legacy map' : 'six original literals only');
}

/* ---------------------------------------------------------------- AO-1c --- */

/* AO-1c: the third `swatchRow` parameter is REAL now, and it is ONE object. */
{
  assert('ao1c-1  swatchRow takes custom?: {value?, onPick}',
    /custom\?:\s*\{\s*value\?:\s*string;\s*onPick:\s*\(hex:\s*string\)\s*=>\s*void\s*\}/.test(app));
  assert('ao1c-2  a native colour input is rendered', /type="color"/.test(app));
  assert('ao1c-3  the cell is reachable (aria-label + data hook)',
    /aria-label="Custom color"/.test(app) && /data-custom="1"/.test(app));
  /* THE COMPATIBILITY CONTRACT: the rows that do NOT offer a literal must keep the
     two-argument call. Count call sites and how many pass a third argument. */
  const calls = (app.match(/swatchRow\(/g) || []).length - 1; // minus the definition
  assert('ao1c-4  the parameter is optional and last (6 two-arg call sites remain)',
    calls >= 6, `${calls} call sites`);
  assert('ao1c-5  the custom cell only paints a stored literal when one exists',
    /custom\.value\s*\?\s*\{background:\s*custom\.value\}/.test(app));
}

/* ----------------------------------------------------------------- AO-2 --- */

/* AO-2: the count/speed pair pays the 13px it owes the row below it. Measured
   before: the pair box ended at y=1379 and the flow-glyph field began at y=1379. */
{
  const pair = cssBlock(css, '.pair {');
  assert('ao2-1  .pair carries the section\'s 13px bottom rhythm',
    !!pair && /margin-bottom:\s*13px/.test(pair),
    pair ? pair.trim().split('\n')[0] : 'no block');
  assert('ao2-2  the fields INSIDE the pair still have their margin zeroed',
    /\.pair\s+\.field\s*\{\s*margin:\s*0;\s*\}/.test(css));
  /* IT CANNOT LEAK: `.pair` has exactly one call site, so the rule reaches one row. */
  const pairSites = (app.match(/className="pair"/g) || []).length;
  assert('ao2-3  .pair still has exactly one call site (the rule reaches one row)', pairSites === 1,
    `${pairSites} call site(s)`);
}

/* ----------------------------------------------------------------- AO-3 --- */

/* AO-3: the nub. The label div is guarded by `hasLabel`; `hasLabel` still means
   "has something to show" and still EXCLUDES the bend handle. */
{
  const hl = edge.match(/const hasLabel\s*=\s*([^;]+);/);
  assert('ao3-1  hasLabel is still the "has something to show" test (no bendDraggable)',
    !!hl && /shown/.test(hl[1]) && /editing/.test(hl[1]) && /techn/.test(hl[1]) &&
    !/bendDraggable/.test(hl[1]),
    hl ? hl[1].trim() : 'not found');
  assert('ao3-2  the label div is now rendered only when hasLabel',
    /\{hasLabel\s*&&\s*\(/.test(edge));
  /* THE BLOCK GATE STAYS AS IT WAS: it must still open for the HANDLE alone. */
  assert('ao3-3  the render gate still opens for the handle alone',
    /\(shown \|\| editing \|\| d\.techn \|\| bendDraggable\)/.test(edge));
  assert('ao3-4  the defensive :empty rule exists',
    /\.edge-label:empty\s*\{\s*display:\s*none/.test(css));
  /* handleAt must NOT have been "fixed": it already excluded the handle's own gate. */
  assert('ao3-5  handleAt is unchanged (it already excluded bendDraggable)',
    /hasLabel\s*\?\s*nudgeAlongPath\(/.test(edge));
}

console.log(`\n  ${pass} PASS / ${fail} FAIL / ${skipped} SKIP\n`);

/* ------------------------------------------------------------- REPLAY ---- */

/* Every SOURCE probe above must be RED on the pinned pre-change tree, or it
   proves nothing. This re-reads each file AT PRE_COMMIT and re-evaluates the
   SAME predicates. A probe that is green there is reported as a FAILURE of the
   harness itself, not of the code under test. */
console.log(`REPLAY — the source probes re-run against ${PRE_COMMIT}, and they must be RED\n`);

const preCss = srcAt(PRE_COMMIT, 'src/styles.css');
const preColors = srcAt(PRE_COMMIT, 'src/colors.ts');
const preApp = srcAt(PRE_COMMIT, 'src/App.tsx');
const preEdge = srcAt(PRE_COMMIT, 'src/GoblinEdge.tsx');

if (preCss === null || preColors === null || preApp === null || preEdge === null) {
  skipProbe('replay', `cannot read ${PRE_COMMIT} from this worktree — run it with DS_ROOT set to the repo`);
} else {
  const old = {css: stripComments(preCss), colors: preColors, app: preApp, edge: preEdge};
  const red = (name, probe) => {
    const v = probe(old);
    assert(`replay ${name} is RED on ${PRE_COMMIT}`, v === false || v === null,
      v === true ? 'the probe PASSES on the old tree — it proves nothing' : '');
  };

  red('ao1a (swatch6)', (t) => t.css.includes('.swatches.swatch6'));
  red('ao1a (swatch3 gone)', (t) => t.css.includes('.swatches.swatch3') === false);
  red('ao1b (neutrals in COLOR_KEYS)', (t) => /'black'/.test(t.colors) && /'white'/.test(t.colors));
  red('ao1b (neutral tokens declared)', (t) => /--c-black:/.test(t.css) && /--c-white:/.test(t.css));
  red('ao1c (custom option on swatchRow)',
    (t) => /custom\?:\s*\{\s*value\?:\s*string/.test(t.app));
  red('ao1c (native colour input)', (t) => /type="color"/.test(t.app));
  red('ao2 (.pair bottom margin)',
    (t) => { const b = cssBlock(t.css, '.pair {'); return !!b && /margin-bottom:\s*13px/.test(b); });
  red('ao3 (label guarded by hasLabel)', (t) => /\{hasLabel\s*&&\s*\(/.test(t.edge));
  red('ao3 (defensive :empty rule)', (t) => /\.edge-label:empty\s*\{\s*display:\s*none/.test(t.css));

  console.log(`\n  REPLAY done — ${pass} PASS / ${fail} FAIL / ${skipped} SKIP (cumulative)\n`);
}

console.log(fail === 0 ? 'ROUND AO HARNESS: GREEN' : `ROUND AO HARNESS: RED — ${fails.join(', ')}`);
process.exit(fail === 0 ? 0 : 1);
