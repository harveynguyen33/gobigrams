#!/usr/bin/env node
/**
 * ROUND BH, ITEM 2 — THE GOBIGRAMS LOGO IN THE APP (public launch, 2026-10-24).
 *
 * The brand assets shipped in ROUND BF's brand commit (public/brand/logo.svg —
 * the final Gobigrams goblin icon). This round places it:
 *   (a) Settings → About — a ~52px <img src="/brand/logo.svg" alt="Gobigrams">
 *       above the wordmark line (the pane's h2 stays the pane's own title);
 *   (b) the empty-canvas panel — a ~40px icon above the "This board is empty"
 *       title (a natural header spot: the panel already leads with a title).
 *
 * WHAT IT CHECKS:
 *   STATIC — the two <img> tags with the exact src/alt, sizes from TOKEN
 *     rules (no inline hex, no new colours), and public/brand/logo.svg exists.
 *   LIVE   — on the dev server: the About pane renders the img at the ruled
 *     size with naturalWidth > 0 (the asset really loads), and a probe board
 *     with ZERO nodes shows the canvas-empty panel with its icon at ~40px,
 *     also loaded.
 *
 * REPLAY: RED on the pinned pre-change commit — neither img exists.
 */
import {readFileSync, existsSync, rmSync, mkdtempSync} from 'node:fs';
import {join, dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
import {execFileSync} from 'node:child_process';
import {tmpdir} from 'node:os';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');
const APP_URL = process.env.BH_APP_URL || process.env.AY_APP_URL || 'http://192.168.33.200:5200/';

const read = (p) => readFileSync(join(ROOT, p), 'utf8');
const blank = (src) => src
  .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))
  .replace(/(^|[^:])\/\/[^\n]*/g, (m, p1) => p1 + ' '.repeat(m.length - p1.length));

const results = [];
const assert = (id, pass, detail = '') => {
  results.push({id, pass: !!pass, detail});
  console.log(`  ${pass ? 'PASS' : 'FAIL'}  ${id}  —  ${detail}`);
};

console.log(`round-bh-logo — ROOT=${ROOT}  APP_URL=${APP_URL}`);

/* ===========================================================================
   STATIC
   =========================================================================== */
console.log('='.repeat(78));
console.log('STATIC — Settings About + canvas-empty <img>, tokens-only sizing');
console.log('='.repeat(78));

assert('bh.g1.brand-asset-exists',
  existsSync(join(ROOT, 'public/brand/logo.svg'))
    && read('public/brand/logo.svg').includes('<svg'),
  'public/brand/logo.svg exists (the ROUND BF brand asset)');

const SET = blank(read('src/Settings.tsx'));
const APP = blank(read('src/App.tsx'));
const CSS = read('src/styles.css');

{
  /* ROUND BI re-anchor: AboutPane takes a props object now ({onOpenFeedback}),
     so the literal 'function AboutPane()' is gone — the slice anchor drops its
     `()` and reads the same pane body. */
  const about = SET.slice(SET.indexOf('function AboutPane('), SET.indexOf('the shell'));
  /* ROUND BH re-anchor (c8cbe0b): the About icon became the FULL LOCKUP
     (public/brand/lockup.svg, 280px) — the late brand decision superseded the
     round's first 52px icon placement. Same contract, new asset. */
  const img = about.match(/<img\s[^>]*src="\/brand\/lockup\.svg"[^>]*>/);
  assert('bh.g2.about-img-with-src-and-alt',
    !!img && /alt="Gobigrams"/.test(img[0]),
    img ? img[0].replace(/\s+/g, ' ') : 'no /brand/lockup.svg <img> in the About pane');

  assert('bh.g3.about-img-above-the-wordmark-line',
    !!img && about.indexOf('<img') < about.indexOf('settings-sub'),
    'the icon sits above the wordmark line (the pane content starts with it)');
}

{
  const ce = APP.slice(APP.indexOf('className="canvas-empty"'), APP.indexOf('className="canvas-empty"') + 1400);
  const img = ce.match(/<img\s[^>]*src="\/brand\/logo-mark\.svg"[^>]*>/);
  assert('bh.g4.canvas-empty-img-above-the-title',
    !!img && /alt="Gobigrams"/.test(img[0])
      && ce.indexOf('<img') < ce.indexOf('This board is empty')
      && ce.indexOf('ce-title') < ce.indexOf('<img'),
    img ? 'icon inside .ce-title, above the title text: ' + img[0].replace(/\s+/g, ' ').slice(0, 90)
        : 'no /brand/logo-mark.svg <img> in the canvas-empty panel');
}

{
  const rule = (sel) => (CSS.match(new RegExp(`\\.?${sel.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\$&')}\\s*\\{[^}]*\\}`)) || [''])[0];
  const aboutRule = rule('about-logo');
  assert('bh.g5.about-logo-rule-280px-tokens-only',
  /width:\s*280px/.test(aboutRule) && !/#[0-9a-fA-F]{3,8}\b/.test(aboutRule),
  aboutRule ? aboutRule.replace(/\s+/g, ' ').trim() : '.about-logo rule not found');

  const ceRule = rule('ce-logo');
  /* Re-anchored (Harvey, 2026-10-24): the empty-board mark is a 240px hero with
     aspect preserved (height:auto over the 800x440 logo-mark.svg) — the old
     72x72 square squashed the 920x560 artwork. The guarantee kept here is
     "display sizing only, tokens only, no inline hex". */
  assert('bh.g6.ce-logo-rule-hero-tokens-only',
  /width:\s*240px/.test(ceRule) && /height:\s*auto/.test(ceRule)
    && !/#[0-9a-fA-F]{3,8}\b/.test(ceRule),
  ceRule ? ceRule.replace(/\s+/g, ' ').trim() : '.ce-logo rule not found');

  const n = (CSS.match(/#[0-9a-fA-F]{3,8}\b/g) || []).length;
  assert('bh.g7.hex-ceiling-untouched', n <= 144, `count=${n} (ceiling 144)`);
}

/* ===========================================================================
   LIVE
   =========================================================================== */
console.log('\n' + '='.repeat(78));
console.log(`LIVE — About pane + empty board (${APP_URL})`);
console.log('='.repeat(78));

let boardId = '';
try {
  const require_ = createRequire(join('/home/harvey/projects/tech-goblin/package.json', 'noop.js'));
  const {chromium} = require_('playwright-core');
  const browser = await chromium.launch();
  const page = await browser.newPage({viewport: {width: 1500, height: 900}});
  try {
    await page.addInitScript(() => {
      localStorage.setItem('diagram-studio:tour-seen', '1');
      /* the app boots into the LAST-OPEN board (or the newest) and IGNORES
         ?board= — so each navigation must fall back to "newest", which after
         the PUT below is always this harness's empty probe board. */
      localStorage.removeItem('diagram-studio:last-board');
    });

    /* the About pane's icon */
    await page.goto(APP_URL, {waitUntil: 'networkidle'});
    await page.click('[data-settings-btn]');
    await page.waitForSelector('[data-settings-overlay]', {timeout: 10000});
    await page.click('[data-settings-cat="about"]');
    await page.waitForSelector('[data-settings-pane="about"]', {timeout: 10000});
    await page.waitForSelector('[data-settings-pane="about"] img[src="/brand/lockup.svg"]', {timeout: 5000});
    const aboutImg = await page.evaluate(() => {
      const img = document.querySelector('[data-settings-pane="about"] img[src="/brand/lockup.svg"]');
      if (!img) return null;
      const r = img.getBoundingClientRect();
      return {w: r.width, h: r.height, natural: img.naturalWidth, alt: img.alt};
    });
    assert('bh.g8.about-icon-renders-and-loads',
      !!aboutImg && Math.round(aboutImg.w) === 280 && aboutImg.natural > 0 && aboutImg.alt === 'Gobigrams',
      aboutImg ? `rendered ${Math.round(aboutImg.w)}x${Math.round(aboutImg.h)}px, naturalWidth ${aboutImg.natural}, alt "${aboutImg.alt}"` : 'img not found in the live About pane');

    /* the empty board's icon — probe board with zero nodes, BF's machinery */
    const r0 = await page.request.post(`${APP_URL}api/boards`, {data: {name: `BH-PROBE-LOGO-${Date.now()}`}});
    boardId = (await r0.json()).id;
    await page.request.put(`${APP_URL}api/boards/${boardId}`, {data: {id: boardId, name: `BH-PROBE-LOGO-${Date.now()}`, nodes: [], edges: []}});
    await page.goto(`${APP_URL}?board=${boardId}`, {waitUntil: 'networkidle'});
    await page.waitForSelector('.canvas-empty img[src="/brand/logo-mark.svg"]', {timeout: 15000});
    const ceImg = await page.evaluate(() => {
      const img = document.querySelector('.canvas-empty img[src="/brand/logo-mark.svg"]');
      if (!img) return null;
      const r = img.getBoundingClientRect();
      return {w: r.width, h: r.height, natural: img.naturalWidth, alt: img.alt};
    });
    assert('bh.g9.empty-board-icon-renders-and-loads',
      !!ceImg && Math.round(ceImg.w) === 240 && Math.abs(ceImg.w / ceImg.h - 1.82) < 0.05 && ceImg.natural > 0,
      ceImg ? `rendered ${Math.round(ceImg.w)}x${Math.round(ceImg.h)}px, naturalWidth ${ceImg.natural}, on the empty panel` : 'img not found on the empty panel');
  } finally {
    if (boardId) {
      rmSync(join(ROOT, 'boards', `${boardId}.json`), {force: true});
      rmSync(join(ROOT, 'boards', `${boardId}.json.bak`), {force: true});
    }
    await browser.close();
  }
} catch (e) {
  assert('bh.live-pass-ran', false, `the live pass could not run: ${String(e).slice(0, 300)}`);
}

const fails = results.filter(r => !r.pass);
console.log(`\nround-bh-logo: ${results.length - fails.length}/${results.length} assertions pass`);
if (fails.length) {
  console.log('FAILED:');
  for (const f of fails) console.log(`  ${f.id} — ${f.detail}`);
}
process.exit(fails.length ? 1 : 0);
