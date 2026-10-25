#!/usr/bin/env node
/**
 * ROUND BF harness — BF-2/BF-3: per-shape-class resize floors + drag-start
 * re-measure (AC5–AC10) + the §2.3 note measurement probe.
 *
 * THE DEFECT: ONE uniform JS floor (200x141) was applied to every shape class
 * while the CSS exempts the connector (min-width: 0) — and the natural-size
 * measurement bailed the moment a wrapper carried an explicit size, so every
 * RELOADED board snapped the floor back to 200. A 152px connector therefore
 * took a 48px folded clamp on the FIRST drag event (the jerk).
 *
 * PASSES:
 *   STATIC (AC5/AC6) — `resizeFloorsFor` exists with the §0 floor table's
 *   exact mapping (connector 64/64 flat, note 130/44 flat, text-card
 *   max(190, min(200, natural))), SYMBOL_FLOOR_PX === 2 * SHAPE_MIN_PX from
 *   the real import, and the per-class CSS invariant, read live from
 *   styles.css with round-r's rule reader.
 *   EXECUTED (the shipped resize math) — the five @xyflow/system functions
 *   sliced verbatim and compiled (round-af's technique), then run to show the
 *   pre-change first-event jump numerically.
 *   LIVE (AC7–AC10) — real grips dragged on the dev server (round-bd's
 *   machinery): the reload jerk (AC7), the 145 no-drift + 141 stop (AC8),
 *   the note 130 stop (AC9), the connector 64 wrap (AC10).
 *   PROBE — the §2.3 note one-line measurement, logged every run.
 *
 * Probe-board hygiene: unique BF-PROBE- name, created via the app's own POST,
 * removed by exact filename (file rmSync, never DELETE HTTP), never touches
 * boards/library.json or any of Harvey's boards.
 */
import {readFileSync, writeFileSync, rmSync, existsSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {join, dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');
const APP_URL = process.env.BF_APP_URL || process.env.AY_APP_URL || 'http://localhost:5200/';

const NODE_RAW = readFileSync(`${ROOT}/src/nodes/DiagramNode.tsx`, 'utf8');
const STYLES_RAW = readFileSync(`${ROOT}/src/styles.css`, 'utf8');

/** Strip comments before any "is this declared?" probe (round-r discipline). */
const blank = m => m.replace(/[^\n]/g, ' ');
const strip = s => s.replace(/\/\*[\s\S]*?\*\//g, blank).replace(/^[ \t]*\/\/.*$/gm, blank);
const NODE = strip(NODE_RAW);

const results = [];
const assert = (id, pass, detail = '') => {
  results.push({id, pass: !!pass, detail});
  console.log(`  ${pass ? 'PASS' : 'FAIL'}  ${id}  —  ${detail}`);
};

/* round-r's rule reader, unchanged. */
function parseDecls(text) {
  const out = {};
  for (const d of String(text).split(';')) {
    const m = /([a-z-]+):\s*([\s\S]+)/.exec(d.trim());
    if (m) out[m[1]] = m[2].replace(/\s+/g, ' ').trim();
  }
  return out;
}
function rule(sheet, sel) {
  const lines = sheet.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const t = lines[i].trim();
    if (!t.startsWith(sel)) continue;
    const after = t.slice(sel.length).trimStart();
    if (!after.startsWith('{') && !after.startsWith(',')) continue;
    const same = /\{([\s\S]*)\}/.exec(t);
    if (same) return {decls: parseDecls(same[1]), line: i + 1};
    const body = [];
    for (let j = i + 1; j < lines.length; j++) {
      if (/^\}/.test(lines[j].trim())) break;
      body.push(lines[j]);
    }
    return {decls: parseDecls(body.join('\n')), line: i + 1};
  }
  return null;
}
const cssPx = (r, prop) => {
  const v = String(r?.decls?.[prop] ?? '');
  const m = /^(\d+(?:\.\d+)?)px$/.exec(v);
  return m ? +m[1] : null;
};

/* ===========================================================================
   0 — EXECUTE the shipped module: resizeFloorsFor + the constants.
   Round-be's esbuild trick: bundle src/nodes/DiagramNode.tsx (it imports shapes/colors
   — heavier than presets but the same bundler run) and import the exports.
   =========================================================================== */
console.log('='.repeat(78));
console.log('BF-0 — the shipped floors module, EXECUTED');
console.log('='.repeat(78));

const REAL_ROOT = '/home/harvey/projects/tech-goblin';
const ENTRY = join(ROOT, '.bf-entry.ts');
const OUT = join(ROOT, '.bf-out.cjs');
let MOD = null;
try {
  /* Namespace re-export: a name that does not exist yet (NOTE_* before slice
     C) reads `undefined` instead of failing the esbuild bundle, so the SAME
     harness runs at every slice with only its slice's assertions failing.
     Format CJS: DiagramNode's tree pulls a `require('react')` somewhere
     (lucide/choreography helpers), and ESM output would die on it. */
  writeFileSync(ENTRY,
    `import * as DN from './src/nodes/DiagramNode';\n` +
    `import * as CS from './src/nodes/customShape';\n` +
    `export const resizeFloorsFor = DN.resizeFloorsFor as any;\n` +
    `export const NODE_MIN_W = DN.NODE_MIN_W, NODE_MIN_H = DN.NODE_MIN_H;\n` +
    `export const CSS_CONTENT_MIN_W = DN.CSS_CONTENT_MIN_W, FLOOR_SLACK_PX = DN.FLOOR_SLACK_PX;\n` +
    `export const NOTE_CSS_MIN_W = DN.NOTE_CSS_MIN_W, NOTE_MIN_W = DN.NOTE_MIN_W, NOTE_MIN_H = DN.NOTE_MIN_H;\n` +
    `export const SYMBOL_FLOOR_PX = DN.SYMBOL_FLOOR_PX;\n` +
    `export const SHAPE_MIN_PX = CS.SHAPE_MIN_PX;\n`);
  execFileSync(join(REAL_ROOT, 'node_modules/.bin/esbuild'),
    [ENTRY, '--bundle', '--platform=node', '--format=cjs', '--log-level=error',
      `--outfile=${OUT}`, '--external:react', '--external:react-dom', '--external:react/jsx-runtime',
      '--external:@xyflow/react'],
    {encoding: 'utf8'});
  MOD = await import(`${OUT}?t=${Date.now()}`);
  console.log(`  bundled and imported DiagramNode's exports (SHAPE_MIN_PX=${MOD.SHAPE_MIN_PX})`);
} catch (e) {
  console.log(`  (could not bundle/execute src/nodes/DiagramNode.tsx: ${String(e).split('\n')[0]})`);
} finally {
  rmSync(ENTRY, {force: true});
  rmSync(OUT, {force: true});
}

/* ===========================================================================
   AC5 — the mapping is the §0 table (static + executed)
   =========================================================================== */
console.log('\n' + '='.repeat(78));
console.log('BF-2 AC5 — resizeFloorsFor: the §0 floor table');
console.log('='.repeat(78));

const HAS_F = typeof MOD?.resizeFloorsFor === 'function';
assert('bf2.ac5.resizeFloorsFor-exists-and-exported',
  HAS_F && /export function resizeFloorsFor\(/.test(NODE),
  HAS_F ? 'resizeFloorsFor is exported from src/nodes/DiagramNode.tsx and EXECUTED below'
        : 'resizeFloorsFor is absent from src/nodes/DiagramNode.tsx (pre-change tree)');

if (HAS_F) {
  const cx = MOD.resizeFloorsFor('connector', 290, 145);
  assert('bf2.ac5.connector-flat-64',
    cx.w === 64 && cx.h === 64 && MOD.SYMBOL_FLOOR_PX === 64,
    `resizeFloorsFor('connector', 290, 145) = {${cx.w}, ${cx.h}} — FLAT: natural ignored (a 290 natural does not lift it, the silhouette is the floor)`);

  const cxLow = MOD.resizeFloorsFor('connector', 40, 40);
  assert('bf2.ac5.connector-flat-is-not-lifted-or-lowered-by-natural',
    cxLow.w === 64 && cxLow.h === 64,
    `resizeFloorsFor('connector', 40, 40) = {${cxLow.w}, ${cxLow.h}} — the 64 is a floor, not a size`);

  const pr = MOD.resizeFloorsFor('process', 0, 0);
  const prNat = MOD.resizeFloorsFor('process', 185, 100);
  assert('bf2.ac5.text-card-form',
    pr.w === MOD.NODE_MIN_W && pr.h === MOD.NODE_MIN_H
      && prNat.w === Math.max(MOD.CSS_CONTENT_MIN_W, Math.min(MOD.NODE_MIN_W, 185))
      && prNat.h === Math.min(MOD.NODE_MIN_H, 100)
      && pr.w === 200 && pr.h === 141 && prNat.w === 190 && prNat.h === 100,
    `process natural 0/0 → {${pr.w}, ${pr.h}} (the 200x141 class floor); natural 185/100 → {${prNat.w}, ${prNat.h}} = max(190, min(200, 185)) x min(141, 100) — AQ19c/e semantics, pinned to the CSS floor on W`);

  const qu = MOD.resizeFloorsFor('queue', 199, 131);
  assert('bf2.ac5.queue-worst-case-unchanged',
    qu.w === 199 && qu.h === 131,
    `queue natural 199x131 (the ROUND S worst case) → {${qu.w}, ${qu.h}} — the AQ19c/e clamp semantics unchanged (min(NODE_MIN_W, natural); the new max() pin only binds when a natural drops below the CSS floor)`);

  assert('bf2.ac5.symbol-floor-derivation',
    MOD.SYMBOL_FLOOR_PX === 2 * MOD.SHAPE_MIN_PX && MOD.SHAPE_MIN_PX === 32,
    `SYMBOL_FLOOR_PX ${MOD.SYMBOL_FLOOR_PX} === 2 * SHAPE_MIN_PX (${MOD.SHAPE_MIN_PX}) — anchored to the real import, can never drift`);

  assert('bf2.ac5.single-call-site-in-component',
    /const floors = resizeFloorsFor\(/.test(NODE)
      && /minWidth=\{floors\.w\}/.test(NODE) && /minHeight=\{floors\.h\}/.test(NODE),
    `the component derives its floors via ONE call (const floors = resizeFloorsFor(…)); the resizer reads floors.w / floors.h`);

  /* SLICE C: the note row. Before slice C lands, NOTE_MIN_W is undefined and
     this assertion is the note floor's RED evidence (the pre-change tree
     floors the note at min(200, natural)); after, it pins the flat 130/44. */
  if (MOD.NOTE_MIN_W !== undefined) {
    const nt = MOD.resizeFloorsFor('note', 0, 0);
    assert('bf2.ac5.note-flat-130-44',
      nt.w === 130 && nt.h === 44 && MOD.NOTE_MIN_W === 130,
      `resizeFloorsFor('note', 0, 0) = {${nt.w}, ${nt.h}} — flat; NOTE_MIN_W ${MOD.NOTE_MIN_W} = NOTE_CSS_MIN_W ${MOD.NOTE_CSS_MIN_W} + FLOOR_SLACK_PX (slice C)`);
  } else {
    assert('bf2.ac5.note-flat-130-44',
      false,
      'NOTE_MIN_W is not exported yet (slice C not landed): the note still carries the text-card floor min(200, natural)');
  }
}

/* ===========================================================================
   AC6 — the per-class CSS invariant
   =========================================================================== */
console.log('\n' + '='.repeat(78));
console.log('BF-2 AC6 — per-class invariant: JS floor >= that class CSS floor');
console.log('='.repeat(78));

const nodeRule = rule(STYLES_RAW, '.node');
const cxRule = /\.node\.shape-connector\s*\{[^}]*\}/.exec(STYLES_RAW)?.[0] ?? '';
const noteRule = rule(STYLES_RAW, '.note-node');
const cssNodeMinW = cssPx(nodeRule, 'min-width');
/* the exemption is written unitless: `min-width: 0;` */
const cxMinM = /min-width:\s*([\d.]+)(px)?/.exec(cxRule);
const cxMinW = cxMinM ? +cxMinM[1] : null;
const noteMinWCss = cssPx(noteRule, 'min-width');
console.log(`  CSS floors: .node ${cssNodeMinW}px · .node.shape-connector ${cxMinW} (unitless exemption) · .note-node ${noteMinWCss}px`);

if (HAS_F) {
  /* TEXT-CARD: worst case over the class = natural unknown → the 200 floor;
     the invariant is min over the class of effective floor ≥ 190. */
  const textCardW = MOD.resizeFloorsFor('process', 0, 0).w;
  assert('bf2.ac6.text-card-floor-ge-css-190',
    textCardW >= cssNodeMinW && cssNodeMinW === 190,
    `text-card effective width floor ${textCardW} ≥ .node min-width ${cssNodeMinW} — exactly as strict as today`);

  const cxW = MOD.resizeFloorsFor('connector', 0, 0).w;
  assert('bf2.ac6.connector-floor-respects-the-exemption',
    cxMinW === 0 && cxW === 64 && cxW >= cxMinW,
    `connector: CSS floor ${cxMinW} (exempt), JS floor ${cxW} = the silhouette minimum`);

  const noteW = MOD.NOTE_MIN_W !== undefined ? MOD.resizeFloorsFor('note', 0, 0).w : undefined;
  assert('bf2.ac6.note-floor-ge-css-120',
    noteMinWCss === 120 && noteW !== undefined && noteW >= noteMinWCss && noteW === 130,
    `note: JS floor ${noteW ?? '(slice C not landed)'} >= .note-node min-width ${noteMinWCss} (120 + 10 slack, derived BY CONSTRUCTION from the CSS number)`);
}

/* ===========================================================================
   EXECUTED — the shipped resize math (round-af's technique), proving the
   pre-change first-event jump numerically on the connector case.
   =========================================================================== */
console.log('\n' + '='.repeat(78));
console.log('BF-2 — the shipped resize math, EXECUTED (the jerk, in numbers)');
console.log('='.repeat(78));

const SYS = readFileSync(`${ROOT}/node_modules/@xyflow/system/dist/esm/index.mjs`, 'utf8');
const grab = (name) => {
  const start = SYS.indexOf(`function ${name}(`);
  if (start < 0) return null;
  const i = SYS.indexOf('{', start);
  let depth = 0;
  for (let j = i; j < SYS.length; j++) {
    if (SYS[j] === '{') depth++;
    else if (SYS[j] === '}') { depth--; if (depth === 0) return SYS.slice(start, j + 1); }
  }
  return null;
};
const FN_SRC = ['getControlDirection', 'getLowerExtentClamp', 'getUpperExtentClamp', 'getSizeClamp', 'getDimensionsAfterResize', 'xor'].map(grab);
/* Same technique as round-af: the six function sources are sliced VERBATIM
 * out of the installed @xyflow/system bundle (a local, trusted file read from
 * node_modules — nothing user-controlled reaches this Function constructor)
 * so the numbers below are the library's own maths, not a re-implementation. */
const {getDimensionsAfterResize, getControlDirection} = new Function(`${FN_SRC.join('\n')}\nreturn {getDimensionsAfterResize, getControlDirection};`)();
const dragLib = (w, h, pos, dx, dy, minW, minH) => getDimensionsAfterResize(
  {x: 0, y: 0, width: w, height: h, pointerX: 1000, pointerY: 1000, aspectRatio: w / h},
  getControlDirection(pos), {xSnapped: 1000 + dx, ySnapped: 1000 + dy},
  {minWidth: minW, minHeight: minH, maxWidth: Number.MAX_VALUE, maxHeight: Number.MAX_VALUE},
  false, [0, 0], undefined, undefined,
);
/* one 1px pull on the right line grip: pre-change (floor 200) vs BF (floor 64) */
const pre = dragLib(152, 152, 'right', 1, 0, 200, 141);
const post = dragLib(152, 152, 'right', 1, 0, 64, 64);
console.log(`  152px connector, 1px right-grip pull, floor 200 (pre-change): width ${pre.width} (${pre.width - 152 >= 0 ? '+' : ''}${pre.width - 152}px off the pointer)`);
console.log(`  152px connector, 1px right-grip pull, floor 64  (ROUND BF)  : width ${post.width} (${post.width - 152 >= 0 ? '+' : ''}${post.width - 152}px off the pointer)`);
assert('bf2.executed.the-prechange-first-event-is-the-folded-clamp',
  Math.abs(pre.width - 153) >= 40 && post.width === 153,
  `the shipped math itself: floor 200 → the first event writes ${pre.width}, ${Math.abs(pre.width - 153)}px away from the pointer-implied 153 (THE jerk); floor 64 → ${post.width}, exactly the pointer-implied width`);

/* ===========================================================================
   PROBE — the §2.3 note one-line measurement (logged every run)
   =========================================================================== */
console.log('\n' + '='.repeat(78));
console.log('BF-2 — §2.3 note measurement probe (one real one-line note)');
console.log('='.repeat(78));

const SVG = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect x="6" y="6" width="88" height="88" fill="none" stroke="#5eead4" stroke-width="2"/></svg>';
const mkNode = (id, shape, x, y, w, h, extra = {}) => ({
  id, type: 'goblin', position: {x, y}, selected: false,
  style: {width: w, height: h}, measured: {width: w, height: h},
  data: {shape, kicker: '', title: 'One line', sub: '', metric: '', metricUnit: '', icon: '', colorKey: 'green', body: 'label-only', handles: 'tb', ...extra},
});
const board = {
  id: '', name: `BF-PROBE-FLOORS-${Date.now()}`,
  nodes: [
    mkNode('cx', 'connector', 0, 0, 152, 152, {title: 'A'}),
    mkNode('pr', 'process', 400, 0, 290, 145, {title: 'Process step'}),
    mkNode('nt', 'note', 0, 300, 200, 90),
    mkNode('cx2', 'connector', 400, 300, 448, 448, {title: 'B'}),
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
    await page.addInitScript(() => localStorage.setItem('diagram-studio:tour-seen', '1'));
    await page.goto(`${APP_URL}?board=${board.id}`, {waitUntil: 'networkidle'});
    await page.waitForSelector('.react-flow__node[data-id="cx"]', {timeout: 15000});
    await page.waitForTimeout(600);

    /* ---- the §2.3 note probe: one-line stacked height + max-content width -- */
    const noteProbe = await page.evaluate(() => {
      const note = document.querySelector('.react-flow__node[data-id="nt"] .note-node');
      const body = note.querySelector('.note-body');
      const cs = getComputedStyle(note);
      const prevW = body.style.width;
      body.style.width = 'max-content';
      const w = body.scrollWidth;
      body.style.width = prevW;
      const kids = [...body.children].filter(c => c.offsetParent !== null);
      const stackH = kids.reduce((a, c) => Math.max(a, Math.ceil(c.getBoundingClientRect().height)), 0);
      const noteBox = note.getBoundingClientRect();
      return {
        cssMinW: cs.minWidth, font: `${cs.fontSize}/${cs.lineHeight}`,
        pad: cs.padding, maxContentW: w, stackH,
        padTop: parseFloat(cs.paddingTop) || 0, padBottom: parseFloat(cs.paddingBottom) || 0,
        padLeft: parseFloat(cs.paddingLeft) || 0, padRight: parseFloat(cs.paddingRight) || 0,
        borderLeft: parseFloat(cs.borderLeftWidth) || 0,
        boxH: Math.ceil(noteBox.height), boxW: Math.ceil(noteBox.width),
      };
    });
    const measuredNoteH = noteProbe.stackH + noteProbe.padTop + noteProbe.padBottom;
    const measuredNoteW = noteProbe.maxContentW + noteProbe.padLeft + noteProbe.padRight;
    console.log(`  measured one-line note: stacked text ${noteProbe.stackH}px + padding ${noteProbe.padTop}+${noteProbe.padBottom} = ${measuredNoteH}px tall; max-content ${noteProbe.maxContentW} + side padding = ${measuredNoteW}px wide (CSS min-width ${noteProbe.cssMinW}, font ${noteProbe.font})`);
    assert('bf2.probe.note-one-line-measured',
      Number.isFinite(measuredNoteH) && measuredNoteH > 0,
      `one-line note measures ${measuredNoteH}px tall — the spec's 44 floor ${measuredNoteH <= 44 ? 'COVERS' : 'is BELOW the measured value (NOTE_MIN_H takes ' + measuredNoteH + ' per §2.3)'}`);

    /* ---- LIVE drag helpers -------------------------------------------- *
     * CORNER grips only, measured: the mid-edge LINE controls' centres are
     * covered by the connection dots (`.react-flow__handle-*`, z-index 5 —
     * elementFromPoint at a line centre returns the handle), so a mouse.down
     * there starts a CONNECTION, not a resize. The corner controls are on top
     * (hitIsSelf true). A corner drag with dLayoutY = 0 changes width only:
     * distY = floor(0) = 0 in getDimensionsAfterResize, so height is written
     * back unchanged. Position class names are SPLIT ("top right"), so the
     * selector chains both. Pointer deltas are SCREEN px; layout is scaled by
     * the viewport zoom, so a layout delta is divided by the live zoom. */
    const zoom = async () => await page.evaluate(() => {
      const t = document.querySelector('.react-flow__viewport')?.style.transform ?? '';
      const m = /scale\(([\d.]+)\)/.exec(t);
      return m ? +m[1] : 1;
    });
    const sizeOf = (id) => page.evaluate((nid) => {
      const w = document.querySelector(`.react-flow__node[data-id="${nid}"]`);
      return {w: w.offsetWidth, h: w.offsetHeight};
    }, id);
    const dragGrip = async (id, side, dLayoutX, dLayoutY, steps = 10) => {
      const g = await page.locator(
        `.react-flow__node[data-id="${id}"] .react-flow__resize-control.handle.${side.replace(/ /g, '.')}`).boundingBox();
      if (!g) throw new Error(`corner grip ${side} not found on ${id}`);
      const z = await zoom();
      const cx = g.x + g.width / 2, cy = g.y + g.height / 2;
      await page.mouse.move(cx, cy);
      await page.mouse.down();
      const start = await sizeOf(id);
      const frames = [];
      for (let i = 1; i <= steps; i++) {
        await page.mouse.move(cx + (dLayoutX * i) / steps / z, cy + (dLayoutY * i) / steps / z, {steps: 1});
        await page.waitForTimeout(30);
        frames.push(await sizeOf(id));
      }
      await page.mouse.up();
      await page.waitForTimeout(200);
      return {start, frames, end: await sizeOf(id), zoom: z};
    };
    const select = async (id) => {
      await page.click(`.react-flow__node[data-id="${id}"]`);
      await page.waitForTimeout(250);
    };

    /* ---- AC7: the connector reload jerk -------------------------------- */
    console.log('\n-- AC7: connector 152x152 (persisted explicit size), right LINE grip --');
    await select('cx');
    const ac7 = await dragGrip('cx', 'top right', -120, 0, 10);
    const firstFrame = ac7.frames[0];
    const implied = ac7.start.w + (-120 / 10);
    const hDeltas = ac7.frames.map(f => f.h - ac7.start.h);
    console.log(`  zoom ${ac7.zoom}; start ${ac7.start.w}x${ac7.start.h}; frames W: [${ac7.frames.map(f => f.w).join(', ')}]`);
    assert('bf2.ac7.no-first-event-folded-jump',
      Math.abs(ac7.start.w - 152) <= 1 && firstFrame.w < ac7.start.w
        && Math.abs(firstFrame.w - implied) <= 4 && Math.abs(firstFrame.w - implied) < 8,
      `start ${ac7.start.w}x${ac7.start.h}; FIRST drag frame ${firstFrame.w} vs pointer-implied ${implied} (|Δ| ≤ 4, sub-pixel zoom rounding) — pre-change the shipped math writes ${dragLib(152, 152, 'right', -12, 0, 200, 141).width} on this frame (the folded clamp)`);
    assert('bf2.ac7.height-delta-0-across-10-steps',
      hDeltas.every(d => Math.abs(d) <= 1),
      `height deltas across 10 frames: [${hDeltas.join(', ')}] (start ${ac7.start.h} → end ${ac7.end.h}) — a horizontal drag never touches height`);
    assert('bf2.ac7.connector-stops-at-64',
      Math.abs(ac7.end.w - 64) <= 2,
      `after a -120px drag the connector rests at ${ac7.end.w} wide — floored at 64, not 200 (pre-change stop: 200)`);

    /* ---- AC7b (slice B): the TEXT-CARD reload snap on the width axis ------- *
     * A reloaded process node carries an explicit 196px width; the AQ15
     * measurement bailed (explicit size), so naturalWRef = 0 and the floor is
     * the full 200. The first shrink event GROWS the node to 200 (the reload
     * snap, §2.4). With the drag-start re-measure the floor becomes
     * max(190, min(200, natural)) <= 196 and the first frame shrinks. */
    console.log('\n-- AC7b: process 290x145 reloaded (explicit size), shrink from 196 --');
    await page.evaluate(() => {
      const wrap = document.querySelector('.react-flow__node[data-id="pr"]');
      wrap.style.width = '196px';
    });
    await page.waitForTimeout(300);
    await page.keyboard.press('Escape');
    await page.waitForTimeout(150);
    await select('pr');
    const ac7b = await dragGrip('pr', 'top right', -60, 0, 10);
    console.log(`  start ${ac7b.start.w}; W frames: [${ac7b.frames.map(f => f.w).join(', ')}]`);
    assert('bf2.ac7b.text-card-reload-no-first-event-grow',
      Math.abs(ac7b.start.w - 196) <= 2 && ac7b.frames[0].w <= ac7b.start.w + 1,
      `start ${ac7b.start.w}; FIRST frame ${ac7b.frames[0].w} (pre-slice-B the 200 floor GROWS a 196px node on the first SHRINK event — the §2.4 reload snap)`);

    /* ---- AC8: process 290x145 — no drift, and the floor still holds ------- */
    console.log('\n-- AC8: process 290x145, right grip then bottom grip --');
    await select('pr');
    const ac8h = await dragGrip('pr', 'top right', -120, 0, 10);
    const hD8 = ac8h.frames.map(f => f.h - ac8h.start.h);
    console.log(`  start ${ac8h.start.w}x${ac8h.start.h}; W frames: [${ac8h.frames.map(f => f.w).join(', ')}]`);
    assert('bf2.ac8.height-stays-145-horizontal',
      Math.abs(ac8h.start.h - 145) <= 1 && hD8.every(d => Math.abs(d) <= 1),
      `start ${ac8h.start.w}x${ac8h.start.h}; height deltas [${hD8.join(', ')}] across 10 frames — no drift toward 141 on a horizontal drag`);
    const ac8v = await dragGrip('pr', 'bottom left', 0, -80, 10);
    console.log(`  bottom grip -80: H frames: [${ac8v.frames.map(f => f.h).join(', ')}]`);
    assert('bf2.ac8.shrink-drag-stops-at-141',
      Math.abs(ac8v.end.h - 141) <= 2,
      `a deliberate shrink drag ends at height ${ac8v.end.h} — the 141 floor still binds (the ROUND S invariant survives)`);

    /* ---- AC9: note drags below 200 and stops at 130 ----------------------- */
    console.log('\n-- AC9: note 200x90, right grip, shrink past 200 --');
    await select('nt');
    const ac9 = await dragGrip('nt', 'top right', -110, 0, 10);
    console.log(`  start ${ac9.start.w}; W frames: [${ac9.frames.map(f => f.w).join(', ')}]; end ${ac9.end.w}`);
    assert('bf2.ac9.note-resizes-past-200-and-stops-at-130',
      Math.abs(ac9.end.w - 130) <= 2,
      `the note shrinks to ${ac9.end.w} wide (target 130; pre-change it stopped at 200 — floor min(200, natural=0))`);

    /* ---- AC10: connector at 64x64 wraps, no spill -------------------------- */
    console.log('\n-- AC10: connector at 64x64, label wrap --');
    await select('cx');
    const ac10drag = await dragGrip('cx', 'bottom left', 0, -120, 10);
    await page.waitForTimeout(400);
    /* offsetWidth/offsetHeight (layout px, zoom-independent) for the size;
       the spill comparison divides both rect edges by the live zoom so a
       screen-px rect at zoom != 1 still compares like-for-like. */
    const spill = await page.evaluate(() => {
      const wrap = document.querySelector('.react-flow__node[data-id="cx"]');
      const body = wrap.querySelector('.node-body, .lo-body');
      const zoom = (/scale\(([\d.]+)\)/.exec(document.querySelector('.react-flow__viewport')?.style.transform ?? '') ?? [])[1] ?? 1;
      const box = wrap.getBoundingClientRect();
      const kids = [...body.children].filter(c => c.offsetParent !== null);
      const last = kids[kids.length - 1];
      if (!last) return {spill: 0, size: `${wrap.offsetWidth}x${wrap.offsetHeight}`, note: 'no content child', zoom};
      return {
        spill: Math.ceil((last.getBoundingClientRect().right - box.right) / zoom),
        size: `${wrap.offsetWidth}x${wrap.offsetHeight}`,
        note: last.className || last.tagName,
        zoom,
      };
    });
    assert('bf2.ac10.connector-at-64-wraps-no-spill',
      spill.size === '64x64' && spill.spill <= 0,
      `connector at ${spill.size} (layout px): last content child (${spill.note}) right edge is ${spill.spill <= 0 ? 'inside' : spill.spill + 'px OUTSIDE'} the box (spill ${spill.spill}px, zoom ${spill.zoom}); after drag: ${ac10drag.end.w}x${ac10drag.end.h}`);
  } finally {
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
console.log(`\nround-bf-floors: ${results.length - fails.length}/${results.length} assertions pass`);
if (fails.length) {
  console.log('FAILED:');
  for (const f of fails) console.log(`  ${f.id} — ${f.detail}`);
}
process.exit(fails.length ? 1 : 0);
