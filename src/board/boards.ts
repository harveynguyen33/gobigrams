/* feature-map home: src/board/boards.ts */
/* CORE-STEP4A-FIX — the BoardDoc TYPE lives in @techgoblin/gobi-core now
 * (model/boardDoc.ts, on the package's own flow types): the adapter needs it
 * and the package must not import this file (serverBoards/localStore are
 * server-side app code that never reaches the tarball). */
export type {BoardDoc} from '../../packages/gobi/src/model/boardDoc';
import type {BoardDoc} from '../../packages/gobi/src/model/boardDoc';
/* HISTORY-V2 — the listing row type lives at the transport that first
 * produces it (serverBoards.ts, a leaf) so no new import edge is created;
 * re-exported here like BoardDoc: the seam is the app-facing one-stop. */
export type {HistoryRow} from './serverBoards';
import type {HistoryRow} from './serverBoards';
import type {Node, Edge} from '@xyflow/react';
import {type PresetId, type TemplateSpec, getPreset, asPreset} from '../presets';
import {type ThemeName} from '../theme/theme';
import {type TableStyle, type Density} from '../../packages/gobi/src/model/tableStyle';
/* ROUND BJ — the AT-1 boot probe moved to the leaf src/storageMode.ts so
 * library.ts can read it without importing boards.ts (which drags presets →
 * @xyflow/react into library's cone). Re-exported here under the names every
 * existing importer (App.tsx, harnesses) already uses. */
export {type StorageMode, PROBE_TIMEOUT, decideStorageMode, probeServerModeOnce} from './storageMode';
import {probeServerModeOnce, type StorageMode} from './storageMode';

/* ===========================================================================
   AT-1 — THE BOOT PROBE (moved to src/storageMode.ts; re-exported above).
   =========================================================================== */

export type BoardMeta = {
  id: string;
  name: string;
  updatedAt: number;
  nodeCount: number;
  edgeCount: number;
  /** L2: the board's diagram type, surfaced in the board list badge. */
  preset?: PresetId;
};


const LAST_KEY = 'diagram-studio:last-board';

/* ===========================================================================
   AT-2 — THE STORAGE SEAM. The SAME function names and signatures App.tsx has
   always called (`boards.listBoards/getBoard/createBoard/saveBoard/
   deleteBoard`), now backed by the mode the boot probe chose:
     server → src/serverBoards.ts (today's req() transport, moved verbatim)
     local  → src/localStore.ts   (IndexedDB; volatile in-memory last resort)
   App.tsx does NOT fork on mode — delegation happens HERE, once, behind the
   names it already uses. The probe failure paths all converge on LOCAL, so
   `awaitBackend()` never rejects; the only remaining failure is IndexedDB
   itself being unavailable, where localStore's volatile fallback keeps the
   app alive (AT-2).
   =========================================================================== */
import * as server from './serverBoards';
import * as local from './localStore';

/** The session's backend + mode, resolved exactly once (the memoised probe
 *  in probeServerModeOnce — AT-1: no mid-session flipping). */
let backendPromise: Promise<StorageMode> | null = null;

async function mode(): Promise<StorageMode> {
  backendPromise ??= probeServerModeOnce();
  return backendPromise;
}

/** AT-1 — the mode readout for the board-list header: server → "Saved to
 *  server files"; local → "Saved in this browser". Resolves after the boot
 *  probe; callers render what it returns (App.tsx holds it in state). */
export async function storageModeLabel(): Promise<string> {
  return (await mode()) === 'server' ? 'Saved to server files' : 'Saved in this browser';
}

export const listBoards = async (): Promise<BoardMeta[]> => {
  if ((await mode()) === 'local') return (await local.listBoards()).map(local.toBoardMeta);
  return server.listBoardsServer();
};

export const getBoard = async (id: string): Promise<BoardDoc> => {
  if ((await mode()) === 'local') return await local.getBoard(id) as BoardDoc;
  return server.getBoardServer(id);
};

/** HISTORY-V2 — the READ half of the save history, delegating by storage
 *  mode exactly like the neighbours above. One row per stored generation,
 *  NEWEST FIRST, the SAME shape in both modes (V4 landed the local store:
 *  the rows now come from the IndexedDB `versions` store there, with the
 *  server read half's own 404 gate for a board that is not live). */
export const listHistory = async (id: string): Promise<HistoryRow[]> => {
  if ((await mode()) === 'local') return local.listHistoryLocal(id);
  return server.listHistoryServer(id);
};

export const getHistoryVersion = async (id: string, stamp: string): Promise<BoardDoc> => {
  if ((await mode()) === 'local') return await local.getHistoryVersionLocal(id, stamp) as BoardDoc;
  return server.getHistoryVersionServer(id, stamp);
};

/** HISTORY-V3 (t_37f23a89) — RESTORE, the law in ONE place: fetch the stored
 *  generation, then PUT the exact old bytes back through the app's NORMAL
 *  save path with the request body carrying `historyReason: 'pre-restore'`.
 *  The checkpoint hook reads that flag on BOTH backends and bypasses the
 *  120 s sampling gap, so the state being replaced lands in history as the
 *  auto-shadow — a restore never loses a version, and undo-the-undo is just
 *  a second restore. (The local branch honors byte-diff while waiving the
 *  gap — restoring the state already live archives nothing there; the
 *  server's hook is unconditional, pinned by the sampling harness.) The
 *  caller ADOPTS the returned doc (App's applyBoard: adoption plus the
 *  undo/redo stack reset in the one board-adoption write — the stacks
 *  describe a different timeline after a restore). Nothing here is
 *  synthetic: no extra entries, no rewritten history. */
export const restoreHistoryVersion = async (id: string, stamp: string): Promise<BoardDoc> => {
  const doc = await getHistoryVersion(id, stamp);
  return saveBoard({...doc, historyReason: 'pre-restore'});
};

/** HISTORY-V3 — pin one generation, or edit an existing pin's label (the
 *  cap counts PINS, not edits: a re-label at cap 4 is a 200). `''` is a
 *  legal label — pinned without a name, the badge renders the pin alone.
 *  The cap itself (4) and the ≤80-char trim live in the backend that owns
 *  the records — server sidecar or local record — with the same answers. */
export const pinHistoryLabel = async (id: string, stamp: string, label: string): Promise<{ok: boolean; pinned: number}> => {
  if ((await mode()) === 'local') return local.pinHistoryLabelLocal(id, stamp, label);
  return server.pinHistoryLabelServer(id, stamp, label);
};

/** HISTORY-V3 — unpin one generation. The freed slot is immediately usable
 *  (the harness proves unpin-frees). Unpinning a stamp that was never
 *  pinned answers the read half's own 404. */
export const unpinHistoryLabel = async (id: string, stamp: string): Promise<{ok: boolean; pinned: number}> => {
  if ((await mode()) === 'local') return local.unpinHistoryLabelLocal(id, stamp);
  return server.unpinHistoryLabelServer(id, stamp);
};

export const createBoard = async (name: string): Promise<BoardDoc> => {
  if ((await mode()) === 'local') return await local.createBoard(name) as BoardDoc;
  return server.createBoardServer(name);
};

/** The saved document. `preset` / `legend` are board metadata and ride along
 *  unchanged — the boards API persists arbitrary JSON, so no backend edit.
 *  `theme` is LEGACY/IGNORED (PACKAGE-M fix): boards no longer store a theme,
 *  and neither backend writes it. The param stays optional so old callers and
 *  old files still type-check; nothing reads the value back. */
export const saveBoard = async (doc: {
  id: string; name: string; nodes: Node[]; edges: Edge[];
  preset?: PresetId; /** @deprecated (PACKAGE-M fix) — ignored; boards no longer store a theme. */ theme?: ThemeName; legend?: boolean;
  /** BOARD-STYLE (2026-11-09) — the board's own table style + density. Absent
   *  keys stay absent; each backend persists the two verbatim. */
  style?: TableStyle; density?: Density;
  /** HISTORY-V1/V3/V4 — the save-intent flag the checkpoint hook reads on
   *  BOTH backends ('pre-restore' bypasses the 120 s sampling gap so the
   *  state being replaced always lands as the auto-shadow; the local branch
   *  also honors byte-diff, so restoring the already-live state archives
   *  nothing there). Never persisted, never read back. */
  historyReason?: string;
}): Promise<BoardDoc> => {
  if ((await mode()) === 'local') {
    const saved = await local.saveBoard(doc);
    /* AT-4 #1 — persistence is requested once, on the first successful local
       write (never at boot: an empty database has nothing to protect). */
    local.requestPersistenceOnce();
    return saved as BoardDoc;
  }
  return server.saveBoardServer(doc);
};

export const deleteBoard = async (id: string): Promise<{ok: boolean}> => {
  if ((await mode()) === 'local') return local.deleteBoard(id);
  return server.deleteBoardServer(id);
};


export const cacheLastBoard = (id: string) => {
  try { localStorage.setItem(LAST_KEY, id); } catch { /* ignore */ }
};
export const lastBoardId = (): string | null => {
  try { return localStorage.getItem(LAST_KEY); } catch { return null; }
};

/** A seeded document for `createBoard` — used by the preset templates. */
export function templateDoc(t: TemplateSpec, name: string): {nodes: Node[]; edges: Edge[]; name: string} {
  return {name, nodes: t.nodes.map(n => ({...n})), edges: t.edges.map(e => ({...e}))};
}

/** Which template (if any) should seed a brand-new board of this preset. */
export function defaultTemplate(presetId: unknown, templateId?: string): TemplateSpec | undefined {
  const p = getPreset(presetId);
  if (!p.templates?.length) return undefined;
  return p.templates.find(t => t.id === templateId) ?? p.templates[0];
}

/* ROUND 3 — THE AUTO-NUMBERED DEFAULT NAME.
 *
 * WHY. The name is OPTIONAL now: "Use template" creates the board in one click
 * and the New-board dialog's field merely starts from the same default, so the
 * user can accept it and just press Create. The default must therefore be
 * unique across the boards that already exist, or the second board the user
 * accepts would share a name with the first.
 *
 * TRIM DECISION (checks/package-templates.mjs §5 asserts this). The collision
 * KEY is the name TRIMMED, and the comparison is exact and case-sensitive:
 *   - `' untitled '` trims to `'untitled'`, which is NOT `'Untitled'` — case
 *     differs — so it is NOT a collision and this returns `'Untitled'`.
 *   - `'Untitled '` DOES collide (both sides trim to `'Untitled'`), which is the
 *     point of trimming at all: a name that differs only by surrounding
 *     whitespace would otherwise hand out a duplicate.
 * A user's own `My first board` never matches. Neither does `Untitled notes`
 * (the tail must be `<space><digits>`, nothing else), so only `Untitled` and
 * `Untitled <digits>` take part in the numbering.
 *
 * PURE: no React, no DOM, no fetch — a Node probe can bundle and execute it. */
export function nextUntitledName(existing: readonly string[]): string {
  const key = (s: string) => s.trim();
  const taken = new Set(existing.map(key));
  if (!taken.has('Untitled')) return 'Untitled';
  /* The SMALLEST unused N ≥ 2 — so deleting `Untitled 2` and creating again
   * fills the gap instead of counting the survivors and skipping a number. */
  for (let n = 2; ; n++) {
    const candidate = `Untitled ${n}`;
    if (!taken.has(candidate)) return candidate;
  }
}

/* ROUND 6, ITEM 3 — WHAT NAME A NEW BOARD GETS, WHEN ONE MAY HAVE BEEN TYPED.
 *
 * THE DEFECT THIS EXISTS FOR. The New-board dialog's create body has a name
 * field, and a board created from the "Use template" row was still coming out
 * `Untitled N`: the typed value was dropped on the floor at the dialog→gallery
 * hop, so `createFromTemplate` was handed no name and auto-numbered. This is the
 * ONE place that decides whether a carried value wins or the auto-numbered
 * default does, so App.tsx does not have to spell the rule out twice.
 *
 * THE RULE: a name that is non-empty AFTER TRIMMING wins, and the TRIMMED form
 * is what is stored (a name typed with a stray space is not persisted with it).
 * An absent name, an empty string, or whitespace only falls back to
 * `nextUntitledName(existing)`: "the field is empty" is a legitimate way to ask
 * for the default, not an error.
 *
 * PURE, like its neighbour: the caller supplies the existing names, so this
 * module still needs no board list, no React and no fetch — and a Node probe can
 * bundle and EXECUTE it instead of restating the rule. */
export function resolveBoardName(given: string | undefined, existing: readonly string[]): string {
  const trimmed = given?.trim() ?? '';
  return trimmed.length ? trimmed : nextUntitledName(existing);
}

export {asPreset};
