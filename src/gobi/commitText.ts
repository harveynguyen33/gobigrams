/* commitText.ts — UNISURF-S4 (SPEC-UNIFIED-SURFACE §4/§9 step 4, 2026-11-08):
 * the pane's COMMIT lane. One call per input event (NO debounce — spec §2: a
 * throttled tab defers a setTimeout by seconds and the board then lies about
 * the text). The text is parsed by the ONE parser and folded back by the ONE
 * merge; this module owns no state and writes nothing — it returns either the
 * merged nodes/edges for App to commit, or the stale report for App to lock
 * the canvas with.
 *
 * THE STALE REPORT (spec §4): every error (the pane's bar lists them all —
 * compileGobi already collects them in one pass, no second validator here),
 * plus the offending CARDS and ROWS mapped through the serialiser's own
 * `lineOf` — the map from the LAST VALID generation, never re-derived from a
 * stale parse (an error line that maps into a table body marks that row;
 * header/edge lines map to nothing but still outline the card they sit on).
 *
 * LAZY: compileGobi and applyGobiDoc arrive by dynamic import() exactly the
 * way ExportModal and the S3 mirror reach the package — the compiler stays
 * out of the boot chunk; only the type below is static, and types erase.
 */
import type {Node, Edge} from '@xyflow/react';
import type {BoardDoc} from '../board/boards';
import type {GobiError} from '@techgoblin/gobi-core';
import {codeLayoutApply, loadCodeLayoutMode} from '../canvas/codeLayoutMode';
import {loadPref} from '../board/prefs';
import {LAYOUT_DIR_KEY, DEFAULT_LAYOUT_DIR, parseLayoutDir} from '../layout/layoutMode';

export type StaleInfo = {
  /** every error — count = errors.length (the banner), list = the pane bar. */
  errors: GobiError[];
  first: GobiError;
  /** ids of the cards an error line lands on (outlined on the canvas). */
  nodes: string[];
  /** "nodeId:colId" keys whose ROW an error line lands on (marked). */
  cols: string[];
};

export type CodeCommit =
  | {ok: true; nodes: Node[]; edges: Edge[]}
  | {ok: false; stale: StaleInfo};

export async function commitText(
  text: string,
  lineOf: Map<string, number>,
  current: BoardDoc,
): Promise<CodeCommit> {
  const {compileGobi, applyGobiDoc} = await import('@techgoblin/gobi-core');
  /* LAYOUT-FOLLOWS-WIDTH — the compile lays tables out at the width the board
   * really paints, so a table the text ADDS lands clear of its neighbours. */
  const res = compileGobi(text, {style: current.style, density: current.density});
  if (res.ok === false) {
    const nodes = new Set<string>();
    const cols = new Set<string>();
    for (const e of res.errors) {
      lineOf.forEach((line, key) => {
        if (line !== e.line) return;
        const i = key.indexOf(':');
        if (i < 0) nodes.add(key);
        else { nodes.add(key.slice(0, i)); cols.add(key); }
      });
    }
    return {ok: false, stale: {errors: res.errors, first: res.errors[0], nodes: [...nodes], cols: [...cols]}};
  }
  const doc = applyGobiDoc(current, res.doc);
  /* CODE-LAYOUT-MODE — what this commit does to the board's geometry (one
   * setting, read fresh per commit; 'off' is today's merge result verbatim). */
  const mode = loadCodeLayoutMode();
  const nodes = mode === 'off'
    ? doc.nodes as unknown as Node[]
    : await codeLayoutApply(mode,
        parseLayoutDir(loadPref(LAYOUT_DIR_KEY, DEFAULT_LAYOUT_DIR)),
        doc.nodes as unknown as Node[], current.nodes as unknown as Node[],
        doc.edges as unknown as Edge[]);
  return {ok: true, nodes, edges: doc.edges as unknown as Edge[]};
}
