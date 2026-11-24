/* feature-map home: src/board/importLimits.ts */
/* F9 AUDIT-CLEANUP — the JSON import door's caps. Before this module the
 * handler (App.onImportFile) read ANY file whole into a string and parsed it:
 * a 200 MB board JSON froze the tab, and the shape checks were App's third
 * re-implementation of the validator. Here is the single door:
 *
 *   1. BYTE cap first — 8 MB of JSON text (IMPORT_MAX_BYTES). For a File the
 *      size is checked from file.size BEFORE .text() runs, so an over-cap
 *      file is never read into memory at all; the text path re-measures with
 *      Blob().size (UTF-8 bytes, the same semantics as file.size).
 *   2. SANITY caps — IMPORT_MAX_NODES / IMPORT_MAX_EDGES (20,000 per kind).
 *      The byte cap alone admits a small-but-huge payload (8 MB of minimal
 *      node objects parses to ~65k nodes and still freezes the render).
 *   3. SHAPE — isValidBoardDoc from localStore.ts, imported, not restated:
 *      one validator for the whole client (see round-import-limits il10,
 *      which asserts the identity against localStore's export).
 *
 * Every refusal returns {ok:false, msg} and the caller stops BEFORE any state
 * write, so the open board stays byte-identical; the msg is threaded to the
 * ExportModal's From-file note so the refusal is visible inside the modal.
 * The server keeps its own separate 5 MB MAX_BODY cap on saved boards
 * (vite.config.ts) — this module is the CLIENT import door only. */

import {isValidBoardDoc} from './localStore';

export const IMPORT_MAX_BYTES = 8 * 1024 * 1024; /* 8 MB of JSON text */
export const IMPORT_MAX_NODES = 20_000;
export const IMPORT_MAX_EDGES = 20_000;

/** The parsed doc as the import handler consumes it (nodes/edges already
 *  proven arrays by the door; App applies its own Node/Edge casts after). */
export type ImportedBoard = {nodes: unknown[]; edges: unknown[]; [k: string]: unknown};

/** One verdict for every refusal path — ok:true carries the parsed doc,
 *  ok:false carries the user-visible message (rendered in the modal). */
export type ImportVerdict =
  | {ok: true; doc: ImportedBoard}
  | {ok: false; msg: string};

const MB = 1024 * 1024;
const fmtMB = (bytes: number) => `${(bytes / MB).toFixed(1)} MB`;

/** The text door: cap → parse → sanity → shape, in that order, each refusal
 *  short-circuiting the next (an over-cap payload is never parsed; a
 *  huge-count payload never walks the validator's O(n) loops). */
export function readImportedText(text: string): ImportVerdict {
  const bytes = new Blob([text]).size;
  if (bytes > IMPORT_MAX_BYTES)
    return {ok: false, msg: `Import refused: ${fmtMB(bytes)} is over the 8 MB board-import cap.`};
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return {ok: false, msg: 'Import failed: could not parse JSON'};
  }
  const d = parsed as {nodes?: unknown; edges?: unknown};
  if (!Array.isArray(d.nodes) || !Array.isArray(d.edges))
    return {ok: false, msg: 'Import failed: invalid diagram JSON'};
  if (d.nodes.length > IMPORT_MAX_NODES || d.edges.length > IMPORT_MAX_EDGES)
    return {ok: false, msg: `Import refused: ${d.nodes.length} nodes / ${d.edges.length} edges is over the 20,000-per-kind sanity cap.`};
  if (!isValidBoardDoc(parsed))
    return {ok: false, msg: 'Import failed: invalid diagram JSON'};
  return {ok: true, doc: parsed as ImportedBoard};
}

/** The file door: file.size is known before the read, so the byte cap
 *  refuses without calling .text() at all — a 200 MB board file never
 *  enters the tab (round-import-limits il4 pins this with a stub whose
 *  .text() throws). */
export async function readImportedFile(file: File): Promise<ImportVerdict> {
  if (file.size > IMPORT_MAX_BYTES)
    return {ok: false, msg: `Import refused: ${fmtMB(file.size)} is over the 8 MB board-import cap.`};
  return readImportedText(await file.text());
}

/** The door's ONE validator, re-exported so callers import the pair from a
 *  single module surface (identity asserted by round-import-limits il10). */
export {isValidBoardDoc};
