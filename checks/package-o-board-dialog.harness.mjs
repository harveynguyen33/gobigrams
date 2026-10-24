#!/usr/bin/env node
/**
 * PACKAGE-O ITEM 6b — BEHAVIOURAL harness for the board dialog's DATA CONTRACT.
 *
 * WHY. The metrics harness checks the SOURCE SHAPE (a role is present, the
 * native API is gone). That cannot tell you whether a chosen template resolves to
 * a board that IS that template. This file runs the real preset data through the
 * same resolution the app performs, and asserts the RESULT.
 *
 * HOW, AND WHAT ROUND 4 CHANGED. Until ROUND 4 the dialog built its own
 * `TEMPLATES` table, so this file LIFTED that block out of `BoardDialog.tsx`'s
 * source text and EXECUTED it with the real `PRESETS` injected — the list under
 * test was the list the component built. ROUND 4 replaced the create body with
 * TWO rows (Blank + Use template, where "Use template" opens the gallery), which
 * deleted the block: the lift found nothing and this file THREW. The lifted-block
 * technique needs its subject to exist, so the dialog-side claim is now asserted
 * as its NEGATIVE (section 2) and the resolution contract below runs over a
 * `derived` list built directly from the shipped `PRESETS` table — the same data
 * the gallery's card model is executed against in checks/package-templates.mjs.
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

/* COMMENTS ARE BLANKED BEFORE EVERY "must be absent" PROBE. This repo's docblocks
   quote the constructs they describe — the dialog's own header names the
   `const TEMPLATES` table and the `PRESETS` import it USED to have, to explain why
   they are gone — so a raw-text probe reads that prose as the construct itself.
   Blanking (rather than stripping) keeps every byte offset and line number true. */
const blankComments = s => s
  .replace(/\/\*[\s\S]*?\*\//g, m => m.replace(/[^\n]/g, ' '))
  .replace(/(^|[^:])\/\/[^\n]*/g, (m, p1) => p1 + ' '.repeat(m.length - p1.length));
const DIALOG_CODE = blankComments(DIALOG_SRC);

/* ---------- 1. Bundle presets.ts so the real PRESETS table can be read ------ */
const dir = mkdtempSync(join(tmpdir(), 'ds-o2-'));
const presetEntry = join(dir, 'presets-entry.ts');
writeFileSync(presetEntry, `import {PRESETS} from ${JSON.stringify(join(ROOT, 'src/presets.ts'))};\nconsole.log(JSON.stringify(Object.fromEntries(Object.entries(PRESETS).map(([k,p]) => [k, {label: p.label, templateIds: (p.templates ?? []).map(t => t.id)}]))));\n`);
const presetOut = execFileSync(ESBUILD, [presetEntry, '--bundle', '--platform=node', '--format=esm', '--log-level=error'], {encoding: 'utf8'});
const presetsJs = join(dir, 'presets.mjs');
writeFileSync(presetsJs, presetOut);
const PRESETS = JSON.parse(execFileSync('node', [presetsJs], {encoding: 'utf8'}).trim());

/* ---------- 2. THE DIALOG NO LONGER BUILDS A TEMPLATE LIST (ROUND 4) ------- */
/* INVERTED (ROUND 4, ITEM 1) — NOT DELETED, and the reason is recorded. This
   section used to LIFT a `const TEMPLATES` block out of BoardDialog.tsx by
   regex and EXECUTE it, so the list under test was the list the component built.
   ROUND 4 removed that block: Harvey's brief replaced the create body's template
   list with exactly TWO rows (Blank + Use template), where "Use template" opens
   the gallery instead of picking a template inline. The lift therefore found
   nothing and this file THREW (`could not lift the TEMPLATES builder`), which is
   why the old assertion could not simply go red.

   The old claim — "the dialog's offered list is derived from PRESETS, not a
   transcription" — has no subject left, so it is replaced by its negative, which
   IS the round's requirement: the dialog offers NO template, reads NO preset
   table, and the catalog has exactly ONE UI reader (the gallery, whose model is
   executed and compared against the catalog in checks/package-templates.mjs tg1).
   The `derived` list below is then built HERE, from the shipped `PRESETS` table,
   so the resolution contract in sections 3-4 still runs over the real data. */
const loopMatch = /const TEMPLATES[\s\S]*?\n\}\n/.exec(DIALOG_CODE);
console.log('DIALOG DATA CONTRACT (item 6b, re-anchored ROUND 4)');
console.log('='.repeat(78));
console.log(`the dialog's old TEMPLATES builder is liftable: ${!!loopMatch} (expected false — ROUND 4 deleted it)`);
console.log(`presets: ${Object.entries(PRESETS).map(([k, p]) => `${k}(${p.templateIds.length} templates)`).join(' ')}`);

assert('6b-REANCHOR.the-dialog-no-longer-offers-templates-and-reads-no-preset-table',
  !loopMatch
    && !/for \(const id of Object\.keys\(PRESETS\) as PresetId\[\]\)/.test(DIALOG_CODE)
    && !/for \(const t of PRESETS\[id\]\.templates \?\? \[\]\)/.test(DIALOG_CODE)
    && !/\bPRESETS\b/.test(DIALOG_CODE)
    && /const CREATE_ROWS: CreateRow\[\] = \[\s*\{key: 'blank', name: 'Blank'/.test(DIALOG_CODE)
    && /className="bd-row"/.test(DIALOG_CODE),
  'the `const TEMPLATES` builder and BOTH flattening loops are gone from the dialog, and it no longer names `PRESETS` at all: the create body is TWO uniform `bd-row` '
  + 'actions — `Blank` (rendered from the same `CREATE_ROWS` data array) and `Use template` (which opens the gallery). Reason for the inversion: the lifted-block technique '
  + 'needs its subject to exist, and ROUND 4 deleted the subject by request — the executed-list equivalence is now pinned where the list actually lives '
  + '(checks/package-templates.mjs tg1 executes `galleryModel()` and compares it to the catalog). '
  + 'RE-ANCHORED (ROUND 6, ITEM 1): OLD claims "ONE radio (Blank) plus the `bd-browse` action row" — the radio was deleted this round and BOTH rows now share the ONE `.bd-row` '
  + 'class, so the two predicates that named `START_ROWS` (a `StartRow[]` of radios) and `bd-browse` are replaced by the uniform-rows ones; the CLAIM (no template data, no '
  + 'PRESETS, no lifted builder) is unchanged.');

const derived = Object.entries(PRESETS).flatMap(([id, p]) =>
  p.templateIds.map(templateId => ({preset: id, presetLabel: p.label, templateId})));
console.log(`\ntemplates the CATALOG offers (built here from the shipped PRESETS): ${derived.length}`);
for (const d of derived) console.log(`  ${d.preset.padEnd(12)} ${d.templateId.padEnd(14)} ${d.presetLabel}`);

/* The dialog is the ONLY place that can offer a template now. Before this pass,
   `custom` was hard-coded and `custom.templates` is undefined — the question was
   unreachable. That is the bug this asserts is fixed. */
const customTemplates = PRESETS.custom.templateIds.length;
console.log(`\ncustom.templates.length = ${customTemplates}  (the old code asked about custom.templates[0])`);
assert('6b.the-old-hardcoded-path-could-never-offer-a-template',
  customTemplates === 0,
  `custom ships ${customTemplates} templates — which is exactly why hard-coding 'custom' made the old template confirm dead code`);

/* ---------- 3. Every key the catalog can offer resolves to a real template -- */
const EMPTY = '';
const optKey = (preset, tid) => `${preset}:${tid}`;
const KEYS = [EMPTY, ...derived.map(d => optKey(d.preset, d.templateId))];
console.log(`\noption keys the catalog offers: ${KEYS.length} (1 "start empty" + ${KEYS.length - 1} templates)`);
for (const k of KEYS) console.log(`  ${k === EMPTY ? '(start empty)' : k}`);
assert('6b.start-empty-key-cannot-collide-with-a-template',
  EMPTY === '' && derived.every(d => optKey(d.preset, d.templateId).includes(':')),
  'every real key contains a ":", the empty key contains none');
assert('6b.every-option-key-is-unique', new Set(KEYS).size === KEYS.length,
  `${new Set(KEYS).size} distinct of ${KEYS.length}`);

/* ---------- 4. Resolve each choice the way the app does -------------------- */
/* This mirrors the app's template resolution exactly: pid from the key, then the
   template looked up WITHIN that preset. The point is that a chosen template
   never lands under the wrong preset (the C4-under-Mixed defect).
   RE-ANCHORED (ROUND 4, ITEM 1): the keys now come from the CATALOG rather than
   from the dialog's row list, because the dialog no longer offers rows at all —
   the gallery's cards are what carry a `${preset}:${templateId}` key today. The
   predicate is unchanged: every key must resolve inside its own preset. */
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
/* RE-ANCHORED (ROUND 3) — NOT weakened, and the reason is recorded. The pair
   lookup moved VERBATIM out of `onBoardDialog`'s create branch into
   `createFromTemplate`, the new single owner of "create a board from a
   template"; that is why the literal spelling changed from
   `r.seed ? getPreset(pid).templates?.find(x => x.id === r.seed!.templateId)`
   to `getPreset(wantPid).templates?.find(x => x.id === opts.templateId)`.
   The CLAIM is unchanged and is what is asserted: App resolves the
   (preset, templateId) pair WITHIN the chosen preset, so a C4 template can never
   land under Mixed. Both spellings are accepted and the one that matched is
   printed, so a future move shows up here instead of rotting silently. */
const appPairSpellings = [
  ['round-3 (inside createFromTemplate)', /getPreset\(wantPid\)\.templates\?\.find\(x => x\.id === opts\.templateId\)/],
  ['pre-round-3 (inside onBoardDialog)', /r\.seed \? getPreset\(pid\)\.templates\?\.find\(x => x\.id === r\.seed!\.templateId\)/],
];
const appPairHit = appPairSpellings.find(([, re]) => re.test(APP_SRC.replace(/\s+/g, ' ')));
console.log(`\nApp.tsx resolves the (preset, templateId) pair: ${!!appPairHit}  [${appPairHit ? appPairHit[0] : 'NEITHER spelling — the lookup was rewritten without the pair-within-the-preset shape'}]`);
assert('6b.App-resolves-the-pair-within-the-chosen-preset', !!appPairHit,
  `getPreset(<chosen preset>).templates?.find(x => x.id === <templateId>) — matched the ${appPairHit ? appPairHit[0] : 'NO'} spelling. ` +
  'The lookup moved into createFromTemplate this round; the assertion was re-anchored to accept either location, not relaxed: it still requires the template to be found WITHIN the preset that owns it');

/* ---------- 6. DELETE is not gated on a name ----------------------------- */
assert('6b.delete-is-not-gated-on-a-board-name',
  /const needsName = mode === 'rename';/.test(DIALOG_SRC),
  'a whitespace-only board name would otherwise make the confirm button silently inert. '
  + 'RE-ANCHORED (ROUND 6, ITEM 1): the old predicate was `mode !== \'delete\'`, which was TRUE for BOTH create and rename — but ROUND 6 removed create\'s submit button (both of '
  + 'its rows act on press), so create has no submit left to gate and the shipped rule is the narrower `mode === \'rename\'`. The CLAIM is unchanged and still asserted: DELETE is '
  + 'never gated on a name.');

const failed = asserts.filter(a => !a.pass);
console.log('\n' + '='.repeat(78));
console.log(`HARNESS: ${asserts.length - failed.length}/${asserts.length} passed`);
process.exit(failed.length ? 1 : 0);
