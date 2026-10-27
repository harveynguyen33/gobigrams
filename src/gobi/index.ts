/* ROUND GOBI-1 — the .gobi compiler's public entry. The ONE door all four
 * consumers import (app import box, share-link encoder, MDX build, headless
 * render). Re-exports the stages for the harnesses. */

export {compileGobi, type GobiCompileResult, type GobiCompileOptions} from './gobiCompiler';
export {lexGobi} from './gobiLexer';
export {parseGobi} from './gobiParser';
export {validateGobi} from './gobiValidator';
export type {
  GobiAst, GobiError, GobiToken, GobiTokenType, GobiNodeKind, GobiNodeStmt,
  GobiEdgeStmt, GobiGroupStmt, GobiMembershipStmt, GobiStatement, GobiAttrs,
  GobiColumn, GobiParseResult,
} from './gobiTypes';
