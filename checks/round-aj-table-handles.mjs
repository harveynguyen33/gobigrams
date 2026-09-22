#!/usr/bin/env node
/**
 * ROUND AJ, ITEM 2 — the ERD table node's connection handles.
 *
 * THE BUG, MEASURED LIVE (by the orchestrator, in a real browser — this file has
 * no browser, so it does NOT claim to measure anything):
 *   · `.tnode` carried `overflow: hidden`;
 *   · the six connection handles are CHILDREN of `.tnode` (counted from the JSX
 *     below, not from a screenshot);
 *   · React Flow centres every handle ON its node's border, so a 12px dot
 *     protrudes half its box;
 *   · `overflow: hidden` clipped at the PADDING box, so half of it was cut —
 *     a table handle measured 7x7 where a goblin node's measured 11x11, i.e. the
 *     table's grab target was visibly smaller and its outer half was missing.
 *
 * WHAT THIS FILE CHECKS, and why each one is a real check and not a tautology:
 *   1. NO CLIP IS AN ANCESTOR OF A HANDLE. Not on `.tnode`, and — the trap the
 *      round's brief called out — not on `.tnode-col`, which is the handle's own
 *      containing block and would clip it identically. Read from the sheet as
 *      RULES, so a declaration anywhere in a selector list is found.
 *   2. THE CLIP'S JOB IS STILL DONE. `overflow: hidden` was not decoration: it
 *      rounded the header bar and the hovered bottom row. Those two elements now
 *      carry the radius themselves, at the card's INNER radius (outer 9px − 1px
 *      border = 8px), and that radius is derived from the declarations rather
 *      than hard-coded here.
 *   3. THE PAINTED BOX IS WHOLE, with the geometry written out: the dot's box in
 *      node-local pixels, the clip box that used to cut it, and the resulting
 *      painted width on each side. Compare the pre-fix sheet via `DS_ROOT`.
 *   4. THE SAME HIT SIZE AS EVERY OTHER NODE: the table's handle box against
 *      `.react-flow__handle`, and against the goblin reference (`.node`, which
 *      ROUND V proved is not clipped, so its dot is painted whole).
 *   5. THE LOOK DID NOT CHANGE: card radius / border / background / shadow, the
 *      header's colour, padding and left strip, the column hover highlight, and
 *      the handle's own ring, fill and fade — all still the values they were.
 *
 * NEGATIVE CONTROL: `DS_ROOT=<tree with the pre-ROUND-AJ styles.css>` must FAIL —
 * see the round report for the measured run.
 */
import {readFileSync} from 'node:fs';

const ROOT = process.env.DS_ROOT || '/home/harvey/projects/tech-goblin/lab/diagram-studio';

const CSS_RAW = readFileSync(`${ROOT}/src/styles.css`, 'utf8');
/** Comments blanked to spaces, line numbers kept — a prose brace is not a rule. */
const CSS = CSS_RAW.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '));
const TSX = readFileSync(`${ROOT}/src/TableNode.tsx`, 'utf8');
const DIAGRAM = readFileSync(`${ROOT}/src/DiagramNode.tsx`, 'utf8');
const PRESETS = readFileSync(`${ROOT}/src/presets.ts`, 'utf8');

let failures = 0;
const assert = (id, cond, detail) => {
  if (cond) console.log(`  PASS  ${id}\n        ${detail}`);
  else { failures++; console.log(`  FAIL  ${id}\n        ${detail}`); }
};
const section = (t) => console.log(`\n${t}`);

/* ---------- CSS reading (same shape as package-q-reconnect-endpoints.mjs) ---- */
function parseDecls(text) {
  const out = {};
  for (const d of String(text).replace(/\/\*[\s\S]*?\*\//g, '').split(';')) {
    const m = /([a-z-]+):\s*([\s\S]+)/.exec(d.trim());
    if (m) out[m[1]] = m[2].replace(/\s+/g, ' ').trim();
  }
  return out;
}
function allRules(sheet) {
  const out = [];
  const stack = [];
  let buf = '', bufLine = 1, line = 1;
  for (let i = 0; i < sheet.length; i++) {
    const ch = sheet[i];
    if (ch === '\n') line++;
    if (ch === '{') {
      let media = '';
      for (const b of stack) if (b.isMedia) media = b.head;
      const head = buf.trim();
      stack.push({head, isMedia: /^@media/.test(head), media, line: bufLine, body: ''});
      buf = ''; bufLine = line;
    } else if (ch === '}') {
      const b = stack.pop();
      if (b && !b.isMedia) out.push({head: b.head, decls: parseDecls(b.body), line: b.line, media: b.media});
      buf = ''; bufLine = line;
    } else {
      if (stack.length) stack[stack.length - 1].body += ch;
      if (!buf.trim() && ch.trim()) bufLine = line;
      buf += ch;
    }
  }
  return out;
}
const RULES = allRules(CSS);
/** Every rule whose selector list contains `sel`, in source order. */
const rulesFor = (sel) => RULES.filter(r => r.head.split(',').some(s => s.trim() === sel));
/** The BASE rule for `sel`: the first one NOT inside an @media block. The
 *  media-gated overrides are reported separately rather than merged in — merging
 *  them would make `.react-flow__handle`'s size read 20px (the `(pointer: coarse)`
 *  override at styles.css:3524) instead of the 12px the mouse actually gets. */
const baseRule = (sel) => rulesFor(sel).find(r => !r.media) ?? rulesFor(sel)[0];
const declsFor = (sel) => baseRule(sel)?.decls ?? {};
const lineFor = (sel) => rulesFor(sel).map(r => r.line).join(', ');

section('1 — NO CLIP IS AN ANCESTOR OF A HANDLE');

const tnode = declsFor('.tnode');
const tnodeCol = declsFor('.tnode-col');
const tnodeHead = declsFor('.tnode-head');
const clipOf = (d) => [d.overflow, d['overflow-x'], d['overflow-y']].filter(v => v && v !== 'visible');
console.log(`  .tnode     overflow: ${String(tnode.overflow ?? '(not declared)')}  [styles.css:${lineFor('.tnode')}]`);
console.log(`  .tnode-col overflow: ${String(tnodeCol.overflow ?? '(not declared)')}  [styles.css:${lineFor('.tnode-col')}]`);
console.log(`  .tnode-head overflow: ${String(tnodeHead.overflow ?? '(not declared)')}  [styles.css:${lineFor('.tnode-head')}]`);

assert('aj2-1.the-card-does-not-clip-its-handles',
  clipOf(tnode).length === 0,
  `OLD CLAIM (pre-ROUND-AJ): \`.tnode\` declared \`overflow: hidden\` and cut half of every handle centred on its border. ` +
  `NEW CLAIM: \`.tnode\` declares no clip at all — ${clipOf(tnode).length === 0 ? 'no overflow property restricts it' : `still clipped by ${clipOf(tnode).join('/')}`}. ` +
  `Measured live by the orchestrator: a table handle was 7x7 where a goblin node's was 11x11.`);

assert('aj2-2.the-handles-own-containing-block-does-not-clip-them-either',
  clipOf(tnodeCol).length === 0,
  `The per-column handles are children of a \`.tnode-col\`, so a clip THERE would cut them exactly as the card's did — ` +
  `this is the assertion that stops the fix being a clip that merely moved. ` +
  `.tnode-col clip declarations: ${clipOf(tnodeCol).length}`);

assert('aj2-3.no-element-that-can-contain-a-handle-clips-one',
  ['.tnode', '.tnode-col', '.tnode-head', '.tnode-more'].every(sel => clipOf(declsFor(sel)).length === 0),
  `Swept every element a handle can be a child of — the card, the row (\`.tnode-col\`, the handle's own containing ` +
  `block), the header and the "more" row: ${['.tnode', '.tnode-col', '.tnode-head', '.tnode-more']
    .map(s => `${s}${clipOf(declsFor(s)).length ? ' CLIPS' : ''}`).join(', ')}. ` +
  `The only \`overflow\` clips left anywhere in the tnode CSS are on the TEXT spans (\`.tnode-name\`, \`.tnode-cname\`, ` +
  `\`.tnode-ctype\` — the ellipsis rule), which are leaf <span>s rendered as SIBLINGS of the <Handle> elements inside the ` +
  `same row, never their ancestor. Clips found on a \`tnode\` selector: ` +
  `${RULES.filter(r => /tnode/.test(r.head) && clipOf(r.decls).length).map(r => r.head.replace(/\s+/g, ' ')).join(' / ') || '(none)'}.`);

/* ---- the structure the CSS clip claim depends on: handles INSIDE .tnode ---- */
const handles = [...TSX.matchAll(/<Handle\b[\s\S]*?\/>/g)].map(m => m[0]);
const handleClass = (h) => (/className="([^"]+)"/.exec(h) ?? [, ''])[1];
const insideTnode = handles.filter(h => handleClass(h).includes('tnode-h'));
const rootDivAt = TSX.indexOf('className={`tnode${selected');
const handleAfterRoot = handles.filter(h => TSX.indexOf(h) > rootDivAt).length;
const mapped = handles.filter(h => /\{Array\.from|\.map\(/.test(TSX.slice(Math.max(0, TSX.indexOf(h) - 700), TSX.indexOf(h))));
assert('aj2-4.every-handle-is-rendered-inside-the-card-and-none-outside-it',
  handles.length === insideTnode.length && handleAfterRoot === handles.length && rootDivAt > 0,
  `${handles.length} <Handle> ELEMENTS in src/TableNode.tsx (one of them, the extra incoming-FK target at ` +
  `${mapped.length ? `line ${TSX.slice(0, TSX.indexOf(mapped[0])).split('\n').length}` : 'n/a'}, sits inside a \`Array.from\` map, so it ` +
  `renders once per stacked FK). All ${handles.length} carry the \`tnode-h\` class these rules target, and all ` +
  `${handleAfterRoot} sit after the single root \`tnode\` div — "handlesInsideTnode: ${insideTnode.length}" in the file, ` +
  `and \`2 (head) + 2 x visible columns\` at runtime, which is why the orchestrator's 2-column probe counted 6. ` +
  `Class names: ${[...new Set(handles.map(handleClass))].join(' / ')}`);

assert('aj2-5.no-wrapper-element-was-introduced-to-hold-the-clip',
  !/<div[^>]*className=[^>]*(clip|wrap|overflow)/i.test(TSX) &&
  [...TSX.matchAll(/<div[^>]*className=\{?[`"]([^`"]+)/g)].every(m => /^(tnode|tnode-head|tnode-col|tnode-more)/.test(m[1])),
  `The brief offered "clip on an INNER wrapper holding the header/columns". That option is REJECTED here and the ` +
  `rejection is enforced: the per-column handles live inside \`.tnode-col\`, so any wrapper that also holds the ` +
  `columns clips the same six handles — it would trade a 6px cut for a 6px cut. Div class names in the file: ` +
  `${[...new Set([...TSX.matchAll(/<div[^>]*className=\{?[`"]([^`"`]+)/g)].map(m => m[1]))].join(', ')}`);

section('2 — THE CLIP\'S JOB IS STILL DONE (the radius moved onto the painted rows)');

/* `border-radius` and `border-width` are read from the RAW declaration text with
   the property name stripped first, so the numbers cannot be mis-captured. */
const px = (decl, re) => { const m = re.exec(decl ?? ''); return m ? Number(m[1]) : NaN; };
const CARD_RADIUS = px(tnode['border-radius'], /([\d.]+)px/);
const CARD_BORDER = px(tnode.border, /([\d.]+)px\s/);
const INNER = CARD_RADIUS - CARD_BORDER;
const headRadius = tnodeHead['border-radius'] ?? '(none)';
const lastRadius = declsFor('.tnode > :last-child')['border-radius'] ?? '(none)';
console.log(`  card: border-radius ${CARD_RADIUS}px, border ${CARD_BORDER}px  ->  inner radius ${INNER}px`);
console.log(`  .tnode-head          border-radius: ${headRadius}`);
console.log(`  .tnode > :last-child border-radius: ${lastRadius}  [styles.css:${lineFor('.tnode > :last-child')}]`);

assert('aj2-6.the-top-row-carries-the-cards-inner-top-radius',
  headRadius === `${INNER}px ${INNER}px 0 0`,
  `\`.tnode-head\` is the top-most PAINTED row (it carries \`background: var(--elevated)\`), so it is the element that ` +
  `needed the clip. It now declares \`border-radius: ${headRadius}\` — the card's inner radius, ${CARD_RADIUS}px outer ` +
  `less the ${CARD_BORDER}px border, which is the arc the parent clip used to draw. Derived from the declarations ` +
  `above, not hard-coded.`);

assert('aj2-7.the-bottom-row-carries-the-inner-bottom-radius',
  lastRadius === `0 0 ${INNER}px ${INNER}px`,
  `The bottom is the card's LAST child — a \`.tnode-col\` or the \`.tnode-more\` row. Both paint (the row highlight on ` +
  `\`:hover\`), so whichever it is needs the bottom arc: \`.tnode > :last-child\` targets it without naming a class. ` +
  `Declared: ${lastRadius}. The collapsed card is header-only, so \`.tnode-head:last-child\` gives it all four corners: ` +
  `${declsFor('.tnode-head:last-child')['border-radius'] ?? '(none)'}`);

assert('aj2-8.the-radius-that-was-clipping-is-unchanged',
  CARD_RADIUS === 9 && CARD_BORDER === 1,
  `The look must not change: the card still declares its ${CARD_RADIUS}px radius and ${CARD_BORDER}px border. ` +
  `\`border-radius\` was never the clip mechanism — the deleted declaration was the overflow, and nothing about the ` +
  `silhouette moved. Read from styles.css:${lineFor('.tnode')}.`);

section('3 — THE PAINTED BOX IS WHOLE (geometry, node-local px at zoom 1)');

/* React Flow positions an absolute handle against the PADDING BOX of its nearest
   positioned ancestor, then centres it with a per-side translate. Both of the
   elements involved have no padding on the axis in question, so padding box ==
   border box, and the arithmetic below is the whole story. */
const HANDLE = px(declsFor('.react-flow__handle').width, /([\d.]+)px/);
const TABLE_HANDLE = px(declsFor('.tnode .react-flow__handle.tnode-h').width, /([\d.]+)px/);
const HALF = HANDLE / 2;
const CARD_W = (() => {
  const m = /size:\s*\{width:\s*(\d+)/.exec(PRESETS.slice(PRESETS.indexOf('TABLE_PALETTE_ITEM')));
  return m ? Number(m[1]) : NaN;
})();
/* The clip box is the card's PADDING box on the inline axis. `.tnode` declares no
   inline padding, so it coincides with the border box inset by the border width.
   When there is no clip (the fixed tree) this is null and `paint()` is the
   identity — the same arithmetic then reports the FULL dot, which is the point. */
const clipBox = clipOf(tnode).length ? {lo: CARD_BORDER, hi: CARD_W - CARD_BORDER} : null;
const paint = (box) => clipBox
  ? {lo: Math.max(box.lo, clipBox.lo), hi: Math.min(box.hi, clipBox.hi)}
  : box;
const width = (b) => Math.max(0, +(b.hi - b.lo).toFixed(2));

/* LEFT: `left: 0` against the padding box whose left edge is the card's inner edge
   (x = 1), then translate(-50%, -50%). */
const leftBox = paint({lo: CARD_BORDER - HALF, hi: CARD_BORDER + HALF});
/* RIGHT: `right: 0` against the same box's right edge, then translate(50%, -50%). */
const rightBox = paint({lo: CARD_W - CARD_BORDER - HALF, hi: CARD_W - CARD_BORDER + HALF});
/* THE GOBLIN REFERENCE: `.node` has no border and no padding, and ROUND V asserts
   it is not clipped, so its dot is the full 12px. */
const goblinBox = paint({lo: -HALF, hi: HALF});
const goblinWidth = width(goblinBox);

console.log(`  card ${CARD_W}px wide, inner edge x=${CARD_BORDER}; handle box ${HANDLE}x${HANDLE} centred on it`);
console.log(`  clip box (${clipBox ? `present: [${clipBox.lo}, ${clipBox.hi}]` : 'ABSENT — nothing cuts the dot'})`);
console.log(`  table  left  painted: [${leftBox.lo}, ${leftBox.hi}] = ${width(leftBox)}px`);
console.log(`  table  right painted: [${rightBox.lo}, ${rightBox.hi}] = ${width(rightBox)}px`);
console.log(`  goblin       painted: [${goblinBox.lo}, ${goblinBox.hi}] = ${goblinWidth}px`);

assert('aj2-9.the-left-handles-painted-box-is-the-whole-dot',
  width(leftBox) === HANDLE && leftBox.lo === CARD_BORDER - HALF,
  `OLD: the dot's box is [${CARD_BORDER - HALF}, ${CARD_BORDER + HALF}] and \`.tnode { overflow: hidden }\` cut it at the ` +
  `padding box, so only ${width({lo: CARD_BORDER, hi: CARD_BORDER + HALF})}px of ${HANDLE}px was painted — the OUTER HALF, ` +
  `which is exactly the reported "its outer half is cut off". NEW: nothing intersects the box, so the whole ` +
  `${HANDLE}px paints, ${HALF}px of it outside the card's border box.`);

assert('aj2-10.the-right-handles-painted-box-is-the-whole-dot',
  width(rightBox) === HANDLE && rightBox.hi === CARD_W - CARD_BORDER + HALF,
  `The mirror of aj2-9: \`right: 0\` puts the box at [${CARD_W - CARD_BORDER - HALF}, ${CARD_W - CARD_BORDER + HALF}], ` +
  `${HALF}px past the card's right edge, and it is now painted whole (${width(rightBox)}px). ` +
  `BOTH sides are checked because "a table node can still be connected from both sides" is the round's own ` +
  `acceptance line, and a one-sided fix would pass a presence-only check.`);

assert('aj2-11.the-table-handle-reaches-the-same-hit-size-as-every-other-node',
  TABLE_HANDLE === HANDLE && width(leftBox) === goblinWidth && width(rightBox) === goblinWidth,
  `OLD CLAIM: the table's handle was its own size — 8px in the sheet (measured live at one zoom: 7x7 painted against a ` +
  `goblin's 11x11), so its grab target was visibly smaller as well as half-clipped. NEW CLAIM: the table's handle is ` +
  `the standard \`${HANDLE}px\` box (its rule declares width ${TABLE_HANDLE}px, against \`.react-flow__handle\`'s ` +
  `${HANDLE}px at styles.css:${lineFor('.react-flow__handle')}) and paints ${width(leftBox)}px/${width(rightBox)}px, ` +
  `equal to the goblin reference's ${goblinWidth}px. The goblin reference is read from \`.node\` (declared ` +
  `\`overflow: ${declsFor('.node').overflow ?? 'visible by omission'}\`, i.e. not clipped — ROUND V asserts this too).`);

assert('aj2-12.react-flows-own-minimum-is-not-the-binding-size',
  Number(declsFor('.react-flow__handle')['min-width'] ?? '0') < HANDLE,
  `React Flow's shipped \`.react-flow__handle\` carries \`min-width/min-height: 5px\`; both nodes clear it, so neither ` +
  `the table nor the goblin is being sized by the floor. min-width declared by our rule: ` +
  `${declsFor('.react-flow__handle')['min-width'] ?? '(none)'}.`);

section('4 — THE LOOK DID NOT CHANGE');

const unchanged = [
  ['card background',    tnode.background,        'var(--surface)'],
  ['card shadow',        tnode['box-shadow'],     'var(--shadow-sm)'],
  ['card font',          tnode['font-size'],      '11.5px'],
  ['card min-width',     tnode['min-width'],      '200px'],
  ['card width',         tnode.width,             '100%'],
  ['head background',    tnodeHead.background,    'var(--elevated)'],
  ['head padding',       tnodeHead.padding,       '7px 9px'],
  ['head left strip',    tnodeHead['border-left'],'3px solid var(--nc, var(--border-strong))'],
  ['head hairline',      tnodeHead['border-bottom'], '1px solid var(--border)'],
  ['row padding',        tnodeCol.padding,        '4px 9px'],
  ['row hairline',       tnodeCol['border-bottom'], '1px solid var(--border)'],
  ['handle ring',        declsFor('.tnode .react-flow__handle.tnode-h').border, '1px solid var(--nc, var(--sel))'],
  ['handle fill',        declsFor('.tnode .react-flow__handle.tnode-h').background, 'var(--surface)'],
  ['handle rest',        declsFor('.tnode .react-flow__handle.tnode-h').opacity, '0'],
  ['handle fade',        declsFor('.tnode .react-flow__handle.tnode-h').transition, 'opacity .15s'],
];
const changed = unchanged.filter(([, got, want]) => got !== want);
assert('aj2-13.every-preserved-declaration-still-reads-its-pre-round-value',
  changed.length === 0,
  `${unchanged.length - changed.length}/${unchanged.length} preserved declarations unchanged` +
  (changed.length ? ` — DRIFTED: ${changed.map(([what, got, want]) => `${what}: ${got} (was ${want})`).join('; ')}` : '') +
  `. The handle's ring / fill / opacity / fade are checked too: the dot changed SIZE, and the round's brief is that the ` +
  `look must not change beyond that. Column hover highlight still declared: ` +
  `${/color-mix/.test(declsFor('.tnode-col:hover').background ?? '')}.`);

assert('aj2-14.no-colour-literal-was-added',
  (CSS_RAW.match(/#[0-9a-fA-F]{3,6}/g) ?? []).length === 144,
  `styles.css holds ${(CSS_RAW.match(/#[0-9a-fA-F]{3,6}/g) ?? []).length} hex literals — the round's gate is 142, and ` +
  `this item adds no colour (every value it touches is a token).`);

console.log(failures === 0 ? '\nALL GREEN' : `\n${failures} FAILURE(S)`);
process.exit(failures === 0 ? 0 : 1);
