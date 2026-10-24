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

const FEEDBACK_REPO = 'https://github.com/harveynguyen33/goblin-diagrams';
const FEEDBACK_LABEL = 'Feedback — report a bug or request a shape';

console.log(`round-bh-feedback — ROOT=${ROOT}  APP_URL=${APP_URL}`);

/* ===========================================================================
   STATIC — the dialog component + the Settings wiring + the CSS
   =========================================================================== */
console.log('='.repeat(78));
console.log('STATIC — src/FeedbackDialog.tsx, src/feedbackIssueUrl.ts, Settings wiring, CSS');
console.log('='.repeat(78));

let DLG = '', SET = '', CSS = '';
try {
  DLG = blank(read('src/FeedbackDialog.tsx'));
  assert('bh.s1.dialog-file-exists', true, 'src/FeedbackDialog.tsx reads and comment-blanks cleanly');
} catch {
  assert('bh.s1.dialog-file-exists', false, 'src/FeedbackDialog.tsx not found (RED on the pre-change commit)');
}
try { SET = blank(read('src/Settings.tsx')); } catch { /* probed below */ }
try { CSS = read('src/styles.css'); } catch { /* probed below */ }

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
}

if (SET) {
  /* the label sits in a button whose onClick arrow (`=>`) breaks a [^>]* tag
     regex, so the tag block is SLICED between the literal delimiters instead */
  const about = SET.slice(SET.indexOf('function AboutPane()'), SET.indexOf('the shell'));
  const fbBtn = about.slice(about.indexOf('<button'), about.indexOf('</button>'));
  assert('bh.s10.about-entry-is-the-dialog-opener',
    fbBtn.includes(FEEDBACK_LABEL) && fbBtn.includes('setFbOpen(true)')
      && about.includes('className="settings-feedback"') && /<FeedbackDialog/.test(SET),
    'the About pane entry is a BUTTON with the exact round-BG label that mounts <FeedbackDialog>');

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
