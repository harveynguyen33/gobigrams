#!/usr/bin/env node
/**
 * ROUND AR PASS 3 harness — AR-7 / AR-8 / AR-9 / AR-10.
 *
 * House style: no browser, no DOM, no CDP. Source-level assertions read the
 * files as text (comments blanked before counting — the round-ad rule: a
 * grep-count of a banned token must not be able to match a comment that
 * merely names it). The AR-10 parity fixture drives the REAL emitter through
 * the project's own esbuild bundle with a deterministic stub measurer, and
 * asserts on the emitted <text> lines, never on the implementation.
 *
 * Negative control: run with AR_ROOT pointed at the pre-fix tree
 * (git worktree/checkout of 6bcd01c) — several rows must FAIL there. The
 * harness reports the RED rows and exits non-zero when any FAIL exists.
 */
import {readFileSync, writeFileSync, rmSync, existsSync, mkdtempSync} from 'node:fs';
import {join, dirname} from 'node:path';
import {tmpdir} from 'node:os';
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

console.log('ROUND AR PASS 3 — AR-7/AR-8/AR-9/AR-10 (source + emitted-output assertions)');
console.log(`  target root: ${ROOT}`);

/** Strip comments so a banned token inside a comment can never be counted. */
const stripComments = (src) =>
  src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/[^\n]*/g, '$1')
    .replace(/^[ \t]*\{?\/\*[\s\S]*?\*\/\}?[ \t]*$/gm, '');

const read = (p) => {
  try { return readFileSync(join(ROOT, p), 'utf8'); } catch { return null; }
};

/* ------------------------------------------------ AR-10: real-emitter run -- */

const bundleAndImport = async () => {
  /* the OUT file must live INSIDE ROOT so the bundler's `external: react`
     imports resolve against ROOT/node_modules (the round-ar-svg-export
     pattern). Scratch dirs have no node_modules. */
  const entry = join(ROOT, '.ar-pass3-entry.ts');
  const out = join(ROOT, '.ar-pass3-out.mjs');
  writeFileSync(entry, `export {exportSvg} from '${join(ROOT, 'src/exportSvg.ts')}';\n`);
  const esbuild = existsSync(join(ROOT, 'node_modules/.bin/esbuild'))
    ? join(ROOT, 'node_modules/.bin/esbuild')
    : join(REAL_ROOT, 'node_modules/.bin/esbuild');
  writeFileSync(out, execFileSync(esbuild,
    [entry, '--bundle', '--platform=node', '--format=esm', '--log-level=error',
     '--external:@xyflow/react'],
    {encoding: 'utf8',
     /* the entry may live in a worktree without node_modules (the RED
        control) — let esbuild resolve react from the real repo */
     env: {...process.env, NODE_PATH: join(REAL_ROOT, 'node_modules')}}));
  const mod = await import(`${out}?t=${Date.now()}`);
  rmSync(entry, {force: true});
  rmSync(out, {force: true});
  return mod;
};

/** Deterministic advance: 6 px per character (size-independent, so the
 *  fixture numbers are stable) — "Ship it" (7 chars) measures 42 ≤ 47, so the
 *  canvas keeps it on ONE line at a 47 px title; at the 30 px body the same
 *  text MUST wrap. Long titles wrap at whatever box the measurer reports. */
const stubMeasure = (text, o) => text.length * 6 + Math.max(0, text.length - 1) * (o.spacing ?? 0);

const stubMeasurer = (bodyW, titleW) => ({
  text() {
    return {x: 10, y: 8, w: bodyW, h: 60, size: 14.5, weight: 650, fill: '#e8e8ea', anchor: 'start', titleW};
  },
  edgePath() { return null; },
  measureText: stubMeasure,
});

const emittedTitleLines = (svg, nodeId) => {
  const g = svg.split(`<g data-ar-node="${nodeId}"`)[1]?.split('</g>')[0] ?? '';
  return [...g.matchAll(/<text [^>]*>([^<]*)<\/text>/g)].map(m => m[1]);
};

let MOD = null;
let bundleError = '';
try { MOD = await bundleAndImport(); } catch (e) { bundleError = String(e?.message ?? e); }

/* ------------------------------------------------------------------ AR-7 -- */

console.log('\nAR-7 — attribution kept and themed');

const app = read('src/App.tsx') ?? '';
assert('AR7-no-hideAttribution', !/hideAttribution/.test(stripComments(app)),
  'src/App.tsx carries no hideAttribution (comment-stripped)');

const css = read('src/styles.css') ?? '';
assert('AR7-css-attribution-not-hidden',
  !new RegExp('\\.react-flow__attribution[^}]*\\{[^}]*(display\\s*:\\s*none|visibility\\s*:\\s*hidden|opacity\\s*:\\s*0)').test(css),
  'no css rule hides the attribution element');

const themed = (css.match(/\.react-flow__attribution\s*\{[\s\S]*?\}/g) ?? []).join('\n');
const usesTokens = /var\(--(bg|surface|border|fg|dim2)\)/.test(themed);
const noHex = !/#[0-9a-fA-F]{3,8}\b/.test(themed);
assert('AR7-attribution-themed-from-tokens', usesTokens && noHex && themed.length > 0,
  `attribution block uses theme tokens (${usesTokens}) and no hex literals (${noHex})`);

/* ------------------------------------------------------------------ AR-8 -- */

console.log('\nAR-8 — no element.ref access');

const tip = read('src/Tooltip.tsx') ?? '';
/* element.ref access — the removed-in-19 mechanism is a `.ref` read off a
   value that is an ELEMENT (a cast such as `(child as any)` or an element
   variable). A `.ref` read off a `props` cast is the CORRECT React 19 form
   and must not trip this row. */
const strippedTip = stripComments(tip);
const elementRefRead = [/\bas any\s*\)\s*\.ref\b/, /\bchild\s*\)\s*\.ref\b/, /\belement\s*\)\s*\.ref\b/, /\bnode\s*\)\s*\.ref\b/]
  .some(re => re.test(strippedTip));
assert('AR8-no-element-ref-read', !elementRefRead,
  'Tooltip.tsx never reads .ref off a child ELEMENT (props-ref reads are the correct form and are not flagged)');

const readsPropsRef = /props\s*as[^;]*\)?\.ref|\bprops\)\.ref/.test(stripComments(tip));
assert('AR8-ref-from-props', readsPropsRef, 'the chained ref is read from child.props');

const otherRefs = ['src/App.tsx', 'src/GoblinEdge.tsx', 'src/LabelNode.tsx']
  .map(p => ({p, hit: /\bas any\)\.ref\b/.test(stripComments(read(p) ?? ''))}))
  .filter(x => x.hit);
assert('AR8-no-other-element-ref-reads', otherRefs.length === 0,
  otherRefs.length === 0 ? 'no other createElement-time element.ref reads in src entry points'
    : `still reading element.ref: ${otherRefs.map(x => x.p).join(', ')}`);

/* ------------------------------------------------------------------ AR-9 -- */

console.log('\nAR-9 — copy: plural helper, American spelling');

const em = read('src/ExportModal.tsx') ?? '';
assert('AR9-no-colours', !/colours/i.test(em), 'no "colours" anywhere in ExportModal.tsx');

const helper = /const\s+count\s*=\s*\(n:\s*number,\s*unit:\s*string\)/.test(em)
  || /function\s+count\s*\(\s*n:\s*number,\s*unit:\s*string\s*\)/.test(em);
assert('AR9-helper-exists', helper, 'a typed count(n, unit) pluraliser is defined');

const rawCounts = [...em.matchAll(/\$\{[^}]*nodes\.length\}\s+nodes|\$\{[^}]*edges\.length\}\s+edges/g)];
assert('AR9-all-counts-through-helper', helper && rawCounts.length === 0,
  rawCounts.length === 0
    ? 'every count string goes through count(); no hand-written "N nodes"/"N edges" remains'
    : `hand-written count strings remain: ${rawCounts.map(m => m[0]).join(' | ')}`);

const callSites = (em.match(/count\((scoped|parsed)\.(nodes|edges)\.length,\s*'(node|edge)'\)/g) ?? []).length;
assert('AR9-helper-call-sites', callSites >= 4,
  `${callSites} count() call sites (svg sub + json sub + import success, nodes+edges)`);

/* ----------------------------------------------------------------- AR-10 -- */

console.log('\nAR-10 — export wrap parity (fixture: title width > body width)');

if (!MOD) {
  assert('AR10-emitter-bundled', false, `real src/exportSvg.ts could not be bundled from this root — ${bundleError}`);
} else {
  assert('AR10-emitter-bundled', true, 'real src/exportSvg.ts bundled and imported');

  const tokens = {
    '--fg': '#e8e8ea', '--dim': '#8a8a92', '--surface': '#141417',
    '--bg': '#0b0b0d', '--border': '#26262b', '--acc': '#7c7cf0',
  };
  const node = (id, title) => ({
    id, type: 'goblin', position: {x: 0, y: 0},
    measured: {width: 200, height: 90},
    data: {title, shape: 'rect'},
  });
  const run = (measurer, nodes) => MOD.exportSvg({
    nodes, edges: [], theme: 'dark', tokens, measurer, pad: 10,
  });

  /* Fixture 1 — "Ship it": canvas 47 px title, 1 line; body only 30 px.
     Pre-fix the exporter wrapped to the BODY width (30 px) and emitted 2
     lines. Post-fix it wraps to titleW (47) and must emit exactly 1. */
  {
    const title = 'Ship it'; /* 7 chars * 6 px = 42 */
    const svg = run(stubMeasurer(30, 47), [node('n1', title)]);
    const lines = emittedTitleLines(svg, 'n1');
    assert('AR10-short-title-one-line', lines.length === 1 && lines[0] === title,
      `"${title}" at titleW 47 / body 30 → emitted ${lines.length} line(s): [${lines.join(' | ')}]`);

    /* negative inside the positive: the SAME node measured without a title
       box (titleW undefined → body width 30) still wraps — the fallback is
       the body width, and it still binds. */
    const svgBodyOnly = run(stubMeasurer(30, undefined), [node('n1b', title)]);
    const linesBody = emittedTitleLines(svgBodyOnly, 'n1b');
    assert('AR10-fallback-body-width-wraps', linesBody.length === 2,
      `no title element → body width 30 → emitted ${linesBody.length} line(s): [${linesBody.join(' | ')}]`);
  }

  /* Fixture 2 — long title: canvas wraps at 147 px content width into 3
     lines; the body reports 120 px, which yields 4 pre-fix. Both widths use
     the same stub advance, so the ONLY variable is which box drives the
     wrap. Advance at size 14.5: char px = 6 * 1.45 = 8.7 (+ spacing 0). */
  {
    const title = 'Order Ingestion Service With Very Long Name That Must Wrap'; /* 59 chars */
    const svg = run(stubMeasurer(120, 147), [node('n2', title)]);
    const lines = emittedTitleLines(svg, 'n2');
    /* canonical expectation computed from the stub advance (6 px/char) at
       titleW=147: */
    const charPx = (s) => s.length * 6;
    let expect = 1, cur = '';
    for (const w of title.split(' ')) {
      const cand = cur ? cur + ' ' + w : w;
      if (charPx(cand) <= 147) { cur = cand; continue; }
      expect++; cur = w;
    }
    const fitsAll = lines.every(ln => charPx(ln) <= 147 + 1e-9);
    assert('AR10-long-title-line-count', lines.length === expect,
      `long title at titleW 147 / body 120 → emitted ${lines.length} lines, canonical greedy wrap at 147 = ${expect}`);
    assert('AR10-lines-fit-title-width', fitsAll,
      fitsAll ? 'every emitted line advance fits the 147 px title content width'
        : `line(s) exceed 147 px: ${lines.filter(ln => charPx(ln) > 147).join(' | ')}`);
    /* the fixture really discriminates: the canonical greedy wrap at the
       120 px BODY width emits strictly more lines than at 147 px */
    const linesAt = (boxW) => {
      let n = 1, cur2 = '';
      for (const w of title.split(' ')) {
        const cand = cur2 ? cur2 + ' ' + w : w;
        if (charPx(cand) <= boxW) { cur2 = cand; continue; }
        n++; cur2 = w;
      }
      return n;
    };
    assert('AR10-body-width-would-over-wrap', linesAt(120) > linesAt(147),
      `stub advance: greedy wrap at 120 px body = ${linesAt(120)} lines vs 147 px title = ${linesAt(147)} — the two fixtures measure different things`);
  }
}

/* ------------------------------------------------------------------ report */

const fails = results.filter(r => !r.pass);
console.log(`\n${results.length - fails.length}/${results.length} assertions PASS`);
if (fails.length) {
  console.log(`RED — failing rows:\n${fails.map(r => `  FAIL ${r.id}  —  ${r.detail}`).join('\n')}`);
  process.exit(1);
}
console.log('GREEN');
