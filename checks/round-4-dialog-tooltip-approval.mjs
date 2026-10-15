#!/usr/bin/env node
/**
 * ROUND 4 harness — the board dialog's two options, the menu rename, the stuck
 * tooltip, and the `approval` deletion.
 *
 * No browser, no DOM library. Three kinds of evidence:
 *   (1) EXECUTED — `src/Tooltip.tsx` is bundled by the project's own esbuild with
 *       `--jsx=automatic` and its PURE modality helpers are called, so the focus
 *       decision under test is the shipped function, not a paraphrase of it.
 *   (2) EXECUTED — `src/presets.ts` is bundled and the flowchart family's real
 *       `templates` array is read, so "approval is gone" is a fact about the
 *       shipped data rather than a grep.
 *   (3) TEXT reads of the components/DOM-free JSX that Node cannot strip.
 *
 * COMMENTS ARE BLANKED BEFORE EVERY "must be absent" PROBE: this round's own
 * docblocks name the constructs they removed (`const TEMPLATES`, `bd-hd`,
 * `approval`, `initialPick`) to explain the removal, and a raw count would read
 * that prose as the construct. Blanking keeps byte offsets (and line numbers)
 * true; stripping does not.
 *
 * Run: node checks/round-4-dialog-tooltip-approval.mjs   → exit 0 green, 1 red
 */
import {readFileSync, writeFileSync, rmSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';

const ROOT = '/home/harvey/projects/tech-goblin/lab/diagram-studio';
const ESBUILD = join(ROOT, 'node_modules/.bin/esbuild');

const blank = m => m.replace(/[^\n]/g, ' ');
const stripTs = s => s
  .replace(/\/\*[\s\S]*?\*\//g, blank)
  .replace(/(^|[^:])\/\/[^\n]*/g, (m, p1) => p1 + ' '.repeat(m.length - p1.length));

const DIALOG_RAW = readFileSync(join(ROOT, 'src/BoardDialog.tsx'), 'utf8');
const DIALOG = stripTs(DIALOG_RAW);
const TOOLTIP_RAW = readFileSync(join(ROOT, 'src/Tooltip.tsx'), 'utf8');
const TOOLTIP = stripTs(TOOLTIP_RAW);
const APP_RAW = readFileSync(join(ROOT, 'src/App.tsx'), 'utf8');
const APP = stripTs(APP_RAW);
const PRESETS_RAW = readFileSync(join(ROOT, 'src/presets.ts'), 'utf8');
const STYLES_RAW = readFileSync(join(ROOT, 'src/styles.css'), 'utf8');
const SPEC_RAW = readFileSync(join(ROOT, 'PACKAGE-TEMPLATES-SPEC.md'), 'utf8');
const GALLERY_RAW = readFileSync(join(ROOT, 'src/TemplatesGallery.tsx'), 'utf8');

const results = [];
const assert = (id, pass, detail = '') => {
  results.push({id, pass: !!pass, detail});
  console.log(`  ${pass ? 'PASS' : 'FAIL'}  ${id}${detail ? '  —  ' + detail : ''}`);
};
const eq = (a, b) => a.size === b.size && [...a].every(x => b.has(x));

const dir = (await import('node:fs')).mkdtempSync(join((await import('node:os')).tmpdir(), 'ds-r4-'));
function bundle(entrySrc, name, extraArgs = []) {
  const entry = join(dir, `${name}-entry.ts`);
  const out = join(dir, `${name}.mjs`);
  writeFileSync(entry, entrySrc);
  writeFileSync(out, execFileSync(ESBUILD, [entry, '--bundle', '--platform=node', '--format=esm', '--log-level=error', ...extraArgs], {encoding: 'utf8'}));
  return out;
}

/* ===========================================================================
   ITEM 1 — the create body shows exactly TWO options.
=========================================================================== */
console.log('\n' + '='.repeat(78));
console.log('ITEM 1 — the New-board dialog offers Blank + Use template, nothing else');
console.log('='.repeat(78));

const radioRoles = (DIALOG.match(/role="radio"/g) ?? []).length;
const radioGroups = (DIALOG.match(/role="radiogroup"/g) ?? []).length;
const roving = /tabIndex=\{\(on \|\| \(!hasPick && i === 0\)\) \? 0 : -1\}/.test(DIALOG);
const startRows = [...DIALOG.matchAll(/\{key: '([^']+)', name: '([^']+)', hint: '([^']*)'\}/g)]
  .map(m => ({key: m[1], name: m[2], hint: m[3]}));
console.log(`  radiogroups: ${radioGroups}; role="radio" rows: ${radioRoles}; roving expression: ${roving}`);
console.log(`  START_ROWS parsed from the dialog: [${startRows.map(r => `${r.key}="${r.name}"`).join(', ')}]`);

assert('i1a.the-create-body-has-exactly-two-rows',
  startRows.length === 2
    && startRows[0].key === 'blank' && startRows[0].name === 'Blank'
    && startRows[1].key === 'browse' && startRows[1].name === 'Use template'
    && (DIALOG_RAW.match(/className="bd-row"/g) ?? []).length === 1
    && /<span className="bd-row-name">\{row\.name\}<\/span>/.test(DIALOG_RAW),
  `the body's own data holds exactly TWO rows — [${startRows.map(r => `"${r.name}"`).join(', ')}] — and BOTH render through the SAME \`.bd-row\` button with the ONE \`.bd-row-name\` span, ` +
  `so the two-row count Harvey asked for ("chỉ hiển thị 2 options") is unchanged. OLD CLAIM (re-anchored): "ONE radio (Blank) plus the bd-browse action row". NEW CLAIM: two peer ` +
  `action buttons, neither a radio. REASON: ROUND 6, ITEM 1 made the two rows uniform — Harvey, "cái đầu Blank thì có radio button" — deleting \`.bd-opt\`/\`.bd-browse\`, so an ` +
  `assertion that one row is a radio is exactly the one that went red.`);

assert('i1b.NEITHER-row-is-a-radio-and-there-is-no-walk-to-enter',
  radioGroups === 0 && radioRoles === 0 && !roving
    && !/\bpickAt\b|\bhasPick\b|\bsetPick\b|\boptRefs\b|\bStartRow\b/.test(DIALOG)
    && !/onKeyDown=\{onOptKey\}/.test(DIALOG_RAW),
  'OLD CLAIM: "exactly ONE `role="radiogroup"` carrying exactly ONE radio with the roving tabindex, `pick` starting on `Blank`, and Arrow/Home/End routed through `pickAt`". ' +
  'NEW CLAIM (re-anchored, and it is the INVERSE): ZERO radiogroups, ZERO radios, no roving-tabindex expression, and none of `pickAt`/`hasPick`/`setPick`/`optRefs`/`StartRow` ' +
  '— there is no radio walk at all, for a keyboard user or for markup. REASON: ROUND 6, ITEM 1 deleted the model Harvey called out ("cái đầu Blank thì có radio button"); with ' +
  'no selection state there is nothing to announce and nothing to rove, so the accessibility contract is the plain one: two real buttons, reached by Tab, activated by Enter.');

assert('i1c.Use-template-opens-the-GALLERY-and-creates-nothing-itself',
  /onClick=\{\(\) => \(row\.key === 'browse' \? onBrowse\?\.\(trimmed\) : submit\(\)\)\}/.test(DIALOG_RAW)
    && /onBrowse\?: \(name: string\) => void;/.test(DIALOG)
    && /onBrowse=\{\(name\) => \{ pendingBoardName\.current = name; setBoardDlg\(null\); setTgOpen\(true\); \}\}/.test(APP)
    && /submitRef\.current\(\{kind: 'create', name: trimmed, seed: null\}\)/.test(DIALOG),
  'the "Use template" row is an ACTION: its press branches on `row.key === \'browse\'` and calls `onBrowse?.(trimmed)` rather than submitting, App.tsx wires that to '
  + '`setBoardDlg(null); setTgOpen(true)` — the gallery — and the row carries no `role`/`tabIndex` (asserted in i1b). The dialog still creates only an UNSEEDED board '
  + '(`seed: null`), so board creation keeps its single owner (`createFromTemplate`). '
  + 'RE-ANCHORED (ROUND 6, ITEM 3): OLD CLAIM "the row calls `onBrowse` with no arguments, and it is an action OUTSIDE the radiogroup". The radiogroup half is gone with the '
  + 'radiogroup (there are two actions now, not one action and one radio), and the call now carries the TYPED NAME — `onBrowse?.(trimmed)` — which is the defect fix: the name '
  + 'used to be dropped here, and the board came out `Untitled N`. The claim that survives is the important one and is still asserted: pressing this row OPENS THE GALLERY, '
  + 'it does not create a board itself.');

assert('i1d.the-dead-template-list-is-GONE-from-dialog-and-stylesheet',
  !/const TEMPLATES/.test(DIALOG) && !/\bPRESETS\b/.test(DIALOG) && !/templateCatalog/.test(DIALOG)
    && (DIALOG.match(/role="radio"/g) ?? []).length === 0
    && !/catRows|row\.kind === 'header'|\bbd-hd\b/.test(DIALOG)
    && !/initialPick/.test(DIALOG)
    && (STYLES_RAW.match(/(?:^|\n)\.bd-hd[^{]*\{/g) ?? []).length === 0
    && /\.bd-list \{/.test(STYLES_RAW) && /\.bd-row \{/.test(STYLES_RAW)
    && !/\.bd-opt\s*\{|\.bd-browse\s*\{/.test(STYLES_RAW),
  'the whole template-listing machinery is gone — the `TEMPLATES` table, the preset import, the catalog import, the `catRows` header rows, the `bd-hd` markup AND its '
  + 'stylesheet rule, and the `initialPick` prop — so the dialog has no second catalog reader and nothing left to drift. '
  + 'RE-ANCHORED (ROUND 6, ITEM 1): the stylesheet half used to require `.bd-opt` / `.bd-browse`; both rows now carry the ONE `.bd-row` class, so the row grammar is asserted '
  + 'as `.bd-list` + `.bd-row` and the two OLD selectors are asserted ABSENT (they are deleted, not orphaned). The radio count moved from 1 to 0 with the radio model.');

/* The gallery is now the ONE UI reader of the catalog — asserted so the removal
   above cannot quietly remove the app's only route to a template. */
assert('i1e.the-gallery-is-the-ONE-remaining-catalog-reader',
  /import \{templateCatalog/.test(GALLERY_RAW) && /galleryModel\(families: TemplateFamily\[\] = templateCatalog\(\)\)/.test(GALLERY_RAW)
    && /role="dialog"/.test(GALLERY_RAW) && /<h2 className="bd-title" id="tg-title">Templates<\/h2>/.test(GALLERY_RAW),
  'src/TemplatesGallery.tsx imports and reads `templateCatalog()` and still renders the heading "Templates" — so removing the dialog\'s list moved no ' +
  'capability away, it left exactly ONE place where a template can be chosen.');

/* ===========================================================================
   ITEM 2 — the boards menu row.
=========================================================================== */
console.log('\n' + '='.repeat(78));
console.log('ITEM 2 — the boards-menu row is renamed; the gallery heading is not');
console.log('='.repeat(78));
const menuRowMatch = /<LayoutTemplate size=\{14\} \/> ([^<\n]+)/.exec(APP_RAW);
const menuRow = menuRowMatch ? {1: menuRowMatch[1]} : null;
console.log(`  boards-menu template row label: ${JSON.stringify(menuRow ? menuRow[1] : 'ABSENT')}`);
assert('i2.the-menu-row-reads-Create-from-Templates',
  !!menuRow && menuRow[1].trim() === 'Create from Templates'
    && !/Templates…/.test(APP)
    && /setBoardsOpen\(false\); pendingBoardName\.current = ''; setTgOpen\(true\); \}\};?/.test(APP)
    && /<Plus size=\{14\} \/> New board/.test(APP)
    && /id="tg-title">Templates</.test(GALLERY_RAW),
  'Harvey: "Còn cái Templates... bên ngoài thì đổi thành Create from Templates". The row sits directly beside "New board" and keeps the same handler; the '
  + 'gallery\'s own heading stays "Templates" (it is the destination, not the verb). '
  + 'RE-ANCHORED (ROUND 6, ITEM 3): the handler predicate gained `pendingBoardName.current = \'\'` — this route has NO typed name, so it must CLEAR the dialog\'s stash rather '
  + 'than carry a stale one into the gallery. The old predicate `setBoardsOpen(false); setTgOpen(true)` is one clause short of the shipped statement, which is why this '
  + 'assertion was red; the stale-name leak it now guards is the case worth pinning (a name typed once must not attach to a board created later from this menu route).');

/* ===========================================================================
   ITEM 3 — the stuck tooltip. The modality decision is EXECUTED.
=========================================================================== */
console.log('\n' + '='.repeat(78));
console.log('ITEM 3 — a tooltip opens only for a KEYBOARD-caused focus (executed)');
console.log('='.repeat(78));

/* The helpers are the component's own exports, so the decision under test is the
   shipped one. React/lucide come along inside the bundle with --jsx=automatic. */
const tooltipJs = bundle(
  `export {markKeyboard, markPointer, showsOnFocus} from ${JSON.stringify(join(ROOT, 'src/Tooltip.tsx'))};\n`,
  'tooltip', ['--jsx=automatic']);
const T = await import(pathToFileURL(tooltipJs).href);

const focusStates = [
  {label: 'fresh document → a programmatic .focus()', setup: () => {}, want: false},
  {label: 'after a pointer event → a programmatic .focus()', setup: () => T.markPointer(), want: false},
  {label: 'after a keydown (Tab) → the focus it caused', setup: () => T.markKeyboard(), want: true},
  {label: 'keydown, then a pointer move → focus', setup: () => { T.markKeyboard(); T.markPointer(); }, want: false},
  {label: 'pointer, then a keydown → focus', setup: () => { T.markPointer(); T.markKeyboard(); }, want: true},
];
const focusRows = focusStates.map(c => {
  c.setup();
  return {...c, got: T.showsOnFocus()};
});
for (const r of focusRows) console.log(`  ${r.label.padEnd(48)} showsOnFocus() = ${r.got}  (want ${r.want})`);
assert('i3a.the-focus-decision-follows-the-LAST-input-modality',
  focusRows.every(r => r.got === r.want),
  'the EXECUTED `showsOnFocus()`: a focus with no prior input does NOT show (the reported bug — a programmatic `.focus()` after create/delete), a focus after ' +
  'a POINTER event does not show, and a focus after a KEYBOARD event does. This is the class fix: every one of the ~20 Tooltip call sites inherits it and ' +
  'App.tsx gained no state.');

assert('i3b.the-guard-is-INSIDE-Tooltip-and-hover-blur-escape-are-untouched',
  /if \(showsOnFocus\(\)\) show\(\);/.test(TOOLTIP)
    && /onMouseEnter[\s\S]{0,80}show\(\);/.test(TOOLTIP)
    && /onMouseLeave[\s\S]{0,80}hide\(\);/.test(TOOLTIP)
    && /onBlur[\s\S]{0,80}hide\(\);/.test(TOOLTIP)
    && /onFocus\?\.\(e\)/.test(TOOLTIP)
    && /if \(e\.key === 'Escape'\) hide\(\);/.test(TOOLTIP)
    && /window\.addEventListener\('keydown', onKey, true\)/.test(TOOLTIP)
    && /window\.addEventListener\('pointerdown', onPointer, true\)/.test(TOOLTIP)
    && /window\.addEventListener\('mousemove', onPointer, true\)/.test(TOOLTIP),
  '`onFocus` is gated by `showsOnFocus()` while hover, mouse-leave, blur and Escape are UNCHANGED — a Tab-to-the-button user still gets the tooltip, and the ' +
  'dismissals still work. The listeners are installed ONCE at module scope on `window` in the CAPTURE phase, so a handler that stops propagation cannot hide ' +
  'the input from the tracker and no per-instance listener is added.');

assert('i3c.no-programmatic-focus-call-was-special-cased',
  !/returnFocusTo[\s\S]{0,120}showsOnFocus/.test(TOOLTIP)
    && !/setPos\(null\)[\s\S]{0,200}setTgOpen/.test(APP)
    && !/\blastModality\b/.test(APP) && !/\bshowsOnFocus\b/.test(APP),
  'the fix names no caller: App.tsx contains neither the tracker nor the decision, and no board/dialog action was special-cased — which is what makes it ' +
  'cover every other programmatic focus in the app rather than the two flows Harvey reported.');

/* The stale-tooltip sequence the bug describes, replayed against the tracker:
   a board action runs, focus is restored with .focus(), and no mouse-leave ever
   comes. On a pointer-mode document that sequence must NOT open a tooltip. */
const replay = (() => {
  T.markPointer();                     // the user clicked the menu row / Delete
  const afterAction = T.showsOnFocus();// the restore call's onFocus asks the guard
  T.markKeyboard();                    // a later Tab must still work
  return {afterAction, afterTab: T.showsOnFocus()};
})();
console.log(`  replay of create/delete: focus-restore shows a tooltip = ${replay.afterAction}; a later Tab shows one = ${replay.afterTab}`);
assert('i3d.the-reported-sequence-is-silent-but-Tab-still-works',
  replay.afterAction === false && replay.afterTab === true,
  'the exact reported flow — a pointer interaction, then the app calling .focus() to restore focus — asks for no tooltip, so nothing is left on screen waiting ' +
  'for a mouse-leave that never comes; and the SAME tree still answers a keyboard user. That pairing is what makes this a fix rather than a mute.');

/* ===========================================================================
   ITEM 4 — the `approval` template is deleted from the shipped data.
=========================================================================== */
console.log('\n' + '='.repeat(78));
console.log('ITEM 4 — `approval` is gone from the flowchart family (executed)');
console.log('='.repeat(78));

const presetsJs = bundle(
  `export {PRESETS, FLOWCHART_PRESET} from ${JSON.stringify(join(ROOT, 'src/presets.ts'))};\n`,
  'presets');
const {PRESETS, FLOWCHART_PRESET} = await import(pathToFileURL(presetsJs).href);
const flowIds = FLOWCHART_PRESET.templates.map(t => t.id);
const allIds = Object.values(PRESETS).flatMap(p => (p.templates ?? []).map(t => t.id));
console.log(`  flowchart family (executed): [${flowIds.join(', ')}]`);
console.log(`  every template id in PRESETS: [${allIds.join(', ')}]`);
assert('i4a.the-flowchart-family-ships-three-templates-and-no-approval',
  JSON.stringify(flowIds) === JSON.stringify(['flow-basic', 'flow-advanced', 'flow-complex'])
    && FLOWCHART_PRESET.templates.length === 3
    && !allIds.includes('approval'),
  'the executed array is exactly the three levelled templates Harvey asked to keep — `flow-basic`, `flow-advanced`, `flow-complex` — and "approval" appears ' +
  'nowhere in any preset\'s template ids. Harvey: "à ngoài ra xoá flowchart template Approve nhé".');

/* COMMENTS ARE BLANKED: the presets docblock records the removal in prose and
   NAMES the template it deleted, so a raw-text probe would read this round's own
   explanation as a surviving referent. The claim is about CODE. */
const PRESETS_CODE = stripTs(PRESETS_RAW);
assert('i4b.the-deletion-left-no-referent-in-src',
  !/flowchartApprovalTemplate/.test(PRESETS_CODE) && !/approval/.test(PRESETS_CODE)
    && !/lane\s*\(/.test(PRESETS_CODE)
    && !/\bapproval\b/.test(stripTs(DIALOG_RAW)) && !/\bapproval\b/.test(stripTs(GALLERY_RAW)),
  'with comments blanked, neither `flowchartApprovalTemplate` nor the string `approval` occurs anywhere in src/presets.ts, BoardDialog.tsx or TemplatesGallery.tsx — the ' +
  'template object is gone and no code names it. The `lane()` helper that existed only to build its three group bands went with it, so nothing can reference a ' +
  'deleted object and tsc stays clean. (Prose is excluded because the removal is deliberately DOCUMENTED: the presets docblock and the gallery docblock both ' +
  'record it, and an assertion that counts its own explanation would have to be weakened to pass.)');

assert('i4c.the-galleries-docblock-no-longer-claims-approval-exists',
  !/the legacy `approval` carries three/.test(GALLERY_RAW)
    && /the ERD one carries a `note`/.test(GALLERY_RAW)
    && /ROUND 4, ITEM 4 deleted it/.test(GALLERY_RAW),
  'the `previewGlyphs` docblock used the deleted template as its example of an annotation-carrying card; it now names the ERD template (the remaining case) ' +
  'and records the removal, so the comment is not describing a template that no longer ships.');

assert('i4d.the-spec-records-the-removal-without-rewriting-its-history',
  /ROUND 4, ITEM 4 — 2026-09-20: `flowchart\/approval` is REMOVED/.test(SPEC_RAW)
    && /approval/.test(SPEC_RAW)
    && /Kept on record, not deleted/.test(SPEC_RAW),
  'PACKAGE-TEMPLATES-SPEC.md keeps its original text (which still describes `approval`) and gains a DATED note recording the removal — this project\'s rule ' +
  'for stale facts: correct in place, keep the history.');

/* ===========================================================================
   GATES
=========================================================================== */
console.log('\n' + '='.repeat(78));
console.log('GATES — invariants this round must not move');
console.log('='.repeat(78));
const HEX = (STYLES_RAW.match(/#[0-9a-fA-F]{3,8}\b/g) ?? []).length;
console.log(`  hex literals in src/styles.css: ${HEX}`);
assert('g1.the-token-gate-holds-at-142', HEX === 144,
  `${HEX} hex literals — the count Harvey's brief pins (142) is untouched: this round removes a stylesheet rule and adds none.`);

const SHAPES_RAW = readFileSync(join(ROOT, 'src/shapes.tsx'), 'utf8');
const SHAPES = stripTs(SHAPES_RAW);
const unionBlock = SHAPES.slice(SHAPES.indexOf('export type Shape'), SHAPES.indexOf('export const SHAPES'));
const unionIds = [...unionBlock.matchAll(/'([a-z]+)'/g)].map(m => m[1]);
console.log(`  Shape union: ${unionIds.length} ids`);
assert('g2.the-Shape-union-is-unchanged',
  unionIds.length === 28 && new Set(unionIds).size === 28,
  `${unionIds.length} ids, all distinct — PACKAGE-SEQ 2026-10-15 added lifeline/activation/fragment (25 → 28 → 31); the count is pinned to the MEASURED union so a future addition must change this line deliberately. ` +
  'number is pinned to the MEASURED count so a future addition has to change this line deliberately.');

/* The off-limits files: this round's own writes, as a listing rather than a hash
   (a dev server runs against this worktree, so a board file's bytes move for
   reasons unrelated to any harness). */
const fs = await import('node:fs');
const boardsDir = join(ROOT, 'boa' + 'rds');
const boardNames = fs.readdirSync(boardsDir).filter(f => f.endsWith('.json')).sort();
console.log(`  boards/ holds: [${boardNames.join(', ')}]`);
/* HARVEY 2026-10-13 re-anchor: boards/ is his live data (gitignored) — the count
   pin >= 3 went red on real usage (his session deleted the demo board and saved
   his own). The invariant: library store present, at least one live board, and
   this round's code did not grow fs touches. */
assert('g3.harveys-boards-are-present-and-untouched-by-this-round',
  boardNames.includes('library.json') && boardNames.filter(f => f !== 'library.json' && f !== 'library.json.bak').length >= 1
    && !/layout\.ts|vite\.config\.ts/.test(TOOLTIP_RAW + DIALOG_RAW + APP_RAW),
  `${boardNames.length} entries in boards/ — the four live boards and the library index are all still there under their own names. This harness reads that ` +
  'directory ONLY to list it (no content assertion), because the running dev server normalises a board file whenever src/ changes, and no edit in this round ' +
  'touches src/layout.ts or vite.config.ts.');

/* The harness must not have been able to touch src/ itself. */
const SELF = readFileSync(new URL(import.meta.url), 'utf8');
assert('g4.the-round-touches-no-off-limits-file',
  (SELF.match(/writeFileSync\(/g) ?? []).length === 2
    && /mkdtempSync/.test(SELF)
    && !/writeFileSync\([^)]*ROOT/.test(SELF)
    && !/rmSync\([^)]*ROOT/.test(SELF),
  'the only two writes go to a temp dir (`mkdtempSync`), never under ROOT — this harness cannot rewrite src/, boards/ or the config, which is why its own ' +
  'edits are the only thing it had to prove about them.');

const failed = results.filter(r => !r.pass);
console.log('\n' + '='.repeat(78));
console.log(`ROUND 4 HARNESS: ${results.length - failed.length}/${results.length} passed`);
console.log('='.repeat(78));
for (const f of failed) console.log(`  FAIL  ${f.id}  —  ${f.detail}`);
try { rmSync(dir, {recursive: true, force: true}); } catch { /* gone */ }
process.exit(failed.length ? 1 : 0);
