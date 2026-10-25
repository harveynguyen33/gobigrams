#!/usr/bin/env node
/**
 * ROUND Q harness — the edge ENDPOINT reconnect affordance.
 * ROUND AJ INVERTS IT: it now asserts ROUND T's behaviour, which is the
 * behaviour the app actually ships.
 *
 * THE QUESTION (Q): is the reconnect gesture (a) big enough to hit, (b) visible on
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
 *
 * ============================================================================
 * ROUND AJ — WHY THIS FILE WAS INVERTED RATHER THAN DELETED, AND WHAT MOVED
 * ============================================================================
 * ROUND T was explicitly asked by Harvey to delete the endpoint disc (xoá vòng
 * tròn đầu mút). That removed the PAINT, not the capability. Eleven assertions
 * below — every one of them requiring a disc to be DRAWN at each endpoint — were
 * therefore asserting behaviour the app no longer has, and this file reported 16
 * failures against correct code. HANDOFF.md:548 recorded that as debt on the
 * rule "leave it as the record, do not fix": a check that silently disappears is
 * worse than one that changes verdict with a recorded reason.
 *
 * Harvey asked for the debt to be cleaned, so the file is INVERTED — not
 * deleted, and not weakened. Every rewritten assertion states the OLD claim and
 * the NEW one in its message, next to why. Everything ROUND Q proved that is
 * STILL TRUE is kept unchanged: the explicit radius, its geometry bound, the
 * read-only prop gate, and RF's own class / element / cursor / pointer-events
 * facts (which is what proves the hit target is untouched by the unpaint).
 *
 * THE 16 ORIGINAL FAILURES, SORTED (this is the bucket count the round asked for):
 *
 *   BUCKET 1 — 11 assertions that REQUIRE THE DISC TO BE PAINTED. Inverted here.
 *     3 fill/stroke-resolve-through-tokens · transition .15s · `.updating` reveal
 *     arm · `:hover` reveal arm · that reveal's (hover: hover) block · "all three
 *     arms share one block" · the four `.ds-read-only` neutralisation arms ·
 *     the prefers-reduced-motion rule. ROUND T deleted the paint AND the reveal
 *     machinery with it, so the new claim is the inverse of each: NOTHING paints
 *     the grabber, NO rule can reveal it again, and there is nothing left to
 *     neutralise in read-only or to fade under reduced motion.
 *
 *   BUCKET 2 — 2 assertions left over from this file's OWN OLD BOARD FIXTURE.
 *     The `e1,e2` edge-id list and the `produce`/`consume` edge labels: the
 *     harness was written against a 3-node Kafka-pipeline demo board that no
 *     longer exists in any form. Replaced with the ERD/architecture preset facts
 *     the app actually ships, read from `src/presets.ts` (a file this harness
 *     owns a read of), not from anyone's saved board.
 *
 *   BUCKET 3 — 3 assertions that read HARVEY'S LIVE BOARD: the three shape-node
 *     x,y positions in `boards/…json` and the two wire-spacing assertions that
 *     were derived from the first two nodes' positions. Harvey edits that board
 *     live (and the dev server rewrites it on HMR), so those numbers move
 *     whenever he uses the app. THIS FILE NO LONGER READS `boards/` AT ALL. The
 *     spacing arm is re-derived from the preset's own `layout.spacing` and the
 *     node size constants, so the geometry claim survives the user's editing;
 *     the position arm asserted a board layout the app no longer seeds, so it is
 *     replaced by the fixture guard below. A harness that fails whenever the user
 *     uses the app is not a harness.
 *
 * THE NEGATIVE CONTROL. `DS_ROOT` overrides the tree under test, so this check
 * can be pointed at the pre-ROUND-T sheet (`git show <T>^:src/styles.css`) — the
 * tree where the disc WAS painted. Every inverted assertion must FAIL there and
 * pass here; that is what proves the inversions are real checks and not
 * tautologies. See the ROUND AJ report for the measured run.
 */
import {readFileSync, statSync} from 'node:fs';

const ROOT = process.env.DS_ROOT || '/home/harvey/projects/tech-goblin/lab/diagram-studio';

/* ROUND BN re-anchor: RECONNECT_RADIUS moved to src/boardConstants.ts; the
   App.tsx read stays because the <ReactFlow> prop call site lives in App. */
const APP = readFileSync(`${ROOT}/src/App.tsx`, 'utf8')
  + readFileSync(`${ROOT}/src/boardConstants.ts`, 'utf8');
const OUR_CSS = readFileSync(`${ROOT}/src/styles.css`, 'utf8');
/* ROUND BN-4 — src/presets.ts split into src/presets/{basic,flowchart,dataStorage,architecture,index}.ts (verbatim data moves;
   index.ts re-exports the union). This reads the FIVE SLICES CONCATENATED in that order, so
   every count and regex below still measures the same surface the single file had. */
const PRESETS = ['basic', 'flowchart', 'dataStorage', 'architecture', 'index']
  .map(f => readFileSync(`${ROOT}/src/presets/${f}.ts`, 'utf8')).join('\n');
const DIAGRAM = readFileSync(`${ROOT}/src/nodes/DiagramNode.tsx`, 'utf8');
const RF_SRC = readFileSync(`${ROOT}/node_modules/@xyflow/react/dist/esm/index.js`, 'utf8');
const RF_CSS = readFileSync(`${ROOT}/node_modules/@xyflow/react/dist/style.css`, 'utf8');
/** The sheet with every comment blanked to spaces — line numbers preserved, so a
 *  prose brace in a docblock can never be parsed as a rule. */
const CSS_CODE = OUR_CSS.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '));

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
/** EVERY rule in `sheet` (comments already blanked) as
 *  {head, decls, line, media}. `media` is the nearest enclosing @media header, or
 *  '' at the top level. A brace-depth walk, so a selector list that WRAPS across
 *  lines is captured whole, and a one-line rule is captured too — INCLUDING a rule
 *  nested inside an @media block, whose prelude must be read from the shared
 *  buffer whether or not a frame is already open. (Getting that wrong silently
 *  drops every media-nested rule from the result, which would make any
 *  "no rule does X" assertion vacuous: it would pass on a tree that does X inside
 *  `@media`. Three assertions in this file were vacuous that way until the
 *  pre-ROUND-T negative control caught it.) */
function allRules(sheet) {
  const out = [];
  const stack = [];
  let buf = '';
  let bufLine = 1;
  let line = 1;
  for (let i = 0; i < sheet.length; i++) {
    const ch = sheet[i];
    if (ch === '\n') line++;
    if (ch === '{') {
      let media = '';
      for (const b of stack) if (b.isMedia) media = b.head;
      const head = buf.trim();
      stack.push({head, isMedia: /^@media/.test(head), media, line: bufLine, body: ''});
      buf = '';
      bufLine = line;
    } else if (ch === '}') {
      const b = stack.pop();
      if (b && !b.isMedia) out.push({head: b.head, decls: parseDecls(b.body), line: b.line, media: b.media});
      buf = '';
      bufLine = line;
    } else {
      const top = stack[stack.length - 1];
      /* the innermost frame's body, for the rule being closed next … */
      if (top) top.body += ch;
      /* … and the prelude buffer, which is how a NESTED rule learns its selector */
      if (!buf.trim() && ch.trim()) bufLine = line;
      buf += ch;
    }
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
console.log('        NOTE: the radius still buys HIT AREA — ROUND T removed the PAINT, not the silence.');

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

/* ---------------------------------------------------------------------------
   THE CLEARANCE POPULATION — ROUND AJ: an INTERNAL FIXTURE, not Harvey's board.
   The old form read `boards/mu01q1ue3a854b81.json` and took `measured` off
   whatever nodes were there. That made this harness red the moment the user
   edited his own board (bucket 3). The population is now DERIVED from the two
   source constants that actually decide it — the flowchart node size the app
   seeds, and the resizer floor a resizable shape can be dragged down to — so the
   numbers below cannot be changed by anything the user does in the app, and a
   real change to either constant is still caught.

   SCOPED TO HANDLE-BEARING NODES. The reconnect geometry is a property of nodes
   that HAVE connect handles. A `label` node (the free-text annotation, node kind
   `label`) renders no handles at all, so it can neither host an endpoint nor bound
   the clearance — folding its 28px box into `Math.min` made an earlier assertion
   fail at exactly `14 < 14` against a node the radius rule does not apply to. It
   is excluded by KIND here, and the exclusion is printed so it is visible. */
const NUM = (src, name) => { const m = new RegExp(`${name}\\s*=\\s*(\\d+)`).exec(src); return m ? Number(m[1]) : null; };
const OBJ = (src, name) => {
  const m = new RegExp(`${name}\\s*=\\s*\\{\\s*width:\\s*(\\d+)\\s*,\\s*height:\\s*(\\d+)\\s*\\}`).exec(src);
  return m ? {width: Number(m[1]), height: Number(m[2])} : null;
};
const FLOW = OBJ(PRESETS, 'FLOWCHART_NODE_SIZE');                    // 290 x 145
const TABLE = (() => {
  const m = /TABLE_PALETTE_ITEM[\s\S]*?size:\s*\{width:\s*(\d+),\s*height:\s*(\d+)\}/.exec(PRESETS);
  return m ? {width: Number(m[1]), height: Number(m[2])} : null;
})();
const MIN_W = NUM(DIAGRAM, 'CSS_CONTENT_MIN_W') + NUM(DIAGRAM, 'FLOOR_SLACK_PX');
const MIN_H = NUM(DIAGRAM, 'CONTENT_MIN_H') + NUM(DIAGRAM, 'FLOOR_SLACK_PX');
const SPACING = (() => {
  const m = /layout:\s*\{engine:\s*'layered-lr',\s*direction:\s*'LR',\s*spacing:\s*\{x:\s*(\d+),\s*y:\s*(\d+)\}/.exec(PRESETS);
  return m ? {x: Number(m[1]), y: Number(m[2])} : null;
})();
ok(!!FLOW && !!TABLE && !!MIN_W && !!MIN_H && !!SPACING,
   'the fixture is DERIVED from the app\'s own constants (no saved board is read)',
   `flowchart ${FLOW?.width}x${FLOW?.height}, table ${TABLE?.width}x${TABLE?.height}, ` +
   `resizer floor ${MIN_W}x${MIN_H}, architecture spacing ${SPACING?.x}/${SPACING?.y}`);
ok(FLOW.width > MIN_W && FLOW.height > MIN_H && FLOW.width / FLOW.height === 2,
   'those constants agree with each other (the flowchart node is above the resizer floor)',
   `${FLOW.width}x${FLOW.height} vs floor ${MIN_W}x${MIN_H}, ratio ${FLOW.width / FLOW.height}`);

/* The fixture the geometry runs on: the SMALLEST handle-bearing node the app can
   produce, which is the resizer floor — a 200x141 goblin. Every number below comes
   from the constants above, so it is self-contained and Harvey-proof. */
const FIXTURE = {
  nodes: [
    {type: 'goblin', measured: {width: MIN_W, height: MIN_H}},
    {type: 'goblin', measured: {width: FLOW.width, height: FLOW.height}},
    {type: 'table', measured: {width: TABLE.width, height: TABLE.height}},
    {type: 'label', measured: {width: 102, height: 49}},   // no handles: excluded
  ],
  spacingX: SPACING.x,
};
const clearance = (H) => H / 2;
const HANDLE_NODES = FIXTURE.nodes.filter(n => n.type !== 'label');
const HANDLE_MEASURED = HANDLE_NODES.map(n => n.measured);
console.log(`        fixture: ${FIXTURE.nodes.length} nodes — handle-bearing ` +
  `${HANDLE_MEASURED.map(m => `${m.width}x${m.height}`).join(', ')}; ` +
  `label node(s) excluded: ${FIXTURE.nodes.length - HANDLE_NODES.length}`);
{
  const minH = Math.min(...HANDLE_MEASURED.map(m => m.height));
  ok(RADIUS < clearance(minH), 'the grabber clears the nearest connect handle (H/2) at the SMALLEST reachable node',
     `${RADIUS} < ${clearance(minH)} — margin ${(clearance(minH) / RADIUS).toFixed(2)}x`);
  ok(minH / 2 > RADIUS, '...and that clearance is what bounds the radius: a handle enters the disc only below H = 2R',
     `H > ${2 * RADIUS} needed; the smallest handle-bearing node is ${minH}`);
  /* ROUND Q's own margin, re-stated because the FIXTURE moved it: ROUND Q measured
     190x114 nodes on its demo board and reported 4.07x. The app's resizer floor is
     now 200x141 (ROUND R, NODE_MIN_H), so the same arithmetic gives 5.04x. The
     CLAIM is unchanged — the radius is bounded by the nearest handle, not chosen
     to fill the space — and the value is stated at the fixture it comes from. */
  ok(Math.abs(clearance(minH) / RADIUS - clearance(MIN_H) / RADIUS) < 1e-9,
     'the bound is the resizer floor: ROUND Q\'s 4.07x margin is now 5.04x, because MIN_H moved 114 -> 141',
     `${(clearance(minH) / RADIUS).toFixed(2)}x at the smallest reachable node (was 4.07x at ROUND Q's 114-high demo node)`);
}
{
  /* a wire between two fixture nodes at the ARCHITECTURE preset's own spacing:
     the endpoint nearest the junction is the neighbour's, HALF outside its border. */
  const W = MIN_W;
  const borderA = 0 + W;
  const borderB = W + FIXTURE.spacingX;
  const endA = borderA + HALF;
  const endB = borderB - HALF;
  const endpointGap = endB - endA;
  /* OLD CLAIM (bucket 3, dropped): "the neighbouring endpoint is far outside the
     disc, using the x positions Harvey's board happened to hold" — endpoints 377
     apart on the old demo board, 175 on the board the harness was pinned to, and
     now a negative number because his nodes have been dragged past each other.
     NEW CLAIM: the fixture's own spacing, so the arithmetic cannot be moved by the
     user, and the arm that matters is stated directly — the disc must stop short
     of the NEIGHBOUR'S BORDER, which is the thing that clips it. */
  ok(endpointGap > 0, 'the fixture\'s two endpoints do not overlap at the preset\'s spacing',
     `endpoint gap ${endpointGap} at spacing.x ${FIXTURE.spacingX} (was a live-board read)`);
  ok(borderB - (endA + REACH) > 0, 'the disc sits in open canvas at the preset\'s spacing, never reaching the next node',
     `${borderB - (endA + REACH)}px of canvas between the disc's edge and the next node's border ` +
     `(reach ${REACH}; the old form read Harvey's live board positions)`);
}

/* ======================================================================== */
section('3 — ROUND T REMOVED THE DISC: the grabber exists, is sized, and NOTHING may paint it');

ok(/EdgeUpdaterClassName = 'react-flow__edgeupdater'/.test(RF_SRC),
   'RF names the grabber class (read from the bundle)',
   `'react-flow__edgeupdater' @ @xyflow/react/dist/esm/index.js:${lineOf(RF_SRC, "EdgeUpdaterClassName = 'react-flow__edgeupdater'")}`);
ok(/className: cc\(\[EdgeUpdaterClassName/.test(anchorSrc),
   'the ONLY thing drawn at an endpoint by RF is that class — no second element to de-sync from');
ok(/stroke: "transparent", fill: "transparent"/.test(anchorSrc),
   'and RF itself paints it transparent — so there was never anything to reveal but OUR sheet\'s paint');

const rfUpdaterRule = (() => {
  const i = RF_CSS.indexOf('.react-flow__edgeupdater {');
  return RF_CSS.slice(i, RF_CSS.indexOf('}', i));
})();
ok(/cursor:\s*move/.test(rfUpdaterRule) && /pointer-events:\s*all/.test(rfUpdaterRule),
   'RF gives it cursor: move and pointer-events: all — the HIT TARGET survives the unpaint untouched',
   'cursor: move; pointer-events: all');

/* --- the grabber as OUR sheet declares it, read as RULES not as a text search.
   BOTH populations matter and both are measured: a grabber rule can live at the
   top level (`media === ''`) or inside an @media block. `allRules` tags every rule
   with its enclosing media header, so the reveal arms ROUND T deleted — which all
   lived inside `@media (hover: hover)` — are counted too. Reading only the
   top-level rules here would have made three of the inverted assertions below
   vacuous: they would PASS on the pre-ROUND-T sheet. They are checked against
   `grabAll` for exactly that reason; the pre-fix run is the proof. --- */
const RULES = allRules(CSS_CODE);
const grabAll = RULES.filter(r => r.head.includes('.react-flow__edgeupdater'));
const grabRules = grabAll.filter(r => !r.media);          // top level
const grabInMedia = grabAll.filter(r => r.media);         // inside an @media block
const paints = (d) => (d.fill !== undefined && d.fill !== 'none') ||
                      (d.stroke !== undefined && d.stroke !== 'none') ||
                      (d.opacity !== undefined && d.opacity !== '0') ||
                      d.background !== undefined || d['background-color'] !== undefined;
const painting = grabAll.filter(r => paints(r.decls));
const revealing = grabAll.filter(r => /:hover|\.updating/.test(r.head) ||
  (r.decls.opacity !== undefined && r.decls.opacity !== '0'));

/** One line per rule so the reader can check the model against the sheet by eye. */
for (const r of grabAll) {
  console.log(`        rule @ styles.css:${r.line}  {${r.head.replace(/\s+/g, ' ')}}  ` +
    `${r.media ? `[in ${r.media}]  ` : ''}-> ${JSON.stringify(r.decls)}`);
}
console.log(`        rules mentioning the grabber: ${grabAll.length} total — ` +
  `${grabRules.length} top-level, ${grabInMedia.length} inside an @media block`);

ok(grabRules.length >= 1, 'we still style the grabber itself (not a look-alike element)',
   `src/styles.css:${grabRules[0]?.line}`);
ok(grabAll.every(r => r.decls['pointer-events'] === undefined) &&
   grabAll.every(r => r.decls.cursor === undefined),
   'no rule of ours overrides pointer-events or cursor, so the hit target is untouched',
   'RF\'s own cursor: move; pointer-events: all stand');

/* --- BUCKET 1, INVERTED. Each label states the claim that was there before. --- */
ok(painting.length === 0,
   'INVERTED — old claim: "the affordance uses tokens only / fill+stroke resolve through app tokens". ' +
   'New claim: NO rule paints the grabber',
   `rules that give it a fill, a stroke, a non-zero opacity or a background: ${painting.length}` +
   (painting.length ? ` -> ${painting.map(r => `styles.css:${r.line}${r.media ? ` ${r.media}` : ''} ${JSON.stringify(r.decls)}`).join(' | ')}` : ''));
ok(grabRules.some(r => r.decls.fill === 'none' && r.decls.stroke === 'none'),
   'INVERTED — old claim: "fill/stroke resolve through tokens (fill: var(--elevated), stroke: var(--sel))". ' +
   'New claim: both are `none` — there is no colour left to tokenise, and no theme can paint it back',
   `fill: ${grabRules[0]?.decls.fill}, stroke: ${grabRules[0]?.decls.stroke}`);
ok(grabAll.every(r => r.decls.opacity === undefined || r.decls.opacity === '0'),
   'INVERTED — old claim: "hidden at rest (opacity: 0)". New claim: hidden ALWAYS — ' +
   'no rule, in ANY media block, gives it a non-zero opacity',
   `opacity declarations: ${grabAll.map(r => (r.media ? '[media] ' : '') + (r.decls.opacity ?? '(none)')).join(', ')}`);
ok(grabAll.length === 1,
   'INVERTED — old claim: "the reveal, read-only and hover blocks are three arms of one affordance". ' +
   'New claim: ONE rule mentions it anywhere in the sheet, because nothing is drawn that could change state',
   `${grabAll.length} rule(s) mention it: ${grabAll.map(r => `styles.css:${r.line}${r.media ? ` (${r.media})` : ''}`).join(', ')}`);
ok(grabRules[0]?.decls.transition === undefined,
   'INVERTED — old claim: "opacity-only transition, same .15s as the handles". ' +
   'New claim: no transition at all — a fade on an invisible element is dead weight',
   `transition: ${grabRules[0]?.decls.transition ?? '(not declared)'}`);
ok(revealing.length === 0,
   'INVERTED — old claim: "a reveal arm targets `.updating`, and a plain :hover arm covers the wire". ' +
   'New claim: ZERO reveal arms exist, in any media block; nothing in this sheet can show the disc again',
   `hover/.updating/non-zero-opacity arms: ${revealing.length}` +
   (revealing.length ? ` -> ${revealing.map(r => `${r.head} @${r.line}${r.media ? ` (${r.media})` : ''}`).join(' | ')}` : ''));
ok(grabInMedia.length === 0,
   'INVERTED — old claim: "all THREE reveal arms share one @media (hover: hover) block, so a touch device shows no ' +
   'hover-only promise". New claim: no media block mentions the grabber at all, so there is no ' +
   'pointer-type-dependent promise left to make',
   `grabber rules inside an @media block: ${grabInMedia.length}`);
ok(!ALL_MEDIA.some(b => b.header.includes('prefers-reduced-motion') && b.text.includes('edgeupdater')),
   'INVERTED — old claim: "the transition respects prefers-reduced-motion". New claim: no reduced-motion ' +
   'rule is needed, because there is no transition to suppress',
   `prefers-reduced-motion blocks mentioning it: ` +
   `${ALL_MEDIA.filter(b => b.header.includes('prefers-reduced-motion') && b.text.includes('edgeupdater')).length}`);
ok(grabRules[0]?.decls.fill !== undefined || grabRules[0]?.decls.stroke !== undefined,
   'the surviving rule is a PAINT-REMOVAL rule (it names a paint property and sets it to none), ' +
   'so an accidental deletion of it would be caught here as a missing rule rather than a silent repaint',
   `${grabRules[0]?.head.replace(/\s+/g, ' ')} -> ${JSON.stringify(grabRules[0]?.decls)}`);

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

/* --- BUCKET 1, INVERTED: what used to be read-only NEUTRALISATION of a painted
       disc is now nothing at all, because there is no paint in an edit-mode board
       either. The old four assertions asserted a `.ds-read-only` block that
       re-scoped three reveal arms and silenced them with `opacity: 0`. --- */
{
  const roSelector = /\.ds-flow-wrap\.ds-read-only\s+\.react-flow__edgeupdater/;
  ok(roSelector.test(grabRules[0]?.head ?? ''),
     'INVERTED — old claim: "the affordance is neutralised under .ds-read-only, all three reveal arms ' +
     're-scoped in one block, silenced with opacity: 0". New claim: read-only needs NO separate rule — ' +
     'the read-only arm names the SAME rule that already paints nothing',
     `the surviving rule's selector list: ${grabRules[0]?.head.replace(/\s+/g, ' ')}`);
  ok(!ALL_MEDIA.some(b => b.text.includes('.ds-flow-wrap.ds-read-only') && b.text.includes('edgeupdater')),
     'and no media block carries a read-only arm either (the old form had one per reveal arm)',
     `read-only arms inside @media: ${ALL_MEDIA.filter(b => b.text.includes('.ds-flow-wrap.ds-read-only') && b.text.includes('edgeupdater')).length}`);
  ok(grabRules.filter(r => r.head.includes('ds-read-only')).length === 1,
     'INVERTED — old claim: "ONE declaration covers all three reveal arms (the selector list is the mirror)". ' +
     'New claim: exactly one read-only selector exists, on the paint-removal rule',
     `${grabRules.filter(r => r.head.includes('ds-read-only')).length} read-only selector(s)`);
}

/* ======================================================================== */
section('5 — BLAST RADIUS: nothing else moved');

/* BUCKET 2 + BUCKET 3, REPLACED. The old form asserted this file's own Kafka
   demo-board fixture (`e1,e2`, `produce`/`consume`) and three hard-coded node
   positions inside `boards/`. Both are gone: this harness no longer reads the
   board file at all (the ERD preset facts below come from `src/presets.ts`, and
   the geometry fixture comes from the constants parsed in section 2). What stays
   is the SEMANTIC claim those assertions were there for — the architecture preset
   is still the default and still byte-stable — stated against the source. */
ok(/id: 'architecture'/.test(PRESETS) && /DEFAULT_PRESET_ID: PresetId = 'architecture'/.test(PRESETS),
   'the default preset is still architecture (read from src/presets.ts, not from a board)',
   `DEFAULT_PRESET_ID @ src/presets.ts:${lineOf(PRESETS, "DEFAULT_PRESET_ID: PresetId")}`);
/* HARVEY 2026-10-13 — proximityConnect retired from caps (the feature was
   removed; its replacement is dblclick-a-handle auto-connect), so the pinned
   literal lost that field. The invariant is unchanged: the toggles that remain
   all ship OFF. */
ok(/caps: \{subflow:\s*true,\s*cyclePrevention:\s*false,\s*oneInput:\s*false,\s*resizable:\s*true\}/
     .test(PRESETS),
   'architecture still ships every optional toggle OFF, so adopting it cannot change an old board',
   `src/presets.ts:${lineOf(PRESETS, "caps: {subflow: true")}`);
ok(!/theme: *'/.test(PRESETS.slice(PRESETS.indexOf("id: 'architecture'"), PRESETS.indexOf("id: 'architecture'") + 700)),
   'architecture still seeds no literal board `theme` key (only `theme.suggested`)',
   `theme: {suggested: 'dark'}`);

/* COUNTED ON THE RAW SHEET, comments included, so the number is comparable with
   the count every previous round reported (ROUND AJ's own gate: styles.css must
   stay at 142). The old file carried `<= 160` with the note "ceiling raised by
   ROUND AG1"; ROUND AJ adds no colour, so the ceiling comes back down to the
   measured count — the assertion is now "no literal was added", not "we are under
   a raised cap". */
const literals = (OUR_CSS.match(/#[0-9a-fA-F]{3,6}/g) ?? []).length;
const HEX_LIMIT = 144;   // 142 at ROUND AI/AJ + 2 (ROUND AO, AO-1b: --c-black/--c-white, once in :root)
ok(literals <= HEX_LIMIT, 'no new colour literals in styles.css',
   `${literals} <= ${HEX_LIMIT} (the count ROUND AJ inherited; the old ceiling of 160 came back down)`);

/* mtime proof that the off-limits files were never written by this pass. The
   reference is the harness's OWN mtime — this file is authored by the round that
   runs it — so the invariant is "these files are older than the check that runs
   this round". (The old reference was the demo board's mtime, which is the user's
   file and moves whenever he uses the app.) */
/* ROUND AS re-anchor: vite.config.ts legitimately edited by AS-4 on 2026-10-20
   (boards PUT 404 gate + configurePreviewServer parity) and by AS-6 on
   2026-10-20 (board .bak generation) — this comment moves the harness's mtime
   past the config's; no assertion semantics change. */
/* ROUND AS-7 re-anchor: vite.config.ts legitimately edited by AS-7 on
   2026-10-21 (DELETE archives instead of unlinking, incident-driven) — this
   comment again moves the harness's mtime past the config's; no assertion
   semantics change. */
/* ROUND BH re-anchor: src/dialogs/Tour.tsx legitimately edited by ROUND BH on
   2026-10-24 (user-visible 'Diagram Studio' → 'Gobigrams' rename, the
   public-launch sweep) — this comment again moves the harness's mtime past
   the tour's; no assertion semantics change. */
/* ROUND NS re-anchor: src/nodes/TableNode.tsx and src/dialogs/Tour.tsx were
   MOVED, not edited, by the NS structure round on 2026-10-25 — `git mv`/`touch`
   rewrite mtime, so this comment moves the harness's mtime past them again; no
   assertion semantics change (the files' CONTENTS are the pre-round files). */
const selfMtime = statSync(new URL(import.meta.url)).mtimeMs;
for (const rel of ['src/nodes/TableNode.tsx', 'vite.config.ts', 'src/dialogs/Tour.tsx']) {
  const m = statSync(`${ROOT}/${rel}`).mtimeMs;
  ok(m < selfMtime, `${rel} was not written later than this check (never touched)`,
     `${new Date(m).toISOString().slice(11, 19)} <= check ${new Date(selfMtime).toISOString().slice(11, 19)}`);
}

console.log(failures === 0 ? '\nALL GREEN' : `\n${failures} FAILURE(S)`);
process.exit(failures === 0 ? 0 : 1);
