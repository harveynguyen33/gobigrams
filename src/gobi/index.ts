/* ROUND GOBI-1 — the .gobi compiler's public entry. The ONE door all four
 * consumers import (app import box, share-link encoder, MDX build, headless
 * render). Re-exports the stages for the harnesses. */

export {compileGobi, type GobiCompileResult, type GobiCompileOptions} from './gobiCompiler';
export {lexGobi} from './gobiLexer';
export {parseGobi} from './gobiParser';
export {validateGobi} from './gobiValidator';
/* ROUND GOBI-TEXT (§2.9) — the language's text-alignment vocabulary, derived
 * from the app's own text model (src/textStyle.ts). */
export {
  GOBI_ALIGN_VALUES, GOBI_VALIGN_VALUES, GOBI_ALIGN_DEFAULT, gobiTextStyle,
} from './gobiText';
export type {
  GobiAst, GobiError, GobiToken, GobiTokenType, GobiNodeKind, GobiNodeStmt,
  GobiEdgeStmt, GobiGroupStmt, GobiMembershipStmt, GobiStatement, GobiAttrs,
  GobiColumn, GobiParseResult,
} from './gobiTypes';
