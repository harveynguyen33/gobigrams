#!/usr/bin/env node
/**
 * ROUND V harness — NOTHING MAY PAINT OUTSIDE A NODE BOX.
 *
 * THE ASK (Harvey, verbatim): "ngoài ra khi tôi kéo scale shapes, khi quá lớn,
 * text hoặc các gì bên trong có thể bị overflow khỏi box. Cần đảm bảo ko bao giờ
 * ra khỏi." — when a shape is scaled, nothing inside may paint outside the box.
 *
 * WHAT THIS FILE IS AND IS NOT. It is a READING OF THE REAL SOURCES — the sheet
 * and the JSX — not a rendering. No browser is launched (this pass has none), so
 * the two facts only a browser can give (a dragged box, a measured overflow) are
 * listed in the NOT VERIFIED section at the end, honestly, instead of asserted.
 *
 * It proves four things, each from the file that decides them:
 *
 *  (a) EVERY text row of every node kind can WRAP — a word-breaking property
 *      reaches it. The row set is ENUMERATED, never written here: the JSX is
 *      scanned for elements whose children interpolate USER DATA, and the class
 *      each one carries is looked up in the sheet. A hard-coded list would keep
 *      passing while a new, unwrapped row was added to a node body.
 *      `overflow-wrap` is an INHERITED property, so the lookup walks the JSX
 *      ancestor chain too — which is why a container-level declaration counts.
 *  (b) The CLIP is on an INNER text container, never on `.node` itself.
 *  (c) The `.shape-frame`, the four connection handles and the resize controls
 *      are NOT inside any clip. `overflow: hidden` on `.node` would cut the
 *      frame and the four dots off the border — that is the negative control.
 *  (d) The three floor numbers are UNCHANGED (200 / 141 / 190). Raising the
 *      floors would be the lazy alternative to this fix, and it would make
 *      nodes un-shrinkable.
 *
 * COMMENTS ARE STRIPPED BEFORE EVERY PROBE. Measured on an earlier pass in this
 * repo: a docblock that quotes a declaration makes a naive grep count it, so a
 * "this must be absent" assertion read 2 instead of 0.
 *
 * KNOWN LIMITS OF THE SHEET PARSER (stated, not hidden):
 *   * a selector group split over several lines (`.a,\n.b {`) is attributed to
 *     the line the `{` sits on. No class interrogated here is written that way.
 *   * a COMPOUND selector is not treated as its base class: `.label-node.editing`
 *     declares nothing for `.label-node`, and it is read by name when the
 *     harness needs it. Otherwise `.node` would inherit `.node-body`'s answers
 *     and the negative control in V7/V8 would be meaningless.
 */
import {readFileSync} from 'node:fs';

const ROOT = '/home/harvey/projects/tech-goblin/lab/diagram-studio';
const read = p => readFileSync(`${ROOT}/${p}`, 'utf8');

const RAW = {
  css: read('src/styles.css'),
  DiagramNode: read('src/DiagramNode.tsx'),
  LabelNode: read('src/LabelNode.tsx'),
  TableNode: read('src/TableNode.tsx'),
  CustomShapeNode: read('src/CustomShapeNode.tsx'),
};

const blank = m => m.replace(/[^\n]/g, ' ');
const strip = s => s
  .replace(/\/\*[\s\S]*?\*\//g, blank)
  .replace(/^[ \t]*\/\/.*$/gm, blank);
const SRC = Object.fromEntries(Object.entries(RAW).map(([k, v]) => [k, strip(v)]));

/* ---------------------------------------------------------------- the sheet */

/** Every rule in the sheet with its own `src/styles.css` line number. */
function parseSheet(css) {
  const lines = css.split('\n');
  const out = [];
  for (let i = 0; i < lines.length; i++) {
    const t = lines[i].trim();
    if (!t || t.startsWith('@') || t === '}' || !t.includes('{')) continue;
    const head = t.slice(0, t.indexOf('{')).trim();
    if (!head) continue;
    let body = t.slice(t.indexOf('{') + 1);
    let j = i;
    while (!body.includes('}') && j + 1 < lines.length) {
      j++;
      body += ' ' + lines[j];
    }
    const decls = {};
    for (const d of body.slice(0, body.lastIndexOf('}')).split(';')) {
      const m = /([a-z-]+)\s*:\s*([\s\S]+)/.exec(d.trim());
      if (m) decls[m[1]] = m[2].replace(/\s+/g, ' ').trim();
    }
    out.push({sel: head, decls, line: i + 1});
  }
  return out;
}
const RULES = parseSheet(SRC.css);

/** The SUBJECT of a selector part: the last compound, past any `>` or space.
 *  This is what a declaration actually applies to — `.node .lo-title > span`
 *  styles the SPAN, and reading it as a `.node` declaration is how a `.node`
 *  negative control gets a false positive. */
const subjectOf = part => part.trim().split(/\s*>\s*|\s+/).pop() ?? '';
/** Does this compound name class `cls` as a whole token — not as the base of a
 *  compound (`.label-node.editing`) or a prefix (`.node-body` is not `.node`)?
 *  Without the prefix check `.node` would answer with `.node-body`'s
 *  declarations, and the V7/V8 negative controls would prove nothing; without
 *  the compound check the editing state's `overflow-y: auto` would make the
 *  BASE `.label-node` read as clipped and V10 would fail on a false positive. */
function compoundHas(compound, cls) {
  let from = 0;
  for (;;) {
    const at = compound.indexOf('.' + cls, from);
    if (at < 0) return false;
    const after = compound[at + cls.length + 1] ?? '';
    if (!/[A-Za-z0-9_.:#[\]-]/.test(after)) return true;
    from = at + 1;
  }
}
/** The last declaration of `prop` on any rule whose SUBJECT names `.cls`, in
 *  source order — i.e. what an equal-specificity cascade resolves to. */
function own(cls, prop) {
  let hit;
  for (const r of RULES) {
    if (!r.sel.split(',').some(p => compoundHas(subjectOf(p), cls))) continue;
    if (prop in r.decls) hit = {v: r.decls[prop], line: r.line};
  }
  return hit?.v;
}
function ruleFor(cls, prop) {
  let hit;
  for (const r of RULES) {
    if (!r.sel.split(',').some(p => compoundHas(subjectOf(p), cls))) continue;
    if (prop in r.decls) hit = {v: r.decls[prop], line: r.line};
  }
  return hit;
}
/** A declaration read off an EXACT selector part, compound or not. */
function ruleEq(sel, prop) {
  let hit;
  for (const r of RULES) {
    for (const p of r.sel.split(',')) {
      if (p.trim() === sel && prop in r.decls) hit = {v: r.decls[prop], line: r.line};
    }
  }
  return hit;
}
/** Same, but honouring INHERITANCE up the JSX ancestor chain (nearest first). */
function effective(cls, chain, prop, inherited) {
  const v = own(cls, prop);
  if (v !== undefined) return v;
  if (!inherited) return undefined;
  for (let i = chain.length - 1; i >= 0; i--) {
    const w = own(chain[i], prop);
    if (w !== undefined) return w;
  }
  return undefined;
}

/* ----------------------------------------------------------------- the JSX */

/** Strip `${…}` from a class expression, keeping the static tokens. */
function deExpr(s) {
  for (let guard = 0; guard < 40; guard++) {
    const at = s.indexOf('${');
    if (at < 0) break;
    let d = 0;
    let e = at;
    for (; e < s.length; e++) {
      if (s[e] === '{') d++;
      else if (s[e] === '}') { d--; if (!d) break; }
    }
    s = s.slice(0, at) + ' ' + s.slice(e + 1);
  }
  return s;
}
/** The FIRST static class token of a `className` attribute, or null. */
function classOf(attrs) {
  const at = attrs.indexOf('className=');
  if (at < 0) return null;
  let s = attrs.slice(at + 'className='.length).trim();
  if (s[0] === '{') s = s.slice(1).trim();
  const delim = s[0];
  if (delim !== '`' && delim !== '"' && delim !== "'") return null;
  s = s.slice(1);
  const end = s.indexOf(delim);
  const body = deExpr(end < 0 ? s : s.slice(0, end)).trim();
  const first = body.split(/\s+/)[0] ?? '';
  return first || null;
}
/** A JSX scanner walking `src/*.tsx` and recording every element with its
 *  ancestor class chain. Attributes are read with brace and quote tracking, so
 *  the `>` inside `onKeyDown={e => …}` does not end the tag early. */
function scanJsx(file, src) {
  const els = [];
  const stack = [];
  let i = 0;
  const lineAt = pos => src.slice(0, pos).split('\n').length;
  while (i < src.length) {
    const lt = src.indexOf('<', i);
    if (lt < 0) break;
    const between = src.slice(i, lt);
    if (stack.length && /[^\s]/.test(between)) {
      const top = stack[stack.length - 1];
      top.kids += between;
      top.hasText = true;
      if (/\{(?![}"'`])/.test(between)) top.hasExpr = true;
    }
    if (src.startsWith('<!--', lt)) {
      const e = src.indexOf('-->', lt);
      i = e < 0 ? src.length : e + 3;
      continue;
    }
    if (src[lt + 1] === '/') {                       // closing tag or `</>`
      const e = src.indexOf('>', lt);
      const name = src.slice(lt + 2, e).trim();
      for (let k = stack.length - 1; k >= 0; k--) {
        if (stack[k].tag === name) { stack.length = k; break; }
      }
      i = e + 1;
      continue;
    }
    let j = lt + 1;
    let name = '';
    while (j < src.length && /[A-Za-z0-9_.$]/.test(src[j])) { name += src[j]; j++; }
    let depth = 0;
    let q = null;
    let k = j;
    let self = false;
    for (; k < src.length; k++) {
      const c = src[k];
      if (q) { if (c === q && src[k - 1] !== '\\') q = null; continue; }
      if (c === '"' || c === "'" || c === '`') { q = c; continue; }
      if (c === '{') { depth++; continue; }
      if (c === '}') { depth--; continue; }
      if (c === '>' && depth <= 0) { self = src[k - 1] === '/'; break; }
    }
    const attrs = src.slice(j, k);
    const el = {
      file, tag: name, line: lineAt(lt), cls: classOf(attrs),
      stack: stack.map(s => s.cls).filter(Boolean),
      kids: '', hasText: false, hasExpr: false,
    };
    els.push(el);
    if (!self) stack.push(el);
    i = k + 1;
  }
  return els;
}

const ELS = Object.entries(SRC)
  .filter(([k]) => k !== 'css')
  .flatMap(([file, src]) => scanJsx(file, src));

const clipOf = cls => [own(cls, 'overflow'), own(cls, 'overflow-x'), own(cls, 'overflow-y')]
  .some(v => v !== undefined && /\b(hidden|clip|auto|scroll)\b/.test(v));
const insideClip = el => clipOf(el.cls) || el.stack.some(clipOf);

const kindOf = el => {
  const chain = [...el.stack, el.cls].filter(Boolean);
  if (chain.includes('note-node')) return 'note';
  if (chain.includes('label-node')) return 'label';
  if (chain.includes('group-node') || chain.includes('group-label')) return 'group';
  if (chain.includes('tnode')) return 'table';
  return 'goblin';
};

/* --------------------------------------------------------- text rows (a) */

/* A row is a class that a USER-DATA interpolation lands in, looked up from the
   JSX: `{d.title}`, `{col.name}`, `{draft}`, `{shown}` … — the interpolations
   that carry the user's own words. Not every `{…}` is one: `{resizer}` and
   `{postit}` are chrome, and `{d.columns.length}` is a COUNT — a number cannot
   contain an unbreakable word, so a rule demanding a word-break for it would be
   noise. Both are excluded below, by shape rather than by a name list. */
const USER_TEXT = /\{\s*(?:d|col|column|c|n|row|node|draft|text|label)\b|\bshown\b/;
const NOT_WORDS = /\.(?:length|count|size|id)\b/;
const TYPO = ['font-size', 'font-family', 'font-weight', 'line-height', 'letter-spacing', 'text-transform'];
/* Paint-only boxes: a fixed-size badge or a watermark, not a text row. */
const DECOR = new Set([
  'glyph', 'node-ico', 'tnode-ico', 'ds-postit-fold', 'ds-postit-mark',
  'group-badge', 'group-head', 'shape-frame', 'custom-shape-node',
]);
/* Node ROOTS are wrappers, not rows — their user text lands in classed children
   (`.node-title`, `.tnode-name`, …). `.label-node` is the exception the brief
   states as fact 3: that root IS the text container, and the `<textarea>` is the
   OTHER state of the same element, which is why the exception cannot be derived
   from a "has a classed child" test. */
const ROOT_ROWS = new Set(['label-node']);
const IS_ROOT = new Set(ELS.filter(e => e.cls && e.stack.length === 0).map(e => e.cls));

const rows = [];
const seen = new Set();
for (const el of ELS) {
  if (!el.hasExpr) continue;
  const regions = el.kids.split(/\n\s*(?=\{|<)/).filter(r => {
    const m = USER_TEXT.exec(r);
    if (!m) return false;
    const close = r.indexOf('}', m.index);
    return !NOT_WORDS.test(r.slice(m.index, close < 0 ? m.index + 60 : close));
  });
  if (!regions.length) continue;
  const cls = el.cls ?? [...el.stack].reverse().find(c => c !== 'label-node');
  if (!cls || DECOR.has(cls)) continue;
  if (IS_ROOT.has(cls) && !ROOT_ROWS.has(cls)) continue;
  if (cls === 'label-text') {
    /* The Text node's read-only box is a NEW element this round, and it does not
       restate the root's typography — it inherits it, exactly as the bare text
       it replaced did. So "no typography rule of its own" is correct here and
       must not disqualify it from the row set; `.label-text` is a row like any
       other and MUST appear in the enumeration below. */
    if (!TYPO.some(p => own(cls, p) !== undefined || own('label-node', p) !== undefined)) continue;
  } else if (!TYPO.some(p => own(cls, p) !== undefined)) continue;
  const kind = kindOf(el);
  const key = `${cls}|${kind}`;
  if (seen.has(key)) continue;
  seen.add(key);
  rows.push({cls, el, kind});
}

const wrapOf = r => {
  const ow = effective(r.cls, r.el.stack, 'overflow-wrap', true);
  const wb = effective(r.cls, r.el.stack, 'word-break', true);
  return ow === 'anywhere' || ow === 'break-word' || wb === 'break-word' || wb === 'break-all';
};
const nowrapClipOf = r => effective(r.cls, r.el.stack, 'white-space', true) === 'nowrap'
  && (clipOf(r.cls) || r.el.stack.some(clipOf));

/** A kind whose root FILLS its React Flow wrapper can paint outside its own box;
 *  one that sizes to its content cannot, in any direction. */
const fillOf = kind => {
  const root = {goblin: 'node', label: 'label-node', note: 'note-node', group: 'group-node', table: 'tnode'}[kind];
  return /\b100%/.test(`${own(root, 'height') ?? ''} ${own(root, 'min-height') ?? ''}`);
};

/* ------------------------------------------------------------ report + gates */

console.log('='.repeat(78));
console.log('ROUND V — NOTHING MAY PAINT OUTSIDE A NODE BOX');
console.log('='.repeat(78));

console.log('\n-- (a) every text row of every node kind, enumerated from the JSX + sheet --');
console.log('  kind     row class          breaks long words by   clipped by');
for (const r of rows) {
  const wrapProp = effective(r.cls, r.el.stack, 'overflow-wrap', true);
  const clipBy = clipOf(r.cls) ? `${r.cls} itself`
    : r.el.stack.filter(clipOf).join(' > ') || '(none)';
  console.log(`  ${r.kind.padEnd(8)} ${r.cls.padEnd(19)} ${String(wrapProp ?? '(none)').padEnd(22)} ${clipBy}`);
}
const kindsSeen = [...new Set(rows.map(r => r.kind))];
console.log(`  rows found: ${rows.length} across kinds ${JSON.stringify(kindsSeen)}`);

console.log('\n-- (b) the clip is on an INNER text container, never on .node --');
for (const cls of ['node-body', 'lo-body', 'label-node']) {
  const r = ruleFor(cls, 'overflow');
  const w = ruleFor(cls, 'overflow-wrap');
  console.log(`  .${cls.padEnd(12)} overflow: ${String(own(cls, 'overflow')).padEnd(8)} (styles.css:${r?.line ?? '-'})  overflow-wrap: ${String(own(cls, 'overflow-wrap')).padEnd(9)} (styles.css:${w?.line ?? '-'})`);
}
const maxH = ruleFor('label-node', 'max-height');
console.log(`  .label-node  max-height: ${own('label-node', 'max-height')}  [styles.css:${maxH?.line ?? '-'}] — caps a box that FILLS its wrapper`);
const editScroll = ruleEq('.label-node.editing .node-label-input', 'overflow-y');
console.log(`  .label-node.editing .node-label-input  overflow-y: ${editScroll?.v ?? '(rule absent)'}  [styles.css:${editScroll?.line ?? '-'}] — the draft scrolls ITSELF, so the grips on the root's border stay uncut`);
console.log(`  NEGATIVE CONTROL — .node itself overflow: ${String(own('node', 'overflow') ?? '(not declared)')} (must NOT be clipped: it would cut the frame + the 4 dots) -> ${clipOf('node') ? 'FAIL' : 'ok'}`);
console.log(`  .node FILLS its wrapper: width ${own('node', 'width')} / min-height ${own('node', 'min-height')} — that is WHY the clip must be inner`);

console.log('\n-- (c) the frame and the controls are NOT inside a clip --');
const frameRule = ruleFor('shape-frame', 'overflow');
console.log(`  .shape-frame { overflow: ${own('shape-frame', 'overflow')} } [styles.css:${frameRule?.line ?? '-'}] — spans the full box, painted by the node root`);
for (const el of ELS.filter(e => e.tag === 'ShapeFrame' || e.tag === 'NodeHandles')) {
  console.log(`  <${el.tag}> ${el.file}:${el.line}  ancestors ${JSON.stringify(el.stack)}  inside a clip: ${insideClip(el)}`);
}
const resizerSites = ELS.filter(e => /\{resizer\}/.test(e.kids));
for (const el of resizerSites) {
  console.log(`  {resizer} ${el.file}:${el.line}  host ${el.cls ?? '(fragment)'}  ancestors ${JSON.stringify(el.stack)}  inside a clip: ${insideClip(el)}`);
}

console.log('\n-- (d) the floors --');
const consts = {};
for (const line of SRC.DiagramNode.split('\n')) {
  const m = /^\s*(?:export\s+)?const\s+([A-Z][A-Z0-9_]*)\s*=\s*([^;]+);/.exec(line);
  if (!m) continue;
  const expr = m[2].trim();
  if (!/^[\w\s+*/().-]+$/.test(expr)) continue;
  let ok = true;
  const v = expr.replace(/[A-Z][A-Z0-9_]*/g, name => {
    if (name in consts) return `(${consts[name]})`;
    ok = false;
    return '0';
  });
  if (!ok) continue;
  try {
    const n = Function(`return (${v})`)();
    if (Number.isFinite(n)) consts[m[1]] = n;
  } catch { /* not arithmetic */ }
}
const nodeMinW = parseInt(String(own('node', 'min-width') ?? ''), 10);
const nodeMinWLine = ruleFor('node', 'min-width');
console.log(`  DiagramNode: NODE_MIN_W ${consts.NODE_MIN_W}  NODE_MIN_H ${consts.NODE_MIN_H}  CSS_CONTENT_MIN_W ${consts.CSS_CONTENT_MIN_W}`);
console.log(`  styles.css : .node { min-width: ${own('node', 'min-width')} } == ${nodeMinW}  [styles.css:${nodeMinWLine?.line ?? '-'}]`);

console.log('\n-- (e) the token gate --');
const HEX_LIMIT = 160;   // raised from 127 by ROUND AG1, which ADDED colour on purpose
const hexes = RAW.css.match(/#[0-9a-fA-F]{3,6}\b/g) ?? [];
console.log(`  hex literals in src/styles.css: ${hexes.length} (limit ${HEX_LIMIT}, raised by ROUND AG1)`);

console.log('\n-- ASSERTIONS --');
const assertions = [];
const assert = (id, pass, detail) => {
  assertions.push({id, pass});
  console.log(`  ${pass ? 'PASS' : 'FAIL'}  ${id}${detail ? '  — ' + detail : ''}`);
};

assert('V1 the row enumeration found rows in every text-carrying kind',
  ['goblin', 'label', 'note', 'table'].every(k => kindsSeen.includes(k)),
  `kinds ${JSON.stringify(kindsSeen)}`);

for (const r of rows) {
  const ok = wrapOf(r) || nowrapClipOf(r);
  assert(`V2 [${r.kind}] .${r.cls} can wrap (or is legitimately a one-line clip)`, ok,
    ok
      ? (wrapOf(r) ? `breaks via ${effective(r.cls, r.el.stack, 'overflow-wrap', true)}` : 'nowrap + clip')
      : `NO word-breaking property and not a nowrap clip (overflow-wrap ${String(effective(r.cls, r.el.stack, 'overflow-wrap', true))}, white-space ${String(effective(r.cls, r.el.stack, 'white-space', true))})`);
}

const goblinRows = rows.filter(r => r.kind === 'goblin');
assert('V3 NEGATIVE CONTROL — no goblin row is truncated; every one of them WRAPS',
  goblinRows.length > 0 && goblinRows.every(r => wrapOf(r) && !nowrapClipOf(r)),
  goblinRows.map(r => `.${r.cls}`).join(' '));

for (const r of rows) {
  if (!fillOf(r.kind)) continue;
  assert(`V4 [${r.kind}] .${r.cls} is clipped (its kind FILLS the wrapper)`,
    clipOf(r.cls) || r.el.stack.some(clipOf),
    clipOf(r.cls) ? `${r.cls} itself` : r.el.stack.filter(clipOf).join(' > '));
}

assert('V5 the goblin text containers are clipped, and wrap',
  clipOf('node-body') && clipOf('lo-body')
    && /anywhere|break-word/.test(String(own('node-body', 'overflow-wrap'))),
  `.node-body overflow ${own('node-body', 'overflow')} / .lo-body overflow ${own('lo-body', 'overflow')}`);

assert('V6 the Text node is clipped AND capped, against a DEFINITE parent box',
  clipOf('label-text') && own('label-text', 'max-height') === '100%'
    && /\b100%/.test(String(own('label-node', 'height') ?? ''))
    && /anywhere|break-word/.test(String(own('label-node', 'overflow-wrap'))),
  `.label-text { overflow: ${own('label-text', 'overflow')}; max-height: ${own('label-text', 'max-height')} }; .label-node height: ${own('label-node', 'height')} (a percentage cap against an auto height is INDEFINITE and would clip nothing); overflow-wrap: ${own('label-node', 'overflow-wrap')}`);

assert('V7 NEGATIVE CONTROL — .node is NOT clipped (the frame and the 4 dots stay outside it)',
  !clipOf('node'),
  `.node { overflow: ${own('node', 'overflow') ?? '(not declared)'} }`);

assert('V8 NEGATIVE CONTROL — .shape-frame is NOT clipped',
  !clipOf('shape-frame') && own('shape-frame', 'overflow') === 'visible'
    && ELS.filter(e => e.tag === 'ShapeFrame').every(e => !insideClip(e)),
  `overflow: ${own('shape-frame', 'overflow')}`);

assert('V9 the four connection handles are NOT inside a clip',
  ELS.filter(e => e.tag === 'NodeHandles').length > 0
    && ELS.filter(e => e.tag === 'NodeHandles').every(e => !insideClip(e)),
  `${ELS.filter(e => e.tag === 'NodeHandles').length} <NodeHandles> site(s)`);

assert('V10 every resize control is NOT inside a clip (all four node branches)',
  resizerSites.length >= 2 && resizerSites.every(e => !insideClip(e)),
  resizerSites.map(e => `${e.file}:${e.line} ${e.cls ?? '(fragment)'}`).join(', '));

assert('V11 the label editor still works: resize off, wrapping on, and it scrolls ITSELF',
  own('node-label-input', 'resize') === 'none'
    && own('node-label-input', 'white-space') === 'pre-wrap'
    && /\b(auto|scroll)\b/.test(String(editScroll?.v ?? ''))
    && !clipOf('label-node'),
  `.node-label-input resize ${own('node-label-input', 'resize')} / white-space ${own('node-label-input', 'white-space')}; editing textarea overflow-y ${editScroll?.v ?? '(absent)'}; .label-node itself clipped: ${clipOf('label-node')}`);

assert('V12 the floors are UNCHANGED (200 / 141 / 190)',
  consts.NODE_MIN_W === 200 && consts.NODE_MIN_H === 141 && consts.CSS_CONTENT_MIN_W === 190
    && nodeMinW === 190,
  `resizer ${consts.NODE_MIN_W}x${consts.NODE_MIN_H}, CSS floor ${nodeMinW}`);

assert('V13 the token gate holds (no new colour literal)',
  hexes.length <= HEX_LIMIT,
  `${hexes.length} hex literals in src/styles.css (ceiling ${HEX_LIMIT}, raised by ROUND AG1 which added colour on purpose)`);

const failed = assertions.filter(a => !a.pass);
console.log(`\nHARNESS: ${assertions.length - failed.length}/${assertions.length} passed`);
if (failed.length) console.log(`  failing: ${failed.map(a => a.id.split(' ')[0]).join(' ')}`);

console.log('\n-- NOT VERIFIED HERE (needs a real browser) --');
console.log('  * the measured overflows themselves (goblin long word 259px right, Text node');
console.log('    65px below at the 200x141 / 140x40 floors). This pass has no browser.');
console.log('  * that a node at 400x300 with fitting text is unchanged to the pixel — the');
console.log('    "no regression" claim. `overflow-wrap: anywhere` does not move a');
console.log('    space-separated line, but only a rendered box can prove it.');
console.log('  * that the corner grips still land ON the border. The ancestry above is a');
console.log('    structural argument; it is not a measurement of the painted dots.');
console.log('* STALE, AND NOW ROUNDED OFF BY ROUND AJ: `.tnode { overflow: hidden }` used');
console.log('  to clip the per-column handles TableNode renders INSIDE it (an 8px handle');
console.log('  centred on the border sits 4px outside and the border-box clip cut it).');
console.log('  ROUND AJ removed the card\'s clip entirely, gave the header/rows their own');
console.log('  inner 8px radius, and raised the handle to the standard 12px.');
console.log('  `checks/round-aj-table-handles.mjs` owns that geometry now; this line is');
console.log('  kept only as the record of what this file observed at the time.');
console.log('  Table nodes are still not resizable.');

process.exit(failed.length ? 1 : 0);
