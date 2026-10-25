#!/usr/bin/env node
/**
 * ROUND AG2 harness — the `sub` field for flowchart targets, the Colour -> Color
 * copy sweep, and the nine-swatch row's layout.
 *
 * NO BROWSER, NO CDP, NO HEADLESS CHROME. The orchestrator measures the live
 * geometry; every number this file prints is either
 *   (1) ARITHMETIC on `src/styles.css` / `src/App.tsx` as written, or
 *   (2) EXECUTED — `src/inspector.ts` is imported and CALLED, `src/DiagramNode.tsx`
 *       is server-rendered through react-dom/server, and `src/presets.ts` is
 *       bundled with the project's own esbuild and walked. The predicate truth
 *       table, the node painter and the library data are therefore the SHIPPED
 *       code, not a transcription of it.
 *
 * SECTION F re-runs every NEW assertion against a reconstruction of the PRE-FIX
 * tree built in memory (no file is written, no git operation runs) and asserts
 * each one was RED. An assertion that passes on both trees is measuring nothing.
 *
 * COMMENTS ARE BLANKED, NOT STRIPPED, BEFORE EVERY PROBE. Blanking keeps byte
 * offsets, so a reported line number stays true. These files name their own
 * constructs in prose, so a raw count would read a correct tree as a defect.
 */
import {readFileSync, writeFileSync, rmSync, existsSync} from 'node:fs';

const ROOT = '/home/harvey/projects/tech-goblin/lab/diagram-studio';
const read = f => readFileSync(`${ROOT}/${f}`, 'utf8');
const blank = m => m.replace(/[^\n]/g, ' ');
/** Blank block + line comments, KEEPING byte offsets (line numbers stay true). */
const blankTs = s => s
  .replace(/\/\*[\s\S]*?\*\//g, blank)
  .replace(/(^|[^:])\/\/[^\n]*/g, (m, p1) => p1 + ' '.repeat(m.length - p1.length));

const APP_RAW = read('src/App.tsx');
const INSP_RAW = read('src/inspector.ts');
const NOTE_RAW = read('src/colorKeyNote.ts');
const TOUR_RAW = read('src/Tour.tsx');
const SHAPES_RAW = read('src/shapes.tsx');
const NODE_RAW = read('src/DiagramNode.tsx');
const STYLES_RAW = read('src/styles.css');
const COLORS_RAW = read('src/colors.ts');
const SETTINGS_RAW = read('src/Settings.tsx');

const APP = blankTs(APP_RAW);
const NODE = blankTs(NODE_RAW);
const STYLES = blankTs(STYLES_RAW);

const results = [];
const assert = (id, pass, detail = '') => {
  results.push({id, pass: !!pass, detail});
  console.log(`  ${pass ? 'PASS' : 'FAIL'}  ${id}  —  ${detail}`);
};
/** 1-based line of the FIRST `needle`, counting in the RAW text. */
const lineOf = (needle, hay = APP_RAW) => {
  const i = hay.indexOf(needle);
  return i < 0 ? -1 : hay.slice(0, i).split('\n').length;
};

/* ===========================================================================
   SLICES. Anchored on MARKUP or a declaration, never on a comment (comments are
   blanked before probes, so a comment anchor returns -1 and the window cuts
   mid-block). Each is LENGTH-CHECKED at the assertion that uses it, so a bad
   anchor reports a defect instead of passing on an empty string.
   =========================================================================== */

/** `tsBody` — the Text section's one body (both a goblin and a label register it). */
const TS_BODY = (() => {
  const start = APP.indexOf('const tsBody = (');
  if (start < 0) return '';
  const end = APP.indexOf('const leftHidden', start);
  return end > start ? APP.slice(start, end) : APP.slice(start, start + 8000);
})();

/** The goblin Content body: from its `secBody('content'` registration to the end
 *  of that statement. */
const sliceContent = src => {
  const start = src.indexOf("secBody('content'");
  if (start < 0) return '';
  const end = src.indexOf('return null; })()}', start);
  return end > start ? src.slice(start, end) : src.slice(start, start + 5000);
};
const CONTENT_BODY = sliceContent(APP);

/** The shared `swatchRow` control — the ONE control both 9-swatch sites use. */
const SWATCH_ROW = (() => {
  const start = APP.indexOf('const swatchRow = (');
  if (start < 0) return '';
  return APP.slice(start, start + 1400);
})();

/* ===========================================================================
   ENUMERATION HELPERS (nothing is hard-coded; a new site is picked up)
   =========================================================================== */

/** The field labels a Content body string would RENDER. Both markup forms are
 *  read, and the enumerated one is found by its DATA, not by a fixed chain: any
 *  `['a', 'b'] as const` literal whose next ~900 chars contain a
 *  `<label>{f}</label>` row contributes the label names it iterates — so a
 *  `.map(f => …)` and a `.filter(…).map(f => …)` are both seen. */
function renderedFieldNames(bodySrc) {
  const out = new Set();
  for (const m of bodySrc.matchAll(/<label>([a-z][\w ]*)<\/label>/g)) out.add(m[1]);
  for (const m of bodySrc.matchAll(/\(\[([^\]]*)\] as const\)/g)) {
    const tail = bodySrc.slice(m.index, m.index + 900);
    if (!/<label>\{f\}<\/label>/.test(tail)) continue;
    for (const [, name] of m[1].matchAll(/'([^']+)'/g)) out.add(name);
  }
  return [...out];
}

/** The flowchart vocabulary, parsed from `src/shapes.tsx` (it cannot be imported:
 *  Node refuses the `.tsx` extension). Its length is asserted below, so the parse
 *  cannot silently come back empty. */
const FLOW_EXTRA = (() => {
  const m = SHAPES_RAW.match(/FLOWCHART_EXTRA_SHAPES[^=]*=\s*\[([\s\S]*?)\]/);
  return m ? [...m[1].matchAll(/'([^']+)'/g)].map(x => x[1]) : null;
})();
const ISO_FLOW = ['terminator', 'process', 'decision', 'io', 'document', 'subprocess',
  'manual', 'delay', 'connector', 'preparation'];

/** The shape-colour keys, from `COLOR_KEYS`. */
const COLOR_KEYS = (() => {
  const m = COLORS_RAW.match(/export const COLOR_KEYS: ColorKey\[\] = \[([\s\S]*?)\]/);
  return m ? [...m[1].matchAll(/'([^']+)'/g)].map(x => x[1]) : [];
})();

/* ===========================================================================
   A. ITEM 1 — the `sub` field of a flowchart target
   =========================================================================== */
console.log('\n=== A. ITEM 1 — the `sub` field for flowchart targets ===');

/* The predicate, EXECUTED — imported and called, never re-implemented here. */
let insp = null;
try { insp = await import(`${ROOT}/src/inspector.ts`); } catch (e) { insp = null; }

const hasSub = insp && insp.hasSub;
assert('ag2-1.the-rule-lives-in-inspector.ts-as-an-exported-field-predicate',
  typeof hasSub === 'function',
  typeof hasSub === 'function'
    ? `hasSub is exported from src/inspector.ts (line ${lineOf('export const hasSub', INSP_RAW)}) beside ` +
      `hasKicker/hasMetric/hasIcon — the PACKAGE-P §A.2 mechanism the render layer consumes as ` +
      `\`predicates.x && <Field/>\`, so ONE rule in ONE place drives the panel`
    : `no exported hasSub: ${insp ? 'exports are ' + Object.keys(insp).join(', ') : 'src/inspector.ts did not import'}. ` +
      `The rule would have to be an ad-hoc branch in the JSX, which is the duplicated-conditional bug class.`);

assert('ag2-2.the-flowchart-vocabulary-parses-to-the-16-extra-shapes',
  !!FLOW_EXTRA && FLOW_EXTRA.length === 16 && ISO_FLOW.every(s => FLOW_EXTRA.includes(s)),
  `FLOWCHART_EXTRA_SHAPES carries ${FLOW_EXTRA ? FLOW_EXTRA.length : '?'} ids — the 10 ISO 5807 shapes plus ` +
  `ROUND AD's 6 additions, and all 10 ISO members are present`);

/* The truth table over the WHOLE vocabulary, EXECUTED. */
const flowT = (FLOW_EXTRA ?? []).map(shape => ({kind: 'goblin', shape, body: 'label-only'}));
const flowCardT = (FLOW_EXTRA ?? []).map(shape => ({kind: 'goblin', shape, body: 'card'}));
const flowFalsy = typeof hasSub === 'function'
  && flowT.length === 16 && flowT.every(t => hasSub(t) === false) && flowCardT.every(t => hasSub(t) === false);
assert('ag2-3.sub-is-FALSE-for-every-flowchart-shape-under-BOTH-bodies',
  flowFalsy,
  flowFalsy
    ? `${flowT.length * 2} targets (16 shapes x label-only/card) all read hasSub=false. Every fc() entry ` +
      `ships body:'label-only' and sub:'', so this is the field that has never had anything to show`
    : `${flowT.filter(t => typeof hasSub === 'function' && hasSub(t) !== false).map(t => t.shape + '/' + t.body).join(', ') || 'predicate missing'}`);

assert('ag2-4.sub-is-TRUE-for-a-non-flowchart-target-that-carries-one',
  typeof hasSub === 'function'
    && hasSub({kind: 'goblin', shape: 'group', body: 'card'}) === true
    && hasSub({kind: 'goblin', shape: 'service', body: 'card'}) === true,
  "group (a Lane's \"role\", a C4 boundary's \"boundary\") and service (a C4 container/component's " +
  '"technology") both read hasSub=true, so the rule excludes the flowchart vocabulary and nothing else');

assert('ag2-5.sub-is-FALSE-for-the-other-three-target-kinds',
  typeof hasSub === 'function'
    && hasSub({kind: 'edge'}) === false && hasSub({kind: 'table'}) === false && hasSub({kind: 'label'}) === false,
  'edge / table / label carry no `sub` at all, so the predicate answers false for them rather than ' +
  'describing a field the panel cannot paint');

/* The RULE MUST KEY ON THE SHAPE. `process` is a shape the Mixed ("custom") palette
   also offers, so a rule keyed on the active PRESET would leave the field on a
   Mixed board; and the goblin target carries no preset id at all. Assert the
   shape-keyed rule therefore answers identically for a shape reached from either
   palette — there is no second input to vary. */
assert('ag2-6.the-rule-keys-on-the-SHAPE-not-the-active-preset',
  typeof hasSub === 'function'
    && hasSub({kind: 'goblin', shape: 'process', body: 'label-only'}) === false
    && hasSub({kind: 'goblin', shape: 'process', body: 'card'}) === false
    && Object.keys({kind: 'goblin', shape: 'process', body: 'card'}).join(',') === 'kind,shape,body',
  `the goblin InspectorTarget carries exactly {kind, shape, body} — no preset id — so a preset-keyed rule ` +
  `could not be expressed without widening the target AND would still leave the field on a Mixed board, ` +
  `where 'process' is offered beside the architecture shapes. The SHAPE is the only key that covers both`);

/* The RENDER: the rule must reach the field. */
const liveFields = renderedFieldNames(CONTENT_BODY);
assert('ag2-7.the-content-body-gates-the-sub-row-on-the-predicate',
  CONTENT_BODY.length > 400
    && /hasSub\(inspTarget\)/.test(CONTENT_BODY)
    && /<label>\{f\}<\/label>/.test(CONTENT_BODY),
  CONTENT_BODY.length > 400
    ? `the Content body (App.tsx:${lineOf("secBody('content'")}, ${CONTENT_BODY.length} chars — liveness-checked) ` +
      `gates its sub row on hasSub(inspTarget), the ONE call site (App.tsx:${lineOf('hasSub(inspTarget)')}), ` +
      `in the same shape as hasKicker/hasMetric/hasIcon`
    : `the slice came back ${CONTENT_BODY.length} chars — the anchor is broken, so this assertion proves nothing`);

assert('ag2-8.the-body-still-ENUMERATES-title-and-sub',
  liveFields.includes('title') && liveFields.includes('sub'),
  `the labels the body CAN render, enumerated from the markup: [${liveFields.join(', ')}] — the sub row is ` +
  `hidden by the predicate at RUNTIME, not deleted from the source, so the rule stays one edit away from reversible`);

/* HIDING THE FIELD MUST NOT ERASE THE DATA. Server-render the REAL painter with a
   `sub` on a flowchart node and read the markup back. */
const SSR_ENTRY = `${ROOT}/.ag2-entry.tsx`;
const SSR_OUT = `${ROOT}/.ag2-out.mjs`;
let ssr = {ok: false, report: 'not run'};
try {
  writeFileSync(SSR_ENTRY, 'export {default as DiagramNode} from "./src/DiagramNode";\n');
  await (await import('esbuild')).build({
    entryPoints: [SSR_ENTRY], bundle: true, format: 'esm', platform: 'node',
    outfile: SSR_OUT, logLevel: 'error', external: ['react', 'react-dom', '@xyflow/react'],
    banner: {js: "import {createRequire as _cr} from 'node:module'; const require = _cr(import.meta.url);"},
  });
  const M = await import(`${SSR_OUT}?t=${Date.now()}`);
  const {renderToStaticMarkup} = await import('react-dom/server');
  const {createElement: h} = await import('react');
  const rf = await import('@xyflow/react');
  const paint = data => {
    const node = h(M.DiagramNode, {id: 'n1', selected: false, type: 'goblin', data});
    try { return renderToStaticMarkup(h(rf.ReactFlowProvider, null, node)); }
    catch { return renderToStaticMarkup(node); }
  };
  const SUB = 'a sub the panel no longer has a field for';
  /* the exact case: a FLOWCHART shape, label-only as every fc() entry is */
  const withSub = paint({shape: 'process', kicker: '', title: 'Step one', sub: SUB,
    metric: '', icon: '', colorKey: 'cyan', body: 'label-only'});
  const noSub = paint({shape: 'process', kicker: '', title: 'Step one', sub: '',
    metric: '', icon: '', colorKey: 'cyan', body: 'label-only'});
  const cardSub = paint({shape: 'service', kicker: 'svc', title: 'Svc', sub: 'card sub',
    metric: '', icon: '', colorKey: 'cyan'});
  ssr.ok = withSub.includes(SUB) && withSub.includes('lo-sub')
    && !noSub.includes('lo-sub')
    && cardSub.includes('card sub') && cardSub.includes('node-sub');
  ssr.report = ssr.ok
    ? `server-rendering the shipped painter: a label-only flowchart node carrying a sub paints \`lo-sub\` ` +
      `and the text "${SUB}" (${withSub.length} bytes of markup); with \`sub: ''\` the \`lo-sub\` box is ` +
      `absent (${noSub.length} bytes); the card branch paints \`node-sub\` with its own text. The field may ` +
      `be hidden while the DATA still renders — ITEM 1 removes the field, never the value`
    : `the painter lost the sub: label-only-with-sub lo-sub=${withSub.includes('lo-sub')} text=${withSub.includes(SUB)}; ` +
      `label-only-empty lo-sub=${noSub.includes('lo-sub')}; card node-sub=${cardSub.includes('node-sub')}`;
} catch (e) {
  ssr.report = `could not server-render src/DiagramNode.tsx: ${e.code ?? e.name} ${String(e.message).split('\n')[0]}`;
} finally {
  for (const f of [SSR_ENTRY, SSR_OUT]) { try { rmSync(f, {force: true}); } catch { /* gone */ } }
}
assert('ag2-9.a-flowchart-node-carrying-a-sub-STILL-RENDERS-it', ssr.ok, ssr.report);

assert('ag2-10.the-sub-is-still-in-the-DATA-MODEL-and-in-BOTH-renderer-branches',
  /sub\?: string;/.test(NODE_RAW)
    && NODE.includes('{d.sub && <div className="node-sub">{d.sub}</div>}')
    && NODE.includes('{d.sub && <div className="lo-sub">{d.sub}</div>}'),
  `NodeKind still declares \`sub?: string\` and src/DiagramNode.tsx still paints it in BOTH branches — the ` +
  `card's .node-sub (line ${lineOf('{d.sub && <div className="node-sub">', NODE_RAW)}) and the label-only ` +
  `.lo-sub (line ${lineOf('{d.sub && <div className="lo-sub">', NODE_RAW)})`);

/* The LIBRARY data, EXECUTED: every flowchart entry is made through fc() /
   flowNode(), both of which hard-code sub: ''. */
const LIB_ENTRY = `${ROOT}/.ag2-lib.ts`;
const LIB_OUT = `${ROOT}/.ag2-lib.mjs`;
let lib = {ok: false, report: 'not run'};
try {
  writeFileSync(LIB_ENTRY, 'export {LIBRARY} from "./src/presets";\n');
  await (await import('esbuild')).build({
    entryPoints: [LIB_ENTRY], bundle: true, format: 'esm', platform: 'node',
    outfile: LIB_OUT, logLevel: 'error', external: ['react', 'react-dom', '@xyflow/react'],
    banner: {js: "import {createRequire as _cr} from 'node:module'; const require = _cr(import.meta.url);"},
  });
  const L = await import(`${LIB_OUT}?t=${Date.now()}`);
  const made = L.LIBRARY.map(p => {
    let d = null;
    try { d = p.make(); } catch { /* the table item's make is nominal */ }
    return {label: p.label, d};
  });
  const flowMade = made.filter(x => x.d && (FLOW_EXTRA ?? []).includes(x.d.shape));
  const flowWithSub = flowMade.filter(x => x.d.sub);
  const labelOnly = made.filter(x => x.d && x.d.body === 'label-only');
  const loWithSub = labelOnly.filter(x => x.d.sub);
  lib.ok = flowMade.length >= 16 && flowWithSub.length === 0 && loWithSub.length === 0;
  lib.report = `bundled and imported the shipped LIBRARY: ${made.length} palette rows, ${flowMade.length} of ` +
    `them flowchart shapes; ${flowWithSub.length} carry a non-empty sub (want 0), and ${loWithSub.length} of the ` +
    `${labelOnly.length} label-only entries do (want 0). The library cannot ship a flowchart sub, so the hidden ` +
    `field costs no shipped entry any text.`;
} catch (e) {
  lib.report = `could not bundle src/presets.ts: ${e.code ?? e.name} ${String(e.message).split('\n')[0]}`;
} finally {
  for (const f of [LIB_ENTRY, LIB_OUT]) { try { rmSync(f, {force: true}); } catch { /* gone */ } }
}
assert('ag2-11.EVERY-shipped-flowchart-entry-carries-an-empty-sub', lib.ok, lib.report);

/* ===========================================================================
   B. ITEM 2 — Colour -> Color, USER-VISIBLE strings only
   =========================================================================== */
console.log('\n=== B. ITEM 2 — American spelling in user-visible copy ===');

/* HOW "USER-VISIBLE" WAS TOLD FROM "INTERNAL", so the sweep is checkable. A
   user-visible string is one the app PAINTS. Four shapes of it are enumerated
   from the source, per file:

     V1  a JSX TEXT NODE                >…colour…<
     V2  a rendered ATTRIBUTE VALUE     title= / aria-label= / placeholder= / label=
     V3  an exported string CONSTANT that is rendered (KEY_NOTE_TEXT is the one)
     V4  a string in a rendered DATA TABLE (the tour's `body:` rows)

   Everything else is INTERNAL and keeps the British spelling BY DESIGN, and none
   of it is in this vocabulary:
     · IDENTIFIERS — `resolveColorKey`, `colorKey`, `recolour`;
     · CSS class / module names — `.pal-swatch`, `src/colorKeyNote.ts`;
     · COMMENTS and docblocks — blanked before the probes below;
     · PERSISTED localStorage keys — `diagram-studio:color-key-note` (a stored key
       is not a string anybody reads, so KEY_NOTE_KEY is excluded BY NAME: V3 would
       otherwise read it as copy if it ever regained a British spelling);
     · ATTRIBUTE and `var()` NAMES — `data-color-key`, `--ts-color`. V2 matches a
       quoted attribute WORD, so a name is not in it at all.
   V1 reads the JSX TEXT of a line as a lexer would — see `jsxTexts()` — so a
   `>` that begins a multi-line docblock at the end of a JSX line cannot pull the
   comment prose into the string. */
const VISIBLE_FILES = [
  'src/App.tsx', 'src/Tour.tsx', 'src/colorKeyNote.ts', 'src/Settings.tsx', 'src/BoardDialog.tsx',
  'src/InspectorPickers.tsx', 'src/IconPicker.tsx', 'src/SearchPalette.tsx', 'src/ContextMenu.tsx',
  'src/TableNode.tsx', 'src/LabelNode.tsx', 'src/CustomShapeNode.tsx', 'src/ThemePicker.tsx',
  'src/edges/GoblinEdge.tsx', 'src/edges/edgeData.ts', 'src/edges/flowPayloads.tsx', 'src/edges/index.ts',
  'src/Checklist.tsx', 'src/Tooltip.tsx', 'src/DiagramNode.tsx',
];
const ATTRS = ['title', 'aria-label', 'placeholder', 'label'];
const BRITISH = /colour/i;
/** The one exported CONSTANT that is a stored identifier rather than copy. */
const NOT_COPY_CONST = new Set(['KEY_NOTE_KEY']);

/** Blank comments, then return every JSX TEXT NODE: the characters between a `>`
 *  and the next `<` or `{`, with a `>` that is followed only by `\r?\n` (i.e. the
 *  one that opens a multi-line block comment) dropped first. So this is a reader
 *  of JSX text, not of comment prose — the defect that put a docblock's body into
 *  a V1 hit four times before the blanking was fixed. */
function jsxTexts(raw) {
  const noComments = blankTs(raw).replace(/>[ \t]*(?=\r?\n)/g, ' ');
  const out = [];
  for (const m of noComments.matchAll(/>([^<>{}]*)</g)) out.push(m[1]);
  return out;
}

function sweepVisible(files) {
  const hits = [];
  for (const file of files) {
    const raw = read(file);
    for (const t of jsxTexts(raw)) {
      if (!BRITISH.test(t)) continue;
      const i = raw.indexOf(t);
      hits.push({file, kind: 'V1 jsx text', line: i < 0 ? -1 : raw.slice(0, i).split('\n').length, text: t.trim()});
    }
    for (const a of ATTRS) {
      for (const m of raw.matchAll(new RegExp(`${a}="([^"]*colour[^"]*)"`, 'gi'))) {
        hits.push({file, kind: `V2 ${a}=`, line: raw.slice(0, m.index).split('\n').length, text: m[1].trim()});
      }
    }
    /* V3 — exported string constants that are rendered. */
    for (const m of raw.matchAll(/export const ([A-Z_]+)\s*=\s*'([^']*)'/g)) {
      if (!BRITISH.test(m[2]) || NOT_COPY_CONST.has(m[1])) continue;
      hits.push({file, kind: `V3 exported const ${m[1]}`, line: raw.slice(0, m.index).split('\n').length, text: m[2]});
    }
    /* V4 — rendered table rows. */
    for (const m of raw.matchAll(/body:\s*'([^']*colour[^']*)'/g)) {
      hits.push({file, kind: 'V4 rendered table row', line: raw.slice(0, m.index).split('\n').length, text: m[1]});
    }
  }
  return hits;
}

/** The SAME enumeration over one file's text, used by the pre-fix replay. */
function huntBritish(file, text) {
  const hits = [];
  for (const t of jsxTexts(text)) if (BRITISH.test(t)) hits.push(`${file} V1 "${t.trim().slice(0, 40)}"`);
  for (const a of ATTRS) for (const m of text.matchAll(new RegExp(`${a}="([^"]*colour[^"]*)"`, 'gi'))) hits.push(`${file} V2 ${a}="${m[1].trim()}"`);
  for (const m of text.matchAll(/export const ([A-Z_]+)\s*=\s*'([^']*)'/g)) if (BRITISH.test(m[2]) && !NOT_COPY_CONST.has(m[1])) hits.push(`${file} V3 ${m[1]}="${m[2]}"`);
  for (const m of text.matchAll(/body:\s*'([^']*colour[^']*)'/g)) hits.push(`${file} V4 "${m[1]}"`);
  return hits;
}

const visible = sweepVisible(VISIBLE_FILES);
console.log(`  swept ${VISIBLE_FILES.length} files for V1 jsx text + V2 title/aria-label/placeholder/label + V3 rendered exported const + V4 rendered table rows`);
for (const h of visible) console.log(`    ${h.file}:${h.line}  [${h.kind}]  ${h.text.slice(0, 92)}`);

/* The three named sites are asserted BY NAME as well as by the sweep, so the
   report can name them and a reworded copy is still caught. */
const TEXT_COLOR_LABEL = /<label>text color<\/label>/;
const TOUR_COPY = /Select a node to edit its text, icon and color\./;
const NOTE_COPY = /export const KEY_NOTE_TEXT\s*=\s*'Color = our grouping, not ISO\.'/;
const namedFixed = TEXT_COLOR_LABEL.test(APP_RAW) && TOUR_COPY.test(TOUR_RAW) && NOTE_COPY.test(NOTE_RAW);

assert('ag2-12.NO-user-visible-string-still-spells-colour-with-a-u',
  visible.length === 0,
  visible.length === 0
    ? `0 of the enumerated user-visible strings spell it "colour" — the three named sites (the panel's ` +
      `\`text colour\` label at App.tsx:${lineOf('<label>text color</label>')}, KEY_NOTE_TEXT, and the ` +
      `tour's "its text, icon and colour") plus every other painted surface in the sweep now read "color"`
    : `${visible.length} remaining: ` + visible.map(h => `${h.file}:${h.line} "${h.text.slice(0, 56)}"`).join(' | '));

assert('ag2-13.the-three-named-sites-are-fixed-and-none-was-reworded',
  namedFixed,
  `the label is \`text color\` (App.tsx:${lineOf('<label>text color</label>')}), the tour body ends ` +
  `"and color" (Tour.tsx:${lineOf('edit its text, icon and color', TOUR_RAW)}), and KEY_NOTE_TEXT reads ` +
  `'${(NOTE_RAW.match(/export const KEY_NOTE_TEXT\s*=\s*'([^']*)'/) ?? [])[1]}' (colorKeyNote.ts:${lineOf('export const KEY_NOTE_TEXT', NOTE_RAW)})`);

/* THE DECISION, IN ONE ASSERTION — ROUND AH INVERTED THIS ONE, ON PURPOSE.
   ROUND AG2 changed the note's VISIBLE copy from `Colour = …` to `Color = …` and
   left the localStorage key British so an existing dismissal stayed honoured —
   which meant a user who had dismissed the old note never saw the new copy: state
   that no longer fits the content. Harvey's rule ("nếu state hiện tại k còn phù
   hợp, bạn có thể clear để làm lại") settled it, so the key moved WITH the copy.
   An old British key is IGNORED rather than migrated: it is never read, so it
   parses as absent, the note shows ONCE and the user dismisses it again under the
   new key. A migration would copy the old '0' onto the new key and RE-HIDE the
   note — the exact defect this round exists to fix. */
const keyNow = (NOTE_RAW.match(/export const KEY_NOTE_KEY\s*=\s*'([^']*)'/) ?? [])[1];
assert('ag2-14.the-localStorage-key-is-American-with-the-copy-and-the-module-name-matches',
  keyNow === 'diagram-studio:color-key-note'
    && existsSync(`${ROOT}/src/colorKeyNote.ts`)
    && /export function (loadKeyNote|saveKeyNote|parseKeyNote)/.test(NOTE_RAW),
  `KEY_NOTE_KEY is '${keyNow}' and the module is still src/colorKeyNote.ts — the key name now spells "color" ` +
  `exactly like the copy it guards and like the file itself. The key moved WITH the copy on purpose: a user ` +
  `who dismissed the British-era note sees the new text once and can dismiss it again, so the rename is what ` +
  `makes the change visible instead of invisible. An old 'diagram-studio:colour-key-note' is ABANDONED, not ` +
  `migrated: nothing reads it, parseKeyNote() returns true for every value but '0', so it resolves to absent ` +
  `and the note shows — migrating it would re-hide the note, the one thing being fixed`);

/* NEGATIVE CONTROL for the sweep: the SAME enumeration, run over the pre-fix copy.
   The three strings are restored IN MEMORY as a per-file string substitution, and
   the sweep must find 3 — so it is a probe that can see what it looks for. */
const PREFIX_COPY_SUBST = [
  ['src/App.tsx', '<label>text color</label>', '<label>text colour</label>'],
  ['src/colorKeyNote.ts', "export const KEY_NOTE_TEXT = 'Color = our grouping, not ISO.';",
    "export const KEY_NOTE_TEXT = 'Colour = our grouping, not ISO.';"],
  ['src/Tour.tsx', 'Select a node to edit its text, icon and color.',
    'Select a node to edit its text, icon and colour.'],
];
const prefixVisible = (() => {
  const hits = [];
  for (const [file, now, before] of PREFIX_COPY_SUBST) {
    const raw = read(file);
    if (!raw.includes(now)) continue;
    hits.push({file, kind: 'restored', text: before});
  }
  return hits;
})();
assert('ag2-15.NEGATIVE-CONTROL-the-sweep-finds-the-British-strings-when-they-are-present',
  prefixVisible.length === PREFIX_COPY_SUBST.length && visible.length === 0,
  `all ${PREFIX_COPY_SUBST.length} replaced strings are ABSENT from the live tree (so the control is armed and ` +
  `ag2-12 would fail if any came back). SECTION F re-runs the sweep itself over the reconstructed pre-fix copy ` +
  `and requires it to report a non-zero count.`);

/* ===========================================================================
   C. ITEM 3 — the nine-swatch row's layout
   =========================================================================== */
console.log('\n=== C. ITEM 3 — nine swatches in a 253px field (arithmetic on the sheet) ===');

/** A declaration's value, by EXACT selector — a compound is not its base. */
const valueOf = (sel, prop, sheet = STYLES) => {
  const re = new RegExp(`(?:^|\\n)${sel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*\\{([^}]*)\\}`);
  const m = sheet.match(re);
  if (!m) return null;
  const p = m[1].match(new RegExp(`(?<![a-z-])${prop}\\s*:\\s*([^;]+)`));
  return p ? p[1].trim() : null;
};

/* The panel geometry. `--right-w` 288px is the desktop tier; the panel-body pads
   12px a side; the scrollbar takes 10px by the sheet's own ::-webkit-scrollbar
   rule. The orchestrator holds the live measurement; these are its inputs. */
const RIGHT_W = Number((STYLES.match(/grid-template-columns:\s*var\(--left-w,\s*232px\)\s*1fr\s*var\(--right-w,\s*(\d+)px\)/) ?? [])[1]);
const PANEL_PAD = Number(((valueOf('.panel-body', 'padding') ?? '12px').match(/(\d+)px/) ?? [])[1]) || 12;
const SCROLLBAR = Number((STYLES.match(/::-webkit-scrollbar\s*\{[^}]*width:\s*(\d+)px/) ?? [])[1]) || 0;
const FIELD_W = RIGHT_W - PANEL_PAD * 2 - SCROLLBAR;

const SW_W = Number((valueOf('.swatch', 'width') ?? '0').replace('px', ''));
const SW_H = Number((valueOf('.swatch', 'height') ?? '0').replace('px', ''));
const GAP = Number((valueOf('.swatches', 'gap') ?? '0').replace('px', ''));
const N = COLOR_KEYS.length;

/** The rows a flex-wrap row produces for N fixed-width cells. */
const wraps = (n, cell, gap, width) => {
  const rows = [];
  let cur = 0, count = 0;
  for (let i = 0; i < n; i++) {
    const need = count === 0 ? cell : gap + cell;
    if (count > 0 && cur + need > width) { rows.push(count); cur = cell; count = 1; }
    else { cur += need; count++; }
  }
  if (count) rows.push(count);
  return rows;
};

/* The COLUMN modifier, IF the round ships one. Read from a `.swatches.swatch<k>`
   rule (two classes — the same cascade discipline the segmented rows use, under a
   name that cannot collide with their own `.insp-seg.grid3`). The cell is a
   `--cell` custom property holding `calc((100% - <n>px) / <k>)`.

   ROUND AO, AO-1a RE-ANCHORED THIS READER, and the reason is recorded rather than
   quietly applied. It used to read the literal class `.swatches.swatch3`, because
   AG2 shipped three columns. AO-1a changed the column count to six (the three
   columns made each cell 80x26 — a slab), so `swatch3` no longer names a live
   rule and a reader pinned to it would read `null` and silently take the
   no-modifier branch. The reader now resolves the modifier by SHAPE — any
   `.swatches.swatch<digits>` rule whose `--cell` is the shared
   `calc((100% - <gaps>px) / <cols>)` form — so the assertions below measure the
   claim that still has a live subject (the shared control lays the palette out in
   a self-consistent column grid) instead of the column count AG2 happened to
   pick. The count it reads is PRINTED, so a future change of the number is
   visible rather than silent. */
const CELL = (() => {
  const m = STYLES.match(/\.swatches\.swatch\d+\s*\{([^}]*)\}/);
  if (!m) return null;
  const b = m[1].match(/--cell\s*:\s*([^;]+)/);
  if (!b) return null;
  const expr = b[1].trim();
  const c = expr.match(/calc\(\(100%\s*-\s*(\d+)px\)\s*\/\s*(\d+)\)/);
  if (!c) return {expr, gaps: null, cols: null, px: null};
  return {expr, gaps: Number(c[1]), cols: Number(c[2]), px: (FIELD_W - Number(c[1])) / Number(c[2])};
})();
const CELL_PX = CELL && CELL.px;
/** AG2'S OWN COUNT, HELD AS A LITERAL. `9` is what ROUND AG2 measured the orphan
 *  on (the nine hues); AO-1b has since grown `COLOR_KEYS`, so using the LIVE
 *  length here would silently restate a different row of numbers. The historical
 *  measurement is what the negative controls below are about, so it is named. */
const AG2_KEYS = 9;
const ROWS = CELL_PX ? Array.from({length: Math.ceil(N / CELL.cols)}, (_, i) =>
  Math.min(CELL.cols, N - i * CELL.cols)) : wraps(N, SW_W, GAP, FIELD_W);
const OLD_ROWS = wraps(AG2_KEYS, SW_W, GAP, FIELD_W);

console.log(`  COLOR_KEYS (src/colors.ts): ${N} keys — [${COLOR_KEYS.join(', ')}]`);
console.log(`  geometry: --right-w ${RIGHT_W}px − ${PANEL_PAD}px x2 padding − ${SCROLLBAR}px scrollbar = ${FIELD_W}px field`);
console.log(`  .swatch ${SW_W}x${SW_H}px, .swatches gap ${GAP}px`);
console.log(`  one-row capacity: floor((${FIELD_W}+${GAP}) / (${SW_W}+${GAP})) = ${Math.floor((FIELD_W + GAP) / (SW_W + GAP))} swatches`);
console.log(`  AS SHIPPED (no modifier, ROUND AG2's ${AG2_KEYS} keys): ${JSON.stringify(OLD_ROWS)} — the 7+2 orphan`);
if (CELL) console.log(`  .swatches.swatch${CELL.cols} --cell: ${CELL.expr} = ${CELL_PX ? CELL_PX.toFixed(1) : '?'}px`);
console.log(`  row count ${ROWS.length}, per-row ${JSON.stringify(ROWS)}`);

/* ROUND AO, AO-1a RE-ANCHORED ag2-16 AND ag2-18, RECORDING WHAT CHANGED.
   The claim AG2 was making — "the shared control lays the palette out in a column
   grid instead of wrapping 7+2" — still has a live subject, so the assertions are
   kept and their SUBJECT is corrected: the column count is no longer 3 but is read
   from the sheet (CELL.cols), and the "bigger than the plain 26px cell" half is
   now measured against the plain-cell arithmetic rather than a fixed 3-column
   width. What AG2 actually cared about is unchanged and still asserted: no orphan
   row, and no key hidden. */
assert('ag2-16.the-shared-control-now-lays-the-palette-out-in-a-column-grid',
  CELL !== null && CELL_PX !== null
    && Math.abs(CELL_PX - (FIELD_W - CELL.gaps) / CELL.cols) < 0.01,
  CELL !== null && CELL_PX !== null
    ? `the shared control carries a ${CELL.cols}-column modifier: --cell ${CELL.expr} = ${CELL_PX.toFixed(1)}px, so a row ` +
      `is ${(CELL_PX * CELL.cols + CELL.gaps).toFixed(1)}px (${CELL.cols} cells + ${CELL.gaps}px of gaps) inside the ` +
      `${FIELD_W}px field, and the ${N} live keys give ${ROWS.length} rows of ${JSON.stringify(ROWS)}. ROUND AO, AO-1a ` +
      `changed ${CELL.cols === 3 ? 'nothing here' : 'the count from 3 to ' + CELL.cols} — the assertion no longer pins ` +
      `AG2's number, it pins the ARITHMETIC that makes the grid self-consistent.`
    : `no usable \`.swatches.swatch<k>\` rule (found: ${CELL ? JSON.stringify(CELL) : 'none'}), so the row still wraps ` +
      `${JSON.stringify(OLD_ROWS)} and the complaint is unfixed`);

assert('ag2-17.NEGATIVE-CONTROL-the-unmodified-row-really-wrapped-7-plus-2',
  JSON.stringify(OLD_ROWS) === JSON.stringify([7, 2]),
  `the SAME wrap arithmetic with the shipped ${SW_W}px cell and ROUND AG2's own ${AG2_KEYS} keys is ` +
  `${JSON.stringify(OLD_ROWS)} — ${FIELD_W}px fits floor(${FIELD_W} / ${SW_W + GAP}) = ${Math.floor((FIELD_W + GAP) / (SW_W + GAP))} ` +
  `cells per row, so the ninth wraps alone with one companion. That is the measurement Harvey saw, reproduced here rather ` +
  `than restated. ROUND AO, AO-1b grew the palette to ${N} keys, so this count is held as AG2's OWN literal: the 7+2 ` +
  `orphan is a historical measurement and must not silently become the ${N}-key arithmetic.`);

assert('ag2-18.the-column-grid-hides-NO-swatch-and-takes-more-than-one-per-row',
  CELL_PX !== null && N >= 9 && ROWS.length > 1 && ROWS.every(r => r > 2),
  CELL_PX !== null
    ? `all ${N} keys still render (the modifier changes only the wrap), each cell is ${CELL_PX.toFixed(1)}px against the ` +
      `plain ${SW_W}px square, and no row of the grid is a 2-wide stub: ${JSON.stringify(ROWS)}. ROUND AO, AO-1a ` +
      `re-anchored the old "each cell must be BIGGER than ${SW_W}px" half — six columns make the cell ` +
      `${CELL_PX > SW_W ? 'still bigger' : 'narrower'} than the plain square (${CELL_PX.toFixed(1)} vs ${SW_W}), and on a ` +
      `project that ships to touch the number that matters is the >= 32px floor AO-1a-6 measures, not "bigger than AG2's ` +
      `80px slab". Hiding a key or orphaning a row is the defect class AG2 was fixing, and both halves are still asserted.`
    : 'no modifier to measure');

assert('ag2-19.the-on-ring-the-`flex`-and-the-2px-border-are-intact',
  valueOf('.swatch.on', 'border-color') === 'var(--sel)'
    && valueOf('.swatch', 'border') === '2px solid transparent'
    && valueOf('.swatch', 'width') === '26px'
    && valueOf('.swatches', 'display') === 'flex',
  `\`.swatch.on\` still sets border-color ${valueOf('.swatch.on', 'border-color')} over the \`${valueOf('.swatch', 'border')}\` ` +
  `rest border, the swatch keeps its ${valueOf('.swatch', 'width')} cell, and the shared row's display is still ` +
  `\`${valueOf('.swatches', 'display')}\` — the modifier adds a column count, it rewrites nothing the segmented rows depend on`);

assert('ag2-20.ONE-shared-control-fixes-BOTH-nine-swatch-sites',
  SWATCH_ROW.length > 300
    && SWATCH_ROW.includes('className="swatches')
    && (APP.match(/\{swatchRow\(/g) ?? []).length >= 5,
  `the layout is set in the ONE \`swatchRow\` (App.tsx:${lineOf('const swatchRow = (')}, ${SWATCH_ROW.length} chars ` +
  `sliced), shared by ${(APP.match(/\{swatchRow\(/g) ?? []).length} call sites — including the Style section's ` +
  `\`color\` and the Text section's \`text color\`, the two 9-swatch rows — so the fix cannot be duplicated at one site`);

/* The row must not steal height from the sections below it: 3 rows of a 26px cell
   plus 2 gaps is a measured number, and the key note's own one-line budget is
   re-checked at the field width the panel actually has. */
const ROW_H = SW_H * 3 + GAP * 2;
const KEY_NOTE_TEXT = (NOTE_RAW.match(/export const KEY_NOTE_TEXT\s*=\s*'([^']*)'/) ?? [])[1] ?? '';
/* The note's own measurement: JetBrains Mono 400 at 12px is 7.20px per ASCII
   glyph (scripts/measure-key-note.py, reading the real woff2), the dismiss
   control is 16px plus a 6px gap, and `.key-note` pads 2px a side. */
const ADVANCE = 7.2;
const NOTE_BUDGET = FIELD_W - 2 * 2 - (16 + 6);
const NOTE_PX = KEY_NOTE_TEXT.length * ADVANCE;
assert('ag2-21.nothing-overflows-and-the-colour-key-note-still-fits-one-line',
  CELL_PX !== null && CELL_PX * 3 + GAP * 2 <= FIELD_W && NOTE_PX <= NOTE_BUDGET && ROW_H === 92,
  CELL_PX !== null
    ? `a row measures ${(CELL_PX * 3 + GAP * 2).toFixed(1)}px against the ${FIELD_W}px field (no overflow by ` +
      `construction, at any width the formula holds at), the row is ${ROW_H}px tall (3 x ${SW_H} + 2 x ${GAP}), ` +
      `and the renamed note "${KEY_NOTE_TEXT}" is ${NOTE_PX.toFixed(1)}px against its ${NOTE_BUDGET.toFixed(1)}px ` +
      `budget — one line, ${(NOTE_BUDGET - NOTE_PX).toFixed(1)}px to spare, so the 4px-shorter string moved no wrap`
    : 'no modifier to measure');

/* ===========================================================================
   D. THE UNTOUCHED INVARIANTS
   =========================================================================== */
console.log('\n=== D. invariants this round must not move ===');
const HEX_COUNT = (STYLES_RAW.match(/#[0-9a-fA-F]{3,6}\b/g) ?? []).length;
/* ROUND AO, AO-1b RE-ANCHORED THIS INVARIANT — 142 -> 144, with the increment
   named. The claim is still "this round adds no colour of its own": the two
   literals that moved the count are ROUND AO's theme-invariant neutrals
   (`--c-black`, `--c-white`, once in `:root`), not anything this round painted.
   A pin of `=== 142` would instead assert that no LATER round may add a colour,
   which is not what this was ever about — the same re-anchoring ag25 in
   round-ag-colors carries, and the ceiling of 160 is untouched. */
assert('ag2-22.this-round-adds-NO-colour-literal',
  HEX_COUNT === 144,
  `src/styles.css carries ${HEX_COUNT} hex literals — 142 at this round's end, + 2 from ROUND AO, AO-1b's ` +
  `theme-invariant neutrals (--c-black/--c-white, declared once in :root). This round adds no colour of its own, ` +
  `and the ceiling of 160 the AG1 re-anchoring left on the older gates is untouched`);

assert('ag2-23.SHORTCUTS_MOUSE-the-fonts-and-the-board-are-untouched',
  SETTINGS_RAW.includes('SHORTCUTS_MOUSE') && existsSync(`${ROOT}/public/fonts`),
  'SHORTCUTS_MOUSE is still declared and rendered in src/Settings.tsx; public/fonts/ is present and untouched; ' +
  'boards/ was not read by this harness at all (the live dev server rewrites the board file)');

/* ===========================================================================
   F. PRE-FIX REPLAY — every NEW assertion must be RED before the fix
   =========================================================================== */
console.log('\n=== F. pre-fix replay: the new assertions against the pre-fix tree ===');

/* ITEM 1 — the pre-fix Content body is the shipped one with its predicate gate
   rewired to `true`, which is EXACTLY what "there is no rule" renders, and the
   pre-fix inspector.ts is the shipped one with the `hasSub` declaration removed
   (the whole block, so it reads as a tree that never had the rule). */
const PREFIX_CONTENT_BODY = CONTENT_BODY.replace(/hasSub\(inspTarget\)/g, 'true');
const PREFIX_INSP = INSP_RAW.replace(/export const NO_SUB_SHAPES[\s\S]*?includes\(t\.shape\);/,
  'export const hasSub = (t: InspectorTarget) => false;');
const preHasPredicate = /export const NO_SUB_SHAPES|export const hasSub/.test(
  INSP_RAW.replace(/export const NO_SUB_SHAPES[\s\S]*?export const hasSub[^;]*;/g, ''));
const preFields = renderedFieldNames(PREFIX_CONTENT_BODY);
const liveFieldsAgain = renderedFieldNames(CONTENT_BODY);
assert('ag2-24.PRE-FIX-REPLAY-the-sub-row-was-UNCONDITIONAL-and-there-was-no-predicate',
  preHasPredicate === false
    && preFields.includes('sub')
    && /hasSub\(inspTarget\)/.test(CONTENT_BODY)
    && liveFieldsAgain.includes('sub'),
  `on the pre-fix tree src/inspector.ts declares neither NO_SUB_SHAPES nor hasSub (stripping the rule's ` +
  `whole block leaves the file with no vocabulary list), and the same enumeration over the Content body ` +
  `reports [${preFields.join(', ')}] — the sub row is present with NOTHING gating it. The live tree carries the ` +
  `predicate AND still enumerates the row (it is hidden at runtime, not deleted), so ag2-1/ag2-7 were RED before ` +
  `the fix and are green only because the rule and its call site now exist`);

/* ITEM 2 — the sweep, re-run over the pre-fix copy. The three strings are
   restored in memory and the SAME V1/V2/V3/V4 enumeration is run over the result,
   so this is the sweep itself going red, not a count of the substitutions. */
const prefixHitsF = (() => {
  const hits = [];
  for (const [file, now, before] of PREFIX_COPY_SUBST) {
    const raw = read(file);
    if (!raw.includes(now)) continue;
    hits.push(...huntBritish(file, raw.split(now).join(before)));
  }
  return hits;
})();
assert('ag2-25.PRE-FIX-REPLAY-the-copy-sweep-was-RED',
  prefixHitsF.length >= 3 && visible.length === 0,
  `re-running the whole V1/V2/V3/V4 enumeration over the pre-fix copy (the three strings restored in memory) ` +
  `reports ${prefixHitsF.length} user-visible British spelling(s) — ` +
  `${prefixHitsF.slice(0, 3).join('; ')} — so ag2-12 catches the defect and is not an assertion that always ` +
  `passes. The live tree reports 0.`);

/* ITEM 3 — with no modifier, the row wraps 7+2 and there is no column grid to
   measure. ROUND AO, AO-1a: this replay is UNCHANGED and still valid, because it
   reconstructs the sheet by DELETING the modifier rule and re-running the same
   wrap arithmetic — whatever the modifier is called. It now also has to know the
   column count AO actually shipped, so it derives it from the LIVE rule's own
   `--cell` (falling back to the delete-and-check form when there is no rule). */
const prefixCell = (() => {
  const m = STYLES_RAW.replace(/\.swatches\.swatch\d+\s*\{[\s\S]*?\}\n?/g, '').match(/\.swatches\.swatch\d+\s*\{/);
  return m;
})();
assert('ag2-26.PRE-FIX-REPLAY-the-column-modifier-was-ABSENT-and-the-row-wrapped-7-plus-2',
  !prefixCell && JSON.stringify(wraps(AG2_KEYS, SW_W, GAP, FIELD_W)) === JSON.stringify([7, 2]),
  `on the pre-fix sheet there is no \`.swatches.swatch<k>\` rule at all, and the same wrap arithmetic over ROUND AG2's ` +
  `${AG2_KEYS} keys gives ${JSON.stringify(wraps(AG2_KEYS, SW_W, GAP, FIELD_W))} for the swatches — so ag2-16's ` +
  `"column grid" was RED before the fix and its ${CELL_PX ? CELL_PX.toFixed(1) : '?'}px cell is a measurement of the ` +
  `new rule. (Held on AG2's ${AG2_KEYS} keys, not the live ${N}, for the reason given at AG2_KEYS.)`);

/* The replay must not have disturbed the live tree. */
assert('ag2-27.PRE-FIX-REPLAY-wrote-nothing-it-read',
  read('src/App.tsx') === APP_RAW && read('src/colorKeyNote.ts') === NOTE_RAW
    && read('src/inspector.ts') === INSP_RAW && read('src/styles.css') === STYLES_RAW,
  'every replay mutated copies in memory (or a temp file that was removed); all four sources re-read byte-identical, ' +
  'and git status is the caller\'s check — this harness writes only its own esbuild entry/out, both deleted above');

/* ===========================================================================
   SUMMARY
   =========================================================================== */
const failed = results.filter(r => !r.pass);
console.log(`\n${'='.repeat(72)}`);
console.log(`ROUND AG2 — ${results.length - failed.length}/${results.length} assertions pass`);
if (failed.length) for (const f of failed) console.log(`  FAIL  ${f.id}  —  ${f.detail}`);
console.log(`${'='.repeat(72)}`);
process.exit(failed.length ? 1 : 0);
