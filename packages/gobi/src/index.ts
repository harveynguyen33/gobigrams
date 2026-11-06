/* ROUND GOBI-1 — the .gobi compiler's public entry. The ONE door all four
 * consumers import (app import box, share-link encoder, MDX build, headless
 * render). Re-exports the stages for the harnesses.
 *
 * CORE-STEP2 — this entry is the CORE's surface: compileGobi returns the
 * neutral GobiDocument. The canvas adapter (src/gobi/adapterCanvas.ts,
 * toBoardDoc) is deliberately NOT re-exported here — a consumer that wants
 * a React-Flow board imports the adapter itself, so the compiler-only
 * bundle (scripts/gobi-core-size.mjs) never drags the palette factories.
 *
 * CORE-STEP4A — this file moved into packages/gobi (the workspace package
 * @techgoblin/gobi-core); the app imports it as '@techgoblin/gobi-core'. The app-side
 * adapter stays at src/gobi/adapterCanvas.ts. */

export {compileGobi, type GobiCompileResult} from './gobiCompiler';
export {lexGobi} from './gobiLexer';
export {parseGobi} from './gobiParser';
export {validateGobi} from './gobiValidator';
export {GOBI_KIND_GEOMETRY, GOBI_KINDS} from './registry';
/* ROUND GOBI-TEXT (§2.9) — the language's text-alignment vocabulary, derived
 * from the app's own text model (src/textStyle.ts). */
export {
  GOBI_ALIGN_VALUES, GOBI_VALIGN_VALUES, GOBI_ALIGN_DEFAULT, gobiTextStyle,
} from './gobiText';
/* CORE-STEP4A — the attributed path generators and the doc vocabulary tokens
 * the app's own modules (edgeRoute, the canvas adapter) consume through the
 * package name; they were internal siblings when the core lived in src/gobi. */
export {getBezierPath, getSmoothStepPath, getStraightPath, Position} from './paths';
export {GOBI_CARD_TOKENS, GOBI_KIND_ITEM} from './gobiTypes';
/* The icon-name vocabulary as PLAIN DATA — the app's lucideIcons registry and
 * the validator both read this ONE list (CORE-STEP1's decoupling). */
export {ICON_NAMES} from './iconNames';
export type {
  GobiAst, GobiError, GobiToken, GobiTokenType, GobiNodeKind, GobiNodeStmt,
  GobiEdgeStmt, GobiGroupStmt, GobiMembershipStmt, GobiStatement, GobiAttrs,
  GobiColumn, GobiParseResult,
  /* CORE-STEP2 — the neutral document types. */
  GobiDocument, GobiDocNode, GobiDocEdge, GobiDocColumn,
} from './gobiTypes';

/* CORE-STEP3/4A — the renderer + the node-side measurement/theme helpers are
 * part of the package's public surface: a consumer with no browser renders
 * through renderGobiDocument + tableMeasurer + tokensFromCss and gets the
 * byte-identical SVG the app exports (the corpus pins the parity).
 * CORE-API-GAP (t_b7bb0ff1) — the node path is COMPLETE from the entry:
 * EXPORT_TOKENS (the inlined vocabulary), THEME_CSS (the sheet those values
 * come from) and DEFAULT_METRICS (the committed table) ship here, so no
 * consumer reads a file path out of node_modules. GOBI_CARD_TOKENS above is a
 * DIFFERENT vocabulary — ERD cardinality ('1', 'n', …), not theme tokens. */
export {renderGobiDocument, type RenderGobiOptions} from './renderSvg';
export {tableMeasurer, metricKey, metricKeyParts, type GobiMeasureText, type GobiMetrics} from './tableMeasure';
export {themeBlocks, tokensFromCss} from './themeCss';
export {EXPORT_TOKENS} from './model/theme';
export {THEME_CSS} from './themeSheet';
export {DEFAULT_METRICS} from './defaults';
export {describeGobiDocument, type GobiDescribe, type GobiDescribeNode, type GobiDescribeEdge, type GobiDescribeGroup} from './describeGobi';
