#!/usr/bin/env node
/**
 * ROUND BG harness — ITEM A: crow's-foot NEW-edge defaults follow ERD_ENABLED.
 *
 * THE DEFECT (Harvey, 2026-10-24): he drew on a stored 'erd'-preset board
 * (boards/mvl3dlxwe682f662.json, 'Untitled') whose ERD_EDGES block carries
 * crowStart:'one' / crowEnd:'many'. Every NEW edge on that board is built from
 * `{...preset.edges, path}` through makeEdge, so a plain flowchart-style arrow
 * he drew between two boxes arrived with crow's-foot markers.
 * Harvey: "why does a normal arrow suddenly have crow's foot? absurd."
 *
 * THE FIX: since 46ecc24 the whole ERD create surface is hidden behind
 * ERD_ENABLED=false (src/presets.ts). The crow seeds on NEW edges follow the
 * SAME flag: when ERD_ENABLED === false, ERD_EDGES carries NO crowStart /
 * crowEnd and a plain markerEnd ArrowClosed — exactly like FLOWCHART_EDGES.
 * STORED edges keep their baked markers (this is about new-edge defaults
 * only; boards are never rewritten), and an EXPLICIT seed crowStart/crowEnd
 * (the erdTemplate relationship seeds) still passes through makeEdge — the
 * flag gates the preset-level DEFAULT, not the explicit per-edge authoring.
 *
 * EXECUTED against the real src/presets.ts via the project's own esbuild
 * (the round-af / round-be pattern). The flag value is READ FROM THE MODULE,
 * never hard-coded: with ERD_ENABLED === false the plain-arrow assertions
 * must hold; if the flag is ever flipped back to true the harness flips with
 * it and asserts the crow defaults return.
 *
 * NEGATIVE CONTROL (RED before the fix): run on the pre-change tree, the
 * plain-arrow and parity assertions FAIL (ERD_EDGES still seeds crow 'one'/
 * 'many' into every new edge) — recorded in the ROUND BG commit message.
 */
import {readFileSync, writeFileSync, rmSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {join, dirname} from 'node:path';
import {fileURLToPath} from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');

const results = [];
const assert = (id, pass, detail = '') => {
  results.push({id, pass: !!pass, detail});
  console.log(`  ${pass ? 'PASS' : 'FAIL'}  ${id}  —  ${detail}`);
};

console.log('='.repeat(78));
console.log('BG-A — the shipped preset module, EXECUTED (esbuild, real flag value)');
console.log('='.repeat(78));

const ENTRY = join(ROOT, '.bg-entry.ts');
const OUT = join(ROOT, '.bg-out.mjs');
writeFileSync(ENTRY,
  `export {makeEdge, ERD_EDGES, FLOWCHART_EDGES, ERD_ENABLED} from './src/presets';\n` +
  `export {isCrowFoot, CROW_FOOT_IDS} from './src/crowfoot';\n`);
writeFileSync(OUT, execFileSync(join(ROOT, 'node_modules/.bin/esbuild'),
  [ENTRY, '--bundle', '--platform=node', '--format=esm', '--log-level=error',
    '--external:react', '--external:react-dom', '--external:react/jsx-runtime', '--external:@xyflow/react'],
  {encoding: 'utf8'}));
const {makeEdge, ERD_EDGES, FLOWCHART_EDGES, ERD_ENABLED, isCrowFoot, CROW_FOOT_IDS} =
  await import(`${OUT}?t=${Date.now()}`);
rmSync(ENTRY, {force: true});
rmSync(OUT, {force: true});

console.log(`  ERD_ENABLED (read from the module) = ${ERD_ENABLED}`);
assert('bg-a.flag-is-read-not-hardcoded', typeof ERD_ENABLED === 'boolean',
  `the real flag value arrived through the module import: ERD_ENABLED === ${ERD_ENABLED} (flip the flag and every gate below flips with it)`);

const CROWS = new Set(CROW_FOOT_IDS);
const ends = (e) => ({
  start: e.markerStart && typeof e.markerStart === 'object' ? e.markerStart.type : null,
  end: e.markerEnd && typeof e.markerEnd === 'object' ? e.markerEnd.type : null,
});

if (ERD_ENABLED === false) {
  /* ---- the fix's claim: a NEW edge on an 'erd'-preset board is plain ----- */
  const plain = makeEdge('a', 'b', ERD_EDGES, 'bg-plain');
  const p = ends(plain);
  assert('bg-a.new-erd-edge-has-plain-arrowclosed-end',
    p.end === 'arrowclosed' && !CROWS.has(p.end),
    `makeEdge(a,b,ERD_EDGES) → markerEnd.type "${p.end}" — the plain ArrowClosed, not a crow's foot`);
  assert('bg-a.new-erd-edge-has-no-crow-start',
    p.start === null && !CROWS.has(p.start ?? ''),
    `markerStart is ${JSON.stringify(p.start)} — no crow glyph at the source end (pre-change: "one")`);

  /* ---- parity with FLOWCHART_EDGES, marker object for marker object ------ */
  const fc = makeEdge('a', 'b', FLOWCHART_EDGES, 'bg-fc');
  assert('bg-a.new-erd-edge-markers-equal-flowchart',
    JSON.stringify(plain.markerEnd) === JSON.stringify(fc.markerEnd)
      && JSON.stringify(plain.markerStart ?? null) === JSON.stringify(fc.markerStart ?? null),
    `ERD defaults emit the byte-identical marker objects FLOWCHART_EDGES emits (markerEnd ${JSON.stringify(plain.markerEnd)})`);

  /* ---- the App.tsx consumption shape: the spread + path override --------- */
  const spread = makeEdge('a', 'b', {...ERD_EDGES, path: 'bezier'}, 'bg-spread');
  const s = ends(spread);
  assert('bg-a.spread-path-override-still-plain',
    s.end === 'arrowclosed' && !CROWS.has(s.end) && !CROWS.has(s.start ?? ''),
    `{...preset.edges, path} (the onConnect / drop / dblclick shape) → ends (${s.start}, ${s.end}) — plain on every creation path`);

  /* ---- ALL FOUR crow glyph ids absent from a default edge ---------------- */
  const raw = JSON.stringify(plain);
  assert('bg-a.no-crow-glyph-id-anywhere-on-the-default-edge',
    ![...CROWS].some(c => raw.includes(`"type":"${c}"`)),
    `the serialized default edge contains none of {${[...CROWS].join(', ')}} (strokeKey slate, strokeWidth floor kept: ${JSON.stringify(plain.style)})`);

  /* ---- STORED / explicitly-authored semantics: an explicit crow seed
     still passes through — the flag gates the DEFAULT, never the authoring.
     This is also what keeps the erdTemplate relationship seeds crow-footed
     and what lets a stored board's edges round-trip untouched. ------------- */
  const seeded = makeEdge('a', 'b', ERD_EDGES, 'bg-seed', {crowStart: 'one', crowEnd: 'many'});
  const sd = ends(seeded);
  assert('bg-a.explicit-crow-seed-still-passes-through',
    sd.start === 'one' && sd.end === 'many' && isCrowFoot(sd.start) && isCrowFoot(sd.end),
    `makeEdge(..., {crowStart:'one', crowEnd:'many'}) → (${sd.start}, ${sd.end}) — explicit authoring (template seeds, stored-edge rebuilds) keeps its crow's feet`);
} else {
  /* flag ON: the ERD defaults must be the full crow's-foot pair again ------ */
  const crow = makeEdge('a', 'b', ERD_EDGES, 'bg-crow');
  const c = ends(crow);
  assert('bg-a.flag-on-crow-defaults-return',
    c.start === 'one' && c.end === 'many',
    `ERD_ENABLED === true → the crow pair is back (${c.start}, ${c.end}) — the harness tracks the flag, it does not freeze it`);
}

const fails = results.filter(r => !r.pass);
console.log(`\nround-bg-edges: ${results.length - fails.length}/${results.length} assertions pass`);
if (fails.length) {
  console.log('FAILED:');
  for (const f of fails) console.log(`  ${f.id} — ${f.detail}`);
}
process.exit(fails.length ? 1 : 0);
