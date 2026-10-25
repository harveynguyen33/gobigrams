#!/usr/bin/env node
/**
 * ROUND BH, ITEM 1 — THE IN-APP FEEDBACK DIALOG (public launch, 2026-10-24).
 *
 * WHAT IT CHECKS (the honest static-host pattern — NO token in the client):
 *   STATIC  — src/FeedbackDialog.tsx exists with the BoardDialog accessibility
 *     contract (role=dialog, aria-modal, FOCUSABLE imported from './Settings',
 *     capture-phase Esc + Tab trap, focus restore), the form surface (bug /
 *     feature radios, title, details, optional email), and the honest caption +
 *     plain fallback link under the submit button. Also: NO token, NO POST, NO
 *     api.github.com anywhere in the flow — a public static app cannot ship a
 *     secret, so the ONLY network act is window.open on a prefilled new-issue
 *     URL.
 *   UNIT    — the URL builder is EXECUTED (esbuild-bundles src/feedbackIssueUrl.ts
 *     the same way package-r-roadmap executes src/roadmap.ts) and its output is
 *     parsed with URLSearchParams: template selects bug_report.md vs
 *     feature_request.md, the title round-trips byte-exact (after trim,
 *     unicode/punctuation intact), the body carries the type word + details +
 *     email (or an em-dash placeholder), and there is NO labels param (an
 *     anonymous client cannot set labels — pretending otherwise would 400).
 *   LIVE    — on the dev server: Settings → About → the Feedback entry opens the
 *     dialog, initial focus lands in the title field, 24 Tabs never leave the
 *     card (the trap), Escape closes ONLY the dialog (Settings stays open,
 *     focus returns to the entry button), and a real fill+submit captures the
 *     window.open URL (window.open is stubbed via addInitScript) and re-runs
 *     the unit assertions against it, for BOTH kinds.
 *
 * REPLAY: every probe is RED on the pinned pre-change commit — neither
 * src/FeedbackDialog.tsx nor src/feedbackIssueUrl.ts exists there.
 */
import {readFileSync, existsSync, mkdtempSync, rmSync} from 'node:fs';
import {join, dirname, resolve} from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {execFileSync} from 'node:child_process';
import {tmpdir} from 'node:os';
import {createRequire} from 'node:module';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');
const APP_URL = process.env.BH_APP_URL || process.env.AY_APP_URL || 'http://192.168.33.200:5200/';

const read = (p) => readFileSync(join(ROOT, p), 'utf8');
/* comments BLANKED, not stripped (round-bg discipline: a docblock quoting the
   old markup must not count as the markup being present). */
const blank = (src) => src
  .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))
  .replace(/(^|[^:])\/\/[^\n]*/g, (m, p1) => p1 + ' '.repeat(m.length - p1.length));

const results = [];
const assert = (id, pass, detail = '') => {
  results.push({id, pass: !!pass, detail});
  console.log(`  ${pass ? 'PASS' : 'FAIL'}  ${id}  —  ${detail}`);
};

const FEEDBACK_REPO = 'https://github.com/harveynguyen33/gobigrams';
const FEEDBACK_LABEL = 'Feedback — report a bug or request a shape';

console.log(`round-bh-feedback — ROOT=${ROOT}  APP_URL=${APP_URL}`);

/* ===========================================================================
   STATIC — the dialog component + the Settings wiring + the CSS
   =========================================================================== */
console.log('='.repeat(78));
console.log('STATIC — src/FeedbackDialog.tsx, src/feedbackIssueUrl.ts, Settings wiring, CSS');
console.log('='.repeat(78));

let DLG = '', SET = '', CSS = '', CB = '', APP = '';
try {
  DLG = blank(read('src/FeedbackDialog.tsx'));
  /* ROUND BI — the screenshot helper's brain: a pure, React-free module the
     harness can BUNDLE AND EXECUTE (the bh.u* discipline applied to the new
     code path), so the clipboard contract is proved by behaviour and not only
     by regex. */
  try { CB = blank(read('src/boardClipboard.ts')); } catch { CB = ''; }
  assert('bh.s1.dialog-file-exists', true, 'src/FeedbackDialog.tsx reads and comment-blanks cleanly');
} catch {
  assert('bh.s1.dialog-file-exists', false, 'src/FeedbackDialog.tsx not found (RED on the pre-change commit)');
}
try { SET = blank(read('src/Settings.tsx')); } catch { /* probed below */ }
try { CSS = read('src/styles.css'); } catch { /* probed below */ }
/* ROUND BI, ITEM 3 — the help sheet lives in App.tsx, so the harness reads it
   too (blanked: the assertions below are about ELEMENTS and handlers, not
   comments).
   ROUND BN-3 PHASE B — the sheet's JSX moved VERBATIM to
   src/components/HelpSheet.tsx; `APP` reads the UNION so the sheet's
   assertions (s23/s24: order + handler tokens) still see the sheet, while
   the dialog-mount assertion (s25) still sees App. */
/* ROUND BN-3 PHASE B — the five modal mounts (incl. <FeedbackDialog>) moved to
   src/components/ModalMounts.tsx; `APP` reads the UNION so the mount assertions
   follow the code home. */
try { APP = blank(read('src/App.tsx') + '\n' + read('src/components/HelpSheet.tsx') + '\n' + read('src/components/ModalMounts.tsx')); } catch { /* probed below */ }

if (DLG) {
  assert('bh.s2.focusable-imported-from-settings-one-definition',
    /import\s*\{FOCUSABLE\}\s*from\s*'\.\/Settings'/.test(DLG),
    "imports FOCUSABLE from './Settings' — the trap uses the app's ONE definition of focusable (BoardDialog's rule)");

  assert('bh.s3.dialog-a11y-contract',
    /role="dialog"/.test(DLG) && /aria-modal="true"/.test(DLG) && /aria-labelledby=/.test(DLG)
      && /data-feedback-dialog=/.test(DLG),
    'role="dialog" + aria-modal + aria-labelledby + data-feedback-dialog (the BoardDialog contract)');

  assert('bh.s4.capture-listener-esc-and-tab-trap',
    /addEventListener\('keydown',\s*\w+,\s*true\)/.test(DLG)
      && /e\.key === 'Escape'/.test(DLG) && /e\.key !== 'Tab'/.test(DLG)
      && /first\.focus\(\)/.test(DLG) && /last\.focus\(\)/.test(DLG)
      && /stopPropagation/.test(DLG),
    'document keydown in CAPTURE with Escape → close (preventDefault + stopPropagation) and the Tab wrap first↔last');

  assert('bh.s5.focus-restore-contract',
    /returnFocusTo\?\.current\?\.focus\(\)/.test(DLG),
    'unmount cleanup returns focus to the opener (returnFocusTo, BoardDialog/Settings contract)');

  assert('bh.s6.form-surface',
    (DLG.match(/name="fb-kind"/g) || []).length >= 1
      && /type="radio"/.test(DLG) && /key: 'bug'/.test(DLG) && /key: 'feature'/.test(DLG)
      && /id="fb-title"/.test(DLG) && /id="fb-details"/.test(DLG) && /id="fb-email"/.test(DLG)
      && /<textarea[^>]*id="fb-details"/.test(DLG) && /type="email"/.test(DLG),
    'the fb-kind radio pair (mapped from KINDS: bug + feature), #fb-title input, #fb-details textarea, #fb-email type=email');

  assert('bh.s7.submit-gated-on-title-and-opens-new-tab',
    /disabled=\{!canSubmit\}/.test(DLG) && /title\.trim\(\)/.test(DLG)
      && /window\.open\(\s*buildFeedbackIssueUrl\(/.test(DLG)
      && /'_blank',\s*'noopener,noreferrer'/.test(DLG),
    'submit disabled until the title is non-blank; window.open(url, _blank, noopener,noreferrer)');

  /* THE HONESTY PROBE — the whole point of the pattern. A public static app
     cannot ship a GitHub token (any client token is public), so the flow must
     contain NO credential, NO api.github.com call, NO POST. */
  assert('bh.s8.no-token-no-post-static-honesty',
    !/api\.github\.com/.test(DLG) && !/Authorization/i.test(DLG) && !/token/i.test(DLG)
      && !/fetch\(/.test(DLG) && !/XMLHttpRequest/.test(DLG),
    'no api.github.com / Authorization / token / fetch / XHR in the dialog — the only network act is window.open');

  /* Re-anchored (Harvey, 2026-10-24): the caption was rewritten into product
     voice ("Send opens GitHub with your note written — press Submit there.")
     and the odd "email-free bug tracker" link became "Or browse the issue
     tracker". The guarantee is unchanged: the GitHub hand-off is still stated
     and the plain fallback anchor still exists with new-tab + noopener. */
  assert('bh.s9.honest-caption-and-fallback-link',
    /press Submit there/.test(DLG)
      && new RegExp(`href=\\{?FEEDBACK_ISSUES_URL\\}?`).test(DLG)
      && /Or browse the issue tracker/.test(DLG)
      && /target="_blank"/.test(DLG) && /rel="noopener noreferrer"/.test(DLG),
    "caption states the GitHub hand-off ('press Submit there') + a plain 'browse the issue tracker' anchor, new tab + noopener noreferrer");

  /* ------------------------------------------------------------------------
     ROUND BI, ITEM 1 — THE SCREENSHOT HELPER (the honest static-host pattern,
     continued): the app copies the CURRENT board to the clipboard as a PNG and
     the user pastes it into the GitHub body, where GITHUB's own uploader hosts
     the image. No backend, no token, no upload from the app — the only network
     act stays window.open.
     ------------------------------------------------------------------------ */

  /* (i) the clipboard path exists AND is feature-detected. The gate is
     `boardPng` (non-empty board, supplied by App) AND `clipboardUsable()`
     (navigator.clipboard + window.ClipboardItem); when either is false the row
     does not render at all — no dead button. */
  /* Re-anchored (Harvey, 2026-10-24: "tôi thấy nó vẫn là textarea" — he never saw
     the helper because a plain-http LAN origin hid the whole row, which reads as
     "this app cannot take a screenshot at all"). The contract changed on purpose:
     the row now renders whenever there IS a board, and a missing clipboard shows
     an explanation instead of nothing. The feature detection is unchanged. */
  assert('bh.s14.screenshot-helper-feature-detected-and-gated',
    /Copy board as PNG/.test(DLG)
      && /\{boardPng\s*&&/.test(DLG)
      && /const clipboardReady = clipboardUsable\(\)/.test(DLG)
      && /data-fb-clipboard-blocked/.test(DLG)
      && /Copying needs HTTPS/.test(DLG)
      && /navigator\.clipboard/.test(CB)
      && /window\.ClipboardItem/.test(CB),
    `the helper row renders for any non-empty board; when the clipboard is unavailable it explains (Copying needs HTTPS) instead of hiding; the pure module still detects navigator.clipboard + window.ClipboardItem`);

  /* the three pieces of copy the row must say, verbatim: the success label,
     the hairline note, and the non-blocking failure line. */
  assert('bh.s15.screenshot-helper-copy-is-honest',
    /Copied — paste it in the GitHub body \(Ctrl\+V \/ ⌘V\)/.test(DLG)
      && /GitHub uploads pasted images for you\./.test(DLG)
      && /Couldn't copy — take a screenshot manually and paste it in the GitHub body\./.test(DLG),
    'success label names the paste step + the Ctrl+V / ⌘V hint; the hairline note credits GitHub\'s uploader; failure is a manual-screenshot instruction');

  /* (ii) NO upload/POST/token regression: the new code adds no transport. The
     clipboard is a BROWSER API — it moves bytes to the user's own clipboard,
     never to a server. */
  assert('bh.s16.no-upload-no-post-no-secret-in-the-new-code',
    !/fetch\s*\(/.test(DLG + CB) && !/XMLHttpRequest/.test(DLG + CB)
      && !/new\s+Request\s*\(/.test(DLG + CB) && !/FormData/.test(DLG + CB)
      && !/method\s*:\s*'POST'/i.test(DLG + CB) && !/Authorization/i.test(DLG + CB)
      && !/api\.github\.com/.test(DLG + CB) && !/token/i.test(DLG + CB)
      && !/sendBeacon/.test(DLG + CB) && !/WebSocket/.test(DLG + CB),
    'dialog + boardClipboard.ts carry no fetch/XHR/Request/FormData/POST/Authorization/api.github.com/beacon/socket — the clipboard is a browser API, and the only network act is still window.open');

  /* (iii) Send is NOT gated on the copy. The submit handler fires the copy and
     then opens the form in the SAME gesture: fire-and-forget (`void`), never
     awaited, and its only `return` is the can-submit guard ABOVE the copy. A
     refused clipboard must cost the user nothing. */
  const submitSrc = (() => {
    const s0 = DLG.indexOf('const submit =');
    if (s0 < 0) return '';
    const s1 = DLG.indexOf('\n  };', s0);
    return s1 > s0 ? DLG.slice(s0, s1) : DLG.slice(s0, s0 + 1400);
  })();
  const submitReturns = (submitSrc.match(/\breturn\b/g) || []).length;
  assert('bh.s17.send-is-not-gated-on-the-copy',
    submitSrc.length > 0
      && /void copyShot\(\)/.test(submitSrc)
      && !/await copyShot/.test(submitSrc)
      && submitReturns === 1
      && submitSrc.indexOf('return') < submitSrc.indexOf('void copyShot()')
      && submitSrc.indexOf('window.open(') > submitSrc.indexOf('void copyShot()'),
    `submit body: ${submitReturns} return (the can-submit guard, above the copy), copy fired as \`void copyShot()\` without await, window.open AFTER it — a failed copy cannot block Send`);

  /* ITEM 2 — the title placeholder must fit the field: the old sentence was cut
     mid-word ("...what happened, or what you") at desktop width. */
  const titlePlaceholder = (DLG.match(/id="fb-title"[\s\S]{0,400}?placeholder="([^"]*)"/) || [])[1] || '';
  assert('bh.s18.title-placeholder-fits-the-field',
    titlePlaceholder === 'One line: what happened?' && titlePlaceholder.length <= 30,
    `placeholder=${JSON.stringify(titlePlaceholder)} (${titlePlaceholder.length} chars, lower-case-consistent with the other placeholders)`);
}

if (SET) {
  /* the label sits in a button whose onClick arrow (`=>`) breaks a [^>]* tag
     regex, so the tag block is SLICED between the literal delimiters instead.
     ROUND BI re-anchor: the anchor dropped its `()` — AboutPane now takes a
     props object ({boardPng}, the screenshot helper's board supplier), so a
     literal 'function AboutPane()' no longer exists. Same body, same contract. */
  const about = SET.slice(SET.indexOf('function AboutPane('), SET.indexOf('the shell'));
  const fbBtn = about.slice(about.indexOf('<button'), about.indexOf('</button>'));
  /* ROUND BI, ITEM 3 re-anchor: the dialog's MOUNT moved to App.tsx (one
     instance, two openers — Settings → About and the ? help sheet), so the
     About entry no longer renders <FeedbackDialog> itself; it calls the opener
     App passes down, handing over its own element for the focus restore. Same
     contract — one click on the About entry, one feedback form — new mechanism. */
  assert('bh.s10.about-entry-is-the-dialog-opener',
    fbBtn.includes(FEEDBACK_LABEL) && /onOpenFeedback\(fbBtnRef\.current\)/.test(fbBtn)
      && about.includes('className="settings-feedback"') && /onOpenFeedback:/.test(SET),
    'the About pane entry is a BUTTON with the exact round-BG label that calls the app-level feedback opener (onOpenFeedback), passing itself as the focus-restore target');

  assert('bh.s11.settings-keyboard-defers-to-the-dialog',
    /querySelector\('\[data-feedback-dialog\]'\)/.test(SET)
      && SET.indexOf("querySelector('[data-feedback-dialog]')") < SET.indexOf("if (e.key === 'Escape')"),
    "Settings' document key handler returns early while [data-feedback-dialog] is open — Esc closes ONLY the dialog, and Settings' Tab trap does not fight the dialog's");
}

{
  const fbRules = (CSS.match(/^\.fb-[a-z-]+[^{]*\{[^}]*\}/gm) || [])
    .filter(r => !/^\.fb-(overlay|card)/.test(r) || true);
  assert('bh.s12.css-fb-rules-exist-tokens-only',
    fbRules.length >= 4 && fbRules.every(r => !/#[0-9a-fA-F]{3,8}\b/.test(r))
      && /\.settings-feedback button/.test(CSS),
    `${fbRules.length} .fb-* rules in styles.css, zero hex literals; the About entry restyled as .settings-feedback button`);

  const n = (CSS.match(/#[0-9a-fA-F]{3,8}\b/g) || []).length;
  assert('bh.s13.styles-css-hex-count-still-within-r11-ceiling', n <= 144,
    `count=${n} (raw sheet, ceiling 144 — this round adds zero hex)`);
}

/* ---------------------------------------------------------------------------
   ROUND BI, ITEM 3 — "Send feedback" in the ? help sheet, DIRECTLY under
   "Take a tour": a second action in the same block, opening the SAME
   FeedbackDialog from app state (so the sheet and Settings → About feed one
   dialog), with the popover closed first so focus lands in the dialog.
   --------------------------------------------------------------------------- */
if (APP) {
  const tourIdx = APP.indexOf('className="help-tour-btn"');
  const tourStart = tourIdx < 0 ? -1 : APP.lastIndexOf('<button', tourIdx);
  const tourEnd = tourIdx < 0 ? -1 : APP.indexOf('</button>', tourIdx) + '</button>'.length;
  const fbIdx = APP.indexOf('Send feedback');
  const fbStart = fbIdx < 0 ? -1 : APP.lastIndexOf('<button', fbIdx);
  const fbEnd = fbIdx < 0 ? -1 : APP.indexOf('</button>', fbIdx) + '</button>'.length;
  const between = tourEnd > 0 && fbStart > tourEnd ? APP.slice(tourEnd, fbStart) : null;
  const fbBlock = fbStart >= 0 && fbEnd > fbStart ? APP.slice(fbStart, fbEnd) : '';

  /* (a) ORDER, not presence: the feedback action is the element DIRECTLY after
     the tour button — no `help-group` divider, no other tag between them. The
     only thing allowed in between is whitespace and the braces of a blanked
     JSX comment (`{/* … *\/}` — the comment body is already stripped, the two
     braces are what a comment leaves behind). */
  const betweenBare = between === null ? null : between.replace(/[{}]/g, '').trim();
  assert('bh.s23.help-feedback-is-the-second-action-directly-after-the-tour',
    betweenBare === '' && /help-tour-btn/.test(fbBlock)
      && /Send feedback/.test(fbBlock) && /Take a tour/.test(APP.slice(tourStart, tourEnd)),
    between === null
      ? 'the help sheet has no "Send feedback" button after "Take a tour"'
      : `nothing but whitespace between the tour button and the feedback button (${JSON.stringify(betweenBare)}); the feedback action reuses .help-tour-btn so the two read as one block`);

  /* (b) the handler closes the popover FIRST (so focus lands in the dialog,
     exactly like the tour button) and THEN opens the app-level dialog.
     ROUND BN-3 PHASE B — the button's onClick is now the `onSendFeedback`
     prop; the handler body lives in App.tsx's binding, which the union read
     above still sees. Same assertion, new anchor. */
  const handler = (APP.match(/onSendFeedback=\{\(\) => \{[\s\S]*?\}\}/) || [])[0]
    || (fbBlock.match(/onClick=\{([\s\S]*?)\}\s*>/g) || [])[0] || fbBlock;
  assert('bh.s24.help-feedback-handler-closes-help-then-opens-the-dialog',
    /setHelp\(false\)/.test(handler)
      && /setFeedbackOpen\(true\)/.test(handler)
      && handler.indexOf('setHelp(false)') < handler.indexOf('setFeedbackOpen(true)'),
    `handler: ${handler.replace(/\s+/g, ' ').slice(0, 200)}`);

  /* ONE dialog, TWO openers: the component mounts at app level only (Settings
     hands its About entry to `onOpenFeedback`), so there is a single instance,
     a single open-state, and one focus-restore target per opener. */
  const dialogMounts = (APP.match(/<FeedbackDialog/g) || []).length;
  const settingsMounts = (SET.match(/<FeedbackDialog/g) || []).length;
  assert('bh.s25.one-app-level-dialog-fed-by-both-openers',
    dialogMounts === 1 && settingsMounts === 0
      && /onOpenFeedback/.test(SET)
      /* BN-3 PHASE B: both halves moved with the mount into ModalMounts
         (in the union above) — the conditional AND the focus-return prop. */
      && /feedbackOpen\s*&&|feedbackOpen\s*\?/.test(APP)
      && (/returnFocusTo=\{feedbackReturn\}/.test(APP) || /returnFocusTo=\{p\.feedbackReturn\}/.test(APP)),
    `App mounts <FeedbackDialog> ${dialogMounts}x, Settings ${settingsMounts}x; the About entry reaches it through onOpenFeedback, and the dialog returns focus to whichever opener set feedbackReturn`);

  /* (c) token-only styling: the action block reuses .help-tour-btn's rules and
     this round adds no colour literal anywhere near them. */
  const tourRules = (CSS.match(/\.help-tour-btn[^{]*\{[^}]*\}/g) || []);
  const hexAll = (CSS.match(/#[0-9a-fA-F]{3,8}\b/g) || []).length;
  assert('bh.s26.help-action-block-keeps-token-only-styling',
    tourRules.length >= 1 && tourRules.every(r => !/#[0-9a-fA-F]{3,8}\b/.test(r))
      && /--(elevated|border-strong|fg|acc|fs-md)/.test(tourRules.join(' '))
      && hexAll <= 144,
    `${tourRules.length} .help-tour-btn rule(s), zero hex literals, spacing from the rule's own margin-bottom (no new class, no new colour); sheet total ${hexAll} (ceiling 144)`);
}

/* ===========================================================================
   UNIT — the URL builder EXECUTED (esbuild, package-r-roadmap's technique)
   =========================================================================== */
console.log('\n' + '='.repeat(78));
console.log('UNIT — buildFeedbackIssueUrl executed via esbuild');
console.log('='.repeat(78));

let M = null;
try {
  const outDir = mkdtempSync(join(tmpdir(), 'ds-bh-feedback-'));
  const ESBUILD = join(ROOT, 'node_modules/.bin/esbuild');
  let built = null;
  if (existsSync(ESBUILD)) {
    for (const [fmt, ext] of [['esm', '.mjs'], ['cjs', '.cjs']]) {
      const out = join(outDir, `feedback${ext}`);
      try {
        execFileSync(ESBUILD, [resolve(ROOT, 'src/feedbackIssueUrl.ts'), '--bundle', `--format=${fmt}`, `--outfile=${out}`], {stdio: 'pipe'});
        built = out; break;
      } catch { /* try the next format */ }
    }
  }
  if (built) M = await import(pathToFileURL(built).href);
  rmSync(outDir, {recursive: true, force: true});
} catch { M = null; }

if (!M) {
  assert('bh.u1.builder-module-bundles-and-executes', false,
    'src/feedbackIssueUrl.ts could not be bundled and executed (missing on the pre-change commit, or does not compile)');
} else {
  assert('bh.u1.builder-module-bundles-and-executes',
    typeof M.buildFeedbackIssueUrl === 'function' && typeof M.FEEDBACK_ISSUES_URL === 'string',
    'exports buildFeedbackIssueUrl + FEEDBACK_ISSUES_URL');

  /* One place to run the FULL URL contract — reused verbatim by the live pass
     against the URL the real dialog produced. */
  const checkUrl = (u, kind, title, details, email, tag) => {
    const ok = (id, pass, detail) => assert(id, pass, detail);
    let parsed = null;
    try { parsed = new URL(u); } catch { /* asserted below */ }
    ok(`bh.u2.${tag}.url-shape`,
      !!parsed && parsed.origin + parsed.pathname === `${FEEDBACK_REPO}/issues/new`,
      parsed ? `${parsed.origin}${parsed.pathname}` : `unparseable: ${String(u).slice(0, 80)}`);
    if (!parsed) return;
    const q = parsed.searchParams;
    ok(`bh.u3.${tag}.template-selects-the-right-form`,
      q.get('template') === (kind === 'bug' ? 'bug_report.md' : 'feature_request.md'),
      `template=${q.get('template')}`);
    ok(`bh.u4.${tag}.title-round-trips-byte-exact`,
      q.get('title') === title.trim(),
      `decoded title === trimmed input (${JSON.stringify(q.get('title'))})`);
    const body = q.get('body') || '';
    ok(`bh.u5.${tag}.body-carries-type-details-email`,
      body.includes(kind === 'bug' ? 'Bug report' : 'Feature request')
        && body.includes(details) && body.includes(email),
      `body contains the type word, the details verbatim, and the email`);
    ok(`bh.u6.${tag}.no-labels-param-exact-param-set`,
      !q.has('labels') && [...q.keys()].sort().join(',') === 'body,template,title',
      `params exactly {body, template, title} — an anonymous client cannot set labels, so none is pretended`);
  };

  const T1 = '  Érase [bug] & "things" — 100% ünïcode  ';
  checkUrl(M.buildFeedbackIssueUrl('bug', T1, 'Steps:\n1. open\n2. it broke', 'goblin@example.com'), 'bug',
    T1, 'Steps:\n1. open\n2. it broke', 'goblin@example.com', 'bug');

  checkUrl(M.buildFeedbackIssueUrl('feature', 'Napkin-to-diagram button', 'please', ''), 'feature',
    'Napkin-to-diagram button', 'please', '', 'feature');
  assert('bh.u5b.empty-email-is-a-placeholder-not-an-empty-line',
    (() => {
      const u = new URL(M.buildFeedbackIssueUrl('bug', 't', 'd', ''));
      const body = u.searchParams.get('body') || '';
      return body.includes('Contact: —') && !body.includes('\n\n\n');
    })(),
    'an empty email renders a placeholder dash (Contact: —), not a blank line');
}

/* ===========================================================================
   UNIT 2 (ROUND BI) — the clipboard helper EXECUTED (esbuild, same technique):
   the copy path is proved by BEHAVIOUR, not by regex. `ClipboardItem` and
   `navigator.clipboard` are injected, so the module's real logic runs in Node
   with no browser and no permission prompt.
   =========================================================================== */
console.log('\n' + '='.repeat(78));
console.log('UNIT 2 — copyPngToClipboard executed via esbuild (injected clipboard)');
console.log('='.repeat(78));

/* a REAL 3x3 PNG (colour type 2) — the base64 the rasteriser would hand over */
const PNG64 = 'iVBORw0KGgoAAAANSUhEUgAAAAMAAAADCAIAAADZSiLoAAAAEElEQVR4nGP4H6ABQQxYWADNbg0wAv7yggAAAABJRU5ErkJggg==';
const PNG_DATA_URL = `data:image/png;base64,${PNG64}`;
const PNG_BYTES = Buffer.from(PNG64, 'base64');

let CBM = null;
try {
  const outDir = mkdtempSync(join(tmpdir(), 'ds-bi-clip-'));
  const ESBUILD = join(ROOT, 'node_modules/.bin/esbuild');
  let built = null;
  if (existsSync(ESBUILD)) {
    for (const [fmt, ext] of [['esm', '.mjs'], ['cjs', '.cjs']]) {
      const out = join(outDir, `clip${ext}`);
      try {
        execFileSync(ESBUILD, [resolve(ROOT, 'src/boardClipboard.ts'), '--bundle', `--format=${fmt}`, `--outfile=${out}`], {stdio: 'pipe'});
        built = out; break;
      } catch { /* try the next format */ }
    }
  }
  if (built) CBM = await import(pathToFileURL(built).href);
  rmSync(outDir, {recursive: true, force: true});
} catch { CBM = null; }

if (!CBM) {
  assert('bh.u7.clipboard-module-bundles-and-executes', false,
    'src/boardClipboard.ts could not be bundled and executed (RED on the pre-change commit: the file does not exist)');
} else {
  assert('bh.u7.clipboard-module-bundles-and-executes',
    typeof CBM.copyPngToClipboard === 'function' && typeof CBM.pngBlobFromDataUrl === 'function'
      && typeof CBM.clipboardUsable === 'function',
    'exports copyPngToClipboard + pngBlobFromDataUrl + clipboardUsable');

  /* --- feature detection: BOTH halves are required, and a missing half is a
     silent false (the caller then renders no button at all). --- */
  const withClipboard = {clipboard: {write: async () => {}}};
  assert('bh.u8.feature-detection-needs-both-halves',
    CBM.clipboardUsable(withClipboard, function FakeCI() {}) === true
      && CBM.clipboardUsable(withClipboard, undefined) === false
      && CBM.clipboardUsable({}, function FakeCI() {}) === false
      && CBM.clipboardUsable(null, function FakeCI() {}) === false,
    'true only when navigator.clipboard.write AND window.ClipboardItem both exist; every half-missing case is a plain false');

  /* --- the data URL → Blob conversion is byte-exact and typed image/png --- */
  let blobOk = false, blobBytes = 0, blobType = '';
  try {
    const b = CBM.pngBlobFromDataUrl(PNG_DATA_URL);
    blobType = b.type;
    const u8 = new Uint8Array(await b.arrayBuffer());
    blobBytes = u8.length;
    blobOk = Buffer.from(u8).equals(PNG_BYTES)
      /* PNG signature — the bytes really are a PNG, not the string re-wrapped */
      && u8[0] === 0x89 && u8[1] === 0x50 && u8[2] === 0x4e && u8[3] === 0x47;
  } catch { blobOk = false; }
  assert('bh.u9.data-url-becomes-a-real-png-blob',
    blobOk && blobType === 'image/png' && blobBytes === PNG_BYTES.length,
    `${blobBytes} bytes, type=${blobType}, PNG signature intact — byte-exact against the base64 source`);
  let rejectedNonPng = false;
  try { CBM.pngBlobFromDataUrl('data:image/jpeg;base64,AAAA'); } catch { rejectedNonPng = true; }
  assert('bh.u9b.non-png-data-url-is-rejected', rejectedNonPng,
    'a non-PNG data URL throws instead of silently uploading the wrong format');

  /* --- THE SAFARI CONTRACT: the ClipboardItem is constructed SYNCHRONOUSLY,
     during the gesture, holding a PROMISE value (never an awaited Blob). --- */
  const ctorCalls = [];
  class SpyItem {
    constructor(data) { ctorCalls.push(data); this._d = data; this.types = Object.keys(data); }
    getType(t) { return Promise.resolve(this._d[t]); }
  }
  const written = [];
  const okNav = {clipboard: {write: async (items) => {
    const b = await items[0].getType('image/png');
    written.push({size: b.size, type: b.type});
  }}};
  const pending = CBM.copyPngToClipboard({
    buildDataUrl: async () => PNG_DATA_URL, nav: okNav, ClipboardItemCtor: SpyItem,
  });
  /* BEFORE any await: the item exists, was built synchronously, and its value
     is a PROMISE — that is what Safari's gesture check accepts. */
  const syncOk = ctorCalls.length === 1
    && Object.keys(ctorCalls[0])[0] === 'image/png'
    && typeof ctorCalls[0]['image/png'].then === 'function';
  const outcome = await pending;
  assert('bh.u10.clipboard-item-built-synchronously-with-a-promise-value',
    syncOk && outcome.ok === true && written.length === 1
      && written[0].size === PNG_BYTES.length && written[0].type === 'image/png',
    `item constructed synchronously inside the call (types=[image/png], value is a Promise), write() then received a real ${written[0]?.size ?? '?'}-byte image/png — the Safari gesture contract`);

  /* --- the build failing must be an OUTCOME, never a thrown error --- */
  let threw = false, buildOutcome = null;
  try {
    buildOutcome = await CBM.copyPngToClipboard({
      buildDataUrl: async () => '', nav: okNav, ClipboardItemCtor: SpyItem,
    });
  } catch { threw = true; }
  assert('bh.u11.rasterise-failure-is-an-outcome-not-a-throw',
    !threw && buildOutcome && buildOutcome.ok === false && buildOutcome.reason === 'build',
    `an empty/broken PNG build resolves {ok:false, reason:'build'} — the caller shows the manual-screenshot line and keeps Send working`);

  /* --- a refused clipboard (permission denied) is also an outcome --- */
  const denyNav = {clipboard: {write: async () => { throw new DOMException('denied', 'NotAllowedError'); }}};
  let denied = null, deniedThrew = false;
  try {
    denied = await CBM.copyPngToClipboard({
      buildDataUrl: async () => PNG_DATA_URL, nav: denyNav, ClipboardItemCtor: SpyItem,
    });
  } catch { deniedThrew = true; }
  assert('bh.u12.denied-clipboard-is-an-outcome-not-a-throw',
    !deniedThrew && denied && denied.ok === false && denied.reason === 'denied',
    `a refused clipboard resolves {ok:false, reason:'denied'} — nothing propagates into the Send handler`);

  /* --- unsupported (the static-host reality: plain-http LAN origins expose
     neither API) short-circuits BEFORE any rasterise work is done --- */
  let builtWhenUnsupported = false;
  const unsupportedOutcome = await CBM.copyPngToClipboard({
    buildDataUrl: async () => { builtWhenUnsupported = true; return PNG_DATA_URL; },
    nav: {}, ClipboardItemCtor: undefined,
  });
  assert('bh.u13.unsupported-short-circuits-without-rasterising',
    unsupportedOutcome && unsupportedOutcome.ok === false && unsupportedOutcome.reason === 'unsupported'
      && !builtWhenUnsupported,
    'no clipboard support ⇒ {ok:false, reason:"unsupported"} and the export pipeline is never run');
}

/* ===========================================================================
   LIVE — the real dialog on the dev server (playwright-core, round-bf pattern)
   =========================================================================== */
console.log('\n' + '='.repeat(78));
console.log(`LIVE — the dialog on ${APP_URL}`);
console.log('='.repeat(78));

try {
  const require_ = createRequire(join('/home/harvey/projects/tech-goblin/package.json', 'noop.js'));
  const {chromium} = require_('playwright-core');
  const browser = await chromium.launch();
  const page = await browser.newPage({viewport: {width: 1500, height: 900}});
  try {
    await page.addInitScript(() => {
      localStorage.setItem('diagram-studio:tour-seen', '1');
      /* stub the ONLY network act so the probe never navigates away */
      window.open = (u) => { (window.__fbUrls ||= []).push(String(u)); return null; };
    });
    await page.goto(APP_URL, {waitUntil: 'networkidle'});

    /* open Settings → About */
    await page.click('[data-settings-btn]');
    await page.waitForSelector('[data-settings-overlay]', {timeout: 10000});
    await page.click('[data-settings-cat="about"]');
    await page.waitForSelector('[data-settings-pane="about"]', {timeout: 10000});

    /* the entry opens the dialog; initial focus lands in the title field */
    await page.click('.settings-feedback button');
    await page.waitForSelector('[data-feedback-dialog]', {timeout: 5000});
    await page.waitForTimeout(150);
    const focusIn = await page.evaluate(() => document.activeElement && document.activeElement.closest('[data-feedback-dialog]')
      ? document.activeElement.id || document.activeElement.tagName : null);
    assert('bh.l1.dialog-opens-and-autofocuses-title', focusIn === 'fb-title',
      `entry click mounts [data-feedback-dialog]; initial focus = ${focusIn} (expected fb-title)`);

    /* the trap: 24 Tabs (mixed with Shift) never leave the card */
    const escapes = await page.evaluate(async () => {
      const out = [];
      const card = document.querySelector('[data-feedback-dialog]');
      for (let i = 0; i < 24; i++) {
        document.dispatchEvent(new KeyboardEvent('keydown', {
          key: 'Tab', shiftKey: i % 3 === 0, bubbles: true, cancelable: true,
        }));
        await new Promise(r => setTimeout(r, 5));
        const a = document.activeElement;
        out.push(a && card.contains(a));
      }
      return out;
    });
    assert('bh.l2.tab-trapped-inside-the-card', escapes.length === 24 && escapes.every(Boolean),
      `24 synthetic Tabs (8 of them Shift+Tab) — focus inside the card every time (${escapes.filter(Boolean).length}/24)`);

    /* Escape closes ONLY the dialog; Settings stays open; focus returns */
    await page.keyboard.press('Escape');
    await page.waitForTimeout(150);
    const afterEsc = await page.evaluate(() => ({
      dialog: !!document.querySelector('[data-feedback-dialog]'),
      settings: !!document.querySelector('[data-settings-overlay]'),
      pane: document.querySelector('[data-settings-pane]')?.getAttribute('data-settings-pane'),
      focus: document.activeElement && (document.activeElement.className || document.activeElement.tagName),
    }));
    assert('bh.l3.esc-closes-only-the-dialog-and-restores-focus',
      !afterEsc.dialog && afterEsc.settings && afterEsc.pane === 'about'
        && /settings-feedback/.test(String(afterEsc.focus)),
      `dialog gone=${!afterEsc.dialog}, Settings still on about=${afterEsc.pane === 'about'}, focus back on ${afterEsc.focus}`);

    /* a real fill + submit for BOTH kinds; the captured URL re-runs the unit
       contract against what the live dialog actually produced. The dialog
       STAYS OPEN after submit (the typed text is never lost), so Esc closes
       it before the second pass. */
    await page.click('.settings-feedback button');
    await page.waitForSelector('[data-feedback-dialog]', {timeout: 5000});
    await page.fill('#fb-title', 'Live probe: shapes vanish & émogrify');
    await page.fill('#fb-details', 'Pressed P, picked a hexagon, it turned into a turnip.');
    await page.fill('#fb-email', 'probe@goblin.dev');
    await page.click('[data-fb-submit]');
    await page.waitForTimeout(120);
    await page.keyboard.press('Escape');
    await page.waitForTimeout(120);

    await page.click('.settings-feedback button');
    await page.waitForSelector('[data-feedback-dialog]', {timeout: 5000});
    const featureChecked = await page.evaluate(() => {
      const radios = [...document.querySelectorAll('[data-feedback-dialog] input[name="fb-kind"]')];
      if (radios[1]) { radios[1].click(); return true; }
      return false;
    });
    await page.fill('#fb-title', 'Live probe: napkin import');
    await page.fill('#fb-details', 'Import a napkin photo as nodes.');
    await page.click('[data-fb-submit]');
    await page.waitForTimeout(120);

    const urls = await page.evaluate(() => window.__fbUrls || []);
    assert('bh.l4.submit-captured-two-window-open-urls',
      urls.length === 2 && featureChecked,
      `window.open stub captured ${urls.length} URL(s); the feature radio was switched`);
    if (urls.length >= 1) {
      checkLive(urls[0], 'bug', 'Live probe: shapes vanish & émogrify',
        'Pressed P, picked a hexagon, it turned into a turnip.', 'probe@goblin.dev', 'live-bug');
    }
    if (urls.length >= 2) {
      checkLive(urls[1], 'feature', 'Live probe: napkin import',
        'Import a napkin photo as nodes.', '', 'live-feature');
    }
  } finally {
    await browser.close();
  }
} catch (e) {
  assert('bh.live-pass-ran', false, `the live pass could not run: ${String(e).slice(0, 300)}`);
}

/* ===========================================================================
   LIVE 2 (ROUND BI) — the screenshot helper on the real dev server.
   Two probe boards (empty / one node), the REAL export pipeline rasterising to
   a REAL PNG, an injected clipboard so the bytes can be inspected without a
   permission prompt, and a DENYING clipboard to prove Send still opens GitHub.
   =========================================================================== */
console.log('\n' + '='.repeat(78));
console.log(`LIVE 2 — screenshot helper: ${APP_URL}`);
console.log('='.repeat(78));

const probeBoardIds = [];
try {
  const require_ = createRequire(join('/home/harvey/projects/tech-goblin/package.json', 'noop.js'));
  const {chromium} = require_('playwright-core');
  const browser = await chromium.launch();
  const page = await browser.newPage({viewport: {width: 1500, height: 900}});
  try {
    await page.addInitScript(() => {
      localStorage.setItem('diagram-studio:tour-seen', '1');
      localStorage.removeItem('diagram-studio:last-board');
      window.open = (u) => { (window.__fbUrls ||= []).push(String(u)); return null; };
      /* THE INJECTION: the dev server is a plain-http LAN origin, which is NOT
         a secure context — the browser exposes neither navigator.clipboard nor
         ClipboardItem there, so the helper correctly renders nothing. To prove
         the COPY path itself we supply the two globals (a spy that records the
         real rasterised bytes instead of touching the OS clipboard) and one
         switch (`__clipMode`) that makes write() refuse like a denied
         permission. */
      window.__clipMode = 'ok';
      window.__copied = null;
      window.ClipboardItem = class {
        constructor(data) { this._d = data; this.types = Object.keys(data); }
        getType(t) { return Promise.resolve(this._d[t]); }
      };
      Object.defineProperty(navigator, 'clipboard', {
        configurable: true,
        value: {
          write: async (items) => {
            if (window.__clipMode === 'deny') throw new DOMException('denied', 'NotAllowedError');
            const b = await items[0].getType('image/png');
            const u8 = new Uint8Array(await b.arrayBuffer());
            window.__copied = {size: b.size, type: b.type, head: [...u8.slice(0, 4)]};
          },
        },
      });
    });

    const mkBoard = async (name, nodes) => {
      const r = await page.request.post(`${APP_URL}api/boards`, {data: {name}});
      const id = (await r.json()).id;
      probeBoardIds.push(id);
      const put = await page.request.put(`${APP_URL}api/boards/${id}`, {data: {id, name, nodes, edges: []}});
      if (put.status() !== 200) throw new Error(`probe board PUT ${put.status()}`);
      return id;
    };
    const openFeedback = async () => {
      await page.goto(APP_URL, {waitUntil: 'networkidle'});
      await page.click('[data-settings-btn]');
      await page.waitForSelector('[data-settings-overlay]', {timeout: 10000});
      await page.click('[data-settings-cat="about"]');
      await page.waitForSelector('[data-settings-pane="about"]', {timeout: 10000});
      await page.click('.settings-feedback button');
      await page.waitForSelector('[data-feedback-dialog]', {timeout: 5000});
      await page.waitForTimeout(120);
    };

    /* (1) EMPTY board → no helper row, no dead button */
    await mkBoard(`BI-PROBE-EMPTY-${Date.now()}`, []);
    await openFeedback();
    const emptyState = await page.evaluate(() => ({
      dialog: !!document.querySelector('[data-feedback-dialog]'),
      btn: !!document.querySelector('[data-fb-copy]'),
      boardEmpty: !!document.querySelector('.canvas-empty'),
    }));
    assert('bh.l7.empty-board-renders-no-helper-row',
      emptyState.dialog && emptyState.boardEmpty && !emptyState.btn,
      `dialog open=${emptyState.dialog}, empty-canvas panel=${emptyState.boardEmpty}, [data-fb-copy] present=${emptyState.btn} — an empty board offers no copy button at all`);

    /* (2) ONE-NODE board → the row appears, labelled as specified */
    await mkBoard(`BI-PROBE-NODE-${Date.now()}`, [{
      id: 'n1', type: 'goblin', position: {x: 0, y: 0},
      data: {shape: 'terminator', kicker: '', title: 'Copy me', sub: '', metric: '', metricUnit: '', icon: '', colorKey: 'green', body: 'label-only', handles: 'tb'},
      style: {width: 260, height: 140}, measured: {width: 260, height: 140}, selected: false,
    }]);
    await openFeedback();
    const rowInfo = await page.evaluate(() => {
      const b = document.querySelector('[data-fb-copy]');
      if (!b) return null;
      return {
        label: b.textContent.trim(),
        aboveActions: !!(b.compareDocumentPosition(document.querySelector('.fb-actions')) & Node.DOCUMENT_POSITION_FOLLOWING),
        nodeCount: document.querySelectorAll('.react-flow__node').length,
      };
    });
    assert('bh.l8.non-empty-board-renders-the-helper-row-above-the-actions',
      !!rowInfo && rowInfo.label === 'Copy board as PNG' && rowInfo.aboveActions,
      rowInfo ? `label="${rowInfo.label}", ${rowInfo.nodeCount} node(s) on canvas, row sits ABOVE .fb-actions` : 'no [data-fb-copy] on a board that HAS nodes');

    /* ITEM 2, measured: the placeholder must FIT the field at desktop width.
       The canvas measures the string in the input's own computed font; the
       budget is the content box. The OLD sentence is measured alongside, as the
       evidence for why it was cut mid-sentence. */
    const phFit = await page.evaluate(() => {
      const el = document.querySelector('#fb-title');
      if (!el) return null;
      const cs = getComputedStyle(el);
      const ctx = document.createElement('canvas').getContext('2d');
      if (!ctx) return null;
      ctx.font = `${cs.fontStyle} ${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
      const avail = el.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
      return {
        now: el.placeholder,
        nowW: Math.round(ctx.measureText(el.placeholder).width),
        oldW: Math.round(ctx.measureText('A short sentence: what happened, or what you want').width),
        avail: Math.round(avail),
      };
    });
    assert('bh.l11.title-placeholder-fits-the-rendered-field',
      !!phFit && phFit.nowW <= phFit.avail,
      phFit
        ? `${JSON.stringify(phFit.now)} measures ${phFit.nowW}px in the field's font, ${phFit.avail}px available (the old sentence needed ${phFit.oldW}px — clipped mid-sentence)`
        : '#fb-title not measurable');

    /* (3) the copy itself: the REAL buildPng → rasterise → Blob, then the
       success label + the hairline note */
    await page.click('[data-fb-copy]');
    let copied = null;
    try {
      await page.waitForFunction(() => window.__copied !== null || document.querySelector('[data-fb-shot="failed"]'), {timeout: 40000});
      copied = await page.evaluate(() => window.__copied);
    } catch { /* asserted below */ }
    const afterCopy = await page.evaluate(() => ({
      label: document.querySelector('[data-fb-copy]')?.textContent.trim() || '',
      note: document.querySelector('.fb-shot-note')?.textContent.trim() || '',
      failed: !!document.querySelector('[data-fb-shot="failed"]'),
    }));
    assert('bh.l9.copy-produces-a-real-png-and-flips-the-label',
      !!copied && copied.type === 'image/png' && copied.size > 1000
        && copied.head.join(',') === '137,80,78,71'
        && afterCopy.label === 'Copied — paste it in the GitHub body (Ctrl+V / ⌘V)'
        && afterCopy.note === 'GitHub uploads pasted images for you.',
      copied
        ? `the app's own export path produced a ${copied.size}-byte image/png (signature ${copied.head.join(',')}); label="${afterCopy.label}"; note="${afterCopy.note}"`
        : `no PNG reached the clipboard; failed-state=${afterCopy.failed}`);

    /* (4) a DENIED clipboard must not block Send */
    await page.evaluate(() => { window.__clipMode = 'deny'; });
    await page.fill('#fb-title', 'Live probe: denied clipboard');
    await page.click('[data-fb-submit]');
    await page.waitForTimeout(400);
    const afterDeny = await page.evaluate(() => ({
      urls: window.__fbUrls || [],
      failed: !!document.querySelector('[data-fb-shot="failed"]'),
      failedText: document.querySelector('.fb-shot-err')?.textContent.trim() || '',
    }));
    assert('bh.l10.denied-copy-shows-the-manual-line-and-send-still-opens-github',
      afterDeny.urls.length === 1 && /github\.com\/harveynguyen33\/gobigrams\/issues\/new/.test(afterDeny.urls[0])
        && afterDeny.failed
        && afterDeny.failedText === "Couldn't copy — take a screenshot manually and paste it in the GitHub body.",
      `${afterDeny.urls.length} window.open fired despite the refusal; inline line shown="${afterDeny.failedText}"`);
  } finally {
    for (const id of probeBoardIds) {
      rmSync(join(ROOT, 'boards', `${id}.json`), {force: true});
      rmSync(join(ROOT, 'boards', `${id}.json.bak`), {force: true});
    }
    await browser.close();
  }
} catch (e) {
  assert('bh.live2-pass-ran', false, `the screenshot live pass could not run: ${String(e).slice(0, 300)}`);
}

/* ===========================================================================
   LIVE 3 (ROUND BI, ITEM 3) — "Send feedback" inside the ? help sheet.
   =========================================================================== */
console.log('\n' + '='.repeat(78));
console.log(`LIVE 3 — help sheet → feedback: ${APP_URL}`);
console.log('='.repeat(78));

try {
  const require_ = createRequire(join('/home/harvey/projects/tech-goblin/package.json', 'noop.js'));
  const {chromium} = require_('playwright-core');
  const browser = await chromium.launch();
  const page = await browser.newPage({viewport: {width: 1500, height: 900}});
  try {
    await page.addInitScript(() => {
      localStorage.setItem('diagram-studio:tour-seen', '1');
      localStorage.removeItem('diagram-studio:last-board');
    });
    await page.goto(APP_URL, {waitUntil: 'networkidle'});
    await page.click('.help-btn');
    await page.waitForSelector('.help-pop', {timeout: 5000});
    const sheet = await page.evaluate(() => {
      const pop = document.querySelector('.help-pop');
      const btns = [...pop.querySelectorAll('button.help-tour-btn')];
      return {
        n: btns.length,
        labels: btns.map(b => b.textContent.trim()),
        adjacent: btns.length === 2 && btns[1].previousElementSibling === btns[0],
        heights: btns.map(b => Math.round(b.getBoundingClientRect().height)),
        gap: btns.length === 2
          ? Math.round(btns[1].getBoundingClientRect().top - btns[0].getBoundingClientRect().bottom)
          : null,
      };
    });
    assert('bh.l12.help-sheet-lists-the-two-actions-in-order',
      sheet.n === 2 && sheet.labels[0] === 'Take a tour' && sheet.labels[1] === 'Send feedback' && sheet.adjacent,
      `${sheet.n} actions: [${sheet.labels.join(', ')}], adjacent siblings=${sheet.adjacent}, heights ${sheet.heights.join('/')}px, ${sheet.gap}px gap — one block`);

    /* clicking it closes the popover FIRST and opens the dialog focused */
    await page.click('.help-pop button.help-tour-btn:nth-of-type(2)');
    await page.waitForSelector('[data-feedback-dialog]', {timeout: 5000});
    await page.waitForTimeout(150);
    const afterClick = await page.evaluate(() => ({
      pop: !!document.querySelector('.help-pop'),
      dialog: !!document.querySelector('[data-feedback-dialog]'),
      focus: document.activeElement?.id || document.activeElement?.className || '',
    }));
    assert('bh.l13.help-feedback-closes-the-popover-and-opens-the-dialog',
      !afterClick.pop && afterClick.dialog && afterClick.focus === 'fb-title',
      `popover open=${afterClick.pop}, dialog open=${afterClick.dialog}, focus=${afterClick.focus} — the sheet closes first, so the dialog's own autofocus lands`);

    /* Esc returns focus to the ? button (the opener), not the toolbar */
    await page.keyboard.press('Escape');
    await page.waitForTimeout(150);
    const afterEsc = await page.evaluate(() => ({
      dialog: !!document.querySelector('[data-feedback-dialog]'),
      focus: document.activeElement?.className || '',
      pop: !!document.querySelector('.help-pop'),
    }));
    assert('bh.l14.esc-returns-focus-to-the-help-button',
      !afterEsc.dialog && /help-btn/.test(afterEsc.focus) && !afterEsc.pop,
      `dialog gone=${!afterEsc.dialog}, focus=${JSON.stringify(afterEsc.focus)} (the ? button), popover stays closed — the opener is recorded per open`);
  } finally {
    await browser.close();
  }
} catch (e) {
  assert('bh.live3-pass-ran', false, `the help-sheet live pass could not run: ${String(e).slice(0, 300)}`);
}

/** The unit URL contract re-run against a LIVE-captured URL. */
function checkLive(u, kind, title, details, email, tag) {
  let parsed = null;
  try { parsed = new URL(u); } catch { /* below */ }
  assert(`bh.l5.${tag}.url-shape`,
    !!parsed && parsed.origin + parsed.pathname === `${FEEDBACK_REPO}/issues/new`,
    parsed ? `${parsed.origin}${parsed.pathname}` : `unparseable: ${String(u).slice(0, 80)}`);
  if (!parsed) return;
  const q = parsed.searchParams;
  assert(`bh.l6.${tag}.template-and-title-and-body-decode`,
    q.get('template') === (kind === 'bug' ? 'bug_report.md' : 'feature_request.md')
      && q.get('title') === title
      && (q.get('body') || '').includes(details)
      && (email === '' || (q.get('body') || '').includes(email))
      && !q.has('labels'),
    `template=${q.get('template')}, title decodes to the typed string, body carries details${email ? ' + email' : ''}, no labels param`);
}

const fails = results.filter(r => !r.pass);
console.log(`\nround-bh-feedback: ${results.length - fails.length}/${results.length} assertions pass`);
if (fails.length) {
  console.log('FAILED:');
  for (const f of fails) console.log(`  ${f.id} — ${f.detail}`);
}
process.exit(fails.length ? 1 : 0);
