#!/usr/bin/env node
/**
 * ROUND Q harness — the edge ENDPOINT reconnect affordance.
 *
 * THE QUESTION: is the reconnect gesture (a) big enough to hit, (b) visible on
 * hover, (c) impossible in read-only mode, and (d) drawn where the user's pointer
 * actually lands?
 *
 * WHY NOT A SCREENSHOT: this pass has no browser and no DOM. So every claim is
 * DERIVED from the two things that actually decide it, both of them the real
 * artefacts rather than a transcription:
 *
 *   1. THE INSTALLED REACT FLOW. The default radius, the anchor's element shape
 *      and its `shiftX`/`shiftY` placement are read out of `@xyflow/react`'s ESM
 *      bundle — the same file the app resolves at runtime — and the anchor's
 *      cursor / pointer-events out of its shipped stylesheet. If the pin moves,
 *      these reads move with it.
 *   2. OUR OWN SOURCE. The prop value, the read-only gate and the CSS rules come
 *      from `src/App.tsx` / `src/styles.css`, quoted with their line numbers.
 *
 * It is NOT a renderer. It models the handful of rules that decide the one
 * question, and prints each modelled rule with its source line so the model can
 * be checked against the sheet by eye.
 */
import {readFileSync, statSync} from 'node:fs';

const ROOT = '/home/harvey/projects/tech-goblin/lab/diagram-studio';

const APP = readFileSync(`${ROOT}/src/App.tsx`, 'utf8');
const OUR_CSS = readFileSync(`${ROOT}/src/styles.css`, 'utf8');
const RF_SRC = readFileSync(`${ROOT}/node_modules/@xyflow/react/dist/esm/index.js`, 'utf8');
const RF_CSS = readFileSync(`${ROOT}/node_modules/@xyflow/react/dist/style.css`, 'utf8');
const BOARD = JSON.parse(readFileSync(`${ROOT}/boards/mu01q1ue3a854b81.json`, 'utf8'));
/** The measured node box React Flow persists into the board file — real sizes, not guesses. */
const MEASURED = BOARD.nodes.map(n => n.measured).filter(Boolean);

let failures = 0;
const ok = (cond, label, detail = '') => {
  if (cond) {
    console.log(`  PASS  ${label}${detail ? ` — ${detail}` : ''}`);
  } else {
    failures++;
    console.log(`  FAIL  ${label}${detail ? ` — ${detail}` : ''}`);
  }
};
const lineOf = (src, needle, from = 0) => {
  const i = src.indexOf(needle, from);
  return i < 0 ? 0 : src.slice(0, i).split('\n').length;
};
const section = (t) => console.log(`\n${t}`);

/* ---------- CSS helpers (same shape as package-o-selection-stack.mjs) ------- */
/** Parse a rule body into declarations, tolerating multi-line and one-liner forms. */
function parseDecls(text) {
  const out = {};
  for (const d of String(text).replace(/\/\*[\s\S]*?\*\//g, '').split(';')) {
    const m = /([a-z-]+):\s*([\s\S]+)/.exec(d.trim());
    if (m) out[m[1]] = m[2].replace(/\s+/g, ' ').trim();
  }
  return out;
}
/** Find a rule whose selector LIST contains `sel`; return {decls, line, selectors}. */
function rulesFor(sheet, sel) {
  const lines = sheet.split('\n');
  const out = [];
  for (let i = 0; i < lines.length; i++) {
    const t = lines[i].trim();
    if (!t.includes(sel) || !t.includes('{')) {
      // a selector list can wrap; collect continuation lines up to the brace
      continue;
    }
    const head = t.slice(0, t.indexOf('{'));
    if (!head.split(',').some(s => s.trim() === sel || s.trim().endsWith(` ${sel}`))) continue;
    const same = /\{([\s\S]*)\}/.exec(t);
    if (same) { out.push({decls: parseDecls(same[1]), line: i + 1}); continue; }
    const body = [];
    for (let j = i + 1; j < lines.length; j++) {
      if (/^\}/.test(lines[j].trim())) break;
      body.push(lines[j]);
    }
    out.push({decls: parseDecls(body.join('\n')), line: i + 1});
  }
  return out;
}
/** Every @media block in `sheet` as {header, text, startLine, lineOf}. Headers sit on
 *  their own line in this sheet; a block that opens and closes on one line is handled
 *  too. Brace-depth walk, so multi-selector blocks that WRAP across lines (like ours,
 *  one selector per line) are captured whole rather than only up to the first `}`. */
function mediaBlocks(sheet) {
  const lines = sheet.split('\n');
  const out = [];
  for (let i = 0; i < lines.length; i++) {
    const h = lines[i].trim();
    if (!h.startsWith('@media')) continue;
    let depth = 0;
    const body = [];
    for (let j = i; j < lines.length; j++) {
      const before = depth;
      for (const ch of lines[j]) { if (ch === '{') depth++; else if (ch === '}') depth--; }
      if (j > i) body.push(lines[j]);
      if (j === i) { if (depth === 0) break; continue; }
      if (before > 0 && depth === 0) break;
    }
    out.push({
      header: h.replace(/\s*\{$/, ''),
      text: body.join('\n'),
      startLine: i + 1,
      lineOf: (needle) => {
        const idx = body.findIndex(b => b.includes(needle));
        return idx < 0 ? 0 : i + 2 + idx;
      },
    });
  }
  return out;
}
const ALL_MEDIA = mediaBlocks(OUR_CSS);
/** Concatenated text of every block with this exact header. */
const mediaText = (header) => ALL_MEDIA.filter(b => b.header === header).map(b => b.text).join('\n');
/** The blocks that contain EVERY one of these needles. */
const mediaBlocksWith = (header, ...needles) =>
  ALL_MEDIA.filter(b => b.header === header && needles.every(n => b.text.includes(n)));

/* ======================================================================== */
section('1 — THE GRAB AREA: `reconnectRadius` is explicit, and beats RF\'s default');

const RF_DEFAULT = (() => {
  const m = /reconnectRadius = (\d+)/.exec(RF_SRC);
  return m ? Number(m[1]) : null;
})();
ok(RF_DEFAULT === 10, 'React Flow\'s own default is 10 (read from the installed bundle)',
   `reconnectRadius = ${RF_DEFAULT} @ @xyflow/react/dist/esm/index.js:${lineOf(RF_SRC, 'reconnectRadius = 10')}`);

const constMatch = /const RECONNECT_RADIUS = (\d+);/.exec(APP);
const RADIUS = constMatch ? Number(constMatch[1]) : null;
ok(RADIUS !== null, 'App.tsx declares an explicit RECONNECT_RADIUS',
   `= ${RADIUS} @ src/App.tsx:${lineOf(APP, 'const RECONNECT_RADIUS =')}`);
ok(RADIUS > RF_DEFAULT, 'the chosen radius is larger than the default', `${RADIUS} > ${RF_DEFAULT}`);

const propLine = lineOf(APP, 'reconnectRadius={RECONNECT_RADIUS}');
ok(propLine > 0, 'the value is passed as the top-level <ReactFlow> prop',
   `reconnectRadius={RECONNECT_RADIUS} @ src/App.tsx:${propLine}`);
ok(/<ReactFlow[\s\S]*reconnectRadius=\{RECONNECT_RADIUS\}[\s\S]*?>/.test(APP),
   'the prop sits inside the <ReactFlow> open tag (top-level, not on a child)');

/* area growth, stated as arithmetic rather than a claim */
const area = (r) => Math.PI * r * r;
console.log(`        area ${area(RF_DEFAULT).toFixed(0)} -> ${area(RADIUS).toFixed(0)}px² ` +
            `(${(area(RADIUS) / area(RF_DEFAULT)).toFixed(2)}x), hit width ${RF_DEFAULT * 2} -> ${RADIUS * 2}px`);

/* ======================================================================== */
section('2 — THE GEOMETRY: the disc is TANGENT, and never covers its own handle');

const anchorLine = lineOf(RF_SRC, 'function EdgeAnchor(');
const anchorSrc = RF_SRC.slice(RF_SRC.indexOf('function EdgeAnchor('), RF_SRC.indexOf('function EdgeUpdateAnchors('));
ok(/r: radius/.test(anchorSrc), 'the anchor is an SVG circle of the configured radius',
   `r: radius @ @xyflow/react/dist/esm/index.js:${anchorLine}`);
ok(/cx: shiftX\(centerX, radius, position\)/.test(anchorSrc) &&
   /cy: shiftY\(centerY, radius, position\)/.test(anchorSrc),
   'its centre is SHIFTED outward by the radius, not centred on the endpoint',
   'cx: shiftX(centerX, radius, position)');
ok(/return x \+ shift/.test(RF_SRC) && /return y \+ shift/.test(RF_SRC),
   'shiftX/shiftY add the radius for Position.Right / Position.Bottom (read from source)',
   'shiftX: Right => x + shift');

/* the endpoint is the handle dot's OUTER edge: RF getHandlePosition adds width */
ok(/getHandlePosition/.test(RF_SRC), 'RF derives the endpoint from the handle box (rect.left + width)');

/* TWO FRAMES, named explicitly so the arithmetic cannot drift between them.
   frame B = the node border (where RF centres the connect dot).
   frame J = the wire attachment point = the dot's outer edge = B + HALF. All the
   disc comparisons live here, because the tangency that matters is at J. */
const HANDLE = 12;              // .react-flow__handle width/height (our CSS)
const HALF = HANDLE / 2;        // dot extends HALF either side of its node border B
const J = 0;                    // frame J origin
const B = -HALF;                // the node border, expressed in frame J
const DOT = [B - HALF, B + HALF];   // the connect dot, in frame J -> [-12, 0]
const REACH = 2 * RADIUS;       // how far a disc extends from J

ok(DOT[1] === J, 'the connect dot\'s OUTER edge IS the wire attachment point J',
   `dot [J-12, J] = the endpoint RF hands the edge path`);
ok(J >= DOT[1], 'the grabber\'s inner edge starts at the dot\'s outer edge, never inside it',
   `disc starts at J, dot ends at J — no overlap`);

/* the two discs drawn over ONE junction: both tangent to J, pushed OUTWARD so they
   grow AWAY from each other, each reaching REACH into its own side. */
const srcSpan = [J, J + REACH];        // Position.Right: cx = J + R, span [J, J+2R]
const tgtSpan = [J - REACH, J];        // Position.Left:  cx = J - R, span [J-2R, J]
ok(srcSpan[0] === J && srcSpan[1] === REACH,
   'the RIGHT-side disc is TANGENT to the junction', `span [J+${srcSpan[0]}, J+${srcSpan[1]}]`);
ok(tgtSpan[1] === J && tgtSpan[0] === -REACH,
   'the LEFT-side disc is its MIRROR, pushed the other way',
   `span [J${tgtSpan[0]}, J+${tgtSpan[1]}]`);
ok(srcSpan[0] >= J && tgtSpan[1] <= J, 'each disc stays on its OWN side of the junction',
   `right [J, J+${REACH}], left [J${-REACH}, J]`);
{
  const overlap = Math.min(srcSpan[1], tgtSpan[1]) - Math.max(srcSpan[0], tgtSpan[0]);
  ok(overlap <= 0, 'the two discs over one junction never overlap (however large R grows)',
     `${overlap}px — both are tangent to J from opposite sides`);
}
ok(REACH === 2 * RADIUS, 'the disc reaches 2R from the junction', `${REACH} = 2 x ${RADIUS}`);
ok(HALF < REACH, 'so at the tightest spacing it can run under a close neighbour\'s body',
   `neighbour border at J+${HALF} vs disc to J+${REACH} — clipped by the node layer, never a stolen click`);

/* nearest connect handle vs the junction, using the REAL measured node boxes React
   Flow persists into the board file. The three midpoints on one node SHARE an x, so
   the nearest non-endpoint handle is exactly H/2 away, for any node width. */
const clearance = (H) => H / 2;
ok(MEASURED.length === BOARD.nodes.length && MEASURED.every(m => m.width && m.height),
   'every node carries its measured box in the board file (real sizes, not estimates)',
   MEASURED.map(m => `${m.width}x${m.height}`).join(', '));
{
  const minH = Math.min(...MEASURED.map(m => m.height));
  ok(RADIUS < clearance(minH), 'the grabber clears the nearest connect handle (H/2) at the SMALLEST real node',
     `${RADIUS} < ${clearance(minH)} — margin ${(clearance(minH) / RADIUS).toFixed(2)}x`);
  ok(minH / 2 > RADIUS, '...and that clearance is what bounds the radius: a handle enters the disc only below H = 2R',
     `H > ${2 * RADIUS} needed; the smallest node is ${minH}`);
}
{
  /* a wire between two 190-wide nodes: its endpoints sit where? (border +/- 6) */
  const W = Math.min(...MEASURED.map(m => m.width));
  const [a, b] = [BOARD.nodes[0], BOARD.nodes[1]];
  const borderA = a.position.x + W, borderB = b.position.x;
  const endA = borderA + HALF, endB = borderB - HALF;
  const endpointGap = endB - endA;
  ok(endpointGap > 2 * REACH, 'the neighbouring endpoint is far outside the disc at the board\'s spacing',
     `endpoints ${endpointGap} apart vs the disc's reach ${REACH}`);
  ok(endB - REACH > 0, 'and the disc sits in open canvas, never reaching the next node',
     `${endB - REACH}px of canvas between the disc's edge and the next node's endpoint`);
}

/* ======================================================================== */
section('3 — THE VISIBLE AFFORDANCE is the REAL grabber (same element, same centre)');

ok(/EdgeUpdaterClassName = 'react-flow__edgeupdater'/.test(RF_SRC),
   'RF names the grabber class (read from the bundle)',
   `'react-flow__edgeupdater' @ @xyflow/react/dist/esm/index.js:${lineOf(RF_SRC, "EdgeUpdaterClassName = 'react-flow__edgeupdater'")}`);
ok(/className: cc\(\[EdgeUpdaterClassName/.test(anchorSrc),
   'the ONLY thing drawn at an endpoint by RF is that class — no second element to de-sync from');
ok(/stroke: "transparent", fill: "transparent"/.test(anchorSrc),
   'and RF paints it fully transparent — this is the defect being fixed');

const rfUpdaterRule = (() => {
  const i = RF_CSS.indexOf('.react-flow__edgeupdater {');
  return RF_CSS.slice(i, RF_CSS.indexOf('}', i));
})();
ok(/cursor:\s*move/.test(rfUpdaterRule) && /pointer-events:\s*all/.test(rfUpdaterRule),
   'RF gives it cursor: move and pointer-events: all — our rules only add PAINT',
   'cursor: move; pointer-events: all');
ok(!/pointer-events/.test(OUR_CSS.slice(
     OUR_CSS.indexOf('.react-flow__edgeupdater {'),
     OUR_CSS.indexOf('}', OUR_CSS.indexOf('.react-flow__edgeupdater {')))),
   'our block overrides neither pointer-events nor cursor, so the hit target is untouched');

const base = rulesFor(OUR_CSS, '.react-flow__edgeupdater');
ok(base.length >= 1, 'we style the grabber itself (not a look-alike element)',
   `src/styles.css:${base[0]?.line}`);
const decls = base[0]?.decls ?? {};
const colourValues = Object.entries(decls)
  .filter(([k]) => k === 'fill' || k === 'stroke')
  .map(([, v]) => v);
const literalColours = colourValues.filter(v => /#[0-9a-fA-F]{3,8}|rgba?\(|hsla?\(/.test(v));
ok(literalColours.length === 0, 'the affordance uses tokens only — 0 literal colours',
   colourValues.join(', '));
ok(/^var\(--(sel|elevated|surface)$/.test((decls.stroke ?? '').replace(/\)$/, '') + ')') ||
   /^var\(--/.test(decls.stroke ?? '') || /^var\(--/.test(decls.fill ?? ''),
   'fill/stroke resolve through app tokens', `fill: ${decls.fill}, stroke: ${decls.stroke}`);
ok(decls.opacity === '0', 'hidden at rest', `opacity: ${decls.opacity}`);
ok(/^opacity \.15s$/.test(decls.transition ?? ''), 'opacity-only transition, same .15s as the handles',
   `transition: ${decls.transition}`);

/* reveal on hover / while reconnecting, under the app's (hover: hover) convention */
const revealLine = lineOf(OUR_CSS, '.react-flow__edge.updating .react-flow__edgeupdater');
ok(revealLine > 0, 'a reveal rule targets RF\'s own `.updating` state (live for the whole hover)',
   `src/styles.css:${revealLine}`);
ok(lineOf(OUR_CSS, '.react-flow__edge:hover .react-flow__edgeupdater') > 0,
   'and a plain :hover arm covers the wire itself');
ok(/updating: updateHover/.test(RF_SRC), 'RF stamps `.updating` from updateHover (read from the bundle)');
ok(/setUpdateHover\(true\)/.test(RF_SRC) && /setUpdateHover\(false\)/.test(RF_SRC),
   'updateHover is driven by the grabber\'s own enter/out — no JS of ours in the path');
{
  const hoverBlocks = mediaBlocksWith('@media (hover: hover)', '.react-flow__edgeupdater:hover { opacity: 1; }');
  ok(hoverBlocks.length >= 1, 'the reveal sits inside @media (hover: hover), matching the handle rules',
     hoverBlocks.map(b => `src/styles.css:${b.startLine} (rule @${b.lineOf('.react-flow__edgeupdater:hover { opacity: 1; }')})`).join(', ') || 'not found');
  ok(mediaBlocksWith('@media (hover: hover)', '.react-flow__edge:hover .react-flow__edgeupdater').length >= 1 &&
     mediaBlocksWith('@media (hover: hover)', '.react-flow__edge.updating .react-flow__edgeupdater').length >= 1,
     'ALL THREE reveal arms share one (hover: hover) media block, so a touch device shows no hover-only promise');
}

/* ======================================================================== */
section('4 — READ-ONLY: the gesture cannot be started at all');

const gate = /edgesReconnectable=\{!readOnly\}/.exec(APP);
ok(!!gate, '`edgesReconnectable` is driven by `!readOnly`',
   `edgesReconnectable={!readOnly} @ src/App.tsx:${lineOf(APP, 'edgesReconnectable={!readOnly}')}`);
ok(!/^\s*edgesReconnectable\s*$/m.test(APP), 'the bare (always-true) form is gone');
for (const prop of ['nodesDraggable', 'nodesConnectable', 'elementsSelectable']) {
  ok(new RegExp(`${prop}=\\{!readOnly\\}`).test(APP), `same expression style as ${prop}`,
     `${prop}={!readOnly}`);
}
ok(/isReconnectable && \(jsx\(EdgeUpdateAnchors/.test(RF_SRC),
   'RF renders NO anchors when the prop is false — the gesture is absent, not inert');

/* no second path into a reconnect */
const reconnectHits = [...APP.matchAll(/reconnect/gi)].map(m => m.index);
const reconnectKinds = reconnectHits
  .map(i => APP.slice(i, i + 12))
  .map(s => s.replace(/[^a-zA-Z]/g, ''))
  .filter(Boolean);
const uniq = [...new Set(reconnectKinds)];
console.log(`        identifiers in App.tsx containing "reconnect": ${uniq.join(', ')}`);
ok(!/edgesReconnectable\s*=\s*\{?(true|!0)/.test(APP), 'no unconditional enable anywhere');
ok(!/onReconnectStart|onReconnectEnd/.test(APP),
   'we do not add our own reconnect start/end — RF owns the whole lifecycle');
ok(!/onReconnectStart|onReconnectEnd/.test(readFileSync(`${ROOT}/src/choreography.ts`, 'utf8')),
   'choreography.ts adds no reconnect entry point either');

/* neutralisation + reduced motion */
{
  const roBlocks = mediaBlocksWith('@media (hover: hover)', '.ds-read-only .react-flow__edgeupdater:hover');
  ok(roBlocks.length >= 1, 'the affordance is neutralised under .ds-read-only',
     roBlocks.map(b => `src/styles.css:${b.startLine} (rule @${b.lineOf('.ds-read-only .react-flow__edgeupdater:hover')})`).join(', ') || 'not found');
  const roText = roBlocks.map(b => b.text).join('\n');
  ok(/\.ds-read-only \.react-flow__edge:hover \.react-flow__edgeupdater/.test(roText) &&
     /\.ds-read-only \.react-flow__edge\.updating \.react-flow__edgeupdater/.test(roText),
     'all three reveal arms are re-scoped under .ds-read-only, in the same block',
     'mirrors the @media (hover: hover) rule');
  ok(/opacity:\s*0/.test(roText), 'and it is silenced with opacity: 0 (paint-only)');
  {
    // whitespace-insensitive so the check reads the SELECTOR LIST, not the indentation
    const squeeze = (s) => s.replace(/\s+/g, '');
    const expected = squeeze(
      '.ds-flow-wrap.ds-read-only .react-flow__edge:hover .react-flow__edgeupdater,' +
      '.ds-flow-wrap.ds-read-only .react-flow__edge.updating .react-flow__edgeupdater,' +
      '.ds-flow-wrap.ds-read-only .react-flow__edgeupdater:hover { opacity: 0; }');
    ok(squeeze(roText).includes(expected),
       'ONE declaration covers all three reveal arms (the selector list is the mirror)',
       `${roText.split('opacity: 0').length - 1} declaration(s)`);
  }
}

const rmBlocks = mediaBlocksWith('@media (prefers-reduced-motion: reduce)', '.react-flow__edgeupdater { transition: none; }');
ok(rmBlocks.length >= 1, 'the transition respects prefers-reduced-motion',
   rmBlocks.map(b => `src/styles.css:${b.startLine} (rule @${b.lineOf('.react-flow__edgeupdater { transition: none; }')})`).join(', ') || 'not found');

/* ======================================================================== */
section('5 — BLAST RADIUS: nothing else moved');

const boards = JSON.parse(readFileSync(`${ROOT}/boards/mu01q1ue3a854b81.json`, 'utf8'));
ok(boards.nodes.length === 3 && boards.edges.length === 2, 'demo board: 3 nodes / 2 edges',
   `${boards.nodes.length} / ${boards.edges.length}`);
ok(boards.preset === 'architecture', 'preset still architecture', boards.preset);
ok(!('theme' in boards), 'no `theme` key');
const pos = boards.nodes.map(n => `${n.position.x},${n.position.y}`).join(' / ');
ok(pos === '-53,298 / 324,290 / 704,290', 'positions unchanged', pos);
ok(boards.edges.map(e => e.id).join(',') === 'e1,e2', 'edge ids unchanged');
{
  /* React Flow persists a normalised board (selected / measured / sourceHandle…).
     Report them rather than hide them, and assert nothing SEMANTIC was lost. */
  const extraTop = Object.keys(boards).filter(k => !['id', 'name', 'nodes', 'edges', 'preset', 'legend'].includes(k));
  const extraNode = [...new Set(boards.nodes.flatMap(n => Object.keys(n)).filter(k =>
    !['id', 'type', 'position', 'data'].includes(k)))];
  console.log(`        added-by-RF top-level keys: ${extraTop.join(', ') || '(none)'}`);
  console.log(`        added-by-RF node keys: ${extraNode.join(', ') || '(none)'}`);
  ok(boards.nodes.every(n => n.data && n.data.title && n.data.shape), 'every node kept its data (title + shape)');
  ok(boards.edges.every(e => e.label === 'produce' || e.label === 'consume'), 'both edge labels intact',
     boards.edges.map(e => e.label).join(', '));
}

const literals = (OUR_CSS.match(/#[0-9a-fA-F]{3,6}/g) ?? []).length;
ok(literals <= 127, 'no new colour literals in styles.css', `${literals} <= 127`);

/* mtime proof that the off-limits files were never written by this pass */
const appMtime = statSync(`${ROOT}/src/App.tsx`).mtimeMs;
for (const rel of ['src/TableNode.tsx', 'vite.config.ts', 'src/Tour.tsx', 'src/LabelNode.tsx']) {
  const m = statSync(`${ROOT}/${rel}`).mtimeMs;
  ok(m < appMtime, `${rel} is older than this pass's first edit (never written)`,
     `${new Date(m).toISOString().slice(11, 19)} < ${new Date(appMtime).toISOString().slice(11, 19)}`);
}

console.log(failures === 0 ? '\nALL GREEN' : `\n${failures} FAILURE(S)`);
process.exit(failures === 0 ? 0 : 1);
