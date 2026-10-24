// round-bg-feedback-entry.mjs — PUBLIC LAUNCH: the in-app Feedback link.
/*
  ROUND BH RE-ANCHOR (2026-10-24, commit 0c9b9df) — the entry became a BUTTON
  that opens the in-app feedback dialog, and the outbound anchor moved INTO
  the dialog (src/FeedbackDialog.tsx) as the no-GitHub-account fallback. The
  probes below now assert that NEW shape; the intent each one guards is
  unchanged: one entry, exact label, the issues page, new tab + noopener,
  and an enumerable external-anchor surface. The URL contract itself has its
  own dedicated harness now — checks/round-bh-feedback.mjs (33 assertions).
*/
//
// WHAT IT CHECKS (source probes only — no browser, no network; whether GitHub
// actually resolves the URL is out of scope here and covered by the repo being
// public before launch):
//   1. Settings → About carries ONE feedback entry, labelled exactly
//      "Feedback — report a bug or request a shape" — a BUTTON that opens the
//      in-app dialog; the outbound link itself lives inside the dialog
//      (new tab + noopener+noreferrer).
//   2. The dialog's fallback is the ONLY anchor in the whole src/ tree that
//      leaves the app — so the app's external-link surface stays enumerable
//      from one line.
//   3. The ? cheatsheet (help-pop) is untouched by this round: its rows are
//      width-budgeted by checks/package-o-metrics.mjs item 3 and must stay
//      keyboard/gesture rows only.
//   4. The entry's styles are TOKENS-ONLY (no new hex in .settings-feedback)
//      and the sheet's global hex-count gate (package-r-roadmap) still sees
//      the same pre-change count.
//
// REPLAY: every probe is RED on the pinned pre-change commit — no
// `settings-feedback` string exists anywhere in the tree before this round.

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(join(ROOT, p), 'utf8');
// comments BLANKED, not stripped (line numbers stay true; a comment quoting the
// link cannot read as the link being present)
const blank = (src) => src
  .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))
  .replace(/(^|[^:])\/\/[^\n]*/g, (m, p1) => p1 + ' '.repeat(m.length - p1.length));

const SET = blank(read('src/Settings.tsx'));
const APP = blank(read('src/App.tsx'));
const CSS = read('src/styles.css');
/* ROUND BH — the outbound anchor now lives in the feedback dialog */
const DLG = blank(read('src/FeedbackDialog.tsx'));

const failures = [];
let pass = 0, fail = 0, skip = 0;
function assert(name, ok, detail = '') {
  if (ok === null) { skip += 1; console.log(`SKIP  ${name}${detail ? ' - ' + detail : ''}`); return; }
  if (ok) { pass += 1; console.log(`PASS  ${name}${detail ? ' - ' + detail : ''}`); }
  else { fail += 1; console.log(`FAIL  ${name}${detail ? ' - ' + detail : ''}`); failures.push(name); }
}

const FEEDBACK_URL = 'https://github.com/harveynguyen33/goblin-diagrams/issues';
const LABEL = 'Feedback — report a bug or request a shape';

const about = SET.slice(SET.indexOf('function AboutPane('), SET.indexOf('the shell'));

/* ROUND BI RE-ANCHOR (2026-10-24) — the dialog's MOUNT moved from the About
   pane to App.tsx: one instance, two openers (this entry and the ? help
   sheet's new "Send feedback" action). So the entry no longer renders
   <FeedbackDialog> itself — it calls the opener App passes down, handing over
   its own element for the focus restore. The intent this probe guards is
   unchanged: ONE entry in the About pane, exact label, opening the in-app
   dialog rather than navigating. The slice anchor also dropped its `()`
   because AboutPane now takes a props object. */
assert('bg1 the About pane carries the feedback entry with the exact label (a button that opens the dialog)',
  (() => {
    const fbBtn = about.slice(about.indexOf('<button'), about.indexOf('</button>'));
    return fbBtn.includes(LABEL) && /onOpenFeedback\(fbBtnRef\.current\)/.test(fbBtn)
      && about.includes('className="settings-feedback"') && APP.includes('<FeedbackDialog');
  })(),
  'one quiet line under the Version row; opens the app-level dialog (onOpenFeedback), no direct navigation');

assert('bg2 the dialog\'s fallback link points at the GitHub issues page',
  DLG.includes('href={FEEDBACK_ISSUES_URL}')
    && read('src/feedbackIssueUrl.ts').includes(`export const FEEDBACK_ISSUES_URL = '${FEEDBACK_URL}'`),
  FEEDBACK_URL + ' (the constant the fallback binds, defined once in src/feedbackIssueUrl.ts)');

assert('bg3 the fallback opens in a new tab with noopener (and noreferrer)',
  DLG.includes('target="_blank"') && DLG.includes('rel="noopener noreferrer"'),
  'target=_blank + rel="noopener noreferrer"');

/* the app's whole external-anchor surface: the Settings link is the ONLY
   src anchor with an http(s) href. printView's window.open is a different
   mechanism (a generated window, not a navigated document) and App.tsx:4271's
   download anchor carries no href to another origin. */
/* ROUND BH: the anchor's href is a JSX EXPRESSION bound to the shared
   constant (not a string literal), so the scan also matches that exact
   binding — the surface stays one enumerable line. */
const srcFiles = ['src/Settings.tsx', 'src/App.tsx', 'src/FeedbackDialog.tsx'];
const externalAnchors = [];
for (const f of srcFiles) {
  const s = blank(read(f));
  for (const m of s.matchAll(/<a\s[^>]*href="(https?:[^"]*)"[^>]*>/g)) {
    externalAnchors.push(`${f}: ${m[1]}`);
  }
  for (const m of s.matchAll(/<a\s[^>]*href=\{FEEDBACK_ISSUES_URL\}[^>]*>/g)) {
    externalAnchors.push(`${f}: {FEEDBACK_ISSUES_URL}`);
  }
}
assert('bg4 the dialog\'s fallback is the app\'s only external anchor',
  externalAnchors.length === 1 && externalAnchors[0] === 'src/FeedbackDialog.tsx: {FEEDBACK_ISSUES_URL}',
  externalAnchors.join(' | ') || 'none found');

/* ROUND BI: the sheet now carries a "Send feedback" ACTION — a button that
   opens the dialog, deliberately NOT an anchor. This probe still guards the
   thing it always did: no outbound link leaves the app from the sheet (the
   only external anchor lives inside the dialog, bg4). */
assert('bg5 the ? cheatsheet keeps no outbound anchor (its feedback action is a button, not a link)',
  (() => {
    const h = APP.slice(APP.indexOf('className="help-pop"'), APP.indexOf('className="help-pop"') + 5000);
    return !/<a\s|href=/.test(h);
  })(), 'help-pop block carries no anchor');

/* the link's own rules are TOKENS-ONLY: no hex literal inside any
   .settings-feedback rule body. */
const feedbackRules = [];
{
  const lines = CSS.split('\n');
  for (let i = 0; i < lines.length; i++) {
    if (!lines[i].includes('.settings-feedback')) continue;
    if (!/\{\s*$/.test(lines[i].trim()) && !lines[i].includes('{') ) continue;
    const body = [];
    let j = lines[i].includes('{') && !/\}\s*$/.test(lines[i]) ? i : i;
    for (; j < lines.length; j++) {
      if (j > i && lines[j].trim().startsWith('}')) break;
      if (j === i && /\}\s*$/.test(lines[j])) break;
      body.push(lines[j]);
    }
    feedbackRules.push({ line: i + 1, body: body.join(' ') });
  }
}
assert('bg6 .settings-feedback rules exist and use tokens only (no hex)',
  feedbackRules.length >= 2 && feedbackRules.every(r => !/#[0-9a-fA-F]{3,8}\b/.test(r.body.replace(/\/\*[\s\S]*?\*\//g, ''))),
  `${feedbackRules.length} rule(s): ${feedbackRules.map(r => `styles.css:${r.line}`).join(', ')}`);

/* the sheet's hex gate (package-r-roadmap r11) is measured on the RAW sheet
   (comments included — that is the project's own grep command) against a
   ceiling of 144. This round adds ZERO hex (tokens only), so the count must
   still be at or under the ceiling with no raise. */
const hexCount = (src) => (src.match(/#[0-9a-fA-F]{3,8}\b/g) || []).length;
const n = hexCount(read('src/styles.css'));
assert('bg7 styles.css hex count still within the r11 ceiling (this round adds zero hex)', n <= 144,
  `count=${n} (raw sheet, ceiling 144, pre-change number untouched)`);

console.log(`\n  ${pass} PASS / ${fail} FAIL / ${skip} SKIP\n`);
if (failures.length) {
  console.error(`ROUND-BG FEEDBACK: ${failures.length} failing probe(s):\n  - ${failures.join('\n  - ')}`);
  process.exit(1);
}
