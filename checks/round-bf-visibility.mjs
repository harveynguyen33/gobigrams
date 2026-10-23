#!/usr/bin/env node
/**
 * ROUND BF harness — BF-1: an imported custom shape is VISIBLE at rest.
 *
 * THE DEFECT: `CustomShapeNode` rendered only the sanitized `<img>`; the
 * container carried no border/outline/background, so a transparent-region
 * import painted nothing until selection showed the grips.
 *
 * THE FIX (SPEC §1.2): a 1.5px dashed ring in the node's own token colour —
 * `outline` (never `border`, never `box-shadow`), scoped `:not(.selected)`,
 * `--nc` set from `resolveColor(d)` on the root div.
 *
 * PASSES:
 *   AC4 (static) — the source contract: no SHAPE_MAX_PX/512 creep-back, the
 *   `--nc` wiring, the rule text token-coloured with no hex literal, and the
 *   existing `.selected { outline: none }` rule untouched.
 *   AC1/AC2/AC3 (live DOM on the dev server, round-bd's machinery: probe
 *   board via POST/PUT, tour pre-seen, playwright-core) — the computed ring
 *   at rest resolves the colorKey token on the live theme; the ring is
 *   layout-neutral (disabling the rule moves the <img> by 0.0px, and the
 *   same parity check FAILS when the ring is injected as a `border` — the
 *   negative control, proving AC2 detects the ROUND BE defect class); and
 *   selection keeps today's `outline-width: 0px`.
 *
 * Probe-board hygiene: unique name prefix BF-PROBE-, created via the app's
 * own POST, deleted by exact filename (file rmSync, never DELETE HTTP),
 * never touches boards/library.json or any of Harvey's boards.
 */
import {readFileSync, rmSync} from 'node:fs';
import {join, dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');
const APP_URL = process.env.BF_APP_URL || process.env.AY_APP_URL || 'http://localhost:5200/';

const TSX_RAW = readFileSync(`${ROOT}/src/CustomShapeNode.tsx`, 'utf8');
const CSS_RAW = readFileSync(`${ROOT}/src/styles.css`, 'utf8');

/** Strip comments BEFORE any "is this declared?" probe (round-r discipline:
 *  a docblock quoting the old declaration must not count). */
const blank = m => m.replace(/[^\n]/g, ' ');
const strip = s => s.replace(/\/\*[\s\S]*?\*\//g, blank).replace(/^[ \t]*\/\/.*$/gm, blank);
const TSX = strip(TSX_RAW);

const results = [];
const assert = (id, pass, detail = '') => {
  results.push({id, pass: !!pass, detail});
  console.log(`  ${pass ? 'PASS' : 'FAIL'}  ${id}  —  ${detail}`);
};

/* ===========================================================================
   AC4 — the source contract (static)
   =========================================================================== */
console.log('='.repeat(78));
console.log('BF-1 AC4 — source contract (static, comments stripped)');
console.log('='.repeat(78));

assert('bf1.ac4.no-ceiling-reference-creeps-back',
  !/SHAPE_MAX_PX/.test(TSX) && !/\b512\b/.test(TSX),
  'CustomShapeNode.tsx references neither SHAPE_MAX_PX nor a 512 literal (round-5 7d stays green)');

assert('bf1.ac4.nc-is-set-from-resolveColor',
  /import \{resolveColor\} from '\.\/colors'/.test(TSX)
    && /resolveColor\(d\)/.test(TSX)
    && /--nc/.test(TSX),
  "the root div carries style --nc from resolveColor(d) — the node's colourKey finally reaches the DOM");

const ringRule = (/\.custom-shape-node:not\(\.selected\)\s*\{[^}]*\}/.exec(CSS_RAW) ?? [''])[0];
assert('bf1.ac4.ring-rule-is-outline-dashed-token-coloured',
  /outline:\s*1\.5px dashed var\(--nc,\s*var\(--border-strong\)\)/.test(ringRule)
    && /outline-offset:\s*0/.test(ringRule)
    && !/#[0-9a-f]{3,8}\b/i.test(ringRule),
  ringRule
    ? `rule reads "${ringRule.replace(/\s+/g, ' ').trim()}" — outline (not border/box-shadow), 1.5px dashed, var(--nc, …) fallback, zero hex literals`
    : 'no .custom-shape-node:not(.selected) rule found in styles.css');

assert('bf1.ac4.selected-outline-none-untouched',
  /\.custom-shape-node\.selected\s*\{\s*outline:\s*none;?\s*\}/.test(CSS_RAW),
  'the pre-existing .custom-shape-node.selected { outline: none } rule is byte-for-byte intact');

assert('bf1.ac4.no-padding-creeps-back',
  !/\.custom-shape-node\s*\{[^}]*padding/.test(CSS_RAW),
  'the custom node rule block still carries no padding (ROUND BE: the box is the art box)');

/* ===========================================================================
   AC1/AC2/AC3 — live DOM on the dev server
   =========================================================================== */
console.log('\n' + '='.repeat(78));
console.log(`BF-1 AC1/AC2/AC3 — live DOM (${APP_URL})`);
console.log('='.repeat(78));

const SVG = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">'
  + '<rect x="6" y="6" width="88" height="88" fill="none" stroke="#5eead4" stroke-width="2"/></svg>';

const board = {
  id: '', name: `BF-PROBE-VIS-${Date.now()}`,
  nodes: [
    /* AC2 wants a fixed-size node (200x200) — the exact spec scenario. */
    {id: 'v1', type: 'customshape', position: {x: 0, y: 0}, selected: false,
     style: {width: 200, height: 200}, measured: {width: 200, height: 200},
     data: {svg: SVG, viewBox: '0 0 100 100', title: 'ring probe cyan', colorKey: 'cyan'}},
    /* a second colour key — the ring must re-theme per node, not paint one literal */
    {id: 'v2', type: 'customshape', position: {x: 320, y: 0}, selected: false,
     style: {width: 150, height: 150}, measured: {width: 150, height: 150},
     data: {svg: SVG, viewBox: '0 0 100 100', title: 'ring probe amber', colorKey: 'amber'}},
  ],
  edges: [],
};

try {
  const require_ = createRequire(join('/home/harvey/projects/tech-goblin/package.json', 'noop.js'));
  const {chromium} = require_('playwright-core');
  const browser = await chromium.launch();
  const page = await browser.newPage({viewport: {width: 1500, height: 900}});
  try {
    const r0 = await page.request.post(`${APP_URL}api/boards`, {data: {name: board.name}});
    board.id = (await r0.json()).id;
    await page.request.put(`${APP_URL}api/boards/${board.id}`, {data: board});

    /* the guided tour intercepts pointer events — pre-seen, round-bd's trick */
    await page.addInitScript(() => localStorage.setItem('diagram-studio:tour-seen', '1'));
    await page.goto(`${APP_URL}?board=${board.id}`, {waitUntil: 'networkidle'});
    await page.waitForSelector('.react-flow__node[data-id="v1"] img', {timeout: 15000});
    await page.waitForTimeout(300);

    /* ---- AC1: the ring at rest, computed ------------------------------- */
    const ring = await page.evaluate(() => {
      const node = document.querySelector('.react-flow__node[data-id="v1"] .custom-shape-node');
      const cs = getComputedStyle(node);
      const token = (name) => {
        const s = document.createElement('span');
        s.style.color = `var(${name})`;
        document.body.appendChild(s);
        const c = getComputedStyle(s).color;
        s.remove();
        return c;
      };
      return {
        width: cs.outlineWidth, style: cs.outlineStyle, color: cs.outlineColor,
        cyan: token('--c-cyan'), amber: token('--c-amber'),
        nc: cs.getPropertyValue('--nc').trim(),
      };
    });
    assert('bf1.ac1.ring-at-rest-is-1.5px-dashed',
      parseFloat(ring.width) >= 1 && parseFloat(ring.width) <= 1.5 && ring.style === 'dashed',
      `computed outline ${ring.width} ${ring.style} on the unselected node (Chromium rounds the 1.5px width in computed style — the rule text's exact 1.5px is pinned by the AC4 static check)`);
    assert('bf1.ac1.ring-colour-resolves-the-colorKey-token',
      ring.color !== 'transparent' && ring.color !== 'rgba(0, 0, 0, 0)'
        && ring.color === ring.cyan,
      `outlineColor ${ring.color} === var(--c-cyan) ${ring.cyan} (via --nc, computed to "${ring.nc}") on the live theme`);

    const ring2 = await page.evaluate(() => {
      const node = document.querySelector('.react-flow__node[data-id="v2"] .custom-shape-node');
      return {color: getComputedStyle(node).outlineColor};
    });
    assert('bf1.ac1.ring-re-themes-per-node',
      ring2.color === ring.amber && ring2.color !== ring.color,
      `the amber node's ring ${ring2.color} === var(--c-amber) ${ring.amber}, different from the cyan node's ${ring.color}`);

    /* ---- AC2: layout neutrality, measured ------------------------------ *
     * The <img> rect must be BYTE-identical with the ring rule enabled and
     * disabled (tolerance 0.0) — outline paints outside the border box and
     * joins no layout. Then the NEGATIVE CONTROL: the same parity check with
     * the ring injected as a `border` MUST move the art (the ROUND BE defect
     * class) — if it does not, AC2 is not detecting anything. */
    const rectOf = () => page.evaluate(() => {
      const r = document.querySelector('.react-flow__node[data-id="v1"] img').getBoundingClientRect();
      return {x: r.x, y: r.y, w: r.width, h: r.height};
    });
    const withRing = await rectOf();
    const toggled = await page.evaluate(() => {
      for (const sheet of document.styleSheets) {
        for (const rule of sheet.cssRules) {
          if (rule.selectorText === '.custom-shape-node:not(.selected)') {
            rule.disabled = true;
            return true;
          }
        }
      }
      return false;
    });
    const withoutRing = await rectOf();
    await page.evaluate(() => {
      for (const sheet of document.styleSheets) {
        for (const rule of sheet.cssRules) {
          if (rule.selectorText === '.custom-shape-node:not(.selected)') rule.disabled = false;
        }
      }
    });
    const same = (a, b) => a.x === b.x && a.y === b.y && a.w === b.w && a.h === b.h;
    assert('bf1.ac2.rule-found-and-toggleable', toggled,
      toggled ? 'the ring rule was located in the live sheet and disabled for the parity read'
              : 'the ring rule was not found in any live stylesheet — AC2 parity read is unverified');
    assert('bf1.ac2.ring-moves-the-art-by-0.0px',
      toggled && same(withRing, withoutRing),
      `img rect with ring ${JSON.stringify(withRing)} === without ${JSON.stringify(withoutRing)} (tolerance 0.0)`);

    await page.addStyleTag({
      content: '/*bf-probe*/.custom-shape-node:not(.selected){border:1.5px dashed var(--nc, var(--border-strong));}',
    });
    const withBorder = await rectOf();
    await page.evaluate(() => {
      for (const s of document.querySelectorAll('style')) {
        if (s.textContent.includes('/*bf-probe*/')) s.remove();
      }
    });
    const detectionSawIt = await rectOf();
    assert('bf1.ac2.negative-control-a-border-WOULD-move-the-art',
      !same(withBorder, withRing) && same(detectionSawIt, withRing),
      `injecting the same ring as a border shifts the img rect to ${JSON.stringify(withBorder)} (box-sizing:border-box shrinks the content box) and removing it restores ${JSON.stringify(detectionSawIt)} — AC2 detects the layout-shift class`);

    /* ---- AC3: selected keeps today's behaviour -------------------------- */
    await page.click('.react-flow__node[data-id="v1"]');
    await page.waitForTimeout(250);
    const sel = await page.evaluate(() => {
      const node = document.querySelector('.react-flow__node[data-id="v1"] .custom-shape-node');
      const cs = getComputedStyle(node);
      return {style: cs.outlineStyle, width: cs.outlineWidth, selected: node.classList.contains('selected')};
    });
    assert('bf1.ac3.selected-node-has-no-ring',
      sel.selected && sel.style === 'none',
      `after clicking, the node is selected (${sel.selected}) and computed outline-style is ${sel.style} ` +
        `(width reads ${sel.width} — \`outline: none\` zeroes the style, not the medium width) — the grips delineate the box instead`);
  } finally {
    /* probe cleanup: exact filenames, file delete, never DELETE HTTP */
    if (board.id) {
      rmSync(join(ROOT, 'boards', `${board.id}.json`), {force: true});
      rmSync(join(ROOT, 'boards', `${board.id}.json.bak`), {force: true});
    }
    await browser.close();
  }
} catch (e) {
  assert('bf1.live-pass-ran', false, `the live pass could not run: ${String(e).slice(0, 300)}`);
}

const fails = results.filter(r => !r.pass);
console.log(`\nround-bf-visibility: ${results.length - fails.length}/${results.length} assertions pass`);
if (fails.length) {
  console.log('FAILED:');
  for (const f of fails) console.log(`  ${f.id} — ${f.detail}`);
}
process.exit(fails.length ? 1 : 0);
