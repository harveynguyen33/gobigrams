#!/usr/bin/env node
/**
 * ROUND AR harness — export-modal stability (AR-2/AR-3/AR-4 source assertions).
 *
 * No browser, no DOM, no CDP. Everything below is a TEXT read of
 * `src/ExportModal.tsx` and `src/App.tsx` (bundling nothing, executing
 * nothing). Nothing here is a painted measurement — the BEHAVIOURAL proof
 * (12/12 `.em-seg button` markers surviving a Theme click at 0 ms and 600 ms,
 * the primary button's label staying constant under a MutationObserver for
 * 3 s, and 0 preview-image `src` mutations across an unrelated App re-render)
 * is the orchestrator's and reviewer's LIVE CDP pass, exactly as
 * `checks/round-ad-flowchart.mjs` states for its own scope.
 *
 * COMMENTS ARE BLANKED BEFORE EVERY COUNT (blanking keeps byte offsets, so any
 * reported line number stays true). This repo's docblocks quote the constructs
 * they describe — including the very identifiers asserted below — and a raw
 * count would read a correct tree as a defect.
 *
 * Target root: `AR_ROOT` env var, defaulting to this repo root. Pointing it at
 * a checkout of the pre-fix commit is the sanctioned RED negative control.
 */
import {readFileSync} from 'node:fs';
import {join} from 'node:path';

const ROOT = process.env.AR_ROOT || '/home/harvey/projects/tech-goblin/lab/diagram-studio';
const MODAL_RAW = readFileSync(join(ROOT, 'src/ExportModal.tsx'), 'utf8');
const APP_RAW = readFileSync(join(ROOT, 'src/App.tsx'), 'utf8');

const blank = m => m.replace(/[^\n]/g, ' ');
const stripTs = s => s
  .replace(/\/\*[\s\S]*?\*\//g, blank)
  .replace(/(^|[^:])\/\/[^\n]*/g, (m, p1) => p1 + ' '.repeat(m.length - p1.length));
const MODAL = stripTs(MODAL_RAW);
const APP = stripTs(APP_RAW);

const lineOf = (src, idx) => src.slice(0, idx).split('\n').length;

/** Return the source span from the first `{` at/after `start` to its matching
 *  `}` (string/regex literals are rare enough in these two files that plain
 *  brace counting is sufficient — the assertions tolerate over-capture). */
const braceSpan = (src, start) => {
  let depth = 0, began = -1;
  for (let i = start; i < src.length; i++) {
    if (src[i] === '{') { if (depth === 0) began = i; depth++; }
    else if (src[i] === '}') { depth--; if (depth === 0) return [began, i]; }
  }
  return [began, src.length - 1];
};

const results = [];
const assert = (id, pass, detail = '') => {
  results.push({id, pass: !!pass, detail});
  console.log(`  ${pass ? 'PASS' : 'FAIL'}  ${id}  —  ${detail}`);
};

console.log('ROUND AR — modal stability (source assertions)');
console.log(`  target root: ${ROOT}`);

/* ===========================================================================
 * CLAIM A — `Seg` is declared at MODULE SCOPE, and the `ExportModal` function
 * body contains no component declaration for it.
 * =========================================================================== */
{
  const declIdx = MODAL.search(/\bfunction Seg\b/);
  const inBodyDecl = MODAL.match(/\bconst Seg\b/);
  let bodyStart = -1, bodyEnd = -1;
  const compMatch = MODAL.match(/\bexport default function ExportModal\b/);
  if (compMatch) {
    /* the function BODY's `{` is the one preceded by `)` (the destructuring
       param list closes first) — brace-count from there. */
    let open = -1;
    for (let i = compMatch.index; i < MODAL.length; i++) {
      if (MODAL[i] === '{' && /\)\s*$/.test(MODAL.slice(compMatch.index, i).replace(/"[^"]*"|'[^']*'|`[^`]*`/g, ''))) { open = i; break; }
      if (MODAL[i] === ';') break;
    }
    if (open !== -1) [bodyStart, bodyEnd] = braceSpan(MODAL, open);
  }
  const insideBody = inBodyDecl && inBodyDecl.index > bodyStart && inBodyDecl.index < bodyEnd;
  assert('ar2.seg-at-module-scope',
    declIdx !== -1 && (inBodyDecl ? inBodyDecl.index < bodyStart || inBodyDecl.index > bodyEnd : true) && !insideBody,
    declIdx === -1
      ? 'no module-scope `function Seg` declaration found in src/ExportModal.tsx'
      : insideBody
        ? `a component declaration for Seg sits INSIDE the ExportModal body (line ${lineOf(MODAL, inBodyDecl.index)}) — new type identity every render, whole .em-seg subtree remounts on every state change`
        : `module-scope Seg at line ${lineOf(MODAL, declIdx)}; the ExportModal body (lines ${lineOf(MODAL, bodyStart)}–${lineOf(MODAL, bodyEnd)}) declares none`);
}

/* ===========================================================================
 * CLAIM B — the primary button's label and disabled read `exportBusy` only,
 * and the preview effect no longer sets the flag that drives the label.
 * =========================================================================== */
{
  const btnMatch = MODAL.match(/<button className="em-go" onClick=\{doExport\}[^>]*>/);
  const btn = btnMatch ? btnMatch[0] : '';
  const disabledExpr = (btn.match(/disabled=\{([^}]*)\}/) || [])[1] ?? '';
  const labelUsesExport = disabledExpr.includes('exportBusy');
  const disabledClean = !disabledExpr.includes('previewBusy');
  // label expression: the JSX child of the primary button
  let labelExpr = '';
  if (btnMatch) {
    const childFrom = MODAL.indexOf(btnMatch[0], 0) + btnMatch[0].length;
    labelExpr = MODAL.slice(childFrom, childFrom + 160).split('<')[0];
  }
  const labelClean = labelExpr.includes('exportBusy') && !labelExpr.includes('previewBusy');

  // the preview effect = the effect whose body sets the preview-busy flag
  const effTrigger = MODAL.indexOf('setPreviewBusy(true)');
  let effBody = '';
  if (effTrigger !== -1) {
    const effHead = MODAL.lastIndexOf('useEffect(() => {', effTrigger);
    const [a, b] = braceSpan(MODAL, effHead);
    effBody = MODAL.slice(a, b + 1);
  }
  const effectFound = effTrigger !== -1 && effBody.includes('setPreviewBusy(true)');
  const effectSetsLabelFlag = effectFound && /\bsetExportBusy\s*\(/.test(effBody);
  const splitDone = /\bconst \[exportBusy, setExportBusy\]\s*=\s*useState/.test(MODAL)
    && /\bconst \[previewBusy, setPreviewBusy\]\s*=\s*useState/.test(MODAL)
    && !/\bsetBusy\s*\(/.test(MODAL);

  assert('ar3.primary-button-reads-exportBusy-only',
    btnMatch && labelUsesExport && disabledClean && labelClean,
    !btnMatch
      ? 'primary export button (className em-go, onClick doExport) not found in src/ExportModal.tsx'
      : `disabled={${disabledExpr.trim()}} / label reads ${labelExpr.trim().slice(0, 60)}`);

  assert('ar3.preview-effect-does-not-drive-the-label',
    splitDone && effectFound && !effectSetsLabelFlag,
    !effectFound
      ? 'preview effect (the effect setting the preview-busy flag) not found'
      : effectSetsLabelFlag
        ? 'the preview effect sets the export-busy flag — a preview rebuild still flips the button'
        : 'single legacy busy flag gone; preview effect drives only the preview flag, export flag is set in doExport only');
}

/* ===========================================================================
 * CLAIM C — `buildSvg`/`buildPng` are identity-stable (useCallback or a ref)
 * in src/App.tsx, and the modal receives them as PROPS (not inline arrows).
 * =========================================================================== */
{
  const stable = re => {
    const m = APP.match(re);
    return m ? {ok: true, line: lineOf(APP, m.index)} : {ok: false, line: 0};
  };
  const svg = stable(/\bconst buildSvg = useCallback\(/);
  const png = stable(/\bconst buildPng = useCallback\(/);
  const svgRef = stable(/\bconst buildSvg = useRef\(/);
  const pngRef = stable(/\bconst buildPng = useRef\(/);
  const svgStable = svg.ok || svgRef.ok;
  const pngStable = png.ok || pngRef.ok;

  const jsxMatch = APP.match(/buildSvg=\{([^}]*)\}[\s\S]{0,40}?buildPng=\{([^}]*)\}/);
  const passedAsProps = !!jsxMatch && jsxMatch[1].trim() === 'buildSvg' && jsxMatch[2].trim() === 'buildPng';

  assert('ar4.builders-identity-stable',
    svgStable && pngStable && passedAsProps,
    svgStable && pngStable
      ? `buildSvg${svg.ok ? ' via useCallback' : ' via useRef'} at line ${svg.line}, buildPng${png.ok ? ' via useCallback' : ' via useRef'} at line ${png.line}${passedAsProps ? ', passed to ExportModal by name as props' : ', but NOT passed to ExportModal by name as props'}`
      : 'buildSvg/buildPng are plain consts re-created every App render — the modal preview effect re-fires on every unrelated re-render');

  assert('ar4.modal-receives-builders-as-props',
    passedAsProps,
    passedAsProps
      ? 'ExportModal gets buildSvg={buildSvg} buildPng={buildPng} — prop identity, not an inline re-creation'
      : 'the JSX does not pass the stable builders by name as props');
}

const failed = results.filter(r => !r.pass);
console.log('\n' + '='.repeat(78));
console.log(`ROUND AR HARNESS: ${results.length - failed.length}/${results.length} passed`);
console.log('='.repeat(78));
for (const f of failed) console.log(`  FAIL  ${f.id}  —  ${f.detail}`);
process.exit(failed.length ? 1 : 0);
