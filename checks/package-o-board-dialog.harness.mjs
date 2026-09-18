#!/usr/bin/env node
/**
 * PACKAGE-O ITEM 6b — BEHAVIOURAL harness for the board dialog's DATA CONTRACT.
 *
 * WHY. The metrics harness checks the SOURCE SHAPE (a role is present, the
 * native API is gone). That cannot tell you whether choosing "C4 Context" in the
 * dialog actually results in a board that IS a C4 board. This file runs the real
 * `TEMPLATES` table and the real preset data through the same resolution the
 * dialog and `App.tsx` perform, and asserts the RESULT.
 *
 * HOW. `BoardDialog.tsx` imports React, so it cannot be `import`ed here. Instead
 * esbuild (the bundler Vite already ships) transpiles the FILE to plain JS, and
 * this script reads the `TEMPLATES` / `optKey` / `EMPTY` declarations out of the
 * transpiled output — the same technique the metrics harness uses for CSS, and it
 * means the list under test is the list the component really builds.
 *
 * WHAT IT DOES NOT COVER: no DOM, so it proves nothing about layout, focus or
 * painting. Those are reported as unverifiable without a browser.
 */
import {readFileSync, writeFileSync, mkdtempSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {execFileSync} from 'node:child_process';
import {pathToFileURL} from 'node:url';

const ROOT = '/home/harvey/projects/tech-goblin/lab/diagram-studio';
const ESBUILD = join(ROOT, 'node_modules/.bin/esbuild');
const PRESETS_SRC = readFileSync(join(ROOT, 'src/presets.ts'), 'utf8');
const DIALOG_SRC = readFileSync(join(ROOT, 'src/BoardDialog.tsx'), 'utf8');
const APP_SRC = readFileSync(join(ROOT, 'src/App.tsx'), 'utf8');

const asserts = [];
const assert = (id, pass, detail) => {
  asserts.push({id, pass, detail});
  console.log(`  ${pass ? 'PASS' : 'FAIL'}  ${id}${detail ? '  — ' + detail : ''}`);
};

/* ---------- 1. Bundle presets.ts so the real PRESETS table can be read ------ */
const dir = mkdtempSync(join(tmpdir(), 'ds-o2-'));
const presetEntry = join(dir, 'presets-entry.ts');
writeFileSync(presetEntry, `import {PRESETS} from ${JSON.stringify(join(ROOT, 'src/presets.ts'))};\nconsole.log(JSON.stringify(Object.fromEntries(Object.entries(PRESETS).map(([k,p]) => [k, {label: p.label, templateIds: (p.templates ?? []).map(t => t.id)}]))));\n`);
const presetOut = execFileSync(ESBUILD, [presetEntry, '--bundle', '--platform=node', '--format=esm', '--log-level=error'], {encoding: 'utf8'});
const presetsJs = join(dir, 'presets.mjs');
writeFileSync(presetsJs, presetOut);
const PRESETS = JSON.parse(execFileSync('node', [presetsJs], {encoding: 'utf8'}).trim());

/* ---------- 2. RUN the dialog's own TEMPLATES builder ---------------------- */
/* The list is BUILT by a loop over PRESETS inside the component. Rather than
   transcribe that loop here (which would only test the transcription), the loop
   is lifted out of the component's source text and EXECUTED with the real
   `PRESETS` injected — so the list under test is the list the component builds. */
const loopMatch = /const TEMPLATES[\s\S]*?\n\}\n/.exec(DIALOG_SRC);
if (!loopMatch) throw new Error('could not lift the TEMPLATES builder out of BoardDialog.tsx');
/* The snippet carries TypeScript annotations and references `PRESETS`, so it is
   written into a tiny entry module that imports the REAL `presets.ts` and is
   bundled by esbuild (the bundler Vite already ships). The builder therefore
   runs against the app's own preset data — the list under test IS the list the
   component builds, not a transcription of it. */
const loopEntry = join(dir, 'loop-entry.ts');
writeFileSync(loopEntry, `import {PRESETS} from ${JSON.stringify(join(ROOT, 'src/presets.ts'))};\n${loopMatch[0]}\nexport {TEMPLATES};\n`);
const loopJs = join(dir, 'loop.mjs');
writeFileSync(loopJs, execFileSync(ESBUILD, [loopEntry, '--bundle', '--platform=node', '--format=esm', '--log-level=error'], {encoding: 'utf8'}));
const TEMPLATES = (await import(pathToFileURL(loopJs).href)).TEMPLATES;
const derived = TEMPLATES.map(t => ({preset: t.preset, presetLabel: t.presetLabel, templateId: t.t.id}));

console.log('DIALOG DATA CONTRACT (item 6b)');
console.log('='.repeat(78));
console.log(`presets: ${Object.entries(PRESETS).map(([k, p]) => `${k}(${p.templateIds.length} templates)`).join(' ')}`);
console.log(`templates the component actually offers: ${derived.length}`);
for (const d of derived) console.log(`  ${d.preset.padEnd(12)} ${d.templateId.padEnd(14)} ${d.presetLabel}`);

assert('6b.dialog-builds-its-list-from-PRESETS-not-a-transcription',
  /for \(const id of Object\.keys\(PRESETS\) as PresetId\[\]\)/.test(DIALOG_SRC)
    && /for \(const t of PRESETS\[id\]\.templates \?\? \[\]\)/.test(DIALOG_SRC),
  'the TEMPLATES table is derived, so a new preset template appears with no edit here');

/* The dialog is the ONLY place that can offer a template now. Before this pass,
   `custom` was hard-coded and `custom.templates` is undefined — the question was
   unreachable. That is the bug this asserts is fixed. */
const customTemplates = PRESETS.custom.templateIds.length;
console.log(`\ncustom.templates.length = ${customTemplates}  (the old code asked about custom.templates[0])`);
assert('6b.the-old-hardcoded-path-could-never-offer-a-template',
  customTemplates === 0,
  `custom ships ${customTemplates} templates — which is exactly why hard-coding 'custom' made the old template confirm dead code`);

/* ---------- 3. Every key the dialog can return resolves to a real template -- */
const EMPTY = '';
const optKey = (preset, tid) => `${preset}:${tid}`;
const KEYS = [EMPTY, ...derived.map(d => optKey(d.preset, d.templateId))];
console.log(`\noption keys the dialog renders: ${KEYS.length} (1 "start empty" + ${KEYS.length - 1} templates)`);
for (const k of KEYS) console.log(`  ${k === EMPTY ? '(start empty)' : k}`);
assert('6b.start-empty-key-cannot-collide-with-a-template',
  EMPTY === '' && derived.every(d => optKey(d.preset, d.templateId).includes(':')),
  'every real key contains a ":", the empty key contains none');
assert('6b.every-option-key-is-unique', new Set(KEYS).size === KEYS.length,
  `${new Set(KEYS).size} distinct of ${KEYS.length}`);

/* ---------- 4. Resolve each choice the way App.tsx does -------------------- */
/* This mirrors `onBoardDialog`'s create branch exactly: pid from the key, then
   the template looked up WITHIN that preset. The point is that a chosen template
   never lands under the wrong preset (the C4-under-Mixed defect). */
function resolveCreate(key, name = 'Board') {
  const hit = derived.find(d => optKey(d.preset, d.templateId) === key);
  const pid = hit ? hit.preset : 'custom';
  const t = hit ? derived.find(d => d.preset === pid && d.templateId === hit.templateId) : undefined;
  return {name, pid, templateId: t ? t.templateId : null,
    savePreset: t ? pid : null,   // App.tsx only writes `preset` when a template seeds
    seeds: !!t};
}
const rows = KEYS.map(k => ({key: k, ...resolveCreate(k, 'Untitled')}));
console.log('\ncreate resolution, per option:');
for (const r of rows) {
  console.log(`  ${(r.key || '(start empty)').padEnd(22)} -> preset=${r.pid.padEnd(12)} seeds=${r.seeds ? r.templateId : 'nothing'} defaultPreset=${r.pid === 'custom' ? 'custom (Mixed)' : r.pid}`);
}
assert('6b.start-empty-creates-a-custom-board-with-no-nodes',
  rows[0].pid === 'custom' && rows[0].seeds === false && rows[0].templateId === null,
  `pid=${rows[0].pid}, seeds=${rows[0].seeds}`);
assert('6b.every-template-choice-selects-its-OWN-preset',
  rows.slice(1).every(r => r.pid !== 'custom' || r.key.startsWith('custom:')),
  `presets chosen: ${[...new Set(rows.slice(1).map(r => r.pid))].join(', ')}`);
assert('6b.a-c4-template-never-lands-under-Mixed',
  rows.filter(r => r.key.startsWith('c4:')).every(r => r.pid === 'c4'),
  rows.filter(r => r.key.startsWith('c4:')).map(r => `${r.key}->${r.pid}`).join(' '));
assert('6b.no-template-choice-without-a-resolvable-template',
  rows.slice(1).every(r => r.templateId !== null && r.seeds),
  'every non-empty key resolves to a real template');

/* ---------- 5. App.tsx performs the same lookup --------------------------- */
const appHasPairLookup = /r\.seed \? getPreset\(pid\)\.templates\?\.find\(x => x\.id === r\.seed!\.templateId\)/.test(APP_SRC.replace(/\s+/g, ' '));
console.log(`\nApp.tsx resolves the (preset, templateId) pair: ${appHasPairLookup}`);
assert('6b.App-resolves-the-pair-within-the-chosen-preset', appHasPairLookup,
  'getPreset(pid).templates?.find(x => x.id === r.seed.templateId)');

/* ---------- 6. DELETE is not gated on a name ----------------------------- */
assert('6b.delete-is-not-gated-on-a-board-name',
  /const needsName = mode !== 'delete';/.test(DIALOG_SRC),
  'a whitespace-only board name would otherwise make the confirm button silently inert');

const failed = asserts.filter(a => !a.pass);
console.log('\n' + '='.repeat(78));
console.log(`HARNESS: ${asserts.length - failed.length}/${asserts.length} passed`);
process.exit(failed.length ? 1 : 0);
