#!/usr/bin/env node
/**
 * PACKAGE-O measurement harness — REAL font metrics + REAL stylesheet values.
 *
 * WHY THIS EXISTS: this pass runs with no browser and no DOM. Every numeric
 * claim in the report has to come out of something reproducible, so this file
 * computes text advance widths from the actual font tables on disk (fontTools
 * data exported to JSON) and reads the actual CSS declarations out of
 * `src/styles.css`. Nothing here is a guess dressed up as a measurement.
 *
 * WHAT IT IS NOT: a layout engine. It models the handful of box rules that
 * decide ONE question per surface — does this row fit on one line, and does
 * this popup overflow its anchor. Every modelled rule is quoted with its CSS
 * line so a reader can check the model against the sheet.
 */
import {readFileSync, writeFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';

const ROOT = '/home/harvey/projects/tech-goblin/lab/diagram-studio';
const CSS = readFileSync(`${ROOT}/src/styles.css`, 'utf8').split('\n');
const APP = readFileSync(`${ROOT}/src/App.tsx`, 'utf8').split('\n');

/* ---------------------------------------------------------------------------
   Font metrics. A tiny python probe reads hmtx out of a TTF and prints the
   unitsPerEm + advance for every ASCII codepoint we need, as JSON. Cached per
   font file because the probe costs ~120ms.
-------------------------------------------------------------------------- */
const metricCache = new Map();
function fontMetrics(path) {
  if (metricCache.has(path)) return metricCache.get(path);
  const py = `
import json,sys
from fontTools.ttLib import TTFont
f=TTFont(sys.argv[1], lazy=True)
upm=f['head'].unitsPerEm
cmap=f.getBestCmap()
hmtx=f['hmtx']
out={}
for ch in sys.argv[2]:
    cp=ord(ch)
    g=cmap.get(cp)
    out[ch]= (hmtx[g][0]/upm) if g else None
print(json.dumps({'upm':upm,'adv':out,'name':f['name'].getDebugName(1)}))
`;
  const chars = [...new Set('abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 .,/%·—–-=+()[]{}<>:;!?#&*\'"`~/\\|@$^_'
    + '⌘⇧↑↓←→\\').values()].join('');
  const raw = execFileSync('python3', ['-', path, chars], {input: py, encoding: 'utf8'});
  const m = JSON.parse(raw);
  m.ratio = Object.fromEntries(Object.entries(m.adv).map(([k, v]) => [k, v]));
  delete m.adv;
  metricCache.set(path, m);
  return m;
}

/** Width of `text` at `px` in the given font file. Advance widths summed, which
 *  is what a browser does for a single unkerned run; DejaVu/Menlo carry no
 *  kerning pairs for these strings, so the sum is exact to <0.5px. */
function textWidth(text, px, fontPath) {
  const m = fontMetrics(fontPath);
  let em = 0;
  const missing = [];
  for (const ch of text) {
    const r = m.ratio[ch];
    if (r == null) { missing.push(ch); continue; }
    em += r;
  }
  return {px: em * px, missing};
}

/* The real stacks, from styles.css:61-62. On this Linux box the generic
   `monospace` resolves to DejaVu Sans Mono (0.602 em advance); on Harvey's Mac
   it resolves to Menlo (0.6023 em). We measure the WORST CASE across the
   candidates so a width that fits here fits there. */
const MONO_CANDIDATES = [
  ['/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf', 'DejaVu Sans Mono (linux monospace)'],
  ['/usr/share/fonts/truetype/liberation/LiberationMono-Regular.ttf', 'Liberation Mono'],
  ['/usr/share/fonts/truetype/freefont/FreeMono.ttf', 'FreeMono'],
  ['/usr/share/fonts/truetype/noto/NotoSansMono-Regular.ttf', 'Noto Sans Mono'],
];
const SANS_CANDIDATES = [
  ['/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf', 'DejaVu Sans (linux sans-serif)'],
  ['/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf', 'Liberation Sans'],
];

/** Widest advance ratio for `ch` across candidates, and which font won. */
function worstRatio(ch, cands) {
  let best = 0, who = null;
  for (const [p, n] of cands) {
    const r = fontMetrics(p).ratio[ch];
    if (r != null && r > best) { best = r; who = n; }
  }
  return {ratio: best, who};
}
function worstTextWidth(text, px, cands) {
  let w = 0, who = null;
  for (const ch of text) {
    const {ratio: r, who: n} = worstRatio(ch, cands);
    if (n) who = n;
    w += r * px;
  }
  return {px: w, who};
}

/* ---------------------------------------------------------------------------
   Read the actual CSS declarations we model.
-------------------------------------------------------------------------- */
/** Read a rule's declarations. A single source line can carry SEVERAL
 *  declarations (`border-radius: 10px; padding: 10px 12px;`), so this splits on
 *  `;` inside the block rather than assuming one declaration per line.
 *  COMMENTS ARE STRIPPED FIRST: a block-level comment often CONTAINS colons and
 *  quoted values (`Harvey: "…"`, `width: 280px`), and leaving it in makes the
 *  declaration parser read prose as a declaration. */
function stripComments(s) { return s.replace(/\/\*[\s\S]*?\*\//g, ''); }
function cssBlock(sel) {
  const i = CSS.findIndex(l => l.trim() === sel + ' {');
  if (i < 0) return {notfound: true};
  const out = {};
  const body = [];
  for (let j = i + 1; j < CSS.length; j++) {
    const l = CSS[j];
    if (/^\}/.test(l.trim())) break;
    body.push(l);
  }
  for (const decl of stripComments(body.join('\n')).split(';')) {
    const m = /([a-z-]+):\s*([\s\S]+)/.exec(decl.trim());
    if (m) out[m[1]] = m[2].replace(/\s+/g, ' ').trim();
  }
  return {decls: out, line: i + 1};
}
function pxOf(v) {
  const m = /([\d.]+)px/.exec(v || '');
  if (m) return +m[1];
  /* CSS allows a UNITLESS zero (`min-width: 0`), which is a real length and not
     "no length" — returning null for it made `.boards-pop`'s explicit
     cancellation read as an ABSENT declaration, i.e. indistinguishable from
     never having written it. Only 0 is treated this way; every other unitless
     number is not a length and still returns null. */
  if (/^\s*0(\.0+)?\s*$/.test(String(v ?? ''))) return 0;
  return null;
}
/** N-th value of a shorthand (`14px 16px 12px` -> [14,16,12]). */
function shorthands(v) { return String(v || '').trim().split(/\s+/).map(pxOf).filter(x => x != null); }

const results = [];
const ok = (id, pass, detail) => results.push({id, pass, detail});

/* ===========================================================================
   ITEM 3 — .help-pop single-line rows at 1280x800
   ===========================================================================
   The rows are read out of App.tsx so the measurement follows the source, not a
   transcription of it. */
const helpPop = cssBlock('.help-pop');
const helpRow = cssBlock('.help-row');
const helpKeys = cssBlock('.help-keys');
const kbdRule = cssBlock('kbd');

const helpRows = [];
for (const l of APP) {
  const t = l.trim();
  if (!t.startsWith('<div className="help-row">')) continue;
  const label = /<span>([^<]*?)(?:<span className="help-hint">([^<]*)<\/span>)?<\/span>/.exec(t);
  const keys = [...t.matchAll(/<kbd>(.*?)<\/kbd>/g)].map(m => m[1]);
  const gestures = [...t.matchAll(/<span className="gesture-token">(.*?)<\/span>/g)].map(m => m[1]);
  if (label) helpRows.push({label: label[1], hint: label[2] || null, keys, gestures});
}

const popPadX = shorthands(helpPop.decls.padding)[1] ?? 12;
const popBorder = pxOf(helpPop.decls.border) ?? 1;
const rowGap = pxOf(helpRow.decls.gap) ?? 10;
const keysGap = pxOf(helpKeys.decls.gap) ?? 4;
const kbdPadX = 7, kbdBorder = 1, kbdMinW = 22;

function chipOuterWidth(text) {
  const {px} = worstTextWidth(text, 11, MONO_CANDIDATES);
  // box-sizing: border-box → outer = max(min-width, content + padding + border)
  return Math.max(kbdMinW, px + kbdPadX * 2 + kbdBorder * 2);
}
function rowRequiredWidth(r, availableWidth) {
  // label column: max-content of the label + its hint (block, so max of the two)
  const lw = worstTextWidth(r.label, 12, SANS_CANDIDATES).px;
  const hw = r.hint ? worstTextWidth(r.hint, 10.5, MONO_CANDIDATES).px : 0;
  const labelCol = Math.max(lw, hw);
  let keyCol = 0;
  if (r.keys.length) keyCol = r.keys.reduce((s, k) => s + chipOuterWidth(k), 0) + keysGap * (r.keys.length - 1);
  if (r.gestures.length) keyCol = Math.max(...r.gestures.map(g => worstTextWidth(g, 11, MONO_CANDIDATES).px));
  return {labelCol, keyCol, total: labelCol + rowGap + keyCol};
}

function analyseHelpPop(width) {
  const inner = width - popPadX * 2 - popBorder * 2;
  const rows = helpRows.map(r => {
    const req = rowRequiredWidth(r);
    return {...r, ...req, fits: req.total <= inner};
  });
  return {width, inner, rows, over: rows.filter(r => !r.fits)};
}

console.log('='.repeat(78));
console.log('ITEM 3 — .help-pop row wrapping');
console.log('='.repeat(78));
console.log(`.help-pop width        = ${pxOf(helpPop.decls.width)}px   (styles.css:${helpPop.line})`);
console.log(`.help-pop padding      = ${helpPop.decls.padding}`);
console.log(`.help-pop border       = ${popBorder}px`);
const before = analyseHelpPop(pxOf(helpPop.decls.width));
console.log(`inner content box      = ${before.inner}px`);
console.log(`rows found             = ${before.rows.length}`);
console.log(`WRAPPING rows (before) = ${before.over.length}`);
for (const r of before.rows) {
  console.log(`  ${r.fits ? ' ' : '!'} ${String(Math.round(r.total)).padStart(4)}px  ${r.label}${r.hint ? ' [hint]' : ''}  keys=[${r.keys.join(' ')}]`);
}
const widest = Math.max(...before.rows.map(r => r.total));
console.log(`widest single-line requirement = ${Math.round(widest)}px  (+ pad/border -> ${Math.round(widest + popPadX * 2 + popBorder * 2)}px popover)`);
const requiredPopWidth = Math.ceil(widest) + popPadX * 2 + popBorder * 2;
ok('item3.widest-requirement-recorded', true, `${Math.round(widest)}px`);

/* The phone tier MUST keep overriding width/left/right, or the 340px desktop
   box would spill on a 360px screen. Read as a real block out of the sheet. */
function cssBlockAnywhere(sel, marker) {
  const lines = CSS;
  const i = lines.findIndex(l => l.includes(sel) && l.includes(marker));
  if (i < 0) return null;
  const body = [];
  for (let j = i + 1; j < lines.length; j++) {
    if (/^\}/.test(lines[j].trim())) break;
    body.push(lines[j]);
  }
  return {decls: Object.fromEntries(body.join('\n').split(';').map(d => {
    const m = /([a-z-]+):\s*([\s\S]+)/.exec(d.replace(/\/\*[\s\S]*?\*\//g, '').trim());
    return m ? [m[1], m[2].replace(/\s+/g, ' ').trim()] : null;
  }).filter(Boolean)), line: i + 1};
}
const phoneHelp = cssBlockAnywhere('.help-pop', 'data-form-factor="phone"');
console.log(`phone tier .help-pop { ${JSON.stringify(phoneHelp?.decls)} }   [styles.css:${phoneHelp?.line}]`);

/* The max-height + vertical-scroll guard must survive the widening. */
const guardHeight = helpPop.decls['max-height'];
const guardY = helpPop.decls['overflow-y'];
const guardX = helpPop.decls['overflow-x'];
console.log(`guard: max-height=${guardHeight}  overflow-y=${guardY}  overflow-x=${guardX}`);

/* ===========================================================================
   ITEM 6a — .boards-pop overflow past the Boards button
   =========================================================================== */
const popRule = cssBlock('.pop');
const boardsPop = cssBlock('.boards-pop');
console.log('\n' + '='.repeat(78));
console.log('ITEM 6a — .boards-pop alignment');
console.log('='.repeat(78));
console.log(`.pop                   right=${popRule.decls.right} min-width=${popRule.decls['min-width']}   (.pop at styles.css:${popRule.line})`);
console.log(`.boards-pop            left=${boardsPop.decls.left} right=${boardsPop.decls.right} min-width=${boardsPop.decls['min-width']}   (styles.css:${boardsPop.line})`);

/* The anchor is the button: `.panel-head` padding is 14px 16px, so the button's
   containing block is the panel width minus 32px. */
const panelHead = cssBlock('.panel-head');
const [phPadY, phPadX] = shorthands(panelHead.decls.padding);
/* `.panel-head` is `position: relative`, which is what makes it the containing
   block for the absolutely-positioned popup; `.panel` is `overflow: hidden`, so
   anything wider than the head is CLIPPED, not just misaligned. Both are read
   from the sheet rather than assumed. */
const panelRule = cssBlock('.panel');
function boardsGeom(panelWidth) {
  const btnW = panelWidth - phPadX * 2;
  /* Model the real box resolution. `.boards-pop` sets `left: 0; right: 0` so both
     edges are pinned to the button's box, and its `min-width: 0` cancels
     `.pop`'s `min-width: 168px` floor. The effective floor is therefore this
     rule's own value when it is a positive length, else nothing:
       - floor absent/0 -> the popup resolves to the button width, overflow 0
       - floor positive -> the floor wins and the box overflows by (floor - button)
     The regression this guards: removing `min-width: 0` silently reinstates
     `.pop`'s 168px floor, which must FAIL this assertion on a narrow tier. */
  const ownMinW = pxOf(boardsPop.decls['min-width']);         // 0 when "0"
  const popFloor = (ownMinW && ownMinW > 0) ? ownMinW : 0;
  /* The INHERITED floor: if this rule does not cancel it, `.pop`'s own
     `min-width` applies and becomes the effective floor. Modelled explicitly so a
     deleted `min-width: 0` shows up as the 168px it really is, not as 0. */
  const inherited = ownMinW == null ? (pxOf(popRule.decls['min-width']) ?? 0) : 0;
  const floor = Math.max(popFloor, inherited);
  const popW = Math.max(btnW, floor);
  /* Clipping: the popup hangs off `.panel-head` (its containing block) and the
     panel clips. Horizontal spill past the HEAD's own box is what the panel's
     `overflow: hidden` would eat. */
  const headRight = panelWidth - phPadX;   // head's padding box right edge
  const clipRight = Math.max(0, popW - btnW);
  return {panelWidth, btnW, ownMinW, inherited, floor, popW, overflow: popW - btnW, clipRight, headRight};
}
/* 231 is the REPORTED case, made exact: Harvey's panel laid the button out at
   199px, so the panel was 199 + 2×16 = 231px. The old 240px floor overflowed it
   by 41px. 232/200 are the canonical tiers from the previous pass. */
const BOARD_TIERS = [232, 231, 200];
for (const pw of BOARD_TIERS) {
  const g = boardsGeom(pw);
  console.log(`panel ${pw}px -> button ${g.btnW}px, popup ${g.popW}px, overflow right = ${g.overflow}px, clipped by panel = ${g.clipRight}px`);
}
ok('item6a.overflow-before-recorded', true, `${boardsGeom(232).overflow}px @ 232 panel`);

/* The SECOND `.pop` user (the Export/Import dropdown in the canvas toolbar) must
   keep the shared base untouched: it is NOT overridden, so it still anchors right
   with its own 168px floor. Read from the sheet so deleting the base rule fails. */
const otherPopUsers = APP.filter(l => /className="pop"/.test(l)).length;
console.log(`\n.pop base (shared by the Export dropdown): right=${popRule.decls.right} min-width=${popRule.decls['min-width']}   (.pop at styles.css:${popRule.line})`);
console.log(`elements using the BARE .pop class (no boards-pop): ${otherPopUsers}`);
console.log(`.boards-pop cancels it ? left=${boardsPop.decls.left} right=${boardsPop.decls.right} min-width=${boardsPop.decls['min-width']}`);
console.log(`.panel overflow = ${panelRule.decls.overflow ?? panelRule.decls['overflow-y'] ?? '(none)'} — the clip that makes overflow matter`);

/* ===========================================================================
   ITEM 4 — shape hint lengths + uniqueness
   =========================================================================== */
console.log('\n' + '='.repeat(78));
console.log('ITEM 4 — shape hints');
console.log('='.repeat(78));
const shapes = readFileSync(`${ROOT}/src/shapes.tsx`, 'utf8').split('\n');
const SHAPE_HINTS = [];
for (const l of shapes) {
  const m = /\{id: '([^']+)', label: '([^']+)', hint: '([^']+)'\}/.exec(l);
  if (m) SHAPE_HINTS.push({id: m[1], label: m[2], hint: m[3], line: shapes.indexOf(l) + 1});
}
console.log(`SHAPES entries: ${SHAPE_HINTS.length}`);
for (const s of SHAPE_HINTS) {
  const repeatsLabel = s.hint.toLowerCase().includes(s.label.toLowerCase());
  console.log(`  ${s.id.padEnd(14)} ${String(s.hint.length).padStart(3)}ch  repeatsLabel=${repeatsLabel ? 'YES' : 'no '}  "${s.hint}"`);
}
const dupes = Object.entries(SHAPE_HINTS.reduce((a, s) => (a[s.hint] = (a[s.hint] || 0) + 1, a), {}))
  .filter(([, n]) => n > 1);
console.log(`duplicate hints: ${dupes.length}`);
const tooLong = SHAPE_HINTS.filter(s => s.hint.length > 32);
console.log(`hints over 32 chars: ${tooLong.length}`);

/* ===========================================================================
   ITEM 4 (continued) — every hint table this pass touched, read from source.

   THREE shapes of declaration exist, so a single regex cannot see them all:
     1. PALETTE entries in `palette.ts` — `label: '…', hint: '…'` on one line,
        with `aliases`/`geometry` on the FOLLOWING lines (a window parse).
     2. `fc(...)` flowchart rows in `presets.ts` — everything on one line.
     3. the C4 map in `presets.ts` — `person: {… hint: '…'}`, no `label` field
        (the palette label is derived from `kicker` by `c4PaletteItem`), and no
        `aliases`/`geometry` at all.
   `Note` is ONE shared object reached from three tables, so a repeated hint
   string is expected for it and only for it.
   =========================================================================== */
const libItems = [];
function pushItem(o) { libItems.push(o); }

/** Window parse for PALETTE entries: the entry body spans several lines. */
{
  const lines = readFileSync(`${ROOT}/src/palette.ts`, 'utf8').split('\n');
  for (let i = 0; i < lines.length; i++) {
    const m = /label: '([^']*)', hint: '([^']*)'/.exec(lines[i]);
    if (!m) continue;
    const win = lines.slice(i, i + 4).join(' ');
    pushItem({
      file: 'src/palette.ts', line: i + 1, label: m[1], hint: m[2],
      aliases: /aliases: \[([^\]]*)\]/.exec(win)?.[1] ?? '',
      geometry: /geometry: '([^']*)'/.exec(win)?.[1] ?? '',
    });
  }
}
/** `fc(...)` rows + the Lane / Table / Note (enum) object literals. */
{
  const lines = readFileSync(`${ROOT}/src/presets.ts`, 'utf8').split('\n');
  for (let i = 0; i < lines.length; i++) {
    const fc = /fc\('([^']*)', '([^']*)',/.exec(lines[i]);
    if (fc) {
      const tail = lines[i].slice(lines[i].indexOf('FLOW,'));
      pushItem({
        file: 'src/presets.ts', line: i + 1, label: fc[1], hint: fc[2],
        aliases: /\[([^\]]*)\]/.exec(tail)?.[1] ?? '',
        geometry: /FLOW, \[[^\]]*\], '([^']*)'/.exec(lines[i])?.[1] ?? '',
      });
      continue;
    }
    const lit = /label: '([^']*)', hint: '([^']*)'/.exec(lines[i]);
    if (lit) {
      const win = lines.slice(i, i + 3).join(' ');
      pushItem({
        file: 'src/presets.ts', line: i + 1, label: lit[1], hint: lit[2],
        aliases: /aliases: \[([^\]]*)\]/.exec(win)?.[1] ?? '',
        geometry: /geometry: '([^']*)'/.exec(win)?.[1] ?? '',
      });
    }
  }
}
/** The C4 map. Label comes from `kicker` the same way `c4PaletteItem` does. */
{
  const lines = readFileSync(`${ROOT}/src/presets.ts`, 'utf8').split('\n');
  for (let i = 0; i < lines.length; i++) {
    const m = /^\s*(\w+):\s*\{level:.*kicker: '([^']*)',.*hint: '([^']*)'/.exec(lines[i]);
    if (!m) continue;
    pushItem({
      file: 'src/presets.ts', line: i + 1, key: m[1],
      label: m[2].replace(/[[\]]/g, ''), hint: m[3],
      aliases: '', geometry: '', c4: true,
    });
  }
}

console.log('\n' + '='.repeat(78));
console.log('ITEM 4 — every hint table this pass touched');
console.log('='.repeat(78));
console.log(`entries parsed: ${libItems.length}`);
for (const e of libItems.slice().sort((a, b) => b.hint.length - a.hint.length)) {
  const repeats = e.hint.toLowerCase().includes(e.label.toLowerCase());
  console.log(`  ${String(e.hint.length).padStart(3)}ch  ${e.label.padEnd(26)} ${e.hint}${repeats ? '   <- repeats label' : ''}`);
}
/** The search haystack, exactly as `paletteSearch.ts:31` builds it. */
const searchable = e => [e.label, e.hint, e.aliases, e.geometry].join(' ').toLowerCase();

const libDupes = Object.entries(libItems.reduce((a, e) => (a[e.hint] = (a[e.hint] || 0) + 1, a), {}))
  .filter(([, n]) => n > 1);
console.log(`duplicate hint strings: ${libDupes.length}`);
for (const [h, n] of libDupes) console.log(`  x${n}  "${h}"`);
const libRepeats = libItems.filter(e => e.hint.toLowerCase().includes(e.label.toLowerCase()));
console.log(`hints that repeat their own label: ${libRepeats.length}${libRepeats.length ? ' -> ' + libRepeats.map(e => e.label).join(', ') : ''}`);

/* SEARCH COVERAGE. Every word below was REMOVED from a hint in this pass, and
   each must still resolve through the surviving haystack. The pairs are real
   `label -> query` pairs taken from the LIBRARY, so a wrong label shows up as a
   gap rather than passing silently.
   RE-ANCHORED (QUEUE_ENABLED, 2026-10-22) — NOT WEAKENED, the reason is
   recorded. OLD CLAIM: the `['Queue', 'topic']` pair proved Queue's retired
   search word `topic` (now in its `aliases`) still resolves through the
   haystack, so dropping `topic` from a hint could never strand the shape.
   NEW CLAIM: the same alias-protection machinery holds for every shape that is
   still OFFERED. REASON: HARVEY hid Queue behind `QUEUE_ENABLED = false` in
   `src/presets.ts` (mirroring C4_ENABLED/SEQUENCE_ENABLED), so Queue left the
   CREATE surfaces — the panel sections, the omnibox and the insert modal all
   read `LIBRARY`, which now filters it out. An assertion that the hidden row
   is still findable by search asserts a fact the round deliberately falsified
   (it would only pass again if the flag were flipped, which is the restore
   path, not a regression). The row is therefore REPLACED by a positive gating
   assertion below (`itemA.queue-is-flag-gated-from-the-create-surfaces`) that
   records the hide itself; flipping the flag makes THIS list's old pair
   green again and the gating assertion red, which is the correct pairing. */
const SEARCH_REGRESSION = [
  ['External', 'third'], ['Storage', 'object'],
  ['Group', 'vpc'], ['Group', 'cluster'], ['Note', 'annotation'],
  ['Terminal', 'terminator'], ['Terminal', 'start'], ['Terminal', 'end'],
  ['Predefined process', 'subprocess'], ['Predefined process', 'defined'],
  ['Preparation', 'init'], ['Preparation', 'initialization'], ['Preparation', 'hexagon'],
  ['Manual operation', 'manual'], ['Manual operation', 'person'],
  ['On-page connector', 'on-page'], ['On-page connector', 'jump'],
  ['Document', 'produced'], ['Actor', 'person'],
  ['Service', 'application'], ['Lane', 'system'],
  ['Container: application', 'application'],
  ['Container: object store', 'object store'],
];
const coverageGaps = [];
for (const [label, word] of SEARCH_REGRESSION) {
  const e = libItems.find(i => i.label === label);
  if (!e) { coverageGaps.push([label, word, 'LABEL NOT FOUND']); continue; }
  if (!searchable(e).includes(word.toLowerCase())) coverageGaps.push([label, word, 'not in haystack']);
}
for (const [label, word, why] of coverageGaps) console.log(`  ! ${label} not findable by "${word}" (${why})`);

/* ===========================================================================
   ASSERTIONS
   =========================================================================== */
console.log('\n' + '='.repeat(78));
console.log('ASSERTIONS');
console.log('='.repeat(78));
const asserts = [];
const assert = (id, pass, detail) => {
  asserts.push({id, pass, detail});
  console.log(`  ${pass ? 'PASS' : 'FAIL'}  ${id}${detail ? '  — ' + detail : ''}`);
};

// --- ITEM 3 -----------------------------------------------------------------
const after = analyseHelpPop(pxOf(helpPop.decls.width));
console.log(`\nAFTER: .help-pop width = ${after.width}px, inner = ${after.inner}px`);
for (const r of after.rows) {
  console.log(`  ${r.fits ? ' ' : '!'} ${String(Math.round(r.total)).padStart(4)}px  ${r.label}${r.hint ? ' [hint]' : ''}`);
}
assert('item3.0-rows-wrap', after.over.length === 0,
  `${after.over.length} wrapping row(s) at ${after.width}px`);
assert('item3.width-covers-widest-requirement', pxOf(helpPop.decls.width) >= requiredPopWidth,
  `width ${pxOf(helpPop.decls.width)}px >= required ${requiredPopWidth}px`);
assert('item3.vertical-scroll-guard-kept',
  !!guardHeight && guardY === 'auto' && guardX === 'hidden',
  `max-height=${guardHeight}, overflow-y=${guardY}, overflow-x=${guardX}`);
assert('item3.phone-tier-still-overrides',
  !!phoneHelp && phoneHelp.decls.width === 'auto' && phoneHelp.decls.left != null && phoneHelp.decls.right != null,
  phoneHelp ? `width=${phoneHelp.decls.width} left=${phoneHelp.decls.left} right=${phoneHelp.decls.right}` : 'no phone rule');

// --- ITEM 6a ----------------------------------------------------------------
// Overflow must be 0: the popup can never be wider than the button it hangs off.
const overflows = BOARD_TIERS.map(pw => boardsGeom(pw).overflow);
const maxOverflow = Math.max(...overflows);
assert('item6a.overflow-0', maxOverflow <= 0,
  `overflow ${JSON.stringify(overflows)} at panel widths ${JSON.stringify(BOARD_TIERS)}`);
// The exact reported case: a 199px button (panel 231px). The old 240px floor
// gave 41px here — this assertion is the regression, stated as the number Harvey
// saw, so a re-introduced floor fails with the same 41 it was reported with.
assert('item6a.reported-41px-case-is-0', boardsGeom(231).overflow === 0,
  `panel 231px -> button ${boardsGeom(231).btnW}px, overflow ${boardsGeom(231).overflow}px (was 240-199 = 41px)`);
// Nothing may be clipped by the panel either — a popup that fits the button but
// is painted past the panel's own clip would be invisible, not merely offset.
assert('item6a.not-clipped-by-panel', BOARD_TIERS.every(pw => boardsGeom(pw).clipRight === 0),
  BOARD_TIERS.map(pw => `${pw}:${boardsGeom(pw).clipRight}px`).join(' '));
// The popup's own floor must be an EXPLICIT cancellation of the base, not a
// coincidence: if `.boards-pop` ever drops `min-width`, this fails with the
// inherited 168 it would really resolve to.
assert('item6a.boards-pop-explicitly-cancels-the-shared-floor',
  boardsPop.decls['min-width'] === '0' && boardsGeom(200).inherited === 0,
  `min-width=${boardsPop.decls['min-width']} declared, inherited=${boardsGeom(200).inherited}px`);
// The SECOND .pop user must be untouched: the shared base keeps `right: 0` and
// its own floor. AQ21-F — the Export dropdown (the last BARE .pop) was replaced
// by the export modal, so the bare-user clause is retired; the base itself and
// the compound boards-pop consumer remain pinned.
assert('item6a.shared-.pop-base-unchanged',
  popRule.decls.right === '0' && pxOf(popRule.decls['min-width']) === 168,
  `.pop right=${popRule.decls.right} min-width=${popRule.decls['min-width']}`);

// --- ITEM 4 -----------------------------------------------------------------
assert('item4.no-duplicate-hints (SHAPES)', dupes.length === 0,
  dupes.length ? JSON.stringify(dupes) : 'all distinct');
assert('item4.no-hint-repeats-its-label (SHAPES)',
  SHAPE_HINTS.every(s => !s.hint.toLowerCase().includes(s.label.toLowerCase())),
  SHAPE_HINTS.filter(s => s.hint.toLowerCase().includes(s.label.toLowerCase())).map(s => s.id).join(',') || 'none');
assert('item4.library-hints-distinct-across-the-whole-LIBRARY', libDupes.length === 0,
  libDupes.length ? libDupes.map(([h, n]) => `x${n} "${h}"`).join('; ') : `${libItems.length} entries, all distinct`);
assert('item4.library-hints-do-not-repeat-their-label', libRepeats.length === 0,
  libRepeats.map(e => e.label).join(',') || 'none');
assert('item4.search-coverage-preserved', coverageGaps.length === 0,
  coverageGaps.length ? coverageGaps.map(([l, w]) => `${l}:"${w}"`).join(', ') : `${SEARCH_REGRESSION.length} retired words still findable`);
/* ITEM A (QUEUE_ENABLED, 2026-10-22) — the HIDE itself, as its own positive
   assertion (the re-anchor above explains why the old pair left the list):
   Queue is OUT of `LIBRARY` (so the panel sections, the omnibox and the insert
   modal cannot offer it) while the flag's filter still names 'Queue' in
   src/presets.ts and `PALETTE` still CONTAINS the item — so the first-run seed
   (`PRESETS.architecture.palette[2]`, pinned byte-identical by
   checks/boot-no-flash.mjs) and every stored board keep their Queue. */
const presetsSrcQ = readFileSync(`${ROOT}/src/presets.ts`, 'utf8');
const queueFilterSpread = /QUEUE_ENABLED \|\| p\.label !== 'Queue'/.test(presetsSrcQ);
const queueInPalette = /label: 'Queue',/.test(readFileSync(`${ROOT}/src/palette.ts`, 'utf8'));
/** The EXECUTED module, not the text: esbuild-bundle src/presets.ts the way
 *  checks/round-ad-flowchart.mjs does, so the flag's spread really evaluates
 *  and `LIBRARY` / the seed-facing palette are read as the app builds them. */
const bundlePresets = () => {
  const entry = `${ROOT}/.aoq-entry.ts`;
  const out = `${ROOT}/.aoq-out.mjs`;
  writeFileSync(entry, `export {LIBRARY, PRESETS} from './src/presets';\n`);
  const bundled = execFileSync(`${ROOT}/node_modules/.bin/esbuild`,
    [entry, '--bundle', '--platform=node', '--format=esm', '--log-level=error',
      '--external:react', '--external:react-dom', '--external:react/jsx-runtime', '--external:@xyflow/react'],
    {encoding: 'utf8'});
  writeFileSync(out, bundled);
  return import(`${out}?t=${Date.now()}`);
};
const executedPresets = await bundlePresets();
const archPalette = executedPresets.PRESETS.architecture.palette;
assert('itemA.queue-is-flag-gated-from-the-create-surfaces',
  !executedPresets.LIBRARY.some(p => p.label === 'Queue') && queueFilterSpread && queueInPalette
    && archPalette[2]?.label === 'Queue' && archPalette.length === 10,
  `executed LIBRARY holds ${executedPresets.LIBRARY.length} items and NO Queue (the hide), the flag's filter still names 'Queue' in src/presets.ts, ` +
  `the item itself stays in src/palette.ts, and PRESETS.architecture.palette keeps its 10 entries with 'Queue' at [2] — the seed's ` +
  `External → Queue → Service pipeline is untouched, so checks/boot-no-flash.mjs stays green without a re-anchor.`);
const stillLong = libItems.filter(e => e.hint.length > 32);
assert('item4.no-library-hint-over-32ch', stillLong.length === 0,
  stillLong.map(e => `${e.label}(${e.hint.length})`).join(',') || `longest ${Math.max(...libItems.map(e => e.hint.length))}ch`);
assert('item4.no-shapes-hint-over-32ch', SHAPE_HINTS.every(s => s.hint.length <= 32),
  SHAPE_HINTS.filter(s => s.hint.length > 32).map(s => s.id).join(',') || `longest ${Math.max(...SHAPE_HINTS.map(s => s.hint.length))}ch`);

/* ===========================================================================
   ITEM 2b / 5 / 6b — SOURCE SHAPE (the removals are machine-checked too)

   These three items are removals plus one new component, and a removal is
   exactly the kind of change that silently half-lands. So each is asserted
   against the FILE TEXT, not against a report.

   On the brief's `grep -c NodeToolbar … → 0`: the count is NOT 0 and must not
   be, because `DiagramNode.tsx` (item 2, already done) DOCUMENTS the removal and
   that prose spells the tag. The assertion therefore targets what matters — the
   JSX RENDER — and separately pins that no prose got pasted into the two other
   kinds. Counting the bare word would have failed on a correct tree and taught
   the next reader nothing.
   =========================================================================== */
console.log('\n' + '='.repeat(78));
console.log('ITEM 2b / 5 / 6b — source shape');
console.log('='.repeat(78));
const srcOf = f => readFileSync(`${ROOT}/src/${f}`, 'utf8');
/* COMMENTS ARE STRIPPED BEFORE ANY COUNT. Both traps this guard exists for are
   comment-shaped: `DiagramNode.tsx` DOCUMENTS the removal in prose that spells
   the tag, and App.tsx's removal note names the memo it deleted. Counting the
   raw text would fail a correct tree and pass nothing. A reader checking
   "is the tag still rendered" must look at code, not at what code says. */
const stripTs = s => s
  .replace(/\/\*[\s\S]*?\*\//g, '')     // block comments
  .replace(/(^|[^:])\/\/[^\n]*/g, '$1'); // line comments (the [^:] keeps `://` in URLs)
const SRC = {
  App: stripTs(srcOf('App.tsx')),
  Diagram: stripTs(srcOf('DiagramNode.tsx')),
  Custom: stripTs(srcOf('CustomShapeNode.tsx')),
  Label: stripTs(srcOf('LabelNode.tsx')),
  Styles: readFileSync(`${ROOT}/src/styles.css`, 'utf8'),
  Dialog: stripTs(srcOf('BoardDialog.tsx')),
};
const RAW = {
  Diagram: srcOf('DiagramNode.tsx'),
  Custom: srcOf('CustomShapeNode.tsx'),
  Label: srcOf('LabelNode.tsx'),
};
/** Count real JSX renders of a tag (`<Tag`, `<Tag>`, `<Tag `). */
const rendersOf = (text, tag) => (text.match(new RegExp(`<${tag}[\\s>]`, 'g')) ?? []).length;
const countOf = (text, needle) => text.split(needle).length - 1;

const RENDERS = {
  Diagram: rendersOf(SRC.Diagram, 'NodeToolbar'),
  Custom: rendersOf(SRC.Custom, 'NodeToolbar'),
  Label: rendersOf(SRC.Label, 'NodeToolbar'),
};
const ALLSRC = Object.values(SRC).join('\n');
console.log(`JSX renders of <NodeToolbar> (comments stripped): DiagramNode=${RENDERS.Diagram} CustomShapeNode=${RENDERS.Custom} LabelNode=${RENDERS.Label}`);
console.log(`prose mentions on disk (documenting the removal): DiagramNode=${countOf(RAW.Diagram, 'NodeToolbar')} CustomShapeNode=${countOf(RAW.Custom, 'NodeToolbar')} LabelNode=${countOf(RAW.Label, 'NodeToolbar')}`);

assert('item2b.no-NodeToolbar-render-anywhere', RENDERS.Diagram + RENDERS.Custom + RENDERS.Label === 0,
  `renders: ${JSON.stringify(RENDERS)} (DiagramNode is item 2, done; the count must stay 0)`);
assert('item2b.removed-prose-confined-to-DiagramNode',
  countOf(RAW.Diagram, 'NodeToolbar') > 0 && countOf(RAW.Custom, 'NodeToolbar') === 0 && countOf(RAW.Label, 'NodeToolbar') === 0,
  'the removal is documented ONCE, in DiagramNode.tsx (item 2); the two kinds finished here carry no copy of that prose');
/* NEGATIVE CONTROL — the render counter must reject a re-added tag. */
assert('item2b.control-render-counter-detects-a-reintroduction',
  rendersOf('<NodeToolbar isVisible position={Position.Top}>x</NodeToolbar>', 'NodeToolbar') === 1
    && rendersOf('prose mentioning NodeToolbar only', 'NodeToolbar') === 0,
  'the counter counts a real render (1) and ignores prose (0)');
assert('item2b.__toolbar-thread-fully-removed',
  !ALLSRC.includes('__toolbar:') && !ALLSRC.includes('d.__toolbar') && !ALLSRC.includes('__toolbar?:'),
  `live \`__toolbar\` declarations/reads left: none`);
assert('item2b.App-no-longer-injects-the-toolbar',
  !SRC.App.includes('toolbarActions') && !SRC.App.includes('const toolbarActions'),
  'App.tsx has no toolbarActions memo and no injection');
assert('item2b.no-node-toolbar-css-left', !SRC.Styles.includes('.node-toolbar'),
  `.node-toolbar rules in styles.css: ${countOf(SRC.Styles, '.node-toolbar')}`);
assert('item2b.actions-still-reachable',
  SRC.App.includes("mod && k === 'd'") && SRC.App.includes("mod && k === 'c'") && SRC.App.includes('deleteKeyCode'),
  '⌘/Ctrl+D duplicate, ⌘/Ctrl+C copy and the Del keycode are all still wired');

// --- ITEM 5 -----------------------------------------------------------------
const BADGE_PRESET_USES = countOf(SRC.App, 'data-preset-badge');
console.log(`\nsidebar preset badge: data-preset-badge uses=${BADGE_PRESET_USES}, .boards-sub in App=${countOf(SRC.App, 'boards-sub')}, .boards-sub in CSS=${countOf(SRC.Styles, 'boards-sub')}`);
assert('item5.sidebar-badge-and-hint-gone',
  !SRC.App.includes('boards-sub') && !SRC.App.includes('data-preset-badge'),
  'the block, its class and its data attribute are all gone from App.tsx');
assert('item5.no-boards-sub-css', !SRC.Styles.includes('boards-sub'),
  `.boards-sub rules in styles.css: ${countOf(SRC.Styles, 'boards-sub')}`);
/* `.badge.preset` is SHARED: the inspector's C4 kicker chip still uses it
   (App.tsx ~4191), so the rule STAYS. Recorded as a decision, not an oversight. */
const badgePresetUsers = (SRC.App.match(/className="badge preset"/g) ?? []).length;
assert('item5.badge.preset-KEPT-because-shared',
  SRC.Styles.includes('.badge.preset') && badgePresetUsers >= 1,
  `still used by ${badgePresetUsers} element(s) in App.tsx (the inspector's C4 kicker chip) — rule kept on purpose`);
/* The preset DATA must survive: behaviour drivers, not display. */
const BEHAVIOUR = ['preset.edges', 'preset.layout', 'preset.id ===', "preset.id === 'erd'", 'preset.note'];
const missing = BEHAVIOUR.filter(k => !SRC.App.includes(k));
console.log(`preset BEHAVIOUR drivers still referenced: ${BEHAVIOUR.filter(k => SRC.App.includes(k)).join(', ')}`);
assert('item5.preset-data-still-drives-behaviour', missing.length === 0,
  missing.length ? `MISSING: ${missing.join(', ')}` : `${BEHAVIOUR.length}/${BEHAVIOUR.length} drivers intact (edges, layout, erd, flowchart, c4 switches)`);

// --- ITEM 6b ----------------------------------------------------------------
const NATIVE = countOf(SRC.App, 'window.prompt') + countOf(SRC.App, 'window.confirm');
console.log(`\nnative blocking dialogs left in App.tsx (code + prose): ${NATIVE}`);
assert('item6b.no-native-prompt-or-confirm', NATIVE === 0,
  `${NATIVE} occurrence(s) of the native prompt/confirm API anywhere in App.tsx`);
assert('item6b.dialog-is-a-modal-with-a-label',
  SRC.Dialog.includes('role="dialog"') && SRC.Dialog.includes('aria-modal="true"') && SRC.Dialog.includes('aria-labelledby="bd-title"'),
  'role=dialog + aria-modal + aria-labelledby all present');
assert('item6b.dialog-reuses-the-apps-focus-vocabulary',
  SRC.Dialog.includes("from './Settings'") && SRC.Dialog.includes('FOCUSABLE') && SRC.Dialog.includes('returnFocusTo'),
  'imports FOCUSABLE + takes returnFocusTo from Settings.tsx rather than re-implementing');
assert('item6b.dialog-wired-into-the-global-key-guard',
  SRC.App.includes('if (boardDlg) return;') && SRC.App.includes('<BoardDialog'),
  'App guards its shortcuts on `boardDlg` and renders the dialog');
/* PLACEMENT IS LOAD-BEARING, so it is asserted and not just commented: the guard
   must sit ABOVE the Escape branch, or Escape would close the dialog AND fall
   through to the deselect-everything branch behind it. */
const guardAt = SRC.App.indexOf('if (boardDlg) return;');
const escAt = SRC.App.indexOf("if (e.key === 'Escape') {");
assert('item6b.guard-sits-above-the-Escape-branch',
  guardAt > 0 && escAt > 0 && guardAt < escAt,
  `boardDlg guard at ${guardAt}, the Escape branch at ${escAt} — guard first`);
const isEditableAt = SRC.App.indexOf('if (isEditable(e.target)) return;');
assert('item6b.isEditable-still-runs-first-so-typing-is-never-swallowed',
  isEditableAt > 0 && isEditableAt < guardAt,
  `isEditable at ${isEditableAt}, the dialog guard at ${guardAt} — typing reaches the field first`);
const actionBlock = SRC.Dialog.slice(SRC.Dialog.indexOf('className="bd-actions"'));
assert('item6b.cancel-precedes-the-destructive-action',
  actionBlock.indexOf('>Cancel<') < actionBlock.indexOf('bd-btn danger'),
  `in the action row: Cancel at ${actionBlock.indexOf('>Cancel<')}, the danger button at ${actionBlock.indexOf('bd-btn danger')}`);
/* No new colour literal may enter the new CSS block. */
const dialogCss = SRC.Styles.slice(SRC.Styles.indexOf('ITEM 6b: the board dialog'), SRC.Styles.indexOf('/* ---------- D2: cheat sheet ----------'));
const dialogHex = (dialogCss.match(/#[0-9a-fA-F]{3,6}/g) ?? []).length;
console.log(`literal colours inside the new .bd-* CSS block: ${dialogHex}`);
assert('item6b.dialog-css-is-tokens-only', dialogHex === 0,
  `${dialogHex} literal colour(s) in the .bd-* block — must be 0 (tokens only)`);

const failed = asserts.filter(a => !a.pass);

console.log('\n' + '='.repeat(78));
console.log(`HARNESS: ${asserts.length - failed.length}/${asserts.length} passed`);
console.log(JSON.stringify(asserts, null, 2));
process.exit(failed.length ? 1 : 0);

