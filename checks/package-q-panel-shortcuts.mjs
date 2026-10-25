#!/usr/bin/env node
/**
 * PACKAGE-Q harness — the panel-toggle chords and their five advertising
 * surfaces. Node only: no browser, no DOM, no CDP. Every claim below is read
 * out of the real sources, quoted with file + line.
 *
 * WHY THE CHORDS ARE MATCHED ON THE PHYSICAL KEY. All three chords carry Shift,
 * and Shift rewrites the character a key delivers: Shift+backslash arrives as
 * `|`, Shift+bracketleft as `{`, Shift+bracketright as `}`. A handler that
 * compared the delivered character would therefore never fire. (Same class the
 * Shift+1 / Shift+2 branches already dodge by matching the physical Digit keys.)
 * So the assertions below look for the CODE-based match and assert the
 * character-based spelling is GONE.
 *
 * WHY THERE IS NO `mod` IN THE GROUP CHORD. This app's `mod` is meta-OR-ctrl, so
 * it cannot express "both modifiers together" — and the user asked for Cmd AND
 * Ctrl on macOS. The harness asserts the real modifier PAIR is tested, so a
 * regression back to a `mod`-only branch would fire on Cmd+Shift+backslash
 * alone and FAIL here.
 *
 * WHAT IT CANNOT SEE: the browser. That the chords actually fire, that the
 * chevron tooltip opens and paints its chips, and the overlay tier's behaviour
 * at a tablet/phone breakpoint are the orchestrator's live pass. This file
 * asserts the SOURCE and the PARITY between the surfaces it documents.
 */
import {readFileSync} from 'node:fs';

const ROOT = '/home/harvey/projects/tech-goblin/lab/diagram-studio';
const APP_RAW = readFileSync(`${ROOT}/src/App.tsx`, 'utf8');
const SET_RAW = readFileSync(`${ROOT}/src/Settings.tsx`, 'utf8');
const README = readFileSync(`${ROOT}/README.md`, 'utf8');

/** Strip block + line comments WITHOUT changing the line count, so a line
 *  number taken from the raw file indexes the same line in the stripped text.
 *  (A stripper that deletes lines silently shifts every slice below it — the
 *  bug this harness shipped first, which made its own region assertions lie.)
 *  The `[^:]` before `//` keeps `https://`. */
const stripTs = s => s
  .replace(/\/\*[\s\S]*?\*\//g, m => m.replace(/[^\n]/g, ''))
  .replace(/(^|[^:])\/\/[^\n]*/g, '$1');
const APP = stripTs(APP_RAW)
  /* ROUND BN-3 PHASE B — the ? sheet's rows moved to src/components/HelpSheet.tsx;
     appended AFTER App so every at()/line-number lookup on APP_RAW is unchanged. */
  + '\n' + stripTs(readFileSync(`${ROOT}/src/components/HelpSheet.tsx`, 'utf8'));
const SET = stripTs(SET_RAW);

const APP_L = APP_RAW.split('\n');
const APP_C = APP.split('\n');
/** 1-based line of `raw`'s first line containing `needle` (0 = absent). */
const at = (raw, needle) => {
  const i = raw.split('\n').findIndex(l => l.includes(needle));
  return i < 0 ? 0 : i + 1;
};
const countOf = (text, needle) => text.split(needle).length - 1;
/** The panel-chord block, comment-stripped: its first line (the shared chord
 *  predicate) through the last branch. Scoped this tightly on purpose — a slice
 *  that starts any earlier swallows the unrelated `mod && k === 'z'` undo/redo
 *  branches above it, and the "no branch reads the meta-OR-ctrl flag" assertion
 *  below then fails on code that has nothing to do with the panel chords. */
const REGION_START = at(APP_RAW, 'const mac = typeof navigator');
const REGION = APP_C.slice(REGION_START - 1, at(APP_RAW, "togglePanel('right')") + 3).join('\n');

let pass = 0;
const fails = [];
const ok = (name, cond, detail = '') => {
  if (cond) { pass++; console.log(`  PASS  ${name}`); }
  else { fails.push(`${name}${detail ? ` — ${detail}` : ''}`); console.log(`  FAIL  ${name}${detail ? ` — ${detail}` : ''}`); }
};
const quote = (raw, needle) => {
  const n = at(raw, needle);
  const body = n ? raw.split('\n')[n - 1].trim() : '<absent>';
  return `${n ? `App.tsx:${n}` : 'App.tsx:<no line>'}  ${body}`;
};

/* =========================================================================
   (a) THE THREE CHORDS MATCH ON `e.code`, AND THE CHARACTER FORM IS GONE.
   ========================================================================= */
console.log('\n(a) matched on the physical key (e.code), never on the delivered character');
const L_BACKSLASH = at(APP_RAW, "e.code === 'Backslash'");
const L_BRACKET_L = at(APP_RAW, "e.code === 'BracketLeft'");
const L_BRACKET_R = at(APP_RAW, "e.code === 'BracketRight'");
ok('group chord matches e.code === \'Backslash\'', L_BACKSLASH > 0, quote(APP_RAW, "e.code === 'Backslash'"));
ok('left chord matches e.code === \'BracketLeft\'', L_BRACKET_L > 0, quote(APP_RAW, "e.code === 'BracketLeft'"));
ok('right chord matches e.code === \'BracketRight\'', L_BRACKET_R > 0, quote(APP_RAW, "e.code === 'BracketRight'"));
/* The character spellings are the trap, spelled here only as the NEEDLE the
   assertion searches for — the sources must not contain them. */
const BAD_BACKSLASH = "k === '\\\\'";
const BAD_L = "k === '['";
const BAD_R = "k === ']'";
ok('no branch left matching k === backslash (the replaced e.key form)', !APP.includes(BAD_BACKSLASH));
ok('no branch matching k === \'[\' (Shift would deliver \'{\')', !APP.includes(BAD_L));
ok('no branch matching k === \']\' (Shift would deliver \'}\')', !APP.includes(BAD_R));
ok('no branch matching e.key === \'[\' / \']\'', !APP.includes("e.key === '['") && !APP.includes("e.key === ']'"));

/* =========================================================================
   (b) THE GROUP CHORD REQUIRES THE ACTUAL MODIFIER PAIR ON macOS.
   ========================================================================= */
console.log('\n(b) the group chord tests metaKey AND ctrlKey (a `mod`-only branch would fire on Cmd+Shift+backslash)');
const L_PAIR = at(APP_RAW, 'e.metaKey && e.ctrlKey && e.shiftKey');
ok('the macOS pair metaKey && ctrlKey && shiftKey is tested', L_PAIR > 0, quote(APP_RAW, 'e.metaKey && e.ctrlKey && e.shiftKey'));
ok('the shared chord predicate is defined before every branch that reads it',
  at(APP_RAW, 'const panelChord') > 0 && at(APP_RAW, 'const panelChord') < L_BACKSLASH,
  quote(APP_RAW, 'const panelChord'));
ok('no panel branch reads the meta-OR-ctrl `mod` flag',
  !REGION.includes('mod &&') && !REGION.includes('&& mod'),
  'the region matches `panelChord` only');
ok('the mod+Shift+backslash branch (meta-OR-ctrl) is absent', !APP.includes("mod && e.shiftKey && k === '\\\\'"));

/* =========================================================================
   (c) EACH BRANCH CALLS THE EXISTING WRITER — ONE PATH EACH.
   ========================================================================= */
console.log('\n(c) the existing writers, no second path');
ok('group chord writes setPanelsVisible(left && right) from the visible-state ref',
  REGION.includes('const {left, right} = hiddenRef.current;') && REGION.includes('setPanelsVisible(left && right)'),
  quote(APP_RAW, 'setPanelsVisible(left && right)'));
ok('setPanelsVisible has exactly ONE call site in App.tsx (atomic both-sides write)',
  countOf(APP, 'setPanelsVisible(') === 1, `found ${countOf(APP, 'setPanelsVisible(')}`);
ok('left chord calls togglePanel(\'left\')', at(APP_RAW, "togglePanel('left')") > 0, quote(APP_RAW, "togglePanel('left')"));
ok('right chord calls togglePanel(\'right\')', at(APP_RAW, "togglePanel('right')") > 0, quote(APP_RAW, "togglePanel('right')"));
ok('the handler region calls togglePanel exactly twice (left + right, nothing else)',
  countOf(REGION, 'togglePanel(') === 2, `found ${countOf(REGION, 'togglePanel(')}`);
ok('all three branches preventDefault (the bracket keys must reach nothing else)',
  countOf(REGION, 'e.preventDefault()') >= 3, `found ${countOf(REGION, 'e.preventDefault()')}`);

/* =========================================================================
   (d) PLACEMENT — BELOW the read-only return (so review mode swallows them,
       exactly as it swallowed the chord they replace), BELOW the overlay guard,
       ABOVE the nudge / help / search branches.
   ========================================================================= */
console.log('\n(d) the guarded region');
const L_READONLY = at(APP_RAW, 'if (readOnly) {');
const L_READONLY_RET = APP_L.findIndex((l, i) => i + 1 > L_READONLY && l.trim() === 'return;') + 1;
const L_OVERLAY = at(APP_RAW, 'if (tourOpen || help || boardsOpen || searchPos) return;');
const L_NUDGE = at(APP_RAW, "if (k === 'arrowleft' || k === 'arrowright'");
ok('the group branch sits BELOW the read-only guard', L_BACKSLASH > L_READONLY_RET,
  `read-only return App.tsx:${L_READONLY_RET} < group branch App.tsx:${L_BACKSLASH}`);
ok('the left branch sits BELOW the read-only guard', L_BRACKET_L > L_READONLY_RET, `App.tsx:${L_BRACKET_L}`);
ok('the right branch sits BELOW the read-only guard', L_BRACKET_R > L_READONLY_RET, `App.tsx:${L_BRACKET_R}`);
ok('all three sit BELOW the overlay guard', L_BACKSLASH > L_OVERLAY && L_BRACKET_L > L_OVERLAY && L_BRACKET_R > L_OVERLAY,
  `overlay guard App.tsx:${L_OVERLAY}`);
ok('all three sit ABOVE the arrow-nudge branch (which they shadow)', L_BACKSLASH < L_NUDGE && L_BRACKET_R < L_NUDGE,
  `nudge App.tsx:${L_NUDGE}`);
ok('the read-only guard still swallows every panel chord in review mode',
  APP_C.slice(L_READONLY - 1, L_READONLY_RET).join('\n').includes('return;'), quote(APP_RAW, 'if (readOnly) {'));

/* =========================================================================
   (e) PARITY — five surfaces, one wording, one chip set each. A surface
       missing a combo is a FAIL; the `?` sheet must render chips, not prose.
   ========================================================================= */
console.log('\n(e) parity across the five surfaces');
const BOTH_LABEL = 'Collapse / expand both panels';
const LEFT_LABEL = 'Toggle left panel';
const RIGHT_LABEL = 'Toggle right panel';
/* 1 — the handler: one branch per combo, the keys named as physical codes. */
ok('1 handler carries all three combos',
  L_BACKSLASH > 0 && L_BRACKET_L > 0 && L_BRACKET_R > 0,
  `App.tsx:${L_BACKSLASH}, ${L_BRACKET_L}, ${L_BRACKET_R}`);
/* 2 — the chevrons' own tooltips/aria: per-side chip sets + ARIA tokens. */
ok('2 left chevron advertises its OWN chord (⌘ ⌃ ⇧ [ chips)',
  APP.includes("const sideGlyph = side === 'left' ? '[' : ']'") && APP.includes("const sideKey = side === 'left' ? 'BracketLeft' : 'BracketRight'"),
  quote(APP_RAW, "const sideGlyph = side === 'left' ? '[' : ']'"));
ok('2 aria-keyshortcuts carries the ARIA token spelling, per side',
  APP.includes('aria-keyshortcuts={isOverlay ? undefined : ariaChord}') &&
    APP.includes("${macPlatform ? 'Meta+Control' : 'Control'}+Shift+${sideKey}"),
  quote(APP_RAW, 'aria-keyshortcuts={isOverlay ? undefined : ariaChord}'));
ok('2 the chevron renders its shortcut as kbd chips (keys as chips, gestures as text)',
  APP.includes('className="tt-keys"') && APP.includes('<kbd>{sideGlyph}</kbd>'),
  quote(APP_RAW, 'className="tt-keys"'));
/* 3 — the `?` cheat sheet: one help-row per combo, keys as chips. */
const rows = {
  both: `<div className="help-row"><span>${BOTH_LABEL}</span><span className="help-keys"><kbd>⌘/Ctrl</kbd><kbd>⌃</kbd><kbd>⇧</kbd><kbd>{'\\\\'}</kbd></span></div>`,
  left: `<div className="help-row"><span>${LEFT_LABEL}</span><span className="help-keys"><kbd>⌘/Ctrl</kbd><kbd>⌃</kbd><kbd>⇧</kbd><kbd>[</kbd></span></div>`,
  right: `<div className="help-row"><span>${RIGHT_LABEL}</span><span className="help-keys"><kbd>⌘/Ctrl</kbd><kbd>⌃</kbd><kbd>⇧</kbd><kbd>]</kbd></span></div>`,
};
ok('3 `?` sheet has the group row, as chips', APP.includes(rows.both));
ok('3 `?` sheet has the left-panel row, as chips', APP.includes(rows.left));
ok('3 `?` sheet has the right-panel row, as chips', APP.includes(rows.right));
/* 4 — Settings → Shortcuts: same labels, same tokens. */
ok('4 Settings has the group row', SET.includes(`{what: '${BOTH_LABEL}',`) && SET.includes("'⌃', '⇧', '\\\\'"),
  quote(SET_RAW, BOTH_LABEL));
ok('4 Settings has the left row', SET.includes(`{what: '${LEFT_LABEL}',`) && SET.includes("'⌃', '⇧', '['"),
  quote(SET_RAW, LEFT_LABEL));
ok('4 Settings has the right row', SET.includes(`{what: '${RIGHT_LABEL}',`) && SET.includes("'⌃', '⇧', ']'"),
  quote(SET_RAW, RIGHT_LABEL));
ok('4 Settings still renders that list as kbd chips',
  SET.includes('{s.keys.map((k, i) => <kbd key={`${s.what}-${i}`}>{k}</kbd>)}'));
/* 5 — README's shortcut table. */
const readmeRow = s => new RegExp(`\\|\\s*\`${s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\``).test(README);
ok('5 README documents the group chord (Cmd/Ctrl + Ctrl + Shift + backslash)',
  readmeRow('Cmd/Ctrl + Ctrl + Shift + \\'), 'README.md:132 region');
ok('5 README documents the left chord', readmeRow('Cmd/Ctrl + Ctrl + Shift + ['));
ok('5 README documents the right chord', readmeRow('Cmd/Ctrl + Ctrl + Shift + ]'));
ok('5 README names the non-Mac form so the doc matches the code',
  README.includes('on Windows/Linux'));
/* The old three-chip group row must be gone from BOTH list surfaces: it is what
   a half-done update leaves behind, and it advertises a chord that no longer
   exists (the group chord gained a modifier). */
ok('no surface still advertises the OLD two-modifier form of the group chord',
  !APP.includes(`<span>${BOTH_LABEL}</span><span className="help-keys"><kbd>⌘/Ctrl</kbd><kbd>⇧</kbd>`) &&
    !SET.includes("{what: 'Collapse / expand panels'"));

/* =========================================================================
   (f) THE OVERLAY TIER: no chord, because no shortcut opens a drawer/sheet.
   ========================================================================= */
console.log('\n(f) the overlay tooltip carries no shortcut');
ok('the overlay branch returns the bare button (no Tooltip wrapper)',
  APP.includes('if (isOverlay) return button;'), quote(APP_RAW, 'if (isOverlay) return button;'));
ok('the overlay path still uses overlayTitle, and only there',
  countOf(APP, 'overlayTitle(') === 1, `found ${countOf(APP, 'overlayTitle(')}`);
ok('aria-keyshortcuts is withheld while the control opens an overlay',
  APP.includes('aria-keyshortcuts={isOverlay ? undefined : ariaChord}'));
ok('data-overlay-toggle and the hidden&&!isOverlay class logic are untouched',
  APP.includes('data-overlay-toggle={isOverlay ? overlayMode : undefined}') &&
    APP.includes("`panel-toggle${hidden && !isOverlay ? ' hidden' : ''}`"));

/* =========================================================================
   (g) NEGATIVE CONTROL — the neighbours this pass must NOT have touched.
   ========================================================================= */
console.log('\n(g) negative control — the untouched branches');
ok('Shift+1 fit-view still matches the physical Digit1 and still excludes mod',
  APP.includes("if (e.shiftKey && e.code === 'Digit1' && !mod) {"), quote(APP_RAW, "e.code === 'Digit1'"));
ok('Shift+2 read-only toggle still matches the physical Digit2 and still excludes mod',
  APP.includes("if (e.shiftKey && e.code === 'Digit2' && !mod) {"), quote(APP_RAW, "e.code === 'Digit2'"));
ok('undo / redo branch unchanged', APP.includes("if (mod && k === 'z') {"));
ok('copy / paste / duplicate branches unchanged',
  APP.includes("if (mod && k === 'c')") && APP.includes("if (mod && k === 'v')") && APP.includes("if (mod && k === 'd')"));
ok('the arrow-nudge branch unchanged (1px, Shift 10px)',
  APP.includes('const step = e.shiftKey ? 10 : 1;'), quote(APP_RAW, 'const step = e.shiftKey ? 10 : 1;'));
ok('the `?` help toggle and the `/` panel-search focus branches survive',
  APP.includes("if (k === '?') { setHelp(h => !h); return; }") && APP.includes("if (k === '/' && !mod"));
ok('the read-only mode still keeps `?` available and nothing else',
  APP_C.slice(L_READONLY - 1, L_READONLY_RET).join('\n').includes("if (k === '?')"));

/* ========================================================================= */
console.log(`\n${pass} passed, ${fails.length} failed`);
if (fails.length) {
  console.log('\nFAILURES:');
  for (const f of fails) console.log(`  - ${f}`);
  process.exit(1);
}
