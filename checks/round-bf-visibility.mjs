#!/usr/bin/env node
/**
 * ROUND BF harness — BF-2: the custom-shape selection ring, INVERTED.
 *
 * THE DEFECT (Harvey's device test, 2026-10-24): BF-1 added a 1.5px dashed
 * AT-REST outline so a transparent import was visible before selection — but
 * Harvey meant the SELECTED shape should read as a selected box (a ring
 * connecting the 4 resize grips, like every normal shape's selection ring),
 * NOT an at-rest ring. "The selected custom shape should read as a selected
 * box, like every other shape."
 *
 * THE FIX (BF-2): BF-1's `.custom-shape-node:not(.selected)` outline rule is
 * REMOVED (the unselected node paints exactly as before ROUND BF), and
 * `.custom-shape-node.selected` now paints the same ring `.node.selected`
 * paints: a two-layer `box-shadow` (2px var(--bg) gap + 4px var(--sel) ring)
 * that follows its 8px border-radius — layout-neutral, grips untouched.
 *
 * PASSES:
 *   AC4 (static) — the source contract: no SHAPE_MAX_PX/512 creep-back, the
 *   `--nc` wiring stays, NO at-rest ring rule survives, and the selected rule
 *   is the `.node.selected` ring restated (same weights, same var(--sel),
 *   same 8px radius, `outline: none` kept, zero hex literals).
 *   AC1/AC2/AC3 (live DOM on the dev server, round-bd's machinery: probe
 *   board via POST/PUT, tour pre-seen, playwright-core) — at rest NOTHING is
 *   painted (outline-width 0px, no box-shadow); selected, the ring resolves
 *   var(--sel)'s rgb on the live theme; and the ring is layout-neutral
 *   (disabling the rule moves the <img> by 0.0px while selected, and the same
 *   parity check FAILS when the ring is injected as a `border` — the negative
 *   control, proving AC2 detects the ROUND BE defect class).
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
const APP_URL = process.env.BF_APP_URL || process.env.AY_APP_URL || 'http://192.168.33.200:5200/';

const TSX_RAW = readFileSync(`${ROOT}/src/CustomShapeNode.tsx`, 'utf8');
const CSS_RAW = readFileSync(`${ROOT}/src/styles.css`, 'utf8');

/** Strip comments BEFORE any "is this declared?" probe (round-r discipline:
 *  a docblock quoting the old declaration must not count). */
const blank = m => m.replace(/[^\n]/g, ' ');
const strip = s => s.replace(/\/\*[\s\S]*?\*\//g, blank).replace(/^[ \t]*\/\/.*$/gm, blank);
const TSX = strip(TSX_RAW);
/* CSS comments are `/* … *​/` only (no // lines), same stripper. BF-2's own
   docblock quotes the BF-1 selector it deletes — the probe must not find it
   there (the same discipline TSX already follows). */
const CSS = strip(CSS_RAW);

const results = [];
const assert = (id, pass, detail = '') => {
  results.push({id, pass: !!pass, detail});
  console.log(`  ${pass ? 'PASS' : 'FAIL'}  ${id}  —  ${detail}`);
};

/* ===========================================================================
   AC4 — the source contract (static)
   =========================================================================== */
console.log('='.repeat(78));
console.log('BF-2 AC4 — source contract (static, comments stripped)');
console.log('='.repeat(78));

assert('bf2.ac4.no-ceiling-reference-creeps-back',
  !/SHAPE_MAX_PX/.test(TSX) && !/\b512\b/.test(TSX),
  'CustomShapeNode.tsx references neither SHAPE_MAX_PX nor a 512 literal (round-5 7d stays green)');

assert('bf2.ac4.nc-wiring-stays',
  /import \{resolveColor\} from '\.\/colors'/.test(TSX)
    && /resolveColor\(d\)/.test(TSX)
    && /--nc/.test(TSX),
  "the root div still carries style --nc from resolveColor(d) — the node kind keeps its colourKey wiring (handle hover emphasis reads it)");

assert('bf2.ac4.no-at-rest-ring-survives',
  !/\.custom-shape-node:not\(\.selected\)/.test(CSS),
  'BF-1\'s `.custom-shape-node:not(.selected)` outline rule is GONE from the sheet proper (comments stripped) — the unselected node paints exactly as before ROUND BF');

/* The selected rule, as ONE block: the `.node.selected` ring restated. */
const selRule = (/\.custom-shape-node\.selected\s*\{[^}]*\}/.exec(CSS) ?? [''])[0];
assert('bf2.ac4.selected-rule-is-the-node-selected-ring',
  /box-shadow:\s*0 0 0 2px var\(--bg\),\s*0 0 0 4px var\(--sel\)/.test(selRule)
    && /border-radius:\s*8px/.test(selRule)
    && /outline:\s*none/.test(selRule)
    && !/#[0-9a-f]{3,8}\b/i.test(selRule),
  selRule
    ? `rule reads "${selRule.replace(/\s+/g, ' ').trim()}" — the same two-layer box-shadow ring, 2px var(--bg) gap + 4px var(--sel), as .node.selected (styles.css), same 8px radius, outline: none kept, zero hex literals`
    : 'no .custom-shape-node.selected rule found in styles.css');

assert('bf2.ac4.no-padding-creeps-back',
  !/\.custom-shape-node\s*\{[^}]*padding/.test(CSS),
  'the custom node rule block still carries no padding (ROUND BE: the box is the art box)');

/* ===========================================================================
   AC1/AC2/AC3 — live DOM on the dev server
   =========================================================================== */
console.log('\n' + '='.repeat(78));
console.log(`BF-2 AC1/AC2/AC3 — live DOM (${APP_URL})`);
console.log('='.repeat(78));

const SVG = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">'
  + '<rect x="6" y="6" width="88" height="88" fill="none" stroke="#5eead4" stroke-width="2"/></svg>';

const board = {
  id: '', name: `BF-PROBE-VIS-${Date.now()}`,
  nodes: [
    /* a fixed-size node (200x200) — the exact spec scenario. */
    {id: 'v1', type: 'customshape', position: {x: 0, y: 0}, selected: false,
     style: {width: 200, height: 200}, measured: {width: 200, height: 200},
     data: {svg: SVG, viewBox: '0 0 100 100', title: 'ring probe cyan', colorKey: 'cyan'}},
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

    /* ---- AC1: at rest, NOTHING is painted (the BF-1 inversion) ---------- */
    const rest = await page.evaluate(() => {
      const node = document.querySelector('.react-flow__node[data-id="v1"] .custom-shape-node');
      const cs = getComputedStyle(node);
      return {style: cs.outlineStyle, width: cs.outlineWidth, shadow: cs.boxShadow};
    });
    /* `outline-width: medium` (3px) is the CSS INITIAL, reported even while
       `outline-style: none` makes it paint NOTHING — the painted/not-painted
       fact is carried by style+shadow, so the width is reported, not gated. */
    assert('bf2.ac1.at-rest-paints-nothing',
      rest.style === 'none' && rest.shadow === 'none',
      `unselected: computed outline-style ${rest.style} (width ${rest.width} = the CSS initial, paints nothing), box-shadow "${rest.shadow}" — the unselected node paints exactly as before ROUND BF`);

    /* ---- select the node once; every read below is on the SELECTED box --- */
    await page.click('.react-flow__node[data-id="v1"]');
    await page.waitForTimeout(250);

    /* ---- AC3: selected, the ring resolves var(--sel) on the live theme -- */
    const sel = await page.evaluate(() => {
      const node = document.querySelector('.react-flow__node[data-id="v1"] .custom-shape-node');
      const cs = getComputedStyle(node);
      /* Resolve the DECLARATION itself, not a substring of the computed value
         (computed shadows are `rgba(r, g, b, a) 0px 0px 0px Npx, …` — splitting
         on commas would chop the colours). A probe span painted with the exact
         declaration the sheet should carry, compared to the node's own computed
         shadow, proves the ring is var(--sel) on the live theme. */
      const probe = document.createElement('span');
      probe.style.boxShadow = '0 0 0 2px var(--bg), 0 0 0 4px var(--sel)';
      probe.style.borderRadius = '8px';
      document.body.appendChild(probe);
      const probeShadow = getComputedStyle(probe).boxShadow;
      const probeSelOnly = (() => {
        const p = document.createElement('span');
        p.style.boxShadow = '0 0 0 4px var(--sel)';
        document.body.appendChild(p);
        const s = getComputedStyle(p).boxShadow;
        p.remove();
        return s;
      })();
      probe.remove();
      return {
        selected: node.classList.contains('selected'),
        shadow: cs.boxShadow, outlineStyle: cs.outlineStyle,
        radius: cs.borderRadius,
        probeShadow, probeSelOnly,
      };
    });
    assert('bf2.ac3.selected-ring-resolves-var-sel',
      sel.selected && sel.outlineStyle === 'none'
        && sel.shadow === sel.probeShadow
        && sel.probeShadow.includes(sel.probeSelOnly)
        && sel.radius === '8px',
      `selected: computed box-shadow === a probe painted with "0 0 0 2px var(--bg), 0 0 0 4px var(--sel)" (${sel.shadow}) — the outer layer IS var(--sel) on the live theme, radius ${sel.radius}, outline ${sel.outlineStyle} (the ring replaced it, it does not fight it)`);

    /* ---- AC2: layout neutrality of the SELECTED ring, measured ---------- *
     * The <img> rect must be BYTE-identical with the selected rule enabled
     * and disabled (tolerance 0.0) — box-shadow paints outside the border box
     * and joins no layout. Then the NEGATIVE CONTROL: the same parity check
     * with the ring injected as a `border` MUST move the art (the ROUND BE
     * defect class) — if it does not, AC2 is not detecting anything. */
    const rectOf = () => page.evaluate(() => {
      const r = document.querySelector('.react-flow__node[data-id="v1"] img').getBoundingClientRect();
      return {x: r.x, y: r.y, w: r.width, h: r.height};
    });
    const withRing = await rectOf();
    const toggled = await page.evaluate(() => {
      for (const sheet of document.styleSheets) {
        for (const rule of sheet.cssRules) {
          if (rule.selectorText === '.custom-shape-node.selected') {
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
          if (rule.selectorText === '.custom-shape-node.selected') rule.disabled = false;
        }
      }
    });
    const same = (a, b) => a.x === b.x && a.y === b.y && a.w === b.w && a.h === b.h;
    assert('bf2.ac2.rule-found-and-toggleable', toggled,
      toggled ? 'the selected ring rule was located in the live sheet and disabled for the parity read'
              : 'the selected ring rule was not found in any live stylesheet — AC2 parity read is unverified');
    assert('bf2.ac2.ring-moves-the-art-by-0.0px',
      toggled && same(withRing, withoutRing),
      `img rect with ring ${JSON.stringify(withRing)} === without ${JSON.stringify(withoutRing)} (tolerance 0.0), measured while selected`);

    await page.addStyleTag({
      content: '/*bf-probe*/.custom-shape-node.selected{border:2px solid var(--sel);}',
    });
    const withBorder = await rectOf();
    await page.evaluate(() => {
      for (const s of document.querySelectorAll('style')) {
        if (s.textContent.includes('/*bf-probe*/')) s.remove();
      }
    });
    const detectionSawIt = await rectOf();
    assert('bf2.ac2.negative-control-a-border-WOULD-move-the-art',
      !same(withBorder, withRing) && same(detectionSawIt, withRing),
      `injecting the same weight as a border shifts the img rect to ${JSON.stringify(withBorder)} (box-sizing:border-box shrinks the content box) and removing it restores ${JSON.stringify(detectionSawIt)} — AC2 detects the layout-shift class`);
  } finally {
    /* probe cleanup: exact filenames, file delete, never DELETE HTTP */
    if (board.id) {
      rmSync(join(ROOT, 'boards', `${board.id}.json`), {force: true});
      rmSync(join(ROOT, 'boards', `${board.id}.json.bak`), {force: true});
    }
    await browser.close();
  }
} catch (e) {
  assert('bf2.live-pass-ran', false, `the live pass could not run: ${String(e).slice(0, 300)}`);
}

const fails = results.filter(r => !r.pass);
console.log(`\nround-bf-visibility: ${results.length - fails.length}/${results.length} assertions pass`);
if (fails.length) {
  console.log('FAILED:');
  for (const f of fails) console.log(`  ${f.id} — ${f.detail}`);
}
process.exit(fails.length ? 1 : 0);
