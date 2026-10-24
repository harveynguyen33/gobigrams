#!/usr/bin/env node
/**
 * ROUND BH, ITEM 3 — USER-VISIBLE 'Diagram Studio' → 'Gobigrams'
 * (public launch, 2026-10-24).
 *
 * index.html's <title> was already rebranded ('Gobigrams — draw diagrams in
 * your browser', the ROUND BF brand commit). This round sweeps the REMAINING
 * user-visible strings in src/:
 *   - Tour.tsx  — 'Welcome to Diagram Studio' (onboarding copy)
 *   - App.tsx   - the palette brand bar wordmark ('Diagram Studio')
 *   - App.tsx   - the PDF print fallback title ('Diagram Studio')
 *
 * DELIBERATELY NOT RENAMED (and asserted as such below):
 *   - the `diagram-studio:*` localStorage keys — renaming would wipe every
 *     user's boards/settings on upgrade;
 *   - src/textOutline.ts's SAMPLE string — an internal glyph-width probe,
 *     never rendered (and its character set is load-bearing);
 *   - code comments/docblocks (styles.css, library.ts) — not user-visible.
 *
 * WHAT IT CHECKS:
 *   STATIC — zero non-comment 'Diagram Studio' occurrences remain in src/;
 *     the three replacements read 'Gobigrams'; the storage keys and the
 *     textOutline SAMPLE survive untouched.
 *   LIVE   — on the dev server: the palette brand bar shows Gobigrams; the
 *     document title carries Gobigrams; and a fresh profile (tour not seen)
 *     renders the tour's first card titled 'Welcome to Gobigrams'.
 *
 * REPLAY: RED on the pinned pre-change commit — the three strings still read
 * 'Diagram Studio' there.
 */
import {readFileSync} from 'node:fs';
import {join, dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {readdirSync, statSync} from 'node:fs';
import {createRequire} from 'node:module';

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

console.log(`round-bh-rename — ROOT=${ROOT}  APP_URL=${APP_URL}`);

/* ===========================================================================
   STATIC
   =========================================================================== */
console.log('='.repeat(78));
console.log('STATIC — every non-comment occurrence in src/');
console.log('='.repeat(78));

/* walk src/, comments blanked, collect every remaining occurrence */
const SRC_DIR = join(ROOT, 'src');
const walk = (dir) => {
  const out = [];
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    if (statSync(p).isDirectory()) out.push(...walk(p));
    else if (/\.(tsx?|css)$/.test(e)) out.push(p);
  }
  return out;
};
const leftovers = [];
for (const p of walk(SRC_DIR)) {
  const rel = p.slice(ROOT.length + 1);
  const s = blank(read(rel));
  let idx = -1;
  while ((idx = s.indexOf('Diagram Studio', idx + 1)) !== -1) {
    const line = s.slice(0, idx).split('\n').length;
    /* textOutline.ts's SAMPLE is the ONE deliberate survivor (bh.n6): an
       internal glyph-width probe, never rendered. */
    if (rel === 'src/textOutline.ts') continue;
    leftovers.push(`${rel}:${line}`);
  }
}

assert('bh.n1.no-user-visible-diagram-studio-remains-in-src',
  leftovers.length === 0,
  leftovers.length ? `still present: ${leftovers.join(', ')}` : 'zero non-comment occurrences in src/ (comments deliberately keep the history)');

const TOUR = read('src/Tour.tsx');
assert('bh.n2.tour-welcomes-gobigrams',
  TOUR.includes("title: 'Welcome to Gobigrams'"),
  'Tour.tsx step 1 title');

const APP = read('src/App.tsx');
/* header follow-up re-anchor: the fake dot + 'diagrams' suffix were replaced by
   the real brand mark (same turn) — the wordmark guarantee is now on the mark+name. */
assert('bh.n3.brand-bar-wordmark-is-gobigrams',
  APP.includes('<img className="brand-mark" src="/brand/icon-g.svg"') && /aria-hidden="true" \/>\s*Gobigrams/.test(APP),
  'App.tsx palette brand bar');

assert('bh.n4.pdf-fallback-title-is-gobigrams',
  APP.includes("curBoard?.name || 'Gobigrams'"),
  'App.tsx printSvgAsPdf fallback title');

/* the NOT-renamed invariants */
assert('bh.n5.storage-keys-untouched',
  (APP.match(/diagram-studio:/g) || []).length >= 10
    && read('src/zOrderMode.ts').includes("'diagram-studio:z-order'"),
  `App.tsx still carries its diagram-studio:* keys (${(APP.match(/diagram-studio:/g) || []).length} in App.tsx alone) — renaming would wipe users' boards`);

assert('bh.n6.textoutline-sample-untouched',
  read('src/textOutline.ts').includes("const SAMPLE = 'Diagram Studio reads 123 — widths 0123456789'"),
  'the internal glyph-width probe string survives (never rendered, character set is load-bearing)');

/* ===========================================================================
   LIVE
   =========================================================================== */
console.log('\n' + '='.repeat(78));
console.log(`LIVE — brand bar + document title + tour card (${APP_URL})`);
console.log('='.repeat(78));

try {
  const require_ = createRequire(join('/home/harvey/projects/tech-goblin/package.json', 'noop.js'));
  const {chromium} = require_('playwright-core');
  const browser = await chromium.launch();
  try {
    /* profile WITHOUT tour-seen: the tour must show the renamed welcome */
    const page = await browser.newPage({viewport: {width: 1500, height: 900}});
    await page.addInitScript(() => localStorage.removeItem('diagram-studio:tour-seen'));
    await page.goto(APP_URL, {waitUntil: 'networkidle'});
    const live = await page.evaluate(() => ({
      brand: document.querySelector('.panel-head .brand')?.textContent?.trim() || '',
      title: document.title,
      tour: document.querySelector('.tour-card')?.textContent || '',
    }));
    await page.close();

    assert('bh.n7.live-brand-bar-reads-gobigrams',
      /^Gobigrams/.test(live.brand.replace(/\s+/g, ' ')),
      `palette brand bar text: "${live.brand.replace(/\s+/g, ' ')}" (no 'Diagram Studio' in it: ${!live.brand.includes('Diagram Studio')})`);

    assert('bh.n8.live-document-title-carries-gobigrams',
      live.title.includes('Gobigrams') && !live.title.includes('Diagram Studio'),
      `document.title = "${live.title}"`);

    assert('bh.n9.live-tour-card-welcomes-gobigrams',
      live.tour.includes('Welcome to Gobigrams') && !live.tour.includes('Diagram Studio'),
      `tour first card: "${live.tour.replace(/\s+/g, ' ').slice(0, 90)}…"`);
  } finally {
    await browser.close();
  }
} catch (e) {
  assert('bh.live-pass-ran', false, `the live pass could not run: ${String(e).slice(0, 300)}`);
}

const fails = results.filter(r => !r.pass);
console.log(`\nround-bh-rename: ${results.length - fails.length}/${results.length} assertions pass`);
if (fails.length) {
  console.log('FAILED:');
  for (const f of fails) console.log(`  ${f.id} — ${f.detail}`);
}
process.exit(fails.length ? 1 : 0);
