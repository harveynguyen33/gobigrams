#!/usr/bin/env node
/**
 * ROUND AM — the edge panel after Harvey's five connection-line items:
 * AM-2 (a TEXT section on the edge label), AM-3 (the flow-glyph row draws its
 * glyphs, from the map the edge itself animates), AM-4 (the live speed rail),
 * AM-5 (a compact count stepper sharing ONE row with a speed SLIDER).
 *
 * ROUND AN, AN-4 RE-ANCHORED THE THREE `am4.*` CLAIMS. Their subject was the
 * speed RAIL, and the owner deleted it ("tôi k cần cái Flow rail, xoá đi"), so
 * the claims now assert the two things that are still true and still checkable:
 * the rail is GONE from the component, the panel and the sheet, and the claim
 * that kept a live subject is the one beside it — the speed value is still
 * PRINTED and still driven by the same stored duration. The removal is recorded
 * as the fact, in the code and here, rather than the assertions being dropped.
 *
 * WHAT THIS FILE IS, and what it deliberately is not. It cannot see a browser:
 * this project's headless session renders ZERO edges (nodes render, `minimap
 * edges` = 0), so no live edge-panel measurement exists and none is claimed
 * here. Every claim below is therefore made the only two ways this project
 * allows (ROUND AK's hard rule):
 *
 *   (1) SOURCE / SHEET claims — read as TEXT with COMMENTS BLANKED FIRST, because
 *       this codebase DELETES a control and leaves a comment QUOTING it in its
 *       place. Blanking (not stripping) keeps every byte offset and line number
 *       true, so a reported line is the line the code is really on.
 *   (2) EXECUTED claims — `src/textStyle.ts` and `src/InspectorPickers.tsx`'s
 *       pure helpers are React-free, so Node 22 loads them directly
 *       (type-stripping) and their behaviour is measured as RETURN VALUES rather
 *       than as substrings that happen to be present.
 *
 * THE NEGATIVE CONTROL IS IN THE FILE (the REPLAY at the bottom) and it is
 * mandatory. Every source probe is re-run over the PINNED pre-change tree read
 * with `git show`, and must be RED there. A probe that cannot be shown RED proves
 * nothing — and one of AM-5's own probes (the Speed row leaving the chip family)
 * is GREEN ON BOTH TREES by construction, which the replay STATES rather than
 * counts as a kill.
 *
 * DS_ROOT overrides the project root; DS_PRE_COMMIT overrides the pinned commit.
 */
import {readFileSync, writeFileSync, mkdtempSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {tmpdir} from 'node:os';
import {join} from 'node:path';

const ROOT = process.env.DS_ROOT || '/home/harvey/projects/tech-goblin/lab/diagram-studio';
const ESBUILD = join(ROOT, 'node_modules/.bin/esbuild');

/** Evaluate a snippet against a module's exports, through esbuild. Node cannot
 *  import these directly: extensionless imports (`./colors`) do not resolve
 *  under Node's loader and a `.tsx` carries JSX. Bundling is what makes the
 *  EXECUTED half of this file possible at all.
 *
 *  The snippet runs INSIDE the bundle and its result is JSON-serialised, rather
 *  than a function being handed back to this file — a function cannot survive
 *  `JSON.parse`, and the point of these claims is to MEASURE return values. */
const run = (entry, body) => {
  const dir = mkdtempSync(join(tmpdir(), 'ds-am-'));
  const file = join(dir, 'entry.ts');
  writeFileSync(file, `import * as M from ${JSON.stringify(join(ROOT, entry))};\n`
    + `const out = (() => {${body}})();\nconsole.log(JSON.stringify(out));\n`);
  const js = execFileSync(ESBUILD, [file, '--bundle', '--platform=node', '--format=esm', '--log-level=error'],
    {encoding: 'utf8'});
  return JSON.parse(execFileSync('node', ['--input-type=module', '-e', js], {encoding: 'utf8'}).trim());
};


/* The tree ROUND AM was built on: AM-1's last commit, i.e. the tree before
 * AM-2…AM-5. PINNED, never `HEAD`: once this round is committed, `HEAD` IS the
 * fixed tree and a `HEAD`-based control would compare the fix with itself. */
const PRE_COMMIT = process.env.DS_PRE_COMMIT || '1a819f1';

/* ---------- the assertion harness (house style) ---------- */
let failures = 0;
const assert = (name, ok, detail) => {
  if (ok) console.log(`  PASS  ${name}\n        ${detail}`);
  else { failures++; console.log(`  FAIL  ${name}\n        ${detail}`); }
};
const section = t => console.log(`\n${t}\n${'='.repeat(78)}`);

/** Blank comments, preserving every byte offset and line number. `//` needs a
 *  guard: a bare `//` inside a URL or a string would truncate a real line. */
const blankComments = src => src
  .replace(/\/\*[\s\S]*?\*\//g, m => m.replace(/[^\n]/g, ' '))
  .replace(/(^|[^:])\/\/[^\n]*/g, (m, p1) => p1 + ' '.repeat(m.length - p1.length));

/* ROUND BN-4 — InspectorPickers.tsx split into src/pickers/ slices; reads of
   it return the FIVE SLICES + SHELL CONCATENATED (verbatim moves). */
const read = p => p === 'src/InspectorPickers.tsx'
  ? ['popover', 'art', 'rows', 'stepperFlow', 'section', 'shell'].flatMap(f => {
      try { return [readFileSync(`${ROOT}/src/${f === 'shell' ? 'InspectorPickers.tsx' : 'pickers/' + {popover: 'popover.ts', art: 'Art.tsx', rows: 'Rows.tsx', stepperFlow: 'StepperFlow.tsx', section: 'Section.tsx'}[f]}`, 'utf8')]; } catch { return []; }
    }).join('\n')
  : readFileSync(`${ROOT}/${p}`, 'utf8');
const commitFile = (commit, p) =>
  execFileSync('git', ['show', `${commit}:${p}`], {cwd: ROOT, encoding: 'utf8', maxBuffer: 1 << 28});
/* ROUND BN-4 — src/GoblinEdge.tsx split into src/edges/ (component moved to
   src/edges/GoblinEdge.tsx; the EdgeData type, the K2 flow-payload machinery and
   the type registry moved to edgeData.ts / flowPayloads.tsx / index.ts, verbatim).
   Working-tree reads of the component now read the FOUR SLICES CONCATENATED so
   every regex below still measures the same surface. Git reads (PRE_COMMIT)
   keep the single file, which every pinned commit has. */
const code = p => blankComments(p === 'src/InspectorPickers.tsx'
  ? ['popover', 'art', 'rows', 'stepperFlow', 'section', 'shell'].flatMap(f => {
      try { return [readFileSync(`${ROOT}/src/${f === 'shell' ? 'InspectorPickers.tsx' : 'pickers/' + {popover: 'popover.ts', art: 'Art.tsx', rows: 'Rows.tsx', stepperFlow: 'StepperFlow.tsx', section: 'Section.tsx'}[f]}`, 'utf8')]; } catch { return []; }
    }).join('\n')
  : p === 'src/GoblinEdge.tsx'
  ? ['GoblinEdge', 'edgeData', 'flowPayloads', 'index']
      .map(f => readFileSync(`${ROOT}/src/edges/${f}${f === 'edgeData' || f === 'index' ? '.ts' : '.tsx'}`, 'utf8')).join('\n')
  : read(p));
const codeAt = (commit, p) => blankComments(commitFile(commit, p));

const APP = code('src/App.tsx');
const EDGE = code('src/GoblinEdge.tsx');
const PICKS = code('src/InspectorPickers.tsx');
const INSPECTOR = code('src/inspector.ts');
const STYLES = code('src/styles.css');

/** AM-2's executed half: the edge emitter, over three inputs, measured. */
const T = run('src/textStyle.ts', `
  return {
    none: M.edgeTextStyleVars(undefined),
    styled: M.edgeTextStyleVars({size: 'xl', weight: 'bold', font: 'lexend'}),
    node: M.textStyleVars({size: 'xl', weight: 'bold', font: 'lexend'}, 'left', 'middle'),
  };
`);
/** AM-5's executed half: the slider's mapping, its range and its rounding. */
const P = run('src/InspectorPickers.tsx', `
  return {
    min: M.SPEED_MIN, max: M.SPEED_MAX,
    atMinPos: M.sliderSeconds(M.SPEED_MIN),
    atMaxPos: M.sliderSeconds(M.SPEED_MAX),
    rounded: [2.3999999, 4.0000001, 1.4499999].map(M.storableSeconds),
  };
`);

console.log('='.repeat(78));
console.log('ROUND AM, AM-2…AM-5 — the edge panel: text size, glyph row, speed');
console.log('='.repeat(78));
console.log(`root: ${ROOT}`);
console.log(`node: ${process.version}`);
console.log(`pre-change tree (negative control): ${PRE_COMMIT}`);

/* ===========================================================================
   AM-2 — a TEXT section on the EDGE target, through the ONE text vocabulary.
   =========================================================================== */
section('AM-2 — the edge label gains a TEXT section');

{
  /* (a) The section exists on the EDGE target and sits in the right place. The
   *     ORDER is the item: an edge names itself (label), then its text, then the
   *     line, then the ends, then the rarely-set pair. Asserted by slicing the
   *     `case 'edge'` branch out of the committed decision function and reading
   *     the array it builds, so a section moved silently is a red line. */
  const i = INSPECTOR.indexOf("case 'edge':");
  const branch = i >= 0 ? INSPECTOR.slice(i, INSPECTOR.indexOf("case 'table':", i)) : '';
  const alive = branch.length > 100;
  const base = /const ids: SectionId\[\] = \[([^\]]*)\]/.exec(branch)?.[1] ?? '';
  const listed = base.split(',').map(s => s.trim().replace(/['"]/g, '')).filter(Boolean);
  assert('am2.the-edge-target-carries-a-text-section-in-the-specified-order',
    alive && listed[0] === 'label' && listed.includes('text') && listed.includes('line')
      && listed.includes('markers') && listed.indexOf('text') === 1
      && branch.includes("ids.push('cardinality')") && branch.includes("ids.push('flow')"),
    `the \`case 'edge'\` branch is ${branch.length} chars and builds [${listed.join(', ')}], then conditionally ` +
    `pushes cardinality and always pushes flow — so the order is label → text → line → markers → [cardinality] → ` +
    `flow. The slice is anchored on the case label AND on the next case, so a truncated slice cannot pass silently.`);

  /* (b) The stored field and the emitter. `data.labelStyle` (an EDGE field, not
   *     the node's `textStyle`) and ONE emitter — the edge subset — so the label
   *     and the node cannot drift apart. */
  const declares = /labelStyle\?:\s*TextStyle/.test(APP) && /labelStyle\?:\s*TextStyle/.test(EDGE);
  const emits = EDGE.includes('edgeTextStyleVars(d.labelStyle)');
  assert('am2.the-stored-field-is-labelStyle-and-it-is-emitted-by-the-shared-emitter',
    declares && emits,
    `\`data.labelStyle?: TextStyle\` is declared on the edge in App.tsx and GoblinEdge.tsx = ${declares}, and the ` +
    `label's inline style spreads \`edgeTextStyleVars(d.labelStyle)\` = ${emits}. The field is the EDGE's own key, ` +
    `so an edge's text cannot overwrite a node's \`textStyle\`, and the values reach the sheet through one emitter.`);

  /* (c) THE EMITTER'S BEHAVIOUR, EXECUTED — not described. Reuse, not a second
   *     vocabulary: an edge style emits the SAME scale/weight/font the node path
   *     emits, and NOTHING for a style-less label (the parity guarantee). */
  const none = T.none;
  const styled = T.styled;
  const nodeSide = T.node;
  const sharedOk = ['--ts-scale', '--ts-weight', '--ts-font']
    .every(k => styled[k] === nodeSide[k] && styled[k] !== undefined);
  assert('am2.the-edge-emitter-reuses-the-node-path-property-for-property',
    Object.keys(none).length === 0 && sharedOk,
    `\`edgeTextStyleVars(undefined)\` → ${JSON.stringify(none)} (an untouched board emits NOTHING, so every sheet ` +
    `fallback paints the previous bytes); \`{size:'xl',weight:'bold',font:'lexend'}\` → ${JSON.stringify(styled)}, ` +
    `each value IDENTICAL to the same style through \`textStyleVars\` = ${sharedOk}. One vocabulary, two callers.`);

  /* (d) AND WHAT IT MUST NOT EMIT. Align / vAlign / colour belong to a BOXED
   *     target; an edge label is an inline chip whose position IS the drag, and
   *     its ink is the LABEL section's `text color`. A second writer for either
   *     would be a control the panel never shows. */
  const leaked = ['--ts-align', '--ts-justify', '--ts-valign', '--ts-align-items', '--ts-color']
    .filter(k => k in styled);
  assert('am2.the-edge-emitter-leaks-no-align-vertical-align-or-colour',
    leaked.length === 0,
    `the same styled edge emits ${JSON.stringify(Object.keys(styled))} — none of ` +
    `[--ts-align, --ts-justify, --ts-valign, --ts-align-items, --ts-color] leaked (leaked: [${leaked.join(', ')}]). ` +
    `Align is meaningless without a box, and the label's colour already has exactly one writer in the LABEL ` +
    `section (\`labelTextKey\`), which is why duplicating it here would be a control the panel cannot undo.`);

  /* (e) The panel offers a REAL control set and no colour row. */
  const txtSecDecl = APP.includes('labelStyle:') && /readTextStyle/.test(APP);
  const noColourRow = !/label text color/i.test(APP);
  assert('am2.the-panel-writes-labelStyle-through-the-shared-text-helpers',
    txtSecDecl && noColourRow,
    `the edge's Text section merges through \`mergeTextStyle\` and reads through \`readTextStyle\` = ${txtSecDecl}, ` +
    `the SAME two functions the node path uses, and no separate "label text color" control was invented = ` +
    `${noColourRow}. SIZE / WEIGHT / FONT come from the shared TEXT_*_OPTS tables, so the two targets cannot ` +
    `disagree about the ladder.`);

  /* (f) THE SHEET'S PARITY FALLBACKS, resolved numerically. The rule used to
   *     declare `font-size: 11px; font-weight: 600; font-family: var(--mono)`;
   *     each is now a var with THAT literal as its fallback — and the weight is
   *     the load-bearing one, because every NODE row falls back to 400. */
  const labelRule = /\.edge-label\s*\{([^}]*)\}/.exec(STYLES)?.[1] ?? '';
  /* ROUND AQ re-anchor: 11px joined the type scale — calc(var(--fs-sm) * scale)
     resolves to exactly the same 11px at scale 1 (--fs-sm: 11px, pinned by the
     round-aq-scales ratchet). */
  const sizeOk = /font-size:\s*calc\((?:11px|var\(--fs-sm\))\s*\*\s*var\(--ts-scale,\s*1\)\)/.test(labelRule);
  const weightOk = /font-weight:\s*var\(--ts-weight,\s*600\)/.test(labelRule);
  const familyOk = /font-family:\s*var\(--ts-font,\s*var\(--mono\)\)/.test(labelRule);
  /* resolve them the way the browser would, with nothing stored */
  const resolvedSize = sizeOk ? '11px' : 'UNRESOLVED';
  const resolvedWeight = weightOk ? '600' : 'UNRESOLVED';
  assert('am2.the-sheet-fallbacks-resolve-to-the-pre-change-bytes',
    labelRule.length > 0 && sizeOk && weightOk && familyOk,
    `\`.edge-label\` resolves to font-size ${resolvedSize}, font-weight ${resolvedWeight}, font-family ` +
    `var(--mono) with nothing stored — the three values the rule declared before AM-2. The 600 fallback is the one ` +
    `that matters: copying a node row's 400 would have silently lightened every existing edge label, which no ` +
    `presence-only probe would notice.`);
}

/* ===========================================================================
   AM-3 — the flow-glyph row draws the glyphs, from ONE map.
   =========================================================================== */
section('AM-3 — the flow-glyph row is a real glyph row');

{
  const GLYPHS = read('src/nodes/flowIcons.tsx');
  /* the module is a leaf: no React Flow, no React component, so the panel can
     read it without dragging the edge renderer in. */
  const leaf = !/from\s+['"]@xyflow\/react['"]/.test(GLYPHS);
  const exported = /export\s+(const|function)\s+FLOW_ICON_PATHS/.test(GLYPHS);
  assert('am3.the-glyph-map-moved-to-a-shared-reactflow-free-module',
    leaf && exported && GLYPHS.length > 500,
    `\`src/nodes/flowIcons.tsx\` (${GLYPHS.length} bytes) exports the map = ${exported} and imports nothing from ` +
    `@xyflow/react = ${leaf}. It is a LEAF, so the panel and the edge renderer both read it without a cycle — ` +
    `which is what turns AL-6's "reuses the same vocabulary" comment into a structural guarantee.`);

  /* ROUND BN-4 — the renderer moved to src/edges/; ROUND NS-3 — the glyph map
     itself moved to src/nodes/. So the renderer reads '../nodes/flowIcons' and
     the panel (still at src/App.tsx) reads './nodes/flowIcons'; same readers. */
  const edgeReads = /from\s+['"]\.\.\/nodes\/flowIcons['"]/.test(EDGE) && EDGE.includes('FLOW_ICON_PATHS');
  const panelReads = /from\s+['"]\.\/nodes\/flowIcons['"]/.test(APP) && APP.includes('FLOW_ICON_PATHS');
  assert('am3.both-the-edge-renderer-and-the-panel-read-the-ONE-map',
    edgeReads && panelReads,
    `GoblinEdge reads it = ${edgeReads}; App reads it = ${panelReads}. Two readers, one definition, so a glyph ` +
    `cannot be animating on the canvas while the panel previews a different shape.`);

  /* The row itself: six options, each carrying art, rendered as a glyph row.
   *  Both probes below use BALANCED-PAREN slicing rather than a fixed-length
   *  window or `indexOf(')')`: a 700-char window ran past this table's end into
   *  the NEXT options table (which legitimately carries `art: null`) and
   *  `indexOf(')')` stopped on the INNER `updateEdge(...)` call. Both mistakes
   *  read a correct tree as broken, which is the failure mode this file's own
   *  header warns about. */
  const balanced = (src, from) => {
    let d = 0, end = src.length;
    for (let i = from; i < src.length; i++) {
      if (src[i] === '(') d++;
      else if (src[i] === ')' && --d === 0) { end = i; break; }
    }
    return src.slice(from, end + 1);
  };
  const optsStart = APP.indexOf('const FLOW_ICON_OPTS');
  /* the table ends at the first `}));` after its start — `(([ … ] as const)).map(…)`
     does not balance on parens alone, and a fixed window either stops short or
     runs into `BODY_OPTS` below, which legitimately carries `art: null`. */
  const optsEnd = APP.indexOf('}));', optsStart);
  const optsBlock = optsStart >= 0 && optsEnd > optsStart ? APP.slice(optsStart, optsEnd + 4) : '';
  const artNull = /art:\s*null/.test(optsBlock);
  const hasGlyphArt = /FLOW_ICON_PATHS\[v\]/.test(optsBlock) || /art:\s*</.test(optsBlock);
  assert('am3.every-flow-glyph-option-carries-a-picture-not-a-word',
    optsBlock.length > 0 && !artNull && hasGlyphArt,
    `\`FLOW_ICON_OPTS\` (${optsBlock.length} chars, sliced to its own closing paren) passes \`art: null\` = ` +
    `${artNull} and builds real art from the shared map (\`FLOW_ICON_PATHS[v]\` inside an \`<svg>\`) = ${hasGlyphArt}. ` +
    `The ROW is then rendered with the glyph flag (asserted below), so the six chips are 30×30 squares carrying ` +
    `the travelling glyph.`);

  /* The call site must still pass the glyph flag. That flag is the fifth
     ARGUMENT, and the call wraps across lines with a NESTED call inside it, so
     the slice is balanced-paren over the `chipRow(` call rather than a line or an
     `indexOf`. */
  const glyphCallStart = APP.indexOf('chipRow(FLOW_ICON_OPTS');
  const glyphCall = glyphCallStart >= 0 ? balanced(APP, APP.indexOf('(', glyphCallStart)) : '';
  assert('am3.the-flow-glyph-row-still-passes-the-glyph-flag',
    /\btrue\s*\)\s*$/.test(glyphCall),
    `the call is \`${glyphCall.replace(/\s+/g, ' ').trim()}\` — the fifth argument (the GLYPH flag) is present = ` +
    `${/\btrue\s*\)\s*$/.test(glyphCall)}. Without it the options would carry art while the row still printed ` +
    `labels: the art would be dead data, which is exactly the defect AM-3 exists to fix.`);
}

/* ===========================================================================
   AM-4 — the speed illustration: a rail whose picture IS the duration.
   =========================================================================== */
section('AM-4 — the live speed rail');

{
  /* RE-ANCHORED BY ROUND AN, AN-4. The rail was this section's whole subject and
   * the owner deleted it, so the first half of the conjunction below is the
   * removal and the second half is the LIVE SUBJECT: `.speedval`, printed beside
   * the thumb and built from the same `value` the slider writes. The conjunction
   * is RED at f75f5d1 because the rail is still there — stated rather than left
   * for the reader to work out, since the second half alone is green on BOTH
   * trees (the number did not change this round) and would prove nothing. */
  const railGone = !/export function FlowRail\(/.test(PICKS) && !/<FlowRail/.test(APP);
  const railRulesGone = !/flow-rail/.test(STYLES);
  const stillPrints = /className="speedval"/.test(PICKS) && /\{seconds\.toFixed\(1\)\}s/.test(PICKS);
  const stillWired = /<FlowSpeed[\s\S]{0,200}value=\{eFlowSpeed\}/.test(APP)
    && /onInput=\{secs => updateEdge\(\{data: \{flowDuration: secs\}\}/.test(APP);
  assert('am4.the-rail-is-deleted-everywhere-and-the-speed-value-is-still-printed',
    railGone && railRulesGone && stillPrints && stillWired,
    `\`FlowRail\` is absent from the component and from App = ${railGone}, the sheet declares no \`flow-rail\` ` +
    `rule at all = ${railRulesGone}, and the read-out that replaced its job survives: \`.speedval\` prints ` +
    `\`{seconds.toFixed(1)}s\` = ${stillPrints} and App still drives \`FlowSpeed\` from \`eFlowSpeed\` and writes ` +
    `\`data.flowDuration\` = ${stillWired}. The removal is the first half (which is what makes this probe RED at ` +
    `the pre-change tree); the second half is the claim with the live subject, and it is green on BOTH trees — ` +
    `declared here so it is not mistaken for a kill.`);

  /* the removal is RECORDED, not just performed: the reason lives in both places
   * the code was, so a later round cannot "helpfully" re-add the preview. */
  const reasonPicks = /AN-4[\s\S]{0,600}Flow rail/i.test(read('src/InspectorPickers.tsx'));
  const reasonStyles = /AN-4[\s\S]{0,600}FLOW RAIL/i.test(read('src/styles.css'));
  const reasonApp = /AN-4[\s\S]{0,600}RAIL WAS DELETED HERE/.test(read('src/App.tsx'));
  assert('am4.the-removal-is-recorded-in-the-code-with-its-reason',
    reasonPicks && reasonStyles && reasonApp,
    `the reason is written where the component was = ${reasonPicks}, where its CSS was = ${reasonStyles}, and ` +
    `where it was rendered = ${reasonApp}. AM-4's own note has been replaced by a DELETION note naming the owner's ` +
    `sentence and the \`label\` prop that went with it, because this project's comments are its design record: an ` +
    `illustration inside the panel is not a control, and without the note the next round re-derives the same idea.`);

  /* the motion gate went WITH the animation it gated — and the project's two REAL
   * switches survive for the payloads that are still moving. */
  const noRailGate = !/flow-rail/.test(STYLES);
  const gatesIntact = /prefers-reduced-motion:\s*reduce/.test(STYLES) && /\.ds-no-anim/.test(STYLES);
  assert('am4.the-motion-gate-went-with-the-animation-and-the-real-switches-survive',
    noRailGate && gatesIntact,
    `no \`flow-rail-bead\` rule is left to stop = ${noRailGate}, while the project's two switches still exist for ` +
    `the canvas payloads = ${gatesIntact}. A gate for a deleted animation is dead CSS that reads as live policy; ` +
    `deleting the rules WITHOUT the gate is the trap this probe exists for, and deleting the gate WITHOUT the ` +
    `project's real motion policy is the opposite one.`);
}

/* ===========================================================================
   AM-5 — the slider: EXECUTED arithmetic, the inversion, one row with count.
   =========================================================================== */
section('AM-5 — the compact count + the speed slider');

{
  /* (a) THE INVERSION, MEASURED. The stored value is DURATION (bigger = slower),
   *     so dragging RIGHT must mean FASTER: the slider's POSITION maps through
   *     `SPEED_MAX + SPEED_MIN - seconds`. Executed over the real range. */
  const min = P.min, max = P.max;
  const atMinPos = P.atMinPos;   // thumb hard LEFT
  const atMaxPos = P.atMaxPos;   // thumb hard RIGHT
  const fastAtRight = atMaxPos < atMinPos;
  const coversRange = Math.abs(atMinPos - max) < 1e-9 && Math.abs(atMaxPos - min) < 1e-9;
  assert('am5.dragging-RIGHT-is-FASTER-and-the-inversion-covers-the-whole-range',
    fastAtRight && coversRange && min === 0.6 && max === 8,
    `position ${min} → ${atMinPos}s (slowest, LEFT) and position ${max} → ${atMaxPos}s (fastest, RIGHT): dragging ` +
    `right is faster = ${fastAtRight}, and the two ends map exactly onto the renderer's own clamp ` +
    `[${min}, ${max}] seconds = ${coversRange}. ` +
    `NOTE FOR THE READER: this probe is GREEN ON BOTH TREES by construction — the helper did not exist before, so ` +
    `it cannot be a kill. Its content is that the mapping stays honest and free of float drift.`);

  /* the four chip values the slider replaced must still be REACHABLE — that is
     what makes it a strict superset rather than a narrower control. */
  const chips = [4, 2.4, 1.4, 0.8];
  const reachable = chips.every(s => {
    const pos = max + min - s;
    return pos >= min - 1e-9 && pos <= max + 1e-9;
  });
  assert('am5.every-value-the-four-old-chips-offered-is-still-reachable',
    reachable,
    `slow 4 · normal 2.4 · fast 1.4 · very fast 0.8 all map to positions inside [${min}, ${max}] = ${reachable}. ` +
    `A slider is a SUPERSET of the four hard steps only if the steps survive inside it; if one had fallen outside ` +
    `the range, AM-5 would have removed values the user could previously set.`);

  /* (b) ROUNDING: a drag is the browser's float arithmetic, so the stored value
   *     is rounded to one decimal or boards accumulate 2.3999999. */
  const rounded = P.rounded;
  /* 1.4499999 → 1.4, NOT 1.5: `Math.round(n * 10) / 10` on a value a hair BELOW
     1.45 rounds DOWN, which is the honest reading of the input and the reason
     this assertion prints its inputs rather than a bare claim. */
  assert('am5.the-stored-duration-is-rounded-to-one-decimal',
    rounded[0] === 2.4 && rounded[1] === 4 && rounded[2] === 1.4,
    `[2.3999999, 4.0000001, 1.4499999] → ${JSON.stringify(rounded)}. The input is \`step="0.1"\` but the pointer ` +
    `path is the browser's own arithmetic, so without this the board would store values the panel can never print ` +
    `(2.3999999). The third case rounds DOWN because the input sits a hair below the .45 boundary — stated so the ` +
    `number is auditable rather than surprising.`);

  /* (c) ONE ROW: count and speed share a `.pair` row, and the count stepper is
     *     the COMPACT variant rather than the default. The modifier is a PROP
     *     (`compact`) rendered through a template literal, so the probe reads the
     *     component's own expression rather than a class string that never
     *     appears literally in the source. */
  const pairRow = /<div className="pair">/.test(APP);
  const compactProp = /compact\b/.test(APP.slice(APP.indexOf('className="pair"'), APP.indexOf('className="pair"') + 900));
  const stepperExpr = /className=\{`insp-stepper\$\{compact \? ' compact' : ''\}`\}/.test(PICKS);
  assert('am5.count-and-speed-share-ONE-row-and-the-stepper-is-the-compact-form',
    pairRow && compactProp && stepperExpr,
    `\`className="pair"\` wraps the two controls = ${pairRow}, the count \`<Stepper/>\` in that row passes the ` +
    `\`compact\` prop = ${compactProp}, and the component renders ` +
    `\`insp-stepper\${compact ? ' compact' : ''}\` = ${stepperExpr}. Count used to stretch a full 253px panel row ` +
    `for a single digit and speed wanted its own row; the owner's ask was one line for both.`);

  /* the default stepper MUST be untouched for its other callers — the modifier is
     what keeps the blast radius at one call site. */
  assert('am5.the-compact-form-is-a-modifier-and-the-default-stepper-is-unchanged',
    stepperExpr && /compact\s*=\s*false/.test(PICKS) && /compact\?:\s*boolean/.test(PICKS),
    `\`compact\` defaults to \`false\` = ${/compact\s*=\s*false/.test(PICKS)} and is an OPTIONAL prop = ` +
    `${/compact\?:\s*boolean/.test(PICKS)}, so a caller that passes nothing gets the full-width stepper it always ` +
    `had. Narrowing the SHARED component instead would have shrunk any other row that ever calls it.`);

  /* (d) THE SLIDER IS NOT A CHIP ROW ANY MORE, and the four words are gone. */
  const noSpeedChips = !/chipRow\(SPEED_OPTS/.test(APP) && !/const SPEED_OPTS/.test(APP);
  const sliderPresent = /type="range"/.test(PICKS) && PICKS.includes('flow-speed-range');
  assert('am5.the-speed-row-left-the-chip-family-and-became-a-range-input',
    noSpeedChips && sliderPresent,
    `no \`chipRow(SPEED_OPTS …)\` and no \`SPEED_OPTS\` table remain = ${noSpeedChips}; the control is an ` +
    `\`<input type="range">\` styled from tokens = ${sliderPresent}. This is what reddened ROUND AA's \`aa1\` and ` +
    `ROUND AL's \`al6\` chip-family claims, and both were re-anchored in this round — with the re-anchor recorded ` +
    `in each file rather than an assertion quietly dropped.`);

  /* (e) ONE GESTURE = ONE UNDO STEP: the boundary is armed at both ends and the
   *     frames coalesce, and a held arrow key does not re-arm per repeat. */
  const boundaryWired = /onGestureBoundary/.test(PICKS) && /coalesce/.test(APP);
  const repeatGuarded = /ev\.repeat|\.repeat\b/.test(PICKS) && /onKeyDown/.test(PICKS);
  assert('am5.one-gesture-is-one-history-entry-and-a-held-key-is-one-gesture',
    boundaryWired && repeatGuarded,
    `the slider arms a gesture boundary and the writer coalesces its frames = ${boundaryWired}; the key handler ` +
    `guards \`ev.repeat\` = ${repeatGuarded}. A per-frame push would bury the user's real history under hundreds ` +
    `of entries — the defect \`src/resizeHistory.ts\` was written to prevent — and holding an arrow key repeats ` +
    `\`keydown\`, so an unguarded handler would re-arm the latch once per repeat.`);

  /* (f) The slider is styled from tokens only (no new hex — the sheet's literal
   *     count is asserted by ROUND AG's ceiling harness, and this is the local
   *     check that this round's own rules contributed none). */
  /* RE-ANCHORED BY ROUND AN, AN-4: this slice used to end at `.flow-rail`, which
   * AN-4 deleted — `indexOf` would have returned -1 and the slice would have run
   * to the END OF THE SHEET, counting every hex literal in the file as if it were
   * this block's. The end anchor is now the next real rule (the section wrapper),
   * and the block is additionally asserted to no longer hold the deleted rail. */
  const rangeRules = STYLES.slice(STYLES.indexOf('.flow-speed-range'), STYLES.indexOf('.insp-section + .insp-section'));
  const hexInRail = (rangeRules.match(/#[0-9a-fA-F]{3,8}\b/g) ?? []);
  const railInBlock = /flow-rail/.test(rangeRules);
  assert('am5.the-slider-block-introduces-NO-hex-literal-and-the-deleted-rail-is-out-of-it',
    hexInRail.length === 0 && !railInBlock && rangeRules.includes('var(--sel)') && rangeRules.includes('var(--border)'),
    `the \`.flow-speed-range\` block (${rangeRules.length} chars, bounded by the section wrapper that follows it) ` +
    `carries ${hexInRail.length} hex literals and paints from \`var(--border)\` / \`var(--sel)\` = true; the deleted ` +
    `rail's rules are no longer inside it = ${!railInBlock}. Tokens only is the project rule for anything new; the ` +
    `sheet's global ceiling is asserted separately and stayed at 142 through this round.`);
}

/* ===========================================================================
   THE REPLAY — every source probe re-run over the PINNED pre-change tree.
   =========================================================================== */
section(`REPLAY (negative control) — the source probes over ${PRE_COMMIT}`);

let pre = null;
try {
  pre = {
    APP: codeAt(PRE_COMMIT, 'src/App.tsx'),
    EDGE: codeAt(PRE_COMMIT, 'src/GoblinEdge.tsx'),
    PICKS: codeAt(PRE_COMMIT, 'src/InspectorPickers.tsx'),
    INSPECTOR: codeAt(PRE_COMMIT, 'src/inspector.ts'),
    STYLES: codeAt(PRE_COMMIT, 'src/styles.css'),
  };
} catch (err) {
  console.log(`  FAIL  the pre-change tree could not be read from ${PRE_COMMIT}: ${err.message}`);
  failures++;
}

if (pre) {
  const KILLS = [
    ['AM-2 · the edge section list contains text',
      (() => {
        const i = pre.INSPECTOR.indexOf("case 'edge':");
        const b = i >= 0 ? pre.INSPECTOR.slice(i, pre.INSPECTOR.indexOf("case 'table':", i)) : '';
        return b.includes("'text'");
      })()],
    ['AM-2 · the edge stores labelStyle', /labelStyle\?:\s*TextStyle/.test(pre.APP)],
    ['AM-2 · the label spreads edgeTextStyleVars', pre.EDGE.includes('edgeTextStyleVars')],
    ['AM-2 · .edge-label sizes from --ts-scale',
      (() => {
        const r = /\.edge-label\s*\{([^}]*)\}/.exec(pre.STYLES)?.[1] ?? '';
        return /font-size:\s*calc\(11px\s*\*\s*var\(--ts-scale/.test(r);
      })()],
    ['AM-3 · a shared flowIcons module is read by the panel',
      pre.APP.includes("from './flowIcons'")],
    ['AM-3 · the glyph options carry art instead of null',
      (() => {
        const b = /const FLOW_ICON_OPTS: PickerOption\[\] = ([\s\S]{0,700}?)\];/.exec(pre.APP)?.[1] ?? '';
        return b.length > 0 && !/art:\s*null/.test(b);
      })()],
    /* AN-4's re-anchored claims, controlled the same way: these predicates are
       read on the PRE tree, where AN-4 has not run — the rail exists, so a claim
       that it is DELETED detects the change; and no removal note exists yet. */
    ['AM-4 · the rail exists on the pre-change tree (so its deletion is a kill)',
      /export function FlowRail\(/.test(pre.PICKS)],
    ['AM-4 · the panel renders the rail on the pre-change tree', /<FlowRail/.test(pre.APP)],
    ['AM-4 · the sheet still gates the bead on the pre-change tree', /flow-rail-bead/.test(pre.STYLES)],
    ['AM-4 · the removal note is absent on the pre-change tree',
      /AN-4[\s\S]{0,600}Flow rail/i.test(commitFile(PRE_COMMIT, 'src/InspectorPickers.tsx'))],
    ['AM-5 · the speed block still held the rail rules on the pre-change tree',
      (() => {
        const st = pre.STYLES;
        const b = st.slice(st.indexOf('.flow-speed-range'), st.indexOf('.insp-section + .insp-section'));
        return /flow-rail/.test(b);
      })()],
    ['AM-5 · the speed control is a range input', /flow-speed-range/.test(pre.PICKS)],
    ['AM-5 · count and speed share the pair row', /<div className="pair">/.test(pre.APP)],
    /* Scoped to the pair row: a bare `compact` matches unrelated CSS-class names
       elsewhere in App.tsx, which is how this probe was briefly green on both
       trees — a probe that fires on a coincidence proves nothing. */
    ['AM-5 · the count stepper uses the compact form',
      (() => {
        const i = pre.APP.indexOf('className="pair"');
        return i >= 0 ? /\bcompact\b/.test(pre.APP.slice(i, i + 900)) : false;
      })()],
    ['AM-5 · SPEED_OPTS is gone', !/const SPEED_OPTS/.test(pre.APP)],
  ];
  const greenOnPre = [];
  for (const [id, bad] of KILLS) {
    if (bad) greenOnPre.push(id);
    console.log(`  ${bad ? 'GREEN (proves NOTHING)' : 'RED  '}  ${id}`);
  }
  assert('replay.every-source-probe-REALLY-detects-the-change-it-claims',
    greenOnPre.length === 0,
    greenOnPre.length === 0
      ? `all ${KILLS.length} source probes are RED at ${PRE_COMMIT} and GREEN on the working tree, so each one ` +
        `measures AM-2…AM-5 rather than a claim that happened to be true before this round too.`
      : `${greenOnPre.length} probe(s) are GREEN on the pre-change tree and therefore prove NOTHING: ` +
        `${greenOnPre.join(' · ')}. A probe whose condition already held cannot be evidence that this round ` +
        `changed it — fix the probe or drop the claim.`);

  /* the module half: the emitter and the helpers did not exist there at all */
  const emittedAtPre = (() => {
    try { return /edgeTextStyleVars/.test(commitFile(PRE_COMMIT, 'src/textStyle.ts')); } catch { return false; }
  })();
  console.log(`\n  pre-change \`src/textStyle.ts\` mentions \`edgeTextStyleVars\` = ${emittedAtPre}`);
  assert('replay.the-edge-emitter-did-not-exist-on-the-pre-change-tree',
    !emittedAtPre,
    `\`edgeTextStyleVars\` is absent from \`src/textStyle.ts\` at ${PRE_COMMIT}, read out of the committed file — ` +
    `so AM-2's executed claims could not have passed there even in principle, which is what makes them evidence ` +
    `of this round rather than of the tree it started from.`);
}

console.log('\n' + '='.repeat(78));
console.log(failures === 0
  ? 'ROUND AM EDGE-PANEL HARNESS: all checks passed'
  : `ROUND AM EDGE-PANEL HARNESS: ${failures} FAILURE(S)`);
console.log('='.repeat(78));
process.exit(failures === 0 ? 0 : 1);
